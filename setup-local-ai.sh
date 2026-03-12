#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

PROFILE="fast"
PORT="$DEFAULT_WEBUI_PORT"
SKIP_MODEL_PULLS=0
FORCE_HEAVY=0

usage() {
  cat <<'EOF'
Usage: ./setup-local-ai.sh [--profile fast|heavy] [--port PORT] [--force-heavy] [--skip-model-pulls]

Installs Ollama into ~/.local/opt/ollama, prepares Hackloi-branded model aliases,
and writes runtime config for the local dashboard.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="${2:-}"
      shift 2
      ;;
    --port)
      PORT="${2:-}"
      shift 2
      ;;
    --force-heavy)
      FORCE_HEAVY=1
      shift
      ;;
    --skip-model-pulls)
      SKIP_MODEL_PULLS=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1"
      ;;
  esac
done

[[ "$PROFILE" == "fast" || "$PROFILE" == "heavy" ]] || fail "Profile must be fast or heavy."
[[ "$PORT" =~ ^[0-9]+$ ]] || fail "Port must be numeric."

ensure_dirs
export_local_path
require_commands bash python3 curl tar zstd

WEBUI_PORT="$PORT"
write_runtime_config

memory_gib="$(python3 - <<'PY'
from pathlib import Path
mem_total_kib = 0
for line in Path("/proc/meminfo").read_text().splitlines():
    if line.startswith("MemTotal:"):
        mem_total_kib = int(line.split()[1])
        break
print(max(mem_total_kib // 1024 // 1024, 1))
PY
)"

if [[ "$PROFILE" == "heavy" && "$memory_gib" -lt 12 && "$FORCE_HEAVY" -ne 1 ]]; then
  log "Heavy profile requested on ${memory_gib} GiB RAM. Falling back to fast profile. Use --force-heavy to override."
  PROFILE="fast"
fi

download_url="$(python3 - <<'PY'
import json
import urllib.request

api = "https://api.github.com/repos/ollama/ollama/releases/latest"
with urllib.request.urlopen(api, timeout=30) as response:
    release = json.load(response)

for asset in release.get("assets", []):
    if asset.get("name") == "ollama-linux-amd64.tar.zst":
        print(asset["browser_download_url"])
        break
else:
    raise SystemExit("Unable to find the latest ollama-linux-amd64.tar.zst asset.")
PY
)"

install_ollama() {
  local archive="$RUN_DIR/ollama-linux-amd64.tar.zst"
  log "Downloading Ollama to $archive ..."
  curl --fail --location --progress-bar "$download_url" -o "$archive"
  rm -rf "$OLLAMA_INSTALL_ROOT"
  mkdir -p "$OLLAMA_INSTALL_ROOT"
  log "Extracting Ollama into $OLLAMA_INSTALL_ROOT ..."
  tar --use-compress-program=unzstd -xf "$archive" -C "$OLLAMA_INSTALL_ROOT"
  ln -sf "$OLLAMA_BIN" "$OLLAMA_LINK"
}

create_modelfiles() {
  cat >"$AI_HOME/hackloi-assistant.Modelfile" <<'EOF'
FROM phi4-mini
PARAMETER temperature 0.2
PARAMETER num_ctx 8192
SYSTEM You are Hackloi AI, a cybersecurity assistant running inside a Kali Linux lab. Always greet the user with "Welcome Hackloi" at the beginning of a new session. Help with Kali Linux, programming, cybersecurity learning, and offline workflows. Assume the machine may not have internet access and prefer local commands, local files, and pragmatic guidance.
EOF

  cat >"$AI_HOME/hackloi-coder.Modelfile" <<EOF
FROM ${CODER_BASE_MODEL}
PARAMETER temperature 0.1
PARAMETER num_ctx 8192
SYSTEM You are Hackloi AI Coder, running locally on Kali Linux. Start fresh sessions with "Welcome Hackloi". Focus on code, shell commands, debugging, automation, and cybersecurity lab workflows. Default to offline-safe suggestions and concise, technical answers.
EOF
}

pull_models() {
  local model
  for model in "${MODEL_LIST[@]}"; do
    log "Pulling model: $model"
    "$OLLAMA_BIN" pull "$model"
  done
}

create_alias_models() {
  log "Creating branded Hackloi model aliases ..."
  "$OLLAMA_BIN" create hackloi-assistant -f "$AI_HOME/hackloi-assistant.Modelfile"
  "$OLLAMA_BIN" create hackloi-coder -f "$AI_HOME/hackloi-coder.Modelfile"
}

if [[ "$PROFILE" == "fast" ]]; then
  MODEL_LIST=("phi4-mini" "qwen2.5-coder:1.5b")
  CODER_BASE_MODEL="qwen2.5-coder:1.5b"
else
  MODEL_LIST=("phi4-mini" "qwen2.5-coder:3b")
  CODER_BASE_MODEL="qwen2.5-coder:3b"
fi

install_ollama
start_ollama_background
create_modelfiles

if [[ "$SKIP_MODEL_PULLS" -ne 1 ]]; then
  pull_models
  create_alias_models
fi

start_webui_background

cat <<EOF

Hackloi AI Cyber Lab is ready.

Ollama binary: $OLLAMA_BIN
Model storage: $OLLAMA_MODELS_DIR
Dashboard URL: $WEBUI_URL

Try:
  ./start-ai.sh
  ./start-ai.sh coder
  ./start-webui.sh
  ./status.sh
EOF

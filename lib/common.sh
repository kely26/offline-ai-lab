#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AI_HOME="${HACKLOI_AI_HOME:-$HOME/.local/share/hackloi-ai}"
CONFIG_FILE="$AI_HOME/runtime.env"
LOG_DIR="$AI_HOME/logs"
RUN_DIR="$AI_HOME/run"
OLLAMA_INSTALL_ROOT="${OLLAMA_INSTALL_ROOT:-$HOME/.local/opt/ollama}"
OLLAMA_BIN="$OLLAMA_INSTALL_ROOT/bin/ollama"
OLLAMA_LINK="$HOME/.local/bin/ollama"
OLLAMA_MODELS_DIR="${OLLAMA_MODELS_DIR:-$AI_HOME/models}"
OLLAMA_HOST_ADDR="${OLLAMA_HOST_ADDR:-127.0.0.1:11434}"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://$OLLAMA_HOST_ADDR}"
DEFAULT_WEBUI_PORT="${DEFAULT_WEBUI_PORT:-3000}"
WEBUI_HOST="${WEBUI_HOST:-127.0.0.1}"
WEBUI_PORT="${WEBUI_PORT:-$DEFAULT_WEBUI_PORT}"
WEBUI_URL="http://$WEBUI_HOST:$WEBUI_PORT"
OLLAMA_PID_FILE="$RUN_DIR/ollama.pid"
WEBUI_PID_FILE="$RUN_DIR/webui.pid"

if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
  OLLAMA_BASE_URL="http://$OLLAMA_HOST_ADDR"
  WEBUI_PORT="${WEBUI_PORT:-$DEFAULT_WEBUI_PORT}"
  WEBUI_URL="http://$WEBUI_HOST:$WEBUI_PORT"
fi

ensure_dirs() {
  mkdir -p "$AI_HOME" "$LOG_DIR" "$RUN_DIR" "$OLLAMA_MODELS_DIR" "$HOME/.local/bin"
}

export_local_path() {
  export PATH="$HOME/.local/bin:$OLLAMA_INSTALL_ROOT/bin:$PATH"
}

timestamp() {
  date +"%Y-%m-%d %H:%M:%S"
}

log() {
  printf '[%s] %s\n' "$(timestamp)" "$*"
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_commands() {
  local missing=()
  local cmd
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null 2>&1 || missing+=("$cmd")
  done
  if (( ${#missing[@]} > 0 )); then
    fail "Missing required command(s): ${missing[*]}"
  fi
}

port_in_use() {
  python3 - "$1" <<'PY'
import socket
import sys

port = int(sys.argv[1])
sock = socket.socket()
sock.settimeout(0.2)
try:
    sock.bind(("127.0.0.1", port))
except OSError:
    print("used")
finally:
    sock.close()
PY
}

write_runtime_config() {
  ensure_dirs
  cat >"$CONFIG_FILE" <<EOF
WEBUI_HOST=${WEBUI_HOST}
WEBUI_PORT=${WEBUI_PORT}
OLLAMA_MODELS_DIR=${OLLAMA_MODELS_DIR}
OLLAMA_HOST_ADDR=${OLLAMA_HOST_ADDR}
EOF
}

pid_from_file() {
  local file="$1"
  [[ -f "$file" ]] || return 1
  tr -d '[:space:]' <"$file"
}

pid_running() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

ollama_ready() {
  curl --silent --show-error --fail --max-time 2 "$OLLAMA_BASE_URL/api/tags" >/dev/null 2>&1
}

webui_ready() {
  curl --silent --show-error --fail --max-time 2 "$WEBUI_URL/api/health" >/dev/null 2>&1
}

wait_for_http() {
  local url="$1"
  local retries="${2:-30}"
  local i
  for ((i = 0; i < retries; i += 1)); do
    if curl --silent --show-error --fail --max-time 2 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_for_ollama() {
  wait_for_http "$OLLAMA_BASE_URL/api/tags" "${1:-45}"
}

wait_for_webui() {
  wait_for_http "$WEBUI_URL/api/health" "${1:-30}"
}

start_ollama_background() {
  ensure_dirs
  export_local_path
  [[ -x "$OLLAMA_BIN" ]] || fail "Ollama is not installed. Run ./setup-local-ai.sh first."
  if ollama_ready; then
    return 0
  fi

  local existing_pid
  existing_pid="$(pid_from_file "$OLLAMA_PID_FILE" 2>/dev/null || true)"
  if pid_running "$existing_pid"; then
    wait_for_ollama 10 && return 0
  fi

  log "Starting Ollama in the background..."
  nohup env \
    OLLAMA_HOST="$OLLAMA_HOST_ADDR" \
    OLLAMA_MODELS="$OLLAMA_MODELS_DIR" \
    OLLAMA_KEEP_ALIVE=30m \
    OLLAMA_NUM_PARALLEL=1 \
    OLLAMA_MAX_LOADED_MODELS=1 \
    "$OLLAMA_BIN" serve \
    >"$LOG_DIR/ollama.log" 2>&1 &
  echo $! >"$OLLAMA_PID_FILE"
  wait_for_ollama 45 || fail "Ollama did not become ready. Check $LOG_DIR/ollama.log"
}

start_webui_background() {
  ensure_dirs
  export_local_path
  if webui_ready; then
    return 0
  fi

  if [[ "$(port_in_use "$WEBUI_PORT")" == "used" ]]; then
    fail "Port $WEBUI_PORT is already in use. Set WEBUI_PORT or rerun setup with --port."
  fi

  local existing_pid
  existing_pid="$(pid_from_file "$WEBUI_PID_FILE" 2>/dev/null || true)"
  if pid_running "$existing_pid"; then
    wait_for_webui 10 && return 0
  fi

  log "Starting Hackloi AI web dashboard on $WEBUI_URL ..."
  nohup env \
    HACKLOI_AI_HOME="$AI_HOME" \
    OLLAMA_API_BASE="$OLLAMA_BASE_URL" \
    WEBUI_HOST="$WEBUI_HOST" \
    WEBUI_PORT="$WEBUI_PORT" \
    python3 "$ROOT_DIR/webui/server.py" \
    >"$LOG_DIR/webui.log" 2>&1 &
  echo $! >"$WEBUI_PID_FILE"
  wait_for_webui 30 || fail "Web UI did not become ready. Check $LOG_DIR/webui.log"
}

stop_pid_if_running() {
  local file="$1"
  local pid
  pid="$(pid_from_file "$file" 2>/dev/null || true)"
  if pid_running "$pid"; then
    kill "$pid" 2>/dev/null || true
  fi
  rm -f "$file"
}

model_exists() {
  local name="$1"
  [[ -x "$OLLAMA_BIN" ]] || return 1
  "$OLLAMA_BIN" list 2>/dev/null | awk 'NR > 1 {print $1}' | grep -Fxq "$name"
}

preferred_assistant_model() {
  if model_exists "hackloi-assistant"; then
    printf 'hackloi-assistant\n'
  else
    printf 'phi4-mini\n'
  fi
}

preferred_coder_model() {
  if model_exists "hackloi-coder"; then
    printf 'hackloi-coder\n'
  elif model_exists "qwen2.5-coder:3b"; then
    printf 'qwen2.5-coder:3b\n'
  else
    printf 'qwen2.5-coder:1.5b\n'
  fi
}

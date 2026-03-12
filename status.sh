#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

ensure_dirs
export_local_path

printf 'Hackloi AI Home: %s\n' "$AI_HOME"
printf 'Dashboard URL: %s\n' "$WEBUI_URL"
printf 'Ollama URL: %s\n' "$OLLAMA_BASE_URL"
printf '\n'

if [[ -x "$OLLAMA_BIN" ]]; then
  printf 'Ollama binary: %s\n' "$OLLAMA_BIN"
else
  printf 'Ollama binary: missing\n'
fi

if ollama_ready; then
  printf 'Ollama status: ready\n'
else
  printf 'Ollama status: offline\n'
fi

if webui_ready; then
  printf 'Web UI status: ready\n'
else
  printf 'Web UI status: offline\n'
fi

printf '\nPIDs\n'
printf '  Ollama: %s\n' "$(pid_from_file "$OLLAMA_PID_FILE" 2>/dev/null || echo 'not running')"
printf '  Web UI: %s\n' "$(pid_from_file "$WEBUI_PID_FILE" 2>/dev/null || echo 'not running')"

if ollama_ready; then
  printf '\nModels\n'
  "$OLLAMA_BIN" list
fi

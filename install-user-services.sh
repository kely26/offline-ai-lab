#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_HOME="${HACKLOI_AI_HOME:-$HOME/.local/share/hackloi-ai}"
SYSTEMD_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
INSTALLED_APP_ROOT="/usr/lib/Hackloi AI Cyber Lab/_up_"
APP_ROOT="${APP_ROOT:-$SCRIPT_DIR}"
OLLAMA_BIN="${OLLAMA_BIN:-$HOME/.local/opt/ollama/bin/ollama}"

WEBUI_SERVER="$APP_ROOT/webui/server.py"

if [[ ! -x "$OLLAMA_BIN" ]]; then
  echo "ERROR: Ollama binary not found at $OLLAMA_BIN" >&2
  echo "Run ./setup-local-ai.sh first." >&2
  exit 1
fi

if [[ ! -f "$WEBUI_SERVER" ]]; then
  echo "ERROR: Web UI server not found at $WEBUI_SERVER" >&2
  exit 1
fi

mkdir -p "$SYSTEMD_DIR" "$AI_HOME/logs" "$AI_HOME/run" "$AI_HOME/models"

cat >"$SYSTEMD_DIR/hackloi-ollama.service" <<EOF
[Unit]
Description=Hackloi Ollama Service
After=default.target

[Service]
Type=simple
Environment=OLLAMA_HOST=127.0.0.1:11434
Environment=OLLAMA_MODELS=${AI_HOME}/models
Environment=OLLAMA_KEEP_ALIVE=30m
Environment=OLLAMA_NUM_PARALLEL=1
Environment=OLLAMA_MAX_LOADED_MODELS=1
ExecStartPre=/usr/bin/mkdir -p ${AI_HOME}/models ${AI_HOME}/logs ${AI_HOME}/run
ExecStart=${OLLAMA_BIN} serve
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF

cat >"$SYSTEMD_DIR/hackloi-webui.service" <<EOF
[Unit]
Description=Hackloi Web UI Service
After=hackloi-ollama.service
Wants=hackloi-ollama.service

[Service]
Type=simple
WorkingDirectory=${APP_ROOT}
Environment=HACKLOI_AI_HOME=${AI_HOME}
Environment=OLLAMA_API_BASE=http://127.0.0.1:11434
Environment=WEBUI_HOST=127.0.0.1
Environment=WEBUI_PORT=3000
ExecStartPre=/usr/bin/mkdir -p ${AI_HOME}/logs ${AI_HOME}/run
ExecStart=/usr/bin/python3 ${WEBUI_SERVER}
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now hackloi-ollama.service hackloi-webui.service

cat <<EOF
Hackloi user services installed.

Check status:
  systemctl --user status hackloi-ollama.service
  systemctl --user status hackloi-webui.service

Follow logs:
  journalctl --user -u hackloi-ollama.service -f
  journalctl --user -u hackloi-webui.service -f
EOF

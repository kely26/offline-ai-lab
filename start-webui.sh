#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

ensure_dirs
export_local_path
start_ollama_background
start_webui_background

cat <<EOF
Hackloi AI dashboard is running.
Open: $WEBUI_URL
EOF

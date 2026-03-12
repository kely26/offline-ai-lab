#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

MODE="${1:-assistant}"
if [[ $# -gt 0 ]]; then
  shift
fi

ensure_dirs
export_local_path
start_ollama_background

case "$MODE" in
  assistant)
    MODEL_NAME="$(preferred_assistant_model)"
    ;;
  coder)
    MODEL_NAME="$(preferred_coder_model)"
    ;;
  *)
    MODEL_NAME="$MODE"
    ;;
esac

cat <<EOF
==============================
Welcome Hackloi
Your Local Private AI is Ready
Model: $MODEL_NAME
==============================
EOF

exec "$OLLAMA_BIN" run "$MODEL_NAME" "$@"

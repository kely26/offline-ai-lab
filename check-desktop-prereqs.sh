#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

status_line() {
  printf '%-28s %s\n' "$1" "$2"
}

check_command() {
  local name="$1"
  local label="$2"
  if command -v "$name" >/dev/null 2>&1; then
    status_line "$label" "OK ($(command -v "$name"))"
  else
    status_line "$label" "MISSING"
  fi
}

check_pkgconfig() {
  local name="$1"
  local label="$2"
  if pkg-config --exists "$name" 2>/dev/null; then
    status_line "$label" "OK"
  else
    status_line "$label" "MISSING"
  fi
}

echo "Hackloi AI Cyber Lab desktop prerequisite check"
echo
check_command bash "bash"
check_command python3 "python3"
check_command node "node"
check_command npm "npm"
check_command cargo "cargo"
check_command rustc "rustc"
check_command pkg-config "pkg-config"
check_pkgconfig webkit2gtk-4.1 "webkit2gtk-4.1"
check_pkgconfig ayatana-appindicator3-0.1 "ayatana-appindicator3"
check_pkgconfig librsvg-2.0 "librsvg-2.0"

echo
echo "Recommended install commands on Kali/Debian:"
echo "  sudo apt update"
echo "  sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev"
echo "  cd \"$REPO_ROOT\" && npm install"

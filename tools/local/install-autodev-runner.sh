#!/usr/bin/env bash
set -euo pipefail

UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
BIN_DIR="$HOME/.local/bin"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/saltmarcher-autodev"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v systemctl >/dev/null 2>&1 || {
    echo "systemd --user is required."
    exit 1
}

mkdir -p "$UNIT_DIR" "$BIN_DIR" "$DATA_DIR"
cp "$SCRIPT_DIR/saltmarcher-autodev.sh" "$BIN_DIR/"
cp "$SCRIPT_DIR/saltmarcher-autodev-task-prompt.md" "$DATA_DIR/task-prompt.md"
cp "$SCRIPT_DIR/systemd/saltmarcher-autodev.service" "$UNIT_DIR/"
chmod 755 "$BIN_DIR/saltmarcher-autodev.sh"
systemctl --user daemon-reload
if systemctl --user is-active --quiet saltmarcher-autodev.service; then
    systemctl --user restart saltmarcher-autodev.service
else
    systemctl --user enable --now saltmarcher-autodev.service
fi
systemctl --user status saltmarcher-autodev.service --no-pager

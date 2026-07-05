#!/usr/bin/env bash
set -euo pipefail

UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
BIN_DIR="$HOME/.local/bin"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v systemctl >/dev/null 2>&1 || {
    echo "systemd --user is required."
    exit 1
}

mkdir -p "$UNIT_DIR" "$BIN_DIR"
cp "$SCRIPT_DIR/saltmarcher-update.sh" "$BIN_DIR/"
cp "$SCRIPT_DIR/saltmarcher-next.sh" "$BIN_DIR/"
cp "$SCRIPT_DIR/saltmarcher-status.sh" "$BIN_DIR/"
cp "$SCRIPT_DIR/create-github-labels.sh" "$BIN_DIR/"
cp "$SCRIPT_DIR/systemd/saltmarcher-update.service" "$UNIT_DIR/"
cp "$SCRIPT_DIR/systemd/saltmarcher-update.timer" "$UNIT_DIR/"
systemctl --user daemon-reload
systemctl --user enable --now saltmarcher-update.timer
systemctl --user status saltmarcher-update.timer --no-pager

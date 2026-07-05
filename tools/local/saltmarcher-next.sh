#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${SALTMARCHER_REPO_URL:-https://github.com/ThonkTank/Salt-Marcher.git}"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/saltmarcher"
CLONE_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/saltmarcher-repo"
NEXT_DATA="$STATE_DIR/next-data"

mkdir -p "$STATE_DIR"
if [[ ! -d "$CLONE_DIR/.git" ]]; then
    git clone "$REPO_URL" "$CLONE_DIR"
fi

cd "$CLONE_DIR"
git fetch origin main
git checkout origin/main
rm -rf "$NEXT_DATA"
mkdir -p "$NEXT_DATA"
latest_backup="$(find "$STATE_DIR/backups" -name 'data-*.tar.gz' -type f 2>/dev/null | sort | tail -n1 || true)"
if [[ -n "$latest_backup" ]]; then
    tar -xzf "$latest_backup" -C "$NEXT_DATA"
fi
XDG_DATA_HOME="$NEXT_DATA" ./gradlew run --console=plain

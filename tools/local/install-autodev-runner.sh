#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUNNER_ROOT="$REPO_ROOT/.codex/autodev/runner"
REPO_CLONE_DIR="$RUNNER_ROOT/repo"
REPORT_DIR="$RUNNER_ROOT/reports"
SYSTEMD_DIR="$RUNNER_ROOT/systemd"
UNIT_FILE="$SYSTEMD_DIR/saltmarcher-autodev.service"
USER_UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
OLD_BIN="$HOME/.local/bin/saltmarcher-autodev.sh"
OLD_DATA_DIR="$HOME/.local/share/saltmarcher-autodev"
OLD_STATE_DIR="$HOME/.local/state/saltmarcher/autodev"
OLD_UNIT_FILE="$USER_UNIT_DIR/saltmarcher-autodev.service"

command -v systemctl >/dev/null 2>&1 || {
    echo "systemd --user is required."
    exit 1
}

[[ -f "$REPO_ROOT/AGENTS.md" && -d "$REPO_ROOT/.git" ]] || {
    echo "install-autodev-runner.sh must run from inside the SaltMarcher repo."
    exit 2
}

copy_dir_contents() {
    local source_dir="$1"
    local target_dir="$2"
    [[ -d "$source_dir" ]] || return 0
    mkdir -p "$target_dir"
    cp -a "$source_dir"/. "$target_dir"/
}

migrate_legacy_runner_state() {
    mkdir -p "$RUNNER_ROOT" "$REPORT_DIR"

    if [[ -d "$OLD_STATE_DIR" ]]; then
        copy_dir_contents "$OLD_STATE_DIR" "$RUNNER_ROOT"
        mkdir -p "$REPORT_DIR"
        shopt -s nullglob
        for report in "$RUNNER_ROOT"/report-*.md; do
            mv "$report" "$REPORT_DIR/"
        done
        shopt -u nullglob
        rm -rf "$OLD_STATE_DIR"
    fi

    if [[ -d "$OLD_DATA_DIR/repo" && ! -d "$REPO_CLONE_DIR" ]]; then
        mkdir -p "$RUNNER_ROOT"
        mv "$OLD_DATA_DIR/repo" "$REPO_CLONE_DIR"
    fi
    rm -rf "$OLD_DATA_DIR"
    rm -f "$OLD_BIN"
}

write_repo_unit() {
    mkdir -p "$SYSTEMD_DIR" "$USER_UNIT_DIR"
    cat > "$UNIT_FILE" <<EOF
[Unit]
Description=SaltMarcher continuous autonomous development runner
After=network-online.target

[Service]
Type=simple
WorkingDirectory=$REPO_ROOT
ExecStart=$REPO_ROOT/tools/local/saltmarcher-autodev.sh
Restart=always
RestartSec=60
Nice=19
IOSchedulingClass=idle

[Install]
WantedBy=default.target
EOF
}

systemctl --user disable --now saltmarcher-autodev.service >/dev/null 2>&1 || true
migrate_legacy_runner_state
write_repo_unit
rm -f "$OLD_UNIT_FILE"
systemctl --user link "$UNIT_FILE" >/dev/null
systemctl --user daemon-reload
systemctl --user enable --now saltmarcher-autodev.service
systemctl --user status saltmarcher-autodev.service --no-pager

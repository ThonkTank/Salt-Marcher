#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$BUNDLE_ROOT/../.." && pwd)"
LOOPER_STATE_ROOT="$BUNDLE_ROOT/state"
REPO_CLONE_DIR="$LOOPER_STATE_ROOT/repo"
REPORT_DIR="$LOOPER_STATE_ROOT/reports"
PROCESS_LAB_DIR="$LOOPER_STATE_ROOT/process-lab"
LEGACY_ARCHIVE_DIR="$LOOPER_STATE_ROOT/archive/legacy"
SYSTEMD_TEMPLATE="$BUNDLE_ROOT/systemd/saltmarcher-looper.service.template"
SYSTEMD_DIR="$LOOPER_STATE_ROOT/systemd"
UNIT_FILE="$SYSTEMD_DIR/saltmarcher-looper.service"
USER_UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
LOOPER_UNIT_LINK="$USER_UNIT_DIR/saltmarcher-looper.service"

LEGACY_AUTODEV_BIN="$HOME/.local/bin/saltmarcher-autodev.sh"
LEGACY_AUTODEV_DATA_DIR="$HOME/.local/share/saltmarcher-autodev"
LEGACY_AUTODEV_STATE_DIR="$HOME/.local/state/saltmarcher/autodev"
LEGACY_AUTODEV_REPO_RUNTIME_DIR="$REPO_ROOT/.codex/autodev"
LEGACY_AUTODEV_RUNTIME_DIR="$REPO_ROOT/.codex/autodev/runner"
LEGACY_AUTODEV_UNIT_FILE="$USER_UNIT_DIR/saltmarcher-autodev.service"
LEGACY_LOOPER_BIN="$HOME/.local/bin/saltmarcher-looper.sh"
LEGACY_LOOPER_DATA_DIR="$HOME/.local/share/saltmarcher-looper"
LEGACY_LOOPER_STATE_DIR="$HOME/.local/state/saltmarcher/looper"
LEGACY_LOOPER_REPO_RUNTIME_DIR="$REPO_ROOT/.codex/looper"

command -v systemctl >/dev/null 2>&1 || {
    echo "systemd --user is required."
    exit 1
}

[[ -f "$REPO_ROOT/AGENTS.md" && -d "$REPO_ROOT/.git" ]] || {
    echo "install.sh must run from inside the SaltMarcher repo."
    exit 2
}

[[ -f "$SYSTEMD_TEMPLATE" ]] || {
    echo "missing systemd template: $SYSTEMD_TEMPLATE"
    exit 3
}

copy_dir_contents() {
    local source_dir="$1"
    local target_dir="$2"
    [[ -d "$source_dir" ]] || return 0
    mkdir -p "$target_dir"
    cp -a "$source_dir"/. "$target_dir"/
}

move_dir_contents() {
    local source_dir="$1"
    local target_dir="$2"
    [[ -d "$source_dir" ]] || return 0
    copy_dir_contents "$source_dir" "$target_dir"
    rm -rf "$source_dir"
}

archive_dir() {
    local source_dir="$1"
    local archive_name="$2"
    [[ -d "$source_dir" ]] || return 0
    mkdir -p "$LEGACY_ARCHIVE_DIR"
    rm -rf "$LEGACY_ARCHIVE_DIR/$archive_name"
    cp -a "$source_dir" "$LEGACY_ARCHIVE_DIR/$archive_name"
}

archive_file() {
    local source_file="$1"
    local archive_name="$2"
    [[ -f "$source_file" ]] || return 0
    mkdir -p "$LEGACY_ARCHIVE_DIR/$(dirname "$archive_name")"
    mv "$source_file" "$LEGACY_ARCHIVE_DIR/$archive_name"
}

move_matching_files() {
    local source_dir="$1"
    local pattern="$2"
    local target_dir="$3"
    [[ -d "$source_dir" ]] || return 0
    mkdir -p "$target_dir"
    shopt -s nullglob
    for item in "$source_dir"/$pattern; do
        mv "$item" "$target_dir/"
    done
    shopt -u nullglob
}

migrate_legacy_looper_state() {
    mkdir -p "$LOOPER_STATE_ROOT" "$REPORT_DIR" "$PROCESS_LAB_DIR" "$LEGACY_ARCHIVE_DIR"

    if [[ -d "$LEGACY_LOOPER_REPO_RUNTIME_DIR" ]]; then
        move_dir_contents "$LEGACY_LOOPER_REPO_RUNTIME_DIR" "$LOOPER_STATE_ROOT"
    fi

    if [[ -d "$LEGACY_AUTODEV_REPO_RUNTIME_DIR" ]]; then
        archive_dir "$LEGACY_AUTODEV_REPO_RUNTIME_DIR" "dot-codex-autodev"
        if [[ -d "$LEGACY_AUTODEV_RUNTIME_DIR" ]]; then
            move_dir_contents "$LEGACY_AUTODEV_RUNTIME_DIR" "$LOOPER_STATE_ROOT"
        fi
        copy_dir_contents "$LEGACY_AUTODEV_REPO_RUNTIME_DIR" "$PROCESS_LAB_DIR"
        rm -rf "$LEGACY_AUTODEV_REPO_RUNTIME_DIR"
    elif [[ -d "$LEGACY_AUTODEV_RUNTIME_DIR" ]]; then
        move_dir_contents "$LEGACY_AUTODEV_RUNTIME_DIR" "$LOOPER_STATE_ROOT"
    fi

    if [[ -d "$LEGACY_AUTODEV_STATE_DIR" ]]; then
        archive_dir "$LEGACY_AUTODEV_STATE_DIR" "home-state-autodev"
        copy_dir_contents "$LEGACY_AUTODEV_STATE_DIR" "$PROCESS_LAB_DIR"
        rm -rf "$LEGACY_AUTODEV_STATE_DIR"
    fi

    if [[ -d "$LEGACY_LOOPER_STATE_DIR" ]]; then
        move_dir_contents "$LEGACY_LOOPER_STATE_DIR" "$LOOPER_STATE_ROOT"
    fi

    if [[ -d "$LEGACY_AUTODEV_DATA_DIR/repo" && ! -d "$REPO_CLONE_DIR" ]]; then
        mkdir -p "$LOOPER_STATE_ROOT"
        mv "$LEGACY_AUTODEV_DATA_DIR/repo" "$REPO_CLONE_DIR"
    fi
    if [[ -d "$LEGACY_LOOPER_DATA_DIR/repo" && ! -d "$REPO_CLONE_DIR" ]]; then
        mkdir -p "$LOOPER_STATE_ROOT"
        mv "$LEGACY_LOOPER_DATA_DIR/repo" "$REPO_CLONE_DIR"
    fi

    move_matching_files "$LOOPER_STATE_ROOT" "report-*.md" "$REPORT_DIR"
    move_matching_files "$LOOPER_STATE_ROOT/logs" "autodev-*.log" "$LEGACY_ARCHIVE_DIR/logs"
    archive_file "$LOOPER_STATE_ROOT/systemd/saltmarcher-autodev.service" "systemd/saltmarcher-autodev.service"

    rm -rf "$LEGACY_AUTODEV_DATA_DIR" "$LEGACY_LOOPER_DATA_DIR"
    rm -f "$LEGACY_AUTODEV_BIN" "$LEGACY_LOOPER_BIN"
}

write_repo_unit() {
    mkdir -p "$SYSTEMD_DIR" "$USER_UNIT_DIR"
    sed \
        -e "s#@REPO_ROOT@#$REPO_ROOT#g" \
        -e "s#@LOOPER_EXEC@#$BUNDLE_ROOT/bin/looper.sh#g" \
        "$SYSTEMD_TEMPLATE" > "$UNIT_FILE"
}

systemctl --user disable --now saltmarcher-autodev.service >/dev/null 2>&1 || true
systemctl --user disable --now saltmarcher-looper.service >/dev/null 2>&1 || true
migrate_legacy_looper_state
write_repo_unit
rm -f "$LEGACY_AUTODEV_UNIT_FILE" "$LOOPER_UNIT_LINK"
systemctl --user link "$UNIT_FILE" >/dev/null
systemctl --user daemon-reload
systemctl --user enable --now saltmarcher-looper.service
systemctl --user status saltmarcher-looper.service --no-pager

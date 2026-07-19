#!/usr/bin/env bash
set -euo pipefail
umask 077

REPO_URL="${SALTMARCHER_REPO_URL:-https://github.com/ThonkTank/Salt-Marcher.git}"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/saltmarcher"
CLONE_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/saltmarcher-repo"
APP_DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/salt-marcher"
STATUS_FILE="$STATE_DIR/status.json"
LOG_DIR="$STATE_DIR/logs"
BACKUP_DIR="$STATE_DIR/backups"
LOCK_FILE="$STATE_DIR/update.lock"

mkdir -p "$STATE_DIR" "$LOG_DIR" "$BACKUP_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

log_file="$LOG_DIR/update-$(date -u +%Y%m%dT%H%M%SZ).log"
exec > >(tee -a "$log_file") 2>&1

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || {
        echo "Owner action required: install $1"
        exit 1
    }
}

require_cmd java
command -v systemctl >/dev/null 2>&1 && systemctl --user status >/dev/null 2>&1 || {
    echo "Owner action required: systemd --user is required."
    exit 1
}

timeout 10s git ls-remote "$REPO_URL" >/dev/null 2>&1 || exit 0

if [[ ! -d "$CLONE_DIR/.git" ]]; then
    git clone "$REPO_URL" "$CLONE_DIR"
fi

cd "$CLONE_DIR"
if [[ -n "$(git status --porcelain)" ]]; then
    echo "Refusing to update clone with uncommitted changes."
    exit 1
fi

git fetch --tags origin
newest_tag="$(git tag --list 'v*' --sort=-v:refname | head -n1)"
if [[ -z "$newest_tag" ]]; then
    echo "No stable tag found."
    exit 0
fi

installed_tag=""
if [[ -f "$STATUS_FILE" ]]; then
    installed_tag="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("installed_tag",""))' "$STATUS_FILE" 2>/dev/null || true)"
fi
if [[ "$newest_tag" == "$installed_tag" ]]; then
    python3 - "$STATUS_FILE" "$newest_tag" <<'PY'
import json, sys, time
path, tag = sys.argv[1], sys.argv[2]
state = json.load(open(path)) if __import__("os").path.exists(path) else {}
state.update({"installed_tag": tag, "last_checked": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "last_result": "ok"})
json.dump(state, open(path, "w"), indent=2)
PY
    exit 0
fi

previous_revision="$(git rev-parse --verify HEAD)"
backup=""

block_update() {
    local result="$1"
    git checkout "$previous_revision" || true
    python3 - "$STATUS_FILE" "$newest_tag" "$backup" "$result" <<'PY'
import json, sys, time
path, tag, backup, result = sys.argv[1:5]
state = json.load(open(path)) if __import__("os").path.exists(path) else {}
state.update({"blocked_tag": tag, "last_result": result, "last_backup": backup, "last_update": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
json.dump(state, open(path, "w"), indent=2)
PY
    command -v notify-send >/dev/null 2>&1 && notify-send "SaltMarcher Update fehlgeschlagen" "$newest_tag blockiert" || true
    exit 1
}

git checkout "$newest_tag"
if ! ./gradlew check --console=plain; then
    block_update "qualification_failed"
fi

tmp_root="$(mktemp -d)"
trap 'rm -rf "$tmp_root"' EXIT
if [[ -f "$APP_DATA_DIR/game.db" ]]; then
    snapshot_dir="$tmp_root/snapshot/salt-marcher"
    rehearsal_copy="$tmp_root/rehearsal/game.db"
    mkdir -p "$snapshot_dir" "$(dirname "$rehearsal_copy")"
    backup="$BACKUP_DIR/data-${newest_tag}-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
    if ! tools/gradle/run-observable-gradle.sh snapshotCatalogData -- \
        "-PcatalogSnapshotSource=$APP_DATA_DIR/game.db" \
        "-PcatalogSnapshotTarget=$snapshot_dir/game.db"; then
        block_update "snapshot_failed"
    fi
    tar -czf "$backup" -C "$tmp_root/snapshot" salt-marcher
    chmod 600 "$backup"
    tar -tzf "$backup" >/dev/null
    cp "$snapshot_dir/game.db" "$rehearsal_copy"
    if ! tools/gradle/run-observable-gradle.sh rehearseCatalogData -- \
        "-PcatalogRehearsalDatabase=$rehearsal_copy"; then
        block_update "rehearsal_failed"
    fi
    find "$BACKUP_DIR" -name 'data-*.tar.gz' -type f | sort | head -n -5 | xargs -r rm -f
fi

if ! ./gradlew installDesktopApp --console=plain; then
    block_update "install_failed"
fi

python3 - "$STATUS_FILE" "$newest_tag" "$backup" <<'PY'
import json, sys, time
path, tag, backup = sys.argv[1:4]
state = json.load(open(path)) if __import__("os").path.exists(path) else {}
state.update({"installed_tag": tag, "last_result": "ok", "last_backup": backup, "last_update": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
json.dump(state, open(path, "w"), indent=2)
PY
command -v notify-send >/dev/null 2>&1 && notify-send "SaltMarcher aktualisiert auf $newest_tag" || true

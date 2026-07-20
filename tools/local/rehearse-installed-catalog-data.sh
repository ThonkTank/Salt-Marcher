#!/usr/bin/env bash
set -euo pipefail
umask 077

app_data_dir="${XDG_DATA_HOME:-$HOME/.local/share}/salt-marcher"
state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/saltmarcher"
backup_dir="$state_dir/backups"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup="$backup_dir/catalog-greenfield-$timestamp.tar.gz"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ ! -f "$app_data_dir/game.db" ]]; then
    echo "Installed SaltMarcher database not found."
    exit 1
fi

mkdir -p "$backup_dir"
restore_root="$(mktemp -d)"
trap 'rm -rf "$restore_root"' EXIT
snapshot_dir="$restore_root/snapshot/salt-marcher"
rehearsal_dir="$restore_root/rehearsal"
rehearsal_copy="$rehearsal_dir/salt-marcher/game.db"
mkdir -p "$snapshot_dir" "$rehearsal_dir"

cd "$repo_root"
./gradlew snapshotCatalogData --console=plain \
    "-PcatalogSnapshotSource=$app_data_dir/game.db" \
    "-PcatalogSnapshotTarget=$snapshot_dir/game.db"
tar -czf "$backup" -C "$restore_root/snapshot" salt-marcher
chmod 600 "$backup"
tar -tzf "$backup" >/dev/null
tar -xzf "$backup" -C "$rehearsal_dir"

./gradlew rehearseCatalogData --console=plain \
    "-PcatalogRehearsalDatabase=$rehearsal_copy"
echo "Restore-tested backup retained at: $backup"

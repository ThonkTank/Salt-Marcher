#!/usr/bin/env bash
set -euo pipefail

project=$(cd "$(dirname "$0")/.." && pwd)
exec 9>"${XDG_RUNTIME_DIR:?}/dungeon-editor-test.lock"
if ! flock -n 9; then
  echo "Eine Obsidian-QA-Instanz ist bereits aktiv; Schnelltest nicht gestartet." >&2
  exit 75
fi

exec timeout --signal=TERM --kill-after=8s 90s \
  node "$project/tools/fast-selection-host.cjs" "$@"

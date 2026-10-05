#!/usr/bin/env bash
set -euo pipefail

project=$(cd "$(dirname "$0")/.." && pwd)
export DUNGEON_QA_ROOT=${DUNGEON_QA_ROOT:-/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/groups/material-pfad-dialog}
export DUNGEON_QA_PORT=${DUNGEON_QA_PORT:-9248}
export DUNGEON_PLUGIN_ROOT=${DUNGEON_PLUGIN_ROOT:-$project}
cd "$project"
exec 9>"${XDG_RUNTIME_DIR:?}/dungeon-editor-test.lock"
flock -n 9
npm run build
timeout --signal=TERM --kill-after=12s 240s node "$project/tools/host-test.cjs" --native-path-dialog
if [[ -f "$DUNGEON_QA_ROOT/material-pfad-dialog-saved.json" ]]; then
  timeout --signal=TERM --kill-after=12s 240s node "$project/tools/host-test.cjs" --native-path-dialog --restart
fi

#!/usr/bin/env bash
set -euo pipefail

group_id=${1:?Group id required}
project=$(cd "$(dirname "$0")/.." && pwd)
export DUNGEON_QA_ROOT=${DUNGEON_QA_ROOT:-/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/groups/$group_id}
export DUNGEON_QA_PORT=${DUNGEON_QA_PORT:-9248}
export DUNGEON_PLUGIN_ROOT=${DUNGEON_PLUGIN_ROOT:-$project}
cd "$project"
exec 9>"${XDG_RUNTIME_DIR:?}/dungeon-editor-test.lock"
flock -n 9
npm run build
timeout --signal=TERM --kill-after=12s 240s node "$project/tools/host-test.cjs" --group "$group_id"
timeout --signal=TERM --kill-after=12s 240s node "$project/tools/host-test.cjs" --group "$group_id" --restart

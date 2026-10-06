#!/usr/bin/env bash
set -euo pipefail
exec 9>"${XDG_RUNTIME_DIR:?}/dungeon-editor-test.lock"
flock -n 9
project=$(cd "$(dirname "$0")/.." && pwd)
node "$project/tools/gui-memory-guard.cjs" check
exec timeout --signal=TERM --kill-after=12s 240s node "$project/tools/host-test.cjs" "$@"

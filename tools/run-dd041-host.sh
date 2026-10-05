#!/usr/bin/env bash
set -euo pipefail

project=$(cd "$(dirname "$0")/.." && pwd)
export DUNGEON_QA_ROOT=${DUNGEON_QA_ROOT:-/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd041-host}
export DUNGEON_QA_PORT=${DUNGEON_QA_PORT:-9241}
export DUNGEON_PLUGIN_ROOT=${DUNGEON_PLUGIN_ROOT:-/home/aaron/.cache/dungeon-native-qa/implementation-20261005/main}
exec bash "$project/tools/run-host.sh" --dd041-navigation "$@"

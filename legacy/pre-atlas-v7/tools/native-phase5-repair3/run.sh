#!/usr/bin/env bash
set -euo pipefail

# Zenity's portal backend otherwise inherits the user's DISPLAY=:0 instead of
# the isolated Xvnc display. An unreachable session bus keeps the file chooser
# local to the QA display, where the original Open action can be exercised.
export DBUS_SESSION_BUS_ADDRESS=unix:path=/home/aaron/.cache/dungeon-native-qa/qa-bus-unavailable
export GTK_USE_PORTAL=0
export XDG_CURRENT_DESKTOP=Generic
export XDG_SESSION_DESKTOP=generic
export DUNGEON_PHASE5_REPAIR2_QA_ROOT=${DUNGEON_PHASE5_REPAIR2_QA_ROOT:-/home/aaron/.cache/dungeon-native-qa/parity-phase5-repair3/native}
exec "$(dirname "$0")/../native-phase5-repair2/run.sh"

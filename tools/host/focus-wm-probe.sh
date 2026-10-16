#!/usr/bin/env bash
set -euo pipefail

# Run once for the edit case, then again with --restart against the same QA root.
# Override DUNGEON_XVNC and DUNGEON_QA_ROOT for another machine.

repo=$(cd "$(dirname "$0")/../.." && pwd)
qa=${DUNGEON_QA_ROOT:-/home/aaron/.cache/dungeon-native-qa/parity-phase6-repair3-host}
xvnc=${DUNGEON_XVNC:-/home/aaron/.cache/dungeon-native-qa/xvnc/usr/bin/Xvnc}
mkdir -p "$qa"
exec 9>"${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/dungeon-editor-test.lock"
flock -n 9 || { echo 'Grafikslot belegt' >&2; exit 75; }
test -x "$xvnc"
for number in $(seq 12 29); do
  if [ ! -e "/tmp/.X11-unix/X$number" ] &&
    ! ss -ltn "sport = :$((5900 + number))" | grep -q LISTEN; then
    display=:$number
    rfb_port=$((5900 + number))
    break
  fi
done
test -n "${display:-}" || exit 75
"$xvnc" "$display" -geometry 1600x960 -depth 24 -SecurityTypes None \
  -localhost yes -rfbport "$rfb_port" -ac > "$qa/xvnc.log" 2>&1 &
xvnc_pid=$!
kwin_pid=''
cleanup() {
  if [ -n "$kwin_pid" ]; then
    kill -TERM "$kwin_pid" 2>/dev/null || true
    wait "$kwin_pid" 2>/dev/null || true
  fi
  kill -TERM "$xvnc_pid" 2>/dev/null || true
  wait "$xvnc_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
for _ in $(seq 1 100); do
  ss -ltn "sport = :$rfb_port" | grep -q LISTEN && break
  kill -0 "$xvnc_pid"
  sleep 0.1
done
DISPLAY="$display" kwin_x11 --replace > "$qa/kwin.log" 2>&1 &
kwin_pid=$!
DISPLAY="$display" python3 - <<'PY'
import ctypes
import os
import time

lib = ctypes.CDLL("libX11.so.6")
lib.XOpenDisplay.restype = ctypes.c_void_p
lib.XOpenDisplay.argtypes = [ctypes.c_char_p]
for name in ("XAutoRepeatOff", "XFlush", "XCloseDisplay"):
    getattr(lib, name).argtypes = [ctypes.c_void_p]
display = lib.XOpenDisplay(os.environ["DISPLAY"].encode())
assert display
lib.XAutoRepeatOff(display)
lib.XFlush(display)
lib.XCloseDisplay(display)
time.sleep(1)
PY
cd "$repo"
DUNGEON_QA_DISPLAY="$display" DUNGEON_QA_ROOT="$qa" \
  node tools/host-test.cjs --parity-phase6-repair2-focus --focus-wm-probe "$@"

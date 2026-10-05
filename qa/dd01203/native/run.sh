#!/usr/bin/env bash
set -euo pipefail

# Run only after the coordinator assigns the exclusive Dungeondraft GUI slot.
SOURCE_APP=${DUNGEONDRAFT_1201_ROOT:-/home/aaron/Downloads/Dungeondraft-1.2.0.1-Linux64}
SOURCE_MAP=/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/groups/bau-01/native/runs/20261005-121641-2888505/evidence/maps/D03-ellipse-after.dungeondraft_map
XVNC=/home/aaron/.cache/dungeon-native-qa/xvnc/usr/bin/Xvnc
QA=${DUNGEON_DD01203_NATIVE_QA:-/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd01203-native}
RUN="$QA/runs/$(date +%Y%m%d-%H%M%S)-$$"
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
RUNTIME_ROOT=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}

mkdir -p "$RUN"/{app,data/Dungeondraft,config,cache,map,evidence/screens,evidence/maps}
exec 9>"$RUNTIME_ROOT/dungeon-editor-test.lock"
flock -n 9 || { echo 'Grafikslot belegt' >&2; exit 75; }
if pgrep -af '[D]ungeondraft\.x86_64|[X]vnc .*-[r]fbport|[Oo]bsidian.*dungeon-native-qa|dungeon-native-qa.*[Oo]bsidian' > "$RUN/preflight-processes.txt"; then
  echo 'Grafikslot trotz freier Sperre nicht leer' >&2
  exit 75
fi
for candidate in $(seq 12 29); do
  if [ ! -e "/tmp/.X11-unix/X$candidate" ] && ! ss -ltn "sport = :$((5900 + candidate))" | grep -q LISTEN; then
    DISPLAY_NAME=:$candidate
    RFB_PORT=$((5900 + candidate))
    break
  fi
done
test -n "${DISPLAY_NAME:-}" || { echo 'Kein freies Display' >&2; exit 75; }
printf 'display=%s\nrfb_port=%s\n' "$DISPLAY_NAME" "$RFB_PORT" > "$RUN/session.txt"

cp --reflink=auto "$SOURCE_APP/Dungeondraft.x86_64" "$RUN/app/"
cp --reflink=auto "$SOURCE_APP/Dungeondraft.pck" "$RUN/app/"
cp -a "$SOURCE_APP/data_Dungeondraft" "$RUN/app/"
cp -a "$SOURCE_APP/translations" "$RUN/app/"
cp --reflink=auto "$SOURCE_MAP" "$RUN/map/bau-01-working.dungeondraft_map"
sha256sum "$SOURCE_APP/Dungeondraft.x86_64" "$SOURCE_APP/Dungeondraft.pck" "$SOURCE_MAP" > "$RUN/source.sha256"
test "$(sha256sum "$SOURCE_MAP" | cut -d' ' -f1)" = dc3fd5e8cb3c385be85faf3d65ae493b56d0b2717cd55f8b4210c52ff89841ed
chmod u+x "$RUN/app/Dungeondraft.x86_64"
cat > "$RUN/data/Dungeondraft/config.ini" <<'INI'
[Display]
current_screen=0
window_width=1280
window_height=720
window_maximized=false
window_position_x=0
window_position_y=0

[Assets]
active_asset_packs=[  ]
disable_default_assets=false

[Mods]
active_mods=[  ]
INI

xvnc_pid=''
dd_pid=''
cleanup() {
  local status=$?
  if [ -n "$dd_pid" ] && kill -0 "$dd_pid" 2>/dev/null; then
    kill -TERM "$dd_pid" 2>/dev/null || true
    for _ in $(seq 1 30); do kill -0 "$dd_pid" 2>/dev/null || break; sleep 0.1; done
    kill -KILL "$dd_pid" 2>/dev/null || true
    wait "$dd_pid" 2>/dev/null || true
  fi
  if [ -n "$xvnc_pid" ] && kill -0 "$xvnc_pid" 2>/dev/null; then
    kill -TERM "$xvnc_pid" 2>/dev/null || true
    wait "$xvnc_pid" 2>/dev/null || true
  fi
  printf 'exit_status=%s\n' "$status" >> "$RUN/session.txt"
  exit "$status"
}
trap cleanup EXIT INT TERM
"$XVNC" "$DISPLAY_NAME" -geometry 1280x960 -depth 24 -SecurityTypes None -localhost yes -rfbport "$RFB_PORT" -ac > "$RUN/xvnc.log" 2>&1 &
xvnc_pid=$!
for _ in $(seq 1 100); do
  ss -ltn "sport = :$RFB_PORT" | grep -q LISTEN && break
  kill -0 "$xvnc_pid"
  sleep 0.1
done
ss -ltn "sport = :$RFB_PORT" | grep -q LISTEN

start_dd() {
  local phase=$1
  (
    cd "$RUN/app"
    export DISPLAY="$DISPLAY_NAME" XDG_CONFIG_HOME="$RUN/config" XDG_DATA_HOME="$RUN/data" XDG_CACHE_HOME="$RUN/cache" LIBGL_ALWAYS_SOFTWARE=1
    exec stdbuf -oL ./Dungeondraft.x86_64 "$RUN/map/bau-01-working.dungeondraft_map"
  ) > "$RUN/dungeondraft-$phase.log" 2>&1 &
  dd_pid=$!
  for _ in $(seq 1 300); do
    grep -q 'Dungeondraft' "$RUN/dungeondraft-$phase.log" 2>/dev/null && break
    kill -0 "$dd_pid" || { echo 'Dungeondraft beendet' >&2; return 1; }
    sleep 0.1
  done
  sleep 3
}
stop_dd() {
  kill -TERM "$dd_pid" 2>/dev/null || true
  for _ in $(seq 1 30); do kill -0 "$dd_pid" 2>/dev/null || break; sleep 0.1; done
  kill -KILL "$dd_pid" 2>/dev/null || true
  wait "$dd_pid" 2>/dev/null || true
  dd_pid=''
}

start_dd edit
python "$SCRIPT_DIR/driver.py" edit "$RUN"
stop_dd
start_dd reopen
python "$SCRIPT_DIR/driver.py" reopen "$RUN"
printf '%s\n' "$RUN"

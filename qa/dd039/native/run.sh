#!/bin/bash
set -euo pipefail

PACKAGE=/home/aaron/.cache/dungeon-native-qa/implementation-20261005/bau/qa/dd039/native
SOURCE_APP=/home/aaron/Downloads/Dungeondraft-1.2.0.1-Linux64
SOURCE_MAP=/home/aaron/.cache/dungeon-native-qa/audit-20261004/karten-verwaltung/dd001-native-20261004-162255/evidence/dd001-created.dungeondraft_map
XVNC=/home/aaron/.cache/dungeon-native-qa/xvnc/usr/bin/Xvnc
RUNTIME_ROOT=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}
RUN_ID=$(date +%Y%m%d-%H%M%S)-$$
RUN="$PACKAGE/runs/$RUN_ID"
mkdir -p "$RUN"/{app/mods,data/Dungeondraft,config,cache,map,evidence}

exec 9>"$RUNTIME_ROOT/dungeon-editor-test.lock"
flock -n 9 || { echo 'Grafikslot belegt' >&2; exit 75; }
if pgrep -af '[D]ungeondraft\.x86_64|[X]vnc .*-[r]fbport|[Oo]bsidian.*dungeon-native-qa|dungeon-native-qa.*[Oo]bsidian' >"$RUN/preflight-processes.txt"; then
  echo "Grafikslot trotz freier Sperre nicht leer: $RUN/preflight-processes.txt" >&2
  exit 75
fi

display_number=""
for candidate in $(seq 12 29); do
  if [ ! -e "/tmp/.X11-unix/X$candidate" ] &&
     ! ss -ltn "sport = :$((5900 + candidate))" | grep -q LISTEN; then
    display_number=$candidate
    break
  fi
done
[ -n "$display_number" ] || { echo 'Kein freies Testdisplay' >&2; exit 75; }
DISPLAY_NAME=:$display_number
RFB_PORT=$((5900 + display_number))

cp --reflink=auto "$SOURCE_APP/Dungeondraft.x86_64" "$RUN/app/Dungeondraft.x86_64"
cp --reflink=auto "$SOURCE_APP/Dungeondraft.pck" "$RUN/app/Dungeondraft.pck"
cp -a "$SOURCE_APP/data_Dungeondraft" "$RUN/app/data_Dungeondraft"
cp -a "$SOURCE_APP/translations" "$RUN/app/translations"
if [ "$#" -gt 0 ]; then
  cp --reflink=auto "$1" "$RUN/map/map-info-working.dungeondraft_map"
else
  cp --reflink=auto "$SOURCE_MAP" "$RUN/map/map-info-working.dungeondraft_map"
fi
chmod u+x "$RUN/app/Dungeondraft.x86_64"
sha256sum "$RUN/app/Dungeondraft.x86_64" "$RUN/app/Dungeondraft.pck" "$RUN/map/map-info-working.dungeondraft_map" > "$RUN/start.sha256"
cat > "$RUN/data/Dungeondraft/config.ini" <<'CONFIG'
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
CONFIG

xvnc_pid=""
dd_pid=""
cleanup() {
  status=$?
  if [ -n "$dd_pid" ] && kill -0 "$dd_pid" 2>/dev/null; then
    kill -TERM "$dd_pid" 2>/dev/null || true
    for _ in $(seq 1 30); do
      kill -0 "$dd_pid" 2>/dev/null || break
      sleep 0.1
    done
    kill -KILL "$dd_pid" 2>/dev/null || true
  fi
  if [ -n "$xvnc_pid" ] && kill -0 "$xvnc_pid" 2>/dev/null; then
    kill -TERM "$xvnc_pid" 2>/dev/null || true
    wait "$xvnc_pid" 2>/dev/null || true
  fi
  printf 'display=%s\nrfb_port=%s\nexit_status=%s\n' "$DISPLAY_NAME" "$RFB_PORT" "$status" > "$RUN/cleanup.txt"
  exit "$status"
}
trap cleanup EXIT INT TERM

"$XVNC" "$DISPLAY_NAME" -geometry 1280x960 -depth 24 -SecurityTypes None -localhost yes -rfbport "$RFB_PORT" -ac >"$RUN/xvnc.log" 2>&1 &
xvnc_pid=$!
for _ in $(seq 1 100); do
  ss -ltn "sport = :$RFB_PORT" | grep -q LISTEN && break
  kill -0 "$xvnc_pid"
  sleep 0.1
done

(
  cd "$RUN/app"
  export DISPLAY=$DISPLAY_NAME
  export XDG_CONFIG_HOME="$RUN/config"
  export XDG_DATA_HOME="$RUN/data"
  export XDG_CACHE_HOME="$RUN/cache"
  export LIBGL_ALWAYS_SOFTWARE=1
  exec stdbuf -oL ./Dungeondraft.x86_64 "$RUN/map/map-info-working.dungeondraft_map"
) >"$RUN/dungeondraft.log" 2>&1 &
dd_pid=$!
printf '%s\n' "$RUN" > "$PACKAGE/latest-run.txt"
printf 'RUN=%s\nDISPLAY=%s\nDD_PID=%s\nSTOP=%s\n' "$RUN" "$DISPLAY_NAME" "$dd_pid" "$RUN/stop"
while [ ! -e "$RUN/stop" ] && kill -0 "$dd_pid" 2>/dev/null; do sleep 0.5; done

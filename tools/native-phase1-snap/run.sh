#!/usr/bin/env bash
set -euo pipefail

qa_root=${DUNGEON_PHASE1_NATIVE_QA_ROOT:-/home/aaron/.cache/dungeon-native-qa/parity-phase1-snap-20261007}
source_app=/home/aaron/Downloads/Dungeondraft-1.2.0.1-Linux64
source_map=${DUNGEON_PHASE1_NATIVE_SOURCE_MAP:-/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/groups/bau-01/native/runs/20261005-120725-2872601/evidence/maps/C00-empty.dungeondraft_map}
xvnc=/home/aaron/.cache/dungeon-native-qa/xvnc/usr/bin/Xvnc
run="$qa_root/runs/$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$run"/{config,data/Dungeondraft,cache,map,evidence/screens,evidence/maps}
exec 9>"${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/dungeon-editor-test.lock"
flock -n 9 || { echo 'Grafikslot belegt' >&2; exit 75; }
if ps -eo pid=,comm=,args= | awk '$2 ~ /^Dungeondraft/ || $2 == "Xvnc" || ($2 == "obsidian" && $0 ~ /dungeon-native-qa/) { print; found=1 } END { exit !found }' > "$run/preflight-processes.txt"; then
  echo 'Grafikprozess läuft bereits' >&2
  exit 75
fi
for number in $(seq 12 29); do
  if [ ! -e "/tmp/.X11-unix/X$number" ] && ! ss -ltn "sport = :$((5900+number))" | rg -q LISTEN; then
    display=:$number
    rfb_port=$((5900+number))
    break
  fi
done
test -n "${display:-}" || exit 75
cp --reflink=auto "$source_map" "$run/map/phase1-snap.dungeondraft_map"
sha256sum "$source_app/Dungeondraft.x86_64" "$source_app/Dungeondraft.pck" "$source_map" > "$run/source.sha256"
if [ -n "${DUNGEON_PHASE1_NATIVE_REUSE_DATA:-}" ]; then
  cp -a "$DUNGEON_PHASE1_NATIVE_REUSE_DATA/." "$run/data/Dungeondraft/"
else
cat > "$run/data/Dungeondraft/config.ini" <<INI
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
fi
dd_pid=''
xvnc_pid=''
cleanup() {
  local status=$?
  if [ -n "$dd_pid" ] && kill -0 "$dd_pid" 2>/dev/null; then
    kill -TERM "$dd_pid" 2>/dev/null || true
    wait "$dd_pid" 2>/dev/null || true
  fi
  if [ -n "$xvnc_pid" ] && kill -0 "$xvnc_pid" 2>/dev/null; then
    kill -TERM "$xvnc_pid" 2>/dev/null || true
    wait "$xvnc_pid" 2>/dev/null || true
  fi
  printf 'exit_status=%s\n' "$status" >> "$run/session.txt"
}
trap cleanup EXIT INT TERM
"$xvnc" "$display" -geometry 1280x960 -depth 24 -SecurityTypes None -localhost yes -rfbport "$rfb_port" -ac > "$run/xvnc.log" 2>&1 &
xvnc_pid=$!
for _ in $(seq 1 100); do
  ss -ltn "sport = :$rfb_port" | rg -q LISTEN && break
  kill -0 "$xvnc_pid"
  sleep 0.1
done
(
  cd "$source_app"
  export DISPLAY="$display" XDG_CONFIG_HOME="$run/config" XDG_DATA_HOME="$run/data" XDG_CACHE_HOME="$run/cache" LIBGL_ALWAYS_SOFTWARE=1
  exec stdbuf -oL ./Dungeondraft.x86_64 "$run/map/phase1-snap.dungeondraft_map"
) > "$run/dungeondraft.log" 2>&1 &
dd_pid=$!
printf 'run=%s\ndisplay=%s\nrfb_port=%s\ndd_pid=%s\nxvnc_pid=%s\n' "$run" "$display" "$rfb_port" "$dd_pid" "$xvnc_pid" > "$run/session.txt"
echo "$run"
while [ ! -e "$run/stop" ] && kill -0 "$dd_pid" 2>/dev/null; do sleep 0.5; done
if [ ! -e "$run/stop" ]; then
  wait "$dd_pid"
  echo 'Dungeondraft exited before the probe finished' >&2
  exit 1
fi

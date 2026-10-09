#!/usr/bin/env bash
set -euo pipefail

qa_root=${DUNGEON_DD008_QA_ROOT:-/home/aaron/.cache/dungeon-native-qa/parity-tools-phase1-dd008-20261009}
source_app=/home/aaron/Downloads/Dungeondraft-1.2.0.1-Linux64
source_map='/home/aaron/Schreibtisch/Obsidian/DnD OT/.obsidian/plugins/dungeon-auswertung/reference/own-building-wear-scratched.dungeondraft_map'
wall_pack='/home/aaron/.cache/codex-dungeondraft-pack-qa/output/QA Wall Pack.dungeondraft_pack'
floor_pack='/home/aaron/.cache/codex-dungeondraft-pack-qa/output/QA Wizard Floor.dungeondraft_pack'
xvnc=/home/aaron/.cache/dungeon-native-qa/xvnc/usr/bin/Xvnc
window_width=1280
window_height=960
[[ "$window_width" =~ ^[0-9]+$ && "$window_height" =~ ^[0-9]+$ ]] || exit 2
run="$qa_root/runs/$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$run"/{config,data/Dungeondraft,cache,map,assets,evidence/screens,evidence/maps}
exec 9>"${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/dungeon-editor-test.lock"
flock -n 9 || { echo 'Grafikslot belegt' >&2; exit 75; }
if ps -eo pid=,comm=,args= | awk '$2 ~ /^Dungeondraft/ || $2 == "Xvnc" || ($2 == "obsidian" && $0 ~ /dungeon-native-qa/) { print; found=1 } END { exit !found }' > "$run/preflight-processes.txt"; then
  echo 'Grafikprozess läuft bereits' >&2
  exit 75
fi
for number in $(seq 12 29); do
  if [ ! -e "/tmp/.X11-unix/X$number" ] && ! ss -ltn "sport = :$((5900+number))" | grep -q LISTEN; then
    display=:$number
    rfb_port=$((5900+number))
    break
  fi
done
test -n "${display:-}" || exit 75
cp --reflink=auto "$source_map" "$run/map/wear.dungeondraft_map"
cp --reflink=auto "$wall_pack" "$run/assets/QA Wall Pack.dungeondraft_pack"
cp --reflink=auto "$floor_pack" "$run/assets/QA Wizard Floor.dungeondraft_pack"
sha256sum "$source_app/Dungeondraft.x86_64" "$source_app/Dungeondraft.pck" "$source_map" "$wall_pack" "$floor_pack" > "$run/source.sha256"
cat > "$run/data/Dungeondraft/config.ini" <<INI
[Display]
current_screen=0
window_width=$window_width
window_height=$window_height
window_maximized=false
window_position_x=0
window_position_y=0

[Assets]
active_asset_packs=[ "QAWall01", "QATile01" ]
custom_assets_directory="$run/assets"
disable_default_assets=false

[Mods]
active_mods=[  ]
INI
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
"$xvnc" "$display" -geometry "${window_width}x${window_height}" -depth 24 -SecurityTypes None -localhost yes -rfbport "$rfb_port" -ac > "$run/xvnc.log" 2>&1 &
xvnc_pid=$!
for _ in $(seq 1 100); do
  ss -ltn "sport = :$rfb_port" | grep -q LISTEN && break
  kill -0 "$xvnc_pid"
  sleep 0.1
done
(
  cd "$source_app"
  export DISPLAY="$display" XDG_CONFIG_HOME="$run/config" XDG_DATA_HOME="$run/data" XDG_CACHE_HOME="$run/cache" LIBGL_ALWAYS_SOFTWARE=1
  exec stdbuf -oL ./Dungeondraft.x86_64 "$run/map/wear.dungeondraft_map"
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

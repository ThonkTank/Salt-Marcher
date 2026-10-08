#!/usr/bin/env bash
set -euo pipefail

qa_run=${WONDERDRAFT_QA_RUN:?Set WONDERDRAFT_QA_RUN to an isolated QA directory}
source_app=${WONDERDRAFT_SOURCE_APP:-/home/aaron/Downloads/Wonderdraft-1.1.8.2-b-Linux64}
xvnc=/home/aaron/.cache/dungeon-native-qa/xvnc/usr/bin/Xvnc
run="$qa_run/original-$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$run"/{config,data/Wonderdraft/maps,data/Wonderdraft/brushes,cache,assets,evidence/screens}
cat > "$run/data/Wonderdraft/config.ini" <<'INI'
[Display]
fullscreen=false
window_width=1600
window_height=900
window_maximized=false
window_position_x=0
window_position_y=0

[Save]
recently_opened=[  ]
INI
exec 9>"${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/dungeon-editor-test.lock"
flock -n 9 || { echo 'Grafikslot belegt' >&2; exit 75; }
if pgrep -af 'Wonderdraft.x86_64|Dungeondraft.x86_64|Xvnc|/app/obsidian.*dungeon-native-qa' > "$run/preflight-processes.txt"; then
  echo 'Eine grafische QA-Instanz läuft bereits' >&2
  exit 75
fi
if [ -n "${WONDERDRAFT_DISPLAY:-}" ]; then
  display=$WONDERDRAFT_DISPLAY
  xauthority=${WONDERDRAFT_XAUTHORITY:?Set WONDERDRAFT_XAUTHORITY for the selected display}
  DISPLAY="$display" XAUTHORITY="$xauthority" xdotool getdisplaygeometry > "$run/display-geometry.txt"
  rfb_port=none
else
  for number in $(seq 12 29); do
    if [ ! -e "/tmp/.X11-unix/X$number" ] && ! ss -ltn "sport = :$((5900 + number))" | grep -q LISTEN; then
      display=:$number
      rfb_port=$((5900 + number))
      break
    fi
  done
  test -n "${display:-}" || exit 75
fi
sha256sum "$source_app/Wonderdraft.x86_64" "$source_app/Wonderdraft.pck" > "$run/reference.sha256"
app_pid=''
xvnc_pid=''
cleanup() {
  status=$?
  trap - EXIT INT TERM
  if [ -n "$app_pid" ] && kill -0 "$app_pid" 2>/dev/null; then
    kill -TERM "$app_pid" 2>/dev/null || true
    wait "$app_pid" 2>/dev/null || true
  fi
  if [ -n "$xvnc_pid" ] && kill -0 "$xvnc_pid" 2>/dev/null; then
    kill -TERM "$xvnc_pid" 2>/dev/null || true
    wait "$xvnc_pid" 2>/dev/null || true
  fi
  printf 'exit_status=%s\n' "$status" >> "$run/session.txt"
  exit "$status"
}
trap cleanup EXIT INT TERM
if [ "$rfb_port" != none ]; then
  "$xvnc" "$display" -geometry 1600x960 -depth 24 -SecurityTypes None -localhost yes -rfbport "$rfb_port" -ac > "$run/xvnc.log" 2>&1 &
  xvnc_pid=$!
  for _ in $(seq 1 100); do
    ss -ltn "sport = :$rfb_port" | grep -q LISTEN && break
    kill -0 "$xvnc_pid"
    sleep 0.1
  done
fi
(
  cd "$source_app"
  export DISPLAY="$display" XDG_CONFIG_HOME="$run/config" XDG_DATA_HOME="$run/data" XDG_CACHE_HOME="$run/cache" LIBGL_ALWAYS_SOFTWARE=1
  export LANG=en_US.utf8 LC_ALL=en_US.utf8 XMODIFIERS=@im=none
  if [ -n "${xauthority:-}" ]; then export XAUTHORITY="$xauthority"; fi
  export DBUS_SESSION_BUS_ADDRESS=unix:path="$run/no-session-bus" GTK_USE_PORTAL=0
  exec stdbuf -oL ./Wonderdraft.x86_64
) > "$run/wonderdraft.log" 2>&1 &
app_pid=$!
printf 'run=%s\ndisplay=%s\nrfb_port=%s\napp_pid=%s\nxvnc_pid=%s\nstarted_at=%s\n' "$run" "$display" "$rfb_port" "$app_pid" "$xvnc_pid" "$(date --iso-8601=seconds)" > "$run/session.txt"
printf '%s\n' "$run" > "$qa_run/current-original-session"
echo "$run"
while [ ! -e "$run/stop" ] && kill -0 "$app_pid" 2>/dev/null; do sleep 0.5; done
if [ ! -e "$run/stop" ]; then
  wait "$app_pid"
  echo 'Wonderdraft wurde vor Ende der Probe beendet' >&2
  exit 1
fi

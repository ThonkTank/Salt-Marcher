#!/usr/bin/env bash
set -euo pipefail

# Start only during the explicitly granted exclusive graphics slot.
root=/home/aaron/.cache/dungeon-native-qa/implementation-20261005/bau/qa/dd001002/native-first-save
qa_case=${QA_CASE:-dd001}
[[ "$qa_case" =~ ^dd[0-9]{3}$ ]] || { echo 'Ungültige QA-Fallkennung' >&2; exit 2; }
source_app=/home/aaron/Downloads/Dungeondraft-1.2.0.1-Linux64
xvnc=/home/aaron/.cache/dungeon-native-qa/xvnc/usr/bin/Xvnc
runtime_root=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}
run="$root/$qa_case-native-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$run"/{app,bin,data/Dungeondraft,config,cache,evidence}
exec 9>"$runtime_root/dungeon-editor-test.lock"
flock -n 9 || { echo 'Grafikslot belegt' >&2; exit 75; }
if pgrep -af '[D]ungeondraft\.x86_64|[X]vnc .*-[r]fbport|[Oo]bsidian.*dungeon-native-qa|dungeon-native-qa.*[Oo]bsidian' >"$run/preflight-processes.txt"; then
  echo 'Grafikslot trotz freier Sperre nicht leer' >&2
  exit 75
fi
display_number=''
for candidate in $(seq 12 29); do
  if [[ ! -e "/tmp/.X11-unix/X$candidate" ]] && ! ss -ltn "sport = :$((5900+candidate))" | grep -q LISTEN; then
    display_number=$candidate
    break
  fi
done
[[ -n "$display_number" ]] || { echo 'Kein freies isoliertes Display' >&2; exit 75; }
display_name=:$display_number
rfb_port=$((5900+display_number))
cp --reflink=auto "$source_app/Dungeondraft.x86_64" "$run/app/"
cp --reflink=auto "$source_app/Dungeondraft.pck" "$run/app/"
cp -a "$source_app/data_Dungeondraft" "$run/app/"
cp -a "$source_app/translations" "$run/app/"
sha256sum "$run/app/Dungeondraft.x86_64" "$run/app/Dungeondraft.pck" >"$run/original.sha256"
chmod u+x "$run/app/Dungeondraft.x86_64"
# The isolated Linux QA display may not render the host file picker. This
# shim supplies only the destination path; Dungeondraft still handles Save.
cat >"$run/bin/zenity" <<EOF
#!/bin/sh
printf '%s\n' "\$*" >> '$run/zenity-calls.log'
printf '%s\n' '$run/evidence/$qa_case-created.dungeondraft_map'
EOF
chmod u+x "$run/bin/zenity"
cat >"$run/data/Dungeondraft/config.ini" <<'EOF'
[Display]
current_screen=0
window_width=1280
window_height=960
window_maximized=false
window_position_x=0
window_position_y=0

[Assets]
active_asset_packs=[  ]
disable_default_assets=false

[Mods]
active_mods=[  ]
EOF
if [[ -n "${DD001_NATIVE_REUSE_CONFIG:-}" ]]; then
  case "$DD001_NATIVE_REUSE_CONFIG" in
    "$root"/*) ;;
    *) echo 'Profilquelle außerhalb des Auditordners' >&2; exit 2 ;;
  esac
  [[ -f "$DD001_NATIVE_REUSE_CONFIG" ]] || { echo 'Profilquelle fehlt' >&2; exit 2; }
  cp "$DD001_NATIVE_REUSE_CONFIG" "$run/data/Dungeondraft/config.ini"
fi
printf 'run=%q\ndisplay=%q\nport=%q\n' "$run" "$display_name" "$rfb_port" >"$run/session.env"
xvnc_pid=''
dd_pid=''
cleanup() {
  status=$?
  if [[ -n "$dd_pid" ]] && kill -0 "$dd_pid" 2>/dev/null; then
    kill -TERM "$dd_pid" 2>/dev/null || true
    for _ in $(seq 1 30); do
      kill -0 "$dd_pid" 2>/dev/null || break
      sleep 0.1
    done
    kill -KILL "$dd_pid" 2>/dev/null || true
  fi
  if [[ -n "$xvnc_pid" ]] && kill -0 "$xvnc_pid" 2>/dev/null; then
    kill -TERM "$xvnc_pid" 2>/dev/null || true
    wait "$xvnc_pid" 2>/dev/null || true
  fi
  printf 'exit_status=%s\n' "$status" >"$run/cleanup.txt"
}
trap cleanup EXIT INT TERM
"$xvnc" "$display_name" -geometry 1280x960 -depth 24 -SecurityTypes None -localhost yes -rfbport "$rfb_port" -ac >"$run/xvnc.log" 2>&1 &
xvnc_pid=$!
for _ in $(seq 1 100); do
  ss -ltn "sport = :$rfb_port" | grep -q LISTEN && break
  kill -0 "$xvnc_pid"
  sleep 0.1
done
ss -ltn "sport = :$rfb_port" | grep -q LISTEN || { echo 'Xvnc wurde nicht bereit' >&2; exit 1; }
(
  cd "$run/app"
  export DISPLAY="$display_name"
  export XDG_CONFIG_HOME="$run/config"
  export XDG_DATA_HOME="$run/data"
  export XDG_CACHE_HOME="$run/cache"
  export LIBGL_ALWAYS_SOFTWARE=1
  export PATH="$run/bin:$PATH"
  if [[ -n "${DD001_NATIVE_OPEN:-}" ]]; then
    exec stdbuf -oL ./Dungeondraft.x86_64 "$DD001_NATIVE_OPEN"
  fi
  exec stdbuf -oL ./Dungeondraft.x86_64
) >"$run/dungeondraft.log" 2>&1 &
dd_pid=$!
echo "$run"
while [[ ! -e "$run/stop" ]]; do
  if ! kill -0 "$dd_pid" 2>/dev/null; then
    [[ -e "$run/normal-quit" ]] && exit 0
    echo 'Dungeondraft wurde beendet' >&2
    exit 1
  fi
  sleep 1
done

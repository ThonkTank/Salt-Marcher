#!/usr/bin/env bash

run_with_inhibit() {
  local who="$1"
  local why="$2"
  shift 2

  if command -v systemd-inhibit >/dev/null 2>&1; then
    systemd-inhibit \
      --what=sleep:handle-lid-switch \
      --who="$who" \
      --why="$why" \
      --mode=block \
      "$@"
  else
    echo "WARNING: systemd-inhibit not found - running without sleep prevention."
    "$@"
  fi
}

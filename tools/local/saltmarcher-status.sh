#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/saltmarcher"
STATUS_FILE="$STATE_DIR/status.json"

echo "SaltMarcher Status"
if [[ -f "$STATUS_FILE" ]]; then
    python3 - "$STATUS_FILE" <<'PY'
import json, sys
state = json.load(open(sys.argv[1]))
print(f"Installiert: {state.get('installed_tag', 'unbekannt')} (stable)  |  Letztes Update: {state.get('last_update', 'nie')}  {state.get('last_result', 'unbekannt')}")
print(f"Letztes Backup: {state.get('last_backup', 'keins')}")
print(f"Blockiert: {state.get('blocked_tag', '0')}")
PY
else
    echo "Installiert: unbekannt (noch kein status.json)"
fi

if command -v gh >/dev/null 2>&1; then
    open_acceptance="$(gh issue list --state open --label abnahme-offen --json number 2>/dev/null | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' || echo "?")"
    open_feedback="$(
        gh issue list --state open --label owner-feedback --json number,title 2>/dev/null \
            | python3 -c '
import json
import sys

print(sum(1 for item in json.load(sys.stdin) if item.get("title") != "SaltMarcher Statusbericht"))
' || echo "?"
    )"
    echo "Offene Abnahmen: $open_acceptance  |  Owner-Feedback: $open_feedback"
else
    echo "GitHub-Status: gh nicht verfuegbar"
fi

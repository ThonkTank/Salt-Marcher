#!/bin/bash
# Safe Auto-Continue Wrapper
#
# Interactive wrapper around auto-continue-claude.sh with safety confirmations.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

clear
cat << "EOF"
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║           Claude Code Auto-Continue (Safe Mode)              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
EOF

echo ""
echo "⚠️  WARNUNG: Auto-Continue kann viele API-Requests generieren!"
echo ""
echo "Das Skript wird:"
echo "  • Claude Code starten"
echo "  • Bei Inaktivität automatisch einen neuen Prompt senden"
echo "  • Rate-Limits automatisch erkennen und bis zum Reset pausieren"
echo "  • Laptop-Sleep verhindern während der Session"
echo "  • Dies wiederholen bis zum Abbruch oder Limit"
echo ""

# Check for expect
if ! command -v expect &> /dev/null; then
    echo "❌ Error: 'expect' ist nicht installiert."
    echo ""
    echo "Installation:"
    echo "  sudo dnf install expect"
    echo ""
    exit 1
fi

echo "──────────────────────────────────────────────────────────────"
echo ""

# Ask for continuation
read -p "Möchtest du fortfahren? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Abgebrochen."
    exit 0
fi

echo ""
echo "──────────────────────────────────────────────────────────────"
echo "Konfiguration:"
echo ""

# Ask for max iterations
echo "1. Maximale Auto-Continues"
echo "   (Empfohlen: 5 für erste Tests, -1 für unbegrenzt)"
read -p "   Anzahl [5]: " MAX_ITER
MAX_ITER=${MAX_ITER:-5}

# Ask for timeout
echo ""
echo "2. Inaktivitäts-Timeout (Sekunden)"
echo "   (Zeit ohne Output bevor neuer Prompt gesendet wird)"
read -p "   Sekunden [180]: " TIMEOUT
TIMEOUT=${TIMEOUT:-180}

# Ask for quota wait
echo ""
read -p "3. Automatisches Warten bei Rate-Limits? (Y/n): " -n 1 -r
echo ""
QUOTA_FLAG=""
if [[ $REPLY =~ ^[Nn]$ ]]; then
    QUOTA_FLAG="--no-quota-wait"
fi

# Ask for debug
echo ""
read -p "4. Debug-Modus aktivieren? (y/N): " -n 1 -r
echo ""
DEBUG_FLAG=""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    DEBUG_FLAG="--debug"
fi

echo ""
echo "──────────────────────────────────────────────────────────────"
echo "Zusammenfassung:"
echo "  • Max Iterations: $MAX_ITER"
echo "  • Timeout: ${TIMEOUT}s"
echo "  • Quota Wait: ${QUOTA_FLAG:-An (empfohlen)}"
echo "  • Sleep Prevention: An (systemd-inhibit)"
echo "  • Debug: ${DEBUG_FLAG:-Aus}"
echo "──────────────────────────────────────────────────────────────"
echo ""

read -p "Mit dieser Konfiguration starten? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Abgebrochen."
    exit 0
fi

echo ""
echo "Starte Auto-Continue..."
echo "Drücke Ctrl+C zum Abbruch"
echo ""
sleep 2

# Build command
CMD="$SCRIPT_DIR/auto-continue-claude.sh --timeout $TIMEOUT --max-iterations $MAX_ITER $QUOTA_FLAG $DEBUG_FLAG"

# Execute
$CMD

echo ""
echo "Session beendet."

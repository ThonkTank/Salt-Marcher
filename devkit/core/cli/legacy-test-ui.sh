#!/bin/bash
# scripts/test-ui.sh
# Automated UI test workflow for Salt Marcher plugin
# Builds, reloads plugin, executes command, and extracts UI test logs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI_TOOL="$SCRIPT_DIR/obsidian-cli.mjs"
LOG_FILE="$PROJECT_ROOT/CONSOLE_LOG.txt"

echo -e "${YELLOW}=== Salt Marcher UI Test Runner ===${NC}"
echo ""

# Step 1: Build
echo -e "${YELLOW}[1/4] Building plugin...${NC}"
cd "$PROJECT_ROOT"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi
echo -e "${GREEN}Build successful${NC}"
echo ""

# Step 2: Reload plugin
echo -e "${YELLOW}[2/4] Reloading plugin...${NC}"
node "$CLI_TOOL" reload-plugin
if [ $? -ne 0 ]; then
    echo -e "${RED}Plugin reload failed!${NC}"
    exit 1
fi
echo -e "${GREEN}Plugin reloaded${NC}"
echo ""

# Step 3: Execute command
if [ -z "$1" ]; then
    echo -e "${RED}Error: No command specified${NC}"
    echo "Usage: $0 <command> [args...]"
    echo ""
    echo "Examples:"
    echo "  $0 edit-creature adult-black-dragon"
    echo "  $0 edit-spell fireball"
    echo "  $0 edit-item potion-of-healing"
    exit 1
fi

COMMAND=$1
shift
ARGS=("$@")

echo -e "${YELLOW}[3/4] Executing command: $COMMAND ${ARGS[*]}${NC}"
node "$CLI_TOOL" "$COMMAND" "${ARGS[@]}"
if [ $? -ne 0 ]; then
    echo -e "${RED}Command execution failed!${NC}"
    exit 1
fi
echo -e "${GREEN}Command executed${NC}"
echo ""

# Step 4: Extract and display UI test logs
echo -e "${YELLOW}[4/4] Extracting UI test logs...${NC}"
if [ ! -f "$LOG_FILE" ]; then
    echo -e "${RED}Log file not found: $LOG_FILE${NC}"
    exit 1
fi

# Get logs from the last 5 seconds (adjust if needed)
CUTOFF_TIME=$(date -d '5 seconds ago' '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -v-5S '+%Y-%m-%d %H:%M:%S')

echo -e "${GREEN}Recent [UI-TEST] logs:${NC}"
echo ""
grep '\[UI-TEST\]' "$LOG_FILE" | tail -n 50
echo ""

echo -e "${GREEN}=== Test completed ===${NC}"

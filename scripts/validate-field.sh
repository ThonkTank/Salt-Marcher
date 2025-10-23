#!/bin/bash
# scripts/validate-field.sh
# Validate specific field value in UI test logs
# Usage: ./scripts/validate-field.sh <entity-kind> <entity-name> <field-id> <expected-value>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/CONSOLE_LOG.txt"

if [ $# -lt 3 ]; then
    echo -e "${RED}Error: Missing arguments${NC}"
    echo "Usage: $0 <entity-kind> <entity-name> <field-id> [expected-value]"
    echo ""
    echo "Arguments:"
    echo "  entity-kind     - creature, spell, item, or equipment"
    echo "  entity-name     - Name of the entity (e.g., adult-black-dragon)"
    echo "  field-id        - Field ID to validate (e.g., size, ac, hp)"
    echo "  expected-value  - Expected value (optional, just checks field exists if omitted)"
    echo ""
    echo "Examples:"
    echo "  $0 creature adult-black-dragon size Huge"
    echo "  $0 creature adult-black-dragon ac 19"
    echo "  $0 spell fireball level 3"
    exit 1
fi

ENTITY_KIND=$1
ENTITY_NAME=$2
FIELD_ID=$3
EXPECTED_VALUE=$4

echo -e "${YELLOW}=== Field Validation ===${NC}"
echo "Entity: $ENTITY_KIND/$ENTITY_NAME"
echo "Field: $FIELD_ID"
if [ -n "$EXPECTED_VALUE" ]; then
    echo "Expected: $EXPECTED_VALUE"
fi
echo ""

# Step 1: Run test-ui.sh to open entity and capture logs
echo -e "${YELLOW}Running test...${NC}"
"$SCRIPT_DIR/test-ui.sh" "edit-$ENTITY_KIND" "$ENTITY_NAME" > /dev/null 2>&1
echo ""

# Step 2: Find field in logs
if [ ! -f "$LOG_FILE" ]; then
    echo -e "${RED}Log file not found: $LOG_FILE${NC}"
    exit 1
fi

# Extract recent UI-TEST logs and find the field
FIELD_LOG=$(grep '\[UI-TEST\] Field rendered:' "$LOG_FILE" | tail -n 50 | grep "\"id\":\"$FIELD_ID\"" | tail -n 1)

if [ -z "$FIELD_LOG" ]; then
    echo -e "${RED}❌ Field '$FIELD_ID' not found in logs${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Field '$FIELD_ID' found in logs${NC}"
echo ""

# Step 3: Validate value if expected value provided
if [ -n "$EXPECTED_VALUE" ]; then
    # Extract the value from JSON log
    # This is a simple grep-based extraction, could use jq for more robustness
    ACTUAL_VALUE=$(echo "$FIELD_LOG" | grep -oP "\"value\":\"?\K[^\"',}]*" | head -n 1)

    if [ -z "$ACTUAL_VALUE" ]; then
        # Try extracting from chips for tag fields
        ACTUAL_VALUE=$(echo "$FIELD_LOG" | grep -oP "\"chips\":\[\K[^\]]*" | sed 's/\"//g')
    fi

    echo "Actual value: $ACTUAL_VALUE"
    echo ""

    if [[ "$ACTUAL_VALUE" == *"$EXPECTED_VALUE"* ]]; then
        echo -e "${GREEN}✓ Validation PASSED${NC}"
        exit 0
    else
        echo -e "${RED}❌ Validation FAILED${NC}"
        echo "Expected: $EXPECTED_VALUE"
        echo "Actual: $ACTUAL_VALUE"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Field exists (no value validation)${NC}"
    exit 0
fi

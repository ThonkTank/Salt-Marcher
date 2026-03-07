#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=scripts/lib/crawler-common.sh
source "$SCRIPT_DIR/lib/crawler-common.sh"

cd "$REPO_ROOT"

echo "Delegating to Gradle task: crawler"
echo "Tip: run './gradlew crawler' directly for the primary workflow."

run_with_inhibit \
  "salt-marcher-crawler" \
  "DnD Beyond Monster Crawler running" \
  ./gradlew --console=plain crawler

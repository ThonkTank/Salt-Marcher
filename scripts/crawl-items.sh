#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=scripts/lib/crawler-common.sh
source "$SCRIPT_DIR/lib/crawler-common.sh"

cd "$REPO_ROOT"

# Optional: build magic-item slug list (this step only, then exit).
# For the full pipeline afterwards: ./scripts/crawl-items.sh (without flag).
if [ "$1" = "--build-slugs" ]; then
  echo "Delegating to Gradle task: crawlerItemsSlugs"
  echo "Tip: run './gradlew crawlerItemsSlugs' directly for the primary workflow."
  ./gradlew --console=plain crawlerItemsSlugs
  exit 0
fi

echo "Delegating to Gradle task: crawlerItemsPipeline"
echo "Tip: run './gradlew crawlerItemsPipeline' directly for the primary workflow."

run_with_inhibit \
  "salt-marcher-item-crawler" \
  "DnD Beyond Item Crawler running" \
  ./gradlew --console=plain crawlerItemsPipeline

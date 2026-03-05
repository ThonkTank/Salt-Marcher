#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

CP="out:lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar:lib/slf4j-api.jar:lib/slf4j-nop.jar"

echo "Compiling..."
javac -cp lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar \
      -sourcepath src -d out \
      src/importer/ItemCrawler.java \
      src/importer/ItemImporter.java

# Optional: build magic-item slug list (this step only, then exit).
# For the full pipeline afterwards: ./crawl-items.sh (without flag).
if [ "$1" = "--build-slugs" ]; then
    echo "Building magic-item slug list..."
    java -cp "$CP" importer.ItemCrawler --build-slugs
    echo "Slug list created."
    exit 0
fi

echo "Starting item crawler..."
# systemd-inhibit prevents the machine from sleeping during a long crawl.
# On non-systemd systems (macOS, WSL, some Linux distros), it is skipped automatically.
if command -v systemd-inhibit &>/dev/null; then
  systemd-inhibit \
    --what=sleep:handle-lid-switch \
    --who="salt-marcher-item-crawler" \
    --why="DnD Beyond Item Crawler running" \
    --mode=block \
    java -cp "$CP" importer.ItemCrawler
else
  echo "WARNING: systemd-inhibit not found — running without sleep prevention."
  java -cp "$CP" importer.ItemCrawler
fi

echo ""
echo "Crawler done. Starting database import..."
java -cp "$CP" importer.ItemImporter

echo ""
echo "Done."

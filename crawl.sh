#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

CP="out:lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar:lib/slf4j-api.jar:lib/slf4j-nop.jar"

echo "Compiling..."
# -sourcepath src compiles all transitively-referenced source files automatically.
# HtmlStatBlockParser, CrawlerUtils, DatabaseManager, etc. are picked up without being listed explicitly.
javac -cp lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar -sourcepath src -d out src/importer/MonsterCrawler.java src/importer/MonsterImporter.java

echo "Starting crawler..."
# systemd-inhibit prevents the machine from sleeping during a long crawl.
# On non-systemd systems (macOS, WSL, some Linux distros), it is skipped automatically.
if command -v systemd-inhibit &>/dev/null; then
  systemd-inhibit \
    --what=sleep:handle-lid-switch \
    --who="salt-marcher-crawler" \
    --why="DnD Beyond Monster Crawler running" \
    --mode=block \
    java -cp "$CP" importer.MonsterCrawler
else
  echo "WARNING: systemd-inhibit not found — running without sleep prevention."
  java -cp "$CP" importer.MonsterCrawler
fi

echo ""
echo "Crawler done. Starting database import..."
java -cp "$CP" importer.MonsterImporter

echo ""
echo "Done."

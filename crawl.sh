#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

CP="out:lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar:lib/slf4j-api.jar:lib/slf4j-nop.jar"

echo "Kompiliere..."
javac -cp lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar -sourcepath src -d out src/importer/DndBeyondCrawler.java src/importer/MonsterImporter.java

echo "Starte Crawler (Sleep-Modus blockiert)..."
systemd-inhibit \
  --what=sleep:handle-lid-switch \
  --who="salt-marcher-crawler" \
  --why="DnD Beyond Monster Crawler läuft" \
  --mode=block \
  java -cp "$CP" importer.DndBeyondCrawler

echo ""
echo "Crawler fertig. Starte Import in Datenbank..."
java -cp "$CP" importer.MonsterImporter

echo ""
echo "Fertig. Sleep-Sperre aufgehoben."

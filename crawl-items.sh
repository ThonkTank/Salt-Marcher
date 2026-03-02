#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

CP="out:lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar:lib/slf4j-api.jar:lib/slf4j-nop.jar"

echo "Kompiliere..."
javac -cp lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar \
      -sourcepath src -d out \
      src/importer/ItemCrawler.java \
      src/importer/ItemImporter.java

# Optional: Magic-Item-Slug-Liste bauen
if [ "$1" = "--build-slugs" ]; then
    echo "Baue Magic-Item-Slug-Liste..."
    java -cp "$CP" importer.ItemCrawler --build-slugs
    echo "Slug-Liste erstellt. Starte nun den normalen Crawl."
fi

echo "Starte Item-Crawler (Sleep-Modus blockiert)..."
systemd-inhibit \
  --what=sleep:handle-lid-switch \
  --who="salt-marcher-item-crawler" \
  --why="DnD Beyond Item Crawler läuft" \
  --mode=block \
  java -cp "$CP" importer.ItemCrawler

echo ""
echo "Crawler fertig. Starte Import in Datenbank..."
java -cp "$CP" importer.ItemImporter

echo ""
echo "Fertig. Sleep-Sperre aufgehoben."

# Atlas M2: gemeinsames Budget für Kacheln und Projektionsindizes

Stand: 24.10.2026, isolierter Atlasumbau auf Basis von `f67a4e63e`.

## Änderung und Architekturentscheidung

Veröffentlichte Projektionsindizes liegen nun mit Terrain- und Geometriekacheln
in `tiles-v2/atlas-tiles.sqlite`. Alle Kampagnen und beide Eintragsarten teilen
96 MiB logisches Nutzdatenbudget, höchstens 64 MiB je Namensraum. Die Grenze
von 8 MiB je gewöhnlicher Kachel gilt weiterhin; ein Index darf größer sein,
muss aber einschließlich seines Deskriptors in beide gemeinsamen Limits passen.
Die bestehende Grenze von 256 MiB für Cache-Datenbank plus Rollbackjournal bleibt.

Dateien werden in höchstens 1 MiB großen Blöcken gelesen, geprüft und gespeichert.
Ein SQLite-Schreibvorgang umfasst Verdrängung, alten Eintrag, neue Blöcke und
neuen Deskriptor. Der Löschtrigger entfernt Blöcke mit ihrem übergeordneten
Eintrag, auch bei kampagnenweiser Löschung. Bereits geöffnete Handles lesen
verschärfte Limits innerhalb der Schreibtransaktion erneut. Das Schema ergänzt
Format 2 additiv; vorhandene Kacheln bleiben verwendbar.

Eine getrennte Dateiverwaltung hätte Budget und Veröffentlichung über Dateisystem
und SQLite koordinieren müssen. Getrennte feste Teilbudgets hätten freien Platz
zwischen Indizes und Kacheln nicht geteilt. Die gewählte gemeinsame Transaktion
vermeidet beide Probleme. Direkt auf einem veränderlichen gemeinsamen Index zu
arbeiten würde dagegen die bestehende unabhängige Worker-Verarbeitung aufgeben.
Deshalb kopiert jeder warme Worker einen vollständig geprüften Snapshot in seine
private Arbeitsdatei und beendet die kurze Cache-Lesetransaktion vor der Nutzung.
Verdrängung entfernt nur die gespeicherte Generation; laufende Leser behalten
ihre Arbeitskopie. Ein neuer Leser baut einen verdrängten Index aus den kanonischen
Quellen wieder auf. Diese bleiben ausschließlich lesend geöffnet.

Der Transport prüft Blockreihenfolge, Größe, Einzel- und Gesamtprüfsumme. Der
Index prüft zusätzlich SQLite-Kennung, Format, vollständige Seitenlänge,
Metadatentabelle und Quellenstand. Veröffentlichung bleibt generationengebunden;
Rollback, Quellenrevisionen, Schattenvorschau und Abbruch behalten ihre Verträge.
Vor dem Start der Worker entfernt der exklusive Appstart die bisherigen eigenen
JSON-/JSONL-/Snapshotdateien. Ein einmaliger Neuaufbau verhindert, dass diese alten
Bestände das neue gemeinsame Budget umgehen. Fremde Dateinamen bleiben erhalten.

## Prüfung und gemessene Wirkung

**67 gezielte Tests bestanden:** [51 Cache-/Indexfälle](tests.log.gz) und
[16 Terrain-/Geometriefälle](tile-regressions.log.gz). Dazu gehören globale und
kampagnenbezogene Verdrängung, laufender privater Leser nach Verdrängung,
Neuaufbau, additive Migration, beschädigte Blöcke, abgebrochene Ersetzung,
SIGKILL mit echtem Rollbackjournal, Quellenwechsel und selektive Löschung.
Der [erste Lauf](first-tests.log.gz) fand einen offenen SQLite-Iterator nach
`wx`-Kollision sowie unpassende Testannahmen; der Iterator wird nun erst nach
erfolgreicher Dateierzeugung geöffnet. Eine zusätzliche Seitenlängenprüfung
verwirft trunkierte SQLite-Dateien auch bei gültiger Transportprüfsumme.
[App-Typprüfung](check.log.gz), [Desktop-Typprüfung](check-desktop.log.gz) und
[Desktopbuild](build-desktop.log.gz) bestanden.

[Native Geometrieprobe](native-geometry.json.gz), feste M0-Welt, reguläre
Preload/Main/Worker-Strecke, zwei reguläre Prozessenden mit verschwundenen PIDs:
kalte Daten 4.419 ms, warme Daten 456 ms, Feindaten 555 ms. Zuvor waren es
4.349 / 323 / 518 ms. **Kein Geschwindigkeitsgewinn behauptet:** die warme Probe
ist langsamer; der Einfluss von Kopieren und Prüfen ist weiter zu isolieren.
Einzelproben ergeben keine p95-Statistik. Der [Baselinevergleich](baseline-comparison.json)
belegt gleiche Meshpuffer, Pixelbelegung, Autoreninhalte und exakte Raumauswahl.
Alle drei Geometriebilder sind bytegleich zur vorherigen geprüften Darstellung;
[flache Übersicht](overview-flat.png) wurde erneut gesichtet.

[Normale Atlas-Wiederöffnung](native-reopen.json.gz): erste Terrainübersicht
4.123 ms kalt / 2.380 ms nach Neustart; Regionsbereitschaft 7.045 / 2.772 ms.
Der gespeicherte vollständige Index hat 37.785.600 Byte; Digest und alle
Quellenstempel bleiben nach Neustart identisch. Autoreninhalte unverändert,
beide Prozesse Exit 0/PIDs verschwunden, keine Rendererfehler.
[Wiedergeöffnete Oberfläche](reopened.png) gesichtet. Diese Probe benutzt den
bisherigen normalen Atlasrenderer und belegt keine vollständige M2-Übernahme.

## Budgetgrenze und offene Arbeit

Das Budget umfasst **dauerhaft wiederverwendbare Cacheeinträge**, nicht sämtliche
Arbeitsdateien. Aktive private Indizes, SQLite-TEMP/WAL und Backup-Kandidaten sind
zusätzlich vorhanden. Der Backup-Kandidat hat weiterhin eine 96-MiB-Abbruchgrenze;
für sämtliche aktiven Arbeitsdateien zusammen wird hier keine feste Plattengrenze
behauptet. Die App besitzt zwei Regionsdienste (Ansicht und Export), die jeweils
vor einem Workerwechsel dessen tatsächliches Ende abwarten. Diese Anzahlgrenze
ersetzt kein Bytebudget. Ein unpassender oder belegter Cache bleibt eine
Leistungsgrenze; kanonische Daten werden deswegen nicht verändert.

M2 bleibt offen: erste kalte Übersicht unter zwei Sekunden, Arbeits-/Quellenbudgets,
weitere Objektklassen, Materialstufen und vollständige Weltlast sind nicht durch
vereinheitlichte Cachehaltung erledigt. Die normale Atlasfläche bleibt bis M7 auf
dem bisherigen Renderer. Keine Main-Integration, Veröffentlichung oder
Produktabnahme in diesem Schritt.

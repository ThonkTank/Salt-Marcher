# M2: gemeinsamer Kachelcache und Wiederanlauf

Terrain- und Geometriepuffer teilen jetzt `tiles-v2/atlas-tiles.sqlite`.
Kampagnen-/Dateipfade bleiben getrennte Namensräume; Verdrängung berücksichtigt
den gesamten aktiven Kachelbestand. Dieser Schritt ersetzt die getrennten
V1-Kacheldateien aus dem [ersten Terrainbeleg](../atlas-terrain-tiles-20261023/README.md).
M2 bleibt offen: eigenständige Materialkanäle, dichte Geometrieübersichten,
weitere Objektklassen und vollständige Weltqualifikation fehlen weiterhin.

## Besitz, Budgets und Wiederherstellung

- 64 MiB serialisierte Nutzdaten je Namensraum, 96 MiB gemeinsam und 8 MiB je
  Eintrag. Einfügen und LRU-Verdrängung erfolgen in einer Transaktion.
  Bereits geöffnete Handles beachten nachträglich enger gesetzte Limits.
- Die aktive SQLite-Datei ist auf 127 MiB begrenzt. DELETE-Journal und
  `cache_spill=OFF` erlauben unter den unterstützten SQLite/VFS-Annahmen einen
  Ansatz von 256 MiB für Datenbank plus Rollbackjournal. Die Berechnung reserviert
  zwei Seitenbestände plus 2 MiB für Journal-/Sektoroverhead; siehe
  [SQLite-Journalformat](https://www.sqlite.org/fileformat2.html#the_rollback_journal).
  Das ist keine universelle Dateisystemgrenze: temporäre Initialisierungsdateien,
  unbekannte Altdateien und die separaten Projektionsindizes zählen nicht dazu.
  Worker halten schmutzige Transaktionsseiten im RAM; das 32-MiB-Rendererbudget
  ist davon unabhängig. Ein Gesamtbudget für alle Atlas-Indizes bleibt offen.
- Neue Dateien werden vollständig unter temporärem Namen initialisiert und ohne
  Überschreiben veröffentlicht. Bekannte V1-Shards werden nur beim exklusiven
  Start entfernt. Unbekannte, mehrdeutige oder symbolisch verknüpfte Dateien
  bleiben unangetastet. Ein beschädigter Cache darf kanonische Daten nicht ändern.
- Kampagnenlöschung entfernt ausschließlich ihren Namensraum. Bei Sperren bleibt
  die Löschung zur Wiederaufnahme vorgemerkt. Ein beschäftigter Writer verhindert
  keinen gültigen Cachetreffer, nur dessen optionale LRU-Aktualisierung.
- Prüfsummenfehler entfernen nur die tatsächlich gelesene alte Zeile. Ein parallel
  erneuerter Eintrag bleibt erhalten. Nach einem Prozessabbruch übernimmt SQLite
  die Wiederherstellung des eindeutig eigenen Rollbackjournals.

## Geprüfter Stand

51 gezielte Fälle in [Cache](../../../tests/atlas-tile-cache.test.mjs),
[Terrain](../../../tests/atlas-terrain-tiles.test.mjs),
[Geometrie](../../../tests/atlas-geometry-tiles.test.mjs) und
[Projektionsindex](../../../tests/desktop-atlas-region-cache.test.mjs) bestanden.
Enthalten sind kampagnenübergreifender LRU-Druck, mehrere Handles, ein echter
`SIGKILL` mit heißem Journal, Wiederöffnung, konkurrierende Ersetzung, selektive
Löschung sowie unveränderte kanonische Daten. Typprüfungen und Desktopbuild
bestanden. Das ersetzt weder Candidate-CI noch Produkt-/Ownerabnahme.

Die native [Geometrieprobe](../../../tools/test-desktop-atlas-geometry-tiles.mjs)
`1792791464206-1162490` baute fünf Geometriekacheln und eine Terrainkachel auf.
Nach Prozessneustart kamen alle sechs als Cachetreffer zurück, einschließlich
Terrain und Geometrie an derselben Weltadresse. 4.225 Höhenwerte, TypedArrays,
semantische Gebäudetreffer (151 m) und Obergeschosstreffer (145 m) blieben korrekt.
Ein kanonisches Verbergen des Obergeschosses erhöhte Revision 3 auf 4 und entfernte
die Räume aus der Darstellung; die physische Dachhöhe blieb 152 m.
[Rohbeleg mit Quellen- und Buildhashes](geometry-result.json.gz).

Die native [Pan-Probe](../../../tools/test-desktop-atlas-tiles.mjs)
`1792791606913-1164174` behielt drei gültige Detailkacheln während einer
angehaltenen neuen Übersicht. Danach folgten der atomare Übersichtswechsel und
die vollständigen Details auf demselben Canvas. Die warmen Abrufe nach Neustart
lagen bei 213 ms inklusive Workerstart und anschließend 25 ms für Detail;
das ist eine kleine technische Probe, kein Weltbenchmark.
[Rohbeleg](pan-result.json.gz).

Alle vier App-Prozesse endeten mit Exit 0 ohne Signal und waren danach nicht mehr
vorhanden. Keine Rendererfehler; Quellenhashes vor/nach den Proben identisch.
Die Screenshots wurden visuell geprüft; sie zeigen isolierte Meshproben, keine
vollständige Materialdarstellung. Basis beider Läufe: `38754bfa3` mit den hier
qualifizierten uncommittierten Cache-/Quellenfilteränderungen.

Der parallel qualifizierte [räumliche Quellenfilter](../atlas-geometry-tiles-20261023/README.md)
reduziert unnötige SQL-Arbeit in der festen M0-Welt. Die normale Atlasfläche
bleibt bis zur Werkzeugübernahme auf dem bisherigen Renderer.

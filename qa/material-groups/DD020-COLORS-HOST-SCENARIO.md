# DD-020.21–.25: gebündelter Hostlauf, vorbereitet

Der Sondermodus `DUNGEON_QA_DD020_COLORS=1` leitet `material-muster` an `tools/groups/scenarios/material-muster-colors.cjs`. Er verwendet einen eigenen Kartennamen und QA-Speicherstand. Pro Phase erzeugt er genau einen Gruppenrecord je der 29 Manifestfälle. Nur DD-020.21–.25 werden aktiv geprüft; alle anderen bleiben in diesem Lauf mit Lücke `open`. Er verändert keine Produktdatei und startet selbst keinen Host.

Nach Integration des Material-Commits und mit exklusiver Grafikzeit aus dem Entwicklungszweig:

```sh
DUNGEON_QA_DD020_COLORS=1 DUNGEON_QA_ROOT=/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd020-colors-host node tools/host-test.cjs --group material-muster
DUNGEON_QA_DD020_COLORS=1 DUNGEON_QA_ROOT=/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd020-colors-host node tools/host-test.cjs --group material-muster --restart
```

Der gemeinsame Hostrunner muss den aktuellen Plugin-Build und die bestehende isolierte Obsidian-Vorbereitung verwenden. Edit und Reopen müssen dieselbe `DUNGEON_QA_ROOT` verwenden. Die Editphase beginnt mit einer 12×8-Karte und setzt für jeden Fall `#3366cc`, A255. Sie prüft sichtbare Hex-/R-/G-/B-/A-Werte **vor Accept**, unverändertes Dokument bis Accept, die übernommenen Einstellungen, je eine getrennte Rechteckfläche mit Vorschau, Undo und Redo. Je Fall wird ein Screenshot der Stufen erstellt. Danach werden Dokument und Dateiprüfsumme gespeichert. Die Reopenphase verlangt einen frischen Hostprozess, prüft dieselbe Dateiprüfsumme sowie fünf Entitäts-IDs, RGB-/Alpha-Werte und Dokumentgleichheit.

Die Zielwerte aus der isolierten Originalmessung sind .21 `424958` (Farbfeld), .22 `7ccc33` (Hue), .23 `6466cc` (R100), .24 `3396cc` (G150), .25 `336632` (B50), jeweils A255. Der Host-Hue-Regler wird für den normierten Wert 253/1000 per DOM-Input ausgelöst; deshalb bleibt die Pointerzuordnung ausdrücklich offen. Auch ein vollständig bestandener Hostlauf belässt diese fünf **Gesamtfälle** `open`, solange die Originalflächen wegen der verzögerten Original-Ziehgeste nicht gleichgeometrisch pixelweise und nach Original-Frischstart verglichen wurden. Der Modus meldet `deviation`, wenn ein gemessener Picker-, ARGB-, Vorschau-, Undo-/Redo- oder Host-Frischstartwert abweicht.

Statische Prüfung: Beide Szenariodateien bestehen `node --check`; `tests/material-muster-colors-scenario.test.cjs` bestätigt bei einem simulierten Startabbruch genau 29 einmalige Records und protokollierte Beweislücken. Ein echter Hostlauf fand mangels grafischem Slot nicht statt.

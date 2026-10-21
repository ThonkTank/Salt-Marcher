# Terrainprojektion liest nur benötigte Linienobjekte

Die Öffnungsprofile des normalen Atlas zeigen weiterhin einen wartenden Main und
Renderer. Der Kartenworker benötigt nach dem Indexaufbau mehrere Sekunden für
die erste Geländeprojektion. Eine darin enthaltene unnötige Arbeit ist jetzt
entfernt: `AtlasLandscapeReader.lines` las bisher sämtliche sichtbaren Objekte
außer Flächen und filterte erst danach auf Straßen und Flüsse. So wurden auch
Orte und Vegetationsobjekte mehrfach geladen und als JSON dekodiert.

Ein kleiner partieller Index auf den bereits vorhandenen temporären Metadaten
wählt nun ausschließlich Straßen und Flüsse aus, bevor ihre Nutzdaten gelesen
werden. Die bisherigen Abfragen für Objektanzeige und Auswahl bleiben bestehen.
Sortierung, Quellenbindung, Ortsnamen, Sichtbarkeit und genaue Geometrie werden
weiter durch denselben Leser verarbeitet. Es gibt keinen zusätzlichen Cache und
keine Änderung am kanonischen Speicherformat.

## Kontrollierter Vergleich

[Messung](projection-parity.json) auf derselben readonly geöffneten vollständigen
synthetischen Prüfwelt, jeweils in einem gepinnten SQLite-Snapshot. Vergleich des
Lesers aus `1f64af735` mit dem aktuellen Leser; gemeinsame Abhängigkeiten identisch.
Keine parallelen eigenen Builds oder Tests während der Messung.

| Schritt | Vorher | Nachher |
| --- | ---: | ---: |
| Nutzdaten für eine Linienabfrage gelesen | 7.048 | 1.024 |
| Zurückgegebene Straßen und Flüsse | 1.024 | 1.024 |
| Linienabfrage | 155,5 ms | 31,5 ms |
| Nutzdaten während kompletter Übersichtsprojektion gelesen | 31.126 | 9.343 |
| Komplette Übersichtsprojektion | 2,628 s | 2,752 s |

Die Linien, Farbpixel, Höhen und vollständigen Projektionsantworten sind jeweils
byteidentisch. Die unnötigen Nutzdatenzugriffe sinken deutlich; **dieser einzelne
Lauf belegt keine Beschleunigung der gesamten Projektion**. Andere Arbeiten,
insbesondere wiederholtes Lesen und Dekodieren von Höhenkacheln, dominieren weiter.
Es wird weder unmittelbare Öffnung noch die Leistungsabnahme behauptet.

```
ATLAS_REGION_BASELINE=1f64af735 \
ATLAS_MIXED_SOURCE=<synthetische-workbench.sqlite> \
QA_EVIDENCE_DIR=.build/terrain-line-stream-parity \
node tools/measure-terrain-line-stream.mjs
```

## Regressionen

21 betroffene Fälle bestanden: geordnete Terrainarten, Abtastung kleiner Flächen,
progressive Projektion, Farbdienst und geländegebundene Trassen. Der neue Fall in
`tests/terrain-kind-index.test.mjs` vergleicht die vollständigen Linien mit dem
bisherigen Lesen-und-Filtern, prüft tatsächlich ausgeführte Nutzdatenzugriffe und
den SQLite-Abfrageplan sowie Wechsel einer Objektart und Löschen. Ein gezielter
Nachlauf des neuen Falls bestand ebenfalls. Beide Typprüfungen und Desktop-Build
bestanden. Native Ergebnisse werden separat festgehalten; lokale Tests ersetzen
weder Candidate-CI noch Main-Integration oder Release.

Ein vorläufiger Versuch, die allgemeinen Nutzdaten-Seitenabfragen durch einzelne
Rowid-Zugriffe zu ersetzen, zeigte im Diagnoseprofil keinen belastbaren Gewinn
und wurde vollständig verworfen. Die Änderung beschränkt sich auf die belegten
unnötigen Linienzugriffe.

## Normaler App-Einstieg

[Native Probe](native.json), [Bild nach Wiederöffnen](reopened.png): gleicher
voller synthetischer Bestand, gleicher Entwicklungsstart und gleiche Weltkamera
wie bei der [vorherigen Cacheprobe](../atlas-persistent-region-index-20261021/README.md).
Erste Terrainübersicht **12,197 s**, frischer zweiter Prozess **9,831 s**; zuvor
12,782 s und 10,584 s. Der unveränderte Objektcache wurde beim zweiten Start
wiederverwendet. Beide Prozesse endeten regulär und waren anschließend abwesend,
keine Rendererfehler, alle gebundenen App-/Workerdateien blieben unverändert.
Währenddessen liefen keine parallelen eigenen Builds oder Tests.

Dies sind einzelne vollständige Öffnungsläufe, keine p95-/p99-Qualifikation und
kein Nachweis auf dem Pentium Gold 7505. Die erste Übersicht ist weiter zu spät
und sichtbar unscharf. Frühe Terrainanzeige vor dem vollständigen Objektaufbau,
wiederholte Höhenkacheldekodierung und die laufende Verfeinerung bleiben offen.

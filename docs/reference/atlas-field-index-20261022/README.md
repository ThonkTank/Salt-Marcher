# Terrainfelder: vollständig abdeckende Quellenindizes

Lokaler Fortschritt auf `codex/atlas-bounded-terrain-history`, Ausgangspunkt
`6e8cadbd1cacb4e5fe9e0702db8477553ecceadd`. Keine Main-, Release- oder
Pentium-Abnahme.

## Ursache und Änderung

Nach dem räumlichen Grundflächenindex benötigte eine CPU-Profilierung von
48 Detailkacheln und der abschließenden Kontextprojektion noch 12,68 Sekunden.
Davon entfielen rund 1,65 Sekunden auf SQLite-Aufrufe aus `terrainHeightBlocks`.
Die bereits vorhandenen partiellen Indizes für Höhen, Trassen und Seen enthielten
die Sortierung, aber nicht die räumlichen Grenzen. Jede kleine Höhenabtastung
musste deshalb auch entfernte Kandidaten in der großen Metadatentabelle prüfen.

`AtlasLandscapeReader` ergänzt diese drei vorhandenen Indizes um die Grenzen,
den Terraintyp und den ursprünglichen Sortierwert. SQLite pflegt sie weiter
automatisch. Reihenfolge, genaue Double-Grenzen, Filter, Quellen-Rowids und
Nutzdaten bleiben gleich. Es entstehen keine weitere Cacheklasse, zweite
Geländedarstellung oder neue persistente Datenstruktur.

Wie beim [Grundflächenindex](../atlas-base-index-20261022/README.md) prüft die
Regression das tatsächliche SQL-Programm zusätzlich zum Abfrageplan: Gerade
Ausdrucksindizes können als abdeckend bezeichnet werden und trotzdem die
Metadatentabelle öffnen. Sowohl der kanonische Recordpfad als auch der Pfad mit
dekodierten Höhenblöcken müssen ohne diesen Tabellenzugriff auskommen.

## Vergleich und Regressionen

Die unveränderte gemischte Prüfwelt enthält 100.000 bearbeitete Hexfelder,
5.000 Orte, 1.028 Höhenkacheln, 5.000 eingerichtete Gebäudegruppen, 50
Detailbereiche und einen Dungeon mit 4.001 Räumen. Das ist keine Welt mit
100.000 feinen Höhenkacheln und keine gestalterisch abgenommene Fantasykarte.

[Vollständiger ABBA-Vergleich](projection-parity.json), einschließlich des
weiterhin verzögerten Grundflächenindexaufbaus:

| Durchlauf | Vorher | Nachher |
| --- | ---: | ---: |
| erstes Paar | 12,743 s | 10,924 s |
| zweites Paar, umgekehrte Reihenfolge | 11,401 s | 10,709 s |

Die erste Übersicht sowie alle Detailpixel und die vollständige Kontextantwort
haben in allen vier Läufen denselben SHA-256. Die erste Übersicht zeigt keinen
belastbaren Geschwindigkeitsgewinn. Die belegten TEMP-Datenbankseiten wachsen
um 32.768 Byte; das ist keine Aussage über den Gesamt-RAM. Die bestehenden
8-MiB-SQLite-Seitencaches und der gemeinsame 16-MiB-Projektionscache bleiben
unverändert.

Reproduktion mit einer erhaltenen synthetischen SQLite-Prüfwelt:

```sh
TERRAIN_INDEX_SOURCE=.build/region-cache-full-world-final/world.sqlite \
TERRAIN_INDEX_BASELINE=6e8cadbd1 \
QA_EVIDENCE_DIR=.build/field-cover-parity \
node tools/measure-terrain-base-index.mjs
```

[21 lokale Regressionen](tests.json) bestehen. Der erweiterte
`terrain-kind-index`-Test vergleicht Index- und Tabellenpfad mit Rowids oberhalb
von `Number.MAX_SAFE_INTEGER`, optionalem Abtastfilter, leeren und schmalen
Ausschnitten sowie nach Klassifikationswechsel, Einfügen, Löschen und Reset.
Die betroffenen Höhencachetests prüfen zusätzlich Sculpt, Undo/Redo, externe
Änderung und Verdrängung.

## Normaler Atlas und verbleibende Grenzen

Beide nativen Abläufe liefen mit denselben elf Build-Artefakten über
`tools/ui-session.py`, jeweils mit 240 Sekunden Höchstdauer. Keine eigene
parallele Build-/Testlast während der Messungen. Alle drei Electron-Prozesse
endeten normal mit Code 0, waren danach verschwunden und meldeten keine
Rendererfehler. Typprüfungen für App und Desktop sowie Desktop-Build bestanden.

[Öffnen und frischer Prozess](native-opening.json), jeweils vom normalen
Kampagneneinstieg bis zu 48/48 Detailkacheln:

| Beobachtung | Vorher: Grundflächenindex | Jetzt |
| --- | ---: | ---: |
| erste Geländeübersicht, kalt | 4,772 s | 4,959 s |
| vollständige Objektgeometrie, kalt | 10,863 s | 10,848 s |
| alle Detailkacheln, kalt | 25,342 s | 23,735 s |
| erste Geländeübersicht, frischer Prozess | 5,010 s | 4,916 s |
| vollständige Objektgeometrie, frischer Prozess | 8,785 s | 8,477 s |
| alle Detailkacheln, frischer Prozess | 24,208 s | 21,355 s |

Die Vorherwerte stammen aus der direkt vorausgehenden
[nativen Grundflächenindexprüfung](../atlas-base-index-20261022/native-opening.json).
Das sind einzelne lokale Beobachtungen, keine p95-Verteilung. Die Objektcachedatei
blieb bei Wiederöffnung mit 9.897.192 Byte und identischem Änderungszeitpunkt
erhalten. `firstDetailMs` wird erst nach dem Objektwartepunkt beobachtet und
beweist keinen Zeitpunkt des ersten GPU-Detailpixels.

Der [Sculpt-Pinsel mit 2.500 Meilen Radius](native-brush.json) benötigte nach
Loslassen 5,587 Sekunden bis zur Werkzeugfreigabe; zuvor 5,553 Sekunden.
Das ist kein nachgewiesener Pinselgewinn. Die Kamera änderte währenddessen ihren
Ausschnitt: vom Mausradereignis bis zur beobachteten Änderung vergingen 344 ms,
einschließlich einer festen 250-ms-Wartezeit des Prüfskripts. Das ist weder
Eingabelatenz noch Bildintervall. Der Pinselabschluss sagt außerdem nichts über
das erste geänderte Geländepixel oder vollständige anschließende Feindetails aus.

Die [gesichtete Wiederöffnung](reopened.png) zeigt weiterhin die regelmäßige
synthetische Belastungskarte. Eine natürliche Fantasykarte und die reale
Pentium-/Intel-UHD-Bildrate sind damit nicht abgenommen. Fünf Sekunden bis zur
Übersicht, über zwanzig Sekunden bis zur vollständigen Verfeinerung und lange
Workerabschnitte von bis zu etwa 300 ms bleiben zu verbessern. Die erste
Übersicht unter zwei Sekunden, Pinselreaktion unter 100 ms, 30-Minuten-RAM-Test
und der vollständige Welt-bis-Innenraum-Autorenablauf bleiben offen.

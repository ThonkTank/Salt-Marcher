# Physische Landschaftsfelder vor vollständiger Darstellung

M2-Zwischenschritt auf `3a44240f7`, 24.10.2026. Noch kein M2-Abschluss,
keine Main-Integration und keine Produktabnahme. Die einzige Roadmap bleibt
[der Atlasplan](../../plans/maps/unified-spatial-atlas.md).

## Verhalten und Grenzen

Geometrieaufträge bereiten zunächst nur Höhe, Trassen und Seen vor, auch außerhalb
der Kamera. Ein eigener persistenter Stempel kennzeichnet diesen Teilindex.
Terrain, Material, Region und Auswahl verlangen vollständige Landschaftsdaten.
Die Ergänzung liest den aktuellen kanonischen Snapshot erneut; bereits konsumierte
Änderungszeiger dürfen keine aufgeschobenen Farben oder Ortsnamen verlieren.
Vollständige Reader werden durch spätere Geometrieaufträge nicht zurückgestuft.
Globale Fehler in ausgelassenen Quellen bleiben sichtbar. Rollback entwertet
auch die Bereitschaft im JavaScript-Reader.

## Erste native Gegenprobe

Reproduktion: `node tools/test-desktop-atlas-geometry-overview.mjs` nach Desktopbuild.
Der erweiterte Ablauf prüft Geometrie kalt, Neustart, exakte Feinabfrage und danach
Terrain/Material im selben Worker. Eine dritte frische Instanz mit separat
aufbewahrtem Vorgängercache liefert die vollständige Gegenreferenz.

| Datenantwort | Vollständige Vorbereitung zuvor | Physische Felder zuerst |
| --- | ---: | ---: |
| Kalte grobe Geometrie | 4.563 ms | 3.677 ms |
| Grobe Geometrie nach Neustart | 186 ms | 209 ms |
| Erste Feinkachel danach | 553 ms | 446 ms |

Einzelproben, kein p95 oder zugesicherter Produktgewinn. Übersichtspuffer,
flache Pixelstatistik und kanonische Autorendaten sind gegenüber der vorherigen
Probe identisch. Alle drei Prozesse endeten mit Exit 0 und verschwundenem PID.
Der exakte Raumtreffer blieb korrekt. Terrainhöhen, Farbpixel, Bearbeitungsfelder,
Waldmaske und alle fünf Materialkanäle stimmen zwischen Ergänzung und vollständigem
Erstaufbau überein; nur auftragsspezifische Quellenkennungen werden nicht verglichen.

**Befund vor der Nacharbeit:** Terrain nach dem wiedergeöffneten Teilindex dauerte 4.491 ms,
der frische vollständige Erstaufbau 2.006 ms. Die Datenkorrektheit allein reicht
nicht, diesen Übergang als Leistungsverbesserung abzunehmen. Der Engpass wird
isoliert vermessen und der Kopierpfad daraufhin geändert; die native Nachprüfung folgt unten.

Maschinenbeleg: [native-initial.json.gz](native-initial.json.gz), inklusive
Quell-/Buildhashes und Prozessende. Rohverzeichnis:
`.build/atlas-geometry-overview-native/1792799633028-1274940`.

## Automatisierte Prüfung

[63 Regressionen](regressions-63.log.gz) prüfen Geometrie, physische Anker,
gestufte Vorbereitung, Cachezugang, Terrain und Material. Die inzwischen
[7 Übergangsprüfungen](transitions-7.log.gz) ersetzen die ursprünglich fünf
Fälle dieses Testfiles: insgesamt 65 verschiedene Tests. Hinzu kamen Rollback
nach erfolgreicher Landschaftsergänzung und physische Kategorieänderungen nach
Neustart einschließlich Undo/Redo. Nicht als zwei zusätzliche vollständige
Regressionsläufe zählen.

Die Übergangsprüfung umfasst außerdem entfernte Höhenanker, Teil-/Vollstempel,
aufgeschobene aktuelle Ortsnamen und gerenderte Farbpixel sowie beschädigte
Quellen außerhalb des Teilindexes.

## Gegenprobe und Nacharbeit am Kopierpfad

[15 isolierte Läufe](promotion-comparison.json.gz), drei wechselnde Runden auf
identischer M0-Quelle, trennen die eigentliche Metadatenkopie vom restlichen Sync:

| Variante | Kopie im Median | Gesamter Sync im Median |
| --- | ---: | ---: |
| Wiedergeöffneter Teilindex, Einzelzeilen | 4.039 ms | 4.138 ms |
| Einzelzeilen in ID-Reihenfolge | 3.393 ms | 3.499 ms |
| **ID-Reihenfolge und 256er-Blöcke** | **1.581 ms** | **1.688 ms** |
| Frischer vollständiger TEMP-Index | 1.111 ms | 1.557 ms |
| Frischer vollständiger TEMP-Index in ID-Reihenfolge | 868 ms | 1.342 ms |

Der wiedergeöffnete Teilindex selbst benötigte ohne Änderungen etwa 1 ms und
keine Kopie. Alle Varianten erzeugten dieselben 108.076 Metadatenzeilen,
Höhen-/Rasterhashes und denselben physischen Teilbestand. Die Sortierung verwendet
laut SQLite-Plan den kanonischen `(campaign_id,id)`-Index ohne temporäre Sortierung.
Zwei fehlerhaft instrumentierte Vorläufe sind im Resultat ausdrücklich verworfen;
sie begründen weder Entscheidung noch Zahlen dieser Tabelle.

**Entscheidung:** Im Produktionspfad wird nach ID gelesen und in festen Blöcken
von höchstens 256 Zeilen kopiert. Der Rest verwendet die Einzelzeilenanweisung;
es werden nur zwei Statementformen je Tabelle behalten. Der kanonische Snapshot
bleibt auf derselben lesenden Verbindung gepinnt. Es gibt keine zusätzliche
kanonische Verbindung und keinen vollständigen JavaScript-Tabellenpuffer.
TEMP nutzt weiterhin SQLite `INSERT SELECT` direkt. Die Reihenfolge ändert weder
kanonische Rowids noch die spätere fachliche Zeichenreihenfolge.

Die Gegenprobe maß den Prototyp mit gebündeltem Restblock. Die endgültige
begrenzte Statementstrategie wird separat durch Tests und native Nachprüfung
qualifiziert; die Tabelle ist keine Messung dieses kleinen Unterschieds.

Reproduktion: `node tools/measure-atlas-field-promotion.mjs`. Das Werkzeug bildet
den alten Einzelzeilenpfad ausdrücklich nach, damit der Vergleich auch nach der
Produktänderung aussagekräftig bleibt. Quelle: entpacktes SQLite SHA-256
`19d4edc88b50d8074578a5c40c870a50331fec1c78a7a8b4f4feee5d463fdb12`;
komprimiertes Archiv SHA-256
`0a9ad854d7d2312cebd337ebb31c469f03f430feb54c50dce76de3d819f09e39`.
Gebündelter Quellstand des Messlaufs SHA-256
`23217dcff56c8d04679837c2f10054032ec56fee1ae4336282f8a907fa5f5c16`.

## Native Nachprüfung der endgültigen Umsetzung

[Abschließender Lauf](native-final.json.gz):
`.build/atlas-geometry-overview-native/1792800662764-1287242`.

| Native Datenantwort | Erste Field-Variante | Endgültige Umsetzung |
| --- | ---: | ---: |
| Kalte Geometrieübersicht | 3.677 ms | 3.642 ms |
| Übersicht nach Neustart | 209 ms | 193 ms |
| Erste genaue Feinkachel | 446 ms | 435 ms |
| Terrain nach Wiederöffnung und Field-Geometrie | 4.491 ms | 2.190 ms |
| Frisches Terrain ohne Vorgängercache | 2.006 ms | 1.822 ms |
| Material nach Ergänzung | 720 ms | 816 ms |
| Material nach frischem Vollaufbau | 644 ms | 624 ms |

Die Gegenprobe belegt die verminderte Ergänzungslast. Keine Verbesserung der
Materialzeit behauptet; das sind getrennte Einzelproben, keine stabile Verteilung.
Nach der Geometrieantwort brauchte das nutzbare Bild weitere 248 ms kalt,
129 ms nach Neustart und 713 ms fein. Die kalte nutzbare Übersicht liegt somit
bei etwa 3,89 s; das p95-Ziel von höchstens 2 s ist ausdrücklich nicht erreicht.

Alle Terrain-/Materialpuffer entsprechen der vollständigen Gegenreferenz.
Übersichtspuffer und kanonische Autorendaten sind gegenüber der ersten Field-Probe
identisch. Alle vier Screenshots (flache/geneigte Übersicht, warme Übersicht,
Feinraum) sind byteidentisch; die flache Übersicht wurde zusätzlich angesehen.
Der genaue Raumtreffer blieb korrekt. Keine erfassten Fehler, drei reguläre
Exit-0-Prozessenden mit verschwundenen PIDs. Dies prüft den isolierten neuen Kern
über die native Brücke, nicht die vollständige normale Atlasoberfläche.

## Abschließende lokale Prüfung

85 verschiedene gezielte Tests sind bestanden. Der
[82er-Lauf](regressions-82-initial.log.gz) bestand zunächst 81 Fälle; ein bestehender
Cachetest erwartete noch genau drei Projektionsstempel. Seine Erwartung wurde um
den neuen `landscape-field`-Stempel ergänzt. Der anschließende
[20er-Lauf](copy-cache-20.log.gz) besteht alle 17 Cachetests und drei neue Kopiertests.
Letztere prüfen 513 Zeilen, Rowids oberhalb von 2^53, einen parallelen kanonischen
WAL-Commit bei bereits gepinntem Snapshot und einen Fehler im zweiten Block mit
Rollback auch des ersten Blocks.

[TypeScript](check.log.gz), [Desktop-Typprüfung](check-desktop.log.gz),
[Desktopbuild](build-desktop.log.gz) und [Repositoryprüfung](check-repo.log.gz)
bestanden. Die tatsächlichen Testdateien sind in den bestehenden Geometrie- und
Terrainabläufen des Capability-Katalogs ergänzt und mit `--geprueft` vermerkt.

M2 bleibt offen: größere/kleinere Materialstufen der vollständigen Mischwelt,
weitere Objektklassen, aktive Speicher-/Dateibudgets und Gesamtlast sind noch
nicht abgenommen. Der nächste Roadmapschritt prüft Materialstufen, Nachladung,
lokale Elterninvalidierung und Restart gemeinsam. Keine Main-Integration,
Candidate-CI, Paketinstallation, Freigabe oder persönliche Nutzerabnahme behauptet.

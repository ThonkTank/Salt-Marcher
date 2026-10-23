# Atlas M2: bedarfsgerechte Geometrieindizes und Kaltstart

Stand: 24.10.2026. Isolierter M2-Kern auf Basis von `b2a88c746`;
Quell- und Buildhashes stehen im [nativen Ergebnis](native-result.json.gz).
Die normale Atlasfläche bleibt bis M7 beim bisherigen Renderer. Dies ist kein
Produktleistungs-, Zielgeräte- oder vollständiger M2-Abschluss.

## Befund und Änderung

Die feste M0-Welt enthält 15.701 Räume, 48.670 Zeichnungselemente und keine
`city_unit`-Gebäude. Die 4096-m-Übersicht modelliert 11.500 Räume. Bisher baute
jeder Geometrieauftrag auch den vollständigen Zeichnungsindex auf, obwohl die
neuen Meshes nur Räume und Gebäude darstellen.

Grobe und feine Meshaufträge synchronisieren jetzt einen eigenen
`geometry-core`-Teil. Vollständige Regions-, Fokus- und Trefferabfragen ergänzen
die Zeichnungselemente. Zwei begrenzte Änderungsjournale behalten aufgeschobene
Änderungen über Terrain- und Meshaufträge hinweg. Vollständige alte Indexcaches
bleiben verwendbar; ein Kernstempel kann niemals den vollständigen Index ersetzen.
Rollback sperrt beide Bereitschaftszustände. Kernansichten verwenden sichtbare
Raumgrenzen aller Geschosse unabhängig von veralteten Zeichnungsgrenzen.

Nicht modellierte Zeichnungen werden als **kampagnenweite Quellenzahl** gemeldet,
einschließlich archivierter oder ungeprüfter Zeilen. Das ist keine genaue
Ausschnittzählung und kein Nachweis intakter Zeichnungsquellen. Erst die
vollständige Abfrage validiert diese und meldet beschädigte Quellen separat.
Ein eigener Warnungscode erhält Hinweise auf andere fehlende Objektklassen;
geänderte Warnungszahlen allein bauen identische Meshes nicht erneut.

Der synchronisierte Landschaftsleser reicht außerdem seinen kanonischen
Meeresspiegel an die Höhenabtastung weiter, statt denselben SQL-Lookup für jeden
Anker zu wiederholen. Die physische 3×3-Abtastung über eine feste 1-m-Nachbarschaft
bleibt unverändert. Direkte Terrainleser behalten den SQL-Fallback.

## Messung auf derselben eingefrorenen Welt

Vorher: [qualifizierte Geometrieübersicht](../atlas-geometry-overview-20261024/README.md).
Nachher: nativer Lauf `1792795090165-1211644`, reale Preload/Main/Worker-Strecke,
zwei reguläre Prozessenden mit Exit 0 und nachweislich verschwundenen PIDs.

| Messabschnitt | Vorher | Nachher |
| --- | ---: | ---: |
| Erste Übersicht, Datenabfrage | 7.556,3 ms | 4.502,1 ms |
| Anschließend erste nutzbare Deck-Szene | 249,4 ms | 247,5 ms |
| Übersicht nach frischem Prozessstart, Datenabfrage | 400,7 ms | 319,7 ms |
| Erste Feinkachel nach Wiederöffnung, Datenabfrage | 635,1 ms | 487,2 ms |
| Anschließend erste nutzbare Feinszene | 780,7 ms | 782,3 ms |

Einzelproben auf dem Entwicklungsrechner, keine p95-Statistik. Die Datenzeit
beginnt nach Kampagnenaktivierung und Quellenabfrage; sie ist keine gesamte
Appstartzeit. Der warme Wert misst die Datenantwort, nicht den Szenenaufbau.
Der feine Ausschnitt wird separat angefordert; automatischer Zoom-/Werkzeugwechsel
ist damit noch nicht abgenommen.

Die Übersicht bleibt ein Mesh mit **979.272 Byte**, identischen Positions- und
Indexhashes zur vorherigen qualifizierten Version und nach Neustart. Der
Pixelvergleich zeigt dieselben Zwischenräume (14.114 belegte Pixel, 13,786 %
des Geometrie-Bounding-Rect). Die Feinansicht enthält 272 Räume; der native Treffer
ist exakt `mixed-house:0:1e7u1vv:room:103` auf 1703,051048 m.
Die geprüften kanonischen Tabellen behalten denselben Hash
`a8535021063ad35d0d15a9060102aea2a9aa0b1cb4769503722650fecf45a848`.
Keine Rendererfehler. [Übersicht](overview-flat.png), [Neigung](overview-tilt45.png),
[Feinansicht](fine-room.png) wurden visuell geprüft.

Der [Profiler](../../../tools/measure-atlas-geometry-cold.mjs) trennt Index und
Kachelaufbereitung in einer eigenen entpackten M0-Kopie ohne persistente Indizes.
[Vorher](profile-before.json.gz) / [nachher](profile-after.json.gz):

| Instrumentierter Abschnitt | Vorher | Nachher |
| --- | ---: | ---: |
| Indexsynchronisation | 4.104,7 ms | 1.663,0 ms |
| Kachelaufbereitung nach Index | 3.906,9 ms | 3.237,5 ms |
| SQL-Aufrufe Index / Kachel | 86.925 / 67.011 | 15.873 / 50.512 |
| 5.000 Höhenabfragen, inklusive Unterarbeit | 1.651,9 ms | 1.311,4 ms |
| Quellenbatches, inklusive Unterarbeit | 1.406,6 ms | 1.161,9 ms |

Inklusive Zeiten verschachtelter Aufrufe dürfen nicht addiert werden. SQL-Zeit
umfasst `.get/.all/.run`, nicht Iteratorlaufzeiten oder Statementvorbereitung.
Diese instrumentierten Werte sind keine zusätzlichen nativen Leistungsproben.

## Nacharbeit aus Gegenproben

Die erste Umsetzung beschleunigte nur die Übersicht; der erste Feinauftrag holte
den vollständigen Zeichnungsindex nach und stieg auf 2.601,1 ms. Dieser
[Zwischenstand](interim-detail-regression.json.gz) wurde deshalb durch die
bedarfsgerechte Kernabfrage auch für feine Raum-/Gebäudemeshes ersetzt.

Die erste [Testreihe](first-test-run.log.gz) fand eine doppelte Projektion eines
Elements, dessen eigener Änderungsvermerk und Raumankeränderung zusammentrafen.
Abhängige Aktualisierungen werden nun vor Ausführung zusammengeführt.
Die unabhängige Codeprüfung fand außerdem einen Warnungscode-Konflikt: Ein
Cachetreffer nach Umbenennung einer Stadtfläche konnte deren fehlende Darstellung
verschweigen. Getrennte Codes plus Regression erhalten beide Coverage-Aussagen.

## Prüfungen und offene Grenzen

**94 unterschiedliche gezielte Tests bestanden:** [93 Tests](tests.log.gz) in
`atlas-staged-geometry`, `terrain-grid-settings-cache`, `atlas-geometry-tiles`,
`atlas-geometry-overview-service`, `desktop-atlas-region-cache`,
`desktop-atlas-regions`, `atlas-deferred-geometry` und `atlas-geometry-mesh`;
anschließend die erweiterte Geometriekacheldatei mit [11 Tests](warning-regression-tests.log.gz),
darunter der neue Stadtwarnungsfall. Wiederholungen sind nicht doppelt gezählt.
Die abschließende Datei prüft auch die Warnungsaktualisierung ohne neuen Meshbau
für feine und grobe Kacheln. Typprüfungen für App und Desktop sowie Desktopbuild
bestanden. Gemeinsame Testassets wurden vorher vorbereitet.

Das 2-s-Ziel für die erste Übersicht bleibt offen. Der kalte Landschaftsindex
kostet instrumentiert weiter 1,13 s; Höhenabtastung und Quellenbatches je etwa
1,2–1,3 s. Die erste vollständige Legacyabfrage muss ausgelassene Zeichnungen
weiter aufbauen. Unveränderte persistente Teilindizes werden wiederverwendet,
aber die breite Geometrieversion kann bei reinen Zeichnungsänderungen nach einem
Neustart auch den Kernindex entwerten. Bindings/Bereichsmetadaten bleiben
kampagnenweit, andere Objektklassen, globale Indexbudgets und Materialreduktion
bleiben M2-Arbeit. Keine Integration, kein Release und keine Owner-Abnahme.

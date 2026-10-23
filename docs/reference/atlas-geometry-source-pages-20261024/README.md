# Atlas M2: gebündelte Quellen und kompakte Höhenanker

Stand: 24.10.2026, isolierter Kern auf Basis von `7d50ae8f8`.
Die normale Atlasfläche bleibt bis M7 beim bisherigen Renderer. Diese Prüfung
ist weder Produktleistungsnachweis noch vollständiger M2-Abschluss.

## Änderung und erhaltene Verträge

Übersichtsseiten verbinden höchstens 32 Kandidaten über Kampagne und ID mit
kanonischen Quellen. Raum-Polygone und vollständige Prüfsumme kommen gemeinsam;
versteckte Räume/Geschosse werden vor der Seitengrenze gefiltert. Damit entfallen
bei 11.500 sichtbaren Räumen jeweils separate Quellen-, Polygon- und
Sichtbarkeitsabfragen. Eine kurze letzte Seite braucht keine abschließende
Leerabfrage. LEFT JOIN erhält Fehler bei fehlenden Quellen; vollständige Seiten
besitzen ihre Daten, bevor der Worker seinen SQLite-Snapshot unterbricht.
Feine Quellenabfragen behalten ihre bisherige Sichtbarkeitsprüfung.

Physische Höhenanker verwenden weiterhin die feste 3×3-Abtastung mit denselben
Koordinaten, Quellenfiltern, Float32-Ergebnissen und Korruptionsprüfungen. Der
Umweg durch Anzeigenraster, Rasterkopien und Layout entfällt. Im bestehenden
16-MiB-Projektions-LRU bleibt nur ein skalarer Wert je Koordinate/Meeresspiegel.
Sein Invalidierungsbereich ist die volle 1,5×1,5-m-Abfragenachbarschaft;
Höhenblöcke und Anker teilen dasselbe Budget. Es entsteht kein zusätzlicher
unbegrenzter Cache. Quellenwechsel, Reset, lokale Änderungen und Meeresspiegel
behalten ihre bisherigen Invalidierungsregeln.

## Native Gegenprobe

[Ergebnis mit Quell-/Buildhashes](native-result.json.gz), Lauf
`1792796425339-1229173`, dieselbe eingefrorene M0-Welt und reale
Preload/Main/Worker-Strecke wie [zuvor](../atlas-geometry-cold-start-20261024/README.md).

| Messabschnitt | Vorher | Nachher |
| --- | ---: | ---: |
| Kalte Übersicht, Datenabfrage | 4.502,1 ms | 4.349,1 ms |
| Anschließende nutzbare Übersicht | 247,5 ms | 249,1 ms |
| Daten nach frischem Prozessstart | 319,7 ms | 323,3 ms |
| Erste Feinkachel nach Wiederöffnung | 487,2 ms | 518,0 ms |
| Anschließende nutzbare Feinszene | 782,3 ms | 788,9 ms |

Einzelproben auf dem Entwicklungsrechner, keine p95-Statistik. Der kleine kalte
Zeitgewinn ist kein Beleg für bessere Wiederöffnungs- oder Feinlatenz. Datenzeit
beginnt nach Aktivierung/Quellenabfrage, nicht beim gesamten Appstart. Der normale
Atlas-Einstieg und automatischer Werkzeug-/Zoomwechsel sind hier nicht geprüft.

[Exakter Baselinevergleich](baseline-comparison.txt): unveränderte Positionen und
Indizes, 11.500 modellierte Räume, ein Mesh mit 979.272 Byte, identische flache
Pixelbelegung und derselbe exakte Treffer auf Raum
`mixed-house:0:1e7u1vv:room:103` bei 1703,051048 m. Kanonische Tabellen behalten
ihren Hash. Keine Rendererfehler; beide Prozesse endeten regulär mit Exit 0 und
verschwundenen PIDs. [Flach](overview-flat.png), [geneigt](overview-tilt45.png) und
[Detail](fine-room.png) wurden visuell geprüft; die endgültigen Bilddateien sind
bytegleich mit den unmittelbar vorher gesichteten Zwischenstandsdateien.

## Zuordnung der Kosten

Der [Profiler](../../../tools/measure-atlas-geometry-cold.mjs) erfasst nun auch die
häufigsten SQL-Anweisungen. [Vorher](profile-before.json.gz) /
[nachher](profile-after.json.gz):

| Instrumentierter Abschnitt | Vorher | Nachher |
| --- | ---: | ---: |
| Indexsynchronisation | 1.801,6 ms | 1.732,3 ms |
| Kachelaufbereitung | 3.213,0 ms | 2.666,0 ms |
| SQL-Aufrufe während Kachelaufbereitung | 50.512 | 10.512 |
| Quellenbatches, inklusive Unterarbeit | 1.175,8 ms | 863,9 ms |
| 5.000 Höhenanker, inklusive Unterarbeit | 1.292,4 ms | 1.093,2 ms |

Verschachtelte Zeiten dürfen nicht addiert werden. SQL-Zählung umfasst
`.get/.all/.run`, nicht Iteratorlaufzeiten oder Statementvorbereitung. Der kalte
Landschaftsindex bleibt mit rund 1,16 s praktisch unverändert.

Der reproduzierbare [Höhenvergleich](../../../tools/measure-atlas-geometry-height.mjs)
verwendet alle 5.000 echten M0-Anker, alternierende Reihenfolge und getrennte
kalte/wiederholte Aufrufe. [Vier Runden](height-ab.json.gz): kalte Anker
904–928 → 787–818 ms; erneut dieselben Anker 56–78 → 7–12 ms. Alle Ergebnisse
sind exakt gleich. Das isoliert den Abfragepfad und ersetzt keine native Messung.

## Gegenproben und Nacharbeit

- `json_type` statt bloßer `json_extract`-Existenzprüfung ergab identische
  Metadaten, aber keine Beschleunigung: [Gegenprobe](metadata-counterprobe.log.gz).
  Keine entsprechende Produktänderung übernommen.
- Eine Einpunktabtastung lieferte zwar gleiche Werte für gültige Testdaten,
  übersah aber eine doppelte Höhenkachel bei einem Nachbarpunkt. Die ausführbare
  Gegenprobe bleibt in `atlas-geometry-point-sampling.test.mjs`; produktiv werden
  alle neun Punkte geprüft.
- Die [erste Quellen-Testreihe](first-tests.log.gz) fand eine fehlende
  Sichtbarkeitsprüfung im nicht gestreamten Detailpfad sowie eine falsch doppelt
  verwendete Testverbindung. Beides wurde korrigiert.
- Die Variante [ohne skalare Wiederverwendung](interim-uncached-native.json.gz)
  sparte zwar Rasterarbeit, hätte aber bei Quellenvalidierung bereits gelesene
  Anker neu berechnen müssen. Deshalb wurde sie durch den gemeinsamen skalaren
  Cache ersetzt. Ihre [A/B-Zeiten](interim-uncached-height-ab.json.gz) waren zudem
  uneinheitlich; sie begründen keine stabile Leistungsbehauptung.
- Vier benachbarte Feinkacheln ergaben gleiche Meshes in
  [Reihenfolge A/B](geometry-adjacent-ab.json.gz) und
  [B/A](geometry-adjacent-ba.json.gz). Sie teilten jedoch keine Anker und waren
  stark reihenfolgeabhängig; deshalb belegen sie gerade keine Wiederverwendung.
  Diese wird stattdessen durch den wiederholten 5.000-Anker-Vergleich und
  Invalidierungstests direkt geprüft.

## Prüfungen und offene Arbeit

[92 Quellen-/Regionsregressionen](source-tests.log.gz) bestanden nach der
Quellenbündelung. Am endgültigen Quellstand bestanden insgesamt **45 unterschiedliche gezielte
Tests**: die [21 gezielten Tests](final-targeted-tests.log.gz) sowie die anschließend erweiterte
[Same-Reader-Invalidierungsprobe](invalidation-tests.log.gz). Bestehende
[23 Terraincache-/Höhenblock-/Streamingregressionen](cache-regressions.log.gz),
[App-Typprüfung](check.log.gz), [Desktop-Typprüfung](check-desktop.log.gz),
[Desktopbuild](build-desktop.log.gz) und [Repositoryprüfung](check-repo.log.gz)
bestanden ebenfalls. Drei wiederholte Fälle der erweiterten Invalidierungsdatei
sind in den 45 Tests nicht doppelt gezählt. Die neuen Testdateien wurden im
[Capability-Katalog](capability.log.gz) verknüpft und die Prüfung vermerkt.

Das 2-s-Ziel bleibt offen. 32 Quellen pro Seite begrenzen keine Bytezahl;
übergroße Autoren-Payloads und kampagnenweite Binding-/Bereichsmetadaten bleiben
zusätzliche Arbeit. Die feste Welt enthält keine `city_unit`-Gebäude; deren
Semantik ist durch gezielte Tests, nicht durch diesen nativen Lastfall gedeckt.
Weitere Objektklassen, Material-LOD, Gesamtbudget einschließlich persistenter
Projektionsindizes und vollständige Welt-/Werkzeuglast bleiben M2–M8-Arbeit.
Keine Main-Integration, Veröffentlichung oder Produktabnahme in diesem Schritt.

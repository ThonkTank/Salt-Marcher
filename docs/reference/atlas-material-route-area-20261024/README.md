# M2: konvergierende physische Trassenintervalle

24.10.2026, Ausgangs-HEAD `27ca4f94b`, nach der zweiten unabhängigen Bereinigung.
Lokaler isolierter Atlasprototyp; keine Änderung des normalen Produktpfads,
keine neue native Abnahme, keine Main-Integration oder Veröffentlichung.

## Befund und Entscheidung

Der vorherige Feldanschluss erklärte den gesamten Planungskorridor einer
physischen Trasse für unbestimmt. Selbst ein eindeutiger Flusskern konnte damit
nicht innerhalb des Flächenbudgets abgeschlossen werden. Die große Planungsbox
war als Übergangsschutz korrekt, aber kein konvergierender Auswertungsansatz.

Der neue [Trassenintervallkern](../../../tools/atlas-prototypes/route-field-interval.ts)
verwendet dieselben Indexzellen und möglichen nächsten Segmente wie
`RouteSurface`. Er umschließt Höhenprofil, Abtrag/Auftrag, Böschungen,
Quellenverjüngung, Bauwerke und die gewichtete Kreuzungsrechnung. Eindeutige
Teilflächen werden damit wieder entscheidbar. Bei großer Abfrage oder
numerisch nicht abgedeckten Größen bleibt das Ergebnis ausdrücklich unbekannt.

Eine zweite Gegenprobe zeigte einen verbleibenden Abhängigkeitsverlust: Bei
nur einer Route wurden gewichteter Zähler und Nenner unabhängig eingeschlossen.
Der wasserführende Straßeneinschnitt benötigte dadurch fast zehn Sekunden für
ein Flächenpixel. Die zusätzliche Ein-Trassen-Hülle erhält den gemeinsamen
Gewichtsfaktor; sie berücksichtigt ausdrücklich die Rundung der ursprünglichen
Rechnung. [Herleitung und unabhängiger Review](roundoff.md) dokumentieren die
Grenzen. Kein neuer Interpolator, keine Änderung gespeicherter Trassen.

## Implementierte Semantik

- Indexgröße, Padding, Reihenfolge und Station entsprechen der kanonischen
  Punktabfrage. Gleich weit entfernte Segmente bleiben als Möglichkeiten erhalten;
  unterschiedliche Profile oder Bauwerke werden nicht vorschnell gleichgesetzt.
- Eindeutige Projektionen innerhalb eines Segments erhalten eine zusätzliche
  senkrechte Abstandshülle. Dadurch wird ein Punkt nicht als unabhängig von
  seiner eigenen Projektion behandelt.
- Wasser wird vor Brücke/Tunnel bestimmt, entsprechend der Referenz.
  Straße/Furt und Flussbett beachten die tatsächlichen Abtrag-/Auftragsgrenzen.
  Die effektive Höhe entscheidet weiterhin auch über Meer- und Seewasser.
- Der [physische Feldanschluss](../../../tools/atlas-prototypes/physical-material-field.ts)
  vereinigt Trassen-, Meer- und Seewasser und ergänzt Schnitte an Indexzellen.
  Außerhalb eines tatsächlichen Einflusses bleibt die kanonische Basishöhe.
- Die positive gewichtete Komposition erhält eine gepolsterte Bewegungshülle.
  Ein möglicher Nullnenner bedeutet deshalb weder unverändertes Gelände noch
  automatisch unbeschränkte Höhe. Die Ein-Trassen-Hülle vermeidet zusätzlich
  den gemessenen Quotientenengpass.

## Getrennte Kostenvergleiche

Beide Messreihen verwenden je drei sequenzielle Runden mit abwechselnder
Reihenfolge, analytisch bekannten Wasserflächen und unveränderten Grenzen:
2.000.000 instrumentierte Arbeitseinheiten, 65.536 offene Dreiecke und 1/255
Kanalfehler. Arbeit zählt Integratoroperationen, nicht sämtliche internen
Gleitkommaoperationen. Während der Messung liefen keine Tests oder Builds;
Quellhashes wurden davor und danach geprüft.

[Erster Vergleich](initial-comparison.json.gz): Die alte unbekannte Trassenhülle
brach in allen zwölf Läufen am Dreiecksbudget ab. Die erste neue Fassung bestand
alle zwölf Läufe: Flussband, Kreuzung, Straßeneinschnitt jeweils als ein Pixel,
sowie ein Flussband als volle 256×256-Kachel. Deren Wasseranteile sind 1/4,
7/16, 3/8 und 1/4. Der Straßeneinschnitt brauchte dennoch im Median 9.706 ms.
Budgetabbrüche werden nicht als schnellere erfolgreiche Ergebnisse gezählt.

[Zweiter Vergleich](comparison.json.gz): erste konvergierende Fassung gegen
abschließende Fassung mit erhaltener Ein-Trassen-Abhängigkeit. Alle Proben
bestehen jeweils 3/3 Läufe.

| Probe | Median vorher → nachher | Arbeit vorher → nachher |
| --- | ---: | ---: |
| Flussband, 1 Pixel | 430 → 539 ms | 64.349 → 64.349 |
| Flusskreuzung, 1 Pixel | 749 → 729 ms | 74.073 → 74.073 |
| Wasserführender Straßeneinschnitt, 1 Pixel | 9.678 → 713 ms | 1.301.353 → 89.085 |
| Flussband, 256×256 | 7.137 → 7.302 ms | 1.261.928 → 1.261.928 |

Der belegte Beschleunigungsgewinn liegt beim Straßeneinschnitt. Bei den anderen
Proben bleibt die Arbeitszahl gleich; die zusätzliche Rechnung kann Laufzeit
kosten. Insbesondere 7,30 Sekunden für eine volle synthetische Flusskachel
reichen nicht für unmittelbare Bearbeitung. Keine native Produktzeit und keine
vollständige Weltlastabnahme.

## Tests und Reproduktion

71 unterschiedliche Fälle sind geprüft: [gemeinsamer Lauf mit 69 Tests](initial-tests.log.gz),
[zwei ergänzte Randfälle im 11-Fälle-Trassenlauf](route-tests.log.gz) und
[erneuter Lauf aller 20 betroffenen Intervall-/Flächenfälle](final-area-tests.log.gz)
nach der letzten Formeländerung. Alle bestanden. Enthalten sind bestehende
Höhen-/Stream-/Trassenprüfungen einschließlich Speicher-, Revisions- und
Undo/Redo-Verhalten sowie dichte Vergleiche mit `RouteSurface`.

Neue Gegenproben behandeln feste/variable Basishöhen, Bauwerke, Quellenfade,
Kreuzungen, tatsächliche nächste Segmentgleichstände, Nullsegmente, negative
und entfernte Koordinaten, Zellgrenzen, schrumpfende Abfragen und explizite
Unsicherheit oberhalb des Abfragebudgets. Drei analytische Flächenfälle prüfen
Flussband, Kreuzung und wasserführenden Einschnitt. Die Punktfunktion selbst
bleibt beim kanonischen Besitzer.

Strict-TypeScript für den betroffenen Prototypanschluss, JavaScript-Syntax und
Repositoryprüfung bestanden. Die native Bereinigungsqualifikation gehört zu
ihrem separaten Bericht; sie wird hier nicht als neue Atlasprüfung gezählt.

```sh
node --test --test-concurrency=1 tests/atlas-material-route-interval.test.mjs tests/atlas-material-physical-area.test.mjs tests/atlas-material-height-interval.test.mjs tests/atlas-material-physical-field.test.mjs tests/terrain-field-stream.test.mjs tests/terrain-height.test.mjs tests/terrain-route.test.mjs
node tools/measure-atlas-route-area.mjs
```

Für Vergleiche die archivierte Referenz separat unter `.build/` entpacken und
als erstes Argument übergeben:
[ursprüngliche unbekannte Hülle](reference-unknown.cjs.gz),
[erste Fassung mit unabhängigen Gewichten](reference-independent-weights.cjs.gz).
Die Bundlehashes stimmen mit den gespeicherten Vergleichsdaten überein.

## Offene Grenzen

Masken, Fels/Schnee, vollständige reale Weltlast und der produktive Materialpfad
sind weiterhin offen. Der zusätzliche Intervallindex ist separat auf 300.000
Referenzen begrenzt; das Quellenbytebudget ist keine vollständige Heapmessung
beider Indizes oder der aktiven Flächenarbeit. Echte Segment-/Strukturwechsel
können unstetig sein; dort muss die Hülle beide Seiten erhalten.
Die weiteren Schritte stehen im
[aktuellen Roadmapabschnitt](../../plans/maps/unified-spatial-atlas.md#aktueller-arbeitsstand).

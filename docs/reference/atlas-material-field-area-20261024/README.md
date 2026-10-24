# M2: physische Materialflächen mit engeren Höhenintervallen

Planprüfung und isolierter Prototypschritt auf `11c16c912`, 24.10.2026.
Der normale Atlas wurde nicht umgestellt. M2 bleibt offen; native
Produktbeschleunigung, Main-Integration und Veröffentlichung sind nicht belegt.

## Befund und Ersatzentscheidung

Die kanonische Punktabfrage lässt sich mit konservativen Höhen-/Wasserintervallen
an die Flächenintegration anschließen. Die erste Umsetzung überschätzt aber die
Unsicherheit: Sie behandelt identische Zeilenausdrücke unabhängig und verliert
bei zweidimensionalen Nullhöhenkanten den Abstand zu den Endpunkten.
Schmale Inseln, Sattelgelände und volle Küstenkacheln scheiterten dadurch an
unveränderten Arbeitsgrenzen. [Fehlgeschlagene Sattelprobe](initial-failure.log.gz)
und zwei getrennte Vergleichsstufen halten diesen Befund fest.

Die schwache Annahme „allgemeine Operationsintervalle plus mehr Dreiecke reichen“
ist ersetzt durch **quellenabhängige, formtreue Intervallhüllen mit gezielten
Schnitten**. Der adaptive Flächenintegrator und seine Fehlergrenzen bleiben.
Die Entscheidung ist auf diesen Engpass begrenzt; M0–M8 und die geplanten
Produktkomponenten bleiben unverändert.

| Tragfähiger Ansatz | Kartenqualität | Reaktion | Bearbeitbarkeit | Wartbarkeit | Umstellungsrisiko |
| --- | --- | --- | --- | --- | --- |
| Quellenabhängige Hermite-Hüllen und gezielte Schnitte (gewählt) | Kanonische Höhen und kontrollierter Flächenfehler; kleine Inseln erhalten | Weniger unnötige Verfeinerungen; volle Küste jetzt berechenbar, aber noch langsam | Dieselben Autorenquellen und Revisionen | Kleine zusätzliche numerische Schicht; Rundungsherleitung nötig | Isoliert prüfbar; noch kein Produktionswechsel |
| Explizite adaptive Küstenkonturen mit Intervallprüfung jeder Quellzelle | Hohe geometrische Qualität, wenn Inneninseln und Sattelpunkte vollständig isoliert werden | Wiederverwendbare Konturen könnten viele Pixel entlasten | Jede Höhenänderung muss betroffene Konturen invalidieren | Zusätzlicher Kontur-/Topologiebesitzer und Grenzfälle | Größerer Umbau; gemeinsamer Umgang mit Seen und Trassen nötig |
| Progressive Mehrfachabtastung mit konservativer Fehlerkontrolle | Kontrollierbar nur mit zusätzlicher Intervallprüfung; festes Raster allein verliert Inseln | GPU kann Proben bündeln, schwierige Randzellen bleiben adaptiv teuer | Gute lokale Aktualisierbarkeit | Parallelpfad und GPU-/CPU-Gleichheit zu pflegen | Für späteren GPU-Pfad tragfähig, löst die aktuelle zu breite Hülle allein nicht |

## Implementiertes Verhalten

- Der neue [Höhenintervallkern](../../../tools/atlas-prototypes/height-field-interval.ts)
  folgt der kanonischen x-dann-y-Hermite-Auswertung, NaN-Vererbung und additiven
  Reihenfolge. Identische Quellzeilen teilen denselben Ausdruck. Unterschiedliche
  Zeilen werden nicht aufgrund zufällig gleicher Intervallgrenzen gleichgesetzt.
- Die zusätzliche gewichtete Hülle erhält den Abstand zu Nullhöhenkanten.
  [Herleitung und Rundungsgrenzen](roundoff.md) enthalten den bewusst großzügigen
  Aufschlag für normale und subnormale Rechnungen. Ein unabhängiger Review
  bestätigte Gewichtung und Fehlerfortpflanzung; kein maschinenverifizierter Beweis.
- Quellenzellen und anschließend Achsenschnitte mit nachweisbar weniger
  unbestimmten Wasserhälften steuern die Verfeinerung. Ein Schnitt ist nur eine
  Arbeitsreihenfolge; jedes Kind erhält wieder seine normalen Fehlergrenzen.
- Der [Materialadapter](../../../tools/atlas-prototypes/physical-material-layers.mjs)
  verbindet physisches Wasser mit Grundfarbe, Bewuchs, Pigment und Radieren.
  Die ersten 14 Kanäle behalten ihre Bedeutung, Kanal 15 enthält den Wasseranteil.
  Land-/Wasserziele und Autorenreihenfolge bleiben erhalten.
- Seen mit Löchern und Höhenfreigabe werden konservativ eingeschlossen.
  Physische Trassen bleiben ausdrücklich unbekannt; die Regression verlangt
  einen sichtbaren Budgetabbruch statt einer falschen Grundgelände-Zertifizierung.
  Zu große oder nicht sicher repräsentierbare Quellindizes werden ebenfalls
  unbekannt, statt unbeschränkt weiterzuzählen.

## Gegenproben und Kosten

[Erster Vergleich](initial-comparison.json.gz): Nur das Teilen identischer
Zeilenausdrücke machte die schmale Insel in drei von drei Runden berechenbar
(Median 150 ms statt Dreiecksbudgetabbruch). Eine volle Küstenkachel scheiterte
weiterhin; die zweidimensionale Sattelprobe widerlegte die ausreichende
Allgemeinheit dieses ersten Fixes.

[Abschließender Vergleich](comparison.json.gz): drei sequenzielle Runden mit
abwechselnder Reihenfolge. Die Referenz enthält bereits die geteilten Zeilen;
neu sind die engeren gewichteten Hüllen, numerische Absicherung und gerichteten
Schnitte. Alle Quellhashes wurden vor und nach der Messung verglichen. Kein
paralleler Test-/Buildlauf während der Messung.

| Probe | Referenz vollständig | Neuer Ansatz vollständig | Median vorher → nachher | Arbeit vorher → nachher |
| --- | ---: | ---: | ---: | ---: |
| Gerade Küste, 1 Pixel | 3/3 | 3/3 | 96 → 42 ms | 13.269 → 2.749 |
| Schmale Insel, 1 Pixel | 3/3 | 3/3 | 144 → 123 ms | 22.689 → 13.827 |
| Zweidimensionaler Sattel, 1 Pixel | 0/3 | 3/3 | Budgetabbruch → 329 ms | Abbruch bei 779.276 → 18.889 |
| Küste mit Bewuchs/Pigment, 16×16 | 3/3 | 3/3 | 978 → 268 ms | 307.304 → 40.072 |
| Konstantes Land, 256×256 | 3/3 | 3/3 | 1.404 → 1.393 ms | 594.280 → 594.280 |
| Gerade Küste, 256×256 | 0/3 | 3/3 | Budgetabbruch → 4.523 ms | Abbruch bei 2.000.001 → 928.104 |

Arbeit bezeichnet die Instrumentierung des Integrators, nicht jede interne
Gleitkommaoperation oder eine absolute CPU-Zeitgrenze. Unverändert bleiben
2.000.000 Arbeitseinheiten, 65.536 offene Dreiecke und 1/255 Kanalfehler
(bei der schmalen Insel 1/1024). Die analytischen Wasserflächen liegen jeweils
innerhalb der ausgegebenen Fehlergrenzen. Die nahezu gleiche Laufzeit auf
konstantem Land ist kein belastbarer Gewinn; die Arbeitszahl ist identisch.
4,52 Sekunden für eine volle synthetische Küstenkachel sind weiterhin zu langsam
für unmittelbare Bearbeitung. Die Zahlen sind keine nativen Produktzeiten.

## Prüfungen und Reproduktion

[46 gezielte Tests](tests.log.gz) bestanden: neun neue Höhenintervallprüfungen,
sieben physische Flächen-/Kompositionsprüfungen sowie 30 bestehende Feld-,
Höhen- und Streamprüfungen. Alle 15 Kanäle werden an einer analytischen
Land-/Wasser-Pigmentprobe geprüft; weitere Punktvergleiche decken weichen
Bewuchs, alte Stempel, Version-2-Pigment und Radieren ab. Strict-TypeScript,
JavaScript-Syntax und Repositoryprüfung bestanden. Keine neue native Prüfung,
da der Produktpfad unverändert ist.

```sh
node --test --test-concurrency=1 tests/atlas-material-height-interval.test.mjs tests/atlas-material-physical-area.test.mjs tests/atlas-material-physical-field.test.mjs tests/terrain-field-stream.test.mjs tests/terrain-height.test.mjs
node tools/measure-atlas-physical-area.mjs
```

Für den Vorher-/Nachhervergleich
[reference-shared-rows.cjs.gz](reference-shared-rows.cjs.gz) in eine separate
Datei unter `.build/` entpacken und deren Pfad als erstes Argument an das
Messwerkzeug übergeben. Die früheste Referenz liegt separat als
[reference-independent.cjs.gz](reference-independent.cjs.gz) vor.
Die Referenz-Bundlehashes stimmen mit den archivierten Messergebnissen überein.

## Verbleibende Grenzen

Bestätigt: physische Wasserentscheidung und Autorenkomposition lassen sich
fehlerbegrenzt integrieren; abhängigkeitstreue Hüllen sparen viel Arbeit.
Widerlegt: der erste Insel-Fix oder allgemeine Operationsintervalle reichen
für zweidimensionale Küsten und volle Kacheln aus.

Offen bleiben konvergierende Trassenintervalle, Masken, Fels/Schnee, vollständige
Weltlast und aktive Quellen-/Arbeitsspeicherbudgets. Die eingefrorene M0-Welt
enthält keine physischen Trassen, Seen oder Pigmente und ersetzt deren
Zusatzproben nicht. Die nächste Arbeit steht ausschließlich im
[aktuellen Arbeitsabschnitt der Roadmap](../../plans/maps/unified-spatial-atlas.md#aktueller-arbeitsstand).

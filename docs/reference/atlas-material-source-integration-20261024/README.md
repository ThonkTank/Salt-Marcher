# Quellenbewusste Integration von Pigmentkacheln

M2-Zwischenschritt auf `7aa1439c7`, 24.10.2026.
[Aktuelle Roadmap](../../plans/maps/unified-spatial-atlas.md).
Isolierter Prototyp; normales Atlasbild, gespeicherte Pinselzüge und produktive
Kachelversion bleiben unverändert.

## Entscheidung

Die [vorherige Quellenprobe](../atlas-material-v2-20261024/README.md) scheiterte
bei 256×256 für alle drei Spitzen. Die Punktintervalle waren gültig, aber teuer:
Sie behandeln die räumliche Schwankung glatter Pinselkerne wie einen möglichen
Fehler des Flächenmittels. Nicht ausgerichtete Texturgrenzen verschärfen das.

| Ansatz | Kartenqualität | Reaktion | Bearbeitbarkeit | Wartbarkeit | Umstellungsrisiko |
| --- | --- | --- | --- | --- | --- |
| Punktintervalle weiter verfeinern | Bisherige konservative Zellschranke | Volle Probe überschreitet Budgets | Autorenfolge erhalten | Einfacher Referenzweg | Niedrig, Ressourcenproblem bleibt |
| **Quellenschnitte und glatte Näherung mit Quellenfehler** | Gleiches 1/255-Zellziel; Float32-/Byte-Abweichung ausdrücklich eingerechnet | Weiche und strukturierte volle Probe jetzt berechenbar | Quellen bleiben erhalten, Ableitung austauschbar | Explizite Werte-, Ableitungs- und Fehlerschranken | Mittel; Komposition, Grenzstreifen und Budgetabbruch separat geprüft |
| Festes dichteres Abtastraster | Kleine Flächen/Texturgrenzen können trotz vieler Proben verloren gehen | Potenziell schneller, ohne zertifiziertes Ziel | Quellen bleiben erhalten | Einfacher Rasterkern | Hoch für Maßstabswechsel; kein belegter Ersatz |

## Umgesetzter Vertrag

[material-area.mjs](../../../tools/atlas-prototypes/material-area.mjs) nimmt
bekannte Achsenschnitte aus aktiven Quellen nur bei notwendiger Verfeinerung an.
Beide Seiten werden vollständig trianguliert. Ein Schnitt, der die vorhandene
Flächenprüfung numerisch nicht besteht, wird verworfen; das ursprüngliche Dreieck
bleibt für die bisherige Verfeinerung erhalten. Es wird keine Fläche weggelassen.
Arbeits- und Warteschlangenbudgets gelten weiter; eine zusätzliche Begrenzung von
64 Quellenschnitten je Pfad verhindert unbeschränkte Rekursion. Die bisherige
adaptive Tiefe 16 zählt weiterhin die eigentlichen Mittelpunktverfeinerungen.
Budgetfehler enthalten jetzt eine Momentaufnahme der tatsächlichen Arbeitszähler.

Der [Pigmenthelfer](../../../tools/atlas-prototypes/pigment-stroke.mjs) trennt
Texturgrenzen mit stabilen unteren/oberen Schnitten. Der kleine Rundungsstreifen
bleibt unsicher und erhält weiter die volle Intervallschranke. Schnitte direkt
neben einem Gleitkommawert genügten in der Gegenprobe nicht: Welt-/Kachelumrechnung
ließ sie zusammenfallen oder wiederholt anfordern. Die endgültigen Grenzen
besitzen einen vom jeweiligen Texturübergang abhängigen Rundungsabstand und einen
Innenabstand zu bereits vorhandenen Dreieckskanten. Unterhalb dieser Auflösung
bleibt der Intervallweg zuständig; Texturen werden weder geglättet noch ersetzt.

Für weiche und innerhalb einer Texturzelle strukturierte Stempel gilt mit
`k = max(0, 1-d²/r²)²`: Der Kern ist C1 auch am Kreisrand,
`|∇k| ≤ 8/(3√3 r)` und `||Hk|| ≤ 8/r²`.
Überlagerte Stempel werden mit dem vorhandenen Source-over-Produkt zusammengesetzt;
dabei enthält die Hesse-Schranke die Kreuzterme der Gradienten. Unbekannte
Texturzellen und nicht konstante Rundstempel erhalten keine glatte Bescheinigung.

Die kontinuierliche Näherung verändert die gespeicherte Quelle nicht. Ihr
punktweiser Deckkraftfehler enthält pro relevantem Stempel höchstens `2^-25`
für Float32-Rundung, zusätzlich `1/510` für die abschließende Byte-Rundung und
die Record-Deckkraft als Faktor. Separate Zuschläge berücksichtigen binäre
Rechen- sowie koordinatenabhängige Abweichungen. Zu große/ungeeignete Schranken
werden nicht bevorzugt; der Intervallweg bleibt verfügbar.

[material-smooth.mjs](../../../tools/atlas-prototypes/material-smooth.mjs)
führt Werte, Gradienten-, Hesse- und Quellenfehler pro Kanal durch die tatsächliche
Layerfolge. Für einen Blend `z=x(1-a)+ya` gilt konservativ
`Gz≤Gx+Gy+Ga`, `Hz≤Hx+Hy+Ha+2(Gx+Gy)Ga`.
Quellenfehler werden über den lokalen Alpha-Bereich gewichtet und um den neuen
Alpha-Fehler ergänzt. Damit wird die halbe Byte-Stufe nicht fälschlich als
Fehlergarantie für eine beliebig lange ganze Recordfolge ausgegeben.

Die privaten Pigmentkanäle 5–7 enthalten jetzt **vormultiplizierte RGB-Werte**.
Auftragen und Radieren sind dadurch ohne singuläre RGB-Division bei Alpha null
darstellbar. Die sichtbaren finalen RGB-Kanäle sind algebraisch gleich der bisherigen
Floatkomposition. Es ist keine Änderung eines gespeicherten oder produktiven
Ausgabeformats. Bestehende Produktions- und Kompositionstests prüfen die finalen
Kanäle; neue Quellenorakel verwenden für Zwischenkanäle ausdrücklich das neue Format.

Ein alternativer Dreiecksschätzer bietet einen Mittelwert mit
`max(Kanal-Quellenfehler + H·Summe(|Ecke-Schwerpunkt|²)/24 + Koordinatenzuschlag)`
an. Der Integrator übernimmt ihn nur bei kleinerer gültiger Fehlerschranke.
Die gemeinsame Zellfehlersumme bleibt maßgeblich. Die Analyse ist keine vollständige
Maschinen- oder Polygon-Clippingfehlerzertifizierung.

## Belege und Nacharbeit

[102 gezielte Prüfungen](tests-102.log.gz) bestehen. Die vorherigen 77 Prüfungen
bleiben enthalten; hinzu kommen:

- [Quellenschnitte](../../../tests/atlas-material-source-cuts.test.mjs):
  nicht binär ausgerichtete Sprünge, mehrere Achsen, kleine Flächen, ungültige
  Rückgaben, Ressourcenlimits und konservativer Rückfall bei numerisch unsicherem Schnitt.
- [Alternative Schätzwerte](../../../tests/atlas-material-triangle-estimate.test.mjs):
  analytisches Integral, Ersatz des Schätzwerts statt nur seiner Schranke,
  Verwerfen schlechterer/ungültiger Kandidaten und Neuberechnung nach Schnitten.
- [Texturgrenzen](../../../tests/atlas-material-texture-cuts.test.mjs):
  negative/große Koordinaten, unveränderte Seeds, unsichere Grenzstreifen und
  tatsächliche P-/Alpha-/finale RGB-Werte gegen dichte Quellenabtastung.
- [Zustandskomposition](../../../tests/atlas-material-smooth-state.test.mjs):
  Auftragen, Radieren, Bewuchs, Legacy-Deckkraft und gewichtete Quellenfehler.
- [Glatte Quellen und vollständige Kacheln](../../../tests/atlas-material-smooth-source.test.mjs):
  überlagerte Stempel, abgelehnte falsche Glattheit, komponierte Gegenprobe,
  analytische weiche Kreisfläche mit Quantisierungszuschlag sowie strukturierte
  Kachel gegen 1024²/2048² Quellenabtastung. Die Rastergegenprobe ist numerische
  Evidenz, kein formaler Beweis ihres eigenen Integrationsfehlers.

Die unabhängige Ableitungsprüfung bestätigte nach Rückprüfung die Quartik-,
Source-over- und radialen Bewuchsschranken. Sie identifizierte den nötigen
Koordinatenzuschlag. Ein versuchsweise engerer Punkt-Dreiecksabstand brachte die
runde Vollkachel weiterhin nicht ins Budget und wurde nicht übernommen.
Die Ressourcenbehauptung folgt aus den vollständigen Läufen, nicht aus den
Testverknüpfungen im aktualisierten Capability-Katalog.

## Kostenprobe und offene Arbeit

[Messwerkzeug](../../../tools/measure-atlas-material-source-integration.mjs),
[drei wechselnde Vergleichsrunden](comparison.json.gz): dieselbe 4×4-m-Quelle
mit Radius 1 m, 1/255 Zellfehler, identische bisherigen Arbeits-/Warteschlangenlimits.
`Referenz` deaktiviert Quellenschnitte und alternative Schätzwerte im aktuellen
Code. Die historischen Ausgangszahlen bleiben im vorherigen Bericht erhalten.
Andere Tests liefen während der abschließenden Messreihe nicht parallel.

| Pixel | Spitze | Referenz (Median; fertig) | Quellenintegration (Median; fertig) | Arbeit neu |
| --- | --- | --- | --- | --- |
| 1×1 | round | 50 ms; 3/3 | 62 ms; 3/3 | 30404 |
| 1×1 | soft | 132 ms; 3/3 | 7 ms; 3/3 | 2428 |
| 1×1 | textured | 956 ms; 0/3 | 1382 ms; 3/3 | 762703 |
| 16×16 | round | 420 ms; 3/3 | 497 ms; 3/3 | 295734 |
| 16×16 | soft | 4023 ms; 3/3 | 58 ms; 3/3 | 13222 |
| 16×16 | textured | 3981 ms; 0/3 | 583 ms; 3/3 | 347925 |
| 256×256 | round | 3050 ms; 0/3 | 2968 ms; 0/3 | Budgetabbruch |
| 256×256 | soft | 3784 ms; 0/3 | 846 ms; 3/3 | 644086 |
| 256×256 | textured | 3294 ms; 0/3 | 2512 ms; 3/3 | 1622625 |

Weiche und strukturierte Quellen sind damit unter den geprüften synthetischen
Budgets berechenbar. Runde Kreisgrenzen bleiben offen. Als Nächstes benötigen sie
eine stärkere Flächenmittel-Schranke, die die Überlappung mehrerer Rundstempel und
ihre Deckkraftfolge berücksichtigt; einzelne Kreisflächen dürfen nicht einfach
addiert werden. Anschließend folgen gemischte Quellen und reale Weltlast vor
Feld-/Quellenseitenanschluss und produktiver Cacheumstellung. Keine Aussage über
native Reaktion, kalte Übersicht unter zwei Sekunden, Main-Integration oder Release.

Syntaxprüfungen, `git diff --check` und [Repositoryprüfung](check-repo.log.gz)
bestehen. M2 und das Gesamtziel bleiben offen.

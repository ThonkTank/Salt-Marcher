# M2: vollständige Quelleninventur und physischer Feldanschluss

Isolierter Prototypschritt auf `c0f74d576`, 24.10.2026. Keine Umstellung des
normalen Atlas, keine native Abnahme und kein gemessener Produktgewinn.

## Befund und Entscheidung

Die eingefrorene M0-Welt wurde vollständig und unverändert inventarisiert:
108.076 Landschaftsdatensätze, Datenbank-SHA-256
`19d4edc88b50d8074578a5c40c870a50331fec1c78a7a8b4f4feee5d463fdb12` vor und nach
dem Lesen gleich. [Inventur](inventory.json.gz) enthält getrennte kanonische
Quellenkategorien, semantische Rollen, Flags, Beispiele und Integritätsprüfungen.

| Rolle | Anzahl |
| --- | ---: |
| Höhenfeld | 1.028 (1.024 Version 1, vier additive Version 2) |
| Bewuchsfläche | 1.024 |
| Straße ohne physische Trasse | 1.024 |
| Ort | 5.000 |
| Reine Metadatenfläche (`propertyOnly`) | 100.000 |

Die Metadatenflächen fallen in der SQL-Kategorisierung unter `base`, sind aber
keine visuelle Grundfarbe. Pigment, physische Trassen, Seen, Masken und
Geländeeinstellungen kommen in dieser Welt nicht vor. Sie kann deshalb keine
vollständige Materialarten-Abnahme ersetzen. Quellen- und Rollensummen stimmen
jeweils unabhängig mit der Datensatzanzahl überein; keine gefundenen ungültigen
JSON-/Geometriestrukturen oder nichtendlichen Koordinaten. Das ist eine Inventur,
keine vollständige fachliche Datenvalidierung.

Der neue [Feldanschluss](../../../tools/atlas-prototypes/physical-material-field.ts)
übernimmt begrenzte, kopierte Quellen aus dem kanonischen `TerrainStream` und
verwendet `TerrainSampler` für Höhen und Wasser. Kein neues Interpolationsmodell:
Die vorhandene formtreue Hermite-Interpolation, sparse Vererbung, additive Bänder,
Trassen und Seeaussparungen bleiben maßgeblich. Der Leser muss vollständige
`heightInfluenceBounds` berücksichtigen; der Anschluss fordert ausdrücklich
keinen Filter auf Rastermittelpunkte an. Gezeichnete Wasserpolygone ersetzen den
physischen Feldpfad nicht.

Zwei Gegenproben begründen diese Entscheidung:

- Eine Hermite-Höhe von 3,75 m ist bei Meeresspiegel 4,6 m Wasser. Die bilineare
  Ersatzhöhe von 5 m wäre Land. Der äußere Nachbarknoten gehört zur Berechnung,
  obwohl seine Autorenkontur den Abfragebereich nicht berührt.
- Eine interpolierte Höhe knapp oberhalb des Meeresspiegels rundet in Float32
  auf den Meeresspiegel. Die Wasserentscheidung muss vorher erfolgen.

Die unabhängige Prüfung fand außerdem den zunächst fehlenden expliziten
Einstellungsanschluss. Korrigiert: Kampagneneinstellungen sind Pflichtparameter;
`readTerrainSettings` liefert auch den kanonischen Standard für eine Kampagne
ohne Einstellungsdatensatz. Ein SQLite-Test prüft getrennte Kampagnen mit 123 m
und −456 m Meeresspiegel. Der Snapshot friert keine Objekte des Aufrufers ein.

## Prüfung

[30 gezielte Tests](tests.log.gz) bestanden: neun neue Feldanschlussprüfungen und
21 bestehende Höhen-/Streamprüfungen. Enthalten sind negative Koordinaten,
Kachelränder, sparse Vererbung, additive Höhen, Flusskreuzungen, Seen mit Löchern,
Quellenkopie, explizite Budgetabbrüche und geschlossene Iteratoren bei Fehlern.
Standalone-Strict-TypeScript-Prüfung und Repositoryprüfung bestanden.

[Probe mit der eingefrorenen Welt](physical-probe.json.gz): vier Ausschnitte,
je 1.089 Punkte, Vergleich mit `streamTerrainField`:

| Ausschnitt | Höhenquellen | Berechnete Wasserpunkte | Belastete Quellenbytes |
| --- | ---: | ---: | ---: |
| Ursprung | 8 | 0 | 308.751 |
| Autorenkachelgrenze | 6 | 0 | 231.629 |
| Entfernter Ausschnitt | 1 | 0 | 38.850 |
| Küste am Rand der Autorenwelt | 2 | 891 | 77.405 |

Alle 4.356 Punkte stimmen bei Wasser und nach Float32-Ausgabe bei der Höhe
exakt überein. Die Weltabfrage mit absichtlich auf 1 MiB gesenktem Quellenbudget
bricht ausdrücklich ab, statt Quellen still wegzulassen. Die Belastung zählt
serialisierte Quellen einschließlich Einstellungen plus dekodierte Höhenbytes;
sie ist keine Messung des gesamten JS-Heaps oder des Trassenindex. Der bestehende
Trassenindex besitzt eine eigene Obergrenze. Der Probenleser scannt die Fixture
per SQL und ersetzt nicht den produktiven räumlichen Index; seine Zeiten sind
kein belastbarer Vergleich der Produktgeschwindigkeit.

Reproduktion:

```sh
node tools/measure-atlas-material-inventory.mjs
node tools/measure-atlas-physical-material.mjs
node --test --test-concurrency=1 tests/atlas-material-physical-field.test.mjs tests/terrain-field-stream.test.mjs tests/terrain-height.test.mjs
```

Die Physikprobe erwartet die bereits geprüfte M0-Datenbank unter
`.build/atlas-rebuild-m0-frames/source.sqlite`. Die Inventur kann bei fehlender
Quelle eine getrennte Kopie aus der archivierten Fixture erzeugen; sie ersetzt
keine vorhandene abweichende Datenbank. Artefakte enthalten ihre Quellhashes.
Test-/Toollinks wurden im gemeinsamen Capability-Katalog ergänzt; sie belegen
keine vollständige Autorenreise.

## Nächster Schritt und Grenzen

Der Anschluss beantwortet beliebige Punkte, noch keine Flächenmittel.
Konservative Höhen-/Wasserintervalle und Quellenzellen-Schnitte müssen jetzt
die adaptive Materialintegration steuern, ohne schmale Küsten zu verlieren.
Die entscheidende Gegenprobe umfasst Hermite-Extrema und geerbte NaN-Knoten;
eine bloße Änderung der Stichprobendichte genügt nicht. Masken, feldabhängige
Grundfarbe, Fels und Schnee sowie die Kombination mit Bewuchs/Pigment bleiben
im Flächenpfad offen. Erst danach vollständige Weltlast, Quellenseiten und
Cacheversion/Produktpfad umstellen. M2 bleibt offen.

# Begrenzte Arbeit für weiche Bewuchsränder

21.10.2026. Folgekorrektur zur
[weichen Bodenfarbe](../atlas-cover-feather-20261021/README.md).

## Problem und Korrektur

Eine zusätzliche Prüfung mit 2.000 kleinen Teilflächen fand eine wesentliche
Kostenlücke: Die Kantenberechnung besuchte dieselben Rasterpixel sehr oft.
Auch weit entfernte Inseln wurden vor jeder Kachel vollständig vereinigt.
Der dichte Prüffall kostete dadurch etwa eine Sekunde pro 256-Pixel-Kachel.

Der Rasterkern verwirft zuerst Teile außerhalb des Kachelbereichs einschließlich
der Randbreite. Ein begrenzter Vergleich erkennt disjunkte Teilflächen, für die
keine Vereinigung nötig ist. Bei überlappenden oder berührenden Teilen bleibt
die gemeinsame äußere Grenze maßgeblich; die Prüfung gibt nach höchstens
200.000 Vergleichen konservativ an die Polygonvereinigung ab.

Die Abstandssuche wählt nach geschätzter Arbeit zwischen zwei kleinen Kernen:
Bei wenigen Kanten berechnet sie direkt ein Feld in den erweiterten
Kantenrechtecken; deren gesamte Arbeit darf höchstens vier Rasterdurchläufe
entsprechen. Andernfalls verwendet sie eine räumliche Hierarchie der Kanten
und fragt nur tatsächlich bemalte trockene Pixel ab. Beide Wege messen
exakten Abstand zu den Polygonsegmenten, erhalten die Float32-Rundung und
unterbrechen ihre Pixelarbeit für den Readonly-Worker. Auswahl, Autorenflächen
und gespeicherte Objekte bleiben unverändert.

Eine zuerst versuchte reine Hierarchiesuche half bei Inseln, verteuerte aber
einfache Ränder. Dieser [Zwischenstand](rejected-tree-only.json) wurde verworfen.
Ein dazu begonnener nativer Lauf wurde ausdrücklich beendet (Wrapper-Exit 130)
und zählt nicht als bestandene Prüfung.

## Gepaarte Messung

Basis: `6c72342d5db7f2cbc5fcec6e60c30f005409409d` (main nach den Kronen).
[Messwerte](comparison.json), [ausführbarer Messaufbau](measure.mjs).
Zwölf Runden mit abwechselnder Reihenfolge vorher/nachher und nachher/vorher,
vier Aufwärmrunden, acht gewertete Stichproben pro Variante; keine parallele
eigene Typprüfung, Builds oder native Probe. Gemessen werden Malen und fertige
256×256-Pixel-Ausgabe, nicht der gesamte Lese-/Ladeablauf.

| Fall | Vorher, Median | Nachher, Median |
| --- | ---: | ---: |
| innenliegende Fläche | 52,7 ms | 56,4 ms |
| einfacher Rand | 47,2 ms | 36,6 ms |
| 2000-Punkte-Rand | 70,5 ms | 55,6 ms |
| 2000 verstreute Teilflächen | 135,6 ms | 26,6 ms |
| 2000 sichtbare Teilflächen | 1055,9 ms | 192,9 ms |

Alle fünf Ausgabebilder sind byteidentisch zur Basis; SHA-256 steht jeweils
im Ergebnis. Der dichte Sonderfall bleibt deutlich teurer als gewöhnliche
Flächen. Die Messung ist keine allgemeine Latenz- oder Hardwareabnahme.
Reproduktion am zugehörigen Quellstand nach Installation der Abhängigkeiten
und Anlage von `.build`: `node docs/reference/atlas-cover-distance-20261021/measure.mjs`.

## Prüfungen und Grenzen

[20 Regressionen](tests.log) bestanden: genaue Abstände mit vielen Teilflächen,
Entfernung entlegener Inseln ohne Mutation, notwendige Vereinigung berührender
Teile, Nachbarkacheln, entfernte Ursprünge, Wasser, unterbrechbare Komposition,
tatsächlicher Farbkachelleser und SQL-Paginierung. Beide TypeScript-Prüfungen
und der Desktopbuild mit Version 0.179.0 bestanden.

Die [erneute native Hauptatlas-Probe](main-atlas.json) durchläuft Welt-, Regions-,
Dorf- und Kronenmaßstab, neigt die Hauptkamera und speichert PNG. Autorenzeilen
und geschützte Identitäten bleiben unverändert; keine Rendererfehler, regulärer
Exit und keine verbliebenen Profilprozesse. Quellhashes sind nach dem Lauf
abgeglichen. Basis ist der oben angegebene Commit mit lokalen Änderungen.

Die [native Bildgegenprobe](export-comparison.json) vergleicht die erneut
exportierten 1024×876 Pixel mit der vorherigen
[Kronenausgabe](../atlas-crown-style-20261021/export.png): **null abweichende
Farbkanäle**, ohne Toleranz. Der [abgebrochene Zwischenlauf](cancelled-probe.json)
ist von diesem bestandenen Abschluss getrennt.

Testdateien: [Randabstände](../../../tests/landscape-cover-feather.test.mjs),
[Farbkacheln](../../../tests/terrain-color-tiles.test.mjs),
[SQL-Leser](../../../tests/terrain-pigment-stream.test.mjs),
[Komposition](../../../tests/terrain-pigment-coverage.test.mjs),
[nativer Atlas](../../../tools/test-desktop-forest-style.mjs).
 Die Gesamtziele zu Ladeleistung, Weltwald,
weiteren Geländearten und Werkzeugen bleiben offen. Keine abschließende
Gesamtuntersuchung und keine Nutzerabnahme.

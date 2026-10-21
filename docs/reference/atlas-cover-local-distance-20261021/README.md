# Waldrandberechnung auf den betroffenen Bereich begrenzen

Auch ein kleiner Wald legte bisher für seine weiche Randfarbe ein vollständiges
Distanzfeld der Farbkachel an. Viele Waldflächen vervielfachten dadurch die
Initialisierung und Normalisierung aller Kachelpixel. Der sparsame Distanzpfad
speichert und normalisiert nun nur das umschließende Rechteck der betroffenen
Randpixel. Außerhalb beträgt der normierte Abstand bereits 1. Rasterkoordinaten,
Abstände und Rundung bleiben gleich.

25 Rand-/Stream-/Vegetationsregressionen, TypeScript-Prüfung und Desktopbuild
bestanden. Ein neuer Test prüft alle 524.288 Samples einer großen Kachel gegen
die exakte Randdistanz, einschließlich am linken und rechten Bildrand
angeschnittener kleiner Wälder. Er begrenzt zusätzlich die Arbeitsabschnitte,
damit eine vollständige Normalisierung pro kleinem Wald nicht zurückkehrt.
Bisherige Farb-, Wasser-, Loch-, Insel- und Kachelnahtprüfungen bleiben grün.

Die normale native Weltprobe mit 3.076 Gelände-/Wald-/Straßenrecords und einem
2.500-Meilen-Pinsel bestand mit GPU-Orakeln und normal beendetem Prozess.
[Vorher/nachher](world.json), jeweils i5-8365U/Intel UHD 620, 1440×900, DPR 1,
Profiler und Traces aktiv:

| Messung | Vorher | Danach |
| --- | ---: | ---: |
| Erste bestätigte Pinselanzeige | 2.283 ms | 1.508 ms |
| Erste Live-Bildberechnung im Worker | 1.642 ms | 919 ms |
| Navigation RAF p95 | 34,5 ms | 52,7 ms |
| Pinsel RAF p95 | 16,8 ms | 22,4 ms |

Das ist eine gezielte Teilverbesserung der Berechnung, keine vollständige
Leistungsabnahme. Die Kamerazeiten schwankten im zweiten Lauf stärker.
1,5 Sekunden bis zum bestätigten Pinselbild erfüllen die Anforderung an
unmittelbare Bearbeitung weiterhin nicht. Die Datenprobe ersetzt weder eine
vollständig ausgearbeitete Fantasywelt noch den Test auf dem Pentium Gold 7505.

## Wiederholter Vergleich der Farbkachel

[Messaufbau](measure.mjs), [Ergebnisse](comparison.json): zwölf Runden mit
abwechselnder Reihenfolge, vier Aufwärmrunden und acht gewertete Proben pro
Variante; ohne eigene parallel laufende Prüfungen oder Builds. Alle Bilder
sind in jeder Runde byteidentisch zur Basis `360f8ee242428f310464d64a4923c4d688d249ad`.

| 256×256-Ausgabe | Vorher, Median | Danach, Median |
| --- | ---: | ---: |
| Ein kleiner Wald | 23,5 ms | 24,6 ms |
| Ein großer Wald | 37,6 ms | 37,5 ms |
| 256 separate Waldflächen | 519,4 ms | 47,4 ms |

Gemessen werden Randfarbe und fertige Pixelausgabe, keine Datenbankabfragen
oder Eingabelatenz. Reproduktion: `node docs/reference/atlas-cover-local-distance-20261021/measure.mjs`.

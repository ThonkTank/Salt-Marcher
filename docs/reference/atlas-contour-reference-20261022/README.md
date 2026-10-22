# Höhenlinien: verworfene Steigungsreferenzen

22.10.2026. Isolierte Varianten des tatsächlichen Atlasrenderers, keine neue
Produktansicht und noch keine Änderung der produktiven Höhenlinien. Fachanschluss:
[gemeinsamer Atlas P4/P8](../../plans/maps/unified-spatial-atlas.md).

## Ausgangsbefund

Die stärkere Linienfarbe aus dem ersten Stilversuch verbessert den einfachen
Hügel, löst aber die fehlenden Linien im gemalten Gebirge nicht. Die
[Messung der unveränderten Projektion](slope-diagnosis.json) zeigt einen höchsten
Punkt von 2.863,5 m. Die maximale Steigung 5,357 führt bei dieser Ansicht zu
1.982,1 m gewünschtem Linienabstand. Die Mischung zwischen 1.024 und 2.048 m liegt
fast vollständig bei 2.048 m: Es bleibt fast nur eine gut sichtbare Linie.

Drei Ansätze wurden betrachtet: eine typische Steigung mit gemeinsamen
Höhenstufen, ein Intervall aus Höhenspanne/Bildgröße oder eigene Konturgeometrie
mit Detailstufen. Typische Steigung erhält den vorhandenen flüssigen GPU-Zoom.
Höhenspanne ist einfach, reagiert aber ebenfalls auf einzelne hohe Berge.
Separate Liniengeometrie bietet mehr gestalterische Kontrolle, benötigt jedoch
zusätzlichen Speicher und Aktualisierung bei jeder Geländeänderung.

## Gleiche Geometrie, verschiedene Referenzen

Alle Bilder verwenden die Produktionsprojektion und -kamera, 24 logische Pixel
Zielabstand und dieselbe etwas kräftigere Versuchstinte:
Zwischenlinien Halbbreite 0,65 px / Deckkraft 0,62; Hauptlinien 1 px / 0,78.
Diese Tinte ist **nicht** in die Produktversion übernommen.

[Erster Vergleich](reference-result.json): Maximum sowie flächengewichteter
Mittelwert und Median der positiven Zellsteigungen. Vier Motive, je Draufsicht
und 45° Neigung, ergeben 24 Bilder. [Zweiter Vergleich](variation-result.json):
Mittelwert, nach Höhenvariation gewichteter Mittelwert und quadratischer Mittelwert
(RMS), zwei Motive und beide Neigungen, zwölf Bilder. Die beiden Prozesse endeten
normal mit Code 0, verschwundenen PIDs und ohne Rendererfehler. Beide vollständigen
Ergebnismengen sind reproduzierbar; hier sind zehn geneigte Vergleichsbilder erhalten.

| Referenz | Einfacher Hügel | Gemaltes Gebirge | Beobachtung |
| --- | --- | --- | --- |
| Maximum | [Bild](hill-maximum-45.png) | [Bild](painted-region-maximum-45.png) | Hügel brauchbar, Gebirge fast ohne Höheninformation |
| Mittelwert | [Bild](hill-mean-45.png) | [Bild](painted-region-mean-45.png) | Gebirge wesentlich besser; flache Hügelränder drücken den Abstand zu stark |
| Median | [Bild](hill-median-45.png) | [Bild](painted-region-median-45.png) | Am Hügel zu dicht; Sortierung zusätzlich teuer |
| Höhenvariation | [Bild](hill-variation-45.png) | [Bild](painted-region-variation-45.png) | Ausgewogenere Hügeldichte, mehrere gemeinsame Höhenlinien im Gebirge |
| RMS | [Bild](hill-rms-45.png) | [Bild](painted-region-rms-45.png) | Gebirge besser, Hügel weiterhin dichter als gewünscht |

Die Variationsgewichtung berechnet `sum(area * slope²) / sum(area * slope)`.
Fast flache Ausläufer tragen wenig bei; der Wert benötigt keine Sortierung.
Eine einzelne sehr extreme Klippe kann weiterhin dominieren: Das ist eine Grenze
gegenüber einem vollständig robusten räumlichen Verfahren, keine gelöste Eigenschaft.
Die Wasser-/Plateauflächen werden nicht als Linien gezeichnet.

| Versuch | Intervall Hügel | Intervall Gebirge | Vollständige Berechnung Hügel, Median / p95 |
| --- | ---: | ---: | ---: |
| Maximum | 8,83 m | 1.982,11 m | 5,7 / 7,1 ms |
| Mittelwert | 1,87 m | 358,66 m | 5,3 / 8,7 ms |
| Median | 0,36 m | 254,48 m | 29,3 / 45,5 ms |
| Höhenvariation | 5,77 m | 677,85 m | 5,3 / 6,3 ms |
| RMS | 3,28 m | 493,07 m | 5,0 / 5,8 ms |

Zeitmessungen im nativen Renderer: fünf Aufwärmaufrufe, dann 20 Aufrufe;
Einzelversuch auf i5-8365U/UHD620, keine Pentium-Abnahme. Es wird die komplette
Referenzberechnung gemessen, nicht Navigation, Pinselreaktion oder Bildausgabe.
Der heutige Pinsel aktualisiert nur einen Teilbereich; diese Vollberechnung darf
nicht ungeprüft in jeden Pinsel-Frame verlagert werden.

## Entscheidung und offene Umsetzung

Die Nutzerkorrektur vom 22.10.2026 verwirft **alle Steigungsreferenzen als
Intervallgeber**, einschließlich der optisch besseren Variationsgewichtung.
Höhenlinien verbinden gleiche physische Höhen in gleichmäßigen Höhenabständen.
Bei gleicher Zoomstufe dürfen Bearbeiten, Nachladen, Verschieben oder eine einzelne
Klippe die Höhenstaffel der übrigen Karte nicht verändern. Die Experimente oben
bleiben Diagnosebelege und sind keine freigegebene Produktlösung.

Der nächste Umsetzungsschritt wählt ineinander verschachtelte feste Höhenstufen
nur nach dem Kartenmaßstab und blendet Zwischenstufen beim Zoom weich aus oder ein.
Lokale Bildschirmableitungen dienen ausschließlich Strichbreite und Kantenglättung;
sie wählen keine Höhenstufen. Manuell festgelegte Meterintervalle bleiben verfügbar.
Damit entfällt auch die Steigungssuche nach jeder Geländeänderung.

Die anschließende [feste Maßstabsstaffel](../atlas-fixed-contours-20261022/README.md)
ersetzt diese Experimente. Ihr Bericht enthält visuelle Auswahl, Zoom-/DPI-/
Exportprüfungen und die Gegenprobe im normalen Atlas samt stärkerer Linientinte. Scharfere Küsten, natürlicher Reliefstil und
eine vorzeigbare Fantasy-Welt sind dadurch noch nicht erreicht.

## Reproduktion

Am Ausgangsstand `02673afb2e04e828a32cf17b22e86cac45fc48ea`, Node 22, vorbereiteter
Desktop-Build; nacheinander und mit neuen Ausgabeverzeichnissen:

```sh
cp docs/reference/atlas-contour-reference-20261022/reference-function.ts .build/contour-reference-function.ts
cp docs/reference/atlas-contour-reference-20261022/reference-comparison.mjs .build/contour-reference-comparison.mjs
cp docs/reference/atlas-contour-reference-20261022/variation-comparison.mjs .build/contour-variation-comparison.mjs
QA_EVIDENCE_DIR=.build/contour-reference-repeat python3 tools/ui-session.py timeout --signal=TERM 240s node .build/contour-reference-comparison.mjs
QA_EVIDENCE_DIR=.build/contour-variation-repeat python3 tools/ui-session.py timeout --signal=TERM 180s node .build/contour-variation-comparison.mjs
```

Die virtuellen Quelländerungen betreffen ausschließlich die Prüfbundles. Der
normale Renderer und die kanonischen Autorendaten bleiben unverändert.

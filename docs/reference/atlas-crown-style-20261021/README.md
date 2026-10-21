# Lesbarere Baumkronen in der gemeinsamen Atlaskamera

21.10.2026. Lokaler Teilschritt für mittlere und nahe Maßstäbe. Die Weltübersicht
benötigt weiterhin eine eigene zusammenhängende Waldgestaltung.

## Gestaltung und Aufwand

Laubbäume erhalten eine leicht gelappte Krone mit weicher Schattierung;
Nadelbäume erhalten Aststufen und eine verzweigte Silhouette. Stabile leichte
Farbvariation hängt an der Objektkennung, nicht am Kameraausschnitt.
[Vergleich senkrecht](comparison-top.png) und [geneigt](comparison-tilted.png):
links bisherige Modelle, rechts der neue Entwurf mit identischen Beständen.
Die Bilder stammen aus einem isolierten Vergleich des Produktrenderers,
nicht aus einem zusätzlichen Produktzugang.

Der [erste Entwurf](rejected-heavy.png) wurde wegen seines Aufwands verworfen:
[132.800 statt 29.960 Dreiecke](rejected-cost.json) im kleinen Vergleich.
Die vereinfachten Modelle begrenzen Kronen auf 128 Dreiecke beim Laubbaum
und 144 beim Nadelbaum. Stämme, Steine und Unterwuchs behalten ihre bisherigen
Geometrien; gemeinsame Instanzen benötigen keine zusätzlichen Zeichenaufrufe.

Die [abschließende isolierte Kameraprobe](comparison.json) enthält 4.953
Instanzen. Reihenfolge vorher/nachher/nachher/vorher, jeweils 100 Frames mit
20 Aufwärmframes: vorher 53,9–56,4 FPS, nachher 54,8–56,5 FPS; Frame-P95
21,7–22,6 ms. Fünf Zeichenaufrufe in beiden Varianten; Dreiecke steigen
von 338.690 auf 771.020. Die kleine Probe belegt vergleichbares Verhalten
in dieser Szene, keinen allgemeinen Geschwindigkeitsgewinn oder 60-FPS-Nachweis.
Der [vorherige Messlauf](comparison-double-render.json) zeichnete versehentlich
zweimal pro Frame; deshalb wurde die Probe auf einen Renderaufruf pro
Kamerabewegung korrigiert und erneut ausgeführt. Reproduzierbar am unten
angegebenen Quellstand: zuerst `node docs/reference/atlas-crown-style-20261021/comparison-build.mjs`,
danach `python3 tools/ui-session.py timeout --signal=TERM 90s node docs/reference/atlas-crown-style-20261021/comparison-run.mjs`.
[Aufbau](comparison-build.mjs) und [nativer Ablauf](comparison-run.mjs)
erzeugen nur isolierte Prüfbilder unter `.build/crown-style-prototype`.

Native Ladezeiten, alle GPUs, extreme Bestandsgrößen und CPU-/GPU-Kosten im
Gesamtprodukt bleiben gesondert zu qualifizieren.

## Gemeinsamer Besitzer und Regressionen

`vegetation-geometry.ts` besitzt Modelle und Konturschattierung.
`vegetation-shape.ts` teilt Kronenform und stabile Farbvariation mit dem flachen
Fallback. `AtlasSpatialVegetation` bleibt Besitzer von Instanzen, Auswahl und
Freigabe. Der bestehende Kamerashader steuert weiterhin Breite und Sichtbarkeit;
Konturschattierung ergänzt ihn ohne zusätzliche Renderpässe. Autorenwerte,
Identitäten, Schutzstatus und Metergrößen werden nicht umgeschrieben.

[36 lokale Regressionen](tests.log) bestanden: Modelle bleiben innerhalb
begrenzter Metermaße und Dreieckbudgets; keine ungültigen Normalen/Farben,
keine Autorenmutation, gemeinsame Freigabe, Kameratreffer, Verdeckung,
Typfilter, kompakte Projektionen und bestehende Bewuchs-/Speicherabläufe.
Beide TypeScript-Prüfungen und Desktopbuild bestanden.

[GPU-Prüfung im nativen Host](camera.json): logische Kronenbreite bei DPR 1/2,
Neigung, geschützte maßhaltige Bäume und ausgeblendete Nebeninstanzen;
unveränderte Instanzmatrizen bei Kamerabewegung; null Pixelabweichungen zwischen
Gesamtbild und gekachelter Ausgabe innerhalb der bestehenden Ein-Byte-Toleranz.
Regulärer Prozessabschluss und keine Rendererfehler. Das ist ein isolierter
GPU-Test innerhalb des nativen Hosts, keine vollständige Bedienabnahme.

Prüfdateien: [Geometrie](../../../tests/vegetation-geometry.test.mjs),
[Kameratreffer](../../../tests/vegetation-lod.test.mjs),
[Auswahl/Verdeckung](../../../tests/vegetation-spatial.test.mjs),
[GPU-Pixel](../../../tools/vegetation-camera-probe.mjs),
[nativer Host](../../../tools/test-desktop-vegetation-camera.mjs),
[normaler Atlas](../../../tools/test-desktop-forest-style.mjs).

## Normaler Atlas

Die [native Bedienprobe](main-atlas.json) auf
`9a5b4ccc3022cab78eef9adcfdd6c57b9a9376c1` durchläuft vier Maßstäbe von 80 km
bis 300 m, neigt dieselbe Hauptkamera und speichert über den normalen
Ausgabedialog. [1,2-km-Ausschnitt](village.png), [geneigte Nahansicht](tilted.png)
und [PNG](export.png) zeigen dieselben neuen Kronen. Autorendatensätze und
geprüfte geschützte Identitäten bleiben unverändert. Regulärer Exit, keine
Rendererfehler; nach Abschluss keine Prozesse des Prüfprofils. Die aufgeführten
Quellhashes wurden gegen den Arbeitsstand nach der Prüfung abgeglichen.

## Noch offen

Die Bestände sehen weiterhin regelmäßig aus; Weltmaßstab, zusammenhängende
Waldtexturen, zusätzliche Geländearten und die gesamte Landschaftswerkzeugsuite
sind nicht durch diese Kronenänderung erfüllt. Keine Nutzer- oder Paketabnahme,
keine der drei abschließenden Gesamtuntersuchungen.

# Feste Höhenstufen beim Zoomen – 22.10.2026

## Ursache und Entscheidung

Am Ausgangsstand `02673afb2e04e828a32cf17b22e86cac45fc48ea` bestimmt die
höchste Steigung des geladenen Fokusbereichs das automatische Höhenintervall.
Dadurch beeinflusst eine einzige Klippe die Linien auf unverändertem Terrain.
Die [vorherigen Steigungsvarianten](../atlas-contour-reference-20261022/README.md)
sind ausdrücklich verworfen. Der CPU-Rasterpfad wählte sogar pro Pixel aus
seiner lokalen Steigung und konnte Linien entlang eines Hangs abbrechen lassen.

Verglichene Lösungswege: feste maßstabsabhängige Stufen (unmittelbar, ohne
Geländeabfrage), manuelle Intervalle mit Ausdünnung (kontrollierbar, zusätzlicher
Bedienaufwand), eigene Konturgeometrie (mehr Gestaltungsspielraum, zusätzliche
Berechnung und Speicherung nach Geländeänderungen). Gewählt ist die erste Lösung.

`terrainContourStep` wählt nach Metern pro logischem Anzeigepixel: 16 m bei
1 m/px, mindestens 1 m und höchstens 256 m. Der vorhandene Shader blendet benachbarte, ineinander
enthaltene Zweierintervalle; ihre physischen Höhen werden niemals interpoliert.
Die zweite Variante des isolierten Vergleichs (8 / 16 / 24 m bei 1 m/px) ist
am gemalten Gebirge und am Hügel ausgewogen. 8 ist im Nahbereich zu dicht, 24
lässt am kleinen Hügel wenig Höheninformation. Starke Vergrößerungen bleiben
auch mit 16 teilweise dicht; keine allgemeine kartografische Abnahme.

Die bessere Versuchstinte ist übernommen: Zwischenlinien Halbbreite 0,65 px /
Deckkraft 0,62; Hauptlinien 1 px / 0,78. Jede fünfte Linie ist betont. Der lokale
Bildschirmgradient steuert nur Strichbreite/Kantenglättung und die Unterdrückung
unauflösbar dichter Linien. Er erzeugt oder verschiebt keine Höhenstufen.
Feste Meterintervalle und ausgeschaltete Linien bleiben wählbar.

## Aufräumen und Grenzen

Die vollständige Steigungssuche beim Laden und die örtliche Suche während jeder
Pinselvorschau entfallen, ebenso ihr gespeicherter Maximalwert. Der CPU-Fallback
verwendet dieselbe Maßstabsfunktion; seine zweifache Abtastung ändert das Intervall
nicht. Ein notwendiger expliziter Maßstabsparameter verhindert den Rückfall auf
eine örtliche Steigungswahl. Keine neue Karte, kein weiterer Cache oder Renderpfad.

Die Küstengeometrie, Quellenauflösung, Waldkomposition und Materialgestaltung sind
unverändert. Die groben gemalten Stufen/Küsten im Vergleich bleiben sichtbar.
Keine Zusage zu unmittelbarer Vollweltreaktion oder zum Pentium-Laptop.

## Prüfung

Die native Gegenprobe öffnet im normalen Atlas einen Hügel bei 100 und 200 %
Anzeigegröße. Danach fügt sie eine 20-km-hohe Testklippe außerhalb der gemessenen
Hügelzeile, aber innerhalb des geladenen Fokusbereichs hinzu und öffnet erneut.
Die vorherige Produktversion scheitert beim dritten Start: Die automatischen
Hügellinien verschwinden. Die zwei vorangehenden Starts endeten normal; der dritte
wurde im Fehlerpfad aufgeräumt, kein erfolgreicher Gesamtlauf.

Die [neue native Gegenprobe](after/result.json) besteht alle drei Starts mit
normalem Exit (4105271, 4105590, 4105834), verschwundenen PIDs und ohne Rendererfehler.
Die mittlere Bildzeile enthält jeweils zehn automatische und vier feste
Linienüberquerungen. Nach der Klippe sind deren Positionen **exakt gleich**;
100/200-%-Vergleich besteht mit höchstens zwei logischen Pixeln Abweichung.
[Hügel vorher](after/100-percent-auto.png), [nach der Klippe](after/distant-cliff-auto.png).

Die GPU-Pixelprobe umfasst Zoom, 100/150/200-%-Abtastung, feste/ausgeschaltete
Linien, Wasserplateaus, einen durchgehenden 144-m-Verlauf bei wechselnder Steigung
und gekachelten Export. CPU/GPU-Farbabweichung maximal ein 8-Bit-Schritt;
Exportkacheln pixelgleich. [Rastervergleich](raster-comparison.png): je Stil links
bisherige, rechts neue Ausgabe; von oben aus / automatisch / feste 10 m.
Die neun Bildhashes wurden nach Sichtprüfung als neue Referenz erhalten;
die alten Referenzen bleiben unverändert. Kachelnähte sind auch automatisch geprüft.

23 gezielte Tests bestanden; App-/Desktop-Typprüfung, Desktop-Build und
Repositoryprüfung bestanden. Lokale Belege sind keine Paket-, CI- oder Pentiumabnahme.

## Reproduzieren

Node 22, vorbereiteter Desktop-Build:

```sh
node --test tests/terrain-contours.test.mjs tests/terrain-hex-grid.test.mjs tests/terrain-relief.test.mjs tests/terrain-color-tiles.test.mjs tests/terrain-brush-draft.test.mjs tests/terrain-render-reuse.test.mjs
QA_EVIDENCE_DIR=.build/contour-display-repeat python3 tools/ui-session.py timeout --signal=TERM 240s node tools/test-desktop-contour-display.mjs
node tools/render-terrain-contour-goldens.mjs
```

Der eingefrorene [Zoomvergleich](zoom-comparison.mjs) gehört zum obigen
Ausgangsstand: in dessen Arbeitskopie nach `.build/contour-zoom-comparison.mjs`
kopieren und mit `QA_EVIDENCE_DIR=.build/contour-zoom-repeat` über denselben
UI-Wrapper starten. [Rohdaten](zoom/result.json) enthalten alle 24 Bildnamen;
im Bericht sind neun geneigte Beispiele erhalten. Der Lauf endete normal mit
Code 0, PID 4100711 verschwunden, keine Rendererfehler. Die virtuellen Änderungen
betrafen ausschließlich das Prüfbundle. Aktuelle Dichtevarianten lassen sich mit
`tools/test-desktop-contour-readability.mjs` im Produktionsstand wiederholen.

## Weltmaßstab: unbeschränkte Staffel verworfen

Die erste feste Regel war nach oben unbegrenzt. Die
[Vollweltprobe](world-uncapped/result.json) bestand funktional mit normalem Exit,
zeigte aber eine erhebliche **visuelle Rückmeldungslücke**: erste nachweisbare
Pinselinnenflächenänderung nach 885 / 756 / 571 ms (Sculpt / Wiederholung / Smooth).
Die Entwürfe waren schon nach 114 / 60 / 44 ms zur GPU eingereicht, änderten
anfangs jedoch höchstens einen Farbwert. Ohne Höhenlinien ist die physisch sehr
flache Weltsilhouette aus der Draufsicht fast unsichtbar. Frame-p95 war
22,5 / 24,4 / 33,3 / 22,6 ms; gute Bildfolge allein löst diese Lücke nicht.

Ein weiterer isolierter Weltvergleich erhält alle Höhen, vergrößert aber die
horizontalen Abmessungen der gemalten Szene um Faktor 1.000. Vier Varianten:
unbegrenzt (kaum Höheninformation), 128 m (dichte Linien), 256 m (lesbare
Gebirgsformen), 512 m (weniger Zwischenformen). Deshalb endet die feste Staffel
bei 256 m. Diese Grenze ist für jede Welt identisch und hängt weiterhin weder
von Steigung noch Autorenhöhen ab. Ein neuer GPU-Fall prüft sichtbare Linien und
eine kleine Höhenänderung bei 10.000 km Bildbreite, ohne instabiles Zeitbudget.
Die ursprüngliche lokale Vollweltmessung bleibt erhalten und wird nicht ersetzt.

## Vollwelt mit begrenzter Staffel

[Ergebnis](world/result.json), normale Wayland-Entwicklungsanwendung auf
Intel i5-8365U/UHD620. 100.000 Biomeinträge, 5.000 Gebäude, 15.701 Räume,
48.670 Elemente, 1.028 anfängliche Höhentiles. Die Biomeinträge sind ausdrücklich
keine 100.000 fein aufgelösten Höhenbearbeitungen. Zwei Sculpt-Züge mit nominal
2.500 Meilen Radius und Smooth mit nominal 75 % davon speichern erfolgreich;
abschließend Revision 20, 48/48 Detailtiles. Beide Prozesse (4112956,4113280)
enden normal, PIDs verschwunden, keine Rendererfehler.

| Ablauf | Frame p95 / p99 / Maximum | Erste nachweisbare Pinselinnenfläche |
| --- | --- | --- |
| Navigation | 20,5 / 33,2 / 83,3 ms | nicht gemessen |
| Sculpt | 22,9 / 83,3 / 149,9 ms | 174,7 ms |
| Sculpt erneut | 25,3 / 83,4 / 250,0 ms | 131,9 ms |
| Smooth | 22,4 / 33,3 / 83,3 ms | 98,9 ms |

Das beseitigt den Rückschritt der unbegrenzten Staffel, ist aber kein allgemeiner
Leistungsgewinn gegenüber dem vorherigen Steigungsrenderer. Dort lagen die
entsprechenden Rückmeldungen bei 165,9 / 111,5 / 133,8 ms; die maximale Bildlücke
beim wiederholten Sculpt betrug 233,2 statt hier 250 ms. Einzelmessungen und
asynchrones GPU-Auslesen sind keine garantierte Präsentationslatenz. Unter 100 ms
für alle Gesten und der tatsächliche Pentium-Laptop bleiben offen.

[Weltbild nach Sculpt](world/world-sculpt.png): breite Höhenformen sind wieder
sichtbar. Waldkachelmuster und grobes Gitter bleiben technische Testlast, keine
schöne Autorenwelt. Der neue 10.000-km-GPU-Fall liefert acht sichtbare Linienpixel
und nach einer 8-m-Höhenänderung 16 geänderte Pixel; Exportkacheln bleiben pixelgleich.

```sh
WORLD_WARM_OPEN=1 WORLD_POPULATED=1 WORLD_LARGE=1 WORLD_MIXED=1 WORLD_READBACK=async WORLD_PROFILE=0 WORLD_DRAFT=1 WORLD_REPEAT=1 WORLD_PROGRESSIVE=1 WORLD_OVERLAY=1 WORLD_SMOOTH=1 QA_EVIDENCE_DIR=.build/contour-world-repeat python3 tools/ui-session.py timeout --signal=TERM 300s node tools/test-desktop-world-navigation.mjs
```

[Obergrenzenvergleich](caps/result.json) und [Prüfskript](world-cap-comparison.mjs):
das Skript in `.build/contour-world-cap-comparison.mjs` kopieren und über den
UI-Wrapper ausführen. Es setzt die Maßstabsregel im Prüfbundle ausdrücklich auf
jede Variante. Acht Bilder, beide Kameraneigungen, normaler Exit von PID4110611,
keine Rendererfehler. Die räumliche Geometrie bleibt pro Vergleich unverändert.

Der ältere historische Rekonstruktionsgenerator lässt sich auf diesem aktuellen
Quellstand wegen inzwischen geänderter Interpolations-Exporte nicht ausführen.
Der Versuch ist kein bestandener Check; seine ursprüngliche Datei bleibt erhalten.
Der neue `render-terrain-contour-goldens.mjs` friert Raster und Konturstil gemeinsam
auf die kompatible Ausgangsversion ein, prüft deren alte Hashes und liefert den
oben gezeigten Vergleich. Er besteht auch nach der Obergrenze; alle neun zuvor
visuell geprüften Referenzen bleiben identisch.

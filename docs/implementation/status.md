# Aktueller Stand

Atlas V7, Dateiformat 22, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Integration

Main enthält die Höhen-/Landschaftsarbeiten, stabile Geometriecaches,
Eingabekorrekturen, Kartenschrift, Dachdetails und die lokale Materialkachelzuordnung.
PR #1464 ist als `288582d19` integriert; sein Baum entspricht exakt dem vollständig
CI-geprüften Kandidaten `c7486a32b`. Damit sind auch die Änderungen aus #1463 enthalten.

Der aktuelle Folgekandidat ergänzt Terrainpfade im vorhandenen Rastercache und
erhält den Weltmittelpunkt beim Öffnen von Werkzeugleisten und bei Fensterresizes.
Die Kamerakorrektur liegt in PR #1466 mit laufender CI und automatischer
Main-Übernahme. Der darauf aufbauende Waldkandidat vergrößert nahe Kronen bei
gleichem Kandidatenabstand und berücksichtigt deren größeren sichtbaren Rand.
Seine Main-Abstammung berücksichtigt die bereits integrierten Änderungen.
Vollständige CI-Freigabe und Main-Übernahme dieses Folgekandidaten stehen aus.
Zuerst #1466 integrieren; danach `codex/near-forest-canopy` auf den verifizierten
Main-Stand beziehen. Der laufende Check von #1466 wird nicht neu gestartet.

## Geprüfter Produktstand

Weltmalen funktioniert auch nach freiem Herauszoomen und während Ansichtsreads;
128 Pixel werden schon beim ersten Kartenklick ohne vorheriges Tab/Enter
übernommen. Bestätigte Zwischenstände und vollständiges Undo wurden durch
Browserbedienproben geprüft. Übergröße zeigt einen verständlichen Fehler;
anschließendes Malen mit kleinerem Pinsel funktioniert bei 900 × 620 ohne
Veränderung der Statuszeilenhöhe. Leere Höhenkachelanfragen liefern Status,
ohne Autoren oder Blockindex zu lesen. Die spezialisierte Bergkette, Hügel und
Schlucht wurden mit sichtbaren Zwischenständen und exaktem Undo/Redo geprüft.

Landschaftsdeckung, Dichte, Lichtungen, grobe Vererbung, History und Datei-Rundlauf
sind geprüft. Browserproben bestätigen 25/65/100-Prozent-Dichte über mehrere
Zoomstufen. Mittlerer Wald erscheint als Blätterdach mit Dichtelücken, nahe als
gezeichnete Kronen; große Viewports bleiben innerhalb des Kandidatenbudgets.
Die Nahdarstellung wurde zusätzlich mit 25/65/100-Prozent-Bestand visuell geprüft:
100 Prozent bildet nun weitgehend geschlossene Kronengruppen statt eines lockeren
Hains. Baumpositionen, Varianten und Kandidatenbudget bleiben stabil. Die gemischte
Browserprobe mit Häusern, Lichtung, Dachfarbe, fünf Zoomstufen und pixelgenauem
Undo/Redo besteht auch mit den größeren Kronen.
Boden- und Felsfarbe bleiben unabhängig. Rasterhalos und Geräte-Pixel-Clips
sichern Nähte; unsichtbare Raster überspringen teure Verarbeitung.

Die Stilrichtung ist eine stilisierte Fantasykarte: nahe an Canvas of Kings
orientierte Federzeichnung, mittlere/ferne Ansichten mittelalterlich inspirierte
Kartografie. Gemeinsame Serifenschrift und einfache Walmdachdetails wurden im
Browser visuell geprüft. Die Schriftdefinition gilt für Messung und Zeichnen;
lokale Font-Fallbacks können sich je Plattform unterscheiden. Dachdetails blenden
beim Herauszoomen aus. Innenhöfe und komplexe Dächer erhalten keine unpassenden
Walmdachlinien. Dies ist ein erster Stilstand, keine abgeschlossene Gestaltung.

Die gemischte Browser-Bedienprobe bestätigt Häuser, Wald, Lichtung und Dachfarbe
über fünf Zoomstufen. Nach Öffnen der Landschaftsleiste bleiben Häuser beim
Hineinzoomen im Bild. Lichtung und Dachfarbe sind sichtbar; Undo/Redo stellt
pixelgenau den jeweiligen Zustand wieder her. Nahe und mittlere Screenshots
wurden visuell geprüft. Ein Regressionstest belegt zuvor 122 CSS-Pixel
Mittelpunktversatz und nach der Korrektur weniger als 0,01 Pixel.
Kartenklick-Auswahl behält ihren Mausanker auch beim Inspectorwechsel.

Für die Kamerakorrektur bestehen alle 248 Browserfälle über Gesamtlauf und
gezielte Wiederholungen: 240 direkt, acht nach Anpassung bisher fester
Testkoordinaten beziehungsweise Ausschnittannahmen. Die Assertions für Autoren,
History und Nebenläufigkeit bleiben erhalten. Der neue Mittelpunkt-Test besteht
für Werkzeugöffnung/-schließung, anschließenden Zoom und Fensterresize.

## Aktuelle Arbeits- und Prüfnachweise

Außen-/Flussgeometrie behalten einen nützlichen Teil auch über dem Eintragsbudget.
Der 257-Flüsse-Fall baut bei 256 Cacheplätzen pro weiterem Bild einen statt 257
Pfade neu. Zoom verwendet Flusskonturen weiter, solange Mindestbreiten unverändert
bleiben. Zahlenfelder werden vor dem ersten Zeichnen übernommen.

Materialabtastung indiziert ihre aktuellen Höhenkacheln erst beim ersten Sample.
Vier Durchläufe über 64 Kacheln benötigen im Regressionstest höchstens 128 statt
9.605 Koordinatenzugriffe bei identischen Ergebnissen; negative und fehlende
Kacheln sind abgedeckt. Zehn Boden-/Landschaftsbrowserfälle bestehen, einschließlich
Weltansicht bei 3840 Pixeln, freiem Zoom, History und Datei-Rundlauf.

Terrain-Höhenlinien verwenden bei freiem Platz denselben Rastercache wie Bilder.
Optionale Pfade verdrängen bei ihrer Aufnahme keine gehaltenen Raster; ihre
Speicherkosten zählen als Schätzung zum Budget. 4.096 unveränderte Segmente erfordern
beim nächsten Bild null statt 16.384 Koordinatenzugriffe. Geänderte Vorschauen
verwenden neue Geometrie. Relief-/Materialdekodierung erfolgt erst bei Bedarf;
dekodierte Reliefbytes werden nach der Bilderstellung nicht zusätzlich gehalten.

Mit den größeren Waldkronen bestehen erneut 436 Frontendtests, Typen und Format
sowie alle fünf Landschafts-Browserfälle einschließlich Welt bei 3840 Pixeln.
Transportverträge sind auf dem unveränderten Kern geprüft. Der frische
Release-/RPM-Build mit den Waldkronen besteht (7,52 MiB).
Der unabhängige Canvasvergleich bestätigt exakte
Pixelgleichheit der Terrainpfade über vier Kameratransformationen. Die
Speicher-/Arbeitsnachweise sind keine Latenzmessungen.

## Offene Abnahmen

Frühere native Prüfungen umfassen Weltmalen, Bodenfarben, Landschaft, Navigation,
Lichtungen, History und Datei-Rundlauf. Neuere Änderungen sind nicht nativ bedient:
Diese Sitzung bietet keinen nativen UI-Zugriff. Das ursprüngliche Testfenster
bleibt unberührt; Browserprüfungen und Releasebuild ersetzen die native Abnahme nicht.

Genau eine frühere Vorher-/Nachher-Reihe mit je drei Weltstrichen ist abgeschlossen:
erste sichtbare Änderung 275–304 → 119–134 ms, sichtbare Bestätigung p95
427–516 → 339–376 ms, Nachlauf 259–427 → 231–345 ms. Spätere Änderungen sind darin
nicht enthalten. Das Ziel p95 ≤50 ms bleibt unbelegt; keine weitere Zeitmessreihe.
RPM-Installation, große Stadt-/Weltlastfälle und umfangreicher Release-Treiber
bleiben offen. Komplexe Dachstile, Einzelobjektplatzierung, lokale Verschiebeausnahmen,
Feldumrisse und Assetimporte bleiben Folgeumfang.

Aktuelle Belege unter `src-tauri/target/diagnostics/`: `feature-input-review/`,
`roof-review/`, `roof-movement-final/`, `map-typography/`, `material-tile-index/`
und `retained-terrain-contours/` beziehungsweise `retained-terrain-contours-final/`.
Die Kamerakorrektur ist in `viewport-center-before/`, `viewport-center-full/`,
`viewport-center-regressions/` und `mixed-scene-review/` belegt.
Wald-Bildproben und Bedienprüfung liegen unter `forest-density-review/`.

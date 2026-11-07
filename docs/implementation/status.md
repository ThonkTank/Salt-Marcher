# Aktueller Stand

Atlas V7, Dateiformat 22, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Integration

Main enthält die Höhen-/Landschaftsarbeiten, stabile Geometriecaches und
Eingabekorrekturen. PR #1462 ist als `50595d7ff` integriert; der Main-Baum
entspricht exakt dem geprüften Kandidaten `fd22c2927`. Seine vollständige CI
besteht: 338 Rust-Librarytests und 32 Integration-/Adaptertests, fünf absichtlich
ignorierte Fälle, 246 Browserfälle, Frontendtests, Typen, Transportverträge,
Clippy, Format und Release-/RPM-Build.

PR #1463 enthält Kartenschrift und begrenzte Dachdetails; PR #1464 ergänzt die
lokale Kachelzuordnung für Materialabtastung. Beide enthalten korrigierte
Pixelproben für schattierte Dächer und Auswahl außerhalb von Beschriftungen.
Der aktuelle Folgekandidat ergänzt Terrainpfade im vorhandenen Rastercache.
Für diese Folgeänderungen stehen vollständige CI-Freigaben und Main-Übernahmen
noch aus. Lokale Ergebnisse ersetzen diese Freigaben nicht.

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
Boden- und Felsfarbe bleiben unabhängig. Rasterhalos und Geräte-Pixel-Clips
sichern Nähte; unsichtbare Raster überspringen teure Verarbeitung.

Die Stilrichtung ist eine stilisierte Fantasykarte: nahe an Canvas of Kings
orientierte Federzeichnung, mittlere/ferne Ansichten mittelalterlich inspirierte
Kartografie. Gemeinsame Serifenschrift und einfache Walmdachdetails wurden im
Browser visuell geprüft. Die Schriftdefinition gilt für Messung und Zeichnen;
lokale Font-Fallbacks können sich je Plattform unterscheiden. Dachdetails blenden
beim Herauszoomen aus. Innenhöfe und komplexe Dächer erhalten keine unpassenden
Walmdachlinien. Dies ist ein erster Stilstand, keine abgeschlossene Gestaltung.

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

436 Frontendtests, Typen und Format bestehen. 30 Raum-/Live-Höhenbrowserfälle
bestehen; nach Entfernung der redundanten Reliefbytes bestehen erneut vier
gezielte Fälle. Der unabhängige Canvasvergleich bestätigt exakte Pixelgleichheit
über vier Kameratransformationen. Die Haus-/Raum-/Navigationsfälle prüfen außerdem
unter anderem Dachbewegung, Auswahl, Innenraumwechsel und Präsentationsstabilität.
Nach der zusätzlichen Cache-Aufnahmeprüfung bestehen erneut die komplette
Frontendsuite und der Pixelvergleich. Der frische Release-/RPM-Build besteht
(7,52 MiB). Die Speicher-/Arbeitsnachweise sind keine Latenzmessungen.

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

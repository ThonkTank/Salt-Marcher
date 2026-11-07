# Aktueller Stand

Atlas V7, Dateiformat 22, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Integration

Main enthält Landschaft, Darstellungsbegrenzung, Sampler-Fix und die Korrekturen
für Außengeometrie und Höhenbeginn während Ansichtsreads. PR #1460 ist als
`707953e17` integriert; der Main-Baum entspricht exakt dem geprüften Kandidaten
`c4baf9ecf`. Dessen vollständige CI besteht: 337 Rust-Librarytests und 32
Integration-/Adaptertests, fünf absichtlich ignorierte Fälle, 245 Browserfälle,
Frontendtests, Typen, Transportverträge, Clippy, Format und Release-/RPM-Build.
Die ersetzten Vorstufen #1458 und #1459 sind geschlossen.

PR #1461 bündelt Flusscache, Zoomwiederverwendung, Dichteanzeige und Zahleneingabe
vor dem ersten Kartenklick. Die vollständige Main-CI läuft mit automatischer
Übernahme. Lesbare Pinselmaße, verständliche Grenzmeldungen und der frühe Rückweg für leere
Höhenkachelanfragen liegen auf einem Folgebranch; dessen Integration wartet auf #1461. Lokale Ergebnisse ersetzen
keine vollständige CI-Freigabe.

## Geprüftes Verhalten

Wald, Buschland, Wiese und Felsgebiet lassen sich auf allen Außenmaßstäben mit
Zieldichte, Lichtungen, grober Vererbung und History malen. Boden-/Felsfarbe bleibt
unabhängig. Fern erscheinen Flächenfarben, mittlerer Wald als Blätterdach mit
Dichtelücken, nahe Bäume als Federzeichnungen mit unregelmäßigen Kronen. Große
Viewports behalten das Blätterdach, bis Einzelbäume in das Kandidatenbudget passen.
Eine erneute Browserprobe über echte UI-Aktionen bestätigt 25/65/100-Prozent-
Eingaben ab dem ersten Zug und sichtbare Dichteunterschiede über mehrere Zoomstufen.
Rasterhalos und Geräte-Pixel-Clips sichern Nähte. Leere Kacheln übertragen keine
Pixelnutzlast; unsichtbare Boden-, Landschafts-, Gelände- und Stadtdichtekacheln
überspringen teure Verarbeitung. Ebene Ausschnitte grober Höhenautoren verwenden
den begrenzten Spline-Nachweis; fehlende Stützwerte bleiben konservativ.

Außen- und Flussgeometrie behalten benötigte Konturen innerhalb unveränderter
Budgets. Der 257-Flüsse-Fall bei 256 Cacheplätzen baut pro weiterem Bild einen
statt 257 Pfade neu. Zoom verwendet Weltkonturen weiter, solange keine Samplebreite
auf 1,5 Bildschirmpixel angehoben wird; der Test prüft auch Konturkoordinaten beim
Grenzübertritt. Die Dichteanzeige unterdrückt binäre Rundungsreste.

Ein Höhenstrich kann mit bereitem Dokumentstatus während des Ansichtslesens
beginnen. Gesperrte Malwerkzeuge verschieben die Karte nicht versehentlich.
Zeichenwerkzeuge übernehmen Zahlenfelder vor dem ersten Karten-Pointerdown;
die reproduzierten Flussknotenbreiten `[20, 2]` nach Eingabe von 2 Fuß sind jetzt
`[2, 2]`. Der Auswahlmodus behält die Reihenfolge für Inspector-Writes und Auswahl.
22 Fluss-/Datei-/Fokuswechseltests und 30 Höhen-/Navigationstests bestehen.
Eine direkte Weltprobe nach freiem Herauszoomen bestätigt 128 Pixel ab Beginn,
sichtbares Land vor Pointerup und vollständiges Undo ohne vorheriges Tab/Enter.

Pinselhinweise zeigen Meter beziehungsweise Kilometer mit höchstens drei
signifikanten Ziffern. Drei bestehende Raum-Browserfälle prüfen die metrischen
Werte, Rasterhinweise, kleine Pinsel und History; die Weltanzeige wurde visuell
geprüft. Bei Überschreitung der Höhengrenze empfiehlt die Meldung jetzt einen
kleineren Pinsel oder kürzere Striche. Fachfehler zeigen keinen technischen
`WireError`-Präfix; Kategorien und strukturierte Fehlerdaten bleiben erhalten.
Die Browserprobe bei 900 × 620 zeigt Ablehnung ohne Autorenänderung und direkt
anschließend erfolgreiches Malen mit kleinerem Pinsel. Beide Zustände behalten
38 Pixel Statuszeilenhöhe. 429 Frontendtests, 27 Terrain-Rusttests (ein Benchmark
absichtlich ignoriert), Typen, 134 Transportverträge und Format bestehen.
Der frische Release-/RPM-Build besteht ebenfalls (7,52 MiB).

Leere Höhenkachelanfragen zur Versionsprüfung validieren ihre Parameter und
liefern anschließend Status und leere Kachelliste ohne Sampler-/Blockindexarbeit.
Der Regressionstest scheiterte zuvor an einem gesperrten Dirty-Block-Read; er
besteht jetzt ohne Terrainzugriffe und prüft weiterhin ungültige Parameter.
40 Terrain-/Strich-Rusttests (ein Benchmark ignoriert), 17 Präsentationscachetests
und vier Browserfälle für sichtbare Zwischenstände, Welt-Voreinstellung,
freies Zoomen und Malen nach Fehlererholung bestehen. Der frische Release-/RPM-Build
besteht ebenfalls. Keine neue Latenzaussage.

## Offene Abnahmen

Frühere native Prüfungen umfassen Weltmalen, Bodenfarben, Landschaft, Navigation,
Lichtungen, History und Datei-Rundlauf. Neuere Änderungen wurden noch nicht nativ
bedient: Diese Sitzung bietet keinen nativen UI-Zugriff. Das ursprüngliche
Benutzertestfenster bleibt unberührt; Browserprüfungen und Releasebuild ersetzen
die native Abnahme nicht.

Genau eine frühere Vorher-/Nachher-Reihe mit je drei Weltstrichen ist abgeschlossen:
erste sichtbare Änderung 275–304 → 119–134 ms, sichtbare Bestätigung p95
427–516 → 339–376 ms, Nachlauf 259–427 → 231–345 ms. Spätere Änderungen sind darin
nicht enthalten. Das Ziel p95 ≤50 ms bleibt unbelegt; keine weitere Zeitmessreihe.
RPM-Installation, große Stadt-/Weltlastfälle und umfangreicher Release-Treiber
bleiben offen. Einzelobjektplatzierung, lokale Verschiebeausnahmen, Feldumrisse
und Assetimporte bleiben Folgeumfang der Landschaftsdeckung.

Belege unter `src-tauri/target/diagnostics/`: insbesondere `landscape-canopy/`,
`landscape-capacity/`, `coarse-flat-proof/`, `landscape-main-integration/`,
`stable-exterior-geometry/`, `terrain-view-load/`, `blocked-brush-navigation/`,
`stable-river-geometry/`, `river-zoom-reuse/`, `field-before-canvas/`,
`readable-brush-distances/`, `landscape-input-review/`, `actionable-brush-limits/`.

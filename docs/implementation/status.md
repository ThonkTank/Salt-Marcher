# Aktueller Stand

Atlas V7, Dateiformat 22, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Geprüfter Produktstand

Landschaftsdeckung für Wald, Buschland, Wiese und Felsgebiet funktioniert auf
allen Außenmaßstäben mit Zieldichte, Lichtungen, grober Vererbung und History.
Boden-/Felsfarbe bleibt unabhängig. Fern erscheinen Flächenfarben, mittlerer Wald
als durchgehendes Blätterdach mit dichteabhängigen Lücken, nahe Bäume als eigene
Federzeichnungen mit unregelmäßigen Kronen und Schraffur. Große Viewports behalten
das Blätterdach, bis Einzelbäume in das gemeinsame Kandidatenbudget passen.
Mittlere Darstellung, 25/65/100-Prozent-Deckung und große Zoomübergänge wurden an
Browserbildern visuell geprüft. Rasterhalos und Geräte-Pixel-Clips sichern Nähte.

Leere Boden-/Landschaftskacheln übertragen keine Pixelnutzlast und erzeugen keine
Zeichenraster. Unsichtbare Boden-, Landschafts-, Gelände- und Stadtdichtekacheln
überspringen ihre teure Verarbeitung. Kleine ebene Ausschnitte grober Höhenautoren
werden durch höchstens vier vollständige konstante Spline-Abschnitte erkannt;
fehlende Stützwerte bleiben konservativ. Der vollständige Rusttestlauf auf diesem
Sampler-Fix besteht, ebenso 27 Landschafts-/Live-Höhen-Browserfälle einschließlich
des zuvor gescheiterten 4K-Ladefalls, ohne verlängerte Zeitlimits.

Der Außengeometriecache behält weiterhin benötigte Konturen innerhalb unveränderter
256 Einträge und 16 MiB. Basis, Auswahl und Vorschau teilen den Abgleich; entfallene
Referenzen geben Platz frei. Die temporäre Schlüsselmenge ist ebenfalls begrenzt.
Ein reproduzierter Fall mit drei Objekten und zwei Plätzen baut jetzt pro weiterem
Bild eine statt drei Konturen neu. Sieben Geometrietests und 18 Stadt-/Straßen-/
Parzellen-Browserfälle bestehen. Daraus wird keine Latenzverbesserung abgeleitet.

## Höhenstrich während eines Ansichtswechsels

Eine schrittweise Browserprobe mit echtem Dokumentkern zeigte: Weltmalen nach
freiem Herauszoomen liefert sichtbare Zwischenstände und vollständiges Undo/Redo.
Ein unmittelbar während des Ansichtswechsels begonnener Strich wurde dagegen
wegen der Darstellungssperre als Verschieben behandelt. Der neue Browsertest
reproduzierte null gestartete Höhenstriche bei zurückgehaltener Weltansicht.

Die Eingabefreigabe verwendet für Außenhöhen jetzt den bereiten Dokumentstatus.
Der Worker liest die Autorenwerte; aktuelle Kamera und Pinsel bestimmen den
Auftrag. Fehlender Status, Dateiaktionen, unsicherer Status und ausstehende Writes
sperren weiterhin den Start. Szenenabhängige Werkzeuge behalten ihre Datensperre.
Alle 421 Frontendtests, Typprüfung und Formatprüfung bestehen. Alle 29 Höhen-/
Navigations-Browserfälle bestehen einschließlich des neuen Tests, unveränderter
Kamera, History, Weltzoom, runder/kräuseliger Küsten, Fehlererholung und Abbruch.
Der frische Release-/RPM-Build besteht ebenfalls (7,52 MiB).

## Integration und offene Abnahmen

Main enthält PR #1450. #1456 bündelt Landschaft und Darstellungsänderungen samt
Sampler-Fix; seine Gesamt-CI läuft noch, Auto-Merge ist aktiv. #1457 ist in dessen
Kandidatenbranch integriert. #1458 enthält die separat geprüfte Geometriecache-
Folgeänderung. Die Höhenfreigabe baut darauf auf. Ältere Kandidaten werden erst
nach belegter Main-Integration als ersetzt geschlossen. Lokales Grün ersetzt
keine vollständige CI-Freigabe.

Frühere native Prüfungen umfassen Weltmalen, Bodenfarben, Landschaft, Navigation,
Lichtungen, History und Datei-Rundlauf. Die neueren Zeichnungen und Änderungen
sind noch nicht nativ bedient: Diese Sitzung bietet keinen nativen UI-Zugriff.
Das ursprüngliche Benutzertestfenster bleibt unberührt. Ein frischer Releasebuild
ersetzt diese Abnahme nicht.

Genau eine frühere Vorher-/Nachher-Reihe mit je drei Weltstrichen ist abgeschlossen:
erste sichtbare Änderung 275–304 → 119–134 ms, sichtbare Bestätigung p95
427–516 → 339–376 ms, Nachlauf 259–427 → 231–345 ms. Spätere Änderungen sind darin
nicht enthalten. Das Ziel p95 ≤50 ms bleibt unbelegt; keine weitere Zeitmessreihe.
RPM-Installation, große Stadt-/Weltlastfälle und umfangreicher Release-Treiber
bleiben offen. Einzelobjektplatzierung, lokale Verschiebeausnahmen, Feldumrisse
und Assetimporte bleiben Folgeumfang der Landschaftsdeckung.

Belege unter `src-tauri/target/diagnostics/`: `landscape-canopy/`,
`landscape-capacity/`, `compact-empty-ground/`, `terrain-visibility/`,
`city-density-visibility/`, `coarse-flat-proof/`, `landscape-main-integration/`,
`stable-exterior-geometry/` und `terrain-view-load/`.

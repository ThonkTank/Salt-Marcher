# Aktueller Stand

Atlas V7, Dateiformat 21, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Aktuelle Arbeit: gemeinsamer Höhenleser für Straßen

Der Straßenplaner verwendet jetzt denselben begrenzten kanonischen Blockleser wie
Gelände und Flüsse. Vollständige Höhenraster je besuchtem 160-Fuß-Feld entfallen.
Gewässer und Flussbetten behalten ihre bestehenden räumlich begrenzten Leser;
Routensuche, Bewertungsfunktion und gespeicherte Straßen bleiben unverändert.

Sieben vorhandene Rustfälle für Straßen/Geländefolge bestehen. Ein zusätzlicher
Fall vergleicht lokale Autoren über grobem Gelände an negativen Koordinaten und
vier Regionsgrenzen mit der bisherigen Rasterreferenz: gleiche Höhen, höchstens
1280 geladene Kontrollwerte und keine weiteren Kontrollwertreads bei 500
wiederholten Abfragen. Der Browserfall für Geländefolge, Zoom, Übernahme und
Undo/Redo besteht ebenso wie Clippy und der Release-/RPM-Build. Nativ unter
Linux/X11/WebKit geprüft: Umfahren eines Hügels, Übernahme samt Bebauung,
Undo/Redo und Speichern. Die vollständige Suite wurde für diese isolierte
Leserumstellung nicht erneut ausgeführt.
Keine zusätzliche Messreihe oder neue Cacheebene. Belege unter
`src-tauri/target/diagnostics/road-sampler-*`.

Schnee und getrennte Boden-/Felsfarben sind im vorherigen Commit geprüft:
358 Rustfälle (fünf vorhandene Last-/Fixturefälle ignoriert), 377 Frontendfälle,
37 Browserfälle, Typen, Clippy, Format, 130 Verträge und Release-/RPM-Build.
Nativ geprüft sind beide Farbebenen, Schnee, Radieren, Undo/Redo und Zoom;
Wiederöffnen im finalen Build erhält den geprüften Kartenausschnitt pixelgleich.
Das geöffnete Material-Testfenster bleibt erhalten. Dateiformat 21 ersetzt 20
ohne Migration von Entwicklungsdateien. Materialbelege liegen unter `materials-*`.

## Bestehender Stand und Grenzen

Der kräuselige Land-/Meerpinsel ist über PR #1448 integriert. Boden in allen
Außenmaßstäben ist ebenfalls enthalten und lokal sowie nativ geprüft. Die separate
Boden-CI bestand einschließlich RPM; die Integration erfolgt mit dem aktuellen
Gesamtstand. Die zuvor integrierten Änderungen
begrenzen Höhenpakete auf 32 Punkte, lesen räumlich begrenzte Autorenblöcke,
entfernen ungenutzte Höhenübersichten und begrenzen Striche an der Weltkante.

Feinere absolute Autoren behalten Vorrang vor späteren gröberen Änderungen.
Relief unter Meeresspiegel erscheint unter Wasser. Die vorhandenen Kontrollwert-
und Weltgrenzen bleiben bestehen. Nicht alle Kombinationen maximaler Pinselbreite,
Reliefhöhe und Strichlänge sind nativ geprüft.

Genau eine frühere Vorher-/Nachher-Reihe mit je drei Weltstrichen ist abgeschlossen:
erste sichtbare Änderung vorher 275–304 ms, danach 119–134 ms; sichtbare Bestätigung
p95 vorher 427–516 ms, danach 339–376 ms; Nachlauf vorher 259–427 ms, danach
231–345 ms. Spätere Änderungen sind darin nicht enthalten. Das Ziel p95 ≤50 ms
ist nicht belegt; keine weitere Zeitmessreihe wurde begonnen.

RPM-Installation, große Stadt-/Weltlastfälle und der umfangreiche Release-Treiber
mit neun Fixtures bleiben offen. Aktuelle Belege: `src-tauri/target/diagnostics/features-*`
und `playwright-*/`; vorherige Belege unter `ground-*`, `crinkled-*`,
`manual-world-*` und `world-brush/` im selben ignorierten Verzeichnis.

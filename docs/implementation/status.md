# Aktueller Stand

Atlas V7, Dateiformat 21, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Aktuelle Arbeit: konstante Höhenraster ohne Einzelabfragen

Das 33×33-Relief-/Konturgitter verwendet jetzt den vorhandenen adaptiven
Rasterkern. Nachweislich konstante Bereiche benötigen keine einzelnen Höhenreads;
Flussbetten und Hausplattformen werden weiterhin anschließend je Knoten angewendet.
Ein Referenztest vergleicht alle Knoten exakt mit dichter Abtastung für Ozean,
konstantes Land, Gefälle und gemischte sparse Autorenauflösungen an negativen
Koordinaten und Kachelgrenzen. Konstante Testflächen laden keine Autorenpayloads.

330 Rust-Bibliotheksfälle (fünf bestehende Lastfälle ignoriert), Clippy und 37
Browserfälle bestehen, einschließlich Weltmalerei nach Mausrad-Zoom, Materialien,
Flussbearbeitung, Fundamente und History. Typprüfung, Format und Release-/RPM-Build
bestehen. Nativ geprüft: Ozean, Wiederöffnen mit pixelgleichem Fluss-/Seekartenausschnitt
zum vorherigen Build, Mausradnavigation und sichtbarer Landauftrag während des
Ziehens in Welt. Undo entfernt den Strich; Redo stellt ihn pixelgleich wieder her.
Belege unter `src-tauri/target/diagnostics/relief-grid-audit/`.
Keine zusätzliche Latenzmessreihe; das Zeitabnahmeziel bleibt offen.

## Geprüfte vorherige Änderungen

Flussprofile verwenden für eine unveränderte punktlokale Gewässerauswahl einmal
vorbereitete Polygone. Ein Auswahlwechsel ersetzt den bisherigen Bestand;
es entsteht kein wachsender oder dokumentweiter Kontaktcache. Straßenregionen
halten vorbereitete Seegeometrie statt sie bei jeder Wegprobe neu aufzubauen.
Räumliche RTree-Auswahl, Konturlimits, vorgeschlagene Gewässeränderungen,
Randkontakt und kleinster überlappender Pegel bleiben erhalten.

30 Wasserfälle, 19 Flussfälle, acht Straßen-/Geländefälle und Clippy bestehen.
Neue Referenzfälle prüfen Inseln, Löcher, Ufer, überlappende Pegel, Ersatz/Löschung,
Lesegrenzen und einen frischen Leser nach Autorenänderung. 100 Kontakte bei
identischer Auswahl bereiten die Geometrie nur einmal vor; eine leere Auswahl
verwirft den bisherigen Bestand. 15 betroffene Browserfälle, Typprüfung, Format
und der frische Release-/RPM-Build bestehen. Nativ geprüft: Fluss in See zeichnen,
Gewässer bearbeiten, Undo/Redo und Speichern/Wiederöffnen. Der gespeicherte
Kartenausschnitt bleibt nach Wiederöffnen pixelgleich.
Keine neue Latenzmessreihe. Belege unter `src-tauri/target/diagnostics/water-contact-*`.

Die vorherige Straßenumstellung auf den gemeinsamen Höhenleser ist mit acht
Rustfällen, einem Browserfall, Clippy, RPM und nativer Bedienung geprüft.
Vollständige Höhenraster pro Straßenregion entfallen. Referenzvergleiche an vier
Regionsgrenzen bestätigen gleiche Höhen und wiederverwendete Kontrollwerte.
Belege unter `road-sampler-*`.

Die CI des vorherigen Standes bestand mit 359 Rustfällen, 377 Frontendfällen,
130 Verträgen und 237 Browserfällen; ein Welt-Bodentest scheiterte an veralteten
Bildschirmkoordinaten nach dem Mausrad-Zoom. Das Fehlerartefakt zeigt den Strich
außerhalb des vorbereiteten Landes. Der Test wartet jetzt auf die neue
Kamerageneration und prüft vor dem Malen Land; drei Wiederholungen bestehen.
Die vollständige CI des neuen Standes steht noch aus.

Schnee und getrennte Boden-/Felsfarben sind im vorherigen Commit geprüft:
358 Rustfälle (fünf vorhandene Last-/Fixturefälle ignoriert), 377 Frontendfälle,
37 Browserfälle, Typen, Clippy, Format, 130 Verträge und Release-/RPM-Build.
Nativ geprüft sind beide Farbebenen, Schnee, Radieren, Undo/Redo und Zoom;
Wiederöffnen im finalen Build erhält den geprüften Kartenausschnitt pixelgleich.
Dateiformat 21 ersetzt 20
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

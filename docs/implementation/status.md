# Aktueller Stand

Atlas V7, Dateiformat 21, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Aktuelle Arbeit: Schnee, Fels und getrennte Farbebenen

Hohe Gipfel erhalten Schnee zwischen 3500 und 5000 Metern, steile Hänge Fels
zwischen 30 und 45 Grad. Der Bodenpinsel wählt unabhängig gespeicherte Boden- oder
Felsfarbe. Pipette und Radierer arbeiten auf der gewählten Ebene; Schnee bleibt
über beiden. Höhenänderungen steuern die Sichtbarkeit, ohne Pigment zu löschen.
Die zwei RGBA-Ebenen teilen Autorenkacheln, Pyramide, Vorschau, History und
Persistenz. Dateiformat 21 ersetzt 20 ohne Migration der Entwicklungsdateien.

Materialdeckung und Beleuchtung entstehen aus den vorhandenen Reliefknoten und
werden als kleines 35×35-RGB-Gitter mit Rand übertragen. Keine zusätzliche
Höhenabtastung, kein neuer Worker und keine weitere Cacheebene. Das vorhandene
Darstellungsbudget erhält die maximale Rasterauflösung.

Die vollständige Rustsuite besteht mit 358 Fällen (fünf vorhandene Last-/Fixturefälle
ignoriert), die Frontendsuite mit 377 Fällen. Neue Fälle prüfen physische
Materialschwellen, Kachelränder, getrennte Farben, Auflösungsvererbung,
Vorschau, Undo/Redo und Datei-Rundlauf. Typprüfung, Clippy und 130 Transportverträge
bestehen. Alle 37 Browserfälle für Materialien, Boden, direkte Höhenstriche,
Küsten und Kachelinvalidierung bestehen.

Nativ unter Linux/X11/WebKit geprüft: eigene Berggröße mit hohen Gipfeln und
steilen Hängen, Fels übermalen, Boden getrennt übermalen, Schnee erhalten,
Fels radieren, Undo/Redo sowie Heraus-/Hineinzoomen. Speichern/Wiederöffnen erhält
den geprüften Kartenausschnitt pixelgleich; auch Undo stellt den verglichenen
Ausschnitt exakt wieder her. Der Release-/RPM-Build besteht;
die Anwendung bleibt mit `materials-native-final.saltatlas` geöffnet.
Belege liegen unter `src-tauri/target/diagnostics/materials-*`. Keine neue Messreihe
und keine vollständige native Prüfung aller Material-/Maßstabskombinationen.

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

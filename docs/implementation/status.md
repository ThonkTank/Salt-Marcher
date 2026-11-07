# Aktueller Stand

Atlas V7, Dateiformat 21, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Aktuelle Arbeit: zeilenlokale Seenrasterung

Uferkanten werden einmal nach ihrer unteren Y-Grenze geordnet. Die Rasterung
wertet nur Kanten aus, welche die aktuelle Subpixelzeile kreuzen. Polygon-/Loch-
zuordnung, minimale überlappende Pegel, direkte Schnittformel und Halo bleiben
unverändert. Jede Kante wird höchstens einmal gespeichert; der Pegelzeilenpuffer
wird wiederverwendet. Es entsteht kein persistenter Cache.

Ein Referenztest vergleicht mit dem bisherigen vollständigen Ringscan, einschließlich
exakter Eckpunkte, Lochränder, überlappender Pegel und negativer/großer Koordinaten.
Bei seiner detaillierten Kontur bleiben weniger als 2.048 aktive Kantenbesuche
gegenüber 299.280 bisherigen Zeilen-/Kantenprüfungen. Das ist ein Arbeitsnachweis,
keine Zeitmessung. Zwölf Rasterfälle, 21 Wasserfälle, acht Browserfälle, Clippy,
Typen, Format und Release-/RPM-Build bestehen. Nativ bleiben Detail- und
herausgezoomter Fluss-/Seekartenausschnitt pixelgleich zum vorherigen Build;
Mausradnavigation hin und zurück funktioniert. Belege unter
`src-tauri/target/diagnostics/lake-raster-audit/`.

## Integrierter Stand

PR #1450 ist auf Main (`1f5767ba5`) integriert. Die vollständige CI des geprüften
Heads `22dfa9b10` besteht: 362 Rustfälle (fünf Lastfälle ignoriert), 377 Frontendfälle,
238 Browserfälle, 130 Verträge, Typen, Clippy, Format, Webbuild und RPM.
Der Welt-Bodentest wartet nach Mausrad-Zoom auf die neue Kamerageneration;
auch dieser Bedienweg besteht in der vollständigen Suite.

Enthalten sind die Reliefpinsel Bergkette/Hügel/Schlucht, Bodenmalerei in allen
Außenmaßstäben, Schnee und getrennte Boden-/Felsfarben. Straßen und Flüsse teilen
den kanonischen Blockleser; Gewässerkontakte verwenden vorbereitete Geometrie
innerhalb ihrer begrenzten lokalen Auswahl. Konstante natürliche Reliefgitter
verwenden die vorhandene adaptive Rasterabtastung statt einzelner Höhenreads.
Die oben beschriebene zeilenlokale Seenrasterung folgt separat in PR #1451;
ihre vollständige CI auf der neuen Main-Basis steht noch aus.

Native Belege umfassen Weltmalerei vor Pointerup, beide Farbebenen, Schnee,
Radierer, Navigation, Straßen mit Bebauung, Flusskontakt, Undo/Redo und
Speichern/Wiederöffnen. Verglichene gespeicherte Kartenausschnitte bleiben
pixelgleich. Die aus dem RPM entpackte Anwendung startet korrekt; Desktopstarter,
Bibliotheken und Paketinhalt sind geprüft, keine Systeminstallation.
Dateiformat 21 ersetzt 20 ohne Migration von Entwicklungsdateien.
Belege unter `materials-*`, `road-sampler-*`, `water-contact-*` und
`relief-grid-audit/` im ignorierten Diagnoseverzeichnis.

## Bestehender Stand und Grenzen

Der kräuselige Land-/Meerpinsel ist über PR #1448 integriert. Boden in allen
Außenmaßstäben ist über PR #1450 integriert. Weitere integrierte Änderungen
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

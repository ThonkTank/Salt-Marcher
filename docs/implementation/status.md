# Aktueller Stand

Atlas V7, Dateiformat 20, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Aktuelle Arbeit: Bergketten, Hügel und Schluchten

Drei neue Höhenmodi erzeugen Relief entlang eines Strichs. Größenvorlagen koppeln
physische Breite und Reliefhöhe/-tiefe; beide bleiben einzeln in Metern einstellbar.
Die Ansicht passt sich beim Vorlagenwechsel an den Pinsel an. Zoomen verändert die
reale Breite nicht. Wiederholtes Malen verstärkt das Relief, insbesondere Hügel.
Die vorhandene Abschnittsqueue, bestätigte Zwischenstände, Autorenhierarchie und
ein Undo-Schritt pro Strich bleiben erhalten. Keine neue Vorschau-, Worker- oder
Messarchitektur; das Dateiformat bleibt unverändert.

Ein neuer Pakettest deckte einen vorhandenen Fehler beim Ergänzen grober Autoren
auf: Fehlende Werte erbten auch Nachbarn desselben Levels. Jetzt erben sie nur
höhere Level; Paketgrenzen erzeugen keinen zusätzlichen Höhenauftrag.

Die vollständige Rustsuite besteht mit 355 Fällen (fünf vorhandene Last-/Fixturefälle
ignoriert), die Frontendsuite mit 376 Fällen. Nach der abschließenden Formkorrektur
bestehen die zwei neuen Rustfälle nochmals sowie alle 25 Browserfälle für neue
und bisherige direkte Höhenmodi. Die Browserfälle prüfen Größenwahl, sichtbare
Zwischenstände ohne Warten nach Pointerdown, Undo/Redo, Werkzeugwechsel und
Weltmalerei nach manuellem Herauszoomen. Typprüfung, Clippy, Formatprüfung,
129 Transportverträge und finaler Release-/RPM-Build bestehen.

Nativ unter Linux/X11/WebKit geprüft: gekrümmte Bergketten, kleine Berge,
Alpenmassiv/Achttausender, Hügel mit wiederholtem Auftrag, Schluchten im Relief,
eigene Tiefe, Größenwechsel, Höhenlinien, Gewässerwechsel und manuelles Zoomen
mit Rückkehr zur Pinselgröße. Sichtbare Gitterrichtungen im ersten Formfeld wurden
durch räumliches Drehen und Verzerren reduziert und erneut nativ beurteilt.
Hügel-Undo/Redo im ersten Build sowie ein weiterer Bergstrich mit Undo/Redo im
finalen Build stellen die geprüften Kartenausschnitte pixelgleich her. Auch
Speichern/Wiederöffnen im finalen Build erhält den verglichenen Ausschnitt exakt.
Der frische Build bleibt mit `features-native-final.saltatlas` zum Testen geöffnet.
Keine neue Zeitmessreihe; keine vollständige native Prüfung aller Kombinationen.

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

# Aktueller Stand

Atlas V7, Dateiformat 19, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Aktuelle Optimierung

Die Wasserabdeckung natürlicher Oberflächen verwendet die bestehenden
Höhenintervalle, um sicher vollständig trockene oder bedeckte Bereiche zu erkennen.
Dort entfallen dichte Höhenabfragen; Küsten werden weiter exakt abgetastet.
Die Prüfung berücksichtigt den Antialiasing-Gradienten, nicht nur das Vorzeichen.
Relief und Höhenlinien behalten ihre echte Höhenabtastung. Lokale Gewässer,
Flüsse und Hausplattformen verwenden weiterhin den vollständigen Rasterpfad.
Es gibt keine zusätzliche persistente Cacheebene oder Messinfrastruktur.

Ein direkter Vergleich mit dem bisherigen dichten Pfad liefert bytegleiche
Wasser-/Reliefbilder, identische Höhenlinien und Diagnosehöhen für unebene
Land-/Meeresflächen, schräge Küsten und dünn belegte Inselkontrollwerte.
Zwei unebene Flächen fern der Küste benötigen keine der sonst 17.161 dichten
Höhenabfragen eines 128er Rasters einschließlich Rand. Die konservativen
Blockintervalle sparen an manchen schrägen Küsten dagegen nur wenig Arbeit.
Alle 323 Rusttests bestanden; nach der abschließenden Trennung von regulärem
Raster und Pixelrand wurden die acht Rastertests einschließlich Küstenmatrix
nochmals geprüft. Alle 21 gezielten Browserfälle für Live-Striche, Weltkarte,
Küsten und Gewässer bestehen. Ein vorheriger Weltfall lief während des parallelen
Release-Baus in den Abschluss-Timeout; der erneute sequenzielle Lauf ist grün.
Clippy, Formatprüfung und frischer Release-/RPM-Build bestehen. Der endgültige
native Build zeigt bei 1440×960 mit dem 80-Pixel-Weltpinsel erneut zwei wachsende
Zwischenstände vor dem Loslassen; Undo stellt die leeren Kartenpixel wieder her,
Redo entspricht dem abgeschlossenen Strich. Dies ist eine Funktionsprüfung.
Es wurde keine zusätzliche Zeitmessreihe gestartet.

## Bestehender geprüfter Stand

[PR #1438](https://github.com/ThonkTank/Salt-Marcher/pull/1438) ist auf `main`
integriert. Der exakte Kandidat bestand 129 Transportverträge, Typprüfung,
363 Frontend-, 321 Rust- und 224 Browsertests sowie Clippy, Format, Webbuild
und Release-/RPM-Build. Fünf Rustfälle bleiben ausdrücklich ignoriert.
Die ursprüngliche lokale Historie bleibt in `codex/atlas-v7-preserved-histories`.

Dichtekacheln lesen höchstens ihre 32×32 Zellen über den vorhandenen Index;
entfernte Bebauung im gleichen Nord-Süd-Streifen verursacht keinen linearen Scan.

Höhenstriche verwenden begrenzte 32-Punkte-Pakete, exakte räumliche
Land-/Meerberechnung und bestätigte Zwischenstände. Unbenutzte Höhenübersichten
sind entfernt; Raster-, Relief-, Zeichen- und Beschriftungsarbeit ist reduziert.
Verspätete Resize-Meldungen dürfen keine neue Geste abbrechen. Freier Doppelklick
kann aktuelle Geometrie am Anker nutzen, während der neu sichtbare Rand noch lädt.

Der frische native Build bestätigte den 80-Pixel-Weltstrich mit zwei sichtbaren
Zwischenständen, vollständigem Undo/Redo, die erste Hausgeste nach Werkzeugwechsel
und den freien Doppelklick Haus → Raum beim Abwählen des Hauses (900×620).
Diese Funktionsprüfungen ersetzen keine vollständige native Bedienabnahme.

Genau eine kleine Release-Vergleichsreihe mit je drei identischen Weltstrichen
(1440×960, DPR 1, 80-Pixel-Landpinsel) ist abgeschlossen. Erste sichtbare Änderung:
vorher 275–304 ms, danach 119–134 ms. Sichtbare Bestätigung p95: vorher
427–516 ms, danach 339–376 ms. Nachlauf nach Loslassen: vorher 259–427 ms,
danach 231–345 ms. Das 50-ms-Ziel ist noch nicht erreicht. Spätere kleinere
Darstellungskacheln und lokale Zeichenoptimierungen sind in diesen Zeitwerten
nicht enthalten; keine zusätzliche Messreihe gestartet.

## Offene Abnahme und nächste Arbeit

Native Datei-/Eingabeabnahme über die geprüften Fälle hinaus,
RPM-Installation und große Stadt-/Weltlastfälle
bleiben offen. Der umfangreiche Release-Treiber mit neun Fixtures wurde hier
nicht ausgeführt.

Nächster Schwerpunkt bleibt das 50-ms-Ziel für bestätigte Pinselbilder.
Die Hausfilterabfrage kann weiterhin globale Arbeit bei lokalen Kartenreads
verursachen; ein ausschließlich räumlicher Zugriff wurde wegen des gegenteiligen
Risikos in Weltansichten verworfen. Eine Lösung muss beide Fälle begrenzen.
Der native Direktstrich zeigt bei ausstehenden Writes noch die allgemeinen
Übernehmen-/Abbrechen-Aktionen; die Darstellung sollte dem Direktstrichvertrag folgen.

Aktuelle Belege: `src-tauri/target/diagnostics/ocean-*` (Logs und native Bilder).
Dichtebelege: `src-tauri/target/diagnostics/density-*.log`.
Vorige Mess- und native Belege: `src-tauri/target/diagnostics/world-brush/`.
Browserbelege: `src-tauri/target/diagnostics/playwright-*/`.

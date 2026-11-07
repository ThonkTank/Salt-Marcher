# Aktueller Stand

Atlas V7, Dateiformat 19, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Aktuelle Optimierung

Die Bebauungsdichte einer Übersichtskachel wird über 32 feste X-Werte und
jeweils den lokalen Y-Bereich des vorhandenen Primärschlüssels gelesen.
Eine Kachel betrachtet damit höchstens ihre 32×32 Dichtezellen. Entfernte
Bebauung im gleichen Nord-Süd-Streifen verursacht keinen linearen Scan mehr.
Darstellung, Priorisierung, History, Dateiformat und Cachebesitzer bleiben erhalten;
es gibt keinen zusätzlichen Index und keine neue Messinfrastruktur.

Der neue Regressionstest vergleicht die vollständigen Kachelinhalte mit einer
einfachen Referenz einschließlich negativer Koordinaten, Zellgrenzen und
Deckungssättigung. Zusätzlich prüft er den SQLite-Arbeitsaufwand nach dem
Einfügen von 20.000 entfernten Dichtezellen. Vor der Korrektur stieg dieser von
379 auf 1.381 Blöcke à 100 VM-Anweisungen; die begrenzte Abfrage besteht den
Arbeitsbudgettest. Dies ist ein deterministischer Zugriffstest, keine Latenzmessung.
Alle acht aktiven Kartenkern-Tests bestehen; das große Stadtbenchmark bleibt opt-in.
Auch alle 321 Rusttests, Clippy und Formatprüfung sowie die neun Browserfälle
für Stadtübersicht und Kachelinvalidierung bestehen lokal. Die vollständige
CI-Freigabe erfolgt über den verpflichtenden Check am exakten PR-Head.

## Bestehender geprüfter Stand

[PR #1437](https://github.com/ThonkTank/Salt-Marcher/pull/1437) ist auf `main`
integriert. Der exakte Kandidat bestand 129 Transportverträge, Typprüfung,
363 Frontend-, 320 Rust- und 224 Browsertests sowie Clippy, Format, Webbuild
und Release-/RPM-Build. Fünf Rustfälle bleiben ausdrücklich ignoriert.
Die ursprüngliche lokale Historie bleibt in `codex/atlas-v7-preserved-histories`.

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

Aktuelle Belege: `src-tauri/target/diagnostics/density-*.log`.
Vorige Mess- und native Belege: `src-tauri/target/diagnostics/world-brush/`.
Browserbelege: `src-tauri/target/diagnostics/playwright-*/`.

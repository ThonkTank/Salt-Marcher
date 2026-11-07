# Aktueller Stand

Atlas V7, Dateiformat 19, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Aktuelle Optimierung

Direkte Höhenstriche besitzen im Editor einen eigenen Gestenzustand ohne
Vorschaukandidat, Prüfphase oder veraltbare Basisrevision. Bestätigte Abschnitte
setzen die Geste fort. Die irreführenden Übernehmen-/Abbrechen-Aktionen erscheinen
auch bei ausstehenden Writes nicht mehr. Der frühere optionale Vorschau-Ersatzpfad
für Höhengesten entfällt; Gewässer behalten ihre tatsächliche Vorschau.

Alle 368 Frontendtests, Typ- und Formatprüfung sowie 26 Browserfälle bestehen
lokal. Die Abdeckung umfasst 100 Eingaben über bestätigte Revisionen, Abschluss
an Lebensdauergrenzen, verzögerte Begin-/Append-Antworten, kontinuierliche
Weltstriche, Undo/Redo und unveränderte Gewässervorschauen. Ein bestehender
Geschoss-Pixeltest wartet jetzt auf die bereits vorhandene Zeichenbestätigung
statt nur auf Datenbereitschaft; sämtliche Pixelassertionen bleiben erhalten.
Der frische native Release-/RPM-Build bestätigt den 80-Pixel-Weltstrich mit
sichtbaren Zwischenständen ohne Entwurfsaktionen sowie vollständigem Undo und
pixelgleichem Redo. Die Freigabe auf Main erfordert den vollständigen grünen
CI-Check am exakten PR-Head. Es wurde keine weitere Zeitmessreihe gestartet.

## Bestehender geprüfter Stand

[PR #1441](https://github.com/ThonkTank/Salt-Marcher/pull/1441) ist auf `main`
integriert. Der exakte Kandidat bestand 129 Transportverträge, Typprüfung,
363 Frontend-, 329 Rust- und 224 Browsertests sowie Clippy, Format, Webbuild
und Release-/RPM-Build. Fünf Rustfälle bleiben ausdrücklich ignoriert.
Die ursprüngliche lokale Historie bleibt in `codex/atlas-v7-preserved-histories`.

Die vorbereitenden Pinselreads sammeln Autorenblöcke je Abschnitt und
Quellauflösung einmal. Blockreads und Blattaktualisierungen verlangen die
vorhandenen räumlichen SQL-Indizes; entfernte Werte verursachen dort keinen
globalen Level- oder Spaltenscan. Zeilenmasken bewahren exakt die bisherigen
Lesebereiche samt Spline-Stützrand. Allgemeine großflächige Terrain-Reads
verwenden weiterhin den bisherigen Rechteckpfad.

Hausübersichten filtern Ort und Sichtbarkeit gemeinsam über einen abgeleiteten
RTree. Entfernte wichtige Häuser und im Maßstab zu kleine Gebäude erreichen die
Sortierung nicht mehr. Exakte Größenwerte sichern die bisherige Sichtbarkeit
an Rundungsgrenzen; höchstens 128 priorisierte Hausheader werden geladen.

Die Wasserabdeckung natürlicher Oberflächen spart dichte Höhenabfragen, wenn
vorhandene Höhenintervalle vollständige Bedeckung oder Trockenheit einschließlich
Antialiasing beweisen. Küsten, Relief und Höhenlinien bleiben unverändert;
lokale Gewässer, Flüsse und Plattformen behalten den vollständigen Rasterpfad.
Referenztests vergleichen Wasser-/Reliefbilder und Konturen direkt.

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
danach 231–345 ms. Das 50-ms-Ziel ist bislang nicht belegt. Alle späteren Optimierungen sind in
diesen Zeitwerten nicht enthalten; der aktuelle Gesamtstand wurde nicht neu
vermessen.

## Offene Abnahme und nächste Arbeit

Native Datei-/Eingabeabnahme über die geprüften Fälle hinaus,
RPM-Installation und große Stadt-/Weltlastfälle
bleiben offen. Der umfangreiche Release-Treiber mit neun Fixtures wurde hier
nicht ausgeführt.

Nächster Schwerpunkt bleibt das 50-ms-Ziel für bestätigte Pinselbilder.
Nächster lesender Prüfpunkt sind allgemeine große Terrain-Autorenreads für
Straßen, Gewässer und Plattformen. Sie dürfen weder entfernte Spalten durchsuchen
noch große leere Rechtecke blockweise enumerieren.

Aktuelle Belege: `src-tauri/target/diagnostics/direct-state-*`.
Terrain-Read-Belege: `src-tauri/target/diagnostics/brush-reads-*`.
Hausindexbelege: `src-tauri/target/diagnostics/house-index-*.log`.
Rasterbelege: `src-tauri/target/diagnostics/ocean-*` (Logs und native Bilder).
Dichtebelege: `src-tauri/target/diagnostics/density-*.log`.
Vorige Mess- und native Belege: `src-tauri/target/diagnostics/world-brush/`.
Browserbelege: `src-tauri/target/diagnostics/playwright-*/`.

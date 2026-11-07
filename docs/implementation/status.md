# Aktueller Stand

Atlas V7, Dateiformat 19, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Aktuelle Optimierung

Grobe Höhenänderungen begrenzen die Gewässernachführung auf die Überlappung
geänderter Spline-Einflussbereiche mit Gewässerbounds. Ein unberührter See im
gemeinsamen Änderungsrechteck blockiert einen Strich nicht mehr. Große Seen
können lokal bearbeitet werden, solange die tatsächlich ausgewählte Rastermenge
im Abschnittsbudget bleibt. Metadatenabfragen verwenden den bestehenden RTree;
Konturen werden einmal je betroffenem Gewässer geladen. Die Uferberechnung nutzt
direkt kanonische Höhen aus lokalen und groben Autoren. Die bisherige zusätzliche
Interpolation temporär erzeugter lokaler Kontrollwerte entfällt. Bestätigte
Kacheln geteilter Seen enthalten jedes Gewässer einmal und in derselben
Reihenfolge wie ein frischer Read; eine zuvor reproduzierte Duplizierung neuer
Teilgewässer ist korrigiert.

Alle 339 Rusttests bestehen lokal. Neue Regressionen decken diagonale und
lückenhafte Änderungen, negative Koordinaten, Blockgrenzen, gemischte
Autorenauflösungen, frühe Budgetablehnung, Überlappungszählung und große Seen ab.
Küsten stimmen exakt mit der direkten kanonischen Berechnung überein. Ein
Referenzfall unterscheidet ausdrücklich die frühere zweite Interpolation.
Die Teilungsregression vergleicht komplette bestätigte Kacheln mit frischen Reads,
auch mit einem unveränderten weiteren See im Ausschnitt.
Undo/Redo und injizierte Schreibfehler prüfen fehlende Autoren und Gewässer
zusammen. Clippy, Typ- und Formatprüfung, 129 Transportverträge und 24 Browserfälle bestehen
lokal. Der neue Browserfall bearbeitet einen großen L-förmigen See mit groben
Höhen, erhält lokale Wasserflächen und prüft die Oberflächen über Undo/Redo.
Der frische native Release-/RPM-Build bestätigt lokale Gewässer im
20-Fuß-Höhenraster sowie pixelgleiches Undo/Redo. Die Freigabe auf Main erfordert
den vollständigen grünen CI-Check am exakten PR-Head. Keine zusätzliche
Zeitmessreihe wurde begonnen.

## Bestehender geprüfter Stand

[PR #1443](https://github.com/ThonkTank/Salt-Marcher/pull/1443) ist auf `main`
integriert. Der exakte Kandidat bestand 129 Transportverträge, Typprüfung,
368 Frontend-, 333 Rust- und 226 Browsertests sowie Clippy, Format, Webbuild
und Release-/RPM-Build. Fünf Rustfälle bleiben ausdrücklich ignoriert.
Die ursprüngliche lokale Historie bleibt in `codex/atlas-v7-preserved-histories`.

Die Gewässernachführung überspringt Höhenreads ohne Kandidaten und prüft nur
Rasterzellen an den jeweiligen Gewässerbounds. Der frische native Release-/RPM-
Build bestätigte einen durch Höhen geteilten See mit pixelgleichem Undo/Redo.

Direkte Höhenstriche besitzen einen eigenen Gestenzustand ohne Vorschaukandidat,
Prüfphase oder veraltbare Basisrevision. Bestätigte Abschnitte setzen die Geste
fort; irreführende Übernehmen-/Abbrechen-Aktionen entfallen auch bei ausstehenden
Writes. Gewässer behalten ihre tatsächliche Vorschau. Der frische native Build
bestätigte den 80-Pixel-Weltstrich mit sichtbaren Zwischenständen, vollständigem
Undo und pixelgleichem Redo.

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
Nächster lesender Prüfpunkt ist die Darstellungsregel bestätigter Oberflächen:
Bei Gewässer-/Flussdeltas wird auch in groben Stufen ein Overlay verwendet,
während frische Reads dort Übersichten nutzen. Gleiche Darstellungsbudgets und
Ergebnisse müssen über diese beiden Pfade geprüft werden.

Weiterer Prüfpunkt ist die Flussnachführung: Ihre Auswahl bei groben
Höhenänderungen verwendet weiterhin ein gemeinsames Änderungsrechteck. Ihr
regionaler Höhensampler liest begrenzte Bereiche über den allgemeinen
Rechteckpfad und durchsucht lokale Override-Werte je neuem Bereich vollständig.
Allgemeine große Terrain-Autorenreads für Straßen, Gewässer und Plattformen
bleiben offen; leere Weltrechtecke dürfen dabei nicht blockweise enumeriert werden.

Aktuelle Belege: `src-tauri/target/diagnostics/water-footprint-*`.
Vorige Gewässerbelege: `src-tauri/target/diagnostics/water-locality-*`.
Gestenzustandsbelege: `src-tauri/target/diagnostics/direct-state-*`.
Terrain-Read-Belege: `src-tauri/target/diagnostics/brush-reads-*`.
Hausindexbelege: `src-tauri/target/diagnostics/house-index-*.log`.
Rasterbelege: `src-tauri/target/diagnostics/ocean-*` (Logs und native Bilder).
Dichtebelege: `src-tauri/target/diagnostics/density-*.log`.
Vorige Mess- und native Belege: `src-tauri/target/diagnostics/world-brush/`.
Browserbelege: `src-tauri/target/diagnostics/playwright-*/`.

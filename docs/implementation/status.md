# Aktueller Stand

Atlas V7, Dateiformat 19, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Aktuelle Korrektur: Höhenpinsel nach manuellem Herauszoomen

Der Nutzer meldete einen leeren Landstrich nach manuellem Herauszoomen. Der
bisherige Welt-Test verwendete nur die feste Ansichtsauswahl. Der neue Mausradfall
bis zum kleinsten Maßstab reproduzierte die Ablehnung: Pinselrand und Spline-
Stützbereich konnten die Weltgrenze überschreiten, obwohl der Startpunkt innerhalb
lag. Lokale und grobe Höhenaufträge schreiben jetzt nur Autoren innerhalb der Welt.
Der Canvas maskiert überstehende Kachelränder; außerhalb erscheint ein Grenzhinweis.
Ungültige Startpunkte bleiben abgelehnt. Arbeits- und Historybudgets gelten weiter.

Ein zweiter reproduzierter Fehler betraf den nächsten Versuch nach einer Ablehnung:
Das Verschwinden der Fehlerschaltfläche änderte die Canvashöhe und beendete den
begonnenen Strich. Die Statusleiste reserviert jetzt die benötigte Höhe.

Lokal bestehen 350 Rust- und 368 Frontendtests, 129 Transportverträge, Typprüfung
und Clippy; fünf Rustfälle bleiben ignoriert. Die 18 übrigen Terrain-/Weltbrowserfälle
bestanden; beide neuen Mausradfälle bestehen nach der Korrektur ebenfalls. Sie
prüfen sichtbare Zwischenstände, vollständigen Strich, Undo/Redo, Weltmaske und den
erneuten Strich nach einer Fehlermeldung. Rust prüft gespeicherte Autoren und exakte
History an positiven/negativen Weltkanten für lokale und grobe Höhenmodi.
Typ- und Formatprüfung sowie Release-/RPM-Build bestehen. Der frische native
Build bestätigte bei 1440×960 nach manuellem Mausradzoom bis 0,000002: einen
abgelehnten Start außerhalb der Welt, anschließend einen durchgehenden
80-Pixel-Landstrich mit sichtbaren Zwischenständen bis an beide Weltkanten.
Undo entfernt den Strich, Redo stellt den Kartenausschnitt pixelgleich wieder her.
Keine neue Messreihe. Die vollständige CI der Korrektur steht noch aus.

Die vorherige Flussoptimierung verwendet den begrenzten Terrain-Sampler auch für
Planung, Nachführung und Import; der separate Regionscache und doppelte
Profilhöhenabfragen entfallen. Konstante dünn belegte Höhenfelder bleiben exakt
konstant, damit Rundung keine flache Flussrichtung umkehrt. Ihre Belege liegen
unter `src-tauri/target/diagnostics/river-sampling-*`.

## Bestehender geprüfter Stand

[PR #1446](https://github.com/ThonkTank/Salt-Marcher/pull/1446) ist auf `main`
integriert. Der exakte Kandidat bestand 129 Transportverträge, Typprüfung,
368 Frontend-, 349 Rust- und 227 Browsertests sowie Clippy, Format, Webbuild
und Release-/RPM-Build. Fünf Rustfälle bleiben ausdrücklich ignoriert.
Die ursprüngliche lokale Historie bleibt in `codex/atlas-v7-preserved-histories`.

Oberflächenvorschauen, bestätigte Höhenabschnitte und frische Reads teilen einen
Kachelpfad mit denselben Übersichtsbudgets. Gewässer-/Flussdeltas umgehen diese
Grenzen nicht mehr. Der native Build bestätigte Flussvorschau, Abbruch, Übernahme,
pixelgleiches Undo/Redo und Umland → Stadt → Umland. Maßstabstests warten auf den
tatsächlich gezeichneten Zielmaßstab statt einen möglicherweise alten Frame.

Die Gewässernachführung überspringt Höhenreads ohne Kandidaten und prüft nur
Rasterzellen an den jeweiligen Gewässerbounds. Grobe Änderungen sammeln die
Vereinigung geänderter Spline-Einflussbereiche; unberührte Seen im gemeinsamen
Rechteck blockieren keine lokale Änderung. Ufer verwenden direkt die kanonische
Oberfläche ohne zweite Interpolation. Bestätigte Teilgewässer sind eindeutig. Der frische native Release-/RPM-
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
Weiterer Prüfpunkt ist die Flussnachführung: Ihre Auswahl bei groben
Höhenänderungen verwendet weiterhin ein gemeinsames Änderungsrechteck. Die
Gewässerkontaktabfrage lädt dagegen weiterhin Konturen je Profilpunkt erneut;
operationslokale Wiederverwendung bereits vorbereiteter Geometrie bleibt zu prüfen.
Allgemeine große Terrain-Autorenreads für Straßen, Gewässer und Plattformen
bleiben offen; leere Weltrechtecke dürfen dabei nicht blockweise enumeriert werden.

Aktuelle Belege: `src-tauri/target/diagnostics/manual-world-*`.
Vorige Belege: `src-tauri/target/diagnostics/surface-consistency-*`.
Vorige Belege: `src-tauri/target/diagnostics/water-footprint-*`.
Vorige Gewässerbelege: `src-tauri/target/diagnostics/water-locality-*`.
Gestenzustandsbelege: `src-tauri/target/diagnostics/direct-state-*`.
Terrain-Read-Belege: `src-tauri/target/diagnostics/brush-reads-*`.
Hausindexbelege: `src-tauri/target/diagnostics/house-index-*.log`.
Rasterbelege: `src-tauri/target/diagnostics/ocean-*` (Logs und native Bilder).
Dichtebelege: `src-tauri/target/diagnostics/density-*.log`.
Vorige Mess- und native Belege: `src-tauri/target/diagnostics/world-brush/`.
Browserbelege: `src-tauri/target/diagnostics/playwright-*/`.

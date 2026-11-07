# Aktueller Stand

Atlas V7, Dateiformat 19, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Aktuelle Funktion: kräuseliger Höhenpinsel

Land und Meer bieten zusätzlich zur runden Spitze „Kräuselig“ mit 5–100 %
Küstenrauheit, Vorgabe beim Einschalten 65 %. Ein ortsgebundenes stetiges Feld
formt Buchten, Landzungen und bei hoher Rauheit vorgelagerte Inselchen innerhalb
des bisherigen Pinselkreises. Der vorhandene räumliche Auftrag, 32-Punkte-Pakete,
bestätigte Zwischenstände und ein Undo-Schritt bleiben erhalten. Gespeichert werden
weiterhin nur Höhenautoren; Dateiformat und Darstellungspipeline ändern sich nicht.
Als Referenz dienten Wonderdrafts Beschreibung automatisch gestalteter Küsten und
die dokumentierte Trennung von glatten und rauen Landwerkzeugen; keine Behauptung
über Wonderdrafts internen Algorithmus oder eine identische Implementierung.

Die erste Desktopfassung war optisch zu weich; mittlere und feine Küstenstruktur
wurden nach Sichtprüfung verstärkt. Der frische Release-/RPM-Build wurde mit
manuellem Mausradzoom bis Welt und zurück, Land/Meer, 16/80/256/512 Pixeln,
65/100 % Rauheit, überlappenden Strichen, Werkzeugwechsel und Escape bedient.
Undo/Redo sowie Speichern/Wiederöffnen stellen den geprüften Kartenausschnitt
pixelgleich wieder her. 512 Pixel erreichten bei einem Maßstab das bestehende
100.000-Kontrollwertlimit; nach Hineinzoomen war der Auftrag möglich. Diese Grenze
bleibt bestehen. Keine neue Zeitmessreihe oder vollständige Bedienabnahme.

Die Gesamtsuite bestand 351 Rust- und 368 Frontendtests sowie 129 Transportverträge
und Typprüfung; ein anschließend ergänzter Anwendungstest sowie der erweiterte
Geometrietest bestehen zusätzlich im finalen Stand (352 Rustfälle insgesamt).
Die neuen Tests vergleichen ganze Striche mit Paketen von 1, 3 und 32 Punkten,
lokale/grobe Autorenauflösungen, wiederholtes Übermalen, negative Koordinaten,
Rauheit null und ungültige Parameter sowie genaue Autorenwerte nach Undo/Redo.
27 relevante Browserfälle, die abschließende Formatprüfung und Clippy bestehen.
Die vollständige CI der neuen Funktion steht noch aus.

## Bestehender geprüfter Stand

[PR #1447](https://github.com/ThonkTank/Salt-Marcher/pull/1447) ist auf `main`
integriert. Der exakte Kandidat bestand 129 Transportverträge, Typprüfung,
368 Frontend-, 350 Rust- und 229 Browsertests sowie Clippy, Format, Webbuild
und Release-/RPM-Build. Fünf Rustfälle bleiben ausdrücklich ignoriert.
Die ursprüngliche lokale Historie bleibt in `codex/atlas-v7-preserved-histories`.

Höhenstriche begrenzen ihren Auftrag an der Weltkante, statt bei überstehendem
Spline-Stützrand vollständig zu scheitern. Der Canvas kennzeichnet den Bereich
außerhalb der Welt; die Statusleiste behält beim Verschwinden einer Fehlermeldung
ihre Höhe, damit der nächste Strich nicht durch Resize abbricht. Beide Fehler
wurden nach Nutzerrückmeldung mit manuellem Herauszoomen reproduziert und behoben.

Flussplanung, Nachführung und Import teilen den begrenzten Terrain-Sampler;
doppelte Profilhöhenabfragen und der separate Regionscache entfallen.

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

Aktuelle Belege: `src-tauri/target/diagnostics/crinkled-*`.
Vorige Belege: `src-tauri/target/diagnostics/manual-world-*`.
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

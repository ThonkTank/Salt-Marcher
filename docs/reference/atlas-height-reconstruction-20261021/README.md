# Gemeinsame begrenzte Höhenrekonstruktion

Stand: 21.10.2026. Der bestehende Hauptatlas erhält dieselbe begrenzte kubische Kurve in Punktabfragen und gestreamten Höhen. Die ältere bilineare Rekonstruktion und der isolierte Vorvergleich bleiben in [der vorigen Messung](../atlas-height-lattice-20261021/README.md) dokumentiert.

## Daten und Nachbarschaft

Gespeicherte Höhenwerte, Revisionen und Autorenpolygone bleiben unverändert. Abgeleitete Suchgrenzen und präzise Invalidierung umfassen jetzt zwei Nachbarknoten. Schema 54 erweitert die vorhandenen Grenzen einschließlich der History-Zeilen. Nur bekannte alte History-Fingerabdrücke werden umgesetzt; Konflikte bleiben erhalten. Ein Fehler bricht die Migration atomar ab. Archivvorschauen ändern das Original nicht; die Übernahme migriert ihre Arbeitskopie.

[Neue Regressionen](../../../tests/terrain-reconstruction.test.mjs) prüfen exakte Knoten, affine Innenflächen, begrenzte Extrema, kontinuierliche Flanken, echte SQL-Nachbarlesungen, bestehendes Undo/Redo, Konflikte, Rollback, Archivkopie sowie warme Höhen-/Farb-/Mesh-Caches nach einer Änderung außerhalb der bisherigen Nachbarschaft. Die neue Kurve senkt den RMSE am analytischen Hügel mit 16-m-Knoten von 0,16344 auf unter 0,022 m. Das ist ein numerischer Vergleich, keine Aussage zur gesamten Gestaltung.

Die aktuelle native Anschlussprüfung und die Kernmessung werden hier nach ihrem Abschluss ergänzt. Gesamtprodukt, Candidate-CI, Main, Paket, Installation und Nutzerabnahme bleiben offen; die drei vollständigen Abschlussuntersuchungen haben nicht begonnen.

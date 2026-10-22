# Terrain-History wächst mit dem geänderten Gelände

## Ursache und Änderung

Nach der [ausgelagerten Sicherungsprüfung](../atlas-backup-worker-20261021/README.md) blockierte die synchrone Commit-/Historyarbeit auf der vollen gemischten Welt weiterhin den Hauptprozess. Jeder Landschaftsauftrag erhöhte die Revision des `world_record`-Kartendokuments, obwohl dessen 100.000 Quellenhexes unverändert blieben. Die 14.543.618 Byte große Karte wurde gelesen, geparst, serialisiert, gehasht und als vollständiges Vorher/Nachher-Paar in der Terrain-History gespeichert. Fortsetzungen eines Pinselzugs prüften und serialisierten diese Kopien erneut.

`storage/terrain-environment.ts` hält nun eine kleine, dauerhafte Revision im bestehenden generischen `world_record`, Art `terrain-environment`, mit der Atlas-Map-ID als Schlüssel. Keine neue Tabelle oder Formatmigration. Ältere Bestände behalten ohne diesen optionalen Datensatz ihre bisherige Reisebasis. Tatsächliche Landschaftsänderungen erhöhen den Zähler in derselben kanonischen Transaktion. Undo/Redo erhöhen ihn ebenfalls; er wird nicht aus der History zurückgesetzt. Receipts und wirkungslose Live-Inkremente erzeugen keine zusätzliche Änderung. Prüfsumme, zulässige Revision und Atlaszuordnung werden bei Sicherung/Übernahme geprüft; die vorhandene Kopierlogik remappt den Kartenschlüssel.

Die Reisebasis enthält diesen Zähler, sobald er existiert. Alte angenommene Reisen und unangenommene Vorschauen bleiben nach Terrainänderung, Undo/Redo und Neustart ungültig. Position und Uhr bleiben erhalten. Wirkliche Änderungen der Karte und ihrer Quellenhexes behalten ihren eigenen bisherigen Schreib-/Revisionspfad. Die Terrain-History enthält nur veränderte Landschaftszeilen und gegebenenfalls betroffene Reisezeilen.

## Native Gegenprobe auf der vollen gemischten Welt

Gleicher synthetischer Ausgangsbestand und gleicher 2.500-Meilen-Pinsel wie zuvor: 100.000 bearbeitete Quellenhexes, 5.000 Orte, 5.000 eingerichtete Gebäudegruppen, 50 Detailbereiche, ein Dungeon mit 4.001 Räumen, insgesamt 15.701 Räume / 48.670 Zeichnungselemente / 1.028 Höhenkacheln. Diese Quellenhexes sind keine 100.000 fein aufgelösten Höhenbearbeitungen.

[Vorher](before.json), [nachher](after.json), [normale Atlasfläche nach Abschluss](after.png). Native Quelle: Main-Basis `cb37b55e9f509823b494e0a68c6d9b090e1b0687` plus diese lokalen Änderungen; Bundlehashes im Ergebnis. Keine parallelen eigenen Builds oder Tests während der nativen Messung. PID 3222541 normal mit Code 0 beendet, anschließend abwesend; keine Rendererfehler.

| Diagnosewert | Vorher | Nachher |
| --- | ---: | ---: |
| Synchrone `executeAtlasCommit`-Arbeit, einschließlich Unteraufrufen | 8,978 s | 0,507 s |
| Zoom senden bis nächste Zustandsantwort | 5,629 s | 0,360 s |
| Pinselbeginn bis wieder freigegebenes Werkzeug | 18,278 s | 13,453 s |
| Öffnen bis Terrainbereitschaft | 23,194 s | 22,619 s |
| History des gesamten Pinselzugs | 35.358.694 Byte | 270.767 Byte |

Die Zoomprobe enthält eine absichtliche Wartezeit von 250 ms nach der Wheel-Antwort; sie misst weder erste Bildreaktion noch Framerate. Die Kamera bewegt sich, während der Pinselabschluss noch aussteht. Im Nachher-Hauptprozessprofil liegt keine `validateDatabase`-Arbeit. Die acht Landschaftsdeltas benötigen 270.758 Byte; kein Kartendelta. Der neue Geländedatensatz enthält 14 Payload-Byte.

**Weiterhin offen:** etwa 23 Sekunden Eröffnung, etwa 13 Sekunden bis zum Pinselabschluss und sichtbare Unschärfe der synthetischen Übersicht. Das ist eine gezielte Verbesserung, keine vollständige Reaktionszeit-, Kartografie- oder Zielgeräteabnahme. Einzelne Profilingläufe auf i5-8365U/UHD 620; der Pentium Gold 7505 wurde nicht getestet. Nächster Schwerpunkt: Aufbau der Objektprojektion vor der ersten nutzbaren Terrainansicht und verbleibende Workerarbeit beim Pinselabschluss.

Reproduktion: `python3 tools/ui-session.py timeout --signal=TERM 240s env BACKUP_PROBE_SOURCE=<behaltene-synthetische-workbench.sqlite> QA_EVIDENCE_DIR=.build/mixed-settle-bounded-history node tools/measure-desktop-backup-impact.mjs`.

## Automatisierte Gegenproben

- `tests/terrain-live-history.test.mjs`: 100.000 Quellenhexes, Verbot jedes Map-UPDATE per SQL-Trigger, begrenzte Historybytes, zusammenhängende Geste, Idempotenz, Rollback, Neustart, Undo/Redo, Snapshot/Kopie mit remappter Map-ID, beschädigter Geländevermerk.
- `tests/desktop-travel.test.mjs`: veraltete Vorschau/angenommene Reise nach Terrainänderung und Undo/Redo/Neustart abgewiesen, Position/Uhr erhalten, neu geplante Reise erfolgreich.
- Bestehende Gegenproben für Landschaftswerkzeuge, Pinsel, Trassen, Invalidation, lokale Reisen und Exportisolation.

Ein vorläufiger Großbestandstest löste durch seine unvollständige Vorbereitung unnötig die alte Quellenhex-Migration aus; dieser Lauf wurde beendet. Die Fixture schließt diese Migration jetzt auf der leeren Kampagne vor der Aussaat ab. Die erste Kopiergegenprobe erwartete fälschlich einen übernommenen Undo-Stack; unabhängige Kopien beginnen absichtlich ohne ihn. Die korrigierte Probe bearbeitet die Kopie und prüft deren eigene Rücknahme. Diese Vorläufe zählen nicht als bestandene Nachweise.

128 betroffene automatisierte Tests bestanden (46 Reise, 10 Terrain-History, 72 Pinsel/Trassen/Regionen/Export). Beide Typprüfungen, Desktop-Build und Repositoryprüfung bestanden. Keine Candidate-CI, Integration, Veröffentlichung oder Installation dieser Änderung behauptet; Lieferung im vom Nutzer festgelegten Fünfstundenrhythmus.

Die ergänzende [native Pinselbedienprobe](brush-ux.json) bestand alle neun Schritte: kompakte Oberfläche bis 200 %, Pinselparameter, Höhenzug mit Undo/Redo, weitere Pinselfamilien, Zoom-/Radiusverhalten, geneigter Atlas, PNG und Wiederöffnen bei 125 %. Beide Prozesse (3224260, 3224884) endeten normal mit Code 0 und sind abwesend; keine Rendererfehler. Sie belegt die vorhandenen Bedienverträge, nicht die Großbestands-Framerate oder die gestalterische Zielqualität.

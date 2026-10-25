# Kanonischer Store im Node-Worker

Status: Current; technische Nachweise und Produktabnahme bleiben getrennt.
Owner: project
Last Reviewed: 2026-10-25
Source of Truth: Prozessvertrag; Implementierung in `desktop/store-worker.ts` und `desktop/store-client.ts`.

## Zuständigkeit und Transport

Genau ein langlebiger Node-Worker besitzt den produktiven `CampaignStore` und
seine kanonische SQLite-Schreibverbindung. Electron-Main besitzt Fenster, Dialoge,
IPC-Rechteprüfung, native Medienverarbeitung und den Host-Lebenszyklus. Der Renderer
verwendet unverändert die einzelnen freigegebenen Preload-Funktionen.

`desktop/store-operations.ts` registriert erlaubte Operationen ausdrücklich.
Argumente und asynchrone Ergebnisse werden aus den Store-Typen abgeleitet; eine
neue Store-Methode ist damit nicht automatisch erreichbar. Die 248 vor dem Umbau
von Main verwendeten Methoden sind angebunden: normale DTO-Aufrufe über den Client,
Schließen über dessen Lebenszyklus, Backup und Chronik über eigene Worker-Abläufe.
Ein allgemeiner Store-Aufruf wird dem Renderer nicht angeboten.

Structured Clone kopiert DTOs und typisierte Arrays. `store-transport.ts` markiert
Buffer-Pfade und stellt Node-Buffer wieder her, ohne den Speicher des Aufrufers zu
entziehen. Funktionen, Klasseninstanzen, Datenbankobjekte und zyklische Argumente
werden abgewiesen. SharedArrayBuffer transportiert ausschließlich das interne
Abbruchsignal für Kampagnendateien; kein Renderer erhält diesen Zugriff.

Chronik-Snapshots verbleiben als Read-Session im Worker; Main erhält eine opake
Kennung und liest Seiten. Kampagnenannahme, Medienbereinigung, Datei-Fences und
abschließende Veröffentlichung laufen mit lokalen Callbacks im Worker. Zwischen
abschließender Quellenprüfung und synchroner Umbenennung beziehungsweise zwischen
Referenzprüfung und Löschen gibt es keinen asynchronen Unterbrechungspunkt.
Main entzieht abgebrochenen Transfer-Tickets sofort ihre Berechtigung; ihre
Stagingdateien werden erst nach Ende einer bereits angenommenen Übernahme entfernt.

## Aufträge, Fehler und Schließen

Der Client registriert Pending-Aufträge vor `postMessage`. Monotone Transport-IDs
verhindern erneuten Dispatch derselben Nachricht; fachliche Command-IDs und Receipts
bleiben die dauerhafte Idempotenzgrenze. Es gibt keine automatische Wiederholung
von Schreibaufträgen und keinen automatischen Ersatz eines ausgefallenen Workers.

Ein Transport-/Workerfehler meldet **Speicherbestätigung ungeklärt**. Insbesondere
beweist eine verlorene Antwort keinen fehlenden Commit. Der Client bleibt nach
einem Ausfall geschlossen für weitere Aufträge; nach einem geordneten App-Neustart
klären die vorhandenen fachlichen Receipts den Ausgang. Auch Pending-Statusabfragen
behalten laufende Aufträge über asynchrone Receipt-Lesegrenzen hinweg bei.

Main erhält den Fehlertyp `StoreOutcomeUnknownError` und gibt ihn als einfaches
`Result`-DTO `{ok:false,error,errorKind:'store-outcome-unknown'}` über die einzelne
Preload-Funktion weiter. Die Zuordnung erfolgt anhand der tatsächlichen Klasse,
nicht anhand von Name oder Meldungstext. Erfolg und reguläre Validierungsfehler
behalten ihren bisherigen Vertrag. Ein fehlender `errorKind` ist **kein allgemeiner
Beweis, dass nicht gespeichert wurde**: Auch ein fachlicher Methodenfehler kann
nach einem bereits bestätigten Commit beim Nachlesen auftreten.

Der Marker veranlasst selbst weder erneutes Schreiben noch einen Worker-Neustart.
Autoren- und Reisebesitzer müssen ihn vor einer Umwandlung in eine gewöhnliche
Fehlermeldung auswerten; Erhalt des exakten Commands, Folgeschreibsperre und
Receipt-Klärung gehören zu A0.07/A0.08. Der bestehende `writeConfirmed`-Pfad behält
auch bei Fehlern seine Receipt-Referenz bis zu einer belastbaren Statusantwort.

Nach abgeschlossenen Atlas-, Room- und Drawing-Commits schützt
`atlas-commit-projection.ts` den nachfolgenden Ansichtsaufbau. Auch der
`executeCity`-Sonderweg im Worker verwendet diese Grenze. Ein tatsächlicher
`AtlasCommitProjectionError` wird im Worker als `kind:'unknown'` transportiert;
StoreClient rekonstruiert daraus `StoreOutcomeUnknownError`. Der genaue Auftrag
bleibt über seine Atlas-Quittung klärbar, die fehlende Ansicht wird separat neu
gelesen. Der RoomCommit-Leser ruft dafür keinen zweiten Schreibauftrag auf.

Die Einordnung erfolgt erst nach der äußersten Schreibtransaktion. Insbesondere
bleibt eine fehlgeschlagene Terraincache-Nachlese innerhalb der Prepared-Transaktion
ein normaler Fehler mit Rollback; außerhalb davon ist die bereits gespeicherte
Quittung klärbar. Vorcommit-Validierungsfehler behalten ebenfalls ihre gewöhnliche
Ablehnung. Die Produktionsregressionen in
`tests/desktop-atlas-postcommit-projection.test.mjs` injizieren tatsächliche
Nachlesefehler und verfolgen sie durch Store, Worker, Main und Preload bis zur
Receipt-Klärung, ohne den Writer erneut aufzurufen.

Beim Schließen oder Update sperrt Main neue Produktaufträge und wartet auf bereits
angenommene Abläufe. Der Client sperrt danach seine Aufnahme. Der Worker wartet
auf Aufträge und Snapshot-Freigabe, schließt SQLite und bestätigt dies. Erst das
tatsächliche `exit`-Ereignis beendet `close()`. Ein unerwartetes Ende wird ausdrücklich
als ungeklärt gemeldet und nicht als ordentliche Datenbankschließung ausgegeben.

Die Backupprüfung bleibt ein unabhängiger Readonly-Worker. Während ihrer Prüfung
nimmt der Store weitere Aufträge an. Der Store prüft vor Veröffentlichung die
Löschepoche; ein inzwischen veralteter Kandidat wird verworfen. Beim Schließen wird
die Prüfung beendet, auf ihren tatsächlichen Exit gewartet und der Kandidat entfernt.
Bestehende Atlas-/Raumleser bleiben lesend. Graphwechsel sperren auch Leseaufträge,
deren Quellenabfrage erst während der Sperre aus dem Store zurückkommt.

## Prüfwege und Grenzen

- `tests/desktop-store-worker.test.mjs`: echte Worker, Binärdaten, Doppelzustellung,
  Abbruch vor/nach Commit, Receipt-Auflösung, Pending-Rennen, Backup-Epoche und Exit.
- `tests/desktop-store-outcome-boundary.test.mjs`: echter StoreClient → Main-Handler
  → Preload bei Workerabbruch vor/nach Commit, unübertragbarer Antwort, Ablehnung
  und Erfolg; wiederholte Receipt-Reads erzeugen keinen zusätzlichen Schreibauftrag.
  `tests/helpers/desktop-main-host.mjs` bietet diesen Aufbau auch für die nachfolgenden
  Autoren-/Reisetests; nur Electron-Shell und Update-Start sind ersetzt.
- `tests/desktop-review-data-retention.test.mjs`: Ticketentzug ohne vorzeitiges Löschen aktiver Stagingdateien.
- `tests/desktop-player-visual-host.test.mjs`: verspätete Antworten und Fensterwechsel.
- `tests/desktop-backup-worker.test.mjs`: unabhängige Snapshotprüfung und Veröffentlichung.
- `tools/test-desktop-store-responsiveness.mjs`: Main-Timerverzögerung während einer
  echten Kopiervorschau mit 2.000 Räumen; getrennt davon sichtbare Pinselgrößen-Eingabe.
- Native Abläufe: `test-desktop-atlas-mixed-workbench`, `test-desktop-atlas-brush-ux`,
  `test-desktop-campaign-transfer-visit`, `test-desktop-npc-switch`,
  `test-desktop-note-source-recovery` und `test-desktop-player-scene-privacy` in `tools/`.

Der Store-Worker bestätigt weder das offene 100-ms-Ziel für sichtbares Gelände beim
Malen noch eine allgemeine Produkt-/Zielgeräteabnahme. Ein Timerwert misst den
Main-Eventloop; eine Eingabe mit zwei Animationsframes misst eine Präsentationschance,
keinen physischen Scanout. Datenformat, IDs, Archivkennungen und fachliche Commands
bleiben unverändert. Der gemeinsame Editor-Lebenszyklus ist eine separate Änderung.

## Lokaler Vorher-/Nachher-Vergleich am 24.10.2026

Gleicher nativer Ablauf, 2.000 Räume, Node 22.22.0; je eine Stichprobe auf diesem
Linux-Host. Während beider Proben lief die lokale Testsuite. Deshalb sind dies
vergleichbare Diagnosewerte unter Last, keine allgemeine Zielgerätequalifikation.

| Messgröße | Vorher (Main-Store) | Nachher (Store-Worker) |
| --- | ---: | ---: |
| Größte Main-Timerverzögerung bei Kopiervorschau | 1.450,7 ms | 22,8 ms |
| p95 der Main-Timerverzögerung | 11,8 ms | 4,8 ms |
| Dauer der Kopiervorschau einschließlich UI-Warten | 2.897,6 ms | 3.301,9 ms |
| Pinselgrößen-Eingabe bis geänderter Beschriftung und zwei Frames | 32,4 ms | 42,6 ms |

Die Arbeit wird damit im gemessenen Fall vom Main-Eventloop entkoppelt; eine
Beschleunigung der Kopie oder des eigentlichen Geländeauftrags ist nicht belegt.
Ausgangsbuild: `a559e21bc2f7cb66466981d473433c13ef3a4fcd`, Main-SHA256
`44c4073159278edb4e3d6e75b5705fb613d1012308ef320ef68f78283e33ce90`.
Die native Probe schreibt Build-Hashes, Prozess-Exits und Messwerte nach
`.build/store-responsiveness/result.json` beziehungsweise `QA_EVIDENCE_DIR`.

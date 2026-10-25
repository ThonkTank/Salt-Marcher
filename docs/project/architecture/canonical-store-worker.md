# Kanonischer Store im Node-Worker

Status: Current; technische Nachweise und Produktabnahme bleiben getrennt.
Owner: project
Last Reviewed: 2026-10-24
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
- `tests/atlas/desktop-review-data-retention.test.mjs`: Ticketentzug ohne vorzeitiges Löschen aktiver Stagingdateien.
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

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
einem Ausfall geschlossen für weitere Aufträge. Vorhandene fachliche Receipts
erlauben nach Neustart die Klärung, sofern der Besitzer seine ursprüngliche
Klärungsidentität dauerhaft gesichert hat. Die Atlas-/Reisegrundlage dafür steht
im folgenden Referenzvertrag. Der vollständige Produktanschluss bleibt offen:
A0.07/A0.08 schließen die Besitzer an, A0.14 den erreichbaren Abschluss und die
native Wiederaufnahme. Pending-Statusabfragen behalten laufende Aufträge auch
über asynchrone Receipt-Lesegrenzen hinweg bei.

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

### Dauerhafte Atlas- und Reisereferenzen

`atlas-write-receipt.ts` definiert die ursprüngliche Receiptidentität ohne
Aktivierungstoken oder Autorenpayload: Kampagne, Command-ID, Fingerprint, Familie
und gegebenenfalls Previewziel. Die drei Writerfamilien teilen ihre jeweilige
Fingerprint-Eingabe mit diesem Vertrag. Verschachtelte ursprüngliche Tokens
bleiben Teil des Hashes; eine neue Aktivierung berechtigt nur die Statusabfrage.
`atlas-write-recovery.ts` kopiert den Command vor dem ersten Await und sichert
die Referenz vor Dispatch. Ein Sicherungsfehler verhindert den Schreibaufruf.
Graphauswahl besitzt keinen Receipt und verwendet diesen Helper nicht.

Main hält mit `desktop/atlas-write-references.ts` zwei lokale Slots je Kampagne
(Atlas einschließlich Vorschau und Reise) unter `atlas-write-references` im
Datenverzeichnis. Atomare Veröffentlichung und fsync sichern den kleinen Vermerk;
belegte Slots erlauben weder Überschreiben noch erneuten Dispatch. Beschädigte
Dateien und abgebrochene Veröffentlichung sperren ausdrücklich. Diese lokalen
Referenzen gehören nicht zum Kampagnenarchiv.

Die einzelnen Preload-Methoden `keepAtlasWriteReference`, `atlasWriteReferences`,
`atlasWriteStatus` und `clearAtlasWriteReference` erhalten stets einen separaten
aktuellen Token. Der Storestatus liest ausschließlich die adressierte Quittung:
`applied`, `not-applied` oder `unknown`, ohne Ansicht oder Reisefokus aufzubauen.
Laufende Vorbereitung, ein während der Abfrage gestarteter Writer, unlesbare
Quittungen und fehlende/fremde Vorschauen bleiben ungeklärt. Clear prüft Status
und exakte Identität. Für eine nachweislich abgelehnte Graphaktion vor Previewanlage
kann Main zusätzlich seinen begrenzten aktuellen Ablehnungsnachweis verwenden;
ein weiterer Dispatch entzieht ihn. Nach Hostverlust wird daraus keine behauptete
Nichtanwendung. Der aufrufende Autorenbesitzer muss bei einem Clearfehler
gesperrt bleiben; dieser Anschluss gehört zu A0.07/A0.08.

`tests/atlas-write-recovery.test.mjs` prüft Erfassung und Dispatchgrenze;
`tests/desktop-atlas-write-receipt.test.mjs` verwendet tatsächliches Main, Preload
und Worker einschließlich Neustart, Persistenzfehlern, fehlendem Reisefokus und
gleichzeitiger Vorbereitung. Die Referenz wird nach Neustart aus dem lokalen
Speicher gelesen, ohne nachgereichte Command-ID. Der native UI-Anschluss bleibt
von diesen Hostbelegen getrennt.

### Graphvorschau und Autorenbesitzer

Graphvorschau-Aufträge besitzen eine eigene, begrenzte Transaktionsgrenze in
`storage/graph-preview-commands.ts`. `GraphPreviewTarget` hält die vor dem Dispatch
festgelegte `previewId`, `scopeId` und lokale `revision`; die erste Autorenaktion
trägt eine neue ID mit Revision 0. Reine Graphauswahl ohne Vorschau erzeugt keine
Vorschau. Aktive Vorschauauswahl und Autorenaktionen adressieren ihren konkreten
Besitzer. Atlas/Edit/Drawing ohne Ziel bezeichnen kanonische Daten; bei einer
offenen Vorschau werden betroffene Autorenaktionen ohne ausdrückliches Ziel
abgewiesen. Ein veraltetes Ziel fällt niemals auf den kanonischen Writer zurück.

Die Shadow-Transaktion umfasst Fachänderung, gemeinsame Wände und Anker, lokale
Validierung, einen gruppierten Historyschritt und `preview_receipt`. Undo/Redo
sind ausdrücklich adressierte Atlasaufträge desselben Besitzers. Workspace und
RoomCommit liefern `graphPreview`, kompakte Acks `preview`; `atlasRevision` und
`AtlasCommitAck.revision` bleiben die kanonische Revision. Der Regionsfence bindet
zusätzlich ID und lokale Revision. `reconcileAtlasCommit` liest Previewreceipts
über das ursprüngliche Ziel; Graphaufträge verwenden dafür
`{kind:'graph-preview',command}` mit demselben äußeren Ziel. Nachlesefehler nach
Shadowcommit verwenden denselben typisierten Unknown-Transport wie Atlascommits.

Nur `{kind:'graph-accept',command}` übernimmt in die kanonische Maintransaktion;
auch direktes `executeGraph(accept)` verwendet diesen Weg. Hüllen-, Positions- und
Reiseprüfung, kanonische History, Atlasreceipt und Lifecyclemarker gehören zu
diesem Commit. Fehler erhalten die vollständige Vorschau. Erst danach entsorgt
`retireGraphPreview` die Shadowquelle. Die profilgebundene Markierung
`graph-preview-lifecycle:<campaignId>:<previewId>` enthält Version, IDs, lokale
Revision, Status, Command-ID und Fingerprint, keine Dateipfade. Explizites Restore
schreibt seinen identischen Beleg vor dem Entfernen; spätere Vorschauen überschreiben
ihn nicht. `previewCommandFingerprint` verwendet dieselbe Eingabe
`{campaignId,target,action}` wie der dauerhafte Referenzvertrag.

`storage/graph-preview-lifecycle.ts` verwaltet neben der kanonischen Datenbank
höchstens eine aktive Vorschau unter `<database>.graph-previews`. Eine atomar
veröffentlichte Zuordnung hält Profilkennung, Kampagne, Vorschau-ID, Scope und die
ursprüngliche Quellbasis fest, bevor die lokale SQLite-Datei entsteht. Profilkennung
und Zuordnung bleiben außerhalb von Main-Recoverybackups. Pfade werden nur aus dem
eigenen Datenbankpfad und geprüften IDs abgeleitet; fremde Lifecyclemarker erteilen
keine Berechtigung, eine Vorschau zu öffnen oder zu löschen.

Ein neuer Store öffnet dieselbe lokale Datenbank samt Phase, Revision, History und
Receipts. Fehlende oder beschädigte Dateien, widersprüchliche Identität und eine
unterbrochene Anlage werden ausdrücklich abgewiesen. Es gibt keinen Ersatz durch
eine leere Vorschau. Die ursprüngliche Basis wird nicht erneuert; bei inzwischen
geänderter kanonischer Geometrie bleiben lokale Schreibaufträge und Accept gesperrt,
Restore bleibt möglich. `close()` schließt nur Handles. Nach bestätigtem Accept
oder Restore kann der nächste Store unterbrochenes Aufräumen wieder aufnehmen;
Accept benötigt dafür zusätzlich seinen kanonischen Receipt. Ein kleiner
profilgebundener Retirementbeleg hält nur die exakte Accept-/Restoreidentität,
keine Commands oder vollständige lokale History. Frühere gewöhnliche
Previewaufträge sind nach Retirement ohne ihren ursprünglichen Bestand weiterhin
unbekannt, nicht kanonisch `not-applied`.

Kampagnenarchive und Kopien enthalten nur kanonischen Inhalt und entfernen lokale
Lifecyclemarker über `pruneCampaignSnapshot`. Ein volles Main-Recoverybackup ist
keine Sicherung der zusätzlichen offenen Vorschau. Die bestehende
Kampagnenlöschqueue entfernt ausschließlich die zugehörige lokale Vorschau und
anschließend ihre Retirementmarker; ein anderer Kampagnenbesitzer bleibt erhalten.
Ortslinks in lokalen Passagen lesen ihre aktuelle Existenz über einen an die
Shadowverbindung gebundenen Main-Lookup in `storage/paths.ts`. Dieser Port schreibt
keine Ortsdaten, wird bei Wiederöffnung erneut gebunden und beim Schließen entfernt.

`tests/desktop-graph-preview-restart.test.mjs` prüft reale Worker-Exits vor/nach
lokalem Commit, vor/nach Retirementcommit und während der Bereinigung, unveränderte
Wiederöffnung, Beschädigung, Profil-/Archiv-/Löschgrenzen sowie lokale Ortslinks.
Die neue Storeaktivierung benötigt keine vom Test zurückgereichte Preview-ID;
die exakte Commandreferenz zur anschließenden Statusabfrage hält der Test selbst.
Deren dauerhafter Rendererbesitzer bleibt A0.07; native Schließ- und
Wiederaufnahmequalifikation bleibt A0.14.

Der zentrale UI-Anschluss in `campaign-atlas-author.ts` erfasst mit
`graphPreviewTarget` die Preview-ID, den Scope und die lokale Revision der Eingabe;
`graphPreviewMatches` prüft diesen Besitzer vor Dispatch und vor Übernahme einer
Antwort. Die Autorenwrapper reichen dasselbe Ziel an Graph-, Raum-, Zeichen- und
Historyaufträge weiter. `graph-ui.ts` besitzt die erste Vorschaukennung und die
Übernehmen-/Wiederherstellen-Aktionen. Die übrigen Autorenoberflächen verwenden
ihren jeweiligen geladenen Workspace. `tests/desktop-graph-preview-owner.test.mjs`
führt ihre tatsächlichen DOM-Dispatcher aus und prüft Vorschauwechsel, verspätete
Antworten sowie lokale und kanonische Undo/Redo-Ziele. Vollständige Unknown-
Behandlung und Wiederaufnahme im Autorenbesitzer bleiben A0.07.
`tests/desktop-graph-preview-commit.test.mjs` prüft weiterhin
die Vorschau- und Acceptgrenzen, gruppierte History, Commitfehler und den echten
Worker/Main/Preload-Transport.

### Commitnachlese und Schließen

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

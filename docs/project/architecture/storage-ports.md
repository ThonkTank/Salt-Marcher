# Typisierte Speicheranschlüsse und Belegverträge

Status: Current; technische Nachweise und Produktabnahme bleiben getrennt.
Owner: project
Last Reviewed: 2026-10-27 (kanonische Werteprüfung; Fachabnahme separat)
Source of Truth: `src/app/storage/sqlite-connection.ts` und die benannten Fachmodule.

## Anschluss und Lesegrenze

`SqliteDatabase` beschreibt den verwendeten synchronen better-sqlite3-Anschluss:
gebundene SQLite-Werte, Statements, Transaktionen einschließlich `immediate`,
Readonly- und Transaktionszustand. Es ist kein neuer Verbindungsbesitzer und keine
Datenbankschicht mit eigener Transaktionssteuerung. Der kanonische Store bleibt
beim Node-Worker; Atlasprojektionen besitzen weiter ihre Readonly-Verbindungen.

Vorbereitung, Raumoperationen/-leser, Kampagnenatlas, lokale Atlasreise und der
kanonische Regionsanschluss nehmen diesen gemeinsamen Typ entgegen. Ungeprüfte
SQL-Ergebnisse sind zunächst unbekannte Felder. `checkedQuery` bindet die erwartete
Projektion an die SQL-Lesestelle; `checkedRow` prüft bereits gelesene Records. Text,
endliche Zahlen, sichere Ganzzahlen und ausdrücklich nullable Felder werden ohne
Koercion geprüft. Vorhandene Payload-, Prüfsummen-, Identitäts- und Fachprüfer
bleiben zuständig. Listen isolieren beschädigte Inhalte weiterhin pro Record,
Originalbytes bleiben erhalten. Der Helfer kopiert oder normalisiert keine Zeilen.

Fachkontexte geben nur verwendete Operationen weiter: etwa Guard und Raumwriter,
Vorbereitungswriter/Sessionaktion oder Live-/Dungeonaktion bei lokaler Reise.
Der Vorbereitungsleser erhält keine zusätzliche DB-Auswahl mehr; die Planklärung
benötigt lediglich die aktive Campaign-ID. Die Reise verlangt einen `LiveScene`-
Leser, der Kampagnenatlas einen `SceneWorld`-Leser. Ein beliebiges Ergebnis ist dort
kein gültiger Anschluss. Dies ist eine Typisierung dieser Anschlüsse, keine
Behauptung vollständig typisierter historischer Projektions- und Payloadmodelle.

## Konkrete Werte an der kanonischen Grenze

`CampaignStore.db` trägt den tatsächlichen Rückgabetyp von `openStoreDatabase`,
einschließlich Dateiname, Close und Backup. `GraphShadow.db` besitzt denselben
nativen Verbindungstyp; die Fachleser erhalten den kleineren `SqliteDatabase`-
Vertrag. SQL-Projektionen prüfen ihre verwendeten Spalten am Leseort. Bei
Einzelrecord-Fehlerlisten liegt die vollständige Payloadprüfung weiterhin innerhalb
der bisherigen Fehlergrenze. Aggregate und verwendete PRAGMA-Skalare werden
geprüft; Binärspalten bleiben Bytearrays und werden am Buffer-Anschluss kopiert.

`stored-payload.ts` prüft die SQL-Hülle und SHA-256 über **unveränderte** gespeicherte
Bytes und liefert nach JSON-Parsing `unknown`. `decodeStored` benötigt immer einen
konkreten Decoder. Die früheren ungeprüften generischen `decoded<T>`-Helfer in
Session, Generierung, Fortschritt, Kalender, Shops und Musik sind entfernt.

Die konkreten Strukturdecoder in `stored-shapes.ts` verwenden den aus den
kanonischen TypeScript-Typen erzeugten Graphen `stored-shapes.json`.
`tools/build-stored-shapes.mjs --check` gehört zur Repositoryprüfung. Er erfasst
Pflichtfelder, optionale Felder, verschachtelte Listen, Dictionaries und Varianten;
Zahlen müssen endlich sein. Bekannte optionale Felder werden auch dann geprüft,
wenn sie vorhanden sind; fehlende Pflichtfelder werden abgewiesen. Zusätzliche
Felder bleiben erhalten, sofern der Fachvertrag sie nicht ausdrücklich verbietet.
Der Graph normalisiert, kopiert und repariert keine Nutzwerte.

Die reinen Typdefinitionen in `stored-record-types.ts` sind zugleich die Ziele
der bisherigen Transferaliases. Transfergraph, Schema und Archivkennungen ändern
sich dadurch nicht. Die gespeicherten Formen unterscheiden sich ausdrücklich von
abgeleiteten Projektionen: Audio-Verfügbarkeit entsteht beim Lesen; die Kennung
eines Shopereignisses liegt in dessen SQL-Hülle.

| Fachbesitzer | Zusätzliche Prüfung nach Struktur und Prüfsumme |
| --- | --- |
| `session-read.ts`, `scene-read-aloud.ts` | Plan-/Visit-ID, Reihenfolge, SQL-Revision, Profilparty und Adventure-Day-Anteil, Visittexte/-verweise, Rastnachbar, Belohnung und noch im Besuch entworfene Gruppenbindung. Fehlende optionale Profile, Visitdetails und Vorlesetexte behalten ihre bisherigen Defaults. |
| `session-result-read.ts` | Der bestehende Runprüfer bleibt einziger Besitzer für Budget, Herkunft, Quellen und Vorschlagsannahmen; Wiederverwendung liest denselben geprüften Run. |
| `generation-read.ts`, `generation.ts` | Presetkonfiguration und Hash, Tabelleninhalt/-gewichte, Runzusammenhang und eingefrorene Quellen, passende Varianten von Register-, Beutewurf- und Begegnungsreceipts. |
| `progression-records.ts`, `progression.ts` | Fortschritt, Gesundheit, Rast, Schatz-/Ledgeridentität und Figurenbindung; historische Fakten und Bestätigungen werden anhand ihrer eigenen gespeicherten Werte geprüft. |
| `world-calendar-read.ts`, `world-record-read.ts`, `world-state.ts` | Kalenderbereiche und Revision, Karten-/Wetter-/Positionswerte, Reisegrundlage und Checkpoint, historische Weltbestätigung. Der Kalenderdefault gilt ausschließlich bei fehlendem Record. |
| `items.ts`, `music.ts` | Die bestehenden Shop-, Bibliotheks-, Player-, Scene- und Subjectprüfer erhalten strukturgeprüfte Werte; Historie und Receipts erhalten ihre eigene Prüfung. Kontext liest Quellen über die passenden Besitzerdecoder. |
| Fassade und Landschaft | Suchprojektionen, Öffnungsbeleg und ausgewählte Featurestände werden geprüft; Landschaftswerte teilen ihre reine Prüfung zwischen Writer, gezieltem Read und Backupprüfung. |

`validateDatabase` verwendet diese passenden Besitzer auch für Backup-/Restore-
und Importkandidaten. Ein vorhandener beschädigter Record wird nicht zum Default,
übersprungen, gelöscht oder repariert. Ein beschädigter Beleg nach möglichem Commit
bleibt ein Lesefehler und autorisiert weder `not-applied` noch einen zweiten Write.
Einzelabfragen lösen keine globale Gesamtdatenprüfung aus. Historische Fakten werden
nicht gegen inzwischen geänderte Preise, XP, Presets oder Quellenrevisionen gerechnet.

Dies typisiert die benannten Fassadenleser und sämtliche Verbraucher der sechs
Helfer. Es ist keine globale Bereinigung historischer `any`-Stellen, etwa in
anderen Graph-, Live-, Scene- oder Transferoperationen. Diese Stellen und die
vollständige Produktabnahme bleiben eigene Aufgaben.

## Fingerprints bleiben fachlich gebunden

| Besitzer | Unveränderter Vergleich |
| --- | --- |
| Räume, Vorbereitung und ihre Store-Klärung | SHA-256 über `JSON.stringify({...command, token: undefined})`; ältere Receipts dürfen weiterhin SHA-256 über den vollständigen ursprünglichen Command einschließlich Token enthalten. Beide Vergleiche liegen in `command-fingerprint.ts`. |
| Atlas | SHA-256 über die Action; bei Terrain-Strokes über `{action, terrainStroke}`. Command-ID, Aktivierungstoken und Quellen-Fence werden dadurch nicht nachträglich Teil des Fingerprints. |
| Lokale Atlasreise | SHA-256 über die Action; eigener Receipt-Scope mit Campaignbindung. |
| Session, Fortschritt, Kampf, Verfolgung, Handel | Ihre vorhandenen Fachbelege und Ergebnisprüfungen bleiben bei den bisherigen Besitzern. |

Die drei identischen Raum-/Vorbereitungshelfer wurden nach diesem Vergleich
zusammengeführt. Es gibt keine Sortierung von JSON-Schlüsseln und keine Migration
bestehender Receipts. Alte tokenhaltige Aufträge werden mit dem ursprünglichen
Command und einem gültigen separaten Klärungstoken abgefragt. Ein frischer Token
macht aus einem historischen Fingerprint nicht nachträglich einen tokenfreien.
Atlas-Deltas behalten auch nach Prüfung ihre ursprüngliche Feldreihenfolge und
zusätzliche gespeicherte Felder. Fachlich verschiedene Writes, History und
Antwortprojektionen bleiben getrennt; es gibt keinen universellen Command-Runner.

## Transaktion, Rollback und verlorene Antwort

Verschachtelte synchrone better-sqlite3-Transaktionen bleiben Savepoints innerhalb
der äußeren Transaktion. Der Typanschluss weist Promise-Callbacks zurück. Ein
äußerer Fehler muss Raum-/Planänderung, History und Receipt gemeinsam entfernen;
dieselben Command-IDs bleiben danach verwendbar. Ein vorhandener bestätigter
Beleg verhindert dagegen eine zweite Mutation, auch nach Neustart.

Die temporären Atlas-Capture-Tabellen und Trigger nehmen an einer umgebenden
SQLite-Transaktion teil. Ein reiner JavaScript-Initialisierungsmerker überlebte
früher deren Rollback. Die Initialisierung fragt deshalb die tatsächliche
SQLite-Tabelle ab und baut nach einem äußeren Rollback die Capture-Struktur neu
auf. Das ändert weder das persistente Schema noch alte History-Deltas.

Eine verlorene Antwort bleibt ungeklärt, bis die bestehende fachliche
Receipt-Abfrage entscheidet. Pending ist keine Abwesenheit. Keine dieser
Änderungen wiederholt einen Writer automatisch oder ersetzt die vorhandene
Host-/Workergrenze aus [canonical-store-worker.md](canonical-store-worker.md).

## Prüfwege

- `tests/shared/desktop-storage-values.test.mjs`: korrekt gehashte ungültige Profile,
  Visitdetails, Kalender und Receipts; fehlende Defaults, exakte Texte über Neustart,
  unveränderte Backup-/Restore-/Importoriginale und kein zweiter Write.
- `tests/shared/storage-ports.types.ts`: falsche Writer/Leser, ungeprüfte SQL-Spalten,
  unzulässige Bindings und asynchrone Transaktionen müssen im Typcheck scheitern.
- `tests/shared/desktop-storage-ports.test.mjs`: echte SQLite-Verbindungen, alte
  Receipts ohne Migration, Wiederholung nach Neustart, äußerer Mehrbesitzer-Rollback,
  Receipt-Insertfehler, Atlas-Capture-Rollback und unveränderte beschädigte Records.
- Bestehende Fachprüfungen: [desktop-preparation-context.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/campaign/desktop-preparation-context.test.mjs),
  `tests/atlas/desktop-room-renumber-history.test.mjs`,
  `tests/atlas/desktop-campaign-atlas.test.mjs`,
  [desktop-atlas-travel-context.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/atlas/desktop-atlas-travel-context.test.mjs) und
  `tests/catalog/desktop-store-worker.test.mjs`.
- Native Proben: `tools/test-desktop-room-reads.mjs`,
  `tools/test-desktop-region-export.mjs`, `tools/test-desktop-npc-switch.mjs` und
  `tools/test-desktop-note-source-recovery.mjs`.

Diese Nachweise unterstützen Recovery und dieselben Vorbereitung-/Raum-/Atlasabläufe;
sie ersetzen keine vollständige E2E-01/02/04- oder Owner-Abnahme. Die optionale
dichte Stadt-/Regionsprobe bleibt gesondert offen.

# Typisierte Speicheranschlüsse und Belegverträge

Status: Current; technische Nachweise und Produktabnahme bleiben getrennt.
Owner: project
Last Reviewed: 2026-10-26
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

- `tests/shared/storage-ports.types.ts`: falsche Writer/Leser, ungeprüfte SQL-Spalten,
  unzulässige Bindings und asynchrone Transaktionen müssen im Typcheck scheitern.
- `tests/shared/desktop-storage-ports.test.mjs`: echte SQLite-Verbindungen, alte
  Receipts ohne Migration, Wiederholung nach Neustart, äußerer Mehrbesitzer-Rollback,
  Receipt-Insertfehler, Atlas-Capture-Rollback und unveränderte beschädigte Records.
- Bestehende Fachprüfungen: `tests/campaign/desktop-preparation-context.test.mjs`,
  `tests/atlas/desktop-room-renumber-history.test.mjs`,
  `tests/atlas/desktop-campaign-atlas.test.mjs`,
  `tests/atlas/desktop-atlas-travel-context.test.mjs` und
  `tests/catalog/desktop-store-worker.test.mjs`.
- Native Proben: `tools/test-desktop-room-reads.mjs`,
  `tools/test-desktop-region-export.mjs`, `tools/test-desktop-npc-switch.mjs` und
  `tools/test-desktop-note-source-recovery.mjs`.

Diese Nachweise unterstützen Recovery und dieselben Vorbereitung-/Raum-/Atlasabläufe;
sie ersetzen keine vollständige E2E-01/02/04- oder Owner-Abnahme. Die optionale
dichte Stadt-/Regionsprobe bleibt gesondert offen.

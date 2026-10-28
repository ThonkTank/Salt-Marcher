# Fachliche Speicherbesitzer

Status: Current; Strukturbeleg und fachliche Abnahme bleiben getrennt.
Owner: project
Last Reviewed: 2026-10-27
Source of Truth: Die benannten Module unter `src/app/storage/` und ihre Importgrenzen.

`CampaignStore` besitzt Verbindung, Aktivierung, Guards, Graphvorschau und
Zusammensetzung. Die Fachmodule verwenden immer die beim Aufruf übergebene
Verbindung. Auch beim vorübergehenden Wechsel auf eine Graphvorschauverbindung
wird kein zweiter Store geöffnet und keine Verbindung in einem Fachmodul gehalten.
Worker-Allowlist, Preload und öffentliche Store-Signaturen bleiben unverändert.

## Leser und lokale Operationen

| Besitzer | Inhalt und Grenze |
| --- | --- |
| `live-read.ts` | Roster, Profile, Scene, Uhr, aktive Gruppen und Archive samt bestehenden Decodern. Kein Live-Command und keine Weltfolge. |
| `world-calendar-read.ts` | Kalender und bisheriger Default; unabhängig von Reise und Live-Ausführung. |
| `world-state.ts`, `scene-position.ts` | Welt-/Wetter-/Reisestand, Position und lokale Synchronisierung. Positionsvererbung und Synchronisierung erhalten bereits validierte `LiveScene`-Werte. Keine vollständigen Writerports. |
| `session-read.ts`, `visit-outcome-read.ts` | Plan, vorbereitete Gruppen, Weltakteure, Vorlesetext, Scenevorbereitung und Besuchsergebnis; keine Generierung oder Planänderung. |
| `preparation-write.ts` | Lokale Visit-/Gruppen-/Akteuroperationen und die unveränderte Übernahme vorbereiteter Inhalte. Kopieren und Planersatz rufen diese Besitzer auf. |
| `generation-read.ts`, `session-result-read.ts`, `session-reward-validation.ts` | Gespeicherte Generierungsquellen, Vorschläge und ihre Decoder. Historische Herkunft bleibt lesbar, ohne die Generierung auszuführen. |
| `progression-records.ts` | Fortschrittsrecords, Ledger-/Schatzdecoder, lokale Buchungen und XP-Verteilung; keine Rückimporte zu Gruppen-, Treasury- oder Maskenabläufen. |
| `npc-read.ts` | Kanonische NPC-Projektion ohne NPC-Commands oder Maskensynchronisierung. |
| `drawing-read.ts`, `dungeon-geometry-read.ts` | Autorengeometrie und ihre bestehende Projektion ohne Dungeonreise oder Graphbearbeitung. Die übergebene DB bestimmt auch die Graphvorschau. |
| `landscape-records.ts`, `atlas-root-read.ts` | Landschaftrecords samt vorhandenem SQL-/Index-/Mutationsbesitz und Atlaswurzel. Terrainabfragen importieren keine aufrufenden Atlas-/Pinselcommands. |

Die bisherigen Module behalten ihre vorhandenen internen Exporte als
Einstieg für bestehende Verbraucher. Produktive Fachimporte gehen direkt zum
benannten Besitzer. Es gibt kein neues Sammelmodul für die frühere zyklische
Komponente und keine Kopie der SQL-Leser.

## Fachübergreifende Abläufe

`live-commands.ts` besitzt die bisherigen synchronen Party-/Scene-/Zeitcommands.
`live-command-flow.ts` setzt daran ausdrücklich die Folgen zusammen:
Autonomy, Dungeonfeatures/-sinne, Restock, Masken-/Chaseabgleich,
Positionsvererbung, Welt-/Wetterabgleich, Fortschrittsanlage und Musik.
Die Vorbereitung und Musik sind eng benannte synchrone Anschlüsse, keine
gegenseitig übergebenen Gesamtwriter.

`world-commands.ts` besitzt Weltcommands einschließlich Reiseabschnitten. Eine
Reise setzt Sceneort und Zeit durch lokale Live-Commands innerhalb derselben
äußeren SQLite-Transaktion. `WorldTimePort` bezeichnet nur Basisaufnahme,
Zeitbestätigung und Wiederherstellungsprüfung. `world-command-flow.ts` verbindet
diesen Ablauf mit Guard, Autonomybasis, Zeitfolgen und Musik. Dort bleiben die
Prüfungen aller tatsächlich wiederhergestellten Fachzustände nach History-Restore;
die lokalen Welt-/Live-Leser importieren diese Gesamtprüfung nicht zurück.
`live-validation.ts` und `world-validation.ts` enthalten die bisherigen
besitzereigenen Decoderprüfungen.

Generierung, Sessioncommands, Kopie, Planersatz, Gruppenänderung,
Fortschrittscommands und Maskensynchronisierung bleiben ausdrückliche Aufrufer
unterer Leser oder lokaler Operationen. Kein Servicecontainer, Eventbus oder
zweiter Datenbankbesitzer vermittelt diese Beziehungen.

## Unveränderte atomare Grenzen

- `CampaignStore.executeLive` hält weiter die äußere synchrone
  `immediate`-Transaktion. Der vorhandene Replaycheck und die Basisaufnahme liegen
  vor dem lokalen Live-Command. Dessen Guard läuft innerhalb der Transaktion vor
  Receiptprüfung und lokaler Live-Mutation. Die vorausgehende bestehende
  Autonomy-Basisaufnahme kann räumliche Grundlagen versiegeln; sie bleibt
  ebenfalls Teil der äußeren Transaktion und wird bei Guardfehler zurückgerollt.
  Danach folgen dieselben Wirkungen in derselben
  Reihenfolge; ein Fehler entfernt auch verschachtelte Writes und Receipts.
- Ein Live-Zeitschritt bestätigt zuerst den lokalen Uhrcommand, verarbeitet dann
  Features, Autonomy und Dungeonwahrnehmung, anschließend Restock; Masken-/
  Positions-/Weltfolgen und Musik behalten ihre bisherigen Bedingungen. Replay
  überspringt dieselben Folgewirkungen. Reine Scene-Titel-/Notizänderungen erhalten
  keine neue Wetterabhängigkeit.
- Ein Welt-Reiseabschnitt behält Uhr, Ortsänderung, Position, Wissen, Restock,
  Wettersynchronisierung, Zeitfolgen und History in ihrer bisherigen Reihenfolge.
  Der äußere Weltablauf bindet sämtliche Abschnitte, History und Weltreceipt in
  eine Transaktion. Undo/Redo prüft weiterhin die wiederhergestellten Fachzustände
  vor Commit und führt Zeitverbraucher bei Redo nicht erneut aus.
- Command-IDs, Fingerprints, Receiptbytes, kausale History, Schema und
  Archivkennungen sind unverändert. Zwischen Teilwirkungen gibt es kein Await.
  Ein normaler Neustart klärt dieselben dauerhaften Receipts.

Diese Regeln unterstützen insbesondere SMR-AC-04/06/07/08/09 und E2E-02/03.
Sie stellen keine neue vollständige Fach- oder Ownerabnahme dar.

## Strukturprüfung

`tools/module-graph.mjs` unterscheidet Wert- und Typkanten.
`tests/workspace/storage-owner-boundaries.test.mjs` prüft den aktuellen Graphen:
Die frühere gemeinsame Laufzeitkomponente darf nicht wieder entstehen. Nur die
separate bestehende Komponente `dungeon-key.ts` / `surfaces.ts` ist hier weiterhin
zugelassen. Reine Typzyklen werden gesondert durch die bestehende Baseline erfasst.
Die Baseline wird durch diese Aufteilung nur verkleinert.

`tools/storage-owner-boundaries.mjs` benennt die unteren Besitzer und die
aufrufenden Commands/Fassaden. Die Repositoryprüfung weist auch indirekte
Rückimporte über Typimporte, Reexports oder Lazyimporte zurück. Die Tests
injizieren diese Rückwege zusätzlich. Ein grüner Graph beweist die Struktur;
fachliche Tests und native Abläufe belegen ihre jeweils beschriebene Semantik.

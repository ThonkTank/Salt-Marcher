# C01: bestätigte Kopie nach Journal-Cleanupfehler frisch öffnen

[#80](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/80), Hex,
E2E-01 Nutzerzeile13 / `E2E01-HEX-SPACE-RUNTIME-NAVIGATION-001`.
[P01 prepared-Copy](../room-copy-journal-p01/README.md) ist durch
[separat integriert](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/163#issuecomment-6108600398).
Dieser Eingang ergänzt ausschließlich committed Copy: dieselbe bereits vollständig
geschriebene Kopie wiederherstellen, ohne neue Dateien oder Identitäten zu erzeugen.
Beide tatsächlichen Obsidianprozesse laufen auf sauberem Shared `a3b311f2d652739aec9b1d833f9ed8382984da83`;
Produktquelle `b6ec69d4290259e60e8acab61633b3b4a3ce2b69` und Buildpfad sind
[nachweislich unverändert](product-lineage.json). Gleicher installierter Build wie N02/C03/P01.

**Beide Runner PASS/Exit0/errors[]/failure null/shutdownFailure null.**
Neuer isolierter Vault aus dem tatsächlichen R03-Draft nach normalem Quit;
kein Neuseed des frischen Prozesses. Der vor Erstlauf eingefrorene
[QA-Helper](copy-committed-journal-c01-probe.cjs) setzt ausschließlich im ersten
Prozess einen Fehler an `app.vault.trash` für den exakten Copyjournalpfad.
Sichtbares Kartenmenü → Speichern unter → Kopie speichern erzeugt selbst sieben
native After-Dateien und das Journal. Erst nachdem die Commitbestätigung geschrieben
ist, scheitern initiale Journal-Cleanup und deren sofortige Recovery-Cleanup zweimal.
Alle sieben Dateien enthalten bereits ihre exakten After-Bytes, das tatsächliche
Journal bleibt committed; Dialog zeigt Speicherung unterbrochen/Daten erhalten.
Abbrechen erhält vollständigen Originalzustand, Kamera, History und Raumdraft.
Die Faultgrenze bleibt bis zum normalen Quit aktiv, kein Live-Retry ersetzt Fresh.

Journal SHA `61457a3dd4b4a419dd83bda6372e6c6f3dd8bde696078376f8ae96c87e23fc5d`;
Transaction `32b7cae1-0908-48c0-90de-d20738919a74`.
Nach normalem app.quit und geprüften verschwundenen PIDs folgt ein tatsächlicher neuer
Obsidianprozess, derselbe Vault. Normaler Originaldateieinstieg → sichtbares Speichern
unter/derselbe Name → „Unterbrochene Kopie wiederherstellen“. Er konsumiert exakt
das vorherige committed Journal, entfernt es und öffnet dieselbe unabhängige Kopie.
Alle sieben Dateihashes sowie dieselben23 lokalen IDs bleiben unverändert.
Kein Copyretry, neue UUID-Erzeugung, Save-Replay, handgeschriebenes Journal oder
direkter Handler-/Modellwrite ersetzt die sichtbare Wiederherstellung.

Normales Einpassen/Auswahl/Ctrl-Rad/Canvas-Raumklick zeigt `N02 Torraum — exakt`,
Nummer1 und literalen unsaved R03-Markdown. Vollworld, typisierter SpatialState,
gesamter Dungeon, Texte, Geometrie und geschlossene Bindungen sind exakt.
Eine aktuelle Repository/History, unregistriert ohne Campaign-/Registryautorität,
clean0/kein Redo/Draft/pending. Original8/Campaign/R03draft unverändert.

Fehlerprozess1791718836445, PIDs294946/295022/295029/295045;
Fresh1791719042503, PIDs300321/300394/300401/300416.
Beide Dienste inactive/dead/MainPID0/Exit0, forcedTerminationPids[], normale Enden
und PIDs weg unabhängig nachgeprüft. Alle841 geschützten historischen QA-/fremden
Dateien unverändert. Nutzervault nicht berührt.

Portable Originale:

- Fehlerprozess: [sichtbarer Fehler](fault/visible-committed-copy-cleanup-failure.png), [tatsächliches Journal](fault/actual-committed-copy-journal.json), [volle Probe](fault/committed-copy-fault-probe.json), [Runner](fault/result.json), [Build](fault/build.json), [Lebensdauer](fault/process-lifecycle.json)
- Frischer Prozess: [Raum-Key derselben wiederhergestellten Kopie](fresh/fresh-recovered-committed-copy-room-key.png), [volle Probe einschließlich sichtbarer Recoveryaktion](fresh/committed-copy-fresh-probe.json), [Runner](fresh/result.json), [Build](fresh/build.json), [Lebensdauer](fresh/process-lifecycle.json)
- Normale Enden: [Fehlerprozess](fault-after-normal-quit.json), [Fresh](fresh-after-normal-quit.json), [Nachprüfung](post-quit-verifier.py)
- [R03-Herkunft](input-lineage.json), [Originalhashes](input-native-hashes.json), [geschützte Dateien](protected-inputs-before.json), [Aufruf/Helperbindung](invocation.json), [Preload](copy-committed-journal-c01-preload.cjs)

Das ist eine native synthetische Producerprobe mit kontrolliertem Storagefehler
und lesendem Datei-/Modellorakel. Kein Hardcrash, physischer-/IME-/Meta-/freier GM-,
Room-Savejournal-, Original-/Großkarten-/Nutzervault- oder Gesamt-E2E-PASS.
Zwei Bilder belegen Fehlerdialog und anschließend sichtbare Raumfelder; die
Recoveryaktion ist in Helper/Probe gebunden, ohne separates Bild vor dem Klick.
Kanonisch `acceptance.hexAtlas.requirements[30].dungeonAtLocationRoomCopyCommittedJournalC01`.

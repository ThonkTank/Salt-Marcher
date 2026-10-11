# J01: bestätigten Room-Save nach Journal-Cleanupfehler frisch übernehmen

[#80](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/80), Hex,
E2E-01 Nutzerzeile13 / `E2E01-HEX-SPACE-RUNTIME-NAVIGATION-001`.
[Committed-Copy-C01](../room-copy-committed-journal-c01/README.md) ist durch
[separat integriert](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/164#issuecomment-6108755035).
Dieser Eingang ergänzt ausschließlich committed Room-Save. Beide tatsächlichen
Obsidianprozesse laufen auf sauberem Shared `593f8cca5358cca715ad5cca36f9f759af52a027`;
Produktquelle `b6ec69d4290259e60e8acab61633b3b4a3ce2b69` und Buildpfad sind
[unverändert](product-lineage.json). Keine Produktänderung in diesem Eingang.

**Native Daten-/Recoveryprobe PASS; Anzeigefehler im erhaltenen Editor offen.**
Beide Runner PASS/Exit0/errors[]/failure null/shutdownFailure null.
Neuer isolierter Vault aus dem tatsächlichen R03-Draft nach normalem Quit;
kein Neuseed des frischen Prozesses. Der vor Erstlauf eingefrorene
[QA-Helper](room-save-committed-j01-probe.cjs) injiziert ausschließlich im ersten
Prozess einen Fehler an `app.vault.trash` für das exakte committed Savejournal,
nachdem Dungeon und autorisierter Campaignmanifest geschrieben sind.
Sichtbares „Atlas speichern“ erzeugt selbst die drei nativen After-Zustände:
Roomtext in Karte.dungeon, Draft entfernt, Campaignmanifest aktualisiert.
Erst dann scheitern initiale Journal-Cleanup und sofortige Recovery-Cleanup zweimal.
Alle drei After-Zustände sind tatsächlich persistiert; das native Journal bleibt
committed. Von acht kanonischen Dateien ändern ausschließlich Dungeon und Manifest
legitim; die übrigen sechs bleiben bytegleich.

Journal SHA `272607f05206751e5584d1ddba0d9f85a058ec2cd827536e4a02372a1d0bf588`;
Transaction `b5d680d4-9708-4dc8-99f0-1ebb66897f21`.
Die aktuelle Kampagnenmontage ist danach unavailable ohne aktuelle
Repository-/History-/Rendererautorität. Eine erhaltene alte Repository/History
bewahrt Vollworld, SpatialState, Dungeon/Raumtext, Kamera und vorherigen Draftzustand.
Über sichtbares „Erhaltener Entwurf“ sind die alten Raumfelder lesbar.
**Tatsächlicher UI-Befund:** Die Kampagnenmeldung lautet
„Speicherbasis ist unbestätigt; Atlas unter seiner alten Identität erhalten.“, der erhaltene alte Editor bleibt aber
bei „Atlas wird gespeichert …“ stehen. Das ist kein voller Save-UX-PASS.
Die Fehlerprobe und Nachprüfung binden beide Texte; das Fehlerbild zeigt die
Kampagnenmeldung und einen Teil des Raumtexts, nicht alle Raumfelder im Bildausschnitt.

Nach normalem app.quit und verschwundenen gebundenen PIDs folgt ein tatsächlicher
neuer Obsidianprozess, derselbe Vault. Die normale Startup-Recovery konsumiert
das bestätigte Journal **bereits vor dem QA-Szenario**. Die unabhängige Nachprüfung
nach dem ersten Quit belegt dessen tatsächliche Existenz und Hash vor dem Freshstart;
beim frischen Szenariobeginn ist es bereits fort. Kein sichtbarer Recoverybutton,
Save-Replay oder erneut betätigter Save wird hierfür behauptet.
Normaler Originaldateieinstieg und sichtbares Einpassen/Ortsauswahl/Raumroute zeigen
`N02 Torraum — exakt`, Nummer1 und literalen R03-Markdown.
Das frische Bild zeigt alle Raumfelder. Alle acht gespeicherten After-Dateihashes,
World-/Placement-/Dungeon-/Room-IDs, Vollworld/SpatialState/Dungeon sind exakt;
eine aktuelle managed Repository/History/Renderer, clean0/kein Redo/Draft/pending.
Journal und Draft sind fort. Keine Copy-/neue Identitätserzeugung.

Fehlerprozess1791720181219, PIDs332893/332968/332976/332986;
Fresh1791720224833, PIDs334763/334839/334846/334859.
Beide Dienste inactive/dead/MainPID0/Exit0, forcedTerminationPids[], normale Enden
und PIDs weg unabhängig nachgeprüft. Alle1013 geschützten historischen QA-/fremden
Dateien einschließlich des ursprünglichen R03-Vaults unverändert; Nutzervault unberührt.

Portable Originale:

- Fehlerprozess: [sichtbarer Zustand](fault/visible-room-save-cleanup-failure-retained-key.png), [tatsächliches Journal](fault/actual-committed-room-save-journal.json), [volle Probe](fault/room-save-committed-fault-probe.json), [Runner](fault/result.json), [Build](fault/build.json), [Lebensdauer](fault/process-lifecycle.json)
- Frischer Prozess: [vollständiger Raum-Key](fresh/fresh-recovered-committed-room-save-key.png), [volle Probe](fresh/room-save-committed-fresh-probe.json), [Runner](fresh/result.json), [Build](fresh/build.json), [Lebensdauer](fresh/process-lifecycle.json)
- Normale Enden: [Fehlerprozess](fault-after-normal-quit.json), [Fresh](fresh-after-normal-quit.json), [Nachprüfung](post-quit-verifier.py)
- [R03-Herkunft](input-lineage.json), [Originalhashes](input-native-hashes.json), [geschützte Dateien](protected-inputs-before.json), [Aufruf/Helperbindung](invocation.json), [Preload](room-save-committed-j01-preload.cjs)

Native synthetische Producerprobe mit kontrolliertem Storagefehler und lesendem
Datei-/Modellorakel. Kein handgeschriebenes Journal, Hardcrash, physischer-/IME-/Meta-/
freier GM-, prepared-Room-Savejournal-, Original-/Großkarten-/Nutzervault- oder Gesamt-E2E-PASS.
Kanonisch `acceptance.hexAtlas.requirements[30].dungeonAtLocationRoomSaveCommittedJournalJ01`.

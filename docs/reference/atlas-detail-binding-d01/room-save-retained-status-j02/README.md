# J02: Saveanzeige im erhaltenen Editor angehalten

[#80](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/80), Hex,
E2E-01 Nutzerzeile13 / E2E01-HEX-SPACE-RUNTIME-NAVIGATION-001.
[J01](../room-save-committed-journal-j01/README.md) wurde [integriert
und integriert](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/165#issuecomment-6108940024). Sein tatsächlicher
Anzeigefehler wird hier im bestehenden Paket repariert.

**Produktkorrektur:** Nach committed Room-Save/Cleanupfehler verlor der alte Editor
seine aktuelle Autorität, bewahrte aber „Atlas wird gespeichert …“.
AtlasEditor.suspend zeigt jetzt „Entwurf erhalten; Bearbeitung angehalten.“.
Eine spät erfolgreiche Saveantwort aktualisiert keinen bereits geschlossenen
Editor. Zwei Produktzeilen ändern Anzeige/Antwortbehandlung; Storage, Journal,
Identitäten und Widerruf bleiben gleich. [Exakter Patch](product-fix.patch).

Die [beiden direkten Regressionen](checks/hex-retained-save-status-green.log)
scheitern auf der [alten Basis 2/2](checks/hex-retained-save-status-red.log):
echtes committed Journal-Cleanup sowie verspätete Saveantwort nach Serviceclose.
Nach dem Fix bestehen beide, alle [78 Atlas-Hosttests](checks/hex-retained-save-status-host-tests.log),
[Typprüfung](checks/hex-retained-save-status-typecheck-final.log) und
[Produktbuild](checks/hex-retained-save-status-product-build.log).
Der zweite Antwortfall ist ein DOM-/Teststoragefall, kein nativer Hostbeleg.

**Native J02-Fehler-/Freshprobe PASS.** Zwei neue tatsächliche Obsidianprozesse
auf sauberer Produktquelle 61684630425303519a8fcbdd661f07a498b44db3, Buildmain
e348a11457e4fe5e4a79dd1cadf663f92f7ae6017fd02d778317682277f3f2cf; vollständiges Triplet in [Aufruf](invocation.json).
Neuer isolierter Vault aus dem tatsächlichen R03-Draft; Fresh ohne Neuseed.
Der [vor Erstlauf eingefrorene Helper](room-save-committed-j02-probe.cjs) betätigt
sichtbares „Atlas speichern“. Nach Dungeon-After, Draftentfernung und autorisiertem
Campaignmanifest-After scheitert app.vault.trash ausschließlich am exakten echten
committed Journal zweimal. Drei native After-Zustände bleiben persistiert.
Journal SHA 1f98f039383b8c70f7e276797ca53e7e4183e2496eab22ffaea966d2a34caf73,
Transaction 1206c348-c205-47e8-b975-d886c55c6b46.
Keine handgeschriebene Transaktion, Savewiederholung oder direkte Produktmodellmutation.

Alte Montage unavailable ohne aktuelle Repository-/History-/Rendererautorität;
Vollworld/SpatialState/Dungeon/Raumtext/Kamera/History-/Draftzustand exakt erhalten.
Sichtbares „Erhaltener Entwurf“ zeigt die alten Raumfelder. Das [zusätzliche echte
Fehlerbild](fault/visible-retained-save-status.png) zeigt die angehaltene Anzeige
zusammen mit „Speicherbasis ist unbestätigt; Atlas unter seiner alten Identität erhalten.“.
Das erste Fehlerbild enthält einen Teil des Raumtexts, nicht alle Raumfelder.

Nach normalem Quit/PIDs weg übernimmt ein tatsächlicher neuer Prozess denselben
Vault. Startup-Recovery konsumiert das bestätigte Journal bereits **vor dem
QA-Szenario**; der [erste unabhängige Quitbeleg](fault-after-normal-quit.json)
bindet sein Vorhandensein vor Fresh. Kein sichtbarer Recoverybutton oder Save-Replay.
Normaler Dateieinstieg/Fit/Ortsmarker/Raumroute zeigt N02 Torraum — exakt,
Nummer1 und literalen R03-Markdown. Das [Freshbild](fresh/fresh-recovered-committed-room-save-key.png)
zeigt vollständige Raumfelder. Dieselben acht gespeicherten After-Dateihashes/IDs,
Vollworld/SpatialState/Dungeon; eine aktuelle managed Repository/History/Renderer
clean0, kein Redo/Draft/pending, Journal fort. Nur Dungeon und Campaignmanifest
legitim geändert; sechs übrige kanonische Dateien bytegleich.

Fehlerprozess1791721547823, PIDs369502/369578/369585/369599;
Fresh1791721600066, PIDs371967/372041/372048/372064.
Beide Runner0/PASS/errors[]/failure null/shutdownFailure null, normale Enden,
inactive/dead/MainPID0/Exit0, forcedTerminationPids[], PIDs weg unabhängig geprüft.
1175 geschützte historische/fremde Dateien einschließlich J01 unverändert;
Nutzervault unberührt. [Neu koordinierter Slot](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/11#issuecomment-6108995776), [zurückgegeben](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/11#issuecomment-6109012729).

Danach integrierter Shared dd7311e0ca310cee747cc8368fe87165ff2cfad9 regulär in 4be86954199076976c704a3667ba35799e4321a4 übernommen.
[Kompositionsbeleg](shared-composition.json): AtlasEditor/Panels/Services/Host/Fixture
unverändert; src/model.ts verändert für optionale V4-Volumes, die dieser Dungeon
nicht hat. Keine pauschale Produkt-/Tripletgleichheit; native Quelle bleibt gebunden.
[78 Atlas-Hosttests am zusammengesetzten Stand](checks/composed-atlas-host-tests.log)
bestehen; finale Kandidaten-CI bindet Typprüfung/Volltests/Build getrennt.

Portable Originale:

- Fehler: [Roomzustand](fault/visible-room-save-cleanup-failure-retained-key.png), [Status](fault/visible-retained-save-status.png), [Journal](fault/actual-committed-room-save-journal.json), [Probe](fault/room-save-committed-fault-probe.json), [Runner](fault/result.json), [Build](fault/build.json), [Lebensdauer](fault/process-lifecycle.json)
- Fresh: [Raum-Key](fresh/fresh-recovered-committed-room-save-key.png), [Probe](fresh/room-save-committed-fresh-probe.json), [Runner](fresh/result.json), [Build](fresh/build.json), [Lebensdauer](fresh/process-lifecycle.json)
- Normale Enden: [Fehler](fault-after-normal-quit.json), [Fresh](fresh-after-normal-quit.json), [Nachprüfer](post-quit-verifier.py)
- [Herkunft](input-lineage.json), [Originalhashes](input-native-hashes.json), [Schutzbindung](protected-inputs-before.json), [Preload](room-save-committed-j02-preload.cjs)

Kanonisch acceptance.hexAtlas.requirements[30].dungeonAtLocationRetainedSaveStatusJ02.

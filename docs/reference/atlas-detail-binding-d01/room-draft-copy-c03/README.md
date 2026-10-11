# C03: nativer Copy-/Abbrechen-/Fresh-Nachweis

[#80](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/80),
Hex, E2E-01 Nutzerzeile13 / `E2E01-HEX-SPACE-RUNTIME-NAVIGATION-001`,
[PR157](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/157).
Produktquelle `b6ec69d4290259e60e8acab61633b3b4a3ce2b69`, sauberer Laufcheckout
`fc835e811853ddd45d066fa18dc85870988d7ba9`, qualifizierter Shared `fcec359381d1a84f9d65b628ccdb0172c9cec2c7`.
Der [gezielte unabhängige N02-Review](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/157#issuecomment-6108108606)
ist konsumiert. Produkt-/Buildpfad seit dieser geprüften Quelle unverändert;
identischer Build in beiden echten Obsidianprozessen, keine neue Produktsuite nötig.

**Beide Runner PASS/Exit0/errors[]/shutdownFailure null.** Neuer isolierter Vault
ist ein exaktes Abbild des tatsächlichen R03-Drafts nach dessen normalem Quit,
keine nachträglich erzeugte Raumtextfixture. Neuer vor Erstlauf eingefrorener
C03-Helper korrigiert ausschließlich den readonly QA-Read: voller aktueller Atlas
über `repository.spatialGraph.world()`, `spatialState()` separat als version/
detailPlacements. Die ausgeführten [C02-Fehlbelege](../room-draft-copy-c02/README.md)
und C01-Vault/Helfer/Rohbelege bleiben bytegleich; ihr FAIL wird nicht überschrieben.

Prozess1791716287249: normaler Atlas-/Ort-/Raumeinstieg → sichtbares Kartenmenü/
Speichern unter → Abbrechen erhält vollständigen Runtimezustand und Draft →
Kopie speichern → Fit/Auswahl/Ctrl-Rad/Canvas-Raumklick zeigt den Raum-Key der
unabhängigen Kopie. Sieben neue native Dateien enthalten23 frische geschlossene
lokale IDs, exakte Geometrie und alle nicht identitätsbezogenen Werte einschließlich
des unsaved Raums `N02 Torraum — exakt`, Nummer1 und literalem Markdown.
Die Kopie ist unregistriert, ohne Campaign-/Registry-/SaveParticipantbefugnis,
auf einer aktuellen Repository/History, History0/kein Redo/clean/kein Draft/pending.
Vollworld, typisierter SpatialState und vollständiger Dungeon passen zu nativen Dateien.

Nach normalem app.quit und bestätigten verschwundenen PIDs folgt genau ein
neuer Obsidianprozess1791716357114: normaler Dateieinstieg derselben gespeicherten
Kopie → Fit/Auswahl/Ctrl-Rad/Canvas-Raumklick zeigt denselben exakten Raum-Key.
Dieselben sieben Copydateien und Kennungen sind bytegleich; Runtime ist wieder clean0.
Kein Copy-Callback, Save-Replay oder Fixture-Neuseed im zweiten Prozess;
`--restart` erhält den actual R03-/Copy-Vault in beiden Aufrufen.

Beide Dienste inactive/dead/MainPID0/ExecMainStatus0, forcedTerminationPids[],
alle gebundenen App-PIDs weg. Original8/Campaignmanifest und tatsächlicher R03-Draft
`7ec52f2a25b8530857362095b2855381ade3f013d2d798dfed40c75bda201b97`
bleiben bytegenau, ebenso ausgeführte C01/C02-Eingänge und fremde lokale Änderungen.

Portable Originale und Erhaltungsorakel:

- Copy: [sichtbarer Raum-Key](copy/visible-copied-room-key.png), [Modal vor Abbrechen](copy/copy-modal-before-cancel.png), [volle UI-/Closure-/Runtimeprobe](copy/copy-room-copy-probe.json), [Runner](copy/result.json), [Build](copy/build.json), [Prozesslebensdauer](copy/process-lifecycle.json)
- Fresh: [sichtbarer Raum-Key](fresh/fresh-process-copied-room-key.png), [volle Probe](fresh/copy-room-fresh-probe.json), [Runner](fresh/result.json), [Build](fresh/build.json), [neue Prozesslebensdauer](fresh/process-lifecycle.json)
- Normal beendete [Copy](copy-after-normal-quit.json) / [Fresh](fresh-after-normal-quit.json) samt PIDs, Original-/Copyhashes und Erhaltungschecks
- [Actual R03-Herkunft](input-lineage.json), [ursprüngliche native Hashes](input-native-hashes.json), [geschützte frühere Eingänge](protected-inputs-before.json)
- [Aufruf/Identität](invocation.json), [ausgeführter C03-Helper](copy-room-c03-probe.cjs), [reiner QA-Preload](copy-room-c03-preload.cjs)

Synthetische sichtbare Eingabe, setup ordinary file open und nachträgliche readonly
Orakel sind getrennt. Dies ist eine gezielte Producerprobe; freie GM-Belege bleiben
bei ihren echten Reviewern. Physische/IME/Meta-Eingabe, unterbrochene Save-/Copyjournale,
Hardcrash, Kamera-/Historyrestauration nach Fresh, Originalparität, Großkarten,
Nutzervaultinstallation und gemeinsames Gesamt-E2E sind hier nicht qualifiziert.

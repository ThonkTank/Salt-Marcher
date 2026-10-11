# C02: Copy sichtbar, QA-Orakel scheitert, Fresh nicht gestartet

[#80](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/80),
Hex, E2E-01 Nutzerzeile13, PR157. Produktquelle
`b6ec69d4290259e60e8acab61633b3b4a3ce2b69`, sauberer Laufcheckout
`fb5266fcd0920d606b687c53fbedb6074e5e883e`, Shared `fcec3593`.
Der [gezielte unabhängige N02-Review](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/157#issuecomment-6108108606)
ist PASS; er enthält keinen eigenen nativen Copy-/Fresh-Nachweis.

Genau ein sichtbarer Obsidianprozess wurde
mit einem neuen isolierten Abbild des tatsächlichen R03-Draftvaults gestartet.
Ort/Raum-Key → Kartenmenü/Speichern unter → Abbrechen erhält den Zustand →
Kopie speichern → Fit/Ctrl-Rad/Canvas-Raumklick erreicht die unabhängige Kopie
und zeigt den exakten unsaved Raumtext. Sieben neue native Dateien enthalten23
frische geschlossene Kennungen und dieselben nicht identitätsbezogenen Werte.
Original8, Campaignmanifest und R03-Draft bleiben nach normalem Quit byteexakt.

**Der Runner ist FAIL, kein vollständiger Copy-/Fresh-PASS.** Nach sichtbarem
Raum-Key scheitert die eingefrorene Assertion `s.world === native.world`:
Der QA-Statehelper liest mit `spatialState()` nur version/detailPlacements,
erwartet danach aber den vollständigen nativen Overworld. Das entspricht
`SpatialState` in `src/features/atlas/spatial-schema.ts`, kein daraus belegter
Produktverlust. Ein nachträglicher readonly Vergleich des tatsächlich aufgezeichneten
Teilzustands und Dungeonrecords besteht; er überschreibt den FAIL nicht.
Fresh wurde nicht gestartet, Helfer/Fehlervault/Rohbelege bleiben unverändert.

Portable Originale, unveränderte Bytes:

- [Copyprobe samt Closure-/Text-/Runtimebeobachtung](copy-room-copy-probe.json)
- [Runner FAIL und genaue Assertion](result.json)
- [Normaler Quit/PIDs](process-lifecycle.json), [nachträglicher readonly Erhaltungsnachweis](runner-result.json)
- [Sauberer Build](build.json), [eingefrorener Aufruf](invocation.json)
- [R03-Herkunft](input-lineage.json), [acht ursprüngliche Hashes](input-native-hashes.json)
- [Ausgeführter Helper](copy-room-c02-probe.cjs), [reiner QA-Scenario-Preload](copy-room-c02-preload.cjs)
- [Modal vor Abbrechen](copy-modal-before-cancel.png), [sichtbare Kopie am Fehlerpunkt](failure.png)

Der einzige Prozess1791715037078 endet mit app.quit normal; kein forced PID,
inactive/dead/MainPID0/ExecMainStatus0; alle gebundenen App-PIDs weg.
Synthetische sichtbare Eingaben, keine physische/GM-/Original-/Großkarten-/Nutzervault-
oder Gesamt-E2E-Abnahme. Kanonischer Beleg:
`acceptance.hexAtlas.requirements[30].dungeonAtLocationRoomDraftCopyC02`.

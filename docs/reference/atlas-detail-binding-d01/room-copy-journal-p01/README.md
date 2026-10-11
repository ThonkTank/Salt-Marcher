# P01: tatsächlich unterbrochene Kopie im frischen Obsidian wiederherstellen

[#80](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/80),
Hex, E2E-01 Nutzerzeile13 / `E2E01-HEX-SPACE-RUNTIME-NAVIGATION-001`.
[PR157](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/157)
ist separat integriert. Beide tatsächlichen Prozesse laufen auf sauberem qualifiziertem
Shared `b9ce238538e290f95da7018e356ebe542c9398ef`; Produktquelle `b6ec69d4290259e60e8acab61633b3b4a3ce2b69` und Buildpfad
sind [nachweislich unverändert](product-lineage.json). Derselbe installierte Build
wie im gezielt unabhängig geprüften N02/C03; keine neue Vollsuite allein wegen Merge-SHA.

**Beide Runner PASS/Exit0/errors[]/failure null/shutdownFailure null.**
Neuer isolierter Vault aus dem tatsächlichen R03-Draft nach normalem Quit.
Kein handgeschriebenes Journal, keine nachträgliche Raumtextfixture und kein Modell-
oder Handleraufruf ersetzen die sichtbaren Aktionen. Der vor Erstlauf eingefrorene
[QA-Helper](copy-journal-p01-probe.cjs) setzt ausschließlich im ersten Prozess
kontrollierte Fehler an zwei echten Vaultgrenzen: nach einer tatsächlich angelegten
Copy-Terraindatei scheitert die zweite native Create; anschließend scheitert die
sofortige Rollback-Trash der ersten Zieldatei. Originaldateien/Draft bleiben verfügbar.
Die Fehler bleiben bis zum normalen Prozessende aktiv; kein Live-Retry ersetzt Fresh.

Prozess1791717786772: normaler Atlas-/Ort-/Raumeinstieg → sichtbares Kartenmenü/
Speichern unter → Kopie speichern erzeugt selbst das native sieben Writes umfassende
`prepared` Journal. Eine echte Zielterrain-Datei enthält After, sechs Ziele fehlen,
einschließlich Atlasroot. Dialog meldet Speicherung unterbrochen und Daten erhalten;
Abbrechen hält vollständigen Originalzustand/Kamera/History/Draft bytegenau.
Journal SHA `24c8ca8725a4ae99da9e76277e76a504cf2913ea46d02a15e9d2c7e0af37a2a9`;
Transaction `064519d6-7c95-4b2e-9442-3b3ec84c7351`.

Nach normalem app.quit und nachgewiesen verschwundenen PIDs folgt genau ein neuer
Obsidianprozess1791717853312, derselbe Vault ohne Neuseed/Save-Replay. Normaler
Originaldateieinstieg → sichtbares Speichern unter, derselbe Name →
„Unterbrochene Kopie wiederherstellen“. Exakt das vorherige tatsächliche Journal
wird konsumiert; alle sieben Ziele und Journal fehlen am Recoveryabschluss.
Sichtbare Meldung: „Unvollständige Kopie zurückgenommen. Die Kopie kann jetzt neu
gespeichert werden.“ Voller Originalzustand/Kamera/History/Draft bleiben exakt.
Danach „Kopie speichern“ im selben sichtbaren Dialog: sieben neue geschlossene
Dateien/23 frische lokale IDs; gewöhnliches Fit/Auswahl/Ctrl-Rad/Canvas-Raumklick
zeigt `N02 Torraum — exakt`, Nummer1 und literalen unsaved R03-Markdown.
Vollworld/typisierter SpatialState/gesamter Dungeon stimmen; unabhängige unregistrierte
Kopie ohne Campaign-/Registryautorität, eine Repository/History, clean0/kein Redo/Draft/pending.

Die nachträgliche Quitprüfung wurde vor Belegbindung korrigiert: nach erfolgreichem
Copyretry ist derselbe Rootdateiname beabsichtigt neu belegt. Der GUI-Stage-Check
belegt alle sieben Ziele davor abwesend; danach bleiben alte Child-IDs/-Pfade fort,
Root enthält eine neue World-ID und alle neuen Copyhashes passen. Keine neue GUI-
Ausführung, keine Änderung an ausgeführtem Helper, Raw oder Vault wegen dieser Korrektur.

Beide Dienste inactive/dead/MainPID0/Exit0, forcedTerminationPids[], gebundene
App-PIDs268733/268806/268813/268827 und271523/271595/271602/271607 geprüft weg.
Original8/Campaignmanifest und actual R03-Draft sowie frühere C01/C02/C03/R03-
Vaults/Helfer/Rohbelege und drei fremde lokale Dateien unverändert.
[Neuer ausdrücklich koordinierter Slot](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/11#issuecomment-6108497514), [zurückgegeben](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/11#issuecomment-6108520121).

Portable Originale:

- Fehlerprozess: [sichtbarer Fehlerdialog](fault/visible-copy-write-failure.png), [tatsächliches Journal](fault/actual-prepared-copy-journal.json), [vollständige Probe](fault/copy-journal-fault-probe.json), [Runner](fault/result.json), [Build](fault/build.json), [Lebensdauer](fault/process-lifecycle.json)
- Frischer Prozess: [sichtbare Wiederherstellung](fresh/fresh-visible-copy-recovery.png), [Raum-Key nach Copyretry](fresh/fresh-recovered-retried-copy-room-key.png), [volle Probe](fresh/copy-journal-fresh-probe.json), [Runner](fresh/result.json), [Build](fresh/build.json), [Lebensdauer](fresh/process-lifecycle.json)
- Geprüfte normale Enden: [Fehlerprozess](fault-after-normal-quit.json) und [Fresh](fresh-after-normal-quit.json); [korrigierte nachträgliche Prüfung](post-quit-verifier.py)
- [R03-Herkunft](input-lineage.json), [Originalhashes](input-native-hashes.json), [geschützte historische Dateien](protected-inputs-before.json), [Aufruf und Helperbindung](invocation.json), [QA-Preload](copy-journal-p01-preload.cjs)

Dies qualifiziert ausschließlich das vorbereitete Copyjournal mit fehlendem Root,
frische sichtbare Rücknahme und erfolgreichen Copyretry. Kontrollierte Storagefehler,
synthetische UI und readonly Orakel sind getrennt; kein Hardcrash/physischer-/IME-/
Meta-/freier GM-/committed-Copy-/Savejournal-/Original-/Großkarten-/Nutzervault- oder
Gesamt-E2E-PASS. Ein dritter Fresh des Copyretry wurde nicht durchgeführt; den normalen
unveränderten Copy-Frischeinstieg belegt [C03](../room-draft-copy-c03/README.md).
Kanonisch `acceptance.hexAtlas.requirements[30].dungeonAtLocationRoomCopyJournalP01`.

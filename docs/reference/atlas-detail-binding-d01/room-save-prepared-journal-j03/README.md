# J03: Vorbereiteter Raum-Save und ungespeicherter Draft nach Neustart

[#80](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/80), Hex,
E2E-01 Nutzerzeile13 / E2E01-HEX-SPACE-RUNTIME-NAVIGATION-001.
Die konkrete J02-Statuskorrektur ist [unabhängig auf54c3ddd geprüft](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/167#pullrequestreview-5483352608).
J03 liefert den bisher fehlenden nativen **prepared Room-Save**-Eingang;
Produktcode, Kennungen, Journalsemantik und historische J01/J02-Belege bleiben gleich.

**Native Fehler-/Freshprobe PASS.** Beide tatsächlichen Obsidianprozesse liefen
auf sauberer Quelle54c3ddd53507f358ac99efd8c8d08c2e7edb5902, Buildmain
6c43fcfe022c68ce361cef156bd36e633b8d02b3737fa59e73bb8dcbb0e84430.
Triplet und vor Erstlauf eingefrorene Helfer stehen im [Aufruf](invocation.json).
Neuer isolierter Vault aus dem erhaltenen echten R03-Draft; kein Neuseed vor Fresh.
Der [gleiche Faultadapter](prepared-save-fault.cjs) bestand zuvor eine einzelne
[DOM-/Vault-Vorprobe](preflight/preflight-observations.json). Ihr anderer Raumtext
und Modellneustart sind ausdrücklich kein nativer Nachweis.

Der [native Helper](room-save-prepared-j03-probe.cjs) betätigt sichtbares „Atlas speichern“.
Das Produkt erzeugt selbst sein echtes prepared-Journal mit genau drei Writes:
Dungeon After, Draft null, Campaignmanifest After. Nach dem ersten Write scheitert
die exakte Draft-Löschung einmal; der anschließende exakte Dungeon-Rollback wird
unter demselben noch vorhandenen prepared-Journal unterbrochen. Sonstige Vaultcalls
delegieren unverändert. Keine handgebaute Transaktion, direkte Handler-/Modellwrites,
Savewiederholung oder Hardcrash. Die kontrollierten Fehler bleiben bis zum normalen
Prozessende aktiv.

[Fehlerzustand](fault/room-save-prepared-fault-probe.json): Nur die Dungeondatei
enthält das teilweise geschriebene After. Alle sieben übrigen kanonischen Dateien
einschließlich Kampagnenmanifest und der tatsächliche R03-Draft bleiben bytegleich
zum ursprünglichen Before. Der alte Mount ist unavailable ohne aktuelle Autorität;
Vollworld/SpatialState/Dungeon, literaler Raumtext, Kamera und History-/Dirty-/Draftzustand
bleiben exakt erhalten. Das [Statusbild](fault/visible-retained-save-status.png)
zeigt „Entwurf erhalten; Bearbeitung angehalten.“ und die unbestätigte Speicherbasis.
Das erste Fehlerbild zeigt nur einen Teil des Raumtexts; vollständige Felder werden
über die tatsächlichen UI-Textboxwerte und das Freshbild gebunden.

Der [erste unabhängige Quitbeleg](fault-after-normal-quit.json) bindet das tatsächlich
vor Fresh vorhandene [prepared-Journal](fault/actual-prepared-room-save-journal.json).
Ein neuer Prozess öffnet denselben Vault normal. Startup-Recovery rollt das Journal
bereits vor dem QA-Szenario zurück; kein sichtbarer Recoverybutton wurde benutzt.
Alle acht ursprünglichen nativen Before-Dateien/IDs sind wieder bytegleich, Journal
entfernt. Die gespeicherte Dungeondatei enthält wieder den älteren R02-Raumtext;
der erhaltene ungespeicherte R03-Draft stellt zugleich den neueren vollständigen
Dungeon/Raum-Key im Editor her. Beide Zustände werden bewusst getrennt geprüft.

Normaler Dateieinstieg/Fit/Ortsmarker/Raumroute zeigt im [Freshbild](fresh/fresh-rolled-back-room-save-unsaved-key.png)
„N02 Torraum — exakt“, Nummer1 und den literalen Markdown
`## Eingang\nR03: Ungespeicherter Raumtext lebt nach regulärem Neustart.  \n\n`.
Eine aktuelle managed Repository/History/Renderer, History0/kein Redo/pending;
**dirty=true, hasDraft=true**. Dieser Recoveryfall ist kein erfolgreicher Save.
Der ursprüngliche Draft bleibt bytegleich; frische Kamera/Undo-History werden nicht behauptet.

Fehler1791723695834, PIDs434913/434989/434996/435004;
Fresh1791723738158, PIDs436712/436785/436792/436805.
Beide Runner0/PASS/errors[]/failure null/shutdownFailure null, normale app.quit-Enden,
inactive/dead/MainPID0/ExecMainStatus0, forcedTerminationPids[], alle PIDs unabhängig fort.
[Nachprüfer](post-quit-verifier.py) prüft die unveränderten Helfer, Source/Triplet,
native Bytes, ursprünglichen Draft und 1342 geschützte historische/fremde Dateien.
Vor dem ersten Appstart scheiterte allein der direkte Aufruf der nicht ausführbaren
Shell-Datei mit126; der unveränderte Runner wurde über Bash gestartet. Kein zusätzlicher
Appprozess, kein nativer Wiederholungslauf. Das [Aufruffehlerlog](fault-unlaunched-runner-permission.log) bleibt erhalten.
[Neuer Slot](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/11#issuecomment-6109288746)
ist [ausdrücklich zurückgegeben](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/11#issuecomment-6109309874).
Nutzervault und alte FAIL-/PASS-Rohbelege sind unberührt.

Portable Originale:

- Fehler: [Probe](fault/room-save-prepared-fault-probe.json), [Journal](fault/actual-prepared-room-save-journal.json), [Raumzustand](fault/visible-room-save-prepared-failure-retained-key.png), [Status](fault/visible-retained-save-status.png), [Runner](fault/result.json), [Build](fault/build.json), [Lebensdauer](fault/process-lifecycle.json)
- Fresh: [Probe](fresh/room-save-prepared-fresh-probe.json), [Raum-Key](fresh/fresh-rolled-back-room-save-unsaved-key.png), [Runner](fresh/result.json), [Build](fresh/build.json), [Lebensdauer](fresh/process-lifecycle.json)
- Normale Enden: [Fehler](fault-after-normal-quit.json), [Fresh](fresh-after-normal-quit.json); [Herkunft](input-lineage.json), [Originalhashes](input-native-hashes.json), [Schutzbindung](protected-inputs-before.json), [Preload](room-save-prepared-j03-preload.cjs)

Kanonisch acceptance.hexAtlas.requirements[30].dungeonAtLocationRoomSavePreparedJournalJ03.

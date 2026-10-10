---
area: campaign
owner: Stadt
issue: 69
status: active
checkpoint: cityExecution
---
# Manuelle Sessionplanung ohne Party und Generator

Consumer ist die GM-Vorbereitung in [#69](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/69). Grundlage: SRC-P01/P03 und AC-F03/AC-P01/P02 im [Quellenregister](../../scope-sources.json), gepinnte Session-Planner-Requirements auf Salt-Marcher9de85c1. Das vollständige Paket endet beim nutzbaren persistenten Plan und frischem Reopen, nicht bei diesem ersten Kern-/DOM-Eingang.

## Bereits implementierter unabhängiger Eingang

`ManualPlanner` verwaltet immutable Plan-/Szenenpayloads mit stabilen kampagnenlokalen UUIDs und eigenen monotonen Planrevisionen. Blankname und fehlender Ort sind gültig; Szenen mit demselben Ortsverweis behalten unterschiedliche Szenenkennungen. Revisiongebundene Aktionen bearbeiten Titel/Prosa/readonly Ortsverweis, Reihenfolge, Entfernung und Planname. Aktuelle Planlöschung erzeugt eine leere Ersatzplanung atomar; nicht aktuelle Aktionen ändern weder Auswahl noch deren Draft. Kennungskollision, stale Revision und hostgelieferter Contextguard scheitern vor der Wirkung.

Szenendrafts behalten ihre ursprüngliche Planrevision über weitere Eingaben. Wechsel übernimmt den alten Draft nur bei weiterhin gültiger Source; Fehler erhält Auswahl und Text. Die DOM-Oberfläche erlaubt Anlegen, Planwechsel, Rename/Delete, Szenenbearbeitung, Move/Delete, Übernehmen/Verwerfen. Eingabe rendert den Inspector nicht neu; Alle DOM-Aktionen binden die angezeigte Plan-ID, Revision und Szenenauswahl sowie den Renderzyklus; auch externe Modellwechsel ohne Render dürfen weder Payload noch fremden Draft verändern. Controls sind native Labels/Buttons/Inputs, flexibler Toolbarumbruch und relative Textareaweite; Tastatur-/200%-Hostabnahme steht aus.

## Konkrete fehlende Aktivierung

Der Kandidatenpayload ist **kein bestätigtes natives Speicherformat**. Kein Pluginview/Command ist aktiviert; keine Datei, Party, LiveSession oder Atlas wird geschrieben. Die in-memory Workspace-Klasse ist keine zweite Campaignpersistenz. Die Oberfläche benennt die fehlende dauerhafte Speicherung ausdrücklich.

Campaign/Data bestätigt für `manual-planner.ts` die neuen Plan-/Scene-Records, Referenzclosure optionaler Location-IDs, Namespace/Revisionbindung und Ownerpayload→native Dateiplan/atomaren Publish. Der Host muss `assertCurrent` an den tatsächlich eingefrorenen Campaigncontext binden; ein leeres Callback ist ausschließlich synthetischer Test. Der bestehende #41-Publisher wird konsumiert, nicht kopiert. Hydrierung verwendet dann den gleichen validierten Payloadcodec; durable Receipt/Recovery und Fehler nach Publish brauchen dessen tatsächlichen Vertrag. Chroniks PreparationSnapshot aus #60 bleibt einziger späterer Runtime-Transfervertrag; manuelle Planung setzt ihn nicht voraus.

Nächster eigener Schritt: unabhängig reviewed Kern-/DOM-Stand mit bestätigten Campaign-Datei-/Ownerinputs an bestehenden Host und Persistenz anschließen. Danach getrennt tatsächliches Save/Close/Fresh-Reopen, IDs/Prosa/Order-Erhalt sowie Write-/Context-/Recoveryfehler prüfen. Ortlose Planung bleibt ausführbar; positive Ortsprojektion braucht bestätigte Quelle. Generator, Partybudget, Encounter/Rewards und vollständige Originalparität bleiben im Gesamtumfang und werden nicht durch diese manuelle Teilfolge freigegeben.

## Nachbesserung des unabhängigen Kernreviews

MANUAL-PLANNER-CORE-R01 auf PR #71/80455ee fand einen fremden Draftverlust beim alten Szenen-Löschhandler und eine offene Szenenarray-Grenze. Die Reparatur bindet Buttons, Planpicker und Inspectoreingaben gemeinsam an den tatsächlich angezeigten Workspace. Regressionen führen erhaltene DOM-Callbacks nach externem Planwechsel mit Dirty-B-Draft aus; auch externe Szenenauswahl innerhalb derselben Planrevision muss ohne Wirkung scheitern. Codec-Regressionsfälle weisen Löcher, zusätzliche String-/Symbolfelder und Indexgetter vor Hydrierung zurück; Getter werden nicht aufgerufen. Der inzwischen bestandene unabhängige Delta-Recheck ist unten gebunden. Dauerhafte Speicherung und Produktaktivierung bleiben offene Eingänge desselben Pakets.

Die unabhängige Delta-Nachprüfung [CORE-R02](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/71#pullrequestreview-5480799736) schließt beide Pflichtbefunde auf `425afd8`. Eine anschließende eigene Bedienprüfung fand den fehlenden Wiederzugang nach extern geänderter Auswahl/Revision: `Ansicht aktualisieren` rendert ausschließlich den aktuellen Workspace neu, ohne Commit/Discard/Selectionwrite. Dirty Zielentwürfe bleiben exakt erhalten und wieder bearbeitbar; stale Sourceentwürfe bleiben sichtbar, scheitern weiterhin beim Übernehmen und können ausschließlich ausdrücklich verworfen werden. Abgelöste mutierende Aktionen bleiben geschlossen. Die unabhängige [Refresh-Nachprüfung](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/71#issuecomment-6102236072) ist auf `4726d28` PASS; native Speicher-/Hostgrenzen bleiben offen.

## Atomare Szenenanlage mit Dirty Draft

Eine eigene Fehlerprobe fand eine Teilwirkung bei `addScene`: Der alte Draft wurde übernommen, bevor Kennung/Allocator/zweite Revision der neuen Szene geprüft waren. Die Aktion bereitet nun den überarbeiteten alten Szenenpayload und die neue Szene gemeinsam vor, prüft Codec, globale Identitäten und aktuelle Context-/Workspacebindung und veröffentlicht erst dann den vollständigen Plan. Allocatorfehler, Kennungskollision und Revisionsüberlauf erhalten bestätigten Payload, ursprüngliches Draftobjekt und Auswahl. Die drei direkten Fehlerproben scheiterten vor der Korrektur; dieser neue Kern-Diff erhält eine separate enge unabhängige Nachprüfung im bestehenden PR. Erfolgreiche Anlage bewahrt die bisherige zweifache Revisionserhöhung bei Draftübernahme.

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

MANUAL-PLANNER-CORE-R01 auf PR #71/80455ee fand einen fremden Draftverlust beim alten Szenen-Löschhandler und eine offene Szenenarray-Grenze. Die Reparatur bindet Buttons, Planpicker und Inspectoreingaben gemeinsam an den tatsächlich angezeigten Workspace. Regressionen führen erhaltene DOM-Callbacks nach externem Planwechsel mit Dirty-B-Draft aus; auch externe Szenenauswahl innerhalb derselben Planrevision muss ohne Wirkung scheitern. Codec-Regressionsfälle weisen Löcher, zusätzliche String-/Symbolfelder und Indexgetter vor Hydrierung zurück; Getter werden nicht aufgerufen. Independent Delta-Recheck bleibt vor Übernahme erforderlich. Dauerhafte Speicherung und Produktaktivierung bleiben offene Eingänge desselben Pakets.

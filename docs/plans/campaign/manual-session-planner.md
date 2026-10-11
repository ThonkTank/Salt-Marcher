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

Eine eigene Fehlerprobe fand eine Teilwirkung bei `addScene`: Der alte Draft wurde übernommen, bevor Kennung/Allocator/zweite Revision der neuen Szene geprüft waren. Die Aktion bereitet nun den überarbeiteten alten Szenenpayload und die neue Szene gemeinsam vor, prüft Codec, globale Identitäten und aktuelle Context-/Workspacebindung und veröffentlicht erst dann den vollständigen Plan. Allocatorfehler, Kennungskollision und Revisionsüberlauf erhalten bestätigten Payload, ursprüngliches Draftobjekt und Auswahl. Die drei direkten Fehlerproben scheiterten vor der Korrektur; die unabhängige Atomic-Add-Nachprüfung5480881955 auf ca25844 ist PASS. Erfolgreiche Anlage bewahrt die bisherige zweifache Revisionserhöhung bei Draftübernahme.

## Startbarer flüchtiger GUI-Frühtest

`node tools/manual-planner-preview/build.mjs` erzeugt `.build/manual-planner-preview/index.html` und ein geschlossenes Browserbundle des tatsächlichen `ManualPlannerPanel`/`ManualPlanner`. Die HTML-Datei direkt im Browser öffnen; alternativ das Ausgabeverzeichnis über einen ausschließlich lokalen HTTP-Server anbieten. Keine externe Ressource, Obsidianinstallation oder Nutzervault nötig. Der Einstieg beginnt mit einem unbenannten leeren Plan; GM kann Szenen, exakte Notizen, Reihenfolge und mehrere Pläne frei ausprobieren, auch Tastatur/200 % Zoom. Kein vorgeschriebener Klickpfad.

Die sichtbare Memory-only-Kennzeichnung nennt ausdrücklich den Verlust sämtlicher Pläne beim Neuladen/Schließen. Kein localStorage/IndexedDB, Dateidownload oder vermeintliches Save/Fresh-Reopen; das echte Panel wird ohne Campaign-/Locationport eingebunden. Der leere Contextguard und deterministische lokale Test-IDs gelten ausschließlich für diesen synthetischen Host. Das Browserbundle wird außerhalb des Produktbuilds erzeugt und aktiviert keinen Pluginview. Content-Security-Policy verhindert Netzwerkverbindungen.

Eigene technische Smokeprobe führt das erzeugte Browserbundle im DOM aus: Blankstart, Szenenanlage, exakte Unicode-/Whitespace-Notizen übernehmen, zweiter Plan und sichtbare Flüchtigkeitsgrenze bestanden. Typ-/Strukturprüfung PASS. Der unabhängige Previewhostreview5480996581 ist auf a8ffbfd PASS. Der Cloud-GM-Browserlauf6102831310 bestätigt Auffindbarkeit, Notizen, Umordnen und Planwechsel, fand aber einen konkreten Fokusverlust bei Szenenauswahl; 200%-Zoom wurde nicht wirksam erzeugt. Nächster Empfänger ist derselbe GM für den gezielten Fokus-Retest; native Speicherung/Recovery bleibt vom konkret angefragten Campaign/Data-Port abhängig.

## GM-Fokusbefund und Reparatur

[Cloud-GM-Befund6102831310](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/69#issuecomment-6102831310): erfolgreicher Klick/Enter auf den Szeneneintrag ersetzt den Button beim Render und setzt den Fokus auf BODY zurück. Nächster Tab springt in die Toolbar; neun weitere Schritte bis zum Titelfeld. Nach erfolgreicher Auswahl fokussiert das Panel jetzt ausdrücklich das neu gerenderte Szenentitelfeld. Danach folgt im DOM direkt Notizen. Die gleiche Auswahlcallback wird von Klick und nativer Enteraktivierung verwendet.

Fokus wird erst nach bestehender Displayguard-/Modellprüfung und erfolgreichem Render übertragen. Veraltete/fehlgeschlagene Auswahl erhält Payload, Draft, Inspector und Fokus ohne Umlenkung. Zwei neue gezielte DOM-Gegenproben: erfolgreicher Fokus vor Fix FAIL, stale-No-Focus bereits PASS; nach Fix beide PASS, gesamte Panelregression11/11 PASS. Dies prüft die Fokusübergabe, keine echte Browser-Tabsequenz. Enger unabhängiger Panel-Deltareview5481049475 und sichtbarer GM-Retest6102960484 sind auf59f04fe PASS; bestehende Codec-/Atomic-/Previewreviews bleiben qualifizierte Eingänge. Native Persistenz/Recovery und Zoom-/physische Abnahmen bleiben offen.

## Atomare Umbenennung und Umordnung

Die konkrete Fehlerprobe am tatsächlichen Panel startet einen Plan auf Revision MAX_SAFE_INTEGER−1 mit Dirty Draft. Umbenennen und Verschieben übernahmen bislang dessen Prosa, danach scheiterte die zweite Revision: zwei Gegenproben vor Fix FAIL, bestätigter Payload verändert und Draft gelöscht. Der gemeinsame Modellpfad `actWithDraft` bereitet Edit und Rename/Move jetzt ohne Veröffentlichung vor und prüft abschließend Context, Planrevision, Auswahl, Draftidentität und gesamten Workspace. Erst danach wird der vollständige Zustand übernommen. Dieselbe reine Payloadfunktion dient weiterhin Einzelaktionen; vorhandene Revisionsschritte und Move-No-op-Verhalten bleiben erhalten.

Zwei echte Panel-Fehlerregressionen bewahren den gleichen bestätigten Payload und das ursprüngliche Draftobjekt. Zwei Modellgegenproben prüfen fehlendes Moveziel und finalen Contextwiderruf sowie erfolgreichen Retry mit exakter Prosa, Reihenfolge, Namen und Revisionen. 24 fokussierte Core-/Panel-Fälle PASS. Das neue Atomizitätsdelta benötigt den bestehenden unabhängigen Reviewer; Fokus-/Browserbelege auf59f04fe werden nicht wiederholt oder als Beleg des neuen Deltas ausgegeben. Native Speicherautorität bleibt offen.

## Sichtbare Hilfe und Plannamen-Refresh

Das bestehende Memory-only-Panel enthält jetzt eine aufklappbare Hilfe für
Arbeitsbeginn, Entwurfsübernahme/-verwerfen, Plan-/Szenenwechsel,
Fehlererholung und Tastaturbedienung. Der begrenzte Cloud-GM-Lauf
[6103955574](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/69#issuecomment-6103955574)
bestätigt Auffindbarkeit und den sichtbaren Ablauf im synthetischen Browser;
200 Prozent waren dabei simulierter Dokumentzoom, kein nativer Zoomnachweis.

`Ansicht aktualisieren` erhält einen noch nicht übernommenen Plannamen nur,
wenn weiterhin exakt dieselbe immutable Planbasis angezeigt wird. Der Refresh
publiziert nichts; `Umbenennen` bleibt der einzige Aktionspfad. Externer
Planwechsel oder eine neue Revision übernimmt den alten DOM-Wert nicht. Der
unabhängige Deltareview
[MANUAL-PLANNER-REFRESH-NAME-R03](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/86#pullrequestreview-5482290972)
bestand auf `ec9d7a4` mit 16 Panelregressionen.

Dieser integrierbare UI-Anteil enthält ausdrücklich keinen vorgeschlagenen
Planner-Dokumentcodec und keine neue Speicherautorität. Campaign/Data-Dateiplan,
Writer, Publish, Receipt, Recovery, Pluginmount sowie echtes Save/Fresh-Reopen
bleiben offene Eingänge von #69.

# Manuelle Sessionplanung ohne Party und Generator

Timelineersatz und unabhängige Kopie: [Datenregeln und nächste Abnahmen](timeline-portability.md).

Bindende Generierungsvorgaben: [Iststand, Quellenprüfung und nächste Schritte](generation-constraints.md).

Aktueller Datenanschluss und konkrete Folgelieferung: [Kampfentwürfe und narrative Belohnungen](../runtime/combat-and-narrative-recovery.md).

Ziel: Einen Plan mit Szenen, exakten Notizen und optionalen Ortsverweisen bearbeiten, dauerhaft speichern und nach Neustart fortsetzen. Quelle: [#69](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/69), SRC-P01/P03 und AC-F03/AC-P01/P02 im [Quellenregister](../../scope-sources.json). Der Generator und der spätere Transfer ins Live-Spiel bleiben eigene Funktionen.

## Vorhandene Funktion

`ManualPlanner` und `ManualPlannerPanel` bieten Plananlage/-wechsel/-umbenennung/-löschung, Szenenanlage/-auswahl/-bearbeitung/-umordnung/-löschung sowie Entwurf übernehmen/verwerfen. Unbenannte Pläne und ortlose Szenen sind gültig; gleiche Orte erzeugen keine gemeinsamen Szenenidentitäten. Native Controls, flexible Toolbar und relative Textareaweite tragen Tastatur und skalierbares Layout; tatsächliche Tastatur-/200%-Hostabnahme fehlt.

## Daten- und Bedienvertrag

- Immutable Plan-/Szenenpayloads, stabile kampagnenlokale UUIDs und monotone Planrevisionen. Aktuelle Planlöschung erzeugt atomar einen leeren Ersatzplan; nicht aktuelle Aktionen verändern Auswahl und Draft nicht.
- Jede Aktion bindet angezeigte Plan-ID, Revision, Szene, Draftidentität und Renderzyklus an den aktuellen Campaigncontext. Auch erhaltene Callbacks nach externem Plan-/Szenenwechsel dürfen fremde Texte oder Auswahl nicht verändern.
- Szenendrafts behalten die ursprüngliche Planrevision. Wechsel übernimmt nur bei gültiger Source; Fehler erhält Text, Auswahl und dasselbe Draftobjekt. Eingabe rendert den Inspector nicht neu.
- Anlage mit Dirty Draft, Rename und Move bereiten Draftübernahme und Folgeaktion gemeinsam vor. Codec, globale Kennungen, Allocator, Revisionsgrenze, Context und Workspacebasis werden vor einer Veröffentlichung geprüft. Erfolgreiche Draftübernahme erhält die bestehenden Revisionsschritte; Move-No-op bleibt unverändert.
- Plan-/Ersatzanlage prüft Context, Katalog, Auswahl und Draft nach dem Hostcallback zur ID-Vergabe erneut. Widerruf bewirkt nichts; zwischenzeitliche gültige Änderungen bleiben erhalten.
- Der Codec lehnt löchrige Arrays, Zusatzfelder einschließlich Symbolen und Indexgetter vor Hydrierung ab, ohne Getter aufzurufen.
- „Ansicht aktualisieren“ zeigt den aktuellen Workspace ohne Commit, Discard oder Auswahländerung. Dirty Zielentwürfe bleiben bearbeitbar; stale Entwürfe scheitern weiter beim Übernehmen und lassen sich ausdrücklich verwerfen.
- Ein unbestätigter Planname bleibt bei Szenenaktionen erhalten, solange derselbe Plan aktiv ist; nur „Umbenennen“ übernimmt ihn. Refresh erhält ihn ausschließlich auf identischer immutable Planbasis. Neue Pläne/externe Revisionen übernehmen keinen alten Feldwert.
- Erfolgreiche Szenenauswahl per Klick/Enter fokussiert nach Guardprüfung und Render das Titelfeld, danach die Notizen. Fehlgeschlagene/stale Auswahl lenkt den Fokus nicht um. Aufklappbare Hilfe erklärt Arbeitsbeginn, Draft, Wechsel, Fehlererholung und Tastatur.

## Fehlender Produktanschluss

Die Oberfläche ist Memory-only: kein aktivierter Pluginview, kein bestätigtes natives Speicherformat und kein dauerhafter Plan. Die in-memory Workspace-Klasse ist keine Campaignpersistenz.

Der Zielanschluss speichert Plan-/Besuchsrecords und optionale Ortsreferenzen im gemeinsamen SQLite-Store. Aktueller Context, Planrevision und vollständige Änderung werden in einem Command an der Commitgrenze geprüft. Die bestehenden Memory-Klassen/#41-Dateipläne sind Übernahmekandidaten, keine vorgegebene API; geeignete reine Codecs/Controls nach Prüfung verwenden. Dauerhafte Receipts, Undo und Recovery folgen [ARCHITECTURE](../../../ARCHITECTURE.md#bearbeitung-und-history). Der `PreparationSnapshot` aus #60 bleibt der einzige spätere Runtime-Transfer; manuelle Planung benötigt ihn nicht.

Abschluss: Save → normal schließen → frischer Prozess erhält IDs, Prosa und Reihenfolge. Schreibfehler, Contextwiderruf, Konflikte und Recovery erhalten offene Arbeit. Ortlose Planung funktioniert ohne Locationport; positive Ortsprojektion braucht eine bestätigte Quelle. Generator, Partybudget, Encounter/Rewards und vollständige Originalparität bleiben offen.

## Ausprobieren und Nachweise

`node tools/manual-planner-preview/build.mjs` erzeugt `.build/manual-planner-preview/index.html`; direkt im Browser oder über einen lokalen HTTP-Server öffnen. Das Bundle benutzt das tatsächliche Panel ohne Campaign-/Locationport, einen synthetischen Contextguard und deterministische Test-IDs. Es startet leer und ist ausdrücklich flüchtig: Reload/Schließen verliert alle Pläne; keine Datei, localStorage oder IndexedDB. Keine externen Ressourcen; CSP sperrt Netzwerkverbindungen. Es gehört nicht zum Produktbuild.

Kern-/DOM-Regressionen und begrenzte Browserbefunde stehen in `acceptance.json`: Codec-/Callbackguards, atomare Draftaktionen, Fokus, Plannamenerhalt und Contextschutz. Die dort gebundenen Ergebnisse behalten ihren jeweiligen Commit und Umfang. Browserprobe, synthetischer Dokumentzoom und DOM-Fokus belegen weder native Speicherung/Recovery noch physischen Input oder tatsächlichen 200%-Hostzoom.

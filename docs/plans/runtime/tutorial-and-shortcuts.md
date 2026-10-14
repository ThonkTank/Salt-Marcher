# Tutorials und Tastaturkontext

Stand: 14.10.2026. Ergänzt [Gesamtumfang](../../SCOPE.md) und
[Lieferfolge](../../ROADMAP.md). Eine vorhandene Hilfeliste oder ein grüner
DOMtest schließt die vollständige Bedien-/Locale-/Plattformqualifikation nicht.

## Quellvertrag und aktueller Anschluss

Program Capabilities L775–789 und L813–819, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, verlangen Tastaturbedienung,
skalierbare Oberfläche, Lokalisierbarkeit und Tutorials für jede angebotene
Fähigkeit. Erstinstallation/Update beginnen Tutorials automatisch; Überspringen
bleibt möglich. Autorenwortlaut ist unabhängig von der UI-Sprache.
Quellenhash: `714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e`.

`storage/store.ts.tutorial` hält lokale Runs je tatsächlicher Appversion.
`checkedTutorialRun` prüft die vorhandenen Werte ohne korrupte Originals zu
überschreiben; frühere Runs bleiben erhalten. Finished/Skipped sind terminal,
auch bei verspätetem Shown. `tutorial.ts.initTutorial` bindet Hilfe und Dismiss
vor der Statusquery, öffnet den Modal, fokussiert die Überschrift und gibt Fokus
an den Opener zurück. Ein verzögerter oder fehlgeschlagener Statuswrite hält
Dismiss nicht auf. Die Rendererinitialisierung wartet nicht auf Tutorialreads.
Die integrierte Tutorialabdeckung beginnt bei einer veränderten Lessonrevision
nun einen neuen optionalen Lauf auch innerhalb derselben Appversion. Davor wird
der ursprüngliche Record unter seiner Run-ID unverändert archiviert; frühere
Finished-/Skipped-Entscheidungen bleiben am alten Lauf erhalten. Die neue
Lektion setzt keinen alten Lauf zurück. Hilfe liest die aktuellen Lektionen.
Die Abdeckungszuordnung und noch fehlende native Qualifikation stehen im
[SMR-11-Fachplan](../quality/smr11-tutorial-coverage.md).

## Geschlossene Tastatur- und Inhaltslücken

Der frühere documentweite Strg/Meta+Z-Handler prüfte nur sichtbaren Atlas und
Input/Textarea. Ein geöffnetes Tutorial oder ein anderer Modaldialog lag über
dem Atlas; sein Keyevent änderte trotzdem dessen Autorenverlauf. Selects und
Richtextkontexte besaßen ebenfalls keinen Schutz. Alt+P öffnete die Party aus
dem Tutorial heraus. Native Inertness ersetzt diese Eventprüfung nicht:
Tastaturereignisse des Dialogs erreichen weiter den Documentlistener.

`workspace-shortcuts.ts.bindAtlasHistoryShortcut` ist jetzt der tatsächliche
Atlaslistener. Er benötigt aktiven Atlas, unbeanspruchtes Strg/Meta+Z und eine
beendete Komposition. Offene Dialoge und Popover lassen keinen Atlasundo zu;
Input, Textarea, Select, editierbare Bereiche und Textboxrollen behalten den
nativen/örtlichen Undo. Erst eine passende Workspacegeste verhindert das
Defaultverhalten und ruft Undo/Redo auf. Der Listener besitzt einen gebundenen
Documentowner für sauberes Entfernen. Es gibt keine parallele History oder
allgemeine Shortcutregistrierungsplattform.

Alt+P verwendet denselben Dialog-/Default-/Kompositionsschutz im echten
Partyinitializer. Im Party-/Rechnerpopover darf es die Party weiterhin öffnen
oder schließen; dabei entsteht kein Atlasundo und kein Autorenwrite.

Die Partyawardlektion behauptete trotz korrigiertem Writer noch Levelfloor und
reduzierte Rastzähler. Sie erklärt nun Abzüge bis null, abgeleitete niedrigere
Level und erhaltenen bestätigten Rastverbrauch/Abschnitte. Eine neue Lektion
macht die vorhandene Erweiterungsinstallation samt ausdrücklicher Rechteannahme,
Widerruf, schreibfreier Outcomeprüfung und gesicherter Wiederaufnahme-Reparatur
auffindbar. Sie benennt den noch fehlenden zusätzlichen Inhaltseditor. Die
Journallektion ergänzt den Zugang zu Quests/Gerüchten mit demselben bestehenden
Status-/Belohnungseditor; sie führt keinen weiteren Rewardwriter ein. Die
Lessonrevision ist `desktop-tutorial-dungeon-binder-scene-visits-atlas-coverage-treasure-distribution-session-recap-player-cues-live-generation-character-progression-session-copy-live-soundboard-follow-ups-capability-coverage-quick-reference-narrative-journal-session-review-live-packet-workspace-shortcuts-v50`.

## Aussagekräftige lokale Belege

Elf Fälle in `tests/desktop-workspace-shortcuts.test.mjs` benutzen den realen
registrierten Historylistener, tatsächliche Party-/Tutorialinitialisierung und
das produktive HTML in einem kontrollierten DOM. Sie prüfen Modal-/Popover-
Kontext, Hilfe/Skip, normale Undo/Redo-Gesten, bereits beanspruchte Events,
Komposition, Select/Input/Textarea und verschachtelte Editor-/Textboxkontexte,
Alt+P-Öffnen/Schließen sowie korrigierte XP- und auffindbare Installationshilfe.
Die kontrollierte Modal-/Popovernachbildung beweist keinen nativen Fokus,
Screenreader, tatsächlichen Eingabeundo oder Pixelkontrast.

Die vorhandenen fünf Tutorial-DOMproben ergänzen verspätete/fehlgeschlagene
Statuswrites und Fokusübergabe. Zwei gezielte Storefälle prüfen echte
Release-/Restart-/Downgrade-Runs, Terminalstatus und erhaltene korrupte Preferences
bei weiter benutzbarer Campaign. Diese Prüfungen sind getrennt von nativer
Bedienung, Paketinstallation und vollständiger Feature-Tutorialabdeckung.

## Nächste ausführbare Abschlüsse

1. **Native Tastaturgrenze abnehmen.** `renderer.ts`, Party und Tutorial am
   tatsächlichen Host: bestehenden Roomedit bestätigen, Hilfe/anderen Modal
   öffnen, Strg/Meta+Z und Alt+P drücken, Original/History unverändert vergleichen.
   Nach Dismiss normale Workspace-Undo/Redo prüfen. Party/Daypopover, Select und
   echte Richtext-/IMEeingabe mit lokalem Undo gesondert bedienen. Tastaturfokus
   bleibt im Modal, Escape gibt ihn zurück; Controls sind bei 200 % erreichbar.
2. **Featureabdeckung statt Lektionenzahl.** `lessons` gegen sichtbare aktuelle
   HTMLaktionen und SCOPE verbinden: Anlegen, Datenwirkung, Fehleraufklärung und
   Wiederaufnahme je tatsächlich angebotenem Nutzerweg. Sessionmappe,
   NPC-Porträtsuche, neue Ortsfreigaben, Quellenstatus und noch nicht verfügbare
   Extensionausführung müssen verständlich getrennt bleiben. Veraltete
   Quelloptionen/Buttons entfernen, nicht nur weitere Texte anhängen.
3. **Lokalisierung konkret beginnen.** Zuerst Tutorial und gemeinsame Status-/
   Actionlabels in einen kleinen UI-Textkatalog führen; vollständige deutsche
   Basis und mindestens eine zusätzliche Sprache in genau diesem Ablauf prüfen.
   Textexpansion, Datums-/Zahlformat, Tastaturhinweise und Sprachwechsel bei
   Pending berücksichtigen. Keine Übersetzung/Normalisierung von Campaignprosa,
   IDs, Markdownlinks, Paketbytes oder bestätigter History.
4. **Release-/Ausfallfolge am Produkt schließen.** Echte Versionsänderung,
   alter terminaler Run, korrupter Record, hängender initialer Read und Hilfe vor
   Readantwort am nativen Prozess prüfen. Skip/Help bleiben nutzbar; fehlender
   Status ist kein bestätigter gespeicherter Abschluss. Linux/Windows/macOS,
   Screenreader, Laptop-/200 %-Layout, Kontrast und Nicht-Farbsignale brauchen
   die eigenen betroffenen Feature-/Gesamtabnahmen.

# GM-UX-N-003: Raum-Key ohne doppelte Editoransicht öffnen

Planlauf `GM-UX-N-003-P01` vom 09.10.2026 zum veröffentlichten
[Cloud-GM-Befund](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1#issuecomment-6084205940).
In zwei isolierten Testkarten blieb nach **Raum-Key öffnen** der eingebettete
Key-Editor sichtbar, während derselbe Hinweis zusätzlich in der Obsidian-
Raumansicht erschien. Dadurch wurde der sichtbare Kartenkontext stark geteilt.
Nutzungshäufigkeit und Produktlatenz wurden nicht gemessen; die beobachtete
doppelte Darstellung und der Flächenverlust sind der enge P2-Folgebefund.

Der Dungeon-Strang hat ausschließlich diesen Planlauf auf Shared-Base
`71099f277c8de58f4d0a60dc62d56bbd9c8bc483` übernommen. Vor dem Claim gab es
keine offene PR, keinen gleichnamigen Remote-Branch und keinen anderen
sichtbaren Besitzer. Claim und Abgrenzung stehen in Issue #8 Kommentar
`6088872377`. Dieser Plan ändert keinen Produktcode und erteilt keine
Implementierungs-, Host-, UX- oder Fachfreigabe.

## Bestehender Vertrag und Ursache

- `DungeonEditor` hält Auswahl, Kamera und den rechten Key-Dock. Für einen
  strukturierten Raum erzeugt `refreshSelectedNote()` genau einen
  `StructuredKeyPanel`; dessen `allowNavigation()` schützt einen nicht
  übernommenen Markdown-Entwurf.
- **Raum-Key öffnen** ruft derzeit den vorhandenen Hostport
  `openRoomKey(roomId, sectionId, anchor)` auf, ohne den sauberen eingebetteten
  Key-Dock zu schließen. `DungeonPlugin.openRoomKey()` verwendet danach den
  bestehenden `ROOM_VIEW`-Workspaceweg und stellt das zugehörige Dokument in
  einer Obsidian-Ansicht dar. Die beiden Ansichten desselben Inhalts sind daher
  gleichzeitig sichtbar.
- Auswahl, Kamera, Karte, History und Dokument müssen für die Reparatur nicht
  verändert werden. Der vorhandene Hostport, Workspace-Leaf-Weg und
  `StructuredKeyPanel` bleiben die einzigen Zuständigkeiten; es entsteht keine
  zweite Key-, Kamera-, History- oder Persistenzschicht.

## Enger Reparaturvertrag

Die Aktion **Raum-Key öffnen** prüft vor jeder Layoutänderung den bestehenden
`allowKeyNavigation()`-Guard. Bei einem dirty strukturierten Entwurf bleibt der
Dock offen, der Entwurf fokussiert und es wird weder eine Raumansicht geöffnet
noch Auswahl, Kamera, Dokument oder History verändert.

Bei einem sauberen strukturierten Key wird zuerst das vollständige Ziel
`roomId`, optional `sectionId` und `anchor` aus der aktuellen Auswahl ermittelt.
Anschließend weicht ausschließlich der vorhandene Key-Dock über
`toggleKey(false)`; danach öffnet der unveränderte `openRoomKey`-Hostport die
bestehende Raumansicht. Auswahl und Rendererfokus bleiben erhalten, sodass die
Karte mit dem gewählten Raum sichtbar bleibt. Der normale Werkzeugknopf
**Key bearbeiten** öffnet denselben Dock mit einem Klick wieder.

Der allgemeine **Notiz öffnen**-Pfad für unstrukturierte Notizen wird nicht
verändert: N-003 belegt nur die doppelte strukturierte Raum-Key-Darstellung.
Auch `DungeonPlugin.openRoomKey()`, `DungeonRoomView`, Save/Reload und das
Dateiformat bleiben unverändert.

## Abnahme- und Unveränderlichkeitsorakel

Fokussierte automatisierte Regressionen belegen:

1. sauberer strukturierter Key: Ziel mit Raum, Abschnitt und Anker wird einmal
   an `openRoomKey` übergeben; vorher wird der Key-Dock über den bestehenden Weg
   geschlossen;
2. dirty strukturierter Entwurf: Guard meldet/blockiert vor Dock- oder
   Workspaceänderung, kein Open-Aufruf;
3. ausgewählte Raumkennung, Rendererfokus/Kamera, kanonisches Dokument,
   `session.dirty`, Historygröße und Undo/Redo bleiben in beiden Fällen exakt
   unverändert;
4. der vorhandene **Key bearbeiten**-Weg bleibt erreichbar und öffnet den Dock
   ohne zusätzlichen Workspacepfad.

Der bereits veröffentlichte sichtbare Reparaturablauf bleibt bindend und wird
nicht explorativ erweitert: isolierte Karte öffnen, Raum wählen, gespeicherten
Key im eingebetteten Editor anzeigen, **Raum-Key öffnen** aktivieren; danach ist
der Hinweis einmal in der aktiven Raumansicht sichtbar, die Karte mit gewähltem
Raum bleibt brauchbar, und **Key bearbeiten** ist mit einem Klick erreichbar.
Speichern, App-Reload und erneutes Öffnen erhalten den Text byte-/wortgleich.
Vorher-/Nachherbilder verwenden dasselbe 1440×1000-Splitlayout.

## Pakete und Gates

| Lauf | Umfang | Gate |
| --- | --- | --- |
| `GM-UX-N-003-P01` | Dieser technische Plan | JSON-, Verweis- und Diffprüfung sowie unabhängiger read-only Review des exakten Plancommits. |
| `GM-UX-N-003-I01` | Enger strukturierter Open-Ablauf in `src/editor.ts` und fokussierte Regression | Guard vor Layoutmutation, vorhandener Dock-/Hostweg, vollständiges Ziel, Nichtmutation; `npm run check`, fokussierte Tests, `npm test`, `npm run build`. |
| `GM-UX-N-003-R01` | Unabhängiger read-only Produktreview des exakten I01-Commits | Dirty-/Clean-Reihenfolge, Auswahl/Kamera/History/Persistenz, unstrukturierter Notizpfad und N-005/N-006-Nichtregression. Pflichtbefunde werden separat repariert und erneut reviewt. |
| `GM-UX-N-003-H01` | Exakt veröffentlichter Cloud-GM-Reparaturablauf im isolierten Testvault | Sichtbar eine Key-Darstellung, brauchbare Karte/gewählter Raum, ein Klick zurück zu **Key bearbeiten**, textidentisches Save/Reload/Reopen, Vorher-/Nachherhash. |
| `GM-UX-N-003-GM-R01` | Unabhängiger Produkttester-Nachtest | Nur der ursprüngliche Ablauf; erst dieser Nachtest darf die Folgeaufgabe schließen. |

Planung, Implementierung, Review, Hostlauf und Produkttester-Nachtest bleiben
getrennte Arbeitsläufe. N-006-H01/GM-R01 bleibt beim Cloud-GM-Produkttester auf
seinem bereits installierten exakten Build. N-005, DD-036, Hex/Atlas, Stadt,
Katalog, Migration und SMR bleiben fremder Scope. Nutzerkarten, Texte, stabile
Kennungen und fremde Checkpoint-Wurzeln werden nicht verändert.

## Offene Grenzen dieses Plans

P01 weist keine Produktwirkung nach. Insbesondere bleiben echter Obsidian-
Workspace, sichtbares 1440×1000-Layout, Save/App-Reload/Reopen, physische
Eingabe, Nutzungshäufigkeit, Produktlatenz und UX-/Host-/Fach-/Paritäts-/
Gesamtfreigabe offen. Ein unabhängiger Planreview muss vor I01 bestätigen, dass
der vorgeschlagene Ablauf den vorhandenen Dirty-Guard und Workspaceweg nutzt
und keinen zweiten Keyzustand einführt.

## Implementierungs- und Reviewstand

Der exakte P01-Plancommit
`552846303189924208c20d95df01a75cedb03966` bestand den unabhängigen
read-only Planreview ohne Pflichtbefund. I01 führte anschließend den
strukturierten Open-Ablauf in `src/editor.ts` zusammen. Der erste Produktreview
des Commits `271ed2a09691da6c724de1a650533be27c66a258` fand keinen Produktdefekt,
verlangte aber eine echte Bindung der Regression an Session, Key-Panel und
Zielableitung statt loser, tautologischer Zustandswerte.

Der Reparaturcommit `4f8c7fe5842605e6093c21e4effc075712554e36`
extrahiert die vom Button verwendete Zielableitung. Der fokussierte Test nutzt
eine reale V4-Session und einen realen `StructuredKeyPanel`, blockiert einen
dirty Textarea-Entwurf vor Dock/Open, prüft ein vollständiges `keyTarget` mit
Raum/Abschnitt/Anker sowie eine echte Feature-Occurrence und misst Dokument,
Dirty, History, Undo/Redo, Auswahl und Kamerawert vor und nach dem Ablauf. Der
bestehende `toggleKey(true)`-Weg öffnet **Key bearbeiten** wieder.

Der unabhängige R02 bestand exakt diesen Reparaturcommit ohne verbleibende
Pflichtlücke. Fokussiert bestanden 11/11 Fälle; `npm run check`, `npm test`
(398/398) und `npm run build` bestanden. Der gebaute Produktstand trägt
`main.js` SHA-256
`eea21a270e6b5830feeffc32c40abadac8e6b5d307cce06b75718091ddf3e7c3`.
Damit ist nur H01 geöffnet: Der Cloud-GM-Produkttester wiederholt den bereits
veröffentlichten sichtbaren Reparaturablauf im isolierten Testvault. Danach
bleibt GM-R01. Kein echter Hostlauf, keine physische Eingabe und keine UX-,
Host-, Fach-, Paritäts- oder Gesamtfreigabe sind aus I01/R02 abgeleitet.

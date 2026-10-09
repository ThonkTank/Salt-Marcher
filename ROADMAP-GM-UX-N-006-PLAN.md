# GM-UX-N-006: aktives Geschoss beim Wiederöffnen fortsetzen

Planlauf `GM-UX-N-006-P01` vom 09.10.2026 zum
[GM-Produkttest](ROADMAP-GM-PRODUCT-TESTING-PLAN.md) und zum
[Testerbefund](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1#issuecomment-6085700084).
In einer isolierten Kopie von „GM-UX-01 Nebelwacht“ blieben das dritte Geschoss
„Geheimgang“, Räume 13–15, Türen, Raum-Key und Gang nach Speichern, Schließen und
Wiederöffnen erhalten. Die Ansicht begann jedoch in zwei Durchläufen wieder im
Erdgeschoss. Es ist kein Datenverlust und keine Produktlatenz belegt.

Der Dungeon-Strang hat ausschließlich diesen Planlauf auf Shared-Head
`2a055f10800c63678ca9fe991b0dd31a02483744` übernommen. Vor der Fortsetzung gab
es keine offene PR, keinen gleichnamigen Remote-Branch und keinen anderen
sichtbaren N-006-Besitzer. Dieser Plan ändert noch keinen Produktcode und erteilt
keine Implementierungs-, Host- oder Fachfreigabe.

## Vertragsbefund und Entscheidung

- `MapRenderer.floorId` ist bereits der eine flüchtige aktive
  Geschosszustand. `setFloor` wechselt nur Renderer, Auswahl und Kamera; das
  Kartendokument und die History werden dadurch nicht verändert.
- `DungeonView` ist eine Obsidian-`FileView`, übernimmt derzeit aber keinen
  eigenen View-State. `onLoadFile` baut einen neuen `DungeonEditor`; dessen
  `MapRenderer` wählt immer das erste Geschoss der Session. Der beobachtete
  Erdgeschoss-Reset folgt direkt daraus.
- `DungeonPlayView`, `DungeonRoomView` und der Katalog verwenden bereits
  `getState`/`setState` für flüchtigen Obsidian-Ansichtszustand. Für den Reset
  des Dungeon-Editors gibt es dagegen weder eine dokumentierte Fachregel noch
  einen Originalbeleg. Ein absichtlicher Erdgeschoss-Start ist daher nicht
  begründbar.
- Entscheidung: Der Dungeon-Editor stellt das letzte gültige aktive Geschoss
  derselben Karte automatisch wieder her. Das ist Workspace-/View-State, kein
  Karteninhalt. Eine zusätzliche „Wiederaufnehmen“-Oberfläche wird nicht gebaut,
  weil sie den vorhandenen Geschosswähler duplizieren und einen unbelegten Reset
  festschreiben würde.

## Ein gemeinsamer Workspace-State-Weg

Ein kleiner hostneutraler Zustandsbaustein unter
`src/features/verwaltung/dungeon-view-state.ts` validiert genau
`{ schemaVersion: 1, path, activeFloorId }`. Er kennt keine Session, Kamera,
Auswahl, Dirty-Markierung oder Persistenz. Leere, typfremde, überlange oder zu
einem anderen Pfad gehörende Werte werden verworfen.

`DungeonView.getState()` erweitert den bestehenden `FileView`-State, statt den
Dateipfad zu ersetzen. `setState()` liest den validierten Geschosswunsch vor
dem Aufruf des Basistyps ein und wendet ihn erst nach erfolgreichem
`onLoadFile`/Editoraufbau an. So bleibt Obsidian für Datei-, Leaf- und
Layoutwiederherstellung zuständig. Ein ungültiger oder inzwischen gelöschter
Geschosswert fällt deterministisch auf das erste vorhandene Geschoss zurück.

Das Schließen eines Tabs entfernt dessen Leaf-State. Für genau diesen im
Testerbefund beschriebenen Schließen-/Wiederöffnen-Ablauf hält der Plugin-
Lebenszyklus deshalb denselben validierten Zustand zusätzlich in einem
flüchtigen, pfadgebundenen Workspace-Register. Das Register ist nur der
Handoff-Kanal desselben `DungeonViewState`-Codecs:

- ein expliziter oder programmatischer Geschosswechsel aktualisiert den
  Leaf-State und das Register erst nach erfolgreichem `setFloor`;
- `onUnloadFile` übernimmt den letzten Rendererwert, bevor der Editor zerstört
  wird;
- ein neues Leaf derselben Datei verwendet den Registerwert nur, wenn kein
  gültiger eigener Leaf-State vorliegt;
- bei mehreren Leaves gewinnt für jedes bestehende Leaf dessen eigener State;
  nur ein neu geöffnetes Leaf übernimmt den zuletzt bestätigten Kartenwert;
- Umbenennen verschiebt den Registerschlüssel, Löschen entfernt ihn, und
  Plugin-Unload leert das Register.

Das Register wird nicht mit `saveData` gespeichert und überlebt keinen frischen
Plugin-/Obsidian-Prozess, wenn kein wiederhergestelltes Leaf den Zustand trägt.
Diese Grenze entspricht dem belegten Tab-Schließen/-Öffnen-Ablauf. Eine
prozessübergreifende Präferenz pro Dateipfad wäre ein neuer Persistenzvertrag
und ist durch N-006 nicht belegt.

## Anschluss an Editor und Renderer

`DungeonEditor` erhält einen schmalen View-State-Port: aktuellen Geschosswert
lesen, einen validierten Startwert nach `renderer.init()` anwenden und spätere
Änderungen melden. Der Port führt alle Wege auf `MapRenderer.setFloor` zurück;
es entsteht weder eine zweite Kamera noch ein zweiter Auswahl- oder
Geschosszustand. Der bestehende Selectwert, Vergleichsebene, Auswahl und Kamera
werden über den heutigen Editorweg synchronisiert.

Die Wiederherstellung erfolgt genau einmal nach erfolgreichem Rendereraufbau
und vor der ersten nutzbaren Ansicht. Sie erzeugt keinen Command, keinen
Historyeintrag, keinen Draft und keinen Save. Der heute erste Geschosswert
bleibt Fallback für neue Karten, fehlenden State, fremde Pfade und gelöschte
Geschosse. Programmatische Geschosswechsel – insbesondere eine spätere
N-005-Trefferaktivierung – müssen denselben Meldeweg benutzen und dürfen den
Workspace-State nicht umgehen.

Offene Key-Entwürfe werden beim Schließen weiterhin ausschließlich durch den
bestehenden `commitNote`-/Draft-Weg behandelt. N-006 verändert dessen Reihenfolge
oder Fehlerverhalten nicht. Die Geschosswiederherstellung darf keinen Key-Text
anwenden, verwerfen oder neu speichern.

## Unveränderlichkeits- und Abnahmeorakel

Vor Geschosswahl und nach jeder Wiederöffnung werden geprüft:

- kanonisch serialisiertes `session.document()` und Dateibytes,
- `session.dirty`, Historygröße sowie Undo-/Redo-Verfügbarkeit,
- alle Geschoss-, Raum-, Tür-, Gang-, Abschnitts- und Fremdkennungen,
- der wortgleiche Raum-14-Key-Hinweis aus dem Testerbefund.

Nur der flüchtige aktive Geschosswert darf sich ändern. Der bindende
Reparaturablauf wird nicht explorativ erweitert:

1. isolierte Nebelwacht-Kopie öffnen und Datei-/Dokumentorakel erfassen,
2. „Geheimgang“ wählen und regulär speichern,
3. Tab schließen und dieselbe Karte über den dokumentierten Öffnungsweg erneut
   öffnen,
4. „Geheimgang“ ist aktiv; Daten-, Dirty- und Historyorakel sind unverändert,
5. Schritte 2–4 ein zweites Mal wiederholen.

Zusätzlich prüfen automatisierte Regressionen Layout-Restore mit gültigem
Leaf-State, Tab-Reopen über das flüchtige Register, falschen Pfad, beschädigten
State, gelöschtes Geschoss, Dateiumbenennung/-löschung, zwei Leaves derselben
Datei und Plugin-Unload. Ein frischer Prozess ohne wiederhergestelltes Leaf fällt
ehrlich auf das erste Geschoss zurück und ist kein N-006-Passkriterium.

## Umsetzungspakete und Gates

| Lauf | Umfang | Gate |
| --- | --- | --- |
| `GM-UX-N-006-I01` | Reiner `DungeonViewState`-Codec und flüchtiges pfadgebundenes Workspace-Register | Unitfälle für gültigen State, Fremdpfad, beschädigte Werte, Rename/Delete, Zwei-Leaf-Präzedenz und Unload; keine Dokument- oder Plugin-Datenpersistenz. |
| `GM-UX-N-006-I02` | `DungeonView`-/`DungeonEditor`-Verdrahtung über den bestehenden `MapRenderer.setFloor`-Weg | DOM-/Lifecycle-Regressionsfälle für Leaf-Restore, zweimaliges Tab-Schließen/-Öffnen, ungültiges/gelöschtes Geschoss und programmatischen Wechsel; Dokument, Dirty, History, Auswahlkennungen und Key-Entwurf bleiben gemäß Orakel unverändert. |
| `GM-UX-N-006-R01` | Unabhängiger Produktreview des exakten Implementierungscommits | Obsidian-Base-State bleibt erhalten; kein zweiter Floor-/Kamera-/History-/Persistenzweg; Lifecycle, Race-Abbruch, Rename/Delete und N-005-Anschluss prüfen. Pflichtlücken vor Hostlauf reparieren. |
| `GM-UX-N-006-H01` | Genau der veröffentlichte zweifache Nebelwacht-Reproduktionsablauf im isolierten Cloud-Obsidian-Host | Sauberer Build/Tripel, sichtbarer Geschosswert, Vorher-/Nachherhash, normaler Tab-Schluss und zwei Neuöffnungen. Synthetische Fernsteuerung bleibt keine physische Eingabeabnahme. |
| `GM-UX-N-006-GM-R01` | Unabhängiger Produkttester-Nachtest | Der Tester wiederholt ausschließlich seinen beschriebenen Ablauf. Erst dieser Nachtest darf die Folgeaufgabe schließen. |

Jedes Implementierungspaket erhält fokussierte Regressionen sowie
`npm run check`, `npm test` und `npm run build`. `acceptance.json` wird im
Planlauf nicht verändert: N-006 ist ein GM-UX-Folgebefund und bestätigt weder
die offene strikte Parität von DD-032 noch einen Originalvergleich. Produktreview,
Hostlauf und Produkttester-Nachtest bleiben getrennte Arbeitspakete.

## Abgrenzung und Folgearbeit

- N-005-I01 bleibt ein eigener, bereits planseitig geöffneter Dungeon-Lauf. Der
  Dungeon-Strang übernimmt ihn unmittelbar nach Veröffentlichung und
  unabhängigem PASS dieses N-006-Plans; N-005- und N-006-Code werden nicht in
  einem Paket vermischt.
- DD-036, Atlaspersistenz, HEX-01-Hostdiagnose, CITY-P04, Migrationen und andere
  Feature-Roadmaps bleiben bei ihren Besitzern. N-006 berührt keine
  `.overworld`-Datei und keinen Atlas-Harness.
- Nutzerkarten, Raumtexte, Fremdkennungen und nicht betroffene
  Checkpoint-Wurzeln bleiben unverändert.

## Prüfung dieses Plans

Der Planstand wird durch JSON-, Verweis-, Marker- und Diffprüfung sowie einen
unabhängigen read-only Review des exakten Commits geprüft. Der Reviewer gleicht
ihn gegen Issue-#1-Kommentar `6085700084`, den aktuellen `FileView`-,
`DungeonView`-, `DungeonEditor`- und `MapRenderer`-Vertrag sowie die
Nichtmutationsgrenze ab. Ein PASS öffnet nur `GM-UX-N-006-I01`; er ist keine
Implementierungs-, UX-, Host-, physische Eingabe- oder Fachfreigabe.

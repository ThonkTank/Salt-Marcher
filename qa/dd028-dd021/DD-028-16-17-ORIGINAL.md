# DD-028.16 und DD-028.17: direkte Originalprobe

Referenz: Dungeondraft **1.2.0.1 Opulent Kirin**, isolierter Prozess mit leerer Modliste auf Xvnc `:12`. Belege liegen außerhalb des Vaults unter `/home/aaron/.cache/dungeon-native-qa/audit-20261004-vollstaendigkeit/objekte/native-dd02816-outside-retry-20261005/`. Die einzelnen Eingaben stehen in `evidence/actions.jsonl`. Der erste Start unter `native-dd02816-outside-20261005/` stürzte vor der Werkzeugbedienung beim Laden eines PNGs in `ImageTextureEx.LoadPNG` ab (Status 134); der zweite und letzte Start lieferte die nachstehenden Beobachtungen.

## DD-028.16: geänderte Scatter-Farbe und Außenklick

Im Scatter Tool wurde der runde RGBA-Wähler geöffnet (`evidence/06-picker-open.png`); Startwert RGB 107/56/52, Hex `6b3834`, A255. Die Hex-Eingabe `4080c0` und ein Klick in das Farbfeld änderten den sichtbaren Wert zunächst auf RGB 64/128/192 (`10-color-live.png`) und danach auf RGB **114/146/178**, Hex **`7292b2`**, A255 (`11-outside-closed.png`). Ein Klick außerhalb des Pickers auf die leere Seitenfläche bei (420,780) schloss ihn; das Werkzeugfeld blieb blaugrau (`14-outside-settled.png`). Beim erneuten Öffnen standen weiterhin RGB 114/146/178, Hex `7292b2`, A255 im Picker (`15-reopen-retained.png`). Die Farbe wurde also **nicht verworfen**. Eine direkt nach einem ersten Außenklick erstellte Aufnahme zeigte den Picker noch offen; nach dem wiederholten Außenklick und kurzer Wartezeit war er geschlossen. Die Aufnahmefolge belegt die Wertregel, nicht die Latenz oder Zuverlässigkeit jedes einzelnen Klicks.

Der enge Zielablauf lautet: Außenklick schließt auch einen **geänderten** Scatter-Picker und behält dessen aktuellen gültigen Farbwert. Die Karte wurde nicht bemalt oder gespeichert; Farbwirkung gestreuter Instanzen, Alpha-Änderung und Frischstart der gewählten Scatter-Vorgabe bleiben offen.

## DD-028.17: alle fünf Light-Vorgaben

Im Light Tool öffnete die Farbleiste die fünfteilige Palette (`21-light-palette-open.png`). Jede der fünf Kacheln wurde einzeln angeklickt. Danach war die Palette geschlossen, das Werkzeugfeld hatte die gewählte Farbe, und der erneut geöffnete RGBA-Wähler zeigte folgende exakten Werte bei A255:

| Kachel von links | RGB | Hex | Werkzeugfeld | Picker |
| --- | --- | --- | --- | --- |
| 1 | 236/205/139 | `eccd8b` | `22-light-warm-selected.png` | `23-light-warm-picker.png` |
| 2 | 234/239/202 | `eaefca` | `25-light-pale-selected.png` | `26-light-pale-picker.png` |
| 3 | 128/190/255 | `80beff` | `27-light-blue-selected.png` | `28-light-blue-picker.png` |
| 4 | 255/173/88 | `ffad58` | `29-light-orange-selected.png` | `30-light-orange-picker.png` |
| 5 | 77/213/105 | `4dd569` | `31-light-green-selected.png` | `32-light-green-picker.png` |

Damit ist die Übernahme **aller fünf** Vorgaben ins Light-Werkzeugfeld direkt belegt. Der Plus-Knopf, die Wirkung auf eine vorhandene Lichtquelle sowie Platzierung, Kartenwirkung und Speichern einer neuen Lichtquelle wurden nicht betätigt.

## Schutz und Abschluss

Programm-SHA-256 `9670325214d744194511d3ce731e910594b75e373928d95ca9e97ea30a769438`, PCK-SHA-256 `f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60`, Quellkarte-SHA-256 `d4798e716d396b60a3238bed6d5c78e17f65636d7047d4dc8765260f91ec0dd3`: `protected-before.sha256` und `protected-after.sha256` sind bytegleich. Die isolierte Arbeitskarte hat ebenfalls SHA-256 `d4798e716d396b60a3238bed6d5c78e17f65636d7047d4dc8765260f91ec0dd3`. Dungeondraft und Xvnc wurden beendet; der Grafikslot ist frei. Status 143 des zweiten Runs stammt vom gezielten Beenden nach der Aufnahme, nicht von einem Absturz.

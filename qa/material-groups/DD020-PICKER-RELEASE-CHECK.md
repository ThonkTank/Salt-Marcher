# DD-020 Farbpaket: statischer Release-Abgleich

Vergleichsstand: `release/dd020-picker` bei `d3d2cb3`; direkter Originalbefund [DD020-COLOR-NATIVE-RESULT](/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd020-color-native/RESULT.md). Rein statisch, ohne neuen Grafiklauf.

## Fallgleiche Werte und Umsetzung im Materialzweig

| Fall | Originalwert aus demselben 1.2.0.1-Lauf | Ergänzung |
| --- | --- | --- |
| DD-020.21 | `#3366cc` → Farbfeld (72,557) → `#424958`, A255; gespeichert `ff424958` | HSV-Sättigung/Wert als reine Funktion und auswählbares Feld im Picker. Der Test kalibriert nur den gemessenen Punkt. |
| DD-020.22 | `#3366cc` → Hue-Leiste (282,454) → `#7ccc33`, A255; gespeichert `ff7ccc33` | Hue-Funktion und Farbtonregler; S/V bleiben im gemessenen Fall erhalten. |
| DD-020.23–.25 | R100→`#6466cc`, G150→`#3396cc`, B50→`#336632`, jeweils A255 und gleiches gespeichertes ARGB | Je ein numerisches RGB-Feld und eine kanalreine 0–255-Funktion. |
| DD-020.28 | Pipette auf sichtbaren blanken Boden `(110,96,89)`, Ausgang A160 → `#6e6059`, A255; gespeichert `ff6e6059` | Callback akzeptiert gemessenes Pixel als RGB plus Alpha-Byte, statt den vorherigen Alpha-Wert still beizubehalten. **Noch kein Hostcallback angeschlossen.** |
| DD-020.26/.27 | Original-Hex bei A160: `a03366cc` | Hex-Eingabe/Ausgabe unterstützt 6-stelliges RGB und 8-stelliges ARGB; die bestehende 6-stellige Form bleibt gültig. |

Im Releasezweig war der Picker auf Hex/Alpha begrenzt; `sampleMapColor` war optional und nirgends angeschlossen. Die neuen Teile bleiben in `src/features/material/`; keine gemeinsamen Modell-, Renderer-, Properties- oder Editor-Dateien wurden geändert. Das bestehende `properties.ts` kann den Picker weiter mounten. Für DD-020.28 muss der Koordinationszweig einen Kartenpixel-Callback anschließen, der nach einem echten Kartensklick `{color, alphaByte}` aus der sichtbaren Szene liefert. Die Wahl, welche Ebene oder Beleuchtung erfasst wird, ist im Original noch nicht isoliert belegt.

## Offene Abnahme

- DD-020.20: nur Magenta→Braun-Reset belegt; der Originalprozess stürzte beim `X`-Motivwechsel ab. Keine allgemeine Reset-Funktion implementiert.
- DD-020.21/.22: das eine gemessene Pixelkoordinatenpaar und gespeichertes ARGB sind belegt; Feld-/Hue-Drag, andere Ausgangsfarben, Vorschau/Abbruch, Undo/Redo, Kartenpixel und frisches Öffnen müssen im isolierten Host und gegebenenfalls Original geprüft werden.
- DD-020.23–.25: Host muss Enter-Folge, sichtbare RGB/Hex/Alpha-Synchronisation, Kartenänderung, Undo/Redo, Speichern und Frischstart gegen die Originalwerte prüfen.
- DD-020.28: Ohne Kartenpixel-Callback gibt es noch keine aktive Pipette im Host; kontrolliertes Motivsampling und transparente Pixel bleiben Originalbeweislücken.
- Die Originalflächen überlappten wegen verzögerter Zeigerverarbeitung; daraus wird keine vollständige Pixelwirkung abgeleitet.

Nichtgrafische Prüfung: sechs gezielte Tests in `tests/material-pattern-color-picker.test.ts` bestanden; `npm run check` und `npm run build` bestanden.

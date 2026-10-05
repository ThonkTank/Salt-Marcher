# DD-020.20–.25/.28: gebündelte Originalmessung

**Nur Messplan, noch kein Ergebnis.** Ein exklusiver Grafikslot in
Dungeondraft 1.2.0.1, isoliertes neues Benutzerprofil ohne geladene Mods.
Binary/PCK vor Start gegen die im
`/home/aaron/.cache/dungeon-native-qa/audit-20261004/flaechen-material/DD-020.md`
protokollierten SHA-256-Werte
`9670325214d744194511d3ce731e910594b75e373928d95ca9e97ea30a769438` und
`f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60`
prüfen. Alle Karten, Bilder, Exporte und Protokolle
unter `implementation-20261005/qa/dd020-color-native/<lauf>/`, nie im
Nutzervault. Pro Hypothese nach zwei erfolglosen Gesten oder 45 Minuten die
genaue Lücke protokollieren und zum nächsten Fall wechseln.

## Eine kontrollierte Karte

Neue leere **12 × 8**-Karte auf Ground, nur eingebaute Assets, `Pattern Shape
Tool`, Form Rectangle, Kachel `X`, Layer 100, Outline OFF, Snap ON. Grid und
Lighting für die Pixelmessung OFF; deren sichtbaren Zustand fotografieren.
Die leere Karte **einmal** als Ausgangsstand speichern und deren SHA-256
notieren; danach wachsen die räumlich getrennten Proben in derselben
Arbeitskarte. Zuerst die Pipettenquelle S erstellen. Das bereits belegte `X`-Rechteck
`pattern-parity.dungeondraft_map` dient nur als Formatvergleich
(`color: "a03366cc"`), nicht als Testkarte mit unbekannten Voränderungen.

Alle neuen Rechtecke erhalten unterschiedliche, nicht überlappende
Feldbereiche. Farben und Ebenen werden **vor** jedem Zug eingestellt;
keine vorhandene Fläche ist ausgewählt. Einen unerwartet aktiven Griff vor
der nächsten Farbe fotografieren und die Probe erst nach Klärung fortsetzen.
Nach jedem Zug den Pickerzustand,
die Farbfläche und den Musterzähler fotografieren. Die Feldmitte ist der
spätere Pixelmesspunkt:

| Kennung | Bereich (Start→Ende) | Zweck |
| --- | --- | --- |
| S | (1,1)→(3,2) | Pipettenquelle, `#4a8bc6`, A=255 |
| Z | (4,1)→(6,2) | Ergebnis der Rückkehrtaste .20 |
| F | (7,1)→(9,2) | Farbfeld/Sättigung .21 |
| H | (1,3)→(3,4) | Farbtonleiste .22 |
| R | (4,3)→(6,4) | einzelner R-Wert .23 |
| G | (7,3)→(9,4) | einzelner G-Wert .24 |
| B | (1,5)→(3,6) | einzelner B-Wert .25 |
| P | (4,5)→(6,6) | Pipettenziel .28 |

Bei verzögerter Original-Zeigerverarbeitung tatsächliche gespeicherte
`points` statt beabsichtigter Feldkoordinaten als Zuordnung verwenden.
Fehlplatzierte Probe nicht stillschweigend als denselben Vergleich ausgeben.

## Bedienfolge und Einzelmessungen

Vor **jeder** Farbänderung den Picker mit Hex `3366cc`, A=255 über `Accept`
auf R=51/G=102/B=204 zurücksetzen; diese Werte erst ablesen, bevor die
Fallgeste beginnt. Aufnahme jeweils vor Geste, nach Geste **vor Accept**,
nach Accept im Panel, nach Rechteckzug. Den sichtbaren Farbbalken, Hex,
R/G/B/A, Auswahlmarker im Picker und eine mögliche Kartenänderung vor Accept
getrennt erfassen.

| Fall | Genau eine Fallgeste | Entscheidende Beobachtung |
| --- | --- | --- |
| **.20 Rückkehrtaste** | Auf `X` erst `ff00ff`, A=255 per Accept setzen; kreisförmige Taste **neben dem Panel-Farbbalken** einmal drücken. Picker wieder öffnen und R/G/B/A/Hex ablesen; Z zeichnen. Dann ohne Kartenzug `21a764`, A=160 setzen, Taste nochmals drücken und Werte erfassen. Dieselbe zweite Farbeingabe bei einer anderen klar benannten eingebauten Musterkachel einmal wiederholen, danach zu `X` zurück. | Rückkehrwert je Farbfolge und Motiv, Alpha-Verhalten, ob eine bestehende Fläche geändert wurde. Der ältere Beleg zeigt nur Magenta→voriges Braun; keine allgemeine Reset-Regel vorwegnehmen. |
| **.21 Farbfeld/Sättigung** | Basis wiederherstellen. Im großen 2D-Farbfeld bei **25 % Breite, 65 % Höhe** klicken; tatsächliche Fensterkoordinate/Größe mit Screenshot notieren. R/G/B/A/Hex vor und nach Accept lesen, F zeichnen. | Numerischer Endwert, Vorschaufarbe und gespeicherte Kartenfarbe. Keine HSV-Formel als Originalwert voraussetzen. |
| **.22 Farbtonleiste** | Basis wiederherstellen. An der vertikalen Hue-Leiste bei **25 % Höhe** klicken, tatsächliche Koordinate notieren. Werte vor/nach Accept, H zeichnen. | Ob nur Hue oder auch andere Komponenten wechseln und welcher RGB-Endwert gespeichert wird. |
| **.23 R** | Basis wiederherstellen. R-Zahlenfeld fokussieren, `Ctrl+A`, `100`, Enter; falls unverändert, genau ein alternativer Versuch durch Doppelklick auf die Zahl. Werte vor/nach Accept, R zeichnen. | Eingabegeste, tatsächlich angezeigtes R sowie G/B/A/Hex und gespeichertes ARGB. |
| **.24 G** | Basis wiederherstellen; analog ausschließlich G auf `150`, G zeichnen. | Andere Kanäle, Alpha und gespeichertes ARGB getrennt von .23. |
| **.25 B** | Basis wiederherstellen; analog ausschließlich B auf `50`, B zeichnen. | Andere Kanäle, Alpha und gespeichertes ARGB getrennt von .23/.24. |
| **.28 Pipette** | S zuerst zeichnen. Für P Picker auf `3366cc`, **A=160** stellen; kleine Pipettentaste **im Picker** drücken, dann Mitte von S bei (2,1.5) anklicken. Ohne weitere Farbbedienung R/G/B/A/Hex und etwaige Änderung der Musterzahl aufnehmen; danach Accept und P zeichnen. | Sample-RGB gegen gespeichertes S-RGB **und** gerenderten S-Pixel vergleichen; Alpha vor/nach Sample und nach Accept erfassen. So bleibt offen, ob die Pipette Quelldaten oder sichtbare Komposition abtastet, bis der Befund es zeigt. |

Der frühere direkte Nachlauf in
`audit-20261004-vollstaendigkeit/material/gui-run/evidence/40-pattern-magenta.png`,
`41-pattern-reset-color.png` und `39-pattern-picker-symbol-map-click.png`
ist eine Gegenkontrolle für .20/.28, kein Ersatz für die neue kontrollierte
Karte. Die getrennte Taste neben dem Farbbalken und die kleine Taste **im**
Picker dürfen nicht verwechselt werden.

## Datei, Bildpixel und Frischstart

Nach allen acht Rechtecken: Karte speichern, `.dungeondraft_map`-SHA-256
notieren. Für jeden Eintrag in `world.levels["0"].patterns` `node_id`,
`points`, `layer`, `color` (ARGB), `outline` und eventuelle Texturreferenz
mit Kennung S/Z/F/H/R/G/B/P zuordnen; nicht nur Screenshots auswerten.
Zusätzlich **ein** PNG mit 256 Pixel/Feld, Grid OFF und Lighting OFF
exportieren; Optionen fotografieren und PNG samt SHA-256 sichern. Für jede
Rechteckmitte RGBA und den Median eines 5×5-Pixel-Felds notieren; nur
Innenpixel fern von Raster und Kanten verwenden. Wenn Export scheitert,
Screenshots und Kartendatei sichern und die genaue Pixel-Beweislücke nennen.

Dungeondraft vollständig beenden, mit demselben isolierten Profil neu
starten, die gespeicherte Karte **frisch öffnen** und dieselben acht
Farbflächen fotografieren. Den Karten-SHA vor/nach Öffnen vergleichen;
ohne erneutes Speichern darf er nicht wechseln. Falls erneut exportiert,
gleiche Optionen verwenden und die acht Pixelproben vergleichen. Ein
frisch geöffnetes Bild allein beweist keine Picker-Regel; pro DD-Fall
bleiben Bedienwert, gespeicherter ARGB-Wert und Pixelwirkung getrennte
Nachweise.

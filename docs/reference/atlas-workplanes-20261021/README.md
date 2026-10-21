# Geschossbearbeitung auf der gemeinsamen Atlaskamera

Lokaler P6-Teilstand vom 21.10.2026, Runtime `d2944a2d4`.
Der normale Electron-Atlas verwendet weiterhin seine vorhandenen Werkzeuge,
Raum-/Zeichnungsdaten und History. Keine zweite Kartenfläche oder Speicherform.

## Ursache und Änderung

Gebäudegebundene Raumflächen berücksichtigten bereits ihre Grund- und
Geschosshöhe. Zeigerpunkte, Autorenkonturen und Maßprojektion verwendeten dagegen
Geländetreffer. Freie Raumgruppen und semantische Raumnamen hatten ebenfalls
keinen durchgängigen Geschossbezug. Das fiel in bisherigen Kameraproben mit
Geschoss und Gelände auf derselben Höhe nicht auf.

`atlas-workplane.ts` teilt Scope, Geschosshöhe und Weltanker zwischen Darstellung
und Eingabe. Gebäude verwenden die aufgelöste Fundamenthöhe; freie Gruppen
eine horizontale Ebene über ihrem Geländeanker. Raumflächen, Griffe, Entwürfe,
Maßangaben, Raumnamen und Ausgabegruppen erhalten denselben Bezug. Die
Raumlabelprojektion liest jede benötigte Geschosshöhe einmal je Bereichsanfrage.

Innenraumwerkzeuge schneiden den Kamerastrahl mit dieser Ebene. Vorderes Gelände,
Himmel, Treffer hinter der Kamera und der vorhandene Fernhorizont bleiben
Ausschlussgründe. Navigation verwendet dieselbe Ebene ohne Auswahlverdeckung;
Geländewerkzeuge behalten ihre bisherigen Oberflächentreffer. Überhöhung bleibt
eine Darstellungsgröße und verändert keine gespeicherten Meterwerte.

## Prüfungen

159 Fälle in `tests.log` prüfen Atlasdarstellung, Autorenebene, Canvas/Ausgabe,
Bereichsleser und räumliche Treffer. Weitere vier Gebäudefälle aus
`tests/terrain-object-main.test.mjs` waren ebenfalls erfolgreich. Neue Fälle
prüfen Neigung bis 75 Grad, Drehung, Überhöhung, Koordinaten bei ±1 Milliarde
Metern, feste Gebäudegrundhöhen, Geländeanker, verdeckte Ebenen, Raumnamen,
Geschosshöhen im Readonly-Bereich und die Ausgabeattribute.

Die alte Autoren-DOM-Fixture fehlte das bereits vorhandene Element
`atlas-entrance-height`: 13 Fehler wurden unverändert auf `992c168ef`
reproduziert. Die Fixture ergänzt dieses Element, ohne Produktverhalten zu
ändern. Die neuen Autorenprüfungen kontrollieren Geschosshöhe und Anker an den
wirklichen Rendergruppen.

## Native Probe

Die [Gegenprobe mit dem bisherigen Renderer](native-before.json) findet beim
Ziehen an der projizierten Geschossecke keinen speicherbaren Zug. Der
Renderer-SHA `4e2eb5ee…35d89` stimmt mit der vorangehenden Entwicklungsstartprobe
von `f1520ba2` überein. Ein zusätzlicher Fehler beim Lesen der Prozesskennung
nach `app.close()` wurde im Testharness korrigiert; die Sitzung wurde vom
Wrapper beendet. Diese Gegenprobe ist keine erfolgreiche Produktprüfung.

[Der korrigierte Ablauf](native-floors.json) verwendet Runtime `d2944a2d4`:
Geschoss auf 12 m, Neigung/Drehung, Raum-/Objektauswahl, verworfener Entwurf,
Eckpunkt von x=80 auf x=95, Undo/Redo und frische Wiederöffnung. Der gespeicherte
Punkt ist `(95.000001459, -0.000001860)`. Anschließend werden auf einem zweiten
Geschoss bei 24 m ein Raum gezeichnet und gespeichert und die Geschosse wieder
gewechselt. Zwei Prozesse beenden sich normal mit Code 0; beide PIDs sind weg,
`errors` ist leer. Ein Renderer bleibt über Pose- und Werkzeugwechsel erhalten.

[Vorher](before.png), [Geschoss mit passenden Griffen und Namen](floor.png),
[verschobene Ecke](vertex.png), [Entwurf im Obergeschoss](upper-draft.png) und
[gespeicherter Raum](upper-saved.png) wurden visuell geprüft. Die treppenförmige
Kontur im letzten Bild ist der unten dokumentierte bestehende Volumenpfad.

[Der tatsächliche Entwicklungsstart](native-development.json) führt
`npm run start:desktop` in diesem Repository aus. Kampagnenöffnung, Neigen,
Drehen und Radzoom auf derselben Hauptfläche, automatische Höhenlinien,
inkrementelle Farbkacheln, Grafik-Recovery und erweiterte Fernabdeckung bestehen.
Normaler Exit 0, PID nicht mehr vorhanden, keine aufgezeichneten Fehler. Der
Renderer-SHA stimmt mit der Geschossprobe überein. [Entwicklungsatlas](development.png).
App-/Desktop-Typprüfung, Desktop-Build und Repositoryprüfung sind erfolgreich.
Der Capability-Katalog enthält die tatsächlichen Testpfade mit `--geprueft`.

## Grenzen und nächste Arbeit

Dies ist kein Abschluss von P6 oder der Gesamtroadmap. Eine sichtbare Arbeitsebene
auch auf leeren Geschossen, gezielte Freilegung unterirdischer Räume, vollständig
konsistente Rasterdetails und Anker außerhalb der geladenen Geländequelle
benötigen weitere Arbeit. Große Karten, langfristige Eingabelatenz, weitere
Objekthöhen, Spieleransicht und die vollständigen Abschlussprüfungen bleiben offen.

Die native Neuanlage zeigte zusätzlich: `storage/drawing.ts` initialisiert bei
`create-room` automatisch ein Volumen. Dadurch werden auch freie Polygone trotz
abgeschaltetem Rasterfang in 1,524-Meter-Zellen überführt; schräge Wände erscheinen
als Treppen. Der Kameratest prüft deshalb gespeicherte Lage innerhalb dieses
bestehenden Rasters, nicht unveränderte Polygonknoten. Dies muss als eigener
Speicher-/Werkzeugfehler korrigiert werden; die aktuelle Änderung kaschiert ihn
nicht durch geglättete Anzeige.

Keine Exact-SHA-Candidate-CI, Main-Integration, Paket-, Installations- oder
Nutzerabnahme. Die drei vollständigen kritischen Abschlussuntersuchungen haben
noch nicht begonnen.

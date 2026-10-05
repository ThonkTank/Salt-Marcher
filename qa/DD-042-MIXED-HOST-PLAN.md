# DD-042.01/.07: isolierte gemischte Hostprobe

Der Zusatzbaustein aus Bau-Commit `505610d` liegt unter `tools/groups/scenarios/objekte-07-mixed.cjs`. Er ist im vorhandenen `objekte-07`-Szenario über `--mixed-prefab` eingebunden. Dadurch führt der Gruppenrunner in einer **eigenen QA-Umgebung** nur die gemischte Objekt-Licht-Folge aus und registriert DD-042.01/.07 jeweils einmal. Alle übrigen Gruppenfälle werden in diesem Sonderlauf durch `group-record` ausdrücklich `open`; die reguläre Gruppenfolge und das Manifest bleiben unverändert. Es gibt keine doppelte Fallzuordnung im Manifest und keine doppelten Fallrecords im Lauf.

Aufruf nach Zuweisung des Grafikslots, mit dem zu prüfenden Plugin-Build als `DUNGEON_PLUGIN_ROOT` und eigenem `DUNGEON_QA_ROOT`:

```sh
node tools/host-test.cjs --group objekte-07 --mixed-prefab
node tools/host-test.cjs --group objekte-07 --mixed-prefab --restart
```

Beide Befehle müssen dieselbe QA-Root nutzen. Der Editlauf erstellt eine isolierte 8×8-Karte, fügt als Fixture ein Objekt und ein Licht ein und wählt beide danach **über das sichtbare Auswahlwerkzeug** mit Shift. Er fotografiert Auswahl und Make-Prefab-Dialog, speichert eine Vorlage und prüft genau beide Entitäten, ihren relativen Versatz `(3,1)`, gemeinsame Vorlagenbindung sowie Karten- und Katalogdatei. Der Frischstart prüft dieselbe Definition, Bindung und gespeicherte Karte. Direkter Originalbeleg ist [`native-mixed-prefab.json`](/home/aaron/.cache/dungeon-native-qa/evidence/native-mixed-prefab.json) mit [ausgewählter Kombination](/home/aaron/.cache/dungeon-native-qa/evidence/native-mixed-shift-second.png), [Dialog](/home/aaron/.cache/dungeon-native-qa/evidence/native-mixed-prefab-dialog.png) und gespeicherter `.dungeondraft_prefab`-Datei.

Das Original zeigt im Hauptdialog einen beschrifteten Cancel-Knopf, der Editor ein X; Oberflächengestaltung darf laut Produktziel abweichen. Der Sonderlauf erkennt deshalb Cancel **oder** X als sichtbaren Abbruchweg und meldet das Fehlen der Beschriftung nicht allein als Produktfehler. Die Wirkung von Escape ist bereits als enge Host-Teilbestätigung unter DD-042.08 dokumentiert; die Wirkung des X bleibt bis zu einer eigenen Betätigung offen. Die gemischte Hostfolge und ihre Persistenz sind derzeit **nicht grafisch ausgeführt**. Ebenso ist die Ursache des einmal ausgebliebenen Dialogs im früheren Gruppen-Editlauf offen.

Statische Vorprüfung: beide Szenariodateien laden ohne GUI, `node --check` besteht. `group-record` weist doppelte Fallnummern zurück; der Sondermodus registriert `.01/.07` exakt einmal. Änderungen beschränken sich auf QA-Dateien.

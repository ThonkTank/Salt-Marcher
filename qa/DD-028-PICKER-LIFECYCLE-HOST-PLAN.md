# DD-028: Picker bei Werkzeug- und Auswahlwechsel

Der Sonderlauf `--dd028-picker-lifecycle` verwendet die isolierte `objekte-03`-Karte und das geprüfte Colorable-QA-Paket. Er ändert keinen Produktcode. Ein grafischer Lauf darf erst nach Zuteilung des exklusiven Testfensters starten.

1. Bestehendes A128-Objekt wählen, Picker auf A0 ändern und vor dem Schließen den sichtbaren Colorable-Pixel, das unveränderte Dokument und die unveränderte History prüfen. Zum Hand-Werkzeug wechseln. Der Picker muss schließen, das Objekt A0 mit genau einem History-Schritt übernehmen und die Renderer-Vorschau freigeben. Undo und Redo prüfen.
2. Bestehendes A0-Objekt wählen, Picker auf A128 ändern und dieselben Liveprüfungen durchführen. Während der Picker offen ist, ein anderes Objekt auswählen. Danach A128, genau einen History-Schritt, keine Renderer-Vorschau und Undo/Redo prüfen.
3. Speichern und auf Entfernung der `.draft` warten. Im frischen Prozess dieselbe Kartenprüfsumme, A0/A128, Pixelwirkung, `dirty=false` und leere Renderer-Vorschau prüfen.

Nach Integration der beiden QA-Dateien in den aktuellen Runner und Build des Kandidaten, aus dessen Projektverzeichnis:

```sh
DUNGEON_PLUGIN_ROOT=/home/aaron/.cache/dungeon-native-qa/implementation-20261005/release-dd028-dd021 DUNGEON_QA_ROOT=/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd028-picker-lifecycle node tools/host-test.cjs --group objekte-03 --dd028-picker-lifecycle
DUNGEON_PLUGIN_ROOT=/home/aaron/.cache/dungeon-native-qa/implementation-20261005/release-dd028-dd021 DUNGEON_QA_ROOT=/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd028-picker-lifecycle node tools/host-test.cjs --group objekte-03 --dd028-picker-lifecycle --restart
```

`group-cases.json` hält DD-028.06 und alle übrigen Gruppenfälle auf `open`. Diese Probe belegt den Host-Lebenszyklus, keine Dungeondraft-Gleichwertigkeit: Die Originalwirkung eines Werkzeug- oder Auswahlwechsels bei offenem Picker ist noch nicht direkt gemessen. Der reguläre DD-028.08-Accept-Fall bleibt ein separater Lauf.

# DD-001/002: Kartenstart und Größenvorlagen

Stand: 05.10.2026. Der erste isolierte Hostlauf liegt vor. Der schmale Dialogfix für DD-001.01/.02 ist im Bau-Zweig vorbereitet; Nutzervault und Abnahmedatei blieben unverändert.

## Pflichtfälle und Originalgrenzen

Die 15 Fälle DD-001.01–.06 und DD-002.01–.09 stehen einzeln in [`CASE-INVENTORY.json`](CASE-INVENTORY.json). Direkte Originalfolgen decken New, 35×20-Startmaß, Breite 0/7.5 → 8, Anlage und Save/Frischstart einer 8×8-Karte, Cancel sowie das Anlegen und Entfernen einer benannten Vorlage ab. Für X an beiden Dialogen, Template-Cancel, erneute native Vorlagenwahl, normale Vorlagenpersistenz und die allgemeine Maßgrenzenregel fehlen fallgleiche Beobachtungen. Der gescheiterte native Dropdown-Klick gilt ausdrücklich nicht als Beleg gegen die Funktion.

## Vorbereitete Hostfolge

`DUNGEON_QA_ONLY_DD001002=1` leitet die bestehende Gruppe `verwaltung-karte-datei` an `tools/groups/scenarios/dd001002-map-start.cjs` weiter. Der gemeinsame Runner legt einen eigenen QA-Vault an. Die Edit-Phase prüft den sichtbaren Neuanlagedialog, Abbruch ohne Datei, Breite null, eine benannte 8×8-Vorlage, deren Auswahl, eine 8×8-Karte und deren tatsächlichen Speicherzeitpunkt. Die Frischstartphase prüft Karten- und Vorlagenzustand, danach das Entfernen der Vorlage bei zuvor angezeigten 12×8 Maßen. Jeder geprüfte Fall landet einzeln mit Bild und JSON in `group-cases.json`; die übrigen Fälle bleiben mit benannter Lücke `open`. Ein Laufabbruch wird zusätzlich als Fehler an den Runner weitergereicht.

Der installierte Ausgangsbuild zeigte im vollständigen zweiten Hostlauf 80×60 statt 35×20 und erzeugte bei Breite 0 keine 8×20-Karte. Nach `Merken` wechselte die Anzeige von 8×8 auf 80×60; nach Entfernen einer Vorlage beim Frischstart von 12×8 auf 80×60. Außerdem existierte die Kartendatei schon vor manuellem Save. Das sind die Fallabweichungen DD-001.01/.02/.04 und DD-002.05/.09 in `qa/dd001002-installed-host2/evidence/1791216622290-verwaltung-karte-datei-edit/group-cases.json` und `1791216639043-verwaltung-karte-datei-reopen/group-cases.json`. Der erste Hostlauf brach nach `.02` ab und wird nur für die dort erreichten Fälle gelesen.

## Ausführung und Wertungsgrenzen

Nach exklusiver grafischer Testzeit: isolierten QA-Root setzen und im integrierten Build `node tools/host-test.cjs --group verwaltung-karte-datei` mit `DUNGEON_QA_ONLY_DD001002=1` ausführen; anschließend denselben QA-Root mit `--restart` prüfen. `result.json` allein genügt nicht: `group-cases.json`, `dd001002-steps.json`, Karten- und Vorlagenzustand müssen fallweise gelesen werden. DD-002.01/.07 und Vorlagenpersistenz bleiben trotz bestandener Hostaktion offen, solange die genannte Originallücke besteht. Oberfläche und Dateiformat dürfen abweichen; Maßwirkung und gespeicherte Karte müssen gleichwertig sein.

Der Host benutzt denselben `verwaltung-karte-datei`-Gruppenkatalog wie DD-038/039; die nicht ausgeführten DD-038/039-Fälle erscheinen in diesem engen Lauf deshalb als `open` und sind keine Regression. Für die Installation dieses Pakets sind keine neuen Modell- oder Renderer-Schnittstellen nötig. Änderungen an Startmaß, Wertebegrenzung, Vorlagen-Dialogzustand und ungespeicherter Neuanlage wären gesonderte Produktpakete.

## Isolierter Produktkandidat für DD-001

`src/features/verwaltung/new-map-size.ts` hält die direkt belegte Startgröße 35×20 und eine nur auf die Neuanlage bezogene Breitenanpassung bereit. Breite 0 und 7,5 werden 8; Werte ab 8, negative oder ungültige Eingaben sowie die Höhe passieren unverändert zur bestehenden Dokumentvalidierung. Die Verallgemeinerung für noch ungemessene positive Breiten unter 8 ist eine ausdrücklich gekennzeichnete Mindestwert-Inferenz. Keine Rundung oberhalb 8 und keine Höhenregel werden behauptet. `CreateDungeonModal` verwendet die Startgröße und übergibt erst beim Klick auf `Anlegen` die angepasste Größe an `DungeonPlugin.create`.

Der Produktdiff in `src/main.ts` beschränkt sich auf Import, Startwerte, Größe beim Klick auf `Anlegen` und den Erhalt der angezeigten Maße nach `Merken` und `−`. `saveSizePreset(...)` und `newDocument(...)` bleiben unverändert; die Untergrenze der Template-Eingaben ist im Original nicht vermessen. Der Speicherzeitpunkt der neuen Karte bleibt eine getrennte Architekturabhängigkeit, weil `DungeonPlugin.create` derzeit sofort Datei und Raumstruktur erzeugt.

`Merken` und `−` erhalten mit `render(size?: {width:number;height:number})` die eingegebenen Maße. Die komplette Neudarstellung setzt weiterhin Name, Assetauswahl und Startschalter zurück; diese Felder sind durch DD-002.05/.09 nicht abgenommen. Eine spätere Korrektur kann den gesamten Dialogentwurf als Instanzzustand erhalten. Die Dateierzeugung vor Save bleibt eine getrennte Architekturfrage; an Dateiabläufen wurde hier nichts geändert.

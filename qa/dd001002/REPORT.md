# DD-001/002: Kartenstart und Größenvorlagen

Stand: 05.10.2026. Dieses Paket bereitet ausschließlich den isolierten Hostvergleich vor. Dungeondraft 1.2.0.1 wurde dafür nicht erneut gestartet; Produkt, Nutzervault und Abnahmedatei blieben unverändert.

## Pflichtfälle und Originalgrenzen

Die 15 Fälle DD-001.01–.06 und DD-002.01–.09 stehen einzeln in [`CASE-INVENTORY.json`](CASE-INVENTORY.json). Direkte Originalfolgen decken New, 35×20-Startmaß, Breite 0/7.5 → 8, Anlage und Save/Frischstart einer 8×8-Karte, Cancel sowie das Anlegen und Entfernen einer benannten Vorlage ab. Für X an beiden Dialogen, Template-Cancel, erneute native Vorlagenwahl, normale Vorlagenpersistenz und die allgemeine Maßgrenzenregel fehlen fallgleiche Beobachtungen. Der gescheiterte native Dropdown-Klick gilt ausdrücklich nicht als Beleg gegen die Funktion.

## Vorbereitete Hostfolge

`DUNGEON_QA_ONLY_DD001002=1` leitet die bestehende Gruppe `verwaltung-karte-datei` an `tools/groups/scenarios/dd001002-map-start.cjs` weiter. Der gemeinsame Runner legt einen eigenen QA-Vault an. Die Edit-Phase prüft den sichtbaren Neuanlagedialog, Abbruch ohne Datei, Breite null, eine benannte 8×8-Vorlage, deren Auswahl, eine 8×8-Karte und deren tatsächlichen Speicherzeitpunkt. Die Frischstartphase prüft Karten- und Vorlagenzustand, danach das Entfernen der Vorlage bei zuvor angezeigten 12×8 Maßen. Jeder geprüfte Fall landet einzeln mit Bild und JSON in `group-cases.json`; die übrigen Fälle bleiben mit benannter Lücke `open`. Ein Laufabbruch wird zusätzlich als Fehler an den Runner weitergereicht.

Aus aktuellem Quellstand folgen bereits zwei wahrscheinliche Abweichungen, die der Hostlauf bestätigen oder widerlegen muss: `CreateDungeonModal` startet bei 80×60 statt 35×20 und rendert nach `Merken`/Löschen neu, wodurch die zuvor eingegebenen Maße verloren gehen. `DungeonPlugin.create` speichert die Karte sofort, während der native 8×8-Grundfall erst mit Save eine Datei erzeugte. Diese Aussagen sind noch keine neue Hostabnahme.

## Ausführung und Wertungsgrenzen

Nach exklusiver grafischer Testzeit: isolierten QA-Root setzen und im integrierten Build `node tools/host-test.cjs --group verwaltung-karte-datei` mit `DUNGEON_QA_ONLY_DD001002=1` ausführen; anschließend denselben QA-Root mit `--restart` prüfen. `result.json` allein genügt nicht: `group-cases.json`, `dd001002-steps.json`, Karten- und Vorlagenzustand müssen fallweise gelesen werden. DD-002.01/.07 und Vorlagenpersistenz bleiben trotz bestandener Hostaktion offen, solange die genannte Originallücke besteht. Oberfläche und Dateiformat dürfen abweichen; Maßwirkung und gespeicherte Karte müssen gleichwertig sein.

Der Host benutzt denselben `verwaltung-karte-datei`-Gruppenkatalog wie DD-038/039; die nicht ausgeführten DD-038/039-Fälle erscheinen in diesem engen Lauf deshalb als `open` und sind keine Regression. Für die Installation dieses Pakets sind keine neuen Modell- oder Renderer-Schnittstellen nötig. Änderungen an Startmaß, Wertebegrenzung, Vorlagen-Dialogzustand und ungespeicherter Neuanlage wären gesonderte Produktpakete.

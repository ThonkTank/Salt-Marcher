# Canvas of Kings Demo: isolierte Originalprobe

Nutzerfreigabe vom 09.10.2026 umfasst RFB/VNC-Eingaben in dieser separaten Testsitzung. Der Starter bedient die installierte Steam-Demo 3122210. Die Vollversion 2498570 und ihre zusätzlichen Funktionen sind dadurch nicht abgenommen.

`identity.mjs` prüft Steam-Appmanifest, Installationspfad und gestreamte SHA-256-Hashes des Originals sowie beider Bibliotheken. Kein komplettes 1,89-GB-Programm wird zum Hashen in den RAM geladen. Der Starter verwendet ein neues privates HOME/XDG-Profil, eigene Xvnc-Anzeige, Openbox und eigenen D-Bus ohne Serviceaktivierung. RFB lauscht nur lokal. Die gemeinsame `dungeon-editor-test.lock` bleibt während der gesamten Sitzung gehalten; zuerst den GUI-Platz mit dem Kollegen abstimmen. Hardware-Rendering wird nicht auf Software umgestellt. Nur eigene Kinder werden beendet; Originaldateien und produktive Profile bleiben unberührt.

```sh
node tools/canvas-of-kings/session.mjs \
  --run /home/aaron/.cache/dungeon-native-qa/city-plans/NEUER-COK-LAUF \
  --app '/home/aaron/.var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/common/Canvas of Kings Demo/CanvasOfKingsDemo.x86_64' \
  --steam-manifest /home/aaron/.var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/appmanifest_3122210.acf \
  --xvnc /home/aaron/.cache/dungeon-native-qa/dependencies/tigervnc/usr/bin/Xvnc \
  --wm /home/aaron/.cache/dungeon-native-qa/dependencies/openbox/usr/bin/openbox
node tools/canvas-of-kings/rfb.mjs --session /ABSOLUTER-LAUF/session.json --shot 001-start
```

Zuerst den realen Screenshot mit dem Bildwerkzeug lesen. Erst dann konkrete Eingaben festlegen. Der Wrapper prüft COK-Identität vor jeder Verbindung und importiert ausschließlich den vorhandenen generischen RFB-Transport `../wonderdraft/rfb.mjs`. Dessen Wonderdraft-Starter, PCK- und Profilidentität werden nicht übernommen. Unterstützte begrenzte Eingaben und Bild-/Eingabeprovenienz entsprechen dem Transport: `--click x,y`, `--drag x,y:x,y`, `--key Escape`, `--text Text`, `--wheel x,y:-3`. Keine blinden Gestenketten. Screenshotnamen nicht wiederverwenden. Synthetische Eingaben sind keine physische Bedienabnahme.

Normale Beendigung über die sichtbare Originaloberfläche mit Exit0 belegen. Abbruch: ausschließlich im eigenen Lauf eine Datei `stop` anlegen und den Starter bis zum Ende abwarten; ein solcher Abbruch wird nicht als normales Originalende ausgegeben. Sitzungs-/Bildbelege und private Karten bleiben im externen QA-Root. `tests/canvas-of-kings-session.test.mjs` prüft nur offline Pfad- und Identitätsgrenzen, keinen Originalstart oder Produktverhalten.

Jede Option darf nur einmal vorkommen; der COK-Vorparser lehnt doppelte Namen vor Sessionzugriff und Verbindung ab. Für mehrere Klicks separate Aufrufe verwenden und die Zwischenbilder lesen. Normales Schließen der Originalinstanz kann die RFB-Verbindung vor dem angeforderten Abschlussbild beenden; dann den Starter und session.originalExit prüfen, kein fehlendes Bild als vorhanden angeben.

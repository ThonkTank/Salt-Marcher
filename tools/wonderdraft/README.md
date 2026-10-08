# Direkte Wonderdraft-Referenzmessung

Diese Helfer bedienen das installierte Original in einem eigenen XDG-Profil. Sie enthalten keinen Kartenrenderer oder Nachbau. Bilder, Rohkarten, Profile und Laufprotokolle bleiben außerhalb des Repos unter `/home/aaron/.cache/dungeon-native-qa/`. Der aktuelle Fortschritt steht ausschließlich im Checkpoint; die verbindlichen Zuordnungen in `acceptance.json.wonderdraftParity`.

Voraussetzungen: Node mit den Repo-Abhängigkeiten, `flock`, `/usr/bin/dbus-daemon`, ein ausführbares Xvnc und Openbox mit seinen Bibliotheken. Die für diesen Rechner privat entpackten Programme liegen unter `/home/aaron/.cache/dungeon-native-qa/dependencies/`; keine Paketinstallation oder Änderung am Wonderdraft-Programm ist nötig.

Aus dem Repo mit einem **neuen absoluten Laufverzeichnis** starten:

```sh
node tools/wonderdraft/session.mjs \
  --run /home/aaron/.cache/dungeon-native-qa/hex-00/NEUER-LAUF \
  --app /home/aaron/.local/opt/Wonderdraft/Wonderdraft.x86_64 \
  --xvnc /home/aaron/.cache/dungeon-native-qa/dependencies/tigervnc/usr/bin/Xvnc \
  --wm /home/aaron/.cache/dungeon-native-qa/dependencies/openbox/usr/bin/openbox
```

Eine gemeinsame grafische QA-Sperre verhindert gleichzeitig gestartete Testinstanzen. Der Starter prüft zusätzlich laufende Original-/Testprozesse. Testprofil und Fenstergröße sind fest; RFB hört ausschließlich lokal. Openbox ist für die Fensterinitialisierung dieser Godot-Version nötig. Die normale Ressourcenverwaltung gilt; bei akutem systemweitem Speichermangel beendet die Notbremse nur eigene Kinder. `session.json` dokumentiert Rolle, Hashes, Eingabeart, PID und Prozessstartkennung.

Für Erststartdialoge zusätzlich `--first-run` angeben. Dann beginnt das eigene Profil ohne vorgegebene `config.ini`; Wonderdraft legt seine Standardeinstellungen selbst an. `profileInitialization` dokumentiert diese Variante. Die private Anzeige und deren Größe bleiben gleich. Ob ein Startdialog erscheint, muss am tatsächlichen Frame geprüft werden; sein Ausbleiben beweist keine vollständige Abdeckung bedingt sichtbarer Dialoge.

Für eine echte Neustartprobe mit erhaltenen Programmeinstellungen `--profile-from /ABSOLUTER-ALTER-QA-LAUF/session.json` verwenden. Die Quelle muss eine vollständig beendete isolierte Wonderdraft-Sitzung unter dem QA-Verzeichnis sein; Originalhashes müssen übereinstimmen und ihre eigenen Prozesse beendet sein. Ausschließlich deren privates `data/Wonderdraft` wird ins neue Profil kopiert. Die kopierte `config.ini` wird nicht mit der Fenster-Vorgabe überschrieben. Herkunft, Sitzungskennung und Konfigurationshash stehen in `profileSource`. Produktive Profile sind keine zulässige Quelle; `--first-run` und `--profile-from` schließen sich aus.

Systemdateidialoge benötigen ebenfalls die private Anzeige. Wonderdraft und seine Kinddialoge erhalten X11 als Backend, keine Wayland-Anzeige und einen eigenen D-Bus ohne Serviceaktivierung. Dadurch verwenden sie keinen Dateidialog des produktiven Desktops. Der kurze private Socketpfad steht in `displayIsolation`; sein Verzeichnis wird nach Beendigung der eigenen Prozesse entfernt. Bei einem Systemdialog zuerst dessen tatsächliches Bild abwarten. Eine nicht reagierende Wonderdraft-Oberfläche allein beweist keinen Programmabsturz: ein modaler Kinddialog kann noch geöffnet sein.

Zuerst den **aktuellen echten Frame lesen**, erst danach Eingaben anhand der gesehenen Oberfläche festlegen. Keine Koordinaten aus anderen Anwendungen übernehmen:

```sh
node tools/wonderdraft/rfb.mjs --session /ABSOLUTER-LAUF/session.json --shot 001-start
node tools/wonderdraft/rfb.mjs --session /ABSOLUTER-LAUF/session.json --click 123,21 --shot 002-new
```

Weitere begrenzte Eingaben: `--move x,y`, `--drag x,y:x,y`, `--wheel x,y:-3`, `--key Control+s`, `--text 'Text'`. `--button right` beziehungsweise `--button middle` verändert nur einen angegebenen Klick oder Zug; ohne Angabe gilt `left`. `--hold Space` beziehungsweise `--hold Control` hält die Taste während einer Zeigeraktion und gibt sie danach frei; unterstützt sind Control, Shift, Alt und Space auch in Kombination. Nicht gleichzeitig mit `--key`/`--text` verwenden. `--drag-key Escape` sendet Escape nach dem achten von 16 Schritten eines weiterhin gedrückten Mauszuges. Diese Gesten werden einschließlich Halten/Freigeben beziehungsweise Eingriffspunkt protokolliert. Ein Screenshotname darf nicht wiederverwendet werden. Bilder und Metadaten erhalten denselben Sitzungsbezug und Bildhash; vor jeder Verbindung werden die eigenen Prozesse erneut geprüft. Asynchrone Lade-/Speichervorgänge bis zum beobachteten Endzustand prüfen; eine kurze Wartezeit beweist keinen Abschluss. Dateidialoge mit Verzeichnis im Feld `Path` und einfachem Dateinamen in `File` bedienen.

Nur die eigene Sitzung beenden: eine Datei `stop` im exakt dokumentierten Laufverzeichnis anlegen und den Starter bis zum Ende abwarten. Alternativ das Original über seine Oberfläche schließen: nur ein Prozessende mit Code 0 bei weiterhin laufender Anzeige gilt als normaler Ausgang und wird als `originalExit` erfasst. `session.json` muss danach `stopped` melden; ein Fehler oder erzwungener Stop wird separat festgehalten. Keine fremden Prozesse beenden. Ältere Sitzungen, deren vollständig beendeter UI-Ausgang noch als `Original/display exited before explicit stop` erfasst wurde, dürfen ebenfalls eine Profilquelle sein. Ihr Fehlerstatus wird unverändert in `profileSource` mitgeführt und gilt nicht nachträglich als bestandene Abschlussprobe.

Bei verzögerter Originaldarstellung kann `rfb.mjs --settle-ms 1800` die Pause vor der Aufnahme verlängern (100–5.000 ms). Die tatsächliche Pause wird im Framebeleg gespeichert. Bei unklarem Übergangsbild zusätzlich einen Frame ohne Eingabe aufnehmen; weder eine feste Pause noch der Dateiname belegt den stabilen Endzustand.

Paketverzeichnis und Katalog prüfen:

```sh
node tools/wonderdraft/inventory.mjs acceptance.json /ABSOLUTER-LAUF/package-inventory.json
node tools/wonderdraft/validate-inventory.mjs acceptance.json --allow-open
node tools/wonderdraft/validate-inventory.mjs acceptance.json --require-complete
```

Die erste Prüfung ist ausschließlich ein Pakethinweis. Die zweite prüft Zuordnungen und Bildprovenienz, **keine visuelle Vollständigkeit**. `--allow-open` erlaubt einen Teilstand, ohne das Tor zu schließen. Der Standardaufruf und `--require-complete` bleiben erfolglos, solange das Tor beziehungsweise Inventurlücken offen sind. Sichtbare Optionen schließen keine Wirkungsprobe. Synthetische Originaleingaben, Obsidian-Hostprüfung und physische Eingabe bleiben getrennte Nachweise. Fehlende lokale Belegdateien führen zum Fehler; ein frisch geklonter Katalog ohne den externen QA-Bestand darf keine Direktabnahme vortäuschen.

`mapped_surface_role` klassifiziert eine Paketrolle anhand des Pfadnamens und direkt beobachteter Originaloberflächen. `classificationBasis` nennt diese Schlussfolgerung ausdrücklich; sie behauptet keine instrumentierte Codezuordnung. Mehrdeutige oder noch unbeobachtete Rollen bleiben `pending`. Der eigene Fachreview muss diese Einordnung und die Oberflächenabdeckung prüfen. Zusätzliche `contextObservations` und `surfaceObservations` ergänzen bestehende Kennungen, ohne daraus eine vollständige Originalfolge abzuleiten.

Aus anderen GitHub-Arbeitsständen übernommene `original_gui_screenshot`-Belege mit `session.txt` bleiben erhalten. Selbst vorhandene Bilder dieses Belegtyps bleiben bis zur ergänzenden Prozess-/Frameprüfung offen; fehlende Dateien ergeben Fehler. Neue Messungen verwenden vollständige JSON-Sitzungs-/Framebelege mit Hashes. Der aus dem Repo übernommene `session.sh` bleibt als vorhandener Starter erhalten; für diese Messserie wird der dokumentierte JSON-Starter verwendet. Übernommene Kennungen werden nicht umnummeriert.

Dungeon-Ausgangsprüfung nacheinander mit demselben bestehenden Harness: `bash tools/run-host.sh --hex00-baseline`, danach mit `--restart`; `DUNGEON_PLUGIN_ROOT`, `DUNGEON_SOURCE_VAULT` und `DUNGEON_QA_ROOT` ausdrücklich setzen. Der Fall prüft V4-Raum, Eingang mit Raumkennung, Key-Änderung, Undo/Redo und exaktes Save/Reopen im isolierten Vault.

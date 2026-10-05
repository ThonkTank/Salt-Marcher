# DD-001.04: Erste Datei und History im Original

Direktprüfung am 05.10.2026 in einem isolierten Dungeondraft-1.2.0.1-Prozess ohne Mods und Custom-Pakete. Originalkennung aus dem erzeugten Kartenheader: `1.2.0.1 opulent kirin`. Binärdatei SHA-256 `9670325214d744194511d3ce731e910594b75e373928d95ca9e97ea30a769438`, PCK `f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60`. Der Test lief auf Display `:12` mit eigenem XDG-Profil. Nur der QA-Zielpfad wurde über einen protokollierenden Dateidialoghelfer vorgegeben. Der Grafikprozess und Xvnc wurden mit `exit_status=0` beendet; der Slot wurde freigegeben.

Belegordner: `qa/dd001002/native-first-save/dd001-native-20261005-184804/evidence/`. Darin liegen die unten genannten PNGs und die erzeugte Originalkarte. `original.sha256`, `zenity-calls.log` und `cleanup.txt` liegen im übergeordneten Laufordner.

| Schritt | Direkte Beobachtung | Beleg |
| --- | --- | --- |
| New → Breite 8, Höhe 8 → OK | Sichtbare 8×8-Karte, Save aktiv, Undo/Redo aus. Im isolierten Lauf noch keine `.dungeondraft_map`; der Dateidialoghelfer war noch nicht aufgerufen. | `04-size-corrected.png`, `06-ready.png` |
| Light Tool → ein Licht auf Karte setzen | Beleuchtete Kartenfläche; Undo aktiv, Redo aus. Noch keine Kartendatei. | `10-light-unsaved.png` |
| Undo vor erstem Save | Lichtwirkung verschwindet; Undo aus, Redo aktiv. Noch keine Kartendatei. | `11-undo-before-save.png` |
| Redo vor erstem Save | Lichtwirkung kehrt zurück; Undo aktiv, Redo aus. Noch keine Kartendatei. | `12-redo-before-save.png` |
| Erster manueller Save | Genau ein Dialogaufruf mit `--save --confirm-overwrite`; danach erstmals `dd001-created.dungeondraft_map`, 22.936 Byte. JSON: `world.width=8`, `world.height=8`, genau ein Licht in Ground. Datei SHA-256 `c7ed10074b1f341668ab24be2cee582338c20f8c090bca7189f150dfd3337296`. | `13-after-first-save.png`, `dd001-created.dungeondraft_map`, `zenity-calls.log` |
| Undo nach erstem Save | Der **vor dem Save erzeugte Lichtschritt** bleibt erreichbar und wird sichtbar zurückgenommen. Redo aktiv. Gespeicherte Kartendatei bleibt bytegleich (`c7ed1007…`). | `14-undo-after-save.png` |
| Redo nach erstem Save | Lichtwirkung kehrt zurück, Undo aktiv. Gespeicherte Datei bleibt weiterhin bytegleich. | `15-redo-after-save.png` |

Die PNGs `10`, `12` und `15` haben denselben SHA-256-Wert `fcb7a376cbb5b056c914fc31b0107b12b8190aebc9e8ddb4640e95277b21125c`; `11` und `14` haben denselben SHA-256-Wert `b89b88ccb0ac6636aba5241f06365b384f4e0a529d7fffa80fc02dcebbafdb37`. Das belegt die sichtbare Rückkehr der jeweiligen Zustände ohne eine neue Datei. Die gespeicherte Karte enthält ein Lichtobjekt mit `node_id=0`, `range=5`, `intensity=1`.

## Enges Zielverhalten und Umsetzung

Eine neue Karte muss vor dem ersten manuellen Save im Editor sichtbar und bearbeitbar sein, ohne eine normale `.dungeon`-Kartendatei anzulegen. Undo/Redo muss in diesem ungespeicherten Zustand funktionieren. Das erste Save wählt einen Dateipfad und schreibt den aktuellen Zustand. Der vor Save entstandene Undo-Schritt muss **über den ersten Save hinweg** erreichbar bleiben; Undo/Redo allein darf die gespeicherte Datei nicht automatisch überschreiben. Für den Obsidian-Editor erfordert dies einen ungespeicherten Karten-View/Draft und eine Übergabe derselben Session samt History an den dateigebundenen View beim ersten Save. Der bestehende Ablauf `create()` → `repository.save()` → `openFile()` erfüllt diese Regel nicht. Der detaillierte Schnittstellenvorschlag steht in `DD-001-04-UNSAVED-ARCHITECTURE.md`.

## Bewusste Beweisgrenzen

Für die History-Probe wurde ein Licht statt des im Prüfplan vorgesehenen Objekts verwendet, weil es im Original direkt erreichbar und seine Kartenwirkung eindeutig sichtbar war. Sie belegt History und Erstsave für diesen Kartenedit, keine Gleichwertigkeit aller Werkzeugklassen. Ein frischer Prozess mit Öffnen der Karte wurde in diesem begrenzten Lauf nicht geprüft; der gespeicherte JSON-Inhalt ist jedoch direkt geprüft. Interne Wiederherstellungs- oder Konfigurationsdateien sind keine normale Kartendatei und wurden nicht als vollständig ausgeschlossen behauptet. Verhalten bei Abbruch des ersten Dateidialogs, Namenskonflikt und Programmabsturz bleibt offen.

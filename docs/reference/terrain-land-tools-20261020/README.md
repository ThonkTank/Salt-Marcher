# R2: drei gemeinsame Landwerkzeuge · 20.10.2026

Umgesetzt: Land formen (Richtung, Stärke, Roughness, optionale Zielhöhe), Land bemalen (Malen/Radieren) und Glätten. Geländedaten bleiben separat erreichbar. Alle Geländeänderungen verwenden denselben Höhenkern für Vorschau und Speicherung; kein separates Landmalwerkzeug. Größe und Stärke von Formen/Glätten bleiben getrennt. Höhen, Farbschichten und Format 49 bleiben erhalten.

Der erste native Start scheiterte während hoher Hostauslastung vor einer Werkzeugaktion am 30-Sekunden-Startwait. `startup-timeout/result.json` und `startup-timeout/failure.png` bewahren diesen Befund. Er belegt keine Pinselwirkung. Der zweite Lauf (`result.json`) erreichte den Atlas, scheiterte aber beim Zugriff auf die Ortssuche, noch vor einer Pinselaktion. Beim anschließenden Hostcheck waren etwa 1,2 GB RAM verfügbar und 8 GB Swap vollständig belegt. Das ist Kontext, kein bewiesener kausaler Befund. Für diese beiden frühen Fehlversuche wird kein erfolgreicher regulärer Abschluss behauptet; die erfolgreiche Nachprüfung steht unten.

Keine Main-/Candidate-CI-Integration, Paketprüfung oder Installation dieses Arbeitsstands. Historische R0–R2-Belege bleiben unverändert.


## Automatisierte Prüfung

104/104 Fälle bestanden mit:

```sh
node --test --test-concurrency=1 tests/desktop-atlas-tool-hierarchy.test.mjs tests/terrain-brush.test.mjs tests/terrain-height.test.mjs tests/desktop-land-color-separation.test.mjs tests/desktop-atlas-travel-context.test.mjs tests/desktop-atlas-measurements.test.mjs tests/desktop-atlas-canvas.test.mjs
```

Prüfinhalte: genau drei Landrouten und eigene Geländedatengruppe; angenommene/abgelehnte Werkzeugwechsel; getrennte Größe/Stärke; Zielhöhe optional und richtungstreu (einschließlich 0 und bereits jenseits der Grenze liegendem Gelände); deterministische Roughness ohne Richtungswechsel; wenig/viele Pointer-Samples; Vorschau und Ergebnis; Glättung; geschützte feine Höhen; Speicherfehler, History, erneutes Öffnen, Farbradierung, Einheiten und Canvas/Exportregressionen.

`npm run check`, `npm run check:desktop`, `npm run build:desktop`, `npm run check:repo` und `git diff --check` bestanden. Die Repositoryprüfung lief nach Anlegen dieser Belegdatei erfolgreich; der vorherige Lauf meldete nur die zu diesem Zeitpunkt noch fehlende Datei.

## Vollständigkeit und Zielabgleich

Die vereinbarte Bedienung ist implementiert. Die alte Landmalroute ist aus der aktiven UI entfernt, die neue UI verwendet ausschließlich `landscape-height-stroke` für Formänderungen. Historische Backendoperationen bleiben für bestehende Tests/Verträge verfügbar; es gibt keine neue Speicherung oder Migration. Die native Probe wurde auf Inselerzeugung durch Land formen sowie Farbe/Radierung erweitert. R1-Probe und Landaktion der Layoutprobe wurden umgestellt, in diesem Durchlauf aber nicht nativ qualifiziert. Nächster Prüfschritt: die aktualisierte native Probe auf einem ausreichend freien Host vollständig ausführen. R3–R7 bleiben unverändert offen.

## Fortsetzungsprüfung

Der erneute Hostcheck ist in `host-recheck.json` festgehalten. Die früheren Probeprozesse waren beendet; bei weiterhin nahezu vollständig belegtem Swap und rund 1 GB verfügbarem RAM wurde kein weiterer Electron-Lauf gestartet. Die fehlende native Qualifikation bleibt ausdrücklich offen. Der aktuelle Roadmaptext wurde zusätzlich unter `/tmp/saltmarcher-terrain-roadmap-20261020.md` bytegleich gesichert; die ursprüngliche temporäre Roadmap bleibt erhalten. Der Phasenstatus unterscheidet jetzt den erfolgreich geprüften ursprünglichen R2-Stand von der noch nicht nativ qualifizierten Bedienvereinheitlichung.


## Native Nachprüfung nach Ressourcenreparatur

`resource-recovery-run/result.json`: zehn Prüfschritte bestanden, `ok=true`, `normalExit=true`, keine Rendererfehler. Prüfung durch `tools/ui-session.py` mit 180 Sekunden Zeitgrenze und SSD-basiertem isoliertem Profil. Insel, Hügel, Zielhöhe, Tal/Küste, Glätten, Farbe/Radierung, Undo/Redo, Abbruch, tatsächlicher Schreibfehler/Wiederholung, PNG und frischer Prozess funktionierten im aufgezeichneten Desktopbuild. Der Wrapper hinterließ keine Testprozesse. Die Ressourcenblockade ist damit beseitigt.

Beim abschließenden Hashvergleich waren alle Laufzeitbundles unverändert, aber mehrere Quelldateien inzwischen durch parallele Arbeit geändert. Die konkrete Liste steht im nachgelagerten Hashvergleich. `post-run-source-check.json` hält diese Abweichung fest. Der erfolgreiche Lauf qualifiziert den aufgezeichneten Build; er ist keine Aussage über diese nachträglichen Quelländerungen. Vor dem Phasenabschluss des aktuellen gemeinsamen Arbeitsstands müssen diese Änderungen berücksichtigt und der passende Build geprüft werden. Frühere Fehlversuche bleiben erhalten.

## Abschluss auf isoliertem Quellstand

Die nach der Ressourcenreparatur angelegte Arbeitskopie `terrain-r2-qualification` enthält den gemeinsamen Quellstand vom 20.10.2026, 08:58 UTC auf Basis `e80b3bfb74673a8c08b6f896fc21522e4eb9e036`. Ein bei der Typprüfung gefundener unvollständiger Vegetations-Bereichsdatensatz wurde mit den erforderlichen Pflichtfeldern vervollständigt. Die Kopie blieb während der Prüfung stabil; `current-snapshot/qualification.json` dokumentiert die abschließenden Dateihashes und die Änderung gegenüber der Kopie.

104/104 automatisierte Fälle, beide Typprüfungen, Desktop-Build und Repositoryprüfung bestanden. `current-snapshot/result.json` belegt zehn erfolgreiche native Prüfschritte, regulären Abschluss und keine Rendererfehler. Alle 30 aufgezeichneten Quell-/Bundlehashes wurden danach unverändert bestätigt. Die Screenshots zeigen Landformen, Höhenlinien und Farbe; nach dem Neustart prüft der Ablauf gespeicherte Höhen, während das Fenster zunächst wieder den Referenzraum zeigt. Die Probe hinterließ keine eigenen Prozesse.

Damit ist die R2-Bedienvereinheitlichung auf diesem eingefrorenen Stand lokal automatisiert und nativ qualifiziert: Erhöhen/Absenken, Stärke, Roughness, optionale Zielhöhe, separater Farbpinsel samt Radierung und Glätten; außerdem Vorschau, Abbruch, atomare History, Schreibfehler/Wiederholung, Export und erneutes Öffnen. Parallele Vegetationsarbeit ist dadurch nicht insgesamt qualifiziert. Spätere Änderungen im gemeinsamen Arbeitsverzeichnis, Main/Candidate-CI, Pakete und Installation sind nicht Teil dieses Nachweises. R3–R7 bleiben offen; R3 ist die nächste eigenständige Phase.

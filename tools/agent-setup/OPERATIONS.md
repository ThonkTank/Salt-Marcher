# Vorhandenen nativen UI-Zugang verwenden

PROJECT.json führt Launcher, qa_adapter, privaten Window Manager und qa_stdio_example. Diese vorhandene Bedienhilfe weiterverwenden; keine neue allgemeine Infrastruktur. Vor GUI-Arbeit tatsächliche eigene Jobs/Ressourcen prüfen. Eigene Profile, Arbeitsdateien und identifizierte Originalbuilds verwenden; fremde Prozesse und Daten schützen.

Aus dem lokalen qa-program in einem geschützten QA-Job starten (Beispiel für den Standard-Installationspfad; maßgeblich ist launcher in PROJECT.json):

```sh
"${HOME}/.local/bin/codex-dungeon-job" qa -- bash scripts/run-ui.sh EIGENE-SESSION EIGENER-LOGORDNER
```

Der Helper startet Service und Clients im selben Prozessbaum und liest den Adapterpfad aus PROJECT.json. JSON-Aufträge oder @REQUEST.json-Dateiverweise über seine Standardeingabe schicken. Lange Aufträge über Dateien senden; auch die letzte nichtleere Eingabe ohne Zeilenumbruch bleibt erhalten. Kein zusätzlicher ungeschützter Service-/Clientstart.

launch benötigt eigenes profile, tatsächliche argv/identity_files und attempt_id; erwartete Buildhashes können angegeben werden. Für input/observe braucht der bestehende Adapter einen technischen Run über begin mit eigener run_id, manifest und passendem task_id aus manifest.expected_tasks. Das ist Bedienzustand des vorhandenen Recorders, keine Studienregistrierung oder Bewertungspflicht. Der vorhandene begin/resume/input/observe-Weg bleibt unverändert; tatsächliche Antworten prüfen und fehlende Antworten nie durch blindes Wiederholen von Eingaben beantworten.

Der isolierte Desktop ist X11. Bei den bestehenden Electron-/Obsidian-Starts --ozone-platform=x11 verwenden; keine ungeprüften Sandbox-/GPU-Abschaltungen. Private WM-Bibliotheken nicht an Produktprozesse vererben. Normale sichtbare UI einschließlich Fenster und Dateidialogen nutzen.

Vor Jobende über die normale UI speichern/schließen. Tatsächlichen Produktabschluss per close_receipt prüfen; end oder checkpoint löst den Recorder, danach stop und JOB_EXIT. Nur ein tatsächlich normaler Abschluss ist normal; Unterbrechungen bleiben als solche erhalten. Bei eigener Fortsetzung vorhandenen Run/Profil/Build über resume verwenden. Lange Arbeit an natürlichen Save/Close-Grenzen fortsetzen, ohne fremde Jobs anzuhalten.

Automatisch entstehende Spuren erhalten. Für den Arbeitsbericht genügen passende Screenshots/Ergebnisdateien und tatsächlich geprüfte Versionen. Keine vollständigen Audits, Messmanifeste oder neue Qualifikation als zusätzliche QA-Aufgabe; technische Altimports und Originalbelege bleiben an ihrem Ort.

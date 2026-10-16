# ChatGPT und Chat-Steuerung bei Speichermangel erhalten

`chat-protection.py` läuft als kleiner root-Dienst. Alle 250 ms ermittelt er
für die konfigurierte Benutzer-ID die tatsächlichen Prozesse der installierten,
root-eigenen `/usr/lib/chatgpt/ChatGPT`- und
`/usr/lib/chatgpt/resources/codex`-Binärdateien. Bei Codex sind nur `app-server`
und `exec-server` geschützt, bei Electron keine `ELECTRON_RUN_AS_NODE`-Arbeiter.
Diese Prozesse erhalten `oom_score_adj=-1000`. Andere Prozesse in denselben
Gruppen sowie ihre Arbeitsnachfahren erhalten `1000` und dürfen abgeschossen
werden. Ein offener `/proc`-Verzeichnishandle verhindert Zugriffe auf einen
inzwischen wiederverwendeten PID. Rücknahme prüft zusätzlich die Startzeit.

Die betroffenen systemd-Service-/Scope-Units bekommen ein temporäres Drop-in
mit `OOMPolicy=continue` und `ManagedOOMPreference=omit`. Das erste verhindert,
dass ein getöteter Arbeiter den Rest der App-Unit mit beendet. Das zweite nimmt
die Unit aus der Auswahl von systemd-oomd. Kein Prozess wird vom Dienst aktiv
beendet. Es gibt keine Speicherbudgets, Slots oder Ressourcen-Warteschlangen.
App, Agenten und Werkzeuge laufen weiter als normaler Benutzer.

## Installation

Die drei Python-Dateien in diesem Verzeichnis zusammen aufbewahren. Mit der
tatsächlichen UID des Desktop-Benutzers ausführen:

```sh
pkexec /usr/bin/python3 -B tools/install-chat-protection.py install --uid "$(id -u)"
```

Der Installer legt ausschließlich root-eigene Dateien unter
`/usr/local/lib/codex-chat-protection`, eine systemd-Unit unter `/etc/systemd/system`
und Wiederherstellungsdaten unter `/var/lib/codex-chat-protection` an. Er startet
den Dienst ohne App-Neustart und prüft anschließend in einer wegwerfbaren
96-MiB-cgroup: Ein geschützter Steuerprozess bleibt erhalten, sein Arbeiter wird
vom Kernel wegen OOM beendet. Der Hostspeicher wird dabei nicht ausgeschöpft.
Erst danach entsteht `/run/codex-chat-protection/UID-accepted.json`.

Vor Entfernen alter Grenzen sowohl diesen Beleg als auch die aktuellen Scores,
Unit-Eigenschaften und die lokale oomd-Überwachung prüfen. Bei Fehlschlag die
bisherige Schutzkonfiguration erhalten. `verify` und `oom-test` sind weitere
Installer-Aktionen. `systemctl status codex-chat-protection@UID` zeigt den Dienst;
`/run/codex-chat-protection/UID-status.json` enthält seinen aktuellen Zustand.

## Rücknahme

```sh
pkexec /usr/bin/python3 -B tools/install-chat-protection.py uninstall --uid "$(id -u)"
```

Das entfernt ausschließlich den Dienst und seine Drop-ins und stellt die
ursprünglichen Scores noch lebender Prozesse wieder her. Gelöschte alte
Ressourcenlimits werden nicht stillschweigend wieder eingeführt; deren gesicherte
Dateien bei Bedarf separat wiederherstellen.

## Grenzen und Pflege

Die Überwachung reagiert nach Prozessstarts und Electron-Scoreänderungen; sie
ist keine lückenlose Startgarantie. Langsame systemd-Antworten können einen Scan
verlängern; die tatsächliche Dauer steht im Status. Programmfehler, manuelle
Abschüsse und ein insgesamt nicht mehr arbeitsfähiges Betriebssystem sind damit
nicht ausgeschlossen.

`ManagedOOMPreference` hängt von der cgroup-Eigentümerschaft ab: Für
Speicherdruck berücksichtigt oomd Benutzer-Units, wenn der überwachte Vorfahr
demselben Benutzer gehört; für Swap-Auswahl nur root-eigene cgroups. Auf diesem
Rechner überwacht oomd den Benutzer-Manager und seine Benutzer-Slices, ohne
Swap-Monitor. Änderungen daran erfordern eine neue Prüfung; nicht pauschal alle
Benutzerprozesse von oomd ausnehmen oder cgroup-Eigentümer umschreiben.

Nach einer Änderung der installierten App-Pfade die beiden Konstanten prüfen.
Der Dienst verifiziert Unit-Eigenschaften alle zehn Sekunden und protokolliert
Schutzfehler. Prozesse, die unter OOM sterben, müssen vom zuständigen Agenten
effizienter gestaltet werden; kein unveränderter Wiederholungsstart.

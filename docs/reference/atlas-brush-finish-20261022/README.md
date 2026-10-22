# Pinselabschluss unabhängig von feinen Farben

Lokaler Fortschritt nach `43f6429cb` auf
`codex/atlas-bounded-terrain-history`. Keine Main-/Release- oder
Pentium-Abnahme.

## Gemessene Ursache

Eine neue optionale Diagnose im vorhandenen nativen Pinselwerkzeug zeichnet
Main-Zeitmarken und Terrainworker-Antworten auf. Die Uhrzeiten unterschiedlicher
Prozesse werden nicht voneinander abgezogen. Workerereignisse liefern eigene
Stufendauern; deren verschachtelte Werte dürfen nicht addiert werden.

Die [Vorherdiagnose](before-stages.json) zeigt nach dem Loslassen:

1. Noch ausstehende bestätigte Höhen-/Farbübersichten endeten bei etwa 1,98 s.
2. Danach lief die feine Farbverfeinerung der letzten Revision bis etwa 3,69 s.
3. Erst anschließend begann die Objektbereichsaktualisierung; sie endete bei
   etwa 4,63 s. Die Werkzeuge wurden nach insgesamt 5,24 s freigegeben.

`TerrainPresentation.finish()` wartete auf die gesamte Farbverfeinerung,
obwohl die erste bestätigte Antwort bereits die vollständigen Höhen und eine
zusammenhängende Farbübersicht enthielt. Diese Wartezeit lag damit auf dem
kritischen Pfad des nächsten Pinselzugs.

## Änderung und Schutzregeln

Der bestätigte Höhen-/Übersichtspfad bleibt ein einzelner laufender Auftrag mit
einem zusammengefassten neuesten Nachfolger. Feine Farben laufen unabhängig
davon mit der bestehenden niedrigen Workerpriorität. Neuere bestätigte
Übersichten und der Pinselabschluss warten nicht darauf. Vor Freigabe wartet
der Abschluss weiterhin auf die letzte angeforderte vollständige Höhenantwort;
Speichern und Objektbereichsaktualisierung behalten ihre bisherigen Grenzen.

- Eine feine Antwort darf nur die weiterhin passende Ausgangsantwort ergänzen
  und keine neuere angeforderte Revision überschreiben. Antworten und Fehler
  nach Ende oder Abbruch des Pinselzugs werden verworfen.
- Jede grobe Teilantwort wird auf genau ihre angeforderte Basis angewendet.
  Ein zwischenzeitlich eingetroffenes Detailbild ist keine Ersatzbasis. Das gilt
  auch bei unveränderter angeforderter Revision und einer inzwischen neueren
  bestätigten Antwort aus Main.
- Eine bestätigte interaktive Farbübersicht markiert die normale Detailstufe als
  noch ausstehend. Nach Ende des Pinselzugs setzt der normale Atlas seine
  Verfeinerung fort, auch wenn der Zug die gespeicherten Daten nicht verändert hat.
- Der bestehende Region-/Kamerauftrag ersetzt ausstehende niedrig priorisierte
  Verfeinerung im Worker. Es gibt keine zweite Karte, neuen Renderer, neuen
  Schreibpfad oder dauerhaft parallel gehaltene Quelldatenbank.

## Prüfungen

[43 lokale Regressionen](tests.json) bestehen. Neue Fälle prüfen Ende vor bzw.
während einer Verfeinerung, verspätete Antworten und Fehler, sofortige neuere
Höhenaufträge, unveränderte Revisionen, die Teilantwort-Basis und Wiederaufnahme
der normalen Detailstufe. Vorhandene Fälle decken Writerabschluss,
Quellenwechsel, geschlossene Gesten und Workerpriorität ab.

Die [Nachherdiagnose](after-stages.json) bestätigt die entfallene Abhängigkeit:
Nach der letzten vollständigen Höhenantwort bei etwa 2,26 s beginnt der
Objektbereich schon bei 2,31 s. Es gibt davor keine abschließende feine
Farbverfeinerung mehr. Die Werkzeugfreigabe erfolgte in diesem instrumentierten
Lauf nach 4,30 s. Andere Arbeitsschritte waren langsamer als in der
Vorherdiagnose; die entfernte 1,7-s-Abhängigkeit wird deshalb nicht als gleicher
pauschaler Ende-zu-Ende-Gewinn ausgegeben.

Die Zusammenfassungen enthalten Artefakthashes, Prozessabschluss, Zeitmarken,
zusammengefasste Workeraufträge und die Hashes/Pfade der vollständig erhaltenen
Rohmessungen unter `.build/`. Alle Diagnosepuffer meldeten null verworfene
Einträge. Reproduktion mit einer erhaltenen synthetischen Prüfwelt:

```sh
python3 tools/ui-session.py timeout --signal=TERM 240s env \
  SALTMARCHER_TERRAIN_TRACE=1 \
  BACKUP_PROBE_SOURCE=/pfad/zur/synthetischen/workbench.sqlite \
  QA_EVIDENCE_DIR=.build/brush-stage-diagnostic \
  node tools/measure-desktop-backup-impact.mjs
```

`BACKUP_WAIT_DETAIL=1` prüft zusätzlich nach der Werkzeugfreigabe die vollständige
normale Detailverfeinerung. Diese Wartezeit wird getrennt erfasst und nicht zur
Werkzeugfreigabe gerechnet. Instrumentierte Einzelbeobachtungen sind keine
p95-Verteilung, erste sichtbare Pinselreaktion oder Zielgeräteprüfung.

## Normale Bedienprobe und tatsächliche Folgebereitschaft

Die Läufe ohne zusätzliche Stufentraces verwendeten denselben 2.500-Meilen-Pinsel
und dieselbe gemischte Prüfwelt. Sie behielten die bisherige CPU-Profilerfassung
des Prüfwerkzeugs; es lief keine eigene parallele Build-/Testlast.

| Beobachtung | Ergebnis |
| --- | ---: |
| Bedienelemente nach Loslassen, [erster Lauf](native-brush.json) | 3,618 s |
| Bedienelemente, [Bereitschaftsprobe](native-readiness.json) | 3,791 s |
| Bedienelemente, [Probe mit tatsächlichem Folgezug](native-repeat.json) | 3,570 s |
| Terrain und Objektcanvas für Folgezug bereit | 5,121 s |
| abgeschlossene 36 Detailkacheln, einzelner erster Lauf | 18,380 s nach Loslassen |

Die vorausgehende [normale Prüfung](../atlas-grid-scheduling-20261022/native-brush.json)
benötigte 5,906 s bis zur Freigabe der Bedienelemente. **Das ist nicht derselbe
Messpunkt wie die Bereitschaft für den nächsten Pinselzug.** Bei Freigabe zeigte
der Atlas bereits die bestätigte Revision 10, stand aber noch auf `loading` und
`interactive`. Die erneut angeforderte normale Terrainquelle benötigt weitere
rund 1,5 s. Für den älteren Stand wurde dieser zweite Messpunkt nicht erfasst.

Die Folgezugprobe wartete auf aktuelle Terrainrevision, freigegebenes Werkzeug,
bereiten Objektbereich und geladenen Canvas. Sie begann dann einen weiteren
250-ms-Sculpt-Zug, während die Karte noch `overview` zeigte. Dieser Zug wurde
angenommen und bestätigt: Revision 10 → 12. Anschließend erschien die
vollständige Detailstufe mit 36/36 Kacheln auf Revision 12. Die
[nach normalem Prozessende gelesene SQLite-Wurzel](persisted.json) bestätigt
ebenfalls Revision 12. Reproduktion ergänzt `BACKUP_REPEAT_STROKE=1` und
`BACKUP_WAIT_DETAIL=1` zum oben genannten Befehl; für die normale Messung entfällt
`SALTMARCHER_TERRAIN_TRACE`.

Alle nativen Prozesse endeten normal mit Code 0, waren danach verschwunden und
meldeten keine Rendererfehler. Alle vier Nachherläufe verwendeten dieselben elf
Build-Artefakte. App-/Desktop-Typprüfung, Desktop-Build und Repositoryprüfung
bestanden. Die [gesichtete Anzeige nach dem Folgezug](after-repeat.png) ist eine
synthetische Belastungskarte, keine gestalterisch abgenommene Fantasykarte.

Der erneute Aufbau der normalen Terrainquelle trotz bereits bestätigter
vollständiger Höhen bleibt als konkrete Verzögerung offen. Auch die weiterhin
0,5–0,8 s langen Liveübersichten, die erste Öffnung, p95-Pinselreaktion unter
100 ms, die Pentium-/Intel-UHD-Prüfung und der vollständige Autorenablauf sind
durch diesen Schritt nicht abgeschlossen.

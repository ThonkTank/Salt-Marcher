# Gestufte Anzeige bestätigter Terrainzüge

Ein großer Pinselzug wartete bislang auf die vollständige Übersicht und den
feinen Farbausschnitt, bevor neue Höhen sichtbar wurden. Der normale Atlas
veröffentlicht nun zuerst dasselbe vollständige Höhenraster mit höchstens
64×64 Farbpixeln für Übersicht und Pinselbereich. Die Farben werden aus dem
zugehörigen gespeicherten Gelände berechnet, einschließlich Wasser und Bewuchs.
Die ursprüngliche Farbauflösung folgt über unterbrechbare Workerabschnitte.
Neue Autoren-, Kamera- und Live-Anfragen haben Vorrang. Geometrie, Speicherauflösung
und Undo-Vertrag bleiben erhalten.

`TerrainPresentation` erlaubt die feinere Ausgabe derselben Quellenrevision,
verwirft überholte Antworten und wartet beim Gestenabschluss auf die letzte
angeforderte Ausgabe. Der Worker teilt dafür den vorhandenen Projektionskern;
keine zweite Datenbankkopie oder zusätzliche Renderer-Implementierung entsteht.

## Prüfung

23 gezielte Prüfungen bestanden: `terrain-presentation`,
`terrain-projection-service`, `terrain-commit-display` und `terrain-frame-delta`.
Die neuen Fälle prüfen unveränderte Höhen, feinere Ausgabe derselben Revision,
Verdrängung durch neue Eingaben, Fehler, Abschluss und Übereinstimmung der
fertigen Verfeinerung mit einer unabhängigen kalten Abfrage. Beide
TypeScript-Prüfungen, Desktopbuild und Repositoryprüfung bestanden.

Die native Probe verwendet den normalen Atlas, 3.076 Gelände-/Wald-/Straßenrecords
und einen 2.500-Meilen-Pinsel. Host: i5-8365U/Intel UHD 620, 1440×900, DPR 1;
Profiler und Traces aktiv, keine eigenen parallelen Builds oder Tests.
[Messwerte und Prozessnachweise](world.json), [fertiges Detailbild](world-sculpt.png).
Die regelmäßigen Waldrechtecke sind synthetische Lastdaten, keine Städte.

| Messung | Bisheriger Build | Gestufte Ausgabe, drei Läufe |
| --- | ---: | ---: |
| Erste bestätigte Anzeige | 1.618 ms | 1.345 / 1.407 / 1.502 ms |
| Erste Live-Bildberechnung im Worker | 911 ms | 592 / 710 / 783 ms |
| Navigation RAF p95 | 49,3 ms | 39,6 / 41,5 / 42,5 ms |
| Pinsel RAF p95 | 20,6 ms | 25,1 / 24,2 / 24,4 ms |

Alle vier Prozesse endeten normal mit Exit 0; ihre PIDs sind beendet und die
Renderer meldeten keine Fehler. Der abschließende Lauf prüft zusätzlich die
Folge `interactive → detail` und wartet nach der normalen Atlasaktualisierung
auf die vollständig nachgeladene Detailstufe. GPU-Orakel für Hexraster,
Höhenlinien und Detailmaterial bestanden. Der bisherige Build ist byteidentisch
zu den fünf Artefakten der zuvor bestandenen unabhängigen Gebäudeprobe; die
neuen Läufe verwenden den uncommitteten Folgestand auf `c57254184`.

Reproduktion nach `npm run build:desktop`:

```sh
SALTMARCHER_TERRAIN_TRACE=1 WORLD_POPULATED=1 WORLD_PROGRESSIVE=1 \
QA_EVIDENCE_DIR=.build/world-navigation-progressive \
python3 tools/ui-session.py timeout --signal=TERM 240s \
node tools/test-desktop-world-navigation.mjs
```

## Weiter offen

Die Verbesserung erreicht keine unmittelbare Bearbeitung. Das Ziel von höchstens
100 ms bis zur tatsächlichen Bildänderung ist deutlich verfehlt. Auch
Navigationsintervalle bleiben zu lang; RAF und Revisionsmutationen allein
qualifizieren keine Eingabe-bis-Pixel-Latenz. Die Messungen schwanken und sind
keine statistische Leistungsabnahme. Die erste Ausgabestufe ist absichtlich
grob; hohe Bildschärfe entsteht erst durch die nachgelieferten Details.

Vorbereitung, Schreiben und Darstellung müssen weiter entkoppelt werden. Die
vollständige Zielwelt, der Pentium Gold 7505 und eine natürlich gestaltete
Fantasykarte sind hier nicht qualifiziert. Der Gesamtauftrag bleibt offen.

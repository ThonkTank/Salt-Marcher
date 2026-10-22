# Ein gemeinsamer Takt für direkte Höhenvorschau und Schreiben

22.10.2026. Anschluss: [gemeinsamer Atlas P0/P5/P8](../../plans/maps/unified-spatial-atlas.md),
Gelände R7 / HEX-06, HEX-08, HEX-16. Normaler Electron-Atlas auf Fedora/Wayland,
Intel i5-8365U / UHD 620. Keine Pentium-7505- oder vollständige Produktabnahme.

## Ausgangsbefund und Entscheidung

Die [begrenzte Eingangsprojektion](../atlas-scoped-entrances-20261022/README.md)
reduziert Weltantworten, beseitigt aber die langsame Pinselreaktion nicht.
Im vorherigen asynchronen Lauf wurde die erste geänderte Pinselinnenfläche nach
186,6 ms auslesbar. Das ist eine Messung der GPU-Verfügbarkeit mit Messaufwand,
keine genaue Displaylatenz.

Drei Ansätze wurden betrachtet: Vorschau und Schreiben über denselben
Animationsschritt koordinieren; einen vollständigen GPU-Pinsel aufbauen;
oder während des Malens die Auflösung senken. Der GPU-Pinsel bietet mehr
Entlastungspotenzial, benötigt aber neue Verträge für Vorschau, Verdeckung und
kanonischen Abschluss. Weniger Auflösung gefährdet sichtbare Details. Der gemeinsame
Takt trifft eine konkret gemessene Doppelarbeit ohne Änderung der Darstellungsqualität.

Der normale Atlas wurde mit zusätzlichen Methodenmessungen gebaut. Die Messung
vermerkt den echten `requestAnimationFrame`-Zeitstempel, Aufrufbesitzer und
WebGL-Zeicheneinreichungen. Sie zeigt beim ersten Pinselbild zwei Höhenzeichnungen
im selben Animationsschritt: einmal über `tickLive → sampleLive → previewHeight`,
danach über den eigenen Vorschautakt. Der zweite Aufbau kostet in beiden
Pinselstarts etwa 10 ms. Daneben existieren weiterhin andere Zeichnungen,
beispielsweise für die Hilfsebene; diese Änderung beseitigt nicht jede
Mehrfachzeichnung des gesamten Atlas.

## Umsetzung und Bereinigung

`LandscapeWorkbench` besitzt einen gemeinsamen ausstehenden Animationsauftrag.
Mausbewegung und zurückkehrende Schreibkapazität merken einen Schreibwunsch für
diesen Auftrag vor. Die Höhenvorschau läuft weiter, solange die Taste gehalten
wird, auch während Main eine Änderung speichert. Ein stationärer Vorschauframe
stellt dabei keinen weiteren Speicherauftrag in die Warteschlange.

Der getrennte `previewFrame` und `scheduleHeightPreview` sind entfernt.
Loslassen beendet den gemeinsamen Auftrag und übergibt den tatsächlichen letzten
Punkt samt verstrichener Zeit unmittelbar an Vorschau und Writer. Unklare oder
fehlgeschlagene Speicherantworten stoppen die Vorschau ohne automatischen Retry.
Farbstriche bleiben ereignisgesteuert. `TerrainLiveStroke` behält den bisherigen
Besitz von Revision, Source-Fence, einem laufenden Schreibauftrag und zusammengefasster
Folgeeingabe. Es gibt keinen neuen Timerbesitzer, Cache oder Renderingpfad.

## Gepaarte Phasenmessung auf der vollen Prüfwelt

Gleiche Weltprobe: 100.000 Biomzuordnungen, 5.000 eingerichtete Gebäude, 5.000 Orte,
50 detaillierte Gebäude, ein Dungeon mit 4.001 Räumen; insgesamt 15.701 Räume und
48.670 Zeichenelemente. 108.076 Landschaftsobjekte, 1.028 anfängliche Höhenkacheln.
Dies sind keine 100.000 feinen Höhenbearbeitungen. Pinselradius: 2.500 Meilen.

| Prüfung während gehaltener Taste | Vorher | Nachher |
| --- | ---: | ---: |
| Frames mit zwei Höhenzeichnungen, erster Zug | 10 | 0 |
| Frames mit zwei Höhenzeichnungen, zweiter Zug | 10 | 0 |
| Erste Höhenzeichnung eingereicht, erster Zug | 77,8 ms | 80,9 ms |
| Erste Höhenzeichnung eingereicht, zweiter Zug | 23,1 ms | 27,0 ms |

Die Doppelarbeit entfällt. Die erste Zeichnung ist in dieser Gegenprobe nicht
früher eingereicht; daraus folgt keine verbesserte Eingabe-Pixel-Latenz.

| Ablauf | Vorher p95 / p99 / Maximum | Nachher p95 / p99 / Maximum |
| --- | --- | --- |
| Navigation | 19,0 / 24,7 / 25,1 ms | 20,1 / 35,0 / 83,3 ms |
| Sculpt | 23,9 / 83,3 / 116,8 ms | 21,7 / 66,7 / 150,0 ms |
| Sculpt wiederholt | 23,9 / 66,6 / 216,7 ms | 24,2 / 83,2 / 149,6 ms |

Gemischtes Ergebnis: besserer p95/p99 im ersten Sculpt, schlechterer Maximalwert;
beim zweiten Zug schlechterer p99 und kürzerer Maximalwert. Navigation wird durch
den Pinselkoordinator nicht verändert und schwankt trotzdem. Je ein instrumentierter
Lauf erlaubt keine statistisch abgesicherte Beschleunigungsbehauptung.

Beide Läufe endeten normal, alle nativen Prozesse verschwanden, keine Rendererfehler.
Vorher: [Zusammenfassung](before-summary.json), [Rohdaten](before.json.gz).
Nachher: [Zusammenfassung](after-summary.json), [Rohdaten](after.json.gz).
Die zusätzlichen Phasenhaken gehören ausschließlich zur Probe. Die Artefakthashes
binden beide Messungen; Ausgangscode ist `9bd89e20484b858901cbaa0873e8e2810ea4ab5e`.

## Abschließender Lauf mit normalem Renderer

Der [abschließende Weltlauf](async-summary.json) verwendet den normalen Renderer
mit asynchronem GPU-Auslesen, ohne die zusätzlichen Phasenhaken und ohne CPU-Profiling.
[Rohdaten](async-result.json.gz). Beide Electron-Prozesse endeten normal mit Code 0,
beide PIDs verschwanden; keine Rendererfehler. Der wiederhergestellte Renderer
stimmt bytegleich mit dem normalen Nachher-Build überein.

| Ablauf | Vorher p95 / p99 / Maximum | Nachher p95 / p99 / Maximum |
| --- | --- | --- |
| Navigation | 24,6 / 35,8 / 66,6 ms | 20,2 / 24,5 / 83,4 ms |
| Sculpt | 24,3 / 66,7 / 133,4 ms | 23,1 / 66,7 / 116,6 ms |
| Sculpt wiederholt | 24,3 / 66,7 / 150,0 ms | 24,0 / 66,7 / 83,3 ms |
| Erste geänderte Pinselinnenfläche auslesbar | 186,6 ms | 196,6 ms |
| Wiederholter Zug: geänderte Innenfläche auslesbar | 156,7 ms | 110,3 ms |

Vorher ist der normale asynchrone Lauf aus dem
[vorherigen Eingangsprojektionsbericht](../atlas-scoped-entrances-20261022/README.md).
Die spätere Wiederholung reagiert früher, der erste Zug später. Der erste
Bildnachweis erfüllt weiterhin nicht das 100-ms-Ziel. Das Auslesen hat eigenen
Messaufwand; GPU-Verfügbarkeit ist keine Messung des tatsächlich dargestellten
Monitorbilds. Einzelne Läufe belegen keine allgemeine Beschleunigung. Navigation,
volle Welt, Pentium 7505 / Intel UHD und professionelle Kartengestaltung bleiben
unvollständig qualifiziert.

Lokal bestanden: 17 gezielte Tests, `npm run check`, `npm run check:desktop`,
`npm run build:desktop` und `npm run check:repo`. Diese lokalen Nachweise ersetzen
weder die Candidate-CI des endgültigen Commits noch eine Paket- oder Geräteabnahme.

## Regression und Reproduktion

`tests/terrain-brush-frame.test.mjs` verwendet echte Workbench- und
`TerrainLiveStroke`-Abläufe mit kontrollierten Frames und Speicherantworten.
Es prüft stationäres Halten, verspätete Bestätigungen, zusammengefasste Bewegung,
Endpunkt und gesamte verstrichene Pinselzeit, sehr kurzes Klicken, Farbe sowie
Abbruch nach unklarer Speicherantwort. Zwei der ursprünglichen vier Fälle
scheiterten am Ausgangscode. Nach Ergänzung des Fehlerfalls bestehen fünf neue
und insgesamt 17 betroffene Fälle.

Die [native Werkzeugfolge](live-result.json) besteht: direktes Sculpt und
Glätten mit jeweils einem Undo, kumulative halbdeckende Farbe mit Escape,
Fokusverlust, Aufrauen mit positiven und negativen Höhenänderungen in der
geneigten Hauptkamera, Undo/Redo und frischer Electron-Neustart. Beide Prozesse
endeten normal mit Code 0 und verschwanden; keine Rendererfehler.
[Sculpt](live-01-direct-top.png), [Farbe](live-02-color-stopped.png),
[geneigtes Aufrauen](live-04-tilted-live.png).

Zwei Prüfgrenzen wurden dabei ausdrücklich korrigiert bzw. offengehalten:

- Die ältere Probe erwartete während gehaltener Taste eine neue bestätigte
  Darstellungsrevision. Sie scheiterte identisch mit dem
  [Ausgangscode](obsolete-live-check-before.json) und der
  [Änderung](obsolete-live-check-after.json). Die direkte Höhenvorschau hält
  absichtlich ihre ursprüngliche Geländegrundlage; bestätigte Daten werden
  unabhängig gelesen und beim Abschluss übernommen. Die Probe prüft jetzt
  laufende kanonische Speicherung und `terrainDraft=height`, danach exakt die
  bestätigte Revision und entfernte Vorschau. Dieser Nachweis ersetzt keine
  Messung der sichtbaren Eingabe-Pixel-Latenz.
- Beim Wechsel auf Glätten benötigt der Atlas zusätzliche Nachbarschaftsdaten.
  Die [zu frühe Geste](live-tool-readiness-failure.json) begann vor deren
  Bereitschaft und wurde verworfen; die spätere Bereitschaft startet sie nicht
  nachträglich. Die Funktionsprobe wartet jetzt vor dem Pinselzug auf den
  passenden geladenen Nachbarschaftsbereich. **Der unmittelbar reagierende
  Werkzeugwechsel ist damit nicht abgenommen und bleibt eine Bedienlücke.**

Die fehlgeschlagenen Läufe zählen nicht als normale Fertigstellung. Ihre
Prozesse waren vor den Folgeproben beendet. Die visuellen Aufnahmen belegen die
Werkzeugfolge, keine professionelle Fantasy-Kartengestaltung.

```sh
node build.mjs --test
node --test tests/terrain-brush-frame.test.mjs tests/terrain-live-stroke.test.mjs tests/terrain-commit-display.test.mjs
npm run check
npm run check:desktop
npm run build:desktop
QA_EVIDENCE_DIR=.build/brush-live-repeat python3 tools/ui-session.py timeout --signal=TERM 180s node tools/test-desktop-terrain-live.mjs
WORLD_WARM_OPEN=1 WORLD_POPULATED=1 WORLD_LARGE=1 WORLD_MIXED=1 WORLD_READBACK=async WORLD_PROFILE=0 WORLD_DRAFT=1 WORLD_REPEAT=1 WORLD_PROGRESSIVE=1 WORLD_OVERLAY=1 QA_EVIDENCE_DIR=.build/brush-async-repeat python3 tools/ui-session.py timeout --signal=TERM 300s node tools/test-desktop-world-navigation.mjs
node docs/reference/atlas-brush-frame-20261022/build-brush-phase-probe.mjs before
WORLD_WARM_OPEN=1 WORLD_POPULATED=1 WORLD_LARGE=1 WORLD_MIXED=1 WORLD_READBACK=off WORLD_PROFILE=0 WORLD_DRAFT=1 WORLD_REPEAT=1 WORLD_PROGRESSIVE=1 WORLD_OVERLAY=1 QA_EVIDENCE_DIR=.build/brush-phase-repeat python3 tools/ui-session.py timeout --signal=TERM 300s node .build/world-brush-phases.mjs
node docs/reference/atlas-brush-frame-20261022/summarize-brush-phases.mjs .build/brush-phase-repeat/result.json
```

Nach tatsächlichem Prozessende den normalen Renderer mit
`cp .build/brush-renderer-before.js .build/desktop/ui/renderer.js` wiederherstellen.
Für jeden Versuch einen neuen Sicherungsnamen verwenden. Die Sicherung überschreibt
keine vorhandene Datei. Vorher/Nachher jeweils in einer isolierten Arbeitskopie
des betreffenden Codes bauen; keine parallelen nativen Proben ausführen.
Der erste lokale Aufbau der Messprobe hatte einen zu breiten Importpfad-Ersatz;
er scheiterte vor dem Start von Electron. Die beigefügte Fassung ersetzt nur
statische Importzeilen und wurde in der Nachher-Probe verwendet.

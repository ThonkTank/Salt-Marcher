# Glätten ohne erneutes Laden der unveränderten Atlasfläche

22.10.2026. Normaler Electron-Atlas, Fedora/Wayland, Intel i5-8365U / UHD 620.
Anschluss: [gemeinsamer Atlas P0/P5/P8](../../plans/maps/unified-spatial-atlas.md),
Terrain R7 / HEX-06, HEX-08, HEX-16. Keine Pentium-7505-Geräteabnahme.

## Befund und Entscheidung

Der [vorherige Pinselbericht](../atlas-brush-frame-20261022/README.md) dokumentiert
verlorene frühe Eingaben beim Wechsel auf Glätten. Der aktuelle Quellcode erklärt
warum: `TerrainSpatialUI.sync` führte Werkzeug und Radius über `samplePad` in der
Identität des geladenen Geländes. Ein Wechsel auf Glätten oder eine Radiusänderung
verwarf das verfügbare Raster, setzte `ready=false` und lud Übersicht und Details neu.
Die tatsächlichen Projektionsanfragen verwendeten diesen Paddingwert gar nicht.

Drei Möglichkeiten: die veraltete Abhängigkeit entfernen; Nachbarschaften vorsorglich
laden; frühe Gesten bis zur Bereitschaft speichern. Vorsorgliches Laden erzeugt hier
unbenutzte Arbeit. Gespeicherte Gesten erschweren Zeitdosierung und Abbruch und lassen
den unnötigen Aufbau bestehen. Gewählt wurde die Entfernung der Abhängigkeit:
Der sichtbare Ausschnitt bleibt derselbe, während der kanonische Smooth-Writer
seine benötigten Nachbarhöhen weiterhin selbst bestimmt.

## Änderung und Aufräumen

- Die Projektionsidentität enthält die tatsächlichen Geometrie-, Objekt- und
  Quellparameter. Pinselwahl und Radius verwerfen keine verfügbaren Höhen oder
  laufenden Detailantworten mehr.
- Der nicht mehr benötigte Zustand `samplePad`, sein DOM-Marker und seine
  Bereitschaftsprüfungen sind entfernt.
- `TerrainDraft` beschreibt jetzt den tatsächlichen Aufrufer: Trassenentwürfe.
  Direkte Höhen-/Farbpinsel besitzen ihre eigene Vorschau und Speicherfolge.
  Der allgemeinere Worker und seine Datenprüfungen bleiben erhalten.
- `heightBrushBounds`, die genaue Nachbarschaftsabfrage, Sichtbarkeitsprüfung,
  Revisionen und Undo/Redo im kanonischen Writer werden nicht verändert.

## Gegenproben

Die zwei neuen Quelltests scheitern am Ausgangscode: Bereitschaft wird bei
Werkzeug-/Radiusänderung gelöscht und eine laufende Verfeinerung verworfen.
[Vorher: 40 bestanden, 2 fehlgeschlagen](before-tests.log).
Die aktualisierte Erwartung für bestätigte Live-Daten prüft außerdem die
Wiederverwendung bei gleichzeitigem Wechsel auf Smooth; echte Änderungen von
Kampagne, Revision, Fence, Geometrie und Objektkontext verwerfen weiterhin den Stand.
[Nachher: 60 betroffene Tests bestanden](after-tests.log), einschließlich weiter
Glättung mit Nachbarhöhen außerhalb des sichtbaren Rasters und Speicherung.

Die [native Gegenprobe am Ausgangsrenderer](before-native-failure.json) scheitert
am sofortigen Werkzeugwechsel mit `loading` statt `ready`. Der Prozess PID 3851098
war anschließend beendet; diese Fehlerbereinigung ist keine normale Fertigstellung.

Die [vollständige Werkzeugfolge nach der Änderung](after-native.json) besteht:
Sculpt, Höhenprofil ohne Schreiben, direktes Glätten, Radiuswechsel 48 → 96 m,
Farbe mit Escape, Fokusverlust, Aufrauen in geneigter Hauptkamera, Undo/Redo und
Neustart. Vor Werkzeug-/Radiusänderung wird nur die bereits laufende Verfeinerung
abgewartet. Danach gibt es keine Bereitschaftswarteschleife vor Pointerdown.
Während dieser Einstellungsänderungen bleibt der Zähler der Geländeprojektionen
bei **104 → 104**, und der DOM-Beobachter erfasst **keinen Bereitschaftswechsel**.
Beide Electron-Prozesse enden normal mit Code 0 und verschwinden, keine Rendererfehler.

Die Änderung behebt diese Eingabeunterbrechung. Sie ist kein Nachweis allgemeiner
100-ms-Pinselreaktion, vollständiger Weltleistung oder professioneller Kartengestaltung.

## Gefüllte Weltkarte

Die [Weltprobe](world-summary.json), [Rohdaten](world-result.json.gz), umfasst
100.000 Biomzuordnungen, 5.000 Gebäude, 5.000 Orte, 15.701 Räume und 48.670
Zeichenelemente, dazu 1.028 anfängliche Höhenkacheln. Das sind keine 100.000 feinen
Höhenbearbeitungen. Sie führt Navigation, zwei Sculpt-Züge mit nominal 2.500 Meilen
Radius und anschließend den direkten Wechsel auf Smooth mit geändertem Radius aus.
Der nominale Smooth-Radius ist 3.017.520 m; das Maßeingabefeld rundet ihn auf
3.017.500 m. Kein Warten auf Gelände nach Werkzeug-/Radiusänderung.

| Ablauf | Frame p95 | p99 | Maximum | Erste geänderte Pinselinnenfläche auslesbar |
| --- | ---: | ---: | ---: | ---: |
| Navigation | 23,5 ms | 24,6 ms | 24,6 ms | – |
| Sculpt | 22,5 ms | 66,7 ms | 116,7 ms | 165,9 ms |
| Sculpt wiederholt | 23,9 ms | 99,9 ms | 233,2 ms | 111,5 ms |
| Glätten nach Werkzeugwechsel | 22,5 ms | 27,2 ms | 99,9 ms | 133,8 ms |

Smooth endet mit bestätigter Revision 22, `Gespeichert`, Detailqualität und 48/48
Kacheln. Beide Electron-Prozesse enden normal mit Code 0 und verschwinden;
keine Rendererfehler. Der normale Renderer verwendet asynchrones GPU-Auslesen,
kein CPU-Profiling. Das Auslesen hat Messaufwand; GPU-Verfügbarkeit ist keine
Displaylatenz. Die Werte sind Einzelmessungen, keine allgemeine Beschleunigungszusage.
Der vorige Lauf hatte beim wiederholten Sculpt 83,3 ms Maximum: Der jetzige
233,2-ms-Ausreißer verhindert eine vorbehaltlose Aussage, alle Werte seien verbessert.

[Visuelle Kontrolle nach Glätten](world-smooth.png): Die regelmäßigen grünen
Flächen stammen aus der synthetischen Lastverteilung; dies ist keine gestaltete
Autorenwelt. Schwacher Reliefkontrast und insgesamt unzureichende kartographische
Lesbarkeit bleiben offen. Die Probe ersetzt keine professionelle Fantasy-Kartenabnahme.

Lokal bestanden: 60 gezielte Tests, Anwendungs-/Desktop-Typprüfung, Desktop-Build
und Repositoryprüfung. Die endgültige Candidate-CI, Main-Integration und
Veröffentlichung sind getrennte Liefernachweise. Die Änderung ist noch nicht im
veröffentlichten Paket 0.186.0 enthalten.

## Reproduktion

```sh
node build.mjs --test
node --test tests/terrain-spatial-source.test.mjs tests/terrain-tilted-atlas.test.mjs tests/terrain-tilted-atlas-storage.test.mjs tests/terrain-brush-frame.test.mjs
npm run check
npm run check:desktop
npm run build:desktop
QA_EVIDENCE_DIR=.build/smooth-live-repeat python3 tools/ui-session.py timeout --signal=TERM 180s node tools/test-desktop-terrain-live.mjs
WORLD_WARM_OPEN=1 WORLD_POPULATED=1 WORLD_LARGE=1 WORLD_MIXED=1 WORLD_READBACK=async WORLD_PROFILE=0 WORLD_DRAFT=1 WORLD_REPEAT=1 WORLD_PROGRESSIVE=1 WORLD_OVERLAY=1 WORLD_SMOOTH=1 QA_EVIDENCE_DIR=.build/smooth-world-repeat python3 tools/ui-session.py timeout --signal=TERM 300s node tools/test-desktop-world-navigation.mjs
```

Proben nacheinander und mit neuen Ausgabeverzeichnissen starten; tatsächliches
Prozessende vor der nächsten nativen Probe prüfen. Die Vorher-Probe verwendet den
normalen Build von `c1584b1c48c592ff553b4cdd5d06d7d682412406` und den verschärften
Prüfablauf. Quell- und Artefakthashes stehen in den Rohbelegen.

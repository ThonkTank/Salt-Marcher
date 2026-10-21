# Kamera und Hilfsebene gemeinsam zeichnen

21.10.2026, Produktänderung auf `f802116ca` (Version 0.180.0).

## Ursache und Änderung

Die Kamerarückmeldung rief `TerrainSpatialView.reframe` auf und zeichnete die
GPU-Szene sofort. Der bereits eingeplante `AtlasCanvas.paint` zeichnete sie mit
der Hilfsebene nochmals. Bei einer neuen Kartenveröffentlichung kam deren
Zwischenbild hinzu. Die vorherige große Weltprobe enthielt 177 GPU-Clears in
90 belegten RAF-Intervallen; das sind Aufrufe, keine Compositor-Bilder oder
GPU-Laufzeiten.

`AtlasPresentation.batch` fasst Kartenveröffentlichung und Hilfsebene in dem
vorhandenen `TerrainSpatialView.batch` zusammen. Die Kamerarückmeldung
aktualisiert Ansicht, Matrizen, Sichtgrenze und Trassensichtbarkeit sofort,
überlässt die GPU-Zeichnung aber dem vollständigen Atlasframe. Damit bleiben
Navigationsstrahlen aktuell. `AtlasCanvas` gibt Bearbeitungstreffer erst nach
diesem erfolgreichen Zeichenabschluss frei. Ein Fehler beim Abschluss führt
weiter in die bestehende Wiederherstellung.

Die normale synchrone `reframe`-Verwendung bleibt für direkte GPU-Verbraucher
und die Terrainveröffentlichung erhalten. Explizite Bildkacheln zeichnen auch
innerhalb eines Batches synchron. Canvas-Fallbacks und Präsentationen ohne
Batchfunktion behalten ihren bisherigen Ablauf. Es entsteht weder ein zweiter
Animationskreislauf noch ein Cache.

## Gegenproben

- `tests/atlas-perspective-camera.test.mjs`: aktuelle Welt-/Ebenentreffer vor
  der verzögerten Zeichnung, genau eine Zeichnung beim Abschluss, verschachtelte
  Veröffentlichung, Fehler und explizite Bildausgabe.
- `tests/desktop-atlas-canvas.test.mjs`: Reihenfolge Karte/Hilfsebene/Abschluss,
  Trefferfreigabe erst danach, Fehler beim GPU-Abschluss.
- `tools/terrain-render-reuse-probe.mjs`: zwölf Kameraposen mit Verschiebung,
  Zoom, Neigung und Drehung. Verzögerte Vorbereitung zeichnet nullmal, der
  vollständige Batch einmal; exakter Pixelvergleich gegen synchrone Zeichnung.

136 betroffene Regressionen, beide TypeScript-Prüfungen, Desktop-Build und
Repository-Prüfung bestanden.

## Native große Welt

[Messung](world.json), [Ansicht](world.png): 108.076 Landschaftsobjekte, Intel
UHD 620 / i5-8365U, zwei Züge mit 2.500 Meilen Radius. Keine weiteren eigenen
Builds oder nativen Prozesse während der Messung. Keine Rendererfehler;
Prozess 3111425 endete normal mit Code 0 und verschwand.

| Abschnitt | RAF p95 / p99 / Maximum | Erste sichtbare Pinseländerung | Alle Details nach Loslassen |
| --- | ---: | ---: | ---: |
| Navigation | 24,6 / 57,1 / 59,2 ms | — | — |
| Erster Zug | 39,4 / 55,1 / 66,8 ms | 201,9 ms | 38.284,0 ms |
| Zweiter Zug | 39,3 / 44,1 / 98,5 ms | 145,9 ms | 9.025,9 ms |

Die Navigation enthält jetzt 87 GPU-Clears in 83 belegten RAF-Intervallen:
79 Intervalle mit einer, vier mit zwei Zeichnungen. Die
[vorherige Probe](../atlas-brush-overlay-20261021/README.md) enthielt 177 in
90 Intervallen. Der gezielte GPU-Vergleich bestätigt für zwölf Kameraposen
jeweils genau eine Zeichnung und identische Pixel; alle 43 Bildvergleiche
und die übrigen GPU-Gegenproben bestanden. Hover und Live-Speicherbestätigungen
behalten weiterhin dieselbe Kartenszene und ihre Programme. Beide Züge
speichern neue Revisionen (9 und 14) und erreichen 48/48 Detailkacheln.

Die Navigation verbesserte sich in diesem einzelnen Ablauf von 34,3 auf
24,6 ms im p95, während p99 von 48,1 auf 57,1 ms stieg. Das ist keine
60-FPS-Qualifikation. Die Pinselreaktion ist nicht nachweislich verbessert.
Die Pixelmessung enthält GPU-Ausleseaufwand; sie ist kein Compositor-Zeitstempel.

Die betrachtete Ansicht ist eine künstliche Rasterlast mit regelmäßigen
Flächen, keine gestaltete Fantasy-Welt. Vollständige Mischlast, Pentium Gold
7505, Langzeit-Speicherplateau und Fantasy-Kartenqualität bleiben offen.


## Native Bedienung

[Neun Prüfgruppen](brush-ux.json) bestanden: schmale Fenster/200 %,
Pinselvorlagen, Radiusbindung, Höhenbearbeitung mit Kamerasperre und Undo/Redo,
weitere Pinselfamilien, Shift+Mausrad, gekippte Kamera, PNG und frisches Öffnen
bei 125 % Browserzoom. Prozesse 3112740 und 3113293 endeten normal mit Code 0
und verschwanden; keine Rendererfehler.

Die [gekippte Ansicht](tilted-brush.png) wurde betrachtet. Die bekannte
Kombination aus 100 m/s Wirkung und einem Radius unter einem Meter produziert
weiterhin eine unnatürliche Säule. Die technische Bedienprobe qualifiziert
keine geeigneten Werkzeugwerte oder natürliche Geländeform über alle Maßstäbe.

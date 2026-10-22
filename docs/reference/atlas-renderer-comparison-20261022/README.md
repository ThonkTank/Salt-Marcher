# Kartenrenderer vergleichen – 22.10.2026

Stand: `07a0b67488e410789cceb7b48cc0b85cf4b2778e`. Dieser Versuch
bewertet MapLibre GL 6.15.0 außerhalb der Anwendung. Er ersetzt weder den
normalen Atlas noch dessen native Qualifikation. Keine Produktabhängigkeit
oder Sicherheitsfreigabe wurde dafür geändert.

## Problem und drei Ansätze

Die [große Weltprobe](../atlas-gpu-alternatives-20261022/README.md) verfehlt
weiterhin unmittelbare Kamera-/Sculpt-Reaktion. Eine sparsamere Terrainvernetzung
beschleunigte einzelne GPU-Zeichnungen, aber nicht den vollständigen Ablauf.

| Ansatz | Vorteil | Offene Kosten und Risiken |
| --- | --- | --- |
| MapLibre GL | Zusammenhängende Kacheln, Vektoren, Beschriftung, semantischer Zoom und Terrain | Eigene Meterprojektion experimentell; Höhenbearbeitung, Etagen und Innenräume brauchen eigene Integration |
| deck.gl TerrainLayer + OrbitView | Gekachelte Höhengeometrie, freie nichtgeographische Kamera | Kartographische Beschriftung und vollständiger Editor müssen zusammengeführt werden; noch nicht gemessen |
| GPU-Geometrieclipmaps | Feste Puffer, Höhen aus Texturen, nur bewegte Fenster aktualisieren | Eigenständige Lösung für Gelände; Straßen, Schriften und Objekte bleiben Integrationsarbeit; noch nicht gemessen |

MapLibre wurde zuerst untersucht, weil es den größten Teil der Navigation und
Kartographie gemeinsam abdeckt. **Es wurde kein Architekturgewinner gewählt.**

Primärquellen: [MapLibre Custom CRS](https://maplibre.org/maplibre-gl-js/docs/guides/custom-crs/),
[CustomLayerInterface](https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/),
[deck.gl TerrainLayer](https://deck.gl/docs/api-reference/geo-layers/terrain-layer),
[OrbitView](https://deck.gl/docs/api-reference/core/orbit-view),
[NVIDIA GPU Geometry Clipmaps](https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-2-terrain-rendering-using-gpu-based-geometry).
Custom CRS einschließlich Terrain ist inzwischen vorhanden, aber ausdrücklich
experimentell. Eine ältere Annahme, MapLibre erfordere zwingend Erdkoordinaten,
wäre deshalb keine tragfähige Ablehnung.

## Fixture und Grenzen

45 Millionen Meter großes quadratisches Koordinatensystem; eigene Projektion und
Workerprojektion. Lokale prozedurale Höhen-/Farbkacheln mit 256² Pixeln,
5.000 Gebäude, 20.000 Raumflächen, 5.000 Ortsnamen, 50 Straßen und zwölf
Regionsumrisse. Die Räume sind geometrische Flächen, kein geprüfter Etageneditor.
Es fehlen der vollständige kanonische Atlasbestand, 100.000 Biomeflächen,
Sculpt, History, Ausgabe und der Wechsel zwischen echten Innenraumgeschossen.

Die isolierte Electron-Instanz verwendet Sandbox, Kontextisolation und einen
lokalen HTTP-Server; keine Node-Rechte im Renderer, keine externen Netzwerkanfragen.
Abhängigkeiten und Profile liegen unter `~/.cache/saltmarcher/`. Alle verwendbaren
Läufe schlossen normal mit Exitcode 0 und verschwundenem PID; Fehlerlisten leer.

[Erster gültiger Lauf](initial/result.json): 1440×872 Zeichenfläche,
`preserveDrawingBuffer: true`. Welt/Kontinent/Königreich/Stadt/Gebäude wurden
angesprungen und jeweils bis `idle` beobachtet: 2.17 / 4.92 / 4.52 / 3.58 / 0.66 s.
Das ist Nachladezeit einschließlich prozeduraler PNG-Erstellung im Server,
**keine Eingabelatenz**. Kameraoszillation auf Gebäudeebene: p95 40.6 ms.
Projektionsrückwege waren auf Welt/Stadt/Gebäude numerisch eng, beim geneigten
Kontinent rund 0.9 m versetzt; Höhenbezug bedarf weiterer Klärung.

Die [Welt](world.png), [Stadt](city.png) und [Gebäudeansicht](building.png)
wurden visuell betrachtet. Namen sind maßstabsabhängig und Baukörper erscheinen
auf derselben Landschaft. Die synthetische Welt ist überbeschriftet, Straßen und
Gebäude regelmäßig. Dächer verdecken die eingezeichneten Raumlinien.
Das belegt weder professionelle Fantasyästhetik noch brauchbare Innenraumbedienung.

## Kontrollierte Komponentenmessung

[Protokoll](controlled/result.json): 1152×852, `preserveDrawingBuffer: false`,
60 Aufwärmbilder und 180 Messbilder je Variante, Kameraoszillation auf Stadtebene.
CPU misst den Aufruf von MapLibres privatem `_render` in genau Version 6.15.0;
GPU verwendet `EXT_disjoint_timer_query_webgl2` für denselben Renderaufruf.
Ergebnisse werden erst nach der Messreihe abgefragt; mindestens 100 gültige
GPU-Samples, kein Disjoint. Die private Methode ist nur Versuchsinstrumentierung.

| Szene | Frame p95 / p99 ms | CPU-Render p95 ms | GPU-Render p95 ms |
| --- | --- | --- | --- |
| Alles | 41.0 / 45.9 | 24.5 | 13.78 |
| Ohne Terrain | 37.0 / 39.6 | 8.3 | 6.60 |
| Alles erneut | 40.8 / 43.1 | 22.3 | 13.25 |
| Nur Terrain | 39.0 / 41.5 | 17.4 | 12.24 |
| Nur Hintergrund | 24.0 / 37.8 | 1.5 | 1.67 |
| Leeres Electron nach `map.remove()` | 16.8 / 16.8 | – | – |

Frameabstände sind RAF-Messungen, nicht Pointer-bis-Pixel. Dieser Versuch ist
kein direkter Gleichlastvergleich mit dem Atlas. Gleichzeitig hohe Desktoplast
war vorhanden; die leere Kontrolle erreicht trotzdem das 60-Hz-Budget.
Terrain verursacht erhebliche zusätzliche CPU-/GPU-Arbeit. Ein Wechsel zu
MapLibre allein ist durch diese Messung nicht als Leistungsverbesserung belegt.

Ungültige Vorläufe bleiben nachvollziehbar:
[GeoJSON-Quellzoom](invalid-source-zoom.json) verwendete maxzoom 26 statt maximal
24; [Renderereignisse](invalid-render-events.json) verwendeten ein in dieser
Version nicht ausgelöstes `renderstart`. Dessen CPU/GPU-Werte sind ungültig.
Beide Fehler wurden vor dem verwendbaren Lauf korrigiert. Sie zählen nicht als
bestandene Messungen.

## Reproduktion

Node 22, Linux-Desktop mit GPU und die Repositoryabhängigkeiten werden benötigt.
Die unveränderten Quellen und Sperrdateien sind unter `initial/source/` und
`controlled/source/` eingefroren. Die Laufskripte erwarten das Repository als
Arbeitsverzeichnis und die Engine unter `~/.cache/saltmarcher/renderer-comparison`.
Für den kontrollierten Lauf:

```sh
mkdir -p "$HOME/.cache/saltmarcher/renderer-comparison/probe"
cp docs/reference/atlas-renderer-comparison-20261022/controlled/source/package*.json "$HOME/.cache/saltmarcher/renderer-comparison/"
npm ci --ignore-scripts --no-audit --no-fund --prefix "$HOME/.cache/saltmarcher/renderer-comparison"
cp docs/reference/atlas-renderer-comparison-20261022/controlled/source/main.cjs docs/reference/atlas-renderer-comparison-20261022/controlled/source/index.html docs/reference/atlas-renderer-comparison-20261022/controlled/source/probe.mjs docs/reference/atlas-renderer-comparison-20261022/controlled/source/projection.mjs docs/reference/atlas-renderer-comparison-20261022/controlled/source/style.css "$HOME/.cache/saltmarcher/renderer-comparison/probe/"
cp docs/reference/atlas-renderer-comparison-20261022/controlled/source/run-maplibre-components.mjs .build/
QA_EVIDENCE_DIR=.build/maplibre-controlled-repeat python3 tools/ui-session.py timeout --signal=TERM 180s node .build/run-maplibre-components.mjs
```

Die lokale Noto-Serif-Schrift wird über den in `main.cjs` dokumentierten
Systempfad gelesen. Abweichende Schrift-/GPU-/Desktopumgebungen ausweisen.
Für den ersten Lauf analog `initial/source/` und `run-maplibre-probe.mjs` verwenden.
Bestehende Ergebnisordner nicht überschreiben. Die Quellenhashes im Protokoll
binden die tatsächlich ausgeführten Dateien.

## Entscheidung und Aufräumen

Kein Enginewechsel im Produkt. Zwei vergleichbare Kandidaten und ein realer
Bearbeitungs-/Etagenfall fehlen noch. Die Versuchsabhängigkeit bleibt separat;
kein zusätzlicher Renderer, Menüpunkt oder experimenteller Sicherheitsweg wurde
in die Anwendung aufgenommen. Reproduzierbare Quellen ersetzen eine weitere
aktive Produktabstraktion. Die nächste Entscheidung muss die ganze Reaktion
und das gewünschte Kartenbild bewerten, nicht nur einen GPU-Teilwert.

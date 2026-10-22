# deck.gl als zweite Architekturprobe

22.10.2026: Nach [MapLibre](../atlas-renderer-comparison-20261022/README.md)
wurde deck.gl 9.4.0 mit TerrainLayer, OrbitView und CollisionFilterExtension
untersucht. Alle Abhängigkeiten blieben außerhalb der App. Der Versuch ist
keine zweite Produktansicht und kein angenommener Rendererwechsel.

Primärquellen: [TerrainLayer](https://deck.gl/docs/api-reference/geo-layers/terrain-layer),
[OrbitView](https://deck.gl/docs/api-reference/core/orbit-view),
[CollisionFilterExtension](https://deck.gl/docs/api-reference/extensions/collision-filter-extension).
Terrain wird gekachelt aus lokalen RGB-Höhenbildern aufgebaut; OrbitView erlaubt
nichtgeographische Weltkoordinaten. Die GPU-Kollisionsprüfung betrachtet
Ankerpunkte, nicht vollständige Textrechtecke.

45 Millionen Meter Weltfläche, 5.000 Gebäude, 20.000 Raumflächen,
5.000 Ortsnamen, 50 Straßen und zwölf Regionsumrisse. Dieselbe analytische
Höhenfunktion und Objektanordnung wie in der MapLibre-Probe, 1152×852 bei DPR 1.
Eigene planare Meterkacheln und lokal ausgelieferter Terrain-Worker;
keine externen Netzabfragen oder Produktrechte. Die Vektoren sind hier nicht
gekachelt. Beschriftung und sichtbare Details sind nicht gleichwertig zum
MapLibre-Vektorkachelaufbau. Deshalb kein direkter Engine-Leistungsvergleich.

## Messung und Beobachtung

[Komponenten](components.json): 60 Aufwärmbilder und 180 Messbilder pro Variante.
GPU-Zeit umfasst `_drawLayers`, gemessen mit gültigen WebGL-Timerqueries.
CPU-Wandzeit umfasst denselben Aufruf, aber **nicht** die vorherige Layeraktualisierung
und ist daher nicht identisch zur MapLibre-CPU-Messung. Keine Renderer-/Konsolenfehler,
normaler Prozessabschluss und PID abwesend.

| Variante | Frame p95 / p99 ms | CPU-Zeichnung p95 ms | GPU p95 ms |
| --- | --- | --- | --- |
| Alles | 46,6 / 55,3 | 34,8 | 21,74 |
| Ohne Terrain | 40,1 / 41,1 | 6,4 | 15,54 |
| Alles erneut | 43,3 / 50,0 | 31,5 | 17,22 |
| Nur Terrain | 40,6 / 46,1 | 25,4 | 6,29 |
| Hintergrund | 24,1 / 38,5 | 0,6 | 0,68 |
| Leeres Electron | 16,8 / 16,8 | – | – |

[Visueller Lauf](visual.json): Welt/Kontinent/Königreich/Stadt/Gebäude wurden
vollständig geladen und betrachtet; 2,72 / 2,98 / 1,75 / 2,95 / 4,76 s einschließlich
lokaler prozeduraler Bild-/Meshaufbereitung. Diese Werte sind keine Eingabelatenz.
Die [Weltbeschriftung](world.png) überlappt trotz Kollisionsfilter weiterhin
stark. Im [Kontinent](continent.png) erscheinen grobe kantige Texturgrenzen,
in der [Stadt](city.png) das regelmäßige synthetische Raster. Auf
[Gebäudeebene](building.png) verdecken geschlossene Baukörper die Raumflächen.
Etagenbedienung und D&D-Kartengestaltung sind nicht geprüft oder erreicht.

**Alle diese ursprünglichen Läufe erzwingen X11.** Der anschließend belegte
[Unterschied zum normalen Wayland-Start](../atlas-presentation-platform-20261022/README.md)
begrenzt ihre Übertragbarkeit. Vor einer Architekturentscheidung müssen die
vielversprechenden Kandidaten mit normalem Start und gleichwertigen Details,
Beschriftungen und Bearbeitung erneut verglichen werden. Ein automatischer
Leistungsgewinn durch die Integration dieser Probe ist nicht belegt. Die spätere
[Wiederholung mit normalem Start](../atlas-presentation-platform-20261022/README.md#kartenbibliotheken-mit-normalem-start)
verringert einen Teil der Framezeiten, erreicht das Ziel aber ebenfalls nicht.

## Ungültige Vorversuche und Korrekturen

[Diagnosen](invalid-attempts.json): Zuerst wartete die Probe fälschlich auf
`deck.isLoaded`, das nicht existiert; tatsächlich geladene Schichten wurden
übersehen. Danach wurde die Orbit-Kamera korrigiert: `rotationX=0` schaut auf
die Kante der XY-Ebene, Draufsicht braucht hier 90°. Eine zu weite Far-Plane
wurde auf den üblichen skalierten Wert zurückgesetzt. Vor dem Ladeurteil werden
fünf Animationsframes für die neue Kamera abgewartet.

Eine Komponentenprobe verwendete nach Entfernen ein bereits finalisiertes
TerrainLayer-Objekt erneut und erzeugte Assertions/ungültige GPU-Pufferbindungen.
Die endgültige Variante konstruiert neue Layerbeschreibungen und wartet vor jeder
Messreihe auf deren geladenen Zustand. Das waren Fehler der Versuchsfixture;
sie werden nicht als Leistungs- oder Funktionsmängel der Engine gewertet.

## Reproduktion und verbleibende Arbeit

Node 22, Linux-GPU-Desktop, Repositoryabhängigkeiten. Die eingefrorenen Quellen
und Sperrdateien stehen unter [source](source/probe.mjs). `main.cjs` erwartet
`/usr/share/fonts/google-noto/NotoSerif-Regular.ttf`. Aus dem Repository:

```sh
mkdir -p "$HOME/.cache/saltmarcher/deck-comparison/probe"
cp docs/reference/atlas-deck-comparison-20261022/source/package*.json "$HOME/.cache/saltmarcher/deck-comparison/"
npm ci --ignore-scripts --no-audit --no-fund --prefix "$HOME/.cache/saltmarcher/deck-comparison"
cp docs/reference/atlas-deck-comparison-20261022/source/main.cjs docs/reference/atlas-deck-comparison-20261022/source/index.html docs/reference/atlas-deck-comparison-20261022/source/style.css docs/reference/atlas-deck-comparison-20261022/source/probe.mjs "$HOME/.cache/saltmarcher/deck-comparison/probe/"
cp docs/reference/atlas-deck-comparison-20261022/source/build-deck-comparison.mjs docs/reference/atlas-deck-comparison-20261022/source/run-deck-components.mjs docs/reference/atlas-deck-comparison-20261022/source/run-deck-probe.mjs .build/
node .build/build-deck-comparison.mjs
QA_EVIDENCE_DIR=.build/deck-components-repeat python3 tools/ui-session.py timeout --signal=TERM 180s node .build/run-deck-components.mjs
QA_EVIDENCE_DIR=.build/deck-visual-repeat python3 tools/ui-session.py timeout --signal=TERM 180s node .build/run-deck-probe.mjs
```

Bestehende Ergebnisse nicht überschreiben, Prozesse nacheinander beenden.
Die Sperrdatei bindet die Engine; der Browserbundle wird mit dem Repository-esbuild
reproduziert statt als generierter Fremdcode abgelegt. Produktabhängigkeiten,
CSP und Rendereraufbau bleiben unverändert. GPU-Höhenfelder/Clipmaps sind als
dritter grundsätzlich anderer Ansatz weiterhin offen. Die vereinfachte
Prüfumgebung und vollständige Präsentationsmessung gehen einer Festlegung vor.

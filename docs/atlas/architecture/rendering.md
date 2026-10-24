# Atlas: Darstellung und Bearbeitung

Status: Current; offene Ziele sind als solche beschrieben.
Owner: atlas
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Der Atlas verbindet Landschaft, Städte und Räume in Weltmetern. Der [kanonische Store-Worker](../../project/architecture/canonical-store-worker.md)
besitzt SQLite und alle Store-Schreibvorgänge; Main besitzt den privilegierten Hostanschluss. Der Renderer erhält ausschließlich
die geprüften Fähigkeiten der Preload-Brücke.

## Zuständigkeiten und Datenfluss

1. **Arbeitsbereich und Werkzeuge** wählen Kampagne, Ausschnitt, Geschoss und
   Bearbeitungsaktion. Temporäre Entwürfe gehören ihrer jeweiligen Sitzung. Autoren-Gesten verwenden gemeinsame `hasDraft`-/Abbruchregeln; Regions- und Reisezustand werden nur über ihre eigenen Befehle geändert.
2. **Lesedienst und Worker** lesen einen bestätigten Quellenstand. Fertige,
   quellengültige Kacheln werden zuerst aus dem Cache verwendet. Nur fehlende
   Produkte benötigen Indexsynchronisation und erneute Berechnung.
3. **Kamera und Darstellung** verwenden Meterkoordinaten und lokale GPU-Puffer.
   Kamerabewegung verändert die Transformation, keine Autorendaten.
4. **Schreibwarteschlange** übergibt abgeschlossene Gesten in Reihenfolge an Main.
   Jede Geste bleibt ein Historyschritt. Ungeklärte Bestätigungen sperren davon
   abhängige Änderungen, bis der Speicherstand ausdrücklich geklärt wurde.
5. **Export und Spieleranzeige** konsumieren bestätigte Szenen. Öffentliche
   Inhalte stammen ausschließlich aus der freigegebenen Spielerprojektion.

Funktionsumfang und Regressionsziele stehen im
[Atlasplan](unified-spatial-atlas.md). Technische Nachweise ersetzen
keine vollständige Produktabnahme.

## Wo ändern und prüfen?

| Verhalten | Einstieg | Regression |
| --- | --- | --- |
| Arbeitsbereich und Werkzeugwechsel | `src/app/campaign-atlas-ui.ts` | `tools/test-desktop-atlas-cleanup.mjs` |
| Kamera, GPU-Lebenszyklus und Weltkoordinaten | `src/app/atlas-deck-surface.ts`, `src/app/atlas-metric-camera.ts` | `tests/atlas-deck-surface.test.mjs`, `tools/test-desktop-atlas-deck.mjs` |
| Zeichenbefehle und genaue Auswahl | `src/app/atlas-deck-drawing.ts`, `src/app/atlas-drawing-geometry.ts` | `tests/atlas-drawing-geometry.test.mjs`, `tools/test-desktop-dungeon-groundplan.mjs` |
| Maßstab, Waldzeichnung und stabile Instanzen | `src/app/atlas-cartographic-style.ts`, `src/app/atlas-vegetation-layer.ts` | `tests/atlas-cartographic-scale.test.mjs`, `tools/test-desktop-atlas-multiscale.mjs` |
| Kacheln und gemeinsame Nachladung | `src/app/atlas-surface-tile-stream.ts`, `src/app/atlas-raster-tile-stream.ts` | `tests/atlas-surface-stream.test.mjs` |
| Quellenauswertung und Material | `src/app/landscape-raster.ts`, `src/app/atlas-raster-kernel.ts` | `tests/atlas-bounded-material.test.mjs`, `tests/atlas-raster-kernel.test.mjs` |
| Asynchrone Leseaufträge | `desktop/atlas-region.ts`, `desktop/atlas-region-worker.ts` | `tests/atlas-first-product-worker.test.mjs`, `tests/atlas-presentation-source.test.mjs` |
| Persistente Produkte und Cache | `src/app/storage/atlas-cache-scope.ts`, `src/app/storage/atlas-tile-cache.ts` | Terrain-/Material-/Geometriekacheltests |
| Pinselentwurf und Bestätigung | `src/app/landscape-brush-session.ts`, `src/app/terrain-stroke-queue.ts` | `tests/terrain-stroke-queue.test.mjs`, native Pinselprobe |
| Ausgabe | `src/app/atlas-output.ts` | `tools/test-desktop-region-export.mjs`, `tools/test-desktop-atlas-cleanup.mjs` |

## Quellenstand und Veröffentlichung

Ein sichtbarer Frame ist nur für die Kamera, Fenstergröße, Kampagne und Revision
gültig, für die er aufgebaut wurde. Ein altes Bild darf während der Nachladung
stehen bleiben; es erteilt keine neue Schreib- oder Auswahlberechtigung.
Verspätete Antworten werden verworfen. Ein Abbruch beendet auch die laufende
Arbeit, bevor ein Ersatz denselben begrenzten Rechenplatz übernimmt.

Höhe und Material werden gemeinsam veröffentlicht. Eine Elternkachel bleibt
sichtbar, bis ihre benötigten Kinder vollständig sind. Cachebudget und
Verdrängung zählen sichtbare und vorbereitete Daten mit. Cacheinhalte sind
ableitbar; beschädigte eigene Bestände werden kontrolliert neu aufgebaut.
Kameraposition, Fenstergröße und Licht gehören nicht zur Identität gespeicherter
Autorendaten. Änderungen berücksichtigen Nachbarknoten, Quellenränder und Eltern.

Der sichtbare Ausschnitt erhält bis zu 32 Detailkacheln, bei Neigung mit feineren
Blättern am Arbeitsbereich und groben Kacheln in der Ferne. Der Puffer zum
Vorladen darf diesen Ausschnitt nicht vergröbern: Erst nach dessen vollständiger
Verfeinerung werden bis zu acht grobe Nachbarkacheln geladen. Sichtbare,
vorbereitete und zwischengespeicherte Oberflächen teilen sich 64 Kacheln und
64 MiB. Die Reserve erlaubt den atomaren Eltern-Kind-Austausch. In einer
1920 × 1080-Draufsicht sind lokal etwa ein bis zwei CSS-Pixel pro Materialtexel
das Ziel; stark geneigte Fernbereiche dürfen gröber sein. Die Horizontblende
gilt auch im gekachelten Export.

Die Diagnosedaten `terrainCache` zählen gemeinsam gehaltene CPU-Oberflächendaten;
`terrainGpu` meldet die von luma registrierten GPU-Puffer und Texturen der
Anwendung. Letzteres ist keine Messung des gesamten Grafikspeichers oder eine
zusätzliche 64-MiB-Grenze.

## Geometrie, Material und Auswahl

Die metrische Kamera besitzt Projektion und Auswahlstrahlen. Ein naher Ursprung
hält GPU-Koordinaten präzise; kanonische Weltpositionen bleiben doppelt genau.
Gebäude und Räume beziehen ihre physischen Höhen aus denselben Quellen wie die
Darstellung. Versteckte Geschosse verändern keine physische Bauhöhe.

Höhen, Pigment, Wasser und Bewuchs bleiben fachlich getrennt. Kleine Flächen,
Löcher und Inseln dürfen nicht durch eine reine Mittelpunktprobe verschwinden.
Materialreduktion gewichtet Farbe nach Alpha und erhält Wasser-Teilflächen für
abhängige Cachekanäle. Beleuchtung und Schneegrenze verändern Darstellung,
keine gemalten Grundfarben. Die TypeScript-Reduktion arbeitet in begrenzten Blöcken.

Die kartografische Darstellung verwendet den lokalen Maßstab in CSS-Pixeln.
Ab 8 m/Pixel trägt die Waldmaske eine ruhige Flächenzeichnung; zwischen 2 und
8 m/Pixel blendet sie zu den vorhandenen Einzelbäumen über. Weltfeste, ineinander
übergehende Musterstufen vermeiden Texturwandern. Auf Weltmaßstab verschwindet
das Muster. Die Maske besitzt weiterhin Grenzen, Lichtungen und schmale Säume.
Instanzdaten und physische Matrizen bleiben beim Zoomen erhalten; die GPU
berechnet Kronenmaß und Ausblendung. Automatische Kronen wachsen höchstens auf
das Doppelte, geschützte Objekte bleiben maßhaltig. Fels- und Schneekriterien
verwenden weiterhin physische Höhen und Hänge. Die zusätzliche Reliefbetonung
beeinflusst ausschließlich die Beleuchtung. Linien blenden weich aus und halten
im lesbaren Bereich mindestens 1,4 CSS-Pixel; Beschriftungen haben einen hellen
Saum. Export und freigegebene Spielerflächen verwenden dieselbe Waldzeichnung,
ohne private Materialmasken an die Spieleranzeige zu geben.

Auswahl verwendet die sichtbare Geometrie, ihre Objektkennung und Verdeckung.
Transparente Autorenkonturen können bewusst auswählbar sein. Kontextverlust
entwertet GPU-Ressourcen und Treffer, wiederholt aber keinen Schreibauftrag.

## Ausgabe und Datenschutz

Ein Ausgabeauftrag friert Quellenstand, Kamera, Ausschnitt, Geschoss, Raster,
Maßstab, Vorlagen und Dateiformat ein. Gemischte Revisionen oder unvollständige
Quellen erzeugen keine vermeintlich vollständige Datei. Beschriftungen werden
über das gesamte Ausgabebild platziert, nicht unabhängig pro Bildkachel.
Die Komposition bleibt bei höherer Auflösung gleich; Texturen werden entsprechend
feiner. GPU-Zwischenbilder bleiben auf 1024 × 1024 Pixel begrenzt, das fertige
Bild darf bis zu 8192 Pixel Kantenlänge besitzen.

Öffentliche Ausgabe und Spieleranzeige erhalten nur ihre freigegebene Projektion.
Das Ausblenden von GM-Knoten im Renderer ersetzt diese Datengrenze nicht.
Nach Export und Abbruch müssen Werkzeuge, Menüs und Navigation weiter funktionieren.

## Prüfwege und offene Qualifikation

```sh
node build.mjs --test
npm run check
npm run check:desktop
npm run build:desktop
QA_DRAWN=1 node tools/test-desktop-atlas-multiscale.mjs
node tools/test-desktop-atlas-raster-workbench.mjs
node tools/test-desktop-atlas-cleanup.mjs
node tools/test-desktop-world-authoring.mjs
node tools/test-desktop-region-export.mjs
node tools/test-desktop-dungeon-groundplan.mjs
node tools/test-desktop-atlas-camera-coverage.mjs
node tools/test-desktop-atlas-mixed-workbench.mjs
node tools/test-desktop-player-map-reveal.mjs
```

Native Proben verwenden isolierte, erzeugte Testkampagnen. Verglichen werden
sichtbare Ergebnisse, erste Eingabereaktion, Folgezug, Undo/Redo und Wiederöffnung.
Die große Mischwelt prüft Last; kleine Szenen lokalisieren Fehler. Ein Link oder
eine Testanzahl belegt keine vollständige Produktabnahme. Tatsächliche Testdateien
und geprüfte Abläufe stehen im gemeinsamen Capability-Katalog.

Beim Rechteckabschluss unterscheidet `AtlasAuthor` Schreiben und bestätigte
Nachauswahl. Die Nachauswahl darf den Workspace-Flush passieren; Kameraeingaben
und automatisches Öffnen der Eigenschaften bleiben bis zum Abschluss gesperrt.

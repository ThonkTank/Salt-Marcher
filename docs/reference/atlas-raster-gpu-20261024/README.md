# Begrenzter Raster-/GPU-Kern, 24.10.2026

Der erste technische Teil der beauftragten Vereinfachung ist implementiert.
Dies ist **keine vollständige Atlas-Übernahme und kein Nachweis einer schnelleren
normalen Workbench**. Der aktive Arbeitsauftrag steht ausschließlich in der
[Roadmap](../../plans/maps/unified-spatial-atlas.md#aktueller-arbeitsstand).

## Implementiert

- Feste 256×256-Materialprodukte mit 4×4-Abtastung; Polygonränder erhalten
  geometrische Deckung. 64-Pixel-Blöcke begrenzen temporäre Rasterpuffer.
  Keine rekursive Fehlerzertifizierung im neuen Laufzeitpfad.
- Separate Höhenprodukte vermeiden die Berechnung fertiger Farbbilder.
  Die Cacheadressen trennen diese Produkte vom bisherigen Terrainprodukt;
  die Materialsemantik erhält die neue Version `material-tiles-v2-area4`.
- Ein gemeinsamer begrenzter Strom veröffentlicht Höhe und Material aus demselben
  Quellenstand. Eltern bleiben bis zur vollständigen Kindgruppe sichtbar.
- Überholte Aufträge können ihren eigenen Leseauftrag über den eingeschränkten
  Preload-Port abbrechen. Selbst ohne physischen Abbruch startet ein Strom
  höchstens einen tatsächlichen Leseaufruf gleichzeitig. Tile-Endpunkte verwenden
  den vorhandenen Hintergrundworker; interaktive Abfragen behalten ihren Worker.
- deck.gl verwendet unveränderte Meshpuffer bei Kamera-/Stiländerungen. Die GPU
  berechnet Fels, Schnee, Licht, Analysefarbe und feste/automatische Höhenlinien.
  Texturen werden explizit angelegt und freigegeben. Ein Renderfehler bleibt
  sichtbar, auch wenn ein Bereitschaftswarter erst später hinzukommt.

## Lokale Nachweise

[57 gezielte Tests](targeted-tests.log) bestanden. Die neun Tests der GPU-Fläche wurden
[nach der abschließenden Canvas-Größenkorrektur erneut geprüft](surface-after-recovery-fix.log).
`npm run check`, `npm run check:desktop`, `npm run check:repo` und
`npm run build:desktop` bestanden lokal. Keine vollständige Candidate-CI-Abnahme.

Die Tests prüfen insbesondere den 150-m²-Waldstreifen in Übersicht und 16 Kindern
(jeweils höchstens 1 m² Abweichung), Löcher, konkave/offscreen/weit versetzte
Polygone, blockweise Rastergleichheit, gekrümmtes Relief, lokale Cacheänderungen,
Undo/Redo, falsche Quellenstände sowie 20 schnelle Ansichtswechsel. Der letzte
Fall startet nur die bereits laufende alte Anfrage und Übersicht/Detail der
letzten Ansicht. Ein falscher Kampagnentoken oder eine alte Auftrags-ID bricht
den aktiven Auftrag nicht ab.

Die [native Probe](result.json) verwendet eine isolierte gespeicherte Testkampagne
mit dem echten Main-/Preload-/Worker-Pfad und einer deck.gl-Fläche über dem App-Fenster:

- 163.910 geänderte Pixel beim Verschieben der Schneegrenze; dasselbe GPU-Modell
  und dieselben Positionspuffer bleiben erhalten.
- Geländetreffer exakt bei `(24 m, 24 m, 140 m)` trotz Kameradrehung/Überhöhung.
- Gemeinsame Übersicht-/Detailveröffentlichung; Höhenanalyse und Höhenlinien.
- Expliziter GPU-Ressourcenwiederaufbau behält Kamera und exakt dieselben Pixel;
  ein Canvas mit 800×600 Pixeln. Das ist kein erzwungener Treiberverlusttest.
- Regulärer App-Neustart liest Höhe und alle Materialkanäle aus dem persistenten
  Cache; unveränderte Höhenprüfsumme, zwei normale Exits und keine Rendererfehler.
- Buildartefakte und zusätzlich der Hash von `atlas-deck-runtime.js` sind im
  Ergebnis erfasst. Der Lauf erfolgte auf der dort genannten schmutzigen
  Arbeitskopie; kein exakter Main-, Paket- oder Releasebeleg.

[Relief/Schnee](material-snow-and-relief.png) und
[Höhenanalyse/Höhenlinien](height-analysis-contours.png) zeigen eine steile
synthetische Testhöhe. Sie belegen Renderfunktionen, keine fertige Kartenästhetik.

## Offene Übernahme

- `AtlasPresentation` im normalen Workbench anschließen; alle Objekte/Werkzeuge
  aus M0 einschließlich Trassen, Bewuchs, Assets und Autorengriffen erhalten.
- Lokale Arbeitsfassung, unmittelbarer Folgezug, bestätigte Schreibreihenfolge,
  Save/Reopen, normale Oberfläche und Export mit diesem Kern gemeinsam prüfen.
- Die CPU-Fels-/Schneekanäle gehören noch zur Übergangsreferenz und werden im
  aktuellen Material-Endpoint weiterhin berechnet, obwohl der Shader sie ersetzt.
- LOD-Nähte, physische Küsten/kleine Inseln/dünne Flüsse, weiche Ränder und
  Überlagerungen umfassend visuell prüfen. Geometrische Polygondeckung ist keine
  analytische Garantie für beliebig überlagerte oder feldabhängige Materialien.
- Die initiale Indexsynchronisation ist weiterhin kampagnenweit. Abbruch greift
  an kooperativen Grenzen; eine kurze maximale Abbruchlatenz ist nicht qualifiziert.
- Hintergrundexport und Kachelstrom teilen noch die vorhandene Workerplanung;
  gleichzeitiger Export mit Navigation ist nicht vollständig qualifiziert.
- Rust/WASM, Ressourcenplateau und die Ziele 100 ms / 16,7 ms / 2 s stehen aus.
- Standardrenderer erst nach vollständiger Übernahme wechseln und alte Pfade dann
  entfernen. Keine Integration oder Veröffentlichung in diesem Zwischenstand.

## Reproduktion

```sh
node build.mjs --test
node --test --test-concurrency=2 tests/atlas-bounded-material.test.mjs tests/atlas-surface-stream.test.mjs tests/atlas-terrain-tiles.test.mjs tests/terrain-material-raster.test.mjs tests/atlas-material-tiles.test.mjs tests/atlas-material-stream.test.mjs tests/atlas-material-service.test.mjs tests/atlas-tile-stream.test.mjs tests/atlas-deck-surface.test.mjs
npm run build:desktop
node tools/test-desktop-atlas-raster-gpu.mjs
```

# DD-038: Randänderung, direkter Datenabgleich und vorbereiteter Hostfall

## Belegte Originalwirkung

Quelle sind die unveränderten Dungeondraft-1.2.0.1-Dateien `native-crop-wide.dungeondraft_map`, `native-cropped-left-wide.dungeondraft_map` und `native-crop-restored.dungeondraft_map` im read-only Referenzordner der Plugin-Tests. Ihre SHA-256-Werte stehen in `tests/native-map-crop.json`: `957071b40c6051a68c319fc2bb7526e3209d3c2bdf3462eb528de5d3c`, `f387fedf432c87e5c6a1c909e52c92fe1349d681ec6dc8abd9ed91346304541c` und `a02617523d4e526ff10100b7a81d12fd3b4ac848283f5afba09`. Der Ablauf war 12 × 8 → links −3 → 9 × 8 → links +3 → 12 × 8.

Die vier `world.levels.0.shapes.polygons` mit insgesamt 16 Punkten verschoben sich beim Beschnitt um −3 Felder (−768 native Koordinateneinheiten). Nach Wiedererweiterung waren alle Punkte exakt wie vor dem Beschnitt. Das ist **kein** Beleg für Löschen oder Clipping dieser Polygone.

Die getrennten `world.levels.0.tiles.cells` verloren dagegen belegte Zellen dauerhaft:

| Zustand | Zeile 2 | Zeile 8 | Belegte Zellen |
| --- | --- | --- | ---: |
| 12 × 8 vor Beschnitt | `.11100......` | `.11111......` | 10 |
| 9 × 8 nach links −3 | `100......` | `111......` | 6 |
| 12 × 8 nach links +3 | `...100......` | `...111......` | 6 |

Alle übrigen Rasterzeilen sind leer. `cave.bitmap` und `cave.entrance_bitmap` sind in diesen drei Dateien leer. Der frühere pauschale Höhlen-Claim ist damit für diese konkrete Probe **ersetzt**: Die gemessene irreversible Wirkung betrifft Smart-Tile-Zellen, während die Shape-Polygone erhalten bleiben.

`native-map-management.json` belegt zusätzlich 8 × 8 → 9 × 10 bei links +1 und oben +2 mit exakt entsprechender Verschiebung der Polygonpunkte. Originalbilder zeigen vier Eingabefelder, OK, Cancel, X und die Warnung „You cannot undo a map size change.“ Die gespeicherten Dateien belegen nicht die Wirkung rechter/unterer Beschnitte. `native-resize-limits.json`, `native-resize-negative.json` und `native-resize-paired.json` messen Eingabebegrenzung/Rundung auf einer 12 × 8-Karte; daraus wird keine allgemeine globale Regel behauptet.

## Editor und implementierte Teilfunktion

Der aktuelle `resizeMap` in `src/commands.ts` versetzt Entitäten um links/oben und ändert Breite/Höhe. Seine Polygonverschiebung entspricht den belegten Shape-Punkten. Er führt die Änderung aber über `Session.execute` in der Undo-Historie aus. `MapSettingsModal` in `src/main.ts` bietet vier Randfelder und Größen-Vorschau, jedoch keinen ausdrücklichen Cancel-Knopf und keine Nicht-Undo-Warnung. Der Editor besitzt derzeit für solche Tiles nur Flächenpolygone, kein separates `tiles.cells`-Raster. Ein Polygon-Clip wäre falsch, weil die Originalkonturen erhalten bleiben.

`src/features/verwaltung/map-resize-grid.ts` implementiert eine reine, zeilenweise Zelltransformation für ein künftiges getrenntes Tile-Raster: links/oben versetzen, außerhalb der neuen Karte liegende Zellen verwerfen, neue Felder leer auffüllen. `tests/map-resize-grid.test.mjs` vergleicht die exakten drei nativen Zellzustände und prüft die positive links/oben-Verschiebung sowie ungültige Eingaben. Das Modul ist **noch nicht an Dokument, Renderer oder Speicherung angeschlossen**; deshalb wird keine Tile-Parität behauptet.

## Isolierter Hostfall und Schnittstellenbedarf

`tools/groups/scenarios/dd038-map-size.cjs` ergänzt die Gruppe `verwaltung-karte-datei`; mit `DUNGEON_QA_ONLY_DD038=1` läuft nur DD-038. Er erstellt eine 12 × 8-Karte mit vier Polygonen an den Originalkoordinaten, prüft alle vier Eingaben und X-Abbruch, speichert links −3, öffnet die Karte im zweiten Prozess, erweitert links +3 und prüft Polygonerhalt, History sowie oben +2/links +1. Er schreibt Belege und `pass`/`open`/`deviation` fallgenau. Der Hostlauf wurde wegen des belegten Grafikslots **noch nicht gestartet**.

Für vollständige Gleichwirkung braucht die gemeinsame Integration:

1. Eine eigenständige Tile-Zellschicht im Kartendokument oder eine gleichwertige gespeicherte Repräsentation, getrennt von erhaltenen Shape-Polygonen. Die Transformation muss vor Verlust speichern und nach erneutem Erweitern die entfernten Zellen leer lassen; V2/V3-Migration, Renderer und History müssen diese Schicht behandeln. Das reine Rastermodul liefert die belegte Zelloperation.
2. Eine explizite History-Grenze für Resize, die das im Original angezeigte Nicht-Undo-Verhalten korrekt abbildet, ohne Dirty-/Save- und Textzustand zu beschädigen. Ob ältere, vor Resize liegende Undo-Einträge im Original weiterhin erreichbar sind, ist noch nicht direkt gemessen; kein pauschales Löschen der gesamten History aus dem Warntext ableiten.
3. Dialog-Hook für Warnung und einen funktionalen Cancel-Weg; die vorhandene X-Geste wird im Gruppenlauf auf unveränderten Zustand geprüft. Rechtes/unteres Beschneiden sowie Grenzen außerhalb der alten 12 × 8-Probe bleiben Originalmessungen.

Ausführung nach Freigabe des Grafikslots in frischem QA-Root: `DUNGEON_QA_ONLY_DD038=1 node tools/host-test.cjs --group verwaltung-karte-datei`, dann derselbe Aufruf mit `--restart`. Der zweite Lauf ist Voraussetzung für eine Aussage über frisches Öffnen.

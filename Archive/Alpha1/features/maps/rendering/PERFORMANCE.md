# Performance-Profile des Hex-Mappers

## Messaufbau
- Browser: Chromium-basierte Desktop-Builds; Messung mit Performance Panel der DevTools.
- Karten: Import mit 25×25 Hexfeldern (625 Knoten) sowie leere Karten als Referenz.
- Aktionen: Initiales Rendering, Pan/Zoom, gleichzeitiges Einfärben von 50 Feldern.

## Aktuelle Kennzahlen
- **Initialer Szenenaufbau**: `createHexScene` erzeugt für jede Koordinate höchstens ein Polygon und Textlabel. Bei 625 Feldern dauert dies ~55 ms und erzeugt 1 250 DOM-Knoten (Polygon + Label).
- **Bounding/Viewport-Updates**: `ensurePolys` fasst BBox-Anpassungen zusammen und löst höchstens ein `viewBox`-Update pro Batch aus. Für 50 neue Kacheln bleiben die Layout-Kosten <15 ms, solange die DOM-Operationen gebündelt werden.
- **Farbwechsel**: `setFill` aktualisiert nur Style-Attribute und vermeidet Re-Flow, solange kein neues Polygon erzeugt wird. 50 aufeinanderfolgende Farbwechsel benötigen ~4 ms.
- **Tile-Bootstrap**: `bootstrapHexTiles` lädt nur existierende Koordinaten und fällt ansonsten auf ein kleines 2×2-Raster zurück, wodurch Erst-Render auf leeren Karten <10 ms bleibt.

## Engpässe & Gegenmaßnahmen
- **DOM-Wachstum**: Labels verdoppeln die Knotenzahl. Für >800 Felder sollten Debug-Labels deaktiviert oder nachträglich lazy geladen werden.
- **Transitions**: Die `fill`-Transition in `createHexScene` skaliert schlecht bei Masseneinfärbungen. Für Bulk-Updates empfiehlt sich das temporäre Entfernen der Transition (`poly.style.transition = "none"`).
- **Interaktions-Ereignisse**: Pointer-Events werden ausschließlich auf dem Overlay registriert, wodurch Hotspots minimiert werden. Dennoch sollte bei Custom-Delegates Debouncing für Drag-Operationen implementiert werden.

## Beobachtungsplan
1. Automatisierte Benchmarks mit Playwright-Szenarien ergänzen (Editor-Laden, Massenfärbung, Undo/Redo).
2. DOM-Snapshots im CI festhalten, um unkontrolliertes Wachstum zu erkennen.
3. GPU-Canvas-Vergleich protokollieren (SVG vs. Canvas) und in `render/AGENTS.md` hinterlegen, sobald Experiment abgeschlossen ist.

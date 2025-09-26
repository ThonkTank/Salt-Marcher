# Hex Renderer Architektur

```
+------------------------------+
| renderHexMap (hex-render.ts) |
+------------------------------+
           | orchestriert
           v
+--------------------+    +----------------------+    +--------------------------+
| render/bootstrap.ts|--> | render/scene.ts      |    | render/camera-controller |
| Tiles + Bounds     |    | SVG, viewBox, Polys  |    | Pan/Zoom                 |
+--------------------+    +----------+-----------+    +-----------+--------------+
                                 |                            |
                                 v                            |
                      +--------------------------+            |
                      | render/coordinates.ts    |            |
                      | Screen ↔ Hex Mapping     |            |
                      +------------+-------------+            |
                                   |                          v
+---------------------------+       |            +------------------------------+
| render/interaction-       |<------+            | render/interactions.ts       |
| adapter.ts (Delegate-Mgr) |                    | Pointer- & Click-Fluss       |
+---------------------------+                    +------------------------------+
           ^
           |
           +--------------------------- render/interaction-delegate.ts (Default Events)
```

## Aufgabenverteilung

- **`hex-render.ts`** agiert als Orchestrator.
  - Nutzt `render/bootstrap.ts`, um Tiles zu laden und Basis-/Fallback-Koordinaten zu bestimmen.
  - Bindet Szene, Kamera, Koordinaten-Übersetzung und Interaktionsadapter zusammen und reicht `RenderHandles` (Fills, `ensurePolys`, Delegate-Switch, Cleanup) nach außen weiter.
- **`render/bootstrap.ts`** liefert Tiles + Bounds.
  - Kapselt die Vault-Abfrage und stellt ein stabiles 3×3-Fallback bereit, falls keine Tiles existieren oder das Laden fehlschlägt.
  - Liefert `base` und `initialCoords`, sodass Szene und Koordinaten-Mapper dieselben Bezugspunkte besitzen.
- **`render/scene.ts`** kapselt den Aufbau der SVG-Szene.
  - Verantwortlich für Polygone, Labels, Bounding-Box und die synchronisierte Aktualisierung von `viewBox` und Overlay-Abmessungen.
  - `ensurePolys` erzeugt fehlende Hexes und erweitert bei neuen Koordinaten automatisch die sichtbare Fläche.
- **`render/coordinates.ts`** kapselt das Screen↔Hex-Mapping.
  - Stellt den typisierten `HexCoordinateTranslator` zur Verfügung, der sowohl Interaktionen als auch externe Tools nutzen können.
- **`render/camera-controller.ts`** wickelt `attachCameraControls` ab und liefert ein Cleanup-Objekt, sodass `destroy()` alle Listener sicher entfernt.
- **`render/interaction-adapter.ts`** verwaltet Default-Delegate und Standard-Klickaktionen (`saveTile` + Öffnen im aktiven Leaf).
  - Stellt den `HexInteractionAdapter` bereit (`delegateRef`, `setDelegate`, `handleDefaultClick`).
- **`render/interactions.ts`** verwaltet Klick- und Pointer-Logik (inkl. Drag-Painting) auf Basis eines `HexInteractionDelegate`.
  - Sorgt für RequestAnimationFrame-Drosselung, Pointer-Capture sowie Reset von Zuständen innerhalb von `destroy()`.
- **`render/interaction-delegate.ts`** stellt den Default-Delegate bereit, der weiterhin `hex:click`-Events emittiert, aber das Ergebnis als `HexInteractionOutcome` interpretiert.
  - Externe Listener können über `detail.setOutcome(...)` ein explizites Ergebnis melden, statt `preventDefault` zu nutzen.

## Datenfluss

1. `renderHexMap` bootstrapt Tiles (`render/bootstrap.ts`) und erzeugt basierend auf vorhandenen Koordinaten eine `HexScene`.
2. `HexScene` baut SVG/Overlay und aktualisiert `viewBox` + Overlay-Area, sobald neue Polygone entstehen.
3. `createCoordinateTranslator` liefert Screen↔Hex-Funktionen für Interaktionen und Tools.
4. `createCameraController` aktiviert Pan/Zoom, während `createInteractionController` Pointer-Eingaben verarbeitet.
5. Interaktionen fragen den Delegate ab:
   - `"default"` → Renderer führt Standardaktion (`handleDefaultClick`) aus.
   - `"handled"` → keine weitere Aktion.
   - `"start-paint"` → Pointer wird gecaptured, weitere Pointer-Moves laufen durch den Delegate.
6. `RenderHandles.ensurePolys` kann von außen (z. B. TravelGuide) genutzt werden, um die Szene zu erweitern; Bounding-Box/Overlay wachsen automatisch mit.
7. `destroy()` ruft Szene-, Kamera- und Interaktions-Cleanup auf und verhindert Event-Leaks.

## Typisierte Schnittstellen

- **`HexScene` / `HexSceneConfig`** – definieren die öffentliche Oberfläche der Szene inkl. `ensurePolys`, `setFill`, `getViewBox` und `destroy()`.
- **`HexCameraController`** – Alias zu einem `Destroyable`, damit Kamera-Implementierungen austauschbar bleiben.
- **`HexCoordinateTranslator`** – liefert `toContentPoint` + `pointToCoord` und garantiert konsistente Basis-Koordinaten zwischen Szene und Interaktionen.
- **`HexInteractionAdapter`** – kapselt Delegate-Verwaltung + Default-Klick und stellt `delegateRef` für `createInteractionController` bereit.
- **`HexInteractionController`** – bezeichnet die Rückgabe von `createInteractionController` (Cleanup-Interface).

## Öffentliche API (`RenderHandles`)

| Methode | Beschreibung |
|---------|--------------|
| `svg`, `contentG`, `overlay` | Direkter Zugriff für Overlays/Marker. |
| `polyByCoord` | Map für Lookups (`"r,c" → SVGPolygonElement`). |
| `setFill(coord, color)` | Aktualisiert Inline-Farben inkl. `data-painted`-Marker. |
| `ensurePolys(coords)` | Ergänzt fehlende Hexes **und** passt `viewBox`/Overlay sofort an. |
| `setInteractionDelegate(delegate)` | Ersetzt den aktiven Delegate; `null` reaktiviert den Event-basierten Default. |
| `destroy()` | Entfernt SVG, löst Kamera-Listener, stoppt Pointer-Loops und leert Maps. |

## Erweiterungspunkte

- **Eigene Delegates:** Tools können `HexInteractionDelegate` implementieren und via `setInteractionDelegate` registrieren, um Ergebnisse explizit zu steuern (z. B. `"start-paint"`).
- **Event-Bridge:** Bestehende Listener können weiterhin `hex:click` konsumieren. Zusätzlich ermöglicht `detail.setOutcome(...)` den Übergang zur neuen API, ohne `preventDefault` als Seiteneffekt zu missbrauchen.
- **Koordinaten-Hooks:** Tools können `createCoordinateTranslator` erneut verwenden, wenn zusätzliche Overlays Screen-Koordinaten in Hex-Offsets übersetzen müssen.

## Cleanup-Garantien

- `render/camera-controller.ts`: entfernt alle Listener von `attachCameraControls` inkl. `window.blur`.
- `render/interactions.ts`: löst Pointer-Capture, stoppt laufende RAF-Schleifen und leert interne Sets.
- `render/scene.ts`: entfernt SVG aus dem DOM und gibt Maps frei.

Diese Struktur trennt Rendering, Kamera, Tile-Bootstrap und Interaktionslogik klar, erleichtert Tool-spezifische Delegates und verhindert Speicherlecks bei mehrfacher Montage.

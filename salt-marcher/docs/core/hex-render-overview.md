# Hex Renderer Architektur

```
+------------------------------+
| renderHexMap (hex-render.ts) |
+------------------------------+
           | orchestriert
           v
+---------------------+    +-------------------------+    +------------------------------+
| render/scene.ts     |--> | render/camera-          |--> | render/interactions.ts       |
| SVG, viewBox, Polys |    | controller.ts           |    | Pointer- & Click-Fluss       |
+---------------------+    +-------------------------+    +------------------------------+
           ^                                                     |
           | setInteractionDelegate                              |
           +--------------------------- render/interaction-delegate.ts
```

## Aufgabenverteilung

- **`hex-render.ts`** lädt Tiles, bestimmt das initiale Grid und verbindet die Teilmodule.
  - Reicht `ensurePolys` und `setFill` als Teil der öffentlichen `RenderHandles` durch.
  - Stellt `setInteractionDelegate` bereit, damit Editoren eine typsichere Delegate-Instanz injizieren können.
  - Default-Verhalten für Klicks: erstellt bei Bedarf ein Tile (`saveTile`) und öffnet es im aktiven Leaf.
- **`render/scene.ts`** kapselt den Aufbau der SVG-Szene.
  - Verantwortlich für Polygone, Labels, Bounding-Box und die synchronisierte Aktualisierung von `viewBox` und Overlay-Abmessungen.
  - `ensurePolys` erzeugt fehlende Hexes und erweitert bei neuen Koordinaten automatisch die sichtbare Fläche.
- **`render/camera-controller.ts`** wickelt `attachCameraControls` ab und liefert ein Cleanup-Objekt, sodass `destroy()` alle Listener sicher entfernt.
- **`render/interactions.ts`** verwaltet Klick- und Pointer-Logik (inkl. Drag-Painting) auf Basis eines `HexInteractionDelegate`.
  - Sorgt für RequestAnimationFrame-Drosselung, Pointer-Capture sowie Reset von Zuständen innerhalb von `destroy()`.
- **`render/interaction-delegate.ts`** stellt den Default-Delegate bereit, der weiterhin `hex:click`-Events emittiert, aber das Ergebnis als `HexInteractionOutcome` interpretiert.
  - Externe Listener können über `detail.setOutcome(...)` ein explizites Ergebnis melden, statt `preventDefault` zu nutzen.

## Datenfluss

1. `renderHexMap` lädt Tiles (`hex-notes.ts`) und erzeugt basierend auf vorhandenen Koordinaten einen `HexScene`.
2. `HexScene` baut SVG/Overlay und aktualisiert `viewBox` + Overlay-Area, sobald neue Polygone entstehen.
3. `createCameraController` aktiviert Pan/Zoom, während `createInteractionController` Pointer-Eingaben verarbeitet.
4. Interaktionen fragen den Delegate ab:
   - `"default"` → Renderer führt Standardaktion (`handleDefaultClick`) aus.
   - `"handled"` → keine weitere Aktion.
   - `"start-paint"` → Pointer wird gecaptured, weitere Pointer-Moves laufen durch den Delegate.
5. `RenderHandles.ensurePolys` kann von außen (z. B. TravelGuide) genutzt werden, um die Szene zu erweitern; Bounding-Box/Overlay wachsen automatisch mit.
6. `destroy()` ruft Szene-, Kamera- und Interaktions-Cleanup auf und verhindert Event-Leaks.

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

## Cleanup-Garantien

- `render/camera-controller.ts`: entfernt alle Listener von `attachCameraControls` inkl. `window.blur`.
- `render/interactions.ts`: löst Pointer-Capture, stoppt laufende RAF-Schleifen und leert interne Sets.
- `render/scene.ts`: entfernt SVG aus dem DOM und gibt Maps frei.

Diese Struktur trennt Rendering, Kamera und Interaktionslogik klar, erleichtert Tool-spezifische Delegates und verhindert Speicherlecks bei mehrfacher Montage.

## To-Do
- [Hex-Renderer modularisieren](../../../todo/hex-renderer-modularization.md)

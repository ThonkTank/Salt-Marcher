# Map Layer Adapter Overview

## Strukturdiagramm
```
CartographerPresenter
    └─ TravelGuide UI
         └─ Map-Layer Adapter (`createMapLayer`)
              └─ Core Hex Renderer (`renderHexMap`)
```

## Verantwortlichkeiten & Datenfluss
- **Presenter → Adapter:** übergibt Obsidian-App-Instanz, Host-Element, aktive Karten-Datei sowie `RenderLayerOptions` (Alias zu `HexOptions`). Die Optionen steuern Hex-Geometrie (Radius, Farben etc.).
- **Adapter → Renderer:** ruft `renderHexMap` mit denselben Optionen auf und verwaltet das zurückgegebene `RenderHandles`-Objekt. Dadurch bleiben UI-spezifische Erweiterungen (Hit-Testing, Layer-Lifecycle) vom Renderer getrennt.
- **Adapter → UI-Tools:** stellt eine `MapLayer`-API bereit, die Polygone nachlädt (`ensurePolys`), Koordinaten indiziert (`polyToCoord`) und Zentren für Cursor-Interaktionen liefert (`centerOf`).

## Kern-Schnittstellen
### `RenderLayerOptions`
- Alias zu `HexOptions` aus `src/core/options.ts`.
- Dient als zentrale Typdefinition für Rendering-Parameter (z. B. Hex-Radius, Farbpaletten).
- Verhindert `any`-Parameter in `createMapLayer` und erlaubt zukünftige Adapter-spezifische Erweiterungen über Intersection-Types.

### `MapLayer`
| Feld             | Beschreibung |
| ---------------- | ------------ |
| `handles`        | Rohzugriff auf die `RenderHandles` des Renderers (SVG, Camera, Polygon-Map). |
| `polyToCoord`    | `WeakMap` von SVG-Polygonen zu Raster-Koordinaten für Hit-Tests (`elementFromPoint`). |
| `ensurePolys()`  | Lädt fehlende Hex-Polygone nach und aktualisiert anschließend den Index. Delegiert typgesichert an `RenderHandles.ensurePolys`. |
| `centerOf()`     | Ermittelt das Zentrum eines Hex (BBox) und sorgt bei Bedarf für das Nachladen der Polygone. |
| `destroy()`      | Bricht Rendering-Verknüpfungen ab (Renderer übernimmt internes Cleanup). |

### `RenderHandles.ensurePolys`
- Erwartet `Coord[]` (d. h. `{ r: number; c: number }`).
- Fügt nur Polygone hinzu, die im Renderer noch fehlen, und erweitert intern die ViewBox/Overlay.
- Wird im Adapter zu einer No-Op degradiert, falls ein Renderer ohne `ensurePolys` geliefert würde; dadurch bleiben historische Implementierungen kompatibel, ohne `any`-Casts zu benötigen.

## Skriptbeschreibung
### `src/apps/cartographer/travel/ui/map-layer.ts`
- Initialisiert den Renderer über `renderHexMap` und baut den Polygon-Index (`WeakMap`) für schnelle Hit-Tests.
- Exportiert `createMapLayer`, das `RenderLayerOptions` akzeptiert und die `MapLayer`-API kapselt.
- Enthält ein internes Fallback (`ensureHandlesPolys`), das `RenderHandles.ensurePolys` typsicher aufruft und neu angelegte Polygone registriert.
- Liefert Hilfsfunktionen wie `centerOf` und `destroy`, damit höhere UI-Schichten (Travel-Mode, Tools) nicht direkt mit Renderer-Details arbeiten müssen.

## Feature-Highlights
- **Typsichere Optionen:** Adapter übernimmt unverändert die Definition aus dem Core, wodurch UI-Konfigurationen mit IntelliSense und Compiler-Schutz versehen sind.
- **Erweiterbares Protokoll:** `ensurePolys` ist klar dokumentiert; neue Renderer können dieselbe Signatur implementieren oder per Feature-Flag deaktivieren.
- **Indexierte Hit-Tests:** Der Adapter hält Polygon→Koordinaten-Mapping synchron, auch wenn Polygone dynamisch entstehen.


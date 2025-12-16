# Overlay Layers

**Zweck**: Map overlay layer implementations for visual representations of climate, weather, terrain features, factions, and locations on hex maps.

## Inhalt

| Element | Beschreibung |
|---------|--------------|
| climate-overlay-layer.ts | **Unified climate overlays**: temperature (red/blue), precipitation (blue), cloudcover (white/gray), wind (arrows) - parameterized by channel |
| gradient-overlay-layer.ts | **Consolidated gradient layers**: factory + elevation/fertility/groundwater implementations (Wave 5) |
| marker-layers.ts | **Consolidated marker layers**: location markers (emoji/SVG icons) + building indicators (condition-colored) (Wave 5) |
| rain-shadow-overlay-layer.ts | Rain shadow effects showing precipitation blocking by mountains with percentage labels |
| terrain-feature-layer.ts | Multi-hex features (rivers, roads, cliffs, borders, elevation lines) as SVG paths |
| territory-layers.ts | **Consolidated territory layers**: faction territories + location influence areas (Wave 5) |
| weather-overlay-layer.ts | Weather condition icons (emoji) with severity-based scaling and opacity |

## Verbindungen

- **Verwendet von**: cartographer (Cartographer editor), session-runner (Session Runner map display)
- **Abhängig von**:
  - `@services/climate` (climate calculations for temperature, rain shadow)
  - `@geometry` (coordinate conversions, hex calculations)
  - `@features/maps/overlay` (OverlayLayer interface, factory functions)
  - `@features/maps/rendering/core` (hex geometry, corner/edge calculations)
  - `@features/maps/state` (overlay stores: faction, location, terrain features, weather)

## Layer Priority System

Layers are rendered in priority order (lower priority = rendered first, appears behind):

| Priority | Layer | File | Description |
|----------|-------|------|-------------|
| 1 (WEATHER) | weather-overlay | weather-overlay-layer.ts | Weather icons (background) |
| 3 (INFLUENCE) | location-influence | territory-layers.ts | Location territorial control |
| 4 | rain-shadow | rain-shadow-overlay-layer.ts | Mountain precipitation blocking |
| 5 (FACTION) | faction-overlay | territory-layers.ts | Faction territories |
| 6 (ELEVATION_LINE) | terrain-feature (elevation) | terrain-feature-layer.ts | Contour lines |
| 7 (RIVER) | terrain-feature (rivers) | terrain-feature-layer.ts | Water features |
| 8 (ROAD) | terrain-feature (roads) | terrain-feature-layer.ts | Travel routes |
| 9 (CLIFF) | terrain-feature (cliffs) | terrain-feature-layer.ts | Impassable terrain |
| 11 (LOCATION) | location-marker | marker-layers.ts | Location icons |
| 12 (BUILDING) | building-indicator | marker-layers.ts | Building indicators (top-most) |
| 49-52 (CLIMATE) | climate (temperature, precipitation, cloudcover, wind) | climate-overlay-layer.ts | Climate gradients and wind arrows |

**Note:** After Wave 5 consolidation, multiple layers share files:
- **territory-layers.ts**: `createFactionOverlayLayer()`, `createLocationInfluenceLayer()`
- **marker-layers.ts**: `createLocationMarkerLayer()`, `createBuildingIndicatorLayer()`

## Implementation Patterns

### Layer Interface (SimpleOverlayLayer)

All layers now implement the `SimpleOverlayLayer` interface for better encapsulation:

```typescript
interface SimpleOverlayLayer {
  readonly id: string;
  readonly name: string;
  readonly priority: number;

  subscribe(callback: () => void): () => void;  // Kapselt State-Management
  getCoordinates(): readonly HexCoord[];
  getRenderData(coord: HexCoord): OverlayRenderData | null;
  destroy(): void;
}
```

**Vorteile gegenüber Legacy `OverlayLayer`:**
- Keine Exposition von `state: WritableStore<T>` → Bessere Kapselung
- Kein `store.value` Bug möglich (nur `subscribe()` API)
- Layers können internen State beliebig verwalten (WritableStore, Map, etc.)

### Fill-Based Overlays
Most climate/weather layers use `type: "fill"` with color and opacity:
```typescript
return {
  type: "fill",
  color: "rgb(200, 100, 100)",
  fillOpacity: "0.5",
  strokeWidth: "0",
  metadata: { label: "...", tooltip: "..." }
};
```

### SVG Element Overlays
Markers, icons, and arrows use `type: "svg"` with custom element creation:
```typescript
return {
  type: "svg",
  createElement: (coord) => createCustomElement(coord),
  updateElement: (element, coord) => updateCustomElement(element, coord),
  metadata: { label: "...", tooltip: "..." }
};
```

### Parameterized Climate Layer
Climate overlays now use a single parameterized factory that accepts a channel parameter:
```typescript
export type ClimateChannel = "temperature" | "precipitation" | "cloudcover" | "wind";

// Usage:
const tempLayer = createClimateOverlayLayer("temperature", app, mapFile);
const precipLayer = createClimateOverlayLayer("precipitation", app, mapFile);
const cloudLayer = createClimateOverlayLayer("cloudcover", app, mapFile);
const windLayer = createClimateOverlayLayer("wind", app, mapFile, radius, base, padding);
```

Each channel has its own configuration (field path, gradient, range, priority) defined in `CHANNEL_CONFIGS`.

**Benefits:**
- Eliminated 80%+ code duplication across 4 layer files (587 → 433 LOC, 26% reduction)
- Single source of truth for climate rendering logic
- Easier to add new climate channels or modify gradients

## Coordinate System Note

All layers use `@geometry` imports for coordinate operations (refactored from `src/features/maps/coordinate-system/`):
```typescript
import { coordToKey } from "@geometry";
```

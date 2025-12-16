# Overlay

Einheitliches System für Map-Overlays mit priority-based rendering.

## Contents

| Element | Beschreibung |
|---------|--------------|
| `index.ts` | Barrel exports für das gesamte Overlay-System (types, manager, layers) |
| `types.ts` | OverlayLayer Interfaces (legacy + SimpleOverlayLayer), OverlayRenderData, OverlayManager |
| `overlay-manager.ts` | Zentrale Layer-Verwaltung und Rendering (simplified, no culling/scheduling) |
| `layer-utils.ts` | **Consolidated utilities**: coordinate generation, bounds calculation, opacity helpers, SVG constants (Wave 5) |
| `layer-registry.ts` | Single source of truth für Layer-Metadaten (priorities, groups, panel config) |
| `layers/` | Layer implementations (7 consolidated files: climate, gradient, marker, territory, rain-shadow, terrain-feature, weather) |
| `factories/` | Generic factory patterns (icon-overlay, territory-overlay) - not yet integrated |

## Connections

**Used by:**
- `src/workmodes/cartographer/` - Map-Editor (Layer-Registration, Layer-Control-Panel)
- `src/features/maps/rendering/hex-render.ts` - Map rendering orchestration

**Depends on:**
- `@services/state` - WritableStore für State-Management
- `@services/logging/logger` - Plugin logger für Debug-Output
- `@geometry` - coordToKey/keyToCoord für Koordinaten-Serialisierung
- `src/features/maps/rendering/types` - HexCoord type definitions
- `src/features/maps/data/tile-repository` - TileStore für Weather-Layer

## Public API

```typescript
// Layer Types
import type {
    SimpleOverlayLayer,     // Neues, vereinfachtes Interface
    AnyOverlayLayer,        // Union beider Interfaces
    OverlayRenderData,
    OverlayManager,
    OverlayManagerConfig
} from "@features/maps/overlay";

// Manager
import { createOverlayManager } from "@features/maps/overlay";

// Helpers
import {
    calculateBounds,
    type ViewportBounds
} from "@features/maps/overlay";

// Layer Registry (Metadata)
import {
    LAYER_PRIORITY,
    LAYER_GROUP,
    LAYER_REGISTRY,
    getVisibleLayers
} from "@features/maps/overlay";

// Layer Factories
import {
    // Climate overlays (unified, parameterized by channel)
    createClimateOverlayLayer,
    // Gradient overlays (elevation, fertility, groundwater)
    createGradientOverlayLayer,
    createElevationOverlayLayer,
    createFertilityOverlayLayer,
    createGroundwaterOverlayLayer,
    // Rain shadow overlay
    createRainShadowOverlayLayer,
    // Territory layers (faction + location influence)
    createFactionOverlayLayer,
    createLocationInfluenceLayer,
    // Marker layers (location markers + building indicators)
    createLocationMarkerLayer,
    createBuildingIndicatorLayer,
    getBuildingConditionClass,
    // Weather overlay
    createWeatherOverlayLayer,
    getWeatherEmoji,
    getWeatherDescription,
    // Terrain features
    createTerrainFeatureLayer,
    createAllTerrainFeatureLayers
} from "@features/maps/overlay";

// Coordinate Helpers
import {
    getHexCoordsFromTiles,
    getHexCoordsWithFallback
} from "@features/maps/overlay";
```

## Usage Example

```typescript
// Manager erstellen
const manager = createOverlayManager({
    contentG: scene.contentG,
    mapPath: mapFile.path,
    scene,
    hexGeometry: { radius, padding, base },
});

// Layer registrieren (beide Interface-Typen werden unterstützt)
manager.register(createClimateOverlayLayer("temperature", app, mapFile));
manager.register(createClimateOverlayLayer("precipitation", app, mapFile));
manager.register(createFactionOverlayLayer(app, mapFile));

// Layer-Visibility konfigurieren
manager.setLayerConfig("temperature-overlay", true, 0.8);

// Cleanup
manager.destroy();
```

## Coordinate Generation Helpers

```typescript
// Erzeugen von Hex-Koordinaten basierend auf Tile-Daten
const tileStore = getTileStore(app, mapPath);
const coords = getHexCoordsFromTiles(tileStore.state.get().tiles);
// Gibt alle Koordinaten innerhalb des Bounding Box der Tiles zurück

// Mit Fallback für leere Maps
const coords = getHexCoordsWithFallback(
    tileStore.state.get().tiles,
    { r: 5, c: 5 },  // Fallback-Zentrum
    10                 // Fallback-Radius
);
// Gibt Bounding Box zurück, falls Tiles existieren
// Sonst: Radius um Fallback-Zentrum
```

## Key Concepts

**Priority-Based Rendering**
- Lower priority renders first (behind), higher priority renders last (on top)
- Priority ranges: Opaque (0-29) → Transparent (50-99) → Hidden (100+)
- See `docs/core/render-pipeline.md` for complete priority documentation

**Two Render Modes**
- **Fill**: Modifies hex polygon appearance via `scene.setFactionOverlay()` - efficient for simple color overlays
- **SVG**: Creates custom SVG elements positioned at hex coordinates - flexible for complex shapes (markers, arrows)

**Whole-Layer Rendering**
- Optional `renderWhole()` method for complex multi-coordinate elements (e.g., river paths spanning multiple hexes)
- Manager calls once per render cycle instead of per-coordinate

**Layer Interface Migration**

**Legacy Interface** (OverlayLayer):
```typescript
interface OverlayLayer<TState> {
    state: WritableStore<TState>;  // Exponiert internen State
    getRenderData(coord: HexCoord): OverlayRenderData | null;
    getCoordinates(): readonly HexCoord[];
    // ...
}
```

**Neues Interface** (SimpleOverlayLayer):
```typescript
interface SimpleOverlayLayer {
    subscribe(callback: () => void): () => void;  // Kapselt State
    getRenderData(coord: HexCoord): OverlayRenderData | null;
    getCoordinates(): readonly HexCoord[];
    // ...
}
```

**Vorteile:**
- Bessere Kapselung (State nicht exponiert)
- Kein `store.value` Bug möglich (nur `subscribe()` API)
- Einheitliches Pattern für alle Layer

**Layer Utilities** (`layer-utils.ts` - consolidated from layer-utils, layer-helpers, overlay-coords):
- `ViewportBounds`: Type für rechteckige Bounds im Hex-Koordinatenraum
- `calculateBounds()`: Viewport-Bounds aus Koordinaten-Array
- `coordInBounds()`: Koordinate innerhalb Bounds?
- `getHexCoordsFromTiles()`, `getHexCoordsWithFallback()`: Coordinate generation helpers
- `normalizeCoord()`, `normalizeColor()`, `normalizeString()`: Normalization utilities
- `clampOpacity()`, `deviationOpacity()`, `severityOpacity()`: Opacity helpers
- `SVG_NS`: SVG namespace constant

**Reactive State**
- Each layer manages its own state (WritableStore or internal)
- Manager subscribes to state changes and auto-rerenders
- Layer state updates trigger minimal DOM updates (diff-based)

**Lifecycle Management**
- Manager handles registration, z-ordering, subscription, cleanup
- Each layer implements `destroy()` for resource cleanup
- Automatic cleanup of SVG elements and fill coordinates when layer unregisters

**Layer Registry**
- Single source of truth consolidating metadata from 3 previous locations
- Maps panel IDs to overlay IDs (one-to-many for parent controls)
- Provides consistent priorities, groups, and UI configuration

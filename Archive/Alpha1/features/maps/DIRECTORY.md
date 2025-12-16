# Maps Feature

## Purpose

Hex-based map rendering, coordinate systems, terrain management, and map state persistence. Provides cartography infrastructure for all workmodes.

## Architecture Layer

**Features** - Shared systems layer (mid-level)

## Public API

### Coordinate System

**Core Types:**

```typescript
// Import from @geometry (via @services/geometry)
import type { AxialCoord, CubeCoord } from "@geometry";

// Axial coordinates: { q, r } (primary coordinate system)
type AxialCoord = { q: number; r: number };

// Cube coordinates: { x, y, z } (for geometric operations)
type CubeCoord = { x: number; y: number; z: number };
```

**Type Aliases for Domain Context:**

```typescript
// From src/features/maps/config/store-interfaces.ts
type TileCoord = AxialCoord;  // Storage/data layer APIs

// From src/features/maps/rendering/types.ts
type HexCoord = AxialCoord;   // Rendering layer APIs
```

**JSON Key Format:**
- Tiles stored as `"q,r"` keys (e.g., `"5,10"` = q=5, r=10)
- See `src/features/maps/data/tile-json-io.ts` for serialization

**Coordinate Operations:**

```typescript
import {
  axialToCube,      // Convert to cube for geometry ops
  cubeToAxial,      // Convert back to axial
  axialDistance,    // Distance between hexes
  neighbors,        // Adjacent hexes
  coordsInRadius,   // Hexes in radius
  line,             // Hex line between points
  coordToKey,       // Serialize to "q,r" string
  keyToCoord,       // Parse from "q,r" string
} from "@geometry";
```

**Migration Notes:**
- OddRCoord **removed** (no longer exists)
- All coordinate systems now use AxialCoord as base
- See [src/services/geometry/DIRECTORY.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/src/services/geometry/DIRECTORY.md) for full documentation

### Terrain & Flora

```typescript
// Import from: src/features/maps/config
import type {
  TerrainType,    // e.g., "plains", "forest", "mountain"
  FloraType,      // e.g., "grassland", "oak", "pine"
  MoistureLevel,  // "parched" | "dry" | "normal" | "wet" | "soaked"
  IconDefinition,
} from "src/features/maps/config/terrain";

import {
  getTerrainTypes,
  getFloraTypes,
  getMoistureLevels,
  TERRAIN_ICONS,
  FLORA_ICONS,
  getMovementSpeed,
} from "src/features/maps/config/terrain";
```

### Tile Data & State

```typescript
// Import from: src/features/maps (recommended API)
import type { TileData } from "@domain";
import { getMapSession } from "src/features/maps/session";

// MapSession pattern - get-or-create factory for map stores
const session = getMapSession(app, mapFile);

// Direct tile access via TileCache
const tileData = session.tileCache.get("5,10");  // Get tile at q=5, r=10
session.tileCache.set("5,10", { terrain: "plains" });  // Set tile

// Batch operations
session.tileCache.setBatch([
  { key: "0,0", data: { terrain: "plains" } },
  { key: "1,0", data: { terrain: "forest" } },
]);

// Reactive state
session.tileCache.subscribe((state) => {
  // state.tiles: Map<CoordKey, TileRecord>
  // state.loaded: boolean
  // state.version: number
});

// Low-level file operations (rarely needed)
import { loadTile, saveTile, deleteTile } from "src/features/maps/data/tile-repository";
```

**TileData Structure:**
```typescript
{
  // Coordinates NOT stored in TileData itself - tiles keyed by "q,r" in JSON
  terrain: TerrainType;    // Base terrain
  flora?: FloraType;       // Optional vegetation
  moisture?: MoistureLevel; // Water level
  elevation?: number;      // Height
  region?: string;         // Area/faction name
  color?: string;          // Custom region color
  // ... other properties
}

// Tiles accessed via coordinate keys in JSON:
// json.tiles["5,10"] → TileData for coord { q: 5, r: 10 }
```

### Map Rendering

```typescript
// Import from: src/features/maps/rendering
import type { RenderHandles } from "src/features/maps/rendering/hex-render";

import { renderHexMap } from "src/features/maps/rendering/hex-render";

// Render map to SVG container
const handles = renderHexMap(container, {
  app,              // Obsidian App
  mapPath,          // Path to map file
  hexOptions,       // Rendering options (size, colors, etc.)
  interactive,      // Enable click handlers
});

// Cleanup
handles.dispose();
```

### Overlay Layers

```typescript
// Import from: src/features/maps/overlay
import type { SimpleOverlayLayer, OverlayRenderData } from "src/features/maps/overlay";

// Weather layer factory (extracts common patterns)
import { createWeatherLayer } from "src/features/maps/overlay/factories";

// Create a custom weather overlay
const myLayer = createWeatherLayer(app, mapFile, {
  id: "my-overlay",
  name: "My Overlay",
  priority: 3,
  initialState: { data: new Map() },

  // Extract data from tile changes
  onTileUpdate: (tileState, currentState) => {
    const data = new Map();
    for (const [_, record] of tileState.tiles) {
      const value = record.data.someProperty;
      if (value !== undefined) {
        data.set(coordToKey(record.coord), value);
      }
    }
    return { data };
  },

  // Render each coordinate
  getRenderData: (coord, state) => {
    const value = state.data.get(coordToKey(coord));
    if (!value) return null;
    return {
      type: "fill",
      color: getColor(value),
      fillOpacity: String(getOpacity(value)),
    };
  },
});

// Coordinate generation helpers
import { getHexCoordsFromTiles, getHexCoordsWithFallback } from "src/features/maps/overlay";

const coords = getHexCoordsFromTiles(tileStore.state.get().tiles);
const coordsWithFallback = getHexCoordsWithFallback(tiles, { q: 5, r: 5 }, 15);

// Layer utilities (Wave 6)
import { normalizeCoord, clampOpacity, deviationOpacity, SVG_NS } from "src/features/maps/overlay";

// Layer registry (Wave 6) - Single source of truth for layer metadata
import { LAYER_PRIORITY, LAYER_GROUP, LAYER_REGISTRY, getVisibleLayers } from "src/features/maps/overlay";
```

**Available overlay layers:**
- Climate (`climate-overlay-layer.ts`) - Parameterized climate visualization (temperature, precipitation, cloudcover, wind)
- Elevation (`elevation-overlay-layer.ts`) - Elevation heatmap using gradient factory
- Fertility (`fertility-overlay-layer.ts`) - Soil fertility visualization using gradient factory
- Groundwater (`groundwater-overlay-layer.ts`) - Groundwater levels using gradient factory
- Rain Shadow (`rain-shadow-overlay-layer.ts`) - Mountain precipitation blocking
- Weather (`weather-overlay-layer.ts`) - Current weather conditions
- Faction (`faction-overlay-layer.ts`) - Faction territory control
- Location Marker (`location-marker-layer.ts`) - Settlement/location icons
- Location Influence (`location-influence-layer.ts`) - Location area of influence
- Building Indicator (`building-indicator-layer.ts`) - Building status indicators
- Terrain Feature (`terrain-feature-layer.ts`) - Multi-hex features (rivers, roads, cliffs, elevation lines, borders)
- Gradient Factory (`gradient-overlay-layer.ts`) - Reusable factory for creating gradient-based overlays (Wave 3)

### Regions & Factions

```typescript
// Import from: src/features/maps/config
import type { Region } from "src/features/maps/config/region";

import {
  validateRegion,
  validateRegionList,
  RegionValidationError,
} from "src/features/maps/config/region";

import {
  DEFAULT_FACTION_COLORS,
  getFactionColor,
} from "src/features/maps/config/faction-colors";
```

### Map Management

```typescript
// Import from: src/features/maps/data
import {
  createHexMapFile,       // Create new map
  deleteMapAndTiles,      // Delete map + all tiles
  getAllMapFiles,         // List all maps in vault
} from "src/features/maps/data/map-repository";
```

## Internal Implementation (Do Not Import)

### Rendering Internals

- `rendering/hex-render.ts` - Main rendering orchestration (combines terrain, icons, overlays)
- `rendering/core/hex-geom.ts` - Hex geometry calculations (pixel coords, vertices)
- `rendering/core/camera.ts` - Camera pan/zoom management (consolidated from split implementation)
- `rendering/icons/` - Icon rendering system (symbols, layers)
- `rendering/gradients/color-mapping.ts` - Color gradient interpolation functions for elevation/moisture
- `rendering/interactions/` - Click handlers and interactive elements
- `rendering/scene/` - Scene management and SVG coordinate system

### Data Layer Internals

- `data/tile-cache.ts` - Unified tile cache implementation
- `data/tile-json-io.ts` - JSON tile serialization/deserialization
- `data/tile-repository.ts` - Tile CRUD operations
- `data/tile-note-repository.ts` - Tile note management

### State Management Internals
- `state/faction-overlay-store.ts` - Faction overlay state
- `state/terrain-feature-store.ts` - Terrain features (rivers, roads)

### Performance Tracking

- `performance/metrics.ts` - Performance monitoring (for DevKit)

## Allowed Dependencies

- **Services** - `src/services/state` for reactive stores, `@services/geometry` for coordinate system
- **Obsidian API** - `App`, `Vault`, `TFile` for vault access
- **Third-party** - `simplex-noise` for procedural generation

## Forbidden Dependencies

- ❌ `src/workmodes/*` - Features cannot depend on applications
  - Exception: `import type { ... } from "workmodes/..."` (type-only imports allowed)
- ❌ Other features - Each feature should be independent
  - If you need cross-feature state, use `src/services/state` stores

**Note**: The coordinate system previously located in `src/features/maps/coordinate-system/` has been refactored to `src/services/geometry` and should be imported via `@services/geometry`.

## Usage Patterns

### Rendering a Map

```typescript
import { renderHexMap } from "src/features/maps/rendering/hex-render";
import { DEFAULT_HEX_OPTIONS } from "src/features/maps/config/options";

const container = document.querySelector("#map-container") as SVGSVGElement;

const handles = renderHexMap(container, {
  app,
  mapPath: "Maps/my-world.md",
  hexOptions: DEFAULT_HEX_OPTIONS,
  interactive: true,
});

// Later: cleanup
handles.dispose();
```

### Working with Coordinates

```typescript
import type { AxialCoord } from "@services/geometry";
import { axialDistance, neighbors, line } from "@services/geometry";

// Create coordinates (plain objects)
const coord1: AxialCoord = { q: 0, r: 0 };
const coord2: AxialCoord = { q: 2, r: 3 };

// Calculate distance
const distance = axialDistance(coord1, coord2);

// Get neighbors
const adjacent = neighbors(coord1);

// Draw line between two points
const path = line(coord1, coord2);
```

### Loading/Saving Tiles

```typescript
import type { AxialCoord } from "@geometry";
import { coordToKey } from "@geometry";
import { getMapSession } from "src/features/maps/session";

// Get MapSession for a map file
const session = getMapSession(app, mapFile);
const { tileCache } = session;

// Subscribe to changes
tileCache.subscribe(state => {
  console.log(`Map has ${state.tiles.size} tiles, loaded: ${state.loaded}`);
});

// Read a tile
const coord: AxialCoord = { q: 1, r: 1 };
const tile = tileCache.get(coordToKey(coord));

// Save a tile (synchronous, debounced persistence)
tileCache.set(coordToKey(coord), {
  terrain: "forest",
  flora: "oak",
});

// Force immediate save
await tileCache.flush();
```

### Creating a New Map

```typescript
import { createHexMapFile } from "src/features/maps/data/map-repository";
import { MapDimensions } from "src/features/maps/config/map-dimensions";

// Create a map from travel days (most common)
const dimensions = MapDimensions.fromTravelDays(5); // 5 days = 15 tile radius
await createHexMapFile(app, {
  name: "New World",
  dimensions,
  generation: {
    coastEdges: ["N", "SE"]
  }
});
```

## Storage Format

Maps use dual-file storage:
- `Maps/my-world.md` - Markdown file with frontmatter (`smMap: true`)
- `Maps/my-world.tiles.json` - Binary tile data (96x faster, 95% smaller)

**Why JSON storage?**
- 96x faster loading (2000ms → 20ms for 1000 tiles)
- 95% smaller (500KB → 25KB)
- Preserves markdown for user notes/links

## Testing

Test files: `devkit/testing/unit/features/maps/`

### Key Test Suites

- `coordinate-conversion.test.ts` - Coordinate system conversions
- `tile-json-repository.test.ts` - Tile persistence
- `color-mapping.test.ts` - Gradient rendering
- `undo-manager-integration.test.ts` - Undo/redo

### Test Coverage

- 235 tests for coordinate system (100% conversion coverage)
- 36 tests for rendering
- 24 tests for overlays
- Target: 95% for base classes, 80% for concrete implementations

## Design Principles

1. **Axial Coordinate System** - Simple (q, r) coordinates for all map operations
2. **Layered Rendering** - Independent SVG layers (terrain, icons, overlays)
3. **Repository Pattern** - All vault I/O abstracted behind repositories
4. **Reactive State** - Tile changes propagate via stores
5. **Performance-First** - JSON storage, caching, incremental rendering

## Common Pitfalls

### ❌ Don't Mix Coordinate Systems

```typescript
import { axialDistance } from "@geometry";

// ✅ Good: Use AxialCoord consistently
const coord1: AxialCoord = { q: 0, r: 0 };
const coord2: AxialCoord = { q: 1, r: 1 };
const distance = axialDistance(coord1, coord2);

// ✅ Good: Convert to Cube only for specific geometric operations
const cube = axialToCube(coord1);
const rounded = cubeRound(cubeLerp(cube1, cube2, 0.5));
const result = cubeToAxial(rounded);

// ❌ Bad: OddRCoord no longer exists!
// const oddR = { r: 0, c: 0 };  // REMOVED - use AxialCoord instead
```

### ❌ Don't Access Vault Directly

```typescript
// Bad: Bypasses repository caching!
const content = await app.vault.read(file);

// Good: Use repository
const tiles = await loadTiles(app, mapPath);
```

### ❌ Don't Forget to Dispose Render Handles

```typescript
// Bad: Memory leak!
renderHexMap(container, options);

// Good: Cleanup on disposal
const handles = renderHexMap(container, options);
return () => handles.dispose();
```

## Architecture Notes

**Why features layer?**
- Maps are used by multiple workmodes (Cartographer, Session Runner, Almanac)
- Domain logic independent of any specific application
- Can evolve without breaking multiple workmodes

**Why Axial coordinates?**
- Simpler than offset coordinates for distance/neighbors
- Natural conversion to cube for geometric operations
- See [src/services/geometry/DIRECTORY.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/src/services/geometry/DIRECTORY.md) for full rationale

**Why dual-file storage (MD + JSON)?**
- Markdown preserves Obsidian linking, notes, frontmatter
- JSON provides 96x faster loading for large maps
- Users can still edit markdown metadata manually

## Related Documentation

- [docs/core/map-rendering-architecture.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/docs/core/map-rendering-architecture.md) - Rendering deep dive
- [docs/core/coordinate-systems.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/docs/core/coordinate-systems.md) - Coordinate math
- [CLAUDE.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/CLAUDE.md#architecture-standards) - Architecture standards

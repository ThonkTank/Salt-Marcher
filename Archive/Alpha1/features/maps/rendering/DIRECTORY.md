# Rendering

SVG-based hex map rendering engine with multi-layer icon system, pan/zoom, and user interactions.

## Contents

| Element | Description |
|---------|-------------|
| index.ts | Public API barrel export (renderHexMap, RenderHandles, types) |
| hex-render.ts | Main entry point - renderHexMap() orchestrates scene/camera/interactions/overlays |
| types.ts | Core rendering types (HexScene, RenderHandles, HexInteractionDelegate) |
| scene/ | SVG scene management - polygon rendering, icon layers, viewBox control |
| core/ | Rendering core - hex-geometry (polygon/corner/edge math), borders (detection/rendering/manager), icons (rendering/distribution/noise), gradients (color mapping), camera (pan/zoom) |
| interactions/ | User input handling - click/paint delegation, coordinate conversion, pointer capture, event routing |
| icons/ | Icon definitions - SVG symbol registry (`icon-registry.ts`), position configs (`symbol-position-config.ts`) |
| procedural/ | Noise generation - SimplexNoise for natural terrain variation |

## Connections

**Used by:**
- Cartographer Workmode (`src/workmodes/cartographer/controller.ts`) - Map editor rendering
- Session Runner Workmode (`src/workmodes/session-runner/travel/ui/sidebar.ts`) - Travel mode map display

**Depends on:**
- `@features/maps/overlay` - Overlay system (weather, climate, factions, locations)
- `@features/maps/data` - Tile data loading and tile-store
- `@features/maps/config` - Terrain types, coordinates, options
- `@geometry` (via `@services/geometry`) - Coordinate system utilities (axialToPixel, neighbors, coordToKey, etc.)

## Recent Changes (Waves 1-10)

**Wave 1**: Removed surface.ts dead code (unused camera methods)
**Wave 2**: Added color-mapping.ts interpolation functions (interpolateHexGradient, HexStop type)
**Wave 3**: Created gradient-overlay-layer.ts factory for reusable gradient overlays
**Wave 4**: Refactored elevation/fertility/groundwater layers to use gradient factory
**Wave 5**: Consolidated camera implementation into core/camera.ts
**Wave 6**: Added layer-utils.ts and layer-registry.ts for shared overlay utilities
**Wave 8**: Added tile-cache.ts unified cache implementation
**Wave 9**: Consolidated interaction system - coordinate conversion integrated into interactions.ts, removed coordinates.ts and interaction-adapter.ts
**Wave 10 (Refactor)**: Major consolidation of rendering files:
- `core/hex-geometry.ts` - Merged hex-corners.ts + hex-edges.ts (polygon generation, corner/edge math)
- `core/borders.ts` - Merged border-detection, border-renderer, area-fill-renderer, border-manager, debounced-border-updater
- `core/icons.ts` - Merged icon-renderer, symbol-distributor, flora-noise-modifier
- `core/gradients.ts` - Moved color-mapping.ts (elevation/moisture color interpolation)

## Public API

```typescript
// Main rendering function
export async function renderHexMap(
  app: App,
  host: HTMLElement,
  mapFile: TFile,
  opts: HexOptions
): Promise<RenderHandles>;

// Return type with lifecycle control
export type RenderHandles = {
  svg: SVGSVGElement;
  contentG: SVGGElement;
  overlay: SVGRectElement;
  polyByCoord: ReadonlyMap<string, SVGPolygonElement>;
  surface: HexRenderSurfaceSelection;
  base: HexCoord;
  padding: number;

  // Coordinate conversion
  toContentPoint(ev: MouseEvent | PointerEvent): DOMPoint | null;

  // Icon-based terrain system (Phase 3)
  setTerrainIcon(coord: HexCoord, terrain: TerrainType | undefined): void;
  setFloraIcon(coord: HexCoord, flora: FloraType | undefined): void;
  setBackgroundColor(coord: HexCoord, color: string | undefined): void;
  setMoisture(coord: HexCoord, moisture: MoistureLevel | undefined): void;
  setIconLayerVisibility(layer: 'terrain' | 'flora' | 'moisture', visible: boolean): void;
  setIconLayerOpacity(layer: 'terrain' | 'flora' | 'moisture', opacity: number): void;

  // Polygon management
  ensurePolys(coords: readonly HexCoord[]): void;

  // Interaction delegation (for editor tools)
  setInteractionDelegate(delegate: HexInteractionDelegate | null): void;

  // Overlay layer control (Phase 14.3)
  setLayerConfig(layerId: string, visible: boolean, opacity: number): void;
  getLayerConfig(layerId: string): { visible: boolean; opacity: number };

  // Cleanup
  destroy(): void;
};

// Interaction delegate pattern (for editor tools)
export interface HexInteractionDelegate {
  onClick?(coord: HexCoord, ev: MouseEvent): HexInteractionOutcome | Promise<HexInteractionOutcome>;
  onPaintStep?(coord: HexCoord, ev: PointerEvent): HexInteractionOutcome | Promise<HexInteractionOutcome>;
  onPaintEnd?(): void;
}

export type HexInteractionOutcome = "default" | "handled" | "start-paint";
```

## Usage Example

```typescript
import { renderHexMap } from '@features/maps/rendering';
import type { HexOptions } from '@features/maps/config';

// Render a hex map with default options
const mapFile = app.vault.getAbstractFileByPath("Maps/World.md") as TFile;
const host = containerEl.createDiv();
const opts: HexOptions = { radius: 40 };

const handles = await renderHexMap(app, host, mapFile, opts);

// Set terrain icons (Phase 3: Icon-Based Terrain)
handles.setTerrainIcon({ r: 0, c: 0 }, "mountains");
handles.setFloraIcon({ r: 0, c: 0 }, "dense");

// Set custom interaction delegate (e.g., for brush tools)
handles.setInteractionDelegate({
  onClick: (coord, ev) => {
    console.log("Clicked hex:", coord);
    return "handled";
  },
  onPaintStep: (coord, ev) => {
    handles.setTerrainIcon(coord, "plains");
    return "start-paint"; // Continue painting on drag
  },
});

// Control overlay layers (Phase 14.3)
handles.setLayerConfig("temperature", true, 0.5); // 50% opacity
handles.setLayerConfig("faction", false, 1.0);    // Hide faction overlay

// Cleanup on unmount
handles.destroy();
```

## Architecture Notes

### Rendering Pipeline

1. **Bootstrap** - Load tiles from `.tiles.json`, compute bounds, determine base coordinate (inlined in hex-render.ts)
2. **Scene Creation** (`scene/scene.ts`) - Generate SVG container, polygon elements, icon layers (terrain/flora/moisture)
3. **Camera Setup** (`core/camera.ts`) - Enable pan/zoom with pointer events
4. **Interactions** (`interactions/interactions.ts`) - Convert mouse events → hex coordinates, route click/paint events to active delegate
5. **Overlay Manager** (`hex-render.ts` + `@features/maps/overlay`) - Render climate/weather/faction/location overlays

### Icon System (Phase 3)

**Multi-Symbol Distribution** - Distributes 8-12 SVG symbols per hex with fixed positions + random jitter:
- **Terrain symbols** (3-6 per hex): Mountains, hills, plains icons from `icons/icon-registry.ts`
- **Flora symbols** (5-8 per hex): Dense/medium/field/barren vegetation icons
- **Moisture symbols** (variable): Overlay water droplets for wet areas
- **Variant support**: Each symbol position can use different variants (e.g., `terrain-mountains-v1`, `terrain-mountains-v2`)
- **Noise-based coloring** (`core/icons.ts`): Flora modifies hex fill color using Perlin noise for natural variation
- **Adaptive contrast** (`core/icons.ts`): Icons use drop shadows for visibility on any background

**Architecture:**
- `scene/scene.ts` - Creates 3 icon layer groups (terrain/flora/moisture), manages visibility/opacity
- `core/icons.ts` - Symbol distribution (seeded random), SVG rendering (`<use>` elements), noise-based coloring
- `icons/icon-registry.ts` - Injects SVG `<defs>` with symbol definitions
- `icons/symbol-position-config.ts` - Fixed position configurations for symbol placement

### Layer Priority (Z-Order)

Rendering order (bottom to top):
1. **Hex polygons** (terrain fill color)
2. **Terrain icons** (mountains, hills, plains symbols)
3. **Flora icons** (vegetation symbols)
4. **Moisture icons** (water droplet overlays)
5. **Climate overlays** (temperature, precipitation, cloud cover) - Priority 3
6. **Rain shadow overlay** - Priority 4
7. **Weather overlay** (animated weather effects) - Priority 5
8. **Terrain features** (elevation lines, rivers, roads, cliffs) - Priority 6-9
9. **Location influence** (circular overlays) - Priority 10
10. **Wind arrows** - Priority 15
11. **Faction overlays** (colored hex fills) - Priority 20
12. **Location markers** (place names) - Priority 30
13. **Building indicators** (settlement icons) - Priority 40

### Interaction Model

**Delegate Pattern** - Editor tools implement `HexInteractionDelegate`:
- `onClick()` - Discrete hex clicks (e.g., place marker, inspect)
- `onPaintStep()` - Continuous painting during pointer drag (e.g., terrain brush)
- `onPaintEnd()` - Cleanup after paint operation

**Paint Flow:**
1. User presses primary pointer button → `onPointerDown` fires
2. Tool's `onPaintStep()` returns `"start-paint"` → painting mode activates
3. Pointer moves → `onPaintStep()` fires for each new hex (RAF-throttled)
4. User releases button → `onPointerUp` fires → tool's `onPaintEnd()` called

**Visit Tracking** - Prevents painting same hex multiple times during single drag operation.

### Performance Optimizations

- **Icon symbol reuse** - SVG `<use>` clones symbols from `<defs>`, not duplicate paths
- **Removed coordinate labels** - Saves ~1684 DOM nodes for large maps
- **RAF throttling** - Paint events throttled to 60fps max
- **Painter's algorithm** - Icons sorted by Y-coordinate for correct visual layering
- **Lazy polygon creation** - Only creates polygons for visible hexes (`ensurePolys`)
- **TileStore subscription** - Reactively syncs rendered hexes with data layer (no polling)

### Border System

**Region/Faction Borders** (`core/borders.ts`) - Visualize contiguous areas:
- **Flood-fill detection** - Find contiguous areas via BFS
- **Edge tracing** - Calculate SVG paths along area boundaries
- **Centroid calculation** - Place labels at geometric center of each area
- **Color lookup** - Fetch entity colors from repositories
- **3-layer rendering** - Fills (bottom), borders (middle), labels (top)
- **Debounced updates** - Performance optimization for rapid changes

### Coordinate Systems

**Screen Space** (pixels) - SVG viewport coordinates
↓ `toContentPoint()` - Inverse CTM transform (interactions/interactions.ts)
**Content Space** (pixels) - Camera-transformed coordinates
↓ `pointToCoord()` - Hex geometry math (interactions/interactions.ts)
**Hex Space** (q, r) - Axial coordinates

**Type Alias:**
```typescript
// src/features/maps/rendering/types.ts
type HexCoord = AxialCoord;  // Rendering layer uses HexCoord alias
```

**Key Functions:**
- `interactions/interactions.ts` - `toContentPoint()`, `pointToCoord()` (integrated coordinate conversion)
- `core/hex-geometry.ts` - `hexPolygonPoints()`, `createHexGeometryCalculator()`, `cornerToPixel()`, `getEdgeMidpoint()`
- `@geometry` - `axialToPixel()`, `neighbors()`, `coordToKey()`, `axialDistance()`

**Migration:**
- OddR coordinate system **removed** (no longer exists)
- All rendering now uses AxialCoord as base
- `oddrToPixel()` → `axialToPixel()`
- `neighborsOddR()` → `neighbors()`

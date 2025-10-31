# Phase 9.1 UI Integration Guide: Cartographer Map Influence Overlays and Enhanced Location Markers

## Overview

This guide documents the cartographer UI architecture and provides a roadmap for implementing Phase 9.1 features:
1. **Map influence overlays** - Display faction/location influence areas on the hex map
2. **Enhanced location markers** - Show owner, workers, production status in markers

## Architecture Overview

The cartographer uses a **layered rendering system** with three key levels:

```
SVG Scene (Hex Polygons)
  ├── Terrain Layer (fills)
  ├── Overlay Layer (faction colors)
  └── Marker Layer (location icons)

State Management (Stores)
  ├── Tile Store (terrain/region/faction data)
  ├── Faction Overlay Store (faction assignments)
  └── Location Marker Store (location metadata)

UI Controllers (Modes)
  ├── Editor Mode (terrain brush, location marker placement)
  └── Inspector Mode (tile detail panel)
```

## Core Files and Responsibilities

### 1. Hex Rendering Pipeline

**Primary file:** `/src/features/maps/rendering/hex-render.ts`

This is the main entry point for rendering the hex map. It:
- Initializes the hex scene (SVG canvas with hex polygons)
- Sets up camera and zoom controls
- Creates and manages overlay layers (faction overlays, location markers)
- Subscribes to store updates and applies visual changes

Key functions:
```typescript
export async function renderHexMap(
    app: App,
    host: HTMLElement,
    mapFile: TFile,
    opts: HexOptions
): Promise<RenderHandles>
```

Returns `RenderHandles` object with:
- `svg` - Root SVG element
- `contentG` - SVG group containing all hex polygons and markers
- `setFill(coord, color)` - Set hex terrain color
- `setOverlay(coord, overlay)` - Apply faction overlay with color/transparency
- `ensurePolys(coords)` - Ensure hex polygons exist for given coordinates

### 2. Scene Management

**File:** `/src/features/maps/rendering/scene/scene.ts`

The scene manages the SVG structure and provides two key methods:

#### `setFill(coord, color)` - Terrain Coloring
```typescript
function setFill(coord: HexCoord, color: string): void {
    const poly = polyByCoord.get(keyOf(coord));
    if (!poly) return;
    const fill = color ?? "transparent";
    poly.dataset.terrainFill = fill;
    if (!poly.dataset.overlayColor) {
        // Only apply terrain fill if no overlay is active
        (poly.style as any).fill = fill;
        (poly.style as any).fillOpacity = fill !== "transparent" ? "0.25" : "0";
    }
}
```

#### `setOverlay(coord, overlay)` - Faction/Location Overlays
```typescript
function setOverlay(
    coord: HexCoord,
    overlay: { 
        color: string;
        factionId?: string;
        factionName?: string;
        fillOpacity?: string;
        strokeWidth?: string;
    } | null
): void {
    const poly = polyByCoord.get(keyOf(coord));
    if (!poly) return;
    if (overlay) {
        poly.dataset.overlayColor = overlay.color;
        (poly.style as any).stroke = overlay.color;
        (poly.style as any).strokeWidth = overlay.strokeWidth ?? "3";
        (poly.style as any).fill = overlay.color;
        (poly.style as any).fillOpacity = overlay.fillOpacity ?? "0.5";
    } else {
        delete poly.dataset.overlayColor;
        // Restore default appearance
    }
}
```

**Key insight:** The overlay system uses `dataset` attributes to track state and CSS styling for visual representation. Overlays have priority over terrain fill.

### 3. Faction Overlay Store

**File:** `/src/features/maps/state/faction-overlay-store.ts`

In-memory store for hex-to-faction mappings:

```typescript
export interface FactionOverlayAssignment {
    coord: TileCoord;           // { r, c }
    factionId: string;
    factionName?: string;
    strength?: number;          // 0-100
    color?: string;             // Override color
    tags?: string[];
    sourceId?: string;          // Location ID if location-based
}

export interface FactionOverlayStore {
    state: WritableStore<FactionOverlayState>;
    setAssignments(assignments: readonly FactionOverlayAssignment[]): void;
    clear(): void;
    get(coord: TileCoord): FactionOverlayEntry | null;
    list(): FactionOverlayEntry[];
    getColorForFaction(factionId: string): string;
}
```

**Usage pattern in hex-render.ts:**
```typescript
const applyOverlay = (state: FactionOverlayState) => {
    const entries = state.loaded ? Array.from(state.entries.values()) : [];
    const ensureCoords = entries.map((entry) => entry.coord);
    scene.ensurePolys(ensureCoords);  // Ensure hexes exist

    for (const entry of entries) {
        scene.setOverlay(entry.coord, {
            color: entry.color,
            factionId: entry.factionId,
            factionName: entry.factionName,
            fillOpacity: OVERLAY_FILL_OPACITY,
            strokeWidth: OVERLAY_STROKE_WIDTH,
        });
    }
};

const overlayUnsubscribe = overlayStore.state.subscribe(applyOverlay);
```

### 4. Location Marker Store

**File:** `/src/features/maps/state/location-marker-store.ts`

Similar structure to faction overlays, but stores location metadata:

```typescript
export interface LocationMarker {
    coord: TileCoord;
    locationName: string;
    locationType: LocationType;  // "Stadt", "Dorf", "Camp", etc.
    icon?: string;               // Emoji or SVG path
    parent?: string;
    ownerType?: "faction" | "npc" | "none";
    ownerName?: string;
}

export const LOCATION_TYPE_ICONS: Record<LocationType, string> = {
    "Stadt": "🏙️",
    "Dorf": "🏘️",
    "Camp": "⛺",
    // ...
};
```

### 5. Marker Layer Rendering

**File:** `/src/features/maps/rendering/hex-render.ts` (createMarkerLayer function)

Creates SVG text elements for location markers:

```typescript
function createMarkerLayer(
    contentG: SVGGElement,
    radius: number,
    base: HexCoord,
    padding: number
): MarkerLayer {
    const markerGroup = document.createElementNS(SVG_NS, "g");
    markerGroup.setAttribute("class", "location-markers");
    contentG.appendChild(markerGroup);

    const setMarker = (coord: HexCoord, icon: string, tooltip: string) => {
        const marker = document.createElementNS(SVG_NS, "text");
        marker.setAttribute("class", "location-marker");
        marker.setAttribute("font-size", "24px");
        marker.setAttribute("pointer-events", "none");
        marker.textContent = icon;
        
        // Position above hex center
        const { cx, cy } = centerOf(coord);
        marker.setAttribute("x", String(cx));
        marker.setAttribute("y", String(cy - 10));
        
        markerGroup.appendChild(marker);
    };

    return { setMarker, clearMarker };
}
```

**Key observation:** Markers use `<text>` SVG elements positioned above hex centers. Current implementation uses emoji. SVG path support is future-ready (via `icon?: string`).

## Cartographer Modes Architecture

**File:** `/src/workmodes/cartographer/modes/editor.ts` and `/modes/inspector.ts`

### Mode Lifecycle

Each mode follows a consistent pattern:

```typescript
export type CartographerMode = {
    readonly id: string;
    readonly label: string;
    onEnter(ctx: CartographerModeLifecycleContext): Promise<void>;
    onExit(ctx: CartographerModeLifecycleContext): Promise<void>;
    onFileChange(file: TFile, handles: RenderHandles, ctx): Promise<void>;
    onHexClick?(coord: HexCoord, event, ctx): Promise<void>;
    onSave?(mode: MapHeaderSaveMode, file: TFile, ctx): Promise<boolean>;
};
```

### Context Available to Modes

```typescript
export type CartographerModeContext = {
    app: App;
    host: HTMLElement;
    mapHost: HTMLElement;           // Where the hex map renders
    sidebarHost: HTMLElement;       // Right sidebar for controls
    getFile(): TFile | null;
    getMapLayer(): MapLayer | null;
    getRenderHandles(): RenderHandles | null;  // Direct access to scene
    getOptions(): HexOptions | null;
};
```

### Editor Mode

Provides tools for modifying the map. Currently supports:
1. **Terrain Brush** - Paint hex terrain types
2. **Location Marker** - Place/remove location markers

**Sidebar structure:**
- File label
- Tool selector (dropdown)
- Tool-specific panel (mounted dynamically)
- Status messages

To add new tools:
1. Create a new `mountXxxPanel()` function
2. Register in tool selector options
3. Handle in `switchTool()` logic

### Inspector Mode

Shows hex details in the sidebar when clicking hexes:
- Terrain selector
- Region selector
- Faction selector
- Notes textarea
- Location info (name, type, owner)

**File:** `/src/workmodes/cartographer/modes/inspector.ts`

Key section for Phase 9.1 enhancement (lines 161-197):
```typescript
// Load location marker info
if (ui.locationInfo) {
    const marker = markerStore.get(state.selection);
    if (marker) {
        // Display location name, type, owner
        // Future: Add building info, workers, production status
    }
}
```

## Integration Points for Phase 9.1

### 1. Influence Overlay Data Flow

Current state only shows faction influence as colored hexes. To enhance with **location influence**:

**Step 1: Generate influence assignments from Phase 9 location data**

```typescript
// In location integration layer (TBD)
export interface LocationInfluenceAssignment {
    coord: TileCoord;
    locationId: string;
    locationName: string;
    radius: number;             // From location influence config
    strength: number;           // 0-100, decays with distance
    buildingType?: string;
    workerCount?: number;
}

// Function to calculate hexes within influence radius:
function getHexesInInfluenceArea(
    center: TileCoord,
    radius: number,
    decayFunction: (distance: number) => number
): TileCoord[] {
    // Use oddrDistance() from hex-geom.ts to calculate distances
    // Return hexes where decay > threshold
}
```

**Step 2: Create influence overlay store** (similar to faction overlay store)

```typescript
export interface LocationInfluenceStore {
    state: WritableStore<LocationInfluenceState>;
    setAssignments(assignments: readonly LocationInfluenceAssignment[]): void;
    list(): LocationInfluenceEntry[];
}
```

**Step 3: Integrate into hex-render.ts**

```typescript
// Similar to faction overlay subscription
const influenceStore = getLocationInfluenceStore(app, mapFile);
const applyInfluenceOverlay = (state: LocationInfluenceState) => {
    // Apply overlay with location-specific styling
    // Use different stroke pattern or color intensity
};
const influenceUnsubscribe = influenceStore.state.subscribe(applyInfluenceOverlay);
```

### 2. Enhanced Location Markers

Current: Simple emoji icon with location name in tooltip

Desired: Rich marker showing:
- Location icon + name
- Owner faction (with color indicator)
- Building type
- Worker count
- Production status

**Option A: Tooltip Enhancement (Low Effort)**
Enhance SVG `<title>` element with multi-line info:
```typescript
marker.textContent = icon;
const title = document.createElementNS(SVG_NS, "title");
title.textContent = `${marker.locationName}\nOwner: ${ownerName}\nWorkers: ${workerCount}`;
marker.appendChild(title);
```

**Option B: Rich Visual Element (Medium Effort)**
Replace single text element with SVG group:
```
<g class="location-marker-group">
  <circle class="location-owner-indicator" fill="faction-color" />
  <text class="location-icon" />
  <text class="location-label" />
</g>
```

**Option C: Pop-up Panel (High Effort)**
Extend inspector mode to show detailed location info when marker is clicked:
- Current: Inspector shows location metadata when hex is clicked
- Enhancement: Add quick-access panel for location details
- Show: Owner, workers assigned, building production

### 3. Inspector Mode Enhancement

Current location info display (lines 161-197 in inspector.ts):
```typescript
if (marker) {
    infoDiv.createDiv({ text: `${marker.displayIcon} ${marker.locationName}` });
    infoDiv.createDiv({ text: `Type: ${marker.locationType}` });
    if (marker.ownerName) {
        infoDiv.createDiv({ text: `Owner: ${marker.ownerName}` });
    }
}
```

**Enhancement for Phase 9.1:**
```typescript
if (marker) {
    // ... existing display ...
    
    // NEW: Building/worker information
    const location = await getLocationData(app, marker.locationName);
    if (location?.buildings?.length) {
        const buildingSection = infoDiv.createDiv({ cls: "location-buildings" });
        buildingSection.createEl("h5", { text: "Buildings" });
        
        for (const building of location.buildings) {
            const buildingDiv = buildingSection.createDiv({ cls: "building-entry" });
            buildingDiv.createDiv({ 
                text: `${building.type}: ${building.workers?.length ?? 0} workers`,
                cls: "building-status" 
            });
            
            if (building.production) {
                buildingDiv.createDiv({ 
                    text: `Producing: ${building.production.type}`,
                    cls: "building-production" 
                });
            }
        }
    }
}
```

## Styling Patterns

The cartographer uses CSS classes for theming:

**Hex polygon states:**
- `.location-marker` - Marker text element
- `[data-painted="1"]` - Hex has terrain color
- `[data-overlayColor]` - Hex has faction overlay active
- `[data-factionId]` - Faction ID for custom styling

**Legend (for faction overlays):**
```css
.sm-map-legend {
    position: absolute;
    bottom: 16px;
    right: 16px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: 8px;
}

.sm-map-legend__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
}

.sm-map-legend__swatch {
    width: 16px;
    height: 16px;
    border-radius: 2px;
}
```

**For Phase 9.1:** Create similar legend for influence areas or location types.

## Coordinate System

**Format:** Odd-R (row-offset) with axial/cube conversions available

```typescript
// From hex-geom.ts
export type Coord = { r: number; c: number };   // odd-r
export type Axial = { q: number; r: number };
export type Cube = { q: number; r: number; s: number };

// Distance calculation
export function oddrDistance(a: Coord, b: Coord): number {
    const A = axialToCube(oddrToAxial(a));
    const B = axialToCube(oddrToAxial(b));
    return cubeDistance(A, B);
}
```

**Usage for Phase 9:** Use `oddrDistance()` to determine which hexes fall within influence radius.

## Data Flow Example: Adding Influence Overlays

1. **Data Source** - Location files in vault with Phase 9 influence data
2. **Repository Layer** - Function to load and parse location influence
3. **Store Layer** - LocationInfluenceStore to manage assignments
4. **Integration** - Subscribe in hex-render.ts like faction overlays
5. **Rendering** - Call setOverlay() for each influenced hex

```
Location Files (Vault)
    ↓
loadLocationInfluence(app, mapFile)
    ↓
LocationInfluenceStore.setAssignments()
    ↓
store.subscribe() → applyInfluenceOverlay()
    ↓
scene.setOverlay(coord, { color, fillOpacity, ... })
    ↓
SVG Polygon visual update
```

## Key Patterns to Follow

### 1. Store Pattern
- Writable stores with subscription support
- In-memory cache keyed by map file
- Registry per App instance
- Clear/reset functions for cleanup

### 2. Rendering Pattern
- Separate concerns: scene (polygons), overlays, markers
- Use dataset attributes for state tracking
- CSS variables for theming (colors, opacity)
- Cleanup subscriptions in destroy()

### 3. Mode Pattern
- Initialize in onEnter()
- Clean up in onExit()
- Respond to onFileChange()
- React to onHexClick()
- Use lifecycle signals for abort control

### 4. UI Components
- Use FormBuilder for consistent sidebars
- Split static vs dynamic content
- Status messages for user feedback
- Disable inputs when no map is selected

## Testing Considerations

### Unit Tests
- Store assignment logic (setAssignments, get, list)
- Coordinate calculations (distance, decay)
- Color resolution (faction to color mapping)

### Integration Tests
- Influence overlay rendering on hex changes
- Marker updates when store changes
- Mode switching preserves/clears state
- Map file changes reset stores

### Manual Testing
1. Open cartographer with hex map
2. Load location data
3. Verify influence areas render correctly
4. Click hexes in inspector mode
5. Verify location details appear
6. Switch to/from Editor mode
7. Verify overlays persist across mode changes

## Files to Create/Modify for Phase 9.1

### New Files (Recommended)
```
src/features/maps/state/
├── location-influence-store.ts          # Similar to faction-overlay-store.ts
└── location-influence-repository.ts     # Load location influence from vault

src/features/maps/rendering/
└── overlays/
    ├── influence-overlay-layer.ts       # Helper for rendering influence
    └── enhanced-marker-layer.ts         # Rich marker rendering
```

### Modified Files
```
src/features/maps/rendering/hex-render.ts
├── Import new influence store
├── Subscribe to influence updates
├── Apply influence overlays

src/workmodes/cartographer/modes/inspector.ts
├── Enhance location info display
├── Add building/worker information
└── Link to location building data

src/ui/utils/styles.css
├── Add location influence styling
├── Enhanced marker styling
└── Building indicator styling
```

## Related Phase 9 Architecture

Phase 9 established:
- **Location types** with radius/strength/decay configs
- **Building templates** with production/worker data
- **Coordinate parsing** for influence area calculation

Phase 9.1 will:
- **Visualize** influence areas on the map
- **Enhance markers** with owner/worker information
- **Link to building** data for quick access

## Summary

The cartographer UI uses a clean separation of concerns:
- **Scene layer** handles SVG structure and geometry
- **Store layer** manages reactive state
- **Rendering layer** subscribes to stores and updates visuals
- **Mode layer** provides user interactions

To implement Phase 9.1:
1. Create location influence store (copy faction overlay pattern)
2. Load influence data from location entities
3. Subscribe in hex-render.ts
4. Enhance inspector mode to show building details
5. Create styling for influence visualization
6. Test with actual location data

The existing faction overlay system is a good reference implementation.

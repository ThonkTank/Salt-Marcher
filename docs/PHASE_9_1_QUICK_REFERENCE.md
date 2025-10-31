# Phase 9.1 Quick Reference - File Locations & Key Patterns

## Critical Files for Phase 9.1 Implementation

### Rendering Pipeline (Main Entry Point)
- `/src/features/maps/rendering/hex-render.ts` (446 lines)
  - `renderHexMap()` - Main function, sets up everything
  - `createMarkerLayer()` - Location marker rendering (lines 248-320)
  - `applyOverlay()` callback pattern (lines 99-125)
  - `updateLegend()` for faction info display (lines 213-246)

### Scene Management (SVG Structure)
- `/src/features/maps/rendering/scene/scene.ts` (205 lines)
  - `setFill(coord, color)` - Terrain colors (lines 129-143)
  - `setOverlay(coord, overlay)` - Faction/location overlays (lines 145-177)
  - Hex polygon creation and management (lines 87-116)

### State Management (Stores)
- `/src/features/maps/state/faction-overlay-store.ts` (241 lines)
  - **REFERENCE PATTERN** for location-influence-store.ts
  - Store creation pattern, registry management, color palette
  - Usage: `setAssignments()`, `get()`, `list()`, `getColorForFaction()`

- `/src/features/maps/state/location-marker-store.ts` (204 lines)
  - Location metadata store pattern
  - Icon mapping for location types (lines 14-24)
  - Entry structure with display data enrichment

### Cartographer Modes
- `/src/workmodes/cartographer/controller.ts` (594 lines)
  - Mode lifecycle pattern, context passing
  - File management and map layer integration

- `/src/workmodes/cartographer/modes/editor.ts` (386 lines)
  - Tool-based sidebar pattern
  - Brush and location marker tool examples

- `/src/workmodes/cartographer/modes/inspector.ts` (374 lines)
  - **KEY FOR ENHANCEMENT**: Lines 161-197 show location info display
  - Where to add building/worker information
  - Form building pattern with multiple input types

### Hex Geometry & Coordinates
- `/src/features/maps/rendering/core/hex-geom.ts` (127 lines)
  - `oddrDistance()` - Use for influence radius calculation
  - `oddrToAxial()`, `axialToCube()` - Coordinate conversions
  - `neighborsOddR()` - Get adjacent hexes

### Styling
- `/src/ui/utils/styles.css` (204 lines)
  - `.sm-map-legend` and legend items pattern (lines 198-246)
  - CSS variable usage: `--background-secondary`, `--interactive-accent`, etc.
  - Responsive design patterns

## Quick Implementation Checklist

### 1. Create Location Influence Store
```
File: src/features/maps/state/location-influence-store.ts
Copy from: faction-overlay-store.ts
Adapt:
  - LocationInfluenceAssignment interface (add radius, strength, decay)
  - LocationInfluenceStore interface
  - Color resolution (use influence intensity instead of faction)
  - Registry pattern (similar WeakMap + Map structure)
```

### 2. Create Location Influence Repository
```
File: src/features/maps/data/location-influence-repository.ts
Purpose:
  - Load location files from vault
  - Calculate influence areas using oddrDistance()
  - Convert location data → influence assignments
```

### 3. Integrate into Hex Rendering
```
File: src/features/maps/rendering/hex-render.ts
Changes:
  - Line 15-18: Import location influence store
  - After line 129 (after faction overlay setup):
    Add: createInfluenceStore, subscribe pattern
    Add: applyInfluenceOverlay() callback
    Add: Cleanup in cleanup() function
```

### 4. Enhance Inspector Mode
```
File: src/workmodes/cartographer/modes/inspector.ts
Location:
  - Lines 161-197: Extend location info display
  - Add: Building list rendering
  - Add: Worker count display
  - Add: Production status indicators
```

### 5. Add Styling
```
File: src/ui/utils/styles.css
Add sections:
  - .location-influence-overlay { ... }
  - .location-influence-legend { ... }
  - .location-building-info { ... }
  - .sm-marker-enhanced { ... } (for rich markers)
```

## Key Patterns from Existing Code

### Store Pattern (from faction-overlay-store.ts)
```typescript
const registry = new WeakMap<App, Map<string, MyStore>>();

export function getMyStore(app: App, mapFile: TFile): MyStore {
    let storesByApp = registry.get(app);
    if (!storesByApp) {
        storesByApp = new Map();
        registry.set(app, storesByApp);
    }
    const mapPath = normalizePath(mapFile.path);
    let store = storesByApp.get(mapPath);
    if (!store) {
        store = createMyStore(mapPath);
        storesByApp.set(mapPath, store);
    }
    return store;
}

function createMyStore(mapPath: string): MyStore {
    const state = writable<MyState>(createEmptyState(mapPath), {
        name: `map-mystore:${mapPath}`,
        debug: false,
    });
    getStoreManager().register(storeName, state);

    return { state, setAssignments, clear, get, list };
}
```

### Overlay Application Pattern (from hex-render.ts)
```typescript
const applyOverlay = (state: OverlayState) => {
    const entries = state.loaded ? Array.from(state.entries.values()) : [];
    const ensureCoords = entries.map((entry) => entry.coord);
    scene.ensurePolys(ensureCoords);  // Critical: ensure hexes exist

    const nextKeys = new Set<string>();
    for (const entry of entries) {
        const key = `${entry.coord.r},${entry.coord.c}`;
        nextKeys.add(key);
        scene.setOverlay(entry.coord, {
            color: entry.color,
            factionId: entry.factionId,
            fillOpacity: "0.55",
            strokeWidth: "3",
        });
    }

    // Clean up old overlays
    for (const key of overlayKeys) {
        if (nextKeys.has(key)) continue;
        const [r, c] = key.split(",").map(Number);
        scene.setOverlay({ r, c }, null);
    }

    overlayKeys = nextKeys;
};

const overlayUnsubscribe = overlayStore.state.subscribe(applyOverlay);
applyOverlay(overlayStore.state.get());  // Initial application
```

### Mode Sidebar Pattern (from editor.ts)
```typescript
form = buildForm(panel, {
    sections: [
        { kind: "header", text: "Panel Title" },
        { kind: "static", id: "file", cls: "class-name" },
        {
            kind: "row",
            label: "Label:",
            controls: [
                {
                    kind: "select",
                    id: "myselect",
                    options: [{ value: "x", label: "X" }],
                    onChange: ({ element }) => {
                        // React to change
                    },
                },
            ],
        },
        { kind: "status", id: "message", cls: "class-name" },
    ],
});

// Access controls
const myControl = form.getControl("myselect") as FormSelectHandle;
const statusField = form.getStatus("message");
const staticEl = form.getElement("file");
```

### Coordinate Calculations
```typescript
import { oddrDistance } from "../../features/maps/rendering/core/hex-geom";

// Calculate which hexes are in influence radius
function getInfluencedHexes(
    center: TileCoord,
    radius: number,
    strengthFn: (distance: number) => number
): Array<{ coord: TileCoord; strength: number }> {
    const result = [];
    // Iterate through nearby hexes (use broader search area)
    for (let r = center.r - radius - 2; r <= center.r + radius + 2; r++) {
        for (let c = center.c - radius - 2; c <= center.c + radius + 2; c++) {
            const distance = oddrDistance(center, { r, c });
            if (distance <= radius) {
                const strength = strengthFn(distance);
                if (strength > 0) {
                    result.push({ coord: { r, c }, strength });
                }
            }
        }
    }
    return result;
}
```

## Testing Entry Points

### Unit Tests to Add
```typescript
// Location influence store
- setAssignments with various hexes
- get() returns correct entry
- list() returns all entries
- clear() empties store

// Coordinate calculations
- oddrDistance matches expected values
- Influence decay function produces correct strength values
- Hexes outside radius have 0 strength

// Color resolution
- Influence color scales with strength
- Color consistency across calls
```

### Integration Tests to Add
```typescript
// Influence rendering
- Overlays appear on correct hexes
- Switching stores updates visual
- Cleanup removes overlays

// Inspector enhancement
- Building info displays when location has buildings
- Worker counts render correctly
- Missing buildings don't cause errors
```

## Color/Opacity Constants

From faction-overlay-store.ts and hex-render.ts:
```typescript
const OVERLAY_STROKE_WIDTH = "3";
const OVERLAY_FILL_OPACITY = "0.55";
const MARKER_FONT_SIZE = "24px";
const FALLBACK_COLOR = "#9E9E9E";
```

For Phase 9.1, consider:
```typescript
const INFLUENCE_STROKE_WIDTH = "2";  // Thinner than faction
const INFLUENCE_FILL_OPACITY = "0.35";  // More transparent
const STRONG_INFLUENCE_COLOR = /* high saturation */;
const WEAK_INFLUENCE_COLOR = /* low saturation */;
```

## CSS Variables Available (Obsidian Theme)

```css
--background-primary
--background-secondary
--background-modifier-border
--background-modifier-hover
--interactive-accent
--text-normal
--text-muted
--text-error
--text-on-accent
```

## File Size Reference

For complexity estimation:
- Faction Overlay Store: 241 lines (your reference)
- Location Marker Store: 204 lines (similar structure)
- Estimate Location Influence Store: 200-250 lines
- Estimate Inspector enhancement: 40-60 lines
- Estimate Hex Render changes: 30-50 lines

## Next Steps

1. Read the full guide: `docs/PHASE_9_1_UI_INTEGRATION.md`
2. Study faction-overlay-store.ts for the store pattern
3. Review hex-render.ts applyOverlay pattern
4. Create location-influence-store.ts as copy/adapt
5. Create location-influence-repository.ts to load data
6. Integrate in hex-render.ts
7. Enhance inspector.ts location info section
8. Add CSS styling
9. Write tests
10. Manual testing with location data

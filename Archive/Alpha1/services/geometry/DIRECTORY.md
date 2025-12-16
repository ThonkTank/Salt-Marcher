# Geometry Service

Type-safe hex coordinate system for cartography using Axial coordinates with pointy-top orientation. Provides coordinate conversions, distance calculations, neighbor finding, radius/area operations, line drawing, and pixel transformations for all hex-based map features.

## Contents

| Element | Description |
|---------|-------------|
| index.ts | Public API barrel export with all coordinate functions |
| types.ts | Coordinate types (AxialCoord, CubeCoord) with runtime type guards and dimension builders (HexPixelSize, TileRadius) |
| hex-coords.ts | Consolidated hex coordinate operations: conversions, distance, neighbors, radius, line drawing, pixel conversions |

## Connections

**Used by:**
- `@workmodes/cartographer` - Map editor hex rendering and brush tools
- `@workmodes/session-runner` - Travel pathing and encounter positioning
- `@features/maps` - Map rendering and tile storage
- `@features/climate` - Climate zone calculations
- `@features/factions` - Region influence calculations

**Depends on:**
- No internal dependencies (pure geometry logic)

## Public API

```typescript
// Coordinate types
import type { AxialCoord, CubeCoord, HexPixelSize, TileRadius } from "@services/geometry";

// Type guards for runtime validation
import { isAxialCoord, isCubeCoord, HexPixelSizeBuilder, TileRadiusBuilder } from "@services/geometry";

// Coordinate key management (string serialization for Maps/Sets)
import type { CoordKey } from "@services/geometry";
import {
  coordToKey,        // Convert coordinate → string key (format: "q,r")
  keyToCoord,        // Parse string key → coordinate
  isValidKey,        // Check if string is valid coordinate key
  COORD_KEY_REGEX,   // Regex pattern for coordinate keys
  ORIGIN_KEY,        // Origin coordinate key (0,0)
} from "@services/geometry";

// Coordinate conversions
import {
  axialToCube,       // Axial → Cube
  cubeToAxial,       // Cube → Axial
} from "@services/geometry";

// Distance calculations
import {
  axialDistance,     // Distance between two axial coords (uses cube formula)
} from "@services/geometry";

// Neighbors (clockwise from East: E, NE, NW, W, SW, SE)
import {
  neighbors,           // Get all 6 adjacent hexes
  neighborInDirection, // Get neighbor in specific direction (0-5)
} from "@services/geometry";

// Radius & Area
import {
  coordsInRadius,    // Get all hexes within N radius (sorted by distance)
} from "@services/geometry";

// Line drawing (Bresenham's algorithm for hexes)
import {
  line,              // Draw line between two hexes (includes endpoints)
  cubeLerp,          // Linear interpolation in cube space
  cubeRound,         // Round cube coordinates to nearest hex
} from "@services/geometry";

// Pixel conversions (hex ↔ screen coordinates, pointy-top orientation)
import {
  axialToPixel,        // Axial → pixel (center of hex)
  pixelToAxial,        // Pixel → axial (click detection)
  axialToCanvasPixel,  // Axial → SVG canvas pixel (with padding/offset)
} from "@services/geometry";
```

## Usage Example

```typescript
import type { AxialCoord } from "@services/geometry";
import {
  axialDistance,
  coordToKey,
  keyToCoord,
  neighbors,
  line,
  coordsInRadius,
  pixelToAxial,
  axialToCanvasPixel,
} from "@services/geometry";

// Create axial coordinates (plain objects)
const hex1: AxialCoord = { q: 5, r: 10 };
const hex2: AxialCoord = { q: 8, r: 13 };

// Calculate distance between hexes
const distance = axialDistance(hex1, hex2); // 7 hexes

// Use as Map keys (string serialization)
const tileMap = new Map<string, { terrain: string }>();
const key1 = coordToKey(hex1);
tileMap.set(key1, { terrain: "forest" });
tileMap.set(coordToKey(hex2), { terrain: "plains" });

// Parse coordinate key back
const parsed = keyToCoord(key1); // { q: 5, r: 10 }

// Find all adjacent hexes
const adjacent = neighbors(hex1);
// Returns 6 neighbors in clockwise order: E, NE, NW, W, SW, SE

// Find all hexes within radius 2
const nearby = coordsInRadius(hex1, 2);
// Returns 19 hexes sorted by distance from center

// Draw line between hexes (Bresenham's algorithm)
const path = line(hex1, hex2);
// Returns array of hexes forming straight line (includes both endpoints)

// Pixel conversions for rendering (pointy-top orientation)
const base: AxialCoord = { q: 0, r: 0 };
const size = 32; // hex size in pixels
const padding = 16;

const canvasPos = axialToCanvasPixel(hex1, size, base, padding);
// Returns { x: 176, y: 192 } (SVG canvas position with padding)

// Click detection: convert pixel to hex
const clickedHex = pixelToAxial(100, 150, size); // hex at pixel 100,150
```

## Design Principles

1. **Simple Structural Types** - Plain objects without branding
   ```typescript
   const hex: AxialCoord = { q: 5, r: 10 }; // Plain object
   // No runtime overhead, TypeScript ensures type safety
   ```

   **Important:** The `HexCoord` type alias was removed. Use `AxialCoord` directly.

2. **Axial as Primary System** - Axial coordinates used throughout
   - Two-dimensional (q, r) representation
   - Natural distance calculations via cube formula
   - Efficient neighbor operations
   - Human-readable coordinate keys

3. **Cube for Geometry** - Cube coordinates for geometric operations
   - Line drawing (lerp + round)
   - Rotation/reflection operations
   - Maintains invariant: q + r + s = 0

4. **Pointy-Top Orientation** - Hexes point up/down
   - Consistent with common hex grid conventions
   - Natural for vertical movement (N/S)
   - Pixel conversion formulas optimized for this layout

5. **String Keys for Maps** - CoordKey type for Map/Set usage
   - Format: "q,r" (e.g., "5,10")
   - Type-safe with branded string type
   - Efficient lookup and serialization

## Testing

Test files: `devkit/testing/unit/services/geometry/`

### Test Coverage
- Coordinate conversions (Axial ↔ Cube)
- Distance calculations (axial coordinates)
- Neighbor finding (6 directions, clockwise from East)
- Line drawing (Bresenham's algorithm for hexes)
- Pixel conversions (axial ↔ pixel, canvas positioning)
- Key serialization/deserialization (coordToKey/keyToCoord)

## Architecture Notes

**Why services layer?**
- Geometry is pure logic with no Obsidian dependencies
- Used by multiple features (maps, climate, factions)
- No business logic - just coordinate math
- Lives in services/ because it's infrastructure, not feature-specific

**Why Axial coordinates?**
- Simpler than offset coordinates for distance/neighbors
- Two values instead of three (cube) for storage efficiency
- Natural conversion to cube for geometric operations
- Widely supported in hex grid libraries and documentation

**Why structural types instead of branded types?**
- Simpler developer experience (plain objects)
- Zero runtime overhead (no type guards needed)
- TypeScript ensures type safety at compile time
- Easier interop with external libraries and JSON

**Why pointy-top orientation?**
- Vertical hexes more natural for N/S movement
- Consistent with common fantasy map conventions
- Matches Red Blob Games reference implementation

## Related Documentation

- [docs/core/coordinate-systems.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/docs/core/coordinate-systems.md) - Coordinate system deep dive
- [src/features/maps/DIRECTORY.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/src/features/maps/DIRECTORY.md) - Map feature using this service
- [CLAUDE.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/CLAUDE.md#architecture-standards) - Architecture standards

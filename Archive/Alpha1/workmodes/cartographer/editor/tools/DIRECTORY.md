# Cartographer Editor Tools

**Zweck**: Editor tool implementations for cartography brush operations, inspection, and location marking.

## Inhalt

| Element | Beschreibung |
|---------|--------------|
| brush-circle.ts | Shared brush utility for circular brush patterns |
| area-brush/ | Area brush tool for painting terrain in regions |
| base/ | Base tool classes and interfaces for all brush tools |
| climate-brush/ | Climate data brush (temperature, precipitation, cloud cover) |
| derived-layers/ | Derived visualization layers (computed from base data) |
| feature-brush/ | Feature brush for terrain features (rivers, roads, etc.) |
| gradient-brush/ | Gradient-based terrain painting with falloff curves |
| inspector/ | Hex inspector tool for viewing/editing tile properties |
| location-marker/ | Location marker tool for placing named locations |
| terrain-brush/ | Terrain brush for painting terrain types |
| tile-brush/ | Single tile editing tool |

## Verbindungen

- **Verwendet von**: `src/workmodes/cartographer/editor/tool-registry.ts` registers all tools
- **Abhängig von**:
  - `@features/maps` - Tile data structures and rendering
  - `@geometry` - AxialCoord (coordinate system), coordinate conversions, hex range calculations
  - `src/workmodes/cartographer/editor/form-builder.ts` - Dynamic option forms
  - `src/workmodes/cartographer/components/` - Inspector panels and UI

## Coordinate System

All tools use **AxialCoord** from `@geometry`:

```typescript
import type { AxialCoord } from "@geometry";

// ✅ Correct - import from @geometry
const coord: AxialCoord = { q: 5, r: 10 };

// ❌ Incorrect - old HexCoord type (deprecated)
// import type { HexCoord } from "@features/maps/domain";
```

**Event payloads and tool signatures use AxialCoord:**
- `handleHexClick(coord: AxialCoord, event: PointerEvent)`
- `applyBrushLogic(coords: AxialCoord[], event: PointerEvent)`
- Event payloads: `{ coord: AxialCoord; nativeEvent: PointerEvent }`

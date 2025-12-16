# Domain Service

**Zweck**: Shared domain types for cross-feature and cross-workmode usage. Prevents layer violations while allowing type sharing.

## Inhalt

| Element | Beschreibung |
|---------|--------------|
| index.ts | Public API barrel export for all domain types |
| terrain-types.ts | Terrain/flora/moisture type definitions |
| tile-types.ts | Core TileData structure for hex tiles |
| calendar-types.ts | Calendar schema and event types |
| encounter-types.ts | Encounter domain types |
| settings-types.ts | Plugin settings types |

## Verbindungen

- **Verwendet von**:
  - All features (`@features/*`) - Import shared types
  - All workmodes (`@workmodes/*`) - Import shared types
  - Prevents cross-feature runtime dependencies
- **Abhängig von**:
  - `@workmodes/almanac/domain` - Re-exports calendar types (type-only)

## Public API

```typescript
// Terrain types (from maps feature)
import type {
  TerrainType,      // "plains" | "hills" | "mountains"
  FloraType,        // "dense" | "medium" | "field" | "barren"
  MoistureLevel,    // "desert" | "dry" | "lush" | "marshy" | ...
  IconDefinition,   // Icon rendering metadata
} from "@services/domain";

// Tile types (core map data structure)
import type {
  TileData,         // Complete hex tile data
  TileCoord,        // { r: number; c: number }
} from "@services/domain";

// Calendar types (from almanac)
import type {
  CalendarSchema,
  CalendarMonth,
  TimeDefinition,
  CalendarTimestamp,
  TimestampPrecision,
  CalendarEvent,
  CalendarEventSingle,
  CalendarEventRecurring,
  CalendarEventKind,
  CalendarEventTimePrecision,
  CalendarTimeOfDay,
  CalendarEventBase,
  CalendarEventBounds,
  CalendarEventOccurrence,
  PhenomenonOccurrence,
} from "@services/domain";

// Encounter types
import type {
  EncounterDifficulty,
  EncounterContext,
  // ... other encounter types
} from "@services/domain";

// Settings types
import type {
  PluginSettings,
  WorkmodeSettings,
  // ... other settings types
} from "@services/domain";
```

## Usage Example

```typescript
// ✅ Good: Import shared types from @domain
import type { TileData, TerrainType, MoistureLevel } from "@services/domain";

function processTerrainData(tile: TileData) {
  const terrain: TerrainType = tile.terrain ?? "plains";
  const moisture: MoistureLevel = tile.moisture ?? "lush";
  // ...
}

// ❌ Bad: Cross-feature import creates runtime dependency
import type { TileData } from "@features/maps/data/tile-repository";
// This violates layer boundaries!

// ✅ Good: Features can implement domain types
import type { TileData } from "@services/domain";

class TileRepository {
  async load(path: string): Promise<TileData> {
    // Implementation uses domain types
  }
}
```

## Design Principles

1. **Type-Only Exports** - No implementation logic
   - Pure type definitions
   - No runtime dependencies
   - Zero bundle size impact

2. **Layer Boundary Enforcement** - Prevents circular dependencies
   ```
   ❌ Feature A → Feature B → Feature A (circular!)
   ✅ Feature A → @domain ← Feature B (shared types)
   ```

3. **Centralized Type Definitions** - Single source of truth
   - Terrain types: Originally in `@features/maps`
   - Now: `@services/domain/terrain-types.ts`
   - All features import from `@domain`

4. **Re-Export Pattern** - Some types originated in workmodes
   ```typescript
   // calendar-types.ts
   export type { CalendarSchema } from "@workmodes/almanac/domain";
   ```
   - Allows other features to access without layer violation
   - Only type imports (no runtime dependency)

## Architecture Notes

**Why services/domain layer?**
- Features cannot import from other features (layer violation)
- Domain types are shared across multiple features
- Extracting to services layer allows clean sharing

**What goes in domain service?**
- ✅ Pure type definitions
- ✅ Types used by 2+ features/workmodes
- ✅ Core data structures (TileData, CalendarEvent)
- ❌ Implementation logic (belongs in features)
- ❌ Feature-specific types (keep in feature)

**Migration pattern:**
1. Identify shared types in features
2. Extract to `@services/domain/{name}-types.ts`
3. Update features to import from `@domain`
4. Remove cross-feature imports

**Example: Terrain types migration**
```typescript
// Before (layer violation)
// src/features/climate/domain/temperature-calculator.ts
import type { TerrainType } from "@features/maps/domain/terrain";

// After (clean layer boundary)
// src/features/climate/domain/temperature-calculator.ts
import type { TerrainType } from "@services/domain";
```

## Testing

- No unit tests needed (pure types)
- Type safety verified at compile time
- Integration tests verify cross-feature usage

## Related Documentation

- [docs/STRUCTURE_STANDARDS.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/docs/STRUCTURE_STANDARDS.md#5-architecture-boundaries) - Layer architecture
- [docs/reference/architecture-map.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/docs/reference/architecture-map.md) - Dependency flow
- [CLAUDE.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/CLAUDE.md#architecture-standards) - Architecture principles

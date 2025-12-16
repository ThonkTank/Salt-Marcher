# Orchestration Service

**Purpose**: Provides cross-workmode communication and data access without direct coupling. This service layer allows workmodes to interact with each other's data indirectly, maintaining proper architectural boundaries.

**Architecture**: Workmodes → Services → Workmodes (via orchestration). The orchestration service acts as a facade/bridge layer that prevents direct workmode-to-workmode imports while still allowing data sharing.

## Contents

| File | Description |
|------|-------------|
| `index.ts` | Barrel export consolidating all orchestration services |
| `types.ts` | Shared types for cross-workmode communication (TimeUnit) |
| `calendar-orchestrator.ts` | Re-exports calendar domain types and utilities from Almanac workmode |
| `library-orchestrator.ts` | Re-exports library data sources and types from Library workmode |

## Connections

**Used by:**
- `session-runner` - Imports calendar types and library data sources
- `cartographer` - Imports library data sources for entity discovery

**Depends on:**
- `@workmodes/almanac` - Calendar domain types
- `@workmodes/library` - Library data sources and types

## Public API

```typescript
// Calendar orchestration (from calendar-orchestrator.ts)
export type { TimeUnit };

// Library orchestration (from library-orchestrator.ts)
export { LIBRARY_DATA_SOURCES };
export type {
  FilterableLibraryMode,
  LibraryEntry,
  LibraryDataSourceMap,
};
```

## Usage Example

### Accessing Library Data Sources

Before:
```typescript
// ❌ Direct cross-workmode import (violates architecture)
import { LIBRARY_DATA_SOURCES } from "@workmodes/library/storage/data-sources";
```

After:
```typescript
// ✅ Import through orchestration service
import { LIBRARY_DATA_SOURCES } from "@services/orchestration";

const locationFiles = await LIBRARY_DATA_SOURCES.locations.list(app);
```

### Using Calendar Types

```typescript
// ✅ Import calendar types through orchestration
import type { TimeUnit } from "@services/orchestration";

function advanceTime(amount: number, unit: TimeUnit) {
  // ...
}
```

## Design Rationale

**Why not direct workmode imports?**
- Violates layer architecture (Workmodes are peers, not dependencies)
- Creates tight coupling between workmodes
- Makes refactoring and testing more difficult

**Why orchestration service?**
- Maintains proper layer separation
- Provides single point of control for cross-workmode data access
- Makes dependencies explicit and discoverable
- Allows for future middleware (caching, validation, etc.)

**Why re-exports instead of wrappers?**
- Minimal overhead - no additional abstraction layers
- Transparent - consumers get the same API
- Simple to maintain - changes in source workmode automatically propagate
- Can evolve to add middleware/transformations later if needed

## Related Documentation

- [Architecture Map](../../../docs/reference/architecture-map.md) - Layer structure and dependency rules
- [Common Patterns](../../../docs/guides/common-patterns.md) - Service layer patterns

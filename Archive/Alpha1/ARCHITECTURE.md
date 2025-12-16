# Architecture Layer Rules

This document defines the architectural layers of the Salt Marcher plugin and the rules governing dependencies between them.

## Layer Hierarchy

Salt Marcher follows a strict 3-tier architecture where dependencies flow **downward only**:

```
┌─────────────────────────────────────────┐
│         Workmodes (Applications)        │  ← Top Layer
│  library, cartographer, session-runner  │
│          almanac, encounter             │
└─────────────────────────────────────────┘
                  ↓ depends on
┌─────────────────────────────────────────┐
│         Features (Shared Systems)        │  ← Middle Layer
│   maps, factions, weather, audio,       │
│ encounters, locations, data-manager     │
└─────────────────────────────────────────┘
                  ↓ depends on
┌─────────────────────────────────────────┐
│      Services (Infrastructure)          │  ← Bottom Layer
│     state, logging, lifecycle           │
└─────────────────────────────────────────┘
```

## Layer Definitions

### Workmodes Layer (`src/workmodes/`)

**Purpose**: Self-contained applications with specific user workflows

**Contains**:
- User-facing views and controllers
- Workmode-specific UI components
- Application orchestration logic
- Entity CreateSpecs (declarative definitions)

**Examples**:
- `library/` - Entity CRUD (creatures, spells, items, etc.)
- `cartographer/` - Hex map editor with brush tools
- `session-runner/` - Live session management (travel, encounters, calendar)
- `almanac/` - Campaign calendar and events

**May depend on**:
- Features (shared systems)
- Services (infrastructure)
- UI layer (shared UI patterns)

**Must NOT depend on**:
- Other workmodes (use features for cross-workmode functionality)

### Features Layer (`src/features/`)

**Purpose**: Shared business logic and domain systems reusable across workmodes

**Contains**:
- Domain models and business logic
- Data repositories and persistence
- Rendering engines (maps, icons, borders)
- System implementations (weather, factions, audio)
- Generic UI infrastructure (data-manager)

**Examples**:
- `maps/` - Hex coordinate system, rendering, overlays
- `factions/` - AI behavior trees, simulation, economics
- `weather/` - Procedural generation, forecasting
- `audio/` - Context-aware music selection
- `data-manager/` - Generic CRUD infrastructure

**May depend on**:
- Services (infrastructure)
- Other features (minimize cross-feature dependencies)

**Must NOT depend on**:
- Workmodes (creates circular dependency)

### Services Layer (`src/services/`)

**Purpose**: Core infrastructure used throughout the application

**Contains**:
- State management (reactive stores)
- Logging and debugging
- Lifecycle management
- Plugin-wide utilities

**Examples**:
- `state/` - Store patterns (writable, persistent, versioned)
- Logging infrastructure
- Configuration management

**May depend on**:
- Other services only
- External libraries (Obsidian API, etc.)

**Must NOT depend on**:
- Features (services are foundational)
- Workmodes (services are foundational)

### UI Layer (`src/ui/`)

**Purpose**: Shared UI components and patterns reusable across workmodes

**Contains**:
- Reusable UI components (modals, panels)
- Layout utilities
- UI patterns and factories

**Examples**:
- `patterns/` - Base modal, panel factory, dialog builders
- `utils/` - Split view, watcher hub

**May depend on**:
- Services (for state, logging)

**Must NOT depend on**:
- Features (UI should be generic)
- Workmodes (UI should be reusable)

**Must NOT re-export from**:
- Features or workmodes (prevents backwards dependencies)

## Import Rules

### ✅ Allowed Dependencies

```typescript
// Workmodes → Features
import { getTileStore } from "../../features/maps/data/tile-repository";

// Workmodes → Services
import { logger } from "../../services/logging/logger";

// Workmodes → UI
import { BasePluginModal } from "../../ui/patterns";

// Features → Services
import { createWritableStore } from "../../services/state";

// Features → Other Features (minimize)
import { coordToKey } from "../maps/coordinate-system";

// Services → Other Services
import { logger } from "../logger";
```

### ❌ Forbidden Dependencies

```typescript
// Features → Workmodes (NEVER)
import { AreaType } from "../../workmodes/cartographer/..."; // ❌ Layer violation

// Services → Features (NEVER)
import { TileStore } from "../../features/maps/..."; // ❌ Layer violation

// UI → Features (NEVER - except shared types)
import { createWorkmodeHeader } from "../../features/data-manager/..."; // ❌ Layer violation

// Workmodes → Other Workmodes (NEVER)
import { LibraryView } from "../library/..."; // ❌ Use features for shared logic
```

## Handling Cross-Layer Needs

### Problem: Features need workmode-specific implementations

**Solution**: Dependency Injection via Registry Pattern

```typescript
// Feature layer defines interface + registry
// src/features/maps/data/region-data-source.ts
export interface RegionDataSource {
    list(app: App): Promise<TFile[]>;
    load(app: App, file: TFile): Promise<RegionEntry>;
}

let _dataSource: RegionDataSource | null = null;

export function registerRegionDataSource(source: RegionDataSource): void {
    _dataSource = source;
}

export function getRegionDataSource(): RegionDataSource {
    if (!_dataSource) throw new Error("Not registered");
    return _dataSource;
}

// Workmode layer provides implementation
// src/workmodes/library/storage/region-data-source-adapter.ts
export const regionDataSourceAdapter: RegionDataSource = {
    list: (app) => LIBRARY_DATA_SOURCES.regions.list(app),
    load: (app, file) => LIBRARY_DATA_SOURCES.regions.load(app, file),
};

// Plugin initialization registers implementation
// src/app/main.ts
registerRegionDataSource(regionDataSourceAdapter);
```

### Problem: Multiple layers need same type

**Solution**: Move shared types to feature layer or create dedicated types module

```typescript
// Shared type in feature layer
// src/features/maps/domain/area-types.ts
export type AreaType = 'region' | 'faction';

// Workmodes import from features
// src/workmodes/cartographer/editor/tools/area-brush/area-brush-core.ts
import type { AreaType } from "../../../../../features/maps/domain/area-types";

// Features also import from same location
// src/features/maps/rendering/borders/border-detection.ts
import type { AreaType } from "../../domain/area-types";
```

### Problem: UI patterns need to be shared

**Solution**: Keep in UI layer, NOT in features

```typescript
// Correct: UI patterns in ui/ layer
// src/ui/patterns/panel-factory.ts
export function createPanel(...) { ... }

// Workmodes import from ui
import { createPanel } from "../../ui/patterns";
```

## Directory Structure by Layer

```
src/
├── app/                    # Plugin entry point (bootstrap)
│   └── main.ts            # Registers all layers
├── workmodes/             # Top Layer: Applications
│   ├── library/           # Entity CRUD workmode
│   ├── cartographer/      # Map editor workmode
│   ├── session-runner/    # Session management workmode
│   └── almanac/           # Calendar workmode
├── features/              # Middle Layer: Shared Systems
│   ├── maps/              # Hex rendering, coordinates
│   ├── factions/          # AI simulation
│   ├── weather/           # Weather generation
│   ├── audio/             # Context-aware audio
│   ├── encounters/        # Encounter generation
│   ├── locations/         # Buildings and influence
│   └── data-manager/      # Generic CRUD infrastructure
├── services/              # Bottom Layer: Infrastructure
│   └── state/             # Reactive stores
├── ui/                    # Shared UI (same level as features)
│   ├── patterns/          # Modals, panels, dialogs
│   └── utils/             # Layout utilities
└── ARCHITECTURE.md        # This file
```

## What Belongs Where?

### Workmodes Layer

**Belongs here**:
- User-facing views (`ItemView` implementations)
- Workmode-specific controllers and presenters
- CreateSpec definitions (entity schemas)
- Workmode-specific UI components
- Application orchestration

**Does NOT belong here**:
- Reusable business logic → Move to features
- Data structures used by multiple workmodes → Move to features
- Generic UI patterns → Move to ui

### Features Layer

**Belongs here**:
- Domain models shared across workmodes
- Business logic reusable across contexts
- Data repositories and persistence
- Rendering engines
- System implementations

**Does NOT belong here**:
- Workmode-specific UI → Keep in workmodes
- Plugin-wide infrastructure → Move to services
- UI-only patterns → Move to ui

### Services Layer

**Belongs here**:
- State management primitives
- Logging and debugging infrastructure
- Plugin-wide configuration
- Lifecycle management

**Does NOT belong here**:
- Domain logic → Move to features
- Application logic → Move to workmodes

### UI Layer

**Belongs here**:
- Reusable modal patterns
- Panel factories and builders
- Layout utilities
- Generic UI components

**Does NOT belong here**:
- Feature-specific logic → Keep in features
- Workmode-specific UI → Keep in workmodes
- Re-exports from features/workmodes → Violates layer separation

## Verification

### Check for Layer Violations

```bash
# Features should NOT import from workmodes
grep -r "from.*workmodes" src/features/

# Services should NOT import from features
grep -r "from.*features" src/services/

# UI should NOT import from features (except types)
grep -r "from.*features" src/ui/
```

### Expected Result

All commands should return **zero results** (except for type-only imports in special cases).

## Benefits of This Architecture

1. **Clear Separation of Concerns**: Each layer has a well-defined purpose
2. **Testability**: Features can be tested independently of workmodes
3. **Reusability**: Shared logic lives in features, not duplicated in workmodes
4. **Maintainability**: Changes to one workmode don't affect others
5. **Scalability**: New workmodes can be added without modifying features
6. **No Circular Dependencies**: Strict downward dependency flow prevents cycles

## Migration Guide

### When You Find a Layer Violation

1. **Identify the violation**: Which layer is importing from a higher layer?
2. **Choose the fix strategy**:
   - **Shared type?** → Move to feature layer domain types
   - **Shared implementation?** → Create abstraction in features, adapter in workmodes
   - **UI pattern?** → Move to ui layer
3. **Implement the fix**:
   - Create abstraction/type in lower layer
   - Update imports in all consumers
   - Register implementations during plugin init (if using registry pattern)
4. **Verify**: Run grep commands to ensure no violations remain

### Example Migration

**Before** (violation):
```typescript
// src/features/maps/rendering/borders/border-detection.ts
import type { AreaType } from "../../../../workmodes/cartographer/.../area-brush-core";
```

**After** (fixed):
```typescript
// 1. Create shared type in feature layer
// src/features/maps/domain/area-types.ts
export type AreaType = 'region' | 'faction';

// 2. Update feature import
// src/features/maps/rendering/borders/border-detection.ts
import type { AreaType } from "../../domain/area-types";

// 3. Update workmode import
// src/workmodes/cartographer/.../area-brush-core.ts
import type { AreaType } from "../../../../../features/maps/domain/area-types";
```

## Questions?

If unsure which layer a component belongs to, ask:

1. **Is it application-specific?** → Workmodes
2. **Is it reusable business logic?** → Features
3. **Is it plugin-wide infrastructure?** → Services
4. **Is it a UI-only pattern?** → UI

Still unsure? Consult the team or refer to similar existing components.

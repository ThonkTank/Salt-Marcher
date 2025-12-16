# Import Guidelines

## Path Aliases

Salt Marcher uses TypeScript path aliases to improve code readability and enforce architectural boundaries. This document explains when and how to use them.

## Available Aliases

Aliases are configured in `tsconfig.json` and map to the following directories:

| Alias | Directory | Purpose |
|-------|-----------|---------|
| `@app/*` | `src/app/*` | Plugin bootstrap (main.ts, ipc-server.ts, configurable-logger.ts) |
| `@services/*` | `src/services/*` | Core infrastructure (state management, logging, error handling) |
| `@domain` | `src/services/domain` | Shared domain types (entities, factions, calendar, etc.) |
| `@domain/*` | `src/services/domain/*` | Domain submodules (calendar/, entity-types.ts, etc.) |
| `@features/*` | `src/features/*` | Shared systems (maps, factions, weather, audio, etc.) |
| `@workmodes/*` | `src/workmodes/*` | Self-contained applications (library, cartographer, session-runner, almanac) |
| `@ui/*` | `src/ui/*` | UI utilities and components |
| `@repositories/*` | `src/services/repositories/*` | Repository abstractions (service layer) |
| `@adapters/*` | `src/adapters/*` | Vault adapters and frontmatter parsing |

## When to Use Aliases

### ✅ USE aliases for cross-layer imports

Cross-layer imports are imports from a different major directory (workmodes → features, features → services, etc.).

**Examples:**

```typescript
// ✅ Workmode importing from features
import { getMapSession } from "@features/maps/session";
import { logger } from "@services/logging/logger";

// ✅ Feature importing from services
import { writable, type WritableStore } from "@services/state";

// ✅ Any file importing from app
import { logger } from "@services/logging/logger";
```

### ✅ USE aliases for deeply nested imports (3+ levels)

Even within the same layer, use aliases if the relative path has 3 or more levels:

```typescript
// ✅ 4 levels deep → use alias
import { PerformanceTimer } from "@features/maps/performance/performance-timer";

// Instead of:
import { PerformanceTimer } from "../../../../features/maps/performance/performance-timer";
```

### ❌ DON'T use aliases for same-directory or nearby imports

Keep relative imports for files in the same directory or 1-2 levels up:

```typescript
// ✅ Same directory
import { traceBorders } from "./border-detection";

// ✅ Parent directory (1 level up)
import { reportEditorToolIssue } from "../../editor-telemetry";

// ✅ Nearby in same subsystem (2 levels)
import type { TileData } from "../../data/tile-repository";
```

## Architecture Rules

### Layer Dependency Flow

```
workmodes → features → services → app
    ↓           ↓          ↓
  domain ← ─ ─ ─ ┴ ─ ─ ─ ─ ┘
    ↓
   ui, adapters, repositories
```

**Rules:**
- ✅ Workmodes MAY import from features, services, domain, app, ui, repositories, adapters
- ✅ Features MAY import from services, domain, app, ui, repositories, adapters
- ✅ Services MAY import from domain, app, adapters
- ❌ Services MUST NOT import from features or workmodes
- ❌ Features SHOULD NOT import from other features (use services for cross-feature state)

### Examples

```typescript
// ✅ CORRECT: Workmode imports from feature
// File: src/workmodes/cartographer/editor/tools/terrain-brush/brush-core.ts
import { getMapSession } from "@features/maps/session";
import { logger } from "@services/logging/logger";

// ✅ CORRECT: Feature imports from service
// File: src/features/maps/overlay/layers/wind-overlay-layer.ts
import { writable } from "@services/state";

// ❌ INCORRECT: Service imports from feature
// File: src/services/state/some-service.ts
import { getMapSession } from "@features/maps/session"; // ❌ Violates layer boundaries

// ❌ INCORRECT: Feature imports from another feature
// File: src/features/factions/faction-manager.ts
import { getWeatherData } from "@features/weather/weather-generator"; // ❌ Cross-feature dependency

// ✅ CORRECT: Use service for cross-feature state
// File: src/features/factions/faction-manager.ts
import { weatherStore } from "@services/state"; // ✅ Service mediates between features
```

## Migration Strategy

The codebase is gradually migrating to path aliases. Current status:

- **Phase 1 (DONE):** tsconfig.json configured with aliases
- **Phase 2 (DONE):** Priority files converted (15+ files with deepest imports)
- **Phase 3 (ONGOING):** Convert remaining 350+ files as they're modified
- **Phase 4 (FUTURE):** Add ESLint rule to enforce alias usage

### Guidelines for New Code

- **Always use aliases** for cross-layer imports
- **Always use aliases** for 3+ level relative imports
- **Keep relative imports** for same-directory or nearby files (1-2 levels)

### Guidelines for Modifying Existing Code

When you touch a file with relative imports:

1. **If making significant changes** (>10 lines): Convert all deep relative imports to aliases
2. **If making small changes** (<10 lines): Optional - convert if it improves readability
3. **Never mix styles**: If converting, convert ALL deep imports in that file

## Build & Testing

Aliases are natively supported by esbuild (via `tsconfig: "tsconfig.json"`). No plugins needed.

**Verify aliases work:**

```bash
# Build should complete without errors
npm run build

# Tests should pass
npm run test:all
```

## Troubleshooting

### "Cannot find module '@features/...'"

**Problem:** TypeScript can't resolve the alias.

**Solutions:**
1. Ensure `tsconfig.json` is in plugin root
2. Restart TypeScript server (VS Code: Cmd+Shift+P → "Restart TS Server")
3. Check that alias is defined in `tsconfig.json` paths

### Build succeeds but tests fail

**Problem:** Test runner might not use tsconfig aliases.

**Solution:** Ensure Vitest config (`vitest.config.ts`) includes:
```typescript
resolve: {
  alias: {
    '@app': '/src/app',
    '@features': '/src/features',
    // ... other aliases
  }
}
```

### Linter auto-organizes imports incorrectly

**Problem:** ESLint/Prettier reorders imports unexpectedly.

**Solution:** Acceptable - linters group imports by source (external → aliases → relative). This improves consistency.

## Reference

- **tsconfig.json:** Path alias definitions
- **esbuild.config.mjs:** Build configuration (no plugin needed for aliases)
- **CLAUDE.md:** Architecture standards and layer descriptions
- **ROADMAP.md:** Current migration status

## Future Enhancements

Planned improvements (not yet implemented):

1. **ESLint rule:** Enforce alias usage for cross-layer imports
2. **IDE snippets:** Quick-insert common import patterns
3. **Automated migration:** Script to convert all remaining relative imports
4. **Layer violation detection:** Prevent services from importing features

---

**Last Updated:** 2025-11-26
**Status:** Active (Type consolidation complete - @types removed, use @domain instead)

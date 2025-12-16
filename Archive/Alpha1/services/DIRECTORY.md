# Services

**Zweck**: Infrastructure services providing core functionality for state management, logging, geometry calculations, and system-level operations.

## Inhalt

| Element | Beschreibung |
|---------|--------------|
| backup/ | Backup and restore functionality |
| caching/ | Caching layer for performance optimization |
| climate/ | Climate calculation services |
| domain/ | Shared domain types (calendar, terrain, tiles) |
| elevation/ | Terrain elevation algorithms (ElevationField, contours, hillshade, flow analysis, rivers, watersheds, sun position) |
| error-notification-service.ts | Centralized error notification system |
| events/ | Event bus and hooks system |
| geometry/ | Hex coordinate system and geometric calculations |
| graph/ | Graph algorithms and data structures |
| hex-rendering/ | Hex geometry utilities (corners, edges, camera) |
| import-export/ | Data import/export utilities |
| lifecycle-manager.ts | Lifecycle management for components |
| logging/ | Logging infrastructure |
| orchestration/ | Cross-feature coordination services |
| performance/ | Performance metrics and timing utilities |
| protocol/ | Communication protocol definitions |
| repositories/ | Abstract repository infrastructure for data access |
| settings/ | Settings management |
| state/ | Reactive state management stores |
| translator.ts | i18n translation service |
| validation/ | Schema validation for domain documents |
| virtual/ | Virtual file system abstractions |

## Verbindungen

- **Verwendet von**: Features, Workmodes, UI components
- **Abhängig von**: Obsidian API, third-party libraries (simplex-noise, etc.)

## Architektur-Hinweise

Services bilden die unterste Schicht der Anwendungsarchitektur:
- **Keine Abhängigkeiten** zu Features oder Workmodes
- **Rein funktional** oder zustandslos (außer state stores)
- **Wiederverwendbar** across all application layers
- **Well-tested** mit hoher Testabdeckung

## Wichtige Services

### State Management (`state/`)
Reactive stores für zentrale Zustandsverwaltung:
- `party-store.ts` - Party composition and stats
- `travel-store.ts` - Travel session state
- Store pattern mit Subscribe/Unsubscribe
- NOTE: Map tile state is now handled by TileCache in `@features/maps/data/tile-cache.ts`

### Geometry (`geometry/`)
Hex coordinate system (refactored from maps feature):
- Branded coordinate types (OddR, Axial, Cube)
- Type-safe conversions
- Distance, range, and neighbor calculations
- Import via `@geometry` path alias

### Logging (`logging/`)
Centralized logging to CONSOLE_LOG.txt:
- `logger.ts` - Main logger instance
- Structured logging with context
- Log levels (info, warn, error, debug)

### Domain Types (`domain/`)
Shared domain types across features:
- `calendar-types.ts` - Calendar and timestamp types
- `terrain-types.ts` - Terrain and flora types
- `tile-types.ts` - Tile data structures
- Type-only imports allowed from features

## Importieren

```typescript
// State management
import { getTileStore } from '@features/maps/data/tile-repository';

// Logging
import { logger } from '@services/logging/logger';

// Geometry (via alias)
import { oddr, hexDistance } from '@geometry';

// Domain types (type-only)
import type { CalendarTimestamp } from '@services/domain/calendar-types';
```

## Testing

Test files: `devkit/testing/unit/services/`

Service tests focus on:
- Unit tests for pure functions
- Integration tests for stores
- Mock factories for dependencies

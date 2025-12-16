# Features

**Zweck**: Shared business logic features providing domain-specific functionality used across multiple workmodes.

## Inhalt

| Element | Beschreibung |
|---------|--------------|
| audio/ | Audio playback and playlist management |
| characters/ | Character data management |
| climate/ | Climate simulation and weather modeling |
| data-manager/ | Entity CRUD operations and data browsing |
| dungeons/ | Dungeon grid rendering and token management |
| encounters/ | Encounter generation, creature repositories, habitat filtering |
| events/ | Event system and hook execution |
| factions/ | Faction simulation, territory, and relationships |
| locations/ | Location entities and spatial data |
| loot/ | Loot generation and treasure tables |
| maps/ | Hex-based map rendering, terrain, coordinate systems |
| weather/ | Weather generation and forecasting |

## Verbindungen

- **Verwendet von**: Workmodes (Library, Cartographer, Session Runner, Almanac)
- **Abhängig von**: Services layer, Obsidian API

## Architektur-Hinweise

Features bilden die mittlere Schicht (Business Logic):
- **Wiederverwendbar** across multiple workmodes
- **Keine Cross-Feature Runtime-Imports** (nur type-only imports erlaubt)
- **Repository Pattern** für alle Vault I/O Operationen
- **Store Pattern** für reaktive Zustandsverwaltung
- **Feature-Isolation** - jedes Feature ist selbstständig

## Feature Structure Standard

Jedes Feature MUSS diese Struktur folgen:

```
feature-name/
├── index.ts          # Public API (barrel exports)
├── DIRECTORY.md      # Feature documentation
├── types.ts          # Type definitions
├── data/             # Repositories & loaders (when ≥3 files)
├── domain/           # Business logic (when ≥3 files)
└── state/            # Stores (when ≥2 stores)
```

## Wichtige Features

### Maps (`maps/`)
Hex-based cartography infrastructure:
- Coordinate system (OddR, Axial, Cube with branded types)
- Terrain and flora management
- Tile persistence (dual-file: Markdown + JSON)
- Map rendering with SVG layers
- Overlay system for weather, factions, etc.

### Encounters (`encounters/`)
Encounter generation and creature management:
- Creature repository with habitat filtering
- Encounter context building
- Party tracking and composition
- Adaptive habitat scoring

### Climate (`climate/`)
Climate modeling and simulation:
- Temperature calculation by latitude/season
- Precipitation patterns
- Climate zone definitions
- Integration with weather system

### Factions (`factions/`)
Faction simulation and territory:
- Faction relationships and influence
- Territory mapping
- Event-driven faction updates
- Serialization and persistence

### Weather (`weather/`)
Weather generation and forecasting:
- Context-aware weather generation
- Forecast calculations
- Integration with climate and map data
- Weather state management

## Import Rules

**Erlaubt:**
```typescript
// Direct import from features
import { renderHexMap } from '@features/maps';
import { generateEncounter } from '@features/encounters';

// Type-only cross-feature imports
import type { WeatherData } from '@features/weather/types';
```

**Verboten:**
```typescript
// Runtime cross-feature imports
import { WeatherGenerator } from '@features/weather'; // ❌ Use dependency injection instead
```

## Testing

Test files: `devkit/testing/unit/features/`

Feature tests fokussieren auf:
- Domain logic correctness
- Repository integration
- Store reactivity
- Cross-feature type compatibility

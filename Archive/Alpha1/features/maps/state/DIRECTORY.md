# Maps State Management

**Zweck**: Reactive state stores für Map-Daten (Terrain, Elevation, Factions, Locations, Weather).

## Contents

| Element | Beschreibung |
|---------|--------------|
| `elevation-store.ts` | Elevation data management (heights, hillshade) |
| `faction-overlay-store.ts` | Faction territory overlay state |
| `global-store-manager.ts` | Global store lifecycle coordination |
| `location-influence-store.ts` | Location influence area state |
| `location-marker-store.ts` | Location marker positions and data |
| `store-utilities.ts` | Shared utility functions for stores |
| `terrain-feature-persistence.ts` | Persistence layer for terrain features |
| `terrain-feature-renderer.ts` | Rendering adapter for terrain features |
| `terrain-feature-store.ts` | Terrain feature state (rivers, roads, etc.) |
| `terrain-feature-types.ts` | Type definitions for terrain features |
| `terrain-store.ts` | Base terrain type state |
| `weather-overlay-store.ts` | Weather overlay state (temp, precipitation, etc.) |

## Connections

**Verwendet von:**
- `src/workmodes/cartographer/` - Map editing
- `src/workmodes/session-runner/` - Travel and encounters
- `src/features/maps/overlay/` - Layer rendering
- `src/features/maps/rendering/` - Hex rendering

**Abhängig von:**
- `../domain/` - Type definitions
- `@services/state` - Base store infrastructure
- `@geometry` - AxialCoord coordinate system

## Store Pattern

Alle Stores folgen dem Reactive Store Pattern:

```typescript
interface Store<T> {
    subscribe(listener: (value: T) => void): () => void;
    get(): T;
    set(value: T): void;
}
```

Stores werden über `global-store-manager.ts` koordiniert für:
- Lifecycle Management (create/dispose)
- Cross-store Synchronization
- Memory-effiziente Cleanup

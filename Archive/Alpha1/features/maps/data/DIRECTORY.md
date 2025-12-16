# Data

**Zweck**: Map and tile data persistence layer - handles loading/saving tiles, map metadata, and cache management.

## Inhalt

| Element | Beschreibung |
|---------|--------------|
| index.ts | Barrel exports for data layer (repositories, cache) |
| tile-repository.ts | Primary tile data access API - getTileStore, loadTile, saveTile, deleteTile |
| tile-cache.ts | Unified tile cache implementation with state management |
| tile-json-io.ts | Consolidated JSON I/O - load/save tiles from .tiles.json files |
| map-repository.ts | Map-level operations - create, delete, list maps |
| map-store-registry.ts | Registry of map stores for reactive state management |
| region-repository.ts | Region data access for faction/area management |
| region-data-source.ts | Region data source adapter |
| elevation-repository.ts | Elevation data loading and caching |
| tile-note-repository.ts | Tile note (hex-specific markdown notes) persistence |

## Verbindungen

- **Verwendet von**:
  - `src/features/maps/rendering/` - Loads tiles for map display
  - `src/workmodes/cartographer/` - Map editor data access
  - `src/workmodes/session-runner/` - Travel mode tile queries
  - `src/features/maps/state/` - Store initialization and updates

- **Abhängig von**:
  - `@app/vault` - Obsidian vault file I/O
  - `@services/state` - WritableStore for reactive state
  - `@services/logging` - Plugin logger
  - `@services/geometry` - Coordinate utilities (coordToKey, keyToCoord)
  - `src/features/maps/domain/` - Terrain types, tile schema

## Architecture Notes

**Dual-File Storage**:
- Maps live in Markdown files (`Maps/my-world.md`)
- Tile data lives in JSON sidecar files (`Maps/my-world.tiles.json`)
- 96x faster loading, 95% smaller file size vs Markdown-only

**JSON Storage Format:**
```typescript
{
  version: 2,
  mapPath: "Maps/my-world.md",
  tiles: {
    "5,10": { terrain: "mountains", flora: "dense", ... },  // Key format: "q,r"
    "6,10": { terrain: "hills", flora: "medium", ... }
  }
}
```

**Coordinate Key Format:**
- Keys are `"q,r"` format (AxialCoord serialized)
- Example: `{ q: 5, r: 10 }` → `"5,10"`
- See `coordToKey()` / `keyToCoord()` in `@services/geometry`
- **Migration:** Old `"r,c"` format (OddR) no longer exists

**Cache Layer:**
- `tile-cache.ts` - Unified cache with WritableStore state
- Provides memory cache to avoid repeated disk reads

**Tile JSON I/O:**
- `tile-json-io.ts` - Consolidated loading/saving of .tiles.json files
- Replaces split tile-json-loader/saver/cache/validator modules

**Repository Pattern**:
- All vault I/O abstracted behind repositories
- Business logic never calls `app.vault` directly
- Enables testability and future storage migration

**Logging Behavior**:
- Tile operations use consolidated summary logs (start + end with timing)
- Verbose debug logs available via `./devkit log verbose`
- Example output (normal mode):
  ```
  [tile-repository] Initializing map: 721 tiles in 8 chunks
  [tile-repository] Map initialized: 721 tiles, radius 15 (45ms)
  ```

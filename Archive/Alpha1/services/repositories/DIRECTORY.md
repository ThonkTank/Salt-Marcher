# repositories/

**Purpose**: Abstract repository infrastructure for standardized vault data access patterns.

## Contents

| Element | Type | Description |
|---------|------|-------------|
| `base-repository.ts` | File | Core repository interfaces (Repository, BatchRepository, CachedRepository, IndexedRepository) and CacheStats type |
| `abstract-repository.ts` | File | Base implementation with CRUD operations, no caching |
| `abstract-cached-repository.ts` | File | Repository with lazy-loaded in-memory cache and invalidation |
| `abstract-indexed-repository.ts` | File | Repository with indexes for O(1) filtered queries |
| `abstract-batch-repository.ts` | File | Repository with batch load/save operations |
| `repository-error.ts` | File | Standardized error handling with RepositoryError and error codes |
| `index.ts` | File | Barrel export of all repository infrastructure |

## Connections

**Used by:**
- `src/features/*/data/*-repository.ts` - Concrete entity repositories
- `src/workmodes/library/items/item-repository.ts` - Item repository implementation
- `src/workmodes/almanac/data/` - Almanac data layer

**Depends on:**
- Obsidian App API (vault access)
- `src/services/caching/` - LRU cache for large datasets

## Public API

```typescript
// Base interfaces
export type {
    Repository,           // Basic CRUD: get, getAll, save, delete
    BatchRepository,      // Batch operations: loadBatch, saveBatch
    CachedRepository,     // Cache management: invalidateCache, getCacheStats
    IndexedRepository,    // Index queries: findByIndex
    CacheStats,          // Cache metrics: size, hitRate, memoryKB
};

// Abstract implementations
export { AbstractRepository };         // No caching
export { AbstractCachedRepository };   // Simple Map cache
export { AbstractIndexedRepository };  // With indexes
export { AbstractBatchRepository };    // Batch operations

// Error handling
export { RepositoryError };
export type { RepositoryErrorCode };   // NOT_FOUND, INVALID_DATA, IO_ERROR, etc.
```

## Usage Example

```typescript
// Cached repository with indexes
import { AbstractIndexedRepository } from '@services/repositories';

class CreatureRepository extends AbstractIndexedRepository<CreatureData> {
  constructor() {
    super();
    this.registerIndex('type', false);      // Single-value index
    this.registerIndex('habitat', true);     // Multi-value index
  }

  protected async loadAllFromSource(app: App): Promise<CreatureData[]> {
    // Load from vault via adapter
    const files = await app.vault.getMarkdownFiles();
    return await Promise.all(files.map(f => this.parseCreature(f)));
  }

  protected getEntityId(entity: CreatureData): string {
    return entity.id;
  }

  protected getIndexValue(entity: CreatureData, indexName: string): string | string[] {
    if (indexName === 'type') return entity.type;
    if (indexName === 'habitat') return entity.habitats;
    return '';
  }
}

// Usage
const repo = new CreatureRepository();
const beasts = await repo.findByIndex(app, 'type', 'Beast'); // O(1) lookup
const forestCreatures = await repo.findByIndex(app, 'habitat', 'forest');
```

## Design Patterns

**Abstract Factory**: Base classes provide template methods for concrete implementations

**Template Method**: `loadAllFromSource()`, `getEntityId()`, `getIndexValue()` hooks

**Strategy**: Different caching strategies (no cache, simple Map, LRU, debounced writes)

**Repository Pattern**: Abstraction layer between domain logic and data storage

## Caching Strategies

- **AbstractRepository**: No caching, direct vault access
- **AbstractCachedRepository**: Simple Map cache for small datasets (<100 items)
- **AbstractIndexedRepository**: Cache + indexes for fast queries
- **LRU Cache**: For large datasets (>1000 items) via `services/caching/`

## Error Handling

All repositories throw `RepositoryError` with error codes:
- `NOT_FOUND`: Entity doesn't exist
- `INVALID_DATA`: Parse/validation failure
- `IO_ERROR`: Vault read/write failure
- `PARSE_ERROR`: YAML/JSON parsing failure
- `CACHE_ERROR`: Cache operation failure

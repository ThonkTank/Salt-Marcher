// src/services/repositories/index.ts
// Unified repository infrastructure for standardized data access patterns

/**
 * Repository Infrastructure
 *
 * **Architecture:**
 * - Base interfaces define contracts for all repositories
 * - Abstract classes provide common implementations
 * - Concrete repositories extend abstracts for specific entities
 *
 * **Interfaces:**
 * - `Repository<T>`: Basic CRUD operations
 * - `BatchRepository<T>`: Batch operations for efficiency
 * - `CachedRepository<T>`: In-memory caching with invalidation
 * - `IndexedRepository<T>`: Filtered queries via indexes
 *
 * **Abstract Classes:**
 * - `AbstractRepository<T>`: Base implementation (no caching)
 * - `AbstractCachedRepository<T>`: With lazy-loaded cache
 * - `AbstractIndexedRepository<T>`: With indexes for fast queries
 * - `AbstractBatchRepository<T>`: With batch operations
 *
 * **Error Handling:**
 * - `RepositoryError`: Standardized errors with codes
 * - Error codes: NOT_FOUND, INVALID_DATA, IO_ERROR, PARSE_ERROR, etc.
 *
 * **Usage Examples:**
 *
 * ```typescript
 * // Simple cached repository
 * class CharacterRepository extends AbstractCachedRepository<CharacterData> {
 *   protected async loadAllFromSource(app: App): Promise<CharacterData[]> {
 *     // Load from vault
 *   }
 *
 *   protected getEntityId(entity: CharacterData): string {
 *     return entity.id;
 *   }
 * }
 *
 * // Indexed repository with fast queries
 * class CreatureRepository extends AbstractIndexedRepository<CreatureData> {
 *   constructor() {
 *     super();
 *     this.registerIndex('type', false);      // Single-value index
 *     this.registerIndex('habitat', true);     // Multi-value index
 *   }
 *
 *   protected getIndexValue(entity: CreatureData, indexName: string): string | string[] {
 *     if (indexName === 'type') return entity.type;
 *     if (indexName === 'habitat') return entity.habitats;
 *     return '';
 *   }
 * }
 *
 * // Query indexed repository
 * const beasts = await repo.findByIndex(app, 'type', 'Beast'); // O(1) lookup
 * const forestCreatures = await repo.findByIndex(app, 'habitat', 'forest');
 * ```
 *
 * **Caching Strategies:**
 * - **Simple Map (AbstractCachedRepository)**: For small datasets (<100 items)
 * - **LRU Cache (use LRUCache from services/caching)**: For large datasets (>1000 items)
 * - **Debounced Writes (TileJSONCache)**: For frequent mutations
 *
 * **Best Practices:**
 * - Use RepositoryError for all failures
 * - Implement getCacheKey() for case-insensitive lookups
 * - Override estimateMemoryKB() for accurate memory tracking
 * - Build indexes during cache load for O(1) queries
 * - Call invalidateCache() after mutations
 */

// Interfaces
export type {
    Repository,
    BatchRepository,
    CachedRepository,
    IndexedRepository,
    CacheStats,
} from "./base-repository";

// Abstract base classes
export { AbstractRepository } from "./abstract-repository";
export { AbstractCachedRepository } from "./abstract-cached-repository";
export { AbstractIndexedRepository } from "./abstract-indexed-repository";
export { AbstractBatchRepository } from "./abstract-batch-repository";

// Error handling
export { RepositoryError } from "./repository-error";
export type { RepositoryErrorCode } from "./repository-error";

// src/services/repositories/base-repository.ts
// Base repository interfaces for standardized data access patterns

import type { App } from "obsidian";

/**
 * Core repository interface for basic CRUD operations
 *
 * **Type Parameter:**
 * - `T`: Entity type (e.g., Creature, Character, Event)
 *
 * **Design Philosophy:**
 * - All methods accept `app: App` for Obsidian vault access
 * - IDs are strings (file paths, entity IDs, or coordinate keys)
 * - Return null for missing entities (not undefined)
 * - Throw RepositoryError for failures
 *
 * **Usage:**
 * ```typescript
 * class CreatureRepository implements Repository<CreatureData> {
 *   async load(app: App, name: string): Promise<CreatureData> {
 *     // Load creature from vault
 *   }
 * }
 * ```
 */
export interface Repository<T> {
    /**
     * Load single entity by ID
     *
     * @param app - Obsidian App instance
     * @param id - Entity identifier (name, path, or key)
     * @returns Entity data
     * @throws RepositoryError with code 'NOT_FOUND' if entity doesn't exist
     */
    load(app: App, id: string): Promise<T>;

    /**
     * Load all entities
     *
     * @param app - Obsidian App instance
     * @returns Array of all entities
     */
    loadAll(app: App): Promise<T[]>;

    /**
     * Save entity (create or update)
     *
     * @param app - Obsidian App instance
     * @param id - Entity identifier
     * @param data - Entity data to save
     * @throws RepositoryError with code 'INVALID_DATA' if validation fails
     * @throws RepositoryError with code 'IO_ERROR' if save fails
     */
    save(app: App, id: string, data: T): Promise<void>;

    /**
     * Delete entity
     *
     * @param app - Obsidian App instance
     * @param id - Entity identifier
     * @throws RepositoryError with code 'NOT_FOUND' if entity doesn't exist
     * @throws RepositoryError with code 'IO_ERROR' if delete fails
     */
    delete(app: App, id: string): Promise<void>;

    /**
     * Check if entity exists
     *
     * @param app - Obsidian App instance
     * @param id - Entity identifier
     * @returns True if entity exists
     */
    exists(app: App, id: string): Promise<boolean>;
}

/**
 * Repository interface with batch operations support
 *
 * **Batch Operations:**
 * - More efficient than N individual operations
 * - Atomic: either all succeed or all fail
 * - Fewer vault I/O calls
 *
 * **Usage:**
 * ```typescript
 * // Batch load (parallel)
 * const tiles = await repo.loadBatch(app, coords);
 *
 * // Batch save (single write)
 * await repo.saveBatch(app, [
 *   { id: '0,0', data: tile1 },
 *   { id: '1,0', data: tile2 }
 * ]);
 * ```
 */
export interface BatchRepository<T> extends Repository<T> {
    /**
     * Load multiple entities in parallel
     *
     * @param app - Obsidian App instance
     * @param ids - Entity identifiers to load
     * @returns Map of id -> entity data (excludes missing entities)
     */
    loadBatch(app: App, ids: string[]): Promise<Map<string, T>>;

    /**
     * Save multiple entities in single operation
     *
     * @param app - Obsidian App instance
     * @param items - Array of id/data pairs to save
     * @throws RepositoryError if any save fails
     */
    saveBatch(app: App, items: Array<{ id: string; data: T }>): Promise<void>;

    /**
     * Delete multiple entities in single operation
     *
     * @param app - Obsidian App instance
     * @param ids - Entity identifiers to delete
     * @throws RepositoryError if any delete fails
     */
    deleteBatch(app: App, ids: string[]): Promise<void>;
}

/**
 * Cache statistics for monitoring and debugging
 */
export interface CacheStats {
    /** Number of cached items */
    size: number;
    /** Cache hits since creation */
    hits: number;
    /** Cache misses since creation */
    misses: number;
    /** Hit rate (0.0 - 1.0) */
    hitRate: number;
    /** Estimated memory usage in KB */
    memoryEstimateKB: number;
    /** Cache is loaded (lazy repositories only) */
    loaded?: boolean;
}

/**
 * Repository interface with caching support
 *
 * **Caching Strategies:**
 * - **Eager**: Preload all entities on first access (small datasets <100 items)
 * - **Lazy**: Load on-demand, cache forever (medium datasets 100-1000 items)
 * - **LRU**: Load on-demand, evict least recently used (large datasets >1000 items)
 *
 * **Cache Invalidation:**
 * - Manual: `invalidateCache()` after mutations
 * - Automatic: Not implemented yet (future: file watchers)
 *
 * **Usage:**
 * ```typescript
 * // Warm cache on startup (optional)
 * await repo.preload(app);
 *
 * // Check cache health
 * const stats = repo.getCacheStats();
 * if (stats.hitRate < 0.8) {
 *   logger.warn("Low cache hit rate", stats);
 * }
 * ```
 */
export interface CachedRepository<T> extends Repository<T> {
    /**
     * Get cache statistics
     *
     * @returns Cache metrics for monitoring
     */
    getCacheStats(): CacheStats;

    /**
     * Clear cache and invalidate all entries
     *
     * Call this after:
     * - Importing new presets
     * - Modifying entity files directly
     * - DevKit operations that change data
     */
    invalidateCache(): Promise<void>;

    /**
     * Preload all entities into cache
     *
     * Optional optimization for eager caching strategy.
     * Useful for warming cache on plugin startup.
     *
     * @param app - Obsidian App instance
     */
    preload?(app: App): Promise<void>;
}

/**
 * Repository interface with indexing support
 *
 * **Indexes:**
 * - Built during initial cache load
 * - Provide O(1) or O(k) lookups for filtered queries
 * - Invalidated when cache is invalidated
 *
 * **Common Index Types:**
 * - Type index: Group by entity type (creatures by type, characters by class)
 * - Range index: Group by numeric range (creatures by CR, characters by level)
 * - Tag index: Group by tags/categories (creatures by habitat, spells by school)
 *
 * **Usage:**
 * ```typescript
 * // Query using index (O(1) lookup)
 * const beasts = await repo.findByIndex(app, 'type', 'Beast');
 *
 * // List available index keys
 * const types = repo.getIndexKeys('type'); // ['Beast', 'Dragon', 'Humanoid']
 * ```
 */
export interface IndexedRepository<T> extends CachedRepository<T> {
    /**
     * Find entities by index key
     *
     * @param app - Obsidian App instance
     * @param indexName - Index to query (e.g., 'type', 'cr', 'environment')
     * @param key - Key to look up (e.g., 'Beast', '5', 'forest')
     * @returns Entities matching the index key
     */
    findByIndex(app: App, indexName: string, key: string): Promise<T[]>;

    /**
     * Get all keys for an index
     *
     * @param indexName - Index to query
     * @returns Array of index keys (e.g., all creature types)
     */
    getIndexKeys(indexName: string): string[];

    /**
     * Get index statistics
     *
     * @returns Map of index name -> number of keys
     */
    getIndexStats(): Record<string, number>;
}

// src/services/repositories/abstract-indexed-repository.ts
// Abstract repository with indexing support for fast filtered queries

import type { App } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('abstract-indexed-repository');
import { AbstractCachedRepository } from "./abstract-cached-repository";
import type { IndexedRepository } from "./base-repository";

/**
 * Abstract repository with index support
 *
 * **Indexing:**
 * - Indexes built during initial cache load
 * - Provide O(1) lookups for filtered queries
 * - Automatically invalidated when cache is cleared
 *
 * **Index Types:**
 * - Single-value: Entity belongs to one group (type, class)
 * - Multi-value: Entity belongs to multiple groups (tags, habitats)
 *
 * **Subclass Implementation:**
 * - Must implement getIndexValue() to extract index values from entities
 * - Should call registerIndex() in constructor to declare indexes
 *
 * **Usage:**
 * ```typescript
 * class CreatureRepository extends AbstractIndexedRepository<CreatureData> {
 *   constructor() {
 *     super();
 *     this.registerIndex('type', false);     // Single-value
 *     this.registerIndex('habitat', true);    // Multi-value
 *   }
 *
 *   protected getIndexValue(entity: CreatureData, indexName: string): string | string[] {
 *     if (indexName === 'type') return entity.type;
 *     if (indexName === 'habitat') return entity.habitats; // Array
 *     return '';
 *   }
 * }
 * ```
 */
export abstract class AbstractIndexedRepository<T>
    extends AbstractCachedRepository<T>
    implements IndexedRepository<T>
{
    /** Registered indexes: name -> isMultiValue */
    protected registeredIndexes = new Map<string, boolean>();

    /** Index data: indexName -> (key -> entities) */
    protected indexes = new Map<string, Map<string, T[]>>();

    /**
     * Register an index
     *
     * Call this in subclass constructor to declare indexes.
     *
     * @param name - Index name (e.g., 'type', 'cr', 'habitat')
     * @param isMultiValue - True if entity can have multiple values for this index
     */
    protected registerIndex(name: string, isMultiValue: boolean = false): void {
        this.registeredIndexes.set(name, isMultiValue);
        this.indexes.set(name, new Map());
    }

    /**
     * Get index value(s) for entity
     *
     * Must be implemented by subclasses.
     *
     * @param entity - Entity to extract index values from
     * @param indexName - Index to extract values for
     * @returns Single value (string) or multiple values (string[])
     */
    protected abstract getIndexValue(entity: T, indexName: string): string | string[];

    /**
     * Normalize index key (case-insensitive, trimmed)
     *
     * Override for custom normalization logic.
     *
     * @param key - Raw index key
     * @returns Normalized key
     */
    protected normalizeIndexKey(key: string): string {
        return key.toLowerCase().trim();
    }

    /**
     * Build all registered indexes from cached entities
     *
     * Called automatically after cache load.
     */
    protected buildIndexes(entities: T[]): void {
        // Clear existing indexes
        for (const index of this.indexes.values()) {
            index.clear();
        }

        // Build each registered index
        for (const [indexName, isMultiValue] of this.registeredIndexes) {
            const index = this.indexes.get(indexName)!;

            for (const entity of entities) {
                const values = this.getIndexValue(entity, indexName);

                if (isMultiValue && Array.isArray(values)) {
                    // Multi-value index: add entity to each value's group
                    for (const rawValue of values) {
                        if (rawValue) {
                            const key = this.normalizeIndexKey(rawValue);
                            if (!index.has(key)) {
                                index.set(key, []);
                            }
                            index.get(key)!.push(entity);
                        }
                    }
                } else {
                    // Single-value index: add entity to one group
                    const rawValue = Array.isArray(values) ? values[0] : values;
                    if (rawValue) {
                        const key = this.normalizeIndexKey(rawValue);
                        if (!index.has(key)) {
                            index.set(key, []);
                        }
                        index.get(key)!.push(entity);
                    }
                }
            }

            logger.info(`Built index`, {
                name: indexName,
                keys: index.size,
            });
        }
    }

    /**
     * Clear all indexes
     */
    protected clearIndexes(): void {
        for (const index of this.indexes.values()) {
            index.clear();
        }
    }

    // ===== IndexedRepository interface =====

    async findByIndex(app: App, indexName: string, key: string): Promise<T[]> {
        await this.ensureCacheLoaded(app);

        const index = this.indexes.get(indexName);
        if (!index) {
            logger.warn(`Index not found`, {
                indexName,
                registered: Array.from(this.registeredIndexes.keys()),
            });
            return [];
        }

        const normalizedKey = this.normalizeIndexKey(key);
        return index.get(normalizedKey) || [];
    }

    /**
     * Find entities matching multiple index criteria (intersection)
     *
     * Performs an intersection of multiple index lookups to find entities
     * that match ALL specified criteria. This enables complex queries like:
     * "Find all Beast creatures in Forest habitat with CR 1/4"
     *
     * @param app - Obsidian App instance
     * @param filters - Map of indexName -> value to filter by
     * @returns Entities matching ALL index criteria
     *
     * @example
     * ```typescript
     * // Find Beast creatures in Forest habitat
     * const creatures = await repo.findByIndexes(app, {
     *   type: 'Beast',
     *   habitat: 'Forest'
     * });
     *
     * // Find CR 1/4 creatures that are Beasts
     * const lowCRBeasts = await repo.findByIndexes(app, {
     *   cr: '1/4',
     *   type: 'Beast'
     * });
     * ```
     */
    async findByIndexes(app: App, filters: Record<string, string>): Promise<T[]> {
        const startTime = performance.now();

        // Ensure cache is loaded
        await this.ensureCacheLoaded(app);

        const filterEntries = Object.entries(filters);

        // No filters = return all
        if (filterEntries.length === 0) {
            logger.warn(`findByIndexes called with no filters`);
            return Array.from(this.cache.values());
        }

        // Single filter = use existing optimized method
        if (filterEntries.length === 1) {
            const [indexName, value] = filterEntries[0];
            return this.findByIndex(app, indexName, value);
        }

        // Multiple filters: start with smallest result set for efficiency
        let results: T[] | null = null;
        const sortedFilters = filterEntries.sort((a, b) => {
            const aSize = this.indexes.get(a[0])?.get(this.normalizeIndexKey(a[1]))?.length || 0;
            const bSize = this.indexes.get(b[0])?.get(this.normalizeIndexKey(b[1]))?.length || 0;
            return aSize - bSize;
        });

        for (const [indexName, value] of sortedFilters) {
            const matches = await this.findByIndex(app, indexName, value);

            if (results === null) {
                // First filter: use as base result set
                results = matches;
            } else {
                // Subsequent filters: intersect with existing results
                const matchSet = new Set(matches);
                results = results.filter(entity => matchSet.has(entity));
            }

            // Early exit if no matches
            if (results.length === 0) {
                break;
            }
        }

        const elapsed = performance.now() - startTime;
        logger.info(`Multi-index query completed`, {
            filters,
            resultCount: results?.length || 0,
            timeMs: elapsed.toFixed(2),
        });

        return results || [];
    }

    getIndexKeys(indexName: string): string[] {
        const index = this.indexes.get(indexName);
        if (!index) {
            return [];
        }
        return Array.from(index.keys());
    }

    getIndexStats(): Record<string, number> {
        const stats: Record<string, number> = {};
        for (const [name, index] of this.indexes) {
            stats[name] = index.size;
        }
        return stats;
    }
}

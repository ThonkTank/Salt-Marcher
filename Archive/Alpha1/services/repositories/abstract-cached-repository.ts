// src/services/repositories/abstract-cached-repository.ts
// Abstract repository with caching support

import type { App } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('abstract-cached-repository');
import { AbstractRepository } from "./abstract-repository";
import type { CachedRepository, CacheStats } from "./base-repository";

/**
 * Abstract repository with caching
 *
 * **Cache Strategy:**
 * - Lazy loading: Cache populated on first access
 * - In-memory: Uses Map for O(1) lookups
 * - Manual invalidation: Call invalidateCache() after mutations
 *
 * **Subclass Implementation:**
 * - Must implement abstract methods (loadFromSource, etc.)
 * - Can override getCacheKey() for custom key logic
 * - Can override buildIndexes() to add indexes during cache load
 *
 * **Usage:**
 * ```typescript
 * class CharacterRepository extends AbstractCachedRepository<CharacterData> {
 *   protected async loadAllFromSource(app: App): Promise<CharacterData[]> {
 *     // Load from vault
 *   }
 *
 *   protected getCacheKey(id: string): string {
 *     return id.toLowerCase(); // Case-insensitive keys
 *   }
 * }
 * ```
 */
export abstract class AbstractCachedRepository<T>
    extends AbstractRepository<T>
    implements CachedRepository<T>
{
    /** In-memory cache: key -> entity */
    protected cache = new Map<string, T>();

    /** Cache loaded flag (lazy loading) */
    protected cacheLoaded = false;

    /** Cache statistics */
    protected stats = {
        hits: 0,
        misses: 0,
    };

    /**
     * Get cache key for entity ID
     *
     * Default: use ID as-is
     * Override for case-insensitive keys: `id.toLowerCase()`
     *
     * @param id - Entity identifier
     * @returns Cache key
     */
    protected getCacheKey(id: string): string {
        return id;
    }

    /**
     * Build indexes after cache load
     *
     * Override in subclasses to build indexes from cached entities.
     * Called once after initial cache load.
     *
     * @param entities - All cached entities
     */
    protected buildIndexes(entities: T[]): void {
        // No-op by default (subclasses can override)
    }

    /**
     * Clear indexes
     *
     * Override in subclasses to clear custom indexes.
     * Called when cache is invalidated.
     */
    protected clearIndexes(): void {
        // No-op by default (subclasses can override)
    }

    /**
     * Ensure cache is loaded
     *
     * Lazy loads cache on first access.
     */
    protected async ensureCacheLoaded(app: App): Promise<void> {
        if (this.cacheLoaded) return;

        const startTime = performance.now();
        const entities = await this.loadAllFromSource(app);

        // Populate cache
        this.cache.clear();
        for (const entity of entities) {
            const key = this.getCacheKey(this.getEntityId(entity));
            this.cache.set(key, entity);
        }

        // Build indexes
        this.buildIndexes(entities);

        this.cacheLoaded = true;
        const loadTime = performance.now() - startTime;

        // Log performance warning if load time is slow
        const memoryKB = this.estimateMemoryKB();
        if (loadTime > 100) {
            logger.warn(`Slow cache load detected`, {
                size: this.cache.size,
                loadTimeMs: loadTime.toFixed(2),
                memoryKB: memoryKB.toFixed(2),
            });
        } else {
            logger.info(`Cache loaded`, {
                size: this.cache.size,
                loadTimeMs: loadTime.toFixed(2),
                memoryKB: memoryKB.toFixed(2),
            });
        }

        // Alert if memory usage is high
        if (memoryKB > 50 * 1024) {  // 50MB
            logger.warn(`High memory usage detected`, {
                memoryMB: (memoryKB / 1024).toFixed(2),
                entities: this.cache.size,
            });
        }
    }

    /**
     * Get entity ID for cache key generation
     *
     * Must be implemented by subclasses to extract ID from entity.
     *
     * @param entity - Entity data
     * @returns Entity identifier
     */
    protected abstract getEntityId(entity: T): string;

    // ===== Override Repository methods to use cache =====

    async load(app: App, id: string): Promise<T> {
        await this.ensureCacheLoaded(app);

        const key = this.getCacheKey(id);
        const entity = this.cache.get(key);

        if (entity) {
            this.stats.hits++;
            return entity;
        }

        this.stats.misses++;

        // Try loading from source (might exist but not in cache)
        return this.loadFromSource(app, id);
    }

    async loadAll(app: App): Promise<T[]> {
        await this.ensureCacheLoaded(app);
        return Array.from(this.cache.values());
    }

    async exists(app: App, id: string): Promise<boolean> {
        await this.ensureCacheLoaded(app);
        const key = this.getCacheKey(id);
        return this.cache.has(key);
    }

    // ===== CachedRepository interface =====

    getCacheStats(): CacheStats {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? this.stats.hits / total : 0;

        return {
            size: this.cache.size,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate,
            memoryEstimateKB: this.estimateMemoryKB(),
            loaded: this.cacheLoaded,
        };
    }

    async invalidateCache(): Promise<void> {
        logger.info(`Invalidating cache`, {
            size: this.cache.size,
        });

        this.cache.clear();
        this.clearIndexes();
        this.cacheLoaded = false;
        this.stats.hits = 0;
        this.stats.misses = 0;
    }

    async preload(app: App): Promise<void> {
        await this.ensureCacheLoaded(app);
    }

    /**
     * Estimate memory usage in KB
     *
     * Override for more accurate estimates based on entity size.
     * Uses JSON serialization as a rough estimate of object memory usage.
     *
     * @returns Estimated memory in KB
     */
    protected estimateMemoryKB(): number {
        // Sample a subset of entities for performance (max 100)
        const sampleSize = Math.min(100, this.cache.size);
        if (sampleSize === 0) return 0;

        let totalBytes = 0;
        let count = 0;

        // Sample entities evenly across the cache
        const step = Math.max(1, Math.floor(this.cache.size / sampleSize));
        const entries = Array.from(this.cache.values());

        for (let i = 0; i < entries.length && count < sampleSize; i += step) {
            try {
                // Estimate size using JSON serialization
                const json = JSON.stringify(entries[i]);
                totalBytes += json.length * 2; // UTF-16 = 2 bytes per character
                count++;
            } catch (e) {
                // If serialization fails, use default estimate
                totalBytes += 1024;
                count++;
            }
        }

        // Extrapolate to full cache size
        const avgBytesPerEntity = count > 0 ? totalBytes / count : 1024;
        const totalEstimatedBytes = avgBytesPerEntity * this.cache.size;

        // Add overhead for Map structure and object references (~20%)
        const withOverhead = totalEstimatedBytes * 1.2;

        return withOverhead / 1024; // Convert to KB
    }
}

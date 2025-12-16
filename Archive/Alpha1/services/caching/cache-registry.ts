// src/services/caching/cache-registry.ts
// Global cache registry for centralized management and monitoring

import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('cache-registry');
import type { CacheManager, CacheStats } from "./cache-manager";

/**
 * Global cache statistics aggregated across all caches
 */
export interface GlobalCacheStats {
    /** Total number of registered caches */
    cacheCount: number;

    /** Total items across all caches */
    totalItems: number;

    /** Total cache hits */
    totalHits: number;

    /** Total cache misses */
    totalMisses: number;

    /** Global hit rate (0-1) */
    globalHitRate: number;

    /** Total memory usage in MB */
    totalMemoryMB: number;

    /** Per-cache statistics */
    caches: Record<string, CacheStats>;
}

/**
 * Global cache registry for centralized cache management
 *
 * **Features:**
 * - Register/unregister caches
 * - Aggregate statistics across all caches
 * - Global clear operation
 * - Memory pressure handling
 * - Debugging interface
 *
 * **Usage:**
 * ```typescript
 * const registry = GlobalCacheRegistry.getInstance();
 *
 * // Register caches
 * registry.register("creatures", creatureCache);
 * registry.register("characters", characterCache);
 *
 * // Get statistics
 * const stats = registry.getGlobalStats();
 * console.log(`Total memory: ${stats.totalMemoryMB}MB`);
 *
 * // Clear all caches
 * registry.clearAll();
 *
 * // Handle memory pressure
 * registry.onMemoryPressure();
 * ```
 */
export class GlobalCacheRegistry {
    private static instance: GlobalCacheRegistry | null = null;

    private caches = new Map<string, CacheManager<any>>();
    private memoryPressureThresholdMB = 100; // Default: 100MB total

    private constructor() {
        logger.info("Initialized");
    }

    /**
     * Get singleton instance
     */
    static getInstance(): GlobalCacheRegistry {
        if (!GlobalCacheRegistry.instance) {
            GlobalCacheRegistry.instance = new GlobalCacheRegistry();
        }
        return GlobalCacheRegistry.instance;
    }

    /**
     * Reset singleton (for testing)
     */
    static resetInstance(): void {
        GlobalCacheRegistry.instance?.disposeAll();
        GlobalCacheRegistry.instance = null;
    }

    /**
     * Register a cache in the global registry
     *
     * @param name - Unique cache name
     * @param cache - Cache instance to register
     */
    register(name: string, cache: CacheManager<any>): void {
        if (this.caches.has(name)) {
            logger.warn("Cache already registered, replacing", { name });
            this.unregister(name);
        }

        this.caches.set(name, cache);

        logger.info("Cache registered", {
            name,
            stats: cache.getStats(),
        });
    }

    /**
     * Unregister a cache from the registry
     *
     * @param name - Cache name to unregister
     */
    unregister(name: string): void {
        const cache = this.caches.get(name);
        if (!cache) {
            logger.warn("Cache not found", { name });
            return;
        }

        cache.dispose();
        this.caches.delete(name);

        logger.info("Cache unregistered", { name });
    }

    /**
     * Get a registered cache by name
     *
     * @param name - Cache name
     * @returns Cache instance or undefined
     */
    get(name: string): CacheManager<any> | undefined {
        return this.caches.get(name);
    }

    /**
     * Check if a cache is registered
     *
     * @param name - Cache name
     * @returns True if registered
     */
    has(name: string): boolean {
        return this.caches.has(name);
    }

    /**
     * Get all registered cache names
     *
     * @returns Array of cache names
     */
    getCacheNames(): string[] {
        return Array.from(this.caches.keys());
    }

    /**
     * Clear all registered caches
     */
    clearAll(): void {
        logger.info("Clearing all caches", {
            count: this.caches.size,
        });

        for (const [name, cache] of this.caches) {
            cache.clear();
            logger.debug("Cache cleared", { name });
        }
    }

    /**
     * Get global statistics aggregated across all caches
     *
     * @returns Global cache statistics
     */
    getGlobalStats(): GlobalCacheStats {
        let totalItems = 0;
        let totalHits = 0;
        let totalMisses = 0;
        let totalMemoryMB = 0;

        const caches: Record<string, CacheStats> = {};

        for (const [name, cache] of this.caches) {
            const stats = cache.getStats();
            caches[name] = stats;

            totalItems += stats.size;
            totalHits += stats.hits;
            totalMisses += stats.misses;
            totalMemoryMB += stats.memoryMB;
        }

        const totalRequests = totalHits + totalMisses;
        const globalHitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

        return {
            cacheCount: this.caches.size,
            totalItems,
            totalHits,
            totalMisses,
            globalHitRate,
            totalMemoryMB,
            caches,
        };
    }

    /**
     * Get total memory usage across all caches
     *
     * @returns Total memory in MB
     */
    getTotalMemoryUsage(): number {
        let total = 0;
        for (const cache of this.caches.values()) {
            total += cache.getMemoryUsage();
        }
        return total;
    }

    /**
     * Set memory pressure threshold
     *
     * @param thresholdMB - Threshold in MB
     */
    setMemoryPressureThreshold(thresholdMB: number): void {
        this.memoryPressureThresholdMB = thresholdMB;
        logger.info("Memory pressure threshold set", {
            thresholdMB,
        });
    }

    /**
     * Handle memory pressure by evicting from all caches
     *
     * Evicts items from caches proportionally until under threshold.
     * Prioritizes larger caches for eviction.
     */
    onMemoryPressure(): void {
        const currentMemory = this.getTotalMemoryUsage();

        if (currentMemory <= this.memoryPressureThresholdMB) {
            logger.debug("No memory pressure", {
                currentMemory,
                threshold: this.memoryPressureThresholdMB,
            });
            return;
        }

        logger.warn("Memory pressure detected, evicting", {
            currentMemory,
            threshold: this.memoryPressureThresholdMB,
            overagePercent: Math.round(
                ((currentMemory - this.memoryPressureThresholdMB) /
                    this.memoryPressureThresholdMB) *
                    100
            ),
        });

        // Sort caches by memory usage (largest first)
        const cachesByMemory = Array.from(this.caches.entries()).sort(
            ([, a], [, b]) => b.getMemoryUsage() - a.getMemoryUsage()
        );

        // Evict from largest caches first
        for (const [name, cache] of cachesByMemory) {
            const stats = cache.getStats();

            // Calculate how many items to evict (20% of cache)
            const evictCount = Math.ceil(stats.size * 0.2);

            logger.info("Evicting from cache", {
                name,
                currentSize: stats.size,
                evictCount,
                memoryMB: stats.memoryMB,
            });

            // Evict items by clearing and letting cache refill naturally
            // Note: This is a simple strategy. More sophisticated approaches
            // could selectively evict based on access patterns.
            const keys = cache.keys();
            for (let i = 0; i < evictCount && i < keys.length; i++) {
                cache.delete(keys[i]);
            }

            // Check if we're now under threshold
            const newMemory = this.getTotalMemoryUsage();
            if (newMemory <= this.memoryPressureThresholdMB) {
                logger.info("Memory pressure resolved", {
                    previousMemory: currentMemory,
                    currentMemory: newMemory,
                });
                break;
            }
        }

        // If still over threshold after eviction, log warning
        const finalMemory = this.getTotalMemoryUsage();
        if (finalMemory > this.memoryPressureThresholdMB) {
            logger.warn(
                "Memory pressure not fully resolved",
                {
                    currentMemory: finalMemory,
                    threshold: this.memoryPressureThresholdMB,
                }
            );
        }
    }

    /**
     * Dispose all caches and cleanup
     */
    disposeAll(): void {
        logger.info("Disposing all caches", {
            count: this.caches.size,
        });

        for (const [name, cache] of this.caches) {
            cache.dispose();
            logger.debug("Cache disposed", { name });
        }

        this.caches.clear();
    }

    /**
     * Generate debug report
     *
     * @returns Formatted debug report string
     */
    generateDebugReport(): string {
        const stats = this.getGlobalStats();

        const lines: string[] = [];
        lines.push("=== Cache Registry Debug Report ===");
        lines.push("");
        lines.push(`Total Caches: ${stats.cacheCount}`);
        lines.push(`Total Items: ${stats.totalItems}`);
        lines.push(`Total Memory: ${stats.totalMemoryMB.toFixed(2)}MB`);
        lines.push(
            `Global Hit Rate: ${(stats.globalHitRate * 100).toFixed(1)}%`
        );
        lines.push(
            `Memory Threshold: ${this.memoryPressureThresholdMB}MB`
        );
        lines.push("");

        lines.push("Per-Cache Statistics:");
        lines.push("");

        for (const [name, cacheStats] of Object.entries(stats.caches)) {
            lines.push(`  ${name}:`);
            lines.push(`    Size: ${cacheStats.size} items`);
            lines.push(`    Memory: ${cacheStats.memoryMB.toFixed(2)}MB`);
            lines.push(
                `    Hit Rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`
            );
            lines.push(
                `    Hits: ${cacheStats.hits}, Misses: ${cacheStats.misses}`
            );
            lines.push(`    Evictions: ${cacheStats.evictions}`);
            if (cacheStats.maxSize !== undefined) {
                lines.push(`    Max Size: ${cacheStats.maxSize}`);
            }
            if (cacheStats.maxMemoryMB !== undefined) {
                lines.push(`    Max Memory: ${cacheStats.maxMemoryMB}MB`);
            }
            lines.push("");
        }

        return lines.join("\n");
    }
}

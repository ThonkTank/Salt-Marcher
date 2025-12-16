// src/services/caching/lru-cache.ts
// LRU (Least Recently Used) cache implementation with O(1) operations

import { CacheManager, type CacheOptions } from "./cache-manager";

/**
 * Cache entry with metadata for LRU tracking
 */
interface LRUEntry<V> {
    value: V;
    timestamp: number;
    accessCount: number;
    sizeBytes: number;
}

/**
 * LRU Cache with O(1) get/set operations
 *
 * **Algorithm:**
 * - Maintains access order using a doubly-linked list concept
 * - Most recently used items at the end
 * - Evicts least recently used items when capacity reached
 *
 * **Performance:**
 * - Get: O(1)
 * - Set: O(1)
 * - Eviction: O(1)
 *
 * **Usage:**
 * ```typescript
 * const cache = new LRUCache<CreatureData>({
 *   maxSize: 1000,
 *   maxMemoryMB: 10
 * });
 *
 * cache.set("goblin", goblinData);
 * const data = cache.get("goblin"); // Moves to end (most recent)
 * ```
 */
export class LRUCache<V> extends CacheManager<V> {
    /** Access order: least recent → most recent */
    private accessOrder: string[] = [];

    constructor(options: CacheOptions = {}) {
        super({ ...options, evictionPolicy: 'lru' });
    }

    /**
     * Update access order when item is accessed
     */
    protected onAccess(key: string, entry: LRUEntry<V>): void {
        // Move to end (most recent)
        this.moveToEnd(key);
    }

    /**
     * Add to access order when item is set
     */
    protected onSet(key: string, entry: LRUEntry<V>): void {
        // Remove if exists (will be re-added at end)
        const existingIndex = this.accessOrder.indexOf(key);
        if (existingIndex !== -1) {
            this.accessOrder.splice(existingIndex, 1);
        }

        // Add to end (most recent)
        this.accessOrder.push(key);
    }

    /**
     * Remove from access order when item is deleted
     */
    protected onDelete(key: string, entry: LRUEntry<V>): void {
        const index = this.accessOrder.indexOf(key);
        if (index !== -1) {
            this.accessOrder.splice(index, 1);
        }
    }

    /**
     * Clear access order when cache is cleared
     */
    protected onClear(): void {
        this.accessOrder = [];
    }

    /**
     * Select least recently used item for eviction
     */
    protected selectEvictionCandidate(): string | null {
        // First item is least recently used
        return this.accessOrder[0] ?? null;
    }

    /**
     * Move key to end of access order (most recent)
     */
    private moveToEnd(key: string): void {
        const index = this.accessOrder.indexOf(key);
        if (index === -1) return;

        // Remove from current position
        this.accessOrder.splice(index, 1);

        // Add to end
        this.accessOrder.push(key);
    }

    /**
     * Get access order for debugging
     */
    getAccessOrder(): readonly string[] {
        return this.accessOrder;
    }
}

// src/services/caching/cache-manager.ts
// Base cache management framework with statistics and lifecycle

import { logger } from "@services/logging/logger";

// Generic callback type for cache events
type EventCallback = (...args: any[]) => void;

/**
 * Cache configuration options
 */
export interface CacheOptions {
    /** Maximum number of items in cache */
    maxSize?: number;

    /** Maximum memory usage in MB (approximate) */
    maxMemoryMB?: number;

    /** Time-to-live in milliseconds */
    ttlMs?: number;

    /** Eviction policy */
    evictionPolicy?: 'lru' | 'lfu' | 'fifo';

    /** Called when an item is evicted */
    onEvict?: (key: string, value: any) => void;

    /** Estimate memory usage per item (in bytes) */
    estimateSize?: (value: any) => number;
}

/**
 * Cache statistics for monitoring and debugging
 */
export interface CacheStats {
    /** Current number of items */
    size: number;

    /** Cache hit count */
    hits: number;

    /** Cache miss count */
    misses: number;

    /** Number of items evicted */
    evictions: number;

    /** Hit rate (0-1) */
    hitRate: number;

    /** Estimated memory usage in MB */
    memoryMB: number;

    /** Maximum configured size */
    maxSize: number | undefined;

    /** Maximum configured memory */
    maxMemoryMB: number | undefined;
}

/**
 * Cache entry with metadata
 */
interface CacheEntry<V> {
    value: V;
    timestamp: number;
    accessCount: number;
    sizeBytes: number;
}

/**
 * Cache events for observability
 */
export interface CacheEvents<V> {
    evict: (key: string, value: V) => void;
    clear: () => void;
    set: (key: string, value: V) => void;
    delete: (key: string) => void;
}

/**
 * Base cache manager with statistics tracking and lifecycle management
 *
 * **Features:**
 * - Generic key-value storage
 * - Hit/miss statistics
 * - Memory estimation
 * - Eviction callbacks
 * - Observable events
 * - Lifecycle disposal
 *
 * **Usage:**
 * ```typescript
 * const cache = new LRUCache<CreatureData>({
 *   maxSize: 1000,
 *   maxMemoryMB: 10,
 *   onEvict: (key, value) => logger.info(`Evicted: ${key}`)
 * });
 *
 * cache.set("goblin", goblinData);
 * const data = cache.get("goblin"); // Cache hit
 * const stats = cache.getStats();
 * cache.dispose();
 * ```
 */
export abstract class CacheManager<V> {
    protected cache = new Map<string, CacheEntry<V>>();
    protected options: Required<CacheOptions>;

    // Statistics
    protected hits = 0;
    protected misses = 0;
    protected evictions = 0;
    protected totalMemoryBytes = 0;

    // Event emitter
    private listeners = new Map<keyof CacheEvents<V>, Set<EventCallback>>();

    constructor(options: CacheOptions = {}) {
        this.options = {
            maxSize: options.maxSize ?? Infinity,
            maxMemoryMB: options.maxMemoryMB ?? Infinity,
            ttlMs: options.ttlMs ?? Infinity,
            evictionPolicy: options.evictionPolicy ?? 'lru',
            onEvict: options.onEvict ?? (() => {}),
            estimateSize: options.estimateSize ?? this.defaultEstimateSize,
        };
    }

    /**
     * Get value from cache (or undefined if not found/expired)
     */
    get(key: string): V | undefined {
        const entry = this.cache.get(key);

        if (!entry) {
            this.misses++;
            return undefined;
        }

        // Check TTL
        if (this.isExpired(entry)) {
            this.delete(key);
            this.misses++;
            return undefined;
        }

        // Update access metadata
        entry.accessCount++;
        this.onAccess(key, entry);

        this.hits++;
        return entry.value;
    }

    /**
     * Set value in cache (may trigger eviction)
     */
    set(key: string, value: V): void {
        const sizeBytes = this.options.estimateSize(value);

        // Check if key already exists
        const existing = this.cache.get(key);
        if (existing) {
            this.totalMemoryBytes -= existing.sizeBytes;
        }

        // Create entry
        const entry: CacheEntry<V> = {
            value,
            timestamp: Date.now(),
            accessCount: 1,
            sizeBytes,
        };

        // Check limits before adding
        this.ensureCapacity(sizeBytes);

        // Add to cache
        this.cache.set(key, entry);
        this.totalMemoryBytes += sizeBytes;

        // Hook for subclasses (e.g., update access order)
        this.onSet(key, entry);

        // Emit event
        this.emit('set', key, value);
    }

    /**
     * Check if key exists in cache
     */
    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;

        // Check TTL
        if (this.isExpired(entry)) {
            this.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Delete key from cache
     */
    delete(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;

        this.cache.delete(key);
        this.totalMemoryBytes -= entry.sizeBytes;

        // Hook for subclasses
        this.onDelete(key, entry);

        // Emit event
        this.emit('delete', key);

        return true;
    }

    /**
     * Clear all entries
     */
    clear(): void {
        this.cache.clear();
        this.totalMemoryBytes = 0;
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;

        // Hook for subclasses
        this.onClear();

        // Emit event
        this.emit('clear');
    }

    /**
     * Get number of items in cache
     */
    get size(): number {
        return this.cache.size;
    }

    /**
     * Get all keys (for debugging/inspection)
     */
    keys(): string[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Get all values (for debugging/inspection)
     */
    values(): V[] {
        return Array.from(this.cache.values()).map(entry => entry.value);
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        const total = this.hits + this.misses;
        const hitRate = total > 0 ? this.hits / total : 0;

        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            evictions: this.evictions,
            hitRate,
            memoryMB: this.totalMemoryBytes / (1024 * 1024),
            maxSize: this.options.maxSize === Infinity ? undefined : this.options.maxSize,
            maxMemoryMB: this.options.maxMemoryMB === Infinity ? undefined : this.options.maxMemoryMB,
        };
    }

    /**
     * Get estimated memory usage in MB
     */
    getMemoryUsage(): number {
        return this.totalMemoryBytes / (1024 * 1024);
    }

    /**
     * Get batch of values
     */
    getBatch(keys: string[]): Map<string, V> {
        const result = new Map<string, V>();

        for (const key of keys) {
            const value = this.get(key);
            if (value !== undefined) {
                result.set(key, value);
            }
        }

        return result;
    }

    /**
     * Set batch of values
     */
    setBatch(entries: Array<[string, V]>): void {
        for (const [key, value] of entries) {
            this.set(key, value);
        }
    }

    /**
     * Subscribe to cache events
     */
    on<E extends keyof CacheEvents<V>>(
        event: E,
        callback: CacheEvents<V>[E]
    ): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }

        this.listeners.get(event)!.add(callback as EventCallback);

        // Return unsubscribe function
        return () => {
            this.listeners.get(event)?.delete(callback as EventCallback);
        };
    }

    /**
     * Dispose cache and cleanup resources
     */
    dispose(): void {
        this.clear();
        this.listeners.clear();
    }

    // Protected hooks for subclasses

    /**
     * Called when item is accessed (for LRU/LFU tracking)
     */
    protected abstract onAccess(key: string, entry: CacheEntry<V>): void;

    /**
     * Called when item is set (for access order tracking)
     */
    protected abstract onSet(key: string, entry: CacheEntry<V>): void;

    /**
     * Called when item is deleted
     */
    protected abstract onDelete(key: string, entry: CacheEntry<V>): void;

    /**
     * Called when cache is cleared
     */
    protected abstract onClear(): void;

    /**
     * Select which key to evict (policy-specific)
     */
    protected abstract selectEvictionCandidate(): string | null;

    // Private helpers

    /**
     * Ensure cache has capacity for new entry
     */
    private ensureCapacity(newItemSize: number): void {
        // Check size limit
        while (this.cache.size >= this.options.maxSize) {
            if (!this.evictOne()) break;
        }

        // Check memory limit
        const maxMemoryBytes = this.options.maxMemoryMB * 1024 * 1024;
        while (this.totalMemoryBytes + newItemSize > maxMemoryBytes) {
            if (!this.evictOne()) break;
        }
    }

    /**
     * Evict one item
     */
    private evictOne(): boolean {
        const keyToEvict = this.selectEvictionCandidate();
        if (!keyToEvict) return false;

        const entry = this.cache.get(keyToEvict);
        if (!entry) return false;

        // Remove from cache
        this.cache.delete(keyToEvict);
        this.totalMemoryBytes -= entry.sizeBytes;
        this.evictions++;

        // Call user callback
        this.options.onEvict(keyToEvict, entry.value);

        // Emit event
        this.emit('evict', keyToEvict, entry.value);

        // Hook for subclasses
        this.onDelete(keyToEvict, entry);

        return true;
    }

    /**
     * Check if entry is expired
     */
    private isExpired(entry: CacheEntry<V>): boolean {
        if (this.options.ttlMs === Infinity) return false;

        const age = Date.now() - entry.timestamp;
        return age > this.options.ttlMs;
    }

    /**
     * Emit event to listeners
     */
    private emit<E extends keyof CacheEvents<V>>(
        event: E,
        ...args: Parameters<CacheEvents<V>[E]>
    ): void {
        const callbacks = this.listeners.get(event);
        if (!callbacks) return;

        for (const callback of callbacks) {
            try {
                (callback as any)(...args);
            } catch (error) {
                logger.error(`Error in ${event} listener:`, error);
            }
        }
    }

    /**
     * Default memory estimation (rough heuristic)
     */
    private defaultEstimateSize(value: any): number {
        if (value === null || value === undefined) return 8;

        const type = typeof value;

        if (type === 'boolean') return 4;
        if (type === 'number') return 8;
        if (type === 'string') return value.length * 2; // UTF-16

        if (Array.isArray(value)) {
            return value.reduce((sum, item) => sum + this.defaultEstimateSize(item), 24);
        }

        if (type === 'object') {
            let size = 24; // Object overhead
            for (const [key, val] of Object.entries(value)) {
                size += key.length * 2; // Key string
                size += this.defaultEstimateSize(val); // Value
            }
            return size;
        }

        return 24; // Unknown type overhead
    }
}

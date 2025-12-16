/**
 * Virtual Note Cache
 *
 * Purpose: Cache frequently accessed virtual notes to improve performance
 * Location: src/services/virtual/virtual-note-cache.ts
 *
 * **Features:**
 * - LRU cache with configurable size
 * - TTL-based cache invalidation
 * - Cache statistics for monitoring
 * - Thread-safe operations
 *
 * **Performance:**
 * - Cache hit: <1ms
 * - Cache miss: Depends on database query (typically 5-50ms)
 * - Memory: ~1KB per cached note
 *
 * **Usage:**
 * ```typescript
 * const cache = VirtualNoteCache.getInstance();
 * await cache.initialize({ maxSize: 1000, ttlMs: 300000 });
 *
 * // Get or generate note
 * const note = await cache.getOrGenerate(
 *   "creature/dragon-1",
 *   async () => generateCreatureNote(dbService, "dragon", 1)
 * );
 *
 * // Invalidate cache when entity is updated
 * cache.invalidate("creature/dragon-1");
 * ```
 */

import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('virtual-note-cache');

/**
 * Virtual note content
 */
export interface VirtualNote {
	/** Full markdown content with frontmatter */
	content: string;
	/** Last generation timestamp */
	generatedAt: number;
	/** Whether content is up-to-date */
	isValid: boolean;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
	/** Maximum number of cached items */
	maxSize?: number;
	/** Time-to-live in milliseconds */
	ttlMs?: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
	hits: number;
	misses: number;
	evictions: number;
	size: number;
	hitRate: number;
}

/**
 * Cache entry with metadata
 */
interface CacheEntry {
	note: VirtualNote;
	accessedAt: number;
	createdAt: number;
}

/**
 * Singleton LRU cache for virtual notes
 */
export class VirtualNoteCache {
	private static instance?: VirtualNoteCache;
	private cache = new Map<string, CacheEntry>();
	private maxSize = 1000;
	private ttlMs = 300000; // 5 minutes
	private stats = {
		hits: 0,
		misses: 0,
		evictions: 0,
	};

	private constructor() {
		// Private constructor for singleton
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(): VirtualNoteCache {
		if (!VirtualNoteCache.instance) {
			VirtualNoteCache.instance = new VirtualNoteCache();
		}
		return VirtualNoteCache.instance;
	}

	/**
	 * Initialize cache with configuration
	 *
	 * @param config - Cache configuration
	 */
	async initialize(config: CacheConfig): Promise<void> {
		this.maxSize = config.maxSize ?? 1000;
		this.ttlMs = config.ttlMs ?? 300000;
		logger.debug(`Initialized: maxSize=${this.maxSize}, ttl=${this.ttlMs}ms`);
	}

	/**
	 * Get or generate virtual note
	 *
	 * Checks cache first, then calls generator if not found or expired
	 *
	 * @param key - Unique cache key (e.g., "creature/dragon-1")
	 * @param generator - Function to generate note if not cached
	 * @returns Virtual note content
	 */
	async getOrGenerate(
		key: string,
		generator: () => Promise<string>
	): Promise<string> {
		// Check cache
		const entry = this.cache.get(key);
		if (entry && this.isEntryValid(entry)) {
			entry.accessedAt = Date.now();
			this.stats.hits++;
			return entry.note.content;
		}

		// Cache miss or expired - generate
		this.stats.misses++;
		const content = await generator();

		// Store in cache
		const note: VirtualNote = {
			content,
			generatedAt: Date.now(),
			isValid: true,
		};

		this.setEntry(key, {
			note,
			accessedAt: Date.now(),
			createdAt: Date.now(),
		});

		return content;
	}

	/**
	 * Set entry in cache with LRU eviction
	 *
	 * @param key - Cache key
	 * @param entry - Cache entry
	 */
	private setEntry(key: string, entry: CacheEntry): void {
		// Remove old entry if exists
		this.cache.delete(key);

		// Check if we need to evict
		if (this.cache.size >= this.maxSize) {
			this.evictLRU();
		}

		this.cache.set(key, entry);
	}

	/**
	 * Evict least recently used entry
	 */
	private evictLRU(): void {
		let oldestKey: string | null = null;
		let oldestTime = Date.now();

		for (const [key, entry] of this.cache) {
			if (entry.accessedAt < oldestTime) {
				oldestTime = entry.accessedAt;
				oldestKey = key;
			}
		}

		if (oldestKey) {
			this.cache.delete(oldestKey);
			this.stats.evictions++;
		}
	}

	/**
	 * Check if cache entry is still valid
	 *
	 * @param entry - Cache entry
	 * @returns true if valid and not expired
	 */
	private isEntryValid(entry: CacheEntry): boolean {
		const age = Date.now() - entry.createdAt;
		return entry.note.isValid && age < this.ttlMs;
	}

	/**
	 * Invalidate specific cache entry
	 *
	 * Called when entity is updated in database
	 *
	 * @param key - Cache key to invalidate
	 */
	invalidate(key: string): void {
		const entry = this.cache.get(key);
		if (entry) {
			entry.note.isValid = false;
		}
	}

	/**
	 * Invalidate all cache entries matching pattern
	 *
	 * @param pattern - Glob-like pattern (e.g., "creature/*")
	 */
	invalidatePattern(pattern: string): void {
		const regex = this.patternToRegex(pattern);
		const keys = Array.from(this.cache.keys());
		for (const key of keys) {
			if (regex.test(key)) {
				this.invalidate(key);
			}
		}
	}

	/**
	 * Clear all cache entries
	 */
	clear(): void {
		this.cache.clear();
		this.stats = { hits: 0, misses: 0, evictions: 0 };
	}

	/**
	 * Get cache statistics
	 *
	 * @returns Cache stats including hit rate
	 */
	getStats(): CacheStats {
		const total = this.stats.hits + this.stats.misses;
		return {
			...this.stats,
			size: this.cache.size,
			hitRate: total > 0 ? this.stats.hits / total : 0,
		};
	}

	/**
	 * Convert glob pattern to regex
	 *
	 * @param pattern - Glob pattern (e.g., "creature/*")
	 * @returns Compiled regex
	 */
	private patternToRegex(pattern: string): RegExp {
		const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
		const regex = escaped
			.replace(/\\\*/g, ".*")
			.replace(/\\\?/g, ".");
		return new RegExp(`^${regex}$`);
	}
}

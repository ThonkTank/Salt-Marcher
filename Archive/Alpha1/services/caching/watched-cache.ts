// src/services/caching/watched-cache.ts
// File-watched cache with auto-invalidation on vault changes

import type { App, EventRef } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('watched-cache');
import { LRUCache } from "./lru-cache";
import type { CacheOptions } from "./cache-manager";

/**
 * File watch registration for a cache key
 */
interface FileWatch {
    path: string;
    key: string;
    eventRefs: EventRef[];
}

/**
 * Watched cache that auto-invalidates on file changes
 *
 * **Features:**
 * - Extends LRUCache with file watching
 * - Auto-invalidates on file modify/delete/rename
 * - Supports multiple keys per file
 * - Proper cleanup on dispose
 *
 * **Usage:**
 * ```typescript
 * const cache = new WatchedCache<CreatureData>(app, { maxSize: 1000 });
 *
 * // Set value and watch file
 * cache.set("goblin", goblinData);
 * cache.watchFile("Creatures/goblin.md", "goblin");
 *
 * // Auto-invalidates when file changes
 * // ... user modifies goblin.md ...
 * cache.get("goblin"); // Returns undefined (invalidated)
 * ```
 */
export class WatchedCache<V> extends LRUCache<V> {
    private watches = new Map<string, FileWatch>(); // key -> watch
    private pathToKeys = new Map<string, Set<string>>(); // path -> keys

    constructor(
        private readonly app: App,
        options: CacheOptions = {}
    ) {
        super(options);
    }

    /**
     * Watch a file for changes and invalidate key on modification
     *
     * @param path - File path to watch
     * @param key - Cache key to invalidate
     */
    watchFile(path: string, key: string): void {
        // Check if already watching this key
        if (this.watches.has(key)) {
            logger.warn("Key already watched, removing old watch", { key });
            this.unwatchFile(key);
        }

        const eventRefs: EventRef[] = [];

        // Watch for file modification
        const modifyRef = this.app.vault.on('modify', (file) => {
            if (file.path === path) {
                logger.debug("File modified, invalidating key", {
                    path,
                    key,
                });
                this.delete(key);
                this.emit('invalidated', key);
            }
        });
        eventRefs.push(modifyRef);

        // Watch for file deletion
        const deleteRef = this.app.vault.on('delete', (file) => {
            if (file.path === path) {
                logger.debug("File deleted, invalidating key", {
                    path,
                    key,
                });
                this.delete(key);
                this.unwatchFile(key);
                this.emit('invalidated', key);
            }
        });
        eventRefs.push(deleteRef);

        // Watch for file rename
        const renameRef = this.app.vault.on('rename', (file, oldPath) => {
            if (oldPath === path) {
                logger.debug("File renamed, invalidating key", {
                    oldPath,
                    newPath: file.path,
                    key,
                });
                this.delete(key);
                this.unwatchFile(key);
                this.emit('invalidated', key);
            }
        });
        eventRefs.push(renameRef);

        // Store watch
        this.watches.set(key, { path, key, eventRefs });

        // Update path index
        if (!this.pathToKeys.has(path)) {
            this.pathToKeys.set(path, new Set());
        }
        this.pathToKeys.get(path)!.add(key);

        logger.debug("Watching file", { path, key });
    }

    /**
     * Stop watching file for a key
     *
     * @param key - Cache key to stop watching
     */
    unwatchFile(key: string): void {
        const watch = this.watches.get(key);
        if (!watch) return;

        // Remove event listeners
        for (const ref of watch.eventRefs) {
            this.app.vault.offref(ref);
        }

        // Remove from path index
        const keys = this.pathToKeys.get(watch.path);
        if (keys) {
            keys.delete(key);
            if (keys.size === 0) {
                this.pathToKeys.delete(watch.path);
            }
        }

        // Remove watch
        this.watches.delete(key);

        logger.debug("Stopped watching file", {
            path: watch.path,
            key,
        });
    }

    /**
     * Get all keys watching a specific file
     *
     * @param path - File path
     * @returns Set of keys watching this file
     */
    getKeysWatchingFile(path: string): Set<string> {
        return this.pathToKeys.get(path) ?? new Set();
    }

    /**
     * Get file path for a watched key
     *
     * @param key - Cache key
     * @returns File path or null if not watched
     */
    getWatchedPath(key: string): string | null {
        return this.watches.get(key)?.path ?? null;
    }

    /**
     * Check if a key is being watched
     *
     * @param key - Cache key
     * @returns True if key is watched
     */
    isWatched(key: string): boolean {
        return this.watches.has(key);
    }

    /**
     * Override delete to also remove watch
     */
    override delete(key: string): boolean {
        const deleted = super.delete(key);
        if (deleted && this.watches.has(key)) {
            this.unwatchFile(key);
        }
        return deleted;
    }

    /**
     * Override clear to remove all watches
     */
    override clear(): void {
        // Unwatch all files
        for (const key of this.watches.keys()) {
            this.unwatchFile(key);
        }

        super.clear();
    }

    /**
     * Override dispose to cleanup watches
     */
    override dispose(): void {
        // Remove all watches
        for (const key of this.watches.keys()) {
            this.unwatchFile(key);
        }

        super.dispose();
    }

    /**
     * Emit invalidation event
     */
    private emit(event: 'invalidated', key: string): void {
        // Reuse base class event system
        (this as any).emit(event, key);
    }
}

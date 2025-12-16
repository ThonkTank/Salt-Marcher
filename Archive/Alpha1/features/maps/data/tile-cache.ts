// src/features/maps/data/tile-cache.ts
// Unified Tile Cache - combines reactive state with debounced persistence

import type { App, TFile } from "obsidian";
import { writable } from "@services/state";
import { configurableLogger } from "@services/logging/configurable-logger";
import { coordToKey, type CoordKey, type AxialCoord } from "@geometry";

const logger = configurableLogger.forModule("tile-cache");
import {
    loadTileJSONFromDisk,
    saveTileJSONToDisk,
    createEmptyTileJSON,
    getTileFromJSON,
    setTileInJSON,
    validateTileDataLightweight,
    type TileJSONFormat
} from "./tile-json-io";
import type { TileData } from "@domain";
import type { Unsubscriber } from "@services/state";
import { getTileEventBus, type TileChange } from "../events/tile-events";

/**
 * Unified Tile Cache
 *
 * Combines reactive state management (TileStore) with debounced persistence (tile-json-cache).
 * Provides single source of truth for tile data with automatic save scheduling.
 *
 * Features:
 * - Single in-memory cache (Map<CoordKey, TileRecord>)
 * - Reactive updates via Svelte store pattern
 * - Debounced saves (300ms idle timer)
 * - Dirty tracking for efficient persistence
 * - Batch operations for multi-tile updates
 * - Version tracking for state synchronization
 *
 * Architecture:
 * - Replaces dual-cache approach (TileStore + tile-json-cache)
 * - Eliminates redundant storage and synchronization overhead
 * - Direct integration with .tiles.json format
 */

// ============================================================================
// Types
// ============================================================================

export interface TileCacheState {
    loaded: boolean;                      // True after initial load from disk
    tiles: Map<CoordKey, TileRecord>;     // Single cache of all tiles
    version: number;                      // Increments on every mutation
    dirtyCount: number;                   // Number of unsaved changes
}

export interface TileRecord {
    coord: AxialCoord;
    data: TileData;
}

export interface TileCache {
    // Reactive state
    subscribe(callback: (state: TileCacheState) => void): Unsubscriber;
    getState(): TileCacheState;

    // Accessors
    get(key: CoordKey): TileData | undefined;
    getAll(): Map<CoordKey, TileData>;
    has(key: CoordKey): boolean;

    // Mutations (trigger reactive updates + debounced save)
    set(key: CoordKey, data: TileData): void;
    setBatch(entries: Array<{ key: CoordKey; data: TileData }>): void;
    delete(key: CoordKey): void;
    deleteBatch(keys: CoordKey[]): void;
    clear(): void;

    // Persistence
    flush(): Promise<void>;
    isDirty(): boolean;

    // Lifecycle
    load(): Promise<void>;
    /**
     * Pre-hydrate cache with tiles from memory.
     * Skips disk I/O - use when tiles are already loaded.
     * Sets loaded=true without calling load().
     *
     * @param tiles - Array of tiles with coordinates and data
     */
    hydrate(tiles: Array<{ coord: AxialCoord; data: TileData }>): void;
    /**
     * Check if cache is loaded (from disk or hydrated)
     */
    isLoaded(): boolean;

    /**
     * Begin batch mode - suppresses store notifications until commitBatch().
     * Use for bulk operations like map initialization.
     */
    beginBatch(): void;

    /**
     * End batch mode and trigger single store notification.
     * Schedules debounced save after committing.
     */
    commitBatch(): void;

    /**
     * Check if currently in batch mode.
     */
    isInBatch(): boolean;

    destroy(): void;
}

// ============================================================================
// Constants
// ============================================================================

const SAVE_DEBOUNCE_MS = 300; // Wait 300ms after last edit before saving

// ============================================================================
// Implementation
// ============================================================================

export function createTileCache(app: App, mapFile: TFile, options?: { debug?: boolean }): TileCache {
    const debug = options?.debug ?? false;
    const mapPath = mapFile.path;

    // Reactive store
    const store = writable<TileCacheState>({
        loaded: false,
        tiles: new Map<CoordKey, TileRecord>(),
        version: 0,
        dirtyCount: 0,
    });

    // Dirty tracking
    const dirtyTiles = new Set<CoordKey>();

    // Debounce timer
    let saveTimer: NodeJS.Timeout | null = null;

    // Cached JSON (for efficient disk writes)
    let cachedJSON: TileJSONFormat | null = null;

    // Load promise (prevents concurrent loads)
    let loadPromise: Promise<void> | null = null;

    // Batch mode state - suppresses notifications during bulk operations
    let batchMode = false;
    let batchPendingNotify = false;
    // Pending tile changes for batch event emission
    let pendingChanges: TileChange[] = [];

    // ========================================================================
    // Lifecycle
    // ========================================================================

    /**
     * Load tiles from disk into cache.
     * Idempotent - can be called multiple times safely.
     *
     * IMPORTANT: If there are dirty (unsaved) tiles in the cache, this function
     * preserves them by merging with disk data rather than overwriting.
     */
    async function load(): Promise<void> {
        // Return existing load if in progress
        if (loadPromise) {
            return loadPromise;
        }

        loadPromise = (async () => {
            try {

                // Load JSON from disk (or create empty)
                let json = await loadTileJSONFromDisk(app, mapFile);
                if (!json) {
                    json = createEmptyTileJSON(mapPath);
                }

                // CRITICAL: If we have unsaved changes, preserve them!
                // This handles the race condition where load() is called after
                // setBatch() but before flush() completes.
                if (cachedJSON && dirtyTiles.size > 0) {
                    logger.warn(`Preserving ${dirtyTiles.size} dirty tiles during reload`);
                    // Merge: keep dirty tiles from cachedJSON, add any new from disk
                    for (const key of dirtyTiles) {
                        if (cachedJSON.tiles[key] !== undefined) {
                            json.tiles[key] = cachedJSON.tiles[key];
                        }
                    }
                }

                cachedJSON = json;

                // Build tile map
                const tileMap = new Map<CoordKey, TileRecord>();
                for (const [key, data] of Object.entries(json.tiles)) {
                    // CoordKey format is "q,r" (Axial coordinates)
                    const [q, r] = key.split(',').map(Number);
                    const coord: AxialCoord = { q, r };

                    tileMap.set(key as CoordKey, { coord, data });
                }

                // Update store
                store.set({
                    loaded: true,
                    tiles: tileMap,
                    version: Date.now(),
                    dirtyCount: 0,
                });

                logger.debug(`Loaded ${tileMap.size} tiles from ${mapPath}`);
            } catch (error) {
                logger.error(`Failed to load ${mapPath}:`, error);
                throw error;
            } finally {
                loadPromise = null;
            }
        })();

        return loadPromise;
    }

    /**
     * Ensure cache is loaded before accessing.
     */
    async function ensureLoaded(): Promise<void> {
        const state = store.get();
        if (state.loaded && !loadPromise) {
            return; // Already loaded
        }
        await load();
    }

    /**
     * Pre-hydrate cache with tiles from memory.
     * Skips disk I/O - use when tiles are already loaded.
     * Sets loaded=true without calling load().
     *
     * @param tiles - Array of tiles with coordinates and data
     */
    function hydrate(tiles: Array<{ coord: AxialCoord; data: TileData }>): void {
        // Skip if already loaded
        const state = store.get();
        if (state.loaded) {
            return;
        }

        // Build tile map from provided tiles
        const tileMap = new Map<CoordKey, TileRecord>();

        // Also create cached JSON for persistence
        if (!cachedJSON) {
            cachedJSON = createEmptyTileJSON(mapPath);
        }

        for (const { coord, data } of tiles) {
            const key = coordToKey(coord);
            tileMap.set(key, { coord, data });
            setTileInJSON(cachedJSON, coord, data);
        }

        // Update store to loaded state (single atomic update)
        store.set({
            loaded: true,
            tiles: tileMap,
            version: Date.now(),
            dirtyCount: 0,
        });
    }

    /**
     * Check if cache is loaded (from disk or hydrated)
     */
    function isLoaded(): boolean {
        return store.get().loaded;
    }

    /**
     * Begin batch mode - suppresses store notifications.
     * Notifications are collected and emitted once on commitBatch().
     */
    function beginBatch(): void {
        batchMode = true;
        batchPendingNotify = false;
        pendingChanges = [];
    }

    /**
     * End batch mode and emit collected notifications.
     */
    function commitBatch(): void {
        if (!batchMode) {
            return;
        }

        batchMode = false;

        if (batchPendingNotify) {
            batchPendingNotify = false;
            // Trigger single store update to notify all subscribers
            store.update((state) => ({
                ...state,
                version: Date.now(),
            }));
        }

        // Emit collected tile change events
        if (pendingChanges.length > 0) {
            getTileEventBus().emit({
                mapPath,
                changes: pendingChanges,
                timestamp: Date.now(),
            });
            pendingChanges = [];
        }

        // Schedule save for all accumulated changes
        scheduleSave();
    }

    function isInBatch(): boolean {
        return batchMode;
    }

    /**
     * Destroy cache - flush pending changes and cleanup.
     */
    function destroy(): void {

        // Cancel pending save
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }

        // Flush synchronously if dirty (best effort)
        if (dirtyTiles.size > 0) {
            flush().catch((err) => {
                logger.error(`Failed to flush on destroy:`, err);
            });
        }

        // Clear state
        dirtyTiles.clear();
        cachedJSON = null;
    }

    // ========================================================================
    // Accessors
    // ========================================================================

    function getState(): TileCacheState {
        return store.get();
    }

    function get(key: CoordKey): TileData | undefined {
        const state = store.get();
        return state.tiles.get(key)?.data;
    }

    function getAll(): Map<CoordKey, TileData> {
        const state = store.get();
        const result = new Map<CoordKey, TileData>();
        for (const [key, record] of state.tiles) {
            result.set(key, record.data);
        }
        return result;
    }

    function has(key: CoordKey): boolean {
        const state = store.get();
        return state.tiles.has(key);
    }

    // ========================================================================
    // Mutations
    // ========================================================================

    /**
     * Set single tile (marks dirty, triggers reactive update, schedules save).
     */
    function set(key: CoordKey, data: TileData): void {
        // Validate data
        validateTileDataLightweight(data);

        // Parse coordinate from key (format: "q,r")
        const [q, r] = key.split(',').map(Number);
        const coord: AxialCoord = { q, r };

        // Get previous data for event
        const state = store.get();
        const previousData = state.tiles.get(key)?.data ?? null;

        // Update store
        store.update((state) => {
            const nextTiles = new Map(state.tiles);
            nextTiles.set(key, { coord, data });

            return {
                loaded: state.loaded,
                tiles: nextTiles,
                version: Date.now(),
                dirtyCount: state.dirtyCount + (dirtyTiles.has(key) ? 0 : 1),
            };
        });

        // Mark dirty
        dirtyTiles.add(key);

        // Update cached JSON - ensure it exists first
        // This handles the case where set() is called before load() completes
        // (e.g., for new maps without existing .tiles.json)
        if (!cachedJSON) {
            cachedJSON = createEmptyTileJSON(mapPath);
        }
        setTileInJSON(cachedJSON, coord, data);

        // Emit tile change event (for overlay stores)
        if (!batchMode) {
            getTileEventBus().emit({
                mapPath,
                changes: [{ coord, key, data, previousData }],
                timestamp: Date.now(),
            });
        } else {
            // Collect changes for batch emission
            pendingChanges.push({ coord, key, data, previousData });
        }

        // Schedule save
        scheduleSave();
    }

    /**
     * Set multiple tiles in batch (single reactive update, single save timer).
     */
    function setBatch(entries: Array<{ key: CoordKey; data: TileData }>): void {
        if (debug) {
            logger.debug(`[TileCache.setBatch] START - ${entries.length} entries`);
        }

        if (entries.length === 0) return;

        // CRITICAL FIX: Ensure cachedJSON exists before adding tiles
        // This handles the case where setBatch is called before load() completes
        // (e.g., during initTilesForNewMap for new maps without existing .tiles.json)
        if (!cachedJSON) {
            cachedJSON = createEmptyTileJSON(mapPath);
        }

        // Log sample keys for debugging
        if (debug) {
            const sampleKeys = entries.slice(0, 5).map(e => e.key);
            logger.debug(`[TileCache.setBatch] Sample keys: ${sampleKeys.join(', ')}`);

            // Log keys for q=-15 (critical edge case)
            const negQKeys = entries.filter(e => e.key.startsWith('-15,')).slice(0, 5);
            if (negQKeys.length > 0) {
                logger.debug(`[TileCache.setBatch] Keys for q=-15: ${negQKeys.map(e => e.key).join(', ')}...`);
            }
        }

        // Validate all tiles first
        for (const { data } of entries) {
            validateTileDataLightweight(data);
        }

        // Collect changes for event emission
        const currentState = store.get();
        const changes: TileChange[] = [];

        // Update store (single update) - or defer if in batch mode
        if (batchMode) {
            // Silent update: modify internal state without notifying subscribers
            const state = store.get();
            const nextTiles = new Map(state.tiles);
            let newDirtyCount = 0;

            for (const { key, data } of entries) {
                const [q, r] = key.split(',').map(Number);
                const coord: AxialCoord = { q, r };
                const previousData = nextTiles.get(key)?.data ?? null;

                nextTiles.set(key, { coord, data });
                changes.push({ coord, key, data, previousData });

                if (!dirtyTiles.has(key)) {
                    newDirtyCount++;
                    dirtyTiles.add(key);
                }

                setTileInJSON(cachedJSON, coord, data);
            }

            // Directly set store state (bypasses subscribers in batch mode)
            store.set({
                loaded: state.loaded,
                tiles: nextTiles,
                version: state.version, // Keep same version during batch
                dirtyCount: state.dirtyCount + newDirtyCount,
            });

            // Collect changes for batch emission
            pendingChanges.push(...changes);
            batchPendingNotify = true;
        } else {
            store.update((state) => {
                const nextTiles = new Map(state.tiles);
                let newDirtyCount = 0;

                for (const { key, data } of entries) {
                    const [q, r] = key.split(',').map(Number);
                    const coord: AxialCoord = { q, r };
                    const previousData = nextTiles.get(key)?.data ?? null;

                    nextTiles.set(key, { coord, data });
                    changes.push({ coord, key, data, previousData });

                    // Track new dirty tiles
                    if (!dirtyTiles.has(key)) {
                        newDirtyCount++;
                        dirtyTiles.add(key);
                    }

                    // Update cached JSON (guaranteed to exist now)
                    setTileInJSON(cachedJSON, coord, data);
                }

                if (debug) {
                    logger.debug(`[TileCache.setBatch] Store updated - tiles.size: ${nextTiles.size}, newDirty: ${newDirtyCount}`);
                }

                return {
                    loaded: state.loaded,
                    tiles: nextTiles,
                    version: Date.now(),
                    dirtyCount: state.dirtyCount + newDirtyCount,
                };
            });

            // Emit tile change event immediately
            if (changes.length > 0) {
                getTileEventBus().emit({
                    mapPath,
                    changes,
                    timestamp: Date.now(),
                });
            }
        }

        // Schedule save (single timer for all tiles)
        scheduleSave();
        if (debug) {
            logger.debug(`[TileCache.setBatch] DONE - save scheduled`);
        }
    }

    /**
     * Delete single tile.
     */
    function deleteTile(key: CoordKey): void {
        // Get previous data for event
        const state = store.get();
        const record = state.tiles.get(key);
        const previousData = record?.data ?? null;
        const [q, r] = key.split(',').map(Number);
        const coord: AxialCoord = { q, r };

        store.update((state) => {
            const nextTiles = new Map(state.tiles);
            nextTiles.delete(key);

            return {
                loaded: state.loaded,
                tiles: nextTiles,
                version: Date.now(),
                dirtyCount: state.dirtyCount + (dirtyTiles.has(key) ? 0 : 1),
            };
        });

        // Mark dirty
        dirtyTiles.add(key);

        // Update cached JSON
        if (cachedJSON) {
            delete cachedJSON.tiles[key];
        }

        // Emit tile change event
        if (!batchMode) {
            getTileEventBus().emit({
                mapPath,
                changes: [{ coord, key, data: null, previousData }],
                timestamp: Date.now(),
            });
        } else {
            pendingChanges.push({ coord, key, data: null, previousData });
        }

        // Schedule save
        scheduleSave();
    }

    /**
     * Delete multiple tiles in batch.
     */
    function deleteBatch(keys: CoordKey[]): void {
        if (keys.length === 0) return;

        const changes: TileChange[] = [];
        const currentState = store.get();

        store.update((state) => {
            const nextTiles = new Map(state.tiles);
            let newDirtyCount = 0;

            for (const key of keys) {
                const record = nextTiles.get(key);
                const previousData = record?.data ?? null;
                const [q, r] = key.split(',').map(Number);
                const coord: AxialCoord = { q, r };

                changes.push({ coord, key, data: null, previousData });
                nextTiles.delete(key);

                // Track new dirty tiles
                if (!dirtyTiles.has(key)) {
                    newDirtyCount++;
                    dirtyTiles.add(key);
                }

                // Update cached JSON
                if (cachedJSON) {
                    delete cachedJSON.tiles[key];
                }
            }

            return {
                loaded: state.loaded,
                tiles: nextTiles,
                version: Date.now(),
                dirtyCount: state.dirtyCount + newDirtyCount,
            };
        });

        // Emit tile change event
        if (!batchMode) {
            if (changes.length > 0) {
                getTileEventBus().emit({
                    mapPath,
                    changes,
                    timestamp: Date.now(),
                });
            }
        } else {
            pendingChanges.push(...changes);
        }

        // Schedule save (single timer for all deletes)
        scheduleSave();
    }

    /**
     * Clear all tiles.
     */
    function clear(): void {
        const currentState = store.get();
        const changes: TileChange[] = [];

        // Collect all tiles as deleted
        for (const [key, record] of currentState.tiles) {
            changes.push({
                coord: record.coord,
                key,
                data: null,
                previousData: record.data,
            });
        }

        store.update((state) => {
            const clearedCount = state.tiles.size;

            // Mark all as dirty
            for (const key of state.tiles.keys()) {
                dirtyTiles.add(key);
            }

            return {
                loaded: state.loaded,
                tiles: new Map(),
                version: Date.now(),
                dirtyCount: state.dirtyCount + clearedCount,
            };
        });

        // Update cached JSON
        if (cachedJSON) {
            cachedJSON.tiles = {};
        }

        // Emit tile change event
        if (!batchMode && changes.length > 0) {
            getTileEventBus().emit({
                mapPath,
                changes,
                timestamp: Date.now(),
            });
        } else if (batchMode) {
            pendingChanges.push(...changes);
        }

        // Schedule save
        scheduleSave();
    }

    // ========================================================================
    // Persistence
    // ========================================================================

    /**
     * Schedule a save after debounce period.
     * Cancels previous timer if called again within debounce period.
     */
    function scheduleSave(): void {
        // Cancel existing timer
        if (saveTimer) {
            clearTimeout(saveTimer);
        }

        // Schedule new save
        saveTimer = setTimeout(async () => {
            await flush();
        }, SAVE_DEBOUNCE_MS);
    }

    /**
     * Flush cache to disk immediately (cancels debounce timer).
     */
    async function flush(): Promise<void> {
        // Cancel pending timer
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }

        // Check if dirty
        if (dirtyTiles.size === 0) {
            return;
        }

        // Ensure cached JSON exists
        if (!cachedJSON) {
            logger.warn(`No cached JSON for ${mapPath} - skipping flush`);
            return;
        }

        try {
            const savedCount = dirtyTiles.size;

            // Save to disk
            await saveTileJSONToDisk(app, mapFile, cachedJSON);

            // Clear dirty flags
            dirtyTiles.clear();

            // Update store (reset dirty count)
            store.update((state) => ({
                ...state,
                dirtyCount: 0,
            }));

            logger.debug(`Flushed ${savedCount} tiles to ${mapPath}`);
        } catch (error) {
            logger.error(`Failed to flush ${mapPath}:`, error);
            throw error;
        }
    }

    function isDirty(): boolean {
        return dirtyTiles.size > 0;
    }

    // ========================================================================
    // Return Interface
    // ========================================================================

    return {
        // Reactive state
        subscribe: store.subscribe,
        getState,

        // Accessors
        get,
        getAll,
        has,

        // Mutations
        set,
        setBatch,
        delete: deleteTile,
        deleteBatch,
        clear,

        // Persistence
        flush,
        isDirty,

        // Lifecycle
        load,
        hydrate,
        isLoaded,
        beginBatch,
        commitBatch,
        isInBatch,
        destroy,
    };
}

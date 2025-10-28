// src/features/maps/state/tile-store.ts
// In-memory + persistent bridge for map tiles, backed by the new state layer.

import type { TFile } from "obsidian";
import { writable } from "../../../services/state";
import type { PersistentStore, StoreOptions } from "../../../services/state";
import { getStoreManager } from "../../../services/state/store-manager";
import type { TileCoord, TileData } from "../data/tile-repository";

interface TileRecord {
    coord: TileCoord;
    data: TileData;
    file: TFile | null;
}

export interface TileStoreState {
    loaded: boolean;
    tiles: Map<string, TileRecord>;
    version: number;
}

export interface TileStoreDeps {
    /**
     * Load the current set of tiles from disk.
     */
    listTilesFromDisk(): Promise<Array<{ coord: TileCoord; data: TileData; file: TFile }>>;

    /**
     * Persist a tile to disk.
     */
    saveTileToDisk(coord: TileCoord, data: TileData): Promise<{ file: TFile; data: TileData }>;

    /**
     * Remove a tile from disk.
     */
    deleteTileFromDisk(coord: TileCoord): Promise<void>;

    /**
     * Optional: load a single tile directly from disk if not cached.
     */
    loadTileFromDisk?(coord: TileCoord): Promise<TileData | null>;

    /**
     * Stable identifier for diagnostics.
     */
    storageKey: string;

    /**
     * Human-readable store name.
     */
    name: string;

    /**
     * Optional store options (e.g. debug logging).
     */
    storeOptions?: StoreOptions;
}

export interface TileStore {
    readonly state: PersistentStore<TileStoreState>;
    loadTile(coord: TileCoord): Promise<TileData | null>;
    saveTile(coord: TileCoord, data: TileData): Promise<TFile>;
    deleteTile(coord: TileCoord): Promise<void>;
    listTiles(): Promise<Array<{ coord: TileCoord; data: TileData; file: TFile }>>;
    refresh(): Promise<void>;
}

export function createEmptyTileStoreState(version: number = Date.now()): TileStoreState {
    return {
        loaded: false,
        tiles: new Map<string, TileRecord>(),
        version,
    };
}

export function createTileStore(deps: TileStoreDeps): TileStore {
    const storeName = deps.name;
    const base = writable<TileStoreState>(createEmptyTileStoreState(0), {
        name: storeName,
        debug: deps.storeOptions?.debug,
    });

    let loadPromise: Promise<void> | null = null;

    const persistent: PersistentStore<TileStoreState> = {
        subscribe: base.subscribe,
        get: base.get,
        set: base.set,
        update: base.update,
        load: async () => {
            const entries = await deps.listTilesFromDisk();
            const nextTiles = new Map<string, TileRecord>();
            for (const entry of entries) {
                nextTiles.set(keyFromCoord(entry.coord), {
                    coord: entry.coord,
                    data: entry.data,
                    file: entry.file,
                });
            }
            base.set({
                loaded: true,
                tiles: nextTiles,
                version: Date.now(),
            });
        },
        save: async () => {
            // Tiles persist immediately; nothing to flush.
        },
        isDirty: () => false,
        getStorageKey: () => deps.storageKey,
    };

    getStoreManager().register(storeName, persistent);

    const ensureLoaded = async () => {
        const snapshot = persistent.get();
        if (snapshot.loaded && loadPromise === null) {
            return;
        }
        if (!loadPromise) {
            loadPromise = persistent.load().finally(() => {
                loadPromise = null;
            });
        }
        await loadPromise;
    };

    const refresh = async () => {
        loadPromise = persistent.load().finally(() => {
            loadPromise = null;
        });
        await loadPromise;
    };

    const loadTile = async (coord: TileCoord): Promise<TileData | null> => {
        await ensureLoaded();
        const snapshot = persistent.get();
        const record = snapshot.tiles.get(keyFromCoord(coord));
        if (record) {
            return record.data;
        }

        if (deps.loadTileFromDisk) {
            const data = await deps.loadTileFromDisk(coord);
            if (data) {
                await refresh();
                const refreshed = persistent.get().tiles.get(keyFromCoord(coord));
                return refreshed ? refreshed.data : data;
            }
            return data;
        }

        return null;
    };

    const saveTile = async (coord: TileCoord, data: TileData): Promise<TFile> => {
        const result = await deps.saveTileToDisk(coord, data);
        await ensureLoaded();
        persistent.update(current => {
            const nextTiles = new Map(current.tiles);
            nextTiles.set(keyFromCoord(coord), {
                coord,
                data: result.data,
                file: result.file,
            });
            return {
                loaded: true,
                tiles: nextTiles,
                version: Date.now(),
            };
        });
        return result.file;
    };

    const deleteTile = async (coord: TileCoord): Promise<void> => {
        await deps.deleteTileFromDisk(coord);
        await ensureLoaded();
        persistent.update(current => {
            const nextTiles = new Map(current.tiles);
            nextTiles.delete(keyFromCoord(coord));
            return {
                loaded: true,
                tiles: nextTiles,
                version: Date.now(),
            };
        });
    };

    const listTiles = async (): Promise<Array<{ coord: TileCoord; data: TileData; file: TFile }>> => {
        await ensureLoaded();
        const snapshot = persistent.get();
        const rows: Array<{ coord: TileCoord; data: TileData; file: TFile }> = [];
        for (const record of snapshot.tiles.values()) {
            if (!record.file) {
                // If file reference missing, skip; ensure next refresh repopulates.
                continue;
            }
            rows.push({
                coord: record.coord,
                data: record.data,
                file: record.file,
            });
        }
        return rows;
    };

    return {
        state: persistent,
        loadTile,
        saveTile,
        deleteTile,
        listTiles,
        refresh,
    };
}

function keyFromCoord(coord: TileCoord): string {
    return `${coord.r}:${coord.c}`;
}

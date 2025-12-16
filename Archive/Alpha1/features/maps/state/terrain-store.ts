// src/features/maps/state/terrain-store.ts
// Persistent store wrapper around the terrain configuration file.

import type { App, EventRef, TAbstractFile} from "obsidian";
import { TFile, normalizePath } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("terrain-store");
import { writable } from "@services/state";
import { getStoreManager } from "@services/state/store-manager";
import { setBackgroundColorPalette } from "../config/terrain";
import type { PersistentStore, StoreOptions } from "@services/state";

export type TerrainMap = Record<string, { color: string; speed: number }>;

export const TERRAIN_FILE = "SaltMarcher/Terrains.md";
const BLOCK_RE = /```terrain\s*([\s\S]*?)```/i;

interface TerrainStoreState {
    loaded: boolean;
    map: TerrainMap;
    version: number;
}

interface TerrainStore {
    state: PersistentStore<TerrainStoreState>;
    getTerrains(): Promise<TerrainMap>;
    saveTerrains(next: TerrainMap): Promise<void>;
    refresh(): Promise<void>;
    watch(options?: TerrainWatcherOptions | (() => void | Promise<void>)): () => void;
}

export interface TerrainWatcherOptions {
    onChange?: () => void | Promise<void>;
    onError?: (error: unknown, meta: { reason: "modify" | "delete" }) => void;
    storeOptions?: StoreOptions;
}

const storeRegistry = new WeakMap<App, TerrainStore>();

export async function ensureTerrainFile(app: App): Promise<TFile> {
    const path = normalizePath(TERRAIN_FILE);
    const existing = app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
        return existing;
    }

    const dir = path.split("/").slice(0, -1).join("/");
    if (dir) {
        await app.vault.createFolder(dir).catch(() => {});
    }

    const body = [
        "---",
        "smList: true",
        "---",
        "# Terrains",
        "",
        "```terrain",
        ": transparent, speed: 1",
        "Wald: #2e7d32, speed: 0.6",
        "Meer: #0288d1, speed: 0.5",
        "Berg: #6d4c41, speed: 0.4",
        "```",
        "",
    ].join("\n");

    try {
        return await app.vault.create(path, body);
    } catch (err) {
        // Check if file was created concurrently
        const retry = app.vault.getAbstractFileByPath(path);
        if (retry instanceof TFile) {
            return retry;
        }
        throw err;
    }
}

export function parseTerrainBlock(md: string): TerrainMap {
    const match = md.match(BLOCK_RE);
    if (!match) return {};

    const map: TerrainMap = {};
    for (const raw of match[1].split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;

        const parsed = line.match(
            /^("?)(.*?)(\1)\s*:\s*([^,]+?)(?:\s*,\s*speed\s*:\s*([-+]?\d*\.?\d+))?\s*$/i
        );
        if (!parsed) continue;

        const name = parsed[2].trim();
        const color = parsed[4].trim();
        const speedValue = parsed[5] !== undefined ? parseFloat(parsed[5]) : 1;
        const speed = Number.isFinite(speedValue) ? speedValue : 1;

        map[name] = { color, speed };
    }

    if (!map[""]) {
        map[""] = { color: "transparent", speed: 1 };
    }

    return map;
}

export function stringifyTerrainBlock(map: TerrainMap): string {
    const entries = Object.entries(map);
    entries.sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
    const lines = entries.map(([key, value]) => `${key || ":"}: ${value.color}, speed: ${value.speed}`);
    return ["```terrain", ...lines, "```"].join("\n");
}

async function readTerrainsFromDisk(app: App): Promise<TerrainMap> {
    // Try loading from individual terrain preset files first (new system)
    const terrainMap = await loadTerrainsFromDirectory(app);

    // Fallback to old Terrains.md file if no presets found
    if (Object.keys(terrainMap).length === 0) {
        const file = await ensureTerrainFile(app);
        const content = await app.vault.read(file);
        return parseTerrainBlock(content);
    }

    return terrainMap;
}

/**
 * Load terrains from individual preset files in SaltMarcher/Terrains/ directory
 * Parses YAML frontmatter from each .md file and uses filename as terrain ID
 */
async function loadTerrainsFromDirectory(app: App): Promise<TerrainMap> {
    const terrainDir = normalizePath("SaltMarcher/Terrains");
    const terrainMap: TerrainMap = {};

    try {
        // Check if directory exists
        const folder = app.vault.getAbstractFileByPath(terrainDir);
        if (!folder) {
            return terrainMap;
        }

        // Get all .md files in the directory
        const files = app.vault.getMarkdownFiles().filter(file => {
            const filePath = normalizePath(file.path);
            return filePath.startsWith(terrainDir + "/") && filePath.endsWith(".md");
        });

        // Load each terrain file
        for (const file of files) {
            try {
                // Extract terrain ID from filename (e.g., "arctic" from "arctic.md")
                const fileName = file.basename;

                // Parse frontmatter
                const cache = app.metadataCache.getFileCache(file);
                const frontmatter = cache?.frontmatter;

                if (!frontmatter || frontmatter.smType !== "terrain") {
                    continue; // Skip non-terrain files
                }

                // Extract color and speed from frontmatter
                const color = typeof frontmatter.color === "string" ? frontmatter.color.trim() : "";
                const speed = typeof frontmatter.speed === "number" ? frontmatter.speed : 1;

                if (color) {
                    terrainMap[fileName] = { color, speed };
                }
            } catch (error) {
                logger.warn(`Failed to load terrain from ${file.path}:`, error);
            }
        }

        // Ensure empty terrain exists (required for transparent/unset tiles)
        if (!terrainMap[""]) {
            terrainMap[""] = { color: "transparent", speed: 1 };
        }

        logger.info(`Loaded ${Object.keys(terrainMap).length} terrains from directory`);
        return terrainMap;
    } catch (error) {
        logger.warn(`Failed to load terrains from directory:`, error);
        return terrainMap;
    }
}

async function writeTerrainsToDisk(app: App, map: TerrainMap): Promise<void> {
    const file = await ensureTerrainFile(app);
    const content = await app.vault.read(file);
    const block = stringifyTerrainBlock(map);
    const updated = content.match(BLOCK_RE) ? content.replace(BLOCK_RE, block) : `${content}\n\n${block}\n`;
    await app.vault.modify(file, updated);
}

function createInitialState(): TerrainStoreState {
    return {
        loaded: false,
        map: {},
        version: 0,
    };
}

function triggerTerrainEvent(app: App): void {
    (app.workspace as any).trigger?.("salt:terrains-updated");
}

function createTerrainStore(app: App, options?: StoreOptions): TerrainStore {
    const base = writable<TerrainStoreState>(createInitialState(), {
        name: "map-terrains",
        debug: options?.debug,
    });

    let dirty = false;
    let loadPromise: Promise<void> | null = null;

    const persistent: PersistentStore<TerrainStoreState> = {
        subscribe: base.subscribe,
        get: base.get,
        set: (value) => {
            base.set(value);
            dirty = true;
        },
        update: (updater) => {
            base.update((current) => {
                const next = updater(current);
                dirty = true;
                return next;
            });
        },
        load: async () => {
            const terrainMap = await readTerrainsFromDisk(app);
            base.set({
                loaded: true,
                map: terrainMap,
                version: Date.now(),
            });
            dirty = false;
            const colorMap = Object.fromEntries(
                Object.entries(terrainMap).map(([name, data]) => [name, data.color])
            );
            setBackgroundColorPalette(colorMap);
            triggerTerrainEvent(app);
        },
        save: async () => {
            const snapshot = base.get();
            if (!snapshot.loaded) return;
            await writeTerrainsToDisk(app, snapshot.map);
            dirty = false;
        },
        isDirty: () => dirty,
        getStorageKey: () => normalizePath(TERRAIN_FILE),
    };

    getStoreManager().register("map-terrains", persistent);

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

    const getTerrains = async (): Promise<TerrainMap> => {
        await ensureLoaded();
        return persistent.get().map;
    };

    const saveTerrains = async (next: TerrainMap): Promise<void> => {
        await ensureLoaded();
        persistent.update(() => ({
            loaded: true,
            map: { ...next },
            version: Date.now(),
        }));
        const colorMap = Object.fromEntries(
            Object.entries(next).map(([name, data]) => [name, data.color])
        );
        setBackgroundColorPalette(colorMap);
        await persistent.save();
        triggerTerrainEvent(app);
    };

    const watch = (
        options?: TerrainWatcherOptions | (() => void | Promise<void>)
    ): (() => void) => {
        const resolved = resolveWatcherOptions(options);

        const handleError = (error: unknown, reason: "modify" | "delete") => {
            if (resolved.onError) {
                try {
                    resolved.onError(error, { reason });
                } catch (handlerError) {
                    logger.error("[salt-marcher] Terrain watcher error handler threw", handlerError);
                }
                return;
            }
            logger.error(`[salt-marcher] Terrain watcher failed after ${reason} event`, error);
        };

        const update = async (reason: "modify" | "delete") => {
            try {
                if (reason === "delete") {
                    await ensureTerrainFile(app);
                }
                await refresh();
                triggerTerrainEvent(app);
                await resolved.onChange?.();
            } catch (error) {
                handleError(error, reason);
            }
        };

        const maybeUpdate = (reason: "modify" | "delete", file: TAbstractFile) => {
            if (!(file instanceof TFile)) return;
            if (normalizePath(file.path) !== normalizePath(TERRAIN_FILE)) return;
            void update(reason);
        };

        const refs: EventRef[] = (["modify", "delete"] as const).map((event) =>
            app.vault.on(event, (file) => maybeUpdate(event, file))
        );

        let disposed = false;
        return () => {
            if (disposed) return;
            disposed = true;
            for (const ref of refs) {
                app.vault.offref(ref);
            }
        };
    };

    return {
        state: persistent,
        getTerrains,
        saveTerrains,
        refresh,
        watch,
    };
}

export function getTerrainStore(app: App, options?: StoreOptions): TerrainStore {
    let store = storeRegistry.get(app);
    if (!store) {
        store = createTerrainStore(app, options);
        storeRegistry.set(app, store);
    }
    return store;
}

function resolveWatcherOptions(
    maybe: TerrainWatcherOptions | (() => void | Promise<void>) | undefined
): TerrainWatcherOptions {
    if (typeof maybe === "function") {
        return { onChange: maybe };
    }
    return maybe ?? {};
}

export async function loadTerrains(app: App): Promise<TerrainMap> {
    const store = getTerrainStore(app);
    return await store.getTerrains();
}

export async function saveTerrains(app: App, map: TerrainMap): Promise<void> {
    const store = getTerrainStore(app);
    await store.saveTerrains(map);
}

export function watchTerrains(
    app: App,
    options?: TerrainWatcherOptions | (() => void | Promise<void>)
): () => void {
    const store = getTerrainStore(app, typeof options === "object" ? options.storeOptions : undefined);
    return store.watch(options);
}

/**
 * Reset terrain store to initial state.
 *
 * ⚠️ LIFECYCLE WARNING:
 * This store is GLOBAL (shared across all maps).
 * DO NOT call this when deleting individual maps!
 * ONLY call from GlobalStoreManager.releaseGlobalStores() on plugin unload.
 *
 * Calling this prematurely will lose terrain data for other open maps.
 */
export function resetTerrainStore(app: App): void {
    const store = storeRegistry.get(app);
    if (!store) return;
    store.state.set(createInitialState());
    storeRegistry.delete(app);

    // CRITICAL: Also unregister from global StoreManager
    const { getStoreManager } = require("../../../services/state/store-manager");
    getStoreManager().unregister("map-terrains");
}

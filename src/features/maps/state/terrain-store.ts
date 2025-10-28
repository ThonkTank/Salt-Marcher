// src/features/maps/state/terrain-store.ts
// Persistent store wrapper around the terrain configuration file.

import { App, EventRef, TAbstractFile, TFile, normalizePath } from "obsidian";
import { writable } from "../../../services/state";
import type { PersistentStore, StoreOptions } from "../../../services/state";
import { getStoreManager } from "../../../services/state/store-manager";
import { logger } from "../../../app/plugin-logger";
import { setTerrains } from "../domain/terrain";

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

    return await app.vault.create(path, body);
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
    const file = await ensureTerrainFile(app);
    const content = await app.vault.read(file);
    return parseTerrainBlock(content);
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
            setTerrains(terrainMap);
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
        setTerrains(next);
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

export function resetTerrainStore(app: App): void {
    const store = storeRegistry.get(app);
    if (!store) return;
    store.state.set(createInitialState());
    storeRegistry.delete(app);
}

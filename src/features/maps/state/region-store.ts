// src/features/maps/state/region-store.ts
// Persistent store wrapper around the regions configuration file.

import { App, EventRef, TAbstractFile, TFile, normalizePath, Notice } from "obsidian";
import { writable } from "../../../services/state";
import type { PersistentStore, StoreOptions } from "../../../services/state";
import { getStoreManager } from "../../../services/state/store-manager";
import { logger } from "../../../app/plugin-logger";
import type { Region } from "../domain/region";

export const REGIONS_FILE = "SaltMarcher/Regions.md";
const BLOCK_RE = /```regions\s*([\s\S]*?)```/i;

interface RegionStoreState {
    loaded: boolean;
    list: Region[];
    version: number;
}

interface RegionStore {
    state: PersistentStore<RegionStoreState>;
    getRegions(): Promise<Region[]>;
    saveRegions(list: Region[]): Promise<void>;
    refresh(): Promise<void>;
    watch(onChange: () => void | Promise<void>): () => void;
}

const storeRegistry = new WeakMap<App, RegionStore>();

export async function ensureRegionsFile(app: App): Promise<TFile> {
    const path = normalizePath(REGIONS_FILE);
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
        "# Regions",
        "",
        "```regions",
        "# Name: Terrain",
        "# Beispiel:",
        "# Saltmarsh: Küste",
        "```",
        "",
    ].join("\n");

    return await app.vault.create(path, body);
}

export function parseRegionsBlock(md: string): Region[] {
    const match = md.match(BLOCK_RE);
    if (!match) return [];

    const list: Region[] = [];
    for (const raw of match[1].split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;

        const parsed = line.match(/^("?)(.*?)\1\s*:\s*(.*)$/);
        if (!parsed) continue;

        const name = (parsed[2] || "").trim();
        const rest = (parsed[3] || "").trim();

        let terrain = rest;
        let encounterOdds: number | undefined;

        const encounterMatch = rest.match(/,\s*encounter\s*:\s*([^,]+)\s*$/i);
        if (encounterMatch) {
            terrain = rest.slice(0, encounterMatch.index).trim();
            const spec = encounterMatch[1].trim();
            const fraction = spec.match(/^1\s*\/\s*(\d+)$/);
            if (fraction) {
                encounterOdds = parseInt(fraction[1], 10) || undefined;
            } else {
                const numeric = parseInt(spec, 10);
                if (Number.isFinite(numeric) && numeric > 0) {
                    encounterOdds = numeric;
                }
            }
        }

        list.push({ name, terrain, encounterOdds });
    }

    return list;
}

export function stringifyRegionsBlock(list: Region[]): string {
    const lines = list.map((region) => {
        const base = `${region.name}: ${region.terrain || ""}`;
        const odds = region.encounterOdds;
        return odds && odds > 0 ? `${base}, encounter: 1/${odds}` : base;
    });
    return ["```regions", ...lines, "```"].join("\n");
}

async function readRegionsFromDisk(app: App): Promise<Region[]> {
    const file = await ensureRegionsFile(app);
    const content = await app.vault.read(file);
    return parseRegionsBlock(content);
}

async function writeRegionsToDisk(app: App, list: Region[]): Promise<void> {
    const file = await ensureRegionsFile(app);
    const content = await app.vault.read(file);
    const block = stringifyRegionsBlock(list);
    const updated = content.match(BLOCK_RE) ? content.replace(BLOCK_RE, block) : `${content}\n\n${block}\n`;
    await app.vault.modify(file, updated);
}

function createInitialState(): RegionStoreState {
    return {
        loaded: false,
        list: [],
        version: 0,
    };
}

function triggerRegionEvent(app: App): void {
    (app.workspace as any).trigger?.("salt:regions-updated");
}

function createRegionStore(app: App, options?: StoreOptions): RegionStore {
    const base = writable<RegionStoreState>(createInitialState(), {
        name: "map-regions",
        debug: options?.debug,
    });

    let dirty = false;
    let loadPromise: Promise<void> | null = null;

    const persistent: PersistentStore<RegionStoreState> = {
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
            const regions = await readRegionsFromDisk(app);
            base.set({
                loaded: true,
                list: regions,
                version: Date.now(),
            });
            dirty = false;
            triggerRegionEvent(app);
        },
        save: async () => {
            const snapshot = base.get();
            if (!snapshot.loaded) return;
            await writeRegionsToDisk(app, snapshot.list);
            dirty = false;
        },
        isDirty: () => dirty,
        getStorageKey: () => normalizePath(REGIONS_FILE),
    };

    getStoreManager().register("map-regions", persistent);

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

    const getRegions = async (): Promise<Region[]> => {
        await ensureLoaded();
        return persistent.get().list;
    };

    const saveRegions = async (list: Region[]): Promise<void> => {
        await ensureLoaded();
        persistent.update(() => ({
            loaded: true,
            list: [...list],
            version: Date.now(),
        }));
        await persistent.save();
        triggerRegionEvent(app);
    };

    const watch = (onChange: () => void | Promise<void>): (() => void) => {
        const targetPath = normalizePath(REGIONS_FILE);

        const update = async (reason: "modify" | "delete") => {
            try {
                if (reason === "delete") {
                    logger.warn(
                        "Regions store detected deletion; attempting automatic recreation."
                    );
                    await ensureRegionsFile(app);
                    new Notice("Regions.md wurde neu erstellt.");
                }
                await refresh();
                await onChange?.();
                triggerRegionEvent(app);
            } catch (error) {
                logger.error(
                    `[salt-marcher] Regions watcher failed after ${reason} event`,
                    error
                );
            }
        };

        const maybeUpdate = (reason: "modify" | "delete", file: TAbstractFile) => {
            if (!(file instanceof TFile)) return;
            if (normalizePath(file.path) !== targetPath) return;
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
        getRegions,
        saveRegions,
        refresh,
        watch,
    };
}

export function getRegionStore(app: App, options?: StoreOptions): RegionStore {
    let store = storeRegistry.get(app);
    if (!store) {
        store = createRegionStore(app, options);
        storeRegistry.set(app, store);
    }
    return store;
}

export async function loadRegions(app: App): Promise<Region[]> {
    const store = getRegionStore(app);
    return await store.getRegions();
}

export async function saveRegions(app: App, list: Region[]): Promise<void> {
    const store = getRegionStore(app);
    await store.saveRegions(list);
}

export function watchRegions(app: App, onChange: () => void): () => void {
    const store = getRegionStore(app);
    return store.watch(onChange);
}

export function resetRegionStore(app: App): void {
    const store = storeRegistry.get(app);
    if (!store) return;
    store.state.set(createInitialState());
    storeRegistry.delete(app);
}

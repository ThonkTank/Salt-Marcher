// src/features/maps/data/map-store-registry.ts
// Helpers to cache/reset per-map stores when maps are removed.

import type { App, TFile } from "obsidian";
import { resetFactionOverlayStore } from "../state/faction-overlay-store";
import { resetRegionStore } from "../state/region-store";
import { resetTileStore } from "./tile-repository";


const MAP_STORE_REGISTRY = new WeakMap<App, Set<string>>();

function getRegistry(app: App): Set<string> {
    let set = MAP_STORE_REGISTRY.get(app);
    if (!set) {
        set = new Set<string>();
        MAP_STORE_REGISTRY.set(app, set);
    }
    return set;
}

export function registerMapStores(app: App, mapFile: TFile): void {
    getRegistry(app).add(mapFile.path);
}

export function unregisterMapStores(app: App, mapFile: TFile): void {
    const set = MAP_STORE_REGISTRY.get(app);
    if (set) {
        set.delete(mapFile.path);
    }

    resetTileStore(app, mapFile);
    resetRegionStore(app);
    resetFactionOverlayStore(app, mapFile);
}

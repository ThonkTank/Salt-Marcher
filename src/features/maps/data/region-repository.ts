// src/features/maps/data/region-repository.ts
import type { App } from "obsidian";
import type { Region } from "../domain/region";
import {
    REGIONS_FILE,
    ensureRegionsFile,
    parseRegionsBlock,
    stringifyRegionsBlock,
    loadRegions as loadRegionsFromStore,
    saveRegions as saveRegionsThroughStore,
    watchRegions as watchRegionsThroughStore,
} from "../state/region-store";

export type { Region };

export { REGIONS_FILE, ensureRegionsFile, parseRegionsBlock, stringifyRegionsBlock };

export async function loadRegions(app: App): Promise<Region[]> {
    return await loadRegionsFromStore(app);
}

export async function saveRegions(app: App, list: Region[]): Promise<void> {
    await saveRegionsThroughStore(app, list);
}

export function watchRegions(app: App, onChange: () => void): () => void {
    return watchRegionsThroughStore(app, onChange);
}

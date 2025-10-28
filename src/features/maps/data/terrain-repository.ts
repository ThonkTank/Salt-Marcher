// src/features/maps/data/terrain-repository.ts
import type { App } from "obsidian";
import {
    TERRAIN_FILE,
    ensureTerrainFile,
    parseTerrainBlock,
    stringifyTerrainBlock,
    loadTerrains as loadTerrainsFromStore,
    saveTerrains as saveTerrainsThroughStore,
    watchTerrains as watchTerrainsThroughStore,
    type TerrainMap,
    type TerrainWatcherOptions,
} from "../state/terrain-store";

export {
    TERRAIN_FILE,
    ensureTerrainFile,
    parseTerrainBlock,
    stringifyTerrainBlock,
    type TerrainMap,
    type TerrainWatcherOptions,
};

export async function loadTerrains(app: App): Promise<TerrainMap> {
    return await loadTerrainsFromStore(app);
}

export async function saveTerrains(app: App, next: TerrainMap): Promise<void> {
    await saveTerrainsThroughStore(app, next);
}

export function watchTerrains(
    app: App,
    options?: (() => void | Promise<void>) | TerrainWatcherOptions
): () => void {
    return watchTerrainsThroughStore(app, options);
}

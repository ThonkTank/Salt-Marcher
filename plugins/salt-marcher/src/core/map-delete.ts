// src/core/map-delete.ts
import type { App, TFile } from "obsidian";
import { listTilesForMap } from "./hex-mapper/hex-notes";

export async function deleteMapAndTiles(app: App, mapFile: TFile): Promise<void> {
    // 1) Tiles finden und löschen
    const tiles = await listTilesForMap(app, mapFile);
    for (const t of tiles) {
        try { await app.vault.delete(t.file); } catch (e) { console.warn("Delete tile failed:", t.file.path, e); }
    }

    // 2) Map löschen
    try { await app.vault.delete(mapFile); } catch (e) { console.warn("Delete map failed:", mapFile.path, e); }
}

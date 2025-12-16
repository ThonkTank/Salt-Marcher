// src/workmodes/session-runner/travel/engine/persistence.ts
// Persistiert Travel-Token in Hex-Notizen.
import type { App, TFile } from "obsidian";
import { listTilesForMap, loadTile, saveTile } from "@features/maps";
import type { Coord } from './calendar-types';

export const TOKEN_KEY = "token_travel";

/** Erstes Tile mit token_travel:true finden, sonst null */
export async function loadTokenCoordFromMap(app: App, mapFile: TFile): Promise<Coord | null> {
    const tiles = await listTilesForMap(app, mapFile);
    for (const rc of tiles) {
        const data = await loadTile(app, mapFile, rc).catch(() => null);
        if (data && data[TOKEN_KEY] === true) return rc;
    }
    return null;
}

/** Token-Flag genau auf rc setzen, andere Tiles auf false (Frontmatter mergen) */
export async function writeTokenToTiles(app: App, mapFile: TFile, rc: Coord): Promise<void> {
    const tiles = await listTilesForMap(app, mapFile);
    for (const t of tiles) {
        const data = await loadTile(app, mapFile, t).catch(() => null);
        if (data && data[TOKEN_KEY] === true && (t.q !== rc.q || t.r !== rc.r)) {
            await saveTile(app, mapFile, t, { ...data, [TOKEN_KEY]: false });
        }
    }
    // Do not create a new tile file on empty space; only update if the tile already exists.
    const exists = tiles.some((t) => t.q === rc.q && t.r === rc.r);
    if (!exists) return;
    const cur = await loadTile(app, mapFile, rc).catch(() => ({} as any));
    await saveTile(app, mapFile, rc, { ...cur, [TOKEN_KEY]: true });
}

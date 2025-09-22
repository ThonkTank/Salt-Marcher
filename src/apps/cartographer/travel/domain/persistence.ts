import type { App, TFile } from "obsidian";
import { listTilesForMap, loadTile, saveTile } from "../../../../core/hex-mapper/hex-notes";
import type { Coord } from "./types";

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
        if (data && data[TOKEN_KEY] === true && (t.r !== rc.r || t.c !== rc.c)) {
            await saveTile(app, mapFile, t, { ...data, [TOKEN_KEY]: false });
        }
    }
    const cur = await loadTile(app, mapFile, rc).catch(() => ({} as any));
    await saveTile(app, mapFile, rc, { ...cur, [TOKEN_KEY]: true });
}

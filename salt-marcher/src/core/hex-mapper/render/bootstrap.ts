// src/core/hex-mapper/render/bootstrap.ts
import { App, TFile } from "obsidian";
import { listTilesForMap, type TileCoord } from "../hex-notes";
import type { HexCoord } from "./types";

export type HexTileRecord = { coord: TileCoord; data: { terrain: string } };

export type HexTileBootstrap = {
    tiles: HexTileRecord[];
    base: HexCoord;
    initialCoords: HexCoord[];
};

type Bounds = { minR: number; maxR: number; minC: number; maxC: number };

const DEFAULT_FALLBACK_SPAN = 2;

function computeBounds(tiles: HexTileRecord[]): Bounds | null {
    if (!tiles.length) return null;
    let minR = Infinity;
    let maxR = -Infinity;
    let minC = Infinity;
    let maxC = -Infinity;
    for (const tile of tiles) {
        const { r, c } = tile.coord;
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
    }
    return { minR, maxR, minC, maxC };
}

function buildFallback(bounds: Bounds | null): HexCoord[] {
    const minR = bounds ? bounds.minR : 0;
    const maxR = bounds ? bounds.maxR : DEFAULT_FALLBACK_SPAN;
    const minC = bounds ? bounds.minC : 0;
    const maxC = bounds ? bounds.maxC : DEFAULT_FALLBACK_SPAN;
    const coords: HexCoord[] = [];
    for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
            coords.push({ r, c });
        }
    }
    return coords;
}

async function loadTiles(app: App, mapPath: string): Promise<HexTileRecord[]> {
    const file = app.vault.getAbstractFileByPath(mapPath);
    if (!(file instanceof TFile)) {
        return [];
    }
    try {
        return await listTilesForMap(app, file);
    } catch {
        return [];
    }
}

export async function bootstrapHexTiles(app: App, mapPath: string): Promise<HexTileBootstrap> {
    const tiles = await loadTiles(app, mapPath);
    const bounds = computeBounds(tiles);

    const base: HexCoord = {
        r: bounds ? bounds.minR : 0,
        c: bounds ? bounds.minC : 0,
    };

    const initialCoords = tiles.length ? tiles.map((tile) => tile.coord) : buildFallback(bounds);

    return {
        tiles,
        base,
        initialCoords,
    };
}

// Kapselt Terrain-Geschwindigkeit (einzige Quelle!)
// Nutzung: ausschließlich aus domain/playback.ts

import type { App, TFile } from "obsidian";
import { TERRAIN_SPEEDS } from "../../../../core/terrain";
import { loadTile } from "../../../../core/hex-mapper/hex-notes";
import type { Coord } from "./types";

export async function loadTerrainSpeed(app: App, mapFile: TFile, rc: Coord): Promise<number> {
    try {
        const data = await loadTile(app, mapFile, rc);
        const t = (data?.terrain ?? "") as string;
        const s = (TERRAIN_SPEEDS as Record<string, number | undefined>)[t];
        return Number.isFinite(s) ? (s as number) : 1;
    } catch {
        return 1;
    }
}

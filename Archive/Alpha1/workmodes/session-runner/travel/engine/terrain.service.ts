// Kapselt Terrain-Geschwindigkeit (einzige Quelle!)
// Nutzung: ausschließlich aus domain/playback.ts

import type { App, TFile } from "obsidian";
import { loadTile, getMovementSpeed } from "@features/maps";
import type { TerrainType, FloraType } from "@domain";
import type { Coord } from './calendar-types';

export async function loadTerrainSpeed(app: App, mapFile: TFile, rc: Coord): Promise<number> {
    try {
        const data = await loadTile(app, mapFile, rc);
        const terrain = data?.terrain as TerrainType | undefined;
        const flora = data?.flora as FloraType | undefined;
        const moisture = data?.moisture;
        return getMovementSpeed(terrain, flora, moisture);
    } catch {
        return 1;
    }
}

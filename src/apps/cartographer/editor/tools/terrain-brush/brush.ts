// src/apps/cartographer/editor/tools/terrain-brush/brush.ts
import type { App, TFile } from "obsidian";
import type { RenderHandles } from "../../../../../core/hex-mapper/hex-render";
import { saveTile, deleteTile } from "../../../../../core/hex-mapper/hex-notes";
import { coordsInRadius } from "./brush-math";
import { TERRAIN_COLORS } from "../../../../../core/terrain";

type BrushOpts = {
    radius: number;               // 0 == nur die angeklickte Zelle
    terrain: string;              // z. B. "Wald" | "Meer" | "Berg" | ""
    mode?: "paint" | "erase";     // default: "paint"
};

/**
 * Wendet den Brush auf die Karte an:
 * - Verändert ausschließlich Zellen innerhalb des gegebenen Radius (odd-r Grid).
 * - "paint": legt Tiles an / aktualisiert Terrain + färbt live.
 * - "erase": löscht Tiles + setzt Fill transparent.
 * - Kein Re-Render; falls Bounds wachsen müssen, sollte der Aufrufer `ctx.refreshMap?.()` triggern.
 */
export async function applyBrush(
    app: App,
    mapFile: TFile,
    center: { r: number; c: number },
    opts: BrushOpts,
    handles: RenderHandles
): Promise<void> {
    const mode = opts.mode ?? "paint";
    const radius = Math.max(0, opts.radius | 0);

    // Nur Koordinaten im Radius (optional dedup, falls Odd-R-Shift Duplikate erzeugt)
    const raw = coordsInRadius(center, radius);
    const seen = new Set<string>();

    for (const coord of raw) {
        const key = `${coord.r},${coord.c}`;
        if (seen.has(key)) continue;
        seen.add(key);

        if (mode === "erase") {
            await deleteTile(app, mapFile, coord);
            handles.setFill(coord, "transparent");
            continue;
        }

        // paint
        const terrain = opts.terrain ?? "";
        await saveTile(app, mapFile, coord, { terrain });
        const color = TERRAIN_COLORS[terrain] ?? "transparent";
        handles.setFill(coord, color);
    }
}

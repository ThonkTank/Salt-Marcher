// UI: Map-Layer (renderHexMap + ensurePolys + polyIndex + centerOf)
// Hält KEINE Business-Logik. Stellt Funktionen für Adapter bereit.

import type { App, TFile } from "obsidian";
import { renderHexMap, type RenderHandles } from "../../core/hex-mapper/hex-render";
import type { Coord } from "../domain/types";

export type MapLayer = {
    handles: RenderHandles;
    /** Für Hit-Tests: Polygon-Element -> Koordinate */
    polyToCoord: WeakMap<SVGElement, Coord>;
    /** Stellt sicher, dass für alle Koordinaten SVG-Polygone existieren (und indexiert neue) */
    ensurePolys(coords: Coord[]): void;
    /** Mittelpunkt eines Hex (BBox) – stellt Polys bei Bedarf sicher */
    centerOf(rc: Coord): { x: number; y: number } | null;
    destroy(): void;
};

const keyOf = (r: number, c: number) => `${r},${c}`;

export async function createMapLayer(
    app: App,
    host: HTMLElement,
    mapFile: TFile,
    opts: any
): Promise<MapLayer> {
    // render map
    const handles = await renderHexMap(app, host, opts, mapFile.path);

    // Index: Polygon -> Coord (für elementFromPoint/Drag)
    const polyToCoord = new WeakMap<SVGElement, Coord>();
    for (const [k, poly] of handles.polyByCoord) {
        if (!poly) continue;
        const [r, c] = k.split(",").map(Number);
        polyToCoord.set(poly as unknown as SVGElement, { r, c });
    }

    function ensurePolys(coords: Coord[]) {
        (handles as any).ensurePolys?.(coords);
        // Neu erzeugte Polys in den Index aufnehmen
        for (const rc of coords) {
            const poly = handles.polyByCoord.get(keyOf(rc.r, rc.c));
            if (poly) polyToCoord.set(poly as unknown as SVGElement, rc);
        }
    }

    function centerOf(rc: Coord): { x: number; y: number } | null {
        let poly = handles.polyByCoord.get(keyOf(rc.r, rc.c));
        if (!poly) {
            ensurePolys([rc]);
            poly = handles.polyByCoord.get(keyOf(rc.r, rc.c));
            if (!poly) return null;
        }
        const bb = poly.getBBox();
        return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
    }

    function destroy() {
        try {
            handles.destroy?.();
        } catch {}
    }

    return { handles, polyToCoord, ensurePolys, centerOf, destroy };
}

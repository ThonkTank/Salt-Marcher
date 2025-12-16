// UI: Map-Layer (renderHexMap + ensurePolys + polyIndex + centerOf)
// Hält KEINE Business-Logik. Stellt Funktionen für Adapter bereit.

import type { App, TFile } from "obsidian";
import { renderHexMap, type RenderHandles, type HexOptions } from "@features/maps";
import { coordToKey } from "@geometry";
import type { Coord } from "../engine/travel-engine-types";

export type MapLayer = {
    handles: RenderHandles;
    /** Für Hit-Tests: Polygon-Element -> Koordinate */
    polyToCoord: WeakMap<SVGElement, Coord>;
    /** Stellt sicher, dass für alle Koordinaten SVG-Polygone existieren (und indexiert neue) */
    ensurePolys(coords: Coord[]): void;
    /** Mittelpunkt eines Hex (BBox) – stellt Polys bei Bedarf sicher */
    centerOf(rc: Coord): { x: number; y: number } | null;
    /** Aktualisiert Gezeiten basierend auf aktueller Zeit (Session Runner Integration) */
    refreshTidalLayer(): void;
    destroy(): void;
};

export type RenderLayerOptions = HexOptions;

export async function createMapLayer(
    app: App,
    host: HTMLElement,
    mapFile: TFile,
    opts: RenderLayerOptions
): Promise<MapLayer> {
    // render map
    const handles = await renderHexMap(app, host, mapFile, opts);

    // Index: Polygon -> Coord (für elementFromPoint/Drag)
    const polyToCoord = new WeakMap<SVGElement, Coord>();
    for (const [k, poly] of handles.polyByCoord) {
        if (!poly) continue;
        const [q, r] = k.split(",").map(Number);
        polyToCoord.set(poly as unknown as SVGElement, { q, r });
    }

    const ensureHandlesPolys = typeof handles.ensurePolys === "function"
        ? (coords: Coord[]) => handles.ensurePolys(coords)
        : null;

    function ensurePolys(coords: Coord[]) {
        ensureHandlesPolys?.(coords);
        // Neu erzeugte Polys in den Index aufnehmen
        for (const rc of coords) {
            const poly = handles.polyByCoord.get(coordToKey(rc));
            if (poly) polyToCoord.set(poly as unknown as SVGElement, rc);
        }
    }

    function centerOf(rc: Coord): { x: number; y: number } | null {
        let poly = handles.polyByCoord.get(coordToKey(rc));
        if (!poly) {
            ensurePolys([rc]);
            poly = handles.polyByCoord.get(coordToKey(rc));
            if (!poly) return null;
        }
        const bb = poly.getBBox();
        return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
    }

    function refreshTidalLayer() {
        // Tidal layer refresh logic removed - not implemented in RenderHandles
        // This is a placeholder for future implementation
    }

    function destroy() {
        try {
            handles.destroy?.();
        } catch {}
    }

    return { handles, polyToCoord, ensurePolys, centerOf, refreshTidalLayer, destroy };
}

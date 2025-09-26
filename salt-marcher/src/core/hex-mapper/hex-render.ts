// src/core/hex-mapper/hex-render.ts
import { App, TFile } from "obsidian";
import { getCenterLeaf } from "../layout";
import { listTilesForMap, saveTile, type TileCoord } from "./hex-notes";
import type { HexOptions } from "../options";
import { TERRAIN_COLORS } from "../terrain";
import { createHexScene } from "./render/scene";
import { createCameraController } from "./render/camera-controller";
import { createInteractionController } from "./render/interactions";
import { createEventBackedInteractionDelegate } from "./render/interaction-delegate";
import type { HexCoord, HexInteractionDelegate } from "./render/types";
export type { HexInteractionDelegate, HexInteractionOutcome } from "./render/types";
export { createEventBackedInteractionDelegate } from "./render/interaction-delegate";

export type RenderHandles = {
    svg: SVGSVGElement;
    contentG: SVGGElement;
    overlay: SVGRectElement;
    polyByCoord: Map<string, SVGPolygonElement>;
    setFill(coord: HexCoord, color: string): void;
    /** Fügt fehlende Polygone für die angegebenen Koordinaten hinzu und erweitert viewBox/Overlay. */
    ensurePolys(coords: HexCoord[]): void;
    /** Ersetzt den aktiven Interaktions-Delegate (z. B. für Editor-Tools). */
    setInteractionDelegate(delegate: HexInteractionDelegate | null): void;
    destroy(): void;
};

type Bounds = { minR: number; maxR: number; minC: number; maxC: number };

function computeBounds(tiles: Array<{ coord: { r: number; c: number } }>): Bounds | null {
    if (!tiles.length) return null;
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (const t of tiles) {
        const { r, c } = t.coord;
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
    }
    return { minR, maxR, minC, maxC };
}

export async function renderHexMap(
    app: App,
    host: HTMLElement,
    opts: HexOptions,
    mapPath: string
): Promise<RenderHandles> {
    const radius = opts.radius;
    const hexW = Math.sqrt(3) * radius;
    const hexH = 2 * radius;
    const hStep = hexW;
    const vStep = 0.75 * hexH;
    const pad = 12;

    const mapFile = app.vault.getAbstractFileByPath(mapPath);
    let tiles: Array<{ coord: TileCoord; data: { terrain: string } }> = [];
    let bounds: Bounds | null = null;
    if (mapFile instanceof TFile) {
        try {
            tiles = await listTilesForMap(app, mapFile);
            bounds = computeBounds(tiles);
        } catch {
            // still fine; fallback unten
        }
    }

    const minR0 = bounds ? bounds.minR : 0;
    const maxR0 = bounds ? bounds.maxR : 2;
    const minC0 = bounds ? bounds.minC : 0;
    const maxC0 = bounds ? bounds.maxC : 2;

    const base: HexCoord = { r: minR0, c: minC0 };

    const initialCoords: HexCoord[] = tiles.length
        ? tiles.map((t) => t.coord)
        : (() => {
              const fallback: HexCoord[] = [];
              for (let r = minR0; r <= maxR0; r++) {
                  for (let c = minC0; c <= maxC0; c++) {
                      fallback.push({ r, c });
                  }
              }
              return fallback;
          })();

    const scene = createHexScene({
        host,
        radius,
        padding: pad,
        base,
        initialCoords,
    });

    const camera = createCameraController(
        scene.svg,
        scene.contentG,
        scene.overlay,
        host,
        { minScale: 0.15, maxScale: 16, zoomSpeed: 1.01 }
    );

    const svgPt = scene.svg.createSVGPoint();

    const toContentPoint = (ev: MouseEvent | PointerEvent) => {
        const m = scene.contentG.getScreenCTM();
        if (!m) return null;
        svgPt.x = ev.clientX;
        svgPt.y = ev.clientY;
        return svgPt.matrixTransform(m.inverse());
    };

    const pointToCoord = (px: number, py: number): HexCoord => {
        const rFloat = (py - pad - hexH / 2) / vStep + base.r;
        let r = Math.round(rFloat);
        const isOdd = r % 2 !== 0;
        let c = Math.round((px - pad - (isOdd ? hexW / 2 : 0)) / hStep + base.c);

        let best = { r, c };
        let bestD2 = Infinity;
        for (let dr = -1; dr <= 1; dr++) {
            const rr = r + dr;
            const odd = rr % 2 !== 0;
            const cc = Math.round((px - pad - (odd ? hexW / 2 : 0)) / hStep + base.c);
            const cx = pad + (cc - base.c) * hStep + (rr % 2 ? hexW / 2 : 0);
            const cy = pad + (rr - base.r) * vStep + hexH / 2;
            const dx = px - cx;
            const dy = py - cy;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) {
                bestD2 = d2;
                best = { r: rr, c: cc };
            }
        }
        return best;
    };

    const defaultDelegate = createEventBackedInteractionDelegate(host);
    const delegateRef = { current: defaultDelegate as HexInteractionDelegate };

    async function handleDefaultClick(coord: HexCoord) {
        const file = app.vault.getAbstractFileByPath(mapPath);
        if (!(file instanceof TFile)) return;
        const tfile = await saveTile(app, file, coord, { terrain: "" });
        const leaf = getCenterLeaf(app);
        await leaf.openFile(tfile, { active: true });
    }

    const interactions = createInteractionController({
        svg: scene.svg,
        overlay: scene.overlay,
        toContentPoint,
        pointToCoord,
        delegateRef,
        onDefaultClick: (coord) => handleDefaultClick(coord),
    });

    for (const { coord, data } of tiles) {
        const color = TERRAIN_COLORS[data.terrain] ?? "transparent";
        scene.setFill(coord, color);
    }

    const ensurePolys = (coords: HexCoord[]) => {
        if (!coords.length) return;
        scene.ensurePolys(coords);
    };

    return {
        svg: scene.svg,
        contentG: scene.contentG,
        overlay: scene.overlay,
        polyByCoord: scene.polyByCoord,
        setFill: (coord, color) => scene.setFill(coord, color),
        ensurePolys,
        setInteractionDelegate: (delegate) => {
            delegateRef.current = delegate ?? defaultDelegate;
        },
        destroy: () => {
            interactions.destroy();
            camera.destroy();
            scene.destroy();
        },
    };
}

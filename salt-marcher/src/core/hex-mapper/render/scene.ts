// src/core/hex-mapper/render/scene.ts
import { hexPolygonPoints } from "../hex-geom";
import type { HexCoord, HexScene, HexSceneConfig } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";

const keyOf = (coord: HexCoord) => `${coord.r},${coord.c}`;

type Rect = { minX: number; minY: number; maxX: number; maxY: number };

type SceneInternals = {
    bounds: Rect | null;
    updateViewBox(): void;
    centerOf(coord: HexCoord): { cx: number; cy: number };
    bboxOf(coord: HexCoord): Rect;
};

export function createHexScene(config: HexSceneConfig): HexScene {
    const { host, radius, padding, base, initialCoords } = config;

    const hexW = Math.sqrt(3) * radius;
    const hexH = 2 * radius;
    const hStep = hexW;
    const vStep = 0.75 * hexH;

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "hex3x3-map");
    svg.setAttribute("width", "100%");
    (svg.style as any).touchAction = "none";

    const overlay = document.createElementNS(SVG_NS, "rect") as SVGRectElement;
    overlay.setAttribute("fill", "transparent");
    overlay.setAttribute("pointer-events", "all");
    (overlay as unknown as HTMLElement).style.touchAction = "none";

    const contentG = document.createElementNS(SVG_NS, "g") as SVGGElement;

    svg.appendChild(overlay);
    svg.appendChild(contentG);
    host.appendChild(svg);

    const polyByCoord = new Map<string, SVGPolygonElement>();

    const internals: SceneInternals = {
        bounds: null,
        updateViewBox() {
            if (!internals.bounds) return;
            const { minX, minY, maxX, maxY } = internals.bounds;
            const paddedMinX = Math.floor(minX - padding);
            const paddedMinY = Math.floor(minY - padding);
            const paddedMaxX = Math.ceil(maxX + padding);
            const paddedMaxY = Math.ceil(maxY + padding);
            const width = Math.max(1, paddedMaxX - paddedMinX);
            const height = Math.max(1, paddedMaxY - paddedMinY);
            svg.setAttribute("viewBox", `${paddedMinX} ${paddedMinY} ${width} ${height}`);
            overlay.setAttribute("x", String(paddedMinX));
            overlay.setAttribute("y", String(paddedMinY));
            overlay.setAttribute("width", String(width));
            overlay.setAttribute("height", String(height));
        },
        centerOf(coord: HexCoord) {
            const { r, c } = coord;
            const cx = padding + (c - base.c) * hStep + (r % 2 ? hexW / 2 : 0);
            const cy = padding + (r - base.r) * vStep + hexH / 2;
            return { cx, cy };
        },
        bboxOf(coord: HexCoord) {
            const { cx, cy } = internals.centerOf(coord);
            return {
                minX: cx - hexW / 2,
                maxX: cx + hexW / 2,
                minY: cy - radius,
                maxY: cy + radius,
            };
        },
    };

    function mergeBounds(next: Rect): void {
        if (!internals.bounds) {
            internals.bounds = { ...next };
            return;
        }
        const current = internals.bounds;
        current.minX = Math.min(current.minX, next.minX);
        current.minY = Math.min(current.minY, next.minY);
        current.maxX = Math.max(current.maxX, next.maxX);
        current.maxY = Math.max(current.maxY, next.maxY);
    }

    function addHex(coord: HexCoord): void {
        if (polyByCoord.has(keyOf(coord))) return;
        const { cx, cy } = internals.centerOf(coord);
        const poly = document.createElementNS(SVG_NS, "polygon");
        poly.setAttribute("points", hexPolygonPoints(cx, cy, radius));
        poly.setAttribute("data-row", String(coord.r));
        poly.setAttribute("data-col", String(coord.c));
        (poly.style as any).fill = "transparent";
        (poly.style as any).stroke = "var(--text-muted)";
        (poly.style as any).strokeWidth = "2";
        (poly.style as any).transition = "fill 120ms ease, fill-opacity 120ms ease, stroke 120ms ease";

        contentG.appendChild(poly);
        polyByCoord.set(keyOf(coord), poly);

        const label = document.createElementNS(SVG_NS, "text");
        label.setAttribute("x", String(cx));
        label.setAttribute("y", String(cy + 4));
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("pointer-events", "none");
        label.setAttribute("fill", "var(--text-muted)");
        label.textContent = `${coord.r},${coord.c}`;
        contentG.appendChild(label);

        mergeBounds(internals.bboxOf(coord));
    }

    function ensurePolys(coords: HexCoord[]): void {
        let added = false;
        for (const coord of coords) {
            const key = keyOf(coord);
            if (polyByCoord.has(key)) continue;
            addHex(coord);
            added = true;
        }
        if (added) internals.updateViewBox();
    }

    function setFill(coord: HexCoord, color: string): void {
        const poly = polyByCoord.get(keyOf(coord));
        if (!poly) return;
        const fill = color ?? "transparent";
        (poly.style as any).fill = fill;
        (poly.style as any).fillOpacity = fill !== "transparent" ? "0.25" : "0";
        if (fill !== "transparent") {
            poly.setAttribute("data-painted", "1");
        } else {
            poly.removeAttribute("data-painted");
        }
    }

    const initial = initialCoords.length ? initialCoords : [];
    if (initial.length) {
        for (const coord of initial) addHex(coord);
        internals.updateViewBox();
    }

    return {
        svg,
        contentG,
        overlay,
        polyByCoord,
        ensurePolys,
        setFill,
        getViewBox: () => {
            if (!internals.bounds) {
                return { minX: 0, minY: 0, width: 0, height: 0 };
            }
            const { minX, minY, maxX, maxY } = internals.bounds;
            return { minX, minY, width: maxX - minX, height: maxY - minY };
        },
        destroy: () => {
            polyByCoord.clear();
            svg.remove();
        },
    };
}

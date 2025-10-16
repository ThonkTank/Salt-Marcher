// src/core/hex-mapper/render/coordinates.ts
import type { HexCoord, HexCoordinateTranslator } from "./types";

export type CoordinateTranslatorConfig = {
    svg: SVGSVGElement;
    contentG: SVGGElement;
    base: HexCoord;
    radius: number;
    padding: number;
};

export function createCoordinateTranslator(config: CoordinateTranslatorConfig): HexCoordinateTranslator {
    const { svg, contentG, base, radius, padding } = config;

    const hexW = Math.sqrt(3) * radius;
    const hexH = 2 * radius;
    const hStep = hexW;
    const vStep = 0.75 * hexH;

    const svgPoint = svg.createSVGPoint();

    const toContentPoint = (ev: MouseEvent | PointerEvent): DOMPoint | null => {
        const matrix = contentG.getScreenCTM();
        if (!matrix) return null;
        svgPoint.x = ev.clientX;
        svgPoint.y = ev.clientY;
        return svgPoint.matrixTransform(matrix.inverse());
    };

    const pointToCoord = (px: number, py: number): HexCoord => {
        const rFloat = (py - padding - hexH / 2) / vStep + base.r;
        let r = Math.round(rFloat);
        const isOdd = r % 2 !== 0;
        let c = Math.round((px - padding - (isOdd ? hexW / 2 : 0)) / hStep + base.c);

        let best = { r, c };
        let bestD2 = Infinity;
        for (let dr = -1; dr <= 1; dr++) {
            const rr = r + dr;
            const odd = rr % 2 !== 0;
            const cc = Math.round((px - padding - (odd ? hexW / 2 : 0)) / hStep + base.c);
            const cx = padding + (cc - base.c) * hStep + (rr % 2 ? hexW / 2 : 0);
            const cy = padding + (rr - base.r) * vStep + hexH / 2;
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

    return {
        toContentPoint,
        pointToCoord,
    };
}

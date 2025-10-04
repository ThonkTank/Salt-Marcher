// tests/core/hex-render-scene.test.ts
// Exercises the SVG scene builder to ensure viewBox updates stay anchored while expanding bounds.

import { describe, expect, it } from "vitest";

import { createHexScene } from "../../src/core/hex-mapper/render/scene";

const parseViewBox = (value: string | null) => {
    if (!value) throw new Error("Expected viewBox attribute to be set");
    const [minX, minY, width, height] = value.split(" ").map(Number);
    return { minX, minY, width, height };
};

describe("createHexScene", () => {
    it("keeps the viewBox center stable when expanding horizontally", () => {
        const host = document.createElement("div");
        document.body.appendChild(host);

        const scene = createHexScene({
            host,
            radius: 40,
            padding: 12,
            base: { r: 0, c: 0 },
            initialCoords: [{ r: 0, c: 0 }],
        });

        const initialViewBox = parseViewBox(scene.svg.getAttribute("viewBox"));
        const initialCenterX = initialViewBox.minX + initialViewBox.width / 2;
        const initialCenterY = initialViewBox.minY + initialViewBox.height / 2;

        scene.ensurePolys([
            { r: 0, c: 1 },
            { r: 0, c: -1 },
        ]);

        const expandedViewBox = parseViewBox(scene.svg.getAttribute("viewBox"));
        const expandedCenterX = expandedViewBox.minX + expandedViewBox.width / 2;
        const expandedCenterY = expandedViewBox.minY + expandedViewBox.height / 2;

        expect(expandedViewBox.width).toBeGreaterThan(initialViewBox.width);
        expect(expandedViewBox.height).toBe(initialViewBox.height);
        expect(expandedCenterX).toBeCloseTo(initialCenterX, 6);
        expect(expandedCenterY).toBeCloseTo(initialCenterY, 6);

        scene.destroy();
        host.remove();
    });

    it("keeps the viewBox center stable when expanding vertically", () => {
        const host = document.createElement("div");
        document.body.appendChild(host);

        const scene = createHexScene({
            host,
            radius: 40,
            padding: 12,
            base: { r: 0, c: 0 },
            initialCoords: [{ r: 0, c: 0 }],
        });

        const initialViewBox = parseViewBox(scene.svg.getAttribute("viewBox"));
        const initialCenterX = initialViewBox.minX + initialViewBox.width / 2;
        const initialCenterY = initialViewBox.minY + initialViewBox.height / 2;

        scene.ensurePolys([
            { r: 1, c: 0 },
            { r: -1, c: 0 },
        ]);

        const expandedViewBox = parseViewBox(scene.svg.getAttribute("viewBox"));
        const expandedCenterX = expandedViewBox.minX + expandedViewBox.width / 2;
        const expandedCenterY = expandedViewBox.minY + expandedViewBox.height / 2;

        expect(expandedViewBox.height).toBeGreaterThan(initialViewBox.height);
        expect(expandedViewBox.width).toBeGreaterThanOrEqual(initialViewBox.width);
        expect(expandedCenterX).toBeCloseTo(initialCenterX, 6);
        expect(expandedCenterY).toBeCloseTo(initialCenterY, 6);

        scene.destroy();
        host.remove();
    });
});

// tests/core/hex-render-scene.test.ts
// Verifies that the SVG scene notifies callers about viewBox changes when bounds expand.

import { describe, expect, it, vi } from "vitest";

import { createHexScene } from "../../src/core/hex-mapper/render/scene";

describe("createHexScene", () => {
    it("emits viewBox change events for new polygons", () => {
        const host = document.createElement("div");
        document.body.appendChild(host);

        const onViewBoxChange = vi.fn();

        const scene = createHexScene({
            host,
            radius: 40,
            padding: 12,
            base: { r: 0, c: 0 },
            initialCoords: [{ r: 0, c: 0 }],
            onViewBoxChange,
        });

        onViewBoxChange.mockClear();

        scene.ensurePolys([
            { r: 0, c: 1 },
            { r: 0, c: -1 },
        ]);

        expect(onViewBoxChange).toHaveBeenCalledTimes(1);
        const [{ prev, next }] = onViewBoxChange.mock.calls[0];
        expect(prev).not.toBeNull();
        expect(next.width).toBeGreaterThan(prev!.width);
        expect(next.minX).toBeLessThanOrEqual(prev!.minX);
        expect(next.width).toBeGreaterThan(0);

        scene.destroy();
        host.remove();
    });

    it("returns the latest viewBox snapshot", () => {
        const host = document.createElement("div");
        document.body.appendChild(host);

        const scene = createHexScene({
            host,
            radius: 40,
            padding: 12,
            base: { r: 0, c: 0 },
            initialCoords: [{ r: 0, c: 0 }],
        });

        const initial = scene.getViewBox();
        expect(initial.width).toBeGreaterThan(0);

        scene.ensurePolys([{ r: 1, c: 0 }]);
        const updated = scene.getViewBox();

        expect(updated.width).toBeGreaterThan(initial.width);
        expect(updated.minY).toBeLessThanOrEqual(initial.minY);

        scene.destroy();
        host.remove();
    });
});

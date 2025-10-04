// tests/core/hex-camera-controller.test.ts
// Ensures the camera controller compensates for viewBox changes to keep the scene stable.

import { describe, expect, it } from "vitest";

import { createCameraController } from "../../src/core/hex-mapper/render/camera-controller";

const parseTransform = (value: string | null) => {
    if (!value) return { tx: 0, ty: 0, scale: 1 };
    const match = value.match(/translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+)\)/);
    if (!match) throw new Error(`Unexpected transform: ${value}`);
    return {
        tx: Number(match[1]),
        ty: Number(match[2]),
        scale: Number(match[3]),
    };
};

describe("createCameraController", () => {
    it("adjusts scale and translation when the viewBox expands", () => {
        const host = document.createElement("div");
        document.body.appendChild(host);

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const contentG = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const overlay = document.createElementNS("http://www.w3.org/2000/svg", "rect");

        svg.appendChild(contentG);
        svg.appendChild(overlay);
        host.appendChild(svg);

        Object.defineProperty(svg, "getBoundingClientRect", {
            configurable: true,
            value: () => ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600 }),
        });
        Object.defineProperty(svg, "clientWidth", { value: 800, configurable: true });
        Object.defineProperty(svg, "clientHeight", { value: 600, configurable: true });

        const camera = createCameraController(svg, contentG, overlay, host, {
            minScale: 0.15,
            maxScale: 16,
            zoomSpeed: 1.01,
        });

        const prev = { minX: -120, minY: -80, width: 240, height: 200 };
        const next = { minX: -220, minY: -130, width: 480, height: 260 };

        camera.syncViewBox({ prev, next });

        const { tx, ty, scale } = parseTransform(contentG.getAttribute("transform"));
        expect(scale).toBeCloseTo(2, 6);
        expect(tx).toBeCloseTo(-333.333, 3);
        expect(ty).toBeCloseTo(-150, 3);

        camera.destroy();
        host.remove();
    });
});

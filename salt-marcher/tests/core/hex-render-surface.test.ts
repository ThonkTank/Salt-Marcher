// tests/core/hex-render-surface.test.ts
// Ensures the render surface selector reports capabilities and preferences correctly.

import { afterEach, describe, expect, it, vi } from "vitest";
import { selectRenderSurface } from "../../src/core/hex-mapper/render/surface";

type GetContext = typeof HTMLCanvasElement.prototype.getContext;

const originalGetContext = HTMLCanvasElement.prototype.getContext;

afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext as GetContext;
    vi.restoreAllMocks();
});

describe("selectRenderSurface", () => {
    it("prefers webgl2 when GPU contexts are available", () => {
        HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
            if (type === "webgl2") return {} as any;
            if (type === "2d") return {} as any;
            return null;
        }) as GetContext;

        const selection = selectRenderSurface();

        expect(selection.preferred).toBe("webgl2");
        expect(selection.actual).toBe("svg");
        expect(selection.capabilities).toEqual({ webgl2: true, webgl: false, canvas2d: true });
    });

    it("falls back to canvas2d when GPU contexts are disabled", () => {
        HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
            if (type === "2d") return {} as any;
            return null;
        }) as GetContext;

        const selection = selectRenderSurface({ preferGpu: false });

        expect(selection.preferred).toBe("canvas2d");
        expect(selection.capabilities.webgl2).toBe(false);
        expect(selection.capabilities.webgl).toBe(false);
    });

    it("reports svg when no contexts are available", () => {
        HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as GetContext;

        const selection = selectRenderSurface();

        expect(selection.preferred).toBe("svg");
        expect(selection.actual).toBe("svg");
        expect(selection.capabilities).toEqual({ webgl2: false, webgl: false, canvas2d: false });
    });
});

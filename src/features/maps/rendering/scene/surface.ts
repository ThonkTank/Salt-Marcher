// src/core/hex-mapper/render/surface.ts
// Detects available rendering backends and describes the selected surface.

export type HexRenderSurfaceKind = "webgl2" | "webgl" | "canvas2d" | "svg";

export type HexRenderSurfaceSelection = {
    /** Backend the runtime would like to use based on preferences and capabilities. */
    preferred: HexRenderSurfaceKind;
    /** Backend that is currently implemented. Always "svg" until GPU pipelines land. */
    actual: HexRenderSurfaceKind;
    /** Capability map indicating which contexts are available in the host environment. */
    capabilities: {
        webgl2: boolean;
        webgl: boolean;
        canvas2d: boolean;
    };
};

export type SelectRenderSurfaceOptions = {
    /**
     * When true (default), the selector will attempt to use GPU acceleration via WebGL2/WebGL.
     * When false, detection skips GPU capabilities and prefers Canvas2D.
     */
    preferGpu?: boolean;
};

function detectContext(canvas: HTMLCanvasElement, type: string): boolean {
    try {
        const ctx = canvas.getContext(type as any);
        return ctx != null;
    } catch {
        return false;
    }
}

export function selectRenderSurface(options: SelectRenderSurfaceOptions = {}): HexRenderSurfaceSelection {
    const { preferGpu = true } = options;
    const canvas = document.createElement("canvas");

    const webgl2 = preferGpu ? detectContext(canvas, "webgl2") : false;
    const webgl = preferGpu ? (!webgl2 && detectContext(canvas, "webgl")) : false;
    const canvas2d = detectContext(canvas, "2d");

    let preferred: HexRenderSurfaceKind = "svg";
    if (preferGpu && (webgl2 || webgl)) {
        preferred = webgl2 ? "webgl2" : "webgl";
    } else if (canvas2d) {
        preferred = "canvas2d";
    }

    return {
        preferred,
        actual: "svg",
        capabilities: { webgl2, webgl, canvas2d },
    };
}

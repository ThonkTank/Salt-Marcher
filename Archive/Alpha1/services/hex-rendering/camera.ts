// src/services/hex-rendering/camera.ts
// Camera controller for SVG-based hex map rendering
//
// Provides pan (middle mouse button) and zoom (wheel/touchpad) controls
// for navigating large hex maps rendered in SVG.

import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("camera");

export type CameraOptions = { minScale: number; maxScale: number; zoomSpeed: number };

export interface HexCameraController {
    destroy(): void;
}

/**
 * Create camera controller
 *
 * Convenience factory that creates a camera controller with cleanup handling.
 * Wraps attachCameraControls with error-safe destroy.
 */
export function createCameraController(
    svg: SVGSVGElement,
    contentG: SVGGElement,
    overlay: SVGRectElement,
    host: HTMLElement,
    options: CameraOptions
): HexCameraController {
    const detach = attachCameraControls(svg, contentG, options, [overlay, host]);
    return {
        destroy() {
            try {
                detach?.();
            } catch (err) {
                logger.error("[hex-render] camera cleanup failed", err);
            }
        },
    };
}

/** Mittlere Maustaste: Pan, Wheel/Touchpad: Zoom zum Cursor. */
export function attachCameraControls(
    svg: SVGSVGElement,
    contentG: SVGGElement,
    opts: CameraOptions,
    extraTargets: Element[] = []        // z.B. Overlay-Rect, Host-DIV
) {
    let scale = 1;
    let tx = 0, ty = 0;
    let panning = false;
    let lastX = 0, lastY = 0;

    // native Gesten/Scroll blocken (auch auf Touchpads)
    (svg.style as any).touchAction = "none";

    const apply = () => {
        contentG.setAttribute("transform", `translate(${tx},${ty}) scale(${scale})`);
    };
    apply();

    // Screen → SVG-Koordinaten (vor Transform!)
    const svgPoint = (clientX: number, clientY: number) => {
        const pt = svg.createSVGPoint(); pt.x = clientX; pt.y = clientY;
        const ctm = svg.getScreenCTM(); if (!ctm) return { x: clientX, y: clientY };
        const p = pt.matrixTransform(ctm.inverse());
        return { x: p.x, y: p.y };
    };

    // Wheel normalisieren (Pixel/Line/Page)
    const normalizeDelta = (ev: WheelEvent) =>
    ev.deltaMode === 1 ? ev.deltaY * 16 :
    ev.deltaMode === 2 ? ev.deltaY * 360 : ev.deltaY;

    const onWheel = (ev: WheelEvent) => {
        ev.preventDefault(); ev.stopPropagation();

        const dy = normalizeDelta(ev);
        // sanftes, konsistentes Zoom
        const factor = Math.exp(-dy * 0.001 * (opts.zoomSpeed || 1));
        const newScale = Math.max(opts.minScale, Math.min(opts.maxScale, scale * factor));
        if (newScale === scale) return;

        // Zoom zum Cursor
        const { x: sx, y: sy } = svgPoint(ev.clientX, ev.clientY);
        const wx = (sx - tx) / scale, wy = (sy - ty) / scale;
        scale = newScale;
        tx = sx - wx * scale; ty = sy - wy * scale;
        apply();
    };

    // Pan (nur MMB)
    const onPointerDown = (ev: PointerEvent) => {
        if (ev.button !== 1) return;
        ev.preventDefault(); ev.stopPropagation();
        panning = true; lastX = ev.clientX; lastY = ev.clientY;
        (ev.target as Element).setPointerCapture?.(ev.pointerId);
        (svg.style as any).cursor = "grabbing";
    };
    const onPointerMove = (ev: PointerEvent) => {
        if (!panning) return;
        ev.preventDefault(); ev.stopPropagation();
        const dx = ev.clientX - lastX, dy = ev.clientY - lastY;
        lastX = ev.clientX; lastY = ev.clientY;
        tx += dx; ty += dy;
        apply();
    };
    const endPan = (ev?: PointerEvent | FocusEvent) => {
        if (!panning) return;
        if (ev instanceof PointerEvent) {
            ev.preventDefault(); ev.stopPropagation();
            (ev.target as Element).releasePointerCapture?.(ev.pointerId);
        }
        panning = false; (svg.style as any).cursor = "";
    };

    // auf mehreren Targets registrieren: svg + optionale overlay/host
    const targets: Element[] = [svg, ...extraTargets];
    for (const t of targets) {
        t.addEventListener("wheel", onWheel, { passive: false });
        t.addEventListener("pointerdown", onPointerDown);
        t.addEventListener("pointermove", onPointerMove);
        t.addEventListener("pointerup", endPan);
        t.addEventListener("pointercancel", endPan);
        t.addEventListener("pointerleave", endPan);
        (t as HTMLElement).style.touchAction = "none";
    }
    window.addEventListener("blur", endPan);

    // Cleanup für späteres Unmounten
    return () => {
        for (const t of targets) {
            t.removeEventListener("wheel", onWheel as any);
            t.removeEventListener("pointerdown", onPointerDown as any);
            t.removeEventListener("pointermove", onPointerMove as any);
            t.removeEventListener("pointerup", endPan as any);
            t.removeEventListener("pointercancel", endPan as any);
            t.removeEventListener("pointerleave", endPan as any);
        }
        window.removeEventListener("blur", endPan as any);
    };
}

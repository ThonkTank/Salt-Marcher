// src/core/hex-mapper/render/camera-controller.ts
import { attachCameraControls } from "../camera";
import type { HexCameraController, HexViewBox } from "./types";

type CameraOptions = { minScale: number; maxScale: number; zoomSpeed: number };

export function createCameraController(
    svg: SVGSVGElement,
    contentG: SVGGElement,
    overlay: SVGRectElement,
    host: HTMLElement,
    options: CameraOptions
): HexCameraController {
    const controls = attachCameraControls(svg, contentG, options, [overlay, host]);

    const clampScale = (value: number) => {
        return Math.max(options.minScale, Math.min(options.maxScale, value));
    };

    const measureViewport = () => {
        const rect = svg.getBoundingClientRect();
        let width = rect.width;
        let height = rect.height;
        if (!width) {
            width = svg.clientWidth || host.clientWidth;
        }
        if (!height) {
            height = svg.clientHeight || host.clientHeight;
        }
        return {
            width: width || 1,
            height: height || 1,
        };
    };

    const syncViewBox = (prev: HexViewBox, next: HexViewBox) => {
        if (!prev.width || !prev.height) return;
        const viewport = measureViewport();
        if (!viewport.width || !viewport.height) return;

        const state = controls.getState();

        const scaleFactorX = next.width / prev.width;
        const scaleFactorY = next.height / prev.height;
        const scaleFactor = Math.max(scaleFactorX, scaleFactorY);

        const newScale = clampScale(state.scale * scaleFactor);

        const screenScaleX = state.scale * (viewport.width / prev.width);
        const screenScaleY = state.scale * (viewport.height / prev.height);

        const deltaX = next.minX - prev.minX;
        const deltaY = next.minY - prev.minY;

        const newTx = state.tx + screenScaleX * deltaX;
        const newTy = state.ty + screenScaleY * deltaY;

        controls.setState({ scale: newScale, tx: newTx, ty: newTy });
    };

    return {
        destroy() {
            try {
                controls?.destroy();
            } catch (err) {
                console.error("[hex-render] camera cleanup failed", err);
            }
        },
        syncViewBox(change) {
            try {
                syncViewBox(change.prev, change.next);
            } catch (err) {
                console.error("[hex-render] failed to sync camera with viewBox", err);
            }
        },
    };
}

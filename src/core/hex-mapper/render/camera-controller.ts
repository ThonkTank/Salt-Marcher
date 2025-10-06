// src/core/hex-mapper/render/camera-controller.ts
import { attachCameraControls } from "../camera";
import type { HexCameraController } from "./types";

type CameraOptions = { minScale: number; maxScale: number; zoomSpeed: number };

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
                console.error("[hex-render] camera cleanup failed", err);
            }
        },
    };
}

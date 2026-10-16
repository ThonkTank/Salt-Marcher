import { hexDistanceMeters } from "./hex";
import type { WorldPoint } from "./overworld";
export interface AtlasCamera {
  readonly center: WorldPoint;
  readonly metersPerPixel: number;
}
export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}
export function initialAtlasCamera(origin: WorldPoint): AtlasCamera {
  return { center: { ...origin }, metersPerPixel: hexDistanceMeters(0) / 96 };
}
export function worldToScreen(
  camera: AtlasCamera,
  viewport: ViewportSize,
  p: WorldPoint,
): WorldPoint {
  return {
    x: viewport.width / 2 + (p.x - camera.center.x) / camera.metersPerPixel,
    y: viewport.height / 2 + (p.y - camera.center.y) / camera.metersPerPixel,
  };
}
export function screenToWorld(
  camera: AtlasCamera,
  viewport: ViewportSize,
  p: WorldPoint,
): WorldPoint {
  return {
    x: camera.center.x + (p.x - viewport.width / 2) * camera.metersPerPixel,
    y: camera.center.y + (p.y - viewport.height / 2) * camera.metersPerPixel,
  };
}
export function panAtlas(
  camera: AtlasCamera,
  dx: number,
  dy: number,
): AtlasCamera {
  return {
    ...camera,
    center: {
      x: camera.center.x - dx * camera.metersPerPixel,
      y: camera.center.y - dy * camera.metersPerPixel,
    },
  };
}
export function zoomAtlas(
  camera: AtlasCamera,
  viewport: ViewportSize,
  anchor: WorldPoint,
  factor: number,
): AtlasCamera {
  if (!Number.isFinite(factor) || factor <= 0)
    throw new Error("Ungültiger Zoom.");
  const before = screenToWorld(camera, viewport, anchor),
    metersPerPixel = Math.min(
      1e15,
      Math.max(0.005, camera.metersPerPixel * factor),
    );
  const after = screenToWorld({ ...camera, metersPerPixel }, viewport, anchor);
  return {
    metersPerPixel,
    center: {
      x: camera.center.x + before.x - after.x,
      y: camera.center.y + before.y - after.y,
    },
  };
}

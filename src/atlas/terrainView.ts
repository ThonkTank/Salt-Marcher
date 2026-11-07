import { terrainImage } from "./terrainRaster";
import { CACHE_BUDGETS, TERRAIN_RASTER_BYTES } from "./cacheBudgets";
import { tileRequest } from "./lod";
import type { TerrainResponse } from "./generated/TerrainResponse";
import type { TerrainArgs } from "./generated/TerrainArgs";
import type { TerrainPreview } from "./generated/TerrainPreview";
import type { Bounds } from "./model";

export function terrainRequest(
  bounds: Bounds,
  level: number,
  scale?: number,
  dpr = globalThis.devicePixelRatio || 1,
): TerrainArgs {
  const request = tileRequest(bounds, level, 160, 21);
  const pixels =
    scale === undefined
      ? 512
      : Math.max(
          128,
          Math.min(
            1024,
            2 **
              Math.floor(
                Math.log2(
                  Math.sqrt(
                    (CACHE_BUDGETS.terrain.bytes -
                      TERRAIN_RASTER_BYTES.materials * request.tiles.length) /
                      (TERRAIN_RASTER_BYTES.request *
                        Math.max(1, request.tiles.length)),
                  ),
                ),
              ),
            2 ** Math.ceil(Math.log2(160 * 2 ** request.level * scale * dpr)),
          ),
        );
  return {
    ...request,
    pixels,
    contourInterval:
      5 *
      2 **
        Math.max(
          0,
          Math.ceil(
            Math.log2(0.4 / (scale ?? pixels / (160 * 2 ** request.level))),
          ),
        ),
  };
}
export class TerrainPainter {
  paintContours(
    c: CanvasRenderingContext2D,
    view: TerrainResponse,
    scale: number,
    preview?: TerrainPreview,
  ) {
    const source = preview?.surface ?? view;
    c.lineWidth = 0.7 / scale;
    c.strokeStyle = "#55674e80";
    for (const tile of source.tiles) {
      c.beginPath();
      for (const [x, y, u, v] of tile.raster?.contours ?? []) {
        c.moveTo(x, y);
        c.lineTo(u, v);
      }
      c.stroke();
    }
  }
  paint(
    c: CanvasRenderingContext2D,
    view: TerrainResponse,
    scale: number,
    contours: boolean,
    preview?: TerrainPreview,
    waterOnly = false,
  ) {
    const source = preview?.surface ?? view;
    const width = 160 * 2 ** source.level;
    const transform = c.getTransform();
    for (const tile of source.tiles) {
      if (!tile.raster) continue;
      // Shared device-pixel edges avoid antialiased clip gaps and alpha overlaps.
      // The axis-aligned editor camera moves an edge by at most half a device pixel.
      const x =
        (Math.round(tile.x * width * transform.a + transform.e) - transform.e) /
        transform.a;
      const y =
        (Math.round(tile.y * width * transform.d + transform.f) - transform.f) /
        transform.d;
      const right =
        (Math.round((tile.x + 1) * width * transform.a + transform.e) -
          transform.e) /
        transform.a;
      const bottom =
        (Math.round((tile.y + 1) * width * transform.d + transform.f) -
          transform.f) /
        transform.d;
      const image = terrainImage(tile, waterOnly);
      const border = image.width === 1 ? 0 : 1;
      const pixels = image.width === 1 ? 1 : tile.raster.pixels;
      c.drawImage(
        image,
        border,
        border,
        pixels,
        pixels,
        x,
        y,
        right - x,
        bottom - y,
      );
    }
    if (!waterOnly && contours) this.paintContours(c, source, scale);
  }
}

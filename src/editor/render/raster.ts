import { heightFromScaledSum } from "../model/height";
import { WORLD_LIMIT, type Bounds } from "../model/types";
import type { RasterRect } from "../model/height-grid";

export const MAX_RASTER_BATCH_TILES = 16;
export const MAX_RASTER_BATCH_PIXELS = 128 * 1024;

/** Exact height is sampled first; colour is a pure display classification. */
export function colour(height: number): [number, number, number] {
  if (height < 0) {
    const depth = Math.min(1, -height / 300);
    return [
      Math.round(94 - 53 * depth),
      Math.round(147 - 57 * depth),
      Math.round(166 - 44 * depth),
    ];
  }
  if (height < 12) return [201, 192, 144];
  const shade = Math.min(1, height / 600);
  return [
    Math.round(132 + 60 * shade),
    Math.round(151 + 34 * shade),
    Math.round(103 + 64 * shade),
  ];
}

export function rasterize(
  scaledHeights: Float64Array,
  bounds: Bounds,
  size: number,
  rect: RasterRect,
  fineHeights?: Float64Array,
): Uint8Array {
  const [x0, y0, x1, y1] = rect;
  const width = x1 - x0,
    height = y1 - y0;
  const pixels = new Uint8Array(width * height * 4);
  if (scaledHeights.length !== width * height)
    throw new Error("Unvollständige Höhenwerte für das Darstellungsraster.");
  if (fineHeights && fineHeights.length !== size * size)
    throw new Error("Unvollständige numerische Höhenübersicht.");
  const stepX = (bounds[2] - bounds[0]) / size;
  const stepY = (bounds[3] - bounds[1]) / size;
  for (let row = 0; row < height; row++) {
    const y = bounds[1] + (y0 + row + 0.5) * stepY;
    for (let column = 0; column < width; column++) {
      const x = bounds[0] + (x0 + column + 0.5) * stepX;
      const i = (row * width + column) * 4;
      // Preserve the canonical mesh at the world edge; never stretch the last
      // tile's sample spacing to fit its clipped drawable/query bounds.
      if (Math.abs(x) > WORLD_LIMIT || Math.abs(y) > WORLD_LIMIT) continue;
      const fine = fineHeights?.[(y0 + row) * size + x0 + column] ?? 0;
      const rgb = colour(
        heightFromScaledSum(scaledHeights[row * width + column] + fine),
      );
      pixels[i] = rgb[0];
      pixels[i + 1] = rgb[1];
      pixels[i + 2] = rgb[2];
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

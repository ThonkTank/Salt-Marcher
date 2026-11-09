import { heightFromScaledSum } from "../model/height";
import { WORLD_LIMIT, type Bounds } from "../model/types";
import type { RasterRect } from "../model/height-grid";

/** Display classification only; document values and exact queries stay Float64. */
export const DISPLAY_HEIGHT_BOUNDARY_EPSILON = 1e-6;

export function stabilizeDisplayHeight(height: number): number {
  if (Math.abs(height) <= DISPLAY_HEIGHT_BOUNDARY_EPSILON) return 0;
  if (Math.abs(height - 12) <= DISPLAY_HEIGHT_BOUNDARY_EPSILON) return 12;
  return height;
}

/** Exact height is classified directly into the image, without a tuple per pixel. */
function writeColour(height: number, pixels: Uint8Array, offset: number): void {
  height = stabilizeDisplayHeight(height);
  if (height < 0) {
    const depth = Math.min(1, -height / 300);
    pixels[offset] = Math.round(94 - 53 * depth);
    pixels[offset + 1] = Math.round(147 - 57 * depth);
    pixels[offset + 2] = Math.round(166 - 44 * depth);
  } else if (height < 12) {
    pixels[offset] = 201;
    pixels[offset + 1] = 192;
    pixels[offset + 2] = 144;
  } else {
    const shade = Math.min(1, height / 600);
    pixels[offset] = Math.round(132 + 60 * shade);
    pixels[offset + 1] = Math.round(151 + 34 * shade);
    pixels[offset + 2] = Math.round(103 + 64 * shade);
  }
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
      writeColour(
        heightFromScaledSum(scaledHeights[row * width + column] + fine),
        pixels,
        i,
      );
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

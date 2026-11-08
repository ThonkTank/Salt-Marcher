import {
  HEIGHT_SUM_SCALE,
  prepareScaledHeightSum,
  splineWeights,
} from "./height";
import {
  HEIGHT_BASE,
  HEIGHT_TILE_SIZE,
  WORLD_LIMIT,
  heightSpacing,
  heightTileSupport,
  intersectsBounds,
  validateHeightTile,
  type Bounds,
  type HeightTile,
} from "./types";

export type RasterRect = [number, number, number, number];

interface GridLevel {
  step: number;
  bounds: Bounds;
  rows: Map<number, Map<number, Float64Array>>;
}

/**
 * The same positive cubic height sum on a regular display mesh. A control row's
 * horizontal contribution is reused by adjacent pixel rows, instead of repeating
 * sixteen map lookups and both cubic bases for every pixel. Values stay scaled
 * and unclamped so finer overview contributions can be added before one clamp.
 */
export function prepareHeightGrid(
  tiles: readonly HeightTile[],
): (bounds: Bounds, size: number, rect: RasterRect) => Float64Array {
  const indexed = new Map<number, GridLevel>();
  for (const tile of tiles) {
    validateHeightTile(tile);
    const support = heightTileSupport(tile);
    let level = indexed.get(tile.level);
    if (!level) {
      level = {
        step: heightSpacing(tile.level),
        bounds: support,
        rows: new Map(),
      };
      indexed.set(tile.level, level);
    } else {
      level.bounds = [
        Math.min(level.bounds[0], support[0]),
        Math.min(level.bounds[1], support[1]),
        Math.max(level.bounds[2], support[2]),
        Math.max(level.bounds[3], support[3]),
      ];
    }
    let row = level.rows.get(tile.tileY);
    if (!row) level.rows.set(tile.tileY, (row = new Map()));
    if (row.has(tile.tileX)) throw new Error("Doppelte Höhenkachel im Raster.");
    row.set(tile.tileX, tile.values);
  }
  const levels = [...indexed.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, level]) => level);
  // Extreme cancelling coefficients must retain the canonical accumulation
  // order: regrouping those values can change even the final saturated sign.
  const exceptional = tiles.some((tile) =>
    tile.values.some((value) => Math.abs(value) > 1e290),
  )
    ? prepareScaledHeightSum(tiles)
    : null;

  return (bounds, size, rect) => {
    const [x0, y0, x1, y1] = rect;
    const width = x1 - x0;
    const height = y1 - y0;
    const values = new Float64Array(width * height).fill(
      HEIGHT_BASE / HEIGHT_SUM_SCALE,
    );
    const stepX = (bounds[2] - bounds[0]) / size;
    const stepY = (bounds[3] - bounds[1]) / size;
    if (exceptional) {
      for (let row = 0; row < height; row++)
        for (let column = 0; column < width; column++) {
          const x = bounds[0] + (x0 + column + 0.5) * stepX;
          const y = bounds[1] + (y0 + row + 0.5) * stepY;
          if (Math.abs(x) <= WORLD_LIMIT && Math.abs(y) <= WORLD_LIMIT)
            values[row * width + column] = exceptional(x, y);
        }
      return values;
    }
    const active: Bounds = [
      bounds[0] + x0 * stepX,
      bounds[1] + y0 * stepY,
      bounds[0] + x1 * stepX,
      bounds[1] + y1 * stepY,
    ];
    for (const level of levels) {
      if (!intersectsBounds(active, level.bounds)) continue;
      const indices = new Float64Array(width);
      const weights = new Float64Array(width * 4);
      for (let column = 0; column < width; column++) {
        const x = bounds[0] + (x0 + column + 0.5) * stepX;
        const gx = x / level.step;
        const ix = Math.floor(gx);
        indices[column] = ix;
        weights.set(
          splineWeights((x - ix * level.step) / level.step),
          column * 4,
        );
      }
      // At most the four control rows supporting the current pixel row survive.
      const horizontal = new Map<number, Float64Array>();
      for (let row = 0; row < height; row++) {
        const y = bounds[1] + (y0 + row + 0.5) * stepY;
        if (y <= level.bounds[1] || y >= level.bounds[3]) continue;
        const gy = y / level.step;
        const iy = Math.floor(gy);
        const wy = splineWeights((y - iy * level.step) / level.step);
        for (const key of horizontal.keys())
          if (key < iy - 1) horizontal.delete(key);
        for (let j = 0; j < 4; j++) {
          const cy = iy + j - 1;
          if (!wy[j] || Math.abs(cy * level.step) > WORLD_LIMIT) continue;
          const tileY = Math.floor(cy / HEIGHT_TILE_SIZE);
          const controls = level.rows.get(tileY);
          if (!controls) continue;
          let projected = horizontal.get(cy);
          if (!projected) {
            projected = new Float64Array(width);
            const offset = (cy - tileY * HEIGHT_TILE_SIZE) * HEIGHT_TILE_SIZE;
            for (let column = 0; column < width; column++) {
              const ix = indices[column];
              let sum = 0;
              for (let i = 0; i < 4; i++) {
                const weight = weights[column * 4 + i];
                const cx = ix + i - 1;
                if (!weight || Math.abs(cx * level.step) > WORLD_LIMIT)
                  continue;
                const tileX = Math.floor(cx / HEIGHT_TILE_SIZE);
                const source = controls.get(tileX);
                if (source)
                  sum +=
                    (source[offset + cx - tileX * HEIGHT_TILE_SIZE] /
                      HEIGHT_SUM_SCALE) *
                    weight;
              }
              projected[column] = sum;
            }
            horizontal.set(cy, projected);
          }
          for (let column = 0; column < width; column++)
            values[row * width + column] += projected[column] * wy[j];
        }
      }
    }
    return values;
  };
}

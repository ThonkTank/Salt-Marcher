import {
  HEIGHT_TILE_CELLS,
  assertPoint,
  heightControlAddress,
  heightSpacing,
  validateHeightTile,
  type Bounds,
  type HeightTile,
  type Point,
} from "./types";

/** Small genuine author fixtures; values are not generated display textures. */
export function heightTilesFromControls(
  level: number,
  controls: Iterable<readonly [number, number, number]>,
  revision = 0,
): HeightTile[] {
  const step = heightSpacing(level);
  const tiles = new Map<string, HeightTile>();
  for (const [x, y, value] of controls) {
    assertPoint([x * step, y * step]);
    if (!Number.isFinite(value))
      throw new RangeError("Relative Höhe ist nicht endlich.");
    const { key, tileX, tileY, index } = heightControlAddress(level, x, y);
    let tile = tiles.get(key);
    if (!tile) {
      if (value === 0) continue;
      tile = {
        key,
        level,
        tileX,
        tileY,
        revision,
        values: new Float64Array(HEIGHT_TILE_CELLS),
      };
      tiles.set(key, tile);
    }
    tile.values[index] = value;
  }
  const result = [...tiles.values()].filter((tile) =>
    tile.values.some((v) => v !== 0),
  );
  result.forEach(validateHeightTile);
  return result;
}

export const COAST_FIXTURE_BOUNDS: Bounds = [-1800, -900, 1800, 900];
export const TRENCH_POINT: Point = [320, 0];
export const TRENCH_REFERENCE_POINT: Point = [420, 0];
export const COAST_POINT: Point = [-400, 0];

/**
 * A planar coastal patch on level 4 and an optional level-0 trench crossing the
 * x=320-foot tile boundary. The central plane gives a directly checkable coast.
 * Its finite outer border is deliberately visible when zooming far enough out.
 */
export function createCoastFixture(
  options: { origin?: Point; trench?: boolean } = {},
): HeightTile[] {
  const origin = options.origin ?? [0, 0];
  assertPoint(origin);
  const step = heightSpacing(4);
  if (origin.some((v) => v % step !== 0))
    throw new RangeError(
      "Küstenfixture benötigt einen Ursprung auf dem 80-Fuß-Raster.",
    );
  const coarse: [number, number, number][] = [];
  for (let y = -16; y <= 16; y++)
    for (let x = -32; x <= 32; x++) {
      const value = Math.max(0, 120 + 0.05 * x * step);
      coarse.push([origin[0] / step + x, origin[1] / step + y, value]);
    }
  const tiles = heightTilesFromControls(4, coarse);
  if (options.trench ?? true) {
    const fine: [number, number, number][] = [];
    for (let y = -16; y <= 16; y++)
      for (let x = 57; x <= 71; x++) {
        const dx = (x - 64) / 8;
        const end = Math.min(1, Math.max(0, (16 - Math.abs(y)) / 4));
        fine.push([
          origin[0] / 5 + x,
          origin[1] / 5 + y,
          -30 * (1 - dx * dx) ** 2 * end,
        ]);
      }
    tiles.push(...heightTilesFromControls(0, fine));
  }
  return tiles;
}

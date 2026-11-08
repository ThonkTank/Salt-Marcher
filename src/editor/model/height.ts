import {
  HEIGHT_BASE,
  HEIGHT_LIMIT,
  HEIGHT_TILE_SIZE,
  WORLD_LIMIT,
  assertBounds,
  heightSpacing,
  heightTileSupport,
  validateHeightTile,
  type Bounds,
  type HeightSnapshot,
  type HeightTile,
} from "./types";

/** The positive cubic basis from src-tauri/src/atlas/terrain.rs. */
export function splineWeights(t: number): [number, number, number, number] {
  if (!Number.isFinite(t) || t < 0 || t > 1)
    throw new RangeError("Kubischer Parameter muss zwischen 0 und 1 liegen.");
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    (1 - t) ** 3 / 6,
    (3 * t3 - 6 * t2 + 4) / 6,
    (-3 * t3 + 3 * t2 + 3 * t + 1) / 6,
    t3 / 6,
  ];
}

interface PreparedLevel {
  step: number;
  bounds: Bounds;
  rows: Map<number, Map<number, Float64Array>>;
}

/**
 * Compile one complete sparse snapshot. The hot loop visits present levels only;
 * it uses numeric row/column indexes and never formats a key per pixel.
 * Call EditorDocument.snapshot first to prove local completeness. A raw tile list
 * is useful for an immutable, already-complete worker payload or a unit fixture.
 */
export function prepareHeightSampler(
  source: readonly HeightTile[] | HeightSnapshot,
  bounds?: Bounds,
): (x: number, y: number) => number {
  const tiles: readonly HeightTile[] = Array.isArray(source)
    ? source
    : (source as HeightSnapshot).tiles;
  const sampleBounds =
    bounds ??
    (Array.isArray(source) ? undefined : (source as HeightSnapshot).bounds);
  if (sampleBounds) assertBounds(sampleBounds);
  const indexed = new Map<number, PreparedLevel>();
  let largeValues = false;
  for (const tile of tiles) {
    validateHeightTile(tile);
    // Ordinary terrain stays in the faster uncompensated path. Scaling the
    // exceptional path prevents finite residuals overflowing before cancellation.
    if (!largeValues && tile.values.some((v) => Math.abs(v) > 1e290))
      largeValues = true;
    let level = indexed.get(tile.level);
    const support = heightTileSupport(tile);
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
    if (row.has(tile.tileX))
      throw new Error("Doppelte Höhenkachel im Snapshot.");
    row.set(tile.tileX, tile.values);
  }
  // Coarse-to-fine order is deterministic; clamp only after the complete sum.
  const levels = [...indexed.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, level]) => level);
  const divisor = largeValues ? levels.length + 1 : 1;
  return (x, y) => {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      Math.abs(x) > WORLD_LIMIT ||
      Math.abs(y) > WORLD_LIMIT
    )
      throw new RangeError("Ungültiger Abfragepunkt.");
    if (
      sampleBounds &&
      (x < sampleBounds[0] ||
        x > sampleBounds[2] ||
        y < sampleBounds[1] ||
        y > sampleBounds[3])
    )
      throw new RangeError("Abfrage außerhalb des bestätigten Snapshots.");
    let value = HEIGHT_BASE / divisor;
    for (const level of levels) {
      if (
        x <= level.bounds[0] ||
        x >= level.bounds[2] ||
        y <= level.bounds[1] ||
        y >= level.bounds[3]
      )
        continue;
      const gx = x / level.step;
      const gy = y / level.step;
      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      const tx = gx - ix;
      const ty = gy - iy;
      const tx2 = tx * tx,
        tx3 = tx2 * tx;
      const ty2 = ty * ty,
        ty3 = ty2 * ty;
      const wx = [
        (1 - tx) ** 3 / 6,
        (3 * tx3 - 6 * tx2 + 4) / 6,
        (-3 * tx3 + 3 * tx2 + 3 * tx + 1) / 6,
        tx3 / 6,
      ];
      const wy = [
        (1 - ty) ** 3 / 6,
        (3 * ty3 - 6 * ty2 + 4) / 6,
        (-3 * ty3 + 3 * ty2 + 3 * ty + 1) / 6,
        ty3 / 6,
      ];
      for (let j = 0; j < 4; j++) {
        if (wy[j] === 0) continue;
        const cy = iy + j - 1;
        if (Math.abs(cy * level.step) > WORLD_LIMIT) continue;
        const tileY = Math.floor(cy / HEIGHT_TILE_SIZE);
        const row = level.rows.get(tileY);
        if (!row) continue;
        const rowOffset = (cy - tileY * HEIGHT_TILE_SIZE) * HEIGHT_TILE_SIZE;
        for (let i = 0; i < 4; i++) {
          if (wx[i] === 0) continue;
          const cx = ix + i - 1;
          if (Math.abs(cx * level.step) > WORLD_LIMIT) continue;
          const tileX = Math.floor(cx / HEIGHT_TILE_SIZE);
          const values = row.get(tileX);
          if (values)
            value +=
              (values[rowOffset + cx - tileX * HEIGHT_TILE_SIZE] / divisor) *
              wx[i] *
              wy[j];
        }
      }
    }
    return Math.max(-HEIGHT_LIMIT, Math.min(HEIGHT_LIMIT, value * divisor));
  };
}

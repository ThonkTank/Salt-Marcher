import {
  HEIGHT_BASE,
  HEIGHT_LIMIT,
  HEIGHT_TILE_SIZE,
  WORLD_LIMIT,
  assertBounds,
  assertPoint,
  clipBounds,
  heightSpacing,
  heightTileSupport,
  validateHeightTile,
  type Bounds,
  type HeightBrush,
  type HeightSnapshot,
  type HeightTile,
  type Point,
} from "./types";

/** Complete explicit segment support, including the cubic reconstruction halo. */
export function heightBrushReadBounds(
  brush: Pick<HeightBrush, "level" | "radius">,
  from: Point,
  to: Point,
): Bounds {
  assertPoint(from);
  assertPoint(to);
  if (!Number.isFinite(brush.radius) || brush.radius <= 0)
    throw new RangeError("Ungültiger Höhenpinsel.");
  const halo = brush.radius + 2 * heightSpacing(brush.level);
  return clipBounds([
    Math.min(from[0], to[0]) - halo,
    Math.min(from[1], to[1]) - halo,
    Math.max(from[0], to[0]) + halo,
    Math.max(from[1], to[1]) + halo,
  ]);
}

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

/** Integral of the quartic brush along one segment, in world-length units. */
export function quarticBrushSegmentIntegral(
  along: number,
  perpendicular: number,
  length: number,
  radius: number,
): number {
  return quarticBrushSegment(along, perpendicular, length, radius, false);
}

/** Mean over a nonzero segment; stationary stamps are handled by the caller. */
export function quarticBrushSegmentMean(
  along: number,
  perpendicular: number,
  length: number,
  radius: number,
): number {
  return quarticBrushSegment(along, perpendicular, length, radius, true);
}

function quarticBrushSegment(
  along: number,
  perpendicular: number,
  length: number,
  radius: number,
  mean: boolean,
): number {
  const distance = Math.abs(perpendicular) / radius;
  if (distance >= 1 || length <= 0) return 0;
  const h = (1 - distance) * (1 + distance);
  // A segment lies entirely inside the circle exactly when both endpoints do.
  // Dense short movements therefore need neither a square root nor clipping.
  // Keep division: reciprocal radii can overflow for valid subnormal radii.
  const contained =
    length <= 2 * radius &&
    (Math.max(Math.abs(along), Math.abs(length - along)) / radius) ** 2 <= h;
  let lower = 0;
  let span = length;
  let scale = mean ? 1 : length;
  if (!contained) {
    // Preserve world-coordinate clipping and its stable midpoint for long or
    // partially supported segments; only the final integral/mean scale differs.
    const reach = radius * Math.sqrt(h);
    lower = Math.max(0, along - reach);
    const upper = Math.min(length, along + reach);
    if (lower >= upper) return 0;
    span = upper - lower;
    scale = mean ? span / length : span;
  }
  const midpoint = (lower - along + span / 2) / radius;
  const halfWidth = span / (2 * radius);
  const m2 = midpoint * midpoint;
  const v2 = halfWidth * halfWidth;
  const a = h - m2;
  // Integrate around the midpoint instead of subtracting nearly equal values
  // of h²u - 2hu³/3 + u⁵/5 at the ends of a short movement.
  return scale * (a * a + (2 * m2 - (2 * h) / 3) * v2 + (v2 * v2) / 5);
}

interface PreparedLevel {
  step: number;
  bounds: Bounds;
  rows: Map<number, Map<number, Float64Array>>;
}

/** Binary scaling keeps all 22 finite level contributions below overflow. */
export const HEIGHT_SUM_SCALE = 32;

/** Clamp only the complete sum, after fine and coarse contributions are combined. */
export function heightFromScaledSum(sum: number): number {
  return (
    Math.max(
      -HEIGHT_LIMIT / HEIGHT_SUM_SCALE,
      Math.min(HEIGHT_LIMIT / HEIGHT_SUM_SCALE, sum),
    ) * HEIGHT_SUM_SCALE
  );
}

/**
 * Compile one complete sparse snapshot. The hot loop visits present levels only;
 * it uses numeric row/column indexes and never formats a key per pixel.
 * Call EditorDocument.snapshot first to prove local completeness. A raw tile list
 * is useful for an immutable, already-complete worker payload or a unit fixture.
 */
export function prepareScaledHeightSum(
  source: readonly HeightTile[] | HeightSnapshot,
  bounds?: Bounds,
): (x: number, y: number) => number {
  const setup = prepareScaledHeightSumSteps(source, bounds);
  let next = setup.next();
  while (!next.done) next = setup.next();
  return next.value;
}

/** Same canonical sampler, with a cancellation/yield point after each source. */
export function* prepareScaledHeightSumSteps(
  source: readonly HeightTile[] | HeightSnapshot,
  bounds?: Bounds,
): Generator<void, (x: number, y: number) => number> {
  const tiles: readonly HeightTile[] = Array.isArray(source)
    ? source
    : (source as HeightSnapshot).tiles;
  const sampleBounds =
    bounds ??
    (Array.isArray(source) ? undefined : (source as HeightSnapshot).bounds);
  if (sampleBounds) assertBounds(sampleBounds);
  const indexed = new Map<number, PreparedLevel>();
  for (const tile of tiles) {
    validateHeightTile(tile);
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
    yield;
  }
  // Coarse-to-fine order is deterministic; clamp only after the complete sum.
  const levels = [...indexed.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, level]) => level);
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
    let value = HEIGHT_BASE / HEIGHT_SUM_SCALE;
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
      // Subtract the integer world origin before dividing to retain precision
      // near the world edge, just as the GPU camera transform does.
      const tx = (x - ix * level.step) / level.step;
      const ty = (y - iy * level.step) / level.step;
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
              (values[rowOffset + cx - tileX * HEIGHT_TILE_SIZE] /
                HEIGHT_SUM_SCALE) *
              wx[i] *
              wy[j];
        }
      }
    }
    return value;
  };
}

export function prepareHeightSampler(
  source: readonly HeightTile[] | HeightSnapshot,
  bounds?: Bounds,
): (x: number, y: number) => number {
  const sum = prepareScaledHeightSum(source, bounds);
  return (x, y) => heightFromScaledSum(sum(x, y));
}

import {
  WORLD_LIMIT,
  HEIGHT_TILE_CELLS,
  HEIGHT_TILE_SIZE,
  assertLevel,
  assertPoint,
  clipBounds,
  heightTileKey,
  heightSpacing,
  type Bounds,
  type CoastBrush,
  type Point,
} from "./types";

/** A 512 px coast brush at the V7 two-pixel grid must fit one ordinary stamp. */
export const COAST_BATCH_CELL_LIMIT = 300_000;
export const COAST_BATCH_POINT_LIMIT = 64;

export function validateCoastBrush(brush: CoastBrush): void {
  assertLevel(brush.level);
  if (
    (brush.mode !== "land" && brush.mode !== "sea") ||
    !Number.isFinite(brush.radius) ||
    brush.radius <= 0 ||
    !Number.isFinite(brush.roughness) ||
    brush.roughness < 0 ||
    brush.roughness > 1
  )
    throw new RangeError("Ungültiger Land-/Meerpinsel.");
  if (((2 * brush.radius) / heightSpacing(brush.level) + 7) ** 2 > 400_000)
    throw new RangeError(
      "Land-/Meerpinsel zu groß; eine gröbere Autorenstufe wählen.",
    );
}

/** Two target-control steps outside the disk, plus their cubic support halo. */
export function coastBrushReadBounds(
  brush: Pick<CoastBrush, "level" | "radius">,
  from: Point,
  to: Point,
): Bounds {
  assertPoint(from);
  assertPoint(to);
  if (!Number.isFinite(brush.radius) || brush.radius <= 0)
    throw new RangeError("Ungültiger Küstenradius.");
  const halo = brush.radius + 4 * heightSpacing(brush.level);
  return clipBounds([
    Math.min(from[0], to[0]) - halo,
    Math.min(from[1], to[1]) - halo,
    Math.max(from[0], to[0]) + halo,
    Math.max(from[1], to[1]) + halo,
  ]);
}

function coastSegmentArea(
  brush: Pick<CoastBrush, "level" | "radius">,
  from: Point,
  to: Point,
) {
  assertPoint(from);
  assertPoint(to);
  const step = heightSpacing(brush.level);
  if (!Number.isFinite(brush.radius) || brush.radius <= 0)
    throw new RangeError("Ungültiger Küstenradius.");
  const pad = brush.radius + 2 * step;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const axis = Math.abs(dx) >= Math.abs(dy) ? 0 : 1;
  const cross = 1 - axis;
  const start = Math.ceil(
    Math.max(-WORLD_LIMIT, Math.min(from[axis], to[axis]) - pad) / step,
  );
  const end = Math.floor(
    Math.min(WORLD_LIMIT, Math.max(from[axis], to[axis]) + pad) / step,
  );
  return { step, pad, dx, dy, axis, cross, start, end };
}

/** Constant-time upper bound for strip enumeration, including diagonal paths. */
export function coastSegmentCellCost(
  brush: Pick<CoastBrush, "level" | "radius">,
  from: Point,
  to: Point,
): number {
  const { step, pad, axis, cross, start, end } = coastSegmentArea(
    brush,
    from,
    to,
  );
  const major = Math.abs(to[axis] - from[axis]);
  const minor = Math.abs(to[cross] - from[cross]);
  const width = 2 * pad + (major ? minor * Math.min(1, (2 * pad) / major) : 0);
  return Math.max(0, end - start + 1) * (Math.ceil(width / step) + 1);
}

function coastNoise(x: number, y: number): number {
  const value = (cx: number, cy: number) => {
    let h = Math.imul(cx, 374761393) ^ Math.imul(cy, 668265263) ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
  };
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const tx = smooth(x - ix);
  const ty = smooth(y - iy);
  const low = value(ix, iy) + (value(ix + 1, iy) - value(ix, iy)) * tx;
  const high =
    value(ix, iy + 1) + (value(ix + 1, iy + 1) - value(ix, iy + 1)) * tx;
  return low + (high - low) * ty;
}

/** The continuous V7 coast field; no event-dependent or per-stamp random seed. */
export function coastInset(
  brush: Pick<CoastBrush, "radius" | "roughness">,
  point: Point,
): number {
  return insetAt(brush, point[0], point[1]);
}

function insetAt(
  brush: Pick<CoastBrush, "radius" | "roughness">,
  px: number,
  py: number,
): number {
  if (brush.roughness === 0) return 0;
  const x = px / brush.radius;
  const y = py / brush.radius;
  const noise =
    0.2 * coastNoise(x * 1.5 + 17.3, y * 1.5 - 43.7) +
    0.5 * coastNoise(x * 4.5 + 17.3, y * 4.5 - 43.7) +
    0.3 * coastNoise(x * 11 + 17.3, y * 11 - 43.7);
  return (
    brush.radius *
    brush.roughness *
    0.6 *
    Math.max(0, Math.min(1, (noise - 0.5) * 1.8 + 0.5))
  );
}

export interface CoastControls {
  key: string;
  tileX: number;
  tileY: number;
  profile: Float64Array;
  /** Zero is outside the swept support; one is a candidate. */
  mask: Uint8Array;
  count: number;
}

/** Bounded spatial planning only; no source access, mutation or timing policy. */
export function prepareCoastControls(
  brush: CoastBrush,
  points: readonly Point[],
) {
  validateCoastBrush(brush);
  if (!points.length || points.length > COAST_BATCH_POINT_LIMIT + 1)
    throw new RangeError("Ungültige Anzahl Küstenpunkte im Arbeitsabschnitt.");
  points.forEach(assertPoint);
  const segments = [];
  let cost = 0;
  for (let i = 0; i < Math.max(1, points.length - 1); i++) {
    const from = points[i];
    const to = points[Math.min(i + 1, points.length - 1)];
    cost += coastSegmentCellCost(brush, from, to);
    if (cost > COAST_BATCH_CELL_LIMIT)
      throw new RangeError(
        "Küstenabschnitt überschreitet den begrenzten Arbeitsbereich.",
      );
    segments.push({ ...coastSegmentArea(brush, from, to), from, to });
  }
  const byTile = new Map<string, CoastControls>();
  const rows = new Map<number, Map<number, CoastControls>>();
  for (const {
    from,
    to,
    step,
    pad,
    dx,
    dy,
    axis,
    cross,
    start,
    end,
  } of segments) {
    const delta = to[axis] - from[axis];
    const length2 = dx * dx + dy * dy;
    for (let major = start; major <= end; major++) {
      const position = major * step;
      let low = 0;
      let high = 1;
      if (delta) {
        const t0 = (position - pad - from[axis]) / delta;
        const t1 = (position + pad - from[axis]) / delta;
        low = Math.max(0, Math.min(t0, t1));
        high = Math.min(1, Math.max(t0, t1));
      }
      if (low > high) continue;
      const c0 = from[cross] + (to[cross] - from[cross]) * low;
      const c1 = from[cross] + (to[cross] - from[cross]) * high;
      const first = Math.ceil(
        Math.max(-WORLD_LIMIT, Math.min(c0, c1) - pad) / step,
      );
      const last = Math.floor(
        Math.min(WORLD_LIMIT, Math.max(c0, c1) + pad) / step,
      );
      for (let minor = first; minor <= last; minor++) {
        const cx = axis === 0 ? major : minor;
        const cy = axis === 0 ? minor : major;
        const x = cx * step;
        const y = cy * step;
        const t = length2
          ? Math.max(
              0,
              Math.min(1, ((x - from[0]) * dx + (y - from[1]) * dy) / length2),
            )
          : 0;
        const distance = Math.hypot(x - from[0] - t * dx, y - from[1] - t * dy);
        if (distance >= pad) continue;
        const tileX = Math.floor(cx / HEIGHT_TILE_SIZE);
        const tileY = Math.floor(cy / HEIGHT_TILE_SIZE);
        let row = rows.get(tileY);
        if (!row) rows.set(tileY, (row = new Map()));
        let cells = row.get(tileX);
        if (!cells) {
          const key = heightTileKey(brush.level, tileX, tileY);
          cells = {
            key,
            tileX,
            tileY,
            profile: new Float64Array(HEIGHT_TILE_CELLS),
            mask: new Uint8Array(HEIGHT_TILE_CELLS),
            count: 0,
          };
          row.set(tileX, cells);
          byTile.set(key, cells);
        }
        const index =
          (cy - tileY * HEIGHT_TILE_SIZE) * HEIGHT_TILE_SIZE +
          cx -
          tileX * HEIGHT_TILE_SIZE;
        const profile = Math.max(
          -10,
          Math.min(
            10,
            ((brush.radius - distance - insetAt(brush, x, y)) / step) * 10,
          ),
        );
        if (cells.mask[index])
          cells.profile[index] = Math.max(cells.profile[index], profile);
        else {
          cells.mask[index] = 1;
          cells.profile[index] = profile;
          cells.count++;
        }
      }
    }
  }
  return {
    byTile,
    readBounds: segments.map(({ from, to }) =>
      coastBrushReadBounds(brush, from, to),
    ),
  };
}

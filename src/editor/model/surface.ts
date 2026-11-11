import {
  heightFromScaledSum,
  prepareScaledHeightSumSteps,
  HEIGHT_SUM_SCALE,
} from "./height";
import {
  houseBounds,
  houseContainsPoint,
  houseCorners,
  validateHouseHeader,
  type HouseHeader,
} from "./house";
import {
  RIVER_SAMPLE_SUPPORT,
  lakeContainsPoint,
  type RiverSample,
  type WaterSource,
} from "./water";
import {
  HEIGHT_BASE,
  HEIGHT_LEVELS,
  HEIGHT_LIMIT,
  HEIGHT_TILE_SIZE,
  WORLD_LIMIT,
  assertPoint,
  clipBounds,
  heightSpacing,
  type Bounds,
  type HeightSnapshot,
  type Point,
} from "./types";

export type HeightSampler = (x: number, y: number) => number;
export const FOUNDATION_TOLERANCE_FT = 1e-4;
export const FOUNDATION_MAX_RETAINED_CONTROLS = 8192;

export interface FoundationResult {
  houseId: string;
  status: "current" | "unknown";
  baseLower: number;
  baseUpper: number;
  topLower: number;
  topUpper: number;
  toleranceFt: number;
  nodes: number;
  controlSteps: number;
  reason?: "sources" | "budget" | "precision";
}

export interface FoundationOptions {
  toleranceFt?: number;
  maxNodes?: number;
  maxControlSteps?: number;
  maxRetainedControls?: number;
}

export function projectRiverPoint(
  point: Point,
  a: Point,
  b: Point,
): {
  t: number;
  distance: number;
} {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy),
    ),
  );
  return {
    t,
    distance: Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy),
  };
}

export function riverInfluence(distance: number, width: number): number {
  const half = width / 2 + RIVER_SAMPLE_SUPPORT;
  const t = Math.max(
    0,
    Math.min(1, 1 - Math.max(0, (distance - half) / Math.max(width, 5))),
  );
  return t * t * (3 - 2 * t);
}

/** Confirmed absolute profiles keep their bed, even while their input is stale. */
export function pointwiseNatural(
  heightSample: HeightSampler,
  rivers: readonly WaterSource[],
  point: Point,
): number {
  assertPoint(point);
  const natural = heightSample(...point);
  let height = natural;
  for (const river of rivers) {
    if (river.kind !== "river") continue;
    for (let i = 1; i < river.samples.length; i++) {
      const a = river.samples[i - 1],
        b = river.samples[i];
      const { t, distance } = projectRiverPoint(point, a.point, b.point);
      const width = a.width + (b.width - a.width) * t;
      const water = a.level + (b.level - a.level) * t;
      height = Math.min(
        height,
        natural +
          Math.min(0, water - 2 - natural) * riverInfluence(distance, width),
      );
    }
  }
  return height;
}

export interface WaterAtPoint {
  id: string;
  kind: "lake" | "river";
  level: number;
}

/** Transient clipping never removes any part of a confirmed authored mask. */
export function waterAtPoint(
  sources: readonly WaterSource[],
  point: Point,
  naturalBed: number,
): WaterAtPoint | null {
  assertPoint(point);
  let result: WaterAtPoint | null = null;
  const add = (source: WaterSource, level: number) => {
    if (
      naturalBed < level &&
      (!result ||
        level < result.level ||
        (level === result.level && source.id < result.id))
    )
      result = { id: source.id, kind: source.kind, level };
  };
  for (const source of sources) {
    if (source.kind === "lake") {
      if (lakeContainsPoint(source, point)) add(source, source.level);
    } else
      for (let i = 1; i < source.samples.length; i++) {
        const a = source.samples[i - 1],
          b = source.samples[i];
        const { t, distance } = projectRiverPoint(point, a.point, b.point);
        if (distance <= (a.width + (b.width - a.width) * t) / 2)
          add(source, a.level + (b.level - a.level) * t);
      }
  }
  return result;
}

export function foundationBounds(house: HouseHeader): Bounds {
  const b = houseBounds(house),
    r = house.foundationTransition;
  return clipBounds([b[0] - r, b[1] - r, b[2] + r, b[3] + r]);
}

/** Footprints own their surface; overlapping footprints use the highest base. */
export function pointwiseFoundation(
  naturalBed: number,
  houses: readonly { house: HouseHeader; foundation: FoundationResult }[],
  point: Point,
): number {
  let footprint = -Infinity;
  let transition = naturalBed;
  for (const { house, foundation } of houses) {
    if (foundation.status !== "current") continue;
    const base = foundation.baseUpper;
    if (houseContainsPoint(house, point)) {
      footprint = Math.max(footprint, base);
      continue;
    }
    if (house.foundationTransition <= 0) continue;
    const corners = houseCorners(house);
    let distance = Infinity;
    for (let i = 0; i < 4; i++)
      distance = Math.min(
        distance,
        projectRiverPoint(point, corners[i], corners[(i + 1) % 4]).distance,
      );
    const t = Math.max(0, 1 - distance / house.foundationTransition);
    transition = Math.max(
      transition,
      naturalBed + Math.max(0, base - naturalBed) * t * t * (3 - 2 * t),
    );
  }
  return footprint > -Infinity ? footprint : transition;
}

type Interval = [number, number];
const floatBits = new DataView(new ArrayBuffer(8));

/** Directed one-ULP bounds; all larger expression errors get explicit padding. */
function nextUp(value: number): number {
  if (value === Infinity || Number.isNaN(value)) return value;
  if (value === 0) return Number.MIN_VALUE;
  floatBits.setFloat64(0, value);
  let high = floatBits.getUint32(0),
    low = floatBits.getUint32(4);
  if (value > 0) {
    low = (low + 1) >>> 0;
    if (!low) high++;
  } else {
    if (!low) high--;
    low = (low - 1) >>> 0;
  }
  floatBits.setUint32(0, high);
  floatBits.setUint32(4, low);
  return floatBits.getFloat64(0);
}
const nextDown = (n: number) => -nextUp(-n);

function padded(low: number, high: number, factor = 64): Interval {
  if (!Number.isFinite(low) || !Number.isFinite(high))
    return [-Infinity, Infinity];
  const error =
    Number.EPSILON * factor * Math.max(1, Math.abs(low), Math.abs(high));
  return [nextDown(low - error), nextUp(high + error)];
}

/** Positive cardinal cubic; its only interior stationary point is u=0. */
function cardinal(u: number): number {
  const t = Math.abs(u);
  if (t >= 2) return 0;
  return t < 1 ? 2 / 3 - t * t + (t * t * t) / 2 : (2 - t) ** 3 / 6;
}

function quadratic(u: number): number {
  const t = Math.abs(u);
  return t >= 1.5 ? 0 : t < 0.5 ? 0.75 - t * t : (1.5 - t) ** 2 / 2;
}

/** Exact branch extrema, including knots and critical polynomial points. */
export function cubicBasisInterval(low: number, high: number): Interval {
  if (!Number.isFinite(low) || !Number.isFinite(high) || low > high)
    throw new RangeError("Ungültiges kubisches Basisintervall.");
  if (high <= -2 || low >= 2) return [0, 0];
  let minimum = Math.min(cardinal(low), cardinal(high));
  let maximum = Math.max(cardinal(low), cardinal(high));
  for (const critical of [-2, -1, 0, 1, 2])
    if (critical >= low && critical <= high) {
      minimum = Math.min(minimum, cardinal(critical));
      maximum = Math.max(maximum, cardinal(critical));
    }
  const interval = padded(minimum, maximum);
  return [Math.max(0, interval[0]), Math.min(1, interval[1])];
}

interface Control {
  x: number;
  y: number;
  value: number;
}
interface ControlLevel {
  step: number;
  controls: Control[];
  values: Map<string, number>;
}
interface MaxNode {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  upper: number;
}

function pushNode(heap: MaxNode[], node: MaxNode): void {
  let at = heap.length;
  heap.push(node);
  while (at) {
    const parent = (at - 1) >> 1;
    if (heap[parent].upper >= node.upper) break;
    heap[at] = heap[parent];
    at = parent;
  }
  heap[at] = node;
}

function popNode(heap: MaxNode[]): MaxNode {
  const first = heap[0],
    last = heap.pop()!;
  if (!heap.length) return first;
  let at = 0;
  while (at * 2 + 1 < heap.length) {
    let child = at * 2 + 1;
    if (child + 1 < heap.length && heap[child + 1].upper > heap[child].upper)
      child++;
    if (heap[child].upper <= last.upper) break;
    heap[at] = heap[child];
    at = child;
  }
  heap[at] = last;
  return first;
}

function riverInterval(
  natural: Interval,
  a: RiverSample,
  b: RiverSample,
  bounds: Bounds,
): Interval {
  const corners: Point[] = [
    [bounds[0], bounds[1]],
    [bounds[2], bounds[1]],
    [bounds[2], bounds[3]],
    [bounds[0], bounds[3]],
  ];
  const projections = corners.map((p) =>
    projectRiverPoint(p, a.point, b.point),
  );
  const t0 = Math.max(0, nextDown(Math.min(...projections.map((p) => p.t))));
  const t1 = Math.min(1, nextUp(Math.max(...projections.map((p) => p.t))));
  const width = padded(
    Math.min(
      a.width + (b.width - a.width) * t0,
      a.width + (b.width - a.width) * t1,
    ),
    Math.max(
      a.width + (b.width - a.width) * t0,
      a.width + (b.width - a.width) * t1,
    ),
  );
  const water = padded(
    Math.min(
      a.level + (b.level - a.level) * t0,
      a.level + (b.level - a.level) * t1,
    ),
    Math.max(
      a.level + (b.level - a.level) * t0,
      a.level + (b.level - a.level) * t1,
    ),
  );
  // Distance to a convex segment is convex: its maximum on the box is at a corner.
  // Zero is a conservative distance minimum, sufficient for the lower bound.
  const distance = padded(0, Math.max(...projections.map((p) => p.distance)));
  const influence = padded(
    riverInfluence(distance[1], Math.max(Number.MIN_VALUE, width[0])),
    1,
  );
  const blend = (height: number, level: number, weight: number) =>
    height + Math.min(0, level - 2 - height) * weight;
  return padded(
    blend(natural[0], water[0], 1),
    blend(natural[1], water[1], Math.max(0, influence[0])),
  );
}

/**
 * Cooperative, bounded maximization over the entire rotated footprint.
 * Every remaining rectangle has a proven cubic/river upper bound. A result is
 * current only when that global bound is within tolerance of an actual sample.
 * Exhausted work retains an unknown result; it never substitutes a sample maximum.
 */
export function* deriveFoundation(
  house: HouseHeader,
  snapshot: HeightSnapshot,
  waters: readonly WaterSource[],
  options: FoundationOptions = {},
): Generator<void, FoundationResult> {
  validateHouseHeader(house);
  const toleranceFt = options.toleranceFt ?? FOUNDATION_TOLERANCE_FT;
  const maxNodes = options.maxNodes ?? 16_384;
  const maxControlSteps = options.maxControlSteps ?? 4_000_000;
  const maxRetainedControls =
    options.maxRetainedControls ?? FOUNDATION_MAX_RETAINED_CONTROLS;
  if (
    !Number.isFinite(toleranceFt) ||
    toleranceFt <= 0 ||
    toleranceFt > 0.01 ||
    !Number.isSafeInteger(maxNodes) ||
    maxNodes < 0 ||
    maxNodes > 16_384 ||
    !Number.isSafeInteger(maxControlSteps) ||
    maxControlSteps < 0 ||
    maxControlSteps > 4_000_000 ||
    !Number.isSafeInteger(maxRetainedControls) ||
    maxRetainedControls < 0 ||
    maxRetainedControls > FOUNDATION_MAX_RETAINED_CONTROLS
  )
    throw new RangeError("Ungültiges Fundamentbudget oder Höhentoleranz.");
  let nodes = 0,
    controlSteps = 0;
  let lower = -HEIGHT_LIMIT;
  const result = (
    upper: number,
    reason?: FoundationResult["reason"],
  ): FoundationResult => ({
    houseId: house.id,
    status: reason ? "unknown" : "current",
    baseLower: lower,
    baseUpper: Math.max(lower, upper),
    topLower: lower + house.foundationHeight,
    topUpper: Math.max(lower, upper) + house.foundationHeight,
    toleranceFt,
    nodes,
    controlSteps,
    ...(reason ? { reason } : {}),
  });
  const footprint = houseBounds(house);
  if (
    !HEIGHT_LEVELS.every((level) => snapshot.levels.includes(level)) ||
    snapshot.bounds[0] > footprint[0] ||
    snapshot.bounds[1] > footprint[1] ||
    snapshot.bounds[2] < footprint[2] ||
    snapshot.bounds[3] < footprint[3]
  )
    return result(HEIGHT_LIMIT, "sources");
  if (!maxNodes || !maxControlSteps || !maxRetainedControls)
    return result(HEIGHT_LIMIT, "budget");
  const setup = prepareScaledHeightSumSteps(snapshot);
  let prepared = setup.next();
  while (!prepared.done) {
    yield;
    prepared = setup.next();
  }
  const sum = prepared.value;
  const heightSample: HeightSampler = (x, y) => heightFromScaledSum(sum(x, y));
  const levels = new Map<number, ControlLevel>();
  let maxMagnitude = 1;
  let sinceYield = 0;
  let retainedControls = 0;
  for (const tile of snapshot.tiles) {
    const step = heightSpacing(tile.level);
    let level = levels.get(tile.level);
    if (!level)
      levels.set(
        tile.level,
        (level = { step, controls: [], values: new Map() }),
      );
    for (let i = 0; i < tile.values.length; i++) {
      if (++controlSteps > maxControlSteps)
        return result(HEIGHT_LIMIT, "budget");
      if (++sinceYield === 128) {
        sinceYield = 0;
        yield;
      }
      const cx = tile.tileX * HEIGHT_TILE_SIZE + (i % HEIGHT_TILE_SIZE);
      const cy =
        tile.tileY * HEIGHT_TILE_SIZE + Math.floor(i / HEIGHT_TILE_SIZE);
      if (
        Math.abs(cx * step) > WORLD_LIMIT ||
        Math.abs(cy * step) > WORLD_LIMIT
      )
        continue;
      if (
        cx <= footprint[0] / step - 2 ||
        cx >= footprint[2] / step + 2 ||
        cy <= footprint[1] / step - 2 ||
        cy >= footprint[3] / step + 2
      )
        continue;
      // Both retained representations share one bound across every source level.
      // Check before allocating the control object or its coordinate-map entry.
      if (retainedControls >= maxRetainedControls)
        return result(HEIGHT_LIMIT, "budget");
      retainedControls++;
      level.controls.push({ x: cx, y: cy, value: tile.values[i] });
      level.values.set(`${cx},${cy}`, tile.values[i]);
      maxMagnitude = Math.max(maxMagnitude, Math.abs(tile.values[i]));
    }
    yield;
  }
  const rivers = waters.filter((source) => source.kind === "river");
  const angle = (house.rotation * Math.PI) / 180;
  const rawCosine = Math.cos(angle),
    rawSine = Math.sin(angle);
  const cosine = Math.abs(rawCosine) < 1e-15 ? 0 : rawCosine;
  const sine = Math.abs(rawSine) < 1e-15 ? 0 : rawSine;
  const point = (u: number, v: number): Point => {
    const x = (u - 0.5) * house.width,
      y = (v - 0.5) * house.depth;
    return [house.x + x * cosine - y * sine, house.y + x * sine + y * cosine];
  };
  const sampleMagnitude = rivers.reduce(
    (maximum, river) =>
      river.samples.reduce(
        (value, sample) => Math.max(value, Math.abs(sample.level) + 2),
        maximum,
      ),
    maxMagnitude,
  );
  const sampleError =
    Number.EPSILON * 128 * Math.max(1, levels.size) * sampleMagnitude;

  function* bound(node: MaxNode): Generator<void, number | null> {
    if (++nodes > maxNodes) return null;
    const corners = [
      point(node.u0, node.v0),
      point(node.u1, node.v0),
      point(node.u1, node.v1),
      point(node.u0, node.v1),
    ];
    for (const p of [
      ...corners,
      point((node.u0 + node.u1) / 2, (node.v0 + node.v1) / 2),
    ]) {
      controlSteps += Math.max(1, levels.size) * 16;
      if (controlSteps > maxControlSteps) return null;
      const sampled = pointwiseNatural(heightSample, rivers, p);
      lower = Math.max(
        lower,
        Math.max(-HEIGHT_LIMIT, nextDown(sampled - sampleError)),
      );
      yield;
    }
    const area: Bounds = [
      Math.max(footprint[0], nextDown(Math.min(...corners.map((p) => p[0])))),
      Math.max(footprint[1], nextDown(Math.min(...corners.map((p) => p[1])))),
      Math.min(footprint[2], nextUp(Math.max(...corners.map((p) => p[0])))),
      Math.min(footprint[3], nextUp(Math.max(...corners.map((p) => p[1])))),
    ];
    let totalLow = HEIGHT_BASE / HEIGHT_SUM_SCALE;
    let totalHigh = totalLow;
    let gxLow = 0,
      gxHigh = 0,
      gyLow = 0,
      gyHigh = 0;
    let centreDx = 0,
      centreDy = 0,
      xxBound = 0,
      xyBound = 0,
      yyBound = 0,
      gradientError = 0;
    const centre = point((node.u0 + node.u1) / 2, (node.v0 + node.v1) / 2);
    for (const level of levels.values()) {
      const { step, controls } = level;
      const x0 = Math.floor(area[0] / step) - 1,
        x1 = Math.ceil(area[2] / step) + 1;
      const y0 = Math.floor(area[1] / step) - 1,
        y1 = Math.ceil(area[3] / step) + 1;
      let used = 0,
        min = Infinity,
        max = -Infinity;
      let low = 0,
        high = 0;
      for (const control of controls) {
        if (++controlSteps > maxControlSteps) return null;
        if (++sinceYield === 128) {
          sinceYield = 0;
          yield;
        }
        if (
          control.x < x0 ||
          control.x > x1 ||
          control.y < y0 ||
          control.y > y1
        )
          continue;
        used++;
        min = Math.min(min, control.value);
        max = Math.max(max, control.value);
        if (control.value === 0) continue;
        const wx = cubicBasisInterval(
          (area[0] - control.x * step) / step,
          (area[2] - control.x * step) / step,
        );
        const wy = cubicBasisInterval(
          (area[1] - control.y * step) / step,
          (area[3] - control.y * step) / step,
        );
        const weight: Interval = [
          Math.max(0, nextDown(wx[0] * wy[0])),
          nextUp(wx[1] * wy[1]),
        ];
        const coefficient = control.value / HEIGHT_SUM_SCALE;
        const a = coefficient * (coefficient < 0 ? weight[1] : weight[0]);
        const b = coefficient * (coefficient < 0 ? weight[0] : weight[1]);
        low = nextDown(low + nextDown(a));
        high = nextUp(high + nextUp(b));
      }
      if (used < (x1 - x0 + 1) * (y1 - y0 + 1)) {
        min = Math.min(min, 0);
        max = Math.max(max, 0);
      }
      if (!used) {
        min = max = 0;
      }
      // Partition of unity yields an additional exact convex-hull bound.
      const hull = padded(min / HEIGHT_SUM_SCALE, max / HEIGHT_SUM_SCALE);
      low = Math.max(low, hull[0]);
      high = Math.min(high, hull[1]);
      if (Number.isNaN(low) || Number.isNaN(high)) {
        low = -Infinity;
        high = Infinity;
      }
      totalLow = nextDown(totalLow + low);
      totalHigh = nextUp(totalHigh + high);

      // Derivatives of a cubic B-spline use adjacent control differences and
      // positive quadratic weights. Their convex hull avoids losing constant
      // offsets to interval dependency; an affine terrain gets an exact slope.
      let dxLow = Infinity,
        dxHigh = -Infinity,
        dyLow = Infinity,
        dyHigh = -Infinity;
      const value = (x: number, y: number) =>
        level.values.get(`${x},${y}`) ?? 0;
      const scaled = (x: number, y: number) => value(x, y) / HEIGHT_SUM_SCALE;
      let xx = 0,
        xy = 0,
        yy = 0;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= Math.ceil(area[2] / step); x++) {
          if (++controlSteps > maxControlSteps) return null;
          const difference =
            (value(x + 1, y) / HEIGHT_SUM_SCALE -
              value(x, y) / HEIGHT_SUM_SCALE) /
            step;
          dxLow = Math.min(dxLow, difference);
          dxHigh = Math.max(dxHigh, difference);
          centreDx +=
            difference *
            quadratic((centre[0] - x * step) / step - 0.5) *
            cardinal((centre[1] - y * step) / step);
          if (x < Math.ceil(area[2] / step))
            xx = Math.max(
              xx,
              Math.abs(
                (scaled(x + 2, y) - 2 * scaled(x + 1, y) + scaled(x, y)) /
                  step /
                  step,
              ),
            );
          if (y <= Math.ceil(area[3] / step))
            xy = Math.max(
              xy,
              Math.abs(
                (scaled(x + 1, y + 1) -
                  scaled(x + 1, y) -
                  scaled(x, y + 1) +
                  scaled(x, y)) /
                  step /
                  step,
              ),
            );
          if (++sinceYield === 128) {
            sinceYield = 0;
            yield;
          }
        }
      for (let y = y0; y <= Math.ceil(area[3] / step); y++)
        for (let x = x0; x <= x1; x++) {
          if (++controlSteps > maxControlSteps) return null;
          const difference =
            (value(x, y + 1) / HEIGHT_SUM_SCALE -
              value(x, y) / HEIGHT_SUM_SCALE) /
            step;
          dyLow = Math.min(dyLow, difference);
          dyHigh = Math.max(dyHigh, difference);
          centreDy +=
            difference *
            cardinal((centre[0] - x * step) / step) *
            quadratic((centre[1] - y * step) / step - 0.5);
          if (y < Math.ceil(area[3] / step))
            yy = Math.max(
              yy,
              Math.abs(
                (scaled(x, y + 2) - 2 * scaled(x, y + 1) + scaled(x, y)) /
                  step /
                  step,
              ),
            );
          if (++sinceYield === 128) {
            sinceYield = 0;
            yield;
          }
        }
      const dx = padded(dxLow, dxHigh),
        dy = padded(dyLow, dyHigh);
      gxLow = nextDown(gxLow + dx[0]);
      gxHigh = nextUp(gxHigh + dx[1]);
      gyLow = nextDown(gyLow + dy[0]);
      gyHigh = nextUp(gyHigh + dy[1]);
      const error =
        (Number.EPSILON * 128 * maxMagnitude) / HEIGHT_SUM_SCALE / step;
      gradientError += error;
      xxBound = nextUp(xxBound + xx + error / step);
      xyBound = nextUp(xyBound + xy + error / step);
      yyBound = nextUp(yyBound + yy + error / step);
    }
    const centreSum = sum(...centre);
    let gradientHigh = -Infinity;
    let taylorHigh = -Infinity;
    for (const corner of corners) {
      const dx = corner[0] - centre[0],
        dy = corner[1] - centre[1];
      const candidate =
        centreSum +
        dx * (dx < 0 ? gxLow : gxHigh) +
        dy * (dy < 0 ? gyLow : gyHigh);
      gradientHigh = Math.max(
        gradientHigh,
        padded(candidate, candidate)[1] + sampleError / HEIGHT_SUM_SCALE,
      );
      // Positive linear/quadratic bases also bound the Hessian by second
      // control differences. Taylor's remainder shrinks quadratically near an
      // interior maximum, avoiding an unbounded fine-grid search for splines.
      const taylor =
        centreSum +
        centreDx * dx +
        centreDy * dy +
        ((xxBound + xyBound) * dx * dx) / 2 +
        ((yyBound + xyBound) * dy * dy) / 2 +
        gradientError * (Math.abs(dx) + Math.abs(dy));
      taylorHigh = Math.max(
        taylorHigh,
        padded(taylor, taylor)[1] + sampleError / HEIGHT_SUM_SCALE,
      );
    }
    if (!Number.isNaN(gradientHigh))
      totalHigh = Math.min(totalHigh, gradientHigh);
    if (!Number.isNaN(taylorHigh)) totalHigh = Math.min(totalHigh, taylorHigh);
    let natural: Interval =
      Number.isNaN(totalLow) || Number.isNaN(totalHigh)
        ? [-HEIGHT_LIMIT, HEIGHT_LIMIT]
        : [heightFromScaledSum(totalLow), heightFromScaledSum(totalHigh)];
    let finalLow = natural[0],
      finalHigh = natural[1];
    for (const river of rivers)
      for (let i = 1; i < river.samples.length; i++) {
        if (++controlSteps > maxControlSteps) return null;
        const interval = riverInterval(
          natural,
          river.samples[i - 1],
          river.samples[i],
          area,
        );
        finalLow = Math.min(finalLow, interval[0]);
        finalHigh = Math.min(finalHigh, interval[1]);
        yield;
      }
    // The lower interval is useful for numerical auditing; sampled points give
    // the stronger lower bound on this maximization problem.
    void finalLow;
    return Math.max(lower, Math.min(HEIGHT_LIMIT, finalHigh));
  }

  const initial: MaxNode = { u0: 0, v0: 0, u1: 1, v1: 1, upper: HEIGHT_LIMIT };
  const initialUpper = yield* bound(initial);
  if (initialUpper === null) return result(HEIGHT_LIMIT, "budget");
  initial.upper = initialUpper;
  const heap: MaxNode[] = [initial];
  while (heap.length) {
    const upper = heap[0].upper;
    if (upper - lower <= toleranceFt) return result(upper);
    if (nodes + 2 > maxNodes || controlSteps >= maxControlSteps)
      return result(upper, "budget");
    const node = popNode(heap);
    const horizontal =
      (node.u1 - node.u0) * house.width >= (node.v1 - node.v0) * house.depth;
    const middle = horizontal
      ? (node.u0 + node.u1) / 2
      : (node.v0 + node.v1) / 2;
    if (
      horizontal
        ? middle === node.u0 || middle === node.u1
        : middle === node.v0 || middle === node.v1
    )
      return result(upper, "precision");
    const first: MaxNode = horizontal
      ? { ...node, u1: middle }
      : { ...node, v1: middle };
    const second: MaxNode = horizontal
      ? { ...node, u0: middle }
      : { ...node, v0: middle };
    const a = yield* bound(first);
    const b = a === null ? null : yield* bound(second);
    if (a === null || b === null) return result(upper, "budget");
    first.upper = a;
    second.upper = b;
    pushNode(heap, first);
    pushNode(heap, second);
    yield;
  }
  return result(lower);
}

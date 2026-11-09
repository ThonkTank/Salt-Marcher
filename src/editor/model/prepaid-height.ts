import { quarticBrushSegmentMean } from "./height";
import type { HeightSegment } from "./EditorDocument";
import type { PrepaidBrushOffer } from "./PrepaidBrush";
import {
  WORLD_LIMIT,
  HEIGHT_MAX_ACTION_TILES,
  assertPoint,
  clipBounds,
  heightControlAddress,
  heightSpacing,
  unionBounds,
  type Bounds,
  type HeightBrush,
  type Point,
} from "./types";

/** Captured geometry and normalized causal time; no callback can extend this. */
export interface HeightBrushBatch {
  admissionId: number;
  path: { from: Point; points: readonly Point[]; end: boolean };
  time: readonly HeightSegment[];
  /** Includes the raw Down/Move/Up samples represented by this batch. */
  pointCount: number;
}

/**
 * Enumerate a swept strip along its dominant axis. A diagonal does not visit
 * its enclosing rectangle. Each coefficient occurs once in the returned offer;
 * temporary visits and distinct coefficients have separate finite limits.
 */
export function preparePrepaidHeight(
  brush: HeightBrush,
  batch: HeightBrushBatch,
  maxCells: number,
): {
  offers: PrepaidBrushOffer[];
  regions: Map<string, Bounds>;
  examinedCells: number;
  /** Dense lookup reference capacity, or zero for the sparse Map. Not bytes. */
  lookupSlotCount: number;
} {
  const step = heightSpacing(brush.level);
  const minWorldControl = Math.ceil(-WORLD_LIMIT / step);
  const maxWorldControl = Math.floor(WORLD_LIMIT / step);
  let originX = minWorldControl;
  let originY = minWorldControl;
  let controlSpan = maxWorldControl - minWorldControl + 1;
  const rate = Math.abs(brush.amount);
  const pulse = rate / 60;
  let slots: (PrepaidBrushOffer | undefined)[] | null = null;
  let byControl: Map<number, PrepaidBrushOffer> | null = null;
  const offers: PrepaidBrushOffer[] = [];
  const tileKeys = new Set<string>();
  const regions = new Map<string, Bounds>();
  let cellCount = 0;
  let examinedCells = 0;
  const accumulate = (
    from: Point,
    to: Point,
    minimum: boolean,
    elapsedMs = 0,
  ) => {
    assertPoint(from);
    assertPoint(to);
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0)
      throw new RangeError(
        "Die Pinselzeit muss endlich und nichtnegativ sein.",
      );
    if (brush.amount === 0 || (!minimum && elapsedMs === 0)) return;
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const length = Math.hypot(dx, dy);
    const timeScale = (rate * elapsedMs) / 1000;
    const ux = length ? dx / length : 0;
    const uy = length ? dy / length : 0;
    const axis = Math.abs(dx) >= Math.abs(dy) ? 0 : 1;
    const other = 1 - axis;
    const majorDelta = to[axis] - from[axis];
    const slope = majorDelta ? (to[other] - from[other]) / majorDelta : 0;
    // At a fixed dominant coordinate the infinite strip is at most sqrt(2)r
    // wide. Outside the segment's endpoints a radius-sized cap suffices.
    const reach = brush.radius * Math.sqrt(1 + slope * slope);
    const low = Math.max(
      minWorldControl,
      Math.ceil((Math.min(from[axis], to[axis]) - brush.radius) / step),
    );
    const high = Math.min(
      maxWorldControl,
      Math.floor((Math.max(from[axis], to[axis]) + brush.radius) / step),
    );
    // Every radius-sized circle on the segment also lies inside the endpoint
    // AABB. Intersecting it with the strip avoids oversized diagonal end caps.
    const minorLow = Math.max(
      minWorldControl,
      Math.ceil((Math.min(from[other], to[other]) - brush.radius) / step),
    );
    const minorHigh = Math.min(
      maxWorldControl,
      Math.floor((Math.max(from[other], to[other]) + brush.radius) / step),
    );
    if (high - low + 1 > 400_000 - examinedCells)
      throw new RangeError(
        "Pinselabschnitt überschreitet das Annahme-Arbeitsbudget.",
      );
    for (let major = low; major <= high; major++) {
      const coordinate = major * step;
      const t = majorDelta
        ? Math.max(0, Math.min(1, (coordinate - from[axis]) / majorDelta))
        : 0;
      const centre = from[other] + (to[other] - from[other]) * t;
      const lower = Math.max(minorLow, Math.ceil((centre - reach) / step));
      const upper = Math.min(minorHigh, Math.floor((centre + reach) / step));
      if (examinedCells + upper - lower + 1 > 400_000)
        throw new RangeError(
          "Pinselabschnitt überschreitet das Annahme-Arbeitsbudget.",
        );
      for (let minor = lower; minor <= upper; minor++) {
        examinedCells++;
        const x = axis === 0 ? major : minor;
        const y = axis === 0 ? minor : major;
        const qx = x * step - from[0];
        const qy = y * step - from[1];
        const along = qx * ux + qy * uy;
        const nearest = Math.max(0, Math.min(length, along));
        const d2 =
          ((qx - nearest * ux) / brush.radius) ** 2 +
          ((qy - nearest * uy) / brush.radius) ** 2;
        if (d2 >= 1) continue;
        const floor = minimum ? pulse * (1 - d2) ** 2 : 0;
        const time = elapsedMs
          ? timeScale *
            (length
              ? quarticBrushSegmentMean(
                  along,
                  qx * uy - qy * ux,
                  length,
                  brush.radius,
                )
              : (1 - d2) ** 2)
          : 0;
        if (floor === 0 && time === 0) continue;
        // Local addresses are injective even for a world-wide rectangle, whose
        // area stays below 2^51. Small windows use bounded reference slots;
        // larger windows retain sparse lookup. Neither lookup changes traversal.
        const address = x - originX + (y - originY) * controlSpan;
        let offer = slots ? slots[address] : byControl!.get(address);
        if (!offer) {
          if (cellCount === maxCells)
            throw new RangeError(
              "Höchstens 100.000 Höhenpunkte je Aktion; einen kürzeren Strich malen.",
            );
          cellCount++;
          const { key, index } = heightControlAddress(brush.level, x, y);
          if (!tileKeys.has(key)) {
            if (tileKeys.size === HEIGHT_MAX_ACTION_TILES)
              throw new RangeError(
                "Eine Höhengeste darf höchstens 512 Höhenkacheln ändern.",
              );
            tileKeys.add(key);
          }
          offer = { key, index, minimum: 0, time: 0 };
          if (slots) slots[address] = offer;
          else byControl!.set(address, offer);
          offers.push(offer);
          const support = clipBounds([
            x * step - 2 * step,
            y * step - 2 * step,
            x * step + 2 * step,
            y * step + 2 * step,
          ]);
          const old = regions.get(key);
          regions.set(key, old ? unionBounds(old, support) : support);
        }
        offer.minimum = Math.max(offer.minimum, floor);
        offer.time += time;
      }
    }
  };
  const segments = new Map<
    string,
    { from: Point; to: Point; minimum: boolean; elapsedMs: number }
  >();
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const segment = (from: Point, to: Point) => {
    assertPoint(from);
    assertPoint(to);
    minX = Math.min(minX, from[0], to[0]);
    minY = Math.min(minY, from[1], to[1]);
    maxX = Math.max(maxX, from[0], to[0]);
    maxY = Math.max(maxY, from[1], to[1]);
    // Geometry/time-identical contributions within this one causal admission
    // window may be combined. This never shortcuts a corner or changes a
    // delivered window's time cap/accounting boundary.
    const key = `${from[0]},${from[1]}:${to[0]},${to[1]}`;
    let value = segments.get(key);
    if (!value)
      segments.set(key, (value = { from, to, minimum: false, elapsedMs: 0 }));
    return value;
  };
  assertPoint(batch.path.from);
  let from = batch.path.from;
  if (!batch.path.points.length) segment(from, from).minimum = true;
  for (const point of batch.path.points) {
    segment(from, point).minimum = true;
    from = point;
  }
  let elapsed = 0;
  for (const part of batch.time) {
    if (!Number.isFinite(part.elapsedMs) || part.elapsedMs < 0)
      throw new RangeError(
        "Die Pinselzeit muss endlich und nichtnegativ sein.",
      );
    elapsed += part.elapsedMs;
    segment(part.from, part.to).elapsedMs += part.elapsedMs;
  }
  if (!Number.isFinite(elapsed) || elapsed > 50 + 1e-9)
    throw new RangeError(
      "Ein Pinsel-Zeitfenster darf höchstens 50 ms enthalten.",
    );
  // Include both captured geometry and temporal-only pieces. The one-control
  // margin is conservative at radius/grid rounding boundaries. The optional
  // dense lookup is capped at 16,384 references to the same offer objects;
  // larger rectangles stay sparse, and neither path iterates the rectangle.
  originX = Math.max(
    minWorldControl,
    Math.floor((minX - brush.radius) / step) - 1,
  );
  originY = Math.max(
    minWorldControl,
    Math.floor((minY - brush.radius) / step) - 1,
  );
  const lastX = Math.min(
    maxWorldControl,
    Math.ceil((maxX + brush.radius) / step) + 1,
  );
  const lastY = Math.min(
    maxWorldControl,
    Math.ceil((maxY + brush.radius) / step) + 1,
  );
  controlSpan = lastX - originX + 1;
  const lookupArea = controlSpan * (lastY - originY + 1);
  if (lookupArea <= 16_384) slots = new Array(lookupArea);
  else byControl = new Map();
  for (const { from, to, minimum, elapsedMs } of segments.values())
    accumulate(from, to, minimum, elapsedMs);
  return {
    offers,
    regions,
    examinedCells,
    lookupSlotCount: slots?.length ?? 0,
  };
}

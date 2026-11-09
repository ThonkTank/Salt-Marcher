import {
  assertLevel,
  assertPoint,
  heightBrushReadBounds,
  unionBounds,
  type Bounds,
  type HeightBrush,
  type HeightSegment,
  type Point,
} from "./model";

export interface BrushPoint {
  point: Point;
  input: number;
  at: number;
}

/** Causal input state. The document owns acceptance and effect reservations. */
export interface TimedBrushStroke {
  brush: Readonly<HeightBrush>;
  point: Point;
  pointAt: number;
  input: number;
  clock: number;
  arrivedAt: number;
  sealed: boolean;
}

export interface TimedBrushWindow {
  /** Observed arrival on the browser clock, distinct from sample timestamps. */
  at: number;
  points: readonly BrushPoint[];
  /** The final point must be the actual Up sample, even at an unchanged position. */
  end?: boolean;
}

export interface TimedBrushBatch {
  stroke: TimedBrushStroke;
  /** A bounded polyline descriptor, never an expanded list of dabs. */
  path: {
    from: Point;
    points: Point[];
    end: boolean;
  };
  time: HeightSegment[];
  offeredTimeMs: number;
  acceptedTimeMs: number;
}

/** Convert either browser timestamp origin once; never use callback delay as time. */
export function normalizeBrushTimestamp(
  timestamp: number,
  arrival: number,
  timeOrigin: number,
): number {
  if (![timestamp, arrival, timeOrigin].every(Number.isFinite))
    throw new RangeError("Ungültige Eingabezeit.");
  const at = timestamp >= timeOrigin ? timestamp - timeOrigin : timestamp;
  if (at < 0 || at > arrival || timeOrigin <= arrival)
    throw new RangeError("Eingabezeit gehört nicht zur aktuellen Uhr.");
  return at;
}

export function beginTimedBrush(
  brush: HeightBrush,
  start: BrushPoint,
): TimedBrushStroke {
  assertLevel(brush.level);
  assertPoint(start.point);
  if (
    !Number.isFinite(brush.radius) ||
    brush.radius <= 0 ||
    !Number.isFinite(brush.amount) ||
    !Number.isFinite(start.at) ||
    start.at < 0 ||
    !Number.isSafeInteger(start.input) ||
    start.input < 0
  )
    throw new RangeError("Ungültiger Pinselanfang.");
  return {
    brush: Object.freeze({ ...brush }),
    point: [...start.point],
    pointAt: start.at,
    input: start.input,
    clock: start.at,
    arrivedAt: start.at,
    sealed: false,
  };
}

/**
 * Normalize one observed admission window before any author mutation. The next
 * state is usable only after its finite descriptor has been admitted/reserved.
 * The controller binds it to sources, receipts and the shared pending limit.
 */
export function planTimedBrushWindow(
  stroke: TimedBrushStroke,
  window: TimedBrushWindow,
): TimedBrushBatch {
  if (
    stroke.sealed ||
    !Number.isFinite(window.at) ||
    window.at < stroke.arrivedAt ||
    window.points.length > MAX_BRUSH_POINTS - (window.end ? 0 : 1)
  )
    throw new RangeError("Pinsel beendet oder Eingabefenster übergelaufen.");
  if (window.end && window.points.length === 0)
    throw new RangeError(
      "Pinselende benötigt seinen Eingabepunkt mit Zeitstempel.",
    );
  let pointAt = stroke.pointAt;
  let input = stroke.input;
  const points = window.points.map((sample) => {
    assertPoint(sample.point);
    if (
      !Number.isFinite(sample.at) ||
      sample.at < pointAt ||
      sample.at > window.at ||
      !Number.isSafeInteger(sample.input) ||
      sample.input <= input
    )
      throw new RangeError("Pinseleingaben sind nicht eindeutig geordnet.");
    pointAt = sample.at;
    input = sample.input;
    return { ...sample, point: [...sample.point] as Point };
  });
  let clock = stroke.clock;
  let point = stroke.point;
  const time: HeightSegment[] = [];
  for (let first = 0; first < points.length;) {
    let last = first + 1;
    while (last < points.length && points[last].at === points[first].at) last++;
    const group = points.slice(first, last);
    const duration = Math.max(0, group[0].at - clock);
    let previous = point;
    const lengths = group.map((sample) => {
      const length = Math.hypot(
        sample.point[0] - previous[0],
        sample.point[1] - previous[1],
      );
      previous = sample.point;
      return length;
    });
    const length = lengths.reduce((sum, value) => sum + value, 0);
    if (duration > 0) {
      if (length === 0)
        time.push({ from: previous, to: previous, elapsedMs: duration });
      else {
        previous = point;
        for (let index = 0; index < group.length; index++) {
          const to = group[index].point;
          if (lengths[index] > 0)
            time.push({
              from: previous,
              to,
              elapsedMs: duration * (lengths[index] / length),
            });
          previous = to;
        }
      }
    }
    point = group.at(-1)!.point;
    clock = Math.max(clock, group[0].at);
    first = last;
  }
  const until = window.end ? points.at(-1)!.at : window.at;
  if (until > clock) {
    time.push({ from: point, to: point, elapsedMs: until - clock });
    clock = until;
  }
  const offeredTimeMs = clock - stroke.clock;
  const scale =
    offeredTimeMs > 0 ? Math.min(1, MAX_DOSE_MS / offeredTimeMs) : 1;
  return {
    stroke: {
      ...stroke,
      point: [...point],
      pointAt,
      input,
      clock,
      arrivedAt: window.at,
      sealed: window.end === true,
    },
    path: {
      from: [...stroke.point],
      points: points.map((sample) => sample.point),
      end: window.end === true,
    },
    time: time.map((segment) => ({
      ...segment,
      elapsedMs: segment.elapsedMs * scale,
    })),
    offeredTimeMs,
    acceptedTimeMs: offeredTimeMs * scale,
  };
}

export interface BrushStroke extends TimedBrushStroke {
  id: number;
  pointerId: number;
  path: BrushPoint[];
}

export type BrushState =
  | { kind: "idle" }
  | { kind: "blocked"; pointerId: number }
  | { kind: "active"; stroke: BrushStroke }
  | {
      kind: "finishing";
      stroke: BrushStroke;
      input?: number;
      reason: string;
      endAt: number;
      blockedPointerId: number | null;
    };

export const MAX_BRUSH_POINTS = 128;
const MAX_DOSE_MS = 50;

export function brushTarget(stroke: BrushStroke): Point {
  return stroke.path.at(-1)?.point ?? stroke.point;
}

/** Preserve the exact union of swept read rectangles, including every corner. */
export function brushPathRegions(stroke: BrushStroke): Bounds[] {
  const regions: Bounds[] = [];
  const append = (candidate: Bounds) => {
    for (let i = 0; i < regions.length;) {
      const old = regions[i];
      const contained =
        (old[0] <= candidate[0] &&
          old[1] <= candidate[1] &&
          old[2] >= candidate[2] &&
          old[3] >= candidate[3]) ||
        (candidate[0] <= old[0] &&
          candidate[1] <= old[1] &&
          candidate[2] >= old[2] &&
          candidate[3] >= old[3]);
      const row =
        old[1] === candidate[1] &&
        old[3] === candidate[3] &&
        old[0] <= candidate[2] &&
        candidate[0] <= old[2];
      const column =
        old[0] === candidate[0] &&
        old[2] === candidate[2] &&
        old[1] <= candidate[3] &&
        candidate[1] <= old[3];
      if (contained || row || column) {
        candidate = unionBounds(old, candidate);
        regions.splice(i, 1);
        i = 0;
      } else i++;
    }
    regions.push(candidate);
  };
  let point = stroke.point;
  append(heightBrushReadBounds(stroke.brush, point, point));
  for (const sample of stroke.path) {
    append(heightBrushReadBounds(stroke.brush, point, sample.point));
    point = sample.point;
  }
  return regions;
}

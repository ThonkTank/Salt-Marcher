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

/** Causal R1 input plan. The active controller changes only in R2. */
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
 * R2 must bind that admission to sources, receipts and the shared pending limit.
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

export interface BrushStroke {
  id: number;
  pointerId: number;
  brush: HeightBrush;
  point: Point;
  pointAt: number;
  clock: number;
  path: BrushPoint[];
}

export type BrushState =
  | { kind: "idle" }
  | { kind: "blocked"; pointerId: number }
  | { kind: "active"; stroke: BrushStroke };

export type BrushWaitReason =
  "sources" | "terrain" | "feedback" | "busy" | "outside";

export type BrushFrameDecision = { stroke: BrushStroke } & (
  | { kind: "none" }
  | {
      kind: "wait";
      fromAt: number;
      toAt: number;
      reason: BrushWaitReason;
      inputs: number[];
      end: boolean;
    }
  | { kind: "stale"; fromAt: number; toAt: number; inputs: number[] }
  | {
      kind: "dose";
      segments: HeightSegment[];
      fromAt: number;
      toAt: number;
      rawElapsedMs: number;
      cause: "move" | "hold";
      inputs: number[];
      discardedInputs: number[];
      discardedFrom?: number;
    }
);

export const PRESS_DOSE_MS = 1000 / 60;
export const MAX_BRUSH_POINTS = 128;
const MAX_DOSE_MS = 50;

export function brushTarget(stroke: BrushStroke): Point {
  const latest = stroke.path.at(-1);
  return latest && latest.at >= stroke.pointAt ? latest.point : stroke.point;
}

/** Corners belong to the readiness area, even when the final point comes back. */
export function brushPathBounds(stroke: BrushStroke): Bounds {
  let point = stroke.point;
  let bounds = heightBrushReadBounds(stroke.brush, point, point);
  for (const sample of stroke.path) {
    bounds = unionBounds(
      bounds,
      heightBrushReadBounds(stroke.brush, point, sample.point),
    );
    point = sample.point;
  }
  return bounds;
}

/** One bounded time window retains sampled travel and dwell until its draw. */
export function decideBrushFrame(
  stroke: BrushStroke,
  now: number,
  reason: BrushWaitReason | null,
  phase: "accept" | "after-draw" = "accept",
): BrushFrameDecision {
  if (
    (phase === "accept" && reason === "feedback") ||
    (phase === "after-draw" && reason === null)
  )
    return { kind: "none", stroke };

  const fromAt = stroke.clock;
  const toAt = Math.max(fromAt, now);
  const next: BrushStroke = { ...stroke, clock: toAt, path: [] };
  const latest = stroke.path.at(-1);
  const inputs = stroke.path.map((sample) => sample.input);
  const trackLatest = () => {
    if (latest && latest.at >= stroke.pointAt) {
      next.point = [...latest.point];
      next.pointAt = latest.at;
    }
  };

  if (reason !== null) {
    if (reason === "feedback") trackLatest();
    return {
      kind: "wait",
      stroke: next,
      fromAt,
      toAt,
      reason,
      inputs,
      end: reason !== "feedback",
    };
  }

  const rawElapsedMs = toAt - fromAt;
  if (rawElapsedMs <= 0) return { kind: "none", stroke };
  if (latest && latest.at < fromAt) {
    trackLatest();
    return { kind: "stale", stroke: next, fromAt, toAt, inputs };
  }

  const acceptedFrom = toAt - Math.min(rawElapsedMs, MAX_DOSE_MS);
  if (acceptedFrom > fromAt) {
    // A real stall discards its path. It never becomes a catch-up polyline.
    const point = brushTarget(stroke);
    trackLatest();
    next.point = [...point];
    return {
      kind: "dose",
      stroke: next,
      segments: [{ from: point, to: point, elapsedMs: toAt - acceptedFrom }],
      fromAt: acceptedFrom,
      toAt,
      rawElapsedMs,
      cause: "hold",
      inputs: latest ? [latest.input] : [],
      discardedInputs: inputs.slice(0, -1),
      discardedFrom: fromAt,
    };
  }

  let point = stroke.point;
  let at = fromAt;
  const segments: HeightSegment[] = [];
  const accepted: number[] = [];
  const discardedInputs: number[] = [];
  for (const sample of stroke.path) {
    if (sample.at < fromAt) {
      discardedInputs.push(sample.input);
      if (sample.at >= stroke.pointAt) point = sample.point;
      continue;
    }
    const endAt = Math.max(at, Math.min(toAt, sample.at));
    segments.push({ from: point, to: sample.point, elapsedMs: endAt - at });
    accepted.push(sample.input);
    point = sample.point;
    at = endAt;
  }
  if (toAt > at)
    segments.push({ from: point, to: point, elapsedMs: toAt - at });
  if (latest) next.pointAt = latest.at;
  return {
    kind: "dose",
    stroke: next,
    segments,
    fromAt,
    toAt,
    rawElapsedMs,
    cause: segments.some(
      ({ from, to, elapsedMs }) =>
        elapsedMs > 0 && (from[0] !== to[0] || from[1] !== to[1]),
    )
      ? "move"
      : "hold",
    inputs: accepted,
    discardedInputs,
  };
}

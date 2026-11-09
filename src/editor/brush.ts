import {
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

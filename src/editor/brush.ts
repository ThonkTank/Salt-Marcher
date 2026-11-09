import type { HeightBrush, Point } from "./model";

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
  latest: BrushPoint | null;
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
      input?: number;
      end: boolean;
    }
  | { kind: "stale"; fromAt: number; toAt: number; input: number }
  | {
      kind: "dose";
      point: Point;
      fromAt: number;
      toAt: number;
      rawElapsedMs: number;
      cause: "move" | "hold";
      input?: number;
      discardedFrom?: number;
    }
);

export const PRESS_DOSE_MS = 1000 / 60;
const MAX_DOSE_MS = 50;

/** Target for the complete readiness check, before changing the stroke anchor. */
export function brushTarget(stroke: BrushStroke): Point {
  const latest = stroke.latest;
  return latest && latest.at >= stroke.pointAt ? latest.point : stroke.point;
}

/** Consume one examined time window without retaining rejected time or paths. */
export function decideBrushFrame(
  stroke: BrushStroke,
  now: number,
  reason: BrushWaitReason | null,
): BrushFrameDecision {
  const fromAt = stroke.clock;
  const toAt = Math.max(fromAt, now);
  const next = { ...stroke, clock: toAt };
  const latest = stroke.latest;
  const trackLatest = () => {
    if (latest && latest.at >= stroke.pointAt) {
      next.point = [...latest.point];
      next.pointAt = latest.at;
    }
  };

  // Readiness applies even when the clock did not advance. Only waiting for our
  // own accepted dose permits the next ready window to continue this stroke.
  if (reason !== null) {
    next.latest = null;
    if (reason === "feedback") trackLatest();
    return {
      kind: "wait",
      stroke: next,
      fromAt,
      toAt,
      reason,
      input: latest?.input,
      end: reason !== "feedback",
    };
  }

  const rawElapsedMs = toAt - fromAt;
  if (rawElapsedMs <= 0) return { kind: "none", stroke: next };
  next.latest = null;
  if (latest && latest.at < fromAt) {
    trackLatest();
    return { kind: "stale", stroke: next, fromAt, toAt, input: latest.input };
  }

  const point = brushTarget(stroke);
  const acceptedFrom = toAt - Math.min(rawElapsedMs, MAX_DOSE_MS);
  // A long pause discards its old path as well as its time: the bounded remainder
  // is a stationary dose at the current target, never a catch-up segment.
  if (acceptedFrom > fromAt) next.point = [...point];
  const moving = point[0] !== next.point[0] || point[1] !== next.point[1];
  if (latest) next.pointAt = latest.at;
  return {
    kind: "dose",
    stroke: next,
    point,
    fromAt: acceptedFrom,
    toAt,
    rawElapsedMs,
    cause: moving ? "move" : "hold",
    input: latest?.input,
    ...(acceptedFrom > fromAt ? { discardedFrom: fromAt } : {}),
  };
}

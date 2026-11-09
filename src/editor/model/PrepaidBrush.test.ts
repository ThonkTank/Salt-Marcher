import { describe, expect, it } from "vitest";
import {
  referenceC0Stroke,
  referenceC1Stroke,
} from "../../../scripts/atlas-p0-brush-reference.mjs";
import { beginTimedBrush, planTimedBrushWindow } from "../brush";
import {
  BrushReservations,
  type BrushReservationContext,
} from "./BrushReservations";
import { quarticBrushSegmentIntegral } from "./height";
import {
  PrepaidBrush,
  prepaidMinimumAt,
  type PrepaidBrushOffer,
} from "./PrepaidBrush";
import {
  heightControlAddress,
  heightTileKey,
  type HeightBrush,
  type Point,
} from "./types";
import type { HeightSegment } from "./EditorDocument";

const context: BrushReservationContext = {
  sessionId: "c1-proof",
  gestureId: 1,
  viewId: 2,
  preparationId: 3,
};
const key = heightTileKey(0, 0, 0);
const control = (
  minimum: number,
  time: number,
  index = 0,
): PrepaidBrushOffer => ({
  key,
  index,
  minimum,
  time,
});
const make = (rate = 60) =>
  new PrepaidBrush({ rate, level: 0, context, maxCells: 1000 });

function accept(state: PrepaidBrush, offers: PrepaidBrushOffer[], ack = false) {
  const result = state.offer(offers);
  if (!result.accepted) throw new Error(`Rejected C1: ${result.reason}`);
  expect(state.materialize(result.reservation)).toBe(true);
  if (ack) expect(state.acknowledge(state.freeze()!)).toBe(true);
  return result.changes;
}

/** Candidate coefficients use the production temporal integral and swept floor. */
function candidateOffers(
  brush: HeightBrush,
  path: Point[],
  time: HeightSegment[],
  probes: Point[],
): PrepaidBrushOffer[] {
  return probes.map((point) => {
    let minimum = prepaidMinimumAt(brush, path[0], path[0], point);
    for (let i = 1; i < path.length; i++)
      minimum = Math.max(
        minimum,
        prepaidMinimumAt(brush, path[i - 1], path[i], point),
      );
    let temporal = 0;
    for (const segment of time) {
      const dx = segment.to[0] - segment.from[0];
      const dy = segment.to[1] - segment.from[1];
      const length = Math.hypot(dx, dy);
      const qx = point[0] - segment.from[0];
      const qy = point[1] - segment.from[1];
      const average = length
        ? quarticBrushSegmentIntegral(
            (qx * dx + qy * dy) / length,
            (qx * dy - qy * dx) / length,
            length,
            brush.radius,
          ) / length
        : (prepaidMinimumAt(brush, segment.from, segment.to, point) * 60) /
          Math.abs(brush.amount);
      temporal += (Math.abs(brush.amount) * segment.elapsedMs * average) / 1000;
    }
    const address = heightControlAddress(0, point[0] / 5, point[1] / 5);
    return { key: address.key, index: address.index, minimum, time: temporal };
  });
}

describe("C1 once-only spatial minimum with prepaid time", () => {
  it("uses the click exactly once and credits later time before adding height", () => {
    const state = make();
    expect(accept(state, [control(1, 0)])[0].delta).toBe(1);
    expect(accept(state, [control(1, 0.5)])[0].delta).toBe(0);
    expect(accept(state, [control(1, 0.5)])[0].delta).toBe(0);
    expect(accept(state, [control(1, 0.25)])[0].delta).toBe(0.25);
    expect(state.valueAt(key, 0)).toEqual({
      minimum: 1,
      timeAccount: 1.25,
      total: 1.25,
    });
  });

  it.each([100, 500])("keeps the fixed rate during a %ims hold", (duration) => {
    const state = make();
    accept(state, [control(1, 0)], true);
    let authored = 1;
    for (let at = 20; at <= duration; at += 20)
      authored += accept(state, [control(1, 60 * 0.02)], true)[0].delta;
    expect(state.valueAt(key, 0).timeAccount).toBeCloseTo(
      (60 * duration) / 1000,
      12,
    );
    expect(authored).toBeCloseTo((60 * duration) / 1000, 12);
  });

  it("returns clipped time once and never replays it when a receipt arrives", () => {
    const state = make();
    accept(state, [control(1, 0)]);
    const limited = accept(state, [control(1, 10)])[0];
    expect(limited.acceptedTime).toBe(3);
    expect(limited.discardedTime).toBe(7);
    expect(limited.delta).toBe(2);
    expect(state.acknowledge(state.freeze()!)).toBe(true);
    expect(accept(state, [control(1, 0)])[0].delta).toBe(0);
    expect(state.valueAt(key, 0).timeAccount).toBe(3);
    expect(accept(state, [control(1, 1)])[0].delta).toBe(1);
    expect(state.valueAt(key, 0).timeAccount).toBe(4);
  });

  it("keeps admission and discard nonnegative through rounded cumulative accounts", () => {
    for (const rate of [1, 60, 0.1, 327.8398950131]) {
      const state = make(rate);
      for (let i = 0; i < 1000; i++) {
        const time = rate * (i % 2 ? 0.07 : 0.03);
        const change = accept(
          state,
          [control(rate / 60, time)],
          i % 2 === 1,
        )[0];
        expect(change.acceptedTime).toBeGreaterThanOrEqual(0);
        expect(change.acceptedTime).toBeLessThanOrEqual(time);
        expect(change.discardedTime).toBeGreaterThanOrEqual(0);
        expect(change.acceptedTime + change.discardedTime).toBeCloseTo(
          time,
          12,
        );
      }
    }
  });

  it("counts accepted-but-unapplied increments and preserves the account across receipts", () => {
    const state = make();
    const click = state.offer([control(1, 0)]);
    const held = state.offer([control(1, 4)]);
    if (!click.accepted || !held.accepted)
      throw new Error("Expected admission");
    expect(held.changes[0].discardedTime).toBe(1);
    expect(state.valueAt(key, 0).total).toBe(3);
    const before = state.freeze()!;
    expect(state.materialize(click.reservation)).toBe(true);
    expect(state.materialize(held.reservation)).toBe(true);
    expect(state.acknowledge(before)).toBe(true);
    expect(accept(state, [control(1, 1)])[0].discardedTime).toBe(1);
    expect(state.acknowledge(state.freeze()!)).toBe(true);
    expect(state.valueAt(key, 0).timeAccount).toBe(3);
  });

  it("admits B's real spatial floor while A in the same source tile is saturated", () => {
    const state = make();
    accept(state, [control(1, 3)]);
    const changes = accept(state, [control(1, 0), control(1, 0, 63)]);
    expect(changes.map((change) => change.delta)).toEqual([0, 1]);
    expect(state.valueAt(key, 0).total).toBe(3);
    expect(state.valueAt(key, 63).total).toBe(1);
  });

  it("keeps batch and receipt placement irrelevant when the same time can be admitted", () => {
    const whole = make();
    const parts = make();
    const withReceipts = make();
    accept(whole, [control(1, 2.4)]);
    for (const state of [parts, withReceipts]) {
      accept(state, [control(0.4, 0.3)], state === withReceipts);
      accept(state, [control(1, 0.7)], state === withReceipts);
      accept(state, [control(0.6, 1.4)], state === withReceipts);
      expect(state.valueAt(key, 0).minimum).toBe(whole.valueAt(key, 0).minimum);
      expect(state.valueAt(key, 0).timeAccount).toBeCloseTo(2.4, 14);
      expect(state.valueAt(key, 0).total).toBeCloseTo(2.4, 14);
    }
  });

  it("does not increase the spatial floor on repeated zero-time circles", () => {
    const state = make();
    const brush = { level: 0, radius: 20, amount: 60 };
    const path: Point[] = [
      [20, 20],
      [60, 20],
      [60, 60],
      [20, 60],
      [20, 20],
    ];
    const probes: Point[] = [
      [20, 20],
      [40, 20],
      [60, 40],
      [40, 40],
    ];
    const first = candidateOffers(brush, path, [], probes);
    accept(state, first);
    for (let repetition = 0; repetition < 10; repetition++)
      expect(accept(state, first).every((change) => change.delta === 0)).toBe(
        true,
      );
  });

  it("keeps a slower traversal stronger once its time exceeds the prepaid floor", () => {
    const brush = { level: 0, radius: 20, amount: 60 };
    const path: Point[] = [
      [20, 20],
      [60, 20],
    ];
    const point: Point = [40, 20];
    const fast = make();
    const slow = make();
    const fastOffer = candidateOffers(
      brush,
      path,
      [{ from: path[0], to: path[1], elapsedMs: 20 }],
      [point],
    );
    const slowOffer = candidateOffers(
      brush,
      path,
      [{ from: path[0], to: path[1], elapsedMs: 40 }],
      [point],
    );
    const a = accept(fast, fastOffer)[0];
    const b = accept(slow, slowOffer)[0];
    expect(b.minimum).toBe(a.minimum);
    expect(b.timeAccount).toBeCloseTo(2 * a.timeAccount, 14);
    expect(b.total).toBeGreaterThan(a.total);
  });

  it("fixes the manifest where C0's spatial effect alone exceeds the local cap", () => {
    const brush = { level: 0, radius: 20, amount: 1 };
    const start = { point: [20, 20] as Point, at: 0, input: 0 };
    const points = [
      { point: [60, 20] as Point, at: 20, input: 1 },
      { point: [20, 20] as Point, at: 40, input: 2 },
      { point: [60, 20] as Point, at: 70, input: 3 },
    ];
    const input = { brush, start, windows: [{ at: 70, points, end: true }] };
    const midpoint: Point = [40, 20];
    const c0 = referenceC0Stroke(input, [midpoint]);
    expect(c0.spatial[0]).toBeCloseTo(0.0533203125, 14);
    expect(c0.spatial[0]).toBeGreaterThan(0.05);
    const cap = new BrushReservations({ rate: 1, level: 0, context });
    expect(
      cap.reserve([{ key, index: 4 * 64 + 8, delta: c0.spatial[0] }]),
    ).toEqual({
      accepted: false,
      reason: "effect",
    });

    const state = make(1);
    const stroke = beginTimedBrush(brush, start);
    const batch = planTimedBrushWindow(stroke, input.windows[0]);
    const probes: Point[] = [];
    for (let y = 0; y <= 40; y += 5)
      for (let x = 0; x <= 80; x += 5) probes.push([x, y]);
    const path = [start.point, ...points.map((point) => point.point)];
    const changes = accept(
      state,
      candidateOffers(brush, path, batch.time, probes),
    );
    const expected = referenceC1Stroke(input, probes);
    for (let i = 0; i < probes.length; i++) {
      expect(changes[i].minimum).toBeCloseTo(expected.floor[i], 12);
      expect(changes[i].timeAccount).toBeCloseTo(expected.timeAccount[i], 12);
      expect(changes[i].total).toBeCloseTo(expected.total[i], 12);
      expect(changes[i].total).toBeLessThanOrEqual(0.05);
      expect(changes[i].discardedTime).toBeCloseTo(0, 12);
    }
    expect(state.usage.tiles).toBe(1);
    // No receipt was needed to admit the complete spatial floor and offered time.
    expect(state.usage.receipts).toBe(0);
  });

  it("validates and rejects an entire account update before mutation", () => {
    const state = new PrepaidBrush({
      rate: 60,
      level: 0,
      context,
      maxCells: 1,
    });
    accept(state, [control(1, 0)]);
    expect(state.offer([control(0.5, 1, 1)])).toEqual({
      accepted: false,
      reason: "cells",
    });
    expect(state.valueAt(key, 1).total).toBe(0);
    expect(() => state.offer([control(1.0001, 0)])).toThrow();
    expect(() => state.offer([control(1, -1)])).toThrow();
    expect(() => state.offer([control(1, Number.NaN)])).toThrow();
    expect(state.valueAt(key, 0).timeAccount).toBe(0);
    state.seal();
    expect(state.offer([control(1, 1)])).toEqual({
      accepted: false,
      reason: "closed",
    });
  });

  it("keeps zero/negative rates, fixed direction and combined physical buffers bounded", () => {
    const negative = make(-60);
    expect(accept(negative, [control(1, 2)])[0].delta).toBe(-2);
    const zero = make(0);
    expect(accept(zero, [control(0, 0)])[0].delta).toBe(0);
    expect(zero.usage.cells).toBe(0);
    expect(negative.usage.peakBufferBytes).toBeLessThanOrEqual(
      32 * 1024 * 1024,
    );
    expect(negative.usage.maskBytes).toBe(0);
    expect(
      () =>
        new PrepaidBrush({
          rate: 1,
          level: 0,
          context,
          maxBufferBytes: 33 * 1024 * 1024,
        }),
    ).toThrow();
  });

  it("uses the full continuous segment including interior and exact endpoint", () => {
    const brush = { radius: 20, amount: 60 };
    expect(prepaidMinimumAt(brush, [20, 20], [60, 20], [40, 20])).toBe(1);
    expect(prepaidMinimumAt(brush, [20, 20], [60, 20], [60, 20])).toBe(1);
    expect(prepaidMinimumAt(brush, [20, 20], [60, 20], [40, 30])).toBe(9 / 16);
    expect(prepaidMinimumAt(brush, [20, 20], [60, 20], [40, 40])).toBe(0);
    expect(prepaidMinimumAt(brush, [20, 20], [20, 20], [20, 20])).toBe(1);
  });
});

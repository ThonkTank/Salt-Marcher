import { describe, expect, it } from "vitest";
import { splineWeights } from "./height";
import { HEIGHT_TILE_CELLS, heightTileKey } from "./types";
import {
  BrushReservations,
  type BrushControlEffect,
  type BrushReservation,
  type BrushReservationContext,
} from "./BrushReservations";

const context: BrushReservationContext = {
  sessionId: "r1-reservation-proof",
  gestureId: 7,
  viewId: 3,
  preparationId: 11,
};
const key = heightTileKey(0, 0, 0);
const effect = (
  index: number,
  delta: number,
  tile = key,
): BrushControlEffect => ({
  key: tile,
  index,
  delta,
});
const ledger = (rate = 20) =>
  new BrushReservations({ rate, level: 0, context, maxCells: 100 });

function reserve(
  state: BrushReservations,
  effects: BrushControlEffect[],
): BrushReservation {
  const result = state.reserve(effects);
  if (!result.accepted)
    throw new Error(`Unexpected rejection: ${result.reason}`);
  return result.reservation;
}

describe("R1 local applied/reserved effect proof", () => {
  it("reserves before materialization, charges once, and releases only frozen applied effect", () => {
    const state = ledger(); // |20 ft/s| × .05 s = 1 ft per coefficient.
    const first = reserve(state, [effect(0, 0.6)]);
    expect(state.effectAt(key, 0)).toEqual({
      applied: 0,
      reserved: 0.6,
      total: 0.6,
    });
    expect(state.materialize({ id: first.id })).toBe(false);
    const beforeApplication = state.freeze()!;
    expect(state.materialize(first)).toBe(true);
    expect(state.materialize(first)).toBe(false);
    expect(state.effectAt(key, 0)).toEqual({
      applied: 0.6,
      reserved: 0,
      total: 0.6,
    });
    // An earlier draw cannot acknowledge work materialized after its freeze.
    expect(state.acknowledge(beforeApplication)).toBe(true);
    expect(state.effectAt(key, 0).total).toBe(0.6);
    const drawn = state.freeze()!;
    const next = reserve(state, [effect(0, 0.4)]);
    expect(state.materialize(next)).toBe(true);
    expect(state.acknowledge(drawn)).toBe(true);
    expect(state.effectAt(key, 0).total).toBeCloseTo(0.4, 14);
    expect(state.acknowledge(drawn)).toBe(false);
  });

  it("includes the click in the 50-ms allowance and admits B when A in the same tile is full", () => {
    const state = ledger(60); // B=3; click=1, leaving exactly 2.
    state.materialize(reserve(state, [effect(0, 1)]));
    expect(state.reserve([effect(0, 3)])).toEqual({
      accepted: false,
      reason: "effect",
    });
    reserve(state, [effect(0, 2)]);
    expect(state.effectAt(key, 0).total).toBe(3);
    const b = reserve(state, [effect(63, 3)]);
    expect(state.effectAt(key, 63).reserved).toBe(3);
    expect(state.materialize(b)).toBe(true);
    expect(state.effectAt(key, 0).total).toBe(3);
    expect(state.effectAt(key, 63).total).toBe(3);
    expect(state.reserve([effect(0, Number.EPSILON * 4)])).toEqual({
      accepted: false,
      reason: "effect",
    });
  });

  it("never releases newer applied or still-reserved work through an older receipt", () => {
    const state = ledger();
    state.materialize(reserve(state, [effect(0, 0.2)]));
    const first = state.freeze()!;
    state.materialize(reserve(state, [effect(0, 0.3)]));
    const second = state.freeze()!;
    expect(state.freeze()).toBeNull();
    const pending = reserve(state, [effect(0, 0.4)]);
    expect(state.acknowledge(first)).toBe(true);
    expect(state.effectAt(key, 0).applied).toBeCloseTo(0.3, 14);
    expect(state.effectAt(key, 0).reserved).toBe(0.4);
    expect(state.materialize(pending)).toBe(true);
    expect(state.acknowledge(second)).toBe(true);
    expect(state.effectAt(key, 0).total).toBeCloseTo(0.4, 14);
    expect(state.acknowledge(first)).toBe(false);
    expect(state.acknowledge(second)).toBe(false);
  });

  it("handles newer-before-older receipts without freeing the same effect twice", () => {
    const state = ledger();
    state.materialize(reserve(state, [effect(0, 0.2)]));
    const first = state.freeze()!;
    state.materialize(reserve(state, [effect(0, 0.3)]));
    const second = state.freeze()!;
    state.materialize(reserve(state, [effect(0, 0.1)]));
    expect(state.acknowledge(second)).toBe(true);
    expect(state.effectAt(key, 0).total).toBeCloseTo(0.1, 14);
    expect(state.acknowledge(first)).toBe(false);
    expect(state.usage.receipts).toBe(0);
  });

  it.each([
    { sessionId: "other-session" },
    { gestureId: 8 },
    { viewId: 4 },
    { preparationId: 12 },
    { id: 100 },
  ])(
    "rejects receipt identity mismatch %j without creating reserve",
    (wrong) => {
      const state = ledger();
      state.materialize(reserve(state, [effect(0, 1)]));
      const receipt = state.freeze()!;
      expect(state.acknowledge({ ...receipt, ...wrong })).toBe(false);
      expect(state.effectAt(key, 0).total).toBe(1);
      expect(state.reserve([effect(0, 0.1)]).accepted).toBe(false);
      expect(state.acknowledge(receipt)).toBe(true);
      expect(state.effectAt(key, 0).total).toBe(0);
    },
  );

  it("seals new input but lets only already reserved work finish", () => {
    const state = ledger();
    const terminal = reserve(state, [effect(63, 0.8)]);
    state.seal();
    expect(state.reserve([effect(0, 0.1)])).toEqual({
      accepted: false,
      reason: "closed",
    });
    expect(state.materialize(terminal)).toBe(true);
    expect(state.materialize(terminal)).toBe(false);
    const final = state.freeze()!;
    expect(state.acknowledge(final)).toBe(true);
    expect(state.usage.reservations).toBe(0);
  });

  it("invalidates old context receipts while retaining accepted effect", () => {
    const state = ledger();
    state.materialize(reserve(state, [effect(0, 0.2)]));
    const old = state.freeze()!;
    const pending = reserve(state, [effect(0, 0.4)]);
    state.changeContext({ ...context, preparationId: 12 });
    expect(state.acknowledge(old)).toBe(false);
    expect(state.reserve([effect(63, 0.1)]).accepted).toBe(false);
    expect(state.materialize(pending)).toBe(true);
    expect(state.effectAt(key, 0).total).toBeCloseTo(0.6, 14);
    expect(state.acknowledge(state.freeze()!)).toBe(true);
    expect(state.effectAt(key, 0).total).toBe(0);
    expect(() =>
      state.changeContext({ ...context, sessionId: "replacement" }),
    ).toThrow();
  });

  it("keeps an entire rejected effect vector atomic", () => {
    const state = ledger();
    reserve(state, [effect(0, 0.9)]);
    const before = state.usage;
    expect(state.reserve([effect(1, 0.5), effect(0, 0.2)])).toEqual({
      accepted: false,
      reason: "effect",
    });
    expect(state.effectAt(key, 1).total).toBe(0);
    expect(state.effectAt(key, 0).total).toBe(0.9);
    expect(state.usage.cells).toBe(before.cells);
    expect(state.usage.reservations).toBe(before.reservations);
    expect(state.usage.bufferBytes).toBe(before.bufferBytes);
    expect(() => state.reserve([effect(1, 0.2), effect(1, 0.2)])).toThrow();
    expect(state.effectAt(key, 1).total).toBe(0);
  });

  it("accepts exactly 100,000 coefficients and atomically rejects another", () => {
    const state = new BrushReservations({ rate: 20, level: 0, context });
    const inputs = Array.from({ length: 100_000 }, (_, i) =>
      effect(
        i % HEIGHT_TILE_CELLS,
        0.1,
        heightTileKey(0, Math.floor(i / HEIGHT_TILE_CELLS), 0),
      ),
    );
    const ticket = reserve(state, inputs);
    expect(state.usage.cells).toBe(100_000);
    expect(state.reserve([effect(0, 0.1, heightTileKey(0, 26, 0))])).toEqual({
      accepted: false,
      reason: "cells",
    });
    expect(state.usage.cells).toBe(100_000);
    expect(state.materialize(ticket)).toBe(true);
    expect(state.usage.bufferBytes).toBeLessThanOrEqual(32 * 1024 * 1024);
  });

  it("accepts exactly 512 author tiles and atomically rejects tile 513", () => {
    const state = new BrushReservations({ rate: 20, level: 0, context });
    reserve(
      state,
      Array.from({ length: 512 }, (_, x) =>
        effect(0, 0.1, heightTileKey(0, x, 0)),
      ),
    );
    const bytes = state.usage.bufferBytes;
    expect(state.usage.tiles).toBe(512);
    expect(state.reserve([effect(0, 0.1, heightTileKey(0, 512, 0))])).toEqual({
      accepted: false,
      reason: "tiles",
    });
    expect(state.usage.tiles).toBe(512);
    expect(state.usage.bufferBytes).toBe(bytes);
    expect(state.usage.peakBufferBytes).toBeLessThanOrEqual(32 * 1024 * 1024);
    expect(state.usage.maskBytes).toBeLessThanOrEqual(256 * 1024);
  });

  it("bounds outstanding work at 128 tickets and frees a slot only when consumed", () => {
    const state = new BrushReservations({ rate: 20, level: 0, context });
    const tickets = Array.from({ length: 128 }, (_, i) =>
      reserve(state, [effect(i, 0.1)]),
    );
    expect(state.reserve([effect(128, 0.1)])).toEqual({
      accepted: false,
      reason: "work",
    });
    expect(state.effectAt(key, 128).total).toBe(0);
    expect(state.materialize(tickets[0])).toBe(true);
    expect(state.reserve([effect(128, 0.1)]).accepted).toBe(true);
  });

  it("accounts for ticket, tile and receipt buffers before allocation", () => {
    const maxBufferBytes = 4 * 16 + HEIGHT_TILE_CELLS * 4 + 2 * 12;
    const state = new BrushReservations({
      rate: 20,
      level: 0,
      context,
      maxCells: 4,
      maxBufferBytes,
    });
    const ticket = reserve(state, [effect(0, 0.1), effect(1, 0.1)]);
    expect(state.usage.bufferBytes).toBe(maxBufferBytes);
    expect(state.freeze()).toBeNull();
    expect(state.reserve([effect(2, 0.1)])).toEqual({
      accepted: false,
      reason: "buffers",
    });
    expect(state.effectAt(key, 2).total).toBe(0);
    state.materialize(ticket);
    expect(state.freeze()).not.toBeNull();
    expect(state.usage.peakBufferBytes).toBe(maxBufferBytes);
  });

  it("enforces the fixed direction, author level, world and zero-rate behavior", () => {
    const state = ledger(-20);
    reserve(state, [effect(0, -0.5)]);
    expect(state.effectAt(key, 0).reserved).toBe(0.5);
    expect(() => state.reserve([effect(1, 0.1)])).toThrow();
    expect(() =>
      state.reserve([effect(0, -0.1, heightTileKey(1, 0, 0))]),
    ).toThrow();
    expect(() =>
      state.reserve([effect(0, -0.1, heightTileKey(0, 1_000_000, 0))]),
    ).toThrow();
    expect(() => state.reserve([effect(0, Number.NaN)])).toThrow();
    const zero = ledger(0);
    reserve(zero, [effect(0, 0)]);
    expect(zero.usage.cells).toBe(0);
    expect(zero.limit).toBe(0);
    expect(() => zero.reserve([effect(0, 0.1)])).toThrow();
  });

  it("transfers the coefficient bound to positive normalized cubic reconstruction", () => {
    const state = ledger();
    const controls = Array.from({ length: 16 }, (_, i) =>
      i % 3 === 0 ? state.limit : state.limit * (i / 16),
    );
    const applied = reserve(
      state,
      controls.map((value, i) => effect(i, value / 2)),
    );
    state.materialize(applied);
    reserve(
      state,
      controls.map((value, i) => effect(i, value / 2)),
    );
    for (const x of [0, 0.01, 0.25, 0.5, 0.9, 1]) {
      const wx = splineWeights(x);
      expect(wx.every((weight) => weight >= 0)).toBe(true);
      expect(wx.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 14);
      for (const y of [0, 0.125, 0.6, 0.99, 1]) {
        const wy = splineWeights(y);
        expect(wy.every((weight) => weight >= 0)).toBe(true);
        expect(wy.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 14);
        let reconstructed = 0;
        let worldEdge = 0;
        for (let j = 0; j < 4; j++)
          for (let i = 0; i < 4; i++) {
            const term = wx[i] * wy[j] * state.effectAt(key, j * 4 + i).total;
            reconstructed += term;
            if (i > 0 && j > 0) worldEdge += term;
          }
        // Nonnegative weights summing to one form a convex combination;
        // dropping outside-world controls only reduces its magnitude.
        expect(reconstructed).toBeGreaterThanOrEqual(0);
        expect(reconstructed).toBeLessThanOrEqual(state.limit + 1e-14);
        expect(worldEdge).toBeLessThanOrEqual(reconstructed);
      }
    }
  });
});

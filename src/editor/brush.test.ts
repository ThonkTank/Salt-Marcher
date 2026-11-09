import { describe, expect, it } from "vitest";
import {
  brushTarget,
  decideBrushFrame,
  type BrushStroke,
  type BrushWaitReason,
} from "./brush";

function stroke(overrides: Partial<BrushStroke> = {}): BrushStroke {
  return {
    id: 1,
    pointerId: 7,
    brush: { level: 0, radius: 20, amount: 10 },
    point: [0, 0],
    pointAt: 80,
    clock: 100,
    latest: null,
    ...overrides,
  };
}

describe("brush frame decisions", () => {
  it("keeps a move until time advances and leaves its geometry for successful application", () => {
    const held = stroke({ latest: { point: [30, 0], at: 110, input: 2 } });
    const original = structuredClone(held);
    const noTime = decideBrushFrame(held, 99, null);
    expect(noTime.kind).toBe("none");
    expect(noTime.stroke.clock).toBe(100);
    expect(noTime.stroke.latest).toEqual(held.latest);

    const move = decideBrushFrame(noTime.stroke, 120, null);
    expect(move.kind).toBe("dose");
    if (move.kind !== "dose") throw new Error("Expected a move dose.");
    expect(move.cause).toBe("move");
    expect(move.stroke.point).toEqual([0, 0]);
    expect(move.point).toEqual([30, 0]);
    expect(move.toAt - move.fromAt).toBe(20);
    expect(move.stroke.pointAt).toBe(110);
    expect(move.stroke.latest).toBeNull();
    expect(held).toEqual(original);

    // The controller moves the anchor after applying the segment. Holding then
    // continues at the same rate without manufacturing another pointer input.
    const applied = { ...move.stroke, point: move.point };
    const hold = decideBrushFrame(applied, 140, null);
    expect(hold.kind).toBe("dose");
    if (hold.kind !== "dose") throw new Error("Expected a hold dose.");
    expect(hold.cause).toBe("hold");
    expect(hold.input).toBeUndefined();
    expect(hold.toAt - hold.fromAt).toBe(20);
    expect(hold.stroke.point).toEqual([30, 0]);
  });

  it("discards feedback wait time and travel before continuing at the latest position", () => {
    const held = stroke({ latest: { point: [60, 0], at: 170, input: 2 } });
    const waiting = decideBrushFrame(held, 180, "feedback");
    expect(waiting.kind).toBe("wait");
    if (waiting.kind !== "wait") throw new Error("Expected feedback wait.");
    expect(waiting.end).toBe(false);
    expect(waiting.fromAt).toBe(100);
    expect(waiting.toAt).toBe(180);
    expect(waiting.stroke.point).toEqual([60, 0]);
    expect(waiting.stroke.pointAt).toBe(170);
    expect(waiting.stroke.latest).toBeNull();

    const resumed = decideBrushFrame(waiting.stroke, 200, null);
    expect(resumed.kind).toBe("dose");
    if (resumed.kind !== "dose") throw new Error("Expected resumed hold.");
    expect(resumed.cause).toBe("hold");
    expect(resumed.point).toEqual([60, 0]);
    expect(resumed.fromAt).toBe(180);
    expect(resumed.toAt - resumed.fromAt).toBe(20);
    expect(resumed.discardedFrom).toBeUndefined();
  });

  it("ends an unavailable segment without moving its anchor, even in a zero-time window", () => {
    const held = stroke({ latest: { point: [1000, 0], at: 100, input: 2 } });
    const reasons: BrushWaitReason[] = [
      "sources",
      "terrain",
      "busy",
      "outside",
    ];
    for (const reason of reasons) {
      const rejected = decideBrushFrame(held, 100, reason);
      expect(rejected.kind).toBe("wait");
      if (rejected.kind !== "wait") throw new Error("Expected rejection.");
      expect(rejected.end).toBe(true);
      expect(rejected.reason).toBe(reason);
      expect(rejected.stroke.point).toEqual([0, 0]);
      expect(rejected.stroke.pointAt).toBe(80);
      expect(rejected.stroke.latest).toBeNull();
    }
    expect(held.latest?.point).toEqual([1000, 0]);
  });

  it("rejects the entire window for stale input but follows a valid newer anchor", () => {
    const held = stroke({ latest: { point: [40, 0], at: 90, input: 2 } });
    const stale = decideBrushFrame(held, 300, null);
    expect(stale.kind).toBe("stale");
    if (stale.kind !== "stale") throw new Error("Expected stale input.");
    expect(stale.fromAt).toBe(100);
    expect(stale.toAt).toBe(300);
    expect(stale.stroke.point).toEqual([40, 0]);
    expect(stale.stroke.pointAt).toBe(90);
    expect(stale.stroke.latest).toBeNull();

    const next = decideBrushFrame(stale.stroke, 320, null);
    expect(next.kind).toBe("dose");
    if (next.kind !== "dose") throw new Error("Expected a new hold window.");
    expect(next.fromAt).toBe(300);
    expect(next.toAt - next.fromAt).toBe(20);
    expect(next.cause).toBe("hold");
  });

  it("never rewinds an established position for older input", () => {
    const held = stroke({
      point: [50, 0],
      latest: { point: [10, 0], at: 70, input: 2 },
    });
    expect(brushTarget(held)).toEqual([50, 0]);
    for (const reason of [null, "feedback"] as const) {
      const rejected = decideBrushFrame(held, 120, reason);
      expect(rejected.kind).toBe(reason === null ? "stale" : "wait");
      expect(rejected.stroke.point).toEqual([50, 0]);
      expect(rejected.stroke.pointAt).toBe(80);
      expect(rejected.stroke.latest).toBeNull();
    }
    expect(
      brushTarget({ ...held, latest: { point: [60, 0], at: 80, input: 3 } }),
    ).toEqual([60, 0]);
  });

  it("caps a long window to a stationary 50 ms dose and discards the old path", () => {
    const held = stroke({ latest: { point: [80, 0], at: 590, input: 2 } });
    const capped = decideBrushFrame(held, 600, null);
    expect(capped.kind).toBe("dose");
    if (capped.kind !== "dose") throw new Error("Expected capped dose.");
    expect(capped.rawElapsedMs).toBe(500);
    expect(capped.discardedFrom).toBe(100);
    expect(capped.fromAt).toBe(550);
    expect(capped.toAt).toBe(600);
    expect(capped.cause).toBe("hold");
    expect(capped.stroke.point).toEqual([80, 0]);
    expect(capped.point).toEqual([80, 0]);
    expect(capped.stroke.pointAt).toBe(590);
    expect(capped.stroke.clock).toBe(600);
    expect(held.point).toEqual([0, 0]);
  });

  it("retains the full segment at the 50 ms boundary", () => {
    const held = stroke({ latest: { point: [80, 0], at: 140, input: 2 } });
    const exact = decideBrushFrame(held, 150, null);
    expect(exact.kind).toBe("dose");
    if (exact.kind !== "dose") throw new Error("Expected uncapped dose.");
    expect(exact.toAt - exact.fromAt).toBe(50);
    expect(exact.discardedFrom).toBeUndefined();
    expect(exact.cause).toBe("move");
    expect(exact.stroke.point).toEqual([0, 0]);
    expect(exact.point).toEqual([80, 0]);
  });
});

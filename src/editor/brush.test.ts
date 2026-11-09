import { describe, expect, it } from "vitest";
import {
  brushTarget,
  brushPathBounds,
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
    path: [],
    ...overrides,
  };
}

describe("brush frame decisions", () => {
  it("keeps a move until time advances and leaves its geometry for successful application", () => {
    const held = stroke({ path: [{ point: [30, 0], at: 110, input: 2 }] });
    const original = structuredClone(held);
    const noTime = decideBrushFrame(held, 99, null);
    expect(noTime.kind).toBe("none");
    expect(noTime.stroke.clock).toBe(100);
    expect(noTime.stroke.path.at(-1)).toEqual(held.path.at(-1));

    const move = decideBrushFrame(noTime.stroke, 120, null);
    expect(move.kind).toBe("dose");
    if (move.kind !== "dose") throw new Error("Expected a move dose.");
    expect(move.cause).toBe("move");
    expect(move.stroke.point).toEqual([0, 0]);
    expect(move.segments.at(-1)!.to).toEqual([30, 0]);
    expect(move.toAt - move.fromAt).toBe(20);
    expect(move.stroke.pointAt).toBe(110);
    expect(move.stroke.path.at(-1)).toBeUndefined();
    expect(held).toEqual(original);

    // The controller moves the anchor after applying the segment. Holding then
    // continues at the same rate without manufacturing another pointer input.
    const applied = { ...move.stroke, point: move.segments.at(-1)!.to };
    const hold = decideBrushFrame(applied, 140, null);
    expect(hold.kind).toBe("dose");
    if (hold.kind !== "dose") throw new Error("Expected a hold dose.");
    expect(hold.cause).toBe("hold");
    expect(hold.inputs).toEqual([]);
    expect(hold.toAt - hold.fromAt).toBe(20);
    expect(hold.stroke.point).toEqual([30, 0]);
  });

  it("discards feedback wait time and travel before continuing at the latest position", () => {
    const held = stroke({ path: [{ point: [60, 0], at: 170, input: 2 }] });
    const waiting = decideBrushFrame(held, 180, "feedback", "after-draw");
    expect(waiting.kind).toBe("wait");
    if (waiting.kind !== "wait") throw new Error("Expected feedback wait.");
    expect(waiting.end).toBe(false);
    expect(waiting.fromAt).toBe(100);
    expect(waiting.toAt).toBe(180);
    expect(waiting.stroke.point).toEqual([60, 0]);
    expect(waiting.stroke.pointAt).toBe(170);
    expect(waiting.stroke.path.at(-1)).toBeUndefined();

    const resumed = decideBrushFrame(waiting.stroke, 200, null);
    expect(resumed.kind).toBe("dose");
    if (resumed.kind !== "dose") throw new Error("Expected resumed hold.");
    expect(resumed.cause).toBe("hold");
    expect(resumed.segments.at(-1)!.to).toEqual([60, 0]);
    expect(resumed.fromAt).toBe(180);
    expect(resumed.toAt - resumed.fromAt).toBe(20);
    expect(resumed.discardedFrom).toBeUndefined();
  });

  it("keeps normal pending time through repeated input and the successful draw", () => {
    let held = stroke();
    for (const at of [102, 104, 108, 112, 116]) {
      held = {
        ...held,
        path: [...held.path, { point: [at - 100, 0], at, input: at }],
      };
      const pending = decideBrushFrame(held, at, "feedback");
      expect(pending.kind).toBe("none");
      expect(pending.stroke.clock).toBe(100);
      expect(pending.stroke.path.at(-1)).toEqual(held.path.at(-1));
      held = pending.stroke;
    }
    // Submission only releases the pending dose. It neither spends this time
    // nor starts an extra dose after drawing the frame.
    const drawn = decideBrushFrame(held, 120, null, "after-draw");
    expect(drawn.kind).toBe("none");
    expect(drawn.stroke.clock).toBe(100);
    expect(drawn.stroke.path.at(-1)).toEqual(held.path.at(-1));

    const next = decideBrushFrame(drawn.stroke, 124, null);
    expect(next.kind).toBe("dose");
    if (next.kind !== "dose") throw new Error("Expected the ready interval.");
    expect(next.fromAt).toBe(100);
    expect(next.toAt - next.fromAt).toBe(24);
    expect(next.segments.at(-1)!.to).toEqual([16, 0]);
    expect(next.inputs).toEqual([102, 104, 108, 112, 116]);
  });

  it("accounts one blocked draw cycle once, then accepts only new time and travel", () => {
    const held = stroke({ path: [{ point: [80, 0], at: 120, input: 2 }] });
    const pending = decideBrushFrame(held, 125, "feedback");
    expect(pending.stroke.clock).toBe(100);
    const blocked = decideBrushFrame(
      pending.stroke,
      140,
      "feedback",
      "after-draw",
    );
    expect(blocked.kind).toBe("wait");
    expect(blocked.stroke.clock).toBe(140);
    expect(blocked.stroke.point).toEqual([80, 0]);
    expect(blocked.stroke.path.at(-1)).toBeUndefined();

    const drawn = decideBrushFrame(blocked.stroke, 144, null, "after-draw");
    const resumed = decideBrushFrame(
      { ...drawn.stroke, path: [{ point: [90, 0], at: 150, input: 3 }] },
      155,
      null,
    );
    expect(resumed.kind).toBe("dose");
    if (resumed.kind !== "dose") throw new Error("Expected a fresh move.");
    expect(resumed.fromAt).toBe(140);
    expect(resumed.toAt - resumed.fromAt).toBe(15);
    expect(resumed.stroke.point).toEqual([80, 0]);
    expect(resumed.segments.at(-1)!.to).toEqual([90, 0]);
  });

  it("still ends missing terrain and sources before a pending draw", () => {
    const held = stroke({ path: [{ point: [80, 0], at: 110, input: 2 }] });
    for (const reason of ["sources", "terrain", "busy", "outside"] as const) {
      const rejected = decideBrushFrame(held, 120, reason);
      expect(rejected.kind).toBe("wait");
      if (rejected.kind !== "wait") throw new Error("Expected rejection.");
      expect(rejected.end).toBe(true);
      expect(rejected.stroke.clock).toBe(120);
      expect(rejected.stroke.path.at(-1)).toBeUndefined();
      expect(rejected.stroke.point).toEqual([0, 0]);
    }
  });

  it("ends an unavailable segment without moving its anchor, even in a zero-time window", () => {
    const held = stroke({ path: [{ point: [1000, 0], at: 100, input: 2 }] });
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
      expect(rejected.stroke.path.at(-1)).toBeUndefined();
    }
    expect(held.path.at(-1)?.point).toEqual([1000, 0]);
  });

  it("rejects the entire window for stale input but follows a valid newer anchor", () => {
    const held = stroke({ path: [{ point: [40, 0], at: 90, input: 2 }] });
    const stale = decideBrushFrame(held, 300, null);
    expect(stale.kind).toBe("stale");
    if (stale.kind !== "stale") throw new Error("Expected stale input.");
    expect(stale.fromAt).toBe(100);
    expect(stale.toAt).toBe(300);
    expect(stale.stroke.point).toEqual([40, 0]);
    expect(stale.stroke.pointAt).toBe(90);
    expect(stale.stroke.path.at(-1)).toBeUndefined();

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
      path: [{ point: [10, 0], at: 70, input: 2 }],
    });
    expect(brushTarget(held)).toEqual([50, 0]);
    for (const reason of [null, "feedback"] as const) {
      const rejected = decideBrushFrame(
        held,
        120,
        reason,
        reason === null ? "accept" : "after-draw",
      );
      expect(rejected.kind).toBe(reason === null ? "stale" : "wait");
      expect(rejected.stroke.point).toEqual([50, 0]);
      expect(rejected.stroke.pointAt).toBe(80);
      expect(rejected.stroke.path.at(-1)).toBeUndefined();
    }
    expect(
      brushTarget({ ...held, path: [{ point: [60, 0], at: 80, input: 3 }] }),
    ).toEqual([60, 0]);
  });

  it("caps a long window to a stationary 50 ms dose and discards the old path", () => {
    const held = stroke({ path: [{ point: [80, 0], at: 590, input: 2 }] });
    const capped = decideBrushFrame(held, 600, null);
    expect(capped.kind).toBe("dose");
    if (capped.kind !== "dose") throw new Error("Expected capped dose.");
    expect(capped.rawElapsedMs).toBe(500);
    expect(capped.discardedFrom).toBe(100);
    expect(capped.fromAt).toBe(550);
    expect(capped.toAt).toBe(600);
    expect(capped.cause).toBe("hold");
    expect(capped.stroke.point).toEqual([80, 0]);
    expect(capped.segments.at(-1)!.to).toEqual([80, 0]);
    expect(capped.stroke.pointAt).toBe(590);
    expect(capped.stroke.clock).toBe(600);
    expect(held.point).toEqual([0, 0]);
  });

  it("retains the full segment at the 50 ms boundary", () => {
    const held = stroke({ path: [{ point: [80, 0], at: 140, input: 2 }] });
    const exact = decideBrushFrame(held, 150, null);
    expect(exact.kind).toBe("dose");
    if (exact.kind !== "dose") throw new Error("Expected uncapped dose.");
    expect(exact.toAt - exact.fromAt).toBe(50);
    expect(exact.discardedFrom).toBeUndefined();
    expect(exact.cause).toBe("move");
    expect(exact.stroke.point).toEqual([0, 0]);
    expect(exact.segments.at(-1)!.to).toEqual([80, 0]);
  });

  it("preserves a corner and accounts later dwelling at its actual location", () => {
    const held = stroke({
      path: [
        { point: [0, 80], at: 108, input: 2 },
        { point: [80, 0], at: 116, input: 3 },
      ],
    });
    const next = decideBrushFrame(held, 132, null);
    expect(next.kind).toBe("dose");
    if (next.kind !== "dose") throw new Error("Expected a complete path.");
    expect(next.segments).toEqual([
      { from: [0, 0], to: [0, 80], elapsedMs: 8 },
      { from: [0, 80], to: [80, 0], elapsedMs: 8 },
      { from: [80, 0], to: [80, 0], elapsedMs: 16 },
    ]);
    expect(next.inputs).toEqual([2, 3]);
    expect(brushPathBounds(held)).toEqual([-30, -30, 110, 110]);
  });

  it("moves a zero-duration anchor without manufacturing stroke exposure", () => {
    const held = stroke({
      path: [
        { point: [0, 80], at: 100, input: 2 },
        { point: [80, 0], at: 110, input: 3 },
      ],
    });
    const next = decideBrushFrame(held, 116, null);
    expect(next.kind).toBe("dose");
    if (next.kind !== "dose") throw new Error("Expected a complete path.");
    expect(next.segments).toEqual([
      { from: [0, 0], to: [0, 80], elapsedMs: 0 },
      { from: [0, 80], to: [80, 0], elapsedMs: 10 },
      { from: [80, 0], to: [80, 0], elapsedMs: 6 },
    ]);
    expect(
      next.segments.reduce((sum, segment) => sum + segment.elapsedMs, 0),
    ).toBe(16);
  });
});

import { describe, expect, it } from "vitest";
import { heightBrushReadBounds, type Bounds, type Point } from "./model";
import {
  beginTimedBrush,
  MAX_BRUSH_POINTS,
  normalizeBrushTimestamp,
  planTimedBrushWindow,
  brushTarget,
  brushPathRegions,
  type BrushStroke,
} from "./brush";

describe("R1 causal input plan", () => {
  const start = { point: [0, 0] as [number, number], at: 0, input: 0 };
  const brush = { level: 0, radius: 40, amount: 60 };

  it("retains equal-time corners and allocates only new time by arclength", () => {
    const stroke = beginTimedBrush(brush, start);
    const planned = planTimedBrushWindow(stroke, {
      at: 40,
      points: [
        { point: [0, 40], at: 40, input: 1 },
        { point: [120, 40], at: 40, input: 2 },
      ],
      end: true,
    });
    expect(planned.path.points).toEqual([
      [0, 40],
      [120, 40],
    ]);
    expect(planned.time).toEqual([
      { from: [0, 0], to: [0, 40], elapsedMs: 10 },
      { from: [0, 40], to: [120, 40], elapsedMs: 30 },
    ]);
    expect(stroke.clock).toBe(0);
    expect(() =>
      planTimedBrushWindow(planned.stroke, { at: 60, points: [] }),
    ).toThrow();
    const delayed = planTimedBrushWindow(stroke, {
      at: 500,
      points: [
        { point: [0, 40], at: 250, input: 1 },
        { point: [120, 40], at: 500, input: 2 },
      ],
      end: true,
    });
    expect(delayed.offeredTimeMs).toBe(500);
    expect(delayed.time.map((segment) => segment.elapsedMs)).toEqual([25, 25]);
    expect(delayed.stroke.clock).toBe(500);
    expect(delayed.path.points).toEqual([
      [0, 40],
      [120, 40],
    ]);
  });

  it("rejects ambiguous input atomically and reserves the128th point for Up", () => {
    const stroke = beginTimedBrush(brush, start);
    const points = Array.from({ length: MAX_BRUSH_POINTS }, (_, index) => ({
      point: [index, 0] as [number, number],
      at: index + 1,
      input: index + 1,
    }));
    expect(
      planTimedBrushWindow(stroke, { at: 128, points: points.slice(0, -1) })
        .path.points,
    ).toHaveLength(127);
    expect(() => planTimedBrushWindow(stroke, { at: 128, points })).toThrow();
    expect(
      planTimedBrushWindow(stroke, { at: 128, points, end: true }).path.points,
    ).toHaveLength(128);
    expect(() =>
      planTimedBrushWindow(stroke, {
        at: 129,
        points: [...points, { point: [129, 0], at: 129, input: 129 }],
        end: true,
      }),
    ).toThrow();
    for (const invalid of [
      [{ point: [0, 0] as [number, number], at: NaN, input: 1 }],
      [
        { point: [0, 0] as [number, number], at: 10, input: 1 },
        { point: [1, 0] as [number, number], at: 9, input: 2 },
      ],
      [
        { point: [0, 0] as [number, number], at: 10, input: 1 },
        { point: [1, 0] as [number, number], at: 11, input: 1 },
      ],
      [{ point: [0, 0] as [number, number], at: 200, input: 1 }],
    ])
      expect(() =>
        planTimedBrushWindow(stroke, { at: 128, points: invalid }),
      ).toThrow();
    expect(stroke.point).toEqual([0, 0]);
    expect(stroke.clock).toBe(0);
    expect(stroke.sealed).toBe(false);
  });

  it("normalizes timestamps without turning delivery delay into hold time", () => {
    const origin = 1_800_000_000_000;
    expect(normalizeBrushTimestamp(115, 200, origin)).toBe(115);
    expect(normalizeBrushTimestamp(origin + 115, 200, origin)).toBe(115);
    for (const raw of [-1, 201, origin + 201, NaN, Infinity])
      expect(() => normalizeBrushTimestamp(raw, 200, origin)).toThrow();
    const stroke = beginTimedBrush(brush, start);
    const planned = planTimedBrushWindow(stroke, {
      at: 70,
      points: [{ point: [160, 0], at: 20, input: 1 }],
      end: true,
    });
    expect(planned.offeredTimeMs).toBe(20);
    expect(planned.stroke.point).toEqual([160, 0]);
  });

  it("requires the actual Up sample and never substitutes its delayed arrival", () => {
    const stroke = beginTimedBrush(brush, start);
    const before = structuredClone(stroke);
    expect(() =>
      planTimedBrushWindow(stroke, { at: 70, points: [], end: true }),
    ).toThrow("Pinselende benötigt seinen Eingabepunkt mit Zeitstempel.");
    expect(stroke).toEqual(before);

    const released = planTimedBrushWindow(stroke, {
      at: 70,
      points: [{ point: [0, 0], at: 20, input: 1 }],
      end: true,
    });
    expect(released.time).toEqual([
      { from: [0, 0], to: [0, 0], elapsedMs: 20 },
    ]);
    expect(released.offeredTimeMs).toBe(20);
    expect(released.stroke.clock).toBe(20);
    expect(released.stroke.sealed).toBe(true);

    const held = planTimedBrushWindow(stroke, { at: 120, points: [] });
    const lateRelease = planTimedBrushWindow(held.stroke, {
      at: 140,
      points: [{ point: [0, 0], at: 115, input: 1 }],
      end: true,
    });
    expect(lateRelease.time).toEqual([]);
    expect(lateRelease.offeredTimeMs).toBe(0);
    expect(lateRelease.stroke.clock).toBe(120);
    expect(lateRelease.stroke.sealed).toBe(true);
  });
});

function stroke(points: Point[], radius = 20): BrushStroke {
  return {
    ...beginTimedBrush(
      { level: 0, radius, amount: 1 },
      { point: points[0], at: 0, input: 0 },
    ),
    id: 1,
    pointerId: 1,
    path: points
      .slice(1)
      .map((point, i) => ({ point, at: i + 1, input: i + 1 })),
  };
}

describe("exact local readiness regions", () => {
  it.each([
    [
      [0, 0],
      [500, 0],
      [500, 500],
    ],
    [
      [0, 0],
      [20, 30],
      [-20, 60],
      [0, 0],
    ],
    [
      [-100000000, -100000000],
      [-99999900, -99999900],
    ],
    [
      [99999900, 99999900],
      [100000000, 100000000],
    ],
    Array.from({ length: 128 }, (_, i) => [i * 16, (i % 2) * 16]),
  ])("keeps the original swept union for %j", (...raw) => {
    const points = raw as Point[];
    const state = stroke(points);
    const expected: Bounds[] = [
      heightBrushReadBounds(state.brush, points[0], points[0]),
    ];
    for (let i = 1; i < points.length; i++)
      expected.push(
        heightBrushReadBounds(state.brush, points[i - 1], points[i]),
      );
    const actual = brushPathRegions(state);
    const axis = (indices: [number, number]) => {
      const edges = [
        ...new Set(
          [...expected, ...actual].flatMap((r) => indices.map((i) => r[i])),
        ),
      ].sort((a, b) => a - b);
      return [...edges, ...edges.slice(1).map((v, i) => (v + edges[i]) / 2)];
    };
    const contains = (regions: Bounds[], x: number, y: number) =>
      regions.some((r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]);
    for (const x of axis([0, 2]))
      for (const y of axis([1, 3]))
        expect(contains(actual, x, y)).toBe(contains(expected, x, y));
    expect(brushTarget(state)).toEqual(points.at(-1));
  });

  it("does not turn an unseen L-shaped interior into a readiness requirement", () => {
    const regions = brushPathRegions(
      stroke([
        [0, 0],
        [500, 0],
        [500, 500],
      ]),
    );
    expect(
      regions.some(
        (r) => 250 >= r[0] && 250 <= r[2] && 250 >= r[1] && 250 <= r[3],
      ),
    ).toBe(false);
  });
});

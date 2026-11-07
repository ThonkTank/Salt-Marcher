import { expect, it } from "vitest";
import { paintCity } from "./cityPaint";
import { decideLod } from "./lod";
import type { MapFeature } from "./generated/MapFeature";
import type { CityView } from "./cityView";

it("paints supplied immutable features in layer and author order", () => {
  const calls: string[] = [];
  const c = {
    canvas: { width: 1000, height: 1000 },
    getTransform: () => ({ a: 1, d: 1, e: 0, f: 0 }),
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    save() {},
    restore() {},
    fill(this: { fillStyle: string }) {
      calls.push(`fill:${this.fillStyle}`);
    },
    stroke(this: { strokeStyle: string }) {
      calls.push(`stroke:${this.strokeStyle}`);
    },
    fillRect() {
      calls.push("density");
    },
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    lineJoin: "",
    lineCap: "",
  } as unknown as CanvasRenderingContext2D;
  const f = (id: string, kind: string, rank: number): MapFeature => ({
    id,
    kind,
    rank,
    name: "",
    important: false,
    paths: [
      [
        [0, 0],
        [100, 0],
        [100, 100],
      ],
    ],
    color: id,
    width: 20,
  });
  const features = Object.freeze([
    f("late", "area", 2),
    f("scenery", "scenery", 1),
    f("early", "area", 1),
    f("exact", "road", 1000),
    f("road", "road", 1000),
    f("house", "house", 10000),
  ]);
  const view = {
    level: 0,
    tiles: [
      { x: 0, y: 0, density: [[0, 0, 1]], features: [f("wrong", "area", 0)] },
    ],
  } as CityView;
  paintCity(c, view, features, 1, decideLod(1).policy, "exact", () =>
    calls.push("water"),
  );
  expect(calls).toEqual([
    "fill:early",
    "fill:late",
    "fill:scenery",
    "water",
    "density",
    "stroke:road",
    "fill:house",
    "stroke:#514c43",
  ]);
  expect(features.map((x) => x.id)).toEqual([
    "late",
    "scenery",
    "early",
    "exact",
    "road",
    "house",
  ]);
});

it.each([
  [0.5, 12, 15.98, false],
  [0.5, 12, 16, true],
  [0.5, 12, 16.02, true],
  [0.6773333333333333, 12, 5, false],
  [0.05, 11.99, 200, false],
  [0.05, 12, 200, true],
  [0.05, 12.01, 200, true],
  [0.064, 2, 200, true],
] as const)(
  "paints normal roads at scale %s width %s proxy %s: %s",
  (scale, width, proxy, visible) => {
    const strokes: { color: string; width: number }[] = [];
    const c = {
      canvas: { width: 1000, height: 1000 },
      getTransform: () => ({ a: 1, d: 1, e: 0, f: 0 }),
      beginPath() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      save() {},
      restore() {},
      fillRect() {},
      stroke(this: CanvasRenderingContext2D) {
        strokes.push({
          color: String(this.strokeStyle),
          width: this.lineWidth,
        });
      },
    } as unknown as CanvasRenderingContext2D;
    const road: MapFeature = {
      id: "r",
      kind: "road",
      name: "",
      important: false,
      paths: [
        [
          [0, 0],
          [proxy, 0],
        ],
      ],
      width,
      rank: width * proxy,
      color: "#aaa9a3",
    };
    const view = { level: 0, tiles: [] };
    paintCity(c, view, [road], scale, decideLod(scale).policy);
    expect(strokes).toEqual(
      visible ? [{ color: road.color, width: Math.max(width, 2 / scale) }] : [],
    );
    strokes.length = 0;
    paintCity(c, view, [road], scale, decideLod(scale).policy, road.id);
    expect(strokes).toEqual([]);
  },
);

it("retains narrow normal roads in the roof policy hysteresis band", () => {
  let strokes = 0;
  const c = {
    canvas: { width: 1000, height: 1000 },
    getTransform: () => ({ a: 1, d: 1, e: 0, f: 0 }),
    beginPath() {},
    moveTo() {},
    lineTo() {},
    save() {},
    restore() {},
    stroke() {
      strokes++;
    },
  } as unknown as CanvasRenderingContext2D;
  const f: MapFeature = {
    id: "r",
    kind: "road",
    name: "",
    important: false,
    paths: [
      [
        [0, 0],
        [200, 0],
      ],
    ],
    width: 2,
    rank: 400,
    color: "earth",
  };
  paintCity(
    c,
    { level: 0, tiles: [] },
    [f],
    0.06,
    decideLod(0.06, decideLod(0.064)).policy,
  );
  expect(strokes).toBe(1);
});

it("does not stroke nonroad map features as roads", () => {
  let strokes = 0;
  const c = {
    canvas: { width: 1000, height: 1000 },
    getTransform: () => ({ a: 1, d: 1, e: 0, f: 0 }),
    save() {},
    restore() {},
    stroke() {
      strokes++;
    },
  } as unknown as CanvasRenderingContext2D;
  paintCity(
    c,
    { level: 0, tiles: [] },
    [
      {
        id: "other",
        kind: "parcel",
        name: "",
        important: false,
        paths: [
          [
            [0, 0],
            [1000, 0],
          ],
        ],
        color: "red",
        width: 20,
        rank: 20000,
      },
    ],
    0.5,
    decideLod(0.5).policy,
  );
  expect(strokes).toBe(0);
});

it("does not visit offscreen density cells and restores them after panning", () => {
  let reads = 0;
  const drawn: number[][] = [];
  let offset = 0;
  const context = {
    canvas: { width: 256, height: 256 },
    getTransform: () => ({ a: 2, d: 2, e: offset, f: 0 }),
    save() {},
    restore() {},
    fillRect: (...args: number[]) => drawn.push(args),
  } as unknown as CanvasRenderingContext2D;
  const view = {
    level: 0,
    tiles: [
      {
        x: -2,
        y: 0,
        features: [],
        get density(): [number, number, number][] {
          reads++;
          return [[0, 0, 1]];
        },
      },
    ],
  };
  const paint = () => paintCity(context, view, [], 1, decideLod(1).policy);
  paint();
  expect(reads).toBe(0);
  expect(drawn).toEqual([]);
  offset = 2048;
  paint();
  expect(reads).toBe(1);
  expect(drawn).toEqual([[-1024, 0, 16, 16]]);
  offset = 0;
  paint();
  expect(reads).toBe(1);
});

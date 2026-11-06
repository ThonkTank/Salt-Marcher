import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ExteriorGeometryCache,
  type ExteriorShape,
} from "./exteriorGeometryCache";
import { shape } from "./canvasPaint";

class RecordingPath {
  commands: unknown[][] = [];
  constructor() {
    builds++;
  }
  moveTo(x: number, y: number) {
    this.commands.push(["move", x, y]);
  }
  lineTo(x: number, y: number) {
    this.commands.push(["line", x, y]);
  }
  closePath() {
    this.commands.push(["close"]);
  }
}
let builds = 0;
const area = (
  points = [
    [0, 0],
    [1, 0],
    [1, 1],
  ],
) => ({ kind: "area", id: "same", material: "grass", points }) as ExteriorShape;
const road = {
  kind: "road",
  id: "r",
  material: "stone",
  width: 1,
  path: [
    [0, 0],
    [2, 3],
    [4, 5],
  ],
} as ExteriorShape;
const house = {
  kind: "house",
  id: "h",
  roof: "red",
  transform: { x: 10, y: 20, angle: Math.PI / 2 },
  contours: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    [
      [0.2, 0.2],
      [0.4, 0.2],
      [0.4, 0.4],
    ],
  ],
} as ExteriorShape;
const commands = (p: Path2D | null) => (p as unknown as RecordingPath).commands;
beforeEach(() => {
  builds = 0;
  vi.stubGlobal("Path2D", RecordingPath);
});
afterEach(() => vi.unstubAllGlobals());
describe("exterior geometry retention", () => {
  it("records exact open road, closed polygons, and rotated house rings", () => {
    const c = new ExteriorGeometryCache();
    expect(commands(c.get(road))).toEqual([
      ["move", 0, 0],
      ["line", 2, 3],
      ["line", 4, 5],
    ]);
    expect(commands(c.get(area()))).toEqual([
      ["move", 0, 0],
      ["line", 1, 0],
      ["line", 1, 1],
      ["close"],
    ]);
    const parcel = {
      kind: "parcel",
      polygon: [
        [2, 3],
        [4, 5],
      ],
    } as ExteriorShape;
    expect(commands(c.get(parcel))).toEqual([
      ["move", 2, 3],
      ["line", 4, 5],
      ["close"],
    ]);
    const result = commands(c.get(house));
    expect(result.map((x) => x[0])).toEqual([
      "move",
      "line",
      "line",
      "close",
      "move",
      "line",
      "line",
      "close",
    ]);
    expect(result[1][1]).toBeCloseTo(10);
    expect(result[1][2]).toBeCloseTo(25);
    expect(result[4][1]).toBeCloseTo(9);
    expect(result[4][2]).toBeCloseTo(21);
  });
  it("builds once without revisiting coordinates, and invalidates replacement and session", () => {
    let visits = 0;
    const point = [0, 0];
    Object.defineProperty(point, 0, {
      get() {
        visits++;
        return 0;
      },
    });
    const a = area([point, [1, 1]]),
      c = new ExteriorGeometryCache();
    c.setSession("a");
    const first = c.get(a),
      coldVisits = visits;
    expect(c.get(a)).toBe(first);
    expect(visits).toBe(coldVisits);
    expect(builds).toBe(1);
    expect(c.get(area())).not.toBe(first);
    expect(builds).toBe(2);
    c.setSession("a");
    expect(c.get(a)).toBe(first);
    c.setSession("b");
    expect(c.get(a)).not.toBe(first);
    expect(builds).toBe(3);
  });
  it("rejects unsafe replacements, widths and transformed overflow before creating paths", () => {
    const c = new ExteriorGeometryCache();
    c.get(area());
    expect(c.get(area([[Number.NaN, 0]]))).toBeNull();
    expect(c.get({ ...road, width: Infinity } as ExteriorShape)).toBeNull();
    expect(
      c.get({
        ...house,
        transform: { x: 1e308, y: 0, angle: 0 },
        contours: [[[1e308, 0]]],
      } as ExteriorShape),
    ).toBeNull();
    expect(builds).toBe(1);
    const ctx = { save: vi.fn() } as unknown as CanvasRenderingContext2D;
    shape(ctx, area([[NaN, 0]]), 1, c);
    expect(ctx.save).not.toHaveBeenCalled();
  });
  it("uses LRU entry and estimated-cost limits without oversized eviction", () => {
    const a = area([[0, 0]]),
      b = area([[1, 1]]),
      d = area([[2, 2]]);
    const c = new ExteriorGeometryCache({ bytes: 576, entries: 2 });
    const first = c.get(a),
      second = c.get(b);
    expect(c.get(a)).toBe(first);
    c.get(d);
    expect(c.get(a)).toBe(first);
    expect(c.get(b)).not.toBe(second);
    const oversized = area(Array.from({ length: 11 }, () => [0, 0]));
    const keep = c.get(b);
    expect(c.get(oversized)).not.toBe(c.get(oversized));
    expect(c.get(b)).toBe(keep);
    const byCost = new ExteriorGeometryCache({ bytes: 575, entries: 10 });
    const old = byCost.get(a);
    byCost.get(b);
    expect(byCost.get(a)).not.toBe(old);
  });
  it("applies styles at paint time while reusing geometry", () => {
    const c = new ExteriorGeometryCache();
    const strokes: Array<[unknown, string, number, string, string]> = [];
    const fills: unknown[][] = [];
    const ctx = {
      save() {},
      restore() {},
      stroke(
        this: {
          strokeStyle: string;
          lineWidth: number;
          lineCap: string;
          lineJoin: string;
        },
        path: unknown,
      ) {
        strokes.push([
          path,
          this.strokeStyle,
          this.lineWidth,
          this.lineCap,
          this.lineJoin,
        ]);
      },
      fill(...args: unknown[]) {
        fills.push(args);
      },
      strokeStyle: "",
      fillStyle: "",
      lineWidth: 0,
      lineCap: "",
      lineJoin: "",
    } as unknown as CanvasRenderingContext2D;
    shape(ctx, road, 1, c);
    shape(ctx, road, 4, c, "gold");
    expect(strokes[0]).toEqual([strokes[1][0], "#aaa9a3", 2, "round", "round"]);
    expect(strokes[1].slice(1)).toEqual(["gold", 1, "round", "round"]);
    shape(ctx, house, 2, c);
    expect(fills[0][1]).toBe("evenodd");
    expect(builds).toBe(2);
  });
});

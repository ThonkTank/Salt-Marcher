import { afterEach, describe, expect, it, vi } from "vitest";
import { TerrainPainter } from "./terrainView";
import { paintRivers } from "./riverView";
import { layoutMapLabels } from "./mapLabels";
import { scheduleCanvasFrame } from "./canvasFrame";
import { decideLod } from "./lod";
import type { SurfaceTile } from "./generated/SurfaceTile";
import type { TerrainResponse } from "./generated/TerrainResponse";
import type { RiverView } from "./generated/RiverView";
import type { MapFeature } from "./generated/MapFeature";

const tile = (x: number, y: number, value = 0): SurfaceTile => ({
  contentId: `render:${x}:${y}:${value}`,
  x,
  y,
  heights: Array.from({ length: 1089 }, (_, i) => value + (i % 33)),
  waters: [],
  foundationTops: [],
  raster: {
    contourInterval: 5,
    pixels: 2,
    relief: btoa(String.fromCharCode(...Array(64).fill(value))),
    materials: btoa(String.fromCharCode(0, 0, 222)),
    water: btoa("\0"),
    contours: [[0, 0, 1, 1]],
  },
});
const response = (tiles: SurfaceTile[]): TerrainResponse => ({
  status: { sessionId: "render", revision: 0 } as TerrainResponse["status"],
  level: 0,
  tiles,
});
function context() {
  const segments: number[][] = [];
  let start: number[] = [];
  return {
    segments,
    beginPath: vi.fn(),
    closePath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    clearRect: vi.fn(),
    moveTo: vi.fn((x: number, y: number) => {
      start = [x, y];
    }),
    lineTo: vi.fn((x: number, y: number) => {
      segments.push([...start, x, y]);
    }),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    getTransform: () => ({ a: 1, d: 1, e: 0, f: 0 }),
    drawImage: vi.fn(),
    putImageData: vi.fn(),
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
    }),
  };
}
afterEach(() => vi.unstubAllGlobals());

describe("render cache", () => {
  it("reuses prepared relief independently of neighbors and camera; changed tiles decode anew", () => {
    vi.stubGlobal("devicePixelRatio", 1);
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => context(),
      }),
    });
    const target = context();
    const c = target as unknown as CanvasRenderingContext2D;
    const painter = new TerrainPainter();
    const center = tile(0, 0),
      neighbor = tile(1, 0),
      far = tile(10, 10);
    const image = (tiles: SurfaceTile[], scale = 0.5, wet = false) => {
      target.drawImage.mockClear();
      painter.paint(c, response(tiles), scale, true, undefined, wet);
      return target.drawImage.mock.calls[0][0];
    };
    const first = image([center]);
    expect(image([center])).toBe(first);
    expect(image([center], 0.5, true)).not.toBe(first); // water pass is a distinct cached raster
    expect(image([center])).toBe(first);
    expect(image([center, far])).toBe(first);
    const added = image([center, neighbor]);
    expect(added).toBe(first);
    const changed = image([center, tile(1, 0, 80)]);
    expect(changed).toBe(added);
    const removed = image([center]);
    expect(removed).toBe(changed);
    vi.stubGlobal("devicePixelRatio", 2);
    const dpr = image([center]);
    expect(dpr).toBe(removed);
    expect(image([center], 2)).toBe(dpr);
    expect(image([tile(0, 0, 80)])).not.toBe(first);
  });
  it("reuses contour preparation and matches the direct preview geometry", () => {
    let reads = 0;
    const source = tile(0, 0);
    source.heights = new Proxy(source.heights, {
      get(target, key, receiver) {
        if (typeof key === "string" && /^\d+$/.test(key)) reads++;
        return Reflect.get(target, key, receiver);
      },
    });
    const view = response([source]),
      painter = new TerrainPainter();
    const first = context();
    painter.paintContours(
      first as unknown as CanvasRenderingContext2D,
      view,
      0.5,
    );
    expect(reads).toBe(0);
    reads = 0;
    const second = context();
    painter.paintContours(
      second as unknown as CanvasRenderingContext2D,
      view,
      0.5,
    );
    expect(reads).toBe(0);
    expect(second.segments).toEqual(first.segments);
    const direct = context();
    painter.paintContours(
      direct as unknown as CanvasRenderingContext2D,
      view,
      0.5,
      { surface: null, points: [] },
    );
    expect(first.segments).toEqual(direct.segments);
  });
  it("reuses the same river ribbon for bank and fill, and rebuilds when scale changes", () => {
    class Path {
      moveTo() {}
      lineTo() {}
      arc() {}
      closePath() {}
    }
    const makePath = vi.fn(() => new Path());
    vi.stubGlobal(
      "Path2D",
      class {
        constructor() {
          return makePath();
        }
      },
    );
    const river = {
      river: { id: "river" },
      samples: [
        { point: [0, 0], width: 5, cut: 0 },
        { point: [10, 0], width: 5, cut: 0 },
      ],
    } as RiverView;
    const target = context(),
      c = target as unknown as CanvasRenderingContext2D;
    paintRivers(c, [river], 1);
    expect(target.stroke.mock.calls[0][0]).toBe(target.fill.mock.calls[0][0]);
    paintRivers(c, [river], 1);
    expect(makePath).toHaveBeenCalledTimes(1);
    paintRivers(c, [river], 2);
    expect(makePath).toHaveBeenCalledTimes(2);
  });
  it("shares collision space and puts important features ahead of regions and roads", () => {
    const feature = (
      id: string,
      kind: string,
      important: boolean,
    ): MapFeature => ({
      id,
      kind,
      important,
      name: id,
      color: "",
      rank: 0,
      width: 30,
      paths:
        kind === "road"
          ? [
              [
                [20, 100],
                [380, 100],
              ],
            ]
          : [
              [
                [190, 90],
                [210, 110],
              ],
            ],
    });
    const region = {
      id: "region",
      name: "region",
      x: 200,
      y: 100,
      size: 14,
      box: [170, 88, 230, 112] as [number, number, number, number],
    };
    const args = [
      { x: 0, y: 0, scale: 1 },
      decideLod(1).policy,
      400,
      300,
      "",
      (t: string) => t.length * 8,
    ] as const;
    expect(
      layoutMapLabels(
        [feature("important", "house", true), feature("road", "road", false)],
        ...args,
        new Set(),
        [],
        [region],
      ).regions,
    ).toHaveLength(0);
    const result = layoutMapLabels(
      [feature("road", "road", false)],
      ...args,
      new Set(),
      [],
      [region],
    );
    expect(result.regions).toHaveLength(1);
    expect(result.labels).toHaveLength(0);
  });
  it("cancels superseded frames and cleanup prevents a late draw", () => {
    let next = 0;
    const queued = new Map<number, FrameRequestCallback>();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      queued.set(++next, cb);
      return next;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => queued.delete(id));
    const draw = vi.fn();
    const cancelFirst = scheduleCanvasFrame(draw);
    cancelFirst();
    const cancelLast = scheduleCanvasFrame(draw);
    expect(queued.size).toBe(1);
    for (const cb of queued.values()) cb(0);
    expect(draw).toHaveBeenCalledTimes(1);
    cancelLast();
    const cancelUnmount = scheduleCanvasFrame(draw);
    cancelUnmount();
    expect(queued.size).toBe(0);
  });
});

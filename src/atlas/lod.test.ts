import { describe, it, expect } from "vitest";
import {
  ATLAS_VIEWS,
  clampCamera,
  scaleBar,
  viewScale,
  zoomAt,
  decideLod,
} from "./lod";
import { terrainRequest } from "./terrainView";
import { groundRequest } from "./groundView";
import { cityRequest } from "./cityView";
describe("world navigation", () => {
  it("crosses every semantic boundary with ten percent hysteresis", () => {
    for (let i = 0; i < ATLAS_VIEWS.length - 1; i++) {
      const width = ATLAS_VIEWS[i].width;
      const fine = decideLod(304.8 / (width * 0.8));
      const coarse = decideLod(304.8 / (width * 1.2));
      expect(decideLod(304.8 / (width * 1.05), fine).atlasLevel).toBe(i);
      expect(decideLod(304.8 / (width * 1.11), fine).atlasLevel).toBe(i + 1);
      expect(decideLod(304.8 / (width * 0.95), coarse).atlasLevel).toBe(i + 1);
      expect(decideLod(304.8 / (width * 0.89), coarse).atlasLevel).toBe(i);
    }
  });
  it("preserves the zoom pivot near the world edge at all levels", () => {
    const point: [number, number] = [99_999_900, -99_999_900];
    let camera = { scale: 0.000002, x: 400, y: 300 };
    const screen = [
      camera.x + point[0] * camera.scale,
      camera.y + point[1] * camera.scale,
    ];
    for (let i = 13; i >= 0; i--) {
      camera = zoomAt(camera, point, viewScale(i));
      expect(camera.x + point[0] * camera.scale).toBeCloseTo(screen[0], 5);
      expect(camera.y + point[1] * camera.scale).toBeCloseTo(screen[1], 5);
      expect(scaleBar(camera.scale).pixels).toBeLessThanOrEqual(120.000001);
    }
  });
  it("clamps physical camera centers at both world edges", () => {
    for (const sign of [-1, 1]) {
      const camera = clampCamera(
        { x: -sign * 2e8, y: -sign * 2e8, scale: 1 },
        800,
        600,
      );
      expect((400 - camera.x) / camera.scale).toBe(sign * (1e8 - 400));
      expect((300 - camera.y) / camera.scale).toBe(sign * (1e8 - 300));
    }
  });
  it("bounds overview requests for large windows and world-edge views", () => {
    for (const scale of [0.000002, ...ATLAS_VIEWS.map((_, i) => viewScale(i))])
      for (const width of [900, 1920, 7680]) {
        const bounds: [number, number, number, number] = [
          -width / scale / 2,
          -500 / scale,
          width / scale / 2,
          500 / scale,
        ];
        expect(
          terrainRequest(bounds, decideLod(scale).terrainLevel).tiles.length,
        ).toBeLessThanOrEqual(64);
        expect(
          groundRequest(bounds, decideLod(scale).groundLevel).tiles.length,
        ).toBeLessThanOrEqual(64);
        expect(
          cityRequest(bounds, decideLod(scale).cityLevel).tiles.length,
        ).toBeLessThanOrEqual(64);
      }
  });
});

it("holds every content and raster boundary until the return margin", () => {
  for (const boundary of [
    0.0064,
    0.064,
    0.32,
    1.28,
    ...Array.from({ length: 22 }, (_, i) => 8 / (5 * 2 ** i)),
    ...Array.from({ length: 24 }, (_, i) => 1 / 2 ** (i + 1)),
  ]) {
    const below = decideLod(boundary * 0.89);
    const entered = decideLod(boundary, below);
    const held = decideLod(boundary * 0.95, entered);
    expect(held.stableScale).toBeGreaterThanOrEqual(boundary);
    expect(decideLod(boundary * 0.89, held).stableScale).toBeLessThan(boundary);
    expect(decideLod(boundary, below).policy).toEqual(
      decideLod(boundary).policy,
    );
  }
});

it("switches each content policy at its nominal entry and return boundaries", () => {
  for (const [boundary, field] of [
    [0.0064, "importantNames"],
    [0.064, "roofs"],
    [0.32, "buildingNames"],
    [0.32, "detailBrushes"],
    [1.28, "exact"],
  ] as const) {
    const coarse = decideLod(boundary * 0.89);
    expect(coarse.policy[field]).toBe(false);
    const entered = decideLod(boundary, coarse);
    expect(entered.policy[field]).toBe(true);
    expect(decideLod(boundary * 0.95, entered).policy[field]).toBe(true);
    expect(decideLod(boundary * 0.89, entered).policy[field]).toBe(false);
  }
});

it("switches every terrain resolution at its entry and return boundaries", () => {
  for (let level = 0; level < 21; level++) {
    const boundary = 8 / (5 * 2 ** level);
    const coarse = decideLod(boundary * 0.89);
    expect(coarse.terrainLevel).toBe(level + 1);
    const entered = decideLod(boundary, coarse);
    expect(entered.terrainLevel).toBe(level);
    expect(decideLod(boundary * 0.95, entered).terrainLevel).toBe(level);
    expect(decideLod(boundary * 0.89, entered).terrainLevel).toBe(level + 1);
  }
});

it("preserves the city pixel hysteresis independently of content bands", () => {
  for (let level = 0; level <= 20; level++) {
    const scale = 1 / 2 ** (level + 0.5);
    const initial = decideLod(scale);
    expect(initial.cityLevel).toBe(level);
    const lower = 7.2 / (16 * 2 ** level);
    const upper = 17.6 / (16 * 2 ** level);
    expect(decideLod(lower * 1.001, initial).cityLevel).toBe(level);
    expect(decideLod(upper * 0.999, initial).cityLevel).toBe(level);
    if (level < 20)
      expect(decideLod(lower * 0.999, initial).cityLevel).not.toBe(level);
    if (level > 0)
      expect(decideLod(upper * 1.001, initial).cityLevel).not.toBe(level);
  }
});

for (const [name, request] of [
  [
    "city",
    (bounds: [number, number, number, number]) => cityRequest(bounds, 0),
  ],
  [
    "terrain",
    (bounds: [number, number, number, number]) => terrainRequest(bounds, 0),
  ],
  [
    "ground",
    (bounds: [number, number, number, number]) => groundRequest(bounds, 0),
  ],
] as const) {
  it(`${name}: budgets the entire world before allocating coordinates`, () => {
    const result = request([-1e8, -1e8, 1e8, 1e8]);
    expect(result.tiles.length).toBeGreaterThan(0);
    expect(result.tiles.length).toBeLessThanOrEqual(64);
    expect(new Set(result.tiles.map(String)).size).toBe(result.tiles.length);
    expect(request([1e8 + 1, 1e8 + 1, 2e8, 2e8]).tiles).toEqual([]);
  });
}
it("keeps ground resolution stable on both sides of every zoom-in boundary", () => {
  for (let level = 0; level < 24; level++) {
    const boundary = 1 / 2 ** (level + 1);
    const entered = decideLod(boundary);
    expect(decideLod(boundary * 1.01).groundLevel).toBe(level);
    expect(decideLod(boundary * 0.95, entered).groundLevel).toBe(level);
    expect(decideLod(boundary * 0.89, entered).groundLevel).toBe(level + 1);
  }
});

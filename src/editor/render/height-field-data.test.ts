import { describe, expect, it } from "vitest";
import { HEIGHT_SUM_SCALE, prepareHeightSampler } from "../model/height";
import {
  HEIGHT_TILE_SIZE,
  WORLD_LIMIT,
  heightTileKey,
  type Bounds,
  type HeightTile,
} from "../model/types";
import {
  HEIGHT_PAGE_SIZE,
  HEIGHT_PAGE_TEXELS,
  HeightSourceAtlas,
  createHeightAxes,
  createHeightProjection,
  encodeHeightOverview,
  splitHeightFloat,
  type HeightDescriptor,
} from "./height-field-data";
import {
  DISPLAY_HEIGHT_BOUNDARY_EPSILON,
  rasterize,
  stabilizeDisplayHeight,
} from "./raster";

function source(
  level: number,
  tileX: number,
  tileY: number,
  value: number | ((x: number, y: number) => number),
): HeightTile {
  return {
    key: heightTileKey(level, tileX, tileY),
    level,
    tileX,
    tileY,
    revision: 1,
    values: Float64Array.from({ length: HEIGHT_TILE_SIZE ** 2 }, (_, index) =>
      typeof value === "number"
        ? value
        : value(tileX * 64 + (index % 64), tileY * 64 + Math.floor(index / 64)),
    ),
  };
}

// Decode both uploaded source and axis transports. These assertions compare
// page ownership, halo, world-relative addressing and levels with the canonical sampler;
// the native GPU/reference scenario checks actual shader arithmetic and pixels.
function samplePacked(
  atlas: HeightSourceAtlas,
  descriptor: HeightDescriptor,
  x: number,
  y: number,
  axes: ReturnType<typeof createHeightAxes>,
): number {
  let result = -100 / HEIGHT_SUM_SCALE;
  for (let level = 0; level < descriptor.levelCount; level++) {
    const at = level * descriptor.width * 4;
    const data = descriptor.data;
    const axisX = (level * 2 * axes.width + x * 5) * 2;
    const axisY = ((level * 2 + 1) * axes.width + y * 5) * 2;
    const ix = axes.data[axisX],
      iy = axes.data[axisY];
    const px = Math.floor(ix / 64),
      py = Math.floor(iy / 64);
    const page = data[at + py * descriptor.pageStride + px];
    if (page < 0) continue;
    const wx = Array.from(
      { length: 4 },
      (_, i) => axes.data[axisX + i * 2 + 2] + axes.data[axisX + i * 2 + 3],
    );
    const wy = Array.from(
      { length: 4 },
      (_, i) => axes.data[axisY + i * 2 + 2] + axes.data[axisY + i * 2 + 3],
    );
    for (let cy = 0; cy < 4; cy++)
      for (let cx = 0; cx < 4; cx++) {
        const offset =
          (page * HEIGHT_PAGE_TEXELS +
            (iy - py * 64 + cy + 1) * HEIGHT_PAGE_SIZE +
            ix -
            px * 64 +
            cx +
            1) *
          2;
        result +=
          (atlas.data[offset] + atlas.data[offset + 1]) * wx[cx] * wy[cy];
      }
  }
  return Math.max(-100_000, Math.min(100_000, result * HEIGHT_SUM_SCALE));
}

// Decode the new row layout independently of the shader. The oracle remains
// prepareHeightSampler; the native reference checks the actual f32 pair passes.
function sampleSeparablePacked(
  atlas: HeightSourceAtlas,
  descriptor: HeightDescriptor,
  x: number,
  y: number,
  axes: ReturnType<typeof createHeightAxes>,
): number {
  let total = -100 / HEIGHT_SUM_SCALE;
  for (let level = 0; level < descriptor.levelCount; level++) {
    const at = level * descriptor.width * 4;
    const axisX = (level * 2 * axes.width + x * 5) * 2;
    const axisY = ((level * 2 + 1) * axes.width + y * 5) * 2;
    const ix = axes.data[axisX],
      iy = axes.data[axisY];
    const pageX = Math.floor(ix / 64);
    const basePageY = Math.floor(iy / 64);
    if (descriptor.data[at + basePageY * descriptor.pageStride + pageX] < 0)
      continue;
    for (let cy = 0; cy < 4; cy++) {
      const row = iy + cy - 1;
      const pageY = Math.max(
        0,
        Math.min(descriptor.pageStride - 1, Math.floor(row / 64)),
      );
      const page = descriptor.data[at + pageY * descriptor.pageStride + pageX];
      let horizontal = 0;
      if (page >= 0)
        for (let cx = 0; cx < 4; cx++) {
          const offset =
            (page * HEIGHT_PAGE_TEXELS +
              (row - pageY * 64 + 2) * HEIGHT_PAGE_SIZE +
              ix -
              pageX * 64 +
              cx +
              1) *
            2;
          const weight =
            axes.data[axisX + cx * 2 + 2] + axes.data[axisX + cx * 2 + 3];
          horizontal += (atlas.data[offset] + atlas.data[offset + 1]) * weight;
        }
      const weight =
        axes.data[axisY + cy * 2 + 2] + axes.data[axisY + cy * 2 + 3];
      total += horizontal * weight;
    }
  }
  return Math.max(-100_000, Math.min(100_000, total * HEIGHT_SUM_SCALE));
}

describe("retained numeric height sources", () => {
  it("reconstructs source seams and ghost support in negative coordinates", () => {
    const tiles = [
      source(0, -1, -1, (x, y) => 170 + x / 3 - y / 7),
      source(0, 0, -1, (x, y) => 80 + x / 11 + y / 5),
      source(0, -1, 0, (x, y) => 40 + x / 13 - y / 3),
    ];
    const atlas = new HeightSourceAtlas();
    atlas.updateSources(tiles);
    const bounds: Bounds = [-256, -256, 256, 256];
    const descriptor = atlas.descriptor(bounds, 2);
    const axes = createHeightAxes(bounds, 2, descriptor.levels);
    const canonical = prepareHeightSampler(tiles);
    for (const [x, y] of [
      [0, 0],
      [63, 63],
      [64, 64],
      [65, 64],
      [80, 80],
      [127, 127],
    ]) {
      expect(samplePacked(atlas, descriptor, x, y, axes)).toBeCloseTo(
        canonical(-254 + x * 4, -254 + y * 4),
        9,
      );
      expect(sampleSeparablePacked(atlas, descriptor, x, y, axes)).toBeCloseTo(
        canonical(-254 + x * 4, -254 + y * 4),
        9,
      );
    }
    expect(descriptor.fallback).toBe(false);
  });

  it("keeps all22 overlapping author levels in one bounded sampler transport", () => {
    const tiles = Array.from({ length: 22 }, (_, level) =>
      source(level, 0, 0, (x, y) => level + 1 + x / 100 + y / 50),
    );
    const atlas = new HeightSourceAtlas();
    atlas.updateSources(tiles);
    const descriptor = atlas.descriptor([0, 0, 512, 512], 2);
    const axes = createHeightAxes([0, 0, 512, 512], 2, descriptor.levels);
    expect(descriptor.levelCount).toBe(22);
    const canonical = prepareHeightSampler(tiles);
    for (const [x, y] of [
      [0, 0],
      [19, 31],
      [64, 64],
      [127, 127],
    ]) {
      expect(samplePacked(atlas, descriptor, x, y, axes)).toBeCloseTo(
        canonical(2 + x * 4, 2 + y * 4),
        9,
      );
      expect(sampleSeparablePacked(atlas, descriptor, x, y, axes)).toBeCloseTo(
        canonical(2 + x * 4, 2 + y * 4),
        9,
      );
    }
    expect(descriptor.fallback).toBe(false);
    expect(atlas.data.byteLength).toBeLessThan(32 * 1024 * 1024);
  });

  it("projects a finer active level on the overview's unchanged output lattice", () => {
    const tiles = Array.from({ length: 16 }, (_, index) =>
      source(0, index % 4, Math.floor(index / 4), (x, y) => x / 100 + y / 50),
    );
    const atlas = new HeightSourceAtlas();
    atlas.updateSources(tiles);
    const bounds: Bounds = [0, 0, 1024, 1024];
    const descriptor = atlas.descriptor(bounds, 3, { minimum: 0 });
    const axes = createHeightAxes(bounds, 3, descriptor.levels);
    expect(descriptor.pageStride).toBeGreaterThan(3);
    expect(descriptor.levels).toEqual([0]);
    const canonical = prepareHeightSampler(tiles);
    for (const [x, y] of [
      [0, 0],
      [39, 40],
      [79, 100],
      [127, 127],
    ]) {
      expect(samplePacked(atlas, descriptor, x, y, axes)).toBeCloseTo(
        canonical(4 + x * 8, 4 + y * 8),
        10,
      );
      expect(sampleSeparablePacked(atlas, descriptor, x, y, axes)).toBeCloseTo(
        canonical(4 + x * 8, 4 + y * 8),
        10,
      );
    }
  });

  it("writes every required dirty stencil row including -1 and page-boundary halos", () => {
    for (const [power, level] of [
      [2, 0],
      [2, 4],
      [3, 0],
      [4, 1],
    ]) {
      const atlas = new HeightSourceAtlas();
      atlas.updateSources([source(level, 0, 0, 100)]);
      const span = 128 * 2 ** power;
      const bounds: Bounds = [0, 0, span, span];
      const descriptor = atlas.descriptor(bounds, power, { minimum: level });
      const axes = createHeightAxes(bounds, power, descriptor.levels);
      expect(descriptor.rows[0].first).toBe(-1);
      for (const rect of [
        [0, 0, 128, 128],
        [5, 0, 17, 2],
        [3, 39, 92, 43],
        [1, 125, 128, 128],
      ] as const) {
        const projection = createHeightProjection(descriptor, axes, rect);
        const metadata = descriptor.rows[0];
        const from = Math.round(
          projection.positions[1] * descriptor.horizontalRows,
        );
        const to = Math.round(
          projection.positions[5] * descriptor.horizontalRows,
        );
        expect(projection.samples).toBe((rect[2] - rect[0]) * (to - from));
        for (let y = rect[1]; y < rect[3]; y++) {
          const iy = axes.data[(axes.width + y * 5) * 2];
          for (let tap = 0; tap < 4; tap++) {
            const row = metadata.offset + iy + tap - 1 - metadata.first;
            expect(row).toBeGreaterThanOrEqual(from);
            expect(row).toBeLessThan(to);
          }
        }
        // The rasterized centre of every packed row decodes to that same row.
        for (let row = from; row < to; row++) {
          const t = (row + 0.5 - from) / (to - from);
          const uv =
            projection.uvs[1] + t * (projection.uvs[5] - projection.uvs[1]);
          expect(Math.floor(uv * metadata.count)).toBe(row - metadata.offset);
        }
      }
    }
  });

  it("preserves sparse missing pages and neighbour halos at rows 63/64 and 127/128", () => {
    for (const tiles of [
      [source(0, 0, -1, (x, y) => 100 + x / 7 - y / 11)],
      [source(0, 1, 1, (x, y) => 100 + x / 7 - y / 11)],
      [source(0, 1, 2, 120), source(0, 2, 1, 80)],
    ]) {
      const atlas = new HeightSourceAtlas();
      atlas.updateSources(tiles);
      const descriptor = atlas.descriptor([0, 0, 1024, 1024], 3, {
        minimum: 0,
      });
      const axes = createHeightAxes([0, 0, 1024, 1024], 3, descriptor.levels);
      const canonical = prepareHeightSampler(tiles);
      expect(descriptor.data.some((value) => value === -1)).toBe(true);
      for (const [x, y] of [
        [0, 0],
        [39, 39],
        [40, 40],
        [79, 79],
        [80, 80],
        [127, 127],
      ]) {
        expect(
          sampleSeparablePacked(atlas, descriptor, x, y, axes),
        ).toBeCloseTo(canonical(4 + x * 8, 4 + y * 8), 9);
        expect(
          sampleSeparablePacked(atlas, descriptor, x, y, axes),
        ).toBeCloseTo(samplePacked(atlas, descriptor, x, y, axes), 9);
      }
    }
  });

  it("retains canonical cached axis weights at large signed world coordinates", () => {
    for (const sign of [-1, 1]) {
      const originX = sign * 90_000_000;
      const originY = -sign * 90_000_000;
      const bounds: Bounds = [originX, originY, originX + 512, originY + 512];
      const tiles = Array.from({ length: 22 }, (_, level) => {
        const span = 64 * 5 * 2 ** level;
        return source(
          level,
          Math.floor(originX / span),
          Math.floor(originY / span),
          (x, y) =>
            (level % 2 ? -1 : 1) * (15_000 + (x % 17) / 10 + (y % 13) / 20),
        );
      });
      const atlas = new HeightSourceAtlas();
      atlas.updateSources(tiles);
      const descriptor = atlas.descriptor(bounds, 2);
      const axes = createHeightAxes(bounds, 2, descriptor.levels);
      const canonical = prepareHeightSampler(tiles);
      for (const [x, y] of [
        [0, 0],
        [19, 31],
        [64, 64],
        [127, 127],
      ])
        expect(samplePacked(atlas, descriptor, x, y, axes)).toBeCloseTo(
          canonical(originX + (x + 0.5) * 4, originY + (y + 0.5) * 4),
          7,
        );
    }
  });

  it("updates neighbours' cubic halos and returns only affected upload spans", () => {
    const left = source(0, -1, 0, 120);
    const right = source(0, 0, 0, 80);
    const atlas = new HeightSourceAtlas();
    atlas.updateSources([left, right]);
    const descriptor = atlas.descriptor([-256, 0, 256, 512], 2);
    const axes = createHeightAxes([-256, 0, 256, 512], 2, descriptor.levels);
    atlas.takeUpdates();
    const changed = source(0, 0, 0, 240);
    atlas.updateSources([changed]);
    const updates = atlas.takeUpdates();
    expect(updates.allocation).toBe(false);
    expect(updates.ranges.reduce((sum, [a, b]) => sum + b - a, 0)).toBeLessThan(
      atlas.data.length / 2,
    );
    const canonical = prepareHeightSampler([left, changed]);
    expect(samplePacked(atlas, descriptor, 63, 20, axes)).toBeCloseTo(
      canonical(-2, 82),
      9,
    );
    atlas.updateSources([], [changed.key]);
    expect(samplePacked(atlas, descriptor, 64, 20, axes)).toBeCloseTo(
      prepareHeightSampler([left])(2, 82),
      9,
    );
  });

  it("owns source copies and reuses released GPU page slots", () => {
    const original = source(0, 0, 0, 50);
    const atlas = new HeightSourceAtlas();
    atlas.updateSources([original]);
    original.values.fill(500);
    const first = atlas.descriptor([0, 0, 512, 512], 2);
    const axes = createHeightAxes([0, 0, 512, 512], 2, first.levels);
    const count = atlas.pageCount;
    const bytes = atlas.data.byteLength;
    expect(samplePacked(atlas, first, 20, 20, axes)).toBeCloseTo(-50, 9);
    atlas.release(first.pages);
    expect(atlas.pageCount).toBe(0);
    const second = atlas.descriptor([0, 0, 512, 512], 2);
    expect(atlas.pageCount).toBe(count);
    expect(atlas.data.byteLength).toBe(bytes);
    atlas.release(second.pages);
  });

  it("clips display samples and source controls independently at the world edge", () => {
    const edge = source(0, Math.floor(WORLD_LIMIT / 320), 0, 250);
    const atlas = new HeightSourceAtlas();
    atlas.updateSources([edge]);
    const bounds: Bounds = [99_999_744, 0, 100_000_256, 512];
    const descriptor = atlas.descriptor(bounds, 2);
    expect(descriptor.clip).toEqual([0, 0, 64, 128]);
    const axes = createHeightAxes(bounds, 2, descriptor.levels);
    expect(samplePacked(atlas, descriptor, 63, 20, axes)).toBeCloseTo(
      prepareHeightSampler([edge])(99_999_998, 82),
      9,
    );
    expect(sampleSeparablePacked(atlas, descriptor, 63, 20, axes)).toBeCloseTo(
      prepareHeightSampler([edge])(99_999_998, 82),
      9,
    );
  });

  it("retains Float64 residuals and selects the canonical exceptional path", () => {
    const value = (100 + 1e-7) / HEIGHT_SUM_SCALE;
    const [high, low] = splitHeightFloat(value);
    expect(high).not.toBe(value);
    expect(high + low).toBeCloseTo(value, 14);
    const atlas = new HeightSourceAtlas();
    const enormous = source(0, 0, 0, Number.MAX_VALUE);
    atlas.updateSources([enormous]);
    expect(atlas.descriptor([0, 0, 512, 512], 2).fallback).toBe(true);
    expect(atlas.sources.get(enormous.key)?.values[0]).toBe(Number.MAX_VALUE);
    const overview = new Float64Array(128 ** 2);
    overview[0] = -1e300;
    expect(encodeHeightOverview(overview).fallback).toBe(true);
  });
});

describe("display boundary precision", () => {
  it("stabilizes only the0/12 colour boundaries at the shared tiny tolerance", () => {
    const epsilon = DISPLAY_HEIGHT_BOUNDARY_EPSILON;
    for (const boundary of [0, 12]) {
      expect(stabilizeDisplayHeight(boundary - epsilon * 0.9)).toBe(boundary);
      expect(stabilizeDisplayHeight(boundary + epsilon * 0.9)).toBe(boundary);
      expect(stabilizeDisplayHeight(boundary - epsilon * 1.1)).toBe(
        boundary - epsilon * 1.1,
      );
      expect(stabilizeDisplayHeight(boundary + epsilon * 1.1)).toBe(
        boundary + epsilon * 1.1,
      );
    }
    expect(stabilizeDisplayHeight(123.00000001)).toBe(123.00000001);
  });

  it("uses the stabilized boundary in canonical fallback colour classification", () => {
    const e = DISPLAY_HEIGHT_BOUNDARY_EPSILON;
    const heights = Float64Array.from(
      [-e * 0.9, -e * 1.1, 12 - e * 0.9, 12 - e * 1.1],
      (x) => x / HEIGHT_SUM_SCALE,
    );
    const pixels = rasterize(heights, [0, 0, 4, 4], 4, [0, 0, 4, 1]);
    expect([...pixels.subarray(0, 4)]).toEqual([201, 192, 144, 255]);
    expect([...pixels.subarray(4, 8)]).toEqual([94, 147, 166, 255]);
    expect([...pixels.subarray(8, 12)]).toEqual([133, 152, 104, 255]);
    expect([...pixels.subarray(12, 16)]).toEqual([201, 192, 144, 255]);
    expect(heights[0]).toBe((-e * 0.9) / HEIGHT_SUM_SCALE);
  });
});

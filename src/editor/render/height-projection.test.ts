import { expect, it } from "vitest";
import {
  HEIGHT_SUM_SCALE,
  HEIGHT_BASE,
  heightFromScaledSum,
  heightTilesFromControls,
  prepareScaledHeightSum,
  type Bounds,
} from "../model";
import { projectHeightPixels } from "./height-projection";
import { rasterize } from "./raster";

it("projects all 22 levels and fine overview with canonical Float64 content", async () => {
  const sources = Array.from({ length: 22 }, (_, level) =>
    heightTilesFromControls(level, [
      [0, 0, (level % 2 ? -1 : 1) * (200 + level * 20)],
    ]),
  ).flat();
  const bounds: Bounds = [-40, -40, 40, 40];
  const size = 16;
  const overview = new Float64Array(size * size).fill(120 / HEIGHT_SUM_SCALE);
  let yielded = 0;
  let clock = 0;
  const result = await projectHeightPixels(
    { sources, bounds, size, overview },
    {
      cancelled: () => false,
      now: () => ++clock,
      yield: async () => {
        yielded++;
      },
    },
  );
  const sample = prepareScaledHeightSum(sources);
  const expected = new Float64Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      expected[y * size + x] = sample(
        bounds[0] + ((x + 0.5) * (bounds[2] - bounds[0])) / size,
        bounds[1] + ((y + 0.5) * (bounds[3] - bounds[1])) / size,
      );
  expect(result?.pixels).toEqual(
    rasterize(expected, bounds, size, [0, 0, size, size], overview),
  );
  expect(result?.land).toEqual(
    Uint8Array.from(expected, (value, index) =>
      heightFromScaledSum(value + overview[index]) >= -1e-6 ? 255 : 0,
    ),
  );
  expect(result?.samples).toBe(size * size);
  expect(yielded).toBeGreaterThan(10);
});

it("uses the same exact coastal snapping for land and colour", async () => {
  const heights = [-2e-6, -0.5e-6, 0, 0.5e-6];
  const overview = Float64Array.from(
    heights,
    (height) => (height - HEIGHT_BASE) / HEIGHT_SUM_SCALE,
  );
  const result = await projectHeightPixels(
    { sources: [], bounds: [0, 0, 2, 2], size: 2, overview },
    { cancelled: () => false, now: () => 0, yield: async () => {} },
  );
  expect(result?.land).toEqual(new Uint8Array([0, 255, 255, 255]));
  expect(result?.pixels.slice(0, 4)).toEqual(
    new Uint8Array([94, 147, 166, 255]),
  );
  for (let index = 1; index < 4; index++)
    expect(result?.pixels.slice(index * 4, index * 4 + 4)).toEqual(
      new Uint8Array([201, 192, 144, 255]),
    );
});

it("returns absolute high/low pairs only on request while preserving the existing colour and land result", async () => {
  const absolute = [32 - 1e-7, 32, 32 + 1e-7, -0.5e-6];
  const input = {
    sources: [],
    bounds: [0, 0, 2, 2] as Bounds,
    size: 2,
    overview: Float64Array.from(
      absolute,
      (height) => (height - HEIGHT_BASE) / HEIGHT_SUM_SCALE,
    ),
  };
  const execution = {
    cancelled: () => false,
    now: () => 0,
    yield: async () => {},
  };
  const plain = await projectHeightPixels(input, execution);
  const derived = await projectHeightPixels(
    { ...input, includeHeights: true },
    execution,
  );
  expect(plain?.heights).toBeUndefined();
  expect(derived?.pixels).toEqual(plain?.pixels);
  expect(derived?.land).toEqual(plain?.land);
  for (let i = 0; i < absolute.length; i++)
    expect(
      Math.abs(
        derived!.heights![i * 2] + derived!.heights![i * 2 + 1] - absolute[i],
      ),
    ).toBeLessThan(1e-12);
  expect(derived!.heights![1]).toBeLessThan(0);
  expect(derived!.heights![5]).toBeGreaterThan(0);
  // The derived-surface clip sees the unsnapped coast value, whereas old colour
  // and landscape classification intentionally retain their display snapping.
  expect(derived!.heights![6] + derived!.heights![7]).toBeLessThan(0);
  expect(derived!.land[3]).toBe(255);
});

it("keeps outside-world samples transparent and absent from the land mask", async () => {
  const result = await projectHeightPixels(
    {
      sources: [],
      bounds: [99_999_999, 0, 100_000_003, 4],
      size: 2,
      overview: new Float64Array(4).fill(120 / HEIGHT_SUM_SCALE),
    },
    { cancelled: () => false, now: () => 0, yield: async () => {} },
  );
  expect(result?.land).toEqual(new Uint8Array([255, 0, 255, 0]));
  expect(result?.pixels.slice(4, 8)).toEqual(new Uint8Array(4));
  expect(result?.pixels.slice(12, 16)).toEqual(new Uint8Array(4));
});

it("retains the canonical summation order for extreme cancelling sources", async () => {
  const sources = [
    ...heightTilesFromControls(21, [[0, 0, Number.MAX_VALUE / 4]]),
    ...heightTilesFromControls(20, [[0, 0, -Number.MAX_VALUE / 4]]),
    ...heightTilesFromControls(0, [[0, 0, 600]]),
  ];
  const bounds: Bounds = [-5, -5, 5, 5];
  const size = 8;
  const result = await projectHeightPixels(
    { sources, bounds, size },
    { cancelled: () => false, now: () => 0, yield: async () => {} },
  );
  const sample = prepareScaledHeightSum(sources);
  const values = Float64Array.from({ length: size * size }, (_, index) =>
    sample(
      -5 + (((index % size) + 0.5) * 10) / size,
      -5 + ((Math.floor(index / size) + 0.5) * 10) / size,
    ),
  );
  expect(result?.pixels).toEqual(
    rasterize(values, bounds, size, [0, 0, size, size]),
  );
});

it("admits cancellation during source setup before touching a later invalid source", async () => {
  const sources = [
    ...heightTilesFromControls(0, [[0, 0, 100]]),
    ...heightTilesFromControls(1, [[0, 0, 200]]),
  ];
  sources[1].values[0] = Number.NaN;
  let cancelled = false;
  let clock = 0;
  const result = await projectHeightPixels(
    { sources, bounds: [0, 0, 20, 20], size: 128 },
    {
      cancelled: () => cancelled,
      now: () => (clock += 3),
      yield: async () => {
        cancelled = true;
      },
    },
  );
  expect(result).toBeNull();
});

it("admits cancellation between bounded pixel rows without publishing partial pixels", async () => {
  let cancelled = false;
  let yields = 0;
  let clock = 0;
  const result = await projectHeightPixels(
    { sources: [], bounds: [0, 0, 320, 320], size: 128 },
    {
      cancelled: () => cancelled,
      now: () => (clock += 3),
      yield: async () => {
        if (++yields === 3) cancelled = true;
      },
    },
  );
  expect(result).toBeNull();
  expect(yields).toBe(3);
});

it("rejects non-finite overview input instead of publishing a plausible-looking image", async () => {
  const overview = new Float64Array(16);
  overview[12] = Number.NaN;
  await expect(
    projectHeightPixels(
      { sources: [], bounds: [0, 0, 20, 20], size: 4, overview },
      { cancelled: () => false, now: () => 0, yield: async () => {} },
    ),
  ).rejects.toThrow("Ungültige numerische Höhenübersicht");
});

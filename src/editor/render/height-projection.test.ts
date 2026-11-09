import { expect, it } from "vitest";
import {
  HEIGHT_SUM_SCALE,
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
  expect(result?.samples).toBe(size * size);
  expect(yielded).toBeGreaterThan(10);
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

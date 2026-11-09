import { expect, it } from "vitest";
import { HEIGHT_SUM_SCALE } from "../model/height";
import { rasterize } from "./raster";

it("preserves exact water, coast and land colours at their classification limits", () => {
  const heights = [
    -100_000, -300, -150, -0.01, 0, 11.99, 12, 300, 600, 100_000,
  ];
  const pixels = rasterize(
    Float64Array.from(heights, (value) => value / HEIGHT_SUM_SCALE),
    [0, 0, 10, 10],
    10,
    [0, 0, 10, 1],
  );
  expect([...pixels]).toEqual([
    41, 90, 122, 255, 41, 90, 122, 255, 68, 119, 144, 255, 94, 147, 166, 255,
    201, 192, 144, 255, 201, 192, 144, 255, 133, 152, 104, 255, 162, 168, 135,
    255, 192, 185, 167, 255, 192, 185, 167, 255,
  ]);
});

it("combines fine and coarse numeric height before one clamp and classification", () => {
  const fine = new Float64Array(16);
  fine[10] = -200_100 / HEIGHT_SUM_SCALE;
  fine[11] = -200_000 / HEIGHT_SUM_SCALE;
  fine[14] = -199_990 / HEIGHT_SUM_SCALE;
  fine[15] = -199_980 / HEIGHT_SUM_SCALE;
  const pixels = rasterize(
    new Float64Array(4).fill(200_000 / HEIGHT_SUM_SCALE),
    [0, 0, 16, 16],
    4,
    [2, 2, 4, 4],
    fine,
  );
  expect([...pixels]).toEqual([
    76, 128, 151, 255, 201, 192, 144, 255, 201, 192, 144, 255, 134, 152, 105,
    255,
  ]);
});

it("keeps the unscaled world-edge mesh and leaves only out-of-world pixels transparent", () => {
  const pixels = rasterize(
    new Float64Array(4).fill(-100 / HEIGHT_SUM_SCALE),
    [99_999_872, 0, 100_000_384, 512],
    128,
    [30, 0, 34, 1],
  );
  expect([...pixels]).toEqual([
    76, 128, 151, 255, 76, 128, 151, 255, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
});

it("rejects incomplete numeric display inputs", () => {
  expect(() =>
    rasterize(new Float64Array(1), [0, 0, 4, 4], 4, [0, 0, 2, 2]),
  ).toThrow("Unvollständige Höhenwerte");
  expect(() =>
    rasterize(
      new Float64Array(4),
      [0, 0, 4, 4],
      4,
      [0, 0, 2, 2],
      new Float64Array(1),
    ),
  ).toThrow("Unvollständige numerische Höhenübersicht");
});

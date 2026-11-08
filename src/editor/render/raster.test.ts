import { expect, it } from "vitest";
import { HEIGHT_SUM_SCALE } from "../model/height";
import { colour, rasterize } from "./raster";

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
  expect([...pixels]).toEqual(
    [-100, 0, 10, 20].flatMap((height) => [...colour(height), 255]),
  );
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

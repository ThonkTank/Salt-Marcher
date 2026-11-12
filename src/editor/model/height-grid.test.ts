import { expect, it } from "vitest";
import { heightTilesFromControls } from "./fixtures";
import { heightFromScaledSum, prepareHeightSampler } from "./height";
import { prepareHeightGrid } from "./height-grid";
import { WORLD_LIMIT, type Bounds } from "./types";

it("reconstructs an independent affine field across negative tile boundaries", () => {
  const controls: [number, number, number][] = [];
  for (let y = -70; y < 4; y++)
    for (let x = -70; x < 4; x++) controls.push([x, y, 140 + 2 * x - 3 * y]);
  const grid = prepareHeightGrid(heightTilesFromControls(0, controls));
  const bounds: Bounds = [-328, -328, -296, -296];
  const values = grid(bounds, 8, [1, 2, 7, 6]);
  let index = 0;
  for (let row = 2; row < 6; row++)
    for (let column = 1; column < 7; column++) {
      const x = bounds[0] + (column + 0.5) * 4;
      const y = bounds[1] + (row + 0.5) * 4;
      expect(heightFromScaledSum(values[index++])).toBeCloseTo(
        40 + (2 * x) / 5 - (3 * y) / 5,
        11,
      );
    }
});

it("matches canonical multi-level sums at world edges without losing the fractional position", () => {
  const controls: [number, number, number][] = [];
  const edge = WORLD_LIMIT / 5;
  for (let y = edge - 10; y <= edge; y++)
    for (let x = edge - 10; x <= edge; x++)
      controls.push([x, y, 600 + (x - edge) * 31 + (y - edge) * 17]);
  const tiles = [
    ...heightTilesFromControls(0, controls),
    ...heightTilesFromControls(2, [[WORLD_LIMIT / 20, WORLD_LIMIT / 20, -120]]),
  ];
  const sample = prepareHeightSampler(tiles);
  const bounds: Bounds = [
    WORLD_LIMIT - 40,
    WORLD_LIMIT - 20,
    WORLD_LIMIT,
    WORLD_LIMIT,
  ];
  const values = prepareHeightGrid(tiles)(bounds, 16, [8, 9, 16, 16]);
  let index = 0;
  for (let row = 9; row < 16; row++)
    for (let column = 8; column < 16; column++)
      expect(heightFromScaledSum(values[index++])).toBeCloseTo(
        sample(
          bounds[0] + (column + 0.5) * 2.5,
          bounds[1] + (row + 0.5) * 1.25,
        ),
        10,
      );
});

it("does not overflow a large finite intermediate sum or clamp before cancellation", () => {
  const controls: [number, number, number][] = [];
  for (let y = -2; y <= 2; y++)
    for (let x = -2; x <= 2; x++) controls.push([x, y, 1e308]);
  const tiles = [
    ...heightTilesFromControls(0, controls),
    ...heightTilesFromControls(
      1,
      controls.map(([x, y, value]) => [x, y, -value]),
    ),
  ];
  const values = prepareHeightGrid(tiles)(
    [-0.5, -0.5, 0.5, 0.5],
    1,
    [0, 0, 1, 1],
  );
  expect(Number.isFinite(values[0])).toBe(true);
  expect(heightFromScaledSum(values[0])).toBe(
    prepareHeightSampler(tiles)(0, 0),
  );
});

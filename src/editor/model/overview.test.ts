import { describe, expect, it } from "vitest";
import {
  HEIGHT_SUM_SCALE,
  heightFromScaledSum,
  prepareScaledHeightSum,
} from "./height";
import { heightTilesFromControls } from "./fixtures";
import {
  applyHeightPatchesToOverview,
  createHeightOverviewTile,
  heightOverviewBounds,
  heightOverviewDeltaKeys,
  heightOverviewKey,
  minimumCoarseHeightLevel,
  prepareHeightOverviewDelta,
  projectHeightOverviewPatches,
} from "./overview";
import { heightTileKey, type HeightTile } from "./types";

const source = (level: number, value: number): HeightTile => ({
  key: heightTileKey(level, 0, 0),
  level,
  tileX: 0,
  tileY: 0,
  revision: 1,
  values: new Float64Array(64 * 64).fill(value),
});

describe("exact numerical height overviews", () => {
  it("partitions levels strictly by their author spacing", () => {
    expect([-4, 2, 3, 7, 24].map(minimumCoarseHeightLevel)).toEqual([
      0, 0, 1, 5, 22,
    ]);
  });

  it("uses the cubic value at the fixed centre, including negative coordinates", () => {
    const authored = heightTilesFromControls(0, [[0, 0, 900]])[0];
    const patch = { key: authored.key, before: null, after: authored };
    const positive = createHeightOverviewTile(3, 0, 0);
    const negative = createHeightOverviewTile(3, -1, -1);
    applyHeightPatchesToOverview(positive, [patch]);
    applyHeightPatchesToOverview(negative, [patch]);
    // At +/-4 feet, the control at zero has B-spline weight 106/375 per axis.
    const expected = (900 * (106 / 375) ** 2) / HEIGHT_SUM_SCALE;
    expect(positive.values[0]).toBeCloseTo(expected, 12);
    expect(negative.values[128 * 128 - 1]).toBeCloseTo(expected, 12);
    expect(heightOverviewBounds(negative)).toEqual([-1024, -1024, 0, 0]);
    const delta = prepareHeightOverviewDelta(patch)!;
    expect(heightOverviewDeltaKeys(delta, 3).sort()).toEqual(
      [
        heightOverviewKey(3, -1, -1),
        heightOverviewKey(3, -1, 0),
        heightOverviewKey(3, 0, -1),
        heightOverviewKey(3, 0, 0),
      ].sort(),
    );
    expect(heightOverviewDeltaKeys(delta, 2)).toEqual([]);
  });

  it("retains a cubic halo across an author-tile boundary", () => {
    const authored = heightTilesFromControls(0, [[63, 0, 900]])[0];
    const tile = createHeightOverviewTile(3, 0, 0);
    applyHeightPatchesToOverview(tile, [
      { key: authored.key, before: null, after: authored },
    ]);
    // x=324 is beyond the 320-foot author-tile body but inside control315's halo.
    // Cubic weights at distance9/5 and4/5 are (1/5)^3/6 and106/375.
    expect(tile.values[40] * HEIGHT_SUM_SCALE).toBeCloseTo(
      900 * ((1 / 5) ** 3 / 6) * (106 / 375),
      11,
    );
  });

  it("adds coarse authors before clipping and reclassifying a coast", () => {
    const fine = source(0, 200_000);
    const coarse = source(3, -200_000);
    const tile = createHeightOverviewTile(3, 0, 0);
    applyHeightPatchesToOverview(tile, [
      { key: fine.key, before: null, after: fine },
    ]);
    const p = 132;
    const at = 16 * 128 + 16;
    const before = prepareScaledHeightSum([coarse]);
    expect(heightFromScaledSum(before(p, p) + tile.values[at])).toBeCloseTo(
      -100,
      8,
    );
    const lifted = { ...coarse, values: new Float64Array(4096).fill(-199_800) };
    expect(
      applyHeightPatchesToOverview(tile, [
        { key: coarse.key, before: coarse, after: lifted },
      ]),
    ).toBe(0);
    const after = prepareScaledHeightSum([lifted]);
    expect(heightFromScaledSum(after(p, p) + tile.values[at])).toBeCloseTo(
      100,
      8,
    );
  });

  it("keeps undo/redo deltas stable without writing a fine author", () => {
    const original = heightTilesFromControls(0, [[0, 0, 1 / 3]])[0];
    const changed = { ...original, values: original.values.slice() };
    changed.values[0] = Math.PI;
    const tile = createHeightOverviewTile(3, 0, 0);
    applyHeightPatchesToOverview(tile, [
      { key: original.key, before: null, after: original },
    ]);
    const expected = tile.values[0];
    for (let i = 0; i < 1000; i++) {
      applyHeightPatchesToOverview(tile, [
        { key: original.key, before: original, after: changed },
      ]);
      applyHeightPatchesToOverview(tile, [
        { key: original.key, before: changed, after: original },
      ]);
    }
    expect(tile.values[0]).toBeCloseTo(expected, 12);
    expect(original.values[0]).toBe(1 / 3);
    applyHeightPatchesToOverview(tile, [
      { key: original.key, before: original, after: null },
    ]);
    expect(Math.max(...tile.values.map(Math.abs))).toBeLessThan(1e-12);
  });

  it("only projects over certified keys and does not mutate the store reply", () => {
    const fine = heightTilesFromControls(0, [[0, 0, 900]])[0];
    const patch = { key: fine.key, before: null, after: fine };
    const key = heightOverviewKey(3, 0, 0);
    expect(projectHeightOverviewPatches([], [], [patch])).toEqual([]);
    const projected = projectHeightOverviewPatches([], [key], [patch]);
    expect(projected).toHaveLength(1);
    const original = projected[0].values[0];
    const twice = projectHeightOverviewPatches(projected, [key], [patch]);
    expect(projected[0].values[0]).toBe(original);
    expect(twice[0].values[0]).toBeCloseTo(original * 2, 12);
    expect(() => projectHeightOverviewPatches(projected, [], [])).toThrow(
      /bestätigte/,
    );
  });

  it("clips sample eligibility at the world edge without stretching its lattice", () => {
    const authored = heightTilesFromControls(0, [[20_000_000, 0, 900]])[0];
    const tileX = Math.floor(100_000_000 / 1024);
    const tile = createHeightOverviewTile(3, tileX, 0);
    applyHeightPatchesToOverview(tile, [
      { key: authored.key, before: null, after: authored },
    ]);
    const x = Math.floor(100_000_000 / 8 - 0.5) - tileX * 128;
    expect(tile.values[x] * HEIGHT_SUM_SCALE).toBeCloseTo(
      900 * (106 / 375) ** 2,
      7,
    );
    expect(tile.values[x + 1]).toBe(0);
  });

  it("keeps very large fine sums finite until opposite coarse fields are included", () => {
    const fine = [source(0, 8e307), source(1, 8e307)];
    const tile = createHeightOverviewTile(4, 0, 0);
    applyHeightPatchesToOverview(
      tile,
      fine.map((after) => ({ key: after.key, before: null, after })),
    );
    expect(tile.values.every(Number.isFinite)).toBe(true);
    const coarse = [source(2, -8e307), source(3, -8e307)];
    const sample = prepareScaledHeightSum(coarse);
    // The shared interior point232 has complete support on all four tile levels.
    const index = 14 * 128 + 14;
    const height = heightFromScaledSum(sample(232, 232) + tile.values[index]);
    expect(Number.isFinite(height)).toBe(true);
    expect(Math.abs(height)).toBeLessThanOrEqual(100_000);
  });
});

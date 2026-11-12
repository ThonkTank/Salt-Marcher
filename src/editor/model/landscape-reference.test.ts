import { describe, expect, it, vi } from "vitest";
import {
  referenceLandscapeGrid,
  referenceLandscapeSample,
} from "../../../scripts/atlas-p3-landscape-reference.mjs";
import {
  applyLandscapeOverviewPatch,
  createLandscapeOverviewTile,
  landscapeOverviewPatchKeys,
  prepareLandscapePresentation,
  prepareLandscapeSampler,
  sampleLandscapePresentation,
  type LandscapeOverviewTile,
  type LandscapePresentationRead,
} from "./landscape";
import type {
  Bounds,
  LandscapePatch,
  LandscapeTile,
  LandscapeWeights,
} from "./types";

type Cell = [number, number, LandscapeWeights];
const limit = 100_000_000;
// Fixtures intentionally derive addressing without any product helpers.
function raw(
  level: number,
  tileX: number,
  tileY: number,
  cells: Cell[] = [],
): LandscapeTile {
  const tile: LandscapeTile = {
    key: `landscape:${level}:${tileX}:${tileY}`,
    level,
    tileX,
    tileY,
    revision: 1,
    mask: new Uint8Array(4096),
    values: new Uint8Array(16384),
  };
  for (const [x, y, weights] of cells) {
    tile.mask[y * 64 + x] = 1;
    tile.values.set(weights, (y * 64 + x) * 4);
  }
  return tile;
}
function full(
  level: number,
  tileX: number,
  tileY: number,
  weights: LandscapeWeights,
): LandscapeTile {
  return raw(
    level,
    tileX,
    tileY,
    Array.from({ length: 4096 }, (_, index) => [
      index % 64,
      Math.floor(index / 64),
      weights,
    ]),
  );
}
const patch = (
  before: LandscapeTile | null,
  after: LandscapeTile | null,
): LandscapePatch => ({ key: (after ?? before)!.key, before, after });

function lookup(
  sources: readonly LandscapeTile[],
  level: number,
  x: number,
  y: number,
): LandscapeWeights | null {
  const step = 2 ** level;
  const cx = x === limit ? Math.ceil(x / step) - 1 : Math.floor(x / step);
  const cy = y === limit ? Math.ceil(y / step) - 1 : Math.floor(y / step);
  for (const source of sources) {
    if (source.level !== level) continue;
    const localX = cx - source.tileX * 64,
      localY = cy - source.tileY * 64;
    if (localX < 0 || localX >= 64 || localY < 0 || localY >= 64) continue;
    const index = localY * 64 + localX;
    if (source.mask[index])
      return Array.from(
        source.values.slice(index * 4, index * 4 + 4),
      ) as LandscapeWeights;
  }
  return null;
}

function readFor(
  sources: LandscapeTile[],
  power: number,
  tileX: number,
  tileY: number,
  existing?: LandscapeOverviewTile,
): LandscapePresentationRead {
  const overview = existing ?? createLandscapeOverviewTile(power, tileX, tileY);
  if (!existing)
    for (const source of sources)
      applyLandscapeOverviewPatch(
        overview,
        patch(null, source),
        (level, x, y) => lookup(sources, level, x, y),
      );
  const span = 128 * 2 ** power;
  const bounds = [
    tileX * span,
    tileY * span,
    (tileX + 1) * span,
    (tileY + 1) * span,
  ].map((value) => Math.max(-limit, Math.min(limit, value))) as Bounds;
  return {
    sessionId: "independent-reference",
    sequence: 7,
    power,
    bounds,
    tiles: sources.filter(
      (source) => source.level >= Math.max(0, Math.min(25, power)),
    ),
    overviewKeys: [`landscape-overview:${power}:${tileX}:${tileY}`],
    overviews: [overview],
  };
}

function resolvedGrid(
  read: LandscapePresentationRead,
  tileX: number,
  tileY: number,
): Uint8Array {
  const sample = prepareLandscapePresentation(read);
  const result = new Uint8Array(128 * 128 * 4);
  for (let row = 0; row < 128; row++)
    for (let column = 0; column < 128; column++) {
      const x = (tileX * 128 + column + 0.5) * 2 ** read.power;
      const y = (tileY * 128 + row + 0.5) * 2 ** read.power;
      if (Math.abs(x) <= limit && Math.abs(y) <= limit)
        result.set(sample(x, y), (row * 128 + column) * 4);
    }
  return result;
}

describe("independent complete landscape reference", () => {
  it.each([1, 2])(
    "keeps the closed positive corner inside its last display cell at power %i",
    (power) => {
      const sources = [full(0, 1562499, 1562499, [40, 30, 20, 10])];
      const span = 128 * 2 ** power;
      const last = Math.ceil(limit / span) - 1;
      const outside = Math.floor(limit / span);
      const read = readFor(sources, power, last, last);
      read.bounds = [limit - 64, limit - 64, limit, limit];
      // Certify the bordering exterior tiles as empty too: selecting one of them
      // must fail the value comparison, not merely throw for an unknown key.
      read.overviewKeys = [
        ...new Set([
          `landscape-overview:${power}:${last}:${last}`,
          `landscape-overview:${power}:${outside}:${last}`,
          `landscape-overview:${power}:${last}:${outside}`,
          `landscape-overview:${power}:${outside}:${outside}`,
        ]),
      ];
      const presented = prepareLandscapePresentation(read);
      for (const [x, y] of [
        [limit - 1, limit - 1],
        [limit, limit - 1],
        [limit - 1, limit],
        [limit, limit],
      ]) {
        const expected = referenceLandscapeSample(sources, x, y);
        expect(expected).toEqual([40, 30, 20, 10]);
        expect(presented(x, y)).toEqual(expected);
      }
    },
  );

  it("distinguishes missing inheritance, explicit empty and mixed four-channel authors", () => {
    const coarse = full(4, 0, 0, [80, 40, 30, 10]);
    const fine = raw(0, 0, 0, [
      [2, 2, [0, 0, 0, 0]],
      [3, 2, [11, 22, 33, 44]],
    ]);
    const sources = [coarse, fine];
    const sample = prepareLandscapeSampler(sources);
    for (const point of [
      [1.5, 2.5],
      [2.5, 2.5],
      [3.5, 2.5],
    ] as const)
      expect(sample(point[0], point[1])).toEqual(
        referenceLandscapeSample(sources, point[0], point[1]),
      );
    expect(sample(1.5, 2.5)).toEqual([80, 40, 30, 10]);
    expect(sample(2.5, 2.5)).toEqual([0, 0, 0, 0]);
    expect(sample(3.5, 2.5)).toEqual([11, 22, 33, 44]);
    expect(prepareLandscapeSampler(sources, 1)(2.5, 2.5)).toEqual([
      80, 40, 30, 10,
    ]);
  });

  it("keeps negative cells and tile boundaries half open", () => {
    const sources = [
      raw(0, -2, -1, [[63, 63, [65, 0, 0, 0]]]),
      raw(0, -1, -1, [
        [0, 63, [64, 0, 0, 0]],
        [63, 63, [1, 0, 0, 0]],
      ]),
      raw(0, 0, -1, [[0, 63, [0, 2, 0, 0]]]),
    ];
    const sample = prepareLandscapeSampler(sources);
    for (const x of [-65, -64.001, -64, -63.999, -1, -0.001, 0, 0.999])
      expect(sample(x, -0.5)).toEqual(
        referenceLandscapeSample(sources, x, -0.5),
      );
    expect(sample(-64.001, -0.5)).toEqual([65, 0, 0, 0]);
    expect(sample(-64, -0.5)).toEqual([64, 0, 0, 0]);
    expect(sample(-0.001, -0.5)).toEqual([1, 0, 0, 0]);
    expect(sample(0, -0.5)).toEqual([0, 2, 0, 0]);
  });

  it("selects the finest present author across every one of 25 unordered levels", () => {
    const sources = Array.from({ length: 25 }, (_, level) =>
      raw(level, 0, 0, [[0, 0, [level + 1, 0, 0, 0]]]),
    ).reverse();
    for (let minimum = 0; minimum <= 25; minimum++) {
      const expected = referenceLandscapeSample(sources, 0.25, 0.25, {
        minLevel: minimum,
      });
      expect(prepareLandscapeSampler(sources, minimum)(0.25, 0.25)).toEqual(
        expected,
      );
      expect(expected).toEqual([minimum === 25 ? 0 : minimum + 1, 0, 0, 0]);
    }
  });

  it.each([-8, 0, 1, 4, 12, 24])(
    "matches the full independent fixed grid at power %i on both sides of zero",
    (power) => {
      const sources = [
        full(24, 0, 0, [40, 30, 20, 10]),
        full(24, -1, -1, [10, 20, 30, 40]),
        full(12, 0, 0, [90, 0, 20, 0]),
        full(12, -1, -1, [0, 90, 0, 20]),
        full(4, 0, 0, [140, 0, 0, 0]),
        full(4, -1, -1, [0, 100, 0, 0]),
        raw(0, 0, 0, [
          [0, 0, [0, 0, 0, 0]],
          [1, 0, [1, 2, 3, 4]],
        ]),
        raw(0, -1, -1, [
          [63, 63, [0, 0, 0, 0]],
          [62, 63, [0, 0, 0, 200]],
        ]),
      ];
      for (const coordinate of [-1, 0])
        expect(
          resolvedGrid(
            readFor(sources, power, coordinate, coordinate),
            coordinate,
            coordinate,
          ),
        ).toEqual(
          referenceLandscapeGrid(sources, power, coordinate, coordinate),
        );
    },
  );

  it("preserves a fine clearing when coarse coverage changes without consulting finer sources", () => {
    const fine = raw(0, 0, 0, [[8, 8, [0, 0, 0, 0]]]);
    const coarse = raw(4, 0, 0, [[0, 0, [80, 0, 0, 0]]]);
    const changed = raw(4, 0, 0, [[0, 0, [180, 0, 0, 0]]]);
    const read = readFor([coarse, fine], 4, 0, 0);
    const noReads = vi.fn(() => {
      throw new Error("Coarse patch read descendants");
    });
    expect(
      applyLandscapeOverviewPatch(
        read.overviews[0],
        patch(coarse, changed),
        noReads,
      ),
    ).toEqual({ examinedSamples: 0, changedSamples: 0 });
    expect(noReads).not.toHaveBeenCalled();
    read.tiles = [changed];
    expect(sampleLandscapePresentation(read, 8, 8)).toEqual([0, 0, 0, 0]);
    expect(resolvedGrid(read, 0, 0)).toEqual(
      referenceLandscapeGrid([changed, fine], 4, 0, 0),
    );
    expect(read.overviews[0].rest[0]).toBe(0);
    expect(read.overviews[0].sourceLevels[0]).toBe(0);
  });

  it("removing fine authors reveals the middle owner then coarse inheritance", () => {
    const fine = raw(0, 0, 0, [[16, 16, [0, 0, 0, 0]]]);
    const middle = raw(2, 0, 0, [[4, 4, [0, 90, 0, 0]]]);
    const coarse = raw(5, 0, 0, [[0, 0, [180, 0, 0, 0]]]);
    const read = readFor([coarse, middle, fine], 5, 0, 0);
    expect(sampleLandscapePresentation(read, 16, 16)).toEqual([0, 0, 0, 0]);
    applyLandscapeOverviewPatch(
      read.overviews[0],
      patch(fine, null),
      (level, x, y) => lookup([middle], level, x, y),
    );
    expect(sampleLandscapePresentation(read, 16, 16)).toEqual([0, 90, 0, 0]);
    expect(resolvedGrid(read, 0, 0)).toEqual(
      referenceLandscapeGrid([coarse, middle], 5, 0, 0),
    );
    applyLandscapeOverviewPatch(
      read.overviews[0],
      patch(middle, null),
      () => null,
    );
    expect(read.overviews[0].rest[0]).toBe(1);
    expect(read.overviews[0].sourceLevels[0]).toBe(255);
    expect(resolvedGrid(read, 0, 0)).toEqual(
      referenceLandscapeGrid([coarse], 5, 0, 0),
    );
  });

  it("includes the closed positive world edge without moving the clipped overview lattice", () => {
    const fine = raw(0, 1_562_499, 4, [[63, 0, [0, 0, 0, 0]]]);
    const middle = raw(4, 97_656, 0, [[15, 16, [0, 90, 0, 0]]]);
    const coarse = raw(9, 3051, 0, [[48, 0, [177, 0, 0, 0]]]);
    const corner = raw(0, 1_562_499, 1_562_499, [[63, 63, [1, 2, 3, 4]]]);
    expect(prepareLandscapeSampler([corner])(limit, limit)).toEqual(
      referenceLandscapeSample([corner], limit, limit),
    );
    expect(prepareLandscapeSampler([corner])(limit, limit)).toEqual([
      1, 2, 3, 4,
    ]);
    expect((1525 * 128 + 112 + 0.5) * 512).toBe(limit);
    expect(landscapeOverviewPatchKeys(patch(null, fine))).toContain(
      "landscape-overview:9:1525:0",
    );
    const sources = [coarse, middle, fine];
    const read = readFor(sources, 9, 1525, 0);
    expect(resolvedGrid(read, 1525, 0)).toEqual(
      referenceLandscapeGrid(sources, 9, 1525, 0),
    );
    expect(sampleLandscapePresentation(read, limit, 256)).toEqual([0, 0, 0, 0]);
    applyLandscapeOverviewPatch(
      read.overviews[0],
      patch(fine, null),
      (level, x, y) => lookup([middle], level, x, y),
    );
    expect(sampleLandscapePresentation(read, limit, 256)).toEqual([
      0, 90, 0, 0,
    ]);
    expect(resolvedGrid(read, 1525, 0)).toEqual(
      referenceLandscapeGrid([coarse, middle], 9, 1525, 0),
    );
    expect(
      landscapeOverviewPatchKeys(
        patch(null, raw(0, 1_562_500, 0, [[0, 0, [1, 0, 0, 0]]])),
      ),
    ).toEqual([]);
  });

  it("rejects unknown or malformed inputs instead of passing plausible empty values", () => {
    expect(() => referenceLandscapeSample([], Number.NaN, 0)).toThrow();
    const invalid = raw(0, 0, 0, [[0, 0, [1, 0, 0, 0]]]);
    invalid.mask[0] = 2;
    expect(() => referenceLandscapeSample([invalid], 0, 0)).toThrow();
    invalid.mask[0] = 1;
    invalid.values.set([255, 1, 0, 0], 0);
    expect(() => referenceLandscapeSample([invalid], 0, 0)).toThrow();
    const read = readFor([], 4, 0, 0);
    read.overviewKeys = [];
    read.overviews = [];
    expect(() => sampleLandscapePresentation(read, 8, 8)).toThrow();
    const malformed = readFor([], 4, 0, 0);
    malformed.overviews[0].rest[0] = 2;
    expect(() => prepareLandscapePresentation(malformed)).toThrow();
    const fine = raw(0, 0, 0, [[8, 8, [0, 0, 0, 0]]]);
    const owned = readFor([fine], 4, 0, 0);
    expect(() =>
      applyLandscapeOverviewPatch(
        owned.overviews[0],
        patch(fine, null),
        () => undefined,
      ),
    ).toThrow();
  });
});

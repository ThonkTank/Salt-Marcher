import { describe, expect, it } from "vitest";
import {
  FOUNDATION_MAX_RETAINED_CONTROLS,
  FOUNDATION_TOLERANCE_FT,
  HEIGHT_LEVELS,
  RIVER_SAMPLE_SUPPORT,
  cubicBasisInterval,
  deriveFoundation,
  heightTilesFromControls,
  houseCorners,
  pointwiseFoundation,
  pointwiseNatural,
  prepareHeightSampler,
  riverInfluence,
  waterAtPoint,
  type FoundationResult,
  type HeightSnapshot,
  type HouseHeader,
  type LakeSource,
  type RiverSource,
} from "./index";

const terrain = {
  kind: "height" as const,
  bounds: [-1000, -1000, 1000, 1000] as [number, number, number, number],
  identity: `height-controls-v1:${"0".repeat(64)}` as const,
};
const lake: LakeSource = {
  kind: "lake",
  id: "lake",
  revision: 0,
  name: "See",
  level: 32,
  terrain,
  rings: [
    [
      [-50, -50],
      [50, -50],
      [50, 50],
      [-50, 50],
    ],
    [
      [-10, -10],
      [10, -10],
      [10, 10],
      [-10, 10],
    ],
  ],
};
const river: RiverSource = {
  kind: "river",
  id: "river",
  revision: 0,
  name: "Fluss",
  terrain,
  samples: [
    { point: [0, -100], width: 20, level: 30 },
    { point: [0, 100], width: 20, level: 30 },
  ],
};

function house(values: Partial<HouseHeader> = {}): HouseHeader {
  return {
    id: "house",
    revision: 0,
    x: 0,
    y: 0,
    width: 40,
    depth: 30,
    rotation: 0,
    foundationHeight: 1,
    foundationTransition: 10,
    ...values,
  };
}
function snapshot(tiles: HeightSnapshot["tiles"] = []): HeightSnapshot {
  return {
    sessionId: "surface",
    revision: 0,
    generation: 0,
    sequence: 0,
    bounds: [-500, -500, 500, 500],
    levels: HEIGHT_LEVELS,
    tiles,
  };
}
function plane(): HeightSnapshot {
  const controls: [number, number, number][] = [];
  for (let y = -16; y <= 16; y++)
    for (let x = -16; x <= 16; x++)
      controls.push([x, y, 134 + 0.025 * x * 40 + 0.01 * y * 40]);
  return snapshot(heightTilesFromControls(3, controls));
}
function finish<T>(job: Generator<void, T>): T {
  let step = job.next(),
    count = 0;
  while (!step.done) {
    expect(++count).toBeLessThan(100_000);
    step = job.next();
  }
  return step.value;
}
function foundation(base: number): FoundationResult {
  return {
    houseId: "house",
    status: "current",
    baseLower: base,
    baseUpper: base,
    topLower: base + 1,
    topUpper: base + 1,
    toleranceFt: FOUNDATION_TOLERANCE_FT,
    nodes: 1,
    controlSteps: 0,
  };
}

describe("confirmed water and current natural surface", () => {
  it("uses the absolute confirmed profile, a two-foot bed and the shared smooth influence", () => {
    const sample = () => 100;
    expect(pointwiseNatural(sample, [river], [0, 0])).toBe(28);
    expect(
      pointwiseNatural(sample, [river], [10 + RIVER_SAMPLE_SUPPORT + 10, 0]),
    ).toBeCloseTo(64, 12);
    expect(
      pointwiseNatural(sample, [river], [10 + RIVER_SAMPLE_SUPPORT + 20, 0]),
    ).toBe(100);
    expect(pointwiseNatural(() => 10, [river], [0, 0])).toBe(10);
    expect(riverInfluence(0, 20)).toBe(1);
  });

  it("clips mask water transiently, keeps holes dry and chooses the lowest overlapping wet level", () => {
    const authored = structuredClone(lake);
    expect(waterAtPoint([lake], [30, 0], 31)?.level).toBe(32);
    expect(waterAtPoint([lake], [30, 0], 32)).toBeNull();
    expect(waterAtPoint([lake], [30, 0], 30)?.level).toBe(32);
    expect(waterAtPoint([lake], [0, 0], 10)).toBeNull();
    expect(waterAtPoint([lake, river], [0, 30], 28)?.level).toBe(30);
    expect(lake).toEqual(authored);
  });

  it("keeps footprint ownership above foreign transitions and uses maximum overlapping bases", () => {
    const a = { house: house(), foundation: foundation(30) };
    const b = {
      house: house({ id: "b", x: 50, foundationTransition: 100 }),
      foundation: foundation(90),
    };
    expect(pointwiseFoundation(10, [a, b], [0, 0])).toBe(30);
    expect(pointwiseFoundation(10, [a], [25, 0])).toBe(20);
    const overlap = {
      house: house({ id: "overlap" }),
      foundation: foundation(40),
    };
    expect(pointwiseFoundation(10, [a, overlap], [0, 0])).toBe(40);
    expect(pointwiseFoundation(10, [overlap, a], [0, 0])).toBe(40);
  });
});

describe("bounded complete-footprint maximum proofs", () => {
  it("bounds cubic critical points inside an interval", () => {
    const [low, high] = cubicBasisInterval(-0.75, 0.25);
    expect(low).toBeLessThanOrEqual(2 / 3 - 0.75 ** 2 + 0.75 ** 3 / 2);
    expect(high).toBeGreaterThanOrEqual(2 / 3);
    expect(cubicBasisInterval(2, 3)).toEqual([0, 0]);
  });

  it.each([0, 15, 45, 90])(
    "proves the analytic plane maximum for a %s degree house",
    (rotation) => {
      const h = house({ x: 132, y: 55, width: 52, depth: 36, rotation });
      const expected = Math.max(
        ...houseCorners(h).map(([x, y]) => 34 + 0.025 * x + 0.01 * y),
      );
      const result = finish(deriveFoundation(h, plane(), []));
      expect(result.status).toBe("current");
      expect(result.baseLower).toBeLessThanOrEqual(expected + 1e-12);
      expect(result.baseUpper).toBeGreaterThanOrEqual(expected - 1e-12);
      expect(result.baseUpper - result.baseLower).toBeLessThanOrEqual(
        FOUNDATION_TOLERANCE_FT,
      );
      expect(result.topUpper).toBe(result.baseUpper + 1);
    },
  );

  it("finds a spline maximum between control points, not just corners or five-foot samples", () => {
    // Two equal neighbouring controls: maximum at (2.5,0), B3(.5)*2*B3(0)*180 =115.
    const terrain = snapshot(
      heightTilesFromControls(0, [
        [0, 0, 180],
        [1, 0, 180],
      ]),
    );
    const result = finish(
      deriveFoundation(house({ width: 20, depth: 20 }), terrain, []),
    );
    expect(result.status).toBe("current");
    expect(result.baseLower).toBeLessThanOrEqual(15 + 1e-12);
    expect(result.baseUpper).toBeGreaterThanOrEqual(15 - 1e-12);
    expect(result.baseUpper - result.baseLower).toBeLessThanOrEqual(
      FOUNDATION_TOLERANCE_FT,
    );
  });

  it("proves the prepared D03 house against its current confirmed river bed", () => {
    const source: RiverSource = {
      ...river,
      samples: [
        { point: [60, -180], width: 36, level: 38 },
        { point: [80, -60], width: 42, level: 35 },
        { point: [100, 60], width: 48, level: 32 },
        { point: [160, 180], width: 54, level: 29 },
      ],
    };
    const h = house({
      x: 132,
      y: 55,
      width: 52,
      depth: 36,
      rotation: 15,
      foundationTransition: 12,
    });
    const result = finish(deriveFoundation(h, plane(), [source]));
    expect(result.status).toBe("current");
    expect(result.baseLower).toBeLessThanOrEqual(35.8315327891 + 1e-10);
    expect(result.baseUpper).toBeGreaterThanOrEqual(35.8315327891 - 1e-10);
    expect(result.baseUpper - result.baseLower).toBeLessThanOrEqual(
      FOUNDATION_TOLERANCE_FT,
    );
    const natural = pointwiseNatural(
      prepareHeightSampler(plane()),
      [source],
      [100, 60],
    );
    expect(natural).toBeCloseTo(30, 12);
  });

  it("returns unknown on budget exhaustion or incomplete sources without claiming an approximate maximum", () => {
    const source = snapshot(
      heightTilesFromControls(0, [
        [0, 0, 180],
        [1, 0, 180],
      ]),
    );
    const limited = finish(
      deriveFoundation(house(), source, [], { maxNodes: 1 }),
    );
    expect(limited.status).toBe("unknown");
    expect(limited.reason).toBe("budget");
    expect(limited.baseUpper - limited.baseLower).toBeGreaterThan(
      FOUNDATION_TOLERANCE_FT,
    );
    expect(
      finish(deriveFoundation(house(), { ...source, levels: [0] }, [])).reason,
    ).toBe("sources");
  });

  it("stops before retaining more than the fixed number of effective controls", () => {
    const controls: [number, number, number][] = [];
    // Two full tiles and the first control of a third tile all affect the house.
    // Every examined entry before exhaustion is nonzero and inside its support.
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 128; x++) controls.push([x, y, 107]);
    controls.push([128, 0, 107]);
    expect(controls).toHaveLength(FOUNDATION_MAX_RETAINED_CONTROLS + 1);
    const source: HeightSnapshot = {
      ...snapshot(heightTilesFromControls(0, controls)),
      bounds: [-10, -10, 650, 650],
    };
    const result = finish(
      deriveFoundation(
        house({ x: 320, y: 320, width: 640, depth: 640 }),
        source,
        [],
      ),
    );
    expect(result.status).toBe("unknown");
    expect(result.reason).toBe("budget");
    expect(result.nodes).toBe(0);
    expect(result.controlSteps).toBe(FOUNDATION_MAX_RETAINED_CONTROLS + 1);
  });

  it("allows a complete normal proof at its retained-control limit", () => {
    // A 40-by-30-foot footprint has exactly 25 relevant level-three controls.
    const current = finish(
      deriveFoundation(house(), plane(), [], { maxRetainedControls: 25 }),
    );
    expect(current.status).toBe("current");
    expect(current.baseLower).toBeLessThanOrEqual(34.65);
    expect(current.baseUpper).toBeGreaterThanOrEqual(34.65);
    const limited = finish(
      deriveFoundation(house(), plane(), [], { maxRetainedControls: 24 }),
    );
    expect(limited.status).toBe("unknown");
    expect(limited.reason).toBe("budget");
    expect(limited.nodes).toBe(0);
    const zero = finish(
      deriveFoundation(house(), plane(), [], { maxRetainedControls: 0 }),
    );
    expect(zero.reason).toBe("budget");
    expect(zero.controlSteps).toBe(0);
  });

  it.each([-1, 0.5, FOUNDATION_MAX_RETAINED_CONTROLS + 1, NaN, Infinity])(
    "rejects a retained-control limit of %s",
    (maxRetainedControls) => {
      expect(() =>
        deriveFoundation(house(), plane(), [], { maxRetainedControls }).next(),
      ).toThrow(RangeError);
    },
  );

  it.each([7, 31, 68])(
    "encloses independent dense samples of signed multilevel terrain at %s degrees",
    (rotation) => {
      const fine: [number, number, number][] = [];
      for (let y = -5; y <= 5; y++)
        for (let x = -5; x <= 5; x++)
          fine.push([x, y, 22 * Math.cos(x * 0.8) * Math.sin(y * 0.6) - 4 * x]);
      const field = plane();
      field.tiles.push(...heightTilesFromControls(0, fine));
      const h = house({ width: 20, depth: 16, rotation });
      const actual = finish(deriveFoundation(h, field, []));
      expect(actual.status).toBe("current");
      const sample = prepareHeightSampler(field);
      const angle = (rotation * Math.PI) / 180;
      let denseMaximum = -Infinity;
      for (let y = 0; y <= 100; y++)
        for (let x = 0; x <= 100; x++) {
          const a = (x / 100 - 0.5) * h.width,
            b = (y / 100 - 0.5) * h.depth;
          denseMaximum = Math.max(
            denseMaximum,
            sample(
              a * Math.cos(angle) - b * Math.sin(angle),
              a * Math.sin(angle) + b * Math.cos(angle),
            ),
          );
        }
      expect(actual.baseUpper).toBeGreaterThanOrEqual(denseMaximum - 1e-10);
      expect(actual.baseUpper - actual.baseLower).toBeLessThanOrEqual(
        FOUNDATION_TOLERANCE_FT,
      );
    },
  );

  it("clamps the complete natural sum before deriving the top and never lets water raise a foundation", () => {
    const controls: [number, number, number][] = [];
    for (let y = -3; y <= 3; y++)
      for (let x = -3; x <= 3; x++) controls.push([x, y, 200_000]);
    const capped = finish(
      deriveFoundation(
        house({ width: 5, depth: 5 }),
        snapshot(heightTilesFromControls(3, controls)),
        [],
      ),
    );
    expect(capped.status).toBe("current");
    expect(capped.baseUpper).toBe(100_000);
    expect(capped.topUpper).toBe(100_001);
    const submerged = finish(
      deriveFoundation(house(), snapshot(), [lake, river]),
    );
    expect(submerged.status).toBe("current");
    expect(submerged.baseUpper).toBeCloseTo(-100, 10);
  });
});

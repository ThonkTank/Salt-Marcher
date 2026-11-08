import { describe, expect, it } from "vitest";
import {
  COAST_FIXTURE_BOUNDS,
  EditorDocument,
  HEIGHT_TILE_BYTES,
  SourcesNotReadyError,
  TRENCH_POINT,
  WORLD_LIMIT,
  createCoastFixture,
  heightControlAddress,
  heightTileFromRecord,
  heightTileKey,
  heightTileToRecord,
  heightTilesFromControls,
  prepareHeightSampler,
  requiredHeightSources,
  splineWeights,
  type Bounds,
  type HeightTile,
  type Point,
} from "./index";

const ALL: Bounds = [-WORLD_LIMIT, -WORLD_LIMIT, WORLD_LIMIT, WORLD_LIMIT];
const LOCAL: Bounds = [-1000, -1000, 1000, 1000];

function constant(level: number, value: number): HeightTile[] {
  const controls: [number, number, number][] = [];
  for (let y = -3; y <= 3; y++)
    for (let x = -3; x <= 3; x++) controls.push([x, y, value]);
  return heightTilesFromControls(level, controls);
}

function stroke(
  doc: EditorDocument,
  points: Point[],
  level = 0,
  amount = 10,
  radius = 20,
) {
  doc.beginGesture({ level, radius, amount });
  const bounds = points.map((p) => doc.applyPoint(p));
  const change = doc.finishGesture();
  return { change, bounds };
}

function values(tiles: HeightTile[]) {
  return [...tiles]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ key, values }) => ({ key, values: Array.from(values) }));
}

describe("canonical relative height reconstruction", () => {
  it("uses the positive cubic basis, including fixed reference values", () => {
    expect(splineWeights(0)).toEqual([1 / 6, 4 / 6, 1 / 6, 0]);
    expect(splineWeights(0.5)).toEqual([1 / 48, 23 / 48, 23 / 48, 1 / 48]);
    for (let i = 0; i <= 100; i++) {
      const weights = splineWeights(i / 100);
      expect(weights.every((w) => w >= 0)).toBe(true);
      expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 14);
    }
    expect(() => splineWeights(Number.NaN)).toThrow();
  });

  it("preserves an independently known planar height and coast", () => {
    const sample = prepareHeightSampler(createCoastFixture({ trench: false }));
    for (const [x, y] of [
      [-800, -200],
      [-400, 0],
      [320, 0],
      [1000, 400],
    ])
      expect(sample(x, y)).toBeCloseTo(20 + 0.05 * x, 10);
    expect(sample(-420, 0)).toBeLessThan(0);
    expect(sample(-380, 0)).toBeGreaterThan(0);
    expect(prepareHeightSampler([])(0, 0)).toBe(-100);
  });

  it("adds residuals and clamps the final height once", () => {
    const sample = prepareHeightSampler([
      ...constant(1, 150_000),
      ...constant(0, -70_000),
    ]);
    expect(sample(0, 0)).toBeCloseTo(79_900, 8);
    expect(prepareHeightSampler(constant(0, 200_000))(0, 0)).toBe(100_000);
    expect(prepareHeightSampler(constant(0, -200_000))(0, 0)).toBe(-100_000);
    expect(
      Number.isFinite(
        prepareHeightSampler(constant(0, Number.MAX_VALUE))(0, 0),
      ),
    ).toBe(true);
  });

  it("keeps local precision near large positive and negative world coordinates", () => {
    const local = prepareHeightSampler(createCoastFixture());
    for (const origin of [
      [90_000_000, 0],
      [-90_000_000, 0],
    ] as Point[]) {
      const far = prepareHeightSampler(createCoastFixture({ origin }));
      for (const dx of [319.875, 320, 320.125, -400.125])
        expect(far(origin[0] + dx, 0)).toBeCloseTo(local(dx, 0), 8);
    }
  });

  it("uses floor ownership at negative tile boundaries", () => {
    expect(heightControlAddress(0, -1, -1)).toEqual({
      key: "height:0:-1:-1",
      tileX: -1,
      tileY: -1,
      index: 4095,
    });
    expect(heightControlAddress(0, -64, -64).index).toBe(0);
    expect(heightControlAddress(0, -65, 0)).toEqual({
      key: "height:0:-2:0",
      tileX: -2,
      tileY: 0,
      index: 63,
    });
    const sample = prepareHeightSampler(
      heightTilesFromControls(0, [[-1, -1, 9]]),
    );
    expect(sample(-5, -5)).toBeCloseTo(-96, 12);
  });

  it("validates serialized sources without treating residue as absolute height", () => {
    const tile = constant(0, 150_000)[0];
    const reopened = heightTileFromRecord(
      JSON.parse(JSON.stringify(heightTileToRecord(tile))),
    );
    expect(values([reopened])).toEqual(values([tile]));
    expect(() =>
      heightTileFromRecord({ ...heightTileToRecord(tile), values: [0] }),
    ).toThrow();
    const bad = heightTileToRecord(tile);
    bad.values[0] = Number.POSITIVE_INFINITY;
    expect(() => heightTileFromRecord(bad)).toThrow();
    expect(() => prepareHeightSampler([tile])(-WORLD_LIMIT - 1, 0)).toThrow();
    expect(() => prepareHeightSampler([tile])(Number.NaN, 0)).toThrow();
  });
});

describe("local source readiness and ownership", () => {
  it("distinguishes missing cache data from confirmed absent terrain", () => {
    const doc = new EditorDocument("cold");
    expect(doc.sourceState("height:0:0:0")).toBe("unknown");
    expect(() => doc.sampleHeight(0, 0)).toThrow(SourcesNotReadyError);
    doc.acceptCoverage([-10, -10, 10, 10], []);
    expect(doc.sourceState("height:0:0:0")).toBe("absent");
    expect(doc.sampleHeight(0, 0)).toBe(-100);
    expect(() => doc.sampleHeight(10_000, 0)).toThrow(SourcesNotReadyError);
  });

  it("requires genuine confirmed absence even at coarser parent levels", () => {
    const doc = new EditorDocument("parents");
    const keys = requiredHeightSources([-20, -20, 20, 20]);
    doc.acceptSources(
      keys.filter((k) => !k.startsWith("height:21:")),
      [],
    );
    expect(doc.isReady([-20, -20, 20, 20])).toBe(false);
    doc.acceptSources(
      keys.filter((k) => k.startsWith("height:21:")),
      [],
    );
    expect(doc.isReady([-20, -20, 20, 20])).toBe(true);
    expect(requiredHeightSources([-0.1, -0.1, 0.1, 0.1], [0])).toEqual([
      "height:0:-1:-1",
      "height:0:0:-1",
      "height:0:-1:0",
      "height:0:0:0",
    ]);
  });

  it("certifies a sparse world query without allocating its empty fine tiles", () => {
    const doc = new EditorDocument("world");
    expect(() => requiredHeightSources(ALL)).toThrow(/Sparse/);
    doc.acceptCoverage(ALL, []);
    expect(doc.snapshot(ALL).tiles).toEqual([]);
    expect(doc.metrics.readyTiles).toBe(0);
    expect(doc.metrics.coverageRegions).toBe(1);
  });

  it("does not infer a missing region from the bounding box of an L-shaped query", () => {
    const doc = new EditorDocument("coverage");
    doc.acceptCoverage([-10_000, -10_000, 0, 10_000], []);
    doc.acceptCoverage([0, -10_000, 10_000, 0], []);
    expect(doc.isReady([1000, 1000, 2000, 2000])).toBe(false);
    doc.acceptCoverage([0, 0, 10_000, 10_000], []);
    expect(doc.isReady([-9000, -9000, 9000, 9000])).toBe(true);
  });

  it("keeps failed/loading sources unready and permits a complete retry", () => {
    const doc = new EditorDocument("errors");
    const keys = doc.requiredSources([-20, -20, 20, 20]);
    doc.markLoading(keys);
    expect(doc.sourceState(keys[0])).toBe("loading");
    doc.failSources(keys, "Disk read failed");
    expect(doc.sourceState(keys[0])).toBe("error");
    expect(doc.sourceError(keys[0])).toBe("Disk read failed");
    expect(doc.isReady([-20, -20, 20, 20])).toBe(false);
    doc.acceptSources(keys, []);
    expect(doc.isReady([-20, -20, 20, 20])).toBe(true);
  });

  it("rejects another session and delayed reads cannot roll back local changes", () => {
    const doc = new EditorDocument("session", { empty: true });
    stroke(doc, [[100, 100]]);
    const old = doc.snapshot(LOCAL).tiles;
    doc.acceptPersistence(1);
    stroke(doc, [[100, 100]]);
    doc.acceptPersistence(2);
    const current = doc.sampleHeight(100, 100);
    doc.acceptCoverage(LOCAL, old, 1);
    expect(doc.sampleHeight(100, 100)).toBe(current);
    expect(() => doc.acceptCoverage(LOCAL, [], 2, "other")).toThrow(/Sitzung/);
  });

  it("owns sources independently of imported, rendered and returned patch buffers", () => {
    const source = createCoastFixture();
    const doc = new EditorDocument("ownership");
    doc.acceptCoverage(COAST_FIXTURE_BOUNDS, source);
    const original = doc.sampleHeight(...TRENCH_POINT);
    source[0].values.fill(99_999);
    expect(doc.sampleHeight(...TRENCH_POINT)).toBe(original);
    const snapshot = doc.snapshot(COAST_FIXTURE_BOUNDS);
    structuredClone(snapshot, {
      transfer: snapshot.tiles.map((t) => t.values.buffer),
    });
    expect(doc.sampleHeight(...TRENCH_POINT)).toBe(original);
    const { change } = stroke(doc, [TRENCH_POINT]);
    const after = doc.sampleHeight(...TRENCH_POINT);
    for (const patch of change!.patches) patch.after?.values.fill(0);
    doc.undo();
    doc.redo();
    expect(doc.sampleHeight(...TRENCH_POINT)).toBe(after);
  });

  it("evicts only confirmed sources and never reinterprets an evicted tile as ocean", () => {
    const doc = new EditorDocument("eviction", { empty: true });
    doc.beginGesture({ level: 0, amount: 10, radius: 20 });
    doc.applyPoint([100, 100]);
    expect(doc.evictConfirmedSources()).toBe(0);
    const change = doc.finishGesture()!;
    expect(doc.evictConfirmedSources()).toBe(0);
    const sample = doc.sampleHeight(100, 100);
    doc.acceptPersistence(change.sequence);
    expect(doc.evictConfirmedSources()).toBe(1);
    expect(doc.sourceState("height:0:0:0")).toBe("unknown");
    expect(() => doc.sampleHeight(100, 100)).toThrow(SourcesNotReadyError);
    doc.acceptCoverage(
      LOCAL,
      change.patches.flatMap((p) => (p.after ? [p.after] : [])),
      change.sequence,
    );
    expect(doc.sampleHeight(100, 100)).toBe(sample);
  });

  it("evicts distant confirmed payloads while retaining local, active and pending sources", () => {
    const doc = new EditorDocument("selective-eviction", { empty: true });
    const near = stroke(doc, [[100, 100]]).change!;
    doc.acceptPersistence(near.sequence);
    const distant = stroke(doc, [[10_000, 10_000]]).change!;
    doc.acceptPersistence(distant.sequence);
    const pending = stroke(doc, [[20_000, 20_000]]).change!;
    doc.beginGesture({ level: 0, radius: 20, amount: 10 });
    doc.applyPoint([30_000, 30_000]);
    const activeHeight = doc.sampleHeight(30_000, 30_000);
    expect(doc.evictConfirmedOutside(LOCAL)).toBe(1);
    expect(doc.sampleHeight(100, 100)).toBeGreaterThan(-100);
    expect(doc.sampleHeight(20_000, 20_000)).toBeGreaterThan(-100);
    expect(doc.sampleHeight(30_000, 30_000)).toBe(activeHeight);
    expect(() => doc.sampleHeight(10_000, 10_000)).toThrow(
      SourcesNotReadyError,
    );
    doc.finishGesture();
    doc.acceptPersistence(pending.sequence);
    expect(doc.evictConfirmedOutside(LOCAL)).toBe(1);
    expect(() => doc.sampleHeight(20_000, 20_000)).toThrow(
      SourcesNotReadyError,
    );
    expect(doc.sampleHeight(30_000, 30_000)).toBe(activeHeight);
  });

  it("keeps contributing halo sources when their author footprint is outside the view", () => {
    const doc = new EditorDocument("support-eviction");
    const tiles = heightTilesFromControls(0, [[-1, 20, 12]]);
    doc.acceptCoverage(LOCAL, tiles);
    const before = doc.sampleHeight(0, 100);
    expect(before).toBeGreaterThan(-100);
    // Author tile(-1,0) ends at x=0, but its cubic field contributes inside this view.
    expect(doc.evictConfirmedOutside([0, 90, 5, 110])).toBe(0);
    expect(doc.sampleHeight(0, 100)).toBe(before);
  });

  it("keeps snapshots valid for unrelated edits and rejects newly introduced local sources", () => {
    const doc = new EditorDocument("jobs", { empty: true });
    const snapshot = doc.snapshot([-10, -10, 10, 10]);
    stroke(doc, [[10_000, 10_000]]);
    expect(doc.isSnapshotCurrent(snapshot)).toBe(true);
    stroke(doc, [[0, 0]]);
    expect(doc.isSnapshotCurrent(snapshot)).toBe(false);
  });
});

describe("local gestures, history and persistence patches", () => {
  it("accepts screen-sized height brushes at the minimum world zoom with bounded work", () => {
    const scale = 0.000002;
    for (const diameter of [80, 512]) {
      const radius = diameter / (2 * scale);
      const level = Math.max(
        0,
        Math.min(21, Math.floor(Math.log2(radius / 40))),
      );
      const doc = new EditorDocument(`world-brush-${diameter}`, {
        empty: true,
      });
      doc.beginGesture({ level, radius, amount: 100 });
      expect(doc.applyPoint([0, 0])).not.toBeNull();
      expect(doc.metrics.gestureCells).toBeLessThan(2000);
      const change = doc.finishGesture()!;
      expect(change.patches.every((p) => p.after?.level === level)).toBe(true);
      expect(doc.sampleHeight(0, 0)).toBeGreaterThan(-100);
      expect(doc.metrics.readyTiles).toBeLessThanOrEqual(4);
      doc.undo();
      expect(doc.sampleHeight(0, 0)).toBe(-100);
    }
    const tooFine = new EditorDocument("unbounded-world-brush", {
      empty: true,
    });
    expect(() =>
      tooFine.beginGesture({ level: 0, radius: 20_000_000, amount: 100 }),
    ).toThrow(/Autorenstufe/);
    expect(() =>
      tooFine.beginGesture({
        level: 21,
        radius: Number.MAX_VALUE,
        amount: 100,
      }),
    ).toThrow(/Autorenstufe/);
    expect(tooFine.active).toBe(false);
  });

  it("matches independently derived coarse-dab heights at the coast and trench", () => {
    const doc = new EditorDocument("rational-oracle");
    doc.acceptCoverage(ALL, createCoastFixture());
    // These fractions are the analytic sum of the positive cubic weights and
    // quartic brush samples for a radius-1280, level-5, amount-100 dab at (0,0).
    // They are independent expected values, not outputs of the model sampler.
    expect(doc.sampleHeight(320, 0)).toBeCloseTo(6.31005859375, 10);
    stroke(doc, [[0, 0]], 5, 100, 1280);
    expect(doc.sampleHeight(-800, 0)).toBeCloseTo(-20 + 338225 / 9216, 9);
    expect(doc.sampleHeight(-400, 0)).toBeCloseTo(735125 / 9216, 9);
    expect(doc.sampleHeight(320, 0)).toBeCloseTo(
      6.31005859375 + 99175 / 1152,
      9,
    );
    expect(doc.sampleHeight(420, 0)).toBeCloseTo(41 + 184052525 / 2359296, 9);
  });

  it("keeps fine trench authors and their relative depth during a coarse lift", () => {
    const doc = new EditorDocument("coast");
    doc.acceptCoverage(ALL, createCoastFixture());
    const before = doc.snapshot(LOCAL);
    const fine = values(before.tiles.filter((t) => t.level === 0));
    const beforeSample = prepareHeightSampler(before);
    const beforeCoarse = prepareHeightSampler(
      before.tiles.filter((t) => t.level > 0),
    );
    const { change } = stroke(doc, [[0, 0]], 4, 80, 1200);
    expect(change!.patches.every((p) => p.after?.level === 4)).toBe(true);
    const after = doc.snapshot(LOCAL);
    expect(values(after.tiles.filter((t) => t.level === 0))).toEqual(fine);
    const afterSample = prepareHeightSampler(after);
    const afterCoarse = prepareHeightSampler(
      after.tiles.filter((t) => t.level > 0),
    );
    expect(
      afterSample(...TRENCH_POINT) - afterCoarse(...TRENCH_POINT),
    ).toBeCloseTo(
      beforeSample(...TRENCH_POINT) - beforeCoarse(...TRENCH_POINT),
      10,
    );
    expect(beforeSample(-420, 0)).toBeLessThan(0);
    expect(afterSample(-420, 0)).toBeGreaterThan(0);
    doc.undo();
    expect(values(doc.snapshot(LOCAL).tiles)).toEqual(values(before.tiles));
    doc.redo();
    expect(values(doc.snapshot(LOCAL).tiles)).toEqual(values(after.tiles));
  });

  it("preserves the spatial path under event subdivision and does not deepen while held", () => {
    const a = new EditorDocument("a", { empty: true });
    const b = new EditorDocument("b", { empty: true });
    stroke(
      a,
      [
        [0, 0],
        [60, 0],
      ],
      0,
      -2,
      30,
    );
    stroke(
      b,
      [
        [0, 0],
        [10, 0],
        [20, 0],
        [35, 0],
        [60, 0],
        [60, 0],
      ],
      0,
      -2,
      30,
    );
    const av = values(a.snapshot(LOCAL).tiles),
      bv = values(b.snapshot(LOCAL).tiles);
    expect(av.map((t) => t.key)).toEqual(bv.map((t) => t.key));
    for (let k = 0; k < av.length; k++)
      for (let i = 0; i < av[k].values.length; i++)
        expect(av[k].values[i]).toBeCloseTo(bv[k].values[i], 12);
    expect(a.sequence).toBe(1);
    expect(b.sequence).toBe(1);
  });

  it("rejects unready edits before mutation and preserves a valid partial stroke on failure", () => {
    const doc = new EditorDocument("partial");
    doc.beginGesture({ level: 0, amount: 10, radius: 20 });
    expect(() => doc.applyPoint([100, 100])).toThrow(SourcesNotReadyError);
    expect(doc.metrics.gestureCells).toBe(0);
    doc.acceptCoverage(LOCAL, []);
    doc.applyPoint([100, 100]);
    const accepted = doc.sampleHeight(100, 100);
    expect(() => doc.applyPoint([50_000, 50_000])).toThrow();
    expect(doc.sampleHeight(100, 100)).toBe(accepted);
    const change = doc.finishGesture()!;
    expect(change.sequence).toBe(1);
    expect(doc.metrics.historyActions).toBe(1);
    doc.undo();
    expect(doc.sampleHeight(100, 100)).toBe(-100);
  });

  it("restores actual absence and keeps redo after a no-op", () => {
    const doc = new EditorDocument("undo", { empty: true });
    stroke(doc, [[100, 100]]);
    expect(doc.sourceState(heightTileKey(0, 0, 0))).toBe("ready");
    const undo = doc.undo()!;
    expect(undo.patches.every((p) => p.after === null)).toBe(true);
    expect(doc.sourceState(heightTileKey(0, 0, 0))).toBe("absent");
    expect(stroke(doc, [[100, 100]], 0, 0).change).toBeNull();
    expect(doc.canRedo).toBe(true);
    expect(doc.sequence).toBe(2);
    doc.redo();
    expect(doc.sampleHeight(100, 100)).toBeGreaterThan(-100);
  });

  it("reserves pending-write capacity before accepting another local change", () => {
    const doc = new EditorDocument("backlog", {
      empty: true,
      maxPendingBytes: HEIGHT_TILE_BYTES,
    });
    const first = stroke(doc, [[100, 100]]).change!;
    const original = doc.sampleHeight(100, 100);
    doc.beginGesture({ level: 0, radius: 20, amount: 10 });
    expect(() => doc.applyPoint([100, 100])).toThrow(/Arbeitskopie/);
    expect(doc.finishGesture()).toBeNull();
    expect(doc.sampleHeight(100, 100)).toBe(original);
    doc.acceptPersistence(first.sequence);
    expect(stroke(doc, [[100, 100]]).change).not.toBeNull();
    expect(doc.metrics.pendingBytes).toBe(HEIGHT_TILE_BYTES);
  });

  it("returns only changed authors and continues the reopened store sequence", () => {
    const doc = new EditorDocument("reopened", { sequence: 7 });
    const fixture = createCoastFixture();
    doc.acceptCoverage(ALL, fixture, 7);
    const first = stroke(doc, [[320, 0]], 0, -5).change!;
    expect(first.sequence).toBe(8);
    expect(first.transactionId).toBe("reopened:8");
    expect(first.patches.length).toBeLessThan(fixture.length);
    expect(first.patches.every((p) => p.after?.level === 0)).toBe(true);
    const stored = new Map(fixture.map((t) => [t.key, heightTileToRecord(t)]));
    for (const patch of first.patches)
      if (patch.after) stored.set(patch.key, heightTileToRecord(patch.after));
      else stored.delete(patch.key);
    const restored = new EditorDocument("new-session", { sequence: 8 });
    restored.acceptCoverage(
      ALL,
      [...stored.values()].map(heightTileFromRecord),
      8,
    );
    expect(restored.sampleHeight(...TRENCH_POINT)).toBe(
      doc.sampleHeight(...TRENCH_POINT),
    );
  });

  it("rejects malformed and excessive inputs without changing authors", () => {
    const doc = new EditorDocument("invalid", {
      empty: true,
      maxSourceBytes: HEIGHT_TILE_BYTES,
    });
    expect(() =>
      doc.beginGesture({ level: 22, radius: 10, amount: 1 }),
    ).toThrow();
    expect(() =>
      doc.beginGesture({ level: 0, radius: Number.NaN, amount: 1 }),
    ).toThrow();
    doc.beginGesture({ level: 0, radius: 20, amount: 1 });
    expect(() => doc.applyPoint([Number.POSITIVE_INFINITY, 0])).toThrow();
    expect(() => doc.applyPoint([0, 0])).toThrow(/Speicherbudget/);
    expect(doc.finishGesture()).toBeNull();
    expect(doc.sequence).toBe(0);
    expect(doc.metrics.readyTiles).toBe(0);
  });
});

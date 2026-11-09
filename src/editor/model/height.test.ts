import { describe, expect, it } from "vitest";
import {
  COAST_FIXTURE_BOUNDS,
  EditorDocument,
  HEIGHT_MAX_ACTION_TILES,
  HEIGHT_TILE_BYTES,
  SourcesNotReadyError,
  TRENCH_POINT,
  WORLD_LIMIT,
  createCoastFixture,
  cloneHeightTile,
  heightBrushReadBounds,
  heightControlAddress,
  heightTileKey,
  heightTilesFromControls,
  prepareHeightSampler,
  quarticBrushSegmentIntegral,
  quarticBrushSegmentMean,
  requiredHeightSources,
  splineWeights,
  validateHeightTile,
  type Bounds,
  type HeightTile,
  type Point,
} from "./index";

const ALL: Bounds = [-WORLD_LIMIT, -WORLD_LIMIT, WORLD_LIMIT, WORLD_LIMIT];
const LOCAL: Bounds = [-1000, -1000, 1000, 1000];

describe("atomic timed height paths", () => {
  it("matches sequential geometry while publishing one revision and one history action", () => {
    const path = [
      { from: [0, 0] as Point, to: [0, 80] as Point, elapsedMs: 8 },
      { from: [0, 80] as Point, to: [80, 0] as Point, elapsedMs: 8 },
      { from: [80, 0] as Point, to: [80, 0] as Point, elapsedMs: 16 },
    ];
    const atomic = new EditorDocument("atomic", { empty: true });
    const sequential = new EditorDocument("sequential", { empty: true });
    for (const doc of [atomic, sequential])
      doc.beginGesture({ level: 0, radius: 20, amount: 400 });
    for (const segment of path)
      sequential.applySegment(segment.from, segment.to, segment.elapsedMs);
    const update = atomic.applySegments(path)!;
    expect(atomic.revision).toBe(1);
    expect(update.patches.length).toBeGreaterThan(0);
    expect(values(atomic.snapshot(LOCAL).tiles)).toEqual(
      values(sequential.snapshot(LOCAL).tiles),
    );
    atomic.finishGesture();
    expect(atomic.metrics.historyActions).toBe(1);
    atomic.undo();
    expect(atomic.sampleHeight(0, 80)).toBe(-100);
  });

  it("rejects a missing later corner before any earlier segment can mutate", () => {
    const doc = new EditorDocument("partial-path");
    doc.acceptCoverage([-100, -100, 100, 100], []);
    doc.beginGesture({ level: 0, radius: 20, amount: 400 });
    expect(() =>
      doc.applySegments([
        { from: [0, 0], to: [40, 0], elapsedMs: 8 },
        { from: [40, 0], to: [40, 2000], elapsedMs: 8 },
      ]),
    ).toThrow(SourcesNotReadyError);
    expect(doc.revision).toBe(0);
    expect(doc.sampleHeight(0, 0)).toBe(-100);
    expect(doc.finishGesture()).toBeNull();
  });

  it("rejects the combined cell budget before any segment can mutate", () => {
    const doc = new EditorDocument("path-budget", {
      empty: true,
      maxGestureCells: 1,
    });
    doc.beginGesture({ level: 0, radius: 3, amount: 400 });
    expect(() =>
      doc.applySegments([
        { from: [0, 0], to: [0, 0], elapsedMs: 8 },
        { from: [100, 0], to: [100, 0], elapsedMs: 8 },
      ]),
    ).toThrow(/Höhenpunkte/);
    expect(doc.revision).toBe(0);
    expect(doc.sampleHeight(0, 0)).toBe(-100);
    expect(doc.finishGesture()).toBeNull();
  });
});

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
  const bounds = points.map(
    (to, index) =>
      doc.applySegment(points[index - 1] ?? to, to, 1000)?.bounds ?? null,
  );
  const change = doc.finishGesture();
  return { change, bounds };
}

function values(tiles: HeightTile[]) {
  return [...tiles]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ key, values }) => ({ key, values: Array.from(values) }));
}

// Raw-author assertions need no product API that bypasses regional readiness.
function author(doc: EditorDocument, key: string): HeightTile | undefined {
  const tile = doc["entries"].get(key)?.tile;
  return tile && cloneHeightTile(tile);
}

function control(doc: EditorDocument, x: number, y: number, level = 0) {
  const { key, index } = heightControlAddress(level, x, y);
  return author(doc, key)?.values[index] ?? 0;
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

  it("validates owned typed sources without clipping relative values", () => {
    const tile = constant(0, 150_000)[0];
    expect(() => validateHeightTile(tile)).not.toThrow();
    expect(() =>
      validateHeightTile({ ...tile, values: new Float64Array(1) }),
    ).toThrow();
    const bad = { ...tile, values: tile.values.slice() };
    bad.values[0] = Number.POSITIVE_INFINITY;
    expect(() => validateHeightTile(bad)).toThrow();
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

  it("does not infer finer absence from a confirmed parent-only region", () => {
    const doc = new EditorDocument("parents");
    doc.acceptCoverage(LOCAL, [], 0, doc.sessionId, 21);
    expect(doc.sourceState(heightTileKey(21, 0, 0))).toBe("absent");
    expect(doc.sourceState(heightTileKey(20, 0, 0))).toBe("unknown");
    expect(doc.isReady([-20, -20, 20, 20])).toBe(false);
    doc.acceptCoverage(LOCAL, []);
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

  it("keeps unknown data unready until a complete read proves absence", () => {
    const doc = new EditorDocument("read-retry");
    const keys = requiredHeightSources([-20, -20, 20, 20]);
    expect(doc.sourceState(keys[0])).toBe("unknown");
    expect(doc.isReady([-20, -20, 20, 20])).toBe(false);
    doc.acceptCoverage([-20, -20, 20, 20], []);
    expect(doc.sourceState(keys[0])).toBe("absent");
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

  it("owns mutable sources independently of imports, render snapshots and accepted records", () => {
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
    const acceptedValues = change!.patches.map((patch) =>
      patch.after?.values.slice(),
    );
    doc.undo();
    doc.redo();
    expect(doc.sampleHeight(...TRENCH_POINT)).toBe(after);
    stroke(doc, [TRENCH_POINT]);
    expect(change!.patches.map((patch) => patch.after?.values)).toEqual(
      acceptedValues,
    );
    doc.undo();
    expect(doc.sampleHeight(...TRENCH_POINT)).toBe(after);
  });

  it("shares one immutable accepted record for history, retry and projection", () => {
    const doc = new EditorDocument("accepted-journal", { empty: true });
    const change = stroke(doc, [[100, 100]]).change!;
    const expected = doc.sampleHeight(100, 100);
    const retained = doc.pendingChanges()[0];
    expect(doc.pendingChanges()[0]).toBe(retained);
    expect(retained).toBe(change);
    expect(Object.isFrozen(retained)).toBe(true);
    expect(Object.isFrozen(retained.patches)).toBe(true);
    expect(() =>
      doc.acknowledge({
        sessionId: doc.sessionId,
        sequence: change.sequence,
        transactionId: "wrong",
      }),
    ).toThrow(/Speicherbestätigung/);
    expect(doc.pendingChanges()).toHaveLength(1);
    doc.acknowledge(retained);
    expect(doc.pendingChanges()).toEqual([]);
    expect(doc.presentationPatchesAfter(doc.sequence)).toEqual([]);
    expect(doc.metrics.pendingBytes).toBe(0);
    doc.undo();
    doc.redo();
    expect(doc.sampleHeight(100, 100)).toBe(expected);
  });

  it("evicts only confirmed sources and never reinterprets an evicted tile as ocean", () => {
    const doc = new EditorDocument("eviction", { empty: true });
    doc.beginGesture({ level: 0, amount: 10, radius: 20 });
    doc.applySegment([100, 100], [100, 100], 1000);
    const sample = doc.sampleHeight(100, 100);
    expect(doc.retainSources([])).toEqual([]);
    expect(control(doc, 20, 20)).toBe(10);
    const change = doc.finishGesture()!;
    expect(doc.retainSources([])).toEqual([]);
    expect(control(doc, 20, 20)).toBe(10);
    doc.acceptPersistence(change.sequence);
    expect(doc.retainSources([])).toEqual(["height:0:0:0"]);
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
    doc.applySegment([30_000, 30_000], [30_000, 30_000], 1000);
    const activeControl = control(doc, 6000, 6000);
    expect(doc.retainSources([{ bounds: LOCAL, minLevel: 0 }])).toHaveLength(1);
    expect(doc.sampleHeight(100, 100)).toBeGreaterThan(-100);
    // Full remote readiness may be forgotten; accepted authors stay available.
    expect(control(doc, 4000, 4000)).toBeGreaterThan(0);
    expect(control(doc, 6000, 6000)).toBe(activeControl);
    expect(() => doc.sampleHeight(10_000, 10_000)).toThrow(
      SourcesNotReadyError,
    );
    doc.finishGesture();
    doc.acceptPersistence(pending.sequence);
    expect(doc.retainSources([{ bounds: LOCAL, minLevel: 0 }])).toHaveLength(1);
    expect(() => doc.sampleHeight(20_000, 20_000)).toThrow(
      SourcesNotReadyError,
    );
    expect(control(doc, 6000, 6000)).toBe(activeControl);
  });

  it("keeps contributing halo sources when their author footprint is outside the view", () => {
    const doc = new EditorDocument("support-eviction");
    const tiles = heightTilesFromControls(0, [[-1, 20, 12]]);
    doc.acceptCoverage(LOCAL, tiles);
    const before = doc.sampleHeight(0, 100);
    expect(before).toBeGreaterThan(-100);
    // Author tile(-1,0) ends at x=0, but its cubic field contributes inside this view.
    expect(
      doc.retainSources([{ bounds: [0, 90, 5, 110], minLevel: 0 }]),
    ).toEqual([]);
    expect(doc.sampleHeight(0, 100)).toBe(before);
  });
});

describe("bounded resident sources and their readiness proofs", () => {
  it("keeps the same active metadata after visiting 128, 1024 and 5120 populated sources", () => {
    const doc = new EditorDocument("travel", {
      maxSourceBytes: 128 * HEIGHT_TILE_BYTES,
    });
    const region = (batch: number): Bounds => {
      const first = batch * 136;
      return [first * 320 - 10, -10, (first + 128) * 320 + 10, 330];
    };
    const sources = (batch: number) =>
      heightTilesFromControls(
        0,
        Array.from({ length: 128 }, (_, offset): [number, number, number] => [
          (batch * 136 + offset) * 64 + 20,
          20,
          10,
        ]),
      );
    const checkpoints: number[] = [];
    for (let batch = 0; batch < 40; batch++) {
      const bounds = region(batch);
      doc.retainSources([{ bounds, minLevel: 0 }]);
      doc.acceptCoverage(bounds, sources(batch));
      expect(doc.isReady(bounds)).toBe(true);
      if ([0, 7, 39].includes(batch)) {
        checkpoints.push(doc.metrics.sourceEntries);
        expect(doc.metrics.sourceBytes).toBe(128 * HEIGHT_TILE_BYTES);
        expect(doc.metrics.coverageRegions).toBe(1);
      }
    }
    expect(checkpoints).toEqual([128, 128, 128]);
    expect(doc.sourceState(heightTileKey(0, 0, 0))).toBe("unknown");
    expect(() => doc.sampleHeight(100, 100)).toThrow(SourcesNotReadyError);
    doc.retainSources([{ bounds: region(0), minLevel: 0 }]);
    doc.acceptCoverage(region(0), sources(0));
    expect(doc.sampleHeight(100, 100)).toBeCloseTo(-100 + (10 * 4) / 9, 12);
    expect(doc.metrics.sourceEntries).toBe(128);
  });

  it("releases fine sources inside a world view while retaining the exact current tool halo", () => {
    const fine = heightTilesFromControls(0, [
      [20, 20, 10],
      [2020, 20, 20],
    ]);
    const coarse = heightTilesFromControls(8, [[0, 0, 200]]);
    const doc = new EditorDocument("level-retention");
    doc.acceptCoverage(ALL, [...fine, ...coarse]);
    expect(doc.retainSources([{ bounds: ALL, minLevel: 8 }])).toEqual(
      fine.map((tile) => tile.key),
    );
    expect(doc.sourceState(fine[0].key)).toBe("unknown");
    expect(doc.isReady(LOCAL, [8, 9, 21])).toBe(true);
    expect(doc.isReady(LOCAL)).toBe(false);
    doc.retainSources([
      { bounds: ALL, minLevel: 8 },
      { bounds: LOCAL, minLevel: 0 },
    ]);
    doc.acceptCoverage(LOCAL, [fine[0], ...coarse]);
    expect(doc.isReady(LOCAL)).toBe(true);
    expect(doc.sourceState(fine[1].key)).toBe("unknown");
    expect(doc.metrics.sourceEntries).toBe(2);
    doc.retainSources([{ bounds: ALL, minLevel: 8 }]);
    expect(doc.sourceState(fine[0].key)).toBe("unknown");
    expect(doc.snapshot(LOCAL, [8]).tiles).toHaveLength(1);
  });

  it("never fills the gap between retained regions with the initial empty-world proof", () => {
    const doc = new EditorDocument("empty-retention", { empty: true });
    const far: Bounds = [9000, 9000, 11_000, 11_000];
    doc.retainSources([
      { bounds: LOCAL, minLevel: 0 },
      { bounds: far, minLevel: 0 },
    ]);
    expect(doc.sampleHeight(100, 100)).toBe(-100);
    expect(doc.sampleHeight(10_000, 10_000)).toBe(-100);
    expect(() => doc.sampleHeight(5000, 5000)).toThrow(SourcesNotReadyError);
    expect(doc.metrics.sourceEntries).toBe(0);
    expect(doc.metrics.coverageRegions).toBe(2);
  });

  it("releases confirmed deletion markers without resurrecting authors or absence from old reads", () => {
    const doc = new EditorDocument("deletion-read-floor", { empty: true });
    const initial = stroke(doc, [[100, 100]]).change!;
    const original = doc.sampleHeight(100, 100);
    const authors = initial.patches.flatMap((patch) =>
      patch.after ? [patch.after] : [],
    );
    const key = authors[0].key;
    doc.acceptPersistence(initial.sequence);
    doc.retainSources([]);
    expect(doc.sourceState(key)).toBe("unknown");
    expect(doc.metrics.sourceEntries).toBe(0);
    const deletion = doc.undo()!;
    doc.retainSources([]);
    expect(doc.sourceState(key)).toBe("absent");
    expect(doc.metrics.sourceEntries).toBe(1);
    doc.acceptCoverage(LOCAL, authors, initial.sequence);
    expect(doc.sampleHeight(100, 100)).toBe(-100);
    doc.acceptPersistence(deletion.sequence);
    expect(doc.metrics.sourceEntries).toBe(0);
    doc.retainSources([]);
    const beforeOldAuthorRead = { ...doc.metrics, generation: doc.generation };
    doc.acceptCoverage(LOCAL, authors, initial.sequence);
    expect({ ...doc.metrics, generation: doc.generation }).toEqual(
      beforeOldAuthorRead,
    );
    expect(doc.sourceState(key)).toBe("unknown");

    const restored = doc.redo()!;
    doc.acceptCoverage(LOCAL, [], deletion.sequence);
    expect(doc.sampleHeight(100, 100)).toBe(original);
    doc.acceptPersistence(restored.sequence);
    doc.retainSources([]);
    doc.acceptCoverage(LOCAL, [], deletion.sequence);
    expect(doc.sourceState(key)).toBe("unknown");
    expect(() => doc.sampleHeight(100, 100)).toThrow(SourcesNotReadyError);
    doc.acceptCoverage(
      LOCAL,
      restored.patches.flatMap((patch) => (patch.after ? [patch.after] : [])),
      restored.sequence,
    );
    expect(doc.sampleHeight(100, 100)).toBe(original);
    expect(doc.metrics.sourceEntries).toBe(1);
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
      expect(doc.applySegment([0, 0], [0, 0], 1000)).not.toBeNull();
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

  it("preserves a time-parametrized path under event subdivision", () => {
    const a = new EditorDocument("a", { empty: true });
    const b = new EditorDocument("b", { empty: true });
    for (const doc of [a, b])
      doc.beginGesture({ level: 0, amount: -2, radius: 30 });
    a.applySegment([0, 0], [60, 0], 1000);
    let previous = 0;
    for (const x of [10, 20, 35, 60]) {
      b.applySegment([previous, 0], [x, 0], ((x - previous) / 60) * 1000);
      previous = x;
    }
    a.finishGesture();
    b.finishGesture();
    const av = values(a.snapshot(LOCAL).tiles),
      bv = values(b.snapshot(LOCAL).tiles);
    expect(av.map((t) => t.key)).toEqual(bv.map((t) => t.key));
    for (let k = 0; k < av.length; k++)
      for (let i = 0; i < av[k].values.length; i++)
        expect(av[k].values[i]).toBeCloseTo(bv[k].values[i], 12);
    expect(a.sequence).toBe(1);
    expect(b.sequence).toBe(1);
  });

  it("integrates the quartic kernel analytically without a hidden initial pulse", () => {
    const doc = new EditorDocument("integral-oracle", { empty: true });
    doc.beginGesture({ level: 0, radius: 30, amount: -2 });
    expect(doc.metrics.readyTiles).toBe(0);
    doc.applySegment([-30, 0], [30, 0], 1000);
    // Integral from -r to r is 16r/15. Averaged over length 2r, a
    // one-second rate -2 gives -16/15, with no separate click contribution.
    expect(control(doc, 0, 0)).toBeCloseTo(-16 / 15, 12);
    expect(control(doc, 0, 3)).toBeCloseTo((-16 / 15) * (3 / 4) ** 2.5, 12);
    expect(control(doc, -6, 0)).toBeCloseTo(-8 / 15, 12);
    const tiny = quarticBrushSegmentIntegral(-15, 0, 1e-8, 30);
    // At u=1/2 the kernel is 9/16; over this tiny interval its change is <1e-9.
    expect(Math.abs(tiny / 1e-8 - 9 / 16)).toBeLessThan(1e-9);
  });

  it.each([
    {
      name: "interior",
      along: 0.2,
      perpendicular: 0.3,
      length: 0.4,
      lower: -0.2,
      upper: 0.2,
      radius: 1,
    },
    {
      name: "support endpoint",
      along: 0,
      perpendicular: 0,
      length: 1,
      lower: 0,
      upper: 1,
      radius: 1,
    },
    {
      name: "beyond support endpoint",
      along: 0,
      perpendicular: 0,
      length: 1 + 1e-9,
      lower: 0,
      upper: 1,
      radius: 1,
    },
    {
      name: "both support endpoints",
      along: 0.6,
      perpendicular: 0.8,
      length: 1.2,
      lower: -0.6,
      upper: 0.6,
      radius: 1,
    },
    {
      name: "world-length clipped segment",
      along: WORLD_LIMIT,
      perpendicular: 0.6,
      length: 2 * WORLD_LIMIT,
      lower: -0.8,
      upper: 0.8,
      radius: 1,
    },
    {
      name: "subnormal radius with an infinite reciprocal",
      along: 0.25,
      perpendicular: 0,
      length: 0.5,
      lower: -0.25,
      upper: 0.25,
      radius: Number.MIN_VALUE * 4096,
    },
  ])(
    "matches independent Gaussian integration for $name",
    ({ along, perpendicular, length, lower, upper, radius }) => {
      // These support intervals are fixed by each fixture's geometry. Three
      // Gaussian samples integrate the quartic exactly, independently of the
      // production midpoint polynomial and clipping implementation.
      const midpoint = (lower + upper) / 2;
      const half = (upper - lower) / 2;
      const node = Math.sqrt(3 / 5) * half;
      const kernel = (u: number) =>
        Math.max(0, 1 - u * u - perpendicular * perpendicular) ** 2;
      const normalizedIntegral =
        half *
        ((5 / 9) * kernel(midpoint - node) +
          (8 / 9) * kernel(midpoint) +
          (5 / 9) * kernel(midpoint + node));
      const expectedMean = normalizedIntegral / length;
      const expectedIntegral = normalizedIntegral * radius;
      const args = [
        along * radius,
        perpendicular * radius,
        length * radius,
        radius,
      ] as const;
      const mean = quarticBrushSegmentMean(...args);
      const integral = quarticBrushSegmentIntegral(...args);
      expect(Math.abs(mean - expectedMean)).toBeLessThan(5e-14 * expectedMean);
      expect(integral).toBeGreaterThan(0);
      expect(Math.abs(integral - expectedIntegral)).toBeLessThanOrEqual(
        Math.max(2 * Number.MIN_VALUE, 5e-14 * expectedIntegral),
      );
    },
  );

  it("deepens during stationary holding at the configured rate and undoes one whole stroke", () => {
    const doc = new EditorDocument("stationary-rate", { empty: true });
    doc.beginGesture({ level: 0, radius: 20, amount: 20 });
    expect(doc.applySegment([100, 100], [100, 100], 0)).toBeNull();
    expect(doc.revision).toBe(0);
    for (let interval = 0; interval < 12; interval++) {
      expect(doc.applySegment([100, 100], [100, 100], 250)).not.toBeNull();
      expect(control(doc, 20, 20)).toBe((interval + 1) * 5);
    }
    expect(control(doc, 21, 20)).toBeCloseTo(60 * (15 / 16) ** 2, 12);
    const revision = doc.revision;
    expect(doc.applySegment([100, 100], [100, 100], 0)).toBeNull();
    expect(doc.revision).toBe(revision);
    // Long elapsed intervals have no artificial duration cap.
    doc.applySegment([100, 100], [100, 100], 120_000);
    expect(control(doc, 20, 20)).toBe(2460);
    const after = values(doc.snapshot(LOCAL).tiles);
    const change = doc.finishGesture()!;
    expect(change.sequence).toBe(1);
    expect(doc.metrics.historyActions).toBe(1);
    doc.undo();
    expect(control(doc, 20, 20)).toBe(0);
    doc.redo();
    expect(values(doc.snapshot(LOCAL).tiles)).toEqual(after);

    const click = new EditorDocument("short-click", { empty: true });
    click.beginGesture({ level: 0, radius: 20, amount: 20 });
    click.applySegment([100, 100], [100, 100], 5);
    expect(control(click, 20, 20)).toBeCloseTo(0.1, 14);
  });

  it("keeps explicit segments separate and zero-duration intervals neutral within one undo action", () => {
    const doc = new EditorDocument("explicit-segments", { empty: true });
    doc.beginGesture({ level: 0, radius: 20, amount: 10 });
    doc.applySegment([100, 100], [100, 100], 1000);
    const before = { metrics: doc.metrics, revision: doc.revision };
    expect(doc.applySegment([100, 100], [1000, 100], 0)).toBeNull();
    expect({ metrics: doc.metrics, revision: doc.revision }).toEqual(before);
    doc.applySegment([200, 100], [200, 100], 1000);
    expect(control(doc, 20, 20)).toBe(10);
    expect(control(doc, 40, 20)).toBe(10);
    expect(control(doc, 30, 20)).toBe(0);
    expect(control(doc, 100, 20)).toBe(0);
    doc.finishGesture();
    expect(doc.metrics.historyActions).toBe(1);
    doc.undo();
    expect(doc.sampleHeight(100, 100)).toBe(-100);
    expect(doc.sampleHeight(200, 100)).toBe(-100);
  });

  it("makes slower travel proportionally stronger and updates every short interval", () => {
    const fast = new EditorDocument("fast", { empty: true });
    const slow = new EditorDocument("slow", { empty: true });
    const divided = new EditorDocument("short-intervals", { empty: true });
    const brush = { level: 3, radius: 512, amount: 40 };
    for (const doc of [fast, slow, divided]) doc.beginGesture(brush);
    fast.applySegment([-1000, -300], [-160, -300], 960);
    slow.applySegment([-1000, -300], [-160, -300], 1920);
    for (let i = 1; i <= 40; i++)
      expect(
        divided.applySegment(
          [-1000 + 21 * (i - 1), -300],
          [-1000 + 21 * i, -300],
          24,
        ),
      ).not.toBeNull();
    expect(divided.revision).toBe(40);
    const area: Bounds = [-2000, -1500, 1000, 1000];
    const baseline = values(fast.snapshot(area).tiles);
    const twice = values(slow.snapshot(area).tiles);
    const split = values(divided.snapshot(area).tiles);
    expect(twice.map((tile) => tile.key)).toEqual(
      baseline.map((tile) => tile.key),
    );
    expect(split.map((tile) => tile.key)).toEqual(
      baseline.map((tile) => tile.key),
    );
    for (let tile = 0; tile < baseline.length; tile++)
      for (let index = 0; index < baseline[tile].values.length; index++) {
        expect(twice[tile].values[index]).toBeCloseTo(
          baseline[tile].values[index] * 2,
          11,
        );
        expect(split[tile].values[index]).toBeCloseTo(
          baseline[tile].values[index],
          11,
        );
      }
  });

  it("requires the whole segment and halo across a gap between ready endpoints", () => {
    const doc = new EditorDocument("segment-readiness");
    const brush = { level: 0, radius: 20, amount: 10 };
    doc.acceptCoverage([-50, -50, 50, 50], []);
    doc.acceptCoverage([950, -50, 1050, 50], []);
    doc.beginGesture(brush);
    doc.applySegment([0, 0], [0, 0], 100);
    const needed = heightBrushReadBounds(brush, [0, 0], [1000, 0]);
    expect(needed).toEqual([-30, -30, 1030, 30]);
    expect(doc.isReady([970, -30, 1030, 30])).toBe(true);
    const before = { metrics: doc.metrics, revision: doc.revision };
    expect(() => doc.applySegment([0, 0], [1000, 0], 1000)).toThrow(
      SourcesNotReadyError,
    );
    expect({ metrics: doc.metrics, revision: doc.revision }).toEqual(before);
    doc.acceptCoverage(needed, []);
    doc.applySegment([0, 0], [1000, 0], 1000);

    const uninterrupted = new EditorDocument("known-segment", { empty: true });
    uninterrupted.beginGesture(brush);
    uninterrupted.applySegment([0, 0], [0, 0], 100);
    uninterrupted.applySegment([0, 0], [1000, 0], 1000);
    expect(values(doc.snapshot(needed).tiles)).toEqual(
      values(uninterrupted.snapshot(needed).tiles),
    );
  });

  it("keeps timed negative strokes and subdivision exact at both world edges", () => {
    for (const sign of [-1, 1]) {
      const doc = new EditorDocument(`edge-${sign}`, { empty: true });
      const divided = new EditorDocument(`edge-split-${sign}`, { empty: true });
      const from: Point = [
        sign * (WORLD_LIMIT - 40),
        sign * (WORLD_LIMIT - 20),
      ];
      const to: Point = [sign * WORLD_LIMIT, sign * WORLD_LIMIT];
      const brush = { level: 0, radius: 30, amount: -2 };
      for (const target of [doc, divided]) target.beginGesture(brush);
      const bounds = heightBrushReadBounds(brush, from, to);
      expect(bounds.every((value) => Math.abs(value) <= WORLD_LIMIT)).toBe(
        true,
      );
      doc.applySegment(from, to, 1000);
      for (let i = 1; i <= 10; i++)
        divided.applySegment(
          [
            from[0] + ((to[0] - from[0]) * (i - 1)) / 10,
            from[1] + ((to[1] - from[1]) * (i - 1)) / 10,
          ],
          [
            from[0] + ((to[0] - from[0]) * i) / 10,
            from[1] + ((to[1] - from[1]) * i) / 10,
          ],
          100,
        );
      expect(control(doc, to[0] / 5, to[1] / 5)).toBeCloseTo(
        -32 / Math.hypot(40, 20),
        12,
      );
      const whole = values(doc.snapshot(bounds).tiles);
      const split = values(divided.snapshot(bounds).tiles);
      expect(split.map((tile) => tile.key)).toEqual(
        whole.map((tile) => tile.key),
      );
      for (let tile = 0; tile < whole.length; tile++)
        for (let index = 0; index < whole[tile].values.length; index++)
          expect(split[tile].values[index]).toBeCloseTo(
            whole[tile].values[index],
            11,
          );
      doc.finishGesture();
      doc.undo();
      expect(doc.sampleHeight(...to)).toBe(-100);
      doc.redo();
      expect(values(doc.snapshot(bounds).tiles)).toEqual(whole);
    }
  });

  it("rejects invalid time and oversized intervals before changing an accepted prefix", () => {
    const doc = new EditorDocument("timed-budget", {
      empty: true,
      maxGestureCells: 100,
    });
    const brush = { level: 0, radius: 20, amount: 10 };
    doc.beginGesture(brush);
    doc.applySegment([0, 0], [0, 0], 100);
    const before = {
      metrics: doc.metrics,
      revision: doc.revision,
      height: doc.sampleHeight(0, 0),
    };
    for (const duration of [-1, NaN, Infinity])
      expect(() => doc.applySegment([0, 0], [10, 0], duration)).toThrow(
        /Pinselzeit/,
      );
    expect(() => doc.applySegment([0, 0], [1000, 0], 1000)).toThrow(
      /Höhenpunkte/,
    );
    expect({
      metrics: doc.metrics,
      revision: doc.revision,
      height: doc.sampleHeight(0, 0),
    }).toEqual(before);
    expect(heightBrushReadBounds(brush, [0, 0], [1000, 0])).toEqual([
      -30, -30, 1030, 30,
    ]);
    expect(doc.finishGesture()).not.toBeNull();
    doc.undo();
    expect(doc.sampleHeight(0, 0)).toBe(-100);
  });

  it("rejects unready edits before mutation and preserves a valid partial stroke on failure", () => {
    const doc = new EditorDocument("partial");
    doc.beginGesture({ level: 0, amount: 10, radius: 20 });
    expect(() => doc.applySegment([100, 100], [100, 100], 1000)).toThrow(
      SourcesNotReadyError,
    );
    expect(doc.metrics.gestureCells).toBe(0);
    doc.acceptCoverage(LOCAL, []);
    doc.applySegment([100, 100], [100, 100], 1000);
    const accepted = doc.sampleHeight(100, 100);
    expect(() =>
      doc.applySegment([100, 100], [50_000, 50_000], 1000),
    ).toThrow();
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

  it("reserves retained patch capacity before accepting another local change", () => {
    const doc = new EditorDocument("backlog", {
      empty: true,
      maxPendingBytes: HEIGHT_TILE_BYTES * 2,
    });
    const first = stroke(doc, [[100, 100]]).change!;
    const original = doc.sampleHeight(100, 100);
    doc.beginGesture({ level: 0, radius: 20, amount: 10 });
    expect(() => doc.applySegment([100, 100], [100, 100], 1000)).toThrow(
      /Arbeitskopie/,
    );
    expect(doc.finishGesture()).toBeNull();
    expect(doc.sampleHeight(100, 100)).toBe(original);
    doc.acceptPersistence(first.sequence);
    expect(stroke(doc, [[100, 100]]).change).not.toBeNull();
    expect(doc.metrics.pendingBytes).toBe(HEIGHT_TILE_BYTES * 2);
  });

  it("budgets deleted authors retained for projection and releases them only after ACK", () => {
    const doc = new EditorDocument("deletion-backlog", {
      maxPendingBytes: HEIGHT_TILE_BYTES,
    });
    doc.acceptCoverage(
      ALL,
      heightTilesFromControls(0, [
        [20, 20, 10],
        [84, 20, 10],
      ]),
    );
    doc.beginGesture({ level: 0, radius: 1, amount: -10 });
    doc.applySegment([100, 100], [100, 100], 1000);
    const live = doc.presentationPatchesAfter(0);
    expect(live).toHaveLength(1);
    expect(live[0].before?.values.byteLength).toBe(HEIGHT_TILE_BYTES);
    expect(live[0].after).toBeNull();
    const acceptedDeletion = { metrics: doc.metrics, revision: doc.revision };
    // Continuing onto a zero neighbour would retain a nonempty after as well.
    expect(() => doc.applySegment([100, 100], [105, 100], 1000)).toThrow(
      /Arbeitskopie/,
    );
    expect({ metrics: doc.metrics, revision: doc.revision }).toEqual(
      acceptedDeletion,
    );
    const first = doc.finishGesture()!;
    expect(first.patches[0].after).toBeNull();
    expect(doc.metrics.pendingBytes).toBe(HEIGHT_TILE_BYTES);

    const before = { metrics: doc.metrics, revision: doc.revision };
    const unchanged = doc.sampleHeight(420, 100);
    doc.beginGesture({ level: 0, radius: 1, amount: -10 });
    expect(() => doc.applySegment([420, 100], [420, 100], 1000)).toThrow(
      /Arbeitskopie/,
    );
    expect(doc.finishGesture()).toBeNull();
    expect({ metrics: doc.metrics, revision: doc.revision }).toEqual(before);
    expect(doc.sampleHeight(420, 100)).toBe(unchanged);

    doc.acceptPersistence(first.sequence);
    expect(doc.metrics.pendingBytes).toBe(0);
    const second = stroke(doc, [[420, 100]], 0, -10, 1).change!;
    expect(second.patches[0].after).toBeNull();
    expect(doc.metrics.pendingBytes).toBe(HEIGHT_TILE_BYTES);
    const pending = doc.presentationPatchesAfter(first.sequence);
    expect(pending).toHaveLength(1);
    expect(pending[0].before?.values.byteLength).toBe(HEIGHT_TILE_BYTES);
    expect(pending[0].after).toBeNull();
    doc.acceptPersistence(second.sequence);
    expect(doc.metrics.pendingBytes).toBe(0);
  });

  it("counts both versions of an existing author before mutation, Undo and Redo", () => {
    const source = heightTilesFromControls(0, [[20, 20, 10]]);
    const tooSmall = new EditorDocument("one-payload-budget", {
      maxPendingBytes: HEIGHT_TILE_BYTES,
    });
    tooSmall.acceptCoverage(ALL, source);
    const original = tooSmall.sampleHeight(100, 100);
    tooSmall.beginGesture({ level: 0, radius: 1, amount: 5 });
    expect(() => tooSmall.applySegment([100, 100], [100, 100], 1000)).toThrow(
      /Arbeitskopie/,
    );
    expect(tooSmall.finishGesture()).toBeNull();
    expect(tooSmall.sampleHeight(100, 100)).toBe(original);
    expect(tooSmall.metrics.historyActions).toBe(0);

    const doc = new EditorDocument("two-payload-budget", {
      maxPendingBytes: HEIGHT_TILE_BYTES * 2,
    });
    doc.acceptCoverage(ALL, source);
    const changed = stroke(doc, [[100, 100]], 0, 5, 1).change!;
    const raised = doc.sampleHeight(100, 100);
    expect(doc.metrics.pendingBytes).toBe(HEIGHT_TILE_BYTES * 2);
    const state = () => ({
      metrics: doc.metrics,
      revision: doc.revision,
      sequence: doc.sequence,
      canUndo: doc.canUndo,
      canRedo: doc.canRedo,
      height: doc.sampleHeight(100, 100),
    });
    const beforeUndo = state();
    expect(() => doc.undo()).toThrow(/Arbeitskopie/);
    expect(state()).toEqual(beforeUndo);
    doc.acceptPersistence(changed.sequence);
    const undone = doc.undo()!;
    expect(doc.sampleHeight(100, 100)).toBe(original);
    expect(doc.metrics.pendingBytes).toBe(HEIGHT_TILE_BYTES * 2);
    const beforeRedo = state();
    expect(() => doc.redo()).toThrow(/Arbeitskopie/);
    expect(state()).toEqual(beforeRedo);
    doc.acceptPersistence(undone.sequence);
    doc.redo();
    expect(doc.sampleHeight(100, 100)).toBe(raised);
    expect(doc.metrics.pendingBytes).toBe(HEIGHT_TILE_BYTES * 2);
  });

  it("stops a long narrow stroke before a 513th author while its accepted part remains undoable", () => {
    const doc = new EditorDocument("action-tile-limit", { empty: true });
    // The supported 8px brush at maximum zoom has this world radius. A
    // continuous line can span 513 source tiles with only 32,769 changed
    // controls, so the cell and byte budgets alone do not bound a commit.
    doc.beginGesture({ level: 0, radius: 8 / (2 * 25.6), amount: 10 });
    for (let tile = 0; tile < HEIGHT_MAX_ACTION_TILES; tile++)
      doc.applySegment([Math.max(0, tile - 1) * 320, 0], [tile * 320, 0], 1000);
    const lastPoint: Point = [(HEIGHT_MAX_ACTION_TILES - 1) * 320, 0];
    const lastKey = heightTileKey(0, HEIGHT_MAX_ACTION_TILES - 1, 0);
    const accepted = author(doc, lastKey)!.values;
    const acceptedHeight = doc.sampleHeight(...lastPoint);
    const before = { metrics: doc.metrics, revision: doc.revision };
    expect(() =>
      doc.applySegment(lastPoint, [HEIGHT_MAX_ACTION_TILES * 320, 0], 1000),
    ).toThrow(/höchstens 512 Höhenkacheln/);
    expect({ metrics: doc.metrics, revision: doc.revision }).toEqual(before);
    expect(author(doc, lastKey)!.values).toEqual(accepted);
    expect(doc.sourceState(heightTileKey(0, HEIGHT_MAX_ACTION_TILES, 0))).toBe(
      "absent",
    );

    const change = doc.finishGesture()!;
    expect(change.patches).toHaveLength(HEIGHT_MAX_ACTION_TILES);
    doc.acceptPersistence(change.sequence);
    expect(doc.undo()!.patches).toHaveLength(HEIGHT_MAX_ACTION_TILES);
    expect(doc.sampleHeight(...lastPoint)).toBe(-100);
    expect(doc.redo()!.patches).toHaveLength(HEIGHT_MAX_ACTION_TILES);
    expect(doc.sampleHeight(...lastPoint)).toBe(acceptedHeight);
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
    const stored = new Map(fixture.map((t) => [t.key, cloneHeightTile(t)]));
    for (const patch of first.patches)
      if (patch.after) stored.set(patch.key, cloneHeightTile(patch.after));
      else stored.delete(patch.key);
    const restored = new EditorDocument("new-session", { sequence: 8 });
    restored.acceptCoverage(ALL, [...stored.values()].map(cloneHeightTile), 8);
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
    expect(() =>
      doc.applySegment([Number.POSITIVE_INFINITY, 0], [0, 0], 1000),
    ).toThrow();
    expect(() =>
      doc.applySegment([0, 0], [Number.POSITIVE_INFINITY, 0], 1000),
    ).toThrow();
    expect(() => doc.applySegment([0, 0], [0, 0], 1000)).toThrow(
      /Speicherbudget/,
    );
    expect(doc.finishGesture()).toBeNull();
    expect(doc.sequence).toBe(0);
    expect(doc.metrics.readyTiles).toBe(0);
  });
});

describe("bounded source reads and presentation projection", () => {
  it("certifies coarse absence without claiming unknown fine authors are absent", () => {
    const doc = new EditorDocument("coarse-read");
    doc.acceptCoverage(ALL, [], 0, doc.sessionId, 8);
    expect(doc.isReady(LOCAL, [8, 9, 21])).toBe(true);
    expect(doc.sourceState(heightTileKey(0, 0, 0))).toBe("unknown");
    expect(doc.isReady(LOCAL)).toBe(false);
    doc.beginGesture({ level: 8, radius: 10_000, amount: 10 });
    const update = doc.applySegment([0, 0], [0, 0], 1000);
    expect(update?.patches.length).toBeGreaterThan(0);
    expect(update?.patches.every((p) => p.after?.level === 8)).toBe(true);
    expect(doc.snapshot(LOCAL, [8]).tiles.length).toBeGreaterThan(0);
    expect(() => doc.sampleHeight(0, 0)).toThrow(SourcesNotReadyError);
  });

  it("returns incremental owned source patches while one gesture retains its original undo values", () => {
    const doc = new EditorDocument("live-patches", { empty: true });
    doc.beginGesture({ level: 0, radius: 20, amount: 10 });
    const first = doc.applySegment([0, 0], [0, 0], 1000)!;
    const firstValues = values(
      first.patches.flatMap((p) => (p.after ? [p.after] : [])),
    );
    const next = doc.applySegment([0, 0], [10, 0], 1000)!;
    const repeated = next.patches.find(
      (p) => p.before && first.patches.some((prior) => prior.key === p.key),
    )!;
    expect(repeated.before?.values).toEqual(
      first.patches.find((p) => p.key === repeated.key)!.after!.values,
    );
    expect(
      values(first.patches.flatMap((p) => (p.after ? [p.after] : []))),
    ).toEqual(firstValues);
    const transfer = first.patches[0].after!.values.buffer as ArrayBuffer;
    structuredClone(transfer, { transfer: [transfer] });
    expect(Number.isFinite(doc.sampleHeight(0, 0))).toBe(true);
    doc.finishGesture();
    doc.undo();
    expect(doc.sampleHeight(0, 0)).toBe(-100);
  });

  it("projects pending actions and live edits exactly once for the returned store boundary", () => {
    const doc = new EditorDocument("pending-projection", { empty: true });
    const a = stroke(doc, [[0, 0]]).change!;
    const b = stroke(doc, [[100, 0]]).change!;
    expect(doc.presentationPatchesAfter(0)).toHaveLength(
      a.patches.length + b.patches.length,
    );
    expect(doc.presentationPatchesAfter(a.sequence)).toHaveLength(
      b.patches.length,
    );
    doc.acceptPersistence(a.sequence);
    expect(() => doc.presentationPatchesAfter(0)).toThrow(/aktuell/);
    doc.beginGesture({ level: 0, radius: 20, amount: 10 });
    const live = doc.applySegment([200, 0], [200, 0], 1000)!;
    const pending = doc.presentationPatchesAfter(b.sequence);
    expect(pending).toHaveLength(live.patches.length);
    pending[0].after!.values.fill(0);
    expect(doc.sampleHeight(200, 0)).toBeGreaterThan(-100);
    doc.finishGesture();
    doc.undo();
    expect(doc.sampleHeight(200, 0)).toBe(-100);
  });
});

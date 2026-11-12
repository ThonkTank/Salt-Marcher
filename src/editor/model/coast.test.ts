import { describe, expect, it } from "vitest";
import {
  COAST_BATCH_CELL_LIMIT,
  EditorDocument,
  HEIGHT_TILE_BYTES,
  SourcesNotReadyError,
  WORLD_LIMIT,
  coastBrushReadBounds,
  coastInset,
  coastSegmentCellCost,
  heightSpacing,
  heightTilesFromControls,
  prepareCoastControls,
  type Bounds,
  type CoastBrush,
  type EditorDocumentOptions,
  type HeightTile,
  type Point,
} from "./index";

const WORLD: Bounds = [-WORLD_LIMIT, -WORLD_LIMIT, WORLD_LIMIT, WORLD_LIMIT];
const LOCAL: Bounds = [-1000, -1000, 1000, 1000];
const LAND: CoastBrush = { level: 0, radius: 40, mode: "land", roughness: 0 };

function document(
  tiles: HeightTile[] = [],
  options: EditorDocumentOptions = {},
) {
  const doc = new EditorDocument("coast", { empty: true, ...options });
  if (tiles.length) doc.acceptCoverage(WORLD, tiles);
  return doc;
}

function paint(doc: EditorDocument, brush: CoastBrush, points: Point[]) {
  doc.beginCoastGesture(brush);
  doc.applyCoastSegments(points);
  return doc.finishCoastGesture();
}

function values(doc: EditorDocument, bounds = LOCAL) {
  return doc
    .snapshot(bounds)
    .tiles.sort((a, b) => a.key.localeCompare(b.key))
    .map(({ key, values }) => ({ key, values: Array.from(values) }));
}

function constant(level: number, value: number, extent = 20): HeightTile[] {
  const controls: [number, number, number][] = [];
  for (let y = -extent; y <= extent; y++)
    for (let x = -extent; x <= extent; x++) controls.push([x, y, value]);
  return heightTilesFromControls(level, controls);
}

describe("Land/Meer spatial target", () => {
  it("creates +10 ft land immediately, cuts it to −10 ft sea and preserves untouched ocean", () => {
    const doc = document();
    const land = paint(doc, LAND, [[0, 0]])!;
    expect(doc.sampleHeight(0, 0)).toBeCloseTo(10, 12);
    expect(doc.sampleHeight(300, 300)).toBe(-100);
    expect(land.label).toBe("Land malen");
    expect(doc.brushWork).toBeNull();
    const sea = paint(doc, { ...LAND, mode: "sea" }, [[0, 0]])!;
    expect(doc.sampleHeight(0, 0)).toBeCloseTo(-10, 12);
    expect(sea.label).toBe("Meer malen");
    doc.undo();
    expect(doc.sampleHeight(0, 0)).toBeCloseTo(10, 12);
    doc.undo();
    expect(doc.snapshot(LOCAL).tiles).toEqual([]);
    doc.redo();
    doc.redo();
    expect(doc.sampleHeight(0, 0)).toBeCloseTo(-10, 12);
  });

  it("leaves high land and deep sea unchanged and does not create empty history", () => {
    const high = document(constant(0, 300));
    const deep = document();
    const original = values(high);
    expect(paint(high, LAND, [[0, 0]])).toBeNull();
    expect(values(high)).toEqual(original);
    expect(paint(deep, { ...LAND, mode: "sea" }, [[0, 0]])).toBeNull();
    expect(deep.metrics.historyActions).toBe(0);
    expect(deep.metrics.readyTiles).toBe(0);
  });

  it("matches the independent round swept-disk profile, including its outer support", () => {
    const doc = document();
    const brush = { ...LAND, radius: 24 };
    paint(doc, brush, [
      [-20, 0],
      [40, 0],
    ]);
    const points: Point[] = [];
    const expected: number[] = [];
    for (let y = -40; y <= 40; y += 5)
      for (let x = -60; x <= 80; x += 5) {
        points.push([x, y]);
        const closestX = Math.max(-20, Math.min(40, x));
        const distance = Math.sqrt((x - closestX) ** 2 + y ** 2);
        const absolute =
          distance < 34
            ? Math.max(-10, Math.min(10, (24 - distance) * 2))
            : -100;
        expected.push(absolute + 100);
      }
    for (let i = 0; i < points.length; i += 256)
      expect(
        doc.observeBrushCoefficients(0, points.slice(i, i + 256)).authors,
      ).toEqual(expected.slice(i, i + 256));
  });

  it.each(["land", "sea"] as const)(
    "keeps %s invariant across event subdivisions, batches, reversal and repeated visits",
    (mode) => {
      const brush = { ...LAND, mode, roughness: 0.8 };
      const initial = mode === "land" ? [] : constant(0, 120, 100);
      const whole = document(initial);
      const split = document(initial);
      const reversed = document(initial);
      const path: Point[] = [
        [-150, -30],
        [-70, 50],
        [40, 20],
        [0, -40],
        [-70, 50],
      ];
      whole.beginCoastGesture(brush);
      split.beginCoastGesture(brush);
      reversed.beginCoastGesture(brush);
      whole.applyCoastSegments(path);
      reversed.applyCoastSegments([...path].reverse());
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        split.applyCoastSegments([a, mid]);
        split.applyCoastSegments([mid, b]);
      }
      const expected = values(whole);
      for (const candidate of [split, reversed]) {
        const actual = values(candidate);
        expect(actual.map((tile) => tile.key)).toEqual(
          expected.map((tile) => tile.key),
        );
        for (let i = 0; i < actual.length; i++)
          for (let c = 0; c < actual[i].values.length; c++)
            expect(actual[i].values[c]).toBeCloseTo(expected[i].values[c], 10);
      }
      expect(whole.applyCoastSegments(path)).toBeNull();
      expect(values(whole)).toEqual(expected);
      whole.finishCoastGesture();
      expect(paint(whole, brush, path)).toBeNull();
      expect(whole.metrics.historyActions).toBe(1);
    },
  );

  it("produces continuous inward crinkling, with a stable interior and fixed world coordinates", () => {
    const round = document();
    const rough = document();
    const brush = { ...LAND, radius: 80, roughness: 0.8 };
    paint(round, { ...brush, roughness: 0 }, [[0, 0]]);
    paint(rough, brush, [[0, 0]]);
    expect(rough.sampleHeight(0, 0)).toBeCloseTo(10, 12);
    let indented = 0;
    for (let y = -90; y <= 90; y += 5)
      for (let x = -90; x <= 90; x += 5) {
        expect(rough.sampleHeight(x, y)).toBeLessThanOrEqual(
          round.sampleHeight(x, y) + 1e-10,
        );
        if (rough.sampleHeight(x, y) < round.sampleHeight(x, y) - 1) indented++;
      }
    expect(indented).toBeGreaterThan(100);
    for (const point of [
      [-80, 40],
      [0, 0],
      [WORLD_LIMIT, -WORLD_LIMIT],
    ] as Point[]) {
      const inset = coastInset(brush, point);
      expect(inset).toBeGreaterThanOrEqual(0);
      expect(inset).toBeLessThanOrEqual(brush.radius * brush.roughness * 0.6);
      expect(
        Math.abs(coastInset(brush, [point[0] + 1e-5, point[1]]) - inset),
      ).toBeLessThan(1e-4);
    }
  });

  it("targets the composed coarse baseline and preserves fine additive authors", () => {
    const coarse = constant(4, 200);
    const fine = heightTilesFromControls(0, [[0, 0, 90]]);
    const doc = document([...coarse, ...fine]);
    const fineBefore = values(doc).filter(({ key }) =>
      key.startsWith("height:0:"),
    );
    const coarseBefore = values(doc).filter(({ key }) =>
      key.startsWith("height:4:"),
    );
    paint(doc, { ...LAND, level: 2, radius: 150, mode: "sea" }, [[0, 0]]);
    expect(doc.observeBrushCoefficients(2, [[0, 0]]).authors[0]).toBeCloseTo(
      -110,
      10,
    );
    expect(
      values(doc).filter(({ key }) => key.startsWith("height:0:")),
    ).toEqual(fineBefore);
    expect(
      values(doc).filter(({ key }) => key.startsWith("height:4:")),
    ).toEqual(coarseBefore);
    // A single fine control adds 90 × (2/3)² = 40 ft at its centre.
    expect(doc.sampleHeight(0, 0)).toBeCloseTo(30, 10);
    expect(doc.sampleHeight(60, 0)).toBeCloseTo(-10, 10);
    doc.undo();
    expect(doc.sampleHeight(60, 0)).toBeCloseTo(100, 10);
  });

  it("crosses negative and positive tiles while retaining corners and real endpoints", () => {
    const doc = document();
    const path: Point[] = [
      [-360, -340],
      [350, -340],
      [350, 350],
    ];
    paint(doc, { ...LAND, radius: 20 }, path);
    for (const point of [
      ...path,
      [-320, -340],
      [0, -340],
      [320, -340],
      [350, 0],
    ] as Point[])
      expect(doc.sampleHeight(...point)).toBeCloseTo(10, 10);
    expect(doc.sampleHeight(0, 0)).toBe(-100);
    expect(doc.metrics.historyActions).toBe(1);
  });

  it("clips target controls and support at finite world corners", () => {
    const doc = document();
    paint(doc, LAND, [
      [WORLD_LIMIT, WORLD_LIMIT],
      [WORLD_LIMIT - 50, WORLD_LIMIT],
    ]);
    const observed = doc.observeBrushCoefficients(0, [
      [WORLD_LIMIT, WORLD_LIMIT],
      [WORLD_LIMIT - 50, WORLD_LIMIT],
    ]);
    expect(observed.authors).toEqual([110, 110]);
    for (const tile of doc.snapshot(WORLD).tiles)
      for (let index = 0; index < tile.values.length; index++)
        if (tile.values[index]) {
          expect(
            Math.abs((tile.tileX * 64 + (index % 64)) * 5),
          ).toBeLessThanOrEqual(WORLD_LIMIT);
          expect(
            Math.abs((tile.tileY * 64 + Math.floor(index / 64)) * 5),
          ).toBeLessThanOrEqual(WORLD_LIMIT);
        }
  });

  it("pins both coarser values and confirmed absence until the shared action finishes", async () => {
    const brush = { ...LAND, radius: 20 };
    const doc = document(constant(3, 20));
    doc.beginCoastGesture(brush);
    doc.applyCoastSegments([[0, 0]]);
    const before = doc.observeBrushCoefficients(0, [[0, 0]]).authors;
    doc.retainSources([]);
    doc.acceptCoverage([-30, -30, 30, 30], []);
    expect(doc.applyCoastSegments([[0, 0]])).toBeNull();
    expect(doc.observeBrushCoefficients(0, [[0, 0]]).authors).toEqual(before);
    let finished = false;
    const barrier = doc.whenActionFinished().then(() => {
      finished = true;
    });
    doc.sealCoastGesture();
    expect(doc.finishing).toBe(true);
    await Promise.resolve();
    expect(finished).toBe(false);
    doc.finishCoastGesture();
    await barrier;
    expect(finished).toBe(true);
    expect(doc.finishing).toBe(false);
  });

  it("retains exact source rectangles around a turn without inventing coverage in its hole", () => {
    const doc = document();
    doc.beginCoastGesture({ ...LAND, radius: 20 });
    doc.applyCoastSegments([
      [0, 0],
      [1000, 0],
      [1000, 1000],
    ]);
    doc.retainSources([]);
    expect(doc.isReady([-20, -20, 1020, 20])).toBe(true);
    expect(doc.isReady([980, -20, 1020, 1020])).toBe(true);
    expect(doc.isReady([450, 450, 550, 550])).toBe(false);
    doc.finishCoastGesture();
  });

  it("keeps an earlier accepted prefix when a later batch exceeds the coast action budget", () => {
    const doc = document([], { maxCoastGestureCells: 400 });
    const brush = { ...LAND, radius: 20 };
    doc.beginCoastGesture(brush);
    doc.applyCoastSegments([[0, 0]]);
    const before = values(doc);
    const metrics = doc.metrics;
    expect(() =>
      doc.applyCoastSegments([
        [0, 0],
        [500, 0],
      ]),
    ).toThrow(/Küstenpunkte/);
    expect(values(doc)).toEqual(before);
    expect(doc.metrics).toEqual(metrics);
    doc.finishCoastGesture();
    expect(doc.metrics.historyActions).toBe(1);
    doc.undo();
    expect(doc.sampleHeight(0, 0)).toBe(-100);
  });

  it("rejects unknown sources and preserves the accepted prefix atomically", () => {
    const doc = new EditorDocument("partial");
    doc.acceptCoverage([-100, -100, 100, 100], []);
    doc.beginCoastGesture(LAND);
    doc.applyCoastSegments([[0, 0]]);
    const before = values(doc, [-50, -50, 50, 50]);
    const metrics = doc.metrics;
    expect(() =>
      doc.applyCoastSegments([
        [0, 0],
        [80, 0],
        [80, 400],
      ]),
    ).toThrow(SourcesNotReadyError);
    expect(values(doc, [-50, -50, 50, 50])).toEqual(before);
    expect(doc.metrics).toEqual(metrics);
    doc.finishCoastGesture();
    expect(doc.metrics.historyActions).toBe(1);
    expect(doc.sampleHeight(0, 0)).toBeCloseTo(10, 12);
  });

  it.each([
    { maxCoastGestureCells: 1 },
    { maxSourceBytes: HEIGHT_TILE_BYTES - 1 },
    { maxPendingBytes: HEIGHT_TILE_BYTES - 1 },
    { maxHistoryBytes: HEIGHT_TILE_BYTES - 1 },
  ])(
    "rejects insufficient action budgets before any author or pin change: %o",
    (budget) => {
      const doc = document([], budget);
      doc.beginCoastGesture(LAND);
      const before = doc.metrics;
      expect(() => doc.applyCoastSegments([[0, 0]])).toThrow(RangeError);
      expect(doc.metrics).toEqual(before);
      expect(doc.sampleHeight(0, 0)).toBe(-100);
      expect(doc.finishCoastGesture()).toBeNull();
    },
  );

  it("preserves immutable earlier updates and shares one journal across multiple batches", () => {
    const doc = document();
    doc.beginCoastGesture(LAND);
    const first = doc.applyCoastSegments([[10, 10]])!;
    const held = first.patches.map((patch) => Array.from(patch.after!.values));
    doc.applyCoastSegments([
      [10, 10],
      [100, 10],
    ]);
    first.patches.forEach((patch, i) =>
      expect(Array.from(patch.after!.values)).toEqual(held[i]),
    );
    expect(doc.pendingChanges()).toEqual([]);
    const change = doc.finishCoastGesture()!;
    expect(doc.pendingChanges()).toEqual([change]);
    expect(doc.metrics.historyActions).toBe(1);
  });
});

describe("bounded coast geometry", () => {
  it("enumerates a diagonal strip rather than a quadratic rectangle", () => {
    const brush = { ...LAND, radius: 10 };
    const cost = coastSegmentCellCost(brush, [-5000, -5000], [5000, 5000]);
    expect(cost).toBeLessThan(50_000);
    const prepared = prepareCoastControls(brush, [
      [-5000, -5000],
      [5000, 5000],
    ]);
    const count = [...prepared.byTile.values()].reduce(
      (sum, cells) => sum + cells.count,
      0,
    );
    expect(count).toBeGreaterThan(10_000);
    expect(count).toBeLessThanOrEqual(cost);
  });

  it("fits a maximum-size two-pixel-grid stamp and rejects oversized batches", () => {
    const brush = { ...LAND, radius: 128 * heightSpacing(0) };
    expect(coastSegmentCellCost(brush, [0, 0], [0, 0])).toBeLessThanOrEqual(
      COAST_BATCH_CELL_LIMIT,
    );
    expect(prepareCoastControls(brush, [[0, 0]]).byTile.size).toBeGreaterThan(
      10,
    );
    expect(() =>
      prepareCoastControls(brush, [
        [0, 0],
        [100_000, 0],
      ]),
    ).toThrow(/Arbeitsbereich/);
    expect(coastBrushReadBounds(LAND, [0, 0], [0, 0])).toEqual([
      -60, -60, 60, 60,
    ]);
  });

  it.each([0.25, 0.1000001])(
    "paints the actual 512 px stamp at scale %s without changing the timed gesture budget",
    (scale) => {
      const level = Math.max(0, Math.floor(Math.log2(2 / (5 * scale))));
      const brush = { ...LAND, radius: 256 / scale, level };
      expect(coastSegmentCellCost(brush, [0, 0], [0, 0])).toBeLessThanOrEqual(
        COAST_BATCH_CELL_LIMIT,
      );
      const doc = document([], { maxGestureCells: 1 });
      paint(doc, brush, [[0, 0]]);
      expect(doc.sampleHeight(0, 0)).toBeCloseTo(10, 10);
      expect(doc.metrics.historyActions).toBe(1);
    },
  );

  it.each([-0.01, 1.01, NaN, Infinity])(
    "rejects invalid roughness %s before beginning an action",
    (roughness) => {
      const doc = document();
      expect(() => doc.beginCoastGesture({ ...LAND, roughness })).toThrow(
        RangeError,
      );
      expect(doc.active).toBe(false);
    },
  );
});

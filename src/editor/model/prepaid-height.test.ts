import { describe, expect, it } from "vitest";
import {
  referenceC1Stroke,
  reconstructReferenceC1Stroke,
} from "../../../scripts/atlas-p0-brush-reference.mjs";
import {
  beginTimedBrush,
  planTimedBrushWindow,
  type BrushPoint,
  type TimedBrushWindow,
} from "../brush";
import {
  EditorDocument,
  HEIGHT_BASE,
  HEIGHT_LEVELS,
  HEIGHT_TILE_BYTES,
  WORLD_LIMIT,
  SourcesNotReadyError,
  clipBounds,
  heightControlAddress,
  heightSpacing,
  heightTilesFromControls,
  type Bounds,
  type BrushAdvance,
  type HeightBrush,
  type Point,
} from "./index";

const ALL: Bounds = [-WORLD_LIMIT, -WORLD_LIMIT, WORLD_LIMIT, WORLD_LIMIT];
const brush: HeightBrush = { level: 0, radius: 20, amount: 1 };
const context = (doc: EditorDocument) => ({
  sessionId: doc.sessionId,
  gestureId: 1,
  viewId: 1,
  preparationId: 1,
});
const sample = (point: Point, at: number, input: number): BrushPoint => ({
  point,
  at,
  input,
});

function drain(doc: EditorDocument, maxCells = 17): BrushAdvance[] {
  const steps: BrushAdvance[] = [];
  while (doc.brushWork?.pendingCells || doc.finishing) {
    steps.push(doc.advanceBrushGesture({ maxCells, maxMs: 1000 }));
    if (steps.length > 10000)
      throw new Error("Pinsel-Fortsetzung macht keinen Fortschritt.");
  }
  return steps;
}

function valuesAt(doc: EditorDocument, points: Point[], level = 0) {
  const bounds = clipBounds([
    Math.min(...points.map((point) => point[0])) - 1,
    Math.min(...points.map((point) => point[1])) - 1,
    Math.max(...points.map((point) => point[0])) + 1,
    Math.max(...points.map((point) => point[1])) + 1,
  ]);
  const tiles = new Map(
    doc.snapshot(bounds, [level]).tiles.map((tile) => [tile.key, tile]),
  );
  return points.map(([x, y]) => {
    const address = heightControlAddress(
      level,
      x / heightSpacing(level),
      y / heightSpacing(level),
    );
    return tiles.get(address.key)?.values[address.index] ?? 0;
  });
}

function queueInput(
  doc: EditorDocument,
  input: { brush: HeightBrush; start: BrushPoint; windows: TimedBrushWindow[] },
  feedback = false,
) {
  let state = beginTimedBrush(input.brush, input.start);
  let id = 1;
  doc.beginPrepaidGesture(input.brush, context(doc));
  const admissions = [
    doc.admitBrushBatch({
      admissionId: id++,
      path: { from: input.start.point, points: [], end: false },
      time: [],
      pointCount: 1,
    }),
  ];
  const afterBatch = () => {
    if (!feedback) return;
    drain(doc);
    const frozen = doc.freezeBrushEffect();
    if (frozen) expect(doc.acknowledgeBrushEffect(frozen)).toBe(true);
  };
  afterBatch();
  for (const window of input.windows) {
    const batch = planTimedBrushWindow(state, window);
    admissions.push(
      doc.admitBrushBatch({
        ...batch,
        admissionId: id++,
        pointCount: window.points.length,
      }),
    );
    state = batch.stroke;
    afterBatch();
  }
  return admissions;
}

describe("R2 document-owned C1 admission and bounded continuation", () => {
  it("publishes consumed positive work even when Float64 rounds the author value unchanged", () => {
    const doc = new EditorDocument("r2-rounded-materialization", {
      empty: true,
    });
    doc.acceptCoverage(ALL, heightTilesFromControls(0, [[4, 4, 1e20]], 7));
    doc.beginPrepaidGesture({ level: 0, radius: 3, amount: 1 }, context(doc));
    const admitted = doc.admitBrushBatch({
      admissionId: 1,
      path: { from: [20, 20], points: [[20, 20]], end: true },
      time: [],
      pointCount: 1,
    });
    expect(admitted.reservedCells).toBe(1);
    expect(doc.brushWork!.maxOutstandingEffect).toBeGreaterThan(0);
    const revision = doc.revision;
    const consumed = doc.advanceBrushGesture({ maxCells: 1, maxMs: 1000 });
    expect(consumed.complete).toBe(true);
    expect(consumed.appliedCells).toBe(1);
    expect(consumed.completedAdmissionIds).toEqual([1]);
    expect(consumed.applications).toEqual([
      { admissionId: 1, fromCell: 0, toCell: 1, totalCells: 1 },
    ]);
    expect(consumed.update!.patches).toHaveLength(1);
    const patch = consumed.update!.patches[0];
    expect(patch.after!.values).toEqual(patch.before!.values);
    expect(patch.after!.revision).toBe(revision + 1);
    expect(doc.revision).toBe(revision + 1);
    expect(valuesAt(doc, [[20, 20]])).toEqual([1e20]);
    expect(doc.brushWork!.pendingCells).toBe(0);
    expect(doc.metrics.historyActions).toBe(0);
    expect(doc.pendingChanges()).toHaveLength(0);
    expect(doc.retainSources([])).toEqual([patch.key]);
    expect(doc.metrics.sourceBytes).toBe(0);
  });

  it("keeps earlier unacknowledged authors pinned after a rounded-equal action", () => {
    const doc = new EditorDocument("r2-rounded-pending", { empty: true });
    doc.beginGesture({ level: 0, radius: 3, amount: 1e20 });
    doc.applySegment([20, 20], [20, 20], 1000);
    const prior = doc.finishGesture()!;
    doc.beginPrepaidGesture({ level: 0, radius: 3, amount: 1 }, context(doc));
    doc.admitBrushBatch({
      admissionId: 1,
      path: { from: [20, 20], points: [[20, 20]], end: true },
      time: [],
      pointCount: 1,
    });
    const consumed = doc.advanceBrushGesture({ maxCells: 1, maxMs: 1000 });
    expect(consumed.update).not.toBeNull();
    expect(consumed.change).toBeNull();
    expect(doc.metrics.historyActions).toBe(1);
    expect(doc.pendingChanges()).toHaveLength(1);
    expect(doc.pendingChanges()[0]).toBe(prior);
    expect(doc.retainSources([])).toEqual([]);
    expect(doc.metrics.sourceBytes).toBe(HEIGHT_TILE_BYTES);
    doc.acknowledge(prior);
    expect(doc.retainSources([])).toEqual([prior.patches[0].key]);
    expect(doc.metrics.sourceBytes).toBe(0);
  });

  it("reserves a revisit and real terminal endpoint before materialization, then commits one action", async () => {
    const input = {
      brush,
      start: sample([20, 20], 0, 0),
      windows: [
        {
          at: 50,
          points: [
            sample([60, 20], 15, 1),
            sample([20, 20], 30, 2),
            sample([80, 40], 50, 3),
          ],
          end: true,
        },
      ],
    };
    const probes: Point[] = [
      [20, 20],
      [40, 20],
      [60, 20],
      [80, 40],
      [50, 60],
    ];
    const expected = referenceC1Stroke(input, probes);
    const surface = reconstructReferenceC1Stroke(input, probes);
    const doc = new EditorDocument("r2-complete", { empty: true });
    const admissions = queueInput(doc, input);
    expect(doc.finishing).toBe(true);
    expect(doc.metrics.sourceBytes).toBe(0);
    expect(doc.metrics.historyActions).toBe(0);
    expect(doc.brushWork!.pendingPoints).toBe(4);
    expect(doc.brushWork!.pendingCells).toBeGreaterThan(0);
    expect(doc.brushWork!.bufferBytes).toBeLessThanOrEqual(32 * 1024 * 1024);
    expect(doc.brushWork!.maxOutstandingEffect).toBeLessThanOrEqual(
      doc.brushWork!.effectLimit,
    );
    const frozenBefore = doc.freezeBrushEffect()!;
    let finished = false;
    const barrier = doc.whenActionFinished().then(() => {
      finished = true;
    });
    const first = doc.advanceBrushGesture({ maxCells: 7, maxMs: 1000 });
    expect(first.appliedCells).toBe(7);
    await Promise.resolve();
    expect(finished).toBe(false);
    expect(doc.metrics.historyActions).toBe(0);
    expect(doc.acknowledgeBrushEffect(frozenBefore)).toBe(true);
    const slices = [first, ...drain(doc, 7)];
    await barrier;
    expect(finished).toBe(true);
    expect(doc.finishing).toBe(false);
    expect(doc.brushWork!.pendingPoints).toBe(0);
    expect(doc.brushWork!.pendingCells).toBe(0);
    expect(doc.brushWork!.pendingAdmissions).toBe(0);
    expect(doc.metrics.historyActions).toBe(1);
    expect(doc.pendingChanges()).toHaveLength(1);
    for (const admission of admissions.filter((entry) => entry.reserved)) {
      const ranges = slices
        .flatMap((part) => part.applications)
        .filter((part) => part.admissionId === admission.admissionId);
      let next = 0;
      for (const range of ranges) {
        expect(range.fromCell).toBe(next);
        expect(range.totalCells).toBe(admission.reservedCells);
        next = range.toCell;
      }
      expect(next).toBe(admission.reservedCells);
      expect(
        slices
          .flatMap((part) => part.completedAdmissionIds)
          .filter((id) => id === admission.admissionId),
      ).toHaveLength(1);
    }
    valuesAt(doc, probes).forEach((value, index) =>
      expect(value).toBeCloseTo(expected.total[index], 12),
    );
    probes.forEach((point, index) =>
      expect(doc.sampleHeight(...point) - HEIGHT_BASE).toBeCloseTo(
        surface.total[index],
        11,
      ),
    );
    const revision = doc.revision;
    expect(doc.advanceBrushGesture().update).toBeNull();
    expect(doc.revision).toBe(revision);
    doc.undo();
    expect(valuesAt(doc, probes)).toEqual(probes.map(() => 0));
    doc.redo();
    valuesAt(doc, probes).forEach((value, index) =>
      expect(value).toBeCloseTo(expected.total[index], 12),
    );
  });

  it("retains a stalled window's full corner and endpoint while capping only time", () => {
    const input = {
      brush,
      start: sample([20, 20], 0, 0),
      windows: [
        {
          at: 500,
          points: [sample([80, 20], 300, 1), sample([80, 80], 500, 2)],
          end: true,
        },
      ],
    };
    const probes: Point[] = [
      [20, 20],
      [50, 20],
      [80, 20],
      [80, 50],
      [80, 80],
      [50, 50],
    ];
    const expected = referenceC1Stroke(input, probes);
    const doc = new EditorDocument("r2-corner", { empty: true });
    queueInput(doc, input);
    drain(doc, 31);
    valuesAt(doc, probes).forEach((value, index) =>
      expect(value).toBeCloseTo(expected.total[index], 12),
    );
    expect(valuesAt(doc, [[50, 50]])).toEqual([0]);
    expect(doc.metrics.historyActions).toBe(1);
  });

  it("does not book late Move/Up time twice after real stationary windows", () => {
    const input = {
      brush,
      start: sample([20, 20], 0, 0),
      windows: [
        { at: 40, points: [] },
        { at: 80, points: [] },
        { at: 120, points: [] },
        {
          at: 140,
          points: [sample([25, 20], 110, 1), sample([30, 20], 115, 2)],
          end: true,
        },
      ],
    };
    const probes: Point[] = [
      [20, 20],
      [25, 20],
      [30, 20],
    ];
    const expected = referenceC1Stroke(input, probes);
    const doc = new EditorDocument("r2-late-clock", { empty: true });
    queueInput(doc, input, true);
    valuesAt(doc, probes).forEach((value, index) =>
      expect(value).toBeCloseTo(expected.total[index], 12),
    );
    expect(valuesAt(doc, [[20, 20]])[0]).toBeCloseTo(0.12, 12);
    expect(doc.metrics.historyActions).toBe(1);
  });

  it("shares 128 unfinished points and reserves the last slot for actual Up", () => {
    const doc = new EditorDocument("r2-point-limit", { empty: true });
    doc.beginPrepaidGesture({ level: 0, radius: 3, amount: 1 }, context(doc));
    doc.admitBrushBatch({
      admissionId: 1,
      path: {
        from: [20, 20],
        points: Array.from({ length: 127 }, () => [20, 20] as Point),
        end: false,
      },
      time: [],
      pointCount: 127,
    });
    expect(doc.brushWork!.pendingPoints).toBe(127);
    expect(() =>
      doc.admitBrushBatch({
        admissionId: 2,
        path: { from: [20, 20], points: [[25, 20]], end: false },
        time: [],
        pointCount: 1,
      }),
    ).toThrow(/letzte Platz/);
    doc.admitBrushBatch({
      admissionId: 2,
      path: { from: [20, 20], points: [[25, 20]], end: true },
      time: [],
      pointCount: 1,
    });
    expect(doc.brushWork!.pendingPoints).toBe(128);
    expect(doc.finishing).toBe(true);
    doc.advanceBrushGesture({ maxCells: 1, maxMs: 1000 });
    expect(doc.brushWork!.pendingPoints).toBe(1);
    expect(doc.metrics.historyActions).toBe(0);
    drain(doc, 1);
    expect(
      valuesAt(doc, [
        [20, 20],
        [25, 20],
      ]),
    ).toEqual([1 / 60, 1 / 60]);
    expect(doc.metrics.historyActions).toBe(1);
  });

  it("rejects unknown sources and history capacity before account mutation", () => {
    const unknown = new EditorDocument("r2-unknown");
    const history = new EditorDocument("r2-history-cap", {
      empty: true,
      maxHistoryBytes: HEIGHT_TILE_BYTES,
    });
    const batch = {
      admissionId: 1,
      path: { from: [20, 20] as Point, points: [] as Point[], end: false },
      time: [],
      pointCount: 1,
    };
    for (const doc of [unknown, history]) {
      doc.beginPrepaidGesture({ level: 0, radius: 3, amount: 1 }, context(doc));
      const before = {
        work: doc.brushWork,
        metrics: doc.metrics,
        revision: doc.revision,
      };
      expect(() => doc.admitBrushBatch(batch)).toThrow(
        doc === unknown ? SourcesNotReadyError : /History/,
      );
      expect({
        work: doc.brushWork,
        metrics: doc.metrics,
        revision: doc.revision,
      }).toEqual(before);
    }
  });

  it("rejects true cell overflow atomically while retaining the accepted action", () => {
    const doc = new EditorDocument("r2-cell-cap", {
      empty: true,
      maxGestureCells: 1,
    });
    doc.beginPrepaidGesture({ level: 0, radius: 3, amount: 1 }, context(doc));
    doc.admitBrushBatch({
      admissionId: 1,
      path: { from: [20, 20], points: [], end: false },
      time: [],
      pointCount: 1,
    });
    const before = {
      work: doc.brushWork,
      metrics: doc.metrics,
      revision: doc.revision,
    };
    expect(() =>
      doc.admitBrushBatch({
        admissionId: 2,
        path: { from: [20, 20], points: [[25, 20]], end: false },
        time: [],
        pointCount: 1,
      }),
    ).toThrow(/100.000/);
    expect({
      work: doc.brushWork,
      metrics: doc.metrics,
      revision: doc.revision,
    }).toEqual(before);
    doc.sealBrushGesture();
    drain(doc);
    expect(
      valuesAt(doc, [
        [20, 20],
        [25, 20],
      ]),
    ).toEqual([1 / 60, 0]);
    expect(doc.metrics.historyActions).toBe(1);
  });

  it("pins accepted absent/coarse sources and their future allocation against late reads", () => {
    const doc = new EditorDocument("r2-source-pin", {
      empty: true,
      maxSourceBytes: HEIGHT_TILE_BYTES,
    });
    doc.beginPrepaidGesture({ level: 0, radius: 3, amount: 1 }, context(doc));
    doc.admitBrushBatch({
      admissionId: 1,
      path: { from: [20, 20], points: [[20, 20]], end: true },
      time: [],
      pointCount: 1,
    });
    const unrelated = heightTilesFromControls(0, [[100, 100, 50]]);
    expect(() => doc.acceptCoverage(ALL, unrelated)).toThrow(/Speicherbudget/);
    doc.acceptCoverage(ALL, [
      ...heightTilesFromControls(0, [[4, 4, 50]]),
      ...heightTilesFromControls(1, [[2, 2, 70]]),
    ]);
    expect(doc.metrics.sourceBytes).toBe(0);
    doc.retainSources([]);
    drain(doc);
    expect(valuesAt(doc, [[20, 20]])).toEqual([1 / 60]);
    expect(doc.metrics.sourceBytes).toBe(HEIGHT_TILE_BYTES);
    expect(
      doc.snapshot([19, 19, 21, 21]).tiles.every((tile) => tile.level === 0),
    ).toBe(true);
  });

  it("seals on context change, rejects old or forged receipts, and drains accepted work", () => {
    const doc = new EditorDocument("r2-context", { empty: true });
    doc.beginPrepaidGesture(brush, context(doc));
    doc.admitBrushBatch({
      admissionId: 1,
      path: { from: [20, 20], points: [[80, 20]], end: false },
      time: [],
      pointCount: 1,
    });
    doc.advanceBrushGesture({ maxCells: 3, maxMs: 1000 });
    const old = doc.freezeBrushEffect()!;
    doc.changeBrushContext({ ...context(doc), viewId: 2 });
    expect(doc.finishing).toBe(true);
    expect(doc.acknowledgeBrushEffect(old)).toBe(false);
    drain(doc);
    expect(
      valuesAt(doc, [
        [20, 20],
        [80, 20],
      ]),
    ).toEqual([1 / 60, 1 / 60]);
    const fresh = doc.freezeBrushEffect()!;
    expect(doc.acknowledgeBrushEffect({ ...fresh })).toBe(false);
    expect(doc.acknowledgeBrushEffect(fresh)).toBe(true);
  });

  it("rejects captured and future action barriers after disposal without later mutation", async () => {
    const doc = new EditorDocument("r2-discard", { empty: true });
    doc.beginPrepaidGesture(brush, context(doc));
    doc.admitBrushBatch({
      admissionId: 1,
      path: { from: [20, 20], points: [[80, 20]], end: true },
      time: [],
      pointCount: 1,
    });
    doc.advanceBrushGesture({ maxCells: 3, maxMs: 1000 });
    const barrier = doc.whenActionFinished();
    doc.invalidateContinuation();
    await expect(barrier).rejects.toThrow(/Dokumentsitzung wurde beendet/);
    await expect(doc.whenActionFinished()).rejects.toThrow(
      /Dokumentsitzung wurde beendet/,
    );
    expect(doc.disposed).toBe(true);
    expect(() => doc.beginGesture(brush)).toThrow(
      /Dokumentsitzung wurde beendet/,
    );
    const revision = doc.revision;
    expect(doc.advanceBrushGesture().update).toBeNull();
    expect(doc.revision).toBe(revision);
    expect(doc.metrics.historyActions).toBe(0);
    expect(doc.freezeBrushEffect()).toBeNull();
  });

  it("enumerates a long diagonal strip without losing its exact interior or endpoint", () => {
    const doc = new EditorDocument("r2-diagonal", { empty: true });
    doc.beginPrepaidGesture({ level: 0, radius: 3, amount: 1 }, context(doc));
    const accepted = doc.admitBrushBatch({
      admissionId: 1,
      path: { from: [0, 0], points: [[10000, 10000]], end: true },
      time: [],
      pointCount: 1,
    });
    expect(accepted.examinedCells).toBeLessThan(10_000);
    drain(doc, 256);
    expect(
      valuesAt(doc, [
        [0, 0],
        [5000, 5000],
        [10000, 10000],
      ]),
    ).toEqual([1 / 60, 1 / 60, 1 / 60]);
    expect(valuesAt(doc, [[5000, 5020]])).toEqual([0]);
  });

  it("keeps borrowed patches and committed history immutable across later C1 and legacy edits", () => {
    const doc = new EditorDocument("r2-immutable", { empty: true });
    doc.beginPrepaidGesture(brush, context(doc));
    doc.admitBrushBatch({
      admissionId: 1,
      path: { from: [20, 20], points: [], end: false },
      time: [],
      pointCount: 1,
    });
    const first = doc.advanceBrushGesture({
      maxCells: 1000,
      maxMs: 1000,
    }).update!;
    const original = first.patches.map((patch) => patch.after!.values.slice());
    doc.admitBrushBatch({
      admissionId: 2,
      path: { from: [20, 20], points: [[20, 20]], end: true },
      time: [{ from: [20, 20], to: [20, 20], elapsedMs: 50 }],
      pointCount: 1,
    });
    drain(doc);
    first.patches.forEach((patch, index) =>
      expect(patch.after!.values).toEqual(original[index]),
    );
    const history = doc.pendingChanges()[0];
    const saved = history.patches.map((patch) => patch.after!.values.slice());
    doc.beginGesture(brush);
    doc.applySegment([20, 20], [20, 20], 50);
    doc.finishGesture();
    history.patches.forEach((patch, index) =>
      expect(patch.after!.values).toEqual(saved[index]),
    );
  });

  it.each([
    { from: [-40, -40] as Point, to: [40, 40] as Point },
    {
      from: [WORLD_LIMIT - 60, WORLD_LIMIT - 40] as Point,
      to: [WORLD_LIMIT, WORLD_LIMIT] as Point,
    },
    {
      from: [-WORLD_LIMIT, -WORLD_LIMIT] as Point,
      to: [-WORLD_LIMIT + 60, -WORLD_LIMIT + 40] as Point,
    },
  ])(
    "matches signed/world-edge independent coefficients: $from → $to",
    ({ from, to }) => {
      const input = {
        brush,
        start: sample(from, 0, 0),
        windows: [{ at: 30, points: [sample(to, 30, 1)], end: true }],
      };
      const probes: Point[] = [
        from,
        [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],
        to,
      ];
      const expected = referenceC1Stroke(input, probes);
      const doc = new EditorDocument("r2-world", { empty: true });
      queueInput(doc, input);
      drain(doc);
      valuesAt(doc, probes).forEach((value, index) =>
        expect(value).toBeCloseTo(expected.total[index], 12),
      );
    },
  );

  it.each(HEIGHT_LEVELS)(
    "matches independent negative C1 coefficients at author level %i",
    (level) => {
      const step = heightSpacing(level);
      const input = {
        brush: { level, radius: 4 * step, amount: -1 },
        start: sample([0, 0], 0, 0),
        windows: [
          { at: 50, points: [sample([4 * step, 0], 50, 1)], end: true },
        ],
      };
      const probes: Point[] = [
        [0, 0],
        [2 * step, step],
        [4 * step, 0],
        [-step, 2 * step],
      ];
      const expected = referenceC1Stroke(input, probes);
      const doc = new EditorDocument(`r2-level-${level}`, { empty: true });
      queueInput(doc, input);
      drain(doc);
      valuesAt(doc, probes, level).forEach((value, index) =>
        expect(value).toBeCloseTo(expected.total[index], 12),
      );
    },
  );

  it("keeps temporal-only controls distinct from spatial controls", () => {
    const doc = new EditorDocument("r2-time-only", { empty: true });
    doc.beginPrepaidGesture({ level: 0, radius: 3, amount: 1 }, context(doc));
    doc.admitBrushBatch({
      admissionId: 1,
      path: { from: [0, 0], points: [[0, 0]], end: true },
      time: [{ from: [25, -5], to: [25, -5], elapsedMs: 50 }],
      pointCount: 1,
    });
    drain(doc);
    expect(
      valuesAt(doc, [
        [0, 0],
        [25, -5],
      ]),
    ).toEqual([1 / 60, 0.05]);
  });

  it.each([
    { to: [5, 5] as Point, maxVisits: 100 },
    { to: [-5, 10] as Point, maxVisits: 110 },
  ])(
    "clips diagonal candidates without losing boundary coefficients: $to",
    ({ to, maxVisits }) => {
      const input = {
        brush,
        start: sample([0, 0], 0, 0),
        windows: [{ at: 50, points: [sample(to, 50, 1)], end: true }],
      };
      const probes: Point[] = [];
      for (let x = -30; x <= 35; x += 5)
        for (let y = -30; y <= 35; y += 5) probes.push([x, y]);
      const expected = referenceC1Stroke(input, probes);
      const doc = new EditorDocument(`r2-caps-${to}`, { empty: true });
      expect(queueInput(doc, input)[1].examinedCells).toBeLessThanOrEqual(
        maxVisits,
      );
      drain(doc, 256);
      valuesAt(doc, probes).forEach((value, index) =>
        expect(value).toBeCloseTo(expected.total[index], 12),
      );
    },
  );

  it.each([
    { extent: 585, lookupSlotCount: 16_384 },
    { extent: 590, lookupSlotCount: 0 },
  ])(
    "matches the independent oracle across the dense/sparse lookup boundary: $extent",
    ({ extent, lookupSlotCount }) => {
      const end: Point = [extent, extent];
      const input = {
        brush,
        start: sample([0, 0], 0, 0),
        windows: [
          {
            at: 50,
            points: [
              sample(end, 5, 1),
              sample([0, 0], 10, 2),
              sample(end, 15, 3),
              sample(end, 50, 4),
            ],
            end: true,
          },
        ],
      };
      const probes: Point[] = [
        [0, 0],
        [100, 100],
        [300, 300],
        end,
        [extent, extent - 10],
        [300, 310],
        [0, extent],
      ];
      const expected = referenceC1Stroke(input, probes);
      expect(expected.total[3]).toBeGreaterThan(0.03);
      const doc = new EditorDocument(`r2-lookup-${extent}`, { empty: true });
      const admitted = queueInput(doc, input)[1];
      expect(admitted.lookupSlotCount).toBe(lookupSlotCount);
      expect(admitted.examinedCells).toBeLessThan(10_000);
      drain(doc, 256);
      valuesAt(doc, probes).forEach((value, index) =>
        expect(value).toBeCloseTo(expected.total[index], 12),
      );
    },
  );
});

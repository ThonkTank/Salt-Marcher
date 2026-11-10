import { describe, expect, it } from "vitest";
import {
  applyTestBrush,
  beginTestBrush,
  finishTestBrush,
} from "../../../tests/support/prepaidBrush";
import {
  EditorDocument,
  HEIGHT_TILE_BYTES,
  LANDSCAPE_TILE_BYTES,
  LANDSCAPE_TILE_CELLS,
  SourcesNotReadyError,
  WORLD_LIMIT,
  createLandscapeTile,
  landscapeCellAddress,
  parseLandscapeTileKey,
  prepareLandscapeSampler,
  validateLandscapeTile,
  type Bounds,
  type EditorDocumentOptions,
  type LandscapeTile,
  type LandscapeWeights,
  type Point,
} from "./index";

const WORLD: Bounds = [-WORLD_LIMIT, -WORLD_LIMIT, WORLD_LIMIT, WORLD_LIMIT];
const LOCAL: Bounds = [0, 0, 64, 64];
const CLEAR: LandscapeWeights = [0, 0, 0, 0];
const FOREST: LandscapeWeights = [180, 0, 0, 0];
const POINT: Point = [2.5, 2.5];

function full(level: number, weights: LandscapeWeights, tileX = 0, tileY = 0) {
  const tile = createLandscapeTile(level, tileX, tileY);
  tile.mask.fill(1);
  for (let index = 0; index < LANDSCAPE_TILE_CELLS; index++)
    tile.values.set(weights, index * 4);
  return tile;
}

function loaded(
  tiles: LandscapeTile[] = [],
  options: EditorDocumentOptions = {},
) {
  const doc = new EditorDocument("landscape-model", {
    empty: true,
    ...options,
  });
  doc.acceptLandscapeCoverage(WORLD, tiles);
  return doc;
}

function paint(
  doc: EditorDocument,
  weights = FOREST,
  point = POINT,
  level = 0,
  radius = 0.49,
  strength = 1,
) {
  doc.beginLandscapeGesture({ level, radius, weights, strength });
  doc.applyLandscapeSegment(point, point);
  return doc.finishLandscapeGesture();
}

function height(doc: EditorDocument) {
  beginTestBrush(doc, { level: 0, amount: 5, radius: 20 });
  applyTestBrush(doc, [100, 100], [100, 100], 50);
  return finishTestBrush(doc)!;
}

describe("landscape cells and ownership", () => {
  it("uses half-open cells on both sides of zero and the closed outer world edge", () => {
    expect(landscapeCellAddress(0, -0.01, -0.01)).toMatchObject({
      key: "landscape:0:-1:-1",
      index: 4095,
    });
    expect(landscapeCellAddress(0, -64, -64)).toMatchObject({
      key: "landscape:0:-1:-1",
      index: 0,
    });
    expect(landscapeCellAddress(0, 0, 0)).toMatchObject({
      key: "landscape:0:0:0",
      index: 0,
    });
    expect(landscapeCellAddress(0, WORLD_LIMIT, WORLD_LIMIT)).toMatchObject({
      key: "landscape:0:1562499:1562499",
      index: 4095,
    });
    expect(() => parseLandscapeTileKey("landscape:0:-0:0")).toThrow(
      /kanonisch/,
    );
    expect(() => landscapeCellAddress(25, 0, 0)).toThrow();
  });

  it.each(["mask", "sum", "unowned", "length", "outside"])(
    "rejects malformed %s payloads",
    (fault) => {
      const tile = createLandscapeTile(0, 0, 0);
      if (fault === "mask") tile.mask[0] = 2;
      if (fault === "sum") {
        tile.mask[0] = 1;
        tile.values.set([128, 128, 0, 0]);
      }
      if (fault === "unowned") tile.values[0] = 1;
      if (fault === "length") tile.values = new Uint8Array(4);
      if (fault === "outside") {
        tile.key = "landscape:0:1562500:0";
        tile.tileX = 1562500;
      }
      expect(() => validateLandscapeTile(tile)).toThrow();
    },
  );

  it("preserves four alternative coverages and distinguishes absence from explicit zero", () => {
    const coarse = full(4, [60, 50, 40, 30]);
    const fine = createLandscapeTile(0, 0, 0);
    const at = landscapeCellAddress(0, ...POINT);
    fine.mask[at.index] = 1;
    const sample = prepareLandscapeSampler([coarse, fine]);
    expect(sample(...POINT)).toEqual(CLEAR);
    expect(sample(3.5, 2.5)).toEqual([60, 50, 40, 30]);
    expect(prepareLandscapeSampler([coarse, fine], 1)(...POINT)).toEqual([
      60, 50, 40, 30,
    ]);
  });

  it("does not infer landscape absence from an empty height document", () => {
    const doc = new EditorDocument("separate-empty", { empty: true });
    expect(doc.isReady(LOCAL)).toBe(true);
    expect(doc.isLandscapeReady(LOCAL)).toBe(false);
    expect(doc.readLandscapeCell(0, ...POINT)).toBeUndefined();
    expect(() => doc.sampleLandscape(...POINT)).toThrow(SourcesNotReadyError);
    const landscapeOnly = new EditorDocument("landscape-empty", {
      landscapeEmpty: true,
    });
    expect(landscapeOnly.isLandscapeReady(LOCAL)).toBe(true);
    expect(landscapeOnly.isReady(LOCAL)).toBe(false);
  });

  it("keeps unknown fine cells separate from certified coarse inheritance", () => {
    const doc = new EditorDocument("partial");
    const coarse = full(4, FOREST);
    coarse.mask[0] = 0;
    coarse.values.fill(0, 0, 4);
    doc.acceptLandscapeCoverage(LOCAL, [coarse], 0, doc.sessionId, 4);
    expect(doc.isLandscapeReady(LOCAL, 4)).toBe(true);
    expect(doc.isLandscapeReady(LOCAL, 0)).toBe(false);
    expect(doc.readLandscapeCell(0, ...POINT)).toBeUndefined();
    expect(doc.readLandscapeCell(4, ...POINT)).toBeNull();
    expect(doc.readLandscapeCell(4, 20, 20)).toEqual(FOREST);
    expect(doc.landscapeSnapshot(LOCAL, 4).tiles).toHaveLength(1);
    expect(() => doc.landscapeSources(LOCAL)).toThrow(SourcesNotReadyError);
  });

  it("validates a whole read before changing data, proof or generation", () => {
    const doc = new EditorDocument("read-validation");
    const tile = full(0, FOREST);
    const before = doc.generation;
    expect(() => doc.acceptLandscapeCoverage(LOCAL, [tile, tile])).toThrow(
      /Landschaftsantwort/,
    );
    expect(() =>
      doc.acceptLandscapeCoverage(LOCAL, [tile], 0, "foreign"),
    ).toThrow(/Sitzung/);
    expect(() => doc.acceptLandscapeCoverage(LOCAL, [tile], 1)).toThrow(
      /Lesesequenz/,
    );
    expect(doc.generation).toBe(before);
    expect(doc.isLandscapeReady(LOCAL)).toBe(false);
    expect(doc.metrics.landscapeReadyTiles).toBe(0);
  });
});

describe("landscape gestures and the shared document", () => {
  it("paints from inherited mixed coverage and keeps normalized rounding", () => {
    const doc = loaded([full(4, [80, 60, 40, 20])]);
    paint(doc, CLEAR, POINT, 0, 0.49, 0.5);
    expect(doc.sampleLandscape(...POINT)).toEqual([40, 30, 20, 10]);
    expect(doc.sampleLandscape(3.5, 2.5)).toEqual([80, 60, 40, 20]);
    const normalized = loaded([full(4, [255, 0, 0, 0])]);
    paint(normalized, [0, 255, 0, 0], POINT, 0, 0.49, 0.5);
    expect(normalized.sampleLandscape(...POINT)).toEqual([128, 127, 0, 0]);
    for (const tile of normalized.landscapeSnapshot(WORLD).tiles)
      validateLandscapeTile(tile);
  });

  it("retains an explicitly empty fine clearing through a coarse forest change", () => {
    const doc = loaded([full(4, FOREST)]);
    const clearing = paint(doc, CLEAR)!;
    const fineBefore = doc
      .landscapeSnapshot(LOCAL)
      .tiles.find((tile) => tile.level === 0)!;
    expect(clearing.patches[0].kind).toBe("landscape");
    paint(doc, [240, 0, 0, 0], [8, 8], 4, 1);
    expect(doc.sampleLandscape(...POINT)).toEqual(CLEAR);
    expect(doc.sampleLandscape(8, 8)).toEqual([240, 0, 0, 0]);
    const fineAfter = doc
      .landscapeSnapshot(LOCAL)
      .tiles.find((tile) => tile.level === 0)!;
    expect(fineAfter.mask).toEqual(fineBefore.mask);
    expect(fineAfter.values).toEqual(fineBefore.values);
    doc.undo();
    expect(doc.sampleLandscape(...POINT)).toEqual(CLEAR);
    expect(doc.sampleLandscape(8, 8)).toEqual(FOREST);
    doc.undo();
    expect(doc.sampleLandscape(...POINT)).toEqual(FOREST);
    doc.redo();
    doc.redo();
    expect(doc.sampleLandscape(...POINT)).toEqual(CLEAR);
    expect(doc.sampleLandscape(8, 8)).toEqual([240, 0, 0, 0]);
  });

  it("cancel restores inherited mask absence without a history or persistence action", async () => {
    const doc = loaded([full(4, FOREST)]);
    doc.beginLandscapeGesture({ level: 0, radius: 0.49, weights: CLEAR });
    doc.applyLandscapeSegment(POINT, POINT);
    const revision = doc.revision;
    const completion = doc.whenActionFinished();
    expect(doc.sampleLandscape(...POINT)).toEqual(CLEAR);
    expect(doc.landscapePatchesAfter(0)).toHaveLength(1);
    const update = doc.cancelLandscapeGesture()!;
    await completion;
    expect(update.patches[0].after).toBeNull();
    expect(doc.revision).toBeGreaterThan(revision);
    expect(doc.sampleLandscape(...POINT)).toEqual(FOREST);
    expect(doc.landscapeSourceState("landscape:0:0:0")).toBe("absent");
    expect(doc.sequence).toBe(0);
    expect(doc.metrics.historyActions).toBe(0);
    expect(doc.pendingChanges()).toEqual([]);
    expect(doc.landscapePatchesAfter(0)).toEqual([]);
  });

  it("cancel preserves the pending sequence marker of an earlier action", () => {
    const doc = loaded();
    const original = paint(doc)!;
    doc.beginLandscapeGesture({
      level: 0,
      radius: 0.49,
      weights: [240, 0, 0, 0],
    });
    doc.applyLandscapeSegment(POINT, POINT);
    doc.acceptLandscapeCoverage(LOCAL, [], 0);
    doc.cancelLandscapeGesture();
    doc.acceptLandscapeCoverage(LOCAL, [], 0);
    expect(doc.sampleLandscape(...POINT)).toEqual(FOREST);
    expect(doc.pendingChanges()).toEqual([original]);
    expect(doc.retainLandscapeSources([])).toEqual([]);
    doc.acknowledge(original);
    expect(doc.retainLandscapeSources([])).toEqual(["landscape:0:0:0"]);
    expect(doc.landscapeSourceState("landscape:0:0:0")).toBe("unknown");
  });

  it("seals input while the document barrier waits for the accepted remaining segment", async () => {
    const doc = loaded();
    doc.beginLandscapeGesture({ level: 0, radius: 0.49, weights: FOREST });
    doc.applyLandscapeSegment(POINT, POINT);
    let finished = false;
    const completion = doc.whenActionFinished().then(() => {
      finished = true;
    });
    doc.sealLandscapeGesture();
    await Promise.resolve();
    expect(doc.active).toBe(true);
    expect(doc.finishing).toBe(true);
    expect(finished).toBe(false);
    expect(() =>
      doc.beginLandscapeGesture({ level: 0, radius: 1, weights: CLEAR }),
    ).toThrow(/aktiv/);
    expect(() => height(doc)).toThrow(/aktiv/);
    doc.applyLandscapeSegment(POINT, [3.5, 2.5]);
    doc.finishLandscapeGesture();
    await completion;
    expect(doc.sampleLandscape(3.5, 2.5)).toEqual(FOREST);
    expect(doc.sequence).toBe(1);
    expect(doc.finishing).toBe(false);
  });

  it("rejects an abandoned continuation and cannot begin another action", async () => {
    const doc = loaded();
    doc.beginLandscapeGesture({ level: 0, radius: 1, weights: FOREST });
    doc.sealLandscapeGesture();
    const completion = doc.whenActionFinished();
    doc.invalidateContinuation();
    await expect(completion).rejects.toThrow(/beendet/);
    await expect(doc.whenActionFinished()).rejects.toThrow(/beendet/);
    expect(() => paint(doc)).toThrow(/beendet/);
  });

  it("shares height and landscape sequence, history, redo and pending receipts", () => {
    const doc = loaded();
    const first = height(doc);
    const editedHeight = doc.sampleHeight(100, 100);
    const second = paint(doc)!;
    expect([first.sequence, second.sequence]).toEqual([1, 2]);
    expect(
      doc.pendingChanges().map((change) => change.patches[0].kind),
    ).toEqual(["height", "landscape"]);
    expect(doc.presentationPatchesAfter(0)).toHaveLength(first.patches.length);
    expect(doc.landscapePatchesAfter(0)).toHaveLength(second.patches.length);
    expect(doc.undo()!.patches[0].kind).toBe("landscape");
    expect(doc.sampleLandscape(...POINT)).toEqual(CLEAR);
    expect(doc.undo()!.patches[0].kind).toBe("height");
    expect(doc.sampleHeight(100, 100)).toBe(-100);
    doc.redo();
    doc.redo();
    expect(doc.sequence).toBe(6);
    expect(doc.sampleHeight(100, 100)).toBe(editedHeight);
    expect(doc.sampleLandscape(...POINT)).toEqual(FOREST);
    for (const change of [...doc.pendingChanges()]) doc.acknowledge(change);
    expect(doc.persistedSequence).toBe(6);
    expect(doc.pendingChanges()).toEqual([]);
  });

  it("keeps borrowed render inputs immutable and transport copies independently owned", () => {
    const source = full(4, FOREST);
    const doc = loaded([source]);
    source.values.fill(0);
    expect(doc.sampleLandscape(20, 20)).toEqual(FOREST);
    doc.beginLandscapeGesture({ level: 0, radius: 0.49, weights: CLEAR });
    doc.applyLandscapeSegment(POINT, POINT);
    const borrowed = doc.landscapeSources(LOCAL);
    const fine = borrowed.find((tile) => tile.level === 0)!;
    const mask = fine.mask.slice(),
      values = fine.values.slice();
    const overlay = doc.landscapePatchesAfter(0);
    const transport = doc.landscapeSnapshot(LOCAL);
    transport.tiles.forEach((tile) => {
      tile.mask.fill(0);
      tile.values.fill(0);
    });
    doc.applyLandscapeSegment([4.5, 2.5], [4.5, 2.5]);
    doc.cancelLandscapeGesture();
    expect(fine.mask).toEqual(mask);
    expect(fine.values).toEqual(values);
    expect(prepareLandscapeSampler(borrowed)(...POINT)).toEqual(CLEAR);
    expect(overlay[0].after!.mask).toEqual(mask);
    expect(doc.sampleLandscape(...POINT)).toEqual(FOREST);
  });

  it("omits no-op history and does not redose duplicate geometry", () => {
    const doc = loaded();
    paint(doc);
    const sequence = doc.sequence;
    doc.beginLandscapeGesture({ level: 0, radius: 0.49, weights: FOREST });
    expect(doc.applyLandscapeSegment(POINT, POINT)).toBeNull();
    expect(doc.finishLandscapeGesture()).toBeNull();
    expect(doc.sequence).toBe(sequence);
    doc.beginLandscapeGesture({
      level: 0,
      radius: 0.49,
      weights: CLEAR,
      strength: 0.5,
    });
    doc.applyLandscapeSegment(POINT, POINT);
    const once = doc.sampleLandscape(...POINT);
    expect(doc.applyLandscapeSegment(POINT, POINT)).toBeNull();
    expect(doc.sampleLandscape(...POINT)).toEqual(once);
    doc.finishLandscapeGesture();
    expect(doc.metrics.historyActions).toBe(2);
  });

  it("creates explicit clearing ownership even when the inherited field is already empty", () => {
    const doc = loaded();
    const clearing = paint(doc, CLEAR)!;
    expect(clearing.patches[0].after).not.toBeNull();
    expect(doc.readLandscapeCell(0, ...POINT)).toEqual(CLEAR);
    paint(doc, FOREST, [8, 8], 4, 1);
    expect(doc.sampleLandscape(...POINT)).toEqual(CLEAR);
    expect(doc.sampleLandscape(3.5, 2.5)).toEqual(FOREST);
  });
});

describe("landscape budgets, residency and read sequencing", () => {
  it("shares the resident source budget with height and rejects allocation atomically", () => {
    const limit = HEIGHT_TILE_BYTES + LANDSCAPE_TILE_BYTES;
    const doc = loaded([], { maxSourceBytes: limit });
    height(doc);
    paint(doc);
    expect(doc.metrics.sourceBytes).toBe(limit);
    expect(doc.metrics.readyTiles).toBe(1);
    expect(doc.metrics.landscapeReadyTiles).toBe(1);
    doc.beginLandscapeGesture({ level: 0, radius: 0.49, weights: FOREST });
    expect(() => doc.applyLandscapeSegment([128.5, 2.5], [128.5, 2.5])).toThrow(
      /Speicherbudget/,
    );
    expect(doc.metrics.sourceBytes).toBe(limit);
    expect(doc.sampleLandscape(128.5, 2.5)).toEqual(CLEAR);
    doc.cancelLandscapeGesture();
    expect(doc.sequence).toBe(2);
  });

  it("reserves landscape pending bytes against the existing height journal", () => {
    const doc = loaded([], { maxPendingBytes: 40_000 });
    const committed = height(doc);
    doc.beginLandscapeGesture({ level: 0, radius: 0.49, weights: FOREST });
    expect(() => doc.applyLandscapeSegment(POINT, POINT)).toThrow(
      /Arbeitskopie/,
    );
    expect(doc.metrics.landscapeReadyTiles).toBe(0);
    doc.cancelLandscapeGesture();
    doc.acknowledge(committed);
    expect(paint(doc)!.sequence).toBe(2);
    expect(doc.metrics.pendingBytes).toBe(LANDSCAPE_TILE_BYTES);
  });

  it("reserves history before mutation and prunes only completed actions", () => {
    const tooSmall = loaded([], { maxHistoryBytes: LANDSCAPE_TILE_BYTES - 1 });
    tooSmall.beginLandscapeGesture({ level: 0, radius: 0.49, weights: FOREST });
    expect(() => tooSmall.applyLandscapeSegment(POINT, POINT)).toThrow(
      /History/,
    );
    expect(tooSmall.metrics.sourceBytes).toBe(0);
    tooSmall.cancelLandscapeGesture();
    const doc = loaded([], { maxHistoryActions: 1 });
    height(doc);
    paint(doc);
    expect(doc.metrics.historyActions).toBe(1);
    expect(doc.undo()!.patches[0].kind).toBe("landscape");
    expect(doc.canUndo).toBe(false);
    expect(doc.sampleHeight(100, 100)).toBeGreaterThan(-100);
  });

  it("rejects an over-budget segment before changing any of its cells", () => {
    const doc = loaded([], { maxGestureCells: 1 });
    doc.beginLandscapeGesture({ level: 0, radius: 0.49, weights: FOREST });
    expect(() => doc.applyLandscapeSegment(POINT, [3.5, 2.5])).toThrow(
      /Zellbudget/,
    );
    expect(doc.metrics.sourceBytes).toBe(0);
    expect(doc.metrics.gestureCells).toBe(0);
    doc.applyLandscapeSegment(POINT, POINT);
    expect(() => doc.applyLandscapeSegment([3.5, 2.5], [3.5, 2.5])).toThrow(
      /Zellbudget/,
    );
    expect(doc.sampleLandscape(...POINT)).toEqual(FOREST);
    expect(doc.sampleLandscape(3.5, 2.5)).toEqual(CLEAR);
    doc.cancelLandscapeGesture();
    expect(doc.metrics.sourceBytes).toBe(0);
  });

  it("enforces the same atomic 512-source ceiling as the shared store", () => {
    const doc = loaded();
    doc.beginLandscapeGesture({ level: 0, radius: 0.1, weights: FOREST });
    expect(() =>
      doc.applyLandscapeSegment([0.5, 0.5], [64 * 512 + 0.5, 0.5]),
    ).toThrow(/512/);
    expect(doc.metrics.sourceBytes).toBe(0);
    expect(doc.metrics.gestureCells).toBe(0);
    doc.cancelLandscapeGesture();
  });

  it("evicts only confirmed sources and revokes their absence proofs", () => {
    const doc = loaded();
    const change = paint(doc)!;
    expect(doc.retainLandscapeSources([])).toEqual([]);
    doc.acknowledge(change);
    expect(doc.retainLandscapeSources([])).toEqual(["landscape:0:0:0"]);
    expect(doc.metrics.landscapeReadyTiles).toBe(0);
    expect(doc.readLandscapeCell(0, ...POINT)).toBeUndefined();
    expect(() => doc.sampleLandscape(...POINT)).toThrow(SourcesNotReadyError);
    const tiles = change.patches.flatMap((patch) =>
      patch.kind === "landscape" && patch.after ? [patch.after] : [],
    );
    doc.acceptLandscapeCoverage(LOCAL, tiles, change.sequence);
    expect(doc.sampleLandscape(...POINT)).toEqual(FOREST);
  });

  it("keeps active inherited contributors and restores history after source eviction", () => {
    const doc = loaded([full(4, FOREST)]);
    doc.beginLandscapeGesture({ level: 0, radius: 0.49, weights: CLEAR });
    doc.applyLandscapeSegment(POINT, POINT);
    expect(doc.retainLandscapeSources([])).toEqual([]);
    expect(doc.sampleLandscape(...POINT)).toEqual(CLEAR);
    const change = doc.finishLandscapeGesture()!;
    doc.acknowledge(change);
    doc.retainLandscapeSources([{ bounds: LOCAL, minLevel: 4 }]);
    expect(doc.landscapeSourceState("landscape:0:0:0")).toBe("unknown");
    doc.undo();
    expect(doc.readLandscapeCell(0, ...POINT)).toBeNull();
    doc.redo();
    expect(doc.readLandscapeCell(0, ...POINT)).toEqual(CLEAR);
  });

  it("does not resurrect old authors or absence after a deletion ACK", () => {
    const doc = loaded();
    const initial = paint(doc)!;
    const original = doc.landscapeSnapshot(LOCAL).tiles;
    doc.acknowledge(initial);
    const deletion = doc.undo()!;
    doc.acknowledge(deletion);
    doc.retainLandscapeSources([]);
    const generation = doc.generation;
    doc.acceptLandscapeCoverage(LOCAL, original, initial.sequence);
    expect(doc.generation).toBe(generation);
    expect(doc.readLandscapeCell(0, ...POINT)).toBeUndefined();
    expect(() => doc.landscapePatchesAfter(initial.sequence)).toThrow(
      /aktuell/,
    );
    doc.acceptLandscapeCoverage(LOCAL, [], deletion.sequence);
    expect(doc.readLandscapeCell(0, ...POINT)).toBeNull();
    doc.redo();
    expect(doc.sampleLandscape(...POINT)).toEqual(FOREST);
  });

  it("shares the stale read floor even when only a height action was acknowledged", () => {
    const doc = loaded();
    const change = height(doc);
    doc.acknowledge(change);
    const generation = doc.generation;
    doc.acceptLandscapeCoverage(LOCAL, [full(0, FOREST)], 0);
    expect(doc.generation).toBe(generation);
    expect(doc.sampleLandscape(...POINT)).toEqual(CLEAR);
    expect(() => doc.landscapePatchesAfter(0)).toThrow(/aktuell/);
    expect(doc.landscapePatchesAfter(change.sequence)).toEqual([]);
  });
});

describe("fully effective landscape interiors", () => {
  it.each([{ target: CLEAR }, { target: [0, 0, 166, 0] as LandscapeWeights }])(
    "reaches target $target after one non-centred stroke with a soft outer ring",
    ({ target }) => {
      const doc = loaded([full(6, [255, 0, 0, 0])]);
      doc.beginLandscapeGesture({ level: 0, radius: 8, weights: target });
      doc.applyLandscapeSegment([20.1, 20.3], [40.7, 20.3]);
      doc.finishLandscapeGesture();
      expect(doc.sampleLandscape(20.1, 20.3)).toEqual(target);
      expect(doc.sampleLandscape(40.7, 20.3)).toEqual(target);
      const rim = doc.sampleLandscape(30.5, 26.5);
      expect(rim[0]).toBeGreaterThan(0);
      expect(rim[0]).toBeLessThan(255);
      expect(doc.sampleLandscape(30.5, 29.5)).toEqual([255, 0, 0, 0]);
      expect(doc.sequence).toBe(1);
      expect(doc.metrics.historyActions).toBe(1);
    },
  );

  it("still multiplies the full interior by the chosen strength", () => {
    const doc = loaded([full(6, [255, 0, 0, 0])]);
    paint(doc, CLEAR, [20.1, 20.3], 0, 8, 0.5);
    expect(doc.sampleLandscape(20.1, 20.3)).toEqual([128, 0, 0, 0]);
  });

  it("produces identical mask and weights when the same path is subdivided", () => {
    const run = (path: Point[]) => {
      const doc = loaded([full(6, [150, 40, 20, 10])]);
      doc.beginLandscapeGesture({
        level: 0,
        radius: 8,
        weights: [0, 0, 166, 0],
        strength: 0.7,
      });
      for (let index = 1; index < path.length; index++)
        doc.applyLandscapeSegment(path[index - 1], path[index]);
      doc.finishLandscapeGesture();
      return doc
        .landscapeSnapshot([0, 0, 80, 40])
        .tiles.sort((a, b) => a.key.localeCompare(b.key))
        .map((tile) => ({
          key: tile.key,
          mask: tile.mask,
          values: tile.values,
        }));
    };
    expect(
      run([
        [20.1, 20.3],
        [60.7, 20.3],
      ]),
    ).toEqual(
      run([
        [20.1, 20.3],
        [30.2, 20.3],
        [30.2, 20.3],
        [45.5, 20.3],
        [60.7, 20.3],
      ]),
    );
  });

  it("paints the actual clipped centre of the final coarse world cell", () => {
    const doc = loaded();
    const step = 2 ** 24;
    const lastCellStart = Math.floor(WORLD_LIMIT / step) * step;
    const centre: Point = [(lastCellStart + WORLD_LIMIT) / 2, step / 2];
    paint(doc, FOREST, centre, 24, 0.49);
    expect(doc.sampleLandscape(WORLD_LIMIT, step / 2)).toEqual(FOREST);
    expect(doc.sampleLandscape(lastCellStart - 1, step / 2)).toEqual(CLEAR);
  });
});

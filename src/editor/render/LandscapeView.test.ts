import { describe, expect, it, vi } from "vitest";
import {
  applyTestBrush,
  beginTestBrush,
  finishTestBrush,
} from "../../../tests/support/prepaidBrush";
import {
  EditorDocument,
  WORLD_LIMIT,
  createLandscapeTile,
  landscapeCellAddress,
  type Bounds,
  type ChangeSet,
  type LandscapePatch,
  type LandscapeWeights,
} from "../model";
import {
  LANDSCAPE_OVERVIEW_BYTES,
  createLandscapeOverviewTile,
  landscapeOverviewKeys,
  type LandscapePresentationRead,
} from "../model/landscape";
import { LandscapeView, type LandscapeFrame } from "./LandscapeView";

const POWER = 2;
const AREA: Bounds = [0, 0, 512, 512];
const SAMPLE: [number, number] = [2, 2];
const FOREST: LandscapeWeights = [180, 0, 0, 0];
const CLEAR: LandscapeWeights = [0, 0, 0, 0];
const WORLD: Bounds = [-WORLD_LIMIT, -WORLD_LIMIT, WORLD_LIMIT, WORLD_LIMIT];

function author(level: number, weights: LandscapeWeights, x = 2, y = 2) {
  const at = landscapeCellAddress(level, x, y);
  const tile = createLandscapeTile(level, at.tileX, at.tileY);
  tile.mask[at.index] = 1;
  tile.values.set(weights, at.index * 4);
  return tile;
}

/** Fixed first texel fixture, independent of the product's overview update. */
function overview(level: number, weights: LandscapeWeights, tileX = 0) {
  const tile = createLandscapeOverviewTile(POWER, tileX, 0);
  tile.sourceLevels[0] = level;
  tile.rest[0] = 0;
  tile.own.set(weights, 0);
  return tile;
}

function read(
  doc: EditorDocument,
  sequence: number,
  overviews: LandscapePresentationRead["overviews"] = [],
  bounds = AREA,
): LandscapePresentationRead {
  return {
    sessionId: doc.sessionId,
    sequence,
    bounds: [...bounds],
    power: POWER,
    tiles: [],
    overviewKeys: landscapeOverviewKeys(bounds, POWER),
    overviews,
  };
}

function prepared(frame: LandscapeFrame | null) {
  if (!frame) return () => CLEAR;
  const work = frame.prepare();
  let next = work.next();
  while (!next.done) next = work.next();
  return next.value;
}

function paint(doc: EditorDocument, weights: LandscapeWeights, level = 0) {
  const point: [number, number] = level === 0 ? [2.5, 2.5] : [8, 8];
  doc.beginLandscapeGesture({ level, radius: level === 0 ? 0.49 : 1, weights });
  doc.applyLandscapeSegment(point, point);
  return doc.finishLandscapeGesture()!;
}

function changed(view: LandscapeView, change: ChangeSet) {
  view.changed(
    change.dirtyBounds[0],
    change.sequence,
    change.patches.filter(
      (patch): patch is LandscapePatch & { kind: "landscape" } =>
        patch.kind === "landscape",
    ),
  );
}

function loadedForest(middle = false) {
  const doc = new EditorDocument("landscape-view", { empty: true });
  doc.acceptLandscapeCoverage(WORLD, [
    author(4, FOREST),
    ...(middle ? [author(1, [0, 90, 0, 0])] : []),
  ]);
  const view = new LandscapeView(doc, false);
  view.accept(read(doc, 0, middle ? [overview(1, [0, 90, 0, 0])] : []));
  return { doc, view };
}

function evictedClearing() {
  const { doc, view } = loadedForest(true);
  const clearing = paint(doc, CLEAR);
  doc.acknowledge(clearing);
  changed(view, clearing);
  view.accept(read(doc, clearing.sequence, [overview(0, CLEAR)]));
  doc.retainLandscapeSources([{ bounds: AREA, minLevel: 2 }]);
  const undo = doc.undo()!;
  changed(view, undo);
  return { doc, view, undo };
}

describe("immutable landscape presentation frames", () => {
  it("keeps both new and certified loaded empty views sparse", () => {
    const fresh = new EditorDocument("new", {
      empty: true,
      landscapeEmpty: true,
    });
    const newView = new LandscapeView(fresh, true);
    expect(newView.ready(AREA, POWER)).toBe(true);
    expect(newView.freeze(AREA, POWER)).toBeNull();
    expect(newView.retainedBuffers().size).toBe(0);
    const opened = new EditorDocument("opened", { empty: true });
    opened.acceptLandscapeCoverage(AREA, []);
    const loaded = new LandscapeView(opened, false);
    loaded.accept(read(opened, 0));
    expect(loaded.ready(AREA, POWER)).toBe(true);
    expect(loaded.freeze(AREA, POWER)).toBeNull();
    expect(loaded.retainedBuffers().size).toBe(0);
  });

  it("freezes live/coarse inputs before later edits, cancel and ACK, even if preparation starts afterward", () => {
    const { doc, view } = loadedForest();
    const initial = view.freeze(AREA, POWER)!;
    const clearing = paint(doc, CLEAR);
    changed(view, clearing);
    const clearFrame = view.freeze(AREA, POWER)!;
    const coarse = paint(doc, [0, 90, 0, 0], 4);
    changed(view, coarse);
    const coarseFrame = view.freeze(AREA, POWER)!;
    doc.beginLandscapeGesture({
      level: 0,
      radius: 0.49,
      weights: [0, 0, 200, 0],
    });
    const liveUpdate = doc.applyLandscapeSegment([2.5, 2.5], [2.5, 2.5])!;
    view.changed(liveUpdate.bounds, undefined, liveUpdate.patches);
    const liveFrame = view.freeze(AREA, POWER)!;
    const cancelUpdate = doc.cancelLandscapeGesture()!;
    view.changed(cancelUpdate.bounds, undefined, cancelUpdate.patches);
    const cancelled = view.freeze(AREA, POWER)!;
    doc.acknowledge(clearing);
    doc.acknowledge(coarse);
    expect(prepared(initial)(...SAMPLE)).toEqual(FOREST);
    expect(prepared(clearFrame)(...SAMPLE)).toEqual(CLEAR);
    expect(prepared(coarseFrame)(...SAMPLE)).toEqual(CLEAR);
    expect(prepared(coarseFrame)(6, 2)).toEqual([0, 90, 0, 0]);
    expect(prepared(liveFrame)(...SAMPLE)).toEqual([0, 0, 200, 0]);
    expect(prepared(cancelled)(...SAMPLE)).toEqual(CLEAR);
  });

  it("keeps exact projected content and its frame when a local change is acknowledged", () => {
    const { doc, view } = loadedForest();
    const change = paint(doc, [0, 0, 100, 0]);
    changed(view, change);
    const frame = view.freeze(AREA, POWER)!;
    const sample = prepared(frame);
    const retained = [...frame.buffers];
    expect(sample(...SAMPLE)).toEqual([0, 0, 100, 0]);
    expect(view.freeze(AREA, POWER)).toBe(frame);
    expect(prepared(frame)).toBe(sample);
    expect([...frame.buffers]).toEqual(retained);
    doc.acknowledge(change);
    expect(() => view.ready(AREA, POWER)).not.toThrow();
    expect(view.ready(AREA, POWER)).toBe(true);
    expect(view.freeze(AREA, POWER)).toBe(frame);
    expect(
      view.accept(read(doc, change.sequence, [overview(0, [0, 0, 100, 0])])),
    ).toEqual([]);
    expect(view.ready(AREA, POWER)).toBe(true);
    expect(prepared(view.freeze(AREA, POWER))(...SAMPLE)).toEqual([
      0, 0, 100, 0,
    ]);
    expect(doc.landscapePatchesAfter(change.sequence)).toEqual([]);
    expect(sample(...SAMPLE)).toEqual([0, 0, 100, 0]);
  });

  it("retains current landscape after an unrelated height ACK without a reread", () => {
    const { doc, view } = loadedForest();
    const frozen = view.freeze(AREA, POWER)!;
    beginTestBrush(doc, { level: 0, radius: 20, amount: 5 });
    applyTestBrush(doc, [100, 100], [100, 100], 50);
    const change = finishTestBrush(doc)!;
    doc.acknowledge(change);
    expect(() => view.ready(AREA, POWER)).not.toThrow();
    expect(view.ready(AREA, POWER)).toBe(true);
    expect(view.accept(read(doc, 0))).toEqual([]);
    expect(view.freeze(AREA, POWER)).toBe(frozen);
    expect(view.ready(AREA, POWER)).toBe(true);
    view.accept(read(doc, change.sequence));
    expect(view.ready(AREA, POWER)).toBe(true);
    expect(prepared(view.freeze(AREA, POWER))(...SAMPLE)).toEqual(FOREST);
    expect(prepared(frozen)(...SAMPLE)).toEqual(FOREST);
  });

  it("updates only the touched tile and merges exact dirty texels without replaying the stroke", () => {
    const doc = new EditorDocument("local", { empty: true });
    doc.acceptLandscapeCoverage(WORLD, [author(24, FOREST)]);
    const view = new LandscapeView(doc, false);
    const remote: Bounds = [512, 0, 1024, 512];
    view.accept(read(doc, 0, [], [0, 0, 1024, 512]));
    const initial = view.freeze(AREA, POWER)!;
    const other = view.freeze(remote, POWER)!;
    const replay = vi.spyOn(doc, "landscapePatchesAfter");
    doc.beginLandscapeGesture({ level: 0, radius: 0.49, weights: CLEAR });
    const points: [number, number][] = [
      [2.5, 2.5],
      [10.5, 2.5],
    ];
    for (const point of points) {
      const update = doc.applyLandscapeSegment(point, point)!;
      view.changed(update.bounds, undefined, update.patches);
    }
    const updated = view.freeze(AREA, POWER)!;
    expect(updated.previousVersion).toBe(initial.version);
    expect(updated.dirty).toEqual([0, 0, 3, 1]);
    expect(view.freeze(remote, POWER)).toBe(other);
    expect(replay).not.toHaveBeenCalled();
    expect(prepared(updated)(2, 2)).toEqual(CLEAR);
    expect(prepared(updated)(10, 2)).toEqual(CLEAR);
    expect(prepared(updated)(6, 2)).toEqual(FOREST);
    expect(prepared(initial)(2, 2)).toEqual(FOREST);
    const finish = doc.finishLandscapeGesture()!;
    expect(view.changed(finish.dirtyBounds[0], finish.sequence, [])).toEqual(
      [],
    );
    doc.acknowledge(finish);
    expect(view.ready(AREA, POWER)).toBe(true);
    expect(view.freeze(AREA, POWER)).toBe(updated);
    expect(replay).not.toHaveBeenCalled();
  });

  it("ignores an older in-flight read and keeps an acknowledged fine clearing during later coarse painting", () => {
    const { doc, view } = loadedForest();
    const clearing = paint(doc, CLEAR);
    changed(view, clearing);
    const clearFrame = view.freeze(AREA, POWER)!;
    expect(view.accept(read(doc, 0))).toEqual([]);
    expect(view.freeze(AREA, POWER)).toBe(clearFrame);
    doc.acknowledge(clearing);
    const patches = vi.spyOn(doc, "landscapePatchesAfter");
    const coarse = paint(doc, [0, 90, 0, 0], 4);
    changed(view, coarse);
    expect(view.ready(AREA, POWER)).toBe(true);
    const next = view.freeze(AREA, POWER)!;
    expect(next.previousVersion).toBe(clearFrame.version);
    expect(prepared(next)(...SAMPLE)).toEqual(CLEAR);
    expect(prepared(next)(6, 2)).toEqual([0, 90, 0, 0]);
    expect(patches).not.toHaveBeenCalled();
    expect(view.accept(read(doc, 0))).toEqual([]);
    expect(view.freeze(AREA, POWER)).toBe(next);
  });

  it("reconstructs an unseen tile from current borrowed edits before their ACK", () => {
    const doc = new EditorDocument("cold", { empty: true });
    doc.acceptLandscapeCoverage(WORLD, [author(4, FOREST)]);
    const clearing = paint(doc, CLEAR);
    const view = new LandscapeView(doc, false);
    changed(view, clearing);
    view.accept(read(doc, 0));
    const frame = view.freeze(AREA, POWER)!;
    expect(frame.previousVersion).toBeNull();
    expect(frame.dirty).toEqual([0, 0, 128, 128]);
    expect(prepared(frame)(...SAMPLE)).toEqual(CLEAR);
    doc.acknowledge(clearing);
    expect(view.ready(AREA, POWER)).toBe(true);
    expect(view.freeze(AREA, POWER)).toBe(frame);
  });

  it("includes the closed positive world-edge texel in incremental dirty bounds", () => {
    const power = 9;
    const step = 2 ** power;
    const span = 128 * step;
    const from = Math.floor(WORLD_LIMIT / span) * span;
    const area: Bounds = [from, from, from + span, from + span];
    const clipped: Bounds = [from, from, WORLD_LIMIT, WORLD_LIMIT];
    const doc = new EditorDocument("edge", { empty: true });
    doc.acceptLandscapeCoverage(WORLD, [
      author(24, FOREST, WORLD_LIMIT, WORLD_LIMIT),
    ]);
    const view = new LandscapeView(doc, false);
    view.accept({
      ...read(doc, 0),
      bounds: clipped,
      power,
      overviewKeys: landscapeOverviewKeys(clipped, power),
    });
    const initial = view.freeze(area, power)!;
    doc.beginLandscapeGesture({ level: 0, radius: 0.49, weights: CLEAR });
    const point: [number, number] = [WORLD_LIMIT - 0.5, WORLD_LIMIT - 0.5];
    const update = doc.applyLandscapeSegment(point, point)!;
    view.changed(update.bounds, undefined, update.patches);
    const frame = view.freeze(area, power)!;
    const index = Math.floor((WORLD_LIMIT - from) / step);
    expect(frame.previousVersion).toBe(initial.version);
    expect(frame.dirty).toEqual([index, index, index + 1, index + 1]);
    expect(prepared(initial)(WORLD_LIMIT, WORLD_LIMIT)).toEqual(FOREST);
    expect(prepared(frame)(WORLD_LIMIT, WORLD_LIMIT)).toEqual(CLEAR);
  });

  it("undoes a clearing through the next fine owner before coarse fallback", () => {
    const { doc, view } = loadedForest(true);
    const clearing = paint(doc, CLEAR);
    doc.acknowledge(clearing);
    changed(view, clearing);
    view.accept(read(doc, clearing.sequence, [overview(0, CLEAR)]));
    const undo = doc.undo()!;
    changed(view, undo);
    expect(view.ready(AREA, POWER)).toBe(true);
    expect(prepared(view.freeze(AREA, POWER))(...SAMPLE)).toEqual([
      0, 90, 0, 0,
    ]);
  });

  it("requires a current store overview for unknown fine fallback without loading fine authors", () => {
    const { doc, view, undo } = evictedClearing();
    const reads = vi.spyOn(doc, "landscapeSources");
    expect(doc.readLandscapeCell(1, ...SAMPLE)).toBeUndefined();
    expect(view.ready(AREA, POWER)).toBe(false);
    expect(() => view.freeze(AREA, POWER)).toThrow(/bereit/);
    expect(reads).not.toHaveBeenCalled();
    doc.acknowledge(undo);
    doc.acceptLandscapeCoverage(
      AREA,
      [author(4, FOREST)],
      undo.sequence,
      doc.sessionId,
      2,
    );
    view.accept(read(doc, undo.sequence, [overview(1, [0, 90, 0, 0])]));
    expect(view.ready(AREA, POWER)).toBe(true);
    expect(prepared(view.freeze(AREA, POWER))(...SAMPLE)).toEqual([
      0, 90, 0, 0,
    ]);
    expect(doc.readLandscapeCell(1, ...SAMPLE)).toBeUndefined();
    expect(reads.mock.calls.every(([, minLevel]) => minLevel === 2)).toBe(true);
  });

  it("retains only the last known overview when unknown fallback requires a reread", () => {
    const { view } = evictedClearing();
    expect(view.ready(AREA, POWER)).toBe(false);
    const retained = [...view.retainedBuffers()].reduce(
      (sum, buffer) => sum + buffer.byteLength,
      0,
    );
    expect(retained).toBe(LANDSCAPE_OVERVIEW_BYTES);
  });

  it("retains one working overview when cooperative preparation is restarted", () => {
    const doc = new EditorDocument("restarted", {
      empty: true,
      landscapeEmpty: true,
    });
    const view = new LandscapeView(doc, true);
    const change = paint(doc, FOREST);
    changed(view, change);
    const frame = view.freeze(AREA, POWER)!;
    const first = frame.prepare();
    expect(first.next().done).toBe(true);
    const buffers = [...frame.buffers];
    for (let restart = 0; restart < 6; restart++) {
      expect(prepared(frame)(...SAMPLE)).toEqual(FOREST);
      expect([...frame.buffers]).toEqual(buffers);
      expect(view.retainedBuffers().size).toBe(buffers.length);
    }
    expect(prepared(frame)(...SAMPLE)).toEqual(FOREST);
  });

  it("bounds cached frames to 96 and releases bases outside the next view", () => {
    const doc = new EditorDocument("bounded", {
      empty: true,
      landscapeEmpty: true,
    });
    const view = new LandscapeView(doc, true);
    doc.beginLandscapeGesture({ level: 24, radius: 1, weights: FOREST });
    doc.applyLandscapeSegment([2 ** 23, 2 ** 23], [2 ** 23, 2 ** 23]);
    const change = doc.finishLandscapeGesture()!;
    changed(view, change);
    const area = (index: number): Bounds => [
      index * 512,
      0,
      (index + 1) * 512,
      512,
    ];
    const frames = Array.from({ length: 100 }, (_, index) =>
      view.freeze(area(index), POWER),
    );
    expect(view.freeze(area(99), POWER)).toBe(frames[99]);
    expect(view.freeze(area(4), POWER)).toBe(frames[4]);
    expect(view.freeze(area(3), POWER)).not.toBe(frames[3]);
    doc.acknowledge(change);
    const a = overview(0, FOREST),
      b = overview(0, CLEAR, 1);
    const loaded = new LandscapeView(doc, false);
    loaded.accept(read(doc, change.sequence, [a, b], [0, 0, 1024, 512]));
    expect(loaded.retainedBuffers().has(a.own.buffer)).toBe(true);
    loaded.accept(read(doc, change.sequence, [b], area(1)));
    expect(loaded.retainedBuffers().has(a.own.buffer)).toBe(false);
    expect(loaded.retainedBuffers().has(b.own.buffer)).toBe(true);
  });

  it("rejects another session without replacing the current immutable base", () => {
    const { doc, view } = loadedForest();
    const frame = view.freeze(AREA, POWER);
    expect(() =>
      view.accept({ ...read(doc, 0), sessionId: "foreign" }),
    ).toThrow(/Sitzung/);
    expect(view.freeze(AREA, POWER)).toBe(frame);
    expect(prepared(frame)(...SAMPLE)).toEqual(FOREST);
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  applyTestBrush,
  beginTestBrush,
  finishTestBrush,
} from "../../../tests/support/prepaidBrush";
import {
  EditorDocument,
  LANDSCAPE_TILE_BYTES,
  WORLD_LIMIT,
  createLandscapeTile,
  landscapeCellAddress,
  type Bounds,
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
  view.changed(clearing.sequence);
  view.accept(read(doc, clearing.sequence, [overview(0, CLEAR)]));
  doc.retainLandscapeSources([{ bounds: AREA, minLevel: 2 }]);
  const undo = doc.undo()!;
  view.changed(undo.sequence);
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
    view.changed(clearing.sequence);
    const clearFrame = view.freeze(AREA, POWER)!;
    const coarse = paint(doc, [0, 90, 0, 0], 4);
    view.changed(coarse.sequence);
    const coarseFrame = view.freeze(AREA, POWER)!;
    doc.beginLandscapeGesture({
      level: 0,
      radius: 0.49,
      weights: [0, 0, 200, 0],
    });
    doc.applyLandscapeSegment([2.5, 2.5], [2.5, 2.5]);
    view.changed();
    const liveFrame = view.freeze(AREA, POWER)!;
    doc.cancelLandscapeGesture();
    view.changed();
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

  it("reuses one completed rebase and replaces it with the matching committed overview after ACK", () => {
    const { doc, view } = loadedForest();
    const change = paint(doc, [0, 0, 100, 0]);
    view.changed(change.sequence);
    const frame = view.freeze(AREA, POWER)!;
    const sample = prepared(frame);
    const retained = [...frame.buffers];
    expect(sample(...SAMPLE)).toEqual([0, 0, 100, 0]);
    expect(view.freeze(AREA, POWER)).toBe(frame);
    expect(prepared(frame)).toBe(sample);
    expect([...frame.buffers]).toEqual(retained);
    doc.acknowledge(change);
    expect(() => view.ready(AREA, POWER)).not.toThrow();
    expect(view.ready(AREA, POWER)).toBe(false);
    view.accept(read(doc, change.sequence, [overview(0, [0, 0, 100, 0])]));
    expect(view.ready(AREA, POWER)).toBe(true);
    expect(prepared(view.freeze(AREA, POWER))(...SAMPLE)).toEqual([
      0, 0, 100, 0,
    ]);
    expect(doc.landscapePatchesAfter(change.sequence)).toEqual([]);
    expect(sample(...SAMPLE)).toEqual([0, 0, 100, 0]);
  });

  it("treats an old landscape base as unknown after an unrelated height ACK", () => {
    const { doc, view } = loadedForest();
    const frozen = view.freeze(AREA, POWER)!;
    beginTestBrush(doc, { level: 0, radius: 20, amount: 5 });
    applyTestBrush(doc, [100, 100], [100, 100], 50);
    const change = finishTestBrush(doc)!;
    doc.acknowledge(change);
    expect(() => view.ready(AREA, POWER)).not.toThrow();
    expect(view.ready(AREA, POWER)).toBe(false);
    view.accept(read(doc, 0));
    expect(view.ready(AREA, POWER)).toBe(false);
    view.accept(read(doc, change.sequence));
    expect(view.ready(AREA, POWER)).toBe(true);
    expect(prepared(view.freeze(AREA, POWER))(...SAMPLE)).toEqual(FOREST);
    expect(prepared(frozen)(...SAMPLE)).toEqual(FOREST);
  });

  it("undoes a clearing through the next fine owner before coarse fallback", () => {
    const { doc, view } = loadedForest(true);
    const clearing = paint(doc, CLEAR);
    doc.acknowledge(clearing);
    view.changed(clearing.sequence);
    view.accept(read(doc, clearing.sequence, [overview(0, CLEAR)]));
    const undo = doc.undo()!;
    view.changed(undo.sequence);
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

  it("accounts for pending snapshot buffers even when fallback prevents a ready frame", () => {
    const { view } = evictedClearing();
    expect(view.ready(AREA, POWER)).toBe(false);
    const retained = [...view.retainedBuffers()].reduce(
      (sum, buffer) => sum + buffer.byteLength,
      0,
    );
    expect(retained).toBe(LANDSCAPE_OVERVIEW_BYTES + LANDSCAPE_TILE_BYTES);
  });

  it("retains one working overview when cooperative preparation is restarted", () => {
    const doc = new EditorDocument("restarted", {
      empty: true,
      landscapeEmpty: true,
    });
    const view = new LandscapeView(doc, true);
    const change = paint(doc, FOREST);
    view.changed(change.sequence);
    const frame = view.freeze(AREA, POWER)!;
    const first = frame.prepare();
    expect(first.next().done).toBe(false);
    const buffers = [...frame.buffers];
    for (let restart = 0; restart < 6; restart++) {
      expect(prepared(frame)(...SAMPLE)).toEqual(FOREST);
      expect([...frame.buffers]).toEqual(buffers);
      expect(view.retainedBuffers().size).toBe(buffers.length);
    }
    const resumed = first.next();
    expect(resumed.done).toBe(true);
    expect(resumed.value).toBe(prepared(frame));
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
    view.changed(change.sequence);
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
    view.accept(read(doc, change.sequence, [a, b], [0, 0, 1024, 512]));
    expect(view.retainedBuffers().has(a.own.buffer)).toBe(true);
    view.accept(read(doc, change.sequence, [b], area(1)));
    expect(view.retainedBuffers().has(a.own.buffer)).toBe(false);
    expect(view.retainedBuffers().has(b.own.buffer)).toBe(true);
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

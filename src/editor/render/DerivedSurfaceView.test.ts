import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyTestBrush,
  beginTestBrush,
  finishTestBrush,
} from "../../../tests/support/prepaidBrush";
import {
  EditorDocument,
  WORLD_LIMIT,
  heightTilesFromControls,
  type Bounds,
  type ChangeSet,
  type EditorDocumentOptions,
  type HouseHeader,
  type LakeSource,
} from "../model";
import type { HeightDependency } from "../model/content-identity";
import * as surfaceMath from "../model/surface";
import {
  DerivedSurfaceView,
  type SurfaceData,
  type SurfaceFrame,
} from "./DerivedSurfaceView";

const AREA: Bounds = [-64, -64, 64, 64];
const DEPENDENCY: Bounds = [-80, -80, 80, 80];
const FAR: Bounds = [10_000, 10_000, 10_128, 10_128];
const WORLD: Bounds = [-WORLD_LIMIT, -WORLD_LIMIT, WORLD_LIMIT, WORLD_LIMIT];
const MIB = 1024 * 1024;

function document(options: EditorDocumentOptions = {}) {
  return new EditorDocument("derived-surface", {
    empty: true,
    housesEmpty: true,
    watersEmpty: true,
    ...options,
  });
}

/** The empty all-level byte stream is an independent, fixed identity oracle. */
function emptyDependency(bounds: Bounds = DEPENDENCY): HeightDependency {
  const coordinates = Buffer.alloc(32);
  bounds.forEach((value, index) => coordinates.writeDoubleLE(value, index * 8));
  return {
    kind: "height",
    bounds: [...bounds],
    identity: `height-controls-v1:${createHash("sha256")
      .update("height-controls-v1\0")
      .update(coordinates)
      .digest("hex")}`,
  };
}

function lake(values: Partial<LakeSource> = {}): LakeSource {
  return {
    kind: "lake",
    id: "lake",
    revision: 0,
    name: "Testsee",
    level: 10,
    rings: [
      [
        [-24, -24],
        [24, -24],
        [24, 24],
        [-24, 24],
      ],
    ],
    terrain: emptyDependency(),
    ...values,
  };
}

function house(values: Partial<HouseHeader> = {}): HouseHeader {
  return {
    id: "house",
    revision: 0,
    x: 0,
    y: 0,
    width: 10,
    depth: 10,
    rotation: 0,
    foundationHeight: 1,
    foundationTransition: 10,
    ...values,
  };
}

const views: DerivedSurfaceView[] = [];
function viewFor(doc: EditorDocument, changed = vi.fn()) {
  const view = new DerivedSurfaceView(doc, changed);
  views.push(view);
  view.sync(AREA, 1);
  return view;
}

afterEach(() => {
  views.splice(0).forEach((view) => view.destroy());
  vi.restoreAllMocks();
});

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
async function drain(view: DerivedSurfaceView) {
  for (let index = 0; index < 4096; index++) {
    view.step(Infinity, 256);
    await flush();
    if (!view.pending) return;
    if (view.readNeed())
      throw new Error("Fixture attempted to derive unknown sources.");
  }
  throw new Error("Derived surface did not finish its bounded work.");
}

function finish<T>(work: Generator<void, T, void>): T {
  let result = work.next();
  for (let index = 0; !result.done; index++) {
    if (index > 100_000) throw new Error("Surface preparation did not finish.");
    result = work.next();
  }
  return result.value;
}

function prepared(frame: SurfaceFrame | null): SurfaceData {
  if (!frame) throw new Error("Expected a real derived surface frame.");
  return finish(frame.prepare());
}

function heightEdit(doc: EditorDocument): ChangeSet {
  beginTestBrush(doc, { level: 0, radius: 15, amount: 20 });
  applyTestBrush(doc, [0, 0], [0, 0], 50);
  const change = finishTestBrush(doc);
  if (!change) throw new Error("Fixture must change genuine height authors.");
  return change;
}

function invalidate(view: DerivedSurfaceView, change: ChangeSet) {
  change.dirtyBounds.forEach((bounds) => view.invalidate(bounds));
}

function deferredDigests() {
  const pending: {
    bytes: Uint8Array;
    resolve(value: ArrayBuffer): void;
    reject(error: Error): void;
  }[] = [];
  vi.spyOn(crypto.subtle, "digest").mockImplementation((_algorithm, input) => {
    const bytes = ArrayBuffer.isView(input)
      ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength).slice()
      : new Uint8Array(input).slice();
    return new Promise<ArrayBuffer>((resolve, reject) =>
      pending.push({ bytes, resolve, reject }),
    );
  });
  const resolve = (index: number) => {
    const digest = createHash("sha256").update(pending[index].bytes).digest();
    pending[index].resolve(Uint8Array.from(digest).buffer);
    return `height-controls-v1:${digest.toString("hex")}`;
  };
  return { pending, resolve };
}

const bytes = (buffers: Set<ArrayBufferLike>) =>
  [...buffers].reduce((total, buffer) => total + buffer.byteLength, 0);

describe("complete local surface dependencies", () => {
  it("keeps unknown fine sources unknown although coarse absence and water geometry are loaded", async () => {
    const doc = document({ empty: false });
    doc.acceptWaterCoverage(WORLD, [lake()]);
    doc.acceptCoverage(DEPENDENCY, [], 0, doc.sessionId, 1);
    const view = viewFor(doc);
    expect(view.state()).toMatchObject({
      ready: false,
      water: [{ status: "unknown", currentIdentity: null }],
    });
    expect(view.readNeed()).toEqual({
      key: "water:lake",
      version: expect.any(Number),
      kind: "height",
      bounds: DEPENDENCY,
    });
    expect(view.retainHeightBounds()).toEqual(DEPENDENCY);
    expect(view.step(Infinity, 100)).toBe(0);
    // Confirmed geometry may be drawn, but does not certify its hydrological age.
    expect(prepared(view.freeze(AREA, 0)).lakeLayers).toBe(1);
    expect(view.state().ready).toBe(false);
    doc.acceptCoverage(DEPENDENCY, []);
    await drain(view);
    expect(view.state()).toMatchObject({
      ready: true,
      water: [
        { status: "current", currentIdentity: emptyDependency().identity },
      ],
    });
  });

  it("requires water and all terrain sources for the complete partially visible footprint", async () => {
    const doc = document({ empty: false, watersEmpty: false });
    const value = house({ x: 60, width: 160, depth: 20 });
    const footprint: Bounds = [-20, -10, 140, 10];
    doc.acceptHouseCoverage(WORLD, [value]);
    doc.acceptWaterCoverage(AREA, []);
    const view = viewFor(doc);
    expect(view.readNeed()).toEqual({
      key: "foundation:house",
      version: expect.any(Number),
      kind: "water",
      bounds: footprint,
    });
    expect(view.state().foundations[0]).toMatchObject({
      ready: false,
      base: null,
      top: null,
    });
    expect(view.freeze(AREA, 0)).toBeNull();
    doc.acceptWaterCoverage(footprint, []);
    view.sync(AREA, 1);
    expect(view.readNeed()).toEqual({
      key: "foundation:house",
      version: expect.any(Number),
      kind: "height",
      bounds: footprint,
    });
    doc.acceptCoverage(footprint, []);
    await drain(view);
    expect(view.state().foundations[0]).toMatchObject({ ready: true });
    expect(view.state().foundations[0].base).toBeCloseTo(-100, 9);
  });

  it("retains a nearby offscreen house whose transition contributes inside the view", () => {
    const doc = document({ empty: false });
    doc.acceptHouseCoverage(WORLD, [
      house({ x: 90, width: 20, depth: 20, foundationTransition: 30 }),
    ]);
    const view = viewFor(doc);
    expect(DerivedSurfaceView.houseReadBounds(AREA)).toEqual([
      -564, -564, 564, 564,
    ]);
    expect(view.state().foundations.map((entry) => entry.id)).toEqual([
      "house",
    ]);
    expect(view.readNeed()?.bounds).toEqual([80, -10, 100, 10]);
    expect(view.retainWaterBounds()).toEqual([AREA, [80, -10, 100, 10]]);
  });

  it("restores current A after a real B edit and Undo despite increasing runtime revisions", async () => {
    const doc = document();
    doc.acceptWaterCoverage(WORLD, [lake()]);
    const view = viewFor(doc);
    await drain(view);
    const a = view.state().water[0].currentIdentity;
    expect(a).toBe(emptyDependency().identity);
    const edit = heightEdit(doc);
    invalidate(view, edit);
    expect(view.state().water[0].status).toBe("unknown");
    await drain(view);
    const b = view.state().water[0].currentIdentity;
    expect(b).not.toBe(a);
    expect(view.state().water[0].status).toBe("stale");
    const undo = doc.undo()!;
    expect(undo.revision).toBeGreaterThan(edit.revision);
    invalidate(view, undo);
    await drain(view);
    expect(view.state().water[0]).toMatchObject({
      status: "current",
      currentIdentity: a,
    });
    invalidate(view, doc.redo()!);
    await drain(view);
    expect(view.state().water[0]).toMatchObject({
      status: "stale",
      currentIdentity: b,
    });
  });

  it("does not invalidate a local hydrology proof for a disjoint terrain change", async () => {
    const doc = document();
    doc.acceptWaterCoverage(WORLD, [lake()]);
    const changed = vi.fn();
    const view = viewFor(doc, changed);
    await drain(view);
    const stable = view.state(),
      version = view.version;
    changed.mockClear();
    view.invalidate(FAR);
    expect(view.state()).toBe(stable);
    expect(view.version).toBe(version);
    expect(view.pending).toBe(false);
    expect(changed).not.toHaveBeenCalled();
  });
});

describe("obsolete surface work and navigation", () => {
  it("never publishes an older digest over a changed local source", async () => {
    const digests = deferredDigests();
    const doc = document();
    doc.acceptWaterCoverage(WORLD, [lake()]);
    const view = viewFor(doc);
    view.step(Infinity, 10_000);
    expect(digests.pending).toHaveLength(1);
    invalidate(view, heightEdit(doc));
    for (let index = 0; index < 10; index++) {
      view.invalidate(DEPENDENCY);
      view.step(Infinity, 10_000);
    }
    // WebCrypto cannot be cancelled: its input remains counted in the sole
    // slot, and repeated invalidations must not create an asynchronous queue.
    expect(digests.pending).toHaveLength(1);
    expect(bytes(view.retainedBuffers())).toBe(
      digests.pending[0].bytes.byteLength,
    );
    digests.resolve(0);
    await flush();
    expect(view.state().water[0]).toMatchObject({
      status: "unknown",
      currentIdentity: null,
    });
    expect(view.pending).toBe(true);
    view.step(Infinity, 10_000);
    expect(digests.pending).toHaveLength(2);
    const current = digests.resolve(1);
    await flush();
    expect(view.state().water[0]).toMatchObject({
      status: "stale",
      currentIdentity: current,
    });
    expect(view.pending).toBe(false);
    expect(view.retainedBuffers().size).toBe(0);
  });

  it.each(["resolve", "reject"] as const)(
    "ignores a late %s after cold navigation and can restore the source on return",
    async (completion) => {
      const digests = deferredDigests();
      const doc = document();
      const source = lake();
      doc.acceptWaterCoverage(WORLD, [source]);
      const changed = vi.fn();
      const view = viewFor(doc, changed);
      view.step(Infinity, 10_000);
      expect(digests.pending).toHaveLength(1);
      doc.retainWaterSources([FAR]);
      doc.retainHouseSources([DerivedSurfaceView.houseReadBounds(FAR)]);
      doc.retainSources([{ bounds: FAR, minLevel: 0 }]);
      view.sync(FAR, 1);
      view.step(Infinity, 100);
      expect(view.state()).toMatchObject({
        ready: true,
        water: [],
        foundations: [],
      });
      expect(bytes(view.retainedBuffers())).toBe(
        digests.pending[0].bytes.byteLength,
      );
      changed.mockClear();
      if (completion === "resolve") digests.resolve(0);
      else digests.pending[0].reject(new Error("Late old-area failure"));
      await flush();
      expect(changed).not.toHaveBeenCalled();
      expect(view.retainedBuffers().size).toBe(0);
      expect(view.state()).toMatchObject({
        ready: true,
        water: [],
        foundations: [],
      });
      view.sync(AREA, 1);
      expect(view.state().ready).toBe(false);
      expect(view.sample([0, 0], -100)).toBeNull();
      doc.acceptHouseCoverage(DerivedSurfaceView.houseReadBounds(AREA), []);
      doc.acceptWaterCoverage(AREA, [source]);
      doc.acceptCoverage(DEPENDENCY, []);
      view.sync(AREA, 1);
      view.step(Infinity, 10_000);
      expect(digests.pending).toHaveLength(2);
      digests.resolve(1);
      await flush();
      expect(view.state()).toMatchObject({
        ready: true,
        water: [{ id: "lake", status: "current" }],
      });
    },
  );

  it.each(["resolve", "reject"] as const)(
    "keeps a disposed digest counted until its late %s without publishing it",
    async (completion) => {
      const digests = deferredDigests();
      const doc = document();
      doc.acceptWaterCoverage(WORLD, [lake()]);
      const changed = vi.fn();
      const view = viewFor(doc, changed);
      view.step(Infinity, 10_000);
      prepared(view.freeze(AREA, 0));
      const inputBytes = digests.pending[0].bytes.byteLength;
      expect(bytes(view.retainedBuffers())).toBeGreaterThan(inputBytes);
      expect(view.pendingDigest).toBe(true);
      expect(view.retainedMetadataBytes).toBe(0);
      view.destroy();
      changed.mockClear();
      expect(view.pendingDigest).toBe(true);
      expect(view.pending).toBe(true);
      expect(bytes(view.retainedBuffers())).toBe(inputBytes);
      // The uncancellable closure retains one bounded water author, while its
      // old document and all raster/foundation state have been released.
      expect(view.retainedMetadataBytes).toBe(128 * 1024);
      expect(view.nextPreparationBytes).toEqual({ cpuBytes: 0, gpuBytes: 0 });
      expect(view.step(Infinity, 10_000)).toBe(0);
      expect(digests.pending).toHaveLength(1);
      if (completion === "resolve") digests.resolve(0);
      else digests.pending[0].reject(new Error("Disposed digest failure"));
      await flush();
      expect(view.pending).toBe(false);
      expect(view.pendingDigest).toBe(false);
      expect(view.retainedMetadataBytes).toBe(0);
      expect(view.retainedBuffers().size).toBe(0);
      expect(changed).not.toHaveBeenCalled();
    },
  );

  it("ignores obsolete read failures after a house moves away and returns to the same bounds", () => {
    const doc = document({ empty: false });
    doc.acceptHouseCoverage(WORLD, [house()]);
    const view = viewFor(doc);
    const before = view.readNeed()!;
    doc.beginHouseGesture("house");
    doc.updateHouseGesture({ ...doc.house("house")!, x: 20 });
    doc.finishHouseGesture();
    view.sync(AREA, 1);
    const moved = view.readNeed()!;
    expect(moved.version).toBeGreaterThan(before.version);
    expect(moved.bounds).not.toEqual(before.bounds);
    view.failed(before, new Error("Failure for the previous house location"));
    expect(view.readNeed()).toEqual(moved);
    expect(view.state().foundations[0].reason).toBeNull();
    doc.undo();
    view.sync(AREA, 1);
    const returned = view.readNeed()!;
    expect(returned.version).toBeGreaterThan(moved.version);
    expect(returned.bounds).toEqual(before.bounds);
    view.failed(before, new Error("Failure for old A after return to A"));
    view.failed(moved, new Error("Failure for old B after return to A"));
    view.failed(
      { ...returned, bounds: FAR },
      new Error("Mismatched current token and bounds"),
    );
    expect(view.readNeed()).toEqual(returned);
    expect(view.state().foundations[0].reason).toBeNull();
    // A matching present failure must still stop that exact failed need.
    view.failed(returned, new Error("Current location failed"));
    expect(view.readNeed()).toBeNull();
    expect(view.state().foundations[0].reason).toBe("Current location failed");
    view.retry();
    const retry = view.readNeed()!;
    expect(retry.version).toBeGreaterThan(returned.version);
    view.failed(returned, new Error("Late failure before Retry"));
    expect(view.readNeed()).toEqual(retry);
  });

  it("gives replacements globally distinct read versions, including water A to B to Undo A", () => {
    const doc = document({ empty: false });
    doc.acceptWaterCoverage(WORLD, [lake()]);
    const view = viewFor(doc);
    const a = view.readNeed()!;
    doc.applyWaterSources([{ id: "lake", after: lake({ level: 25 }) }]);
    view.sync(AREA, 1);
    const b = view.readNeed()!;
    expect(b.bounds).toEqual(a.bounds);
    expect(b.version).toBeGreaterThan(a.version);
    view.failed(a, new Error("Obsolete A read"));
    expect(view.readNeed()).toEqual(b);
    doc.undo();
    view.sync(AREA, 1);
    const again = view.readNeed()!;
    expect(again.version).toBeGreaterThan(b.version);
    view.failed(a, new Error("Earlier equal-bounds A read"));
    view.failed(b, new Error("Obsolete B read"));
    expect(view.readNeed()).toEqual(again);
    expect(view.state().water[0].reason).toBeNull();
    // A different view also cannot recycle a token from a retired owner.
    const otherDoc = document({ empty: false });
    otherDoc.acceptWaterCoverage(WORLD, [lake()]);
    const other = viewFor(otherDoc);
    expect(other.readNeed()!.version).toBeGreaterThan(again.version);
    other.failed(again, new Error("Old owner's equal key and bounds"));
    expect(other.state().water[0].reason).toBeNull();
  });
});

describe("surface work resource admission", () => {
  it("counts foundation metadata until completion and reserves fresh capacity before the following hash", async () => {
    const digests = deferredDigests();
    const doc = document();
    doc.acceptCoverage(
      WORLD,
      heightTilesFromControls(0, [
        [0, 0, 180],
        [1, 0, 180],
      ]),
    );
    doc.acceptHouseCoverage(WORLD, [house()]);
    doc.acceptWaterCoverage(WORLD, [lake()]);
    const view = viewFor(doc);
    expect(view.retainedMetadataBytes).toBe(0);
    expect(view.nextPreparationBytes).toEqual({
      cpuBytes: 10 * MIB,
      gpuBytes: 0,
    });
    view.step(Infinity, 1);
    expect(view.retainedMetadataBytes).toBe(4 * MIB);
    expect(view.nextPreparationBytes).toEqual({ cpuBytes: 0, gpuBytes: 0 });
    expect(bytes(view.retainedBuffers())).toBeGreaterThan(0);
    // Finishing a work item ends this invocation. Starting the waiting hash
    // needs a new admission, even when the caller supplied ample remaining steps.
    view.step(Infinity, 100_000);
    expect(view.state().foundations[0].ready).toBe(true);
    expect(view.state().water[0].status).toBe("unknown");
    expect(digests.pending).toHaveLength(0);
    expect(view.retainedMetadataBytes).toBe(0);
    expect(bytes(view.retainedBuffers())).toBe(0);
    expect(view.nextPreparationBytes).toEqual({
      cpuBytes: 10 * MIB,
      gpuBytes: 0,
    });
    view.step(Infinity, 1);
    expect(view.retainedMetadataBytes).toBe(0);
    expect(view.nextPreparationBytes).toEqual({
      cpuBytes: 2 * MIB,
      gpuBytes: 0,
    });
    view.step(Infinity, 100_000);
    expect(digests.pending).toHaveLength(1);
    expect(view.pendingDigest).toBe(true);
    expect(view.nextPreparationBytes).toEqual({ cpuBytes: 0, gpuBytes: 0 });
    digests.resolve(0);
    await flush();
    expect(view.pendingDigest).toBe(false);
    expect(view.retainedMetadataBytes).toBe(0);
    expect(bytes(view.retainedBuffers())).toBe(0);
  });

  it("ends a discarded synchronous job before admitting its replacement", () => {
    const doc = document();
    doc.acceptCoverage(
      WORLD,
      heightTilesFromControls(0, [
        [0, 0, 180],
        [1, 0, 180],
      ]),
    );
    doc.acceptHouseCoverage(WORLD, [house()]);
    const view = viewFor(doc);
    view.step(Infinity, 1);
    expect(view.retainedMetadataBytes).toBe(4 * MIB);
    invalidate(view, heightEdit(doc));
    expect(view.retainedMetadataBytes).toBe(4 * MIB);
    view.step(Infinity, 100_000);
    expect(view.state().foundations[0].ready).toBe(false);
    expect(view.pending).toBe(true);
    expect(view.retainedMetadataBytes).toBe(0);
    expect(bytes(view.retainedBuffers())).toBe(0);
    expect(view.nextPreparationBytes).toEqual({
      cpuBytes: 10 * MIB,
      gpuBytes: 0,
    });
  });

  it("releases synchronous derivation buffers and metadata immediately on destruction", () => {
    const doc = document();
    doc.acceptCoverage(
      WORLD,
      heightTilesFromControls(0, [
        [0, 0, 180],
        [1, 0, 180],
      ]),
    );
    doc.acceptHouseCoverage(WORLD, [house()]);
    const view = viewFor(doc);
    view.step(Infinity, 1);
    expect(view.retainedMetadataBytes).toBe(4 * MIB);
    view.destroy();
    expect(view.pending).toBe(false);
    expect(view.pendingDigest).toBe(false);
    expect(view.retainedMetadataBytes).toBe(0);
    expect(bytes(view.retainedBuffers())).toBe(0);
    expect(view.step(Infinity, 100_000)).toBe(0);
  });
});

function expectInfluenceNotified(
  changed: ReturnType<typeof vi.fn>,
  expected: Bounds,
) {
  const notifications = changed.mock.calls
    .map(([bounds]) => bounds as Bounds | undefined)
    .filter((value): value is Bounds => Boolean(value));
  for (const point of [
    [expected[0], expected[1]],
    [expected[2], expected[1]],
    [expected[2], expected[3]],
    [expected[0], expected[3]],
  ])
    expect(
      notifications.some(
        (bounds) =>
          bounds[0] <= point[0] &&
          bounds[1] <= point[1] &&
          bounds[2] >= point[0] &&
          bounds[3] >= point[1],
      ),
    ).toBe(true);
  expect(
    notifications.some(
      (bounds) =>
        bounds[0] < AREA[0] ||
        bounds[1] < AREA[1] ||
        bounds[2] > AREA[2] ||
        bounds[3] > AREA[3],
    ),
  ).toBe(true);
}

describe("complete old and new derived influence invalidation", () => {
  it("invalidates old and new house transitions beyond the view, including removal, without changing frozen frames", async () => {
    const doc = document();
    doc.acceptHouseCoverage(WORLD, [
      house({ x: -40, width: 40, depth: 20, foundationTransition: 100 }),
    ]);
    const changed = vi.fn();
    const view = viewFor(doc, changed);
    await drain(view);
    const before = view.freeze(AREA, 0)!;
    changed.mockClear();
    doc.beginHouseGesture("house");
    doc.updateHouseGesture({ ...doc.house("house")!, x: 40 });
    const move = doc.finishHouseGesture()!;
    view.sync(AREA, 1);
    expectInfluenceNotified(changed, [-160, -110, 80, 110]);
    expectInfluenceNotified(changed, [-80, -110, 160, 110]);
    await drain(view);
    const after = view.freeze(AREA, 0)!;
    expect(prepared(before).foundations[0]).toBe(24);
    expect(prepared(after).foundations[0]).toBe(104);
    doc.acknowledge(move);
    doc.retainHouseSources([FAR]);
    changed.mockClear();
    view.sync(AREA, 1);
    expectInfluenceNotified(changed, [-80, -110, 160, 110]);
    expect(view.state().foundations).toEqual([]);
    expect(prepared(after).foundations[0]).toBe(104);
  });

  it("invalidates full old and new lake masks after replacement and deletion, including retained offscreen packets", async () => {
    const doc = document();
    const terrain = emptyDependency([-240, -100, 240, 100]);
    const a = lake({
      terrain,
      rings: [
        [
          [-200, -20],
          [40, -20],
          [40, 20],
          [-200, 20],
        ],
      ],
    });
    const b = lake({
      terrain,
      level: 25,
      rings: [
        [
          [-40, -20],
          [220, -20],
          [220, 20],
          [-40, 20],
        ],
      ],
    });
    doc.acceptWaterCoverage(WORLD, [a]);
    const changed = vi.fn();
    const view = viewFor(doc, changed);
    await drain(view);
    const left: Bounds = [-256, -64, -128, 64];
    const right: Bounds = [128, -64, 256, 64];
    const before = view.freeze(left, 0)!;
    changed.mockClear();
    doc.applyWaterSources([{ id: "lake", after: b }]);
    view.sync(AREA, 1);
    expectInfluenceNotified(changed, [-200, -20, 40, 20]);
    expectInfluenceNotified(changed, [-40, -20, 220, 20]);
    expect(view.freeze(left, 0)).toBeNull();
    const after = view.freeze(right, 0)!;
    const centre = (64 * 128 + 64) * 4;
    expect(prepared(before).lake![centre]).toBe(10);
    expect(prepared(after).lake![centre]).toBe(25);
    doc.applyWaterSources([{ id: "lake", after: null }]);
    changed.mockClear();
    view.sync(AREA, 1);
    expectInfluenceNotified(changed, [-40, -20, 220, 20]);
    expect(view.freeze(right, 0)).toBeNull();
    expect(prepared(after).lake![centre]).toBe(25);
  });
});

describe("immutable, bounded surface packets", () => {
  it("preserves both overlapping lake layers when only the higher level can be wet", () => {
    const doc = document();
    doc.acceptWaterCoverage(WORLD, [
      lake({ id: "low", level: 5 }),
      lake({ id: "high", level: 10 }),
    ]);
    const view = viewFor(doc);
    const frame = view.freeze(AREA, 0)!;
    const data = prepared(frame);
    expect(data.lakeLayers).toBe(2);
    const levels = Array.from({ length: data.lakeLayers }, (_, layer) => {
      const offset = ((layer * 128 + 64) * 128 + 64) * 4;
      expect(data.lake![offset + 2]).toBe(1);
      return data.lake![offset] + data.lake![offset + 1];
    });
    expect(levels).toEqual([5, 10]);
    expect(Math.min(...levels.filter((level) => level > 7))).toBe(10);
    expect(view.sample([0.5, 0.5], 7)).toMatchObject({
      waterLevel: 10,
      wet: true,
    });
    expect(view.sample([0.5, 0.5], 4)).toMatchObject({
      waterLevel: 5,
      wet: true,
    });
    expect(view.sample([0.5, 0.5], 10)).toMatchObject({
      waterLevel: null,
      wet: false,
    });
    expect(frame.bytes).toBe(2 * 128 * 128 * 16);
    expect(bytes(frame.buffers)).toBe(frame.bytes);
  });

  it("keeps old mask geometry immutable when the confirmed source changes before preparation", () => {
    const doc = document();
    doc.acceptWaterCoverage(WORLD, [lake()]);
    const view = viewFor(doc);
    const before = view.freeze(AREA, 0)!;
    doc.applyWaterSources([{ id: "lake", after: lake({ level: 25 }) }]);
    view.sync(AREA, 1);
    const after = view.freeze(AREA, 0)!;
    const offset = (64 * 128 + 64) * 4;
    expect(prepared(before).lake![offset]).toBe(10);
    expect(prepared(after).lake![offset]).toBe(25);
    expect(before).not.toBe(after);
  });

  it("keeps a frozen foundation result after later terrain invalidation, even before first preparation", async () => {
    const doc = document();
    doc.acceptHouseCoverage(WORLD, [house()]);
    const view = viewFor(doc);
    await drain(view);
    const old = view.freeze(AREA, 0)!;
    invalidate(view, heightEdit(doc));
    expect(view.state().foundations[0].ready).toBe(false);
    const oldData = prepared(old);
    expect(oldData.foundations).toHaveLength(12);
    expect(oldData.foundations[7] + oldData.foundations[8]).toBeCloseTo(
      -100,
      9,
    );
    await drain(view);
    const next = prepared(view.freeze(AREA, 0));
    expect(next.foundations[7] + next.foundations[8]).toBeGreaterThan(-100);
    expect(oldData.foundations[7] + oldData.foundations[8]).toBeCloseTo(
      -100,
      9,
    );
  });

  it("resumes one raster allocation after cancellation or a second preparation consumer", () => {
    const doc = document();
    doc.acceptWaterCoverage(WORLD, [lake()]);
    const view = viewFor(doc);
    const frame = view.freeze(AREA, 0)!;
    const first = frame.prepare();
    expect(first.next().done).toBe(false);
    const reserved = bytes(frame.buffers);
    expect(reserved).toBe(frame.bytes);
    const second = frame.prepare();
    expect(second.next().done).toBe(false);
    expect(bytes(frame.buffers)).toBe(reserved);
    first.return?.(undefined as never);
    const result = finish(second);
    expect(result.lakeLayers).toBe(1);
    expect(bytes(frame.buffers)).toBe(frame.bytes);
    expect(prepared(frame)).toBe(result);
  });

  it("bounds cached absence metadata across repeated empty navigation", () => {
    const doc = document();
    const view = viewFor(doc);
    for (let index = 0; index < 300; index++) {
      const bounds: Bounds = [index * 128, 0, (index + 1) * 128, 128];
      view.sync(bounds, 1);
      expect(view.freeze(bounds, 0)).toBeNull();
    }
    expect(view.retainedBuffers().size).toBe(0);
    // Absence entries own metadata but no payload buffers; audit that ownership
    // separately so a zero-byte metric cannot conceal an unbounded negative cache.
    const cached = (
      view as unknown as { frames: Map<string, SurfaceFrame | null> }
    ).frames;
    expect(cached.size).toBeLessThanOrEqual(96);
  });

  it("rejects an over-budget layer set instead of silently keeping only some lakes", () => {
    const doc = document();
    doc.acceptWaterCoverage(
      WORLD,
      Array.from({ length: 9 }, (_, index) =>
        lake({ id: `lake-${index}`, level: index + 1 }),
      ),
    );
    const view = viewFor(doc);
    expect(view.freeze(AREA, 0)).toBeNull();
    expect(view.state().message).toMatch(/zu viel.*Gewässergeometrie/);
    expect(view.state().ready).toBe(false);
    expect(view.retainedBuffers().size).toBe(0);
  });

  it("refuses a snapshot larger than its local byte budget without copying authors or reporting current", () => {
    const doc = document();
    const bounds: Bounds = [0, 0, 129 * 320, 320];
    const controls = Array.from(
      { length: 129 },
      (_, index) => [index * 64, 0, 1] as const,
    );
    doc.acceptCoverage(WORLD, heightTilesFromControls(0, controls));
    doc.acceptWaterCoverage(WORLD, [
      lake({
        rings: [
          [
            [0, 0],
            [bounds[2], 0],
            [bounds[2], 320],
            [0, 320],
          ],
        ],
        terrain: emptyDependency(bounds),
      }),
    ]);
    const view = viewFor(doc);
    const copy = vi.spyOn(Float64Array.prototype, "slice");
    view.step(Infinity, 1);
    expect(copy).not.toHaveBeenCalled();
    expect(view.state().water[0]).toMatchObject({
      status: "unknown",
      currentIdentity: null,
    });
    expect(view.state().water[0].reason).toMatch(/Speicherbudget/);
    expect(view.pending).toBe(false);
    expect(view.retainedBuffers().size).toBe(0);
  });
});

describe("certified foundation presentation", () => {
  it("does not publish a plausible numeric approximation when the maximum proof exhausted its budget", async () => {
    vi.spyOn(surfaceMath, "deriveFoundation").mockImplementation(
      function* (value) {
        yield;
        return {
          houseId: value.id,
          status: "unknown",
          baseLower: 10,
          baseUpper: 11,
          topLower: 11,
          topUpper: 12,
          toleranceFt: 1e-4,
          nodes: 1,
          controlSteps: 1,
          reason: "budget",
        };
      },
    );
    const doc = document();
    doc.acceptHouseCoverage(WORLD, [house()]);
    const view = viewFor(doc);
    await drain(view);
    expect(view.state().foundations[0]).toMatchObject({
      ready: false,
      base: null,
      top: null,
    });
    expect(view.state().foundations[0].reason).toMatch(/Genauigkeit/);
    expect(view.state().ready).toBe(false);
    expect(view.freeze(AREA, 0)).toBeNull();
  });

  it("keeps terrain on the certified base when the building upper edge changes", async () => {
    const doc = document();
    doc.acceptHouseCoverage(WORLD, [house()]);
    const view = viewFor(doc);
    await drain(view);
    const before = view.state().foundations[0];
    const beforeData = prepared(view.freeze(AREA, 0));
    doc.beginHouseGesture("house");
    doc.updateHouseGesture({ ...doc.house("house")!, foundationHeight: 100 });
    doc.finishHouseGesture();
    view.sync(AREA, 1);
    await drain(view);
    const after = view.state().foundations[0];
    const afterData = prepared(view.freeze(AREA, 0));
    expect(after.ready).toBe(true);
    expect(after.base).toBe(before.base);
    expect(after.top! - after.base!).toBe(100);
    expect(afterData.foundations[7] + afterData.foundations[8]).toBeCloseTo(
      -100,
      9,
    );
    expect(afterData.foundations[9] + afterData.foundations[10]).toBeCloseTo(
      0,
      9,
    );
    expect(beforeData.foundations[9] + beforeData.foundations[10]).toBeCloseTo(
      -99,
      9,
    );
    expect(view.sample([0, 0], -100)?.surfaceHeight).toBeCloseTo(-100, 9);
  });

  it("limits visible foundation work and exposes the omitted remainder explicitly", async () => {
    const doc = document();
    doc.acceptHouseCoverage(
      WORLD,
      Array.from({ length: 65 }, (_, index) =>
        house({
          id: `house-${index}`,
          x: index - 32,
          width: 2,
          depth: 2,
          foundationTransition: 1,
        }),
      ),
    );
    const view = viewFor(doc);
    expect(view.state().foundations).toHaveLength(64);
    expect(view.state().message).toMatch(/näheren Ansicht/);
    await drain(view);
    expect(view.state().foundations.every((entry) => entry.ready)).toBe(true);
    const frame = view.freeze(AREA, 0)!;
    expect(prepared(frame).foundations).toHaveLength(64 * 12);
    expect(frame.bytes).toBe(64 * 48);
    expect(bytes(frame.buffers)).toBe(frame.bytes);
  });
});

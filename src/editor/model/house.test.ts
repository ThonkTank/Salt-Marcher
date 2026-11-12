import { describe, expect, it } from "vitest";
import {
  applyTestBrush,
  beginTestBrush,
  finishTestBrush,
} from "../../../tests/support/prepaidBrush";
import {
  EditorDocument,
  HEIGHT_TILE_BYTES,
  HOUSE_HEADER_BYTES,
  HOUSE_MAX_REGION_HEADERS,
  LANDSCAPE_TILE_BYTES,
  WORLD_LIMIT,
  cloneHouseHeader,
  houseBounds,
  houseContainsPoint,
  houseCorners,
  houseKey,
  parseHouseKey,
  validateHouseHeader,
  type Bounds,
  type EditorDocumentOptions,
  type HouseHeader,
} from "./index";

const LOCAL: Bounds = [-100, -100, 100, 100];
const FAR: Bounds = [900, -100, 1100, 100];
const WORLD: Bounds = [-WORLD_LIMIT, -WORLD_LIMIT, WORLD_LIMIT, WORLD_LIMIT];

function house(values: Partial<HouseHeader> = {}): HouseHeader {
  return {
    id: "house-one",
    revision: 0,
    x: 0,
    y: 0,
    width: 30,
    depth: 20,
    rotation: 0,
    foundationHeight: 1,
    foundationTransition: 10,
    ...values,
  };
}

function empty(options: EditorDocumentOptions = {}) {
  return new EditorDocument("house-document", {
    empty: true,
    landscapeEmpty: true,
    housesEmpty: true,
    ...options,
  });
}

function place(doc: EditorDocument, value = house()) {
  doc.beginHouseGesture(value);
  return doc.finishHouseGesture()!;
}

function height(doc: EditorDocument) {
  beginTestBrush(doc, { level: 0, amount: 5, radius: 20 });
  applyTestBrush(doc, [100, 100], [100, 100], 50);
  return finishTestBrush(doc)!;
}

function landscape(doc: EditorDocument) {
  doc.beginLandscapeGesture({ level: 0, radius: 1, weights: [180, 0, 0, 0] });
  doc.applyLandscapeSegment([20.5, 20.5], [20.5, 20.5]);
  return doc.finishLandscapeGesture()!;
}

describe("rotated house headers", () => {
  it("has stable canonical keys and excludes attached interior payloads", () => {
    expect(parseHouseKey(houseKey("a-12_X"))).toBe("a-12_X");
    for (const key of ["height:a", "house:", "house:a:b", "house:a b"])
      expect(() => parseHouseKey(key)).toThrow();
    const withPayload = { ...house(), interior: new Uint8Array(1_000_000) };
    expect(cloneHouseHeader(withPayload)).toEqual(house());
    expect(cloneHouseHeader(withPayload)).not.toHaveProperty("interior");
  });

  it("rotates about the centre and selects the footprint rather than the index box", () => {
    const cardinal = house({
      x: 15,
      y: -10,
      width: 40,
      depth: 20,
      rotation: 90,
    });
    expect(houseBounds(cardinal)).toEqual([5, -30, 25, 10]);
    expect(houseCorners(cardinal)).toEqual([
      [25, -30],
      [25, 10],
      [5, 10],
      [5, -30],
    ]);
    const diagonal = house({ width: 40, depth: 20, rotation: 45 });
    expect(houseContainsPoint(diagonal, [0, 0])).toBe(true);
    expect(houseContainsPoint(diagonal, [20, -20])).toBe(false);
    for (const corner of houseCorners(diagonal))
      expect(houseContainsPoint(diagonal, corner)).toBe(true);
    expect(houseBounds({ ...diagonal, foundationTransition: 500 })).toEqual(
      houseBounds(diagonal),
    );
  });

  it("validates the whole rotated footprint at both closed world boundaries", () => {
    const edge = house({
      x: WORLD_LIMIT - 10,
      y: -WORLD_LIMIT + 20,
      width: 40,
      depth: 20,
      rotation: 90,
    });
    expect(() => validateHouseHeader(edge)).not.toThrow();
    expect(houseBounds(edge)).toEqual([
      WORLD_LIMIT - 20,
      -WORLD_LIMIT,
      WORLD_LIMIT,
      -WORLD_LIMIT + 40,
    ]);
    expect(() => validateHouseHeader({ ...edge, x: edge.x + 1 })).toThrow(
      /grundfläche/i,
    );
    expect(() => validateHouseHeader({ ...edge, rotation: 45 })).toThrow(
      /grundfläche/i,
    );
    expect(() =>
      validateHouseHeader(house({ x: 1e8, width: Number.MIN_VALUE })),
    ).toThrow(/grundfläche/i);
  });

  it.each<Partial<HouseHeader>>([
    { id: "../bad" },
    { revision: -1 },
    { revision: 0.1 },
    { x: NaN },
    { y: Infinity },
    { width: 0 },
    { depth: 10_001 },
    { rotation: -1 },
    { rotation: 360 },
    { foundationHeight: 101 },
    { foundationTransition: -1 },
  ])("rejects invalid authors %j", (values) => {
    expect(() => validateHouseHeader(house(values))).toThrow();
  });
});

describe("house spatial coverage and bounded residency", () => {
  it("does not infer house absence from height or landscape absence", () => {
    const doc = new EditorDocument("unknown-houses", {
      empty: true,
      landscapeEmpty: true,
    });
    expect(doc.isHouseRegionReady(LOCAL)).toBe(false);
    expect(() => doc.housesInBounds(LOCAL)).toThrow(/Hausdaten/);
    expect(() => doc.beginHouseGesture(house())).toThrow(/Hausdaten/);
    expect(doc.active).toBe(false);
    expect(
      new EditorDocument("houses-only", { housesEmpty: true }).isReady(LOCAL),
    ).toBe(false);
    doc.acceptHouseCoverage(LOCAL, []);
    expect(doc.housesInBounds(LOCAL)).toEqual([]);
  });

  it("requires complete coverage and does not fill an L-shaped hole", () => {
    const doc = new EditorDocument("coverage");
    doc.acceptHouseCoverage([-100, -100, 0, 100], []);
    doc.acceptHouseCoverage([0, -100, 100, 0], []);
    expect(doc.isHouseRegionReady(LOCAL)).toBe(false);
    expect(doc.isHouseRegionReady([-90, -90, 90, -1])).toBe(true);
    doc.acceptHouseCoverage([0, 0, 100, 100], []);
    expect(doc.isHouseRegionReady(LOCAL)).toBe(true);
  });

  it("validates the entire answer atomically before certifying absence", () => {
    const doc = new EditorDocument("read-validation");
    const before = { generation: doc.generation, metrics: doc.metrics };
    for (const headers of [
      [house(), house()],
      [house(), house({ id: "outside", x: 1000 })],
      [house(), house({ id: "bad", width: -2 })],
    ])
      expect(() => doc.acceptHouseCoverage(LOCAL, headers)).toThrow();
    expect(() =>
      doc.acceptHouseCoverage(
        LOCAL,
        Array.from({ length: HOUSE_MAX_REGION_HEADERS + 1 }, () => house()),
      ),
    ).toThrow(/Budget/);
    expect(() =>
      doc.acceptHouseCoverage(LOCAL, [house()], 0, "foreign"),
    ).toThrow(/Sitzung/);
    expect(() => doc.acceptHouseCoverage(LOCAL, [house()], 1)).toThrow(
      /Lesesequenz/,
    );
    expect({ generation: doc.generation, metrics: doc.metrics }).toEqual(
      before,
    );
    expect(doc.isHouseRegionReady(LOCAL)).toBe(false);
  });

  it("rejects an oversized read without retaining partial authors or proof", () => {
    const doc = new EditorDocument("read-budget", {
      maxSourceBytes: HOUSE_HEADER_BYTES,
    });
    expect(() =>
      doc.acceptHouseCoverage(LOCAL, [house(), house({ id: "second", x: 50 })]),
    ).toThrow(/Speicherbudget/);
    expect(doc.house("house-one")).toBeNull();
    expect(doc.metrics.sourceBytes).toBe(0);
    expect(doc.isHouseRegionReady(LOCAL)).toBe(false);
  });

  it("keeps loaded headers immutable and reads only the requested footprint", () => {
    const doc = new EditorDocument("read");
    const source = house({ x: 85, rotation: 45 });
    doc.acceptHouseCoverage(LOCAL, [source]);
    source.x = 900;
    expect(doc.house(source.id)!.x).toBe(85);
    expect(Object.isFrozen(doc.house(source.id))).toBe(true);
    expect(doc.housesInBounds([-10, -10, 10, 10])).toEqual([]);
    expect(doc.housesInBounds(LOCAL)).toHaveLength(1);
  });

  it("orders overlapping headers by stable ID independently from read arrival", () => {
    const source = ["b", "a", "Z", "0"].map((id) => house({ id }));
    const first = new EditorDocument("first-order");
    const reopened = new EditorDocument("reopened-order");
    first.acceptHouseCoverage(LOCAL, source);
    reopened.acceptHouseCoverage(LOCAL, [...source].reverse());
    expect(first.housesInBounds(LOCAL).map((header) => header.id)).toEqual([
      "0",
      "Z",
      "a",
      "b",
    ]);
    expect(reopened.housesInBounds(LOCAL)).toEqual(first.housesInBounds(LOCAL));
  });

  it("rejects an over-budget visible aggregate assembled by valid smaller reads", () => {
    const doc = new EditorDocument("aggregate-budget");
    const count = HOUSE_MAX_REGION_HEADERS / 2;
    const left = Array.from({ length: count }, (_, index) =>
      house({ id: `left-${index}`, x: -50, width: 1, depth: 1 }),
    );
    const right = Array.from({ length: count + 1 }, (_, index) =>
      house({ id: `right-${index}`, x: 50, width: 1, depth: 1 }),
    );
    doc.acceptHouseCoverage([-100, -100, 0, 100], left);
    doc.acceptHouseCoverage([0, -100, 100, 100], right);
    expect(doc.housesInBounds([-100, -100, 0, 100])).toHaveLength(count);
    expect(doc.isHouseRegionReady(LOCAL)).toBe(true);
    expect(() => doc.housesInBounds(LOCAL)).toThrow(/Darstellungsbudget/);
    expect(doc.metrics.readyHouses).toBe(HOUSE_MAX_REGION_HEADERS + 1);
  });

  it("evicts acknowledged headers and revokes proofs while pinning pending and active edits", () => {
    const doc = empty();
    const change = place(doc);
    expect(doc.retainHouseSources([])).toEqual([]);
    expect(doc.metrics.readyHouses).toBe(1);
    doc.acknowledge(change);
    doc.acceptHouseCoverage(LOCAL, [doc.house("house-one")!]);
    doc.beginHouseGesture("house-one");
    doc.updateHouseGesture({ ...doc.house("house-one")!, rotation: 90 });
    expect(doc.retainHouseSources([])).toEqual([]);
    doc.cancelHouseGesture();
    expect(doc.retainHouseSources([])).toEqual(["house:house-one"]);
    expect(doc.metrics.readyHouses).toBe(0);
    expect(doc.isHouseRegionReady(LOCAL)).toBe(false);
    expect(doc.house("house-one")).toBeNull();
    const stored = change.patches[0];
    if (stored.kind !== "house" || !stored.after)
      throw new Error("House fixture missing");
    doc.acceptHouseCoverage(LOCAL, [stored.after]);
    expect(doc.housesInBounds(LOCAL)).toEqual([stored.after]);
  });
});

describe("house gestures in the common document lifecycle", () => {
  it("shows live placement and movement, then creates one history entry at finish", async () => {
    const doc = empty();
    const update = doc.beginHouseGesture(house())!;
    expect(update.patches[0].before).toBeNull();
    expect(doc.housesInBounds(LOCAL)).toHaveLength(1);
    expect(doc.sequence).toBe(0);
    expect(doc.canUndo).toBe(false);
    let done = false;
    const completion = doc.whenActionFinished().then(() => {
      done = true;
    });
    doc.updateHouseGesture({ ...doc.house("house-one")!, x: 50, rotation: 25 });
    await Promise.resolve();
    expect(done).toBe(false);
    const change = doc.finishHouseGesture()!;
    await completion;
    expect(change.patches[0]).toMatchObject({
      kind: "house",
      key: "house:house-one",
      before: null,
      after: { x: 50, rotation: 25 },
    });
    expect(doc.sequence).toBe(1);
    expect(doc.metrics.historyActions).toBe(1);
    expect(doc.finishHouseGesture()).toBeNull();
    expect(doc.pendingChanges()).toEqual([change]);
  });

  it("cancels placement without history, a pending commit or resident bytes", async () => {
    const doc = empty();
    doc.beginHouseGesture(house());
    const completion = doc.whenActionFinished();
    const revision = doc.revision;
    const update = doc.cancelHouseGesture()!;
    await completion;
    expect(update.patches[0].after).toBeNull();
    expect(doc.housesInBounds(LOCAL)).toEqual([]);
    expect(doc.metrics.sourceBytes).toBe(0);
    expect(doc.revision).toBeGreaterThan(revision);
    expect(doc.sequence).toBe(0);
    expect(doc.pendingChanges()).toEqual([]);
    expect(doc.canUndo).toBe(false);
  });

  it("cancels a drag to the exact earlier author identity and preserves an earlier pending edit", () => {
    const doc = empty();
    const first = place(doc);
    const before = doc.house("house-one")!;
    doc.beginHouseGesture(before.id);
    doc.updateHouseGesture({
      ...before,
      x: 1000,
      rotation: 45,
      foundationHeight: 20,
    });
    doc.acceptHouseCoverage(LOCAL, [], 0);
    doc.acceptHouseCoverage(FAR, [], 0);
    expect(doc.housesInBounds(FAR)[0].x).toBe(1000);
    doc.cancelHouseGesture();
    expect(doc.house(before.id)).toBe(before);
    doc.acceptHouseCoverage(LOCAL, [], 0);
    expect(doc.housesInBounds(LOCAL)).toEqual([before]);
    expect(doc.pendingChanges()).toEqual([first]);
    expect(doc.retainHouseSources([])).toEqual([]);
  });

  it("preserves stable ID, pose and foundation settings through shared Undo/Redo", () => {
    const doc = empty();
    place(doc);
    const before = doc.house("house-one")!;
    doc.beginHouseGesture(before.id, "Haus einstellen");
    doc.updateHouseGesture({
      ...before,
      x: 50,
      y: 60,
      rotation: 120,
      width: 40,
      foundationHeight: 5,
      foundationTransition: 30,
    });
    doc.finishHouseGesture();
    const after = doc.house(before.id)!;
    doc.undo();
    expect(doc.house(before.id)).toEqual(before);
    doc.undo();
    expect(doc.house(before.id)).toBeNull();
    doc.redo();
    doc.redo();
    expect(doc.house(before.id)).toEqual(after);
    expect(doc.sequence).toBe(6);
  });

  it("omits an unchanged drag and restores the original identity after a round trip", () => {
    const doc = empty();
    const change = place(doc);
    const before = doc.house("house-one")!;
    doc.beginHouseGesture(before.id);
    expect(doc.updateHouseGesture({ ...before, revision: 1000 })).toBeNull();
    expect(doc.finishHouseGesture()).toBeNull();
    doc.beginHouseGesture(before.id);
    doc.updateHouseGesture({ ...before, x: 50 });
    doc.updateHouseGesture(before);
    expect(doc.finishHouseGesture()).toBeNull();
    expect(doc.house(before.id)).toBe(before);
    expect(doc.pendingChanges()).toEqual([change]);
    expect(doc.sequence).toBe(1);
  });

  it("rejects identity changes, unknown destinations and conflicting gestures atomically", () => {
    const doc = new EditorDocument("limited");
    doc.acceptHouseCoverage(LOCAL, [house()]);
    const before = doc.house("house-one")!;
    doc.beginHouseGesture(before.id);
    expect(() =>
      doc.updateHouseGesture({ ...before, id: "replacement" }),
    ).toThrow(/Identität/);
    expect(() => doc.updateHouseGesture({ ...before, x: 1000 })).toThrow(
      /Hausdaten/,
    );
    expect(() => doc.beginHouseGesture(house({ id: "other" }))).toThrow(
      /aktiv/,
    );
    expect(() =>
      doc.beginLandscapeGesture({ level: 0, radius: 1, weights: [0, 0, 0, 0] }),
    ).toThrow(/aktiv/);
    expect(() => height(doc)).toThrow(/aktiv/);
    expect(doc.house(before.id)).toBe(before);
    doc.cancelHouseGesture();
    expect(doc.sequence).toBe(0);
  });

  it("invalidates the common barrier when its document is abandoned", async () => {
    const doc = empty();
    doc.beginHouseGesture(house());
    const completion = doc.whenActionFinished();
    doc.invalidateContinuation();
    await expect(completion).rejects.toThrow(/beendet/);
    await expect(doc.whenActionFinished()).rejects.toThrow(/beendet/);
    expect(() => doc.updateHouseGesture(house())).toThrow(/beendet/);
    expect(() => doc.beginHouseGesture(house())).toThrow(/beendet/);
  });

  it("shares height, landscape, house history and receipts without rewriting house authors", () => {
    const doc = empty();
    place(doc);
    const original = doc.house("house-one")!;
    const houseGeneration = doc.houseGeneration;
    height(doc);
    landscape(doc);
    expect(doc.house(original.id)).toBe(original);
    expect(doc.houseGeneration).toBe(houseGeneration);
    expect(
      doc.pendingChanges().map((change) => change.patches[0].kind),
    ).toEqual(["house", "height", "landscape"]);
    expect(doc.metrics.sourceBytes).toBe(
      HOUSE_HEADER_BYTES + HEIGHT_TILE_BYTES + LANDSCAPE_TILE_BYTES,
    );
    expect(doc.metrics.readyTiles).toBe(1);
    expect(doc.metrics.readyHouses).toBe(1);
    expect(doc.undo()!.patches[0].kind).toBe("landscape");
    expect(doc.undo()!.patches[0].kind).toBe("height");
    expect(doc.house(original.id)).toBe(original);
    expect(doc.houseGeneration).toBe(houseGeneration);
    expect(doc.undo()!.patches[0].kind).toBe("house");
    doc.redo();
    doc.redo();
    doc.redo();
    expect(doc.house(original.id)).toEqual(original);
    for (const change of [...doc.pendingChanges()]) doc.acknowledge(change);
    expect(doc.pendingChanges()).toEqual([]);
    expect(doc.persistedSequence).toBe(9);
  });

  it("retains house presentation identity across identical reads and residency requests", () => {
    const doc = empty();
    const change = place(doc);
    doc.acknowledge(change);
    doc.retainHouseSources([LOCAL]);
    const original = doc.house("house-one")!;
    const generation = doc.houseGeneration;
    doc.retainHouseSources([LOCAL]);
    doc.acceptHouseCoverage(LOCAL, [cloneHouseHeader(original)]);
    expect(doc.house("house-one")).toBe(original);
    expect(doc.houseGeneration).toBe(generation);
    doc.retainHouseSources([]);
    expect(doc.houseGeneration).toBeGreaterThan(generation);
    const evicted = doc.houseGeneration;
    doc.acceptHouseCoverage(LOCAL, [original]);
    expect(doc.houseGeneration).toBeGreaterThan(evicted);
  });
});

describe("house budgets and stale spatial replies", () => {
  it("reserves the source and history budgets before placement or movement", () => {
    const tooSmall = empty({ maxSourceBytes: HOUSE_HEADER_BYTES - 1 });
    expect(() => tooSmall.beginHouseGesture(house())).toThrow(/Speicherbudget/);
    expect(tooSmall.active).toBe(false);
    expect(tooSmall.house("house-one")).toBeNull();
    const smallHistory = empty({ maxHistoryBytes: HOUSE_HEADER_BYTES });
    place(smallHistory);
    const before = smallHistory.house("house-one")!;
    smallHistory.beginHouseGesture(before.id);
    expect(() => smallHistory.updateHouseGesture({ ...before, x: 40 })).toThrow(
      /History/,
    );
    expect(smallHistory.house(before.id)).toBe(before);
    smallHistory.cancelHouseGesture();
  });

  it("charges shared pending bytes and allows retry after the matching ACK", () => {
    const doc = empty({ maxPendingBytes: 2 * HOUSE_HEADER_BYTES });
    const change = place(doc);
    const before = doc.house("house-one")!;
    doc.beginHouseGesture(before.id);
    expect(() => doc.updateHouseGesture({ ...before, x: 40 })).toThrow(
      /Arbeitskopie/,
    );
    expect(doc.house(before.id)).toBe(before);
    doc.acknowledge(change);
    doc.updateHouseGesture({ ...before, x: 40 });
    doc.finishHouseGesture();
    expect(doc.metrics.pendingBytes).toBe(2 * HOUSE_HEADER_BYTES);
  });

  it("shares source allocation with raster authors and reuses one header during a long drag", () => {
    const doc = empty({
      maxSourceBytes: HEIGHT_TILE_BYTES + HOUSE_HEADER_BYTES,
    });
    height(doc);
    place(doc);
    expect(() => doc.beginHouseGesture(house({ id: "second" }))).toThrow(
      /Speicherbudget/,
    );
    const before = doc.house("house-one")!;
    doc.beginHouseGesture(before.id);
    for (let x = 0; x < 100; x++) doc.updateHouseGesture({ ...before, x });
    expect(doc.metrics.sourceBytes).toBe(
      HEIGHT_TILE_BYTES + HOUSE_HEADER_BYTES,
    );
    doc.cancelHouseGesture();
    expect(doc.house(before.id)).toBe(before);
  });

  it("does not resurrect the old position or erase a pending new position", () => {
    const doc = empty();
    const initial = place(doc);
    doc.acknowledge(initial);
    const old = doc.house("house-one")!;
    doc.beginHouseGesture(old.id);
    doc.updateHouseGesture({ ...old, x: 1000 });
    const moved = doc.finishHouseGesture()!;
    const current = doc.house(old.id)!;
    doc.acceptHouseCoverage(LOCAL, [old], initial.sequence);
    doc.acceptHouseCoverage(FAR, [], initial.sequence);
    expect(doc.house(old.id)).toBe(current);
    expect(doc.housesInBounds(LOCAL)).toEqual([]);
    expect(doc.housesInBounds(FAR)).toEqual([current]);
    doc.acknowledge(moved);
    doc.retainHouseSources([]);
    const generation = doc.generation;
    doc.acceptHouseCoverage(LOCAL, [old], initial.sequence);
    expect(doc.generation).toBe(generation);
    expect(doc.isHouseRegionReady(LOCAL)).toBe(false);
    doc.acceptHouseCoverage(FAR, [current], moved.sequence);
    expect(doc.house(old.id)).toEqual(current);
  });

  it("restores undo/redo after eviction without inventing unrelated spatial coverage", () => {
    const doc = empty();
    const initial = place(doc);
    doc.acknowledge(initial);
    const original = doc.house("house-one")!;
    doc.retainHouseSources([]);
    const deletion = doc.undo()!;
    doc.acceptHouseCoverage(LOCAL, [original], initial.sequence);
    expect(doc.housesInBounds(LOCAL)).toEqual([]);
    expect(doc.isHouseRegionReady(FAR)).toBe(false);
    doc.acknowledge(deletion);
    doc.retainHouseSources([]);
    doc.redo();
    doc.acceptHouseCoverage(LOCAL, [], deletion.sequence);
    expect(doc.housesInBounds(LOCAL)).toEqual([original]);
  });

  it("uses the same stale-read floor after a terrain ACK", () => {
    const doc = empty();
    const change = height(doc);
    doc.acknowledge(change);
    const generation = doc.generation;
    doc.acceptHouseCoverage(LOCAL, [house()], 0);
    expect(doc.generation).toBe(generation);
    expect(doc.housesInBounds(WORLD)).toEqual([]);
  });
});

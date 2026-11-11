import { describe, expect, it } from "vitest";
import {
  applyTestBrush,
  beginTestBrush,
  finishTestBrush,
} from "../../../tests/support/prepaidBrush";
import {
  EditorDocument,
  WATER_MAX_REGION_SOURCES,
  WORLD_LIMIT,
  cloneWaterSource,
  lakeContainsPoint,
  parseWaterKey,
  validateWaterSource,
  waterBounds,
  waterKey,
  waterSourceBytes,
  type Bounds,
  type EditorDocumentOptions,
  type LakeSource,
  type RiverSource,
  type WaterSource,
} from "./index";

const LOCAL: Bounds = [-100, -100, 100, 100];
const FAR: Bounds = [900, -100, 1100, 100];
const WORLD: Bounds = [-WORLD_LIMIT, -WORLD_LIMIT, WORLD_LIMIT, WORLD_LIMIT];
function lake(id = "lake-one", x = 0): LakeSource {
  return {
    kind: "lake",
    id,
    revision: 0,
    name: "Vorbereiteter See",
    level: 32,
    rings: [
      [
        [x - 10, -10],
        [x + 10, -10],
        [x + 10, 10],
        [x - 10, 10],
      ],
    ],
    terrain: {
      kind: "height",
      bounds: WORLD,
      identity: `height-controls-v1:${"0".repeat(64)}`,
    },
  };
}
function empty(options: EditorDocumentOptions = {}) {
  return new EditorDocument("water-document", {
    empty: true,
    landscapeEmpty: true,
    housesEmpty: true,
    watersEmpty: true,
    ...options,
  });
}
function put(doc: EditorDocument, source = lake()) {
  return doc.applyWaterSources([{ id: source.id, after: source }])!;
}

describe("bounded confirmed water sources", () => {
  it("uses canonical IDs and closed cloned authors with independent geometry", () => {
    expect(parseWaterKey(waterKey("a-12_X"))).toBe("a-12_X");
    expect(() => waterKey("bad:id")).toThrow();
    const original = lake();
    const clone = cloneWaterSource({
      ...original,
      unrelated: [1, 2],
    } as WaterSource);
    expect(clone).toEqual(original);
    expect(clone).not.toHaveProperty("unrelated");
    expect(clone.terrain).not.toBe(original.terrain);
    if (clone.kind === "lake")
      expect(clone.rings[0]).not.toBe(original.rings[0]);
  });

  it("validates non-rising profiles, the complete influence dependency, simple masks and holes", () => {
    const source = lake();
    source.rings.push([
      [-3, -3],
      [3, -3],
      [3, 3],
      [-3, 3],
    ]);
    expect(() => validateWaterSource(source)).not.toThrow();
    expect(lakeContainsPoint(source, [0, 0])).toBe(false);
    expect(lakeContainsPoint(source, [8, 0])).toBe(true);
    expect(() =>
      validateWaterSource({
        ...source,
        terrain: { ...source.terrain, bounds: [0, 0, 1, 1] },
      }),
    ).toThrow(/vollständigen/);
    expect(() =>
      validateWaterSource({
        ...lake(),
        rings: [
          [
            [-10, -10],
            [10, 10],
            [-10, 10],
            [10, -10],
          ],
        ],
      }),
    ).toThrow(/selbst/);
    const river: RiverSource = {
      kind: "river",
      id: "river",
      revision: 0,
      name: "Fluss",
      terrain: source.terrain,
      samples: [
        { point: [0, 0], width: 20, level: 40 },
        { point: [0, 80], width: 20, level: 30 },
      ],
    };
    expect(() => validateWaterSource(river)).not.toThrow();
    expect(waterBounds(river)[0]).toBeLessThan(-30);
    expect(() =>
      validateWaterSource({ ...river, samples: [...river.samples].reverse() }),
    ).toThrow(/abwärts/);
  });

  it("keeps terrain, house and water absence independent", () => {
    const doc = new EditorDocument("independent", {
      empty: true,
      housesEmpty: true,
    });
    expect(doc.isReady(LOCAL)).toBe(true);
    expect(doc.isHouseRegionReady(LOCAL)).toBe(true);
    expect(doc.isWaterRegionReady(LOCAL)).toBe(false);
    expect(() => doc.waterSourcesInBounds(LOCAL)).toThrow(/Gewässerdaten/);
    doc.acceptWaterCoverage(LOCAL, []);
    expect(doc.waterSourcesInBounds(LOCAL)).toEqual([]);
  });

  it("rejects duplicate, out-of-region and oversized reads atomically", () => {
    const doc = new EditorDocument("invalid-read");
    const state = doc.metrics;
    expect(() => doc.acceptWaterCoverage(LOCAL, [lake(), lake()])).toThrow();
    expect(() => doc.acceptWaterCoverage(LOCAL, [lake("far", 1000)])).toThrow();
    expect(() =>
      doc.acceptWaterCoverage(
        LOCAL,
        Array.from({ length: WATER_MAX_REGION_SOURCES + 1 }, (_, i) =>
          lake(`lake${i}`),
        ),
      ),
    ).toThrow(/Budget/);
    expect(doc.metrics).toEqual(state);
    expect(doc.isWaterRegionReady(LOCAL)).toBe(false);
  });

  it("sorts cold sources by ASCII ID and rejects an oversized complete aggregate", () => {
    const doc = new EditorDocument("ordering");
    doc.acceptWaterCoverage(LOCAL, [lake("z"), lake("a"), lake("Z")]);
    expect(doc.waterSourcesInBounds(LOCAL).map((source) => source.id)).toEqual([
      "Z",
      "a",
      "z",
    ]);
    const large = new EditorDocument("aggregate");
    large.acceptWaterCoverage(
      [-100, -100, 0, 100],
      Array.from({ length: WATER_MAX_REGION_SOURCES }, (_, i) =>
        lake(`left${i}`, -50),
      ),
    );
    large.acceptWaterCoverage([0, -100, 100, 100], [lake("right", 50)]);
    expect(large.isWaterRegionReady(LOCAL)).toBe(true);
    expect(() => large.waterSourcesInBounds(LOCAL)).toThrow(
      /Darstellungsbudget/,
    );
  });

  it("retains immutable deep snapshots and leaves the source generation unchanged on a matching read", () => {
    const source = lake();
    const doc = new EditorDocument("immutable");
    doc.acceptWaterCoverage(LOCAL, [source]);
    const generation = doc.waterGeneration;
    const owned = doc.water(source.id)!;
    source.rings[0][0][0] = -99;
    expect((owned as LakeSource).rings[0][0][0]).toBe(-10);
    expect(() => (owned as LakeSource).rings[0].push([0, 0])).toThrow();
    doc.acceptWaterCoverage(LOCAL, [lake()]);
    expect(doc.waterGeneration).toBe(generation);
    expect(doc.water(source.id)).toBe(owned);
  });
});

describe("one document journal for water and other authors", () => {
  it("shares no-op, undo/redo, exact confirmed revisions, and mixed height history", () => {
    const doc = empty();
    const creation = put(doc);
    const original = doc.water("lake-one")!;
    expect(
      doc.applyWaterSources([
        { id: original.id, after: { ...original, revision: 1000 } },
      ]),
    ).toBeNull();
    beginTestBrush(doc, { level: 0, amount: 5, radius: 15 });
    applyTestBrush(doc, [0, 0], [0, 0], 50);
    finishTestBrush(doc);
    doc.undo();
    expect(doc.water("lake-one")).toEqual(original);
    doc.undo();
    expect(doc.water("lake-one")).toBeNull();
    doc.redo();
    expect(doc.water("lake-one")).toEqual(original);
    expect(doc.water("lake-one")?.revision).toBe(creation.revision);
    expect(doc.pendingChanges().at(-1)?.patches[0].kind).toBe("water");
  });

  it("rejects water actions during a live brush and requires the entire old/new footprint", () => {
    const doc = empty();
    beginTestBrush(doc, { level: 0, amount: 5, radius: 15 });
    expect(() => put(doc)).toThrow(/aktiv/);
    finishTestBrush(doc);
    const cold = new EditorDocument("partial");
    cold.acceptWaterCoverage([-1, -1, 1, 1], [lake()]);
    expect(() =>
      cold.applyWaterSources([
        { id: "lake-one", after: { ...lake(), level: 31 } },
      ]),
    ).toThrow(/geladen/);
    expect(cold.sequence).toBe(0);
  });

  it("validates a complete multi-source action before publishing any source", () => {
    const doc = empty();
    const state = doc.metrics;
    expect(() =>
      doc.applyWaterSources([
        { id: "first", after: lake("first") },
        { id: "second", after: { ...lake("second"), level: NaN } },
      ]),
    ).toThrow();
    expect(doc.metrics).toEqual(state);
    expect(doc.sequence).toBe(0);
    expect(doc.water("first")).toBeNull();
  });

  it("counts source, pending and history payloads and refuses budget overflow before mutation", () => {
    const bytes = waterSourceBytes(lake());
    for (const options of [
      { maxSourceBytes: bytes - 1 },
      { maxPendingBytes: bytes - 1 },
      { maxHistoryBytes: bytes - 1 },
    ]) {
      const doc = empty(options);
      expect(() => put(doc)).toThrow();
      expect(doc.sequence).toBe(0);
      expect(doc.metrics.sourceBytes).toBe(0);
    }
    const doc = empty();
    put(doc);
    expect(doc.metrics.sourceBytes).toBe(bytes);
    expect(doc.metrics.waterSourceBytes).toBe(bytes);
    expect(doc.metrics.pendingBytes).toBe(bytes);
    expect(doc.metrics.historyBytes).toBe(bytes);
    expect(doc.metrics.readyTiles).toBe(0);
  });

  it("protects both sides of a pending move against old spatial answers, then rejects pre-ACK reads", () => {
    const doc = empty();
    const first = put(doc);
    const old = doc.water("lake-one")!;
    doc.acknowledge(first);
    const move = put(doc, lake("lake-one", 1000));
    doc.acceptWaterCoverage(LOCAL, [old], first.sequence);
    doc.acceptWaterCoverage(FAR, [], first.sequence);
    expect(doc.waterSourcesInBounds(LOCAL)).toEqual([]);
    expect(doc.waterSourcesInBounds(FAR).map((source) => source.id)).toEqual([
      "lake-one",
    ]);
    doc.acknowledge(move);
    doc.acceptWaterCoverage(LOCAL, [old], first.sequence);
    expect(doc.waterSourcesInBounds(LOCAL)).toEqual([]);
  });

  it("evicts cold confirmed sources with their proofs, pins pending sources and reloads exact content", () => {
    const doc = empty();
    const change = put(doc);
    const original = doc.water("lake-one")!;
    doc.retainWaterSources([FAR]);
    expect(doc.water("lake-one")).toBe(original);
    expect(doc.isWaterRegionReady(LOCAL)).toBe(false);
    doc.acknowledge(change);
    expect(doc.retainWaterSources([FAR])).toEqual(["water:lake-one"]);
    expect(doc.metrics.waterSourceBytes).toBe(0);
    doc.acceptWaterCoverage(LOCAL, [original], doc.sequence);
    expect(doc.water("lake-one")).toEqual(original);
    doc.retainWaterSources([FAR]);
    doc.undo();
    expect(doc.water("lake-one")).toBeNull();
    doc.redo();
    expect(doc.water("lake-one")).toEqual(original);
  });
});

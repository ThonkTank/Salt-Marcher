import test from "node:test";
import assert from "node:assert/strict";
import { AtlasHistory } from "../../src/features/atlas/atlas-history";
import {
  newOverworld,
  parseOverworld,
  serializeOverworld,
} from "../../src/features/atlas/overworld";
import {
  checkedTerrainCell,
  chunkAddress,
  terrainChunkKey,
  terrainTarget,
  type TerrainCell,
  type TerrainReference,
} from "../../src/features/atlas/terrain-schema";
import {
  TerrainSource,
  TerrainStroke,
  axialLine,
} from "../../src/features/atlas/terrain-source";

const cell = (q: number, r: number): TerrainCell =>
  checkedTerrainCell({
    q,
    r,
    surface: "land",
    terrain: "plain",
    color: "#dbc998",
  });
function empty() {
  const world = newOverworld("world-a", "Insel", "pointy"),
    history = new AtlasHistory();
  const source = new TerrainSource(world, history, async () => {
    throw new Error("No file for empty world");
  });
  return { world, history, source };
}
test("Native sparse terrain crosses signed chunk boundaries without filling the world", async () => {
  const { world, history, source } = empty();
  const addresses = [
    { q: -33, r: -1 },
    { q: -32, r: 0 },
    { q: -1, r: 31 },
    { q: 0, r: 32 },
    { q: 32, r: -32 },
  ];
  assert.deepEqual(addresses.map(chunkAddress), [
    { q: -2, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 0 },
    { q: 0, r: 1 },
    { q: 1, r: -1 },
  ]);
  await source.ensure(addresses);
  assert.deepEqual(source.references(), []);
  for (const address of addresses) {
    const stroke = new TerrainStroke(source, "land");
    stroke.add(address);
    stroke.finish();
  }
  assert.equal(source.cells().length, 5);
  assert.equal(source.references().length, 4);
  const saved = serializeOverworld({ ...world, chunks: source.references() });
  const reopened = parseOverworld(saved);
  assert.deepEqual(reopened.chunks, source.references());
  assert.equal(
    reopened.chunks.reduce((n, c) => n + c.cellCount, 0),
    5,
  );
  for (let i = 0; i < 5; i++) history.undo();
  assert.deepEqual(source.references(), []);
  assert.equal(source.cells().length, 0);
  history.redo();
  assert.equal(source.cells().length, 1);
});
test("A fast diagonal stroke is continuous, previews without mutation, and becomes one exact reversible command", async () => {
  const { history, source } = empty(),
    a = { q: -34, r: -5 },
    b = { q: 40, r: -29 },
    line = axialLine(a, b);
  assert.deepEqual(line[0], a);
  assert.deepEqual(line.at(-1), b);
  for (let i = 1; i < line.length; i++) {
    const previous = line[i - 1]!,
      current = line[i]!;
    assert.equal(
      Math.max(
        Math.abs(current.q - previous.q),
        Math.abs(current.r - previous.r),
        Math.abs(current.q + current.r - previous.q - previous.r),
      ),
      1,
    );
  }
  await source.ensure(line);
  const stroke = new TerrainStroke(source, "forest");
  stroke.add(a);
  stroke.add(b);
  stroke.add(a);
  assert.equal(source.cells().length, 0);
  assert.equal(stroke.preview().length, line.length);
  assert.equal(stroke.finish(), true);
  const painted = source.cells();
  assert.equal(history.undoDepth, 1);
  assert.equal(painted.length, line.length);
  assert(painted.every((c) => c.terrain === "forest"));
  assert.equal(stroke.finish(), false);
  history.undo();
  assert.equal(source.cells().length, 0);
  history.redo();
  assert.deepEqual(source.cells(), painted);
  assert.throws(() => axialLine(a, { q: 1e9, r: 1e9 }), /zu lang/);
});
test("Sea and reset preserve exact previous terrain; repeated no-op strokes keep redo", async () => {
  const { history, source } = empty(),
    a = { q: 1, r: -1 };
  await source.ensure([a]);
  const land = new TerrainStroke(source, "land", "#112233");
  land.add(a);
  land.finish();
  const original = source.read(a);
  const sea = new TerrainStroke(source, "sea");
  sea.add(a);
  sea.finish();
  assert.equal(source.read(a)?.surface, "sea");
  history.undo();
  assert.deepEqual(source.read(a), original);
  const noOp = new TerrainStroke(source, "land", "#112233");
  noOp.add(a);
  assert.equal(noOp.finish(), false);
  assert(history.canRedo);
  history.redo();
  const reset = new TerrainStroke(source, "reset");
  reset.add(a);
  reset.finish();
  assert.equal(source.read(a), null);
  assert.deepEqual(source.references(), []);
  history.undo();
  assert.equal(source.read(a)?.surface, "sea");
});
test("Referenced unloaded terrain cannot be overwritten; concurrent reads deduplicate and failed reads stay retryable", async () => {
  const ref: TerrainReference = {
    q: -1,
    r: 0,
    level: 0,
    file: "terrain/0_-1_0.json",
    cellCount: 1,
    extent: { minQ: -1, maxQ: -1, minR: 0, maxR: 0 },
  };
  const world = parseOverworld(
    JSON.stringify({ ...newOverworld("a", "A", "pointy"), chunks: [ref] }),
  );
  let calls = 0,
    fail = true;
  const history = new AtlasHistory(),
    source = new TerrainSource(world, history, async () => {
      calls++;
      if (fail) throw new Error("Unavailable chunk");
      return JSON.stringify({
        kind: "atlas-terrain",
        version: 1,
        worldId: "a",
        level: 0,
        q: -1,
        r: 0,
        cells: [cell(-1, 0)],
      });
    });
  const a = { q: -1, r: 0 };
  assert.throws(() => new TerrainStroke(source, "sea").add(a), /nicht geladen/);
  assert.deepEqual(source.references(), [ref]);
  await assert.rejects(source.ensure([a]), /Unavailable/);
  assert.equal(source.cells().length, 0);
  fail = false;
  await Promise.all([source.ensure([a]), source.ensure([a])]);
  assert.equal(calls, 2);
  assert.deepEqual(source.read(a), cell(-1, 0));
  const stroke = new TerrainStroke(source, "sea");
  stroke.add(a);
  stroke.finish();
  assert.equal(source.loadedChunks()[0]?.cells[0]?.surface, "sea");
  history.undo();
  assert.deepEqual(source.read(a), cell(-1, 0));
});
test("Terrain codecs reject duplicate, foreign, traversal and inconsistent sparse payloads", async () => {
  const { world, source } = empty(),
    a = { q: -1, r: -1 };
  await source.ensure([a]);
  const stroke = new TerrainStroke(source, "land");
  stroke.add(a);
  stroke.finish();
  const ref = source.references()[0]!,
    doc = source.loadedChunks()[0]!;
  for (const bad of [
    { ...ref, file: "../outside.json" },
    { ...ref, level: 1 },
    { ...ref, extent: { ...ref.extent, minQ: -33 } },
    { ...ref, unknown: true },
  ])
    assert.throws(() =>
      parseOverworld(JSON.stringify({ ...world, chunks: [bad] })),
    );
  assert.throws(() =>
    parseOverworld(JSON.stringify({ ...world, chunks: [ref, ref] })),
  );
  for (const bad of [
    { ...doc, worldId: "other" },
    { ...doc, cells: [cell(0, 0)] },
    { ...doc, cells: [cell(-1, -1), cell(-1, -1)] },
    { ...doc, unknown: true },
  ]) {
    const history = new AtlasHistory(),
      loaded = new TerrainSource(
        { ...world, chunks: [ref] },
        history,
        async () => JSON.stringify(bad),
      );
    await assert.rejects(loaded.ensure([a]));
    assert.equal(loaded.cells().length, 0);
  }
  assert.throws(() => terrainTarget({ q: Number.MAX_SAFE_INTEGER, r: 1 }));
  assert.equal(terrainChunkKey(chunkAddress({ q: -1, r: -1 })), "-1/-1");
});
test("Shared atlas history validates all document owners atomically and exposes immutable command snapshots", () => {
  const history = new AtlasHistory();
  history.register("terrain-world", () => {});
  history.register("city-a", (_target, value) => {
    if (typeof value !== "number" && value !== null)
      throw new Error("bad city");
  });
  history.hydrate("city-a", [["position", 12]]);
  const first = {
    ownerId: "terrain-world",
    target: "0/1/2",
    before: null,
    after: { color: "#112233" },
  };
  assert.throws(
    () =>
      history.execute({
        label: "bad",
        changes: [
          first,
          {
            ownerId: "city-a",
            target: "position",
            before: 12,
            after: "invalid",
          },
        ],
      }),
    /bad city/,
  );
  assert.equal(history.read("terrain-world", first.target), null);
  assert.equal(history.undoDepth, 0);
  const changes = [
    first,
    { ownerId: "city-a", target: "position", before: 12, after: 13 },
  ];
  history.execute({ label: "Both", changes });
  first.after.color = "#ffffff";
  assert.deepEqual(history.read("terrain-world", first.target), {
    color: "#112233",
  });
  assert.equal(history.read("city-a", "position"), 13);
  assert(Object.isFrozen(history.read("terrain-world", first.target)));
  assert.throws(() =>
    history.hydrate("city-a", [
      ["new", 2],
      ["position", 99],
    ]),
  );
  assert.equal(history.read("city-a", "new"), null);
  history.undo();
  assert.equal(history.read("terrain-world", first.target), null);
  assert.equal(history.read("city-a", "position"), 12);
  history.redo();
  assert.equal(history.read("city-a", "position"), 13);
  assert.throws(
    () =>
      history.execute({
        label: "Stale",
        changes: [
          { ownerId: "city-a", target: "position", before: 12, after: 12 },
        ],
      }),
    /kollidiert/,
  );
  assert.throws(
    () =>
      history.execute({
        label: "Duplicate",
        changes: [
          { ownerId: "city-a", target: "position", before: 13, after: 14 },
          { ownerId: "city-a", target: "position", before: 13, after: 14 },
        ],
      }),
    /Doppeltes/,
  );
  assert.equal(history.read("city-a", "position"), 13);
  assert.equal(history.undoDepth, 1);
});

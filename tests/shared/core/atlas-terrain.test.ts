import test from "node:test";
import assert from "node:assert/strict";
import { AtlasHistory } from "../../../src/features/atlas/atlas-history";
import {
  newOverworld,
  parseOverworld,
  serializeOverworld,
} from "../../../src/features/atlas/overworld";
import {
  checkedTerrainCell,
  chunkAddress,
  terrainChunkKey,
  terrainTarget,
  type TerrainCell,
} from "../../../src/features/atlas/terrain-schema";
import {
  TerrainSource,
  TerrainStroke,
} from "../../../src/features/atlas/terrain-source";

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

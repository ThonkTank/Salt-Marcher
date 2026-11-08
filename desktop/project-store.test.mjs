import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const fsPromises = require("node:fs/promises");
const Database = require("better-sqlite3");
const { ProjectStore } = require("../desktop-dist/project-store.cjs");
const {
  createCoastFixture,
  heightTilesFromControls,
} = require("../desktop-dist/model.cjs");

const stores = [];
const directories = [];
async function fresh() {
  const directory = await mkdtemp(join(tmpdir(), "atlas-p0-store-test-"));
  directories.push(directory);
  const activity = [];
  const store = new ProjectStore(join(directory, "work"), (event) =>
    activity.push(event),
  );
  stores.push(store);
  return { store, directory, activity };
}

function write(
  store,
  tiles,
  transactionId = `action-${store.status().sequence + 1}`,
) {
  const status = store.status();
  return store.commit({
    sessionId: status.sessionId,
    sequence: status.sequence + 1,
    transactionId,
    patches: tiles.map((tile) => ({ key: tile.key, after: tile })),
  });
}

function read(store, bounds, level) {
  return store.readRegion({
    sessionId: store.status().sessionId,
    bounds,
    ...(level === undefined ? {} : { level }),
  });
}

afterEach(async () => {
  for (const store of stores.splice(0)) store.close();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

test("the actual Electron SQLite ABI opens a sparse empty world", async () => {
  assert.ok(
    process.versions.electron,
    "Run using ELECTRON_RUN_AS_NODE=1 electron --test desktop/project-store.test.mjs",
  );
  const { store } = await fresh();
  assert.equal(store.status().sequence, 0);
  assert.equal(store.status().sourceTiles, 0);
  assert.deepEqual(
    read(store, [-100_000_000, -100_000_000, 100_000_000, 100_000_000]).tiles,
    [],
  );
  assert.equal(store.metrics().returnedBytes, 0);
});

test("spatial reads include spline neighbors but exclude unrelated remote tiles", async () => {
  const { store } = await fresh();
  const near = heightTilesFromControls(0, [
    [63, 0, -9],
    [-1, -1, 12],
  ]);
  const far = heightTilesFromControls(0, [[2_000_000, 2_000_000, 15]]);
  write(store, [...near, ...far]);
  const boundary = read(store, [320, -1, 322, 1], 0);
  assert.equal(boundary.sequence, 1);
  assert.deepEqual(
    boundary.tiles.map((tile) => tile.key),
    ["height:0:0:0"],
  );
  assert.equal(boundary.tiles[0].values[63], -9);
  assert.deepEqual(
    read(store, [-5, -5, -4, -4]).tiles.map((tile) => tile.key),
    ["height:0:-1:-1", "height:0:0:0"],
  );
  assert.equal(read(store, [100, 100, 101, 101]).tiles.length, 1);
  assert.equal(store.status().sourceTiles, 3);
  assert.equal(store.metrics().returnedTiles, 4);
});

test("a malformed patch never partially writes; replay cannot alter an accepted action", async () => {
  const { store } = await fresh();
  const tiles = createCoastFixture();
  const status = store.status();
  const request = {
    sessionId: status.sessionId,
    sequence: 1,
    transactionId: "first",
    patches: tiles.map((tile) => ({ key: tile.key, after: tile })),
  };
  const invalid = { ...tiles[0], values: tiles[0].values.slice() };
  invalid.values[0] = NaN;
  assert.throws(
    () =>
      store.commit({
        ...request,
        patches: [
          ...request.patches.slice(1),
          { key: invalid.key, after: invalid },
        ],
      }),
    /Nichtendlicher/,
  );
  assert.equal(store.status().sequence, 0);
  assert.equal(store.status().sourceTiles, 0);
  const receipt = store.commit(request);
  assert.deepEqual(store.commit(request), receipt);
  assert.equal(store.metrics().commits, 1);
  assert.throws(
    () => store.commit({ ...request, transactionId: "different" }),
    /Widersprüchliche/,
  );
  assert.throws(
    () => store.commit({ ...request, sequence: 3, transactionId: "skip" }),
    /lückenloser/,
  );
  const changed = { ...tiles[0], values: tiles[0].values.slice() };
  changed.values[0] += 1;
  assert.throws(
    () =>
      store.commit({
        ...request,
        patches: [{ key: changed.key, after: changed }],
      }),
    /Widersprüchliche/,
  );
  assert.equal(store.status().sequence, 1);
});

test("a real SQLite save pins S while later commits change the live WAL", async () => {
  const { store, directory, activity } = await fresh();
  const original = heightTilesFromControls(0, [[0, 0, 40]])[0];
  write(store, [original]);
  const saveBoundary = store.status();
  const preparing = store.prepareSave(saveBoundary);
  const changed = { ...original, revision: 2, values: original.values.slice() };
  changed.values[0] = 70;
  write(store, [changed]);
  const prepared = await preparing;
  const path = join(directory, "saved.saltatlas");
  const result = await store.publishSave(prepared.token, path);
  assert.equal(result.savedSequence, 1);
  assert.equal(result.sequence, 2);
  assert.equal(store.status().savedSequence, 1);
  assert.equal(read(store, [-1, -1, 1, 1]).tiles[0].values[0], 70);
  const reopened = new ProjectStore(join(directory, "reopened-work"));
  stores.push(reopened);
  await reopened.openProject(path);
  assert.equal(reopened.status().sequence, 1);
  assert.equal(read(reopened, [-1, -1, 1, 1]).tiles[0].values[0], 40);
  assert.deepEqual(
    activity.map((event) => [event.kind, event.phase, event.success]),
    [
      ["snapshot", "start", undefined],
      ["snapshot", "end", true],
      ["publish", "start", undefined],
      ["publish", "end", true],
    ],
  );
  assert.ok(
    activity.every(
      (event) => event.sequence === 1 && Number.isFinite(event.epochMs),
    ),
  );
  assert.ok(activity[1].epochMs >= activity[0].epochMs);
  assert.ok(activity[3].epochMs >= activity[2].epochMs);
});

test("an injected target-replacement failure preserves the old real file and saved boundary", async (t) => {
  const { store, directory } = await fresh();
  const tile = heightTilesFromControls(0, [[1, 1, 25]])[0];
  write(store, [tile]);
  const path = join(directory, "existing.saltatlas");
  await store.saveProject(store.status(), path);
  const before = await readFile(path);
  const changed = { ...tile, revision: 2, values: tile.values.slice() };
  changed.values[65] = 80;
  write(store, [changed]);
  t.mock.method(fsPromises, "rename", async () => {
    throw new Error("injected rename failure");
  });
  await assert.rejects(
    store.saveProject(store.status(), path),
    /injected rename failure/,
  );
  assert.deepEqual(await readFile(path), before);
  assert.equal(store.status().sequence, 2);
  assert.equal(store.status().savedSequence, 1);
});

test("cancel and invalid opens keep the current document and source file intact", async () => {
  const { store, directory } = await fresh();
  write(store, createCoastFixture());
  const valid = join(directory, "valid.saltatlas");
  await store.saveProject(store.status(), valid);
  const prior = store.status();
  const before = await readFile(valid);
  const prepared = await store.prepareSave(prior);
  await store.discardSave(prepared.token);
  assert.deepEqual(store.status(), prior);
  await assert.rejects(
    store.publishSave(prepared.token, join(directory, "cancelled.saltatlas")),
    /nicht mehr verfügbar/,
  );
  const legacy = join(directory, "legacy.saltatlas");
  await copyFile(valid, legacy);
  const database = new Database(legacy);
  database.pragma("user_version = 22");
  database.close();
  await assert.rejects(store.openProject(legacy), /Format 23/);
  await assert.rejects(store.openProject(join(directory, "missing.saltatlas")));
  assert.deepEqual(store.status(), prior);
  assert.deepEqual(await readFile(valid), before);
});

test("source deletion becomes absence and old sessions cannot write or read a new project", async () => {
  const { store } = await fresh();
  const tile = heightTilesFromControls(0, [[1, 1, 25]])[0];
  write(store, [tile]);
  const old = store.status();
  store.commit({
    sessionId: old.sessionId,
    sequence: 2,
    transactionId: "delete",
    patches: [{ key: tile.key, after: null }],
  });
  assert.deepEqual(read(store, [-10, -10, 10, 10]).tiles, []);
  assert.deepEqual(store.status().activeLevels, []);
  assert.equal(store.status().sourceTiles, 0);
  store.newProject();
  assert.throws(
    () => store.readTiles({ sessionId: old.sessionId, keys: [tile.key] }),
    /Veraltete/,
  );
  assert.throws(
    () =>
      store.commit({
        sessionId: old.sessionId,
        sequence: 3,
        transactionId: "stale",
        patches: [{ key: tile.key, after: tile }],
      }),
    /Veraltete/,
  );
});

test("open reconstructs a stale spatial index without hiding real author tiles or changing the file", async () => {
  const { store, directory } = await fresh();
  const tiles = createCoastFixture();
  write(store, tiles);
  const path = join(directory, "stale-index.saltatlas");
  await store.saveProject(store.status(), path);
  const database = new Database(path);
  database.prepare("DELETE FROM height_spatial").run();
  database
    .prepare("UPDATE height_tiles SET min_x=0,max_x=0,min_y=0,max_y=0")
    .run();
  database.close();
  const before = await readFile(path);
  await store.openProject(path);
  assert.equal(
    read(store, [-2000, -1000, 2000, 1000]).tiles.length,
    tiles.length,
  );
  assert.deepEqual(await readFile(path), before);
});

test("oversized spatial results fail instead of certifying truncated data as absent", async () => {
  const { store } = await fresh();
  const controls = Array.from({ length: 513 }, (_, i) => [i * 64, 0, 1]);
  const tiles = heightTilesFromControls(0, controls);
  write(store, tiles.slice(0, 512));
  write(store, tiles.slice(512));
  assert.throws(
    () => read(store, [-1, -1, 200_000, 100]),
    /zu viele Höhenkacheln/,
  );
  assert.equal(store.metrics().returnedTiles, 0);
  assert.equal(read(store, [-1, -1, 1, 1]).tiles.length, 1);
});

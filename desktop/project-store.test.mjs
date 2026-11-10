import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  referenceLandscapeSample,
  referenceLandscapeGrid,
} from "../scripts/atlas-p3-landscape-reference.mjs";
import { afterEach, test } from "node:test";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, copyFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron } from "@playwright/test";

const require = createRequire(import.meta.url);
const fsPromises = require("node:fs/promises");
const Database = require("better-sqlite3");
const { ProjectStore } = require("../desktop-dist/project-store.cjs");
const {
  createCoastFixture,
  EditorDocument,
  LANDSCAPE_TILE_BYTES,
  createLandscapeTile,
  prepareLandscapePresentation,
  heightTilesFromControls,
  heightTileKey,
  heightFromScaledSum,
  prepareScaledHeightSum,
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
    patches: tiles.map((tile) => ({
      kind: "height",
      key: tile.key,
      after: tile,
    })),
  });
}

function read(store, bounds, level) {
  return store.readRegion({
    sessionId: store.status().sessionId,
    bounds,
    minLevel: 0,
    ...(level === undefined ? {} : { level }),
  });
}

function writeSources(store, patches) {
  const info = store.status();
  return store.commit({
    sessionId: info.sessionId,
    sequence: info.sequence + 1,
    transactionId: `action-${info.sequence + 1}`,
    patches,
  });
}
const landscapePatch = (after) => ({
  kind: "landscape",
  key: after.key,
  after,
});
function landscapeRead(store, bounds, minLevel = 0) {
  return store.readLandscapeRegion({
    sessionId: store.status().sessionId,
    bounds,
    minLevel,
  });
}
function landscapeCell(tile, x, y, weights) {
  const spacing = 2 ** tile.level;
  const index =
    (Math.floor(y / spacing) - tile.tileY * 64) * 64 +
    Math.floor(x / spacing) -
    tile.tileX * 64;
  assert.ok(index >= 0 && index < 4096);
  tile.mask[index] = 1;
  tile.values.set(weights, index * 4);
}
function landscapeFill(level, tileX, tileY, weights) {
  const tile = createLandscapeTile(level, tileX, tileY);
  tile.mask.fill(1);
  for (let i = 0; i < 4096; i++) tile.values.set(weights, i * 4);
  return tile;
}
function assertLandscapeReference(store, sources, power, tileX = 0, tileY = 0) {
  const span = 128 * 2 ** power;
  const bounds = [
    tileX * span,
    tileY * span,
    (tileX + 1) * span,
    (tileY + 1) * span,
  ];
  const read = store.readLandscapePresentation({
    sessionId: store.status().sessionId,
    bounds,
    power,
  });
  const sample = prepareLandscapePresentation(read),
    actual = new Uint8Array(128 * 128 * 4),
    step = 2 ** power;
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++)
      actual.set(
        sample(bounds[0] + (x + 0.5) * step, bounds[1] + (y + 0.5) * step),
        (y * 128 + x) * 4,
      );
  assert.deepEqual(
    actual,
    referenceLandscapeGrid(sources, power, tileX, tileY),
  );
  return read;
}
function fineLandscapeDigest(store) {
  const hash = createHash("sha256");
  for (const row of store.current.database
    .prepare(
      "SELECT level,tile_x,tile_y,revision,mask_blob,values_blob FROM landscape_tiles WHERE level=0 ORDER BY tile_x,tile_y",
    )
    .all()) {
    hash.update(
      JSON.stringify([row.level, row.tile_x, row.tile_y, row.revision]),
    );
    hash.update(row.mask_blob).update(row.values_blob);
  }
  return hash.digest("hex");
}

test("landscape starts sparse and shares atomic validation, receipt identity and session boundaries with height", async () => {
  const { store } = await fresh();
  const info = store.status();
  assert.equal(info.format, 25);
  assert.equal(info.landscapeTiles, 0);
  assert.deepEqual(info.activeLandscapeLevels, []);
  assert.deepEqual(landscapeRead(store, [-100, -100, 100, 100]).tiles, []);
  assert.deepEqual(
    store.readLandscapePresentation({
      sessionId: info.sessionId,
      bounds: [-100, -100, 100, 100],
      power: 8,
    }).overviews,
    [],
  );
  for (const table of ["landscape_tiles", "landscape_overviews"])
    assert.equal(
      store.current.database.prepare(`SELECT count(*) AS n FROM ${table}`).get()
        .n,
      0,
    );
  const height = heightTilesFromControls(0, [[0, 0, 40]])[0];
  const clearing = createLandscapeTile(0, 0, 0);
  landscapeCell(clearing, 1, 1, [0, 0, 0, 0]);
  const request = {
    sessionId: info.sessionId,
    sequence: 1,
    transactionId: "shared-action",
    patches: [
      { kind: "height", key: height.key, after: height },
      landscapePatch(clearing),
    ],
  };
  const invalid = { ...clearing, mask: clearing.mask.slice() };
  invalid.mask[0] = 2;
  assert.throws(
    () =>
      store.commit({
        ...request,
        patches: [request.patches[0], landscapePatch(invalid)],
      }),
    /maske/i,
  );
  assert.equal(store.status().sequence, 0);
  assert.equal(store.status().sourceTiles, 0);
  assert.equal(store.status().landscapeTiles, 0);
  assert.throws(
    () =>
      store.commit({
        ...request,
        patches: [{ ...request.patches[0], kind: "unknown" }],
      }),
    /Quellenart/,
  );
  assert.throws(
    () =>
      store.commit({
        ...request,
        patches: [{ ...landscapePatch(clearing), key: height.key }],
      }),
    /Landschaftsquellen/,
  );
  const receipt = store.commit(request);
  assert.deepEqual(store.commit(request), receipt);
  assert.equal(store.status().sourceTiles, 1);
  assert.equal(store.status().landscapeTiles, 1);
  assert.deepEqual(store.status().activeLandscapeLevels, [0]);
  const changed = { ...clearing, mask: clearing.mask.slice() };
  changed.mask[0] = 1;
  assert.throws(
    () =>
      store.commit({
        ...request,
        patches: [request.patches[0], landscapePatch(changed)],
      }),
    /Widersprüchliche/,
  );
  store.newProject(store.status());
  assert.throws(() => store.commit(request), /Veraltete/);
  assert.throws(
    () =>
      store.readLandscapeRegion({
        sessionId: info.sessionId,
        bounds: [0, 0, 10, 10],
        minLevel: 0,
      }),
    /Veraltete/,
  );
});

test("fine clearings and four-channel authors survive coarse edits, snapshot S and a real reopen", async () => {
  const { store, directory } = await fresh();
  const coarse = [
    landscapeFill(3, -1, -1, [130, 50, 40, 20]),
    landscapeFill(3, 0, 0, [130, 50, 40, 20]),
  ];
  const fine = [createLandscapeTile(0, -1, -1), createLandscapeTile(0, 0, 0)];
  for (let y = -4; y < 0; y++)
    for (let x = -4; x < 0; x++) landscapeCell(fine[0], x, y, [0, 0, 0, 0]);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) landscapeCell(fine[1], x, y, [0, 0, 0, 0]);
  landscapeCell(fine[0], -6, -6, [0, 255, 0, 0]);
  writeSources(store, [...coarse, ...fine].map(landscapePatch));
  const initialDigest = fineLandscapeDigest(store);
  for (const x of [-1, 0])
    assertLandscapeReference(store, [...coarse, ...fine], 2, x, x);
  const changed = coarse.map((tile) =>
    landscapeFill(3, tile.tileX, tile.tileY, [255, 0, 0, 0]),
  );
  writeSources(store, changed.map(landscapePatch));
  assert.equal(fineLandscapeDigest(store), initialDigest);
  const sources = [...changed, ...fine];
  for (const point of [
    [-0.5, -0.5],
    [1.5, 1.5],
  ])
    assert.deepEqual(referenceLandscapeSample(sources, ...point), [0, 0, 0, 0]);
  assert.deepEqual(
    referenceLandscapeSample(sources, -5.5, -5.5),
    [0, 255, 0, 0],
  );
  assert.deepEqual(referenceLandscapeSample(sources, 6, 6), [255, 0, 0, 0]);
  for (const x of [-1, 0]) assertLandscapeReference(store, sources, 2, x, x);
  const preparing = store.prepareSave(store.status());
  const later = changed.map((tile) =>
    landscapeFill(3, tile.tileX, tile.tileY, [0, 0, 0, 255]),
  );
  writeSources(store, later.map(landscapePatch));
  const prepared = await preparing;
  const file = join(directory, "landscape.saltatlas");
  const saved = await store.publishSave(prepared.token, file);
  assert.equal(saved.savedSequence, 2);
  assert.equal(saved.sequence, 3);
  assert.equal(store.status().savedSequence, 2);
  const reopened = new ProjectStore(join(directory, "landscape-reopened"));
  stores.push(reopened);
  await reopened.openProject(file);
  assert.equal(reopened.status().sequence, 2);
  assert.equal(reopened.status().landscapeTiles, 4);
  assert.equal(fineLandscapeDigest(reopened), initialDigest);
  for (const x of [-1, 0]) assertLandscapeReference(reopened, sources, 2, x, x);
  const restored = landscapeRead(reopened, [-64, -64, 64, 64]);
  assert.deepEqual(
    restored.tiles.find((tile) => tile.key === fine[0].key).mask,
    fine[0].mask,
  );
  assert.deepEqual(
    restored.tiles.find((tile) => tile.key === fine[0].key).values,
    fine[0].values,
  );
});

test("removing fine ownership restores coarser inheritance in persistent numerical overviews", async () => {
  const { store } = await fresh();
  const coarse = landscapeFill(3, 0, 0, [255, 0, 0, 0]),
    middle = landscapeFill(1, 0, 0, [0, 0, 255, 0]),
    fine = landscapeFill(0, 0, 0, [0, 0, 0, 0]);
  writeSources(store, [coarse, middle, fine].map(landscapePatch));
  assertLandscapeReference(store, [coarse, middle, fine], 4);
  const before = store.metrics();
  writeSources(store, [{ kind: "landscape", key: fine.key, after: null }]);
  assertLandscapeReference(store, [coarse, middle], 4);
  assert.ok(
    store.metrics().landscapeOverviewSourceLookups >
      before.landscapeOverviewSourceLookups,
  );
  assert.equal(store.metrics().landscapeOverviewFineSourceLookups, 0);
  writeSources(store, [{ kind: "landscape", key: middle.key, after: null }]);
  assertLandscapeReference(store, [coarse], 4);
  writeSources(store, [{ kind: "landscape", key: coarse.key, after: null }]);
  assertLandscapeReference(store, [], 4);
  assert.equal(store.status().landscapeTiles, 0);
  assert.equal(
    store.current.database
      .prepare("SELECT count(*) AS n FROM landscape_overviews")
      .get().n,
    0,
  );
});

test("coarse landscape editing and presentation stay bounded when persisted fine sources exceed the active source budget", async () => {
  const { store } = await fresh();
  const fine = Array.from({ length: 520 }, (_, index) => {
    const tile = createLandscapeTile(0, index, 16);
    landscapeCell(tile, index * 64, 1024, [0, 0, 0, 0]);
    return tile;
  });
  for (let offset = 0; offset < fine.length; offset += 128)
    writeSources(store, fine.slice(offset, offset + 128).map(landscapePatch));
  assert.equal(store.status().landscapeTiles, 520);
  const bounds = [0, 1024, 520 * 64, 4096];
  assert.throws(
    () => landscapeRead(store, bounds),
    /zu viele Landschaftskacheln/,
  );
  const activeSourceBudget = 4 * LANDSCAPE_TILE_BYTES;
  const persistedFineBytes = store.current.database
    .prepare(
      "SELECT sum(length(mask_blob)+length(values_blob)) AS bytes FROM landscape_tiles WHERE level=0",
    )
    .get().bytes;
  assert.equal(persistedFineBytes, 520 * LANDSCAPE_TILE_BYTES);
  assert.ok(persistedFineBytes > activeSourceBudget);
  const info = store.status();
  const document = new EditorDocument(info.sessionId, {
    sequence: info.sequence,
    empty: true,
    landscapeEmpty: false,
    maxSourceBytes: activeSourceBudget,
  });
  // Five ordinary sources fit the read limit but exceed actual document residency.
  assert.throws(
    () =>
      document.acceptLandscapeCoverage(
        [0, 1024, 320, 1088],
        fine.slice(0, 5),
        info.sequence,
        info.sessionId,
        0,
      ),
    /Speicherbudget/,
  );
  assert.equal(document.metrics.sourceBytes, 0);
  assert.equal(document.metrics.landscapeReadyTiles, 0);
  const digest = fineLandscapeDigest(store),
    before = store.metrics();
  const editBounds = [-2048, -2048, 6144, 6144],
    needed = landscapeRead(store, editBounds, 9);
  assert.equal(needed.tiles.length, 0);
  document.acceptLandscapeCoverage(
    editBounds,
    needed.tiles,
    needed.sequence,
    needed.sessionId,
    9,
  );
  document.beginLandscapeGesture({
    level: 9,
    radius: 4096,
    weights: [255, 0, 0, 0],
  });
  document.applyLandscapeSegment([2048, 2048], [2048, 2048]);
  document.sealLandscapeGesture();
  const change = document.finishLandscapeGesture();
  assert.ok(change);
  assert.ok(document.metrics.sourceBytes <= activeSourceBudget);
  assert.equal(document.metrics.landscapeReadyTiles, 4);
  assert.ok(
    change.patches.every(
      (patch) => patch.kind === "landscape" && patch.after.level === 9,
    ),
  );
  document.acknowledge(store.commit(change));
  const coarse = change.patches.map((patch) => patch.after);
  assert.equal(fineLandscapeDigest(store), digest);
  const after = store.metrics();
  assert.equal(after.returnedLandscapeTiles - before.returnedLandscapeTiles, 0);
  assert.equal(
    after.landscapeOverviewSourceLookups -
      before.landscapeOverviewSourceLookups,
    0,
  );
  assert.equal(
    after.landscapeOverviewFineSourceLookups -
      before.landscapeOverviewFineSourceLookups,
    0,
  );
  assert.ok(
    after.landscapeOverviewExaminedSamples -
      before.landscapeOverviewExaminedSamples <=
      change.patches.length * 1400,
  );
  assert.ok(after.landscapeOverviewCachePeakBytes <= 32 * 128 * 128 * 6);
  const beforeRead = store.metrics();
  const read = store.readLandscapePresentation({
    sessionId: store.status().sessionId,
    bounds,
    power: 11,
  });
  assert.ok(read.tiles.every((tile) => tile.level >= 11));
  assert.equal(
    store.metrics().returnedLandscapeTiles - beforeRead.returnedLandscapeTiles,
    0,
  );
  const sample = prepareLandscapePresentation(read);
  assert.deepEqual(sample(1024, 1024), [0, 0, 0, 0]);
  assert.deepEqual(
    sample(3072, 1024),
    referenceLandscapeSample([...fine, ...coarse], 3072, 1024),
  );
  assert.deepEqual(sample(1024, 3072), [255, 0, 0, 0]);
  assert.ok(document.metrics.sourceBytes <= activeSourceBudget);
  assert.equal(document.metrics.landscapeReadyTiles, 4);
});

test("reopen rebuilds landscape headers locally and rejects an uncertified overview before replacing the session", async () => {
  const { store, directory } = await fresh();
  const source = landscapeFill(0, -1, -1, [0, 255, 0, 0]);
  writeSources(store, [landscapePatch(source)]);
  const file = join(directory, "landscape-index.saltatlas");
  await store.saveProject(store.status(), file);
  const database = new Database(file);
  database.exec(
    "DELETE FROM landscape_spatial; UPDATE landscape_tiles SET min_x=0,max_x=0,min_y=0,max_y=0",
  );
  database.close();
  const original = await readFile(file);
  await store.openProject(file);
  assert.equal(store.status().landscapeTiles, 1);
  assert.equal(store.metrics().returnedLandscapeTiles, 0);
  const selected = landscapeRead(store, [-64, -64, -1, -1]);
  assert.equal(selected.tiles.length, 1);
  assert.deepEqual(selected.tiles[0].values, source.values);
  assert.deepEqual(await readFile(file), original);
  const stale = join(directory, "stale-landscape.saltatlas");
  await copyFile(file, stale);
  const broken = new Database(stale);
  broken.exec("UPDATE landscape_overview_state SET sequence=sequence-1");
  broken.close();
  const prior = store.status();
  await assert.rejects(store.openProject(stale), /Landschaftsübersicht/);
  assert.deepEqual(store.status(), prior);
});

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
    patches: tiles.map((tile) => ({
      kind: "height",
      key: tile.key,
      after: tile,
    })),
  };
  const invalid = { ...tiles[0], values: tiles[0].values.slice() };
  invalid.values[0] = NaN;
  assert.throws(
    () =>
      store.commit({
        ...request,
        patches: [
          ...request.patches.slice(1),
          { kind: "height", key: invalid.key, after: invalid },
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
        patches: [{ kind: "height", key: changed.key, after: changed }],
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

test("the utility dispatcher answers local reads during a real snapshot and orders later writes", async () => {
  const { store, directory } = await fresh();
  const height = heightTilesFromControls(0, [[0, 0, 40]])[0];
  const landscape = landscapeFill(0, 0, 0, [80, 20, 0, 0]);
  writeSources(store, [
    { kind: "height", key: height.key, after: height },
    landscapePatch(landscape),
  ]);
  const fixture = join(directory, "fixture.saltatlas");
  await store.saveProject(store.status(), fixture);
  const main = join(directory, "main.cjs");
  const worker = join(directory, "store-test.cjs");
  await writeFile(
    main,
    'require("electron").app.disableHardwareAcceleration();',
  );
  // Hold the real SQLite backup after its first copied page. This controls only
  // the test's I/O timing; the utility port, dispatcher and database stay real.
  await writeFile(
    worker,
    `const Database = require(${JSON.stringify(require.resolve("better-sqlite3"))});
const backup = Database.prototype.backup;
let released = false;
process.parentPort.on("message", ({ data }) => {
  if (data.releaseSnapshot) released = true;
});
Database.prototype.backup = function(path, options) {
  if (!path.includes("snapshot-")) return backup.call(this, path, options);
  let announced = false;
  return backup.call(this, path, { ...options, progress(progress) {
    if (released) return 100;
    if (progress.remainingPages === progress.totalPages) return 1;
    if (!announced) {
      announced = true;
      process.parentPort.postMessage({ snapshotPaused: progress });
    }
    return 0;
  }});
};
require(${JSON.stringify(require.resolve("../desktop-dist/store-process.cjs"))});
`,
  );
  const env = { ...process.env, ATLAS_P0_DIAGNOSTICS: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    executablePath: require("electron"),
    args: ["--ozone-platform=headless", main],
    env,
    timeout: 15_000,
  });
  try {
    const result = await app.evaluate(
      async ({ app, utilityProcess }, { worker, directory, fixture }) => {
        await app.whenReady();
        const child = utilityProcess.fork(worker, [directory], {
          stdio: "pipe",
        });
        const pending = new Map();
        const events = [];
        const ready = Promise.withResolvers();
        const paused = Promise.withResolvers();
        ready.promise.catch(() => {});
        paused.promise.catch(() => {});
        const watchdog = setTimeout(() => child.kill(), 15_000);
        let serial = 0;
        let output = "";
        child.stderr.on("data", (data) => (output += String(data)));
        child.on("message", (message) => {
          if (message.ready) ready.resolve();
          if (message.fatal) ready.reject(new Error(message.fatal));
          if (message.activity)
            events.push(`${message.activity.kind}:${message.activity.phase}`);
          if (message.snapshotPaused) paused.resolve(message.snapshotPaused);
          const task = pending.get(message.id);
          if (!task) return;
          pending.delete(message.id);
          clearTimeout(task.timer);
          events.push(task.method);
          if (message.error) task.reject(new Error(message.error));
          else task.resolve(message.value);
        });
        child.on("exit", (code) => {
          const error = new Error(`Utility exited (${code}): ${output}`);
          ready.reject(error);
          paused.reject(error);
          for (const task of pending.values()) {
            clearTimeout(task.timer);
            task.reject(error);
          }
          pending.clear();
        });
        function request(method, argument) {
          const id = ++serial;
          const promise = new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              pending.delete(id);
              reject(new Error(`Utility request timed out: ${method}`));
            }, 5_000);
            pending.set(id, { method, resolve, reject, timer });
            child.postMessage({ id, method, argument });
          });
          // A failure is rethrown by its await, including requests kept pending
          // deliberately while the read overtakes the snapshot and commit.
          promise.catch(() => {});
          return promise;
        }
        try {
          await ready.promise;
          const initial = await request("openProject", { path: fixture });
          const bounds = [-1, -1, 1, 1];
          const query = { sessionId: initial.sessionId, bounds };
          const original = (await request("readRegion", query)).tiles[0];
          const changed = {
            ...original,
            revision: 2,
            values: original.values.slice(),
          };
          changed.values[0] = 70;
          const preparing = request("prepareSave", initial);
          const progress = await Promise.race([
            paused.promise,
            preparing.then(() => {
              throw new Error(
                "Snapshot finished before the controlled read overlap.",
              );
            }),
          ]);
          const committing = request("commit", {
            sessionId: initial.sessionId,
            sequence: initial.sequence + 1,
            transactionId: "after-snapshot",
            patches: [{ kind: "height", key: changed.key, after: changed }],
          });
          const [
            region,
            presentation,
            landscapeRegion,
            landscapePresentation,
            stale,
          ] = await Promise.all([
            request("readRegion", query),
            request("readPresentation", { ...query, power: 0 }),
            request("readLandscapeRegion", { ...query, minLevel: 0 }),
            request("readLandscapePresentation", { ...query, power: 1 }),
            request("readRegion", {
              ...query,
              sessionId: "stale-session",
            }).catch((error) => error.message),
          ]);
          const beforeRelease = events.slice();
          child.postMessage({ releaseSnapshot: true });
          const prepared = await preparing;
          const receipt = await committing;
          const target = `${directory}/saved.saltatlas`;
          const saved = await request("publishSave", {
            token: prepared.token,
            path: target,
          });
          const live = await request("readRegion", query);
          const reopened = await request("openProject", {
            path: target,
            expected: receipt,
          });
          const restored = await request("readRegion", {
            ...query,
            sessionId: reopened.sessionId,
          });
          await request("close", reopened);
          const closed = await request("readRegion", {
            ...query,
            sessionId: reopened.sessionId,
          }).catch((error) => error.message);
          return {
            progress,
            beforeRelease,
            events,
            sameSession:
              region.sessionId === initial.sessionId &&
              presentation.sessionId === initial.sessionId,
            region: {
              sequence: region.sequence,
              height: region.tiles[0].values[0],
            },
            presentation: {
              sequence: presentation.sequence,
              height: presentation.tiles[0].values[0],
            },
            landscapeRegion: {
              sequence: landscapeRegion.sequence,
              weight: landscapeRegion.tiles[0].values[0],
            },
            landscapePresentation: {
              sequence: landscapePresentation.sequence,
              weight: landscapePresentation.overviews[0].own[0],
              fineTiles: landscapePresentation.tiles.length,
            },
            stale,
            saved,
            live: { sequence: live.sequence, height: live.tiles[0].values[0] },
            restored: {
              sequence: restored.sequence,
              height: restored.tiles[0].values[0],
            },
            closed,
          };
        } finally {
          clearTimeout(watchdog);
          child.kill();
        }
      },
      { worker, directory: join(directory, "utility-work"), fixture },
    );
    assert.ok(result.progress.remainingPages > 0);
    assert.ok(result.progress.remainingPages < result.progress.totalPages);
    assert.ok(result.beforeRelease.includes("snapshot:start"));
    assert.ok(!result.beforeRelease.includes("snapshot:end"));
    assert.ok(!result.beforeRelease.includes("commit"));
    assert.equal(result.sameSession, true);
    assert.deepEqual(result.region, { sequence: 1, height: 40 });
    assert.deepEqual(result.presentation, { sequence: 1, height: 40 });
    assert.deepEqual(result.landscapeRegion, { sequence: 1, weight: 80 });
    assert.deepEqual(result.landscapePresentation, {
      sequence: 1,
      weight: 80,
      fineTiles: 0,
    });
    assert.match(result.stale, /Veraltete/);
    const snapshotEnd = result.events.indexOf("snapshot:end");
    assert.ok(
      snapshotEnd >= 0 && snapshotEnd < result.events.indexOf("commit"),
    );
    assert.equal(result.saved.savedSequence, 1);
    assert.equal(result.saved.sequence, 2);
    assert.deepEqual(result.live, { sequence: 2, height: 70 });
    assert.deepEqual(result.restored, { sequence: 1, height: 40 });
    assert.match(result.closed, /geschlossen/);
  } finally {
    await app.close();
  }
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
  await assert.rejects(store.openProject(legacy), /Format 25/);
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
    patches: [{ kind: "height", key: tile.key, after: null }],
  });
  assert.deepEqual(read(store, [-10, -10, 10, 10]).tiles, []);
  assert.deepEqual(store.status().activeLevels, []);
  assert.equal(store.status().sourceTiles, 0);
  store.newProject();
  assert.throws(
    () =>
      store.readRegion({
        sessionId: old.sessionId,
        bounds: [-10, -10, 10, 10],
      }),
    /Veraltete/,
  );
  assert.throws(
    () =>
      store.readPresentation({
        sessionId: old.sessionId,
        bounds: [-10, -10, 10, 10],
        power: 0,
      }),
    /Veraltete/,
  );
  assert.throws(
    () =>
      store.commit({
        sessionId: old.sessionId,
        sequence: 3,
        transactionId: "stale",
        patches: [{ kind: "height", key: tile.key, after: tile }],
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

test("a dense overview reads exact fine sums without loading its 1024 fine authors", async () => {
  const { store, directory } = await fresh();
  let batch = [];
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      batch.push({
        key: heightTileKey(0, x, y),
        level: 0,
        tileX: x,
        tileY: y,
        revision: 1,
        values: new Float64Array(4096).fill(180),
      });
      if (batch.length === 128) {
        write(store, batch);
        batch = [];
      }
    }
  const bounds = [-1, -1, 10241, 10241];
  assert.throws(() => read(store, bounds), /zu viele Höhenkacheln/);
  const presentation = () =>
    store.readPresentation({
      sessionId: store.status().sessionId,
      bounds,
      power: 7,
    });
  const height = (view) => {
    const tile = view.overviews.find(
      (entry) => entry.tileX === 0 && entry.tileY === 0,
    );
    assert.ok(tile, "The real fine field must appear in the overview.");
    return heightFromScaledSum(
      prepareScaledHeightSum(view.tiles)(64, 64) + tile.values[0],
    );
  };
  const beforeReads = store.metrics();
  const before = presentation();
  assert.equal(before.tiles.length, 0);
  assert.equal(before.overviewKeys.length, 4);
  assert.ok(Math.abs(height(before) - 80) < 1e-9);
  assert.equal(store.metrics().returnedTiles - beforeReads.returnedTiles, 0);
  assert.ok(
    store.metrics().returnedBytes - beforeReads.returnedBytes <=
      4 * 128 * 128 * 8,
  );
  const coarse = heightTilesFromControls(9, [[0, 0, 100]])[0];
  const priorMetrics = store.metrics();
  write(store, [coarse]);
  const changed = presentation();
  assert.equal(changed.tiles.length, 1);
  assert.deepEqual(changed.overviews, before.overviews);
  const t = 1 / 40; // 64 feet / level9's 2560-foot author spacing.
  const weight = (3 * t ** 3 - 6 * t ** 2 + 4) / 6;
  assert.ok(Math.abs(height(changed) - (80 + 100 * weight ** 2)) < 1e-9);
  assert.equal(store.metrics().committedTiles - priorMetrics.committedTiles, 1);
  assert.ok(
    store.metrics().overviewUpdatedSamples -
      priorMetrics.overviewUpdatedSamples <=
      16,
  );
  assert.ok(store.metrics().overviewCachePeakBytes <= 32 * 1024 * 1024);
  const file = join(directory, "dense.saltatlas");
  await store.saveProject(store.status(), file);
  await store.openProject(file);
  assert.ok(Math.abs(height(presentation()) - height(changed)) < 1e-9);
  const current = store.status();
  store.commit({
    sessionId: current.sessionId,
    sequence: current.sequence + 1,
    transactionId: "undo-coarse",
    patches: [{ kind: "height", key: coarse.key, after: null }],
  });
  assert.ok(Math.abs(height(presentation()) - 80) < 1e-9);
  assert.equal(store.status().sourceTiles, 1024);
  write(store, [coarse]);
  assert.ok(Math.abs(height(presentation()) - height(changed)) < 1e-9);

  // Count actual author-header evaluation in the store's normal presentation
  // query, independently of the returned payload count. Filtering level only
  // after the spatial lookup would inspect all 1024 fine authors here.
  const database = store.current.database;
  let authorHeaderReads = 0;
  database.function("count_author_level", (level) => {
    authorHeaderReads++;
    return level;
  });
  database.pragma("trusted_schema = ON");
  database.exec(`
    ALTER TABLE height_tiles RENAME TO height_author_rows;
    CREATE VIEW height_tiles AS
    SELECT id, count_author_level(level) AS level, tile_x, tile_y,
      revision, values_blob, min_x, max_x, min_y, max_y
    FROM height_author_rows;
  `);
  assert.equal(presentation().tiles.length, 1);
  assert.ok(
    authorHeaderReads > 0 && authorHeaderReads <= 3,
    `A coarse read evaluated ${authorHeaderReads} author headers.`,
  );
});

test("an incomplete overview is rejected instead of treated as empty terrain", async () => {
  const { store, directory } = await fresh();
  write(store, createCoastFixture());
  const file = join(directory, "old-overview.saltatlas");
  await store.saveProject(store.status(), file);
  const database = new Database(file);
  database.exec("UPDATE height_overview_state SET sequence=0");
  database.close();
  const prior = store.status();
  await assert.rejects(
    store.openProject(file),
    /Höhenübersicht fehlt|alten Quellenstand/,
  );
  assert.deepEqual(store.status(), prior);
});

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
  encodeHeightDependency,
  HEIGHT_LEVELS,
  waterBounds,
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

const houseHeader = (id = "test-house", fields = {}) => ({
  id,
  revision: 1,
  x: 100,
  y: 100,
  width: 30,
  depth: 20,
  rotation: 30,
  foundationHeight: 1,
  foundationTransition: 10,
  ...fields,
});
const housePatch = (header) => ({
  kind: "house",
  key: `house:${header.id}`,
  after: header,
});
const housesRead = (store, bounds) =>
  store.readHouseRegion({ sessionId: store.status().sessionId, bounds });
function terrainAuthorDigest(store) {
  const digest = createHash("sha256");
  for (const table of ["height_tiles", "landscape_tiles"])
    for (const row of store.current.database
      .prepare(`SELECT * FROM ${table} ORDER BY level,tile_x,tile_y`)
      .all())
      digest.update(JSON.stringify(row));
  return digest.digest("hex");
}

const lakeSource = (id = "test-lake", fields = {}) => {
  const source = {
    kind: "lake",
    id,
    revision: 1,
    name: "Testsee",
    rings: [
      [
        [-80, -80],
        [80, -80],
        [80, 80],
        [-80, 80],
      ],
      [
        [-20, -20],
        [20, -20],
        [20, 20],
        [-20, 20],
      ],
    ],
    level: 32,
    terrain: {
      kind: "height",
      bounds: [-100, -100, 100, 100],
      identity: `height-controls-v1:${"0".repeat(64)}`,
    },
    ...fields,
  };
  if (!fields.terrain) source.terrain.bounds = waterBounds(source);
  return source;
};
const riverSource = (id = "test-river", fields = {}) => {
  const source = {
    kind: "river",
    id,
    revision: 1,
    name: "Testfluss",
    samples: [
      { point: [0, 0], width: 10, level: 20 },
      { point: [20, 0], width: 10, level: 18 },
    ],
    terrain: {
      kind: "height",
      bounds: [-100, -100, 100, 100],
      identity: `height-controls-v1:${"1".repeat(64)}`,
    },
    ...fields,
  };
  if (!fields.terrain) source.terrain.bounds = waterBounds(source);
  return source;
};
const waterPatch = (after) => ({
  kind: "water",
  key: `water:${after.id}`,
  after,
});
const watersRead = (store, bounds = [-1000, -1000, 1000, 1000]) =>
  store.readWaterRegion({ sessionId: store.status().sessionId, bounds });
function waterAuthors(store) {
  return store.current.database
    .prepare(
      "SELECT water_id,kind,revision,source_json FROM water_sources ORDER BY water_id",
    )
    .all();
}

test("water masks and profiles share atomic validation, rollback and replay receipts with all author kinds", async () => {
  const { store } = await fresh();
  const initial = store.status();
  assert.equal(initial.waters, 0);
  const lake = lakeSource(),
    river = riverSource();
  const height = heightTilesFromControls(0, [[0, 0, 140]])[0];
  const landscape = landscapeFill(0, 0, 0, [100, 0, 0, 0]);
  const request = {
    sessionId: initial.sessionId,
    sequence: 1,
    transactionId: "mixed-water-action",
    patches: [
      { kind: "height", key: height.key, after: height },
      landscapePatch(landscape),
      housePatch(houseHeader()),
      waterPatch(lake),
      waterPatch(river),
    ],
  };
  for (const invalid of [
    { level: NaN },
    { revision: -1 },
    { id: "wrong-id" },
    { name: "x".repeat(161) },
    {
      rings: [
        [
          [0, 0],
          [1, 1],
          [2, 2],
        ],
      ],
    },
    { terrain: { ...lake.terrain, identity: "runtime-revision:1" } },
    {
      rings: [
        Array.from({ length: 513 }, (_, i) => [Math.cos(i), Math.sin(i)]),
      ],
    },
  ])
    assert.throws(() =>
      store.commit({
        ...request,
        patches: [
          ...request.patches.slice(0, 3),
          { ...waterPatch(lake), after: { ...lake, ...invalid } },
        ],
      }),
    );
  assert.throws(() =>
    store.commit({
      ...request,
      patches: [
        waterPatch({
          ...river,
          samples: [river.samples[0], { ...river.samples[1], level: 21 }],
        }),
      ],
    }),
  );
  assert.throws(() =>
    store.commit({
      ...request,
      patches: [
        waterPatch({
          ...river,
          samples: [river.samples[0], { ...river.samples[1], width: 0 }],
        }),
      ],
    }),
  );
  assert.equal(store.status().sequence, 0);
  store.current.database.exec(
    "CREATE TRIGGER reject_water BEFORE INSERT ON water_sources BEGIN SELECT RAISE(ABORT,'isolated water failure'); END",
  );
  assert.throws(() => store.commit(request), /isolated water failure/);
  for (const table of [
    "height_tiles",
    "landscape_tiles",
    "house_headers",
    "water_sources",
    "water_spatial",
    "height_overviews",
    "landscape_overviews",
    "transaction_receipts",
  ])
    assert.equal(
      store.current.database.prepare(`SELECT count(*) AS n FROM ${table}`).get()
        .n,
      0,
    );
  assert.equal(store.status().waters, 0);
  assert.equal(store.status().sequence, 0);
  store.current.database.exec("DROP TRIGGER reject_water");
  const receipt = store.commit(request);
  assert.deepEqual(store.commit(request), receipt);
  assert.equal(store.status().waters, 2);
  assert.deepEqual(watersRead(store).sources, [lake, river]);
  const reordered = {
    ...request,
    patches: request.patches.map((patch) =>
      patch.kind !== "water"
        ? patch
        : {
            ...patch,
            after: Object.fromEntries(
              Object.entries({
                ...patch.after,
                ignored: "not an author field",
              }).reverse(),
            ),
          },
    ),
  };
  assert.deepEqual(store.commit(reordered), receipt);
  assert.throws(
    () =>
      store.commit({
        ...request,
        patches: [waterPatch({ ...lake, level: 33 })],
      }),
    /Widersprüchliche/,
  );
  assert.throws(
    () => writeSources(store, [waterPatch(lake), waterPatch(lake)]),
    /Doppelter/,
  );
});

test("water moves, snapshots and reopening preserve exact masks, profiles and dependencies across terrain edits", async () => {
  const { store, directory } = await fresh();
  const lake = lakeSource(),
    river = riverSource();
  writeSources(store, [
    waterPatch(lake),
    waterPatch(river),
    housePatch(houseHeader()),
    landscapePatch(landscapeFill(0, 0, 0, [80, 20, 0, 0])),
  ]);
  const authorTerrain = terrainAuthorDigest(store);
  const originalHouses = housesRead(store, [-1000, -1000, 1000, 1000]).headers;
  const snapshot = await store.prepareSave(store.status());
  const moved = {
    ...lake,
    revision: 2,
    rings: lake.rings.map((ring) => ring.map(([x, y]) => [x + 4000, y + 6000])),
    terrain: { ...lake.terrain, bounds: [3920, 5920, 4080, 6080] },
  };
  writeSources(store, [waterPatch(moved)]);
  assert.equal(terrainAuthorDigest(store), authorTerrain);
  assert.deepEqual(
    housesRead(store, [-1000, -1000, 1000, 1000]).headers,
    originalHouses,
  );
  assert.deepEqual(watersRead(store).sources, [river]);
  assert.deepEqual(watersRead(store, [3900, 5900, 4100, 6100]).sources, [
    moved,
  ]);
  const authorsBeforeTerrain = waterAuthors(store);
  // A trigger on every water author write proves ordinary terrain never rewrites
  // or eagerly marks derived sources. Their content dependency stays historical.
  store.current.database.exec(
    "CREATE TRIGGER preserve_water BEFORE UPDATE ON water_sources BEGIN SELECT RAISE(ABORT,'terrain touched water'); END",
  );
  write(store, heightTilesFromControls(0, [[0, 0, 170]]));
  assert.deepEqual(waterAuthors(store), authorsBeforeTerrain);
  store.current.database.exec("DROP TRIGGER preserve_water");
  const target = join(directory, "water-snapshot.saltatlas");
  await store.publishSave(snapshot.token, target);
  const { store: reopened } = await fresh();
  const saved = await reopened.openProject(target);
  assert.equal(saved.sequence, 1);
  assert.equal(saved.waters, 2);
  assert.deepEqual(watersRead(reopened).sources, [lake, river]);
  assert.equal(terrainAuthorDigest(reopened), authorTerrain);
  assert.equal(read(reopened, [-1, -1, 1, 1]).tiles.length, 0);
  await store.saveProject(store.status(), target);
  await reopened.openProject(target);
  assert.deepEqual(watersRead(reopened).sources, [river]);
  assert.deepEqual(watersRead(reopened, [3900, 5900, 4100, 6100]).sources, [
    moved,
  ]);
  writeSources(reopened, [
    { kind: "water", key: `water:${moved.id}`, after: null },
  ]);
  assert.equal(reopened.status().waters, 1);
  assert.deepEqual(watersRead(reopened, [3900, 5900, 4100, 6100]).sources, []);
});

test("water Open validates bounded payloads and rebuilds exact spatial bounds without modifying the source file", async () => {
  const { store, directory } = await fresh();
  const edge = lakeSource("edge-lake", {
    rings: [
      [
        [99_999_995.2, -0.2],
        [99_999_996.8, -0.2],
        [99_999_996.8, 0.2],
        [99_999_995.2, 0.2],
      ],
    ],
  });
  writeSources(store, [waterPatch(edge)]);
  const target = join(directory, "cold-water.saltatlas");
  await store.saveProject(store.status(), target);
  let damaged = new Database(target);
  damaged.exec(
    "DELETE FROM water_spatial; UPDATE water_sources SET min_x=0,max_x=1,min_y=0,max_y=1",
  );
  damaged.close();
  const diskBytes = await readFile(target);
  await store.openProject(target);
  assert.deepEqual(await readFile(target), diskBytes);
  assert.deepEqual(watersRead(store, [99_999_995, -1, 99_999_997, 1]).sources, [
    edge,
  ]);
  assert.deepEqual(
    watersRead(store, [99_999_996.9, -1, 99_999_997.1, 1]).sources,
    [],
  );
  const accepted = store.status();
  damaged = new Database(target);
  damaged.prepare("UPDATE water_sources SET source_json=?").run(
    JSON.stringify({
      ...edge,
      terrain: { ...edge.terrain, identity: "height-controls-v1:bad" },
    }),
  );
  damaged.close();
  await assert.rejects(store.openProject(target), /Inhaltsidentität/);
  assert.equal(store.status().sessionId, accepted.sessionId);
  assert.deepEqual(watersRead(store, [99_999_995, -1, 99_999_997, 1]).sources, [
    edge,
  ]);
  damaged = new Database(target);
  damaged.pragma("ignore_check_constraints = ON");
  damaged
    .prepare("UPDATE water_sources SET source_json=?")
    .run(" ".repeat(128 * 1024 + 1));
  damaged.close();
  await assert.rejects(store.openProject(target), /Quellengröße|SQLite/);
  assert.equal(store.status().sessionId, accepted.sessionId);
  const previous = join(directory, "format26.saltatlas");
  await store.saveProject(store.status(), previous);
  damaged = new Database(previous);
  damaged.pragma("user_version = 26");
  damaged.close();
  await assert.rejects(store.openProject(previous), /Format 27/);
});

test("water reads include the river-bank influence and reject dense truncated regions", async () => {
  const { store } = await fresh();
  const river = riverSource();
  writeSources(store, [waterPatch(river)]);
  assert.deepEqual(watersRead(store, [5, 18, 6, 19]).sources, [river]);
  assert.deepEqual(watersRead(store, [5, 23, 6, 24]).sources, []);
  const lakes = Array.from({ length: 129 }, (_, i) =>
    lakeSource(`dense-${i}`, {
      rings: [
        [
          [1000 + i * 4, 0],
          [1001 + i * 4, 0],
          [1001 + i * 4, 1],
          [1000 + i * 4, 1],
        ],
      ],
    }),
  );
  writeSources(store, lakes.map(waterPatch));
  assert.equal(store.status().waters, 130);
  assert.throws(
    () => watersRead(store, [999, -1, 1520, 2]),
    /zu viele Gewässer/,
  );
  assert.deepEqual(watersRead(store, [1000, -1, 1001, 2]).sources, [lakes[0]]);
  const stale = store.status().sessionId;
  store.newProject();
  assert.throws(
    () => store.readWaterRegion({ sessionId: stale, bounds: [0, 0, 1, 1] }),
    /Veraltete/,
  );
});

test("the ordinary water template is one saved author state with true slope, masks and complete height identities", async () => {
  const { store, directory } = await fresh();
  const empty = store.status();
  assert.throws(() => store.newProject(empty, "unknown"), /Projektvorlage/);
  assert.equal(store.status().sessionId, empty.sessionId);
  const info = store.newProject(empty, "water");
  assert.equal(info.format, 27);
  assert.equal(info.sequence, 1);
  assert.equal(info.savedSequence, null);
  assert.equal(info.waters, 2);
  assert.equal(info.houses, 1);
  assert.equal(info.sourceTiles, 4);
  assert.deepEqual(info.activeLevels, [3]);
  const waters = watersRead(store).sources;
  const heights = read(store, [-500, -500, 500, 500]).tiles;
  const natural = prepareScaledHeightSum(heights);
  for (const [x, y] of [
    [-240, 40],
    [-40, 80],
    [100, 60],
    [132, 55],
  ])
    assert.ok(
      Math.abs(
        heightFromScaledSum(natural(x, y)) - (34 + 0.025 * x + 0.01 * y),
      ) < 1e-9,
    );
  const lake = waters.find((source) => source.kind === "lake"),
    river = waters.find((source) => source.kind === "river");
  assert.equal(lake.level, 32);
  assert.equal(lake.rings.length, 2);
  assert.deepEqual(
    river.samples.map((sample) => sample.level),
    [38, 35, 32, 29],
  );
  for (const water of waters) {
    assert.deepEqual(water.terrain.bounds, waterBounds(water));
    const hash = createHash("sha256");
    for (const chunk of encodeHeightDependency({
      bounds: water.terrain.bounds,
      levels: HEIGHT_LEVELS,
      tiles: heights,
    }))
      hash.update(chunk);
    assert.equal(
      water.terrain.identity,
      `height-controls-v1:${hash.digest("hex")}`,
    );
  }
  const authors = waterAuthors(store),
    terrain = terrainAuthorDigest(store);
  const target = join(directory, "normal-water-scene.saltatlas");
  await store.saveProject(info, target);
  store.newProject(store.status());
  assert.equal(store.status().waters, 0);
  await store.openProject(target);
  assert.deepEqual(waterAuthors(store), authors);
  assert.equal(terrainAuthorDigest(store), terrain);
  assert.deepEqual(watersRead(store).sources, waters);
  assert.equal(store.status().savedSequence, 1);
});

test("house headers share the atomic commit, validation and replay boundary with terrain", async () => {
  const { store } = await fresh();
  const initial = store.status();
  assert.equal(initial.houses, 0);
  assert.equal(initial.format, 27);
  assert.deepEqual(housesRead(store, [-200, -200, 200, 200]).headers, []);
  const header = houseHeader();
  const height = heightTilesFromControls(0, [[20, 20, 40]])[0];
  const landscape = createLandscapeTile(0, 1, 1);
  landscapeCell(landscape, 100, 100, [200, 0, 0, 0]);
  const request = {
    sessionId: initial.sessionId,
    sequence: 1,
    transactionId: "mixed-house-action",
    patches: [
      { kind: "height", key: height.key, after: height },
      landscapePatch(landscape),
      housePatch(header),
    ],
  };
  for (const invalid of [
    { width: 0 },
    { rotation: 360 },
    { foundationHeight: 101 },
    { foundationTransition: -1 },
    { x: NaN },
    { x: 100_000_000 },
    { id: "another-house" },
    { revision: -1 },
  ])
    assert.throws(() =>
      store.commit({
        ...request,
        patches: [
          ...request.patches.slice(0, 2),
          { ...request.patches[2], after: { ...header, ...invalid } },
        ],
      }),
    );
  assert.equal(store.status().sequence, 0);
  assert.equal(store.status().houses, 0);
  assert.equal(store.status().sourceTiles, 0);
  assert.equal(store.status().landscapeTiles, 0);
  // A late SQL failure must also roll back preceding source/overview writes.
  store.current.database
    .exec(`CREATE TRIGGER reject_house BEFORE INSERT ON house_headers
    BEGIN SELECT RAISE(ABORT, 'isolated house write failure'); END`);
  assert.throws(() => store.commit(request), /isolated house write failure/);
  assert.equal(store.status().sequence, 0);
  for (const table of [
    "height_tiles",
    "landscape_tiles",
    "house_headers",
    "height_overviews",
    "landscape_overviews",
  ])
    assert.equal(
      store.current.database.prepare(`SELECT count(*) AS n FROM ${table}`).get()
        .n,
      0,
    );
  store.current.database.exec("DROP TRIGGER reject_house");
  const receipt = store.commit(request);
  assert.deepEqual(store.commit(request), receipt);
  assert.equal(store.status().houses, 1);
  assert.deepEqual(housesRead(store, [80, 80, 120, 120]).headers, [header]);
  assert.throws(
    () =>
      store.commit({
        ...request,
        patches: [housePatch({ ...header, x: 110 })],
      }),
    /Wiederholung/,
  );
  assert.deepEqual(housesRead(store, [80, 80, 120, 120]).headers, [header]);
  assert.throws(
    () => writeSources(store, [housePatch(header), housePatch(header)]),
    /Doppelter/,
  );
  assert.equal(store.status().sequence, 1);
});

test("house moves preserve terrain and stable IDs while snapshot S, reopen and removal share the real file path", async () => {
  const { store, directory } = await fresh();
  const original = houseHeader("persistent-house");
  writeSources(store, [housePatch(original)]);
  const initial = store.status();
  const snapshot = await store.prepareSave(initial);
  const terrain = terrainAuthorDigest(store);
  const moved = {
    ...original,
    x: -4000,
    y: 9000,
    rotation: 90,
    revision: 2,
    foundationHeight: 7,
    foundationTransition: 20,
  };
  writeSources(store, [housePatch(moved)]);
  assert.equal(terrainAuthorDigest(store), terrain);
  assert.deepEqual(housesRead(store, [50, 50, 150, 150]).headers, []);
  assert.deepEqual(housesRead(store, [-4050, 8950, -3950, 9050]).headers, [
    moved,
  ]);
  assert.equal(store.status().houses, 1);
  const beforeTerrain = JSON.stringify(
    store.current.database.prepare("SELECT * FROM house_headers").all(),
  );
  write(store, heightTilesFromControls(4, [[0, 0, 100]]));
  assert.equal(
    JSON.stringify(
      store.current.database.prepare("SELECT * FROM house_headers").all(),
    ),
    beforeTerrain,
  );
  const target = join(directory, "houses.saltatlas");
  const saved = await store.publishSave(snapshot.token, target);
  assert.equal(saved.savedSequence, 1);
  assert.equal(saved.sequence, 3);
  const reopen = new ProjectStore(join(directory, "reopen"));
  stores.push(reopen);
  const reopened = await reopen.openProject(target);
  assert.equal(reopened.sequence, 1);
  assert.equal(reopened.houses, 1);
  assert.deepEqual(housesRead(reopen, [50, 50, 150, 150]).headers, [original]);
  assert.deepEqual(housesRead(reopen, [-4050, 8950, -3950, 9050]).headers, []);
  await store.saveProject(store.status(), target);
  await reopen.openProject(target);
  assert.deepEqual(housesRead(reopen, [-4050, 8950, -3950, 9050]).headers, [
    moved,
  ]);
  writeSources(reopen, [
    { kind: "house", key: `house:${moved.id}`, after: null },
  ]);
  assert.equal(reopen.status().houses, 0);
  assert.deepEqual(housesRead(reopen, [-4050, 8950, -3950, 9050]).headers, []);
  await reopen.saveProject(reopen.status(), target);
  await reopen.openProject(target);
  assert.equal(reopen.status().houses, 0);
});

test("house cold loads rebuild spatial bounds, reject corrupt headers and remove Float32 false positives near world edges", async () => {
  const { store, directory } = await fresh();
  const header = houseHeader("world-edge-house", {
    x: 99_999_996,
    y: 0,
    width: 1,
    depth: 1,
    rotation: 0,
  });
  writeSources(store, [housePatch(header)]);
  const target = join(directory, "cold-house.saltatlas");
  await store.saveProject(store.status(), target);
  const file = new Database(target);
  file.exec(
    "DELETE FROM house_spatial; UPDATE house_headers SET min_x=0,max_x=1,min_y=0,max_y=1",
  );
  file.close();
  const sourceBytes = await readFile(target);
  await store.openProject(target);
  assert.deepEqual(housesRead(store, [99_999_995, -1, 99_999_997, 1]).headers, [
    header,
  ]);
  assert.deepEqual(
    housesRead(store, [99_999_996.9, -1, 99_999_997.1, 1]).headers,
    [],
  );
  assert.deepEqual(await readFile(target), sourceBytes);
  const current = store.status();
  const damaged = new Database(target);
  damaged.exec("UPDATE house_headers SET x=100000001");
  damaged.close();
  await assert.rejects(store.openProject(target), /Haus|Welt|Punkt/);
  assert.equal(store.status().sessionId, current.sessionId);
  assert.deepEqual(housesRead(store, [99_999_995, -1, 99_999_997, 1]).headers, [
    header,
  ]);
  const old = join(directory, "format25.saltatlas");
  await copyFile(target, old);
  const unsupported = new Database(old);
  unsupported.pragma("user_version = 25");
  unsupported.close();
  await assert.rejects(store.openProject(old), /Format 27/);
});

test("bounded house region reads never certify a truncated dense view as empty or complete", async () => {
  const { store } = await fresh();
  for (let start = 0; start < 4097; start += 512) {
    const patches = [];
    for (let index = start; index < Math.min(4097, start + 512); index++)
      patches.push(
        housePatch(
          houseHeader(`dense-${index}`, {
            x: 2 * index,
            y: 0,
            width: 1,
            depth: 1,
            rotation: 0,
          }),
        ),
      );
    writeSources(store, patches);
  }
  assert.equal(store.status().houses, 4097);
  assert.throws(() => housesRead(store, [-1, -1, 8194, 1]), /zu viele Häuser/);
  const narrow = housesRead(store, [1999, -1, 2001, 1]);
  assert.equal(narrow.headers.length, 1);
  assert.equal(narrow.headers[0].id, "dense-1000");
  const previousSession = store.status().sessionId;
  store.newProject();
  assert.throws(
    () =>
      store.readHouseRegion({
        sessionId: previousSession,
        bounds: [-1, -1, 1, 1],
      }),
    /Veraltete Dokumentsitzung/,
  );
});

test("landscape starts sparse and shares atomic validation, receipt identity and session boundaries with height", async () => {
  const { store } = await fresh();
  const info = store.status();
  assert.equal(info.format, 27);
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
  const header = houseHeader("save-overlap-house", { x: 0, y: 0 });
  const water = lakeSource("save-overlap-lake");
  writeSources(store, [
    { kind: "height", key: height.key, after: height },
    landscapePatch(landscape),
    housePatch(header),
    waterPatch(water),
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
            houseRegion,
            waterRegion,
            stale,
          ] = await Promise.all([
            request("readRegion", query),
            request("readPresentation", { ...query, power: 0 }),
            request("readLandscapeRegion", { ...query, minLevel: 0 }),
            request("readLandscapePresentation", { ...query, power: 1 }),
            request("readHouseRegion", query),
            request("readWaterRegion", query),
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
            houseRegion,
            waterRegion,
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
    assert.ok(result.beforeRelease.includes("readHouseRegion"));
    assert.equal(result.houseRegion.sequence, 1);
    assert.deepEqual(result.houseRegion.headers, [header]);
    assert.ok(result.beforeRelease.includes("readWaterRegion"));
    assert.equal(result.waterRegion.sequence, 1);
    assert.deepEqual(result.waterRegion.sources, [water]);
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
  await assert.rejects(store.openProject(legacy), /Format 27/);
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

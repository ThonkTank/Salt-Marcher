import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/atlas-landscape';export * from './src/app/land-mask';export * from './src/app/landscape-raster';",
    resolveDir: process.cwd(),
  },
  outfile: ".build/land-mask-test.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["better-sqlite3"],
});
const {
  CampaignStore,
  applyMaskStroke,
  effectiveLandscape,
  decodeMask,
  encodeMask,
  LandscapeRasterizer,
} = require("../.build/land-mask-test.cjs");
const stroke = (
  mode,
  t = 1000,
  from = { x: 0, y: 0 },
  to = from,
  radius = 64,
) => ({
  mode,
  radius,
  roughness: 2,
  seed: 42,
  samples: [
    { ...from, t: 0 },
    { ...to, t },
  ],
});
const apply = (records, s) => {
  const changed = applyMaskStroke(records, s),
    ids = new Set(changed.map((r) => r.id));
  return [...records.filter((r) => !ids.has(r.id)), ...changed];
};
const terrain = (records, x = 0, y = 0) =>
  effectiveLandscape(records, { x, y }).terrain;
const count = (records) =>
  records
    .filter((r) => r.mask)
    .reduce(
      (n, r) => n + decodeMask(r.mask).filter((v) => v >= 32768).length,
      0,
    );
function fixture(t) {
  const dir = mkdtempSync("/tmp/land-mask-");
  let store = new CampaignStore(dir + "/world.sqlite");
  const cam = store.create("Maskenprobe");
  let active = store.activate(cam.id);
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    dir,
    cam,
    get store() {
      return store;
    },
    get token() {
      return active.token;
    },
    write: (action) =>
      store.executeAtlasCommit({
        commandId: randomUUID(),
        token: active.token,
        campaignId: cam.id,
        action,
      }),
    records: () =>
      store.landscapeRegion(active.token, {
        x: -10000,
        y: -10000,
        width: 20000,
        height: 20000,
      }).records,
    reopen() {
      store.close();
      store = new CampaignStore(dir + "/world.sqlite");
      active = store.activate(cam.id);
    },
  };
}
const command = (s) => ({
  kind: "landscape-brush",
  record: {
    id: randomUUID(),
    revision: 0,
    kind: "patch",
    name: "",
    points: [],
    polygons: [],
    resolution: 1,
    width: 0,
    values: {},
  },
  ...s,
  fill: false,
});
test("unpainted world is water; fast land/eraser strokes are connected across tile boundaries", () => {
  assert.equal(terrain([]), "water");
  let records = apply(
    [],
    stroke("land", 10, { x: -400, y: 0 }, { x: 400, y: 0 }),
  );
  for (let x = -400; x <= 400; x += 5)
    assert.equal(terrain(records, x), "plains");
  assert.equal(terrain(records, 0, 100), "water");
  records = apply(
    records,
    stroke("land-erase", 10, { x: -400, y: 0 }, { x: 400, y: 0 }, 16),
  );
  for (let x = -400; x <= 400; x += 5)
    assert.equal(terrain(records, x), "water");
  assert.equal(terrain(records, 0, 40), "plains");
});
test("fractal brushes depend on dwell time and work inside both water and land", () => {
  const fast = apply(
    [],
    stroke("raise", 960, { x: -200, y: 0 }, { x: 200, y: 0 }),
  );
  assert.equal(count(fast), 0);
  const slow = apply(
    [],
    stroke("raise", 960, { x: -10, y: 0 }, { x: 10, y: 0 }),
  );
  assert(count(slow) > 0);
  const held = apply([], stroke("raise", 2000));
  assert.equal(terrain(held), "plains");
  assert(count(held) > count(slow));
  const land = apply([], stroke("land"));
  assert.equal(terrain(apply(land, stroke("lower", 2000))), "water");
  const tiny = apply([], stroke("raise", 100));
  assert.equal(count(tiny), 0);
  const again = apply(tiny, stroke("raise", 1900));
  assert.equal(terrain(again), "plains");
});
test("sampling frequency does not change a timed straight stroke; subthreshold state serializes losslessly", () => {
  const sparse = stroke("raise", 1234, { x: -15, y: 5 }, { x: 15, y: 5 }),
    dense = {
      ...sparse,
      samples: Array.from({ length: 101 }, (_, i) => ({
        x: -15 + (30 * i) / 100,
        y: 5,
        t: (1234 * i) / 100,
      })),
    };
  assert.deepEqual(apply([], sparse), apply([], dense));
  const rs = apply([], stroke("raise", 100));
  for (const r of rs) {
    assert.equal(encodeMask(decodeMask(r.mask)), r.mask.data);
    assert.deepEqual(
      decodeMask(JSON.parse(JSON.stringify(r.mask))),
      decodeMask(r.mask),
    );
  }
});
test("coarse changes update existing fine detail, including an entirely erased child tile", () => {
  let rs = apply([], stroke("land", 10, { x: 0, y: 0 }, { x: 0, y: 0 }, 512));
  rs = apply(rs, stroke("land-erase", 10, { x: 0, y: 0 }, { x: 0, y: 0 }, 1));
  assert.equal(terrain(rs), "water");
  rs = apply(rs, stroke("land", 10, { x: 0, y: 0 }, { x: 0, y: 0 }, 512));
  assert.equal(terrain(rs), "plains");
  rs = apply(rs, stroke("land-erase", 10, { x: 0, y: 0 }, { x: 0, y: 0 }, 256));
  assert.equal(terrain(rs), "water");
  assert.equal(terrain(rs, 300), "plains");
});
test("atomic command, undo/redo, fresh reopen and archive preserve heights", async (t) => {
  const f = fixture(t);
  f.write(command(stroke("raise", 100)));
  const before = f.records();
  assert.equal(terrain(before), "water");
  f.write(command(stroke("raise", 1900)));
  const after = f.records();
  assert.equal(terrain(after), "plains");
  f.write({ kind: "undo" });
  assert.equal(terrain(f.records()), "water");
  f.write({ kind: "redo" });
  f.reopen();
  assert.equal(terrain(f.records()), "plains");
  const bytes = (rs) =>
    rs
      .filter((r) => r.height)
      .map((r) => [`${r.height.pixel}:${r.height.x}:${r.height.y}`, r.height.data])
      .sort();
  assert.deepEqual(bytes(f.records()), bytes(after));
  const file = f.dir + "/copy.sqlite";
  await f.store.campaignSnapshot(f.token, file);
  const copy = f.store.acceptCampaignSnapshot(file, "Kopie", {}),
    active = f.store.activate(copy.id);
  assert.deepEqual(
    bytes(
      f.store.landscapeRegion(active.token, {
        x: -1000,
        y: -1000,
        width: 2000,
        height: 2000,
      }).records,
    ),
    bytes(after),
  );
});
test("terrain authorship couples the coast to elevation while retaining semantic terrain", (t) => {
  const f = fixture(t),
    r = {
      id: randomUUID(),
      revision: 0,
      kind: "patch",
      name: "Wald",
      points: [],
      polygons: [
        {
          outer: [
            { x: -100, y: -100 },
            { x: 100, y: -100 },
            { x: 100, y: 100 },
            { x: -100, y: 100 },
          ],
          holes: [],
        },
      ],
      resolution: 100,
      width: 0,
      values: { terrain: "forest", elevationM: 42 },
    };
  f.write({ kind: "landscape-put", record: r, expectedRevision: null });
  assert.equal(terrain(f.records()), "forest");
  f.write(command(stroke("land-erase")));
  assert.equal(terrain(f.records()), "water");
  assert.equal(effectiveLandscape(f.records(), { x: 0, y: 0 }).elevationM, -100);
  f.write(command(stroke("land")));
  assert.equal(terrain(f.records()), "forest");
});
test("rendered water agrees with mask queries and malformed input rolls back", (t) => {
  const f = fixture(t);
  f.write(command(stroke("land")));
  f.write(
    command(stroke("land-erase", 10, { x: 0, y: 0 }, { x: 0, y: 0 }, 16)),
  );
  const records = f.records(),
    raster = new LandscapeRasterizer(
      { x: -100, y: -100, width: 200, height: 200 },
      100,
      100,
    );
  for (const r of records) raster.paint(r);
  const pixels = raster.finish();
  assert.deepEqual(
    [...pixels.slice((50 * 100 + 50) * 4, (50 * 100 + 50) * 4 + 3)],
    [127, 168, 189],
  );
  assert.deepEqual(
    [...pixels.slice((50 * 100 + 70) * 4, (50 * 100 + 70) * 4 + 3)],
    [238, 229, 207],
  );
  const before = f.records();
  assert.throws(
    () =>
      f.write(
        command({
          ...stroke("raise"),
          samples: [
            { x: 0, y: 0, t: 100 },
            { x: 0, y: 0, t: 0 },
          ],
        }),
      ),
    /prüfen/,
  );
  assert.deepEqual(f.records(), before);
});

test("preview reads leave the source fence unchanged, so the first real pointer stroke can commit", (t) => {
  const f = fixture(t),
    source = f.store.atlasRegionSource(f.token);
  f.store.atlasMaskRegion(f.token, {
    x: -100,
    y: -100,
    width: 200,
    height: 200,
  });
  assert.equal(f.store.atlasRegionSource(f.token).fence, source.fence);
  f.store.executeAtlasCommit({
    commandId: randomUUID(),
    token: f.token,
    campaignId: f.cam.id,
    sourceFence: source.fence,
    action: command(stroke("land")),
  });
  assert.equal(terrain(f.records()), "plains");
});

test("a thin diagonal stroke allocates along its path rather than its bounding rectangle", () => {
  const rs = apply(
    [],
    stroke("land", 10, { x: -100, y: -100 }, { x: 100, y: 100 }, 1),
  );
  assert(rs.length < 160);
  for (let x = -100; x <= 100; x += 2)
    assert.equal(terrain(rs, x, x), "plains");
  assert.equal(terrain(rs, -80, 80), "water");
});


test("malformed archived height is rejected before a campaign is published", async (t) => {
  const f = fixture(t);
  f.write(command(stroke("land")));
  const file = f.dir + "/bad.sqlite";
  await f.store.campaignSnapshot(f.token, file);
  const Database = require("better-sqlite3"),
    db = new Database(file);
  db.prepare(
    "UPDATE atlas_landscape SET payload=json_set(payload,'$.height.version',99) WHERE json_extract(payload,'$.height') IS NOT NULL",
  ).run();
  db.close();
  const before = f.store.list();
  assert.throws(
    () => f.store.acceptCampaignSnapshot(file, "Defekt", {}),
    /prüfen/,
  );
  assert.deepEqual(f.store.list(), before);
});

test("a zero-time fractal click does not allocate inherited child tiles", () => {
  const rs = apply([], stroke("land", 10, { x: 0, y: 0 }, { x: 0, y: 0 }, 512));
  assert.deepEqual(applyMaskStroke(rs, stroke("raise", 0)), []);
  assert.deepEqual(applyMaskStroke(rs, stroke("lower", 0)), []);
});

test("legacy cell edits keep labels scoped and remove their mask footprint after archive remapping", async (t) => {
  const f = fixture(t);
  const writeWorld = (token, campaignId, action) =>
    f.store.executeWorld({
      commandId: randomUUID(),
      token,
      campaignId,
      action,
    });
  let map = f.store.world(f.token).maps[0];
  const cell = {
    q: 0,
    r: 0,
    level: 0,
    terrain: "forest",
    elevationM: 12,
    climate: null,
    road: false,
    river: false,
    label: "Original label",
    faction: "",
    interrupt: "",
  };
  writeWorld(f.token, f.cam.id, {
    kind: "map",
    map: { ...map, cells: [cell] },
    expectedRevision: map.revision,
  });
  assert.equal(terrain(f.records()), "forest");
  assert.equal(effectiveLandscape(f.records(), { x: 0, y: 0 }).label, undefined);
  assert.equal(f.store.world(f.token).maps[0].cells[0].label, cell.label);
  const file = f.dir + "/cells.sqlite";
  await f.store.campaignSnapshot(f.token, file);
  const copy = f.store.acceptCampaignSnapshot(file, "Cell copy", {}),
    active = f.store.activate(copy.id);
  map = f.store.world(active.token).maps[0];
  const source = f.store
    .landscapeRegion(active.token, {
      x: -100,
      y: -100,
      width: 200,
      height: 200,
    })
    .records.find((r) => r.sourceCell);
  assert.equal(source.sourceCell.mapId, map.id);
  writeWorld(active.token, copy.id, {
    kind: "cell",
    mapId: map.id,
    cell: { ...cell, terrain: "plains" },
    expectedRevision: map.revision,
  });
  map = f.store.world(active.token).maps[0];
  assert.equal(map.landscape.filter((r) => r.sourceCell).length, 1);
  writeWorld(active.token, copy.id, {
    kind: "map",
    map: { ...map, cells: [] },
    expectedRevision: map.revision,
  });
  map = f.store.world(active.token).maps[0];
  assert.equal(terrain(map.landscape), "water");
  assert.equal(map.landscape.filter((r) => r.sourceCell).length, 0);
});

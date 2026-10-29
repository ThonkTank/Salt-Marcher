import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/terrain-editing-source';export * from './src/app/atlas/atlas-terrain-editing-source';export * from './src/app/atlas/terrain-brush';export * from './src/app/atlas/terrain-lake-coupling';export {terrainGridLayout} from './src/app/atlas/terrain-grid-layout';export * from './src/app/storage/store';export * from './src/app/storage/terrain-grid';export * from './src/app/storage/atlas-landscape';export * from './src/app/storage/terrain-route';export * from './src/app/atlas/terrain-height';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-author-cache-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  readTerrainEditingRecords,
  readTerrainEditingPage,
  readTerrainEditingPackets,
  AtlasTerrainEditingSource,
  applyCoupledTerrainBrush: applyTerrainBrush,
  TerrainSampler,
  terrainGridLayout,
  CampaignStore,
  readTerrainGrid,
  heightRecord,
  installLandscape,
  readRouteTerrain,
} = require('../../.build/terrain-author-cache-test.cjs');
function fixture(t) {
  const base = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/author-cache-'),
    store = new CampaignStore(dir + '/world.sqlite'),
    cam = store.create('Cache'),
    token = store.activateShell(cam.id).token;
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const write = (action) =>
    store.executeAtlasCommit({ commandId: randomUUID(), campaignId: cam.id, token, action });
  write({
    kind: 'landscape-put',
    expectedRevision: null,
    record: heightRecord(0, 0, 1, new Float32Array(4096).fill(100)),
  });
  const box = { x: -256.125, y: -256.25, width: 768, height: 768 },
    view = {
      box,
      frame: box,
      columns: 193,
      rows: 193,
      focusM: 100,
      tilt: 45,
      rotation: 0,
      exaggeration: 1,
    };
  const fence = () => store.atlasRegionSource(token).fence,
    canonical = () => readTerrainGrid(store.db, cam.id, view),
    cache = store.terrainAuthorCache;
  const read = () => cache.read(store.db, cam.id, view, fence());
  const seed = () => store.rememberTerrainGrid(token, fence(), canonical());
  return { store, cam, token, write, view, fence, canonical, cache, read, seed };
}
test('editing packets load a complete overlapping lake group outside the camera and keep the partial brush level', (t) => {
  const f = fixture(t);
  const lake = (id, x, level = 20) => ({
    id,
    revision: 0,
    kind: 'patch',
    name: 'Connected lake',
    points: [],
    width: 0,
    resolution: 1,
    values: {},
    surface: 'freshwater',
    waterLevelM: level,
    polygons: [
      {
        outer: [
          { x, y: 0 },
          { x: x + 30, y: 0 },
          { x: x + 30, y: 20 },
          { x, y: 20 },
        ],
        holes: [],
      },
    ],
  });
  for (const r of [
    lake('lake-a', 0),
    lake('lake-b', 25),
    lake('lake-c', 50),
    lake('separate-level', 75, 21),
    lake('unrelated', 200),
  ])
    f.write({ kind: 'landscape-put', expectedRevision: null, record: r });
  const box = { x: 0, y: 0, width: 5, height: 20 },
    records = [];
  let after = '',
    pages = 0;
  for (;;) {
    const page = readTerrainEditingPage(f.store.db, f.cam.id, box, after, 800);
    records.push(...page.records);
    pages++;
    if (page.complete) break;
    assert(page.next > after);
    after = page.next;
  }
  assert(pages > 1);
  assert.deepEqual(
    records.filter((r) => r.surface).map((r) => r.id),
    ['lake-a', 'lake-b', 'lake-c'],
  );
  const s = {
    mode: 'raise',
    radius: 32,
    strength: 2,
    feather: 0,
    samples: [
      { x: 10, y: 10, t: 0 },
      { x: 10, y: 10, t: 2000 },
    ],
  };
  assert(!applyTerrainBrush(records, s).some((r) => r.surface));
  const before = f.store.db
    .prepare("SELECT payload FROM atlas_landscape WHERE id='lake-c'")
    .get().payload;
  f.write({ kind: 'landscape-height-stroke', stroke: s });
  assert.equal(
    f.store.db.prepare("SELECT payload FROM atlas_landscape WHERE id='lake-c'").get().payload,
    before,
  );
});
test('trusted seeded surface is reused; successful local writes invalidate only affected blocks', (t) => {
  const f = fixture(t);
  f.seed();
  const stats = f.cache.cache.tiles,
    misses = stats.misses;
  assert.deepEqual(f.read(), f.canonical());
  assert.equal(stats.misses, misses);
  const beforeHits = stats.hits;
  f.write({
    kind: 'landscape-height-stroke',
    stroke: {
      mode: 'raise',
      radius: 5,
      strength: 120,
      feather: 0.8,
      visibility: f.view,
      samples: [
        { x: 32, y: 32, t: 0 },
        { x: 32, y: 32, t: 100 },
      ],
    },
  });
  assert.deepEqual(f.read(), f.canonical());
  assert.equal(stats.misses, misses, 'local edits retain the canonical raster');
  assert(stats.hits > beforeHits);
  const seeded = f.canonical(),
    oldFence = f.fence();
  f.write({ kind: 'landscape-sea-level', seaLevelM: 150 });
  f.store.rememberTerrainGrid(f.token, oldFence, seeded);
  assert.deepEqual(f.read(), f.canonical());
  assert(f.read().heights.every((x) => x >= 150));
  assert(stats.bytes <= 8 * 1024 * 1024);
});
test('focused sampling seeds all canonical bands and keeps local brush invalidation exact', (t) => {
  const f = fixture(t);
  f.view.refinement = { x: -64, y: -64, width: 256, height: 256 };
  f.seed();
  const stats = f.cache.cache.tiles,
    misses = stats.misses,
    hits = stats.hits;
  assert.deepEqual(f.read(), f.canonical());
  assert.equal(stats.misses, misses);
  assert.equal(stats.hits - hits, terrainGridLayout(f.view).blocks.length);
  f.write({
    kind: 'landscape-height-stroke',
    stroke: {
      mode: 'raise',
      radius: 8,
      strength: 120,
      feather: 0.8,
      visibility: f.view,
      samples: [
        { x: 32, y: 32, t: 0 },
        { x: 32, y: 32, t: 100 },
      ],
    },
  });
  assert.deepEqual(f.read(), f.canonical());
  assert.equal(stats.misses, misses);
  assert(stats.bytes <= 8 * 1024 * 1024);
  f.write({ kind: 'undo' });
  assert.deepEqual(f.read(), f.canonical());
});
test('Undo, Redo, deletion, failed writes, outer rollback and unversioned writes cannot retain stale surfaces', (t) => {
  const f = fixture(t);
  f.seed();
  const original = f.canonical();
  const record = heightRecord(0, 0, 1, new Float32Array(4096).fill(200));
  f.write({ kind: 'landscape-put', expectedRevision: 1, record });
  assert.deepEqual(f.read(), f.canonical());
  assert.notDeepEqual(f.read().heights, original.heights);
  f.write({ kind: 'undo' });
  assert.deepEqual(f.read(), original);
  f.write({ kind: 'redo' });
  assert.deepEqual(f.read(), f.canonical());
  const prior = f.canonical(),
    misses = f.cache.cache.tiles.misses;
  assert.throws(
    () => f.write({ kind: 'landscape-put', expectedRevision: 999, record }),
    /geändert|Konflikt|veraltet/i,
  );
  assert.deepEqual(f.read(), prior);
  assert.throws(
    () =>
      f.store.db.transaction(() => {
        const revision = f.store.db
          .prepare('SELECT revision FROM atlas_landscape WHERE campaign_id=? AND id=?')
          .get(f.cam.id, record.id).revision;
        f.write({
          kind: 'landscape-put',
          record: heightRecord(0, 0, 1, new Float32Array(4096).fill(400)),
          expectedRevision: revision,
        });
        assert.deepEqual(f.read(), f.canonical());
        throw Error('rollback fixture');
      })(),
    /rollback fixture/,
  );
  assert.deepEqual(f.read(), prior);
  assert(f.cache.cache.tiles.misses >= misses);
  // A different connection changes data_version without changing the Atlas revision.
  const external = new (require('better-sqlite3'))(f.store.filename);
  try {
    external
      .prepare('UPDATE atlas_landscape SET payload=? WHERE campaign_id=? AND id=?')
      .run(
        JSON.stringify(heightRecord(0, 0, 1, new Float32Array(4096).fill(300))),
        f.cam.id,
        record.id,
      );
  } finally {
    external.close();
  }
  assert.deepEqual(f.read(), f.canonical());
  assert.notDeepEqual(f.read().heights, prior.heights);
  f.store.db
    .prepare('DELETE FROM atlas_landscape WHERE campaign_id=? AND id=?')
    .run(f.cam.id, record.id);
  assert.deepEqual(f.read(), f.canonical());
});
test('derived indexes tolerate corrupt JSON while canonical reads fail closed; metadata plans use indexes', (t) => {
  const f = fixture(t),
    db = f.store.db;
  db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)').run(
    f.cam.id,
    'corrupt',
    1,
    5000,
    5001,
    5000,
    5001,
    '{broken',
  );
  // Rebuilding all indexes must not make a database with a localized broken row unopenable.
  for (const { name } of db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'landscape_%' AND name<>'landscape_area'",
    )
    .all())
    db.exec('DROP INDEX ' + name);
  installLandscape(db);
  assert.throws(() => f.canonical(), /beschädigt/);
  db.prepare('DELETE FROM atlas_landscape WHERE id=? AND campaign_id=?').run('corrupt', f.cam.id);
  const plan = (sql, ...args) =>
    db
      .prepare('EXPLAIN QUERY PLAN ' + sql)
      .all(...args)
      .map((r) => r.detail)
      .join('\n');
  assert.match(
    plan(
      "SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.terrainSettings') IS NOT NULL",
      f.cam.id,
    ),
    /landscape_settings_fast/,
  );
  assert.match(
    plan(
      "SELECT max(json_extract(payload,'$.order')) FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload)",
      f.cam.id,
    ),
    /landscape_order_fast/,
  );
  assert.match(
    plan(
      "SELECT id FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.height.x')=? AND json_extract(payload,'$.height.y')=? AND json_extract(payload,'$.height.pixel')=?",
      f.cam.id,
      0,
      0,
      1,
    ),
    /landscape_height_address/,
  );
  let unionPlan;
  readRouteTerrain(
    {
      prepare(sql) {
        const statement = db.prepare(sql);
        if (!sql.includes('UNION')) return statement;
        return {
          iterate(...args) {
            unionPlan = plan(sql, ...args);
            return statement.iterate(...args);
          },
        };
      },
    },
    f.cam.id,
    { x: 10, y: 10, width: 4, height: 4 },
  );
  assert.match(
    unionPlan,
    /landscape_settings_fast/,
    'UNION ordering must not turn settings into a full author-payload scan',
  );
  assert.deepEqual(f.read(), f.canonical());
});

test('dense author region uses complete revision-bound packets; room source and protected edit remain exact', async (t) => {
  const f = fixture(t),
    db = f.store.db;
  const put = db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
  let bytes = 0;
  db.transaction(() => {
    for (let y = -15; y < 15; y++)
      for (let x = -15; x < 15; x++) {
        const r = heightRecord(
          x * 8,
          y * 8,
          0.125,
          Float32Array.from({ length: 4096 }, (_, i) => 0.2 * Math.sin(i / 37)),
          2,
        );
        const payload = JSON.stringify(r);
        bytes += payload.length * 2;
        put.run(f.cam.id, r.id, 0, x * 8, (x + 1) * 8, y * 8, (y + 1) * 8, payload);
      }
  })();
  assert(bytes > 32 * 1024 * 1024);
  const box = { x: -128, y: -128, width: 256, height: 256 };
  assert.throws(() => readTerrainEditingRecords(db, f.cam.id, box), /Zu viele/);
  const identity = { revision: 1, fence: f.fence(), radius: 1 };
  const source = new AtlasTerrainEditingSource();
  let packets = 0;
  const full = await source.load(identity, box, async (after) => {
    const packet = readTerrainEditingPage(db, f.cam.id, box, after);
    packets++;
    assert(JSON.stringify(packet.records).length * 2 < 2 * 1024 * 1024);
    assert.equal(source.ready(identity, box), false, 'no partial packet authorizes a gesture');
    return { ...identity, box, pixel: 1 / 32, ...packet };
  });
  assert(packets > 16);
  assert.equal(full.records.length, 901);
  assert(source.ready(identity, box));
  const room = { x: 28, y: 28, width: 8, height: 8 };
  const local = readTerrainEditingPage(db, f.cam.id, room);
  assert(local.complete);
  assert(local.records.length < 12);
  const stroke = {
    mode: 'raise',
    radius: 1,
    strength: 2,
    feather: 0.5,
    preserveDetails: true,
    samples: [
      { x: 32, y: 32, t: 0 },
      { x: 32.25, y: 32, t: 250 },
    ],
  };
  const expected = applyTerrainBrush(full.records, stroke);
  assert.deepEqual(applyTerrainBrush(local.records, stroke), expected);
  f.write({ kind: 'landscape-height-stroke', stroke });
  const actual = new TerrainSampler(readTerrainEditingPage(db, f.cam.id, room).records);
  const expectedSampler = new TerrainSampler([
    ...new Map([...local.records, ...expected].map((r) => [r.id, r])).values(),
  ]);
  for (let x = 31; x <= 33; x += 0.125)
    assert.equal(actual.sample({ x, y: 32 }).heightM, expectedSampler.sample({ x, y: 32 }).heightM);
});
test('editing packets reject missing continuation, stale identity and superseded spatial requests', async () => {
  const source = new AtlasTerrainEditingSource(),
    identity = { revision: 1, fence: 'one', radius: 1 },
    box = { x: 0, y: 0, width: 4, height: 4 };
  const page = { ...identity, box, pixel: 1 / 32, records: [], complete: true };
  await assert.rejects(
    source.load(identity, box, async () => ({ ...page, complete: false })),
    /Fortsetzung/,
  );
  assert.equal(source.ready(identity, box), false);
  await assert.rejects(
    source.load(identity, box, async () => ({ ...page, revision: 2 })),
    /angeforderten/,
  );
  let release;
  const old = source.load(identity, box, () => new Promise((r) => (release = r)));
  const nextBox = { ...box, x: 10 };
  const current = await source.load(identity, nextBox, async () => ({ ...page, box: nextBox }));
  release(page);
  assert.equal(await old, null);
  assert.equal(source.source, current);
  source.clear();
  assert.equal(source.ready(identity, nextBox), false);
});

test('a sub-metre author source above the old cap remains complete through canonical detail removal', (t) => {
  const f = fixture(t),
    db = f.store.db;
  const put = db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
  const pixel = 2 ** -12,
    side = pixel * 64;
  let bytes = 0;
  db.transaction(() => {
    for (let y = -15; y < 15; y++)
      for (let x = -15; x < 15; x++) {
        const r = heightRecord(
          32 + x * side,
          32 + y * side,
          pixel,
          new Float32Array(4096).fill(0.25),
          2,
        );
        r.revision = 1;
        const p = JSON.stringify(r);
        bytes += p.length * 2;
        put.run(
          f.cam.id,
          r.id,
          r.revision,
          r.height.x - pixel,
          r.height.x + 64 * pixel,
          r.height.y - pixel,
          r.height.y + 64 * pixel,
          p,
        );
      }
  })();
  assert(bytes > 32 * 1024 * 1024);
  const box = { x: 31.5, y: 31.5, width: 1, height: 1 };
  assert.throws(() => readTerrainEditingRecords(db, f.cam.id, box), /Zu viele/);
  const complete = readTerrainEditingPackets(db, f.cam.id, box);
  assert.equal(complete.length, 901);
  const stroke = {
    mode: 'lower',
    radius: 0.5,
    strength: 0.1,
    feather: 0.5,
    preserveDetails: false,
    samples: [
      { x: 32, y: 32, t: 0 },
      { x: 32, y: 32, t: 50 },
    ],
  };
  const expected = applyTerrainBrush(complete, stroke);
  assert(expected.length > 1);
  f.write({ kind: 'landscape-height-stroke', stroke });
  const actual = readTerrainEditingPackets(db, f.cam.id, box);
  const byId = new Map(actual.map((r) => [r.id, r]));
  for (const r of expected) {
    const revision = (complete.find((old) => old.id === r.id)?.revision ?? 0) + 1;
    assert.equal(byId.get(r.id)?.revision, revision);
    assert.deepEqual(byId.get(r.id)?.height, r.height);
  }
});

test('disjoint editing supports do not authorize the empty bounding-box corridor or reuse a pending request there', async () => {
  const source = new AtlasTerrainEditingSource(),
    identity = { revision: 1, fence: 'one', radius: 1 },
    a = { x: 0, y: 0, width: 4, height: 4 },
    b = { x: 20, y: 0, width: 4, height: 4 },
    box = { x: 0, y: 0, width: 24, height: 4 },
    middle = { x: 10, y: 0, width: 2, height: 2 },
    page = { ...identity, box, pixel: 1 / 32, records: [], complete: true, supports: [a, b] };
  await source.load(identity, box, async () => page, [a, b]);
  assert(source.ready(identity, box, [a, b]));
  assert(!source.ready(identity, middle));
  source.clear();
  let release;
  const old = source.load(identity, box, () => new Promise((r) => (release = r)), [a, b]);
  const next = await source.load(identity, middle, async () => ({
    ...page,
    box: middle,
    supports: [middle],
  }));
  release(page);
  assert.equal(await old, null);
  assert.equal(source.source, next);
  assert(source.ready(identity, middle));
  assert(!source.ready(identity, a));
});

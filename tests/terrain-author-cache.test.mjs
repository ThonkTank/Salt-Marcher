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
      "export {terrainGridLayout} from './src/app/terrain-grid-layout';export * from './src/app/storage/store';export * from './src/app/storage/terrain-grid';export * from './src/app/storage/atlas-landscape';export * from './src/app/storage/terrain-route';export * from './src/app/terrain-height';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-author-cache-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  terrainGridLayout,
  CampaignStore,
  readTerrainGrid,
  heightRecord,
  installLandscape,
  readRouteTerrain,
} = require('../.build/terrain-author-cache-test.cjs');
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

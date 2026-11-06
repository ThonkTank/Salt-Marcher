import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url),
  Database = require('better-sqlite3');
buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/storage/atlas-landscape-region';export * from './src/app/atlas/terrain-projection-cache';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/terrain-field-stream';export * from './src/app/atlas/terrain-height-lattice';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-height-blocks-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  AtlasLandscapeReader,
  TerrainProjectionCache,
  heightRecord,
  streamTerrainField,
  accumulateHeightSources,
} = require('../../.build/terrain-height-blocks-test.cjs');
const lattice = { x: -50.125, y: -40.25, dx: 0.7, dy: 0.6, columns: 129, rows: 129 };
function fixture(t, limit) {
  const base = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/height-blocks-'),
    store = new CampaignStore(dir + '/world.sqlite'),
    campaign = store.create('Height blocks'),
    token = store.activateShell(campaign.id).token;
  const write = (action) =>
    store.executeAtlasCommit({ commandId: randomUUID(), campaignId: campaign.id, token, action });
  const records = [4, 1].flatMap((pixel) =>
    [-1, 0].flatMap((y) =>
      [-1, 0].map((x) =>
        heightRecord(
          x * 64 * pixel,
          y * 64 * pixel,
          pixel,
          Float32Array.from({ length: 4096 }, (_, i) =>
            pixel === 1 && i % 7 === 0
              ? NaN
              : 100 + Math.sin((i % 64) / 10) * 20 + Math.cos(Math.floor(i / 64) / 13) * 30,
          ),
        ),
      ),
    ),
  );
  write({
    kind: 'landscape-batch',
    records: records.map((record) => ({ record, expectedRevision: null })),
  });
  const db = new Database(store.filename, { readonly: true }),
    reader = new AtlasLandscapeReader(db);
  if (limit) reader.projectionCache = new TerrainProjectionCache(limit);
  let source,
    reads = 0;
  const sql = reader.sql.bind(reader);
  reader.sql = (text) => {
    const st = sql(text);
    return text.startsWith('SELECT a.payload,l.trashed FROM atlas_landscape')
      ? {
          get(...args) {
            reads++;
            return st.get(...args);
          },
        }
      : st;
  };
  const sync = () => {
    source = store.atlasRegionSource(token, source);
    reader.sync(source);
    return source;
  };
  sync();
  t.after(() => {
    db.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    store,
    db,
    reader,
    write,
    sync,
    records,
    campaign,
    token,
    get reads() {
      return reads;
    },
    field(l = lattice, fast = true) {
      const stream = fast
        ? reader.terrainStream(source)
        : (kind, box, samples) =>
            reader.rows(
              source,
              box,
              true,
              samples ? { width: samples.columns / 2, height: samples.rows / 2 } : 0,
              0,
              kind,
            );
      return streamTerrainField(l, 0, stream);
    },
  };
}
test('decoded blocks serve new sample lattices without rereading payloads and match raw sparse height arithmetic', (t) => {
  const f = fixture(t),
    first = f.field();
  assert.deepEqual(first, f.field(lattice, false));
  assert(f.reads > 0);
  const loaded = f.reads;
  const other = { ...lattice, x: -49.375, dx: 0.63, dy: 0.57 };
  const second = f.field(other);
  assert.deepEqual(second, f.field(other, false));
  assert.equal(
    f.reads,
    loaded,
    'sampling a new lattice reuses numerical blocks, not a finished field',
  );
  first.heights.fill(-999);
  second.surface.fill(-123);
  assert.deepEqual(
    f.field(),
    f.field(lattice, false),
    'returned rasters cannot mutate cached source samples',
  );
  const cache = f.reader.projectionCache.tiles;
  assert(cache.bytes <= cache.limit);
  assert(cache.hits > 0);
});
test('sculpt, Undo, Redo and deletion invalidate decoded sources before rebuilding affected fields', (t) => {
  const f = fixture(t),
    before = f.field();
  f.write({
    kind: 'landscape-height-stroke',
    stroke: {
      mode: 'raise',
      radius: 8,
      strength: 60,
      feather: 0.8,
      samples: [
        { x: 1, y: 1, t: 0 },
        { x: 1, y: 1, t: 1000 },
      ],
    },
  });
  f.sync();
  const changed = f.field();
  assert.notDeepEqual(changed.heights, before.heights);
  assert.deepEqual(changed, f.field(lattice, false));
  f.write({ kind: 'undo' });
  f.sync();
  assert.deepEqual(f.field(), before);
  f.write({ kind: 'redo' });
  f.sync();
  assert.deepEqual(f.field(), changed);
  const r = f.records[0];
  f.store.db
    .prepare('DELETE FROM atlas_landscape WHERE campaign_id=? AND id=?')
    .run(f.campaign.id, r.id);
  f.sync();
  assert.deepEqual(f.field(), f.field(lattice, false));
});
test('external canonical replacement resets decoded blocks, including unchanged row identity', (t) => {
  const f = fixture(t),
    before = f.field(),
    loaded = f.reads,
    r = f.records.at(-1),
    external = new Database(f.store.filename),
    row = external
      .prepare('SELECT rowid FROM atlas_landscape WHERE campaign_id=? AND id=?')
      .get(f.campaign.id, r.id),
    record = {
      ...r,
      height: {
        ...r.height,
        data: heightRecord(r.height.x, r.height.y, r.height.pixel, new Float32Array(4096).fill(800))
          .height.data,
      },
    },
    payload = JSON.stringify(record);
  external
    .prepare('UPDATE atlas_landscape SET payload=? WHERE campaign_id=? AND id=?')
    .run(payload, f.campaign.id, r.id);
  external.close();
  assert.equal(f.sync().reset, true);
  assert.equal(
    f.store.db
      .prepare('SELECT rowid FROM atlas_landscape WHERE campaign_id=? AND id=?')
      .get(f.campaign.id, r.id).rowid,
    row.rowid,
  );
  const after = f.field();
  assert(f.reads > loaded);
  assert.notDeepEqual(after.heights, before.heights);
  assert.deepEqual(after, f.field(lattice, false));
});
test('cache pressure shares the projection quota and eviction changes only reads, not terrain', (t) => {
  const f = fixture(t, 20000),
    expected = f.field(lattice, false);
  for (let i = 0; i < 4; i++) assert.deepEqual(f.field(), expected);
  const cache = f.reader.projectionCache.tiles;
  assert(cache.evictions > 0);
  assert(cache.bytes <= 20000);
  assert(f.reads > f.records.length);
  f.reader.projectionCache.rememberPixels(
    'pressure',
    { x: -1000, y: -1000, width: 2000, height: 2000 },
    new Uint8Array(18000),
  );
  assert(cache.bytes <= 20000);
  assert.deepEqual(f.field(), expected);
});
test('an unsampled height source stays undecoded; sampled failures are not accepted as cached data', () => {
  let reads = 0;
  const x = new Float64Array([0]),
    y = new Float64Array([0]),
    ground = new Float64Array([12]),
    additions = new Float64Array([0]);
  const source = {
    version: 1,
    x: 10000,
    y: 10000,
    pixel: 1,
    read() {
      reads++;
      throw Error('bad source');
    },
  };
  accumulateHeightSources(x, y, [source], ground, additions);
  assert.equal(reads, 0);
  assert.equal(ground[0], 12);
  assert.throws(
    () => accumulateHeightSources(x, y, [{ ...source, x: 0, y: 0 }], ground, additions),
    /bad source/,
  );
  assert.equal(reads, 1);
});

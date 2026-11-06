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
      "export * from './src/app/storage/store';export * from './src/app/storage/terrain-invalidation';export * from './src/app/storage/atlas-landscape-region';export * from './src/app/storage/terrain-projection';export * from './src/app/atlas/terrain-height';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-invalidation-bounds.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  changedHeightBounds,
  heightRecord,
  AtlasLandscapeReader,
  readTerrainProjection,
} = require('../../.build/terrain-invalidation-bounds.cjs');
test('changed node bounds include all sixteen interpolation cells, sparse insertion/deletion and negative coordinates', () => {
  const a = new Float32Array(4096).fill(NaN);
  a[0] = 100;
  a[63 * 64 + 63] = 200;
  const record = heightRecord(-32, -64, 0.5, a),
    expected = { x: -33, y: -65, width: 33.5, height: 33.5 };
  assert.deepEqual(changedHeightBounds(undefined, record), expected);
  assert.deepEqual(changedHeightBounds(record, undefined), expected);
  const b = a.slice();
  b[0] = 101;
  assert.deepEqual(changedHeightBounds(record, heightRecord(-32, -64, 0.5, b)), {
    x: -33,
    y: -65,
    width: 2,
    height: 2,
  });
  b[0] = NaN;
  assert.deepEqual(changedHeightBounds(record, heightRecord(-32, -64, 0.5, b)), {
    x: -33,
    y: -65,
    width: 2,
    height: 2,
  });
  assert.equal(changedHeightBounds(record, { ...record, revision: 2 }), undefined);
  assert.deepEqual(changedHeightBounds(record, { ...heightRecord(-32, -64, 0.5, b), order: 900 }), {
    x: -33,
    y: -65,
    width: 2,
    height: 2,
  });
  assert.equal(
    changedHeightBounds(record, { ...heightRecord(-32, -64, 0.5, b), name: 'changed metadata' }),
    undefined,
  );
  assert.equal(
    changedHeightBounds(record, { ...record, height: { ...record.height, x: 0 } }),
    undefined,
  );
  assert.equal(
    changedHeightBounds(record, { ...record, height: { ...record.height, data: 'broken' } }),
    undefined,
  );
  assert.equal(changedHeightBounds(undefined, { ...record, paint: { version: 2 } }), undefined);
});
function fixture(t) {
  const base = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/precise-bounds-'),
    store = new CampaignStore(dir + '/world.sqlite'),
    cam = store.create('Bounds'),
    token = store.activateShell(cam.id).token;
  const write = (action) =>
    store.executeAtlasCommit({ commandId: randomUUID(), campaignId: cam.id, token, action });
  for (const x of [-2048, 0])
    for (const y of [-2048, 0])
      write({
        kind: 'landscape-put',
        expectedRevision: null,
        record: heightRecord(x, y, 32, new Float32Array(4096).fill(100)),
      });
  const db = new (require('better-sqlite3'))(store.filename, { readonly: true }),
    reader = new AtlasLandscapeReader(db);
  t.after(() => {
    db.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const box = { x: -100, y: -100, width: 200, height: 200 },
    view = {
      box,
      frame: box,
      columns: 97,
      rows: 97,
      focusM: 100,
      tilt: 45,
      rotation: 0,
      exaggeration: 1,
    };
  let source;
  const read = () => {
    source = store.atlasRegionSource(token, source);
    reader.sync(source);
    const q = {
      view,
      width: 256,
      height: 256,
      contours: 10,
      displayMpp: 200 / 256,
      revision: source.revision,
      fence: source.fence,
    };
    const cached = reader.terrain(source, q),
      cold = readTerrainProjection(db, source, q, (kind, b) =>
        kind === 'line' ? reader.lines(source, b) : reader.rows(source, b, true, 0, 0, kind),
      );
    assert.deepEqual(cached.pixels, cold.pixels);
    assert.deepEqual(cached.grid.heights, cold.grid.heights);
    return { source, cached };
  };
  const stroke = (x, y) =>
    write({
      kind: 'landscape-height-stroke',
      stroke: {
        mode: 'raise',
        radius: 9,
        strength: 100,
        feather: 0.8,
        samples: [
          { x, y, t: 0 },
          { x, y, t: 100 },
        ],
      },
    });
  return { store, cam, token, write, stroke, read };
}
test('new fine tiles and successive local edits emit narrower bounds and match complete pixel/grid rebuilds', (t) => {
  const f = fixture(t),
    initial = f.read();
  f.stroke(-8, -5);
  let current = f.read();
  assert.notDeepEqual(current.cached.pixels, initial.cached.pixels);
  const edits = current.source.changes.filter((c) => c.table === 'atlas_landscape');
  assert(edits.length > 0);
  assert(
    edits.every(
      (c) => c.terrainBounds && c.terrainBounds.width < 20 && c.terrainBounds.height < 20,
    ),
  );
  f.stroke(-8, -5);
  f.read();
  f.write({ kind: 'undo' });
  f.read();
  f.write({ kind: 'redo' });
  f.read();
  f.stroke(-60, 0);
  f.stroke(60, 0);
  f.read();
});
test('multiple journal entries for one tile union precise bounds; any raw or Undo mutation forces full-row fallback', (t) => {
  const f = fixture(t);
  f.read();
  f.stroke(-8, -5);
  const first = f.read();
  f.stroke(-8, -5);
  f.stroke(-7, -5);
  const later = f.store.atlasRegionSource(f.token, first.source);
  assert(later.changes.filter((c) => c.table === 'atlas_landscape').every((c) => c.terrainBounds));
  const id = later.changes.find((c) => c.table === 'atlas_landscape').id;
  f.store.db
    .prepare('UPDATE atlas_landscape SET revision=revision+1 WHERE campaign_id=? AND id=?')
    .run(f.cam.id, id);
  f.stroke(-7, -5);
  const raw = f.store.atlasRegionSource(f.token, first.source);
  assert.equal(raw.changes.find((c) => c.id === id).terrainBounds, undefined);
  f.read();
  const beforeUndo = f.store.atlasRegionSource(f.token);
  f.write({ kind: 'undo' });
  assert(
    f.store
      .atlasRegionSource(f.token, beforeUndo)
      .changes.some((c) => c.table === 'atlas_landscape' && !c.terrainBounds),
  );
  f.read();
});
test('journal bounds roll back atomically; external changes and a lost journal suffix reset readers', (t) => {
  const f = fixture(t);
  const before = f.read();
  assert.throws(
    () =>
      f.store.db.transaction(() => {
        f.stroke(0, 0);
        assert(
          f.store.atlasRegionSource(f.token, before.source).changes.some((c) => c.terrainBounds),
        );
        throw Error('rollback');
      })(),
    /rollback/,
  );
  assert.deepEqual(f.store.atlasRegionSource(f.token, before.source).changes, []);
  assert.deepEqual(f.read().cached.pixels, before.cached.pixels);
  const other = new (require('better-sqlite3'))(f.store.filename);
  try {
    other
      .prepare('UPDATE atlas_landscape SET revision=revision+1 WHERE campaign_id=?')
      .run(f.cam.id);
  } finally {
    other.close();
  }
  assert(f.store.atlasRegionSource(f.token, before.source).reset);
  f.read();
  const cursor = f.store.atlasRegionSource(f.token);
  f.store.db.transaction(() => {
    for (let i = 0; i < 10002; i++)
      f.store.db
        .prepare('UPDATE atlas_landscape SET revision=revision+1 WHERE campaign_id=?')
        .run(f.cam.id);
  })();
  assert(f.store.atlasRegionSource(f.token, cursor).reset);
  assert(f.store.db.prepare('SELECT count(*) n FROM temp.atlas_read_changes').get().n <= 10000);
});

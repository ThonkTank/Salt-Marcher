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
      "export * from './src/app/storage/store';export * from './src/app/storage/atlas-landscape-region';export * from './src/app/terrain-height';export * from './src/app/terrain-route';export * from './src/app/atlas-landscape';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-empty-kinds.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
    CampaignStore,
    AtlasLandscapeReader,
    heightRecord,
    bounds,
    routeSpec,
  } = require('../.build/terrain-empty-kinds.cjs'),
  Database = require('better-sqlite3');
const kinds = ['height', 'route', 'lake', 'base', 'cover', 'color'],
  box = { x: -64, y: -64, width: 128, height: 128 };
function setup(t) {
  const base = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/terrain-kinds-');
  const store = new CampaignStore(dir + '/world.sqlite'),
    cam = store.create('Kinds');
  let token = store.activateShell(cam.id).token,
    source;
  const db = new Database(store.filename, { readonly: true }),
    reader = new AtlasLandscapeReader(db);
  t.after(() => {
    db.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const sync = () => {
    source = store.atlasRegionSource(token, source);
    reader.sync(source);
    return source;
  };
  const rows = (kind) => [...reader.rows(source, box, true, 0, 0, kind)];
  const put = (record, campaignId = cam.id, writer = store.db) => {
    const b = bounds(record);
    writer
      .prepare('INSERT OR REPLACE INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)')
      .run(
        campaignId,
        record.id,
        1,
        b.x,
        b.x + b.width,
        b.y,
        b.y + b.height,
        JSON.stringify(record),
      );
  };
  return {
    store,
    cam,
    db,
    reader,
    put,
    sync,
    rows,
    activate(id) {
      token = store.activateShell(id).token;
    },
    write(action) {
      return store.executeAtlasCommit({
        commandId: randomUUID(),
        campaignId: cam.id,
        token,
        action,
      });
    },
  };
}
// Metadata probes only: a category must never disappear merely because no
// instance existed in the preceding snapshot. Rendering uses valid real writes below.
function record(kind, id = kind) {
  const r = {
    id,
    revision: 1,
    kind: 'patch',
    name: '',
    points: [],
    polygons: [
      {
        outer: [
          { x: -20, y: -20 },
          { x: 20, y: -20 },
          { x: 20, y: 20 },
          { x: -20, y: 20 },
        ],
        holes: [],
      },
    ],
    resolution: 1,
    width: 0,
    values: {},
  };
  if (kind === 'height') return { ...heightRecord(0, 0, 1, new Float32Array(4096).fill(100)), id };
  if (kind === 'route') {
    const points = [
      { x: -20, y: 0 },
      { x: 20, y: 0 },
    ];
    return { ...r, kind: 'road', points, route: routeSpec('road', points) };
  }
  if (kind === 'lake') return { ...r, surface: 'freshwater', waterLevelM: 10 };
  if (kind === 'base') return { ...r, values: { terrain: 'plains' } };
  if (kind === 'cover') return { ...r, kind: 'vegetation', vegetation: {} };
  return { ...r, paint: { version: 2 } };
}
test('absent terrain categories perform no row queries; insertion and last deletion refresh each category', (t) => {
  const f = setup(t);
  f.sync();
  const sql = f.reader.sql;
  let calls = 0,
    inventories = 0;
  f.reader.sql = function (...args) {
    calls++;
    if (args[0].startsWith('SELECT DISTINCT terrain_kind')) inventories++;
    return sql.apply(this, args);
  };
  for (const kind of kinds) assert.deepEqual(f.rows(kind), []);
  assert.equal(calls, 0, 'empty categories skip even statement/page setup');
  for (const kind of kinds) {
    f.put(record(kind));
    assert.equal(f.sync().reset, false);
    assert.deepEqual(
      f.rows(kind).map((r) => r.id),
      [kind],
    );
  }
  const before = inventories;
  f.put({
    ...record('height'),
    height: heightRecord(0, 0, 1, new Float32Array(4096).fill(200)).height,
  });
  f.sync();
  assert.equal(inventories, before, 'an ordinary height update does not scan the inventory again');
  for (const kind of kinds) {
    f.store.db
      .prepare('DELETE FROM atlas_landscape WHERE campaign_id=? AND id=?')
      .run(f.cam.id, kind);
    f.sync();
    calls = 0;
    assert.deepEqual(f.rows(kind), []);
    assert.equal(calls, 0);
  }
});
test('replacement between categories and removal of only one instance do not leave a stale absence', (t) => {
  const f = setup(t);
  f.sync();
  f.put(record('base', 'moving'));
  f.put(record('base', 'remaining'));
  f.sync();
  assert.equal(f.rows('base').length, 2);
  f.put(record('lake', 'moving'));
  f.sync();
  assert.deepEqual(
    f.rows('base').map((r) => r.id),
    ['remaining'],
  );
  assert.deepEqual(
    f.rows('lake').map((r) => r.id),
    ['moving'],
  );
  f.store.db
    .prepare('DELETE FROM atlas_landscape WHERE id=? AND campaign_id=?')
    .run('remaining', f.cam.id);
  f.sync();
  assert.equal(f.rows('base').length, 0);
  assert.equal(f.rows('lake').length, 1);
});
test('campaign switches and external source resets rebuild the category inventory', (t) => {
  const f = setup(t);
  f.sync();
  f.put(record('height'));
  f.sync();
  assert.equal(f.rows('height').length, 1);
  const other = f.store.create('Empty campaign');
  f.activate(other.id);
  f.sync();
  assert.equal(f.reader.invalidation.reset, true);
  assert.deepEqual(f.rows('height'), []);
  const external = new Database(f.store.filename);
  try {
    f.put(record('lake'), other.id, external);
  } finally {
    external.close();
  }
  assert.equal(f.sync().reset, true);
  assert.deepEqual(
    f.rows('lake').map((r) => r.id),
    ['lake'],
  );
});
test('first real height and lake appear in the image immediately, including Undo and Redo', (t) => {
  const f = setup(t),
    q = {
      box: { x: 0, y: 0, width: 32, height: 32 },
      width: 64,
      height: 64,
      scopeId: null,
      floorId: 'ground',
      slice: null,
      roofs: true,
    };
  const image = () => {
    const source = f.sync(),
      layer = f.reader.read(source, q, 2 * 1024 * 1024);
    assert.equal(layer.state, 'ready');
    return layer.tiles.map((r) => r.data);
  };
  const empty = image();
  f.write({
    kind: 'landscape-put',
    expectedRevision: null,
    record: heightRecord(0, 0, 1, new Float32Array(4096).fill(20)),
  });
  const land = image();
  assert.notDeepEqual(land, empty);
  f.write({
    kind: 'landscape-put',
    expectedRevision: null,
    record: { ...record('lake'), revision: 0, waterLevelM: 25 },
  });
  const lake = image();
  assert.notDeepEqual(lake, land);
  f.write({ kind: 'undo' });
  assert.deepEqual(image(), land);
  f.write({ kind: 'undo' });
  assert.deepEqual(image(), empty);
  f.write({ kind: 'redo' });
  assert.deepEqual(image(), land);
  f.write({ kind: 'redo' });
  assert.deepEqual(image(), lake);
});

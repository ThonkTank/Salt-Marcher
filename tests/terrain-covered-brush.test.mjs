// The former coarse-brush rejection contract was replaced by additive scale bands.
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
      "export * from './src/app/storage/store';export * from './src/app/terrain-height';export * from './src/app/storage/terrain-scale';export * from './src/app/atlas-landscape';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-covered-brush-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  heightRecord,
  TerrainSampler,
  TerrainScalePyramid,
  computeTerrainStroke,
  bounds,
} = require('../.build/terrain-covered-brush-test.cjs');
const radius = 2500 * 1609.344;
function setup(t, side = 4) {
  const base = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/scale-brush-'),
    store = new CampaignStore(dir + '/world.sqlite'),
    cam = store.create('Scale'),
    token = store.activateShell(cam.id).token;
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const put = store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
  store.db.transaction(() => {
    for (let y = -side / 2; y < side / 2; y++)
      for (let x = -side / 2; x < side / 2; x++) {
        const r = heightRecord(
            x * 64,
            y * 64,
            1,
            Float32Array.from(
              { length: 4096 },
              (_, i) => 100 + 10 * Math.cos((x * 64 + (i % 64)) / 8),
            ),
          ),
          b = bounds(r);
        put.run(
          cam.id,
          r.id,
          1,
          b.x,
          b.x + b.width,
          b.y,
          b.y + b.height,
          JSON.stringify({ ...r, revision: 1 }),
        );
      }
  })();
  const rows = () =>
    store.db.prepare('SELECT id,revision,payload FROM atlas_landscape ORDER BY id').all();
  const write = (action, group) => {
    const s = store.atlasRegionSource(token);
    return store.executeAtlasCommit({
      commandId: randomUUID(),
      campaignId: cam.id,
      token,
      sourceFence: s.fence,
      ...(group ? { terrainStroke: { id: group, expectedRevision: s.revision } } : {}),
      action,
    });
  };
  return { store, cam, token, write, rows, dir };
}
const stroke = (mode = 'raise', r = radius) => ({
  kind: 'landscape-height-stroke',
  stroke: {
    mode,
    radius: r,
    strength: 100,
    feather: 0,
    ...(mode === 'level' ? { targetM: 200 } : {}),
    samples: [
      { x: 0, y: 0, t: 0 },
      { x: 0, y: 0, t: 500 },
    ],
  },
});
test('2500-mile sculpt on 1024 fine tiles reads only its scale, moves detail and keeps legacy bytes', (t) => {
  const f = setup(t, 32),
    before = f.rows(),
    z = f.store.atlasHeight(f.token, { x: 0, y: 0 }).heightM;
  const action = stroke(),
    start = performance.now();
  f.write(action);
  t.diagnostic('2500-mile canonical commit ' + (performance.now() - start).toFixed(1) + ' ms');
  const after = f.rows();
  assert.deepEqual(
    after.filter((r) => r.id.startsWith('height:')),
    before,
  );
  assert(after.length - before.length <= 16);
  assert.equal(f.store.atlasHeight(f.token, { x: 0, y: 0 }).heightM, z + 50);
  for (const x of [-30, 8, 40])
    assert(
      Math.abs(
        f.store.atlasHeight(f.token, { x, y: 0 }).heightM - (100 + 10 * Math.cos(x / 8) + 50),
      ) < 1e-5,
    );
  f.write({ kind: 'undo' });
  assert.deepEqual(f.rows(), before);
  f.write({ kind: 'redo' });
  assert.deepEqual(
    f.rows().map((r) => [r.id, JSON.parse(r.payload).height]),
    after.map((r) => [r.id, JSON.parse(r.payload).height]),
  );
  const db = new CampaignStore(f.dir + '/world.sqlite');
  assert.equal(db.db.pragma('user_version', { simple: true }), 55);
  db.close();
});
test('successive large and small scale writes remain one gesture and rejected writes preserve its prefix', (t) => {
  const f = setup(t),
    before = f.rows(),
    group = randomUUID();
  f.write(stroke('raise'), group);
  const prefix = f.rows();
  f.store.db.exec(
    "CREATE TEMP TRIGGER fail_height BEFORE INSERT ON atlas_landscape BEGIN SELECT RAISE(ABORT,'write failure'); END",
  );
  assert.throws(() => f.write(stroke('lower', 8), group), /write failure/);
  assert.deepEqual(f.rows(), prefix);
  f.store.db.exec('DROP TRIGGER fail_height');
  f.write(stroke('lower', 8), group);
  assert.notDeepEqual(f.rows(), prefix);
  f.write({ kind: 'undo' });
  assert.deepEqual(f.rows(), before);
});
test('large smoothing preserves more of a legacy spike than a small brush', (t) => {
  const f = setup(t),
    base = [];
  for (let y = -2; y < 2; y++)
    for (let x = -2; x < 2; x++)
      base.push(
        heightRecord(
          x * 64,
          y * 64,
          1,
          Float32Array.from(
            { length: 4096 },
            (_, i) => 200 + (x * 64 + (i % 64) === 0 && y * 64 + Math.floor(i / 64) === 0 ? 90 : 0),
          ),
        ),
      );
  f.write({
    kind: 'landscape-batch',
    records: base.map((record) => ({ record, expectedRevision: 1 })),
  });
  const before = f.rows();
  const at = () => f.store.atlasHeight(f.token, { x: 0, y: 0 }).heightM;
  f.write(stroke('smooth', 16));
  const small = at();
  f.write({ kind: 'undo' });
  assert.deepEqual(f.rows(), before);
  f.write(stroke('smooth', 128));
  const large = at();
  assert(large > small + 10, { small, large });
  assert(large <= 290 && large > 280, { small, large });
  assert.deepEqual(
    f.rows().filter((r) => r.id.startsWith('height:')),
    before,
  );
});
test('coarse target retains fine additive peaks and does not rewrite them', (t) => {
  const f = setup(t);
  f.write(stroke('raise', 8));
  const fine = f.rows().filter((r) => r.id.startsWith('height-delta:'));
  const a = stroke('level', 128);
  a.stroke.strength = 10000;
  f.write(a);
  assert(f.store.atlasHeight(f.token, { x: 0, y: 0 }).heightM > 240);
  assert.deepEqual(
    f.rows().filter((r) => fine.some((p) => p.id === r.id)),
    fine,
  );
});
test('derived legacy tiles reuse additive edits, invalidate legacy edits, and remain source-fenced', (t) => {
  const f = setup(t),
    pyramid = new TerrainScalePyramid();
  let source = f.store.atlasRegionSource(f.token);
  pyramid.sync(f.store.db, source);
  const action = stroke('smooth', 64);
  computeTerrainStroke(f.store.db, f.cam.id, action.stroke, pyramid);
  const cold = pyramid.diagnostics;
  const cursor = { epoch: source.epoch, sequence: source.sequence };
  f.write(stroke());
  source = f.store.atlasRegionSource(f.token, cursor);
  pyramid.sync(f.store.db, source);
  computeTerrainStroke(f.store.db, f.cam.id, action.stroke, pyramid);
  assert.equal(pyramid.diagnostics.misses, cold.misses);
  assert(pyramid.diagnostics.hits > cold.hits);
  assert(pyramid.diagnostics.bytes <= 8 * 1024 * 1024);
  const prepared = {
    fence: source.fence,
    revision: source.revision,
    stroke: JSON.stringify(action.stroke),
    records: computeTerrainStroke(f.store.db, f.cam.id, action.stroke, pyramid),
  };
  f.write(stroke('lower'));
  const rows = f.rows();
  assert.throws(
    () =>
      f.store.executeAtlasCommit(
        { token: f.token, campaignId: f.cam.id, commandId: randomUUID(), action },
        prepared,
      ),
    /inzwischen/,
  );
  assert.deepEqual(f.rows(), rows);
  const old = f.rows().find((r) => r.id === 'height:0:0:0'),
    r = JSON.parse(old.payload),
    next = heightRecord(0, 0, 1, new Float32Array(4096).fill(500));
  const prior = f.store.atlasRegionSource(f.token);
  f.write({ kind: 'landscape-put', record: next, expectedRevision: r.revision });
  source = f.store.atlasRegionSource(f.token, { epoch: prior.epoch, sequence: prior.sequence });
  pyramid.sync(f.store.db, source);
  computeTerrainStroke(f.store.db, f.cam.id, action.stroke, pyramid);
  assert(pyramid.diagnostics.misses > cold.misses);
});
test('prepared patches check tile revisions and roll back atomically', (t) => {
  const f = setup(t),
    a = stroke(),
    source = f.store.atlasRegionSource(f.token),
    records = computeTerrainStroke(f.store.db, f.cam.id, a.stroke);
  records.at(-1).revision = 999;
  const before = f.rows();
  assert.throws(
    () =>
      f.store.executeAtlasCommit(
        { token: f.token, campaignId: f.cam.id, commandId: randomUUID(), action: a },
        {
          fence: source.fence,
          revision: source.revision,
          stroke: JSON.stringify(a.stroke),
          records,
        },
      ),
    /inzwischen/,
  );
  assert.deepEqual(f.rows(), before);
});
test('current format preserves terrain rows and history on reopen; future formats are rejected', (t) => {
  const f = setup(t);
  f.write(stroke());
  const rows = f.rows(),
    history = f.store.db.prepare('SELECT payload FROM atlas_command').all();
  const newer = new CampaignStore(f.dir + '/world.sqlite');
  assert.equal(newer.db.pragma('user_version', { simple: true }), 55);
  assert.deepEqual(
    newer.db.prepare('SELECT id,revision,payload FROM atlas_landscape ORDER BY id').all(),
    rows,
  );
  assert.deepEqual(newer.db.prepare('SELECT payload FROM atlas_command').all(), history);
  newer.close();
  f.store.db.pragma('user_version=56');
  assert.throws(() => new CampaignStore(f.dir + '/world.sqlite'), /Testdatenformat/);
});
test('archive roundtrip accepts legacy and additive heights at the same address and preserves source history', async (t) => {
  const f = setup(t);
  f.write(stroke('raise', 32));
  const initial = f.store.atlasHeight(f.token, { x: 0, y: 0 }).heightM,
    filename = f.dir + '/snapshot.sqlite';
  const both = f
    .rows()
    .map((r) => JSON.parse(r.payload))
    .filter((r) => r.height.x === 0 && r.height.y === 0 && r.height.pixel === 1);
  assert.deepEqual(both.map((r) => r.height.version).sort(), [1, 2]);
  await f.store.campaignSnapshot(f.token, filename);
  const copy = f.store.acceptCampaignSnapshot(filename, 'Copy', {}),
    token = f.store.activate(copy.id).token;
  assert.equal(f.store.atlasHeight(token, { x: 0, y: 0 }).heightM, initial);
  assert.equal(
    f.store.db.prepare('SELECT count(*) n FROM atlas_command WHERE campaign_id=?').get(f.cam.id).n,
    1,
  );
  f.store.executeAtlasCommit({
    token,
    campaignId: copy.id,
    commandId: randomUUID(),
    action: stroke('raise', 32),
  });
  f.store.executeAtlasCommit({
    token,
    campaignId: copy.id,
    commandId: randomUUID(),
    action: { kind: 'undo' },
  });
  assert.equal(f.store.atlasHeight(token, { x: 0, y: 0 }).heightM, initial);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/atlas/terrain-height';export * from './desktop/atlas-region';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-scale-worker-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['desktop/atlas-region-worker.ts'],
  outfile: '.build/terrain-scale-reader.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  AtlasRegionService,
  heightRecord,
} = require('../../.build/terrain-scale-worker-test.cjs');
async function fixture(t) {
  const base = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/scale-worker-'),
    store = new CampaignStore(dir + '/world.sqlite'),
    cam = store.create('Worker'),
    token = store.activateShell(cam.id).token,
    service = new AtlasRegionService(path.resolve('.build/terrain-scale-reader.cjs'));
  t.after(async () => {
    await service.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const action = {
    kind: 'landscape-height-stroke',
    stroke: {
      mode: 'raise',
      radius: 2500 * 1609.344,
      strength: 100,
      feather: 0,
      samples: [
        { x: 0, y: 0, t: 0 },
        { x: 0, y: 0, t: 100 },
      ],
    },
  };
  const command = () => ({ token, campaignId: cam.id, commandId: randomUUID(), action });
  return { store, service, command, token, cam };
}
test('readonly worker prepares the real large brush; the canonical Store alone writes and replays the receipt', async (t) => {
  const f = await fixture(t),
    c = f.command(),
    source = f.store.terrainStrokeSource(c, f.service.cursor);
  let ticks = 0;
  const timer = setInterval(() => ticks++, 1);
  const prepared = await f.service.prepareTerrainStroke(source, c.action.stroke);
  clearInterval(timer);
  assert(ticks > 0);
  assert(prepared.records.length > 0 && prepared.records.length <= 16);
  assert(prepared.records.every((r) => r.height.version === 2));
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM atlas_landscape').get().n, 0);
  f.store.executeAtlasCommit(c, prepared);
  assert.equal(f.store.atlasHeight(f.token, { x: 0, y: 0 }).heightM, -90);
  assert.equal(f.store.terrainStrokeSource(c, f.service.cursor), undefined);
  const revision = f.store.atlasRegionSource(f.token).revision;
  f.store.executeAtlasCommit(c);
  assert.equal(f.store.atlasRegionSource(f.token).revision, revision);
  assert.equal(f.service.diagnostics.workerStarts, 1);
});
test('intervening writes reject computed patches; worker survives and accepts a new source', async (t) => {
  const f = await fixture(t),
    c = f.command(),
    source = f.store.terrainStrokeSource(c, f.service.cursor),
    prepared = await f.service.prepareTerrainStroke(source, c.action.stroke);
  f.store.executeAtlasCommit(f.command());
  const before = f.store.db.prepare('SELECT payload FROM atlas_landscape ORDER BY id').all();
  assert.throws(() => f.store.executeAtlasCommit(c, prepared), /inzwischen/);
  assert.deepEqual(
    f.store.db.prepare('SELECT payload FROM atlas_landscape ORDER BY id').all(),
    before,
  );
  const next = f.command(),
    fresh = f.store.terrainStrokeSource(next, f.service.cursor),
    patch = await f.service.prepareTerrainStroke(fresh, next.action.stroke);
  f.store.executeAtlasCommit(next, patch);
  assert.equal(f.store.atlasHeight(f.token, { x: 0, y: 0 }).heightM, -80);
});
test('worker target/smoothing share the filtered legacy source across edits and undo', async (t) => {
  const f = await fixture(t);
  for (let y = -1; y <= 0; y++)
    for (let x = -1; x <= 0; x++)
      f.store.executeAtlasCommit({
        ...f.command(),
        action: {
          kind: 'landscape-put',
          record: heightRecord(
            x * 64,
            y * 64,
            1,
            Float32Array.from({ length: 4096 }, (_, i) => 100 + Math.cos(i % 64) * 20),
          ),
          expectedRevision: null,
        },
      });
  for (const mode of ['level', 'smooth', 'raise', 'smooth']) {
    const c = f.command();
    c.action = {
      ...c.action,
      stroke: {
        ...c.action.stroke,
        mode,
        radius: 64,
        ...(mode === 'level' ? { targetM: 250 } : {}),
      },
    };
    const s = f.store.terrainStrokeSource(c, f.service.cursor),
      p = await f.service.prepareTerrainStroke(s, c.action.stroke);
    f.store.executeAtlasCommit(c, p);
  }
  const before = f.store.atlasHeight(f.token, { x: 0, y: 0 }).heightM;
  assert(Number.isFinite(before));
  assert(before > 120);
  f.store.executeAtlasCommit({ ...f.command(), action: { kind: 'undo' } });
  const c = f.command(),
    s = f.store.terrainStrokeSource(c, f.service.cursor),
    p = await f.service.prepareTerrainStroke(s, c.action.stroke);
  f.store.executeAtlasCommit(c, p);
  assert(Number.isFinite(f.store.atlasHeight(f.token, { x: 0, y: 0 }).heightM));
});
test('scale preparation yields to queued selection work and cancellation never authors a partial result', async (t) => {
  const f = await fixture(t),
    c = f.command();
  c.action.stroke.mode = 'smooth';
  c.action.stroke.radius = 64;
  const source = f.store.terrainStrokeSource(c, f.service.cursor),
    order = [];
  const author = f.service.prepareTerrainStroke(source, c.action.stroke).then((v) => {
    order.push('author');
    return v;
  });
  const selection = f.service.focus(source, 'scope', 'missing').then(
    () => order.push('selection'),
    () => order.push('selection'),
  );
  await Promise.all([author, selection]);
  assert.deepEqual(order, ['selection', 'author']);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM atlas_landscape').get().n, 0);
  const next = f.service.prepareTerrainStroke(source, { ...c.action.stroke, radius: 128 });
  const rejected = assert.rejects(next, /abgebrochen|beendet/);
  await f.service.cancelAndWait();
  await rejected;
  assert.equal(f.service.diagnostics.active, false);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM atlas_landscape').get().n, 0);
});

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
      "export * from './src/app/storage/store';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/terrain-brush';export * from './desktop/atlas-region';export * from './src/app/atlas/terrain-brush-draft';export * from './src/app/atlas/terrain-stroke-queue';",
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
  applyTerrainBrush,
  TerrainSampler,
  TerrainBrushDraft,
  TerrainStrokeQueue,
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
test('height worker returns coupled lake and heights for one atomic commit and original receipt replay', async (t) => {
  const f = await fixture(t);
  const write = (action) => f.store.executeAtlasCommit({ ...f.command(), action });
  for (const y of [-512, 0])
    for (const x of [-512, 0])
      write({
        kind: 'landscape-put',
        expectedRevision: null,
        record: heightRecord(x, y, 8, new Float32Array(4096).fill(20)),
      });
  write({
    kind: 'landscape-lake-stroke',
    stroke: {
      id: 'worker-lake',
      mode: 'dig',
      radius: 48,
      strength: 2,
      feather: 0.8,
      waterLevelM: 20,
      samples: [
        { x: 64, y: 0, t: 0 },
        { x: 64, y: 0, t: 3000 },
      ],
    },
  });
  const c = f.command();
  c.action.stroke = {
    mode: 'raise',
    radius: 128,
    strength: 2,
    feather: 0.5,
    samples: [
      { x: 64, y: 0, t: 0 },
      { x: 64, y: 0, t: 2000 },
    ],
  };
  const source = f.store.terrainStrokeSource(c, f.service.cursor),
    prepared = await f.service.prepareTerrainStroke(source, c.action.stroke);
  assert.equal(prepared.records.find((r) => r.id === 'worker-lake').waterLevelM, 24);
  assert.equal(
    f.store.db
      .prepare(
        "SELECT json_extract(payload,'$.waterLevelM') level FROM atlas_landscape WHERE id='worker-lake'",
      )
      .get().level,
    20,
  );
  const before = f.store.db
    .prepare('SELECT cursor FROM campaign_atlas WHERE campaign_id=?')
    .get(f.cam.id).cursor;
  f.store.executeAtlasCommit(c, prepared);
  assert.equal(f.store.atlasHeight(f.token, { x: 64, y: 0 }).heightM, 18);
  assert.equal(
    f.store.db
      .prepare(
        "SELECT json_extract(payload,'$.waterLevelM') level FROM atlas_landscape WHERE id='worker-lake'",
      )
      .get().level,
    24,
  );
  assert.equal(
    f.store.db.prepare('SELECT cursor FROM campaign_atlas WHERE campaign_id=?').get(f.cam.id)
      .cursor,
    before + 1,
  );
  assert.equal(f.store.reconcileAtlasCommit(c).outcome, 'applied');
  f.store.executeAtlasCommit(c);
  assert.equal(
    f.store.db.prepare('SELECT cursor FROM campaign_atlas WHERE campaign_id=?').get(f.cam.id)
      .cursor,
    before + 1,
  );
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

test('all form commands cross the real worker boundary and preserve undo, redo, restart and fine bands', async (t) => {
  const f = await fixture(t);
  const rows = () =>
    f.store.db
      .prepare('SELECT payload FROM atlas_landscape ORDER BY id')
      .all()
      .map((r) => JSON.parse(r.payload));
  const heights = (rs) => rs.map((r) => [r.id, r.height]);
  const fine = f.command();
  fine.action.stroke = {
    mode: 'roughen',
    radius: 4,
    strength: 10,
    feather: 0.8,
    seed: 72,
    samples: [
      { x: 0, y: 0, t: 0 },
      { x: 0, y: 0, t: 1000 },
    ],
  };
  f.store.executeAtlasCommit(fine);
  const originalFine = heights(rows());
  for (const form of ['hills', 'mountains', 'canyon']) {
    const c = f.command();
    c.action.stroke = {
      form,
      mode: form === 'canyon' ? 'lower' : 'raise',
      seed: 0x51a7c3,
      radius: 32,
      strength: 120,
      feather: 0.7,
      samples: [
        { x: -80, y: -12, t: 0 },
        { x: -24, y: 8, t: 800 },
        { x: 24, y: -8, t: 1600 },
        { x: 80, y: 12, t: 2400 },
      ],
    };
    const before = rows(),
      expected = applyTerrainBrush(before, c.action.stroke),
      source = f.store.terrainStrokeSource(c, f.service.cursor),
      prepared = await f.service.prepareTerrainStroke(source, c.action.stroke);
    assert.deepEqual(heights(prepared.records), heights(expected));
    f.store.executeAtlasCommit(c, prepared);
    const after = rows();
    assert.deepEqual(
      heights(after).filter(([id]) => originalFine.some(([old]) => id === old)),
      originalFine,
    );
    const a = new TerrainSampler(after),
      b = new TerrainSampler(before),
      sign = form === 'canyon' ? -1 : 1;
    for (const p of [
      { x: -64, y: -6 },
      { x: 0, y: 0 },
      { x: 64, y: 6 },
    ])
      assert(
        sign * (a.sample(p).heightM - b.sample(p).heightM) > 1,
        form + ' effect across signed tile joins',
      );
    f.store.executeAtlasCommit({ ...f.command(), action: { kind: 'undo' } });
    assert.deepEqual(heights(rows()), heights(before));
    f.store.executeAtlasCommit({ ...f.command(), action: { kind: 'redo' } });
    assert.deepEqual(heights(rows()), heights(after));
    const fresh = new CampaignStore(f.store.db.name);
    try {
      const token = fresh.activateShell(f.cam.id).token;
      for (const p of [
        { x: -64, y: -6 },
        { x: 0, y: 0 },
        { x: 64, y: 6 },
      ])
        assert.equal(fresh.atlasHeight(token, p).heightM, a.sample(p).heightM);
    } finally {
      fresh.close();
    }
  }
});

test('real editing packet, pending successor and writer preserve multiscale heights through receipts, undo/redo and fresh open', async (t) => {
  const f = await fixture(t),
    rows = () =>
      f.store.db
        .prepare('SELECT payload FROM atlas_landscape ORDER BY id')
        .all()
        .map((r) => JSON.parse(r.payload));
  const bytes = () =>
    rows()
      .filter((r) => r.height)
      .map((r) => [r.id, r.height.data]);
  for (const pixel of [2, 0.25])
    for (let y = -1; y <= 1; y++)
      for (let x = -1; x <= 1; x++) {
        const record = heightRecord(
          x * 64 * pixel,
          y * 64 * pixel,
          pixel,
          Float32Array.from({ length: 4096 }, (_, i) => {
            const xx = (x * 64 + (i % 64)) * pixel,
              yy = (y * 64 + Math.floor(i / 64)) * pixel;
            return pixel === 2
              ? 230 + 0.15 * xx + 12 * Math.cos(yy / 10)
              : 8 * Math.exp(-((xx - 16) ** 2) / 2) -
                  6 * Math.exp(-((xx - 16) ** 2 + (yy - 12) ** 2) / 6);
          }),
          2,
        );
        f.store.executeAtlasCommit({
          ...f.command(),
          action: { kind: 'landscape-put', record, expectedRevision: null },
        });
      }
  const source = f.store.atlasRegionSource(f.token, f.service.cursor);
  const tile = await f.service.terrainTile(source, {
    tile: { lod: -2, x: 0, y: 0 },
    revision: source.revision,
    product: 'height',
    editingRadius: 32,
  });
  assert.equal(tile.projection.grid.editing.author.revision, source.revision);
  assert.equal(tile.projection.grid.editing.author.fence, source.fence);
  assert.equal(tile.projection.grid.editing.author.pixel, 1);
  assert(tile.projection.grid.editing.author.records.some((r) => r.height.pixel === 0.25));
  const first = {
    mode: 'smooth',
    radius: 32,
    strength: 10,
    feather: 0.8,
    preserveDetails: true,
    samples: [
      { x: 16, y: 12, t: 0 },
      { x: 24, y: 20, t: 1000 },
    ],
    visibility: tile.projection.grid.view,
  };
  const second = { ...first, mode: 'raise', strength: 8, preserveDetails: false };
  const a = new TerrainBrushDraft(tile.projection.grid);
  a.update(first);
  const b = new TerrainBrushDraft(a.grid);
  b.update(second);
  const before = bytes(),
    calls = [];
  let release;
  const hold = new Promise((resolve) => (release = resolve));
  const queue = new TerrainStrokeQueue(
    { expectedRevision: source.revision, sourceFence: source.fence },
    async (action, context) => {
      calls.push(structuredClone({ action, context }));
      if (calls.length === 1) await hold;
      const command = {
        ...f.command(),
        commandId: context.commandId,
        action,
        sourceFence: context.sourceFence,
        terrainStroke: { id: context.id, expectedRevision: context.expectedRevision },
      };
      const src = f.store.terrainStrokeSource(command, f.service.cursor),
        patch = await f.service.prepareTerrainStroke(src, action.stroke);
      const ack = f.store.executeAtlasCommit(command, patch);
      const saved = bytes();
      f.store.executeAtlasCommit(command);
      assert.deepEqual(bytes(), saved, 'same receipt never repeats smoothing or relaxation');
      return ack;
    },
  );
  const p1 = queue.enqueue({ kind: 'landscape-height-stroke', stroke: first }, randomUUID());
  const p2 = queue.enqueue({ kind: 'landscape-height-stroke', stroke: second }, randomUUID());
  second.preserveDetails = true;
  assert.equal(queue.pending, 2);
  assert.deepEqual(bytes(), before);
  release();
  await Promise.all([p1, p2]);
  assert.equal(calls.length, 2);
  assert.equal(queue.pending, 0);
  assert.equal(calls[1].action.stroke.preserveDetails, false);
  const expected = new Map(b.records.map((r) => [r.id, r.height?.data]));
  for (const r of rows())
    if (expected.has(r.id))
      assert(r.height.data === expected.get(r.id), 'exact author bytes ' + r.id);
  const canonical = new TerrainSampler(rows(), false);
  let maximum = 0;
  for (let y = 0; y < 65; y++)
    for (let x = 0; x < 65; x++)
      maximum = Math.max(
        maximum,
        Math.abs(b.ground[y * 65 + x] - canonical.sample({ x, y }).heightM),
      );
  assert(maximum <= 2 * 2 ** -16, 'two Float32 additions below 256m: ' + maximum);
  const saved = bytes();
  f.store.executeAtlasCommit({ ...f.command(), action: { kind: 'undo' } });
  const firstResult = new Map(a.records.map((r) => [r.id, r.height?.data]));
  for (const r of rows())
    if (firstResult.has(r.id)) assert(r.height.data === firstResult.get(r.id));
  f.store.executeAtlasCommit({ ...f.command(), action: { kind: 'redo' } });
  assert.deepEqual(bytes(), saved);
  const current = f.store.atlasRegionSource(f.token, f.service.cursor);
  const canonicalTile = await f.service.terrainTile(current, {
    tile: { lod: -2, x: 0, y: 0 },
    revision: current.revision,
    product: 'height',
    editingRadius: 32,
  });
  assert.equal(canonicalTile.projection.grid.editing.author.revision, current.revision);
  for (let i = 0; i < b.ground.length; i++)
    assert(Math.abs(b.ground[i] - canonicalTile.projection.grid.editing.ground[i]) <= 2 * 2 ** -16);
  const fresh = new CampaignStore(f.store.db.name);
  try {
    const tok = fresh.activateShell(f.cam.id).token;
    assert.deepEqual(
      fresh.db
        .prepare('SELECT payload FROM atlas_landscape ORDER BY id')
        .all()
        .map((r) => {
          const v = JSON.parse(r.payload);
          return [v.id, v.height.data];
        }),
      saved,
    );
    for (const point of [
      { x: 15.9, y: 12.3 },
      { x: 16.1, y: 20.7 },
      { x: 32.1, y: 31.9 },
    ])
      assert.equal(fresh.atlasHeight(tok, point).heightM, canonical.sample(point).heightM);
  } finally {
    fresh.close();
  }
  console.log(
    JSON.stringify({
      pendingGestures: calls.length,
      maximumHeightErrorM: maximum,
      sourceRevision: source.revision,
      canonicalRevision: current.revision,
    }),
  );
});

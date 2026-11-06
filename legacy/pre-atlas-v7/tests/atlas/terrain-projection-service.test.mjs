import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from '../helpers/build.mjs';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
for (const [name, file] of [
  ['store', 'src/app/storage/store.ts'],
  ['service', 'desktop/atlas-region.ts'],
  ['worker', 'desktop/atlas-region-worker.ts'],
])
  buildSync({
    entryPoints: [file],
    outfile: '.build/terrain-service-' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const { CampaignStore } = require('../../.build/terrain-service-store.cjs'),
  { AtlasRegionService } = require('../../.build/terrain-service-service.cjs');
test('live frames use changed interpolation support and reject a source overtaken before snapshot creation', async (t) => {
  const base = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/terrain-live-frame-'),
    store = new CampaignStore(dir + '/world.sqlite'),
    campaign = store.create('Live frame'),
    token = store.activateShell(campaign.id).token,
    service = new AtlasRegionService(
      new URL('../../.build/terrain-service-worker.cjs', import.meta.url).pathname,
    );
  t.after(async () => {
    await service.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const box = { x: -32, y: -32, width: 64, height: 64 },
    query = {
      kind: 'top',
      query: {
        box,
        width: 64,
        height: 64,
        scopeId: null,
        floorId: 'ground',
        slice: null,
        roofs: true,
      },
    };
  const source = () => store.atlasRegionSource(token, service.cursor);
  const first = await service.liveTerrain(source(), query);
  assert.equal(first.kind, 'full');
  assert.equal(first.invalidation.reset, true);
  const before = source(),
    stroke = {
      mode: 'raise',
      radius: 4,
      strength: 100,
      feather: 0,
      samples: [
        { x: 0, y: 0, t: 0 },
        { x: 0, y: 0, t: 1000 },
      ],
    };
  store.executeAtlasCommit({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token,
    sourceFence: before.fence,
    action: { kind: 'landscape-height-stroke', stroke },
  });
  await assert.rejects(
    service.liveTerrain(before, query),
    /inzwischen geändert/,
    'a queued old identity must not label new rows',
  );
  const current = source(),
    next = await service.liveTerrain(current, query);
  assert.equal(next.target.revision, current.revision);
  assert.equal(next.target.fence, current.fence);
  assert.match(next.target.key, /^[a-f0-9]{64}$/);
  assert.equal(next.invalidation.reset, false);
  const rows = store.db
    .prepare(
      "SELECT min_x x,min_y y,max_x-min_x width,max_y-min_y height FROM atlas_landscape WHERE json_extract(payload,'$.height') IS NOT NULL",
    )
    .all();
  assert(rows.length > 0);
  assert(next.invalidation.bounds.length > 0);
  for (const b of next.invalidation.bounds)
    assert(
      rows.some(
        (r) =>
          b.x >= r.x &&
          b.y >= r.y &&
          b.x + b.width <= r.x + r.width &&
          b.y + b.height <= r.y + r.height,
      ),
      'precise support stays inside the canonical row',
    );
  const coldService = new AtlasRegionService(
    new URL('../../.build/terrain-service-worker.cjs', import.meta.url).pathname,
  );
  try {
    const cold = await coldService.liveTerrain(store.atlasRegionSource(token), query);
    assert.deepEqual(
      next.layer,
      cold.layer,
      'partial invalidation equals an independent cold read',
    );
  } finally {
    await coldService.close();
  }
  const warm = await service.liveTerrain(source(), query);
  assert.deepEqual(warm.layer, next.layer);
  assert.deepEqual(warm.invalidation, { reset: false, bounds: [] });
  const delta = await service.liveTerrain(source(), query, warm.target);
  assert.equal(delta.kind, 'delta');
  assert.equal(delta.tiles.length, 0);
  const detail = await service.liveTerrain(
    source(),
    { ...query, detail: { x: -8, y: -8, width: 16, height: 16 } },
    delta.target,
  );
  assert.equal(detail.kind, 'full');
  assert(
    detail.layer.tiles.some(
      (t) => t.box.width / t.width <= 32 / 256 && t.box.height / t.height <= 32 / 256,
    ),
    'top-down brush gets genuinely finer world sampling',
  );
  await assert.rejects(
    service.liveTerrain(source(), { ...query, detail: { x: -1000, y: 0, width: 1, height: 1 } }),
    /Geländedetail/,
  );

  store.executeAtlasCommit({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token,
    action: { kind: 'undo' },
  });
  const undone = await service.liveTerrain(source(), query);
  for (const row of rows)
    assert(
      undone.invalidation.bounds.some((b) => JSON.stringify(b) === JSON.stringify(row)),
      'deleted rows retain their old invalidation bounds',
    );
  assert.deepEqual(
    undone.layer,
    first.layer,
    'cached landscape after deletion agrees with the original full frame',
  );
});
test('terrain lane supersedes only its pending projection and remains cancellable with warm worker reuse', async (t) => {
  const base = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/terrain-service-'),
    store = new CampaignStore(dir + '/world.sqlite'),
    campaign = store.create('Service'),
    token = store.activateShell(campaign.id).token,
    service = new AtlasRegionService(
      new URL('../../.build/terrain-service-worker.cjs', import.meta.url).pathname,
    );
  t.after(async () => {
    await service.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const box = { x: 0, y: 0, width: 100, height: 100 },
    view = {
      box,
      frame: box,
      columns: 33,
      rows: 33,
      focusM: 0,
      tilt: 45,
      rotation: 0,
      exaggeration: 2,
    },
    q = {
      view,
      width: 64,
      height: 64,
      revision: store.atlasRegionSource(token).revision,
      contours: 0,
      displayMpp: 1,
    },
    source = store.atlasRegionSource(token, service.cursor);
  const camera = service.read(source, {
    box,
    width: 256,
    height: 256,
    scopeId: null,
    floorId: 'ground',
    slice: null,
    roofs: true,
  });
  const old = service.terrain(source, q);
  const rejected = assert.rejects(old, /neuere Anfrage/);
  const next = service.terrain(source, { ...q, width: 128 });
  await camera;
  await rejected;
  const data = await next;
  assert.equal(data.width, 128);
  assert(data.pixels instanceof Uint8Array);
  assert(data.grid.heights instanceof Float32Array);
  assert.equal(data.fence, source.fence);
  assert.equal(service.diagnostics.workerStarts, 1);
  const stale = store.atlasRegionSource(token, service.cursor);
  await assert.rejects(service.terrain(stale, { ...q, fence: 'obsolete' }), /inzwischen/);
  const pending = service.terrain(stale, q),
    cancelled = assert.rejects(pending, /abgebrochen/);
  service.cancel();
  await cancelled;
  await service.cancelAndWait();
  const fresh = await service.terrain(store.atlasRegionSource(token, service.cursor), q);
  assert.equal(fresh.width, 64);
  assert.equal(service.diagnostics.workerStarts, 2);
  await service.close();
  await assert.rejects(service.terrain(stale, q), /abgebrochen/);
});

async function slicedFixture(t) {
  const base = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/terrain-sliced-'),
    store = new CampaignStore(dir + '/world.sqlite'),
    campaign = store.create('Sliced'),
    token = store.activateShell(campaign.id).token,
    service = new AtlasRegionService(
      new URL('../../.build/terrain-service-worker.cjs', import.meta.url).pathname,
    );
  t.after(async () => {
    await service.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const box = { x: -500, y: -500, width: 1000, height: 1000 },
    view = {
      box,
      frame: box,
      columns: 33,
      rows: 33,
      focusM: 0,
      tilt: 45,
      rotation: 0,
      exaggeration: 1,
    };
  const source = store.atlasRegionSource(token),
    q = {
      view,
      width: 512,
      height: 512,
      revision: source.revision,
      contours: 0,
      displayMpp: 1,
      detail: { x: -250, y: -250, width: 500, height: 500 },
      detailResolution: 1024,
    };
  return {
    store,
    campaign,
    token,
    service,
    source,
    q,
    region: {
      box,
      width: 64,
      height: 64,
      scopeId: null,
      floorId: 'ground',
      slice: null,
      roofs: true,
    },
  };
}
async function yielded(service, after = 0) {
  const end = Date.now() + 10000;
  while (service.diagnostics.terrainYields <= after) {
    assert(Date.now() < end, 'worker did not yield');
    await new Promise((r) => setTimeout(r, 2));
  }
}
test('colour change evidence spans intervening region reads, multiple edits and Undo; restart resets reuse', async (t) => {
  const f = await slicedFixture(t),
    { service, store, token, campaign } = f;
  const source = () => store.atlasRegionSource(token, service.cursor);
  const projection = async (colorBase) => {
    const s = source();
    return service.terrain(s, {
      ...f.q,
      width: 32,
      height: 32,
      detail: undefined,
      detailResolution: undefined,
      revision: s.revision,
      colorBase,
    });
  };
  const first = await projection(),
    base = { revision: first.revision, fence: first.fence };
  for (const x of [-120, 120]) {
    store.executeAtlasCommit({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token,
      action: {
        kind: 'landscape-height-stroke',
        stroke: {
          mode: 'raise',
          radius: 8,
          strength: 100,
          feather: 0,
          samples: [
            { x, y: 0, t: 0 },
            { x, y: 0, t: 1000 },
          ],
        },
      },
    });
    await service.read(source(), f.region); // Consumes the worker cursor before the colour request.
  }
  const changed = await projection(base);
  assert.equal(changed.colorChange.invalidation.reset, false);
  const bounds = changed.colorChange.invalidation.bounds;
  for (const x of [-120, 120])
    assert(bounds.some((b) => x >= b.x && x <= b.x + b.width && b.y <= 0 && b.y + b.height >= 0));
  const warm = await projection(base);
  assert.deepEqual(
    warm.colorChange,
    changed.colorChange,
    'empty synchronizations cannot erase intervening edits',
  );
  const nextBase = { revision: changed.revision, fence: changed.fence };
  store.executeAtlasCommit({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token,
    action: { kind: 'undo' },
  });
  const undone = await projection(nextBase);
  assert.equal(undone.colorChange.invalidation.reset, false);
  assert(undone.colorChange.invalidation.bounds.length > 0);
  const live = await service.liveTerrain(source(), {
    kind: 'tilted',
    query: {
      ...f.q,
      width: 32,
      height: 32,
      detail: undefined,
      detailResolution: undefined,
      revision: undone.revision,
      colorBase: nextBase,
    },
  });
  assert.deepEqual(
    live.projection.colorChange,
    undone.colorChange,
    'live and navigation share the same history',
  );
  await service.cancelAndWait();
  const restarted = await projection(nextBase);
  assert.equal(restarted.colorChange.invalidation.reset, true);
});
test('selection preempts detail without cancelling it; a newer camera replaces it and retains the worker', async (t) => {
  const f = await slicedFixture(t),
    { service, source, q } = f;
  let done = false;
  const outcome = service.terrain(source, q).then(
    (value) => {
      done = true;
      return { value };
    },
    (error) => {
      done = true;
      return { error };
    },
  );
  await yielded(service);
  assert.equal(done, false);
  const hits = await service.candidates(source, f.region, { x: 0, y: 0 });
  assert.equal(hits.total, 0);
  assert.equal(done, false, 'selection completes before the pending detail');
  const camera = service.read(source, f.region);
  assert.match(String((await outcome).error), /neuere Anfrage/);
  await camera;
  const latest = await service.terrain(f.store.atlasRegionSource(f.token, service.cursor), {
    ...q,
    width: 64,
    height: 64,
    detail: undefined,
    detailResolution: undefined,
  });
  assert.equal(latest.width, 64);
  assert.equal(service.diagnostics.workerStarts, 1);
});
test('a commit between slices rejects the old projection and fresh output agrees with a cold worker', async (t) => {
  const f = await slicedFixture(t),
    { service, source, q } = f;
  const outcome = service.terrain(source, q).then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  await yielded(service);
  f.store.executeAtlasCommit({
    campaignId: f.campaign.id,
    token: f.token,
    commandId: randomUUID(),
    action: {
      kind: 'landscape-height-stroke',
      stroke: {
        mode: 'raise',
        radius: 8,
        strength: 100,
        feather: 0,
        samples: [
          { x: 0, y: 0, t: 0 },
          { x: 0, y: 0, t: 1000 },
        ],
      },
    },
  });
  assert.match(String((await outcome).error), /inzwischen geändert/);
  const current = f.store.atlasRegionSource(f.token, service.cursor),
    query = {
      ...q,
      revision: current.revision,
      width: 128,
      height: 128,
      detail: undefined,
      detailResolution: undefined,
    },
    actual = await service.terrain(current, query);
  const cold = new AtlasRegionService(
    new URL('../../.build/terrain-service-worker.cjs', import.meta.url).pathname,
  );
  try {
    assert.deepEqual(actual, await cold.terrain(f.store.atlasRegionSource(f.token), query));
  } finally {
    await cold.close();
  }
});

test('live refinement yields to selection and fast author feedback; complete refinement agrees with a cold frame', async (t) => {
  const f = await slicedFixture(t),
    { service, q } = f;
  f.store.executeAtlasCommit({
    campaignId: f.campaign.id,
    token: f.token,
    commandId: randomUUID(),
    action: {
      kind: 'landscape-height-stroke',
      stroke: {
        mode: 'raise',
        radius: 180,
        strength: 500,
        feather: 1,
        samples: [
          { x: 0, y: 0, t: 0 },
          { x: 0, y: 0, t: 1000 },
        ],
      },
    },
  });
  const source = f.store.atlasRegionSource(f.token);
  q.revision = source.revision;
  const outcome = service.liveTerrain(source, { kind: 'tilted', query: q }, undefined, true).then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  await yielded(service);
  assert.equal((await service.candidates(source, f.region, { x: 0, y: 0 })).total, 0);
  const fastQuery = {
    kind: 'tilted',
    query: { ...q, width: 64, height: 64, detailResolution: 64 },
  };
  const fast = service.liveTerrain(source, fastQuery);
  assert.match(String((await outcome).error), /neuere Anfrage/);
  const first = await fast;
  assert.equal(first.projection.width, 64);
  assert.equal(first.projection.grid.view.columns, q.view.columns);
  assert(first.projection.grid.heights.some((v) => v > 0));
  const query = { kind: 'tilted', query: { ...q, width: 128, height: 128, detailResolution: 128 } };
  const detail = await service.liveTerrain(source, query, undefined, true);
  assert.equal(detail.target.revision, first.target.revision);
  assert.equal(detail.projection.width, 128);
  assert.deepEqual(
    detail.projection.grid,
    first.projection.grid,
    'full-resolution heights are already present in the fast frame',
  );
  const cold = new AtlasRegionService(
    new URL('../../.build/terrain-service-worker.cjs', import.meta.url).pathname,
  );
  try {
    const expected = await cold.liveTerrain(f.store.atlasRegionSource(f.token), query);
    assert.deepEqual(detail.projection, expected.projection);
  } finally {
    await cold.close();
  }
  assert.equal(service.diagnostics.workerStarts, 1);
});

test(
  'selection runs inside unfinished height-grid construction and the resumed projection equals a cold worker',
  { timeout: 15000 },
  async (t) => {
    const previous = process.env.SALTMARCHER_TERRAIN_TRACE;
    process.env.SALTMARCHER_TERRAIN_TRACE = '1';
    t.after(() => {
      if (previous === undefined) delete process.env.SALTMARCHER_TERRAIN_TRACE;
      else process.env.SALTMARCHER_TERRAIN_TRACE = previous;
    });
    const f = await slicedFixture(t),
      { service, store, token, campaign } = f;
    store.executeAtlasCommit({
      campaignId: campaign.id,
      token,
      commandId: randomUUID(),
      action: {
        kind: 'landscape-height-stroke',
        stroke: {
          mode: 'raise',
          radius: 180,
          strength: 500,
          feather: 1,
          samples: [
            { x: 0, y: 0, t: 0 },
            { x: 0, y: 0, t: 1000 },
          ],
        },
      },
    });
    const source = store.atlasRegionSource(token),
      box = { x: -180, y: -180, width: 360, height: 360 },
      q = {
        ...f.q,
        revision: source.revision,
        fence: source.fence,
        view: { ...f.q.view, box, frame: box, columns: 257, rows: 257 },
        width: 16,
        height: 16,
        detail: undefined,
        detailResolution: undefined,
      };
    // Start and synchronize the worker first, with a different tiny lattice.
    await service.terrain(source, { ...q, view: { ...q.view, columns: 9, rows: 9 } });
    let done = false,
      selected;
    const firstSlice = new Promise((resolve, reject) => {
      const observe = (reply) => {
        try {
          if (!reply?.value?.terrainProjectionContinuation) return;
          service.worker.off('message', observe);
          assert(reply.terrainTrace);
          assert(
            !reply.terrainTrace.events.some((e) => e.stage === 'projection.grid'),
            'selection must enter before the grid has completed, not during later colour work',
          );
          selected = service.candidates(source, f.region, { x: 0, y: 0 }).then((value) => {
            assert.equal(done, false);
            return value;
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      service.worker.on('message', observe);
    });
    const projected = service.terrain(source, q).then((value) => {
      done = true;
      return value;
    });
    await firstSlice;
    await selected;
    const actual = await projected;
    const cold = new AtlasRegionService(
      new URL('../../.build/terrain-service-worker.cjs', import.meta.url).pathname,
    );
    try {
      assert.deepEqual(actual, await cold.terrain(store.atlasRegionSource(token), q));
    } finally {
      await cold.close();
    }
    assert.equal(service.diagnostics.workerStarts, 1);
  },
);

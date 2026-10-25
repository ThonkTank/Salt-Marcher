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
      "export * from './src/app/storage/store';export * from './src/app/storage/atlas-landscape-region';export * from './src/app/storage/atlas-region';export * from './src/app/storage/terrain-grid';export * from './src/app/storage/terrain-projection';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/landscape-raster';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-projection-cache-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  AtlasLandscapeReader,
  AtlasRegionReader,
  heightRecord,
  LandscapeRasterizer,
  readTerrainGrid,
  readTerrainProjection,
} = require('../../.build/terrain-projection-cache-test.cjs');
test('height and shading caches reuse unaffected areas; warm edits match cold/full projections and invalidate deleted heights', (t) => {
  const base = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/projection-cache-');
  const store = new CampaignStore(dir + '/world.sqlite'),
    campaign = store.create('Cache'),
    token = store.activateShell(campaign.id).token;
  const write = (action) =>
    store.executeAtlasCommit({ commandId: randomUUID(), campaignId: campaign.id, token, action });
  write({
    kind: 'landscape-put',
    expectedRevision: null,
    record: heightRecord(0, 0, 16, new Float32Array(4096).fill(100)),
  });
  const db = new (require('better-sqlite3'))(store.filename, { readonly: true }),
    reader = new AtlasLandscapeReader(db),
    finish = LandscapeRasterizer.prototype.finish;
  let rasterizations = 0,
    rasterPixels = 0,
    cursor;
  LandscapeRasterizer.prototype.finish = function (...args) {
    rasterizations++;
    rasterPixels += this.width * this.height;
    return finish.apply(this, args);
  };
  t.after(() => {
    LandscapeRasterizer.prototype.finish = finish;
    db.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const box = { x: 0, y: 0, width: 1024, height: 1024 },
    view = {
      box,
      frame: box,
      columns: 193,
      rows: 193,
      focusM: 0,
      tilt: 45,
      rotation: 0,
      exaggeration: 2,
    };
  const read = () => {
    cursor = store.atlasRegionSource(token, cursor);
    reader.sync(cursor);
    return reader.terrain(cursor, {
      view,
      width: 512,
      height: 512,
      contours: 0,
      displayMpp: 2,
      revision: cursor.revision,
      fence: cursor.fence,
    });
  };
  const memoryBefore = process.memoryUsage();
  const original = read(),
    cold = rasterizations,
    coldPixels = rasterPixels;
  assert.equal(cold, 1);
  assert.equal(coldPixels, 512 * 512);
  const warm = read();
  assert.equal(rasterizations, cold);
  assert.equal(Buffer.compare(warm.pixels, original.pixels), 0);
  write({
    kind: 'landscape-height-stroke',
    stroke: {
      mode: 'raise',
      radius: 8,
      strength: 60,
      feather: 0.8,
      samples: [
        { x: 200, y: 200, t: 0 },
        { x: 200, y: 200, t: 1000 },
      ],
    },
  });
  const changed = read(),
    partial = rasterPixels - coldPixels;
  assert(partial > 0 && partial < coldPixels, JSON.stringify({ partial, coldPixels }));
  assert.notEqual(Buffer.compare(changed.pixels, original.pixels), 0);
  const authoritative = readTerrainGrid(db, campaign.id, view);
  assert.equal(
    Buffer.compare(
      Buffer.from(changed.grid.heights.buffer),
      Buffer.from(authoritative.heights.buffer),
    ),
    0,
  );
  const detailed = reader.terrain(cursor, {
    view,
    detail: { x: 160, y: 160, width: 80, height: 80 },
    width: 128,
    height: 128,
    contours: 0,
    displayMpp: 8,
    revision: cursor.revision,
    fence: cursor.fence,
  });
  assert.equal(detailed.detail.pixels.length, 256 * 256 * 4);
  const q = {
    view,
    width: 512,
    height: 512,
    contours: 0,
    displayMpp: 2,
    revision: cursor.revision,
    fence: cursor.fence,
  };
  const stream = (kind, box) =>
    kind === 'line' ? reader.lines(cursor, box) : reader.rows(cursor, box, true, 0, 0, kind);
  const fullDetail = readTerrainProjection(
    db,
    cursor,
    { ...q, width: 128, height: 128, displayMpp: 8, detail: detailed.detail.box },
    stream,
  );
  assert.equal(
    Buffer.compare(detailed.detail.pixels, fullDetail.detail.pixels),
    0,
    'fine patch tile halos match cold raster',
  );
  const focusQuery = {
    ...q,
    width: 128,
    height: 128,
    detail: { x: 100, y: 120, width: 240, height: 120 },
    detailResolution: 512,
  };
  const focus = reader.terrain(cursor, focusQuery),
    fullFocus = readTerrainProjection(db, cursor, focusQuery, stream);
  assert.equal(focus.detail.width, 512);
  assert.equal(focus.detail.height, 256);
  assert.deepEqual(
    focus.detail.pixels,
    fullFocus.detail.pixels,
    'viewport detail preserves its aspect and exact cached tile halos',
  );
  const full = readTerrainProjection(db, cursor, q, stream);
  assert.equal(
    Buffer.compare(changed.pixels, full.pixels),
    0,
    'tile borders and shading halos match the complete raster',
  );
  reader.projectionCache.invalidate([], true);
  const rebuilt = reader.terrain(cursor, q);
  assert.equal(Buffer.compare(changed.pixels, rebuilt.pixels), 0);
  assert.deepEqual(changed.grid, rebuilt.grid);
  write({ kind: 'undo' });
  const undone = read();
  assert.equal(Buffer.compare(undone.pixels, original.pixels), 0);
  const large = reader.terrain(cursor, {
    ...q,
    revision: cursor.revision,
    fence: cursor.fence,
    width: 1024,
    height: 1024,
  });
  assert.equal(large.pixels.length, 1024 * 1024 * 4);
  const memoryAfter = process.memoryUsage(),
    cache = reader.projectionCache.tiles;
  assert(cache.bytes <= 24 * 1024 * 1024);
  assert(cache.hits > 0);
  assert(
    cache.bytes < 8 * 1024 * 1024,
    'raster scratch fields must not evict reusable finished tiles',
  );
  t.diagnostic(
    JSON.stringify({
      measurement:
        'process includes store, test and scratch allocations; cache bytes are accounted separately',
      memoryBefore,
      memoryAfter,
      peakRssKiB: process.resourceUsage().maxRSS,
      cache: {
        bytes: cache.bytes,
        limit: cache.limit,
        hits: cache.hits,
        misses: cache.misses,
        evictions: cache.evictions,
      },
      coldRasterTiles: cold,
      editedRasterTiles: partial,
    }),
  );
});
test('a small authored change missed by the overview lattice changes the active detail raster', (t) => {
  const base = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/projection-detail-');
  const store = new CampaignStore(dir + '/world.sqlite'),
    campaign = store.create('Detail'),
    token = store.activateShell(campaign.id).token;
  const write = (action) =>
    store.executeAtlasCommit({ commandId: randomUUID(), campaignId: campaign.id, token, action });
  write({
    kind: 'landscape-put',
    expectedRevision: null,
    record: heightRecord(0, 0, 128, new Float32Array(4096).fill(100)),
  });
  const db = new (require('better-sqlite3'))(store.filename, { readonly: true }),
    reader = new AtlasLandscapeReader(db);
  t.after(() => {
    db.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const box = { x: 0, y: 0, width: 65536, height: 65536 },
    view = {
      box,
      frame: box,
      columns: 193,
      rows: 193,
      focusM: 0,
      tilt: 45,
      rotation: 0,
      exaggeration: 2,
    };
  let cursor;
  const read = () => {
    cursor = store.atlasRegionSource(token, cursor);
    reader.sync(cursor);
    return reader.terrain(cursor, {
      view,
      detail: { x: 168, y: 168, width: 64, height: 64 },
      width: 128,
      height: 128,
      contours: 0,
      displayMpp: 512,
      revision: cursor.revision,
      fence: cursor.fence,
    });
  };
  const original = read();
  write({
    kind: 'landscape-height-stroke',
    stroke: {
      mode: 'raise',
      radius: 8,
      strength: 60,
      feather: 0.8,
      samples: [
        { x: 200, y: 200, t: 0 },
        { x: 200, y: 200, t: 1000 },
      ],
    },
  });
  const changed = read();
  assert.deepEqual(
    changed.grid.heights,
    original.grid.heights,
    'tiny brush falls between overview vertices',
  );
  assert.deepEqual(changed.pixels, original.pixels, 'coarse image really misses this edit');
  assert.notEqual(
    Buffer.compare(changed.detail.pixels, original.detail.pixels),
    0,
    'actual terrain pixels, not cursor or revision changes, must change',
  );
  const full = readTerrainProjection(
    db,
    cursor,
    {
      view,
      detail: changed.detail.box,
      width: 128,
      height: 128,
      contours: 0,
      displayMpp: 512,
      revision: cursor.revision,
      fence: cursor.fence,
    },
    (kind, b) =>
      kind === 'line' ? reader.lines(cursor, b) : reader.rows(cursor, b, true, 0, 0, kind),
  );
  assert.deepEqual(changed.detail.pixels, full.detail.pixels);
});
test('small raster pieces match full shading at fractional origins, odd output sizes and contour seams', (t) => {
  const base = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/projection-fractional-');
  const store = new CampaignStore(dir + '/world.sqlite'),
    campaign = store.create('Fractional'),
    token = store.activateShell(campaign.id).token;
  const write = (action) =>
    store.executeAtlasCommit({ commandId: randomUUID(), campaignId: campaign.id, token, action });
  const records = [];
  for (let y = -2; y < 2; y++)
    for (let x = -2; x < 2; x++)
      records.push({
        expectedRevision: null,
        record: heightRecord(
          x * 64,
          y * 64,
          1,
          Float32Array.from(
            { length: 4096 },
            (_, i) =>
              80 +
              30 * Math.sin((x * 64 + (i % 64)) / 23) +
              40 * Math.cos((y * 64 + Math.floor(i / 64)) / 19),
          ),
        ),
      });
  write({ kind: 'landscape-batch', records });
  const db = new (require('better-sqlite3'))(store.filename, { readonly: true }),
    reader = new AtlasLandscapeReader(db);
  t.after(() => {
    db.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const box = { x: -100.125, y: -84.25, width: 200.3, height: 180.7 },
    view = {
      box,
      frame: box,
      columns: 193,
      rows: 193,
      focusM: 80,
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
      width: 257,
      height: 193,
      contours: 10,
      displayMpp: box.width / 257,
      revision: source.revision,
      fence: source.fence,
    };
    const cached = reader.terrain(source, q),
      full = readTerrainProjection(db, source, q, (kind, b) =>
        kind === 'line' ? reader.lines(source, b) : reader.rows(source, b, true, 0, 0, kind),
      );
    assert.deepEqual(cached.pixels, full.pixels);
    assert.deepEqual(cached.grid.heights, full.grid.heights);
    return cached;
  };
  const initial = read();
  write({
    kind: 'landscape-height-stroke',
    stroke: {
      mode: 'raise',
      radius: 8,
      strength: 60,
      feather: 0.8,
      samples: [
        { x: -75, y: -60, t: 0 },
        { x: -75, y: -60, t: 1000 },
      ],
    },
  });
  assert.notDeepEqual(read().pixels, initial.pixels);
  write({ kind: 'undo' });
  assert.deepEqual(read().pixels, initial.pixels);
});

test('live 64-pixel colour fields match uncached sculpt, Undo and Redo including fractional raster halos', (t) => {
  const base = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/live-colour-field-');
  const store = new CampaignStore(dir + '/world.sqlite'),
    campaign = store.create('Live field'),
    token = store.activateShell(campaign.id).token;
  const write = (action) =>
    store.executeAtlasCommit({ commandId: randomUUID(), campaignId: campaign.id, token, action });
  write({
    kind: 'landscape-put',
    expectedRevision: null,
    record: heightRecord(
      0,
      0,
      16,
      Float32Array.from({ length: 4096 }, (_, i) => 30 * Math.sin((i % 64) / 5)),
    ),
  });
  const db = new (require('better-sqlite3'))(store.filename, { readonly: true }),
    reader = new AtlasLandscapeReader(db);
  t.after(() => {
    db.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const box = { x: -20.125, y: -10.25, width: 1060.3, height: 1040.7 },
    view = {
      box,
      frame: box,
      columns: 193,
      rows: 193,
      focusM: 0,
      tilt: 35,
      rotation: 25,
      exaggeration: 1,
    };
  let source;
  const read = () => {
    source = store.atlasRegionSource(token, source);
    reader.sync(source);
    const q = {
      view,
      width: 64,
      height: 63,
      contours: 10,
      displayMpp: box.width / 64,
      revision: source.revision,
      fence: source.fence,
    };
    const steps = reader.terrainSteps(source, q);
    let step;
    do {
      step = steps.next();
    } while (!step.done);
    const cached = step.value;
    const stream = (kind, b, samples) =>
      kind === 'line'
        ? reader.lines(source, b)
        : reader.rows(
            source,
            b,
            true,
            samples ? { width: samples.columns / 2, height: samples.rows / 2 } : 0,
            0,
            kind,
          );
    const full = readTerrainProjection(db, source, q, stream);
    assert.deepEqual(cached.pixels, full.pixels);
    assert.deepEqual(cached.grid, full.grid);
    assert(reader.projectionCache.tiles.bytes <= reader.projectionCache.tiles.limit);
    return cached;
  };
  const original = read();
  write({
    kind: 'landscape-height-stroke',
    stroke: {
      mode: 'raise',
      radius: 40,
      strength: 120,
      feather: 0.8,
      samples: [
        { x: 490, y: 490, t: 0 },
        { x: 490, y: 490, t: 1000 },
      ],
    },
  });
  const changed = read();
  assert.notDeepEqual(changed.pixels, original.pixels);
  write({ kind: 'undo' });
  assert.deepEqual(read().pixels, original.pixels);
  write({ kind: 'redo' });
  assert.deepEqual(read().pixels, changed.pixels);
});

test('live refinement retains numerical fields but normal navigation hands their capacity back', async (t) => {
  const base = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/live-field-handoff-');
  const store = new CampaignStore(dir + '/world.sqlite'),
    campaign = store.create('Field handoff'),
    token = store.activateShell(campaign.id).token;
  const db = new (require('better-sqlite3'))(store.filename, { readonly: true }),
    reader = new AtlasRegionReader(db);
  t.after(() => {
    db.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const source = store.atlasRegionSource(token);
  await reader.sync(source, false);
  const box = { x: -100, y: -100, width: 200, height: 200 },
    view = {
      box,
      frame: box,
      columns: 33,
      rows: 33,
      focusM: 0,
      tilt: 0,
      rotation: 0,
      exaggeration: 1,
    },
    q = {
      view,
      width: 64,
      height: 64,
      contours: 0,
      displayMpp: 2,
      revision: source.revision,
      fence: source.fence,
    };
  const drain = (g) => {
    for (;;) {
      const step = g.next();
      if (step.done) return step.value;
    }
  };
  const live = () => reader.liveTerrain(source, { kind: 'tilted', query: q }),
    cache = reader.landscape.projectionCache.tiles;
  live();
  assert(cache.retainedBytes > 0);
  reader.liveTerrain(source, { kind: 'tilted', query: { ...q, width: 128, height: 128 } });
  assert(cache.retainedBytes > 0, 'fine live replies do not evict the next coarse prefix');
  for (const mode of ['projection', 'steps', 'colour']) {
    cache.invalidate([box]);
    live();
    assert(cache.retainedBytes > 0);
    if (mode === 'projection') reader.terrain(source, { ...q, width: 128, height: 128 });
    else if (mode === 'steps')
      drain(reader.terrainSteps(source, { ...q, width: 128, height: 128 }));
    else
      drain(
        reader.colorSteps(source, {
          box,
          width: 64,
          height: 64,
          contours: 0,
          displayMpp: 2,
          revision: source.revision,
          fence: source.fence,
          routeContext: box,
        }),
      );
    assert.equal(
      cache.retainedBytes,
      0,
      mode + ' returns the live-field capacity to ordinary navigation',
    );
  }
});

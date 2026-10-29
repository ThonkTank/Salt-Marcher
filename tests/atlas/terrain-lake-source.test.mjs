import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { seedDenseLakeTerrain } from '../helpers/terrain-lake-dense.mjs';
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents: `export * from './src/app/storage/store';export * from './src/app/storage/atlas-landscape';export * from './src/app/atlas/terrain-brush';export * from './src/app/storage/terrain-editing-source';export * from './src/app/storage/terrain-editing-dependencies';export * from './src/app/storage/terrain-route';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/terrain-lake-brush';export * from './src/app/atlas/terrain-route';export * from './src/app/atlas/terrain-route-planner';export * from './src/app/atlas/landscape-line';export * from './desktop/atlas-region';export * from './src/app/atlas/atlas-terrain-editing-source';export * from './src/app/storage/terrain-grid';`,
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-lake-source-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['desktop/atlas-region-worker.ts'],
  outfile: '.build/terrain-lake-source-worker.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const api = require('../../.build/terrain-lake-source-test.cjs');
const clean = (rs) =>
  rs.map(({ revision, order, ...r }) => r).sort((a, b) => a.id.localeCompare(b.id));
async function fixture(t, density = 1) {
  const dir = mkdtempSync('/tmp/lake-source-'),
    store = new api.CampaignStore(dir + '/world.sqlite'),
    cam = store.create('Dense lakes'),
    token = store.activateShell(cam.id).token,
    service = new api.AtlasRegionService(path.resolve('.build/terrain-lake-source-worker.cjs'));
  t.after(async () => {
    await service.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const command = (action) => ({ token, campaignId: cam.id, commandId: randomUUID(), action });
  const write = (action) => store.executeAtlasCommit(command(action));
  for (const y of [-512, 0])
    for (const x of [-512, 0])
      write({
        kind: 'landscape-put',
        expectedRevision: null,
        record: api.heightRecord(
          x,
          y,
          8,
          Float32Array.from({ length: 4096 }, (_, i) => 30 - 0.005 * (x + (i % 64) * 8)),
        ),
      });
  const terrain = seedDenseLakeTerrain(api, store.db, cam.id, density);
  const rows = () =>
    store.db
      .prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? ORDER BY id')
      .all(cam.id)
      .map((r) => JSON.parse(r.payload));
  const cursor = () =>
    store.db.prepare('SELECT cursor FROM campaign_atlas WHERE campaign_id=?').get(cam.id).cursor;
  const prepare = async (s) => {
    const c = command({ kind: 'landscape-lake-stroke', stroke: s });
    const source = store.terrainStrokeSource(c, service.cursor);
    return { c, patch: await service.prepareTerrainStroke(source, s) };
  };
  return { dir, store, cam, token, service, command, write, terrain, rows, cursor, prepare };
}
const stroke = (extra = {}) => ({
  id: 'dense-dig',
  mode: 'dig',
  radius: 160,
  strength: 2,
  feather: 0.8,
  waterLevelM: 30,
  samples: [
    { x: 0, y: 0, t: 0 },
    { x: 0, y: 0, t: 2000 },
  ],
  ...extra,
});
const box = { x: -176, y: -176, width: 352, height: 352 };
test('dense local UTF8 source above 16MiB passes the actual Store/worker as one lake and undo restores the source', async (t) => {
  const f = await fixture(t, Number(process.env.DENSE_LAKE_DENSITY ?? 1));
  assert(f.terrain.bytes > 16 * 1024 * 1024);
  const before = clean(f.rows()),
    at = f.cursor();
  assert.throws(() => api.readRouteTerrain(f.store.db, f.cam.id, box), /Planungsbereich zu groß/);
  assert.deepEqual(clean(f.rows()), before);
  assert.equal(f.cursor(), at);
  const plan = api.terrainEditingSourcePlan(f.store.db, f.cam.id, box);
  let pages = 0,
    after = '',
    bytes = 0,
    count = 0;
  for (;;) {
    const p = api.readTerrainEditingPage(f.store.db, f.cam.id, box, after, undefined, {}, plan);
    pages++;
    for (const r of p.records) {
      bytes += Buffer.byteLength(JSON.stringify(r));
      count++;
    }
    if (p.complete) break;
    after = p.next;
  }
  const started = performance.now(),
    { c, patch } = await f.prepare(stroke());
  assert(patch.records.some((r) => r.id === 'dense-dig' && r.lakeBed?.length));
  assert.equal(f.cursor(), at);
  f.store.executeAtlasCommit(c, patch);
  assert.equal(f.cursor(), at + 1);
  assert(
    f.store.atlasHeight(f.token, { x: 0, y: 0 }).heightM <
      new api.TerrainSampler(before).sample({ x: 0, y: 0 }).heightM - 3.9,
  );
  const saved = clean(f.rows());
  f.store.executeAtlasCommit(c);
  assert.deepEqual(clean(f.rows()), saved);
  assert.equal(f.cursor(), at + 1);
  f.write({ kind: 'undo' });
  assert.deepEqual(clean(f.rows()), before);
  assert.equal(f.cursor(), at);
  const repeated = [];
  for (let i = 0; i < 4; i++) {
    const q = await f.prepare(stroke({ id: 'repeat-' + i }));
    f.store.executeAtlasCommit(q.c, q.patch);
    f.write({ kind: 'undo' });
    if (global.gc) global.gc();
    repeated.push(process.memoryUsage());
  }
  const report = {
    ...f.terrain,
    pages,
    bytes,
    count,
    elapsedMs: performance.now() - started,
    memory: process.memoryUsage(),
    gcAvailable: Boolean(global.gc),
    repeated,
    checks: [
      'old reader rejects without mutation',
      'worker lake excavation and water',
      'one history step',
      'receipt does not replay',
      'undo restores source',
    ],
  };
  mkdirSync('.build/cycle3-point2', { recursive: true });
  writeFileSync(
    '.build/cycle3-point2/density-' + f.terrain.density + '.json',
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
});
test('the same dense source keeps live/writer dose, scatter, partial/full erasure, independent terrain, Undo/Redo and Fresh exact', async (t) => {
  const f = await fixture(t),
    baseline = clean(f.rows()),
    at = f.cursor();
  const run = async (s) => {
    const source = api.readTerrainEditingPackets(f.store.db, f.cam.id, box),
      expected = clean(api.mergeLakeBrush(f.rows(), api.applyLakeBrush(source, s))),
      old = f.cursor();
    const { c, patch } = await f.prepare(s);
    f.store.executeAtlasCommit(c, patch);
    assert.equal(f.cursor(), old + 1);
    assert.deepEqual(clean(f.rows()), expected);
    return patch;
  };
  const one = api.applyLakeBrush(
      baseline,
      stroke({
        samples: [
          { x: 0, y: 0, t: 0 },
          { x: 0, y: 0, t: 1000 },
        ],
      }),
    ),
    two = api.applyLakeBrush(baseline, stroke());
  for (const r of one.records.filter((r) => r.height)) {
    const a = api.decodeHeights(r.height),
      b = api.decodeHeights(two.records.find((v) => v.id === r.id).height);
    for (let i = 0; i < a.length; i++)
      if (Number.isFinite(a[i])) assert(Math.abs(b[i] - 2 * a[i]) < 1e-5);
  }
  await run(stroke());
  const dug = clean(f.rows());
  f.write({ kind: 'undo' });
  assert.deepEqual(clean(f.rows()), baseline);
  f.write({ kind: 'redo' });
  assert.deepEqual(clean(f.rows()), dug);
  await run(stroke({ id: 'partial', mode: 'erase', radius: 32 }));
  assert(f.rows().some((r) => r.lakeBed?.length));
  await run(stroke({ id: 'full', mode: 'erase', radius: 240 }));
  assert.deepEqual(clean(f.rows()), baseline);
  await run(
    stroke({
      id: 'dense-scatter',
      mode: 'scatter',
      radius: 100,
      noise: 0.5,
      seed: 123456,
      waterLevelM: null,
      samples: [
        { x: -30, y: -10, t: 0 },
        { x: 30, y: 10, t: 1200 },
      ],
    }),
  );
  assert(f.rows().filter((r) => r.lakeBed).length > 1);
  await run(stroke({ id: 'clear-scatter', mode: 'erase', radius: 240 }));
  assert.deepEqual(clean(f.rows()), baseline);
  await run(stroke({ id: 'independent-dig' }));
  const terrain = {
    mode: 'raise',
    radius: 160,
    strength: 3,
    feather: 0.8,
    samples: [
      { x: 0, y: 0, t: 0 },
      { x: 0, y: 0, t: 1000 },
    ],
  };
  f.write({ kind: 'landscape-height-stroke', stroke: terrain });
  await run(stroke({ id: 'independent-erase', mode: 'erase', radius: 240 }));
  const expected = clean(
    api.mergeLakeBrush(baseline, { records: api.applyTerrainBrush(baseline, terrain), remove: [] }),
  );
  const actual = clean(f.rows());
  assert.deepEqual(
    actual.map((r) => r.id),
    expected.map((r) => r.id),
  );
  let maxIndependentError = 0;
  for (let j = 0; j < actual.length; j++) {
    const a = actual[j],
      e = expected[j];
    if (a.height) {
      const av = api.decodeHeights(a.height),
        ev = api.decodeHeights(e.height);
      for (let i = 0; i < av.length; i++) {
        assert.equal(Number.isNaN(av[i]), Number.isNaN(ev[i]));
        if (Number.isFinite(av[i]))
          maxIndependentError = Math.max(maxIndependentError, Math.abs(av[i] - ev[i]));
      }
    } else assert.deepEqual(a, e);
  }
  assert(
    maxIndependentError < 1e-6,
    'Only Float32 additive/subtractive roundoff: ' + maxIndependentError,
  );
  const saved = clean(f.rows()),
    savedCursor = f.cursor();
  f.write({ kind: 'undo' });
  f.write({ kind: 'redo' });
  assert.deepEqual(clean(f.rows()), saved);
  const fresh = new api.CampaignStore(f.dir + '/world.sqlite');
  try {
    const token = fresh.activateShell(f.cam.id).token;
    assert.equal(
      fresh.atlasRegionSource(token).revision,
      f.store.atlasRegionSource(f.token).revision,
    );
    assert.deepEqual(
      clean(
        fresh.db
          .prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? ORDER BY id')
          .all(f.cam.id)
          .map((r) => JSON.parse(r.payload)),
      ),
      saved,
    );
  } finally {
    fresh.close();
  }
  assert.equal(f.cursor(), savedCursor);
  assert(f.cursor() > at);
});
test('lake ownership resolves explicit off-camera tiles and every shared owner, then rejects missing owners without any write', async (t) => {
  const f = await fixture(t, 0),
    tile = api.heightRecord(1024, 0, 1, new Float32Array(4096).fill(-1), 2);
  f.write({ kind: 'landscape-put', record: tile, expectedRevision: null });
  const lake = (id, x) => ({
    id,
    revision: 0,
    kind: 'patch',
    name: id,
    points: [],
    polygons: [
      {
        outer: [
          { x, y: 0 },
          { x: x + 10, y: 0 },
          { x: x + 10, y: 10 },
          { x, y: 10 },
        ],
        holes: [],
      },
    ],
    width: 0,
    resolution: 1,
    values: {},
    surface: 'freshwater',
    waterLevelM: 30,
    lakeBed: [{ tileId: tile.id, tile: { ...tile.height } }],
  });
  for (const r of [lake('owner-near', 0), lake('owner-remote', 600)])
    f.write({ kind: 'landscape-put', record: r, expectedRevision: null });
  const source = api.readTerrainEditingPackets(f.store.db, f.cam.id, {
    x: 0,
    y: 0,
    width: 5,
    height: 5,
  });
  for (const id of [tile.id, 'owner-near', 'owner-remote'])
    assert(
      source.some((r) => r.id === id),
      id,
    );
  f.store.db
    .prepare('DELETE FROM atlas_landscape WHERE campaign_id=? AND id=?')
    .run(f.cam.id, tile.id);
  const before = clean(f.rows()),
    at = f.cursor();
  await assert.rejects(f.prepare(stroke()), /Zugeordnete Seehöhe fehlt/);
  assert.deepEqual(clean(f.rows()), before);
  assert.equal(f.cursor(), at);
});
test('separate connected route corridors include their distant support and exclude the unedited rectangle between them', async (t) => {
  const f = await fixture(t, 0);
  for (const x of [512])
    for (const y of [-512, 0])
      f.write({
        kind: 'landscape-put',
        record: api.heightRecord(x, y, 8, new Float32Array(4096).fill(20)),
        expectedRevision: null,
      });
  const marker = api.heightRecord(512, 0, 1, new Float32Array(4096).fill(0.1), 2);
  f.write({ kind: 'landscape-put', record: marker, expectedRevision: null });
  for (const y of [-200, 200]) {
    const points = [
        { x: 0, y },
        { x: 900, y },
      ],
      r = {
        id: 'corridor-' + y,
        revision: 0,
        kind: 'road',
        name: 'Road',
        points,
        polygons: [],
        resolution: 2,
        width: 4,
        values: {},
        line: api.newLine('road'),
        route: api.routeSpec('road', points),
      };
    r.route.limits.corridor = 2;
    r.route.limits.shoulder = 2;
    r.route.limits.cut = 100;
    r.route.limits.fill = 100;
    r.route.limits.grade = 1;
    const planned = api.planRoute(f.rows(), r);
    api.putLandscape(f.store.db, f.cam.id, planned, null);
  }
  const gap = seedDenseLakeTerrain(api, f.store.db, f.cam.id, 1, { x: 512, y: 0 });
  assert(gap.bytes > 16 * 1024 * 1024);
  const b = { x: -220, y: -220, width: 440, height: 440 },
    plan = api.terrainEditingSourcePlan(f.store.db, f.cam.id, b),
    records = api.readTerrainEditingPackets(f.store.db, f.cam.id, b);
  assert.equal(plan.corridors.length, 2);
  assert(!records.some((r) => r.id === marker.id));
  assert(records.some((r) => r.height?.x === 512 && r.height.pixel === 8));
  assert(
    !records.some((r) => r.height?.pixel === 0.125),
    'Unedited dense gap never enters the author packets',
  );
  assert.throws(() => api.readRouteTerrain(f.store.db, f.cam.id, b), /Planungsbereich zu groß/);
  mkdirSync('.build/cycle3-point2', { recursive: true });
  writeFileSync(
    '.build/cycle3-point2/separate-corridors.json',
    JSON.stringify(
      { excludedGap: gap, selectedRecords: records.length, corridors: plan.corridors },
      null,
      2,
    ),
  );
});
test('dense protected river, stale worker result and injected transaction failure leave every author and history step intact', async (t) => {
  const f = await fixture(t),
    points = [
      { x: -100, y: 0 },
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    r = {
      id: 'dense-protected',
      revision: 0,
      kind: 'river',
      name: 'River',
      points,
      polygons: [],
      resolution: 2,
      width: 8,
      values: {},
      line: api.newLine('river'),
      route: api.routeSpec('river', points),
    };
  f.write({
    kind: 'landscape-lake-stroke',
    stroke: stroke({
      id: 'preexisting-owned-lake',
      radius: 20,
      samples: [
        { x: 70, y: 80, t: 0 },
        { x: 70, y: 80, t: 1000 },
      ],
    }),
  });
  assert(f.rows().some((r) => r.id === 'preexisting-owned-lake' && r.lakeBed?.length));
  r.route.limits.corridor = 1;
  r.route.limits.cut = 2;
  const planned = api.planRoute(f.rows(), r);
  api.putLandscape(f.store.db, f.cam.id, planned, null);
  const before = clean(f.rows()),
    at = f.cursor();
  await assert.rejects(
    f.prepare(stroke({ strength: 200 })),
    /geschützten|Abfluss|Eingriffsgrenzen|Verlauf/,
  );
  assert.deepEqual(clean(f.rows()), before);
  assert.equal(f.cursor(), at);
  // A separate safe place exercises prepared-result fences and transaction rollback.
  const s = stroke({
      id: 'safe',
      radius: 32,
      samples: [
        { x: 0, y: 80, t: 0 },
        { x: 0, y: 80, t: 1000 },
      ],
    }),
    { c, patch } = await f.prepare(s);
  f.write({ kind: 'landscape-sea-level', seaLevelM: -10 });
  const updated = clean(f.rows()),
    cur = f.cursor();
  assert.throws(() => f.store.executeAtlasCommit(c, patch), /inzwischen/);
  assert.deepEqual(clean(f.rows()), updated);
  assert.equal(f.cursor(), cur);
  const next = await f.prepare({ ...s, id: 'injected' });
  f.store.db.exec(
    "CREATE TEMP TRIGGER fail_lake_source BEFORE INSERT ON atlas_landscape WHEN json_extract(NEW.payload,'$.surface')='freshwater' BEGIN SELECT RAISE(ABORT,'injected lake write failure'); END",
  );
  assert.throws(
    () => f.store.executeAtlasCommit(next.c, next.patch),
    /injected lake write failure/,
  );
  assert.deepEqual(clean(f.rows()), updated);
  assert.equal(f.cursor(), cur);
  f.store.db.exec('DROP TRIGGER fail_lake_source');
});
test('reachable legacy freshwater commands use the same complete dense source and one history step', async (t) => {
  const f = await fixture(t),
    before = clean(f.rows()),
    at = f.cursor(),
    s = stroke(),
    record = { id: 'legacy-dense', waterLevelM: 30 };
  f.write({
    kind: 'landscape-brush',
    mode: 'freshwater',
    radius: s.radius,
    roughness: 0,
    seed: 0,
    fill: false,
    samples: s.samples,
    record,
  });
  assert.equal(f.cursor(), at + 1);
  assert(f.rows().some((r) => r.id === record.id && r.lakeBed?.length));
  f.write({
    kind: 'landscape-brush',
    mode: 'freshwater-erase',
    radius: 240,
    roughness: 0,
    seed: 0,
    fill: false,
    samples: s.samples,
    record: { id: 'legacy-erase', waterLevelM: 30 },
  });
  assert.equal(f.cursor(), at + 2);
  assert.deepEqual(clean(f.rows()), before);
  f.write({ kind: 'undo' });
  assert(f.rows().some((r) => r.lakeBed?.length));
});

test('screen-owned lake dig, scatter and erase share the canonical plan and one reversible history step', async (t) => {
  const f = await fixture(t, 0),
    initial = clean(f.rows()),
    view = {
      box: { x: -128, y: -128, width: 256, height: 256 },
      frame: { x: -128, y: -128, width: 256, height: 256 },
      columns: 65,
      rows: 65,
      focusM: 30,
      tilt: 45,
      rotation: 0,
      exaggeration: 1,
      projection: 'perspective',
    },
    screenInput = {
      version: 1,
      events: [
        { u: 0.4, v: 0.5, t: 0 },
        { u: 0.6, v: 0.5, t: 1000 },
      ],
    };
  for (const mode of ['dig', 'scatter', 'erase']) {
    const before = clean(f.rows()),
      at = f.cursor(),
      s = {
        id: 'screen-' + mode,
        mode,
        radius: mode === 'erase' ? 96 : 32,
        strength: 1,
        feather: 0.7,
        waterLevelM: mode === 'scatter' ? null : 30,
        ...(mode === 'scatter' ? { noise: 0.7, seed: 321 } : {}),
        visibility: view,
        screenInput,
        samples: [
          { x: -900, y: -900, t: 0 },
          { x: 900, y: 900, t: 1000 },
        ],
      },
      grid = api.readTerrainGrid(f.store.db, f.cam.id, view),
      expected = api.applyLakeBrush(f.rows(), s, grid),
      { c, patch } = await f.prepare(s);
    assert.deepEqual(clean(patch.records), clean(expected.records), mode);
    assert.deepEqual(patch.remove.toSorted(), expected.remove.toSorted(), mode);
    assert(patch.records.length || patch.remove.length, mode + ' actually changes the world');
    assert.deepEqual(clean(f.rows()), before);
    assert.equal(f.cursor(), at);
    f.store.executeAtlasCommit(c, patch);
    assert.equal(f.cursor(), at + 1, mode + ' atomic history');
    const saved = clean(f.rows());
    f.store.executeAtlasCommit(c);
    assert.deepEqual(clean(f.rows()), saved, 'same receipt');
    assert.equal(f.cursor(), at + 1);
    f.write({ kind: 'undo' });
    assert.deepEqual(clean(f.rows()), before, mode + ' undo');
    assert.equal(f.cursor(), at);
    f.write({ kind: 'redo' });
    assert.deepEqual(clean(f.rows()), saved, mode + ' redo');
    assert.equal(f.cursor(), at + 1);
  }
  assert.deepEqual(
    clean(f.rows()),
    initial,
    'erase returns every owned excavation and removes water',
  );
  const fresh = new api.CampaignStore(f.store.db.name);
  try {
    assert.deepEqual(
      clean(
        fresh.db
          .prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? ORDER BY id')
          .all(f.cam.id)
          .map((r) => JSON.parse(r.payload)),
      ),
      initial,
    );
  } finally {
    fresh.close();
  }
});

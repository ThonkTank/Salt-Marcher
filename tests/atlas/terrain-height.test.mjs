import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/atlas-landscape';export * from './src/app/atlas/atlas-brush-worker';export * from './src/app/atlas/landscape-raster';export * from './src/app/storage/store';export * from './src/app/atlas/landscape-color-surface';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-height-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  TerrainSampler,
  applyHeightStroke,
  applyHeightArea,
  heightRecord,
  decodeHeights,
  settingsRecord,
  validateTerrain,
  renderBrushPreview,
  LandscapeRasterizer,
  effectiveLandscape,
} = require('../../.build/terrain-height-test.cjs');
const stroke = (mode, radius = 64, from = { x: -200, y: 0 }, to = { x: 200, y: 0 }) => ({
  mode,
  radius,
  roughness: 0,
  seed: 42,
  samples: [
    { ...from, t: 0 },
    { ...to, t: 1000 },
  ],
});
const combine = (records, tiles) => [
  ...records.filter((r) => !tiles.some((t) => t.id === r.id)),
  ...tiles,
];
const apply = (rs, s) => combine(rs, applyHeightStroke(rs, s));
function fixture(t) {
  const dir = mkdtempSync('/tmp/height-r1-');
  let store = new CampaignStore(dir + '/world.sqlite');
  const cam = store.create('Höhenprobe');
  let active = store.activate(cam.id);
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    dir,
    cam,
    get store() {
      return store;
    },
    get token() {
      return active.token;
    },
    write: (action) =>
      store.executeAtlasCommit({
        commandId: randomUUID(),
        campaignId: cam.id,
        token: active.token,
        action,
      }),
    records: () =>
      store.landscapeRegion(active.token, {
        x: -10000,
        y: -10000,
        width: 20000,
        height: 20000,
      }).records,
    reopen() {
      store.close();
      store = new CampaignStore(dir + '/world.sqlite');
      active = store.activate(cam.id);
    },
  };
}
test('metres, negative coordinates and continuous interpolation across tile edges', () => {
  const rs = [];
  for (let ty = -1; ty <= 0; ty++)
    for (let tx = -1; tx <= 0; tx++) {
      const values = Float32Array.from(
        { length: 4096 },
        (_, i) => (tx * 64 + (i % 64)) * 2 + (ty * 64 + Math.floor(i / 64)) * 3,
      );
      rs.push(heightRecord(tx * 64, ty * 64, 1, values));
    }
  const sampler = new TerrainSampler(rs);
  for (const x of [-0.01, 0, 0.01, 20.4])
    for (const y of [-0.01, 0, 0.01, 15.7])
      assert(Math.abs(sampler.sample({ x, y }).heightM - (2 * x + 3 * y)) < 1e-8);
  const q = sampler.query({ x: 0, y: 0 });
  assert.equal(q.resolutionM, 1);
  assert(Math.abs(q.slopeDegrees - (Math.atan(Math.sqrt(13)) * 180) / Math.PI) < 1e-8);
  assert(Math.abs(Math.hypot(...Object.values(q.normal)) - 1) < 1e-12);
  assert.equal(new TerrainSampler([]).sample({ x: 2e8, y: 0 }).heightM, -100);
});
test('coarse edits preserve fine authored details but not untouched parts of the same tile', () => {
  let rs = apply([], stroke('land', 256));
  rs = apply(rs, stroke('land-erase', 16, { x: 0, y: 0 }, { x: 0, y: 0 }));
  const before = new TerrainSampler(rs).sample({ x: 0, y: 0 });
  rs = apply(rs, stroke('land', 256));
  assert.deepEqual(new TerrainSampler(rs).sample({ x: 0, y: 0 }), before);
  rs = apply(rs, stroke('land-erase', 256));
  assert.equal(new TerrainSampler(rs).sample({ x: 40, y: 0 }).heightM, -100);
});
test('one gesture creates island and strait; preview matches persisted raster, history and reopened queries', (t) => {
  const f = fixture(t),
    s = stroke('land');
  const box = { x: -256, y: -128, width: 512, height: 256 },
    preview = renderBrushPreview({
      generation: 1,
      records: [],
      box,
      width: 128,
      height: 64,
      stroke: s,
    });
  f.write({ kind: 'landscape-land-stroke', stroke: s });
  let rs = f.records();
  assert(!rs.some((r) => r.mask));
  assert(rs.some((r) => r.height));
  const image = new LandscapeRasterizer(box, 128, 64);
  for (const r of rs) image.paint(r);
  assert.deepEqual(image.finish(), preview);
  for (const x of [-128, -0.001, 0, 0.001, 128]) {
    assert.equal(f.store.atlasHeight(f.token, { x, y: 0 }).heightM, 100);
    assert.equal(effectiveLandscape(rs, { x, y: 0 }).terrain, 'plains');
  }
  const original = rs;
  f.write({
    kind: 'landscape-land-stroke',
    stroke: stroke('land-erase', 16, { x: 0, y: -100 }, { x: 0, y: 100 }),
  });
  assert.equal(f.store.atlasHeight(f.token, { x: 0, y: 0 }).water, true);
  f.write({ kind: 'undo' });
  assert.deepEqual(f.records(), original);
  f.write({ kind: 'redo' });
  const expected = f.records();
  f.reopen();
  assert.deepEqual(f.records(), expected);
  assert.equal(f.store.atlasHeight(f.token, { x: 0, y: 0 }).heightM, -100);
});
test('sea level and bounded lakes use terrain, survive archive remapping and remain editable', async (t) => {
  const f = fixture(t);
  f.write({ kind: 'landscape-land-stroke', stroke: stroke('land') });
  f.write({ kind: 'landscape-sea-level', seaLevelM: 25 });
  const lake = {
    id: randomUUID(),
    revision: 0,
    kind: 'patch',
    name: 'See',
    points: [],
    polygons: [
      {
        outer: [
          { x: -40, y: -40 },
          { x: 40, y: -40 },
          { x: 40, y: 40 },
          { x: -40, y: 40 },
        ],
        holes: [],
      },
    ],
    width: 0,
    resolution: 1,
    values: { terrain: 'water' },
    surface: 'freshwater',
    waterLevelM: 110,
  };
  f.write({ kind: 'landscape-put', record: lake, expectedRevision: null });
  assert(f.store.atlasHeight(f.token, { x: 0, y: 0 }).water);
  assert(!f.store.atlasHeight(f.token, { x: 80, y: 0 }).water);
  const hill = {
    ...lake,
    id: randomUUID(),
    surface: undefined,
    waterLevelM: undefined,
    propertyOnly: true,
    values: { elevationM: 150 },
    polygons: [
      {
        outer: [
          { x: -8, y: -8 },
          { x: 8, y: -8 },
          { x: 8, y: 8 },
          { x: -8, y: 8 },
        ],
        holes: [],
      },
    ],
  };
  f.write({ kind: 'landscape-put', record: hill, expectedRevision: null });
  assert(!f.store.atlasHeight(f.token, { x: 0, y: 0 }).water);
  const file = f.dir + '/copy.sqlite';
  await f.store.campaignSnapshot(f.token, file);
  const copy = f.store.acceptCampaignSnapshot(file, 'Kopie', {}),
    active = f.store.activate(copy.id);
  assert.equal(f.store.atlasHeight(active.token, { x: 0, y: 0 }).heightM, 150);
  assert.equal(f.store.atlasHeight(active.token, { x: 1000, y: 0 }).seaLevelM, 25);
  f.store.executeAtlasCommit({
    commandId: randomUUID(),
    campaignId: copy.id,
    token: active.token,
    action: { kind: 'landscape-sea-level', seaLevelM: 200 },
  });
  assert(f.store.atlasHeight(active.token, { x: 0, y: 0 }).water);
  f.store.executeAtlasCommit({
    commandId: randomUUID(),
    campaignId: copy.id,
    token: active.token,
    action: {
      kind: 'landscape-land-stroke',
      stroke: stroke('land-erase', 16, { x: 80, y: 0 }, { x: 80, y: 0 }),
    },
  });
  assert.equal(f.store.atlasHeight(active.token, { x: 80, y: 0 }).heightM, 100);
});
test('malformed height formats and write failures leave the transaction unchanged', (t) => {
  const f = fixture(t),
    before = f.records();
  const bad = heightRecord(0, 0, 1, new Float32Array(4096));
  bad.height.version = 3;
  assert.throws(
    () => f.write({ kind: 'landscape-put', record: bad, expectedRevision: null }),
    /prüfen/,
  );
  assert.deepEqual(f.records(), before);
  assert.throws(() => f.write({ kind: 'landscape-sea-level', seaLevelM: Infinity }), /prüfen/);
  assert.deepEqual(f.records(), before);
  f.store.db.exec(
    "CREATE TEMP TRIGGER fail_height BEFORE INSERT ON atlas_landscape WHEN json_extract(new.payload,'$.height') IS NOT NULL BEGIN SELECT RAISE(ABORT,'simulated disk failure');END;",
  );
  assert.throws(
    () => f.write({ kind: 'landscape-land-stroke', stroke: stroke('land') }),
    /simulated/,
  );
  assert.deepEqual(f.records(), before);
  assert.throws(
    () =>
      validateTerrain({
        ...settingsRecord(0),
        terrainSettings: { version: 2, seaLevelM: 0 },
      }),
    /prüfen/,
  );
});
test('height queries are read-only; explicit local reset releases height overrides and undo restores them', (t) => {
  const f = fixture(t);
  f.write({ kind: 'landscape-land-stroke', stroke: stroke('land') });
  const point = { x: 0, y: 0 },
    records = f.records(),
    // The legacy record observer may initialize its optional TEMP index.
    before = f.store.atlasRegionSource(f.token);
  f.store.atlasHeight(f.token, point);
  f.store.atlasMaskRegion(f.token, { x: -10, y: -10, width: 20, height: 20 });
  assert.equal(f.store.atlasRegionSource(f.token).fence, before.fence);
  const polygons = [
    {
      outer: [
        { x: -8, y: -8 },
        { x: 8, y: -8 },
        { x: 8, y: 8 },
        { x: -8, y: 8 },
      ],
      holes: [],
    },
  ];
  f.write({
    kind: 'landscape-reset',
    propertyOnly: true,
    field: 'elevationM',
    resolution: 64,
    polygons,
  });
  assert.equal(f.store.atlasHeight(f.token, point).heightM, -100);
  assert.equal(f.store.atlasHeight(f.token, { x: 100, y: 0 }).heightM, 100);
  f.write({ kind: 'undo' });
  assert.deepEqual(
    f.records().map(({ revision, ...r }) => r),
    records.map(({ revision, ...r }) => r),
  );
  const duplicate = {
    ...records.find((r) => r.height),
    id: randomUUID(),
    revision: 0,
  };
  assert.throws(
    () =>
      f.write({
        kind: 'landscape-put',
        record: duplicate,
        expectedRevision: null,
      }),
    /Doppelte/,
  );
});

test('semantic water properties cannot create a second coast; colour footprint respects fine straits', (t) => {
  const f = fixture(t);
  f.write({ kind: 'landscape-land-stroke', stroke: stroke('land', 256) });
  const patch = {
    id: randomUUID(),
    revision: 0,
    kind: 'patch',
    name: 'Nur Eigenschaften',
    points: [],
    polygons: [
      {
        outer: [
          { x: -10, y: -10 },
          { x: 10, y: -10 },
          { x: 10, y: 10 },
          { x: -10, y: 10 },
        ],
        holes: [],
      },
    ],
    width: 0,
    resolution: 1,
    propertyOnly: true,
    values: { terrain: 'water' },
  };
  f.write({ kind: 'landscape-put', record: patch, expectedRevision: null });
  assert.equal(effectiveLandscape(f.records(), { x: 0, y: 0 }).terrain, 'plains');
  f.write({
    kind: 'landscape-land-stroke',
    stroke: stroke('land-erase', 8, { x: 0, y: -300 }, { x: 0, y: 300 }),
  });
  const core = require('../../.build/terrain-height-test.cjs'),
    land = core.landSurface(f.records());
  assert(!core.contains({ x: 0, y: 0 }, land));
  assert(core.contains({ x: 40, y: 0 }, land));
});

test('sea metadata has no map footprint; exposed uncharted ground accepts colour without height writes', (t) => {
  const f = fixture(t),
    before = f.store.atlasOverview(f.token).landscapeBounds;
  f.write({ kind: 'landscape-sea-level', seaLevelM: -200 });
  assert.deepEqual(f.store.atlasOverview(f.token).landscapeBounds, before);
  const r = {
    id: randomUUID(),
    revision: 0,
    kind: 'patch',
    name: 'Farbe',
    points: [{ x: 1000, y: 1000 }],
    polygons: [
      {
        outer: [
          { x: 990, y: 990 },
          { x: 1010, y: 990 },
          { x: 1010, y: 1010 },
          { x: 990, y: 1010 },
        ],
        holes: [],
      },
    ],
    width: 0,
    resolution: 1,
    values: {},
    paint: {
      version: 2,
      operation: 'paint',
      target: 'ground',
      color: '#22aa33',
      opacity: 1,
      flow: 1,
      tip: 'round',
      radius: 10,
      seed: 42,
      fill: false,
    },
  };
  const core = require('../../.build/terrain-height-test.cjs');
  assert(core.contains({ x: 1000, y: 1000 }, core.colorSurface(r, f.records()).polygons));
  const lake = {
    ...r,
    id: randomUUID(),
    paint: undefined,
    surface: 'freshwater',
    waterLevelM: -50,
    values: { terrain: 'water' },
  };
  assert(
    !core.contains({ x: 1000, y: 1000 }, core.colorSurface(r, [...f.records(), lake]).polygons),
  );
  f.write({ kind: 'landscape-color-stroke', record: r });
  assert.equal(f.store.atlasHeight(f.token, { x: 1000, y: 1000 }).heightM, -100);
  assert(!f.records().some((r) => r.height));
});

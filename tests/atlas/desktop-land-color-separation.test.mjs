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
      "export * from './src/app/storage/store';export * from './src/app/atlas/atlas-landscape';export * from './src/app/atlas/landscape-line';export * from './src/app/atlas/landscape-brush';export * from './src/app/atlas/landscape-raster';export * from './src/app/atlas/atlas-landscape-view';export * from './src/app/atlas/atlas-paint';export * from './src/app/atlas/atlas-brush-preview';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/land-color-separation-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  splitLine,
  translateLine,
  newLine,
  linePoints,
  lineParts,
  lineContains,
  bounds,
  effectiveLandscape,
  brushFootprint,
  LandscapeRasterizer,
  drawLandscape,
  atlasPaint,
  renderBrushPreview,
} = require('../../.build/land-color-separation-test.cjs');
const line = (kind = 'road') => ({
  id: randomUUID(),
  revision: 0,
  kind,
  name: 'Originalname',
  points: [
    { x: -300, y: 0 },
    { x: 0, y: 180 },
    { x: 400, y: 0 },
  ],
  polygons: [],
  width: 20,
  resolution: 1,
  values: {},
  line: newLine(kind, 37498),
});
const square = (x, y, w) => [
  {
    outer: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + w },
      { x, y: y + w },
    ],
    holes: [],
  },
];
const patch = (terrain = 'forest') => ({
  id: randomUUID(),
  revision: 0,
  kind: 'patch',
  name: 'Originalfläche',
  points: [],
  polygons: square(-500, -500, 1000),
  width: 0,
  resolution: 1,
  values: { terrain },
});
function fixture(t) {
  const dir = mkdtempSync('/tmp/landscape-tools-');
  let store = new CampaignStore(dir + '/world.sqlite');
  const cam = store.create('Unveränderter Kampagnenname');
  let w = store.activate(cam.id);
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
      return w.token;
    },
    write: (action) =>
      store.executeAtlasCommit({
        commandId: randomUUID(),
        token: w.token,
        campaignId: cam.id,
        action,
      }),
    records: () =>
      store.landscapeRegion(w.token, {
        x: -1e5,
        y: -1e5,
        width: 2e5,
        height: 2e5,
      }).records,
    fresh() {
      store.close();
      store = new CampaignStore(dir + '/world.sqlite');
      w = store.activate(cam.id);
    },
  };
}

const land = (x = 0, y = 0, radius = 100, mode = 'land') => ({
  kind: 'landscape-land-stroke',
  stroke: {
    mode,
    radius,
    roughness: 0,
    seed: 42,
    samples: [
      { x, y, t: 0 },
      { x, y, t: 100 },
    ],
  },
});
function color(options = {}, x = 0, y = 0, radius = 80) {
  const points = [{ x, y }];
  return {
    kind: 'landscape-color-stroke',
    record: {
      ...patch(),
      values: {},
      points,
      polygons: brushFootprint(points, radius),
      paint: {
        version: 2,
        operation: 'paint',
        target: 'ground',
        color: '#22aa33',
        opacity: 1,
        flow: 1,
        tip: 'round',
        radius,
        seed: 42,
        fill: false,
        fillScope: 'connected',
        ...options,
      },
    },
  };
}
const box = { x: -200, y: -200, width: 400, height: 400 };
const render = (records) =>
  renderBrushPreview({ generation: 1, records, box, width: 200, height: 200 });
const pixel = (pixels, x = 0, y = 0) =>
  Array.from(
    pixels.slice(
      (Math.floor((y + 200) / 2) * 200 + Math.floor((x + 200) / 2)) * 4,
      (Math.floor((y + 200) / 2) * 200 + Math.floor((x + 200) / 2)) * 4 + 4,
    ),
  );
const heights = (rs) => JSON.stringify(rs.filter((r) => r.height));
test('hard land is a neutral filled disk; terrain/climate properties change queries without changing heights or pixels', (t) => {
  const f = fixture(t);
  f.write(land());
  const base = f.records(),
    image = render(base),
    mask = heights(base);
  assert(
    base.some((r) => r.height),
    'Height preservation assertions need authored height data',
  );
  assert.deepEqual(pixel(image), [238, 229, 207, 255]);
  assert.deepEqual(pixel(image, 80), [238, 229, 207, 255]);
  f.write({
    kind: 'landscape-put',
    record: {
      ...patch(),
      propertyOnly: true,
      values: { terrain: 'forest', climate: 'cold' },
    },
    expectedRevision: null,
  });
  assert.equal(effectiveLandscape(f.records(), { x: 0, y: 0 }).terrain, 'forest');
  assert.equal(effectiveLandscape(f.records(), { x: 180, y: 0 }).terrain, 'water');
  assert.equal(heights(f.records()), mask);
  assert.deepEqual(render(f.records()), image);
});
test('painting and soft/partial erasing affect pigment only, one undo per operation, preserved after reopening', (t) => {
  const f = fixture(t);
  f.write(land());
  const base = render(f.records()),
    mask = heights(f.records());
  f.write(color());
  const painted = render(f.records());
  assert.deepEqual(pixel(painted), [34, 170, 51, 255]);
  f.write(color({ operation: 'erase', opacity: 0.5 }));
  const half = render(f.records());
  assert(pixel(half)[0] > 34 && pixel(half)[0] < 238);
  assert.equal(heights(f.records()), mask);
  f.write({ kind: 'undo' });
  assert.deepEqual(render(f.records()), painted);
  f.write({ kind: 'redo' });
  f.fresh();
  assert.deepEqual(render(f.records()), half);
  f.write(color({ operation: 'erase' }));
  assert.deepEqual(render(f.records()), base);
});
test('all three color tips differ, opacity caps coverage and a soft eraser feathers', (t) => {
  const f = fixture(t);
  f.write(land());
  const base = f.records();
  const pictures = ['round', 'soft', 'textured'].map((tip) => {
    f.write(color({ tip }));
    const p = render(f.records());
    f.write({ kind: 'undo' });
    return p;
  });
  assert.equal(new Set(pictures.map((p) => Buffer.from(p).toString('base64'))).size, 3);
  f.write(color());
  f.write(color({ operation: 'erase', tip: 'soft' }));
  const erased = render(f.records());
  assert(pixel(erased)[0] > pixel(erased, 60)[0]);
  assert.equal(heights(f.records()), heights(base));
});
test('color over sea does not color later land; erased and restored colored land retains pigment', (t) => {
  const f = fixture(t);
  f.write(land(-50, 0, 60));
  f.write(color({}, 0, 0, 100));
  f.write(land(90, 0, 40));
  assert.deepEqual(pixel(render(f.records()), 90), [238, 229, 207, 255]);
  const painted = pixel(render(f.records()), -50);
  f.write(land(-50, 0, 60, 'land-erase'));
  assert.equal(effectiveLandscape(f.records(), { x: -50, y: 0 }).terrain, 'water');
  f.write(land(-50, 0, 60));
  assert.deepEqual(pixel(render(f.records()), -50), painted);
});
test('ground/water erase targets stay independent and restore original base', (t) => {
  const f = fixture(t);
  f.write(land(-50, 0, 60));
  f.write(color({}, -50, 0, 50));
  f.write(color({ target: 'water', color: '#ff0000' }, 100, 0, 50));
  const painted = render(f.records());
  f.write(color({ operation: 'erase', target: 'water' }, 100, 0, 50));
  assert.deepEqual(pixel(render(f.records()), -50), pixel(painted, -50));
  assert.notDeepEqual(pixel(render(f.records()), 100), pixel(painted, 100));
  assert.equal(effectiveLandscape(f.records(), { x: 100, y: 0 }).terrain, 'water');
});
test('connected fill covers a whole island across tile seams; all fills detached land; water fills only closed lakes', (t) => {
  const f = fixture(t);
  f.write(land(-60, 0, 70));
  f.write(land(120, 0, 30));
  f.write(color({ fill: true }, -60));
  let rs = f.records();
  assert.deepEqual(pixel(render(rs), -60, 40), [34, 170, 51, 255]);
  assert.deepEqual(pixel(render(rs), 120), [238, 229, 207, 255]);
  f.write(color({ fill: true, fillScope: 'all' }));
  assert.deepEqual(pixel(render(f.records()), 120), [34, 170, 51, 255]);
  assert.throws(() => f.write(color({ target: 'water', fill: true }, 180, 150)), /Fläche/);
  f.write(land(-60, 0, 20, 'land-erase'));
  f.write(color({ target: 'water', fill: true, color: '#ff0000' }, -60));
  assert.deepEqual(pixel(render(f.records()), -60), [255, 0, 0, 255]);
});
test('worker preview matches committed raster, including color erase and authoring-time clipping', (t) => {
  const f = fixture(t);
  f.write(land());
  f.write(color());
  const action = color({ operation: 'erase', tip: 'soft', opacity: 0.5 });
  const before = f.records();
  const preview = renderBrushPreview({
    generation: 5,
    records: before,
    box,
    width: 200,
    height: 200,
    color: action.record,
  });
  f.write(action);
  assert.deepEqual(render(f.records()), preview);
});
test('typed boundary rejects mixed land/color/property operations atomically', (t) => {
  const f = fixture(t);
  f.write(land());
  const before = f.records();
  assert.throws(() => f.write({ ...land(), paint: color().record.paint }), /Landauftrag/);
  assert.throws(
    () =>
      f.write({
        ...color(),
        record: { ...color().record, propertyOnly: true },
      }),
    /Farbauftrag/,
  );
  assert.throws(
    () =>
      f.write({
        kind: 'landscape-put',
        record: { ...patch(), propertyOnly: 'yes' },
        expectedRevision: null,
      }),
    /Eigenschaftsfläche/,
  );
  assert.deepEqual(f.records(), before);
});
test('current reopen preserves history and records; archive carries pigment/erasers/properties', async (t) => {
  const f = fixture(t);
  f.write(land());
  f.write(color());
  f.write(color({ operation: 'erase', opacity: 0.5 }));
  f.write({
    kind: 'landscape-put',
    record: { ...patch(), propertyOnly: true, values: { elevationM: 42 } },
    expectedRevision: null,
  });
  const before = f.records(),
    image = render(before),
    history = f.store.db.prepare('SELECT * FROM campaign_atlas').all();
  f.fresh();
  assert.deepEqual(f.records(), before);
  assert.deepEqual(f.store.db.prepare('SELECT * FROM campaign_atlas').all(), history);
  const file = f.dir + '/copy.sqlite';
  await f.store.campaignSnapshot(f.token, file);
  const copy = f.store.acceptCampaignSnapshot(file, 'Kopie', {}),
    active = f.store.activate(copy.id);
  assert.deepEqual(render(f.store.landscapeRegion(active.token, box).records), image);
});

test('legacy fine/coarse color stacking survives new chronological pigment and erasing', (t) => {
  const f = fixture(t);
  f.write(land());
  const fine = color({ version: 1, color: '#ff0000' }).record,
    coarse = color({ version: 1, color: '#0000ff' }).record;
  fine.resolution = 1;
  coarse.resolution = 10;
  f.write({ kind: 'landscape-put', record: fine, expectedRevision: null });
  f.write({ kind: 'landscape-put', record: coarse, expectedRevision: null });
  assert.deepEqual(pixel(render(f.records())), [255, 0, 0, 255]);
  f.write(color());
  assert.deepEqual(pixel(render(f.records())), [34, 170, 51, 255]);
  f.write(color({ operation: 'erase' }));
  assert.deepEqual(pixel(render(f.records())), [238, 229, 207, 255]);
});

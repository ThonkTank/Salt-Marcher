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
      "export * from './src/app/storage/store';export * from './src/app/atlas/atlas-landscape';export * from './src/app/atlas/landscape-line';export * from './src/app/atlas/landscape-brush';export * from './src/app/atlas/landscape-raster';export * from './src/app/atlas/atlas-landscape-view';export * from './src/app/atlas/atlas-paint';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/landscape-tools-test.cjs',
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
} = require('../../.build/landscape-tools-test.cjs');
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
      store.landscapeRegion(w.token, { x: -1e5, y: -1e5, width: 2e5, height: 2e5 }).records,
    fresh() {
      store.close();
      store = new CampaignStore(dir + '/world.sqlite');
      w = store.activate(cam.id);
    },
  };
}
test('curves retain exact anchors, stable seeds and world shape through serialization and translation', () => {
  const r = line('river'),
    points = linePoints(r);
  assert.deepEqual(points, linePoints(JSON.parse(JSON.stringify(r))));
  for (const p of r.points) assert(points.some((q) => q.x === p.x && q.y === p.y));
  const moved = { ...r, points: r.points.map((p) => ({ x: p.x + 20000000, y: p.y - 10000000 })) },
    actual = linePoints(moved);
  for (let i = 0; i < points.length; i++) {
    assert(Math.abs(actual[i].x - points[i].x - 20000000) < 1e-7);
    assert(Math.abs(actual[i].y - points[i].y + 10000000) < 1e-7);
  }
  assert.notDeepEqual(points, linePoints({ ...r, line: { ...r.line, seed: 12 } }));
  const b = bounds(r);
  for (const p of points)
    assert(p.x >= b.x && p.y >= b.y && p.x <= b.x + b.width && p.y <= b.y + b.height);
});
test('legacy lines keep their original points and paint while new styles produce ten distinct geometries', () => {
  const r = line();
  delete r.line;
  assert.equal(linePoints(r), r.points);
  const root = atlasPaint('group');
  drawLandscape(root, [r], { x: 0, y: 0, width: 100, height: 100 }, 1, new Map());
  assert.equal(root.children[0].children[0].style.stroke, '#a37e51');
  const styles = [
    'blended',
    'solid',
    'dashed',
    'dotted',
    'double',
    'dash-dot-dot',
    'arrows',
    'rail',
    'dash-dot',
    'worn',
  ];
  assert.equal(
    new Set(
      styles.map((style) =>
        JSON.stringify(lineParts({ ...r, line: { ...newLine('road'), style } })),
      ),
    ).size,
    10,
  );
});
test('river source fade, joins and exact world queries use the generated curve', () => {
  const r = line('river'),
    pts = linePoints(r),
    p = pts[52];
  assert(lineContains(r, p));
  assert.equal(effectiveLandscape([r], p).terrain, 'water');
  assert(!lineContains(r, { x: r.points[0].x, y: r.points[0].y - 9 }));
  assert(lineParts(r)[0].polygons);
  assert(!lineParts({ ...r, line: { ...r.line, fadeIn: false } })[0].polygons);
});
test('curve edit, group move, undo and fresh reopen preserve geometry and original labels', (t) => {
  const f = fixture(t),
    a = line(),
    b = line();
  f.write({
    kind: 'landscape-batch',
    records: [a, b].map((record) => ({ record, expectedRevision: null })),
  });
  const payload = (rs) => rs.map(({ revision, ...r }) => r);
  const before = f.records();
  f.write({
    kind: 'landscape-batch',
    records: before.map((r) => ({
      record: {
        ...r,
        points: r.points.map((p) => ({ x: p.x + 50, y: p.y - 30 })),
        line: { ...r.line, color: '#ff8800' },
      },
      expectedRevision: r.revision,
    })),
  });
  const after = f.records();
  f.write({ kind: 'undo' });
  assert.deepEqual(payload(f.records()), payload(before));
  f.write({ kind: 'redo' });
  f.fresh();
  assert.deepEqual(payload(f.records()), payload(after));
  assert(after.every((r) => r.name === 'Originalname'));
});
test('invalid options and a stale second batch member roll back the whole write', (t) => {
  const f = fixture(t),
    a = line(),
    b = line();
  f.write({
    kind: 'landscape-batch',
    records: [a, b].map((record) => ({ record, expectedRevision: null })),
  });
  const before = f.records();
  assert.throws(
    () =>
      f.write({
        kind: 'landscape-batch',
        records: [
          { record: { ...before[0], width: 100 }, expectedRevision: 1 },
          { record: before[1], expectedRevision: 0 },
        ],
      }),
    /inzwischen/,
  );
  assert.deepEqual(f.records(), before);
  for (const invalid of [
    { version: 2 },
    { color: 'url(bad)' },
    { roughness: Infinity },
    { seed: -1 },
    { meander: 2 },
  ])
    assert.throws(
      () =>
        f.write({
          kind: 'landscape-put',
          record: { ...a, id: randomUUID(), line: { ...a.line, ...invalid } },
          expectedRevision: null,
        }),
      /prüfen/,
    );
});
function brush(mode, points = [{ x: 0, y: 0 }]) {
  const r = patch('plains');
  r.points = points;
  r.polygons = brushFootprint(points, 100, 0.6, 42);
  if (mode.includes('color') && mode !== 'color-erase') {
    r.values = {};
    r.paint = {
      version: 1,
      target: mode === 'water-color' ? 'water' : 'ground',
      color: '#e51c23',
      opacity: 0.5,
      flow: 1,
      tip: 'soft',
      radius: 100,
      seed: 42,
      fill: false,
    };
  }
  return {
    kind: 'landscape-brush',
    record: r,
    mode,
    radius: 100,
    roughness: 0.6,
    seed: 42,
    fill: false,
    samples: [
      { ...points[0], t: 0 },
      { ...points.at(-1), t: 2000 },
    ],
  };
}
test('freshwater erasing restores underlying terrain without replacing other properties', (t) => {
  const f = fixture(t),
    land = { ...patch(), values: { terrain: 'forest', elevationM: 42 } };
  f.write({ kind: 'landscape-put', record: land, expectedRevision: null });
  f.write(brush('freshwater'));
  assert.equal(effectiveLandscape(f.records(), { x: 0, y: 0 }).terrain, 'water');
  f.write(brush('freshwater-erase'));
  assert.equal(effectiveLandscape(f.records(), { x: 0, y: 0 }).terrain, 'forest');
  assert.equal(effectiveLandscape(f.records(), { x: 0, y: 0 }).elevationM, 42);
  f.write({ kind: 'undo' });
  assert.equal(effectiveLandscape(f.records(), { x: 0, y: 0 }).terrain, 'water');
});
test('raising and lowering change the local coast and retain distant terrain', (t) => {
  const f = fixture(t),
    sea = { ...patch('water'), polygons: square(-500, -500, 1000) },
    land = { ...patch(), polygons: square(-500, -500, 500) };
  f.write({
    kind: 'landscape-batch',
    records: [sea, land].map((record) => ({ record, expectedRevision: null })),
  });
  f.write(brush('raise', [{ x: 0, y: -100 }]));
  assert.equal(effectiveLandscape(f.records(), { x: 10, y: -100 }).terrain, 'plains');
  assert.equal(effectiveLandscape(f.records(), { x: 300, y: -100 }).terrain, 'water');
  f.write({ kind: 'undo' });
  assert.equal(effectiveLandscape(f.records(), { x: 10, y: -100 }).terrain, 'water');
  f.write(brush('lower', [{ x: 0, y: -100 }]));
  assert.equal(effectiveLandscape(f.records(), { x: -10, y: -100 }).terrain, 'water');
});
test('color blends independently of terrain, respects target masks and survives erase/undo/copy', async (t) => {
  const f = fixture(t);
  f.write({ kind: 'landscape-put', record: patch(), expectedRevision: null });
  f.write(brush('ground-color'));
  const before = f.records();
  assert.equal(effectiveLandscape(before, { x: 0, y: 0 }).terrain, 'forest');
  const box = { x: -200, y: -200, width: 400, height: 400 },
    render = (records) => {
      const image = new LandscapeRasterizer(box, 80, 80);
      for (const r of records) image.paint(r);
      for (const r of records) if (r.paint) image.paintColor(r);
      return image.finish();
    },
    painted = render(before),
    base = render(before.filter((r) => !r.paint));
  assert.notDeepEqual(painted, base);
  f.write(brush('color-erase'));
  assert.deepEqual(render(f.records()), base);
  f.write({ kind: 'undo' });
  assert.deepEqual(render(f.records()), painted);
  f.fresh();
  assert.deepEqual(render(f.records()), painted);
  const saved = f.dir + '/copy.sqlite';
  await f.store.campaignSnapshot(f.token, saved);
  const copy = f.store.acceptCampaignSnapshot(saved, 'Kopie', {}),
    active = f.store.activate(copy.id);
  assert.deepEqual(render(f.store.landscapeRegion(active.token, box).records), painted);
  const waterOnly = brush('water-color').record;
  assert.deepEqual(render([patch(), waterOnly]), render([patch()]));
});
test('fill affects the connected surface, and color tips and opacity yield distinct results', (t) => {
  const f = fixture(t),
    land = patch();
  land.polygons = [...square(-100, -100, 200), ...square(300, -100, 100)];
  f.write({ kind: 'landscape-put', record: land, expectedRevision: null });
  const a = brush('ground-color');
  a.fill = true;
  a.record.paint.fill = true;
  f.write(a);
  const p = f.records().find((r) => r.paint);
  assert.equal(p.polygons.length, 1);
  assert(bounds(p).x + bounds(p).width < 300);
  const images = ['round', 'soft', 'textured'].map((tip) => {
    const r = brush('ground-color').record;
    r.paint.tip = tip;
    const image = new LandscapeRasterizer({ x: -120, y: -120, width: 240, height: 240 }, 64, 64);
    image.paint(patch());
    image.paintColor(r);
    return Buffer.from(image.finish()).toString('base64');
  });
  assert.equal(new Set(images).size, 3);
});

test('splitting retains every curve sample, source taper, dash phase and move continuity', () => {
  for (const kind of ['road', 'river']) {
    const r = line(kind);
    r.line.style = 'dashed';
    const [a, b] = splitLine(r, 1, randomUUID());
    assert.deepEqual([...linePoints(a).slice(0, -1), ...linePoints(b)], linePoints(r));
    assert(b.line.continuity.distanceOffset > 0);
    if (kind === 'road') assert.equal(lineParts(b)[0].dashOffset, b.line.continuity.distanceOffset);
    else assert(lineContains(b, { x: b.points[0].x, y: b.points[0].y + 5 }));
    translateLine(b, 200, -300);
    const translated = linePoints(b);
    translateLine(b, -200, 300);
    const original = linePoints(b);
    translated.forEach((p, i) => {
      assert(Math.abs(p.x - original[i].x - 200) < 1e-8);
      assert(Math.abs(p.y - original[i].y + 300) < 1e-8);
    });
  }
});
test('group deletion is atomic on conflict and one reversible history entry', (t) => {
  const f = fixture(t),
    a = line(),
    b = line();
  f.write({
    kind: 'landscape-batch',
    records: [a, b].map((record) => ({ record, expectedRevision: null })),
  });
  const before = f.records();
  assert.throws(
    () =>
      f.write({
        kind: 'landscape-batch',
        records: [],
        remove: [
          { id: a.id, expectedRevision: 1 },
          { id: b.id, expectedRevision: 0 },
        ],
      }),
    /inzwischen/,
  );
  assert.deepEqual(f.records(), before);
  f.write({
    kind: 'landscape-batch',
    records: [],
    remove: before.map((r) => ({ id: r.id, expectedRevision: r.revision })),
  });
  assert.equal(f.records().length, 0);
  f.write({ kind: 'undo' });
  assert.equal(f.records().length, 2);
});
test('legacy stacking is unchanged and explicit over-symbol lines have a separate layer', () => {
  const road = line();
  delete road.line;
  road.order = 2;
  const place = { ...line(), kind: 'place', order: 1 };
  delete place.line;
  const get = (rs) => {
    const root = atlasPaint('group');
    drawLandscape(root, rs, { x: 0, y: 0, width: 1000, height: 1000 }, 1, new Map());
    return root.children.map((c) => c.data.landscapeId).filter(Boolean);
  };
  assert.deepEqual(get([road, place]), [place.id, road.id]);
  road.line = newLine('road');
  assert.deepEqual(get([road, place]), [road.id, place.id]);
  road.line.overSymbols = true;
  assert.deepEqual(get([road, place]), [place.id, road.id]);
});
test('separate retained color strokes never paint a bridge after a failed save', () => {
  const r = brush('ground-color', [{ x: -300, y: 0 }]).record;
  r.paint.target = 'water';
  r.paint.strokes = [[{ x: -300, y: 0 }], [{ x: 300, y: 0 }]];
  r.polygons = r.paint.strokes.flatMap((s) => brushFootprint(s, 100));
  const image = new LandscapeRasterizer({ x: -500, y: -150, width: 1000, height: 300 }, 100, 30);
  image.paintColor(r);
  const pixels = image.finish();
  assert.equal(pixels[(15 * 100 + 50) * 4 + 3], 0);
  assert(pixels[(15 * 100 + 20) * 4 + 3] > 0);
  assert(pixels[(15 * 100 + 80) * 4 + 3] > 0);
});
test('very long and narrow styled roads stay bounded in overview and numeric geometry', () => {
  for (const style of ['dashed', 'arrows', 'rail']) {
    const r = {
      ...line(),
      points: [
        { x: -2e7, y: 0 },
        { x: 2e7, y: 0 },
      ],
      width: 0.05,
      line: { ...newLine('road'), style },
    };
    assert(lineParts(r).length <= 2001);
    const image = new LandscapeRasterizer({ x: -50, y: -50, width: 100, height: 100 }, 32, 32);
    image.paintRecordLine(r);
    assert.equal(image.finish().length, 4096);
  }
});

test('flow accumulates within a stroke while opacity caps the whole stroke', () => {
  const render = (opacity, flow) => {
    const r = brush('ground-color', [
      { x: -60, y: 0 },
      { x: 60, y: 0 },
      { x: -60, y: 0 },
    ]).record;
    r.paint = { ...r.paint, target: 'water', tip: 'round', opacity, flow };
    r.polygons = brushFootprint(r.points, 100);
    const image = new LandscapeRasterizer({ x: -200, y: -200, width: 400, height: 400 }, 40, 40);
    image.paintColor(r);
    return image.finish()[(20 * 40 + 20) * 4 + 3];
  };
  assert(render(0.5, 1) <= 128);
  assert(render(1, 0.5) > render(0.5, 1));
  assert(render(1, 0.1) < render(1, 1));
});

test('archive restore rejects unknown curve/brush versions before publishing a campaign', async (t) => {
  const f = fixture(t);
  f.write({ kind: 'landscape-put', record: line(), expectedRevision: null });
  const copy = f.dir + '/future.sqlite';
  await f.store.campaignSnapshot(f.token, copy);
  const Database = require('better-sqlite3'),
    db = new Database(copy);
  db.prepare("UPDATE atlas_landscape SET payload=json_set(payload,'$.line.version',99)").run();
  db.close();
  const before = f.store.list();
  assert.throws(() => f.store.acceptCampaignSnapshot(copy, 'Zukunft', {}), /prüfen/);
  assert.deepEqual(f.store.list(), before);
});

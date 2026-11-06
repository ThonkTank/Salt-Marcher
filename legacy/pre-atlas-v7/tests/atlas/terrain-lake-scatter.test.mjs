import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
buildSync({
  stdin: {
    contents: `export {receiveTimedBrushInput} from './src/app/atlas/landscape-brush-session';export * from './src/app/atlas/terrain-lake-scatter';export * from './src/app/atlas/terrain-route';export * from './src/app/atlas/terrain-route-planner';export * from './src/app/atlas/landscape-line';
export * from './src/app/atlas/terrain-lake-brush';export * from './src/app/atlas/terrain-height';
export * from './src/app/atlas/terrain-brush';export * from './src/app/atlas/terrain-brush-draft';
export * from './src/app/atlas/terrain-spatial-model';export * from './src/app/storage/store';
export {contains} from './src/app/atlas/landscape-geometry';`,
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-lake-scatter-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const api = createRequire(import.meta.url)('../../.build/terrain-lake-scatter-test.cjs');
const {
  applyLakeBrush,
  mergeLakeBrush,
  prepareLakeScatter,
  heightRecord,
  decodeHeights,
  TerrainSampler,
  CampaignStore,
  TerrainBrushDraft,
  terrainGrid,
  contains,
} = api;
const stroke = (extra = {}) => ({
  id: 'scatter',
  mode: 'scatter',
  radius: 75,
  strength: 2,
  feather: 0.8,
  noise: 0.5,
  seed: 123456,
  waterLevelM: null,
  samples: [
    { x: 0, y: 0, t: 0 },
    { x: 0, y: 0, t: 1000 },
  ],
  ...extra,
});
const plane = (offset = { x: 0, y: 0 }, fn = (x, y) => 20 + 0.02 * x + 0.01 * y) =>
  [-1, 0].flatMap((y) =>
    [-1, 0].map((x) =>
      heightRecord(
        offset.x + x * 512,
        offset.y + y * 512,
        8,
        Float32Array.from({ length: 4096 }, (_, i) =>
          fn(x * 512 + (i % 64) * 8, y * 512 + Math.floor(i / 64) * 8),
        ),
      ),
    ),
  );
const edit = (records, s) => mergeLakeBrush(records, applyLakeBrush(records, s));
const lakes = (records) => records.filter((r) => r.lakeBed);
const clean = (rs) =>
  rs.map(({ revision, order, ...r }) => r).sort((a, b) => a.id.localeCompare(b.id));
const area = (ps) =>
  ps.reduce(
    (sum, p) =>
      sum +
      Math.abs(
        p.outer.reduce((a, p, i, ps) => {
          const q = ps[(i + 1) % ps.length];
          return a + p.x * q.y - q.x * p.y;
        }, 0),
      ) /
        2,
    0,
  );
const duration = (s, t) => ({ ...s, samples: [s.samples[0], { ...s.samples.at(-1), t }] });
test('scatter is deterministic, seed-specific and continuously changes basin size and density with land gaps', () => {
  const source = plane(),
    first = edit(source, stroke());
  assert.deepEqual(edit(source, stroke()), first);
  assert.notDeepEqual(edit(source, stroke({ seed: 123457 })), first);
  const counts = [],
    areas = [];
  for (const noise of [0, 0.5, 1]) {
    const result = lakes(edit(source, stroke({ noise }))),
      sum = result.reduce((n, r) => n + area(r.polygons), 0);
    counts.push(result.length);
    areas.push(sum / result.length);
    assert(sum < Math.PI * 75 * 75 * 0.7, 'The footprint retains dry islands');
    for (const r of result) assert(area(r.polygons) >= 24 * 2 * 2);
  }
  assert(counts[0] < counts[1] && counts[1] < counts[2], JSON.stringify(counts));
  assert(areas[0] > areas[1] && areas[1] > areas[2], JSON.stringify(areas));
});
test('holding and strength only change dose: permanent authors, contours, ownership and source water levels', () => {
  const source = plane(),
    s = stroke(),
    one = edit(source, s),
    three = edit(source, duration(s, 3000)),
    strong = edit(source, { ...s, strength: 6 });
  assert.deepEqual(three, strong);
  assert.deepEqual(
    lakes(one).map((r) => [r.id, r.polygons, r.waterLevelM]),
    lakes(three).map((r) => [r.id, r.polygons, r.waterLevelM]),
  );
  for (const r of one.filter((r) => r.height?.version === 2)) {
    const a = decodeHeights(r.height),
      b = decodeHeights(three.find((v) => v.id === r.id).height);
    for (let i = 0; i < a.length; i++)
      if (Number.isFinite(a[i])) assert(Math.abs(b[i] - 3 * a[i]) < 1e-5);
  }
  const basin = prepareLakeScatter(s).basins.find((b) => contains(b.anchor, b.polygons)),
    existing = {
      id: 'existing',
      revision: 0,
      kind: 'patch',
      name: 'existing',
      points: [],
      polygons: basin.polygons,
      resolution: 2,
      width: 0,
      values: {},
      surface: 'freshwater',
      waterLevelM: 23,
    };
  const withExisting = edit([...source, existing], s);
  assert.equal(withExisting.find((r) => r.id === s.id + ':' + basin.key).waterLevelM, 23);
  for (const r of lakes(edit(source, { ...s, waterLevelM: 17 }))) assert.equal(r.waterLevelM, 17);
});
test('identical timed paths with sparse, dense or redundant hold observations are byte-identical', () => {
  const source = plane(),
    s = stroke({
      samples: [
        { x: -80, y: -40, t: 0 },
        { x: 80, y: 40, t: 1000 },
      ],
    }),
    dense = {
      ...s,
      samples: Array.from({ length: 121 }, (_, i) => ({
        x: -80 + (i * 160) / 120,
        y: -40 + (i * 80) / 120,
        t: (i * 1000) / 120,
      })),
    };
  assert.deepEqual(edit(source, s), edit(source, dense));
  const held = stroke({
    samples: Array.from({ length: 121 }, (_, i) => ({ x: 0, y: 0, t: (i * 3000) / 120 })),
  });
  assert.deepEqual(edit(source, duration(stroke(), 3000)), edit(source, held));
});
test('author tile seams, negative and high coordinates neither move candidates nor duplicate excavation', () => {
  for (const point of [
    { x: -128, y: -128 },
    { x: 128, y: 0 },
    { x: 18000384, y: -9000448 },
  ]) {
    const s = stroke({
        samples: [
          { ...point, t: 0 },
          { ...point, t: 1000 },
        ],
      }),
      rs = edit([], s),
      owners = new Map();
    for (const lake of lakes(rs))
      for (const bed of lake.lakeBed) {
        const amounts = decodeHeights(bed.tile);
        for (let i = 0; i < amounts.length; i++)
          if (amounts[i]) {
            const key = bed.tileId + ':' + i;
            assert(!owners.has(key), 'An excavation node has exactly one stable basin owner');
            owners.set(key, amounts[i]);
            const p = {
              x: bed.tile.x + (i % 64) * bed.tile.pixel,
              y: bed.tile.y + Math.floor(i / 64) * bed.tile.pixel,
            };
            assert(
              contains(p, lake.polygons),
              'Owned excavation lies inside its actual water author',
            );
          }
      }
    for (const r of rs.filter((r) => r.height)) {
      const v = decodeHeights(r.height);
      for (let i = 0; i < v.length; i++)
        if (Number.isFinite(v[i]) && v[i]) assert.equal(v[i], owners.get(r.id + ':' + i));
    }
    assert(owners.size > 100);
  }
});
test('partial and full erasure retain later independent height edits without duplicate fill', () => {
  const source = plane(),
    dug = edit(source, stroke({ noise: 1 })),
    lift = {
      mode: 'raise',
      radius: 130,
      strength: 4,
      feather: 0,
      samples: [
        { x: 0, y: 0, t: 0 },
        { x: 0, y: 0, t: 1000 },
      ],
    },
    lifted = mergeLakeBrush(dug, { records: api.applyTerrainBrush(dug, lift), remove: [] }),
    erase = {
      id: 'erase',
      mode: 'erase',
      radius: 24,
      strength: 2,
      feather: 0,
      waterLevelM: 20,
      samples: stroke().samples,
    },
    partial = edit(lifted, erase),
    restored = edit(partial, { ...erase, radius: 100 });
  assert(lakes(partial).length);
  assert(!lakes(restored).length);
  const expected = mergeLakeBrush(source, {
      records: api.applyTerrainBrush(source, lift),
      remove: [],
    }),
    sampler = new TerrainSampler(restored, false),
    before = new TerrainSampler(expected, false);
  for (let y = -80; y <= 80; y += 8)
    for (let x = -80; x <= 80; x += 8)
      assert(Math.abs(sampler.sample({ x, y }).heightM - before.sample({ x, y }).heightM) < 1e-4);
  assert.deepEqual(edit(restored, { ...erase, radius: 100 }), restored);
});
test('live author draft uses the same source, seed, automatic levels and exact height nodes', () => {
  const records = plane(),
    view = {
      box: { x: -120, y: -120, width: 240, height: 240 },
      frame: { x: -120, y: -120, width: 240, height: 240 },
      columns: 65,
      rows: 65,
      focusM: 20,
      tilt: 0,
      rotation: 0,
      exaggeration: 1,
    },
    base = terrainGrid(records, view);
  base.editing = {
    author: { records },
    ground: base.heights.slice(),
    water: new Float32Array(base.heights.length),
  };
  const draft = new TerrainBrushDraft(base),
    s = stroke();
  const checkGrid = () => {
    const sampler = new TerrainSampler(draft.records, false),
      water = new TerrainSampler(draft.records);
    for (let y = 0; y < view.rows; y++)
      for (let x = 0; x < view.columns; x++) {
        const i = y * view.columns + x,
          p = {
            x: view.box.x + (x * view.box.width) / (view.columns - 1),
            y: view.box.y + (y * view.box.height) / (view.rows - 1),
          };
        assert(
          Math.abs(draft.ground[i] - sampler.sample(p).heightM) < 1e-5,
          'Changed support and interpolation halo agree with canonical heights',
        );
        assert.equal(
          draft.grid.editing.water[i],
          Math.fround(Math.max(0, water.waterLevel(p, -Infinity) ?? -Infinity)),
        );
      }
  };
  assert(draft.update(s));
  assert.deepEqual(draft.records, edit(records, s));
  checkGrid();
  assert(
    draft.update({
      ...duration(s, 3000),
      samples: [s.samples[0], s.samples[1], { x: 0, y: 0, t: 3000 }],
    }),
  );
  assert.deepEqual(draft.records, edit(records, duration(s, 3000)));
  checkGrid();
});
test('invalid scatter parameters reject without mutating source', () => {
  const source = plane(),
    before = structuredClone(source);
  for (const extra of [
    { seed: -1 },
    { seed: 2 ** 32 },
    { seed: 0.5 },
    { noise: -0.01 },
    { noise: 1.01 },
    { noise: NaN },
    { waterLevelM: undefined },
  ])
    assert.throws(() => applyLakeBrush(source, stroke(extra)));
  assert.deepEqual(source, before);
});
test('all scattered basins commit atomically in one history step; retry, undo, redo and Fresh preserve the exact authors', (t) => {
  const dir = mkdtempSync('/tmp/lake-scatter-history-');
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  let store = new CampaignStore(dir + '/workbench.sqlite');
  t.after(() => store.close());
  const cam = store.create('scatter'),
    active = store.activate(cam.id),
    write = (action) =>
      store.executeAtlasCommit({
        commandId: randomUUID(),
        campaignId: cam.id,
        token: active.token,
        action,
      }),
    read = () =>
      store.db
        .prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=?')
        .all(cam.id)
        .map((r) => JSON.parse(r.payload)),
    cursor = () =>
      store.db.prepare('SELECT cursor FROM campaign_atlas WHERE campaign_id=?').get(cam.id).cursor;
  for (const record of plane()) write({ kind: 'landscape-put', record, expectedRevision: null });
  const initial = clean(read()),
    at = cursor(),
    s = stroke();
  store.db.exec(
    "CREATE TEMP TRIGGER fail_scatter BEFORE INSERT ON atlas_landscape WHEN json_extract(NEW.payload,'$.surface')='freshwater' BEGIN SELECT RAISE(ABORT,'controlled scatter failure'); END",
  );
  assert.throws(
    () => write({ kind: 'landscape-lake-stroke', stroke: s }),
    /controlled scatter failure/,
  );
  assert.deepEqual(clean(read()), initial);
  assert.equal(cursor(), at);
  store.db.exec('DROP TRIGGER fail_scatter');
  const command = {
    commandId: randomUUID(),
    campaignId: cam.id,
    token: active.token,
    action: { kind: 'landscape-lake-stroke', stroke: s },
  };
  store.executeAtlasCommit(command);
  const saved = clean(read());
  assert.equal(cursor(), at + 1);
  assert.deepEqual(saved, clean(edit(initial, s)));
  store.executeAtlasCommit(command);
  assert.equal(cursor(), at + 1);
  assert.deepEqual(clean(read()), saved);
  write({ kind: 'undo' });
  assert.equal(cursor(), at);
  assert.deepEqual(clean(read()), initial);
  write({ kind: 'redo' });
  assert.deepEqual(clean(read()), saved);
  store.close();
  store = new CampaignStore(dir + '/workbench.sqlite');
  assert.deepEqual(clean(read()), saved);
  assert.equal(cursor(), at + 1);
});

test('protected river rejects conflicting scatter without source or canonical history mutation', (t) => {
  const source = plane({ x: 0, y: 0 }, (x) => 30 - 0.05 * x),
    s = stroke({ noise: 0, strength: 200 }),
    basin = prepareLakeScatter(s).basins.find(
      (b) => contains(b.anchor, b.polygons) && Math.abs(b.anchor.x) < 50,
    ),
    p = basin.anchor,
    points = [{ x: p.x - 80, y: p.y }, { ...p }, { x: p.x + 80, y: p.y }],
    request = {
      id: 'protected-river',
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
  request.route.limits.corridor = 1;
  request.route.limits.cut = 2;
  const river = api.planRoute(source, request),
    before = [...source, river],
    snapshot = structuredClone(before);
  assert.throws(() => applyLakeBrush(before, s), /geschützten|Abfluss|Eingriffsgrenzen|Verlauf/);
  assert.deepEqual(before, snapshot);
  const dir = mkdtempSync('/tmp/lake-scatter-protection-'),
    store = new CampaignStore(dir + '/workbench.sqlite');
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const cam = store.create('protected'),
    active = store.activate(cam.id),
    write = (action) =>
      store.executeAtlasCommit({
        commandId: randomUUID(),
        campaignId: cam.id,
        token: active.token,
        action,
      }),
    read = () =>
      store.db
        .prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? ORDER BY id')
        .all(cam.id)
        .map((r) => JSON.parse(r.payload)),
    cursor = () =>
      store.db.prepare('SELECT cursor FROM campaign_atlas WHERE campaign_id=?').get(cam.id).cursor;
  for (const record of source) write({ kind: 'landscape-put', record, expectedRevision: null });
  write({
    kind: 'landscape-route',
    record: request,
    expectedRevision: null,
    sourceRevision: store.atlasIdentity(active.token).revision,
  });
  const saved = read(),
    at = cursor();
  assert.throws(
    () => write({ kind: 'landscape-lake-stroke', stroke: s }),
    /geschützten|Abfluss|Eingriffsgrenzen|Verlauf/,
  );
  assert.deepEqual(read(), saved);
  assert.equal(cursor(), at);
});

test('received input corrects delayed RAF holding to the real path and release without event-density changes', () => {
  const path = [
      { x: -80, y: -40, t: 0 },
      { x: -80, y: -40, t: 300 },
      { x: -80, y: -40, t: 1200 },
    ],
    index = api.receiveTimedBrushInput(path, 0, { x: 80, y: 40 }, 1000),
    s = stroke({ samples: path });
  assert.equal(index, 3);
  assert.equal(path.length, 4);
  assert.deepEqual(path[2], { x: 80, y: 40, t: 1000 });
  const sparse = stroke({ samples: [path[0], path.at(-1)] });
  assert.deepEqual(applyLakeBrush(plane(), s), applyLakeBrush(plane(), sparse));
  path.push({ x: 80, y: 40, t: 2020.4 });
  api.receiveTimedBrushInput(path, index, { x: 80, y: 40 }, 1996);
  assert.equal(path.at(-1).t, 1996);
  assert(path.every((p) => p.t <= 1996));
  assert.deepEqual(
    applyLakeBrush(plane(), stroke({ samples: path })),
    applyLakeBrush(
      plane(),
      stroke({ samples: [path[0], { x: 80, y: 40, t: 1000 }, { x: 80, y: 40, t: 1996 }] }),
    ),
  );
});

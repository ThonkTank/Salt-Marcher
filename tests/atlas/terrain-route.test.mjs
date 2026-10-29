import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  riverAnchors,
  riverTerrain,
  riverSamples,
  riverRidgeTerrain,
} from '../helpers/river-terrain.mjs';
const cache = homedir() + '/.cache/saltmarcher';
mkdirSync(cache, { recursive: true });
buildSync({
  stdin: {
    contents: `export * from './src/app/atlas/terrain-route';export * from './src/app/atlas/terrain-route-planner';export * from './src/app/atlas/atlas-route-geometry';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/terrain-brush';export * from './src/app/atlas/terrain-lake-coupling';export * from './src/app/atlas/landscape-line';export * from './src/app/atlas/atlas-landscape';export * from './src/app/atlas/spatial-terrain';export * from './src/app/storage/store';export * from './src/app/storage/atlas-landscape-region';export * from './src/app/storage/atlas-region';export * from './src/app/storage/atlas-terrain-tiles';export * from './src/app/storage/atlas-material-tiles';`,
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-route-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const api = createRequire(import.meta.url)('../../.build/terrain-route-test.cjs');
const {
  emptyRecord,
  heightRecord,
  TerrainSampler,
  routeSpec,
  planRoute,
  linePoints,
  applyCoupledTerrainBrush: applyTerrainBrush,
  decodeHeights,
  CampaignStore,
  atlasRouteGeometry,
  replanRoutes,
  routeBounds,
} = api;
const terrain = (fn = () => 60) =>
  [-1, 0].flatMap((y) =>
    [-1, 0].map((x) =>
      heightRecord(
        x * 512,
        y * 512,
        8,
        Float32Array.from({ length: 4096 }, (_, i) =>
          fn(x * 512 + (i % 64) * 8, y * 512 + Math.floor(i / 64) * 8),
        ),
      ),
    ),
  );
const route = (
  kind = 'road',
  points = [
    { x: -200, y: 0 },
    { x: 200, y: 0 },
  ],
) => ({
  ...emptyRecord(kind),
  id: randomUUID(),
  name: 'Probe',
  width: kind === 'road' ? 6 : 12,
  line: api.newLine(kind),
  points,
  route: routeSpec(kind, points),
});
const brush = (x = 0, y = 0, strength = 120) => ({
  mode: 'raise',
  radius: 40,
  strength,
  feather: 0.5,
  roughness: 0,
  seed: 1,
  samples: [
    { x, y, t: 0 },
    { x, y, t: 1000 },
  ],
});
const merge = (before, changes) => {
  const ids = new Set(changes.map((r) => r.id));
  return [...before.filter((r) => !ids.has(r.id)), ...changes];
};
test('joint lake lift replans its river mouth at the new level; impossible protected connection rejects atomically', (t) => {
  const lake = {
    ...emptyRecord('patch'),
    id: 'joint-lake',
    surface: 'freshwater',
    waterLevelM: 20,
    points: [],
    polygons: [
      {
        outer: [
          { x: 176, y: -24 },
          { x: 224, y: -24 },
          { x: 224, y: 24 },
          { x: 176, y: 24 },
        ],
        holes: [],
      },
    ],
  };
  const base = [...terrain((x) => 20 + (200 - x) * 0.02), lake],
    input = route('river');
  input.route.mouth = { id: lake.id, point: { x: 200, y: 0 } };
  const river = planRoute(base, input),
    source = [...base, river],
    before = structuredClone(source),
    stroke = { ...brush(0, 0, 4), radius: 1024, feather: 0.5 },
    changes = applyTerrainBrush(source, stroke),
    lifted = merge(source, changes),
    liftedRiver = lifted.find((r) => r.id === river.id);
  assert.equal(lifted.find((r) => r.id === lake.id).waterLevelM, 24);
  assert.equal(liftedRiver.route.nodes.at(-1).z, 24);
  assert(!liftedRiver.route.conflict);
  assert.deepEqual(source, before);
  const impossible = { ...brush(200, 0, 40), radius: 96, feather: 0 };
  assert.throws(() => applyTerrainBrush(source, impossible), /Abfluss|Eingriffsgrenzen|Verlauf/);
  assert.deepEqual(source, before);
  const f = fixture(t, base);
  f.put(input);
  const saved = f.records(),
    cursor = f.store.db
      .prepare('SELECT cursor FROM campaign_atlas WHERE campaign_id=?')
      .get(f.cam.id).cursor;
  assert.throws(
    () => f.write({ kind: 'landscape-height-stroke', stroke: impossible }),
    /Abfluss|Eingriffsgrenzen|Verlauf/,
  );
  assert.deepEqual(f.records(), saved);
  assert.equal(
    f.store.db.prepare('SELECT cursor FROM campaign_atlas WHERE campaign_id=?').get(f.cam.id)
      .cursor,
    cursor,
  );
  f.write({ kind: 'landscape-height-stroke', stroke });
  assert.equal(f.records().find((r) => r.id === lake.id).waterLevelM, 24);
  assert.equal(
    f
      .records()
      .find((r) => r.id === river.id)
      .route.nodes.at(-1).z,
    24,
  );
});
test('planned curves preserve mandatory points and produce deterministic geometry', () => {
  const base = terrain((x, y) => 60 + 30 * Math.exp(-(x * x + y * y) / 3000)),
    r = route('road', [
      { x: -200, y: 0 },
      { x: 0, y: 100 },
      { x: 200, y: 0 },
    ]);
  const a = planRoute(base, r),
    b = planRoute(base, r);
  assert.deepEqual(a, b);
  for (const p of r.points)
    assert(a.route.nodes.some((n) => Math.hypot(n.x - p.x, n.y - p.y) < 1e-6));
  assert.deepEqual(
    linePoints(a),
    a.route.nodes.map(({ x, y }) => ({ x, y })),
  );
  for (let i = 1; i < a.route.nodes.length; i++) {
    const p = a.route.nodes[i - 1],
      q = a.route.nodes[i];
    assert(Math.abs(q.z - p.z) <= Math.hypot(q.x - p.x, q.y - p.y) * a.route.limits.grade + 1e-6);
  }
});
test('river surface descends and owns a removable bed without changing base bytes', () => {
  const base = terrain((x) => 60 - x * 0.02),
    r = planRoute(base, route('river')),
    before = JSON.stringify(base);
  const raw = new TerrainSampler(base),
    effective = new TerrainSampler([...base, r]);
  for (let i = 1; i < r.route.nodes.length; i++)
    assert(r.route.nodes[i].z < r.route.nodes[i - 1].z);
  const node = r.route.nodes[Math.floor(r.route.nodes.length / 2)];
  assert(effective.sample(node).heightM < raw.sample(node).heightM);
  assert.equal(effective.waterLevel(node), node.z);
  assert.equal(JSON.stringify(base), before);
  assert.equal(new TerrainSampler(base).sample(node).heightM, raw.sample(node).heightM);
});
test('sea mouth keeps the excavation budget instead of replacing its interval', () => {
  const base = riverTerrain(api),
    r = route('river', riverAnchors);
  r.route.limits.cut = 0.25;
  const end = new TerrainSampler(base, false).sample(riverAnchors.at(-1)).heightM;
  assert(Math.abs(end + 1) < 1e-6);
  assert(
    end - r.route.limits.cut + r.route.limits.depth > 0,
    'the 0m sea level is outside the allowed mouth interval',
  );
  assert.throws(() => planRoute(base, r), /Abfluss.*Eingriffsgrenzen/);
});
for (const depression of [0, 4, 12])
  test(`river crosses ${depression}m trough with real interpolated bed and water`, () => {
    const base = riverTerrain(api, depression),
      request = route('river', riverAnchors);
    if (depression === 12) {
      const raw = new TerrainSampler(base, false),
        low = raw.sample({ x: 0, y: 0 }).heightM + request.route.limits.depth,
        saddle =
          raw.sample({ x: 40, y: 0 }).heightM -
          request.route.limits.cut +
          request.route.limits.depth;
      assert(
        saddle > low,
        'mandatory trough upper bound collides with downstream lower bound across full corridor',
      );
      assert.throws(() => planRoute(base, request), /Abfluss.*Eingriffsgrenzen/);
      request.route.limits.cut = 16;
    }
    const before = JSON.stringify(base),
      river = planRoute(base, request),
      samples = riverSamples(api, base, river),
      tolerance = 1e-5;
    for (const p of riverAnchors) assert(river.route.nodes.some((n) => n.x === p.x && n.y === p.y));
    assert.equal(river.route.nodes.at(-1).z, 0);
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      assert(Math.abs(p.water - p.profile) < tolerance, JSON.stringify(p));
      assert(
        p.station === 0 ? p.bed <= p.water + tolerance : p.bed < p.water - tolerance,
        `dry bed: ${JSON.stringify(p)}`,
      );
      assert(p.base - p.bed <= request.route.limits.cut + tolerance, JSON.stringify(p));
      assert(p.bed - p.base <= tolerance, JSON.stringify(p));
      if (i) assert(p.water < samples[i - 1].water, JSON.stringify(p));
    }
    assert.equal(JSON.stringify(base), before);
  });
test('a fine terrain ridge between profile nodes cannot hide a dry gap', () => {
  const base = riverRidgeTerrain(api),
    request = route('river', riverAnchors),
    before = JSON.stringify(base);
  assert.throws(() => planRoute(base, request), /Abfluss/);
  assert.equal(JSON.stringify(base), before);
  request.route.limits.cut = 16;
  const river = planRoute(base, request),
    samples = riverSamples(api, base, river, 0.05);
  assert(samples.every((p) => p.station === 0 || p.bed < p.water - 1e-5));
  assert(samples.every((p) => p.base - p.bed <= 16 + 1e-5 && p.bed - p.base <= 1e-5));
  assert(samples.every((p, i) => !i || p.water < samples[i - 1].water));
});
test('a feasible fine crest near the tapered source is refined without a dry gap', () => {
  const base = riverRidgeTerrain(api, -159, 8.01),
    request = route('river', riverAnchors),
    river = planRoute(base, request),
    samples = riverSamples(api, base, river, 0.01);
  assert(
    river.route.nodes.some((p) => Math.abs(p.x + 159) < 1e-8),
    'the canonical ridge node becomes a profile constraint',
  );
  assert(samples.every((p) => p.station === 0 || p.bed < p.water - 1e-5));
  assert(samples.every((p) => p.base - p.bed <= 8 + 1e-5 && p.bed - p.base <= 1e-5));
  assert(samples.every((p, i) => !i || p.water < samples[i - 1].water));
  assert.equal(river.route.limits.cut, 8, 'no silent budget increase');
  assert.deepEqual(
    planRoute([...base, river], river, true),
    river,
    'canonical replanning retains the refined profile',
  );
});
test('uphill river beyond cut budget is refused instead of drawn uphill', () => {
  const r = route('river');
  r.route.limits.cut = 2;
  assert.throws(
    () =>
      planRoute(
        terrain((x) => 60 + x * 0.2),
        r,
      ),
    /Abfluss/,
  );
});
test('tributary snaps to downstream water height and cycles are rejected', () => {
  const base = terrain((x) => 60 - x * 0.02),
    main = planRoute(base, route('river')),
    side = route('river', [
      { x: -160, y: 80 },
      { x: 0, y: 0 },
    ]);
  side.route.mouth = { id: main.id, point: { x: 0, y: 0 } };
  const branch = planRoute([...base, main], side);
  assert(
    Math.abs(branch.route.nodes.at(-1).z - api.nearestRoute(main.route.nodes, { x: 0, y: 0 }).z) <
      1e-6,
  );
  const cycle = structuredClone(main);
  cycle.route.mouth = { id: branch.id, point: branch.route.nodes[0] };
  assert.throws(() => replanRoutes([...base, cycle, branch]), /Kreis/);
});
test('protected brush edits are local, jointly valid and independent of preview count', () => {
  const base = terrain(),
    request = route();
  request.route.limits.corridor = 1;
  request.route.sections = ['ground'];
  const r = planRoute(base, request),
    before = [...base, r],
    stroke = brush();
  const a = applyTerrainBrush(before, stroke),
    b = applyTerrainBrush(before, stroke);
  assert.deepEqual(a, b);
  const after = merge(before, a),
    updated = after.find((x) => x.id === r.id);
  assert(!updated.route.conflict);
  assert.deepEqual(updated.route.anchors, r.route.anchors);
  assert(new TerrainSampler(after, false).sample({ x: 0, y: 0 }).heightM < 180);
  assert.equal(new TerrainSampler(after, false).sample({ x: 300, y: 300 }).heightM, 60);
});
test('disabling protection keeps the full edit and marks impossible routes', () => {
  const base = terrain(),
    r = planRoute(base, route('river'));
  r.route.protected = false;
  r.route.limits.corridor = 1;
  const after = merge([...base, r], applyTerrainBrush([...base, r], brush()));
  assert(new TerrainSampler(after, false).sample({ x: 0, y: 0 }).heightM > 170);
  assert(after.find((x) => x.id === r.id).route.conflict);
});
test('tunnels preserve the mountain surface and bridges have elevated decks', () => {
  const base = terrain((x) => 60 + 80 * Math.exp((-x * x) / 2000)),
    r = route();
  r.route.sections = ['tunnel'];
  const tunnel = planRoute(base, r);
  assert(tunnel.route.nodes.some((n) => n.structure === 'tunnel'));
  assert.equal(
    new TerrainSampler([...base, tunnel]).sample({ x: 0, y: 0 }).heightM,
    new TerrainSampler(base).sample({ x: 0, y: 0 }).heightM,
  );
  const bridge = route();
  bridge.route.sections = ['bridge'];
  const planned = planRoute(terrain(), bridge);
  assert(planned.route.nodes.some((n) => n.z >= 64));
  assert.equal(new TerrainSampler([...terrain(), planned]).sample({ x: 0, y: 0 }).heightM, 60);
});
test('legacy curved styles and terrain edge heights survive 3D meshing', () => {
  const r = route();
  delete r.route;
  r.points = [
    { x: -60, y: 0 },
    { x: 0, y: 30 },
    { x: 60, y: 0 },
  ];
  r.line.style = 'dashed';
  r.line.roughness = 0;
  const meshes = atlasRouteGeometry(r, (p) => p.x * 0.1 + p.y * 0.5, { x: 0, y: 0, z: 0 }, 1, 2);
  assert(meshes.length);
  let vertices = 0;
  for (const mesh of meshes) {
    const pos = mesh.positions;
    vertices += pos.length / 3;
    for (let i = 0; i < pos.length; i += 3)
      assert(Math.abs(pos[i + 2] - (pos[i] * 0.1 + pos[i + 1] * 0.5 + 0.025)) < 1e-4);
  }
  assert(vertices > 12);
});
function fixture(t, source = terrain((x) => 60 - x * 0.02)) {
  const dir = mkdtempSync(cache + '/route-store-'),
    store = new CampaignStore(dir + '/world.sqlite'),
    cam = store.create('Verläufe'),
    active = store.activate(cam.id);
  const write = (action) =>
    store.executeAtlasCommit({
      commandId: randomUUID(),
      campaignId: cam.id,
      token: active.token,
      action,
    });
  for (const r of source) write({ kind: 'landscape-put', record: r, expectedRevision: null });
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const records = () =>
    store.db
      .prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? ORDER BY id')
      .all(cam.id)
      .map((r) => JSON.parse(r.payload));
  return {
    dir,
    store,
    cam,
    token: active.token,
    write,
    records,
    put: (r) =>
      write({
        kind: 'landscape-route',
        record: r,
        expectedRevision: r.revision || null,
        sourceRevision: store.atlasIdentity(active.token).revision,
      }),
  };
}
test('preview, save, undo, redo, deletion and fresh process preserve exact base terrain', (t) => {
  const f = fixture(t),
    r = route('river'),
    box = { x: -260, y: -100, width: 520, height: 200 },
    base = f.records();
  const preview = f.store.atlasSpatialScene(f.token, box, 1, {
    kind: 'landscape-route',
    record: r,
  });
  assert.deepEqual(f.records(), base);
  f.put(r);
  const saved = f.store.atlasSpatialScene(f.token, box, 1);
  assert.deepEqual(saved.grid, preview.grid);
  const current = f.records().find((x) => x.id === r.id);
  const Database = createRequire(import.meta.url)('better-sqlite3'),
    db = new Database(f.dir + '/world.sqlite', { readonly: true });
  try {
    const reader = new api.AtlasLandscapeReader(db),
      source = f.store.atlasRegionSource(f.token);
    reader.sync(source);
    const projected = reader
      .read(
        source,
        {
          box,
          width: 256,
          height: 128,
          scopeId: null,
          floorId: 'ground',
          slice: null,
          roofs: true,
        },
        2 * 1024 * 1024,
      )
      .records.find((x) => x.id === r.id);
    assert.deepEqual(
      projected.route,
      current.route,
      'bounded 2D projection must keep the planned curve and profile',
    );
  } finally {
    db.close();
  }
  assert.equal(f.store.atlasHeight(f.token, { x: 0, y: 0 }).water, true);
  f.write({ kind: 'undo' });
  assert.deepEqual(f.records(), base);
  f.write({ kind: 'redo' });
  assert.deepEqual(f.store.atlasSpatialScene(f.token, box, 1).grid, saved.grid);
  const reopened = new CampaignStore(f.dir + '/world.sqlite');
  assert(reopened.db.prepare('SELECT payload FROM atlas_landscape WHERE id=?').get(r.id));
  reopened.close();
  f.write({
    kind: 'landscape-remove',
    id: r.id,
    expectedRevision: f.records().find((x) => x.id === r.id).revision,
  });
  assert.deepEqual(
    f.records().filter((x) => x.height),
    base.filter((x) => x.height),
  );
});
test('sea river rejects impossible budgets atomically and keeps the corrected draft through history and reopen', (t) => {
  const f = fixture(t, riverTerrain(api, 12)),
    request = route('river', riverAnchors),
    base = f.records(),
    box = { x: -200, y: -40, width: 660, height: 80 },
    history = () =>
      f.store.db.prepare('SELECT cursor FROM campaign_atlas WHERE campaign_id=?').get(f.cam.id)
        .cursor,
    beforeCursor = history();
  assert.throws(() => f.put(request), /Abfluss.*Eingriffsgrenzen/);
  assert.deepEqual(f.records(), base);
  assert.equal(history(), beforeCursor);
  request.route.limits.cut = 16;
  const preview = f.store.atlasSpatialScene(f.token, box, 1, {
    kind: 'landscape-route',
    record: request,
  });
  assert.deepEqual(f.records(), base);
  assert.equal(history(), beforeCursor);
  f.put(request);
  const saved = f.records(),
    river = saved.find((r) => r.id === request.id),
    samples = riverSamples(api, base, river);
  assert.equal(history(), beforeCursor + 1);
  assert.equal(river.route.nodes.at(-1).z, 0);
  assert.deepEqual(f.store.atlasSpatialScene(f.token, box, 1).grid, preview.grid);
  f.write({ kind: 'undo' });
  assert.deepEqual(f.records(), base);
  assert.equal(history(), beforeCursor);
  f.write({ kind: 'redo' });
  assert.deepEqual(
    riverSamples(
      api,
      base,
      f.records().find((r) => r.id === request.id),
    ),
    samples,
  );
  const reopened = new CampaignStore(f.dir + '/world.sqlite');
  try {
    const restored = JSON.parse(
      reopened.db.prepare('SELECT payload FROM atlas_landscape WHERE id=?').get(request.id).payload,
    );
    assert.deepEqual(restored.route, river.route);
    assert.deepEqual(riverSamples(api, base, restored), samples);
    assert.deepEqual(
      f.records().filter((r) => r.height),
      base.filter((r) => r.height),
    );
  } finally {
    reopened.close();
  }
});
test('retained terrain tiles include a newly planned river and match fresh worker reads', async (t) => {
  const f = fixture(t, riverTerrain(api)),
    Database = createRequire(import.meta.url)('better-sqlite3');
  let db = new Database(f.dir + '/world.sqlite', { readonly: true }),
    reader = new api.AtlasRegionReader(db),
    tiles = new api.AtlasTerrainTiles(db, f.dir + '/cache'),
    materials = new api.AtlasMaterialTiles(db, f.dir + '/cache'),
    cursor;
  const read = async () => {
    cursor = f.store.atlasRegionSource(f.token, cursor);
    await reader.sync(cursor, false);
    const steps = tiles.read(
      cursor,
      { tile: { lod: 1, x: 0, y: 0 }, revision: cursor.revision, product: 'height' },
      reader,
    );
    let projection;
    for (;;) {
      const step = steps.next();
      if (step.done) {
        projection = step.value.projection;
        break;
      }
    }
    cursor = f.store.atlasRegionSource(f.token, cursor);
    await reader.sync(cursor, false);
    const materialSteps = materials.read(
      cursor,
      { tile: { lod: 1, x: 0, y: 0 }, revision: cursor.revision, product: 'surface' },
      reader,
    );
    for (;;) {
      const step = materialSteps.next();
      if (step.done) return { ...projection, material: step.value };
    }
  };
  try {
    const before = await read();
    f.put(route('river', riverAnchors));
    const saved = await read();
    assert.notDeepEqual(
      saved.grid.heights,
      before.grid.heights,
      'banks must appear in the retained worker',
    );
    f.write({ kind: 'undo' });
    assert.deepEqual((await read()).grid.heights, before.grid.heights);
    f.write({ kind: 'redo' });
    const redone = await read();
    assert.deepEqual(redone.grid.heights, saved.grid.heights);
    assert.deepEqual(redone.pixels, saved.pixels);
    assert.deepEqual(
      redone.material.channels.relief,
      saved.material.channels.relief,
      'retained relief material must include restored bed',
    );
    tiles.close();
    materials.close();
    db.close();
    db = new Database(f.dir + '/world.sqlite', { readonly: true });
    reader = new api.AtlasRegionReader(db);
    tiles = new api.AtlasTerrainTiles(db, f.dir + '/cache');
    materials = new api.AtlasMaterialTiles(db, f.dir + '/cache');
    cursor = undefined;
    const fresh = await read();
    assert.deepEqual(fresh.grid.heights, saved.grid.heights);
    assert.deepEqual(fresh.pixels, saved.pixels);
    assert.deepEqual(
      fresh.material.channels.relief,
      saved.material.channels.relief,
      'fresh relief material must include bed',
    );
  } finally {
    tiles.close();
    materials.close();
    db.close();
  }
});
test('stale preview and failed storage never persist part of a coupled command', (t) => {
  const f = fixture(t),
    r = route(),
    revision = f.store.atlasIdentity(f.token).revision,
    before = f.records();
  f.store.db.exec(
    "CREATE TEMP TRIGGER route_failure BEFORE INSERT ON atlas_landscape WHEN json_extract(NEW.payload,'$.route') IS NOT NULL BEGIN SELECT RAISE(ABORT,'route failure'); END",
  );
  assert.throws(() => f.put(r), /route failure/);
  assert.deepEqual(f.records(), before);
  f.store.db.exec('DROP TRIGGER route_failure');
  f.put(r);
  assert.throws(
    () =>
      f.write({
        kind: 'landscape-route',
        record: route(),
        expectedRevision: null,
        sourceRevision: revision,
      }),
    /inzwischen/,
  );
  assert.throws(
    () => f.write({ kind: 'landscape-put', record: r, expectedRevision: null }),
    /Verlaufseditor/,
  );
});
test('protected terrain and route changes share one undo step', (t) => {
  const f = fixture(t);
  f.put(route('river'));
  const before = f.records();
  f.write({ kind: 'landscape-height-stroke', stroke: brush() });
  const clean = (rs) => rs.map(({ revision, ...r }) => r);
  const after = f.records();
  assert.notDeepEqual(after, before);
  f.write({ kind: 'undo' });
  assert.deepEqual(clean(f.records()), clean(before));
  f.write({ kind: 'redo' });
  assert.deepEqual(clean(f.records()), clean(after));
});
test('bounds include deformation support and distant coordinates retain local geometry', () => {
  const r = route();
  const b = routeBounds(r);
  assert(b.x < -300 && b.width > 600);
  const offset = 1e9,
    local = terrain(),
    remote = local.map((r) => ({
      ...r,
      height: { ...r.height, x: r.height.x + offset, y: r.height.y + offset },
    }));
  // Use an aligned origin for height tiles.
  const aligned = 512 * Math.floor(offset / 512),
    far = terrain().map((r) =>
      heightRecord(r.height.x + aligned, r.height.y + aligned, 8, decodeHeights(r.height)),
    );
  const shifted = route(
    'road',
    r.points.map((p) => ({ x: p.x + aligned, y: p.y + aligned })),
  );
  const result = planRoute(far, shifted);
  assert(result.route.nodes.every((p) => Number.isFinite(p.z) && p.z === 60));
});

test('route material samples skip segments outside their physical shoulder inside a shared index cell', () => {
  for (const origin of [0, 18000000, 999999999000]) {
    const r = route('river', [
      { x: origin, y: 0 },
      { x: origin + 128, y: 0 },
    ]);
    let readHeights = 0;
    r.route.nodes = Array.from({ length: 129 }, (_, i) => ({
      x: origin + i,
      y: 0,
      structure: 'ground',
      get z() {
        readHeights++;
        return 30 - i * 0.01;
      },
    }));
    const surface = new api.RouteSurface([r]);
    const before = surface.at({ x: origin + 32, y: -50 }, 40);
    assert.equal(before.height, 40);
    assert.equal(before.water, undefined);
    assert.equal(
      readHeights,
      0,
      'A material texel outside every segment shoulder must not evaluate their height profiles',
    );
    const inside = surface.at({ x: origin + 32, y: -2 }, 40);
    assert(readHeights > 0);
    assert(inside.height < 40);
    assert.equal(inside.water, 29.68);
    const edge = surface.at({ x: origin + 32, y: 26 }, 40);
    assert.equal(edge.height, 40, 'Exact outer shoulder preserves unchanged ground');
  }
});

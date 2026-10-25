import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url),
  Database = require('better-sqlite3');
buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/storage/atlas-region';export * from './src/app/terrain-field-stream';export * from './src/app/terrain-height';export * from './src/app/terrain-route';export * from './src/app/atlas-landscape';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/atlas-geometry-point-sampling-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  AtlasRegionReader,
  streamTerrainFieldBlock,
  heightRecord,
  settingsRecord,
  routeSpec,
  bounds,
} = require('../.build/atlas-geometry-point-sampling-test.cjs');

function fixture(t, records) {
  const base = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/atlas-geometry-point-sampling-'),
    store = new CampaignStore(dir + '/world.sqlite'),
    campaign = store.create('Point sampling'),
    token = store.activateShell(campaign.id).token;
  const insert = store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
  store.db.transaction(() => {
    for (const record of records) {
      const box = bounds(record);
      insert.run(
        campaign.id,
        record.id,
        record.revision,
        box.x,
        box.x + box.width,
        box.y,
        box.y + box.height,
        JSON.stringify(record),
      );
    }
  })();
  const db = new Database(store.filename, { readonly: true }),
    reader = new AtlasRegionReader(db);
  let source;
  t.after(() => {
    db.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    store,
    campaign,
    reader,
    token,
    sync: async (reset = false) => {
      if (reset) source = undefined;
      source = store.atlasRegionSource(token, source);
      await reader.sync(source, false);
      return source;
    },
    get source() {
      return source;
    },
  };
}

function compare(f, points, seaLevelM) {
  const stream = f.reader.landscape.terrainStream(f.source);
  for (const point of points) {
    const x = point.x - 0.5,
      y = point.y - 0.5,
      box = { x, y, width: 1, height: 1 };
    const expected = f.reader.terrainVisibility(f.source, {
      box,
      frame: box,
      columns: 3,
      rows: 3,
      focusM: 0,
      tilt: 0,
      rotation: 0,
      exaggeration: 1,
    }).heights[4];
    assert.equal(
      f.reader.geometryHeight(f.source, point),
      expected,
      'direct full-neighbourhood anchor matches the canonical visibility grid',
    );
    const center = streamTerrainFieldBlock(
      { x, y, dx: 0.5, dy: 0.5, columns: 3, rows: 3 },
      { x: 1, y: 1, width: 1, height: 1 },
      seaLevelM,
      stream,
      true,
    ).surface[0];
    assert.equal(
      center,
      expected,
      `center block must match the canonical 3x3 anchor at ${JSON.stringify(point)}`,
    );
  }
}

const values = (pixel, base) =>
  Float32Array.from({ length: 4096 }, (_, i) =>
    i % 13 === 0 ? NaN : base + Math.sin((i % 64) / 7) * 9 + Math.cos(Math.floor(i / 64) / 11) * 13,
  );
function heightTiles(point, pixel, version, base) {
  const span = 64 * pixel,
    x = Math.floor(point.x / span) * span,
    y = Math.floor(point.y / span) * span;
  return [-1, 0].flatMap((oy) =>
    [-1, 0].map((ox) =>
      heightRecord(x + ox * span, y + oy * span, pixel, values(pixel, base), version),
    ),
  );
}

test('geometry anchors keep exact storage-backed heights across fractional, negative and large coordinates', async (t) => {
  const origin = 2 ** 35,
    points = [
      { x: -0.375, y: -0.125 },
      { x: -64.125, y: -63.75 },
      { x: 31.875, y: 32.125 },
      { x: origin + 0.125, y: -origin - 0.375 },
    ],
    records = [settingsRecord(23)];
  const unique = new Map();
  for (const point of points)
    for (const record of [
      ...heightTiles(point, 8, 1, 45),
      ...heightTiles(point, 1, 1, 60),
      ...heightTiles(point, 4, 2, 7),
    ])
      unique.set(record.id, record);
  records.push(...unique.values());
  const f = fixture(t, records);
  await f.sync();
  compare(f, points, 23);
  const cache = f.reader.landscape.projectionCache,
    seed = cache.seedGrid;
  cache.seedGrid = () => {
    throw Error('One-use geometry anchor must not populate the display raster cache');
  };
  try {
    for (const point of [...points, { x: -0.25, y: -0.25 }])
      assert(Number.isFinite(f.reader.geometryHeight(f.source, point)));
  } finally {
    cache.seedGrid = seed;
  }
  for (const point of [
    { x: NaN, y: 0 },
    { x: Infinity, y: 0 },
    { x: 1e12 + 1, y: 0 },
  ])
    assert.throws(() => f.reader.geometryHeight(f.source, point), /Geländeausschnitt prüfen/);
});

test('center-only block retains route, lake-hole and sea-level effects across a canonical source replacement', async (t) => {
  const points = [
      { x: 0, y: 0 },
      { x: 12.125, y: 0 },
      { x: 20.375, y: 20.125 },
    ],
    roadPoints = [
      { x: -100, y: 0 },
      { x: 100, y: 0 },
    ],
    route = routeSpec('road', roadPoints);
  route.nodes = [
    { ...roadPoints[0], z: 75, structure: 'ground' },
    { ...roadPoints[1], z: 75, structure: 'ground' },
  ];
  const lake = {
    id: 'sampling-lake',
    revision: 0,
    kind: 'patch',
    name: '',
    points: [],
    polygons: [
      {
        outer: [
          { x: 5, y: -8 },
          { x: 35, y: -8 },
          { x: 35, y: 8 },
          { x: 5, y: 8 },
        ],
        holes: [
          [
            { x: 10, y: -2 },
            { x: 15, y: -2 },
            { x: 15, y: 2 },
            { x: 10, y: 2 },
          ],
        ],
      },
    ],
    resolution: 1,
    width: 0,
    values: {},
    surface: 'freshwater',
    waterLevelM: 90,
  };
  const road = {
    id: 'sampling-road',
    revision: 0,
    kind: 'road',
    name: '',
    points: roadPoints,
    polygons: [],
    resolution: 1,
    width: 8,
    values: {},
    route,
  };
  const height = heightTiles({ x: 0, y: 0 }, 1, 1, 40)[0],
    records = [settingsRecord(23), height, ...heightTiles({ x: 0, y: 0 }, 4, 2, 7), road, lake],
    f = fixture(t, records);
  await f.sync();
  compare(f, points, 23);
  const changed = {
      ...height,
      height: {
        ...height.height,
        data: heightRecord(
          height.height.x,
          height.height.y,
          height.height.pixel,
          new Float32Array(4096).fill(120),
        ).height.data,
      },
    },
    box = bounds(changed);
  f.store.db
    .prepare(
      'UPDATE atlas_landscape SET payload=?,min_x=?,max_x=?,min_y=?,max_y=? WHERE campaign_id=? AND id=?',
    )
    .run(
      JSON.stringify(changed),
      box.x,
      box.x + box.width,
      box.y,
      box.y + box.height,
      f.campaign.id,
      height.id,
    );
  await f.sync(true);
  compare(f, points, 23);
});

test('center-only query stops reporting duplicate corruption that the surrounding 3x3 query detects', async (t) => {
  const point = { x: 7.4, y: 0 },
    records = [settingsRecord(0), ...heightTiles(point, 0.125, 1, 40)];
  const adjacent = heightRecord(8, 0, 0.125, new Float32Array(4096).fill(55)),
    duplicate = { ...adjacent, id: 'duplicate-adjacent-height' };
  records.push(adjacent, duplicate);
  const f = fixture(t, records);
  await f.sync();
  assert.throws(() => f.reader.geometryHeight(f.source, point), /Doppelte Höhenkachel/);
  const x = point.x - 0.5,
    y = point.y - 0.5,
    stream = f.reader.landscape.terrainStream(f.source),
    center = streamTerrainFieldBlock(
      { x, y, dx: 0.5, dy: 0.5, columns: 3, rows: 3 },
      { x: 1, y: 1, width: 1, height: 1 },
      0,
      stream,
      true,
    ).surface[0];
  assert.equal(
    Number.isFinite(center),
    true,
    'the center-only query never reads the duplicate tile at the neighboring sample',
  );
});

test('cached geometry anchors follow local edits, history and sea changes in the same reader while distant edits retain them', async (t) => {
  const f = fixture(t, [settingsRecord(0)]),
    point = { x: 32, y: 32 };
  await f.sync();
  let reads = 0;
  const stream = f.reader.landscape.terrainStream.bind(f.reader.landscape);
  f.reader.landscape.terrainStream = (...args) => {
    reads++;
    return stream(...args);
  };
  const read = () => f.reader.geometryHeight(f.source, point),
    write = async (action) => {
      f.store.executeAtlasCommit({
        commandId: randomUUID(),
        campaignId: f.campaign.id,
        token: f.token,
        action,
      });
      await f.sync();
    };
  const original = read();
  assert.equal(read(), original);
  assert.equal(reads, 1);
  await write({
    kind: 'landscape-put',
    expectedRevision: null,
    record: heightRecord(0, 0, 4, new Float32Array(4096).fill(80)),
  });
  assert.equal(read(), 80);
  assert.equal(reads, 2);
  await write({ kind: 'undo' });
  assert.equal(read(), original);
  await write({ kind: 'redo' });
  assert.equal(read(), 80);
  const beforeDistant = reads;
  await write({
    kind: 'landscape-put',
    expectedRevision: null,
    record: heightRecord(4096, 4096, 4, new Float32Array(4096).fill(90)),
  });
  assert.equal(read(), 80);
  assert.equal(reads, beforeDistant, 'a distant edit must retain the scalar anchor');
  await write({ kind: 'landscape-sea-level', seaLevelM: 100 });
  assert.equal(read(), 100);
  await write({ kind: 'undo' });
  assert.equal(read(), 80);
});

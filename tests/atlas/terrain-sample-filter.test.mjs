import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas/terrain-field-stream';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/atlas-landscape';export * from './src/app/atlas/landscape-geometry';export * from './src/app/storage/atlas-landscape-region';export * from './src/app/storage/terrain-grid';export * from './src/app/storage/store';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
  outfile: '.build/terrain-sample-filter-test.cjs',
});
const {
  streamTerrainField,
  streamTerrainFieldBlock,
  heightRecord,
  bounds,
  AtlasLandscapeReader,
  CampaignStore,
  readTerrainGrid,
} = require('../../.build/terrain-sample-filter-test.cjs');
function fixture(t, records) {
  const root = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(root + '/sample-filter-'),
    store = new CampaignStore(dir + '/world.sqlite'),
    campaign = store.create('Sampled world'),
    token = store.activate(campaign.id).token;
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const insert = store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
  store.db.transaction(() => {
    for (const r of records) {
      const b = bounds(r);
      insert.run(campaign.id, r.id, 1, b.x, b.x + b.width, b.y, b.y + b.height, JSON.stringify(r));
    }
  })();
  const db = new (require('better-sqlite3'))(store.filename, { readonly: true });
  t.after(() => db.close());
  const reader = new AtlasLandscapeReader(db),
    source = store.atlasRegionSource(token);
  reader.sync(source);
  return {
    reader,
    source,
    store,
    all: (kind) =>
      kind === 'height' ? [...records].sort((a, b) => b.resolution - a.resolution) : [],
  };
}
test('world samples skip fine payloads between samples while retaining exact mixed-resolution heights', (t) => {
  const records = [heightRecord(0, 0, 64, new Float32Array(4096).fill(20))];
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      records.push(
        heightRecord(
          x * 64,
          y * 64,
          1,
          Float32Array.from({ length: 4096 }, (_, i) => (i % 7 === 0 ? NaN : 10 + x + y + i / 100)),
          x % 2 ? 2 : 1,
        ),
      );
  const { reader, source, store, all } = fixture(t, records),
    read = reader.terrainStream(source);
  let payloads = 0;
  function* counted(...args) {
    for (const r of read(...args)) {
      payloads++;
      yield r;
    }
  }
  const lattice = { x: -1000.125, y: -1000.375, dx: 1000, dy: 1000, columns: 6, rows: 6 };
  const expected = streamTerrainField(lattice, 0, all),
    actual = streamTerrainField(lattice, 0, counted);
  assert.deepEqual(actual, expected);
  assert(actual.heights.some((v) => v > 0));
  assert(payloads < 40, `world read ${payloads} of ${records.length} payloads`);
  t.diagnostic(JSON.stringify({ records: records.length, payloads, samples: 36 }));
  const box = { x: lattice.x, y: lattice.y, width: 5000, height: 5000 },
    view = {
      box,
      frame: box,
      columns: 6,
      rows: 6,
      focusM: 0,
      tilt: 0,
      rotation: 0,
      exaggeration: 1,
    };
  assert.deepEqual(readTerrainGrid(store.db, source.campaignId, view).heights, expected.surface);
  assert.deepEqual(reader.visibility(source, view).heights, expected.surface);
});
test('sample filtering retains Hermite neighbours, additive inheritance and partial blocks at fractional and large origins', (t) => {
  for (const origin of [0, 2 ** 35, -(2 ** 35)]) {
    const records = [8, 0.25].flatMap((pixel) =>
      [1, 2].flatMap((version) =>
        [-1, 0].flatMap((y) =>
          [-1, 0].map((x) =>
            heightRecord(
              origin + x * 64 * pixel,
              origin + y * 64 * pixel,
              pixel,
              Float32Array.from({ length: 4096 }, (_, i) =>
                i % 11 === 0 ? NaN : (version === 2 ? 3 : 40) + Math.sin(i) * 17,
              ),
              version,
            ),
          ),
        ),
      ),
    );
    const { reader, source, all } = fixture(t, records),
      read = reader.terrainStream(source);
    for (const [offset, dx, dy] of [
      [0, 0.125, 0.375],
      [-0.1, 1 / 3, 2 / 7],
      [0.25, 19.25, 13.5],
    ]) {
      const lattice = {
        x: origin - 20.125 + offset,
        y: origin - 19.375 + offset,
        dx,
        dy,
        columns: 97,
        rows: 37,
      };
      assert.deepEqual(streamTerrainField(lattice, 3, read), streamTerrainField(lattice, 3, all));
      for (const rect of [
        { x: 0, y: 0, width: 32, height: 32 },
        { x: 64, y: 32, width: 33, height: 5 },
      ])
        assert.deepEqual(
          streamTerrainFieldBlock(lattice, rect, 3, read),
          streamTerrainFieldBlock(lattice, rect, 3, all),
        );
    }
  }
});

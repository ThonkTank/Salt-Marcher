import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { emptyMaterialChannels } from '../helpers/atlas-material-channels.mjs';
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents: `export * from './src/app/storage/store';export * from './src/app/storage/atlas-region';export * from './src/app/storage/atlas-terrain-tiles';export * from './src/app/atlas/terrain-brush-draft';export * from './src/app/atlas/atlas-surface-draft';export * from './src/app/atlas/atlas-surface-reuse';`,
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-draft-scale-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  AtlasRegionReader,
  AtlasTerrainTiles,
  TerrainBrushDraft,
  AtlasSurfaceDraft,
  reuseAtlasSurfaceTile,
} = require('../../.build/terrain-draft-scale-test.cjs');
const Database = require('better-sqlite3');
const stroke = (radius, targetM, extra = {}) => ({
  mode: 'raise',
  radius,
  strength: 10000,
  feather: 0,
  ...(targetM === undefined ? {} : { targetM }),
  samples: [
    { x: 32, y: 32, t: 0 },
    { x: 32, y: 32, t: 1000 },
  ],
  ...extra,
});
function fixture(t) {
  const dir = mkdtempSync('/tmp/terrain-scale-');
  let store = new CampaignStore(dir + '/world.sqlite');
  const campaign = store.create('Mixed scale'),
    token = store.activateShell(campaign.id).token;
  let db, reader, tiles, cursor;
  const reopen = () => {
    tiles?.close();
    db?.close();
    db = new Database(store.filename, { readonly: true });
    reader = new AtlasRegionReader(db);
    tiles = new AtlasTerrainTiles(db, dir + '/cache');
    cursor = undefined;
  };
  reopen();
  t.after(() => {
    tiles.close();
    db.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const write = (action) =>
    store.executeAtlasCommit({ campaignId: campaign.id, token, commandId: randomUUID(), action });
  return {
    write,
    commit: (s) => write({ kind: 'landscape-height-stroke', stroke: s }),
    reopen,
    height: (x = 32) => store.atlasHeight(token, { x, y: 32 }).heightM,
    async read() {
      cursor = store.atlasRegionSource(token, cursor);
      db.exec('BEGIN');
      try {
        await reader.sync(cursor, false);
        const steps = tiles.read(
          cursor,
          { tile: { lod: -2, x: 0, y: 0 }, revision: cursor.revision, product: 'height' },
          reader,
        );
        for (;;) {
          const step = steps.next();
          if (step.done) {
            db.exec('COMMIT');
            return structuredClone(step.value);
          }
        }
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
const centre = 32 * 65 + 32;
function surface(terrain) {
  return {
    tile: terrain.tile,
    revision: terrain.revision,
    fence: terrain.fence,
    terrain,
    material: { width: 256, height: 256, channels: emptyMaterialChannels(65536) },
  };
}
const near = (actual, expected) =>
  assert(Math.abs(actual - expected) < 0.001, `${actual} != ${expected}`);
for (const mode of ['lower', 'smooth'])
  test(`readonly tile bands keep ${mode} draft, surface, commit and history consistent`, async (t) => {
    const f = fixture(t);
    f.commit(stroke(512, 150));
    if (mode === 'smooth') f.commit(stroke(256, undefined, { strength: 100, feather: 1 }));
    f.commit(stroke(16, 300));
    f.commit(
      stroke(16, 300, {
        samples: [
          { x: 200, y: 32, t: 0 },
          { x: 200, y: 32, t: 1000 },
        ],
      }),
    );
    const tile = await f.read(),
      grid = tile.projection.grid,
      before = structuredClone(grid),
      s = stroke(128, mode === 'lower' ? -100 : undefined, { mode });
    assert(grid.editing.source.bands.length >= 2);
    const draft = new TerrainBrushDraft(grid),
      display = new AtlasSurfaceDraft([surface(tile)], grid.view);
    draft.update(s);
    display.height(s);
    f.commit(s);
    near(draft.ground[centre], f.height());
    near(display.tiles[0].terrain.projection.grid.editing.ground[centre], f.height());
    assert.equal(f.height(200), 300);
    assert.deepEqual(grid, before);
    const saved = f.height(),
      committed = await f.read();
    f.write({ kind: 'undo' });
    near(f.height(), 300);
    assert.deepEqual((await f.read()).projection.grid.editing.source, grid.editing.source);
    f.write({ kind: 'redo' });
    near(f.height(), saved);
    assert.deepEqual(
      (await f.read()).projection.grid.editing.source,
      committed.projection.grid.editing.source,
    );
    f.reopen();
    const warm = await f.read();
    assert.equal(warm.cache, 'hit');
    assert.deepEqual(warm.projection.grid.editing.source, committed.projection.grid.editing.source);
    // Negative connection control: losing only the new payload reproduces the old semantic error.
    const disconnected = structuredClone(grid);
    delete disconnected.editing.source;
    const broken = new TerrainBrushDraft(disconnected);
    broken.update(s);
    assert(Math.abs(broken.ground[centre] - saved) > 40);
  });
test('identical total grids retain distinct transported scales, including source replacement and reuse', async (t) => {
  const a = fixture(t),
    b = fixture(t);
  a.commit(stroke(512, 300));
  b.commit(stroke(512, 150));
  b.commit(stroke(64, 300));
  const coarse = await a.read(),
    mixed = await b.read();
  assert.deepEqual(coarse.projection.grid.heights, mixed.projection.grid.heights);
  assert.deepEqual(coarse.projection.grid.editing.ground, mixed.projection.grid.editing.ground);
  assert.notDeepEqual(coarse.projection.grid.editing.source, mixed.projection.grid.editing.source);
  const reused = reuseAtlasSurfaceTile(surface(coarse), surface(mixed));
  assert.equal(reused.terrain.projection.grid, mixed.projection.grid);
  for (const [f, tile, expected] of [
    [a, coarse, -100],
    [b, mixed, 50],
  ]) {
    const s = stroke(128, -100, { mode: 'lower' }),
      d = new TerrainBrushDraft(tile.projection.grid);
    d.update(s);
    f.commit(s);
    near(d.ground[centre], expected);
    near(f.height(), expected);
  }
});
test('cumulative local gestures carry changed bands across radius changes without source mutation', async (t) => {
  const f = fixture(t);
  f.commit(stroke(512, 150));
  f.commit(stroke(16, 300));
  const initial = await f.read(),
    original = structuredClone(initial);
  let tiles = [surface(initial)];
  for (const s of [stroke(128, -100, { mode: 'lower' }), stroke(16, 350), stroke(128, 150)]) {
    const d = new AtlasSurfaceDraft(tiles, initial.projection.grid.view);
    d.height({ ...s, samples: [s.samples[0], { x: 32, y: 32, t: 500 }] });
    d.height(s);
    assert.equal(d.height(s), false);
    f.commit(s);
    tiles = d.tiles;
    near(tiles[0].terrain.projection.grid.editing.ground[centre], f.height());
  }
  assert.deepEqual(initial, original);
  const d = new TerrainBrushDraft(initial.projection.grid);
  d.update(stroke(128, 150));
  assert.throws(
    () =>
      d.update(
        stroke(16, 150, { samples: [...stroke(16, 150).samples, { x: 32, y: 32, t: 2000 }] }),
      ),
    /maßstab/,
  );
});

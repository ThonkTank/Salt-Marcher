import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import Database from 'better-sqlite3';
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { emptyMaterialChannels } from '../helpers/atlas-material-channels.mjs';
const { outputFiles } = await build({
  stdin: {
    contents:
      "export * from './src/app/atlas/terrain-spatial-model';export * from './src/app/storage/terrain-grid';export * from './src/app/storage/terrain-projection';export * from './src/app/storage/terrain-scale';export * from './src/app/atlas/atlas-surface-draft';export * from './src/app/atlas/terrain-brush';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/atlas-terrain-tile';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
});
writeFileSync('.build/terrain-surface-visibility-test.cjs', outputFiles[0].contents);
const api = createRequire(import.meta.url)('../../.build/terrain-surface-visibility-test.cjs');
const fixture = JSON.parse(
  gunzipSync(
    readFileSync(new URL('../fixtures/atlas/terrain-visibility-cycle3.json.gz', import.meta.url)),
  ),
);
function source(t) {
  const db = new Database(':memory:');
  db.exec(
    "CREATE TABLE atlas_landscape(id TEXT PRIMARY KEY,campaign_id TEXT,min_x REAL,min_y REAL,max_x REAL,max_y REAL,payload TEXT);CREATE INDEX landscape_settings_fast ON atlas_landscape(campaign_id) WHERE json_valid(payload) AND json_extract(payload,'$.terrainSettings') IS NOT NULL;",
  );
  for (const index of [
    'landscape_height_scale',
    'landscape_route_fast',
    'landscape_freshwater_fast',
  ])
    db.exec('CREATE INDEX ' + index + ' ON atlas_landscape(campaign_id)');
  const put = db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?)');
  for (const row of fixture.rows)
    put.run(
      row.id,
      row.campaign_id,
      row.min_x,
      row.min_y,
      row.max_x,
      row.max_y,
      JSON.stringify(row.payload),
    );
  t.after(() => db.close());
  const grid = api.readTerrainGrid(db, fixture.campaignId, fixture.view);
  return { db, grid, records: fixture.rows.map((r) => r.payload) };
}

test('real steep snapshot: exact mixed-LOD surface accepts both false negatives and protects the silhouette', (t) => {
  const { db, grid } = source(t),
    visible = api.terrainVisibility(grid);
  const old = api.readTerrainGrid(db, fixture.campaignId, fixture.stroke.visibility);
  for (const p of fixture.points) {
    assert.equal(
      api.terrainVisible(old, p),
      p.oldVisible,
      p.name + ' reproduces original disagreement',
    );
    assert.equal(visible(p), true, p.name + ' is visible on displayed triangles');
    const own = grid.surface.find(
      (g) =>
        p.x >= g.view.box.x &&
        p.y >= g.view.box.y &&
        p.x <= g.view.box.x + g.view.box.width &&
        p.y <= g.view.box.y + g.view.box.height,
    );
    assert.equal(
      api.gridHeight(own, p),
      p.meshHeight,
      'canonical reconstruction matches secured display geometry',
    );
  }
  assert.equal(
    visible(fixture.hidden),
    false,
    'explicit point behind foreground silhouette is occluded',
  );
  assert.throws(
    () => visible({ x: 2000, y: 2000 }),
    /noch nicht vollständig/,
    'missing coverage is not invisibility',
  );
});

test('camera partitions reject missing, overlapping, foreign tiles and renderer heights', (t) => {
  source(t);
  for (const change of [
    (v) => {
      v.surface = null;
    },
    (v) => v.surface.tiles.pop(),
    (v) => v.surface.tiles.push(v.surface.tiles[0]),
    (v) => v.surface.tiles.push({ lod: -7, x: 10000, y: 10000 }),
    (v) => {
      v.surface.heights = [1, 2, 3];
    },
    (v) => {
      v.surface.tiles[0].heightM = 20;
    },
    (v) => {
      v.frame.x += 10000;
    },
  ]) {
    const view = structuredClone(fixture.view);
    change(view);
    assert.throws(() => api.validateTerrainView(view));
  }
});

test('positive real gesture dose changes both visible picks, with preview and canonical writer identical', (t) => {
  const { db, grid, records } = source(t),
    stroke = { ...fixture.stroke, visibility: fixture.view };
  const dose = api.prepareHeightBrush(stroke).dose;
  const canonical = api.computeTerrainStroke(db, fixture.campaignId, stroke, undefined, grid);
  const tiles = grid.surface.map((g, i) => {
    const address = fixture.view.surface.tiles[i];
    return {
      tile: address,
      revision: 85,
      fence: fixture.provenance.fence,
      terrain: {
        tile: address,
        revision: 85,
        fence: fixture.provenance.fence,
        projection: { grid: g },
      },
      material: {
        tile: address,
        revision: 85,
        fence: fixture.provenance.fence,
        width: 16,
        height: 16,
        channels: emptyMaterialChannels(256),
      },
    };
  });
  const draft = new api.AtlasSurfaceDraft(tiles, fixture.view, undefined, {
    complete: true,
    records,
    revision: 85,
    fence: fixture.provenance.fence,
    radius: stroke.radius,
    pixel: 1 / 64,
    box: { x: -512, y: -512, width: 1024, height: 1024 },
    visibility: grid,
  });
  assert(draft.height(stroke));
  const expected = new Map(records.map((r) => [r.id, r]));
  for (const r of canonical) expected.set(r.id, r);
  const normalize = (rows) =>
    [...rows].map((r) => ({ ...r, revision: 0 })).sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(
    normalize(draft.tiles[0].terrain.projection.grid.editing.author.records),
    normalize(expected.values()),
    'all author bytes match writer',
  );
  const before = new api.TerrainSampler(records),
    after = new api.TerrainSampler([...expected.values()]);
  for (const p of fixture.points) {
    assert(dose(p) > 0, p.name + ' has positive dose');
    assert(after.sample(p).heightM > before.sample(p).heightM, p.name + ' receives height');
  }
  const dosedHidden = { x: -119.859375, y: -100.0625 };
  assert(dose(dosedHidden) > 0);
  assert.equal(api.terrainVisible(grid, dosedHidden), false);
  assert.equal(
    after.sample(dosedHidden).heightM,
    before.sample(dosedHidden).heightM,
    'real stroke leaves its positively dosed occluded author node unchanged',
  );
  // A deliberate dose behind the same silhouette must still leave its author nodes unchanged.
  const hidden = fixture.hidden;
  const occluded = {
    ...stroke,
    samples: [
      { ...hidden, t: 0 },
      { ...hidden, t: 1000 },
    ],
    radius: 0.1,
  };
  assert(api.prepareHeightBrush(occluded).dose(hidden) > 0);
  const hiddenResult = new Map(records.map((r) => [r.id, r]));
  for (const r of api.computeTerrainStroke(db, fixture.campaignId, occluded, undefined, grid))
    hiddenResult.set(r.id, r);
  assert.equal(
    new api.TerrainSampler([...hiddenResult.values()]).sample(hidden).heightM,
    before.sample(hidden).heightM,
    'occluded author node stays unchanged even if the small brush also reaches visible neighbours',
  );
});

test('shared LOD edges do not depend on tile publication order', (t) => {
  const { grid } = source(t),
    forward = api.terrainVisibility(grid);
  const reversed = {
    ...grid,
    view: {
      ...grid.view,
      surface: { ...grid.view.surface, tiles: [...grid.view.surface.tiles].reverse() },
    },
    surface: [...grid.surface].reverse(),
  };
  const backward = api.terrainVisibility(reversed);
  let checked = 0,
    differingHeights = 0;
  for (const a of grid.surface)
    for (const b of grid.surface) {
      if (a.view.box.width === b.view.box.width) continue;
      const x = a.view.box.x + a.view.box.width,
        lo = Math.max(a.view.box.y, b.view.box.y),
        hi = Math.min(a.view.box.y + a.view.box.height, b.view.box.y + b.view.box.height);
      if (x !== b.view.box.x || hi <= lo) continue;
      const p = { x, y: lo + (hi - lo) * 0.371 };
      differingHeights += api.gridHeight(a, p) !== api.gridHeight(b, p) ? 1 : 0;
      assert.equal(forward(p), backward(p));
      checked++;
    }
  assert(
    checked > 0 && differingHeights > 0,
    'real partition exercises different interpolated heights at shared LOD edges',
  );
});

test('canonical surface ray uses water vertices while retaining ground author heights', (t) => {
  const db = new Database(':memory:');
  t.after(() => db.close());
  db.exec(
    'CREATE TABLE atlas_landscape(id TEXT,campaign_id TEXT,min_x REAL,min_y REAL,max_x REAL,max_y REAL,payload TEXT)',
  );
  const record = api.heightRecord(0, 0, 4, new Float32Array(4096).fill(-10));
  db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?)').run(
    record.id,
    'water',
    0,
    0,
    256,
    256,
    JSON.stringify(record),
  );
  const view = {
    box: { x: 0, y: 0, width: 16, height: 16 },
    frame: { x: 0, y: 0, width: 16, height: 16 },
    columns: 65,
    rows: 65,
    tilt: 0,
    rotation: 0,
    focusM: 0,
    exaggeration: 1,
    projection: 'perspective',
    surface: { metersPerPixel: 1, tiles: [{ lod: 0, x: 0, y: 0 }] },
  };
  const grid = api.readTerrainGrid(db, 'water', view),
    p = { x: 8, y: 8 },
    tile = grid.surface[0];
  assert.equal(api.gridHeight(tile, p), 0);
  assert.equal(api.gridHeight({ ...tile, heights: tile.editing.ground }, p), -10);
  assert(api.terrainVisible(grid, p));
});

test('surface read rejects a stale canonical revision or fence before reconstruction', (t) => {
  const { db } = source(t);
  const sourceIdentity = {
    revision: 85,
    fence: fixture.provenance.fence,
    campaignId: fixture.campaignId,
  };
  const query = {
    product: 'height',
    view: fixture.view,
    revision: 85,
    fence: fixture.provenance.fence,
    width: 16,
    height: 16,
    displayMpp: 1,
    contours: 0,
  };
  for (const stale of [
    { ...query, revision: 84 },
    { ...query, fence: 'foreign-source' },
  ])
    assert.throws(
      () => api.readTerrainProjection(db, sourceIdentity, stale, function* () {}),
      /inzwischen geändert/,
    );
});

test('screen radius at a viewport edge clips unbound nodes while rejecting missing declared geometry', (t) => {
  const { db } = source(t),
    frame = { x: 0, y: 0, width: 16, height: 16 },
    view = {
      box: frame,
      frame,
      columns: 65,
      rows: 65,
      tilt: 0,
      rotation: 0,
      focusM: 0,
      exaggeration: 1,
      projection: 'perspective',
      surface: { metersPerPixel: 1, tiles: [{ lod: 0, x: 0, y: 0 }] },
    },
    grid = api.readTerrainGrid(db, fixture.campaignId, view),
    stroke = {
      mode: 'raise',
      radius: 0.4,
      strength: 1,
      feather: 0.7,
      samples: [
        { x: 0.01, y: 8, t: 0 },
        { x: 0.01, y: 8, t: 100 },
      ],
      visibility: view,
      screenInput: {
        version: 1,
        events: [
          { u: 0.01 / 16, v: 0.5, t: 0 },
          { u: 0.01 / 16, v: 0.5, t: 100 },
        ],
      },
    };
  // Freeze a flat display plane so the edge centre is exactly x=0.01.
  for (const tile of grid.surface) tile.heights.fill(0);
  assert.throws(() => api.terrainVisibility(grid)({ x: -0.1, y: 8 }), /noch nicht vollständig/);
  assert.equal(api.terrainVisibility(grid, 'clip')({ x: -0.1, y: 8 }), false);
  const plan = api.prepareHeightBrush(stroke, grid);
  assert(plan.dose({ x: -0.1, y: 8 }) > 0, 'radius genuinely crosses the bound mesh edge');
  const changed = api.computeTerrainStroke(db, fixture.campaignId, stroke, undefined, grid);
  assert(
    changed.some((r) => r.height),
    'visible side still changes',
  );
  for (const r of changed) {
    if (!r.height) continue;
    const heights = api.decodeHeights(r.height),
      h = r.height;
    for (let i = 0; i < heights.length; i++)
      if (h.x + (i % 64) * h.pixel < 0)
        assert.equal(
          Number.isNaN(heights[i]) ? 0 : heights[i],
          0,
          'unbound nodes receive no author delta',
        );
  }
  for (const damaged of [
    { ...grid, surface: [] },
    {
      ...grid,
      surface: [
        {
          ...grid.surface[0],
          view: { ...grid.surface[0].view, box: { ...grid.surface[0].view.box, x: 1000 } },
        },
      ],
    },
    {
      ...grid,
      surface: [
        { ...grid.surface[0], heights: new Float32Array(grid.surface[0].heights.length).fill(NaN) },
      ],
    },
  ])
    assert.throws(() => api.terrainVisibility(damaged, 'clip'), /noch nicht vollständig/);
});

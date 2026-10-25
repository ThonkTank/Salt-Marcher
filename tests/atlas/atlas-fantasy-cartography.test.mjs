import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
buildSync({
  stdin: {
    resolveDir: process.cwd(),
    contents: `export * from './src/app/atlas/atlas-prominence';export * from './src/app/atlas/atlas-cartographic-texture';export * from './src/app/atlas/landscape-raster';export * from './src/app/atlas/terrain-material';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/vegetation';export * from './src/app/storage/store';export * from './src/app/atlas/atlas-landscape';export * from './src/app/atlas/terrain-route';`,
  },
  outfile: '.build/atlas-fantasy-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  automaticProminence,
  prominenceOpacity,
  effectiveProminence,
  prominenceLimit,
  cartographicInkPixels,
  acquireCartographicTextures,
  LandscapeRasterizer,
  COVER_CHANNEL_NAMES,
  SURFACE_CHANNEL_NAMES,
  heightRecord,
  vegetationSpec,
  CampaignStore,
  emptyRecord,
  routeSpec,
} = createRequire(import.meta.url)('../../.build/atlas-fantasy-test.cjs');
const polygon = (x, y, w, h) => ({
  outer: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
  holes: [],
});
const drain = (iterator) => {
  for (;;) {
    const v = iterator.next();
    if (v.done) return v.value;
  }
};
function materials(id, edits = [], box = { x: 0, y: 0, width: 32, height: 32 }) {
  const r = new LandscapeRasterizer(box, 32, 32, 0, 1, true, {
    samples: 4,
    areaCoverage: true,
    worldFeather: true,
    cover: true,
  });
  const lattice = r.sampleLattice(),
    heights = Float32Array.from(
      { length: lattice.rows * lattice.columns },
      (_, i) => 20 + Math.sin((lattice.x + (i % lattice.columns) * lattice.dx) / 20) * 10,
    );
  r.setTerrainField({ heights, water: new Uint8Array(heights.length) });
  const spec = vegetationSpec(id);
  spec.preset.edge = 0;
  spec.edits = edits;
  r.paintCover({
    ...emptyRecord('vegetation'),
    polygons: [polygon(-50, -50, 150, 150)],
    vegetation: spec,
  });
  return drain(r.materialChannelsSteps(function* () {}, new Set(SURFACE_CHANNEL_NAMES)));
}
test('all six presets carry their own weighted material families, independently of pigment', () => {
  const values = Object.fromEntries(
    ['deciduous', 'conifer', 'meadow', 'scrub', 'scree', 'rocky'].map((id) => [id, materials(id)]),
  );
  assert(values.deciduous.deciduous[0] > 180);
  assert.equal(values.deciduous.conifer[0], 0);
  assert(values.conifer.conifer[0] > 180);
  assert.equal(values.conifer.deciduous[0], 0);
  assert(values.meadow.grass[0] > 180);
  assert.equal(values.meadow.shrub[0], 0);
  assert(values.scrub.shrub[0] > 180);
  assert(values.scree.debris[0] > values.rocky.debris[0]);
  for (const m of Object.values(values)) {
    assert.equal(m.relief.length, 32 * 32 * 4);
    assert(m.relief.some((v) => v));
  }
});
test('clear, thin and dense edit all emitted families without creating a foreign species', () => {
  const clear = materials('conifer', [{ mode: 'clear', polygons: [polygon(-50, -50, 150, 150)] }]);
  for (const c of COVER_CHANNEL_NAMES)
    assert(
      clear[c].every((v) => v === 0),
      c,
    );
  const base = materials('conifer'),
    thin = materials('conifer', [{ mode: 'thin', polygons: [polygon(-50, -50, 150, 150)] }]),
    dense = materials('conifer', [{ mode: 'dense', polygons: [polygon(-50, -50, 150, 150)] }]);
  assert(thin.conifer[0] < base.conifer[0]);
  assert(dense.conifer[0] > base.conifer[0]);
  assert.equal(dense.deciduous[0], 0);
  assert.equal(dense.grass[0], 0);
});
test('continuous height field has identical macro normals at the same samples across cropped tiles', () => {
  const wide = materials('meadow', [], { x: -16, y: 0, width: 32, height: 32 }),
    right = materials('meadow', [], { x: 0, y: 0, width: 32, height: 32 });
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 16; x++)
      assert.deepEqual(
        wide.relief.slice((y * 32 + x + 16) * 4, (y * 32 + x + 17) * 4),
        right.relief.slice((y * 32 + x) * 4, (y * 32 + x + 1) * 4),
      );
});
test('automatic prominence uses complete extent and manual rank controls the same smooth fade', () => {
  const r = {
    ...emptyRecord('road'),
    width: 2,
    style: 'path',
    points: [
      { x: 0, y: 0 },
      { x: 200000, y: 0 },
    ],
  };
  assert.equal(automaticProminence(r), 3);
  assert.equal(automaticProminence({ ...r, points: [...r.points].reverse() }), 3);
  for (let rank = 0; rank <= 5; rank++) {
    const line = { ...r, prominence: rank };
    assert.equal(effectiveProminence(line), rank);
    const limit = prominenceLimit(line);
    assert.equal(prominenceOpacity(line, 0.1), 1);
    if (Number.isFinite(limit)) {
      assert.equal(prominenceOpacity(line, limit), 0);
      assert.equal(prominenceOpacity(line, limit * 0.875), 0.5);
    } else assert.equal(prominenceOpacity(line, 1e9), 1);
  }
});
test('shared deterministic ink plates are reused and released only after their last layer', () => {
  const a = cartographicInkPixels(),
    b = cartographicInkPixels();
  assert.deepEqual(a, b);
  for (const array of [a.plants, a.marks]) assert(array.some((v) => v > 0));
  for (let c = 0; c < 4; c++) assert(a.plants.some((v, i) => i % 4 === c && v > 0));
  let created = 0,
    destroyed = 0,
    mips = 0;
  const device = {
    createTexture: (props) => {
      created++;
      assert.equal(props.mipLevels, 9);
      return { destroy: () => destroyed++, generateMipmapsWebGL: () => mips++ };
    },
  };
  const x = acquireCartographicTextures(device),
    y = acquireCartographicTextures(device);
  assert.equal(x.plants, y.plants);
  assert.equal(created, 2);
  assert.equal(mips, 2);
  x.release();
  assert.equal(destroyed, 0);
  y.release();
  assert.equal(destroyed, 2);
  y.release();
  assert.equal(destroyed, 2);
});
test('prominence metadata preserves planned terrain, is revision fenced, undoable and durable', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'fantasy-store-')),
    filename = join(directory, 'world.sqlite');
  let store = new CampaignStore(filename);
  t.after(() => {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const campaign = store.create('Prominence'),
    token = store.activateShell(campaign.id).token;
  const write = (action) =>
    store.executeAtlasCommit({ commandId: randomUUID(), campaignId: campaign.id, token, action });
  write({
    kind: 'landscape-put',
    record: heightRecord(0, 0, 4, new Float32Array(4096).fill(30)),
    expectedRevision: null,
  });
  const anchors = [
      { x: 10, y: 20 },
      { x: 100, y: 20 },
    ],
    road = {
      ...emptyRecord('road'),
      id: 'pass',
      width: 8,
      points: anchors,
      route: routeSpec('road', anchors),
    };
  write({
    kind: 'landscape-route',
    record: road,
    expectedRevision: null,
    sourceRevision: store.atlasIdentity(token).revision,
  });
  const before = store.atlasLandscapeObject(token, 'pass'),
    cmd = {
      kind: 'landscape-prominence',
      id: 'pass',
      expectedRevision: before.revision,
      prominence: 5,
    };
  const physical = () =>
    store.db
      .prepare(
        "SELECT id,payload FROM atlas_landscape WHERE campaign_id=? AND id!='pass' ORDER BY id",
      )
      .all(campaign.id);
  const prior = physical();
  write(cmd);
  const after = store.atlasLandscapeObject(token, 'pass');
  assert.equal(after.prominence, 5);
  assert.deepEqual(after.route, before.route);
  assert.deepEqual(physical(), prior);
  assert.throws(() => write(cmd), /inzwischen/);
  assert.throws(
    () => write({ ...cmd, expectedRevision: after.revision, prominence: 6 }),
    /Prominenz|prominenz/,
  );
  write({ kind: 'undo' });
  assert.equal(store.atlasLandscapeObject(token, 'pass').prominence, undefined);
  write({ kind: 'redo' });
  assert.equal(store.atlasLandscapeObject(token, 'pass').prominence, 5);
  const snapshot = join(directory, 'copy.sqlite');
  await store.campaignSnapshot(token, snapshot);
  const imported = store.acceptCampaignSnapshot(snapshot, 'Kopie', {}),
    importToken = store.activateShell(imported.id).token;
  const importedLine = store.db
    .prepare(
      "SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.kind')='road'",
    )
    .get(imported.id);
  assert.equal(JSON.parse(importedLine.payload).prominence, 5);
  store.close();
  store = new CampaignStore(filename);
  const fresh = store.activateShell(campaign.id).token;
  assert.equal(store.atlasLandscapeObject(fresh, 'pass').prominence, 5);
});

test('failed ink mip generation releases its texture before a later explicit retry', () => {
  let destroyed = 0;
  assert.throws(
    () =>
      acquireCartographicTextures({
        createTexture: () => ({
          generateMipmapsWebGL() {
            throw Error('lost context');
          },
          destroy() {
            destroyed++;
          },
        }),
      }),
    /lost context/,
  );
  assert.equal(destroyed, 1);
});

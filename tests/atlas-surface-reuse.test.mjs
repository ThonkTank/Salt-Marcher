import { emptyMaterialChannels } from './helpers/atlas-material-channels.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({
  stdin: {
    contents: `export * from './src/app/atlas-surface-reuse';export * from './src/app/atlas-terrain-tile-model';`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { reuseAtlasSurfaceTile, atlasTerrainTileModel } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')
);
function pair() {
  const tile = { lod: 0, x: 0, y: 0 },
    view = {
      box: { x: 0, y: 0, width: 256, height: 256 },
      frame: { x: 0, y: 0, width: 256, height: 256 },
      columns: 65,
      rows: 65,
      focusM: 0,
      tilt: 0,
      rotation: 0,
      exaggeration: 1,
    };
  return {
    tile,
    revision: 1,
    fence: 'old',
    terrain: {
      tile,
      revision: 1,
      fence: 'old',
      projection: {
        grid: {
          view,
          seaLevelM: 0,
          heights: new Float32Array(65 * 65),
          editing: { ground: new Float32Array(65 * 65), water: new Float32Array(65 * 65) },
        },
      },
    },
    material: {
      tile,
      revision: 1,
      fence: 'old',
      width: 256,
      height: 256,
      channels: {
        ...emptyMaterialChannels(65536),
        baseColor: new Uint8Array(256 * 256 * 4).fill(255),
        water: new Uint8Array(256 * 256),
        forest: new Uint8Array(256 * 256),
      },
    },
  };
}
function next(previous) {
  const n = structuredClone(previous);
  for (const x of [n, n.terrain, n.material]) {
    x.revision = 2;
    x.fence = 'new';
  }
  return n;
}
test('new receipts retain unchanged geometry/mask buffers while adopting the new source identity', () => {
  const before = pair(),
    oldModel = atlasTerrainTileModel(before.terrain, before.material),
    incoming = next(before);
  incoming.material.channels.baseColor[512] = 80;
  const reused = reuseAtlasSurfaceTile(before, incoming),
    model = atlasTerrainTileModel(reused.terrain, reused.material);
  assert.equal(reused.fence, 'new');
  assert.equal(reused.terrain.fence, 'new');
  assert.equal(reused.material.fence, 'new');
  assert.equal(model.mesh, oldModel.mesh);
  assert.equal(model.data, oldModel.data);
  assert.equal(model.masks, oldModel.masks);
  assert.notEqual(model.texture.data, oldModel.texture.data);
  assert.equal(model.texture.data[512], 80);
});
test('underwater ground, coastline, view and height changes cannot reuse a stale editable grid', () => {
  for (const change of [
    (p) => (p.terrain.projection.grid.editing.ground[0] = -2),
    (p) => (p.terrain.projection.grid.editing.water[0] = 2),
    (p) => (p.terrain.projection.grid.heights[0] = 3),
    (p) => (p.terrain.projection.grid.view.box.width = 128),
  ]) {
    const before = pair(),
      incoming = next(before);
    change(incoming);
    assert.notEqual(
      reuseAtlasSurfaceTile(before, incoming).terrain.projection.grid,
      before.terrain.projection.grid,
    );
  }
  const before = pair(),
    incoming = next(before);
  incoming.material.channels.water[12] = 255;
  assert.notEqual(
    reuseAtlasSurfaceTile(before, incoming).material.channels.water,
    before.material.channels.water,
  );
});

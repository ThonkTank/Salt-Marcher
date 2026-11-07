import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
buildSync({
  entryPoints: ['src/app/atlas/atlas-world-tiles.ts'],
  outfile: '.build/atlas-world-tiles-test.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const { ATLAS_WORLD_TILE_METERS, atlasWorldTileAt, atlasWorldTileBounds, atlasWorldTileOrigin } =
  await import('../../.build/atlas-world-tiles-test.mjs');

test('base grid has signed floor addressing and half-open boundaries', () => {
  assert.equal(ATLAS_WORLD_TILE_METERS, 256);
  assert.deepEqual(atlasWorldTileAt({ x: 0, y: 0 }), { lod: 0, x: 0, y: 0 });
  assert.deepEqual(atlasWorldTileAt({ x: -0.001, y: -256 }), { lod: 0, x: -1, y: -1 });
  assert.deepEqual(atlasWorldTileAt({ x: 256, y: -256.001 }), { lod: 0, x: 1, y: -2 });
  assert.deepEqual(atlasWorldTileBounds({ lod: 0, x: -1, y: 2 }), {
    minX: -256,
    minY: 512,
    maxX: 0,
    maxY: 768,
    sizeM: 256,
  });
  assert.deepEqual(atlasWorldTileOrigin({ lod: 0, x: -3, y: 5 }), { x: -768, y: 1280 });
});

test('dyadic LOD tiles preserve signed canonical coordinates', () => {
  assert.deepEqual(atlasWorldTileAt({ x: -512, y: 1024 }, 1), { lod: 1, x: -1, y: 2 });
  assert.deepEqual(atlasWorldTileBounds({ lod: 2, x: -2, y: 3 }), {
    minX: -2048,
    minY: 3072,
    maxX: -1024,
    maxY: 4096,
    sizeM: 1024,
  });
  assert.deepEqual(atlasWorldTileAt({ x: -0.5, y: 0.5 }, -8), { lod: -8, x: -1, y: 0 });
});

test('large-world addresses remain integral and invalid values reject', () => {
  assert.deepEqual(atlasWorldTileAt({ x: -1e12, y: 1e12 }), {
    lod: 0,
    x: -3906250000,
    y: 3906250000,
  });
  assert.throws(() => atlasWorldTileAt({ x: Infinity, y: 0 }));
  assert.throws(() => atlasWorldTileAt({ x: 1e30, y: 0 }));
  assert.throws(() => atlasWorldTileBounds({ lod: 0, x: 1.5, y: 0 }));
  assert.throws(() => atlasWorldTileAt({ x: 0, y: 0 }, 0.5));
});

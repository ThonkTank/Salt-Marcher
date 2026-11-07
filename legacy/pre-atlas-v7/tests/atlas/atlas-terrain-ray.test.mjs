import { emptyMaterialChannels } from '../helpers/atlas-material-channels.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({
  stdin: {
    contents:
      "export * from './src/app/atlas/atlas-terrain-ray'; export * from './src/app/atlas/atlas-terrain-tile-model'; export * from './src/app/atlas/atlas-deck-ray';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { atlasTerrainRay, atlasTerrainTileModel, refineAtlasDeckRayHit } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')
);
test('grid traversal agrees with triangle mesh hits across vertical, inclined, edge and outside rays', () => {
  const box = { x: 0, y: 0, width: 256, height: 256 },
    view = {
      box,
      frame: box,
      columns: 65,
      rows: 65,
      focusM: 0,
      tilt: 0,
      rotation: 0,
      exaggeration: 1,
    };
  const grid = {
    view,
    heights: Float32Array.from(
      { length: 65 * 65 },
      (_, i) =>
        80 * Math.exp(-(((i % 65) - 32) ** 2 + (Math.floor(i / 65) - 32) ** 2) / 100) +
        Math.sin(i % 65) * 5,
    ),
    seaLevelM: 0,
  };
  const tile = { tile: { lod: 0, x: 0, y: 0 }, revision: 0, fence: 'a', projection: { grid } },
    material = {
      ...tile,
      width: 256,
      height: 256,
      channels: {
        ...emptyMaterialChannels(65536),
        baseColor: new Uint8Array(256 * 256 * 4),
        water: new Uint8Array(256 * 256),
        forest: new Uint8Array(256 * 256),
      },
    };
  const model = atlasTerrainTileModel(tile, material);
  const rays = [
    [
      [0, 0, 200],
      [0, 0, -200],
    ],
    [
      [256, 256, 200],
      [256, 256, -200],
    ],
    [
      [300, 300, 200],
      [300, 300, -200],
    ],
  ];
  for (let i = 0; i < 60; i++) {
    const x = (i * 71) % 256,
      y = (i * 41) % 256;
    rays.push([
      [x, y, 200],
      [i % 2 ? x + 50 : x, i % 3 ? y - 100 : y, -200],
    ]);
  }
  for (const segment of rays) {
    const expected = refineAtlasDeckRayHit({ object: model.object, segment }),
      actual = atlasTerrainRay(grid, segment);
    assert.equal(!!actual, !!expected, JSON.stringify(segment));
    if (actual)
      for (const k of ['x', 'y', 'heightM'])
        assert(Math.abs(actual.point[k] - expected.point[k]) < 1e-5, k);
  }
});

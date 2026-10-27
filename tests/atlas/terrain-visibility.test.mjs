import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas/terrain-spatial-model';export * from './src/app/atlas/terrain-color-visibility';export * from './src/app/atlas/landscape-brush';export * from './src/app/atlas/atlas-landscape';export * from './src/app/atlas/landscape-geometry';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-visibility-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const {
  terrainVisible,
  terrainVisibility,
  visibleTerrainColor,
  brushFootprint,
  contains,
} = require('../../.build/terrain-visibility-test.cjs');
test('bounded visibility rays agree with complete triangle walks across ridges, rotations, sea and world scales', () => {
  let compared = 0,
    hidden = 0,
    seen = 0;
  for (const scale of [1, 10000])
    for (const rotation of [0, 45, 89.999, 180, 270])
      for (const tilt of [0, 35, 65]) {
        const box = { x: -160 * scale, y: -160 * scale, width: 320 * scale, height: 320 * scale },
          frame = { x: -100 * scale, y: -100 * scale, width: 200 * scale, height: 200 * scale };
        const heights = Float32Array.from(
          { length: 97 * 97 },
          (_, i) =>
            30 +
            120 * Math.exp(-(((i % 97) - 60) ** 2) / 6) +
            70 * Math.sin(Math.floor(i / 97) * 0.3),
        );
        const grid = {
            view: {
              box,
              frame,
              columns: 97,
              rows: 97,
              focusM: 30,
              tilt,
              rotation,
              exaggeration: 2,
            },
            heights,
            seaLevelM: 0,
          },
          visible = terrainVisibility(grid);
        for (let y = -110; y <= 110; y += 11)
          for (let x = -110; x <= 110; x += 11) {
            const point = { x: (x + 0.125) * scale, y: (y - 0.25) * scale },
              expected = terrainVisible(grid, point);
            assert.equal(
              visible(point),
              expected,
              JSON.stringify({ point, scale, rotation, tilt }),
            );
            compared++;
            if (expected) seen++;
            else hidden++;
          }
      }
  assert(compared >= 13000 && hidden > 1000 && seen > 1000);
});

test('color clipping dissolves adjacent visibility rows before intersecting a round stroke near axis zero', () => {
  const view = {
    projection: 'perspective',
    box: { x: -1200, y: -700, width: 2400, height: 1400 },
    frame: { x: -400, y: -230, width: 800, height: 460 },
    columns: 33,
    rows: 33,
    focusM: 100,
    tilt: 0,
    rotation: 0,
    exaggeration: 1,
  };
  const grid = { view, heights: new Float32Array(33 * 33).fill(100), seaLevelM: 0 };
  for (const y of [0, 1e-14, -1e-14]) {
    const points = [{ x: 0, y }],
      record = {
        points,
        polygons: brushFootprint(points, 48),
        paint: { radius: 48, visibility: view },
      },
      before = structuredClone(record);
    const result = visibleTerrainColor(record, [], grid);
    assert.equal(result.polygons.length, 1);
    assert(contains({ x: 0, y }, result.polygons));
    assert(contains({ x: 47, y }, result.polygons));
    assert(!contains({ x: 49, y }, result.polygons));
    assert.deepEqual(record, before);
    assert.equal(result.paint.visibility, undefined);
  }
});

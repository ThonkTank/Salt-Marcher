import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';

buildSync({
  stdin: {
    resolveDir: process.cwd(),
    contents: `export {routeSegmentRange} from './src/app/terrain-route-clip';export * from './src/app/atlas-spatial-color';export * from './src/app/atlas-spatial-geometry';export * from './src/app/atlas-paint';export {drawLandscape} from './src/app/atlas-landscape-view';export {Raycaster,Vector2,Vector3} from 'three';`,
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: '.build/atlas-spatial-scene-test.cjs',
});
const {
  routeSegmentRange,
  drawLandscape,
  atlasSpatialColor,
  AtlasSpatialScene,
  atlasSpatialPaths,
  atlasStrokeParts,
  atlasPaint,
  Raycaster,
  Vector2,
  Vector3,
} = createRequire(import.meta.url)('../.build/atlas-spatial-scene-test.cjs');
const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const command = (node, options = {}) => ({
  node,
  matrix,
  style: { fill: '#d8c59d', stroke: null, ...node.style },
  alpha: 1,
  pointer: true,
  hud: false,
  title: '',
  ancestry: [node],
  ...options,
});
const flat = {
  origin: { x: 0, y: 0 },
  focusM: 0,
  exaggeration: 1,
  segment: 10,
  height: () => 0,
};

test('Dash phase persists around a corner and zero gaps do not hang', () => {
  const points = [new Vector2(0, 0), new Vector2(3, 0), new Vector2(3, 7)],
    parts = atlasStrokeParts(points, [4, 2]);
  assert.deepEqual(
    parts.map((p) => p.map((v) => [v.x, v.y])),
    [
      [
        [0, 0],
        [3, 0],
        [3, 1],
      ],
      [
        [3, 3],
        [3, 7],
      ],
    ],
  );
  assert(atlasStrokeParts(points, [0, 2, 2, 0]).length > 0);
  const paths = atlasSpatialPaths(atlasPaint('ellipse', { radiusX: 2, radiusY: 1 }));
  assert.equal(paths.shapes.length, 1);
  assert(paths.lines[0][0].equals(paths.lines[0].at(-1)));
});

test('Atlas alpha colors preserve translucent previews in GPU materials', () => {
  assert.deepEqual(atlasSpatialColor('#d98f5555', 0.6), {
    color: '#d98f55',
    opacity: 0.2,
  });
  assert.deepEqual(atlasSpatialColor('#f008', 1), {
    color: '#ff0000',
    opacity: 136 / 255,
  });
  assert.deepEqual(atlasSpatialColor('rgba(20, 30, 40, 0.25)', 0.8), {
    color: 'rgb(20, 30, 40)',
    opacity: 0.2,
  });
  assert.deepEqual(atlasSpatialColor('transparent', 1), {
    color: '#ffffff',
    opacity: 0,
  });
});

test('clipped world dashes preserve travel phase and joins without expanding remote segments', () => {
  const clip = (a, b) => routeSegmentRange(a, b, { x: -2, y: -2, width: 12, height: 12 });
  const points = [new Vector2(-1000000, 0), new Vector2(3, 0), new Vector2(3, 1000000)];
  const parts = atlasStrokeParts(points, [4, 2], 0, clip);
  assert(parts.length < 8);
  // The first visible centreline begins after 999998 metres of real travel.
  const expected = atlasStrokeParts(
    [new Vector2(-2, 0), new Vector2(3, 0), new Vector2(3, 10)],
    [4, 2],
    999998,
  );
  const round = (paths) =>
    paths.map((p) => p.map((v) => [Number(v.x.toFixed(8)), Number(v.y.toFixed(8))]));
  assert.deepEqual(round(parts), round(expected));
  assert.deepEqual(round(atlasStrokeParts(points, [], 0, clip)), [
    [
      [-2, 0],
      [3, 0],
      [3, 10],
    ],
  ]);
  const offscreen = [new Vector2(100, 100), new Vector2(1e9, 100)];
  assert.deepEqual(atlasStrokeParts(offscreen, [0.01, 0.01], 0, clip), []);
  const returning = [new Vector2(0, 0), new Vector2(20, 0), new Vector2(20, 5), new Vector2(0, 5)];
  assert.deepEqual(round(atlasStrokeParts(returning, [], 0, clip)), [
    [
      [0, 0],
      [10, 0],
    ],
    [
      [10, 5],
      [0, 5],
    ],
  ]);
});

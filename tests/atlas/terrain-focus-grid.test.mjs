import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  stdin: {
    resolveDir: process.cwd(),
    contents:
      "export * from './src/app/atlas/terrain-grid-layout';export * from './src/app/atlas/terrain-spatial-model';export {gridMesh} from './tests/helpers/terrain-grid-mesh';export * from './src/app/atlas/atlas-camera';export * from './src/app/storage/terrain-grid';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/terrain-projection-cache';export * as THREE from 'three';",
  },
  outfile: '.build/terrain-focus-grid-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const {
  terrainGridLayout,
  terrainGridCoordinate,
  terrainGridRect,
  validateTerrainView,
  terrainGrid,
  gridHeight,
  terrainVisible,
  gridMesh,
  atlasCameraEye,
  atlasProject,
  readTerrainGrid,
  heightRecord,
  TerrainProjectionCache,
  THREE,
} = createRequire(import.meta.url)('../../.build/terrain-focus-grid-test.cjs');
const view = () => ({
  box: { x: -300, y: -240, width: 600, height: 480 },
  frame: { x: -200, y: -160, width: 400, height: 320 },
  refinement: { x: -150, y: -120, width: 300, height: 240 },
  columns: 33,
  rows: 33,
  focusM: 100,
  tilt: 55,
  rotation: 23,
  exaggeration: 1,
  projection: 'perspective',
});
test('fine centre and coarse margins form one continuous bounded mesh with exact world UVs', () => {
  const v = view(),
    l = terrainGridLayout(v);
  validateTerrainView(v);
  assert.equal(l.blocks.length, 9);
  assert.equal(l.x.values[4], -150);
  assert.equal(l.x.values[28], 150);
  for (const axis of [l.x, l.y])
    for (let i = 0; i < axis.values.length; i++) {
      assert(Math.abs(terrainGridCoordinate(axis, axis.values[i]) - i) < 1e-10);
      if (i) assert(axis.values[i] > axis.values[i - 1]);
    }
  const heights = Float32Array.from(
      { length: v.columns * v.rows },
      (_, i) =>
        100 +
        Math.sin(l.x.values[i % v.columns] / 80) * 30 +
        Math.cos(l.y.values[Math.floor(i / v.columns)] / 55) * 40,
    ),
    grid = { view: v, heights, seaLevelM: 0 };
  const mesh = gridMesh(grid);
  const uv = mesh.geometry.getAttribute('uv');
  for (let y = 0; y < v.rows; y++)
    for (let x = 0; x < v.columns; x++) {
      const i = y * v.columns + x;
      assert(Math.abs(uv.getX(i) - (l.x.values[x] - v.box.x) / v.box.width) < 1e-7);
      assert(Math.abs(uv.getY(i) - (l.y.values[y] - v.box.y) / v.box.height) < 1e-7);
    }
  // Both sides of each fine/coarse seam must match exact triangle intersections.
  for (const x of [-151, -150.01, -150, -149.99, 0, 149.99, 150, 150.01, 151])
    for (const y of [-121, -120, -119, 37, 119, 120, 121]) {
      const hits = new THREE.Raycaster(
        new THREE.Vector3(x, -y, 1000),
        new THREE.Vector3(0, 0, -1),
      ).intersectObject(mesh);
      assert(hits.length);
      assert(Math.abs(hits[0].point.z + v.focusM - gridHeight(grid, { x, y })) < 1e-4);
    }
  assert.deepEqual(terrainGridRect(v, { x: 4, y: 4, width: 25, height: 25 }), v.refinement);
  mesh.geometry.dispose();
  mesh.material.dispose();
});
test('canonical visibility agrees with ray tracing across the fine/coarse boundaries', () => {
  const v = view(),
    l = terrainGridLayout(v),
    heights = Float32Array.from(
      { length: v.columns * v.rows },
      (_, i) =>
        100 + Math.max(0, 1 - Math.abs(l.y.values[Math.floor(i / v.columns)] + 110) / 40) * 130,
    ),
    grid = { view: v, heights, seaLevelM: 0 };
  const mesh = gridMesh(grid);
  const eye = atlasCameraEye(v),
    origin = new THREE.Vector3(eye.x, -eye.y, eye.z);
  let hidden = 0,
    visible = 0;
  for (let x = -250; x <= 250; x += 17)
    for (let y = -200; y <= 200; y += 19) {
      const p = { x, y },
        z = gridHeight(grid, p),
        screen = atlasProject(v, p, z),
        target = new THREE.Vector3(x, -y, z - v.focusM),
        distance = origin.distanceTo(target),
        ray = new THREE.Raycaster(origin, target.clone().sub(origin).normalize());
      const hits = ray.intersectObject(mesh),
        expected =
          screen.depth > 0 &&
          screen.x >= 0 &&
          screen.x <= 1 &&
          screen.y >= 0 &&
          screen.y <= 1 &&
          (!hits.length || hits[0].distance >= distance - 0.001);
      assert.equal(
        terrainVisible(grid, p),
        expected,
        JSON.stringify({ p, screen, distance, first: hits[0]?.distance }),
      );
      if (expected) visible++;
      else hidden++;
    }
  assert(hidden > 10 && visible > 10);
  mesh.geometry.dispose();
  mesh.material.dispose();
});
test('streamed nine-band sampling and local invalidation match canonical direct samples', () => {
  const records = [];
  for (let y = -1; y <= 0; y++)
    for (let x = -1; x <= 0; x++)
      records.push(
        heightRecord(
          x * 512,
          y * 512,
          8,
          Float32Array.from(
            { length: 4096 },
            (_, i) =>
              120 +
              Math.sin((x * 512 + (i % 64) * 8) / 40) * 20 +
              Math.cos((y * 512 + Math.floor(i / 64) * 8) / 90) * 30,
          ),
        ),
      );
  const v = view(),
    db = {
      prepare() {
        return {
          get() {
            return undefined;
          },
        };
      },
    },
    stream = (kind) => (kind === 'height' ? records : []),
    cache = new TerrainProjectionCache();
  const direct = terrainGrid(records, v);
  // This fixture is entirely above sea level: its raw ground equals its surface.
  assert(direct.heights.every((z) => z > 0));
  direct.editing = {
    ground: direct.heights.slice(),
    water: new Float32Array(direct.heights.length),
  };
  const cold = readTerrainGrid(db, 'cam', v, stream, cache),
    warm = readTerrainGrid(db, 'cam', v, stream, cache);
  assert.deepEqual(cold, direct);
  assert.deepEqual(warm, direct);
  assert.equal(cache.tiles.misses, 9);
  assert.equal(cache.tiles.hits, 9);
  cache.invalidate([{ x: -151, y: -121, width: 4, height: 4 }]);
  assert.deepEqual(readTerrainGrid(db, 'cam', v, stream, cache), direct);
});
test('refinement cannot introduce unbounded, inverted, zero-area or out-of-source bands', () => {
  const v = view();
  for (const refinement of [
    null,
    { ...v.refinement, x: v.box.x },
    { ...v.refinement, width: 600 },
    { ...v.refinement, height: 0 },
    { ...v.refinement, x: NaN },
    { ...v.refinement, heights: [10] },
  ])
    assert.throws(() => validateTerrainView({ ...v, refinement }));
  assert.throws(() => validateTerrainView({ ...v, columns: 2 }));
});
test('world-to-room scales retain the same focus bands far from the world origin', () => {
  for (const offset of [-1e9, 1e9])
    for (const scale of [0.01, 1, 1e5]) {
      const v = view();
      for (const key of ['box', 'frame', 'refinement']) {
        const b = v[key];
        v[key] = {
          x: offset + b.x * scale,
          y: -offset + b.y * scale,
          width: b.width * scale,
          height: b.height * scale,
        };
      }
      validateTerrainView(v);
      const l = terrainGridLayout(v);
      for (const a of [l.x, l.y])
        for (let i = 0; i < a.values.length; i++)
          assert(Math.abs(terrainGridCoordinate(a, a.values[i]) - i) < 1e-5);
      const heights = Float32Array.from(
          { length: v.columns * v.rows },
          (_, i) => 30 + (i % v.columns),
        ),
        g = { view: v, heights, seaLevelM: 0 };
      for (let i = 0; i < v.columns; i++) {
        const p = { x: l.x.values[i], y: l.y.values[16] };
        assert(Math.abs(gridHeight(g, p) - (30 + i)) < 1e-5);
      }
    }
});

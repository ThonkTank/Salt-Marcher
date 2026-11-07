import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';

buildSync({
  entryPoints: ['src/app/atlas/atlas-deck-scene-model.ts'],
  outfile: '.build/atlas-deck-scene-model-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
buildSync({
  entryPoints: ['src/app/atlas/terrain-grid-layout.ts'],
  outfile: '.build/atlas-deck-layout-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url);
const { buildAtlasDeckSceneModel } = require('../../.build/atlas-deck-scene-model-test.cjs');
const { terrainGridLayout } = require('../../.build/atlas-deck-layout-test.cjs');

function terrain({
  x,
  y,
  width = 128,
  height = 128,
  columns = 3,
  rows = 3,
  heights = Array(columns * rows).fill(10),
  exaggeration = 2,
} = {}) {
  return {
    view: {
      box: { x, y, width, height },
      frame: { x, y, width, height },
      columns,
      rows,
      focusM: 10,
      tilt: 0,
      rotation: 0,
      exaggeration,
    },
    heights: Float32Array.from(heights),
    seaLevelM: 0,
  };
}
function regionView({ rooms = [], cities = [], bindings = [], frames = {}, interiors = {} } = {}) {
  return {
    region: {
      scopeId: null,
      coverage: { mode: 'detail', complete: true, unreadable: 0 },
      frames,
      interiors,
    },
    bindings,
    cities,
    geometry: { floors: [], drawing: { elements: [] } },
    workspace: { rooms, floors: [] },
  };
}
const close = (actual, expected, tolerance = 1e-4) =>
  assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
function worldPoint(object, index) {
  const i = index * 3;
  return {
    x: object.origin.x + object.positions[i],
    y: object.origin.y + object.positions[i + 1],
    z: object.origin.heightM + object.positions[i + 2],
  };
}
function triangleAreaAtZ(mesh, z) {
  let area = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = worldPoint(mesh, mesh.indices[i]),
      b = worldPoint(mesh, mesh.indices[i + 1]),
      c = worldPoint(mesh, mesh.indices[i + 2]);
    if (Math.abs(a.z - z) > 1e-4 || Math.abs(b.z - z) > 1e-4 || Math.abs(c.z - z) > 1e-4) continue;
    area += Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
  }
  return area;
}

test('terrain uses the actual refined TerrainGrid topology and object-local physical metres beyond 70 million metres', () => {
  const grid = terrain({
    x: 70_000_000,
    y: -90_000_000,
    width: 512,
    height: 256,
    columns: 9,
    rows: 9,
    heights: Array.from({ length: 81 }, (_, i) => 20 + i),
    exaggeration: 4,
  });
  grid.view.refinement = { x: 70_000_128, y: -89_999_936, width: 128, height: 64 };
  const layout = terrainGridLayout(grid.view),
    model = buildAtlasDeckSceneModel({ view: regionView(), terrain: grid });
  const mesh = model.objects.find((object) => object.target.kind === 'terrain');
  assert(mesh);
  assert.equal(mesh.positions.length, grid.view.columns * grid.view.rows * 3);
  assert.deepEqual([...mesh.indices.slice(0, 6)], [0, 9, 1, 1, 9, 10]);
  assert(
    new Set(Array.from(layout.x.values.slice(1), (value, index) => value - layout.x.values[index]))
      .size > 1,
    'refinement must retain the non-uniform TerrainGrid spacing',
  );
  for (let row = 0; row < grid.view.rows; row++)
    for (let column = 0; column < grid.view.columns; column++) {
      const index = row * grid.view.columns + column,
        p = worldPoint(mesh, index);
      close(p.x, layout.x.values[column], 1e-4);
      close(p.y, layout.y.values[row], 1e-4);
      close(p.z, grid.heights[index], 1e-5);
    }
  assert.equal(Math.abs(mesh.origin.x % 256), 0);
  assert.equal(Math.abs(mesh.origin.y % 256), 0);
  assert.equal(Math.abs(mesh.origin.heightM % 256), 0);
  assert(mesh.positions.every(Number.isFinite));
  assert([...mesh.positions].every((value) => Math.abs(value) < 512));
  assert.equal(model.verticalExaggeration, 4);
  assert.equal(model.coverage.complete, true);
});

test('canonical rotated building and two-floor room preserve holes, scope transforms and physical heights without a root', () => {
  const farX = 70_000_000,
    farY = -90_000_000,
    frame = { x: farX + 128, y: farY + 128, angle: Math.PI / 6 };
  const cityBinding = {
    id: 'city-binding',
    kind: 'city',
    ownerId: 'city-1',
    parent: 'world',
    parentId: null,
    x: frame.x,
    y: frame.y,
    angle: frame.angle,
    revision: 1,
  };
  const scopeBinding = {
    id: 'scope-binding',
    kind: 'dungeon',
    ownerId: 'interior',
    parent: 'building',
    parentId: 'house-1',
    x: frame.x,
    y: frame.y,
    angle: frame.angle,
    revision: 1,
  };
  const building = {
    id: 'house-1',
    kind: 'building',
    name: 'Haus',
    protected: false,
    position: { x: 0, y: 0 },
    angle: 0,
    outline: [
      { x: -8, y: -8 },
      { x: 8, y: -8 },
      { x: 8, y: 8 },
      { x: -8, y: 8 },
    ],
    terrain: { mode: 'ground', offsetM: 2, wallM: 4, roofM: 3 },
    floorElevations: [0, 5],
  };
  const rooms = ['ground', 'upper'].map((floorId, index) => ({
    id: `room-${floorId}`,
    scopeId: 'interior',
    floorId,
    name: floorId,
    number: String(index),
    revision: 1,
    polygons: [
      {
        outer: [
          { x: 0, y: 0 },
          { x: 8, y: 0 },
          { x: 8, y: 8 },
          { x: 0, y: 8 },
        ],
        holes: [
          [
            { x: 3, y: 3 },
            { x: 5, y: 3 },
            { x: 5, y: 5 },
            { x: 3, y: 5 },
          ],
        ],
      },
    ],
  }));
  const saved = structuredClone({ building, rooms });
  const view = regionView({
    rooms,
    cities: [{ header: { id: 'city-1' }, units: [building] }],
    bindings: [cityBinding, scopeBinding],
    frames: { 'city-binding': frame, 'scope-binding': frame },
    interiors: { 'house-1': 'interior' },
  });
  view.geometry.floors = [
    { id: 'ground', scopeId: 'interior', name: 'Ground', elevation: 0 },
    { id: 'upper', scopeId: 'interior', name: 'Upper', elevation: 5 },
  ];
  const grid = terrain({
    x: farX + 64,
    y: farY + 64,
    width: 128,
    height: 128,
    columns: 5,
    rows: 5,
    heights: Array(25).fill(10),
  });
  const model = buildAtlasDeckSceneModel({
    view,
    terrain: grid,
    display: { metersPerPixel: 0.5, roofs: true, scopeId: null },
  });
  const buildingMesh = model.objects.find((object) => object.target.kind === 'building');
  assert(buildingMesh);
  const floors = new Map(
    model.objects
      .filter((object) => object.target.kind === 'room')
      .map((object) => [object.target.floorId, object]),
  );
  assert.deepEqual([...floors.keys()].sort(), ['ground', 'upper']);
  assert.deepEqual(buildingMesh.target, {
    kind: 'building',
    id: 'house-1',
    cityId: 'city-1',
    scopeId: 'interior',
  });
  close(
    Math.max(
      ...Array.from(
        { length: buildingMesh.positions.length / 3 },
        (_, i) => worldPoint(buildingMesh, i).z,
      ),
    ),
    24,
  );
  close(triangleAreaAtZ(floors.get('ground'), 12), 60, 1e-3);
  close(triangleAreaAtZ(floors.get('upper'), 17), 60, 1e-3);
  for (const object of model.objects) {
    for (const axis of ['x', 'y', 'heightM']) assert.equal(Math.abs(object.origin[axis] % 256), 0);
    assert([...object.positions].every(Number.isFinite));
    assert([...object.positions].every((value) => Math.abs(value) < 256));
  }
  assert.equal(model.coverage.complete, true);
  assert.deepEqual(
    { building, rooms },
    saved,
    'the derived geometry must not mutate canonical author records',
  );
});

test('root-free builder reports raster-only and missing-terrain gaps rather than inventing geometry', () => {
  const view = regionView({
    rooms: [
      {
        id: 'raster-room',
        scopeId: 'scope',
        floorId: 'ground',
        name: 'Raster',
        number: '',
        revision: 1,
        polygons: [],
      },
    ],
  });
  view.region.coverage = { mode: 'raster', complete: true, unreadable: 0 };
  const model = buildAtlasDeckSceneModel({ view, terrain: null });
  assert.equal(model.objects.length, 0);
  assert.equal(model.coverage.complete, false);
  assert(model.coverage.unsupported.some((item) => item.code === 'region-raster-only'));
  assert(model.coverage.unsupported.some((item) => item.code === 'terrain-grid-missing'));
});

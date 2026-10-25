import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';

buildSync({
  entryPoints: ['src/app/atlas/atlas-geometry-overview.ts'],
  outfile: '.build/atlas-geometry-overview-test.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const { AtlasGeometryOverviewBuilder } = await import(
  '../../.build/atlas-geometry-overview-test.mjs'
);

const tile = (x = 0, y = 0, lod = 0) => ({ lod, x, y });
function mesh(kind, points, id = 'source') {
  return {
    id,
    target: { kind, id },
    positions: new Float64Array(points.flat()),
    indices: new Uint32Array([0, 1, 2]),
  };
}
function boxes(overview, kind = 'room') {
  const entry = overview.meshes.find((candidate) => candidate.kind === kind);
  if (!entry) return [];
  const result = [],
    verts = entry.positions,
    indices = entry.indices;
  let vertexBase = 0,
    indexAt = 0;
  while (vertexBase * 3 < verts.length) {
    const offset = vertexBase * 3;
    result.push({
      minX: verts[offset],
      minY: verts[offset + 1],
      maxX: verts[offset + 3],
      maxY: verts[offset + 7],
    });
    const hasWalls = indexAt + 9 < indices.length && indices[indexAt + 9] === vertexBase + 6;
    vertexBase += hasWalls ? 20 : 4;
    indexAt += hasWalls ? 30 : 6;
  }
  return result;
}
const covers = (overview, point, kind = 'room') =>
  boxes(overview, kind).some(
    (box) =>
      point[0] >= box.minX && point[0] <= box.maxX && point[1] >= box.minY && point[1] <= box.maxY,
  );
const byteLength = (overview) =>
  overview.meshes.reduce(
    (sum, entry) => sum + entry.positions.byteLength + entry.indices.byteLength,
    0,
  );

test('overview tests actual triangle coverage and preserves holes larger than a cell', () => {
  const outer = [
      [0, 0, 3],
      [32, 0, 3],
      [32, 32, 3],
      [0, 32, 3],
    ],
    hole = [
      [8, 8, 3],
      [24, 8, 3],
      [24, 24, 3],
      [8, 24, 3],
    ];
  const positions = [...outer, ...hole];
  const indices = [];
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4,
      inner = 4 + i,
      innerNext = 4 + next;
    indices.push(i, next, innerNext, i, innerNext, inner);
  }
  const builder = new AtlasGeometryOverviewBuilder(tile());
  builder.append({
    id: 'holed',
    target: { kind: 'room', id: 'holed' },
    positions: new Float64Array(positions.flat()),
    indices: new Uint32Array(indices),
  });
  const overview = builder.finish();
  assert.equal(overview.resolution, 1);
  assert(!covers(overview, [16, 16]), 'the hole interior must remain empty');
  assert(boxes(overview).length > 0);
  assert(!overview.meshes.some((entry) => 'target' in entry || 'selection' in entry));
});

test('a tiny triangle and a vertical projected line both occupy their intersected cell', () => {
  const builder = new AtlasGeometryOverviewBuilder(tile());
  builder.append(
    mesh('room', [
      [10.1, 10.1, 0],
      [10.2, 10.1, 1],
      [10.1, 10.2, 2],
    ]),
  );
  builder.append(
    mesh('building', [
      [12, 10.2, 0],
      [12, 10.8, 0],
      [12, 10.4, 3],
    ]),
  );
  const overview = builder.finish();
  assert(covers(overview, [10.15, 10.15]));
  assert(covers(overview, [12, 10.5], 'building'));
});

test('half-open tile borders exclude max-edge-only faces and accept the neighbor min edge', () => {
  const face = (points) => mesh('room', points);
  const left = new AtlasGeometryOverviewBuilder(tile(0));
  left.append(
    face([
      [256, 20, 0],
      [256, 22, 0],
      [256, 20, 4],
    ]),
  );
  assert.equal(left.finish().meshes.length, 0);
  const right = new AtlasGeometryOverviewBuilder(tile(1));
  right.append(
    face([
      [256, 20, 0],
      [256, 22, 0],
      [256, 20, 4],
    ]),
  );
  assert.equal(right.finish().meshes.length, 1);
  assert(covers(right.finish(), [0, 21]));
});

test('physical height envelopes retain height origin and building wins equal maximum-height ties', () => {
  const builder = new AtlasGeometryOverviewBuilder(tile());
  const tied = [
    [20, 20, 0],
    [21, 20, 12],
    [20, 21, 7],
  ];
  builder.append(mesh('room', tied));
  builder.append(mesh('building', tied));
  const overview = builder.finish(),
    building = overview.meshes.find((entry) => entry.kind === 'building');
  assert.equal(overview.meshes.length, 1);
  assert.equal(building.origin.heightM, 0);
  assert.equal(Math.max(...building.positions.filter((_, index) => index % 3 === 2)), 12);
  assert.equal(overview.meshes[0].id, 'overview:building');
});

test('far signed tile coordinates use a small local origin and reject invalid input', () => {
  const builder = new AtlasGeometryOverviewBuilder(tile(-3906250000, 3906250000));
  builder.append(
    mesh('room', [
      [-1e12, 1e12, 4],
      [-1e12 + 1, 1e12, 4],
      [-1e12, 1e12 + 1, 4],
    ]),
  );
  const overview = builder.finish(),
    entry = overview.meshes[0];
  assert.equal(entry.origin.x, -1e12);
  assert.equal(entry.origin.y, 1e12);
  assert(Math.max(...entry.positions.filter((_, index) => index % 3 !== 2)) <= 256);
  const invalid = new AtlasGeometryOverviewBuilder(tile());
  assert.throws(
    () =>
      invalid.append({
        id: 'bad',
        target: { kind: 'room', id: 'bad' },
        positions: new Float64Array([0, 0, 0]),
        indices: new Uint32Array([0, 1, 0]),
      }),
    /index/i,
  );
  assert.throws(
    () =>
      invalid.append(
        mesh('terrain', [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
        ]),
      ),
    /room and building/i,
  );
});

test('many streamed objects keep output bounded and discard semantic identities', () => {
  const builder = new AtlasGeometryOverviewBuilder(tile());
  for (let i = 0; i < 1000; i++)
    builder.append(
      mesh(
        'room',
        [
          [30, 30, i],
          [31, 30, i + 1],
          [30, 31, i + 2],
        ],
        `room-${i}`,
      ),
    );
  const overview = builder.finish();
  assert.equal(overview.modeledObjects, 1000);
  assert.equal(overview.meshes.length, 1);
  const [result] = overview.meshes;
  assert.deepEqual(Object.keys(result).sort(), ['id', 'indices', 'kind', 'origin', 'positions']);
  assert(result.positions.byteLength + result.indices.byteLength <= 5.9 * 1024 * 1024);
  assert(result.positions.length / 3 <= 20 * 16384);
  assert(result.indices.length <= 30 * 16384);
  assert.strictEqual(builder.finish(), overview);
  assert.throws(
    () =>
      builder.append(
        mesh('room', [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
        ]),
      ),
    /already finished/i,
  );
});

test('fully occupied non-flat grid reaches but never exceeds the exact 5.625 MiB mesh bound', () => {
  const positions = [],
    indices = [];
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const base = positions.length / 3,
        x0 = x,
        y0 = y,
        z = x * 256 + y;
      positions.push(x0, y0, z, x0 + 1, y0, z + 1, x0 + 1, y0 + 1, z + 2, x0, y0 + 1, z + 1);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  const builder = new AtlasGeometryOverviewBuilder(tile());
  builder.append({
    id: 'dense',
    target: { kind: 'room', id: 'dense' },
    positions: new Float64Array(positions),
    indices: new Uint32Array(indices),
  });
  const overview = builder.finish(),
    entry = overview.meshes[0];
  const bytes = entry.positions.byteLength + entry.indices.byteLength;
  assert.equal(overview.modeledObjects, 1);
  assert.equal(
    bytes,
    5_898_240,
    'the coalesced 16,384 non-flat cells use at most 20 vertices and 30 indices each',
  );
  assert.equal(overview.maxCellSizeM, 2);
});

test('30 m spaced 16 m footprints preserve empty space in a 4096 m overview under the output cap', () => {
  const positions = [],
    indices = [];
  const houses = 136;
  for (let y = 0; y < houses; y++)
    for (let x = 0; x < houses; x++) {
      const base = positions.length / 3,
        x0 = 4 + x * 30,
        y0 = 4 + y * 30,
        z = 0;
      positions.push(x0, y0, z, x0 + 16, y0, z + 1, x0 + 16, y0 + 16, z + 2, x0, y0 + 16, z + 1);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  const builder = new AtlasGeometryOverviewBuilder(tile(0, 0, 4));
  builder.append({
    id: 'spaced-houses',
    target: { kind: 'building', id: 'spaced-houses' },
    positions: new Float64Array(positions),
    indices: new Uint32Array(indices),
  });
  const overview = builder.finish(),
    representedArea = boxes(overview, 'building').reduce(
      (sum, box) => sum + (box.maxX - box.minX) * (box.maxY - box.minY),
      0,
    );
  assert.equal(overview.resolution, 16);
  assert.equal(overview.modeledObjects, 1);
  assert(byteLength(overview) <= 5_898_240);
  assert(
    representedArea < 4096 * 4096 * 0.72,
    `coalesced bounds cover ${((representedArea / (4096 * 4096)) * 100).toFixed(1)}% of the tile`,
  );
});

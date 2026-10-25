import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';

buildSync({
  entryPoints: ['src/app/atlas/atlas-mesh-ray.ts'],
  outfile: '.build/atlas-mesh-ray-test.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const { intersectAtlasMetricMeshSegment, atlasMetricMeshRayIndexBuildCount } = await import(
  '../../.build/atlas-mesh-ray-test.mjs'
);

function mesh(id, positions, indices) {
  return { id, positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}
function vertical(x, y, z0 = -1, z1 = 1) {
  return {
    segment: [
      [x, y, z0],
      [x, y, z1],
    ],
  };
}

test('indexed terrain triangles return the interpolated height of the selected face', () => {
  const terrain = mesh('slope', [-1, -1, 0, 1, -1, 0, -1, 1, 1, 1, 1, 1], [0, 1, 2, 2, 1, 3]);
  const hit = intersectAtlasMetricMeshSegment({ object: terrain, ...vertical(0, 0) });
  assert(hit);
  assert.deepEqual(hit.point, [0, 0, 0.5]);
  assert.equal(hit.segmentFraction, 0.75);
});

test('mesh holes and requested subpixel misses remain misses', () => {
  const positions = [],
    indices = [];
  const quad = (x0, y0, x1, y1, z) => {
    const base = positions.length / 3;
    positions.push(x0, y0, z, x1, y0, z, x0, y1, z, x1, y1, z);
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  };
  quad(-1, -1, 1, -0.25, 0.4);
  quad(-1, 0.25, 1, 1, 0.4);
  quad(-1, -0.25, -0.25, 0.25, 0.4);
  quad(0.25, -0.25, 1, 0.25, 0.4);
  const withHole = mesh('terrain-with-hole', positions, indices);
  assert.equal(intersectAtlasMetricMeshSegment({ object: withHole, ...vertical(0, 0) }), null);
  assert(intersectAtlasMetricMeshSegment({ object: withHole, ...vertical(0.5, -0.5) }));
  const smallRoom = mesh('small-room', [-0.2, -0.2, 0.5, 0.2, -0.2, 0.5, 0, 0.2, 0.5], [0, 1, 2]);
  assert(intersectAtlasMetricMeshSegment({ object: smallRoom, ...vertical(0, 0) }));
  assert.equal(intersectAtlasMetricMeshSegment({ object: smallRoom, ...vertical(0.5, 0) }), null);
});

test('finite segment clipping excludes triangles before its start and beyond its end', () => {
  const before = mesh('before-segment', [-1, -1, -1.2, 1, -1, -1.2, 0, 1, -1.2], [0, 1, 2]);
  const beyond = mesh('beyond-segment', [-1, -1, 1.2, 1, -1, 1.2, 0, 1, 1.2], [0, 1, 2]);
  const inside = mesh('inside-segment', [-1, -1, 0.5, 1, -1, 0.5, 0, 1, 0.5], [0, 1, 2]);
  assert.equal(intersectAtlasMetricMeshSegment({ object: before, ...vertical(0, 0) }), null);
  assert.equal(intersectAtlasMetricMeshSegment({ object: beyond, ...vertical(0, 0) }), null);
  const hit = intersectAtlasMetricMeshSegment({ object: inside, ...vertical(0, 0) });
  assert(hit);
  assert.deepEqual(hit.point, [0, 0, 0.5]);
  assert.equal(hit.segmentFraction, 0.75);
  assert.equal(
    intersectAtlasMetricMeshSegment({
      object: inside,
      segment: [
        [0, 0, 0],
        [0, 0, 0],
      ],
    }),
    null,
  );
});

test('invalid indices, non-finite data and invalid ray inputs fail closed', () => {
  const invalidIndex = mesh('bad-index', [0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 3]);
  assert.throws(
    () => intersectAtlasMetricMeshSegment({ object: invalidIndex, ...vertical(0, 0) }),
    /out-of-range index/i,
  );
  const nonFinite = mesh('bad-vertex', [0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]);
  nonFinite.positions[0] = NaN;
  assert.throws(
    () => intersectAtlasMetricMeshSegment({ object: nonFinite, ...vertical(0, 0) }),
    /non-finite vertices/i,
  );
  const valid = mesh('valid', [0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]);
  assert.throws(
    () =>
      intersectAtlasMetricMeshSegment({
        object: valid,
        segment: [
          [0, 0, NaN],
          [0, 0, 1],
        ],
      }),
    /invalid atlas metric mesh ray query/i,
  );
});

test('only the 10-nanometre edge correction is accepted and corrected onto the triangle boundary', () => {
  const triangle = mesh('edge', [0, -0.5, 0, 1, -0.5, 0, 1, 0.5, 0], [0, 1, 2]);
  const fiveNanometres = intersectAtlasMetricMeshSegment({
    object: triangle,
    ...vertical(-5e-9, -0.5),
  });
  assert(fiveNanometres);
  assert.equal(fiveNanometres.point[0], 0);
  assert.equal(fiveNanometres.point[2], 0);
  assert.equal(
    intersectAtlasMetricMeshSegment({ object: triangle, ...vertical(-11e-9, -0.5) }),
    null,
  );
});

test('local Float32 geometry retains small-metre precision at a billion-metre world origin', () => {
  const worldOrigin = 1_000_000_000_000;
  const worldX = worldOrigin + 0.03125,
    worldY = -worldOrigin - 0.0625;
  const localX = worldX - worldOrigin,
    localY = worldY - -worldOrigin;
  const room = mesh(
    'distant-small-room',
    [-0.125, -0.125, 0.25, 0.125, -0.125, 0.25, 0, 0.125, 0.25],
    [0, 1, 2],
  );
  const hit = intersectAtlasMetricMeshSegment({
    object: room,
    segment: [
      [localX, localY, 1],
      [localX, localY, -1],
    ],
  });
  assert(hit);
  assert.deepEqual(hit.point, [0.03125, -0.0625, 0.25]);
  assert.equal(worldOrigin + hit.point[0], 1_000_000_000_000.03125);
  assert.equal(atlasMetricMeshRayIndexBuildCount(room), 1);
  assert(
    intersectAtlasMetricMeshSegment({
      object: room,
      segment: [
        [localX, localY, 1],
        [localX, localY, -1],
      ],
    }),
  );
  assert.equal(
    atlasMetricMeshRayIndexBuildCount(room),
    1,
    'camera rays reuse a BVH while buffer identities are unchanged',
  );
});

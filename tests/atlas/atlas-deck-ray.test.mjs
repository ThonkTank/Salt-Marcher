import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';

buildSync({
  entryPoints: ['src/app/atlas/atlas-deck-ray.ts'],
  outfile: '.build/atlas-deck-ray-test.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const { atlasDeckRayIndexBuildCount, refineAtlasDeckRayHit } = await import(
  '../../.build/atlas-deck-ray-test.mjs'
);

function object() {
  return {
    id: 'room:upper:1',
    target: { kind: 'room', id: 'upper', scopeId: 'building-7', floorId: 'upper' },
    origin: Object.freeze({ x: 70_000_256, y: -90_000_256, heightM: 256 }),
    positions: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]),
    indices: new Uint32Array([0, 1, 2]),
  };
}
function segmentFor(o, x = 2, y = 2) {
  return [
    [o.origin.x + x, o.origin.y + y, o.origin.heightM + 20],
    [o.origin.x + x, o.origin.y + y, o.origin.heightM - 20],
  ];
}

test('root-free Deck ray restores canonical coordinates at distant positive and negative origins', () => {
  const mesh = object(),
    hit = refineAtlasDeckRayHit({ object: mesh, segment: segmentFor(mesh) });
  assert(hit);
  assert.deepEqual(hit.point, { x: 70_000_258, y: -90_000_254, heightM: 256 });
  assert.equal(hit.segmentFraction, 0.5);
  assert.equal(atlasDeckRayIndexBuildCount(mesh), 1);
  const moved = refineAtlasDeckRayHit({ object: mesh, segment: segmentFor(mesh, 3, 3) });
  assert(moved);
  assert.deepEqual(moved.point, { x: 70_000_259, y: -90_000_253, heightM: 256 });
  assert.equal(
    atlasDeckRayIndexBuildCount(mesh),
    1,
    'camera rays reuse the BVH while mesh buffers stay identical',
  );
});

test('Deck ray rejects subpixel misses, invalid inputs and rebuilt buffers invalidate only their own index', () => {
  const mesh = object();
  assert.equal(refineAtlasDeckRayHit({ object: mesh, segment: segmentFor(mesh, 12, 2) }), null);
  assert.throws(
    () =>
      refineAtlasDeckRayHit({
        object: mesh,
        segment: [
          [0, 0, NaN],
          [0, 0, 0],
        ],
      }),
    /invalid atlas metric mesh ray query/i,
  );
  assert.equal(atlasDeckRayIndexBuildCount(mesh), 1);
  mesh.positions = new Float32Array(mesh.positions);
  assert(refineAtlasDeckRayHit({ object: mesh, segment: segmentFor(mesh) }));
  assert.equal(atlasDeckRayIndexBuildCount(mesh), 2);
});

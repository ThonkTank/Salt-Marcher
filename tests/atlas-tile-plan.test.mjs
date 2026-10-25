import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';

buildSync({
  entryPoints: ['src/app/atlas-tile-plan.ts'],
  outfile: '.build/atlas-tile-plan-test.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const { atlasTilePlan } = await import('../.build/atlas-tile-plan-test.mjs');

test('five world scales keep texture tiles near 256 screen pixels', () => {
  for (const lod of [-8, -2, 0, 8, 20]) {
    const metersPerPixel = 2 ** lod,
      size = 256 * metersPerPixel;
    const plan = atlasTilePlan({ x: 0, y: 0, width: size, height: size }, metersPerPixel);
    assert.deepEqual(plan.detail, [{ lod, x: 0, y: 0 }]);
    assert.deepEqual(plan.overview, [{ lod: Math.min(32, lod + 2), x: 0, y: 0 }]);
  }
});

test('signed addresses and half-open exact boundaries do not add an extra tile', () => {
  const size = 256;
  assert.deepEqual(atlasTilePlan({ x: -size, y: -size, width: size, height: size }, 1).detail, [
    { lod: 0, x: -1, y: -1 },
  ]);
  assert.deepEqual(atlasTilePlan({ x: -size, y: 0, width: size, height: size }, 1).detail, [
    { lod: 0, x: -1, y: 0 },
  ]);
  assert.deepEqual(atlasTilePlan({ x: 0, y: 0, width: size, height: size }, 1).detail, [
    { lod: 0, x: 0, y: 0 },
  ]);
});

test('large area and extreme aspect ratio coarsen without allocating an unbounded grid', () => {
  const plan = atlasTilePlan({ x: -1e11, y: 123.25, width: 2e11, height: 0.5 }, 1, { maxTiles: 3 });
  assert.ok(plan.detail.length <= 3);
  assert.ok(plan.detail.every((tile) => tile.lod >= 0 && tile.lod <= 32));
  assert.throws(
    () => atlasTilePlan({ x: -1e12, y: -1e12, width: 2e12, height: 2e12 }, 1, { maxTiles: 1 }),
    /exceeds maxTiles/,
  );
});

test('maxTiles increases detail LOD only as far as required and output is center-sorted', () => {
  const box = { x: -600, y: -300, width: 1200, height: 600 };
  const plan = atlasTilePlan(box, 1, { maxTiles: 4 });
  assert.ok(plan.detail.length <= 4);
  assert.ok(plan.detail.every((tile) => tile.lod >= 0));
  const centerFirst = plan.detail[0];
  const centerX = box.x + box.width / 2,
    centerY = box.y + box.height / 2;
  const dist = (tile) =>
    Math.hypot(
      (tile.x + 0.5) * 256 * 2 ** tile.lod - centerX,
      (tile.y + 0.5) * 256 * 2 ** tile.lod - centerY,
    );
  assert.ok(plan.detail.every((tile, index) => index === 0 || dist(centerFirst) <= dist(tile)));
  assert.equal(
    new Set(plan.overview.map((tile) => `${tile.lod}/${tile.x}/${tile.y}`)).size,
    plan.overview.length,
  );
  assert.ok(plan.overview.every((tile) => tile.lod === Math.min(32, plan.detail[0].lod + 2)));
});

test('invalid numbers, dimensions, bounds, and tile budgets reject', () => {
  for (const args of [
    [{ x: NaN, y: 0, width: 1, height: 1 }, 1],
    [{ x: 0, y: 0, width: Infinity, height: 1 }, 1],
    [{ x: 0, y: 0, width: 0, height: 1 }, 1],
    [{ x: 0, y: 0, width: 1, height: -1 }, 1],
    [{ x: 0, y: 0, width: 1, height: 1 }, 0],
    [{ x: 0, y: 0, width: 1, height: 1 }, Infinity],
    [{ x: 1e12, y: 0, width: 1, height: 1 }, 1],
    [{ x: 1e11, y: 0, width: 1e-10, height: 1 }, 1],
    [{ x: 999_999_999_950, y: 0, width: 10, height: 1 }, 2 ** 20],
    // Detail fits, but its LOD 31 overview parent extends beyond the canonical bound.
    [{ x: 900_000_000_000, y: 0, width: 1, height: 1 }, 2 ** 29],
  ])
    assert.throws(() => atlasTilePlan(...args));
  for (const maxTiles of [0, 1.5, 257, NaN])
    assert.throws(() => atlasTilePlan({ x: 0, y: 0, width: 1, height: 1 }, 1, { maxTiles }));
});

test('double precision boundaries and LOD transitions remain stable', () => {
  const size = 256 * 2 ** 20;
  const boundary = size * 3000;
  assert.deepEqual(
    atlasTilePlan({ x: boundary - size, y: -size, width: size, height: size }, 2 ** 20).detail,
    [{ lod: 20, x: 2999, y: -1 }],
  );
  assert.deepEqual(
    atlasTilePlan({ x: -Number.EPSILON, y: 0, width: Number.EPSILON, height: 1 }, 1).detail,
    [{ lod: 0, x: -1, y: 0 }],
  );
  assert.equal(atlasTilePlan({ x: 0, y: 0, width: 1, height: 1 }, 2 ** -8).detail[0].lod, -8);
  assert.throws(
    () => atlasTilePlan({ x: 0, y: 0, width: 256, height: 256 }, 2 ** 33),
    /outside the canonical world range/,
  );
});

test('tilted coverage keeps distant ground and refines the focus within one bounded partition', () => {
  const box = { x: -32768, y: -32768, width: 65536, height: 65536 },
    focus = { x: -512, y: -384, width: 1024, height: 768 };
  const plan = atlasTilePlan(box, 1, { maxTiles: 64, focus });
  assert(plan.detail.length <= 64);
  assert(plan.overview.length <= 8);
  const bounds = (t) => ({
    x: t.x * 256 * 2 ** t.lod,
    y: t.y * 256 * 2 ** t.lod,
    size: 256 * 2 ** t.lod,
  });
  for (let i = 0; i < plan.detail.length; i++)
    for (let j = i + 1; j < plan.detail.length; j++) {
      const a = bounds(plan.detail[i]),
        b = bounds(plan.detail[j]);
      assert(
        !(a.x < b.x + b.size && b.x < a.x + a.size && a.y < b.y + b.size && b.y < a.y + a.size),
        'leaf tiles never overlap',
      );
    }
  assert.equal(
    plan.detail.reduce((n, t) => n + bounds(t).size ** 2, 0),
    plan.overview.reduce((n, t) => n + bounds(t).size ** 2, 0),
  );
  const near = plan.detail.filter((t) => {
    const b = bounds(t);
    return b.x <= 0 && b.x + b.size > 0 && b.y <= 0 && b.y + b.size > 0;
  });
  assert.equal(near.length, 1);
  assert(
    near[0].lod < Math.max(...plan.detail.map((t) => t.lod)) - 2,
    'near authoring retains finer terrain than the horizon',
  );
  for (const p of [
    { x: -32767, y: -32767 },
    { x: 32767, y: 32767 },
    { x: 0, y: 0 },
  ])
    assert(
      plan.detail.some((t) => {
        const b = bounds(t);
        return p.x >= b.x && p.y >= b.y && p.x < b.x + b.size && p.y < b.y + b.size;
      }),
    );
});

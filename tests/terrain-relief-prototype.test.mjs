import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Terrain,
  baseHeight,
  sampleGrid,
  gridHeight,
} from '../tools/terrain-relief-prototype/terrain.mjs';

test('R0 fixture has sea, mountains, a low pass and a plateau in physical metres', () => {
  assert(baseHeight(-140000, 0) < 0);
  assert(baseHeight(-32000, -40000) > 1800);
  assert(baseHeight(-16800, 10400) < baseHeight(-22000, 0));
  assert(baseHeight(63000, -46000) > 1000);
  assert.equal(baseHeight(-16800, 10400), baseHeight(-16800, 10400));
});
test('a whole stroke changes only its footprint and is one cancellable history entry', () => {
  const t = new Terrain(),
    before = t.height(1000, 2000),
    outside = t.height(-20000, 0);
  t.begin(3000, 300);
  t.add(1000, 2000);
  t.add(1100, 2100);
  assert.equal(t.height(1000, 2000), before + 300);
  assert.equal(t.height(-20000, 0), outside);
  t.cancel();
  assert.equal(t.height(1000, 2000), before);
  assert.equal(t.strokes.length, 0);
  t.begin(3000, 300);
  t.add(1000, 2000);
  t.commit();
  assert.equal(t.strokes.length, 1);
  t.undo();
  assert.equal(t.height(1000, 2000), before);
  t.redo();
  assert.equal(t.height(1000, 2000), before + 300);
  t.undo();
  t.begin(3000, -200);
  t.add(1000, 2000);
  t.commit();
  assert.equal(t.redoStack.length, 0);
  assert.equal(t.height(1000, 2000), before - 200);
});
test('lowering land through sea level changes the same sampled height used by rendering', () => {
  const t = new Terrain(),
    x = -70000,
    y = 0,
    h = t.height(x, y);
  assert(h > 0);
  t.begin(4000, -h - 50);
  t.add(x, y);
  t.commit();
  assert(t.height(x, y) < 0);
  const grid = sampleGrid(t, { x: x - 1000, y: y - 1000, width: 2000, height: 2000 }, 10);
  assert(Math.abs(gridHeight(grid, x, y) + 50) < 0.001);
  t.undo();
  assert(t.height(x, y) > 0);
});
test('sampling and zooming do not create authored data; surface queries match both mesh triangles', () => {
  const t = new Terrain();
  for (const width of [4000, 145000, 520000])
    sampleGrid(t, { x: -width / 2, y: -width / 2, width, height: width }, 20);
  assert.equal(t.revision, 0);
  assert.equal(t.strokes.length, 0);
  const grid = { n: 1, box: { x: 0, y: 0, width: 10, height: 10 }, heights: [0, 10, 20, 50] };
  assert.equal(gridHeight(grid, 2, 3), 8);
  assert.equal(gridHeight(grid, 8, 9), 40);
});

test('fast and slowly sampled straight strokes produce the same continuous corridor', () => {
  const sparse = new Terrain(),
    dense = new Terrain();
  for (const t of [sparse, dense]) t.begin(500, 240);
  sparse.add(-12000, 0);
  sparse.add(12000, 0);
  for (let x = -12000; x <= 12000; x += 100) dense.add(x, 0);
  for (let x = -12500; x <= 12500; x += 250)
    for (const y of [0, 250, 500, 700]) {
      const expected =
        x >= -12000 && x <= 12000 && Math.abs(y) < 500
          ? 240 * (1 - (y * y) / (500 * 500)) ** 2
          : undefined;
      const a = sparse.height(x, y) - baseHeight(x, y),
        b = dense.height(x, y) - baseHeight(x, y);
      assert(Math.abs(a - b) < 1e-8, `sampling must not change relief at ${x},${y}`);
      if (expected !== undefined)
        assert(Math.abs(a - expected) < 1e-8, `continuous brush at ${x},${y}`);
      if (Math.abs(y) >= 500) assert.equal(a, 0);
    }
  sparse.commit();
  assert.equal(sparse.strokes.length, 1);
  sparse.undo();
  assert.equal(sparse.height(0, 0), baseHeight(0, 0));
  sparse.redo();
  assert.equal(sparse.height(0, 0), baseHeight(0, 0) + 240);
});

test('bends follow their segments and retracing a stroke does not accumulate height', () => {
  const t = new Terrain();
  t.begin(400, -120);
  for (const [x, y] of [
    [0, 0],
    [10000, 0],
    [10000, 10000],
    [10000, 0],
    [0, 0],
  ])
    t.add(x, y);
  assert.equal(t.height(5000, 5000), baseHeight(5000, 5000), 'do not shortcut the corner');
  for (const [x, y] of [
    [5000, 0],
    [10000, 0],
    [10000, 5000],
  ])
    assert.equal(t.height(x, y), baseHeight(x, y) - 120);
  t.cancel();
  assert.equal(t.height(5000, 0), baseHeight(5000, 0));
});

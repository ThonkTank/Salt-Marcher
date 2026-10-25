import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
buildSync({
  stdin: {
    contents:
      "export {brushFootprint} from './src/app/atlas/landscape-brush';export {contains} from './src/app/atlas/atlas-landscape';export {eraseVegetation} from './src/app/atlas/vegetation-erase';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/landscape-brush-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { brushFootprint, contains, eraseVegetation } = createRequire(import.meta.url)(
  '../../.build/landscape-brush-test.cjs',
);
const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/landscape-brush-distant-stroke.json', import.meta.url)),
);
const area = (polygons) =>
  polygons.reduce((sum, p) => {
    const ring = (r) => {
      const origin = r[0];
      return (
        Math.abs(
          r.reduce((s, a, i) => {
            const b = r[(i + 1) % r.length];
            return s + (a.x - origin.x) * (b.y - origin.y) - (b.x - origin.x) * (a.y - origin.y);
          }, 0),
        ) / 2
      );
    };
    return sum + ring(p.outer) - p.holes.reduce((n, h) => n + ring(h), 0);
  }, 0);
test('55 m brush at a continental offset remains connected and translation invariant', () => {
  const before = structuredClone(fixture.points),
    origin = fixture.points[0];
  const local = fixture.points.map((p) => ({ x: p.x - origin.x, y: p.y - origin.y }));
  for (const roughness of [0, 1.5]) {
    const expected = brushFootprint(local, fixture.radius, roughness, 42);
    for (const offset of [origin, { x: 20000000.25, y: -10000000.5 }, { x: 0, y: 0 }]) {
      const points = local.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y }));
      const polygons = brushFootprint(points, fixture.radius, roughness, 42);
      assert.equal(polygons.length, 1);
      assert.equal(polygons[0].holes.length, 0);
      assert(Math.abs(area(polygons) - area(expected)) < 0.0001);
      for (const p of points) assert(contains(p, polygons));
      assert(!contains({ x: offset.x + 1000, y: offset.y }, polygons));
    }
  }
  assert.deepEqual(fixture.points, before);
});
test('closed brush stroke preserves its hole and a large-radius stroke covers sparse samples', () => {
  const offset = { x: 18000000, y: -9000000 };
  const points = [
    [0, 0],
    [200, 0],
    [200, 200],
    [0, 200],
    [0, 0],
  ].map(([x, y]) => ({ x: x + offset.x, y: y + offset.y }));
  const ring = brushFootprint(points, 10);
  assert.equal(ring.length, 1);
  assert.equal(ring[0].holes.length, 1);
  assert(!contains({ x: offset.x + 100, y: offset.y + 100 }, ring));
  const wide = brushFootprint(
    [
      { x: -2e6, y: 3e6 },
      { x: 2e6, y: 3e6 },
    ],
    4023400,
  );
  assert(contains({ x: 0, y: 3e6 }, wide));
  assert(contains({ x: 0, y: 6e6 }, wide));
});
test('distant eraser removes the footprint without retaining a suppression area', () => {
  const { points, radius } = fixture,
    at = points[0];
  const outer = [
    { x: at.x - 1000, y: at.y - 1000 },
    { x: at.x + 1000, y: at.y - 1000 },
    { x: at.x + 1000, y: at.y + 1000 },
    { x: at.x - 1000, y: at.y + 1000 },
  ];
  const record = { polygons: [{ outer, holes: [] }], vegetation: { edits: [], overrides: [] } };
  const before = structuredClone(record),
    brush = brushFootprint(points, radius),
    erased = eraseVegetation(record, brush);
  for (const p of points) assert(!contains(p, erased.polygons));
  assert(contains({ x: at.x - 500, y: at.y }, erased.polygons));
  assert(Math.abs(area(record.polygons) - area(erased.polygons) - area(brush)) < 0.0001);
  assert.deepEqual(erased.vegetation.edits, []);
  assert.deepEqual(record, before);
  assert.equal(eraseVegetation(erased, brush), erased);
  assert.equal(eraseVegetation(record, record.polygons), null);
});

test('dense pointer samples keep a bounded contour and preserve the brush width along a winding stroke', () => {
  const points = Array.from({ length: 2000 }, (_, i) => ({
    x: -8130000 + i * 2,
    y: -983700 + Math.sin(i / 100) * 40,
  }));
  const polygons = brushFootprint(points, 55);
  assert.equal(polygons.length, 1);
  assert(
    polygons[0].outer.length < 1000,
    'near-collinear samples must not create thousands of contour vertices',
  );
  for (let i = 0; i < points.length; i += 10) {
    const p = points[i],
      dy = 0.2 * Math.cos(i / 100),
      length = Math.hypot(1, dy);
    for (const side of [-1, 0, 1])
      assert(
        contains(
          { x: p.x - ((side * dy) / length) * 55 * 0.98, y: p.y + (side / length) * 55 * 0.98 },
          polygons,
        ),
      );
  }
  assert(!contains({ x: points[1000].x, y: points[1000].y + 200 }, polygons));
});

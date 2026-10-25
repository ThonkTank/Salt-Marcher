import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  stdin: {
    resolveDir: process.cwd(),
    contents:
      "export * from './src/app/atlas/landscape-raster';export * from './src/app/atlas/vegetation';export * from './src/app/atlas/landscape-cover-feather';export {segmentDistance} from './src/app/atlas/atlas-landscape';",
  },
  outfile: '.build/cover-feather-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const {
  LandscapeRasterizer,
  vegetationSpec,
  coverFeatherSamplerSteps,
  coverDisplayPolygons,
  coverViewParts,
  segmentDistance,
} = createRequire(import.meta.url)('../../.build/cover-feather-test.cjs');
function* coverFeatherSteps(polygons, box, width, height, radius, checkpoint) {
  const sample = yield* coverFeatherSamplerSteps(polygons, box, width, height, radius, checkpoint);
  if (!sample) return;
  const pixels = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) pixels[y * width + x] = sample(x, y);
  return pixels;
}
const rect = (x, y, w, h) => ({
  outer: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
  holes: [],
});
const record = (
  polygons = [{ ...rect(-30, -30, 60, 60), holes: [rect(-10, -10, 20, 20).outer] }],
  edge = 8,
) => {
  const vegetation = vegetationSpec();
  vegetation.preset.edge = edge;
  return {
    id: 'forest',
    kind: 'vegetation',
    polygons,
    vegetation,
    points: [],
    values: { terrain: 'forest' },
    resolution: 1,
  };
};
const box = { x: -50, y: -50, width: 100, height: 100 };
function draw(r, area = box, width = 100, height = 100, water = false, stepped = false) {
  const image = new LandscapeRasterizer(area, width, height, 0, 1),
    lattice = image.sampleLattice(),
    size = lattice.columns * lattice.rows;
  image.setTerrainField({
    heights: new Float32Array(size).fill(100),
    water: Uint8Array.from({ length: size }, (_, i) =>
      water && lattice.x + (i % lattice.columns) * lattice.dx > 0 ? 1 : 0,
    ),
  });
  let checkpoints = 0;
  function* checkpoint() {
    checkpoints++;
    yield;
  }
  if (r) {
    if (stepped)
      for (const _ of image.paintCoverSteps(r, checkpoint)) {
      }
    else image.paint(r);
  }
  return { pixels: image.finish(), checkpoints };
}
const rgb = (pixels, x, y) => [
  ...pixels.slice(((y + 50) * 100 + x + 50) * 4, ((y + 50) * 100 + x + 50) * 4 + 3),
];
test('forest colour fades inside outer edges and clearings without painting outside or over water', () => {
  const r = record(),
    before = structuredClone(r),
    soft = draw(r).pixels,
    base = draw().pixels,
    hard = draw(record(r.polygons, 0)).pixels;
  for (const [x, y] of [
    [-35, 0],
    [0, 0],
    [35, 0],
  ])
    assert.deepEqual(rgb(soft, x, y), rgb(base, x, y));
  assert(rgb(soft, -29, 0)[1] > rgb(soft, -25, 0)[1]);
  assert(rgb(soft, -25, 0)[1] > rgb(soft, -20, 0)[1]);
  assert.deepEqual(rgb(hard, -29, 0), rgb(hard, -20, 0));
  const wet = draw(r, box, 100, 100, true).pixels,
    waterBase = draw(undefined, box, 100, 100, true).pixels;
  assert.deepEqual(rgb(wet, 25, 0), rgb(waterBase, 25, 0));
  assert.deepEqual(r, before);
});
test('real world boundaries retain exact output across adjacent tiles and far origins', () => {
  for (const edge of [8, 80, 1000]) {
    const r = record(),
      whole = draw({
        ...r,
        vegetation: { ...r.vegetation, preset: { ...r.vegetation.preset, edge } },
      }).pixels;
    const copy = {
      ...r,
      vegetation: { ...r.vegetation, preset: { ...r.vegetation.preset, edge } },
    };
    const left = draw(copy, { ...box, width: 50 }, 50).pixels,
      right = draw(copy, { ...box, x: 0, width: 50 }, 50).pixels;
    for (let y = 0; y < 100; y++) {
      assert.deepEqual(
        left.slice(y * 50 * 4, (y + 1) * 50 * 4),
        whole.slice(y * 100 * 4, (y * 100 + 50) * 4),
      );
      assert.deepEqual(
        right.slice(y * 50 * 4, (y + 1) * 50 * 4),
        whole.slice((y * 100 + 50) * 4, (y + 1) * 100 * 4),
      );
    }
  }
  for (const offset of [-1e9, 1e9]) {
    const r = record(),
      move = (ring) => ring.map((p) => ({ x: p.x + offset, y: p.y + offset })),
      shifted = {
        ...r,
        polygons: r.polygons.map((p) => ({ outer: move(p.outer), holes: p.holes.map(move) })),
      };
    assert.deepEqual(
      draw(shifted, { ...box, x: box.x + offset, y: box.y + offset }).pixels,
      draw(r).pixels,
    );
  }
});
test('overlapping parts have one continuous surface and interruptible paint matches synchronous paint', () => {
  const union = record([rect(-30, -30, 60, 60)]),
    parts = record([rect(-30, -30, 40, 60), rect(-10, -30, 40, 60)]);
  assert.deepEqual(draw(union).pixels, draw(parts).pixels);
  const a = draw(parts, box, 256, 256, false, true),
    b = draw(parts, box, 256, 256);
  assert(a.checkpoints > 20);
  assert.deepEqual(a.pixels, b.pixels);
});
test('clipping continent-length edges bounds work to the requested raster', () => {
  let steps = 0;
  function* checkpoint() {
    steps++;
    yield;
  }
  const g = coverFeatherSteps(
    [rect(-1e12, -1e12, 2e12, 1e12)],
    { x: -50, y: -50, width: 100, height: 100 },
    128,
    128,
    10,
    checkpoint,
  );
  let next = g.next();
  while (!next.done) next = g.next();
  assert(steps < 30);
  assert.equal(next.value.length, 128 * 128);
  assert(next.value.some((v) => v < 1));
  assert.equal(next.value[0], 1);
});

test('spatial boundary queries match exact distances for diagonal, reversed and degenerate edges', () => {
  const triangle = [
    { x: -40, y: -30 },
    { x: 35, y: 20 },
    { x: -20, y: 40 },
  ];
  for (const ring of [triangle, [...triangle].reverse(), [...triangle, triangle[0]]]) {
    const g = coverFeatherSteps([{ outer: ring, holes: [] }], box, 100, 100, 15, function* () {});
    let next = g.next();
    while (!next.done) next = g.next();
    for (let y = 0; y < 100; y++)
      for (let x = 0; x < 100; x++) {
        const p = { x: x - 49.5, y: y - 49.5 },
          d = Math.min(...ring.map((a, i) => segmentDistance(p, a, ring[(i + 1) % ring.length]))),
          t = Math.min(1, d / 15),
          expected = t * t * (3 - 2 * t);
        assert(Math.abs(next.value[y * 100 + x] - expected) < 1e-6);
      }
  }
  const g = coverFeatherSteps([rect(-1000, -1000, 2000, 2000)], box, 100, 100, 15, function* () {});
  assert.equal(g.next().value, undefined);
});
test('sub-sample contour simplification preserves source rings and bounds its visible error', () => {
  const ring = Array.from({ length: 2000 }, (_, i) => {
      const a = (i / 2000) * Math.PI * 2,
        r = 30 + 3 * Math.sin(a * 11);
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    }),
    source = [{ outer: ring, holes: [] }],
    before = structuredClone(source),
    display = coverDisplayPolygons(source, 0.125),
    simplified = display[0].outer;
  assert(simplified.length < ring.length / 4);
  assert.deepEqual(source, before);
  for (const p of ring) {
    const d = Math.min(
      ...simplified.map((a, i) => segmentDistance(p, a, simplified[(i + 1) % simplified.length])),
    );
    assert(d <= 0.1250001);
  }
  const r = record(source),
    whole = draw(r).pixels,
    left = draw(r, { ...box, width: 50 }, 50).pixels,
    right = draw(r, { ...box, x: 0, width: 50 }, 50).pixels;
  for (let y = 0; y < 100; y++) {
    assert.deepEqual(left.slice(y * 200, (y + 1) * 200), whole.slice(y * 400, y * 400 + 200));
    assert.deepEqual(
      right.slice(y * 200, (y + 1) * 200),
      whole.slice(y * 400 + 200, (y + 1) * 400),
    );
  }
});

test('distance halo discards remote islands and recognizes disjoint parts without author mutation', () => {
  const islands = Array.from({ length: 2000 }, (_, i) => rect(i * 1000, 0, 20, 20)),
    before = structuredClone(islands);
  const nearby = coverViewParts(islands, { x: 0, y: 0, width: 100, height: 100 }, 16);
  assert.equal(nearby.polygons.length, 1);
  assert.equal(nearby.disjoint, true);
  assert.equal(nearby.polygons[0], islands[0]);
  assert.equal(
    coverViewParts([rect(0, 0, 20, 20), rect(20, 0, 20, 20)], box, 8).disjoint,
    false,
    'touching parts must still merge',
  );
  assert.equal(coverViewParts([rect(0, 0, 20, 20), rect(40, 0, 20, 20)], box, 8).disjoint, true);
  assert.deepEqual(islands, before);
});
test('hierarchy and halo preserve exact distances with many disjoint, overlapping and distant boundaries', () => {
  const polygons = Array.from({ length: 50 }, (_, i) =>
      rect((i % 10) * 13 - 60, Math.floor(i / 10) * 13 - 30, 7 + (i % 3), 9),
    ),
    before = structuredClone(polygons);
  polygons.push(rect(-1e6, -1e6, 10, 10), rect(-20, -20, 35, 40));
  for (const radius of [2, 16, 80]) {
    const parts = coverViewParts(polygons, box, radius),
      g = coverFeatherSteps(parts.polygons, box, 70, 70, radius, function* () {});
    let next = g.next();
    while (!next.done) next = g.next();
    for (let y = 0; y < 70; y += 3)
      for (let x = 0; x < 70; x += 3) {
        const p = {
          x: box.x + ((x + 0.5) * box.width) / 70,
          y: box.y + ((y + 0.5) * box.height) / 70,
        };
        const distance = Math.min(
            ...polygons.flatMap((polygon) =>
              polygon.outer.map((a, i) =>
                segmentDistance(p, a, polygon.outer[(i + 1) % polygon.outer.length]),
              ),
            ),
          ),
          t = Math.min(1, distance / radius);
        assert(Math.abs(next.value[y * 70 + x] - t * t * (3 - 2 * t)) < 1e-6);
      }
  }
  assert.deepEqual(polygons.slice(0, 50), before);
});

test('small forest edges only normalize their clipped neighbourhood inside a large world raster', () => {
  const area = { x: -500, y: -250, width: 1000, height: 500 },
    width = 1024,
    height = 512,
    radius = 2;
  for (const polygon of [rect(20, 30, 4, 7), rect(-502, -252, 4, 7), rect(498, 248, 4, 7)]) {
    let steps = 0;
    function* checkpoint() {
      steps++;
      yield;
    }
    const g = coverFeatherSamplerSteps([polygon], area, width, height, radius, checkpoint);
    let next = g.next();
    while (!next.done) next = g.next();
    assert(steps <= 3, `small edge caused ${steps} whole-raster checkpoints`);
    const sample = next.value;
    assert(sample);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const p = {
          x: area.x + ((x + 0.5) * area.width) / width,
          y: area.y + ((y + 0.5) * area.height) / height,
        };
        const d = Math.min(
            ...polygon.outer.map((a, i) => segmentDistance(p, a, polygon.outer[(i + 1) % 4])),
          ),
          t = Math.min(1, d / radius);
        assert(Math.abs(sample(x, y) - t * t * (3 - 2 * t)) < 1e-6);
      }
  }
});

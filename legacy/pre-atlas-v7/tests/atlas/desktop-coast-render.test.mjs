import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas/land-mask';export * from './src/app/atlas/landscape-raster';export * from './src/app/atlas/atlas-landscape';export * from './src/app/atlas/landscape-brush';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/coast-render.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { applyMaskArea, applyMaskStroke, LandscapeRasterizer, effectiveLandscape, brushFootprint } =
  createRequire(import.meta.url)('../../.build/coast-render.cjs');
const box = { x: -32, y: -16, width: 64, height: 32 };
const area = (x, y, width, height, terrain = 'plains') => ({
  id: 'area',
  revision: 0,
  kind: 'patch',
  name: '',
  points: [],
  polygons: [
    {
      outer: [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ],
      holes: [],
    },
  ],
  width: 0,
  resolution: 1,
  values: { terrain },
});
const land = () => applyMaskArea([], area(-100, -100, 100, 200));
function render(records, b = box, width = b.width, height = b.height) {
  const image = new LandscapeRasterizer(b, width, height);
  for (const r of records) image.paint(r);
  for (const r of records) if (r.paint) image.paintColor(r);
  return image.finish();
}
const pixel = (data, x, y, w = 64) => [...data.slice((y * w + x) * 4, (y * w + x) * 4 + 4)];
test('unpainted mask land has a neutral base, separate from the travel terrain and authored tint', () => {
  const records = land(),
    before = JSON.stringify(records),
    pixels = render(records);
  assert.deepEqual(pixel(pixels, 10, 16), [238, 229, 207, 255]);
  assert.equal(effectiveLandscape(records, { x: -22, y: 0 }).terrain, 'plains');
  assert(records.every((r) => !r.paint && !r.values.terrain));
  const pigment = {
    ...area(-100, -100, 100, 200),
    values: {},
    points: [{ x: -22, y: 0 }],
    polygons: brushFootprint([{ x: -22, y: 0 }], 5),
    paint: {
      version: 1,
      target: 'ground',
      color: '#ff0000',
      opacity: 1,
      flow: 1,
      tip: 'round',
      radius: 5,
      seed: 1,
      fill: false,
    },
  };
  const painted = render([...records, pigment]);
  assert.deepEqual(pixel(painted, 10, 16), [255, 0, 0, 255]);
  assert.deepEqual(pixel(painted, 40, 16), pixel(pixels, 40, 16));
  assert.deepEqual(render(records), pixels);
  assert.equal(JSON.stringify(records), before);
  // An explicitly authored biome keeps its color.
  const forest = { ...area(-100, -100, 100, 200, 'forest'), maskManaged: true };
  assert.notDeepEqual(pixel(render([forest, ...records]), 10, 16), pixel(pixels, 10, 16));
});
test('coasts are narrow dark contours at the land/water threshold, including erased inland water', () => {
  const records = land(),
    pixels = render(records);
  // The selected narrow coast covers one of the two supersample columns on
  // each side; the neighbouring output pixels retain their exact base colour.
  assert.deepEqual(pixel(pixels, 31, 16), [181, 168, 144, 255]);
  assert.deepEqual(pixel(pixels, 32, 16), [117, 133, 133, 255]);
  assert.deepEqual(pixel(pixels, 30, 16), [238, 229, 207, 255]);
  assert.deepEqual(pixel(pixels, 33, 16), [127, 168, 189, 255]);
  assert.deepEqual(pixel(pixels, 37, 16), [127, 168, 189, 255]);
  assert.deepEqual(pixel(pixels, 24, 16), [238, 229, 207, 255]);
  const changes = applyMaskStroke(records, {
      mode: 'land-erase',
      radius: 6,
      roughness: 1,
      seed: 1,
      samples: [{ x: -16, y: 0, t: 0 }],
    }),
    ids = new Set(changes.map((r) => r.id));
  const lake = render([...records.filter((r) => !ids.has(r.id)), ...changes]);
  assert.deepEqual(pixel(lake, 16, 16), [127, 168, 189, 255]);
  assert.deepEqual(pixel(lake, 10, 16), [117, 133, 133, 255]);
  assert.deepEqual(pixel(lake, 22, 16), [181, 168, 144, 255]);
  assert.deepEqual(pixel(lake, 23, 16), [238, 229, 207, 255]);
});
test('adjacent render tiles have exactly the same coasts as a single frame, without false tile-border lines', () => {
  for (const offset of [-10, 0, 10]) {
    const records = applyMaskArea([], area(-100, -100, 100 + offset, 200)),
      whole = render(records);
    const left = render(records, { ...box, width: 32 }),
      right = render(records, { ...box, x: 0, width: 32 });
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 64; x++)
        assert.deepEqual(pixel(x < 32 ? left : right, x % 32, y, 32), pixel(whole, x, y));
  }
});
test('coast outline stays above pigment but below a crossing river', () => {
  const records = land(),
    image = new LandscapeRasterizer(box, 64, 32);
  for (const r of records) image.paint(r);
  image.paintColor({
    ...area(-100, -100, 100, 200),
    values: {},
    points: [{ x: 0, y: 0 }],
    polygons: brushFootprint([{ x: 0, y: 0 }], 20),
    paint: {
      version: 1,
      target: 'ground',
      color: '#ff0000',
      opacity: 1,
      flow: 1,
      tip: 'round',
      radius: 20,
      seed: 1,
      fill: false,
    },
  });
  image.paintLine(
    [
      { x: -10, y: 0 },
      { x: 10, y: 0 },
    ],
    4,
    '#123456',
  );
  assert.deepEqual(pixel(image.finish(), 31, 16), [18, 52, 86, 255]);
  assert.deepEqual(
    pixel(image.finish(), 31, 8),
    [191, 37, 24, 255],
    'Narrow coast ink remains visible over painted land',
  );
  assert.deepEqual(
    pixel(image.finish(), 30, 8),
    [255, 0, 0, 255],
    'Coast ink does not spread into adjacent pigment',
  );
  assert.deepEqual(image.finish(), image.finish(), 'finishing twice cannot accumulate coast ink');
});

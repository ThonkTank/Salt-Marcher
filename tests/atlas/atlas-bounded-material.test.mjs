import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  stdin: {
    contents: `export * from './src/app/atlas/landscape-raster';export * from './src/app/atlas/raster-polygon-coverage';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/vegetation';export * from './src/app/atlas/atlas-landscape';`,
    resolveDir: process.cwd(),
  },
  outfile: '.build/bounded-material-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { LandscapeRasterizer, polygonCoverageRows, settingsRecord, vegetationSpec, emptyRecord } =
  createRequire(import.meta.url)('../../.build/bounded-material-test.cjs');
const rect = (x, y, w, h) => ({
  outer: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
  holes: [],
});
const finish = (steps) => {
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
  }
};
function raster(box, polygons, { edge = 0, curved = false, pixels = 256 } = {}) {
  const image = new LandscapeRasterizer(box, pixels, pixels, 0, box.width / pixels, true, {
    samples: 4,
    areaCoverage: true,
    worldFeather: true,
  });
  image.paint(settingsRecord(0));
  const l = image.sampleLattice(),
    heights = new Float32Array(l.columns * l.rows),
    water = new Uint8Array(heights.length);
  for (let y = 0; y < l.rows; y++)
    for (let x = 0; x < l.columns; x++)
      heights[y * l.columns + x] = curved
        ? 2600 + 400 * Math.sin((l.x + x * l.dx) / 35) * Math.cos((l.y + y * l.dy) / 42)
        : 100;
  image.setTerrainField({ heights, water });
  const spec = vegetationSpec();
  spec.preset.edge = edge;
  spec.preset.density = 0.8;
  finish(
    image.paintCoverSteps(
      { ...emptyRecord('vegetation'), polygons, vegetation: spec },
      function* () {},
    ),
  );
  return finish(image.materialChannelsSteps(function* () {}));
}
const area = (bytes, box) =>
  (bytes.reduce((sum, value) => sum + value / 255, 0) * box.width * box.height) / 65536;
test('150 square metre subpixel forest survives overview and all sixteen children', () => {
  const box = { x: 0, y: 0, width: 1024, height: 1024 },
    strip = [rect(200, 100, 0.25, 600)];
  const coarse = area(raster(box, strip).forest, box);
  let fine = 0;
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      const b = { x: x * 256, y: y * 256, width: 256, height: 256 };
      fine += area(raster(b, strip).forest, b);
    }
  assert(Math.abs(coarse - 150) <= 1, `coarse ${coarse}`);
  assert(Math.abs(fine - 150) <= 1, `fine ${fine}`);
});
test('pixel clipping retains holes, concave disconnected pieces and translated thin polygons', () => {
  const polygon = {
    outer: rect(0.1, 0.1, 3.8, 3.8).outer,
    holes: [rect(0.8, 0.8, 2.4, 2.4).outer],
  };
  let total = 0;
  for (const row of polygonCoverageRows([polygon.outer, ...polygon.holes], 4, 4))
    total += row.values.reduce((a, b) => a + b, 0);
  assert(Math.abs(total - (3.8 ** 2 - 2.4 ** 2)) < 1e-6);
  const u = [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 3 },
    { x: 2, y: 3 },
    { x: 2, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 3 },
    { x: 0, y: 3 },
  ];
  total = 0;
  for (const row of polygonCoverageRows([u], 3, 3)) total += row.values.reduce((a, b) => a + b, 0);
  assert.equal(total, 7);
  const box = { x: 2 ** 30, y: -(2 ** 30), width: 1024, height: 1024 };
  const translated = area(raster(box, [rect(box.x + 200, box.y + 100, 0.25, 600)]).forest, box);
  assert(Math.abs(translated - 150) <= 1, `${translated}`);
});
test('curved relief finishes with fixed sampling and finite channels without an adaptive work budget', () => {
  const result = raster({ x: 0, y: 0, width: 256, height: 256 }, [], { curved: true });
  assert(result.rock.some((x) => x > 0));
  assert(result.snow.some((x) => x > 0));
  for (const channel of ['baseColor', 'water', 'forest', 'rock', 'snow'])
    assert(result[channel] instanceof Uint8Array);
  assert(result.waterTopology instanceof Uint16Array);
});

test('polygons outside a tile do not wrap typed-array fill ranges into visible pixels', () => {
  for (const x of [-100, -5, 10, 100]) {
    let area = 0;
    for (const row of polygonCoverageRows([rect(x, 0.2, 2, 3).outer], 4, 4))
      area += row.values.reduce((a, b) => a + b, 0);
    assert.equal(area, 0, `outside x=${x}`);
  }
  let area = 0;
  for (const row of polygonCoverageRows([rect(-2, -2, 8, 8).outer], 4, 4))
    area += row.values.reduce((a, b) => a + b, 0);
  assert.equal(area, 16);
});

test('fixed 64-pixel batches retain the unsplit tile sample phase and polygon edge coverage', () => {
  const box = { x: -23, y: 17, width: 256, height: 256 },
    polygons = [rect(15.3, 45.7, 80.2, 60.8)];
  const whole = raster(box, polygons, { curved: true });
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      const part = raster(
        { x: box.x + x * 64, y: box.y + y * 64, width: 64, height: 64 },
        polygons,
        { curved: true, pixels: 64 },
      );
      for (const channel of ['baseColor', 'water', 'forest', 'rock', 'snow']) {
        const stride = channel === 'baseColor' ? 4 : 1;
        for (let row = 0; row < 64; row++)
          assert.deepEqual(
            part[channel].subarray(row * 64 * stride, (row + 1) * 64 * stride),
            whole[channel].subarray(
              ((y * 64 + row) * 256 + x * 64) * stride,
              ((y * 64 + row) * 256 + x * 64 + 64) * stride,
            ),
            channel,
          );
      }
    }
});

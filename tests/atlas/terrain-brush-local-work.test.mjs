import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({
  stdin: {
    contents:
      "export * from './src/app/atlas/terrain-brush';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/land-mask';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const {
  prepareHeightBrush,
  applyTerrainBrush,
  heightBrushPixel,
  heightBrushAmount,
  editHeight,
  strokeBox,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')
);
// Real trusted input at 75 degrees after two local gestures: the final screen
// segment crosses a silhouette and picks the more distant visible ground.
const stroke = {
  seed: 3671492591,
  mode: 'raise',
  preserveDetails: true,
  strength: 0.3,
  feather: 0.7,
  roughness: 0,
  radius: 0.7,
  samples: [
    {
      x: -119.99999988582645,
      y: -99.99999574373359,
      t: 0,
    },
    {
      x: -119.98839259613361,
      y: -99.9835875645405,
      t: 64.80000001192093,
    },
    {
      x: -119.86347093209001,
      y: -99.80699706813975,
      t: 762.1999999880791,
    },
    {
      x: -119.86347093209001,
      y: -99.80699706813975,
      t: 762.1999999880791,
    },
    {
      x: -119.52426265353674,
      y: -108.78061705744452,
      t: 1447.8999999761581,
    },
    {
      x: -119.21587350249996,
      y: -116.93892929566935,
      t: 2071.300000011921,
    },
    {
      x: -118.94582275252567,
      y: -124.08301439415658,
      t: 2617.199999988079,
    },
    {
      x: -118.94582275252567,
      y: -124.08301439415658,
      t: 2617.199999988079,
    },
    {
      x: -118.94582275252567,
      y: -124.08301439415658,
      t: 3234.800000011921,
    },
    {
      x: -118.94582275252567,
      y: -124.08301439415658,
      t: 3277.800000011921,
    },
  ],
};
function referenceDose(dabs, p, s) {
  let total = 0;
  for (const d of dabs) {
    const r = Math.hypot(p.x - d.x, p.y - d.y) / s.radius;
    if (r >= 1) continue;
    const t = s.feather === 0 ? 1 : Math.min(1, (1 - r) / s.feather);
    total += d.seconds * t * t * (3 - 2 * t);
  }
  return total;
}
test('real silhouette-crossing input visits local dab support and retains every Float32 author node', () => {
  const { dabs, dose, tilePairs } = prepareHeightBrush(stroke),
    box = strokeBox(stroke),
    pixel = heightBrushPixel(stroke.radius),
    edge = pixel * 64;
  const tiles =
    (Math.floor((box.x + box.width) / edge) - Math.floor(box.x / edge) + 1) *
    (Math.floor((box.y + box.height) / edge) - Math.floor(box.y / edge) + 1);
  assert.equal(dabs.length, 304);
  assert.equal(tiles, 78);
  assert.equal(dabs.length * tiles * 4096, 97124352);
  assert.equal(tilePairs, 1599);
  assert(tilePairs * 4096 < 60000000);
  for (let y = -126; y <= -98; y += 0.125)
    for (let x = -122; x <= -117; x += 0.125)
      assert.equal(
        dose({ x, y }),
        referenceDose(dabs, { x, y }, stroke),
        'exact exposure, including negative tile edges',
      );
  const reference = editHeight(
    [],
    box,
    pixel,
    (p, prior) => {
      const exposure = referenceDose(dabs, p, stroke);
      return exposure ? prior + heightBrushAmount(stroke, p, exposure) : undefined;
    },
    2,
  );
  assert.deepEqual(
    applyTerrainBrush([], stroke),
    reference,
    'identical records and encoded Float32 bytes',
  );
});
test('moving/holding event density preserves the original dose and the work cap remains enforced', () => {
  for (const s of [
    stroke,
    {
      ...stroke,
      samples: [
        { x: -1, y: -1, t: 0 },
        { x: -1, y: -1, t: 4000 },
      ],
    },
    {
      ...stroke,
      samples: Array.from({ length: 31 }, (_, i) => ({ x: -1 + i / 30, y: -1, t: i * 100 })),
    },
  ]) {
    const { dabs, dose } = prepareHeightBrush(s);
    for (const p of [
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: -119.9, y: -100 },
      { x: -118.9, y: -124 },
    ])
      assert.equal(dose(p), referenceDose(dabs, p, s));
  }
  const heavy = {
    ...stroke,
    samples: Array.from({ length: 2000 }, (_, i) => ({
      x: -120 + (i % 2) * 0.2,
      y: -100,
      t: i * 10,
    })),
  };
  assert(prepareHeightBrush(heavy).tilePairs * 4096 > 60000000);
  assert.throws(() => applyTerrainBrush([], heavy), /Höhenzug zu lang/);
});

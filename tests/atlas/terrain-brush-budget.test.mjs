import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  stdin: {
    resolveDir: process.cwd(),
    contents:
      "export {applyTerrainBrush,prepareHeightBrush,heightBrushDabs} from './src/app/atlas/terrain-brush';export {TerrainSampler} from './src/app/atlas/terrain-height';",
  },
  outfile: '.build/terrain-brush-budget.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { applyTerrainBrush, prepareHeightBrush, TerrainSampler } = createRequire(import.meta.url)(
  '../../.build/terrain-brush-budget.cjs',
);
const continental = {
  mode: 'roughen',
  radius: 1000000,
  strength: 550,
  feather: 0.8,
  roughness: 0,
  seed: 42,
  samples: [
    { x: -10000000, y: -5916666.666666666, t: 0 },
    { x: -7600000, y: -3845833.333333333, t: 6000 },
    { x: -6400000, y: -591666.666666666, t: 12000 },
    { x: -7600000, y: 2958333.333333334, t: 18000 },
  ],
};

test('continental dose candidates preserve the full ordered integration at radius-cell boundaries and distant coordinates', () => {
  const { dabs, dose } = prepareHeightBrush(continental);
  for (const point of [
    ...continental.samples,
    { x: -7000000, y: 0 },
    { x: -6999999.999, y: -0.001 },
    { x: 1, y: 1 },
  ]) {
    let expected = 0;
    for (const dab of dabs) {
      const r = Math.hypot(point.x - dab.x, point.y - dab.y) / continental.radius;
      if (r >= 1) continue;
      const t = Math.min(1, (1 - r) / continental.feather);
      expected += dab.seconds * t * t * (3 - 2 * t);
    }
    assert.equal(dose(point), expected);
  }
});

test('the ordinary continental roughening gesture remains within the spatial work bound and authors actual height records', () => {
  const records = applyTerrainBrush([], continental);
  assert(records.some((r) => r.height));
  const sampler = new TerrainSampler(records);
  assert.notEqual(sampler.sample({ x: -7600000, y: -3845833.333333333 }).heightM, -100);
  assert.equal(sampler.sample({ x: 20000000, y: 20000000 }).heightM, -100);
});

test('the brush still rejects an actually excessive local dose workload', () => {
  const overloaded = {
    ...continental,
    radius: 64,
    samples: Array.from({ length: 2000 }, (_, i) => ({ x: (i % 2) * 8, y: 0, t: i * 34 })),
  };
  assert.throws(() => applyTerrainBrush([], overloaded), /Höhenzug zu lang/);
});

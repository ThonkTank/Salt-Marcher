import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  stdin: {
    resolveDir: process.cwd(),
    contents:
      "export * from './src/app/atlas/vegetation-geometry';export * from './src/app/atlas/vegetation-shape';export {vegetationCrownScale} from './src/app/atlas/vegetation-lod';export * as THREE from 'three';",
  },
  outfile: '.build/vegetation-geometry-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const {
  vegetationGeometry,
  vegetationFootprintRadius,
  vegetationCrownScale,
  crownTone,
  AtlasSpatialVegetation,
  THREE,
} = createRequire(import.meta.url)('../../.build/vegetation-geometry-test.cjs');
test('shared tree models keep finite metre bounds and bounded triangle budgets', () => {
  for (const asset of ['oak', 'pine']) {
    const g = vegetationGeometry(asset, 'crown');
    try {
      assert(g.index.count / 3 <= 144, 'shared crown budget');
      for (const name of ['position', 'normal', 'color'])
        assert([...g.getAttribute(name).array].every(Number.isFinite), asset + ' ' + name);
      g.computeBoundingBox();
      const b = g.boundingBox;
      assert(b.min.z >= 0.15 && b.max.z <= 1.001);
      assert(b.min.x >= -0.4 && b.max.x <= 0.4 && b.min.y >= -0.4 && b.max.y <= 0.4);
      assert(b.max.x - b.min.x > 0.5, 'readable crown width');
    } finally {
      g.dispose();
    }
  }
  const tones = Array.from({ length: 50 }, (_, n) => crownTone('tree:' + n));
  assert(new Set(tones).size > 40);
  assert(tones.every((t) => t >= 0.88 && t < 1.1));
  assert.equal(crownTone('ancient-oak'), crownTone('ancient-oak'));
});

test('automatic placement envelope contains rendered models at every crown display scale and rock orientation', () => {
  for (const asset of ['oak', 'pine', 'shrub', 'grass', 'rock']) {
    const g = vegetationGeometry(asset, 'crown'),
      positions = g.getAttribute('position'),
      size = 17;
    try {
      for (const mpp of [0.1, 1, 2, 4, 8, 64]) {
        const scale = ['oak', 'pine'].includes(asset) ? vegetationCrownScale(size, mpp, 4) : 1;
        for (let n = 0; n < positions.count; n++) {
          // A rock's normal may rotate any model vector into the horizontal plane.
          const radius =
            asset === 'rock'
              ? Math.hypot(positions.getX(n), positions.getY(n), positions.getZ(n))
              : Math.hypot(positions.getX(n), positions.getY(n)) * scale;
          assert(
            radius * size <= vegetationFootprintRadius(asset, size) + 1e-6,
            asset + ' model exceeded its placement envelope',
          );
        }
      }
    } finally {
      g.dispose();
    }
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents:
      "export * from './src/app/vegetation';export * from './src/app/vegetation-lod';export * from './src/app/atlas-deck-vegetation';export {atlasMetricFrame} from './src/app/atlas-metric-camera';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/vegetation-lod-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const {
  vegetationSpec,
  vegetationRepresentative,
  vegetationStride,
  vegetationGrid,
  vegetationScaleLimit,
  vegetationOpacity,
  AtlasDeckVegetation,
  atlasMetricFrame,
} = require('../.build/vegetation-lod-test.cjs');
test('every coarse representative survives from its child, including negative cells and multiple seeds', () => {
  for (const seed of [0, 1, 123, 4294967295])
    for (const stride of [2, 4, 8, 16, 64, 256])
      for (let x = -4 * stride; x <= 4 * stride; x += stride)
        for (let y = -4 * stride; y <= 4 * stride; y += stride) {
          const p = vegetationRepresentative(seed, x, y, stride),
            half = stride / 2;
          assert(p.x >= x && p.x < x + stride && p.y >= y && p.y < y + stride);
          assert.deepEqual(
            p,
            vegetationRepresentative(
              seed,
              Math.floor(p.x / half) * half,
              Math.floor(p.y / half) * half,
              half,
            ),
          );
        }
});
test('a removed candidate is already invisible before any coarser source arrives', () => {
  for (const spacing of [2, 12, 60, 1000])
    for (const layout of ['natural', 'row']) {
      const spec = { ...vegetationSpec(), spacing, layout };
      for (let x = -20; x <= 20; x++)
        for (let y = -4; y <= 4; y++) {
          const i = { id: layout === 'row' ? `row:${x}` : `tree:${x}:${y}`, asset: 'oak' },
            limit = vegetationScaleLimit(i, spec);
          for (const mpp of [1, 1.9, 2.001, 3, 4, 8, 20, 79, 81]) {
            const stride = vegetationStride(spacing, mpp),
              p = vegetationRepresentative(
                spec.seed,
                Math.floor(x / stride) * stride,
                Math.floor(y / stride) * stride,
                stride,
              );
            const present =
              mpp <= 80 && (layout === 'row' ? x % stride === 0 : p.x === x && p.y === y);
            if (!present) assert.equal(vegetationOpacity(mpp, limit), 0);
          }
        }
    }
});
test('undergrowth fades at detail scale and protected objects stay visible', () => {
  const spec = vegetationSpec();
  for (const asset of ['shrub', 'grass', 'rock']) {
    const i = { id: 'under:0:0', asset },
      limit = vegetationScaleLimit(i, spec);
    assert.equal(limit, 2);
    assert.equal(vegetationOpacity(1, limit), 1);
    assert.equal(vegetationOpacity(1.75, limit), 0.5);
    assert.equal(vegetationOpacity(2, limit), 0);
    assert.equal(vegetationOpacity(1000, vegetationScaleLimit({ ...i, protected: true }, spec)), 1);
  }
});
function fixture(protectedObject = false) {
  const i = {
    id: 'row:1',
    asset: 'oak',
    x: 0,
    y: 0,
    z: 0,
    size: 10,
    angle: 0,
    normal: { x: 0, y: 0, z: 1 },
    protected: protectedObject,
  };
  const spec = vegetationSpec();
  spec.spacing = 12;
  spec.layout = 'row';
  const vegetation = new AtlasDeckVegetation(
    [{ id: 'wood', vegetation: spec, vegetationView: { mode: 'individual', instances: [i] } }],
    { origin: { x: 0, y: 0 }, focusM: 0, exaggeration: 1 },
  );
  const pick = (mpp, x) =>
    vegetation.hit(
      atlasMetricFrame(
        {
          focus: { x: 0, y: 0 },
          focusHeightM: 0,
          metersPerPixel: mpp,
          rotation: 0,
          tilt: 0,
          exaggeration: 1,
        },
        100,
        100,
      ),
      { x: 50 + x / mpp, y: 50 },
      ['vegetation-trees'],
    );
  return { vegetation, pick };
}
test('local crowns retain physical size during camera-only zoom, then ignore faded trees', () => {
  const { vegetation, pick } = fixture();
  try {
    const before = vegetation.batches.map((b) => b.data);
    assert.equal(pick(0.5, 4.2), null);
    assert.equal(pick(1.5, 4.2), null);
    assert.equal(pick(1.5, 0)?.data.vegetationInstance, 'row:1');
    assert.equal(pick(2.1, 0), null);
    assert.deepEqual(
      vegetation.batches.map((b) => b.data),
      before,
    );
  } finally {
    vegetation.dispose();
  }
});
test('protected crowns retain physical size and remain pickable beyond automatic levels', () => {
  const { vegetation, pick } = fixture(true);
  try {
    assert.equal(pick(1.5, 4.2), null);
    assert.equal(pick(100, 0)?.data.vegetationInstance, 'row:1');
  } finally {
    vegetation.dispose();
  }
});

test('buffered forest grids bound actual inclusive candidates with stable parent cells', () => {
  for (const spacing of [2, 12, 60])
    for (const mpp of [0.5, 1.9, 2.01, 20])
      for (const offset of [-60000, -1200, 0, 37]) {
        const b = { x: offset, y: offset - 100, right: offset + 2400, bottom: offset + 1944 },
          g = vegetationGrid(spacing, mpp, b);
        const count =
          (Math.floor((g.x1 - g.x0) / g.stride) + 1) * (Math.floor((g.y1 - g.y0) / g.stride) + 1);
        assert(count <= 24000);
        assert(g.stride >= vegetationStride(spacing, mpp));
        assert.equal(Math.log2(g.stride) % 1, 0);
        const p = vegetationRepresentative(123, g.x0, g.y0, g.stride);
        assert.deepEqual(
          p,
          vegetationRepresentative(
            123,
            Math.floor(p.x / Math.min(2, g.stride)) * Math.min(2, g.stride),
            Math.floor(p.y / Math.min(2, g.stride)) * Math.min(2, g.stride),
            Math.min(2, g.stride),
          ),
        );
      }
  const empty = vegetationGrid(12, 1, { x: 100, y: 100, right: -100, bottom: -100 });
  assert(empty.x0 > empty.x1);
});

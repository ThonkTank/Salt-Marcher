import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  entryPoints: ['src/app/storage/terrain-color-raster.ts'],
  outfile: '.build/terrain-coverage-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { terrainColorRoutes } = createRequire(import.meta.url)(
  '../.build/terrain-coverage-test.cjs',
);
test('distant routes cannot evict nearby author vectors from the bounded retained set', () => {
  const focus = { x: -10, y: -10, width: 20, height: 20 },
    context = { x: -1000, y: -1000, width: 2000, height: 2000 },
    near = { id: 'near' },
    far = Array.from({ length: 700 }, (_, i) => ({ id: 'far' + i }));
  const stream = (_kind, area) => (area === focus ? [near] : [...far, near]);
  const result = terrainColorRoutes(stream, context, focus);
  assert.equal(result.routes.length, 500);
  assert.equal(result.routes[0], near);
  assert(result.denseRoutes);
  assert.equal(result.retainedRoutes.size, 500);
});

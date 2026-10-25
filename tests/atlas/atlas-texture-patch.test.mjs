import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({
  entryPoints: ['src/app/atlas/atlas-texture-patch.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { atlasTexturePatch } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')
);
test('retained and identical texture data require no upload; edge edits use a bounded rectangle', () => {
  const a = { width: 256, height: 256, data: new Uint8Array(256 * 256 * 4) };
  assert.equal(atlasTexturePatch(a, { ...a }), null);
  assert.equal(atlasTexturePatch(a, { ...a, data: a.data.slice() }), null);
  const b = { ...a, data: a.data.slice() };
  b.data[(255 * 256 + 254) * 4 + 2] = 255;
  b.data[(253 * 256 + 255) * 4 + 3] = 40;
  assert.deepEqual(atlasTexturePatch(a, b), { x: 254, y: 253, width: 2, height: 3 });
  const rect = atlasTexturePatch(a, b),
    rebuilt = a.data.slice();
  for (let y = rect.y; y < rect.y + rect.height; y++)
    rebuilt.set(
      b.data.subarray((y * 256 + rect.x) * 4, (y * 256 + rect.x + rect.width) * 4),
      (y * 256 + rect.x) * 4,
    );
  assert.deepEqual(rebuilt, b.data);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

test('desktop renderer bundles for a browser without privileged imports', async () => {
  const result = await build({
    entryPoints: ['src/app/renderer.ts'],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
    write: false,
    metafile: true,
  });
  const forbidden = Object.keys(result.metafile.inputs).filter((name) =>
    /(^|\/)(obsidian|electron|pngjs)(\/|$)|node:/.test(name),
  );
  assert.deepEqual(forbidden, []);
  assert(result.outputFiles[0].contents.length > 0);
});

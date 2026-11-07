import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDesktopStyles } from '../../tools/desktop-styles.mjs';

test('desktop CSS resolves all local surface imports into the one shipped stylesheet', async () => {
  const result = await buildDesktopStyles({ write: false });
  assert.equal(result.outputFiles.length, 1);
  const css = result.outputFiles[0].text;
  assert.doesNotMatch(css, /@import\b/);
  assert.doesNotMatch(css, /url\(\s*["']?https?:/);
  const inputs = Object.keys(result.metafile.inputs);
  for (const surface of [
    'shared/base',
    'shared/controls',
    'workspace/workspace',
    'campaign/npc',
    'catalog/catalog',
    'runtime/combat',
    'runtime/music',
    'runtime/world',
    'atlas/atlas',
    'atlas/atlas-workspace',
    'campaign/key-notes',
    'shared/markdown-view',
  ]) {
    assert(
      inputs.includes('src/app/' + surface + '.css'),
      surface + ' is absent from the shipped CSS',
    );
  }
  assert(css.includes('#world-map'), 'travel map rules must reach the app');
  assert(css.includes('.catalog-heading'), 'catalog layout must reach the app');
  assert(css.includes('body.atlas-workspace'), 'Atlas shell rules must reach the app');
  assert(
    Object.values(result.metafile.outputs).every((output) => output.imports.length === 0),
    'No runtime CSS import may escape the offline bundle',
  );
});

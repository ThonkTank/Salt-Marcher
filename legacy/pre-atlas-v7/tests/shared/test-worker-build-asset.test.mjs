import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  symlinkSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ensureTestAsset } from '../../tools/test-assets.mjs';
import { buildSync } from '../helpers/build.mjs';
const require = createRequire(import.meta.url);
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'worker-build-asset-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (file, text) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  };
  write(
    'desktop/atlas-region-worker.ts',
    "import { shared } from '../src/shared'; export { shared }; export const mode = typeof CUSTOM_MODE === 'undefined' ? 'default' : CUSTOM_MODE;",
  );
  write('src/shared.ts', 'export const shared = 1;');
  write('src/features/catalog/data/srd-5.1.generated.json', '[]');
  write('package.json', '{"type":"module"}');
  write('package-lock.json', '{}');
  write('tsconfig.json', '{}');
  for (const file of [
    'tools/build-test-assets.mjs',
    'tools/test-assets.mjs',
    'tests/helpers/build.mjs',
  ]) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    copyFileSync(file, path.join(root, file));
  }
  symlinkSync(path.resolve('node_modules'), path.join(root, 'node_modules'), 'dir');
  const load = (file) => {
    delete require.cache[file];
    return require(file);
  };
  return { root, write, load };
}

test('worker artifacts verify output and invalidate transitive sources, desktop sources and build helper identity', (t) => {
  const x = fixture(t),
    first = ensureTestAsset('atlas-region-worker', x.root);
  assert.equal(x.load(first).shared, 1);
  assert.equal(ensureTestAsset('atlas-region-worker', x.root), first);
  x.write('src/shared.ts', 'export const shared = 2;');
  const changed = ensureTestAsset('atlas-region-worker', x.root);
  assert.notEqual(changed, first);
  assert.equal(x.load(changed).shared, 2);
  const worker = readFileSync(path.join(x.root, 'desktop/atlas-region-worker.ts'), 'utf8');
  x.write('desktop/atlas-region-worker.ts', worker + ' export const desktopRevision = 3;');
  const desktop = ensureTestAsset('atlas-region-worker', x.root);
  assert.notEqual(desktop, changed);
  assert.equal(x.load(desktop).desktopRevision, 3);
  const helper = readFileSync(path.join(x.root, 'tests/helpers/build.mjs'), 'utf8');
  x.write('tests/helpers/build.mjs', helper + '\n// changed preparation identity\n');
  const identity = ensureTestAsset('atlas-region-worker', x.root);
  assert.notEqual(identity, desktop);
  assert.equal(x.load(identity).desktopRevision, 3);
  writeFileSync(identity, 'module.exports={shared:999};');
  assert.equal(ensureTestAsset('atlas-region-worker', x.root), identity);
  assert.equal(x.load(identity).shared, 2, 'damaged output is rebuilt before use');
  const manifestFile = path.join(path.dirname(identity), 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  const catalog = path.join(path.dirname(identity), 'catalog/srd-5.1.generated.json');
  rmSync(catalog);
  delete manifest.outputs['catalog/srd-5.1.generated.json'];
  writeFileSync(manifestFile, JSON.stringify(manifest));
  assert.equal(ensureTestAsset('atlas-region-worker', x.root), identity);
  assert.equal(
    readFileSync(catalog, 'utf8'),
    '[]',
    'incomplete manifest cannot approve missing output',
  );
});

test('the build helper shares only exact worker options and custom options retain their own compiled result', (t) => {
  const x = fixture(t),
    previous = process.cwd();
  try {
    process.chdir(x.root);
    const options = {
      entryPoints: ['desktop/atlas-region-worker.ts'],
      outfile: '.build/worker-alias.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    };
    buildSync(options);
    const alias = path.resolve(options.outfile),
      standard = x.load(alias);
    assert.equal(standard.shared, 1);
    assert.equal(standard.mode, 'default');
    assert.match(readFileSync(alias, 'utf8'), /^module.exports = require/);
    buildSync({
      ...options,
      absWorkingDir: x.root,
      outfile: '.build/custom.cjs',
      define: { CUSTOM_MODE: JSON.stringify('custom') },
    });
    assert.equal(x.load(path.resolve('.build/custom.cjs')).mode, 'custom');
    assert.equal(x.load(alias).mode, 'default');
    assert.doesNotMatch(readFileSync('.build/custom.cjs', 'utf8'), /^module.exports = require/);
  } finally {
    process.chdir(previous);
  }
});

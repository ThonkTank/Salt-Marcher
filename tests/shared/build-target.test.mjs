import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { activeTests } from '../../tools/test-selection.mjs';
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'build-target-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'tools'));
  copyFileSync('build.mjs', path.join(root, 'build.mjs'));
  writeFileSync(
    path.join(root, 'tools/build-desktop.mjs'),
    "import {writeFileSync} from 'node:fs';writeFileSync('desktop-built','yes');",
  );
  writeFileSync(
    path.join(root, 'tools/test-assets.mjs'),
    "import {appendFileSync} from 'node:fs';export const prepareTestCatalog=()=>appendFileSync('prepared','catalog\\n');export const ensureTestAsset=kind=>kind;export const publishTestAlias=(kind,target)=>appendFileSync('prepared',kind+':'+target+'\\n');",
  );
  return {
    root,
    run: (args) =>
      spawnSync(process.execPath, ['build.mjs', ...args], { cwd: root, encoding: 'utf8' }),
  };
}
test('default public build invokes desktop without loading a historical builder', (t) => {
  const { root, run } = fixture(t);
  const result = run([]);
  assert.equal(result.status, 0, result.stderr);
  assert(existsSync(path.join(root, 'desktop-built')));
  assert(!existsSync(path.join(root, 'prepared')));
});
test('test preparation keeps both aliases without invoking the desktop builder', (t) => {
  const { root, run } = fixture(t);
  const result = run(['--test']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    readFileSync(path.join(root, 'prepared'), 'utf8'),
    'catalog\ncore:.build/tests.cjs\nstore:.build/test-shared/store.cjs\n',
  );
  assert(!existsSync(path.join(root, 'desktop-built')));
});
test('unknown build options fail before producing output', (t) => {
  const { root, run } = fixture(t);
  assert.notEqual(run(['--legacy']).status, 0);
  assert(!existsSync(path.join(root, 'desktop-built')));
});
test('historical adapter build probe is explicitly callable but absent from active suite', () => {
  assert(!activeTests().includes('tests/legacy-reference/obsidian-build.test.mjs'));
  const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
  assert.match(scripts['test:legacy:obsidian'], /tests\/legacy-reference\/obsidian-build.test.mjs/);
});

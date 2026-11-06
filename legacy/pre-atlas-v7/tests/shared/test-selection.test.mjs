import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { activeTests, selectTests } from '../../tools/test-selection.mjs';

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'test-selection-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const file of [
    'tests/direct.test.mjs',
    ...['workspace', 'atlas', 'campaign', 'runtime', 'catalog', 'shared'].map(
      (domain) => `tests/${domain}/nested/view.test.mjs`,
    ),
    'tests/native-reference/source.test.mjs',
    'tests/fixtures/example.test.mjs',
  ]) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), '');
  }
  return root;
}

test('active discovery includes domain tests but excludes reference and fixture suites', (t) => {
  const files = activeTests(fixture(t));
  assert(files.includes('tests/direct.test.mjs'));
  for (const domain of ['workspace', 'atlas', 'campaign', 'runtime', 'catalog', 'shared'])
    assert(files.includes(`tests/${domain}/nested/view.test.mjs`));
  assert(!files.some((file) => /native-reference|fixtures|adr-prototypes|tests.cjs/.test(file)));
  assert.equal(new Set(files).size, files.length);
});
test('explicit selection is validated, normalized and deduplicated', (t) => {
  const root = fixture(t);
  assert.deepEqual(
    selectTests(
      ['--serial', './tests/direct.test.mjs', '--list', path.join(root, 'tests/direct.test.mjs')],
      root,
    ),
    {
      serial: true,
      list: true,
      files: ['tests/direct.test.mjs'],
    },
  );
  assert.throws(() => selectTests(['tests/shared/core.test.ts'], root));
  assert.throws(() => selectTests(['.build/tests.cjs'], root));
  assert.deepEqual(selectTests(['tests/native-reference/source.test.mjs'], root).files, [
    'tests/native-reference/source.test.mjs',
  ]);
});
test('empty, missing, unsupported, outside and directory selections fail before execution', (t) => {
  const root = fixture(t);
  for (const arg of [
    '',
    '--unknown',
    'tests/missing.test.mjs',
    'tests',
    '../outside.test.mjs',
    'package.json',
  ])
    assert.throws(() => selectTests([arg], root));
});
test('serial and listing flags retain the same complete selection', (t) => {
  const root = fixture(t);
  assert.deepEqual(selectTests([], root).files, selectTests(['--serial', '--list'], root).files);
});
test('listing CLI runs without dependencies or build preparation', (t) => {
  const root = fixture(t);
  const result = spawnSync(process.execPath, [path.resolve('tools/run-tests.mjs'), '--list'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert(result.stdout.includes('tests/direct.test.mjs'));
  assert.deepEqual(readdirSync(root), ['tests']);
  const failure = spawnSync(
    process.execPath,
    [path.resolve('tools/run-tests.mjs'), 'tests/missing.test.mjs'],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(failure.status, 1);
  assert.match(failure.stderr, /does not exist/);
  assert.deepEqual(readdirSync(root), ['tests']);
});
test('explicit concurrency accepts positive integers and rejects ambiguous combinations', (t) => {
  const root = fixture(t);
  assert.equal(selectTests(['--concurrency=2'], root).concurrency, 2);
  for (const flag of [
    '--concurrency=0',
    '--concurrency=-1',
    '--concurrency=1.5',
    '--concurrency=NaN',
  ])
    assert.throws(() => selectTests([flag], root));
  assert.throws(() => selectTests(['--serial', '--concurrency=2'], root));
});

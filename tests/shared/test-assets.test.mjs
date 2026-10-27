import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepareArtifact, treeFingerprint } from '../../tools/test-assets.mjs';
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'test-assets-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'src'));
  writeFileSync(path.join(root, 'src/a.ts'), 'one');
  return root;
}
test('content cache invalidates changed, added, removed inputs and damaged outputs', (t) => {
  const root = fixture(t);
  let builds = 0;
  let version = 1;
  const opts = {
    root,
    kind: 'fixture',
    fingerprint: () => treeFingerprint(root, ['src/'], { version }),
    outputs: ['bundle.cjs'],
    build: (dir) => {
      builds++;
      writeFileSync(path.join(dir, 'bundle.cjs'), 'module.exports=1');
    },
  };
  const first = prepareArtifact(opts);
  assert.equal(first.cache, 'miss');
  assert.equal(prepareArtifact(opts).cache, 'hit');
  assert.equal(builds, 1);
  writeFileSync(path.join(root, 'src/a.ts'), 'two');
  assert.equal(prepareArtifact(opts).cache, 'miss');
  writeFileSync(path.join(root, 'src/b.ts'), 'new');
  assert.equal(prepareArtifact(opts).cache, 'miss');
  rmSync(path.join(root, 'src/b.ts'));
  assert.equal(prepareArtifact(opts).cache, 'hit'); // exact earlier content remains valid
  version++;
  const changed = prepareArtifact(opts);
  assert.equal(changed.cache, 'miss');
  writeFileSync(path.join(changed.directory, 'bundle.cjs'), 'damaged');
  assert.equal(prepareArtifact(opts).cache, 'miss');
  rmSync(path.join(changed.directory, 'bundle.cjs'));
  assert.equal(prepareArtifact(opts).cache, 'miss');
});
test('failure and changing sources cannot publish a valid cache entry', (t) => {
  const root = fixture(t),
    opts = {
      root,
      kind: 'fixture',
      fingerprint: () => treeFingerprint(root, ['src/'], {}),
      outputs: ['bundle.cjs'],
    };
  assert.throws(
    () =>
      prepareArtifact({
        ...opts,
        build: () => {
          throw Error('compile failed');
        },
      }),
    /compile failed/,
  );
  assert.throws(
    () =>
      prepareArtifact({
        ...opts,
        build: (dir) => {
          writeFileSync(path.join(dir, 'bundle.cjs'), 'bad');
          writeFileSync(path.join(root, 'src/a.ts'), 'changed');
        },
      }),
    /Sources changed/,
  );
  assert.equal(
    prepareArtifact({ ...opts, build: (dir) => writeFileSync(path.join(dir, 'bundle.cjs'), 'ok') })
      .cache,
    'miss',
  );
});
test('a live publication owner is not displaced', (t) => {
  const root = fixture(t),
    lock = path.join(root, '.build/test-assets/fixture.lock');
  mkdirSync(lock, { recursive: true });
  writeFileSync(
    path.join(lock, 'owner.json'),
    JSON.stringify({ pid: process.pid, token: 'other' }),
  );
  assert.throws(() => prepareArtifact({ root, kind: 'fixture', timeoutMs: 1 }), /busy/);
  assert.equal(JSON.parse(readFileSync(path.join(lock, 'owner.json'))).token, 'other');
});

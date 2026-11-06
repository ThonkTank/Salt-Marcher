import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { freshFixtureModule, afterFixture } from '../helpers/fixture-lifecycle.mjs';

test('fresh fixture bundles retain independent mutable state without retaining old modules', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'fixture-modules-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const require = createRequire(path.join(root, 'fixture.cjs'));
  const filename = path.join(root, 'ui.cjs');
  const other = path.join(root, 'other.cjs');
  writeFileSync(filename, 'module.exports = { state: { text: "initial" }, instance: class {} };');
  writeFileSync(other, 'module.exports = { untouched: true };');
  const unrelated = require(other);
  const first = freshFixtureModule(require, filename);
  const oldModule = require.cache[filename];
  first.state.text = 'first fixture';
  const second = freshFixtureModule(require, filename);
  assert.equal(second.state.text, 'initial');
  assert.equal(first.state.text, 'first fixture');
  assert.notEqual(first.instance, second.instance);
  assert(!oldModule.parent.children.includes(oldModule));
  for (let i = 0; i < 20; i++) freshFixtureModule(require, filename);
  const current = require.cache[filename];
  assert.deepEqual(
    current.parent.children.filter((child) => child.filename === filename),
    [current],
  );
  assert.equal(require(other), unrelated);
});

test('fixture cleanup remains awaited, ordered and reports the same failure on repeated invocation', async (t) => {
  const order = [];
  let release;
  const held = new Promise((resolve) => (release = resolve));
  const child = t.test('owned asynchronous cleanup', (t) => {
    afterFixture(t, async () => {
      order.push('cleanup-start');
      await held;
      order.push('cleanup-end');
    });
    t.after(() => order.push('next-hook'));
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(order, ['cleanup-start']);
  release();
  await child;
  assert.deepEqual(order, ['cleanup-start', 'cleanup-end', 'next-hook']);
  let hook;
  const failure = new Error('cleanup failed');
  let calls = 0;
  afterFixture({ after: (callback) => (hook = callback) }, () => {
    calls++;
    throw failure;
  });
  await assert.rejects(hook(), (error) => error === failure);
  await assert.rejects(hook(), (error) => error === failure);
  assert.equal(calls, 1);
});

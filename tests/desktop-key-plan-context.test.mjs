import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from './helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/key-plan-context.ts'],
  outfile: '.build/key-plan-context.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { KeyPlanContext } = createRequire(import.meta.url)('../.build/key-plan-context.cjs');
const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
};
function fixture(open = async () => true) {
  const { document } = parseHTML('<button></button>'),
    button = document.querySelector('button'),
    calls = [];
  let current = true,
    saved = true,
    restoreError = null;
  const back = {
    label: 'Wachstube',
    current: () => current,
    leave: () => calls.push('leave'),
    restore: async () => {
      calls.push('save-before-return');
      if (restoreError) throw restoreError;
      if (!saved) return false;
      calls.push('restored-room');
      return true;
    },
  };
  const ui = new KeyPlanContext(button, {
    prepare: async () => {
      calls.push('prepare');
      return back;
    },
    open: async (id, valid) => {
      calls.push(['plan', id]);
      return open(id, valid);
    },
    showKey: () => calls.push('show-key'),
    tell: (message, error) => calls.push({ message, error }),
  });
  return {
    ui,
    button,
    calls,
    back,
    setCurrent: (v) => (current = v),
    setSaved: (v) => (saved = v),
    setRestoreError: (v) => (restoreError = v),
  };
}
test('one plan identity opens and a blocked plan draft keeps the room return available', async () => {
  const x = fixture();
  await x.ui.open('exact-plan');
  assert.deepEqual(x.calls, ['prepare', 'leave', ['plan', 'exact-plan']]);
  assert.equal(x.button.textContent, 'Zum Raum-Key: Wachstube');
  assert.equal(x.button.hidden, false);
  x.setSaved(false);
  await x.ui.returnToKey();
  assert.equal(x.button.hidden, false);
  assert.equal(x.calls.includes('show-key'), false);
  x.setSaved(true);
  await x.ui.returnToKey();
  assert.equal(x.button.hidden, true);
  assert.equal(x.calls.filter((v) => v === 'show-key').length, 1);
  assert.equal(x.calls.filter(Array.isArray).length, 1);
});
test('a failed plan read restores the room and the same target can be tried again', async () => {
  let fail = true;
  const x = fixture(async () => {
    if (fail) throw Error('Lesen fehlgeschlagen');
    return true;
  });
  await x.ui.open('saved-reference');
  assert(x.calls.includes('restored-room'));
  assert(x.calls.includes('show-key'));
  assert.equal(x.button.hidden, true);
  fail = false;
  await x.ui.open('saved-reference');
  assert.deepEqual(x.calls.filter(Array.isArray), [
    ['plan', 'saved-reference'],
    ['plan', 'saved-reference'],
  ]);
  assert.equal(x.button.hidden, false);
});
test('late navigation failure cannot reopen a key after campaign activation', async () => {
  let reject;
  const x = fixture(() => new Promise((_, r) => (reject = r))),
    pending = x.ui.open('old-plan');
  await settle();
  x.ui.reset();
  reject(Error('Old read failed'));
  await pending;
  assert.equal(x.calls.includes('restored-room'), false);
  assert.equal(x.calls.includes('show-key'), false);
  assert.equal(
    x.calls.some((v) => v?.error),
    false,
  );
  assert.equal(x.button.hidden, true);
});
test('a different selected room revokes an old reference response', async () => {
  let reject;
  const x = fixture(() => new Promise((_, r) => (reject = r))),
    pending = x.ui.open('old-room-plan');
  await settle();
  x.setCurrent(false);
  reject(Error('Old read failed'));
  await pending;
  assert.equal(x.calls.includes('show-key'), false);
  assert.equal(x.button.hidden, true);
});
test('repeated clicks while opening do not dispatch another target and cancellation leaves an explicit return', async () => {
  let release;
  const x = fixture(() => new Promise((r) => (release = r))),
    first = x.ui.open('one-plan');
  await settle();
  const second = x.ui.open('other-plan');
  await x.ui.returnToKey();
  assert.equal(x.calls.filter(Array.isArray).length, 1);
  release(false);
  await Promise.all([first, second]);
  assert.equal(x.calls.includes('show-key'), false);
  assert.equal(x.button.hidden, false);
  await x.ui.returnToKey();
  assert(x.calls.includes('show-key'));
});
test('a return read failure keeps its context available for a later explicit return', async () => {
  const x = fixture();
  await x.ui.open('plan');
  x.setRestoreError(Error('Raum gerade nicht lesbar'));
  await x.ui.returnToKey();
  assert.equal(x.button.hidden, false);
  assert.equal(x.calls.includes('show-key'), false);
  x.setRestoreError(null);
  await x.ui.returnToKey();
  assert.equal(x.button.hidden, true);
  assert(x.calls.includes('show-key'));
});

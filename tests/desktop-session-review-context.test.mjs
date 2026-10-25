import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from './helpers/dom.mjs';
const base = '.build/planner-session-review',
  require = createRequire(import.meta.url);
mkdirSync(base, { recursive: true });
buildSync({
  entryPoints: ['src/app/session-review-ui.ts'],
  outfile: base + '/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const run = () => ({
  id: 'run',
  planId: 'plan',
  proposals: [
    {
      id: 'proposal',
      index: 0,
      revision: 1,
      title: 'Wache',
      notes: '  GM\r\n',
      readAloud: 'Hallo',
      noteIds: [],
      locationId: null,
      acceptedVisitId: null,
      encounter: { sources: [], assessment: { difficulty: 'easy', adjustedXp: 100 } },
      reward: { poolXp: 25, items: [] },
    },
  ],
});
function setup(t) {
  const { window, document } = parseHTML('<html><body><main></main></body></html>'),
    previous = { window: globalThis.window, document: globalThis.document };
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    get() {
      return this._value ?? '';
    },
    set(v) {
      this._value = v;
    },
    configurable: true,
  });
  Object.assign(globalThis, { window, document });
  delete require.cache[require.resolve('../' + base + '/ui.cjs')];
  const { SessionReview } = require('../' + base + '/ui.cjs'),
    calls = [],
    x = {
      window,
      document,
      calls,
      basis: { token: 'token', planId: 'plan', planRevision: 1, request: 0 },
      accept: async () => true,
    };
  x.ui = new SessionReview(
    (...args) => {
      calls.push(args);
      return x.accept(...args);
    },
    () => ({ ...x.basis }),
  );
  const root = document.querySelector('main'),
    dialog = document.getElementById('session-selection-dialog');
  dialog.open = false;
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
  };
  x.dialog = dialog;
  x.confirm = () => document.getElementById('session-selection-confirm');
  x.mount = (source) => {
    root.replaceChildren();
    x.ui.mount(root, source);
    for (const p of source.proposals) {
      const card = document.createElement('article');
      root.append(card);
      x.ui.decorate(card, p, null);
    }
    return root.querySelector('input[type=checkbox]');
  };
  x.select = () => {
    const box = root.querySelector('input[type=checkbox]');
    box.checked = true;
    box.onchange();
  };
  x.review = () => document.getElementById('session-review-selection').click();
  t.after(async () => {
    x.ui.reset();
    await settle();
    Object.assign(globalThis, previous);
  });
  return x;
}
test('a dismissed confirmation cannot execute through its detached handler', async (t) => {
  const x = setup(t);
  x.mount(run());
  x.select();
  x.review();
  const confirm = x.confirm().onclick;
  x.dialog.close();
  confirm();
  await settle();
  assert.equal(x.calls.length, 0);
});
test('an old successful acceptance cannot clear a new selection or close its review in the same plan', async (t) => {
  const x = setup(t),
    reply = deferred();
  x.accept = () => reply.promise;
  x.mount(run());
  x.select();
  x.review();
  x.confirm().click();
  await settle();
  assert.equal(x.calls.length, 1);
  x.ui.reset();
  x.mount(run());
  x.select();
  x.review();
  assert.equal(x.dialog.open, true);
  reply.resolve(true);
  await settle();
  assert.equal(x.dialog.open, true);
  assert.equal(x.document.querySelector('input[type=checkbox]').checked, true);
});
test('a detached checkbox cannot change the selection after the run is refreshed', (t) => {
  const x = setup(t),
    old = x.mount(run());
  x.mount(run());
  old.checked = true;
  old.onchange();
  assert.equal(x.document.querySelector('input[type=checkbox]').checked, false);
});
test('confirmation rejects a changed plan basis and requires a fresh review', async (t) => {
  const x = setup(t);
  x.mount(run());
  x.select();
  x.review();
  x.basis.planRevision++;
  x.confirm().click();
  await settle();
  assert.equal(x.calls.length, 0);
  assert.match(x.dialog.textContent, /erneut prüfen/);
  assert.equal(x.confirm().disabled, true);
});
test('confirmation retains reviewed contents and rejects an in-place proposal change', async (t) => {
  const x = setup(t),
    source = run();
  x.mount(source);
  x.select();
  x.review();
  source.proposals[0].notes = 'Andere Notiz';
  source.proposals[0].revision++;
  x.confirm().click();
  await settle();
  assert.equal(x.calls.length, 0);
  assert.match(x.dialog.textContent, /erneut prüfen/);
});
test('an acceptance error leaves the reviewed choice retryable and explains the failure', async (t) => {
  const x = setup(t);
  x.accept = async () => {
    throw new Error('Speicher nicht verfügbar');
  };
  x.mount(run());
  x.select();
  x.review();
  x.confirm().click();
  await settle();
  assert.match(x.dialog.textContent, /Speicher nicht verfügbar/);
  assert.equal(x.confirm().disabled, false);
  x.accept = async () => true;
  x.confirm().click();
  await settle();
  assert.equal(x.calls.length, 2);
  assert.equal(x.dialog.open, false);
});
test('acceptance receives the displayed proposal and plan revision snapshot', async (t) => {
  const x = setup(t),
    source = run();
  x.mount(source);
  x.select();
  x.review();
  x.confirm().click();
  await settle();
  assert.equal(x.calls.length, 1);
  assert.notEqual(x.calls[0][1][0], source.proposals[0]);
  assert.equal(x.calls[0][1][0].notes, '  GM\r\n');
  assert.deepEqual(x.calls[0][2], x.basis);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from './helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/narrative-ui.ts'],
  outfile: '.build/narrative-loading.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  workspace = { token: 'owner', campaign: { id: 'campaign' } };
const note = (id) => ({ id, kind: 'quest', title: id });
const view = (id, xp) => ({
  ok: true,
  value: {
    state: {
      noteId: id,
      revision: 0,
      status: 'open',
      locationId: null,
      contributors: [],
      poolXp: xp,
      items: [],
      awardId: null,
    },
    award: null,
    draft: null,
    noteRevision: 1,
  },
});
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
function fixture(t, narrative) {
  const { window } = parseHTML(
    '<html><body><section id="narrative-editor"></section></body></html>',
  );
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this._selectedValue ?? this.options[0]?.value ?? '';
    },
    set(value) {
      this._selectedValue = String(value);
    },
  });
  const prior = {};
  for (const name of [
    'window',
    'document',
    'HTMLElement',
    'HTMLInputElement',
    'HTMLSelectElement',
    'HTMLTextAreaElement',
  ]) {
    prior[name] = globalThis[name];
    globalThis[name] = name === 'window' ? window : window[name];
  }
  window.campaign = {
    narrative,
    progress: async () => ({ ok: true, value: { characters: [] } }),
    ledgerParties: async () => ({ ok: true, value: [] }),
  };
  const file = require.resolve('../.build/narrative-loading.cjs');
  delete require.cache[file];
  const api = require(file),
    errors = [];
  t.after(() => {
    for (const [key, value] of Object.entries(prior)) globalThis[key] = value;
  });
  return {
    panel: window.document.querySelector('#narrative-editor'),
    show: (id) =>
      api.showNarrative(
        workspace,
        note(id),
        false,
        async () => true,
        (text, error) => errors.push({ text, error }),
      ),
    errors,
  };
}
test('failed narrative read replaces prior values and payment controls with a non-busy alert', async (t) => {
  const x = fixture(t, async (_token, id) =>
    id === 'good' ? view(id, 77) : { ok: false, error: 'Belohnungsbeleg falsch zugeordnet' },
  );
  await x.show('good');
  assert.deepEqual(x.errors, []);
  assert.equal(x.panel.querySelector('[aria-label="Quest-XP-Pool"]').value, '77');
  assert.ok(x.panel.querySelectorAll('button').length);
  await x.show('bad');
  assert.equal(x.panel.querySelectorAll('input,select,button').length, 0);
  assert.match(x.panel.querySelector('[role="alert"]').textContent, /Belohnungsbeleg falsch/);
  assert.equal(x.panel.getAttribute('aria-busy'), 'false');
  assert.equal(x.errors.at(-1).error, true);
});
test('switching notes hides the prior reward controls while the new read is pending', async (t) => {
  const pending = deferred(),
    x = fixture(t, async (_token, id) => (id === 'first' ? view(id, 77) : pending.promise));
  await x.show('first');
  const load = x.show('second');
  assert.equal(x.panel.querySelectorAll('input,select,button').length, 0);
  assert.equal(x.panel.getAttribute('aria-busy'), 'true');
  assert.match(x.panel.querySelector('[role="status"]').textContent, /geladen/);
  pending.resolve(view('second', 99));
  await load;
  assert.equal(x.panel.querySelector('[aria-label="Quest-XP-Pool"]').value, '99');
  assert.equal(x.panel.getAttribute('aria-busy'), 'false');
  assert.deepEqual(x.errors, []);
});
test('late failure from an older note cannot erase the latest successfully loaded editor', async (t) => {
  const old = deferred(),
    x = fixture(t, async (_token, id) => (id === 'old' ? old.promise : view(id, 99)));
  const previous = x.show('old');
  await x.show('latest');
  old.resolve({ ok: false, error: 'Old read failed' });
  await previous;
  assert.equal(x.panel.querySelector('[aria-label="Quest-XP-Pool"]').value, '99');
  assert.equal(x.panel.querySelector('[role="alert"]'), null);
  assert.deepEqual(x.errors, []);
});

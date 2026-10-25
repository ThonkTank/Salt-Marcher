import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { parseHTML } from './helpers/dom.mjs';
await import('node:fs/promises').then((fs) =>
  fs.mkdir('.build/narrative-treasure', { recursive: true }),
);
// Keep the actual narrative controller; intercept only its existing Treasury boundary.
await build({
  entryPoints: ['src/app/narrative-ui.ts'],
  outfile: '.build/narrative-treasure/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  plugins: [
    {
      name: 'treasury-port',
      setup(build) {
        build.onLoad({ filter: /\/treasury-ui\.ts$/ }, () => ({
          contents:
            'export const openTreasureDistribution=(...args)=>window.qaDistribute(...args);export const closeStaleTreasureDistribution=()=>window.qaCloseStale();',
          loader: 'ts',
        }));
      },
    },
  ],
});
const require = createRequire(import.meta.url),
  settle = async () => {
    for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r));
  };
const wait = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
function fixture(t) {
  const { window, document } = parseHTML(
      '<html><body><section id="narrative-editor"></section></body></html>',
    ),
    prior = {};
  for (const k of [
    'window',
    'document',
    'HTMLElement',
    'HTMLInputElement',
    'HTMLSelectElement',
    'HTMLTextAreaElement',
  ]) {
    prior[k] = globalThis[k];
    globalThis[k] = k === 'window' ? window : window[k];
  }
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this._value ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this._value = String(v);
    },
  });
  const x = {
    panel: document.getElementById('narrative-editor'),
    opened: [],
    messages: [],
    reads: [],
    writes: 0,
    closes: 0,
    drain: async () => true,
  };
  x.view = (id) => ({
    state: {
      noteId: id,
      revision: 2,
      status: 'closed',
      locationId: null,
      contributors: [],
      poolXp: 9,
      items: [],
      awardId: 'award-' + id,
    },
    noteRevision: 1,
    draft: null,
    award: {
      id: 'award-' + id,
      noteId: id,
      treasureId: 'treasure-' + id,
      sceneId: 'scene-' + id,
      outcome: 'Gerettet',
      shareXp: 9,
    },
  });
  window.campaign = {
    narrative: async (_token, id) => ({ ok: true, value: x.view(id) }),
    progress: async () => ({ ok: true, value: { characters: [] } }),
    ledgerParties: async () => ({ ok: true, value: [] }),
    executeProgress: async () => {
      x.writes++;
      throw Error('A receipt link must not award twice');
    },
  };
  window.qaDistribute = async (id, scene, current) => {
    x.opened.push({ id, scene, current });
    await x.distribute?.();
  };
  window.qaCloseStale = () => {
    if (x.opened.at(-1) && !x.opened.at(-1).current()) x.closes++;
  };
  const file = require.resolve('../.build/narrative-treasure/ui.cjs');
  delete require.cache[file];
  const api = require(file);
  x.show = (id = 'a', token = 'token') =>
    api.showNarrative(
      { token, campaign: { id: 'campaign' } },
      { id, revision: 1, kind: 'quest', title: id },
      false,
      () => x.drain(),
      (text, error) => x.messages.push({ text, error }),
    );
  x.button = () =>
    [...x.panel.querySelectorAll('button')].find(
      (b) => b.textContent === 'Beute gemeinsam verteilen…',
    );
  t.after(async () => {
    await api.showNarrative(
      null,
      null,
      true,
      async () => true,
      () => {},
    );
    Object.assign(globalThis, prior);
  });
  return x;
}
test('a paid quest opens its exact existing treasure with no new award', async (t) => {
  const x = fixture(t);
  await x.show();
  assert.ok(x.button());
  x.button().click();
  await settle();
  assert.equal(x.opened.length, 1);
  assert.equal(x.opened[0].id, 'treasure-a');
  assert.equal(x.opened[0].scene, 'scene-a');
  assert.equal(x.opened[0].current(), true);
  assert.equal(x.writes, 0);
});
test('no treasure action exists for an unpaid quest or an award without items', async (t) => {
  const x = fixture(t),
    view = x.view;
  x.view = (id) => ({ ...view(id), award: null });
  await x.show();
  assert.equal(x.button(), undefined);
  x.view = (id) => ({ ...view(id), award: { ...view(id).award, treasureId: null } });
  await x.show();
  assert.equal(x.button(), undefined);
});
test('a blocked owner flush keeps the quest and never opens distribution', async (t) => {
  const x = fixture(t);
  await x.show();
  x.drain = async () => false;
  x.button().click();
  await settle();
  assert.equal(x.opened.length, 0);
  assert.equal(x.button().disabled, false);
});
test('a pending flush, a detached button and A-B-A cannot retarget the old treasure action', async (t) => {
  const x = fixture(t),
    pending = wait();
  await x.show();
  const old = x.button();
  x.drain = () => pending.promise;
  old.click();
  await settle();
  await x.show('b');
  await x.show('a');
  pending.resolve(true);
  await settle();
  assert.equal(x.opened.length, 0);
  old.onclick();
  await settle();
  assert.equal(x.opened.length, 0);
  x.drain = async () => true;
  x.button().click();
  await settle();
  assert.equal(x.opened.length, 1);
});
test('changing the note or campaign invalidates an open distribution caller', async (t) => {
  const x = fixture(t);
  await x.show();
  x.button().click();
  await settle();
  const current = x.opened[0].current;
  await x.show('b');
  assert.equal(current(), false);
  assert.equal(x.closes, 1);
  x.button().click();
  await settle();
  await x.show('b', 'other-token');
  assert.equal(x.opened[1].current(), false);
});

test('a late distribution failure stays with its original quest', async (t) => {
  const x = fixture(t),
    pending = wait();
  await x.show();
  x.distribute = () => pending.promise;
  x.button().click();
  await settle();
  await x.show('b');
  pending.resolve(Promise.reject(Error('Old treasure read')));
  await settle();
  assert.equal(
    x.messages.some((m) => m.text.includes('Old treasure read')),
    false,
  );
  assert.equal(x.button().disabled, false);
});

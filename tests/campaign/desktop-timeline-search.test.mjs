import { preparationInstance } from '../helpers/preparation.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync, build } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
const require = createRequire(import.meta.url);
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/timeline-search-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
await build({
  entryPoints: ['src/app/campaign/preparation.ts'],
  outfile: '.build/timeline-search-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  plugins: [
    {
      name: 'unrelated-controller-ports',
      setup(b) {
        b.onResolve({ filter: /(?:^|\/)(session-ui|narrative-ui)$/ }, (args) => ({
          path: args.path,
          namespace: 'qa-ports',
        }));
        b.onLoad({ filter: /.*/, namespace: 'qa-ports' }, (args) => ({
          contents: args.path.includes('session')
            ? 'export const initSession=()=>{};export const sessionContext=()=>{};export const sessionVisitReadAlouds=()=>new Map();export const flushSession=async()=>true;export const clearSessionTimeline=async()=>{};export const linkVisitNoteThread=async()=>{throw Error("Unexpected thread link in timeline-only fixture");};'
            : 'export const showNarrative=async()=>{};export const flushNarrative=async()=>true;export const prepareNarrativeLocation=async()=>{};export const acceptNarrativeNoteReceipt=async()=>true;',
          loader: 'js',
        }));
      },
    },
  ],
});
const tick = () => new Promise((r) => setImmediate(r));
async function until(fn) {
  for (let i = 0; i < 200; i++) {
    if (fn()) return;
    await tick();
  }
  assert(fn(), 'Expected timeline state');
}
async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'timeline-search-')),
    { CampaignStore } = require('../../.build/timeline-search-store.cjs'),
    store = new CampaignStore(root + '/store.sqlite'),
    campaign = store.create('Besuche wiederfinden'),
    w = store.activate(campaign.id),
    command = (change) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      change,
    });
  const location = {
    kind: 'location',
    version: 1,
    id: randomUUID(),
    name: 'Alte Mühle',
    type: 'poi',
    sections: [
      { id: randomUUID(), title: 'Beschreibung', markdown: '' },
      { id: randomUUID(), title: 'Notizen', markdown: '' },
    ],
    detailMaps: [],
    keyLinks: [],
  };
  store.changePreparation(
    command({ kind: 'location', expectedRevision: null, document: location }),
  );
  const scenes = Array.from({ length: 65 }, (_, i) => ({
      id: randomUUID(),
      title: i === 0 ? 'Ankunft' : 'Hafenbesuch',
      notes:
        i === 63
          ? '  Kupfersiegel\r\n- Die Mühle erneut besuchen'
          : '  Original ' + i + '\r\n- Unverändert',
      locationId: i === 63 ? location.id : null,
    })),
    plan = { version: 1, id: randomUUID(), revision: 1, name: 'Hafenspuren', scenes },
    other = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      name: 'Nächster Spielabend',
      scenes: [
        { id: randomUUID(), title: 'Reise', notes: 'Eigenständige Notizen', locationId: null },
      ],
    };
  for (const p of [plan, other])
    store.changePreparation(command({ kind: 'plan', expectedRevision: null, plan: p }));
  const previous = {
      localStorage: globalThis.localStorage,
      window: globalThis.window,
      document: globalThis.document,
    },
    { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8'));
  Object.assign(globalThis, { window, document });
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this.__qaValue ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this.__qaValue = v;
    },
  });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLInputElement.prototype.select = function () {
    this.selectionStart = 0;
    this.selectionEnd = this.value.length;
  };
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
  };
  const storage = new Map();
  window.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  const response = (fn) => {
      try {
        return { ok: true, value: fn() };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    writes = [],
    messages = [];
  window.campaign = {};
  for (const key of [
    'preparation',
    'preparationDraft',
    'keepPreparationDrafts',
    'discardPreparationDraft',
    'selectPreparation',
    'reconcilePreparation',
    'reconcilePreparationPlan',
  ])
    window.campaign[key] = async (...args) => response(() => store[key](...args));
  window.campaign.changePreparation = async (c) => {
    writes.push(c);
    return response(() => store.changePreparation(c));
  };
  window.campaign.changePreparationPlan = async (c) => {
    writes.push(c);
    return response(() => store.changePreparationPlan(c));
  };
  delete require.cache[require.resolve('../../.build/timeline-search-ui.cjs')];
  const ui = preparationInstance(require('../../.build/timeline-search-ui.cjs'), document, window);
  ui.initPreparation(
    (text) => messages.push(text),
    async () => {},
  );
  await ui.activatePreparation(w);
  const el = (id) => document.getElementById(id),
    input = (id, v) => {
      el(id).value = v;
      el(id).dispatchEvent(new window.Event('input'));
    },
    filter = (q) => input('scene-search', q),
    buttons = () => [...el('scene-list').querySelectorAll('button')],
    saved = () => store.preparation(w.token, '').plans.find((p) => p.id === plan.id);
  return {
    window,
    store,
    w,
    plan,
    other,
    scenes,
    location,
    ui,
    el,
    input,
    filter,
    buttons,
    saved,
    writes,
    messages,
    async cleanup() {
      await ui.leavePreparation();
      await tick();
      Object.assign(globalThis, previous);
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
test('a note-only clue near the end of a repeated timeline is found without opening every visit or writing data', async () => {
  const x = await fixture();
  try {
    const initial = x.saved();
    x.filter('KUPFERSIEGEL mühle');
    assert.equal(x.buttons().length, 1);
    assert.equal(x.buttons()[0].textContent, '64. Hafenbesuch');
    assert.match(x.el('scene-search-status').textContent, /1 von 65/);
    assert.equal(x.el('scene-title').value, 'Ankunft');
    assert.match(x.el('scene-search-status').textContent, /Editor geöffnet/);
    assert.equal(x.writes.length, 0);
    assert.deepEqual(x.saved(), initial);
    x.buttons()[0].onclick();
    await until(() => x.el('scene-notes').value.includes('Kupfersiegel'));
    assert.equal(x.writes.length, 0);
  } finally {
    await x.cleanup();
  }
});
test('filtering and zero matches preserve open input, and switching saves the original owner only', async () => {
  const x = await fixture();
  try {
    x.input('scene-notes', '  Eigene Notiz\n- Noch offen');
    x.filter('Kupfersiegel');
    assert.equal(x.el('scene-notes').value, '  Eigene Notiz\n- Noch offen');
    x.filter('Nichts gefunden');
    assert.equal(x.buttons().length, 0);
    assert.equal(x.el('scene-editor').hidden, false);
    assert.equal(x.el('scene-notes').value, '  Eigene Notiz\n- Noch offen');
    x.filter('Kupfersiegel');
    x.buttons()[0].onclick();
    await until(() => x.el('scene-notes').value.includes('Kupfersiegel'));
    assert.equal(x.saved().scenes[0].notes, '  Eigene Notiz\r\n- Noch offen');
    assert.equal(x.saved().scenes[63].notes, x.scenes[63].notes);
    assert.equal(x.writes.length, 1);
  } finally {
    await x.cleanup();
  }
});
test('moving a filtered visit changes the full timeline order without dropping hidden visits or their prose', async () => {
  const x = await fixture();
  try {
    x.filter('Kupfersiegel');
    x.buttons()[0].onclick();
    await until(() => x.el('scene-notes').value.includes('Kupfersiegel'));
    x.el('scene-up').onclick();
    await until(() => x.buttons()[0]?.textContent === '63. Hafenbesuch');
    const expected = x.scenes.map((s) => s.id);
    [expected[62], expected[63]] = [expected[63], expected[62]];
    assert.deepEqual(
      x.saved().scenes.map((s) => s.id),
      expected,
    );
    for (const scene of x.scenes)
      assert.equal(x.saved().scenes.find((s) => s.id === scene.id).notes, scene.notes);
  } finally {
    await x.cleanup();
  }
});
test('creating a visit clears the filter so the new selected visit remains visible', async () => {
  const x = await fixture();
  try {
    x.filter('Kupfersiegel');
    x.el('scene-add').onclick();
    await until(() => x.el('scene-title').value === 'Neue Szene');
    assert.equal(x.el('scene-search').value, '');
    assert.equal(x.buttons().length, 66);
    assert.equal(x.buttons().at(-1).getAttribute('aria-pressed'), 'true');
    assert.equal(x.saved().scenes.length, 66);
  } finally {
    await x.cleanup();
  }
});
test('title and linked location search work together and clearing restores the original numbering', async () => {
  const x = await fixture();
  try {
    x.filter('alte MÜHLE hafen');
    assert.equal(x.buttons().length, 1);
    x.filter('Ankunft');
    assert.equal(x.buttons()[0].textContent, '1. Ankunft');
    x.el('scene-search-clear').onclick();
    assert.equal(x.buttons().length, 65);
    assert.equal(x.buttons().at(-1).textContent, '65. Hafenbesuch');
    assert.equal(x.writes.length, 0);
  } finally {
    await x.cleanup();
  }
});
test('plan changes reset filtering and old filtered callbacks cannot redirect another plan', async () => {
  const x = await fixture();
  try {
    x.filter('Kupfersiegel');
    const old = x.buttons()[0].onclick;
    x.el('plans').value = x.other.id;
    x.el('plans').dispatchEvent(new window.Event('change'));
    await until(() => x.el('scene-title').value === 'Reise');
    assert.equal(x.el('scene-search').value, '');
    old();
    await tick();
    assert.equal(x.el('scene-title').value, 'Reise');
    assert.equal(x.buttons().length, 1);
    assert.equal(x.writes.length, 0);
  } finally {
    await x.cleanup();
  }
});
test('campaign reactivation resets the ephemeral filter and keeps all stored visits intact', async () => {
  const x = await fixture();
  try {
    x.filter('Kupfersiegel');
    await x.ui.activatePreparation(x.w);
    assert.equal(x.el('scene-search').value, '');
    assert.equal(x.buttons().length, 65);
    assert.deepEqual(x.saved().scenes, x.scenes);
    assert.equal(x.store.live(x.w.token).scenes.length, 0);
    assert.equal(x.writes.length, 0);
  } finally {
    await x.cleanup();
  }
});
test('target-only plan recovery refreshes list labels and preserves later input without a directory read', async () => {
  const x = await fixture();
  try {
    const save = x.window.campaign.changePreparationPlan;
    x.window.campaign.preparation = async () => {
      throw Error('Global directory is unavailable');
    };
    x.window.campaign.changePreparationPlan = async (c) => {
      await save(c);
      throw Error('Plan reply lost');
    };
    x.el('scene-title').value = 'Bestätigter Besuch';
    x.el('scene-title').dispatchEvent(new window.Event('input'));
    assert.equal(await x.ui.flushPreparation(), false);
    const status = x.window.campaign.reconcilePreparationPlan;
    let release;
    x.window.campaign.reconcilePreparationPlan = async (...args) => {
      const result = await status(...args);
      await new Promise((r) => (release = r));
      return result;
    };
    x.el('preparation-reconcile').onclick();
    await until(() => !!release);
    x.el('scene-notes').value = '  Späterer Entwurf\r\n';
    x.el('scene-notes').dispatchEvent(new window.Event('input'));
    release();
    await until(() => x.el('preparation-reconcile').hidden);
    assert.equal(x.buttons()[0].textContent, '1. Bestätigter Besuch');
    assert.equal(x.el('scene-notes').value, '  Späterer Entwurf\r\n');
    assert.equal(x.writes.length, 1);
    x.window.campaign.changePreparationPlan = save;
    assert.equal(await x.ui.flushPreparation(), true);
    assert.equal(x.saved().scenes[0].notes, '  Späterer Entwurf\r\n');
  } finally {
    await x.cleanup();
  }
});

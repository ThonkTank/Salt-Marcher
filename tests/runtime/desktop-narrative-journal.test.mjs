import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
const base = '.build/realist-journal',
  require = createRequire(import.meta.url);
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: base + '/store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['src/app/runtime/narrative-journal-ui.ts'],
  outfile: base + '/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { CampaignStore } = require('../../' + base + '/store.cjs'),
  tick = async () => {
    for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
  };
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
async function fixture(t, count = 1) {
  const root = mkdtempSync(path.join(tmpdir(), 'journal-ui-')),
    store = new CampaignStore(path.join(root, 'store.sqlite')),
    a = store.create('A'),
    b = store.create('B'),
    id = randomUUID();
  const activate = (campaign) => {
    const w = store.activate(campaign.id);
    store.changePreparation({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      change: {
        kind: 'note',
        expectedRevision: null,
        note: {
          version: 1,
          id,
          revision: 1,
          kind: 'quest',
          title: campaign.name + ' quest',
          readAloud: '',
          gmNotes: campaign.name + ' private prose',
          relations: [],
          creatureId: null,
          deleted: false,
        },
      },
    });
    return w;
  };
  activate(a);
  activate(b);
  const w = store.activate(a.id);
  for (let i = 1; i < count; i++)
    store.changePreparation({
      commandId: randomUUID(),
      campaignId: a.id,
      token: w.token,
      change: {
        kind: 'note',
        expectedRevision: null,
        note: {
          version: 1,
          id: randomUUID(),
          revision: 1,
          kind: 'quest',
          title: 'A quest ' + String(i).padStart(2, '0'),
          readAloud: '',
          gmNotes: 'More private prose',
          relations: [],
          creatureId: null,
          deleted: false,
        },
      },
    });
  const { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8'));
  const saved = {};
  for (const key of [
    'window',
    'document',
    'HTMLElement',
    'HTMLInputElement',
    'HTMLSelectElement',
    'HTMLTextAreaElement',
  ]) {
    saved[key] = globalThis[key];
    globalThis[key] = key === 'window' ? window : window[key];
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
  const file = require.resolve('../../' + base + '/ui.cjs');
  delete require.cache[file];
  const ui = require(file),
    messages = [],
    detailCalls = [];
  const ok = (fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  window.campaign = {};
  for (const method of [
    'narrativeJournal',
    'progress',
    'ledgerParties',
    'keepNarrativeDraft',
    'executeProgress',
  ])
    window.campaign[method] = async (...args) => ok(() => store[method](...args));
  window.campaign.narrative = async (...args) => {
    detailCalls.push(args);
    return ok(() => store.narrative(...args));
  };
  ui.initNarrativeJournal(
    (...args) => messages.push(args),
    async () => true,
    async () => true,
    async () => {},
  );
  const dialog = document.getElementById('narrative-journal');
  dialog.open = false;
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
  };
  const el = (id) => document.getElementById(id),
    open = async () => {
      el('narrative-journal-open').disabled = false;
      el('narrative-journal-open').click();
      await tick();
    };
  ui.activateNarrativeJournal(w);
  await open();
  assert.equal(el('journal-list').children.length, Math.min(count, 40));
  t.after(async () => {
    ui.activateNarrativeJournal(w);
    await tick();
    Object.assign(globalThis, saved);
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { store, ui, window, document, messages, detailCalls, el, dialog, open, b };
}
test('a failed journal filter removes old rows and counts instead of leaving stale choices', async (t) => {
  const x = await fixture(t),
    held = deferred();
  x.window.campaign.narrativeJournal = () => held.promise;
  x.el('journal-status').value = 'closed';
  x.el('journal-status').onchange();
  assert.equal(x.el('journal-list').children.length, 0);
  assert.equal(x.el('journal-counts').textContent, '');
  held.resolve({ ok: false, error: 'Current journal failure' });
  await tick();
  assert.equal(x.el('journal-list').children.length, 0);
  assert.match(x.el('journal-list-status').textContent, /Current journal failure/);
});
test('a slower read failure from the previous campaign cannot overwrite the new journal', async (t) => {
  const x = await fixture(t),
    held = deferred(),
    original = x.window.campaign.narrativeJournal;
  x.window.campaign.narrativeJournal = () => held.promise;
  x.el('journal-refresh').click();
  await tick();
  const w = x.store.activate(x.b.id);
  x.ui.activateNarrativeJournal(w);
  x.window.campaign.narrativeJournal = original;
  await x.open();
  assert.match(x.el('journal-list').textContent, /B quest/);
  held.resolve({ ok: false, error: 'Old campaign failure' });
  await tick();
  assert.match(x.el('journal-list').textContent, /B quest/);
  assert.doesNotMatch(x.el('journal-list-status').textContent, /Old campaign failure/);
});
test('a detached row from another campaign cannot open its prose or resolve a reused local ID', async (t) => {
  const x = await fixture(t),
    old = x.el('journal-list').querySelector('button'),
    w = x.store.activate(x.b.id);
  x.ui.activateNarrativeJournal(w);
  await x.open();
  old.onclick();
  await tick();
  assert.deepEqual(x.detailCalls, []);
  assert.doesNotMatch(x.el('journal-document').textContent, /A private prose/);
  assert.match(x.el('journal-list').textContent, /B quest/);
});

test('failed page continuation retains usable earlier journal rows without changing source data', async (t) => {
  const x = await fixture(t, 41),
    old = x.el('journal-list').querySelector('button'),
    held = deferred(),
    before = x.store.db.serialize();
  assert.equal(x.el('journal-more').hidden, false);
  x.window.campaign.narrativeJournal = () => held.promise;
  x.el('journal-more').click();
  await tick();
  assert.equal(x.el('journal-list').children.length, 40);
  held.resolve({ ok: false, error: 'More entries failed' });
  await tick();
  assert.equal(x.el('journal-list').children.length, 40);
  assert.match(x.el('journal-list-status').textContent, /More entries failed/);
  old.click();
  await tick();
  assert.equal(x.detailCalls.length, 1);
  assert.match(x.el('journal-document').textContent, /A private prose/);
  assert.ok(x.store.db.serialize().equals(before));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
import { parseHTML } from './helpers/dom.mjs';
const require = createRequire(import.meta.url);
mkdirSync('.build/catalog', { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  '.build/catalog/srd-5.1.generated.json',
);
for (const [entry, out] of [
  ['src/app/storage/store.ts', 'groups-search-store'],
  ['src/app/groups-ui.ts', 'groups-search-ui'],
])
  buildSync({
    entryPoints: [entry],
    outfile: '.build/' + out + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function until(check) {
  for (let i = 0; i < 80; i++) {
    if (check()) return;
    await tick();
  }
  assert.ok(check(), 'Expected group search state did not arrive');
}
async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'groups-search-')),
    { CampaignStore } = require('../.build/groups-search-store.cjs'),
    store = new CampaignStore(root + '/workbench.sqlite');
  const campaign = store.create('Vorbereitete Gruppen'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaign.id,
      action,
    });
  for (const prefix of ['Hafen', 'Wald'])
    for (let i = 0; i < 65; i++)
      store.executeProgress(
        command({
          kind: 'group-create',
          title: prefix + ' ' + String(i).padStart(2, '0'),
          encounterId: null,
          expectedEncounterRevision: null,
        }),
      );
  const saved = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8'));
  Object.assign(globalThis, { window, document });
  window.localStorage = { getItem: () => null };
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { value: '', writable: true });
  const response = (fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const calls = [],
    waiting = [],
    views = [];
  let hold = false,
    fail = false;
  window.campaign = {};
  for (const name of ['ledgerParties', 'encounterPlans', 'groupDraft', 'keepGroupDraft'])
    window.campaign[name] = async (...args) => response(() => store[name](...args));
  window.campaign.groupView = async (...args) => {
    views.push(args[1]);
    return response(() => store.groupView(...args));
  };
  window.campaign.preparedGroups = async (t, query, after) => {
    calls.push({ query, after });
    const result = fail
      ? { ok: false, error: 'Lesen unterbrochen' }
      : response(() => store.preparedGroups(t, query, after));
    if (hold) {
      hold = false;
      return new Promise((resolve) => waiting.push(() => resolve(result)));
    }
    return result;
  };
  delete require.cache[require.resolve('../.build/groups-search-ui.cjs')];
  const ui = require('../.build/groups-search-ui.cjs');
  const messages = [];
  ui.initGroups(
    (text) => messages.push(text),
    async () => {},
    async () => {},
  );
  ui.activateGroups(w);
  await ui.openGroups();
  calls.length = 0;
  const el = (id) => document.getElementById(id),
    input = (id, text) => {
      el(id).value = text;
      el(id).dispatchEvent(new window.Event('input'));
    },
    submit = () => el('groups-search-form').onsubmit({ preventDefault() {} }),
    titles = () =>
      Array.from(document.querySelectorAll('#groups-list button'), (b) => b.textContent);
  return {
    store,
    ui,
    w,
    el,
    input,
    submit,
    titles,
    calls,
    views,
    messages,
    hold: () => {
      hold = true;
    },
    fail: (v) => {
      fail = v;
    },
    release: () => waiting.shift()(),
    waiting,
    cleanup() {
      ui.activateGroups(null);
      Object.assign(globalThis, saved);
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
test('group query changes invalidate the old cursor and preserve the incomplete editor', async () => {
  const x = await fixture();
  try {
    x.input('groups-search', 'Hafen');
    x.submit();
    await until(() => x.titles().length === 25 && x.titles().every((t) => t.startsWith('Hafen')));
    x.el('groups-list').querySelector('button').onclick();
    await until(() => x.el('groups-title').value.startsWith('Hafen'));
    x.input('groups-title', '');
    x.input('groups-notes', 'Unfertig\r\n');
    await x.ui.flushGroups();
    const editor = x.el('groups-actors').firstChild,
      views = x.views.length;
    x.input('groups-search', 'Wald');
    assert.equal(x.titles().length, 0);
    assert.equal(x.el('groups-more').disabled, true);
    x.el('groups-more').onclick();
    assert.equal(x.calls.length, 1);
    assert.equal(x.el('groups-title').value, '');
    x.submit();
    await until(() => x.titles().length === 25);
    assert.equal(x.calls.at(-1).after, null);
    assert.equal(x.views.length, views);
    assert.equal(x.el('groups-actors').firstChild, editor);
    for (const n of [50, 65]) {
      x.el('groups-more').onclick();
      await until(() => x.titles().length === n);
    }
    assert.equal(new Set(x.titles()).size, 65);
    assert(x.titles().every((t) => t.startsWith('Wald')));
    assert.equal(x.el('groups-title').value, '');
    assert.equal(x.el('groups-notes').value, 'Unfertig\r\n');
    assert.match(x.el('groups-search-status').textContent, /65 Gruppen/);
  } finally {
    x.cleanup();
  }
});
test('delayed group searches cannot restore results after query or campaign changes', async () => {
  const x = await fixture();
  try {
    x.input('groups-search', 'Hafen');
    x.hold();
    x.submit();
    await until(() => x.waiting.length === 1);
    x.input('groups-search', 'Wald');
    x.release();
    await tick();
    assert.equal(x.titles().length, 0);
    assert.equal(x.el('groups-more').disabled, true);
    x.hold();
    x.submit();
    await until(() => x.waiting.length === 1);
    x.ui.activateGroups(null);
    x.release();
    await tick();
    assert.equal(x.titles().length, 0);
    assert.equal(x.el('groups-editor').hidden, true);
  } finally {
    x.cleanup();
  }
});
test('rapid group continuation clicks load once and obsolete continuations stay discarded', async () => {
  const x = await fixture();
  try {
    x.input('groups-search', 'Hafen');
    x.submit();
    await until(() => x.titles().length === 25);
    x.hold();
    x.el('groups-more').onclick();
    x.el('groups-more').onclick();
    await until(() => x.waiting.length === 1);
    assert.equal(x.calls.length, 2);
    assert.equal(x.el('groups-more').disabled, true);
    x.release();
    await until(() => x.titles().length === 50);
    assert.equal(new Set(x.titles()).size, 50);
    x.hold();
    x.el('groups-more').onclick();
    await until(() => x.waiting.length === 1);
    x.input('groups-search', 'Wald');
    x.submit();
    await until(() => x.titles().length === 25);
    x.release();
    await tick();
    assert.equal(x.titles().length, 25);
    assert(x.titles().every((t) => t.startsWith('Wald')));
  } finally {
    x.cleanup();
  }
});
test('failed group replacement clears prior results; failed continuation retains its retry cursor', async () => {
  const x = await fixture();
  try {
    x.input('groups-search', 'Hafen');
    x.submit();
    await until(() => x.titles().length === 25);
    x.fail(true);
    x.input('groups-search', 'Wald');
    x.submit();
    await until(() => x.messages.length > 0);
    assert.equal(x.titles().length, 0);
    assert.equal(x.el('groups-more').disabled, true);
    assert.match(x.el('groups-search-status').textContent, /fehlgeschlagen/);
    x.fail(false);
    x.submit();
    await until(() => x.titles().length === 25);
    x.fail(true);
    x.el('groups-more').onclick();
    await until(() => x.messages.length === 2);
    const cursor = x.calls.at(-1).after;
    assert.equal(x.titles().length, 25);
    assert.equal(x.el('groups-more').disabled, false);
    x.fail(false);
    x.el('groups-more').onclick();
    await until(() => x.titles().length === 50);
    assert.equal(x.calls.at(-1).after, cursor);
    assert.equal(new Set(x.titles()).size, 50);
  } finally {
    x.cleanup();
  }
});

test('group pages follow their displayed names across page boundaries and reject foreign cursors', async () => {
  const x = await fixture();
  try {
    const titles = [];
    let cursor = null;
    do {
      const page = x.store.preparedGroups(x.w.token, 'Hafen', cursor);
      titles.push(...page.items.map((g) => g.title));
      cursor = page.next;
    } while (cursor);
    assert.deepEqual(
      titles,
      Array.from({ length: 65 }, (_, i) => 'Hafen ' + String(i).padStart(2, '0')),
    );
    const first = x.store.preparedGroups(x.w.token, 'Hafen', null);
    assert.throws(
      () => x.store.preparedGroups(x.w.token, 'Wald', first.next),
      /Suchseite veraltet/,
    );
  } finally {
    x.cleanup();
  }
});

test('returning after a new location refreshes the current group location choices without reselecting or losing input', async () => {
  const x = await fixture();
  try {
    x.input('groups-notes', '  Unfertige Hinterhalt-Notiz\r\n');
    await x.ui.flushGroups();
    const before = x.store.db.serialize(),
      views = x.views.length,
      title = x.el('groups-title').value,
      notes = x.el('groups-notes'),
      placeId = randomUUID();
    window.campaign.ledgerParties = async () => ({
      ok: true,
      value: [{ id: placeId, name: 'Zollbrücke', kind: 'location' }],
    });
    await x.ui.openGroups();
    assert.ok(
      [...x.el('groups-place').children].some(
        (option) => option.value === placeId && option.textContent === 'Zollbrücke',
      ),
      'new places must be immediately available in the preserved group editor',
    );
    assert.equal(x.el('groups-place').value, '');
    assert.equal(x.el('groups-notes'), notes);
    assert.equal(notes.value, '  Unfertige Hinterhalt-Notiz\r\n');
    assert.equal(x.el('groups-title').value, title);
    assert.equal(x.views.length, views);
    assert.ok(x.store.db.serialize().equals(before));
  } finally {
    x.cleanup();
  }
});

test('Unicode group searches retain all pages and validate cursors against the same normalized query', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'groups-search-unicode-')),
    { CampaignStore } = require('../.build/groups-search-store.cjs'),
    store = new CampaignStore(root + '/workbench.sqlite');
  try {
    const campaign = store.create('Gruppen mit Umlauten'),
      w = store.activate(campaign.id);
    for (let i = 0; i < 30; i++)
      store.executeProgress({
        commandId: randomUUID(),
        campaignId: campaign.id,
        token: w.token,
        action: {
          kind: 'group-create',
          title: 'A\u0308nnes Wölfe ' + String(i).padStart(2, '0'),
          encounterId: null,
          expectedEncounterRevision: null,
        },
      });
    const bytes = store.db.serialize(),
      first = store.preparedGroups(w.token, 'WÖLFE', null);
    assert.equal(first.items.length, 25);
    assert.ok(first.next);
    const last = store.preparedGroups(w.token, 'ÄNNES', first.next);
    assert.equal(last.items.length, 5);
    assert.equal(last.next, null);
    assert.equal(new Set([...first.items, ...last.items].map((g) => g.id)).size, 30);
    assert.throws(
      () => store.preparedGroups(w.token, 'anderer Titel', first.next),
      /Suchseite veraltet/,
    );
    assert.ok(
      store.db.serialize().equals(bytes),
      'search must preserve group titles, revisions and contents',
    );
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});

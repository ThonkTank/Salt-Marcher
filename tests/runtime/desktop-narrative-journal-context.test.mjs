import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
const base = '.build/planner-journal-context',
  require = createRequire(import.meta.url);
mkdirSync(base, { recursive: true });
buildSync({
  stdin: {
    contents:
      "export * from './src/app/runtime/narrative-ui';export * from './src/app/runtime/narrative-journal-ui';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  outfile: base + '/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
};
const result = (value) => ({ ok: true, value: structuredClone(value) });
const note = (id = 'first', title = 'Auftrag ' + id) => ({
  version: 1,
  id,
  revision: 1,
  kind: 'quest',
  title,
  readAloud: '  Vorlesen\r\n',
  gmNotes: '  Privat  ',
  relations: [{ targetId: 'related', label: 'Verweis' }],
  creatureId: null,
  deleted: false,
});
const narrative = (id) => ({
  noteRevision: 1,
  state: {
    noteId: id,
    revision: 0,
    status: 'open',
    locationId: null,
    contributors: [],
    poolXp: 25,
    items: [],
    awardId: null,
  },
  award: null,
  draft: null,
});
const journal = (id = 'first', title) => ({
  entries: [
    { note: note(id, title), view: narrative(id), locationName: null, contributorNames: [] },
  ],
  counts: { open: 1, closed: 0 },
  next: null,
});
function setup(t) {
  const { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8')),
    saved = {};
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    get() {
      return this._value ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this._value = v;
    },
    configurable: true,
  });
  for (const name of [
    'window',
    'document',
    'HTMLElement',
    'HTMLInputElement',
    'HTMLSelectElement',
    'HTMLTextAreaElement',
    'setTimeout',
    'clearTimeout',
  ])
    saved[name] = globalThis[name];
  for (const name of [
    'window',
    'document',
    'HTMLElement',
    'HTMLInputElement',
    'HTMLSelectElement',
    'HTMLTextAreaElement',
  ])
    globalThis[name] = name === 'window' ? window : window[name];
  const timers = new Map();
  let timer = 0;
  globalThis.setTimeout = (fn) => {
    timers.set(++timer, fn);
    return timer;
  };
  globalThis.clearTimeout = (id) => timers.delete(id);
  const x = {
    window,
    document,
    owner: { token: 'A', campaign: { id: 'campaign-A' } },
    messages: [],
    navigation: [],
    reads: [],
    commands: [],
    persisted: [],
    flush: async () => true,
    page: async () => journal(),
    persist: async () => result(null),
    releases: [],
  };
  window.campaign = {
    narrativeJournal: async (token, q) => {
      x.reads.push({ token, q });
      return result(await x.page(token, q));
    },
    narrative: async (_, id) => result(narrative(id)),
    progress: async () => result({ characters: [] }),
    ledgerParties: async () => result([]),
    keepNarrativeDraft: (...args) => {
      x.persisted.push(args);
      return x.persist(...args);
    },
    executeProgress: async (c) => {
      x.commands.push(c);
      return result({ characters: [] });
    },
  };
  delete require.cache[require.resolve('../../' + base + '/ui.cjs')];
  x.ui = require('../../' + base + '/ui.cjs');
  const tell = (text, error) => x.messages.push({ text, error });
  x.ui.initNarrativeJournal(
    tell,
    () => x.flush(),
    async () => true,
    async (id) => x.navigation.push(id),
  );
  for (const d of document.querySelectorAll('dialog')) {
    d.open = false;
    d.showModal = () => {
      assert.equal(d.open, false, 'cannot show an already open native dialog');
      d.open = true;
    };
    d.close = () => {
      d.open = false;
    };
  }
  x.el = (id) => document.getElementById(id);
  x.dialog = x.el('narrative-journal');
  x.activate = (token) => {
    x.owner = { token, campaign: { id: 'campaign-' + token } };
    x.ui.activateNarrativeJournal(x.owner);
    x.el('narrative-journal-open').disabled = false;
  }; // Actual renderer enables the opener after activation.
  x.open = async () => {
    x.el('narrative-journal-open').click();
    await settle();
  };
  x.entry = () => x.el('journal-list').querySelector('button');
  x.select = async () => {
    x.entry().click();
    await settle();
  };
  x.close = async () => {
    x.el('journal-close').click();
    await settle();
  };
  x.original = () => x.ui.showNarrative(x.owner, note('original'), false, async () => true, tell);
  x.dirty = () => {
    const pool = x.el('journal-narrative-editor').querySelector('[aria-label="Quest-XP-Pool"]');
    assert.ok(pool);
    pool.value = '-';
    pool.oninput();
  };
  x.hold = () => {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    x.releases.push(() => resolve(result(null)));
    return { promise, resolve };
  };
  x.activate('A');
  t.after(async () => {
    for (const release of x.releases) release();
    await settle();
    await x.ui.showNarrative(null, null, true, async () => true, tell);
    await settle();
    Object.assign(globalThis, saved);
  });
  return x;
}
test('ordinary journal selection retains authored prose and closing restores the original editor', async (t) => {
  const x = setup(t);
  await x.original();
  await x.open();
  assert.equal(x.dialog.open, true);
  await x.select();
  assert.equal(
    x.el('journal-document').querySelector('.journal-read-aloud').textContent,
    '  Vorlesen\r\n',
  );
  assert.equal(
    x.el('journal-document').querySelector('.journal-gm-notes').textContent,
    '  Privat  ',
  );
  await x.close();
  assert.equal(x.dialog.open, false);
  assert.equal(x.el('journal-narrative-editor').hidden, true);
  assert.equal(x.el('narrative-editor').hidden, false);
  assert.equal(x.ui.captureNarrativeOwner() instanceof Function, true);
  assert.deepEqual(x.commands, []);
});
test('an entry removed by closing cannot reopen the journal editor', async (t) => {
  const x = setup(t);
  await x.original();
  await x.open();
  const old = x.entry().onclick;
  await x.close();
  old();
  await settle();
  assert.equal(x.el('journal-narrative-editor').hidden, true);
  assert.equal(x.el('journal-document').textContent, 'Wähle links einen Auftrag.');
});
test('refreshing the index invalidates its removed entry handlers', async (t) => {
  const x = setup(t);
  await x.open();
  const old = x.entry().onclick;
  x.page = async () => journal('first', 'Neuer Auftrag');
  x.el('journal-refresh').click();
  await settle();
  old();
  await settle();
  assert.equal(x.el('journal-document').textContent, 'Wähle links einen Auftrag.');
  await x.select();
  assert.match(x.el('journal-document').textContent, /Neuer Auftrag/);
});
test('removed text and relation controls cannot navigate after closing', async (t) => {
  const x = setup(t);
  await x.open();
  await x.select();
  const buttons = [...x.el('journal-document').querySelectorAll('button')],
    old = buttons.map((b) => b.onclick);
  await x.close();
  for (const fn of old) fn();
  await settle();
  assert.deepEqual(x.navigation, []);
});
test('a delayed close from the prior campaign cannot close or clear the new journal', async (t) => {
  const x = setup(t);
  await x.open();
  await x.select();
  x.dirty();
  const held = x.hold();
  x.persist = () => held.promise;
  x.el('journal-close').click();
  await settle();
  x.activate('B');
  x.page = async () => journal('second');
  await x.open();
  await x.select();
  assert.equal(x.dialog.open, true);
  held.resolve(result(null));
  await settle();
  assert.equal(x.dialog.open, true);
  assert.match(x.el('journal-document').textContent, /Auftrag second/);
  assert.equal(x.el('journal-narrative-editor').hidden, false);
});
test('navigation waiting on persistence cannot open a world note in another campaign', async (t) => {
  const x = setup(t);
  await x.open();
  await x.select();
  const old = [...x.el('journal-document').querySelectorAll('button')].find((b) =>
    b.textContent.includes('Texte'),
  ).onclick;
  x.dirty();
  const held = x.hold();
  x.persist = () => held.promise;
  old();
  await settle();
  x.activate('B');
  held.resolve(result(null));
  await settle();
  assert.deepEqual(x.navigation, []);
});
test('out-of-order list answers keep the newest search and its controls', async (t) => {
  const x = setup(t);
  await x.open();
  let release;
  const old = new Promise((r) => (release = r));
  x.releases.push(() => release(journal('old')));
  x.page = async (_, q) => (q.search === 'old' ? old : journal('latest'));
  x.el('journal-search').value = 'old';
  x.el('journal-refresh').click();
  await settle();
  x.el('journal-search').value = 'latest';
  x.el('journal-refresh').click();
  await settle();
  release(journal('old'));
  await settle();
  assert.match(x.el('journal-list').textContent, /Auftrag latest/);
  assert.doesNotMatch(x.el('journal-list').textContent, /Auftrag old/);
});
test('repeated opening while the workspace flush waits shows the dialog once', async (t) => {
  const x = setup(t),
    held = x.hold();
  x.flush = () => held.promise;
  x.el('narrative-journal-open').click();
  x.el('narrative-journal-open').click();
  held.resolve(true);
  await settle();
  assert.equal(x.dialog.open, true);
  assert.equal(x.reads.length, 1);
  assert.deepEqual(
    x.messages.filter((m) => m.error),
    [],
  );
});
test('failed persistence keeps the journal and raw draft available for explicit retry', async (t) => {
  const x = setup(t);
  await x.open();
  await x.select();
  x.dirty();
  x.persist = async () => ({ ok: false, error: 'Datenträger nicht verfügbar' });
  await x.close();
  assert.equal(x.dialog.open, true);
  assert.equal(
    x.el('journal-narrative-editor').querySelector('[aria-label="Quest-XP-Pool"]').value,
    '-',
  );
  assert.ok(x.messages.some((m) => m.error && m.text.includes('Datenträger')));
  x.persist = async () => result(null);
  await x.close();
  assert.equal(x.dialog.open, false);
  assert.deepEqual(x.commands, []);
});
test('removed narrative save and discard controls cannot write or clear the restored owner', async (t) => {
  const x = setup(t);
  await x.original();
  await x.open();
  await x.select();
  const buttons = [...x.el('journal-narrative-editor').querySelectorAll('button')],
    save = buttons.find((b) => b.textContent === 'Narrative Angaben speichern').onclick,
    discard = buttons.find((b) => b.textContent === 'Eingabe verwerfen').onclick;
  await x.close();
  const pool = x.el('narrative-editor').querySelector('[aria-label="Quest-XP-Pool"]');
  pool.value = '31';
  pool.oninput();
  save();
  discard();
  await settle();
  assert.deepEqual(x.commands, []);
  assert.equal(x.el('narrative-editor').querySelector('[aria-label="Quest-XP-Pool"]').value, '31');
});

test('a late persisted draft from a previous owner terminates without retrying against newer dirty input', async (t) => {
  const x = setup(t);
  await x.open();
  await x.select();
  x.dirty();
  const held = x.hold();
  x.persist = () => held.promise;
  const old = x.ui.flushNarrative();
  await settle();
  assert.equal(x.persisted.length, 1);
  x.activate('B');
  x.persist = async () => result(null);
  x.page = async () => journal('second');
  await x.open();
  await x.select();
  x.dirty();
  held.resolve(result(null));
  assert.equal(await old, true);
  await settle();
  assert.equal(x.persisted.length, 1);
  assert.equal(
    x.el('journal-narrative-editor').querySelector('[aria-label="Quest-XP-Pool"]').value,
    '-',
  );
  assert.deepEqual(x.commands, []);
});

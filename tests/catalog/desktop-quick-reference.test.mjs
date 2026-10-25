import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
const base = '.build/realist-quick-reference',
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
  entryPoints: ['src/app/catalog/quick-reference-ui.ts'],
  outfile: base + '/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { CampaignStore } = require('../../' + base + '/store.cjs'),
  tick = async () => {
    for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
  };
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
async function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'quick-reference-')),
    store = new CampaignStore(path.join(root, 'store.sqlite')),
    cam = store.create('References'),
    w = store.activate(cam.id),
    note = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      kind: 'quest',
      title: 'Alpha',
      readAloud: '  Public prose\r\n',
      gmNotes: 'Private prose',
      relations: [],
      creatureId: null,
      deleted: false,
    };
  const command = (change) => ({
    commandId: randomUUID(),
    campaignId: cam.id,
    token: w.token,
    change,
  });
  store.changePreparation(command({ kind: 'note', expectedRevision: null, note }));
  store.changePreparation(
    command({
      kind: 'note',
      expectedRevision: null,
      note: { ...note, id: randomUUID(), title: 'Beta' },
    }),
  );
  store.executeLive({
    commandId: randomUUID(),
    campaignId: cam.id,
    token: w.token,
    action: { kind: 'initialize', expectedRosterRevision: 0 },
  });
  const { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8')),
    saved = {
      window: globalThis.window,
      document: globalThis.document,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    };
  Object.assign(globalThis, { window, document });
  window.HTMLInputElement.prototype.select = function () {
    this.selectionStart = 0;
    this.selectionEnd = this.value.length;
  };
  const timers = new Map();
  let timerId = 0;
  globalThis.setTimeout = (fn) => {
    timers.set(++timerId, fn);
    return timerId;
  };
  globalThis.clearTimeout = (id) => timers.delete(id);
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this._value ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this._value = String(v);
    },
  });
  const query = document.querySelector.bind(document);
  document.querySelector = (selector) =>
    selector === 'dialog:modal:not(#quick-reference)'
      ? ([...document.querySelectorAll('dialog')].find(
          (d) => d.open && d.id !== 'quick-reference',
        ) ?? null)
      : query(selector);
  const host = document.createElement('button');
  host.id = 'narrative-journal-open';
  document.getElementById('party-shortcut').after(host);
  const file = require.resolve('../../' + base + '/ui.cjs');
  delete require.cache[file];
  const ui = require(file),
    messages = [],
    handoffs = [],
    reads = [];
  const x = {
    store,
    w,
    note,
    command,
    window,
    document,
    ui,
    messages,
    handoffs,
    reads,
    drain: async () => true,
    el: (id) => document.getElementById(id),
  };
  const ok = (fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  window.campaign = {};
  for (const method of ['searchDesk', 'live', 'sceneDesk', 'pinSceneDesk'])
    window.campaign[method] = async (...args) => ok(() => store[method](...args));
  window.campaign.deskContent = async (...args) => {
    reads.push(args);
    return ok(() => store.deskContent(...args));
  };
  ui.initQuickReference(
    (...args) => messages.push(args),
    () => x.drain(),
    async (action) => handoffs.push(action),
  );
  const dialog = x.el('quick-reference');
  dialog.open = false;
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
  };
  x.dialog = dialog;
  ui.activateQuickReference(w);
  x.el('quick-kind').value = 'world';
  x.el('quick-reference-open').click();
  await tick();
  assert.equal(x.el('quick-results').querySelectorAll('button:not(.quick-more)').length, 2);
  x.submit = () => x.el('quick-search-form').onsubmit({ preventDefault() {} });
  t.after(async () => {
    ui.activateQuickReference(w);
    await tick();
    Object.assign(globalThis, saved);
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return x;
}
test('a removed search row cannot reopen its reference after the query changes', async (t) => {
  const x = await fixture(t),
    old = x.el('quick-results').querySelector('button');
  x.el('quick-search').value = 'Beta';
  x.el('quick-search').oninput();
  old.onclick();
  await tick();
  assert.equal(x.reads.length, 0);
  assert.doesNotMatch(x.el('quick-document').textContent, /Private prose/);
});
test('handoff rechecks the reviewed source after draining unsaved editor changes', async (t) => {
  const x = await fixture(t);
  x.el('quick-results').querySelector('button').click();
  await tick();
  assert.equal(x.el('quick-document').querySelector('h2').textContent, 'Alpha');
  x.drain = async () => {
    x.store.changePreparation(
      x.command({
        kind: 'note',
        expectedRevision: 1,
        note: { ...x.note, revision: 2, readAloud: 'New authored text' },
      }),
    );
    return true;
  };
  x.el('quick-use-read-aloud').click();
  await tick();
  assert.equal(x.handoffs.length, 0);
  assert.equal(x.dialog.open, true);
  assert.ok(x.messages.some(([message]) => message.includes('Inhalt geändert')));
  assert.equal(
    x.store.preparation(x.w.token).notes.find((n) => n.note.id === x.note.id).note.readAloud,
    'New authored text',
  );
});
test('a cancelled Enter query cannot override a newer explicit reference selection', async (t) => {
  const x = await fixture(t),
    held = deferred(),
    original = x.window.campaign.searchDesk;
  let first = true;
  x.window.campaign.searchDesk = (...args) => {
    if (first) {
      first = false;
      return held.promise;
    }
    return original(...args);
  };
  x.el('quick-search').oninput();
  x.submit();
  x.el('quick-search').oninput();
  x.submit();
  await tick();
  x.el('quick-results').querySelectorAll('button:not(.quick-more)')[1].click();
  await tick();
  assert.equal(x.el('quick-document').querySelector('h2').textContent, 'Beta');
  held.resolve(await original(x.w.token, 'world', '', 0));
  await tick();
  assert.equal(x.el('quick-document').querySelector('h2').textContent, 'Beta');
});

test('unchanged reference handoff keeps the exact authored text and scene identity', async (t) => {
  const x = await fixture(t),
    scene = x.store.live(x.w.token).scene;
  x.el('quick-results').querySelector('button').click();
  await tick();
  const raw = '  [Wache](dungeon-ref:note/' + x.note.id + ')\r\n[[Vault note]]';
  x.note.readAloud = raw;
  x.store.changePreparation(x.command({ kind: 'note', expectedRevision: 1, note: x.note }));
  x.el('quick-refresh').click();
  await tick();
  const unchanged = x.store.db.serialize();
  x.el('quick-use-read-aloud').click();
  await tick();
  assert.equal(x.handoffs.length, 1);
  assert.equal(x.handoffs[0].content.note.readAloud, x.note.readAloud);
  assert.equal(x.handoffs[0].sceneId, scene.id);
  assert.equal(x.dialog.open, false);
  assert.ok(x.store.db.serialize().equals(unchanged));
});
test('pinning a reference uses the existing scene owner without changing notes, time or progress', async (t) => {
  const x = await fixture(t),
    scene = x.store.live(x.w.token).scene,
    progress = x.store.progress(x.w.token),
    notes = x.store.preparation(x.w.token).notes;
  x.el('quick-results').querySelector('button').click();
  await tick();
  x.el('quick-pin').click();
  await tick();
  assert.equal(x.store.sceneDesk(x.w.token, scene.id).pins[0].ref.id, x.note.id);
  assert.match(x.el('quick-pin').textContent, /Vom Szenentisch lösen/);
  assert.deepEqual(x.store.live(x.w.token).scene.clock, scene.clock);
  assert.deepEqual(x.store.progress(x.w.token), progress);
  assert.deepEqual(x.store.preparation(x.w.token).notes, notes);
});

test('a pending creature index cannot hold back linked terms or their readable targets', async (t) => {
  const x = await fixture(t),
    held = deferred(),
    search = x.window.campaign.searchDesk,
    requests = [],
    beta = x.store.preparation(x.w.token).notes.find((r) => r.note.title === 'Beta').note;
  x.note.gmNotes = 'Private prose\r\n[Beta am Tisch](dungeon-ref:note/' + beta.id + ')';
  x.store.changePreparation(x.command({ kind: 'note', expectedRevision: 1, note: x.note }));
  const scene = x.store.live(x.w.token).scene,
    source = x.store.preparation(x.w.token).notes;
  x.window.campaign.searchDesk = (token, kind, ...args) => {
    requests.push(kind);
    if (kind === 'creature') return held.promise;
    if (kind === 'world' || kind === 'reference') return search(token, kind, ...args);
    return Promise.resolve({ ok: true, value: { entries: [], next: null } });
  };
  x.el('quick-kind').value = 'all';
  x.el('quick-kind').onchange();
  x.submit();
  await tick();
  await tick();
  assert.deepEqual(
    requests,
    ['world', 'creature', 'item', 'encounter', 'reference'],
    'each bounded source must be requested without waiting for another source',
  );
  const references = [...x.el('quick-results').querySelectorAll('section')].find(
      (s) => s.querySelector('h3')?.textContent === 'Verknüpfte Begriffe',
    ),
    alias = references.querySelector('[data-ref-id="' + beta.id + '"]');
  assert(alias, 'the healthy linked target must be available before the creature reply');
  alias.click();
  await tick();
  assert.equal(x.el('quick-document').querySelector('h2').textContent, 'Beta');
  held.resolve({ ok: false, error: 'Creature index unavailable' });
  await tick();
  assert.match(x.el('quick-results').textContent, /Creature index unavailable/);
  assert.equal(x.el('quick-document').querySelector('h2').textContent, 'Beta');
  assert.deepEqual(x.store.live(x.w.token).scene.clock, scene.clock);
  assert.deepEqual(x.store.preparation(x.w.token).notes, source);
});

test('Enter opens the first healthy reference before a pending source settles without restarting the query', async (t) => {
  const x = await fixture(t),
    wait = deferred(),
    original = x.window.campaign.searchDesk,
    requests = [];
  x.window.campaign.searchDesk = (token, kind, ...args) => {
    requests.push(kind);
    return kind === 'creature' ? wait.promise : original(token, kind, ...args);
  };
  const before = x.store.db.serialize();
  x.el('quick-kind').value = 'all';
  x.el('quick-kind').onchange();
  x.submit();
  await tick();
  assert.equal(x.el('quick-document').querySelector('h2')?.textContent, 'Alpha');
  assert.deepEqual(requests, ['world', 'creature', 'item', 'encounter', 'reference']);
  wait.resolve({ ok: false, error: 'Kreaturquelle ausgefallen' });
  await tick();
  assert.equal(x.el('quick-document').querySelector('h2')?.textContent, 'Alpha');
  assert.match(x.el('quick-results').textContent, /Kreaturquelle ausgefallen/);
  assert.ok(x.store.db.serialize().equals(before));
});
test('Enter reuses partial results of the current search rather than issuing five duplicate reads', async (t) => {
  const x = await fixture(t),
    wait = deferred(),
    original = x.window.campaign.searchDesk,
    requests = [];
  x.el('quick-search').oninput();
  x.el('quick-close').click();
  x.el('quick-kind').value = 'all';
  x.window.campaign.searchDesk = (token, kind, ...args) => {
    requests.push(kind);
    return kind === 'creature' ? wait.promise : original(token, kind, ...args);
  };
  await x.ui.openQuickReference();
  await tick();
  assert.ok(x.el('quick-results').querySelector('button'));
  x.submit();
  await tick();
  assert.equal(x.el('quick-document').querySelector('h2')?.textContent, 'Alpha');
  assert.equal(requests.length, 5);
  wait.resolve({ ok: false, error: 'Kreaturen später nicht verfügbar' });
  await tick();
});
test('a delayed healthy source cannot fulfill Enter after explicit detail navigation or closing', async (t) => {
  const x = await fixture(t),
    wait = deferred(),
    original = x.window.campaign.searchDesk,
    beta = x.store.preparation(x.w.token).notes.find((r) => r.note.title === 'Beta').note;
  x.window.campaign.searchDesk = (token, kind, ...args) =>
    kind === 'world' ? wait.promise : original(token, kind, ...args);
  x.el('quick-search').oninput();
  x.submit();
  await tick();
  await x.ui.openQuickReference({ kind: 'note', id: beta.id });
  assert.equal(x.el('quick-document').querySelector('h2')?.textContent, 'Beta');
  wait.resolve(await original(x.w.token, 'world', '', 0));
  await tick();
  assert.equal(x.el('quick-document').querySelector('h2')?.textContent, 'Beta');
  assert.equal(x.reads.filter((r) => r[1].id === x.note.id).length, 0);
  const closeWait = deferred();
  x.window.campaign.searchDesk = () => closeWait.promise;
  x.el('quick-search').oninput();
  x.submit();
  await tick();
  x.el('quick-close').click();
  closeWait.resolve(await original(x.w.token, 'world', '', 0));
  await tick();
  assert.equal(x.dialog.open, false);
  assert.equal(x.el('quick-document').querySelector('h2')?.textContent, 'Beta');
});

test('quick results expose the matching private note excerpt as literal text before any source is opened', async (t) => {
  const x = await fixture(t),
    text =
      '😀 '.repeat(160) + 'Bernsteinharz führt Mara zum Wachhaus <img src=x onerror=alert(1)>.';
  x.store.changePreparation(
    x.command({ kind: 'note', expectedRevision: 1, note: { ...x.note, gmNotes: text } }),
  );
  x.el('quick-close').click();
  x.el('quick-search').value = 'Bernsteinharz';
  x.el('quick-reference-open').click();
  await tick();
  const preview = x.el('quick-results').querySelector('.desk-search-preview');
  assert.ok(preview);
  assert.match(preview.textContent, /GM-Notiz.*Bernsteinharz führt Mara zum Wachhaus/);
  assert.equal(x.el('quick-results').querySelector('img'), null);
  assert.equal(x.reads.length, 0);
  x.el('quick-results').querySelector('button').click();
  await tick();
  assert.equal(x.el('quick-document').querySelector('h2').textContent, 'Alpha');
  assert.ok(x.el('quick-document').textContent.includes(text));
});

for (const initial of [true, false])
  test(`refresh retries the selected failed reference ${initial ? 'without prior history' : 'after following an inline link'}`, async (t) => {
    const x = await fixture(t),
      beta = x.store.preparation(x.w.token).notes.find((r) => r.note.title === 'Beta').note;
    if (!initial) {
      x.note.gmNotes = '[Zum Ziel](dungeon-ref:note/' + beta.id + ')';
      x.store.changePreparation(x.command({ kind: 'note', expectedRevision: 1, note: x.note }));
      x.el('quick-results')
        .querySelector('[data-ref-id="' + x.note.id + '"]')
        .click();
      await tick();
      assert.equal(x.el('quick-document').querySelector('h2').textContent, 'Alpha');
    }
    const row = x.store.db
      .prepare('SELECT payload,checksum FROM world_note WHERE campaign_id=? AND id=?')
      .get(x.w.campaign.id, beta.id);
    x.store.db
      .prepare('UPDATE world_note SET checksum=? WHERE campaign_id=? AND id=?')
      .run('controlled-read-fault', x.w.campaign.id, beta.id);
    if (initial)
      x.el('quick-results')
        .querySelector('[data-ref-id="' + beta.id + '"]')
        .click();
    else x.el('quick-document').querySelector('.text-reference-inline').click();
    await tick();
    assert.match(x.el('quick-document').textContent, /Inhalt fehlt oder ist beschädigt/);
    assert.doesNotMatch(x.el('quick-document').textContent, /Inhalt wird gelesen/);
    x.store.db
      .prepare('UPDATE world_note SET checksum=? WHERE campaign_id=? AND id=?')
      .run(row.checksum, x.w.campaign.id, beta.id);
    const bytes = x.store.db.serialize();
    x.el('quick-refresh').click();
    await tick();
    assert.equal(x.el('quick-document').querySelector('h2')?.textContent, 'Beta');
    assert.equal(x.reads.at(-1)[1].id, beta.id);
    if (!initial) {
      x.el('quick-back').click();
      await tick();
      assert.equal(x.el('quick-document').querySelector('h2').textContent, 'Alpha');
      x.el('quick-forward').click();
      await tick();
      assert.equal(x.el('quick-document').querySelector('h2').textContent, 'Beta');
    }
    assert.ok(
      x.store.db.serialize().equals(bytes),
      'reference recovery and history navigation remain read-only',
    );
  });

test('direct source inspection starts with its reading document and searches other catalogs only on request', async (t) => {
  const x = await fixture(t);
  x.el('quick-close').click();
  const search = x.window.campaign.searchDesk,
    calls = [];
  x.window.campaign.searchDesk = async (...args) => {
    calls.push(args);
    return search(...args);
  };
  await x.ui.openQuickReference({ kind: 'note', id: x.note.id });
  await tick();
  assert.equal(x.dialog.classList.contains('quick-reading'), true);
  assert.equal(x.el('quick-show-search').hidden, false);
  assert.equal(x.el('quick-document').querySelector('h2').textContent, 'Alpha');
  assert.equal(calls.length, 0);
  x.el('quick-show-search').click();
  await tick();
  assert.equal(x.dialog.classList.contains('quick-reading'), false);
  assert.ok(calls.length);
  assert.equal(x.el('quick-document').querySelector('h2').textContent, 'Alpha');
  x.el('quick-close').click();
  await x.ui.openQuickReference();
  assert.equal(x.dialog.classList.contains('quick-reading'), false);
});

function parentDialog(x, id = 'key-dialog') {
  const parent = x.el(id);
  parent.showModal = () => {
    parent.open = true;
  };
  parent.close = () => {
    parent.open = false;
    parent.dispatchEvent(new x.window.Event('close'));
  };
  parent.showModal();
  return parent;
}
test('explicit inspection stacks only over its own open parent and exposes no game or editing handoffs', async (t) => {
  const x = await fixture(t);
  x.el('quick-close').click();
  const parent = parentDialog(x),
    snapshot = x.store.db.serialize();
  await x.ui.openQuickReference({ kind: 'note', id: x.note.id });
  assert.equal(x.dialog.open, false);
  await x.ui.inspectQuickReference({ kind: 'note', id: x.note.id }, () => true, parent);
  assert.equal(x.dialog.open, true);
  assert.equal(parent.open, true);
  assert.equal(x.el('quick-close').textContent, 'Zurück zur Notiz');
  assert.match(x.el('quick-document').textContent, /Private prose/);
  assert.equal(x.el('quick-document').querySelectorAll('.toolbar button').length, 0);
  assert.equal(x.el('quick-pin'), null);
  assert.equal(x.el('quick-use-read-aloud'), null);
  assert.equal(x.handoffs.length, 0);
  assert.ok(x.store.db.serialize().equals(snapshot));
  x.el('quick-close').click();
  assert.equal(parent.open, true);
  parent.close();
  await x.ui.openQuickReference({ kind: 'note', id: x.note.id });
  assert.ok(x.el('quick-pin'));
  assert.ok(x.el('quick-use-read-aloud'));
  assert.equal(x.el('quick-close').textContent, 'Schließen');
});
for (const mode of ['close', 'scope'])
  test('inspection cancels private reads after parent/editor invalidation: ' + mode, async (t) => {
    const x = await fixture(t);
    x.el('quick-close').click();
    const parent = parentDialog(x),
      read = x.window.campaign.deskContent,
      held = deferred();
    let valid = true;
    x.window.campaign.deskContent = async (...args) => {
      const value = await read(...args);
      await held.promise;
      return value;
    };
    const pending = x.ui.inspectQuickReference(
      { kind: 'note', id: x.note.id },
      () => valid,
      parent,
    );
    await tick();
    if (mode === 'close') parent.close();
    else valid = false;
    held.resolve();
    await pending;
    assert.equal(x.dialog.open, false);
    assert.doesNotMatch(x.el('quick-document').textContent, /Private prose/);
    assert.equal(x.handoffs.length, 0);
  });
test('a second dialog or a parent closed during input drain cannot be covered by an inspection', async (t) => {
  const x = await fixture(t);
  x.el('quick-close').click();
  const parent = parentDialog(x),
    other = parentDialog(x, 'location-dialog');
  await x.ui.inspectQuickReference({ kind: 'note', id: x.note.id }, () => true, parent);
  assert.equal(x.dialog.open, false);
  other.close();
  x.drain = async () => {
    parent.close();
    return true;
  };
  await x.ui.inspectQuickReference({ kind: 'note', id: x.note.id }, () => true, parent);
  assert.equal(x.dialog.open, false);
  assert.equal(x.reads.length, 0);
});
test('inspection search and history remain read-only even for a location section reference', async (t) => {
  const x = await fixture(t);
  x.el('quick-close').click();
  const parent = parentDialog(x);
  await x.ui.inspectQuickReference({ kind: 'note', id: x.note.id }, () => true, parent);
  x.el('quick-show-search').click();
  await tick();
  x.el('quick-results').querySelectorAll('button:not(.quick-more)')[1].click();
  await tick();
  assert.equal(x.el('quick-document').querySelector('h2').textContent, 'Beta');
  assert.equal(x.el('quick-document').querySelectorAll('.toolbar button').length, 0);
  x.el('quick-back').click();
  await tick();
  assert.equal(x.el('quick-document').querySelector('h2').textContent, 'Alpha');
  const read = x.window.campaign.deskContent;
  x.window.campaign.deskContent = async (token, ref) =>
    ref.kind === 'location'
      ? {
          ok: true,
          value: {
            ref,
            title: 'Ortsabschnitt',
            label: 'Ort',
            revision: 1,
            location: { sections: [{ title: 'Ankunft', markdown: 'Nur lesen' }] },
          },
        }
      : read(token, ref);
  await x.ui.inspectQuickReference(
    { kind: 'location', id: randomUUID(), sectionId: randomUUID() },
    () => true,
    parent,
  );
  assert.equal(x.dialog.open, true);
  assert.match(x.el('quick-document').textContent, /Nur lesen/);
  assert.equal(x.handoffs.length, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildSync } from '../helpers/build.mjs';
import { fixtureStore } from '../helpers/store.mjs';
import { parseHTML } from '../helpers/dom.mjs';
import { readWorkspaceMarkup } from '../../tools/desktop-markup.mjs';
for (const [entry, name] of [
  ['src/app/campaign/preparation.ts', 'editor'],
  ['src/app/storage/store.ts', 'store'],
])
  buildSync({
    entryPoints: [entry],
    outfile: `.build/preparation-owner-${name}.cjs`,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const require = createRequire(import.meta.url);
const { createPreparation } = require('../../.build/preparation-owner-editor.cjs');
const { CampaignStore } = require('../../.build/preparation-owner-store.cjs');
const tick = async () => {
  for (let n = 0; n < 12; n++) await new Promise((resolve) => setImmediate(resolve));
};
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'preparation-owner-'));
  const store = fixtureStore(CampaignStore, path.join(dir, 'workbench.sqlite'));
  function campaign(name) {
    const c = store.create(name),
      w = store.activate(c.id);
    const note = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      title: name,
      kind: 'npc',
      gmNotes: `  ${name}\r\nOriginal  `,
      readAloud: '',
      relations: [],
      creatureId: null,
      deleted: false,
    };
    store.changePreparation({
      token: w.token,
      campaignId: c.id,
      commandId: randomUUID(),
      change: { kind: 'note', expectedRevision: null, note },
    });
    return { campaign: c, note };
  }
  const a = campaign('A'),
    b = campaign('B');
  const { document, window } = parseHTML(readWorkspaceMarkup());
  const prior = Object.fromEntries(
    ['window', 'document', 'Option', 'Event', 'setTimeout', 'clearTimeout'].map((key) => [
      key,
      globalThis[key],
    ]),
  );
  const values = new WeakMap();
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return values.get(this) ?? this.options[0]?.value ?? '';
    },
    set(value) {
      values.set(this, String(value));
    },
  });
  window.HTMLSelectElement.prototype.add = function (option) {
    this.append(option);
  };
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  window.HTMLElement.prototype.setSelectionRange = function (start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  };
  Object.assign(globalThis, {
    window,
    document,
    Event: window.Event,
    Option: function (text, value) {
      const n = document.createElement('option');
      n.textContent = text;
      n.value = value;
      return n;
    },
    setTimeout: () => 0,
    clearTimeout() {},
  });
  const messages = [],
    calls = [],
    overrides = {};
  const invoke = async (method, ...args) => {
    try {
      return { ok: true, value: store[method](...args) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };
  const api = new Proxy(overrides, {
    get(target, key) {
      return key in target
        ? target[key]
        : async (...args) => {
            calls.push({ method: key, args });
            return invoke(key, ...args);
          };
    },
  });
  window.campaign = api;
  const el = (id) => document.getElementById(id);
  const ui = createPreparation({
    roots: ['preparation', 'world-dialog', 'location-dialog', 'note-excerpt-dialog'].map(el),
    dialogHost: el('preparation'),
    api,
    storage: { getItem: () => null, setItem() {}, removeItem() {} },
    navigation: { locationNotebook: async () => {}, roomKey: async () => false },
    planning: {
      initSession() {},
      sessionContext: async () => {},
      sessionVisitReadAlouds: () => new Map(),
      flushSession: async () => true,
      clearSessionTimeline() {},
      linkVisitNoteThread: async () => {},
    },
  });
  ui.initPreparation(
    (text, error) => messages.push({ text, error }),
    async () => {},
  );
  t.after(() => {
    ui.deactivate();
    Object.assign(globalThis, prior);
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const input = (raw) => {
    el('note-gm').value = raw;
    el('note-gm').dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const activate = async (c) => {
    const w = store.activate(c.campaign.id);
    await ui.activatePreparation(w);
    return w;
  };
  const saved = (c) =>
    JSON.parse(
      store.db
        .prepare('SELECT payload FROM world_note WHERE campaign_id=? AND id=?')
        .get(c.campaign.id, c.note.id).payload,
    );
  return {
    store,
    a,
    b,
    document,
    window,
    el,
    ui,
    api,
    invoke,
    calls,
    messages,
    input,
    activate,
    saved,
  };
}

test('a retired Preparation read cannot replace input or mutate either campaign after A→B→A', async (t) => {
  const x = fixture(t),
    held = deferred();
  await x.activate(x.a);
  const read = x.invoke.bind(null, 'preparation');
  let old;
  x.api.preparation = async (...args) => {
    old = await read(...args);
    return held.promise;
  };
  const opening = x.ui.openPreparedNote(x.a.note.id);
  await tick();
  assert(old?.ok);
  x.api.preparation = read;
  await x.activate(x.b);
  x.input('  B bleibt\r\n');
  assert.equal(await x.ui.flushPreparation(), true);
  await x.activate(x.a);
  const raw = '  A neu\r\n[[Autor]]  ';
  x.input(raw);
  const before = x.store.db.serialize(),
    status = structuredClone(x.messages);
  held.resolve(old);
  assert.equal(await opening, false);
  assert.equal(x.el('note-gm').value, raw);
  assert.deepEqual(x.messages, status);
  assert(x.store.db.serialize().equals(before));
  assert.equal(x.saved(x.a).gmNotes, x.a.note.gmNotes);
  assert.equal(x.saved(x.b).gmNotes, '  B bleibt\r\n');
});

test('Preparation drains input entered during its own acknowledgement against the confirmed revision', async (t) => {
  const x = fixture(t),
    held = deferred(),
    writes = [];
  await x.activate(x.a);
  x.api.changePreparation = async (command) => {
    writes.push(structuredClone(command));
    const result = await x.invoke('changePreparation', command);
    return writes.length === 1 ? held.promise.then(() => result) : result;
  };
  x.input('  Gesendet\r\n');
  const flush = x.ui.flushPreparation();
  await tick();
  assert.equal(writes.length, 1);
  x.input('  Spätere Eingabe\r\n');
  held.resolve();
  assert.equal(await flush, true);
  assert.deepEqual(
    writes.map((c) => c.change.note.gmNotes),
    ['  Gesendet\r\n', '  Spätere Eingabe\r\n'],
  );
  assert.deepEqual(
    writes.map((c) => c.change.expectedRevision),
    [1, 2],
  );
  assert.equal(x.saved(x.a).gmNotes, '  Spätere Eingabe\r\n');
  assert.equal(x.saved(x.b).gmNotes, x.b.note.gmNotes);
  assert.equal(x.el('note-gm').value, '  Spätere Eingabe\r\n');
});

for (const applied of [false, true])
  test(`Preparation preserves a failed draft and checks its original ${applied ? 'committed' : 'unapplied'} command before explicit retry`, async (t) => {
    const x = fixture(t),
      writes = [];
    await x.activate(x.a);
    x.api.changePreparation = async (command) => {
      writes.push(structuredClone(command));
      if (writes.length === 1) {
        if (applied) assert.equal((await x.invoke('changePreparation', command)).ok, true);
        return { ok: false, error: applied ? 'Antwort verloren' : 'Speicher offline' };
      }
      return x.invoke('changePreparation', command);
    };
    x.input('  Erster Auftrag\r\n');
    assert.equal(await x.ui.flushPreparation(), false);
    assert.equal(await x.ui.flushPreparation(), false);
    assert.equal(writes.length, 1, 'unclear writes cannot retry automatically');
    assert.equal(x.saved(x.a).gmNotes, applied ? '  Erster Auftrag\r\n' : x.a.note.gmNotes);
    assert.equal(x.el('preparation-reconcile').hidden, false);
    x.input('  Späterer Entwurf\r\n');
    const receipts = [];
    x.api.reconcilePreparation = async (command) => {
      receipts.push(structuredClone(command));
      return x.invoke('reconcilePreparation', command);
    };
    x.el('preparation-reconcile').click();
    await tick();
    assert.equal(receipts[0]?.commandId, writes[0].commandId);
    assert.equal(writes.length, 1, 'status clarification reads the receipt without sending again');
    assert.equal(x.el('preparation-reconcile').hidden, true);
    assert.equal(x.el('note-gm').value, '  Späterer Entwurf\r\n');
    assert.equal(await x.ui.flushPreparation(), true);
    assert.equal(writes.length, 2);
    assert.notEqual(writes[1].commandId, writes[0].commandId);
    assert.equal(x.saved(x.a).gmNotes, '  Späterer Entwurf\r\n');
    assert.equal(x.saved(x.b).gmNotes, x.b.note.gmNotes);
  });

test('the real Preparation reference consumer rejects verification after later literal input', async (t) => {
  const x = fixture(t),
    held = deferred();
  const w = await x.activate(x.a);
  const area = x.el('note-gm');
  area.setSelectionRange(2, 2);
  x.el('note-text-reference').click();
  await tick();
  const picker = x.el('text-reference-picker');
  assert(picker?.open);
  x.el('text-reference-results').querySelector('button').click();
  await tick();
  assert.equal(x.el('text-reference-insert').disabled, false);
  const source = await x.invoke('deskContent', w.token, { kind: 'note', id: x.a.note.id });
  assert.equal(source.ok, true);
  x.api.deskContent = () => held.promise;
  x.el('text-reference-insert').click();
  x.input('  Während Quellenprüfung\r\n');
  const before = x.store.db.serialize();
  held.resolve(source);
  await tick();
  assert.equal(x.el('text-reference-picker'), null);
  assert.equal(area.value, '  Während Quellenprüfung\r\n');
  assert.equal(x.saved(x.a).gmNotes, x.a.note.gmNotes);
  assert(x.store.db.serialize().equals(before));
});

test('input during the reference preflight is drained before the old selection can open a picker', async (t) => {
  const x = fixture(t),
    held = deferred(),
    writes = [];
  await x.activate(x.a);
  x.api.changePreparation = async (command) => {
    writes.push(structuredClone(command));
    const result = await x.invoke('changePreparation', command);
    return writes.length === 1 ? held.promise.then(() => result) : result;
  };
  x.input('  Vor Auswahl\r\n');
  x.el('note-gm').setSelectionRange(2, 5);
  x.el('note-text-reference').click();
  await tick();
  assert.equal(writes.length, 1);
  x.input('  Während Sicherung\r\n');
  held.resolve();
  await tick();
  assert.equal(x.el('text-reference-picker'), null);
  assert.equal(x.calls.filter((c) => c.method === 'searchDesk').length, 0);
  assert.equal(x.el('note-gm').value, '  Während Sicherung\r\n');
  assert.equal(x.saved(x.a).gmNotes, '  Während Sicherung\r\n');
  assert.deepEqual(
    writes.map((c) => c.change.note.gmNotes),
    ['  Vor Auswahl\r\n', '  Während Sicherung\r\n'],
  );
});

test('the same token and note after reactivation cannot accept the old verified insertion', async (t) => {
  const x = fixture(t),
    held = deferred(),
    w = await x.activate(x.a);
  x.el('note-gm').setSelectionRange(2, 2);
  x.el('note-text-reference').click();
  await tick();
  x.el('text-reference-results').querySelector('button').click();
  await tick();
  const source = await x.invoke('deskContent', w.token, { kind: 'note', id: x.a.note.id });
  x.api.deskContent = () => held.promise;
  x.el('text-reference-insert').click();
  await x.ui.activatePreparation(w);
  const before = x.store.db.serialize();
  held.resolve(source);
  await tick();
  assert.equal(x.el('text-reference-picker'), null);
  assert.equal(x.el('note-gm').value, x.a.note.gmNotes);
  assert(x.store.db.serialize().equals(before));
});

test('a delayed real Preparation receipt after campaign change cannot replace the new draft, publish feedback or replay', async (t) => {
  const x = fixture(t),
    held = deferred(),
    writes = [];
  const bWorkspace = x.store.activate(x.b.campaign.id);
  x.b.note = { ...x.b.note, revision: 2, readAloud: 'Nur die neue Kampagne' };
  x.store.changePreparation({
    token: bWorkspace.token,
    campaignId: x.b.campaign.id,
    commandId: randomUUID(),
    change: { kind: 'note', expectedRevision: 1, note: x.b.note },
  });
  await x.activate(x.a);
  x.api.changePreparation = async (command) => {
    writes.push(structuredClone(command));
    return writes.length === 1
      ? { ok: false, error: 'Antwort verloren vor Anwendung' }
      : x.invoke('changePreparation', command);
  };
  x.input('  Alter ungeklärter Auftrag\r\n');
  assert.equal(await x.ui.flushPreparation(), false);
  let receiptStarted = false;
  x.api.reconcilePreparation = async (...args) => {
    const result = await x.invoke('reconcilePreparation', ...args);
    receiptStarted = true;
    await held.promise;
    return result;
  };
  x.el('preparation-reconcile').click();
  await tick();
  assert.equal(receiptStarted, true);
  await x.activate(x.b);
  const raw = '  B nach Wechsel\r\n[[Wörtlich]]  ';
  x.input(raw);
  const before = x.store.db.serialize(),
    messages = structuredClone(x.messages);
  held.resolve();
  await tick();
  assert.equal(x.el('note-title').value, 'B');
  assert.equal(x.el('note-read-aloud').value, 'Nur die neue Kampagne');
  assert.equal(x.el('note-gm').value, raw);
  assert.deepEqual(x.messages, messages);
  assert.equal(writes.length, 1, 'receipt completion cannot resend the old command');
  assert.deepEqual(x.store.db.serialize(), before);
  assert.equal(await x.ui.flushPreparation(), true);
  assert.equal(writes.length, 2);
  assert.equal(writes[1].campaignId, x.b.campaign.id);
  assert.equal(x.saved(x.b).gmNotes, raw);
  assert.equal(x.saved(x.a).gmNotes, x.a.note.gmNotes);
});

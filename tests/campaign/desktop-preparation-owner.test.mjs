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
    ...(name === 'editor'
      ? {
          stdin: {
            contents:
              "export * from './src/app/campaign/preparation'; export * from './src/app/campaign/session-packet-ui';",
            resolveDir: process.cwd(),
            loader: 'ts',
          },
        }
      : { entryPoints: [entry] }),
    outfile: `.build/preparation-owner-${name}.cjs`,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const require = createRequire(import.meta.url);
const packetUi = require('../../.build/preparation-owner-editor.cjs');
const { createPreparation } = packetUi;
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
  window.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const el = (id) => document.getElementById(id);
  const ui = createPreparation({
    roots: ['preparation', 'world-dialog', 'location-dialog', 'note-excerpt-dialog'].map(el),
    dialogHost: el('preparation'),
    api,
    storage: window.localStorage,
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
  t.after(async () => {
    Object.assign(globalThis, { document, window });
    if (el('session-packet-dialog')) packetUi.closeSessionPacket();
    await ui.activatePreparation(store.activate(a.campaign.id), false);
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

test('Preparation navigation and close drain wait for accepted writes and later input', async (t) => {
  const x = fixture(t),
    held = deferred(),
    writes = [];
  await x.activate(x.a);
  x.api.changePreparation = async (command) => {
    writes.push(structuredClone(command));
    const result = await x.invoke('changePreparation', command);
    return writes.length === 1 ? held.promise.then(() => result) : result;
  };
  x.input('  Vor der Grenze\r\n');
  const flush = x.ui.flushPreparation();
  await tick();
  let left = false,
    closed = false;
  const leaving = x.ui.leavePreparation().then((result) => {
    left = true;
    return result;
  });
  const closing = x.ui.editorSession.settle().then(() => {
    closed = true;
  });
  await tick();
  assert.equal(left, false);
  assert.equal(closed, false);
  assert.equal(writes.length, 1);
  x.input('  Nach Beginn der Grenze\r\n');
  held.resolve();
  assert.equal(await flush, true);
  assert.equal(await leaving, true);
  await closing;
  assert.equal(x.saved(x.a).gmNotes, '  Nach Beginn der Grenze\r\n');
  assert.deepEqual(
    writes.map((command) => command.change.expectedRevision),
    [1, 2],
  );
  assert.equal(x.ui.editorSession.status.openInput, false);
});

test('two Preparation instances keep drafts, pending writes and DOM controls isolated', async (t) => {
  const first = fixture(t),
    second = fixture(t),
    held = deferred();
  await first.activate(first.a);
  await second.activate(second.b);
  first.input('  Erste Instanz\r\n');
  second.input('  Zweite Instanz\r\n');
  first.api.changePreparation = async (command) => {
    const result = await first.invoke('changePreparation', command);
    await held.promise;
    return result;
  };
  const pending = first.ui.flushPreparation();
  await tick();
  assert.equal(await second.ui.flushPreparation(), true);
  assert.equal(second.saved(second.b).gmNotes, '  Zweite Instanz\r\n');
  assert.equal(first.ui.editorSession.status.saving, true);
  assert.equal(second.ui.editorSession.status.saving, false);
  first.ui.deactivate();
  let drained = false;
  const closing = first.ui.editorSession.settle().then(() => {
    drained = true;
  });
  await tick();
  assert.equal(drained, false, 'detaching a surface cannot release its accepted write');
  held.resolve();
  assert.equal(await pending, false, 'a retired acknowledgement cannot publish into the surface');
  await closing;
  assert.equal(first.saved(first.a).gmNotes, '  Erste Instanz\r\n');
  assert.equal(second.el('note-gm').value, '  Zweite Instanz\r\n');
  assert.equal(second.ui.editorSession.status.openInput, false);
});

test('a direct Preparation creation belongs to the close drain before its acknowledgement arrives', async (t) => {
  const x = fixture(t),
    held = deferred();
  await x.activate(x.a);
  let accepted;
  x.api.changePreparation = async (command) => {
    accepted = structuredClone(command);
    const result = await x.invoke('changePreparation', command);
    await held.promise;
    return result;
  };
  x.el('world-kind').value = 'note';
  x.el('world-name').value = 'Direkt angelegt';
  x.el('world-form').dispatchEvent(new x.window.Event('submit', { cancelable: true }));
  await tick();
  assert.equal(accepted?.change.note.title, 'Direkt angelegt');
  let closed = false;
  const closing = x.ui.editorSession.settle().then(() => {
    closed = true;
  });
  await tick();
  assert.equal(closed, false);
  held.resolve();
  await closing;
  await tick();
  assert.equal(x.el('note-title').value, 'Direkt angelegt');
  assert.equal(
    x.store.preparation(accepted.token).notes.filter((row) => row.note.title === 'Direkt angelegt')
      .length,
    1,
  );
});

// Keep these on the composed Preparation instance and real SQLite writer. The
// dialogs borrow its actual controls; they do not imitate the draft lifecycle.
async function nestedNotebook(t) {
  const x = fixture(t),
    w = await x.activate(x.a);
  const leaf = {
    ...x.a.note,
    id: randomUUID(),
    title: 'Blatt',
    revision: 1,
    gmNotes: '  Blatt original\r\n',
    relations: [],
  };
  const child = {
    ...leaf,
    id: randomUUID(),
    title: 'Kindmappe',
    gmNotes: '  Kind original\r\n',
    relations: [{ targetId: leaf.id, label: 'Quelle' }],
  };
  for (const note of [leaf, child])
    x.store.changePreparation({
      token: w.token,
      campaignId: x.a.campaign.id,
      commandId: randomUUID(),
      change: { kind: 'note', expectedRevision: null, note },
    });
  x.a.note = { ...x.a.note, revision: 2, relations: [{ targetId: child.id, label: 'Quelle' }] };
  x.store.changePreparation({
    token: w.token,
    campaignId: x.a.campaign.id,
    commandId: randomUUID(),
    change: { kind: 'note', expectedRevision: 1, note: x.a.note },
  });
  await x.ui.activatePreparation(w);
  x.el('note-thread-open').click();
  await tick();
  assert.equal(x.el('note-thread-heading').textContent, 'Notizmappe: A');
  const sourceAction = (id, text) => {
    const card = x.el('note-thread-sources').querySelector(`article[data-note-id="${id}"]`);
    const button = [...card.querySelectorAll('button')].find((b) => b.textContent === text);
    assert(
      button && !button.disabled,
      x.el('note-thread-status').textContent + ' | ' + card.outerHTML,
    );
    button.click();
  };
  sourceAction(child.id, 'Notiz bearbeiten…');
  await tick();
  assert.equal(x.el('note-title').value, child.title);
  assert.equal(x.el('note-thread-editor').hidden, false);
  const saved = (note) =>
    JSON.parse(
      x.store.db
        .prepare('SELECT payload FROM world_note WHERE campaign_id=? AND id=?')
        .get(x.a.campaign.id, note.id).payload,
    );
  return { ...x, child, leaf, sourceAction, savedNote: saved };
}

test('nested notebook navigation drains literal input entered during the original child acknowledgement', async (t) => {
  const x = await nestedNotebook(t),
    held = deferred(),
    writes = [];
  x.api.changePreparation = async (command) => {
    writes.push(structuredClone(command));
    const result = await x.invoke('changePreparation', command);
    if (writes.length === 1) await held.promise;
    return result;
  };
  x.input('  Vor verschachtelter Navigation\r\n');
  x.el('note-thread-open').click();
  await tick();
  assert.equal(writes.length, 1);
  assert.equal(x.el('note-thread-editor').hidden, false);
  const raw = '  Weitere Kind-Eingabe\r\n[[Wörtlich]]  ';
  x.input(raw);
  held.resolve();
  await tick();
  assert.equal(x.el('note-thread-heading').textContent, 'Notizmappe: Kindmappe');
  assert.equal(x.el('note-thread-editor').hidden, true);
  assert.equal(x.el('note-gm').value, raw);
  assert.equal(x.savedNote(x.child).gmNotes, raw);
  assert.equal(x.savedNote(x.leaf).gmNotes, x.leaf.gmNotes);
  assert.equal(x.saved(x.a).gmNotes, x.a.note.gmNotes);
  assert.deepEqual(
    writes.map((c) => c.change.expectedRevision),
    [1, 2],
  );
  assert(writes.every((c) => c.change.note.id === x.child.id));
});

test('a delayed parent reread cannot replace the visible leaf draft during nested notebook return', async (t) => {
  const x = await nestedNotebook(t),
    held = deferred();
  x.el('note-thread-open').click();
  await tick();
  assert.equal(x.el('note-thread-heading').textContent, 'Notizmappe: Kindmappe');
  x.sourceAction(x.leaf.id, 'Notiz bearbeiten…');
  await tick();
  assert.equal(x.el('note-title').value, 'Blatt');
  let response;
  x.api.preparation = async (...args) => {
    response = await x.invoke('preparation', ...args);
    return held.promise;
  };
  x.el('note-thread-parent').click();
  await tick();
  assert.equal(response?.ok, true, 'the real return request reached its original parent reread');
  assert.equal(x.el('note-thread-editor').hidden, false);
  const raw = '  Blatt während Parent-Read\r\n[[Wörtlich]]  ';
  x.input(raw);
  const before = x.store.db.serialize();
  held.resolve(response);
  await tick();
  assert.equal(x.el('note-title').value, 'Blatt');
  assert.equal(x.el('note-gm').value, raw);
  assert.equal(x.el('note-thread-editor').hidden, false);
  assert.equal(x.el('note-thread-heading').textContent, 'Notizmappe: Kindmappe');
  assert.equal(x.savedNote(x.leaf).gmNotes, x.leaf.gmNotes);
  assert.equal(x.savedNote(x.child).gmNotes, x.child.gmNotes);
  assert(x.store.db.serialize().equals(before));
});

test('a delayed packet source opening cannot replace the new campaign draft or canonical notes', async (t) => {
  const x = fixture(t),
    w = await x.activate(x.a),
    held = deferred(),
    planId = randomUUID();
  let owner = { token: w.token, planId };
  x.api.sessionPacket = async () => ({
    ok: true,
    value: {
      planId,
      planName: 'Quellenabend',
      planRevision: 1,
      campaignName: 'A',
      basis: 'packet-fixture',
      party: [],
      warnings: [],
      visits: [
        {
          id: randomUUID(),
          title: 'Quellenbesuch',
          locationId: null,
          location: null,
          blocks: [
            {
              heading: 'Original A',
              text: x.a.note.gmNotes,
              kind: 'reference',
              action: { kind: 'reference', ref: { kind: 'note', id: x.a.note.id } },
            },
          ],
        },
      ],
    },
  });
  packetUi.initSessionPacket(
    (text, error) => x.messages.push({ text, error }),
    () => owner,
    () => x.ui.flushPreparation(),
  );
  assert.equal(await packetUi.openPreparationSessionPacket(), true);
  const action = [...x.el('session-packet-content').querySelectorAll('button')].find(
    (b) => b.textContent === 'Original bearbeiten…',
  );
  assert(action && !action.disabled);
  let response;
  x.api.preparation = async (...args) => {
    response = await x.invoke('preparation', ...args);
    return held.promise;
  };
  action.click();
  await tick();
  assert.equal(
    response?.ok,
    true,
    'the packet source started its original production preparation read',
  );
  assert.equal(x.el('packet-note-content').hidden, true);
  x.api.preparation = (...args) => x.invoke('preparation', ...args);
  packetUi.closeSessionPacket();
  const b = await x.activate(x.b);
  owner = { token: b.token, planId: randomUUID() };
  const raw = '  B nach Packet-Quellenwechsel\r\n[[Wörtlich]]  ';
  x.input(raw);
  assert.equal(x.el('session-packet-dialog').open, false);
  assert.equal(x.el('packet-note-content').contains(x.el('note-editor')), false);
  assert.equal(x.el('note-editor').hidden, false);
  assert.equal(x.el('note-gm').value, raw);
  const before = x.store.db.serialize(),
    messages = structuredClone(x.messages);
  held.resolve(response);
  await tick();
  assert.equal(x.el('note-title').value, 'B');
  assert.equal(x.el('note-gm').value, raw);
  assert.equal(x.el('packet-note-content').hidden, true);
  assert.deepEqual(x.messages, messages);
  assert.equal(x.saved(x.a).gmNotes, x.a.note.gmNotes);
  assert.equal(x.saved(x.b).gmNotes, x.b.note.gmNotes);
  assert(x.store.db.serialize().equals(before));
});

test('two production Preparation excerpt dialogs isolate their raw selection and destination search', async (t) => {
  const first = fixture(t),
    second = fixture(t),
    held = deferred();
  await first.activate(first.a);
  await second.activate(second.b);
  for (const x of [first, second]) {
    const area = x.el('note-gm');
    area.dispatchEvent(new x.window.Event('focus'));
    area.setSelectionRange(2, 3);
    x.el('note-excerpt').click();
  }
  await tick();
  assert.equal(first.el('note-excerpt-dialog').open, true);
  assert.equal(second.el('note-excerpt-dialog').open, true);
  assert.equal(first.el('note-excerpt-text').value, 'A');
  assert.equal(second.el('note-excerpt-text').value, 'B');
  first.api.keyNoteChoices = async () => held.promise;
  first.el('note-excerpt-title').value = 'First target';
  first.el('note-excerpt-title').dispatchEvent(new first.window.Event('input'));
  second.el('note-excerpt-title').value = 'Second target';
  second.el('note-excerpt-title').dispatchEvent(new second.window.Event('input'));
  await tick();
  const secondStatus = second.el('note-excerpt-choices-status').textContent;
  held.resolve({
    ok: true,
    value: {
      entries: [{ id: 'target', title: 'First target', kind: 'note', revision: 1 }],
      more: false,
    },
  });
  await tick();
  assert.match(first.el('note-excerpt-choices').textContent, /First target/);
  assert.equal(second.el('note-excerpt-choices').textContent, '');
  assert.equal(second.el('note-excerpt-choices-status').textContent, secondStatus);
  first.el('note-excerpt-cancel').click();
  assert.equal(first.el('note-excerpt-dialog').open, false);
  assert.equal(second.el('note-excerpt-dialog').open, true);
  second.el('note-excerpt-cancel').click();
});

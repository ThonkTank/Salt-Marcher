import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  entryPoints: {
    ui: 'src/app/atlas/dungeon-binder-ui.ts',
    store: 'src/app/storage/store.ts',
    drawing: 'src/app/atlas/drawing-model.ts',
  },
  outdir: '.build/binder-context',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const require = createRequire(import.meta.url),
  { DungeonBinder } = require('../../.build/binder-context/ui.cjs'),
  { CampaignStore } = require('../../.build/binder-context/store.cjs');
const { newElement } = require('../../.build/binder-context/drawing.cjs');
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function until(check) {
  for (let i = 0; i < 30; i++) {
    if (check()) return;
    await tick();
  }
  throw Error('condition not reached');
}
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'binder-context-')),
    store = new CampaignStore(path.join(root, 'store.sqlite')),
    rooms = ['Nordtor', 'Gewölbe'].map((name, i) => ({
      id: randomUUID(),
      scopeId: 'local',
      floorId: 'ground',
      number: String(i + 1),
      name,
      revision: 0,
      polygons: [
        {
          outer: [
            { x: i * 8, y: 0 },
            { x: i * 8 + 4, y: 0 },
            { x: i * 8 + 4, y: 4 },
            { x: i * 8, y: 4 },
          ],
          holes: [],
        },
      ],
      sections: [
        { id: randomUUID(), kind: 'markdown', markdown: '  Originaltext ' + name + '\r\n' },
      ],
    })),
    campaign = store.create('Binderprobe', rooms),
    w = store.activate(campaign.id),
    view = store.dungeon(w.token);
  const { document, window } = parseHTML(
      '<button id="dungeon-binder-open"></button><button id="dungeon-binder-live"></button>',
    ),
    prior = { document: globalThis.document, window: globalThis.window, Option: globalThis.Option };
  function Option(text, value) {
    const node = document.createElement('option');
    node.textContent = text;
    node.value = value;
    return node;
  }
  window.HTMLElement.prototype.focus = function () {};
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.HTMLSelectElement.prototype.add = function (option) {
    this.append(option);
  };
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    get() {
      return this._value ?? this.options[0]?.value ?? '';
    },
    set(value) {
      this._value = value;
    },
    configurable: true,
  });
  Object.assign(globalThis, { document, window, Option });
  let workspace = w;
  const calls = [],
    messages = [],
    reads = [];
  window.campaign = {
    dungeon: async (token) => {
      reads.push(token);
      return { ok: true, value: view };
    },
    treasure: async () => {
      calls.push(['treasure']);
      return { ok: true, value: { title: 'Schatz', items: [] } };
    },
  };
  let flush = async () => true,
    navigate = async (id, action) => calls.push([id, action]),
    edit = async () => false;
  const binder = new DungeonBinder(
    () => workspace,
    () => flush(),
    (s, error) => messages.push({ s, error }),
    (id, action) => navigate(id, action),
    (...args) => edit(...args),
  );
  const dialog = document.getElementById('dungeon-binder');
  dialog.showModal = () => dialog.setAttribute('open', '');
  dialog.close = () => dialog.removeAttribute('open');
  Object.defineProperty(dialog, 'open', {
    get() {
      return this.hasAttribute('open');
    },
  });
  const el = (id) => document.getElementById(id),
    open = () => el('dungeon-binder-open').onclick(),
    choose = (id) =>
      el('dungeon-binder-list')
        .querySelector('[data-room-id="' + id + '"]')
        .onclick(),
    mapButton = () =>
      [...el('dungeon-binder-document').querySelectorAll('button')].find(
        (b) => b.textContent === 'Auf der Karte öffnen',
      );
  t.after(() => {
    binder.reset();
    Object.assign(globalThis, prior);
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return {
    binder,
    store,
    campaign,
    view,
    rooms,
    w,
    el,
    open,
    choose,
    mapButton,
    calls,
    messages,
    reads,
    setFlush: (f) => (flush = f),
    setNavigate: (f) => (navigate = f),
    setEdit: (f) => (edit = f),
    setWorkspace: (v) => (workspace = v),
    loaded: () => !!el('dungeon-binder-list').firstChild,
  };
}
test('reset invalidates an open intent already waiting for the workspace flush', async (t) => {
  const x = fixture(t);
  let release;
  x.setFlush(() => new Promise((r) => (release = r)));
  x.open();
  await until(() => !!release);
  x.binder.reset();
  x.setFlush(async () => true);
  x.open();
  await until(x.loaded);
  x.choose(x.rooms[1].id);
  const text = x.el('dungeon-binder-document').textContent;
  release(true);
  await tick();
  await tick();
  assert.equal(x.reads.length, 1);
  assert.equal(x.el('dungeon-binder-document').textContent, text);
});
test('detached map action cannot navigate a reopened binder', async (t) => {
  const x = fixture(t);
  x.open();
  await until(x.loaded);
  x.choose(x.rooms[0].id);
  const old = x.mapButton();
  x.binder.reset();
  x.open();
  await until(x.loaded);
  x.choose(x.rooms[1].id);
  old.onclick();
  await tick();
  assert.deepEqual(x.calls, []);
  assert.equal(x.el('dungeon-binder').open, true);
});
test('detached room row cannot replace a newly selected document', async (t) => {
  const x = fixture(t);
  x.open();
  await until(x.loaded);
  const old = x.el('dungeon-binder-list').querySelector('[data-room-id="' + x.rooms[0].id + '"]');
  x.choose(x.rooms[1].id);
  const text = x.el('dungeon-binder-document').textContent;
  old.onclick();
  assert.equal(x.el('dungeon-binder-document').textContent, text);
});
test('map action from the previous read cannot navigate during refresh', async (t) => {
  const x = fixture(t);
  x.open();
  await until(x.loaded);
  const old = x.mapButton();
  let release;
  window.campaign.dungeon = () =>
    new Promise((r) => (release = () => r({ ok: true, value: x.view })));
  [...x.el('dungeon-binder').querySelectorAll('button')]
    .find((b) => b.textContent === 'Aktualisieren')
    .onclick();
  await until(() => !!release);
  old.onclick();
  await tick();
  assert.deepEqual(x.calls, []);
  release();
  await tick();
  assert.equal(x.el('dungeon-binder').open, true);
});
test('a detached feature toggle cannot read old loot in a reopened context', async (t) => {
  const x = fixture(t);
  x.view.drawing.elements.push({
    id: 'old-feature',
    kind: 'feature',
    feature: 'loot',
    roomId: x.rooms[0].id,
    archived: false,
    name: 'Alte Schatzbindung',
    notes: 'GM',
    content: { reference: { kind: 'treasure', id: 'old-treasure' }, publicText: '' },
  });
  x.open();
  await until(x.loaded);
  x.choose(x.rooms[0].id);
  const old = x.el('dungeon-binder-document').querySelector('[data-feature-id="old-feature"]');
  x.binder.reset();
  x.open();
  await until(x.loaded);
  x.choose(x.rooms[1].id);
  old.open = true;
  old.dispatchEvent(new window.Event('toggle'));
  await tick();
  assert.deepEqual(x.calls, []);
});
test('current room navigation remains usable', async (t) => {
  const x = fixture(t);
  x.open();
  await until(x.loaded);
  x.choose(x.rooms[1].id);
  x.mapButton().onclick();
  await tick();
  assert.deepEqual(x.calls, [[x.rooms[1].id, 'map']]);
  assert.equal(x.el('dungeon-binder').open, false);
});

test('navigation failure from a retired binder does not report into a newer dialog', async (t) => {
  const x = fixture(t);
  x.open();
  await until(x.loaded);
  let reject;
  x.setNavigate(() => new Promise((resolve, fail) => (reject = fail)));
  x.mapButton().onclick();
  await until(() => !!reject);
  x.open();
  await until(x.loaded);
  const status = x.el('dungeon-binder-status').textContent;
  reject(Error('Alte Kartennavigation'));
  await tick();
  assert.deepEqual(x.messages, []);
  assert.equal(x.el('dungeon-binder-status').textContent, status);
});

test('refresh clears old contents and filters cannot restore actions after a failed read', async (t) => {
  const x = fixture(t);
  x.open();
  await until(x.loaded);
  const old = x.mapButton();
  let release;
  window.campaign.dungeon = () => new Promise((r) => (release = r));
  [...x.el('dungeon-binder').querySelectorAll('button')]
    .find((b) => b.textContent === 'Aktualisieren')
    .onclick();
  await until(() => !!release);
  assert.equal(x.el('dungeon-binder-document').children.length, 0);
  assert.equal(x.el('dungeon-binder-list').children.length, 0);
  x.el('dungeon-binder-filter').value = 'all';
  x.el('dungeon-binder-filter').onchange();
  old.onclick();
  await tick();
  assert.deepEqual(x.calls, []);
  release({ ok: false, error: 'Lesen unterbrochen' });
  await tick();
  await tick();
  assert.equal(x.el('dungeon-binder').open, true);
  assert.equal(x.el('dungeon-binder-document').children.length, 0);
  assert.equal(x.el('dungeon-binder-list').children.length, 0);
  assert.match(x.el('dungeon-binder-status').textContent, /Lesen unterbrochen/);
  window.campaign.dungeon = async () => ({ ok: true, value: x.view });
  [...x.el('dungeon-binder').querySelectorAll('button')]
    .find((b) => b.textContent === 'Aktualisieren')
    .onclick();
  await until(x.loaded);
  x.choose(x.rooms[1].id);
  x.mapButton().onclick();
  await tick();
  assert.deepEqual(x.calls, [[x.rooms[1].id, 'map']]);
});

test('passage editing retains the Binder and returns through a fresh read with the same query', async (t) => {
  const x = fixture(t);
  let returned, target;
  x.setEdit(async (id, passage, current, back) => {
    target = passage;
    returned = back;
    assert(current());
    return true;
  });
  x.open();
  await until(x.loaded);
  x.el('dungeon-binder-search').value = 'Originaltext';
  x.choose(x.rooms[0].id);
  x.el('key-document-search').value = 'Originaltext Nordtor';
  x.el('key-document-search').oninput();
  x.el('key-document-edit').onclick();
  await until(() => !!returned);
  assert.equal(x.el('dungeon-binder').open, true);
  assert.equal(target.kind, 'legacy');
  assert.equal(target.sectionId, x.rooms[0].sections[0].id);
  x.view.rooms.find((r) => r.id === x.rooms[0].id).sections[0].markdown += ' Aktualisiert';
  returned();
  await until(() => x.el('dungeon-binder-document').textContent.includes('Aktualisiert'));
  assert.equal(x.el('dungeon-binder-search').value, 'Originaltext');
  assert.equal(x.el('key-document-search').value, 'Originaltext Nordtor');
});
test('a late return callback cannot replace a newer room or campaign', async (t) => {
  const x = fixture(t);
  let returned;
  x.setEdit(async (id, target, current, back) => {
    returned = back;
    return true;
  });
  x.open();
  await until(x.loaded);
  x.el('dungeon-binder-search').value = 'Originaltext';
  x.choose(x.rooms[0].id);
  x.el('key-document-edit').onclick();
  await until(() => !!returned);
  x.choose(x.rooms[1].id);
  const reads = x.reads.length,
    text = x.el('dungeon-binder-document').textContent;
  returned();
  await tick();
  assert.equal(x.reads.length, reads);
  assert.equal(x.el('dungeon-binder-document').textContent, text);
  x.setWorkspace({ ...x.w, token: 'new-owner' });
  returned();
  await tick();
  assert.equal(x.reads.length, reads);
});
test('a detached passage edit cannot reopen the editor after the reader is replaced', async (t) => {
  const x = fixture(t);
  let calls = 0;
  x.setEdit(async () => {
    calls++;
    return true;
  });
  x.open();
  await until(x.loaded);
  x.el('dungeon-binder-search').value = 'Originaltext';
  x.choose(x.rooms[0].id);
  const old = x.el('key-document-edit');
  x.choose(x.rooms[0].id);
  old.onclick();
  await tick();
  assert.equal(calls, 0);
});

function leveledRooms(x) {
  const command = (action) =>
    x.store.executeDrawing({
      commandId: randomUUID(),
      campaignId: x.campaign.id,
      token: x.w.token,
      action,
    });
  const levels = ['Oberburg', 'Katakomben'].map((name, i) => ({
    id: randomUUID(),
    revision: 0,
    scopeId: 'local',
    kind: 'level',
    name,
    levelId: null,
    groupId: null,
    zSteps: i ? [-2, -1] : [0, 1],
    attributes: {},
    blocks: [],
    tags: [],
    secret: false,
    status: '',
    references: [],
  }));
  for (const [i, level] of levels.entries()) {
    command({ kind: 'key-content', content: level, expectedRevision: null });
    command({
      kind: 'key-batch',
      rooms: [{ id: x.rooms[i].id, expectedRevision: 0, keyRevision: null }],
      patch: { name: { mode: 'replace', text: 'Wachraum' }, number: '1', levelId: level.id },
    });
  }
  Object.assign(x.view, x.store.dungeon(x.w.token));
  return { levels, command };
}
test('the GM binder distinguishes identical room numbers and names by conceptual Level on one physical floor', async (t) => {
  const x = fixture(t);
  leveledRooms(x);
  const before = x.store.db.serialize();
  x.open();
  await until(x.loaded);
  const rows = x.el('dungeon-binder-list');
  assert.match(rows.textContent, /Oberburg · 1\. Wachraum/);
  assert.match(rows.textContent, /Katakomben · 1\. Wachraum/);
  x.choose(x.rooms[1].id);
  assert.equal(
    x.el('dungeon-binder-document').querySelector('h3').textContent,
    'Katakomben · 1. Wachraum',
  );
  x.mapButton().onclick();
  await tick();
  assert.deepEqual(x.calls, [[x.rooms[1].id, 'map']]);
  assert.ok(x.store.db.serialize().equals(before));
});
test('binder search resolves a conceptual Level and complete Level-number reference and follows a canonical rename', async (t) => {
  const x = fixture(t),
    { levels, command } = leveledRooms(x);
  x.open();
  await until(x.loaded);
  const search = async (text) => {
    x.el('dungeon-binder-search').value = text;
    x.el('dungeon-binder-search').oninput();
    await new Promise((r) => setTimeout(r, 180));
    return [...x.el('dungeon-binder-list').querySelectorAll('[data-room-id]')].map(
      (n) => n.dataset.roomId,
    );
  };
  assert.deepEqual(await search('katakomben'), [x.rooms[1].id]);
  assert.deepEqual(await search('Oberburg · 1'), [x.rooms[0].id]);
  command({
    kind: 'key-content',
    content: { ...levels[1], name: 'Tiefes Gewölbe' },
    expectedRevision: 0,
  });
  Object.assign(x.view, x.store.dungeon(x.w.token));
  x.binder.reset();
  x.open();
  await until(x.loaded);
  assert.deepEqual(await search('katakomben'), []);
  assert.deepEqual(await search('Tiefes Gewölbe · 1'), [x.rooms[1].id]);
});
test('rooms without a conceptual Level keep their existing binder label and searchable number', async (t) => {
  const x = fixture(t);
  x.open();
  await until(x.loaded);
  x.choose(x.rooms[0].id);
  assert.equal(x.el('dungeon-binder-document').querySelector('h3').textContent, '1. Nordtor');
  x.el('dungeon-binder-search').value = '1. Nordtor';
  x.el('dungeon-binder-search').oninput();
  await new Promise((r) => setTimeout(r, 180));
  assert.deepEqual(
    [...x.el('dungeon-binder-list').querySelectorAll('[data-room-id]')].map(
      (n) => n.dataset.roomId,
    ),
    [x.rooms[0].id],
  );
});

test('a cross-Level exit names its target and opens the matching stable room identity', async (t) => {
  const x = fixture(t),
    { command } = leveledRooms(x),
    door = newElement('door', 'local', 'ground', x.rooms[0].id, [{ x: 4, y: 2 }]);
  door.targetRoomId = x.rooms[1].id;
  door.name = 'Treppe zur Unterwelt';
  command({ kind: 'element', element: door, expectedRevision: null });
  Object.assign(x.view, x.store.dungeon(x.w.token));
  const before = x.store.db.serialize();
  x.open();
  await until(x.loaded);
  x.choose(x.rooms[0].id);
  const next = [...x.el('dungeon-binder-document').querySelectorAll('button')].find(
    (b) => b.textContent === 'Weiterlesen: Katakomben · 1. Wachraum',
  );
  assert.ok(next);
  next.onclick();
  assert.equal(
    x.el('dungeon-binder-document').querySelector('h3').textContent,
    'Katakomben · 1. Wachraum',
  );
  assert.equal(
    x.el('dungeon-binder-list').querySelector('[aria-pressed="true"]').dataset.roomId,
    x.rooms[1].id,
  );
  assert.ok(x.store.db.serialize().equals(before));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from './helpers/dom.mjs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
buildSync({
  entryPoints: ['src/app/note-thread-ui.ts'],
  outfile: '.build/note-thread-dom-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { NoteThreadDialog } = createRequire(import.meta.url)('../.build/note-thread-dom-test.cjs');
const tick = () => new Promise((r) => setImmediate(r)),
  until = async (f) => {
    const end = Date.now() + 2000;
    while (!f() && Date.now() < end) await tick();
    assert(f(), 'expected note-thread state');
  },
  deferred = () => {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    return { resolve, promise };
  };
const note = (id, kind = 'npc') => ({
  version: 1,
  id,
  revision: 2,
  title: id,
  kind,
  readAloud: '  Vorlesen\r\n',
  gmNotes: 'GM ' + id,
  relations: [],
  creatureId: null,
  deleted: false,
});
const entry = (id, status = 'untracked', unavailable = false) => ({
    id,
    title: id,
    kind: status === 'untracked' ? 'npc' : 'rumor',
    revision: 2,
    labels: ['Quelle'],
    status,
    unavailable,
    preview: 'Auszug ' + id,
    stamp: id.padEnd(64, 'a').slice(0, 64),
  }),
  ok = (value) => ({ ok: true, value });
function fixture(t) {
  const { window, document } = parseHTML(
      '<html><body><section id=home><div id=preparation-problems></div><div id=note-editor><button id=note-back></button><input id=note-title><textarea id=note-gm></textarea></div><button id=preparation-apply></button><button id=preparation-reconcile></button><button id=preparation-refresh></button></section></body></html>',
    ),
    prior = globalThis.document;
  globalThis.document = document;
  const values = new WeakMap();
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return values.get(this) ?? this.querySelector('option')?.value ?? '';
    },
    set(v) {
      values.set(this, v);
    },
  });
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
  };
  window.HTMLElement.prototype.focus = () => {};
  const root = {
      ...note('Mappe', 'quest'),
      relations: ['Nera', 'Offene Spur', 'Erledigt'].map((targetId) => ({
        targetId,
        label: 'Quelle',
      })),
    },
    all = [entry('Nera'), entry('Offene Spur', 'open'), entry('Erledigt', 'closed')],
    calls = [],
    adds = [],
    used = [],
    rooms = [],
    messages = [];
  let valid = true,
    blocked = false,
    read = async (_t, _id, _offset, active) =>
      ok({
        root,
        entries: active ? all.filter((e) => e.status !== 'closed') : all,
        total: all.length,
        next: null,
      }),
    detail = async (_t, r) => ok({ ref: r, revision: 2, note: note(r.id) }),
    search = async () => ok({ entries: [], next: null }),
    check = async () => ok(undefined),
    use = async (target, selection) => {
      used.push({ target, selection });
      return true;
    },
    add = async (r, ids) => {
      adds.push({ root: r, ids });
      return false;
    };
  let detach = async () => false;
  let edit = async (id, current) => {
      el('note-title').value = id;
      el('note-gm').value = 'Original ' + id;
      return current();
    },
    back = async (current) => {
      el('note-title').value = 'Mappe';
      return current();
    };
  const owner = {
    token: 'A',
    id: root.id,
    destination: { planId: 'P', visitId: 'V' },
    plans: [{ id: 'P', name: 'Abend', scenes: [{ id: 'V', title: 'Ermitteln' }] }],
    current: () => valid,
    blocked: () => blocked,
    edit: (...a) => edit(...a),
    returnToRoot: (...a) => back(...a),
    room: async (id, current, restore) => {
      rooms.push({ id, current, restore });
      return true;
    },
    add: (...a) => add(...a),
    detach: (...a) => detach(...a),
    use: (...a) => use(...a),
  };
  let prepare = async () => owner;
  const ui = new NoteThreadDialog({
    prepare: () => prepare(),
    api: {
      noteThread: (...a) => {
        calls.push(a);
        return read(...a);
      },
      checkNoteThread: (...a) => check(...a),
      deskContent: (...a) => detail(...a),
      searchDesk: (...a) => search(...a),
      noteRoomUses: async () =>
        ok({
          entries: [{ id: 'Archiv', title: 'Archiv', number: '2', unavailable: false }],
          next: null,
        }),
    },
    tell: (...a) => messages.push(a),
  });
  const el = (id) => document.getElementById(id),
    click = (name) =>
      [...el('note-thread-dialog').querySelectorAll('button')]
        .find((b) => b.textContent === name)
        .onclick(),
    select = (id, value) => {
      el(id).value = value;
      el(id).onchange();
    };
  t.after(() => {
    ui.reset();
    globalThis.document = prior;
  });
  return {
    ui,
    el,
    click,
    select,
    root,
    all,
    calls,
    adds,
    used,
    rooms,
    messages,
    owner,
    setPrepare: (f) => (prepare = f),
    setDetach: (f) => (detach = f),
    setEdit: (f) => (edit = f),
    setBack: (f) => (back = f),
    setRead: (f) => (read = f),
    setDetail: (f) => (detail = f),
    setSearch: (f) => (search = f),
    setCheck: (f) => (check = f),
    setUse: (f) => (use = f),
    setAdd: (f) => (add = f),
    retire: () => (valid = false),
    block: () => (blocked = true),
  };
}
test('one map reads original sources and room context with confirmed status, selecting only open and untracked sources', async (t) => {
  const x = fixture(t);
  await x.ui.open();
  await until(() => x.el('note-thread-sources').textContent.includes('Raumhinweise: Archiv'));
  assert.match(x.el('note-thread-sources').textContent, /GM Nera/);
  assert.match(x.el('note-thread-sources').textContent, /Gerücht · Offen/);
  assert.doesNotMatch(x.el('note-thread-sources').textContent, /Erledigt/);
  assert.match(x.el('note-thread-choice').textContent, /^3 Originalnotizen/);
  x.click('Raum öffnen: Archiv');
  assert.equal(x.rooms[0].id, 'Archiv');
  assert(x.rooms[0].current());
  x.ui.reset();
  assert.equal(x.rooms[0].current(), false);
});
test('closed, unknown and unavailable sources remain explicit and unchecked in the full view', async (t) => {
  const x = fixture(t);
  x.all.push(entry('Unbekannt', 'unknown'), entry('Fehlt', 'untracked', true));
  await x.ui.open();
  x.el('note-thread-active').checked = false;
  x.el('note-thread-active').onchange();
  await until(() => x.el('note-thread-sources').querySelectorAll('article').length === 5);
  const cards = [...x.el('note-thread-sources').querySelectorAll('article')];
  for (const id of ['Erledigt', 'Unbekannt', 'Fehlt'])
    assert.equal(cards.find((c) => c.dataset.noteId === id).querySelector('input').checked, false);
  assert.equal(
    cards.find((c) => c.dataset.noteId === 'Fehlt').querySelector('input').disabled,
    true,
  );
  assert.match(x.el('note-thread-sources').textContent, /Status nicht lesbar/);
});
test('selection is snapshotted before validation and existing destination has no copied source prose', async (t) => {
  const x = fixture(t),
    wait = deferred();
  x.setCheck(() => wait.promise);
  await x.ui.open();
  x.el('note-thread-use').onclick();
  await tick();
  assert.equal(x.el('note-thread-active').disabled, true);
  x.el('note-thread-include-root').checked = false;
  wait.resolve(ok());
  await until(() => x.used.length === 1);
  const { selection, target } = x.used[0];
  assert.equal(selection.includeRoot, true);
  assert.deepEqual(
    selection.entries.map((e) => e.id),
    ['Nera', 'Offene Spur'],
  );
  assert.equal(target.planId, 'P');
  assert.equal(target.visitId, 'V');
  assert.equal('gmNotes' in selection, false);
  await until(() => !x.el('note-thread-dialog').open);
});
test('new plan and visit need explicit names, retain them after failed save and never retry automatically', async (t) => {
  const x = fixture(t);
  x.setUse(async (target, selection) => {
    x.used.push({ target, selection });
    return false;
  });
  await x.ui.open();
  x.select('note-thread-plan', '');
  x.el('note-thread-plan-name').value = '';
  x.el('note-thread-use').onclick();
  await tick();
  assert.equal(x.used.length, 0);
  x.el('note-thread-plan-name').value = 'Fortsetzung';
  x.el('note-thread-visit-title').value = 'Nachtwache befragen';
  x.el('note-thread-use').onclick();
  await until(() => x.used.length === 1 && !x.el('note-thread-use').disabled);
  assert.deepEqual(x.used[0].target, {
    planId: null,
    visitId: null,
    planName: 'Fortsetzung',
    title: 'Nachtwache befragen',
  });
  assert.match(x.el('note-thread-status').textContent, /keine automatische Wiederholung/);
  assert.equal(x.el('note-thread-plan-name').value, 'Fortsetzung');
  await tick();
  assert.equal(x.used.length, 1);
});
test('changed-source validation failure preserves selection and never calls the writer', async (t) => {
  const x = fixture(t);
  x.setCheck(async () => ({ ok: false, error: 'Quelle inzwischen geändert' }));
  await x.ui.open();
  x.el('note-thread-use').onclick();
  await until(() => x.el('note-thread-status').textContent.includes('inzwischen'));
  assert.equal(x.used.length, 0);
  assert.equal(x.el('note-thread-dialog').open, true);
  assert.match(x.el('note-thread-choice').textContent, /^3/);
});
test('a delayed validation cannot write after reset and reopening the same root', async (t) => {
  const x = fixture(t),
    wait = deferred();
  x.setCheck(() => wait.promise);
  await x.ui.open();
  x.el('note-thread-use').onclick();
  await tick();
  x.ui.reset();
  await x.ui.open();
  wait.resolve(ok());
  await tick();
  assert.equal(x.used.length, 0);
  assert.equal(x.el('note-thread-dialog').open, true);
});
test('a retired owner cannot write even if a disabled control is retained', async (t) => {
  const x = fixture(t);
  await x.ui.open();
  x.retire();
  x.el('note-thread-use').onclick();
  await tick();
  assert.equal(x.used.length, 0);
  x.click('Schließen');
  assert.equal(x.el('note-thread-dialog').open, false);
});
test('blocked editor and unknown commit stop both additions and preparation', async (t) => {
  const x = fixture(t);
  await x.ui.open();
  x.block();
  x.el('note-thread-use').onclick();
  await tick();
  assert.equal(x.used.length, 0);
  assert.equal(x.adds.length, 0);
});
test('old source text cannot overwrite a refreshed root and literal source text never creates markup', async (t) => {
  const x = fixture(t),
    wait = deferred();
  x.setDetail(() => wait.promise);
  await x.ui.open();
  x.setDetail(async (_t, r) =>
    ok({ ref: r, revision: 2, note: { ...note(r.id), gmNotes: '<img src=x onerror=bad()> Neu' } }),
  );
  x.click('Aktualisieren');
  await until(() => x.el('note-thread-sources').textContent.includes('onerror'));
  wait.resolve(
    ok({
      ref: { kind: 'note', id: 'Nera' },
      revision: 2,
      note: { ...note('Nera'), gmNotes: 'VERALTET' },
    }),
  );
  await tick();
  assert.doesNotMatch(x.el('note-thread-sources').textContent, /VERALTET/);
  assert.equal(x.el('note-thread-sources').querySelector('img'), null);
});
test('wrong identity or mismatched note revision blocks preparation without erasing readable metadata', async (t) => {
  const x = fixture(t);
  x.setDetail(async (_t, r) => ok({ ref: r, revision: 2, note: { ...note(r.id), revision: 3 } }));
  await x.ui.open();
  await until(() => x.el('note-thread-sources').textContent.includes('Quelle geändert'));
  assert.equal(x.el('note-thread-use').disabled, true);
  assert.match(x.el('note-thread-sources').textContent, /Nera/);
});
test('failed additional page preserves old sources and explicit refresh recovers', async (t) => {
  const x = fixture(t);
  x.setRead(async (_t, _id, offset) =>
    offset
      ? { ok: false, error: 'Seite offline' }
      : ok({ root: x.root, entries: [x.all[0]], total: 3, next: 40 }),
  );
  await x.ui.open();
  x.el('note-thread-more').onclick();
  await until(() => x.el('note-thread-status').textContent === 'Seite offline');
  assert.match(x.el('note-thread-sources').textContent, /Nera/);
  assert.equal(x.el('note-thread-use').disabled, true);
  x.setRead(async () => ok({ root: x.root, entries: x.all, total: 3, next: null }));
  x.click('Aktualisieren');
  await until(() => !x.el('note-thread-use').disabled);
  assert.equal(x.el('note-thread-sources').querySelectorAll('article').length, 3);
});
test('returning from a later source restores loaded pages, reviewed selection and the existing destination', async (t) => {
  const x = fixture(t),
    later = entry('Späte Spur', 'open');
  x.all.push(later);
  x.root.relations = [...x.all.slice(0, 2), later].map((e) => ({
    targetId: e.id,
    label: 'Quelle',
  }));
  x.setRead(async (_t, _id, offset) =>
    ok({
      root: x.root,
      entries: offset ? [later] : x.all.slice(0, 2),
      total: 3,
      next: offset ? null : 2,
    }),
  );
  await x.ui.open();
  x.el('note-thread-more').onclick();
  await until(() => x.el('note-thread-sources').querySelectorAll('article').length === 3);
  const source = () =>
    [...x.el('note-thread-sources').querySelectorAll('article')].find(
      (c) => c.dataset.noteId === later.id,
    );
  const box = source().querySelector('input');
  box.checked = true;
  box.onchange();
  [...source().querySelectorAll('button')]
    .find((b) => b.textContent === 'Notiz bearbeiten…')
    .onclick();
  await until(() => !x.el('note-thread-return').disabled);
  x.setBack(async (current) => {
    later.stamp = 'reviewed'.padEnd(64, 'b');
    return current();
  });
  x.el('note-thread-return').onclick();
  await until(() => x.el('note-thread-editor').hidden && !x.el('note-thread-use').disabled);
  assert(source(), 'the reviewed source must remain visible after returning');
  assert.equal(source().querySelector('input').checked, true);
  assert.deepEqual(
    x.calls.map((c) => c[2]),
    [0, 2, 0, 2],
  );
  assert.equal(x.el('note-thread-plan').value, 'P');
  assert.equal(x.el('note-thread-visit').value, 'V');
  x.el('note-thread-use').onclick();
  await until(() => x.used.length === 1);
  assert.deepEqual(
    x.used[0].selection.entries.map((e) => e.id),
    ['Nera', 'Offene Spur', later.id],
  );
  assert.equal(x.used[0].selection.entries.at(-1).stamp, later.stamp);
});
test('a pending restored page blocks handoff and cannot populate a newly opened map', async (t) => {
  const x = fixture(t),
    later = entry('Späte Spur', 'open'),
    wait = deferred();
  let restoring = false;
  x.root.relations = [...[x.all[0]], later].map((e) => ({ targetId: e.id, label: 'Quelle' }));
  x.setRead(async (_t, _id, offset) =>
    offset
      ? restoring
        ? wait.promise
        : ok({ root: x.root, entries: [later], total: 2, next: null })
      : ok({ root: x.root, entries: [x.all[0]], total: 2, next: 1 }),
  );
  await x.ui.open();
  x.el('note-thread-more').onclick();
  await until(() => x.el('note-thread-sources').querySelectorAll('article').length === 2);
  x.click('Notiz bearbeiten…');
  await until(() => !x.el('note-thread-return').disabled);
  restoring = true;
  x.el('note-thread-return').onclick();
  await until(() => x.calls.length === 4);
  assert.equal(x.el('note-thread-use').disabled, true);
  let checks = 0;
  x.setCheck(async () => {
    checks++;
    return ok();
  });
  x.el('note-thread-use').onclick();
  await tick();
  assert.equal(checks, 0);
  assert.equal(x.used.length, 0);
  x.ui.reset();
  x.setRead(async () => ok({ root: x.root, entries: [x.all[0]], total: 1, next: null }));
  await x.ui.open();
  wait.resolve(ok({ root: x.root, entries: [later], total: 2, next: null }));
  await tick();
  await tick();
  assert.equal(x.el('note-thread-sources').querySelectorAll('article').length, 1);
  assert.doesNotMatch(x.el('note-thread-sources').textContent, /Späte Spur/);
  assert.equal(x.el('note-thread-use').disabled, false);
  assert.equal(x.used.length, 0);
});
test('a root revision change between pages cannot silently combine two different collections', async (t) => {
  const x = fixture(t);
  x.setRead(async (_t, _id, offset) =>
    ok({
      root: { ...x.root, revision: offset ? 3 : 2 },
      entries: [x.all[offset ? 1 : 0]],
      total: 3,
      next: offset ? null : 40,
    }),
  );
  await x.ui.open();
  x.el('note-thread-more').onclick();
  await until(() => x.el('note-thread-status').textContent.includes('Übersichtsnotiz geändert'));
  assert.equal(x.el('note-thread-use').disabled, true);
  assert.equal(x.el('note-thread-sources').querySelectorAll('article').length, 1);
});
test('search excludes existing members, keeps unavailable choices disabled, and adds selected identities in one ordinary relation update', async (t) => {
  const x = fixture(t);
  x.setSearch(async () =>
    ok({
      entries: [
        { ref: { kind: 'note', id: 'Nera' }, title: 'Nera' },
        { ref: { kind: 'note', id: 'Neu' }, title: 'Neu', label: 'NSC' },
        { ref: { kind: 'note', id: 'Fehlt' }, title: 'Fehlt', unavailable: true },
      ],
      next: null,
    }),
  );
  await x.ui.open();
  x.el('note-thread-find').onclick();
  await until(() => x.el('note-thread-candidates').querySelectorAll('input').length === 2);
  const boxes = x.el('note-thread-candidates').querySelectorAll('input');
  assert.equal(boxes[1].disabled, true);
  boxes[0].checked = true;
  boxes[0].onchange();
  assert.equal(boxes[1].disabled, true);
  x.el('note-thread-add').onclick();
  await until(() => x.adds.length === 1 && !x.el('note-thread-add').disabled);
  assert.deepEqual(x.adds[0].ids, ['Neu']);
  assert.equal(x.adds[0].root.id, 'Mappe');
  assert.equal(x.el('note-thread-dialog').open, true);
});
test('older search response and removed source control cannot act on a reopened collection', async (t) => {
  const x = fixture(t),
    wait = deferred();
  await x.ui.open();
  const old = x.el('note-thread-sources').querySelector('input');
  x.setSearch(() => wait.promise);
  x.el('note-thread-find').onclick();
  x.ui.reset();
  await x.ui.open();
  wait.resolve(
    ok({ entries: [{ ref: { kind: 'note', id: 'STALE' }, title: 'STALE' }], next: null }),
  );
  await tick();
  old.checked = false;
  old.onchange();
  assert.doesNotMatch(x.el('note-thread-candidates').textContent, /STALE/);
  assert.match(x.el('note-thread-choice').textContent, /^3/);
  assert.equal(x.adds.length, 0);
});
test('filtering and refresh retain deliberate source choices and custom destination names; changed sources need a fresh choice', async (t) => {
  const x = fixture(t);
  await x.ui.open();
  const box = x.el('note-thread-sources').querySelector('input');
  box.checked = false;
  box.onchange();
  x.select('note-thread-plan', '');
  x.el('note-thread-plan-name').value = 'Mein nächster Abend';
  x.el('note-thread-visit-title').value = 'Meine offene Frage';
  x.el('note-thread-active').checked = false;
  x.el('note-thread-active').onchange();
  await until(() => x.el('note-thread-sources').querySelectorAll('article').length === 3);
  assert.equal(x.el('note-thread-sources').querySelector('input').checked, false);
  assert.equal(x.el('note-thread-plan-name').value, 'Mein nächster Abend');
  assert.equal(x.el('note-thread-visit-title').value, 'Meine offene Frage');
  const open = x.all[1];
  open.stamp = 'changed'.padEnd(64, 'a');
  x.click('Aktualisieren');
  await until(() => !x.el('note-thread-use').disabled);
  assert.equal(x.el('note-thread-sources').querySelectorAll('input')[1].checked, false);
  assert.equal(x.el('note-thread-plan-name').value, 'Mein nächster Abend');
});

test('editing the overview refreshes text-only membership before collecting further sources', async (t) => {
  const x = fixture(t);
  await x.ui.open();
  x.setBack(async (current) => {
    x.root.gmNotes = '[Neu](dungeon-ref:note/Neu)\r\n`[Beispiel](dungeon-ref:note/Beispiel)`';
    x.root.revision++;
    return current();
  });
  x.click('Übersichtsnotiz bearbeiten…');
  await until(() => !x.el('note-thread-return').disabled);
  x.el('note-thread-return').onclick();
  await until(() => x.el('note-thread-editor').hidden && !x.el('note-thread-use').disabled);
  x.setSearch(async () =>
    ok({ entries: ['Neu', 'Beispiel'].map((id) => ({ ref: { kind: 'note', id }, title: id })) }),
  );
  x.el('note-thread-find').onclick();
  await until(() => x.el('note-thread-candidates').querySelector('input'));
  assert.deepEqual(
    [...x.el('note-thread-candidates').querySelectorAll('input')].map((e) => e.value),
    ['Beispiel'],
  );
});

test('explicit reselection retains attachment order while the next read restores source order', async (t) => {
  const x = fixture(t);
  x.setUse(async (target, selection) => {
    x.used.push({ target, selection });
    return false;
  });
  await x.ui.open();
  const box = x.el('note-thread-sources').querySelector('input');
  box.checked = false;
  box.onchange();
  box.checked = true;
  box.onchange();
  x.el('note-thread-use').onclick();
  await until(() => x.used.length === 1 && !x.el('note-thread-use').disabled);
  assert.deepEqual(
    x.used[0].selection.entries.map((e) => e.id),
    ['Offene Spur', 'Nera'],
  );
  x.click('Aktualisieren');
  await until(() => !x.el('note-thread-use').disabled);
  x.el('note-thread-use').onclick();
  await until(() => x.used.length === 2);
  assert.deepEqual(
    x.used[1].selection.entries.map((e) => e.id),
    ['Nera', 'Offene Spur'],
  );
});

test('source editing mounts the identical author controls and returns with choices and destination names intact', async (t) => {
  const x = fixture(t);
  await x.ui.open();
  const editor = x.el('note-editor'),
    field = x.el('note-gm');
  x.select('note-thread-plan', '');
  x.el('note-thread-plan-name').value = 'Meine Fortsetzung';
  x.el('note-thread-visit-title').value = 'Meine Frage';
  field.disabled = true;
  x.click('Notiz bearbeiten…');
  await until(() => !x.el('note-thread-return').disabled);
  assert(x.el('note-thread-editor').contains(editor));
  assert.equal(x.el('note-gm'), field);
  assert.equal(field.disabled, true);
  assert.equal(x.el('note-back').hidden, true);
  assert(x.ui.ownsNote('Nera'));
  assert(x.ui.ownsNote('Mappe'));
  x.setBack(async (current) => {
    x.all[0].stamp = 'fresh'.padEnd(64, 'a');
    return current();
  });
  x.el('note-thread-return').onclick();
  await until(() => x.el('note-thread-editor').hidden);
  assert(x.el('home').contains(editor));
  assert.equal(x.el('note-back').hidden, false);
  assert.equal(x.el('note-thread-plan-name').value, 'Meine Fortsetzung');
  assert.equal(x.el('note-thread-visit-title').value, 'Meine Frage');
  assert.equal(x.el('note-thread-sources').querySelector('input').checked, true);
  assert.equal(x.el('note-title').ownerDocument.querySelectorAll('#note-editor').length, 1);
});
test('unconfirmed or composing source input keeps the actual editor available on return and close', async (t) => {
  const x = fixture(t);
  await x.ui.open();
  x.click('Notiz bearbeiten…');
  await until(() => !x.el('note-thread-return').disabled);
  x.setBack(async () => false);
  x.el('note-thread-return').onclick();
  await until(() => !x.el('note-thread-return').disabled);
  assert.equal(x.el('note-thread-editor').hidden, false);
  assert.match(x.el('note-thread-editor-status').textContent, /Eingabe noch nicht übernommen/);
  x.click('Schließen');
  await until(() => !x.el('note-thread-return').disabled);
  assert.equal(x.el('note-thread-dialog').open, true);
  assert(x.el('note-thread-editor').contains(x.el('note-editor')));
});
test('late editor opening cannot replace or focus a reset and reopened map', async (t) => {
  const x = fixture(t),
    wait = deferred();
  x.setEdit(() => wait.promise);
  await x.ui.open();
  x.click('Notiz bearbeiten…');
  await tick();
  x.ui.reset();
  await x.ui.open();
  wait.resolve(true);
  await tick();
  assert.equal(x.el('note-thread-editor').hidden, true);
  assert(x.el('home').contains(x.el('note-editor')));
  assert.equal(x.ui.editorId, null);
});
test('late editor return cannot close or redraw a reopened map', async (t) => {
  const x = fixture(t),
    wait = deferred();
  await x.ui.open();
  x.click('Notiz bearbeiten…');
  await until(() => !x.el('note-thread-return').disabled);
  x.setBack(() => wait.promise);
  x.el('note-thread-return').onclick();
  await tick();
  x.ui.reset();
  await x.ui.open();
  wait.resolve(true);
  await tick();
  assert.equal(x.el('note-thread-dialog').open, true);
  assert.equal(x.el('note-thread-editor').hidden, true);
  assert.equal(x.ui.rootId, 'Mappe');
});
test('closing an edited source flushes through its owner and restores the one editor', async (t) => {
  const x = fixture(t);
  await x.ui.open();
  x.click('Notiz bearbeiten…');
  await until(() => !x.el('note-thread-return').disabled);
  let returns = 0;
  x.setBack(async (current) => {
    returns++;
    return current();
  });
  x.click('Schließen');
  await until(() => !x.el('note-thread-dialog').open);
  assert.equal(returns, 1);
  assert(x.el('home').contains(x.el('note-editor')));
});

test('source removal previews both text fields and relationships, then retains other choices and destination names', async (t) => {
  const x = fixture(t),
    calls = [];
  x.root.relations.push({ targetId: 'Nera', label: 'kennt' });
  x.root.readAloud = '[Nera](dungeon-ref:note/Nera)';
  x.root.gmNotes = 'Vor [Nera](dungeon-ref:note/Nera).';
  await x.ui.open();
  x.select('note-thread-plan', '');
  x.el('note-thread-plan-name').value = 'Mein Abend';
  x.el('note-thread-visit-title').value = 'Meine Spur';
  const box = [...x.el('note-thread-sources').querySelectorAll('input')].find(
    (e) => e.value === 'Offene Spur',
  );
  box.checked = false;
  box.onchange();
  const card = x.el('note-thread-sources').querySelector('[data-note-id="Nera"]');
  assert.match(card.textContent, /2 Beziehungen entfernen: Quelle · kennt/);
  assert.match(card.textContent, /1 Textverweis in „Zum Vorlesen“/);
  assert.match(card.textContent, /1 Textverweis in „GM-Notizen“/);
  x.setDetach(async (root, id, current) => {
    calls.push({ root, id, valid: current() });
    x.setRead(async () =>
      ok({
        root: {
          ...x.root,
          revision: 3,
          readAloud: 'Nera',
          gmNotes: 'Vor Nera.',
          relations: x.root.relations.filter((r) => r.targetId !== id),
        },
        entries: [x.all[1]],
        total: 2,
        next: null,
      }),
    );
    return true;
  });
  [...card.querySelectorAll('button')]
    .find((b) => b.textContent === 'Verknüpfungen hier lösen')
    .onclick();
  await until(
    () =>
      !x.el('note-thread-sources').querySelector('[data-note-id="Nera"]') &&
      x.el('note-thread-editor').hidden,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].root.revision, 2);
  assert.equal(calls[0].id, 'Nera');
  assert.equal(calls[0].valid, true);
  assert.equal(x.el('note-thread-sources').querySelector('input').checked, false);
  assert.equal(x.el('note-thread-plan-name').value, 'Mein Abend');
  assert.equal(x.el('note-thread-visit-title').value, 'Meine Spur');
  assert.equal(x.el('note-editor').closest('#note-thread-editor'), null);
});

test('an unconfirmed unlink retains the original editor and does not offer an automatic second write', async (t) => {
  const x = fixture(t);
  let calls = 0;
  x.setDetach(async () => {
    calls++;
    x.block();
    return false;
  });
  await x.ui.open();
  const confirm = [...x.el('note-thread-sources').querySelectorAll('button')].find(
    (b) => b.textContent === 'Verknüpfungen hier lösen',
  );
  confirm.onclick();
  await until(() =>
    x.el('note-thread-editor-status').textContent.includes('Speicherstatus prüfen'),
  );
  assert.equal(x.el('note-thread-editor').hidden, false);
  assert(x.el('note-thread-editor').contains(x.el('preparation-reconcile')));
  confirm.onclick();
  await tick();
  assert.equal(calls, 1);
  assert(x.el('note-thread-sources').querySelector('[data-note-id="Nera"]'));
});

test('a late unlink acknowledgement cannot return or redraw the editor of a reopened map', async (t) => {
  const x = fixture(t),
    wait = deferred();
  let savedCurrent;
  x.setDetach(async (_root, _id, current) => {
    savedCurrent = current;
    return wait.promise;
  });
  await x.ui.open();
  [...x.el('note-thread-sources').querySelectorAll('button')]
    .find((b) => b.textContent === 'Verknüpfungen hier lösen')
    .onclick();
  await until(() => !!savedCurrent);
  x.ui.reset();
  await x.ui.open();
  const reads = x.calls.length;
  assert.equal(savedCurrent(), false);
  wait.resolve(true);
  await tick();
  await tick();
  assert.equal(x.calls.length, reads);
  assert.equal(x.el('note-thread-editor').hidden, true);
  assert.equal(x.el('note-thread-dialog').open, true);
  assert.equal(x.el('note-editor').closest('#note-thread-editor'), null);
});

test('family sources stay readable and route to paired relationship editing without offering a one-sided unlink', async (t) => {
  const x = fixture(t);
  x.root.kind = 'npc';
  x.root.relations[0].familyKind = 'partner';
  await x.ui.open();
  const card = x.el('note-thread-sources').querySelector('[data-note-id="Nera"]');
  assert.match(card.textContent, /als Paar unter „Zusammenhänge“/);
  assert.equal(
    [...card.querySelectorAll('button')].some((b) => b.textContent === 'Verknüpfungen hier lösen'),
    false,
  );
  assert.equal(x.el('note-thread-dialog').open, true);
  assert(x.el('note-thread-sources').textContent.includes('Offene Spur'));
});

function recoveryFixture(x) {
  const link = '[Quelle](dungeon-ref:note/Zurück)',
    before = {
      ...x.root,
      revision: 1,
      gmNotes: 'Vor ' + link + '.\n',
      relations: [...x.root.relations, { targetId: 'Zurück', label: 'Quelle' }],
    },
    after = { ...before, revision: 2, gmNotes: 'Vor Quelle.\n', relations: x.root.relations };
  Object.assign(x.root, after);
  return { id: 'H', sourceId: 'Zurück', title: 'Die alte Quelle', before, after };
}
test('recovery history is requested only on demand and uses the existing original editor and manual confirmation', async (t) => {
  const x = fixture(t),
    recovery = recoveryFixture(x),
    writes = [];
  x.owner.restore = async (root, r, current) => {
    writes.push({ root, r, current });
    return false;
  };
  x.setRead(async (_t, _id, _o, _a, history) =>
    ok({
      root: x.root,
      entries: x.all,
      total: 3,
      next: null,
      recoveries: history ? [recovery] : [],
    }),
  );
  await x.ui.open();
  assert.equal(x.calls.length, 1);
  assert.equal(x.calls[0][4], undefined);
  x.click('Gelöste Quellen wiederherstellen…');
  await until(() => x.el('note-thread-recoveries').querySelectorAll('article').length === 1);
  assert.equal(x.calls[1][4], true);
  x.click('Verknüpfungen wiederherstellen');
  await until(() => writes.length === 1 && !x.el('note-thread-return').disabled);
  assert.equal(writes[0].r.sourceId, 'Zurück');
  assert.equal(x.el('note-thread-editor').hidden, false);
  assert.match(x.el('note-thread-editor-status').textContent, /noch nicht bestätigt/);
  await tick();
  assert.equal(writes.length, 1);
  x.ui.reset();
  assert.equal(writes[0].current(), false);
});
test('conflicting recovery keeps original evidence visible and cannot invoke a write', async (t) => {
  const x = fixture(t),
    recovery = recoveryFixture(x);
  x.root.gmNotes = 'Später völlig geändert.\n';
  let writes = 0;
  x.owner.restore = async () => {
    writes++;
    return true;
  };
  x.setRead(async () =>
    ok({ root: x.root, entries: x.all, total: 3, next: null, recoveries: [recovery] }),
  );
  await x.ui.open();
  x.click('Gelöste Quellen wiederherstellen…');
  await until(() => x.el('note-thread-recoveries').querySelector('pre'));
  const action = [...x.el('note-thread-recoveries').querySelectorAll('button')].find(
    (b) => b.textContent === 'Verknüpfungen wiederherstellen',
  );
  assert.equal(action.disabled, true);
  action.onclick();
  await tick();
  assert.equal(writes, 0);
  assert.match(x.el('note-thread-recoveries').textContent, /geändert|mehrdeutig/);
  assert.match(
    x.el('note-thread-recoveries').querySelector('pre').textContent,
    /dungeon-ref:note\/Zurück/,
  );
});
test('a delayed history response cannot populate another opening of the same map', async (t) => {
  const x = fixture(t),
    recovery = recoveryFixture(x),
    wait = deferred();
  await x.ui.open();
  x.setRead(() => wait.promise);
  x.click('Gelöste Quellen wiederherstellen…');
  x.ui.reset();
  x.setRead(async () => ok({ root: x.root, entries: x.all, total: 3, next: null }));
  await x.ui.open();
  wait.resolve(ok({ root: x.root, entries: x.all, total: 3, next: null, recoveries: [recovery] }));
  await tick();
  assert.doesNotMatch(x.el('note-thread-recoveries').textContent, /Die alte Quelle/);
});

test('only a verified trash source can open the identical original editor while remaining excluded from preparation', async (t) => {
  const x = fixture(t),
    source = {
      ...x.all[0],
      unavailable: true,
      trashed: true,
      notice: 'Originalnotiz liegt im Papierkorb',
    };
  x.setRead(async () => ok({ root: x.root, entries: [source, x.all[1]], total: 2, next: null }));
  await x.ui.open();
  const card = x.el('note-thread-sources').querySelector('article');
  assert.match(card.textContent, /Nera.*Papierkorb/);
  assert.equal(card.querySelector('input').disabled, true);
  x.click('Original im Papierkorb ansehen…');
  await until(
    () => x.el('note-thread-editor').hidden === false && !x.el('note-thread-return').disabled,
  );
  assert.equal(x.ui.editorId, 'Nera');
  assert(x.el('note-thread-editor').contains(x.el('note-editor')));
  x.el('note-thread-return').onclick();
  await until(() => x.el('note-thread-editor').hidden);
  assert.equal(x.el('note-thread-sources').querySelector('input').disabled, true);
});
test('unavailable source with no verified trash metadata never exposes the trash editor action', async (t) => {
  const x = fixture(t);
  x.all[0].unavailable = true;
  await x.ui.open();
  const card = x.el('note-thread-sources').querySelector('article');
  assert.equal(
    [...card.querySelectorAll('button')].find((b) => b.textContent === 'Notiz bearbeiten…')
      .disabled,
    true,
  );
  assert.equal(
    [...card.querySelectorAll('button')].some(
      (b) => b.textContent === 'Original im Papierkorb ansehen…',
    ),
    false,
  );
});

function candidateNotes(x) {
  const candidates = ['Nordtor', 'Südstadt'].map((id) => ({
    ref: { kind: 'note', id },
    title: 'Nera',
    label: 'NSC',
    revision: 2,
  }));
  x.setSearch(async () => ok({ entries: candidates, next: null }));
  x.setDetail(async (_t, ref) =>
    ok({
      ref,
      revision: 2,
      note: { ...note(ref.id), title: 'Nera', gmNotes: 'Aktueller Einsatz: ' + ref.id },
    }),
  );
  return candidates;
}
test('the full original can be inspected and chosen before linking without losing prior choices or destination', async (t) => {
  const x = fixture(t);
  candidateNotes(x);
  await x.ui.open();
  const original = x.el('note-editor'),
    box = x.el('note-thread-sources').querySelector('input');
  box.checked = false;
  box.onchange();
  x.select('note-thread-plan', '');
  x.el('note-thread-plan-name').value = 'Mein Abend';
  x.el('note-thread-visit-title').value = 'Meine Frage';
  x.el('note-thread-find').onclick();
  await until(() => x.el('note-thread-candidates').querySelectorAll('article').length === 2);
  x.el('note-thread-candidates').querySelector('button').onclick();
  await until(
    () => !x.el('note-thread-editor').hidden && !x.el('note-thread-choose-source').disabled,
  );
  assert.strictEqual(x.el('note-editor'), original);
  assert.equal(x.ui.editorId, 'Nordtor');
  assert.equal(x.adds.length, 0);
  x.el('note-thread-choose-source').onclick();
  await until(() => x.el('note-thread-editor').hidden && !x.el('note-thread-add').disabled);
  assert.equal(x.el('note-thread-candidates').querySelector('input').checked, true);
  assert.equal(x.el('note-thread-candidates').querySelectorAll('input')[1].checked, false);
  assert.equal(x.el('note-thread-plan-name').value, 'Mein Abend');
  assert.equal(x.el('note-thread-visit-title').value, 'Meine Frage');
  assert.equal(x.el('note-thread-sources').querySelector('input').checked, false);
  assert.equal(x.adds.length, 0);
  x.el('note-thread-add').onclick();
  await until(() => x.adds.length === 1 && !x.el('note-thread-return').disabled);
  assert.deepEqual(x.adds[0].ids, ['Nordtor']);
  assert.equal(x.ui.editorId, 'Mappe');
  assert.match(x.el('note-thread-editor-status').textContent, /noch nicht bestätigt/);
});
test('returning from candidate inspection without choosing does not stage it', async (t) => {
  const x = fixture(t);
  candidateNotes(x);
  await x.ui.open();
  x.el('note-thread-find').onclick();
  await until(() => x.el('note-thread-candidates').querySelector('button'));
  x.el('note-thread-candidates').querySelector('button').onclick();
  await until(() => !x.el('note-thread-return').disabled);
  x.el('note-thread-return').onclick();
  await until(() => x.el('note-thread-editor').hidden);
  assert.equal(x.el('note-thread-add').disabled, true);
  assert.equal(x.el('note-thread-candidates').querySelector('input').checked, false);
  assert.equal(x.adds.length, 0);
});
test('a retired candidate read cannot stage a source in a later opening', async (t) => {
  const x = fixture(t),
    wait = deferred();
  candidateNotes(x);
  await x.ui.open();
  x.el('note-thread-find').onclick();
  await until(() => x.el('note-thread-candidates').querySelector('button'));
  x.el('note-thread-candidates').querySelector('button').onclick();
  await until(() => !x.el('note-thread-choose-source').disabled);
  x.setDetail(async (_t, ref) =>
    ref.id === 'Nordtor' ? wait.promise : ok({ ref, revision: 2, note: note(ref.id) }),
  );
  x.el('note-thread-choose-source').onclick();
  await until(() => x.el('note-thread-editor').hidden);
  x.ui.reset();
  await x.ui.open();
  wait.resolve(ok({ ref: { kind: 'note', id: 'Nordtor' }, revision: 2, note: note('Nordtor') }));
  await tick();
  assert.equal(x.el('note-thread-add').disabled, true);
  assert.equal(x.adds.length, 0);
  assert.doesNotMatch(x.el('note-thread-status').textContent, /vorgemerkt/);
});
for (const fault of ['unavailable', 'identity', 'revision'])
  test(`candidate ${fault} at the final availability check cannot be staged`, async (t) => {
    const x = fixture(t);
    candidateNotes(x);
    await x.ui.open();
    x.el('note-thread-find').onclick();
    await until(() => x.el('note-thread-candidates').querySelector('button'));
    x.el('note-thread-candidates').querySelector('button').onclick();
    await until(() => !x.el('note-thread-choose-source').disabled);
    x.setDetail(async (_t, ref) =>
      ref.id !== 'Nordtor'
        ? ok({ ref, revision: 2, note: note(ref.id) })
        : ok({
            ref,
            revision: 2,
            unavailable: fault === 'unavailable',
            note: {
              ...note(fault === 'identity' ? 'anderes Original' : ref.id),
              revision: fault === 'revision' ? 3 : 2,
            },
          }),
    );
    x.el('note-thread-choose-source').onclick();
    await until(
      () =>
        x.el('note-thread-editor').hidden &&
        x.el('note-thread-status').textContent.includes('nicht verlässlich'),
    );
    assert.equal(x.el('note-thread-add').disabled, true);
    assert.equal(x.adds.length, 0);
  });

test('a failed root reread preserves its error and cannot mark a reviewed candidate as ready', async (t) => {
  const x = fixture(t);
  candidateNotes(x);
  await x.ui.open();
  x.el('note-thread-find').onclick();
  await until(() => x.el('note-thread-candidates').querySelector('button'));
  x.el('note-thread-candidates').querySelector('button').onclick();
  await until(() => !x.el('note-thread-choose-source').disabled);
  x.setRead(async () => ({ ok: false, error: 'Mappe gerade nicht lesbar' }));
  x.el('note-thread-choose-source').onclick();
  await until(
    () =>
      x.el('note-thread-editor').hidden &&
      x.el('note-thread-status').textContent.includes('gerade nicht lesbar'),
  );
  assert.equal(x.el('note-thread-add').disabled, true);
  assert.equal(x.el('note-thread-candidates').querySelector('input').checked, false);
  assert.equal(x.adds.length, 0);
});

test('an opened map starts at the selected planning visit and retains an explicit different destination across source rereads', async (t) => {
  const x = fixture(t);
  x.owner.plans.push({
    id: 'Q',
    name: 'Aktueller Abend',
    scenes: [
      { id: 'earlier', title: 'Früher' },
      { id: 'selected', title: 'Aktueller Besuch' },
    ],
  });
  x.owner.destination = { planId: 'Q', visitId: 'selected' };
  await x.ui.open();
  assert.equal(x.el('note-thread-plan').value, 'Q');
  assert.equal(x.el('note-thread-visit').value, 'selected');
  x.select('note-thread-plan', 'P');
  assert.equal(x.el('note-thread-visit').value, '');
  x.select('note-thread-visit', 'V');
  x.click('Aktualisieren');
  await until(() => !x.el('note-thread-use').disabled);
  assert.equal(x.el('note-thread-plan').value, 'P');
  assert.equal(x.el('note-thread-visit').value, 'V');
  x.ui.reset();
  await x.ui.open();
  assert.equal(x.el('note-thread-plan').value, 'Q');
  assert.equal(x.el('note-thread-visit').value, 'selected');
});
for (const destination of [
  { planId: 'missing', visitId: 'foreign' },
  { planId: 'P', visitId: 'foreign' },
])
  test(`an unavailable or cross-plan destination cannot select the foreign visit (${destination.planId})`, async (t) => {
    const x = fixture(t);
    x.owner.plans.push({
      id: 'Q',
      name: 'Anderer Abend',
      scenes: [{ id: 'foreign', title: 'Anderer Besuch' }],
    });
    x.owner.destination = destination;
    await x.ui.open();
    assert.equal(x.el('note-thread-plan').value, destination.planId === 'P' ? 'P' : '');
    assert.equal(x.el('note-thread-visit').value, '');
  });

test('passive completed checklist items are not rewritten as map source choices', async (t) => {
  const x = fixture(t);
  x.setDetail(async (_token, ref) =>
    ok({
      ref,
      revision: 2,
      note: { ...note(ref.id), gmNotes: '- [x] Zeichen erkannt\n- [ ] Liste prüfen' },
    }),
  );
  await x.ui.open();
  await until(() => x.el('note-thread-sources').querySelector('.markdown-task input'));
  const box = x.el('note-thread-sources').querySelector('.markdown-task input');
  assert.equal(box.checked, true);
  assert.equal(box.disabled, true);
  x.el('note-thread-include-root').checked = false;
  x.el('note-thread-include-root').onchange();
  assert.equal(box.checked, true);
  assert.equal(box.disabled, true);
});

test('handoff from a source editor retains the whole dossier, deliberate choices and the chosen existing visit', async (t) => {
  const x = fixture(t);
  x.owner.plans.push({
    id: 'SECOND',
    name: 'Anderer Abend',
    scenes: [{ id: 'LATER', title: 'Später' }],
  });
  await x.ui.open();
  const excluded = x.el('note-thread-sources').querySelectorAll('input')[1];
  excluded.checked = false;
  excluded.onchange();
  x.select('note-thread-plan', 'SECOND');
  x.select('note-thread-visit', 'LATER');
  x.click('Notiz bearbeiten…');
  await until(() => !x.el('note-thread-return').disabled);
  x.el('note-gm').value = 'Neue Gesprächsnotiz';
  x.el('note-thread-prepare-map').click();
  await until(() => x.el('note-thread-editor').hidden && !x.el('note-thread-use').disabled);
  assert.equal(x.el('note-thread-heading').textContent, 'Notizmappe: Mappe');
  assert.equal(x.el('note-thread-parent').hidden, true);
  assert.equal(x.el('note-thread-plan').value, 'SECOND');
  assert.equal(x.el('note-thread-visit').value, 'LATER');
  assert.equal(x.el('note-thread-reading').firstElementChild.className, 'note-thread-target');
  assert.equal(x.used.length, 0);
  assert.equal(x.el('note-thread-sources').querySelectorAll('input')[1].checked, false);
  x.el('note-thread-use').click();
  await until(() => x.used.length === 1);
  assert.equal(x.used[0].selection.rootId, 'Mappe');
  assert.deepEqual(
    x.used[0].selection.entries.map((e) => e.id),
    ['Nera'],
  );
  assert.equal(x.used[0].target.visitId, 'LATER');
});

test('a source without a planning destination cannot silently use the first historical visit', async (t) => {
  const x = fixture(t);
  delete x.owner.destination;
  await x.ui.open(true);
  assert.equal(x.el('note-thread-plan').value, '');
  assert.equal(x.el('note-thread-visit').value, '');
  x.el('note-thread-use').click();
  await tick();
  assert.equal(x.used.length, 0);
  x.select('note-thread-plan', 'P');
  assert.equal(x.el('note-thread-visit').value, '');
  x.el('note-thread-use').click();
  await tick();
  assert.equal(x.used.length, 0);
  x.select('note-thread-visit', 'V');
  x.el('note-thread-use').click();
  await until(() => x.used.length === 1);
  assert.equal(x.used[0].target.visitId, 'V');
});

test('preparing keeps source management together while review, edits and return preserve the chosen destination', async (t) => {
  const x = fixture(t);
  await x.ui.open(true);
  const review = x.el('note-thread-review');
  assert.equal(review.open, false);
  assert(review.contains(x.el('note-thread-root')));
  assert(review.contains(x.el('note-thread-sources')));
  assert.equal(
    x.el('note-thread-clear-selection').parentElement.className,
    'note-thread-selection-summary',
  );
  const box = x.el('note-thread-source-choices').querySelector('input');
  box.checked = false;
  box.onchange();
  review.open = true;
  x.click('Notiz bearbeiten…');
  await until(() => !x.el('note-thread-return').disabled);
  x.el('note-thread-return').click();
  await until(() => x.el('note-thread-editor').hidden);
  assert.equal(review.open, true);
  assert.equal(box.checked, false);
  assert.equal(x.el('note-thread-sources').querySelector('input').checked, false);
  assert.equal(x.el('note-thread-plan').value, 'P');
  assert.equal(x.el('note-thread-visit').value, 'V');
  assert.equal(x.used.length, 0);
  x.ui.reset();
  await x.ui.open();
  assert.equal(review.isConnected, false);
  assert(x.el('note-thread-reading').contains(x.el('note-thread-root')));
});

test('destination guidance follows selection and typing without clearing actual save failures', async (t) => {
  const x = fixture(t);
  delete x.owner.destination;
  await x.ui.open(true);
  const hint = x.el('note-thread-target-hint');
  assert.match(hint.textContent, /Spielabend auswählen/);
  x.el('note-thread-use').click();
  await tick();
  assert.equal(x.used.length, 0);
  x.select('note-thread-plan', 'P');
  assert.match(hint.textContent, /Besuch auswählen/);
  x.select('note-thread-visit', 'V');
  assert.equal(hint.hidden, true);
  assert.equal(hint.textContent, '');
  assert.doesNotMatch(x.el('note-thread-status').textContent, /benennen/);
  x.select('note-thread-plan', '');
  x.el('note-thread-plan-name').value = 'Fortsetzung';
  x.el('note-thread-plan-name').oninput();
  assert.match(hint.textContent, /Besuch auswählen/);
  x.el('note-thread-visit-title').value = 'Bei der Scheune';
  x.el('note-thread-visit-title').oninput();
  assert.equal(hint.hidden, true);
  assert.equal(hint.textContent, '');
  x.setCheck(async () => ({ ok: false, error: 'Quelle inzwischen geändert' }));
  x.el('note-thread-use').click();
  await until(() => x.el('note-thread-status').textContent.includes('inzwischen'));
  x.el('note-thread-visit-title').value = 'Am Tor';
  x.el('note-thread-visit-title').oninput();
  assert.match(x.el('note-thread-status').textContent, /Quelle inzwischen geändert/);
  assert.equal(x.used.length, 0);
});

test('clearing source choices retains the separate root and destination, and leaves later or newly read sources unselected', async (t) => {
  const x = fixture(t),
    later = entry('Späte Spur', 'open');
  x.root.relations = [...x.all.slice(0, 2), later].map((e) => ({
    targetId: e.id,
    label: 'Quelle',
  }));
  x.setRead(async (_t, _id, offset) =>
    ok({
      root: x.root,
      entries: offset ? [later] : x.all.slice(0, 2),
      total: 3,
      next: offset ? null : 2,
    }),
  );
  await x.ui.open();
  x.el('note-thread-clear-selection').click();
  assert.equal(x.el('note-thread-include-root').checked, true);
  assert.match(x.el('note-thread-choice').textContent, /^1 Originalnotizen/);
  assert(
    [...x.el('note-thread-reading').querySelectorAll('input[data-thread-source]')].every(
      (b) => !b.checked,
    ),
  );
  assert.equal(x.el('note-thread-plan').value, 'P');
  assert.equal(x.el('note-thread-visit').value, 'V');
  assert.equal(x.used.length, 0);
  assert.equal(x.adds.length, 0);
  x.el('note-thread-more').click();
  await until(() => x.el('note-thread-sources').querySelectorAll('article').length === 3);
  assert(
    [...x.el('note-thread-reading').querySelectorAll('input[data-thread-source]')].every(
      (b) => !b.checked,
    ),
  );
  const late = () => x.el('note-thread-sources').querySelector('[data-note-id="Späte Spur"] input');
  late().checked = true;
  late().onchange();
  const fresh = entry('Neue Quelle');
  x.setRead(async () =>
    ok({ root: x.root, entries: [...x.all.slice(0, 2), later, fresh], total: 4, next: null }),
  );
  x.click('Aktualisieren');
  await until(() => !x.el('note-thread-active').disabled);
  assert.equal(late().checked, true);
  assert.equal(
    x.el('note-thread-sources').querySelector('[data-note-id="Neue Quelle"] input').checked,
    false,
  );
  x.el('note-thread-use').click();
  await until(() => x.used.length === 1);
  assert.deepEqual(
    x.used[0].selection.entries.map((e) => e.id),
    [later.id],
  );
  assert.equal(x.used[0].selection.includeRoot, true);
  assert.equal(x.used[0].target.visitId, 'V');
});

test('nested maps keep their own initial selection while returning restores the cleared parent intent; a new opening resets it', async (t) => {
  const x = fixture(t),
    child = entry('Kindquelle'),
    fresh = entry('Neue Quelle');
  await x.ui.open();
  const clear = x.el('note-thread-clear-selection');
  clear.click();
  const nera = x.el('note-thread-sources').querySelector('[data-note-id="Nera"] input');
  nera.checked = true;
  nera.onchange();
  x.setRead(async (_t, id) =>
    ok({
      root: id === 'Nera' ? note('Nera') : x.root,
      entries: id === 'Nera' ? [child] : [...x.all, fresh],
      total: id === 'Nera' ? 1 : 4,
      next: null,
    }),
  );
  x.setPrepare(async () => ({ ...x.owner, id: 'Nera' }));
  x.click('Notiz bearbeiten…');
  await until(() => !x.el('note-thread-return').disabled);
  await x.ui.open();
  assert.match(x.el('note-thread-heading').textContent, /Nera/);
  assert.equal(x.el('note-thread-sources').querySelector('input').checked, true);
  x.el('note-thread-parent').click();
  await until(
    () =>
      x.el('note-thread-heading').textContent === 'Notizmappe: Mappe' &&
      !x.el('note-thread-active').disabled,
  );
  assert.equal(
    x.el('note-thread-sources').querySelector('[data-note-id="Nera"] input').checked,
    true,
  );
  assert.equal(
    x.el('note-thread-sources').querySelector('[data-note-id="Neue Quelle"] input').checked,
    false,
  );
  x.ui.reset();
  x.setPrepare(async () => x.owner);
  await x.ui.open(true);
  assert.strictEqual(x.el('note-thread-clear-selection'), clear);
  assert(x.el('note-thread-reading').firstElementChild.contains(clear));
  assert.equal(
    x.el('note-thread-dialog').querySelectorAll('#note-thread-clear-selection').length,
    1,
  );
  assert.equal(
    x.el('note-thread-sources').querySelector('[data-note-id="Neue Quelle"] input').checked,
    true,
  );
});

test('clearing cannot change a choice while a page is pending or its owner is blocked or retired', async (t) => {
  const x = fixture(t),
    late = deferred();
  await x.ui.open();
  const first = x.el('note-thread-sources').querySelector('input'),
    clear = x.el('note-thread-clear-selection');
  x.setRead(() => late.promise);
  x.click('Aktualisieren');
  assert.equal(clear.disabled, true);
  clear.onclick();
  assert.equal(first.checked, true);
  late.resolve(ok({ root: x.root, entries: x.all, total: 3, next: null }));
  await until(() => !clear.disabled);
  x.block();
  clear.onclick();
  assert.equal(x.el('note-thread-sources').querySelector('input').checked, true);
  x.retire();
  clear.onclick();
  assert.equal(x.el('note-thread-sources').querySelector('input').checked, true);
  assert.equal(x.used.length, 0);
});

for (const refresh of ['refresh', 'filter'])
  test(
    'explicit ' + refresh + ' retains the loaded later-page choice and destination',
    async (t) => {
      const x = fixture(t),
        later = entry('Späte Spur', 'open');
      x.root.relations = [...[x.all[0]], later].map((e) => ({ targetId: e.id, label: 'Quelle' }));
      x.setRead(async (_t, _id, offset) =>
        ok({
          root: x.root,
          entries: offset ? [later] : [x.all[0]],
          total: 2,
          next: offset ? null : 1,
        }),
      );
      await x.ui.open();
      x.el('note-thread-more').onclick();
      await until(() => x.el('note-thread-sources').querySelectorAll('article').length === 2);
      const source = () => x.el('note-thread-sources').querySelector('[data-note-id="Späte Spur"]');
      const box = source().querySelector('input');
      box.checked = true;
      box.onchange();
      if (refresh === 'refresh') x.click('Aktualisieren');
      else {
        x.el('note-thread-active').checked = false;
        x.el('note-thread-active').onchange();
      }
      await until(() => x.calls.length === 4 && !x.el('note-thread-use').disabled);
      assert(source());
      assert.equal(source().querySelector('input').checked, true);
      assert.deepEqual(
        x.calls.map((c) => c[2]),
        [0, 1, 0, 1],
      );
      assert.equal(x.el('note-thread-plan').value, 'P');
      assert.equal(x.el('note-thread-visit').value, 'V');
      x.el('note-thread-use').onclick();
      await until(() => x.used.length === 1);
      assert(x.used[0].selection.entries.some((e) => e.id === later.id));
    },
  );

test('a failed later page retains the full refresh extent for retry and keeps handoff blocked', async (t) => {
  const x = fixture(t),
    later = entry('Späte Spur', 'open'),
    wait = deferred();
  let phase = 'initial';
  x.root.relations = [...[x.all[0]], later].map((e) => ({ targetId: e.id, label: 'Quelle' }));
  x.setRead(async (_t, _id, offset) =>
    offset
      ? phase === 'pending'
        ? wait.promise
        : phase === 'failed'
          ? { ok: false, error: 'Späte Seite fehlt' }
          : ok({ root: x.root, entries: [later], total: 2, next: null })
      : ok({ root: x.root, entries: [x.all[0]], total: 2, next: 1 }),
  );
  await x.ui.open();
  x.el('note-thread-more').onclick();
  await until(() => x.el('note-thread-sources').querySelectorAll('article').length === 2);
  let box = x.el('note-thread-sources').querySelector('[data-note-id="Späte Spur"] input');
  box.checked = true;
  box.onchange();
  phase = 'failed';
  x.click('Aktualisieren');
  await until(() => x.el('note-thread-status').textContent === 'Späte Seite fehlt');
  assert.equal(x.el('note-thread-use').disabled, true);
  x.el('note-thread-use').onclick();
  await tick();
  assert.equal(x.used.length, 0);
  assert.equal(x.el('note-thread-more').disabled, true);
  x.el('note-thread-more').onclick();
  await tick();
  assert.equal(x.calls.length, 4);
  phase = 'pending';
  x.click('Aktualisieren');
  await until(() => x.calls.length === 6);
  assert.equal(x.el('note-thread-use').disabled, true);
  assert.equal(x.el('note-thread-active').disabled, true);
  wait.resolve(ok({ root: x.root, entries: [later], total: 2, next: null }));
  await until(() => !x.el('note-thread-use').disabled);
  box = x.el('note-thread-sources').querySelector('[data-note-id="Späte Spur"] input');
  assert.equal(box.checked, true);
  assert.deepEqual(
    x.calls.map((c) => c[2]),
    [0, 1, 0, 1, 0, 1],
  );
});

test('refresh reloads only the reviewed extent and changed later-page sources require a new choice', async (t) => {
  const x = fixture(t),
    later = entry('Späte Spur', 'open');
  x.root.relations = [...[x.all[0]], later, entry('Ungeprüft')].map((e) => ({
    targetId: e.id,
    label: 'Quelle',
  }));
  x.setRead(async (_t, _id, offset) => {
    assert.notEqual(offset, 2, 'unreviewed page must not be read');
    return ok({
      root: x.root,
      entries: offset ? [later] : [x.all[0]],
      total: 3,
      next: offset ? 2 : 1,
    });
  });
  await x.ui.open();
  x.el('note-thread-more').onclick();
  await until(() => x.el('note-thread-sources').querySelectorAll('article').length === 2);
  let box = x.el('note-thread-sources').querySelector('[data-note-id="Späte Spur"] input');
  box.checked = true;
  box.onchange();
  later.stamp = 'changed'.padEnd(64, 'a');
  x.click('Aktualisieren');
  await until(() => x.calls.length === 4 && !x.el('note-thread-use').disabled);
  assert.equal(
    x.el('note-thread-sources').querySelector('[data-note-id="Späte Spur"] input').checked,
    false,
  );
  assert.equal(x.el('note-thread-more').hidden, false);
});

test('a new map opening drops a failed refresh extent and ignores its late page', async (t) => {
  const x = fixture(t),
    later = entry('Späte Spur'),
    wait = deferred();
  let pending = false;
  x.root.relations = [...[x.all[0]], later].map((e) => ({ targetId: e.id, label: 'Quelle' }));
  x.setRead(async (_t, _id, offset) =>
    offset
      ? pending
        ? wait.promise
        : ok({ root: x.root, entries: [later], total: 2, next: null })
      : ok({ root: x.root, entries: [x.all[0]], total: 2, next: 1 }),
  );
  await x.ui.open();
  x.el('note-thread-more').onclick();
  await until(() => x.el('note-thread-sources').querySelectorAll('article').length === 2);
  pending = true;
  x.click('Aktualisieren');
  await until(() => x.calls.length === 4);
  x.ui.reset();
  await x.ui.open();
  assert.equal(x.calls.length, 5);
  assert.equal(x.el('note-thread-sources').querySelectorAll('article').length, 1);
  wait.resolve(ok({ root: x.root, entries: [later], total: 2, next: null }));
  await tick();
  assert.equal(x.el('note-thread-sources').querySelectorAll('article').length, 1);
  assert.equal(x.el('note-thread-more').hidden, false);
  assert.equal(x.el('note-thread-use').disabled, false);
});

// Small pages exercise member cursor semantics independently of the storage page size.
for (const trigger of ['refresh', 'filter', 'editor', 'nested', 'retry'])
  test(`restoration follows source identities after insertion (${trigger})`, async (t) => {
    const x = fixture(t),
      last = entry('Späte Spur', 'open'),
      middle = entry('Mitte'),
      extra = [entry('Neu A'), entry('Neu B')],
      unseen = entry('Nicht gelesen');
    let order = [x.all[0], x.all[1], middle, last, unseen],
      fail = false;
    const root = () => ({
      ...x.root,
      relations: order.map((e) => ({ targetId: e.id, label: 'Quelle' })),
    });
    x.setRead(async (_t, id, offset, active) => {
      if (id !== x.root.id) return ok({ root: note(id), entries: [], total: 0, next: null });
      if (fail && offset === 4) return { ok: false, error: 'Dritte Seite fehlt' };
      return ok({
        root: root(),
        entries: order.slice(offset, offset + 2).filter((e) => !active || e.status !== 'closed'),
        total: order.length,
        next: offset + 2 < order.length ? offset + 2 : null,
      });
    });
    await x.ui.open();
    x.el('note-thread-more').click();
    await until(() => x.el('note-thread-sources').querySelectorAll('article').length === 4);
    const source = (id) =>
      x.el('note-thread-sources').querySelector(`[data-note-id="${id}"] input`);
    source(last.id).checked = true;
    source(last.id).onchange();
    if (trigger === 'editor' || trigger === 'nested') {
      x.click('Notiz bearbeiten…');
      await until(() => !x.el('note-thread-return').disabled);
      if (trigger === 'nested') {
        x.setPrepare(async () => ({ ...x.owner, id: x.all[0].id }));
        await x.ui.open();
      }
    }
    order = [...extra, ...order];
    x.root.revision++;
    if (trigger === 'editor') x.el('note-thread-return').click();
    else if (trigger === 'nested') x.el('note-thread-parent').click();
    else if (trigger === 'filter') {
      x.el('note-thread-active').checked = false;
      x.el('note-thread-active').onchange();
    } else {
      fail = trigger === 'retry';
      x.click('Aktualisieren');
    }
    if (fail) {
      await until(() => x.el('note-thread-status').textContent === 'Dritte Seite fehlt');
      assert.equal(x.el('note-thread-use').disabled, true);
      fail = false;
      x.click('Aktualisieren');
    }
    await until(() => source(last.id) && !x.el('note-thread-use').disabled);
    assert.equal(source(last.id).checked, true);
    assert.equal(source(extra[0].id).checked, false);
    assert.equal(source(extra[1].id).checked, false);
    assert.equal(source(unseen.id), null);
    assert.equal(x.el('note-thread-plan').value, 'P');
    assert.equal(x.el('note-thread-visit').value, 'V');
    const offsets = x.calls.filter((c) => c[1] === x.root.id).map((c) => c[2]);
    assert.deepEqual(offsets, trigger === 'retry' ? [0, 2, 0, 2, 4, 0, 2, 4] : [0, 2, 0, 2, 4]);
    x.el('note-thread-use').click();
    await until(() => x.used.length === 1);
    assert.deepEqual(
      x.used[0].selection.entries.map((e) => e.id),
      [x.all[0].id, x.all[1].id, last.id],
    );
  });

for (const change of ['closed', 'removed'])
  test(`a ${change} previously read source cannot trigger unrelated hydration or retain a hidden selection`, async (t) => {
    const x = fixture(t),
      hidden = entry('Bekannt', 'open'),
      unseen = entry('Ungeprüft');
    let changed = false;
    x.setRead(async (_t, _id, offset, active) => {
      assert.equal(offset, 0, 'all relevant identities were already scanned');
      const order =
        changed && change === 'removed' ? [x.all[0], unseen] : [x.all[0], hidden, unseen];
      return ok({
        root: { ...x.root, relations: order.map((e) => ({ targetId: e.id, label: 'Quelle' })) },
        entries: changed ? [x.all[0]] : [x.all[0], hidden],
        total: order.length,
        next: changed && change === 'removed' ? 1 : 2,
      });
    });
    await x.ui.open();
    changed = true;
    x.click('Aktualisieren');
    await until(() => x.calls.length === 2 && !x.el('note-thread-use').disabled);
    assert.equal(x.el('note-thread-sources').querySelectorAll('article').length, 1);
    assert.equal(x.el('note-thread-more').hidden, false);
    x.el('note-thread-use').click();
    await until(() => x.used.length === 1);
    assert.deepEqual(
      x.used[0].selection.entries.map((e) => e.id),
      [x.all[0].id],
    );
  });

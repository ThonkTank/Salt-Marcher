import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from './helpers/dom.mjs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
buildSync({
  entryPoints: ['src/app/visit-note-organizer.ts'],
  outfile: '.build/visit-note-organizer-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { VisitNoteOrganizer } = createRequire(import.meta.url)(
  '../.build/visit-note-organizer-test.cjs',
);
const tick = () => new Promise((r) => setImmediate(r));
const until = async (f) => {
  for (let i = 0; i < 100; i++) {
    if (f()) return;
    await tick();
  }
  assert(f(), 'expected organizer state');
};
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const note = (id, title = id) => ({
  version: 1,
  id,
  revision: 3,
  title,
  kind: 'npc',
  gmNotes: 'GM ' + title,
  readAloud: 'Zum Vorlesen',
  relations: [],
  creatureId: null,
  deleted: false,
});
const entry = (id, title = id) => ({ ref: { kind: 'note', id }, title, label: 'NSC' });
const ok = (value) => ({ ok: true, value });
function fixture(t) {
  const { window, document } = parseHTML('<html><body><div id="refs"></div></body></html>'),
    previous = globalThis.document;
  globalThis.document = document;
  window.HTMLElement.prototype.focus = () => {};
  let search = async () => ok({ entries: [entry('nera')], next: null }),
    read = async (_t, ref) => ok({ ...entry(ref.id), revision: 3, note: note(ref.id) }),
    rooms = async () => ok({ entries: [], next: null }),
    valid = true;
  const ids = ['old'],
    changes = [],
    calls = [],
    root = document.getElementById('refs'),
    ui = new VisitNoteOrganizer(root, {
      searchDesk: (...a) => {
        calls.push(a);
        return search(...a);
      },
      deskContent: (...a) => read(...a),
      noteRoomUses: (...a) => rooms(...a),
    }),
    context = {
      key: 'A:visit1',
      token: 'A',
      notes: [{ note: note('old', 'Bisherige Quelle'), trashed: false }],
      current: () => valid,
      ids: () => ids,
      change: (id, on) => {
        changes.push({ id, on });
        if (on && !ids.includes(id)) ids.push(id);
        else if (!on) ids.splice(ids.indexOf(id), 1);
      },
      edit: async () => {},
    };
  ui.context(context);
  const el = (id) => document.getElementById(id),
    find = (q) => {
      el('visit-note-search').value = q;
      el('visit-note-find').onclick();
    };
  t.after(() => {
    ui.context(null);
    globalThis.document = previous;
  });
  return {
    ui,
    root,
    el,
    find,
    context,
    ids,
    changes,
    calls,
    setSearch: (f) => (search = f),
    setRead: (f) => (read = f),
    setRooms: (f) => (rooms = f),
    retire: () => (valid = false),
  };
}
test('content search stays beside the visit and selected references survive an empty result', async (t) => {
  const x = fixture(t);
  await until(() => x.el('visit-note-results').querySelector('input'));
  const box = x.el('visit-note-results').querySelector('input');
  box.checked = true;
  box.onchange();
  assert.deepEqual(x.ids, ['old', 'nera']);
  x.setSearch(async () => ok({ entries: [], next: null }));
  x.find('Lastenaufzug');
  await until(() => x.el('visit-note-search-status').textContent === '0 Notizen angezeigt.');
  assert.match(x.el('visit-note-selected').textContent, /Bisherige Quelle/);
  assert.match(x.el('visit-note-selected').textContent, /nera/);
  assert.equal(x.calls.at(-1)[1], 'note');
  assert.equal(x.changes.length, 1);
});
test('a selected source is read without copying its prose into the visit', async (t) => {
  const x = fixture(t);
  await until(() => x.el('visit-note-results').querySelector('button'));
  x.el('visit-note-results').querySelector('button').onclick();
  await until(() => x.el('visit-note-detail').textContent.includes('GM nera'));
  assert.equal(x.changes.length, 0);
  const toggle = x.el('visit-note-detail').querySelector('[data-note-toggle]');
  toggle.onclick();
  assert.deepEqual(x.changes, [{ id: 'nera', on: true }]);
  toggle.onclick();
  assert.deepEqual(x.ids, ['old']);
});
test('old search results and retained old controls cannot replace a newer visit', async (t) => {
  const x = fixture(t);
  await until(() => x.el('visit-note-results').querySelector('input'));
  const old = x.el('visit-note-results').querySelector('input'),
    wait = deferred();
  x.setSearch(async (_t, _k, q) =>
    q === 'old search' ? wait.promise : ok({ entries: [entry('new-visit')], next: null }),
  );
  x.find('old search');
  x.ui.context({ ...x.context, key: 'B:visit2', token: 'B' });
  wait.resolve(ok({ entries: [entry('old-response')], next: null }));
  await tick();
  old.checked = true;
  old.onchange();
  assert.equal(x.changes.length, 0);
  assert.equal(x.el('visit-note-search').value, '');
  assert.doesNotMatch(x.el('visit-note-results').textContent, /old-response/);
  assert.match(x.el('visit-note-results').textContent, /new-visit/);
});
test('a newer query ignores a delayed older answer', async (t) => {
  const x = fixture(t),
    wait = deferred();
  await until(() => x.el('visit-note-results').querySelector('input'));
  x.setSearch(async (_t, _k, q) =>
    q === 'alt' ? wait.promise : ok({ entries: [entry('fresh')], next: null }),
  );
  x.find('alt');
  x.find('neu');
  await until(() => x.el('visit-note-results').textContent.includes('fresh'));
  wait.resolve(ok({ entries: [entry('stale')], next: null }));
  await tick();
  assert.doesNotMatch(x.el('visit-note-results').textContent, /stale/);
});
test('a late detail response cannot overwrite a new selection or another activation', async (t) => {
  const x = fixture(t),
    wait = deferred();
  await until(() => x.el('visit-note-results').querySelector('button'));
  x.setRead(() => wait.promise);
  x.el('visit-note-results').querySelector('button').onclick();
  x.ui.context({ ...x.context, key: 'B:visit2', token: 'B' });
  wait.resolve(ok({ ...entry('nera'), revision: 3, note: note('nera') }));
  await tick();
  assert.doesNotMatch(x.el('visit-note-detail').textContent, /GM nera/);
  assert.equal(x.changes.length, 0);
});
test('same-visit refresh preserves query and preview while locked controls cannot change IDs', async (t) => {
  const x = fixture(t);
  await until(() => x.el('visit-note-results').querySelector('button'));
  x.find('Nera');
  await until(() => x.el('visit-note-search-status').textContent.includes('1 Notizen'));
  x.el('visit-note-results').querySelector('button').onclick();
  await until(() => x.el('visit-note-detail').textContent.includes('GM nera'));
  x.ui.context({ ...x.context });
  assert.equal(x.el('visit-note-search').value, 'Nera');
  assert.match(x.el('visit-note-detail').textContent, /GM nera/);
  x.ui.lock(true);
  const box = x.el('visit-note-results').querySelector('input');
  assert.equal(box.disabled, true);
  box.checked = true;
  box.onchange();
  x.el('visit-note-detail').querySelector('[data-note-toggle]').onclick();
  assert.equal(x.changes.length, 0);
});
test('wrong-target detail and failed reads cannot authorize linking', async (t) => {
  const x = fixture(t);
  await until(() => x.el('visit-note-results').querySelector('button'));
  x.setRead(async () => ok({ ...entry('wrong'), revision: 3, note: note('wrong') }));
  x.el('visit-note-results').querySelector('button').onclick();
  await until(() => x.el('visit-note-detail').textContent.includes('anderen Quelle'));
  assert.equal(x.el('visit-note-detail').querySelector('[data-note-toggle]'), null);
  assert.equal(x.changes.length, 0);
});
test('failed pagination preserves the first page and explicit retry uses the same offset', async (t) => {
  const x = fixture(t);
  await until(() => x.el('visit-note-results').querySelector('button'));
  x.setSearch(async (_t, _k, _q, offset) =>
    offset === 0 ? ok({ entries: [entry('first')], next: 40 }) : { ok: false, error: 'Offline' },
  );
  x.find('test');
  await until(() => x.el('visit-note-more').hidden === false);
  x.el('visit-note-more').onclick();
  await until(() => x.el('visit-note-search-status').textContent.includes('Offline'));
  assert.match(x.el('visit-note-results').textContent, /first/);
  assert.equal(x.el('visit-note-more').hidden, false);
  x.setSearch(async () => ok({ entries: [entry('second')], next: null }));
  x.el('visit-note-more').onclick();
  await until(() => x.el('visit-note-results').textContent.includes('second'));
  assert.equal(x.calls.at(-1)[3], 40);
  assert.match(x.el('visit-note-results').textContent, /first/);
});
test('source prose and search snippets render as literal text', async (t) => {
  const x = fixture(t);
  await until(() => x.el('visit-note-results').querySelector('button'));
  x.setRead(async (_t, ref) =>
    ok({
      ...entry(ref.id),
      revision: 3,
      note: { ...note(ref.id), gmNotes: '<img src=x onerror=steal()> **Geheim**' },
    }),
  );
  x.el('visit-note-results').querySelector('button').onclick();
  await until(() => x.el('visit-note-detail').textContent.includes('onerror'));
  assert.equal(x.el('visit-note-detail').querySelector('img'), null);
});
test('late room context for a previous preview cannot replace the next note context', async (t) => {
  const x = fixture(t),
    wait = deferred();
  await until(() => x.el('visit-note-results').querySelector('button'));
  x.setRooms(async (_t, id) =>
    id === 'nera'
      ? wait.promise
      : ok({ entries: [{ title: 'Neuer Raum', number: '2' }], next: null }),
  );
  x.el('visit-note-results').querySelector('button').onclick();
  await until(() => x.el('visit-note-detail').textContent.includes('GM nera'));
  x.el('visit-note-selected').querySelector('button').onclick();
  await until(() => x.el('visit-note-detail').textContent.includes('Neuer Raum'));
  wait.resolve(ok({ entries: [{ title: 'Alter falscher Raum', number: '7' }], next: null }));
  await tick();
  assert.match(x.el('visit-note-detail').textContent, /Neuer Raum/);
  assert.doesNotMatch(x.el('visit-note-detail').textContent, /Alter falscher/);
});
test('an older preparation directory cannot replace a freshly read note title', async (t) => {
  const x = fixture(t);
  await until(() => x.el('visit-note-results').querySelector('button'));
  x.setRead(async () =>
    ok({
      ...entry('old', 'Neuer Name'),
      revision: 4,
      note: { ...note('old', 'Neuer Name'), revision: 4 },
    }),
  );
  x.el('visit-note-selected').querySelector('button').onclick();
  await until(() => x.el('visit-note-detail').textContent.includes('Neuer Name'));
  x.ui.context({ ...x.context });
  assert.match(x.el('visit-note-selected').textContent, /Neuer Name/);
  assert.doesNotMatch(x.el('visit-note-selected').textContent, /Bisherige Quelle/);
});

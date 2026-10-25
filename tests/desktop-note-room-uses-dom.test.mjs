import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from './helpers/dom.mjs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
buildSync({
  entryPoints: ['src/app/note-room-uses.ts'],
  outfile: '.build/note-room-uses-dom.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { NoteRoomUses } = createRequire(import.meta.url)('../.build/note-room-uses-dom.cjs'),
  tick = () => new Promise((r) => setImmediate(r));
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const entry = (id = 'room') => ({
  id,
  title: 'Archiv',
  number: '3',
  place: 'Burg · Erdgeschoss',
  excerpt: 'Nera kennt den Gang.',
  unavailable: false,
});
const page = (entries = [entry()], next = null, notice) => ({
  ok: true,
  value: { entries, next, notice },
});
function fixture(t, read = async () => page()) {
  const { document, window } = parseHTML('<section id="uses"></section>'),
    prior = globalThis.document;
  globalThis.document = document;
  let focused = null;
  window.HTMLElement.prototype.focus = function () {
    focused = this;
  };
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const host = document.getElementById('uses'),
    opens = [];
  let open = async (...args) => {
    opens.push(args);
    return true;
  };
  const ui = new NoteRoomUses(host, read, (...args) => open(...args));
  t.after(() => {
    ui.reset();
    globalThis.document = prior;
  });
  return { ui, host, opens, setOpen: (f) => (open = f), focused: () => focused };
}
test('a late read cannot display rooms from a previous note or campaign', async (t) => {
  const a = deferred(),
    x = fixture(t, async (token) => (token === 'a' ? a.promise : page([entry('beta')])));
  x.ui.show('a', 'nera', () => true);
  x.ui.show('b', 'other', () => true);
  await tick();
  a.resolve(page([entry('alpha')]));
  await tick();
  assert.equal(x.host.querySelectorAll('#note-room-uses-list button').length, 1);
  x.host.querySelector('#note-room-uses-list button').click();
  await tick();
  assert.equal(x.opens[0][0], 'beta');
});
test('detached links and an invalidated source cannot open a room', async (t) => {
  const x = fixture(t);
  let current = true;
  x.ui.show('a', 'nera', () => current);
  await tick();
  const old = x.host.querySelector('#note-room-uses-list button');
  current = false;
  old.onclick();
  await tick();
  assert.equal(x.opens.length, 0);
  current = true;
  x.ui.reset();
  old.onclick();
  await tick();
  assert.equal(x.opens.length, 0);
});
test('retry preserves the requested page and does not duplicate existing room rows', async (t) => {
  const requests = [];
  let failed = true;
  const x = fixture(t, async (token, id, offset) => {
    requests.push(offset);
    if (offset === 40 && failed) {
      failed = false;
      throw Error('Offline');
    }
    return offset === 0 ? page([entry('a')], 40) : page([entry('b')]);
  });
  x.ui.show('a', 'nera', () => true);
  await tick();
  const more = x.host.querySelector(':scope > button');
  more.click();
  await tick();
  assert.match(x.host.textContent, /Offline/);
  more.click();
  await tick();
  assert.deepEqual(requests, [0, 40, 40]);
  assert.equal(x.host.querySelectorAll('#note-room-uses-list button').length, 2);
  assert.equal(more.hidden, true);
});
test('a returned room refreshes its excerpt and restores keyboard focus to its link', async (t) => {
  let updated = false;
  const x = fixture(t, async () =>
    page([{ ...entry(), excerpt: updated ? 'Geänderter Gang.' : 'Vorher' }]),
  );
  x.ui.show('a', 'nera', () => true);
  await tick();
  x.host.querySelector('#note-room-uses-list button').click();
  await tick();
  updated = true;
  x.opens[0][2]();
  await tick();
  assert.match(x.host.textContent, /Geänderter Gang/);
  assert.equal(x.focused(), x.host.querySelector('#note-room-uses-list button'));
});
test('an unavailable source and an incomplete scan remain visible and are not navigable', async (t) => {
  const x = fixture(t, async () =>
    page([{ ...entry(), unavailable: true }], null, 'Raumverweise unvollständig'),
  );
  x.ui.show('a', 'nera', () => true);
  await tick();
  assert.match(x.host.textContent, /unvollständig/);
  assert.equal(x.host.querySelector('#note-room-uses-list button').disabled, true);
});

test('returning from a later page restores the loaded rooms and focuses that room', async (t) => {
  const requests = [],
    x = fixture(t, async (token, id, offset) => {
      requests.push(offset);
      return offset === 0 ? page([entry('first')], 40) : page([entry('later')]);
    });
  x.ui.show('a', 'nera', () => true);
  await tick();
  x.host.querySelector(':scope > button').click();
  await tick();
  x.host.querySelectorAll('#note-room-uses-list button')[1].click();
  await tick();
  x.opens[0][2]();
  await tick();
  await tick();
  assert.deepEqual(requests, [0, 40, 0, 40]);
  assert.equal(x.host.querySelectorAll('#note-room-uses-list button').length, 2);
  assert.equal(x.focused(), x.host.querySelectorAll('#note-room-uses-list button')[1]);
});
test('a blocked navigation explains the remaining open-input barrier and re-enables its link', async (t) => {
  const x = fixture(t);
  x.setOpen(async () => false);
  x.ui.show('a', 'nera', () => true);
  await tick();
  const button = x.host.querySelector('#note-room-uses-list button');
  button.click();
  await tick();
  assert.match(x.host.textContent, /Offene Eingaben/);
  assert.equal(button.disabled, false);
});

test('refreshing the same source while its room is open preserves the navigation and return focus', async (t) => {
  const x = fixture(t);
  x.ui.show('a', 'nera', () => true);
  await tick();
  x.host.querySelector('#note-room-uses-list button').click();
  await tick();
  const [, current, restore] = x.opens[0];
  x.ui.show('a', 'nera', () => true);
  await tick();
  assert.equal(current(), true);
  restore();
  await tick();
  assert.equal(x.focused(), x.host.querySelector('#note-room-uses-list button'));
});
test('changing away and back to a note revokes an older room return even when its title matches again', async (t) => {
  const x = fixture(t);
  x.ui.show('a', 'nera', () => true);
  await tick();
  x.host.querySelector('#note-room-uses-list button').click();
  await tick();
  const [, current, restore] = x.opens[0];
  x.ui.show('a', 'tarek', () => true);
  x.ui.show('a', 'nera', () => true);
  await tick();
  assert.equal(current(), false);
  const before = x.focused();
  restore();
  await tick();
  assert.equal(x.focused(), before);
});
test('explicit reset revokes an open room navigation after a source refresh', async (t) => {
  const x = fixture(t);
  x.ui.show('a', 'nera', () => true);
  await tick();
  x.host.querySelector('#note-room-uses-list button').click();
  await tick();
  const [, current] = x.opens[0];
  x.ui.show('a', 'nera', () => true);
  x.ui.reset();
  assert.equal(current(), false);
});
test('returning to the original editor preserves its viewport when delayed room backlinks arrive', async (t) => {
  const late = deferred();
  let count = 0;
  const x = fixture(t, () => (++count === 1 ? Promise.resolve(page()) : late.promise)),
    scrolled = [];
  x.host.ownerDocument.defaultView.HTMLElement.prototype.scrollIntoView = function () {
    scrolled.push(this);
  };
  x.ui.show('a', 'nera', () => true);
  await tick();
  x.host.querySelector('#note-room-uses-list button').click();
  await tick();
  const before = x.focused();
  x.opens[0][2](true);
  late.resolve(page([{ ...entry(), excerpt: 'Neuer Raumtext' }]));
  await tick();
  assert.match(x.host.textContent, /Neuer Raumtext/);
  assert.equal(x.focused(), before);
  assert.deepEqual(scrolled, []);
});

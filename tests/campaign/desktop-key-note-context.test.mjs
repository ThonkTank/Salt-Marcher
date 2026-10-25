import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/campaign/key-note-context.ts'],
  outfile: '.build/key-note-context.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  { KeyNoteContext } = require('../../.build/key-note-context.cjs'),
  tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
async function until(check) {
  for (let i = 0; i < 30; i++) {
    if (check()) return;
    await tick();
  }
  throw Error('Condition not reached');
}
function fixture(t) {
  const { document, window } = parseHTML(
    '<section id="preparation"><div id="preparation-problems" hidden></div><div id="note-editor"><button id="note-back"></button><textarea id="note-gm"></textarea></div><button id="preparation-apply"></button><button id="preparation-reconcile" hidden></button><button id="preparation-refresh" hidden></button></section><dialog id="key-dialog" open><div class="key-layout"><aside></aside><section><textarea id="key-gm-notes"></textarea></section></div></dialog>',
  );
  const previous = globalThis.document;
  globalThis.document = document;
  let focus = null;
  window.HTMLElement.prototype.focus = function () {
    focus = this.id;
  };
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const el = (id) => document.getElementById(id),
    dialog = el('key-dialog');
  Object.defineProperty(dialog, 'open', {
    get() {
      return dialog.hasAttribute('open');
    },
  });
  const ids = [
      'preparation-problems',
      'note-editor',
      'preparation-apply',
      'preparation-reconcile',
      'preparation-refresh',
    ],
    original = ids.map(el),
    home = el('preparation'),
    messages = [],
    opens = [];
  let closedAction = async () => {},
    flush = async () => true,
    beforeClose = async () => true,
    open = async (id, current) => {
      opens.push(id);
      return current();
    },
    closed = 0;
  const panel = new KeyNoteContext(dialog, {
    open: (...args) => open(...args),
    flush: () => flush(),
    beforeClose: () => beforeClose(),
    closed: async () => {
      closed++;
      await closedAction();
    },
    focusKey: () => el('key-gm-notes').focus(),
    tell: (text, error) => messages.push({ text, error }),
  });
  t.after(() => {
    panel.reset();
    globalThis.document = previous;
  });
  return {
    panel,
    el,
    dialog,
    home,
    original,
    ids,
    messages,
    opens,
    focused: () => focus,
    closed: () => closed,
    setOpen: (f) => (open = f),
    setFlush: (f) => (flush = f),
    setBeforeClose: (f) => (beforeClose = f),
    setClosed: (f) => (closedAction = f),
  };
}

test('context reuses the existing note controls and returns them intact after close', async (t) => {
  const x = fixture(t);
  let events = 0;
  x.el('note-gm').addEventListener('input', () => events++);
  x.el('note-gm').value = 'Offene Notizeingabe';
  await x.panel.open('nera', 'Nera', () => true);
  assert.equal(x.panel.ownsEditor, true);
  for (const [i, id] of x.ids.entries()) {
    assert.equal(x.el(id), x.original[i]);
    assert(x.el('key-reference-panel').contains(x.el(id)));
  }
  assert.equal(x.el('note-back').hidden, true);
  x.el('note-gm').value = 'Ergänztes Motiv';
  x.el('note-gm').dispatchEvent(new (x.el('note-gm').ownerDocument.defaultView.Event)('input'));
  x.el('key-reference-return').onclick();
  await until(() => !x.panel.active);
  assert.equal(x.closed(), 1);
  assert.equal(x.panel.ownsEditor, false);
  assert.equal(x.focused(), 'key-gm-notes');
  assert.equal(x.el('note-gm').value, 'Ergänztes Motiv');
  assert.equal(events, 1);
  assert.equal(x.el('note-back').hidden, false);
  for (const [i, id] of x.ids.entries()) {
    assert.equal(x.el(id), x.original[i]);
    assert(x.home.contains(x.el(id)));
  }
});

test('a failed or composing note flush keeps the panel and editor available', async (t) => {
  const x = fixture(t);
  await x.panel.open('nera', 'Nera', () => true);
  x.setBeforeClose(async () => false);
  x.el('key-reference-return').onclick();
  await until(() => !x.el('key-reference-return').disabled);
  assert.equal(x.panel.active, true);
  assert(x.el('key-reference-panel').contains(x.el('note-editor')));
  assert.equal(x.closed(), 0);
  x.setFlush(async () => false);
  assert.equal(await x.panel.flush(), false);
});

test('late open completion cannot expose the editor or focus over a newer target', async (t) => {
  const x = fixture(t),
    a = deferred(),
    b = deferred();
  x.setOpen((id) => (id === 'a' ? a.promise : b.promise));
  const old = x.panel.open('a', 'Alte Notiz', () => true);
  assert.equal(x.panel.ownsEditor, false);
  x.panel.reset();
  const current = x.panel.open('b', 'Neue Notiz', () => true);
  a.resolve(true);
  await old;
  assert.equal(x.el('key-reference-heading').textContent, 'Neue Notiz');
  assert.equal(x.el('note-editor').parentElement.hidden, true);
  assert.equal(x.focused(), null);
  b.resolve(true);
  await current;
  assert.equal(x.panel.ownsEditor, true);
  assert.equal(x.el('note-editor').parentElement.hidden, false);
  assert.equal(x.focused(), 'note-editor');
});

test('a retired close cannot dismiss a reopened context', async (t) => {
  const x = fixture(t),
    closing = deferred();
  await x.panel.open('a', 'Alt', () => true);
  x.setBeforeClose(() => closing.promise);
  x.el('key-reference-return').onclick();
  await tick();
  x.panel.reset();
  await x.panel.open('b', 'Neu', () => true);
  closing.resolve(true);
  await tick();
  assert.equal(x.panel.active, true);
  assert.equal(x.el('key-reference-heading').textContent, 'Neu');
  assert.equal(x.closed(), 0);
});

test('an unavailable target does not display the previous note as its contents', async (t) => {
  const x = fixture(t);
  x.el('note-gm').value = 'Vorige Notiz';
  x.setOpen(async () => false);
  await x.panel.open('missing', 'Fehlender Verweis', () => true);
  assert.equal(x.panel.ownsEditor, false);
  assert.equal(x.el('note-editor').parentElement.hidden, true);
  assert.match(x.el('key-reference-status').textContent, /Verknüpfung bleibt erhalten/);
  assert.equal(x.el('key-reference-status').dataset.error, 'true');
});

test('closing the outer dialog restores Preparation controls and invalidates pending reads', async (t) => {
  const x = fixture(t),
    loading = deferred();
  x.setOpen(() => loading.promise);
  const opening = x.panel.open('nera', 'Nera', () => true);
  x.dialog.removeAttribute('open');
  x.dialog.dispatchEvent(new x.dialog.ownerDocument.defaultView.Event('close'));
  loading.resolve(true);
  await opening;
  assert.equal(x.panel.active, false);
  assert.equal(x.focused(), null);
  for (const id of x.ids) assert(x.home.contains(x.el(id)));
});

test('a delayed return refresh cannot steal focus from a newly opened note', async (t) => {
  const x = fixture(t),
    refresh = deferred();
  await x.panel.open('a', 'Alt', () => true);
  x.setClosed(() => refresh.promise);
  x.el('key-reference-return').onclick();
  await until(() => x.closed() === 1);
  await x.panel.open('b', 'Neu', () => true);
  refresh.resolve();
  await tick();
  assert.equal(x.focused(), 'note-editor');
  assert.equal(x.panel.active, true);
  assert.equal(x.el('key-reference-heading').textContent, 'Neu');
});

test('an old flush waiting for a read cannot flush the replacement context', async (t) => {
  const x = fixture(t),
    read = deferred();
  let writes = 0;
  x.setFlush(async () => {
    writes++;
    return true;
  });
  x.setOpen(() => read.promise);
  const opening = x.panel.open('a', 'Alt', () => true),
    flushing = x.panel.flush();
  x.panel.reset();
  x.setOpen(async () => true);
  await x.panel.open('b', 'Neu', () => true);
  read.resolve(true);
  await opening;
  assert.equal(await flushing, false);
  assert.equal(writes, 0);
  assert.equal(x.panel.active, true);
});

// A nested notebook can borrow the same editor without retiring the room panel.
// Its navigation must use its own return route rather than the panel's origin.
test('a room panel cannot claim an editor currently borrowed by another host', async (t) => {
  const x = fixture(t);
  await x.panel.open('nera', 'Nera', () => true);
  assert.equal(x.panel.ownsEditor, true);
  const notebook = document.createElement('section');
  document.body.append(notebook);
  notebook.append(x.el('note-editor'));
  assert.equal(x.panel.active, true);
  assert.equal(x.panel.ownsEditor, false);
});

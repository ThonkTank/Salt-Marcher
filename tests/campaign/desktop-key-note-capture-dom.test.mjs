import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from '../helpers/dom.mjs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { randomUUID } from 'node:crypto';
buildSync({
  entryPoints: ['src/app/campaign/key-note-capture.ts'],
  outfile: '.build/capture-test-dom.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { KeyNoteCapture } = createRequire(import.meta.url)('../../.build/capture-test-dom.cjs'),
  tick = () => new Promise((r) => setImmediate(r));
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
      '<html><body><textarea id="room-text"></textarea></body></html>',
    ),
    prior = globalThis.document;
  globalThis.document = document;
  let focused = null;
  window.HTMLElement.prototype.focus = function () {
    focused = this.id;
  };
  window.HTMLElement.prototype.select = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const el = (id) => document.getElementById(id),
    calls = [],
    opened = [],
    messages = [];
  let roomUses = async () => ({ ok: true, value: { entries: [], next: null } });
  let choices = async () => ({ ok: true, value: { entries: [], more: false } });
  let valid = true,
    read = async () => ({ ok: true, value: { outcome: 'not-applied' } }),
    write = async (c) => ({ ok: true, value: { noteId: c.note.id } }),
    reveal = async (c, current) => {
      if (current()) opened.push(c.note.id);
    },
    prepare = async () => source;
  const source = {
    token: 'token-a',
    campaignId: randomUUID(),
    room: { id: randomUUID(), expectedRevision: 3, keyRevision: 2 },
    title: 'Archiv',
    current: () => valid,
  };
  const ui = new KeyNoteCapture({
      roomUses: (...args) => roomUses(...args),
      api: {
        keyNoteChoices: (...args) => choices(...args),
        captureKeyNote: async (c) => {
          calls.push(structuredClone(c));
          return write(c);
        },
        keyNoteCaptureStatus: (...args) => read(...args),
      },
      prepare: () => prepare(),
      opened: (...args) => reveal(...args),
      focusKey: () => el('room-text').focus(),
      tell: (text) => messages.push(text),
    }),
    dialog = el('key-note-capture-dialog');
  Object.defineProperty(el('key-note-kind'), 'value', {
    get() {
      return (
        this.querySelector('option[selected]')?.value ?? this.querySelector('option')?.value ?? ''
      );
    },
    set(v) {
      for (const o of this.querySelectorAll('option')) o.toggleAttribute('selected', o.value === v);
    },
  });
  Object.defineProperty(dialog, 'open', {
    get() {
      return dialog.hasAttribute('open');
    },
  });
  dialog.showModal = () => dialog.setAttribute('open', '');
  dialog.close = () => dialog.removeAttribute('open');
  el('key-note-title').form;
  dialog.querySelector('form').reportValidity = () => !!el('key-note-title').value;
  const submit = () => dialog.querySelector('form').onsubmit({ preventDefault() {} });
  t.after(() => {
    ui.reset();
    globalThis.document = prior;
  });
  return {
    ui,
    el,
    dialog,
    calls,
    opened,
    messages,
    source,
    submit,
    focused: () => focused,
    setRoomUses: (f) => (roomUses = f),
    setChoices: (f) => (choices = f),
    setValid: (v) => (valid = v),
    setRead: (f) => (read = f),
    setWrite: (f) => (write = f),
    setReveal: (f) => (reveal = f),
    setPrepare: (f) => (prepare = f),
  };
}
test('selected source text is a capture starting point and the ordinary note editor opens after one save', async (t) => {
  const x = fixture(t);
  await x.ui.open('  Die Listen\nGM-Text bleibt  ');
  assert.equal(x.el('key-note-gm').value, '  Die Listen\nGM-Text bleibt  ');
  assert.equal(x.el('key-note-title').value, 'Die Listen');
  x.el('key-note-title').value = 'Die flüsternden Listen';
  x.el('key-note-kind').value = 'rumor';
  x.submit();
  await until(() => x.opened.length === 1);
  assert.equal(x.calls.length, 1);
  assert.equal(x.calls[0].note.title, 'Die flüsternden Listen');
  assert.equal(x.calls[0].note.gmNotes, '  Die Listen\nGM-Text bleibt  ');
  assert.deepEqual(x.calls[0].room, x.source.room);
  assert.equal(x.dialog.open, false);
});
test('a pending capture does not allow duplicate submission or cancel its retained input', async (t) => {
  const x = fixture(t),
    wait = deferred();
  x.setWrite(() => wait.promise);
  await x.ui.open('Hinweis');
  x.submit();
  x.submit();
  await until(() => x.calls.length === 1);
  x.el('key-note-cancel').onclick();
  await tick();
  assert.equal(x.calls.length, 1);
  assert.equal(x.dialog.open, true);
  wait.resolve({ ok: true, value: { noteId: x.calls[0].note.id } });
  await until(() => x.opened.length === 1);
});
test('lost acknowledgement is checked explicitly, then only the saved note is opened', async (t) => {
  const x = fixture(t);
  x.setWrite(async () => {
    throw Error('Antwort weg');
  });
  await x.ui.open('  Behalten  ');
  x.submit();
  await until(
    () => !x.el('key-note-status-check').hidden && !x.el('key-note-status-check').disabled,
  );
  assert.equal(x.calls.length, 1);
  assert.equal(x.el('key-note-gm').readOnly, true);
  assert.equal(x.el('key-note-gm').disabled, false);
  x.el('key-note-cancel').onclick();
  assert.equal(x.dialog.open, true);
  x.setRead(async () => ({
    ok: true,
    value: { outcome: 'applied', noteId: x.calls[0].note.id, targetChanged: false },
  }));
  x.el('key-note-status-check').onclick();
  await until(() => !x.el('key-note-submit').disabled);
  assert.equal(x.calls.length, 1);
  x.submit();
  await until(() => x.opened.length === 1);
  assert.equal(x.calls.length, 1);
});
test('not-applied status permits editing and a fresh explicit submission, without automatic retry', async (t) => {
  const x = fixture(t);
  x.setWrite(async () => ({ ok: false, error: 'Nicht bestätigt' }));
  await x.ui.open('Original');
  x.submit();
  await until(
    () => !x.el('key-note-status-check').hidden && !x.el('key-note-status-check').disabled,
  );
  x.el('key-note-status-check').onclick();
  await until(() => !x.el('key-note-submit').disabled);
  assert.equal(x.calls.length, 1);
  assert.equal(x.el('key-note-gm').readOnly, false);
  x.el('key-note-gm').value = 'Bewusst geändert';
  x.setWrite(async (c) => ({ ok: true, value: { noteId: c.note.id } }));
  x.submit();
  await until(() => x.opened.length === 1);
  assert.equal(x.calls.length, 2);
  assert.notEqual(x.calls[0].commandId, x.calls[1].commandId);
  assert.equal(x.calls[1].note.gmNotes, 'Bewusst geändert');
});
test('conflict status keeps selectable text and allows explicit discard without another write', async (t) => {
  const x = fixture(t);
  x.setWrite(async () => {
    throw Error('Konflikt');
  });
  x.setRead(async () => ({ ok: true, value: { outcome: 'conflict' } }));
  await x.ui.open('Text zum Sichern');
  x.submit();
  await until(
    () => !x.el('key-note-status-check').hidden && !x.el('key-note-status-check').disabled,
  );
  x.el('key-note-status-check').onclick();
  await until(() => x.el('key-note-cancel').textContent === 'Eingabe verwerfen');
  assert.equal(x.el('key-note-gm').readOnly, true);
  assert.equal(x.el('key-note-gm').disabled, false);
  assert.equal(x.el('key-note-submit').disabled, true);
  x.el('key-note-cancel').onclick();
  assert.equal(x.ui.active, false);
  assert.equal(x.calls.length, 1);
});
test('a retired preparation or commit response cannot open over a newer room', async (t) => {
  const x = fixture(t),
    prep = deferred();
  x.setPrepare(() => prep.promise);
  const opening = x.ui.open('Alt');
  x.ui.reset();
  prep.resolve(x.source);
  await opening;
  assert.equal(x.ui.active, false);
  const commit = deferred();
  x.setPrepare(async () => x.source);
  x.setWrite(() => commit.promise);
  await x.ui.open('Alt');
  x.submit();
  await until(() => x.calls.length === 1);
  x.ui.reset();
  await x.ui.open('Neu');
  commit.resolve({ ok: true, value: { noteId: x.calls[0].note.id } });
  await tick();
  assert.equal(x.opened.length, 0);
  assert.equal(x.el('key-note-gm').value, 'Neu');
  assert.equal(x.ui.active, true);
});
test('composition guards both Enter submission and cancel until the input is finished', async (t) => {
  const x = fixture(t);
  await x.ui.open('Unfertig');
  x.el('key-note-gm').dispatchEvent(
    new x.dialog.ownerDocument.defaultView.Event('compositionstart', { bubbles: true }),
  );
  x.submit();
  x.el('key-note-cancel').onclick();
  assert.equal(x.calls.length, 0);
  assert.equal(x.ui.active, true);
  x.el('key-note-gm').dispatchEvent(
    new x.dialog.ownerDocument.defaultView.Event('compositionend', { bubbles: true }),
  );
  x.submit();
  await until(() => x.opened.length === 1);
});
test('a post-commit display failure can retry opening but never creates the note twice', async (t) => {
  const x = fixture(t);
  x.setReveal(async () => {
    throw Error('Anzeige nicht verfügbar');
  });
  await x.ui.open('Neue Spur');
  x.submit();
  await until(() => x.el('key-note-capture-status').textContent.includes('Anzeige konnte'));
  assert.equal(x.calls.length, 1);
  assert.equal(x.dialog.open, true);
  x.setReveal(async (c) => x.opened.push(c.note.id));
  x.submit();
  await until(() => x.opened.length === 1);
  assert.equal(x.calls.length, 1);
});
test('status read failures keep the command, raw text and explicit recovery controls', async (t) => {
  const x = fixture(t);
  x.setWrite(async () => {
    throw Error('Kein Ergebnis');
  });
  x.setRead(async () => {
    throw Error('Offline');
  });
  await x.ui.open('  Rohtext\n ');
  x.submit();
  await until(
    () => !x.el('key-note-status-check').hidden && !x.el('key-note-status-check').disabled,
  );
  x.el('key-note-status-check').onclick();
  await until(() => x.el('key-note-capture-status').textContent.includes('Offline'));
  assert.equal(x.el('key-note-gm').value, '  Rohtext\n ');
  assert.equal(x.el('key-note-submit').disabled, true);
  assert.equal(x.calls.length, 1);
});
test('cancel before submitting creates nothing and returns keyboard focus to the room', async (t) => {
  const x = fixture(t);
  await x.ui.open('');
  x.el('key-note-title').value = 'Nicht anlegen';
  x.el('key-note-cancel').onclick();
  assert.equal(x.calls.length, 0);
  assert.equal(x.ui.active, false);
  assert.equal(x.focused(), 'room-text');
});
const candidate = (title = 'Nera', id = randomUUID()) => ({
  id,
  title,
  kind: 'npc',
  revision: 7,
  preview: 'Bisheriger GM-Text mit Messingschlüssel.',
});
test('an exact existing name requires an explicit identity choice and preserves the supplement', async (t) => {
  const x = fixture(t),
    n = candidate();
  x.setChoices(async () => ({ ok: true, value: { entries: [n], more: false } }));
  await x.ui.open('Nera');
  x.el('key-note-gm').value = '  Neue Spur\n ';
  x.submit();
  await until(() => x.el('key-note-capture-status').textContent.includes('Diesen Namen'));
  assert.equal(x.calls.length, 0);
  x.el('key-note-existing').querySelector('button').onclick();
  assert.equal(x.el('key-note-kind').value, 'npc');
  assert.equal(x.el('key-note-title').readOnly, true);
  assert.equal(x.el('key-note-submit').textContent, 'Verknüpfen und ergänzen');
  x.submit();
  await until(() => x.opened.length === 1);
  assert.equal(x.calls[0].note.id, n.id);
  assert.equal(x.calls[0].reuseRevision, 7);
  assert.equal(x.calls[0].note.gmNotes, '  Neue Spur\n ');
});
test('an explicit separate new note keeps a new identity even with the same title', async (t) => {
  const x = fixture(t),
    n = candidate();
  x.setChoices(async () => ({ ok: true, value: { entries: [n], more: false } }));
  await x.ui.open('Nera');
  await until(() => x.el('key-note-existing').children.length === 1);
  x.el('key-note-new').onclick();
  x.submit();
  await until(() => x.opened.length === 1);
  assert.notEqual(x.calls[0].note.id, n.id);
  assert.equal(x.calls[0].allowSameTitle, true);
  assert.equal(x.calls[0].reuseRevision, undefined);
});
test('late search results cannot replace a newer title or submit it without checking', async (t) => {
  const x = fixture(t),
    wait = deferred(),
    old = candidate();
  x.setChoices(async (_, q) =>
    q === 'Nera' ? wait.promise : { ok: true, value: { entries: [], more: false } },
  );
  await x.ui.open('Nera');
  x.el('key-note-title').value = 'Andere';
  x.el('key-note-title').oninput();
  await tick();
  wait.resolve({ ok: true, value: { entries: [old], more: false } });
  await tick();
  assert.equal(x.el('key-note-existing').children.length, 0);
  x.submit();
  await until(() => x.opened.length === 1);
  assert.equal(x.calls[0].note.title, 'Andere');
});
test('a failed lookup retains all input and cannot silently create a duplicate', async (t) => {
  const x = fixture(t);
  x.setChoices(async () => {
    throw Error('Suche offline');
  });
  await x.ui.open('Nera');
  x.submit();
  await until(() => x.el('key-note-capture-status').textContent.includes('erfolgreich prüfen'));
  assert.equal(x.calls.length, 0);
  assert.equal(x.el('key-note-gm').value, 'Nera');
  assert.equal(x.ui.active, true);
});
test('uncertain reuse locks identity selection and checks the original immutable append command', async (t) => {
  const x = fixture(t),
    n = candidate();
  x.setChoices(async () => ({ ok: true, value: { entries: [n], more: false } }));
  x.setWrite(async () => {
    throw Error('Antwort weg');
  });
  await x.ui.open('Nera');
  await until(() => x.el('key-note-existing').children.length === 1);
  x.el('key-note-existing').querySelector('button').onclick();
  x.submit();
  await until(
    () => !x.el('key-note-status-check').hidden && !x.el('key-note-status-check').disabled,
  );
  x.el('key-note-new').onclick();
  assert.equal(x.el('key-note-title').readOnly, true);
  let checked;
  x.setRead(async (c) => {
    checked = c;
    return { ok: true, value: { outcome: 'applied', noteId: n.id, targetChanged: false } };
  });
  x.el('key-note-status-check').onclick();
  await until(() => !x.el('key-note-submit').disabled);
  assert.deepEqual(checked, x.calls[0]);
  x.submit();
  await until(() => x.opened.length === 1);
  assert.equal(x.calls.length, 1);
});
test('room context follows the selected identity, ignoring a late reply for the previous choice', async (t) => {
  const x = fixture(t),
    a = candidate(),
    b = candidate('Nera die Andere'),
    wait = deferred();
  x.setChoices(async () => ({ ok: true, value: { entries: [a, b], more: false } }));
  x.setRoomUses(async (_, id) =>
    id === a.id
      ? wait.promise
      : { ok: true, value: { entries: [{ title: 'Archiv', number: '2' }], next: null } },
  );
  await x.ui.open('Nera');
  await until(() => x.el('key-note-existing').children.length === 2);
  const buttons = x.el('key-note-existing').querySelectorAll('button');
  buttons[0].onclick();
  buttons[1].onclick();
  await until(() => x.el('key-note-selected-uses').textContent.includes('Archiv'));
  wait.resolve({
    ok: true,
    value: { entries: [{ title: 'Falscher alter Raum', number: '9' }], next: null },
  });
  await tick();
  assert.match(x.el('key-note-selected-uses').textContent, /Archiv/);
  assert.doesNotMatch(x.el('key-note-selected-uses').textContent, /Falscher/);
  assert.equal(x.el('key-note-title').value, b.title);
});

test('room decisions start as general notes and retain literal source text through the existing writer', async (t) => {
  const x = fixture(t),
    raw = '  Entscheidung am Schrank\r\nNicht als Gerücht behandeln.  ';
  await x.ui.open(raw);
  assert.equal(x.el('key-note-kind').value, 'note');
  x.el('key-note-title').value = 'Abmachung am Schrank';
  x.submit();
  await until(() => x.opened.length === 1);
  assert.equal(x.calls[0].note.kind, 'note');
  assert.equal(x.calls[0].note.gmNotes, raw);
  assert.deepEqual(x.calls[0].room, x.source.room);
});
test('an existing general note keeps its type when reused from the room capture', async (t) => {
  const x = fixture(t),
    n = { ...candidate('Abmachung am Schrank'), kind: 'note' };
  x.setChoices(async () => ({ ok: true, value: { entries: [n], more: false } }));
  await x.ui.open(n.title);
  await until(() => x.el('key-note-existing').children.length === 1);
  x.el('key-note-existing').querySelector('button').onclick();
  assert.equal(x.el('key-note-kind').value, 'note');
  assert.equal(x.el('key-note-kind').disabled, true);
  x.el('key-note-gm').value = '';
  x.submit();
  await until(() => x.opened.length === 1);
  assert.equal(x.calls[0].note.id, n.id);
  assert.equal(x.calls[0].note.kind, 'note');
  assert.equal(x.calls[0].reuseRevision, n.revision);
  assert.equal(x.calls[0].note.gmNotes, '');
});
test('choosing a separate note from an existing rule returns to the neutral note type', async (t) => {
  const x = fixture(t),
    n = { ...candidate('Abmachung am Schrank'), kind: 'rule' };
  x.setChoices(async () => ({ ok: true, value: { entries: [n], more: false } }));
  await x.ui.open(n.title);
  await until(() => x.el('key-note-existing').children.length === 1);
  x.el('key-note-existing').querySelector('button').onclick();
  assert.equal(x.el('key-note-kind').value, 'rule');
  x.el('key-note-new').onclick();
  assert.equal(x.el('key-note-kind').value, 'note');
  x.submit();
  await until(() => x.opened.length === 1);
  assert.equal(x.calls[0].note.kind, 'note');
  assert.notEqual(x.calls[0].note.id, n.id);
  assert.equal(x.calls[0].allowSameTitle, true);
  assert.equal(x.calls[0].reuseRevision, undefined);
});

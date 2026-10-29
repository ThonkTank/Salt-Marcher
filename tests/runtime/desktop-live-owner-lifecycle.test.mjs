import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
import { readWorkspaceMarkup } from '../../tools/desktop-markup.mjs';

buildSync({
  stdin: {
    contents: `export {createLiveRecapEditor} from './src/app/runtime/live-recap-editor';
      export {createLiveKnowledgeUI} from './src/app/runtime/live-knowledge-ui';
      export {createLivePartyMoveEditor} from './src/app/runtime/live-party-move-editor';
      export {EditorSession} from './src/app/shared/editor-session';`,
    resolveDir: process.cwd(),
  },
  outfile: '.build/live-owner-lifecycle.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url);
const {
  createLiveRecapEditor,
  createLiveKnowledgeUI,
  createLivePartyMoveEditor,
  EditorSession,
} = require('../../.build/live-owner-lifecycle.cjs');
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
};
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const fields = [
  'live-session-summary',
  'live-session-handoff',
  'live-session-close-summary',
  'live-session-close-handoff',
];
function recap(keep, live = async () => ({ ok: true, value: {} })) {
  const { document } = parseHTML(
    '<html><body>' +
      fields.map((id) => `<textarea id="${id}"></textarea>`).join('') +
      '<dialog id="live-session-close-dialog"></dialog><p id="live-session-draft-status"></p><p id="live-session-close-draft-status"></p></body></html>',
  );
  const session = new EditorSession();
  const context = { token: 'token', campaign: { id: 'same-campaign' } };
  const get = (id) => document.getElementById(id);
  const editor = createLiveRecapEditor({
    context,
    get,
    value: (id) => get(id).value,
    editorSession: session,
    blocked: false,
    renderLiveSession() {},
    equal: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    unwrap: (result) => {
      if (!result.ok) throw Error(result.error);
      return result.value;
    },
    window: {
      confirm: () => true,
      campaign: { keepSessionRecapDraft: keep, live },
    },
  });
  editor.accept({ recapDraft: null });
  return { editor, session, get };
}

test('separate recap owners retain literal input and drain an accepted write after detaching', async () => {
  const held = deferred(),
    writes = [];
  const a = recap(async (_token, text) => {
    writes.push({ ...text });
    if (writes.length === 1) await held.promise;
    return { ok: true, value: null };
  });
  const b = recap(async () => ({ ok: true, value: null }));
  a.get('live-session-summary').value = 'First\r\nline';
  a.editor.queueRecapSave();
  a.get('live-session-summary').value = 'Later\r\nline';
  a.editor.queueRecapSave();
  b.get('live-session-summary').value = 'Other instance';
  b.editor.queueRecapSave();
  await b.editor.flush();
  assert.equal(a.session.status.saving, true);
  const label = a.get('live-session-draft-status').textContent;
  a.session.deactivate();
  let drained = false;
  const drain = a.session.settle().then(() => (drained = true));
  await settle();
  assert.equal(drained, false);
  held.resolve();
  await drain;
  assert.deepEqual(
    writes.map((w) => w.summary),
    ['First\r\nline', 'Later\r\nline'],
  );
  assert.equal(
    a.get('live-session-draft-status').textContent,
    label,
    'detached completion must not publish UI',
  );
  assert.equal(b.get('live-session-summary').value, 'Other instance');
  assert.equal(await a.editor.flush(), true);
});

test('a failed recap flush retains raw input and does not approve navigation', async () => {
  const a = recap(async () => ({ ok: false, error: 'storage offline' }));
  a.get('live-session-summary').value = '  Unfinished\r\nrecap  ';
  a.editor.queueRecapSave();
  assert.equal(await a.editor.flush(), false);
  assert.equal(a.get('live-session-summary').value, '  Unfinished\r\nrecap  ');
  assert.match(a.get('live-session-draft-status').textContent, /nicht gesichert/);
});

test('a lost recap acknowledgement is read back once and later literal input uses its confirmed basis', async () => {
  const held = deferred(),
    writes = [];
  let saved = null,
    reads = 0;
  const a = recap(
    async (_token, text, basis) => {
      writes.push({ text: { ...text }, basis });
      assert.deepEqual(basis, saved);
      saved = { ...text };
      if (writes.length === 1) {
        await held.promise;
        throw Error('Antwort verloren');
      }
      return { ok: true, value: null };
    },
    async () => {
      reads++;
      return { ok: true, value: { recapDraft: saved } };
    },
  );
  a.get('live-session-summary').value = '  Gesendet\r\n';
  a.editor.queueRecapSave();
  await settle();
  a.get('live-session-summary').value = '  Später\r\n[[Tor]]  ';
  a.editor.queueRecapSave();
  held.resolve();
  assert.equal(await a.editor.flush(), true);
  assert.equal(reads, 1);
  assert.deepEqual(
    writes.map((w) => w.text.summary),
    ['  Gesendet\r\n', '  Später\r\n[[Tor]]  '],
  );
  assert.deepEqual(saved, { summary: '  Später\r\n[[Tor]]  ', handoff: '' });
  assert.equal(a.get('live-session-summary').value, saved.summary);
});

function knowledge(load) {
  const { document } = parseHTML(
    '<html><body><input id="live-knowledge-search"><p id="live-knowledge-result"></p><div id="live-knowledge-results"></div></body></html>',
  );
  const get = (id) => document.getElementById(id);
  const editor = createLiveKnowledgeUI({
    context: { token: 'same-token' },
    data: { roster: [] },
    sources: {
      locations: [],
      notes: [
        {
          trashed: false,
          note: { id: 'quest', kind: 'quest', title: 'Quest', readAloud: '', gmNotes: '' },
        },
      ],
    },
    get,
    document,
    value: (id) => get(id).value,
    window: { campaign: { narrative: load } },
    liveSourcesProblem: '',
    preparedNoteIds: new Set(),
    useKnowledgeReadAloud() {},
    showLiveNpc: async () => true,
    openKnowledgeNote: async () => {},
  });
  return { editor, get };
}
const narrative = (status) => ({
  ok: true,
  value: { state: { status, locationId: null, contributors: [], poolXp: 0 }, award: null },
});
test('knowledge owners isolate matching IDs and discard the previous generation while a newer read is pending', async () => {
  const old = deferred(),
    newer = deferred();
  let calls = 0;
  const a = knowledge(() => (++calls === 1 ? old.promise : newer.promise));
  const b = knowledge(async () => narrative('closed'));
  a.editor.renderLiveKnowledge();
  b.editor.renderLiveKnowledge();
  await settle();
  assert.match(b.get('live-knowledge-results').textContent, /Abgeschlossen/);
  a.editor.reset();
  a.editor.renderLiveKnowledge();
  old.resolve(narrative('closed'));
  await settle();
  assert.match(a.get('live-knowledge-results').textContent, /wird geladen/);
  assert.equal(calls, 2, 'old completion must not release the newer read slot');
  newer.resolve(narrative('open'));
  await settle();
  assert.match(a.get('live-knowledge-results').textContent, /Offen/);
  assert.match(b.get('live-knowledge-results').textContent, /Abgeschlossen/);
});

function partyMove(send = async () => ({})) {
  const { document, window } = parseHTML(readWorkspaceMarkup()),
    session = new EditorSession();
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
  window.HTMLElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  window.HTMLElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  const get = (id) => document.getElementById(id),
    messages = [],
    actions = [];
  let valid = true,
    blocked = false;
  const editor = createLivePartyMoveEditor({
    document,
    get,
    session,
    blocked: () => blocked,
    writing: () => false,
    execute: (action) =>
      session.run(async () => {
        actions.push(action);
        return send(action);
      }),
    formatInstant: (value) => 'Zeit ' + value,
    feedback: (...args) => messages.push(args),
  });
  editor.init();
  const snapshot = {
    token: 'same-token',
    rosterRevision: 3,
    focusRevision: 4,
    source: {
      id: 'A',
      label: 'Gruppe A',
      contentRevision: 5,
      membershipRevision: 6,
      clockRevision: 7,
      instantMs: '1000',
      members: [
        { id: 'one', name: 'Arin' },
        { id: 'two', name: 'Bera' },
      ],
    },
    targets: [
      { id: 'B', label: 'Gruppe B', membershipRevision: 8, clockRevision: 9, instantMs: '2000' },
    ],
  };
  const open = () => editor.open(snapshot, session.capture(), () => valid);
  const select = (id) => {
    const box = get('move-members').querySelector(`input[value="${id}"]`);
    box.checked = true;
    box.dispatchEvent(new window.Event('change'));
  };
  const title = (text) => {
    get('move-title').value = text;
    get('move-title').dispatchEvent(new window.Event('input'));
  };
  const target = (id) => {
    get('move-target').value = id;
    get('move-target').dispatchEvent(new window.Event('change'));
  };
  return {
    editor,
    session,
    snapshot,
    open,
    select,
    title,
    target,
    get,
    messages,
    actions,
    valid(value) {
      valid = value;
    },
    blocked(value) {
      blocked = value;
    },
  };
}
test('party move owns member choice and the complete source/target revision snapshot', async () => {
  const x = partyMove();
  x.open();
  x.select('one');
  x.target('B');
  x.snapshot.source.membershipRevision = 99;
  x.snapshot.targets[0].clockRevision = 99;
  assert.equal(await x.editor.submit(), true);
  assert.deepEqual(x.actions[0], {
    kind: 'move',
    sceneId: 'A',
    expectedRosterRevision: 3,
    expectedFocusRevision: 4,
    expectedSceneMembershipRevision: 6,
    expectedClockRevision: 7,
    memberIds: ['one'],
    target: {
      kind: 'existing',
      sceneId: 'B',
      expectedMembershipRevision: 8,
      expectedClockRevision: 9,
    },
  });
  assert.equal(x.get('move-dialog').hasAttribute('open'), false);
});
test('two party move owners isolate matching control IDs, raw group titles and member choices', async () => {
  const a = partyMove(),
    b = partyMove();
  a.open();
  b.open();
  a.select('one');
  b.select('two');
  a.title('  Eigene Gruppe\r\n');
  b.title('  Andere Gruppe\r\n');
  assert.equal(await a.editor.submit(), true);
  assert.equal(await b.editor.submit(), true);
  assert.deepEqual(a.actions[0].memberIds, ['one']);
  assert.deepEqual(b.actions[0].memberIds, ['two']);
  assert.equal(a.actions[0].target.title, '  Eigene Gruppe\r\n');
  assert.equal(b.actions[0].target.title, '  Andere Gruppe\r\n');
});
test('party move rejects A→B→A reopening and detached member controls', async () => {
  const x = partyMove();
  x.open();
  const old = x.get('move-members').querySelector('input');
  x.select('one');
  x.session.generation++;
  x.editor.reset();
  x.session.generation++;
  x.open();
  old.checked = true;
  old.onchange();
  assert.equal(await x.editor.submit(), false);
  assert.equal(x.actions.length, 0);
  assert.match(x.messages.at(-1)[0], /Wähle die Figuren/);
  x.select('two');
  x.valid(false);
  assert.equal(await x.editor.submit(), false);
  assert.equal(x.actions.length, 0);
  assert.match(x.messages.at(-1)[0], /Auswahl erneut öffnen/);
});
test('party move keeps an accepted write in the central close drain after detaching', async () => {
  const held = deferred(),
    x = partyMove(async () => {
      await held.promise;
      return {};
    });
  x.open();
  x.select('one');
  const pending = x.editor.submit();
  await settle();
  x.session.deactivate();
  let drained = false;
  const closing = x.session.settle().then(() => (drained = true));
  await settle();
  assert.equal(drained, false);
  held.resolve();
  assert.equal(await pending, true);
  await closing;
  assert.equal(x.actions.length, 1);
  assert.equal(x.get('move-dialog').hasAttribute('open'), false);
});
test('lost party move answer preserves the dialog until the original action is receipt-confirmed', async () => {
  const x = partyMove(async () => null);
  x.open();
  x.select('one');
  x.title('  Ungeklärt\r\n');
  assert.equal(await x.editor.submit(), false);
  assert.equal(x.actions.length, 1);
  assert.equal(x.get('move-dialog').hasAttribute('open'), true);
  x.editor.accepted({ ...x.actions[0] });
  assert.equal(
    x.get('move-dialog').hasAttribute('open'),
    true,
    'another action cannot close this opening',
  );
  x.editor.accepted(x.actions[0]);
  assert.equal(x.get('move-dialog').hasAttribute('open'), false);
  assert.equal(x.actions.length, 1);
});
test('not-applied party move keeps its choices and retries only by a new explicit submit', async () => {
  const x = partyMove(async () => null);
  x.open();
  x.select('two');
  x.title('  Unfertig\r\n');
  assert.equal(await x.editor.submit(), false);
  x.blocked(true);
  assert.equal(await x.editor.submit(), false);
  assert.equal(x.actions.length, 1);
  x.blocked(false);
  x.editor.busy(false);
  await settle();
  assert.equal(x.actions.length, 1);
  assert.equal(await x.editor.submit(), false);
  assert.equal(x.actions.length, 2);
  assert.notEqual(x.actions[0], x.actions[1]);
  assert.deepEqual(x.actions[1], x.actions[0]);
});

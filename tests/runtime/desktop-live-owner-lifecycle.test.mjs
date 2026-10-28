import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';

buildSync({
  stdin: {
    contents: `export {createLiveRecapEditor} from './src/app/runtime/live-recap-editor';
      export {createLiveKnowledgeUI} from './src/app/runtime/live-knowledge-ui';
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

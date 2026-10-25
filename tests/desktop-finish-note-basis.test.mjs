import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
import { parseHTML } from './helpers/dom.mjs';
const base = '.build/planner-finish-note',
  require = createRequire(import.meta.url);
mkdirSync(base, { recursive: true });
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: base + '/store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['src/app/finish-draft-ui.ts'],
  outfile: base + '/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
};
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'finish-note-')),
    file = path.join(root, 'store.sqlite'),
    { CampaignStore } = require('../' + base + '/store.cjs'),
    store = new CampaignStore(file),
    campaign = store.create('Quest'),
    w = store.activate(campaign.id),
    id = randomUUID();
  const x = { root, file, CampaignStore, store, campaign, w, id };
  x.command = (action) => ({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token: x.w.token,
    action,
  });
  x.note = {
    version: 1,
    id,
    revision: 1,
    kind: 'quest',
    title: 'Auftrag',
    readAloud: '',
    gmNotes: 'Original',
    relations: [],
    creatureId: null,
    deleted: false,
  };
  store.changePreparation({
    ...x.command(null),
    change: { kind: 'note', expectedRevision: null, note: x.note },
  });
  x.owner = () => ({
    kind: 'narrative',
    targetId: id,
    revision: 0,
    noteRevision: x.store.narrative(x.w.token, id).noteRevision,
  });
  x.change = () => {
    const n = x.store.preparation(x.w.token).notes.find((r) => r.note.id === id).note;
    x.store.changePreparation({
      ...x.command(null),
      change: { kind: 'note', expectedRevision: n.revision, note: { ...n, gmNotes: 'Änderung' } },
    });
  };
  x.draft = () => ({
    ...x.owner(),
    writeId: randomUUID(),
    outcome: '  Ergebnis\r\n',
    poolXp: '-',
    loadXp: '',
    noXp: true,
    hasLoot: false,
    recipientIds: [],
    items: [],
  });
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return x;
}
async function dom(t, x) {
  const { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8')),
    saved = {
      window: globalThis.window,
      document: globalThis.document,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    };
  Object.assign(globalThis, { window, document, setTimeout: () => 1, clearTimeout: () => {} });
  const wrap = (fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  window.campaign = {
    finishDraft: async (...a) => wrap(() => x.store.finishDraft(...a)),
    keepFinishDraft: async (...a) => wrap(() => x.store.keepFinishDraft(...a)),
    discardFinishDraft: async (...a) => wrap(() => x.store.discardFinishDraft(...a)),
  };
  delete require.cache[require.resolve('../' + base + '/ui.cjs')];
  const ui = require('../' + base + '/ui.cjs');
  let items = [];
  const z = {
    ui,
    el: (id) => document.getElementById(id),
    open: () =>
      ui.beginFinishDraft(
        x.w,
        x.owner(),
        () => items,
        (a) => {
          items = a;
        },
        () => {},
      ),
  };
  await z.open();
  t.after(async () => {
    await ui.resetFinishDraft();
    Object.assign(globalThis, saved);
  });
  return z;
}
test('Fresh keeps original finish note basis and rejects an award that supplies the newer note', async (t) => {
  const x = fixture(t),
    d = x.draft();
  x.store.keepFinishDraft(x.w.token, d, null);
  x.change();
  x.store.close();
  x.store = new x.CampaignStore(x.file);
  x.w = x.store.activate(x.campaign.id);
  assert.deepEqual(x.store.finishDraft(x.w.token, x.owner()), d);
  const before = x.store.db.serialize();
  assert.throws(() =>
    x.store.executeProgress(
      x.command({
        kind: 'narrative-award',
        noteId: x.id,
        expectedRevision: 0,
        expectedNoteRevision: 2,
        finishDraftWriteId: d.writeId,
        sceneId: null,
        poolXp: 0,
        noXp: true,
        recipients: [],
        items: [],
        outcome: 'Ergebnis',
      }),
    ),
  );
  assert.ok(x.store.db.serialize().equals(before));
});
test('reopened finish inputs keep their original basis until explicit review', async (t) => {
  const x = fixture(t),
    d = x.draft();
  x.store.keepFinishDraft(x.w.token, d, null);
  x.change();
  const z = await dom(t, x);
  assert.equal(z.el('finish-xp').value, '-');
  assert.equal(z.el('finish-draft-adopt').hidden, false);
  await assert.rejects(z.ui.finishDraftCommit());
  z.el('combat-outcome').value = '  Neue Eingabe\r\n';
  z.ui.markFinishDraft();
  await z.ui.flushFinishDraft();
  let saved = x.store.finishDraft(x.w.token, x.owner());
  assert.equal(saved.noteRevision, 1);
  assert.equal(saved.outcome, '  Neue Eingabe\r\n');
  z.el('finish-draft-adopt').click();
  await settle();
  const result = await z.ui.finishDraftCommit();
  assert.equal(result.noteRevision, 2);
  saved = x.store.finishDraft(x.w.token, x.owner());
  assert.equal(saved.noteRevision, 2);
  assert.equal(saved.poolXp, '-');
  assert.equal(saved.outcome, '  Neue Eingabe\r\n');
});
test('legacy finish basis remains unknown on read and ordinary edits; adoption is explicit', async (t) => {
  const x = fixture(t),
    d = x.draft();
  delete d.noteRevision;
  x.store.keepFinishDraft(x.w.token, d, null);
  const before = x.store.db.serialize();
  assert.deepEqual(x.store.finishDraft(x.w.token, x.owner()), d);
  assert.ok(x.store.db.serialize().equals(before));
  const z = await dom(t, x);
  await assert.rejects(z.ui.finishDraftCommit());
  z.el('finish-xp').value = '25';
  z.ui.markFinishDraft();
  await z.ui.flushFinishDraft();
  assert.equal(x.store.finishDraft(x.w.token, x.owner()).noteRevision, undefined);
  z.el('finish-draft-adopt').click();
  await settle();
  assert.equal((await z.ui.finishDraftCommit()).noteRevision, 1);
});
test('invalid explicit finish note bases are rejected without touching prior raw values', (t) => {
  const x = fixture(t),
    d = x.draft();
  x.store.keepFinishDraft(x.w.token, d, null);
  const before = x.store.db.serialize();
  for (const noteRevision of [0, -1, 1.5, '1', null, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() =>
      x.store.keepFinishDraft(x.w.token, { ...d, writeId: randomUUID(), noteRevision }, d.writeId),
    );
  assert.ok(x.store.db.serialize().equals(before));
});
test('independent copy remaps the finish target and keeps its original note basis', async (t) => {
  const x = fixture(t),
    d = x.draft();
  x.store.keepFinishDraft(x.w.token, d, null);
  x.change();
  const snapshot = path.join(x.root, 'snapshot.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const bytes = readFileSync(snapshot),
    copy = new x.CampaignStore(path.join(x.root, 'copy.sqlite'));
  try {
    const c = copy.acceptCampaignSnapshot(snapshot, 'Kopie', {}),
      w = copy.activate(c.id),
      row = copy.db.prepare('SELECT * FROM finish_draft').get(),
      raw = JSON.parse(row.payload);
    assert.notEqual(raw.targetId, x.id);
    assert.equal(raw.targetId, row.target_id);
    assert.equal(raw.noteRevision, 1);
    assert.equal(copy.narrative(w.token, raw.targetId).noteRevision, 2);
    assert.equal(raw.poolXp, '-');
    assert.equal(raw.outcome, d.outcome);
    assert.ok(readFileSync(snapshot).equals(bytes));
  } finally {
    copy.close();
  }
});

test('explicitly reviewed finish basis is consumed with its award and replay stays singular', async (t) => {
  const x = fixture(t),
    d = x.draft();
  x.store.keepFinishDraft(x.w.token, d, null);
  x.change();
  const reviewed = { ...d, noteRevision: 2, writeId: randomUUID() };
  x.store.keepFinishDraft(x.w.token, reviewed, d.writeId);
  const command = x.command({
    kind: 'narrative-award',
    noteId: x.id,
    expectedRevision: 0,
    expectedNoteRevision: 2,
    finishDraftWriteId: reviewed.writeId,
    sceneId: null,
    poolXp: 0,
    noXp: true,
    recipients: [],
    items: [],
    outcome: reviewed.outcome,
  });
  x.store.executeProgress(command);
  assert.equal(x.store.finishDraft(x.w.token, x.owner()), null);
  assert.equal(x.store.narrative(x.w.token, x.id).award.outcome, d.outcome);
  const before = x.store.db.serialize();
  x.store.executeProgress(command);
  assert.ok(x.store.db.serialize().equals(before));
});

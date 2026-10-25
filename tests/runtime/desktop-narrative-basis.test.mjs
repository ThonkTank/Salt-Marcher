import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
const base = '.build/planner-narrative-basis',
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
  entryPoints: ['src/app/runtime/narrative-ui.ts'],
  outfile: base + '/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
};
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'narrative-basis-')),
    file = path.join(root, 'campaign.sqlite'),
    { CampaignStore } = require('../../' + base + '/store.cjs'),
    store = new CampaignStore(file),
    campaign = store.create('Quest'),
    w = store.activate(campaign.id),
    id = randomUUID(),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    });
  const note = {
    version: 1,
    id,
    revision: 1,
    kind: 'quest',
    title: 'Torauftrag',
    readAloud: '  Original\r\n',
    gmNotes: 'Privat',
    relations: [],
    creatureId: null,
    deleted: false,
  };
  store.changePreparation({
    ...command(null),
    change: { kind: 'note', expectedRevision: null, note },
  });
  const x = { root, file, CampaignStore, store, campaign, w, id, note, command };
  x.changeNote = () => {
    const n = x.store.preparation(x.w.token).notes.find((n) => n.note.id === x.id).note;
    x.store.changePreparation({
      ...x.command(null),
      change: {
        kind: 'note',
        expectedRevision: n.revision,
        note: { ...n, gmNotes: 'Unabhängige Änderung' },
      },
    });
  };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return x;
}
function dom(t, x) {
  const { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8')),
    saved = {};
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    get() {
      return this._value ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this._value = v;
    },
    configurable: true,
  });
  for (const k of [
    'window',
    'document',
    'HTMLElement',
    'HTMLInputElement',
    'HTMLSelectElement',
    'HTMLTextAreaElement',
    'setTimeout',
    'clearTimeout',
  ])
    saved[k] = globalThis[k];
  for (const k of [
    'window',
    'document',
    'HTMLElement',
    'HTMLInputElement',
    'HTMLSelectElement',
    'HTMLTextAreaElement',
  ])
    globalThis[k] = k === 'window' ? window : window[k];
  globalThis.setTimeout = () => 1;
  globalThis.clearTimeout = () => {};
  const messages = [],
    commands = [],
    wrap = (fn) => {
      try {
        return { ok: true, value: fn() };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    };
  window.campaign = {
    narrative: async (token, id) => wrap(() => x.store.narrative(token, id)),
    progress: async (token) => wrap(() => x.store.progress(token)),
    ledgerParties: async (token) => wrap(() => x.store.ledgerParties(token)),
    keepNarrativeDraft: async (...a) => wrap(() => x.store.keepNarrativeDraft(...a)),
    discardNarrativeDraft: async (...a) => wrap(() => x.store.discardNarrativeDraft(...a)),
    executeProgress: async (c) => {
      commands.push(c);
      return wrap(() => x.store.executeProgress(c));
    },
  };
  delete require.cache[require.resolve('../../' + base + '/ui.cjs')];
  const ui = require('../../' + base + '/ui.cjs'),
    panel = document.getElementById('narrative-editor'),
    z = {
      ui,
      window,
      document,
      panel,
      messages,
      commands,
      show: () =>
        ui.showNarrative(
          x.w,
          x.store.preparation(x.w.token).notes.find((n) => n.note.id === x.id).note,
          false,
          async () => true,
          (text, error) => messages.push({ text, error }),
        ),
      pool: () => panel.querySelector('[aria-label="Quest-XP-Pool"]'),
      button: (text) => [...panel.querySelectorAll('button')].find((b) => b.textContent === text),
    };
  z.showWith = (source) =>
    ui.showNarrative(
      x.w,
      source,
      false,
      async () => true,
      (text, error) => messages.push({ text, error }),
    );
  z.enter = (v) => {
    z.pool().value = v;
    z.pool().oninput();
  };
  t.after(async () => {
    await ui.showNarrative(
      null,
      null,
      true,
      async () => true,
      () => {},
    );
    await settle();
    Object.assign(globalThis, saved);
  });
  return z;
}
const draft = (x) => ({
  noteId: x.id,
  writeId: randomUUID(),
  revision: 0,
  noteRevision: 1,
  status: 'open',
  locationId: null,
  contributors: [],
  poolXp: '-',
  items: [],
});
test('the real renderer cannot approve a newer note revision it did not display', async (t) => {
  const x = fixture(t),
    z = dom(t, x);
  await z.show();
  z.enter('25');
  x.changeNote();
  z.button('Narrative Angaben speichern').click();
  await settle();
  assert.equal(x.store.narrative(x.w.token, x.id).state.poolXp, 0);
  assert.equal(x.store.narrative(x.w.token, x.id).draft.noteRevision, 1);
  assert.equal(z.pool().value, '25');
  assert.ok(z.messages.some((m) => m.error));
  assert.ok(z.commands.every((c) => c.action.expectedNoteRevision === 1));
});
test('Fresh keeps the stale note basis and explicit review changes only that basis', async (t) => {
  const x = fixture(t);
  x.store.keepNarrativeDraft(x.w.token, draft(x), null);
  x.changeNote();
  x.store.close();
  x.store = new x.CampaignStore(x.file);
  x.w = x.store.activate(x.campaign.id);
  const z = dom(t, x);
  await z.show();
  assert.ok(z.button('Geprüften Entwurf auf aktuellen Stand übernehmen'));
  assert.equal(z.pool().value, '-');
  z.enter('25');
  z.button('Narrative Angaben speichern').click();
  await settle();
  assert.equal(x.store.narrative(x.w.token, x.id).state.poolXp, 0);
  z.button('Geprüften Entwurf auf aktuellen Stand übernehmen').click();
  await settle();
  assert.equal(await z.ui.flushNarrative(), true);
  const n = x.store.narrative(x.w.token, x.id);
  assert.equal(n.state.poolXp, 25);
  assert.equal(n.draft, null);
  assert.equal(n.noteRevision, 2);
});
test('legacy raw drafts remain byte-identical on read and require review before approval', async (t) => {
  const x = fixture(t),
    d = draft(x);
  delete d.noteRevision;
  x.store.keepNarrativeDraft(x.w.token, d, null);
  const row = x.store.db.prepare('SELECT payload,checksum FROM narrative_draft').get(),
    z = dom(t, x);
  await z.show();
  assert.ok(z.button('Geprüften Entwurf auf aktuellen Stand übernehmen'));
  assert.deepEqual(x.store.db.prepare('SELECT payload,checksum FROM narrative_draft').get(), row);
  z.enter('25');
  assert.equal(await z.ui.flushNarrative(), true);
  assert.equal(z.commands.length, 0);
  assert.equal(x.store.narrative(x.w.token, x.id).state.poolXp, 0);
});
test('the writer cannot consume a draft with another note basis even through a newer command', (t) => {
  const x = fixture(t),
    d = { ...draft(x), poolXp: '25' };
  x.store.keepNarrativeDraft(x.w.token, d, null);
  x.changeNote();
  const n = x.store.narrative(x.w.token, x.id),
    before = x.store.db.serialize();
  assert.throws(
    () =>
      x.store.executeProgress(
        x.command({
          kind: 'narrative-state',
          expectedRevision: n.state.revision,
          expectedNoteRevision: n.noteRevision,
          draftWriteId: d.writeId,
          state: { ...n.state, poolXp: 25 },
        }),
      ),
    /Basis|Entwurf|Notiz/,
  );
  assert.equal(x.store.db.serialize().equals(before), true);
  assert.throws(
    () =>
      x.store.executeProgress(
        x.command({
          kind: 'narrative-award',
          noteId: x.id,
          expectedRevision: n.state.revision,
          expectedNoteRevision: n.noteRevision,
          draftWriteId: d.writeId,
          sceneId: null,
          poolXp: 0,
          noXp: true,
          recipients: [],
          items: [],
          outcome: 'Nicht freigegeben',
        }),
      ),
    /Basis|Entwurf|Notiz/,
  );
  assert.equal(x.store.db.serialize().equals(before), true);
});
test('independent copy retains a drafts original note revision and its raw values', async (t) => {
  const x = fixture(t),
    d = draft(x);
  x.store.keepNarrativeDraft(x.w.token, d, null);
  x.changeNote();
  const snapshot = path.join(x.root, 'snapshot.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const bytes = readFileSync(snapshot),
    copy = new x.CampaignStore(path.join(x.root, 'copy.sqlite'));
  try {
    const c = copy.acceptCampaignSnapshot(snapshot, 'Kopie', {}),
      w = copy.activate(c.id),
      row = copy.db.prepare('SELECT * FROM narrative_draft WHERE campaign_id=?').get(c.id),
      n = copy.narrative(w.token, row.note_id);
    assert.notEqual(n.draft.noteId, x.id);
    assert.equal(n.draft.noteRevision, 1);
    assert.equal(n.noteRevision, 2);
    assert.equal(n.draft.poolXp, '-');
    assert.equal(readFileSync(snapshot).equals(bytes), true);
  } finally {
    copy.close();
  }
});

test('a stale supplied note cannot approve its unseen revision; refreshing retains the original raw basis', async (t) => {
  const x = fixture(t),
    z = dom(t, x),
    shown = structuredClone(x.note);
  x.changeNote();
  await z.showWith(shown);
  assert.equal(z.button('Geprüften Entwurf auf aktuellen Stand übernehmen').disabled, true);
  assert.equal(z.button('Manuell abschließen und Belohnung verteilen…').disabled, true);
  z.button('Manuell abschließen und Belohnung verteilen…').onclick();
  await settle();
  assert.equal(z.messages.filter((m) => m.error).length, 0);
  z.enter('25');
  z.button('Geprüften Entwurf auf aktuellen Stand übernehmen').onclick();
  await settle();
  assert.equal(x.store.narrative(x.w.token, x.id).state.poolXp, 0);
  await z.show();
  assert.equal(z.pool().value, '25');
  assert.equal(x.store.narrative(x.w.token, x.id).draft.noteRevision, 1);
  assert.equal(z.button('Geprüften Entwurf auf aktuellen Stand übernehmen').disabled, false);
  z.button('Geprüften Entwurf auf aktuellen Stand übernehmen').click();
  await settle();
  assert.equal(await z.ui.flushNarrative(), true);
  assert.equal(x.store.narrative(x.w.token, x.id).state.poolXp, 25);
});
test('a newer state command cannot consume a retained draft based on the prior status revision', (t) => {
  const x = fixture(t),
    d = { ...draft(x), poolXp: '25' },
    n = x.store.narrative(x.w.token, x.id);
  x.store.executeProgress(
    x.command({
      kind: 'narrative-state',
      state: { ...n.state, poolXp: 5 },
      expectedRevision: 0,
      expectedNoteRevision: 1,
    }),
  );
  x.store.keepNarrativeDraft(x.w.token, d, null);
  const latest = x.store.narrative(x.w.token, x.id),
    before = x.store.db.serialize();
  assert.throws(
    () =>
      x.store.executeProgress(
        x.command({
          kind: 'narrative-state',
          state: { ...latest.state, poolXp: 25 },
          expectedRevision: latest.state.revision,
          expectedNoteRevision: 1,
          draftWriteId: d.writeId,
        }),
      ),
    /Basis|Entwurf/,
  );
  assert.equal(x.store.db.serialize().equals(before), true);
});
test('invalid explicit note bases cannot enter draft storage', (t) => {
  const x = fixture(t),
    before = x.store.db.serialize();
  for (const noteRevision of [0, -1, 1.5, '1', null])
    assert.throws(
      () => x.store.keepNarrativeDraft(x.w.token, { ...draft(x), noteRevision }, null),
      /Eingabe/,
    );
  assert.equal(x.store.db.serialize().equals(before), true);
});

test('input made during draft persistence is retained rather than consumed by the older save intent', async (t) => {
  const x = fixture(t),
    z = dom(t, x);
  await z.show();
  const keep = z.window.campaign.keepNarrativeDraft;
  let release,
    once = true;
  z.window.campaign.keepNarrativeDraft = async (...args) => {
    const saved = await keep(...args);
    if (once) {
      once = false;
      return new Promise((r) => (release = () => r(saved)));
    }
    return saved;
  };
  z.enter('25');
  z.button('Narrative Angaben speichern').click();
  await settle();
  assert.equal(typeof release, 'function');
  z.enter('31');
  release();
  await settle();
  assert.equal(z.pool().value, '31');
  assert.equal(x.store.narrative(x.w.token, x.id).state.poolXp, 0);
  assert.equal(x.store.narrative(x.w.token, x.id).draft.poolXp, '31');
  assert.equal(z.commands.length, 0);
  z.button('Narrative Angaben speichern').click();
  await settle();
  assert.equal(x.store.narrative(x.w.token, x.id).state.poolXp, 31);
  assert.equal(x.store.narrative(x.w.token, x.id).draft, null);
});
test('later input advances only over its own confirmed write and never rebases onto an independent status update', async (t) => {
  const x = fixture(t),
    z = dom(t, x);
  await z.show();
  const execute = z.window.campaign.executeProgress;
  let release,
    once = true;
  z.window.campaign.executeProgress = async (cmd) => {
    const saved = await execute(cmd);
    if (once) {
      once = false;
      return new Promise((r) => (release = () => r(saved)));
    }
    return saved;
  };
  z.enter('25');
  z.button('Narrative Angaben speichern').click();
  await settle();
  assert.equal(typeof release, 'function');
  z.enter('31');
  const n = x.store.narrative(x.w.token, x.id);
  x.store.executeProgress(
    x.command({
      kind: 'narrative-state',
      state: { ...n.state, poolXp: 50 },
      expectedRevision: n.state.revision,
      expectedNoteRevision: n.noteRevision,
    }),
  );
  release();
  await settle();
  const current = x.store.narrative(x.w.token, x.id);
  assert.equal(current.state.poolXp, 50);
  assert.equal(current.draft.poolXp, '31');
  assert.equal(current.draft.revision, 1);
  z.button('Narrative Angaben speichern').click();
  await settle();
  assert.equal(x.store.narrative(x.w.token, x.id).state.poolXp, 50);
  assert.equal(z.pool().value, '31');
});

test('status and place can be saved without entering the optional reward workflow', async (t) => {
  const x = fixture(t),
    z = dom(t, x);
  await z.show();
  const rewards = z.panel.querySelector('details');
  assert.equal(rewards.open, false);
  assert.ok(z.pool().closest('label').textContent.includes('XP-Pool'));
  const status = z.panel.querySelector('[aria-label="Narrativer Status"]');
  assert.equal(status.closest('details'), null);
  status.value = 'closed';
  status.onchange();
  z.button('Narrative Angaben speichern').click();
  await settle();
  const saved = x.store.narrative(x.w.token, x.id);
  assert.equal(saved.state.status, 'closed');
  assert.equal(saved.state.poolXp, 0);
  assert.equal(saved.award, null);
  await z.show();
  assert.equal(z.panel.querySelector('[aria-label="Narrativer Status"]').value, 'closed');
  z.enter('25');
  await z.ui.flushNarrative();
  await z.show();
  assert.equal(z.panel.querySelector('details').open, true);
});

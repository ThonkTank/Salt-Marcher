import { readWorkspaceMarkup } from '../../tools/desktop-markup.mjs';
import { preparationInstance } from '../helpers/priority-preparation.mjs';
import { fixtureStore } from '../helpers/store.mjs';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';

test('the shared note writer honors composition while its editor is shown outside Preparation', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await x.ui.openPreparedNote(x.ids.borin);
  const document = x.el('note-editor').ownerDocument,
    panel = document.createElement('section');
  document.body.append(panel);
  panel.append(x.el('note-editor'));
  const area = x.el('note-gm');
  area.dispatchEvent(new x.window.Event('compositionstart', { bubbles: true }));
  area.value = 'Noch laufende Eingabe';
  area.dispatchEvent(new x.window.Event('input', { bubbles: true }));
  assert.equal(await x.ui.flushPreparation(), false);
  assert.equal(x.writes.length, 0);
  area.dispatchEvent(new x.window.Event('compositionend', { bubbles: true }));
  assert.equal(await x.ui.flushPreparation(), true);
  assert.equal(
    x.store.preparation(x.workspace.token).notes.find((r) => r.note.id === x.ids.borin).note
      .gmNotes,
    'Noch laufende Eingabe',
  );
});

async function sourceReader(t) {
  const x = await fixture(t, true);
  x.store.changePreparation(
    x.command({
      kind: 'note',
      expectedRevision: 1,
      note: { ...x.original, relations: [{ targetId: x.ids.ada, label: 'Quelle' }] },
    }),
  );
  await x.activate();
  await x.ui.openPreparedNote(x.ids.borin);
  return x;
}
test('incoming references inspect their original and detached relation controls cannot act on a new selection', async (t) => {
  const x = await sourceReader(t),
    old = x.el('note-relations').querySelector('[aria-label^="Ansehen:"]');
  await x.ui.openPreparedNote(x.ids.ada);
  old.onclick();
  await settle();
  assert.deepEqual(x.inspections, []);
  assert.equal(x.el('quick-reference').open, false);
  x.el('note-incoming').querySelector('[aria-label="Ansehen: Verweis von Borin"]').click();
  await until(() => x.el('quick-document').querySelector('h2')?.textContent === 'Borin');
  assert.equal(x.el('note-title').value, 'Ada');
  assert.equal(x.writes.length, 0);
});
test('cancelled or superseded source reads cannot publish private text into a later reference context', async (t) => {
  const x = await sourceReader(t),
    read = x.window.campaign.deskContent;
  let release;
  x.window.campaign.deskContent = async (...args) => {
    const result = await read(...args);
    return new Promise((r) => (release = () => r(result)));
  };
  x.el('note-relations').querySelector('[aria-label^="Ansehen:"]').click();
  await until(() => !!release);
  x.el('quick-close').click();
  release();
  await settle();
  assert.doesNotMatch(x.el('quick-document').textContent, /GM privat/);
  assert.equal(x.el('note-title').value, 'Borin');
  assert.equal(x.writes.length, 0);
});
test('source inspection shows read failures without navigating to or editing the source', async (t) => {
  const x = await sourceReader(t);
  const read = x.window.campaign.deskContent,
    input = x.el('note-gm'),
    raw = input.value,
    before = x.store.db.serialize();
  x.window.campaign.deskContent = async () => ({ ok: false, error: 'Quelle derzeit nicht lesbar' });
  x.el('note-relations').querySelector('[aria-label^="Ansehen:"]').click();
  await until(() => x.el('quick-document').textContent.includes('Quelle derzeit nicht lesbar'));
  assert.equal(x.el('note-title').value, 'Borin');
  assert.equal(x.writes.length, 0);
  assert.doesNotMatch(x.el('quick-document').textContent, /GM privat/);
  assert.equal(x.el('note-gm'), input);
  assert.equal(input.value, raw);
  assert.ok(x.store.db.serialize().equals(before));
  x.el('quick-close').click();
  x.window.campaign.deskContent = read;
  x.el('note-relations').querySelector('[aria-label^="Ansehen:"]').click();
  await until(() => x.el('quick-document').querySelector('h2')?.textContent === 'Ada');
  assert.equal(x.el('note-gm'), input);
  assert.equal(input.value, raw);
  assert.equal(x.writes.length, 0);
});

async function selectExcerpt(x, field = 'gmNotes') {
  await x.activate();
  await x.ui.openPreparedNote(x.ids.borin);
  const area = x.el(field === 'gmNotes' ? 'note-gm' : 'note-read-aloud');
  area.dispatchEvent(new x.window.Event('focus'));
  area.setSelectionRange(0, field === 'gmNotes' ? 9 : 2);
  x.el('note-excerpt').click();
  await until(() => x.el('note-excerpt-dialog').open);
  return area;
}
test('double submit during an excerpt acknowledgement cannot create duplicates', async (t) => {
  const x = await fixture(t);
  await selectExcerpt(x);
  x.el('note-excerpt-title').value = 'Einmal';
  const save = x.window.campaign.changePreparation;
  let release;
  x.window.campaign.changePreparation = async (c) => {
    const result = await save(c);
    return new Promise((r) => (release = () => r(result)));
  };
  const form = x.el('note-excerpt-form');
  form.dispatchEvent(new x.window.Event('submit', { cancelable: true }));
  await until(() => !!release);
  form.dispatchEvent(new x.window.Event('submit', { cancelable: true }));
  await settle();
  assert.equal(x.writes.length, 1);
  release();
  await until(() => !x.el('note-excerpt-dialog').open);
  assert.equal(
    x.store.preparation(x.workspace.token).notes.filter((r) => r.note.title === 'Einmal').length,
    1,
  );
});
for (const fault of ['unavailable', 'revision', 'identity', 'readFailure'])
  test(
    'targeted excerpt read refuses ' + fault + ' while keeping the source and explicit retry',
    async (t) => {
      const x = await fixture(t);
      await selectExcerpt(x);
      const title = x.el('note-excerpt-title');
      title.value = 'Ada';
      title.dispatchEvent(new x.window.Event('input'));
      await until(() => x.el('note-excerpt-choices').querySelector('button'));
      const read = x.window.campaign.deskContent;
      x.window.campaign.deskContent = async (...args) => {
        const r = await read(...args);
        assert(r.ok);
        if (fault === 'readFailure') return { ok: false, error: 'Gezieltes Original nicht lesbar' };
        const value = structuredClone(r.value);
        if (fault === 'unavailable') value.unavailable = true;
        if (fault === 'revision') value.note.revision++;
        if (fault === 'identity') value.note.id = x.ids.borin;
        return { ok: true, value };
      };
      x.el('note-excerpt-choices').querySelector('button').click();
      await until(
        () =>
          !x.el('note-excerpt-save').disabled &&
          x
            .el('note-excerpt-choices-status')
            .textContent.includes(fault === 'readFailure' ? 'nicht lesbar' : 'geändert'),
      );
      assert.equal(x.el('note-excerpt-existing').hidden, true);
      assert.equal(x.el('note-title').value, 'Borin');
      assert.equal(x.el('note-gm').value, 'GM privat');
      assert.equal(x.writes.length, 0);
      x.window.campaign.deskContent = read;
      x.el('note-excerpt-choices').querySelector('button').click();
      await until(() => !x.el('note-excerpt-existing').hidden);
      assert.equal(x.el('note-excerpt-existing-text').textContent, 'GM privat');
    },
  );
for (const applied of [true, false])
  test(
    'existing excerpt uncertain acknowledgement retains its whole guarded request, then reconciles without plain autosave ' +
      applied,
    async (t) => {
      const x = await fixture(t);
      await selectExcerpt(x);
      x.el('note-excerpt-title').value = 'Ada';
      x.el('note-excerpt-title').dispatchEvent(new x.window.Event('input'));
      await until(() => x.el('note-excerpt-choices').querySelector('button'));
      x.el('note-excerpt-choices').querySelector('button').click();
      await until(() => !x.el('note-excerpt-existing').hidden);
      const save = x.window.campaign.changePreparation;
      x.window.campaign.changePreparation = async (c) => {
        if (applied) await save(c);
        return { ok: false, error: 'Antwort unklar' };
      };
      x.el('note-excerpt-form').dispatchEvent(new x.window.Event('submit', { cancelable: true }));
      await until(() => !x.el('note-excerpt-dialog').open);
      const draft = x.store.preparationDraft(x.workspace.token, 'note', x.ids.ada);
      assert.ok(draft.failedCommand.change.excerpt);
      assert.equal(draft.failedCommand.change.note.id, x.ids.ada);
      x.window.campaign.changePreparation = save;
      x.el('preparation-reconcile').click();
      await until(() => x.el('preparation-reconcile').hidden);
      assert.equal(x.store.preparationDraft(x.workspace.token, 'note', x.ids.ada), null);
      assert.equal(await x.ui.flushPreparation(), true);
      const target = x.store
        .preparation(x.workspace.token)
        .notes.find((r) => r.note.id === x.ids.ada).note;
      assert.equal(target.gmNotes, applied ? 'GM privat\n\n### Borin\n\nGM privat' : 'GM privat');
      assert.equal(x.writes.length, applied ? 1 : 0);
      assert.equal(x.el('note-title').value, 'Borin');
    },
  );
for (const race of [false, true])
  test(
    'capture respects a target draft even if it was never loaded here or arrives after selection ' +
      race,
    async (t) => {
      const x = await fixture(t);
      await selectExcerpt(x);
      const target = x.store
          .preparation(x.workspace.token)
          .notes.find((r) => r.note.id === x.ids.ada).note,
        other = {
          version: 1,
          writeId: randomUUID(),
          change: {
            kind: 'note',
            expectedRevision: 1,
            note: { ...target, gmNotes: 'Anderer offener Entwurf\r\n  ' },
          },
          failedCommand: null,
        };
      if (!race) x.store.keepPreparationDrafts(x.workspace.token, [other]);
      x.el('note-excerpt-title').value = 'Ada';
      x.el('note-excerpt-title').dispatchEvent(new x.window.Event('input'));
      await until(() => x.el('note-excerpt-choices').querySelector('button'));
      x.el('note-excerpt-choices').querySelector('button').click();
      if (!race) {
        await until(() =>
          x.el('note-excerpt-choices-status').textContent.includes('Arbeitsentwurf'),
        );
        assert.equal(x.el('note-excerpt-existing').hidden, true);
        assert.equal(x.writes.length, 0);
        x.el('note-excerpt-cancel').click();
      } else {
        await until(() => !x.el('note-excerpt-existing').hidden);
        x.store.keepPreparationDrafts(x.workspace.token, [other]);
        x.el('note-excerpt-form').dispatchEvent(new x.window.Event('submit', { cancelable: true }));
        await until(() => !x.el('note-excerpt-dialog').open);
        x.el('preparation-reconcile').click();
        await until(() => x.el('preparation-reconcile').hidden);
        assert.equal(await x.ui.flushPreparation(), true);
      }
      assert.deepEqual(x.store.preparationDraft(x.workspace.token, 'note', x.ids.ada), other);
      assert.deepEqual(
        x.store.preparation(x.workspace.token).notes.find((r) => r.note.id === x.ids.ada).note,
        target,
      );
    },
  );
const base = '.build/realist-preparation',
  require = createRequire(import.meta.url);
mkdirSync(base + '/catalog', { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  base + '/catalog/srd-5.1.generated.json',
);
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: base + '/store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  stdin: {
    contents:
      "export * from './src/app/campaign/preparation';export {newLocation} from './src/features/location/location-schema';export {linkVisitNoteThread} from './src/app/campaign/session-ui';export {initCommitControls,checkPendingCommit} from './src/app/shared/commit-confirmation';export {WorldLinksWorkbench} from './src/app/campaign/world-links-ui';export {initQuickReference,activateQuickReference,openQuickReference,inspectQuickReference} from './src/app/catalog/quick-reference-ui';",
    resolveDir: process.cwd(),
    sourcefile: 'preparation-context-fixture.ts',
  },
  outfile: base + '/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const nativeTimeout = globalThis.setTimeout;
const settle = async () => {
  for (let i = 0; i < 15; i++) await new Promise((r) => setImmediate(r));
};
const until = async (check) => {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (check()) return;
    await delay(10);
  }
  assert.ok(check(), 'expected preparation state');
};
async function fixture(t, inspect = false, kind = 'npc') {
  const root = mkdtempSync(path.join(tmpdir(), 'preparation-context-')),
    { CampaignStore } = require('../../' + base + '/store.cjs'),
    store = fixtureStore(CampaignStore, path.join(root, 'db.sqlite')),
    campaign = store.create('Quellen'),
    workspace = store.activate(campaign.id);
  const command = (change) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: workspace.token,
      change,
    }),
    ids = { ada: randomUUID(), borin: randomUUID() };
  for (const [id, title] of [
    [ids.ada, 'Ada'],
    [ids.borin, 'Borin'],
  ])
    store.changePreparation(
      command({
        kind: 'note',
        expectedRevision: null,
        note: {
          version: 1,
          id,
          revision: 1,
          kind,
          title,
          readAloud: '  Original\r\n',
          gmNotes: 'GM privat',
          relations: [],
          creatureId: null,
          deleted: false,
        },
      }),
    );
  const original = store
    .preparation(workspace.token)
    .notes.find((row) => row.note.id === ids.borin).note;
  const { document, window } = parseHTML(readWorkspaceMarkup()),
    prior = {};
  for (const key of [
    'window',
    'document',
    'HTMLInputElement',
    'HTMLSelectElement',
    'HTMLTextAreaElement',
    'Option',
    'Event',
    'setTimeout',
    'clearTimeout',
  ])
    prior[key] = globalThis[key];
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
  function Option(text = '', value = '') {
    const o = document.createElement('option');
    o.textContent = text;
    o.value = value;
    return o;
  }
  window.HTMLSelectElement.prototype.add = function (o) {
    this.append(o);
  };
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
  };
  window.HTMLElement.prototype.setSelectionRange = function (start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  };
  Object.assign(globalThis, {
    document,
    window,
    HTMLInputElement: window.HTMLInputElement,
    HTMLSelectElement: window.HTMLSelectElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement,
    Option,
    Event: window.Event,
    setTimeout: () => 1,
    clearTimeout: () => {},
  });
  const messages = [],
    writes = [],
    inspections = [],
    wrap = (f) => {
      try {
        return { ok: true, value: f() };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    };
  const storage = new Map();
  window.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };
  window.campaign = {};
  for (const method of [
    'narrative',
    'ledgerParties',
    'keepNarrativeDraft',
    'discardNarrativeDraft',
    'executeProgress',
    'commitStatus',
    'preparation',
    'preparationDraft',
    'keepPreparationDrafts',
    'keepDeskDraft',
    'discardPreparationDraft',
    'selectPreparation',
    'reconcilePreparation',
    'reconcilePreparationPlan',
    'reconcilePreparationContent',
    'worldLinks',
    'deskContent',
    'searchDesk',
    'noteThread',
    'checkNoteThread',
    'noteRoomUses',
    'keyNoteChoices',
    'worldRelationPairDraft',
    'keepWorldRelationPairDraft',
    'discardWorldRelationPairDraft',
    'reconcileWorldRelationPair',
    'executeWorldRelationPair',
    'worldRelationPairHistory',
    'executeWorldRelationPairHistory',
    'reconcileWorldRelationPairHistory',
    'live',
    'session',
    'executeSession',
    'encounterPlans',
    'progress',
    'encounterTables',
    'sessionRuns',
    'generationSources',
    'npcs',
    'generatorRegistry',
  ])
    window.campaign[method] = async (...args) => wrap(() => store[method](...args));
  window.campaign.changePreparation = async (c) => {
    writes.push(c);
    return wrap(() => store.changePreparation(c));
  };
  window.campaign.changePreparationContent = async (c) => {
    writes.push(c);
    return wrap(() => store.changePreparationContent(c));
  };
  window.campaign.changePreparationPlan = async (c) => {
    writes.push(c);
    return wrap(() => store.changePreparationPlan(c));
  };
  const file = require.resolve('../../' + base + '/ui.cjs');
  delete require.cache[file];
  const ui = preparationInstance(require(file), document, window);
  ui.initPreparation(
    (text, error) => messages.push({ text, error }),
    async () => {},
    undefined,
    inspect
      ? (id, current) => {
          inspections.push(id);
          const editor = document.getElementById('note-editor'),
            mount = editor.parentElement;
          return ui.inspectQuickReference(
            { kind: 'note', id },
            () => current() && editor.parentElement === mount,
            editor.closest('dialog'),
          );
        }
      : undefined,
  );
  if (inspect) {
    const query = document.querySelector.bind(document);
    document.querySelector = (s) =>
      s === 'dialog:modal:not(#quick-reference)'
        ? ([...document.querySelectorAll('dialog')].find(
            (d) => d.open && d.id !== 'quick-reference',
          ) ?? null)
        : query(s);
    const host = document.createElement('button');
    host.id = 'narrative-journal-open';
    document.body.append(host);
    ui.initQuickReference(
      (text, error) => messages.push({ text, error }),
      () => ui.flushPreparation(),
      async () => {},
    );
  }
  let owner = workspace;
  ui.initCommitControls(
    () => owner,
    (text, error) => messages.push({ text, error }),
  );
  const graph = new ui.WorldLinksWorkbench(
    () => owner,
    () => ui.leavePreparation(),
    (text) => messages.push({ text }),
    async (ref, current) => ui.openPreparedNote(ref.id, current),
  );
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.showModal = () => {
      dialog.open = true;
    };
    dialog.close = () => {
      dialog.open = false;
    };
  }
  if (inspect) ui.activateQuickReference(workspace);
  const el = (id) => document.getElementById(id),
    draft = (failed = false) => {
      const note = {
          ...original,
          readAloud: '  Geretteter Text\r\n**Wortlaut**  ',
          gmNotes: '  Eigene Planung\r\n',
          relations: [{ targetId: ids.ada, label: '  vertraut  ' }],
        },
        writeId = 'world-links-' + randomUUID(),
        change = { kind: 'note', expectedRevision: original.revision, note },
        c = { ...command(change), draftWriteId: writeId };
      return { version: 1, writeId, change, failedCommand: failed ? c : null };
    };
  t.after(async () => {
    if (inspect) ui.activateQuickReference(workspace);
    graph.reset();
    await settle();
    Object.assign(globalThis, prior);
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return {
    store,
    workspace,
    campaign,
    ids,
    original,
    command,
    ui,
    graph,
    el,
    window,
    messages,
    inspections,
    writes,
    draft,
    setOwner: (w) => (owner = w),
    activate: () => ui.activatePreparation(workspace),
  };
}
test('a cancelled next-visit source read cannot append to its previous plan', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await settle();
  const read = x.window.campaign.preparation;
  let release,
    current = true;
  x.window.campaign.preparation = async (...args) => {
    const result = await read(...args);
    return new Promise((resolve) => (release = () => resolve(result)));
  };
  const opening = x.ui.prepareNextVisit(
    null,
    { title: 'Alter Auftrag', notes: 'Alte Notiz', locationId: null },
    () => current,
  );
  await settle();
  assert.ok(release);
  current = false;
  release();
  await opening;
  assert.equal(x.store.preparation(x.workspace.token).plans.length, 0);
  assert.equal(x.writes.length, 0);
});

for (const field of ['visit-read-aloud', 'session-seed'])
  for (const phase of ['read', 'ack'])
    test(`later ${field} input during visit ${phase} stays with its original editor`, async (t) => {
      const x = await fixture(t);
      await x.activate();
      await settle();
      await x.ui.prepareNextVisit(null, {
        title: 'Originalbesuch',
        notes: 'Alter Text',
        locationId: null,
      });
      await settle();
      const plan = x.store.preparation(x.workspace.token).plans[0],
        original = plan.scenes[0].id,
        raw = field === 'session-seed' ? 'Neuer Seed' : '  Späterer Vorlesetext\r\n- Behalten  ';
      const port = phase === 'read' ? 'preparation' : 'changePreparationPlan',
        send = x.window.campaign[port];
      let release,
        held = false;
      x.window.campaign[port] = async (...args) => {
        const result = await send(...args);
        if (!held) {
          held = true;
          await new Promise((resolve) => (release = resolve));
        }
        return result;
      };
      const pending = x.ui
        .prepareNextVisit(plan.id, { title: 'Neuer Besuch', notes: 'Übergabe', locationId: null })
        .then(
          (value) => ({ value }),
          (error) => ({ error }),
        );
      await settle();
      assert(release);
      x.el(field).value = raw;
      x.el(field).dispatchEvent(new x.window.Event('input'));
      release();
      const result = await pending;
      if (phase === 'read') {
        assert.match(result.error?.message ?? '', /Vorbereitung inzwischen geändert/);
        assert.equal(x.store.preparation(x.workspace.token).plans[0].scenes.length, 1);
      } else {
        assert.equal(result.error, undefined);
        assert.equal(x.store.preparation(x.workspace.token).plans[0].scenes.length, 2);
      }
      assert.equal(x.el('scene-title').value, 'Originalbesuch');
      assert.equal(x.el(field).value, raw);
      x.window.campaign[port] = send;
      assert.equal(await x.ui.flushPreparation(), true);
      const saved = x.store.session(x.workspace.token, plan.id);
      assert.equal(
        field === 'session-seed'
          ? saved.profile.seed
          : saved.visits.find((v) => v.visitId === original).readAloud,
        raw,
      );
    });

const copyReady = (x) =>
  until(() => x.el('session-copy-dialog').open && !x.el('session-copy-confirm').disabled);
const copyIdle = (x) =>
  !x.el('session-copy-dialog').open ||
  ![...x.el('session-copy-dialog').querySelectorAll('button')].find(
    (b) => b.textContent === 'Abbrechen',
  ).disabled;

for (const reset of [false, true])
  test(`copy receipt confirmation preserves exactly one append after ${reset ? 'dialog reset' : 'a lost acknowledgement'}`, async (t) => {
    const x = await fixture(t);
    await x.activate();
    await x.ui.prepareNextVisit(null, { title: 'Original', notes: '  Roh\r\n', locationId: null });
    await settle();
    const plan = x.store.preparation(x.workspace.token).plans[0];
    x.el('session-copy-open').click();
    await settle();
    x.el('session-copy-target').value = plan.id;
    x.el('session-copy-target').onchange();
    await settle();
    const send = x.window.campaign.executeSession,
      status = x.window.campaign.commitStatus;
    let calls = 0;
    x.window.campaign.executeSession = async (c) => {
      calls++;
      await send(c);
      throw new Error('Antwort verloren');
    };
    if (reset)
      x.window.campaign.commitStatus = async () => {
        throw new Error('Status weg');
      };
    await copyReady(x);
    x.el('session-copy-confirm').click();
    await until(() => calls === 1 && copyIdle(x));
    assert.equal(calls, 1);
    assert.equal(x.store.preparation(x.workspace.token).plans[0].scenes.length, 2);
    if (reset) {
      assert.equal(x.el('commit-pending').hidden, false);
      [...x.el('session-copy-dialog').querySelectorAll('button')]
        .find((b) => b.textContent === 'Abbrechen')
        .click();
      assert.equal(x.el('session-copy-dialog').open, false);
      x.el('session-copy-open').click();
      await settle();
      assert.equal(x.el('session-copy-dialog').open, false);
      assert.equal(calls, 1);
      x.window.campaign.commitStatus = status;
      const before = x.store.db.serialize();
      await x.ui.checkPendingCommit();
      assert.ok(x.store.db.serialize().equals(before));
    }
    assert.equal(x.el('commit-pending').hidden, true);
    assert.equal(x.el('session-copy-dialog').open, false);
    assert.equal(calls, 1);
    assert.equal(x.store.preparation(x.workspace.token).plans[0].scenes.length, 2);
    assert.equal(x.el('scene-list').querySelectorAll('button').length, 2);
  });

for (const change of ['selection', 'target', 'name', 'party'])
  test(`copy status confirmation cannot dismiss a newer ${change}`, async (t) => {
    const x = await fixture(t);
    await x.activate();
    await x.ui.prepareNextVisit(null, { title: 'Original', notes: 'GM', locationId: null });
    await settle();
    const plan = x.store.preparation(x.workspace.token).plans[0];
    x.el('session-copy-open').click();
    await settle();
    x.el('session-copy-target').value = change === 'name' || change === 'party' ? '' : plan.id;
    x.el('session-copy-target').onchange();
    await settle();
    const send = x.window.campaign.executeSession,
      status = x.window.campaign.commitStatus;
    let calls = 0;
    x.window.campaign.executeSession = async (c) => {
      calls++;
      await send(c);
      throw new Error('Antwort weg');
    };
    x.window.campaign.commitStatus = async () => {
      throw new Error('Status weg');
    };
    await copyReady(x);
    x.el('session-copy-confirm').click();
    await until(() => calls === 1 && copyIdle(x));
    if (change === 'selection') {
      const box = x.el('session-copy-list').querySelector('input');
      box.checked = false;
      box.onchange();
    } else if (change === 'target') {
      x.el('session-copy-target').value = '';
      x.el('session-copy-target').onchange();
      await settle();
    } else if (change === 'party') {
      x.el('session-copy-party').checked = false;
      x.el('session-copy-party').dispatchEvent(new x.window.Event('change'));
    } else {
      x.el('session-copy-name').value = 'Neuer eigener Plan';
      x.el('session-copy-name').dispatchEvent(new x.window.Event('input'));
    }
    assert.equal(x.el('session-copy-confirm').disabled, true);
    const saved = x.store.preparation(x.workspace.token).plans;
    x.window.campaign.commitStatus = status;
    await x.ui.checkPendingCommit();
    assert.equal(x.el('session-copy-dialog').open, true);
    assert.equal(calls, 1);
    assert.deepEqual(x.store.preparation(x.workspace.token).plans, saved);
  });

test('copy source prose and its approval basis come from the same current plan', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await x.ui.prepareNextVisit(null, {
    title: 'Original',
    notes: 'Alter sichtbarer Text',
    locationId: null,
  });
  await settle();
  const plan = x.store.preparation(x.workspace.token).plans[0];
  x.el('session-copy-open').click();
  await settle();
  const fresh = {
    ...plan,
    scenes: plan.scenes.map((s) => ({ ...s, notes: '  Neuer tatsächlicher Text\r\n' })),
  };
  x.store.changePreparation(
    x.command({ kind: 'plan', plan: fresh, expectedRevision: plan.revision }),
  );
  x.el('session-copy-source').onchange();
  await settle();
  assert.match(x.el('session-copy-list').textContent, /Neuer tatsächlicher Text/);
  assert.doesNotMatch(x.el('session-copy-list').textContent, /Alter sichtbarer Text/);
  await until(() => !x.el('session-copy-confirm').disabled);
  x.el('session-copy-confirm').click();
  await until(() => x.store.preparation(x.workspace.token).plans.some((p) => p.id !== plan.id));
  await settle();
  const copy = x.store.preparation(x.workspace.token).plans.find((p) => p.id !== plan.id);
  assert(copy);
  assert.equal(copy.scenes[0].notes, fresh.scenes[0].notes);
});

test('copy recovery keeps a removed selected visit explicit and blocks writing until it is removed', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await x.ui.prepareNextVisit(null, { title: 'Einziger Besuch', notes: 'GM', locationId: null });
  await settle();
  const source = x.store.preparation(x.workspace.token).plans[0];
  x.el('session-copy-open').click();
  await settle();
  const send = x.window.campaign.executeSession,
    status = x.window.campaign.commitStatus;
  let calls = 0;
  x.window.campaign.executeSession = async (c) => {
    calls++;
    await send(c);
    throw new Error('Antwort weg');
  };
  x.window.campaign.commitStatus = async () => {
    throw new Error('Status weg');
  };
  await copyReady(x);
  x.el('session-copy-confirm').click();
  await until(() => calls === 1 && copyIdle(x));
  assert.equal(calls, 1);
  x.el('session-copy-search').value = 'Neue Auswahl';
  x.el('session-copy-search').oninput();
  x.store.changePreparation(
    x.command({ kind: 'plan', expectedRevision: source.revision, plan: { ...source, scenes: [] } }),
  );
  x.window.campaign.commitStatus = status;
  await x.ui.checkPendingCommit();
  assert.equal(x.el('session-copy-dialog').open, true);
  assert.match(x.el('session-copy-order').textContent, /Besuch fehlt/);
  assert.equal(x.el('session-copy-order').children.length, 1);
  assert.equal(x.el('session-copy-confirm').disabled, true);
  x.el('session-copy-confirm').onclick();
  await settle();
  assert.equal(calls, 1);
  assert.equal(x.store.preparation(x.workspace.token).plans.length, 2);
  [...x.el('session-copy-order').querySelectorAll('button')]
    .find((b) => b.textContent === 'Entfernen')
    .click();
  assert.equal(x.el('session-copy-order').children.length, 0);
  assert.equal(x.el('session-copy-confirm').disabled, true);
});

for (const externalChange of [false, true])
  test(
    'a renamed evening uses its saved plan revision and ' +
      (externalChange
        ? 'rejects a later external change'
        : 'accepts all three scenes without reopening'),
    async (t) => {
      const x = await fixture(t);
      for (const method of ['generateSession', 'sessionRun'])
        x.window.campaign[method] = async (...args) => {
          try {
            return { ok: true, value: x.store[method](...args) };
          } catch (e) {
            return { ok: false, error: e.message };
          }
        };
      await x.activate();
      x.el('plan-create').click();
      await until(() => !!x.el('plans').value);
      await settle();
      x.el('plan-name').value = 'Drei Begegnungen mit Beute';
      x.el('plan-name').dispatchEvent(new x.window.Event('input'));
      const partyControls = x.el('session-party-levels');
      assert.equal(await x.ui.flushPreparation(), true);
      assert.equal(x.el('session-party-levels'), partyControls);
      assert.equal(
        x.store.preparation(x.workspace.token).plans.find((p) => p.id === x.el('plans').value)
          .revision,
        2,
      );
      for (const level of ['3', '4']) {
        x.el('session-free-party').click();
        const rows = x.el('session-party-levels').querySelectorAll('.session-party-row'),
          inputs = rows[rows.length - 1].querySelectorAll('input');
        inputs[0].value = level;
        inputs[0].oninput();
        inputs[1].value = '2';
        inputs[1].oninput();
      }
      x.el('session-fraction').value = '0.6';
      x.el('session-fraction').oninput();
      x.el('session-seed').value = '179974';
      x.el('session-seed').oninput();
      x.el('session-scene-count').value = '3';
      x.el('session-scene-count').oninput();
      assert.equal(await x.ui.flushPreparation(), true);
      x.el('session-generate-form').onsubmit({ preventDefault() {} });
      await settle();
      assert.equal(
        x.el('session-preview').querySelectorAll('[data-proposal-index]').length,
        3,
        JSON.stringify(x.messages.slice(-4)) +
          ' ' +
          x.el('session-generation-feedback').textContent,
      );
      x.el('session-select-visible').click();
      x.el('session-review-selection').click();
      if (externalChange) {
        const plan = x.store
          .preparation(x.workspace.token)
          .plans.find((p) => p.id === x.el('plans').value);
        x.store.changePreparation(
          x.command({
            kind: 'plan',
            expectedRevision: plan.revision,
            plan: { ...plan, name: 'Zwischenzeitlich geändert' },
          }),
        );
      }
      x.el('session-selection-confirm').click();
      if (externalChange) {
        await until(() => x.messages.some((m) => /Timeline geändert/.test(m.text)));
        assert.equal(
          x.store.preparation(x.workspace.token).plans.find((p) => p.id === x.el('plans').value)
            .scenes.length,
          0,
        );
        assert.equal(x.el('session-selection-dialog').open, true);
        assert.ok(x.messages.some((m) => /Timeline geändert/.test(m.text)));
        return;
      }
      for (
        const deadline = Date.now() + 2000;
        Date.now() < deadline &&
        x.store.preparation(x.workspace.token).plans.find((p) => p.id === x.el('plans').value)
          .scenes.length !== 3;

      )
        await delay(5);
      await settle();
      assert.equal(
        x.store.preparation(x.workspace.token).plans.find((p) => p.id === x.el('plans').value)
          .scenes.length,
        3,
        JSON.stringify(x.messages.slice(-4)) + ' ' + x.el('session-selection-dialog').textContent,
      );
    },
  );
const narrativeButton = (x, label) =>
  [...x.el('narrative-editor').querySelectorAll('button')].find((b) => b.textContent === label);

for (const applied of [false, true])
  test(`an unresolved session write stays blocked until its ${applied ? 'applied' : 'not-applied'} receipt is checked`, async (t) => {
    const x = await fixture(t);
    await x.activate();
    await x.ui.prepareNextVisit(null, { title: 'Abend', notes: 'GM', locationId: null });
    await settle();
    const plan = x.store.preparation(x.workspace.token).plans[0],
      field = x.el('visit-read-aloud'),
      raw = '  Gesendet\r\n',
      later = '  Später geschrieben\r\n';
    field.value = raw;
    field.dispatchEvent(new x.window.Event('input'));
    const send = x.window.campaign.executeSession,
      status = x.window.campaign.commitStatus;
    let calls = 0;
    x.window.campaign.executeSession = async (c) => {
      calls++;
      if (applied) await send(c);
      throw new Error('Verbindung weg');
    };
    x.window.campaign.commitStatus = async () => {
      throw new Error('Status ebenfalls weg');
    };
    assert.equal(await x.ui.flushPreparation(), false);
    assert.equal(calls, 1);
    assert.equal(x.el('commit-pending').hidden, false);
    field.value = later;
    field.dispatchEvent(new x.window.Event('input'));
    assert.equal(await x.ui.flushPreparation(), false);
    assert.equal(calls, 1);
    x.window.campaign.commitStatus = status;
    const bytes = x.store.db.serialize();
    await x.ui.checkPendingCommit();
    assert.ok(x.store.db.serialize().equals(bytes));
    assert.equal(calls, 1);
    assert.equal(field.value, later);
    assert.equal(x.el('commit-pending').hidden, true);
    x.window.campaign.executeSession = async (c) => {
      calls++;
      return send(c);
    };
    assert.equal(await x.ui.flushPreparation(), true);
    assert.equal(calls, 2);
    assert.equal(x.store.session(x.workspace.token, plan.id).visits[0].readAloud, later);
  });

for (const failed of [false, true])
  test(`a superseded source ${failed ? 'failure' : 'success'} leaves the newer inspected source and editor untouched`, async (t) => {
    const x = await sourceReader(t),
      read = x.window.campaign.deskContent;
    let release;
    x.window.campaign.deskContent = async (...args) => {
      const result = await read(...args);
      return new Promise((resolve) => {
        release = () => resolve(failed ? { ok: false, error: 'Alter Quellenfehler' } : result);
      });
    };
    x.el('note-relations').querySelector('[aria-label^="Ansehen:"]').click();
    await until(() => !!release);
    x.el('quick-close').click();
    x.window.campaign.deskContent = read;
    await x.ui.openPreparedNote(x.ids.ada);
    x.el('note-incoming').querySelector('[aria-label="Ansehen: Verweis von Borin"]').click();
    await until(() => x.el('quick-document').querySelector('h2')?.textContent === 'Borin');
    const displayed = x.el('quick-document').textContent,
      field = x.el('note-gm'),
      raw = field.value,
      messages = [...x.messages],
      writes = x.writes.length;
    release();
    await settle();
    assert.equal(x.el('quick-document').textContent, displayed);
    assert.equal(x.el('quick-document').querySelector('h2').textContent, 'Borin');
    assert.equal(x.el('note-title').value, 'Ada');
    assert.equal(x.el('note-gm'), field);
    assert.equal(field.value, raw);
    assert.deepEqual(x.messages, messages);
    assert.equal(x.writes.length, writes);
  });

test('next-visit preparation reuses the plan writer with raw notes and cannot fall back from a missing requested plan', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await settle();
  await x.ui.prepareNextVisit(null, {
    title: 'Nächster Morgen',
    notes: '  Roh\r\n- Spuren  ',
    locationId: null,
  });
  await settle();
  const plans = x.store.preparation(x.workspace.token).plans;
  assert.equal(plans.length, 1);
  assert.equal(plans[0].scenes.length, 1);
  assert.equal(plans[0].scenes[0].notes, '  Roh\r\n- Spuren  ');
  assert.equal(x.el('scene-notes').value, '  Roh\r\n- Spuren  ');
  assert.equal(x.writes.length, 1);
  assert.deepEqual(
    x.messages.filter((m) => m.error),
    [],
  );
  await assert.rejects(
    () =>
      x.ui.prepareNextVisit('missing-plan', {
        title: 'Falscher Plan',
        notes: 'Nicht schreiben',
        locationId: null,
      }),
    /nicht verfügbar/,
  );
  assert.deepEqual(x.store.preparation(x.workspace.token).plans, plans);
  assert.equal(x.writes.length, 1);
});
test('a copy acknowledgement retains later notes in the original selected visit', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await x.ui.prepareNextVisit(null, { title: 'Original', notes: 'Ursprung', locationId: null });
  await settle();
  const plan = x.store.preparation(x.workspace.token).plans[0],
    visitId = plan.scenes[0].id;
  x.el('session-copy-open').click();
  await settle();
  x.el('session-copy-target').value = plan.id;
  x.el('session-copy-target').onchange();
  await copyReady(x);
  const send = x.window.campaign.executeSession;
  let release,
    copies = 0;
  x.window.campaign.executeSession = async (command) => {
    const result = await send(command);
    if (command.action.kind === 'copy-visits') {
      copies++;
      await new Promise((resolve) => {
        release = resolve;
      });
    }
    return result;
  };
  x.el('session-copy-confirm').click();
  await until(() => !!release);
  const field = x.el('scene-notes'),
    raw = '  Späterer Besuchstext\r\nbleibt hier.  ';
  field.value = raw;
  field.dispatchEvent(new x.window.Event('input'));
  release();
  await until(() => !x.el('session-copy-dialog').open);
  await settle();
  assert.equal(x.el('scene-notes'), field);
  assert.equal(field.value, raw);
  assert.equal(x.el('scene-title').value, 'Original');
  assert.equal(copies, 1);
  assert.equal(await x.ui.flushPreparation(), true);
  const saved = x.store.preparation(x.workspace.token).plans.find((p) => p.id === plan.id);
  assert.equal(saved.scenes.length, 2);
  assert.equal(saved.scenes.find((v) => v.id === visitId).notes, raw);
  assert.equal(saved.scenes.find((v) => v.id !== visitId).notes, 'Ursprung');
});

async function locationReference(t) {
  const x = await fixture(t),
    id = randomUUID(),
    document = structuredClone(x.ui.newLocation(id, 'Tor', 'poi', [randomUUID(), randomUUID()]));
  document.sections[0].markdown = 'A\r\nB';
  x.store.changePreparation(x.command({ kind: 'location', expectedRevision: null, document }));
  await x.activate();
  await x.ui.openPreparedLocation(id);
  const field = x.el('location-section-0');
  field.setSelectionRange(2, 3);
  const button = [...x.el('location-sections').querySelectorAll('button')].find(
    (b) => b.textContent === 'Textverweis einfügen…',
  );
  return { ...x, id, field, button };
}

test('location section input during its real flush cannot reuse the earlier reference selection', async (t) => {
  const x = await locationReference(t),
    writer = x.window.campaign.changePreparation;
  let release,
    calls = 0;
  x.window.campaign.changePreparation = async (command) => {
    const result = await writer(command);
    if (++calls === 1)
      await new Promise((resolve) => {
        release = resolve;
      });
    return result;
  };
  x.field.value = 'Vor Sicherung';
  x.field.oninput();
  x.button.click();
  await until(() => !!release);
  x.field.value = '  Späterer Abschnitt\r\n';
  x.field.oninput();
  release();
  await settle();
  assert.equal(x.el('text-reference-picker'), null);
  assert.equal(x.el('location-section-0').value, '  Späterer Abschnitt\r\n');
  assert.equal(await x.ui.flushPreparation(), true);
  assert.equal(
    x.store.preparation(x.workspace.token).locations.find((l) => l.document.id === x.id).document
      .sections[0].markdown,
    '  Späterer Abschnitt\r\n',
  );
});

test('a detached location section reference button cannot open a picker after rerendering', async (t) => {
  const x = await locationReference(t);
  await x.ui.openPreparedLocation(x.id);
  const before = x.store.db.serialize(),
    writes = x.writes.length;
  assert.notEqual(x.el('location-section-0'), x.field);
  x.button.onclick();
  await settle();
  assert.equal(x.el('text-reference-picker'), null);
  assert.equal(x.el('location-section-0').value, 'A\r\nB');
  assert.equal(x.writes.length, writes);
  assert.ok(x.store.db.serialize().equals(before));
});

test('a pending location section verification cannot insert over a later section draft', async (t) => {
  const x = await locationReference(t);
  x.button.click();
  await settle();
  assert.ok(x.el('text-reference-picker'));
  x.el('text-reference-results').querySelector('button').click();
  await settle();
  x.el('text-reference-alias').value = 'Quelle';
  x.el('text-reference-alias').dispatchEvent(new x.window.Event('input'));
  assert.equal(x.el('text-reference-insert').disabled, false);
  const read = x.window.campaign.deskContent;
  let release;
  x.window.campaign.deskContent = async (...args) => {
    const result = await read(...args);
    return new Promise((resolve) => {
      release = () => resolve(result);
    });
  };
  x.el('text-reference-insert').click();
  await until(() => !!release);
  x.field.value = '  Spätere Eingabe im Ort\r\n';
  x.field.oninput();
  const before = x.store.db.serialize(),
    writes = x.writes.length;
  release();
  await settle();
  assert.equal(x.el('text-reference-picker'), null);
  assert.equal(x.el('location-section-0'), x.field);
  assert.equal(x.field.value, '  Spätere Eingabe im Ort\r\n');
  assert.equal(x.writes.length, writes);
  assert.ok(x.store.db.serialize().equals(before));
});

for (const conflict of ['removed visit', 'changed text'])
  test(`a copy reply cannot redirect later notes after a foreign ${conflict}`, async (t) => {
    const x = await fixture(t);
    await x.activate();
    await x.ui.prepareNextVisit(null, { title: 'Original', notes: 'Ursprung', locationId: null });
    await settle();
    const plan = x.store.preparation(x.workspace.token).plans[0],
      visitId = plan.scenes[0].id;
    x.el('session-copy-open').click();
    await settle();
    x.el('session-copy-target').value = plan.id;
    x.el('session-copy-target').onchange();
    await copyReady(x);
    const send = x.window.campaign.executeSession;
    let release,
      copies = 0;
    x.window.campaign.executeSession = async (command) => {
      const result = await send(command);
      if (command.action.kind === 'copy-visits') {
        copies++;
        await new Promise((resolve) => {
          release = resolve;
        });
      }
      return result;
    };
    x.el('session-copy-confirm').click();
    await until(() => !!release);
    const field = x.el('scene-notes'),
      raw = '  Spätere eigene Besuchsnotiz\r\n';
    field.value = raw;
    field.dispatchEvent(new x.window.Event('input'));
    const saved = x.store.preparation(x.workspace.token).plans.find((p) => p.id === plan.id),
      foreign = {
        ...saved,
        scenes:
          conflict === 'removed visit'
            ? saved.scenes.filter((v) => v.id !== visitId)
            : saved.scenes.map((v) =>
                v.id === visitId ? { ...v, notes: 'Fremde bestätigte Fassung' } : v,
              ),
      };
    x.store.changePreparation(
      x.command({ kind: 'plan', plan: foreign, expectedRevision: saved.revision }),
    );
    const writes = x.writes.length;
    release();
    await until(() =>
      x.messages.some((m) => /Plan oder bearbeiteter Besuch inzwischen geändert/.test(m.text)),
    );
    assert.equal(x.el('scene-notes'), field);
    assert.equal(field.value, raw);
    assert.equal(x.el('scene-title').value, 'Original');
    assert.equal(x.el('preparation-refresh').hidden, false);
    assert.equal(copies, 1);
    const before = x.store.db.serialize();
    assert.equal(await x.ui.flushPreparation(), false);
    assert.equal(x.writes.length, writes);
    assert.ok(x.store.db.serialize().equals(before));
    assert.deepEqual(
      x.store.preparation(x.workspace.token).plans.find((p) => p.id === plan.id).scenes,
      foreign.scenes,
    );
  });

test('excerpt destination read cannot publish after source A→B→A in the production preparation editor', async (t) => {
  const x = await fixture(t);
  await selectExcerpt(x);
  x.el('note-excerpt-title').value = 'Ada';
  x.el('note-excerpt-title').dispatchEvent(new x.window.Event('input'));
  await until(() => x.el('note-excerpt-choices').querySelector('button'));
  const read = x.window.campaign.deskContent;
  let release;
  x.window.campaign.deskContent = async (...args) => {
    const result = await read(...args);
    return new Promise((resolve) => {
      release = () => resolve(result);
    });
  };
  x.el('note-excerpt-choices').querySelector('button').click();
  await until(() => !!release);
  await x.ui.openPreparedNote(x.ids.ada);
  await x.ui.openPreparedNote(x.ids.borin);
  const before = x.el('note-gm').value;
  release();
  await settle();
  assert.equal(x.el('note-excerpt-existing').hidden, true);
  assert.equal(x.el('note-title').value, 'Borin');
  assert.equal(x.el('note-gm').value, before);
  assert.equal(x.writes.length, 0);
  x.el('note-excerpt-cancel').click();
});

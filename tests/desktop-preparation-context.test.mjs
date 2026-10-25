import { fixtureStore } from './helpers/store.mjs';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
import { parseHTML } from './helpers/dom.mjs';

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

test('opening an unavailable note reports failure without claiming the previous selection as its target', async (t) => {
  const x = await fixture(t);
  await x.activate();
  assert.equal(await x.ui.openPreparedNote(x.ids.borin), true);
  const title = x.el('note-title').value;
  assert.equal(await x.ui.openPreparedNote('missing-note'), false);
  assert.equal(x.el('note-title').value, title);
  assert.equal(x.writes.length, 0);
});

test('excerpt action follows the selected text field and clears when the note changes', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await x.ui.openPreparedNote(x.ids.borin);
  const button = x.el('note-excerpt'),
    actions = x.el('note-selection-actions'),
    gm = x.el('note-gm'),
    read = x.el('note-read-aloud');
  assert.equal(button.hidden, true);
  gm.setSelectionRange(0, 9);
  gm.dispatchEvent(new x.window.Event('select'));
  assert.equal(button.hidden, false);
  assert.equal(gm.nextElementSibling, actions);
  gm.setSelectionRange(3, 3);
  gm.dispatchEvent(new x.window.Event('select'));
  assert.equal(button.hidden, true);
  read.setSelectionRange(0, 5);
  read.dispatchEvent(new x.window.Event('select'));
  assert.equal(button.hidden, false);
  assert.equal(read.nextElementSibling, actions);
  button.click();
  await until(() => x.el('note-excerpt-dialog').open);
  assert.equal(x.el('note-excerpt-text').value, '  Ori');
  x.el('note-excerpt-cancel').click();
  await x.ui.openPreparedNote(x.ids.ada);
  assert.equal(button.hidden, true);
  assert.equal(gm.nextElementSibling, actions);
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
test('relationship inspection reads the canonical source while keeping the current editor, query and literal input', async (t) => {
  const x = await sourceReader(t),
    area = x.el('note-gm'),
    raw = '  Weiterarbeiten\r\nQuelle prüfen  ';
  x.el('world-search').value = 'Borin';
  area.value = raw;
  area.dispatchEvent(new x.window.Event('input'));
  area.setSelectionRange(3, 7);
  x.el('note-relations').querySelector('[aria-label="Ansehen: Quelle: Ada"]').click();
  await until(() => x.el('quick-document').querySelector('h2')?.textContent === 'Ada');
  assert.equal(x.el('quick-reference').open, true);
  assert.equal(x.el('note-title').value, 'Borin');
  assert.equal(x.el('world-search').value, 'Borin');
  assert.equal(area.value, raw);
  assert.equal(area.selectionStart, 3);
  assert.equal(area.selectionEnd, 7);
  assert.match(x.el('quick-document').textContent, /GM privat/);
  x.el('quick-close').click();
  assert.equal(x.el('quick-reference').open, false);
  assert.equal(x.el('note-title').value, 'Borin');
  assert.equal(x.writes.length, 1);
  assert.equal(
    x.store.preparation(x.workspace.token).notes.find((r) => r.note.id === x.ids.borin).note
      .gmNotes,
    raw,
  );
});
test('incoming references inspect their original and detached relation controls cannot act on a new selection', async (t) => {
  const x = await sourceReader(t),
    old = x.el('note-relations').querySelector('[aria-label^="Ansehen:"]');
  await x.ui.openPreparedNote(x.ids.ada);
  old.onclick();
  await settle();
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
  x.window.campaign.deskContent = async () => ({ ok: false, error: 'Quelle derzeit nicht lesbar' });
  x.el('note-relations').querySelector('[aria-label^="Ansehen:"]').click();
  await until(() => x.el('quick-document').textContent.includes('Quelle derzeit nicht lesbar'));
  assert.equal(x.el('note-title').value, 'Borin');
  assert.equal(x.writes.length, 0);
  assert.doesNotMatch(x.el('quick-document').textContent, /GM privat/);
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
test('selected source text creates a typed original with both provenance links while keeping its source editor', async (t) => {
  const x = await fixture(t),
    area = await selectExcerpt(x);
  assert.equal(x.el('note-excerpt-text').value, 'GM privat');
  x.el('note-excerpt-kind').value = 'faction';
  x.el('note-excerpt-title').value = 'Bruderschaft';
  x.el('note-excerpt-form').dispatchEvent(new x.window.Event('submit', { cancelable: true }));
  await until(() => x.writes.length === 1 && !x.el('note-excerpt-dialog').open);
  const notes = x.store.preparation(x.workspace.token).notes,
    created = notes.find((r) => r.note.title === 'Bruderschaft').note,
    source = notes.find((r) => r.note.id === x.ids.borin).note;
  assert.equal(created.kind, 'faction');
  assert.equal(created.gmNotes, 'GM privat');
  assert.equal(created.readAloud, '');
  assert.deepEqual(created.relations, [{ targetId: x.ids.borin, label: 'Quelle' }]);
  assert.deepEqual(source.relations, [{ targetId: created.id, label: 'Auszug' }]);
  assert.equal(source.gmNotes, x.original.gmNotes);
  assert.equal(x.el('note-title').value, 'Borin');
  assert.equal(area.value, 'GM privat');
  assert.match(x.el('note-excerpt-status').textContent, /Bruderschaft/);
});
test('empty selection and cancelled extraction create no notes or relations', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await x.ui.openPreparedNote(x.ids.borin);
  x.el('note-excerpt').click();
  await settle();
  assert.match(x.el('note-excerpt-status').textContent, /Markiere zuerst/);
  assert.equal(x.writes.length, 0);
  const a = x.el('note-gm');
  a.setSelectionRange(0, 9);
  a.dispatchEvent(new x.window.Event('focus'));
  x.el('note-excerpt').click();
  await until(() => x.el('note-excerpt-dialog').open);
  x.el('note-excerpt-cancel').click();
  assert.equal(x.el('note-excerpt-dialog').open, false);
  assert.equal(x.writes.length, 0);
});
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
test('lost excerpt acknowledgement exposes original-command reconciliation without a second write', async (t) => {
  const x = await fixture(t);
  await selectExcerpt(x);
  x.el('note-excerpt-title').value = 'Gerettet';
  const save = x.window.campaign.changePreparation;
  x.window.campaign.changePreparation = async (c) => {
    await save(c);
    return { ok: false, error: 'Antwort verloren' };
  };
  x.el('note-excerpt-form').dispatchEvent(new x.window.Event('submit', { cancelable: true }));
  await until(() => !x.el('note-excerpt-dialog').open);
  assert.equal(x.writes.length, 1);
  assert.equal(x.el('preparation-reconcile').hidden, false);
  x.el('preparation-reconcile').click();
  await until(() => x.el('preparation-reconcile').hidden);
  assert.equal(x.writes.length, 1);
  assert.equal(
    x.store.preparation(x.workspace.token).notes.filter((r) => r.note.title === 'Gerettet').length,
    1,
  );
  assert.equal(x.el('note-title').value, 'Borin');
});
test('excerpt selection explicitly appends to the canonical original and retains the source editor', async (t) => {
  const x = await fixture(t);
  await selectExcerpt(x);
  const title = x.el('note-excerpt-title');
  title.value = 'Ada';
  title.dispatchEvent(new x.window.Event('input'));
  await until(() => x.el('note-excerpt-choices').querySelector('button'));
  x.el('note-excerpt-choices').querySelector('button').click();
  await until(() => !x.el('note-excerpt-existing').hidden);
  assert.equal(x.el('note-excerpt-existing-text').textContent, 'GM privat');
  assert.equal(x.el('note-excerpt-text').value, '### Borin\n\nGM privat');
  assert.equal(x.el('note-excerpt-kind').disabled, true);
  x.el('note-excerpt-form').dispatchEvent(new x.window.Event('submit', { cancelable: true }));
  await until(() => x.writes.length === 1 && !x.el('note-excerpt-dialog').open);
  const notes = x.store.preparation(x.workspace.token).notes;
  assert.equal(notes.length, 2);
  const target = notes.find((r) => r.note.id === x.ids.ada).note;
  assert.equal(target.gmNotes, 'GM privat\n\n### Borin\n\nGM privat');
  assert.equal(target.readAloud, '  Original\r\n');
  assert.equal(x.writes[0].change.expectedRevision, 1);
  assert.equal(x.el('note-title').value, 'Borin');
  assert.match(x.el('note-excerpt-status').textContent, /Ada.*ergänzt/);
  assert.equal(notes.find((r) => r.note.id === x.ids.borin).note.gmNotes, 'GM privat');
});
test('choosing an excerpt original reads only that original, not the entire preparation directory', async (t) => {
  const x = await fixture(t);
  await selectExcerpt(x);
  const title = x.el('note-excerpt-title');
  title.value = 'Ada';
  title.dispatchEvent(new x.window.Event('input'));
  await until(() => x.el('note-excerpt-choices').querySelector('button'));
  const reads = [],
    read = x.window.campaign.deskContent;
  x.window.campaign.deskContent = async (...args) => {
    reads.push(args);
    return read(...args);
  };
  x.window.campaign.preparation = async () => ({
    ok: false,
    error: 'Unrelated preparation directory must not be reloaded for one original',
  });
  x.el('note-excerpt-choices').querySelector('button').click();
  await until(() => !x.el('note-excerpt-existing').hidden);
  assert.deepEqual(reads, [[x.workspace.token, { kind: 'note', id: x.ids.ada }]]);
  assert.equal(x.el('note-excerpt-existing-text').textContent, 'GM privat');
  assert.equal(x.writes.length, 0);
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
test('same-title Enter cannot silently create a duplicate and separate creation requires explicit choice', async (t) => {
  const x = await fixture(t);
  await selectExcerpt(x);
  x.el('note-excerpt-title').value = 'Ada';
  const form = x.el('note-excerpt-form');
  form.dispatchEvent(new x.window.Event('submit', { cancelable: true }));
  await until(() => x.el('note-excerpt-choices-status').textContent.includes('Diesen Namen'));
  assert.equal(x.writes.length, 0);
  assert.equal(x.el('note-excerpt-dialog').open, true);
  x.el('note-excerpt-new').click();
  form.dispatchEvent(new x.window.Event('submit', { cancelable: true }));
  await until(() => x.writes.length === 1 && !x.el('note-excerpt-dialog').open);
  assert.equal(x.writes[0].change.excerpt.allowSameTitle, true);
  assert.equal(
    x.store.preparation(x.workspace.token).notes.filter((r) => r.note.title === 'Ada').length,
    2,
  );
});
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
test('late candidate search or original read cannot select an identity after a query change or cancellation', async (t) => {
  const x = await fixture(t);
  await selectExcerpt(x);
  const search = x.window.campaign.keyNoteChoices;
  let release;
  x.window.campaign.keyNoteChoices = async (...args) => {
    const v = await search(...args);
    return new Promise((r) => (release = () => r(v)));
  };
  const title = x.el('note-excerpt-title');
  title.value = 'Ada';
  title.dispatchEvent(new x.window.Event('input'));
  await until(() => !!release);
  const old = release;
  title.value = 'Niemand';
  title.dispatchEvent(new x.window.Event('input'));
  old();
  await settle();
  assert.equal(x.el('note-excerpt-choices').querySelectorAll('button').length, 0);
  x.el('note-excerpt-cancel').click();
  release();
  await settle();
  assert.equal(x.el('note-excerpt-dialog').open, false);
  assert.equal(x.writes.length, 0);
  x.window.campaign.keyNoteChoices = search;
  await selectExcerpt(x);
  title.value = 'Ada';
  title.dispatchEvent(new x.window.Event('input'));
  await until(() => x.el('note-excerpt-choices').querySelector('button'));
  const read = x.window.campaign.deskContent;
  let finish;
  x.window.campaign.deskContent = async (...args) => {
    const v = await read(...args);
    return new Promise((r) => (finish = () => r(v)));
  };
  x.el('note-excerpt-choices').querySelector('button').click();
  await until(() => !!finish);
  x.el('note-excerpt-cancel').click();
  finish();
  await settle();
  assert.equal(x.el('note-excerpt-dialog').open, false);
  assert.equal(x.writes.length, 0);
});
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
      "export * from './src/app/preparation';export {linkVisitNoteThread} from './src/app/session-ui';export {initCommitControls,checkPendingCommit} from './src/app/commit-confirmation';export {WorldLinksWorkbench} from './src/app/world-links-ui';export {initQuickReference,activateQuickReference,openQuickReference,inspectQuickReference} from './src/app/quick-reference-ui';",
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
    { CampaignStore } = require('../' + base + '/store.cjs'),
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
  const { document, window } = parseHTML(readFileSync('src/app/index.html', 'utf8')),
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
  const file = require.resolve('../' + base + '/ui.cjs');
  delete require.cache[file];
  const ui = require(file);
  ui.initPreparation(
    (text, error) => messages.push({ text, error }),
    async () => {},
    undefined,
    inspect
      ? (id, current) => {
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
    writes,
    draft,
    setOwner: (w) => (owner = w),
    activate: () => ui.activatePreparation(workspace),
  };
}
test('a legacy relationship draft resumes in the graph and publishes exactly once', async (t) => {
  const x = await fixture(t),
    draft = x.draft();
  x.store.keepPreparationDrafts(x.workspace.token, [draft]);
  await x.activate();
  await x.graph.open({ kind: 'note', id: x.ids.borin });
  assert.equal(x.el('world-link-label').value, '  vertraut  ');
  assert.match(x.el('world-links-inspector').textContent, /Gesicherter Beziehungsentwurf/);
  assert.equal(x.writes.length, 0);
  [...x.el('world-links-inspector').querySelectorAll('button')]
    .find((b) => b.textContent === 'Beziehung übernehmen')
    .click();
  await settle();
  assert.equal(x.writes.length, 1);
  const saved = x.store
    .preparation(x.workspace.token)
    .notes.find((r) => r.note.id === x.ids.borin).note;
  assert.equal(saved.readAloud, draft.change.note.readAloud);
  assert.equal(saved.gmNotes, draft.change.note.gmNotes);
  assert.deepEqual(saved.relations, draft.change.note.relations);
  assert.equal(x.store.preparationDraft(x.workspace.token, 'note', x.ids.borin), null);
});
test('an unapplied legacy relationship command is reconciled before a fresh explicit save', async (t) => {
  const x = await fixture(t),
    draft = x.draft(true);
  x.store.keepPreparationDrafts(x.workspace.token, [draft]);
  x.store.selectPreparation(x.workspace.token, {
    noteId: x.ids.borin,
    planId: null,
    sceneId: null,
  });
  await x.activate();
  assert.equal(await x.ui.flushPreparation(), false);
  assert.equal(x.writes.length, 0);
  x.el('preparation-reconcile').click();
  await settle();
  assert.equal(x.el('preparation-reconcile').hidden, true);
  assert.equal(x.el('note-read-aloud').value, draft.change.note.readAloud);
  assert.equal(x.writes.length, 0);
  assert.equal(await x.ui.flushPreparation(), true);
  assert.equal(x.writes.length, 1);
  assert.notEqual(x.writes[0].commandId, draft.failedCommand.commandId);
  assert.equal(x.writes[0].change.note.gmNotes, draft.change.note.gmNotes);
});
test('a late preparation receipt cannot replace another campaign or report its old result', async (t) => {
  const x = await fixture(t),
    draft = x.draft(true);
  x.store.keepPreparationDrafts(x.workspace.token, [draft]);
  x.store.selectPreparation(x.workspace.token, {
    noteId: x.ids.borin,
    planId: null,
    sceneId: null,
  });
  await x.activate();
  const read = x.window.campaign.reconcilePreparation;
  let release;
  x.window.campaign.reconcilePreparation = async (...args) => {
    const result = await read(...args);
    return new Promise((r) => (release = () => r(result)));
  };
  x.el('preparation-reconcile').click();
  await settle();
  assert.ok(release);
  const b = x.store.create('B'),
    w = x.store.activate(b.id),
    id = randomUUID();
  x.store.changePreparation({
    commandId: randomUUID(),
    campaignId: b.id,
    token: w.token,
    change: {
      kind: 'note',
      expectedRevision: null,
      note: {
        version: 1,
        id,
        revision: 1,
        kind: 'npc',
        title: 'Neue Kampagne',
        readAloud: 'Neu',
        gmNotes: 'Bleibt',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    },
  });
  x.setOwner(w);
  await x.ui.activatePreparation(w);
  const before = x.messages.length;
  release();
  await settle();
  assert.equal(x.el('note-title').value, 'Neue Kampagne');
  assert.equal(x.el('note-read-aloud').value, 'Neu');
  assert.equal(x.messages.length, before);
  assert.equal(x.writes.length, 0);
  x.el('note-gm').value = 'Nach dem Wechsel';
  x.el('note-gm').dispatchEvent(new x.window.Event('input'));
  assert.equal(await x.ui.flushPreparation(), true);
  assert.equal(
    x.store.preparation(w.token).notes.find((r) => r.note.id === id).note.gmNotes,
    'Nach dem Wechsel',
  );
});
test('adding a relationship preserves prose edited while its acknowledgement is pending', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await x.ui.openPreparedNote(x.ids.borin);
  x.el('relation-target').value = x.ids.ada;
  x.el('relation-label').value = 'kennt';
  x.el('note-gm').value = 'Vorher';
  x.el('note-gm').dispatchEvent(new x.window.Event('input'));
  const save = x.window.campaign.changePreparation;
  let release;
  x.window.campaign.changePreparation = async (c) => {
    const result = await save(c);
    if (!release) return new Promise((r) => (release = () => r(result)));
    return result;
  };
  x.el('relation-add').click();
  await settle();
  assert.ok(release);
  x.el('note-gm').value = '  Spätere Eingabe\r\n';
  x.el('note-gm').dispatchEvent(new x.window.Event('input'));
  release();
  await settle();
  await x.ui.flushPreparation();
  const saved = x.store
    .preparation(x.workspace.token)
    .notes.find((r) => r.note.id === x.ids.borin).note;
  assert.equal(saved.gmNotes, '  Spätere Eingabe\r\n');
  assert.deepEqual(saved.relations, [{ targetId: x.ids.ada, label: 'kennt' }]);
});

test('removing an authored relationship uses the same draft writer and revokes its detached control', async (t) => {
  const x = await fixture(t),
    draft = x.draft();
  x.store.keepPreparationDrafts(x.workspace.token, [draft]);
  await x.activate();
  await x.ui.openPreparedNote(x.ids.borin);
  const old = [...x.el('note-relations').querySelectorAll('button')].find(
    (b) => b.textContent === 'Beziehung lösen',
  );
  assert.ok(old);
  old.click();
  await settle();
  await x.ui.flushPreparation();
  const saved = x.store
    .preparation(x.workspace.token)
    .notes.find((r) => r.note.id === x.ids.borin).note;
  assert.deepEqual(saved.relations, []);
  assert.equal(saved.readAloud, draft.change.note.readAloud);
  const count = x.writes.length;
  old.onclick();
  await settle();
  assert.equal(x.writes.length, count);
});
test('a repeated relationship click cannot create an invalid duplicate draft', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await x.ui.openPreparedNote(x.ids.borin);
  x.el('relation-target').value = x.ids.ada;
  x.el('relation-label').value = 'kennt';
  x.el('relation-add').click();
  x.el('relation-add').click();
  await settle();
  assert.equal(await x.ui.flushPreparation(), true);
  const saved = x.store
    .preparation(x.workspace.token)
    .notes.find((r) => r.note.id === x.ids.borin).note;
  assert.deepEqual(saved.relations, [{ targetId: x.ids.ada, label: 'kennt' }]);
  assert.equal(x.writes.length, 1);
});

for (const rejected of [false, true])
  test(`a late save ${rejected ? 'failure' : 'acknowledgement'} cannot replace a freshly reactivated preparation`, async (t) => {
    const x = await fixture(t);
    await x.activate();
    await x.ui.openPreparedNote(x.ids.borin);
    x.el('note-gm').value = 'Gesendet';
    x.el('note-gm').dispatchEvent(new x.window.Event('input'));
    const save = x.window.campaign.changePreparation;
    let release;
    x.window.campaign.changePreparation = async (c) => {
      const result = await save(c);
      if (!release)
        return new Promise(
          (r) => (release = () => r(rejected ? { ok: false, error: 'Antwort verloren' } : result)),
        );
      return result;
    };
    const saving = x.ui.flushPreparation();
    await settle();
    assert.ok(release);
    const note = x.store
      .preparation(x.workspace.token)
      .notes.find((r) => r.note.id === x.ids.borin).note;
    x.store.changePreparation(
      x.command({
        kind: 'note',
        expectedRevision: note.revision,
        note: { ...note, gmNotes: 'Neu geladen' },
      }),
    );
    await x.activate();
    assert.equal(x.el('note-gm').value, 'Neu geladen');
    const count = x.messages.length;
    release();
    assert.equal(await saving, false);
    assert.equal(x.messages.length, count);
    assert.equal(x.el('note-gm').value, 'Neu geladen');
    x.window.campaign.changePreparation = save;
    x.el('note-gm').value = '  Nach Neustart\r\n';
    x.el('note-gm').dispatchEvent(new x.window.Event('input'));
    assert.equal(await x.ui.flushPreparation(), true);
    assert.equal(
      x.store.preparation(x.workspace.token).notes.find((r) => r.note.id === x.ids.borin).note
        .gmNotes,
      '  Nach Neustart\r\n',
    );
  });

for (const reason of ['reload', 'cancel'])
  test('a source read cannot select its old note after ' + reason, async (t) => {
    const x = await fixture(t);
    await x.activate();
    const read = x.window.campaign.preparation;
    let release;
    x.window.campaign.preparation = async (...args) => {
      const result = await read(...args);
      if (!release) return new Promise((r) => (release = () => r(result)));
      return result;
    };
    let current = true;
    const opening = x.ui.openPreparedNote(x.ids.borin, () => current);
    await settle();
    assert.ok(release);
    if (reason === 'reload') {
      x.store.selectPreparation(x.workspace.token, {
        noteId: x.ids.ada,
        planId: null,
        sceneId: null,
      });
      await x.activate();
    } else current = false;
    assert.equal(x.el('note-title').value, 'Ada');
    release();
    await opening;
    assert.equal(x.el('note-title').value, 'Ada');
  });

async function picker(t) {
  const x = await fixture(t);
  await x.activate();
  await x.ui.openPreparedNote(x.ids.borin);
  const area = x.el('note-gm');
  area.value = '  Roh\r\n**Text**  ';
  area.dispatchEvent(new x.window.Event('input'));
  area.setSelectionRange(2, 2);
  x.el('note-text-reference').click();
  await settle();
  const dialog = x.el('text-reference-picker');
  assert.ok(dialog?.open);
  return {
    ...x,
    area,
    dialog,
    select: async (id) => {
      dialog.querySelector(`[data-reference="note:${id}"]`).click();
      await settle();
    },
    cancel: async () => {
      [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Abbrechen').click();
      await settle();
    },
  };
}
test('text reference insertion preserves raw note bytes and uses the existing single writer', async (t) => {
  const x = await picker(t);
  await x.select(x.ids.ada);
  x.el('text-reference-alias').value = '  Wächter  ';
  x.el('text-reference-alias').dispatchEvent(new x.window.Event('input'));
  x.el('text-reference-insert').click();
  await settle();
  const expected = '  [  Wächter  ](dungeon-ref:note/' + x.ids.ada + ')Roh\r\n**Text**  ';
  assert.equal(x.area.value, expected);
  await x.ui.flushPreparation();
  assert.equal(
    x.store.preparation(x.workspace.token).notes.find((r) => r.note.id === x.ids.borin).note
      .gmNotes,
    expected,
  );
});
for (const change of ['target', 'alias', 'search'])
  test('a pending reference confirmation cannot insert after ' + change + ' changes', async (t) => {
    const x = await picker(t);
    await x.select(x.ids.ada);
    const read = x.window.campaign.deskContent;
    let release;
    x.window.campaign.deskContent = async (...args) => {
      const result = await read(...args);
      if (!release) return new Promise((r) => (release = () => r(result)));
      return result;
    };
    x.el('text-reference-insert').click();
    await settle();
    assert.ok(release);
    if (change === 'target') await x.select(x.ids.borin);
    else {
      const el = x.el(change === 'alias' ? 'text-reference-alias' : 'text-reference-search');
      el.value = 'Neue Wahl';
      el.dispatchEvent(new x.window.Event('input'));
    }
    release();
    await settle();
    assert.equal(x.dialog.open, true);
    assert.equal(x.area.value, '  Roh\r\n**Text**  ');
    await x.cancel();
  });
test('changing reference search revokes its old result controls immediately', async (t) => {
  const x = await picker(t),
    old = x.dialog.querySelector(`[data-reference="note:${x.ids.ada}"]`),
    field = x.el('text-reference-search');
  field.value = 'niemand';
  field.dispatchEvent(new x.window.Event('input'));
  old.onclick();
  await settle();
  assert.equal(x.el('text-reference-results').textContent, '');
  assert.equal(x.el('text-reference-detail').textContent, '');
  assert.equal(x.el('text-reference-insert').disabled, true);
  await x.cancel();
});
test('a delayed reference selection preserves an alias already typed by the GM', async (t) => {
  const x = await picker(t),
    read = x.window.campaign.deskContent;
  let release;
  x.window.campaign.deskContent = async (...args) => {
    const result = await read(...args);
    return new Promise((r) => (release = () => r(result)));
  };
  x.dialog.querySelector(`[data-reference="note:${x.ids.ada}"]`).click();
  await settle();
  x.el('text-reference-alias').value = 'Eigener Name';
  x.el('text-reference-alias').dispatchEvent(new x.window.Event('input'));
  release();
  await settle();
  assert.equal(x.el('text-reference-alias').value, 'Eigener Name');
  await x.cancel();
});

test('a reference selected for an old editor generation cannot change the reloaded note', async (t) => {
  const x = await picker(t);
  await x.select(x.ids.ada);
  await x.activate();
  x.el('text-reference-insert').click();
  await settle();
  assert.equal(x.area.value, '  Roh\r\n**Text**  ');
  assert.equal(
    x.store.preparation(x.workspace.token).notes.find((r) => r.note.id === x.ids.borin).note
      .gmNotes,
    '  Roh\r\n**Text**  ',
  );
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

test('handoff visit is inserted before the selected existing visit through the same plan writer', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await settle();
  await x.ui.prepareNextVisit(null, { title: 'Original', notes: 'bleibt', locationId: null });
  const plan = x.store.preparation(x.workspace.token).plans[0];
  await x.ui.prepareNextVisit(plan.id, {
    title: 'Übergabe',
    notes: '  Roh\r\n- Auftrag',
    locationId: null,
    beforeVisitId: plan.scenes[0].id,
  });
  const saved = x.store.preparation(x.workspace.token).plans[0];
  assert.deepEqual(
    saved.scenes.map((s) => s.title),
    ['Übergabe', 'Original'],
  );
  assert.equal(saved.scenes[0].notes, '  Roh\r\n- Auftrag');
  assert.equal(saved.scenes[1].id, plan.scenes[0].id);
});

test('opening preparation saves plan order, raw prose and bound sources in one confirmed change', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await settle();
  const prose = '  Vorlesen\r\n- Tor  ',
    notes = '  GM\r\nEnde  ';
  await x.ui.prepareNextVisit(null, {
    title: 'Einstieg',
    notes,
    locationId: null,
    readAloud: prose,
    noteIds: [x.ids.ada, x.ids.ada],
  });
  const plan = x.store.preparation(x.workspace.token).plans[0],
    visit = x.store.session(x.workspace.token, plan.id).visits[0];
  assert.equal(plan.scenes[0].notes, notes);
  assert.equal(visit.readAloud, prose);
  assert.deepEqual(visit.noteIds, [x.ids.ada]);
  assert.equal(x.writes.length, 1);
  assert.deepEqual(
    x.messages.filter((m) => m.error),
    [],
  );
});
test('invalid opening sources roll back the plan, visit, history and receipt together', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await settle();
  const id = randomUUID(),
    visitId = randomUUID(),
    command = x.command({
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id,
        revision: 1,
        name: 'Abend',
        scenes: [{ id: visitId, title: 'Tor', notes: 'GM', locationId: null }],
      },
      opening: { visitId, readAloud: 'Vorlesen', noteIds: [randomUUID()] },
    }),
    before = x.store.db.serialize();
  assert.throws(() => x.store.changePreparation(command));
  assert.equal(x.store.preparation(x.workspace.token).plans.length, 0);
  assert.ok(x.store.db.serialize().equals(before));
  command.change.opening.noteIds = [x.ids.ada];
  x.store.changePreparation(command);
  const bytes = x.store.db.serialize();
  x.store.changePreparation(command);
  assert.ok(x.store.db.serialize().equals(bytes));
  assert.equal(x.store.session(x.workspace.token, id).visits[0].readAloud, 'Vorlesen');
});

test('explicit new-plan choice cannot reuse the currently selected plan', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await settle();
  await x.ui.prepareNextVisit(null, { title: 'Alter Besuch', notes: 'Alt', locationId: null });
  const before = x.store.preparation(x.workspace.token).plans[0];
  await x.ui.prepareNextVisit(null, {
    title: 'Neuer Einstieg',
    notes: 'Neu',
    locationId: null,
    newPlan: true,
  });
  const plans = x.store.preparation(x.workspace.token).plans;
  assert.equal(plans.length, 2);
  assert.deepEqual(
    plans.find((p) => p.id === before.id),
    before,
  );
  assert.equal(plans.find((p) => p.id !== before.id).scenes[0].title, 'Neuer Einstieg');
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

for (const field of ['visit-read-aloud', 'session-seed'])
  test(`a lost ${field} acknowledgement is resolved without a second write`, async (t) => {
    const x = await fixture(t);
    await x.activate();
    await x.ui.prepareNextVisit(null, { title: 'Abend', notes: 'GM', locationId: null });
    await settle();
    const plan = x.store.preparation(x.workspace.token).plans[0],
      raw = '  Eigener Text\r\n';
    x.el(field).value = raw;
    x.el(field).dispatchEvent(new x.window.Event('input'));
    const send = x.window.campaign.executeSession;
    let calls = 0;
    x.window.campaign.executeSession = async (c) => {
      calls++;
      const result = await send(c);
      if (calls === 1) throw new Error('Antwort verloren');
      return result;
    };
    assert.equal(await x.ui.flushPreparation(), true);
    assert.equal(calls, 1);
    const saved = x.store.session(x.workspace.token, plan.id);
    assert.equal(field === 'session-seed' ? saved.profile.seed : saved.visits[0].readAloud, raw);
    assert.equal(await x.ui.flushPreparation(), true);
    assert.equal(calls, 1);
  });

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

test('a session receipt survives a fresh handle and refuses mismatched or damaged authority', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await x.ui.prepareNextVisit(null, { title: 'Abend', notes: 'GM', locationId: null });
  const plan = x.store.preparation(x.workspace.token).plans[0],
    detail = x.store.session(x.workspace.token, plan.id).visits[0],
    command = x.command(null);
  delete command.change;
  command.action = {
    kind: 'visit',
    planId: plan.id,
    expectedRevision: detail.revision,
    detail: { ...detail, readAloud: '  Dauerhaft\r\n' },
  };
  const result = x.store.executeSession(command),
    row = x.store.db
      .prepare('SELECT * FROM session_receipt WHERE command_id=?')
      .get(command.commandId),
    ref = {
      family: 'session',
      campaignId: x.campaign.id,
      commandId: command.commandId,
      fingerprint: row.fingerprint,
    };
  const other = new x.store.constructor(x.store.db.name);
  try {
    const w = other.activate(x.campaign.id),
      before = other.db.serialize();
    assert.deepEqual(other.commitStatus(ref, w.token), { outcome: 'applied', value: result });
    assert.ok(other.db.serialize().equals(before));
    assert.throws(
      () => other.commitStatus({ ...ref, fingerprint: '0'.repeat(64) }, w.token),
      /anders verwendet/,
    );
    other.db
      .prepare('UPDATE session_receipt SET checksum=? WHERE command_id=?')
      .run('0'.repeat(64), command.commandId);
    assert.throws(() => other.commitStatus(ref, w.token), /beschädigt/);
  } finally {
    other.close();
  }
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

test('a late session refresh cannot install its old preparation into another campaign', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await x.ui.prepareNextVisit(null, { title: 'Alter Abend', notes: 'GM', locationId: null });
  await settle();
  x.el('visit-read-aloud').value = 'Speichern';
  x.el('visit-read-aloud').dispatchEvent(new x.window.Event('input'));
  const read = x.window.campaign.preparation;
  let release;
  x.window.campaign.preparation = async (...args) => {
    const result = await read(...args);
    if (args[0] === x.workspace.token && !release)
      await new Promise((resolve) => (release = resolve));
    return result;
  };
  const saving = x.ui.flushPreparation();
  await until(() => !!release);
  const b = x.store.create('Neue Kampagne'),
    w = x.store.activate(b.id),
    id = randomUUID();
  x.store.changePreparation({
    commandId: randomUUID(),
    campaignId: b.id,
    token: w.token,
    change: {
      kind: 'note',
      expectedRevision: null,
      note: {
        version: 1,
        id,
        revision: 1,
        kind: 'npc',
        title: 'Neue Quelle',
        readAloud: 'Neu',
        gmNotes: 'Bleibt',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    },
  });
  x.setOwner(w);
  await x.ui.activatePreparation(w);
  release();
  await saving;
  assert.equal(x.el('note-title').value, 'Neue Quelle');
  assert.equal(x.el('plans').querySelectorAll('option').length, 0);
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

for (const target of ['new', 'existing'])
  test(`after copy status confirmation a newer ${target} selection can be explicitly submitted`, async (t) => {
    const x = await fixture(t);
    await x.activate();
    await x.ui.prepareNextVisit(null, {
      title: 'Erster Besuch',
      notes: '  Roh\r\n',
      locationId: null,
    });
    await settle();
    const plan = x.store.preparation(x.workspace.token).plans[0];
    await x.ui.prepareNextVisit(plan.id, {
      title: 'Zweiter Besuch',
      notes: 'Zwei',
      locationId: null,
    });
    await settle();
    x.el('session-copy-open').click();
    await settle();
    x.el('session-copy-target').value = target === 'existing' ? plan.id : '';
    x.el('session-copy-target').onchange();
    await settle();
    await until(() => !x.el('session-copy-confirm').disabled);
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
    x.el('session-copy-confirm').click();
    await until(
      () =>
        calls === 1 &&
        ![...x.el('session-copy-dialog').querySelectorAll('button')].find(
          (b) => b.textContent === 'Abbrechen',
        ).disabled,
    );
    const boxes = x.el('session-copy-list').querySelectorAll('input');
    boxes[0].checked = false;
    boxes[0].onchange();
    const name = target === 'new' ? '  Zweite bewusste Kopie  ' : x.el('session-copy-name').value,
      party = target === 'existing';
    if (target === 'new') {
      x.el('session-copy-name').value = name;
      x.el('session-copy-party').checked = false;
    }
    x.el('session-copy-search').value = 'Zweiter';
    x.el('session-copy-search').oninput();
    x.window.campaign.commitStatus = status;
    await x.ui.checkPendingCommit();
    assert.equal(x.el('session-copy-dialog').open, true);
    assert.equal(x.el('session-copy-name').value, name);
    assert.equal(x.el('session-copy-party').checked, party);
    assert.equal(x.el('session-copy-search').value, 'Zweiter');
    assert.equal(x.el('session-copy-order').children.length, 1);
    x.window.campaign.executeSession = async (c) => {
      calls++;
      return send(c);
    };
    x.el('session-copy-confirm').click();
    await until(() => calls === 2);
    await until(() => x.el('session-copy-dialog').open === false);
    const plans = x.store.preparation(x.workspace.token).plans;
    if (target === 'existing') {
      assert.equal(plans.find((p) => p.id === plan.id).scenes.length, 5);
    } else {
      assert.equal(plans.length, 3);
      assert.equal(plans.find((p) => p.name === '  Zweite bewusste Kopie  ').scenes.length, 1);
    }
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

test('the shared session snapshot leaves historical receipt bytes and their replay contract unchanged', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await x.ui.prepareNextVisit(null, { title: 'Abend', notes: '  Original\r\n', locationId: null });
  const plan = x.store.preparation(x.workspace.token).plans[0],
    snapshot = x.store.session(x.workspace.token, plan.id);
  assert.deepEqual(snapshot.plan, plan);
  const command = {
      commandId: randomUUID(),
      campaignId: x.campaign.id,
      token: x.workspace.token,
      action: {
        kind: 'profile',
        profile: { ...snapshot.profile, seed: 'Neuer Seed' },
        expectedRevision: snapshot.profile.revision,
      },
    },
    ack = x.store.executeSession(command),
    row = x.store.db
      .prepare('SELECT * FROM session_receipt WHERE command_id=?')
      .get(command.commandId);
  assert.equal(Object.hasOwn(ack, 'plan'), false);
  assert.equal(Object.hasOwn(JSON.parse(row.payload), 'plan'), false);
  const fresh = new x.store.constructor(x.store.db.name);
  try {
    const w = fresh.activate(x.campaign.id),
      before = fresh.db.serialize();
    assert.deepEqual(fresh.executeSession({ ...command, token: w.token }), ack);
    assert.ok(fresh.db.serialize().equals(before));
    assert.equal(
      fresh.db
        .prepare('SELECT payload FROM session_receipt WHERE command_id=?')
        .get(command.commandId).payload,
      row.payload,
    );
  } finally {
    fresh.close();
  }
});

test('planning area preserves the world editor and profile autosaves preserve live party input nodes and later edits', async (t) => {
  const x = await fixture(t);
  await x.activate();
  x.el('preparation-planning').click();
  await settle();
  assert.equal(x.el('preparation-knowledge-workspace').hidden, true);
  assert.equal(x.el('preparation-planning-workspace').hidden, false);
  x.el('plan-create').click();
  await until(() => !!x.el('plans').value);
  await settle();
  x.el('session-free-party').click();
  const [level, count] = x.el('session-party-levels').querySelectorAll('input');
  level.value = '3';
  level.oninput();
  count.value = '2';
  count.oninput();
  const execute = x.window.campaign.executeSession;
  let release,
    first = true;
  x.window.campaign.executeSession = async (c) => {
    if (first && c.action.kind === 'profile') {
      first = false;
      await new Promise((r) => (release = r));
    }
    return execute(c);
  };
  const save = x.ui.flushPreparation();
  await until(() => !!release);
  assert.equal(level.disabled, false, 'autosave must not disable the field being edited');
  assert.equal(count.disabled, false);
  count.value = '3';
  count.oninput();
  release();
  assert.equal(await save, true);
  assert.equal(
    x.el('session-party-levels').querySelectorAll('input')[0],
    level,
    'acknowledgement must not replace focused controls',
  );
  assert.equal(x.el('session-party-levels').querySelectorAll('input')[1], count);
  assert.equal(count.value, '3');
  const profile = x.store.session(x.workspace.token, x.el('plans').value).profile;
  assert.equal(profile.party[0].count, 3);
  assert.equal(profile.revision, 2, 'newer edit is saved against the acknowledged revision');
  // Handlers must still update the current draft after the first acknowledgement.
  level.value = '4';
  level.oninput();
  assert.equal(await x.ui.flushPreparation(), true);
  assert.equal(x.store.session(x.workspace.token, x.el('plans').value).profile.party[0].level, 4);
  const note = x.el('note-title');
  x.el('preparation-knowledge').click();
  await settle();
  assert.equal(x.el('preparation-planning-workspace').hidden, true);
  assert.equal(x.el('note-title'), note);
  x.el('preparation-planning').click();
  await settle();
  assert.equal(x.el('session-party-levels').querySelector('input'), level);
  x.el('session-party-levels').querySelector('button').click();
  assert.equal(await x.ui.flushPreparation(), true);
  assert.deepEqual(x.store.session(x.workspace.token, x.el('plans').value).profile.party, []);
  await x.ui.openPreparedNote(x.ids.ada);
  assert.equal(x.el('preparation-knowledge-workspace').hidden, false);
  assert.equal(x.el('preparation-planning-workspace').hidden, true);
});

test('session generation gives local feedback, avoids duplicate sends and retains explicit optional reward modes', async (t) => {
  const x = await fixture(t);
  await x.activate();
  x.el('plan-create').click();
  await until(() => !!x.el('plans').value);
  await settle();
  assert.equal(x.el('session-generation-options').hasAttribute('open'), false);
  assert.equal(x.el('session-loot-compensate').hasAttribute('checked'), false);
  let finish,
    calls = 0,
    request;
  x.window.campaign.generateSession = async (_token, r) => {
    calls++;
    request = r;
    return new Promise((resolve) => (finish = resolve));
  };
  const submit = () => x.el('session-generate-form').onsubmit({ preventDefault() {} });
  submit();
  await until(() => !!finish);
  submit();
  await settle();
  assert.equal(calls, 1);
  assert.equal(x.el('session-generate').disabled, true);
  assert.match(x.el('session-generation-feedback').textContent, /werden erzeugt/);
  finish({ ok: false, error: 'Keine passende Komposition für diese Quellen.' });
  await settle();
  assert.match(x.el('session-generation-feedback').textContent, /Keine passende Komposition/);
  assert.equal(x.el('session-generate').disabled, false);
  // The optional modes are still passed exactly as explicitly chosen.
  x.el('session-loot-compensate').checked = true;
  x.el('session-magic-compensate').checked = false;
  submit();
  await until(() => calls === 2);
  assert.equal(request.compensateLoot, true);
  finish({ ok: false, error: 'Ledger unvollständig.' });
  await settle();
  assert.match(x.el('session-generation-feedback').textContent, /Ledger unvollständig/);
});

test('unresolved profile replies stop further writes without replacing the later draft', async (t) => {
  const x = await fixture(t);
  await x.activate();
  x.el('plan-create').click();
  await until(() => !!x.el('plans').value);
  await settle();
  x.el('session-free-party').click();
  const level = x.el('session-party-levels').querySelector('input');
  level.value = '3';
  level.oninput();
  let writes = 0;
  x.window.campaign.executeSession = async () => {
    writes++;
    throw new Error('transport lost');
  };
  x.window.campaign.commitStatus = async () => ({ ok: false, error: 'status unavailable' });
  assert.equal(await x.ui.flushPreparation(), false);
  assert.equal(writes, 1);
  assert.equal(x.el('session-party-levels').querySelector('input'), level);
  assert.equal(level.disabled, true, 'only an actual unresolved write locks the draft');
  x.el('session-generate-form').onsubmit({ preventDefault() {} });
  await settle();
  assert.equal(writes, 1);
  assert.match(x.el('session-generation-feedback').textContent, /keine neue Vorschau/);
  assert.doesNotMatch(x.el('session-generation-feedback').textContent, /werden erzeugt/);
});

function threadSelection(x) {
  x.store.changePreparation(
    x.command({
      kind: 'note',
      expectedRevision: x.original.revision,
      note: { ...x.original, relations: [{ targetId: x.ids.ada, label: 'Quelle' }] },
    }),
  );
  const page = x.store.noteThread(x.workspace.token, x.ids.borin, 0, true);
  return {
    rootId: x.ids.borin,
    rootRevision: page.root.revision,
    includeRoot: true,
    entries: page.entries.map(({ id, stamp }) => ({ id, stamp })),
  };
}

test('direct evening handoff reviews sources before prose and writes only the approved originals to the current visit', async (t) => {
  const x = await fixture(t);
  threadSelection(x);
  await x.activate();
  await x.ui.prepareNextVisit(null, {
    title: 'Am Fährsteg',
    notes: 'Eigene Besuchsnotiz',
    locationId: null,
  });
  const plan = x.store.preparation(x.workspace.token).plans[0],
    visit = plan.scenes[0];
  await x.ui.openPreparedNote(x.ids.borin);
  const area = x.el('note-gm');
  area.value += '\nVor der Übergabe ergänzt.';
  area.dispatchEvent(new x.window.Event('input'));
  x.el('note-thread-prepare').click();
  await until(() => x.el('note-thread-dialog').open && !x.el('note-thread-use').disabled);
  const target = x.el('note-thread-reading').firstElementChild;
  assert(target.classList.contains('note-thread-target'));
  assert.equal(x.el('note-thread-plan').value, plan.id);
  assert.equal(x.el('note-thread-visit').value, visit.id);
  assert.equal(x.el('note-thread-source-choices').hidden, false);
  assert.match(x.el('note-thread-source-choices').textContent, /Ada/);
  assert.match(
    x.store.preparation(x.workspace.token).notes.find((n) => n.note.id === x.ids.borin).note
      .gmNotes,
    /Vor der Übergabe ergänzt/,
  );
  const box = x.el('note-thread-source-choices').querySelector('input');
  box.checked = false;
  box.onchange();
  assert.equal(x.el('note-thread-sources').querySelector('input').checked, false);
  assert.match(x.el('note-thread-choice').textContent, /1 Originalnotizen/);
  x.el('note-thread-use').click();
  await until(() => !x.el('note-thread-dialog').open);
  const saved = x.store.session(x.workspace.token, plan.id).visits[0];
  assert.deepEqual(saved.noteIds, [x.ids.borin]);
  assert.equal(
    x.store.preparation(x.workspace.token).plans[0].scenes[0].notes,
    'Eigene Besuchsnotiz',
  );
  await x.ui.openPreparedNote(x.ids.borin);
  x.el('note-thread-open').click();
  await until(() => !x.el('note-thread-use').disabled);
  assert.equal(x.el('note-thread-source-choices').hidden, true);
  assert.notEqual(x.el('note-thread-reading').firstElementChild, target);
});

test('map handoff preserves the dossier after editing its source and cannot bypass composition', async (t) => {
  const x = await fixture(t);
  await nestedThread(x);
  const field = x.el('note-gm');
  field.dispatchEvent(new x.window.Event('compositionstart', { bubbles: true }));
  field.value = 'Noch nicht fertig';
  field.dispatchEvent(new x.window.Event('input'));
  x.el('note-thread-prepare-map').click();
  await settle();
  assert.equal(x.el('note-thread-heading').textContent, 'Notizmappe: Borin');
  assert.equal(x.el('note-thread-editor').hidden, false);
  assert.equal(x.writes.length, 0);
  field.dispatchEvent(new x.window.Event('compositionend', { bubbles: true }));
  x.el('note-thread-prepare-map').click();
  await until(() => x.el('note-thread-editor').hidden && !x.el('note-thread-use').disabled);
  assert.equal(x.el('note-thread-heading').textContent, 'Notizmappe: Borin');
  assert.equal(x.el('note-thread-reading').firstElementChild.className, 'note-thread-target');
  assert.equal(x.el('note-title').value, 'Borin');
  assert.equal(x.writes.length, 1);
  assert.equal(x.el('note-thread-parent').hidden, true);
  assert.equal(
    x.store.preparation(x.workspace.token).notes.find((r) => r.note.id === x.ids.ada).note.gmNotes,
    'Noch nicht fertig',
  );
});
test('thread preparation uses the selected new plan name and stores references without copying source prose', async (t) => {
  const x = await fixture(t),
    selection = threadSelection(x);
  await x.activate();
  await x.ui.prepareNextVisit(null, {
    title: 'Offene Spur verfolgen',
    notes: '',
    locationId: null,
    newPlan: true,
    newPlanName: 'Abend 9 · Nachtwache',
    noteIds: [x.ids.borin, x.ids.ada],
    noteThread: selection,
  });
  const plan = x.store.preparation(x.workspace.token).plans[0],
    visit = x.store.session(x.workspace.token, plan.id).visits[0];
  assert.equal(plan.name, 'Abend 9 · Nachtwache');
  assert.equal(plan.scenes[0].notes, '');
  assert.deepEqual(visit.noteIds, [x.ids.borin, x.ids.ada]);
  assert.equal(x.writes.length, 1);
  assert.deepEqual(x.writes[0].change.opening.noteThread, selection);
});
test('a thread link acknowledgement retains later visit prose and the approved source additions in the same draft', async (t) => {
  const x = await fixture(t),
    selection = threadSelection(x);
  await x.activate();
  await x.ui.prepareNextVisit(null, { title: 'Ermitteln', notes: 'GM bleibt', locationId: null });
  const plan = x.store.preparation(x.workspace.token).plans[0],
    send = x.window.campaign.executeSession;
  let release,
    calls = 0;
  x.window.campaign.executeSession = async (c) => {
    calls++;
    const result = await send(c);
    await new Promise((r) => (release = r));
    return result;
  };
  const pending = x.ui.linkVisitNoteThread(
    x.workspace.token,
    plan.id,
    plan.scenes[0].id,
    selection,
    () => true,
  );
  await until(() => !!release);
  const area = x.el('visit-read-aloud');
  area.value = '  Späterer Wortlaut\r\n';
  area.dispatchEvent(new x.window.Event('input'));
  release();
  assert.equal(await pending, true);
  assert.equal(calls, 1);
  assert.equal(area.value, '  Späterer Wortlaut\r\n');
  x.window.campaign.executeSession = send;
  assert.equal(await x.ui.flushPreparation(), true);
  const visit = x.store.session(x.workspace.token, plan.id).visits[0];
  assert.equal(visit.readAloud, '  Späterer Wortlaut\r\n');
  assert.deepEqual(new Set(visit.noteIds), new Set([x.ids.ada, x.ids.borin]));
  assert.equal(x.store.preparation(x.workspace.token).plans[0].scenes[0].notes, 'GM bleibt');
});
test('a source revision race rejects the thread link without an optimistic unguarded follow-up save', async (t) => {
  const x = await fixture(t),
    selection = threadSelection(x);
  await x.activate();
  await x.ui.prepareNextVisit(null, { title: 'Ermitteln', notes: 'GM', locationId: null });
  const plan = x.store.preparation(x.workspace.token).plans[0];
  const ada = x.store
    .preparation(x.workspace.token)
    .notes.find((r) => r.note.id === x.ids.ada).note;
  x.store.changePreparation(
    x.command({
      kind: 'note',
      expectedRevision: ada.revision,
      note: { ...ada, gmNotes: 'Geänderte Quelle' },
    }),
  );
  const send = x.window.campaign.executeSession;
  let calls = 0;
  x.window.campaign.executeSession = async (c) => {
    calls++;
    return send(c);
  };
  assert.equal(
    await x.ui.linkVisitNoteThread(
      x.workspace.token,
      plan.id,
      plan.scenes[0].id,
      selection,
      () => true,
    ),
    false,
  );
  assert.equal(calls, 1);
  assert.equal(await x.ui.flushPreparation(), true);
  assert.equal(calls, 1);
  assert.deepEqual(x.store.session(x.workspace.token, plan.id).visits[0].noteIds, []);
});

async function openThreadEditor(x, id = x.ids.ada) {
  await x.ui.openPreparedNote(x.ids.borin);
  x.el('note-thread-open').onclick();
  await until(() => x.el('note-thread-sources').querySelector('article'));
  const card = [...x.el('note-thread-sources').querySelectorAll('article')].find(
    (n) => n.dataset.noteId === id,
  );
  [...card.querySelectorAll('button')].find((n) => n.textContent === 'Notiz bearbeiten…').onclick();
  await until(
    () =>
      x.el('note-title').value === (id === x.ids.ada ? 'Ada' : 'Erledigte Spur') &&
      !x.el('note-thread-return').disabled,
  );
}
async function nestedThread(x) {
  const third = {
    ...x.original,
    id: randomUUID(),
    title: 'Wachwechsel',
    gmNotes: 'Zweiter Glockenschlag',
    relations: [{ targetId: x.ids.borin, label: 'Rückverweis' }],
  };
  x.store.changePreparation(x.command({ kind: 'note', expectedRevision: null, note: third }));
  const ada = x.store
    .preparation(x.workspace.token)
    .notes.find((n) => n.note.id === x.ids.ada).note;
  x.store.changePreparation(
    x.command({
      kind: 'note',
      expectedRevision: ada.revision,
      note: { ...ada, relations: [{ targetId: third.id, label: 'Quelle' }] },
    }),
  );
  threadSelection(x);
  await x.activate();
  await openThreadEditor(x);
  return third;
}
test('nested maps keep parent choices, staged sources, destination and the single original writer', async (t) => {
  const x = await fixture(t),
    third = await nestedThread(x),
    editor = x.el('note-editor');
  x.el('note-thread-return').click();
  await until(() => x.el('note-thread-editor').hidden);
  x.el('note-thread-include-root').checked = false;
  const box = x.el('note-thread-sources').querySelector('input');
  box.checked = false;
  box.onchange();
  x.el('note-thread-plan').value = '';
  x.el('note-thread-plan').onchange();
  x.el('note-thread-plan-name').value = 'Eigener Abend';
  x.el('note-thread-visit-title').value = 'Eigener Besuch';
  x.el('note-thread-search').value = 'Wachwechsel';
  x.el('note-thread-find').click();
  await until(() => x.el('note-thread-candidates').querySelector('input'));
  const candidate = x.el('note-thread-candidates').querySelector('input');
  candidate.checked = true;
  candidate.onchange();
  x.el('note-thread-sources').querySelector('button').click();
  await until(() => x.el('note-title').value === 'Ada' && !x.el('note-thread-return').disabled);
  x.el('note-thread-open').click();
  await until(
    () =>
      x.el('note-thread-heading').textContent === 'Notizmappe: Ada' &&
      !x.el('note-thread-use').disabled,
  );
  assert.equal(x.el('note-thread-parent').textContent, 'Zur Mappe: Borin');
  x.el('note-thread-sources').querySelector('button').click();
  await until(
    () => x.el('note-title').value === 'Wachwechsel' && !x.el('note-thread-return').disabled,
  );
  assert.equal(x.el('note-editor'), editor);
  x.el('note-gm').value = 'Neue Wachzeit';
  x.el('note-gm').dispatchEvent(new x.window.Event('input'));
  x.el('note-thread-parent').click();
  await until(
    () =>
      x.el('note-thread-heading').textContent === 'Notizmappe: Borin' &&
      !x.el('note-thread-parent').disabled,
  );
  assert.equal(x.el('note-thread-include-root').checked, false);
  assert.equal(x.el('note-thread-sources').querySelector('input').checked, false);
  assert.equal(x.el('note-thread-plan-name').value, 'Eigener Abend');
  assert.equal(x.el('note-thread-visit-title').value, 'Eigener Besuch');
  assert.equal(x.el('note-thread-search').value, 'Wachwechsel');
  assert.equal(x.el('note-thread-candidates').querySelector('input').checked, true);
  assert.equal(x.el('note-editor'), editor);
  assert.equal(x.writes.length, 1);
  assert.equal(x.writes[0].change.note.id, third.id);
  assert.equal(
    x.store.preparation(x.workspace.token).notes.find((r) => r.note.id === third.id).note.gmNotes,
    'Neue Wachzeit',
  );
});
test('nested map navigation protects composing input and cyclic ancestors use the existing return path', async (t) => {
  const x = await fixture(t);
  await nestedThread(x);
  const field = x.el('note-gm');
  field.dispatchEvent(new x.window.Event('compositionstart', { bubbles: true }));
  field.value = 'Noch im Schreiben';
  field.dispatchEvent(new x.window.Event('input'));
  x.el('note-thread-open').click();
  await settle();
  assert.equal(x.el('note-thread-heading').textContent, 'Notizmappe: Borin');
  assert.equal(x.el('note-thread-editor').hidden, false);
  assert.equal(x.writes.length, 0);
  field.dispatchEvent(new x.window.Event('compositionend', { bubbles: true }));
  x.el('note-thread-open').click();
  await until(
    () =>
      x.el('note-thread-heading').textContent === 'Notizmappe: Ada' &&
      !x.el('note-thread-use').disabled,
  );
  x.el('note-thread-sources').querySelector('button').click();
  await until(
    () => x.el('note-title').value === 'Wachwechsel' && !x.el('note-thread-return').disabled,
  );
  x.el('note-thread-open').click();
  await until(
    () =>
      x.el('note-thread-heading').textContent === 'Notizmappe: Wachwechsel' &&
      !x.el('note-thread-use').disabled,
  );
  x.el('note-thread-sources').querySelector('button').click();
  await until(() => x.el('note-title').value === 'Borin' && !x.el('note-thread-return').disabled);
  x.el('note-thread-open').click();
  await settle();
  assert.equal(x.el('note-thread-heading').textContent, 'Notizmappe: Wachwechsel');
  assert.match(x.el('note-thread-editor-status').textContent, /liegt bereits im Rückweg/);
  assert.equal(x.el('note-thread-parent').textContent, 'Zur Mappe: Ada');
  assert.equal(x.writes.length, 1);
});
test('following an original relationship inside a map retains the map and its destination', async (t) => {
  const x = await fixture(t);
  await nestedThread(x);
  const editor = x.el('note-editor');
  [...x.el('note-relations').querySelectorAll('button')]
    .find((b) => b.textContent === 'Quelle: Wachwechsel')
    .click();
  await until(
    () => x.el('note-title').value === 'Wachwechsel' && !x.el('note-thread-return').disabled,
  );
  assert.equal(x.el('note-thread-dialog').open, true);
  assert.equal(x.el('note-thread-heading').textContent, 'Notizmappe: Borin');
  assert.equal(x.el('note-editor'), editor);
  x.el('note-thread-return').click();
  await until(() => x.el('note-thread-editor').hidden);
  assert.equal(x.el('note-title').value, 'Borin');
  assert.equal(x.writes.length, 0);
});
test('an unresolved original save blocks nested navigation until its existing receipt is checked once', async (t) => {
  const x = await fixture(t);
  await nestedThread(x);
  const send = x.window.campaign.changePreparation;
  let calls = 0;
  x.window.campaign.changePreparation = async (c) => {
    calls++;
    await send(c);
    throw Error('Antwort verloren');
  };
  x.el('note-gm').value = 'Geänderter Unterstrang';
  x.el('note-gm').dispatchEvent(new x.window.Event('input'));
  x.el('note-thread-open').click();
  await until(() => !x.el('preparation-reconcile').hidden && !x.el('note-thread-return').disabled);
  assert.equal(x.el('note-thread-heading').textContent, 'Notizmappe: Borin');
  assert.equal(x.el('note-thread-editor').hidden, false);
  assert.equal(calls, 1);
  x.el('note-thread-open').click();
  await settle();
  assert.equal(calls, 1);
  x.el('preparation-reconcile').click();
  await until(() => x.el('preparation-reconcile').hidden && !x.el('note-gm').disabled);
  x.el('note-thread-open').click();
  await until(
    () =>
      x.el('note-thread-heading').textContent === 'Notizmappe: Ada' &&
      !x.el('note-thread-use').disabled,
  );
  assert.equal(calls, 1);
  assert.equal(x.writes.length, 1);
});
test('a late parent reread cannot reopen the map or restore its editor after campaign activation', async (t) => {
  const x = await fixture(t);
  await nestedThread(x);
  x.el('note-thread-open').click();
  await until(
    () =>
      x.el('note-thread-heading').textContent === 'Notizmappe: Ada' &&
      !x.el('note-thread-use').disabled,
  );
  const read = x.window.campaign.noteThread;
  let release;
  x.window.campaign.noteThread = async (...a) => {
    const result = await read(...a);
    if (a[1] === x.ids.borin) await new Promise((r) => (release = r));
    return result;
  };
  x.el('note-thread-parent').click();
  await until(() => !!release);
  const other = x.store.create('Andere Kampagne'),
    w = x.store.activate(other.id),
    id = randomUUID();
  x.store.changePreparation({
    commandId: randomUUID(),
    token: w.token,
    campaignId: other.id,
    change: {
      kind: 'note',
      expectedRevision: null,
      note: { ...x.original, id, title: 'Neues Original' },
    },
  });
  x.setOwner(w);
  await x.ui.activatePreparation(w);
  release();
  await settle();
  assert.equal(x.el('note-thread-dialog').open, false);
  assert.equal(x.el('note-thread-editor').contains(x.el('note-editor')), false);
  assert.equal(x.writes.length, 0);
});
test('contextual thread editing uses the same writer, protects composition and returns to the original map with current source text', async (t) => {
  const x = await fixture(t);
  threadSelection(x);
  await x.activate();
  const original = x.el('note-editor');
  await openThreadEditor(x);
  assert.equal(x.el('note-editor'), original);
  assert(x.el('note-thread-editor').contains(original));
  const field = x.el('note-gm');
  field.dispatchEvent(new x.window.Event('compositionstart', { bubbles: true }));
  field.value = 'Neue Tatsache nach dem Abend';
  field.dispatchEvent(new x.window.Event('input'));
  x.el('note-thread-return').onclick();
  await until(() => !x.el('note-thread-return').disabled);
  assert.equal(x.el('note-thread-editor').hidden, false);
  assert.equal(x.writes.length, 0);
  field.dispatchEvent(new x.window.Event('compositionend', { bubbles: true }));
  x.el('note-thread-return').onclick();
  await until(() => x.el('note-thread-editor').hidden);
  assert.equal(x.el('note-title').value, 'Borin');
  assert.match(x.el('note-thread-sources').textContent, /Neue Tatsache nach dem Abend/);
  assert.equal(x.el('note-thread-sources').querySelector('input').checked, true);
  assert.equal(x.writes.length, 1);
  assert.equal(x.writes[0].change.note.id, x.ids.ada);
  assert.equal(
    x.store.preparation(x.workspace.token).notes.find((r) => r.note.id === x.ids.ada).note
      .readAloud,
    '  Original\r\n',
  );
});
test('a lost contextual note reply retains the editor until its existing Preparation receipt is explicitly checked', async (t) => {
  const x = await fixture(t);
  threadSelection(x);
  await x.activate();
  await openThreadEditor(x);
  const send = x.window.campaign.changePreparation;
  let calls = 0;
  x.window.campaign.changePreparation = async (c) => {
    calls++;
    await send(c);
    throw Error('Antwort verloren');
  };
  x.el('note-gm').value = 'Neue Tatsache';
  x.el('note-gm').dispatchEvent(new x.window.Event('input'));
  x.el('note-thread-return').onclick();
  await until(() => !x.el('note-thread-return').disabled);
  assert.equal(x.el('note-thread-editor').hidden, false);
  assert.equal(x.el('preparation-reconcile').hidden, false);
  x.el('preparation-reconcile').onclick();
  await until(() => x.el('preparation-reconcile').hidden);
  x.el('note-thread-return').onclick();
  await until(() => x.el('note-thread-editor').hidden);
  assert.equal(calls, 1);
  assert.equal(x.writes.length, 1);
  assert.equal(x.el('note-title').value, 'Borin');
  assert.match(x.el('note-thread-sources').textContent, /Neue Tatsache/);
});
test('an unknown contextual Preparation receipt retains the editor and never resends while status is unresolved', async (t) => {
  const x = await fixture(t);
  threadSelection(x);
  await x.activate();
  await openThreadEditor(x);
  const send = x.window.campaign.changePreparation,
    status = x.window.campaign.reconcilePreparation;
  let calls = 0;
  x.window.campaign.changePreparation = async (c) => {
    calls++;
    await send(c);
    throw Error('Antwort verloren');
  };
  x.window.campaign.reconcilePreparation = async () => ({
    ok: false,
    error: 'Status nicht erreichbar',
  });
  x.el('note-gm').value = 'Gesicherte neue Tatsache';
  x.el('note-gm').dispatchEvent(new x.window.Event('input'));
  x.el('note-thread-return').onclick();
  await until(() => !x.el('note-thread-return').disabled);
  assert.equal(x.el('note-thread-editor').hidden, false);
  assert.equal(calls, 1);
  x.el('preparation-reconcile').onclick();
  await until(() => x.messages.some((m) => m.text.includes('Status bleibt ungeklärt')));
  x.el('note-thread-return').onclick();
  await until(() => !x.el('note-thread-return').disabled);
  assert.equal(calls, 1);
  x.window.campaign.reconcilePreparation = status;
  x.el('preparation-reconcile').onclick();
  await until(() => x.el('preparation-reconcile').hidden);
  x.el('note-thread-return').onclick();
  await until(() => x.el('note-thread-editor').hidden);
  assert.equal(calls, 1);
});
test('a delayed contextual source opening cannot take the editor from another activated campaign', async (t) => {
  const x = await fixture(t);
  threadSelection(x);
  await x.activate();
  await x.ui.openPreparedNote(x.ids.borin);
  x.el('note-thread-open').onclick();
  await until(() => x.el('note-thread-sources').querySelector('article'));
  const read = x.window.campaign.preparation;
  let release,
    held = false;
  x.window.campaign.preparation = async (...a) => {
    const result = await read(...a);
    if (!held) {
      held = true;
      await new Promise((r) => (release = r));
    }
    return result;
  };
  [...x.el('note-thread-sources').querySelectorAll('button')]
    .find((b) => b.textContent === 'Notiz bearbeiten…')
    .onclick();
  await until(() => !!release);
  const campaign = x.store.create('Andere Kampagne'),
    w = x.store.activate(campaign.id),
    id = randomUUID();
  x.store.changePreparation({
    commandId: randomUUID(),
    token: w.token,
    campaignId: campaign.id,
    change: {
      kind: 'note',
      expectedRevision: null,
      note: { ...x.original, id, title: 'Andere Originalnotiz' },
    },
  });
  x.setOwner(w);
  await x.ui.activatePreparation(w);
  release();
  await settle();
  assert.equal(x.el('note-title').value, 'Andere Originalnotiz');
  assert.equal(x.el('note-thread-dialog').open, false);
  assert.equal(x.el('note-editor').closest('#note-thread-editor'), null);
  assert.equal(x.writes.length, 0);
});
test('a rumor completed in the contextual editor disappears from active sources while its relationship and original prose stay intact', async (t) => {
  const x = await fixture(t),
    id = randomUUID(),
    rumor = {
      ...x.original,
      id,
      kind: 'rumor',
      title: 'Erledigte Spur',
      gmNotes: 'Unveränderte Quellenprosa',
      relations: [],
    };
  x.store.changePreparation(x.command({ kind: 'note', expectedRevision: null, note: rumor }));
  x.store.changePreparation(
    x.command({
      kind: 'note',
      expectedRevision: 1,
      note: { ...x.original, relations: [{ targetId: id, label: 'Quelle' }] },
    }),
  );
  await x.activate();
  await openThreadEditor(x, id);
  const field = x.el('narrative-editor').querySelector('[aria-label="Narrativer Status"]');
  field.value = 'closed';
  field.onchange();
  [...x.el('narrative-editor').querySelectorAll('button')]
    .find((b) => b.textContent === 'Narrative Angaben speichern')
    .onclick();
  await until(() => x.store.narrative(x.workspace.token, id).state.status === 'closed');
  await until(() =>
    x.messages.some((m) => m.text === 'Quest-/Gerüchtstatus und Belohnung gespeichert.'),
  );
  x.el('note-thread-return').onclick();
  await until(() => x.el('note-thread-editor').hidden);
  assert.equal(x.el('note-thread-sources').querySelectorAll('article').length, 0);
  const prep = x.store.preparation(x.workspace.token);
  assert.deepEqual(prep.notes.find((n) => n.note.id === id).note, rumor);
  assert.deepEqual(prep.notes.find((n) => n.note.id === x.ids.borin).note.relations, [
    { targetId: id, label: 'Quelle' },
  ]);
});

test('saving a renamed plan immediately updates the selected plan label', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await x.ui.prepareNextVisit(null, {
    title: 'Schleuse',
    notes: 'Eigene Vorbereitung',
    locationId: null,
  });
  await settle();
  x.el('plan-name').value = 'Nacht an der Schleuse';
  x.el('plan-name').dispatchEvent(new x.window.Event('input', { bubbles: true }));
  assert.equal(await x.ui.flushPreparation(), true);
  const saved = x.store
    .preparation(x.workspace.token)
    .plans.find((p) => p.id === x.el('plans').value);
  assert.equal(saved.name, 'Nacht an der Schleuse');
  assert.equal(
    [...x.el('plans').options].find((o) => o.value === saved.id).textContent,
    saved.name,
  );
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

test('encounter count belongs to its plan, survives reopening and clears back to automatic', async (t) => {
  const x = await fixture(t);
  await x.activate();
  x.el('plan-create').click();
  await until(() => !!x.el('plans').value);
  await settle();
  const first = x.el('plans').value;
  x.el('session-scene-count').value = '3';
  x.el('session-scene-count').oninput();
  assert.equal(await x.ui.flushPreparation(), true);
  assert.equal(x.store.session(x.workspace.token, first).profile.encounterCount, 3);
  x.el('plan-create').click();
  await until(() => x.el('plans').value !== first);
  await settle();
  assert.equal(x.el('session-scene-count').value, '');
  x.el('session-scene-count').value = '7';
  x.el('session-scene-count').oninput();
  assert.equal(await x.ui.flushPreparation(), true);
  x.store.selectPreparation(x.workspace.token, { noteId: null, planId: first, sceneId: null });
  await x.activate();
  await settle();
  assert.equal(x.el('session-scene-count').value, '3');
  x.el('session-scene-count').value = '';
  x.el('session-scene-count').oninput();
  assert.equal(await x.ui.flushPreparation(), true);
  assert.equal(x.store.session(x.workspace.token, first).profile.encounterCount, null);
  await x.activate();
  await settle();
  assert.equal(x.el('session-scene-count').value, '');
  for (const bad of [0, 11, 1.5]) {
    const profile = x.store.session(x.workspace.token, first).profile;
    assert.throws(
      () =>
        x.store.executeSession({
          commandId: randomUUID(),
          campaignId: x.campaign.id,
          token: x.workspace.token,
          action: {
            kind: 'profile',
            profile: { ...profile, encounterCount: bad },
            expectedRevision: profile.revision,
          },
        }),
      /Begegnungszahl/,
    );
    assert.equal(x.store.session(x.workspace.token, first).profile.revision, profile.revision);
  }
});

async function manualReward(t) {
  const x = await fixture(t);
  await x.activate();
  const target = await x.ui.prepareNextVisit(null, {
    title: 'Belohnter Besuch',
    notes: '  Exakte Planung\r\n',
    locationId: null,
  });
  await settle();
  x.el('visit-has-reward').checked = true;
  x.el('visit-has-reward').oninput();
  x.el('visit-reward-xp').value = '60';
  x.el('visit-reward-xp').oninput();
  assert.equal(await x.ui.flushPreparation(), true);
  await settle();
  const send = x.window.campaign.executeSession,
    calls = [];
  x.window.campaign.executeSession = async (c) => {
    calls.push(c);
    return send(c);
  };
  return {
    ...x,
    target,
    calls,
    reward: () =>
      x.store
        .session(x.workspace.token, target.planId)
        .visits.find((v) => v.visitId === target.visitId).reward,
  };
}
test('an empty manual reward XP input cannot autosave as zero or release navigation; explicit zero remains valid', async (t) => {
  const x = await manualReward(t),
    original = x.reward(),
    before = x.store.db.serialize();
  x.el('visit-reward-xp').value = '';
  x.el('visit-reward-xp').oninput();
  x.el('visit-reward-save').click();
  await settle();
  assert.equal(x.calls.length, 0, 'unfinished XP must not dispatch a mutation');
  assert.deepEqual(x.reward(), original);
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(x.el('visit-reward-xp').value, '');
  assert.equal(await x.ui.leavePreparation(), false);
  assert.match(x.messages.at(-1).text, /Story-XP/);
  x.el('visit-reward-xp').value = '0';
  x.el('visit-reward-xp').oninput();
  assert.equal(await x.ui.flushPreparation(), true);
  assert.equal(x.calls.length, 1);
  assert.equal(x.reward().poolXp, 0);
  assert.equal(x.reward().id, original.id);
});
test('removing the manual reward remains possible while its XP field is unfinished', async (t) => {
  const x = await manualReward(t);
  x.el('visit-reward-xp').value = '';
  x.el('visit-reward-xp').oninput();
  x.el('visit-has-reward').checked = false;
  x.el('visit-has-reward').oninput();
  assert.equal(await x.ui.flushPreparation(), true);
  assert.equal(x.reward(), null);
  assert.equal(x.calls.length, 1);
});

async function sourceRemovalFixture(t) {
  const x = await fixture(t),
    link = '[Ada](dungeon-ref:note/' + x.ids.ada + ')',
    root = {
      ...x.original,
      readAloud: '  Vor ' + link + '\r\n',
      gmNotes: 'GM ' + link + '\r\n`' + link + '`',
      relations: [
        { targetId: x.ids.ada, label: 'Quelle' },
        { targetId: x.ids.ada, label: 'kennt' },
      ],
    },
    other = {
      ...x.original,
      id: randomUUID(),
      title: 'Andere Mappe',
      relations: [{ targetId: x.ids.ada, label: 'Quelle' }],
    };
  x.store.changePreparation(
    x.command({ kind: 'note', expectedRevision: root.revision, note: root }),
  );
  x.store.changePreparation(x.command({ kind: 'note', expectedRevision: null, note: other }));
  const originalAda = x.store
    .preparation(x.workspace.token)
    .notes.find((r) => r.note.id === x.ids.ada).note;
  await x.activate();
  await x.ui.openPreparedNote(x.ids.borin);
  x.el('note-thread-open').click();
  await until(() => x.el('note-thread-sources').querySelector('article'));
  const confirm = () =>
    [...x.el('note-thread-sources').querySelectorAll('button')]
      .find((b) => b.textContent === 'Verknüpfungen hier lösen')
      .click();
  return {
    ...x,
    link,
    root,
    other,
    originalAda,
    confirm,
    saved: () =>
      x.store.preparation(x.workspace.token).notes.find((r) => r.note.id === x.ids.borin).note,
  };
}
test('unlinking a mapped source publishes prose and all root relationships in one original writer command', async (t) => {
  const x = await sourceRemovalFixture(t);
  x.confirm();
  await until(
    () =>
      x.el('note-thread-editor').hidden && !x.el('note-thread-sources').querySelector('article'),
  );
  assert.equal(x.writes.length, 1);
  assert.equal(x.writes[0].change.kind, 'note');
  assert.equal(x.writes[0].change.note.id, x.ids.borin);
  assert.equal(x.saved().readAloud, '  Vor Ada\r\n');
  assert.equal(x.saved().gmNotes, 'GM Ada\r\n`' + x.link + '`');
  assert.deepEqual(x.saved().relations, []);
  const p = x.store.preparation(x.workspace.token);
  assert.deepEqual(p.notes.find((r) => r.note.id === x.ids.ada).note, x.originalAda);
  assert.deepEqual(p.notes.find((r) => r.note.id === x.other.id).note, x.other);
  assert.equal(x.el('note-editor').closest('#note-thread-editor'), null);
});
test('a newer overview is loaded for review and rejects an old source removal before dispatch', async (t) => {
  const x = await sourceRemovalFixture(t),
    before = x.saved();
  x.store.changePreparation(
    x.command({
      kind: 'note',
      expectedRevision: before.revision,
      note: { ...before, gmNotes: before.gmNotes + '\r\nNeuer Autorenfakt' },
    }),
  );
  x.confirm();
  await until(() =>
    x.el('note-thread-editor-status').textContent.includes('Verknüpfungen erneut prüfen'),
  );
  assert.equal(x.writes.length, 0);
  assert.equal(x.el('note-thread-editor').hidden, false);
  assert.match(x.el('note-gm').value, /Neuer Autorenfakt/);
  assert.deepEqual(x.saved().relations, before.relations);
  assert.equal(x.saved().gmNotes, before.gmNotes + '\r\nNeuer Autorenfakt');
});
test('a lost unlink response uses the original manual Preparation receipt check and never resends the unlink', async (t) => {
  const x = await sourceRemovalFixture(t),
    send = x.window.campaign.changePreparation;
  let calls = 0;
  x.window.campaign.changePreparation = async (c) => {
    calls++;
    await send(c);
    throw Error('Antwort verloren');
  };
  x.confirm();
  await until(() => !x.el('preparation-reconcile').hidden && !x.el('note-thread-return').disabled);
  assert.equal(calls, 1);
  assert.equal(x.el('note-thread-editor').hidden, false);
  assert(x.el('note-thread-editor').contains(x.el('preparation-reconcile')));
  assert.deepEqual(x.saved().relations, []);
  x.el('note-thread-return').click();
  await until(() => !x.el('note-thread-return').disabled);
  assert.equal(calls, 1);
  assert.equal(x.el('note-thread-editor').hidden, false);
  x.el('preparation-reconcile').click();
  await until(() => x.el('preparation-reconcile').hidden);
  x.el('note-thread-return').click();
  await until(
    () =>
      x.el('note-thread-editor').hidden && !x.el('note-thread-sources').querySelector('article'),
  );
  assert.equal(calls, 1);
  assert.equal(x.writes.length, 1);
  assert.equal(x.saved().readAloud, '  Vor Ada\r\n');
  assert.equal(x.saved().gmNotes, 'GM Ada\r\n`' + x.link + '`');
});

test('returning from a newly created place refreshes the quest location choices and preserves its status', async (t) => {
  const x = await fixture(t),
    note = {
      ...x.original,
      id: randomUUID(),
      revision: 1,
      kind: 'quest',
      title: 'Der verschwundene Bote',
    };
  x.store.changePreparation(x.command({ kind: 'note', expectedRevision: null, note }));
  await x.activate();
  await x.ui.openPreparedNote(note.id);
  assert.equal(
    x.el('narrative-editor').querySelector('[aria-label="Quest-Ort"]').options.length,
    1,
  );
  x.el('locations-tab').click();
  await settle();
  x.el('new-location-name').value = 'Alte Brücke';
  x.el('new-location-type').value = 'poi';
  x.el('location-form').onsubmit({ preventDefault() {} });
  await settle();
  const place = x.store
    .preparation(x.workspace.token)
    .locations.find((row) => row.document.name === 'Alte Brücke');
  assert.ok(place);
  x.el('knowledge-tab').click();
  await settle();
  const panel = x.el('narrative-editor'),
    choice = panel.querySelector('[aria-label="Quest-Ort"]');
  assert.ok([...choice.options].some((option) => option.value === place.document.id));
  choice.value = place.document.id;
  choice.onchange();
  const status = panel.querySelector('[aria-label="Narrativer Status"]');
  status.value = 'closed';
  status.onchange();
  assert.equal(await x.ui.flushPreparation(), true);
  await x.activate();
  await x.ui.openPreparedNote(note.id);
  const saved = x.store.narrative(x.workspace.token, note.id);
  assert.equal(saved.state.locationId, place.document.id);
  assert.equal(saved.state.status, 'closed');
  assert.equal(saved.award, null);
  assert.equal(
    x.el('narrative-editor').querySelector('[aria-label="Quest-Ort"]').value,
    place.document.id,
  );
});

test('a lost source recovery response retains the manual receipt check and preserves later author work exactly once', async (t) => {
  const x = await sourceRemovalFixture(t);
  x.confirm();
  await until(
    () =>
      x.el('note-thread-editor').hidden && !x.el('note-thread-sources').querySelector('article'),
  );
  const button = (name) =>
    [...x.el('note-thread-dialog').querySelectorAll('button')].find((b) => b.textContent === name);
  button('Übersichtsnotiz bearbeiten…').click();
  await until(() => !x.el('note-thread-editor').hidden && !x.el('note-thread-return').disabled);
  x.el('note-gm').value += '\r\nSpätere Erkenntnis bleibt.';
  x.el('note-gm').dispatchEvent(new x.window.Event('input'));
  x.el('note-thread-return').click();
  await until(() => x.el('note-thread-editor').hidden);
  button('Gelöste Quellen wiederherstellen…').click();
  await until(() => button('Verknüpfungen wiederherstellen'));
  const send = x.window.campaign.changePreparation;
  let calls = 0;
  x.window.campaign.changePreparation = async (c) => {
    calls++;
    await send(c);
    throw Error('Antwort verloren');
  };
  button('Verknüpfungen wiederherstellen').click();
  await until(() => !x.el('preparation-reconcile').hidden && !x.el('note-thread-return').disabled);
  assert.equal(calls, 1);
  assert.equal(x.el('note-thread-editor').hidden, false);
  assert(x.el('note-thread-editor').contains(x.el('preparation-reconcile')));
  assert.equal(x.saved().relations.length, 2);
  assert.match(x.saved().gmNotes, /Spätere Erkenntnis bleibt/);
  assert.equal(x.saved().readAloud, x.root.readAloud);
  x.el('note-thread-return').click();
  await until(() => !x.el('note-thread-return').disabled);
  assert.equal(calls, 1);
  assert.equal(x.el('note-thread-editor').hidden, false);
  x.el('preparation-reconcile').click();
  await until(() => x.el('preparation-reconcile').hidden);
  x.el('note-thread-return').click();
  await until(
    () => x.el('note-thread-editor').hidden && x.el('note-thread-sources').querySelector('article'),
  );
  assert.equal(calls, 1);
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM note_source_history').get().n, 1);
});

async function trashedMapSource(t) {
  const x = await sourceRemovalFixture(t);
  x.store.changePreparation(
    x.command({ kind: 'note-trash', id: x.ids.ada, expectedRevision: 1, trashed: true }),
  );
  const button = (name) =>
    [...x.el('note-thread-dialog').querySelectorAll('button')].find((b) => b.textContent === name);
  button('Aktualisieren').click();
  await until(() => button('Original im Papierkorb ansehen…'));
  const originalEditor = x.el('note-editor');
  button('Original im Papierkorb ansehen…').click();
  await until(
    () =>
      !x.el('note-thread-editor').hidden &&
      !x.el('note-restore').hidden &&
      !x.el('note-thread-return').disabled,
  );
  assert.equal(x.el('note-gm').disabled, true);
  assert.equal(x.el('note-gm').value, x.originalAda.gmNotes.replace(/\r\n/g, '\n'));
  assert.strictEqual(x.el('note-editor'), originalEditor);
  return { ...x, button, originalEditor };
}
test('restore and re-trash of a mapped original stay in its editor and retain the original root assignments', async (t) => {
  const x = await trashedMapSource(t);
  x.el('note-restore').click();
  await until(() => !x.el('note-gm').disabled && x.el('note-restore').hidden);
  assert.equal(x.el('note-thread-dialog').open, true);
  assert.strictEqual(x.el('note-editor'), x.originalEditor);
  assert.equal(x.writes.length, 1);
  assert.deepEqual(x.writes[0].change, {
    kind: 'note-trash',
    id: x.ids.ada,
    expectedRevision: 2,
    trashed: false,
  });
  x.el('note-remove').click();
  await until(() => !x.el('note-restore').hidden && x.el('note-gm').disabled);
  assert.equal(x.el('note-thread-dialog').open, true);
  x.el('note-restore').click();
  await until(() => x.el('note-restore').hidden && !x.el('note-gm').disabled);
  assert.equal(x.writes.length, 3);
  x.el('note-thread-return').click();
  await until(
    () =>
      x.el('note-thread-editor').hidden &&
      x.el('note-thread-sources').textContent.includes(x.originalAda.gmNotes),
  );
  assert.deepEqual(x.saved().relations, x.root.relations);
  assert.equal(x.saved().gmNotes, x.root.gmNotes);
  const source = x.store.preparation(x.workspace.token).notes.find((r) => r.note.id === x.ids.ada);
  assert.equal(source.trashed, false);
  assert.deepEqual({ ...source.note, revision: 1 }, x.originalAda);
  assert.equal(source.note.revision, 5);
});
test('lost original-note restore acknowledgement stays manually reconcilable in the map and is never automatically resent', async (t) => {
  const x = await trashedMapSource(t),
    send = x.window.campaign.changePreparation;
  let calls = 0;
  x.window.campaign.changePreparation = async (c) => {
    calls++;
    await send(c);
    throw Error('Antwort der Wiederherstellung verloren');
  };
  x.el('note-restore').click();
  await until(() => !x.el('preparation-reconcile').hidden && !x.el('note-thread-return').disabled);
  assert.equal(calls, 1);
  assert.equal(x.el('note-thread-dialog').open, true);
  assert(x.el('note-thread-editor').contains(x.el('preparation-reconcile')));
  assert.equal(
    x.store.preparation(x.workspace.token).notes.find((r) => r.note.id === x.ids.ada).trashed,
    false,
  );
  x.el('note-thread-return').click();
  await until(() => !x.el('note-thread-return').disabled);
  assert.equal(x.el('note-thread-editor').hidden, false);
  assert.equal(calls, 1);
  x.el('preparation-reconcile').click();
  await until(
    () =>
      x.el('preparation-reconcile').hidden &&
      !x.el('note-gm').disabled &&
      x.el('note-restore').hidden,
  );
  assert.strictEqual(x.el('note-editor'), x.originalEditor);
  x.el('note-thread-return').click();
  await until(() => x.el('note-thread-editor').hidden);
  assert.equal(calls, 1);
  assert.deepEqual(x.saved().relations, x.root.relations);
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM note_source_history').get().n, 0);
});

async function candidateSourceFixture(t) {
  const x = await sourceRemovalFixture(t),
    candidate = {
      ...x.originalAda,
      id: randomUUID(),
      title: 'Ada',
      gmNotes: 'Aktueller Einsatz: Nordtor. Kupfermarken.',
    };
  x.store.changePreparation(x.command({ kind: 'note', expectedRevision: null, note: candidate }));
  const search = x.el('note-thread-search');
  search.value = 'Kupfermarken';
  search.oninput();
  x.el('note-thread-find').click();
  await until(() => x.el('note-thread-candidates').querySelector('button'));
  const originalEditor = x.el('note-editor');
  x.el('note-thread-candidates').querySelector('button').click();
  await until(
    () => !x.el('note-thread-editor').hidden && !x.el('note-thread-choose-source').disabled,
  );
  assert.equal(x.el('note-title').value, candidate.title);
  assert.equal(x.el('note-gm').value, candidate.gmNotes);
  assert.strictEqual(x.el('note-editor'), originalEditor);
  x.el('note-thread-choose-source').click();
  await until(() => x.el('note-thread-editor').hidden && !x.el('note-thread-add').disabled);
  assert.equal(x.writes.length, 0);
  return { ...x, candidate, originalEditor };
}
test('a candidate chosen in the original editor adds only that ID in one root note command', async (t) => {
  const x = await candidateSourceFixture(t);
  x.el('note-thread-add').click();
  await until(
    () =>
      x.el('note-thread-editor').hidden &&
      x.el('note-thread-sources').textContent.includes(x.candidate.gmNotes),
  );
  assert.equal(x.writes.length, 1);
  assert.equal(x.writes[0].change.kind, 'note');
  assert.equal(x.writes[0].change.note.id, x.root.id);
  assert.deepEqual(x.saved().relations, [
    ...x.root.relations,
    { targetId: x.candidate.id, label: 'Quelle' },
  ]);
  assert.equal(x.saved().gmNotes, x.root.gmNotes);
  assert.deepEqual(
    x.store.preparation(x.workspace.token).notes.find((r) => r.note.id === x.candidate.id).note,
    x.candidate,
  );
  assert.equal(x.el('note-thread-add').disabled, true);
});
test('a lost candidate-link acknowledgement retains the root manual receipt controls and prunes the confirmed staged ID without resend', async (t) => {
  const x = await candidateSourceFixture(t),
    send = x.window.campaign.changePreparation;
  let calls = 0;
  x.window.campaign.changePreparation = async (c) => {
    calls++;
    await send(c);
    throw Error('Antwort verloren');
  };
  x.el('note-thread-add').click();
  await until(() => !x.el('preparation-reconcile').hidden && !x.el('note-thread-return').disabled);
  assert.equal(calls, 1);
  assert(x.el('note-thread-editor').contains(x.el('preparation-reconcile')));
  assert.strictEqual(x.el('note-editor'), x.originalEditor);
  assert.equal(x.saved().relations.at(-1).targetId, x.candidate.id);
  x.el('note-thread-return').click();
  await until(() => !x.el('note-thread-return').disabled);
  assert.equal(x.el('note-thread-editor').hidden, false);
  assert.equal(calls, 1);
  x.el('preparation-reconcile').click();
  await until(() => x.el('preparation-reconcile').hidden);
  x.el('note-thread-return').click();
  await until(() => x.el('note-thread-editor').hidden);
  assert.equal(calls, 1);
  assert.equal(x.el('note-thread-add').disabled, true);
  assert.equal(x.el('note-thread-candidates').querySelectorAll('input:checked').length, 0);
  assert.deepEqual(
    x.store.preparation(x.workspace.token).notes.find((r) => r.note.id === x.candidate.id).note,
    x.candidate,
  );
});

async function encounterSearchFixture(t) {
  const x = await fixture(t);
  for (let i = 0; i < 12; i++)
    x.store.saveEncounterPlan({
      commandId: randomUUID(),
      campaignId: x.campaign.id,
      token: x.workspace.token,
      expectedRevision: null,
      plan: {
        id: randomUUID(),
        name: 'Wache ' + String(i).padStart(2, '0'),
        notes: 'Original',
        party: [],
        entries: [],
        sources: [],
        catalogHash: '',
      },
    });
  const calls = [],
    read = x.window.campaign.encounterPlans;
  x.window.campaign.encounterPlans = async (...args) => {
    calls.push(args);
    return read(...args);
  };
  await x.activate();
  await x.ui.prepareNextVisit(null, { title: 'Besuch', notes: '  Roh\r\n', locationId: null });
  await settle();
  return {
    ...x,
    calls,
    search: async (text) => {
      x.el('visit-encounter-search').value = text;
      x.el('visit-encounter-search').oninput();
      await settle();
    },
  };
}
test('session reads and new receipts omit the global Encounter catalog; inspector searches only on demand with eight choices', async (t) => {
  const x = await encounterSearchFixture(t),
    id = x.el('plans').value;
  assert.equal(x.calls.length, 0);
  assert.deepEqual(x.store.session(x.workspace.token, id).encounters, []);
  await x.search('W');
  assert.equal(x.calls.length, 0);
  await x.search('Wache');
  assert.equal(x.calls.length, 1);
  assert.equal(x.calls[0][2], 9);
  assert.equal(x.el('visit-encounter').querySelectorAll('option').length, 9);
  assert.match(x.el('visit-encounter-status').textContent, /eingrenzen/);
  await x.search('Wache 11');
  const option = x.el('visit-encounter').querySelectorAll('option')[1];
  x.el('visit-encounter').value = option.value;
  x.el('visit-encounter').onchange();
  assert.equal(x.el('visit-attach').disabled, false);
  x.el('visit-attach').click();
  await until(() => x.store.session(x.workspace.token, id).groups.length === 1);
  await settle();
  assert.equal(x.store.session(x.workspace.token, id).groups[0].sourceEncounterId, option.value);
  assert.equal(x.el('visit-encounter-search').value, 'Wache 11');
  const row = x.store.db
    .prepare('SELECT payload FROM session_receipt ORDER BY rowid DESC LIMIT 1')
    .get();
  assert.deepEqual(JSON.parse(row.payload).encounters, []);
  assert.equal(x.store.encounterPlans(x.workspace.token, '').length, 12);
  assert.equal(x.store.encounterPlans(x.workspace.token, 'Wache', 3).length, 3);
  assert.throws(() => x.store.encounterPlans(x.workspace.token, 'Wache', 0), /Suchgrenze/);
});
for (const outcome of ['result', 'failure'])
  test(`late Encounter search ${outcome} cannot replace a newer query or selected visit`, async (t) => {
    const x = await encounterSearchFixture(t),
      read = x.window.campaign.encounterPlans;
    let finish;
    x.window.campaign.encounterPlans = async (...args) =>
      args[1] === 'Wache'
        ? new Promise(
            (r) =>
              (finish = () =>
                r(
                  outcome === 'failure'
                    ? { ok: false, error: 'Alter Suchfehler' }
                    : { ok: true, value: [{ id: 'old', revision: 1, name: 'Alt' }] },
                )),
          )
        : read(...args);
    await x.search('Wache');
    assert.ok(finish);
    assert.match(x.el('visit-encounter-status').textContent, /gesucht/);
    await x.search('Wache 11');
    const status = x.el('visit-encounter-status').textContent;
    finish();
    await settle();
    assert.equal(x.el('visit-encounter-status').textContent, status);
    assert.equal(x.el('visit-encounter').querySelectorAll('option').length, 2);
    await x.search('Wache');
    const plan = x.el('plans').value;
    await x.ui.prepareNextVisit(plan, { title: 'Zweiter Besuch', notes: '', locationId: null });
    await settle();
    finish();
    await settle();
    assert.equal(x.el('visit-encounter-search').value, '');
    assert.equal(x.el('visit-encounter').querySelectorAll('option').length, 1);
    assert.equal(x.el('visit-attach').disabled, true);
  });
test('new authored inputs revoke pending Encounter results and saving preserves the query for a fresh search', async (t) => {
  const x = await encounterSearchFixture(t),
    read = x.window.campaign.encounterPlans;
  let finish;
  x.window.campaign.encounterPlans = async (...args) =>
    args[1] === 'Wache' && !finish
      ? new Promise((r) => (finish = async () => r(await read(...args))))
      : read(...args);
  await x.search('Wache');
  x.el('visit-read-aloud').value = 'Neu';
  x.el('visit-read-aloud').oninput();
  await finish();
  await settle();
  assert.equal(x.el('visit-encounter').querySelectorAll('option').length, 1);
  assert.equal(x.el('visit-attach').disabled, true);
  assert.equal(await x.ui.flushPreparation(), true);
  await settle();
  assert.equal(x.el('visit-encounter-search').value, 'Wache');
  assert.equal(x.el('visit-encounter').querySelectorAll('option').length, 9);
});

test('historical Session receipts replay their original catalog snapshot without rewriting bytes', async (t) => {
  const x = await encounterSearchFixture(t),
    planId = x.el('plans').value,
    profile = x.store.session(x.workspace.token, planId).profile,
    command = {
      commandId: randomUUID(),
      campaignId: x.campaign.id,
      token: x.workspace.token,
      action: {
        kind: 'profile',
        profile: { ...profile, seed: 'Historisch' },
        expectedRevision: profile.revision,
      },
    },
    ack = x.store.executeSession(command),
    legacy = { ...ack, encounters: x.store.encounterPlans(x.workspace.token, '') },
    payload = JSON.stringify(legacy),
    checksum = createHash('sha256').update(payload).digest('hex');
  x.store.db
    .prepare('UPDATE session_receipt SET payload=?,checksum=? WHERE command_id=?')
    .run(payload, checksum, command.commandId);
  const fresh = new x.store.constructor(x.store.db.name);
  try {
    const w = fresh.activate(x.campaign.id),
      bytes = fresh.db.serialize();
    assert.deepEqual(fresh.executeSession({ ...command, token: w.token }), legacy);
    assert.ok(fresh.db.serialize().equals(bytes));
    assert.equal(
      fresh.db
        .prepare('SELECT payload FROM session_receipt WHERE command_id=?')
        .get(command.commandId).payload,
      payload,
    );
    assert.deepEqual(fresh.session(w.token, planId).encounters, []);
  } finally {
    fresh.close();
  }
});

test('the selected nonfirst planning visit reaches map destinations and the packet button through the actual Preparation wiring', async (t) => {
  const x = await fixture(t),
    plans = ['Alter Abend', 'Aktueller Abend'].map((name) => ({
      version: 1,
      id: randomUUID(),
      revision: 1,
      name,
      scenes: [
        { id: randomUUID(), title: 'Früher', notes: '', locationId: null },
        { id: randomUUID(), title: 'Jetzt', notes: 'Eigene Notizen', locationId: null },
      ],
    }));
  for (const plan of plans)
    x.store.changePreparation(x.command({ kind: 'plan', expectedRevision: null, plan }));
  x.window.campaign.sessionPacket = async (...args) => ({
    ok: true,
    value: x.store.sessionPacket(...args),
  });
  await x.activate();
  const selected = plans[1],
    visit = selected.scenes[1];
  await x.ui.openPreparedVisit(selected.id, visit.id);
  await x.ui.openPreparedNote(x.ids.borin);
  x.el('note-thread-open').click();
  await until(() => x.el('note-thread-dialog').open && !x.el('note-thread-use').disabled);
  assert.equal(x.el('note-thread-plan').value, selected.id);
  assert.equal(x.el('note-thread-visit').value, visit.id);
  [...x.el('note-thread-dialog').querySelectorAll('button')]
    .find((b) => b.textContent === 'Schließen')
    .click();
  await x.ui.openPreparedVisit(selected.id, visit.id);
  x.el('session-packet-open').click();
  await until(
    () =>
      x.el('session-packet-dialog').open &&
      x.el('session-packet-dialog').getAttribute('aria-busy') === 'false',
  );
  assert.equal(
    x.el('session-packet-visits').querySelector('[aria-pressed="true"]')?.dataset.visitId,
    visit.id,
  );
  assert.match(x.el('session-packet-content').textContent, /Eigene Notizen/);
  assert.equal(x.writes.length, 0);
  x.el('session-packet-close').click();
});

function rewardRow(x, index = 0) {
  const row = x.el('visit-reward-items').children[index];
  return {
    row,
    name: row.querySelector('input[placeholder="Gegenstand"]'),
    quantity: row.querySelector('input[type=number]'),
    cost: row.querySelector('input[placeholder="Gold pro Stück"]'),
    remove: row.querySelector('button'),
  };
}
function rewardInput(input, text) {
  input.value = text;
  input.oninput();
}
test('adding and removing manual loot siblings preserves raw quantities and current input nodes', async (t) => {
  const x = await manualReward(t);
  x.el('visit-item-add').click();
  const first = rewardRow(x);
  rewardInput(first.name, 'Münzen');
  rewardInput(first.quantity, '');
  x.el('visit-item-add').click();
  assert.equal(rewardRow(x).quantity.value, '');
  assert.equal(rewardRow(x).quantity === first.quantity, true);
  rewardRow(x, 1).remove.click();
  assert.equal(rewardRow(x).quantity.value, '');
  assert.equal(rewardRow(x).quantity === first.quantity, true);
  assert.equal(x.calls.length, 0);
  assert.equal(await x.ui.flushPreparation(), false);
  assert.equal(x.calls.length, 0);
  assert.match(x.messages.at(-1).text, /Menge/);
  assert.equal(first.quantity.value, '');
  rewardInput(first.quantity, '01');
  assert.equal(await x.ui.flushPreparation(), true);
  await settle();
  assert.equal(rewardRow(x).quantity === first.quantity, true);
  assert.equal(first.quantity.value, '01');
  rewardInput(first.name, '  Neu nach Bestätigung  ');
  assert.equal(await x.ui.flushPreparation(), true);
  assert.equal(x.reward().items[0].name, '  Neu nach Bestätigung  ');
  assert.equal(x.reward().items[0].quantity, 1);
});
test('removing an earlier manual loot row keeps later removal bound to its actual item', async (t) => {
  const x = await manualReward(t);
  for (const name of ['A', 'B', 'C']) {
    x.el('visit-item-add').click();
    rewardInput(rewardRow(x, x.el('visit-reward-items').children.length - 1).name, name);
  }
  const middle = rewardRow(x, 1),
    last = rewardRow(x, 2);
  rewardRow(x).remove.click();
  assert.equal(rewardRow(x).name === middle.name, true);
  last.remove.click();
  assert.equal(x.el('visit-reward-items').children.length, 1);
  assert.equal(await x.ui.flushPreparation(), true);
  assert.deepEqual(
    x.reward().items.map((i) => i.name),
    ['B'],
  );
});
test('removing and re-adding a manual reward clears old rows and revokes detached controls', async (t) => {
  const x = await manualReward(t);
  x.el('visit-item-add').click();
  const old = rewardRow(x);
  rewardInput(old.name, 'Alter Gegenstand');
  assert.equal(await x.ui.flushPreparation(), true);
  await settle();
  const detached = rewardRow(x);
  x.el('visit-has-reward').checked = false;
  x.el('visit-has-reward').oninput();
  x.el('visit-has-reward').checked = true;
  x.el('visit-has-reward').oninput();
  assert.equal(x.el('visit-reward-items').children.length, 0);
  assert.equal(x.el('visit-reward-xp').value, '0');
  x.el('visit-item-add').click();
  rewardInput(rewardRow(x).name, 'Neuer Gegenstand');
  detached.remove.onclick();
  rewardInput(detached.name, 'Verspätet');
  assert.equal(await x.ui.flushPreparation(), true);
  assert.deepEqual(
    x.reward().items.map((i) => i.name),
    ['Neuer Gegenstand'],
  );
});

test('manual loot fields stay editable during their own save and retain newer values against the acknowledged revision', async (t) => {
  const x = await manualReward(t);
  x.el('visit-item-add').click();
  rewardInput(rewardRow(x).name, 'Alt');
  assert.equal(await x.ui.flushPreparation(), true);
  await settle();
  const row = rewardRow(x),
    send = x.window.campaign.executeSession;
  let release;
  x.window.campaign.executeSession = async (c) => {
    const result = await send(c);
    if (!release) return new Promise((r) => (release = () => r(result)));
    return result;
  };
  rewardInput(row.quantity, '02');
  const saving = x.ui.flushPreparation();
  await until(() => !!release);
  assert.equal(row.quantity.disabled, false);
  assert.equal(row.name.disabled, false);
  rewardInput(row.quantity, '03');
  rewardInput(row.name, 'Neu während Bestätigung');
  release();
  assert.equal(await saving, true);
  assert.equal(rewardRow(x).quantity === row.quantity, true);
  assert.equal(row.quantity.value, '03');
  assert.equal(x.reward().items[0].quantity, 3);
  assert.equal(x.reward().items[0].name, 'Neu während Bestätigung');
});

async function packetOriginal(x) {
  const raw = '## Tor\r\n\r\n| Signal | Reaktion |\r\n| --- | --- |\r\n| Drei | Nera bleibt. |\r\n';
  x.store.changePreparation(
    x.command({ kind: 'note', expectedRevision: 1, note: { ...x.original, gmNotes: raw } }),
  );
  const plan = {
    version: 1,
    id: randomUUID(),
    revision: 1,
    name: 'Abend mit Original',
    scenes: ['Vorher', 'Glockentor'].map((title) => ({
      id: randomUUID(),
      title,
      notes: '  Eigener Rahmen\r\n',
      locationId: null,
    })),
  };
  x.store.changePreparation(x.command({ kind: 'plan', expectedRevision: null, plan }));
  const detail = x.store.session(x.workspace.token, plan.id).visits[1];
  x.store.executeSession({
    ...x.command(null),
    action: {
      kind: 'visit',
      planId: plan.id,
      expectedRevision: detail.revision,
      detail: { ...detail, readAloud: '  Eigene Begrüßung\r\n', noteIds: [x.ids.ada, x.ids.borin] },
    },
  });
  const saved = x.store.session(x.workspace.token, plan.id);
  x.window.campaign.sessionPacket = async (...args) => ({
    ok: true,
    value: x.store.sessionPacket(...args),
  });
  await x.activate();
  await x.ui.openPreparedNote(x.ids.ada);
  await x.ui.openPreparedVisit(plan.id, plan.scenes[1].id);
  x.el('session-packet-open').click();
  await until(
    () =>
      x.el('session-packet-dialog').open &&
      x.el('session-packet-dialog').getAttribute('aria-busy') === 'false',
  );
  x.el('session-packet-search').value = 'Drei';
  x.el('session-packet-search').oninput();
  x.el('session-packet-content').scrollTop = 343;
  x.el('session-packet-dialog').scrollTop = 92;
  const block = [...x.el('session-packet-content').querySelectorAll('.packet-block')].find(
    (e) => e.querySelector('h4').textContent === 'Borin',
  );
  assert.ok(block, 'the displayed German note heading must identify the original editor action');
  return { raw, plan, saved, open: () => block.querySelector('.packet-block-action').click() };
}
test('packet original editing retains the selected visit, query and reading position and restores its canonical owner', async (t) => {
  const x = await fixture(t),
    p = await packetOriginal(x),
    editor = x.el('note-editor'),
    home = editor.parentElement;
  p.open();
  await until(() => !x.el('packet-note-content').hidden && !x.el('packet-note-return').disabled);
  assert.equal(x.el('note-title').value, 'Borin');
  assert(x.el('packet-note-editor').contains(editor));
  assert.equal(x.el('note-editor'), editor);
  x.el('note-gm').value = p.raw.replaceAll('\r\n', '\n').replace('Nera bleibt.', 'Nera wartet.');
  x.el('note-gm').dispatchEvent(new x.window.Event('input'));
  x.el('packet-note-return').click();
  await until(
    () =>
      x.el('packet-note-editor').hidden &&
      x.el('session-packet-dialog').getAttribute('aria-busy') === 'false',
  );
  assert.equal(x.el('session-packet-search').value, 'Drei');
  assert.equal(x.el('session-packet-content').scrollTop, 343);
  assert.equal(x.el('session-packet-dialog').scrollTop, 92);
  assert.equal(
    x.el('session-packet-visits').querySelector('[aria-pressed="true"]').dataset.visitId,
    p.plan.scenes[1].id,
  );
  assert.equal(x.el('note-title').value, 'Ada');
  assert(home.contains(editor));
  assert.equal(x.el('note-editor'), editor);
  assert.equal(
    x.el('session-packet-content').querySelector('table tbody td:last-child').textContent,
    'Nera wartet.',
  );
  assert.equal(x.writes.length, 1);
  assert.equal(
    x.store.preparation(x.workspace.token).notes.find((r) => r.note.id === x.ids.borin).note
      .gmNotes,
    p.raw.replace('Nera bleibt.', 'Nera wartet.'),
  );
  assert.deepEqual(x.store.session(x.workspace.token, p.plan.id), p.saved);
});
test('a lost packet-source save keeps the original editor and its manual receipt until confirmed without resend', async (t) => {
  const x = await fixture(t),
    p = await packetOriginal(x);
  p.open();
  await until(() => !x.el('packet-note-return').disabled && !x.el('packet-note-content').hidden);
  const send = x.window.campaign.changePreparation;
  let calls = 0;
  x.window.campaign.changePreparation = async (c) => {
    calls++;
    await send(c);
    throw Error('Antwort verloren');
  };
  x.el('note-gm').value = 'Neu aus der Spielabendmappe';
  x.el('note-gm').dispatchEvent(new x.window.Event('input'));
  x.el('packet-note-return').click();
  await until(() => !x.el('preparation-reconcile').hidden && !x.el('packet-note-return').disabled);
  assert.equal(x.el('packet-note-editor').hidden, false);
  assert(x.el('packet-note-editor').contains(x.el('preparation-reconcile')));
  assert.equal(calls, 1);
  x.el('session-packet-close').click();
  await until(() => !x.el('packet-note-return').disabled);
  assert.equal(x.el('session-packet-dialog').open, true);
  assert.equal(calls, 1);
  x.el('preparation-reconcile').click();
  await until(() => x.el('preparation-reconcile').hidden);
  x.el('packet-note-return').click();
  await until(
    () =>
      x.el('packet-note-editor').hidden &&
      x.el('session-packet-content').textContent.includes('Neu aus der Spielabendmappe'),
  );
  assert.equal(calls, 1);
  assert.equal(x.el('session-packet-search').value, 'Drei');
  assert.equal(x.el('session-packet-filter-current').hidden, false);
  assert.match(x.el('session-packet-filter-current').textContent, /nicht mehr zur Suche/);
  assert.deepEqual(x.store.session(x.workspace.token, p.plan.id), p.saved);
});
test('a delayed packet-source opening cannot borrow the editor after another campaign activates', async (t) => {
  const x = await fixture(t),
    p = await packetOriginal(x),
    read = x.window.campaign.preparation;
  let release,
    held = false;
  x.window.campaign.preparation = async (...args) => {
    const result = await read(...args);
    if (!held) {
      held = true;
      await new Promise((r) => (release = r));
    }
    return result;
  };
  p.open();
  await until(() => !!release);
  const other = x.store.create('Andere Kampagne'),
    w = x.store.activate(other.id),
    id = randomUUID();
  x.store.changePreparation({
    commandId: randomUUID(),
    token: w.token,
    campaignId: other.id,
    change: {
      kind: 'note',
      expectedRevision: null,
      note: { ...x.original, id, title: 'Anderes Original' },
    },
  });
  x.setOwner(w);
  await x.ui.activatePreparation(w);
  release();
  await settle();
  assert.equal(x.el('session-packet-dialog').open, false);
  assert.equal(x.el('packet-note-editor').contains(x.el('note-editor')), false);
  assert.equal(x.el('note-title').value, 'Anderes Original');
  assert.equal(x.writes.length, 0);
});

test('ordinary lazy opening preserves an existing preparation draft without rereading its directory', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await x.ui.openPreparedNote(x.ids.borin);
  x.el('note-gm').value = '  Noch nicht gespeichert\r\n';
  x.el('note-gm').dispatchEvent(new x.window.Event('input'));
  const read = x.window.campaign.preparation;
  let reads = 0;
  x.window.campaign.preparation = async (...args) => {
    reads++;
    return read(...args);
  };
  await x.ui.ensurePreparation(x.workspace);
  assert.equal(reads, 0);
  assert.equal(x.el('note-gm').value, '  Noch nicht gespeichert\r\n');
  assert.equal(x.writes.length, 0);
});
test('lazy activation defers the directory until its first ordinary opening', async (t) => {
  const x = await fixture(t),
    read = x.window.campaign.preparation;
  let reads = 0;
  x.window.campaign.preparation = async (...args) => {
    reads++;
    return read(...args);
  };
  await x.ui.activatePreparation(x.workspace, false);
  assert.equal(reads, 0);
  assert.equal(x.el('preparation').inert, true);
  await x.ui.ensurePreparation(x.workspace);
  assert.equal(reads, 1);
  assert.equal(x.el('preparation').inert, false);
  await x.ui.ensurePreparation(x.workspace);
  assert.equal(reads, 1);
});

test('a room note opened before Preparation still exposes the existing plan without losing the note draft', async (t) => {
  const x = await fixture(t),
    plan = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      name: 'Nachtwache',
      scenes: [{ id: randomUUID(), title: 'Torhalle', notes: 'Eigener Ablauf', locationId: null }],
    };
  x.store.changePreparation(x.command({ kind: 'plan', expectedRevision: null, plan }));
  await x.ui.activatePreparation(x.workspace, false);
  await x.ui.openPreparedNote(x.ids.borin);
  const editor = x.el('note-gm');
  editor.value = '  Noch nicht bestätigt\r\n';
  editor.dispatchEvent(new x.window.Event('input'));
  const read = x.window.campaign.preparation;
  let reads = 0;
  x.window.campaign.preparation = async (...a) => {
    reads++;
    return read(...a);
  };
  await x.ui.ensurePreparation(x.workspace);
  assert.equal(x.el('plans').value, plan.id);
  assert.equal(x.el('scene-title').value, 'Torhalle');
  assert.equal(x.el('plan-controls').hidden, false);
  assert.equal(x.el('note-gm'), editor);
  assert.equal(editor.value, '  Noch nicht bestätigt\r\n');
  assert.equal(x.writes.length, 0);
  assert.equal(reads, 0);
});

test('switching straight from the first linked note to planning initializes its plan controls', async (t) => {
  const x = await fixture(t),
    plan = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      name: 'Zweiter Einstieg',
      scenes: [{ id: randomUUID(), title: 'Wachstube', notes: '', locationId: null }],
    };
  x.store.changePreparation(x.command({ kind: 'plan', expectedRevision: null, plan }));
  await x.ui.activatePreparation(x.workspace, false);
  await x.ui.openPreparedNote(x.ids.ada);
  x.el('preparation-planning').click();
  await until(() => x.el('plans').value === plan.id);
  assert.equal(x.el('scene-title').value, 'Wachstube');
  assert.equal(x.el('preparation-planning-workspace').hidden, false);
  assert.equal(x.writes.length, 0);
});

test('following a plan reference opens its identity and reports a missing plan without creating a replacement', async (t) => {
  const x = await fixture(t),
    plan = { version: 1, id: randomUUID(), revision: 1, name: 'Raumfolge', scenes: [] };
  x.store.changePreparation(x.command({ kind: 'plan', expectedRevision: null, plan }));
  await x.ui.activatePreparation(x.workspace, false);
  await x.ui.openPreparedNote(x.ids.borin);
  assert.equal(await x.ui.openPreparedPlan(plan.id), true);
  assert.equal(x.el('plans').value, plan.id);
  assert.equal(x.el('plan-controls').hidden, false);
  assert.equal(x.el('scene-editor').hidden, true);
  await assert.rejects(x.ui.openPreparedPlan(randomUUID()), /Spielabendplan ist nicht verfügbar/);
  assert.equal(x.store.preparation(x.workspace.token).plans.length, 1);
  assert.equal(x.writes.length, 0);
});

test('adding a scene waits for its inspector before focusing and selecting its placeholder', async (t) => {
  const x = await fixture(t);
  await x.activate();
  x.el('plan-create').click();
  await until(() => !x.el('plan-controls').hidden);
  const input = x.el('scene-title'),
    calls = [];
  input.focus = () => calls.push({ visible: !x.el('scene-editor').hidden, value: input.value });
  input.select = () => calls.push('select');
  x.el('scene-add').click();
  await until(() => calls.length === 2);
  assert.deepEqual(calls, [{ visible: true, value: 'Neue Szene' }, 'select']);
  input.value = 'Ankunft an der Zollbrücke';
  input.dispatchEvent(new x.window.Event('input'));
  assert.equal(await x.ui.flushPreparation(), true);
  assert.equal(
    x.store.preparation(x.workspace.token).plans[0].scenes[0].title,
    'Ankunft an der Zollbrücke',
  );
});

test('scene search finds saved and draft read-aloud without borrowing another plan text', async (t) => {
  const x = await fixture(t);
  await x.activate();
  const first = await x.ui.prepareNextVisit(null, {
    title: 'Hinterhalt',
    notes: 'GM privat',
    locationId: null,
  });
  x.el('visit-read-aloud').value = 'Zwischen den Bohlen glänzt ein Messer.';
  x.el('visit-read-aloud').oninput();
  assert.equal(await x.ui.flushPreparation(), true);
  await x.ui.prepareNextVisit(first.planId, {
    title: 'Weidenhain',
    notes: 'Wer verlor das Messer?',
    locationId: null,
  });
  const search = (text) => {
    x.el('scene-search').value = text;
    x.el('scene-search').dispatchEvent(new x.window.Event('input'));
  };
  search('Messer');
  assert.equal(x.el('scene-list').children.length, 2);
  [...x.el('scene-list').querySelectorAll('button')]
    .find((b) => b.textContent.includes('Hinterhalt'))
    .click();
  await settle();
  assert.equal(x.el('visit-read-aloud').value, 'Zwischen den Bohlen glänzt ein Messer.');
  x.el('visit-read-aloud').value = 'Eine Kupfermünze liegt hier.';
  x.el('visit-read-aloud').oninput();
  search('Kupfermünze');
  assert.equal(x.el('scene-list').children.length, 1);
  assert.match(x.el('scene-list').textContent, /Hinterhalt/);
  assert.equal(await x.ui.flushPreparation(), true);
  await x.ui.prepareNextVisit(null, {
    title: 'Anderer Abend',
    notes: '',
    locationId: null,
    newPlan: true,
  });
  search('Kupfermünze');
  assert.equal(x.el('scene-list').children.length, 0);
});

test('scene text search scans loaded visit identities once and blank queries skip that scan', async (t) => {
  const x = await fixture(t),
    plan = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      name: 'Langer Spielabend',
      scenes: Array.from({ length: 100 }, (_, i) => ({
        id: randomUUID(),
        title: 'Szene ' + i,
        notes: '',
        locationId: null,
      })),
    };
  x.store.changePreparation(x.command({ kind: 'plan', expectedRevision: null, plan }));
  const source = x.store.session(x.workspace.token, plan.id),
    detail = { ...source.visits[99], readAloud: 'Ein Messer liegt unter der Weide.' };
  x.store.executeSession({
    commandId: randomUUID(),
    campaignId: x.campaign.id,
    token: x.workspace.token,
    action: { kind: 'visit', planId: plan.id, detail, expectedRevision: detail.revision },
  });
  const read = x.window.campaign.session;
  let identities = 0;
  x.window.campaign.session = async (...args) => {
    const result = await read(...args);
    if (result.ok)
      for (const visit of result.value.visits) {
        const id = visit.visitId;
        Object.defineProperty(visit, 'visitId', {
          enumerable: true,
          get: () => {
            identities++;
            return id;
          },
        });
      }
    return result;
  };
  await x.activate();
  const search = (text) => {
    x.el('scene-search').value = text;
    x.el('scene-search').dispatchEvent(new x.window.Event('input'));
  };
  identities = 0;
  search('Messer');
  assert.equal(x.el('scene-list').children.length, 1);
  assert.match(x.el('scene-list').textContent, /Szene 99/);
  assert.ok(
    identities <= plan.scenes.length + 2,
    'search work must remain linear in loaded visits',
  );
  identities = 0;
  search('');
  assert.equal(x.el('scene-list').children.length, 100);
  assert.equal(identities, 0);
});

test('a room return restores its source knowledge view after visiting a linked plan', async (t) => {
  const x = await fixture(t),
    plan = { version: 1, id: randomUUID(), revision: 1, name: 'Nachtwache', scenes: [] };
  x.store.changePreparation(x.command({ kind: 'plan', expectedRevision: null, plan }));
  x.window.campaign.noteRoomUses = async () => ({
    ok: true,
    value: {
      entries: [
        {
          id: 'room',
          title: 'Wachstube',
          number: '2',
          place: 'Tor',
          excerpt: 'Nera',
          unavailable: false,
        },
      ],
      next: null,
    },
  });
  let returned, current, source;
  x.ui.setNoteRoomNavigation(async (id, valid, restore, origin) => {
    current = valid;
    returned = restore;
    source = origin;
    return true;
  });
  await x.activate();
  await x.ui.openPreparedNote(x.ids.borin);
  await until(() => x.el('note-room-uses-list').querySelector('button'));
  x.el('note-room-uses-list').querySelector('button').click();
  await until(() => returned);
  assert.deepEqual(source, { id: x.ids.borin, label: 'Borin' });
  await x.ui.openPreparedNote(x.ids.borin);
  await x.ui.openPreparedPlan(plan.id);
  assert.equal(x.el('preparation-planning-workspace').hidden, false);
  assert.equal(current(), true);
  let revealed = 0;
  x.el('note-editor').scrollIntoView = () => revealed++;
  x.window.campaign.noteRoomUses = async () => ({ ok: true, value: { entries: [], next: null } });
  returned();
  await settle();
  assert.equal(x.el('preparation-knowledge-workspace').hidden, false);
  assert.equal(x.el('note-title').value, 'Borin');
  assert.equal(revealed, 1);
});

test('source inspection in a mounted room-key note editor preserves the parent and saves through the original writer', async (t) => {
  const x = await sourceReader(t),
    dialog = x.el('key-dialog'),
    panel = x.el('note-editor').ownerDocument.createElement('section');
  dialog.append(panel);
  panel.append(x.el('note-editor'));
  dialog.open = true;
  const field = x.el('note-gm');
  field.value = 'Eigener Zusatz am Raum';
  field.dispatchEvent(new x.window.Event('input'));
  field.setSelectionRange(4, 9);
  x.el('note-relations').querySelector('[aria-label="Ansehen: Quelle: Ada"]').click();
  await until(() => x.el('quick-document').querySelector('h2')?.textContent === 'Ada');
  assert.equal(dialog.open, true);
  assert.equal(x.el('note-editor').parentElement, panel);
  assert.equal(x.el('note-title').value, 'Borin');
  assert.equal(field.selectionStart, 4);
  assert.equal(field.selectionEnd, 9);
  x.el('quick-close').click();
  assert.equal(dialog.open, true);
  assert.equal(x.el('note-title').value, 'Borin');
  assert.equal(field.value, 'Eigener Zusatz am Raum');
  assert.equal(x.writes.length, 1);
  assert.equal(x.writes[0].change.note.id, x.ids.borin);
});

async function questEditor(t) {
  const x = await fixture(t, false, 'quest');
  await x.activate();
  await x.ui.openPreparedNote(x.ids.borin);
  return x;
}
const narrativeButton = (x, label) =>
  [...x.el('narrative-editor').querySelectorAll('button')].find((b) => b.textContent === label);
function closeQuestInput(x) {
  const select = x.el('narrative-editor').querySelector('[aria-label="Narrativer Status"]');
  select.value = 'closed';
  select.onchange();
  return select;
}
function editQuestText(x, text) {
  x.el('note-gm').value = text;
  x.el('note-gm').dispatchEvent(new x.window.Event('input'));
}
test('quest completion drains its own text edit and saves the status against that confirmed note', async (t) => {
  const x = await questEditor(t);
  editQuestText(x, '  Schrank leer\r\nBeleg behalten  ');
  closeQuestInput(x);
  narrativeButton(x, 'Narrative Angaben speichern').click();
  await until(() => x.store.narrative(x.workspace.token, x.ids.borin).state.status === 'closed');
  const saved = x.store
    .preparation(x.workspace.token)
    .notes.find((r) => r.note.id === x.ids.borin).note;
  assert.equal(saved.gmNotes, '  Schrank leer\r\nBeleg behalten  ');
  assert.equal(saved.revision, 2);
  assert.equal(x.store.narrative(x.workspace.token, x.ids.borin).draft, null);
  assert.ok(!x.messages.some((m) => m.error));
});
test('acknowledged own text autosave preserves the status input and its recovery basis', async (t) => {
  const x = await questEditor(t),
    select = closeQuestInput(x);
  editQuestText(x, 'Schrank leer');
  assert.equal(await x.ui.flushPreparation(true, true), true);
  assert.equal(x.el('narrative-editor').querySelector('[aria-label="Narrativer Status"]'), select);
  assert.equal(select.value, 'closed');
  assert.equal(x.store.narrative(x.workspace.token, x.ids.borin).draft.noteRevision, 2);
  narrativeButton(x, 'Narrative Angaben speichern').click();
  await until(() => x.store.narrative(x.workspace.token, x.ids.borin).state.status === 'closed');
  assert.ok(!x.messages.some((m) => m.error));
});
test('a foreign text change after the own receipt still blocks quest completion', async (t) => {
  const x = await questEditor(t);
  closeQuestInput(x);
  editQuestText(x, 'Eigener Beleg');
  assert.equal(await x.ui.flushPreparation(true, true), true);
  const note = x.store
    .preparation(x.workspace.token)
    .notes.find((r) => r.note.id === x.ids.borin).note;
  x.store.changePreparation(
    x.command({
      kind: 'note',
      expectedRevision: note.revision,
      note: { ...note, gmNotes: 'Fremde Änderung' },
    }),
  );
  narrativeButton(x, 'Narrative Angaben speichern').click();
  await until(() => x.messages.some((m) => m.error));
  assert.equal(x.store.narrative(x.workspace.token, x.ids.borin).state.status, 'open');
  assert.equal(x.store.narrative(x.workspace.token, x.ids.borin).draft.noteRevision, 2);
  assert.equal(
    x.store.preparation(x.workspace.token).notes.find((r) => r.note.id === x.ids.borin).note
      .gmNotes,
    'Fremde Änderung',
  );
});

test('an own text receipt never approves a recovered draft with an older foreign basis', async (t) => {
  const x = await questEditor(t);
  x.store.keepNarrativeDraft(
    x.workspace.token,
    {
      noteId: x.ids.borin,
      writeId: randomUUID(),
      revision: 0,
      noteRevision: 1,
      status: 'closed',
      locationId: null,
      contributors: [],
      poolXp: '-',
      items: [],
    },
    null,
  );
  const old = x.store
    .preparation(x.workspace.token)
    .notes.find((r) => r.note.id === x.ids.borin).note;
  x.store.changePreparation(
    x.command({ kind: 'note', expectedRevision: 1, note: { ...old, gmNotes: 'Fremder Stand' } }),
  );
  await x.activate();
  await x.ui.openPreparedNote(x.ids.borin);
  editQuestText(x, 'Fremder Stand plus eigene Ergänzung');
  assert.equal(await x.ui.flushPreparation(true, true), true);
  const n = x.store.narrative(x.workspace.token, x.ids.borin);
  assert.equal(n.noteRevision, 3);
  assert.equal(n.draft.noteRevision, 1);
  assert.equal(n.draft.poolXp, '-');
  assert.equal(n.state.status, 'open');
  assert.ok(narrativeButton(x, 'Geprüften Entwurf auf aktuellen Stand übernehmen'));
});
test('own text receipts keep incomplete reward input recoverable without replacing controls', async (t) => {
  const x = await questEditor(t),
    select = closeQuestInput(x),
    pool = x.el('narrative-editor').querySelector('[aria-label="Quest-XP-Pool"]');
  pool.value = '-';
  pool.oninput();
  editQuestText(x, 'Eigener Beleg');
  assert.equal(await x.ui.flushPreparation(true, true), true);
  const n = x.store.narrative(x.workspace.token, x.ids.borin);
  assert.equal(n.draft.noteRevision, 2);
  assert.equal(n.draft.poolXp, '-');
  assert.equal(n.draft.status, 'closed');
  assert.equal(n.state.status, 'open');
  assert.equal(x.el('narrative-editor').querySelector('[aria-label="Narrativer Status"]'), select);
  assert.equal(pool.value, '-');
  await x.ui.openPreparedNote(x.ids.ada);
  await x.ui.openPreparedNote(x.ids.borin);
  assert.equal(x.el('narrative-editor').querySelector('[aria-label="Quest-XP-Pool"]').value, '-');
  assert.ok(!narrativeButton(x, 'Geprüften Entwurf auf aktuellen Stand übernehmen'));
});

test('writing a private update keeps optional public text discoverable and preserves both audiences across note switches', async (t) => {
  const x = await fixture(t);
  x.store.changePreparation(
    x.command({ kind: 'note', expectedRevision: 1, note: { ...x.original, readAloud: '' } }),
  );
  await x.activate();
  await x.ui.openPreparedNote(x.ids.borin);
  const publicArea = x.el('note-read-aloud'),
    privateArea = x.el('note-gm'),
    details = x.el('note-read-aloud-details');
  assert.equal(details.open, false);
  assert.equal(x.el('note-text-tools').open, undefined);
  assert.equal(x.el('note-thread-open').closest('details'), null);
  privateArea.value = 'Neue Spur bleibt privat';
  privateArea.dispatchEvent(new x.window.Event('input'));
  assert.equal(await x.ui.flushPreparation(), true);
  await x.ui.openPreparedNote(x.ids.ada);
  assert.equal(details.open, true);
  assert.equal(publicArea.value, '  Original\r\n');
  await x.ui.openPreparedNote(x.ids.borin);
  assert.equal(details.open, false);
  assert.equal(privateArea.value, 'Neue Spur bleibt privat');
  assert.equal(publicArea.value, '');
  details.open = true;
  publicArea.value = '  Zum Vorlesen\r\n';
  publicArea.dispatchEvent(new x.window.Event('input'));
  assert.equal(await x.ui.flushPreparation(), true);
  await x.ui.openPreparedNote(x.ids.ada);
  await x.ui.openPreparedNote(x.ids.borin);
  assert.equal(details.open, true);
  assert.equal(publicArea.value, '  Zum Vorlesen\r\n');
  assert.equal(privateArea.value, 'Neue Spur bleibt privat');
  const saved = x.store
    .preparation(x.workspace.token)
    .notes.find((r) => r.note.id === x.ids.borin).note;
  assert.equal(saved.readAloud, '  Zum Vorlesen\r\n');
  assert.equal(saved.gmNotes, 'Neue Spur bleibt privat');
});

test('room navigation from a relationship target identifies the displayed note in a borrowed editor', async (t) => {
  const x = await sourceReader(t),
    panel = document.createElement('section');
  document.body.append(panel);
  panel.append(x.el('note-editor'));
  x.window.campaign.noteRoomUses = async () => ({
    ok: true,
    value: {
      entries: [
        {
          id: 'room',
          title: 'Wachstube',
          number: '2',
          place: 'Tor',
          excerpt: 'Ada',
          unavailable: false,
        },
      ],
      next: null,
    },
  });
  let source;
  x.ui.setNoteRoomNavigation(async (id, current, restore, origin) => {
    source = origin;
    return true;
  });
  [...x.el('note-relations').querySelectorAll('button')]
    .find((b) => b.textContent === 'Quelle: Ada')
    .click();
  await until(
    () => x.el('note-title').value === 'Ada' && x.el('note-room-uses-list').querySelector('button'),
  );
  assert.equal(x.el('note-editor').parentElement, panel);
  x.el('note-room-uses-list').querySelector('button').click();
  await until(() => source);
  assert.deepEqual(source, { id: x.ids.ada, label: 'Ada' });
});

test('extracting from knowledge does not advertise the automatically loaded first plan as an intentional destination', async (t) => {
  const x = await fixture(t),
    plan = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      name: 'Historischer Abend',
      scenes: [
        { id: randomUUID(), title: 'Vergangener Besuch', notes: 'Unverändert', locationId: null },
      ],
    };
  x.store.changePreparation(x.command({ kind: 'plan', expectedRevision: null, plan }));
  await x.activate();
  await x.ui.openPreparedNote(x.ids.borin);
  x.el('note-thread-prepare').click();
  await until(() => x.el('note-thread-dialog').open && !x.el('note-thread-use').disabled);
  assert.equal(x.el('note-thread-plan').value, '');
  assert.equal(x.el('note-thread-visit').value, '');
  x.el('note-thread-use').click();
  await settle();
  assert.equal(x.writes.length, 0);
  assert.deepEqual(
    x.store.preparation(x.workspace.token).plans.find((p) => p.id === plan.id),
    plan,
  );
});

test('editing a resumed handoff visit preserves its literal notes and identity through browser-normalized input', async (t) => {
  const x = await fixture(t);
  await x.activate();
  const raw = '  Übergabe\r\n- Siv fragen  \rBorin wartet';
  await x.ui.prepareNextVisit(null, { title: 'Am Salzsteg', notes: raw, locationId: null });
  const before = x.store.preparation(x.workspace.token).plans[0];
  const field = x.el('scene-notes');
  field.value = raw.replace(/\r\n?/g, '\n') + '\nZusatz';
  field.dispatchEvent(new x.window.Event('input'));
  assert.equal(await x.ui.flushPreparation(), true);
  const after = x.store.preparation(x.workspace.token).plans[0];
  assert.equal(after.id, before.id);
  assert.equal(after.scenes[0].id, before.scenes[0].id);
  assert.equal(after.scenes[0].notes, raw + '\rZusatz');
});

test('a retired draft read cannot unlock preparation while the next session is still reading', async (t) => {
  const x = await fixture(t);
  await x.activate();
  await settle();
  let releaseOld,
    releaseNew,
    reads = 0;
  const old = new Promise((resolve) => (releaseOld = resolve)),
    next = new Promise((resolve) => (releaseNew = resolve)),
    original = x.window.campaign.preparationDraft;
  x.window.campaign.preparationDraft = async (...args) => {
    const result = await original(...args);
    reads++;
    if (reads === 1) await old;
    else if (reads === 2) await next;
    return result;
  };
  try {
    const first = x.ui.openPreparedNote(x.ids.borin);
    await until(() => reads === 1);
    const renewed = x.ui.activatePreparation(x.workspace);
    await until(() => reads >= 2);
    releaseOld();
    await first;
    assert.equal(x.ui.editorSession.reading, 1);
    assert.equal(x.el('preparation').inert, true);
    releaseNew();
    await renewed;
    assert.equal(x.ui.editorSession.reading, 0);
    assert.equal(x.el('preparation').inert, false);
  } finally {
    releaseOld();
    releaseNew();
    await settle();
  }
});

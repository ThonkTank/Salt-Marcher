import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
const require = createRequire(import.meta.url);
for (const [entry, out] of [
  ['src/app/storage/store.ts', 'desk-narrative-store'],
  ['src/app/runtime/scene-desk-ui.ts', 'desk-narrative-ui'],
])
  buildSync({
    entryPoints: [entry],
    outfile: '.build/' + out + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const settle = async () => {
  for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r));
};
async function fixture(t) {
  const root = mkdtempSync(tmpdir() + '/desk-narrative-'),
    { CampaignStore } = require('../../.build/desk-narrative-store.cjs'),
    store = new CampaignStore(root + '/campaign.sqlite'),
    campaign = store.create('Fähre'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaign.id,
      action,
    });
  const scene = store.executeLive(
    command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
  ).scene;
  const quest = {
    version: 1,
    id: randomUUID(),
    revision: 1,
    kind: 'quest',
    title: 'Fährsiegel',
    readAloud: '',
    gmNotes: 'Siegel finden.',
    relations: [],
    creatureId: null,
    deleted: false,
  };
  store.changePreparation({
    ...command(null),
    change: { kind: 'note', expectedRevision: null, note: quest },
  });
  const saved = {},
    { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8'));
  for (const key of [
    'window',
    'document',
    'HTMLElement',
    'HTMLInputElement',
    'HTMLSelectElement',
    'HTMLTextAreaElement',
    'setTimeout',
    'clearTimeout',
  ])
    saved[key] = globalThis[key];
  for (const key of [
    'window',
    'document',
    'HTMLElement',
    'HTMLInputElement',
    'HTMLSelectElement',
    'HTMLTextAreaElement',
  ])
    globalThis[key] = key === 'window' ? window : window[key];
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    get() {
      return this._value ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this._value = v;
    },
    configurable: true,
  });
  globalThis.setTimeout = () => 1;
  globalThis.clearTimeout = () => {};
  const response = (fn) => {
      try {
        return { ok: true, value: fn() };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    errors = [];
  window.campaign = Object.fromEntries(
    [
      'sceneDesk',
      'searchDesk',
      'deskContent',
      'preparationDraft',
      'keepDeskDraft',
      'changePreparationContent',
      'sceneCreationDraft',
      'keepSceneCreationDraft',
      'narrative',
      'progress',
      'ledgerParties',
      'keepNarrativeDraft',
      'discardNarrativeDraft',
      'executeProgress',
    ].map((name) => [name, async (...args) => response(() => store[name](...args))]),
  );
  delete require.cache[require.resolve('../../.build/desk-narrative-ui.cjs')];
  const ui = require('../../.build/desk-narrative-ui.cjs'),
    el = (id) => document.getElementById(id);
  ui.initSceneDesk(
    (s, error) => {
      if (error) errors.push(s);
    },
    async () => {},
    async () => {},
  );
  ui.sceneDeskContext(w, scene);
  await settle();
  el('desk-search').value = 'Fährsiegel';
  el('desk-search-form').onsubmit({ preventDefault() {} });
  await settle();
  el('desk-results').querySelector('button').onclick();
  await settle();
  const panel = el('desk-narrative'),
    button = (text) => [...panel.querySelectorAll('button')].find((b) => b.textContent === text),
    status = () => panel.querySelector('[aria-label="Narrativer Status"]');
  const edit = () => {
    const field = el('desk-fields').querySelector('[aria-label="GM-Notizen"]');
    field.value = 'Ada fand das Siegel hinter dem Mühlrad. Keine Belohnung.';
    field.oninput();
  };
  t.after(async () => {
    ui.sceneDeskContext(null, null);
    await settle();
    Object.assign(globalThis, saved);
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { store, w, quest, ui, el, panel, button, status, edit, errors };
}
test('editing a live quest then closing its status uses the confirmed note version and permits navigation/close', async (t) => {
  const x = await fixture(t);
  x.edit();
  assert.equal(await x.ui.flushSceneDesk(), true);
  x.status().value = 'closed';
  x.status().onchange();
  x.button('Narrative Angaben speichern').click();
  await settle();
  const saved = x.store.narrative(x.w.token, x.quest.id);
  assert.equal(saved.state.status, 'closed');
  assert.equal(saved.noteRevision, 2);
  assert.equal(saved.award, null);
  assert.equal(saved.draft, null);
  assert.deepEqual(x.errors, []);
  assert.equal(
    await x.ui.flushSceneDesk(),
    true,
    'the same drain used by navigation and native close completes',
  );
  x.el('desk-search-form').onsubmit({ preventDefault() {} });
  await settle();
  x.el('desk-results').querySelector('button').onclick();
  await settle();
  assert.equal(x.status().value, 'closed');
});
test('a status draft made before a text edit remains reviewable instead of silently adopting a new note basis', async (t) => {
  const x = await fixture(t);
  x.edit();
  x.status().value = 'closed';
  x.status().onchange();
  // The narrative save drains the pending text edit. Its old status intent must survive, not approve the changed note.
  x.button('Narrative Angaben speichern').click();
  await settle();
  const saved = x.store.narrative(x.w.token, x.quest.id);
  assert.equal(saved.noteRevision, 2);
  assert.equal(saved.state.status, 'open');
  assert.equal(saved.draft.status, 'closed');
  assert.equal(saved.draft.noteRevision, 1);
  assert.ok(x.button('Geprüften Entwurf auf aktuellen Stand übernehmen'));
  x.button('Geprüften Entwurf auf aktuellen Stand übernehmen').click();
  await settle();
  assert.equal(await x.ui.flushSceneDesk(), true);
  assert.equal(x.store.narrative(x.w.token, x.quest.id).state.status, 'closed');
});

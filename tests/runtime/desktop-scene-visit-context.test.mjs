import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
const base = '.build/realist-scene-visits',
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
  entryPoints: ['src/app/runtime/scene-visit-ui.ts'],
  outfile: base + '/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { CampaignStore } = require('../../' + base + '/store.cjs'),
  { SceneVisitBinder } = require('../../' + base + '/ui.cjs');
const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
async function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'scene-visits-')),
    store = new CampaignStore(path.join(root, 'store.sqlite'));
  const { window, document } = parseHTML('<button id="live-session-progress-refresh"></button>'),
    saved = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document });
  const x = {
    store,
    window,
    document,
    messages: [],
    opened: [],
    groupReads: [],
    el: (id) => document.getElementById(id),
  };
  t.after(async () => {
    x.binder?.reset();
    await settle();
    Object.assign(globalThis, saved);
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const command = (action) => ({
    commandId: randomUUID(),
    campaignId: x.context.workspace.campaign.id,
    token: x.context.workspace.token,
    action,
  });
  x.activate = async (title) => {
    const cam = store.create(title),
      workspace = store.activate(cam.id),
      scene = store.executeLive({
        commandId: randomUUID(),
        campaignId: cam.id,
        token: workspace.token,
        action: { kind: 'initialize', expectedRosterRevision: 0 },
      }).scene;
    x.context = { workspace, scene };
    x.binder?.contextChanged();
  };
  await x.activate('A');
  const planId = randomUUID(),
    visitId = randomUUID(),
    noteId = randomUUID(),
    encounterId = randomUUID();
  store.changePreparation({
    ...command(null),
    change: {
      kind: 'note',
      expectedRevision: null,
      note: {
        version: 1,
        id: noteId,
        revision: 1,
        kind: 'quest',
        title: 'Torauftrag',
        readAloud: '',
        gmNotes: 'Bleibt im Weltwissen',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    },
  });
  store.changePreparation({
    ...command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id: planId,
        revision: 1,
        name: 'Erster Abend',
        scenes: [{ id: visitId, title: 'Ankunft am Tor', notes: 'GM-Notiz', locationId: null }],
      },
    },
  });
  store.saveEncounterPlan({
    ...command(null),
    expectedRevision: null,
    plan: {
      id: encounterId,
      revision: 0,
      name: 'Wache',
      notes: 'Wachtposten',
      party: [],
      entries: [{ id: randomUUID(), creatureId: 'guard', count: 1, grouped: false }],
      sources: [],
      catalogHash: '',
    },
  });
  let detail = store.executeSession(
    command({
      kind: 'attach',
      planId,
      visitId,
      expectedVisitRevision: 0,
      encounterId,
      expectedEncounterRevision: 1,
    }),
  ).visits[0];
  const text = '  Öffnet das Tor!\r\n**Originaltext**  ';
  store.executeSession(
    command({
      kind: 'visit',
      planId,
      expectedRevision: detail.revision,
      detail: { ...detail, readAloud: text, noteIds: [noteId] },
    }),
  );
  detail = store.session(x.context.workspace.token, planId).visits[0];
  const s = x.context.scene;
  x.context.scene = store.executeLive(
    command({
      kind: 'apply-visit',
      planId,
      visitId,
      expectedPlanRevision: 1,
      expectedVisitRevision: detail.revision,
      sceneId: s.id,
      expectedRevision: s.revision,
    }),
  ).scene;
  x.original = { ...x.context };
  x.text = text;
  x.noteId = noteId;
  const wrap = (fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  window.campaign = {
    sceneVisits: async (...args) => wrap(() => store.sceneVisits(...args)),
    preparedGroup: async (...args) => {
      x.groupReads.push(args);
      return wrap(() => store.groupView(...args));
    },
  };
  x.transfer = async (text, title, sceneId) => {
    const scene = store.live(x.context.workspace.token).scene;
    assert.equal(scene.id, sceneId);
    x.context.scene = store.executeLive(
      command({
        kind: 'scene-content',
        sceneId,
        expectedRevision: scene.revision,
        title: scene.title,
        notes: scene.notes,
        readAloud: text,
        locationId: scene.locationId,
      }),
    ).scene;
  };
  x.drain = async () => true;
  x.binder = new SceneVisitBinder(
    (...args) => x.messages.push(args),
    () => x.context,
    () => x.drain(),
    (...args) => x.transfer(...args),
    async (id) => x.opened.push({ id, token: x.context.workspace.token }),
  );
  const dialog = x.el('scene-visit-binder');
  dialog.open = false;
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
  };
  x.dialog = dialog;
  x.open = async () => {
    x.el('scene-visit-open').click();
    await settle();
  };
  await x.open();
  return x;
}
test('detached visit actions cannot write, open notes or load groups in a new campaign', async (t) => {
  const x = await fixture(t),
    use = x.el('scene-visit-read-aloud'),
    note = [...x.el('scene-visit-document').querySelectorAll('button')].find((b) =>
      b.textContent.includes('Torauftrag'),
    ),
    group = x.el('scene-visit-document').querySelector('details');
  await x.activate('B');
  await x.open();
  const before = x.store.db.serialize();
  group.open = true;
  group.dispatchEvent(new x.window.Event('toggle'));
  use.onclick();
  note.onclick();
  await settle();
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(x.opened.length, 0);
  assert.equal(x.groupReads.length, 0);
  assert.equal(x.dialog.open, true);
  assert.equal(x.store.live(x.context.workspace.token).scene.readAloud, '');
});
test('refresh removes old actionable content and a failed page read leaves it removed', async (t) => {
  const x = await fixture(t),
    use = x.el('scene-visit-read-aloud'),
    held = deferred();
  x.window.campaign.sceneVisits = () => held.promise;
  [...x.dialog.querySelectorAll('button')].find((b) => b.textContent === 'Aktualisieren').click();
  assert.equal(x.el('scene-visit-document').children.length, 0);
  assert.equal(x.el('scene-visit-list').children.length, 0);
  const before = x.store.db.serialize();
  use.onclick();
  await settle();
  assert.ok(x.store.db.serialize().equals(before));
  held.resolve({ ok: false, error: 'Lesen unterbrochen' });
  await settle();
  assert.equal(x.el('scene-visit-document').children.length, 0);
  assert.match(x.el('scene-visit-status').textContent, /Lesen unterbrochen/);
});
test('filtering away every visit removes its document and invalidates its handoff', async (t) => {
  const x = await fixture(t),
    use = x.el('scene-visit-read-aloud'),
    before = x.store.db.serialize();
  x.el('scene-visit-search').value = 'keine passende Spur';
  x.el('scene-visit-search').oninput();
  assert.equal(x.el('scene-visit-document').children.length, 0);
  use.onclick();
  await settle();
  assert.ok(x.store.db.serialize().equals(before));
  x.el('scene-visit-search').value = 'Torauftrag';
  x.el('scene-visit-search').oninput();
  assert.ok(x.el('scene-visit-read-aloud'));
});
test('a delayed handoff failure cannot report into another campaign or close its binder', async (t) => {
  const x = await fixture(t),
    held = deferred();
  x.transfer = () => held.promise;
  x.el('scene-visit-read-aloud').click();
  await x.activate('B');
  await x.open();
  const status = x.el('scene-visit-status').textContent,
    count = x.messages.length;
  held.reject(Error('Fehler aus A'));
  await settle();
  assert.equal(x.el('scene-visit-status').textContent, status);
  assert.equal(x.messages.length, count);
  assert.equal(x.dialog.open, true);
});
test('an explicit visit handoff preserves exact prose, scene clock and original binding', async (t) => {
  const x = await fixture(t),
    before = x.store.live(x.context.workspace.token).scene,
    visits = x.store.sceneVisits(x.context.workspace.token, before.id, null);
  x.el('scene-visit-read-aloud').click();
  await settle();
  const after = x.store.live(x.context.workspace.token).scene;
  assert.equal(after.readAloud, x.text);
  assert.equal(after.notes, before.notes);
  assert.equal(after.title, before.title);
  assert.deepEqual(after.clock, before.clock);
  assert.deepEqual(x.store.sceneVisits(x.context.workspace.token, before.id, null), visits);
  assert.match(x.el('scene-visit-status').textContent, /gespeichert/);
});

test('closing a binder while its reopen drains notes cancels that pending reopen', async (t) => {
  const x = await fixture(t),
    held = deferred();
  x.drain = () => held.promise;
  x.el('scene-visit-open').click();
  x.binder.reset();
  held.resolve(true);
  await settle();
  assert.equal(x.dialog.open, false);
  assert.equal(x.el('scene-visit-document').children.length, 0);
});
test('a delayed drain failure is not reported into the newly active campaign', async (t) => {
  const x = await fixture(t),
    held = deferred();
  x.drain = () => held.promise;
  x.el('scene-visit-open').click();
  await x.activate('B');
  x.drain = async () => true;
  await x.open();
  const status = x.el('scene-visit-status').textContent,
    count = x.messages.length;
  held.reject(Error('Alte Eingabe nicht gesichert'));
  await settle();
  assert.equal(x.el('scene-visit-status').textContent, status);
  assert.equal(x.messages.length, count);
  assert.equal(x.dialog.open, true);
});

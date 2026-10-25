import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync, build } from './helpers/build.mjs';
import { parseHTML } from './helpers/dom.mjs';
const require = createRequire(import.meta.url);
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/planner-visit-handoff-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
await build({
  entryPoints: ['src/app/preparation.ts'],
  outfile: '.build/planner-visit-handoff-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  plugins: [
    {
      name: 'unrelated-controller-ports',
      setup(b) {
        b.onResolve({ filter: /^\.\/(session-ui|narrative-ui)$/ }, (args) => ({
          path: args.path,
          namespace: 'qa-ports',
        }));
        b.onLoad({ filter: /.*/, namespace: 'qa-ports' }, (args) => ({
          contents: args.path.includes('session')
            ? 'export const initSession=()=>{};export const sessionContext=()=>{};export const sessionVisitReadAlouds=()=>new Map();export const flushSession=async()=>true;export const clearSessionTimeline=async()=>{};export const linkVisitNoteThread=async()=>{throw Error("Unexpected thread link in timeline-only fixture");};'
            : 'export const showNarrative=async()=>{};export const flushNarrative=async()=>true;export const prepareNarrativeLocation=async()=>{};export const acceptNarrativeNoteReceipt=async()=>true;',
          loader: 'js',
        }));
      },
    },
  ],
});
const tick = () => new Promise((r) => setImmediate(r));
async function until(fn) {
  for (let i = 0; i < 200; i++) {
    if (fn()) return;
    await tick();
  }
  assert(fn(), 'Expected timeline state');
}
async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'timeline-search-')),
    { CampaignStore } = require('../.build/planner-visit-handoff-store.cjs'),
    store = new CampaignStore(root + '/store.sqlite'),
    campaign = store.create('Besuche wiederfinden'),
    w = store.activate(campaign.id),
    command = (change) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      change,
    });
  const location = {
    kind: 'location',
    version: 1,
    id: randomUUID(),
    name: 'Alte Mühle',
    type: 'poi',
    sections: [
      { id: randomUUID(), title: 'Beschreibung', markdown: '' },
      { id: randomUUID(), title: 'Notizen', markdown: '' },
    ],
    detailMaps: [],
    keyLinks: [],
  };
  store.changePreparation(
    command({ kind: 'location', expectedRevision: null, document: location }),
  );
  const scenes = Array.from({ length: 65 }, (_, i) => ({
      id: randomUUID(),
      title: i === 0 ? 'Ankunft' : 'Hafenbesuch',
      notes:
        i === 63
          ? '  Kupfersiegel\r\n- Die Mühle erneut besuchen'
          : '  Original ' + i + '\r\n- Unverändert',
      locationId: i === 63 ? location.id : null,
    })),
    plan = { version: 1, id: randomUUID(), revision: 1, name: 'Hafenspuren', scenes },
    other = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      name: 'Nächster Spielabend',
      scenes: [
        { id: randomUUID(), title: 'Reise', notes: 'Eigenständige Notizen', locationId: null },
      ],
    };
  for (const p of [plan, other])
    store.changePreparation(command({ kind: 'plan', expectedRevision: null, plan: p }));
  const previous = {
      localStorage: globalThis.localStorage,
      window: globalThis.window,
      document: globalThis.document,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    },
    { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8'));
  Object.assign(globalThis, { window, document, setTimeout: () => 1, clearTimeout: () => {} });
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this.__qaValue ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this.__qaValue = v;
    },
  });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
  };
  const storage = new Map();
  window.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  const response = (fn) => {
      try {
        return { ok: true, value: fn() };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    writes = [],
    messages = [];
  window.campaign = {};
  for (const key of [
    'preparation',
    'preparationDraft',
    'keepPreparationDrafts',
    'discardPreparationDraft',
    'selectPreparation',
    'reconcilePreparationPlan',
  ])
    window.campaign[key] = async (...args) => response(() => store[key](...args));
  window.campaign.changePreparationPlan = async (c) => {
    writes.push(c);
    return response(() => store.changePreparationPlan(c));
  };
  delete require.cache[require.resolve('../.build/planner-visit-handoff-ui.cjs')];
  const ui = require('../.build/planner-visit-handoff-ui.cjs');
  ui.initPreparation(
    (text) => messages.push(text),
    async () => {},
  );
  await ui.activatePreparation(w);
  const el = (id) => document.getElementById(id),
    input = (id, v) => {
      el(id).value = v;
      el(id).dispatchEvent(new window.Event('input'));
    },
    filter = (q) => input('scene-search', q),
    buttons = () => [...el('scene-list').querySelectorAll('button')],
    saved = () => store.preparation(w.token, '').plans.find((p) => p.id === plan.id);
  return {
    store,
    w,
    root,
    CampaignStore,
    plan,
    other,
    scenes,
    location,
    ui,
    el,
    input,
    filter,
    buttons,
    saved,
    writes,
    messages,
    async cleanup() {
      await ui.leavePreparation();
      await tick();
      Object.assign(globalThis, previous);
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
const seed = () => ({ title: 'Folgebesuch', notes: '  Übernommener Text\r\n', locationId: null });
const defer = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
test('an explicit missing plan never redirects a visit into an unrelated plan', async () => {
  const x = await fixture();
  try {
    const before = x.store.preparation(x.w.token, '').plans;
    await assert.rejects(
      x.ui.prepareNextVisit(randomUUID(), seed()),
      /Plan.*(nicht|verfügbar|geändert)/i,
    );
    assert.equal(x.writes.length, 0);
    assert.deepEqual(x.store.preparation(x.w.token, '').plans, before);
  } finally {
    await x.cleanup();
  }
});
test('a removed insertion visit never silently appends to the timeline', async () => {
  const x = await fixture();
  try {
    const before = x.saved();
    await assert.rejects(
      x.ui.prepareNextVisit(x.plan.id, { ...seed(), beforeVisitId: randomUUID() }),
      /(Besuch|Einfüge|Position).*(nicht|verfügbar|geändert)/,
    );
    assert.equal(x.writes.length, 0);
    assert.deepEqual(x.saved(), before);
  } finally {
    await x.cleanup();
  }
});
test('new input during the destination read survives without publishing a visit', async () => {
  const x = await fixture();
  let gate;
  try {
    const read = x.el('plans').ownerDocument.defaultView.campaign.preparation;
    gate = defer();
    let held = false;
    window.campaign.preparation = async (...args) => {
      const response = await read(...args);
      held = true;
      await gate.promise;
      return response;
    };
    const pending = x.ui.prepareNextVisit(x.plan.id, seed()).then(
      () => null,
      (e) => e,
    );
    await until(() => held);
    x.input('scene-notes', '  Neu während Lesen\r\n- Behalten  ');
    gate.resolve();
    const result = await pending;
    assert.ok(result instanceof Error);
    assert.equal(x.writes.length, 0);
    assert.equal(x.el('scene-notes').value, '  Neu während Lesen\r\n- Behalten  ');
    await x.ui.flushPreparation();
    assert.equal(x.saved().scenes[0].notes, '  Neu während Lesen\r\n- Behalten  ');
  } finally {
    gate?.resolve();
    await x.cleanup();
  }
});
test('new input while the visit commit is acknowledged keeps its original editor and persists on flush', async () => {
  const x = await fixture();
  let gate;
  try {
    const write = window.campaign.changePreparationPlan;
    gate = defer();
    let held = false;
    window.campaign.changePreparationPlan = async (c) => {
      const response = await write(c);
      held = true;
      await gate.promise;
      return response;
    };
    const pending = x.ui.prepareNextVisit(x.plan.id, seed());
    await until(() => held);
    x.input('scene-notes', '  Neu während Bestätigung\r\n- Behalten  ');
    gate.resolve();
    await pending;
    assert.equal(x.el('scene-title').value, 'Ankunft');
    assert.equal(x.el('scene-notes').value, '  Neu während Bestätigung\r\n- Behalten  ');
    await x.ui.flushPreparation();
    assert.equal(x.saved().scenes[0].notes, '  Neu während Bestätigung\r\n- Behalten  ');
    assert.equal(x.saved().scenes.filter((s) => s.title === 'Folgebesuch').length, 1);
  } finally {
    gate?.resolve();
    await x.cleanup();
  }
});
test('reactivating the same workspace invalidates a pending visit destination read', async () => {
  const x = await fixture();
  let gate;
  try {
    const read = window.campaign.preparation;
    gate = defer();
    let held = false;
    window.campaign.preparation = async (...args) => {
      const response = await read(...args);
      if (!held) {
        held = true;
        await gate.promise;
      }
      return response;
    };
    const pending = x.ui.prepareNextVisit(x.plan.id, seed()).then(
      () => null,
      (e) => e,
    );
    await until(() => held);
    await x.ui.activatePreparation(x.w);
    gate.resolve();
    await pending;
    assert.equal(x.writes.length, 0);
    assert.deepEqual(x.saved().scenes, x.scenes);
  } finally {
    gate?.resolve();
    await x.cleanup();
  }
});
test('a valid explicit insertion preserves every existing visit and returns its exact packet target through Fresh', async () => {
  const x = await fixture();
  try {
    const prepared = await x.ui.prepareNextVisit(x.plan.id, {
      ...seed(),
      locationId: x.location.id,
      beforeVisitId: x.scenes[1].id,
    });
    const plan = x.saved();
    assert.equal(plan.scenes.length, 66);
    assert.deepEqual(
      plan.scenes.filter((s) => s.title !== 'Folgebesuch'),
      x.scenes,
    );
    assert.equal(plan.scenes[1].title, 'Folgebesuch');
    assert.equal(plan.scenes[1].notes, seed().notes);
    assert.equal(plan.scenes[1].locationId, x.location.id);
    assert.deepEqual(prepared, { planId: x.plan.id, visitId: plan.scenes[1].id });
    assert.equal(x.el('scene-title').value, 'Folgebesuch');
    const fresh = new x.CampaignStore(x.root + '/store.sqlite');
    try {
      const current = fresh.activate(x.w.campaign.id);
      assert.deepEqual(
        fresh.preparation(current.token, '').plans.find((p) => p.id === x.plan.id),
        plan,
      );
    } finally {
      fresh.close();
    }
  } finally {
    await x.cleanup();
  }
});
test('a changed destination plan never silently rebases the visible draft', async () => {
  const x = await fixture();
  try {
    const plan = x.saved();
    x.store.changePreparation({
      commandId: randomUUID(),
      campaignId: x.w.campaign.id,
      token: x.w.token,
      change: {
        kind: 'plan',
        expectedRevision: plan.revision,
        plan: {
          ...plan,
          scenes: plan.scenes.map((s, i) => (i ? s : { ...s, notes: 'Externe bestätigte Prosa' })),
        },
      },
    });
    await assert.rejects(x.ui.prepareNextVisit(x.plan.id, seed()), /Plan.*geändert/i);
    assert.equal(x.writes.length, 0);
    assert.equal(x.saved().scenes[0].notes, 'Externe bestätigte Prosa');
  } finally {
    await x.cleanup();
  }
});
buildSync({
  entryPoints: ['src/app/live-session-recap.ts'],
  outfile: '.build/planner-handoff-seed.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
test('a handoff visit keeps the entire authored source including boundary whitespace', () => {
  const { handoffVisitSeed } = require('../.build/planner-handoff-seed.cjs'),
    source = '  Nächster Einstieg: Nordtor\r\n' + 'Ausführliche Notiz '.repeat(700) + '\r\n  ';
  assert.equal(handoffVisitSeed(source, 'Späher').notes, '' + source);
});
test('a reply from before workspace reactivation cannot replace the new editor input', async () => {
  const x = await fixture();
  let gate;
  try {
    const write = window.campaign.changePreparationPlan;
    gate = defer();
    let held = false;
    window.campaign.changePreparationPlan = async (c) => {
      const response = await write(c);
      held = true;
      await gate.promise;
      return response;
    };
    const pending = x.ui.prepareNextVisit(x.plan.id, seed());
    await until(() => held);
    await x.ui.activatePreparation(x.w);
    x.input('scene-notes', 'Nach Wiederaufnahme\r\n  Neuer Entwurf');
    gate.resolve();
    await pending;
    assert.equal(x.el('scene-title').value, 'Ankunft');
    assert.equal(x.el('scene-notes').value, 'Nach Wiederaufnahme\r\n  Neuer Entwurf');
    await x.ui.flushPreparation();
    assert.equal(x.saved().scenes[0].notes, 'Nach Wiederaufnahme\r\n  Neuer Entwurf');
    assert.equal(x.saved().scenes.filter((s) => s.title === 'Folgebesuch').length, 1);
  } finally {
    gate?.resolve();
    await x.cleanup();
  }
});

for (const outcome of ['rejected', 'lost-reply'])
  test(
    'an unknown visit write keeps its original nonselected plan owner through reopen: ' + outcome,
    async () => {
      const x = await fixture();
      try {
        const write = window.campaign.changePreparationPlan;
        let original;
        window.campaign.changePreparationPlan = async (command) => {
          original = JSON.parse(JSON.stringify(command));
          if (outcome === 'lost-reply') await write(command);
          return { ok: false, error: 'Kontrollierter unklarer Schreibausgang' };
        };
        await assert.rejects(x.ui.prepareNextVisit(x.other.id, seed()));
        const saved = x.store.preparationDraft(x.w.token, 'plan', x.other.id);
        assert.ok(saved, 'original nonselected plan command must be durable');
        assert.deepEqual(saved.failedCommand, original);
        assert.equal(saved.change.plan.scenes.at(-1).notes, seed().notes);
        assert.equal(x.store.preparationDraft(x.w.token, 'plan', x.plan.id), null);
        const fresh = new x.CampaignStore(x.root + '/store.sqlite');
        try {
          const current = fresh.activate(x.w.campaign.id),
            restored = fresh.preparationDraft(current.token, 'plan', x.other.id);
          assert.deepEqual(restored, saved);
          const status = fresh.reconcilePreparation(restored.failedCommand, current.token);
          assert.equal(status.outcome, outcome === 'lost-reply' ? 'applied' : 'not-applied');
          assert.equal(status.targetChanged, false);
          assert.equal(
            status.data.plans.find((p) => p.id === x.other.id).scenes.length,
            outcome === 'lost-reply' ? 2 : 1,
          );
        } finally {
          fresh.close();
        }
      } finally {
        await x.cleanup();
      }
    },
  );

test('an existing target draft blocks a second handed-off visit and keeps its source bytes', async () => {
  const x = await fixture();
  try {
    const held = {
      version: 1,
      writeId: randomUUID(),
      change: {
        kind: 'plan',
        expectedRevision: x.other.revision,
        plan: {
          ...x.other,
          name: 'Offener anderer Plan',
          scenes: x.other.scenes.map((s) => ({ ...s, notes: '  Fremder Entwurf\r\n' })),
        },
      },
      failedCommand: null,
    };
    x.store.keepPreparationDrafts(x.w.token, [held]);
    await assert.rejects(x.ui.prepareNextVisit(x.other.id, seed()), /(Entwurf|Auftrag)/);
    assert.equal(x.writes.length, 0);
    assert.deepEqual(x.store.preparationDraft(x.w.token, 'plan', x.other.id), held);
    assert.equal(
      x.store.preparation(x.w.token, '').plans.find((p) => p.id === x.other.id).scenes.length,
      1,
    );
  } finally {
    await x.cleanup();
  }
});
test('the explicit new-plan choice creates a separate owner rather than appending to the selected plan', async () => {
  const x = await fixture();
  try {
    const before = x.store.preparation(x.w.token, '').plans;
    await x.ui.prepareNextVisit(null, { ...seed(), newPlan: true });
    const after = x.store.preparation(x.w.token, '').plans;
    assert.equal(after.length, before.length + 1);
    for (const plan of before)
      assert.deepEqual(
        after.find((p) => p.id === plan.id),
        plan,
      );
    const created = after.find((p) => !before.some((q) => q.id === p.id));
    assert.equal(created.scenes.length, 1);
    assert.equal(created.scenes[0].notes, seed().notes);
  } finally {
    await x.cleanup();
  }
});
test('an opening packet preserves separate public prose private notes and stable source identities', async () => {
  const x = await fixture();
  try {
    const id = randomUUID();
    x.store.changePreparation({
      commandId: randomUUID(),
      campaignId: x.w.campaign.id,
      token: x.w.token,
      change: {
        kind: 'note',
        expectedRevision: null,
        note: {
          version: 1,
          id,
          revision: 1,
          kind: 'quest',
          title: 'Offene Spur',
          readAloud: '',
          gmNotes: 'Geheim',
          relations: [],
          creatureId: null,
          deleted: false,
        },
      },
    });
    const response = (fn) => {
      try {
        return { ok: true, value: fn() };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    };
    window.campaign.session = async (...a) => response(() => x.store.session(...a));
    window.campaign.executeSession = async (c) => response(() => x.store.executeSession(c));
    await x.ui.prepareNextVisit(x.plan.id, {
      ...seed(),
      readAloud: '  Öffentlicher Einstieg\r\n',
      noteIds: [id, id],
    });
    const saved = x.saved(),
      detail = x.store
        .session(x.w.token, x.plan.id)
        .visits.find((v) => v.visitId === saved.scenes.at(-1).id);
    assert.equal(detail.readAloud, '  Öffentlicher Einstieg\r\n');
    assert.deepEqual(detail.noteIds, [id]);
    assert.equal(saved.scenes.at(-1).notes, seed().notes);
    assert.equal(x.store.live(x.w.token).scenes.length, 0);
  } finally {
    await x.cleanup();
  }
});

test('an unreadable destination draft cannot authorize a new handed-off visit', async () => {
  const x = await fixture();
  try {
    const held = {
      version: 1,
      writeId: randomUUID(),
      change: { kind: 'plan', expectedRevision: x.other.revision, plan: x.other },
      failedCommand: null,
    };
    x.store.keepPreparationDrafts(x.w.token, [held]);
    const db = x.store.db;
    db.prepare(
      "UPDATE preparation_draft SET checksum='broken' WHERE campaign_id=? AND kind='plan' AND target_id=?",
    ).run(x.w.campaign.id, x.other.id);
    const before = db
      .prepare('SELECT * FROM preparation_draft WHERE campaign_id=? AND target_id=?')
      .get(x.w.campaign.id, x.other.id);
    await assert.rejects(x.ui.prepareNextVisit(x.other.id, seed()));
    assert.equal(x.writes.length, 0);
    assert.deepEqual(
      db
        .prepare('SELECT * FROM preparation_draft WHERE campaign_id=? AND target_id=?')
        .get(x.w.campaign.id, x.other.id),
      before,
    );
  } finally {
    await x.cleanup();
  }
});

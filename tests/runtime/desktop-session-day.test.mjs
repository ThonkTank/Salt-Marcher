import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {sessionDay} from './src/app/runtime/session-day';export {SessionDayPanel} from './src/app/runtime/session-day-ui';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/session-day-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, sessionDay, SessionDayPanel } = createRequire(import.meta.url)(
  '../../.build/session-day-test.cjs',
);
function fixture(t) {
  const root = mkdtempSync(tmpdir() + '/session-day-'),
    file = root + '/workbench.sqlite',
    x = { root, file, store: new CampaignStore(file) };
  x.cam = x.store.create('Rasten am Bergpass');
  x.w = x.store.activate(x.cam.id);
  x.command = (action) => ({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    action,
  });
  x.plan = {
    version: 1,
    id: randomUUID(),
    revision: 1,
    name: 'Bergpass',
    scenes: ['Nordtor', 'Passweg', 'Ruine'].map((title) => ({
      id: randomUUID(),
      title,
      notes: '  Unveränderte Notizen\r\n',
      locationId: null,
    })),
  };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'plan', expectedRevision: null, plan: x.plan },
  });
  x.store.executeSession(
    x.command({
      kind: 'profile',
      expectedRevision: 0,
      profile: {
        planId: x.plan.id,
        revision: 0,
        party: [{ id: randomUUID(), name: 'Geplante Gruppe', level: 3, count: 4 }],
        adventureDayFraction: '0.5',
        seed: 'pass-1',
      },
    }),
  );
  const source = x.store.saveEncounterPlan({
    ...x.command(null),
    expectedRevision: null,
    plan: {
      id: randomUUID(),
      revision: 0,
      name: 'Goblinwache',
      notes: '  Eingefrorener Trupp\r\n',
      party: [],
      entries: [{ id: randomUUID(), creatureId: 'goblin', count: 8, grouped: true }],
      sources: [],
      catalogHash: '',
    },
  });
  for (const scene of x.plan.scenes)
    x.store.executeSession(
      x.command({
        kind: 'attach',
        planId: x.plan.id,
        visitId: scene.id,
        expectedVisitRevision: 0,
        encounterId: source.id,
        expectedEncounterRevision: 1,
      }),
    );
  x.read = () => x.store.session(x.w.token, x.plan.id);
  x.action = (index, changes) => {
    const s = x.read();
    return {
      kind: 'scene-planning',
      planId: s.plan.id,
      expectedPlanRevision: s.plan.revision,
      visitId: s.plan.scenes[index].id,
      expectedVisitRevision: s.visits[index].revision,
      ...changes,
    };
  };
  x.write = (index, changes) => x.store.executeSession(x.command(x.action(index, changes)));
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return x;
}
test('the authored day uses concrete encounter XP, records allocation/rest atomically and survives reopening', (t) => {
  const x = fixture(t),
    before = x.read(),
    day = sessionDay(before.plan, before);
  assert.equal(day.dayBudget, 4800);
  assert.equal(day.budget, 2400);
  assert.equal(day.plannedXp, 3000);
  assert.equal(day.remainingXp, -600);
  assert.equal(day.rows[1].suggestion, 'short');
  const action = x.action(0, {
      allocationXp: 1200,
      rest: { kind: 'long', beforeVisitId: before.plan.scenes[1].id },
    }),
    command = x.command(action),
    ack = x.store.executeSession(command);
  assert.deepEqual(x.store.executeSession(command), ack);
  let s = x.read();
  assert.equal(s.plan.revision, before.plan.revision + 1);
  assert.equal(s.visits[0].allocationXp, 1200);
  assert.equal(sessionDay(s.plan, s).rows[1].sinceLongXp, 1000);
  assert.deepEqual(s.groups, before.groups);
  assert.deepEqual(s.plan.scenes, before.plan.scenes);
  assert.ok(
    x.store
      .sessionPacket(x.w.token, x.plan.id)
      .visits[0].blocks.some((b) => b.heading === 'Lange Rast nach dieser Szene'),
  );
  const bytes = x.store.db.serialize();
  assert.throws(() => x.store.executeSession(x.command(action)), /geändert/);
  assert.ok(x.store.db.serialize().equals(bytes));
  assert.throws(
    () => x.write(0, { rest: { kind: 'short', beforeVisitId: s.plan.scenes[2].id } }),
    /benachbarten/,
  );
  assert.ok(x.store.db.serialize().equals(bytes));
  x.store.close();
  x.store = new CampaignStore(x.file);
  x.w = x.store.activate(x.cam.id);
  s = x.read();
  assert.equal(s.visits[0].allocationXp, 1200);
  assert.equal(s.visits[0].restAfter.beforeVisitId, s.plan.scenes[1].id);
});
test('rests copy with adjacent selected scenes and independent campaign identities; reordering prunes only a broken gap', async (t) => {
  const x = fixture(t);
  let s = x.read();
  x.write(0, { rest: { kind: 'short', beforeVisitId: s.plan.scenes[1].id }, allocationXp: 0 });
  s = x.read();
  x.write(1, { rest: { kind: 'long', beforeVisitId: s.plan.scenes[2].id } });
  s = x.read();
  const id = randomUUID();
  x.store.executeSession(
    x.command({
      kind: 'copy-visits',
      planId: id,
      expectedBasis: null,
      name: 'Kopie',
      sourcePlanId: s.plan.id,
      expectedSourceBasis: s.replacementBasis,
      visitIds: s.plan.scenes.map((v) => v.id),
      copyParty: false,
    }),
  );
  let copy = x.store.session(x.w.token, id);
  assert.equal(copy.visits[0].restAfter.beforeVisitId, copy.plan.scenes[1].id);
  assert.equal(copy.visits[1].restAfter.beforeVisitId, copy.plan.scenes[2].id);
  assert.equal(copy.visits[0].allocationXp, 0);
  assert.notEqual(copy.visits[0].restAfter.beforeVisitId, s.visits[0].restAfter.beforeVisitId);
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: copy.plan.revision,
      plan: {
        ...copy.plan,
        scenes: [copy.plan.scenes[1], copy.plan.scenes[2], copy.plan.scenes[0]],
      },
    },
  });
  copy = x.store.session(x.w.token, id);
  assert.equal(copy.visits[0].restAfter.kind, 'long');
  assert.equal(copy.visits[2].restAfter, undefined);
  assert.equal(copy.visits[2].allocationXp, 0);
  const replacement = copy;
  x.store.executeSession(
    x.command({
      kind: 'replace-plan',
      planId: id,
      expectedBasis: replacement.replacementBasis,
      name: 'Ersetzt',
      sourcePlanId: s.plan.id,
      expectedSourceBasis: s.replacementBasis,
      copyParty: false,
    }),
  );
  copy = x.store.session(x.w.token, id);
  assert.equal(copy.visits[0].restAfter.kind, 'short');
  assert.equal(copy.visits[0].restAfter.beforeVisitId, copy.plan.scenes[1].id);
  assert.equal(copy.visits[1].restAfter.kind, 'long');
  const path = x.root + '/copy.sqlite';
  await x.store.campaignSnapshot(x.w.token, path);
  const cam = x.store.acceptCampaignSnapshot(path, 'Andere Kampagne', {}),
    w = x.store.activate(cam.id),
    plans = x.store.preparation(w.token).plans,
    source = plans.find((p) => p.name === 'Bergpass'),
    fresh = x.store.session(w.token, source.id);
  assert.equal(fresh.visits[0].restAfter.beforeVisitId, fresh.plan.scenes[1].id);
  assert.notEqual(fresh.visits[0].restAfter.beforeVisitId, s.plan.scenes[1].id);
});
test('removed day controls cannot change a later displayed plan; a real control retains its shown plan revision', (t) => {
  const x = fixture(t),
    old = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML(
      '<html><body><section><div id="session-panel"></div></section></body></html>',
    );
  Object.assign(globalThis, { window, document });
  const values = new WeakMap();
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return values.get(this) ?? '';
    },
    set(v) {
      values.set(this, v);
    },
  });
  const calls = [],
    panel = new SessionDayPanel(
      async (a, current) => {
        if (current()) calls.push(a);
      },
      async () => {},
      () => {},
    );
  t.after(() => Object.assign(globalThis, old));
  const s = x.read();
  panel.render(s.plan, s, s.profile);
  const select = document.querySelector('select'),
    handler = select.onchange;
  select.value = 'short';
  panel.render({ ...s.plan, id: randomUUID() }, s, s.profile);
  handler();
  assert.equal(calls.length, 0);
  const fresh = document.querySelector('select');
  fresh.value = 'long';
  fresh.onchange();
  assert.equal(calls[0].expectedPlanRevision, s.plan.revision);
  assert.equal(calls[0].rest.kind, 'long');
  assert.equal(calls[0].rest.beforeVisitId, s.plan.scenes[1].id);
  panel.reset();
  fresh.onchange();
  assert.equal(calls.length, 1);
});

test('budget remains visible while the optional day table is folded and preserves the user choice on refresh', (t) => {
  const x = fixture(t),
    old = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML('<html><body><div id="session-panel"></div></body></html>');
  Object.assign(globalThis, { window, document });
  t.after(() => Object.assign(globalThis, old));
  const panel = new SessionDayPanel(
      async () => false,
      async () => {},
      () => {},
    ),
    s = x.read();
  panel.render(s.plan, s, s.profile);
  const root = document.getElementById('session-day-plan');
  assert.ok(!root.open);
  assert.match(
    root.querySelector('summary').textContent,
    /3000 angepasste XP.*600 XP überschritten/,
  );
  root.open = true;
  panel.render(s.plan, s, s.profile);
  assert.equal(root.open, true);
  root.open = false;
  panel.render(s.plan, s, s.profile);
  assert.equal(root.open, false);
});

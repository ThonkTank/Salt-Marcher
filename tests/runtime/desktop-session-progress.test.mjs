import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';

const base = '.build/realist-session-progress',
  require = createRequire(import.meta.url);
buildSync({
  entryPoints: ['src/app/runtime/session-progress-ui.ts'],
  outfile: base + '/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: base + '/store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require('../../' + base + '/store.cjs');
const tick = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
};
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const progress = (id = 'plan', sceneId = 'scene') => ({
  planId: id,
  planRevision: 1,
  visits: [
    {
      id: 'visit',
      title: id + ' visit',
      count: 1,
      focused: { adoptionId: 'adoption', sceneId, sceneTitle: sceneId, outcome: null },
      occurrences: [],
    },
  ],
});

function navigator(t) {
  const { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8')),
    saved = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document });
  delete require.cache[require.resolve('../../' + base + '/ui.cjs')];
  const ui = require('../../' + base + '/ui.cjs'),
    calls = [],
    messages = [];
  window.campaign = {
    sessionProgress: async (_token, id, sceneId) => ({ ok: true, value: progress(id, sceneId) }),
  };
  const x = {
    ui,
    window,
    document,
    calls,
    messages,
    save: async () => true,
    el: (id) => document.getElementById(id),
  };
  ui.initSessionNavigator(
    (...args) => messages.push(args),
    async (...args) => calls.push(args),
    (...args) => x.save(...args),
  );
  const picker = x.el('live-session-plan'),
    status = x.el('live-visit-outcome-status');
  for (const select of [picker, status])
    Object.defineProperty(select, 'value', { value: '', writable: true });
  x.context = (token = 'token', sceneId = 'scene') =>
    ui.sessionNavigatorContext(
      { token },
      {
        focusId: sceneId,
        scene: {
          id: sceneId,
          adoption: {
            id: 'adoption',
            planId: 'plan',
            visitId: 'visit',
            title: 'Visit',
            outcome: null,
          },
        },
      },
      {
        plans: [
          { id: 'plan', name: 'First' },
          { id: 'next', name: 'Second' },
        ],
      },
      true,
    );
  x.choose = (id) => {
    picker.value = id;
    picker.onchange();
  };
  x.submit = () => x.el('live-visit-outcome-form').onsubmit({ preventDefault() {} });
  t.after(() => {
    ui.sessionNavigatorContext(null, null, null, false);
    Object.assign(globalThis, saved);
  });
  return x;
}

test('changing plans clears old visit actions while loading and after read failure', async (t) => {
  const x = navigator(t);
  x.context();
  await tick();
  assert.match(x.el('live-session-visits').textContent, /plan visit/);
  const held = deferred();
  x.window.campaign.sessionProgress = () => held.promise;
  x.choose('next');
  assert.equal(x.el('live-session-visits').children.length, 0);
  held.resolve({ ok: false, error: 'Plan cannot be read' });
  await tick();
  assert.equal(x.el('live-session-visits').children.length, 0);
  assert.match(x.el('live-session-progress-summary').textContent, /cannot be read/);
  assert.deepEqual(x.calls, []);
});
test('a slower reply from the previous group cannot replace the current list', async (t) => {
  const x = navigator(t),
    held = deferred();
  x.window.campaign.sessionProgress = (_t, id, sceneId) =>
    sceneId === 'scene'
      ? held.promise
      : Promise.resolve({ ok: true, value: progress(id, sceneId) });
  x.context();
  x.context('token', 'other');
  await tick();
  assert.equal(x.el('live-session-visits').children.length, 1);
  held.resolve({ ok: false, error: 'Old group error' });
  await tick();
  assert.doesNotMatch(x.el('live-session-progress-summary').textContent, /Old group error/);
});
test('visit replies for another plan or focused group never expose navigation actions', async (t) => {
  const x = navigator(t);
  x.window.campaign.sessionProgress = async () => ({ ok: true, value: progress('foreign') });
  x.context();
  await tick();
  assert.equal(x.el('live-session-visits').children.length, 0);
  x.window.campaign.sessionProgress = async () => ({
    ok: true,
    value: progress('plan', 'foreign'),
  });
  x.context();
  await tick();
  assert.equal(x.el('live-session-visits').children.length, 0);
  assert.match(x.el('live-session-progress-summary').textContent, /anderen/);
});
test('outcome acknowledgement preserves newer input and an ongoing command lock', async (t) => {
  const x = navigator(t),
    held = deferred();
  x.context();
  await tick();
  x.save = () => held.promise;
  const input = x.el('live-visit-outcome-text');
  input.value = 'First result';
  input.oninput();
  x.submit();
  input.value = 'Newer input';
  input.oninput();
  x.ui.sessionNavigatorBusy(true);
  held.resolve(true);
  await tick();
  assert.equal(input.value, 'Newer input');
  assert.equal(x.el('live-visit-outcome-confirm').disabled, true);
  x.ui.sessionNavigatorBusy(false);
  x.context();
  await tick();
  assert.equal(input.value, 'Newer input');
  assert.equal(x.el('live-visit-outcome-confirm').disabled, false);
});

test('a confirmed outcome can continue with the next still-open visit', async (t) => {
  const x = navigator(t);
  x.window.campaign.sessionProgress = async () => ({
    ok: true,
    value: {
      planId: 'plan',
      planRevision: 1,
      visits: [
        {
          id: 'visit',
          title: 'Current',
          count: 1,
          focused: { adoptionId: 'adoption', sceneId: 'scene', sceneTitle: 'Group', outcome: null },
          occurrences: [],
        },
        {
          id: 'done',
          title: 'Already done',
          count: 1,
          focused: {
            adoptionId: 'old',
            sceneId: 'scene',
            sceneTitle: 'Group',
            outcome: { status: 'skipped', text: 'Passed', recordedAt: new Date(0).toISOString() },
          },
          occurrences: [],
        },
        { id: 'next-open', title: 'The hidden gate', count: 0, focused: null, occurrences: [] },
      ],
    },
  });
  x.context();
  await tick();
  const next = x.el('live-visit-outcome-next'),
    status = x.el('live-visit-outcome-status');
  assert.equal(next.hidden, false);
  assert.match(next.textContent, /The hidden gate/);
  status.value = 'open';
  status.oninput();
  assert.equal(next.hidden, true);
  status.value = 'completed';
  status.oninput();
  x.el('live-visit-outcome-form').onsubmit({ preventDefault() {}, submitter: next });
  await tick();
  assert.deepEqual(x.calls, [['plan', 'next-open']]);
  assert.equal(x.el('live-visit-outcome-confirm').disabled, false);
});

test('visit outcomes are replayable, guarded and retained through Fresh and independent copy', async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'visit-outcomes-')),
    file = path.join(root, 'source.sqlite');
  let store = new CampaignStore(file);
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const cam = store.create('Visit history');
  let w = store.activate(cam.id);
  const command = (action) => ({
    commandId: randomUUID(),
    campaignId: cam.id,
    token: w.token,
    action,
  });
  const planId = randomUUID(),
    visitId = randomUUID();
  store.changePreparation({
    ...command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id: planId,
        revision: 1,
        name: 'Evening',
        scenes: [{ id: visitId, title: 'First visit', notes: '', locationId: null }],
      },
    },
  });
  const initial = store.executeLive(
    command({ kind: 'initialize', expectedRosterRevision: 0 }),
  ).scene;
  const apply = () => {
    const scene = store.live(w.token).scene;
    return store.executeLive(
      command({
        kind: 'apply-visit',
        planId,
        visitId,
        expectedPlanRevision: 1,
        expectedVisitRevision: 0,
        sceneId: scene.id,
        expectedRevision: scene.revision,
      }),
    ).scene;
  };
  const first = apply(),
    text = '  Confirmed prose\r\n**Result**  ',
    write = command({
      kind: 'visit-outcome',
      sceneId: first.id,
      adoptionId: first.adoption.id,
      expectedRevision: first.revision,
      status: 'completed',
      outcome: text,
    });
  const ack = store.executeLive(write),
    after = store.db.serialize();
  assert.deepEqual(store.executeLive(write), ack);
  assert.ok(store.db.serialize().equals(after));
  assert.deepEqual(ack.scene.clock, initial.clock);
  for (const action of [
    { ...write.action, adoptionId: randomUUID(), expectedRevision: ack.scene.revision },
    { ...write.action },
    { ...write.action, status: 'invalid', expectedRevision: ack.scene.revision },
  ]) {
    assert.throws(() => store.executeLive(command(action)));
    assert.ok(store.db.serialize().equals(after));
  }
  const second = apply();
  assert.equal(second.adoption.outcome, null);
  const p = store.sessionProgress(w.token, planId, second.id);
  assert.equal(p.visits[0].count, 2);
  assert.equal(
    p.visits[0].occurrences.find((o) => o.adoptionId === first.adoption.id).outcome.text,
    text,
  );
  store.close();
  store = new CampaignStore(file);
  w = store.activate(cam.id);
  assert.equal(
    store.sessionProgress(w.token, planId, second.id).visits[0].occurrences[1].outcome.text,
    text,
  );
  const snapshot = path.join(root, 'snapshot.sqlite');
  await store.campaignSnapshot(w.token, snapshot);
  const copy = store.acceptCampaignSnapshot(snapshot, 'Copy', {}),
    cw = store.activate(copy.id),
    copiedScene = store.live(cw.token).scene;
  assert.notEqual(copiedScene.id, second.id);
  assert.notEqual(copiedScene.adoption.id, second.adoption.id);
  const copied = store.sessionProgress(cw.token, copiedScene.adoption.planId, copiedScene.id);
  assert.equal(copied.visits[0].count, 2);
  assert.equal(copied.visits[0].occurrences[1].outcome.text, text);
  assert.notEqual(copied.visits[0].occurrences[1].adoptionId, first.adoption.id);
  assert.ok(
    store
      .sessionPacket(cw.token, copiedScene.adoption.planId)
      .visits[0].blocks.some((b) => b.text.includes(text)),
  );
});

test('missing material keeps adopted progress readable and a late source does not rewrite outcome input', async (t) => {
  const x = navigator(t);
  x.context();
  await tick();
  const field = x.el('live-visit-outcome-text');
  field.value = 'Eigener Ausgang';
  field.oninput();
  let assignments = 0,
    stored = field.value;
  Object.defineProperty(field, 'value', {
    get: () => stored,
    set: (v) => {
      assignments++;
      stored = v;
    },
    configurable: true,
  });
  x.ui.sessionNavigatorPreparation(null, true);
  await tick();
  assert.equal(x.el('live-visit-outcome').hidden, false);
  assert.equal(x.el('live-session-plan').disabled, true);
  assert.match(x.el('live-session-progress-summary').textContent, /1 Besuchen/);
  assert.equal(x.el('live-visit-outcome-confirm').disabled, false);
  x.ui.sessionNavigatorPreparation({ plans: [{ id: 'plan', name: 'First' }] }, true);
  await tick();
  assert.equal(assignments, 0);
  assert.equal(field.value, 'Eigener Ausgang');
  assert.equal(x.el('live-session-plan').disabled, false);
});

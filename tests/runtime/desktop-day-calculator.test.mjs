import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
const require = createRequire(import.meta.url),
  dir = '.build/planner-day-calculator';
mkdirSync(dir, { recursive: true });
for (const [entry, out] of [
  ['src/app/storage/store.ts', 'store'],
  ['src/app/runtime/adventuring-day-ui.ts', 'ui'],
  ['src/app/runtime/adventuring-day-model.ts', 'model'],
])
  buildSync({
    entryPoints: [entry],
    outfile: dir + '/' + out + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
mkdirSync(dir + '/catalog', { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  dir + '/catalog/srd-5.1.generated.json',
);
const { CampaignStore } = require('../../' + dir + '/store.cjs'),
  { calculateDay } = require('../../' + dir + '/model.cjs');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'day-calculator-')),
    filename = path.join(root, 'campaign.sqlite'),
    x = { root, filename, store: new CampaignStore(filename) };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const cam = x.store.create('Party-Rechner');
  x.cam = cam;
  x.w = x.store.activate(cam.id);
  x.command = (action) => ({
    commandId: randomUUID(),
    token: x.w.token,
    campaignId: cam.id,
    action,
  });
  x.scene = x.store.executeLive(x.command({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
  x.add = (name, xp, active = true) => {
    const c = x.store.executeLive(
      x.command({ kind: 'create-character', profile: { name } }),
    ).character;
    if (active) {
      const live = x.store.live(x.w.token);
      x.store.executeLive(
        x.command({
          kind: 'membership',
          characterId: c.id,
          expectedRevision: c.membershipRevision,
          expectedRosterRevision: live.rosterRevision,
          active: true,
          targetSceneId: live.scene.id,
          expectedFocusRevision: live.focusRevision,
        }),
      );
    }
    if (xp !== null)
      x.store.executeProgress(
        x.command({
          kind: 'xp',
          characterId: c.id,
          expectedRevision: 0,
          mode: 'set',
          amount: xp,
          reason: 'Bestätigter Start',
        }),
      );
    return c.id;
  };
  x.read = (source = 'active', totalXp = 0, rewardXp) =>
    x.store.adventuringDay(x.w.token, {
      source,
      rows: [{ level: 1, count: 2 }],
      totalXp,
      ...(rewardXp === undefined ? {} : { rewardXp }),
    });
  return x;
}
test('day preview ignores damaged inactive progress without hiding damaged active progress', (t) => {
  const x = fixture(t),
    active = x.add('Ada', 300),
    inactive = x.add('Nicht in der Party', 900, false);
  x.store.db
    .prepare('UPDATE character_progress SET checksum=? WHERE campaign_id=? AND id=?')
    .run('damaged', x.cam.id, inactive);
  const before = x.store.db.serialize();
  assert.equal(x.read().calculation.dailyBudget, 600);
  assert.equal(x.read('custom', 100).calculation.partySize, 2);
  assert.ok(x.store.db.serialize().equals(before));
  x.store.db
    .prepare('UPDATE character_progress SET checksum=? WHERE campaign_id=? AND id=?')
    .run('damaged', x.cam.id, active);
  assert.throws(() => x.read(), /Fortschritts/);
});
test('day previews round awards identically, preserve actual XP and never write party or scene state', (t) => {
  const x = fixture(t);
  x.add('Ada', 299);
  x.add('Borin', 900);
  x.add('Inaktiv', 355000, false);
  const before = x.store.db.serialize(),
    view = x.read('active', 500, 1);
  assert.equal(view.snapshot.partySize, 2);
  assert.equal(view.snapshot.dailyBudget, 1500);
  assert.equal(view.calculation.shareXp, 1);
  assert.equal(view.calculation.totalAwardXp, 2);
  assert.deepEqual(
    view.calculation.projections.map((p) => [p.beforeXp, p.afterXp, p.afterLevel]),
    [
      [299, 300, 2],
      [900, 901, 3],
    ],
  );
  assert.equal(x.read('custom', 500).calculation.dailyBudget, 600);
  assert.ok(x.store.db.serialize().equals(before));
  x.store.close();
  x.store = new CampaignStore(x.filename);
  x.w = x.store.activate(x.cam.id);
  assert.deepEqual(x.read('active', 500, 1), view);
});
test('unknown XP and rest remain unknown while custom rows stay available', (t) => {
  const x = fixture(t),
    id = x.add('Unbestätigt', null);
  let view = x.read();
  assert.equal(view.snapshot.available, false);
  assert.equal(view.snapshot.dailyBudget, null);
  assert.equal(view.calculation, null);
  assert.match(view.problem, /Level/);
  assert.equal(x.read('custom').calculation.dailyBudget, 600);
  const row = x.store.db
      .prepare('SELECT * FROM character_progress WHERE campaign_id=? AND id=?')
      .get(x.cam.id, id),
    p = JSON.parse(row.payload);
  p.xp = 300;
  p.rest.known = false;
  const payload = JSON.stringify(p);
  x.store.db
    .prepare('UPDATE character_progress SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
    .run(payload, createHash('sha256').update(payload).digest('hex'), x.cam.id, id);
  view = x.read();
  assert.equal(view.snapshot.available, false);
  assert.equal(view.snapshot.shortXp, null);
  assert.equal(view.snapshot.members[0].nextShort, null);
  assert.equal(view.calculation.dailyBudget, 600);
});
test('day calculator bounds large timelines and rejects invalid numeric requests', () => {
  const c = calculateDay([{ level: 1, count: 1 }], 1e12);
  const week = calculateDay([{ level: 1, count: 1 }], 30200, 0);
  assert.deepEqual([week.completedDays, week.shortRests, week.longRests], [100, 202, 100]);
  assert.equal(week.timeline.at(-1).xp, 30200);
  assert.ok(c.timeline.length <= 94);
  assert.equal(c.completedDays, Math.floor(1e12 / 300));
  for (const n of [NaN, Infinity, -1, 0.5, 1e12 + 1])
    assert.throws(() => calculateDay([{ level: 1, count: 1 }], n), /XP/);
});
const tick = () => new Promise((r) => setImmediate(r));
async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await tick();
  }
  assert.ok(check(), 'calculator refresh completed');
}
async function uiFixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const x = fixture(t);
  x.advance = async () => {
    t.mock.timers.tick(160);
    await tick();
  };
  x.add('Ada', 300);
  const { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8')),
    prior = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document });
  const el = (id) => document.getElementById(id),
    popover = el('day-popover');
  window.innerWidth = 1000;
  window.innerHeight = 800;
  el('day-trigger').getBoundingClientRect = () => ({
    left: 700,
    right: 800,
    top: 20,
    bottom: 60,
    width: 100,
    height: 40,
  });
  let open = false;
  popover.matches = (s) => s === ':popover-open' && open;
  popover.showPopover = () => {
    open = true;
  };
  popover.hidePopover = () => {
    open = false;
  };
  const requests = [];
  window.campaign = {
    adventuringDay: async (token, input) => {
      requests.push(input);
      return { ok: true, value: x.store.adventuringDay(token, input) };
    },
  };
  delete require.cache[require.resolve('../../' + dir + '/ui.cjs')];
  const ui = require('../../' + dir + '/ui.cjs');
  ui.initDayCalculator(
    () => {},
    () => {},
  );
  ui.activateDayCalculator(x.w);
  el('day-trigger').onclick();
  await until(() => el('day-summary').children.length > 0);
  t.after(() => {
    ui.activateDayCalculator(null);
    Object.assign(globalThis, prior);
  });
  const input = (id, value) => {
    el(id).value = value;
    el(id).dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  return { ...x, ui, el, input, requests };
}
for (const field of ['day-total-xp', 'day-reward-xp'])
  test(`empty ${field} stays incomplete instead of becoming zero XP`, async (t) => {
    const x = await uiFixture(t);
    x.el('day-mode-progress').onclick();
    x.el('day-separate-reward').checked = field === 'day-reward-xp';
    x.input(field, '');
    await x.advance();
    await until(() => !x.el('day-status').textContent.includes('aktualisiert'));
    assert.match(x.el('day-status').textContent, /XP.*ganze Zahl/);
    assert.equal(x.el('day-summary').children.length, 0);
    x.input(field, '0');
    await x.advance();
    await until(() => x.el('day-summary').children.length > 0);
    assert.match(x.el('day-progress-summary').textContent, /0 volle Tage/);
  });

test('active party budget includes split scenes and stays independent of focus', (t) => {
  const x = fixture(t);
  x.add('Ada', 300);
  const borin = x.add('Borin', 900),
    live = x.store.live(x.w.token);
  x.store.executeLive(
    x.command({
      kind: 'move',
      sceneId: live.scene.id,
      expectedRosterRevision: live.rosterRevision,
      expectedFocusRevision: live.focusRevision,
      expectedClockRevision: live.scene.clock.revision,
      expectedSceneMembershipRevision: live.scene.membershipRevision,
      memberIds: [borin],
      target: { kind: 'new', title: 'Andere Gruppe', expectedContentRevision: live.scene.revision },
    }),
  );
  let state = x.store.live(x.w.token);
  assert.equal(new Set(state.roster.filter((c) => c.active).map((c) => c.sceneId)).size, 2);
  const before = x.store.db.serialize(),
    a = x.read();
  assert.equal(a.snapshot.dailyBudget, 1800);
  assert.ok(x.store.db.serialize().equals(before));
  x.store.executeLive(
    x.command({ kind: 'focus', sceneId: x.scene.id, expectedRevision: state.focusRevision }),
  );
  assert.deepEqual(x.read(), a);
  state = x.store.live(x.w.token);
  const c = state.roster.find((c) => c.id === borin);
  x.store.executeLive(
    x.command({
      kind: 'membership',
      characterId: c.id,
      expectedRevision: c.membershipRevision,
      expectedRosterRevision: state.rosterRevision,
      active: false,
      targetSceneId: null,
      expectedFocusRevision: state.focusRevision,
    }),
  );
  assert.equal(x.read().snapshot.dailyBudget, 600);
});
test('custom row editing and mode changes preserve raw inputs and do not write the roster', async (t) => {
  const x = await uiFixture(t),
    before = x.store.db.serialize(),
    level = x.el('day-rows').querySelector('input');
  level.value = '3';
  level.oninput();
  await x.advance();
  await until(() => x.el('day-summary').children.length > 0);
  assert.equal(x.requests.at(-1).source, 'custom');
  assert.match(x.el('day-summary').textContent, /1.200 XP/);
  x.el('day-mode-progress').onclick();
  x.input('day-total-xp', '125');
  await x.advance();
  await until(() => x.el('day-progress-summary'));
  x.el('day-close').onclick();
  x.el('day-trigger').onclick();
  await until(() => x.el('day-summary').children.length > 0);
  assert.equal(x.el('day-total-xp').value, '125');
  assert.equal(x.el('day-rows').querySelector('input').value, '3');
  assert.ok(x.store.db.serialize().equals(before));
});
test('an older calculator reply cannot replace reactivation with a newer party XP basis', async (t) => {
  const x = await uiFixture(t);
  let release;
  const old = window.campaign.adventuringDay;
  window.campaign.adventuringDay = async (...args) => {
    const value = await old(...args);
    if (!release)
      return new Promise((resolve) => {
        release = () => resolve(value);
      });
    return value;
  };
  x.el('day-active').onclick();
  await until(() => release);
  const id = x.store.live(x.w.token).roster[0].id,
    progress = x.store.progress(x.w.token).characters.find((c) => c.characterId === id);
  x.store.executeProgress(
    x.command({
      kind: 'xp',
      characterId: id,
      expectedRevision: progress.revision,
      mode: 'set',
      amount: 900,
      reason: 'Neue Basis',
    }),
  );
  x.ui.activateDayCalculator(x.w);
  x.el('day-trigger').onclick();
  await until(() => x.el('party-shortcut').textContent.includes('Level 3'));
  release();
  await tick();
  assert.match(x.el('party-shortcut').textContent, /Level 3/);
  assert.match(x.el('day-summary').textContent, /1.200 XP/);
});

test('live pacing keeps early-rest frames, rounds additional load and preserves persisted facts', (t) => {
  const x = fixture(t),
    ada = x.add('Ada', 1000),
    borin = x.add('Borin', 1000);
  const award = (ids, loadXp) => {
    const live = x.store.live(x.w.token),
      progress = x.store.progress(x.w.token);
    x.store.executeProgress(
      x.command({
        kind: 'party-award',
        expectedRosterRevision: live.rosterRevision,
        poolXp: 0,
        loadXp,
        reason: 'Belastung',
        participants: ids.map((id) => ({
          characterId: id,
          revision: progress.characters.find((c) => c.characterId === id).revision,
          membershipRevision: live.roster.find((c) => c.id === id).membershipRevision,
          receiveXp: false,
          receiveLoad: true,
        })),
      }),
    );
  };
  const rest = (id, kind) => {
    const p = x.store.progress(x.w.token).characters.find((c) => c.characterId === id);
    x.store.executeProgress(
      x.command({
        kind: 'rest',
        rest: kind,
        recipients: [{ characterId: id, revision: p.revision }],
      }),
    );
  };
  award([ada], 240);
  rest(ada, 'short');
  award([ada, borin], 200);
  const before = x.store.db.serialize(),
    v = x.read('active', 759, 0),
    a = v.pacing.members.find((c) => c.id === ada),
    b = v.pacing.members.find((c) => c.id === borin);
  assert.equal(a.before.nextRest, 720);
  assert.equal(a.before.sections, 2);
  assert.equal(a.before.fill, 100 / 960);
  assert.equal(a.after.consumed, 720);
  assert.equal(a.after.due, 'short');
  assert.equal(b.after.consumed, 480);
  assert.equal(b.after.due, 'short');
  assert.equal(v.pacing.commonSections, null);
  assert.equal(v.pacing.loadShare, 380);
  assert.equal(v.pacing.totalLoad, 760);
  assert.equal(v.pacing.untilShort, 599);
  assert.equal(v.pacing.untilLong, 1719);
  assert.equal(a.before.budget, 1200);
  assert.equal(
    x.read('active', 1, 9000).pacing.members.find((c) => c.id === ada).after.budget,
    1200,
    'reward level-up never changes the load-only pacing frame',
  );
  assert.equal(x.read('custom', 759).pacing.loadShare, null);
  assert.ok(x.store.db.serialize().equals(before));
  rest(ada, 'short');
  rest(ada, 'short');
  const extra = x.read('active', 3000, 0).pacing.members.find((c) => c.id === ada);
  assert.equal(extra.before.sections, 1);
  assert.equal(extra.after.due, 'long');
  assert.equal(extra.after.consumed, 1840);
});

test('encounter itinerary uses calculator party, per-fight rounding, saved revisions and no writes', (t) => {
  const x = fixture(t);
  for (const name of ['Ada', 'Borin', 'Cara']) x.add(name, 1000);
  const plan = (name, count) =>
    x.store.saveEncounterPlan({
      ...x.command(null),
      expectedRevision: null,
      plan: {
        id: randomUUID(),
        revision: 0,
        name,
        notes: '',
        party: [{ id: 'old-party', name: 'Historische Planung', level: 20, count: 1 }],
        entries: [{ id: randomUUID(), creatureId: 'goblin', count, grouped: false }],
        sources: [],
        catalogHash: '',
      },
    });
  const patrol = plan('Patrouille', 1),
    ambush = plan('Hinterhalt', 2),
    encounters = [
      { id: patrol.id, revision: patrol.revision, count: 2 },
      { id: ambush.id, revision: ambush.revision, count: 1 },
    ];
  const request = { source: 'active', rows: [], totalXp: 999999, rewardXp: 999999, encounters },
    before = x.store.db.serialize(),
    v = x.store.adventuringDay(x.w.token, request);
  assert.equal(v.itinerary.rawLoadXp, 250);
  assert.equal(v.itinerary.rawRewardXp, 200);
  assert.equal(v.itinerary.totalLoadXp, 252);
  assert.equal(v.itinerary.totalRewardXp, 204);
  assert.equal(v.calculation.shareXp, 68);
  assert.equal(v.calculation.totalXp, 252);
  assert.equal(v.pacing.loadShare, 84);
  assert.deepEqual(
    v.itinerary.stages.map((s) => s.cumulativeLoadXp),
    [102, 252],
  );
  assert.ok(x.store.db.serialize().equals(before));
  const custom = x.store.adventuringDay(x.w.token, {
    ...request,
    source: 'custom',
    rows: [{ level: 3, count: 6 }],
  });
  assert.equal(custom.itinerary.totalLoadXp, 162);
  assert.equal(custom.pacing.loadShare, null);
  assert.ok(x.store.db.serialize().equals(before));
  x.store.saveEncounterPlan({
    ...x.command(null),
    expectedRevision: patrol.revision,
    plan: { ...patrol, name: 'Neue Patrouille' },
  });
  const stale = x.store.adventuringDay(x.w.token, request);
  assert.equal(stale.calculation, null);
  assert.match(stale.problem, /Vorlagen aktualisieren/);
});

test('ordered rest stops change only projected frames, preserve per-fight awards and work for custom parties', (t) => {
  const x = fixture(t);
  x.add('Ada', 0);
  x.add('Borin', 0);
  const plan = x.store.saveEncounterPlan({
    ...x.command(null),
    expectedRevision: null,
    plan: {
      id: randomUUID(),
      revision: 0,
      name: 'Patrouille',
      notes: '',
      party: [],
      entries: [{ id: randomUUID(), creatureId: 'goblin', count: 1, grouped: false }],
      sources: [],
      catalogHash: '',
    },
  });
  const row = (count, restBefore) => ({
      id: plan.id,
      revision: plan.revision,
      count,
      ...(restBefore ? { restBefore } : {}),
    }),
    request = {
      source: 'active',
      rows: [],
      totalXp: 0,
      encounters: [row(4), row(1, 'short'), row(1, 'long')],
    };
  const before = x.store.db.serialize(),
    v = x.store.adventuringDay(x.w.token, request);
  assert.equal(v.problem, null);
  assert.deepEqual(v.itinerary.plannedRests, { short: 1, long: 1 });
  assert.deepEqual(
    v.itinerary.stages.map((s) => [s.shortDue, s.longDue, s.knownRestStates]),
    [
      [2, 0, 2],
      [0, 0, 2],
      [0, 0, 2],
    ],
  );
  assert.equal(v.itinerary.totalLoadXp, 456);
  assert.equal(v.itinerary.totalRewardXp, 300);
  assert.equal(v.pacing.members[0].before.consumed, 0);
  assert.equal(v.pacing.members[0].after.consumed, 38);
  assert.equal(v.pacing.members[0].after.shortXp, 38);
  assert.equal(v.pacing.projectedSections, 3);
  const without = x.store.adventuringDay(x.w.token, { ...request, encounters: [row(6)] });
  assert.equal(without.pacing.members[0].after.consumed, 228);
  assert.equal(without.pacing.members[0].after.due, 'short');
  assert.deepEqual(v.calculation, without.calculation);
  const short = x.store.adventuringDay(x.w.token, {
    ...request,
    encounters: [row(4), row(1, 'short')],
  });
  assert.equal(short.pacing.members[0].after.baseline, 152);
  assert.equal(short.pacing.members[0].after.sections, 2);
  assert.equal(short.pacing.members[0].after.nextRest, 226);
  assert.equal(short.pacing.members[0].after.shortXp, 38);
  const overdue = x.store.adventuringDay(x.w.token, {
    ...request,
    encounters: [row(8), row(1, 'short')],
  });
  assert.equal(
    overdue.itinerary.stages[1].longDue,
    2,
    'short rest cannot erase an exhausted daily budget',
  );
  const custom = x.store.adventuringDay(x.w.token, {
    ...request,
    source: 'custom',
    rows: [{ level: 1, count: 2 }],
  });
  assert.deepEqual(custom.itinerary.stages, v.itinerary.stages);
  assert.equal(custom.pacing.loadShare, null);
  assert.match(
    x.store.adventuringDay(x.w.token, { ...request, encounters: [row(1, 'invalid')] }).problem,
    /Tagesplan/,
  );
  assert.ok(x.store.db.serialize().equals(before));
});

test('a planned long rest can establish a hypothetical unknown rest frame without certifying the live party', (t) => {
  const x = fixture(t),
    id = x.add('Rast offen', 0),
    record = x.store.db
      .prepare('SELECT payload FROM character_progress WHERE campaign_id=? AND id=?')
      .get(x.cam.id, id),
    p = JSON.parse(record.payload);
  p.rest.known = false;
  const payload = JSON.stringify(p);
  x.store.db
    .prepare('UPDATE character_progress SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
    .run(payload, createHash('sha256').update(payload).digest('hex'), x.cam.id, id);
  const plan = x.store.saveEncounterPlan({
      ...x.command(null),
      expectedRevision: null,
      plan: {
        id: randomUUID(),
        revision: 0,
        name: 'Wache',
        notes: '',
        party: [],
        entries: [{ id: randomUUID(), creatureId: 'goblin', count: 1, grouped: false }],
        sources: [],
        catalogHash: '',
      },
    }),
    before = x.store.db.serialize();
  const read = (restBefore) =>
    x.store.adventuringDay(x.w.token, {
      source: 'active',
      rows: [],
      totalXp: 0,
      encounters: [{ id: plan.id, revision: plan.revision, count: 1, restBefore }],
    });
  assert.equal(read('short').pacing.members[0].after, null);
  const v = read('long');
  assert.equal(v.pacing.known, 0);
  assert.equal(v.pacing.projectedKnown, 1);
  assert.equal(v.pacing.members[0].before, null);
  assert.equal(v.pacing.members[0].after.consumed, 75);
  assert.equal(v.snapshot.available, false);
  assert.ok(x.store.db.serialize().equals(before));
});

test('level milestones use actual active XP, equal round-up and exact minimum group pools without writing', (t) => {
  const x = fixture(t);
  x.add('Ada', 299);
  x.add('Borin', 850);
  x.add('Cara', 355000);
  x.add('Reserve', 0, false);
  const before = x.store.db.serialize(),
    v = x.read('active', 222, 1),
    a = v.advancement;
  assert.deepEqual(
    a.reached.map((m) => [m.level, m.groupXp, m.members.map((p) => p.name)]),
    [[2, 1, ['Ada']]],
  );
  assert.equal(a.atMaximum, 1);
  assert.deepEqual(
    a.next.map((m) => [m.level, m.groupXp, m.shareXp, m.missingGroupXp]),
    [
      [3, 148, 50, 147],
      [3, 1801, 601, 1800],
    ],
  );
  const target = x.read('active', 222, 148);
  assert.equal(target.calculation.projections.find((p) => p.name === 'Borin').afterLevel, 3);
  assert.equal(
    x.read('active', 222, 147).calculation.projections.find((p) => p.name === 'Borin').afterLevel,
    2,
  );
  assert.deepEqual(target.calculation.milestones, v.calculation.milestones);
  assert.equal(target.calculation.totalXp, 222);
  assert.ok(x.store.db.serialize().equals(before));
});
test('custom level groups aggregate level marks and list every crossed level in reward order', (t) => {
  const x = fixture(t),
    v = x.store.adventuringDay(x.w.token, {
      source: 'custom',
      rows: [{ level: 1, count: 3 }],
      totalXp: 0,
      rewardXp: 8100,
    });
  assert.deepEqual(
    v.advancement.reached.map((m) => [
      m.level,
      m.groupXp,
      m.members.reduce((n, p) => n + p.count, 0),
    ]),
    [
      [2, 898, 3],
      [3, 2698, 3],
      [4, 8098, 3],
    ],
  );
  assert.equal(v.advancement.next[0].level, 5);
  assert.equal(v.advancement.next[0].groupXp, 19498);
  assert.equal(v.calculation.completedDays, 0);
});
test('encounter level marks name the first completed plan row that reaches them', (t) => {
  const x = fixture(t);
  x.add('Ada', 299);
  x.add('Borin', 0);
  const plan = x.store.saveEncounterPlan({
    ...x.command(null),
    expectedRevision: null,
    plan: {
      id: randomUUID(),
      revision: 0,
      name: 'Patrouille',
      notes: '',
      party: [],
      entries: [{ id: randomUUID(), creatureId: 'goblin', count: 1, grouped: false }],
      sources: [],
      catalogHash: '',
    },
  });
  const v = x.store.adventuringDay(x.w.token, {
    source: 'active',
    rows: [],
    totalXp: 0,
    encounters: [
      { id: plan.id, revision: plan.revision, count: 1 },
      { id: plan.id, revision: plan.revision, count: 12 },
    ],
  });
  assert.equal(v.advancement.reached.find((m) => m.members.some((p) => p.name === 'Ada')).stage, 1);
  assert.equal(
    v.advancement.reached.find((m) => m.members.some((p) => p.name === 'Borin')).stage,
    2,
  );
});
test('a level target only replaces local reward input and stale target controls have no authority', async (t) => {
  const x = await uiFixture(t),
    before = x.store.db.serialize();
  x.el('day-mode-progress').onclick();
  x.input('day-total-xp', '125');
  await x.advance();
  await until(() => x.el('day-levels').querySelector('button'));
  const target = x.el('day-levels').querySelector('button'),
    pool = x.el('day-levels').querySelector('li').dataset.groupXp;
  target.onclick();
  assert.equal(x.el('day-total-xp').value, '125');
  assert.equal(x.el('day-separate-reward').checked, true);
  assert.equal(x.el('day-reward-xp').value, pool);
  x.input('day-reward-xp', '777');
  assert.equal(target.isConnected, true);
  target.onclick();
  assert.equal(
    x.el('day-reward-xp').value,
    '777',
    'pending old results cannot overwrite a newer draft',
  );
  await x.advance();
  await until(() => x.el('day-summary').textContent.includes('Level vorher'));
  assert.equal(target.isConnected, false);
  target.onclick();
  assert.equal(x.el('day-reward-xp').value, '777');
  assert.ok(x.store.db.serialize().equals(before));
});

test('repeated encounters expose exact rest crossings and splitting keeps every fight, XP and persisted fact', (t) => {
  const x = fixture(t);
  x.add('Ada', 0);
  x.add('Borin', 0);
  const plan = x.store.saveEncounterPlan({
    ...x.command(null),
    expectedRevision: null,
    plan: {
      id: randomUUID(),
      revision: 0,
      name: 'Wachpatrouille',
      notes: 'Unveränderte Vorlage',
      party: [],
      entries: [{ id: randomUUID(), creatureId: 'goblin', count: 1, grouped: false }],
      sources: [],
      catalogHash: '',
    },
  });
  const row = (count, restBefore) => ({
    id: plan.id,
    revision: plan.revision,
    count,
    ...(restBefore ? { restBefore } : {}),
  });
  const read = (encounters) =>
    x.store.adventuringDay(x.w.token, { source: 'active', rows: [], totalXp: 0, encounters });
  const before = x.store.db.serialize(),
    whole = read([row(12)]);
  assert.equal(whole.itinerary.stages[0].loadShare, 38);
  assert.deepEqual(whole.itinerary.stages[0].restStops, [
    { after: 3, shortDue: 2, longDue: 0 },
    { after: 8, shortDue: 0, longDue: 2 },
  ]);
  const split = read([row(3), row(5, 'short'), row(4, 'long')]);
  assert.equal(split.itinerary.totalLoadXp, whole.itinerary.totalLoadXp);
  assert.equal(split.itinerary.totalRewardXp, whole.itinerary.totalRewardXp);
  assert.deepEqual(split.itinerary.plannedRests, { short: 1, long: 1 });
  assert.equal(split.pacing.members[0].after.consumed, 152);
  assert.deepEqual(split.itinerary.stages[1].restStops, [
    { after: 3, shortDue: 2, longDue: 0 },
    { after: 5, shortDue: 0, longDue: 2 },
  ]);
  assert.deepEqual(split.itinerary.stages[2].restStops, [{ after: 3, shortDue: 2, longDue: 0 }]);
  assert.ok(
    x.store.db.serialize().equals(before),
    'calculation cannot book suggested rests or alter the template',
  );
});

test('rest crossings preserve early, already due, zero-load and unknown Party frames', () => {
  const { projectDayRestStops, projectDayPacing } = require('../../' + dir + '/model.cjs');
  const p = (id, xp, rest) => ({
    characterId: id,
    name: id,
    xp,
    revision: 0,
    health: null,
    rest: { known: true, longXp: 0, shortXp: 0, baseline: 0, sections: 0, ...rest },
  });
  const party = [
    p('early', 1000, { longXp: 340, shortXp: 100, baseline: 240, sections: 1 }),
    p('overdue', 0, { longXp: 350, shortXp: 350 }),
    p('unknown', 0, { known: false }),
  ];
  assert.deepEqual(projectDayRestStops(party, 380, 3), [
    { after: 0, shortDue: 0, longDue: 1 },
    { after: 1, shortDue: 1, longDue: 1 },
    { after: 3, shortDue: 0, longDue: 2 },
  ]);
  assert.deepEqual(projectDayRestStops(party, 0, 99), [{ after: 0, shortDue: 0, longDue: 1 }]);
  for (const stop of projectDayRestStops(party, 380, 3)) {
    const pacing = projectDayPacing(party, stop.after * 380 * party.length);
    assert.equal(stop.shortDue, pacing.members.filter((m) => m.after?.due === 'short').length);
    assert.equal(stop.longDue, pacing.members.filter((m) => m.after?.due === 'long').length);
  }
});

test('rest-stop action splits a repeated row, persists the plan and rejects stale result actions', async (t) => {
  const x = await uiFixture(t),
    plan = x.store.saveEncounterPlan({
      ...x.command(null),
      expectedRevision: null,
      plan: {
        id: randomUUID(),
        revision: 0,
        name: 'Wache',
        notes: '',
        party: [],
        entries: [{ id: randomUUID(), creatureId: 'goblin', count: 1, grouped: false }],
        sources: [],
        catalogHash: '',
      },
    });
  const saved = new Map();
  window.localStorage = {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: (key) => saved.delete(key),
  };
  x.ui.activateDayCalculator(x.w);
  x.el('day-trigger').onclick();
  await until(() => x.el('day-summary').children.length > 0);
  window.campaign.encounterPlans = async () => ({
    ok: true,
    value: x.store.encounterPlans(x.w.token, ''),
  });
  x.el('day-use-encounters').checked = true;
  x.el('day-use-encounters').onchange();
  await tick();
  x.el('day-plan-matches').querySelector('button').onclick();
  const count = x.el('day-plan-selected').querySelector('input');
  count.value = '12';
  count.oninput();
  await x.advance();
  await until(() => x.el('day-plan-result').querySelector('.day-rest-stops button'));
  const before = x.store.db.serialize(),
    stale = x.el('day-plan-result').querySelector('button');
  assert.match(x.el('day-plan-result').textContent, /erste nach Begegnung 3 von 12/);
  stale.onclick();
  assert.deepEqual(
    [...x.el('day-plan-selected').querySelectorAll('input')].map((e) => e.value),
    ['3', '9'],
  );
  assert.equal(x.el('day-plan-selected').lastElementChild.querySelector('select').value, 'short');
  assert.match(x.el('day-plan-edit-status').textContent, /geteilt.*keine Rast gebucht/);
  stale.onclick();
  assert.equal(x.el('day-plan-selected').children.length, 2);
  await x.advance();
  await until(() => x.el('day-plan-result').querySelectorAll('.day-rest-stops').length === 2);
  assert.equal(x.requests.at(-1).encounters[1].restBefore, 'short');
  assert.equal(x.requests.at(-1).encounters[0].id, plan.id);
  const persisted = JSON.parse([...saved.values()][0]);
  assert.deepEqual(
    persisted.itinerary.selected.map((p) => [p.count, p.restBefore]),
    [
      ['3', undefined],
      ['9', 'short'],
    ],
  );
  assert.ok(x.store.db.serialize().equals(before));
  const closed = x
    .el('day-plan-result')
    .querySelectorAll('.day-rest-stops')[1]
    .querySelector('button');
  x.el('day-close').onclick();
  closed.onclick();
  assert.equal(x.el('day-plan-selected').children.length, 2);
});

test('every active figure remains reachable in paged current facts and XP projections without extra reads or writes', async (t) => {
  const x = await uiFixture(t);
  for (let i = 2; i <= 45; i++) x.add('Figur ' + String(i).padStart(2, '0'), i === 45 ? 299 : 300);
  x.el('day-mode-progress').onclick();
  x.input('day-total-xp', '1');
  await x.advance();
  await until(() => x.el('day-progress-summary'));
  const before = x.store.db.serialize();
  let reads = x.requests.length;
  const current = x.el('day-current'),
    summary = x.el('day-summary');
  assert.equal(current.querySelectorAll('td').length, 40 * 4);
  let factsMore = [...current.querySelectorAll('button')].find((b) =>
    b.textContent.includes('Weitere'),
  );
  let xpMore = [...summary.querySelectorAll('button')].find((b) =>
    b.textContent.includes('Weitere'),
  );
  assert.ok(factsMore, 'current facts must expose the remaining active figures');
  assert.ok(xpMore, 'XP projections must expose the remaining active figures');
  x.input('day-total-xp', '2');
  factsMore.onclick();
  xpMore.onclick();
  assert.equal(current.querySelectorAll('td').length, 40 * 4, 'pending facts must not expand');
  assert.equal(
    [...summary.querySelectorAll('table')].at(-1).querySelectorAll('td').length,
    40 * 4,
    'pending projections must not expand',
  );
  await x.advance();
  await until(() => x.requests.length > reads);
  reads = x.requests.length;
  factsMore = [...current.querySelectorAll('button')].find((b) =>
    b.textContent.includes('Weitere'),
  );
  xpMore = [...summary.querySelectorAll('button')].find((b) => b.textContent.includes('Weitere'));
  factsMore.onclick();
  xpMore.onclick();
  assert.match(current.textContent, /Figur 45/);
  assert.match(summary.textContent, /Figur 45/);
  assert.match([...summary.querySelectorAll('table')].at(-1).textContent, /299 → 300.*1 → 2/);
  assert.equal(current.querySelectorAll('td').length, 45 * 4);
  assert.equal(factsMore.hidden, true);
  assert.equal(xpMore.hidden, true);
  assert.equal(x.requests.length, reads, 'paging consumes only the already confirmed calculation');
  assert.ok(x.store.db.serialize().equals(before));
  // New input revokes handlers while the previous result remains visibly pending.
  x.input('day-total-xp', '2');
  factsMore.onclick();
  xpMore.onclick();
  assert.equal(x.requests.length, reads);
  await x.advance();
  await until(() => x.requests.length > reads);
  assert.equal(current.querySelectorAll('td').length, 40 * 4);
  assert.equal(factsMore.isConnected, false);
  factsMore.onclick();
  assert.equal(
    current.querySelectorAll('td').length,
    40 * 4,
    'revoked page controls cannot change the new answer',
  );
});

test('rest-split source reuse checks every row revision and reloads changed or damaged sources on the next read', (t) => {
  const x = fixture(t);
  x.add('Ada', 0);
  x.add('Borin', 0);
  const save = (plan, expectedRevision) =>
    x.store.saveEncounterPlan({ ...x.command(null), expectedRevision, plan });
  let plan = save(
    {
      id: randomUUID(),
      revision: 0,
      name: 'Wachpatrouille',
      notes: 'Originaltext',
      party: [],
      entries: [{ id: randomUUID(), creatureId: 'goblin', count: 1, grouped: false }],
      sources: [],
      catalogHash: '',
    },
    null,
  );
  const row = (revision = plan.revision, restBefore) => ({
    id: plan.id,
    revision,
    count: 3,
    ...(restBefore ? { restBefore } : {}),
  });
  const read = (encounters) =>
    x.store.adventuringDay(x.w.token, { source: 'active', rows: [], totalXp: 0, encounters });
  let before = x.store.db.serialize();
  const valid = read([row(), row(plan.revision, 'short'), row(plan.revision, 'long')]);
  assert.equal(valid.problem, null);
  assert.equal(valid.itinerary.totalLoadXp, 684);
  assert.deepEqual(
    valid.itinerary.stages.map((s) => s.restBefore),
    [undefined, 'short', 'long'],
  );
  const wrongLaterRow = read([row(), row(plan.revision + 1, 'short')]);
  assert.equal(wrongLaterRow.calculation, null);
  assert.match(wrongLaterRow.problem, /Vorlagen aktualisieren/);
  assert.ok(x.store.db.serialize().equals(before));
  const oldRevision = plan.revision;
  plan = save(
    { ...plan, name: 'Zwei Wachen', entries: plan.entries.map((e) => ({ ...e, count: 2 })) },
    plan.revision,
  );
  before = x.store.db.serialize();
  assert.match(read([row(oldRevision)]).problem, /Vorlagen aktualisieren/);
  const refreshed = read([row(), row(plan.revision, 'short')]);
  assert.equal(refreshed.problem, null);
  assert.equal(refreshed.itinerary.totalLoadXp, 1200);
  assert.deepEqual(
    refreshed.itinerary.stages.map((s) => s.name),
    ['Zwei Wachen', 'Zwei Wachen'],
  );
  assert.ok(x.store.db.serialize().equals(before));
  x.store.db
    .prepare('UPDATE encounter_plan SET checksum=? WHERE campaign_id=? AND id=?')
    .run('damaged', x.cam.id, plan.id);
  before = x.store.db.serialize();
  assert.match(read([row(), row(plan.revision, 'long')]).problem, /beschädigt/);
  assert.ok(x.store.db.serialize().equals(before));
});

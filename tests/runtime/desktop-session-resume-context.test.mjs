import { liveInstance } from '../helpers/live.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import path from 'node:path';
import { parseHTML } from '../helpers/dom.mjs';
const require = createRequire(import.meta.url),
  source =
    "export {createCombat} from './combat';\n" + readFileSync('src/app/runtime/live.ts', 'utf8');
const hooks = `\nconst originalStart=startLiveSession;export const __resumeProbe={initHandoff:sessionCloseUI.initHandoffVisitDialog,readSessionResumePrep,renderSessionResume:sessionResumeUI.renderSessionResume,openSessionResume:sessionResumeUI.openSessionResume,packetSource(){resumed=true;return livePacketSource();},setState(w,v,p){context=w;data=v;sources=p;sceneDraft=structuredClone(v.scene);sessionChronicle={entries:[]};tell=(text,error)=>globalThis.__resumeMessages.push({text,error});},history(entries){sessionChronicle={entries};},ports(p){if(p.visit)openMomentVisit=p.visit;if(p.start===false)startLiveSession=originalStart;if(p.execute)execute=p.execute;if(p.start)startLiveSession=p.start;if(p.flush)flushLive=p.flush;if(p.packet)openLivePacket=p.packet;},draft(){return sceneDraft;}};`;
buildSync({
  stdin: {
    contents: source.replace(
      '  return {\n    editorSession,',
      hooks.replace('export const __resumeProbe', 'const __resumeProbe') +
        '\n  return { __resumeProbe, editorSession,',
    ),
    sourcefile: 'live-resume-probe.ts',
    loader: 'ts',
    resolveDir: path.resolve('src/app/runtime'),
  },
  outfile: '.build/planner-resume-probe.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const tick = () => new Promise((r) => setImmediate(r));
async function settle() {
  for (let i = 0; i < 10; i++) await tick();
}
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const ok = (value) => ({ ok: true, value: structuredClone(value) });
function fixture(t) {
  const { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8')),
    prior = Object.fromEntries(
      [
        'window',
        'document',
        'setTimeout',
        'clearTimeout',
        'Event',
        'Option',
        '__resumeMessages',
      ].map((k) => [k, globalThis[k]]),
    );
  Object.assign(globalThis, {
    window,
    document,
    setTimeout: () => 0,
    clearTimeout: () => {},
    Event: window.Event,
    __resumeMessages: [],
  });
  const dialog = document.createElement('dialog');
  dialog.id = 'live-session-resume-dialog';
  dialog.innerHTML = [
    'groups',
    'readiness',
    'masks',
    'visits',
    'narratives',
    'worlds',
    'handoff',
    'narrative-count',
    'loot-status',
    'status',
  ]
    .map((id) => `<div id="live-session-resume-${id}"></div>`)
    .join('');
  document.body.append(dialog);
  for (const [tag, id] of [
    ['select', 'live-session-plan'],
    ['div', 'session-packet-visits'],
  ])
    if (!document.getElementById(id)) {
      const node = document.createElement(tag);
      node.id = id;
      document.getElementById('live').append(node);
    }
  dialog.open = true;
  dialog.close = () => {
    dialog.open = false;
  };
  dialog.showModal = () => {
    dialog.open = true;
  };
  for (const s of document.querySelectorAll('select'))
    Object.defineProperty(s, 'value', { value: '', writable: true });
  globalThis.Option = function (text = '', value = '') {
    const o = document.createElement('option');
    o.textContent = text;
    o.value = value;
    return o;
  };
  delete require.cache[require.resolve('../../.build/planner-resume-probe.cjs')];
  window.campaign = {};
  const ui = liveInstance(
    require('../../.build/planner-resume-probe.cjs'),
    document,
    window,
  ).__resumeProbe;
  ui.initHandoff();
  const handoffDialog = document.getElementById('handoff-visit-dialog');
  handoffDialog.close = () => {
    handoffDialog.open = false;
  };
  handoffDialog.showModal = () => {
    handoffDialog.open = true;
  };
  const handoffPlan = document.getElementById('handoff-visit-plan');
  let chosenPlan = null;
  Object.defineProperty(handoffPlan, 'value', {
    get() {
      return chosenPlan ?? '';
    },
    set(v) {
      chosenPlan = [...this.options].some((o) => o.value === v) ? v : null;
    },
  });
  Object.defineProperty(handoffPlan, 'selectedIndex', {
    get() {
      return chosenPlan === null ? -1 : [...this.options].findIndex((o) => o.value === chosenPlan);
    },
  });
  handoffPlan.add = (o) => handoffPlan.append(o);
  const w = { token: 'token', campaign: { id: 'campaign' } },
    scene = {
      id: 'scene',
      revision: 1,
      title: 'Vorhut',
      notes: '',
      readAloud: 'Bisheriger Text',
      locationId: null,
      membershipRevision: 1,
      clock: { epochId: 'epoch', instantMs: '0', revision: 0 },
      members: [],
      adoption: null,
    },
    v = {
      scene,
      scenes: [{ ...scene, primary: true, members: 0 }],
      roster: [],
      focusId: 'scene',
      focusRevision: 1,
    },
    plans = Array.from({ length: 30 }, (_, i) => ({
      id: 'plan-' + i,
      name: 'Plan ' + i,
      revision: 1,
      scenes: [{ id: 'visit-' + i, title: 'Besuch ' + i }],
    })),
    calls = [],
    packet = {
      planId: 'plan-0',
      planRevision: 1,
      basis: 'basis-1',
      visits: [
        {
          id: 'visit-0',
          title: 'Besuch 0',
          blocks: [{ kind: 'read-aloud', heading: 'Eröffnung', text: '  Vorgelesen\r\n- Mantel' }],
        },
      ],
    };
  ui.setState(w, v, { plans, notes: [] });
  ui.ports({
    start: async () => {
      calls.push('start');
      return true;
    },
    flush: async () => true,
    packet: async () => {
      calls.push('packet');
    },
  });
  Object.assign(window.campaign, {
    progress: async () => ok({ characters: [] }),
    scenePreparation: async () => ok({ nextVisit: null }),
    sceneWorld: async () => ok({ notices: [], date: 'Tag 1', scene: { locationId: null } }),
    agenda: async () => ok({ items: [], scene: { instantMs: '0' } }),
    narrativeJournal: async () => ok({ entries: [], counts: { open: 0 } }),
    sessionProgress: async (_, id) => {
      calls.push(id);
      return ok({
        planId: id,
        planRevision: 1,
        visits: [{ id: 'visit-' + id.split('-')[1], title: 'Besuch', focused: null }],
      });
    },
    sessionPacket: async () => ok(packet),
  });
  const row = {
      sceneId: 'scene',
      sceneTitle: 'Vorhut',
      nextVisit: { planId: 'plan-0', planRevision: 1, visitId: 'visit-0', title: 'Besuch 0' },
      packet: packet.visits[0],
      packetBasis: 'basis-1',
      warnings: [],
      fallback: true,
      planName: 'Plan 0',
    },
    audit = { masks: [], treasures: { count: 0, units: 0 }, xpBooked: true, events: 0 };
  const render = () =>
    ui.renderSessionResume(audit, {
      visits: [row],
      worlds: [],
      narratives: { entries: [], counts: { open: 0 } },
      problems: [],
      readiness: [],
      readinessAvailable: true,
      narrativesAvailable: true,
    });
  const start = () => document.querySelector('.session-resume-start');
  t.after(() => Object.assign(globalThis, prior));
  return {
    window,
    document,
    dialog,
    ui,
    w,
    v,
    plans,
    calls,
    row,
    packet,
    render,
    start,
    messages: globalThis.__resumeMessages,
  };
}
test('a detached opening button cannot start a session after the dialog is dismissed', async (t) => {
  const x = fixture(t);
  x.render();
  const button = x.start();
  x.dialog.close();
  button.onclick();
  await settle();
  assert.deepEqual(x.calls, []);
});
test('a current opening copies the displayed author bytes and starts only once', async (t) => {
  const x = fixture(t);
  x.render();
  x.start().onclick();
  await settle();
  assert.equal(x.calls.filter((c) => c === 'start').length, 1);
  assert.equal(x.ui.draft().readAloud, '  Vorgelesen\r\n- Mantel');
  assert.equal(x.calls.includes('packet'), true);
});
test('an old start acknowledgement cannot place text into another campaign with the same scene ID', async (t) => {
  const x = fixture(t),
    held = deferred();
  x.ui.ports({ start: () => held.promise });
  x.render();
  x.start().onclick();
  await settle();
  x.ui.setState(
    { ...x.w, token: 'new-token' },
    { ...x.v, scene: { ...x.v.scene, readAloud: 'Andere Kampagne' } },
    { plans: [] },
  );
  held.resolve(true);
  await settle();
  assert.equal(x.ui.draft().readAloud, 'Andere Kampagne');
  assert.equal(x.calls.includes('packet'), false);
});
test('newer scene prose entered during start survives the original opening handoff', async (t) => {
  const x = fixture(t),
    held = deferred();
  x.ui.ports({ start: () => held.promise });
  x.render();
  x.start().onclick();
  await settle();
  x.ui.draft().readAloud = 'Neue eigene Prosa';
  held.resolve(true);
  await settle();
  assert.equal(x.ui.draft().readAloud, 'Neue eigene Prosa');
});
test('the first eligible fallback does not read all thirty plans', async (t) => {
  const x = fixture(t),
    prep = await x.ui.readSessionResumePrep(x.w.token, x.v.scenes);
  assert.equal(prep.visits.length, 1);
  assert.deepEqual(
    x.calls.filter((c) => c.startsWith('plan-')),
    ['plan-0'],
  );
});
test('an unavailable unrelated plan does not discard a usable first opening', async (t) => {
  const x = fixture(t),
    read = x.window.campaign.sessionProgress;
  x.window.campaign.sessionProgress = async (...args) =>
    args[1] === 'plan-29' ? { ok: false, error: 'Fehlende Quelle' } : read(...args);
  const prep = await x.ui.readSessionResumePrep(x.w.token, x.v.scenes);
  assert.equal(prep.visits[0].nextVisit.planId, 'plan-0');
});
test('changed packet author bytes require a fresh review before starting', async (t) => {
  const x = fixture(t);
  x.render();
  x.window.campaign.sessionPacket = async () => ok({ ...x.packet, basis: 'basis-2' });
  x.start().onclick();
  await settle();
  assert.equal(x.calls.includes('start'), false);
  assert.equal(x.ui.draft().readAloud, 'Bisheriger Text');
  assert.equal(x.dialog.open, true);
});

test('a changed owner during the real start flush prevents dispatching the session marker', async (t) => {
  const x = fixture(t),
    held = deferred();
  x.ui.ports({
    start: false,
    flush: () => held.promise,
    execute: async (action) => {
      x.calls.push(action.kind);
      return {};
    },
  });
  x.render();
  x.start().onclick();
  await settle();
  x.ui.setState({ ...x.w, token: 'other' }, x.v, { plans: [] });
  held.resolve(true);
  await settle();
  assert.equal(x.calls.includes('session-marker'), false);
});
test('a repeated opening click while its source is pending starts only once', async (t) => {
  const x = fixture(t),
    held = deferred();
  x.window.campaign.sessionPacket = () => held.promise;
  x.render();
  const b = x.start();
  b.onclick();
  b.onclick();
  await settle();
  held.resolve(ok(x.packet));
  await settle();
  assert.equal(x.calls.filter((c) => c === 'start').length, 1);
});
test('a missing world source preserves the healthy prepared opening and records missing evidence', async (t) => {
  const x = fixture(t);
  x.window.campaign.sceneWorld = async () => ({ ok: false, error: 'Weltlage fehlt' });
  const prep = await x.ui.readSessionResumePrep(x.w.token, x.v.scenes);
  assert.equal(prep.visits.length, 1);
  assert.equal(prep.worlds.length, 0);
  assert.match(prep.problems.join(' '), /Weltlage fehlt/);
});
test('a missing first plan is reported while a healthy later plan remains usable', async (t) => {
  const x = fixture(t),
    original = x.window.campaign.sessionProgress;
  x.window.campaign.sessionProgress = async (...args) =>
    args[1] === 'plan-0' ? { ok: false, error: 'Planquelle fehlt' } : original(...args);
  x.window.campaign.sessionPacket = async () =>
    ok({ ...x.packet, planId: 'plan-1', visits: [{ ...x.packet.visits[0], id: 'visit-1' }] });
  const prep = await x.ui.readSessionResumePrep(x.w.token, x.v.scenes);
  assert.equal(prep.visits[0].nextVisit.planId, 'plan-1');
  assert.deepEqual(x.calls, ['plan-1']);
  assert.match(prep.problems.join(' '), /Planquelle fehlt/);
});
test('canceling a fallback read stops before requesting another plan', async (t) => {
  const x = fixture(t),
    held = deferred();
  let current = true;
  x.window.campaign.sessionProgress = async (_, id) => {
    x.calls.push(id);
    return held.promise;
  };
  const loading = x.ui.readSessionResumePrep(x.w.token, x.v.scenes, () => current),
    rejection = assert.rejects(loading, /Wiederaufnahme/);
  await settle();
  current = false;
  held.resolve(ok({ planId: 'plan-0', planRevision: 1, visits: [] }));
  await rejection;
  assert.deepEqual(x.calls, ['plan-0']);
});
test('the current selected plan is preferred over alphabetical unrelated plans', async (t) => {
  const x = fixture(t);
  x.document.getElementById('live-session-plan').value = 'plan-12';
  x.window.campaign.sessionPacket = async () =>
    ok({ ...x.packet, planId: 'plan-12', visits: [{ ...x.packet.visits[0], id: 'visit-12' }] });
  const prep = await x.ui.readSessionResumePrep(x.w.token, x.v.scenes);
  assert.equal(prep.visits[0].nextVisit.planId, 'plan-12');
  assert.deepEqual(x.calls, ['plan-12']);
});
test('unread preparation never appears as all visits completed', (t) => {
  const x = fixture(t);
  x.ui.renderSessionResume(
    { masks: [], treasures: { count: 0, units: 0 }, xpBooked: true, events: 0 },
    {
      visits: [],
      worlds: [],
      narratives: { entries: [], counts: { open: 0 } },
      problems: ['Quelle fehlt'],
      readiness: [],
      readinessAvailable: false,
      narrativesAvailable: false,
    },
  );
  assert.match(
    x.document.getElementById('live-session-resume-visits').textContent,
    /nicht vollständig geprüft/,
  );
  assert.doesNotMatch(
    x.document.getElementById('live-session-resume-visits').textContent,
    /Alle vorbereiteten/,
  );
});

test('a mutated resume row cannot promote newer text into the displayed opening', async (t) => {
  const x = fixture(t);
  x.render();
  x.row.packet.blocks[0].text = 'Späterer Text';
  x.start().onclick();
  await settle();
  assert.equal(x.ui.draft().readAloud, '  Vorgelesen\r\n- Mantel');
});
test('an unread narrative journal is shown as unknown rather than zero open tasks', async (t) => {
  const x = fixture(t);
  x.window.campaign.narrativeJournal = async () => ({ ok: false, error: 'Journal fehlt' });
  const prep = await x.ui.readSessionResumePrep(x.w.token, x.v.scenes);
  x.ui.renderSessionResume(
    { masks: [], treasures: { count: 0, units: 0 }, events: 0, xpBooked: true },
    prep,
  );
  assert.match(
    x.document.getElementById('live-session-resume-narrative-count').textContent,
    /nicht geprüft/,
  );
  assert.doesNotMatch(
    x.document.getElementById('live-session-resume-narratives').textContent,
    /Keine offenen/,
  );
});

test('start groups stay usable while optional opening sources are still loading', async (t) => {
  const x = fixture(t),
    held = deferred();
  x.dialog.close();
  x.window.campaign.combat = async () => ok({ recent: [] });
  x.window.campaign.chase = async () => ok({ recent: [] });
  x.window.campaign.treasures = async () => ok({ items: [], next: null });
  x.window.campaign.sessionProgress = () => held.promise;
  const loading = x.ui.openSessionResume();
  await settle();
  const start = [...x.document.querySelectorAll('#live-session-resume-groups button')].find(
    (b) => b.textContent === 'Spielabend hier beginnen',
  );
  assert(start);
  start.onclick();
  await settle();
  assert.equal(x.calls.filter((c) => c === 'start').length, 1);
  held.resolve(ok({ planId: 'plan-0', planRevision: 1, visits: [] }));
  await loading;
  assert.equal(x.dialog.open, false);
});
test('unavailable mask audit does not turn unknown masks or loot into a no-content claim', async (t) => {
  const x = fixture(t);
  x.dialog.close();
  x.window.campaign.combat = async () => ({ ok: false, error: 'Maskenquelle fehlt' });
  x.window.campaign.chase = async () => ok({ recent: [] });
  x.window.campaign.treasures = async () => ok({ items: [], next: null });
  await x.ui.openSessionResume();
  assert(x.document.querySelector('#live-session-resume-groups button'));
  assert.match(x.document.getElementById('live-session-resume-masks').textContent, /nicht geprüft/);
  assert.match(
    x.document.getElementById('live-session-resume-loot-status').textContent,
    /nicht geprüft/,
  );
});

test('an opening keeps controlled and external author links instead of flattening them', async (t) => {
  const x = fixture(t),
    raw = '  [Alias](dungeon-ref:note/10000000-0000-4000-8000-000000000001)\r\n[[Vault note]]';
  x.row.packet.blocks[0].text = raw;
  x.render();
  x.start().onclick();
  await settle();
  assert.equal(x.ui.draft().readAloud, raw);
  assert.equal(x.calls.includes('packet'), true);
});

test('current party readiness retains health facts and marks an unknown rest budget', async (t) => {
  const x = fixture(t);
  x.window.campaign.progress = async () =>
    ok({
      characters: [
        {
          characterId: 'pc',
          name: 'Ria',
          active: true,
          sceneId: 'scene',
          xp: 0,
          rest: { known: false, baseline: 0, longXp: 0, sections: 0 },
          health: { hp: 7, maxHp: 8, tempHp: 0, conditions: '', concentrating: false },
        },
      ],
    });
  const prep = await x.ui.readSessionResumePrep(x.w.token, x.v.scenes);
  x.ui.renderSessionResume(
    { masks: [], treasures: { count: 0, units: 0 }, events: 0, xpBooked: true },
    prep,
  );
  assert.equal(prep.readinessAvailable, true);
  const section = x.document.getElementById('live-session-resume-readiness');
  assert.match(section.textContent, /Ria/);
  assert.match(section.textContent, /7 \/ 8 HP/);
  assert.match(section.textContent, /Rastbudget offen/);
  assert(section.querySelector('.session-resume-character-warning'));
});
test('unread party readiness remains unknown while a healthy opening is available', async (t) => {
  const x = fixture(t);
  x.window.campaign.progress = async () => ({ ok: false, error: 'Partyquelle fehlt' });
  const prep = await x.ui.readSessionResumePrep(x.w.token, x.v.scenes);
  assert.equal(prep.visits.length, 1);
  x.ui.renderSessionResume(
    { masks: [], treasures: { count: 0, units: 0 }, events: 0, xpBooked: true },
    prep,
  );
  assert.match(
    x.document.getElementById('live-session-resume-readiness').textContent,
    /nicht geprüft/,
  );
  assert.doesNotMatch(
    x.document.getElementById('live-session-resume-readiness').textContent,
    /Leere Party/,
  );
});
test('a detached rest handoff cannot report an old failure after the dialog closes', async (t) => {
  const x = fixture(t),
    prep = await x.ui.readSessionResumePrep(x.w.token, x.v.scenes);
  x.ui.renderSessionResume(
    { masks: [], treasures: { count: 0, units: 0 }, events: 0, xpBooked: true },
    prep,
  );
  const button = [...x.document.querySelectorAll('#live-session-resume-readiness button')].find(
    (b) => b.textContent === 'Rast planen…',
  );
  assert(button);
  x.dialog.close();
  button.onclick();
  await settle();
  assert.deepEqual(x.messages, []);
});

test('group start briefings retain unknown sources and the guarded opening action', async (t) => {
  const x = fixture(t);
  const prep = await x.ui.readSessionResumePrep(x.w.token, x.v.scenes);
  x.ui.renderSessionResume(
    x.audit ?? { masks: [], treasures: { count: 0, units: 0 }, xpBooked: true, events: 0 },
    prep,
  );
  const briefing = x.document.querySelector('.session-resume-briefing');
  assert.ok(briefing);
  assert.match(briefing.textContent, /Übergabe/);
  assert.match(briefing.textContent, /Party/);
  assert.match(briefing.textContent, /Weltlage/);
  assert.match(briefing.textContent, /Offene Fäden/);
  assert.ok(briefing.textContent.includes('  Vorgelesen\r\n- Mantel'));
  const start = [...briefing.querySelectorAll('button')].find(
    (b) => b.textContent === 'Spielabend beginnen + Text in Szene',
  );
  x.dialog.close();
  start.onclick();
  await settle();
  assert.deepEqual(
    x.calls.filter((c) => c === 'start'),
    [],
  );
});
test('a partial group briefing never claims readiness or an empty table as verified', async (t) => {
  const x = fixture(t);
  x.ui.renderSessionResume(
    { masks: [], treasures: { count: 0, units: 0 }, events: 0, xpBooked: true },
    {
      visits: [],
      worlds: [],
      narratives: { entries: [], counts: { open: 0 } },
      problems: ['Quelle fehlt'],
      readiness: [],
      readinessAvailable: false,
      narrativesAvailable: false,
    },
    'Masken fehlen',
  );
  const group = x.document.getElementById('live-session-resume-groups');
  assert.match(group.textContent, /Stand unvollständig/);
  assert.match(group.textContent, /noch nicht geprüft/);
  assert.doesNotMatch(group.textContent, /Startklar/);
  assert.doesNotMatch(
    group.querySelector('.session-resume-briefing-grid').textContent,
    /Leere Party|Keine laufende Szene/,
  );
});

test('a packet handoff preserves newer scene prose entered during its flush', async (t) => {
  const x = fixture(t),
    held = deferred();
  x.document.getElementById('live-session-plan').value = 'plan-0';
  const source = x.ui.packetSource();
  x.ui.ports({ flush: () => held.promise });
  const copying = source.readAloud('Alter Mappentext', 'Titel');
  x.ui.draft().readAloud = 'Neue eigene Eingabe';
  held.resolve(true);
  await copying;
  assert.equal(x.ui.draft().readAloud, 'Neue eigene Eingabe');
});

test('a refreshed packet cannot finish an older read-aloud approval after its flush', async (t) => {
  const x = fixture(t),
    held = deferred();
  x.document.getElementById('live-session-plan').value = 'plan-0';
  const source = x.ui.packetSource();
  let active = true;
  x.ui.ports({ flush: () => held.promise });
  const copying = source.readAloud('Alter Mappentext', 'Titel', () => active);
  active = false;
  held.resolve(true);
  await copying;
  assert.equal(x.ui.draft().readAloud, 'Bisheriger Text');
});

test('the packet encounter handoff rejects a newer prepared group revision', async (t) => {
  const x = fixture(t);
  x.v.scene.adoption = { id: 'adoption', planId: 'plan-0', visitId: 'visit-0' };
  x.document.getElementById('live-session-plan').value = 'plan-0';
  x.window.campaign.scenePreparation = async () => ok({ groups: [{ id: 'group', revision: 2 }] });
  const source = x.ui.packetSource();
  await assert.rejects(() => source.prepareEncounter('group', 'visit-0', 1), /nicht verfügbar/);
});

test('a superseded packet cannot append a chronicle moment draft', async (t) => {
  const x = fixture(t);
  x.document.getElementById('live-session-plan').value = 'plan-0';
  const source = x.ui.packetSource();
  const title = x.document.getElementById('live-moment-title'),
    summary = x.document.getElementById('live-moment-summary');
  title.value = 'Eigener Moment';
  summary.value = 'Eigene Zusammenfassung';
  await source.captureMoment('reward', 'Alter Block', 'Alter Text', () => false);
  assert.equal(title.value, 'Eigener Moment');
  assert.equal(summary.value, 'Eigene Zusammenfassung');
});

test('the displayed handoff reuses visit preparation and places it before the displayed opening', async (t) => {
  const x = fixture(t),
    calls = [];
  x.ui.history([
    { id: 'end', sessionMarker: 'end', handoff: 'Nächster Einstieg: Nordtor\n- Frist bleibt' },
  ]);
  x.ui.ports({
    visit: async (plan, seed, current) => {
      if (current()) calls.push({ plan, seed });
    },
  });
  x.render();
  const button = [...x.document.querySelectorAll('.session-resume-briefing button')].find(
    (b) => b.textContent === 'Einstieg aus Übergabe vorbereiten…',
  );
  assert(button);
  button.onclick();
  await settle();
  assert.equal(x.dialog.open, false);
  await submitHandoff(x);
  assert.deepEqual(calls, [
    {
      plan: 'plan-0',
      seed: {
        title: 'Nordtor',
        notes: 'Nächster Einstieg: Nordtor\n- Frist bleibt',
        locationId: null,
        readAloud: '',
        noteIds: [],
        newPlan: false,
        beforeVisitId: 'visit-0',
      },
    },
  ]);
});
test('a detached handoff button cannot prepare a visit after dismissal', async (t) => {
  const x = fixture(t),
    calls = [];
  x.ui.history([{ id: 'end', sessionMarker: 'end', handoff: 'Weiter am Tor' }]);
  x.ui.ports({ visit: async (...args) => calls.push(args) });
  x.render();
  const button = [...x.document.querySelectorAll('.session-resume-briefing button')].find(
    (b) => b.textContent === 'Einstieg aus Übergabe vorbereiten…',
  );
  assert(button);
  x.dialog.close();
  button.onclick();
  await settle();
  assert.deepEqual(calls, []);
});

test('handoff preparation retains all 10000 original characters including whitespace and CRLF', async (t) => {
  const x = fixture(t),
    raw = '  Nächster Einstieg: Tor\r\n' + '.'.repeat(9966) + '\r\nENDE  ',
    calls = [];
  assert.equal(raw.length, 10000);
  x.ui.history([{ id: 'end', sessionMarker: 'end', handoff: raw }]);
  x.ui.ports({
    visit: async (_plan, seed, current) => {
      if (current()) calls.push(seed);
    },
  });
  x.render();
  const button = [...x.document.querySelectorAll('.session-resume-briefing button')].find(
    (b) => b.textContent === 'Einstieg aus Übergabe vorbereiten…',
  );
  assert(button);
  button.onclick();
  await settle();
  assert.equal(x.document.getElementById('handoff-visit-notes').value, raw);
  await submitHandoff(x);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].notes, raw);
});

async function submitHandoff(x) {
  x.document.getElementById('handoff-visit-form').onsubmit({ preventDefault() {} });
  await settle();
}

test('the handoff dialog distinguishes an explicit new plan and retains entered read-aloud text', async (t) => {
  const x = fixture(t),
    calls = [];
  x.ui.history([{ sessionMarker: 'end', handoff: 'Weiter am Tor' }]);
  x.ui.ports({
    visit: async (plan, seed, current) => {
      assert(current());
      calls.push({ plan, seed });
    },
  });
  x.render();
  [...x.document.querySelectorAll('.session-resume-briefing button')]
    .find((b) => b.textContent === 'Einstieg aus Übergabe vorbereiten…')
    .click();
  await settle();
  x.document.getElementById('handoff-visit-plan').value = '';
  x.document.getElementById('handoff-visit-read-aloud').value = '  Willkommen\r\n';
  await submitHandoff(x);
  assert.equal(calls[0].plan, null);
  assert.equal(calls[0].seed.newPlan, true);
  assert.equal(calls[0].seed.beforeVisitId, null);
  assert.equal(calls[0].seed.readAloud, '  Willkommen\r\n');
});

test('a handoff review submits once and cancellation revokes its pending context', async (t) => {
  const x = fixture(t),
    calls = [];
  let release;
  const gate = new Promise((r) => (release = r));
  x.ui.history([{ sessionMarker: 'end', handoff: 'Nächster Einstieg: Nordtor' }]);
  x.ui.ports({
    visit: async (planId, seed, current) => {
      calls.push({ planId, seed, current });
      await gate;
    },
  });
  x.render();
  const button = [...x.document.querySelectorAll('#live-session-resume-groups button')].find(
    (b) => b.textContent === 'Einstieg aus Übergabe vorbereiten…',
  );
  button.onclick();
  await settle();
  const form = x.document.getElementById('handoff-visit-form');
  form.onsubmit(new x.window.Event('submit', { cancelable: true }));
  form.onsubmit(new x.window.Event('submit', { cancelable: true }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].current(), true);
  x.document.getElementById('handoff-visit-cancel').onclick();
  assert.equal(calls[0].current(), false);
  release();
  await settle();
  assert.equal(x.document.getElementById('handoff-visit-dialog').open, false);
  assert.ok(!x.messages.some((m) => m.text.includes('vollständiger nächster Besuch vorbereitet')));
});

test('an unlisted recommended plan stays explicit and cannot silently become a new plan', async (t) => {
  const x = fixture(t),
    calls = [];
  x.plans.splice(0, 1);
  x.ui.history([{ sessionMarker: 'end', handoff: 'Weiter am Tor' }]);
  x.ui.ports({
    visit: async (plan, seed, current) => {
      assert(current());
      calls.push({ plan, seed });
    },
  });
  x.render();
  [...x.document.querySelectorAll('.session-resume-briefing button')]
    .find((b) => b.textContent === 'Einstieg aus Übergabe vorbereiten…')
    .click();
  await settle();
  const select = x.document.getElementById('handoff-visit-plan');
  assert.equal(select.value, 'plan-0');
  assert(select.selectedIndex >= 0);
  await submitHandoff(x);
  assert.equal(calls[0].plan, 'plan-0');
  assert.equal(calls[0].seed.newPlan, false);
  assert.equal(calls[0].seed.beforeVisitId, 'visit-0');
});
test('a plan select without any selected option cannot submit a new-plan request', async (t) => {
  const x = fixture(t),
    calls = [];
  x.ui.history([{ sessionMarker: 'end', handoff: 'Weiter' }]);
  x.ui.ports({ visit: async () => calls.push('write') });
  x.render();
  [...x.document.querySelectorAll('.session-resume-briefing button')]
    .find((b) => b.textContent === 'Einstieg aus Übergabe vorbereiten…')
    .click();
  await settle();
  x.document.getElementById('handoff-visit-plan').value = 'missing-option';
  await submitHandoff(x);
  assert.deepEqual(calls, []);
  assert.match(x.document.getElementById('handoff-visit-status').textContent, /Zielplan auswählen/);
});
test('a late cancelled submission cannot close or unlock a newer handoff draft', async (t) => {
  const x = fixture(t),
    old = deferred();
  let count = 0;
  x.ui.history([{ sessionMarker: 'end', handoff: 'Erste Übergabe' }]);
  x.ui.ports({
    visit: async () => {
      if (++count === 1) await old.promise;
      else throw new Error('Zweiter Auftrag offen');
    },
  });
  const open = async () => {
    x.render();
    [...x.document.querySelectorAll('.session-resume-briefing button')]
      .find((b) => b.textContent === 'Einstieg aus Übergabe vorbereiten…')
      .click();
    await settle();
  };
  await open();
  x.document.getElementById('handoff-visit-form').onsubmit({ preventDefault() {} });
  await settle();
  x.document.getElementById('handoff-visit-cancel').click();
  x.dialog.showModal();
  x.ui.history([{ sessionMarker: 'end', handoff: 'Zweite Übergabe' }]);
  await open();
  x.document.getElementById('handoff-visit-notes').value = '  Zweiter Text\r\n';
  old.resolve();
  await settle();
  assert.equal(x.document.getElementById('handoff-visit-dialog').open, true);
  assert.equal(x.document.getElementById('handoff-visit-notes').value, '  Zweiter Text\r\n');
  assert.equal(x.document.getElementById('handoff-visit-form').inert, false);
  await submitHandoff(x);
  assert.equal(count, 2);
  assert.match(
    x.document.getElementById('handoff-visit-status').textContent,
    /Zweiter Auftrag offen/,
  );
});

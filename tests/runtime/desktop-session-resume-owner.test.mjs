import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, settle, deferred, ok } from '../helpers/session-owners.mjs';

test('a sequential adopted visit takes priority over the selected fallback plan', async (t) => {
  const x = fixture(t);
  x.document.getElementById('live-session-plan').value = 'plan-12';
  x.window.campaign.scenePreparation = async () => ok({ nextVisit: x.row.nextVisit });
  const prep = await x.ui.readSessionResumePrep(x.w.token, x.v.scenes);
  assert.equal(prep.visits[0].nextVisit.planId, 'plan-0');
  assert.equal(prep.visits[0].fallback, false);
  assert.deepEqual(x.calls, [], 'no fallback plan read overrides the adopted sequence');
});

test('groups sharing a plan share its packet read while retaining their own opening rows', async (t) => {
  const x = fixture(t);
  let packets = 0;
  x.window.campaign.sessionPacket = async () => {
    packets++;
    return ok(x.packet);
  };
  const prep = await x.ui.readSessionResumePrep(x.w.token, [
    ...x.v.scenes,
    { ...x.v.scenes[0], id: 'second-scene', title: 'Nachhut' },
  ]);
  assert.equal(packets, 1);
  assert.deepEqual(
    prep.visits.map((row) => row.sceneId),
    ['scene', 'second-scene'],
  );
});

for (const failed of [false, true])
  test(`a late ${failed ? 'failed' : 'successful'} packet validation cannot start in a newer campaign`, async (t) => {
    const x = fixture(t),
      held = deferred();
    let reads = 0;
    x.window.campaign.sessionPacket = () => {
      reads++;
      return held.promise;
    };
    x.render();
    x.start().click();
    await settle();
    assert.equal(reads, 1, 'the real opening validation is pending');
    x.setOwner(
      { token: 'other-token', campaign: { id: 'other-campaign' } },
      { ...x.v, scene: { ...x.v.scene, readAloud: 'Andere Kampagne' } },
      { plans: [] },
    );
    held.resolve(failed ? { ok: false, error: 'Veraltete Mappe' } : ok(x.packet));
    await settle();
    assert.equal(x.state.scene.readAloud, 'Andere Kampagne');
    assert.deepEqual(x.calls, []);
    assert.deepEqual(x.messages, []);
  });

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
  assert.equal(x.state.scene.readAloud, '  Vorgelesen\r\n- Mantel');
  assert.equal(x.calls.includes('packet'), true);
});
test('an old start acknowledgement cannot place text into another campaign with the same scene ID', async (t) => {
  const x = fixture(t),
    held = deferred();
  Object.assign(x.callbacks, { start: () => held.promise });
  x.render();
  x.start().onclick();
  await settle();
  x.setOwner(
    { ...x.w, token: 'new-token' },
    { ...x.v, scene: { ...x.v.scene, readAloud: 'Andere Kampagne' } },
    { plans: [] },
  );
  held.resolve(true);
  await settle();
  assert.equal(x.state.scene.readAloud, 'Andere Kampagne');
  assert.equal(x.calls.includes('packet'), false);
});
test('newer scene prose entered during start survives the original opening handoff', async (t) => {
  const x = fixture(t),
    held = deferred();
  Object.assign(x.callbacks, { start: () => held.promise });
  x.render();
  x.start().onclick();
  await settle();
  x.state.scene.readAloud = 'Neue eigene Prosa';
  held.resolve(true);
  await settle();
  assert.equal(x.state.scene.readAloud, 'Neue eigene Prosa');
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
  assert.equal(x.state.scene.readAloud, 'Bisheriger Text');
  assert.equal(x.dialog.open, true);
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
  assert.equal(x.state.scene.readAloud, '  Vorgelesen\r\n- Mantel');
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
  assert.equal(x.state.scene.readAloud, raw);
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

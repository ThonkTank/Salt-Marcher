import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {sceneEncounterParty,assessSceneGroups} from './src/app/runtime/scene-encounter-selection';export {groupCombatBasis} from './src/app/campaign/groups-contracts';export {CombatSelectionPanel} from './src/app/runtime/combat-selection-ui';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/scene-encounter-selection-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  sceneEncounterParty,
  assessSceneGroups,
  groupCombatBasis,
  CombatSelectionPanel,
} = createRequire(import.meta.url)('../../.build/scene-encounter-selection-test.cjs');
const tick = () => new Promise((r) => setImmediate(r));
async function until(check) {
  for (let n = 0; n < 300; n++) {
    if (check()) return;
    await tick();
  }
  assert(check(), 'Expected selection state');
}
function fixture(t) {
  const dir = mkdtempSync(tmpdir() + '/scene-encounter-selection-'),
    file = dir + '/store.sqlite',
    x = { dir, file, store: new CampaignStore(file) };
  x.cam = x.store.create('Zwei Gruppen am Tor');
  x.w = x.store.activate(x.cam.id);
  x.cmd = (action) => ({ commandId: randomUUID(), campaignId: x.cam.id, token: x.w.token, action });
  x.heroes = ['Ada', 'Borin', 'Cora', 'Inaktiv'].map(
    (name) => x.store.executeLive(x.cmd({ kind: 'create-character', profile: { name } })).character,
  );
  let live = x.store.live(x.w.token);
  x.store.executeLive(x.cmd({ kind: 'initialize', expectedRosterRevision: live.rosterRevision }));
  for (const hero of x.heroes.slice(0, 3)) {
    live = x.store.live(x.w.token);
    const c = live.roster.find((c) => c.id === hero.id);
    x.store.executeLive(
      x.cmd({
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
  for (const hero of x.heroes) {
    const p = x.store.progress(x.w.token).characters.find((p) => p.characterId === hero.id);
    x.store.executeProgress(
      x.cmd({
        kind: 'xp',
        characterId: hero.id,
        expectedRevision: p.revision,
        mode: 'set',
        amount: hero === x.heroes[3] ? 355000 : 900,
        reason: 'Start',
      }),
    );
  }
  x.planId = randomUUID();
  const visitId = randomUUID();
  x.store.changePreparation({
    ...x.cmd(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id: x.planId,
        revision: 1,
        name: 'Tor',
        scenes: [{ id: visitId, title: 'Torkampf', notes: '', locationId: null }],
      },
    },
  });
  let visitRevision = 0;
  for (const [name, creature, count] of [
    ['Goblintrupp', 'goblin', 2],
    ['Torwache', 'guard', 1],
  ]) {
    const p = x.store.saveEncounterPlan({
      ...x.cmd(null),
      expectedRevision: null,
      plan: {
        id: randomUUID(),
        revision: 0,
        name,
        notes: '  Eigene Notizen\r\n' + name,
        party: [],
        entries: [{ id: randomUUID(), creatureId: creature, count, grouped: true }],
        sources: [],
        catalogHash: '',
      },
    });
    const s = x.store.executeSession(
      x.cmd({
        kind: 'attach',
        planId: x.planId,
        visitId,
        expectedVisitRevision: visitRevision,
        encounterId: p.id,
        expectedEncounterRevision: p.revision,
      }),
    );
    visitRevision = s.visits[0].revision;
  }
  live = x.store.live(x.w.token);
  x.scene = x.store.executeLive(
    x.cmd({
      kind: 'apply-visit',
      sceneId: live.scene.id,
      expectedRevision: live.scene.revision,
      planId: x.planId,
      visitId,
      expectedPlanRevision: 1,
      expectedVisitRevision: visitRevision,
    }),
  ).scene;
  x.groups = () =>
    x.store
      .scenePreparation(x.w.token, x.scene.id)
      .groups.map((g) => x.store.groupView(x.w.token, g.id));
  x.action = (groups = x.groups()) => {
    const live = x.store.live(x.w.token),
      party = sceneEncounterParty(live, x.store.progress(x.w.token).characters, x.scene.id);
    return {
      kind: 'create',
      sceneId: x.scene.id,
      title: 'Hinterhalt am Tor',
      includeParty: true,
      expectedMembershipRevision: live.scene.membershipRevision,
      sceneSelection: {
        expectedFocusRevision: live.focusRevision,
        expectedRosterRevision: live.rosterRevision,
        partyBasis: party.basis,
        groups: groups.map((g) => ({ id: g.id, revision: g.revision, basis: groupCombatBasis(g) })),
      },
    };
  };
  x.create = (action) =>
    x.store.executeCombat({
      ...x.cmd(action ?? x.action()),
      combatId: null,
      expectedRevision: null,
    });
  t.after(() => {
    x.store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return x;
}
test('two Scene groups are assessed without writes then atomically prepared with only assigned PCs and durable provenance', (t) => {
  const x = fixture(t),
    groups = x.groups(),
    live = x.store.live(x.w.token),
    party = sceneEncounterParty(live, x.store.progress(x.w.token).characters, x.scene.id),
    before = x.store.db.serialize(),
    evaluation = assessSceneGroups(party.party, groups, null);
  assert.equal(evaluation.issue, null);
  assert.equal(evaluation.assessment.count, 3);
  assert.equal(evaluation.assessment.partySize, 3);
  assert.equal(evaluation.assessment.baseXp, 125);
  assert.equal(evaluation.assessment.adjustedXp, 250);
  assert.equal(evaluation.assessment.difficulty, 'Leicht');
  assert.ok(x.store.db.serialize().equals(before));
  const command = { ...x.cmd(x.action()), combatId: null, expectedRevision: null },
    ack = x.store.executeCombat(command),
    combat = ack.combat;
  assert.equal(combat.phase, 'preparing');
  assert.equal(combat.participants.length, 6);
  assert.deepEqual(
    combat.sceneGroups,
    groups.map((g) => ({ id: g.id, revision: g.revision, name: g.title })),
  );
  assert.deepEqual(ack.assessment, evaluation.assessment);
  assert.deepEqual(x.store.executeCombat(command), ack);
  assert.deepEqual(x.groups(), groups);
  assert.deepEqual(
    combat.participants
      .filter((p) => p.worldActorId)
      .map((p) => p.worldActorId)
      .sort(),
    groups.flatMap((g) => g.actors.map((a) => a.id)).sort(),
  );
  assert(!combat.participants.some((p) => p.characterId === x.heroes[3].id));
  x.store.close();
  x.store = new CampaignStore(x.file);
  x.w = x.store.activate(x.cam.id);
  assert.deepEqual(x.store.combat(x.w.token, x.scene.id, combat.id).combat, combat);
});
test('stale group facts, changed Party XP, foreign groups and an empty selection do not leave partial Combat or receipts', (t) => {
  const x = fixture(t),
    old = x.action(),
    g = x.groups()[1],
    npc = x.store.npc(x.w.token, g.actors[0].id);
  x.store.executeNpc({
    ...x.cmd(null),
    expectedNoteRevision: npc.noteRevision,
    expectedRecordRevision: npc.record.revision,
    expectedActorRevision: npc.actorRevision,
    expectedPositionRevision: npc.positionRevision,
    npc: { ...npc, health: { ...npc.health, hp: 2 } },
  });
  let before = x.store.db.serialize();
  assert.throws(() => x.create(old), /seit Bewertung geändert/);
  assert.ok(x.store.db.serialize().equals(before));
  const xpOld = x.action(),
    p = x.store.progress(x.w.token).characters.find((p) => p.characterId === x.heroes[0].id);
  x.store.executeProgress(
    x.cmd({
      kind: 'xp',
      characterId: p.characterId,
      expectedRevision: p.revision,
      mode: 'add',
      amount: 1,
      reason: 'Nach Vorschau',
    }),
  );
  before = x.store.db.serialize();
  assert.throws(() => x.create(xpOld), /Party oder XP/);
  assert.ok(x.store.db.serialize().equals(before));
  const foreign = x.store.executeProgress(
    x.cmd({
      kind: 'group-create',
      title: 'Fremde Gruppe',
      encounterId: null,
      expectedEncounterRevision: null,
    }),
  ).groupId;
  before = x.store.db.serialize();
  assert.throws(
    () => x.create(x.action([x.store.groupView(x.w.token, foreign)])),
    /nicht zum fokussierten/,
  );
  assert.ok(x.store.db.serialize().equals(before));
  assert.throws(() => x.create(x.action([])), /Szenengruppen auswählen/);
  assert.ok(x.store.db.serialize().equals(before));
});
test('selection UI updates difficulty immediately and submits a complete group snapshot, without persistence during checkbox changes', async (t) => {
  const x = fixture(t),
    old = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML('<html><body><section id="root"></section></body></html>');
  Object.assign(globalThis, { window, document });
  const response = (fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  window.campaign = {};
  for (const name of [
    'live',
    'progress',
    'scenePreparation',
    'groupView',
    'sceneEncounterSelection',
  ])
    window.campaign[name] = async (...args) => response(() => x.store[name](...args));
  let action;
  const panel = new CombatSelectionPanel(
    document.getElementById('root'),
    () => ({ workspace: x.w, scene: x.scene, current: () => true }),
    async (a) => {
      action = a;
      return true;
    },
    () => false,
  );
  t.after(() => {
    panel.reset();
    Object.assign(globalThis, old);
  });
  await panel.read();
  const before = x.store.db.serialize(),
    boxes = [...document.querySelectorAll('#combat-selection-groups > article > label > input')];
  assert.equal(boxes.length, 2);
  assert.equal(document.getElementById('combat-selection-prepare').disabled, true);
  boxes[0].checked = true;
  boxes[0].onchange();
  assert.equal(document.getElementById('combat-selection-prepare').disabled, false);
  const first = document.getElementById('combat-selection-result').textContent;
  boxes[1].checked = true;
  boxes[1].onchange();
  assert.notEqual(document.getElementById('combat-selection-result').textContent, first);
  assert.match(document.getElementById('combat-selection-result').textContent, /250 angepasste XP/);
  assert.ok(x.store.db.serialize().equals(before));
  document.getElementById('combat-selection-prepare').click();
  await until(() => !!action);
  assert.equal(action.sceneSelection.groups.length, 2);
  assert.equal(action.sceneSelection.partyBasis, x.action().sceneSelection.partyBasis);
});
test('late selection replies after a Scene switch cannot publish or enable initiative', async (t) => {
  const x = fixture(t),
    old = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML('<html><body><section id="root"></section></body></html>');
  Object.assign(globalThis, { window, document });
  let release;
  window.campaign = { sceneEncounterSelection: () => new Promise((r) => (release = r)) };
  let current = true,
    writes = 0;
  const panel = new CombatSelectionPanel(
    document.getElementById('root'),
    () => ({ workspace: x.w, scene: x.scene, current: () => current }),
    async () => {
      writes++;
      return true;
    },
    () => false,
  );
  t.after(() => {
    panel.reset();
    Object.assign(globalThis, old);
  });
  const task = panel.read();
  current = false;
  panel.reset();
  release({ ok: true, value: x.store.sceneEncounterSelection(x.w.token, x.scene.id) });
  await task;
  assert.equal(document.querySelectorAll('#combat-selection-groups input').length, 0);
  assert.equal(document.getElementById('combat-selection-prepare').disabled, true);
  assert.equal(writes, 0);
});

function selectionUi(t, x, commit = async () => true) {
  const old = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML('<html><body><section id="root"></section></body></html>');
  Object.assign(globalThis, { window, document });
  const response = (fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  window.campaign = {};
  for (const name of [
    'live',
    'progress',
    'scenePreparation',
    'groupView',
    'sceneEncounterSelection',
  ])
    window.campaign[name] = async (...args) => response(() => x.store[name](...args));
  const panel = new CombatSelectionPanel(
    document.getElementById('root'),
    () => ({ workspace: x.w, scene: x.scene, current: () => true }),
    commit,
    () => false,
  );
  t.after(() => {
    panel.reset();
    Object.assign(globalThis, old);
  });
  return { panel, document };
}
test('a first wave selects individual physical actors in the encounter entry and keeps that selection on refresh', async (t) => {
  const x = fixture(t);
  let submitted;
  const ui = selectionUi(t, x, async (a) => {
    submitted = a;
    return true;
  });
  await ui.panel.read();
  const before = x.store.db.serialize(),
    group = x.groups().find((g) => g.actors.length === 2),
    withheld = group.actors[0].id;
  const select = ui.document.querySelector(`[data-group-id="${group.id}"] > label > input`);
  select.checked = true;
  select.onchange();
  const actor = ui.document.querySelector(`[data-actor-id="${withheld}"]`);
  actor.checked = false;
  actor.onchange();
  assert.match(
    ui.document.getElementById('combat-selection-result').textContent,
    /1 Gegner · 50 Basis-XP/,
  );
  assert.equal(select.indeterminate, true);
  assert.ok(x.store.db.serialize().equals(before));
  await ui.panel.read();
  assert.equal(ui.document.querySelector(`[data-actor-id="${withheld}"]`).checked, false);
  ui.document.getElementById('combat-selection-prepare').click();
  await until(() => !!submitted);
  assert.deepEqual(submitted.sceneSelection.groups.find((g) => g.id === group.id).worldActorIds, [
    group.actors[1].id,
  ]);
  assert.equal(
    submitted.sceneSelection.groups.find((g) => g.id === group.id).basis,
    groupCombatBasis(group),
  );
});
test('partial first waves are atomic and durable, with the withheld actor available for later reinforcement', (t) => {
  const x = fixture(t),
    groups = x.groups(),
    action = x.action(),
    first = groups.find((g) => g.actors.length === 2);
  action.sceneSelection.groups.find((g) => g.id === first.id).worldActorIds = [first.actors[1].id];
  const command = { ...x.cmd(action), combatId: null, expectedRevision: null },
    ack = x.store.executeCombat(command);
  let combat = ack.combat;
  assert.equal(ack.assessment.baseXp, 75);
  assert.equal(combat.participants.length, 5);
  assert(!combat.participants.some((p) => p.worldActorId === first.actors[0].id));
  assert.deepEqual(x.groups(), groups);
  assert.deepEqual(x.store.executeCombat(command), ack);
  x.store.close();
  x.store = new CampaignStore(x.file);
  x.w = x.store.activate(x.cam.id);
  assert.deepEqual(x.store.combat(x.w.token, x.scene.id, combat.id).combat, combat);
  const g = x.groups().find((g) => g.id === first.id),
    added = x.store.executeCombat({
      ...x.cmd({
        kind: 'add-prepared-group',
        preparedGroupId: g.id,
        expectedPreparedRevision: g.revision,
        expectedRosterBasis: groupCombatBasis(g),
        worldActorIds: [g.actors[0].id],
        initiative: 10,
      }),
      combatId: combat.id,
      expectedRevision: combat.revision,
    });
  assert.equal(added.combat.participants.length, 6);
  assert.equal(
    added.combat.participants.find((p) => p.worldActorId === g.actors[0].id).initiative,
    10,
  );
  assert.deepEqual(
    added.combat.participants.filter((p) => p.worldActorId !== g.actors[0].id),
    combat.participants,
  );
});
test('invalid first-wave actor IDs and stale full-group facts reject without partial writes', (t) => {
  const x = fixture(t),
    groups = x.groups(),
    group = groups.find((g) => g.actors.length === 2),
    other = groups.find((g) => g.id !== group.id);
  for (const ids of [[], [group.actors[0].id, group.actors[0].id], [other.actors[0].id]]) {
    const a = x.action();
    a.sceneSelection.groups.find((g) => g.id === group.id).worldActorIds = ids;
    const before = x.store.db.serialize();
    assert.throws(() => x.create(a), /eindeutige kampffähige/);
    assert.ok(x.store.db.serialize().equals(before));
  }
  const a = x.action();
  a.sceneSelection.groups.find((g) => g.id === group.id).worldActorIds = [group.actors[1].id];
  const npc = x.store.npc(x.w.token, group.actors[0].id);
  x.store.executeNpc({
    ...x.cmd(null),
    expectedNoteRevision: npc.noteRevision,
    expectedRecordRevision: npc.record.revision,
    expectedActorRevision: npc.actorRevision,
    expectedPositionRevision: npc.positionRevision,
    npc: { ...npc, health: { ...npc.health, hp: 2 } },
  });
  const before = x.store.db.serialize();
  assert.throws(() => x.create(a), /seit Bewertung geändert/);
  assert.ok(x.store.db.serialize().equals(before));
});
test('an empty wave cannot prepare and restoring one member immediately restores the live preview', async (t) => {
  const x = fixture(t),
    ui = selectionUi(t, x);
  await ui.panel.read();
  const group = x.groups().find((g) => g.actors.length === 2),
    select = ui.document.querySelector(`[data-group-id="${group.id}"] > label > input`);
  select.checked = true;
  select.onchange();
  const actors = [...ui.document.querySelectorAll(`[data-owner-group-id="${group.id}"]`)];
  for (const box of actors) {
    box.checked = false;
    box.onchange();
  }
  assert.equal(ui.document.getElementById('combat-selection-prepare').disabled, true);
  actors[0].checked = true;
  actors[0].onchange();
  assert.equal(ui.document.getElementById('combat-selection-prepare').disabled, false);
  assert.match(
    ui.document.getElementById('combat-selection-result').textContent,
    /1 Gegner · 50 Basis-XP/,
  );
});

test('an unrelated inactive progress record cannot block the focused Scene encounter selection', async (t) => {
  const x = fixture(t),
    command = x.action(),
    ui = selectionUi(t, x);
  x.store.db
    .prepare('UPDATE character_progress SET checksum=? WHERE campaign_id=? AND id=?')
    .run('damaged-inactive', x.cam.id, x.heroes[3].id);
  const before = x.store.db.serialize();
  await ui.panel.read();
  assert.equal(
    ui.document.querySelectorAll('#combat-selection-groups > article > label > input').length,
    2,
    'only the assigned Party progress belongs to this read',
  );
  assert.match(
    ui.document.getElementById('combat-selection-party').textContent,
    /Ada.*Borin.*Cora/,
  );
  assert.ok(x.store.db.serialize().equals(before));
  // The existing command already reads only assigned progress; the preview must agree.
  assert.equal(x.create(command).combat.phase, 'preparing');
});

test('selection uses one compact read basis, with the unchanged command preconditions and no extra reads on checkbox edits', async (t) => {
  const x = fixture(t),
    before = x.store.db.serialize(),
    value = x.store.sceneEncounterSelection(x.w.token, x.scene.id),
    old = x.action();
  assert.equal(value.sceneId, x.scene.id);
  assert.equal(value.membershipRevision, x.scene.membershipRevision);
  assert.equal(value.partyBasis, old.sceneSelection.partyBasis);
  assert.equal(value.focusRevision, old.sceneSelection.expectedFocusRevision);
  assert.equal(value.rosterRevision, old.sceneSelection.expectedRosterRevision);
  assert.deepEqual(
    value.groups.map((g) => ({ id: g.id, revision: g.revision, basis: g.basis })),
    old.sceneSelection.groups,
  );
  assert.equal(value.party.length, 3);
  assert.equal(JSON.stringify(value).includes('Eigene Notizen'), false);
  assert.ok(
    value.groups.every(
      (g) =>
        !('notes' in g) &&
        g.plan.sources.every((s) => Object.keys(s).sort().join(',') === 'id,xp') &&
        g.actors.every((a) => !('gmNotes' in a) && !('readAloud' in a)),
    ),
  );
  assert.ok(x.store.db.serialize().equals(before));
  const ui = selectionUi(t, x);
  let reads = 0;
  window.campaign.sceneEncounterSelection = async () => {
    reads++;
    return { ok: true, value };
  };
  for (const name of ['live', 'progress', 'scenePreparation', 'groupView'])
    window.campaign[name] = async () => {
      throw Error('Unneeded ' + name);
    };
  await ui.panel.read();
  assert.equal(reads, 1);
  const boxes = [
    ...ui.document.querySelectorAll('#combat-selection-groups > article > label > input'),
  ];
  for (const box of boxes) {
    box.checked = true;
    box.onchange();
  }
  assert.equal(reads, 1);
  assert.match(
    ui.document.getElementById('combat-selection-result').textContent,
    /250 angepasste XP/,
  );
});

test('a damaged unrelated treasure does not block group selection or its existing combat command', async (t) => {
  const x = fixture(t),
    old = x.action(),
    id = x.store.executeProgress(
      x.cmd({
        kind: 'treasure',
        title: 'Unabhängiger Fund',
        sceneId: null,
        items: [{ name: 'Seil', category: 'equipment', quantity: 1, valueGold: '1' }],
      }),
    ).treasureId;
  x.store.db
    .prepare('UPDATE treasure SET checksum=? WHERE campaign_id=? AND id=?')
    .run('damaged-unrelated', x.cam.id, id);
  assert.throws(
    () => x.store.scenePreparation(x.w.token, x.scene.id),
    /nicht verfügbar|beschädigt/,
    'the general source must still report corruption',
  );
  const before = x.store.db.serialize(),
    selection = x.store.sceneEncounterSelection(x.w.token, x.scene.id);
  assert.equal(selection.groups.length, 2);
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(x.create(old).combat.participants.length, 6);
  assert.throws(
    () => x.store.treasure(x.w.token, id),
    /nicht verfügbar|beschädigt/,
    'the damaged record must not be repaired or concealed',
  );
});

test('a needed assigned progress record remains an explicit error, and the same read can recover', async (t) => {
  const x = fixture(t),
    ui = selectionUi(t, x);
  await ui.panel.read();
  const id = x.heroes[0].id,
    row = x.store.db
      .prepare('SELECT checksum FROM character_progress WHERE campaign_id=? AND id=?')
      .get(x.cam.id, id);
  x.store.db
    .prepare('UPDATE character_progress SET checksum=? WHERE campaign_id=? AND id=?')
    .run('damaged-needed', x.cam.id, id);
  await ui.panel.read();
  assert.match(
    ui.document.getElementById('combat-selection-status').textContent,
    /nicht verfügbar|beschädigt/,
  );
  assert.match(ui.document.getElementById('combat-selection-party').textContent, /nicht verfügbar/);
  assert.match(ui.document.getElementById('combat-selection-groups').textContent, /nicht geladen/);
  assert.equal(ui.document.getElementById('combat-selection-thresholds').textContent, '');
  assert.equal(
    ui.document.getElementById('combat-selection-result').textContent,
    'Bewertung nicht verfügbar.',
  );
  assert.equal(ui.document.getElementById('combat-selection-prepare').disabled, true);
  assert.equal(ui.document.querySelectorAll('#combat-selection-groups > article').length, 0);
  x.store.db
    .prepare('UPDATE character_progress SET checksum=? WHERE campaign_id=? AND id=?')
    .run(row.checksum, x.cam.id, id);
  await ui.panel.read();
  assert.equal(ui.document.querySelectorAll('#combat-selection-groups > article').length, 2);
});

test('a location or membership change cannot publish a response under the old visible Scene context', async (t) => {
  const x = fixture(t),
    value = x.store.sceneEncounterSelection(x.w.token, x.scene.id),
    ui = selectionUi(t, x);
  for (const changed of [
    { ...value, locationId: 'other-place' },
    { ...value, membershipRevision: value.membershipRevision + 1 },
    { ...value, sceneId: 'foreign-scene' },
  ]) {
    window.campaign.sceneEncounterSelection = async () => ({ ok: true, value: changed });
    await ui.panel.read();
    assert.match(
      ui.document.getElementById('combat-selection-status').textContent,
      /Szene geändert/,
    );
    assert.equal(ui.document.getElementById('combat-selection-prepare').disabled, true);
  }
});

test('another active Scene has neither XP authority nor a read dependency for this selection', (t) => {
  const x = fixture(t),
    live = x.store.live(x.w.token);
  x.store.executeLive(
    x.cmd({
      kind: 'move',
      sceneId: x.scene.id,
      expectedRosterRevision: live.rosterRevision,
      expectedFocusRevision: live.focusRevision,
      expectedClockRevision: x.scene.clock.revision,
      expectedSceneMembershipRevision: x.scene.membershipRevision,
      memberIds: [x.heroes[2].id],
      target: { kind: 'new', title: 'Andere Gruppe', expectedContentRevision: x.scene.revision },
    }),
  );
  const split = x.store.live(x.w.token),
    other = split.scenes.find((s) => s.id !== x.scene.id);
  x.store.executeLive(
    x.cmd({ kind: 'focus', sceneId: x.scene.id, expectedRevision: split.focusRevision }),
  );
  x.store.db
    .prepare('UPDATE character_progress SET checksum=? WHERE campaign_id=? AND id=?')
    .run('damaged-other-scene', x.cam.id, x.heroes[2].id);
  const frame = x.store.sceneEncounterSelection(x.w.token, x.scene.id);
  assert.deepEqual(
    frame.party.map((p) => p.name),
    ['Ada', 'Borin'],
  );
  assert.equal(frame.groups.length, 2);
  assert.throws(() => x.store.sceneEncounterSelection(x.w.token, other.id), /Fokussierte Szene/);
  const action = {
    kind: 'create',
    sceneId: frame.sceneId,
    title: 'Am ursprünglichen Tor',
    includeParty: true,
    expectedMembershipRevision: frame.membershipRevision,
    sceneSelection: {
      expectedFocusRevision: frame.focusRevision,
      expectedRosterRevision: frame.rosterRevision,
      partyBasis: frame.partyBasis,
      groups: frame.groups.map((g) => ({ id: g.id, revision: g.revision, basis: g.basis })),
    },
  };
  const combat = x.create(action).combat;
  assert.deepEqual(
    combat.participants.filter((p) => p.characterId).map((p) => p.name),
    ['Ada', 'Borin'],
  );
});

test('an unavailable unselected group remains visible without blocking a healthy group', async (t) => {
  const x = fixture(t),
    groups = x.groups(),
    bad = groups.find((g) => g.actors.length === 1),
    healthy = groups.find((g) => g.id !== bad.id),
    action = x.action([healthy]);
  x.store.db
    .prepare('UPDATE world_note SET checksum=? WHERE campaign_id=? AND id=?')
    .run('damaged-unselected-group', x.cam.id, bad.actors[0].id);
  const before = x.store.db.serialize(),
    frame = x.store.sceneEncounterSelection(x.w.token, x.scene.id);
  assert.deepEqual(
    frame.groups.map((g) => g.id),
    [healthy.id],
  );
  assert.equal(frame.unavailableGroups[0].id, bad.id);
  assert.equal(frame.unavailableGroups[0].title, bad.title);
  assert.match(frame.unavailableGroups[0].problem, /beschädigt/);
  assert.ok(x.store.db.serialize().equals(before));
  const ui = selectionUi(t, x);
  await ui.panel.read();
  assert.match(
    ui.document.getElementById('combat-selection-groups').textContent,
    /Gruppe nicht verfügbar/,
  );
  assert.equal(ui.document.querySelectorAll('[data-unavailable-group-id]').length, 1);
  const box = ui.document.querySelector('#combat-selection-groups > article > label > input');
  box.checked = true;
  box.onchange();
  assert.equal(ui.document.getElementById('combat-selection-prepare').disabled, false);
  assert.equal(x.create(action).combat.participants.length, 5);
  x.store.db
    .prepare('UPDATE world_note SET checksum=? WHERE campaign_id=? AND id=?')
    .run('damaged-second-group', x.cam.id, healthy.actors[0].id);
  await ui.panel.read();
  assert.equal(ui.document.querySelectorAll('[data-unavailable-group-id]').length, 2);
  assert.doesNotMatch(
    ui.document.getElementById('combat-selection-groups').textContent,
    /Keine Gruppen/,
  );
  assert.match(ui.document.getElementById('combat-selection-party').textContent, /Ada/);
  assert.equal(ui.document.getElementById('combat-selection-prepare').disabled, true);
  x.store.db
    .prepare('UPDATE prepared_group SET checksum=? WHERE campaign_id=? AND id=?')
    .run('damaged-header', x.cam.id, bad.id);
  assert.equal(
    x.store
      .sceneEncounterSelection(x.w.token, x.scene.id)
      .unavailableGroups.find((g) => g.id === bad.id).title,
    undefined,
    'a corrupt header cannot supply a trusted display name',
  );
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {groupCombatBasis} from './src/app/campaign/groups-contracts';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/combat-group-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, groupCombatBasis } = createRequire(import.meta.url)(
  '../../.build/combat-group-store.cjs',
);
function fixture(t) {
  const root = mkdtempSync(tmpdir() + '/combat-group-'),
    file = root + '/workbench.sqlite',
    x = { root, file, store: new CampaignStore(file) };
  x.cam = x.store.create('Verstärkung am Nordtor');
  x.w = x.store.activate(x.cam.id);
  x.command = (action) => ({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    action,
  });
  const planId = randomUUID(),
    visitId = randomUUID();
  x.planId = planId;
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id: planId,
        revision: 1,
        name: 'Torwache',
        scenes: [{ id: visitId, title: 'Nordtor', notes: '', locationId: null }],
      },
    },
  });
  const source = x.store.saveEncounterPlan({
    ...x.command(null),
    expectedRevision: null,
    plan: {
      id: randomUUID(),
      revision: 0,
      name: 'Goblintrupp',
      notes: '  Originale Gruppennotizen\r\n',
      party: [],
      entries: [{ id: randomUUID(), creatureId: 'goblin', count: 8, grouped: true }],
      sources: [],
      catalogHash: '',
    },
  });
  const prep = x.store.executeSession(
      x.command({
        kind: 'attach',
        planId,
        visitId,
        expectedVisitRevision: 0,
        encounterId: source.id,
        expectedEncounterRevision: 1,
      }),
    ),
    visit = prep.visits[0];
  let scene = x.store.executeLive(
    x.command({ kind: 'initialize', expectedRosterRevision: 0 }),
  ).scene;
  x.scene = x.store.executeLive(
    x.command({
      kind: 'apply-visit',
      sceneId: scene.id,
      expectedRevision: scene.revision,
      planId,
      visitId,
      expectedPlanRevision: 1,
      expectedVisitRevision: visit.revision,
    }),
  ).scene;
  x.group = x.store.scenePreparation(x.w.token, x.scene.id).groups[0];
  for (const [i, actor] of x.group.actors.entries()) {
    const old = x.store.npc(x.w.token, actor.id);
    x.store.executeNpc({
      ...x.command(null),
      expectedNoteRevision: old.noteRevision,
      expectedRecordRevision: old.record.revision,
      expectedActorRevision: old.actorRevision,
      expectedPositionRevision: old.positionRevision,
      npc: { ...old, record: { ...old.record, modifier: i === 7 ? 0 : i === 6 ? 10 : -10 } },
    });
  }
  x.group = x.store.groupView(x.w.token, x.group.id);
  x.combat = x.store.executeCombat({
    ...x.command({
      kind: 'create',
      sceneId: x.scene.id,
      title: 'Hinterhalt läuft',
      includeParty: false,
      expectedMembershipRevision: x.scene.membershipRevision,
    }),
    combatId: null,
    expectedRevision: null,
  }).combat;
  x.execute = (action) => {
    x.combat = x.store.executeCombat({
      ...x.command(action),
      combatId: x.combat.id,
      expectedRevision: x.combat.revision,
    }).combat;
    return x.combat;
  };
  x.execute({
    kind: 'add-creature',
    creatureId: 'guard',
    count: 1,
    grouped: false,
    initiative: 18,
  });
  x.execute({ kind: 'start' });
  x.action = (ids = x.group.actors.filter((a) => a.role !== 'neutral').map((a) => a.id)) => {
    const group = x.store.groupView(x.w.token, x.group.id);
    return {
      kind: 'add-prepared-group',
      preparedGroupId: group.id,
      expectedPreparedRevision: group.revision,
      expectedRosterBasis: groupCombatBasis(group),
      worldActorIds: ids,
      initiative: 11,
    };
  };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return x;
}
test('a physical scene group reinforces the running encounter with stable identities, roles, HP and fixed mob partition', async (t) => {
  const x = fixture(t),
    before = structuredClone(x.combat),
    actors = x.group.actors.filter((a) => a.role !== 'neutral'),
    command = {
      ...x.command(x.action()),
      combatId: x.combat.id,
      expectedRevision: x.combat.revision,
    };
  const accepted = x.store.executeCombat(command);
  x.combat = accepted.combat;
  const added = x.combat.participants.slice(1);
  assert.equal(added.length, 7);
  assert.equal(new Set(added.map((p) => p.groupId)).size, 1);
  assert.ok(
    added.every(
      (p) =>
        p.partitionKind === 'mob' &&
        p.initiative === 11 &&
        p.sourceEntryId === x.group.plan.entries[0].id,
    ),
  );
  assert.deepEqual(x.combat.participants[0], before.participants[0]);
  assert.equal(x.combat.round, before.round);
  assert.equal(x.combat.turnId, before.turnId);
  assert.equal(added.filter((p) => p.role === 'friendly').length, 1);
  assert.equal(accepted.assessment.baseXp, 6 * 50 + 25);
  for (const actor of actors) {
    const p = added.find((p) => p.worldActorId === actor.id);
    assert.equal(p.hp, actor.hp);
    assert.equal(p.maxHp, actor.maxHp);
    assert.equal(p.worldActorRevision, actor.revision);
  }
  assert.deepEqual(x.store.executeCombat(command), accepted);
  x.execute(x.action());
  assert.equal(x.combat.participants.length, 8);
  const goblin = x.combat.participants.find((p) => p.worldActorId === actors[0].id);
  x.execute({ kind: 'damage', participantId: goblin.id, amount: 7 });
  assert.equal(x.store.npc(x.w.token, actors[0].id).health.hp, 0);
  const state = structuredClone(x.combat);
  x.store.close();
  x.store = new CampaignStore(x.file);
  x.w = x.store.activate(x.cam.id);
  assert.deepEqual(x.store.combat(x.w.token, x.scene.id, state.id).combat, state);
  assert.equal(x.store.groupView(x.w.token, x.group.id).actors[0].hp, 0);
  await x.store.backup(rootFile(x, 'safe.sqlite'));
});
const rootFile = (x, name) => x.root + '/' + name;
test('later group members join the existing partition without resetting its initiative or reviving its dead members', (t) => {
  const x = fixture(t),
    actors = x.group.actors.filter((a) => a.role !== 'neutral'),
    first = actors.slice(0, 6).map((a) => a.id);
  x.execute(x.action(first));
  let peer = x.combat.participants.find((p) => p.worldActorId === first[0]);
  x.execute({ kind: 'edit', participantId: peer.id, changes: { initiative: 17 } });
  x.execute({ kind: 'damage', participantId: peer.id, amount: 7 });
  const before = structuredClone(x.combat),
    groupId = peer.groupId;
  x.execute(x.action([actors[6].id]));
  const addition = x.combat.participants.at(-1);
  assert.equal(addition.groupId, groupId);
  assert.equal(addition.initiative, 17);
  assert.equal(addition.partitionKind, 'mob');
  assert.deepEqual(x.combat.participants.slice(0, -1), before.participants);
  assert.equal(x.combat.turnId, before.turnId);
  x.execute({ kind: 'undo' });
  assert.deepEqual(x.combat.participants, before.participants);
});
test('stale preview, neutral member and a foreign scene cannot mutate a running encounter', (t) => {
  const x = fixture(t),
    stale = x.action(),
    npc = x.store.npc(x.w.token, x.group.actors[0].id);
  x.store.executeNpc({
    ...x.command(null),
    expectedNoteRevision: npc.noteRevision,
    expectedRecordRevision: npc.record.revision,
    expectedActorRevision: npc.actorRevision,
    expectedPositionRevision: npc.positionRevision,
    npc: { ...npc, health: { ...npc.health, hp: 3 } },
  });
  const bytes = x.store.db.serialize();
  assert.throws(() => x.execute(stale), /seit Vorschau geändert/);
  assert.ok(x.store.db.serialize().equals(bytes));
  assert.throws(() => x.execute(x.action([x.group.actors[7].id])), /neutral/);
  assert.ok(x.store.db.serialize().equals(bytes));
  const group = x.store.groupView(x.w.token, x.group.id);
  const other = x.store.executeProgress(
      x.command({
        kind: 'group-create',
        title: 'Andere Gruppe',
        encounterId: null,
        expectedEncounterRevision: null,
      }),
    ).groupId,
    foreign = x.store.groupView(x.w.token, other),
    before = x.store.db.serialize();
  assert.throws(
    () =>
      x.execute({
        ...x.action(),
        preparedGroupId: other,
        expectedPreparedRevision: foreign.revision,
        expectedRosterBasis: groupCombatBasis(foreign),
        worldActorIds: [group.actors[0].id],
      }),
    /Szenenort|Besuch/,
  );
  assert.ok(x.store.db.serialize().equals(before));
});

test('a group first prepared through the existing Scene path retains an absent troop name and hidden mob when reinforced', (t) => {
  const x = fixture(t),
    ids = x.group.actors.slice(0, 6).map((a) => a.id);
  x.store.executeSession(
    x.command({
      kind: 'group-content',
      planId: x.planId,
      groupId: x.group.id,
      expectedRevision: x.group.revision,
      title: '  ' + 'Lange Autorenbezeichnung '.repeat(9) + '  ',
      notes: x.group.notes,
    }),
  );
  x.group = x.store.groupView(x.w.token, x.group.id);
  x.combat = x.store.executeCombat({
    ...x.command({
      kind: 'create',
      sceneId: x.scene.id,
      title: 'Ursprünglich vorbereitete Gruppe',
      includeParty: false,
      expectedMembershipRevision: x.scene.membershipRevision,
      preparedGroupId: x.group.id,
      expectedPreparedRevision: x.group.revision,
      worldActorIds: ids,
    }),
    combatId: null,
    expectedRevision: null,
  }).combat;
  assert.ok(x.combat.participants.every((p) => p.groupName === undefined));
  const first = x.combat.participants[0];
  x.execute({
    kind: 'edit',
    participantId: first.id,
    changes: { initiative: 13, initiativeBonus: 4 },
  });
  x.execute({ kind: 'visibility', participantId: first.id, hidden: true });
  x.execute({ kind: 'start' });
  const before = structuredClone(x.combat);
  x.execute(x.action([x.group.actors[6].id]));
  const added = x.combat.participants.at(-1);
  assert.equal(added.groupName, undefined);
  assert.equal(added.groupId, first.groupId);
  assert.equal(added.initiative, 13);
  assert.equal(added.initiativeBonus, 4);
  assert.equal(added.hiddenFromPlayers, true);
  assert.deepEqual(x.combat.participants.slice(0, -1), before.participants);
});

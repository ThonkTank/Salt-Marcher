import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/plan-replacement-world.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/plan-replacement-world.cjs');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'replacement-world-')),
    filename = path.join(root, 'store.sqlite'),
    x = { root, filename, store: new CampaignStore(filename) };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  x.cam = x.store.create('Worldinhalt');
  x.w = x.store.activate(x.cam.id);
  x.command = (action) => ({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    action,
  });
  x.create = (name, count) => {
    const plan = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      name,
      scenes: Array.from({ length: count }, () => ({
        id: randomUUID(),
        title: name,
        notes: '',
        locationId: null,
      })),
    };
    x.store.changePreparation({
      ...x.command(null),
      change: { kind: 'plan', plan, expectedRevision: null },
    });
    return plan;
  };
  x.source = x.create('Vorlage', 2);
  x.target = x.create('Ziel', 1);
  x.template = x.store.saveEncounterPlan({
    ...x.command(null),
    expectedRevision: null,
    plan: {
      id: randomUUID(),
      revision: 0,
      name: 'Wachen',
      notes: 'Vorlagentext',
      party: [],
      entries: [{ id: randomUUID(), creatureId: 'goblin', count: 2, grouped: false }],
      sources: [],
      catalogHash: '',
    },
  });
  x.attach = (index) =>
    x.store
      .executeSession(
        x.command({
          kind: 'attach',
          planId: x.source.id,
          visitId: x.source.scenes[index].id,
          expectedVisitRevision: x.store.session(x.w.token, x.source.id).visits[index].revision,
          encounterId: x.template.id,
          expectedEncounterRevision: x.template.revision,
        }),
      )
      .groups.at(-1);
  x.replaceCommand = () =>
    x.command({
      kind: 'replace-plan',
      planId: x.target.id,
      expectedBasis: x.store.session(x.w.token, x.target.id).replacementBasis,
      name: 'Kopie',
      sourcePlanId: x.source.id,
      expectedSourceBasis: x.store.session(x.w.token, x.source.id).replacementBasis,
      copyParty: false,
    });
  x.clear = (planId) =>
    x.store.executeSession(
      x.command({
        kind: 'replace-plan',
        planId,
        expectedBasis: x.store.session(x.w.token, planId).replacementBasis,
        name: '',
        sourcePlanId: null,
        expectedSourceBasis: null,
        copyParty: false,
      }),
    );
  x.reopen = () => {
    x.store.close();
    x.store = new CampaignStore(filename);
    x.w = x.store.activate(x.cam.id);
  };
  return x;
}
test('timeline replacement keeps accepted World NPC identities and copies remaining drafts independently', async (t) => {
  const x = fixture(t),
    accepted = x.attach(0),
    draft = x.attach(1),
    scene = x.store.executeLive(x.command({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
  x.store.executeLive(
    x.command({
      kind: 'apply-visit',
      planId: x.source.id,
      expectedPlanRevision: 1,
      visitId: x.source.scenes[0].id,
      expectedVisitRevision: 1,
      sceneId: scene.id,
      expectedRevision: scene.revision,
    }),
  );
  const world = x.store.scenePreparation(x.w.token, scene.id).groups[0],
    before = x.store.db.prepare('SELECT payload FROM world_actor ORDER BY id').all(),
    command = x.replaceCommand(),
    copy = x.store.executeSession(command);
  assert.equal(copy.visits[0].groupIds[0], world.id);
  const copiedDraft = copy.groups.find((g) => g.id !== world.id);
  assert.notEqual(copiedDraft.id, draft.id);
  assert.equal(copiedDraft.notes, draft.notes);
  x.store.executeSession(
    x.command({
      kind: 'group-content',
      planId: x.source.id,
      groupId: draft.id,
      expectedRevision: draft.revision,
      title: 'Andere Wachen',
      notes: 'Geändert',
    }),
  );
  assert.equal(
    x.store.session(x.w.token, x.target.id).groups.find((g) => g.id === copiedDraft.id).notes,
    draft.notes,
  );
  x.store.executeSession(command);
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM world_actor').get().n, 2);
  x.clear(x.target.id);
  x.clear(x.source.id);
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM prepared_group').get().n, 1);
  assert.deepEqual(x.store.db.prepare('SELECT payload FROM world_actor ORDER BY id').all(), before);
  x.reopen();
  const livePreparation = x.store.scenePreparation(x.w.token, scene.id);
  assert.deepEqual(livePreparation.groups, [world]);
  assert.deepEqual(livePreparation.noteIds, []);
  assert.equal(livePreparation.nextVisit, null);
  await x.store.backup(path.join(x.root, 'safe.sqlite'));
});
test('awarded rewards remain historical and unawarded copies are independently awardable', async (t) => {
  const x = fixture(t),
    character = x.store.executeLive(
      x.command({ kind: 'create-character', profile: { name: 'Iri' } }),
    ).character;
  for (let i = 0; i < 2; i++) {
    const detail = x.store.session(x.w.token, x.source.id).visits[i];
    x.store.executeSession(
      x.command({
        kind: 'visit',
        planId: x.source.id,
        expectedRevision: detail.revision,
        detail: {
          ...detail,
          reward: {
            id: randomUUID(),
            poolXp: 12,
            items: [{ name: 'Schlüssel', quantity: 1, valueGold: '2', category: 'equipment' }],
            placedTreasureId: null,
            awarded: false,
          },
        },
      }),
    );
  }
  const award = (planId, detail) =>
    x.store.executeSession(
      x.command({
        kind: 'award-reward',
        planId,
        visitId: detail.visitId,
        expectedVisitRevision: detail.revision,
        noXp: false,
        recipients: [
          {
            characterId: character.id,
            revision: x.store.progress(x.w.token).characters[0].revision,
          },
        ],
      }),
    );
  award(x.source.id, x.store.session(x.w.token, x.source.id).visits[0]);
  const source = x.store.session(x.w.token, x.source.id),
    copy = x.store.executeSession(x.replaceCommand());
  assert.deepEqual(copy.visits[0].reward, source.visits[0].reward);
  assert.notEqual(copy.visits[1].reward.id, source.visits[1].reward.id);
  assert.throws(() => award(x.target.id, copy.visits[0]), /bereits vergeben/);
  assert.equal(x.store.progress(x.w.token).characters[0].xp, 12);
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM treasure').get().n, 1);
  award(x.target.id, copy.visits[1]);
  assert.equal(x.store.progress(x.w.token).characters[0].xp, 24);
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM treasure').get().n, 2);
  assert.equal(x.store.session(x.w.token, x.source.id).visits[1].reward.awarded, false);
  x.clear(x.target.id);
  x.clear(x.source.id);
  x.reopen();
  assert.equal(x.store.progress(x.w.token).characters[0].xp, 24);
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM treasure').get().n, 2);
  await x.store.backup(path.join(x.root, 'safe.sqlite'));
});
test('replacement rejects changed source content and receipt failure rolls the whole replacement back', (t) => {
  const x = fixture(t),
    group = x.attach(0),
    stale = x.replaceCommand();
  x.store.executeSession(
    x.command({
      kind: 'group-content',
      planId: x.source.id,
      groupId: group.id,
      expectedRevision: group.revision,
      title: 'Neu',
      notes: 'Neu',
    }),
  );
  let bytes = x.store.db.serialize();
  assert.throws(() => x.store.executeSession(stale), /Vorlage inzwischen geändert/);
  assert.ok(x.store.db.serialize().equals(bytes));
  const command = x.replaceCommand();
  x.store.db.exec(
    "CREATE TRIGGER deny_replace_receipt BEFORE INSERT ON session_receipt BEGIN SELECT RAISE(ABORT,'replacement receipt failure'); END",
  );
  bytes = x.store.db.serialize();
  assert.throws(() => x.store.executeSession(command), /replacement receipt failure/);
  assert.ok(
    x.store.db.serialize().equals(bytes),
    'Timeline, groups and history roll back together',
  );
  x.store.db.exec('DROP TRIGGER deny_replace_receipt');
  const copy = x.store.executeSession(command);
  assert.deepEqual(x.store.executeSession(command), copy);
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM world_history').get().n, 1);
});

test('placed but unawarded treasure retains its World identity through replacement, award, clear and Fresh', async (t) => {
  const x = fixture(t),
    location = {
      kind: 'location',
      version: 1,
      id: randomUUID(),
      name: 'Tor',
      type: 'poi',
      sections: [],
      detailMaps: [],
      keyLinks: [],
    };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'location', document: location, expectedRevision: null },
  });
  let d = x.store.session(x.w.token, x.source.id).visits[0];
  x.store.executeSession(
    x.command({
      kind: 'visit',
      planId: x.source.id,
      expectedRevision: d.revision,
      detail: {
        ...d,
        reward: {
          id: randomUUID(),
          poolXp: 0,
          items: [{ name: 'Schlüssel', quantity: 1, valueGold: '2', category: 'equipment' }],
          placedTreasureId: null,
          awarded: false,
        },
      },
    }),
  );
  d = x.store.session(x.w.token, x.source.id).visits[0];
  x.store.executeSession(
    x.command({
      kind: 'place-reward',
      planId: x.source.id,
      visitId: d.visitId,
      expectedVisitRevision: d.revision,
      locationId: location.id,
      expectedLocationRevision: 1,
    }),
  );
  d = x.store.session(x.w.token, x.source.id).visits[0];
  const treasureId = d.reward.placedTreasureId,
    before = x.store.db
      .prepare('SELECT payload FROM treasure WHERE campaign_id=? AND id=?')
      .get(x.cam.id, treasureId).payload;
  const command = x.replaceCommand(),
    copy = x.store.executeSession(command),
    copied = copy.visits[0];
  assert.notEqual(copied.reward.id, d.reward.id);
  assert.equal(copied.reward.placedTreasureId, treasureId);
  assert.equal(copied.reward.awarded, false);
  x.store.executeSession(
    x.command({
      kind: 'award-reward',
      planId: x.target.id,
      visitId: copied.visitId,
      expectedVisitRevision: copied.revision,
      noXp: true,
      recipients: [],
    }),
  );
  x.store.executeSession(command);
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM treasure').get().n, 1);
  assert.equal(x.store.session(x.w.token, x.source.id).visits[0].reward.awarded, false);
  x.clear(x.target.id);
  x.clear(x.source.id);
  x.reopen();
  assert.equal(
    x.store.db
      .prepare('SELECT payload FROM treasure WHERE campaign_id=? AND id=?')
      .get(x.cam.id, treasureId).payload,
    before,
  );
  await x.store.backup(path.join(x.root, 'safe.sqlite'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSync } from '../helpers/build.mjs';

buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/storage-owner-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../../.build/storage-owner-store.cjs');

test('split inherits position once, rejoin preserves the target and preparation survives replay and reopen', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'storage-owners-')),
    file = path.join(root, 'workbench.sqlite');
  let store = new CampaignStore(file);
  const campaign = store.create('Getrennte Gruppen');
  let workspace = store.activate(campaign.id);
  const command = (action) => ({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token: workspace.token,
    action,
  });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const heroes = ['Ada', 'Borin'].map(
    (name) => store.executeLive(command({ kind: 'create-character', profile: { name } })).character,
  );
  const primary = store.executeLive(
    command({ kind: 'initialize', expectedRosterRevision: 2 }),
  ).scene;
  for (const hero of heroes) {
    const live = store.live(workspace.token);
    store.executeLive(
      command({
        kind: 'membership',
        characterId: hero.id,
        expectedRevision: hero.membershipRevision,
        expectedRosterRevision: live.rosterRevision,
        active: true,
        targetSceneId: primary.id,
        expectedFocusRevision: live.focusRevision,
      }),
    );
  }
  const plan = {
    version: 1,
    id: randomUUID(),
    revision: 1,
    name: 'Unveränderte Vorbereitung',
    scenes: [
      { id: randomUUID(), title: 'Salzsteg', notes: '  Quellenprosa\r\n', locationId: null },
    ],
  };
  store.changePreparation({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token: workspace.token,
    change: { kind: 'plan', plan, expectedRevision: null },
  });
  store.executeLive(
    command({
      kind: 'apply-visit',
      planId: plan.id,
      expectedPlanRevision: 1,
      visitId: plan.scenes[0].id,
      sceneId: primary.id,
      expectedRevision: store.liveScene(workspace.token, primary.id).revision,
    }),
  );
  const prepared = store.session(workspace.token, plan.id),
    rawPreparation = () =>
      ['plan', 'planned_visit', 'session_profile', 'session_visit', 'prepared_group'].map((table) =>
        store.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
      ),
    raw = rawPreparation(),
    origin = store.sceneWorld(workspace.token, primary.id),
    map = store.world(workspace.token).maps[0];
  store.executeWorld(
    command({
      kind: 'place-scene',
      sceneId: primary.id,
      position: { mapId: map.id, q: 4, r: 2, locationId: null },
      expectedSceneRevision: origin.scene.revision,
      expectedPositionRevision: origin.position.revision,
    }),
  );
  const before = store.sceneWorld(workspace.token, primary.id),
    live = store.live(workspace.token),
    splitCommand = command({
      kind: 'move',
      sceneId: primary.id,
      memberIds: [heroes[1].id],
      expectedRosterRevision: live.rosterRevision,
      expectedFocusRevision: live.focusRevision,
      expectedClockRevision: before.scene.clock.revision,
      expectedSceneMembershipRevision: before.scene.membershipRevision,
      target: { kind: 'new', title: 'Wache', expectedContentRevision: before.scene.revision },
    }),
    ack = store.executeLive(splitCommand),
    splitId = ack.session.createdScene.id,
    split = store.sceneWorld(workspace.token, splitId);
  assert.deepEqual(split.position, { ...before.position, revision: 1 });
  assert.deepEqual(split.scene.clock, { ...before.scene.clock, revision: 0 });
  assert.deepEqual(store.sceneWorld(workspace.token, primary.id).position, before.position);
  const splitBytes = store.db.serialize();
  assert.deepEqual(store.executeLive(splitCommand), ack);
  assert(store.db.serialize().equals(splitBytes));
  const current = store.live(workspace.token),
    target = store.liveScene(workspace.token, primary.id),
    rejoinCommand = command({
      kind: 'move',
      sceneId: splitId,
      memberIds: [heroes[1].id],
      expectedRosterRevision: current.rosterRevision,
      expectedFocusRevision: current.focusRevision,
      expectedClockRevision: split.scene.clock.revision,
      expectedSceneMembershipRevision: split.scene.membershipRevision,
      target: {
        kind: 'existing',
        sceneId: primary.id,
        expectedClockRevision: target.clock.revision,
        expectedMembershipRevision: target.membershipRevision,
      },
    });
  store.executeLive(rejoinCommand);
  assert.equal(store.liveScene(workspace.token, splitId).retired, true);
  assert.deepEqual(store.sceneWorld(workspace.token, primary.id).position, before.position);
  assert.deepEqual(store.session(workspace.token, plan.id), prepared);
  assert.deepEqual(rawPreparation(), raw);
  store.close();
  store = new CampaignStore(file);
  workspace = store.activate(campaign.id);
  assert.deepEqual(store.session(workspace.token, plan.id), prepared);
  assert.deepEqual(rawPreparation(), raw);
  assert.deepEqual(store.sceneWorld(workspace.token, primary.id).position, before.position);
  assert.equal(store.liveStatus(rejoinCommand, workspace.token).outcome, 'applied');
  assert.equal(
    store.live(workspace.token).roster.find((c) => c.id === heroes[1].id).sceneId,
    primary.id,
  );
});

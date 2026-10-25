import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/party-history-copy.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/party-history-copy.cjs');
test('independent campaign copy rebinds party history scene links and preserves authored text and package bytes', async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'party-history-copy-')),
    store = new CampaignStore(path.join(root, 'store.sqlite')),
    cam = store.create('Gruppengeschichte'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const characters = ['Iri', 'Dorn'].map(
    (name) => store.executeLive(command({ kind: 'create-character', profile: { name } })).character,
  );
  for (const c of characters) {
    const live = store.live(w.token);
    store.executeLive(
      command({
        kind: 'membership',
        characterId: c.id,
        expectedRevision: c.membershipRevision,
        expectedRosterRevision: live.rosterRevision,
        active: true,
        targetSceneId: null,
        expectedFocusRevision: live.focusRevision,
      }),
    );
  }
  store.executeLive(
    command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
  );
  const live = store.live(w.token),
    scene = live.scene,
    title = 'Originalprosa ' + scene.id;
  const result = store.executeLive(
      command({
        kind: 'move',
        sceneId: scene.id,
        memberIds: [characters[1].id],
        expectedRosterRevision: live.rosterRevision,
        expectedFocusRevision: live.focusRevision,
        expectedClockRevision: scene.clock.revision,
        expectedSceneMembershipRevision: scene.membershipRevision,
        target: { kind: 'new', title, expectedContentRevision: scene.revision },
      }),
    ),
    destination = store.liveScene(w.token, result.session.createdScene.id),
    moved = store.live(w.token).roster.find((c) => c.id === characters[1].id),
    current = store.live(w.token);
  store.executeCombat({
    ...command({
      kind: 'create',
      sceneId: destination.id,
      title: 'Maskenübergang',
      includeParty: true,
      expectedMembershipRevision: destination.membershipRevision,
    }),
    combatId: null,
    expectedRevision: null,
  });
  const chase = store.executeChase({
    ...command({ kind: 'create', title: 'Verfolgung', goal: 'Tor' }),
    sceneId: destination.id,
    chaseId: null,
    expectedRevision: null,
  }).chase;
  store.executeChase({
    ...command({
      kind: 'participant',
      participant: {
        id: randomUUID(),
        characterId: moved.id,
        name: 'Dorn',
        side: 'pursuer',
        distance: 0,
        speed: 9,
        exhaustion: 0,
        notes: '',
      },
    }),
    sceneId: destination.id,
    chaseId: chase.id,
    expectedRevision: chase.revision,
  });
  store.executeLive(
    command({
      kind: 'membership',
      characterId: moved.id,
      expectedRevision: moved.membershipRevision,
      expectedRosterRevision: current.rosterRevision,
      active: false,
      targetSceneId: null,
      expectedFocusRevision: current.focusRevision,
    }),
  );
  const file = path.join(root, 'campaign.sqlite');
  await store.campaignSnapshot(w.token, file);
  const bytes = readFileSync(file),
    copy = store.acceptCampaignSnapshot(file, 'Kopie', {}),
    rows = store.db
      .prepare('SELECT payload FROM world_history WHERE campaign_id=?')
      .all(copy.id)
      .map((r) => JSON.parse(r.payload)),
    sceneIds = new Set(
      store.db
        .prepare('SELECT id FROM live_scene WHERE campaign_id=?')
        .all(copy.id)
        .map((r) => r.id),
    ),
    characterIds = new Set(
      store.db
        .prepare('SELECT id FROM roster_member WHERE campaign_id=?')
        .all(copy.id)
        .map((r) => r.id),
    );
  for (const row of rows) {
    for (const key of ['fromSceneId', 'toSceneId'])
      if (row.facts?.[key])
        assert.ok(sceneIds.has(row.facts[key]), 'Copied ' + key + ' must refer to a copied Scene');
    for (const id of row.facts?.characterIds ?? []) assert.ok(characterIds.has(id));
  }
  const reconciliations = store.db
    .prepare('SELECT payload FROM mask_reconciliation_receipt WHERE campaign_id=?')
    .all(copy.id)
    .map((r) => JSON.parse(r.payload));
  assert.equal(reconciliations.length, 2);
  for (const receipt of reconciliations)
    for (const id of receipt.removedCharacterIds)
      assert.ok(characterIds.has(id), 'Copied removed character must belong to copied campaign');
  assert.equal(rows.filter((r) => r.facts?.kind === 'party-move').length, 1);
  assert.ok(
    store.db
      .prepare('SELECT 1 FROM live_scene WHERE campaign_id=? AND title=?')
      .get(copy.id, title),
  );
  assert.ok(!sceneIds.has(scene.id) && !sceneIds.has(destination.id));
  assert.deepEqual(readFileSync(file), bytes);
  await store.backup(path.join(root, 'safe.sqlite'));
});

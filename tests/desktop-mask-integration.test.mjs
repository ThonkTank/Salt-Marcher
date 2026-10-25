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
  outfile: '.build/mask-integration-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/mask-integration-store.cjs');
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'mask-integration-')),
    file = root + '/workbench.sqlite',
    store = new CampaignStore(file),
    campaign = store.create('Zwei Kämpfe und eine Verfolgung'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    });
  store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 }));
  const heroes = [];
  for (const name of ['Iri', 'Nera']) {
    const c = store.executeLive(command({ kind: 'create-character', profile: { name } })).character,
      v = store.live(w.token);
    store.executeLive(
      command({
        kind: 'membership',
        characterId: c.id,
        expectedRevision: c.membershipRevision,
        expectedRosterRevision: v.rosterRevision,
        active: true,
        targetSceneId: v.focusId,
        expectedFocusRevision: v.focusRevision,
      }),
    );
    heroes.push(c);
  }
  const scene = store.live(w.token).scene,
    combats = [];
  const edit = (state, action) =>
    store.executeCombat({
      ...command(action),
      combatId: state.id,
      expectedRevision: state.revision,
    }).combat;
  let first = store.executeCombat({
    ...command({
      kind: 'create',
      sceneId: scene.id,
      title: 'Torwache',
      includeParty: true,
      expectedMembershipRevision: scene.membershipRevision,
    }),
    combatId: null,
    expectedRevision: null,
  }).combat;
  first = edit(first, {
    kind: 'edit',
    participantId: first.participants.find((p) => p.characterId === heroes[0].id).id,
    changes: { hp: 10, maxHp: 10, initiative: 20 },
  });
  first = edit(first, {
    kind: 'damage',
    participantId: first.participants.find((p) => p.characterId === heroes[0].id).id,
    amount: 7,
  });
  first = edit(first, { kind: 'add-creature', creatureId: 'goblin', count: 1, grouped: false });
  first = edit(first, { kind: 'start' });
  combats.push(first);
  let second = store.executeCombat({
    ...command({
      kind: 'create',
      sceneId: scene.id,
      title: 'Hinterhalt',
      includeParty: true,
      expectedMembershipRevision: scene.membershipRevision,
    }),
    combatId: null,
    expectedRevision: null,
  }).combat;
  second = edit(second, { kind: 'add-creature', creatureId: 'goblin', count: 1, grouped: false });
  second = edit(second, { kind: 'start' });
  combats.push(second);
  let chase = store.executeChase({
    ...command({ kind: 'create', title: 'Flucht', goal: 'Keller' }),
    sceneId: scene.id,
    chaseId: null,
    expectedRevision: null,
  }).chase;
  chase = store.executeChase({
    ...command({
      kind: 'participant',
      participant: {
        id: randomUUID(),
        characterId: heroes[0].id,
        name: 'Iri',
        side: 'quarry',
        distance: 0,
        speed: 9,
        exhaustion: 0,
        notes: '',
      },
    }),
    sceneId: scene.id,
    chaseId: chase.id,
    expectedRevision: chase.revision,
  }).chase;
  const v = store.live(w.token),
    move = command({
      kind: 'move',
      sceneId: scene.id,
      expectedRosterRevision: v.rosterRevision,
      expectedFocusRevision: v.focusRevision,
      expectedClockRevision: scene.clock.revision,
      expectedSceneMembershipRevision: scene.membershipRevision,
      memberIds: [heroes[0].id],
      target: { kind: 'new', title: 'Keller', expectedContentRevision: scene.revision },
    });
  return {
    root,
    file,
    store,
    w,
    campaign,
    heroes,
    scene,
    combats,
    chase,
    move,
    close() {
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
test('one party move preserves canonical HP and reconciles two combats and a chase exactly once', () => {
  const x = fixture();
  try {
    const ack = x.store.executeLive(x.move);
    assert.deepEqual(x.store.executeLive(x.move), ack);
    for (const before of x.combats) {
      const after = x.store.combat(x.w.token, x.scene.id, before.id).combat;
      assert.equal(after.revision, before.revision + 1);
      assert(!after.participants.some((p) => p.characterId === x.heroes[0].id));
      assert.equal(
        after.participants.find((p) => p.id === after.turnId).characterId,
        x.heroes[1].id,
      );
    }
    assert.equal(x.store.chase(x.w.token, x.scene.id, x.chase.id).chase.participants.length, 0);
    assert.equal(
      x.store.progress(x.w.token).characters.find((c) => c.characterId === x.heroes[0].id).health
        .hp,
      3,
    );
    assert.equal(
      x.store.db
        .prepare('SELECT count(*) n FROM mask_reconciliation_receipt WHERE command_id=?')
        .get(x.move.commandId).n,
      3,
    );
    assert.equal(
      x.store.db.prepare("SELECT count(*) n FROM progress_event WHERE kind='combat-exit'").get().n,
      2,
    );
    const fresh = new CampaignStore(x.file);
    try {
      const w = fresh.activate(x.campaign.id);
      assert.deepEqual(fresh.executeLive({ ...x.move, token: w.token }), ack);
      assert.equal(
        fresh.progress(w.token).characters.find((c) => c.characterId === x.heroes[0].id).health.hp,
        3,
      );
    } finally {
      fresh.close();
    }
  } finally {
    x.close();
  }
});
test('a failed reconciliation receipt rolls back party, masks, health and history together', () => {
  const x = fixture();
  try {
    const before = {
      live: x.store.live(x.w.token),
      combats: x.combats.map((c) => x.store.combat(x.w.token, x.scene.id, c.id)),
      chase: x.store.chase(x.w.token, x.scene.id, x.chase.id),
      progress: x.store.progress(x.w.token),
    };
    x.store.db.exec(
      "CREATE TEMP TRIGGER qa_fail_receipt BEFORE INSERT ON mask_reconciliation_receipt BEGIN SELECT RAISE(ABORT,'QA receipt unavailable'); END",
    );
    assert.throws(() => x.store.executeLive(x.move), /QA receipt unavailable/);
    assert.deepEqual(x.store.live(x.w.token), before.live);
    for (let i = 0; i < x.combats.length; i++)
      assert.deepEqual(x.store.combat(x.w.token, x.scene.id, x.combats[i].id), before.combats[i]);
    assert.deepEqual(x.store.chase(x.w.token, x.scene.id, x.chase.id), before.chase);
    assert.deepEqual(x.store.progress(x.w.token), before.progress);
    assert.equal(
      x.store.db.prepare('SELECT count(*) n FROM mask_reconciliation_receipt').get().n,
      0,
    );
    assert.equal(
      x.store.db.prepare("SELECT count(*) n FROM progress_event WHERE kind='combat-exit'").get().n,
      0,
    );
    x.store.db.exec('DROP TRIGGER qa_fail_receipt');
    x.store.executeLive(x.move);
    assert.equal(
      x.store.db.prepare('SELECT count(*) n FROM mask_reconciliation_receipt').get().n,
      3,
    );
  } finally {
    x.close();
  }
});

function archiveCommand(x, archived) {
  const live = x.store.live(x.w.token),
    character = archived
      ? live.roster.find((c) => c.id === x.heroes[0].id)
      : x.store.archivedRoster(x.w.token, null, '').items.find((c) => c.id === x.heroes[0].id);
  return {
    commandId: randomUUID(),
    campaignId: x.campaign.id,
    token: x.w.token,
    action: {
      kind: 'archive-character',
      characterId: character.id,
      expectedRevision: character.profileRevision,
      expectedMembershipRevision: character.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      expectedFocusRevision: live.focusRevision,
      archived,
      confirmName: character.profile.name,
      reason: 'Vorübergehend nicht am Tisch',
    },
  };
}
test('archiving reconciles all open masks once and restoration retains XP, HP and the complete ledger', async () => {
  const x = fixture();
  try {
    const id = x.heroes[0].id,
      progress = x.store.progress(x.w.token).characters.find((c) => c.characterId === id),
      command = (action) => ({
        commandId: randomUUID(),
        campaignId: x.campaign.id,
        token: x.w.token,
        action,
      });
    x.store.executeProgress(
      command({
        kind: 'xp',
        characterId: id,
        expectedRevision: progress.revision,
        mode: 'set',
        amount: 900,
        reason: 'Bekannter Stand',
      }),
    );
    const ledgerId = x.store.executeProgress(
        command({
          kind: 'manual-item',
          characterId: id,
          expectedMembershipRevision: x.store.live(x.w.token).roster.find((c) => c.id === id)
            .membershipRevision,
          origin: 'manual',
          item: { name: 'Seil', category: 'equipment', quantity: 3, valueGold: '2' },
          note: 'Eigener Besitz',
        }),
      ).ledgerIds[0],
      ledger = x.store.ledgerItem(x.w.token, ledgerId);
    const archive = archiveCommand(x, true),
      ack = x.store.executeLive(archive),
      applied = x.store.db.serialize();
    assert.deepEqual(x.store.executeLive(archive), ack);
    assert.ok(x.store.db.serialize().equals(applied));
    assert.equal(
      x.store.live(x.w.token).roster.some((c) => c.id === id),
      false,
    );
    assert.equal(
      x.store.progress(x.w.token).characters.some((c) => c.characterId === id),
      false,
    );
    assert.equal(
      x.store.lootBalance(x.w.token).characters.some((c) => c.characterId === id),
      false,
    );
    for (const mask of x.combats)
      assert.equal(
        x.store
          .combat(x.w.token, x.scene.id, mask.id)
          .combat.participants.some((p) => p.characterId === id),
        false,
      );
    assert.equal(x.store.chase(x.w.token, x.scene.id, x.chase.id).chase.participants.length, 0);
    assert.equal(
      x.store.db
        .prepare('SELECT count(*) n FROM mask_reconciliation_receipt WHERE command_id=?')
        .get(archive.commandId).n,
      3,
    );
    assert.deepEqual(x.store.ledgerItem(x.w.token, ledgerId), ledger);
    const snapshot = path.join(x.root, 'archived.sqlite');
    await x.store.campaignSnapshot(x.w.token, snapshot);
    const copy = x.store.acceptCampaignSnapshot(snapshot, 'Unabhängige Kopie', {}),
      copyOwner = x.store.activate(copy.id),
      copied = x.store.archivedRoster(copyOwner.token, null, '').items[0];
    assert.notEqual(copied.id, id);
    assert.equal(copied.profile.name, 'Iri');
    assert.equal(
      JSON.parse(
        x.store.db
          .prepare('SELECT payload FROM character_progress WHERE campaign_id=? AND id=?')
          .get(copy.id, copied.id).payload,
      ).xp,
      900,
    );
    assert.equal(
      x.store.ledger(copyOwner.token, {
        characterId: copied.id,
        after: null,
        search: '',
        status: '',
      }).items[0].quantity,
      3,
    );
    x.w = x.store.activate(x.campaign.id);
    const restore = archiveCommand(x, false);
    x.store.executeLive(restore);
    const restored = x.store.live(x.w.token).roster.find((c) => c.id === id),
      after = x.store.progress(x.w.token).characters.find((c) => c.characterId === id);
    assert.equal(restored.active, false);
    assert.equal(restored.sceneId, null);
    assert.equal(after.xp, 900);
    assert.equal(after.health.hp, 3);
    assert.deepEqual(x.store.ledgerItem(x.w.token, ledgerId), ledger);
  } finally {
    x.close();
  }
});
test('failed archive reconciliation rolls back profile, party, masks and receipts together', () => {
  const x = fixture();
  try {
    const command = archiveCommand(x, true),
      before = x.store.db.serialize();
    x.store.db.exec(
      "CREATE TEMP TRIGGER qa_archive_failure BEFORE INSERT ON mask_reconciliation_receipt BEGIN SELECT RAISE(ABORT,'archive reconciliation unavailable'); END",
    );
    assert.throws(() => x.store.executeLive(command), /archive reconciliation unavailable/);
    assert.ok(x.store.db.serialize().equals(before));
    assert.equal(x.store.archivedRoster(x.w.token, null, '').total, 0);
    x.store.db.exec('DROP TRIGGER qa_archive_failure');
    x.store.executeLive(command);
    assert.equal(x.store.archivedRoster(x.w.token, null, '').total, 1);
  } finally {
    x.close();
  }
});
for (const field of ['checksum', 'revision', 'missing'])
  test('progress and loot projections share canonical profile ' + field + ' validation', () => {
    const x = fixture();
    try {
      const id = x.heroes[0].id;
      if (field === 'missing')
        x.store.db
          .prepare('DELETE FROM character_profile WHERE campaign_id=? AND id=?')
          .run(x.campaign.id, id);
      else
        x.store.db
          .prepare('UPDATE character_profile SET ' + field + '=? WHERE campaign_id=? AND id=?')
          .run(field === 'checksum' ? 'damaged' : -1, x.campaign.id, id);
      const before = x.store.db.serialize();
      assert.throws(() => x.store.progress(x.w.token), /Charakter/);
      assert.throws(() => x.store.lootBalance(x.w.token), /Charakter/);
      assert.ok(x.store.db.serialize().equals(before));
    } finally {
      x.close();
    }
  });

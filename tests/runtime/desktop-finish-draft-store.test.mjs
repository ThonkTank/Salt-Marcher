import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/finish-draft-storage.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../../.build/finish-draft-storage.cjs');
const hash = (s) => createHash('sha256').update(s).digest('hex');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'finish-integrity-')),
    store = new CampaignStore(path.join(root, 'source.sqlite')),
    campaign = store.create('Finish source'),
    w = store.activate(campaign.id),
    id = randomUUID();
  const command = (action) => ({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token: w.token,
    action,
  });
  const character = store.executeLive(
    command({ kind: 'create-character', profile: { name: 'Recipient' } }),
  ).character;
  store.changePreparation({
    ...command(null),
    change: {
      kind: 'note',
      expectedRevision: null,
      note: {
        version: 1,
        id,
        revision: 1,
        kind: 'quest',
        title: 'Quest',
        readAloud: 'Public text',
        gmNotes: 'Private prose',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    },
  });
  const owner = { kind: 'narrative', targetId: id, revision: 0 },
    draft = {
      ...owner,
      writeId: randomUUID(),
      outcome: '  Original outcome\r\n',
      poolXp: '-',
      loadXp: '1,5',
      noXp: false,
      hasLoot: true,
      recipientIds: [character.id],
      items: [
        { name: '  Unfinished item\r\n', category: 'equipment', quantity: '-', valueGold: '1,5' },
      ],
    };
  store.keepFinishDraft(w.token, draft, null);
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { root, store, campaign, w, owner, draft, character };
}
function damage(x, edit) {
  const row = x.store.db.prepare('SELECT * FROM finish_draft').get(),
    d = JSON.parse(row.payload);
  edit(d);
  const payload = JSON.stringify(d);
  x.store.db
    .prepare(
      'UPDATE finish_draft SET payload=?,checksum=? WHERE campaign_id=? AND kind=? AND target_id=?',
    )
    .run(payload, hash(payload), row.campaign_id, row.kind, row.target_id);
}
for (const [name, edit] of [
  ['target identity', (d) => (d.targetId = randomUUID())],
  ['kind', (d) => (d.kind = 'combat')],
  ['revision', (d) => (d.revision = 99)],
  ['raw field', (d) => (d.noXp = 'yes')],
  ['recipient owner', (d) => (d.recipientIds = [randomUUID()])],
  [
    'item reference',
    (d) => (d.items[0].reference = { kind: 'authored', definitionId: randomUUID(), revision: 1 }),
  ],
]) {
  test(`checksummed finish draft ${name} damage cannot be read or replace a qualified backup`, async (t) => {
    const x = fixture(t),
      safe = path.join(x.root, 'safe.sqlite');
    await x.store.backup(safe);
    const saved = readFileSync(safe);
    damage(x, edit);
    const before = x.store.db.serialize();
    assert.throws(() => x.store.finishDraft(x.w.token, x.owner));
    await assert.rejects(x.store.backup(safe));
    assert.ok(readFileSync(safe).equals(saved));
    assert.ok(x.store.db.serialize().equals(before));
  });
}
test('raw finish draft copies remap structured owners and retain prose after fresh reopening', async (t) => {
  const x = fixture(t),
    snapshot = path.join(x.root, 'snapshot.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const sourceBytes = readFileSync(snapshot),
    file = path.join(x.root, 'copy.sqlite'),
    target = new CampaignStore(file);
  let copyId, targetId;
  try {
    const copy = target.acceptCampaignSnapshot(snapshot, 'Copied finishes', {}),
      w = target.activate(copy.id),
      row = target.db.prepare('SELECT * FROM finish_draft WHERE campaign_id=?').get(copy.id),
      d = JSON.parse(row.payload);
    copyId = copy.id;
    targetId = row.target_id;
    assert.notEqual(targetId, x.owner.targetId);
    assert.equal(d.targetId, targetId);
    assert.notEqual(d.writeId, x.draft.writeId);
    assert.notEqual(d.recipientIds[0], x.character.id);
    assert.ok(
      target.db
        .prepare('SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?')
        .get(copy.id, d.recipientIds[0]),
    );
    const read = target.finishDraft(w.token, { ...x.owner, targetId });
    assert.equal(read.outcome, x.draft.outcome);
    assert.equal(read.poolXp, '-');
    assert.equal(read.loadXp, '1,5');
    assert.deepEqual(read.items, x.draft.items);
    await target.backup(path.join(x.root, 'copy-safe.sqlite'));
  } finally {
    target.close();
  }
  const reopened = new CampaignStore(file);
  try {
    const w = reopened.activate(copyId);
    assert.equal(reopened.finishDraft(w.token, { ...x.owner, targetId }).outcome, x.draft.outcome);
  } finally {
    reopened.close();
  }
  assert.ok(readFileSync(snapshot).equals(sourceBytes));
});
test('archived quest finish input remains valid in a backup and independent copy', async (t) => {
  const x = fixture(t);
  x.store.changePreparation({
    commandId: randomUUID(),
    campaignId: x.campaign.id,
    token: x.w.token,
    change: { kind: 'note-trash', id: x.owner.targetId, expectedRevision: 1, trashed: true },
  });
  const snapshot = path.join(x.root, 'archived.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const target = new CampaignStore(path.join(x.root, 'archived-copy.sqlite'));
  try {
    const copy = target.acceptCampaignSnapshot(snapshot, 'Archived finishes', {}),
      row = target.db.prepare('SELECT * FROM finish_draft WHERE campaign_id=?').get(copy.id),
      d = JSON.parse(row.payload);
    assert.equal(d.outcome, x.draft.outcome);
    assert.equal(
      target.db
        .prepare('SELECT trashed FROM world_note WHERE campaign_id=? AND id=?')
        .get(copy.id, d.targetId).trashed,
      1,
    );
    await target.backup(path.join(x.root, 'archived-safe.sqlite'));
  } finally {
    target.close();
  }
});

test('invalid recipient and item references cannot be written over an existing finish draft', (t) => {
  const x = fixture(t);
  for (const bad of [
    { ...x.draft, recipientIds: [randomUUID()] },
    {
      ...x.draft,
      items: [
        {
          ...x.draft.items[0],
          reference: { kind: 'authored', definitionId: randomUUID(), revision: 1 },
        },
      ],
    },
  ]) {
    const before = x.store.db.serialize();
    assert.throws(() =>
      x.store.keepFinishDraft(x.w.token, { ...bad, writeId: randomUUID() }, x.draft.writeId),
    );
    assert.ok(x.store.db.serialize().equals(before));
    assert.deepEqual(x.store.finishDraft(x.w.token, x.owner), x.draft);
  }
});

test('a missing finish draft table cannot replace a qualified backup', async (t) => {
  const x = fixture(t),
    safe = path.join(x.root, 'safe.sqlite');
  await x.store.backup(safe);
  const bytes = readFileSync(safe);
  x.store.db.exec('DROP TABLE finish_draft');
  const before = x.store.db.serialize();
  await assert.rejects(x.store.backup(safe));
  assert.ok(readFileSync(safe).equals(bytes));
  assert.ok(x.store.db.serialize().equals(before));
});

test('combat finish consumes exactly its draft and preserves a valid backup', async (t) => {
  const x = fixture(t),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: x.campaign.id,
      token: x.w.token,
      action,
    });
  let live = x.store.live(x.w.token);
  x.store.executeLive(
    command({
      kind: 'membership',
      characterId: x.character.id,
      expectedRevision: x.character.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      active: true,
      targetSceneId: null,
      expectedFocusRevision: null,
    }),
  );
  live = x.store.live(x.w.token);
  x.store.executeLive(command({ kind: 'initialize', expectedRosterRevision: live.rosterRevision }));
  live = x.store.live(x.w.token);
  const combat = x.store.executeCombat({
    ...command({
      kind: 'create',
      sceneId: live.focusId,
      title: 'Battle',
      includeParty: true,
      expectedMembershipRevision: live.scene.membershipRevision,
    }),
    combatId: null,
    expectedRevision: null,
  }).combat;
  const owner = { kind: 'combat', targetId: combat.id, revision: combat.revision },
    d = { ...x.draft, ...owner, writeId: randomUUID() };
  x.store.keepFinishDraft(x.w.token, d, null);
  assert.equal(x.store.finishDraft(x.w.token, owner).outcome, x.draft.outcome);
  await x.store.backup(path.join(x.root, 'combat-draft.sqlite'));
  x.store.executeCombat({
    ...command({
      kind: 'finish',
      outcome: 'Confirmed battle result',
      finishDraftWriteId: d.writeId,
      rewards: {
        poolXp: 0,
        noXp: true,
        recipients: [],
        policyVersion: 'xp-ceil-2014-v1',
        loadXp: 0,
        items: [],
      },
    }),
    combatId: combat.id,
    expectedRevision: combat.revision,
  });
  assert.equal(x.store.finishDraft(x.w.token, owner), null);
  await x.store.backup(path.join(x.root, 'finished.sqlite'));
});

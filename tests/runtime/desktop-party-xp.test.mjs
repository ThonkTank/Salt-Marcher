import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
buildSync({
  stdin: {
    contents: "export {CampaignStore} from './src/app/storage/store';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  outfile: '.build/party-xp.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../../.build/party-xp.cjs');
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'party-xp-')),
    file = join(root, 'store.sqlite'),
    x = { root, file, store: new CampaignStore(file) };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  ((x.campaign = x.store.create('Spielabend')), (x.w = x.store.activate(x.campaign.id)));
  x.command = (action) => ({
    commandId: randomUUID(),
    campaignId: x.campaign.id,
    token: x.w.token,
    action,
  });
  x.ids = ['Ada', 'Borin', 'Dorn'].map(
    (name) =>
      x.store.executeLive(x.command({ kind: 'create-character', profile: { name } })).character.id,
  );
  x.store.executeLive(x.command({ kind: 'initialize', expectedRosterRevision: 3 }));
  for (const [i, id] of x.ids.entries()) {
    const live = x.store.live(x.w.token),
      c = live.roster.find((c) => c.id === id);
    if (i < 2)
      x.store.executeLive(
        x.command({
          kind: 'membership',
          characterId: id,
          expectedRevision: c.membershipRevision,
          expectedRosterRevision: live.rosterRevision,
          active: true,
          targetSceneId: live.focusId,
          expectedFocusRevision: live.focusRevision,
        }),
      );
    x.store.executeProgress(
      x.command({
        kind: 'xp',
        characterId: id,
        expectedRevision: 0,
        mode: 'set',
        amount: [950, 300, 100][i],
        reason: 'Bekannter Start',
      }),
    );
  }
  x.progress = (id) => x.store.progress(x.w.token).characters.find((c) => c.characterId === id);
  x.award = (poolXp, loadXp, flags) => {
    const view = x.store.progress(x.w.token);
    return x.command({
      kind: 'party-award',
      expectedRosterRevision: x.store.live(x.w.token).rosterRevision,
      poolXp,
      loadXp,
      reason: 'Spielabend',
      participants: flags.map(([i, receiveXp, receiveLoad]) => {
        const p = view.characters.find((c) => c.characterId === x.ids[i]);
        return {
          characterId: p.characterId,
          revision: p.revision,
          membershipRevision: p.membershipRevision,
          receiveXp,
          receiveLoad,
        };
      }),
    });
  };
  return x;
}
test('party settlement rounds separate recipient pools, preserves scene time and replays once after reopening', (t) => {
  const x = fixture(t),
    clock = x.store.live(x.w.token).scene.clock,
    command = x.award(101, 5, [
      [0, true, true],
      [1, false, true],
      [2, true, false],
    ]),
    ack = x.store.executeProgress(command);
  assert.deepEqual(ack.partyAward, {
    poolXp: 101,
    loadXp: 5,
    shareXp: 51,
    totalXp: 102,
    shareLoad: 3,
    totalLoad: 6,
  });
  assert.deepEqual(
    x.ids.map((id) => [x.progress(id).xp, x.progress(id).rest.longXp]),
    [
      [1001, 3],
      [300, 3],
      [151, 0],
    ],
  );
  assert.deepEqual(x.store.live(x.w.token).scene.clock, clock);
  assert.equal(
    x.store.db.prepare('SELECT count(*) n FROM progress_notice WHERE character_id=?').get(x.ids[2])
      .n,
    2,
  );
  x.store.close();
  x.store = new CampaignStore(x.file);
  x.w = x.store.activate(x.campaign.id);
  const before = x.store.db.serialize();
  assert.deepEqual(x.store.executeProgress({ ...command, token: x.w.token }), ack);
  assert.ok(x.store.db.serialize().equals(before));
});
test('a stale later recipient rolls back prior XP, load, notices, events and the settlement receipt', (t) => {
  const x = fixture(t),
    command = x.award(100, 100, [
      [0, true, true],
      [1, true, true],
    ]);
  command.action.participants[1].revision++;
  const before = x.store.db.serialize();
  assert.throws(() => x.store.executeProgress(command), /XP- oder Raststand/);
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(
    x.store.db
      .prepare('SELECT count(*) n FROM progress_receipt WHERE command_id=?')
      .get(command.commandId).n,
    0,
  );
});
test('inactive load and duplicate recipients are rejected without any party settlement effect', (t) => {
  const x = fixture(t);
  for (const damage of ['inactive-load', 'duplicate']) {
    const command = x.award(10, 10, [
      [0, true, true],
      [2, true, false],
    ]);
    if (damage === 'inactive-load') command.action.participants[1].receiveLoad = true;
    else command.action.participants.push({ ...command.action.participants[0] });
    const before = x.store.db.serialize();
    assert.throws(() => x.store.executeProgress(command), /aktive Figuren|Figuren und einen Grund/);
    assert.ok(x.store.db.serialize().equals(before));
  }
});
test('campaign copies remap XP and load recipients in settlement history without rewriting the source or package', async (t) => {
  const x = fixture(t);
  x.store.executeProgress(
    x.award(101, 5, [
      [0, true, true],
      [1, false, true],
      [2, true, false],
    ]),
  );
  const source = x.store.db
      .prepare(
        "SELECT payload,checksum FROM progress_event WHERE campaign_id=? AND kind='party-award'",
      )
      .get(x.campaign.id),
    file = join(x.root, 'settlement.sqlite');
  await x.store.campaignSnapshot(x.w.token, file);
  const bytes = readFileSync(file),
    copy = x.store.acceptCampaignSnapshot(file, 'Kopie', {}),
    owner = x.store.activate(copy.id),
    ids = new Map(x.store.live(owner.token).roster.map((c) => [c.profile.name, c.id]));
  const history = JSON.parse(
    x.store.db
      .prepare("SELECT payload FROM progress_event WHERE campaign_id=? AND kind='party-award'")
      .get(copy.id).payload,
  );
  assert.deepEqual(history.recipientIds, [ids.get('Ada'), ids.get('Dorn')]);
  assert.deepEqual(history.loadedIds, [ids.get('Ada'), ids.get('Borin')]);
  assert.ok(history.loadedIds.every((id) => !x.ids.includes(id)));
  assert.deepEqual(
    x.store.db
      .prepare(
        "SELECT payload,checksum FROM progress_event WHERE campaign_id=? AND kind='party-award'",
      )
      .get(x.campaign.id),
    source,
  );
  assert.deepEqual(readFileSync(file), bytes);
});

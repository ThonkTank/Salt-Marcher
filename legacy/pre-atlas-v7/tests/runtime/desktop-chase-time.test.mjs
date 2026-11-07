import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/chase-time-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../../.build/chase-time-store.cjs');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'chase-time-')),
    x = { file: path.join(root, 'workbench.sqlite') };
  x.store = new CampaignStore(x.file);
  x.cam = x.store.create('Unabhängige Gruppenzeit');
  x.w = x.store.activate(x.cam.id);
  x.command = (action) => ({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    action,
  });
  x.scene = x.store.executeLive(x.command({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
  x.clock = (id) => x.store.liveScene(x.w.token, id).clock;
  x.create = (sceneId) => {
    let c = x.store.executeChase({
      ...x.command({ kind: 'create', title: 'Hafenflucht', goal: 'Tor' }),
      sceneId,
      chaseId: null,
      expectedRevision: null,
    }).chase;
    return x.store.executeChase({
      ...x.command({
        kind: 'participant',
        participant: {
          id: randomUUID(),
          name: 'Kurier',
          side: 'quarry',
          distance: 18,
          speed: 9,
          exhaustion: 0,
          notes: '',
        },
      }),
      sceneId,
      chaseId: c.id,
      expectedRevision: c.revision,
    }).chase;
  };
  x.round = (c) => ({
    ...x.command({
      kind: 'round',
      changes: c.participants.map((p) => ({
        participantId: p.id,
        distance: p.distance + 9,
        exhaustion: 1,
      })),
      complication: 'Wagen',
    }),
    sceneId: c.sceneId,
    chaseId: c.id,
    expectedRevision: c.revision,
  });
  x.reopen = () => {
    x.store.close();
    x.store = new CampaignStore(x.file);
    x.w = x.store.activate(x.cam.id);
  };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return x;
}
test('parallel chases advance only their Scene by six seconds once, including receipt lookup and Fresh replay', (t) => {
  const x = fixture(t),
    heroes = ['Ada', 'Borin'].map(
      (name) =>
        x.store.executeLive(x.command({ kind: 'create-character', profile: { name } })).character,
    );
  let v = x.store.live(x.w.token);
  x.store.executeLive(
    x.command({
      kind: 'scene-roster',
      sceneId: x.scene.id,
      expectedRosterRevision: v.rosterRevision,
      expectedFocusRevision: v.focusRevision,
      expectedSceneMembershipRevision: v.scene.membershipRevision,
      memberIds: heroes.map((h) => h.id),
    }),
  );
  v = x.store.live(x.w.token);
  const other = x.store.executeLive(
    x.command({
      kind: 'move',
      sceneId: v.scene.id,
      expectedRosterRevision: v.rosterRevision,
      expectedFocusRevision: v.focusRevision,
      expectedClockRevision: v.scene.clock.revision,
      expectedSceneMembershipRevision: v.scene.membershipRevision,
      memberIds: [heroes[0].id],
      target: { kind: 'new', title: 'Wald', expectedContentRevision: v.scene.revision },
    }),
  ).session.createdScene;
  const a = x.create(x.scene.id),
    b = x.create(x.scene.id),
    c = x.create(other.id),
    before = x.clock(a.sceneId),
    otherBefore = x.clock(c.sceneId),
    command = x.round(a),
    result = x.store.executeChase(command);
  assert.equal(BigInt(x.clock(a.sceneId).instantMs) - BigInt(before.instantMs), 6000n);
  assert.deepEqual(x.clock(c.sceneId), otherBefore);
  assert.equal(x.store.chase(x.w.token, b.sceneId, b.id).chase.round, 0);
  x.store.executeChase(x.round(b));
  assert.equal(BigInt(x.clock(a.sceneId).instantMs) - BigInt(before.instantMs), 12000n);
  x.store.executeChase(x.round(c));
  assert.equal(BigInt(x.clock(c.sceneId).instantMs) - BigInt(otherBefore.instantMs), 6000n);
  x.reopen();
  const clock = x.clock(a.sceneId),
    ref = {
      family: 'chase',
      campaignId: x.cam.id,
      commandId: command.commandId,
      fingerprint: createHash('sha256')
        .update(JSON.stringify({ ...command, token: undefined }))
        .digest('hex'),
    };
  assert.deepEqual(x.store.commitStatus(ref, x.w.token), { outcome: 'applied', value: result });
  assert.deepEqual(x.store.executeChase({ ...command, token: x.w.token }), result);
  assert.deepEqual(x.clock(a.sceneId), clock);
  assert.equal(
    x.store.db.prepare('SELECT count(*) n FROM scene_time_step WHERE campaign_id=?').get(x.cam.id)
      .n,
    3,
  );
  assert.throws(
    () => x.store.executeChase({ ...command, token: x.w.token, commandId: randomUUID() }),
    /geändert/,
  );
  assert.deepEqual(x.clock(a.sceneId), clock);
});
for (const fault of ['world', 'receipt'])
  test(`a ${fault} fault rolls back the round, draft consumption, clock and receipts together`, (t) => {
    const x = fixture(t),
      c = x.create(x.scene.id),
      draft = {
        version: 1,
        writeId: randomUUID(),
        chaseId: c.id,
        sceneId: c.sceneId,
        revision: c.revision,
        fields: { 'chase-complication': 'Wagen', 'chase-outcome': 'Noch offen' },
        rows: [{ participantId: c.participants[0].id, distance: '27', exhaustion: '1' }],
      };
    x.store.keepChaseDraft(x.w.token, draft, null);
    const command = { ...x.round(c), draftWriteId: draft.writeId };
    if (fault === 'world')
      x.store.db
        .prepare("INSERT INTO world_record VALUES(?,'calendar','main',1,'{}','damaged')")
        .run(x.cam.id);
    else
      x.store.db.exec(
        "CREATE TRIGGER reject_chase_receipt BEFORE INSERT ON chase_receipt BEGIN SELECT RAISE(ABORT,'QA receipt unavailable'); END",
      );
    const before = x.store.db.serialize();
    assert.throws(() => x.store.executeChase(command));
    assert.ok(x.store.db.serialize().equals(before));
    assert.deepEqual(x.store.chase(x.w.token, c.sceneId, c.id).draft, draft);
    if (fault === 'world')
      x.store.db
        .prepare("DELETE FROM world_record WHERE campaign_id=? AND kind='calendar'")
        .run(x.cam.id);
    else x.store.db.exec('DROP TRIGGER reject_chase_receipt');
    const start = x.clock(c.sceneId);
    x.store.executeChase(command);
    assert.equal(BigInt(x.clock(c.sceneId).instantMs) - BigInt(start.instantMs), 6000n);
    assert.equal(x.store.chase(x.w.token, c.sceneId, c.id).chase.round, 1);
    x.reopen();
    assert.equal(
      x.store.chase(x.w.token, c.sceneId, c.id).draft.fields['chase-outcome'],
      'Noch offen',
    );
  });

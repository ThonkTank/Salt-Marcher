import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSync } from '../helpers/build.mjs';
import { fixtureStore } from '../helpers/store.mjs';

buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/typed-storage-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const require = createRequire(import.meta.url);
const { CampaignStore } = require('../../.build/typed-storage-store.cjs');
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'typed-storage-'));
  const file = path.join(dir, 'workbench.sqlite');
  let store = fixtureStore(CampaignStore, file);
  const campaign = store.create('Typed storage', [
    {
      id: randomUUID(),
      scopeId: 'local',
      floorId: 'ground',
      number: '1',
      name: 'Room',
      revision: 0,
      sections: [],
      polygons: [
        {
          outer: [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 5, y: 5 },
            { x: 0, y: 5 },
          ],
          holes: [],
        },
      ],
    },
  ]);
  let workspace = store.activate(campaign.id);
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    get store() {
      return store;
    },
    get workspace() {
      return workspace;
    },
    campaign,
    reopen() {
      store.close();
      store = new CampaignStore(file);
      workspace = store.activate(campaign.id);
    },
    edit() {
      const room = store.workspace().rooms[0];
      return {
        commandId: randomUUID(),
        token: workspace.token,
        campaignId: campaign.id,
        roomId: room.id,
        expectedRevision: room.revision,
        name: 'Changed room',
        polygons: room.polygons,
        sections: room.sections,
      };
    },
    plan() {
      return {
        commandId: randomUUID(),
        token: workspace.token,
        campaignId: campaign.id,
        change: {
          kind: 'plan',
          expectedRevision: null,
          plan: { version: 1, id: randomUUID(), revision: 1, name: 'Evening', scenes: [] },
        },
      };
    },
    receipt(id) {
      return store.db.prepare('SELECT * FROM receipt WHERE command_id=?').get(id);
    },
  };
}
for (const kind of ['room', 'plan']) {
  test(`historical token-bearing ${kind} receipts resolve after reopen without migration or replay`, (t) => {
    const f = fixture(t),
      c = kind === 'room' ? f.edit() : f.plan();
    if (kind === 'room') f.store.edit(c);
    else f.store.changePreparationPlan(c);
    const fingerprint = digest(c);
    f.store.db
      .prepare('UPDATE receipt SET fingerprint=? WHERE command_id=?')
      .run(fingerprint, c.commandId);
    const before = f.receipt(c.commandId);
    f.reopen();
    const result =
      kind === 'room'
        ? f.store.reconcile(c, f.workspace.token)
        : f.store.reconcilePreparationPlan(c, f.workspace.token);
    assert.equal(result.outcome, 'applied');
    assert.equal(result.targetChanged, false);
    assert.deepEqual(f.receipt(c.commandId), before);
    const changed = structuredClone(c);
    if (kind === 'room') changed.name = 'Another command';
    else changed.change.plan.name = 'Another command';
    assert.throws(
      () =>
        kind === 'room'
          ? f.store.reconcile(changed, f.workspace.token)
          : f.store.reconcilePreparationPlan(changed, f.workspace.token),
      /Kennung|kennung/,
    );
  });
  test(`confirmed token-free ${kind} commands repeat exactly once after a new activation`, (t) => {
    const f = fixture(t),
      c = kind === 'room' ? f.edit() : f.plan();
    if (kind === 'room') f.store.edit(c);
    else f.store.changePreparationPlan(c);
    const before = f.receipt(c.commandId);
    assert.equal(before.fingerprint, digest({ ...c, token: undefined }));
    f.reopen();
    const replay = { ...c, token: f.workspace.token };
    if (kind === 'room') f.store.edit(replay);
    else f.store.changePreparationPlan(replay);
    assert.deepEqual(f.receipt(c.commandId), before);
    assert.equal(
      kind === 'room'
        ? f.store.workspace().rooms[0].revision
        : f.store.preparation(f.workspace.token).plans[0].revision,
      1,
    );
  });
}
test('outer rollback removes nested preparation, room history and receipts; the same commands remain usable', (t) => {
  const f = fixture(t),
    plan = f.plan(),
    edit = f.edit();
  const room = structuredClone(f.store.workspace().rooms[0]);
  assert.throws(
    () =>
      f.store.db
        .transaction(() => {
          f.store.changePreparationPlan(plan);
          f.store.edit(edit);
          assert(f.receipt(plan.commandId));
          assert(f.receipt(edit.commandId));
          throw Error('abort outer transaction');
        })
        .immediate(),
    /abort outer/,
  );
  assert.equal(f.receipt(plan.commandId), undefined);
  assert.equal(f.receipt(edit.commandId), undefined);
  assert.deepEqual(f.store.workspace().rooms[0], room);
  assert.equal(f.store.preparation(f.workspace.token).plans.length, 0);
  f.store.db
    .transaction(() => {
      f.store.changePreparationPlan(plan);
      f.store.edit(edit);
    })
    .immediate();
  assert(f.receipt(plan.commandId));
  assert(f.receipt(edit.commandId));
  f.reopen();
  assert.equal(f.store.reconcile(edit, f.workspace.token).outcome, 'applied');
  assert.equal(f.store.reconcilePreparationPlan(plan, f.workspace.token).outcome, 'applied');
});
test('receipt insertion failure rolls back the room and history without consuming its command ID', (t) => {
  const f = fixture(t),
    edit = f.edit(),
    before = structuredClone(f.store.workspace());
  f.store.db.exec(
    "CREATE TEMP TRIGGER fail_receipt BEFORE INSERT ON receipt BEGIN SELECT RAISE(ABORT,'injected receipt failure'); END",
  );
  assert.throws(() => f.store.edit(edit), /injected receipt failure/);
  assert.equal(f.receipt(edit.commandId), undefined);
  assert.deepEqual(f.store.workspace(), before);
  f.store.db.exec('DROP TRIGGER fail_receipt');
  f.store.edit(edit);
  assert.equal(f.store.workspace().rooms[0].revision, 1);
});
test('malformed room metadata is rejected at the read boundary and retained byte for byte', (t) => {
  const f = fixture(t),
    id = f.store.workspace().rooms[0].id;
  // STRICT INTEGER permits integers outside JavaScript safe precision.
  f.store.db.prepare('UPDATE room SET revision=? WHERE id=?').run(9007199254740992, id);
  const before = f.store.db
    .prepare('SELECT payload,checksum,revision FROM room WHERE id=?')
    .get(id);
  const view = f.store.workspace();
  assert.equal(view.rooms.length, 0);
  assert(view.problems.length > 0);
  assert.deepEqual(
    f.store.db.prepare('SELECT payload,checksum,revision FROM room WHERE id=?').get(id),
    before,
  );
});

test('an outer rollback of the first Atlas write leaves capture usable for the same command', (t) => {
  const f = fixture(t),
    before = structuredClone(f.store.workspace().rooms);
  const command = {
    commandId: randomUUID(),
    token: f.workspace.token,
    campaignId: f.campaign.id,
    action: { kind: 'room-default' },
  };
  assert.throws(
    () =>
      f.store.db
        .transaction(() => {
          f.store.executeAtlasCommit(command);
          throw Error('abort Atlas parent');
        })
        .immediate(),
    /abort Atlas parent/,
  );
  assert.deepEqual(f.store.workspace().rooms, before);
  assert.equal(
    f.store.db.prepare('SELECT 1 FROM atlas_receipt WHERE command_id=?').get(command.commandId),
    undefined,
  );
  f.store.executeAtlasCommit(command);
  assert.equal(f.store.workspace().rooms.length, before.length + 1);
  const receipt = f.store.db
    .prepare('SELECT * FROM atlas_receipt WHERE command_id=?')
    .get(command.commandId);
  assert.equal(receipt.fingerprint, digest(command.action));
  f.reopen();
  f.store.executeAtlasCommit({ ...command, token: f.workspace.token });
  assert.equal(f.store.workspace().rooms.length, before.length + 1);
  assert.deepEqual(
    f.store.db.prepare('SELECT * FROM atlas_receipt WHERE command_id=?').get(command.commandId),
    receipt,
  );
});

test('Atlas receipt failure rolls back nested room creation and remains explicitly reconcilable', (t) => {
  const f = fixture(t),
    before = structuredClone(f.store.workspace().rooms);
  const command = {
    commandId: randomUUID(),
    token: f.workspace.token,
    campaignId: f.campaign.id,
    action: { kind: 'room-default' },
  };
  f.store.db.exec(
    "CREATE TEMP TRIGGER fail_atlas_receipt BEFORE INSERT ON atlas_receipt BEGIN SELECT RAISE(ABORT,'injected atlas receipt failure'); END",
  );
  assert.throws(() => f.store.executeAtlasCommit(command), /injected atlas receipt failure/);
  assert.deepEqual(f.store.workspace().rooms, before);
  assert.equal(f.store.reconcileAtlasCommit(command, true).outcome, 'unknown');
  assert.equal(f.store.reconcileAtlasCommit(command).outcome, 'not-applied');
  f.store.db.exec('DROP TRIGGER fail_atlas_receipt');
  f.store.executeAtlasCommit(command); // Simulate losing this successful response.
  f.reopen();
  const current = { ...command, token: f.workspace.token };
  assert.equal(f.store.reconcileAtlasCommit(current).outcome, 'applied');
  assert.equal(f.store.workspace().rooms.length, before.length + 1);
  f.store.executeAtlasCommit(current);
  assert.equal(f.store.workspace().rooms.length, before.length + 1);
});

test('unsafe Atlas revisions are rejected without rewriting the canonical root', (t) => {
  const f = fixture(t);
  f.store.db
    .prepare('UPDATE campaign_atlas SET revision=? WHERE campaign_id=?')
    .run(9007199254740992, f.campaign.id);
  const before = f.store.db
    .prepare('SELECT * FROM campaign_atlas WHERE campaign_id=?')
    .get(f.campaign.id);
  assert.throws(() => f.store.atlasOverview(f.workspace.token), /Datenbankfeld revision/);
  assert.deepEqual(
    f.store.db.prepare('SELECT * FROM campaign_atlas WHERE campaign_id=?').get(f.campaign.id),
    before,
  );
});

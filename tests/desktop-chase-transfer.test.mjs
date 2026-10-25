import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import Database from 'better-sqlite3';
import { buildSync } from './helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/chase-transfer-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/chase-transfer-store.cjs');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'chase-transfer-')),
    store = new CampaignStore(path.join(root, 'source.sqlite')),
    cam = store.create('Verfolgungsquelle'),
    w = store.activate(cam.id),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: cam.id,
      token: w.token,
      sceneId: store.live(w.token).scene?.id,
      action,
    });
  store.executeLive(
    command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
  );
  const scene = store.live(w.token).scene,
    create = {
      ...command({ kind: 'create', title: 'Flucht', goal: 'Tor' }),
      chaseId: null,
      expectedRevision: null,
    };
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { root, store, cam, w, scene, command, create };
}
test('chase create and finish replay are exact, durable and produce only one history fact', async (t) => {
  const x = fixture(t),
    created = x.store.executeChase(x.create);
  assert.deepEqual(x.store.executeChase(x.create), created);
  const p = {
      id: randomUUID(),
      name: 'Läufer',
      side: 'quarry',
      distance: 0,
      speed: 9,
      exhaustion: 0,
      notes: '',
    },
    added = x.store.executeChase({
      ...x.command({ kind: 'participant', participant: p }),
      chaseId: created.chase.id,
      expectedRevision: created.chase.revision,
    }),
    round = {
      ...x.command({
        kind: 'round',
        changes: [{ participantId: p.id, distance: 9, exhaustion: 1 }],
        complication: 'Markt',
      }),
      chaseId: created.chase.id,
      expectedRevision: added.chase.revision,
    },
    rounded = x.store.executeChase(round);
  assert.deepEqual(x.store.executeChase(round), rounded);
  assert.equal(rounded.chase.round, 1);
  const finish = {
      ...x.command({ kind: 'finish', outcome: 'Entkommen' }),
      chaseId: created.chase.id,
      expectedRevision: rounded.chase.revision,
    },
    done = x.store.executeChase(finish);
  assert.deepEqual(x.store.executeChase(finish), done);
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM chase').get().n, 1);
  assert.equal(
    x.store.db
      .prepare(
        "SELECT count(*) n FROM world_history WHERE json_extract(payload,'$.facts.chaseId')=?",
      )
      .get(done.chase.id).n,
    1,
  );
  const ref = {
      family: 'chase',
      campaignId: x.cam.id,
      commandId: finish.commandId,
      fingerprint: createHash('sha256')
        .update(JSON.stringify({ ...finish, token: undefined }))
        .digest('hex'),
    },
    fresh = new CampaignStore(path.join(x.root, 'source.sqlite'));
  try {
    const w = fresh.activate(x.cam.id);
    assert.deepEqual(fresh.commitStatus(ref, w.token), { outcome: 'applied', value: done });
    assert.deepEqual(fresh.executeChase({ ...finish, token: w.token }), done);
  } finally {
    fresh.close();
  }
});
for (const legacy of ['no chase tables', 'no receipts'])
  test(`legacy schema 38 package with ${legacy} is rejected without rewriting its bytes`, async (t) => {
    const x = fixture(t);
    if (legacy === 'no receipts') x.store.executeChase(x.create);
    const filename = path.join(x.root, 'legacy.sqlite');
    await x.store.campaignSnapshot(x.w.token, filename);
    const db = new Database(filename);
    db.exec('DROP TABLE chase_receipt');
    if (legacy === 'no chase tables') db.exec('DROP TABLE chase');
    db.pragma('user_version=38');
    db.close();
    const before = readFileSync(filename);
    assert.throws(() => x.store.campaignPreview(filename), /alten Testformat/);
    assert.throws(
      () => x.store.acceptCampaignSnapshot(filename, 'Altkopie', {}),
      /alten Testformat/,
    );
    assert.ok(readFileSync(filename).equals(before));
  });
test('independent chase copy remaps its finished history link and retains free outcome prose', async (t) => {
  const x = fixture(t),
    created = x.store.executeChase(x.create),
    done = x.store.executeChase({
      ...x.command({ kind: 'finish', outcome: 'Original ' + created.chase.id }),
      chaseId: created.chase.id,
      expectedRevision: created.chase.revision,
    }),
    filename = path.join(x.root, 'copy.sqlite');
  await x.store.campaignSnapshot(x.w.token, filename);
  const before = readFileSync(filename),
    target = new CampaignStore(path.join(x.root, 'target.sqlite'));
  try {
    const copy = target.acceptCampaignSnapshot(filename, 'Kopie', {}),
      row = target.db.prepare('SELECT * FROM chase WHERE campaign_id=?').get(copy.id),
      fact = target.db
        .prepare(
          "SELECT payload FROM world_history WHERE campaign_id=? AND json_extract(payload,'$.facts.chaseId') IS NOT NULL",
        )
        .get(copy.id);
    assert.notEqual(row.id, done.chase.id);
    assert.equal(JSON.parse(fact.payload).facts.chaseId, row.id);
    assert.equal(JSON.parse(row.payload).outcome, 'Original ' + created.chase.id);
    assert.ok(readFileSync(filename).equals(before));
    await target.backup(path.join(x.root, 'copy-safe.sqlite'));
  } finally {
    target.close();
  }
});

test('a package with a deleted chase cannot disguise a dangling finished-history link as legacy absence', async (t) => {
  const x = fixture(t),
    created = x.store.executeChase(x.create);
  x.store.executeChase({
    ...x.command({ kind: 'finish', outcome: 'Entkommen' }),
    chaseId: created.chase.id,
    expectedRevision: created.chase.revision,
  });
  const filename = path.join(x.root, 'dangling.sqlite');
  await x.store.campaignSnapshot(x.w.token, filename);
  const db = new Database(filename);
  db.exec('DROP TABLE chase_receipt; DROP TABLE chase');
  db.close();
  const original = readFileSync(filename);
  assert.throws(() => x.store.campaignPreview(filename));
  assert.ok(readFileSync(filename).equals(original));
});

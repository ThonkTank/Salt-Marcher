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
  outfile: '.build/autonomy-interval-integrity.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)(
    '../../.build/autonomy-interval-integrity.cjs',
  ),
  hash = (s) => createHash('sha256').update(s).digest('hex');
function fixture(t, confirm = true) {
  const root = mkdtempSync(path.join(tmpdir(), 'autonomy-interval-')),
    filename = path.join(root, 'store.sqlite'),
    x = { root, filename, store: new CampaignStore(filename) };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  x.cam = x.store.create('Zeitbasis');
  x.w = x.store.activate(x.cam.id);
  x.command = (action) => ({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    action,
  });
  x.npc = {
    version: 1,
    id: randomUUID(),
    revision: 1,
    kind: 'npc',
    title: 'Wache',
    readAloud: '',
    gmNotes: '',
    relations: [],
    creatureId: null,
    deleted: false,
  };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note', note: x.npc, expectedRevision: null },
  });
  x.job = {
    id: randomUUID(),
    revision: 0,
    name: 'Wache halten',
    kind: 'guard',
    locationId: null,
    routeId: null,
    targetActorId: null,
    roles: [],
    priority: 10,
    durationSeconds: 10,
    exclusive: false,
    enabled: true,
    needEffects: { hunger: 1 },
    maxDamage: 0,
  };
  x.store.executeAutonomy(x.command({ kind: 'job', job: x.job, expectedRevision: null }));
  x.job.revision = 1;
  x.store.executeAutonomy(
    x.command({
      kind: 'actor',
      actor: {
        id: x.npc.id,
        revision: 0,
        enabled: true,
        paused: false,
        role: '',
        needs: [
          { id: 'hunger', name: 'Hunger', enabled: true, value: 0, ratePerHour: 4, weight: 1 },
        ],
        jobPriorities: {},
        assignedJobId: null,
        allowConflict: false,
        defense: 12,
        attackBonus: 0,
        maxHpLossPercent: 10,
        cursor: 0,
        offsetSeconds: 0,
        jobId: null,
        progressSeconds: 0,
        pending: null,
      },
      expectedRevision: null,
      initialLocationId: null,
    }),
  );
  const scene = x.store.executeLive(
    x.command({ kind: 'initialize', expectedRosterRevision: 0 }),
  ).scene;
  x.advance = () => {
    const current = x.store.live(x.w.token).scene;
    x.store.executeLive(
      x.command({
        kind: 'advance-clock',
        sceneId: scene.id,
        expectedRevision: current.clock.revision,
        amount: 60,
        unit: 'seconds',
        calendarVersion: 'relative-v1',
        reason: 'Bestätigter Zeitraum',
      }),
    );
  };
  if (confirm) x.advance();
  x.catchUp = () =>
    x.store.executeAutonomy(x.command({ kind: 'catch-up', actorIds: [x.npc.id], maxSteps: 12 }));
  x.row = () => x.store.db.prepare('SELECT * FROM autonomy_interval').get();
  x.mutate = (fn) => {
    const row = x.row(),
      basis = JSON.parse(row.payload);
    fn(basis);
    const payload = JSON.stringify(basis);
    x.store.db
      .prepare('UPDATE autonomy_interval SET payload=?,checksum=? WHERE id=?')
      .run(payload, hash(payload), row.id);
  };
  return x;
}
// Catch-up and validateAutonomy share checkedIntervalRow. Keep each corruption
// there; one representative also exercises both distinct backup/export writers.
for (const [damage, copies = false] of [
  ['invalid job controls', true],
  ['duplicate historical jobs'],
  ['reversed time'],
])
  test(`historical interval rejects ${damage} in catch-up${copies ? ', backup and export without replacing safe bytes' : ''}`, async (t) => {
    const x = fixture(t, false),
      backup = path.join(x.root, 'safe.sqlite'),
      file = path.join(x.root, 'campaign.sqlite');
    let backupBytes, fileBytes;
    // Retain the older-checkpoint protection from the duplicate core test.
    if (copies) {
      await x.store.backup(backup);
      await x.store.campaignSnapshot(x.w.token, file);
      backupBytes = readFileSync(backup);
      fileBytes = readFileSync(file);
    }
    x.advance();
    if (damage === 'invalid job controls')
      x.mutate((b) => {
        b.jobs[0].enabled = 'false';
      });
    if (damage === 'duplicate historical jobs')
      x.mutate((b) => {
        b.jobs.push(structuredClone(b.jobs[0]));
      });
    if (damage === 'reversed time')
      x.store.db.prepare('UPDATE autonomy_interval SET from_ms=to_ms,to_ms=from_ms').run();
    const error = damage === 'invalid job controls' ? /Autonomie-Job/ : /Autonomie-Intervall/;
    const bytes = x.store.db.serialize();
    assert.throws(x.catchUp, error);
    assert.ok(
      x.store.db.serialize().equals(bytes),
      'Catch-up failure must roll back actors, logs, reservations and receipts',
    );
    if (copies) {
      await assert.rejects(x.store.backup(backup), error);
      await assert.rejects(x.store.campaignSnapshot(x.w.token, file), error);
      assert.ok(backupBytes.equals(readFileSync(backup)));
      assert.ok(fileBytes.equals(readFileSync(file)));
      assert.ok(x.store.db.serialize().equals(bytes));
    }
  });
test('valid historical jobs remain unchanged when current job revisions change and survive Fresh', async (t) => {
  const x = fixture(t),
    before = x.row();
  x.store.executeAutonomy(
    x.command({
      kind: 'job',
      job: { ...x.job, name: 'Neue Wache', durationSeconds: 20 },
      expectedRevision: 1,
    }),
  );
  x.catchUp();
  const after = x.row();
  assert.equal(after.payload, before.payload);
  assert.equal(after.checksum, before.checksum);
  assert.equal(x.store.autonomy(x.w.token).actors[0].paused, true);
  await x.store.backup(path.join(x.root, 'safe.sqlite'));
  x.store.close();
  x.store = new CampaignStore(x.filename);
  x.w = x.store.activate(x.cam.id);
  assert.equal(x.row().payload, before.payload);
});

test('owner failure after the first Actor move rolls back both Actors, logs, bookings and command receipt', (t) => {
  const x = fixture(t, false),
    locations = ['A', 'B'].map((name) => {
      const document = {
        kind: 'location',
        version: 1,
        id: randomUUID(),
        name,
        type: 'poi',
        sections: [],
        detailMaps: [],
        keyLinks: [],
      };
      x.store.changePreparation({
        ...x.command(null),
        change: { kind: 'location', document, expectedRevision: null },
      });
      return document.id;
    });
  x.store.executeAutonomy(
    x.command({
      kind: 'place',
      actorId: x.npc.id,
      locationId: locations[0],
      expectedPositionRevision: null,
      reason: 'Vorbereiteter Worldort',
    }),
  );
  const note = { ...x.npc, id: randomUUID(), title: 'Zweite Wache' };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note', note, expectedRevision: null },
  });
  const config = x.store.autonomy(x.w.token).actors[0];
  x.store.executeAutonomy(
    x.command({
      kind: 'actor',
      actor: { ...config, id: note.id, revision: 0 },
      expectedRevision: null,
      initialLocationId: locations[0],
    }),
  );
  x.store.executeAutonomy(
    x.command({
      kind: 'route',
      route: {
        id: randomUUID(),
        revision: 0,
        name: 'A nach B',
        fromLocationId: locations[0],
        toLocationId: locations[1],
        durationSeconds: 10,
        enabled: true,
      },
      expectedRevision: null,
    }),
  );
  x.store.executeAutonomy(
    x.command({
      kind: 'job',
      job: { ...x.job, kind: 'move', locationId: locations[1], durationSeconds: 5 },
      expectedRevision: 1,
    }),
  );
  x.advance();
  const ids = [x.npc.id, note.id].sort(),
    command = x.command({ kind: 'catch-up', actorIds: ids, maxSteps: 12 });
  // The second Owner refuses its movement after the first Actor has moved.
  x.store.db.exec(
    `CREATE TRIGGER refuse_second_owner BEFORE UPDATE ON npc_position WHEN NEW.actor_id='${ids[1]}' BEGIN SELECT RAISE(ABORT,'second owner failure'); END`,
  );
  const bytes = x.store.db.serialize();
  assert.throws(() => x.store.executeAutonomy(command), /second owner failure/);
  assert.ok(
    x.store.db.serialize().equals(bytes),
    'No partial Owner, Actor, log, booking or receipt state',
  );
  x.store.db.exec('DROP TRIGGER refuse_second_owner');
  x.store.executeAutonomy(command);
  const committed = x.store.db.serialize();
  x.store.executeAutonomy(command);
  assert.ok(x.store.db.serialize().equals(committed), 'Replay does not run effects twice');
  for (const id of ids)
    assert.equal(
      x.store.db
        .prepare('SELECT location_id FROM npc_position WHERE campaign_id=? AND actor_id=?')
        .get(x.cam.id, id).location_id,
      locations[1],
    );
});
test('historical interval identities survive independent import without rewriting the source package', async (t) => {
  const x = fixture(t),
    file = path.join(x.root, 'campaign.sqlite'),
    original = JSON.parse(x.row().payload);
  await x.store.campaignSnapshot(x.w.token, file);
  const bytes = readFileSync(file),
    copy = x.store.acceptCampaignSnapshot(file, 'Kopie', {}),
    w = x.store.activate(copy.id);
  const row = x.store.db
      .prepare('SELECT * FROM autonomy_interval WHERE campaign_id=?')
      .get(copy.id),
    basis = JSON.parse(row.payload),
    actor = x.store.autonomy(w.token).actors[0],
    job = x.store.autonomy(w.token).jobs[0];
  assert.notEqual(actor.id, x.npc.id);
  assert.notEqual(job.id, x.job.id);
  assert.equal(basis.actors[0].id, actor.id);
  assert.equal(basis.jobs[0].id, job.id);
  assert.equal(basis.jobs[0].name, original.jobs[0].name);
  x.store.executeAutonomy({
    commandId: randomUUID(),
    campaignId: copy.id,
    token: w.token,
    action: { kind: 'catch-up', actorIds: [actor.id], maxSteps: 12 },
  });
  assert.equal(x.store.autonomy(w.token).actors[0].cursor, row.ordinal);
  assert.ok(bytes.equals(readFileSync(file)));
  await x.store.backup(path.join(x.root, 'safe.sqlite'));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
mkdirSync('.build/autonomy-disable-time/catalog', { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  '.build/autonomy-disable-time/catalog/srd-5.1.generated.json',
);
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {standardNeeds} from './src/app/autonomy-contracts';export {newLocation} from './src/features/location/location-schema';",
    resolveDir: process.cwd(),
    sourcefile: 'autonomy-disable-time-review.ts',
    loader: 'ts',
  },
  outfile: '.build/autonomy-disable-time/store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, standardNeeds, newLocation } = createRequire(import.meta.url)(
  '../.build/autonomy-disable-time/store.cjs',
);
function fixture(t, companion = false) {
  const root = mkdtempSync(path.join(tmpdir(), 'autonomy-disable-time-')),
    filename = path.join(root, 'store.sqlite'),
    x = { root, filename, store: new CampaignStore(filename) };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  x.cam = x.store.create('Bestätigte Aktivierungszeiten');
  x.w = x.store.activate(x.cam.id);
  x.command = (action) => ({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    action,
  });
  x.place = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'location',
      expectedRevision: null,
      document: newLocation(x.place, 'Wachort', 'poi', [randomUUID(), randomUUID()]),
    },
  });
  x.add = (name) => {
    const id = randomUUID();
    x.store.changePreparation({
      ...x.command(null),
      change: {
        kind: 'note',
        expectedRevision: null,
        note: {
          version: 1,
          id,
          revision: 1,
          kind: 'npc',
          title: name,
          readAloud: '',
          gmNotes: '',
          relations: [],
          creatureId: null,
          deleted: false,
        },
      },
    });
    const actor = {
      id,
      revision: 0,
      enabled: true,
      paused: false,
      role: '',
      needs: standardNeeds(),
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
    };
    x.store.executeAutonomy(
      x.command({ kind: 'actor', actor, expectedRevision: null, initialLocationId: x.place }),
    );
    return id;
  };
  x.id = x.add('Eigene Wache');
  if (companion) x.other = x.add('Unabhängiger Begleiter');
  x.scene = x.store.executeLive(x.command({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
  x.store.executeLive(
    x.command({
      kind: 'scene-content',
      sceneId: x.scene.id,
      expectedRevision: 0,
      title: 'Wachort',
      notes: '',
      readAloud: '',
      locationId: x.place,
    }),
  );
  x.current = () => x.store.autonomy(x.w.token).actors.find((a) => a.id === x.id);
  x.toggle = (enabled) => {
    const actor = x.current();
    return x.store.executeAutonomy(
      x.command({
        kind: 'actor',
        actor: { ...actor, enabled },
        expectedRevision: actor.revision,
        initialLocationId: null,
      }),
    );
  };
  x.advance = (revision, seconds) =>
    x.store.executeLive(
      x.command({
        kind: 'advance-clock',
        sceneId: x.scene.id,
        expectedRevision: revision,
        amount: seconds,
        unit: 'seconds',
        calendarVersion: 'relative-v1',
        reason: 'Bestätigte Zeit',
      }),
    );
  x.catchup = () =>
    x.store.executeAutonomy(x.command({ kind: 'catch-up', actorIds: [x.id], maxSteps: 24 }));
  x.reopen = () => {
    x.store.close();
    x.store = new CampaignStore(filename);
    x.w = x.store.activate(x.cam.id);
  };
  return x;
}
for (const companion of [false, true])
  test(`disabled autonomy time is never retroactively simulated after Fresh, companion=${companion}`, (t) => {
    const x = fixture(t, companion);
    x.advance(0, 60);
    x.catchup();
    const before = x.current().needs.find((n) => n.id === 'hunger').value;
    x.toggle(false);
    x.advance(1, 3600);
    assert.equal(x.current().needs.find((n) => n.id === 'hunger').value, before);
    x.reopen();
    x.toggle(true);
    x.advance(2, 60);
    x.catchup();
    const actual = x.current().needs.find((n) => n.id === 'hunger').value;
    assert.ok(
      Math.abs(actual - (4 * 120) / 3600) < 1e-9,
      `only 120 enabled seconds count, got hunger ${actual}`,
    );
  });
test('a clock-only frontier survives export and independent copy without inventing disabled actor intervals', async (t) => {
  const x = fixture(t);
  x.advance(0, 60);
  x.catchup();
  x.toggle(false);
  const count = x.store.db
    .prepare('SELECT count(*) n FROM autonomy_interval WHERE campaign_id=?')
    .get(x.cam.id).n;
  x.advance(1, 3600);
  assert.equal(
    x.store.db.prepare('SELECT count(*) n FROM autonomy_interval WHERE campaign_id=?').get(x.cam.id)
      .n,
    count,
  );
  const file = path.join(x.root, 'disabled.sqlite');
  await x.store.campaignSnapshot(x.w.token, file);
  const bytes = readFileSync(file),
    copy = x.store.acceptCampaignSnapshot(file, 'Unabhängig', {});
  x.cam = copy;
  x.w = x.store.activate(copy.id);
  x.id = x.store.autonomy(x.w.token).actors[0].id;
  x.scene = x.store.live(x.w.token).scene;
  x.toggle(true);
  x.advance(2, 60);
  x.catchup();
  const actual = x.current().needs.find((n) => n.id === 'hunger').value;
  assert.ok(
    Math.abs(actual - (4 * 120) / 3600) < 1e-9,
    `copied enabled time only, got hunger ${actual}`,
  );
  assert.ok(readFileSync(file).equals(bytes));
});

test('independent copy retains standard and custom need keys and completed job effects after Fresh', async (t) => {
  const x = fixture(t),
    actor = x.current(),
    needs = actor.needs.map((n) => ({ ...n, value: n.id === 'hunger' ? 50 : n.value }));
  needs.push({
    id: 'resolve',
    name: 'Entschlossenheit',
    enabled: true,
    value: 30,
    ratePerHour: 0,
    weight: 1,
  });
  x.store.executeAutonomy(
    x.command({
      kind: 'actor',
      actor: { ...actor, needs },
      expectedRevision: actor.revision,
      initialLocationId: null,
    }),
  );
  const job = {
    id: randomUUID(),
    revision: 0,
    name: 'Wache halten',
    kind: 'guard',
    locationId: null,
    routeId: null,
    targetActorId: null,
    roles: [],
    priority: 100,
    durationSeconds: 600,
    exclusive: true,
    enabled: true,
    needEffects: { hunger: 1, resolve: 2 },
    maxDamage: 0,
  };
  x.store.executeAutonomy(x.command({ kind: 'job', job, expectedRevision: null }));
  x.advance(0, 60);
  x.catchup();
  assert.equal(x.current().progressSeconds, 60);
  const source = x.current(),
    historical = JSON.parse(
      x.store.db
        .prepare(
          'SELECT payload FROM autonomy_interval WHERE campaign_id=? ORDER BY ordinal LIMIT 1',
        )
        .get(x.cam.id).payload,
    ),
    file = path.join(x.root, 'needs.sqlite');
  await x.store.campaignSnapshot(x.w.token, file);
  const bytes = readFileSync(file),
    copy = x.store.acceptCampaignSnapshot(file, 'Bedürfniskopie', {});
  x.cam = copy;
  x.w = x.store.activate(copy.id);
  x.id = x.store.autonomy(x.w.token).actors[0].id;
  x.scene = x.store.live(x.w.token).scene;
  x.reopen();
  assert.notEqual(x.id, source.id);
  assert.deepEqual(x.current().needs, source.needs);
  assert.deepEqual(x.store.autonomy(x.w.token).jobs[0].needEffects, job.needEffects);
  const copied = JSON.parse(
    x.store.db
      .prepare('SELECT payload FROM autonomy_interval WHERE campaign_id=? ORDER BY ordinal LIMIT 1')
      .get(x.cam.id).payload,
  );
  assert.deepEqual(copied.actors[0].needs, historical.actors[0].needs);
  assert.notEqual(copied.actors[0].id, historical.actors[0].id);
  x.advance(1, 540);
  x.catchup();
  const final = x.current();
  assert.ok(
    Math.abs(final.needs.find((n) => n.id === 'hunger').value - (50 + (4 * 600) / 3600 - 1)) < 1e-9,
  );
  assert.equal(final.needs.find((n) => n.id === 'resolve').value, 28);
  assert.ok(readFileSync(file).equals(bytes));
});

for (const field of ['actor_id', 'job_id'])
  test(`a booking with a missing ${field} cannot be backed up, exported or used for catch-up`, async (t) => {
    const x = fixture(t),
      job = {
        id: randomUUID(),
        revision: 0,
        name: 'Reservierte Wache',
        kind: 'guard',
        locationId: null,
        routeId: null,
        targetActorId: null,
        roles: [],
        priority: 100,
        durationSeconds: 600,
        exclusive: true,
        enabled: true,
        needEffects: { hunger: 1 },
        maxDamage: 0,
      };
    x.store.executeAutonomy(x.command({ kind: 'job', job, expectedRevision: null }));
    x.advance(0, 60);
    x.catchup();
    const row = x.store.db
      .prepare('SELECT * FROM autonomy_booking WHERE campaign_id=?')
      .get(x.cam.id);
    assert.ok(row, 'a real committed exclusive booking');
    const safe = path.join(x.root, 'safe.sqlite');
    await x.store.backup(safe);
    const bytes = readFileSync(safe);
    x.store.db.pragma('foreign_keys=OFF');
    x.store.db
      .prepare(`UPDATE autonomy_booking SET ${field}=? WHERE campaign_id=? AND id=?`)
      .run(randomUUID(), x.cam.id, row.id);
    x.store.db.pragma('foreign_keys=ON');
    const before = x.store.db.serialize();
    assert.throws(() => x.catchup(), /Buchung/);
    assert.ok(x.store.db.serialize().equals(before));
    await assert.rejects(x.store.backup(safe), /Buchung|strukturell beschädigt/);
    assert.ok(readFileSync(safe).equals(bytes));
    await assert.rejects(
      x.store.campaignSnapshot(x.w.token, path.join(x.root, 'bad.sqlite')),
      /Buchung|strukturell beschädigt/,
    );
    assert.ok(x.store.db.serialize().equals(before));
  });

test('disabling a prepared group releases its active reservation and preserves resumable job progress', async (t) => {
  const x = fixture(t);
  x.toggle(false);
  const created = x.store.executeProgress(
      x.command({
        kind: 'group-create',
        title: 'Eigene Wache',
        encounterId: null,
        expectedEncounterRevision: null,
      }),
    ),
    view = x.store.groupView(x.w.token, created.groupId);
  const draft = {
    writeId: randomUUID(),
    groupId: view.id,
    revision: view.revision,
    title: view.title,
    notes: view.notes,
    locationId: null,
    actors: [
      {
        id: null,
        creatureId: 'goblin',
        revision: 0,
        profileRevision: 0,
        name: 'Goblinwache',
        hp: '7',
        maxHp: '7',
        tempHp: '0',
        conditions: '',
        concentrating: false,
        gmNotes: '',
        readAloud: '',
      },
    ],
  };
  x.store.keepGroupDraft(x.w.token, draft, null);
  x.store.executeProgress(
    x.command({ kind: 'group-edit', groupId: view.id, expectedRevision: view.revision, draft }),
  );
  const group = x.store.groupView(x.w.token, view.id);
  x.id = group.actors[0].id;
  const before = x.store.db.serialize();
  assert.throws(
    () =>
      x.store.executeAutonomy(
        x.command({
          kind: 'group-enable',
          groupId: group.id,
          expectedRevision: group.revision - 1,
          enabled: true,
        }),
      ),
    /Gruppe geändert/,
  );
  assert.ok(x.store.db.serialize().equals(before));
  x.store.executeAutonomy(
    x.command({
      kind: 'group-enable',
      groupId: group.id,
      expectedRevision: group.revision,
      enabled: true,
    }),
  );
  const audit = x.store
    .autonomy(x.w.token)
    .logs.find((entry) => entry.actorId === x.id && entry.facts?.groupId === group.id);
  assert.deepEqual(audit.facts, {
    groupId: group.id,
    groupRevision: group.revision,
    enabled: true,
  });
  const job = {
    id: randomUUID(),
    revision: 0,
    name: 'Exklusive Gruppenwache',
    kind: 'guard',
    locationId: null,
    routeId: null,
    targetActorId: null,
    roles: [],
    priority: 100,
    durationSeconds: 600,
    exclusive: true,
    enabled: true,
    needEffects: { hunger: 1 },
    maxDamage: 0,
  };
  x.store.executeAutonomy(x.command({ kind: 'job', job, expectedRevision: null }));
  x.advance(0, 60);
  x.catchup();
  assert.equal(x.current().progressSeconds, 60);
  assert.equal(
    x.store.db
      .prepare('SELECT count(*) n FROM autonomy_reservation WHERE campaign_id=? AND actor_id=?')
      .get(x.cam.id, x.id).n,
    1,
  );
  x.store.executeAutonomy(
    x.command({
      kind: 'group-enable',
      groupId: group.id,
      expectedRevision: group.revision,
      enabled: false,
    }),
  );
  const safe = path.join(x.root, 'disabled-group.sqlite');
  await x.store.backup(safe);
  assert.equal(x.current().enabled, false);
  assert.equal(x.current().progressSeconds, 60);
  assert.equal(
    x.store.db
      .prepare('SELECT count(*) n FROM autonomy_reservation WHERE campaign_id=? AND actor_id=?')
      .get(x.cam.id, x.id).n,
    0,
  );
  x.reopen();
  assert.equal(x.current().enabled, false);
  assert.equal(x.current().progressSeconds, 60);
  x.catchup();
  x.store.executeAutonomy(
    x.command({
      kind: 'group-enable',
      groupId: group.id,
      expectedRevision: group.revision,
      enabled: true,
    }),
  );
  x.advance(1, 60);
  x.catchup();
  assert.equal(x.current().jobId, job.id);
  assert.equal(x.current().progressSeconds, 120);
  assert.equal(
    x.store.db
      .prepare('SELECT actor_id FROM autonomy_reservation WHERE campaign_id=? AND job_id=?')
      .get(x.cam.id, job.id).actor_id,
    x.id,
  );
  await x.store.backup(path.join(x.root, 'resumed-group.sqlite'));
});

function timedPartyRest(x) {
  const c = x.store.executeLive(
      x.command({ kind: 'create-character', profile: { name: 'Rastende Figur' } }),
    ).character,
    live = x.store.live(x.w.token);
  x.store.executeLive(
    x.command({
      kind: 'membership',
      characterId: c.id,
      expectedRevision: c.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      active: true,
      targetSceneId: live.scene.id,
      expectedFocusRevision: live.focusRevision,
    }),
  );
  x.store.executeProgress(
    x.command({
      kind: 'xp',
      characterId: c.id,
      expectedRevision: 0,
      mode: 'set',
      amount: 900,
      reason: 'Bestätigte XP',
    }),
  );
  const state = x.store.live(x.w.token),
    progress = x.store.progress(x.w.token).characters.find((p) => p.characterId === c.id);
  return x.command({
    kind: 'rest',
    rest: 'short',
    recipients: [{ characterId: c.id, revision: progress.revision }],
    scene: {
      id: state.scene.id,
      expectedMembershipRevision: state.scene.membershipRevision,
      expectedClockRevision: state.scene.clock.revision,
      expectedFocusRevision: state.focusRevision,
      amount: 1,
      unit: 'hours',
    },
  });
}
test('timed party rest advances enabled autonomy exactly once after an inactive hour and Fresh', (t) => {
  const x = fixture(t);
  x.advance(0, 60);
  x.catchup();
  x.toggle(false);
  x.advance(1, 3600);
  x.toggle(true);
  const command = timedPartyRest(x),
    ack = x.store.executeProgress(command);
  assert.equal(ack.restScene.clock.instantMs, '7260000');
  assert.ok(
    Math.abs(x.current().needs.find((n) => n.id === 'hunger').value - (4 * 3660) / 3600) < 1e-9,
  );
  x.reopen();
  const before = x.store.db.serialize();
  assert.deepEqual(
    x.store.executeProgress({ ...command, token: x.w.token }),
    JSON.parse(JSON.stringify(ack)),
  );
  assert.ok(x.store.db.serialize().equals(before));
});
test('autonomy rejection rolls back party rest, confirmed scene time and both receipts', (t) => {
  const x = fixture(t),
    job = {
      id: randomUUID(),
      revision: 0,
      name: 'Atomare Rastwache',
      kind: 'guard',
      locationId: null,
      routeId: null,
      targetActorId: null,
      roles: [],
      priority: 100,
      durationSeconds: 600,
      exclusive: true,
      enabled: true,
      needEffects: { hunger: 1 },
      maxDamage: 0,
    };
  x.store.executeAutonomy(x.command({ kind: 'job', job, expectedRevision: null }));
  x.advance(0, 60);
  x.catchup();
  const command = timedPartyRest(x),
    row = x.store.db.prepare('SELECT * FROM autonomy_booking WHERE campaign_id=?').get(x.cam.id);
  assert.ok(row);
  x.store.db.pragma('foreign_keys=OFF');
  x.store.db
    .prepare('UPDATE autonomy_booking SET actor_id=? WHERE campaign_id=? AND id=?')
    .run(randomUUID(), x.cam.id, row.id);
  x.store.db.pragma('foreign_keys=ON');
  const before = x.store.db.serialize();
  assert.throws(() => x.store.executeProgress(command), /Buchung/);
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(
    x.store.db
      .prepare('SELECT count(*) n FROM progress_receipt WHERE command_id=?')
      .get(command.commandId).n,
    0,
  );
  assert.equal(
    x.store.db
      .prepare('SELECT count(*) n FROM live_receipt WHERE command_id=?')
      .get(command.commandId + '|rest-clock').n,
    0,
  );
});

for (const distinct of [false, true])
  for (const mode of ['disable', 'pause', 'cancel'])
    test(`exclusive future bookings are released on ${mode}, distinct target job=${distinct}, while completed history and explicit job state survive Fresh`, async (t) => {
      const x = fixture(t, true),
        job = {
          id: randomUUID(),
          revision: 0,
          name: 'Geteilte Exklusivwache',
          kind: 'guard',
          locationId: x.place,
          routeId: null,
          targetActorId: null,
          roles: distinct ? ['owner'] : [],
          priority: 100,
          durationSeconds: 600,
          exclusive: true,
          enabled: true,
          needEffects: {},
          maxDamage: 0,
        };
      const companion = x.store.autonomy(x.w.token).actors.find((a) => a.id === x.other);
      x.store.executeAutonomy(
        x.command({
          kind: 'actor',
          actor: { ...companion, enabled: false, role: 'other' },
          expectedRevision: companion.revision,
          initialLocationId: null,
        }),
      );
      const a = x.current();
      x.store.executeAutonomy(
        x.command({
          kind: 'actor',
          actor: { ...a, role: 'owner', jobPriorities: { [job.id]: 100 } },
          expectedRevision: a.revision,
          initialLocationId: null,
        }),
      );
      const otherJob = distinct
        ? { ...job, id: randomUUID(), name: 'Andere Aufgabe am selben Ort', roles: ['other'] }
        : job;
      x.store.executeAutonomy(x.command({ kind: 'job', job, expectedRevision: null }));
      if (distinct)
        x.store.executeAutonomy(x.command({ kind: 'job', job: otherJob, expectedRevision: null }));
      x.advance(0, 60);
      x.catchup();
      assert.equal(x.current().progressSeconds, 60);
      const owner = x.id,
        actor = x.current();
      if (mode === 'disable') x.toggle(false);
      else if (mode === 'cancel')
        x.store.executeAutonomy(
          x.command({
            kind: 'assign',
            actorId: owner,
            expectedRevision: actor.revision,
            jobId: null,
          }),
        );
      else
        x.store.executeAutonomy(
          x.command({
            kind: 'pause',
            actorId: owner,
            expectedRevision: actor.revision,
            paused: true,
          }),
        );
      const booking = x.store.db
        .prepare('SELECT * FROM autonomy_booking WHERE campaign_id=? AND actor_id=?')
        .get(x.cam.id, owner);
      assert.equal(BigInt(booking.to_ms), 60000n, 'retain only actually completed booking time');
      assert.equal(
        BigInt(
          x.store.db
            .prepare('SELECT to_ms FROM autonomy_target_booking WHERE campaign_id=? AND actor_id=?')
            .get(x.cam.id, owner).to_ms,
        ),
        60000n,
      );
      await x.store.backup(path.join(x.root, 'released.sqlite'));
      x.reopen();
      assert.equal(x.current().progressSeconds, mode === 'cancel' ? 0 : 60);
      if (mode === 'cancel') x.toggle(false);
      const next = x.store.autonomy(x.w.token).actors.find((a) => a.id === x.other);
      x.store.executeAutonomy(
        x.command({
          kind: 'actor',
          actor: { ...next, enabled: true },
          expectedRevision: next.revision,
          initialLocationId: null,
        }),
      );
      x.advance(1, 60);
      x.store.executeAutonomy(x.command({ kind: 'catch-up', actorIds: [x.other], maxSteps: 24 }));
      const other = x.store.autonomy(x.w.token).actors.find((a) => a.id === x.other);
      assert.equal(other.jobId, otherJob.id, 'another actor can use the released future slot');
      assert.equal(other.progressSeconds, 60);
    });
for (const mode of ['disable', 'pause'])
  test(`exclusive ${mode} and resume rebook remaining duration after Fresh`, async (t) => {
    const x = fixture(t),
      job = {
        id: randomUUID(),
        revision: 0,
        name: 'Fortsetzbare Wache',
        kind: 'guard',
        locationId: null,
        routeId: null,
        targetActorId: null,
        roles: [],
        priority: 100,
        durationSeconds: 600,
        exclusive: true,
        enabled: true,
        needEffects: {},
        maxDamage: 0,
      };
    x.store.executeAutonomy(x.command({ kind: 'job', job, expectedRevision: null }));
    x.advance(0, 60);
    x.catchup();
    const actor = x.current();
    if (mode === 'disable') x.toggle(false);
    else
      x.store.executeAutonomy(
        x.command({ kind: 'pause', actorId: x.id, expectedRevision: actor.revision, paused: true }),
      );
    if (mode === 'disable') x.advance(1, 3600);
    x.reopen();
    if (mode === 'disable') x.toggle(true);
    else
      x.store.executeAutonomy(
        x.command({
          kind: 'pause',
          actorId: x.id,
          expectedRevision: x.current().revision,
          paused: false,
        }),
      );
    x.advance(mode === 'disable' ? 2 : 1, 60);
    x.catchup();
    assert.equal(x.current().jobId, job.id);
    assert.equal(x.current().progressSeconds, 120);
    assert.equal(
      x.store.db
        .prepare('SELECT actor_id FROM autonomy_reservation WHERE campaign_id=? AND job_id=?')
        .get(x.cam.id, job.id).actor_id,
      x.id,
    );
    assert.ok(
      x.store.db
        .prepare(
          'SELECT 1 FROM autonomy_booking WHERE campaign_id=? AND actor_id=? AND from_ms<=? AND to_ms>=?',
        )
        .get(
          x.cam.id,
          x.id,
          (mode === 'disable' ? '3660000' : '60000').padStart(30, '0'),
          (mode === 'disable' ? '4200000' : '600000').padStart(30, '0'),
        ),
      'remaining duration must be booked again',
    );
    await x.store.backup(path.join(x.root, 'resumed.sqlite'));
  });

function earlierScene(x) {
  const primary = x.store.live(x.w.token).scene.id,
    heroes = [];
  for (const name of ['Ada', 'Borin']) {
    const c = x.store.executeLive(
        x.command({ kind: 'create-character', profile: { name } }),
      ).character,
      v = x.store.live(x.w.token);
    heroes.push(c.id);
    x.store.executeLive(
      x.command({
        kind: 'membership',
        characterId: c.id,
        expectedRevision: c.membershipRevision,
        expectedRosterRevision: v.rosterRevision,
        active: true,
        targetSceneId: primary,
        expectedFocusRevision: v.focusRevision,
      }),
    );
  }
  const v = x.store.live(x.w.token),
    split = x.store.executeLive(
      x.command({
        kind: 'move',
        sceneId: primary,
        expectedRosterRevision: v.rosterRevision,
        expectedFocusRevision: v.focusRevision,
        expectedClockRevision: v.scene.clock.revision,
        expectedSceneMembershipRevision: v.scene.membershipRevision,
        memberIds: [heroes[1]],
        target: { kind: 'new', title: 'Frühere Gruppe', expectedContentRevision: v.scene.revision },
      }),
    ),
    secondary = split.session.createdScene.id,
    s = x.store.liveScene(x.w.token, secondary);
  x.store.executeLive(
    x.command({
      kind: 'scene-content',
      sceneId: secondary,
      expectedRevision: s.revision,
      title: s.title,
      notes: s.notes,
      readAloud: s.readAloud ?? '',
      locationId: x.place,
    }),
  );
  return { primary, secondary };
}

for (const distinct of [false, true])
  test(`a scene-time conflict releases only future exclusive bookings after Fresh, distinct target job=${distinct}`, async (t) => {
    const x = fixture(t, true);
    for (const [id, role, enabled] of [
      [x.id, 'owner', true],
      [x.other, 'other', false],
    ]) {
      const a = x.store.autonomy(x.w.token).actors.find((a) => a.id === id);
      x.store.executeAutonomy(
        x.command({
          kind: 'actor',
          actor: { ...a, role, enabled },
          expectedRevision: a.revision,
          initialLocationId: null,
        }),
      );
    }
    const { primary, secondary } = earlierScene(x);
    const job = {
        id: randomUUID(),
        revision: 0,
        name: 'Geteilte Wache',
        kind: 'guard',
        locationId: x.place,
        routeId: null,
        targetActorId: null,
        roles: distinct ? ['owner'] : [],
        priority: 100,
        durationSeconds: 600,
        exclusive: true,
        enabled: true,
        needEffects: {},
        maxDamage: 0,
      },
      otherJob = distinct
        ? { ...job, id: randomUUID(), name: 'Andere Aufgabe am gleichen Ort', roles: ['other'] }
        : job;
    x.store.executeAutonomy(x.command({ kind: 'job', job, expectedRevision: null }));
    if (distinct)
      x.store.executeAutonomy(x.command({ kind: 'job', job: otherJob, expectedRevision: null }));
    x.advance(0, 60);
    x.catchup();
    assert.equal(x.current().progressSeconds, 60);
    const facts = x.store.db
        .prepare('SELECT payload FROM autonomy_interval WHERE campaign_id=? ORDER BY ordinal')
        .all(x.cam.id),
      oldLogs = x.store.db
        .prepare('SELECT id,payload,checksum FROM autonomy_log WHERE campaign_id=? ORDER BY id')
        .all(x.cam.id);
    assert.equal(
      BigInt(
        x.store.db
          .prepare('SELECT to_ms FROM autonomy_booking WHERE campaign_id=? AND actor_id=?')
          .get(x.cam.id, x.id).to_ms,
      ),
      600000n,
    );
    const pause = x.command({
      kind: 'advance-clock',
      sceneId: secondary,
      expectedRevision: 0,
      amount: 30,
      unit: 'seconds',
      calendarVersion: 'relative-v1',
      reason: 'Zeit der anderen Gruppe',
    });
    if (distinct) {
      x.store.db.exec(
        "CREATE TEMP TRIGGER reject_time_conflict BEFORE INSERT ON autonomy_log WHEN json_extract(NEW.payload,'$.kind')='decision' BEGIN SELECT RAISE(ABORT,'controlled decision log failure'); END",
      );
      const before = x.store.db.serialize();
      assert.throws(() => x.store.executeLive(pause), /controlled decision log failure/);
      assert.ok(
        x.store.db.serialize().equals(before),
        'late log failure rolls back clock, pause, both booking tables and receipts',
      );
      x.store.db.exec('DROP TRIGGER reject_time_conflict');
    }
    x.store.executeLive(pause);
    assert.equal(x.current().paused, true);
    assert.match(x.current().pending, /Zeitkonflikt/);
    assert.equal(x.current().progressSeconds, 60);
    assert.equal(
      x.store.db
        .prepare('SELECT count(*) n FROM autonomy_reservation WHERE campaign_id=? AND actor_id=?')
        .get(x.cam.id, x.id).n,
      0,
    );
    assert.deepEqual(
      x.store.db
        .prepare('SELECT payload FROM autonomy_interval WHERE campaign_id=? ORDER BY ordinal')
        .all(x.cam.id),
      facts,
    );
    for (const log of oldLogs)
      assert.deepEqual(
        x.store.db
          .prepare('SELECT id,payload,checksum FROM autonomy_log WHERE campaign_id=? AND id=?')
          .get(x.cam.id, log.id),
        log,
      );
    await x.store.backup(path.join(x.root, 'pending.sqlite'));
    x.reopen();
    assert.equal(x.current().progressSeconds, 60);
    assert.equal(x.current().paused, true);
    const other = x.store.autonomy(x.w.token).actors.find((a) => a.id === x.other);
    x.store.executeAutonomy(
      x.command({
        kind: 'actor',
        actor: { ...other, enabled: true },
        expectedRevision: other.revision,
        initialLocationId: null,
      }),
    );
    const step = x.command({
        kind: 'advance-clock',
        sceneId: primary,
        expectedRevision: 1,
        amount: 60,
        unit: 'seconds',
        calendarVersion: 'relative-v1',
        reason: 'Andere Wache nutzt freies Ziel',
      }),
      ack = x.store.executeLive(step),
      active = x.store.autonomy(x.w.token).actors.find((a) => a.id === x.other);
    assert.equal(
      active.jobId,
      otherJob.id,
      'a paused owner must not exclude another actor from unperformed future time',
    );
    assert.equal(active.progressSeconds, 60);
    assert.equal(x.current().progressSeconds, 60);
    for (const table of ['autonomy_booking', 'autonomy_target_booking']) {
      const b = x.store.db
        .prepare('SELECT from_ms,to_ms FROM ' + table + ' WHERE campaign_id=? AND actor_id=?')
        .get(x.cam.id, x.id);
      assert.equal(BigInt(b.from_ms), 0n);
      assert.equal(
        BigInt(b.to_ms),
        60000n,
        'retain committed actor time; release predictions instead of retaining them or rolling back to scene time',
      );
    }

    await x.store.backup(path.join(x.root, 'other-owner.sqlite'));
    x.reopen();
    const before = x.store.db.serialize();
    assert.deepEqual(
      x.store.executeLive({ ...step, token: x.w.token }),
      JSON.parse(JSON.stringify(ack)),
    );
    assert.ok(x.store.db.serialize().equals(before));
  });

for (const resolution of ['resume', 'changed-position', 'skip'])
  test(`reasoned pending ${resolution} preserves valid job progress or explicitly starts a new basis after Fresh`, async (t) => {
    const x = fixture(t),
      { primary, secondary } = earlierScene(x),
      job = {
        id: randomUUID(),
        revision: 0,
        name: 'Fortsetzbarer bestätigter Job',
        kind: 'guard',
        locationId: x.place,
        routeId: null,
        targetActorId: null,
        roles: [],
        priority: 100,
        durationSeconds: 600,
        exclusive: true,
        enabled: true,
        needEffects: {},
        maxDamage: 0,
      };
    x.store.executeAutonomy(x.command({ kind: 'job', job, expectedRevision: null }));
    x.advance(0, 60);
    x.catchup();
    assert.equal(x.current().progressSeconds, 60);
    x.store.executeLive(
      x.command({
        kind: 'advance-clock',
        sceneId: secondary,
        expectedRevision: 0,
        amount: 30,
        unit: 'seconds',
        calendarVersion: 'relative-v1',
        reason: 'Frühere Gruppe',
      }),
    );
    assert.match(x.current().pending, /Zeitkonflikt/);
    x.reopen();
    const before = x.current();
    if (resolution === 'changed-position') {
      const id = randomUUID();
      x.store.changePreparation({
        ...x.command(null),
        change: {
          kind: 'location',
          expectedRevision: null,
          document: newLocation(id, 'GM-Ortskorrektur', 'poi', [randomUUID(), randomUUID()]),
        },
      });
      x.store.executeAutonomy(
        x.command({
          kind: 'place',
          actorId: x.id,
          locationId: id,
          expectedPositionRevision: x.current().positionRevision,
          reason: 'Bewusster Worldstand',
        }),
      );
    }
    const command = x.command({
      kind: 'accept-pending',
      actorId: x.id,
      expectedRevision: before.revision,
      resolution: resolution === 'skip' ? 'skip' : 'resume',
      reason: '  Stand geprüft\r\nFortsetzung bewusst gewählt',
    });
    if (resolution === 'resume') {
      x.store.db.exec(
        "CREATE TEMP TRIGGER reject_resume BEFORE INSERT ON autonomy_log WHEN NEW.interval_id='manual' AND json_extract(NEW.payload,'$.kind')='override' BEGIN SELECT RAISE(ABORT,'controlled resume log failure'); END",
      );
      const saved = x.store.db.serialize();
      assert.throws(() => x.store.executeAutonomy(command), /controlled resume log failure/);
      assert.ok(x.store.db.serialize().equals(saved));
      x.store.db.exec('DROP TRIGGER reject_resume');
    }
    x.store.executeAutonomy(command);
    const after = x.current();
    assert.equal(after.pending, null);
    assert.equal(after.paused, false);
    assert.equal(after.cursor, before.cursor);
    assert.equal(after.offsetSeconds, before.offsetSeconds);
    assert.deepEqual(after.needs, before.needs);
    if (resolution === 'resume') {
      assert.equal(after.jobId, job.id, 'a valid paused job retains its identity');
      assert.equal(
        after.progressSeconds,
        60,
        'resolving a time conflict must not discard performed work',
      );
      const step = x.command({
          kind: 'advance-clock',
          sceneId: primary,
          expectedRevision: 1,
          amount: 540,
          unit: 'seconds',
          calendarVersion: 'relative-v1',
          reason: 'Verbleibende Jobzeit',
        }),
        ack = x.store.executeLive(step);
      assert.equal(x.current().jobId, null);
      const completed = x.store
        .autonomy(x.w.token)
        .logs.filter((log) => log.actorId === x.id && log.kind === 'complete');
      assert.equal(completed.length, 1);
      assert.equal(completed[0].facts.seconds, 600);
      await x.store.backup(path.join(x.root, 'resumed.sqlite'));
      x.reopen();
      const saved = x.store.db.serialize();
      assert.deepEqual(
        x.store.executeLive({ ...step, token: x.w.token }),
        JSON.parse(JSON.stringify(ack)),
      );
      assert.ok(x.store.db.serialize().equals(saved));
    } else {
      assert.equal(after.jobId, null);
      assert.equal(after.progressSeconds, 0);
    }
    const log = x.store
      .autonomy(x.w.token)
      .logs.find((log) => log.kind === 'override' && log.text.includes(command.action.reason));
    assert.equal(log.facts.jobId, job.id);
    assert.equal(log.facts.progressSeconds, 60);
    assert.equal(log.facts.jobRestarted, resolution !== 'resume');
    if (resolution === 'changed-position') {
      assert.match(log.text, /60 s bisheriger Fortschritt/);
      const snapshot = path.join(x.root, 'changed-position.sqlite');
      await x.store.campaignSnapshot(x.w.token, snapshot);
      const bytes = readFileSync(snapshot),
        copy = x.store.acceptCampaignSnapshot(snapshot, 'Unabhängige Jobfortsetzung', {}),
        view = x.store.autonomy(x.store.activate(copy.id).token),
        copiedJob = view.jobs.find((j) => j.name === job.name),
        copiedLog = view.logs.find((l) => l.text === log.text);
      assert.notEqual(copiedJob.id, job.id);
      assert.equal(copiedLog.facts.jobId, copiedJob.id);
      assert.equal(copiedLog.facts.progressSeconds, 60);
      assert.equal(copiedLog.facts.jobRestarted, true);
      assert.ok(readFileSync(snapshot).equals(bytes));
    }
  });

test('decision inspection shows every candidate without writes and honours the confirmed rule basis', (t) => {
  const x = fixture(t),
    actor = x.current(),
    need = actor.needs.find((n) => n.id === 'hunger');
  need.value = 80;
  need.weight = 2;
  x.store.executeAutonomy(
    x.command({ kind: 'actor', actor, expectedRevision: actor.revision, initialLocationId: null }),
  );
  const job = (id, changes = {}) => ({
    id,
    revision: 1,
    name: id,
    kind: 'guard',
    locationId: x.place,
    routeId: null,
    targetActorId: null,
    roles: [],
    priority: 1,
    durationSeconds: 3600,
    exclusive: false,
    enabled: true,
    needEffects: {},
    maxDamage: 1,
    ...changes,
  });
  for (let i = 0; i < 27; i++)
    x.store.executeAutonomy(
      x.command({
        kind: 'job',
        expectedRevision: null,
        job: job('guard-' + String(i).padStart(2, '0')),
      }),
    );
  for (const j of [
    job('eat', { kind: 'eat', priority: 10, needEffects: { hunger: 80 } }),
    job('wrong-role', { roles: ['mage'] }),
    job('disabled', { enabled: false }),
    job('unreachable', { locationId: 'missing-location' }),
  ])
    x.store.executeAutonomy(x.command({ kind: 'job', job: j, expectedRevision: null }));
  let before = x.store.db.serialize(),
    view = x.store.autonomyDecision(x.w.token, x.id);
  assert(x.store.db.serialize().equals(before));
  assert.equal(view.basis, 'current');
  assert.equal(view.candidates.length, 31);
  assert.equal(view.selectedJobId, 'eat');
  assert.equal(view.candidates[0].priority, 170);
  assert.match(view.candidates[0].reason, /Hunger 80 × 2 = 160/);
  assert.equal(view.candidates.find((j) => j.jobId === 'disabled').eligible, false);
  assert.match(view.candidates.find((j) => j.jobId === 'unreachable').reason, /Ziel fehlt/);
  assert.equal(view.candidates.find((j) => j.jobId === 'wrong-role').eligible, false);
  // Leave this actor outside the active Scene; confirmed time then remains available for inspection.
  const place = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'location',
      expectedRevision: null,
      document: newLocation(place, 'Anderer Ort', 'poi', [randomUUID(), randomUUID()]),
    },
  });
  const scene = x.store.liveScene(x.w.token, x.scene.id);
  x.store.executeLive(
    x.command({
      kind: 'scene-content',
      sceneId: scene.id,
      expectedRevision: scene.revision,
      title: 'Andere Gruppe',
      notes: '',
      readAloud: '',
      locationId: place,
    }),
  );
  x.advance(0, 60);
  const changed = x.current();
  changed.jobPriorities = { 'guard-00': 500 };
  x.store.executeAutonomy(
    x.command({
      kind: 'actor',
      actor: changed,
      expectedRevision: changed.revision,
      initialLocationId: null,
    }),
  );
  before = x.store.db.serialize();
  view = x.store.autonomyDecision(x.w.token, x.id);
  assert.equal(view.basis, 'confirmed');
  assert.equal(view.selectedJobId, 'eat');
  assert.equal(view.throughMs, '60000');
  assert(x.store.db.serialize().equals(before));
  x.catchup();
  assert.equal(x.current().jobId, 'eat');
  assert.equal(x.current().progressSeconds, 60);
  view = x.store.autonomyDecision(x.w.token, x.id);
  assert.equal(view.basis, 'current');
  assert.equal(view.selectedJobId, 'guard-00');
  assert.equal(view.candidates[0].priority, 501);
  assert.equal(view.runningJobId, 'eat');
  x.reopen();
  before = x.store.db.serialize();
  assert.deepEqual(x.store.autonomyDecision(x.w.token, x.id), view);
  assert(x.store.db.serialize().equals(before));
});

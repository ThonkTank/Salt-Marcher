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
  outfile: '.build/autonomy-job-integrity.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../../.build/autonomy-job-integrity.cjs'),
  hash = (s) => createHash('sha256').update(s).digest('hex');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'autonomy-jobs-')),
    filename = path.join(root, 'source.sqlite'),
    store = new CampaignStore(filename),
    cam = store.create('NPC-Angebote', [
      {
        id: 'room',
        scopeId: 'local',
        floorId: 'ground',
        name: 'Halle',
        number: '1',
        revision: 0,
        polygons: [
          {
            outer: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
              { x: 0, y: 10 },
            ],
            holes: [],
          },
        ],
        sections: [],
      },
    ]),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const job = {
    id: randomUUID(),
    revision: 0,
    name: 'Wache',
    kind: 'guard',
    locationId: null,
    routeId: null,
    targetActorId: null,
    roles: [],
    priority: 1,
    durationSeconds: 60,
    exclusive: false,
    enabled: true,
    needEffects: {},
    maxDamage: 0,
  };
  store.executeAutonomy(command({ kind: 'job', job, expectedRevision: null }));
  return {
    root,
    filename,
    store,
    cam,
    w,
    command,
    job: { ...job, revision: 1 },
    mutate: (fn) => {
      const payload = JSON.stringify(fn({ ...job, revision: 1 }));
      store.db
        .prepare('UPDATE autonomy_job SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
        .run(payload, hash(payload), cam.id, job.id);
    },
  };
}
test('damaged autonomy job cannot replace an earlier complete backup or campaign export', async (t) => {
  const x = fixture(t),
    backup = path.join(x.root, 'backup.sqlite'),
    snapshot = path.join(x.root, 'campaign.sqlite');
  await x.store.backup(backup);
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const beforeBackup = readFileSync(backup),
    beforeSnapshot = readFileSync(snapshot);
  x.store.db.prepare('UPDATE autonomy_job SET checksum=?').run('broken');
  const source = x.store.db.serialize();
  await assert.rejects(x.store.backup(backup), /Autonomie|Job/i);
  await assert.rejects(x.store.campaignSnapshot(x.w.token, snapshot), /Autonomie|Job/i);
  assert.deepEqual(readFileSync(backup), beforeBackup);
  assert.deepEqual(readFileSync(snapshot), beforeSnapshot);
  assert.deepEqual(x.store.db.serialize(), source);
});
// checkedJobRow is shared by reads, time capture and validateAutonomy. Stored
// controls below retain its backup traversal; preserve the separate clock writer.
for (const field of ['id', 'revision'])
  test(`job ${field} must agree with its SQL owner before read and time confirmation`, (t) => {
    const x = fixture(t);
    x.mutate((j) => ({ ...j, [field]: field === 'id' ? randomUUID() : 99 }));
    const source = x.store.db.serialize();
    assert.throws(() => x.store.autonomy(x.w.token), /Autonomie|Job/i);
    assert.deepEqual(x.store.db.serialize(), source);
    x.store.executeLive(x.command({ kind: 'initialize', expectedRosterRevision: 0 }));
    const scene = x.store.live(x.w.token).scene,
      before = x.store.db.serialize();
    assert.throws(
      () =>
        x.store.executeLive(
          x.command({
            kind: 'advance-clock',
            sceneId: scene.id,
            expectedRevision: scene.clock.revision,
            amount: 60,
            unit: 'seconds',
            calendarVersion: 'relative-v1',
            reason: 'NPC-Zeit',
          }),
        ),
      /Autonomie|Job/i,
    );
    assert.deepEqual(x.store.db.serialize(), before);
  });
test('invalid job controls and need effects are rejected before any state or receipt is written', (t) => {
  const x = fixture(t);
  for (const changes of [
    { enabled: 'false' },
    { exclusive: 1 },
    { roles: 'guard' },
    { needEffects: [] },
    { needEffects: { hunger: '10' } },
    { priority: '10' },
    { locationId: 17 },
  ]) {
    const before = x.store.db.serialize();
    assert.throws(
      () =>
        x.store.executeAutonomy(
          x.command({ kind: 'job', job: { ...x.job, ...changes }, expectedRevision: 1 }),
        ),
      /Job/i,
    );
    assert.deepEqual(x.store.db.serialize(), before);
  }
});
test('a checksummed job with invalid stored controls is rejected by read and backup', async (t) => {
  const x = fixture(t);
  x.mutate((j) => ({ ...j, enabled: 'false' }));
  assert.throws(() => x.store.autonomy(x.w.token), /Job/i);
  await assert.rejects(x.store.backup(path.join(x.root, 'invalid.sqlite')), /Job/i);
});
test('valid jobs without later optional dungeon fields survive fresh and independent transfer', async (t) => {
  const x = fixture(t),
    snapshot = path.join(x.root, 'valid.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const bytes = readFileSync(snapshot),
    copy = x.store.acceptCampaignSnapshot(snapshot, 'Kopie', {}),
    cw = x.store.activate(copy.id),
    jobs = x.store.autonomy(cw.token).jobs;
  assert.equal(jobs.length, 1);
  assert.notEqual(jobs[0].id, x.job.id);
  assert.equal(jobs[0].name, x.job.name);
  assert.deepEqual(readFileSync(snapshot), bytes);
  const fresh = new CampaignStore(x.filename);
  try {
    assert.deepEqual(fresh.autonomy(fresh.activate(copy.id).token).jobs, jobs);
  } finally {
    fresh.close();
  }
});

function trap(x, changes = {}) {
  const element = {
    id: randomUUID(),
    revision: 0,
    scopeId: 'local',
    floorId: 'ground',
    roomId: 'room',
    kind: 'feature',
    points: [{ x: 5, y: 5 }],
    name: 'Fallgrube',
    notes: '',
    secret: true,
    color: '#000000',
    width: 1,
    height: 1,
    angle: 0,
    variant: '',
    blocksSight: false,
    blocksSound: false,
    passable: true,
    state: 'open',
    targetRoomId: null,
    targetFloorId: null,
    anchor: null,
    feature: 'trap',
    maxCharges: 1,
    resetSeconds: 0,
    resetMode: 'empty',
    triggerRadius: 0,
    triggerHeight: 0,
    assetId: null,
    archived: false,
    ...changes,
  };
  x.store.executeDrawing(x.command({ kind: 'element', element, expectedRevision: null }));
  return element;
}

test('travel checkpoints restore trap resets and completed NPC work, including pending redo in an independent archive copy', async (t) => {
  const x = fixture(t),
    locationId = randomUUID(),
    npcId = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'location',
      expectedRevision: null,
      document: {
        kind: 'location',
        version: 1,
        id: locationId,
        name: 'Wachort',
        type: 'poi',
        sections: [],
        detailMaps: [],
        keyLinks: [],
      },
    },
  });
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'note',
      expectedRevision: null,
      note: {
        version: 1,
        id: npcId,
        revision: 1,
        kind: 'npc',
        title: 'Wache',
        readAloud: '',
        gmNotes: '  Autorenwissen\r\n',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    },
  });
  x.store.executeAutonomy(
    x.command({
      kind: 'actor',
      expectedRevision: null,
      initialLocationId: locationId,
      actor: {
        id: npcId,
        revision: 0,
        enabled: true,
        paused: false,
        role: '',
        needs: [],
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
    }),
  );
  x.store.executeAutonomy(
    x.command({
      kind: 'job',
      expectedRevision: 1,
      job: { ...x.job, locationId, durationSeconds: 3, exclusive: true },
    }),
  );
  const pc = x.store.executeLive(
      x.command({ kind: 'create-character', profile: { name: 'Iri', speedFeet: 30 } }),
    ).character,
    v = x.store.live(x.w.token);
  x.store.executeLive(
    x.command({
      kind: 'membership',
      characterId: pc.id,
      expectedRevision: pc.membershipRevision,
      expectedRosterRevision: v.rosterRevision,
      active: true,
      targetSceneId: null,
      expectedFocusRevision: v.focusRevision,
    }),
  );
  const scene = x.store.executeLive(
    x.command({
      kind: 'initialize',
      expectedRosterRevision: x.store.live(x.w.token).rosterRevision,
    }),
  ).scene;
  const map = x.store.world(x.w.token).maps[0],
    cell = {
      r: 0,
      level: 0,
      terrain: 'plains',
      elevationM: 0,
      climate: null,
      road: false,
      river: false,
      label: '',
      faction: '',
      interrupt: '',
    };
  x.store.executeWorld(
    x.command({
      kind: 'map',
      expectedRevision: map.revision,
      map: { ...map, cells: [0, 1, 2, 3].map((q) => ({ ...cell, q })) },
    }),
  );
  x.store.executeWorld(
    x.command({
      kind: 'place',
      mapId: map.id,
      locationId,
      expectedRevision: null,
      hex: { q: 3, r: 0 },
    }),
  );
  x.store.executeWorld(
    x.command({
      kind: 'place-scene',
      sceneId: scene.id,
      position: { mapId: map.id, q: 0, r: 0, locationId: null },
      expectedSceneRevision: scene.revision,
      expectedPositionRevision: 0,
    }),
  );
  const feature = trap(x, { resetSeconds: 6 });
  x.store.activateFeature(
    x.w.token,
    feature.id,
    scene.id,
    x.store.drawing(x.w.token).features.find((f) => f.id === feature.id).revision,
    'activate',
    null,
    randomUUID(),
  );
  const before = x.store.autonomy(x.w.token).actors.find((a) => a.id === npcId),
    preview = x.store.previewTravel(x.w.token, {
      sceneId: scene.id,
      mapId: map.id,
      destination: { q: 3, r: 0 },
      destinationLocationId: locationId,
      waypoints: [],
      paceKmh: 1,
      factor: 1,
      finalSeconds: 9,
    });
  const j = x.store.executeWorld(x.command({ kind: 'journey', preview })).scene.journey;
  x.store.executeWorld(
    x.command({ kind: 'journey-step', id: j.id, expectedRevision: j.revision, maxSteps: 3 }),
  );
  const completed = x.store.autonomy(x.w.token).actors.find((a) => a.id === npcId),
    logs = x.store.autonomy(x.w.token).logs;
  assert(completed.cursor > before.cursor);
  assert(logs.some((l) => l.kind === 'complete'));
  const act = (store, w, cam, sceneId, direction) => {
    const s = store.sceneWorld(w.token, sceneId),
      h = s.travelHistory[direction];
    return store.executeWorld({
      commandId: randomUUID(),
      campaignId: cam,
      token: w.token,
      action: {
        kind: 'travel-history',
        sceneId,
        id: h.id,
        revision: h.revision,
        direction,
        expectedClockRevision: s.scene.clock.revision,
        expectedPositionRevision: s.position.revision,
        expectedJourneyRevision: s.journey.revision,
      },
    });
  };
  act(x.store, x.w, x.cam.id, scene.id, 'undo');
  let a = x.store.autonomy(x.w.token).actors.find((a) => a.id === npcId);
  assert.equal(a.cursor, before.cursor);
  assert.equal(a.progressSeconds, before.progressSeconds);
  assert.equal(x.store.autonomy(x.w.token).logs.length, 0);
  // Even a checksummed historical row cannot bypass the current domain decoder.
  const checkpoint = x.store.db.prepare('SELECT * FROM travel_checkpoint WHERE ordinal=2').get(),
    forged = JSON.parse(checkpoint.payload),
    effect = forged.effects.find((e) => e.table === 'dungeon_feature_state'),
    body = JSON.parse(effect.before.payload);
  body.charges = 99;
  effect.before.payload = JSON.stringify(body);
  effect.before.checksum = hash(effect.before.payload);
  const bad = JSON.stringify(forged);
  x.store.db
    .prepare('UPDATE travel_checkpoint SET payload=?,checksum=? WHERE id=?')
    .run(bad, hash(bad), checkpoint.id);
  const unchanged = x.store.db.serialize();
  assert.throws(() => act(x.store, x.w, x.cam.id, scene.id, 'undo'), /Fallenladung/);
  assert.deepEqual(x.store.db.serialize(), unchanged);
  x.store.db
    .prepare('UPDATE travel_checkpoint SET payload=?,checksum=? WHERE id=?')
    .run(checkpoint.payload, checkpoint.checksum, checkpoint.id);
  act(x.store, x.w, x.cam.id, scene.id, 'undo');
  assert.equal(x.store.drawing(x.w.token).features.find((f) => f.id === feature.id).charges, 0);
  const snapshot = path.join(x.root, 'pending-redo.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const bytes = readFileSync(snapshot),
    copy = new CampaignStore(path.join(x.root, 'copy.sqlite'));
  try {
    const campaign = copy.acceptCampaignSnapshot(snapshot, 'Unabhängige Rücknahme', {}),
      w = copy.activate(campaign.id),
      copiedScene = copy.live(w.token).scene.id;
    act(copy, w, campaign.id, copiedScene, 'redo');
    act(copy, w, campaign.id, copiedScene, 'redo');
    const current = copy.autonomy(w.token).actors[0];
    assert.notEqual(current.id, npcId);
    assert.equal(current.cursor, completed.cursor);
    assert.equal(current.progressSeconds, completed.progressSeconds);
    assert.equal(
      copy.autonomy(w.token).logs.filter((l) => l.kind === 'complete').length,
      logs.filter((l) => l.kind === 'complete').length,
    );
    assert.equal(copy.drawing(w.token).features[0].charges, 1);
    assert.equal(copy.sceneWorld(w.token, copiedScene).scene.clock.instantMs, '9000');
    assert.deepEqual(readFileSync(snapshot), bytes);
  } finally {
    copy.close();
  }
});
test('autonomy projects the same checked trap choices without building unrelated dungeon views', (t) => {
  const x = fixture(t),
    valid = trap(x),
    fallback = trap(x, { name: '' });
  trap(x, { archived: true });
  trap(x, { roomId: null });
  trap(x, { feature: 'puzzle' });
  trap(x, { kind: 'object' });
  const expected = x.store
    .drawing(x.w.token)
    .elements.filter(
      (e) => !e.archived && e.kind === 'feature' && e.feature === 'trap' && e.roomId !== null,
    )
    .map((e) => ({ id: e.id, name: e.name || 'Falle' }));
  assert.deepEqual(expected, [
    { id: valid.id, name: 'Fallgrube' },
    { id: fallback.id, name: 'Falle' },
  ]);
  const bytes = x.store.db.serialize(),
    prepare = x.store.db.prepare,
    queries = [];
  x.store.db.prepare = function (sql) {
    queries.push(sql);
    return prepare.call(this, sql);
  };
  let view;
  try {
    view = x.store.autonomy(x.w.token);
  } finally {
    x.store.db.prepare = prepare;
  }
  assert.deepEqual(view.features, expected);
  assert.ok(x.store.db.serialize().equals(bytes), 'inspection must not simulate or write');
  const unrelated = queries.filter((sql) =>
    /dungeon_(key_content|path|passage|volume|trigger_field|feature_state)|drawing_profile/.test(
      sql,
    ),
  );
  t.diagnostic(
    JSON.stringify({
      preparedStatements: queries.length,
      unrelatedDungeonStatements: unrelated.length,
    }),
  );
  assert.deepEqual(
    unrelated,
    [],
    'job choices need checked elements, not full dungeon projections',
  );
});
for (const damage of ['checksum', 'identity', 'values'])
  test(`trap choices reject ${damage} corruption and roll back a job save`, (t) => {
    const x = fixture(t),
      e = trap(x),
      row = x.store.db.prepare('SELECT * FROM drawing_element WHERE id=?').get(e.id);
    if (damage === 'checksum')
      x.store.db.prepare('UPDATE drawing_element SET checksum=? WHERE id=?').run('broken', e.id);
    else {
      const payload = JSON.stringify({
        ...JSON.parse(row.payload),
        ...(damage === 'identity' ? { id: randomUUID() } : { maxCharges: -1 }),
      });
      x.store.db
        .prepare('UPDATE drawing_element SET payload=?,checksum=? WHERE id=?')
        .run(payload, hash(payload), e.id);
    }
    const before = x.store.db.serialize();
    assert.throws(
      () => x.store.autonomy(x.w.token),
      /Dungeonstand|Zeichnung|Charges|Ladung|Feature/i,
    );
    assert.throws(
      () =>
        x.store.executeAutonomy(
          x.command({
            kind: 'job',
            job: { ...x.job, name: 'Nicht übernehmen' },
            expectedRevision: 1,
          }),
        ),
      /Dungeonstand|Zeichnung|Charges|Ladung|Feature/i,
    );
    assert.ok(
      x.store.db.serialize().equals(before),
      'failed projection rolls back the entire command and receipt',
    );
  });

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
const require = createRequire(import.meta.url);
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/session-targets-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['src/app/generation/session-targets.ts'],
  outfile: '.build/session-targets.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { CampaignStore } = require('../.build/session-targets-store.cjs'),
  { sessionTargets } = require('../.build/session-targets.cjs');
const party = [
  { id: 'a', name: 'Gruppe A', level: 3, count: 2 },
  { id: 'b', name: 'Gruppe B', level: 4, count: 2 },
];
test('original Golden allocation is exact and automatic count uses the original seeded policy', () => {
  const p = sessionTargets(party, '0.6', '179974', 3);
  assert.deepEqual(p.encounterTargets, [680, 1000, 1800]);
  assert.equal(p.budget, 3480);
  assert.equal(p.audit.passed, true);
  assert.equal(sessionTargets(party, '0.6', '179974').encounterTargets.length, 4);
  assert.deepEqual(sessionTargets([...party, { level: 3, count: 0 }], '0.600', '179974', 3), p);
  assert.deepEqual(sessionTargets([{ level: 1, count: 1 }], '0.005', 'name', 1).encounterTargets, [
    2,
  ]); // half-up, not float truncation
  assert.deepEqual(sessionTargets(party, '0', 'seed', 1).encounterTargets, [0]);
  assert.throws(() => sessionTargets(party, '0.6', 'seed', 11), /1–10/);
});
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'session-targets-')),
    file = path.join(root, 'work.sqlite'),
    store = new CampaignStore(file),
    cam = store.create('Begegnungsbogen'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), token: w.token, campaignId: cam.id, action }),
    planId = randomUUID(),
    tableId = randomUUID();
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  store.changePreparation({
    ...command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: { version: 1, id: planId, revision: 1, name: 'Nordmark', scenes: [] },
    },
  });
  store.executeSession(
    command({
      kind: 'profile',
      expectedRevision: 0,
      profile: { planId, revision: 0, party, adventureDayFraction: '0.6', seed: '179974' },
    }),
  );
  store.executeGeneration(
    command({
      kind: 'table-save',
      expectedRevision: null,
      table: {
        id: tableId,
        revision: 0,
        scope: 'campaign',
        name: 'Nordmark',
        description: '',
        entries: ['guard', 'goblin', 'ogre', 'wolf'].map((creatureId) => ({
          creatureId,
          weight: '1',
        })),
        habitats: [],
        time: 'any',
        lootTableId: null,
        trashed: false,
      },
    }),
  );
  return {
    root,
    file,
    store,
    cam,
    w,
    command,
    planId,
    request: {
      planId,
      expectedProfileRevision: 1,
      count: 3,
      locationIds: [],
      noteIds: [],
      encounter: {
        tableIds: [tableId],
        filters: {},
        habitat: '',
        time: 'any',
        difficulty: 'medium',
        amount: 'neutral',
        balance: 'neutral',
        diversity: 'neutral',
      },
    },
  };
}
test('complete session stores exact targets and each distinct encounter origin; fresh and campaign copy retain them', async (t) => {
  const x = fixture(t),
    run = x.store.generateSession(x.w.token, x.request);
  assert.deepEqual(run.targets.encounterTargets, [680, 1000, 1800]);
  assert.equal(new Set(run.proposals.map((p) => p.encounter.generationOrigin.runId)).size, 3);
  assert.equal(
    run.usedXp,
    run.proposals.reduce((n, p) => n + p.encounter.assessment.adjustedXp, 0),
  );
  assert(run.usedXp <= run.budget);
  assert.equal(x.store.preparation(x.w.token).plans[0].scenes.length, 0);
  const fresh = new CampaignStore(x.file);
  try {
    assert.deepEqual(fresh.sessionRun(fresh.activate(x.cam.id).token, run.id), run);
  } finally {
    fresh.close();
  }
  const snapshot = path.join(x.root, 'copy.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const copy = x.store.acceptCampaignSnapshot(snapshot, 'Nordmark Kopie', {}),
    w = x.store.activate(copy.id),
    row = x.store.db.prepare('SELECT id FROM session_run WHERE campaign_id=?').get(copy.id),
    copied = x.store.sessionRun(w.token, row.id);
  assert.deepEqual(copied.targets, run.targets);
  assert.notEqual(copied.id, run.id);
  assert(
    copied.proposals.every(
      (p) =>
        p.encounter.generationOrigin.runId !==
        run.proposals[p.index].encounter.generationOrigin.runId,
    ),
  );
});
test('automatic generation and local regeneration retain the budget arc and authored text', (t) => {
  const x = fixture(t),
    run = x.store.generateSession(x.w.token, { ...x.request, count: null });
  assert.equal(run.proposals.length, 4);
  assert.equal(run.targets.requestedCount, null);
  x.store.executeSession(
    x.command({
      kind: 'edit-proposal',
      planId: x.planId,
      runId: run.id,
      index: 1,
      expectedRevision: 1,
      title: 'Brücke',
      notes: '  Eigene Notiz\r\n',
      readAloud: '  Vorlesen\r\n',
      locationId: null,
      noteIds: [],
      reward: null,
    }),
  );
  const edited = x.store.sessionRun(x.w.token, run.id),
    next = x.store.regenerateSessionProposal(x.w.token, run.id, 1, 'anderer-seed');
  assert.deepEqual(next.targets, run.targets);
  assert.equal(next.proposals[1].notes, '  Eigene Notiz\r\n');
  assert.deepEqual(next.proposals[0], edited.proposals[0]);
  assert.equal(
    x.store.generationRun(x.w.token, next.proposals[1].encounter.generationOrigin.runId).request
      .targetXp,
    run.targets.encounterTargets[1],
  );
});
test('failed later encounter rolls back the entire generation and its source runs', (t) => {
  const x = fixture(t),
    locations = ['Gegnerquelle', 'Ohne Gegnerquelle'].map((name) => ({ id: randomUUID(), name }));
  for (const l of locations)
    x.store.changePreparation({
      ...x.command(null),
      change: {
        kind: 'location',
        expectedRevision: null,
        document: {
          kind: 'location',
          version: 1,
          ...l,
          type: 'poi',
          sections: [],
          detailMaps: [],
          keyLinks: [],
        },
      },
    });
  x.store.executeGeneration(
    x.command({
      kind: 'source-save',
      expectedRevision: null,
      source: {
        kind: 'location',
        id: locations[0].id,
        revision: 0,
        tableIds: x.request.encounter.tableIds,
        factionIds: [],
        stock: [],
      },
    }),
  );
  let generated = 0;
  x.store.db.function('observe_generation', () => {
    generated++;
    return 0;
  });
  x.store.db.exec(
    'CREATE TEMP TRIGGER observe_generation AFTER INSERT ON generation_run BEGIN SELECT observe_generation(); END',
  );
  const before = x.store.db.serialize();
  assert.throws(() =>
    x.store.generateSession(x.w.token, {
      ...x.request,
      worldSourcesByLocation: true,
      locationIds: locations.map((l) => l.id),
    }),
  );
  assert.equal(generated, 1);
  assert.ok(before.equals(x.store.db.serialize()));
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM session_run').get().n, 0);
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM generation_run').get().n, 0);
});

test('ordinary planner catalog selection respects the remaining whole-session ceiling', (t) => {
  const x = fixture(t),
    request = {
      ...x.request,
      encounter: {
        ...x.request.encounter,
        tableIds: [],
        difficulty: 'weighted',
        amount: 'standard',
      },
    };
  const run = x.store.generateSession(x.w.token, request);
  assert.deepEqual(run.targets.encounterTargets, [680, 1000, 1800]);
  assert.equal(run.proposals.length, 3);
  assert.ok(run.usedXp <= 3480);
  assert.equal(
    run.usedXp,
    run.proposals.reduce((n, p) => n + p.encounter.assessment.adjustedXp, 0),
  );
  const fresh = new CampaignStore(x.file);
  try {
    assert.deepEqual(fresh.sessionRun(fresh.activate(x.cam.id).token, run.id), run);
  } finally {
    fresh.close();
  }
});
test('encounter XP ceilings constrain complete rosters and rejection publishes no partial run', (t) => {
  const x = fixture(t),
    request = {
      ...x.request.encounter,
      party,
      seed: 'ceiling',
      title: 'Schleusenwache',
      count: 1,
      targetXp: 500,
      xpCeiling: 300,
    };
  const run = x.store.generateEncounters(x.w.token, request);
  assert.ok(run.plans[0].entries.length);
  assert.ok(run.plans[0].assessment.adjustedXp <= 300);
  const before = x.store.db.serialize();
  assert.throws(() =>
    x.store.generateEncounters(x.w.token, { ...request, seed: 'impossible', xpCeiling: 0 }),
  );
  assert.deepEqual(x.store.db.serialize(), before);
});

test('same semantic request resumes edited session without new rows, through fresh open and independent copy', async (t) => {
  const x = fixture(t);
  for (const name of ['Westufer', 'Ostufer']) {
    const id = randomUUID();
    x.store.changePreparation({
      ...x.command(null),
      change: {
        kind: 'location',
        expectedRevision: null,
        document: {
          kind: 'location',
          version: 1,
          id,
          name,
          type: 'poi',
          sections: [],
          detailMaps: [],
          keyLinks: [],
        },
      },
    });
    x.request.locationIds.push(id);
  }
  const run = x.store.generateSession(x.w.token, x.request);
  assert.equal(run.origin.version, 'session-origin-v1');
  assert.equal(run.origin.encounters.length, 3);
  x.store.executeSession(
    x.command({
      kind: 'edit-proposal',
      planId: x.planId,
      runId: run.id,
      index: 0,
      expectedRevision: 1,
      title: 'Meine Brücke',
      notes: '  Wortgetreu\r\n',
      readAloud: 'Still.',
      locationId: null,
      noteIds: [],
      reward: { poolXp: 11, items: [] },
    }),
  );
  const edited = x.store.sessionRun(x.w.token, run.id),
    before = x.store.db.serialize();
  assert.deepEqual(
    x.store.generateSession(x.w.token, {
      ...x.request,
      compensateLoot: false,
      compensateMagic: false,
      worldSourcesByLocation: false,
    }),
    edited,
  );
  assert.ok(before.equals(x.store.db.serialize()));
  assert.equal(edited.origin.rewards[0], null);
  const fresh = new CampaignStore(x.file);
  try {
    assert.deepEqual(fresh.generateSession(fresh.activate(x.cam.id).token, x.request), edited);
  } finally {
    fresh.close();
  }
  const snapshot = path.join(x.root, 'resume.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const copiedCam = x.store.acceptCampaignSnapshot(snapshot, 'Kopie mit Herkunft', {}),
    w = x.store.activate(copiedCam.id),
    row = x.store.db.prepare('SELECT id FROM session_run WHERE campaign_id=?').get(copiedCam.id),
    copied = x.store.sessionRun(w.token, row.id);
  assert.notEqual(copied.origin.encounters[0].runId, run.origin.encounters[0].runId);
  const copiedBefore = x.store.db.serialize();
  assert.deepEqual(x.store.generateSession(w.token, copied.origin.request), copied);
  assert.ok(copiedBefore.equals(x.store.db.serialize()));
});
test('source revisions create a new calculation while previous authored results and original rewards remain readable', (t) => {
  const x = fixture(t),
    run = x.store.generateSession(x.w.token, x.request),
    table = x.store
      .encounterTables(x.w.token, false)
      .find((t) => t.id === x.request.encounter.tableIds[0]);
  x.store.executeGeneration(
    x.command({
      kind: 'table-save',
      expectedRevision: table.revision,
      table: { ...table, name: 'Andere Quelle' },
    }),
  );
  const next = x.store.generateSession(x.w.token, x.request);
  assert.notEqual(next.id, run.id);
  assert.deepEqual(x.store.sessionRun(x.w.token, run.id), run);
  assert.equal(x.store.generateSession(x.w.token, x.request).id, next.id);
  const regenerated = x.store.regenerateSessionProposal(x.w.token, next.id, 0, 'extra-entwurf');
  assert.equal(regenerated.origin, undefined);
  assert.equal(x.store.generateSession(x.w.token, x.request).id, next.id);
});

test('reordering encounter source sets resumes the same edited session without duplicating immutable runs', async (t) => {
  const x = fixture(t),
    first = x.store.encounterTables(x.w.token, false)[0],
    second = { ...first, id: randomUUID(), revision: 0, name: 'Zweite Quelle' };
  x.store.executeGeneration(
    x.command({ kind: 'table-save', expectedRevision: null, table: second }),
  );
  const request = {
      ...x.request,
      encounter: { ...x.request.encounter, tableIds: [first.id, second.id] },
    },
    original = structuredClone(request),
    run = x.store.generateSession(x.w.token, request);
  // Emulate a valid older writer: origin-v1 recorded the selected table order verbatim.
  const historical = structuredClone(run);
  historical.origin.request.encounter.tableIds.sort().reverse();
  const payload = JSON.stringify(historical);
  x.store.db
    .prepare('UPDATE session_run SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
    .run(payload, createHash('sha256').update(payload).digest('hex'), x.cam.id, run.id);
  x.store.executeSession(
    x.command({
      kind: 'edit-proposal',
      planId: x.planId,
      runId: run.id,
      index: 0,
      expectedRevision: 1,
      title: 'Meine Brücke',
      notes: 'Eigener Text\r\n',
      readAloud: 'Still.',
      locationId: null,
      noteIds: [],
      reward: { poolXp: 11, items: [] },
    }),
  );
  const edited = x.store.sessionRun(x.w.token, run.id),
    before = x.store.db.serialize(),
    reordered = {
      ...request,
      encounter: { ...request.encounter, tableIds: [second.id, first.id] },
    };
  assert.deepEqual(x.store.generateSession(x.w.token, reordered), edited);
  assert.deepEqual(request, original, 'normalization must not mutate caller input');
  assert.ok(x.store.db.serialize().equals(before));
  const fresh = new CampaignStore(x.file);
  try {
    assert.deepEqual(fresh.generateSession(fresh.activate(x.cam.id).token, reordered), edited);
  } finally {
    fresh.close();
  }
  // Opening another store updates activation metadata independently of generation.
  const reopened = x.store.db.serialize();
  // Sorting is not deduplication: malformed duplicate source choices still fail.
  assert.throws(() =>
    x.store.generateSession(x.w.token, {
      ...request,
      encounter: { ...request.encounter, tableIds: [first.id, first.id] },
    }),
  );
  assert.ok(x.store.db.serialize().equals(reopened));
  const snapshot = path.join(x.root, 'source-set-copy.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const cam = x.store.acceptCampaignSnapshot(snapshot, 'Eigene Kopie', {}),
    w = x.store.activate(cam.id),
    copied = x.store.sessionRun(
      w.token,
      x.store.db.prepare('SELECT id FROM session_run WHERE campaign_id=?').get(cam.id).id,
    ),
    copyBefore = x.store.db.serialize();
  const copiedRequest = structuredClone(copied.origin.request);
  copiedRequest.encounter.tableIds.reverse();
  assert.deepEqual(x.store.generateSession(w.token, copiedRequest), copied);
  assert.ok(x.store.db.serialize().equals(copyBefore));
});

test('ordered location bindings remain a different session origin', (t) => {
  const x = fixture(t),
    ids = [];
  for (const name of ['Westufer', 'Ostufer']) {
    const id = randomUUID();
    ids.push(id);
    x.store.changePreparation({
      ...x.command(null),
      change: {
        kind: 'location',
        expectedRevision: null,
        document: {
          kind: 'location',
          version: 1,
          id,
          name,
          type: 'poi',
          sections: [],
          detailMaps: [],
          keyLinks: [],
        },
      },
    });
  }
  const first = x.store.generateSession(x.w.token, { ...x.request, locationIds: ids }),
    next = x.store.generateSession(x.w.token, { ...x.request, locationIds: ids.slice().reverse() });
  assert.notEqual(first.id, next.id);
  assert.deepEqual(
    first.proposals.map((p) => p.locationId),
    [ids[0], ids[1], ids[0]],
  );
  assert.deepEqual(
    next.proposals.map((p) => p.locationId),
    [ids[1], ids[0], ids[1]],
  );
  assert.deepEqual(x.store.sessionRun(x.w.token, first.id), first);
});

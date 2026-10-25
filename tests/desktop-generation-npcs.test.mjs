import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
mkdirSync('.build/catalog', { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  '.build/catalog/srd-5.1.generated.json',
);
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/generation-npcs.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/generation-npcs.cjs');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'generation-npcs-')),
    store = new CampaignStore(path.join(root, 'source.sqlite')),
    cam = store.create('Named watch'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const id = randomUUID(),
    view = store.executeNpc({
      ...command(null),
      expectedNoteRevision: null,
      expectedRecordRevision: 0,
      expectedActorRevision: null,
      expectedPositionRevision: null,
      npc: {
        id,
        name: '  Mira of the watch',
        creatureId: 'guard',
        readAloud: '  Author words\r\n',
        gmNotes: 'Private\r\n',
        locationId: null,
        health: { hp: 5, maxHp: 11, tempHp: 2, conditions: 'Wounded', concentrating: false },
        record: {
          id,
          revision: 0,
          factionId: null,
          modifier: -1,
          lifecycle: 'active',
          appearance: '',
          behavior: '',
          history: '',
        },
      },
    });
  const registry = store.generatorRegistry(w.token),
    preset = {
      ...structuredClone(registry.presets.find((p) => p.id === registry.effectiveId)),
      id: randomUUID(),
      revision: 0,
      name: 'Single NPC',
      system: false,
    };
  preset.config.composition.statblocks.min = 1;
  preset.config.composition.monsters.min = { value: 1, perPlayer: false };
  for (const range of Object.values(preset.config.composition.roleQuantities)) range.min = 1;
  store.executeGeneration(
    command({ kind: 'preset-save', preset, expectedRegistryRevision: registry.revision }),
  );
  store.executeGeneration(
    command({
      kind: 'preset-assign',
      id: preset.id,
      expectedRegistryRevision: store.generatorRegistry(w.token).revision,
    }),
  );
  const request = {
    npcOnly: true,
    tableIds: [],
    seed: 'named watch',
    filters: { text: 'guard' },
    habitat: '',
    time: 'any',
    party: [{ id: randomUUID(), name: 'Hero', level: 1, count: 1 }],
    difficulty: 'easy',
    amount: 'neutral',
    balance: 'neutral',
    diversity: 'neutral',
    title: 'Watch',
    count: 1,
    targetXp: 25,
  };
  const accept = (token, campaignId, runId, cmdId = randomUUID()) =>
    store.acceptGeneration({
      commandId: cmdId,
      token,
      campaignId,
      runId,
      index: 0,
      expectedRegistryRevision: store.generatorRegistry(token).revision,
    });
  return { root, store, cam, w, command, id, view, request, accept };
}
test('named preview copies independently and accepts without creating NPCs or changing health', async (t) => {
  const x = fixture(t),
    before = x.store.db.prepare('SELECT count(*) n FROM world_actor').get().n,
    run = x.store.generateEncounters(x.w.token, x.request);
  assert.deepEqual(
    run.plans[0].entries.flatMap((e) => e.worldActorIds),
    [x.id],
  );
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM world_actor').get().n, before);
  const snapshot = path.join(x.root, 'named.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const bytes = readFileSync(snapshot),
    copy = x.store.acceptCampaignSnapshot(snapshot, 'Copied watch', {}),
    w = x.store.activate(copy.id),
    copied = x.store.generationRun(w.token, x.store.generationRuns(w.token)[0].id),
    id = copied.npcBasis[0].id;
  assert.notEqual(id, x.id);
  assert.deepEqual(
    copied.plans[0].entries.flatMap((e) => e.worldActorIds),
    [id],
  );
  const npc = x.store.npc(w.token, id);
  assert.deepEqual(npc.health, x.view.health);
  assert.equal(npc.name, x.view.name);
  const commandId = randomUUID(),
    plan = x.accept(w.token, copy.id, copied.id, commandId);
  assert.deepEqual(x.accept(w.token, copy.id, copied.id, commandId), plan);
  assert.deepEqual(x.store.npc(w.token, id).health, x.view.health);
  assert.ok(readFileSync(snapshot).equals(bytes));
  await x.store.backup(path.join(x.root, 'copy-safe.sqlite'));
});
test('materializing a named template reuses the world figure and its current health', async (t) => {
  const x = fixture(t),
    run = x.store.generateEncounters(x.w.token, x.request),
    encounter = x.accept(x.w.token, x.cam.id, run.id),
    planId = randomUUID(),
    visitId = randomUUID(),
    locationId = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id: planId,
        revision: 1,
        name: 'Evening',
        scenes: [{ id: visitId, title: 'Watch', notes: '', locationId: null }],
      },
    },
  });
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'location',
      expectedRevision: null,
      document: {
        kind: 'location',
        version: 1,
        id: locationId,
        name: 'Gate',
        type: 'poi',
        sections: [],
        detailMaps: [],
        keyLinks: [],
      },
    },
  });
  const attached = x.store.executeSession(
      x.command({
        kind: 'attach',
        planId,
        visitId,
        expectedVisitRevision: 0,
        encounterId: encounter.id,
        expectedEncounterRevision: encounter.revision,
      }),
    ),
    group = attached.groups[0],
    before = x.store.db.prepare('SELECT count(*) n FROM world_actor').get().n;
  x.store.executeSession(
    x.command({
      kind: 'place',
      planId,
      groupId: group.id,
      expectedRevision: group.revision,
      locationId,
      expectedLocationRevision: 1,
    }),
  );
  const placed = x.store.groupView(x.w.token, group.id);
  assert.deepEqual(
    placed.actors.map((a) => a.id),
    [x.id],
  );
  assert.equal(placed.actors[0].hp, 5);
  assert.equal(placed.actors[0].tempHp, 2);
  assert.equal(placed.actors[0].name, x.view.name);
  assert.equal(placed.actors[0].entryId, encounter.entries[0].id);
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM world_actor').get().n, before);
  await x.store.backup(path.join(x.root, 'placed-safe.sqlite'));
});
for (const change of ['health', 'lifecycle', 'new opponent'])
  test(`named ${change} changes keep both original and copied previews stale`, async (t) => {
    const x = fixture(t),
      run = x.store.generateEncounters(x.w.token, x.request);
    if (change === 'new opponent') {
      const id = randomUUID();
      x.store.executeNpc({
        ...x.command(null),
        expectedNoteRevision: null,
        expectedRecordRevision: 0,
        expectedActorRevision: null,
        expectedPositionRevision: null,
        npc: { ...x.view, id, name: 'Borin', record: { ...x.view.record, id, revision: 0 } },
      });
    } else
      x.store.executeNpc({
        ...x.command(null),
        expectedNoteRevision: x.view.noteRevision,
        expectedRecordRevision: x.view.record.revision,
        expectedActorRevision: x.view.actorRevision,
        expectedPositionRevision: x.view.positionRevision,
        npc: {
          ...x.view,
          health: { ...x.view.health, hp: 4 },
          record: { ...x.view.record, lifecycle: change === 'lifecycle' ? 'defeated' : 'active' },
        },
      });
    let bytes = x.store.db.serialize();
    assert.throws(() => x.accept(x.w.token, x.cam.id, run.id), /NPC-Zustand/);
    assert.ok(x.store.db.serialize().equals(bytes));
    const snapshot = path.join(x.root, 'stale.sqlite');
    await x.store.campaignSnapshot(x.w.token, snapshot);
    const copy = x.store.acceptCampaignSnapshot(snapshot, 'Stale copy', {}),
      w = x.store.activate(copy.id),
      id = x.store.generationRuns(w.token)[0].id;
    bytes = x.store.db.serialize();
    assert.throws(() => x.accept(w.token, copy.id, id), /NPC-Zustand/);
    assert.ok(x.store.db.serialize().equals(bytes));
  });

for (const [name, damage] of [
  [
    'identity',
    (r) => {
      r.id = randomUUID();
    },
  ],
  [
    'seed',
    (r) => {
      r.seed = 'different';
    },
  ],
  [
    'world source shape',
    (r) => {
      r.sourceSnapshot = {
        location: null,
        involved: [],
        tableIds: [],
        caps: [{ creatureId: 'guard', limit: -1 }],
      };
    },
  ],
  [
    'proposal count',
    (r) => {
      r.request.count++;
    },
  ],
  [
    'assessment',
    (r) => {
      r.plans[0].assessment.adjustedXp++;
    },
  ],
  [
    'candidate closure',
    (r) => {
      r.candidates[0].creatureId = 'missing';
    },
  ],
  [
    'NPC basis missing',
    (r) => {
      delete r.npcBasis;
    },
  ],
  [
    'NPC identity foreign',
    (r) => {
      r.npcBasis[0].id = randomUUID();
    },
  ],
  [
    'NPC name disagreement',
    (r) => {
      r.npcBasis[0].name = 'Other';
    },
  ],
  [
    'NPC revision',
    (r) => {
      r.npcBasis[0].recordRevision = -1;
    },
  ],
  [
    'accepted proposal outside run',
    (r) => {
      r.acceptedPlanIds = ['foreign'];
    },
  ],
])
  test(`checksummed ${name} corruption rejects read, list, acceptance and backup without changing bytes`, async (t) => {
    const x = fixture(t),
      run = x.store.generateEncounters(x.w.token, x.request),
      backup = path.join(x.root, 'protected.sqlite');
    await x.store.backup(backup);
    const saved = readFileSync(backup),
      broken = structuredClone(run);
    damage(broken);
    const payload = JSON.stringify(broken);
    x.store.db
      .prepare('UPDATE generation_run SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
      .run(payload, createHash('sha256').update(payload).digest('hex'), x.cam.id, run.id);
    const bytes = x.store.db.serialize();
    for (const read of [
      () => x.store.generationRun(x.w.token, run.id),
      () => x.store.generationRuns(x.w.token),
      () => x.accept(x.w.token, x.cam.id, run.id),
    ])
      assert.throws(read);
    assert.ok(bytes.equals(x.store.db.serialize()));
    await assert.rejects(x.store.backup(backup));
    assert.ok(readFileSync(backup).equals(saved));
    assert.ok(bytes.equals(x.store.db.serialize()));
  });
test('historical named preview stays readable and backup-safe after NPC and preset changes', async (t) => {
  const x = fixture(t),
    run = x.store.generateEncounters(x.w.token, x.request);
  x.store.executeNpc({
    ...x.command(null),
    expectedNoteRevision: x.view.noteRevision,
    expectedRecordRevision: x.view.record.revision,
    expectedActorRevision: x.view.actorRevision,
    expectedPositionRevision: x.view.positionRevision,
    npc: {
      ...x.view,
      name: 'Renamed',
      health: { ...x.view.health, hp: 0 },
      record: { ...x.view.record, lifecycle: 'defeated' },
    },
  });
  const registry = x.store.generatorRegistry(x.w.token);
  x.store.executeGeneration(
    x.command({
      kind: 'preset-delete',
      id: run.preset.id,
      expectedRegistryRevision: registry.revision,
    }),
  );
  assert.deepEqual(x.store.generationRun(x.w.token, run.id), run);
  assert.equal(x.store.generationRuns(x.w.token)[0].id, run.id);
  await x.store.backup(path.join(x.root, 'history-safe.sqlite'));
});

test('ordinary catalog previews remain readable, acceptable and copy-safe', async (t) => {
  const x = fixture(t),
    request = { ...x.request, npcOnly: false },
    run = x.store.generateEncounters(x.w.token, request);
  assert.equal(run.npcBasis, undefined);
  assert.deepEqual(x.store.generationRun(x.w.token, run.id), run);
  x.accept(x.w.token, x.cam.id, run.id);
  const accepted = x.store.generationRun(x.w.token, run.id);
  assert.ok(accepted.acceptedPlanIds[0]);
  const snapshot = path.join(x.root, 'catalog.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const copy = x.store.acceptCampaignSnapshot(snapshot, 'Copied catalog', {}),
    w = x.store.activate(copy.id),
    copied = x.store.generationRun(w.token, x.store.generationRuns(w.token)[0].id);
  assert.ok(copied.acceptedPlanIds[0]);
  assert.notEqual(copied.acceptedPlanIds[0], accepted.acceptedPlanIds[0]);
  await x.store.backup(path.join(x.root, 'catalog-safe.sqlite'));
});

for (const mode of ['required only', 'mixed empty pool', 'mixed partial pool'])
  test(`${mode} preview reads, accepts and copies with its exact NPC identities`, async (t) => {
    const x = fixture(t),
      request = {
        ...x.request,
        npcOnly: false,
        filters: { text: mode === 'required only' ? 'does not exist' : 'guard' },
        ...(mode === 'required only'
          ? { requiredNpcIds: [x.id] }
          : {
              includeNpcs: true,
              ...(mode === 'mixed empty pool' ? { excludedNpcIds: [x.id] } : {}),
            }),
      };
    if (mode === 'mixed partial pool') {
      const registry = x.store.generatorRegistry(x.w.token),
        preset = structuredClone(registry.presets.find((p) => p.id === registry.effectiveId));
      preset.config.composition.monsters.min = { value: 3, perPlayer: false };
      preset.config.composition.monsters.max = { value: 3, perPlayer: false };
      for (const range of Object.values(preset.config.composition.roleQuantities))
        range.min = range.max = 3;
      x.store.executeGeneration(
        x.command({ kind: 'preset-save', preset, expectedRegistryRevision: registry.revision }),
      );
      request.targetXp = 150;
    }
    const run = x.store.generateEncounters(x.w.token, request),
      ids = run.plans[0].entries.flatMap((e) => e.worldActorIds ?? []);
    assert.deepEqual(ids, mode === 'mixed empty pool' ? [] : [x.id]);
    if (mode === 'required only') assert.equal(run.candidates.length, 0);
    if (mode === 'mixed partial pool') {
      assert.equal(run.plans[0].entries[0].count, 3);
      assert.equal(run.plans[0].entries[0].allowAnonymous, true);
    }
    assert.deepEqual(x.store.generationRun(x.w.token, run.id), run);
    const accepted = x.accept(x.w.token, x.cam.id, run.id);
    assert.deepEqual(
      accepted.entries.flatMap((e) => e.worldActorIds ?? []),
      ids,
    );
    if (mode === 'mixed partial pool') {
      const planId = randomUUID(),
        visitId = randomUUID(),
        locationId = randomUUID();
      x.store.changePreparation({
        ...x.command(null),
        change: {
          kind: 'plan',
          expectedRevision: null,
          plan: {
            version: 1,
            id: planId,
            revision: 1,
            name: 'Mixed evening',
            scenes: [{ id: visitId, title: 'Watch', notes: '', locationId: null }],
          },
        },
      });
      x.store.changePreparation({
        ...x.command(null),
        change: {
          kind: 'location',
          expectedRevision: null,
          document: {
            kind: 'location',
            version: 1,
            id: locationId,
            name: 'Gate',
            type: 'poi',
            sections: [],
            detailMaps: [],
            keyLinks: [],
          },
        },
      });
      const group = x.store.executeSession(
          x.command({
            kind: 'attach',
            planId,
            visitId,
            expectedVisitRevision: 0,
            encounterId: accepted.id,
            expectedEncounterRevision: accepted.revision,
          }),
        ).groups[0],
        before = x.store.db.prepare('SELECT count(*) n FROM world_actor').get().n;
      x.store.executeSession(
        x.command({
          kind: 'place',
          planId,
          groupId: group.id,
          expectedRevision: group.revision,
          locationId,
          expectedLocationRevision: 1,
        }),
      );
      const placed = x.store.groupView(x.w.token, group.id);
      assert.equal(placed.actors.length, 3);
      assert.equal(placed.actors.find((a) => a.id === x.id).hp, 5);
      assert.equal(placed.actors.find((a) => a.id === x.id).tempHp, 2);
      assert.equal(x.store.db.prepare('SELECT count(*) n FROM world_actor').get().n, before + 2);
    }
    const file = path.join(x.root, 'new-mode.sqlite');
    await x.store.campaignSnapshot(x.w.token, file);
    const copy = x.store.acceptCampaignSnapshot(file, 'Independent', {}),
      w = x.store.activate(copy.id),
      copied = x.store.generationRun(w.token, x.store.generationRuns(w.token)[0].id);
    assert.equal(copied.npcBasis.length, run.npcBasis.length);
    if (ids.length) assert.notEqual(copied.plans[0].entries[0].worldActorIds[0], x.id);
    await x.store.backup(path.join(x.root, 'new-mode-safe.sqlite'));
  });
test('a named-only encounter cannot silently clone missing NPC identities', (t) => {
  const x = fixture(t),
    run = x.store.generateEncounters(x.w.token, x.request),
    plan = structuredClone(run.plans[0]);
  plan.entries[0].count = 2;
  const bytes = x.store.db.serialize();
  assert.throws(
    () => x.store.saveEncounterPlan({ ...x.command(null), plan, expectedRevision: null }),
    /NPCs/,
  );
  assert.ok(bytes.equals(x.store.db.serialize()));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
mkdirSync('.build/catalog', { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  '.build/catalog/srd-5.1.generated.json',
);
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {readCreature} from './src/app/storage/encounters';export {assessEncounter} from './src/app/catalog/encounter-contracts';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  outfile: '.build/generation-fill.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, readCreature, assessEncounter } = createRequire(import.meta.url)(
  '../../.build/generation-fill.cjs',
);
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'generation-fill-')),
    store = new CampaignStore(path.join(root, 'campaign.sqlite')),
    cam = store.create('Patrouille'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const party = [{ id: randomUUID(), name: 'Heldengruppe', level: 3, count: 4 }],
    entry = { id: randomUUID(), creatureId: 'goblin', count: 2, grouped: true },
    plan = store.saveEncounterPlan({
      ...command(null),
      expectedRevision: null,
      plan: {
        id: randomUUID(),
        revision: 0,
        name: 'Bestehende Patrouille',
        notes: '  Originalprosa\r\n[Pfad](local://unchanged)\r\n',
        party,
        entries: [entry],
        sources: [],
        catalogHash: '',
      },
    }),
    request = {
      fillPlan: { id: plan.id, revision: plan.revision },
      seed: 'fill-patrol',
      tableIds: [],
      filters: { text: 'Orc' },
      habitat: '',
      time: 'any',
      party,
      difficulty: 'medium',
      amount: 'neutral',
      balance: 'neutral',
      diversity: 'neutral',
      title: 'Verstärkte Patrouille',
      count: 2,
      targetXp: 1200,
    };
  const accept = (run, index = 0) =>
    store.acceptGeneration({
      ...command(null),
      runId: run.id,
      index,
      expectedRegistryRevision: store.generatorRegistry(w.token).revision,
    });
  return {
    root,
    store,
    cam,
    w,
    command,
    plan,
    request,
    accept,
    digest: () => createHash('sha256').update(store.db.serialize()).digest('hex'),
  };
}
const withoutId = ({ id, ...value }) => value;
test('filling preserves fixed enemies outside the filter, evaluates the complete roster and leaves source bytes untouched', (t) => {
  const x = fixture(t),
    source = x.store.db
      .prepare('SELECT payload FROM encounter_plan WHERE id=?')
      .get(x.plan.id).payload,
    run = x.store.generateEncounters(x.w.token, x.request);
  assert.deepEqual(run.fixedRoster, x.plan);
  for (const plan of run.plans) {
    assert.deepEqual(withoutId(plan.entries[0]), withoutId(x.plan.entries[0]));
    assert.notEqual(plan.entries[0].id, x.plan.entries[0].id);
    assert(plan.notes.startsWith(x.plan.notes));
    assert(plan.entries.slice(1).every((e) => e.creatureId.includes('orc')));
    assert(plan.entries.length > 1);
    const assessment = assessEncounter(
      x.request.party,
      plan.entries.map((e) => ({ xp: readCreature(e.creatureId).xp, count: e.count })),
    );
    assert.deepEqual(plan.assessment, assessment);
    assert.equal(plan.composition.metrics.adjustedXp, assessment.adjustedXp);
  }
  assert.equal(
    x.store.db.prepare('SELECT payload FROM encounter_plan WHERE id=?').get(x.plan.id).payload,
    source,
  );
  assert.deepEqual(x.store.generationRun(x.w.token, run.id), run);
  const accepted = x.accept(run);
  assert.notEqual(accepted.id, x.plan.id);
  assert.deepEqual(withoutId(accepted.entries[0]), withoutId(x.plan.entries[0]));
  assert.equal(x.store.encounterPlan(x.w.token, x.plan.id).notes, x.plan.notes);
});
test('an already sufficient fixed roster needs no filler, while stale bases reject before publishing', (t) => {
  const x = fixture(t),
    run = x.store.generateEncounters(x.w.token, {
      ...x.request,
      targetXp: 150,
      filters: { text: 'a nonexistent creature' },
    });
  assert.equal(run.plans[0].entries.length, 1);
  const next = x.store.saveEncounterPlan({
    ...x.command(null),
    expectedRevision: x.plan.revision,
    plan: { ...x.plan, notes: 'A newer authored edit' },
  });
  const bytes = x.digest();
  assert.throws(() => x.accept(run), /Auffüllbasis geändert/);
  assert.equal(x.digest(), bytes);
  assert.deepEqual(x.store.generationRun(x.w.token, run.id).fixedRoster, x.plan);
  assert.throws(() => x.store.generateEncounters(x.w.token, x.request), /Auffüllbasis geändert/);
  assert.equal(x.digest(), bytes);
  assert.equal(next.revision, 2);
});
test('current-format restart and independent campaign transfer keep the base snapshot and allow a new acceptance', async (t) => {
  const x = fixture(t),
    run = x.store.generateEncounters(x.w.token, x.request);
  const file = path.join(x.root, 'copy.sqlite');
  await x.store.campaignSnapshot(x.w.token, file);
  const copied = x.store.acceptCampaignSnapshot(file, 'Independent', {}),
    cw = x.store.activate(copied.id),
    copyRun = x.store.generationRun(cw.token, x.store.generationRuns(cw.token)[0].id);
  assert.notEqual(copyRun.fixedRoster.id, x.plan.id);
  assert.equal(copyRun.request.fillPlan.id, copyRun.fixedRoster.id);
  assert.equal(copyRun.fixedRoster.notes, x.plan.notes);
  const accepted = x.store.acceptGeneration({
    commandId: randomUUID(),
    campaignId: copied.id,
    token: cw.token,
    runId: copyRun.id,
    index: 0,
    expectedRegistryRevision: x.store.generatorRegistry(cw.token).revision,
  });
  assert(accepted.notes.startsWith(x.plan.notes));
  await x.store.backup(path.join(x.root, 'reopen.sqlite'));
  const reopened = new CampaignStore(path.join(x.root, 'reopen.sqlite'));
  try {
    const rw = reopened.activate(copied.id);
    assert.deepEqual(reopened.generationRun(rw.token, copyRun.id).fixedRoster, copyRun.fixedRoster);
  } finally {
    reopened.close();
  }
});

test('fixed opponents reserve finite source stock before any addition, without consuming the authored stock', (t) => {
  const x = fixture(t),
    id = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'note',
      expectedRevision: null,
      note: {
        version: 1,
        id,
        revision: 1,
        kind: 'faction',
        title: 'Goblinwache',
        readAloud: '',
        gmNotes: '',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    },
  });
  const tableId = randomUUID();
  x.store.executeGeneration(
    x.command({
      kind: 'table-save',
      expectedRevision: null,
      table: {
        id: tableId,
        revision: 0,
        scope: 'campaign',
        name: 'Goblinquelle',
        description: '',
        entries: [{ creatureId: 'goblin', weight: '1' }],
        habitats: [],
        time: 'any',
        lootTableId: null,
        trashed: false,
      },
    }),
  );
  const source = {
    kind: 'faction',
    id,
    revision: 0,
    tableIds: [tableId],
    factionIds: [],
    stock: [{ creatureId: 'goblin', limit: 1 }],
  };
  x.store.executeGeneration(x.command({ kind: 'source-save', source, expectedRevision: null }));
  const request = { ...x.request, factionIds: [id], filters: { text: 'Goblin' } };
  const bytes = x.digest();
  assert.throws(
    () => x.store.generateEncounters(x.w.token, request),
    /feste Vorlage überschreitet/,
  );
  assert.equal(x.digest(), bytes);
  x.store.executeGeneration(
    x.command({
      kind: 'source-save',
      source: { ...source, revision: 1, stock: [{ creatureId: 'goblin', limit: 2 }] },
      expectedRevision: 1,
    }),
  );
  const run = x.store.generateEncounters(x.w.token, request);
  assert.equal(
    run.plans[0].entries.reduce((n, e) => n + e.count, 0),
    2,
  );
  assert.equal(
    x.store.generationSources(x.w.token).sources.find((s) => s.id === id).stock[0].limit,
    2,
  );
});

test('fixed named opponents cannot be selected again as additions and retain their identity once', (t) => {
  const x = fixture(t),
    id = randomUUID();
  x.store.executeNpc({
    ...x.command(null),
    expectedNoteRevision: null,
    expectedRecordRevision: 0,
    expectedActorRevision: null,
    expectedPositionRevision: null,
    npc: {
      id,
      name: 'Mira',
      creatureId: 'guard',
      readAloud: '',
      gmNotes: '',
      locationId: null,
      health: { hp: 11, maxHp: 11, tempHp: 0, conditions: '', concentrating: false },
      record: {
        id,
        revision: 0,
        factionId: null,
        modifier: 0,
        lifecycle: 'active',
        appearance: '',
        behavior: '',
        history: '',
      },
    },
  });
  const plan = x.store.saveEncounterPlan({
    ...x.command(null),
    expectedRevision: x.plan.revision,
    plan: {
      ...x.plan,
      sourceReferences: [x.store.catalogReference('creature', 'guard')],
      entries: [
        {
          id: randomUUID(),
          creatureId: 'guard',
          count: 1,
          grouped: false,
          worldActorIds: [id],
          actorNames: ['Mira'],
        },
      ],
    },
  });
  const request = {
    ...x.request,
    fillPlan: { id: plan.id, revision: plan.revision },
    includeNpcs: true,
  };
  const run = x.store.generateEncounters(x.w.token, request);
  assert(!run.npcBasis.some((n) => n.id === id));
  assert.equal(
    run.plans[0].entries.flatMap((e) => e.worldActorIds ?? []).filter((i) => i === id).length,
    1,
  );
  assert.equal(x.accept(run).entries[0].worldActorIds[0], id);
  const bytes = x.digest();
  assert.throws(
    () => x.store.generateEncounters(x.w.token, { ...request, requiredNpcIds: [id] }),
    /bereits in der festen Vorlage/,
  );
  assert.equal(x.digest(), bytes);
});

test('accepted preparations remain canonical and readable after source and fill-basis edits, including Fresh', (t) => {
  const x = fixture(t),
    tableId = randomUUID(),
    table = {
      id: tableId,
      revision: 0,
      scope: 'campaign',
      name: 'Orc patrol',
      description: '  Source prose\r\n',
      entries: [{ creatureId: 'orc', weight: '1' }],
      habitats: [],
      time: 'any',
      lootTableId: null,
      trashed: false,
    };
  x.store.executeGeneration(x.command({ kind: 'table-save', table, expectedRevision: null }));
  const run = x.store.generateEncounters(x.w.token, { ...x.request, tableIds: [tableId] }),
    firstCommand = {
      ...x.command(null),
      runId: run.id,
      index: 0,
      expectedRegistryRevision: x.store.generatorRegistry(x.w.token).revision,
    },
    accepted = x.store.acceptGeneration(firstCommand),
    changed = x.store.saveEncounterPlan({
      ...x.command(null),
      expectedRevision: accepted.revision,
      plan: { ...accepted, name: 'Authored preparation', notes: '  Later authored prose\r\n' },
    });
  const originalRun = x.store.db
    .prepare('SELECT payload FROM generation_run WHERE id=?')
    .get(run.id).payload;
  x.store.executeGeneration(
    x.command({
      kind: 'table-save',
      table: { ...table, revision: 1, name: 'Revised and archived', trashed: true },
      expectedRevision: 1,
    }),
  );
  x.store.saveEncounterPlan({
    ...x.command(null),
    expectedRevision: x.plan.revision,
    plan: { ...x.plan, notes: 'The independent fill source changed' },
  });
  const before = x.digest(),
    receipt = x.store.db
      .prepare('SELECT payload FROM generation_receipt WHERE command_id=?')
      .get(firstCommand.commandId).payload;
  assert.deepEqual(x.accept(run), changed);
  assert.deepEqual(x.store.acceptGeneration(firstCommand), accepted);
  assert.throws(() => x.accept(run, 1), /Auffüllbasis geändert/);
  assert.equal(
    x.store.db
      .prepare('SELECT payload FROM generation_receipt WHERE command_id=?')
      .get(firstCommand.commandId).payload,
    receipt,
  );
  assert.equal(x.digest(), before, 'reopening must not write another preparation or receipt');
  assert.equal(
    x.store.db.prepare('SELECT payload FROM generation_run WHERE id=?').get(run.id).payload,
    originalRun,
  );
  const fresh = new CampaignStore(path.join(x.root, 'campaign.sqlite'));
  try {
    const w = fresh.activate(x.cam.id),
      snapshot = createHash('sha256').update(fresh.db.serialize()).digest('hex');
    assert.deepEqual(
      fresh.acceptGeneration({
        commandId: randomUUID(),
        campaignId: x.cam.id,
        token: w.token,
        runId: run.id,
        index: 0,
        expectedRegistryRevision: 0,
      }),
      changed,
    );
    assert.equal(createHash('sha256').update(fresh.db.serialize()).digest('hex'), snapshot);
    assert.equal(
      fresh.db.prepare('SELECT count(*) n FROM generation_acceptance WHERE run_id=?').get(run.id).n,
      1,
    );
  } finally {
    fresh.close();
  }
});

test('reopened generated preparation plays with the current group and survives a completed combat unchanged', (t) => {
  const x = fixture(t),
    party = [1, 2, 3].map((level, i) => ({
      id: randomUUID(),
      name: ['Ada', 'Borin', 'Cora'][i],
      level,
      count: 1,
    })),
    run = x.store.generateEncounters(x.w.token, { ...x.request, party }),
    accepted = x.accept(run),
    saved = x.store.saveEncounterPlan({
      ...x.command(null),
      expectedRevision: accepted.revision,
      plan: { ...accepted, name: 'Späher am Abend', notes: '  Nur bei Angriff kämpfen.\r\n' },
    });
  x.store.saveEncounterPlan({
    ...x.command(null),
    expectedRevision: x.plan.revision,
    plan: { ...x.plan, notes: 'Source redacted after acceptance' },
  });
  const scene = x.store.executeLive(
      x.command({ kind: 'initialize', expectedRosterRevision: 0 }),
    ).scene,
    people = [];
  for (const name of ['Ada', 'Borin', 'Cora']) {
    const hero = x.store.executeLive(
      x.command({ kind: 'create-character', profile: { name } }),
    ).character;
    people.push(hero);
    const v = x.store.live(x.w.token);
    x.store.executeLive(
      x.command({
        kind: 'membership',
        characterId: hero.id,
        expectedRevision: hero.membershipRevision,
        expectedRosterRevision: v.rosterRevision,
        active: true,
        targetSceneId: scene.id,
        expectedFocusRevision: v.focusRevision,
      }),
    );
  }
  assert.deepEqual(
    run.request.party.map((p) => p.level),
    [1, 2, 3],
  );
  for (const [i, xp] of [
    [1, 300],
    [2, 900],
  ]) {
    const progress = x.store
      .progress(x.w.token)
      .characters.find((p) => p.characterId === people[i].id);
    x.store.executeProgress(
      x.command({
        kind: 'xp',
        characterId: people[i].id,
        expectedRevision: progress.revision,
        mode: 'set',
        amount: xp,
        reason: 'Gemischte Gruppenlevel',
      }),
    );
  }
  const v = x.store.live(x.w.token),
    away = v.roster.find((c) => c.id === people[2].id);
  x.store.executeLive(
    x.command({
      kind: 'membership',
      characterId: away.id,
      expectedRevision: away.membershipRevision,
      expectedRosterRevision: v.rosterRevision,
      active: false,
      targetSceneId: null,
      expectedFocusRevision: v.focusRevision,
    }),
  );
  const opened = x.accept(run),
    current = x.store.liveScene(x.w.token, scene.id);
  assert.deepEqual(opened, saved);
  let combat = x.store.executeCombat({
    ...x.command({
      kind: 'create',
      sceneId: scene.id,
      title: opened.name,
      includeParty: true,
      expectedMembershipRevision: current.membershipRevision,
      planId: opened.id,
      expectedPlanRevision: opened.revision,
    }),
    combatId: null,
    expectedRevision: null,
  }).combat;
  assert.deepEqual(
    combat.participants
      .filter((p) => p.characterId)
      .map((p) => p.name)
      .sort(),
    ['Ada', 'Borin'],
  );
  assert.deepEqual(x.store.encounterPlan(x.w.token, saved.id).party, saved.party);
  const edit = (action) => {
    combat = x.store.executeCombat({
      ...x.command(action),
      combatId: combat.id,
      expectedRevision: combat.revision,
    }).combat;
  };
  edit({
    kind: 'initiative',
    values: combat.participants.map((p, i) => ({ participantId: p.id, initiative: 20 - i })),
    start: true,
  });
  assert.equal(combat.phase, 'running');
  edit({ kind: 'finish', outcome: 'Späher ziehen nach Verhandlung ab.' });
  assert.equal(combat.phase, 'finished');
  const fresh = new CampaignStore(path.join(x.root, 'campaign.sqlite'));
  try {
    const w = fresh.activate(x.cam.id);
    assert.deepEqual(fresh.encounterPlan(w.token, saved.id), saved);
    const reopened = fresh.combat(w.token, scene.id, combat.id).combat;
    assert.equal(reopened.phase, 'finished');
    assert.equal(reopened.outcome, 'Späher ziehen nach Verhandlung ab.');
    assert.equal(fresh.generationRun(w.token, run.id).acceptedPlanIds[0], saved.id);
  } finally {
    fresh.close();
  }
});

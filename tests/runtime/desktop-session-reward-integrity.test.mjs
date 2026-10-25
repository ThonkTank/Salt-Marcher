import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {sessionLootGuidance} from './src/app/storage/session-rewards';",
    resolveDir: process.cwd(),
    sourcefile: 'session-reward-review.ts',
    loader: 'ts',
  },
  outfile: '.build/session-reward-integrity.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, sessionLootGuidance } = createRequire(import.meta.url)(
    '../../.build/session-reward-integrity.cjs',
  ),
  hash = (s) => createHash('sha256').update(s).digest('hex');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'session-reward-integrity-')),
    filename = path.join(root, 'store.sqlite'),
    x = { root, filename, store: new CampaignStore(filename) };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  x.cam = x.store.create('Rewardprüfung');
  x.w = x.store.activate(x.cam.id);
  x.command = (action) => ({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    action,
  });
  x.characters = ['Iri', 'Dorn'].map(
    (name) =>
      x.store.executeLive(x.command({ kind: 'create-character', profile: { name } })).character,
  );
  for (const c of x.characters)
    x.store.executeProgress(
      x.command({
        kind: 'xp',
        characterId: c.id,
        expectedRevision: 0,
        mode: 'set',
        amount: 900,
        reason: 'Bestätigter Stand',
      }),
    );
  x.definition = x.store.executeItemShop(
    x.command({
      kind: 'definition',
      expectedRevision: null,
      definition: {
        id: randomUUID(),
        revision: 0,
        name: 'Eigener Lichtstein',
        category: 'magic',
        magic: true,
        rarity: 'Common',
        attunement: 'no',
        unitCopper: '100',
        weightText: '',
        properties: [],
        description: '  Freier GM-Text\r\n',
        source: { kind: 'authored', label: 'Eigene Vorlage', license: null, url: null },
        trashed: false,
      },
    }),
  ).definition;
  x.add = (c = x.characters[0], origin = 'manual', quantity = 2) =>
    x.store.executeProgress(
      x.command({
        kind: 'manual-item',
        characterId: c.id,
        expectedMembershipRevision: c.membershipRevision,
        origin,
        item: {
          name: x.definition.name,
          category: x.definition.category,
          quantity,
          valueGold: '1',
          reference: {
            kind: 'authored',
            definitionId: x.definition.id,
            revision: x.definition.revision,
          },
        },
        note: '  Tatsächlich vergeben\r\n',
      }),
    ).ledgerIds[0];
  x.id = x.add();
  x.profile = {
    planId: randomUUID(),
    revision: 1,
    party: x.characters.map((c) => ({ id: c.id, name: c.profile.name, level: 3, count: 1 })),
    adventureDayFraction: '0.5',
    seed: 'reward-integrity',
  };
  x.proposals = [{ encounter: { assessment: { baseXp: 100 } }, reward: { poolXp: 0, items: [] } }];
  x.guidance = (magic) => sessionLootGuidance(x.store.db, x.cam.id, x.profile, x.proposals, magic);
  x.damage = (mutate) => {
    const row = x.store.db.prepare('SELECT * FROM character_ledger WHERE id=?').get(x.id),
      item = JSON.parse(row.payload);
    mutate(item);
    const payload = JSON.stringify(item);
    x.store.db
      .prepare('UPDATE character_ledger SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
      .run(payload, hash(payload), x.cam.id, x.id);
  };
  return x;
}
for (const damage of ['status', 'origin', 'id', 'owner', 'revision', 'quantity'])
  test(`session gold and magic guidance reject checksummed ledger ${damage} damage without effects`, (t) => {
    const x = fixture(t);
    x.damage((item) => {
      if (damage === 'status') item.status = 'erased';
      if (damage === 'origin') item.origin = 'invented';
      if (damage === 'id') item.id = randomUUID();
      if (damage === 'owner') item.characterId = x.characters[1].id;
      if (damage === 'revision') item.revision++;
      if (damage === 'quantity') item.quantity = '2';
    });
    // checkedLedgerRow precedes the mode branch; identity also checks the magic entry path.
    const bytes = x.store.db.serialize();
    for (const magic of damage === 'id' ? [false, true] : [false]) {
      assert.throws(() => x.guidance(magic), /Beute|Fortschritt/i);
      assert.ok(bytes.equals(x.store.db.serialize()));
    }
  });
test('invalid reward ledger aborts the real session generator without persisting partial runs', (t) => {
  const x = fixture(t),
    plan = { version: 1, id: x.profile.planId, revision: 1, name: 'Ein Abend', scenes: [] };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'plan', plan, expectedRevision: null },
  });
  x.store.executeSession(
    x.command({ kind: 'profile', expectedRevision: 0, profile: { ...x.profile, revision: 0 } }),
  );
  const table = {
    id: randomUUID(),
    revision: 0,
    scope: 'campaign',
    name: 'Goblinquelle',
    description: '',
    entries: [{ creatureId: 'goblin', weight: '1' }],
    habitats: [],
    time: 'any',
    lootTableId: null,
    trashed: false,
  };
  x.store.executeGeneration(x.command({ kind: 'table-save', table, expectedRevision: null }));
  x.damage((item) => {
    item.status = 'erased';
  });
  const bytes = x.store.db.serialize();
  const request = {
    planId: plan.id,
    expectedProfileRevision: 1,
    count: 1,
    locationIds: [],
    noteIds: [],
    compensateMagic: true,
    encounter: {
      tableIds: [table.id],
      filters: {},
      habitat: '',
      time: 'any',
      difficulty: 'medium',
      amount: 'neutral',
      balance: 'neutral',
      diversity: 'neutral',
      xpCeiling: null,
    },
  };
  assert.throws(() => x.store.generateSession(x.w.token, request), /Beute|Fortschritt/i);
  assert.ok(bytes.equals(x.store.db.serialize()));
  x.damage((item) => {
    item.status = 'received';
  });
  const run = x.store.generateSession(x.w.token, request);
  assert.equal(run.proposals.length, 1);
  assert.equal(run.lootGuidance.magic.received.Common, 2);
  x.store.close();
  x.store = new CampaignStore(x.filename);
  x.w = x.store.activate(x.cam.id);
  assert.deepEqual(x.store.sessionRun(x.w.token, run.id), run);
});
test('magic guidance counts a multi-hop handout exactly once through sale, purchase, Fresh and independent copy', async (t) => {
  const x = fixture(t),
    a = x.characters[0],
    b = x.characters[1];
  x.add(b, 'purchase', 3);
  const transfer = x.store.executeProgress(
      x.command({
        kind: 'ledger-transfer',
        entryId: x.id,
        expectedRevision: 1,
        quantity: 2,
        characterId: b.id,
        expectedMembershipRevision: b.membershipRevision,
        reason: 'Weiter',
      }),
    ),
    second = x.store.executeProgress(
      x.command({
        kind: 'ledger-transfer',
        entryId: transfer.ledgerIds[2],
        expectedRevision: 1,
        quantity: 1,
        characterId: a.id,
        expectedMembershipRevision: a.membershipRevision,
        reason: 'Teil zurück',
      }),
    );
  x.store.executeProgress(
    x.command({
      kind: 'ledger',
      entryId: second.ledgerIds[2],
      expectedRevision: 1,
      operation: 'sold',
      quantity: 1,
      actualGold: '7',
      counterparty: 'Markt',
      reason: 'Verkauf',
    }),
  );
  const view = x.guidance(true);
  assert.equal(view.magic.received.Common, 2);
  assert.equal(view.magic.characters[0].received.Common, 2);
  assert.equal(view.magic.characters[1].received.Common, 0);
  assert.equal(view.receivedCopper, '0');
  const gold = x.guidance(false);
  assert.equal(gold.receivedCopper, '800');
  x.store.close();
  x.store = new CampaignStore(x.filename);
  x.w = x.store.activate(x.cam.id);
  assert.deepEqual(x.guidance(true), view);
  assert.deepEqual(x.guidance(false), gold);
  const file = path.join(x.root, 'package.sqlite');
  await x.store.campaignSnapshot(x.w.token, file);
  const packageBytes = readFileSync(file),
    copy = x.store.acceptCampaignSnapshot(file, 'Unabhängige Kopie', {});
  x.cam = copy;
  x.w = x.store.activate(copy.id);
  x.characters = x.store.live(x.w.token).roster;
  x.profile = {
    ...x.profile,
    party: x.characters.map((c) => ({ id: c.id, name: c.profile.name, level: 3, count: 1 })),
  };
  const copied = x.guidance(true);
  assert.equal(copied.magic.received.Common, 2);
  assert.deepEqual(
    copied.magic.characters.map((c) => c.received.Common),
    [2, 0],
  );
  assert.equal(x.guidance(false).receivedCopper, '800');
  assert.ok(packageBytes.equals(readFileSync(file)));
  assert.ok(
    x.characters.every((c) => !view.characters.some((original) => original.characterId === c.id)),
  );
});

test('current definition and quantity corrections update guidance without rewriting historical ledger facts', (t) => {
  const x = fixture(t),
    original = x.store.db
      .prepare('SELECT payload FROM character_ledger WHERE id=?')
      .get(x.id).payload;
  x.store.executeItemShop(
    x.command({
      kind: 'definition',
      expectedRevision: 1,
      definition: { ...x.definition, rarity: 'Rare', unitCopper: '300' },
    }),
  );
  const magic = x.guidance(true);
  assert.equal(magic.magic.received.Common, 0);
  assert.equal(magic.magic.received.Rare, 2);
  assert.equal(x.guidance(false).receivedCopper, '600');
  assert.equal(
    x.store.db.prepare('SELECT payload FROM character_ledger WHERE id=?').get(x.id).payload,
    original,
  );
  x.store.executeProgress(
    x.command({
      kind: 'ledger',
      entryId: x.id,
      expectedRevision: 1,
      operation: 'correct',
      quantity: 0,
      correctedQuantity: 0,
      actualGold: '',
      counterparty: '',
      reason: 'Menge berichtigt',
    }),
  );
  assert.equal(x.guidance(true).magic.received.Rare, 0);
  assert.equal(x.guidance(false).receivedCopper, '0');
});

function generateGuided(x, guided = true, magicPool, count = 1) {
  if (count > 1) x.profile = { ...x.profile, adventureDayFraction: '1' };
  const plan = {
    version: 1,
    id: x.profile.planId,
    revision: 1,
    name: 'Geprüfte Annahme',
    scenes: [],
  };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'plan', plan, expectedRevision: null },
  });
  x.store.executeSession(
    x.command({ kind: 'profile', expectedRevision: 0, profile: { ...x.profile, revision: 0 } }),
  );
  const table = {
    id: randomUUID(),
    revision: 0,
    scope: 'campaign',
    name: 'Goblinquelle',
    description: '',
    entries: [{ creatureId: 'goblin', weight: '1' }],
    habitats: [],
    time: 'any',
    lootTableId: null,
    trashed: false,
  };
  x.store.executeGeneration(x.command({ kind: 'table-save', table, expectedRevision: null }));
  const run = x.store.generateSession(x.w.token, {
    planId: plan.id,
    expectedProfileRevision: 1,
    count,
    locationIds: [],
    noteIds: [],
    compensateMagic: guided,
    ...(magicPool === undefined ? {} : { magicPool }),
    encounter: {
      tableIds: [table.id],
      filters: {},
      habitat: '',
      time: 'any',
      difficulty: 'medium',
      amount: 'neutral',
      balance: 'neutral',
      diversity: 'neutral',
      xpCeiling: 500,
    },
  });
  return run;
}
function acceptCommand(x, run, index = 0) {
  const revision = x.store.db
    .prepare('SELECT revision FROM plan WHERE campaign_id=? AND id=?')
    .get(x.cam.id, run.planId).revision;
  return x.command({
    kind: 'accept-proposal',
    planId: run.planId,
    expectedPlanRevision: revision,
    runId: run.id,
    index,
  });
}
// Both acceptance commands share assertSessionRewardBasisCurrent; the two-proposal cases below guard batch rejection, order and rollback.
for (const change of ['XP', 'new loot', 'same-value correction', 'rarity', 'planning party'])
  test(`guided proposal rejects changed ${change} before timeline or acceptance effects`, (t) => {
    const x = fixture(t),
      run = generateGuided(x);
    if (change === 'XP')
      x.store.executeProgress(
        x.command({
          kind: 'xp',
          characterId: x.characters[0].id,
          expectedRevision: 1,
          mode: 'add',
          amount: 30,
          reason: 'Nach Vorschau',
        }),
      );
    if (change === 'new loot') x.add();
    if (change === 'same-value correction')
      x.store.executeProgress(
        x.command({
          kind: 'ledger',
          entryId: x.id,
          expectedRevision: 1,
          operation: 'correct',
          quantity: 0,
          correctedQuantity: 2,
          actualGold: '',
          counterparty: '',
          reason: 'Gleichwertig berichtigt',
        }),
      );
    if (change === 'rarity')
      x.store.executeItemShop(
        x.command({
          kind: 'definition',
          expectedRevision: 1,
          definition: { ...x.definition, rarity: 'Rare' },
        }),
      );
    if (change === 'planning party')
      x.store.executeSession(
        x.command({
          kind: 'profile',
          expectedRevision: 1,
          profile: { ...x.profile, party: x.profile.party.slice(0, 1) },
        }),
      );
    const command = acceptCommand(x, run),
      bytes = x.store.db.serialize();
    assert.throws(() => x.store.executeSession(command), /Beute|Grundlage|Planungsparty|Vorschau/i);
    assert.ok(bytes.equals(x.store.db.serialize()));
    assert.equal(x.store.sessionRun(x.w.token, run.id).proposals[0].acceptedVisitId, null);
  });
test('guided acceptance with unchanged basis survives Fresh and receipt replay after a later XP change', (t) => {
  const x = fixture(t),
    run = generateGuided(x),
    command = acceptCommand(x, run),
    ack = x.store.executeSession(command);
  x.store.close();
  x.store = new CampaignStore(x.filename);
  x.w = x.store.activate(x.cam.id);
  x.store.executeProgress(
    x.command({
      kind: 'xp',
      characterId: x.characters[0].id,
      expectedRevision: 1,
      mode: 'add',
      amount: 30,
      reason: 'Späterer XP-Stand',
    }),
  );
  const bytes = x.store.db.serialize();
  assert.deepEqual(x.store.executeSession({ ...command, token: x.w.token }), ack);
  assert.ok(bytes.equals(x.store.db.serialize()));
});
test('unguided manual proposal remains independent of subsequent personal loot changes', (t) => {
  const x = fixture(t),
    run = generateGuided(x, false);
  x.add();
  const accepted = x.store.executeSession(acceptCommand(x, run));
  assert.equal(accepted.visits.length, 1);
});

test('guided source basis remains usable after independent campaign copy without rebinding original IDs', async (t) => {
  const x = fixture(t),
    run = generateGuided(x),
    file = path.join(x.root, 'guided-package.sqlite');
  await x.store.campaignSnapshot(x.w.token, file);
  const bytes = readFileSync(file),
    copy = x.store.acceptCampaignSnapshot(file, 'Geführte Kopie', {});
  x.cam = copy;
  x.w = x.store.activate(copy.id);
  const row = x.store.db.prepare('SELECT id FROM session_run WHERE campaign_id=?').get(copy.id),
    copied = x.store.sessionRun(x.w.token, row.id);
  assert.notEqual(copied.id, run.id);
  assert.ok(
    copied.lootGuidance.basis.ledger.every(
      (l) => !run.lootGuidance.basis.ledger.some((original) => original.id === l.id),
    ),
  );
  x.store.executeSession(acceptCommand(x, copied));
  assert.equal(x.store.session(x.w.token, copied.planId).visits.length, 1);
  assert.ok(bytes.equals(readFileSync(file)));
});
test('a historical guided run without source metadata stays readable but cannot create a new acceptance', (t) => {
  const x = fixture(t),
    run = generateGuided(x),
    row = x.store.db
      .prepare('SELECT payload FROM session_run WHERE campaign_id=? AND id=?')
      .get(x.cam.id, run.id),
    legacy = JSON.parse(row.payload);
  delete legacy.lootGuidance.basis;
  const payload = JSON.stringify(legacy);
  x.store.db
    .prepare('UPDATE session_run SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
    .run(payload, hash(payload), x.cam.id, run.id);
  assert.deepEqual(x.store.sessionRun(x.w.token, run.id), legacy);
  const command = acceptCommand(x, legacy),
    bytes = x.store.db.serialize();
  assert.throws(() => x.store.executeSession(command), /Grundlage/);
  assert.ok(bytes.equals(x.store.db.serialize()));
});
test('an unrelated character handout does not invalidate a guided selected-party basis', (t) => {
  const x = fixture(t),
    run = generateGuided(x),
    other = x.store.executeLive(
      x.command({ kind: 'create-character', profile: { name: 'Andere Gruppe' } }),
    ).character;
  x.add(other);
  x.store.executeSession(acceptCommand(x, run));
  assert.equal(x.store.session(x.w.token, run.planId).visits.length, 1);
});
test('acceptance rejects a revised referenced reward definition outside the personal ledger', (t) => {
  const x = fixture(t),
    run = generateGuided(x, false),
    proposal = run.proposals[0],
    definition = x.store.executeItemShop(
      x.command({
        kind: 'definition',
        expectedRevision: null,
        definition: {
          ...x.definition,
          id: randomUUID(),
          revision: 0,
          name: 'Zusätzliche Auswahl',
          unitCopper: '400',
        },
      }),
    ).definition;
  x.store.executeSession(
    x.command({
      kind: 'edit-proposal',
      planId: run.planId,
      runId: run.id,
      index: 0,
      expectedRevision: proposal.revision ?? 1,
      title: proposal.title,
      notes: proposal.notes,
      readAloud: proposal.readAloud,
      locationId: proposal.locationId,
      noteIds: proposal.noteIds,
      reward: {
        poolXp: 0,
        items: [
          {
            name: definition.name,
            category: definition.category,
            quantity: 1,
            valueGold: '4',
            reference: {
              kind: 'authored',
              definitionId: definition.id,
              revision: definition.revision,
            },
          },
        ],
      },
    }),
  );
  x.store.executeItemShop(
    x.command({
      kind: 'definition',
      expectedRevision: 1,
      definition: { ...definition, unitCopper: '500' },
    }),
  );
  const command = acceptCommand(x, run),
    bytes = x.store.db.serialize();
  assert.throws(() => x.store.executeSession(command), /Katalogbeute/);
  assert.ok(bytes.equals(x.store.db.serialize()));
});

test('purchased items do not invalidate the effective received-loot basis of a guided proposal', (t) => {
  const x = fixture(t),
    run = generateGuided(x);
  x.add(x.characters[0], 'purchase', 3);
  x.store.executeSession(acceptCommand(x, run));
  assert.equal(x.store.session(x.w.token, run.planId).visits.length, 1);
});

for (const fault of ['revision', 'trashed'])
  test(`guided acceptance rejects changed scoped magic pool ${fault} even when no selected reward uses it`, (t) => {
    const x = fixture(t),
      definition = x.store.executeItemShop(
        x.command({
          kind: 'definition',
          expectedRevision: null,
          definition: {
            ...x.definition,
            id: randomUUID(),
            revision: 0,
            name: 'Seltener Poolgegenstand',
            rarity: 'Rare',
          },
        }),
      ).definition;
    const run = generateGuided(x, true, [
      { definitionId: definition.id, revision: definition.revision },
    ]);
    assert.ok(run.lootGuidance.magic.pool.some((r) => r.definitionId === definition.id));
    assert.ok(
      run.proposals.every(
        (p) => !p.reward.items.some((i) => i.reference?.definitionId === definition.id),
      ),
    );
    x.store.executeItemShop(
      x.command({
        kind: 'definition',
        expectedRevision: definition.revision,
        definition: {
          ...definition,
          ...(fault === 'revision' ? { name: 'Geänderte Poolquelle' } : { trashed: true }),
        },
      }),
    );
    const command = acceptCommand(x, run),
      bytes = x.store.db.serialize();
    assert.throws(() => x.store.executeSession(command), /Poolauswahl/);
    assert.ok(bytes.equals(x.store.db.serialize()));
    assert.equal(x.store.sessionRun(x.w.token, run.id).proposals[0].acceptedVisitId, null);
  });
test('unchanged scoped magic pool and reward basis accept after Fresh and independent copy', async (t) => {
  const x = fixture(t),
    run = generateGuided(x, true, [
      { definitionId: x.definition.id, revision: x.definition.revision },
    ]);
  x.store.close();
  x.store = new CampaignStore(x.filename);
  x.w = x.store.activate(x.cam.id);
  const snapshot = path.join(x.root, 'pool.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const bytes = readFileSync(snapshot),
    copy = x.store.acceptCampaignSnapshot(snapshot, 'Poolkopie', {});
  x.cam = copy;
  x.w = x.store.activate(copy.id);
  const row = x.store.db.prepare('SELECT id FROM session_run WHERE campaign_id=?').get(copy.id),
    copied = x.store.sessionRun(x.w.token, row.id);
  assert.deepEqual(copied.lootGuidance.magic.pool, run.lootGuidance.magic.pool);
  x.store.executeSession(acceptCommand(x, copied));
  assert.equal(x.store.session(x.w.token, copied.planId).visits.length, 1);
  assert.ok(bytes.equals(readFileSync(snapshot)));
});

for (const change of ['damage', 'heal', 'short rest', 'long rest'])
  test(`guided proposal stays acceptable after ${change} without changing XP or loot`, (t) => {
    const x = fixture(t),
      c = x.characters[0];
    x.store.executeLive(
      x.command({
        kind: 'membership',
        characterId: c.id,
        expectedRevision: c.membershipRevision,
        expectedRosterRevision: x.store.live(x.w.token).rosterRevision,
        active: true,
        targetSceneId: null,
        expectedFocusRevision: null,
      }),
    );
    x.store.executeProgress(
      x.command({
        kind: 'health',
        characterId: c.id,
        expectedRevision: 1,
        operation: 'set',
        health: { hp: 5, maxHp: 10, tempHp: 2, conditions: '  Marked', concentrating: false },
        reason: 'Known health',
      }),
    );
    const run = generateGuided(x),
      original = structuredClone(run.lootGuidance),
      before = x.store.progress(x.w.token).characters.find((p) => p.characterId === c.id);
    if (change.endsWith('rest'))
      x.store.executeProgress(
        x.command({
          kind: 'rest',
          rest: change.startsWith('short') ? 'short' : 'long',
          restoreHp: change.startsWith('long'),
          recipients: [{ characterId: c.id, revision: before.revision }],
        }),
      );
    else
      x.store.executeProgress(
        x.command({
          kind: 'health',
          characterId: c.id,
          expectedRevision: before.revision,
          operation: change,
          amount: 2,
          reason: 'Ordinary health change',
        }),
      );
    const after = x.store.progress(x.w.token).characters.find((p) => p.characterId === c.id);
    assert.equal(after.xp, before.xp);
    assert.ok(after.revision > before.revision);
    x.store.executeSession(acceptCommand(x, run));
    assert.equal(x.store.session(x.w.token, run.planId).visits.length, 1);
    assert.deepEqual(x.store.sessionRun(x.w.token, run.id).lootGuidance, original);
    assert.deepEqual(
      x.store.progress(x.w.token).characters.find((p) => p.characterId === c.id).health,
      after.health,
    );
  });
function batchAccept(x, run) {
  return x.command({
    kind: 'accept-proposals',
    planId: run.planId,
    expectedPlanRevision: x.store.db
      .prepare('SELECT revision FROM plan WHERE campaign_id=? AND id=?')
      .get(x.cam.id, run.planId).revision,
    runId: run.id,
    proposals: [...run.proposals]
      .reverse()
      .map((p) => ({ index: p.index, expectedRevision: p.revision ?? 1 })),
  });
}
test('guided batch adoption rejects changed reward basis before any proposal is published', (t) => {
  const x = fixture(t),
    run = generateGuided(x, true, undefined, 2),
    command = batchAccept(x, run);
  x.store.executeProgress(
    x.command({
      kind: 'xp',
      characterId: x.characters[0].id,
      expectedRevision: 1,
      mode: 'add',
      amount: 30,
      reason: 'Nach Vorschau',
    }),
  );
  const before = x.store.db.serialize();
  assert.throws(() => x.store.executeSession(command), /Beute|Grundlage|Vorschau/i);
  assert.ok(before.equals(x.store.db.serialize()));
  assert.ok(x.store.sessionRun(x.w.token, run.id).proposals.every((p) => !p.acceptedVisitId));
});
test('guided batch adoption preserves source order and exact receipts after Fresh', (t) => {
  const x = fixture(t),
    run = generateGuided(x, true, undefined, 2),
    command = batchAccept(x, run),
    ack = x.store.executeSession(command),
    saved = x.store.sessionRun(x.w.token, run.id),
    plan = x.store.preparation(x.w.token).plans.find((p) => p.id === run.planId);
  assert.deepEqual(
    plan.scenes.map((v) => v.id),
    saved.proposals.map((p) => p.acceptedVisitId),
  );
  assert.equal(ack.visits.length, 2);
  x.store.close();
  x.store = new CampaignStore(x.filename);
  x.w = x.store.activate(x.cam.id);
  const before = x.store.db.serialize();
  assert.deepEqual(
    x.store.executeSession({ ...command, token: x.w.token }),
    JSON.parse(JSON.stringify(ack)),
  );
  assert.ok(before.equals(x.store.db.serialize()));
});
test('failure during the second batch group rolls back the first proposal, timeline and acceptance receipts', (t) => {
  const x = fixture(t),
    run = generateGuided(x, true, undefined, 2),
    command = batchAccept(x, run);
  x.store.db.exec(
    "CREATE TRIGGER controlled_batch_group_fault BEFORE INSERT ON prepared_group WHEN (SELECT count(*) FROM prepared_group)>0 BEGIN SELECT RAISE(ABORT,'controlled batch group fault'); END",
  );
  const before = x.store.db.serialize();
  assert.throws(() => x.store.executeSession(command), /controlled batch group fault/);
  assert.ok(before.equals(x.store.db.serialize()));
  assert.ok(x.store.sessionRun(x.w.token, run.id).proposals.every((p) => !p.acceptedVisitId));
  x.store.db.exec('DROP TRIGGER controlled_batch_group_fault');
  assert.equal(x.store.executeSession(command).visits.length, 2);
});

test('session replay pins ledger semantics: changed grants create new run, repeated unchanged input resumes it', (t) => {
  const x = fixture(t),
    run = generateGuided(x),
    request = run.origin.request;
  assert.equal(x.store.generateSession(x.w.token, request).id, run.id);
  x.add(x.characters[0], 'manual', 1);
  const next = x.store.generateSession(x.w.token, request);
  assert.notEqual(next.id, run.id);
  assert.equal(next.lootGuidance.magic.received.Common, 3);
  assert.equal(x.store.generateSession(x.w.token, request).id, next.id);
  assert.deepEqual(x.store.sessionRun(x.w.token, run.id), run);
});

test('new magic catalog candidates invalidate the unscoped reward calculation without replacing the saved run', (t) => {
  const x = fixture(t),
    run = generateGuided(x),
    request = run.origin.request;
  x.store.executeItemShop(
    x.command({
      kind: 'definition',
      expectedRevision: null,
      definition: { ...x.definition, id: randomUUID(), revision: 0, name: 'Neuer Magiefund' },
    }),
  );
  const next = x.store.generateSession(x.w.token, request);
  assert.notEqual(next.id, run.id);
  assert.equal(next.origin.itemCatalog.length, run.origin.itemCatalog.length + 1);
  assert.deepEqual(x.store.sessionRun(x.w.token, run.id), run);
});

import { readWorkspaceMarkup } from '../../tools/desktop-markup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/campaign/session-ui.ts'],
  outfile: '.build/session-review-owner.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
mkdirSync('.build/catalog', { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  '.build/catalog/srd-5.1.generated.json',
);
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {validateItemInput,checkedItem} from './src/app/storage/progression';",
    resolveDir: process.cwd(),
    sourcefile: 'proposal-store.ts',
  },
  outfile: '.build/session-proposal-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, validateItemInput, checkedItem } = createRequire(import.meta.url)(
  '../../.build/session-proposal-store.cjs',
);
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'session-proposal-')),
    file = path.join(root, 'source.sqlite'),
    store = new CampaignStore(file),
    cam = store.create('Session'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const planId = randomUUID();
  store.changePreparation({
    ...command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: { version: 1, id: planId, revision: 1, name: 'Evening', scenes: [] },
    },
  });
  const hero = store.executeLive(
    command({ kind: 'create-character', profile: { name: 'Hero' } }),
  ).character;
  const profile = store.session(w.token, planId).profile;
  store.executeSession(
    command({
      kind: 'profile',
      expectedRevision: profile.revision,
      profile: {
        ...profile,
        party: [{ id: hero.id, name: 'Hero', count: 1, level: 1 }],
        adventureDayFraction: '1',
        seed: 'guards',
      },
    }),
  );
  const tableId = randomUUID();
  store.executeGeneration(
    command({
      kind: 'table-save',
      expectedRevision: null,
      table: {
        id: tableId,
        revision: 0,
        scope: 'campaign',
        name: 'Watch',
        description: '',
        entries: [{ creatureId: 'guard', weight: '1' }],
        habitats: [],
        time: 'any',
        lootTableId: null,
        trashed: false,
      },
    }),
  );
  const run = store.generateSession(w.token, {
    planId,
    expectedProfileRevision: profile.revision + 1,
    count: 2,
    locationIds: [],
    noteIds: [],
    encounter: {
      tableIds: [tableId],
      filters: { text: 'guard' },
      habitat: '',
      time: 'any',
      difficulty: 'easy',
      amount: 'neutral',
      balance: 'neutral',
      diversity: 'neutral',
    },
  });
  const item = { name: '  Ring', quantity: 2, valueGold: '2.5', category: 'equipment' },
    action = {
      kind: 'edit-proposal',
      planId,
      runId: run.id,
      index: 0,
      expectedRevision: 1,
      title: '  Gate',
      notes: '  Private\r\n',
      readAloud: '  Public\r\n',
      locationId: null,
      noteIds: [],
      reward: { poolXp: 10, items: [item] },
    };
  return { root, file, store, cam, w, command, planId, run, item, action, hero };
}
test('proposal edits and independent encounter regeneration preserve author content and create no World loot', async (t) => {
  const x = fixture(t),
    before = x.store.db.prepare('SELECT count(*) n FROM authored_item').get().n,
    edit = x.command(x.action),
    result = x.store.executeSession(edit);
  assert.deepEqual(x.store.executeSession(edit), result);
  const edited = x.store.sessionRun(x.w.token, x.run.id);
  assert.equal(edited.proposals[0].notes, x.action.notes);
  assert.deepEqual(edited.proposals[0].reward, x.action.reward);
  assert.deepEqual(edited.proposals[1], x.run.proposals[1]);
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM authored_item').get().n, before);
  assert.equal(x.store.treasures(x.w.token, null).items.length, 0);
  assert.equal(
    x.store.preparation(x.w.token).plans.find((p) => p.id === x.planId).scenes.length,
    0,
  );
  const next = x.store.regenerateSessionProposal(x.w.token, edited.id, 0, 'new seed');
  assert.equal(next.proposals[0].notes, x.action.notes);
  assert.equal(next.proposals[0].readAloud, x.action.readAloud);
  assert.deepEqual(next.proposals[0].reward, x.action.reward);
  assert.deepEqual(next.proposals[1], edited.proposals[1]);
  await x.store.backup(path.join(x.root, 'safe.sqlite'));
});
test('invalid and stale proposal rewards cause no partial writes', (t) => {
  const x = fixture(t);
  for (const mutate of [
    (a) => (a.reward.items[0].quantity = 0),
    (a) => (a.reward.items[0].valueGold = '-'),
    (a) => (a.reward.items = Array.from({ length: 101 }, () => x.item)),
    (a) => (a.expectedRevision = 99),
    (a) => (a.reward.items[0] = Object.assign([], { ...x.item })),
    (a) => (a.reward = Object.assign([], { ...a.reward })),
  ]) {
    const action = structuredClone(x.action);
    mutate(action);
    const bytes = x.store.db.serialize();
    assert.throws(() => x.store.executeSession(x.command(action)));
    assert.ok(x.store.db.serialize().equals(bytes));
  }
});
test('read-only item validation and materialization share the same rules', (t) => {
  const x = fixture(t),
    before = x.store.db.serialize();
  validateItemInput(x.store.db, x.item);
  assert.ok(x.store.db.serialize().equals(before));
  const made = checkedItem(x.store.db, x.item);
  assert.equal(made.quantity, 2);
  assert.equal(made.unitCopper, '250');
  const pinned = { ...x.item, reference: made.reference };
  assert.equal(validateItemInput(x.store.db, pinned).id, made.reference.definitionId);
  for (const change of [
    (i) => (i.quantity = 0),
    (i) => (i.name = ''),
    (i) => (i.category = 'invalid'),
    (i) => (i.reference.revision = 999),
    (i) => (i.reference.kind = 'invalid'),
    (i) => (i.reference = Object.assign([], { ...i.reference })),
  ]) {
    const item = structuredClone(pinned);
    change(item);
    const bytes = x.store.db.serialize();
    assert.throws(() => validateItemInput(x.store.db, item));
    assert.throws(() => checkedItem(x.store.db, item));
    assert.ok(x.store.db.serialize().equals(bytes));
  }
});
test('accepted proposal and reward retain independent identities and author text through copy and fresh', async (t) => {
  const x = fixture(t);
  x.store.executeSession(x.command(x.action));
  const plan = x.store.preparation(x.w.token).plans.find((p) => p.id === x.planId);
  x.store.executeSession(
    x.command({
      kind: 'accept-proposal',
      planId: x.planId,
      runId: x.run.id,
      index: 0,
      expectedPlanRevision: plan.revision,
    }),
  );
  const snapshot = path.join(x.root, 'snapshot.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const original = readFileSync(snapshot),
    file = path.join(x.root, 'copy.sqlite'),
    copy = new CampaignStore(file);
  let camId, planId, runId;
  try {
    const cam = copy.acceptCampaignSnapshot(snapshot, 'Copy', {}),
      w = copy.activate(cam.id);
    camId = cam.id;
    planId = copy.preparation(w.token).plans[0].id;
    runId = copy.sessionRuns(w.token, planId)[0].id;
    assert.notEqual(planId, x.planId);
    assert.notEqual(runId, x.run.id);
    const copied = copy.sessionRun(w.token, runId);
    assert.notEqual(copied.generationRunId, x.run.generationRunId);
    assert.equal(copy.generationRun(w.token, copied.generationRunId).id, copied.generationRunId);
    assert.equal(copied.proposals[0].notes, x.action.notes);
    assert.notEqual(
      copied.proposals[0].acceptedVisitId,
      x.store.sessionRun(x.w.token, x.run.id).proposals[0].acceptedVisitId,
    );
    assert.deepEqual(copied.proposals[0].reward, x.action.reward);
    await copy.backup(path.join(x.root, 'copy-safe.sqlite'));
  } finally {
    copy.close();
  }
  const fresh = new CampaignStore(file);
  try {
    const w = fresh.activate(camId);
    assert.equal(fresh.sessionRun(w.token, runId).proposals[0].notes, x.action.notes);
    assert.equal(fresh.session(w.token, planId).visits[0].reward.items[0].quantity, 2);
  } finally {
    fresh.close();
  }
  assert.ok(readFileSync(snapshot).equals(original));
});

for (const [name, mutate] of [
  ['run identity', (r) => (r.id = randomUUID())],
  ['plan identity', (r) => (r.planId = randomUUID())],
  ['future profile', (r) => (r.profileRevision = 99)],
  ['budget', (r) => r.usedXp++],
  ['negative reward', (r) => (r.proposals[0].reward.items[0].quantity = -1)],
  ['raw numeric reward', (r) => (r.proposals[0].reward.items[0].quantity = '01')],
  ['proposal order', (r) => (r.proposals[0].index = 99)],
  ['repeated proposal', (r) => (r.proposals[1].id = r.proposals[0].id)],
  ['unknown location', (r) => (r.proposals[0].locationId = randomUUID())],
  ['unknown knowledge', (r) => (r.proposals[0].noteIds = [randomUUID()])],
  ['source identity', (r) => (r.generationRunId = randomUUID())],
  ['source index', (r) => (r.proposals[0].encounter.generationOrigin.index = -1)],
  ['assessment', (r) => r.proposals[0].encounter.assessment.baseXp++],
  ['status', (r) => (r.proposals[0].rejected = 'yes')],
])
  test(`checksummed proposal ${name} damage cannot replace a safe backup`, async (t) => {
    const x = fixture(t);
    x.store.executeSession(x.command(x.action));
    const safe = path.join(x.root, 'safe.sqlite');
    await x.store.backup(safe);
    const before = readFileSync(safe),
      row = x.store.db
        .prepare('SELECT payload FROM session_run WHERE campaign_id=? AND id=?')
        .get(x.cam.id, x.run.id),
      run = JSON.parse(row.payload);
    mutate(run);
    const payload = JSON.stringify(run);
    x.store.db
      .prepare('UPDATE session_run SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
      .run(payload, createHash('sha256').update(payload).digest('hex'), x.cam.id, x.run.id);
    const bytes = x.store.db.serialize();
    assert.throws(() => x.store.sessionRun(x.w.token, x.run.id));
    assert.throws(() => x.store.sessionRuns(x.w.token, x.planId));
    await assert.rejects(x.store.backup(safe));
    assert.ok(readFileSync(safe).equals(before));
    assert.ok(x.store.db.serialize().equals(bytes));
  });
test('invalid proposal acceptance cannot replace a safe backup', async (t) => {
  const x = fixture(t),
    safe = path.join(x.root, 'safe.sqlite');
  await x.store.backup(safe);
  const before = readFileSync(safe);
  x.store.db
    .prepare('INSERT INTO session_proposal_acceptance VALUES(?,?,?,?)')
    .run(x.cam.id, x.run.id, 99, randomUUID());
  const bytes = x.store.db.serialize();
  assert.throws(() => x.store.sessionRun(x.w.token, x.run.id));
  await assert.rejects(x.store.backup(safe));
  assert.ok(readFileSync(safe).equals(before));
  assert.ok(x.store.db.serialize().equals(bytes));
});
test('stale profile and archived world references preserve valid proposals', async (t) => {
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
        kind: 'rumor',
        title: 'Harbor',
        readAloud: '',
        gmNotes: '',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    },
  });
  x.store.executeSession(x.command({ ...x.action, noteIds: [id] }));
  const profile = x.store.session(x.w.token, x.planId).profile;
  x.store.executeSession(
    x.command({
      kind: 'profile',
      expectedRevision: profile.revision,
      profile: { ...profile, seed: 'Changed' },
    }),
  );
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note-trash', id, expectedRevision: 1, trashed: true },
  });
  assert.deepEqual(x.store.sessionRun(x.w.token, x.run.id).proposals[0].noteIds, [id]);
  await x.store.backup(path.join(x.root, 'stale-safe.sqlite'));
});

function guided(x, magic = false, magicPool) {
  const progress = x.store.progress(x.w.token).characters.find((c) => c.characterId === x.hero.id);
  x.store.executeProgress(
    x.command({
      kind: 'xp',
      characterId: x.hero.id,
      expectedRevision: progress.revision,
      mode: 'set',
      amount: 0,
      reason: 'Known planning XP',
    }),
  );
  const profile = x.store.session(x.w.token, x.planId).profile,
    encounter = x.store.generationRun(x.w.token, x.run.generationRunId).request;
  return x.store.generateSession(x.w.token, {
    planId: x.planId,
    expectedProfileRevision: profile.revision,
    count: 2,
    locationIds: [],
    noteIds: [],
    compensateLoot: true,
    compensateMagic: magic,
    magicPool,
    encounter,
  });
}
test('cumulative loot snapshots copy with independent roster and generator identities', async (t) => {
  const x = fixture(t),
    run = guided(x);
  assert.ok(run.lootGuidance);
  const snapshot = path.join(x.root, 'guided.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const copy = x.store.acceptCampaignSnapshot(snapshot, 'Guided copy', {}),
    w = x.store.activate(copy.id),
    id = x.store.sessionRuns(w.token, x.store.preparation(w.token).plans[0].id)[0].id,
    copied = x.store.sessionRun(w.token, id);
  assert.notEqual(copied.lootGuidance.characters[0].characterId, x.hero.id);
  assert.deepEqual(copied.lootGuidance.allocationsCopper, run.lootGuidance.allocationsCopper);
  assert.notEqual(copied.generationRunId, run.generationRunId);
  await x.store.backup(path.join(x.root, 'guided-safe.sqlite'));
});
for (const [name, mutate] of [
  ['allocation', (g) => (g.allocationsCopper[0] = '-1')],
  ['total', (g) => (g.targetCopper = String(BigInt(g.targetCopper) + 1n))],
  ['roster owner', (g) => (g.characters[0].characterId = randomUUID())],
  ['expected total', (g) => (g.expectedBeforeCopper = String(BigInt(g.expectedBeforeCopper) + 1n))],
  ['credit total', (g) => (g.receivedCopper = String(BigInt(g.receivedCopper) + 1n))],
  ['difference', (g) => (g.differenceCopper = String(BigInt(g.differenceCopper) + 1n))],
  ['baseline', (g) => (g.baselineCopper = String(BigInt(g.baselineCopper) + 1n))],
  ['duplicate roster', (g) => g.characters.push({ ...g.characters[0] })],
  ['preset hash', (g) => (g.preset.hash = 'invalid')],
])
  test(`checksummed cumulative loot ${name} damage retains the safe backup`, async (t) => {
    const x = fixture(t),
      run = guided(x),
      safe = path.join(x.root, 'guided-safe.sqlite');
    await x.store.backup(safe);
    const before = readFileSync(safe),
      row = x.store.db
        .prepare('SELECT payload FROM session_run WHERE campaign_id=? AND id=?')
        .get(x.cam.id, run.id),
      v = JSON.parse(row.payload);
    mutate(v.lootGuidance);
    const payload = JSON.stringify(v);
    x.store.db
      .prepare('UPDATE session_run SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
      .run(payload, createHash('sha256').update(payload).digest('hex'), x.cam.id, run.id);
    const bytes = x.store.db.serialize();
    assert.throws(() => x.store.sessionRun(x.w.token, run.id));
    await assert.rejects(x.store.backup(safe));
    assert.ok(readFileSync(safe).equals(before));
    assert.ok(x.store.db.serialize().equals(bytes));
  });

test('cumulative reward planning rejects checksummed ledger ownership damage without writes', (t) => {
  const x = fixture(t);
  x.store.executeProgress(
    x.command({
      kind: 'manual-item',
      characterId: x.hero.id,
      expectedMembershipRevision: x.hero.membershipRevision,
      origin: 'manual',
      item: x.item,
      note: 'Confirmed grant',
    }),
  );
  const row = x.store.db
      .prepare('SELECT * FROM character_ledger WHERE campaign_id=?')
      .get(x.cam.id),
    item = JSON.parse(row.payload);
  item.characterId = randomUUID();
  const payload = JSON.stringify(item);
  x.store.db
    .prepare('UPDATE character_ledger SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
    .run(payload, createHash('sha256').update(payload).digest('hex'), x.cam.id, row.id);
  const progress = x.store.progress(x.w.token).characters.find((c) => c.characterId === x.hero.id);
  x.store.executeProgress(
    x.command({
      kind: 'xp',
      characterId: x.hero.id,
      expectedRevision: progress.revision,
      mode: 'set',
      amount: 0,
      reason: 'Known XP',
    }),
  );
  const bytes = x.store.db.serialize(),
    profile = x.store.session(x.w.token, x.planId).profile,
    encounter = x.store.generationRun(x.w.token, x.run.generationRunId).request;
  assert.throws(() =>
    x.store.generateSession(x.w.token, {
      planId: x.planId,
      expectedProfileRevision: profile.revision,
      count: 2,
      locationIds: [],
      noteIds: [],
      compensateLoot: true,
      encounter,
    }),
  );
  assert.ok(x.store.db.serialize().equals(bytes));
});
test('edited rewards retain the original calculation after XP and ledger changes', async (t) => {
  const x = fixture(t),
    run = guided(x),
    original = structuredClone(run.lootGuidance);
  x.store.executeSession(
    x.command({
      ...x.action,
      runId: run.id,
      reward: { poolXp: 50, items: [{ ...x.item, valueGold: '999' }] },
    }),
  );
  const progress = x.store.progress(x.w.token).characters.find((c) => c.characterId === x.hero.id);
  x.store.executeProgress(
    x.command({
      kind: 'xp',
      characterId: x.hero.id,
      expectedRevision: progress.revision,
      mode: 'add',
      amount: 100,
      reason: 'Other session',
    }),
  );
  x.store.executeProgress(
    x.command({
      kind: 'manual-item',
      characterId: x.hero.id,
      expectedMembershipRevision: x.hero.membershipRevision,
      origin: 'manual',
      item: x.item,
      note: 'Later grant',
    }),
  );
  assert.deepEqual(x.store.sessionRun(x.w.token, run.id).lootGuidance, original);
  await x.store.backup(path.join(x.root, 'edited-safe.sqlite'));
});

test('confirmed loot surplus keeps a negative deficit and zero new reward without altering old grants', async (t) => {
  const x = fixture(t);
  x.store.executeProgress(
    x.command({
      kind: 'manual-item',
      characterId: x.hero.id,
      expectedMembershipRevision: x.hero.membershipRevision,
      origin: 'manual',
      item: { ...x.item, valueGold: '1000000' },
      note: 'Previous hoard',
    }),
  );
  const before = x.store.db
      .prepare('SELECT payload FROM character_ledger WHERE campaign_id=? ORDER BY id')
      .all(x.cam.id),
    run = guided(x);
  assert.ok(BigInt(run.lootGuidance.differenceCopper) < 0n);
  assert.equal(run.lootGuidance.targetCopper, '0');
  assert.deepEqual(run.lootGuidance.allocationsCopper, ['0', '0']);
  assert.ok(run.proposals.every((p) => p.reward.items.length === 0));
  assert.deepEqual(
    x.store.db
      .prepare('SELECT payload FROM character_ledger WHERE campaign_id=? ORDER BY id')
      .all(x.cam.id),
    before,
  );
  await x.store.backup(path.join(x.root, 'surplus-safe.sqlite'));
});

test('magic quota snapshots copy with roster identities and preserve their original calculation', async (t) => {
  const x = fixture(t),
    run = guided(x, true);
  assert.equal(run.lootGuidance.version, 'cumulative-gold-magic-v2');
  assert.ok(run.lootGuidance.magic);
  const snapshot = path.join(x.root, 'magic.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const copy = x.store.acceptCampaignSnapshot(snapshot, 'Magic copy', {}),
    w = x.store.activate(copy.id),
    id = x.store.sessionRuns(w.token, x.store.preparation(w.token).plans[0].id)[0].id,
    copied = x.store.sessionRun(w.token, id);
  assert.notEqual(copied.lootGuidance.magic.characters[0].characterId, x.hero.id);
  assert.equal(
    copied.lootGuidance.magic.characters[0].characterId,
    copied.lootGuidance.characters[0].characterId,
  );
  assert.deepEqual(copied.lootGuidance.magic.allocations, run.lootGuidance.magic.allocations);
  await x.store.backup(path.join(x.root, 'magic-safe.sqlite'));
});
for (const [name, mutate] of [
  ['allocation', (g) => g.magic.allocations[0].Common++],
  ['received', (g) => g.magic.received.Common++],
  ['owner', (g) => (g.magic.characters[0].characterId = randomUUID())],
])
  test(`checksummed magic ${name} damage preserves the safe snapshot`, async (t) => {
    const x = fixture(t),
      run = guided(x, true),
      safe = path.join(x.root, 'magic-safe.sqlite');
    await x.store.backup(safe);
    const original = readFileSync(safe),
      row = x.store.db
        .prepare('SELECT payload FROM session_run WHERE campaign_id=? AND id=?')
        .get(x.cam.id, run.id),
      body = JSON.parse(row.payload);
    mutate(body.lootGuidance);
    const payload = JSON.stringify(body);
    x.store.db
      .prepare('UPDATE session_run SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
      .run(payload, createHash('sha256').update(payload).digest('hex'), x.cam.id, run.id);
    assert.throws(() => x.store.sessionRun(x.w.token, run.id));
    await assert.rejects(x.store.backup(safe));
    assert.ok(readFileSync(safe).equals(original));
  });

for (const [name, damage] of [
  [
    'pool revision',
    (g) =>
      (g.magic.pool = [{ definitionId: 'missing', revision: 0, name: 'Magic', rarity: 'Common' }]),
  ],
  [
    'pool rarity',
    (g) =>
      (g.magic.pool = [
        { definitionId: 'missing', revision: 1, name: 'Magic', rarity: 'invented' },
      ]),
  ],
  [
    'missing pool definition',
    (g) =>
      (g.magic.pool = [{ definitionId: 'missing', revision: 1, name: 'Magic', rarity: 'Common' }]),
  ],
  ['basis shape', (g) => (g.basis.ledger = {})],
  [
    'basis owner',
    (g) => (g.basis.ledger = [{ id: 'missing', characterId: 'foreign', revision: 1 }]),
  ],
  ['basis revision', (g) => (g.basis.definitions = [{ definitionId: 'missing', revision: -1 }])],
])
  test(`saved ${name} corruption cannot replace a safe backup`, async (t) => {
    const x = fixture(t),
      run = guided(x, true),
      safe = path.join(x.root, 'pool-safe.sqlite');
    await x.store.backup(safe);
    const saved = readFileSync(safe),
      body = structuredClone(run);
    damage(body.lootGuidance);
    const payload = JSON.stringify(body);
    x.store.db
      .prepare('UPDATE session_run SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
      .run(payload, createHash('sha256').update(payload).digest('hex'), x.cam.id, run.id);
    const bytes = x.store.db.serialize();
    assert.throws(() => x.store.sessionRun(x.w.token, run.id));
    await assert.rejects(x.store.backup(safe));
    assert.ok(saved.equals(readFileSync(safe)));
    assert.ok(bytes.equals(x.store.db.serialize()));
  });
test('an explicit empty magic pool remains empty and copy-safe without creating World items', async (t) => {
  const x = fixture(t),
    before = x.store.db.prepare('SELECT count(*) n FROM authored_item').get().n,
    run = guided(x, true, []);
  assert.deepEqual(run.lootGuidance.magic.pool, []);
  assert.deepEqual(x.store.sessionRun(x.w.token, run.id), run);
  assert.ok(run.proposals.every((p) => p.reward.items.every((i) => i.category !== 'magic')));
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM authored_item').get().n, before);
  const file = path.join(x.root, 'empty-pool.sqlite');
  await x.store.campaignSnapshot(x.w.token, file);
  const copy = x.store.acceptCampaignSnapshot(file, 'Empty pool copy', {}),
    w = x.store.activate(copy.id),
    planId = x.store.preparation(w.token).plans[0].id,
    id = x.store.sessionRuns(w.token, planId)[0].id;
  assert.deepEqual(x.store.sessionRun(w.token, id).lootGuidance.magic.pool, []);
  await x.store.backup(path.join(x.root, 'empty-pool-safe.sqlite'));
});

test('a pinned magic pool remains readable and copy-safe after its definition is archived', async (t) => {
  const x = fixture(t),
    definition = x.store.executeItemShop(
      x.command({
        kind: 'definition',
        expectedRevision: null,
        definition: {
          id: randomUUID(),
          revision: 0,
          name: '  Lantern',
          category: 'magic',
          magic: true,
          rarity: 'Common',
          attunement: 'no',
          unitCopper: '100',
          weightText: '',
          properties: [],
          description: '  GM prose\r\n',
          source: { kind: 'authored', label: 'GM', license: null, url: null },
          trashed: false,
        },
      }),
    ).definition,
    run = guided(x, true, [{ definitionId: definition.id, revision: definition.revision }]);
  assert.equal(run.lootGuidance.magic.pool[0].definitionId, definition.id);
  x.store.executeItemShop(
    x.command({
      kind: 'definition',
      expectedRevision: definition.revision,
      definition: { ...definition, trashed: true },
    }),
  );
  assert.deepEqual(x.store.sessionRun(x.w.token, run.id), run);
  const file = path.join(x.root, 'archived-pool.sqlite');
  await x.store.campaignSnapshot(x.w.token, file);
  const bytes = readFileSync(file),
    copy = x.store.acceptCampaignSnapshot(file, 'Pinned pool copy', {}),
    w = x.store.activate(copy.id),
    planId = x.store.preparation(w.token).plans[0].id,
    id = x.store.sessionRuns(w.token, planId)[0].id;
  assert.equal(x.store.sessionRun(w.token, id).lootGuidance.magic.pool[0].name, definition.name);
  assert.ok(bytes.equals(readFileSync(file)));
  await x.store.backup(path.join(x.root, 'pinned-pool-safe.sqlite'));
});

test('batch adoption preserves proposal order and contents with one timeline revision and replay', async (t) => {
  const x = fixture(t);
  x.store.executeSession(x.command(x.action));
  const run = x.store.sessionRun(x.w.token, x.run.id),
    plan = x.store.preparation(x.w.token).plans.find((p) => p.id === x.planId);
  const command = x.command({
      kind: 'accept-proposals',
      planId: x.planId,
      expectedPlanRevision: plan.revision,
      runId: run.id,
      proposals: [...run.proposals]
        .reverse()
        .map((p) => ({ index: p.index, expectedRevision: p.revision ?? 1 })),
    }),
    ack = x.store.executeSession(command),
    after = x.store.db.serialize();
  const updated = x.store.preparation(x.w.token).plans.find((p) => p.id === x.planId);
  assert.equal(updated.revision, plan.revision + 1);
  assert.deepEqual(
    updated.scenes.map((s) => s.title),
    run.proposals.map((p) => p.title),
  );
  assert.equal(ack.groups.length, 2);
  assert.equal(ack.visits[0].readAloud, x.action.readAloud);
  assert.deepEqual(ack.visits[0].reward.items, x.action.reward.items);
  assert.equal(x.store.treasures(x.w.token, null).items.length, 0);
  assert.deepEqual(x.store.executeSession(command), ack);
  assert.ok(x.store.db.serialize().equals(after));
  const fresh = new CampaignStore(x.file);
  try {
    const w = fresh.activate(x.cam.id);
    assert.deepEqual(fresh.executeSession({ ...command, token: w.token }), ack);
    assert.equal(
      fresh.sessionRun(w.token, run.id).proposals.filter((p) => p.acceptedVisitId).length,
      2,
    );
  } finally {
    fresh.close();
  }
});
test('stale batch member prevents every timeline, group and reward effect', (t) => {
  const x = fixture(t),
    before = x.store.db.serialize(),
    command = x.command({
      kind: 'accept-proposals',
      planId: x.planId,
      expectedPlanRevision: 1,
      runId: x.run.id,
      proposals: [
        { index: 0, expectedRevision: 1 },
        { index: 1, expectedRevision: 99 },
      ],
    });
  assert.throws(() => x.store.executeSession(command), /geändert/);
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(x.store.session(x.w.token, x.planId).groups.length, 0);
});
test('failure while recording the second batch member rolls back the entire adoption', (t) => {
  const x = fixture(t);
  x.store.db.exec(
    "CREATE TRIGGER fail_second_adoption BEFORE INSERT ON session_proposal_acceptance WHEN NEW.proposal_index=1 BEGIN SELECT RAISE(ABORT, 'second adoption fault'); END",
  );
  const before = x.store.db.serialize(),
    command = x.command({
      kind: 'accept-proposals',
      planId: x.planId,
      expectedPlanRevision: 1,
      runId: x.run.id,
      proposals: x.run.proposals.map((p) => ({
        index: p.index,
        expectedRevision: p.revision ?? 1,
      })),
    });
  assert.throws(() => x.store.executeSession(command), /second adoption fault/);
  assert.ok(x.store.db.serialize().equals(before));
  assert.ok(
    x.store.sessionRun(x.w.token, x.run.id).proposals.every((p) => p.acceptedVisitId === null),
  );
});

test('a delayed accepted batch read cannot populate the next plan in the real session UI', async (t) => {
  const x = fixture(t),
    { window, document } = parseHTML(readWorkspaceMarkup()),
    saved = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document });
  const storage = new Map();
  window.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };
  const create = document.createElement.bind(document);
  document.createElement = (tag, ...args) => {
    const node = create(tag, ...args);
    if (tag === 'select') Object.defineProperty(node, 'value', { value: '', writable: true });
    if (tag === 'dialog') {
      node.showModal = () => {
        node.open = true;
      };
      node.close = () => {
        node.open = false;
      };
    }
    return node;
  };
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { value: '', writable: true });
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.showModal = () => {
      dialog.open = true;
    };
    dialog.close = () => {
      dialog.open = false;
    };
  }
  const requireUI = createRequire(import.meta.url),
    file = requireUI.resolve('../../.build/session-review-owner.cjs');
  delete requireUI.cache[file];
  const ui = requireUI(file),
    messages = [];
  let held = false,
    release;
  const tick = () => new Promise((r) => setImmediate(r)),
    until = async (fn) => {
      const deadline = Date.now() + 3000;
      while (!fn() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 5));
      assert.ok(fn());
    };
  t.after(async () => {
    if (release) release();
    ui.sessionContext(null, null, null, null);
    await tick();
    Object.assign(globalThis, saved);
  });
  const nextId = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: { version: 1, id: nextId, revision: 1, name: 'Next evening', scenes: [] },
    },
  });
  const ok = (fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  window.campaign = {};
  for (const method of [
    'session',
    'progress',
    'encounterTables',
    'sessionRuns',
    'generationSources',
    'executeSession',
  ])
    window.campaign[method] = async (...args) => ok(() => x.store[method](...args));
  window.campaign.sessionRun = async (...args) => {
    const result = ok(() => x.store.sessionRun(...args));
    if (!held) return result;
    return new Promise((resolve) => {
      release = () => resolve(result);
    });
  };
  ui.initSession(
    (...args) => messages.push(args),
    async () => true,
    async () => {},
    async () => {},
  );
  const context = async (id) => {
    const sources = x.store.preparation(x.w.token);
    await ui.sessionContext(
      x.w,
      sources.plans.find((p) => p.id === id),
      null,
      sources,
    );
  };
  await context(x.planId);
  const history = document.getElementById('session-history');
  history.value = x.run.id;
  history.onchange();
  await until(() => document.querySelectorAll('.session-proposal').length === 2);
  document.getElementById('session-select-visible').click();
  document.getElementById('session-review-selection').click();
  await until(
    () =>
      document.getElementById('session-selection-dialog').open &&
      !document.getElementById('session-selection-confirm').disabled,
  );
  held = true;
  document.getElementById('session-selection-confirm').click();
  await until(() => typeof release === 'function');
  assert.equal(
    x.store.preparation(x.w.token).plans.find((p) => p.id === x.planId).scenes.length,
    2,
  );
  await context(nextId);
  assert.equal(document.getElementById('session-preview').textContent, '');
  release();
  await tick();
  await tick();
  await tick();
  assert.equal(document.getElementById('session-preview').textContent, '');
  assert.ok(!messages.some(([text]) => text.includes('Die Spielabendmappe ist bereit')));
  assert.equal(x.store.preparation(x.w.token).plans.find((p) => p.id === nextId).scenes.length, 0);
});

for (const field of ['notes', 'readAloud'])
  for (const overflow of [false, true])
    test(`session generation ${overflow ? 'rejects unreadable' : 'preserves boundary-size'} ${field}`, (t) => {
      const x = fixture(t),
        noteIds = [],
        source = x.store.generationRun(x.w.token, x.run.generationRunId);
      const overhead =
        field === 'notes'
          ? [source.plans[0].notes, 'Source 0\n', 'Source 2\n'].join('\n\n').length
          : 2;
      const size = 2000000 - overhead + (overflow ? 1 : 0),
        parts = [Math.floor(size / 2), 0, Math.ceil(size / 2)];
      for (let i = 0; i < 3; i++) {
        const id = randomUUID();
        noteIds.push(id);
        x.store.changePreparation({
          ...x.command(null),
          change: {
            kind: 'note',
            expectedRevision: null,
            note: {
              version: 1,
              id,
              revision: 1,
              kind: 'quest',
              title: 'Source ' + i,
              readAloud: field === 'readAloud' ? 'R'.repeat(parts[i]) : '',
              gmNotes: field === 'notes' ? 'N'.repeat(parts[i]) : '',
              relations: [],
              creatureId: null,
              deleted: false,
            },
          },
        });
      }
      const request = {
          planId: x.planId,
          expectedProfileRevision: 1,
          count: 2,
          locationIds: [],
          noteIds,
          encounter: source.request,
        },
        bytes = x.store.db.serialize(),
        history = x.store.sessionRuns(x.w.token, x.planId);
      if (overflow) {
        assert.throws(() => x.store.generateSession(x.w.token, request), /Szenenvorschlag/);
        assert.ok(x.store.db.serialize().equals(bytes), 'no partial encounter or session run');
        assert.deepEqual(x.store.sessionRuns(x.w.token, x.planId), history);
      } else {
        const run = x.store.generateSession(x.w.token, request);
        assert.equal(run.proposals[0][field].length, 2000000);
        const fresh = new CampaignStore(x.file);
        try {
          const w = fresh.activate(x.cam.id);
          assert.deepEqual(fresh.sessionRun(w.token, run.id), run);
        } finally {
          fresh.close();
        }
      }
      const note = x.store.preparation(x.w.token).notes.find((n) => n.note.id === noteIds[0]).note;
      assert.equal(note[field === 'notes' ? 'gmNotes' : 'readAloud'].length, parts[0]);
    });

test('session saving failure rolls back the already generated encounters', (t) => {
  const x = fixture(t),
    source = x.store.generationRun(x.w.token, x.run.generationRunId);
  x.store.db.exec(
    "CREATE TRIGGER session_save_failure BEFORE INSERT ON session_run BEGIN SELECT RAISE(ABORT,'controlled session save failure'); END;",
  );
  const bytes = x.store.db.serialize();
  assert.throws(
    () =>
      x.store.generateSession(x.w.token, {
        planId: x.planId,
        expectedProfileRevision: 1,
        count: 2,
        locationIds: [],
        noteIds: [],
        encounter: source.request,
      }),
    /controlled session save failure/,
  );
  assert.ok(x.store.db.serialize().equals(bytes));
  assert.deepEqual(x.store.sessionRun(x.w.token, x.run.id), x.run);
});

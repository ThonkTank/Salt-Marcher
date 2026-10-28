import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { fixtureStore } from '../helpers/store.mjs';

buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/storage-values-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const require = createRequire(import.meta.url),
  { CampaignStore } = require('../../.build/storage-values-store.cjs'),
  Database = require('better-sqlite3');
buildSync({
  entryPoints: ['src/app/storage/snapshot-validation.ts'],
  outfile: '.build/storage-values-validation.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { validateBackupCandidate } = require('../../.build/storage-values-validation.cjs');
const hash = (v) => createHash('sha256').update(v).digest('hex');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'storage-values-')),
    file = path.join(root, 'store.sqlite');
  const x = { root, file, store: fixtureStore(CampaignStore, file) };
  x.cam = x.store.create('Kanonische Werte');
  x.w = x.store.activate(x.cam.id);
  x.command = (action) => ({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    action,
  });
  x.plan = {
    version: 1,
    id: randomUUID(),
    revision: 1,
    name: '  Plan\r\n',
    scenes: [{ id: randomUUID(), title: '  Besuch ', notes: '  **Text**\r\n', locationId: null }],
  };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'plan', plan: x.plan, expectedRevision: null },
  });
  x.profileCommand = x.command({
    kind: 'profile',
    expectedRevision: 0,
    profile: {
      planId: x.plan.id,
      revision: 0,
      party: [{ id: randomUUID(), name: '  Ada ', level: 3, count: 1 }],
      adventureDayFraction: '0.5',
      seed: '  Speicher-Seed ',
    },
  });
  x.store.executeSession(x.profileCommand);
  x.visitCommand = x.command({
    kind: 'visit',
    planId: x.plan.id,
    expectedRevision: 0,
    detail: {
      visitId: x.plan.scenes[0].id,
      revision: 0,
      readAloud: '  **Exakte Prosa**\r\n  Ende ',
      noteIds: [],
      groupIds: [],
      reward: null,
    },
  });
  x.store.executeSession(x.visitCommand);
  x.session = () => x.store.session(x.w.token, x.plan.id);
  x.damage = (table, mutate) => {
    const row = x.store.db
        .prepare(`SELECT rowid,* FROM ${table} WHERE campaign_id=?`)
        .get(x.cam.id),
      value = JSON.parse(row.payload);
    mutate(value, row);
    const payload = JSON.stringify(value);
    x.store.db
      .prepare(`UPDATE ${table} SET payload=?,checksum=? WHERE rowid=?`)
      .run(payload, hash(payload), row.rowid);
    return x.store.db.serialize();
  };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return x;
}
for (const [label, table, mutate] of [
  [
    'profile field type',
    'session_profile',
    (v) => {
      v.seed = 12;
    },
  ],
  [
    'profile payload identity',
    'session_profile',
    (v) => {
      v.planId = randomUUID();
    },
  ],
  [
    'profile SQL revision',
    'session_profile',
    (v) => {
      v.revision++;
    },
  ],
  [
    'profile optional field',
    'session_profile',
    (v) => {
      v.encounterCount = '2';
    },
  ],
  [
    'profile nested count',
    'session_profile',
    (v) => {
      v.party[0].count = 1.5;
    },
  ],
  [
    'visit identity',
    'session_visit',
    (v) => {
      v.visitId = randomUUID();
    },
  ],
  [
    'visit revision',
    'session_visit',
    (v) => {
      v.revision++;
    },
  ],
  [
    'visit field type',
    'session_visit',
    (v) => {
      v.readAloud = 7;
    },
  ],
  [
    'visit reference list',
    'session_visit',
    (v) => {
      v.noteIds = [12];
    },
  ],
  [
    'visit missing campaign group',
    'session_visit',
    (v) => {
      v.groupIds = [randomUUID()];
    },
  ],
  [
    'visit rest variant',
    'session_visit',
    (v) => {
      v.restAfter = { kind: 'nap', beforeVisitId: randomUUID() };
    },
  ],
])
  test(`correctly checksummed ${label} corruption is rejected without mutation`, (t) => {
    const x = fixture(t),
      bytes = x.damage(table, mutate);
    assert.throws(x.session);
    assert.ok(x.store.db.serialize().equals(bytes));
  });
test('a saved visit with a wrong plan binding is rejected instead of becoming the missing-record default', (t) => {
  const x = fixture(t),
    other = { ...x.plan, id: randomUUID(), scenes: [] };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'plan', expectedRevision: null, plan: other },
  });
  x.store.db
    .prepare('UPDATE session_visit SET plan_id=? WHERE campaign_id=? AND id=?')
    .run(other.id, x.cam.id, x.plan.scenes[0].id);
  const bytes = x.store.db.serialize();
  assert.throws(x.session);
  assert.ok(x.store.db.serialize().equals(bytes));
});
test('missing optional session records retain defaults; saved prose and values survive reopening unchanged', (t) => {
  const x = fixture(t),
    before = x.session();
  x.store.close();
  x.store = new CampaignStore(x.file);
  x.w = x.store.activate(x.cam.id);
  assert.deepEqual(x.session(), before);
  x.store.db.prepare('DELETE FROM session_profile WHERE campaign_id=?').run(x.cam.id);
  x.store.db.prepare('DELETE FROM session_visit WHERE campaign_id=?').run(x.cam.id);
  const missing = x.session();
  assert.deepEqual(missing.profile, {
    planId: x.plan.id,
    revision: 0,
    party: [],
    adventureDayFraction: '0.5',
    seed: 'spielabend-1',
  });
  assert.deepEqual(missing.visits, [
    {
      visitId: x.plan.scenes[0].id,
      revision: 0,
      readAloud: '',
      noteIds: [],
      groupIds: [],
      reward: null,
    },
  ]);
});
test('corrupt session receipt cannot authorize replay or another write', (t) => {
  const x = fixture(t),
    id = x.profileCommand.commandId;
  const row = x.store.db.prepare('SELECT * FROM session_receipt WHERE command_id=?').get(id),
    value = JSON.parse(row.payload);
  value.profile.party[0].level = '3';
  const payload = JSON.stringify(value);
  x.store.db
    .prepare('UPDATE session_receipt SET payload=?,checksum=? WHERE command_id=?')
    .run(payload, hash(payload), id);
  const bytes = x.store.db.serialize();
  assert.throws(() => x.store.executeSession(x.profileCommand));
  assert.ok(x.store.db.serialize().equals(bytes));
});
test('read, backup and import reject the same corrupt profile while keeping originals and published backup intact', async (t) => {
  const x = fixture(t),
    safe = path.join(x.root, 'safe.sqlite'),
    source = path.join(x.root, 'source.sqlite');
  await x.store.backup(safe);
  await x.store.campaignSnapshot(x.w.token, source);
  const safeBytes = readFileSync(safe);
  const bytes = x.damage('session_profile', (v) => {
    v.adventureDayFraction = '-1';
  });
  assert.throws(x.session);
  await assert.rejects(x.store.backup(safe));
  assert.ok(readFileSync(safe).equals(safeBytes));
  assert.ok(x.store.db.serialize().equals(bytes));
  const db = new Database(source);
  const row = db.prepare('SELECT * FROM session_profile').get(),
    v = JSON.parse(row.payload);
  v.party[0].count = '1';
  const payload = JSON.stringify(v);
  db.prepare('UPDATE session_profile SET payload=?,checksum=?').run(payload, hash(payload));
  db.close();
  const sourceBytes = readFileSync(source),
    target = fixture(t),
    targetBytes = target.store.db.serialize();
  assert.throws(() => validateBackupCandidate(source));
  assert.ok(readFileSync(source).equals(sourceBytes));
  assert.throws(() => target.store.campaignPreview(source));
  assert.throws(() => target.store.acceptCampaignSnapshot(source, 'Ungültiger Import', {}));
  assert.ok(target.store.db.serialize().equals(targetBytes));
  assert.ok(readFileSync(source).equals(sourceBytes));
});
for (const [name, mutate] of [
  [
    'nested field type',
    (c) => {
      c.months[0].days = '30';
    },
  ],
  [
    'day range',
    (c) => {
      c.daySeconds = 0;
    },
  ],
  [
    'revision binding',
    (c) => {
      c.revision++;
    },
  ],
  [
    'month list',
    (c) => {
      c.months = [];
    },
  ],
  [
    'payload identity',
    (c) => {
      c.id = 'foreign-calendar';
    },
  ],
])
  test(`calendar ${name} corruption never uses its missing-record default`, (t) => {
    const x = fixture(t),
      calendar = x.store.world(x.w.token).calendar;
    x.store.executeWorld(x.command({ kind: 'calendar', calendar, expectedRevision: 0 }));
    const row = x.store.db
        .prepare(
          "SELECT rowid,* FROM world_record WHERE campaign_id=? AND kind='calendar' AND id='main'",
        )
        .get(x.cam.id),
      value = JSON.parse(row.payload);
    mutate(value);
    const payload = JSON.stringify(value);
    x.store.db
      .prepare('UPDATE world_record SET payload=?,checksum=? WHERE rowid=?')
      .run(payload, hash(payload), row.rowid);
    const bytes = x.store.db.serialize();
    assert.throws(() => x.store.world(x.w.token));
    assert.ok(x.store.db.serialize().equals(bytes));
  });
test('damaged world confirmation remains unreadable and never causes a second world write', (t) => {
  const x = fixture(t),
    calendar = x.store.world(x.w.token).calendar,
    c = x.command({ kind: 'calendar', calendar, expectedRevision: 0 });
  x.store.executeWorld(c);
  const row = x.store.db.prepare('SELECT * FROM world_receipt WHERE command_id=?').get(c.commandId),
    value = JSON.parse(row.payload);
  value.world.calendar.daySeconds = '86400';
  const payload = JSON.stringify(value);
  x.store.db
    .prepare('UPDATE world_receipt SET payload=?,checksum=? WHERE command_id=?')
    .run(payload, hash(payload), c.commandId);
  const bytes = x.store.db.serialize();
  assert.throws(() => x.store.reconcileWorld(c, x.w.token));
  assert.throws(() => x.store.executeWorld(c));
  assert.ok(x.store.db.serialize().equals(bytes));
});

test('damaged generation receipt rejects replay and backup without publishing another table', async (t) => {
  const x = fixture(t),
    c = x.command({
      kind: 'loot-save',
      expectedRevision: null,
      table: {
        id: randomUUID(),
        revision: 0,
        name: '  Beute ',
        description: '  Erhalten\r\n',
        rolls: 1,
        trashed: false,
        entries: [
          {
            id: randomUUID(),
            weight: '1',
            minimum: 1,
            maximum: 1,
            item: { name: 'Seil', valueGold: '1', category: 'equipment' },
          },
        ],
      },
    });
  x.store.executeGeneration(c);
  const row = x.store.db
      .prepare('SELECT * FROM generation_receipt WHERE command_id=?')
      .get(c.commandId),
    v = JSON.parse(row.payload);
  v.lootTables[0].rolls = '1';
  const payload = JSON.stringify(v);
  x.store.db
    .prepare('UPDATE generation_receipt SET payload=?,checksum=? WHERE command_id=?')
    .run(payload, hash(payload), c.commandId);
  const before = x.store.db.serialize();
  assert.throws(() => x.store.executeGeneration(c));
  await assert.rejects(x.store.backup(path.join(x.root, 'bad-generation.sqlite')));
  assert.ok(x.store.db.serialize().equals(before));
});
test('damaged music receipt rejects replay without changing the confirmed player', (t) => {
  const x = fixture(t),
    c = x.command({ kind: 'transport', expectedRevision: 0, operation: 'stop' });
  x.store.executeMusic(c);
  const payload = JSON.stringify({ applied: 'yes' });
  x.store.db
    .prepare('UPDATE music_receipt SET payload=?,checksum=? WHERE command_id=?')
    .run(payload, hash(payload), c.commandId);
  const before = x.store.db.serialize();
  assert.throws(() => x.store.executeMusic(c));
  assert.ok(x.store.db.serialize().equals(before));
});

test('valid additional profile data retains its exact whitespace and serialized bytes', (t) => {
  const x = fixture(t);
  x.damage('session_profile', (v) => {
    v.authorExtension = { markdown: '  Zusatz\r\n', values: [0, false, null] };
  });
  const row = x.store.db
      .prepare('SELECT payload,checksum FROM session_profile WHERE campaign_id=?')
      .get(x.cam.id),
    before = x.store.db.serialize();
  assert.deepEqual(x.session().profile.authorExtension, {
    markdown: '  Zusatz\r\n',
    values: [0, false, null],
  });
  assert.deepEqual(
    x.store.db
      .prepare('SELECT payload,checksum FROM session_profile WHERE campaign_id=?')
      .get(x.cam.id),
    row,
  );
  assert.ok(x.store.db.serialize().equals(before));
});

test('a correctly checksummed historical restock rule is checked without consulting newer shop stock', async (t) => {
  const x = fixture(t),
    location = {
      kind: 'location',
      version: 1,
      id: randomUUID(),
      name: 'Markt',
      type: 'poi',
      sections: [],
      detailMaps: [],
      keyLinks: [],
    };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'location', expectedRevision: null, document: location },
  });
  const shop = x.store.executeItemShop(
    x.command({
      kind: 'shop',
      expectedRevision: null,
      shop: {
        id: randomUUID(),
        revision: 0,
        name: 'Handel',
        owner: { kind: 'location', id: location.id },
        stock: [],
        notes: '',
        trashed: false,
      },
    }),
  ).shop.shop;
  const row = x.store.db.prepare('SELECT * FROM shop_event WHERE shop_id=?').get(shop.id),
    v = JSON.parse(row.payload);
  v.facts = { rule: { mode: 'add', quantity: 0, intervalMs: '1000' } };
  const payload = JSON.stringify(v);
  x.store.db
    .prepare('UPDATE shop_event SET payload=?,checksum=? WHERE id=?')
    .run(payload, hash(payload), row.id);
  const before = x.store.db.serialize();
  assert.throws(() => x.store.shopHistory(x.w.token, shop.id, null));
  await assert.rejects(x.store.backup(path.join(x.root, 'bad-rule.sqlite')));
  assert.ok(x.store.db.serialize().equals(before));
});
test('an invalid existing generator registry is rejected instead of becoming a default', (t) => {
  const x = fixture(t);
  x.store.db.prepare('UPDATE generator_meta SET revision=-1 WHERE id=1').run();
  const before = x.store.db.serialize();
  assert.throws(() => x.store.generatorRegistry(x.w.token));
  assert.ok(x.store.db.serialize().equals(before));
});

test('correctly checksummed prepared source damage fails before projection and leaves the original intact', async (t) => {
  const x = fixture(t),
    id = randomUUID();
  x.store.saveEncounterPlan({
    ...x.command(null),
    expectedRevision: null,
    plan: {
      id,
      revision: 0,
      name: 'Wachen',
      notes: '',
      party: [],
      entries: [{ id: randomUUID(), creatureId: 'guard', count: 1, grouped: false }],
      sources: [],
      catalogHash: '',
    },
  });
  const group = x.store.executeSession(
    x.command({
      kind: 'attach',
      planId: x.plan.id,
      visitId: x.plan.scenes[0].id,
      expectedVisitRevision: 1,
      encounterId: id,
      expectedEncounterRevision: 1,
    }),
  ).groups[0];
  const row = x.store.db.prepare('SELECT * FROM prepared_group WHERE id=?').get(group.id),
    v = JSON.parse(row.payload);
  v.plan.sources[0].hp = '7';
  const payload = JSON.stringify(v);
  x.store.db
    .prepare('UPDATE prepared_group SET payload=?,checksum=? WHERE id=?')
    .run(payload, hash(payload), group.id);
  const before = x.store.db.serialize();
  assert.throws(() => x.store.preparedGroup(x.w.token, group.id));
  assert.throws(x.session);
  await assert.rejects(x.store.backup(path.join(x.root, 'bad-preparation.sqlite')));
  assert.ok(x.store.db.serialize().equals(before));
});

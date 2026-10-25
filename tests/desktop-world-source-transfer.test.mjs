import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/world-source-transfer.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/world-source-transfer.cjs');
test('independent preparation copies retain faction and location source relationships after fresh', async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'world-source-transfer-')),
    store = new CampaignStore(path.join(root, 'source.sqlite'));
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const cam = store.create('Sources'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action }),
    factionId = randomUUID(),
    locationId = randomUUID();
  store.changePreparation({
    ...command(null),
    change: {
      kind: 'note',
      expectedRevision: null,
      note: {
        version: 1,
        id: factionId,
        revision: 1,
        kind: 'faction',
        title: 'Guards',
        readAloud: '  Guards\r\n',
        gmNotes: '  Exact author prose\r\n',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    },
  });
  store.changePreparation({
    ...command(null),
    change: {
      kind: 'location',
      expectedRevision: null,
      document: {
        kind: 'location',
        version: 1,
        id: locationId,
        name: 'Keep',
        type: 'poi',
        sections: [],
        detailMaps: [],
        keyLinks: [],
      },
    },
  });
  for (const source of [
    { kind: 'faction', id: factionId, revision: 0, tableIds: [], factionIds: [], stock: [] },
    {
      kind: 'location',
      id: locationId,
      revision: 0,
      tableIds: [],
      factionIds: [factionId],
      stock: [],
    },
  ])
    store.executeGeneration(command({ kind: 'source-save', source, expectedRevision: null }));
  const snapshot = path.join(root, 'snapshot.sqlite');
  await store.campaignSnapshot(w.token, snapshot);
  const bytes = readFileSync(snapshot),
    file = path.join(root, 'copy.sqlite'),
    target = new CampaignStore(file);
  let id;
  try {
    const copy = target.acceptCampaignSnapshot(snapshot, 'Copy', {}),
      w = target.activate(copy.id),
      v = target.generationSources(w.token),
      f = v.sources.find((s) => s.kind === 'faction'),
      l = v.sources.find((s) => s.kind === 'location');
    id = copy.id;
    assert.notEqual(f.id, factionId);
    assert.notEqual(l.id, locationId);
    assert.deepEqual(l.factionIds, [f.id]);
    assert.ok(v.factions.some((x) => x.id === f.id));
    assert.ok(v.locations.some((x) => x.id === l.id));
    await target.backup(path.join(root, 'copy-safe.sqlite'));
  } finally {
    target.close();
  }
  const fresh = new CampaignStore(file);
  try {
    const w = fresh.activate(id),
      v = fresh.generationSources(w.token);
    assert.deepEqual(v.sources.find((s) => s.kind === 'location').factionIds, [
      v.sources.find((s) => s.kind === 'faction').id,
    ]);
    assert.equal(
      fresh.preparation(w.token).notes.find((x) => x.note.kind === 'faction').note.gmNotes,
      '  Exact author prose\r\n',
    );
  } finally {
    fresh.close();
  }
  assert.ok(readFileSync(snapshot).equals(bytes));
});

function fixture(t, withLocation = false) {
  const root = mkdtempSync(path.join(tmpdir(), 'world-source-integrity-')),
    store = new CampaignStore(path.join(root, 'source.sqlite')),
    cam = store.create('Sources');
  let w = store.activate(cam.id);
  const command = (action) => ({
    commandId: randomUUID(),
    campaignId: cam.id,
    token: w.token,
    action,
  });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const factionId = randomUUID(),
    locationId = randomUUID(),
    tableId = randomUUID();
  store.changePreparation({
    ...command(null),
    change: {
      kind: 'note',
      expectedRevision: null,
      note: {
        version: 1,
        id: factionId,
        revision: 1,
        kind: 'faction',
        title: 'Guards',
        readAloud: '',
        gmNotes: 'Author\r\n',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    },
  });
  if (withLocation)
    store.changePreparation({
      ...command(null),
      change: {
        kind: 'location',
        expectedRevision: null,
        document: {
          kind: 'location',
          version: 1,
          id: locationId,
          name: 'Keep',
          type: 'poi',
          sections: [],
          detailMaps: [],
          keyLinks: [],
        },
      },
    });
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
  const source = {
    kind: 'faction',
    id: factionId,
    revision: 0,
    tableIds: [tableId],
    factionIds: [],
    stock: [{ creatureId: 'guard', limit: 2 }],
  };
  store.executeGeneration(command({ kind: 'source-save', source, expectedRevision: null }));
  if (withLocation)
    store.executeGeneration(
      command({
        kind: 'source-save',
        source: {
          kind: 'location',
          id: locationId,
          revision: 0,
          tableIds: [],
          factionIds: [factionId],
          stock: [],
        },
        expectedRevision: null,
      }),
    );
  const request = {
    factionIds: [factionId],
    locationId: withLocation ? locationId : null,
    tableIds: [tableId],
    seed: 'watch',
    filters: { text: 'guard' },
    habitat: '',
    time: 'any',
    party: [{ id: randomUUID(), name: 'Hero', count: 1, level: 1 }],
    difficulty: 'easy',
    amount: 'neutral',
    balance: 'neutral',
    diversity: 'neutral',
    title: 'Guards',
    count: 1,
    targetXp: 25,
  };
  return {
    root,
    store,
    cam,
    w,
    command,
    factionId,
    locationId,
    tableId,
    source: { ...source, revision: 1 },
    request,
  };
}
// Reader and backup share sourceRow/sourceReferences; disposition keeps their backup entry covered.
for (const [name, edit] of [
  ['disposition', (s) => (s.disposition = 'friendly')],
  ['identity', (s) => (s.id = randomUUID())],
  ['revision', (s) => (s.revision = 99)],
  ['kind', (s) => (s.kind = 'location')],
  ['negative stock', (s) => (s.stock[0].limit = -1)],
  ['duplicate stock', (s) => s.stock.push({ ...s.stock[0] })],
  ['unknown creature', (s) => (s.stock[0].creatureId = 'goblin')],
  ['missing table', (s) => (s.tableIds = [randomUUID()])],
  ['invalid links', (s) => (s.factionIds = [''])],
  ['invalid quantity', (s) => (s.stock[0].limit = '2')],
])
  test(`checksummed world source ${name} damage is rejected before projection`, async (t) => {
    const x = fixture(t),
      file = path.join(x.root, 'safe.sqlite'),
      checkBackup = name === 'disposition';
    if (checkBackup) await x.store.backup(file);
    const safe = checkBackup ? readFileSync(file) : null,
      row = x.store.db.prepare("SELECT * FROM world_source WHERE kind='faction'").get(),
      source = JSON.parse(row.payload);
    edit(source);
    const payload = JSON.stringify(source);
    x.store.db
      .prepare(
        'UPDATE world_source SET payload=?,checksum=? WHERE campaign_id=? AND kind=? AND id=?',
      )
      .run(payload, createHash('sha256').update(payload).digest('hex'), x.cam.id, row.kind, row.id);
    const bytes = x.store.db.serialize();
    assert.throws(() => x.store.generationSources(x.w.token));
    if (checkBackup) {
      await assert.rejects(x.store.backup(file));
      assert.ok(readFileSync(file).equals(safe));
    }
    assert.ok(x.store.db.serialize().equals(bytes));
  });
test('missing world source storage cannot overwrite a safe backup', async (t) => {
  const x = fixture(t),
    file = path.join(x.root, 'safe.sqlite');
  await x.store.backup(file);
  const bytes = readFileSync(file);
  x.store.db.exec('DROP TABLE world_source');
  await assert.rejects(x.store.backup(file));
  assert.ok(readFileSync(file).equals(bytes));
});
test('archived linked factions remain stored and unrelated source changes preserve them', async (t) => {
  const x = fixture(t, true);
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note-trash', id: x.factionId, expectedRevision: 1, trashed: true },
  });
  const bytes = x.store.db.serialize();
  assert.throws(
    () =>
      x.store.executeGeneration(
        x.command({ kind: 'source-save', source: x.source, expectedRevision: 1 }),
      ),
    /Papierkorb/,
  );
  assert.ok(x.store.db.serialize().equals(bytes));
  const s = x.store.generationSources(x.w.token).sources.find((s) => s.kind === 'location');
  assert.deepEqual(s.factionIds, [x.factionId]);
  x.store.executeGeneration(
    x.command({ kind: 'source-save', source: s, expectedRevision: s.revision }),
  );
  await x.store.backup(path.join(x.root, 'archive-safe.sqlite'));
  assert.deepEqual(
    x.store.generationSources(x.w.token).sources.find((s) => s.kind === 'location').factionIds,
    [x.factionId],
  );
});
for (const stale of [false, true])
  test(`an independent copy ${stale ? 'rejects an already stale' : 'can accept an unchanged'} world-filtered preview`, async (t) => {
    const x = fixture(t, true),
      run = x.store.generateEncounters(x.w.token, x.request);
    if (stale)
      x.store.executeGeneration(
        x.command({
          kind: 'source-save',
          source: { ...x.source, stock: [{ creatureId: 'guard', limit: 3 }] },
          expectedRevision: 1,
        }),
      );
    const file = path.join(x.root, 'preview.sqlite');
    await x.store.campaignSnapshot(x.w.token, file);
    const copy = x.store.acceptCampaignSnapshot(file, 'Copy', {}),
      w = x.store.activate(copy.id),
      row = x.store.db.prepare('SELECT id FROM generation_run WHERE campaign_id=?').get(copy.id),
      command = {
        commandId: randomUUID(),
        campaignId: copy.id,
        token: w.token,
        runId: row.id,
        index: 0,
        expectedRegistryRevision: x.store.generatorRegistry(w.token).revision,
      };
    if (stale) assert.throws(() => x.store.acceptGeneration(command), /Weltquellen|Bestand/);
    else assert.ok(x.store.acceptGeneration(command).entries.length);
    assert.equal(run.plans.length, 1);
  });
// Keep one cross-campaign backup probe; each distinct foreign reference still reaches the reader.
for (const kind of ['owner', 'faction link', 'table link'])
  test(`a valid world source cannot claim a foreign campaign ${kind}`, async (t) => {
    const x = fixture(t, kind === 'faction link'),
      other = x.store.create('Foreign'),
      ow = x.store.activate(other.id),
      factionId = randomUUID(),
      tableId = randomUUID(),
      command = (action) => ({
        commandId: randomUUID(),
        campaignId: other.id,
        token: ow.token,
        action,
      });
    if (kind !== 'table link')
      x.store.changePreparation({
        ...command(null),
        change: {
          kind: 'note',
          expectedRevision: null,
          note: {
            version: 1,
            id: factionId,
            revision: 1,
            kind: 'faction',
            title: 'Foreign',
            readAloud: '',
            gmNotes: '',
            relations: [],
            creatureId: null,
            deleted: false,
          },
        },
      });
    if (kind === 'table link')
      x.store.executeGeneration(
        command({
          kind: 'table-save',
          expectedRevision: null,
          table: {
            id: tableId,
            revision: 0,
            scope: 'campaign',
            name: 'Foreign watch',
            description: '',
            entries: [{ creatureId: 'guard', weight: '1' }],
            habitats: [],
            time: 'any',
            lootTableId: null,
            trashed: false,
          },
        }),
      );
    x.w = x.store.activate(x.cam.id);
    const file = path.join(x.root, 'safe.sqlite'),
      checkBackup = kind === 'owner';
    if (checkBackup) await x.store.backup(file);
    const safe = checkBackup ? readFileSync(file) : null,
      row = x.store.db
        .prepare('SELECT * FROM world_source WHERE campaign_id=? AND kind=?')
        .get(x.cam.id, kind === 'faction link' ? 'location' : 'faction'),
      s = JSON.parse(row.payload);
    if (kind === 'owner') s.id = factionId;
    else if (kind === 'table link') s.tableIds = [tableId];
    else s.factionIds = [factionId];
    const payload = JSON.stringify(s);
    x.store.db
      .prepare(
        'UPDATE world_source SET id=?,payload=?,checksum=? WHERE campaign_id=? AND kind=? AND id=?',
      )
      .run(
        s.id,
        payload,
        createHash('sha256').update(payload).digest('hex'),
        x.cam.id,
        row.kind,
        row.id,
      );
    assert.throws(() => x.store.generationSources(x.w.token));
    if (checkBackup) {
      await assert.rejects(x.store.backup(file));
      assert.ok(readFileSync(file).equals(safe));
    }
  });
test('editing table membership prunes stock once and preserves the faction source identity', async (t) => {
  const x = fixture(t),
    table = x.store.encounterTables(x.w.token, true).find((t) => t.id === x.tableId);
  x.store.executeGeneration(
    x.command({
      kind: 'table-save',
      expectedRevision: table.revision,
      table: { ...table, entries: [{ creatureId: 'goblin', weight: '1' }] },
    }),
  );
  const s = x.store.generationSources(x.w.token).sources.find((s) => s.kind === 'faction');
  assert.equal(s.id, x.factionId);
  assert.equal(s.revision, 2);
  assert.deepEqual(s.stock, []);
  assert.deepEqual(s.tableIds, [x.tableId]);
  await x.store.backup(path.join(x.root, 'pruned.sqlite'));
});
test('invalid source writes preserve the existing stock and receipts', (t) => {
  const x = fixture(t),
    before = x.store.db.serialize();
  for (const edit of [
    (s) => (s.stock[0].limit = -1),
    (s) => (s.stock[0].limit = 1.5),
    (s) => s.stock.push({ ...s.stock[0] }),
    (s) => (s.tableIds = [randomUUID()]),
    (s) => (s.revision = 99),
  ]) {
    const s = structuredClone(x.source);
    edit(s);
    assert.throws(() =>
      x.store.executeGeneration(x.command({ kind: 'source-save', source: s, expectedRevision: 1 })),
    );
  }
  assert.ok(x.store.db.serialize().equals(before));
});

test('array-shaped source records and stock cannot serialize away saved values', (t) => {
  const x = fixture(t),
    before = x.store.db.serialize();
  for (const source of [
    Object.assign([], x.source),
    { ...x.source, stock: [Object.assign([], { creatureId: 'guard', limit: 1 })] },
  ])
    assert.throws(() =>
      x.store.executeGeneration(x.command({ kind: 'source-save', source, expectedRevision: 1 })),
    );
  assert.ok(x.store.db.serialize().equals(before));
});

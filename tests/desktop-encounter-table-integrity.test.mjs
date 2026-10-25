import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
mkdirSync('.build/catalog', { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  '.build/catalog/srd-5.1.generated.json',
);
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/encounter-table-integrity-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)(
  '../.build/encounter-table-integrity-store.cjs',
);
function fixture(t, scope = 'campaign') {
  const dir = mkdtempSync(path.join(tmpdir(), 'encounter-table-integrity-')),
    file = path.join(dir, 'world.sqlite'),
    store = new CampaignStore(file),
    campaign = store.create('Quellen'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaign.id,
      action,
    });
  const table = {
    id: randomUUID(),
    revision: 0,
    scope,
    name: 'Wachen',
    description: '  Originalprosa\r\n\r\n',
    entries: [
      { creatureId: 'guard', weight: '1' },
      { creatureId: 'goblin', weight: '2' },
    ],
    habitats: [],
    time: 'any',
    lootTableId: null,
    trashed: false,
  };
  const creation = command({ kind: 'table-save', table, expectedRevision: null }),
    ack = store.executeGeneration(creation);
  const read = () => store.encounterTables(w.token, true).find((row) => row.id === table.id),
    original = read(),
    damage = (edit) => {
      const changed = structuredClone(original);
      edit(changed);
      const payload = JSON.stringify(changed),
        checksum = createHash('sha256').update(payload).digest('hex');
      store.db
        .prepare('UPDATE encounter_table SET payload=?,checksum=? WHERE id=?')
        .run(payload, checksum, table.id);
    };
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { dir, file, store, campaign, w, command, creation, ack, table: original, read, damage };
}
const invalid = [
  ['empty entries', (t) => (t.entries = [])],
  ['duplicate creatures', (t) => (t.entries = [t.entries[0], { ...t.entries[0], weight: '2' }])],
  ['zero-only weights', (t) => t.entries.forEach((e) => (e.weight = '0'))],
  ['invalid weight', (t) => (t.entries[0].weight = '-1')],
  ['null entry', (t) => (t.entries[0] = null)],
  ['empty name', (t) => (t.name = '   ')],
  ['invalid habitat', (t) => (t.habitats = [null])],
  ['invalid loot identity', (t) => (t.lootTableId = { id: 'loot' })],
];
for (const [name, edit] of invalid)
  test(`stored encounter table ${name} fails closed without rewriting its original bytes`, async (t) => {
    const x = fixture(t);
    x.damage(edit);
    const before = x.store.db.serialize();
    assert.throws(x.read, /Tabelle|Gewicht|Kreatur/);
    // Each field reaches decodeTable; this representative also guards both writers and Fresh.
    if (name === 'duplicate creatures') {
      assert.throws(
        () =>
          x.store.executeGeneration(
            x.command({
              kind: 'table-trash',
              id: x.table.id,
              expectedRevision: x.table.revision,
              trashed: true,
            }),
          ),
        /Tabelle|Gewicht|Kreatur/,
      );
      assert.throws(
        () =>
          x.store.executeGeneration(
            x.command({
              kind: 'table-save',
              table: { ...x.table, name: 'Überschreiben' },
              expectedRevision: x.table.revision,
            }),
          ),
        /Tabelle|Gewicht|Kreatur/,
      );
    }
    assert.ok(x.store.db.serialize().equals(before));
    if (name === 'duplicate creatures') {
      const fresh = new CampaignStore(x.file);
      try {
        const w = fresh.activate(x.campaign.id);
        assert.throws(() => fresh.encounterTables(w.token, true), /Tabelle|Gewicht|Kreatur/);
      } finally {
        fresh.close();
      }
    }
  });
test('a malformed encounter table cannot replace a known-good backup with a checksummed invalid candidate', async (t) => {
  const x = fixture(t),
    safe = path.join(x.dir, 'safe.sqlite');
  await x.store.backup(safe);
  const saved = readFileSync(safe);
  x.damage((t) => (t.entries = [t.entries[0], { ...t.entries[0] }]));
  const before = x.store.db.serialize();
  await assert.rejects(x.store.backup(safe), /Tabelle|Kreatur/);
  assert.deepEqual(readFileSync(safe), saved);
  assert.ok(x.store.db.serialize().equals(before));
});
test('valid exact decimal weights, zero shares, author prose and unavailable creature identities stay readable', async (t) => {
  const x = fixture(t);
  x.damage((t) => {
    t.entries = [
      { creatureId: 'external-creature-no-longer-installed', weight: '0001,250000000001' },
      { creatureId: 'guard', weight: '0' },
    ];
    t.habitats = ['Wald'];
  });
  const before = x.store.db.serialize(),
    table = x.read();
  assert.equal(table.entries[0].weight, '0001,250000000001');
  assert.equal(table.entries[1].weight, '0');
  assert.equal(table.description, x.table.description);
  assert.deepEqual(table.habitats, ['Wald']);
  const safe = path.join(x.dir, 'valid.sqlite');
  await x.store.backup(safe);
  assert.ok(x.store.db.serialize().equals(before));
  const fresh = new CampaignStore(safe);
  try {
    const w = fresh.activate(x.campaign.id);
    assert.deepEqual(
      fresh.encounterTables(w.token, true).find((t) => t.id === x.table.id),
      table,
    );
  } finally {
    fresh.close();
  }
});
test('campaign-local damage does not block an unrelated campaign table read, edit or scoped export', async (t) => {
  const x = fixture(t);
  x.damage((t) => (t.entries = []));
  const original = x.store.db.prepare('SELECT * FROM encounter_table WHERE id=?').get(x.table.id),
    other = x.store.create('Unabhängig'),
    w = x.store.activate(other.id),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: other.id,
      token: w.token,
      action,
    }),
    table = { ...x.table, id: randomUUID(), revision: 0, name: 'Eigene Wachen' };
  x.store.executeGeneration(command({ kind: 'table-save', table, expectedRevision: null }));
  const current = x.store.encounterTables(w.token, true)[0];
  x.store.executeGeneration(
    command({
      kind: 'table-save',
      table: { ...current, name: 'Eigene neue Wachen' },
      expectedRevision: current.revision,
    }),
  );
  assert.equal(x.store.encounterTables(w.token, true)[0].name, 'Eigene neue Wachen');
  const exported = path.join(x.dir, 'other.sqlite');
  await x.store.campaignSnapshot(w.token, exported);
  const copy = new CampaignStore(exported);
  try {
    const owner = copy.activate(other.id);
    assert.equal(copy.encounterTables(owner.token, true)[0].name, 'Eigene neue Wachen');
    assert.equal(
      copy.db.prepare('SELECT count(*) n FROM encounter_table WHERE id=?').get(x.table.id).n,
      0,
    );
  } finally {
    copy.close();
  }
  assert.deepEqual(
    x.store.db.prepare('SELECT * FROM encounter_table WHERE id=?').get(x.table.id),
    original,
  );
});

test('invalid installation-wide tables remain in every affected campaign read and write boundary', (t) => {
  const x = fixture(t, 'installation');
  x.damage((t) => (t.entries = []));
  const other = x.store.create('Gemeinsamer Owner'),
    w = x.store.activate(other.id),
    before = x.store.db.serialize();
  assert.throws(() => x.store.encounterTables(w.token, true), /Tabelle/);
  assert.throws(
    () =>
      x.store.executeGeneration({
        commandId: randomUUID(),
        token: w.token,
        campaignId: other.id,
        action: {
          kind: 'table-save',
          table: { ...x.table, id: randomUUID(), revision: 0, scope: 'campaign' },
          expectedRevision: null,
        },
      }),
    /Tabelle/,
  );
  assert.ok(x.store.db.serialize().equals(before));
});

test('an original confirmed table receipt remains a historical fact when current table content is damaged', (t) => {
  const x = fixture(t);
  x.damage((t) => (t.entries = []));
  const before = x.store.db.serialize();
  assert.deepEqual(x.store.executeGeneration(x.creation), x.ack);
  assert.ok(x.store.db.serialize().equals(before));
  assert.throws(x.read, /Tabelle/);
});

for (const weight of ['0', '0.5', '11', '999999999999999999', '-1'])
  test(`new and changed encounter weights reject ${weight} at the canonical writer`, (t) => {
    const x = fixture(t),
      before = x.store.db.serialize();
    for (const fresh of [false, true])
      assert.throws(
        () =>
          x.store.executeGeneration(
            x.command({
              kind: 'table-save',
              expectedRevision: fresh ? null : 1,
              table: {
                ...x.table,
                id: fresh ? randomUUID() : x.table.id,
                entries: [
                  { creatureId: 'guard', weight },
                  { creatureId: 'goblin', weight: '1' },
                ],
              },
            }),
          ),
        /gewicht/i,
      );
    assert.ok(
      x.store.db.serialize().equals(before),
      'Rejected edits must leave tables and receipts untouched',
    );
  });

test('legacy weights survive metadata edits, replay and Fresh but cannot be assigned to a new creature or table', async (t) => {
  const x = fixture(t);
  x.damage((table) => {
    table.entries[0].weight = '0000,500000000001';
    table.entries[1].weight = '20';
  });
  const legacy = x.read(),
    save = x.command({
      kind: 'table-save',
      expectedRevision: 1,
      table: { ...legacy, name: 'Altbestand redigiert' },
    }),
    receipt = x.store.executeGeneration(save);
  assert.deepEqual(x.read().entries, legacy.entries);
  assert.deepEqual(x.store.executeGeneration(save), receipt);
  assert.equal(x.read().revision, 2);
  const before = x.store.db.serialize();
  assert.throws(
    () =>
      x.store.executeGeneration(
        x.command({
          kind: 'table-save',
          expectedRevision: null,
          table: { ...x.read(), id: randomUUID() },
        }),
      ),
    /1 bis 10/,
  );
  assert.throws(
    () =>
      x.store.executeGeneration(
        x.command({
          kind: 'table-save',
          expectedRevision: 2,
          table: {
            ...x.read(),
            entries: [{ creatureId: 'bandit', weight: legacy.entries[0].weight }],
          },
        }),
      ),
    /1 bis 10/,
  );
  assert.ok(x.store.db.serialize().equals(before));
  const backup = path.join(x.dir, 'legacy-edited.sqlite');
  await x.store.backup(backup);
  const fresh = new CampaignStore(backup);
  try {
    const w = fresh.activate(x.campaign.id);
    assert.deepEqual(fresh.encounterTables(w.token, true)[0], x.read());
  } finally {
    fresh.close();
  }
  const changed = {
    ...x.read(),
    entries: [
      { creatureId: 'guard', weight: '10' },
      { creatureId: 'goblin', weight: '1' },
    ],
  };
  x.store.executeGeneration(x.command({ kind: 'table-save', expectedRevision: 2, table: changed }));
  assert.deepEqual(x.read().entries, changed.entries);
  assert.throws(
    () =>
      x.store.executeGeneration(
        x.command({ kind: 'table-save', expectedRevision: 3, table: legacy }),
      ),
    /1 bis 10/,
  );
});

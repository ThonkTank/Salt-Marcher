import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
mkdirSync('.build/catalog', { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  '.build/catalog/srd-5.1.generated.json',
);
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/table-scope-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/table-scope-store.cjs');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'table-scope-')),
    file = path.join(root, 'world.sqlite'),
    store = new CampaignStore(file),
    campaigns = ['A', 'B'].map((name) => store.create(name));
  let w = store.activate(campaigns[0].id),
    index = 0;
  const command = (action) => ({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaigns[index].id,
      action,
    }),
    activate = (i) => {
      index = i;
      w = store.activate(campaigns[i].id);
      return w;
    },
    table = {
      id: randomUUID(),
      revision: 0,
      scope: 'installation',
      name: 'Gemeinsame Wachen',
      description: ' Originaltext\r\n',
      entries: [{ creatureId: 'goblin', weight: '1' }],
      habitats: [],
      time: 'any',
      lootTableId: null,
      trashed: false,
    };
  store.executeGeneration(command({ kind: 'table-save', table, expectedRevision: null }));
  const owners = [];
  for (let i = 0; i < 2; i++) {
    activate(i);
    const faction = randomUUID(),
      location = randomUUID();
    store.changePreparation({
      ...command(null),
      change: {
        kind: 'note',
        expectedRevision: null,
        note: {
          version: 1,
          id: faction,
          revision: 1,
          kind: 'faction',
          title: 'Wache ' + i,
          readAloud: '',
          gmNotes: ' Unverändert\r\n',
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
          id: location,
          name: 'Tor ' + i,
          type: 'poi',
          sections: [],
          detailMaps: [],
          keyLinks: [],
        },
      },
    });
    for (const [kind, id] of [
      ['faction', faction],
      ['location', location],
    ])
      store.executeGeneration(
        command({
          kind: 'source-save',
          source: {
            kind,
            id,
            revision: 0,
            tableIds: [table.id],
            factionIds: [],
            stock: kind === 'faction' ? [{ creatureId: 'goblin', limit: 3 }] : [],
          },
          expectedRevision: null,
        }),
      );
    owners.push({ faction, location });
  }
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return {
    store,
    file,
    campaigns,
    owners,
    table,
    activate,
    command,
    tables: () => store.encounterTables(w.token, true),
    sources: () => store.generationSources(w.token),
    token: () => w.token,
  };
}
test('an installation table cannot become campaign-local and strand other campaign sources', (t) => {
  const x = fixture(t);
  x.activate(0);
  const before = x.store.db.serialize(),
    original = x.tables().find((a) => a.id === x.table.id),
    command = x.command({
      kind: 'table-save',
      table: { ...original, scope: 'campaign', name: 'Nur A' },
      expectedRevision: original.revision,
    });
  assert.throws(() => x.store.executeGeneration(command), /Geltungsbereich|Scope/);
  assert.ok(
    x.store.db.serialize().equals(before),
    'table, sources, stock and receipts roll back together',
  );
  for (let i = 0; i < 2; i++) {
    x.activate(i);
    assert.equal(x.tables().find((a) => a.id === x.table.id).scope, 'installation');
    assert.deepEqual(
      x.sources().sources.map((s) => s.tableIds),
      [[x.table.id], [x.table.id]],
    );
    assert.equal(x.sources().sources.find((s) => s.kind === 'faction').stock[0].limit, 3);
  }
});
test('a campaign table edit cannot implicitly publish its identity installation-wide', (t) => {
  const x = fixture(t);
  x.activate(0);
  const table = { ...x.table, id: randomUUID(), scope: 'campaign' };
  x.store.executeGeneration(x.command({ kind: 'table-save', table, expectedRevision: null }));
  const current = x.tables().find((a) => a.id === table.id),
    before = x.store.db.serialize();
  assert.throws(
    () =>
      x.store.executeGeneration(
        x.command({
          kind: 'table-save',
          table: { ...current, scope: 'installation' },
          expectedRevision: current.revision,
        }),
      ),
    /Geltungsbereich|Scope/,
  );
  assert.ok(x.store.db.serialize().equals(before));
  x.activate(1);
  assert.equal(
    x.tables().some((t) => t.id === table.id),
    false,
  );
});
test('installation edits retain their owner, shared revision and idempotent receipt across fresh activation', (t) => {
  const x = fixture(t);
  x.activate(0);
  const first = x.tables().find((t) => t.id === x.table.id);
  x.activate(1);
  const update = x.command({
    kind: 'table-save',
    table: { ...first, name: 'Gemeinsamer neuer Name' },
    expectedRevision: first.revision,
  });
  x.store.executeGeneration(update);
  const saved = x.store.db.serialize();
  x.store.executeGeneration(update);
  assert.ok(x.store.db.serialize().equals(saved));
  x.activate(0);
  const before = x.store.db.serialize();
  assert.throws(
    () =>
      x.store.executeGeneration(
        x.command({ kind: 'table-save', table: first, expectedRevision: first.revision }),
      ),
    /geändert/,
  );
  assert.ok(x.store.db.serialize().equals(before));
  const fresh = new CampaignStore(x.file);
  try {
    for (const cam of x.campaigns) {
      const w = fresh.activate(cam.id),
        table = fresh.encounterTables(w.token, true).find((t) => t.id === x.table.id);
      assert.equal(table.scope, 'installation');
      assert.equal(table.revision, 2);
      assert.equal(table.name, 'Gemeinsamer neuer Name');
      assert.equal(table.description, x.table.description);
      assert.equal(fresh.generationSources(w.token).sources.length, 2);
    }
  } finally {
    fresh.close();
  }
});

test('editing a campaign table prunes only its own stock even when another campaign source is damaged', (t) => {
  const x = fixture(t);
  x.activate(0);
  const table = {
    ...x.table,
    id: randomUUID(),
    scope: 'campaign',
    entries: [
      { creatureId: 'goblin', weight: '1' },
      { creatureId: 'guard', weight: '2' },
    ],
  };
  x.store.executeGeneration(x.command({ kind: 'table-save', table, expectedRevision: null }));
  const original = x.sources().sources.find((s) => s.kind === 'faction');
  const source = {
    ...original,
    tableIds: [table.id],
    stock: [
      { creatureId: 'goblin', limit: 3 },
      { creatureId: 'guard', limit: 7 },
    ],
  };
  x.store.executeGeneration(
    x.command({ kind: 'source-save', source, expectedRevision: source.revision }),
  );
  x.store.db
    .prepare("UPDATE world_source SET checksum='damaged' WHERE campaign_id=? AND kind='faction'")
    .run(x.campaigns[1].id);
  const foreign = () =>
      x.store.db
        .prepare('SELECT * FROM world_source WHERE campaign_id=? ORDER BY kind,id')
        .all(x.campaigns[1].id),
    beforeForeign = foreign();
  const current = x.tables().find((t) => t.id === table.id),
    edit = x.command({
      kind: 'table-save',
      table: { ...current, name: 'Eigene Wachen', entries: [{ creatureId: 'guard', weight: '2' }] },
      expectedRevision: current.revision,
    });
  x.store.executeGeneration(edit);
  const saved = x.tables().find((t) => t.id === table.id),
    pruned = x.sources().sources.find((s) => s.kind === 'faction');
  assert.equal(saved.revision, 2);
  assert.equal(saved.description, x.table.description);
  assert.deepEqual(pruned.stock, [{ creatureId: 'guard', limit: 7 }]);
  assert.equal(pruned.revision, source.revision + 2);
  assert.deepEqual(foreign(), beforeForeign);
  const after = x.store.db.serialize();
  x.store.executeGeneration(edit);
  assert.ok(x.store.db.serialize().equals(after));
  assert.throws(
    () =>
      x.store.executeGeneration(
        x.command({
          kind: 'source-save',
          source: { ...source, revision: source.revision + 1 },
          expectedRevision: source.revision + 1,
        }),
      ),
    /geändert/,
  );
  assert.ok(x.store.db.serialize().equals(after));
  const fresh = new CampaignStore(x.file);
  try {
    const w = fresh.activate(x.campaigns[0].id);
    assert.equal(
      fresh.encounterTables(w.token, true).find((t) => t.id === table.id).name,
      'Eigene Wachen',
    );
    assert.deepEqual(
      fresh.generationSources(w.token).sources.find((s) => s.kind === 'faction').stock,
      [{ creatureId: 'guard', limit: 7 }],
    );
  } finally {
    fresh.close();
  }
});

test('editing shared table membership still prunes dependent factions in every campaign atomically', (t) => {
  const x = fixture(t);
  x.activate(0);
  const table = x.tables().find((t) => t.id === x.table.id),
    edit = x.command({
      kind: 'table-save',
      table: { ...table, entries: [{ creatureId: 'guard', weight: '1' }] },
      expectedRevision: table.revision,
    });
  x.store.executeGeneration(edit);
  const after = x.store.db.serialize();
  x.store.executeGeneration(edit);
  assert.ok(x.store.db.serialize().equals(after));
  for (let i = 0; i < 2; i++) {
    x.activate(i);
    const source = x.sources().sources.find((s) => s.kind === 'faction');
    assert.deepEqual(source.tableIds, [table.id]);
    assert.deepEqual(source.stock, []);
    assert.equal(source.revision, 2);
    assert.equal(x.sources().sources.find((s) => s.kind === 'location').revision, 1);
  }
});

test('a damaged source in the shared table owner domain aborts the entire table and stock edit', (t) => {
  const x = fixture(t);
  x.activate(0);
  const table = x.tables().find((t) => t.id === x.table.id);
  x.store.db
    .prepare("UPDATE world_source SET checksum='damaged' WHERE campaign_id=? AND kind='faction'")
    .run(x.campaigns[1].id);
  const before = x.store.db.serialize();
  assert.throws(
    () =>
      x.store.executeGeneration(
        x.command({
          kind: 'table-save',
          table: { ...table, entries: [{ creatureId: 'guard', weight: '1' }] },
          expectedRevision: table.revision,
        }),
      ),
    /beschädigt/,
  );
  assert.ok(x.store.db.serialize().equals(before));
  assert.deepEqual(x.sources().sources.find((s) => s.kind === 'faction').stock, [
    { creatureId: 'goblin', limit: 3 },
  ]);
  assert.equal(x.tables().find((t) => t.id === table.id).revision, 1);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/world-source-constraints-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['src/app/storage/world-sources.ts'],
  outfile: '.build/world-source-constraints.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  { CampaignStore } = require('../../.build/world-source-constraints-store.cjs'),
  { resolveWorldSources } = require('../../.build/world-source-constraints.cjs');
function fixture(t, { factionCount = 2, withTables = true } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'world-source-constraints-')),
    store = new CampaignStore(path.join(root, 'store.sqlite')),
    cam = store.create('Weltquellen'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const factions = ['A', 'B'].slice(0, factionCount).map((title) => {
    const note = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      kind: 'faction',
      title,
      readAloud: '',
      gmNotes: '',
      relations: [],
      creatureId: null,
      deleted: false,
    };
    store.changePreparation({
      ...command(null),
      change: { kind: 'note', note, expectedRevision: null },
    });
    return note.id;
  });
  const tables = (withTables ? factions : []).map((id, i) => {
    const table = {
      id: randomUUID(),
      revision: 0,
      scope: 'campaign',
      name: 'Tabelle ' + i,
      description: '',
      entries: [{ creatureId: i ? 'wolf' : 'goblin', weight: '1' }],
      habitats: [],
      time: 'any',
      lootTableId: null,
      trashed: false,
    };
    store.executeGeneration(command({ kind: 'table-save', table, expectedRevision: null }));
    return table.id;
  });
  const save = (kind, id, tableIds, factionIds = [], stock = [], expectedRevision = null) =>
    store.executeGeneration(
      command({
        kind: 'source-save',
        source: { kind, id, revision: expectedRevision ?? 0, tableIds, factionIds, stock },
        expectedRevision,
      }),
    );
  const request = { tableIds: [], factionIds: factions, locationId: null },
    resolve = (changes) =>
      resolveWorldSources(
        store.db,
        cam.id,
        { ...request, ...changes },
        store.encounterTables(w.token, true),
      );
  return { root, store, cam, w, command, factions, tables, save, resolve };
}
for (const excluded of ['missing source', 'explicit table filter', 'location filter', 'zero stock'])
  test(`every selected faction must retain a source after ${excluded}`, (t) => {
    const x = fixture(t);
    x.save('faction', x.factions[0], [x.tables[0]]);
    if (excluded !== 'missing source')
      x.save(
        'faction',
        x.factions[1],
        [x.tables[1]],
        [],
        excluded === 'zero stock' ? [{ creatureId: 'wolf', limit: 0 }] : [],
      );
    let changes = {};
    if (excluded === 'explicit table filter') changes.tableIds = [x.tables[0]];
    if (excluded === 'location filter') {
      const location = {
        kind: 'location',
        version: 1,
        id: randomUUID(),
        name: 'Tor',
        type: 'poi',
        sections: [],
        detailMaps: [],
        keyLinks: [],
      };
      x.store.changePreparation({
        ...x.command(null),
        change: { kind: 'location', document: location, expectedRevision: null },
      });
      x.save('location', location.id, [x.tables[0]]);
      changes.locationId = location.id;
    }
    const bytes = x.store.db.serialize();
    assert.throws(() => x.resolve(changes), /Gewählte Fraktion.*B.*keine.*Encounter-Tabelle/);
    assert.ok(
      x.store.db.serialize().equals(bytes),
      'Rejected binding must not mutate campaign data',
    );
  });
test('valid faction sources keep finite stock and change the source basis when stock changes', (t) => {
  const x = fixture(t, { factionCount: 1 });
  x.save('faction', x.factions[0], [x.tables[0]], [], [{ creatureId: 'goblin', limit: 3 }]);
  const before = x.resolve({ factionIds: [x.factions[0]] });
  assert.deepEqual(before.tableIds, [x.tables[0]]);
  assert.equal(before.caps.get('goblin'), 3);
  x.save('faction', x.factions[0], [x.tables[0]], [], [{ creatureId: 'goblin', limit: 2 }], 1);
  const after = x.resolve({ factionIds: [x.factions[0]] });
  assert.equal(after.caps.get('goblin'), 2);
  assert.notEqual(after.basis, before.basis);
});

for (const kind of [
  'faction title',
  'faction kind',
  'faction identity',
  'location title',
  'location identity',
])
  test(`world source choices reject damaged ${kind} before projecting or filtering it`, (t) => {
    const isFaction = kind.startsWith('faction'),
      x = fixture(t, { factionCount: isFaction ? 1 : 0, withTables: false }),
      location = {
        kind: 'location',
        version: 1,
        id: randomUUID(),
        name: 'Tor',
        type: 'poi',
        sections: [],
        detailMaps: [],
        keyLinks: [],
      };
    if (!isFaction)
      x.store.changePreparation({
        ...x.command(null),
        change: { kind: 'location', document: location, expectedRevision: null },
      });
    const table = kind.startsWith('faction') ? 'world_note' : 'location',
      id = table === 'world_note' ? x.factions[0] : location.id,
      row = x.store.db
        .prepare(`SELECT payload FROM ${table} WHERE campaign_id=? AND id=?`)
        .get(x.cam.id, id),
      doc = JSON.parse(row.payload);
    if (kind.endsWith('kind')) doc.kind = 'rule';
    else if (kind.endsWith('identity')) doc.id = randomUUID();
    else if (table === 'world_note') doc.title = 'Gefälschte Fraktion';
    else doc.name = 'Gefälschter Ort';
    const payload = JSON.stringify(doc);
    if (kind.endsWith('identity'))
      x.store.db
        .prepare(`UPDATE ${table} SET payload=?,checksum=? WHERE campaign_id=? AND id=?`)
        .run(payload, createHash('sha256').update(payload).digest('hex'), x.cam.id, id);
    else
      x.store.db
        .prepare(`UPDATE ${table} SET payload=? WHERE campaign_id=? AND id=?`)
        .run(payload, x.cam.id, id);
    const before = x.store.db.serialize();
    assert.throws(() => x.store.generationSources(x.w.token), /beschädigt|Zuordnung|Identität/);
    assert.ok(x.store.db.serialize().equals(before));
  });

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildSync } from 'esbuild';

export const fixtureVersion = 'e2e01-desktop-v2';
export const prose = [
  '  Am Nebeltor\r\n\r\n- Basalt  \r\n- Salz\n',
  '## Geheimnis\n\n`unverändert` – äöü\r\n',
  '\n> Wache am Tor\n\n',
];
export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function fixtureRuntime(root = process.cwd()) {
  const outfile = path.join(root, '.build/e2e01-store.cjs');
  mkdirSync(path.join(root, '.build/catalog'), { recursive: true });
  copyFileSync(
    path.join(root, 'src/features/catalog/data/srd-5.1.generated.json'),
    path.join(root, '.build/catalog/srd-5.1.generated.json'),
  );
  buildSync({
    stdin: {
      contents:
        "export { CampaignStore } from './src/app/storage/store'; export { transferRow, transferContext, transferTables } from './src/app/transfer/registry';",
      resolveDir: root,
      sourcefile: 'e2e01-runtime.ts',
      loader: 'ts',
    },
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
  return createRequire(import.meta.url)(outfile);
}

/** Seed only through production writers. No running Electron process may own this store. */
export function seedE2E01(CampaignStore, profile) {
  const store = new CampaignStore(path.join(profile, 'workbench.sqlite'));
  try {
    const authoredSections = prose.map((markdown) => ({
      id: randomUUID(),
      kind: 'markdown',
      markdown,
    }));
    const authoredRoom = {
      id: randomUUID(),
      scopeId: 'local',
      floorId: 'ground',
      number: '1',
      name: 'E2E-01 Archiv',
      revision: 0,
      polygons: [
        {
          outer: [
            { x: 0, y: 0 },
            { x: 8, y: 0 },
            { x: 8, y: 8 },
            { x: 0, y: 8 },
          ],
          holes: [],
        },
      ],
      sections: authoredSections,
    };
    const a = store.create('E2E-01 Nebelmark', [authoredRoom]),
      b = store.create('E2E-01 Gegenküste');
    const foreignLocationId = randomUUID(),
      other = store.activate(b.id);
    store.changePreparation({
      commandId: randomUUID(),
      campaignId: b.id,
      token: other.token,
      change: {
        kind: 'location',
        expectedRevision: null,
        document: {
          kind: 'location',
          version: 1,
          id: foreignLocationId,
          name: 'E2E-01 Gegenküstenort',
          type: 'poi',
          sections: [{ id: randomUUID(), title: 'Beschreibung', markdown: 'Nur Kampagne B.' }],
          detailMaps: [],
          keyLinks: [],
        },
      },
    });
    const w = store.activate(a.id);
    const write = (action) => {
      const commandId = randomUUID();
      if (action.command) action.command.commandId = commandId;
      if (action.edit) action.edit.commandId = commandId;
      return store.executeAtlas({ commandId, token: w.token, campaignId: a.id, action });
    };
    write({ kind: 'city-create', name: 'E2E-01 Nebeltor', x: 0, y: 0, width: 200, height: 200 });
    let atlas = store.campaignAtlas(w.token);
    const city = atlas.cities[0],
      houseId = randomUUID();
    write({
      kind: 'city',
      command: {
        commandId: randomUUID(),
        token: w.token,
        campaignId: a.id,
        cityId: city.header.id,
        expectedRevision: city.header.revision,
        action: {
          kind: 'change',
          remove: [],
          label: 'Fixturehaus',
          upsert: [
            {
              id: houseId,
              kind: 'building',
              name: 'E2E-01 Salzhaus',
              protected: false,
              position: { x: 30, y: 40 },
              angle: 0,
              outline: [
                { x: -8, y: -9 },
                { x: 8, y: -9 },
                { x: 8, y: 9 },
                { x: -8, y: 9 },
              ],
              use: 'Taverne',
              notes: prose[1],
              groupRecipe: {
                version: 1,
                profile: 'Taverne',
                width: 16,
                depth: 18,
                seed: fixtureVersion,
              },
            },
          ],
        },
      },
    });
    atlas = store.campaignAtlas(w.token);
    const room = atlas.workspace.rooms.find((r) => r.scopeId === houseId && r.floorId === 'ground');
    const sections = room.sections.map((section) => ({ ...section, markdown: prose[0] }));
    write({
      kind: 'room-edit',
      edit: {
        commandId: randomUUID(),
        token: w.token,
        campaignId: a.id,
        roomId: room.id,
        expectedRevision: room.revision,
        name: 'E2E-01 Torhalle',
        polygons: room.polygons,
        sections,
      },
    });
    const planId = randomUUID(),
      creatureReference = store.catalogReference('creature', 'guard'),
      itemDefinition = store.itemDefinitions({
        search: '',
        category: '',
        magic: '',
        rarity: '',
        attunement: '',
        source: 'srd51',
        sort: 'name',
        direction: 'asc',
        after: 0,
        includeTrashed: false,
      }).items[0],
      itemReference = store.catalogReference('item', itemDefinition.id);
    store.saveEncounterPlan({
      commandId: randomUUID(),
      token: w.token,
      campaignId: a.id,
      expectedRevision: null,
      plan: {
        id: planId,
        revision: 0,
        name: 'E2E-01 Torwachen',
        notes: prose[2],
        party: [],
        entries: [{ id: randomUUID(), creatureId: 'guard', count: 2, grouped: true }],
        sources: [],
        catalogHash: creatureReference.sourceHash,
        sourceReferences: [creatureReference],
        items: [{ id: randomUUID(), reference: itemReference, quantity: 1 }],
      },
    });
    const after = store.campaignAtlas(w.token).workspace.rooms.find((r) => r.id === room.id);
    store.executeDrawing({
      commandId: randomUUID(),
      token: w.token,
      campaignId: a.id,
      action: {
        kind: 'key-batch',
        rooms: [{ id: room.id, expectedRevision: after.revision, keyRevision: null }],
        patch: {
          references: [
            { kind: 'encounter', id: planId, label: 'E2E-01 Torwachen' },
            { kind: 'creature', id: 'guard', label: 'Guard', catalogReference: creatureReference },
            {
              kind: 'item',
              id: itemDefinition.id,
              label: itemDefinition.name,
              catalogReference: itemReference,
            },
          ],
        },
      },
    });
    // Real local PNG and production media metadata; Complete must carry these exact bytes.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGklEQVR4AWPkkjP67+bmxsDS1NTEYGNjwwAAKlAEa5vNtKoAAAAASUVORK5CYII=',
      'base64',
    );
    const imageId = randomUUID(),
      sha256 = digest(png),
      mediaName = 'images/' + sha256 + '.png';
    mkdirSync(path.join(profile, 'player-images'), { recursive: true });
    writeFileSync(path.join(profile, 'player-images', path.basename(mediaName)), png);
    store.registerPlayerAsset(w.token, {
      id: imageId,
      kind: 'location',
      subjectId: city.header.locationId,
      title: 'E2E-01 Nebeltor',
      sha256,
      extension: '.png',
      bytes: png.length,
    });
    store.tutorial('skipped');
    assert.equal(
      store.db.prepare('SELECT count(*) n FROM live_scene WHERE campaign_id=?').get(a.id).n,
      0,
    );
    const finalRoom = store.campaignAtlas(w.token).workspace.rooms.find((r) => r.id === room.id);
    assert.deepEqual(finalRoom.sections, sections);
    assert.equal(store.encounterPlan(w.token, planId).entries[0].creatureId, 'guard');
    return {
      version: fixtureVersion,
      a: a.id,
      b: b.id,
      foreignLocationId,
      cityId: city.header.id,
      locationId: city.header.locationId,
      houseId,
      roomId: room.id,
      planId,
      creatureReference,
      itemReference,
      imageId,
      sections,
      authoredRoomId: authoredRoom.id,
      authoredSections,
      media: { name: mediaName, sha256, bytes: png.length },
      recipeHash: digest(JSON.stringify({ fixtureVersion, prose })),
    };
  } finally {
    store.close();
  }
}

/** Independent SQLite reader, never a renderer/store projection. */
export function readE2E01(file, campaignId) {
  const Database = createRequire(import.meta.url)('better-sqlite3');
  const db = new Database(file, { readonly: true });
  try {
    const tables = [
      'campaign',
      'campaign_atlas',
      'atlas_binding',
      'city_document',
      'city_unit',
      'room_group',
      'room',
      'drawing_floor',
      'drawing_element',
      'location',
      'atlas_place',
      'atlas_landscape',
      'dungeon_key_content',
      'encounter_plan',
      'player_asset',
      'live_state',
      'live_scene',
    ];
    const found = new Set(
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((r) => r.name),
    );
    return Object.fromEntries(
      tables
        .filter((t) => {
          assert(found.has(t), 'Required E2E-01 inventory table: ' + t);
          return true;
        })
        .map((table) => {
          const columns = db
            .prepare('PRAGMA table_info("' + table + '")')
            .all()
            .map((c) => c.name);
          const key = columns.includes('campaign_id')
            ? 'campaign_id'
            : table === 'campaign'
              ? 'id'
              : null;
          const rows = key
            ? db.prepare('SELECT * FROM "' + table + '" WHERE "' + key + '"=?').all(campaignId)
            : [];
          rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
          return [table, rows];
        }),
    );
  } finally {
    db.close();
  }
}
export function verifyMedia(profile, fixture) {
  const bytes = readFileSync(
    path.join(profile, 'player-images', path.basename(fixture.media.name)),
  );
  assert.equal(bytes.length, fixture.media.bytes);
  assert.equal(digest(bytes), fixture.media.sha256);
}

/** Freeze the source closure before import; never obtain expected identities from importer output. */
export function freezeTransferInventory(runtime, file, campaignId) {
  const Database = createRequire(import.meta.url)('better-sqlite3'),
    db = new Database(file, { readonly: true });
  try {
    const rows = {},
      localIds = new Set();
    const collect = runtime.transferContext((id, role) => {
      if (role === 'local' || role === 'mixed') localIds.add(id);
      return id;
    });
    for (const [table, contract] of Object.entries(runtime.transferTables)) {
      if (contract.mode !== 'copy') continue;
      const campaignKey = Object.hasOwn(contract.columns, 'campaign_id')
        ? 'campaign_id'
        : table === 'campaign'
          ? 'id'
          : null;
      if (!campaignKey) continue;
      rows[table] = db
        .prepare('SELECT * FROM "' + table + '" WHERE "' + campaignKey + '"=?')
        .all(campaignId);
      for (const row of rows[table]) runtime.transferRow(table, row, collect);
    }
    const definitions = Object.fromEntries(
      ['item_definition', 'item_definition_version', 'authored_item'].map((table) => [
        table,
        db.prepare('SELECT * FROM ' + table + ' ORDER BY id,revision').all(),
      ]),
    );
    return { campaignId, rows, localIds: [...localIds].sort(), definitions };
  } finally {
    db.close();
  }
}
export function assertTransferInventory(runtime, before, after, mapping, name) {
  assert.equal(mapping[before.campaignId], after.campaignId);
  const required = new Set(before.localIds);
  for (const id of required)
    assert(
      typeof mapping[id] === 'string' && mapping[id] && mapping[id] !== id,
      'Missing remap for frozen source identity ' + id,
    );
  assert.equal(
    new Set(before.localIds.map((id) => mapping[id])).size,
    required.size,
    'Source closure must map injectively',
  );
  const expectedTargets = new Set(before.localIds.map((id) => mapping[id]));
  for (const id of after.localIds)
    assert(expectedTargets.has(id), 'Foreign local reference after import: ' + id);
  const names = { sourceId: before.campaignId, campaignId: after.campaignId, name };
  const remap = runtime.transferContext(
    (id, role) => {
      if (role === 'local' || role === 'mixed') {
        assert(required.has(id), 'Reference absent from frozen source closure: ' + id);
        assert(mapping[id], 'Missing required source mapping: ' + id);
        return mapping[id];
      }
      return role === 'existing-local' ? (mapping[id] ?? id) : id;
    },
    undefined,
    names,
  );
  const order = (rows) => rows.map((r) => JSON.stringify(r)).sort();
  const expectedRows = Object.fromEntries(
    Object.entries(before.rows).map(([table, rows]) => [
      table,
      rows.map((row) => runtime.transferRow(table, row, remap, names)),
    ]),
  );
  for (const row of expectedRows.campaign_atlas ?? []) row.cursor = 0;
  for (const row of expectedRows.drawing_history ?? []) {
    const history = JSON.parse(row.payload);
    for (const change of history.changes) {
      const key = change.key,
        current =
          expectedRows[key.table]?.find(
            (r) =>
              r.id === key.id &&
              (!key.scopeId || r.scope_id === key.scopeId) &&
              (!key.kind || r.kind === key.kind),
          ) ?? null;
      change.guard = digest(JSON.stringify(current));
    }
    row.payload = JSON.stringify(history);
    row.checksum = digest(row.payload);
  }
  for (const [table, expected] of Object.entries(expectedRows)) {
    if (table === 'campaign_origin') continue; // the importer adds its provenance record
    if (table === 'world_record') {
      const derived = new Set(['atlas-shape-source', 'atlas-geometry-source']);
      for (const row of expected.filter((r) => derived.has(r.kind))) {
        const actual = after.rows[table].find((r) => r.kind === row.kind && r.id === row.id);
        assert(
          actual && actual.revision >= row.revision && /^[a-f0-9]{64}$/.test(actual.checksum),
          'Remapped projection fence must be rebuilt',
        );
      }
      assert.deepEqual(
        order(after.rows[table].filter((r) => !derived.has(r.kind))),
        order(expected.filter((r) => !derived.has(r.kind))),
        'Complete source-derived closure: ' + table,
      );
    } else
      assert.deepEqual(
        order(after.rows[table]),
        order(expected),
        'Complete source-derived closure: ' + table,
      );
  }
  assert.deepEqual(
    after.definitions,
    before.definitions,
    'Shared definitions remain byte-identical',
  );
  return { localIdentities: before.localIds.length, tables: Object.keys(before.rows).length };
}

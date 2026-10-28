import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PNG } from 'pngjs';
import {
  fixtureRuntime,
  seedE2E01,
  readE2E01,
  verifyMedia,
  digest,
  prose,
} from '../../tools/atlas-e2e01-fixture.mjs';
const { CampaignStore } = fixtureRuntime();
test('shared E2E-01 seed retains exact multi-section bytes, house binding, plan and real media across fresh Store', (t) => {
  const profile = mkdtempSync(path.join(tmpdir(), 'e2e01-fixture-'));
  t.after(() => rmSync(profile, { recursive: true, force: true }));
  const f = seedE2E01(CampaignStore, profile),
    file = path.join(profile, 'workbench.sqlite'),
    before = readE2E01(file, f.a);
  assert.equal(f.recipeHash, '0ce6b792462b2aaf7559472b5cf2455a58b0ee538b3e015e1dc313e18a1c7e21');
  const authored = JSON.parse(before.room.find((r) => r.id === f.authoredRoomId).payload);
  assert.deepEqual(authored.sections, f.authoredSections);
  assert.deepEqual(
    authored.sections.map((s) => Buffer.from(s.markdown)),
    prose.map((s) => Buffer.from(s)),
  );
  assert.equal(new Set(authored.sections.map((s) => s.id)).size, 3);
  const binding = before.atlas_binding.find(
    (b) => b.kind === 'dungeon' && b.owner_id === f.houseId,
  );
  assert.equal(binding.parent, 'building');
  assert.equal(binding.parent_id, f.houseId);
  assert(before.drawing_floor.filter((row) => row.scope_id === f.houseId).length > 1);
  assert.equal(before.live_scene.length, 0);
  assert.equal(before.live_state.length, 0);
  const fresh = new CampaignStore(file);
  try {
    const a = fresh.activate(f.a),
      plan = fresh.encounterPlan(a.token, f.planId);
    assert.equal(plan.entries[0].creatureId, 'guard');
    const stored = JSON.parse(before.encounter_plan[0].payload);
    assert.deepEqual(stored.sources, [f.creatureReference]);
    assert.equal(
      'name' in stored.sources[0],
      false,
      'Reusable plan stores only versioned definition bindings',
    );
    assert.deepEqual(plan.sourceReferences, stored.sources);
    assert.deepEqual(stored.items[0].reference, f.itemReference);
    assert.equal(plan.resolvedItems[0].id, f.itemReference.entryId);
    assert.equal(Object.hasOwn(stored, 'resolvedItems'), false);
    const key = JSON.parse(before.dungeon_key_content[0].payload);
    assert.deepEqual(
      key.references.find((r) => r.kind === 'creature').catalogReference,
      f.creatureReference,
    );
    assert.deepEqual(
      key.references.find((r) => r.kind === 'item').catalogReference,
      f.itemReference,
    );
    assert.equal(fresh.resolveCatalogReference(f.creatureReference).name, plan.sources[0].name);
    assert.equal(
      fresh.resolveCatalogReference(f.itemReference).name,
      key.references.find((r) => r.kind === 'item').label,
    );
    assert.equal(plan.sources[0].id, 'guard');
    assert.match(plan.catalogHash, /^[a-f0-9]{64}$/);
    assert.equal(fresh.atlasRoom(a.token, f.authoredRoomId).sections[1].markdown, prose[1]);
  } finally {
    fresh.close();
  }
  assert.deepEqual(readE2E01(file, f.a), before);
  verifyMedia(profile, f);
  const png = PNG.sync.read(
    readFileSync(path.join(profile, 'player-images', path.basename(f.media.name))),
  );
  assert.equal(png.width, 2);
  assert.equal(png.height, 2);
  assert.equal(
    digest(readFileSync(path.join(profile, 'player-images', path.basename(f.media.name)))),
    f.media.sha256,
  );
});
test('foreign and stale activation tokens fail before mutating either shared-fixture campaign', (t) => {
  const profile = mkdtempSync(path.join(tmpdir(), 'e2e01-context-'));
  t.after(() => rmSync(profile, { recursive: true, force: true }));
  const f = seedE2E01(CampaignStore, profile),
    file = path.join(profile, 'workbench.sqlite'),
    store = new CampaignStore(file);
  try {
    const old = store.activate(f.a),
      current = store.activate(f.b),
      beforeA = readE2E01(file, f.a),
      beforeB = readE2E01(file, f.b),
      databaseBefore = store.db.serialize();
    for (const [token, campaignId] of [
      [old.token, f.a],
      [current.token, f.a],
    ])
      assert.throws(() =>
        store.executeAtlas({
          commandId: randomUUID(),
          token,
          campaignId,
          action: { kind: 'group-scale', scopeId: f.houseId, factor: 2 },
        }),
      );
    assert.deepEqual(
      store.db.serialize(),
      databaseBefore,
      'Rejected contexts cannot mutate data, history or receipts',
    );
    assert.deepEqual(readE2E01(file, f.a), beforeA);
    assert.deepEqual(readE2E01(file, f.b), beforeB);
  } finally {
    store.close();
  }
});

test('Complete import retains versioned global bindings and frozen facts with source-derived remap closure', async (t) => {
  const runtime = fixtureRuntime(),
    profile = mkdtempSync(path.join(tmpdir(), 'e2e01-complete-'));
  t.after(() => rmSync(profile, { recursive: true, force: true }));
  const f = seedE2E01(CampaignStore, profile),
    file = path.join(profile, 'workbench.sqlite'),
    store = new CampaignStore(file);
  const { freezeTransferInventory, assertTransferInventory } = await import(
    '../../tools/atlas-e2e01-fixture.mjs'
  );
  try {
    const active = store.activate(f.a),
      source = freezeTransferInventory(runtime, file, f.a),
      other = readE2E01(file, f.b),
      snapshot = path.join(profile, 'complete.sqlite');
    await store.campaignSnapshot(active.token, snapshot);
    const sourceBytes = readFileSync(snapshot),
      imported = store.acceptCampaignSnapshot(snapshot, 'E2E-01 imported', {}),
      mapping = JSON.parse(
        store.db
          .prepare('SELECT local_map FROM campaign_origin WHERE campaign_id=?')
          .get(imported.id).local_map,
      ),
      copied = freezeTransferInventory(runtime, file, imported.id);
    const evidence = assertTransferInventory(runtime, source, copied, mapping, imported.name);
    assert(evidence.localIdentities > 100);
    assert.deepEqual(readFileSync(snapshot), sourceBytes);
    assert.deepEqual(freezeTransferInventory(runtime, file, f.a), source);
    assert.deepEqual(readE2E01(file, f.b), other);
    const view = store.activate(imported.id),
      plan = store.encounterPlan(view.token, mapping[f.planId]);
    assert.deepEqual(plan.sourceReferences, [f.creatureReference]);
    assert.deepEqual(JSON.parse(copied.rows.encounter_plan[0].payload).sources, [
      f.creatureReference,
    ]);
    const brokenMapping = { ...mapping };
    delete brokenMapping[f.roomId];
    assert.throws(
      () => assertTransferInventory(runtime, source, copied, brokenMapping, imported.name),
      /Missing remap/,
    );
    const foreign = structuredClone(copied);
    foreign.localIds.push(f.roomId);
    assert.throws(
      () => assertTransferInventory(runtime, source, foreign, mapping, imported.name),
      /Foreign local reference/,
    );
    store.close();
    const fresh = new CampaignStore(file);
    try {
      const w = fresh.activate(imported.id);
      assert.deepEqual(fresh.encounterPlan(w.token, mapping[f.planId]), plan);
      assert.equal(
        fresh.resolveCatalogReference(f.itemReference).reference.sourceHash,
        f.itemReference.sourceHash,
      );
    } finally {
      fresh.close();
    }
  } finally {
    store.close();
  }
});

for (const [fault, mutate, pattern] of [
  ['unknown', (r) => ({ ...r, sourceId: 'not-installed-provider' }), /unknown-source/],
  ['version', (r) => ({ ...r, sourceVersion: 'uninstalled' }), /source-version/],
  ['hash', (r) => ({ ...r, sourceHash: '0'.repeat(64) }), /source-version/],
  ['missing binding', () => null, /Katalogreferenz/],
])
  test('catalog ' + fault + ' rejects plan and room adoption before mutation', (t) => {
    const profile = mkdtempSync(path.join(tmpdir(), 'e2e01-catalog-'));
    t.after(() => rmSync(profile, { recursive: true, force: true }));
    const f = seedE2E01(CampaignStore, profile),
      store = new CampaignStore(path.join(profile, 'workbench.sqlite'));
    try {
      const w = store.activate(f.a),
        plan = store.encounterPlan(w.token, f.planId),
        reference = mutate(f.creatureReference),
        before = store.db.serialize();
      assert.throws(
        () =>
          store.saveEncounterPlan({
            commandId: randomUUID(),
            campaignId: f.a,
            token: w.token,
            expectedRevision: plan.revision,
            plan: { ...plan, sourceReferences: [reference] },
          }),
        pattern,
      );
      const room = store.atlasRoom(w.token, f.roomId),
        key = store.db
          .prepare('SELECT * FROM dungeon_key_content WHERE campaign_id=? AND id=?')
          .get(f.a, f.roomId);
      assert.throws(
        () =>
          store.executeDrawing({
            commandId: randomUUID(),
            campaignId: f.a,
            token: w.token,
            action: {
              kind: 'key-batch',
              rooms: [{ id: room.id, expectedRevision: room.revision, keyRevision: key.revision }],
              patch: {
                references: [
                  { kind: 'creature', id: 'guard', label: 'Guard', catalogReference: reference },
                ],
              },
            },
          }),
        pattern,
      );
      assert.deepEqual(store.db.serialize(), before);
      assert.equal(
        store.resolveCatalogReference(f.itemReference).reference.entryId,
        f.itemReference.entryId,
      );
    } finally {
      store.close();
    }
  });

test('plan item binding keeps its immutable historical definition after edits, Complete import and Fresh', async (t) => {
  const profile = mkdtempSync(path.join(tmpdir(), 'e2e01-item-history-'));
  t.after(() => rmSync(profile, { recursive: true, force: true }));
  const f = seedE2E01(CampaignStore, profile),
    file = path.join(profile, 'workbench.sqlite'),
    store = new CampaignStore(file);
  let expected, importedPlan, importedId;
  try {
    const w = store.activate(f.a),
      command = (action) => ({ commandId: randomUUID(), token: w.token, campaignId: f.a, action });
    const definition = store.executeItemShop(
      command({
        kind: 'definition',
        expectedRevision: null,
        definition: {
          id: randomUUID(),
          revision: 0,
          name: 'Historische Laterne',
          category: 'equipment',
          magic: false,
          rarity: '',
          attunement: 'no',
          unitCopper: '25',
          weightText: '',
          properties: [],
          description: 'Ursprünglicher Verwendungsstand',
          source: { kind: 'authored', label: 'Eigene Definition', license: null, url: null },
          trashed: false,
        },
      }),
    ).definition;
    const reference = store.catalogReference('item', definition.id),
      plan = store.encounterPlan(w.token, f.planId);
    expected = store.saveEncounterPlan({
      commandId: randomUUID(),
      token: w.token,
      campaignId: f.a,
      expectedRevision: plan.revision,
      plan: { ...plan, items: [{ id: randomUUID(), reference, quantity: 2 }] },
    });
    const before = store.db
      .prepare('SELECT payload FROM encounter_plan WHERE campaign_id=? AND id=?')
      .get(f.a, f.planId).payload;
    store.executeItemShop(
      command({
        kind: 'definition',
        expectedRevision: definition.revision,
        definition: {
          ...definition,
          name: 'Neue Laterne',
          unitCopper: '900',
          description: 'Aktueller Definitionsstand',
        },
      }),
    );
    assert.equal(store.resolveCatalogReference(reference).name, 'Historische Laterne');
    assert.deepEqual(store.encounterPlan(w.token, f.planId), expected);
    assert.equal(
      store.db
        .prepare('SELECT payload FROM encounter_plan WHERE campaign_id=? AND id=?')
        .get(f.a, f.planId).payload,
      before,
    );
    const snapshot = path.join(profile, 'historical-item.sqlite');
    await store.campaignSnapshot(w.token, snapshot);
    const imported = store.acceptCampaignSnapshot(snapshot, 'Imported historical item', {}),
      mapping = JSON.parse(
        store.db
          .prepare('SELECT local_map FROM campaign_origin WHERE campaign_id=?')
          .get(imported.id).local_map,
      ),
      importedView = store.activate(imported.id);
    importedId = imported.id;
    importedPlan = store.encounterPlan(importedView.token, mapping[f.planId]);
    assert.notEqual(importedPlan.id, expected.id);
    assert.notEqual(importedPlan.items[0].id, expected.items[0].id);
    assert.deepEqual(importedPlan.items[0].reference, reference);
    assert.deepEqual(importedPlan.resolvedItems, expected.resolvedItems);
    assert.deepEqual(importedPlan.sourceReferences, expected.sourceReferences);
    assert.equal(importedPlan.resolvedItems[0].name, 'Historische Laterne');
    assert.equal(importedPlan.resolvedItems[0].unitCopper, '25');
    assert.equal(store.resolveCatalogReference(reference).name, 'Historische Laterne');
  } finally {
    store.close();
  }
  const fresh = new CampaignStore(file);
  try {
    const w = fresh.activate(f.a);
    assert.deepEqual(fresh.encounterPlan(w.token, f.planId), expected);
    const importedView = fresh.activate(importedId);
    assert.deepEqual(fresh.encounterPlan(importedView.token, importedPlan.id), importedPlan);
  } finally {
    fresh.close();
  }
});

test('foreign local encounter binding aborts Complete import without source or destination mutation', async (t) => {
  const profile = mkdtempSync(path.join(tmpdir(), 'e2e01-foreign-import-'));
  t.after(() => rmSync(profile, { recursive: true, force: true }));
  const f = seedE2E01(CampaignStore, profile),
    file = path.join(profile, 'workbench.sqlite'),
    store = new CampaignStore(file),
    snapshot = path.join(profile, 'foreign.sqlite');
  try {
    const w = store.activate(f.a);
    await store.campaignSnapshot(w.token, snapshot);
    const Database = (await import('better-sqlite3')).default,
      db = new Database(snapshot);
    try {
      const row = db
          .prepare('SELECT * FROM dungeon_key_content WHERE campaign_id=? AND id=?')
          .get(f.a, f.roomId),
        value = JSON.parse(row.payload);
      value.references.find((r) => r.kind === 'encounter').id = f.b;
      const payload = JSON.stringify(value);
      db.prepare(
        'UPDATE dungeon_key_content SET payload=?,checksum=? WHERE campaign_id=? AND id=?',
      ).run(payload, digest(payload), f.a, f.roomId);
    } finally {
      db.close();
    }
    const beforeSource = readFileSync(snapshot),
      beforeDestination = store.db.serialize();
    assert.throws(
      () => store.acceptCampaignSnapshot(snapshot, 'Must reject', {}),
      /Encounter-Vorlage fehlt|Keyreferenz/,
    );
    assert.deepEqual(readFileSync(snapshot), beforeSource);
    assert.deepEqual(store.db.serialize(), beforeDestination);
  } finally {
    store.close();
  }
});

test('campaign revision guards reject new stale commands while the original receipt remains idempotent', (t) => {
  const profile = mkdtempSync(path.join(tmpdir(), 'e2e01-campaign-revision-'));
  t.after(() => rmSync(profile, { recursive: true, force: true }));
  const f = seedE2E01(CampaignStore, profile),
    store = new CampaignStore(path.join(profile, 'workbench.sqlite'));
  try {
    const w = store.activate(f.a),
      command = {
        commandId: randomUUID(),
        token: w.token,
        campaignId: f.a,
        expectedCampaignRevision: w.campaign.revision,
        action: { kind: 'group-scale', scopeId: f.houseId, factor: 1.01 },
      };
    store.executeAtlasCommit(command);
    store.renameCampaign({
      commandId: randomUUID(),
      token: w.token,
      campaignId: f.a,
      expectedRevision: w.campaign.revision,
      name: 'New campaign revision',
    });
    const before = store.db.serialize();
    assert.throws(
      () => store.executeAtlasCommit({ ...command, commandId: randomUUID() }),
      /Kampagnenrevision/,
    );
    assert.deepEqual(store.db.serialize(), before);
    store.executeAtlasCommit(command);
    assert.deepEqual(
      store.db.serialize(),
      before,
      'Receipt replay cannot scale again after a later campaign revision',
    );
  } finally {
    store.close();
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from '../helpers/build.mjs';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { populateMixedWorld, mixedWorldInventory } from '../../tools/atlas-mixed-world-fixture.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts', 'src/app/storage/atlas-region.ts'],
  outdir: '.build/mixed-world-test',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outExtension: { '.js': '.cjs' },
  external: ['better-sqlite3'],
});
const require = createRequire(import.meta.url),
  { CampaignStore } = require('../../.build/mixed-world-test/store.cjs'),
  { AtlasRegionReader } = require('../../.build/mixed-world-test/atlas-region.cjs'),
  Database = require('better-sqlite3');
test('mixed world fixture preserves real hex sources, independent furnished buildings and readable detail geometry after reopen', async () => {
  const cache = path.join(homedir(), '.cache/saltmarcher/test');
  mkdirSync(cache, { recursive: true });
  const dir = mkdtempSync(path.join(cache, 'mixed-world-'));
  let store, db;
  try {
    store = new CampaignStore(dir + '/world.sqlite');
    const campaign = store.create('Gemischte Welt'),
      token = store.activateShell(campaign.id).token;
    const before = mixedWorldInventory(store.db, campaign.id);
    const fixture = populateMixedWorld(store, campaign, {
      hexes: 24,
      buildings: 2,
      details: 2,
      dungeonRooms: 12,
    });
    assert(fixture.inventory.rooms > 20);
    assert(fixture.inventory.elements > 20);
    assert.equal(fixture.inventory.bindings - before.bindings, 5);
    assert.equal(fixture.inventory.locations - before.locations, 5);
    const rows = store.db
      .prepare(
        "SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.sourceCell.mapId') IS NOT NULL",
      )
      .all(campaign.id);
    assert.equal(
      new Set(
        rows.map((r) => {
          const c = JSON.parse(r.payload).sourceCell;
          return `${c.mapId}:${c.level}:${c.q}:${c.r}`;
        }),
      ).size,
      24,
    );
    store.close();
    store = new CampaignStore(dir + '/world.sqlite');
    assert.deepEqual(mixedWorldInventory(store.db, campaign.id), fixture.inventory);
    const shell = store.activateShell(campaign.id),
      source = store.atlasRegionSource(shell.token);
    db = new Database(dir + '/world.sqlite', { readonly: true });
    const reader = new AtlasRegionReader(db);
    await reader.sync(source);
    for (const [id, box] of [
      ['mixed-house:0', { x: 15, y: 15, width: 60, height: 50 }],
      ['mixed-dungeon', { x: 9990, y: 9990, width: 100, height: 40 }],
    ]) {
      const region = reader.read(source, {
        box,
        width: 1024,
        height: 768,
        scopeId: id,
        floorId: 'ground',
        slice: null,
        roofs: false,
      });
      assert.equal(region.coverage.unreadable, 0);
      assert(region.rooms.some((r) => r.scopeId === id));
      assert.equal(region.cities.length, 0);
    }
  } finally {
    db?.close();
    store?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

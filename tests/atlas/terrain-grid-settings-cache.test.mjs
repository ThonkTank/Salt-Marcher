import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/storage/atlas-landscape-region';export * from './src/app/storage/terrain-grid';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-grid-settings-cache-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  AtlasLandscapeReader,
  readTerrainGrid,
} = require('../../.build/terrain-grid-settings-cache-test.cjs');

test('synced landscape visibility reuses canonical sea level and refreshes after edits and history', (t) => {
  const base = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/terrain-settings-cache-');
  const store = new CampaignStore(dir + '/world.sqlite'),
    campaign = store.create('Settings cache'),
    token = store.activateShell(campaign.id).token;
  const write = (action) =>
    store.executeAtlasCommit({ commandId: randomUUID(), campaignId: campaign.id, token, action });
  write({ kind: 'landscape-sea-level', seaLevelM: 25 });
  const rawDb = new (require('better-sqlite3'))(store.filename, { readonly: true }),
    lookups = { count: 0 };
  const db = new Proxy(rawDb, {
    get(target, key) {
      if (key === 'prepare')
        return (sql) => {
          if (
            sql.includes('SELECT payload FROM atlas_landscape') &&
            sql.includes('$.terrainSettings')
          )
            lookups.count++;
          return target.prepare(sql);
        };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const reader = new AtlasLandscapeReader(db),
    box = { x: 0, y: 0, width: 4, height: 4 },
    view = {
      box,
      frame: box,
      columns: 3,
      rows: 3,
      focusM: 0,
      tilt: 0,
      rotation: 0,
      exaggeration: 1,
    };
  t.after(() => {
    rawDb.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });

  let source = store.atlasRegionSource(token);
  reader.sync(source);
  assert.equal(reader.visibility(source, view).seaLevelM, 25);
  assert.equal(lookups.count, 0, 'synced visibility uses the settings snapshot read by sync');
  assert.equal(
    readTerrainGrid(db, campaign.id, view).seaLevelM,
    25,
    'standalone reads retain their canonical SQL fallback',
  );
  assert.equal(lookups.count, 1);

  write({ kind: 'landscape-sea-level', seaLevelM: 100 });
  source = store.atlasRegionSource(token, source);
  reader.sync(source);
  assert.equal(
    reader.visibility(source, view).seaLevelM,
    100,
    'a settings edit refreshes the cached canonical value',
  );
  assert.equal(lookups.count, 1);
  write({ kind: 'undo' });
  source = store.atlasRegionSource(token, source);
  reader.sync(source);
  assert.equal(
    reader.visibility(source, view).seaLevelM,
    25,
    'undo refreshes the cached canonical value',
  );
  assert.equal(lookups.count, 1);
  write({ kind: 'redo' });
  source = store.atlasRegionSource(token, source);
  reader.sync(source);
  assert.equal(
    reader.visibility(source, view).seaLevelM,
    100,
    'redo refreshes the cached canonical value',
  );
  assert.equal(lookups.count, 1);
});

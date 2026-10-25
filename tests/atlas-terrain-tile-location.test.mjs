import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url),
  Database = require('better-sqlite3');
buildSync({
  stdin: {
    contents: `export * from './src/app/storage/store';export * from './src/app/storage/atlas-region';export * from './src/app/storage/atlas-terrain-tiles';export * from './src/app/atlas-landscape';export * from './src/app/landscape-line';export {newLocation} from './src/features/location/location-schema';`,
    resolveDir: process.cwd(),
  },
  outfile: '.build/atlas-terrain-tile-location-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  AtlasRegionReader,
  AtlasTerrainTiles,
  emptyRecord,
  newLine,
  newLocation,
} = require('../.build/atlas-terrain-tile-location-test.cjs');

test('warm tile reopen invalidates route labels when its linked location is renamed', async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'atlas-tile-location-')),
    store = new CampaignStore(path.join(dir, 'world.sqlite')),
    campaign = store.create('Location label fence'),
    token = store.activateShell(campaign.id).token,
    locationId = randomUUID(),
    sectionIds = [randomUUID(), randomUUID()],
    location = newLocation(locationId, 'Alter Ortsname', 'poi', sectionIds);
  let db, reader, tiles, cursor;
  const reopen = () => {
    tiles?.close();
    db?.close();
    db = new Database(store.filename, { readonly: true });
    reader = new AtlasRegionReader(db);
    tiles = new AtlasTerrainTiles(db, path.join(dir, 'cache'));
    cursor = undefined;
  };
  t.after(() => {
    tiles?.close();
    db?.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  store.changePreparation({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token,
    change: { kind: 'location', document: location, expectedRevision: null },
  });
  const points = [
      { x: 20, y: 20 },
      { x: 220, y: 20 },
    ],
    route = {
      ...emptyRecord('road'),
      id: randomUUID(),
      name: 'Interner Routenname',
      locationId,
      width: 6,
      points,
      line: newLine('road'),
    };
  store.executeAtlasCommit({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token,
    action: { kind: 'landscape-put', record: route, expectedRevision: null },
  });
  reopen();
  const read = async () => {
    cursor = store.atlasRegionSource(token, cursor);
    db.exec('BEGIN');
    try {
      await reader.sync(cursor, false);
      const steps = tiles.read(
        cursor,
        { tile: { lod: 0, x: 0, y: 0 }, revision: cursor.revision },
        reader,
      );
      for (;;) {
        const step = steps.next();
        if (step.done) {
          db.exec('COMMIT');
          return step.value;
        }
      }
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  const first = await read();
  assert.equal(first.cache, 'built');
  assert.equal(first.projection.routes.find((r) => r.id === route.id)?.name, 'Alter Ortsname');
  reopen();
  const warm = await read();
  assert.equal(warm.cache, 'hit');
  assert.equal(warm.projection.routes.find((r) => r.id === route.id)?.name, 'Alter Ortsname');
  const changed = { ...location, name: 'Neuer Ortsname' };
  store.changePreparation({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token,
    change: { kind: 'location', document: changed, expectedRevision: 1 },
  });
  reopen();
  const renamed = await read();
  assert.equal(
    renamed.cache,
    'built',
    'linked location changes must invalidate the durable terrain projection',
  );
  assert.equal(renamed.projection.routes.find((r) => r.id === route.id)?.name, 'Neuer Ortsname');
});

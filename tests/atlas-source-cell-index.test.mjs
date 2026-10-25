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
      "export {CampaignStore} from './src/app/storage/store'; export {sourceCellLookup,installSourceCellIndex} from './src/app/storage/atlas-source-cell';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/atlas-source-cell-index.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  sourceCellLookup: lookup,
  installSourceCellIndex,
} = require('../.build/atlas-source-cell-index.cjs');
test('source-cell index backfills an existing database and follows canonical updates, deletes and reopen', (t) => {
  const root = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(root + '/source-cell-');
  let store = new CampaignStore(dir + '/world.sqlite');
  const campaign = store.create('Cell index');
  let active = store.activate(campaign.id);
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const write = (action) =>
    store.executeWorld({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: active.token,
      action,
    });
  const reopen = () => {
    store.close();
    store = new CampaignStore(dir + '/world.sqlite');
    active = store.activate(campaign.id);
  };
  let map = store.world(active.token).maps[0];
  store.db.exec('DROP INDEX landscape_source_cell');
  const cells = Array.from({ length: 24 }, (_, i) => ({
    q: (i % 8) - 4,
    r: Math.floor(i / 8) - 2,
    level: 0,
    terrain: 'forest',
    elevationM: 12,
    climate: null,
    road: false,
    river: false,
    label: '',
    faction: '',
    interrupt: '',
  }));
  write({
    kind: 'map',
    map: { ...map, cells },
    expectedRevision: map.revision,
  });
  const cell = cells[0],
    args = [campaign.id, map.id, cell.level, cell.q, cell.r],
    before = store.db.prepare(lookup).get(...args);
  assert(before);
  reopen();
  assert.deepEqual(store.db.prepare(lookup).get(...args), before);
  const plan = store.db
    .prepare('EXPLAIN QUERY PLAN ' + lookup)
    .all(...args)
    .map((row) => row.detail)
    .join('\n');
  assert.match(plan, /USING INDEX landscape_source_cell/);
  assert.match(plan, /campaign_id=\? AND <expr>=\? AND <expr>=\? AND <expr>=\? AND <expr>=\?/);
  map = store.world(active.token).maps[0];
  write({
    kind: 'cell',
    mapId: map.id,
    cell: { ...cell, terrain: 'plains' },
    expectedRevision: map.revision,
  });
  const updated = store.db.prepare(lookup).all(...args);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].id, before.id);
  assert(updated[0].revision > before.revision);
  const payload = JSON.parse(
    store.db
      .prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? AND id=?')
      .get(campaign.id, before.id).payload,
  );
  assert.equal(payload.values.terrain, 'plains');
  assert.equal(store.db.prepare(lookup).get('different-campaign', ...args.slice(1)), undefined);
  reopen();
  assert.deepEqual(store.db.prepare(lookup).all(...args), updated);
  map = store.world(active.token).maps[0];
  write({
    kind: 'map',
    map: { ...map, cells: [] },
    expectedRevision: map.revision,
  });
  assert.equal(store.db.prepare(lookup).get(...args), undefined);
  reopen();
  assert.equal(store.db.prepare(lookup).get(...args), undefined);
});

test('source-cell index excludes malformed JSON during writes and reopening without deleting it', (t) => {
  const root = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(root + '/source-cell-corrupt-');
  let store = new CampaignStore(dir + '/world.sqlite');
  const cam = store.create('Healthy campaign');
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  store.db
    .prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)')
    .run(cam.id, 'broken', 0, 0, 1, 0, 1, '{broken');
  assert.equal(store.db.prepare(lookup).get(cam.id, 'map', 0, 0, 0), undefined);
  store.close();
  store = new CampaignStore(dir + '/world.sqlite');
  assert(store.activateShell(cam.id).token);
  assert.equal(
    store.db.prepare('SELECT payload FROM atlas_landscape WHERE id=?').get('broken').payload,
    '{broken',
  );
  store.db
    .prepare('UPDATE atlas_landscape SET payload=? WHERE id=?')
    .run('{still-broken', 'broken');
  assert.equal(store.db.prepare(lookup).get(cam.id, 'map', 0, 0, 0), undefined);
});

test('upgrading the earlier unguarded source index retains its valid source row', () => {
  const db = new (require('better-sqlite3'))(':memory:');
  try {
    db.exec(
      "CREATE TABLE atlas_landscape(campaign_id TEXT,id TEXT,revision INTEGER,payload TEXT); CREATE INDEX landscape_source_cell ON atlas_landscape(campaign_id,json_extract(payload,'$.sourceCell.mapId'))",
    );
    const payload = JSON.stringify({ sourceCell: { mapId: 'world', level: 0, q: -3, r: 4 } });
    db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?)').run('campaign', 'cell', 7, payload);
    installSourceCellIndex(db);
    assert.deepEqual(db.prepare(lookup).get('campaign', 'world', 0, -3, 4), {
      id: 'cell',
      revision: 7,
    });
    db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?)').run('campaign', 'bad', 1, '{bad');
    installSourceCellIndex(db);
    assert.equal(
      db.prepare('SELECT payload FROM atlas_landscape WHERE id=?').get('cell').payload,
      payload,
    );
  } finally {
    db.close();
  }
});

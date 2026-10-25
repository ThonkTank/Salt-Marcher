import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from '../helpers/build.mjs';
import { createRequire } from 'node:module';
buildSync({
  entryPoints: {
    'storage/atlas-landscape': 'src/app/storage/atlas-landscape.ts',
    'terrain-height': 'src/app/atlas/terrain-height.ts',
  },
  outdir: '.build/landscape-write-cost',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outExtension: { '.js': '.cjs' },
});
const require = createRequire(import.meta.url),
  Database = require('better-sqlite3'),
  { putLandscape } = require('../../.build/landscape-write-cost/storage/atlas-landscape.cjs'),
  { heightRecord } = require('../../.build/landscape-write-cost/terrain-height.cjs');
const patch = (i) => ({
  id: 'patch:' + i,
  revision: 0,
  kind: 'patch',
  name: 'Wald',
  points: [],
  polygons: [
    {
      outer: [
        { x: i, y: 0 },
        { x: i + 1, y: 0 },
        { x: i + 1, y: 1 },
        { x: i, y: 1 },
      ],
      holes: [],
    },
  ],
  resolution: 1,
  width: 0,
  propertyOnly: true,
  values: { terrain: 'forest' },
});
function database() {
  const db = new Database(':memory:');
  db.exec(
    'CREATE TABLE atlas_landscape(campaign_id TEXT,id TEXT,revision INTEGER,min_x REAL,max_x REAL,min_y REAL,max_y REAL,payload TEXT,PRIMARY KEY(campaign_id,id))',
  );
  return db;
}
test('many landscape writes reuse fixed SQL while preserving revisions, rollback, ordering and connection isolation', () => {
  const a = database(),
    b = database(),
    prepared = new Map(),
    prepare = a.prepare.bind(a);
  a.prepare = (sql) => {
    prepared.set(sql, (prepared.get(sql) ?? 0) + 1);
    return prepare(sql);
  };
  try {
    a.transaction(() => {
      for (let i = 0; i < 200; i++) putLandscape(a, 'world', patch(i), null);
    })();
    const writePreparations = [...prepared].filter(([sql]) =>
      /SELECT revision,payload|coalesce\(max\(json_extract|INSERT INTO atlas_landscape/.test(sql),
    );
    assert.equal(writePreparations.length, 3);
    for (const [sql, n] of writePreparations)
      assert.equal(n, 1, 'prepare count must not grow with edited tiles: ' + sql);
    putLandscape(b, 'world', patch(0), null);
    const row = (db, id) =>
      JSON.parse(db.prepare('SELECT payload FROM atlas_landscape WHERE id=?').get(id).payload);
    assert.equal(row(a, 'patch:199').order, 200);
    assert.equal(row(b, 'patch:0').order, 1);
    assert.throws(
      () =>
        a.transaction(() => {
          putLandscape(a, 'world', { ...patch(0), name: 'Rollback' }, 1);
          throw Error('abort');
        })(),
      /abort/,
    );
    assert.equal(row(a, 'patch:0').revision, 1);
    assert.equal(row(a, 'patch:0').name, 'Wald');
    putLandscape(a, 'world', { ...patch(0), name: 'Geändert' }, 1);
    assert.equal(row(a, 'patch:0').revision, 2);
    assert.throws(() => putLandscape(a, 'world', patch(0), 1), /inzwischen geändert/);
    const height = heightRecord(0, 0, 1, new Float32Array(4096));
    putLandscape(a, 'world', height, null);
    assert.throws(
      () => putLandscape(a, 'world', { ...height, id: 'duplicate' }, null),
      /Doppelte Höhenkachel/,
    );
  } finally {
    a.close();
    b.close();
  }
});

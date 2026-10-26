import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
const require = createRequire(import.meta.url),
  Database = require('better-sqlite3');
buildSync({
  entryPoints: ['src/app/storage/item-definitions.ts'],
  outfile: '.build/srd-item-projection.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const {
  installItemDefinitions,
  readItemDefinition,
} = require('../../.build/srd-item-projection.cjs');
const source = JSON.parse(
  readFileSync('src/features/catalog/data/items-srd51-transcript.json', 'utf8'),
);
const byName = (name) => source.records.find((r) => r.name === name).id;
function fixture(t) {
  const db = new Database(':memory:');
  t.after(() => db.close());
  db.exec(
    'CREATE TABLE authored_item(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,name TEXT NOT NULL,category TEXT NOT NULL,unit_copper TEXT NOT NULL) STRICT',
  );
  installItemDefinitions(db);
  return db;
}
function put(db, definition) {
  const payload = JSON.stringify(definition),
    checksum = createHash('sha256').update(payload).digest('hex');
  db.prepare('INSERT OR REPLACE INTO item_definition VALUES(?,?,?,?)').run(
    definition.id,
    definition.revision,
    payload,
    checksum,
  );
  db.prepare('INSERT OR REPLACE INTO item_definition_version VALUES(?,?,?,?)').run(
    definition.id,
    definition.revision,
    payload,
    checksum,
  );
}

test('derived SRD definitions retain reference property rules and readable armor prerequisites', (t) => {
  const db = fixture(t),
    crossbow = readItemDefinition(db, byName('Crossbow, light')),
    plate = readItemDefinition(db, byName('Plate Armor'));
  assert.match(crossbow.description, /Ammunition: range 80\/320/);
  assert.deepEqual(crossbow.properties, ['Ammunition', 'Loading', 'Two-handed']);
  assert.match(plate.description, /Strength: Str 15/);
  assert(!plate.description.includes('strengthRequirementText'));
  assert.match(plate.source.label, /S\. 63/);
  for (const record of source.records)
    for (const property of record.properties)
      if (property.description)
        assert(
          readItemDefinition(db, record.id).description.includes(property.description),
          record.name + ' retains ' + property.name,
        );
});

test('a corrected projection advances only its current SRD head and preserves observed versions and authored copies', (t) => {
  const db = fixture(t),
    id = byName('Crossbow, light'),
    current = readItemDefinition(db, id),
    unchanged = readItemDefinition(db, byName('Abacus'));
  // Real previously shipped projection: source hash is unchanged, but range is missing.
  const old = { ...current, revision: 7, description: 'Price: 25 gp\n\nDamage: 1d8 · piercing' };
  db.prepare('DELETE FROM item_definition_version WHERE id=?').run(id);
  put(db, old);
  const copy = {
    ...old,
    id: 'authored-crossbow',
    revision: 3,
    description: 'GM: eigene Reichweite 12 m.\r\nNicht ersetzen.',
    source: { kind: 'authored', label: 'GM', license: null, url: null },
  };
  put(db, copy);
  const copyBytes = db.prepare('SELECT * FROM item_definition WHERE id=?').get(copy.id),
    oldBytes = db
      .prepare('SELECT * FROM item_definition_version WHERE id=? AND revision=7')
      .get(id);
  installItemDefinitions(db);
  const repaired = readItemDefinition(db, id);
  assert.equal(repaired.revision, 8);
  assert.equal(repaired.sourceHash, old.sourceHash);
  assert.match(repaired.description, /range 80\/320/);
  assert.deepEqual(readItemDefinition(db, id, 7), old);
  assert.deepEqual(
    db.prepare('SELECT * FROM item_definition_version WHERE id=? AND revision=7').get(id),
    oldBytes,
  );
  assert.throws(() => readItemDefinition(db, id, 6), /historische Gegenstandsversion/);
  assert.deepEqual(db.prepare('SELECT * FROM item_definition WHERE id=?').get(copy.id), copyBytes);
  assert.deepEqual(readItemDefinition(db, unchanged.id), unchanged);
  const changes = db.prepare('SELECT total_changes() n').get().n;
  installItemDefinitions(db);
  assert.equal(
    db.prepare('SELECT total_changes() n').get().n,
    changes,
    'unchanged startup writes no new versions',
  );
});

test('complete SRD installation prepares a bounded batch and rolls back every row on failure', (t) => {
  const db = new Database(':memory:');
  t.after(() => db.close());
  db.exec(
    'CREATE TABLE authored_item(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,name TEXT NOT NULL,category TEXT NOT NULL,unit_copper TEXT NOT NULL) STRICT',
  );
  const prepare = db.prepare.bind(db);
  let preparations = 0;
  db.prepare = (...args) => {
    preparations++;
    return prepare(...args);
  };
  try {
    installItemDefinitions(db);
  } finally {
    db.prepare = prepare;
  }
  assert(preparations <= 12, `Batch prepared ${preparations} statements for a fixed source`);
  const tables = ['item_definition', 'item_definition_version', 'authored_item'];
  const rows = () => tables.map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY id`).all());
  const expected = rows();
  assert(expected.every((entries) => entries.length >= source.records.length));
  for (const table of tables) db.exec(`DELETE FROM ${table}`);
  db.exec(`CREATE TRIGGER reject_install BEFORE INSERT ON authored_item
    WHEN (SELECT count(*) FROM authored_item)=20
    BEGIN SELECT RAISE(ABORT,'controlled installation failure'); END;`);
  assert.throws(() => installItemDefinitions(db), /controlled installation failure/);
  assert.deepEqual(rows(), [[], [], []], 'no partial definitions or version history survive');
  db.exec('DROP TRIGGER reject_install');
  installItemDefinitions(db);
  assert.deepEqual(rows(), expected, 'retry retains every source byte, checksum and revision');
});

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import {
  assertReferenceInventory,
  referenceContents,
  referenceCommit,
  referencePath,
} from './atlas-reference-fixture.mjs';
import { rebuildContinuousFixture } from './atlas-terrain-fixture.mjs';

// Regenerate a disposable current fixture from its pinned source corpus.
// This does not add a product database compatibility or migration path.
const output = process.argv[2];
if (!output || process.argv.length !== 3)
  throw Error('Usage: node tools/create-atlas-mixed-fixture.mjs <output.sqlite.gz>');
const previous = JSON.parse(
  readFileSync(new URL('../tests/fixtures/atlas/mixed-world-manifest.json', import.meta.url)),
);
const format = JSON.parse(readFileSync(new URL('../src/app/data-format.json', import.meta.url)));
assert.equal(format.schema, 55, 'Review fixture regeneration when the product format changes');
const compressed = execFileSync('git', ['show', `${referenceCommit}:${referencePath}`], {
  maxBuffer: 128 * 1024 * 1024,
});
assert.equal(createHash('sha256').update(compressed).digest('hex'), previous.sourceSha256);
const dir = mkdtempSync(join(tmpdir(), 'atlas-reference-')),
  file = join(dir, 'world.sqlite');
const temporary = resolve(output) + `.tmp-${process.pid}`;
let db;
try {
  writeFileSync(file, gunzipSync(compressed));
  db = new (createRequire(import.meta.url)('better-sqlite3'))(file);
  assert.equal(db.pragma('user_version', { simple: true }), 54);
  const originalTables = previous.originalTables ?? previous.tables;
  assert.deepEqual(referenceContents(db), originalTables, 'Pinned fixture source changed');
  db.pragma('journal_mode=DELETE');
  db.transaction(() => {
    db.exec('DROP TABLE atlas_landscape_migration');
    db.pragma('user_version=55');
  })();
  assert.equal(rebuildContinuousFixture(db), 100000);
  assertReferenceInventory(db);
  const tables = referenceContents(db);
  db.close();
  db = null;
  const bytes = gzipSync(readFileSync(file), { level: 9 });
  const manifest = {
    sourceCommit: referenceCommit,
    sourcePath: referencePath,
    sourceSha256: previous.sourceSha256,
    model: 'continuous-terrain-v1',
    fixtureSha256: createHash('sha256').update(bytes).digest('hex'),
    originalTables,
    tables,
  };
  writeFileSync(temporary, bytes);
  renameSync(temporary, resolve(output));
  writeFileSync(
    join(dirname(resolve(output)), 'mixed-world-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  console.log(
    'Rebuilt continuous terrain with 100000 free-form regions; buildings, roads, height tiles and source provenance retained.',
  );
} finally {
  db?.close();
  rmSync(temporary, { force: true });
  rmSync(dir, { recursive: true, force: true });
}

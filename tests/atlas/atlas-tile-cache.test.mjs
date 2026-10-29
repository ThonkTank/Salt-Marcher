import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  truncateSync,
  writeFileSync,
  existsSync,
  statSync,
  lstatSync,
  symlinkSync,
  readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { serialize } from 'node:v8';

const require = createRequire(import.meta.url),
  namespace = 'a'.repeat(64);
buildSync({
  stdin: {
    contents: "export * from './src/app/storage/atlas-tile-cache';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/atlas-tile-cache-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  AtlasTileCache,
  clearCorruptAtlasTileCaches,
} = require('../../.build/atlas-tile-cache-test.cjs');
const fixture = (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'saltmarcher-atlas-tiles-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
};
const ns2 = 'b'.repeat(64),
  ns3 = 'c'.repeat(64),
  sharedFile = (directory) => join(directory, 'tiles-v2', 'atlas-tiles.sqlite');

test('persists typed arrays across close and reopen with intact values', (t) => {
  const directory = fixture(t),
    first = AtlasTileCache.open(directory, namespace),
    value = new Float32Array([1.25, -3, 100]);
  assert.equal(first.put('terrain:0:0:0', 'source-a', value), true);
  first.close();
  const second = AtlasTileCache.open(directory, namespace),
    restored = second.get('terrain:0:0:0', 'source-a');
  assert(restored instanceof Float32Array);
  assert.deepEqual([...restored], [1.25, -3, 100]);
  assert.equal(second.diagnostics.hits, 1);
  assert.equal(second.diagnostics.bytes, serialize(value).byteLength);
  second.close();
});

test('source mismatch is a miss and leaves the other source entry intact', (t) => {
  const cache = AtlasTileCache.open(fixture(t), namespace);
  cache.put('tile', 'rev-1', { height: 4 });
  assert.equal(cache.get('tile', 'rev-2'), undefined);
  assert.deepEqual(cache.get('tile', 'rev-1'), { height: 4 });
  assert.equal(cache.diagnostics.misses, 1);
  cache.close();
});

test('two cache handles share one database and serialize same-key replacement', (t) => {
  const directory = fixture(t),
    first = AtlasTileCache.open(directory, namespace),
    second = AtlasTileCache.open(directory, namespace);
  assert.equal(first.put('tile', 'old', 'old'), true);
  assert.equal(second.put('tile', 'new', 'new'), true);
  assert.equal(first.get('tile', 'old'), undefined);
  assert.equal(second.get('tile', 'new'), 'new');
  first.close();
  second.close();
});

test('a reserved writer does not discard a valid cache hit when the LRU touch is busy', (t) => {
  const directory = fixture(t),
    cache = AtlasTileCache.open(directory, namespace);
  assert(cache.put('tile', 's', { height: 42 }));
  const Database = require('better-sqlite3'),
    writer = new Database(sharedFile(directory));
  try {
    writer.exec('BEGIN IMMEDIATE');
    assert.deepEqual(cache.get('tile', 's'), { height: 42 });
    assert.equal(cache.diagnostics.hits, 1);
    assert.throws(
      () => AtlasTileCache.eraseNamespace(directory, namespace),
      /nicht sicher verfügbar/,
      'an incomplete namespace erasure must remain retryable',
    );
  } finally {
    if (writer.inTransaction) writer.exec('ROLLBACK');
    writer.close();
    cache.close();
  }
});

test('global LRU crosses namespaces while each namespace keeps its own ceiling', (t) => {
  const directory = fixture(t),
    options = { maxBytes: 400, maxGlobalBytes: 600, maxEntryBytes: 300 };
  const a = AtlasTileCache.open(directory, namespace, options),
    b = AtlasTileCache.open(directory, ns2, options),
    c = AtlasTileCache.open(directory, ns3, options);
  assert(a.put('old', 's', randomBytes(220)));
  assert(b.put('warm', 's', randomBytes(220)));
  assert(a.get('old', 's'));
  assert(c.put('new', 's', randomBytes(220)));
  assert.equal(b.get('warm', 's'), undefined);
  assert(a.get('old', 's'));
  assert(c.get('new', 's'));
  assert(a.put('next', 's', randomBytes(220)));
  assert.equal(a.get('old', 's'), undefined, 'per-namespace LRU evicts its own oldest entry');
  for (const cache of [a, b, c]) cache.close();
});

test('an older live handle observes tightened persisted limits from another handle', (t) => {
  const directory = fixture(t),
    high = AtlasTileCache.open(directory, namespace, {
      maxBytes: 800,
      maxGlobalBytes: 1200,
      maxEntryBytes: 400,
    });
  assert(high.put('first', 's', randomBytes(220)));
  const lower = AtlasTileCache.open(directory, ns2, {
    maxBytes: 300,
    maxGlobalBytes: 300,
    maxEntryBytes: 128,
  });
  assert.equal(
    high.put('too-large', 's', randomBytes(220)),
    false,
    'old handle may not use a looser per-entry ceiling',
  );
  assert(
    high.put('second', 's', randomBytes(120)),
    'old handle may write within the tightened pool',
  );
  assert(high.diagnostics.bytes <= 300);
  assert(lower.diagnostics.bytes <= 300);
  high.close();
  lower.close();
});

test('runtime open refuses symlinked and foreign shared database files before changing them', (t) => {
  const directory = fixture(t),
    root = join(directory, 'tiles-v2');
  mkdirSync(root);
  const target = join(directory, 'foreign.sqlite'),
    Database = require('better-sqlite3'),
    foreign = new Database(target);
  foreign.pragma('application_id = 0x534d4f54');
  foreign.pragma('journal_mode = WAL');
  foreign.exec('CREATE TABLE preserved(value)');
  foreign.close();
  const link = sharedFile(directory);
  symlinkSync(target, link);
  const disabled = AtlasTileCache.open(directory, namespace);
  assert.equal(disabled.enabled, false);
  disabled.close();
  assert.equal(lstatSync(link).isSymbolicLink(), true);
  const check = new Database(target, { readonly: true });
  assert.equal(check.pragma('journal_mode', { simple: true }), 'wal');
  assert(check.prepare("SELECT 1 FROM sqlite_schema WHERE name='preserved'").get());
  check.close();
});

test('corrupt blob is deleted and reported as a miss', (t) => {
  const directory = fixture(t),
    cache = AtlasTileCache.open(directory, namespace);
  cache.put('tile', 'rev', new Uint8Array([1, 2, 3]));
  cache.close();
  const Database = require('better-sqlite3'),
    db = new Database(join(directory, 'tiles-v2', 'atlas-tiles.sqlite'));
  db.prepare("UPDATE atlas_tile_cache SET blob=?,digest=? WHERE key='tile'").run(
    Buffer.from([9, 8, 7]),
    '0'.repeat(64),
  );
  db.close();
  const reopened = AtlasTileCache.open(directory, namespace);
  assert.equal(reopened.get('tile', 'rev'), undefined);
  assert.equal(reopened.diagnostics.bytes, 0);
  reopened.close();
});

test('invalid serialized bytes with a matching digest are deleted as a miss', (t) => {
  const directory = fixture(t),
    cache = AtlasTileCache.open(directory, namespace);
  cache.put('tile', 'rev', 'valid');
  cache.close();
  const Database = require('better-sqlite3'),
    db = new Database(join(directory, 'tiles-v2', 'atlas-tiles.sqlite')),
    blob = Buffer.from([1, 2, 3]);
  db.prepare("UPDATE atlas_tile_cache SET blob=?,digest=?,bytes=? WHERE key='tile'").run(
    blob,
    createHash('sha256').update(blob).digest('hex'),
    blob.length,
  );
  db.close();
  const reopened = AtlasTileCache.open(directory, namespace);
  assert.equal(reopened.get('tile', 'rev'), undefined);
  assert.equal(reopened.diagnostics.bytes, 0);
  reopened.close();
});

test('a shared cache with an unknown schema version is preserved and disabled', (t) => {
  const directory = fixture(t),
    cache = AtlasTileCache.open(directory, namespace);
  cache.put('old', 'rev', 'stale');
  cache.close();
  const file = join(directory, 'tiles-v2', 'atlas-tiles.sqlite'),
    Database = require('better-sqlite3'),
    db = new Database(file);
  db.pragma('user_version=77');
  db.close();
  const disabled = AtlasTileCache.open(directory, namespace);
  assert.equal(disabled.enabled, false);
  disabled.close();
  const check = new Database(file, { readonly: true });
  assert.equal(check.pragma('user_version', { simple: true }), 77);
  assert.ok(check.prepare("SELECT 1 FROM atlas_tile_cache WHERE key='old'").get());
  check.close();
});

test('a damaged header disables worker cache open without recursion or deleting an unowned lock', async (t) => {
  const directory = fixture(t),
    cache = AtlasTileCache.open(directory, namespace);
  cache.close();
  const file = sharedFile(directory);
  const bytes = require('node:fs').readFileSync(file);
  bytes[0] = 0;
  writeFileSync(file, bytes);
  const disabled = AtlasTileCache.open(directory, namespace);
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.get('x', 's'), undefined);
  disabled.close();
  const foreignLock = file + '.recover-lock';
  writeFileSync(foreignLock, 'owned by other process');
  await clearCorruptAtlasTileCaches(directory);
  assert(existsSync(file));
  assert.equal(require('node:fs').readFileSync(foreignLock, 'utf8'), 'owned by other process');
});

test('opening an unowned shared SQLite file does not convert its journal mode', (t) => {
  const directory = fixture(t),
    root = join(directory, 'tiles-v2'),
    file = sharedFile(directory);
  mkdirSync(root);
  const Database = require('better-sqlite3'),
    foreign = new Database(file);
  foreign.pragma('application_id = 0x534d4f54');
  foreign.pragma('journal_mode = WAL');
  foreign.exec('CREATE TABLE preserved(value)');
  foreign.close();
  const disabled = AtlasTileCache.open(directory, namespace);
  assert.equal(disabled.enabled, false);
  disabled.close();
  const check = new Database(file, { readonly: true });
  assert.equal(check.pragma('journal_mode', { simple: true }), 'wal');
  check.close();
});

test('startup cleanup removes only a corrupt cache with a readable owned SQLite header', async (t) => {
  const directory = fixture(t),
    root = join(directory, 'tiles-v1'),
    owned = join(root, namespace + '.sqlite');
  mkdirSync(root);
  const Database = require('better-sqlite3'),
    db = new Database(owned);
  db.pragma('application_id = 0x534d5443');
  db.exec('CREATE TABLE sample(value BLOB); INSERT INTO sample VALUES(zeroblob(12000))');
  db.close();
  truncateSync(owned, 100);
  writeFileSync(owned + '-journal', 'active journal sentinel');
  await clearCorruptAtlasTileCaches(directory);
  assert(existsSync(owned));
  rmSync(owned + '-journal');
  await clearCorruptAtlasTileCaches(directory);
  assert.equal(existsSync(owned), false);
  const foreign = 'b'.repeat(64),
    foreignFile = join(root, foreign + '.sqlite'),
    other = new Database(foreignFile);
  other.pragma('application_id = 0x534d4f54');
  other.exec('CREATE TABLE sample(value BLOB); INSERT INTO sample VALUES(zeroblob(12000))');
  other.close();
  truncateSync(foreignFile, 100);
  await clearCorruptAtlasTileCaches(directory);
  assert(existsSync(foreignFile), 'foreign app id must be preserved');
});

test('discarding a corrupt snapshot cannot delete a replacement written by another handle', (t) => {
  const directory = fixture(t),
    cache = AtlasTileCache.open(directory, namespace),
    Database = require('better-sqlite3');
  cache.put('tile', 'same-source', 'old');
  const db = new Database(sharedFile(directory)),
    observed = db
      .prepare('SELECT source,digest,bytes FROM atlas_tile_cache WHERE namespace=? AND key=?')
      .get(namespace, 'tile');
  db.close();
  cache.put('tile', 'same-source', 'new');
  cache['discard']('tile', observed.source, observed.digest, observed.bytes);
  assert.equal(cache.get('tile', 'same-source'), 'new');
  cache.close();
});

test('exclusive V1 retirement removes only known regular owned shards without sidecars', async (t) => {
  const directory = fixture(t),
    root = join(directory, 'tiles-v1'),
    Database = require('better-sqlite3');
  mkdirSync(root);
  const makeOwned = (name) => {
    const file = join(root, name + '.sqlite'),
      db = new Database(file);
    db.pragma('application_id = 0x534d5443');
    db.pragma('user_version=1');
    db.exec(
      'CREATE TABLE atlas_tile_meta(id INTEGER PRIMARY KEY,format INTEGER NOT NULL,sequence INTEGER NOT NULL); INSERT INTO atlas_tile_meta VALUES(1,1,0); CREATE TABLE atlas_tile_cache(key TEXT PRIMARY KEY,source TEXT NOT NULL,blob BLOB NOT NULL,digest TEXT NOT NULL,bytes INTEGER NOT NULL,last_used INTEGER NOT NULL) WITHOUT ROWID',
    );
    db.close();
    return file;
  };
  const removable = makeOwned('d'.repeat(64)),
    withSidecar = makeOwned('e'.repeat(64)),
    symlinkTarget = join(directory, 'target.sqlite'),
    targetDb = new Database(symlinkTarget),
    link = join(root, 'a'.repeat(64) + '.sqlite'),
    foreign = join(root, '9'.repeat(64) + '.sqlite'),
    other = new Database(foreign);
  targetDb.pragma('application_id = 0x534d5443');
  targetDb.pragma('user_version=1');
  targetDb.exec('CREATE TABLE preserved(value)');
  targetDb.close();
  other.pragma('application_id = 0x534d4f54');
  other.exec('CREATE TABLE preserved(value)');
  other.close();
  symlinkSync(symlinkTarget, link);
  writeFileSync(withSidecar + '-journal', 'active');
  writeFileSync(join(root, 'unrelated.keep'), 'keep');
  await clearCorruptAtlasTileCaches(directory);
  assert.equal(existsSync(removable), false);
  assert(existsSync(withSidecar));
  assert(existsSync(withSidecar + '-journal'));
  assert(lstatSync(link).isSymbolicLink());
  assert(existsSync(symlinkTarget));
  assert(existsSync(foreign));
  assert.equal(readFileSync(join(root, 'unrelated.keep'), 'utf8'), 'keep');
});

test('campaign erase removes only its validated exact V1 shard and blocks on an ambiguous shard', (t) => {
  const directory = fixture(t),
    root = join(directory, 'tiles-v1'),
    Database = require('better-sqlite3');
  mkdirSync(root);
  const makeOwned = (name) => {
    const file = join(root, name + '.sqlite'),
      db = new Database(file);
    db.pragma('application_id = 0x534d5443');
    db.pragma('user_version=1');
    db.exec(
      'CREATE TABLE atlas_tile_meta(id INTEGER PRIMARY KEY,format INTEGER NOT NULL,sequence INTEGER NOT NULL); INSERT INTO atlas_tile_meta VALUES(1,1,0); CREATE TABLE atlas_tile_cache(key TEXT PRIMARY KEY,source TEXT NOT NULL,blob BLOB NOT NULL,digest TEXT NOT NULL,bytes INTEGER NOT NULL,last_used INTEGER NOT NULL) WITHOUT ROWID',
    );
    db.close();
    return file;
  };
  const own = makeOwned(namespace);
  AtlasTileCache.eraseNamespace(directory, namespace);
  assert.equal(existsSync(own), false);
  const busy = makeOwned(ns2);
  writeFileSync(busy + '-journal', 'active');
  assert.throws(() => AtlasTileCache.eraseNamespace(directory, ns2), /belegt/);
  assert(existsSync(busy));
  assert(existsSync(busy + '-journal'));
});

test('exclusive startup cleanup removes only an unambiguous corrupt shared cache', async (t) => {
  const directory = fixture(t),
    cache = AtlasTileCache.open(directory, namespace);
  cache.put('tile', 's', 'value');
  cache.close();
  const file = sharedFile(directory),
    Database = require('better-sqlite3'),
    db = new Database(file);
  db.close();
  truncateSync(file, 100);
  const unknown = join(directory, 'tiles-v2', 'keep.me');
  writeFileSync(unknown, 'preserve');
  await clearCorruptAtlasTileCaches(directory);
  assert.equal(existsSync(file), false);
  assert.equal(readFileSync(unknown, 'utf8'), 'preserve');
});

test('logical byte budget evicts least recently used entries', (t) => {
  const directory = fixture(t),
    cache = AtlasTileCache.open(directory, namespace, { maxBytes: 600, maxEntryBytes: 500 });
  assert.equal(cache.put('old', 's', randomBytes(220)), true);
  assert.equal(cache.put('warm', 's', randomBytes(220)), true);
  assert(cache.get('old', 's'));
  assert.equal(cache.put('new', 's', randomBytes(220)), true);
  assert.equal(cache.get('warm', 's'), undefined);
  assert(cache.get('old', 's'));
  assert(cache.get('new', 's'));
  assert.equal(cache.diagnostics.evictions, 1);
  assert(cache.diagnostics.bytes <= 600);
  cache.close();
});

test('reopening with a smaller budget prunes old rows before enforcing the physical limit', (t) => {
  const directory = fixture(t),
    cache = AtlasTileCache.open(directory, namespace, { maxBytes: 1200, maxEntryBytes: 500 });
  cache.put('a', 's', randomBytes(220));
  cache.put('b', 's', randomBytes(220));
  cache.put('c', 's', randomBytes(220));
  cache.close();
  const smaller = AtlasTileCache.open(directory, namespace, { maxBytes: 300, maxEntryBytes: 300 });
  assert(smaller.diagnostics.bytes <= 300);
  assert.equal(
    [smaller.get('a', 's'), smaller.get('b', 's'), smaller.get('c', 's')].filter(Boolean).length,
    1,
  );
  smaller.close();
});

test('physical database and rollback-journal bytes remain within the shared disk ceiling during churn', (t) => {
  const directory = fixture(t),
    physical = 16 * 1024 * 1024,
    cache = AtlasTileCache.open(directory, namespace, {
      maxBytes: 8 * 1024 * 1024,
      maxGlobalBytes: 8 * 1024 * 1024,
      maxEntryBytes: 512 * 1024,
      maxPhysicalBytes: physical,
    });
  let writes = 0;
  for (let i = 0; i < 120; i++)
    if (cache.put('tile-' + i, 's', new Uint8Array(180 * 1024).fill(i))) writes++;
  assert(writes > 10, 'cache remains useful under the physical cap');
  const file = sharedFile(directory),
    bytes =
      statSync(file).size + (existsSync(file + '-journal') ? statSync(file + '-journal').size : 0);
  assert(bytes <= physical);
  cache.close();
});

test('a killed writer leaves a bounded hot journal and SQLite recovers committed cache rows', async (t) => {
  const directory = fixture(t),
    physical = 24 * 1024 * 1024,
    options = {
      maxBytes: 8 * 1024 * 1024,
      maxGlobalBytes: 8 * 1024 * 1024,
      maxEntryBytes: 512 * 1024,
      maxPhysicalBytes: physical,
    };
  const cache = AtlasTileCache.open(directory, namespace, options);
  for (let i = 0; i < 20; i++)
    assert(cache.put('crash-' + i, 's', new Uint8Array(80 * 1024).fill(i)));
  cache.close();
  const file = sharedFile(directory),
    script = `const Database=require('better-sqlite3');const db=new Database(process.argv[1]);db.pragma('journal_mode=DELETE');db.pragma('cache_spill=ON');db.pragma('cache_size=-256');const m=db.prepare('SELECT max_pages FROM atlas_tile_meta WHERE id=1').get();db.pragma('max_page_count='+m.max_pages);db.exec('BEGIN IMMEDIATE');db.exec("UPDATE atlas_tile_cache SET blob=zeroblob(200000),bytes=200000 WHERE namespace='${namespace}'");process.stdout.write('transaction-open\\n');setInterval(()=>{},1000);`;
  const child = spawn(process.execPath, ['-e', script, file], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let childError = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => (childError += chunk));
  const exitPromise = new Promise((resolve) =>
    child.once('exit', (code, signal) => resolve({ code, signal })),
  );
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await exitPromise;
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error('writer did not reach its open transaction')),
      5000,
    );
    child.stdout.once('data', () => {
      clearTimeout(timer);
      resolve();
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code !== null || signal)
        reject(Error(`writer exited before marker: ${code}/${signal} ${childError}`));
    });
  });
  const journal = file + '-journal';
  let journalBytes = 0;
  for (let i = 0; i < 100 && journalBytes === 0; i++) {
    if (existsSync(journal)) journalBytes = statSync(journal).size;
    if (!journalBytes) await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert(journalBytes > 0, 'spilled write must have a real rollback journal before interruption');
  child.kill('SIGKILL');
  const ended = await exitPromise;
  assert.equal(ended.signal, 'SIGKILL', childError);
  const bytes = statSync(file).size + statSync(journal).size;
  assert(bytes <= physical, 'database plus hot rollback journal stays within the physical ceiling');
  const recovered = AtlasTileCache.open(directory, namespace, options);
  assert.equal(recovered.enabled, true);
  assert.deepEqual([...recovered.get('crash-7', 's')], [...new Uint8Array(80 * 1024).fill(7)]);
  recovered.close();
});

test('oversized entries are skipped without replacing the previous source value', (t) => {
  const cache = AtlasTileCache.open(fixture(t), namespace, { maxBytes: 1024, maxEntryBytes: 128 });
  assert.equal(cache.put('tile', 'rev-1', 'keep'), true);
  assert.equal(cache.put('tile', 'rev-2', randomBytes(256)), false);
  assert.equal(cache.get('tile', 'rev-1'), 'keep');
  assert.equal(cache.get('tile', 'rev-2'), undefined);
  cache.close();
});

test('failed replacement rolls back deletion and preserves the prior entry', (t) => {
  const directory = fixture(t),
    cache = AtlasTileCache.open(directory, namespace);
  cache.put('tile', 'rev-1', { safe: true });
  cache.close();
  const Database = require('better-sqlite3'),
    db = new Database(join(directory, 'tiles-v2', 'atlas-tiles.sqlite'));
  db.exec(
    "CREATE TRIGGER abort_tile_insert BEFORE INSERT ON atlas_tile_cache BEGIN SELECT RAISE(ABORT,'forced cache write failure'); END",
  );
  db.close();
  const reopened = AtlasTileCache.open(directory, namespace);
  assert.equal(reopened.put('tile', 'rev-2', { replacement: true }), false);
  assert.deepEqual(reopened.get('tile', 'rev-1'), { safe: true });
  assert.equal(reopened.get('tile', 'rev-2'), undefined);
  reopened.close();
});

test('invalid namespace cannot escape the owned cache directory', (t) => {
  assert.throws(() => AtlasTileCache.open(fixture(t), '../' + namespace), /Namensraum/);
});

test('bounded channel batch uses one transaction and preserves independent typed products', (t) => {
  const directory = fixture(t),
    cache = AtlasTileCache.open(directory, namespace),
    exec = cache.db.exec.bind(cache.db);
  let begins = 0;
  cache.db.exec = (sql) => {
    if (sql === 'BEGIN IMMEDIATE') begins++;
    return exec(sql);
  };
  const entries = [0, 1, 2].map((i) => ({
    key: 'channel-' + i,
    source: 'same-field',
    value: new Uint8Array([i, 255]),
  }));
  assert.equal(cache.putMany(entries), true);
  assert.equal(begins, 1);
  assert.equal(cache.diagnostics.writes, 3);
  cache.close();
  const reopened = AtlasTileCache.open(directory, namespace);
  for (const e of entries) assert.deepEqual(reopened.get(e.key, e.source), e.value);
  reopened.close();
});

test('invalid channel batch cannot replace a previously durable entry', (t) => {
  const cache = AtlasTileCache.open(fixture(t), namespace);
  assert(cache.put('kept', 'old', new Uint8Array([7])));
  assert.equal(
    cache.putMany([
      { key: 'kept', source: 'new', value: new Uint8Array([8]) },
      { key: '', source: 'new', value: new Uint8Array([9]) },
    ]),
    false,
  );
  assert.deepEqual(cache.get('kept', 'old'), new Uint8Array([7]));
  assert.equal(cache.get('kept', 'new'), undefined);
  cache.close();
});

test('channel batches obey the same persisted namespace quota and LRU admission', (t) => {
  const cache = AtlasTileCache.open(fixture(t), namespace, {
    maxBytes: 4096,
    maxGlobalBytes: 8192,
    maxEntryBytes: 2048,
  });
  const entries = Array.from({ length: 6 }, (_, i) => ({
    key: 'batch-' + i,
    source: 'field',
    value: new Uint8Array(1000).fill(i),
  }));
  assert(cache.putMany(entries));
  assert(cache.diagnostics.bytes <= 4096);
  assert.equal(cache.get('batch-0', 'field'), undefined);
  assert.deepEqual(cache.get('batch-5', 'field'), entries[5].value);
  assert.equal(cache.putMany(Array.from({ length: 33 }, () => entries[0])), false);
  cache.close();
});

test('a failed cache channel insertion rolls back the entire bounded batch', (t) => {
  const cache = AtlasTileCache.open(fixture(t), namespace);
  assert(cache.put('kept', 'old', new Uint8Array([7])));
  cache.db.exec(
    "CREATE TRIGGER fail_channel BEFORE INSERT ON atlas_tile_cache WHEN NEW.key='fail' BEGIN SELECT RAISE(ABORT,'test failure'); END",
  );
  assert.equal(
    cache.putMany([
      { key: 'kept', source: 'new', value: new Uint8Array([8]) },
      { key: 'fail', source: 'new', value: new Uint8Array([9]) },
    ]),
    false,
  );
  assert.deepEqual(cache.get('kept', 'old'), new Uint8Array([7]));
  assert.equal(cache.get('kept', 'new'), undefined);
  assert.equal(cache.get('fail', 'new'), undefined);
  cache.close();
});

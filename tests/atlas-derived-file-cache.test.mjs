import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { serialize } from 'node:v8';
import { spawn } from 'node:child_process';

const require = createRequire(import.meta.url),
  namespace = 'd'.repeat(64),
  ns2 = 'e'.repeat(64),
  ns3 = 'f'.repeat(64);
buildSync({
  stdin: {
    contents: "export * from './src/app/storage/atlas-tile-cache';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/atlas-derived-file-cache-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { AtlasTileCache } = require('../.build/atlas-derived-file-cache-test.cjs');
const fixture = (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'saltmarcher-atlas-derived-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
};
const file = (directory, name, bytes) => {
  const filename = join(directory, name);
  writeFileSync(filename, bytes);
  return filename;
};
const dbFile = (directory) => join(directory, 'tiles-v2', 'atlas-tiles.sqlite');

test('projection files share global and namespace LRU with tile entries', (t) => {
  const directory = fixture(t),
    options = { maxBytes: 520, maxGlobalBytes: 760, maxEntryBytes: 300 };
  const a = AtlasTileCache.open(directory, namespace, options),
    b = AtlasTileCache.open(directory, ns2, options),
    c = AtlasTileCache.open(directory, ns3, options);
  assert(a.put('warm-tile', 's', randomBytes(190)));
  const projection = file(directory, 'projection.sqlite', randomBytes(240));
  assert(b.putFile('projection-index', 'projection-sqlite-v1', projection));
  assert(a.get('warm-tile', 's'));
  assert(c.put('new-tile', 's', randomBytes(250)));
  assert.equal(
    b.getFile('projection-index', 'projection-sqlite-v1', join(directory, 'evicted.sqlite')),
    false,
    'global LRU evicts the colder file parent and its chunks',
  );
  assert(a.get('warm-tile', 's'));
  assert(c.get('new-tile', 's'));
  const Database = require('better-sqlite3'),
    db = new Database(dbFile(directory), { readonly: true });
  try {
    const total = db
      .prepare('SELECT coalesce(sum(bytes),0) bytes FROM atlas_tile_cache')
      .get().bytes;
    assert(total <= 760);
    assert.equal(db.prepare('SELECT count(*) count FROM atlas_tile_cache_chunks').get().count, 0);
  } finally {
    db.close();
    for (const cache of [a, b, c]) cache.close();
  }
});

test('namespace LRU evicts file chunks and tiles as complete entries', (t) => {
  const directory = fixture(t),
    options = { maxBytes: 650, maxGlobalBytes: 900, maxEntryBytes: 300 },
    cache = AtlasTileCache.open(directory, namespace, options);
  assert(cache.put('warm-tile', 's', randomBytes(180)));
  const projection = file(directory, 'projection.sqlite', randomBytes(240));
  assert(cache.putFile('projection-index', 'projection-sqlite-v1', projection));
  assert(cache.get('warm-tile', 's'));
  assert(cache.put('new-tile', 's', randomBytes(250)));
  assert(cache.get('warm-tile', 's'));
  assert(cache.get('new-tile', 's'));
  assert.equal(
    cache.getFile('projection-index', 'projection-sqlite-v1', join(directory, 'evicted.sqlite')),
    false,
  );
  const Database = require('better-sqlite3'),
    db = new Database(dbFile(directory), { readonly: true });
  try {
    assert.equal(
      db
        .prepare(
          "SELECT count(*) count FROM atlas_tile_cache_chunks WHERE namespace=? AND key='projection-index'",
        )
        .get(namespace).count,
      0,
    );
    assert(
      db
        .prepare('SELECT coalesce(sum(bytes),0) bytes FROM atlas_tile_cache WHERE namespace=?')
        .get(namespace).bytes <= 650,
    );
  } finally {
    db.close();
    cache.close();
  }
});

test('file replacement publishes a complete multi-chunk generation', (t) => {
  const directory = fixture(t),
    cache = AtlasTileCache.open(directory, namespace),
    first = randomBytes(1024 * 1024 + 37),
    second = randomBytes(1024 * 1024 + 91);
  const source = file(directory, 'source.sqlite', first),
    destination = join(directory, 'copy.sqlite');
  assert(cache.putFile('projection-index', 'projection-sqlite-v1', source));
  writeFileSync(source, second);
  assert(cache.putFile('projection-index', 'projection-sqlite-v1', source));
  assert(cache.getFile('projection-index', 'projection-sqlite-v1', destination));
  assert.deepEqual(readFileSync(destination), second);
  const Database = require('better-sqlite3'),
    db = new Database(dbFile(directory), { readonly: true });
  try {
    assert.equal(
      db
        .prepare(
          "SELECT count(*) count FROM atlas_tile_cache_chunks WHERE namespace=? AND key='projection-index'",
        )
        .get(namespace).count,
      2,
    );
  } finally {
    db.close();
    cache.close();
  }
});

test('a chunk trigger abort during replacement preserves old file, tiles, and child rows', (t) => {
  const directory = fixture(t),
    cache = AtlasTileCache.open(directory, namespace),
    oldBytes = randomBytes(1024 * 1024 + 29),
    source = file(directory, 'source.sqlite', oldBytes);
  assert(cache.put('kept-tile', 's', { kept: true }));
  assert(cache.putFile('projection-index', 'projection-sqlite-v1', source));
  cache.close();
  const Database = require('better-sqlite3'),
    db = new Database(dbFile(directory));
  db.exec(
    "CREATE TRIGGER abort_second_file_chunk BEFORE INSERT ON atlas_tile_cache_chunks WHEN NEW.ordinal=1 BEGIN SELECT RAISE(ABORT,'forced second chunk failure'); END",
  );
  db.close();
  const replacement = AtlasTileCache.open(directory, namespace);
  writeFileSync(source, randomBytes(1024 * 1024 + 47));
  assert.equal(replacement.putFile('projection-index', 'projection-sqlite-v1', source), false);
  const destination = join(directory, 'old-generation.sqlite');
  assert(replacement.getFile('projection-index', 'projection-sqlite-v1', destination));
  assert.deepEqual(readFileSync(destination), oldBytes);
  assert.deepEqual(replacement.get('kept-tile', 's'), { kept: true });
  const check = new Database(dbFile(directory), { readonly: true });
  try {
    assert.equal(
      check
        .prepare(
          "SELECT count(*) count FROM atlas_tile_cache_chunks WHERE namespace=? AND key='projection-index'",
        )
        .get(namespace).count,
      2,
    );
    assert.equal(
      check.prepare('SELECT count(*) count FROM atlas_tile_cache_chunks').get().count,
      2,
    );
  } finally {
    check.close();
    replacement.close();
  }
});

test('missing or corrupt chunks fail closed and conditionally remove the matching parent', (t) => {
  for (const mode of ['missing', 'corrupt']) {
    const directory = fixture(t),
      cache = AtlasTileCache.open(directory, namespace),
      source = file(directory, 'source.sqlite', randomBytes(1024 * 1024 + 5));
    assert(cache.putFile('projection-index', 'projection-sqlite-v1', source));
    cache.close();
    const Database = require('better-sqlite3'),
      db = new Database(dbFile(directory));
    if (mode === 'missing')
      db.prepare(
        "DELETE FROM atlas_tile_cache_chunks WHERE namespace=? AND key='projection-index' AND ordinal=1",
      ).run(namespace);
    else
      db.prepare(
        "UPDATE atlas_tile_cache_chunks SET digest=? WHERE namespace=? AND key='projection-index' AND ordinal=0",
      ).run('0'.repeat(64), namespace);
    db.close();
    const reopened = AtlasTileCache.open(directory, namespace),
      destination = join(directory, 'copy.sqlite');
    assert.equal(reopened.getFile('projection-index', 'projection-sqlite-v1', destination), false);
    assert.equal(existsSync(destination), false);
    const check = new Database(dbFile(directory), { readonly: true });
    try {
      assert.equal(
        check
          .prepare(
            "SELECT count(*) count FROM atlas_tile_cache WHERE namespace=? AND key='projection-index'",
          )
          .get(namespace).count,
        0,
      );
      assert.equal(
        check
          .prepare(
            "SELECT count(*) count FROM atlas_tile_cache_chunks WHERE namespace=? AND key='projection-index'",
          )
          .get(namespace).count,
        0,
      );
    } finally {
      check.close();
      reopened.close();
    }
  }
});

test('wx destination collision preserves caller bytes and leaves the cache hit available', (t) => {
  const directory = fixture(t),
    cache = AtlasTileCache.open(directory, namespace),
    contents = randomBytes(128),
    source = file(directory, 'source.sqlite', contents),
    destination = file(directory, 'existing.sqlite', Buffer.from('keep me'));
  assert(cache.putFile('projection-index', 'projection-sqlite-v1', source));
  assert.equal(cache.getFile('projection-index', 'projection-sqlite-v1', destination), false);
  assert.equal(readFileSync(destination, 'utf8'), 'keep me');
  const fresh = join(directory, 'fresh.sqlite');
  assert(cache.getFile('projection-index', 'projection-sqlite-v1', fresh));
  assert.deepEqual(readFileSync(fresh), contents);
  cache.close();
});

test('an older handle observes tightened persisted limits for projection files', (t) => {
  const directory = fixture(t),
    old = AtlasTileCache.open(directory, namespace, {
      maxBytes: 800,
      maxGlobalBytes: 1200,
      maxEntryBytes: 400,
    });
  const smaller = AtlasTileCache.open(directory, ns2, {
    maxBytes: 180,
    maxGlobalBytes: 180,
    maxEntryBytes: 120,
  });
  const source = file(directory, 'source.sqlite', randomBytes(100));
  assert.equal(old.putFile('projection-index', 'projection-sqlite-v1', source), false);
  assert.equal(old.diagnostics.bytes, 0);
  old.close();
  smaller.close();
});

test('additively migrates an older FORMAT 2 tile table and preserves existing entries', (t) => {
  const directory = fixture(t),
    filename = dbFile(directory);
  require('node:fs').mkdirSync(join(directory, 'tiles-v2'), { recursive: true });
  const Database = require('better-sqlite3'),
    db = new Database(filename);
  db.pragma('page_size=4096');
  db.pragma('auto_vacuum=INCREMENTAL');
  db.pragma('journal_mode=DELETE');
  db.pragma('synchronous=FULL');
  db.pragma('application_id=0x534d5443');
  const maxPages = Math.floor((256 * 1024 * 1024 - 2 * 1024 * 1024) / (2 * 4096));
  db.pragma(`max_page_count=${maxPages}`);
  db.exec(`CREATE TABLE atlas_tile_meta(id INTEGER PRIMARY KEY CHECK(id=1),format INTEGER NOT NULL,sequence INTEGER NOT NULL,namespace_bytes INTEGER NOT NULL,global_bytes INTEGER NOT NULL,entry_bytes INTEGER NOT NULL,max_pages INTEGER NOT NULL);
  INSERT INTO atlas_tile_meta VALUES(1,2,1,67108864,100663296,8388608,${maxPages});
  CREATE TABLE atlas_tile_cache(namespace TEXT NOT NULL,key TEXT NOT NULL,source TEXT NOT NULL,blob BLOB NOT NULL,digest TEXT NOT NULL,bytes INTEGER NOT NULL,last_used INTEGER NOT NULL,PRIMARY KEY(namespace,key)) WITHOUT ROWID;
  CREATE INDEX atlas_tile_cache_global_lru ON atlas_tile_cache(last_used,namespace,key);
  CREATE INDEX atlas_tile_cache_namespace_lru ON atlas_tile_cache(namespace,last_used,key);`);
  db.pragma('user_version=2');
  const value = { legacy: true },
    blob = serialize(value),
    digest = createHash('sha256').update(blob).digest('hex');
  db.prepare(
    'INSERT INTO atlas_tile_cache(namespace,key,source,blob,digest,bytes,last_used) VALUES(?,?,?,?,?,?,1)',
  ).run(namespace, 'old-tile', 'old-source', blob, digest, blob.length);
  db.close();
  const cache = AtlasTileCache.open(directory, namespace);
  assert.equal(cache.enabled, true);
  assert.deepEqual(cache.get('old-tile', 'old-source'), value);
  const source = file(directory, 'projection.sqlite', randomBytes(512));
  assert(cache.putFile('projection-index', 'projection-sqlite-v1', source));
  const migrated = new Database(filename, { readonly: true });
  try {
    assert.equal(migrated.pragma('user_version', { simple: true }), 2);
    assert.equal(
      migrated.prepare("SELECT kind FROM atlas_tile_cache WHERE key='old-tile'").get().kind,
      'tile',
    );
    assert.equal(
      migrated.prepare("SELECT kind FROM atlas_tile_cache WHERE key='projection-index'").get().kind,
      'file',
    );
  } finally {
    migrated.close();
    cache.close();
  }
});

test('a reader copies one complete generation while a writer has an uncommitted erase', (t) => {
  const directory = fixture(t),
    cache = AtlasTileCache.open(directory, namespace),
    contents = randomBytes(1024 * 1024 + 13),
    source = file(directory, 'source.sqlite', contents);
  assert(cache.putFile('projection-index', 'projection-sqlite-v1', source));
  const Database = require('better-sqlite3'),
    writer = new Database(dbFile(directory));
  writer.exec('BEGIN IMMEDIATE');
  try {
    writer
      .prepare("DELETE FROM atlas_tile_cache WHERE namespace=? AND key='projection-index'")
      .run(namespace);
    const destination = join(directory, 'racing-copy.sqlite');
    assert(cache.getFile('projection-index', 'projection-sqlite-v1', destination));
    assert.deepEqual(readFileSync(destination), contents);
    writer.exec('ROLLBACK');
  } finally {
    if (writer.inTransaction) writer.exec('ROLLBACK');
    writer.close();
    cache.close();
  }
});

test('a killed mixed tile/file writer recovers the old complete generation within the physical ceiling', async (t) => {
  const directory = fixture(t),
    physical = 24 * 1024 * 1024,
    options = {
      maxBytes: 8 * 1024 * 1024,
      maxGlobalBytes: 8 * 1024 * 1024,
      maxEntryBytes: 512 * 1024,
      maxPhysicalBytes: physical,
    };
  const cache = AtlasTileCache.open(directory, namespace, options),
    oldBytes = randomBytes(1024 * 1024 + 23),
    source = file(directory, 'source.sqlite', oldBytes);
  assert(cache.put('safe-tile', 's', { safe: true }));
  assert(cache.putFile('projection-index', 'projection-sqlite-v1', source));
  cache.close();
  const filename = dbFile(directory),
    script = `const Database=require('better-sqlite3');const db=new Database(process.argv[1]);db.pragma('journal_mode=DELETE');db.pragma('cache_spill=ON');db.pragma('cache_size=-256');const m=db.prepare('SELECT max_pages FROM atlas_tile_meta WHERE id=1').get();db.pragma('max_page_count='+m.max_pages);db.exec('BEGIN IMMEDIATE');db.prepare("DELETE FROM atlas_tile_cache WHERE namespace=? AND key='projection-index'").run(process.argv[2]);const put=db.prepare('INSERT INTO atlas_tile_cache_chunks(namespace,key,ordinal,blob,digest,bytes) VALUES(?,?,?,?,?,?)');for(let i=0;i<3;i++){const blob=Buffer.alloc(1024*1024,i+1);put.run(process.argv[2],'projection-index',i,blob,'0'.repeat(64),blob.length);}const descriptor=Buffer.from(JSON.stringify({format:1,bytes:3*1024*1024,chunkBytes:1024*1024,digest:'0'.repeat(64)}));db.prepare("INSERT INTO atlas_tile_cache(namespace,key,source,blob,digest,bytes,last_used,kind) VALUES(?,?,?,?,?,?,2,'file')").run(process.argv[2],'projection-index','projection-sqlite-v1',descriptor,'1'.repeat(64),3*1024*1024+descriptor.length);db.prepare("UPDATE atlas_tile_cache SET blob=zeroblob(2000000),digest=?,bytes=2000000 WHERE namespace=? AND key='safe-tile'").run('2'.repeat(64),process.argv[2]);process.stdout.write('transaction-open\\n');setInterval(()=>{},1000);`;
  const child = spawn(process.execPath, ['-e', script, filename, namespace], {
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
  const journal = filename + '-journal';
  let journalBytes = 0;
  for (let i = 0; i < 100 && journalBytes === 0; i++) {
    if (existsSync(journal)) journalBytes = statSync(journal).size;
    if (!journalBytes) await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert(
    journalBytes > 0,
    'mixed file/tile transaction must have a real rollback journal before interruption',
  );
  child.kill('SIGKILL');
  const ended = await exitPromise;
  assert.equal(ended.signal, 'SIGKILL', childError);
  assert(
    statSync(filename).size + statSync(journal).size <= physical,
    'database plus hot rollback journal stays within the configured physical ceiling',
  );
  const recovered = AtlasTileCache.open(directory, namespace, options),
    destination = join(directory, 'recovered.sqlite');
  assert.equal(recovered.enabled, true);
  assert.deepEqual(recovered.get('safe-tile', 's'), { safe: true });
  assert(recovered.getFile('projection-index', 'projection-sqlite-v1', destination));
  assert.deepEqual(readFileSync(destination), oldBytes);
  recovered.close();
});

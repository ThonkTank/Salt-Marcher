import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,rmSync,truncateSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {serialize} from 'node:v8';

const require=createRequire(import.meta.url),namespace='a'.repeat(64);
buildSync({stdin:{contents:"export * from './src/app/storage/atlas-tile-cache';",resolveDir:process.cwd()},outfile:'.build/atlas-tile-cache-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {AtlasTileCache,clearCorruptAtlasTileCaches}=require('../.build/atlas-tile-cache-test.cjs');
const fixture=t=>{const directory=mkdtempSync(join(tmpdir(),'saltmarcher-atlas-tiles-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));return directory;};

test('persists typed arrays across close and reopen with intact values',t=>{
 const directory=fixture(t),first=AtlasTileCache.open(directory,namespace),value=new Float32Array([1.25,-3,100]);
 assert.equal(first.put('terrain:0:0:0','source-a',value),true);first.close();
 const second=AtlasTileCache.open(directory,namespace),restored=second.get('terrain:0:0:0','source-a');
 assert(restored instanceof Float32Array);assert.deepEqual([...restored],[1.25,-3,100]);assert.equal(second.diagnostics.hits,1);assert.equal(second.diagnostics.bytes,serialize(value).byteLength);second.close();
});

test('source mismatch is a miss and leaves the other source entry intact',t=>{
 const cache=AtlasTileCache.open(fixture(t),namespace);cache.put('tile','rev-1',{height:4});
 assert.equal(cache.get('tile','rev-2'),undefined);assert.deepEqual(cache.get('tile','rev-1'),{height:4});assert.equal(cache.diagnostics.misses,1);cache.close();
});

test('two cache handles share one database and serialize same-key replacement',t=>{
 const directory=fixture(t),first=AtlasTileCache.open(directory,namespace),second=AtlasTileCache.open(directory,namespace);
 assert.equal(first.put('tile','old','old'),true);assert.equal(second.put('tile','new','new'),true);
 assert.equal(first.get('tile','old'),undefined);assert.equal(second.get('tile','new'),'new');first.close();second.close();
});

test('corrupt blob is deleted and reported as a miss',t=>{
 const directory=fixture(t),cache=AtlasTileCache.open(directory,namespace);cache.put('tile','rev',new Uint8Array([1,2,3]));cache.close();
 const Database=require('better-sqlite3'),db=new Database(join(directory,'tiles-v1',namespace+'.sqlite'));
 db.prepare("UPDATE atlas_tile_cache SET blob=?,digest=? WHERE key='tile'").run(Buffer.from([9,8,7]),'0'.repeat(64));db.close();
 const reopened=AtlasTileCache.open(directory,namespace);assert.equal(reopened.get('tile','rev'),undefined);assert.equal(reopened.diagnostics.bytes,0);reopened.close();
});

test('invalid serialized bytes with a matching digest are deleted as a miss',t=>{
 const directory=fixture(t),cache=AtlasTileCache.open(directory,namespace);cache.put('tile','rev','valid');cache.close();
 const Database=require('better-sqlite3'),db=new Database(join(directory,'tiles-v1',namespace+'.sqlite')),blob=Buffer.from([1,2,3]);
 db.prepare("UPDATE atlas_tile_cache SET blob=?,digest=?,bytes=? WHERE key='tile'").run(blob,createHash('sha256').update(blob).digest('hex'),blob.length);db.close();
 const reopened=AtlasTileCache.open(directory,namespace);assert.equal(reopened.get('tile','rev'),undefined);assert.equal(reopened.diagnostics.bytes,0);reopened.close();
});

test('a known cache with a different format version is safely regenerated',t=>{
 const directory=fixture(t),cache=AtlasTileCache.open(directory,namespace);cache.put('old','rev','stale');cache.close();
 const Database=require('better-sqlite3'),db=new Database(join(directory,'tiles-v1',namespace+'.sqlite'));db.pragma('user_version=77');db.close();
 const fresh=AtlasTileCache.open(directory,namespace);assert.equal(fresh.get('old','rev'),undefined);assert.equal(fresh.put('new','rev','current'),true);fresh.close();
});

test('a damaged header disables worker cache open without recursion or deleting an unowned lock',async t=>{
 const directory=fixture(t),root=join(directory,'tiles-v1'),file=join(root,namespace+'.sqlite');
 mkdirSync(root);
 const Database=require('better-sqlite3'),db=new Database(file);db.pragma('application_id = 0x534d5443');db.exec('CREATE TABLE sample(value)');db.close();
 const bytes=require('node:fs').readFileSync(file);bytes[0]=0;writeFileSync(file,bytes);
 const disabled=AtlasTileCache.open(directory,namespace);assert.equal(disabled.enabled,false);assert.equal(disabled.get('x','s'),undefined);disabled.close();
 const foreignLock=file+'.recover-lock';writeFileSync(foreignLock,'owned by other process');await clearCorruptAtlasTileCaches(directory);
 assert(existsSync(file));assert.equal(require('node:fs').readFileSync(foreignLock,'utf8'),'owned by other process');
});

test('opening an unowned SQLite file does not convert its journal mode',t=>{
 const directory=fixture(t),root=join(directory,'tiles-v1'),file=join(root,namespace+'.sqlite');mkdirSync(root);
 const Database=require('better-sqlite3'),foreign=new Database(file);foreign.pragma('application_id = 0x534d4f54');foreign.pragma('journal_mode = WAL');foreign.exec('CREATE TABLE preserved(value)');foreign.close();
 const disabled=AtlasTileCache.open(directory,namespace);assert.equal(disabled.enabled,false);disabled.close();
 const check=new Database(file,{readonly:true});assert.equal(check.pragma('journal_mode',{simple:true}),'wal');check.close();
});

test('startup cleanup removes only a corrupt cache with a readable owned SQLite header',async t=>{
 const directory=fixture(t),root=join(directory,'tiles-v1'),owned=join(root,namespace+'.sqlite');
 mkdirSync(root);
 const Database=require('better-sqlite3'),db=new Database(owned);db.pragma('application_id = 0x534d5443');db.exec('CREATE TABLE sample(value BLOB); INSERT INTO sample VALUES(zeroblob(12000))');db.close();
 truncateSync(owned,100);
 const disabled=AtlasTileCache.open(directory,namespace);assert.equal(disabled.enabled,false);disabled.close();
 writeFileSync(owned+'-journal','active journal sentinel');await clearCorruptAtlasTileCaches(directory);assert(existsSync(owned));
 rmSync(owned+'-journal');await clearCorruptAtlasTileCaches(directory);assert.equal(existsSync(owned),false);
 const foreign='b'.repeat(64),foreignFile=join(root,foreign+'.sqlite'),other=new Database(foreignFile);other.pragma('application_id = 0x534d4f54');other.exec('CREATE TABLE sample(value BLOB); INSERT INTO sample VALUES(zeroblob(12000))');other.close();truncateSync(foreignFile,100);
 await clearCorruptAtlasTileCaches(directory);assert(existsSync(foreignFile),'foreign app id must be preserved');
});

test('logical byte budget evicts least recently used entries',t=>{
 const directory=fixture(t),cache=AtlasTileCache.open(directory,namespace,{maxBytes:600,maxEntryBytes:500});
 assert.equal(cache.put('old','s',randomBytes(220)),true);assert.equal(cache.put('warm','s',randomBytes(220)),true);
 assert(cache.get('old','s'));assert.equal(cache.put('new','s',randomBytes(220)),true);
 assert.equal(cache.get('warm','s'),undefined);assert(cache.get('old','s'));assert(cache.get('new','s'));
 assert.equal(cache.diagnostics.evictions,1);assert(cache.diagnostics.bytes<=600);cache.close();
});

test('reopening with a smaller budget prunes old rows before enforcing the physical limit',t=>{
 const directory=fixture(t),cache=AtlasTileCache.open(directory,namespace,{maxBytes:1200,maxEntryBytes:500});
 cache.put('a','s',randomBytes(220));cache.put('b','s',randomBytes(220));cache.put('c','s',randomBytes(220));cache.close();
 const smaller=AtlasTileCache.open(directory,namespace,{maxBytes:300,maxEntryBytes:300});
 assert(smaller.diagnostics.bytes<=300);assert.equal([smaller.get('a','s'),smaller.get('b','s'),smaller.get('c','s')].filter(Boolean).length,1);smaller.close();
});

test('oversized entries are skipped without replacing the previous source value',t=>{
 const cache=AtlasTileCache.open(fixture(t),namespace,{maxBytes:1024,maxEntryBytes:128});
 assert.equal(cache.put('tile','rev-1','keep'),true);assert.equal(cache.put('tile','rev-2',randomBytes(256)),false);
 assert.equal(cache.get('tile','rev-1'),'keep');assert.equal(cache.get('tile','rev-2'),undefined);cache.close();
});

test('failed replacement rolls back deletion and preserves the prior entry',t=>{
 const directory=fixture(t),cache=AtlasTileCache.open(directory,namespace);cache.put('tile','rev-1',{safe:true});cache.close();
 const Database=require('better-sqlite3'),db=new Database(join(directory,'tiles-v1',namespace+'.sqlite'));
 db.exec("CREATE TRIGGER abort_tile_insert BEFORE INSERT ON atlas_tile_cache BEGIN SELECT RAISE(ABORT,'forced cache write failure'); END");db.close();
 const reopened=AtlasTileCache.open(directory,namespace);assert.equal(reopened.put('tile','rev-2',{replacement:true}),false);
 assert.deepEqual(reopened.get('tile','rev-1'),{safe:true});assert.equal(reopened.get('tile','rev-2'),undefined);reopened.close();
});

test('invalid namespace cannot escape the owned cache directory',t=>{
 assert.throws(()=>AtlasTileCache.open(fixture(t),'../'+namespace),/Namensraum/);
});

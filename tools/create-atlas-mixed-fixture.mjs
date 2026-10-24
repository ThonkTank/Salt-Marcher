import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {gunzipSync,gzipSync} from 'node:zlib';
import {assertReferenceContents,referenceContents,referenceCommit,referencePath} from './atlas-reference-fixture.mjs';

// Fixed test-fixture conversion, never a product database migration.
const output=process.argv[2];
if(!output||process.argv.length!==3)throw Error('Usage: node tools/create-atlas-mixed-fixture.mjs <output.sqlite.gz>');
const manifest=JSON.parse(readFileSync(new URL('../tests/fixtures/atlas/mixed-world-manifest.json',import.meta.url)));
const format=JSON.parse(readFileSync(new URL('../src/app/data-format.json',import.meta.url)));
assert.equal(format.schema,55,'Review the fixture conversion when the product format changes');
const compressed=execFileSync('git',['show',`${referenceCommit}:${referencePath}`],{maxBuffer:128*1024*1024});
assert.equal(createHash('sha256').update(compressed).digest('hex'),manifest.sourceSha256);
const dir=mkdtempSync(join(tmpdir(),'atlas-reference-')),file=join(dir,'world.sqlite');
const temporary=resolve(output)+`.tmp-${process.pid}`;
let db;
try{
 writeFileSync(file,gunzipSync(compressed));
 db=new (createRequire(import.meta.url)('better-sqlite3'))(file);
 assert.equal(db.pragma('user_version',{simple:true}),54);
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);
 assert.deepEqual(tables,[...format.tables,'atlas_landscape_migration'].sort());
 assertReferenceContents(db,manifest);
 const before=referenceContents(db);
 db.pragma('journal_mode=DELETE');
 db.transaction(()=>{db.exec('DROP TABLE atlas_landscape_migration');db.pragma('user_version=55');})();
 assert.deepEqual(referenceContents(db),before);
 assertReferenceContents(db,manifest);
 db.close();db=null;
 writeFileSync(temporary,gzipSync(readFileSync(file),{level:9}));
 renameSync(temporary,resolve(output));
 console.log('Restored complete reference world from '+referenceCommit+' in schema 55');
}finally{db?.close();rmSync(temporary,{force:true});rmSync(dir,{recursive:true,force:true});}

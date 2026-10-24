import {test} from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {buildSync} from './helpers/build.mjs';
import {assertReferenceContents,assertReferenceInventory,assertReferenceMapImage} from '../tools/atlas-reference-fixture.mjs';
const require=createRequire(import.meta.url),Database=require('better-sqlite3'),{PNG}=require('pngjs');
const manifest=JSON.parse(readFileSync(new URL('./fixtures/atlas/mixed-world-manifest.json',import.meta.url)));
const fixture=()=>gunzipSync(readFileSync(new URL('./fixtures/atlas/mixed-world.sqlite.gz',import.meta.url)));
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/reference-fixture-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require('../.build/reference-fixture-store.cjs');

test('complete reference world retains every original canonical row through current-store reopen',()=>{
 const dir=mkdtempSync(join(tmpdir(),'atlas-reference-test-')),file=join(dir,'world.sqlite');let store;
 try{
  writeFileSync(file,fixture());
  for(let i=0;i<2;i++){
   store=new CampaignStore(file);assert.equal(store.db.pragma('user_version',{simple:true}),55);
   assertReferenceContents(store.db,manifest);store.close();store=null;
  }
 }finally{store?.close();rmSync(dir,{recursive:true,force:true});}
});

test('reference validation rejects each lost map-content class and a same-count payload change',()=>{
 const raw=fixture();raw[18]=raw[19]=1;const db=new Database(raw);
 try{
  for(const where of ["json_extract(payload,'$.height') IS NOT NULL",...['place','road','vegetation'].map(k=>`json_extract(payload,'$.kind')='${k}'`)]){
   db.exec('SAVEPOINT mutation');
   db.prepare('DELETE FROM atlas_landscape WHERE '+where).run();
   assert.throws(()=>assertReferenceInventory(db),/Reference world:/);
   db.exec('ROLLBACK TO mutation; RELEASE mutation');
  }
  db.prepare("UPDATE atlas_landscape SET payload=json_set(payload,'$.name','missing original name') WHERE id='world-place:0'").run();
  assert.throws(()=>assertReferenceContents(db,manifest),/complete reference world/);
 }finally{db.close();}
});

test('native map oracle accepts its baseline and rejects the formerly passing water-only map',()=>{
 const images=JSON.parse(readFileSync(new URL('./fixtures/atlas/reference-images/manifest.json',import.meta.url)));
 assert.equal(images.sourceCommit,manifest.sourceCommit);
 for(const view of images.views){
  const bytes=readFileSync(new URL(`./fixtures/atlas/reference-images/width-${view.target}.png`,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),view.imageSha256);
 }
 const expected=PNG.sync.read(readFileSync(new URL('./fixtures/atlas/reference-images/width-32768.png',import.meta.url)));
 assertReferenceMapImage(expected,expected);
 for(const color of [[238,229,207],[159,167,129],[163,126,81],[91,67,56]]){
  const missing={...expected,data:Buffer.from(expected.data)};
  for(let i=0;i<missing.data.length;i+=4)if(color.every((v,c)=>Math.abs(expected.data[i+c]-v)<=4)){
   missing.data[i]=129;missing.data[i+1]=168;missing.data[i+2]=185;
  }
  assert.throws(()=>assertReferenceMapImage(missing,expected),/Reference map changed|Visible .* missing/);
 }
 const blank={...expected,data:Buffer.from(expected.data)};
 for(let i=0;i<blank.data.length;i+=4){blank.data[i]=129;blank.data[i+1]=168;blank.data[i+2]=185;}
 assert.throws(()=>assertReferenceMapImage(blank,expected),/Reference map changed/);
});

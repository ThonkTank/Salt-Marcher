import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from './helpers/build.mjs';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

const require=createRequire(import.meta.url),Database=require('better-sqlite3');
buildSync({stdin:{contents:"export * from './src/app/storage/atlas-projection-index';",resolveDir:process.cwd()},outfile:'.build/atlas-projection-copy-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {AtlasProjectionIndex}=require('../.build/atlas-projection-copy-test.cjs');
const columns=['id','source_row','kind','terrain_kind','resolution','paint_version','paint_order','payload_bytes','min_x','max_x','min_y','max_y'];
const select=`SELECT id,CAST(rowid AS TEXT),'place',NULL,NULL,NULL,NULL,length(CAST(payload AS BLOB)),min_x,max_x,min_y,max_y FROM atlas_landscape WHERE campaign_id=? ORDER BY id`;

function fixture(t,{rows=513,failAt=-1}={}){
 const base=join(homedir(),'.cache/saltmarcher/tests');mkdirSync(base,{recursive:true});const dir=mkdtempSync(join(base,'atlas-projection-copy-'));
 const filename=join(dir,'canonical.sqlite'),cacheDir=join(dir,'cache'),campaignId=randomUUID(),shapeVersion=randomUUID();
 const canonical=new Database(filename);canonical.pragma('journal_mode = WAL');
 canonical.exec(`CREATE TABLE atlas_landscape(campaign_id TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,min_x REAL NOT NULL,max_x REAL NOT NULL,min_y REAL NOT NULL,max_y REAL NOT NULL,PRIMARY KEY(campaign_id,id));`);
 const put=canonical.prepare('INSERT INTO atlas_landscape(rowid,campaign_id,id,payload,min_x,max_x,min_y,max_y) VALUES(?,?,?,?,?,?,?,?)');
 canonical.transaction(()=>{for(let i=0;i<rows;i++){
  const id=i===failAt?'row-0300-fail':`row-${String(i).padStart(4,'0')}`,rowid=9007199254740993n+BigInt(i),payload='payload:'+i;
  put.run(rowid.toString(),campaignId,id,payload,i,i+1,0,1);
 }})();
 canonical.close();
 const snapshot={filename,campaignId,shapeVersion,geometryVersion:randomUUID(),epoch:1,shadow:undefined};
 const source=new Database(filename,{readonly:true}),seed=AtlasProjectionIndex.open(source,snapshot,cacheDir);
 let index;
 const tableSql=`CREATE TEMP TABLE landscape_shape_bounds(id TEXT PRIMARY KEY,source_row INTEGER NOT NULL,kind TEXT,terrain_kind TEXT,resolution REAL,paint_version INTEGER,paint_order REAL,payload_bytes INTEGER,min_x REAL NOT NULL,max_x REAL NOT NULL,min_y REAL NOT NULL,max_y REAL NOT NULL${failAt<0?'':",CHECK(id<>'row-0300-fail')"}) WITHOUT ROWID`;
 const ready=(async()=>{const cold=await seed; cold.init(tableSql);cold.mark('landscape',snapshot);assert.equal(await cold.flush(),true);await cold.close();source.close();})().then(async()=>{
  const db=new Database(filename,{readonly:true});index=await AtlasProjectionIndex.open(db,snapshot,cacheDir);return{db,index};
 });
 t.after(async()=>{const opened=await ready.catch(()=>undefined);if(opened){await opened.index.close();opened.db.close();}else{await index?.close();}rmSync(dir,{recursive:true,force:true});});
 return{dir,filename,cacheDir,campaignId,snapshot,ready};
}
async function open(f){const opened=await f.ready;assert.equal(opened.index.persistent,true);assert.notEqual(opened.index.writer,opened.db,'the test must exercise a persisted private writer');assert.equal(opened.index.valid('landscape',f.snapshot),true);return opened;}

test('persisted private copy transfers full 256-row blocks and partial tail with exact 64-bit rowids',async t=>{
 const f=fixture(t,{rows:513}),{db,index}=await open(f);
 try{
  index.begin();index.copy('landscape_shape_bounds',columns.length,select,[f.campaignId]);index.commit();
  assert.equal(index.prepare('SELECT count(*) n FROM temp.landscape_shape_bounds').get().n,513);
  const rows=index.prepare('SELECT CAST(source_row AS TEXT) rowid FROM temp.landscape_shape_bounds ORDER BY id').all().map(row=>row.rowid);
  assert.deepEqual(rows,[...Array(513)].map((_,i)=>(9007199254740993n+BigInt(i)).toString()),'rowid text conversion and private-index binding preserve all signed 64-bit values through two full blocks and a one-row tail');
 }finally{if(db.inTransaction)db.exec('ROLLBACK');}
});

test('private index copy reads the already pinned canonical snapshot across a concurrent commit',async t=>{
 const f=fixture(t,{rows:513}),{db,index}=await open(f),writer=new Database(f.filename);
 t.after(()=>writer.close());
 try{
  db.exec('BEGIN');const original=db.prepare("SELECT length(CAST(payload AS BLOB)) n FROM atlas_landscape WHERE campaign_id=? AND id='row-0000'").get(f.campaignId).n;
  writer.prepare("UPDATE atlas_landscape SET payload=? WHERE campaign_id=? AND id='row-0000'").run('concurrent newer payload',f.campaignId);
  const current=writer.prepare("SELECT length(CAST(payload AS BLOB)) n FROM atlas_landscape WHERE campaign_id=? AND id='row-0000'").get(f.campaignId).n;assert.notEqual(current,original);
  index.begin();index.copy('landscape_shape_bounds',columns.length,select,[f.campaignId]);index.commit();
  assert.equal(index.prepare("SELECT payload_bytes FROM temp.landscape_shape_bounds WHERE id='row-0000'").get().payload_bytes,original,'copy must read the pinned source connection, not reopen or advance canonical reads');
  db.exec('COMMIT');
 }finally{if(db.inTransaction)db.exec('ROLLBACK');}
});

test('failure in the second 256-row block rolls back the first committed-to-transaction block',async t=>{
 const f=fixture(t,{rows:513,failAt:300}),{db,index}=await open(f);
 try{
  index.begin();assert.throws(()=>index.copy('landscape_shape_bounds',columns.length,select,[f.campaignId]),/CHECK constraint failed/);
  assert.equal(index.prepare('SELECT count(*) n FROM temp.landscape_shape_bounds').get().n,256,'the first full block exists inside the open private transaction when the later block fails');
  index.rollback();assert.equal(index.prepare('SELECT count(*) n FROM temp.landscape_shape_bounds').get().n,0,'rollback removes the earlier full block too');
 }finally{if(db.inTransaction)db.exec('ROLLBACK');}
});

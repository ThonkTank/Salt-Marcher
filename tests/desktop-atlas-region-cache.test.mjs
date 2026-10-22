import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from './helpers/build.mjs';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,readdirSync,mkdirSync,copyFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url),Database=require('better-sqlite3');
for(const [name,file]of [['store','src/app/storage/store.ts'],['reader','src/app/storage/atlas-region.ts'],['cache','src/app/storage/atlas-projection-index.ts'],['version','src/app/storage/atlas-shape-source.ts'],['service','desktop/atlas-region.ts'],['worker','desktop/atlas-region-worker.ts']])buildSync({entryPoints:[file],outfile:'.build/region-cache-'+name+'.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require('../.build/region-cache-store.cjs'),{AtlasRegionReader}=require('../.build/region-cache-reader.cjs'),{AtlasProjectionIndex,eraseAtlasProjection,projectionKey,clearProjectionWork}=require('../.build/region-cache-cache.cjs'),{atlasShapeSource}=require('../.build/region-cache-version.cjs');
const {AtlasRegionService}=require('../.build/region-cache-service.cjs');
const query={box:{x:-1,y:-1,width:500,height:10},width:1024,height:768,scopeId:'local',floorId:'ground',slice:null,roofs:true};
function fixture(t,n=30){
 const base=join(homedir(),'.cache/saltmarcher/tests');mkdirSync(base,{recursive:true});
 const dir=mkdtempSync(join(base,'atlas-cache-')),filename=join(dir,'campaign.sqlite'),cacheDir=join(dir,'cache');let store=new CampaignStore(filename);
 const campaign=store.create('Cache',Array.from({length:n},(_,i)=>({id:'r'+i,scopeId:'local',floorId:'ground',number:String(i),name:'Room '+i,revision:0,polygons:[{outer:[{x:i*5,y:0},{x:i*5+3,y:0},{x:i*5+3,y:3},{x:i*5,y:3}],holes:[]}],sections:[]})));let shell=store.activateShell(campaign.id);
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 return{dir,filename,cacheDir,campaign,get store(){return store;},get shell(){return shell;},source:()=>store.atlasRegionSource(shell.token),restore(file){store.close();copyFileSync(file,filename);store=new CampaignStore(filename);shell=store.activateShell(campaign.id);},reopen(){store.close();store=new CampaignStore(filename);shell=store.activateShell(campaign.id);},async read(source=store.atlasRegionSource(shell.token),directory=cacheDir){
  const db=new Database(filename,{readonly:true}),index=await AtlasProjectionIndex.open(db,source,directory);
  try{
   const reader=new AtlasRegionReader(db,undefined,index);let projected=0;
   const project=reader.project.bind(reader);reader.project=(...args)=>{projected++;return project(...args);};
   db.exec('BEGIN');await reader.sync(source);const result={projected,view:reader.read(source,query),count:db.prepare(index.readSql('SELECT count(*) n FROM temp.region_shape')).get().n};
   assert.throws(()=>db.prepare('UPDATE room SET name=?').run('forbidden'),/readonly/);
   if(index.writer!==db)assert.equal(index.writer.prepare("SELECT count(*) n FROM sqlite_schema WHERE name='room'").get().n,0);
   db.exec('COMMIT');assert.equal(await index.flush(),true);return result;
  }finally{db.close();await index.close();}
 }
 };
}
test('cold index is reused after reopening without reading all shape payloads',async t=>{
 const f=fixture(t,1000),source=f.source(),cold=await f.read(source);assert.equal(cold.projected,1000);assert.equal(readdirSync(f.cacheDir).length,2);
 f.reopen();assert.equal(f.source().shapeVersion,source.shapeVersion,'ordinary reopening preserves durable identity');
 const warm=await f.read(source);assert.equal(warm.projected,0);assert.deepEqual(warm.view,cold.view);assert.equal(warm.count,1000);
 const entry=JSON.parse(readFileSync(join(f.cacheDir,projectionKey(f.filename,f.campaign.id)+'.json'),'utf8'));
 assert(!readFileSync(join(f.cacheDir,entry.file)).includes(Buffer.from('Room 999')),'cache contains bounds, not room payloads');
});
test('committed external writes, replace and delete invalidate while rollback preserves reuse',async t=>{
 const f=fixture(t),initial=f.source();await f.read(initial);
 const external=new Database(f.filename);t.after(()=>external.close());
 assert.throws(()=>external.transaction(()=>{external.prepare('UPDATE room SET name=? WHERE id=?').run('rolled back','r0');throw Error('rollback');})(),/rollback/);
 assert.equal(f.source().shapeVersion,initial.shapeVersion);assert.equal((await f.read()).projected,0);
 external.prepare('UPDATE room SET name=? WHERE id=?').run('external','r0');assert.notEqual(f.source().shapeVersion,initial.shapeVersion);
 await assert.rejects(f.read(initial),/inzwischen geändert/);let rebuilt=await f.read();assert.equal(rebuilt.projected,30);assert.equal(rebuilt.view.rooms.find(r=>r.id==='r0').name,'external');
 const row=external.prepare('SELECT * FROM room WHERE id=?').get('r1');external.prepare(`INSERT OR REPLACE INTO room(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(()=>'?').join(',')})`).run(...Object.values({...row,name:'replaced'}));
 assert.equal((await f.read()).view.rooms.find(r=>r.id==='r1').name,'replaced');external.prepare('DELETE FROM room WHERE id=?').run('r2');rebuilt=await f.read();assert(!rebuilt.view.rooms.some(r=>r.id==='r2'));assert.equal(rebuilt.count,29);
});
test('missing tracking triggers disable cache immediately and revoke its epoch on reopen',async t=>{
 const f=fixture(t),old=f.source();await f.read();f.store.db.exec('DROP TRIGGER atlas_shape_source_room_update');f.store.db.prepare('UPDATE room SET name=? WHERE id=?').run('untracked','r0');
 assert.equal(f.source().shapeVersion,undefined);assert.equal((await f.read()).projected,30);
 f.reopen();const current=f.source();assert(current.shapeVersion);assert.notEqual(current.shapeVersion,old.shapeVersion);assert.notEqual(current.geometryVersion,old.geometryVersion);assert.equal((await f.read()).view.rooms.find(r=>r.id==='r0').name,'untracked');assert.equal((await f.read()).projected,0);
});
test('truncated, modified and wrong-format caches rebuild without trusting stored rows',async t=>{
 const f=fixture(t);await f.read();const reference=join(f.cacheDir,projectionKey(f.filename,f.campaign.id)+'.json');
 for(const corrupt of ['truncated','modified','format','manifest']){
  const entry=JSON.parse(readFileSync(reference,'utf8')),file=join(f.cacheDir,entry.file),bytes=readFileSync(file);
  if(corrupt==='truncated')writeFileSync(file,bytes.subarray(0,bytes.length-120));
  if(corrupt==='modified'){bytes[bytes.length-12]^=1;writeFileSync(file,bytes);}
  if(corrupt==='format')writeFileSync(reference,JSON.stringify({...entry,format:99}));
  if(corrupt==='manifest')writeFileSync(reference,'{broken');
  const rebuilt=await f.read();assert.equal(rebuilt.projected,30);assert.equal(rebuilt.count,30);assert.equal(rebuilt.view.coverage.complete,true);assert.equal((await f.read()).projected,0);
 }
});
test('undo and hidden extents survive cached reopen; canonical corruption stays explicit',async t=>{
 const f=fixture(t);await f.read();const r=f.store.atlasRoom(f.shell.token,'r0'),old=f.source().shapeVersion;
 f.store.atlasRoomCommit({commandId:randomUUID(),token:f.shell.token,campaignId:f.campaign.id,roomId:r.id,expectedRevision:r.revision,name:r.name,polygons:r.polygons.map(p=>({...p,outer:p.outer.map(v=>({x:v.x+1000,y:v.y}))})),sections:r.sections});assert(!(await f.read()).view.rooms.some(r=>r.id==='r0'));
 f.store.executeAtlasCommit({commandId:randomUUID(),token:f.shell.token,campaignId:f.campaign.id,action:{kind:'undo'}});assert.notEqual(f.source().shapeVersion,old);assert((await f.read()).view.rooms.some(r=>r.id==='r0'));
 f.store.db.prepare("INSERT INTO drawing_hidden VALUES(?,?,'local','room',1,1)").run(f.campaign.id,'r0');const hidden=await f.read();assert(!hidden.view.rooms.some(r=>r.id==='r0'));assert.equal((await f.read()).projected,0);
 f.store.db.prepare('UPDATE room SET payload=? WHERE id=?').run('{broken','r1');const broken=await f.read();assert.equal(broken.view.coverage.unreadable,1);assert.equal((await f.read()).view.coverage.unreadable,1);assert.equal(f.store.db.prepare('SELECT payload FROM room WHERE id=?').get('r1').payload,'{broken');
});
test('unwritable cache and shadow previews cannot change canonical opening; erasure is scoped',async t=>{
 const f=fixture(t);writeFileSync(join(f.dir,'blocked'),'file');const uncached=await f.read(undefined,join(f.dir,'blocked'));assert.equal(uncached.view.coverage.complete,true);
 const source=f.source();await f.read(source);const db=new Database(f.filename,{readonly:true});try{const index=await AtlasProjectionIndex.open(db,{...source,shadow:{filename:'preview',scopeId:'local'}},f.cacheDir);assert.equal(index.persistent,false);await index.close();}finally{db.close();}
 writeFileSync(join(f.cacheDir,'unrelated.jsonl'),'keep');writeFileSync(join(f.cacheDir,projectionKey(f.filename,f.campaign.id)+'.candidate-orphan'),'partial');
 await eraseAtlasProjection(f.cacheDir,f.filename,f.campaign.id);assert.deepEqual(readdirSync(f.cacheDir),['unrelated.jsonl']);assert.equal(atlasShapeSource(f.store.db,f.campaign.id),source.shapeVersion);
});
test('campaign archives remap cache metadata and reject damaged source identities',async t=>{
 const f=fixture(t,3),snapshot=join(f.dir,'snapshot.sqlite');await f.store.campaignSnapshot(f.shell.token,snapshot);
 const target=new CampaignStore(join(f.dir,'copy.sqlite'));try{
  const copy=target.acceptCampaignSnapshot(snapshot,'Independent',{},randomUUID()),token=target.activateShell(copy.id).token;
  const root=target.db.prepare('SELECT map_id FROM campaign_atlas WHERE campaign_id=?').get(copy.id),marker=target.db.prepare("SELECT id FROM world_record WHERE campaign_id=? AND kind='atlas-shape-source'").get(copy.id);
  assert.equal(marker.id,root.map_id);assert.notEqual(root.map_id,f.store.db.prepare('SELECT map_id FROM campaign_atlas WHERE campaign_id=?').get(f.campaign.id).map_id);
  const before=target.atlasRegionSource(token).shapeVersion;target.db.prepare('UPDATE room SET name=? WHERE campaign_id=?').run('copied edit',copy.id);assert.notEqual(target.atlasRegionSource(token).shapeVersion,before);await target.backup(join(f.dir,'copy-backup.sqlite'));
 }finally{target.close();}
 f.store.db.prepare("UPDATE world_record SET checksum='bad' WHERE kind='atlas-shape-source'").run();await assert.rejects(f.store.backup(join(f.dir,'bad.sqlite')),/Objektquellenstand|beschädigt/);
});
test('restored backups cannot reuse a different edit branch with the same counter',async t=>{
 const f=fixture(t),backup=join(f.dir,'restore.sqlite');await f.store.backup(backup);
 f.store.db.prepare('UPDATE room SET name=? WHERE id=?').run('branch one','r0');const old=f.source();await f.read(old);
 // Restore the full SQLite snapshot in place, including its old trigger bodies.
 f.restore(backup);f.store.db.prepare('UPDATE room SET name=? WHERE id=?').run('branch two','r0');const current=f.source();assert.equal(current.shapeVersion.split(':')[1],old.shapeVersion.split(':')[1]);assert.notEqual(current.shapeVersion,old.shapeVersion);assert.notEqual(current.geometryVersion,old.geometryVersion);assert.equal((await f.read()).view.rooms.find(r=>r.id==='r0').name,'branch two');
});
test('interactive changes persist incrementally and a fresh reader reuses the committed index',async t=>{
 for(const warm of [false,true]){
 const f=fixture(t);if(warm)await f.read();
 const db=new Database(f.filename,{readonly:true}),index=await AtlasProjectionIndex.open(db,f.source(),f.cacheDir);
 assert.equal(index.writer!==db,warm);
 try{
  const reader=new AtlasRegionReader(db,undefined,index),old=f.source();await reader.sync(old);const publishing=index.flush();
  f.store.db.prepare('UPDATE room SET name=? WHERE id=?').run('interactive','r0');
  const source=f.store.atlasRegionSource(f.shell.token,{epoch:old.epoch,sequence:old.sequence});assert.equal(source.reset,false);
  let projected=0;const project=reader.project.bind(reader);reader.project=(...args)=>{projected++;return project(...args);};
  db.exec('BEGIN');await reader.sync(source);assert.equal(reader.read(source,query).rooms.find(r=>r.id==='r0').name,'interactive');db.exec('COMMIT');
  assert.equal(projected,1);await publishing;assert.equal(await index.flush(),true);
  const reopened=await f.read();assert.equal(reopened.projected,0);assert.equal(reopened.view.rooms.find(r=>r.id==='r0').name,'interactive');
 }finally{db.close();await index.close();}
 }
});
test('startup removes interrupted private work and candidates, preserving completed and unrelated files',async t=>{
 const f=fixture(t);writeFileSync(join(f.dir,'blocked'),'file');await clearProjectionWork(join(f.dir,'blocked'));await f.read();
 const original=readdirSync(f.cacheDir),key=projectionKey(f.filename,f.campaign.id);
 writeFileSync(join(f.cacheDir,key+'.'+ 'a'.repeat(64)+'.sqlite'),'orphan');
 writeFileSync(join(f.cacheDir,key+'.candidate-'+randomUUID()+'.sqlite'),'partial');mkdirSync(join(f.cacheDir,key+'.work-'+randomUUID()));
 writeFileSync(join(f.cacheDir,'unrelated'),'keep');await clearProjectionWork(f.cacheDir);
 assert.deepEqual(readdirSync(f.cacheDir).sort(),[...original,'unrelated'].sort());assert.equal((await f.read()).projected,0);
});
test('landscape bounds persist, update and delete locally, including exact 64-bit rowids',async t=>{
 const f=fixture(t),record={id:'road',revision:0,kind:'road',name:'Lane',points:[{x:0,y:0},{x:10,y:0}],polygons:[],resolution:1,width:1,values:{}};
 f.store.db.prepare('INSERT INTO atlas_landscape(rowid,campaign_id,id,revision,min_x,max_x,min_y,max_y,payload) VALUES(?,?,?,?,?,?,?,?,?)').run('9223372036854775806',f.campaign.id,record.id,0,-1,11,-1,1,JSON.stringify(record));
 const first=await f.read();assert.equal(first.view.landscape.state,'ready');assert.equal(first.view.landscape.records[0].id,'road');assert.deepEqual((await f.read()).view,first.view);
 const db=new Database(f.filename,{readonly:true}),index=await AtlasProjectionIndex.open(db,f.source(),f.cacheDir);
 try{
  const reader=new AtlasRegionReader(db,undefined,index);let source=f.source();await reader.sync(source);
  const project=reader.landscape.storeBounds.bind(reader.landscape);let updated=0;reader.landscape.storeBounds=row=>{updated++;project(row);};
  f.store.db.prepare('UPDATE atlas_landscape SET min_x=999,max_x=1011,payload=? WHERE id=?').run(JSON.stringify({...record,points:record.points.map(p=>({...p,x:p.x+1000}))}),'road');
  const next=f.store.atlasRegionSource(f.shell.token,{epoch:source.epoch,sequence:source.sequence});assert.notEqual(next.shapeVersion,source.shapeVersion);source=next;
  db.exec('BEGIN');await reader.sync(source);assert.equal(reader.read(source,query).landscape.records.length,0);db.exec('COMMIT');assert.equal(updated,1);await index.flush();assert.equal((await f.read()).projected,0);
  f.store.db.prepare('DELETE FROM atlas_landscape WHERE id=?').run('road');source=f.store.atlasRegionSource(f.shell.token,{epoch:source.epoch,sequence:source.sequence});await reader.sync(source);await index.flush();
  assert.equal(index.prepare('SELECT count(*) n FROM temp.landscape_shape_bounds').get().n,0);assert.equal((await f.read()).view.landscape.records.length,0);
 }finally{db.close();await index.close();}
 for(const sql of ["UPDATE scope SET name='Renamed'", "INSERT INTO location VALUES(?, 'place',0,0,'{}','unused')"]){const previous=f.source().shapeVersion;f.store.db.prepare(sql).run(...(sql.includes('?')?[f.campaign.id]:[]));assert.notEqual(f.source().shapeVersion,previous);}
});
test('pinned canonical snapshots and index rollback cannot publish mixed revisions',async t=>{
 const f=fixture(t),db=new Database(f.filename,{readonly:true}),source=f.source(),index=await AtlasProjectionIndex.open(db,source,f.cacheDir);
 try{
  const reader=new AtlasRegionReader(db,undefined,index);db.exec('BEGIN');db.prepare('SELECT count(*) FROM room').get();
  f.store.db.prepare("UPDATE room SET name='new' WHERE id='r0'").run();
  await reader.sync(source);assert.notEqual(reader.read(source,query).rooms.find(r=>r.id==='r0').name,'new');db.exec('COMMIT');await index.flush();
  const current=f.source();assert.equal((await f.read()).view.rooms.find(r=>r.id==='r0').name,'new');
  // Force failure after derived writes, before marking/committing geometry.
  const mark=index.mark.bind(index);index.mark=(part,s)=>{if(part==='geometry')throw Error('interrupted sync');mark(part,s);};
  await assert.rejects(reader.sync(current),/interrupted sync/);assert.equal(index.writer.inTransaction,false);assert.equal(index.valid('geometry',source),true);assert.equal(index.valid('geometry',current),false);
  index.mark=mark;await reader.sync(current);assert.equal(reader.read(current,query).rooms.find(r=>r.id==='r0').name,'new');await index.flush();assert.equal((await f.read()).projected,0);
 }finally{db.close();await index.close();}
});
test('independent workers share published snapshots and clean only their own work after cancellation',async t=>{
 const f=fixture(t,1000),worker=new URL('../.build/region-cache-worker.cjs',import.meta.url).pathname;
 const a=new AtlasRegionService(worker,undefined,f.cacheDir),b=new AtlasRegionService(worker,undefined,f.cacheDir);
 try{
  const source=f.source();const first=await a.read(source,query),key=projectionKey(f.filename,f.campaign.id),reference=join(f.cacheDir,key+'.json');
  const until=Date.now()+4000;while(!readdirSync(f.cacheDir).includes(key+'.json')&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,25));
  assert(readFileSync(reference).length);assert.deepEqual(await b.read(source,query),first);assert.equal(readdirSync(f.cacheDir).filter(n=>n.includes('.work-')).length,2);
  const stale=a.read(source,{...query,box:{...query.box,x:10}});a.cancel();await assert.rejects(stale,/abgebrochen/);await a.cancelAndWait();
  assert.equal(readdirSync(f.cacheDir).filter(n=>n.includes('.work-')).length,1);assert.equal((await b.focus(source,'room','r0')).id,'r0');
  assert.deepEqual(await a.read(source,query),first);
 }finally{await a.close();await b.close();}
 assert.equal(readdirSync(f.cacheDir).filter(n=>n.includes('.work-')).length,0);assert.equal((await f.read()).projected,0);
});
test('a terrain-only journal overflow reuses geometry instead of rebuilding every building',async t=>{
 const f=fixture(t,300),record={id:'terrain-road',revision:0,kind:'road',name:'Lane',points:[{x:0,y:0},{x:10,y:0}],polygons:[],resolution:1,width:1,values:{}};
 f.store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)').run(f.campaign.id,record.id,0,-1,11,-1,1,JSON.stringify(record));
 const old=f.source();await f.read(old);const db=new Database(f.filename,{readonly:true}),index=await AtlasProjectionIndex.open(db,old,f.cacheDir);
 try{
  const reader=new AtlasRegionReader(db,undefined,index);await reader.sync(old);let projected=0;
  const project=reader.project.bind(reader);reader.project=(...args)=>{projected++;return project(...args);};
  const update=f.store.db.prepare('UPDATE atlas_landscape SET revision=revision+1 WHERE id=?');f.store.db.transaction(()=>{for(let i=0;i<10001;i++)update.run(record.id);})();
  const source=f.store.atlasRegionSource(f.shell.token,{epoch:old.epoch,sequence:old.sequence});
  assert.equal(source.reset,true);assert.notEqual(source.shapeVersion,old.shapeVersion);assert.equal(source.geometryVersion,old.geometryVersion);
  db.exec('BEGIN');await reader.sync(source);const view=reader.read(source,query);db.exec('COMMIT');assert.equal(projected,0);assert.equal(view.landscape.state,'ready');assert(view.rooms.length>0);
  await index.flush();assert.equal((await f.read()).projected,0);
 }finally{db.close();await index.close();}
});
test('steady camera requests do not starve publication of the completed index',async t=>{
 const f=fixture(t,300),worker=new URL('../.build/region-cache-worker.cjs',import.meta.url).pathname;
 const service=new AtlasRegionService(worker,undefined,f.cacheDir);let observed=false;
 try{
  const source=f.source();await service.read(source,query);const reference=projectionKey(f.filename,f.campaign.id)+'.json',deadline=Date.now()+4000;let requests=0;
  while(Date.now()<deadline){
   await service.read(source,{...query,box:{...query.box,x:requests++/1000}});
   if(readdirSync(f.cacheDir).includes(reference)){observed=true;break;}
   await new Promise(resolve=>setTimeout(resolve,10));
  }
  assert(requests>1);assert(observed,'A stable source must publish while camera requests continue');
 }finally{await service.close();}
 assert.equal((await f.read()).projected,0);
});

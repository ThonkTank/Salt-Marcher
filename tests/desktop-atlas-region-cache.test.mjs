import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from './helpers/build.mjs';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,readdirSync,mkdirSync,copyFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url),Database=require('better-sqlite3');
for(const [name,file]of [['store','src/app/storage/store.ts'],['reader','src/app/storage/atlas-region.ts'],['cache','src/app/storage/atlas-region-cache.ts'],['version','src/app/storage/atlas-shape-source.ts']])buildSync({entryPoints:[file],outfile:'.build/region-cache-'+name+'.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require('../.build/region-cache-store.cjs'),{AtlasRegionReader}=require('../.build/region-cache-reader.cjs'),{AtlasRegionCache,eraseAtlasRegionCache}=require('../.build/region-cache-cache.cjs'),{atlasShapeSource}=require('../.build/region-cache-version.cjs');
const query={box:{x:-1,y:-1,width:500,height:10},width:1024,height:768,scopeId:'local',floorId:'ground',slice:null,roofs:true};
function fixture(t,n=30){
 const base=join(homedir(),'.cache/saltmarcher/tests');mkdirSync(base,{recursive:true});
 const dir=mkdtempSync(join(base,'atlas-cache-')),filename=join(dir,'campaign.sqlite'),cacheDir=join(dir,'cache');let store=new CampaignStore(filename);
 const campaign=store.create('Cache',Array.from({length:n},(_,i)=>({id:'r'+i,scopeId:'local',floorId:'ground',number:String(i),name:'Room '+i,revision:0,polygons:[{outer:[{x:i*5,y:0},{x:i*5+3,y:0},{x:i*5+3,y:3},{x:i*5,y:3}],holes:[]}],sections:[]})));let shell=store.activateShell(campaign.id);
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 return{dir,filename,cacheDir,campaign,get store(){return store;},get shell(){return shell;},source:()=>store.atlasRegionSource(shell.token),restore(file){store.close();copyFileSync(file,filename);store=new CampaignStore(filename);shell=store.activateShell(campaign.id);},reopen(){store.close();store=new CampaignStore(filename);shell=store.activateShell(campaign.id);},async read(source=store.atlasRegionSource(shell.token),cache=new AtlasRegionCache(cacheDir)){
  const db=new Database(filename,{readonly:true});try{db.exec('BEGIN');const reader=new AtlasRegionReader(db,undefined,cache);let projected=0;const project=reader.project.bind(reader);reader.project=(...args)=>{projected++;return project(...args);};await reader.sync(source);return{projected,view:reader.read(source,query),count:db.prepare('SELECT count(*) n FROM temp.region_shape').get().n};}finally{db.close();}
 }};
}
test('cold index is reused after reopening without reading all shape payloads',async t=>{
 const f=fixture(t,1000),source=f.source(),cold=await f.read(source);assert.equal(cold.projected,1000);assert.equal(readdirSync(f.cacheDir).length,1);
 f.reopen();assert.equal(f.source().shapeVersion,source.shapeVersion,'ordinary reopening preserves durable identity');
 const warm=await f.read(source);assert.equal(warm.projected,0);assert.deepEqual(warm.view,cold.view);assert.equal(warm.count,1000);
 assert(!readFileSync(join(f.cacheDir,readdirSync(f.cacheDir)[0]),'utf8').includes('Room 999'),'cache contains bounds, not room payloads');
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
 f.reopen();const current=f.source();assert(current.shapeVersion);assert.notEqual(current.shapeVersion,old.shapeVersion);assert.equal((await f.read()).view.rooms.find(r=>r.id==='r0').name,'untracked');assert.equal((await f.read()).projected,0);
});
test('truncated, modified and wrong-format caches roll back partial rows and rebuild',async t=>{
 const f=fixture(t);await f.read();const file=join(f.cacheDir,readdirSync(f.cacheDir)[0]),original=readFileSync(file,'utf8');
 for(const corrupt of [original.slice(0,-120),original.replace('"room:r0"','"room:bad"'),original.replace('"format":1','"format":99'),original+'garbage\n']){
  writeFileSync(file,corrupt);const rebuilt=await f.read();assert.equal(rebuilt.projected,30);assert.equal(rebuilt.count,30);assert.equal(rebuilt.view.coverage.complete,true);assert.equal((await f.read()).projected,0);
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
 const f=fixture(t);writeFileSync(join(f.dir,'blocked'),'file');const uncached=await f.read(undefined,new AtlasRegionCache(join(f.dir,'blocked')));assert.equal(uncached.view.coverage.complete,true);
 const source=f.source();await f.read(source);const db=new Database(f.filename,{readonly:true});try{assert.equal(await new AtlasRegionCache(f.cacheDir).load(db,{...source,shadow:{filename:'preview',scopeId:'local'}}),false);}finally{db.close();}
 writeFileSync(join(f.cacheDir,'unrelated.jsonl'),'keep');const own=readdirSync(f.cacheDir).find(f=>f!=='unrelated.jsonl');writeFileSync(join(f.cacheDir,own+'.candidate-orphan'),'partial');
 await eraseAtlasRegionCache(f.cacheDir,f.filename,f.campaign.id);assert.deepEqual(readdirSync(f.cacheDir),['unrelated.jsonl']);assert.equal(atlasShapeSource(f.store.db,f.campaign.id),source.shapeVersion);
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
 f.restore(backup);f.store.db.prepare('UPDATE room SET name=? WHERE id=?').run('branch two','r0');const current=f.source();assert.equal(current.shapeVersion.split(':')[1],old.shapeVersion.split(':')[1]);assert.notEqual(current.shapeVersion,old.shapeVersion);assert.equal((await f.read()).view.rooms.find(r=>r.id==='r0').name,'branch two');
});
test('interactive object updates avoid rewriting the full cache, then a fresh reader rebuilds once',async t=>{
 const f=fixture(t),db=new Database(f.filename,{readonly:true});try{
  const reader=new AtlasRegionReader(db,undefined,new AtlasRegionCache(f.cacheDir)),old=f.source();await reader.sync(old);
  const file=join(f.cacheDir,readdirSync(f.cacheDir)[0]),cached=readFileSync(file,'utf8');f.store.db.prepare('UPDATE room SET name=? WHERE id=?').run('interactive','r0');
  const source=f.store.atlasRegionSource(f.shell.token,{epoch:old.epoch,sequence:old.sequence});assert.equal(source.reset,false);await reader.sync(source);assert.equal(reader.read(source,query).rooms.find(r=>r.id==='r0').name,'interactive');assert.equal(readFileSync(file,'utf8'),cached);
  const reopened=await f.read();assert.equal(reopened.projected,30);assert.equal(reopened.view.rooms.find(r=>r.id==='r0').name,'interactive');assert.equal((await f.read()).projected,0);
 }finally{db.close();}
});
test('startup removes interrupted cache candidates without deleting completed or unrelated files',async t=>{
 const {clearAtlasRegionCacheCandidates}=require('../.build/region-cache-cache.cjs'),f=fixture(t);writeFileSync(join(f.dir,'blocked'),'file');await clearAtlasRegionCacheCandidates(join(f.dir,'blocked'));await f.read();const name=readdirSync(f.cacheDir)[0];
 writeFileSync(join(f.cacheDir,name+'.candidate-'+randomUUID()),'partial');writeFileSync(join(f.cacheDir,'unrelated'),'keep');await clearAtlasRegionCacheCandidates(f.cacheDir);assert.deepEqual(readdirSync(f.cacheDir).sort(),[name,'unrelated'].sort());assert.equal((await f.read()).projected,0);
});

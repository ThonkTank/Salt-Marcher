import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';

const require=createRequire(import.meta.url);
for(const [name,file]of [['store','src/app/storage/store.ts'],['service','desktop/atlas-region.ts'],['worker','desktop/atlas-region-worker.ts']])
 buildSync({entryPoints:[file],outfile:'.build/overview-service-'+name+'.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require('../.build/overview-service-store.cjs'),
 {AtlasRegionService}=require('../.build/overview-service-service.cjs');

const tile={lod:1,x:0,y:0};
const room=i=>{
 const x=(i%32)*16,y=Math.floor(i/32)*10;
 return{id:'overview-room-'+i,scopeId:'local',floorId:'ground',number:String(i),name:'Room '+i,revision:0,
  polygons:[{outer:[{x,y},{x:x+3,y},{x:x+3,y:y+3},{x,y:y+3}],holes:[]}],sections:[]};
};
const overviewOf=result=>{
 assert.deepEqual(result.model.objects,[],'overview geometry cannot become semantic objects');
 assert.equal(result.model.overviews.length,1);
 return result.model.overviews[0];
};
const meshBytes=result=>overviewOf(result).meshes.flatMap(mesh=>[
 Buffer.from(mesh.positions.buffer,mesh.positions.byteOffset,mesh.positions.byteLength),
 Buffer.from(mesh.indices.buffer,mesh.indices.byteOffset,mesh.indices.byteLength),
]);
const moveFirstRoom=(store,token,campaignId,dx)=>{
 const current=store.atlasRoom(token,'overview-room-0');
 store.atlasDrawingCommit({commandId:randomUUID(),token,campaignId,action:{kind:'shape',roomId:current.id,
  expectedRevision:current.revision,polygons:current.polygons.map(p=>({...p,outer:p.outer.map(point=>({x:point.x+dx,y:point.y}))}))}});
};

test('real worker streams bounded overview meshes, reuses bytes after restart, and rejects stale continuations',{timeout:60000},async t=>{
 const base=homedir()+'/.cache/saltmarcher/tests';mkdirSync(base,{recursive:true});
 const dir=mkdtempSync(base+'/atlas-geometry-overview-worker-');
 const store=new CampaignStore(dir+'/world.sqlite'),campaign=store.create('Overview worker',Array.from({length:1500},(_,i)=>room(i))),
  token=store.activateShell(campaign.id).token,worker=new URL('../.build/overview-service-worker.cjs',import.meta.url).pathname,
  cacheDirectory=dir+'/cache';
 let service=new AtlasRegionService(worker,undefined,cacheDirectory);
 t.after(async()=>{await service.close();store.close();rmSync(dir,{recursive:true,force:true});});

 const source=store.atlasRegionSource(token,service.cursor),first=await service.geometryTile(source,{tile,revision:source.revision}),overview=overviewOf(first);
 assert.equal(first.cache,'built');
 assert.equal(overview.modeledObjects,1500,'every room in the local scope contributes to the overview');
 assert(overview.meshes.length<=2,'the output has at most one mesh per modeled kind');
 let outputBytes=0;
 for(const mesh of overview.meshes){
  assert(mesh.positions instanceof Float32Array);assert(mesh.indices instanceof Uint32Array);
  assert.deepEqual(Object.keys(mesh).sort(),['id','indices','kind','origin','positions']);
  outputBytes+=mesh.positions.byteLength+mesh.indices.byteLength;
 }
 assert(outputBytes<=5.9*1024*1024,'overview buffers stay within the fixed grid bound');
 assert(service.diagnostics.terrainYields>0,'a large overview crosses at least one cooperative worker continuation');
 const firstBytes=meshBytes(first).map(bytes=>Buffer.from(bytes));

 await service.close();service=new AtlasRegionService(worker,undefined,cacheDirectory);
 const warmSource=store.atlasRegionSource(token,service.cursor),warm=await service.geometryTile(warmSource,{tile,revision:warmSource.revision});
 assert.equal(warm.cache,'hit','the persistent overview cache survives a worker restart');
 assert.equal(overviewOf(warm).modeledObjects,1500);
 assert.deepEqual(meshBytes(warm),firstBytes,'cached typed-buffer bytes match the original overview');

 moveFirstRoom(store,token,campaign.id,1);
 const beforeInterruption=store.atlasRegionSource(token,service.cursor);
 const continuationObserved=new Promise(resolve=>{
  const observe=message=>{
   if(message?.value?.terrainProjectionContinuation!==true)return;
   service.worker.off('message',observe);
   moveFirstRoom(store,token,campaign.id,1);
   resolve();
  };
  service.worker.on('message',observe);
 });
 const interrupted=service.geometryTile(beforeInterruption,{tile,revision:beforeInterruption.revision}).then(
  value=>({value}),error=>({error}),
 );
 await continuationObserved;
 const interruptedResult=await interrupted;
 assert.match(String(interruptedResult.error),/inzwischen geändert/,'a revision change after a real worker yield rejects the partial result');

 await assert.rejects(service.geometryTile(beforeInterruption,{tile,revision:beforeInterruption.revision}),/inzwischen geändert/,
  'an already stale geometry request is rejected');
 await service.close();
 const cold=new AtlasRegionService(worker);
 const freshCold=new AtlasRegionService(worker);
 try{
  const current=store.atlasRegionSource(token,cold.cursor),recovered=await cold.geometryTile(current,{tile,revision:current.revision});
  assert.equal(recovered.cache,'disabled');
  assert.equal(overviewOf(recovered).modeledObjects,1500);
  const freshSource=store.atlasRegionSource(token,freshCold.cursor),fresh=await freshCold.geometryTile(freshSource,{tile,revision:freshSource.revision});
  assert.deepEqual(meshBytes(recovered),meshBytes(fresh),'recovery agrees with a separate fresh uncached worker');
 }finally{await Promise.all([cold.close(),freshCold.close()]);}
});

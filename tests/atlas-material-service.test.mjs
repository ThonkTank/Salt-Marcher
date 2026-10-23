import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';

const require=createRequire(import.meta.url);
for(const [name,file]of [['store','src/app/storage/store.ts'],['service','desktop/atlas-region.ts'],['worker','desktop/atlas-region-worker.ts']])
 buildSync({entryPoints:[file],outfile:'.build/material-service-'+name+'.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
buildSync({entryPoints:['src/app/terrain-height.ts'],outfile:'.build/material-service-height.cjs',bundle:true,platform:'node',format:'cjs'});
const {CampaignStore}=require('../.build/material-service-store.cjs'),
 {AtlasRegionService}=require('../.build/material-service-service.cjs'),
 {heightRecord}=require('../.build/material-service-height.cjs');

test('real worker returns five independent material channels, reuses them after restart, and rejects stale revisions',{timeout:20000},async t=>{
 const base=homedir()+'/.cache/saltmarcher/tests';mkdirSync(base,{recursive:true});
 const dir=mkdtempSync(base+'/material-worker-'),store=new CampaignStore(dir+'/world.sqlite'),campaign=store.create('Material tiles'),token=store.activateShell(campaign.id).token,
  worker=new URL('../.build/material-service-worker.cjs',import.meta.url).pathname,cacheDirectory=dir+'/cache';
 let service=new AtlasRegionService(worker,undefined,cacheDirectory);
 t.after(async()=>{await service.close();store.close();rmSync(dir,{recursive:true,force:true});});
 store.executeAtlasCommit({campaignId:campaign.id,token,commandId:randomUUID(),action:{kind:'landscape-put',expectedRevision:null,record:heightRecord(0,0,16,Float32Array.from({length:4096},(_,i)=>40+25*Math.sin(i%64/8)))}});
 const tile={lod:0,x:0,y:0},source=store.atlasRegionSource(token,service.cursor),request={tile,revision:source.revision};
 const first=await service.materialTile(source,request);
 assert.deepEqual(Object.keys(first.channels).sort(),['baseColor','forest','rock','snow','water']);
 assert.equal(first.width,256);assert.equal(first.height,256);assert.equal(first.fence,source.fence);assert.deepEqual(first.tile,tile);
 for(const name of ['baseColor','water','forest','rock','snow']){
  const channel=first.channels[name];assert(channel instanceof Uint8Array,`${name} is an independent byte channel`);
  assert.equal(channel.length,256*256*(name==='baseColor'?4:1),`${name} has the expected raster dimensions`);
  assert.equal(first.cache[name],'built',`${name} was built on a cold cache`);
 }
 const firstBytes=Object.fromEntries(Object.entries(first.channels).map(([name,bytes])=>[name,Buffer.from(bytes)]));
 await service.close();service=new AtlasRegionService(worker,undefined,cacheDirectory);
 const warmSource=store.atlasRegionSource(token,service.cursor),warm=await service.materialTile(warmSource,{tile,revision:warmSource.revision});
 for(const name of ['baseColor','water','forest','rock','snow']){
  assert.equal(warm.cache[name],'hit',`${name} is reused after worker restart`);
  assert.deepEqual(Buffer.from(warm.channels[name]),firstBytes[name],`${name} bytes survive restart`);
 }
 store.executeAtlasCommit({campaignId:campaign.id,token,commandId:randomUUID(),action:{kind:'undo'}});
 await assert.rejects(service.materialTile(warmSource,{tile,revision:warmSource.revision}),/inzwischen geändert/);
 // A commit after an actual worker yield must also reject the partially prepared
 // tile, not merely an already stale request at entry.
 const current=store.atlasRegionSource(token,service.cursor),nextTile={lod:0,x:2,y:0};
 const changed=new Promise(resolve=>{
  const observe=reply=>{if(!reply?.value?.terrainProjectionContinuation)return;service.worker.off('message',observe);
   store.executeAtlasCommit({campaignId:campaign.id,token,commandId:randomUUID(),action:{kind:'landscape-sea-level',seaLevelM:10}});resolve();};
  service.worker.on('message',observe);
 });
 const interrupted=service.materialTile(current,{tile:nextTile,revision:current.revision}).then(value=>({value}),error=>({error}));
 await changed;assert.match(String((await interrupted).error),/inzwischen geändert/);
 const latest=store.atlasRegionSource(token,service.cursor),recovered=await service.materialTile(latest,{tile:nextTile,revision:latest.revision});
 const cold=new AtlasRegionService(worker);
 try{assert.deepEqual(recovered.channels,(await cold.materialTile(store.atlasRegionSource(token),{tile:nextTile,revision:latest.revision})).channels);}finally{await cold.close();}

});

import {materialChannels} from './helpers/atlas-material-channels.mjs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from './helpers/build.mjs';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

const require=createRequire(import.meta.url),Database=require('better-sqlite3');
for(const [name,file]of [['store','src/app/storage/store.ts'],['service','desktop/atlas-region.ts'],['worker','desktop/atlas-region-worker.ts'],['cache','src/app/storage/atlas-projection-index.ts'],['tile-cache','src/app/storage/atlas-tile-cache.ts']])
 buildSync({entryPoints:[file],outfile:`.build/atlas-first-product-${name}.cjs`,bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require('../.build/atlas-first-product-store.cjs'),
 {AtlasRegionService}=require('../.build/atlas-first-product-service.cjs'),
 {projectionKey,PROJECTION_CACHE_KEY}=require('../.build/atlas-first-product-cache.cjs'),
 {AtlasTileCache}=require('../.build/atlas-first-product-tile-cache.cjs');

const overview={lod:1,x:0,y:0},fine={lod:0,x:0,y:0},terrain={lod:0,x:0,y:0};
const room=i=>{const x=i*5;return{id:`r${i}`,scopeId:'local',floorId:'ground',number:String(i),name:`Room ${i}`,revision:0,
 polygons:[{outer:[{x,y:0},{x:x+3,y:0},{x:x+3,y:3},{x,y:3}],holes:[]}],sections:[]};};
function fixture(t,n=20){
 const base=join(homedir(),'.cache/saltmarcher/tests');mkdirSync(base,{recursive:true});
 const dir=mkdtempSync(join(base,'atlas-first-product-')),filename=join(dir,'world.sqlite'),cacheDirectory=join(dir,'cache'),
  store=new CampaignStore(filename),campaign=store.create('First product',Array.from({length:n},(_,i)=>room(i))),token=store.activateShell(campaign.id).token,
  worker=new URL('../.build/atlas-first-product-worker.cjs',import.meta.url).pathname;
 let service=new AtlasRegionService(worker,undefined,cacheDirectory);
 t.after(async()=>{await service.close();store.close();rmSync(dir,{recursive:true,force:true});});
 const source=()=>store.atlasRegionSource(token,service.cursor),
  request=(tile,s=source())=>({tile,revision:s.revision});
 return{dir,filename,cacheDirectory,store,campaign,token,worker,get service(){return service;},set service(v){service=v;},source,request,
  async restart(){await service.close();service=new AtlasRegionService(worker,undefined,cacheDirectory);},
  clearIndex(){const db=new Database(join(cacheDirectory,'tiles-v2','atlas-tiles.sqlite'));try{
   const namespace=projectionKey(filename,campaign.id);db.prepare('DELETE FROM atlas_tile_cache WHERE namespace=? AND key=?').run(namespace,PROJECTION_CACHE_KEY);
  }finally{db.close();}},
  workDirectories(){try{return readdirSync(cacheDirectory).filter(name=>name.includes('.work-'));}catch{return[];}},
 };
}
// V8 may deserialize views into a shared backing buffer. Compare only each
// view's bytes; hash failures avoid formatting megabytes of binary differences.
const bytesHash=value=>createHash('sha256').update(ArrayBuffer.isView(value)?Buffer.from(value.buffer,value.byteOffset,value.byteLength):value).digest('hex');
const geometryBytes=result=>[...(result.model.objects??[]),...(result.model.overviews??[]).flatMap(item=>item.meshes)].flatMap(mesh=>[
 bytesHash(Buffer.from(mesh.positions.buffer,mesh.positions.byteOffset,mesh.positions.byteLength)),
 bytesHash(Buffer.from(mesh.indices.buffer,mesh.indices.byteOffset,mesh.indices.byteLength)),
]);
const materialBytes=result=>Object.fromEntries(Object.entries(result.channels).map(([key,value])=>[key,bytesHash(value)]));

test('exact durable tile hits bypass projection-index creation and the next miss initializes the reader', {timeout:30000},async t=>{
 const f=fixture(t),initial=f.source();
 const coldOverview=await f.service.geometryTile(initial,{tile:overview,revision:initial.revision});
 const coldFine=await f.service.geometryTile(initial,{tile:fine,revision:initial.revision});
 const coldTerrain=await f.service.terrainTile(initial,{tile:terrain,revision:initial.revision});
 const coldMaterial=await f.service.materialTile(initial,{tile:terrain,revision:initial.revision});
 assert.equal(coldOverview.cache,'built');assert.equal(coldFine.cache,'built');
 assert.equal(coldTerrain.cache,'built');assert(Object.values(coldMaterial.cache).every(value=>value==='built'));
 const expectedOverview=geometryBytes(coldOverview),expectedFine=geometryBytes(coldFine),
  expectedTerrain=bytesHash(coldTerrain.projection.pixels),expectedHeights=bytesHash(coldTerrain.projection.grid.heights),
  expectedMaterial=materialBytes(coldMaterial);

 await f.restart();f.clearIndex();
 assert.deepEqual(f.workDirectories(),[],'worker shutdown removed its private index working directory');
 const warmSource=f.source();
 const warmOverview=await f.service.geometryTile(warmSource,{tile:overview,revision:warmSource.revision});
 const warmFine=await f.service.geometryTile(warmSource,{tile:fine,revision:warmSource.revision});
 const warmTerrain=await f.service.terrainTile(warmSource,{tile:terrain,revision:warmSource.revision});
 const warmMaterial=await f.service.materialTile(warmSource,{tile:terrain,revision:warmSource.revision});
 assert.equal(warmOverview.cache,'hit');assert.deepEqual(geometryBytes(warmOverview),expectedOverview);
 assert.equal(warmFine.cache,'hit');assert.deepEqual(geometryBytes(warmFine),expectedFine);
 assert.equal(warmTerrain.cache,'hit');assert.deepEqual(bytesHash(warmTerrain.projection.pixels),expectedTerrain);
 assert.deepEqual(bytesHash(warmTerrain.projection.grid.heights),expectedHeights);
 assert(Object.values(warmMaterial.cache).every(value=>value==='hit'));assert.deepEqual(materialBytes(warmMaterial),expectedMaterial);
 assert.deepEqual(f.workDirectories(),[],'all exact hits returned without opening or creating a projection-index work directory');

 const missTile={lod:1,x:1,y:0},miss=await f.service.geometryTile(warmSource,{tile:missTile,revision:warmSource.revision});
 assert.equal(miss.cache,'built','a real miss falls through to the indexed reader');
 assert.equal(miss.model.overviews[0].modeledObjects,0,'the miss reply describes the canonical empty neighboring tile');
 assert.equal(f.workDirectories().length,1,'the first miss creates its private projection-index work directory');
});

test('first-product fast path rejects a stale source stamp even when atlas revision is unchanged',{timeout:20000},async t=>{
 const f=fixture(t,4),old=f.source();
 await f.service.geometryTile(old,{tile:overview,revision:old.revision});await f.restart();
 const external=new Database(f.filename);t.after(()=>external.close());
 external.prepare('UPDATE room SET name=? WHERE campaign_id=? AND id=?').run('changed without atlas revision',f.campaign.id,'r0');
 assert.equal(external.prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?').get(f.campaign.id).revision,old.revision);
 const result=await f.service.geometryTile(old,{tile:overview,revision:old.revision}).then(value=>({value}),error=>({error}));
 assert.match(String(result.error),/Atlas inzwischen geändert|Geometriekachel inzwischen geändert/);
 assert.deepEqual(f.workDirectories(),[],'stale direct-hit rejection does not initialize derived indexes');
});

test('request revision mismatch is rejected before returning an exact tile hit',{timeout:20000},async t=>{
 const f=fixture(t,4),source=f.source();await f.service.geometryTile(source,{tile:overview,revision:source.revision});await f.restart();
 await assert.rejects(f.service.geometryTile(source,{tile:overview,revision:source.revision+1}),/Geometriekachel inzwischen geändert/);
 assert.deepEqual(f.workDirectories(),[],'a stale request does not initialize derived indexes');
});

test('a first miss after exact hits syncs new author geometry before tile, region, hit, and focus reads',{timeout:30000},async t=>{
 const f=fixture(t,1),old=f.source();
 const initial=await f.service.geometryTile(old,{tile:overview,revision:old.revision});
 assert.equal(initial.cache,'built');
 await f.restart();f.clearIndex();
 const warmSource=f.source(),warm=await f.service.geometryTile(warmSource,{tile:overview,revision:warmSource.revision});
 assert.equal(warm.cache,'hit','the replacement worker takes the first-product path without opening an index');
 assert.deepEqual(f.workDirectories(),[]);
 const current=f.store.atlasRoom(f.token,'r0');
 f.store.atlasDrawingCommit({commandId:randomUUID(),token:f.token,campaignId:f.campaign.id,action:{kind:'shape',roomId:'r0',
  expectedRevision:current.revision,polygons:current.polygons.map(poly=>({...poly,outer:poly.outer.map(point=>({x:point.x+300,y:point.y}))}))}});
 const source=f.source(),tile={lod:0,x:1,y:0},detail=await f.service.geometryTile(source,{tile,revision:source.revision});
 assert.equal(detail.cache,'built','the uncached detail tile is constructed from the changed source');
 assert(detail.model.objects.some(object=>object.target?.kind==='room'&&object.target.id==='r0'),'the moved room appears in its new world tile');

 const query={box:{x:290,y:-10,width:30,height:30},width:128,height:128,scopeId:'local',floorId:'ground',slice:null,roofs:true};
 const region=await f.service.read(source,query);
 assert(region.rooms.some(value=>value.id==='r0'),'full regional geometry sees the committed room after the skipped-reader interval');
 const hit=await f.service.hit(source,query,{x:301.5,y:1.5});
 assert.equal(hit?.id,'r0','hit testing uses the synchronized updated spatial index');
 const focus=await f.service.focus(source,'room','r0');
 assert.equal(focus.id,'r0','focus remains available after the first miss initialized the reader');
});

test('missing source triggers and corrupt durable tiles fall back to canonical rebuilding',{timeout:30000},async t=>{
 const f=fixture(t,5),firstSource=f.source(),first=await f.service.geometryTile(firstSource,{tile:overview,revision:firstSource.revision});
 assert.equal(first.cache,'built');await f.restart();
 const namespace=projectionKey(f.filename,f.campaign.id),cacheFile=join(f.cacheDirectory,'tiles-v2','atlas-tiles.sqlite'),shared=new Database(cacheFile);
 try{
  const row=shared.prepare("SELECT blob FROM atlas_tile_cache WHERE namespace=? AND key=? AND source=? AND kind='tile'").get(namespace,JSON.stringify(['geometry-overview',1,0,0]),'geometry-overview-v3');
  assert(row,'the overview tile was persisted');const blob=Buffer.from(row.blob);blob[blob.length-1]^=0x01;
  shared.prepare("UPDATE atlas_tile_cache SET blob=? WHERE namespace=? AND key=? AND source=? AND kind='tile'").run(blob,namespace,JSON.stringify(['geometry-overview',1,0,0]),'geometry-overview-v3');
 }finally{shared.close();}
 const corruptFallback=await f.service.geometryTile(firstSource,{tile:overview,revision:firstSource.revision});
 assert.equal(corruptFallback.cache,'built','a checksum-invalid tile is discarded and rebuilt');
 assert.equal(corruptFallback.model.overviews[0].modeledObjects,5);
 await f.restart();
 f.store.db.exec('DROP TRIGGER atlas_shape_source_room_update');
 await assert.rejects(f.service.geometryTile(firstSource,{tile:overview,revision:firstSource.revision}),/Atlas inzwischen geändert/,
  'a previously trusted stamp is rejected after trigger integrity is lost');
 await f.restart();
 f.store.db.prepare('UPDATE room SET name=? WHERE campaign_id=? AND id=?').run('untracked update',f.campaign.id,'r0');
 const untracked=f.source();assert.equal(untracked.shapeVersion,undefined,'missing trigger integrity disables durable source stamps');
 const rebuilt=await f.service.geometryTile(untracked,{tile:overview,revision:untracked.revision});
 assert.equal(rebuilt.cache,'disabled','without tracking metadata the durable tile is never trusted');
 assert.equal(rebuilt.model.overviews[0].modeledObjects,5);
});

test('a material channel with missing water topology forces regeneration and returns every channel',{timeout:30000},async t=>{
 const f=fixture(t,2),source=f.source(),first=await f.service.materialTile(source,{tile:terrain,revision:source.revision});
 assert(Object.values(first.cache).every(value=>value==='built'));await f.restart();
 const namespace=projectionKey(f.filename,f.campaign.id),cache=AtlasTileCache.open(f.cacheDirectory,namespace),waterKey=JSON.stringify(['material',terrain.lod,terrain.x,terrain.y,'water']);
 try{
  const water=cache.get(waterKey,'material-tiles-v4-fantasy-cover');assert(water?.waterTopology instanceof Uint16Array);
  delete water.waterTopology;assert.equal(cache.put(waterKey,'material-tiles-v4-fantasy-cover',water),true,'the malformed single-channel entry is stored with a valid outer checksum');
 }finally{cache.close();}
 const repaired=await f.service.materialTile(source,{tile:terrain,revision:source.revision});
 assert.deepEqual(Object.keys(repaired.channels).sort(),[...materialChannels].sort());
 assert(repaired.channels.baseColor instanceof Uint8Array&&repaired.channels.baseColor.length===256*256*4);
 for(const channel of ['water','forest','rock','snow'])assert(repaired.channels[channel] instanceof Uint8Array&&repaired.channels[channel].length===256*256);
 assert.equal(repaired.cache.water,'built','the missing water topology forces its source channel to be rebuilt');
 for(const channel of ['baseColor','forest','rock','snow'])assert.equal(repaired.cache[channel],'hit',`${channel} remains a complete validated channel`);
});

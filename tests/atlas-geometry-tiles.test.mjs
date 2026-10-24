import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {homedir,tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createAtlasCanonicalFixture} from '../tools/atlas-canonical-fixture.mjs';

const require=createRequire(import.meta.url);
const Database=require('better-sqlite3');
buildSync({stdin:{contents:`export * from './src/app/storage/store';export * from './src/app/storage/atlas-region';export * from './src/app/storage/atlas-geometry-tiles';export * from './src/app/terrain-height';export * from './src/app/atlas-geometry-tile';`,resolveDir:process.cwd()},outfile:'.build/atlas-geometry-tiles-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,AtlasRegionReader,AtlasGeometryTiles,heightRecord,atlasGeometryTileModel}=require('../.build/atlas-geometry-tiles-test.cjs');

const ring=(x,y,size=40)=>[{x,y},{x:x+size,y},{x:x+size,y:y+size},{x,y:y+size}];
const room=(id,name,x,y,floorId='ground')=>({id,scopeId:'local',floorId,number:id,name,revision:0,polygons:[{outer:ring(x,y),holes:[]}],sections:[]});
const tile=(x,y=0,lod=0)=>({lod,x,y});
const command=(f,action)=>f.store.executeAtlasCommit({commandId:randomUUID(),campaignId:f.campaign.id,token:f.token,action});
const draw=(f,action)=>f.store.atlasDrawingCommit({commandId:randomUUID(),campaignId:f.campaign.id,token:f.token,action});

function fixture(t){
  const base=homedir()+'/.cache/saltmarcher/tests';mkdirSync(base,{recursive:true});
  const dir=mkdtempSync(base+'/atlas-geometry-tiles-');
  const store=new CampaignStore(dir+'/world.sqlite'),campaign=store.create('Persistent geometry',[
    room('near','Near room',20,20),room('far','Far room',2060,20),room('upper','Upper room',80,20,'upper'),
  ]),token=store.activateShell(campaign.id).token;
  const calls={source:0,height:0,batches:0};let db,reader,tiles,cursor;
  const observe=()=>{
    const geometryTileSource=reader.geometryTileSource.bind(reader),geometryHeight=reader.geometryHeight.bind(reader),geometryBatches=reader.geometryTileSourceBatches.bind(reader);
    reader.geometryTileSource=(...args)=>{calls.source++;return geometryTileSource(...args);};
    reader.geometryTileSourceBatches=(...args)=>{calls.batches++;return geometryBatches(...args);};
    reader.geometryHeight=(...args)=>{calls.height++;return geometryHeight(...args);};
  };
  const reopen=()=>{
    tiles?.close();db?.close();db=new Database(store.filename,{readonly:true});reader=new AtlasRegionReader(db);observe();
    tiles=new AtlasGeometryTiles(dir+'/cache');cursor=undefined;
  };
  reopen();
  t.after(()=>{tiles.close();db.close();store.close();rmSync(dir,{recursive:true,force:true});});
  const read=async(address,overrides={})=>{
    cursor=store.atlasRegionSource(token,cursor);db.exec('BEGIN');
    try{
      await reader.sync(cursor,'core');
      const steps=tiles.read({...cursor,...overrides},{tile:address,revision:cursor.revision},reader);
      for(;;){const step=steps.next();if(step.done){db.exec('COMMIT');return step.value;}db.exec('COMMIT');db.exec('BEGIN');}
    }catch(error){db.exec('ROLLBACK');throw error;}
  };
  return{dir,store,campaign,token,calls,read,reopen,source:()=>store.atlasRegionSource(token,cursor),get reader(){return reader;},get tiles(){return tiles;}};
}

async function canonicalFixture(t){
  const profile=mkdtempSync(join(tmpdir(),'atlas-geometry-canonical-'));
  const canonical=await createAtlasCanonicalFixture({profilePath:profile,campaignName:'Geometry tile composition'});
  const store=new CampaignStore(canonical.filename),token=store.activateShell(canonical.campaignId).token;
  const db=new Database(canonical.filename,{readonly:true}),reader=new AtlasRegionReader(db),tiles=new AtlasGeometryTiles(join(profile,'geometry-cache'));
  let cursor;
  t.after(()=>{tiles.close();db.close();store.close();rmSync(profile,{recursive:true,force:true});});
  const read=async(address)=>{
    cursor=store.atlasRegionSource(token,cursor);db.exec('BEGIN');
    try{
      await reader.sync(cursor,'core');
      const steps=tiles.read({...cursor},{tile:address,revision:cursor.revision},reader);
      for(;;){const step=steps.next();if(step.done){db.exec('COMMIT');return step.value;}db.exec('COMMIT');db.exec('BEGIN');}
    }catch(error){db.exec('ROLLBACK');throw error;}
  };
  return{profile,canonical,store,token,db,reader,tiles,read,source:()=>store.atlasRegionSource(token,cursor)};
}

function positions(result,target='room'){
  const object=result.model.objects.find(entry=>entry.target.kind===target);
  assert.ok(object,`expected ${target} geometry in tile ${result.tile.x}/${result.tile.y}`);
  return object.positions;
}

test('visible geometry retains an offscreen workplane height dependency through restart and edits',async t=>{
  const f=fixture(t),far=1_000_000;
  f.store.db.prepare("UPDATE atlas_binding SET x=?,y=? WHERE campaign_id=? AND kind='dungeon' AND owner_id='local'").run(far,far,f.campaign.id);
  const room=f.store.atlasRoom(f.token,'near');
  draw(f,{kind:'shape',roomId:'near',expectedRevision:room.revision,polygons:[{outer:ring(20-far,20-far),holes:[]}]});
  const height=heightRecord(far-64,far-64,4,new Float32Array(4096).fill(80));
  command(f,{kind:'landscape-put',expectedRevision:null,record:height});
  const exactHeight=async expected=>{
    const value=await f.read(tile(0)),object=value.model.objects.find(o=>o.target.id==='near');
    assert(object,'the displaced room must still be visible in the origin tile');
    for(let i=2;i<object.positions.length;i+=3)assert.equal(object.positions[i]+object.origin.heightM,expected);
    return value;
  };
  await exactHeight(80);
  const overview=await f.read(tile(0,0,4));
  assert.equal(overview.model.overviews[0].modeledObjects,1);
  f.reopen();
  assert.equal((await exactHeight(80)).cache,'hit');
  assert.equal((await f.read(tile(0,0,4))).cache,'hit');
  const revision=f.store.db.prepare('SELECT revision FROM atlas_landscape WHERE campaign_id=? AND id=?').get(f.campaign.id,height.id).revision;
  command(f,{kind:'landscape-put',expectedRevision:revision,record:{...height,height:heightRecord(far-64,far-64,4,new Float32Array(4096).fill(120)).height}});
  assert.equal((await exactHeight(120)).cache,'built','an edit outside the tile changes its remote physical anchor');
  const changed=await f.read(tile(0,0,4));
  assert.equal(changed.cache,'built');assert.notDeepEqual(changed.model.overviews,overview.model.overviews);
  command(f,{kind:'undo'});await exactHeight(80);
  command(f,{kind:'redo'});await exactHeight(120);
});

test('warm reopen avoids source and height reads; local edits rebuild nearby tiles while remote tiles and renames hit',async t=>{
  const f=fixture(t),near=tile(0),far=tile(8);
  const original=await f.read(near),remote=await f.read(far),cold={...f.calls};
  assert.equal(original.cache,'built');assert.equal(remote.cache,'built');assert(cold.source>0);assert(cold.height>0);

  f.reopen();
  const warm=await f.read(near),warmRemote=await f.read(far);
  assert.equal(warm.cache,'hit');assert.equal(warmRemote.cache,'hit');
  assert.deepEqual(f.calls,cold,'warm tiles should not ask the readonly reader for geometry or heights');
  assert.deepEqual(positions(warm),positions(original));

  const before=f.store.atlasRoom(f.token,'near'),edited=[{outer:ring(32,20),holes:[]}];
  draw(f,{kind:'shape',roomId:'near',expectedRevision:before.revision,polygons:edited});
  f.reopen();
  const stillRemote=await f.read(far),changed=await f.read(near);
  assert.equal(stillRemote.cache,'hit','a local shape edit must not rebuild a distant mesh');
  assert.equal(changed.cache,'built');assert.notDeepEqual(positions(changed),positions(original));

  const renamed=f.store.atlasRoom(f.token,'near');
  f.store.atlasRoomCommit({commandId:randomUUID(),token:f.token,campaignId:f.campaign.id,roomId:'near',expectedRevision:renamed.revision,name:'Renamed room',polygons:renamed.polygons,sections:renamed.sections});
  f.reopen();
  const renameHit=await f.read(near);
  assert.equal(renameHit.cache,'hit','names and revision counters do not alter the cached mesh');
  assert.deepEqual(positions(renameHit),positions(changed));
});

test('terrain-only edits keep geometryVersion but refresh sampled heights through Undo and Redo',async t=>{
  const f=fixture(t),near=tile(0),original=await f.read(near),baseSource=f.source();
  const height=heightRecord(0,0,4,new Float32Array(4096).fill(80));
  command(f,{kind:'landscape-put',expectedRevision:null,record:height});
  const editedSource=f.source();
  assert.equal(editedSource.geometryVersion,baseSource.geometryVersion,'terrain changes do not change object geometry identity');
  assert.notEqual(editedSource.shapeVersion,baseSource.shapeVersion);
  f.reopen();
  const raised=await f.read(near);
  assert.equal(raised.cache,'built');assert.notDeepEqual(positions(raised),positions(original));

  command(f,{kind:'undo'});f.reopen();
  const undone=await f.read(near);
  assert.equal(undone.cache,'built');assert.deepEqual(positions(undone),positions(original));

  command(f,{kind:'redo'});f.reopen();
  const redone=await f.read(near);
  assert.equal(redone.cache,'built');assert.deepEqual(positions(redone),positions(raised));
});

test('hidden rooms and floors invalidate geometry membership',async t=>{
  const f=fixture(t),near=tile(0),before=await f.read(near);
  assert(before.model.objects.some(object=>object.target.kind==='room'&&object.target.id==='near'));
  draw(f,{kind:'room-hide',roomId:'near',hidden:true});f.reopen();
  const hiddenRoom=await f.read(near);
  assert.equal(hiddenRoom.cache,'built');assert(!hiddenRoom.model.objects.some(object=>object.target.kind==='room'&&object.target.id==='near'));
  draw(f,{kind:'floor',scopeId:'local',id:'upper',name:'Upper',elevation:0,cloneId:null,hidden:true});f.reopen();
  const hiddenFloor=await f.read(near);
  assert.equal(hiddenFloor.cache,'built');assert(!hiddenFloor.model.objects.some(object=>object.target.kind==='room'&&object.target.id==='upper'));
});

test('hiding an upper floor removes its room while retaining the building shell height',async t=>{
  const f=await canonicalFixture(t),address=tile(0),initial=await f.read(address);
  const building=value=>value.model.objects.find(object=>object.target.kind==='building'&&object.target.id===f.canonical.buildingId);
  const maxZ=object=>Math.max(...Array.from({length:object.positions.length/3},(_,index)=>object.origin.heightM+object.positions[index*3+2]));
  const before=building(initial);
  assert.ok(before,'canonical city building should be clipped into this tile');
  assert(initial.model.objects.some(object=>object.target.kind==='room'&&object.target.id===f.canonical.upperRoomId));
  const roofHeight=maxZ(before);

  f.store.executeDrawing({commandId:randomUUID(),token:f.token,campaignId:f.canonical.campaignId,action:{
    kind:'floor',scopeId:f.canonical.scopeId,id:f.canonical.upperFloorId,name:'Obergeschoss',elevation:4,cloneId:null,hidden:true,
  }});
  const hidden=await f.read(address),after=building(hidden);
  assert.equal(hidden.cache,'built');assert.ok(after);
  assert(!hidden.model.objects.some(object=>object.target.kind==='room'&&object.target.id===f.canonical.upperRoomId));
  assert.equal(maxZ(after),roofHeight,'the hidden floor still contributes to the physical shell top');
});

test('owner bounds keep an upper room outside the building footprint and skip distant floor queries',async t=>{
  const f=await canonicalFixture(t),upper=f.store.atlasRoom(f.token,f.canonical.upperRoomId);
  f.store.executeDrawing({commandId:randomUUID(),token:f.token,campaignId:f.canonical.campaignId,action:{
    kind:'shape',roomId:upper.id,expectedRevision:upper.revision,polygons:[{outer:ring(600,20,5),holes:[]}],
  }});
  const displaced=await f.read(tile(2));
  assert(displaced.model.objects.some(o=>o.target.kind==='room'&&o.target.id===upper.id),
    'all-floor extents must retain rooms beyond both ground-floor and building bounds');
  assert(!displaced.model.objects.some(o=>o.target.kind==='building'),'parent anchor metadata must not invent a remote building');
  let candidates=0;const original=f.reader.candidates.bind(f.reader);
  f.reader.candidates=(...args)=>{candidates++;return original(...args);};
  const empty=await f.read(tile(200));
  assert.equal(empty.model.objects.length,0);assert.equal(candidates,0,'distant owners must be rejected before per-floor candidate queries');
});

test('an externally inserted orphan building binding warns without rebuilding valid meshes',async t=>{
  const f=fixture(t),address=tile(0),before=await f.read(address),sourceBefore=f.source();
  assert(before.model.objects.some(object=>object.target.kind==='room'&&object.target.id==='near'));
  const external=new Database(f.store.filename);
  try{
    external.prepare('INSERT INTO atlas_binding VALUES(?,?,?,?,?,?,?,?,?,?)').run(
      f.campaign.id,randomUUID(),'dungeon','orphan-scope','building','missing-building',300,300,0,0,
    );
  }finally{external.close();}
  const sourceAfter=f.source();
  assert.notEqual(sourceAfter.geometryVersion,sourceBefore.geometryVersion,'geometry source triggers must observe external SQL writes');
  const after=await f.read(address);
  assert.equal(after.cache,'hit','a global coverage warning does not change valid local triangles');
  assert.deepEqual(positions(after),positions(before));
  assert(after.model.objects.some(object=>object.target.kind==='room'&&object.target.id==='near'),'valid room meshes survive a bad unrelated binding');
  assert.equal(after.model.coverage.complete,false);
  assert(after.model.coverage.unsupported.some(item=>item.code==='region-coverage-incomplete'));
});

test('malformed or stale requests reject; shadow and untracked sources bypass persistence',async t=>{
  const f=fixture(t),address=tile(-1,-1),source=f.source();
  assert.throws(()=>f.tiles?.read(source,{tile:{lod:33,x:0,y:0},revision:source.revision},f.reader).next(),/Kachel|prüfen/i);
  assert.throws(()=>f.tiles?.read(source,{tile:address,revision:source.revision+1},f.reader).next(),/inzwischen geändert/);
  const shadow=await f.read(address,{shadow:{filename:'preview.sqlite',scopeId:'local',epoch:randomUUID(),sequence:0}});
  assert.equal(shadow.cache,'disabled');
  const untracked=await f.read(address,{shapeVersion:undefined});
  assert.equal(untracked.cache,'disabled');
  assert.equal((await f.read(address)).cache,'built');
});

const overview=result=>{assert.equal(result.model.objects.length,0);assert.equal(result.model.overviews.length,1);return result.model.overviews[0];};
const overviewBytes=result=>overview(result).meshes.flatMap(m=>[Buffer.from(m.positions.buffer,m.positions.byteOffset,m.positions.byteLength),Buffer.from(m.indices.buffer,m.indices.byteOffset,m.indices.byteLength)]);
test('coarse tiles stream across snapshot boundaries, stay nonsemantic, persist, and invalidate locally',async t=>{
 const f=fixture(t),near=tile(0,0,1),far=tile(4,0,1);
 const before=await f.read(near),remote=await f.read(far),calls={...f.calls};
 assert.equal(before.cache,'built');assert.equal(overview(before).modeledObjects,2);assert(overview(before).meshes.length<=2);
 assert.equal(before.model.coverage.complete,false);assert(before.model.coverage.unsupported.some(x=>x.code==='geometry-overview'));
 assert.equal(atlasGeometryTileModel(before).targets.size,0);
 for(const presentation of [{scopeId:'local',roofs:true},{scopeId:null,roofs:false},{scopeId:null,roofs:true,floorId:'upper'}]){
  const scene=atlasGeometryTileModel(before,presentation);assert.equal(scene.overviews.length,0);assert(scene.coverage.unsupported.some(w=>w.code==='geometry-detail-required'));
 }
 f.reopen();assert.equal((await f.read(near)).cache,'hit');assert.deepEqual(f.calls,calls);
 const room=f.store.atlasRoom(f.token,'near');draw(f,{kind:'shape',roomId:room.id,expectedRevision:room.revision,polygons:[{outer:ring(120,120),holes:[]}]});
 const changed=await f.read(near),unchanged=await f.read(far);
 assert.equal(changed.cache,'built');assert.notDeepEqual(overviewBytes(changed),overviewBytes(before));
 assert.equal(unchanged.cache,'hit');assert.deepEqual(overviewBytes(unchanged),overviewBytes(remote));
 command(f,{kind:'undo'});assert.deepEqual(overviewBytes(await f.read(near)),overviewBytes(before));
 command(f,{kind:'redo'});assert.deepEqual(overviewBytes(await f.read(near)),overviewBytes(changed));
 const renamed=f.store.atlasRoom(f.token,'near');
 f.store.atlasRoomCommit({commandId:randomUUID(),token:f.token,campaignId:f.campaign.id,roomId:'near',expectedRevision:renamed.revision,name:'Overview rename',polygons:renamed.polygons,sections:renamed.sections});
 assert.equal((await f.read(near)).cache,'hit','renaming a room cannot change its overview');
});

test('coarse envelopes follow terrain, hidden membership and preserve physical upper building floors',async t=>{
 const f=await canonicalFixture(t),address=tile(0,0,1),before=await f.read(address);
 const maxZ=result=>Math.max(...overview(result).meshes.flatMap(m=>Array.from(m.positions).filter((_,i)=>i%3===2).map(z=>z+m.origin.heightM)));
 const beforeTop=maxZ(before),beforeCount=overview(before).modeledObjects;
 f.store.executeDrawing({commandId:randomUUID(),token:f.token,campaignId:f.canonical.campaignId,action:{kind:'floor',scopeId:f.canonical.scopeId,id:f.canonical.upperFloorId,name:'Upper',elevation:4,cloneId:null,hidden:true}});
 const hidden=await f.read(address);assert.equal(hidden.cache,'built');assert.equal(maxZ(hidden),beforeTop);
 assert(overview(hidden).modeledObjects<beforeCount,'hidden room disappears but its floor still supports the building height');
 const plain=fixture(t),original=await plain.read(address);
 command(plain,{kind:'landscape-put',expectedRevision:null,record:heightRecord(0,0,4,new Float32Array(4096).fill(80))});
 const raised=await plain.read(address);assert.equal(raised.cache,'built');assert(maxZ(raised)>maxZ(original));
 command(plain,{kind:'undo'});assert.deepEqual(overviewBytes(await plain.read(address)),overviewBytes(original));
});

test('coarse batches never decode unsupported drawing payloads, count them, and keep source pages bounded',async t=>{
 const f=await canonicalFixture(t),shape=f.reader.shape.bind(f.reader);let attempted=0;
 f.reader.shape=row=>{if(row.kind==='element'){attempted++;throw Error('unsupported element decoded');}return shape(row);};
 const result=await f.read(tile(0,0,1));
 assert.equal(attempted,0);assert(overview(result).modeledObjects>0);
 assert(result.model.coverage.unsupported.some(x=>x.code==='drawing-sources-not-modeled'&&/gesamten Kampagne/.test(x.detail)));
 const fine=await f.read(tile(0,0,0));
 assert(fine.model.coverage.unsupported.some(x=>x.code==='drawing-sources-not-modeled'));
 f.store.db.prepare('DELETE FROM drawing_element WHERE campaign_id=?').run(f.canonical.campaignId);
 const removed=await f.read(tile(0,0,1));
 assert.equal(removed.cache,'hit','a warning-count change must not rebuild unchanged room/building meshes');
 assert.deepEqual(overviewBytes(removed),overviewBytes(result));
 assert(!removed.model.coverage.unsupported.some(x=>x.code==='drawing-sources-not-modeled'));
 const fineRemoved=await f.read(tile(0,0,0));
 assert.equal(fineRemoved.cache,'hit');assert.deepEqual(fineRemoved.model.objects,fine.model.objects);
 assert(!fineRemoved.model.coverage.unsupported.some(x=>x.code==='drawing-sources-not-modeled'));
});

test('overview cache refresh preserves city feature warnings independently of drawing-source counts',async t=>{
 const f=await canonicalFixture(t),cityId=f.canonical.cityId,unit={id:'unmodeled-plaza',kind:'plaza',name:'Square',protected:true,outline:ring(40,40,4)};
 const put=value=>{
  const city=f.store.city(f.token,cityId),command={commandId:randomUUID(),campaignId:f.canonical.campaignId,token:f.token,cityId,expectedRevision:city.header.revision,action:{kind:'change',upsert:[value],remove:[],label:'Square name'}};
  f.store.executeAtlasCommit({commandId:command.commandId,campaignId:f.canonical.campaignId,token:f.token,action:{kind:'city',command}});
 };
 put(unit);const first=await f.read(tile(0,0,1));
 const cityWarning=result=>result.model.coverage.unsupported.find(x=>x.code==='scene-feature-kinds-not-modeled'&&/Stadtlinien und Stadtflächen/.test(x.detail));
 assert(cityWarning(first));
 put({...unit,name:'Renamed square'});const renamed=await f.read(tile(0,0,1));
 assert.equal(renamed.cache,'hit');assert.deepEqual(overviewBytes(renamed),overviewBytes(first));assert.deepEqual(cityWarning(renamed),cityWarning(first));
 f.store.db.prepare('DELETE FROM drawing_element WHERE campaign_id=?').run(f.canonical.campaignId);
 const removed=await f.read(tile(0,0,1));assert.equal(removed.cache,'hit');assert.deepEqual(cityWarning(removed),cityWarning(first));
 assert(!removed.model.coverage.unsupported.some(x=>x.code==='drawing-sources-not-modeled'));
});

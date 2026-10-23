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
buildSync({stdin:{contents:`export * from './src/app/storage/store';export * from './src/app/storage/atlas-region';export * from './src/app/storage/atlas-geometry-tiles';export * from './src/app/terrain-height';`,resolveDir:process.cwd()},outfile:'.build/atlas-geometry-tiles-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,AtlasRegionReader,AtlasGeometryTiles,heightRecord}=require('../.build/atlas-geometry-tiles-test.cjs');

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
  const calls={source:0,height:0};let db,reader,tiles,cursor;
  const observe=()=>{
    const geometryTileSource=reader.geometryTileSource.bind(reader),geometryHeight=reader.geometryHeight.bind(reader);
    reader.geometryTileSource=(...args)=>{calls.source++;return geometryTileSource(...args);};
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
      await reader.sync(cursor);
      const steps=tiles.read({...cursor,...overrides},{tile:address,revision:cursor.revision},reader);
      for(;;){const step=steps.next();if(step.done){db.exec('COMMIT');return step.value;}}
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
      await reader.sync(cursor);
      const steps=tiles.read({...cursor},{tile:address,revision:cursor.revision},reader);
      for(;;){const step=steps.next();if(step.done){db.exec('COMMIT');return step.value;}}
    }catch(error){db.exec('ROLLBACK');throw error;}
  };
  return{profile,canonical,store,token,db,reader,tiles,read,source:()=>store.atlasRegionSource(token,cursor)};
}

function positions(result,target='room'){
  const object=result.model.objects.find(entry=>entry.target.kind===target);
  assert.ok(object,`expected ${target} geometry in tile ${result.tile.x}/${result.tile.y}`);
  return object.positions;
}

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

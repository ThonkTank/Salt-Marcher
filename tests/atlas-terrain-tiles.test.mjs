import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url),Database=require('better-sqlite3');
buildSync({stdin:{contents:`export {vegetationSpec} from './src/app/vegetation';export {emptyRecord} from './src/app/atlas-landscape';export * from './src/app/storage/store';export * from './src/app/storage/atlas-region';export * from './src/app/storage/atlas-terrain-tiles';export * from './src/app/storage/atlas-tile-cache';export * from './src/app/terrain-height';export * from './src/app/landscape-raster';export * from './src/app/atlas-terrain-tile';export * from './src/app/storage/atlas-projection-index';`,resolveDir:process.cwd()},outfile:'.build/atlas-terrain-tiles-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,AtlasRegionReader,AtlasTerrainTiles,AtlasTileCache,heightRecord,vegetationSpec,emptyRecord,LandscapeRasterizer,atlasTerrainTileQuery,projectionKey,eraseAtlasProjection}=require('../.build/atlas-terrain-tiles-test.cjs');
function fixture(t){
  const base=homedir()+'/.cache/saltmarcher/tests';mkdirSync(base,{recursive:true});const dir=mkdtempSync(base+'/atlas-tiles-');
  const store=new CampaignStore(dir+'/world.sqlite'),campaign=store.create('Persistent tiles'),token=store.activateShell(campaign.id).token;
  const write=action=>store.executeAtlasCommit({commandId:randomUUID(),campaignId:campaign.id,token,action});
  let db,reader,tiles,cursor;
  const reopen=()=>{tiles?.close();db?.close();db=new Database(store.filename,{readonly:true});reader=new AtlasRegionReader(db);tiles=new AtlasTerrainTiles(db,dir+'/cache');cursor=undefined;};reopen();
  t.after(()=>{tiles.close();db.close();store.close();rmSync(dir,{recursive:true,force:true});});
  const read=async(tile,overrides={})=>{
    cursor=store.atlasRegionSource(token,cursor);db.exec('BEGIN');
    try{await reader.sync(cursor,false);const steps=tiles.read({...cursor,...overrides},{tile,revision:cursor.revision},reader);
      for(;;){const step=steps.next();if(step.done){db.exec('COMMIT');return step.value;}}
    }catch(e){db.exec('ROLLBACK');throw e;}
  };
  return {dir,store,campaign,token,write,read,reopen,revision:id=>db.prepare('SELECT revision FROM atlas_landscape WHERE campaign_id=? AND id=?').get(campaign.id,id)?.revision??null};
}
test('warm reopen reuses binary products; local edits rebuild affected leaf and parent only; Undo restores pixels',async t=>{
  const f=fixture(t),near={lod:0,x:0,y:0},far={lod:0,x:8,y:0},parent={lod:2,x:0,y:0};
  const first=heightRecord(0,0,4,new Float32Array(4096).fill(100));
  f.write({kind:'landscape-batch',records:[first,heightRecord(2048,0,4,new Float32Array(4096).fill(50))].map(record=>({expectedRevision:null,record}))});
  let finishes=0;const finish=LandscapeRasterizer.prototype.finish;
  LandscapeRasterizer.prototype.finish=function(...args){finishes++;return finish.apply(this,args);};
  t.after(()=>{LandscapeRasterizer.prototype.finish=finish;});
  const original=await f.read(near),remote=await f.read(far),coarse=await f.read(parent),cold=finishes;
  assert.equal(original.cache,'built');assert.equal(coarse.cache,'built');assert(cold>0);
  f.reopen();const warm=await f.read(near);assert.equal(warm.cache,'hit');assert.equal(finishes,cold);
  assert.deepEqual(warm.projection.grid.heights,original.projection.grid.heights);assert.deepEqual(warm.projection.pixels,original.projection.pixels);
  const changed=heightRecord(0,0,4,new Float32Array(4096).fill(180));
  f.write({kind:'landscape-put',expectedRevision:f.revision(first.id),record:changed});
  f.reopen();const farAgain=await f.read(far);assert.equal(farAgain.cache,'hit');assert.equal(finishes,cold,'remote terrain must not rasterize after reopen');assert.deepEqual(farAgain.projection.pixels,remote.projection.pixels);
  const updated=await f.read(near),updatedParent=await f.read(parent);
  assert.equal(updated.cache,'built');assert.equal(updatedParent.cache,'built');assert.notDeepEqual(updated.projection.grid.heights,original.projection.grid.heights);
  f.write({kind:'undo'});f.reopen();const undone=await f.read(near);
  assert.deepEqual(undone.projection.pixels,original.projection.pixels);assert.deepEqual(undone.projection.grid.heights,original.projection.grid.heights);
  assert.equal((await f.read(far)).cache,'hit');
  f.write({kind:'redo'});const redone=await f.read(near);assert.deepEqual(redone.projection.grid.heights,updated.projection.grid.heights);
  t.diagnostic(JSON.stringify({coldRasterCalls:cold,totalRasterCalls:finishes,cacheFileNamespace:projectionKey(f.store.filename,f.campaign.id)}));
});

test('untracked or shadow sources never publish; malformed request and stale revision reject',async t=>{
  const f=fixture(t),tile={lod:0,x:-1,y:-1};
  assert.equal((await f.read(tile,{shapeVersion:undefined})).cache,'disabled');
  assert.equal((await f.read(tile,{shadow:{filename:'isolated-preview',scopeId:'local',epoch:'preview',sequence:0}})).cache,'disabled');
  await assert.rejects(f.read(tile,{revision:-1}),/inzwischen geändert/);
  assert.equal((await f.read(tile)).cache,'built');
  for(const request of [{tile:{...tile,lod:33},revision:0},{tile:{...tile,x:1.5},revision:0},{tile,revision:-1},{tile,revision:0,contours:NaN},{tile,revision:0,authorHeights:[1]}])assert.throws(()=>atlasTerrainTileQuery(request));
});

test('campaign erasure removes only its shared tile namespace and leaves canonical bytes unchanged',async t=>{
  const f=fixture(t);await f.read({lod:0,x:0,y:0});f.reopen();
  const key=projectionKey(f.store.filename,f.campaign.id),other='d'.repeat(64),directory=f.dir+'/cache';
  const owned=AtlasTileCache.open(directory,key),unrelated=AtlasTileCache.open(directory,other);
  assert(owned.put('terrain','s',{heights:new Float32Array([1,2])}));assert(unrelated.put('terrain','s',{heights:new Float32Array([7,8])}));owned.close();unrelated.close();
  const before=createHash('sha256').update(readFileSync(f.store.filename)).digest('hex');
  await eraseAtlasProjection(directory,f.store.filename,f.campaign.id);
  const after=createHash('sha256').update(readFileSync(f.store.filename)).digest('hex');assert.equal(after,before);
  const checkOwned=AtlasTileCache.open(directory,key),checkOther=AtlasTileCache.open(directory,other);
  assert.equal(checkOwned.get('terrain','s'),undefined);assert.deepEqual([...checkOther.get('terrain','s').heights],[7,8]);checkOwned.close();checkOther.close();
});


test('rendered colour and forest coverage persist together and global sea settings invalidate distant tiles',async t=>{
  const f=fixture(t),near={lod:0,x:0,y:0},far={lod:0,x:8,y:0};
  const original=await f.read(near);await f.read(far);
  f.write({kind:'landscape-put',expectedRevision:null,record:heightRecord(0,0,4,new Float32Array(4096).fill(50))});
  const woods={...emptyRecord('vegetation'),id:'tile-woods',vegetation:vegetationSpec(),values:{terrain:'forest'},polygons:[{outer:[{x:4,y:4},{x:240,y:4},{x:240,y:240},{x:4,y:240}],holes:[]}]};
  f.write({kind:'landscape-put',expectedRevision:null,record:woods});
  const changed=await f.read(near);assert.equal(changed.cache,'built');assert.notDeepEqual(changed.projection.pixels,original.projection.pixels);
  assert(changed.projection.forest.some(v=>v>0));f.reopen();const warm=await f.read(near);
  assert.equal(warm.cache,'hit');assert.deepEqual(warm.projection.forest,changed.projection.forest);
  assert.equal((await f.read(far)).cache,'hit');
  f.write({kind:'landscape-sea-level',seaLevelM:200});f.reopen();
  const drowned=await f.read(far);assert.equal(drowned.cache,'built');assert(drowned.projection.grid.heights.every(v=>v>=200));
  f.write({kind:'undo'});assert.deepEqual((await f.read(near)).projection.forest,changed.projection.forest);
});

test('an edit across a tile boundary refreshes both halos with identical shared height nodes',async t=>{
  const f=fixture(t),left={lod:0,x:0,y:0},right={lod:0,x:1,y:0};
  const a=heightRecord(0,0,4,new Float32Array(4096).fill(40)),b=heightRecord(256,0,4,new Float32Array(4096).fill(40));
  f.write({kind:'landscape-batch',records:[a,b].map(record=>({expectedRevision:null,record}))});
  const before=await f.read(left);await f.read(right);
  f.write({kind:'landscape-put',expectedRevision:f.revision(b.id),record:heightRecord(256,0,4,new Float32Array(4096).fill(80))});f.reopen();
  const l=await f.read(left),r=await f.read(right);assert.equal(l.cache,'built');assert.equal(r.cache,'built');
  assert.notDeepEqual(l.projection.grid.heights,before.projection.grid.heights);
  const n=l.projection.grid.view.columns;
  for(let y=0;y<n;y++)assert.equal(l.projection.grid.heights[y*n+n-1],r.projection.grid.heights[y*n]);
  f.reopen();assert.equal((await f.read(left)).cache,'hit');assert.equal((await f.read(right)).cache,'hit');
});

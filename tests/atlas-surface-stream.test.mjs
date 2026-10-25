import {emptyMaterialChannels} from './helpers/atlas-material-channels.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
buildSync({entryPoints:['src/app/atlas-surface-tile-stream.ts'],outfile:'.build/atlas-surface-stream-test.mjs',bundle:true,platform:'node',format:'esm'});
const {AtlasSurfaceTileStream,atlasSurfaceTileFetcher}=await import('../.build/atlas-surface-stream-test.mjs');
const input={box:{x:0,y:0,width:256,height:256},metersPerPixel:1,revision:2,source:'fence'};
function pair(q){
 const identity={tile:q.tile,revision:q.revision,fence:'fence'};
 return {...identity,terrain:{...identity,projection:{heightOnly:true,fence:'fence',revision:q.revision,grid:{view:{columns:65,rows:65},heights:new Float32Array(65*65)}}},
  material:{...identity,width:256,height:256,channels:emptyMaterialChannels(256*256)}};
}
test('prefetch follows visible completion and retained products stay within both budgets while panning',async()=>{
 const stream=new AtlasSurfaceTileStream({maxTiles:8,maxRetainedTiles:16,maxBytes:16*1024*1024});
 for(let pan=0;pan<12;pan++){
  const box={x:pan*256,y:0,width:512,height:256},calls=[];let completeAt=-1;
  await stream.load({...input,box,preload:{x:box.x-4096,y:-4096,width:8192,height:8192}},async q=>{calls.push(q.tile);return pair(q);},frame=>{if(frame.complete){completeAt=calls.length;assert(frame.tiles.every(t=>t.tile.lod===0));}});
  assert(completeAt>=0);assert(calls.slice(completeAt).every(t=>t.lod>=2));
  assert(stream.statistics.tiles<=16);assert(stream.statistics.bytes<=16*1024*1024);
 }
 stream.dispose();assert.equal(stream.statistics.bytes,0);
});
test('a surface publishes and caches height/material together, rejecting mixed sources',async()=>{
 for(const corrupt of [p=>p.terrain.revision++,p=>p.material.tile={...p.tile,x:8},p=>p.material.fence='other',p=>p.terrain.projection.heightOnly=false]){
  const stream=new AtlasSurfaceTileStream(),frames=[];
  await assert.rejects(stream.load(input,async q=>{const p=pair(q);corrupt(p);return p;},f=>frames.push(f)),/vollständige Kacheln/);
  assert(frames.every(f=>f.tiles.length===0));stream.dispose();
 }
 const stream=new AtlasSurfaceTileStream(),frames=[];let calls=0;
 await stream.load(input,async q=>{calls++;assert.equal(q.product,'height');return pair(q);},f=>frames.push(f));
 assert.equal(calls,2);assert.equal(frames.at(-1).complete,true);assert.equal(frames.at(-1).tiles[0].tile.lod,0);
 await stream.load(input,async()=>{throw Error('warm read');},()=>{});stream.dispose();
});
test('preload adapter cancels only its current read and never starts material after an aborted height',async()=>{
 let release;const height=new Promise(r=>release=r),calls=[];
 const api={atlasTerrainTile:async(token,q,control)=>{calls.push(['height',token,q,control]);return height;},
  atlasMaterialTile:async()=>{throw Error('Material must not start');},atlasCancelRead:async(token,control)=>{calls.push(['cancel',token,control]);return {ok:true};}};
 const fetch=atlasSurfaceTileFetcher(api,'campaign-token','surface-owner'),controller=new AbortController();
 const job=fetch({tile:{lod:0,x:0,y:0},revision:2},controller.signal);
 controller.abort();release({ok:true,value:{}});await assert.rejects(job,{name:'AbortError'});
 assert.equal(calls.length,2);assert.deepEqual(calls[1],['cancel','campaign-token',calls[0][3]]);assert.equal(calls[0][2].product,'height');
});
test('20 superseded paired loads launch only the blocked old request and final source',async()=>{
 let release;const gate=new Promise(r=>release=r),stream=new AtlasSurfaceTileStream(),calls=[],frames=[];
 const fetch=async(q,signal)=>{calls.push({q,signal});if(calls.length===1)await gate;return pair(q);};
 const first=stream.load(input,fetch,()=>{});await new Promise(r=>setImmediate(r));
 const jobs=Array.from({length:20},(_,n)=>stream.load({...input,box:{...input.box,x:(n+1)*256}},fetch,f=>frames.push(f)));
 assert.equal(calls.length,1);assert.equal(calls[0].signal.aborted,true);release();await Promise.all([first,...jobs]);
 assert.equal(calls.length,3);assert.equal(frames.at(-1).complete,true);assert.equal(frames.at(-1).tiles[0].tile.x,20);stream.dispose();
});

test('recreated fetch adapters never reuse a job identity addressed by an old cancellation',async()=>{
 const controls=[];const api={atlasTerrainTile:async(_token,_q,c)=>{controls.push(c);return{ok:false,error:'stopped'};},atlasMaterialTile:async()=>{throw Error('not reached');},atlasCancelRead:async()=>({ok:true})};
 for(let i=0;i<2;i++)await assert.rejects(atlasSurfaceTileFetcher(api,'same-token','same-owner')({tile:{lod:0,x:0,y:0},revision:0},new AbortController().signal),/stopped/);
 assert.notEqual(controls[0].id,controls[1].id);assert.equal(controls[0].owner,controls[1].owner);
});

test('partial cold parents are visible but only complete coarse coverage is usable',async()=>{
 const stream=new AtlasSurfaceTileStream(),frames=[];
 await stream.load({...input,box:{x:-128,y:-128,width:256,height:256}},async q=>pair(q),f=>frames.push(f));
 const partial=frames.find(f=>f.tiles.length>0&&!f.overviewComplete);assert(partial);
 const firstUsable=frames.find(f=>f.overviewComplete);assert(firstUsable);assert.equal(firstUsable.complete,false);
 assert.equal(firstUsable.tiles.length,4);assert(firstUsable.tiles.every(p=>p.tile.lod===firstUsable.tiles[0].tile.lod));assert(firstUsable.tiles[0].tile.lod>frames.at(-1).tiles[0].tile.lod);
 assert(frames.at(-1).complete&&frames.at(-1).overviewComplete);stream.dispose();
});

test('optional prefetch failure preserves the fully published viewport without another read',async()=>{
 const stream=new AtlasSurfaceTileStream({maxTiles:32,maxRetainedTiles:64,maxBytes:64*1024*1024}),frames=[];
 let complete=false,optionalReads=0;
 await stream.load({...input,preload:{x:-1024,y:-1024,width:4096,height:4096}},async q=>{
  if(complete){optionalReads++;throw Error('Main is closing');}return pair(q);
 },frame=>{frames.push(frame);complete ||= frame.complete;});
 assert.equal(optionalReads,1);assert(frames.at(-1).complete);assert(frames.at(-1).tiles.length>0);
 stream.dispose();
});

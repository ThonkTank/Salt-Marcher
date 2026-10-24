import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
buildSync({entryPoints:['src/app/atlas-surface-tile-stream.ts'],outfile:'.build/atlas-surface-stream-test.mjs',bundle:true,platform:'node',format:'esm'});
const {AtlasSurfaceTileStream,atlasSurfaceTileFetcher}=await import('../.build/atlas-surface-stream-test.mjs');
const input={box:{x:0,y:0,width:256,height:256},metersPerPixel:1,revision:2,source:'fence'};
function pair(q){
 const identity={tile:q.tile,revision:q.revision,fence:'fence'};
 return {...identity,terrain:{...identity,projection:{heightOnly:true,fence:'fence',revision:q.revision,grid:{view:{columns:65,rows:65},heights:new Float32Array(65*65)}}},
  material:{...identity,width:256,height:256,channels:Object.fromEntries(['baseColor','water','forest','rock','snow'].map(c=>[c,new Uint8Array(256*256*(c==='baseColor'?4:1))]))}};
}
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

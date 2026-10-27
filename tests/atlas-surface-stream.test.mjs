import {emptyMaterialChannels} from './helpers/atlas-material-channels.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
buildSync({entryPoints:['src/app/atlas-surface-tile-stream.ts'],outfile:'.build/atlas-surface-stream-test.mjs',bundle:true,platform:'node',format:'esm'});
const {AtlasSurfaceTileStream,atlasSurfaceTileFetcher}=await import('../.build/atlas-surface-stream-test.mjs');
const input={box:{x:0,y:0,width:256,height:256},metersPerPixel:1,revision:2,source:'fence'};
function pair(q){
 const identity={tile:q.tile,revision:q.revision,fence:'fence'};
 const size=256*2**q.tile.lod,box={x:q.tile.x*size,y:q.tile.y*size,width:size,height:size};
 const view={box,frame:box,columns:65,rows:65,focusM:0,tilt:0,rotation:0,exaggeration:1};
 const grid={view,heights:new Float32Array(65*65),seaLevelM:0,editing:{ground:new Float32Array(65*65),water:new Float32Array(65*65)}};
 return {...identity,terrain:{...identity,projection:{heightOnly:true,fence:'fence',source:'fence',revision:q.revision,generation:0,draft:false,grid,width:0,height:0,pixels:new Uint8Array()}},
  material:{...identity,width:256,height:256,channels:emptyMaterialChannels(256*256)}};
}
test('prefetch follows visible completion and retained products stay within both budgets while panning',async()=>{
 const stream=new AtlasSurfaceTileStream({coverageLod:undefined,maxTiles:8,maxRetainedTiles:16,maxBytes:16*1024*1024});
 for(let pan=0;pan<12;pan++){
  const box={x:pan*256,y:0,width:512,height:256},calls=[];let completeAt=-1;
  await stream.load({...input,box,preload:{x:box.x-4096,y:-4096,width:8192,height:8192}},async q=>{calls.push(q.tile);return pair(q);},frame=>{if(frame.complete){completeAt=calls.length;assert(frame.tiles.every(t=>t.tile.lod===0));}});
  assert(completeAt>=0);assert(calls.slice(completeAt).every(t=>t.lod>=2));
  assert(stream.statistics.tiles<=16);assert(stream.statistics.bytes<=16*1024*1024);
 }
 stream.dispose();assert.equal(stream.statistics.bytes,0);
});
test('a surface publishes and caches height/material together, rejecting mixed sources',async()=>{
 for(const corrupt of [p=>p.terrain.revision++,p=>p.material.tile={...p.tile,x:8},p=>p.material.fence='other',p=>p.terrain.projection.heightOnly=false,
  p=>{p.terrain.projection.grid.view.refinement={x:32,y:32,width:32,height:32};},
  p=>{p.terrain.projection.grid.view.box.x++;},
  p=>{p.terrain.projection.grid.editing.water[0]=Infinity;}]){
  const stream=new AtlasSurfaceTileStream({coverageLod:undefined}),frames=[];
  await assert.rejects(stream.load(input,async q=>{const p=pair(q);corrupt(p);return p;},f=>frames.push(f)),/vollständige Kacheln|Atlas-Terrainquelle ungültig/);
  assert(frames.every(f=>f.tiles.length===0));stream.dispose();
 }
 const stream=new AtlasSurfaceTileStream({coverageLod:undefined}),frames=[];let calls=0;
 await stream.load(input,async q=>{calls++;assert.equal(q.product,'height');return pair(q);},f=>frames.push(f));
 assert.equal(calls,2);assert.equal(frames.at(-1).complete,true);assert.equal(frames.at(-1).tiles[0].tile.lod,0);
 await stream.load(input,async()=>{throw Error('warm read');},()=>{});stream.dispose();
});
test('the D2 zoom-out pair keeps fine and coarse uniform sources with shared coverage roots',async()=>{
 const stream=new AtlasSurfaceTileStream(),frames=[];
 const world={...input,box:{x:0,y:0,width:512,height:512},metersPerPixel:.5};
 await stream.load(world,async q=>pair(q),f=>frames.push(f));
 const old=frames.at(-1);assert.equal(old.complete,true);
 assert.equal(old.tiles.filter(t=>t.tile.lod===-1).length,16);
 const oldRoots=old.tiles.filter(t=>t.tile.lod===20);assert.equal(oldRoots.length,4);
 await stream.load({...world,metersPerPixel:1},async q=>pair(q),f=>frames.push(f));
 const fresh=frames.at(-1);assert.equal(fresh.complete,true);
 assert.equal(fresh.tiles.filter(t=>t.tile.lod===0).length,4);
 assert.equal(fresh.tiles.filter(t=>t.tile.lod===20).length,4);
 assert(oldRoots.every(root=>fresh.tiles.includes(root)));
 stream.dispose();
});

test('resident detail never falls back to coarse overview on camera movement or a return visit',async()=>{
 const stream=new AtlasSurfaceTileStream({coverageLod:undefined,maxRetainedTiles:64,maxBytes:64*1024*1024}),frames=[];
 await stream.load(input,async q=>pair(q),()=>{});
 await stream.load({...input,box:{x:32,y:32,width:128,height:128}},async()=>{throw Error('A resident view must not fetch');},f=>frames.push(f));
 const usable=frames.filter(f=>f.overviewComplete);assert(usable.length>0);assert(usable.every(f=>f.tiles.every(t=>t.tile.lod===0)),'A warm camera update must never publish its coarse parent');
 assert.equal(usable.at(-1).complete,true);
 stream.dispose();assert.equal(stream.statistics.bytes,0);assert.equal(stream.statistics.tiles,0);
});

test('surface world coverage survives a blocked zoom-out read within the existing total tile and byte budgets',async()=>{
 const stream=new AtlasSurfaceTileStream({maxTiles:32,maxRetainedTiles:64,maxBytes:64*1024*1024}),frames=[];
 await stream.load({...input,box:{x:-10,y:-10,width:20,height:20},metersPerPixel:.02},async q=>pair(q),()=>{});
 let release;const gate=new Promise(r=>release=r);
 const job=stream.load({...input,box:{x:-500000,y:-500000,width:1000000,height:1000000},metersPerPixel:1000},async q=>{await gate;return pair(q);},f=>frames.push(f));
 await new Promise(r=>setImmediate(r));
 const retained=frames.find(f=>f.overviewComplete);assert(retained,'Resident world coverage is published before any new read completes');
 for(const [x,y]of [[-500000,-500000],[499999,499999],[0,0]])assert(retained.tiles.some(t=>{const size=256*2**t.tile.lod;return x>=t.tile.x*size&&x<=(t.tile.x+1)*size&&y>=t.tile.y*size&&y<=(t.tile.y+1)*size;}));
 release();await job;assert(frames.every(f=>f.tiles.length<=32));assert(stream.statistics.tiles<=64);assert(stream.statistics.bytes<=64*1024*1024);
 stream.dispose();assert.equal(stream.statistics.bytes,0);assert.equal(stream.statistics.tiles,0);
});
test('multiscale ancestor publications account every displayed source within the existing allocation',async()=>{
 const stream=new AtlasSurfaceTileStream({maxTiles:32,maxRetainedTiles:64,maxBytes:64*1024*1024});let publications=0;
 for(const width of [40000000,1000000,10000,1000,20,1000,10000,1000000,40000000]){
  const focus={x:-width/2-1e-6,y:-width*.3161764705882353-1e-6,width,height:width*.6323529411764706},box={x:-3*width-1e-6,y:-3*width-1e-6,width:6*width,height:6*width};
  await stream.load({...input,box,focus,metersPerPixel:width/1632},async q=>pair(q),frame=>{publications++;assert(frame.tiles.length<=32);assert.equal(stream.statistics.visible,frame.tiles.length,'Every published ancestor belongs to the displayed allocation');assert(stream.statistics.tiles<=64);assert(stream.statistics.bytes<=64*1024*1024);});
 }
 assert(publications>20);stream.dispose();assert.equal(stream.statistics.bytes,0);
});
test('continuous zoom with permanent roots publishes the first ready close source before supersession',async()=>{
 const stream=new AtlasSurfaceTileStream({maxTiles:32,maxRetainedTiles:64,maxBytes:64*1024*1024}),jobs=[];
 const view=width=>({...input,box:{x:-3*width-1e-6,y:-3*width-1e-6,width:6*width,height:6*width},focus:{x:-width/2-1e-6,y:-width*.3161764705882353-1e-6,width,height:width*.6323529411764706},metersPerPixel:width/1632});
 await stream.load(view(40000000),async q=>pair(q),()=>{});
 let finalFrames=[];
 for(const width of [1000000,10000,1000,20]){
  let calls=0,second;const started=new Promise(resolve=>{second=resolve;}),frames=[];
  const job=stream.load(view(width),async(q,signal)=>{calls++;if(calls===1)return pair(q);second();await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));return pair(q);},f=>frames.push(f));jobs.push(job);
  await started;assert(frames.some(f=>f.tiles.some(t=>t.tile.lod<15)),`width ${width} must publish close detail before another wheel generation`);finalFrames=frames;
 }
 assert(finalFrames.some(f=>f.tiles.some(t=>t.tile.lod<=-4)),'the uninterrupted 20 m frame retains an actually close source');
 stream.cancel();await Promise.all(jobs);stream.dispose();
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
 let release;const gate=new Promise(r=>release=r),stream=new AtlasSurfaceTileStream({coverageLod:undefined}),calls=[],frames=[];
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
 const stream=new AtlasSurfaceTileStream({coverageLod:undefined}),frames=[];
 await stream.load({...input,box:{x:-128,y:-128,width:256,height:256}},async q=>pair(q),f=>frames.push(f));
 const partial=frames.find(f=>f.tiles.length>0&&!f.overviewComplete);assert(partial);
 const firstUsable=frames.find(f=>f.overviewComplete);assert(firstUsable);assert.equal(firstUsable.complete,false);
 assert.equal(firstUsable.tiles.length,4);assert(firstUsable.tiles.every(p=>p.tile.lod===firstUsable.tiles[0].tile.lod));assert(firstUsable.tiles[0].tile.lod>frames.at(-1).tiles[0].tile.lod);
 assert(frames.at(-1).complete&&frames.at(-1).overviewComplete);stream.dispose();
});

test('optional prefetch failure preserves the fully published viewport without another read',async()=>{
 const stream=new AtlasSurfaceTileStream({coverageLod:undefined,maxTiles:32,maxRetainedTiles:64,maxBytes:64*1024*1024}),frames=[];
 let complete=false,optionalReads=0;
 await stream.load({...input,preload:{x:-1024,y:-1024,width:4096,height:4096}},async q=>{
  if(complete){optionalReads++;throw Error('Main is closing');}return pair(q);
 },frame=>{frames.push(frame);complete ||= frame.complete;});
 assert.equal(optionalReads,1);assert(frames.at(-1).complete);assert(frames.at(-1).tiles.length>0);
 stream.dispose();
});

for(const consumer of ['view','export'])test(`paired fetcher forwards ${consumer} ownership through both reads and cancellation`,async()=>{
 const calls=[],controller=new AbortController(),q={tile:{lod:0,x:0,y:0},revision:2},product=pair(q);
 const api={atlasTerrainTile:async(token,request,control,owner)=>{calls.push(['height',owner,control]);return{ok:true,value:product.terrain};},
  atlasMaterialTile:async(token,request,control,owner)=>{calls.push(['material',owner,control]);controller.abort();return{ok:true,value:product.material};},
  atlasCancelRead:async(token,control,owner)=>{calls.push(['cancel',owner,control]);return{ok:true};}};
 const fetch=consumer==='view'?atlasSurfaceTileFetcher(api,'token','owner'):atlasSurfaceTileFetcher(api,'token','owner',consumer);
 await assert.rejects(fetch(q,controller.signal),{name:'AbortError'});
 assert.deepEqual(calls.map(c=>c.slice(0,2)),[['height',consumer],['material',consumer],['cancel',consumer]]);
 assert.deepEqual(calls.map(c=>c[2]),[calls[0][2],calls[0][2],calls[0][2]]);
});

// Preparing a close view alone is not evidence of a resident return path. Keep
// the same scale traversal and enforce both budgets after every publication.
test('returning to world scale retains the finest anchor sources ahead of redundant intermediate levels',async()=>{
 const stream=new AtlasSurfaceTileStream({maxTiles:32,maxRetainedTiles:64,maxBytes:64*1024*1024});
 const view=width=>({...input,box:{x:-3*width-1e-6,y:-3*width-1e-6,width:6*width,height:6*width},focus:{x:-width/2-1e-6,y:-width*.3161764705882353-1e-6,width,height:width*.6323529411764706},metersPerPixel:width/1632});
 const fetch=async q=>{const p=pair(q);delete p.material.channels.rock;delete p.material.channels.snow;return p;};
 const publish=f=>{assert(f.tiles.length<=32);assert(stream.statistics.tiles<=64);assert(stream.statistics.bytes<=64*1024*1024);};
 for(const width of [40000000,1000000,10000,1000,20])await stream.load(view(width),fetch,publish);
 const finest=Math.min(...stream.availableTiles.map(t=>t.tile.lod));
 const anchor=stream.availableTiles.filter(t=>t.tile.lod===finest&&[-1,0].includes(t.tile.x)&&[-1,0].includes(t.tile.y));assert.equal(anchor.length,4);
 for(let width=20*Math.exp(1);width<40000000;width*=Math.exp(1))await stream.load(view(width),fetch,publish);
 await stream.load(view(40000000),fetch,publish);
 assert.equal(stream.availableTiles.filter(t=>anchor.some(a=>JSON.stringify(a.tile)===JSON.stringify(t.tile))).length,4,'Finest anchor sources must survive the return, within unchanged budgets');
 let release;const gate=new Promise(r=>release=r),frames=[];
 const job=stream.load(view(20),async q=>{await gate;return fetch(q);},f=>{publish(f);frames.push(f);});
 await new Promise(r=>setImmediate(r));
 assert(frames.some(f=>f.tiles.some(t=>t.tile.lod===finest)),'Resident fine sources are published before cold reads finish');
 release();await job;stream.dispose();assert.equal(stream.statistics.bytes,0);
});

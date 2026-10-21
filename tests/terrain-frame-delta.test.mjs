import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
buildSync({stdin:{contents:"export * from './src/app/terrain-frame';export * from './src/app/terrain-cache';",resolveDir:process.cwd()},outfile:'.build/terrain-frame-delta-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {terrainFrameDelta,applyTerrainFrame,TerrainCache}=createRequire(import.meta.url)('../.build/terrain-frame-delta-test.cjs');
const identity=revision=>({revision,fence:'f'+revision,key:'view'});
function tilted(revision){
 const box={x:-100,y:-50,width:200,height:100};
 return {kind:'full',view:'tilted',target:identity(revision),invalidation:{reset:false,bounds:[]},projection:{
  revision,fence:'f'+revision,generation:0,source:'source',draft:false,width:256,height:128,pixels:new Uint8Array(256*128*4),
  grid:{view:{box,frame:box,rows:65,columns:65,focusM:0,tilt:45,rotation:0,exaggeration:2},heights:new Float32Array(65*65),seaLevelM:0},objects:[],routes:[],
 }};
}
test('partial projection reconstructs a full answer byte for byte without mutating frozen source arrays',()=>{
 const before=tilted(1),after=tilted(2);after.projection.grid.heights[32*65+40]=177;after.projection.pixels[73*256*4+201*4]=99;
 const delta=terrainFrameDelta(before,after,before.target);assert.equal(delta.kind,'delta');assert.equal(delta.heights.length,1);assert.equal(delta.pixels.length,1);
 const full=applyTerrainFrame(before,delta);
 assert.deepEqual(full.projection.grid,after.projection.grid);assert.deepEqual(full.projection.pixels,after.projection.pixels);
 assert.equal(before.projection.grid.heights[32*65+40],0);assert.equal(before.projection.pixels[73*256*4+201*4],0);
 assert.deepEqual(full.projection.update.base,before.target);
 assert.throws(()=>applyTerrainFrame({...before,target:identity(0)},delta),/Basis/);
});
test('missing, wrong, reset or incompatible bases receive full answers',()=>{
 const before=tilted(1),after=tilted(2);
 for(const [base,id,current]of [[undefined,undefined,after],[before,identity(0),after],[before,before.target,{...after,invalidation:{reset:true,bounds:[]}}],[before,before.target,{...after,target:{...after.target,key:'other-lod'}}]]){
  assert.equal(terrainFrameDelta(base,current,id),current);
 }
});
test('top-down deltas keep unchanged tile objects and replace only changed image bytes',()=>{
 const tiles=[0,1].map(x=>({box:{x:x*100,y:0,width:100,height:100},width:64,height:64,data:'pixels'+x,revision:1,campaignId:'c'}));
 const before={kind:'full',view:'top',target:identity(1),invalidation:{reset:false,bounds:[]},layer:{state:'ready',records:[],tiles,coverage:{complete:true,mode:'detail',objects:0,references:0}}};
 const after={...before,target:identity(2),layer:{...before.layer,tiles:[{...tiles[0],data:'changed',revision:2},tiles[1]]}};
 const delta=terrainFrameDelta(before,after,before.target);assert.equal(delta.tiles.length,1);
 const result=applyTerrainFrame(before,delta);assert.deepEqual(result.layer,after.layer);assert.equal(result.layer.tiles[1],tiles[1]);
});
test('derived LRU respects its byte quota and spatial invalidation, with least recently used eviction',()=>{
 const cache=new TerrainCache(20),a={x:0,y:0,width:10,height:10},b={x:100,y:0,width:10,height:10};
 cache.put('a',a,'a',10);cache.put('b',b,'b',10);assert.equal(cache.get('a'),'a');cache.put('c',b,'c',10);
 assert.equal(cache.get('b'),undefined);assert.equal(cache.bytes,20);cache.invalidate([a]);assert.equal(cache.get('a'),undefined);assert.equal(cache.get('c'),'c');
 cache.put('huge',a,'ignored',21);assert.equal(cache.bytes,10);assert.equal(cache.get('huge'),undefined);
 cache.clear();assert.equal(cache.bytes,0);
});
test('active detail pixels use their own delta, including full fallback when its footprint changes',()=>{
 const before=tilted(1),after=tilted(2),box={x:-10,y:-10,width:20,height:20};
 before.projection.detail={box,width:128,height:128,pixels:new Uint8Array(128*128*4)};
 after.projection.detail={box,width:128,height:128,pixels:before.projection.detail.pixels.slice()};after.projection.detail.pixels[90*128*4+70*4]=99;
 const delta=terrainFrameDelta(before,after,before.target);assert.equal(delta.kind,'delta');assert.equal(delta.detail.patches.length,1);assert.equal(delta.pixels.length,0);
 const full=applyTerrainFrame(before,delta);assert.deepEqual(full.projection.detail,after.projection.detail);assert.equal(before.projection.detail.pixels[90*128*4+70*4],0);
 after.projection.detail.box={...box,x:0};assert.equal(terrainFrameDelta(before,after,before.target).kind,'full');
});

test('raw ground and water deltas survive a surface that remains unchanged under water',()=>{
 const before=tilted(1),after=tilted(2),n=65*65;
 before.projection.grid.editing={ground:new Float32Array(n).fill(-100),water:new Float32Array(n)};
 after.projection.grid.editing=structuredClone(before.projection.grid.editing);after.projection.grid.editing.ground[100]=-50;after.projection.grid.editing.water[200]=30;
 const delta=terrainFrameDelta(before,after,before.target);assert.equal(delta.kind,'delta');assert.equal(delta.heights.length,0);assert.equal(delta.editing.ground.length,1);assert.equal(delta.editing.water.length,1);
 assert.deepEqual(applyTerrainFrame(before,delta).projection.grid,after.projection.grid);assert.equal(before.projection.grid.editing.ground[100],-100);
 delete before.projection.grid.editing;assert.equal(terrainFrameDelta(before,after,before.target).kind,'full');
});

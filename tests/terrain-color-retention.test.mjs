import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/terrain-detail-retention';export * from './src/app/terrain-change-history';export * from './src/app/terrain-detail-tiles';export * from './src/app/terrain-projection';export * from './src/app/terrain-detail';"},outfile:'.build/terrain-color-retention-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {TerrainChangeHistory,TerrainDetailTiles,terrainColorIdentity,terrainDetailTiles,validateTerrainProjection,terrainDetailBox}=createRequire(import.meta.url)('../.build/terrain-color-retention-test.cjs');
const source=revision=>({revision,fence:'f'+revision,token:'campaign',rasterRouteKey:'null'});
const identity=revision=>({revision,fence:'f'+revision});
const change=(base,bounds=[],reset=false)=>({base:identity(base),invalidation:{bounds,reset}});
const box={x:0,y:0,width:256,height:256},dirty={x:70,y:70,width:4,height:4};
test('history accumulates skipped reads, survives same-source reads, and fails closed on reset or eviction',()=>{
 const history=new TerrainChangeHistory();history.record(identity(1),{reset:true,bounds:[]});
 history.record(identity(2),change(1,[dirty]).invalidation);
 history.record(identity(2),change(2).invalidation);
 history.record(identity(4),change(2,[{...dirty,x:170}]).invalidation);
 assert.deepEqual(history.since(identity(1)),change(1,[dirty,{...dirty,x:170}]));
 assert.deepEqual(history.since(identity(4)),change(4));
 assert.equal(history.since({revision:1,fence:'unknown'}).invalidation.reset,true);
 history.record(identity(5),{reset:true,bounds:[]});assert.equal(history.since(identity(4)).invalidation.reset,true);
 for(let revision=6;revision<80;revision++)history.record(identity(revision),change(revision-1).invalidation);
 assert.equal(history.since(identity(5)).invalidation.reset,true);
 history.record(identity(80),{reset:false,bounds:Array.from({length:2049},()=>dirty)});
 assert.equal(history.since(identity(79)).invalidation.reset,true,'bounded spatial history cannot silently omit old changes');
});
async function loaded(){
 const tiles=new TerrainDetailTiles();let reads=0;
 const read=async q=>{reads++;return {...q,pixels:new Uint8Array(q.width*q.height*4).fill(q.revision===1?255:127),forest:new Uint8Array(q.width*q.height).fill(q.revision===1?200:60)};};
 const load=async revision=>tiles.load(terrainColorIdentity(source(revision)),box,{...identity(revision),contours:0,routeContext:box},read,()=>true,detail=>tiles.detail=detail,tiles.detail);
 tiles.reconcile(source(1));await load(1);
 return {tiles,load,reads:()=>reads};
}
test('a confirmed local change keeps distant pixels and reads only affected tiles, including the shading halo',async()=>{
 const {tiles,load,reads}=await loaded(),before=tiles.detail,original=before.pixels.slice(),count=reads();
 // x=65 is outside the left tile but inside its four-metre raster halo.
 const local={x:65,y:30,width:1,height:1},next=tiles.reconcile(source(2),change(1,[local]));
 assert.notEqual(next,before);assert.deepEqual(before.pixels,original,'published predecessor is immutable');
 assert.equal(next.pixels[(30*4*next.width+30*4)*4+3],0,'neighbouring tile also invalidated through the halo');
 assert.equal(next.pixels[(200*4*next.width+200*4)*4+3],255,'distant world detail stays sharp');
 assert.equal(next.coverage.values.filter(v=>v===0).length,2);
 assert.equal(next.forest[30*4*next.width+30*4],0);assert.equal(next.forest[200*4*next.width+200*4],200);assert(before.forest.every(v=>v===200));
 await load(2);assert.equal(reads()-count,2);assert.equal(tiles.detail.forest[30*4*next.width+30*4],60);assert.equal(tiles.detail.forest[200*4*next.width+200*4],200);assert.equal(tiles.detail.coverage.values.filter(v=>v===255).length,16);
});
test('unknown base, source reset, another campaign and route-context changes cannot reuse pigment',async()=>{
 for(const kind of ['missing','wrong','reset','campaign','route']){
  const {tiles,reads}=await loaded(),before=reads(),target={...source(2),...(kind==='campaign'?{token:'other'}:{}),...(kind==='route'?{rasterRouteKey:'["road"]'}:{})};
  const confirmed=kind==='missing'?undefined:kind==='wrong'?change(0):change(1,[],kind==='reset');
  assert.equal(tiles.reconcile(target,confirmed),undefined,kind);
  let fetched=0;await tiles.load(terrainColorIdentity(target),box,{...identity(2),contours:0,routeContext:box},async q=>{fetched++;return {...q,pixels:new Uint8Array(q.width*q.height*4)};},()=>true,()=>{});
  assert.equal(reads(),before);assert.equal(fetched,terrainDetailTiles(box).tiles.length);
  assert.deepEqual(tiles.base(target.token),identity(2));assert.equal(tiles.base('unrelated'),undefined);
 }
});
test('a pending old tile cannot fill the rebased cache even if its caller still reports current',async()=>{
 const tiles=new TerrainDetailTiles();tiles.reconcile(source(1));let release;
 const pending=tiles.load(terrainColorIdentity(source(1)),box,{...identity(1),contours:0,routeContext:box},q=>new Promise(r=>release=()=>r({...q,pixels:new Uint8Array(q.width*q.height*4)})),()=>true,()=>assert.fail('obsolete tile painted'));
 tiles.reconcile(source(2),change(1));release();assert.equal(await pending,false);
 let reads=0;await tiles.load(terrainColorIdentity(source(2)),box,{...identity(2),contours:0,routeContext:box},async q=>{reads++;return {...q,pixels:new Uint8Array(q.width*q.height*4)};},()=>true,()=>{});
 assert.equal(reads,terrainDetailTiles(box).tiles.length);
});
test('the projection colour base accepts only a concrete source identity',()=>{
 const q={view:{box,frame:box,columns:33,rows:33,focusM:0,tilt:45,rotation:0,exaggeration:1},width:64,height:64,contours:0,displayMpp:1,revision:2};
 validateTerrainProjection({...q,colorBase:identity(1)});
 for(const colorBase of [{revision:-1,fence:'x'},{revision:1,fence:2},{...identity(1),bounds:[box]}])assert.throws(()=>validateTerrainProjection({...q,colorBase}),/farbbasis/);
});


test('live brush patches cover the full disc inside their unfaded interior without continent-sized padding',()=>{
 for(const radius of [0.01,8,257,4023360])for(const factor of [-3.4,-.5,0,.24,.5,1.5]){
  const point={x:factor*radius,y:-factor*radius},view={x:-100*radius,y:-100*radius,width:200*radius,height:200*radius};
  const b=terrainDetailBox(point,radius,view);
  assert(b.width<=3*radius&&b.height<=3*radius,'rasterized area is bounded by brush size');
  assert(b.x+b.width*.04<=point.x-radius);assert(b.x+b.width*.96>=point.x+radius);
  assert(b.y+b.height*.04<=point.y-radius);assert(b.y+b.height*.96>=point.y+radius);
  assert.deepEqual(terrainDetailBox(point,radius,view),b);
 }
 const edge=terrainDetailBox({x:0,y:0},8,{x:0,y:0,width:10,height:10});
 assert.deepEqual(edge,{x:0,y:0,width:10,height:10});
 assert.equal(terrainDetailBox({x:100,y:100},8,{x:0,y:0,width:10,height:10}),undefined);
});

test('retained detail matches pixel-centre sampling across pans, zooms, clipped edges and absent forest',()=>{
 const {retainTerrainDetail}=createRequire(import.meta.url)('../.build/terrain-color-retention-test.cjs');
 const blank=(box,width,height)=>({box,width,height,pixels:new Uint8Array(width*height*4).fill(17),forest:new Uint8Array(width*height).fill(23)});
 const sample=(target,previous)=>{
  for(let y=0;y<target.height;y++)for(let x=0;x<target.width;x++){
   const sx=Math.floor(((target.box.x+(x+.5)*target.box.width/target.width)-previous.box.x)/previous.box.width*previous.width),sy=Math.floor(((target.box.y+(y+.5)*target.box.height/target.height)-previous.box.y)/previous.box.height*previous.height);
   if(sx<0||sy<0||sx>=previous.width||sy>=previous.height)continue;
   const a=sy*previous.width+sx,b=y*target.width+x;target.pixels.set(previous.pixels.subarray(a*4,a*4+4),b*4);target.forest[b]=previous.forest?.[a]??0;
  }
 };
 for(const origin of [-20000000,0,1e12])for(const scale of [.125,1,65536])for(const ratio of [.25,.5,1,2,4])for(const shift of [-40,-5.3,0,3,40])for(const forest of [true,false]){
  const previous=blank({x:origin,y:origin,width:32*scale,height:24*scale},32,24);
  previous.pixels=Uint8Array.from(previous.pixels,(_,i)=>(i*37+Math.floor(i/17))%256);
  if(forest)previous.forest=Uint8Array.from(previous.forest,(_,i)=>(i*41)%256);else delete previous.forest;
  const target=blank({x:origin+shift*scale,y:origin-shift*scale,width:36*scale*ratio,height:28*scale*ratio},36,28),expected=structuredClone(target),before=structuredClone(previous);
  // Both aligned typed arrays and unaligned views preserve arbitrary RGBA.
  if(shift===3){const bytes=new Uint8Array(previous.pixels.length+1);bytes.set(previous.pixels,1);previous.pixels=bytes.subarray(1);}
  sample(expected,previous);retainTerrainDetail(target,previous);
  assert.deepEqual(target,expected,JSON.stringify({origin,scale,ratio,shift,forest}));assert.deepEqual({...previous,pixels:Uint8Array.from(previous.pixels)},before);
 }
});

test('a world jump cannot wrap distant sample coordinates back into a tiny previous detail',()=>{
 const {retainTerrainDetail}=createRequire(import.meta.url)('../.build/terrain-color-retention-test.cjs'),mpp=1/512;
 const previous={box:{x:0,y:0,width:4*mpp,height:2*mpp},width:4,height:2,pixels:new Uint8Array(32).fill(255),forest:new Uint8Array(8).fill(200)};
 const target={box:{x:-(2**31)*mpp,y:0,width:4*(2**32)*mpp,height:2*mpp},width:4,height:2,pixels:new Uint8Array(32),forest:new Uint8Array(8)};
 retainTerrainDetail(target,previous);
 assert.deepEqual([...target.forest],[200,0,0,0,200,0,0,0]);
 for(let i=0;i<8;i++)assert.equal(target.pixels[i*4+3],i%4===0?255:0);
});

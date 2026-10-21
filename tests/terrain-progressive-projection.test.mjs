import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/terrain-navigation-plan';export * from './src/app/storage/terrain-projection';export * from './src/app/terrain-projection-cache';export * from './src/app/terrain-height';export * from './src/app/terrain-projection';"},outfile:'.build/terrain-progressive-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {terrainNavigationPlan,readTerrainProjection,readTerrainProjectionSteps,TerrainProjectionCache,heightRecord,validateTerrainProjection}=createRequire(import.meta.url)('../.build/terrain-progressive-test.cjs');
test('navigation stages validate at portrait, landscape and extreme scales with fixed geometry budgets',()=>{
 for(const size of [.01,1,1e7])for(const ratio of [.2,1,5]){
  const stages=terrainNavigationPlan({frame:{x:-100*size,y:-100*size,width:200*size,height:200*size*ratio},pixelWidth:1000,pixelHeight:1000*ratio},7,{tilt:75,rotation:180,exaggeration:8},[]);
  for(const q of stages)validateTerrainProjection(q);
  assert.deepEqual(stages[0].view,stages[1].view);assert.equal(stages[0].view.columns*stages[0].view.rows,66049);assert.equal(stages[0].detail,undefined);assert(stages[0].width*stages[0].height<=16384);
 }
});
test('coarse colour and final colour have byte-identical terrain geometry; staged final equals a cold full read',()=>{
 const records=[];for(let y=-1;y<=0;y++)for(let x=-1;x<=0;x++)records.push(heightRecord(x*512,y*512,8,Float32Array.from({length:4096},(_,i)=>20+30*Math.sin((x*512+i%64*8)/50)+20*Math.cos((y*512+Math.floor(i/64)*8)/80))));
 const db={prepare(){return {get(){return undefined;}};}},source={campaignId:'test',revision:7,fence:'current'},stream=kind=>kind==='height'?records:[];
 const stages=terrainNavigationPlan({frame:{x:-200,y:-160,width:400,height:320},pixelWidth:1000,pixelHeight:800},7,{tilt:55,rotation:25,exaggeration:2},[]);
 // Small texture dimensions keep this equality regression cheap; runtime budgets are asserted above.
 const [coarse,fine]=stages;fine.width=64;fine.height=48;fine.detailResolution=128;
 const cache=new TerrainProjectionCache(),overview=readTerrainProjection(db,source,coarse,stream,cache),detail=readTerrainProjection(db,source,fine,stream,cache),cold=readTerrainProjection(db,source,fine,stream,new TerrainProjectionCache());
 assert.deepEqual(overview.grid,detail.grid);assert.deepEqual(overview.objects,detail.objects);assert.deepEqual(overview.routes,detail.routes);assert.deepEqual(detail,cold);
 assert.throws(()=>readTerrainProjection(db,{...source,revision:8},fine,stream,cache),/inzwischen geändert/);
});

test('yielding raster batches reproduce the complete projection byte for byte',()=>{
 const records=[heightRecord(0,0,16,Float32Array.from({length:4096},(_,i)=>20+60*Math.sin(i%64/10)*Math.cos(Math.floor(i/64)/9)))];
 const db={prepare(){return{get(){}};}},source={campaignId:'test',revision:1,fence:'one'},stream=kind=>kind==='height'?records:[];
 const q=terrainNavigationPlan({frame:{x:0,y:0,width:900,height:600},pixelWidth:1000,pixelHeight:667},1,{tilt:45,rotation:0,exaggeration:1},[])[1];q.width=256;q.height=192;q.detailResolution=256;
 const expected=readTerrainProjection(db,source,q,stream,new TerrainProjectionCache()),steps=readTerrainProjectionSteps(db,source,q,stream,new TerrainProjectionCache());
 let yields=0;for(;;){const step=steps.next();if(step.done){assert.deepEqual(step.value,expected);break;}yields++;}
 assert(yields>1,'the cold projection must offer scheduling boundaries');
});

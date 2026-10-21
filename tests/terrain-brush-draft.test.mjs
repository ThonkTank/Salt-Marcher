import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({stdin:{contents:"export * from './src/app/terrain-brush-draft';export * from './src/app/terrain-brush';export * from './src/app/terrain-height';",resolveDir:process.cwd()},outfile:'.build/terrain-brush-draft-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {TerrainBrushDraft,applyTerrainBrush,TerrainSampler}=createRequire(import.meta.url)('../.build/terrain-brush-draft-test.cjs');
function grid(height=-100){
 const view={box:{x:-64,y:-64,width:128,height:128},frame:{x:-64,y:-64,width:128,height:128},columns:129,rows:129,focusM:0,tilt:0,rotation:0,exaggeration:1};
 return {view,heights:new Float32Array(129*129).fill(Math.max(0,height)),seaLevelM:0,editing:{ground:new Float32Array(129*129).fill(height),water:new Float32Array(129*129)}};
}
const centre=64*129+64;
const stroke={mode:'raise',radius:32,strength:200,feather:.5,samples:[{x:0,y:0,t:0},{x:0,y:0,t:1000}]};
test('raising starts below the sea; cumulative input is applied once without modifying the confirmed grid',()=>{
 const base=grid(),draft=new TerrainBrushDraft(base);
 draft.update({...stroke,samples:[stroke.samples[0],{x:0,y:0,t:250}]});
 assert.equal(draft.ground[centre],-50);assert.equal(draft.grid.heights[centre],0);
 draft.update({...stroke,samples:[stroke.samples[0],{x:0,y:0,t:250},stroke.samples[1]]});
 assert.equal(draft.ground[centre],100);assert.equal(draft.grid.heights[centre],100);
 assert.equal(draft.update(stroke),false);assert.equal(base.editing.ground[centre],-100);assert.equal(base.heights[centre],0);
});
test('continuous draft and canonical additive brush agree at authored lattice nodes for raise, lower and roughen',()=>{
 for(const mode of ['raise','lower','roughen']){
  const s={...stroke,mode,roughness:1.4,seed:3823};
  const draft=new TerrainBrushDraft(grid());draft.update(s);
  const sampler=new TerrainSampler(applyTerrainBrush([],s));
  for(let y=50;y<=78;y+=7)for(let x=50;x<=78;x+=7)assert(Math.abs(draft.ground[y*129+x]-sampler.sample({x:x-64,y:y-64}).heightM)<.001,mode);
 }
});
test('lowering a dry lake bed reveals its stored water level; levelling and smoothing do not overshoot',()=>{
 const base=grid(200);base.editing.water.fill(100);
 const draft=new TerrainBrushDraft(base);draft.update({...stroke,mode:'lower'});
 assert(Math.abs(draft.ground[centre])<.0001);assert.equal(draft.grid.heights[centre],100);
 const level=new TerrainBrushDraft(base);level.update({...stroke,mode:'level',targetM:180});assert.equal(level.ground[centre],180);
 const smooth=new TerrainBrushDraft(base);smooth.update({...stroke,mode:'smooth'});assert.equal(smooth.ground[centre],200);
});
test('offscreen nodes remain untouched and the display allocation is independent of world author count',()=>{
 const base=grid();base.view.frame={x:-10,y:-10,width:20,height:20};
 const draft=new TerrainBrushDraft(base);draft.update(stroke);
 assert.equal(draft.ground[64*129+84],-100);assert.equal(draft.ground.length,base.heights.length);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({entryPoints:['src/app/terrain-contour-style.ts'],outfile:'.build/terrain-contours-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {terrainContourInk:ink,terrainContourStep:step,CONTOUR_INK:style}=createRequire(import.meta.url)('../.build/terrain-contours-test.cjs');

test('zoom crossfades nested fixed elevations continuously without sliding lines',()=>{
 for(let exponent=0;exponent<=8;exponent++){
  const interval=2**exponent,mpp=interval/16,gradient=interval/24;
  for(const height of [-2.3,-1,0,.3,1,2,5,10].map(n=>n*interval)){
   assert(Math.abs(ink(height,gradient,-1,-1e9,1,step(mpp*(1-1e-7)))-ink(height,gradient,-1,-1e9,1,step(mpp*(1+1e-7))))<1e-5);
  }
  assert(ink(interval*10,gradient,-1,0,1,step(mpp))>.7,'shared principal contour survives interval boundaries');
  assert.equal(ink(interval*.5,gradient,-1,0,1,step(mpp)),0,'levels do not slide into intermediate elevations');
 }
 assert.equal(step(.001),1,'minimum interval remains one metre');
 assert.equal(step(1),16);assert.equal(step(16),256);
 for(const mpp of [32,1000,1e6])assert.equal(step(mpp),256,'world relief must not disappear behind unbounded elevation intervals');
});
test('the same scale preserves the same elevation lines across slopes and sample densities',()=>{
 for(const mpp of [.0625,.5,8,64]){
  const interval=step(mpp);
  for(const slope of [.01,.1,1])for(const ratio of [1,1.5,2]){
   const gradient=mpp*slope/ratio;
   assert(ink(interval*3,gradient,-1,0,ratio,step(mpp))>0,'a shared minor elevation crosses gentle and steep slopes');
   assert.equal(ink(interval*3.5,gradient,-1,0,ratio,step(mpp)),0,'slope or DPI must not introduce other levels');
   assert.equal(ink(interval*10,gradient,-1,0,ratio,step(mpp)),ink(interval*10,gradient*ratio,-1,0,1,step(mpp)));
  }
 }
 // Antialias support is one physical pixel; compare logical half-opacity width.
 for(const ratio of [1,1.5,2]){
  const samples=Array.from({length:601},(_,i)=>({offset:(i-300)/100,ink:ink(500+(i-300)/100,1/ratio,100,0,ratio,step(1))}));
  const visible=samples.filter(p=>p.ink>style.majorAlpha/2);
  assert(Math.abs(visible.at(-1).offset-visible[0].offset-2*style.majorWidth)<.03);
 }
});
test('manual intervals, disabled contours, unresolved lines and water plateaus retain their meaning',()=>{
 for(const gradient of [.01,.1,1,2]){
  assert(ink(100,gradient,100,0,1,step(100))>0);assert.equal(ink(50,gradient,100,0,1,step(100)),0);
  for(const height of [-100,0,100])assert.equal(ink(height,gradient,0,-1000,1,step(1)),0);
  for(const interval of [-1,10,100])for(const sea of [-100,0,100])assert.equal(ink(sea,gradient,interval,sea,1,step(1)),0);
 }
 assert.equal(ink(100,0,-1,0,1,step(1)),0);
 assert.equal(ink(100,100,1,0,1,step(1)),0,'subpixel spacing fades before aliasing');
});

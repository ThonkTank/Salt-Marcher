import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({entryPoints:['src/app/terrain-contour-style.ts'],outfile:'.build/terrain-contours-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {terrainContourInk:ink}=createRequire(import.meta.url)('../.build/terrain-contours-test.cjs');

test('automatic detail crossfades continuously through nested intervals without shifting elevations',()=>{
 for(let exponent=0;exponent<18;exponent++){
  const gradient=2**exponent/12,step=2**exponent;
  for(const height of [-2.3,-1,0,.3,1,2,5,10].map(n=>n*step)){
   assert(Math.abs(ink(height,gradient*(1-1e-7),-1,-1e9)-ink(height,gradient*(1+1e-7),-1,-1e9))<1e-5);
  }
  assert(ink(step*10,gradient,-1,0)>.49,'shared principal contour survives every interval boundary');
  assert.equal(ink(step*.5,gradient,-1,0),0,'levels do not slide into intermediate elevations');
 }
 assert(ink(3,.05,-1,0)>0);assert.equal(ink(3,2,-1,0),0,'fine lines disappear before becoming dense');
});
test('fixed intervals, disabled contours and water plateaus retain their meaning',()=>{
 for(const gradient of [.01,.1,1,2]){
  assert(ink(100,gradient,100,0)>0);assert.equal(ink(50,gradient,100,0),0);
  for(const height of [-100,0,100])assert.equal(ink(height,gradient,0,-1000),0);
  for(const interval of [-1,10,100])for(const sea of [-100,0,100])assert.equal(ink(sea,gradient,interval,sea),0);
 }
 assert.equal(ink(100,0,-1,0),0);
});

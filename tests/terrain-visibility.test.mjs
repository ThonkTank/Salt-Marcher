import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
buildSync({entryPoints:['src/app/terrain-spatial-model.ts'],outfile:'.build/terrain-visibility-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {terrainVisible,terrainVisibility}=require('../.build/terrain-visibility-test.cjs');
test('bounded visibility rays agree with complete triangle walks across ridges, rotations, sea and world scales',()=>{
 let compared=0,hidden=0,seen=0;
 for(const scale of [1,10000])for(const rotation of [0,45,89.999,180,270])for(const tilt of [0,35,65]){
  const box={x:-160*scale,y:-160*scale,width:320*scale,height:320*scale},frame={x:-100*scale,y:-100*scale,width:200*scale,height:200*scale};
  const heights=Float32Array.from({length:97*97},(_,i)=>30+120*Math.exp(-((i%97-60)**2)/6)+70*Math.sin(Math.floor(i/97)*.3));
  const grid={view:{box,frame,columns:97,rows:97,focusM:30,tilt,rotation,exaggeration:2},heights,seaLevelM:0},visible=terrainVisibility(grid);
  for(let y=-110;y<=110;y+=11)for(let x=-110;x<=110;x+=11){
   const point={x:(x+.125)*scale,y:(y-.25)*scale},expected=terrainVisible(grid,point);
   assert.equal(visible(point),expected,JSON.stringify({point,scale,rotation,tilt}));compared++;if(expected)seen++;else hidden++;
  }
 }
 assert(compared>=13000&&hidden>1000&&seen>1000);
});

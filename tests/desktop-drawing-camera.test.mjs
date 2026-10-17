import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
buildSync({entryPoints:['src/app/drawing-camera.ts'],outfile:'.build/drawing-camera-test.cjs',bundle:true,platform:'node',format:'cjs'});
const require=createRequire(import.meta.url),{zoomDrawingCamera}=require('../.build/drawing-camera-test.cjs');
test('zoom preserves the world point under an off-centre cursor and round-trips without editing its input',()=>{
 const box={x:-12,y:4,width:40,height:30},before={...box},anchor={x:3,y:26};
 const zoomed=zoomDrawingCamera(box,.8,anchor);
 assert.ok(Math.abs((anchor.x-box.x)/box.width-(anchor.x-zoomed.x)/zoomed.width)<1e-12);
 assert.ok(Math.abs((anchor.y-box.y)/box.height-(anchor.y-zoomed.y)/zoomed.height)<1e-12);
 assert.deepEqual(zoomDrawingCamera(zoomed,1.25,anchor),box);assert.deepEqual(box,before);
});
test('repeated extreme zooms remain finite, preserve the aspect ratio and retain a usable minimum view',()=>{
 let box={x:-5,y:-7,width:24,height:18};
 for(let i=0;i<200;i++)box=zoomDrawingCamera(box,.01);
 assert.equal(box.width,1);assert.equal(box.height,.75);
 for(let i=0;i<200;i++)box=zoomDrawingCamera(box,100);
 assert.equal(box.width,1000000);assert.equal(box.height,750000);
 assert.ok(Object.values(box).every(Number.isFinite));
});

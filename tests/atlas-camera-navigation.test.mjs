import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
buildSync({stdin:{contents:"export * from './src/app/atlas-camera-navigation';export {atlasProject,atlasCameraEye} from './src/app/atlas-camera';",resolveDir:process.cwd()},outfile:'.build/atlas-camera-navigation-test.mjs',bundle:true,platform:'node',format:'esm'});
const {orbitAtlasCamera,zoomAtlasCamera,shiftAtlasCamera,clearAtlasCamera,atlasProject,atlasCameraEye}=await import('../.build/atlas-camera-navigation-test.mjs');
const pose={frame:{x:-200,y:-150,width:400,height:300},focusM:20,tilt:45,rotation:37,exaggeration:2,projection:'perspective'};
const anchor={x:25,y:30,heightM:45};
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('orbit and smooth zoom steps preserve an elevated terrain anchor in screen space',()=>{
 const projected=atlasProject(pose,anchor,anchor.heightM);
 let current=pose;
 for(const [dx,dy]of [[45,20],[-12,-60],[90,120]]){
  current=orbitAtlasCamera(current,anchor,dx,dy);const at=atlasProject(current,anchor,anchor.heightM);
  close(at.x,projected.x);close(at.y,projected.y);close(at.depth,projected.depth);
 }
 for(const width of [200,25,20,900,40000000]){
  current=zoomAtlasCamera(current,width,anchor);const at=atlasProject(current,anchor,anchor.heightM);
  close(at.x,projected.x);close(at.y,projected.y);
 }
});
test('orbit clamps pitch and normalizes bearing; movement follows the screen bearing',()=>{
 assert.equal(orbitAtlasCamera(pose,anchor,10000,10000).tilt,75);
 const top=orbitAtlasCamera(pose,anchor,-10000,-10000);assert.equal(top.tilt,0);assert(top.rotation>=-180&&top.rotation<180);
 const moved=shiftAtlasCamera(pose.frame,90,0,-20);close(moved.x,pose.frame.x-20);close(moved.y,pose.frame.y);
 const right=shiftAtlasCamera(pose.frame,90,20,0);close(right.x,pose.frame.x);close(right.y,pose.frame.y-20);
});
test('camera clearance prevents a small-scale eye below loaded terrain',()=>{
 const small={...pose,frame:{x:-2,y:-1.5,width:4,height:3},tilt:75};
 const clear=clearAtlasCamera(small,()=>100),eye=atlasCameraEye(clear);
 assert(clear.focusM+eye.z/clear.exaggeration>=100.05-1e-9);
 assert.deepEqual(clearAtlasCamera(pose,()=>-500),pose);
});


test('native navigation gate waits for an actually outstanding terrain reply',async()=>{
 const {requireHeldTerrainReply}=await import('../tools/test-desktop-terrain-water-camera.mjs');
 let reads=0;
 const app={evaluate:async()=>++reads<3?0:1};
 assert.equal(await requireHeldTerrainReply(app,{timeoutMs:200}),1);
 assert.equal(reads,3);
});
test('native navigation gate rejects absent terrain replies without a replacement attempt',async()=>{
 const {requireHeldTerrainReply}=await import('../tools/test-desktop-terrain-water-camera.mjs');
 let reads=0;
 await assert.rejects(requireHeldTerrainReply({evaluate:async()=>{reads++;return 0;}},{timeoutMs:0}),/actually open terrain reply; no replacement attempt/);
 assert.equal(reads,1);
});

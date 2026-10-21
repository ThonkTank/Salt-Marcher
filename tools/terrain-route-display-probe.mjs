import {buildSync} from 'esbuild';
import assert from 'node:assert/strict';
/** Isolated GPU/picking oracle inside the owned native main-Atlas process. */
export async function terrainRouteDisplayPixels(page){
 const source=buildSync({stdin:{resolveDir:process.cwd(),contents:`
 import * as THREE from 'three';
 import {routeMeshes} from './src/app/terrain-route-view';
 import {emptyRecord} from './src/app/atlas-landscape';
 export function run(){
  const renderer=new THREE.WebGLRenderer({canvas:document.createElement('canvas'),antialias:true,preserveDrawingBuffer:true});renderer.setClearColor('#ffffff');renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.debug.onShaderError=(gl,p)=>{throw Error(gl.getProgramInfoLog(p));};
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,2,.001,1e7),record={...emptyRecord('road'),width:2,points:[{x:-2000,y:0},{x:2000,y:0}]},meshes=routeMeshes(record,()=>0,{x:0,y:0,z:0},1,40);
  for(const m of meshes){m.material.color.set('#000000');scene.add(m);}
  const read=()=>{const gl=renderer.getContext(),size=renderer.getDrawingBufferSize(new THREE.Vector2()),data=new Uint8Array(size.x*size.y*4);gl.readPixels(0,0,size.x,size.y,gl.RGBA,gl.UNSIGNED_BYTE,data);if(gl.getError()!==gl.NO_ERROR)throw Error('route GPU read');return {data,width:size.x,height:size.y};};
  const rows=[];
  try{
   for(const dpr of [1,2])for(const mpp of [.25,1,2,4,8,16,32]){
    renderer.setPixelRatio(dpr);renderer.setSize(256,128);camera.clearViewOffset();camera.aspect=2;camera.position.set(0,0,mpp*64/Math.tan(Math.PI/8));camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);renderer.render(scene,camera);
    const image=read();let ink=0;
    for(let y=0;y<image.height;y++)ink+=1-image.data[(y*image.width+Math.floor(image.width/2))*4]/255;
    const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);
    rows.push({dpr,mpp,ink:ink/dpr,hits:ray.intersectObjects(meshes,false).length,programs:renderer.info.programs.length});
   }
   renderer.setPixelRatio(1);renderer.setSize(512,256);camera.position.z=4*128/Math.tan(Math.PI/8);camera.aspect=2;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);renderer.render(scene,camera);const full=read(),assembled=new Uint8Array(full.data.length);
   for(let x=0;x<512;x+=256){renderer.setSize(256,256);camera.setViewOffset(512,256,x,0,256,256);renderer.render(scene,camera);const tile=read();for(let y=0;y<256;y++)assembled.set(tile.data.subarray(y*256*4,(y+1)*256*4),(y*512+x)*4);}
   let mismatch=0;for(let i=0;i<assembled.length;i++)if(Math.abs(assembled[i]-full.data[i])>1)mismatch++;
   return {rows,mismatch};
  }finally{for(const m of meshes){m.geometry.dispose();m.material.dispose();}renderer.dispose();renderer.forceContextLoss();}
 }
 `},bundle:true,format:'iife',globalName:'RouteDisplayProbe',write:false}).outputFiles[0].text;
 const result=await page.evaluate(`(()=>{${source}\nreturn RouteDisplayProbe.run();})()`);
 for(const dpr of [1,2]){
  const rows=result.rows.filter(r=>r.dpr===dpr),at=mpp=>rows.find(r=>r.mpp===mpp);
  assert(at(.25).ink>7&&at(.25).ink<9,'near road keeps its physical eight-pixel width');
  assert(at(4).ink>1&&at(4).ink<2,'half-pixel world width remains a readable overview line');
  assert(at(16).ink>0&&at(16).ink<at(8).ink,'visibility fades continuously towards regional cutoff');
  assert.equal(at(32).ink,0);assert.equal(at(32).hits,0,'invisible route cannot be selected');assert(at(4).hits>0);
 }
 assert.equal(result.mismatch,0,'tiled output retains the full-image screen width');return result;
}

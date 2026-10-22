import {buildSync} from 'esbuild';
import assert from 'node:assert/strict';

/** Real GPU comparison: repeated publications versus a fresh view per image.
 * Covers shader/uniform lifetime, not only equal vertex arrays. */
export async function terrainMeshReusePixels(page){
 const script=buildSync({stdin:{resolveDir:process.cwd(),contents:`
 import * as THREE from 'three';
 import {TerrainSpatialView} from './src/app/terrain-spatial-view';
 const make=()=>{const canvas=document.createElement('canvas');Object.defineProperty(canvas,'clientWidth',{value:256});Object.defineProperty(canvas,'clientHeight',{value:256});const v=new TerrainSpatialView(canvas,1);v.renderer.debug.onShaderError=(gl,p)=>{throw Error(gl.getProgramInfoLog(p));};return v;};
 const rgba=(w,h,seed)=>Uint8Array.from({length:w*h*4},(_,n)=>n%4===3?255:80+(Math.floor(n/4)%w*3+seed*17+n%4*31)%130);
 const data=(i,n,width,height)=>{
  const origin=i===4?2**35:i*100,box={x:origin-2000,y:origin-2000,width:4000,height:4000},frame={x:origin-700,y:origin-700,width:1400,height:1400},view={projection:'perspective',box,frame,columns:n,rows:n,focusM:100,tilt:i%2?50:0,rotation:i*23,exaggeration:2,...(i%2?{refinement:{x:origin-1000,y:origin-1000,width:2000,height:2000}}:{})},
   heights=Float32Array.from({length:n*n},(_,at)=>100+80*Math.sin(at%n/n*5)*Math.cos(Math.floor(at/n)/n*4)),grid={view,heights,seaLevelM:0,editing:{ground:heights.slice(),water:new Float32Array(n*n)}};
  return {generation:0,source:'mesh-reuse',draft:false,width,height,pixels:rgba(width,height,i),grid,
   ...(i%3?{forest:Uint8Array.from({length:width*height},(_,at)=>at%width<width/2?220:0)}:{}),
   ...(i%2?{detail:{box:{x:origin-600,y:origin-600,width:1200,height:1200},width:16,height:16,pixels:rgba(16,16,i+3),forest:new Uint8Array(256).fill(100)}}:{}),
   ...(i===2?{brushDetail:{box:{x:origin-400,y:origin-400,width:800,height:800},width:8,height:8,pixels:rgba(8,8,9)}}:{}),routes:[],objects:[]};
 };
 const pixels=view=>{const gl=view.renderer.getContext(),bytes=new Uint8Array(256*256*4);gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,bytes);if(gl.getError()!==gl.NO_ERROR)throw Error('Terrain GPU read failed');return bytes;};
 export function run(){
  const retained=make(),frames=[];let mesh,material;const gl=retained.renderer.getContext(),programs={created:0,deleted:0};
  for(const [name,key]of [['createProgram','created'],['deleteProgram','deleted']]){const fn=gl[name].bind(gl);gl[name]=(...args)=>{programs[key]++;return fn(...args);};}
  try{
   for(const [i,n,w,h]of [[0,33,16,16],[1,33,64,32],[2,33,32,64],[3,65,64,64],[4,65,16,16],[5,33,16,16]]){
    const current=data(i,n,w,h),fresh=make();
    try{
     retained.setData(structuredClone(current));fresh.setData(structuredClone(current));
     const a=pixels(retained),b=pixels(fresh);let mismatch=0;for(let p=0;p<a.length;p++)if(a[p]!==b[p])mismatch++;
     mesh??=retained.mesh;material??=retained.mesh.material;
     frames.push({i,n,width:w,height:h,mismatch,meshRetained:mesh===retained.mesh,materialRetained:material===retained.mesh.material,programs:{...programs},drawCalls:retained.renderer.info.render.calls});
     if(i===3){
      const stroke={mode:'raise',radius:450,strength:300,feather:.8,samples:[{x:current.grid.view.frame.x+700,y:current.grid.view.frame.y+700,t:0},{x:current.grid.view.frame.x+700,y:current.grid.view.frame.y+700,t:500}]};
      retained.previewHeight(stroke);fresh.previewHeight(stroke);const x=pixels(retained),y=pixels(fresh);let changed=0,mismatch=0;for(let p=0;p<x.length;p++){if(x[p]!==y[p])mismatch++;if(x[p]!==a[p])changed++;}frames.push({draft:true,mismatch,changed});
     }
    }finally{fresh.dispose();}
   }
   return {frames,programs:{...programs}};
  }finally{retained.dispose();}
 }
 `},bundle:true,format:'iife',globalName:'TerrainMeshReuseProbe',write:false}).outputFiles[0].text;
 const result=await page.evaluate('(()=>{'+script+';return TerrainMeshReuseProbe.run();})()');
 assert(result.frames.every(f=>f.mismatch===0),'Reused surface differs from fresh GPU output');
 assert(result.frames.filter(f=>!f.draft).every(f=>f.meshRetained&&f.materialRetained&&f.drawCalls>0));
 assert(result.frames.some(f=>f.draft&&f.changed>100),'Draft must visibly change the confirmed surface');
 assert.equal(result.programs.created,1,'Coverage, texture sizes and topology must share one terrain program');assert.equal(result.programs.deleted,0);
 return result;
}

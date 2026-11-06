import {buildSync} from 'esbuild';
import assert from 'node:assert/strict';
/** Actual GPU command ordering and byte equality, independent of world timing. */
export async function terrainPixelReadbackPixels(page){
 const script=buildSync({stdin:{resolveDir:process.cwd(),contents:`
 import {TerrainPixelReadback} from './tools/terrain-pixel-readback.mjs';
 export async function run(){
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const gl=canvas.getContext('webgl2',{preserveDrawingBuffer:true});
  const external=gl.createBuffer();gl.bindBuffer(gl.PIXEL_PACK_BUFFER,external);gl.bufferData(gl.PIXEL_PACK_BUFFER,256,gl.STREAM_READ);
  const names=[gl.PACK_ALIGNMENT,gl.PACK_ROW_LENGTH,gl.PACK_SKIP_PIXELS,gl.PACK_SKIP_ROWS],settings=[8,7,2,3];names.forEach((n,i)=>gl.pixelStorei(n,settings[i]));
  const owner=new TerrainPixelReadback(gl,64*64*4,2),region={x:2,y:3,width:8,height:6},received=[];
  try{
   gl.clearColor(.125,.25,.5,1);gl.clear(gl.COLOR_BUFFER_BIT);const before=owner.immediate(region).bytes;owner.enqueue(region,{name:'before'});
   gl.clearColor(.75,.5,.25,1);gl.clear(gl.COLOR_BUFFER_BIT);const after=owner.immediate(region).bytes;owner.enqueue(region,{name:'after'});
   const saturated=!owner.enqueue(region,{name:'overflow'});
   for(let i=0;i<120&&received.length<2;i++){await new Promise(requestAnimationFrame);owner.poll((bytes,p)=>received.push({name:p.meta.name,bytes:[...bytes]}));}
   const restored=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING)===external&&names.every((n,i)=>gl.getParameter(n)===settings[i]);
   return {before:[...before],after:[...after],received,saturated,restored,error:gl.getError()};
  }finally{owner.dispose();gl.deleteBuffer(external);gl.getExtension('WEBGL_lose_context')?.loseContext();}
 }
 `},bundle:true,format:'iife',globalName:'PixelReadbackProbe',write:false}).outputFiles[0].text;
 const r=await page.evaluate('(()=>{'+script+';return PixelReadbackProbe.run();})()');
 assert.equal(r.error,0);assert(r.restored);assert(r.saturated);assert.equal(r.received.length,2);assert.notDeepEqual(r.before,r.after);
 assert.deepEqual(r.received[0],{name:'before',bytes:r.before});assert.deepEqual(r.received[1],{name:'after',bytes:r.after});return r;
}

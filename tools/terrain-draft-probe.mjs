import {buildSync} from 'esbuild';
import assert from 'node:assert/strict';
/** Pixel oracle for the same view/material used by the Atlas, without author writes. */
export function buildDraftProbe(){
 return buildSync({stdin:{resolveDir:process.cwd(),contents:`
  import {TerrainSpatialView} from './src/app/terrain-spatial-view';
  import {terrainColors} from './src/app/world-model';
  export function run(){
   const canvas=document.createElement('canvas');Object.defineProperty(canvas,'clientWidth',{value:256});Object.defineProperty(canvas,'clientHeight',{value:256});
   const view=new TerrainSpatialView(canvas,1);view.renderer.debug.onShaderError=(gl,p)=>{throw Error(gl.getProgramInfoLog(p));};
   const color=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
   const water=color(terrainColors.water),land=color('#d8c8a3'),box={x:-2000,y:-2000,width:4000,height:4000},frame={x:-1000,y:-1000,width:2000,height:2000};
   const data=(height,c)=>({generation:0,source:'test',draft:false,width:2,height:2,pixels:Uint8Array.from(Array.from({length:4},()=>[...c,255]).flat()),landColor:'#d8c8a3',grid:{view:{box,frame,columns:65,rows:65,focusM:Math.max(0,height),tilt:0,rotation:0,exaggeration:1,projection:'perspective'},seaLevelM:0,heights:new Float32Array(65*65).fill(Math.max(0,height)),editing:{ground:new Float32Array(65*65).fill(height),water:new Float32Array(65*65)}}});
   const gl=view.renderer.getContext(),read=()=>{const p=new Uint8Array(4);gl.readPixels(128,128,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);if(gl.getError()!==gl.NO_ERROR)throw Error('Draft GPU read failed');return [...p].slice(0,3);};
   const stroke=(mode,t)=>({mode,radius:400,strength:300,feather:.5,samples:[{x:0,y:0,t:0},{x:0,y:0,t}]});
   try{
    const ocean=data(-100,water);view.setData(ocean);const before=read();view.freezePicking(true);
    view.previewHeight(stroke('raise',250));const submerged=read();
    view.previewHeight({...stroke('raise',1000),samples:[{x:0,y:0,t:0},{x:0,y:0,t:250},{x:0,y:0,t:1000}]});const raised=read();
    view.freezePicking(false);view.setData(ocean);const restored=read();
    view.setData(data(200,land));view.freezePicking(true);view.previewHeight(stroke('lower',1000));const lowered=read();
    return {before,submerged,raised,restored,lowered,water,land};
   }finally{view.dispose();}
  }
 `},bundle:true,format:'iife',globalName:'DraftProbe',write:false}).outputFiles[0].text;
}
export async function terrainDraftPixels(page,script){
 const r=await page.evaluate('(()=>{'+script+';return DraftProbe.run();})()');
 assert.deepEqual(r.submerged,r.before,'underwater sculpt must not start at sea level');assert.deepEqual(r.restored,r.before,'discard restores exact original pixels');
 const distance=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
 assert(distance(r.raised,r.land)<=2,'new land appears before any storage result');assert(distance(r.lowered,r.water)<=2,'lowering restores water on the same material');return r;
}

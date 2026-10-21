import {buildSync} from 'esbuild';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
/** Isolated pixel checks of the production renderer; not a substitute for UI work. */
export async function vegetationCameraPixels(page,out){
 const source=buildSync({stdin:{resolveDir:process.cwd(),contents:`
 import {TerrainSpatialView} from './src/app/terrain-spatial-view';
 import {vegetationSpec} from './src/app/vegetation';
 export function run(){
  const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:-10000px;width:800px;height:600px';document.body.append(canvas);
  const view=new TerrainSpatialView(canvas,1),spec=vegetationSpec();spec.layout='row';
  const plant=(id,x,y,protectedObject=false)=>({id,asset:'oak',x,y,z:0,size:4,angle:0,normal:{x:0,y:0,z:1},protected:protectedObject});
  const records=[{id:'wood',vegetation:spec,vegetationView:{mode:'individual',instances:[plant('row:0',-100,0),plant('row:1',0,100),plant('manual',100,0,true)]}}];
  const terrain={projection:'perspective',box:{x:-10000,y:-10000,width:20000,height:20000},frame:{x:-400,y:-300,width:800,height:600},columns:3,rows:3,focusM:0,tilt:0,rotation:0,exaggeration:1};
  const data={generation:1,source:'probe',draft:false,grid:{view:terrain,heights:new Float32Array(9),seaLevelM:-100},width:2,height:2,pixels:new Uint8Array(16).fill(255),vegetation:records};
  const pixels=()=>{const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;c.getContext('2d').drawImage(canvas,0,0);return c;};
  const sample=(mpp,dpr=1,tilt=0)=>{
   view.renderer.setPixelRatio(dpr);view.reframe({x:-400*mpp,y:-300*mpp,width:800*mpp,height:600*mpp},tilt,0);view.renderTile(800,600,0,0,800,600);
   const c=pixels(),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   const measure=(x,y)=>{const q=view.project({x,y}),cx=q.x*c.width,cy=q.y*c.height;let left=Infinity,right=-Infinity,ink=0;
    for(let py=Math.max(0,Math.floor(cy-25*dpr));py<Math.min(c.height,cy+25*dpr);py++)for(let px=Math.max(0,Math.floor(cx-15*dpr));px<Math.min(c.width,cx+15*dpr);px++){
     const i=(py*c.width+px)*4;if(p[i+1]>p[i]*1.04&&p[i+1]>p[i+2]*1.04&&p[i+1]<245){left=Math.min(left,px);right=Math.max(right,px);ink++;}
    }return{width:ink?(right-left+1)/dpr:0,ink:ink/dpr**2};};
   return{mpp,dpr,tilt,auto:measure(-100,0),protected:measure(100,0),minor:measure(0,100)};
  };
  try{
   view.setData(data);const matrices=view.vegetation.group.children.map(m=>Array.from(m.instanceMatrix.array));
   const samples=[sample(.5),sample(1),sample(1.75),sample(2.1),sample(4),sample(4,2),sample(4,1,60)];
   const screenshot=canvas.toDataURL();view.renderer.setPixelRatio(1);sample(1.75,1,40);const full=pixels();
   const tiled=document.createElement('canvas');tiled.width=800;tiled.height=600;
   for(let y=0;y<600;y+=300)for(let x=0;x<800;x+=400){view.renderTile(800,600,x,y,400,300);tiled.getContext('2d').drawImage(canvas,x,y);}
   const a=full.getContext('2d').getImageData(0,0,800,600).data,b=tiled.getContext('2d').getImageData(0,0,800,600).data;let mismatch=0;for(let i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>1)mismatch++;
   const unchanged=JSON.stringify(matrices)===JSON.stringify(view.vegetation.group.children.map(m=>Array.from(m.instanceMatrix.array)));
   return {samples,mismatch,unchanged,screenshot,programs:view.renderer.info.programs.length};
  }finally{view.dispose();canvas.remove();}
 }
 `},bundle:true,format:'iife',globalName:'VegetationCameraProbe',write:false}).outputFiles[0].text;
 const result=await page.evaluate(`(()=>{${source}\nreturn VegetationCameraProbe.run();})()`);
 await writeFile(out+'/vegetation-camera.png',Buffer.from(result.screenshot.split(',')[1],'base64'));delete result.screenshot;
 await writeFile(out+'/vegetation-camera.json',JSON.stringify(result,null,2));
 for(const sample of result.samples.filter(s=>s.tilt===0))assert(sample.auto.width>=4&&sample.auto.width<=8,JSON.stringify(sample));
 assert(result.samples[0].protected.width>result.samples[4].protected.width,'protected tree stays physical');
 assert(result.samples[1].minor.ink>0);assert.equal(result.samples[3].minor.ink,0,'minor candidate is hidden before coarse data arrives');
 assert.equal(result.mismatch,0,'tiled output equals whole camera');assert.equal(result.unchanged,true,'camera did not upload new instance matrices');
 return result;
}

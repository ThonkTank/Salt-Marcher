import {buildSync} from 'esbuild';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
export async function terrainCoveragePixels(page,out){
 const source=buildSync({stdin:{resolveDir:process.cwd(),contents:`
 import {TerrainSpatialView} from './src/app/terrain-spatial-view';
 import {terrainNavigationPlan} from './src/app/terrain-navigation-plan';
 import {terrainGridLayout} from './src/app/terrain-grid-layout';
 import {terrainHorizon} from './src/app/terrain-coverage';
 export function run(){
  const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:-10000px;width:800px;height:600px';document.body.append(canvas);
  const view=new TerrainSpatialView(canvas,1),frame={x:-400,y:-300,width:800,height:600};
  const picture=()=>{const c=document.createElement('canvas');c.width=800;c.height=600;c.getContext('2d').drawImage(canvas,0,0);return c;};
  const samples=[];
  try{
   for(const tilt of [45,60,75])for(const widened of [false,true]){
    const q=terrainNavigationPlan({frame,pixelWidth:800,pixelHeight:600},1,{tilt,rotation:25,exaggeration:1},[]);
    const v={...q[0].view,focusM:100,...(!widened?{box:{x:-1200,y:-900,width:2400,height:1800}}:{})},l=terrainGridLayout(v);
    const heights=Float32Array.from({length:257*257},(_,i)=>20+80*Math.exp(-(l.x.values[i%257]**2+l.y.values[Math.floor(i/257)]**2)/40000));
    view.setData({generation:1,source:'coverage',draft:false,grid:{view:v,heights,seaLevelM:0},width:2,height:2,pixels:Uint8Array.from({length:16},(_,i)=>[238,229,207,255][i%4])});view.renderTile(800,600,0,0,800,600);
    const c=picture(),p=c.getContext('2d').getImageData(0,0,800,600).data;let sky=0;
    for(let i=0;i<p.length;i+=4)if(Math.abs(p[i]-127)<2&&Math.abs(p[i+1]-168)<2&&Math.abs(p[i+2]-189)<2)sky++;
    const sample={tilt,widened,sky,box:v.box,blocks:l.blocks.length,fog:terrainHorizon(v),screenshot:c.toDataURL()};
    if(tilt===75&&widened){
     const tiled=document.createElement('canvas');tiled.width=800;tiled.height=600;
     for(let y=0;y<600;y+=300)for(let x=0;x<800;x+=400){view.renderTile(800,600,x,y,400,300);tiled.getContext('2d').drawImage(canvas,x,y);}
     const b=tiled.getContext('2d').getImageData(0,0,800,600).data;let mismatch=0;for(let i=0;i<p.length;i++)if(Math.abs(p[i]-b[i])>1)mismatch++;sample.mismatch=mismatch;
    }
    samples.push(sample);
   }
   return samples;
  }finally{view.dispose();canvas.remove();}
 }
 `},bundle:true,format:'iife',globalName:'TerrainCoverageProbe',write:false}).outputFiles[0].text;
 const samples=await page.evaluate(`(()=>{${source}\nreturn TerrainCoverageProbe.run();})()`);
 for(const sample of samples){await writeFile(out+`/coverage-${sample.tilt}-${sample.widened?'after':'before'}.png`,Buffer.from(sample.screenshot.split(',')[1],'base64'));delete sample.screenshot;}
 await writeFile(out+'/coverage-pixels.json',JSON.stringify(samples,null,2));
 assert.equal(samples.find(s=>s.tilt===45&&s.widened).sky,0,'ground fills the viewport at 45 degrees');
 assert(samples.find(s=>s.tilt===60&&s.widened).sky<samples.find(s=>s.tilt===60&&!s.widened).sky,'wider coverage removes the rectangular gap');
 assert.equal(samples.at(-1).mismatch,0,'horizon is identical in tiled output');
 return samples;
}

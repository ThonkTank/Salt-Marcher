// Bounded native style experiment. Uses the production renderer without author writes.
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {buildSync} from 'esbuild';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createNativeSession} from './native-session.mjs';
import {sculptRelief,RELIEF_VIEWS} from './terrain-relief-scene.mjs';
import {catmull,monotone,installInterpolation} from './terrain-interpolation-probe.mjs';
const root=process.cwd(),require=createRequire(root+'/package.json'),out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/terrain-interpolation');
buildSync({stdin:{resolveDir:root,contents:"export * from './src/app/storage/store';export * from './src/app/terrain-height';export * from './src/app/terrain-brush';export * from './src/app/terrain-spatial-worker';export * from './src/app/terrain-navigation-plan';"},outfile:'.build/terrain-interpolation.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,TerrainSampler,heightRecord,applyTerrainBrush,renderTerrainSpatial,terrainNavigationPlan}=require(root+'/.build/terrain-interpolation.cjs');
const native=await createNativeSession({root,output:out,name:'terrain-interpolation'}),store=new CampaignStore(native.profile+'/workbench.sqlite');store.create('Gelände-Interpolation');store.tutorial('skipped');store.close();
const field=(pixel,fn)=>[-1,0].flatMap(y=>[-1,0].map(x=>heightRecord(x*64*pixel,y*64*pixel,pixel,Float32Array.from({length:4096},(_,i)=>fn(x*64*pixel+i%64*pixel,y*64*pixel+Math.floor(i/64)*pixel)))));
const gaussian=(x,y)=>20+90*Math.exp(-(x*x+y*y)/40000),hill=field(16,gaussian),painted=sculptRelief(applyTerrainBrush);
const cases=[
 {name:'hill-close',records:hill,frame:{x:-90,y:-60,width:180,height:120},tilt:0},
 {name:'hill-tilted',records:hill,frame:{x:-450,y:-300,width:900,height:600},tilt:45},
 {name:'painted-region',records:painted,frame:RELIEF_VIEWS.region,tilt:45},
 {name:'plateau-coast',records:field(16,(x,y)=>x<0?-20:100),frame:{x:-150,y:-100,width:300,height:200},tilt:45},
];
const encoded=[],metrics=[];
try{
 for(const [name,kernel]of [['bilinear',null],['catmull',catmull],['monotone',monotone]]){
  const restore=kernel?installInterpolation(TerrainSampler,kernel):()=>{};
  try{
   const sampler=new TerrainSampler(hill,false);let square=0,maximum=0,n=0;
   for(let y=-80;y<=80;y+=1.25)for(let x=-80;x<=80;x+=1.25){const error=sampler.sample({x,y}).heightM-gaussian(x,y);square+=error*error;maximum=Math.max(maximum,Math.abs(error));n++;}
   const plateau=new TerrainSampler(cases.at(-1).records,false);let min=Infinity,max=-Infinity;
   for(let x=-40;x<=40;x+=.125){const v=plateau.sample({x,y:5.125}).heightM;min=Math.min(min,v);max=Math.max(max,v);}
   metrics.push({name,hillRmse:Math.sqrt(square/n),hillMaximumError:maximum,plateauMin:min,plateauMax:max});
   if(name==='bilinear')assert(Math.sqrt(square/n)>.16&&Math.sqrt(square/n)<.17,'the visual baseline must still use the original bilinear reconstruction');
   if(name==='monotone'){assert(min>=-20&&max<=100,'bounded reconstruction must preserve sea/plateau extrema');assert(Math.sqrt(square/n)<metrics[0].hillRmse/2);}
   for(const c of cases){
    const plan=terrainNavigationPlan({frame:c.frame,pixelWidth:960,pixelHeight:640},1,{tilt:c.tilt,rotation:0,exaggeration:1},[])[1];
    const start=performance.now(),reply=renderTerrainSpatial({generation:1,source:'isolated-reconstruction',records:c.records,box:plan.view.box,width:512,height:512,displayMpp:plan.displayMpp,view:plan.view});
    encoded.push({name:c.name+'-'+name,reply:{...reply,grid:{...reply.grid,heights:Array.from(reply.grid.heights)},pixels:Buffer.from(reply.pixels).toString('base64')}});
    console.log(c.name+' '+name+' prepared in '+Math.round(performance.now()-start)+' ms');
   }
  }finally{restore();}
 }
 await writeFile(out+'/metrics.json',JSON.stringify(metrics,null,2));
 const page=await native.launch(),bundle=buildSync({stdin:{resolveDir:root,contents:`
  import {TerrainSpatialView} from './src/app/terrain-spatial-view';
  export function render(encoded){const data={...encoded,grid:{...encoded.grid,heights:Float32Array.from(encoded.grid.heights)},pixels:Uint8Array.from(atob(encoded.pixels),c=>c.charCodeAt(0))},canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:-2000px;top:0;width:960px;height:640px';document.body.append(canvas);const view=new TerrainSpatialView(canvas,1);try{view.setData(data);view.setContours(-1);return canvas.toDataURL('image/png');}finally{view.dispose();canvas.remove();}}
 `},bundle:true,format:'iife',globalName:'InterpolationProbe',write:false}).outputFiles[0].text;
 await page.evaluate(bundle);
 for(const e of encoded){const png=await page.evaluate(data=>InterpolationProbe.render(data),e.reply);await writeFile(out+'/'+e.name+'.png',Buffer.from(png.split(',')[1],'base64'));}
 await native.close();await native.finish({metrics,images:encoded.map(e=>e.name+'.png'),checks:['Reconstruction candidates use identical authored nodes and camera; geometry and raster share each candidate.','Monotone interpolation retains plateau/sea extrema and reduces Gaussian reconstruction error.']});
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}

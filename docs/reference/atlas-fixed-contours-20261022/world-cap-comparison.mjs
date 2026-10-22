// Isolated style comparison using the production projection and renderer.
// Virtual constants affect only this probe bundle, never product files or author data.
import {build,buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createNativeSession} from '../tools/native-session.mjs';
import {sculptRelief,RELIEF_VIEWS} from '../tools/terrain-relief-scene.mjs';
const root=process.cwd(),require=createRequire(root+'/package.json'),out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/contour-readability');
buildSync({stdin:{resolveDir:root,contents:"export * from './src/app/storage/store';export * from './src/app/terrain-height';export * from './src/app/terrain-brush';export * from './src/app/storage/terrain-projection';export * from './src/app/terrain-navigation-plan';export * from './src/app/terrain-projection-cache';"},outfile:'.build/contour-readability.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,heightRecord,applyTerrainBrush,readTerrainProjection,terrainNavigationPlan,TerrainProjectionCache}=require(root+'/.build/contour-readability.cjs');
const native=await createNativeSession({root,output:out,name:'contour-readability'}),store=new CampaignStore(native.profile+'/workbench.sqlite');store.create('Isolierter Konturenvergleich');store.tutorial('skipped');store.close();
const hill=pixel=>{const rows=[];for(let y=-1024;y<1024;y+=64*pixel)for(let x=-1024;x<1024;x+=64*pixel)rows.push(heightRecord(x,y,pixel,Float32Array.from({length:4096},(_,i)=>20+90*Math.exp(-((x+i%64*pixel)**2+(y+Math.floor(i/64)*pixel)**2)/40000))));return rows;};
const world=sculptRelief((records,stroke)=>applyTerrainBrush(records,{...stroke,radius:stroke.radius*1000,samples:stroke.samples.map(s=>({...s,x:s.x*1000,y:s.y*1000}))}));
const cases=[{name:'world',records:world,frame:Object.fromEntries(Object.entries(RELIEF_VIEWS.region).map(([k,v])=>[k,v*1000]))}];
const encoded=[];
for(const c of cases){
 const q=terrainNavigationPlan({frame:c.frame,pixelWidth:960,pixelHeight:640},1,{tilt:0,rotation:0,exaggeration:1},[])[1],records=c.records.slice().sort((a,b)=>b.resolution-a.resolution);
 const data=readTerrainProjection({prepare(){return{get(){}};}},{campaignId:'fixture',revision:1,fence:'one'},q,kind=>kind==='height'?records:[],new TerrainProjectionCache());
 encoded.push({name:c.name,data:{...data,grid:{...data.grid,heights:Array.from(data.grid.heights)},pixels:Buffer.from(data.pixels).toString('base64'),detail:{...data.detail,pixels:Buffer.from(data.detail.pixels).toString('base64')}}});
 console.log('Prepared '+c.name+' ('+records.length+' height records)');
}
const results=[];
try{
 const page=await native.launch();
 for(const spacing of [0,128,256,512]){
  const bundle=(await build({stdin:{resolveDir:root,contents:`
   import {TerrainSpatialView} from './src/app/terrain-spatial-view';
   export function render(encoded,tilt){
    const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
    const data={...encoded,generation:1,source:'isolated-style-comparison',draft:false,grid:{...encoded.grid,view:{...encoded.grid.view,tilt},heights:Float32Array.from(encoded.grid.heights)},pixels:bytes(encoded.pixels),detail:{...encoded.detail,pixels:bytes(encoded.detail.pixels)}};
    const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:-2000px;top:0;width:960px;height:640px';document.body.append(canvas);
    const view=new TerrainSpatialView(canvas,1);try{view.setData(data);view.setContours(-1);return canvas.toDataURL('image/png');}finally{view.dispose();canvas.remove();}
   }
  `},bundle:true,format:'iife',globalName:'ContourReadabilityProbe',write:false,plugins:[{name:'isolated-spacing',setup(b){b.onLoad({filter:/terrain-contour-style\.ts$/},async args=>({contents:(await readFile(args.path,'utf8')).replace(/return Math.max\(CONTOUR_BASE_METRES,[^;]+;/, 'return Math.max(CONTOUR_BASE_METRES,'+(spacing?'Math.min('+spacing+',16*metresPerPixel)':'16*metresPerPixel')+');'),loader:'ts'}));}}]})).outputFiles[0].text;
  await page.evaluate(bundle);
  for(const c of encoded)for(const tilt of [0,45]){
   const png=await page.evaluate(({data,tilt})=>ContourReadabilityProbe.render(data,tilt),{data:c.data,tilt}),file=c.name+'-'+spacing+'-'+tilt+'.png';
   await writeFile(out+'/'+file,Buffer.from(png.split(',')[1],'base64'));results.push({case:c.name,spacing,tilt,file});console.log(file);
  }
 }
 await native.close();await native.finish({results,checks:['Same production geometry, colour and camera across isolated contour-spacing variants; no product or author changes.']});
 await writeFile(out+'/comparison.html','<!doctype html><meta charset="utf-8"><title>Konturenvergleich</title><style>body{font:16px system-ui;margin:24px;background:#faf8f2}section{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}figure{margin:0}img{width:100%}</style><h1>Isolierter Konturenvergleich</h1>'+cases.flatMap(c=>[0,45].map(tilt=>'<h2>'+c.name+' · '+tilt+'°</h2><section>'+[0,128,256,512].map(spacing=>'<figure><img src="'+c.name+'-'+spacing+'-'+tilt+'.png"><figcaption>'+spacing+' m größtes Intervall (0 = unbegrenzt)</figcaption></figure>').join('')+'</section>')).join(''));
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}

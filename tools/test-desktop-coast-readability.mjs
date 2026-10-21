// Isolated coast-ink comparison on the production geometry and renderer.
// Virtual source substitutions never change product files or author data.
import {build,buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createNativeSession} from './native-session.mjs';
const root=process.cwd(),require=createRequire(root+'/package.json'),out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/coast-readability');
const baseline='32c7f49184d59b30e9dabc9756f159543fcf3f56';
const source=execFileSync('git',['show',baseline+':src/app/landscape-raster.ts'],{encoding:'utf8'}),old='ink=Math.max(0,Math.min(1,1.95-d)),shore=water[i]?0:Math.max(0,1-d/7)*.18';
assert.equal(source.split(old).length,2,'Coast comparison baseline changed');
const variants=[['baseline',old],['clean','ink=Math.max(0,Math.min(1,1.5-d))*.85,shore=0'],['light','ink=Math.max(0,Math.min(1,1.5-d))*.80,shore=water[i]?0:Math.max(0,1-d/4)*.06']];
const contents="export * from './src/app/storage/store';export * from './src/app/terrain-height';export * from './src/app/storage/terrain-projection';export * from './src/app/terrain-navigation-plan';";
const native=await createNativeSession({root,output:out,name:'coast-readability'}),encoded=[],checks=[];
try{
 let store;
 for(const [variant,replacement] of variants){
  await build({stdin:{resolveDir:root,contents},outfile:'.build/coast-style-'+variant+'.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3'],plugins:[{name:'coast-style',setup(b){b.onLoad({filter:/landscape-raster\.ts$/},()=>({contents:source.replace(old,replacement),loader:'ts'}));}}]});
  const {CampaignStore,heightRecord,readTerrainProjection,terrainNavigationPlan}=require(root+'/.build/coast-style-'+variant+'.cjs');
  if(!store){store=new CampaignStore(native.profile+'/workbench.sqlite');store.create('Küstenvergleich');store.tutorial('skipped');store.close();}
  const records=[-1,0].flatMap(y=>[-1,0].map(x=>heightRecord(x*1024,y*1024,16,Float32Array.from({length:4096},(_,i)=>80*Math.sin((x*1024+i%64*16)/150)+30*Math.cos((y*1024+Math.floor(i/64)*16)/75)))));
  for(const [name,frame] of [['region',{x:-450,y:-300,width:900,height:600}],['close',{x:-110,y:-100,width:180,height:120}]]){
   const q=terrainNavigationPlan({frame,pixelWidth:960,pixelHeight:640},1,{tilt:0,rotation:0,exaggeration:1},[])[1];
   const data=readTerrainProjection({prepare(){return{get(){}};}},{campaignId:'fixture',revision:1,fence:'one'},q,kind=>kind==='height'?records:[]);
   const digest=createHash('sha256').update(new Uint8Array(data.grid.heights.buffer)).digest('hex');
   encoded.push({variant,name,digest,data:{...data,grid:{...data.grid,heights:Array.from(data.grid.heights)},pixels:Buffer.from(data.pixels).toString('base64'),detail:{...data.detail,pixels:Buffer.from(data.detail.pixels).toString('base64')}}});
   console.log('Prepared '+name+' '+variant);
  }
 }
 for(const name of ['region','close'])assert.equal(new Set(encoded.filter(c=>c.name===name).map(c=>c.digest)).size,1,'Ink must not change geometry');
 const page=await native.launch(),bundle=buildSync({stdin:{resolveDir:root,contents:`
  import {TerrainSpatialView} from './src/app/terrain-spatial-view';
  export function render(encoded,tilt){
   const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
   const data={...encoded,generation:1,source:'coast-comparison',grid:{...encoded.grid,view:{...encoded.grid.view,tilt},heights:Float32Array.from(encoded.grid.heights)},pixels:bytes(encoded.pixels),detail:{...encoded.detail,pixels:bytes(encoded.detail.pixels)}};
   const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:-2000px;top:0;width:960px;height:640px';document.body.append(canvas);
   const view=new TerrainSpatialView(canvas,1);try{view.setData(data);view.setContours(-1);return canvas.toDataURL('image/png');}finally{view.dispose();canvas.remove();}
  }`},bundle:true,format:'iife',globalName:'CoastProbe',write:false}).outputFiles[0].text;
 await page.evaluate(bundle);const images=[];
 for(const c of encoded)for(const tilt of [0,55]){
  const png=await page.evaluate(({data,tilt})=>CoastProbe.render(data,tilt),{data:c.data,tilt}),file=c.name+'-'+c.variant+'-'+tilt+'.png';
  await writeFile(out+'/'+file,Buffer.from(png.split(',')[1],'base64'));images.push({name:c.name,variant:c.variant,tilt,file});
 }
 checks.push('All coast styles use identical canonical heights, camera, land and water; only coast ink changes.');
 await native.close();await native.finish({checks,images,baseline,coastSource:createHash('sha256').update(source).digest('hex')});
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}

import {atlasCameraLabelPixels} from './atlas-camera-label-probe.mjs';
import {terrainRouteDisplayPixels} from './terrain-route-display-probe.mjs';
// Main Atlas camera: retained roads and rivers across continuous zoom and tilt.
import {createNativeSession} from './native-session.mjs';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),require=createRequire(root+'/package.json'),out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/atlas-line-scales');
require('esbuild').buildSync({stdin:{resolveDir:root,contents:"export * from './src/app/storage/store';export * from './src/app/terrain-height';export * from './src/app/atlas-landscape';export * from './src/app/landscape-line';export * from './src/app/terrain-spatial-model';"},outfile:'.build/atlas-line-scales-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,heightRecord,emptyRecord,newLine,projectTerrain}=require(root+'/.build/atlas-line-scales-store.cjs'),native=await createNativeSession({root,output:out,name:'atlas-line-scales'});
const store=new CampaignStore(native.profile+'/workbench.sqlite'),campaign=store.create('Straßenmaßstäbe'),token=store.activate(campaign.id).token;
const write=record=>store.executeAtlasCommit({campaignId:campaign.id,token,commandId:randomUUID(),action:{kind:'landscape-put',expectedRevision:null,record}});
for(let y=-1;y<=0;y++)for(let x=-1;x<=0;x++)write(heightRecord(x*8192,y*8192,128,new Float32Array(4096).fill(50)));
for(const [kind,name,width,y,color]of [['road','Handelsstraße',15,-180,'#956a36'],['road','Waldweg',3,-60,'#956a36'],['river','Fluss',25,60,'#377fba'],['river','Bach',3,180,'#377fba']])write({...emptyRecord(kind),name,width,points:[{x:-6000,y},{x:0,y},{x:6000,y}],line:{...newLine(kind),color,style:'solid',curve:'linear',roughness:0,meander:0,fadeIn:false}});
store.tutorial('skipped');store.close();
const db=new (require('better-sqlite3'))(native.profile+'/workbench.sqlite',{readonly:true}),authors=()=>JSON.stringify(db.prepare('SELECT id,revision,payload FROM atlas_landscape ORDER BY id').all()),before=authors();
let page;const samples=[];
try{
 const initial=process.env.ROUTE_WORLD_START==='1'?80000:12000;
 page=await native.launch();await page.evaluate(({id,width})=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:-width/2,y:-width/3,width,height:width*2/3})),{id:campaign.id,width:initial});
 await page.locator('.campaign-card').filter({hasText:'Straßenmaßstäbe'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
 await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
 if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
 await atlasCanvasReady(page);await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail',null,{timeout:60000});
 const canvas=await page.locator('#atlas-terrain-spatial').elementHandle();
 const snap=async name=>{samples.push({name,...await page.locator('#campaign-map').evaluate(el=>({projection:JSON.parse(el.dataset.terrainProjection),quality:el.dataset.terrainQuality,css:{width:el.clientWidth,height:el.clientHeight}}))});await native.capture(page,name+'.png');};
 if(process.env.ROUTE_WORLD_START==='1'){
  await snap('00-world');const box=await page.locator('#campaign-map').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  for(let i=0;i<20;i++){if(await page.locator('#campaign-map').evaluate(el=>JSON.parse(el.dataset.terrainProjection).frame.width)<=12000)break;await page.mouse.wheel(0,-360);await page.waitForTimeout(100);}
  await atlasCanvasReady(page);
 }
 await snap('01-regional');
 if(process.env.ROUTE_DISPLAY_VERIFY==='1'){
  const bounds=await page.locator('#campaign-map').boundingBox(),view=JSON.parse(await page.locator('#campaign-map').getAttribute('data-terrain-projection')),point=projectTerrain(view,{x:-2000,y:-60},50);
  await page.mouse.click(bounds.x+point.x*bounds.width,bounds.y+point.y*bounds.height+.45);
  await page.waitForFunction(()=>document.querySelector('#land-name')?.value==='Waldweg');await page.keyboard.press('Escape');
 }

 const rect=await page.locator('#campaign-map').boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
 for(const [name,limit]of [['02-local',2500],['03-streets',550]]){
  for(let i=0;i<20;i++){const width=await page.locator('#campaign-map').evaluate(el=>JSON.parse(el.dataset.terrainProjection).frame.width);if(width<=limit)break;await page.mouse.wheel(0,-360);await page.waitForTimeout(100);}
  await atlasCanvasReady(page);await snap(name);
 }
 await page.locator('#atlas-view').click();await page.locator('#terrain-tilt').fill('60');await page.locator('#terrain-tilt').dispatchEvent('input');await page.keyboard.press('Escape');await atlasCanvasReady(page);await snap('04-tilted');
 assert(await canvas.evaluate(el=>el===document.querySelector('#atlas-terrain-spatial')));assert.equal(authors(),before);
 const pixels=process.env.ROUTE_DISPLAY_VERIFY==='1'?await terrainRouteDisplayPixels(page):undefined;
 const labels=process.env.LABEL_CAMERA_VERIFY==='1'?await atlasCameraLabelPixels(page,out):undefined;
 await native.close();await native.finish({samples,pixels,labels,checks:['One main Atlas canvas survives regional-to-street wheel zoom and tilt with unchanged canonical road/river geometry.']});
}catch(error){await native.fail(error);throw error;}finally{db.close();await native.dispose();}

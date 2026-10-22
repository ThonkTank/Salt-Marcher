// Normal Atlas: a tiny authored building disappears at world scale and remains
// searchable, editable nearby, and exportable. Private disposable profile only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {buildSync} from 'esbuild';
import {createNativeSession} from './native-session.mjs';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
const root=process.cwd(),out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/geometry-scale-native'),require=createRequire(import.meta.url);
const native=await createNativeSession({root,output:out,name:'geometry-scale'});
buildSync({stdin:{resolveDir:root,contents:"export {CampaignStore} from './src/app/storage/store';export {heightRecord} from './src/app/terrain-height';"},outfile:out+'/fixture.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,heightRecord}=require(out+'/fixture.cjs'),Database=require('better-sqlite3'),checks=[],views=[];
const authored=()=>{const db=new Database(native.profile+'/workbench.sqlite',{readonly:true});try{return Object.fromEntries(['room','drawing_element','room_group','atlas_binding'].map(table=>[table,createHash('sha256').update(JSON.stringify(db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all())).digest('hex')]));}finally{db.close();}};
try{
 const store=new CampaignStore(native.profile+'/workbench.sqlite'),cam=store.create('Geometrie im Maßstab'),token=store.activateShell(cam.id).token;
 const write=action=>store.executeAtlasCommit({commandId:randomUUID(),token,campaignId:cam.id,action});
 for(let y=-1;y<1;y++)for(let x=-1;x<1;x++)write({kind:'landscape-put',expectedRevision:null,record:heightRecord(x*131072,y*131072,2048,new Float32Array(4096).fill(20))});
 const group=write({kind:'group-generate',name:'Zum Silbernen Ast',x:0,y:0,recipe:{version:1,profile:'Taverne',width:16,depth:18,seed:'scale-probe'}}).result.id;
 store.tutorial('skipped');store.close();const before=authored();
 const page=await native.launch();page.setDefaultTimeout(90000);
 await native.app.evaluate(()=>{
  const {Worker}=process.getBuiltinModule('node:worker_threads'),post=Worker.prototype.postMessage,pending=new WeakMap(),seen=new WeakSet();global.__geometryViews=[];
  Worker.prototype.postMessage=function(job,...args){
   pending.set(this,job);
   if(!seen.has(this)){seen.add(this);this.on('message',reply=>{const job=pending.get(this),r=reply.value;if(job?.kind!=='region'||!r?.coverage)return;global.__geometryViews.push({query:job.query,objects:r.coverage.objects,rooms:r.rooms.length,elements:r.drawing.elements.length,scopeLabels:r.labels?.filter(l=>l.id.startsWith('scope:')).map(l=>l.id)??[],scopes:r.bindings.map(b=>b.ownerId),raster:!!r.raster});});}
   return post.call(this,job,...args);
  };
 });
 await page.evaluate(id=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:-40000,y:-30000,width:80000,height:60000})),cam.id);
 await page.locator('.campaign-card').filter({hasText:'Geometrie im Maßstab'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
 await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
 const surface=await page.locator('#atlas-terrain-spatial').elementHandle();
 const ready=async()=>{await atlasCanvasReady(page);await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainReady==='ready',null,{timeout:90000});};
 const view=()=>page.locator('#campaign-map').evaluate(n=>JSON.parse(n.dataset.atlasView));
 const capture=async name=>{await ready();assert(await surface.evaluate(n=>n===document.querySelector('#atlas-terrain-spatial')));const region=await native.app.evaluate(()=>global.__geometryViews.at(-1));views.push({name,box:await view(),region});await native.capture(page,name);return region;};
 const world=await capture('01-world');assert.equal(world.objects,0);assert(!world.scopes.includes(group));assert(!world.scopeLabels.length);
 await page.locator('#atlas-search').fill('Schankraum');await page.locator('#atlas-search-results button').filter({hasText:'Schankraum'}).first().click();await ready();await page.locator('#atlas-search').fill('');
 const near=await capture('02-search-room');assert(near.rooms>0&&near.elements>0);assert(near.scopes.includes(group));assert.equal(await page.locator('#room-name').inputValue(),'Schankraum');checks.push('A world-hidden building is found through normal room search and opens its furnished geometry in the same Atlas.');
 await native.app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},out+'/building.png');
 if(await page.locator('#atlas-output').isHidden())await page.locator('#atlas-output-open').click();
 if(await page.locator('#atlas-export-size').isHidden())await page.locator('#atlas-output summary').filter({hasText:'Bildoptionen'}).click();
 await page.locator('#atlas-export-size').fill('1024');await page.locator('#atlas-export-grid').uncheck();await page.locator('#atlas-export-png').click();
 await page.waitForFunction(()=>document.querySelector('#atlas-save-status').textContent==='Atlas-PNG gespeichert');
 const png=require('pngjs').PNG.sync.read(await readFile(out+'/building.png'));assert.equal(png.width,1024);assert(png.data.some((v,i)=>i%4===3&&v>0));
 await page.getByRole('button',{name:'← Karte bearbeiten',exact:true}).click();await ready();
 for(let n=0;n<12;n++){
  const b=await view(),ratio=80000/b.width;if(Math.abs(Math.log(ratio))<.01)break;
  const area=await page.locator('#campaign-map').boundingBox();await page.mouse.move(area.x+area.width/2,area.y+area.height/2);await page.mouse.wheel(0,Math.log(ratio)/.002);
  const expected=b.width*Math.exp(Math.max(-1.2,Math.min(1.2,Math.log(ratio))));await page.waitForFunction(w=>Math.abs(Math.log(JSON.parse(document.querySelector('#campaign-map').dataset.atlasView).width/w))<.001,expected);
 }
 assert(Math.abs(Math.log((await view()).width/80000))<.01);
 const selectedWorld=await capture('03-selected-world');assert.equal(selectedWorld.objects,0);assert.equal(selectedWorld.rooms,0);assert.equal(selectedWorld.scopeLabels.length,0);assert(selectedWorld.scopes.includes(group),'The chosen editing frame remains addressable');checks.push('Zooming back out hides subpixel geometry and automatic markers while retaining the chosen author frame.');
 await native.close();assert.deepEqual(authored(),before);checks.push('Author records are unchanged after search, zoom and native PNG export.');
 await native.finish({checks,views,group,authored:before});
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}

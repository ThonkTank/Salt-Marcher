// Ordinary campaign -> Atlas navigation, real roof selection, canonical edits and same-camera output.
import {createNativeSession} from './native-session.mjs';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=process.cwd(),require=createRequire(root+'/package.json'),out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/atlas-objects-main');
require('esbuild').buildSync({stdin:{resolveDir:root,contents:"export * from './src/app/storage/store';export * from './src/app/terrain-height';export * from './src/app/terrain-spatial-model';"},outfile:'.build/atlas-objects-native.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,heightRecord,projectTerrain}=require(root+'/.build/atlas-objects-native.cjs');
const native=await createNativeSession({root,output:out,name:'atlas-objects-main'}),store=new CampaignStore(native.profile+'/workbench.sqlite');
const campaign=store.create('Gemeinsamer Atlas'),token=store.activate(campaign.id).token,context={token,campaignId:campaign.id};
const write=action=>store.executeAtlasCommit({...context,commandId:action.command?.commandId??randomUUID(),action});
for(let y=-1;y<1;y++)for(let x=-1;x<1;x++)write({kind:'landscape-put',expectedRevision:null,record:heightRecord(x*1024,y*1024,16,new Float32Array(4096).fill(50))});
const cityId=write({kind:'city-create',name:'Alte Koordinatenbindung',x:0,y:0,width:100,height:100}).result.id;
const house={id:'watch-house',kind:'building',name:'Passwacht',protected:true,position:{x:0,y:0},angle:0,outline:[{x:-12,y:-10},{x:12,y:-10},{x:12,y:10},{x:-12,y:10}],notes:'',use:'Wohnhaus',groupRecipe:{version:1,profile:'Wohnhaus',width:24,depth:20,seed:'main-camera-house'},terrain:{mode:'ground',offsetM:2,wallM:4,roofM:3}};
write({kind:'city',command:{...context,commandId:randomUUID(),cityId,expectedRevision:store.city(token,cityId).header.revision,action:{kind:'change',upsert:[house],remove:[],label:'Haus'}}});
store.tutorial('skipped');
const group=store.city(token,cityId).units.find(u=>u.id===house.id).groupId;
const floors=store.db.prepare('SELECT source_elevation AS elevation FROM drawing_floor WHERE scope_id=?').all(group).map(f=>f.elevation),roofZ=52+Math.max(0,...floors)+7;
const Database=require('better-sqlite3');store.close();const db=new Database(native.profile+'/workbench.sqlite',{readonly:true});
const row=()=>JSON.parse(db.prepare('SELECT payload FROM city_unit WHERE id=?').get(house.id).payload);
const rooms=()=>JSON.stringify(db.prepare('SELECT * FROM room WHERE scope_id=? ORDER BY id').all(group));
const initialRooms=rooms(),checks=[];
let page;
const ready=async()=>{await atlasCanvasReady(page);await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainReady==='ready');};
const start=async()=>{
 page=await native.launch();await native.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1920,1080));
 await page.evaluate(id=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:-450,y:-300,width:900,height:600})),campaign.id);
 await page.locator('.campaign-card').filter({hasText:'Gemeinsamer Atlas'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
 await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
 if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
 await ready();await page.locator('#atlas-units').selectOption('metric');
};
const objectPoint=async(x,y,z)=>{
 const bounds=await page.locator('#campaign-map').boundingBox(),view=JSON.parse(await page.locator('#campaign-map').getAttribute('data-terrain-projection')),p=projectTerrain(view,{x,y},z);
 return{x:bounds.x+p.x*bounds.width,y:bounds.y+p.y*bounds.height};
};
try{
 await start();assert.equal(await page.locator('#campaign-map').getAttribute('data-terrain-view'),'main');
 const canvas=await page.locator('#atlas-terrain-spatial').elementHandle();
 await page.locator('#atlas-view').click();await page.locator('#terrain-tilt').fill('50');await page.locator('#terrain-tilt').dispatchEvent('input');await page.keyboard.press('Escape');await ready();
 assert(await canvas.evaluate(el=>el===document.querySelector('#atlas-terrain-spatial')));await native.capture(page,'01-main-tilted.png');checks.push('The ordinary Atlas keeps one canvas when tilted.');
 // A tiled image follows the same pose and preserves the canonical data.
 await page.locator('#atlas-output-open').click();await page.locator('#atlas-output details summary').click();await page.locator('#atlas-export-size').fill('2048');
 const file=native.profile+'/tilted.png';await native.app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},file);
 await page.locator('#atlas-export-png').click();await page.waitForFunction(()=>document.querySelector('#atlas-save-status').textContent==='Atlas-PNG gespeichert',null,{timeout:120000});
 const bytes=await readFile(file),png=require('pngjs').PNG.sync.read(bytes);assert.equal(Math.max(png.width,png.height),2048);assert(new Set(png.data).size>30);await writeFile(out+'/02-main-tilted-export.png',bytes);assert.equal(rooms(),initialRooms);checks.push('Tiled perspective PNG exports through the main renderer without author changes.');
 await page.locator('#atlas-output-back').click();await ready();
 const roof=await objectPoint(0,0,roofZ);await page.mouse.click(roof.x,roof.y);
 await page.waitForFunction(()=>document.querySelector('#city-unit-name')?.offsetParent||[...document.querySelectorAll('dialog[open] button')].some(b=>b.textContent==='Haus: Passwacht'));
 const hit=page.getByRole('button',{name:'Haus: Passwacht',exact:true});if(await hit.isVisible())await hit.click();
 await page.locator('#city-unit-name').waitFor({state:'visible'});assert.equal(await page.locator('#city-unit-name').inputValue(),'Passwacht');assert(await canvas.evaluate(el=>el===document.querySelector('#atlas-terrain-spatial')));
 await page.locator('#city-wall-height').fill('6');await page.locator('#city-roof-height').fill('3');await page.locator('#city-ground-offset').fill('4');await page.locator('#city-unit-name').click();
 for(let i=0;i<100&&row().terrain.offsetM!==4;i++)await page.waitForTimeout(100);
 assert.deepEqual(row().terrain,{mode:'ground',offsetM:4,wallM:6,roofM:3});assert.equal(rooms(),initialRooms);await ready();await native.capture(page,'03-main-inspector.png');checks.push('Visible roof selects the canonical building; height edits retain its room geometry and main canvas.');
 const persisted=JSON.stringify(row());await native.close();await start();assert.equal(JSON.stringify(row()),persisted);assert.equal(rooms(),initialRooms);await native.capture(page,'04-reopened.png');await native.close();checks.push('Fresh native process reopens the same object heights and rooms.');
 await native.finish({checks});console.log(JSON.stringify(checks));
}catch(error){console.error(await page?.locator('#atlas-save-status').textContent().catch(()=>''));await native.fail(error);throw error;}finally{db.close();await native.dispose();}

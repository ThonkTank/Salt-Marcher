import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createNativeSession} from './native-session.mjs';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
const root=process.cwd(),require=createRequire(import.meta.url);
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/atlas-rejected-edit-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(root+'/.build/atlas-rejected-edit-store.cjs'),Database=require('better-sqlite3');
const native=await createNativeSession({root,output:process.env.QA_EVIDENCE_DIR??root+'/.build/atlas-rejected-edit',name:'atlas-rejected-edit'});
const store=new CampaignStore(native.profile+'/workbench.sqlite'),campaign=store.create('Korrigierbarer Entwurf'),active=store.activate(campaign.id);
store.executeAtlasCommit({commandId:randomUUID(),token:active.token,campaignId:campaign.id,action:{kind:'landscape-put',expectedRevision:null,record:{id:'road',revision:0,kind:'road',name:'Prüfweg',points:[{x:-20,y:0},{x:20,y:0}],polygons:[],resolution:1,width:4,values:{}}}});
store.tutorial('skipped');store.close();
const db=new Database(native.profile+'/workbench.sqlite',{readonly:true}),road=()=>JSON.parse(db.prepare("SELECT payload FROM atlas_landscape WHERE id='road'").get().payload);
let page;
async function start(){
 page=await native.launch();await page.locator('.campaign-card').filter({hasText:'Korrigierbarer Entwurf'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
 await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
 if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
 await atlasCanvasReady(page);await page.locator('#atlas-units').selectOption('metric');
 await page.locator('#atlas-search').fill('Prüfweg');await page.locator('#atlas-search-results button').filter({hasText:'Prüfweg'}).click();await atlasCanvasReady(page);
 await page.locator('#land-record-width').waitFor({state:'visible'});
}
try{
 await start();const before=road();await native.capture(page,'01-before');
 await page.locator('#land-record-width').fill('-2');await page.getByRole('button',{name:'Auswahl speichern',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#atlas-save-status').dataset.error==='true');
 assert.deepEqual(road(),before);await native.capture(page,'02-rejected');
 await page.locator('#land-record-width').fill('6');await page.getByRole('button',{name:'Auswahl speichern',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#atlas-save-status').textContent==='Gespeichert');
 assert.equal(road().width,6);await atlasCanvasReady(page);await native.capture(page,'03-corrected');
 await page.locator('#campaign-map').press('Escape');await page.locator('#atlas-undo').click();await atlasCanvasReady(page);assert.equal(road().width,4);
 await page.locator('#atlas-redo').click();await atlasCanvasReady(page);assert.equal(road().width,6);
 const expected=road();await native.close();await start();assert.deepEqual(road(),expected);assert.equal(await page.locator('#land-record-width').inputValue(),'6');await native.capture(page,'04-reopened');await native.close();
 await native.finish({checks:['rejected edit preserves stored road','corrected same draft saves','undo/redo','fresh process retains correction']});
}catch(error){await native.fail(error);throw error;}finally{db.close();await native.dispose();}

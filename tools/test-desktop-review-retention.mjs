import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile,copyFile,stat,readFile} from 'node:fs/promises';
import path from 'node:path';
import {createNativeSession} from './native-session.mjs';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';

const root=process.cwd(),require=createRequire(root+'/package.json');
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/review-retention-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(root+'/.build/review-retention-store.cjs');
const native=await createNativeSession({root,output:path.resolve(process.env.QA_EVIDENCE_DIR??'.build/review-retention'),name:'review-retention'});
const file=native.profile+'/workbench.sqlite',seed=new CampaignStore(file);
const room={id:randomUUID(),scopeId:'local',floorId:'ground',number:'1',name:'Bewahrte Torhalle',revision:0,polygons:[{outer:[{x:0,y:0},{x:12,y:0},{x:12,y:8},{x:0,y:8}],holes:[]}],sections:[]};
const first=seed.create('Entwürfe erhalten',[room]),second=seed.create('Andere Kampagne');
const {PNG}=require('pngjs');
function image(red){const png=new PNG({width:1,height:1});png.data.set([red,80,120,255]);return PNG.sync.write(png);}
const shared=image(40),privateImage=image(200),digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const asset=bytes=>({id:randomUUID(),kind:'custom',subjectId:null,title:'Prüfbild',sha256:digest(bytes),extension:'.png',bytes:bytes.length});
seed.registerPlayerAsset(seed.activate(first.id).token,asset(shared));
const secondToken=seed.activate(second.id).token;
seed.registerPlayerAsset(secondToken,asset(shared));seed.registerPlayerAsset(secondToken,asset(privateImage));
seed.activate(first.id);seed.tutorial('skipped');seed.close();
const images=native.profile+'/player-images';await mkdir(images,{recursive:true});
await writeFile(images+'/'+digest(shared)+'.png',shared);await writeFile(images+'/'+digest(privateImage)+'.png',privateImage);
const stale=native.profile+'/campaign-jobs/snapshot-prior-session';await mkdir(stale,{recursive:true});await copyFile(file,stale+'/campaign.sqlite');
let page;
async function open(id){
 await page.locator('#campaign-screen-list [data-campaign-id="'+id+'"]').getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
 await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert&&document.querySelector('#campaign-screen').hidden);
}
async function selectRoom(){
 if(!await page.locator('#campaign-atlas').isVisible()){
  if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();
  await page.locator('#atlas-tab').click();
 }
 await atlasCanvasReady(page);
 await page.locator('#atlas-search').fill(room.name);
 await page.locator('#atlas-search-results button').filter({hasText:room.name}).click();await atlasCanvasReady(page);
 await page.locator('#atlas-section').selectOption('interior');await atlasCanvasReady(page);
 await page.waitForFunction(()=>!document.querySelector('#atlas-section').disabled);
 await page.locator('#atlas-select').click();
 await page.waitForFunction(()=>document.querySelector('#drawing-tool').value==='select'&&!document.querySelector('#atlas-section').disabled);
 if(!await page.locator('#atlas-connect-entrance').isVisible())await page.locator('#atlas-context-toggle').click();
}
async function graph(){
 if(!await page.locator('#graph-open').isVisible())await page.locator('#atlas-analysis-open').click();
 await page.locator('#graph-open').click();await page.locator('#graph-dialog').waitFor({state:'visible'});
}
async function overview(){
 if(await page.locator('#campaign-atlas').isVisible()){
  await page.locator('#atlas-navigation').click();await page.locator('#atlas-exit').click();
 }else await page.locator('#campaign-screen-open').click();
}
try{
 page=await native.launch();await native.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1600,1000));
 await assert.rejects(stat(stale),{code:'ENOENT'},'A prior-session temporary campaign copy must be removed at startup');
 await open(first.id);await selectRoom();
 await page.locator('#atlas-connect-entrance').click();
 const draftHint=await page.locator('#atlas-hint').textContent();assert.match(draftHint,/Außenpunkt/);
 await overview();
 await page.waitForFunction(()=>document.querySelector('#atlas-save-status').textContent.includes('Atlaszug'));
 assert.equal(await page.locator('#campaign-screen').isVisible(),false);
 assert.equal(await page.locator('#atlas-hint').textContent(),draftHint);
 await native.capture(page,'atlas-draft-blocks-overview');
 await page.locator('#campaign-map').press('Escape');
 await overview();await page.locator('#campaign-screen').waitFor({state:'visible'});
 await open(second.id);assert.equal(await page.locator('#campaign-header-name').textContent(),second.name);
 await overview();
 await page.locator('#campaign-screen-list [data-campaign-id="'+second.id+'"]').getByRole('button',{name:'Bearbeiten…',exact:true}).click();
 await page.locator('#campaign-identity-trash').click();
 await page.waitForFunction(()=>document.querySelector('#campaign-trash-open').textContent==='Papierkorb (1)');
 await page.locator('#campaign-trash-open').click();
 await page.locator('#campaign-trash-list [data-campaign-id="'+second.id+'"]').getByRole('button',{name:'Dauerhaft löschen…',exact:true}).click();
 await page.locator('#campaign-delete-name').fill(second.name);
 await page.locator('#campaign-delete-form').getByRole('button',{name:'Dauerhaft löschen',exact:true}).click();
 await page.locator('#campaign-delete-dialog').waitFor({state:'hidden'});
 await assert.rejects(stat(images+'/'+digest(privateImage)+'.png'),{code:'ENOENT'});
 assert.deepEqual(await readFile(images+'/'+digest(shared)+'.png'),shared);
 await native.capture(page,'erased-campaign-retains-shared-image');
 await page.locator('#campaign-trash-close').click();await open(first.id);await selectRoom();await graph();
 await page.locator('#graph-room-name').fill('Erhaltene Graphvorschau');await page.locator('#graph-create').click();
 await page.waitForFunction(()=>document.querySelector('#graph-status').textContent.includes('geschützte'));
 await page.locator('#graph-raster').click();await page.locator('#graph-dialog').waitFor({state:'hidden'});
 await page.locator('#atlas-status').click();
 await page.locator('#graph-accept').waitFor({state:'visible'});
 await native.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).close());
 await page.waitForFunction(()=>/vorschau/i.test(document.querySelector('#status').textContent));
 assert.equal(native.app.process().exitCode,null,'An unresolved graph preview must keep the process alive');
 assert.equal(await page.locator('#graph-preview-banner').isVisible(),true);
 await native.capture(page,'graph-preview-blocks-close');
 await page.locator('#graph-accept').click();await page.locator('#graph-preview-banner').waitFor({state:'hidden'});
 await native.close();
 const reopened=new CampaignStore(file);
 try{assert(reopened.activate(first.id).rooms.some(r=>r.name==='Erhaltene Graphvorschau'));}finally{reopened.close();}
 page=await native.launch();await open(first.id);await selectRoom();await graph();
 assert.match(await page.locator('#graph-map').textContent(),/Erhaltene Graphvorschau/);
 await page.locator('#graph-close').click();await native.capture(page,'accepted-preview-after-restart');await native.close();
 await native.finish({checks:['prior-session managed snapshot is removed at startup','entrance draft blocks campaign overview without losing the draft','explicit discard allows switching campaigns','permanent deletion removes private images and preserves shared bytes','normal close blocks an unresolved raster preview','explicit acceptance persists the new room through normal close and fresh launch']});
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}

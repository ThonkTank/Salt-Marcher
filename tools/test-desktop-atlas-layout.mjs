// Native layout/workflow regression. Synthetic profile only; no user campaign is opened.
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
const root=process.cwd(),require=createRequire(root+'/package.json');
const {_electron}=require('playwright-core');
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/layout-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(root+'/.build/layout-store.cjs');
const baseline=process.argv.includes('--baseline'),out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/atlas-layout-'+(baseline?'before':'after'));
await mkdir(out,{recursive:true});
const profile=await mkdtemp('/tmp/saltmarcher-layout-'),store=new CampaignStore(profile+'/workbench.sqlite');
const room={id:'watch',scopeId:'local',floorId:'ground',number:'1',name:'Wachstube',revision:0,polygons:[{outer:[{x:0,y:0},{x:12,y:0},{x:12,y:8},{x:0,y:8}],holes:[]}],sections:[]};
const campaign=store.create('Atlaswerkstatt',[room]);store.tutorial('skipped');store.close();
const result={baseline,profile,source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),runtimeHashes:Object.fromEntries(await Promise.all(['ui/renderer.js','ui/app.css'].map(async file=>[file,createHash('sha256').update(await readFile(root+'/.build/desktop/'+file)).digest('hex')]))),frames:[],errors:[]};let app;
try{
 app=await _electron.launch({executablePath:root+'/node_modules/electron/dist/electron',args:[root+'/.build/desktop/main.cjs','--data-dir',profile,'--ozone-platform=x11'],timeout:60000});
 const page=await app.firstWindow();page.on('pageerror',e=>result.errors.push(e.message));
 await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
 await page.locator('.campaign-card').filter({hasText:'Atlaswerkstatt'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
 await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
 if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
 await atlasCanvasReady(page);
 async function frame(name,width=1280,height=800,zoom=1){
  await app.evaluate(({BrowserWindow},s)=>{const w=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='SaltMarcher');w.setContentSize(s.width,s.height);w.webContents.setZoomFactor(s.zoom);},{width,height,zoom});
  await atlasCanvasReady(page);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const box=await page.locator('#campaign-map').boundingBox(),viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth>innerWidth}));
  const f={name,box,viewport,ratio:box.width*box.height/(viewport.width*viewport.height)};result.frames.push(f);
  await page.screenshot({path:out+'/'+name+'.png'});return f;
 }
 const first=await frame('initial');
 if(!baseline){assert(first.ratio>=.70,JSON.stringify(first));assert(!first.viewport.scroll);
  await page.locator('#atlas-search').fill('Wachstube');await page.locator('#atlas-search-results button').filter({hasText:'Wachstube'}).click();await atlasCanvasReady(page);
  await page.locator('#atlas-search').fill('');
  await page.locator('#atlas-dock-selection').click();assert(await page.locator('#room-name').isVisible());
  await page.locator('#key-open').click();await page.locator('#key-read-aloud').waitFor({state:'visible'});
  await page.locator('#key-read-aloud').fill('Vor dem Tor wartet eine müde Wache.');await page.locator('#key-save').click();
  await page.waitForFunction(()=>document.querySelector('#key-save-status').dataset.state==='saved');await frame('room-description');
  await page.locator('#key-close').click();
  await page.locator('#atlas-dock-collapse').click();const collapsed=await frame('collapsed');assert(collapsed.ratio>=.90);await page.locator('#atlas-dock-expand').click();
  await page.locator('#atlas-maximize').click();const max=await frame('maximized');assert(max.ratio>=.90);await page.locator('#atlas-restore').click();
  await page.locator('button[data-family="terrain"]').click();await page.locator('#atlas-dock-tool').click();
  await page.locator('[data-tool-select="land-tool"][data-tool-value="river"]').click();
  const box=await page.locator('#campaign-map').boundingBox();await page.mouse.click(box.x+box.width*.4,box.y+box.height*.5);await page.mouse.click(box.x+box.width*.6,box.y+box.height*.55);
  await page.locator('#campaign-map').press('Enter');await page.waitForFunction(()=>document.querySelector('#land-status').textContent==='Gespeichert');await frame('river');
  const before=await page.locator('#campaign-map').getAttribute('data-atlas-view');await page.locator('#campaign-map').focus();await page.keyboard.down('Space');await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.5+35,box.y+box.height*.5+20,{steps:4});await page.mouse.up();await page.keyboard.up('Space');await atlasCanvasReady(page);assert.notEqual(await page.locator('#campaign-map').getAttribute('data-atlas-view'),before);
  // Exercise the re-arranged city controls, generated preview, room authoring and export.
  await page.locator('button[data-family="city"]').click();await page.locator('#atlas-dock-tool').click();
  await page.locator('#atlas-new-name').fill('Eichenfurt');await page.locator('#atlas-create-city').click();
  let map=await page.locator('#campaign-map').boundingBox();await page.mouse.click(map.x+map.width*.6,map.y+map.height*.6);
  await page.waitForFunction(()=>document.querySelector('#campaign-atlas').dataset.family==='city'&&document.querySelector('#atlas-selection-title').textContent==='Eichenfurt');await atlasCanvasReady(page);
  await page.locator('#atlas-dock-tool').click();await page.locator('[data-tool-select="city-tool"][data-tool-value="road"]').click();
  map=await page.locator('#campaign-map').boundingBox();
  for(const [x,y]of [[.25,.5],[.75,.5]])await page.mouse.click(map.x+map.width*x,map.y+map.height*y);
  await page.locator('#campaign-map').press('Enter');await page.waitForFunction(()=>!document.querySelector('#city-path-hint').textContent.includes('2 Punkte'));await atlasCanvasReady(page);
  await page.locator('[data-tool-select="city-tool"][data-tool-value="district"]').click();
  for(const [x,y]of [[.25,.3],[.75,.3],[.75,.7],[.25,.7]])await page.mouse.click(map.x+map.width*x,map.y+map.height*y);
  await page.locator('#campaign-map').press('Enter');
  await page.waitForFunction(()=>document.querySelector('#city-district').options.length>0);await atlasCanvasReady(page);
  await page.locator('#atlas-generation-open').click();await page.locator('#city-generate').click();await page.locator('#city-preview-actions').waitFor({state:'visible'});await frame('city-preview');
  await page.locator('#city-preview-accept').click();await page.locator('#city-preview-actions').waitFor({state:'hidden'});await atlasCanvasReady(page);await page.locator('#atlas-secondary-close').click();
  await page.locator('#atlas-search').fill('Wachstube');await page.locator('#atlas-search-results button').filter({hasText:'Wachstube'}).click();await page.locator('#atlas-search').fill('');await atlasCanvasReady(page);
  await page.locator('#atlas-dock-tool').click();await page.locator('[data-tool-select="drawing-tool"][data-tool-value="room-rectangle"]').click();await page.locator('#atlas-new-name').fill('Archiv');
  map=await page.locator('#campaign-map').boundingBox();await page.mouse.move(map.x+map.width*.65,map.y+map.height*.65);await page.mouse.down();await page.mouse.move(map.x+map.width*.8,map.y+map.height*.8,{steps:5});await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('#atlas-selection-title').textContent==='Archiv');await atlasCanvasReady(page);await frame('new-room');
  await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},out+'/atlas.png');
  await page.locator('#atlas-output-open').click();await page.locator('#atlas-export-png').click();await page.waitForFunction(()=>document.querySelector('#atlas-save-status').textContent==='Atlas-PNG gespeichert');await page.locator('#atlas-output-back').click();
  const beforeMenus=await page.locator('#campaign-map').boundingBox();
  for(const id of ['atlas-music','atlas-more','atlas-navigation','atlas-status']){await page.locator('#'+id).click();assert.deepEqual(await page.locator('#campaign-map').boundingBox(),beforeMenus);await page.keyboard.press('Escape');}
  await page.locator('#atlas-navigation').click();await page.locator('#preparation-tab').click();await page.waitForFunction(()=>!document.body.classList.contains('atlas-workspace'));assert(await page.locator('body>header').isVisible());
  await page.locator('#atlas-tab').click();await atlasCanvasReady(page);await frame('returned');
  for(const [w,h,z]of [[1366,768,1],[1920,1080,1],[1280,800,2]]){const f=await frame('viewport-'+w+'-'+z,w,h,z);assert(!f.viewport.scroll);if(z===1)assert(f.ratio>=.70);}
 }
 assert.deepEqual(result.errors,[]);
 const exit=new Promise(r=>app.process().once('exit',(code,signal)=>r({code,signal})));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle()==='SaltMarcher').close());result.exit=await exit;assert.deepEqual(result.exit,{code:0,signal:null});app=null;
 if(!baseline){
  app=await _electron.launch({executablePath:root+'/node_modules/electron/dist/electron',args:[root+'/.build/desktop/main.cjs','--data-dir',profile,'--ozone-platform=x11'],timeout:60000});
  const reopened=await app.firstWindow();reopened.on('pageerror',e=>result.errors.push(e.message));await reopened.waitForFunction(()=>document.body.dataset.tutorialReady==='true');await reopened.locator('.campaign-card').filter({hasText:'Atlaswerkstatt'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
  await reopened.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle()==='SaltMarcher').webContents.setZoomFactor(1));
  if(await reopened.locator('#campaign-atlas').isHidden()){if(!await reopened.locator('#atlas-tab').isVisible())await reopened.locator('#workspace-nav-summary').click();await reopened.locator('#atlas-tab').click();}
  await atlasCanvasReady(reopened);await reopened.locator('#atlas-search').fill('Archiv');await reopened.locator('#atlas-search-results button').filter({hasText:'Archiv'}).click();await atlasCanvasReady(reopened);assert.equal(await reopened.locator('#atlas-selection-title').textContent(),'Archiv');
  const exitAgain=new Promise(r=>app.process().once('exit',(code,signal)=>r({code,signal})));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle()==='SaltMarcher').close());result.reopenExit=await exitAgain;assert.deepEqual(result.reopenExit,{code:0,signal:null});app=null;assert.deepEqual(result.errors,[]);
 }
 if(!baseline){const verified=new CampaignStore(profile+'/workbench.sqlite');const w=verified.activate(campaign.id);assert(w.rooms.some(r=>r.name==='Archiv'));const drawing=verified.drawing(w.token);assert(JSON.stringify(drawing).includes('Vor dem Tor wartet eine müde Wache.'));const cities=verified.cities(w.token);result.persisted={rooms:w.rooms.length,cities:cities.cities?.length??null};verified.close();}
 await writeFile(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){result.failure=e.stack;if(app)await(await app.firstWindow()).screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/result.json',JSON.stringify(result,null,2));throw e;}finally{if(app){const proc=app.process(),cleanup=setTimeout(()=>proc.kill('SIGKILL'),5000);try{await app.close().catch(()=>{});}finally{clearTimeout(cleanup);}}}

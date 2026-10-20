// Native measurement workflow, isolated synthetic campaign. Run after build:desktop.
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import {atlasCanvasReady,atlasCanvasPoint} from './atlas-canvas-probe.mjs';
const root=process.cwd(),require=createRequire(root+'/package.json'),{_electron}=require('playwright-core');
const out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/atlas-measurements-native');await mkdir(out,{recursive:true});
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/measurement-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(root+'/.build/measurement-store.cjs');
const profile=await mkdtemp('/tmp/saltmarcher-measurements-'),store=new CampaignStore(profile+'/workbench.sqlite');
const room={id:'measurement-room',scopeId:'local',floorId:'ground',number:'1',name:'Messraum',revision:0,polygons:[{outer:[{x:0,y:0},{x:15.24,y:0},{x:15.24,y:9.144},{x:0,y:9.144}],holes:[]}],sections:[]};
const campaign=store.create('Atlasmaße',[room]);store.tutorial('skipped');store.close();
const result={profile,rendererSha256:createHash('sha256').update(await readFile(root+'/.build/desktop/ui/renderer.js')).digest('hex'),cases:[],errors:[]};let app,page;
async function open(){
 app=await _electron.launch({executablePath:root+'/node_modules/electron/dist/electron',args:[root+'/.build/desktop/main.cjs','--data-dir',profile,'--ozone-platform=x11'],timeout:60000});page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',e=>result.errors.push(e.stack));
 await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
 await page.evaluate(()=>{const proto=CanvasRenderingContext2D.prototype,clear=proto.clearRect,fill=proto.fillText;proto.clearRect=function(...args){if(this.canvas.id==='campaign-map')window.__measurementText=[];return clear.apply(this,args);};proto.fillText=function(text,...args){if(this.canvas.id==='campaign-map')(window.__measurementText??=[]).push(String(text));return fill.call(this,text,...args);};});
 await page.locator('.campaign-card').filter({hasText:'Atlasmaße'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
 if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}await atlasCanvasReady(page);
}
async function close(){const exit=new Promise(resolve=>app.process().once('exit',(code,signal)=>resolve({code,signal})));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle()==='SaltMarcher').close());assert.deepEqual(await exit,{code:0,signal:null});app=null;}
async function text(pattern){await page.waitForFunction(pattern=>(window.__measurementText??[]).some(s=>new RegExp(pattern).test(s)),pattern);return page.evaluate(()=>window.__measurementText);}
async function frame(name){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await writeFile(out+'/'+name+'.png',Buffer.from(await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows().find(w=>w.getTitle()==='SaltMarcher').webContents.capturePage()).toPNG().toString('base64')),'base64'));result.cases.push({name,zoom:await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle()==='SaltMarcher').webContents.getZoomFactor()),viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight})),text:await page.evaluate(()=>window.__measurementText)});}
async function choose(section,group,tool){await page.locator('#atlas-section').selectOption(section);await page.waitForFunction(()=>!document.querySelector('#atlas-section').disabled);await page.locator('[data-tool-group="'+group+'"]').click();await page.locator('[data-atlas-tool="'+tool+'"]').click();await atlasCanvasReady(page);if(await page.locator('#atlas-secondary').isVisible())await page.locator('#atlas-secondary-close').click();}
async function fraction(x,y,click=false){const box=await page.locator('#campaign-map').boundingBox();await page.mouse[click?'click':'move'](box.x+box.width*x,box.y+box.height*y);}
async function search(name){await page.locator('#atlas-search').fill(name);await page.locator('#atlas-search-results button').filter({hasText:name}).first().click();await page.locator('#atlas-search').fill('');await atlasCanvasReady(page);}
try{
 await open();assert.equal(await page.locator('#atlas-units').inputValue(),'dnd');await text('Kante zu Kante');await frame('hex-dnd');
 await choose('terrain','routes','road');await page.locator('#land-width').fill('10');await fraction(.4,.4,true);await fraction(.65,.55);await text('Länge:');await frame('road-dnd');
 await page.locator('#atlas-units').selectOption('metric');assert.equal(await page.locator('#land-width').inputValue(),'3.048');await text('Breite: 3,05 m');await frame('road-metric');
 await page.locator('#atlas-units').selectOption('dnd');assert.equal(await page.locator('#land-width').inputValue(),'10');await page.locator('#campaign-map').press('Escape');
 await search('Messraum');await text('Fläche: 1.500 ft²');await frame('room-selected');
 await choose('interior','rooms','room-rectangle');await page.locator('#drawing-room-name').fill('Neuer Messraum');
 const a=await atlasCanvasPoint(page,{x:2,y:2}),b=await atlasCanvasPoint(page,{x:8,y:7});await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:6});await text('Fläche:');await frame('room-drag');
 await page.mouse.up();await atlasCanvasReady(page);await page.waitForFunction(()=>!document.querySelector('#atlas-undo').disabled);await page.locator('#atlas-undo').click();await atlasCanvasReady(page);await page.locator('#atlas-redo').click();await atlasCanvasReady(page);
 await page.locator('#atlas-section').selectOption('city');await page.waitForFunction(()=>!document.querySelector('#atlas-section').disabled);if(await page.locator('#atlas-secondary').isVisible())await page.locator('#atlas-secondary-close').click();
 await page.locator('#atlas-create-city').click();await page.locator('#atlas-new-name').fill('Messstadt');await fraction(.65,.6,true);await page.waitForFunction(()=>document.querySelector('#atlas-selection-title').textContent==='Messstadt');await atlasCanvasReady(page);
 await page.locator('#atlas-placement summary').click();const position=await page.locator('#atlas-binding-x').inputValue(),edited=String(Number(position)+10);await page.locator('#atlas-binding-x').fill(edited);await page.locator('#atlas-units').selectOption('metric');await page.locator('#atlas-units').selectOption('dnd');assert(Math.abs(Number(await page.locator('#atlas-binding-x').inputValue())-Number(edited))<1e-7,'unit switch retains unsubmitted placement');await page.locator('#atlas-binding-x').fill(position);await page.locator('#atlas-draft-cancel').click();
 await choose('city','areas','district');await fraction(.3,.3,true);await fraction(.7,.3,true);await fraction(.7,.65);await text('Fläche:');await frame('district-draft');await fraction(.7,.65,true);await page.locator('#campaign-map').press('Enter');await atlasCanvasReady(page);
 await choose('city','buildings','building');await fraction(.5,.5);await text('Fläche:');await frame('building-preview');await fraction(.5,.5,true);await atlasCanvasReady(page);
 await page.locator('#atlas-units').selectOption('metric');
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='SaltMarcher');w.setSize(1440,1000);w.webContents.setZoomFactor(2);});await atlasCanvasReady(page);await frame('metric-200-percent');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('#atlas-output-open').click();await page.locator('#atlas-output summary').filter({hasText:'Bildoptionen'}).click();await page.locator('#atlas-export-grid').check();await page.locator('#atlas-export-size').fill('1024');
 await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},out+'/export.png');await page.locator('#atlas-export-png').click();await page.waitForFunction(()=>document.querySelector('#atlas-save-status').textContent==='Atlas-PNG gespeichert',null,{timeout:60000});
 await close();await open();assert.equal(await page.locator('#atlas-units').inputValue(),'metric');await search('Messraum');await text('Fläche:');await frame('restart-metric');await close();assert.deepEqual(result.errors,[]);
 await writeFile(out+'/result.json',JSON.stringify({complete:true,...result},null,2));console.log(JSON.stringify({complete:true,out,cases:result.cases.map(c=>c.name)}));
}catch(error){if(app){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/failure.json',JSON.stringify({error:error.stack,...result},null,2));}throw error;}finally{if(app){const process=app.process(),timer=setTimeout(()=>process.kill('SIGKILL'),5000);try{await app.close().catch(()=>{});}finally{clearTimeout(timer);}}}

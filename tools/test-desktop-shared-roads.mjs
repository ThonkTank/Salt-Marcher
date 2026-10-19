// Actual Electron window and an isolated synthetic campaign. Never opens the user's profile.
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
const root=process.cwd(),require=createRequire(root+'/package.json'),{_electron}=require('playwright-core');
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/shared-road-native-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(root+'/.build/shared-road-native-store.cjs');
const dir=await mkdtemp('/tmp/saltmarcher-shared-road-'),out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/shared-road-native');await mkdir(out,{recursive:true});
const store=new CampaignStore(dir+'/workbench.sqlite'),room={id:'watch',scopeId:'local',floorId:'ground',number:'1',name:'Referenzhaus',revision:0,polygons:[{outer:[{x:0,y:0},{x:12,y:0},{x:12,y:8},{x:0,y:8}],holes:[]}],sections:[]};
const cam=store.create('Pinselvergleich',[room]),active=store.activate(cam.id);
const rect=(id,terrain,x,y,width,height)=>({id,revision:0,kind:'patch',name:id,points:[],polygons:[{outer:[{x,y},{x:x+width,y},{x:x+width,y:y+height},{x,y:y+height}],holes:[]}],resolution:4828.032,width:0,values:{terrain}});
store.executeAtlasCommit({commandId:randomUUID(),token:active.token,campaignId:cam.id,action:{kind:'landscape-batch',records:[rect('sea','water',-500,-500,1000,1000),{...rect('island','plains',-60,-50,120,100),polygons:[{outer:[{x:-60,y:-50},{x:40,y:-50},{x:40,y:-20},{x:20,y:-18},{x:20,y:-9},{x:50,y:-9},{x:50,y:-5},{x:25,y:-5},{x:25,y:50},{x:-60,y:50}],holes:[]}]}].map(record=>({record,expectedRevision:null}))}});store.tutorial('skipped');store.close();
const Database=require('better-sqlite3'),db=new Database(dir+'/workbench.sqlite',{readonly:true}),records=()=>db.prepare('SELECT payload FROM atlas_landscape').all().map(r=>JSON.parse(r.payload));
const result={source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),profile:dir,errors:[],checks:[]};let app,page;
async function start(){
 const executable=process.env.ATLAS_PACKAGE?path.join(process.env.ATLAS_PACKAGE,'electron'):root+'/node_modules/electron/dist/electron';
 app=await _electron.launch({executablePath:executable,args:[...(process.env.ATLAS_PACKAGE?[]:[root+'/.build/desktop/main.cjs']),'--data-dir',dir,'--ozone-platform=x11'],timeout:60000});if(process.env.ATLAS_PACKAGE)assert.equal(await app.evaluate(({app})=>app.getVersion()),JSON.parse(await readFile(root+'/package.json','utf8')).version);page=await app.firstWindow();page.on('pageerror',e=>result.errors.push(e.stack??e.message));
 await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');await page.locator('.campaign-card').filter({hasText:'Pinselvergleich'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
 if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
 await atlasCanvasReady(page);await page.locator('#atlas-search').fill('Referenzhaus');await page.locator('#atlas-search-results button').filter({hasText:'Referenzhaus'}).click();await atlasCanvasReady(page);await page.locator('#atlas-search').fill('');await page.locator('button[data-family="terrain"]').click();await atlasCanvasReady(page);
}
const tool=async value=>{await page.waitForFunction(()=>!document.querySelector('#land-tool').disabled);await page.locator(`[data-tool-select="land-tool"][data-tool-value="${value}"]`).click();await page.waitForFunction(value=>document.querySelector('#land-tool').value===value,value);await atlasCanvasReady(page);};
const camera=()=>page.locator('#campaign-map').evaluate(n=>({view:JSON.parse(n.dataset.atlasView),left:n.getBoundingClientRect().left,top:n.getBoundingClientRect().top,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height}));
async function at(x,y){await atlasCanvasReady(page);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const c=await camera();return{x:c.left+(x-c.view.x)/c.view.width*c.width,y:c.top+(y-c.view.y)/c.view.height*c.height};}
async function clickWorld(x,y,button='left'){const p=await at(x,y);await page.mouse.click(p.x,p.y,{button});}
async function waitRecord(predicate){for(let i=0;i<100;i++){if(records().some(predicate)){await atlasCanvasReady(page);return;}await page.waitForTimeout(100);}throw Error('Expected persisted record not found: '+JSON.stringify(records()));}
async function capture(name){await page.screenshot({path:out+'/'+name+'.png'});}
async function stroke(points){const p=await at(...points[0]);await page.mouse.move(p.x,p.y);await page.mouse.down();for(const point of points.slice(1)){const q=await at(...point);await page.mouse.move(q.x,q.y,{steps:12});}await page.mouse.up();}
try{
 await start();
 await page.locator('button[data-family="city"]').click();
 await page.locator('#atlas-create-city').click();await page.locator('#atlas-new-name').fill('Brückenstadt');
 let c=await camera();await clickWorld(c.view.x+c.view.width*.55,c.view.y+c.view.height*.55);
 await page.waitForFunction(()=>document.querySelector('#atlas-selection-title').textContent==='Brückenstadt');await atlasCanvasReady(page);
 await page.locator('[data-tool-select="city-tool"][data-tool-value="road"]').click();
 await page.locator('#city-new-type').waitFor({state:'visible'});assert.equal(await page.locator('#city-new-type option').count(),9);
 await page.locator('#city-new-type').selectOption('avenue');
 assert.equal(await page.locator('#city-draw-width').inputValue(),'14');
 c=await camera();const a={x:c.view.x+c.view.width*.38,y:c.view.y+c.view.height*.5},b={x:c.view.x+c.view.width*.7,y:a.y};
 await clickWorld(a.x,a.y);await clickWorld(b.x,b.y);await page.locator('#campaign-map').press('Enter');await waitRecord(r=>r.kind==='road'&&r.line.type==='avenue');
 const r=records().find(r=>r.kind==='road');assert.equal(r.width,14);assert.equal(db.prepare("SELECT count(*) n FROM city_unit WHERE kind='road'").get().n,1);const ref=JSON.parse(db.prepare("SELECT payload FROM city_unit WHERE kind='road'").get().payload);assert.equal(ref.roadRef,r.id);assert.equal(ref.outline,undefined);result.checks.push('native city draws canonical avenue with type width and reference only');
 await page.locator('[data-tool-select="city-tool"][data-tool-value="select"]').click();await clickWorld((a.x+b.x)/2,a.y);
 await page.waitForFunction(()=>document.querySelector('#atlas-hit-candidates').open||document.querySelector('#city-unit-name').checkVisibility());
 if(await page.locator('#atlas-hit-candidates').isVisible())await page.locator('#atlas-hit-candidates button').filter({hasText:/^Landschaft:/}).click();
 await page.locator('#city-edit-type').waitFor({state:'visible'});assert.equal(await page.locator('#campaign-atlas').getAttribute('data-family'),'city');
 await page.locator('#city-edit-type').selectOption('trade-road');await page.locator('#city-unit-name').fill('Gemeinsame Handelsstraße');await page.locator('#city-unit-form button[type="submit"]').click();await waitRecord(r=>r.name==='Gemeinsame Handelsstraße'&&r.line.type==='trade-road');await capture('01-city-edit');result.checks.push('native shared road hit stays in city editor and edits canonical road');
 await page.locator('#campaign-map').press('Escape');await page.locator('button[data-family="terrain"]').click();await tool('select');await page.locator('#land-object').selectOption(r.id);await page.locator('#land-edit-type').waitFor({state:'visible'});assert.equal(await page.locator('#land-edit-type').inputValue(),'trade-road');assert.equal(await page.locator('#land-record-width').inputValue(),'14');
 await page.locator('#land-edit-type').selectOption('country-road');await page.locator('#land-record-width').fill('9');await page.getByRole('button',{name:'Auswahl speichern',exact:true}).click();await waitRecord(r=>r.id===ref.roadRef&&r.width===9&&r.line.type==='country-road');result.checks.push('native landscape edits same city road without duplicate');await capture('02-landscape-edit');
 const saved=records();await page.locator('#campaign-map').press('Escape');for(let i=0;i<8;i++)await page.getByRole('button',{name:'Verkleinern',exact:true}).click();await atlasCanvasReady(page);assert.deepEqual(records(),saved);await capture('03-zoom');result.checks.push('native zoom preserves canonical geometry and widths');
 await app.close();app=null;await start();assert.deepEqual(records(),saved);result.checks.push('fresh process preserves shared city and landscape road');assert.deepEqual(result.errors,[]);result.ok=true;
}catch(error){result.error=error.stack??String(error);if(page)await capture('failure').catch(()=>{});throw error;}finally{if(app){await page?.keyboard.press('Escape').catch(()=>{});if(result.ok){await app.close();result.normalExit=true;}else await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}db.close();await writeFile(out+'/result.json',JSON.stringify(result,null,2));}

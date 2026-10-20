// Product inputs and a fresh profile; SQLite reads are assertions, never UI shortcuts.
import {createRequire} from 'node:module';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
const root=process.cwd(),require=createRequire(import.meta.url),{_electron}=require('playwright-core'),{buildSync}=require('esbuild'),Database=require('better-sqlite3');
const cache=homedir()+'/.cache/saltmarcher';await mkdir(cache,{recursive:true});
const profile=await mkdtemp(cache+'/routes-native-'),out=root+'/.build/terrain-routes-native';await mkdir(out,{recursive:true});
const build=root+'/.build/terrain-routes-desktop';
await writeFile(out+'/build.mjs',(await readFile('tools/build-desktop.mjs','utf8')).replaceAll('.build/desktop','.build/terrain-routes-desktop'));
execFileSync(process.execPath,[out+'/build.mjs'],{cwd:root,stdio:'pipe'});
buildSync({stdin:{contents:"export * from './src/app/storage/store';export * from './src/app/terrain-height';export * from './src/app/atlas-landscape';export * from './src/app/landscape-line';export * from './src/app/terrain-spatial-model';",resolveDir:root},outfile:out+'/store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,heightRecord,emptyRecord,newLine,TerrainSampler,projectTerrain}=require(out+'/store.cjs');
const store=new CampaignStore(profile+'/workbench.sqlite'),cam=store.create('Straßen und Flüsse'),active=store.activate(cam.id);
const write=action=>store.executeAtlasCommit({commandId:randomUUID(),campaignId:cam.id,token:active.token,action});
for(let y=-1;y<=0;y++)for(let x=-1;x<=0;x++)write({kind:'landscape-put',expectedRevision:null,record:heightRecord(x*512,y*512,8,Float32Array.from({length:4096},(_,i)=>{
 const xx=x*512+i%64*8,yy=y*512+Math.floor(i/64)*8;return 65-xx*.03+45*Math.exp(-((xx-20)**2+(yy-140)**2)/4500);
}))});
const reference={...emptyRecord('road'),name:'Referenzstraße',width:8,line:newLine('road'),points:[{x:-180,y:0},{x:0,y:40},{x:180,y:0}]};
write({kind:'landscape-put',record:reference,expectedRevision:null});store.tutorial('skipped');store.close();
const db=new Database(profile+'/workbench.sqlite',{readonly:true}),records=()=>db.prepare('SELECT payload FROM atlas_landscape ORDER BY id').all().map(r=>JSON.parse(r.payload));
const result={profile,out,checks:[],errors:[],sourceHashes:{},exits:[]};let app,page;
for(const file of ['src/app/terrain-route.ts','src/app/terrain-route-planner.ts','src/app/terrain-route-ui.ts','src/app/terrain-route-view.ts','src/app/terrain-height.ts','src/app/terrain-brush.ts','src/app/storage/terrain-route.ts','src/app/terrain-spatial-view.ts','src/app/terrain-spatial-ui.ts','src/app/atlas-landscape-ui.ts',build+'/main.cjs',build+'/ui/renderer.js'])result.sourceHashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
const capture=name=>page.screenshot({path:out+'/'+name+'.png'});
const mark=name=>{result.checks.push(name);console.log(name);};
async function start(){
 app=await _electron.launch({executablePath:root+'/node_modules/electron/dist/electron',args:[build+'/main.cjs','--data-dir',profile,'--ozone-platform=x11'],timeout:60000});
 page=await app.firstWindow();page.setDefaultTimeout(30000);page.on('pageerror',e=>result.errors.push(e.stack));
 await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
 await page.locator('.campaign-card').filter({hasText:'Straßen und Flüsse'}).getByRole('button',{name:/^(Öffnen|Fortsetzen)$/}).click();
 await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
 if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
 await atlasCanvasReady(page);
}
async function close(){
 const process=app.process(),exit=new Promise(resolve=>process.once('exit',(code,signal)=>resolve({code,signal})));
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());const ended=await exit;assert.deepEqual(ended,{code:0,signal:null});result.exits.push(ended);app=null;
}
async function focus(name){await page.locator('#atlas-search').fill(name);await page.locator('#atlas-search-results button').filter({hasText:name}).first().click();await atlasCanvasReady(page);await page.locator('#atlas-search').fill('');}
const editor=()=>page.locator('#terrain-route-editor');
const action=name=>editor().locator(`[data-action="${name}"]`);
async function ready(){await page.waitForFunction(()=>document.querySelector('#route-canvas')?.getAttribute('aria-busy')==='false'&&!document.querySelector('#terrain-route-editor [data-action="save"]').disabled,null,{timeout:60000});}
async function change(id,value){await page.locator('#route-'+id).fill(String(value));await page.locator('#route-'+id).press('Tab');}
async function save(){await action('save').click();await page.waitForFunction(()=>document.querySelector('#route-status')?.textContent==='Verlauf und Geländeform gespeichert.',null,{timeout:60000});}
try{
 await start();await focus('Referenzstraße');await capture('00-existing-top');
 await page.locator('#land-selection').getByRole('button',{name:'Geländegerecht planen',exact:true}).click();await ready();
 await change('name','Passstraße');await change('width',12);await ready();await capture('01-road-top');
 await action('tilt').click();await capture('02-road-tilted');assert(!records().some(r=>r.route),'preview must remain readonly');
 await save();let road=records().find(r=>r.name==='Passstraße');assert(road.route.nodes.length>2);assert(road.route.protected);
 mark('Straße aus bestehender Linie planen, beide Ansichten und atomare Übernahme');
 const previous=JSON.stringify(road.route.anchors);await editor().getByText('Planungsgrenzen',{exact:true}).click();await change('cut',1);await action('cancel').click();assert.equal(JSON.stringify(records().find(r=>r.id===road.id).route.anchors),previous);
 await action('close').click();await atlasCanvasReady(page);
 await page.locator('#atlas-section').selectOption('terrain');await page.locator('[data-tool-group="water"]').click();await page.locator('[data-atlas-tool="river"]').click();
 await page.locator('#land-route-plan').click();await page.waitForFunction(()=>document.querySelector('#route-canvas')?.getAttribute('aria-busy')==='false');
 const canvas=await page.locator('#route-canvas').boundingBox();
 await page.mouse.click(canvas.x+canvas.width*.25,canvas.y+canvas.height*.5);await page.mouse.click(canvas.x+canvas.width*.7,canvas.y+canvas.height*.5);
 const positions=[[-150,-70],[150,-70]];
 for(let i=0;i<2;i++)for(const [j,axis]of ['X','Y'].entries()){const field=editor().getByRole('spinbutton',{name:axis+' Punkt '+(i+1),exact:true});await field.fill(String(positions[i][j]));await field.press('Tab');}
 await change('name','Talfluss');await action('fit').click();await ready();await action('tilt').click();await capture('03-river-preview');await save();
 const river=records().find(r=>r.name==='Talfluss');assert(river.route.nodes.every((p,i,a)=>!i||p.z<a[i-1].z));
 mark('Fluss mit echten Punktklicks und Koordinatenkorrektur, abfließendes Profil und verbundenes Bett');
 await page.locator('#route-protected').uncheck();await ready();await save();assert.equal(records().find(r=>r.id===river.id).route.protected,false);
 await page.locator('#route-protected').check();await ready();await save();assert.equal(records().find(r=>r.id===river.id).route.protected,true);
 mark('Schutz ist pro Verlauf schaltbar und gespeichert');
 await action('delete').click();await editor().waitFor({state:'detached'});await atlasCanvasReady(page);assert(!records().some(r=>r.id===river.id));
 await page.locator('#atlas-undo').click();await atlasCanvasReady(page);assert(records().some(r=>r.id===river.id));
 mark('Löschen und Atlas-Undo stellen Verlauf samt Geländeform wieder her');
 await focus('Passstraße');
 await page.locator('#atlas-view').click();await page.locator('#atlas-terrain-tilt').click();
 await page.mouse.click(20,20);await page.waitForFunction(()=>document.querySelector('#campaign-map')?.dataset.terrainReady==='ready',null,{timeout:60000});
 await capture('04-shared-tilted-atlas');
 mark('Gemeinsamer gekippter Atlas zeigt dieselben gespeicherten Verläufe');
 await page.locator('#atlas-section').selectOption('terrain');await page.locator('[data-tool-group="land"]').click();await page.locator('[data-atlas-tool="land-shape"]').click();
 await page.locator('#land-radius').fill('35');await page.locator('#land-height-strength').fill('100');await page.locator('#land-height-mode').selectOption('raise');await page.locator('#land-height-target-enabled').uncheck();
 await page.waitForFunction(()=>document.querySelector('#campaign-map')?.dataset.terrainReady==='ready',null,{timeout:60000});
 const normal=rs=>rs.map(({revision,...r})=>r),beforeBrush=normal(records()),point={x:-100,y:-70};
 const projection=await page.locator('#campaign-map').evaluate(n=>JSON.parse(n.dataset.terrainProjection)),rect=await page.locator('#campaign-map').boundingBox();
 const sampler=new TerrainSampler(records()),screen=projectTerrain(projection,point,sampler.waterLevel(point)??sampler.sample(point).heightM);
 await page.mouse.move(rect.x+screen.x*rect.width,rect.y+screen.y*rect.height);await page.mouse.down();await page.waitForTimeout(450);await page.mouse.up();
 await atlasCanvasReady(page);await page.waitForFunction(()=>document.querySelector('#campaign-map')?.dataset.terrainReady==='ready',null,{timeout:60000});
 assert.notDeepEqual(normal(records()),beforeBrush);assert(records().filter(r=>r.route?.protected).every(r=>!r.route.conflict));await capture('04b-protected-brush');
 await page.locator('#atlas-undo').click();await atlasCanvasReady(page);assert.deepEqual(normal(records()),beforeBrush);
 mark('Echter Geländepinselzug erhält geschützte Verläufe; ein Undo nimmt Gelände und Profile zurück');
 const expected=records().filter(r=>r.route).map(({revision,...r})=>r);await close();await start();assert.deepEqual(records().filter(r=>r.route).map(({revision,...r})=>r),expected);
 await focus('Passstraße');await capture('05-fresh-process');await close();
 mark('Frischer Prozess erhält Straßen, Flüsse, Profile und Schutz');
 assert.deepEqual(result.errors,[]);result.complete=true;
}catch(e){result.complete=false;result.error=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}
finally{await writeFile(out+'/result.json',JSON.stringify(result,null,2));db.close();if(app)await app.close();console.log(JSON.stringify({complete:result.complete,out,checks:result.checks.length}));}

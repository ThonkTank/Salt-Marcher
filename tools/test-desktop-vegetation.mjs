import {setBrushWorldRadius} from './atlas-brush-probe.mjs';
// Real Electron controls in a disposable profile. No author mutation via page.evaluate.
import {createRequire} from 'node:module';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {atlasCanvasReady,atlasCanvasPoint} from './atlas-canvas-probe.mjs';
const root=process.cwd(),require=createRequire(import.meta.url),{_electron}=require('playwright-core'),{buildSync}=require('esbuild');
const cache=homedir()+'/.cache/saltmarcher';await mkdir(cache,{recursive:true});
const dir=await mkdtemp(cache+'/vegetation-native-'),out=root+'/.build/vegetation-native';await mkdir(out,{recursive:true});
// Keep this probe's compiled application separate from other native probes.
await writeFile(out+'/build.mjs',(await readFile('tools/build-desktop.mjs','utf8')).replaceAll('.build/desktop','.build/vegetation-desktop'));
execFileSync(process.execPath,[out+'/build.mjs'],{cwd:root,stdio:'pipe'});
buildSync({stdin:{contents:"export * from './src/app/storage/store';export * from './src/app/atlas-landscape';export * from './src/app/terrain-height';export * from './src/app/vegetation';",resolveDir:root},outfile:out+'/store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,heightRecord,emptyRecord,vegetationSpec}=require(out+'/store.cjs'),Database=require('better-sqlite3');
const store=new CampaignStore(dir+'/workbench.sqlite'),cam=store.create('Vegetationsprobe'),active=store.activate(cam.id);
const write=action=>store.executeAtlasCommit({commandId:randomUUID(),campaignId:cam.id,token:active.token,action});
const save=r=>write({kind:'landscape-put',record:r,expectedRevision:null});
for(let y=-1;y<=0;y++)for(let x=-1;x<=0;x++)save(heightRecord(x*512,y*512,8,Float32Array.from({length:4096},(_,i)=>{
 const wx=x*512+i%64*8,wy=y*512+Math.floor(i/64)*8;return 35+80*Math.exp(-((wx+180)**2+(wy-80)**2)/40000);
})));
const poly=(x,y,w,h)=>({outer:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],holes:[]});
const wood={...emptyRecord('vegetation'),name:'Testwald',points:[],polygons:[poly(-300,-200,300,400)],resolution:3,values:{terrain:'forest'},vegetation:vegetationSpec('conifer',123)};
save(wood);
save({...emptyRecord('vegetation'),name:'Geröllhang',points:[],polygons:[poly(30,40,240,160)],resolution:3,values:{terrain:'hills'},vegetation:vegetationSpec('scree',77)});
save({...emptyRecord('road'),name:'Prüfweg',points:[{x:-280,y:-30},{x:260,y:30}],width:8});
write({kind:'landscape-vegetation-edit',mode:'clear',polygons:[poly(-160,-80,65,70)]});
const prototype=store.atlasVegetationScene(active.token,{x:-340,y:-240,width:680,height:480},.7);
store.tutorial('skipped');store.close();
const db=new Database(dir+'/workbench.sqlite',{readonly:true}),records=()=>db.prepare("SELECT payload FROM atlas_landscape WHERE json_extract(payload,'$.vegetation') IS NOT NULL").all().map(r=>JSON.parse(r.payload));
const result={profile:dir,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),checks:[],errors:[],sourceHashes:{}};
for(const file of ['src/app/vegetation.ts','src/app/vegetation-controls.ts','src/app/vegetation-spatial.ts','src/app/atlas-landscape-ui.ts','src/app/storage/vegetation.ts','.build/vegetation-desktop/ui/renderer.js','.build/vegetation-desktop/main.cjs'])result.sourceHashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
const mark=s=>{result.checks.push(s);console.log(s);};
let app,page;
async function close(){
 if(!app)return;const proc=app.process(),exit=new Promise(resolve=>proc.once('exit',(code,signal)=>resolve({code,signal})));
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
 const ended=await exit;assert.deepEqual(ended,{code:0,signal:null});app=null;result.exits??=[];result.exits.push(ended);
}
async function capture(name){await page.screenshot({path:out+'/'+name+'.png'});}
async function prototypeRun(){
 const build=out+'/prototype';await mkdir(build,{recursive:true});
 buildSync({entryPoints:['tools/vegetation-prototype/app.ts'],outfile:build+'/app.js',bundle:true,platform:'browser',format:'iife',define:{__SCENE__:JSON.stringify(prototype)}});
 await writeFile(build+'/index.html','<!doctype html><html lang="de"><meta charset="utf-8"><style>body{margin:0;background:#e9e3d4;font:16px sans-serif;color:#334b3c}header{padding:16px;display:flex;gap:16px;align-items:center}canvas{display:block;width:100vw;height:calc(100vh - 64px)}button{padding:8px 16px}</style><header><strong>SaltMarcher · Wald am Hang, Lichtung und Geröll</strong><button id="top">Draufsicht</button><button id="tilted">Räumlich</button></header><canvas></canvas><script src="app.js"></script></html>');
 await writeFile(build+'/main.cjs',`const {app,BrowserWindow}=require(${JSON.stringify(root+'/node_modules/electron')});app.setPath('userData',${JSON.stringify(dir+'/prototype-profile')});app.whenReady().then(()=>{const w=new BrowserWindow({width:1280,height:900,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});w.loadFile(${JSON.stringify(build+'/index.html')});});app.on('window-all-closed',()=>app.quit());`);
 // Electron's main process requires the built-in module, not the npm launcher.
 await writeFile(build+'/main.cjs',(await readFile(build+'/main.cjs','utf8')).replace(`require(${JSON.stringify(root+'/node_modules/electron')})`,"require('electron')"));
 app=await _electron.launch({executablePath:root+'/node_modules/electron/dist/electron',args:[build+'/main.cjs','--ozone-platform=x11'],timeout:45000});page=await app.firstWindow();
 await page.waitForFunction(()=>document.body.dataset.ready==='true');await capture('00-prototype-tilted');await page.locator('#top').click();await capture('01-prototype-top');
 result.prototype=await page.evaluate(()=>vegetationProbe.read());assert(result.prototype.instances>100);assert(result.prototype.calls<30);
 result.performance=await page.evaluate(()=>vegetationProbe.measure());
 await close();mark('Isolierter Prototyp: identische Bestände in Draufsicht und räumlich; regulärer Prozessabschluss');
}
async function start(){
 app=await _electron.launch({executablePath:root+'/node_modules/electron/dist/electron',args:[root+'/.build/vegetation-desktop/main.cjs','--data-dir',dir,'--ozone-platform=x11'],timeout:45000});
 page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',e=>result.errors.push(e.stack));
 await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
 await page.locator('.campaign-card').filter({hasText:'Vegetationsprobe'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
 await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
 if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
 await atlasCanvasReady(page);
 await page.locator('#atlas-search').fill('Prüfweg');await page.locator('#atlas-search-results button').filter({hasText:'Prüfweg'}).click();await atlasCanvasReady(page);
 await page.locator('#atlas-search').fill('');await page.locator('#atlas-units').selectOption('metric');await page.locator('#atlas-section').selectOption('terrain');
 await page.locator('[data-tool-group="vegetation"]').click();await atlasCanvasReady(page);
 for(let i=0;i<24;i++){const c=await camera();if(c.view.width<900)break;await page.getByRole('button',{name:'Vergrößern',exact:true}).click();}
 await atlasCanvasReady(page);
 const c=await camera(),scale=Math.min(c.width/c.view.width,c.height/c.view.height),cx=c.left+c.width/2,cy=c.top+c.height/2;
 await page.mouse.move(cx,cy);await page.mouse.down({button:'middle'});await page.mouse.move(cx+(c.view.x+c.view.width/2)*scale,cy+(c.view.y+c.view.height/2)*scale,{steps:10});await page.mouse.up({button:'middle'});await atlasCanvasReady(page);
}
const camera=()=>page.locator('#campaign-map').evaluate(n=>({view:JSON.parse(n.dataset.atlasView),left:n.getBoundingClientRect().left,top:n.getBoundingClientRect().top,width:n.clientWidth,height:n.clientHeight}));
async function at(x,y){return atlasCanvasPoint(page,{x,y},false);}
async function tool(id){await page.locator('[data-atlas-tool="'+id+'"]').click();await atlasCanvasReady(page);}
async function settled(){await page.waitForFunction(()=>!document.querySelector('#land-tool').disabled&&document.querySelector('#land-status').textContent==='Gespeichert');await atlasCanvasReady(page);}
async function stroke(a,b){const x=await at(...a),y=await at(...b);await page.mouse.move(x.x,x.y);await page.mouse.down();await page.mouse.move(y.x,y.y,{steps:8});await page.mouse.up();await settled();}
try{
 await prototypeRun();await start();await capture('02-product-before');
 await tool('vegetation');await page.locator('#vegetation-preset').selectOption('deciduous');await setBrushWorldRadius(page,'land-radius','45');
 const count=records().length;await stroke([80,-100],[220,-100]);assert.equal(records().length,count+1);const painted=records().find(r=>r.name==='Laubwald');assert(painted);assert.equal(painted.values.terrain,'forest');
 mark('Native Pinselgeste speichert Boden, Bewuchs und Geländeart gemeinsam');
 await capture('03-painted');
 await tool('vegetation-clear');await setBrushWorldRadius(page,'land-radius','25');await stroke([130,-100],[150,-100]);assert(records().find(r=>r.id===painted.id).vegetation.edits.length>0);
 mark('Dauerhafte Lichtung durch Freihalten');
 await tool('vegetation-object');await page.locator('#vegetation-asset').selectOption('rock');
 const p=await at(160,-110);await page.mouse.click(p.x,p.y);await page.locator('#land-finish').click();await settled();
 assert(records().find(r=>r.id===painted.id).vegetation.overrides.some(o=>o.asset==='rock'));
 mark('Manuell platzierter Findling als geschützte Einzelkorrektur');
 await page.locator('#atlas-select').click();const pick=await at(160,-110);await page.mouse.click(pick.x,pick.y);
 const beforeInvalid=records();
 await page.locator('#vegetation-edit-density').fill('1.25');
 await page.getByRole('button',{name:'Landschaftsänderung speichern',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#atlas-save-status').dataset.error==='true'&&!document.querySelector('#land-tool').disabled);
 assert.deepEqual(records(),beforeInvalid,'invalid visible density must not save the previous model value');
 assert.equal(await page.locator('#vegetation-edit-density').inputValue(),'1.25');
 await page.locator('#vegetation-edit-density').fill('0.33');
 await page.locator('#vegetation-object-size').fill('');
 await page.getByRole('button',{name:'Landschaftsänderung speichern',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#atlas-save-status').dataset.error==='true'&&!document.querySelector('#land-tool').disabled);
 assert.deepEqual(records(),beforeInvalid,'empty object size must not save its previous value');
 assert.equal(await page.locator('#vegetation-object-size').inputValue(),'');
 const locationCount=db.prepare('SELECT count(*) n FROM location').get().n;
 await page.getByRole('button',{name:'Als besonderen Ort anlegen',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#atlas-save-status').dataset.error==='true'&&!document.querySelector('#land-tool').disabled);
 assert.equal(db.prepare('SELECT count(*) n FROM location').get().n,locationCount);assert.deepEqual(records(),beforeInvalid);
 mark('Ungültige sichtbare Zahlen verhindern Speichern und erhalten den Entwurf');
 await page.locator('#vegetation-object-size').fill('8');await page.locator('#vegetation-object-angle').fill('33');await page.locator('#vegetation-object-x').fill('165');
 await page.getByRole('button',{name:'Landschaftsänderung speichern',exact:true}).click();await settled();
 assert.equal(records().find(r=>r.id===painted.id).vegetation.preset.density,.33);
 const corrected=records().find(r=>r.id===painted.id).vegetation.overrides[0];assert.equal(corrected.size,8);assert.equal(corrected.x,165);assert(Math.abs(corrected.angle-33*Math.PI/180)<1e-9);
 mark('Sichtbaren Findling auswählen, verschieben, skalieren und drehen');
 await capture('04-object-edited');
 await page.locator('#vegetation-spatial').click();await page.waitForFunction(()=>document.querySelector('#vegetation-spatial-canvas')?.getAttribute('aria-busy')==='false');
 assert((await page.locator('#vegetation-spatial-status').textContent()).includes('sichtbare Bestandsobjekte'));
 await capture('04-product-tilted');await page.locator('#vegetation-top-view').click();await capture('05-product-top');
 await page.locator('#vegetation-tilted-view').click();await page.locator('#vegetation-spatial-undo').click();await page.waitForFunction(()=>document.querySelector('#vegetation-spatial-canvas').getAttribute('aria-busy')==='false');
 assert.equal(records().find(r=>r.id===painted.id).vegetation.overrides[0].size,4);
 await page.locator('#vegetation-spatial-redo').click();await page.waitForFunction(()=>document.querySelector('#vegetation-spatial-canvas').getAttribute('aria-busy')==='false');
 assert.deepEqual(records().find(r=>r.id===painted.id).vegetation.overrides[0],corrected);
 mark('Räumliche Ansicht teilt Atlas-Undo/Redo und denselben Bestand');
 await page.locator('#vegetation-top-view').click();await page.locator('#vegetation-spatial-tool').selectOption('paint');await page.locator('#spatial-vegetation-preset').selectOption('scrub');
 const canvasBox=await page.locator('#vegetation-spatial-canvas').boundingBox(),oldCount=records().length,spatialBefore=records();
 await page.locator('#spatial-vegetation-size').fill('');
 await page.mouse.move(canvasBox.x+canvasBox.width*.64,canvasBox.y+canvasBox.height*.62);await page.mouse.down();await page.mouse.move(canvasBox.x+canvasBox.width*.72,canvasBox.y+canvasBox.height*.65,{steps:8});await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('#vegetation-spatial-canvas').getAttribute('aria-busy')==='false');
 await page.waitForFunction(()=>document.querySelector('#vegetation-spatial-status').textContent.includes('Entwurf bleibt erhalten'));
 assert.deepEqual(records(),spatialBefore);assert.equal(await page.locator('#spatial-vegetation-size').inputValue(),'');
 await page.locator('#spatial-vegetation-size').fill('9.5');
 await page.locator('#vegetation-spatial-finish').click();
 await page.waitForFunction(()=>document.querySelector('#vegetation-spatial-canvas').getAttribute('aria-busy')==='false');
 assert.equal(records().length,oldCount+1);assert(records().some(r=>r.vegetation.preset.id==='scrub'&&r.vegetation.preset.size===9.5&&r.points.length>1));
 mark('Direkt auf dem räumlichen Gelände gemalter Bestand wird im Atlas gespeichert');
 const clickSpatial=async(x,y)=>page.mouse.click(canvasBox.x+canvasBox.width*x,canvasBox.y+canvasBox.height*y);
 await page.locator('#vegetation-spatial-tool').selectOption('area');
 await clickSpatial(.55,.3);await clickSpatial(.65,.3);await clickSpatial(.6,.4);
 await page.locator('#vegetation-spatial-tool').selectOption('line');assert.equal(await page.locator('#vegetation-spatial-tool').inputValue(),'area');
 await page.locator('#vegetation-spatial-close').click();assert(await page.locator('#vegetation-spatial-canvas').isVisible());
 await page.locator('#vegetation-spatial-finish').click();await page.waitForFunction(()=>document.querySelector('#vegetation-spatial-canvas').getAttribute('aria-busy')==='false');assert.equal(records().length,oldCount+2);
 await clickSpatial(.55,.3);await page.locator('#vegetation-spatial-cancel').click();assert.equal(records().length,oldCount+2);
 await page.locator('#vegetation-spatial-tool').selectOption('line');await page.locator('#spatial-vegetation-preset').selectOption('conifer');
 await clickSpatial(.55,.23);await clickSpatial(.73,.23);await page.locator('#vegetation-spatial-finish').click();await page.waitForFunction(()=>document.querySelector('#vegetation-spatial-canvas').getAttribute('aria-busy')==='false');
 assert(records().some(r=>r.vegetation.layout==='row'&&r.points.length===2));
 mark('Räumliche Flächen und Baumreihen; offene Entwürfe bleiben beim Werkzeugwechsel erhalten, Abbruch schreibt nichts');
 await page.locator('#vegetation-tilted-view').click();await capture('07-spatial-painted');
 await app.evaluate(({dialog},filename)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:filename});},out+'/spatial-export.png');
 await page.locator('#vegetation-spatial-export').click();await page.waitForFunction(()=>document.querySelector('#vegetation-spatial-status').textContent.includes('als PNG gespeichert'));
 assert((await readFile(out+'/spatial-export.png')).length>10000);
 mark('Räumlicher PNG-Export über nativen Speicheranschluss');
 await page.locator('#vegetation-spatial-close').click();await atlasCanvasReady(page);
 await tool('vegetation-select');await page.locator('#vegetation-selection-filter').selectOption('rocks');const linkPoint=await at(corrected.x,corrected.y);await page.mouse.click(linkPoint.x,linkPoint.y);
 await page.getByRole('button',{name:'Als besonderen Ort anlegen',exact:true}).click();await settled();
 const linked=records().find(r=>r.id===painted.id).vegetation.overrides.find(o=>o.id===corrected.id);
 assert(linked.locationId);assert(db.prepare('SELECT id FROM location WHERE id=?').get(linked.locationId));
 mark('Abgewiesene Ortsanlage hinterlässt keinen Phantomverweis; gültige Anlage wird gemeinsam gespeichert');
 const expected=records();await close();await start();assert.deepEqual(records(),expected);await capture('06-reopened');await close();
 mark('Frischer Electron-Prozess erhält Flächen und geschützte Korrekturen');
 for(const [file,hash] of Object.entries(result.sourceHashes))assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),hash,'Source or bundle changed during native workflow: '+file);
 assert.deepEqual(result.errors,[]);result.complete=true;
}catch(e){result.complete=false;result.error=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}
finally{
 await writeFile(out+'/result.json',JSON.stringify(result,null,2));db.close();
 if(app){const proc=app.process(),timer=setTimeout(()=>proc.kill('SIGKILL'),4000);try{await app.close();}finally{clearTimeout(timer);}}
 console.log(JSON.stringify({complete:result.complete,out,checks:result.checks,profile:dir}));
}

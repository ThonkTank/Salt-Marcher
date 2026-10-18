// Full native ground-plan task; only an empty isolated campaign is seeded.
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {atlasCanvasReady,atlasCanvasPoint} from './atlas-canvas-probe.mjs';
const root=process.cwd(),require=createRequire(root+'/package.json'),{_electron}=require('playwright-core'),Database=require('better-sqlite3'),{PNG}=require('pngjs');
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/groundplan-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(root+'/.build/groundplan-store.cjs'),out=root+'/.build/dungeon-groundplan';await mkdir(out,{recursive:true});
const launches=[],results=[];let app,page,proxy,db;
async function until(check){const end=Date.now()+20000;while(!check()&&Date.now()<end)await new Promise(r=>setTimeout(r,25));assert(check(),'Expected confirmed source state');}
async function close(){const exit=new Promise(r=>app.process().once('exit',(code,signal)=>r({code,signal})));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).close());let timer;try{assert.deepEqual(await Promise.race([exit,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Normal close timed out')),10000))]),{code:0,signal:null});launches.at(-1).normalExit=true;app=null;}finally{clearTimeout(timer);}}
try{for(const scale of [1,2]){
 const profile=await mkdtemp('/tmp/dungeon-groundplan-'),store=new CampaignStore(profile+'/workbench.sqlite'),campaign=store.create('Torhalle, Wache und Archiv');store.tutorial('skipped');store.close();
 const bus=profile+'/bus';proxy=spawn('xdg-dbus-proxy',[process.env.DBUS_SESSION_BUS_ADDRESS,bus,'--filter','--talk=org.freedesktop.portal.Desktop','--talk=org.freedesktop.Notifications'],{stdio:'ignore'});for(let i=0;i<100&&!await stat(bus).catch(()=>null);i++)await new Promise(r=>setTimeout(r,20));
 const errors=[];
 async function launch(){
  app=await _electron.launch({executablePath:root+'/node_modules/electron/dist/electron',args:[root+'/.build/desktop/main.cjs','--ozone-platform=x11','--force-device-scale-factor='+scale,'--data-dir',profile],env:{...process.env,DBUS_SESSION_BUS_ADDRESS:'unix:path='+bus}});launches.push({scale,pid:app.process().pid});
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));w.unmaximize();w.setContentSize(1400,1000);});
  page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.stack));await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
  await page.locator('.campaign-card[data-campaign-id="'+campaign.id+'"]').getByRole('button',{name:/Öffnen|Fortsetzen/}).click();await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
  if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
  await page.locator('button[data-family="interior"]').click();await atlasCanvasReady(page);
 }
 await launch();db=new Database(profile+'/workbench.sqlite',{readonly:true});
 const rooms=()=>db.prepare('SELECT * FROM room ORDER BY id').all().map(r=>({...r,...JSON.parse(r.payload)})),room=name=>rooms().find(r=>r.name===name),doors=()=>db.prepare("SELECT payload FROM drawing_element WHERE kind='door' ORDER BY id").all().map(r=>JSON.parse(r.payload));
 const bindingsBefore=db.prepare("SELECT count(*) n FROM atlas_binding WHERE kind='dungeon'").get().n;await page.locator('#atlas-create-dungeon').click();let b=await page.locator('#campaign-map').boundingBox();await page.mouse.click(b.x+b.width*.5,b.y+b.height*.5);
 await until(()=>db.prepare("SELECT count(*) n FROM atlas_binding WHERE kind='dungeon'").get().n===bindingsBefore+1);await atlasCanvasReady(page);
 for(let i=0;i<24;i++){if(JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view')).width<70)break;await page.getByRole('button',{name:'Vergrößern',exact:true}).click();}await atlasCanvasReady(page);
 const binding=db.prepare("SELECT * FROM atlas_binding WHERE kind='dungeon' ORDER BY rowid DESC LIMIT 1").get(),world=p=>({x:binding.x+p.x,y:binding.y+p.y});
 const screen=async p=>atlasCanvasPoint(page,world(p),false);
 const choose=async name=>{await page.locator('#atlas-search').fill(name);await page.locator('#atlas-search-results button').filter({hasText:name}).click();await page.waitForFunction(n=>document.querySelector('#room-name')?.value===n,name);await atlasCanvasReady(page);};
 const tool=async name=>{await page.getByRole('button',{name,exact:true}).click();};
 for(const [index,name,left,right]of[[0,'Torhalle',-15.24,-6.096],[1,'Wachstube',-6.096,3.048],[2,'Archiv',3.048,12.192]]){
  await tool('Raumrechteck');assert.equal(await page.locator('#atlas-new-name').isVisible(),false,'Only the owning room-name field is offered');await page.locator('#drawing-room-name').fill(name);
  const a=await screen({x:left,y:-4.572}),z=await screen({x:right,y:4.572});
  if(index===1){await page.mouse.click(a.x,a.y);await page.mouse.click(z.x,z.y);}else{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(z.x,z.y,{steps:8});await page.mouse.up();}
  await until(()=>!!room(name));await page.waitForFunction(()=>document.querySelector('#campaign-atlas').dataset.roomDraw==='false');await atlasCanvasReady(page);
 }
 assert.equal(rooms().length,3);assert.deepEqual(rooms().map(r=>r.name).sort(),['Archiv','Torhalle','Wachstube']);
 for(const [name,x]of[['Torhalle',-6.096],['Wachstube',3.048]]){await choose(name);await tool('Tür / Portal');const p=await screen({x,y:0}),count=doors().length;await page.mouse.click(p.x,p.y);await until(()=>doors().length===count+1);await atlasCanvasReady(page);}
 assert.equal(doors().length,2);assert(doors().every(d=>d.anchor&&d.roomId));
 const output=async suffix=>{
  // Fit the complete authored ground plan through the public camera controls.
  
  for(let i=0;i<8;i++){const v=JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view')),pts=rooms().flatMap(r=>r.polygons.flatMap(p=>p.outer.map(world)));if(pts.every(p=>p.x>=v.x+2&&p.y>=v.y+2&&p.x<=v.x+v.width-2&&p.y<=v.y+v.height-2))break;await page.getByRole('button',{name:'Verkleinern',exact:true}).click();}
  await atlasCanvasReady(page);
  await page.locator('#atlas-output-open').click();const box=JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view'));if(!await page.locator('#atlas-export-size').isVisible())await page.locator('#atlas-output details summary').click();await page.locator('#atlas-export-size').fill('1536');await page.locator('#atlas-export-grid').uncheck();const file=profile+'/'+suffix+'.png';await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},file);const before=JSON.stringify({rooms:rooms(),doors:doors()});await page.locator('#atlas-export-png').click();await page.waitForFunction(()=>document.querySelector('#atlas-save-status').textContent==='Atlas-PNG gespeichert');const bytes=await readFile(file);assert.equal(JSON.stringify({rooms:rooms(),doors:doors()}),before,'Export never writes author geometry');const png=PNG.sync.read(bytes);assert(png.width>500&&png.height>500);await writeFile(out+'/'+suffix+'-'+scale+'.png',bytes);const p=world({x:-10.668,y:-6.096}),x=Math.floor((p.x-box.x)/box.width*png.width),y=Math.floor((p.y-box.y)/box.height*png.height),pixel=[...png.data.slice((y*png.width+x)*4,(y*png.width+x)*4+4)];await page.locator('#atlas-output-back').click();return {bytes,pixel};};
 const beforePng=await output('before'),original=structuredClone(room('Torhalle')),originalDoors=structuredClone(doors());
 await choose('Torhalle');await tool('Auswahl / Eckpunkte');const a=await screen({x:-10.668,y:-4.572}),z=await screen({x:-10.668,y:-7.62});await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(z.x,z.y,{steps:8});await page.mouse.up();await until(()=>room('Torhalle').revision>original.revision);await atlasCanvasReady(page);
 const enlarged=structuredClone(room('Torhalle'));assert.equal(enlarged.id,original.id);assert.equal(enlarged.name,'Torhalle');assert.deepEqual(enlarged.sections,original.sections);assert(Math.min(...enlarged.polygons[0].outer.map(p=>p.y))<Math.min(...original.polygons[0].outer.map(p=>p.y)));assert(doors().every(d=>d.anchor&&d.roomId));assert.deepEqual(doors().map(d=>d.id),originalDoors.map(d=>d.id));
 await page.locator('#atlas-undo').click();await until(()=>JSON.stringify(room('Torhalle').polygons)===JSON.stringify(original.polygons));await page.locator('#atlas-redo').click();await until(()=>JSON.stringify(room('Torhalle').polygons)===JSON.stringify(enlarged.polygons));await atlasCanvasReady(page);
 const afterPng=await output('after');assert(!afterPng.bytes.equals(beforePng.bytes),'Updated geometry reaches the actual PNG');assert.notDeepEqual(afterPng.pixel,beforePng.pixel,'The newly enlarged area is painted in the exported image');await page.screenshot({path:out+'/map-'+scale+'.png'});
 const saved={rooms:rooms(),doors:doors()};db.close();db=null;await close();await launch();await choose('Torhalle');db=new Database(profile+'/workbench.sqlite',{readonly:true});assert.deepEqual({rooms:rooms(),doors:doors()},saved);db.close();db=null;await close();proxy.kill();proxy=null;assert.deepEqual(errors,[]);results.push({scale,profile,rooms:3,doors:2,dragAndTwoClick:true,nameAndGrid:true,resizeUndoRedo:true,exportUpdated:true,reopened:true});
 }
 await writeFile(out+'/result.json',JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),launches,results},null,2));console.log(JSON.stringify({launches,results}));
}catch(e){if(page)await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}finally{db?.close();if(app)await app.close().catch(()=>{});proxy?.kill();}

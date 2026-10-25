import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,stat,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {createNativeSession} from './native-session.mjs';
import {createAtlasCanonicalFixture} from './atlas-canonical-fixture.mjs';

const root=process.cwd(),before=process.argv.includes('--before'),output=path.resolve(process.env.QA_CLOSE_OUTPUT??`.build/atlas-performance-plan/A0.10-${before?'before':'native'}-${Date.now()}`);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function manifest(files){return Object.fromEntries(await Promise.all(files.sort().map(async file=>[file,hash(await readFile(file))])));}
async function filesIn(dir){return(await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?filesIn(path.join(dir,e.name)):path.join(dir,e.name)))).flat();}
const inputs=execFileSync('rg',['--files','src','desktop','resources','package.json','package-lock.json','tools/build-desktop.mjs','tools/atlas-runtime-licenses.mjs','tools/test-desktop-atlas-close.mjs','tools/native-session.mjs','tools/atlas-canonical-fixture.mjs'],{encoding:'utf8'}).trim().split('\n');
const inputHashes=await manifest(inputs),runtimeHashes=await manifest(await filesIn('.build/desktop'));
const original=JSON.parse(await readFile('.build/atlas-performance-plan/original-measurements-manifest.json','utf8'));
for(const file of original.files)assert.equal(hash(await readFile(file.path)),file.sha256,'Historical measurement changed: '+file.path);
const native=await createNativeSession({root,output,name:'atlas-close'}),cases=[];
await writeFile(path.join(output,'identity.json'),JSON.stringify({startedUTC:new Date().toISOString(),node:process.version,head:native.source,dirty:native.dirty,inputHashes,runtimeHashes,electron:hash(await readFile('node_modules/electron/dist/electron')),originalMeasurementsVerified:original.files.length},null,2));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,message){for(let i=0;i<100;i++){if(await check())return;await delay(50);}throw Error(message);}
async function descendants(pid){const all=[];for(const name of await readdir('/proc'))if(/^\d+$/.test(name)){try{const raw=await readFile(`/proc/${name}/stat`,'utf8'),parts=raw.slice(raw.lastIndexOf(')')+2).split(' ');all.push({pid:Number(name),parent:Number(parts[1]),state:parts[0]});}catch{}}
 const found=new Set([pid]);let changed;do{changed=false;for(const p of all)if(found.has(p.parent)&&!found.has(p.pid)){found.add(p.pid);changed=true;}}while(changed);return[...found];}
let page;
try{
 const fixture=await createAtlasCanonicalFixture({profilePath:native.profile,campaignName:'Atlas Close Probe'});
 for(const mode of before?['close-material','close-geometry']:['close-material','close-geometry','material-error','geometry-error']){
  const consoleErrors=[];page=await native.launch(2);page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await native.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1920,1080));
  await page.evaluate(id=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:-96,y:-64,width:256,height:192})),fixture.campaignId);
  await page.locator('.campaign-card').filter({hasText:'Atlas Close Probe'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
  await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
  if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
  await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainReady==='ready'&&document.querySelector('#campaign-map').dataset.terrainQuality==='detail',null,{timeout:60000});
  await native.app.evaluate(({ipcMain,app},mode)=>{
   const state=globalThis.qaClose={mode,held:[],completed:[],cancelled:new Set(),snapshot:null,quitRequested:false,armed:true};
   const cancel=ipcMain._invokeHandlers.get('atlas:cancel-read');ipcMain.removeHandler('atlas:cancel-read');
   const key=(token,control)=>JSON.stringify([token,control?.owner,control?.id]);
   ipcMain.handle('atlas:cancel-read',(...args)=>{const id=key(args[1],args[2]);state.cancelled.add(id);for(const held of state.held)if(held.control===id){held.retired=true;held.resolve();}return cancel(...args);});
   for(const channel of ['atlas:material-tile','atlas:geometry-region']){
    const original=ipcMain._invokeHandlers.get(channel);ipcMain.removeHandler(channel);
    ipcMain.handle(channel,async(...args)=>{
     if(!state.armed)return original(...args);
     if(mode==='material-error'&&channel==='atlas:material-tile'||mode==='geometry-error'&&channel==='atlas:geometry-region'){
      const result=await original(...args);
      if(channel==='atlas:material-tile'&&state.cancelled.has(key(args[1],args[3])))return result;
      state.completed.push({channel,error:'QA genuine '+mode});return{ok:false,error:'QA genuine '+mode};
     }
     if(!(mode==='close-material'&&channel==='atlas:material-tile'||mode==='close-geometry'&&channel==='atlas:geometry-region'))return original(...args);
     const control=channel==='atlas:material-tile'?key(args[1],args[3]):null;
     await new Promise(resolve=>{const held={channel,control,resolve,retired:state.cancelled.has(control)};state.held.push(held);if(held.retired)resolve();});
     const result=await original(...args);state.completed.push({channel,ok:result.ok,error:result.error});return result;
    });
   }
   if(mode.startsWith('close-')){
    // Hold final process teardown only, so late real IPC replies can be observed
    // deterministically while Main is already stopping. No product branch is replaced.
    const quit=app.quit.bind(app);app.quit=()=>{state.quitRequested=true;};state.quit=quit;
    const listeners=ipcMain.listeners('campaign:close-ready');ipcMain.removeAllListeners('campaign:close-ready');
    ipcMain.on('campaign:close-ready',async(...args)=>{
     state.snapshot=await args[0].sender.executeJavaScript(`({hidden:document.querySelector('#campaign-atlas').hidden,surfaces:document.querySelectorAll('#atlas-terrain-spatial').length,terrainReady:document.querySelector('#campaign-map').dataset.terrainReady??null})`);
     for(const listener of listeners)listener(...args);
     state.armed=false;for(const held of state.held)held.resolve();
    });
   }
  },mode);
  const bounds=await page.locator('#campaign-map').boundingBox();assert(bounds);
  // Real camera navigation requests another geometry region and surface tiles.
  for(let i=0;i<8;i++){
   await page.mouse.move(bounds.x+bounds.width*.8,bounds.y+bounds.height*.5);await page.mouse.down({button:'middle'});
   await page.mouse.move(bounds.x+bounds.width*.2,bounds.y+bounds.height*.5,{steps:3});await page.mouse.up({button:'middle'});
   if(await native.app.evaluate(()=>globalThis.qaClose.mode.startsWith('close-')?globalThis.qaClose.held.some(x=>!x.retired):globalThis.qaClose.completed.length>0))break;
   await delay(150);
  }
  if(mode.startsWith('close-')){
   await until(()=>native.app.evaluate(()=>globalThis.qaClose.held.some(x=>!x.retired)),'Current read did not become pending');
   await native.capture(page,mode+'-pending.png');const pids=await descendants(native.launches.at(-1).pid);
   const closing=native.close();
   await until(()=>native.app.evaluate(()=>!!globalThis.qaClose.snapshot&&globalThis.qaClose.quitRequested&&globalThis.qaClose.completed.length===globalThis.qaClose.held.length),'Native shutdown did not finish its read responses');
   // Renderer microtasks and a paint must consume the actual shutdown replies.
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const observed=await native.app.evaluate(()=>({snapshot:globalThis.qaClose.snapshot,held:globalThis.qaClose.held.map(x=>({channel:x.channel,retired:x.retired,control:x.control})),completed:globalThis.qaClose.completed,quitRequested:globalThis.qaClose.quitRequested}));
   const ui=await page.evaluate(()=>({state:document.querySelector('#campaign-map').dataset.terrainReady??null,status:document.querySelector('#status').textContent,atlasStatus:document.querySelector('#atlas-save-status').textContent}));
   await native.app.evaluate(()=>globalThis.qaClose.quit());await closing;
   await until(async()=>!(await Promise.all(pids.map(pid=>stat('/proc/'+pid).then(()=>true,()=>false)))).some(Boolean),'Native descendants remain after normal exit');
   cases.push({mode,observed,ui,consoleErrors,pids,allPidsAbsent:true});
   if(before){assert.equal(observed.snapshot.hidden,false);assert(JSON.stringify(ui).includes('Schließen angehalten')||consoleErrors.some(e=>e.includes('Schließen angehalten')),'Expected original shutdown error was not reproduced');}
   else{assert.equal(observed.snapshot.hidden,true);assert.equal(observed.snapshot.surfaces,0);assert.deepEqual(consoleErrors,[]);assert(!JSON.stringify(ui).includes('Schließen angehalten'));}
  }else{
   const marker='QA genuine '+mode;
   await page.waitForFunction(marker=>document.querySelector('#status').textContent.includes(marker)||document.querySelector('#atlas-save-status').textContent.includes(marker),marker);
   await native.capture(page,mode+'.png');const ui=await page.evaluate(()=>({terrain:document.querySelector('#campaign-map').dataset.terrainReady,region:document.querySelector('#campaign-atlas').dataset.regionState,status:document.querySelector('#status').textContent,atlasStatus:document.querySelector('#atlas-save-status').textContent}));
   assert(JSON.stringify(ui).includes(marker),'Genuine read failure was suppressed');
   const pids=await descendants(native.launches.at(-1).pid);await native.close();await until(async()=>!(await Promise.all(pids.map(pid=>stat('/proc/'+pid).then(()=>true,()=>false)))).some(Boolean),'Native descendants remain');
   cases.push({mode,ui,consoleErrors,pids,allPidsAbsent:true});
  }
 }
 assert.deepEqual(await manifest(inputs),inputHashes,'Build inputs changed during native probe');assert.deepEqual(await manifest(await filesIn('.build/desktop')),runtimeHashes,'Runtime changed during native probe');
 for(const file of original.files)assert.equal(hash(await readFile(file.path)),file.sha256,'Historical measurement changed');
 await native.finish({qualification:before?'original defect reproduced':'A0.10 native close and genuine failure counterprobes',cases,inputManifest:'identity.json',finishedUTC:new Date().toISOString()});console.log(output);
}catch(error){await writeFile(path.join(output,'cases.json'),JSON.stringify(cases,null,2));await native.fail(error);throw error;}finally{await native.dispose();}

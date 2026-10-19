import {createRequire} from 'node:module';
import {mkdtemp,mkdir,stat,readFile,writeFile} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';

// Real UI, disposable databases, a confirmed deadline and the same group after Fresh.
const root=process.cwd(),require=createRequire(root+'/package.json'),{_electron}=require('playwright-core');
const output=process.env.QA_EVIDENCE_DIR??root+'/.build/agenda-deadline';await mkdir(output,{recursive:true});
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/agenda-deadline-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(root+'/.build/agenda-deadline-store.cjs');
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty=!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();
const hashes=Object.fromEntries(await Promise.all(['main.cjs','preload.cjs','ui/renderer.js','ui/index.html','ui/app.css'].map(async rel=>[rel,createHash('sha256').update(await readFile(root+'/.build/desktop/'+rel)).digest('hex')])));
const launches=[],results=[],errors=[];let app,page,stage='fixture';
async function close(){
 const process=app.process(),exited=new Promise(r=>process.once('exit',(code,signal)=>r({code,signal})));let timer;
 try{
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).close());
  const exit=await Promise.race([exited,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Normal close timed out')),10000))]);
  assert.deepEqual(exit,{code:0,signal:null});launches.at(-1).exit=exit;app=null;
 }finally{clearTimeout(timer);}
}
async function capture(name){
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const png=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).webContents.capturePage()).toPNG().toString('base64'));
 await writeFile(output+'/'+name+'.png',Buffer.from(png,'base64'));
}
for(const scale of [1,2]){
 const profile=await mkdtemp('/tmp/agenda-deadline-'),file=profile+'/workbench.sqlite',store=new CampaignStore(file),campaign=store.create('Frist des Nordtors'),w=store.activate(campaign.id),command=action=>({commandId:randomUUID(),campaignId:campaign.id,token:w.token,action});
 let scene=store.executeLive(command({kind:'initialize',expectedRosterRevision:0})).scene;
 scene=store.executeLive(command({kind:'scene-content',sceneId:scene.id,expectedRevision:scene.revision,title:'Wache am Nordtor',notes:'  Laufende Gruppenprosa\r\n',locationId:null})).scene;
 const original={id:randomUUID(),revision:0,name:'Unbeteiligter Feiertag',startMs:String(10*86400000),durationMs:'3600000',repeatMs:null,locationId:null,notes:'  Geschützter Originaltext\r\n',trashed:false};
 store.executeWorld(command({kind:'calendar-event',event:original,expectedRevision:null}));const savedOriginal=store.world(w.token).events[0],originalScene=structuredClone(store.live(w.token).scene);
 store.tutorial('skipped');store.close();
 const bus=profile+'/bus',proxy=spawn('xdg-dbus-proxy',[process.env.DBUS_SESSION_BUS_ADDRESS,bus,'--filter','--talk=org.freedesktop.portal.Desktop','--talk=org.freedesktop.Notifications'],{stdio:'ignore'});
 for(let i=0;i<100&&!await stat(bus).catch(()=>null);i++)await new Promise(r=>setTimeout(r,20));
 async function launch(){
  app=await _electron.launch({executablePath:root+'/node_modules/electron/dist/electron',args:[root+'/.build/desktop/main.cjs','--ozone-platform=x11','--force-device-scale-factor='+scale,'--data-dir',profile],env:{...process.env,DBUS_SESSION_BUS_ADDRESS:'unix:path='+bus}});
  launches.push({scale,pid:app.process().pid});page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.stack));
  await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
  await page.locator('.campaign-card[data-campaign-id="'+campaign.id+'"]').getByRole('button',{name:/Öffnen|Fortsetzen/}).click();
  await page.waitForFunction(id=>document.getElementById('campaigns').value===id&&!document.getElementById('workspace-navigation').inert,campaign.id);
  const tab=page.getByRole('button',{name:'Party und Leiten',exact:true});
  if(!await tab.isVisible()){
   if(await page.locator('#atlas-navigation').isVisible())await page.locator('#atlas-navigation').click();else await page.locator('#workspace-nav-summary').click();
  }
  await tab.click();await page.locator('#live-agenda-open').waitFor();
 }
 async function agenda(){
  await page.locator('#live-agenda-open').click();await page.waitForFunction(()=>document.getElementById('agenda-status').textContent.includes('Countdowns'));
 }
 async function snapshot(){const fresh=new CampaignStore(file);try{const active=fresh.activate(campaign.id);return{scene:fresh.live(active.token).scene,events:fresh.world(active.token).events};}finally{fresh.close();}}
 try{
  stage='create relative deadline at '+scale;await launch();await agenda();assert.equal(await page.locator('#agenda-horizon').inputValue(),'5');
  await page.getByRole('button',{name:'Neue Frist / Ereignis',exact:true}).click();
  await page.locator('#agenda-name').fill('Nordtor schließt');await page.locator('#agenda-offset').fill('6');await page.locator('#agenda-offset-unit').selectOption('day');await page.locator('#agenda-duration').fill('1');await page.locator('#agenda-duration-unit').selectOption('hour');
  const notes='  Die Wache wartet auf die Gruppe.\nOriginale Vorbereitung bleibt erhalten.';await page.locator('#agenda-notes').fill(notes);
  await page.getByRole('button',{name:'Ereignis speichern',exact:true}).click();await page.waitForFunction(()=>document.getElementById('agenda-status').textContent.includes('Ereignis gespeichert.'));
  const created=await snapshot(),event=created.events.find(e=>e.name==='Nordtor schließt');assert(event);assert.equal(event.startMs,String(6*86400000));assert.equal(event.notes,notes);assert.deepEqual(created.scene,originalScene);
  const row=()=>page.locator('#agenda-list [data-event-id="'+event.id+'"]');await row().waitFor();assert.equal(await row().getAttribute('aria-pressed'),'true');assert.match(await page.locator('#campaign-agenda').innerText(),/Einzelansicht/);
  await capture('saved-'+scale);
  await page.getByRole('button',{name:'Ereignis bearbeiten',exact:true}).click();assert.equal(await page.locator('#agenda-notes').inputValue(),notes);await page.getByRole('button',{name:'Eingaben verwerfen',exact:true}).click();
  await page.locator('#campaign-agenda').getByRole('button',{name:'Schließen',exact:true}).click();
  stage='preview and confirm time at '+scale;await page.locator('#time-plan-open').click();await page.locator('#time-navigator-amount').fill('7');await page.locator('#time-navigator-unit').selectOption('day');
  await page.locator('#time-navigator').getByRole('button',{name:'Vorschau berechnen',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('time-navigator-preview').textContent.includes('Nordtor schließt'));
  assert.match(await page.locator('#time-navigator-preview').innerText(),/Ereignisbeginne in dieser Zeit: 1/);assert.deepEqual((await snapshot()).scene,originalScene);await capture('time-preview-'+scale);
  await page.locator('#time-navigator').getByRole('button',{name:'Zeit ausdrücklich verstreichen lassen',exact:true}).click();await page.locator('#time-navigator').waitFor({state:'hidden'});
  const advanced=await snapshot();assert.equal(advanced.scene.clock.instantMs,String(7*86400000));assert.equal(advanced.scene.clock.revision,originalScene.clock.revision+1);assert.equal(advanced.scene.id,scene.id);assert.equal(advanced.scene.notes,originalScene.notes);assert.equal(advanced.scene.locationId,originalScene.locationId);assert.deepEqual(advanced.events,created.events);await close();
  stage='Fresh and further edit at '+scale;await launch();await agenda();await page.locator('#agenda-past').check();await page.locator('#agenda-search').fill('Nordtor schließt');await row().waitFor();await row().click();assert.match(await page.locator('#agenda-document').innerText(),/Abgelaufen/);await capture('fresh-'+scale);
  await page.getByRole('button',{name:'Ereignis bearbeiten',exact:true}).click();assert.equal(await page.locator('#agenda-notes').inputValue(),notes);const changed=notes+'\nDie Gruppe steht vor dem geschlossenen Tor.';await page.locator('#agenda-notes').fill(changed);await page.getByRole('button',{name:'Ereignis speichern',exact:true}).click();await page.waitForFunction(()=>document.getElementById('agenda-status').textContent.includes('Ereignis gespeichert.'));await row().waitFor();assert.match(await page.locator('#agenda-document').innerText(),/Abgelaufen/);await close();
  const final=await snapshot(),saved=final.events.find(e=>e.id===event.id);assert.equal(final.events.length,2);assert.deepEqual(final.events.find(e=>e.id===original.id),savedOriginal);assert.deepEqual(saved,{...event,revision:event.revision+1,notes:changed});assert.deepEqual(final.scene,advanced.scene);
  results.push({scale,profile,eventId:event.id,creationLeavesSceneUntouched:true,savedOutsideHorizonSelected:true,previewReadOnly:true,crossedEvents:1,timeConfirmedOnce:true,reopenedSameEvent:true,furtherEditPreservesInstant:true,unrelatedEventUnchanged:true});
 }catch(error){if(app)await capture('failure-'+scale).catch(()=>{});await writeFile(output+'/failure.json',JSON.stringify({source,dirty,stage,error:error.stack,launches},null,2));throw error;}
 finally{if(app)await app.close();proxy.kill();}
}
assert.deepEqual(errors,[]);for(const {pid} of launches)assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
await writeFile(output+'/result.json',JSON.stringify({source,dirty,hashes,launches,results},null,2));console.log(JSON.stringify({launches,results}));

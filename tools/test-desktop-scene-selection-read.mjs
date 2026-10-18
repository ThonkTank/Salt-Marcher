import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';

const source=process.cwd(),output=path.resolve(process.argv[2]??'.build/scene-selection-evidence');
await mkdir(output,{recursive:true});
const require=createRequire(source+'/package.json'),{_electron}=require('playwright-core');
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/scene-selection-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(source+'/.build/scene-selection-store.cjs');
function fixture(){
 const dir=mkdtempSync(tmpdir()+'/scene-encounter-selection-'),file=dir+'/workbench.sqlite',x={dir,file,store:new CampaignStore(file)};x.cam=x.store.create('Zwei Gruppen am Tor');x.w=x.store.activate(x.cam.id);x.cmd=action=>({commandId:randomUUID(),campaignId:x.cam.id,token:x.w.token,action});
 x.heroes=['Ada','Borin','Cora','Inaktiv'].map(name=>x.store.executeLive(x.cmd({kind:'create-character',profile:{name}})).character);
 let live=x.store.live(x.w.token);x.store.executeLive(x.cmd({kind:'initialize',expectedRosterRevision:live.rosterRevision}));
 for(const hero of x.heroes.slice(0,3)){live=x.store.live(x.w.token);const c=live.roster.find(c=>c.id===hero.id);x.store.executeLive(x.cmd({kind:'membership',characterId:c.id,expectedRevision:c.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:live.scene.id,expectedFocusRevision:live.focusRevision}));}
 for(const hero of x.heroes){const p=x.store.progress(x.w.token).characters.find(p=>p.characterId===hero.id);x.store.executeProgress(x.cmd({kind:'xp',characterId:hero.id,expectedRevision:p.revision,mode:'set',amount:hero===x.heroes[3]?355000:900,reason:'Start'}));}
 x.planId=randomUUID();const visitId=randomUUID();x.store.changePreparation({...x.cmd(null),change:{kind:'plan',expectedRevision:null,plan:{version:1,id:x.planId,revision:1,name:'Tor',scenes:[{id:visitId,title:'Torkampf',notes:'',locationId:null}]}}});
 let visitRevision=0;for(const [name,creature,count]of [['Goblintrupp','goblin',2],['Torwache','guard',1]]){const p=x.store.saveEncounterPlan({...x.cmd(null),expectedRevision:null,plan:{id:randomUUID(),revision:0,name,notes:'  Eigene Notizen\r\n'+name,party:[],entries:[{id:randomUUID(),creatureId:creature,count,grouped:true}],sources:[],catalogHash:''}});const s=x.store.executeSession(x.cmd({kind:'attach',planId:x.planId,visitId,expectedVisitRevision:visitRevision,encounterId:p.id,expectedEncounterRevision:p.revision}));visitRevision=s.visits[0].revision;}
 live=x.store.live(x.w.token);x.scene=x.store.executeLive(x.cmd({kind:'apply-visit',sceneId:live.scene.id,expectedRevision:live.scene.revision,planId:x.planId,visitId,expectedPlanRevision:1,expectedVisitRevision:visitRevision})).scene;
 x.groups=()=>x.store.scenePreparation(x.w.token,x.scene.id).groups.map(g=>x.store.groupView(x.w.token,g.id));
 return x;
}
const x=fixture(),profile=x.dir,file=x.file,campaign=x.cam,scene=x.scene;
const originalGroups=x.groups(),legacyJsonBytes=Buffer.byteLength(JSON.stringify([x.store.live(x.w.token),x.store.progress(x.w.token),x.store.scenePreparation(x.w.token,scene.id),...originalGroups]));x.store.close();
const busPath=profile+'/bus',proxy=spawn('xdg-dbus-proxy',[process.env.DBUS_SESSION_BUS_ADDRESS,busPath,'--filter','--talk=org.freedesktop.portal.Desktop','--talk=org.freedesktop.Notifications'],{stdio:'ignore'});
for(let i=0;i<100;i++){if(await stat(busPath).then(()=>true).catch(()=>false))break;await new Promise(r=>setTimeout(r,20));}
let app,closed=true;const errors=[],results=[],artifacts={};
for(const p of ['main.cjs','preload.cjs','ui/renderer.js','ui/index.html','ui/app.css'])artifacts[p]=createHash('sha256').update(await readFile('.build/desktop/'+p)).digest('hex');
try{
 for(const scale of [1,2]){
  app=await _electron.launch({executablePath:source+'/node_modules/electron/dist/electron',args:[source+'/.build/desktop/main.cjs','--ozone-platform=x11','--force-device-scale-factor='+scale,'--data-dir',profile],env:{...process.env,DBUS_SESSION_BUS_ADDRESS:'unix:path='+busPath},timeout:30000});closed=false;
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.stack));page.setDefaultTimeout(15000);
  await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
  if(await page.locator('#tutorial-dialog').isVisible())await page.locator('#tutorial-skip').click();
  await page.locator('.campaign-card[data-campaign-id="'+campaign.id+'"]').getByRole('button',{name:/^(Öffnen|Fortsetzen)$/}).click();await page.locator('#live-tab').click();
  if(await page.locator('#live-continue').isVisible())await page.locator('#live-continue').click();
  await page.locator('#combat-resume').click();
  if(scale===1){
   await page.waitForFunction(()=>document.querySelectorAll('#combat-selection-groups > article').length===2);
   await app.evaluate(({ipcMain})=>{
    globalThis.__selectionReads={};globalThis.__selectionWatch=false;globalThis.__selectionFail=false;
    for(const name of ['campaign:scene-encounter-selection','campaign:live','campaign:progress','campaign:scene-preparation','campaign:group-view']){
     const read=ipcMain._invokeHandlers.get(name);if(!read)continue;ipcMain.removeHandler(name);
     ipcMain.handle(name,async(event,...args)=>{
      if(globalThis.__selectionWatch){globalThis.__selectionReads[name]=(globalThis.__selectionReads[name]??0)+1;
       if(name==='campaign:progress')return{ok:false,error:'Unabhängiger Kampagnenfortschritt nicht verfügbar'};
       if(name==='campaign:scene-encounter-selection'&&globalThis.__selectionFail)return{ok:false,error:'Auswahl vorübergehend nicht lesbar'};
      }
      const result=await read(event,...args);
      if(name==='campaign:scene-encounter-selection'&&result.ok&&globalThis.__selectionUnavailable){const id=globalThis.__selectionUnavailable,title=result.value.groups.find(g=>g.id===id)?.title;result.value.groups=result.value.groups.filter(g=>g.id!==id);result.value.unavailableGroups.push({id,title,problem:'Kontrollierter Gruppenlesefehler'});}
      if(name==='campaign:scene-encounter-selection')globalThis.__selectionFrame=result;
      return result;
     });
    }
   });
   await app.evaluate(()=>{globalThis.__selectionWatch=true;});
   await page.locator('#combat-selection-refresh').click();
   await page.waitForFunction(()=>!document.querySelector('#combat-selection-refresh').disabled);
   await page.screenshot({path:output+'/read-'+scale+'.png'});
   assert.equal(await page.locator('#combat-selection-groups > article').count(),2,'a focused selection must work without the global progress reader');
   const counts=await app.evaluate(()=>globalThis.__selectionReads);assert.deepEqual(counts,{'campaign:scene-encounter-selection':1});
   const frame=await app.evaluate(()=>globalThis.__selectionFrame);assert.equal(frame.ok,true);
   assert.equal(JSON.stringify(frame.value).includes('Eigene Notizen'),false);assert.equal('roster' in frame.value,false);
   // Exercise a partial answer through the same IPC route; actual corrupt-profile
   // isolation is covered by the SQLite/DOM regression.
   await app.evaluate((_electron,id)=>{globalThis.__selectionUnavailable=id;},frame.value.groups[0].id);
   await page.locator('#combat-selection-refresh').click();
   await page.waitForFunction(()=>document.querySelectorAll('[data-unavailable-group-id]').length===1&&!document.querySelector('#combat-selection-refresh').disabled);
   assert.equal(await page.locator('#combat-selection-groups > article > label > input').count(),1);
   await page.locator('#combat-selection-groups > article > label > input').check();assert.equal(await page.locator('#combat-selection-prepare').isDisabled(),false);
   await page.screenshot({path:output+'/partial-'+scale+'.png'});
   await app.evaluate(()=>{globalThis.__selectionUnavailable=null;});
   await app.evaluate(()=>{globalThis.__selectionFail=true;});await page.locator('#combat-selection-refresh').click();
   await page.waitForFunction(()=>!document.querySelector('#combat-selection-refresh').disabled);
   assert.match(await page.locator('#combat-selection-status').textContent(),/Auswahl vorübergehend nicht lesbar/);
   assert.equal(await page.locator('#combat-selection-groups > article').count(),0);assert.match(await page.locator('#combat-selection-party').textContent(),/nicht verfügbar/);assert.match(await page.locator('#combat-selection-groups').textContent(),/nicht geladen/);assert.equal(await page.locator('#combat-selection-prepare').isDisabled(),true);
   await app.evaluate(()=>{globalThis.__selectionFail=false;});await page.locator('#combat-selection-refresh').click();
   await page.waitForFunction(()=>document.querySelectorAll('#combat-selection-groups > article').length===2);
   await app.evaluate(()=>{globalThis.__selectionWatch=false;});
   for(const box of await page.locator('#combat-selection-groups > article > label > input').all())await box.check();
   assert.match(await page.locator('#combat-selection-result').textContent(),/250 angepasste XP/);
   await page.locator('#combat-selection-title').fill('Wachen am Tor');await page.locator('#combat-selection-prepare').click();
   await page.waitForFunction(()=>document.querySelector('#combat-status').textContent.includes('Vorbereitung'));
   await page.locator('#combat-status').scrollIntoViewIfNeeded();
   await page.screenshot({path:output+'/initiative-'+scale+'.png'});results.push({scale,counts,legacyJsonBytes,selectionJsonBytes:Buffer.byteLength(JSON.stringify(frame.value))});
  }else{
   await page.waitForFunction(()=>document.querySelector('#combat-status').textContent.includes('Vorbereitung'));
   assert.equal(await page.locator('#combat-title').innerText(),'Wachen am Tor');
   await page.locator('#combat-status').scrollIntoViewIfNeeded();
   await page.screenshot({path:output+'/initiative-restarted-'+scale+'.png'});results.push({scale});
  }
  assert.equal(await page.evaluate(()=>window.devicePixelRatio),scale);
  const ended=new Promise(resolve=>app.process().once('exit',(code,signal)=>resolve({code,signal})));
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).close());
  const exit=await ended;assert.deepEqual(exit,{code:0,signal:null});closed=true;results.at(-1).exit=exit;
 }
 const fresh=new CampaignStore(file);try{
  const token=fresh.activate(campaign.id).token,combat=fresh.combat(token,scene.id).combat;
  assert.equal(combat.title,'Wachen am Tor');assert.equal(combat.phase,'preparing');assert.equal(combat.participants.length,6);
  assert.deepEqual(fresh.scenePreparation(token,scene.id).groups.map(g=>fresh.groupView(token,g.id)),originalGroups);
 }finally{fresh.close();}
 assert.deepEqual(errors,[]);
 await writeFile(path.join(output,'result.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTree:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),profile,results,errors,artifacts},null,2));console.log(JSON.stringify({results,groupFactsUnchanged:true}));
}catch(error){await writeFile(path.join(output,'failure.json'),JSON.stringify({error:error.stack,profile,results,errors},null,2));if(app&&!closed)try{await(await app.firstWindow()).screenshot({path:path.join(output,'failure.png')});}catch{}throw error;}
finally{if(app&&!closed)await app.close();proxy.kill();}

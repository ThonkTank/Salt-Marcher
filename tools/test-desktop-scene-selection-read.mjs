// One native path: absence, confirmed rest, return, saved groups, combat and fresh result.
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
const require=createRequire(source+'/package.json'),{_electron}=require('playwright-core'),Database=require('better-sqlite3');
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/scene-selection-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(source+'/.build/scene-selection-store.cjs');
function fixture(){
 const dir=mkdtempSync(tmpdir()+'/scene-encounter-selection-'),file=dir+'/workbench.sqlite',x={dir,file,store:new CampaignStore(file)};x.cam=x.store.create('Zwei Gruppen am Tor');x.w=x.store.activate(x.cam.id);x.cmd=action=>({commandId:randomUUID(),campaignId:x.cam.id,token:x.w.token,action});
 x.heroes=['Ada','Borin','Cora','Inaktiv'].map(name=>x.store.executeLive(x.cmd({kind:'create-character',profile:{name}})).character);
 let live=x.store.live(x.w.token);x.store.executeLive(x.cmd({kind:'initialize',expectedRosterRevision:live.rosterRevision}));
 for(const hero of x.heroes.slice(0,3)){live=x.store.live(x.w.token);const c=live.roster.find(c=>c.id===hero.id);x.store.executeLive(x.cmd({kind:'membership',characterId:c.id,expectedRevision:c.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:live.scene.id,expectedFocusRevision:live.focusRevision}));}
 for(const hero of x.heroes){const p=x.store.progress(x.w.token).characters.find(p=>p.characterId===hero.id);x.store.executeProgress(x.cmd({kind:'xp',characterId:hero.id,expectedRevision:p.revision,mode:'set',amount:hero===x.heroes[3]?355000:900,reason:'Start'}));}
 live=x.store.live(x.w.token);const progress=x.store.progress(x.w.token);
 x.store.executeProgress(x.cmd({kind:'party-award',expectedRosterRevision:live.rosterRevision,poolXp:0,loadXp:720,reason:'Belastung vor der Rast',participants:live.roster.filter(c=>c.active).map(c=>({characterId:c.id,revision:progress.characters.find(p=>p.characterId===c.id).revision,membershipRevision:c.membershipRevision,receiveXp:false,receiveLoad:true}))}));
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
function facts(){const db=new Database(file,{readonly:true});try{return{progress:db.prepare('SELECT id,payload FROM character_progress ORDER BY id').all(),clock:db.prepare('SELECT * FROM scene_clock WHERE scene_id=?').get(scene.id),combat:db.prepare('SELECT payload FROM combat WHERE scene_id=? ORDER BY ordinal DESC LIMIT 1').get(scene.id)?.payload};}finally{db.close();}}
async function until(check){const end=Date.now()+20000;while(!check()&&Date.now()<end)await new Promise(r=>setTimeout(r,25));assert(check(),'Expected confirmed Party/Combat state');}
async function restWithAbsentMember(page){
 const absent=x.heroes[2].id,original=facts(),state=f=>JSON.parse(f.progress.find(p=>p.id===absent).payload);
 await page.locator('#party-shortcut').click();await page.locator('#party-active .party-card').nth(2).waitFor();
 const active=page.locator('#party-active [data-character-id="'+absent+'"]');await active.locator('.party-member-toggle').click();await active.getByRole('button',{name:'Aus Party',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('#party-active .party-card').length===2&&!document.querySelector('#party-short-rest').disabled);
 await page.locator('#party-rest > summary').click();assert.equal(await page.locator('#party-rest-members input').count(),2);
 const before=facts();await page.locator('#party-short-rest').click();assert.match(await page.locator('#party-rest-status').innerText(),/Ada, Borin/);assert(!await page.locator('#party-rest-status').innerText().then(t=>t.includes('Cora')));assert.deepEqual(facts(),before,'the first rest click is read-only');
 await page.locator('#party-short-rest').click();await until(()=>facts().clock.instant_ms!==before.clock.instant_ms);await page.waitForFunction(()=>!document.querySelector('#party-short-rest').disabled);
 const rested=facts();assert.equal(BigInt(rested.clock.instant_ms)-BigInt(before.clock.instant_ms),3600000n);assert.deepEqual(state(rested),state(original),'the absent figure receives no rest');
 for(const hero of x.heroes.slice(0,2)){const p=JSON.parse(rested.progress.find(p=>p.id===hero.id).payload);assert.equal(p.rest.baseline,240);assert.equal(p.rest.sections,1);assert.equal(p.rest.shortXp,0);}
 await page.locator('#party-roster-panel > summary').click();await page.locator('#party-search').fill('Cora');const card=page.locator('#party-roster [data-character-id="'+absent+'"]');await card.locator('.party-member-toggle').click();await card.getByRole('button',{name:'Zur Party',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('#party-active .party-card').length===3&&!document.querySelector('#party-short-rest').disabled);
 assert.deepEqual(facts(),rested,'rejoining does not change progress, rest or time');await page.screenshot({path:output+'/rest-return-1.png'});await page.locator('#party-close').click();
}
for(const p of ['main.cjs','preload.cjs','ui/renderer.js','ui/index.html','ui/app.css'])artifacts[p]=createHash('sha256').update(await readFile('.build/desktop/'+p)).digest('hex');
try{
 for(const [stage,scale]of [['prepare',1],['finish',2],['reopen',2]]){
  app=await _electron.launch({executablePath:source+'/node_modules/electron/dist/electron',args:[source+'/.build/desktop/main.cjs','--ozone-platform=x11','--force-device-scale-factor='+scale,'--data-dir',profile],env:{...process.env,DBUS_SESSION_BUS_ADDRESS:'unix:path='+busPath},timeout:30000});closed=false;
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.stack));page.setDefaultTimeout(15000);
  await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
  if(await page.locator('#tutorial-dialog').isVisible())await page.locator('#tutorial-skip').click();
  await page.locator('.campaign-card[data-campaign-id="'+campaign.id+'"]').getByRole('button',{name:/^(Öffnen|Fortsetzen)$/}).click();
  await page.waitForFunction(id=>document.getElementById('campaigns').value===id&&!document.getElementById('workspace-navigation').inert,campaign.id);
  if(!await page.locator('#live-tab').isVisible()){if(await page.locator('#atlas-navigation').isVisible())await page.locator('#atlas-navigation').click();else await page.locator('#workspace-nav-summary').click();}await page.locator('#live-tab').click();
  if(await page.locator('#live-continue').isVisible())await page.locator('#live-continue').click();
  await page.locator('#combat-resume').click();
  if(stage==='prepare'){
   await restWithAbsentMember(page);
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
  }else if(stage==='finish'){
   await page.waitForFunction(()=>document.querySelector('#combat-status').textContent.includes('Vorbereitung'));
   assert.equal(await page.locator('#combat-title').innerText(),'Wachen am Tor');
   await page.locator('#combat-status').scrollIntoViewIfNeeded();
   await page.screenshot({path:output+'/initiative-restarted-'+scale+'.png'});
   await page.locator('#combat-initiative-open').click();for(const input of await page.locator('#initiative-rows input').all())await input.fill('12');await page.locator('#initiative-start').click();await page.waitForFunction(()=>document.querySelector('#combat-status').textContent.includes('Am Zug:'));
   const running=JSON.parse(facts().combat);assert.deepEqual(new Set(running.participants.filter(p=>p.characterId).map(p=>p.characterId)),new Set(x.heroes.slice(0,3).map(h=>h.id)));await page.locator('#combat-next').click();
   await page.locator('#combat-finish').click();await page.locator('#combat-outcome').fill('Torwache befriedet');await page.locator('#finish-no-xp').uncheck();await page.locator('#finish-xp').fill('120');await page.getByRole('button',{name:'Ergebnis speichern und abschließen',exact:true}).click();await page.locator('#combat-finish-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('#combat-resolution-summary').textContent.includes('120 XP gebucht'));await page.screenshot({path:output+'/finished-2.png'});results.push({scale,stage,restedWithoutAbsent:true,rejoinedUnchanged:true,currentPartyInCombat:true,finishedWithXp:120});
  }else{
   await page.waitForFunction(()=>document.querySelector('#combat-status').textContent.includes('Abgeschlossen'));assert.match(await page.locator('#combat-resolution-summary').innerText(),/Torwache befriedet/);assert.match(await page.locator('#combat-resolution-summary').innerText(),/120 XP gebucht/);await page.screenshot({path:output+'/finished-reopened-2.png'});results.push({scale,stage});
  }
  assert.equal(await page.evaluate(()=>window.devicePixelRatio),scale);
  const ended=new Promise(resolve=>app.process().once('exit',(code,signal)=>resolve({code,signal})));
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).close());
  const exit=await ended;assert.deepEqual(exit,{code:0,signal:null});closed=true;results.at(-1).exit=exit;
 }
 const fresh=new CampaignStore(file);try{
  const token=fresh.activate(campaign.id).token,combat=fresh.combat(token,scene.id).combat;
  assert.equal(combat.title,'Wachen am Tor');assert.equal(combat.phase,'finished');assert.equal(combat.participants.length,6);assert.equal(combat.outcome,'Torwache befriedet');
  for(const hero of x.heroes.slice(0,3))assert.equal(fresh.progress(token).characters.find(p=>p.characterId===hero.id).xp,940);assert.equal(fresh.progress(token).characters.find(p=>p.characterId===x.heroes[3].id).xp,355000);assert.equal(fresh.db.prepare('SELECT count(*) n FROM combat WHERE campaign_id=?').get(campaign.id).n,1);assert.equal(fresh.db.prepare('SELECT count(*) n FROM combat_award WHERE campaign_id=?').get(campaign.id).n,1);
  assert.deepEqual(fresh.scenePreparation(token,scene.id).groups.map(g=>fresh.groupView(token,g.id)),originalGroups);
 }finally{fresh.close();}
 assert.deepEqual(errors,[]);
 await writeFile(path.join(output,'result.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTree:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),profile,results,errors,artifacts},null,2));console.log(JSON.stringify({results,groupFactsUnchanged:true}));
}catch(error){await writeFile(path.join(output,'failure.json'),JSON.stringify({error:error.stack,profile,results,errors},null,2));if(app&&!closed)try{await(await app.firstWindow()).screenshot({path:path.join(output,'failure.png')});}catch{}throw error;}
finally{if(app&&!closed)await app.close();proxy.kill();}

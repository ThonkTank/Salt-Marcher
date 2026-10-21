// One native path: absence, confirmed rest, return, saved groups, combat and fresh result.
import {createRequire} from 'node:module';
import {createNativeSession} from './native-session.mjs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';

const namesakes=process.env.GM_QA_NAMESAKES==='1',longRest=process.env.GM_QA_LONG_REST==='1';
const restButton=longRest?'#party-long-rest':'#party-short-rest';
const source=process.cwd(),output=path.resolve(process.argv[2]??'.build/scene-selection-evidence');
const native=await createNativeSession({root:source,output,name:'scene-encounter-selection'});
const require=createRequire(source+'/package.json'),Database=require('better-sqlite3');
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/scene-selection-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(source+'/.build/scene-selection-store.cjs');
function fixture(){
 const dir=native.profile,file=dir+'/workbench.sqlite',x={dir,file,store:new CampaignStore(file)};x.cam=x.store.create('Zwei Gruppen am Tor');x.w=x.store.activate(x.cam.id);x.cmd=action=>({commandId:randomUUID(),campaignId:x.cam.id,token:x.w.token,action});
 x.heroes=['Ada',namesakes?'Ada':'Borin','Cora','Inaktiv'].map((name,i)=>x.store.executeLive(x.cmd({kind:'create-character',profile:{name,...(namesakes&&i<2?{playerName:i?'Noah':'Nora'}:{})}})).character);
 let live=x.store.live(x.w.token);x.store.executeLive(x.cmd({kind:'initialize',expectedRosterRevision:live.rosterRevision}));
 for(const hero of x.heroes.slice(0,3)){live=x.store.live(x.w.token);const c=live.roster.find(c=>c.id===hero.id);x.store.executeLive(x.cmd({kind:'membership',characterId:c.id,expectedRevision:c.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:live.scene.id,expectedFocusRevision:live.focusRevision}));}
 for(const hero of x.heroes){const p=x.store.progress(x.w.token).characters.find(p=>p.characterId===hero.id);x.store.executeProgress(x.cmd({kind:'xp',characterId:hero.id,expectedRevision:p.revision,mode:'set',amount:hero===x.heroes[3]?355000:900,reason:'Start'}));}
 if(longRest)for(const [i,hero]of x.heroes.slice(0,3).entries()){
  const p=x.store.progress(x.w.token).characters.find(p=>p.characterId===hero.id);
  x.store.executeProgress(x.cmd({kind:'health',characterId:hero.id,expectedRevision:p.revision,operation:'set',reason:'Vor der langen Rast',health:{hp:[5,0,7][i],maxHp:20,tempHp:0,conditions:'Vergiftet',concentrating:false}}));
 }
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
let app;const results=[];
function facts(){const db=new Database(file,{readonly:true});try{return{progress:db.prepare('SELECT id,payload FROM character_progress ORDER BY id').all(),clock:db.prepare('SELECT * FROM scene_clock WHERE scene_id=?').get(scene.id),combat:db.prepare('SELECT payload FROM combat WHERE scene_id=? ORDER BY ordinal DESC LIMIT 1').get(scene.id)?.payload};}finally{db.close();}}
async function until(check){const end=Date.now()+20000;while(!check()&&Date.now()<end)await new Promise(r=>setTimeout(r,25));assert(check(),'Expected confirmed Party/Combat state');}
async function restWithAbsentMember(page){
 const absent=x.heroes[2].id,original=facts(),state=f=>JSON.parse(f.progress.find(p=>p.id===absent).payload);
 await page.locator('#party-shortcut').click();await page.locator('#party-active .party-card').nth(2).waitFor();
 const active=page.locator('#party-active [data-character-id="'+absent+'"]');await active.locator('.party-member-toggle').click();await active.getByRole('button',{name:'Aus Party',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('#party-active .party-card').length===2&&!document.querySelector('#party-short-rest').disabled);
 await page.locator('#party-rest > summary').click();assert.equal(await page.locator('#party-rest-members input').count(),2);
 if(longRest)await page.locator('#party-rest-hp').check();
 if(namesakes){await page.locator('#party-rest-members').scrollIntoViewIfNeeded();await native.capture(page,'rest-namesakes.png');const labels=await page.locator('#party-rest-members label').allTextContents();assert.match(labels[0],/Nora/);assert.match(labels[1],/Noah/);assert.notEqual(labels[0],labels[1]);if(!longRest)await page.locator('#party-rest-members input').nth(1).uncheck();}
 const before=facts();await page.locator(restButton).click();const preview=await page.locator('#party-rest-status').innerText();if(namesakes){assert.match(preview,/Nora/);assert.equal(preview.includes('Noah'),longRest);}else assert.match(preview,/Ada, Borin/);assert(!await page.locator('#party-rest-status').innerText().then(t=>t.includes('Cora')));assert.deepEqual(facts(),before,'the first rest click is read-only');
 await page.locator('#party-rest-status').scrollIntoViewIfNeeded();await native.capture(page,'rest-confirmation-1.png');
 await page.locator(restButton).click();await until(()=>facts().clock.instant_ms!==before.clock.instant_ms);await page.waitForFunction(()=>!document.querySelector('#party-short-rest').disabled);
 await page.waitForFunction(()=>document.querySelector('#party-rest-status').textContent.startsWith('Gebucht:'));const receipt=await page.locator('#party-rest-status').innerText();assert.match(receipt,longRest?/8 Stunden Szenenzeit\. HP nach der Rast:/:/60 Minuten Szenenzeit · HP unverändert/);assert(!receipt.includes('Cora'));if(namesakes){assert.match(receipt,/Nora/);assert.equal(receipt.includes('Noah'),longRest);}else if(!longRest)assert.match(receipt,/Ada, Borin/);await page.locator('#party-rest-status').scrollIntoViewIfNeeded();await native.capture(page,'rest-receipt-'+Number(process.env.GM_QA_ZOOM??1)+'.png');
 if(longRest){
  const labels=await page.locator('#party-rest-members label').allTextContents();
  assert(receipt.includes(labels[0]+': 20/20 HP'));assert(receipt.includes(labels[1]+': 0/20 HP'));
 }
 const rested=facts();
 if(longRest){
  const health=id=>JSON.parse(rested.progress.find(p=>p.id===id).payload).health;
  assert.deepEqual(health(x.heroes[0].id),{hp:20,maxHp:20,tempHp:0,conditions:'Vergiftet',concentrating:false});
  assert.equal(health(x.heroes[1].id).hp,0);assert.equal(health(x.heroes[2].id).hp,7);
 }
 assert.equal(BigInt(rested.clock.instant_ms)-BigInt(before.clock.instant_ms),longRest?28800000n:3600000n);assert.deepEqual(state(rested),state(original),'the absent figure receives no rest');
 if(namesakes&&!longRest)assert.equal(rested.progress.find(p=>p.id===x.heroes[1].id).payload,before.progress.find(p=>p.id===x.heroes[1].id).payload,'unchecked namesake remains unchanged');
 for(const hero of x.heroes.slice(0,namesakes&&!longRest?1:2)){const p=JSON.parse(rested.progress.find(p=>p.id===hero.id).payload);assert.equal(p.rest.baseline,longRest?0:240);assert.equal(p.rest.sections,longRest?0:1);assert.equal(p.rest.shortXp,0);}
 await page.locator('#party-roster-panel > summary').click();await page.locator('#party-search').fill('Cora');const card=page.locator('#party-roster [data-character-id="'+absent+'"]');await card.locator('.party-member-toggle').click();await card.getByRole('button',{name:'Zur Party',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('#party-active .party-card').length===3&&!document.querySelector('#party-short-rest').disabled);
 assert.deepEqual(facts(),rested,'rejoining does not change progress, rest or time');await page.locator('#party-popover').evaluate(node=>{node.scrollTop=0;});await native.capture(page,'rest-return-1.png');await page.locator('#party-close').click();
}
try{
 for(const [stage,scale]of [['prepare',Number(process.env.GM_QA_ZOOM??1)],['finish',Number(process.env.GM_QA_ZOOM??2)],['reopen',Number(process.env.GM_QA_ZOOM??2)]]){
  const page=await native.launch(scale);app=native.app;
  if(await page.locator('#tutorial-dialog').isVisible())await page.locator('#tutorial-skip').click();
  await page.locator('.campaign-card[data-campaign-id="'+campaign.id+'"]').getByRole('button',{name:/^(Öffnen|Fortsetzen)$/}).click();
  await page.waitForFunction(id=>document.getElementById('campaigns').value===id&&!document.getElementById('workspace-navigation').inert,campaign.id);
  if(!await page.locator('#live-tab').isVisible()){if(await page.locator('#atlas-navigation').isVisible())await page.locator('#atlas-navigation').click();if(!await page.locator('#live-tab').isVisible())await page.locator('#workspace-nav-summary').click();}await page.locator('#live-tab').click();
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
   await native.capture(page,'read-'+scale+'.png');
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
   await native.capture(page,'partial-'+scale+'.png');
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
   await native.capture(page,'initiative-'+scale+'.png');results.push({scale,counts,legacyJsonBytes,selectionJsonBytes:Buffer.byteLength(JSON.stringify(frame.value))});
  }else if(stage==='finish'){
   await page.waitForFunction(()=>document.querySelector('#combat-status').textContent.includes('Vorbereitung'));
   assert.equal(await page.locator('#combat-title').innerText(),'Wachen am Tor');
   await page.locator('#combat-status').scrollIntoViewIfNeeded();
   await native.capture(page,'initiative-restarted-'+scale+'.png');
   await page.locator('#combat-initiative-open').click();for(const input of await page.locator('#initiative-rows input').all())await input.fill('12');await page.locator('#initiative-start').click();await page.waitForFunction(()=>document.querySelector('#combat-status').textContent.includes('Am Zug:'));
   const running=JSON.parse(facts().combat);assert.deepEqual(new Set(running.participants.filter(p=>p.characterId).map(p=>p.characterId)),new Set(x.heroes.slice(0,3).map(h=>h.id)));await page.locator('#combat-next').click();
   await page.locator('#combat-finish').click();await page.locator('#combat-outcome').fill('Torwache befriedet');await page.locator('#finish-no-xp').uncheck();await page.locator('#finish-xp').fill('120');await page.getByRole('button',{name:'Ergebnis speichern und abschließen',exact:true}).click();await page.locator('#combat-finish-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('#combat-resolution-summary').textContent.includes('120 XP gebucht'));await native.capture(page,'finished-2.png');results.push({scale,stage,restedWithoutAbsent:true,rejoinedUnchanged:true,currentPartyInCombat:true,restReceiptConfirmed:true,finishedWithXp:120});
  }else{
   await page.waitForFunction(()=>document.querySelector('#combat-status').textContent.includes('Abgeschlossen'));assert.match(await page.locator('#combat-resolution-summary').innerText(),/Torwache befriedet/);assert.match(await page.locator('#combat-resolution-summary').innerText(),/120 XP gebucht/);await native.capture(page,'finished-reopened-2.png');results.push({scale,stage});
  }
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).webContents.getZoomFactor()),scale);
  await native.close();
 }
 const fresh=new CampaignStore(file);try{
  const token=fresh.activate(campaign.id).token,combat=fresh.combat(token,scene.id).combat;
  assert.equal(combat.title,'Wachen am Tor');assert.equal(combat.phase,'finished');assert.equal(combat.participants.length,6);assert.equal(combat.outcome,'Torwache befriedet');
  for(const hero of x.heroes.slice(0,3))assert.equal(fresh.progress(token).characters.find(p=>p.characterId===hero.id).xp,940);assert.equal(fresh.progress(token).characters.find(p=>p.characterId===x.heroes[3].id).xp,355000);assert.equal(fresh.db.prepare('SELECT count(*) n FROM combat WHERE campaign_id=?').get(campaign.id).n,1);assert.equal(fresh.db.prepare('SELECT count(*) n FROM combat_award WHERE campaign_id=?').get(campaign.id).n,1);
  assert.deepEqual(fresh.scenePreparation(token,scene.id).groups.map(g=>fresh.groupView(token,g.id)),originalGroups);
  if(longRest)assert.deepEqual(x.heroes.slice(0,3).map(hero=>fresh.progress(token).characters.find(p=>p.characterId===hero.id).health.hp),[20,0,7]);
 }finally{fresh.close();}
 await native.finish({results,namesakes,longRest,groupFactsUnchanged:true});console.log(JSON.stringify({results,namesakes,longRest,groupFactsUnchanged:true}));
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}

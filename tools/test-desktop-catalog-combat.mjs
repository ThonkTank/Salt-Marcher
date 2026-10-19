import {createRequire} from 'node:module';
import {mkdtemp,mkdir,stat,readFile,writeFile} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
// Real desktop workflow. Own profile only; the rejected/read-lost boundaries are controlled faults.
const root=process.cwd(),require=createRequire(root+'/package.json'),{_electron}=require('playwright-core');
const output=process.env.QA_EVIDENCE_DIR??root+'/.build/catalog-combat-evidence';await mkdir(output,{recursive:true});
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/catalog-combat-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(root+'/.build/catalog-combat-store.cjs'),profile=await mkdtemp('/tmp/catalog-combat-'),file=profile+'/workbench.sqlite',store=new CampaignStore(file),campaign=store.create('Spontaner Kampf am Hafentor'),w=store.activate(campaign.id),cmd=action=>({commandId:randomUUID(),campaignId:campaign.id,token:w.token,action});
let scene=store.executeLive(cmd({kind:'initialize',expectedRosterRevision:0})).scene;
const character=store.executeLive(cmd({kind:'create-character',profile:{name:'Mira'}})).character,live=store.live(w.token);
scene=store.executeLive(cmd({kind:'membership',characterId:character.id,expectedRevision:character.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:scene.id,expectedFocusRevision:live.focusRevision})).scene;
const savedPlan=store.saveEncounterPlan({...cmd(null),expectedRevision:null,plan:{id:randomUUID(),revision:0,name:'Wache am Hafentor',notes:'  Geschützte Vorlagenprosa\r\n',party:[],entries:[{id:randomUUID(),creatureId:'goblin',count:2,grouped:true}],sources:[],catalogHash:''}});
const other=store.create('Andere Kampagne'),ow=store.activate(other.id);store.executeLive({commandId:randomUUID(),campaignId:other.id,token:ow.token,action:{kind:'initialize',expectedRosterRevision:0}});
store.tutorial('skipped');store.close();
const bus=profile+'/bus',proxy=spawn('xdg-dbus-proxy',[process.env.DBUS_SESSION_BUS_ADDRESS,bus,'--filter','--talk=org.freedesktop.portal.Desktop','--talk=org.freedesktop.Notifications'],{stdio:'ignore'});
for(let i=0;i<100&&!await stat(bus).catch(()=>null);i++)await new Promise(r=>setTimeout(r,20));
let app;const launches=[],errors=[],results=[];
async function launch(scale){
 app=await _electron.launch({executablePath:root+'/node_modules/electron/dist/electron',args:[root+'/.build/desktop/main.cjs','--ozone-platform=x11','--force-device-scale-factor='+scale,'--data-dir',profile],env:{...process.env,DBUS_SESSION_BUS_ADDRESS:'unix:path='+bus}});launches.push({scale,pid:app.process().pid});
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.stack));page.setDefaultTimeout(15000);
 await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
 await page.locator('.campaign-card[data-campaign-id="'+campaign.id+'"]').getByRole('button',{name:/Öffnen|Fortsetzen/}).click();
 await page.waitForFunction(id=>document.getElementById('campaigns').value===id&&!document.getElementById('workspace-navigation').inert,campaign.id);
 const liveTab=page.getByRole('button',{name:'Party und Leiten',exact:true});
 if(!await liveTab.isVisible()){
  if(await page.locator('#atlas-navigation').isVisible())await page.locator('#atlas-navigation').click();
  else await page.locator('#workspace-nav-summary').click();
 }
 await liveTab.click();await page.locator('#combat-panel').waitFor();
 await page.waitForFunction(()=>document.getElementById('combat-panel').getAttribute('aria-busy')==='false');return page;
}
async function close(){
 const exited=new Promise(r=>app.process().once('exit',(code,signal)=>r({code,signal})));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).close());let timer;
 try{const exit=await Promise.race([exited,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Normal close timed out')),10000))]);assert.deepEqual(exit,{code:0,signal:null});launches.at(-1).exit=exit;app=null;}finally{clearTimeout(timer);}
}
async function catalog(page){
 if(!await page.locator('#combat-catalog-open').isVisible())await page.getByText('Weitere Begegnung vorbereiten',{exact:true}).click();await page.locator('#combat-catalog-open').click();await page.locator('#catalog-search').fill('Goblin');await page.getByRole('button',{name:'Suchen',exact:true}).click();await page.getByRole('button',{name:'Goblin',exact:true}).click();await page.locator('#catalog-quantity').fill('2');await page.locator('#catalog-grouped').check();await page.locator('#catalog-live-add:enabled').waitFor();await page.locator('#catalog-live-add').click();
}
async function staleCatalogHandoff(scale,kind){
 const page=await launch(scale);
 await app.evaluate(({ipcMain})=>{
  const read=ipcMain._invokeHandlers.get('campaign:live'),write=ipcMain._invokeHandlers.get('campaign:execute-combat');globalThis.qaHandoffWrites=[];let hold=true;
  ipcMain.removeHandler('campaign:live');ipcMain.handle('campaign:live',async(e,...args)=>{const result=await read(e,...args);if(hold){hold=false;globalThis.qaHandoffHeld=true;await new Promise(r=>globalThis.qaHandoffRelease=r);}return result;});
  ipcMain.removeHandler('campaign:execute-combat');ipcMain.handle('campaign:execute-combat',async(e,c)=>{globalThis.qaHandoffWrites.push(c);return write(e,c);});
 });
 if(kind==='creature')await catalog(page);
 else{
  if(!await page.locator('#combat-catalog-open').isVisible())await page.getByText('Weitere Begegnung vorbereiten',{exact:true}).click();
  await page.locator('#combat-catalog-open').click();await page.locator('#catalog-plan-open').click();await page.locator('#encounter-list').selectOption(savedPlan.id);await page.waitForFunction(name=>document.getElementById('encounter-name').value===name,savedPlan.name);await page.locator('#encounter-prepare').click();
 }
 const deadline=Date.now()+10000;while(!await app.evaluate(()=>globalThis.qaHandoffHeld)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));assert(await app.evaluate(()=>globalThis.qaHandoffHeld));
 await page.locator('#application-trigger').click();await page.locator('#campaign-screen-open').click();await page.locator('.campaign-card[data-campaign-id="'+other.id+'"]').getByRole('button',{name:/Öffnen|Fortsetzen/}).click();
 await page.waitForFunction(id=>document.getElementById('campaigns').value===id&&!document.getElementById('workspace-navigation').inert,other.id);
 await app.evaluate(()=>globalThis.qaHandoffRelease());await new Promise(r=>setTimeout(r,1500));
 const writes=await app.evaluate(()=>globalThis.qaHandoffWrites);assert.deepEqual(writes,[],'a stale '+kind+' handoff must not create or change a combat in the newly opened campaign');await close();
 const fresh=new CampaignStore(file);try{assert.equal(fresh.db.prepare('SELECT count(*) n FROM combat WHERE campaign_id=?').get(other.id).n,0);const active=fresh.activate(campaign.id);assert.deepEqual(fresh.encounterPlan(active.token,savedPlan.id),savedPlan);}finally{fresh.close();}
 return {kind,campaignSwitchDuringLiveRead:true,combatWrites:0};
}
try{
 for(const scale of [1,2]){
  let page=await launch(scale);
  await app.evaluate(({ipcMain})=>{
   const original=ipcMain._invokeHandlers.get('campaign:execute-combat');globalThis.qaCatalogFault='reject';globalThis.qaCatalogCommands=[];ipcMain.removeHandler('campaign:execute-combat');
   ipcMain.handle('campaign:execute-combat',async(e,command)=>{globalThis.qaCatalogCommands.push(command);if(command.action.kind==='create'&&command.action.catalogCreature){const fault=globalThis.qaCatalogFault;globalThis.qaCatalogFault=null;
    if(fault==='reject')return original(e,{...command,action:{...command.action,catalogCreature:{...command.action.catalogCreature,creatureId:'qa-missing-creature'}}});
    const result=await original(e,command);if(fault==='lost')throw Error('Controlled reply loss after commit');return result;
   }return original(e,command);});
  });
  await catalog(page);await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Kreatur nicht gefunden'));
  assert.equal(await page.locator('#combat-workspace').isVisible(),scale===2,'failed creation must leave the preceding result or empty state intact');
  const rejected=await app.evaluate(()=>globalThis.qaCatalogCommands);assert.equal(rejected.length,1);assert.equal(rejected[0].action.kind,'create');
  await app.evaluate(()=>{globalThis.qaCatalogFault='lost';});await catalog(page);await page.waitForFunction(()=>document.getElementById('combat-rows').textContent.includes('Goblin')&&!document.getElementById('combat-start').disabled);
  const initial=await app.evaluate(()=>globalThis.qaCatalogCommands);assert.equal(initial.length,2);assert(initial.every(c=>c.action.kind==='create'&&c.action.catalogCreature.count===2));assert.equal(await page.locator('#commit-pending').isVisible(),false);
  await page.locator('#combat-initiative-open').click();await page.getByRole('textbox',{name:'Initiative Mira',exact:true}).fill('18');await page.getByRole('textbox',{name:'Initiative Goblin A',exact:true}).fill('12');
  for(const mode of ['normal','advantage','disadvantage']){
   await page.locator('#initiative-mode').selectOption(mode);await page.locator('#initiative-roll').click();
   const rolled=Number(await page.getByRole('textbox',{name:'Initiative Goblin A',exact:true}).inputValue());assert(rolled>=3&&rolled<=22);assert.equal(await page.getByRole('textbox',{name:'Initiative Mira',exact:true}).inputValue(),'18');
   assert.equal((await app.evaluate(()=>globalThis.qaCatalogCommands)).length,2,'preview must not send a combat command');
   await page.locator('#initiative-roll-undo').click();assert.equal(await page.getByRole('textbox',{name:'Initiative Goblin A',exact:true}).inputValue(),'12');
  }
  await page.getByRole('button',{name:'Übernehmen und Kampf beginnen',exact:true}).click();await page.waitForFunction(()=>document.getElementById('combat-status').textContent.includes('Am Zug: Mira'));
  await page.getByRole('button',{name:'Goblin A',exact:true}).click();await page.locator('#fighter-amount').fill('3');await page.locator('#fighter-damage').click();await page.waitForFunction(()=>document.getElementById('fighter-hp').value==='4');
  await page.locator('#combat-next').click();await page.waitForFunction(()=>document.getElementById('combat-status').textContent.includes('Am Zug: Goblin A'));
  await page.locator('#combat-undo').click();await page.waitForFunction(()=>document.getElementById('combat-status').textContent.includes('Am Zug: Mira'));await page.locator('#combat-next').click();await page.waitForFunction(()=>document.getElementById('combat-status').textContent.includes('Am Zug: Goblin A'));
  await page.getByRole('button',{name:'Goblin A',exact:true}).click();await page.locator('#fighter-condition-panel').evaluate(el=>el.open=true);await page.locator('#fighter-condition-shortcuts').getByRole('button',{name:'Liegend',exact:true}).click();await page.waitForFunction(()=>document.getElementById('fighter-conditions').value==='Liegend');
  await page.locator('#combat-add-open').click();await page.locator('#combat-creature-source').selectOption('group');await page.locator('#combat-creature-count').fill('1');await page.locator('#combat-creature-add').click();await page.locator('#combat-add-dialog').waitFor({state:'hidden'});
  await page.locator('#combat-add-open').click();await page.locator('#combat-creature-source').selectOption('catalog');await page.locator('#combat-creature-search').fill('Hobgoblin');await page.locator('#combat-creature-search-form').getByRole('button',{name:'Monster suchen',exact:true}).click();await page.locator('#combat-creature-select option[value="creature:hobgoblin"]').waitFor({state:'attached'});await page.locator('#combat-creature-select').selectOption('creature:hobgoblin');await page.locator('#combat-creature-initiative').fill('10');await page.locator('#combat-creature-add').click();await page.locator('#combat-add-dialog').waitFor({state:'hidden'});
  assert.match(await page.locator('#combat-status').innerText(),/Runde 1.*Am Zug: Goblin A/);await page.screenshot({path:output+'/reinforced-'+scale+'.png'});const beforeRestartCommands=await app.evaluate(()=>globalThis.qaCatalogCommands);assert.deepEqual(beforeRestartCommands.filter(c=>c.action.kind==='add-creature').map(c=>[c.action.creatureId,c.action.count]),[['goblin',1],['hobgoblin',1]]);await close();
  const runningStore=new CampaignStore(file);let running;
  try{const active=runningStore.activate(campaign.id);running=runningStore.combat(active.token,scene.id).combat;assert.equal(running.phase,'running');assert.equal(running.round,1);assert.equal(running.participants.find(p=>p.id===running.turnId).name,'Goblin A');const goblins=running.participants.filter(p=>p.sourceId==='goblin');assert.deepEqual(goblins.map(p=>p.hp),[4,7,7]);assert.deepEqual(goblins.map(p=>p.conditions),['Liegend','','']);assert.equal(new Set(goblins.map(p=>p.groupId)).size,1);assert(goblins.every(p=>p.initiative===12));const hobgoblin=running.participants.find(p=>p.sourceId==='hobgoblin');assert.equal(hobgoblin.hp,11);assert.equal(hobgoblin.initiative,10);}finally{runningStore.close();}
  page=await launch(scale);await page.waitForFunction(()=>document.getElementById('combat-status').textContent.includes('Am Zug: Goblin A'));await page.locator('#combat-add-open').click();assert.match(await page.locator('#combat-creature-select').innerText(),/Goblin.*vorhandene Initiative 12 \(3\)/);await page.locator('#combat-add-close').click();await page.locator('#combat-next').click();await page.waitForFunction(()=>document.getElementById('combat-status').textContent.includes('Am Zug: Goblin B'));
  await page.locator('#combat-finish').click();await page.locator('#combat-outcome').fill('Goblins ergeben sich · Prüfung '+scale);await page.locator('#finish-no-xp').uncheck();await page.locator('#finish-xp').fill('100');await page.getByRole('button',{name:'Ergebnis speichern und abschließen',exact:true}).click();await page.locator('#combat-finish-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.getElementById('combat-resolution-summary').textContent.includes('100 XP gebucht'));
  await page.locator('#combat-resolution-summary').scrollIntoViewIfNeeded();await page.screenshot({path:output+'/completed-'+scale+'.png'});const commands=beforeRestartCommands;await close();
  const fresh=new CampaignStore(file);let combat;
  try{const active=fresh.activate(campaign.id);combat=fresh.combat(active.token,scene.id).combat;assert.equal(combat.phase,'finished');assert.equal(combat.outcome,'Goblins ergeben sich · Prüfung '+scale);assert.deepEqual(combat.participants,running.participants);const pc=combat.participants.find(p=>p.characterId===character.id);assert.equal(pc.initiative,18);assert.equal(fresh.db.prepare('SELECT count(*) n FROM combat WHERE campaign_id=?').get(campaign.id).n,results.length+1);assert.equal(fresh.db.prepare('SELECT count(*) n FROM combat_receipt WHERE command_id=?').get(rejected[0].commandId).n,0);assert.equal(fresh.db.prepare('SELECT count(*) n FROM combat_receipt WHERE command_id=?').get(initial[1].commandId).n,1);}finally{fresh.close();}
  page=await launch(scale);await page.waitForFunction(n=>document.getElementById('combat-resolution-summary').textContent.includes('Goblins ergeben sich · Prüfung '+n),scale);assert((await page.locator('#combat-status').innerText()).includes('Abgeschlossen'));await close();results.push({scale,rejectedWithoutPartialCombat:true,creationWrites:2,acceptedCreationWrites:1,replyLossRecovered:true,sharedInitiative:12,playerInitiative:18,rollPreviewModes:['normal','advantage','disadvantage'],previewDiscardWithoutCombatWrite:true,hp:[4,7,7],reinforcement:{existingTroop:1,newCreature:'hobgoblin',conditionsPreserved:true,turnPreserved:true,runningReopened:true},nextUndoNext:true,outcome:combat.outcome,reopened:true,commandsBeforeRestart:commands.map(c=>c.action.kind)});
  results.at(-1).staleHandoffs=[];for(const kind of ['creature','plan'])results.at(-1).staleHandoffs.push(await staleCatalogHandoff(scale,kind));
 }
 const buildHashes=Object.fromEntries(await Promise.all(['main.cjs','ui/renderer.js'].map(async name=>[name,createHash('sha256').update(await readFile(root+'/.build/desktop/'+name)).digest('hex')])));
 assert.deepEqual(errors,[]);await writeFile(output+'/result.json',JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),buildHashes,profile,launches,results},null,2));console.log(JSON.stringify({profile,launches,results}));
}catch(error){if(app)try{await(await app.firstWindow()).screenshot({path:output+'/failure.png'});}catch{}throw error;}
finally{if(app)await Promise.race([app.close().catch(()=>{}),new Promise(r=>setTimeout(r,3000))]);proxy.kill();}

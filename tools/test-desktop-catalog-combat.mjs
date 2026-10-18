import {createRequire} from 'node:module';
import {mkdtemp,mkdir,stat,readFile,writeFile} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
// Real desktop workflow. Own profile only; the rejected/read-lost boundaries are controlled faults.
const root=process.cwd(),require=createRequire(root+'/package.json'),{_electron}=require('playwright-core');
const output=root+'/.build/catalog-combat-evidence';await mkdir(output,{recursive:true});
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/catalog-combat-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(root+'/.build/catalog-combat-store.cjs'),profile=await mkdtemp('/tmp/catalog-combat-'),file=profile+'/workbench.sqlite',store=new CampaignStore(file),campaign=store.create('Spontaner Kampf am Hafentor'),w=store.activate(campaign.id),cmd=action=>({commandId:randomUUID(),campaignId:campaign.id,token:w.token,action});
let scene=store.executeLive(cmd({kind:'initialize',expectedRosterRevision:0})).scene;
const character=store.executeLive(cmd({kind:'create-character',profile:{name:'Mira'}})).character,live=store.live(w.token);
scene=store.executeLive(cmd({kind:'membership',characterId:character.id,expectedRevision:character.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:scene.id,expectedFocusRevision:live.focusRevision})).scene;
store.tutorial('skipped');store.close();
const bus=profile+'/bus',proxy=spawn('xdg-dbus-proxy',[process.env.DBUS_SESSION_BUS_ADDRESS,bus,'--filter','--talk=org.freedesktop.portal.Desktop','--talk=org.freedesktop.Notifications'],{stdio:'ignore'});
for(let i=0;i<100&&!await stat(bus).catch(()=>null);i++)await new Promise(r=>setTimeout(r,20));
let app;const launches=[],errors=[],results=[];
async function launch(scale){
 app=await _electron.launch({executablePath:root+'/node_modules/electron/dist/electron',args:[root+'/.build/desktop/main.cjs','--ozone-platform=x11','--force-device-scale-factor='+scale,'--data-dir',profile],env:{...process.env,DBUS_SESSION_BUS_ADDRESS:'unix:path='+bus}});launches.push({scale,pid:app.process().pid});
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.stack));page.setDefaultTimeout(15000);await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');await page.locator('.campaign-card[data-campaign-id="'+campaign.id+'"]').getByRole('button',{name:/Öffnen|Fortsetzen/}).click();await page.locator('#combat-panel').waitFor();await page.waitForFunction(()=>document.getElementById('combat-panel').getAttribute('aria-busy')==='false');return page;
}
async function close(){
 const exited=new Promise(r=>app.process().once('exit',(code,signal)=>r({code,signal})));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).close());let timer;
 try{const exit=await Promise.race([exited,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Normal close timed out')),10000))]);assert.deepEqual(exit,{code:0,signal:null});launches.at(-1).exit=exit;app=null;}finally{clearTimeout(timer);}
}
async function catalog(page){
 if(!await page.locator('#combat-catalog-open').isVisible())await page.getByText('Weitere Begegnung vorbereiten',{exact:true}).click();await page.locator('#combat-catalog-open').click();await page.locator('#catalog-search').fill('Goblin');await page.getByRole('button',{name:'Suchen',exact:true}).click();await page.getByRole('button',{name:'Goblin',exact:true}).click();await page.locator('#catalog-quantity').fill('2');await page.locator('#catalog-grouped').check();await page.locator('#catalog-live-add:enabled').waitFor();await page.locator('#catalog-live-add').click();
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
  await page.locator('#combat-initiative-open').click();await page.getByRole('textbox',{name:'Initiative Mira',exact:true}).fill('18');await page.getByRole('textbox',{name:'Initiative Goblin A',exact:true}).fill('12');await page.getByRole('button',{name:'Übernehmen und Kampf beginnen',exact:true}).click();await page.waitForFunction(()=>document.getElementById('combat-status').textContent.includes('Am Zug: Mira'));
  await page.getByRole('button',{name:'Goblin A',exact:true}).click();await page.locator('#fighter-amount').fill('3');await page.locator('#fighter-damage').click();await page.waitForFunction(()=>document.getElementById('fighter-hp').value==='4');
  await page.locator('#combat-next').click();await page.waitForFunction(()=>document.getElementById('combat-status').textContent.includes('Am Zug: Goblin A'));
  await page.locator('#combat-undo').click();await page.waitForFunction(()=>document.getElementById('combat-status').textContent.includes('Am Zug: Mira'));await page.locator('#combat-next').click();await page.waitForFunction(()=>document.getElementById('combat-status').textContent.includes('Am Zug: Goblin A'));
  await page.locator('#combat-finish').click();await page.locator('#combat-outcome').fill('Goblins ergeben sich · Prüfung '+scale);await page.locator('#finish-no-xp').uncheck();await page.locator('#finish-xp').fill('100');await page.getByRole('button',{name:'Ergebnis speichern und abschließen',exact:true}).click();await page.locator('#combat-finish-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.getElementById('combat-resolution-summary').textContent.includes('100 XP gebucht'));
  await page.locator('#combat-resolution-summary').scrollIntoViewIfNeeded();await page.screenshot({path:output+'/completed-'+scale+'.png'});const commands=await app.evaluate(()=>globalThis.qaCatalogCommands);await close();
  const fresh=new CampaignStore(file);let combat;
  try{const active=fresh.activate(campaign.id);combat=fresh.combat(active.token,scene.id).combat;assert.equal(combat.phase,'finished');assert.equal(combat.outcome,'Goblins ergeben sich · Prüfung '+scale);const enemies=combat.participants.filter(p=>p.sourceId==='goblin'),pc=combat.participants.find(p=>p.characterId===character.id);assert.equal(enemies.length,2);assert.deepEqual(enemies.map(p=>p.hp),[4,7]);assert(enemies.every(p=>p.initiative===12));assert.equal(enemies[0].groupId,enemies[1].groupId);assert.equal(pc.initiative,18);assert.equal(fresh.db.prepare('SELECT count(*) n FROM combat WHERE campaign_id=?').get(campaign.id).n,results.length+1);assert.equal(fresh.db.prepare('SELECT count(*) n FROM combat_receipt WHERE command_id=?').get(rejected[0].commandId).n,0);assert.equal(fresh.db.prepare('SELECT count(*) n FROM combat_receipt WHERE command_id=?').get(initial[1].commandId).n,1);}finally{fresh.close();}
  page=await launch(scale);await page.waitForFunction(n=>document.getElementById('combat-resolution-summary').textContent.includes('Goblins ergeben sich · Prüfung '+n),scale);assert((await page.locator('#combat-status').innerText()).includes('Abgeschlossen'));await close();results.push({scale,rejectedWithoutPartialCombat:true,creationWrites:2,acceptedCreationWrites:1,replyLossRecovered:true,sharedInitiative:12,playerInitiative:18,hp:[4,7],nextUndoNext:true,outcome:combat.outcome,reopened:true,commands:commands.map(c=>c.action.kind)});
 }
 assert.deepEqual(errors,[]);await writeFile(output+'/result.json',JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),profile,launches,results},null,2));console.log(JSON.stringify({profile,launches,results}));
}catch(error){if(app)try{await(await app.firstWindow()).screenshot({path:output+'/failure.png'});}catch{}throw error;}
finally{if(app)await Promise.race([app.close().catch(()=>{}),new Promise(r=>setTimeout(r,3000))]);proxy.kill();}

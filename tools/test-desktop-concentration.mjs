import {createRequire} from 'node:module';
import {mkdtemp,mkdir,stat,writeFile,readFile} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=process.cwd(),require=createRequire(root+'/package.json'),{_electron}=require('playwright-core');
const output=process.env.QA_EVIDENCE_DIR??root+'/.build/concentration';await mkdir(output,{recursive:true});
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/concentration-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(root+'/.build/concentration-store.cjs'),results=[];
for(const scale of [1,2]){
 const profile=await mkdtemp('/tmp/concentration-'),file=profile+'/workbench.sqlite',store=new CampaignStore(file),campaign=store.create('Konzentration – Brückenduell'),w=store.activate(campaign.id),command=action=>({commandId:randomUUID(),campaignId:campaign.id,token:w.token,action});
 store.executeLive(command({kind:'initialize',expectedRosterRevision:0}));
 for(const [name,hp,armorClass] of [['Mira',20,16],['Rolan',18,14]]){
  const c=store.executeLive(command({kind:'create-character',profile:{name,armorClass}})).character,l=store.live(w.token);
  store.executeLive(command({kind:'membership',characterId:c.id,expectedRevision:c.membershipRevision,expectedRosterRevision:l.rosterRevision,active:true,targetSceneId:l.scene.id,expectedFocusRevision:l.focusRevision}));
  const p=store.progress(w.token).characters.find(p=>p.characterId===c.id);
  store.executeProgress(command({kind:'health',characterId:c.id,expectedRevision:p.revision,operation:'set',reason:'Isolierte Ausgangsgruppe',health:{hp,maxHp:hp,tempHp:0,conditions:'',concentrating:false}}));
 }
 const scene=store.live(w.token).scene;let combat;
 const act=action=>combat=store.executeCombat({...command(action),combatId:combat?.id??null,expectedRevision:combat?.revision??null}).combat;
 act({kind:'create',sceneId:scene.id,title:'Erzmagier am Tor',includeParty:true,expectedMembershipRevision:scene.membershipRevision,catalogCreature:{creatureId:'archmage',count:1,grouped:false}});
 for(const p of combat.participants)act({kind:'edit',participantId:p.id,changes:{initiative:p.characterId?(p.name==='Mira'?18:8):12}});
 act({kind:'start'});const actorId=combat.participants.find(p=>p.sourceId==='archmage').id;store.tutorial('skipped');store.close();
 const bus=profile+'/bus',proxy=spawn('xdg-dbus-proxy',[process.env.DBUS_SESSION_BUS_ADDRESS,bus,'--filter','--talk=org.freedesktop.portal.Desktop','--talk=org.freedesktop.Notifications'],{stdio:'ignore'});
 for(let i=0;i<100&&!await stat(bus).catch(()=>null);i++)await new Promise(r=>setTimeout(r,20));
 let app;const exits=[],errors=[];
 async function launch(){
  app=await _electron.launch({executablePath:root+'/node_modules/electron/dist/electron',args:[root+'/.build/desktop/main.cjs','--ozone-platform=x11','--force-device-scale-factor='+scale,'--data-dir',profile],env:{...process.env,DBUS_SESSION_BUS_ADDRESS:'unix:path='+bus}});
  const page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.stack));
  await page.waitForURL(/\/index\.html$/);await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
  await page.locator('.campaign-card[data-campaign-id="'+campaign.id+'"]').getByRole('button',{name:'Fortsetzen'}).click();
  await page.waitForFunction(id=>document.getElementById('campaigns').value===id&&!document.querySelector('main').inert,campaign.id);
  if(!await page.locator('#live-tab').isVisible()&&await page.locator('#atlas-navigation').isVisible())await page.locator('#atlas-navigation').click();
  if(!await page.locator('#live-tab').isVisible())await page.locator('#workspace-nav-summary').click();
  await page.locator('#live-tab').click();await page.locator('#combat-panel').waitFor();await ready(page);return page;
 }
 async function ready(page){await page.waitForFunction(()=>document.getElementById('combat-panel').getAttribute('aria-busy')==='false'&&!document.getElementById('combat-refresh').disabled);}
 async function close(){
  const exit=new Promise(r=>app.process().once('exit',(code,signal)=>r({code,signal})));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).close());
  let timer;try{const result=await Promise.race([exit,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Normal close timed out')),10000))]);assert.deepEqual(result,{code:0,signal:null});exits.push(result);app=null;}finally{clearTimeout(timer);}
 }
 async function shot(page,name){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const png=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).webContents.capturePage()).toPNG().toString('base64'));await writeFile(output+'/'+name+'-'+scale+'.png',Buffer.from(png,'base64'));}
 const row=page=>page.locator('[data-participant-id="'+actorId+'"]');
 try{
  let page=await launch();await row(page).getByRole('button',{name:/Zustände bearbeiten/}).click();
  assert.equal(await page.locator('#fighter-values').evaluate(e=>e.open),false);
  await page.getByRole('button',{name:'Konzentration beginnen',exact:true}).click();await ready(page);
  await page.getByRole('button',{name:'Konzentration beenden',exact:true}).waitFor();assert.match(await row(page).innerText(),/Konzentration/);
  assert.equal(await page.locator('#fighter-values').evaluate(e=>e.open),false);await page.locator('#fighter-condition-panel').scrollIntoViewIfNeeded();await shot(page,'enabled');
  await page.locator('#fighter-amount').fill('32');await page.locator('#fighter-damage').click();await ready(page);
  await page.waitForFunction(()=>document.getElementById('combat-concentration-result').textContent.includes('SG 16'));
  assert.equal(await page.locator('#combat-concentration-modifier').inputValue(),'1');assert.match(await page.locator('#combat-concentration-result').innerText(),/CON \+1 laut Statblock/);
  assert.equal(await page.locator('#combat-next').isDisabled(),true);assert.equal(await page.locator('#combat-finish').isDisabled(),true);
  assert.equal(await page.locator('#fighter-concentration-toggle').isDisabled(),true);await shot(page,'pending');await close();
  page=await launch();assert.match(await page.locator('#combat-concentration-result').innerText(),/SG 16.*32 Schaden.*CON \+1/);
  assert.equal(await page.locator('#combat-concentration-modifier').inputValue(),'1');assert.equal(await page.locator('#combat-next').isDisabled(),true);
  await page.locator('#combat-concentration-effect').scrollIntoViewIfNeeded();await shot(page,'resumed');
  await page.locator('#combat-concentration-pass').click();await ready(page);await page.locator('#combat-concentration-effect').waitFor({state:'hidden'});
  assert.match(await row(page).innerText(),/67 \/ 99.*Konzentration/s);
  await row(page).getByRole('button',{name:/HP · Schaden oder Heilung/}).click();await page.locator('#fighter-amount').fill('7');await page.locator('#fighter-damage').click();await ready(page);
  await page.waitForFunction(()=>document.getElementById('combat-concentration-result').textContent.includes('SG 10'));
  assert.equal(await page.locator('#combat-concentration-modifier').inputValue(),'1');
  await page.locator('#combat-concentration-fail').click();await ready(page);await page.locator('#combat-concentration-effect').waitFor({state:'hidden'});
  assert.match(await row(page).innerText(),/60 \/ 99/);assert.doesNotMatch(await row(page).innerText(),/Konzentration/);
  await page.locator('#combat-next').click();await ready(page);assert.match(await page.locator('#combat-status').innerText(),/Runde 1.*Am Zug: Archmage A/);
  await page.locator('#combat-rows').scrollIntoViewIfNeeded();await shot(page,'continued');
  await page.locator('#combat-finish').click();await page.locator('#combat-outcome').fill('Erzmagier gibt ohne Konzentration auf');await page.locator('#finish-no-xp').check();await page.getByRole('button',{name:'Ergebnis speichern und abschließen',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('combat-status').textContent.includes('Abgeschlossen · Erzmagier gibt ohne Konzentration auf'));await close();
  page=await launch();assert.match(await page.locator('#combat-status').innerText(),/Abgeschlossen · Erzmagier gibt ohne Konzentration auf/);
  assert.match(await page.locator('#combat-resolution').innerText(),/Archmage A · 60 HP bei Kampfabschluss/);assert.doesNotMatch(await row(page).innerText(),/Konzentration/);
  await page.locator('#combat-resolution').scrollIntoViewIfNeeded();await shot(page,'finished');await close();assert.deepEqual(errors,[]);
  const fresh=new CampaignStore(file);try{
   const active=fresh.activate(campaign.id),c=fresh.combat(active.token,scene.id).combat,p=c.participants.find(p=>p.id===actorId);
   assert.equal(c.phase,'finished');assert.equal(c.outcome,'Erzmagier gibt ohne Konzentration auf');assert.equal(c.rewards.totalXp,0);
   assert.equal(p.hp,60);assert.equal(p.concentrating,false);assert.equal(p.concentrationChecks,undefined);assert.equal(p.concentrationLast.success,false);
   assert.deepEqual(c.participants.filter(p=>p.characterId).map(p=>p.hp),[20,18]);
  }finally{fresh.close();}
  results.push({scale,profile,exits,errors,hp:60,concentrating:false,firstDc:16,secondDc:10,modifier:1});
 }finally{if(app)await app.close().catch(()=>{});proxy.kill();}
}
const artifacts={};for(const name of ['main.cjs','preload.cjs','ui/renderer.js','ui/index.html','ui/app.css'])artifacts[name]=createHash('sha256').update(await readFile(root+'/.build/desktop/'+name)).digest('hex');
await writeFile(output+'/result.json',JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),artifacts,results},null,2));console.log(JSON.stringify({output,results}));

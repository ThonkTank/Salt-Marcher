import {createRequire} from 'node:module';
import {mkdtemp,mkdir,stat,writeFile,readFile} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=process.cwd(),require=createRequire(root+'/package.json'),{_electron}=require('playwright-core');
const output=process.env.QA_EVIDENCE_DIR??root+'/.build/spontaneous-combat';await mkdir(output,{recursive:true});
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/spontaneous-combat-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(root+'/.build/spontaneous-combat-store.cjs'),results=[];
for(const scale of [1,2]){
 const profile=await mkdtemp('/tmp/spontaneous-combat-'),file=profile+'/workbench.sqlite',store=new CampaignStore(file),campaign=store.create('Hafentor – ungeplanter Kampf'),w=store.activate(campaign.id),command=action=>({commandId:randomUUID(),campaignId:campaign.id,token:w.token,action});
 store.executeLive(command({kind:'initialize',expectedRosterRevision:0}));
 for(const [name,hp,armorClass] of [['Mira',20,16],['Rolan',18,14]]){
  const c=store.executeLive(command({kind:'create-character',profile:{name,armorClass}})).character,l=store.live(w.token);
  store.executeLive(command({kind:'membership',characterId:c.id,expectedRevision:c.membershipRevision,expectedRosterRevision:l.rosterRevision,active:true,targetSceneId:l.scene.id,expectedFocusRevision:l.focusRevision}));
  const p=store.progress(w.token).characters.find(p=>p.characterId===c.id);
  store.executeProgress(command({kind:'health',characterId:c.id,expectedRevision:p.revision,operation:'set',reason:'Isolierte Ausgangsgruppe',health:{hp,maxHp:hp,tempHp:0,conditions:'',concentrating:false}}));
 }
 const sceneId=store.live(w.token).scene.id;store.tutorial('skipped');store.close();
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
  await page.locator('#live-tab').click();await page.locator('#combat-panel').waitFor();
  await page.waitForFunction(()=>document.getElementById('combat-panel').getAttribute('aria-busy')==='false');return page;
 }
 async function close(){
  const exit=new Promise(r=>app.process().once('exit',(code,signal)=>r({code,signal})));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).close());
  let timer;try{const result=await Promise.race([exit,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Normal close timed out')),10000))]);assert.deepEqual(result,{code:0,signal:null});exits.push(result);app=null;}finally{clearTimeout(timer);}
 }
 async function shot(name){await app.firstWindow().then(p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))));const png=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).webContents.capturePage()).toPNG().toString('base64'));await writeFile(output+'/'+name+'-'+scale+'.png',Buffer.from(png,'base64'));}
 try{
  let page=await launch();await page.locator('#combat-catalog-open').click();
  await page.locator('#combat-creature-search').fill('Goblin');await page.locator('#combat-creature-search-form button').click();
  await page.waitForFunction(()=>document.getElementById('combat-creature-select').value==='creature:goblin');
  await page.locator('#combat-creature-count').fill('3');await page.locator('#combat-creature-grouped').check();await shot('picker');
  await page.locator('#combat-creature-add').click();await page.locator('#combat-add-dialog').waitFor({state:'hidden'});await page.getByRole('button',{name:'Goblin A',exact:true}).waitFor();
  await page.locator('#combat-add-open').click();assert.equal(await page.locator('#combat-creature-source').inputValue(),'catalog');
  await page.locator('#combat-creature-search').fill('Orc');await page.locator('#combat-creature-search-form button').click();
  await page.waitForFunction(()=>document.getElementById('combat-creature-select').value==='creature:orc');await page.locator('#combat-creature-count').fill('1');
  await page.locator('#combat-creature-initiative').fill('8');await page.locator('#combat-creature-add').click();await page.locator('#combat-add-dialog').waitFor({state:'hidden'});
  await page.locator('#combat-initiative-open').click();for(const [name,n] of [['Mira',16],['Rolan',11],['Goblin A',14]])await page.getByRole('textbox',{name:'Initiative '+name,exact:true}).fill(String(n));
  await page.locator('#initiative-start').click();await page.waitForFunction(()=>document.getElementById('combat-status').textContent.includes('Am Zug: Mira'));
  await page.getByRole('button',{name:'Goblin A',exact:true}).click();await page.locator('#fighter-amount').fill('3');await page.locator('#fighter-damage').click();
  await page.waitForFunction(()=>document.getElementById('fighter-quick-health').textContent.includes('4 / 7 HP'));
  await page.locator('#combat-next').click();await page.waitForFunction(()=>document.getElementById('combat-status').textContent.includes('Am Zug: Goblin A'));await shot('running');
  await page.locator('#combat-finish').click();await page.locator('#combat-outcome').fill('Goblins ergeben sich');await page.locator('#finish-no-xp').check();await page.getByRole('button',{name:'Ergebnis speichern und abschließen',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('combat-status').textContent.includes('Abgeschlossen · Goblins ergeben sich'));await close();
  page=await launch();assert.match(await page.locator('#combat-status').innerText(),/Abgeschlossen · Goblins ergeben sich/);assert.match(await page.locator('#combat-rows').innerText(),/4 \/ 7 HP/);await shot('reopened');
  await page.locator('#groups-tab').click();await page.locator('#groups-list button').filter({hasText:'3 × Goblin'}).click();
  const first=page.locator('#groups-actors .session-group-card').filter({hasText:'1. Goblin A'});await first.waitFor();await first.scrollIntoViewIfNeeded();assert.equal(await first.getByRole('textbox',{name:'Aktuelle HP',exact:true}).inputValue(),'4');
  assert.equal(await page.locator('#groups-actors .session-group-card').count(),3);await shot('survivors');await close();assert.deepEqual(errors,[]);
  const fresh=new CampaignStore(file);try{const active=fresh.activate(campaign.id),c=fresh.combat(active.token,sceneId).combat,groups=fresh.scenePreparation(active.token,sceneId).groups;
   assert.equal(c.participants.length,6);assert.equal(groups.length,2);assert.equal(groups.flatMap(g=>g.actors).length,4);assert.equal(new Set(c.participants.filter(p=>p.worldActorId).map(p=>p.worldActorId)).size,4);
   assert.equal(groups.flatMap(g=>g.actors).find(p=>p.name==='Goblin A').hp,4);assert.equal(c.participants.find(p=>p.name==='Orc A').initiative,8);const goblins=c.participants.filter(p=>p.sourceId==='goblin');assert.equal(new Set(goblins.map(p=>p.groupId)).size,1);assert(goblins.every(p=>p.initiative===14&&p.partitionKind==='mob'));
  }finally{fresh.close();}
  results.push({scale,profile,exits,errors,participants:6,sceneOpponents:4,survivorHp:4});
 }finally{if(app)await app.close().catch(()=>{});proxy.kill();}
}
const artifacts={};for(const name of ['main.cjs','preload.cjs','ui/renderer.js','ui/index.html','ui/app.css']){const bytes=await readFile(root+'/.build/desktop/'+name);artifacts[name]=createHash('sha256').update(bytes).digest('hex');}
await writeFile(output+'/result.json',JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),artifacts,results},null,2));console.log(JSON.stringify({output,results}));

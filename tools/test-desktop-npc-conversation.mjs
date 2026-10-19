// Real dossier → original profile draft → normal restart → explicit history append.
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,readFile,writeFile,stat,rm} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {currentProcessGroup} from './process-group.mjs';
const root=process.cwd(),require=createRequire(root+'/package.json'),{_electron}=require('playwright-core');
const out=process.env.QA_EVIDENCE_DIR??root+'/.build/npc-conversation';
await mkdir(out,{recursive:true});await rm(out+'/result.json',{force:true});
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/npc-conversation-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(root+'/.build/npc-conversation-store.cjs');
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty=!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),hashes={};
for(const rel of ['main.cjs','preload.cjs','ui/renderer.js','ui/index.html','ui/app.css'])hashes[rel]=createHash('sha256').update(await readFile(root+'/.build/desktop/'+rel)).digest('hex');
const group=await currentProcessGroup(),launches=[],results=[],errors=[];
let app,page,proxy,stage='fixture',profile;
async function capture(name){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await writeFile(out+'/'+name+'.png',await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).webContents.capturePage().then(i=>i.toPNG())));}
async function launch(scale,campaign){
 app=await _electron.launch({executablePath:root+'/node_modules/electron/dist/electron',args:[root+'/.build/desktop/main.cjs','--ozone-platform=x11','--force-device-scale-factor='+scale,'--data-dir',profile],env:{...process.env,DBUS_SESSION_BUS_ADDRESS:'unix:path='+profile+'/bus'}});
 const pid=app.process().pid;assert.equal((await readFile('/proc/'+pid+'/cgroup','utf8')).trim().split('::')[1],group);launches.push({scale,pid,cgroup:group});
 page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.stack));
 await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
 await page.locator('.campaign-card[data-campaign-id="'+campaign.id+'"]').getByRole('button',{name:/Öffnen|Fortsetzen/}).click();
 await page.waitForFunction(()=>!document.getElementById('workspace-navigation').inert);
 if(!await page.locator('#live-tab').isVisible())await page.locator('#atlas-navigation').click();
 await page.locator('#live-tab').click();await page.getByRole('button',{name:'NSCs am Spieltisch…',exact:true}).waitFor();
}
async function dossier(id){
 await page.getByRole('button',{name:'NSCs am Spieltisch…',exact:true}).click();
 await page.locator('#npc-cast-list [data-npc-id="'+id+'"]').click();
 await page.locator('#npc-cast').getByRole('button',{name:'Gespräch festhalten…',exact:true}).waitFor({state:'visible'});
}
async function conversation(npc){
 await dossier(npc.id);await page.getByRole('button',{name:'Gespräch festhalten…',exact:true}).click();
 await page.waitForFunction(name=>document.getElementById('npc-name').value===name&&!document.getElementById('npc-editor').inert,npc.name);
 await page.waitForFunction(()=>document.activeElement?.id==='npc-contact');
 const visible=await page.locator('#npc-contact').evaluate(el=>{const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return{top:r.top,bottom:r.bottom,viewport:innerHeight,uncovered:y>0&&y<innerHeight&&document.elementFromPoint(x,y)===el};});
 await capture('conversation-entry-'+launches.length);
 assert(visible.top>=0&&visible.bottom<=visible.viewport&&visible.uncovered,'Conversation action must leave its focused field visible');
 return visible;
}
async function close(){
 const child=app.process(),exited=new Promise(r=>child.once('exit',(code,signal)=>r({code,signal})));let timer;
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).close());
 try{const exit=await Promise.race([exited,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Normal close timed out')),10000))]);assert.deepEqual(exit,{code:0,signal:null});launches.at(-1).exit=exit;app=null;}finally{clearTimeout(timer);}
}
try{
 for(const scale of [1,2]){
  stage='fixture '+scale;profile=await mkdtemp('/tmp/npc-conversation-');
  const store=new CampaignStore(profile+'/workbench.sqlite'),campaign=store.create('Gespräch an der Hafenwache'),w=store.activate(campaign.id);
  const command=action=>({commandId:randomUUID(),campaignId:campaign.id,token:w.token,action});
  let scene=store.executeLive(command({kind:'initialize',expectedRosterRevision:0})).scene;
  scene=store.executeLive(command({kind:'scene-content',sceneId:scene.id,expectedRevision:scene.revision,title:'Nachtwache am Zollhaus',notes:'  Szenennotiz bleibt.\r\n',locationId:null})).scene;
  const npcs=[];for(const name of ['Hafenmeisterin Mira','Späher Borin']){const id=randomUUID();npcs.push(store.executeNpc({...command(null),expectedNoteRevision:null,expectedRecordRevision:0,expectedActorRevision:null,expectedPositionRevision:null,npc:{id,name,creatureId:null,readAloud:'  Ein ruhiger Blick.\r\n',gmNotes:'  Geheimnis: '+name+'\r\n',record:{id,revision:0,factionId:null,modifier:0,lifecycle:'active',appearance:'Reisemantel',behavior:'Wachsam',history:'  Frühere Begegnung.\r\n'},locationId:null,health:null}}));}
  const [npc,other]=npcs,receiptsBefore=store.db.prepare('SELECT count(*) n FROM npc_receipt').get().n;
  store.tutorial('skipped');store.close();
  const bus=profile+'/bus';proxy=spawn('xdg-dbus-proxy',[process.env.DBUS_SESSION_BUS_ADDRESS,bus,'--filter','--talk=org.freedesktop.portal.Desktop','--talk=org.freedesktop.Notifications'],{stdio:'ignore'});for(let i=0;i<100&&!await stat(bus).catch(()=>null);i++)await new Promise(r=>setTimeout(r,20));
  stage='conversation entry '+scale;await launch(scale,campaign);const entry=await conversation(npc),header=await page.locator('#npc-contact').inputValue();
  assert.match(header,/Nachtwache am Zollhaus\n$/);const contact=header+'Mira nennt den Geheimgang unter dem Zollhaus.\n  Noch nicht bestätigt.  ';
  await page.locator('#npc-contact').fill(contact);await page.waitForFunction(()=>document.getElementById('npc-save-status').textContent.includes('Entwurf gesichert'));
  await close();
  const check=new CampaignStore(profile+'/workbench.sqlite');try{const active=check.activate(campaign.id);assert.equal(check.npcDraft(active.token,npc.id).fields.contact,contact);assert.deepEqual(check.npc(active.token,npc.id),npc);assert.deepEqual(check.npc(active.token,other.id),other);assert.equal(check.db.prepare('SELECT count(*) n FROM npc_receipt').get().n,receiptsBefore);}finally{check.close();}
  stage='resume and explicitly append '+scale;await launch(scale,campaign);const resumed=await conversation(npc);
  assert.equal(await page.locator('#npc-contact').inputValue(),contact,'Returning to a draft must not append another conversation header');
  await page.locator('#npc-contact').fill(contact+'\nFür den nächsten Abend bestätigt.');
  const confirmed=await page.locator('#npc-contact').inputValue();
  await page.locator('#npc-editor').getByRole('button',{name:'NPC übernehmen',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('npc-save-status').textContent==='Gespeicherter Stand.');
  assert.equal(await page.locator('#npc-contact').inputValue(),'');await close();
  const verify=new CampaignStore(profile+'/workbench.sqlite');try{const active=verify.activate(campaign.id),saved=verify.npc(active.token,npc.id);assert.equal(saved.record.history,npc.record.history+'\n\n'+confirmed);assert.equal(saved.readAloud,npc.readAloud);assert.equal(saved.gmNotes,npc.gmNotes);assert.equal(saved.record.appearance,npc.record.appearance);assert.equal(saved.record.behavior,npc.record.behavior);assert.equal(verify.npcDraft(active.token,npc.id),null);assert.deepEqual(verify.npc(active.token,other.id),other);assert.equal(verify.db.prepare('SELECT count(*) n FROM npc_receipt').get().n,receiptsBefore+1);assert.deepEqual(verify.live(active.token).scene,scene);}finally{verify.close();}
  stage='fresh confirmed dossier '+scale;await launch(scale,campaign);await dossier(npc.id);await page.locator('#npc-cast-document').getByText('Für den nächsten Abend bestätigt.',{exact:false}).scrollIntoViewIfNeeded();
  assert.equal((await page.locator('#npc-cast-document').innerText()).split('Mira nennt den Geheimgang').length-1,1);
  await capture('confirmed-dossier-'+scale);
  // The ordinary profile action keeps its own name-field entry rather than the conversation entry.
  await page.getByRole('button',{name:'Profil bearbeiten…',exact:true}).click();
  await page.waitForFunction(()=>document.activeElement?.id==='npc-name');
  assert(await page.locator('#npc-name').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));
  assert.equal(await page.locator('#npc-contact').inputValue(),'');await close();proxy.kill();proxy=null;
  results.push({scale,profile,campaignId:campaign.id,entry,resumed,rawDraftRestored:true,oneConfirmedHistoryAppend:true,originalProseAndOtherNpcUnchanged:true,ordinaryProfileEntry:true});
 }
 assert.deepEqual(errors,[]);for(const {pid}of launches)assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
 await writeFile(out+'/result.json',JSON.stringify({source,dirty,hashes,launches,results,errors},null,2));console.log(JSON.stringify({results,launches}));
}catch(error){if(app)await capture('failure').catch(()=>{});await writeFile(out+'/failure.json',JSON.stringify({source,dirty,hashes,profile,stage,launches,errors,error:error.stack},null,2));throw error;}
finally{if(app)await app.close();proxy?.kill();}

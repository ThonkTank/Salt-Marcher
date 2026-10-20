// Generate, edit, save, restart, play with today's Party and reopen the result.
import {currentProcessGroup} from './process-group.mjs';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,stat,readFile,writeFile,rm} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=process.cwd(),require=createRequire(root+'/package.json'),{_electron}=require('playwright-core'),Database=require('better-sqlite3');
const output=process.env.QA_EVIDENCE_DIR??root+'/.build/generation-preparation-evidence';await mkdir(output,{recursive:true});await rm(output+'/result.json',{force:true});
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty=!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),group=await currentProcessGroup();
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/generation-preparation-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(root+'/.build/generation-preparation-store.cjs'),profile=await mkdtemp('/tmp/generation-preparation-'),file=profile+'/workbench.sqlite',store=new CampaignStore(file),campaign=store.create('Waldweg am Abend'),w=store.activate(campaign.id),cmd=action=>({commandId:randomUUID(),campaignId:campaign.id,token:w.token,action});
let live=store.executeLive(cmd({kind:'initialize',expectedRosterRevision:0}));
const heroes=[];
for(const [name,xp] of [['Ada',0],['Borin',300],['Cora',900]]){
 const hero=store.executeLive(cmd({kind:'create-character',profile:{name}})).character;heroes.push(hero);live=store.live(w.token);
 store.executeLive(cmd({kind:'membership',characterId:hero.id,expectedRevision:hero.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:live.scene.id,expectedFocusRevision:live.focusRevision}));
 const progress=store.progress(w.token).characters.find(p=>p.characterId===hero.id);store.executeProgress(cmd({kind:'xp',characterId:hero.id,expectedRevision:progress.revision,mode:'set',amount:xp,reason:'Gemischte Startlevel'}));
}
const lootId=randomUUID(),tableId=randomUUID();
store.executeGeneration(cmd({kind:'loot-save',expectedRevision:null,table:{id:lootId,revision:0,name:'Waldwegbeute',description:' Original\r\n',rolls:3,trashed:false,entries:[{id:randomUUID(),weight:'1',minimum:2,maximum:4,item:{name:'Kreide',valueGold:'0',category:'other'}}]}}));
store.executeGeneration(cmd({kind:'table-save',expectedRevision:null,table:{id:tableId,revision:0,scope:'campaign',name:'Goblinspäher',description:' Original\r\n',entries:[{creatureId:'goblin',weight:'1'}],habitats:[],time:'any',lootTableId:lootId,trashed:false}}));
store.tutorial('skipped');store.close();
const bus=profile+'/bus',proxy=spawn('xdg-dbus-proxy',[process.env.DBUS_SESSION_BUS_ADDRESS,bus,'--filter','--talk=org.freedesktop.portal.Desktop','--talk=org.freedesktop.Notifications'],{stdio:'ignore'});
for(let i=0;i<100&&!await stat(bus).catch(()=>null);i++)await new Promise(r=>setTimeout(r,20));
let app,saved,proposal;const launches=[],errors=[],artifacts={};
for(const p of ['main.cjs','preload.cjs','ui/renderer.js','ui/index.html','ui/app.css'])artifacts[p]=createHash('sha256').update(await readFile('.build/desktop/'+p)).digest('hex');
function read(fn){const db=new Database(file,{readonly:true});try{return fn(db);}finally{db.close();}}
const plans=()=>read(db=>db.prepare('SELECT payload FROM encounter_plan WHERE campaign_id=?').all(campaign.id).map(r=>JSON.parse(r.payload)));
const loot=()=>read(db=>db.prepare('SELECT payload FROM treasure WHERE campaign_id=?').all(campaign.id).map(r=>JSON.parse(r.payload)));
const combat=()=>read(db=>JSON.parse(db.prepare('SELECT payload FROM combat WHERE campaign_id=? ORDER BY ordinal DESC LIMIT 1').get(campaign.id).payload));
async function capture(page,name,selector){
 console.log('Native capture: '+name);
 await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));window.show();window.focus();});
 if(selector)await page.locator(selector).scrollIntoViewIfNeeded();
 const pixels=Buffer.from(await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).webContents.capturePage()).toPNG()));
 const png=require('pngjs').PNG.sync.read(pixels),colors=new Set();for(let i=0;i<png.data.length;i+=4*31)colors.add(png.data.readUInt32BE(i));
 assert(colors.size>8,'Native capture must contain rendered UI, not a blank frame');await writeFile(output+'/'+name+'.png',pixels);
}
async function nav(page,id){if(!await page.locator('#'+id).isVisible()){if(await page.locator('#atlas-navigation').isVisible())await page.locator('#atlas-navigation').click();else await page.locator('#workspace-nav-summary').click();}await page.locator('#'+id).click();}
async function launch(zoom){
 app=await _electron.launch({executablePath:root+'/node_modules/electron/dist/electron',args:[root+'/.build/desktop/main.cjs','--ozone-platform=x11','--data-dir',profile],env:{...process.env,DBUS_SESSION_BUS_ADDRESS:'unix:path='+bus}});assert((await readFile('/proc/'+app.process().pid+'/cmdline','utf8')).includes(profile));assert.equal((await readFile('/proc/'+app.process().pid+'/cgroup','utf8')).trim().split('::')[1],group);launches.push({zoom,pid:app.process().pid,cgroup:group});
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.stack));page.setDefaultTimeout(15000);await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');await app.evaluate(({BrowserWindow},zoom)=>{const window=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));window.webContents.setZoomFactor(zoom);window.show();window.focus();},zoom);
 await page.locator('.campaign-card[data-campaign-id="'+campaign.id+'"]').getByRole('button',{name:/Öffnen|Fortsetzen/}).click();await page.waitForFunction(id=>document.getElementById('campaigns').value===id&&!document.getElementById('workspace-navigation').inert,campaign.id);return page;
}
async function close(){
 const process=app.process(),exit=new Promise(r=>process.once('exit',(code,signal)=>r({code,signal})));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).close());let timer;
 try{const result=await Promise.race([exit,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Normal close timed out')),10000))]);assert.deepEqual(result,{code:0,signal:null});launches.at(-1).exit=result;await assert.rejects(stat('/proc/'+process.pid),{code:'ENOENT'});launches.at(-1).pidAbsent=true;app=null;}finally{clearTimeout(timer);}
}
try{
 let page=await launch(1);await nav(page,'catalog-tab');await page.locator('#catalog-search').fill('Goblin');await page.getByRole('button',{name:'Suchen',exact:true}).click();await page.locator('#catalog-tables').click();
 await page.locator('#generation-tables input[value="'+tableId+'"]').check();await page.locator('#generation-title').fill('Späher am Waldweg');await page.locator('#generation-seed').fill('patrol');await page.locator('#generation-difficulty').selectOption('medium');await page.locator('#generation-form').getByRole('button',{name:'Vorschläge erzeugen',exact:true}).click();
 await page.locator('#generation-preview article button:enabled').first().waitFor();assert.match(await page.locator('#generation-party-context').innerText(),/Level 1.*Level 2.*Level 3/);
 proposal=read(db=>JSON.parse(db.prepare('SELECT payload FROM generation_run WHERE campaign_id=?').get(campaign.id).payload));assert.deepEqual(proposal.request.party.map(p=>p.level),[1,2,3]);assert(proposal.plans[0].entries.every(e=>e.creatureId==='goblin'));assert.equal(plans().length,0);
 await capture(page,'proposal-1','#generation-preview article:first-of-type');await page.getByRole('button',{name:'Verknüpfte Beute auswürfeln',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#loot-roll-result').textContent.includes('unverteilte Beute'));
 await page.locator('#generation-preview article button').first().click();await page.locator('#encounter-name').waitFor({state:'visible'});await page.locator('#encounter-name').fill('Goblinspäher – verhandlungsbereit');
 const row=page.locator('#encounter-entries .encounter-entry-row').first();await row.locator('input[type="number"]').fill('2');await row.locator('input[type="checkbox"]').check();
 await page.locator('#encounter-editor details').filter({has:page.locator('#encounter-notes')}).locator('summary').click();await page.locator('#encounter-notes').fill('Die Späher wollen reden. Nur bei Angriff kämpfen.');await nav(page,'live-tab');saved=plans()[0];assert.equal(saved.name,'Goblinspäher – verhandlungsbereit');assert.equal(saved.entries[0].count,2);assert.equal(saved.notes,'Die Späher wollen reden. Nur bei Angriff kämpfen.');await close();
 const edited=new CampaignStore(file);try{const ew=edited.activate(campaign.id),table=edited.encounterTables(ew.token,true).find(t=>t.id===tableId);edited.executeGeneration({commandId:randomUUID(),campaignId:campaign.id,token:ew.token,action:{kind:'table-save',table:{...table,description:'Nach Übernahme redigiert'},expectedRevision:table.revision}});}finally{edited.close();}
 page=await launch(2);await nav(page,'live-tab');if(await page.locator('#live-continue').isVisible())await page.locator('#live-continue').click();
 await page.locator('#party-shortcut').click();const cora=page.locator('#party-active [data-character-id="'+heroes[2].id+'"]');await cora.locator('.party-member-toggle').click();await cora.getByRole('button',{name:'Aus Party',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('#party-active .party-card').length===2&&!document.querySelector('#party-short-rest').disabled);await page.locator('#party-close').click();
 await nav(page,'catalog-tab');await page.locator('#catalog-tables').click();await page.locator('#generation-history').selectOption(proposal.id);await page.getByRole('button',{name:'Gespeicherte Vorlage öffnen',exact:true}).click();await page.waitForFunction(name=>document.querySelector('#encounter-name').value===name,saved.name);assert.equal(await page.locator('#encounter-notes').inputValue(),saved.notes);await capture(page,'saved-2','#encounter-name');const noteSection=page.locator('#encounter-editor details').filter({has:page.locator('#encounter-notes')});if(await noteSection.getAttribute('open')===null)await noteSection.locator('summary').click();await capture(page,'saved-notes-2','#encounter-notes');
 await page.locator('#encounter-prepare').click();await page.locator('#combat-initiative-open').click();
 await page.getByRole('textbox',{name:'Initiative Ada',exact:true}).fill('18');await page.getByRole('textbox',{name:'Initiative Borin',exact:true}).fill('16');await page.getByRole('textbox',{name:'Initiative Goblin A',exact:true}).fill('12');
 await page.getByRole('button',{name:'Übernehmen und Kampf beginnen',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#combat-status').textContent.includes('Am Zug: Ada'));
 assert.deepEqual(combat().participants.filter(p=>p.characterId).map(p=>p.name).sort(),['Ada','Borin']);await page.locator('#combat-next').click();await page.waitForFunction(()=>document.querySelector('#combat-status').textContent.includes('Am Zug: Borin'));await capture(page,'running-2','#combat-status');
 await page.locator('#combat-finish').click();await page.locator('#combat-outcome').fill('Späher ziehen nach Verhandlung ab.');await page.getByRole('button',{name:'Ergebnis speichern und abschließen',exact:true}).click();await page.locator('#combat-finish-dialog').waitFor({state:'hidden'});assert.equal(combat().phase,'finished');assert.deepEqual(plans()[0],saved);await close();
 page=await launch(2);await nav(page,'live-tab');if(await page.locator('#live-continue').isVisible())await page.locator('#live-continue').click();await page.locator('#combat-resume').click();await page.waitForFunction(()=>document.querySelector('#combat-resolution-summary').textContent.includes('Späher ziehen nach Verhandlung ab.'));await capture(page,'finished-fresh-2','#combat-resolution-summary');assert.deepEqual(plans()[0],saved);assert.deepEqual(read(db=>JSON.parse(db.prepare('SELECT payload FROM generation_run WHERE campaign_id=?').get(campaign.id).payload)),proposal);await close();
 assert.equal(loot().length,1);assert.deepEqual(loot()[0].items.map(({name,quantity,allocated})=>({name,quantity,allocated})),[{name:'Kreide',quantity:11,allocated:0}]);
 assert.deepEqual(errors,[]);await writeFile(output+'/result.json',JSON.stringify({source,dirty,profile,artifacts,launches,errors,planningLevels:[1,2,3],combatParty:['Ada','Borin'],saved,loot:loot(),combat:combat()},null,2));console.log(JSON.stringify({output,launches,errors}));
}catch(error){await writeFile(output+'/failure.json',JSON.stringify({error:error.stack,profile,launches,errors},null,2));if(app)try{await capture(await app.firstWindow(),'failure');}catch{}throw error;}
finally{if(app){const process=app.process(),timer=setTimeout(()=>{if(process.exitCode===null)process.kill('SIGKILL');},5000);try{await app.close().catch(()=>{});}finally{clearTimeout(timer);}}proxy.kill();}

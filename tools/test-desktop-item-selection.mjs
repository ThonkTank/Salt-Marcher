import {currentProcessGroup} from './process-group.mjs';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
if(process.argv.length>2)throw Error('Diese Probe prüft den aktuellen Vertrag ohne historische Baseline-Schalter.');
const scale=Number(process.env.QA_DEVICE_SCALE??1);
const source=process.cwd(),phase='after',output=process.env.QA_EVIDENCE_DIR??path.join(source,'.build/item-selection-evidence');
const group=await currentProcessGroup();await mkdir(output,{recursive:true});
const checkout=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty=!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),hashes={};
for(const name of ['main.cjs','preload.cjs','ui/renderer.js','ui/index.html','ui/app.css'])hashes[name]=createHash('sha256').update(await readFile(source+'/.build/desktop/'+name)).digest('hex');
const require=createRequire(source+'/package.json'),{_electron}=require('playwright-core');require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/desktop/item-selection-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});const {CampaignStore}=require(source+'/.build/desktop/item-selection-store.cjs');
const profile=await mkdtemp('/tmp/gm-item-selection-'),file=profile+'/workbench.sqlite',store=new CampaignStore(file),campaign=store.create('Gegenstände vor dem Spiel verteilen'),w=store.activate(campaign.id),command=action=>({commandId:randomUUID(),campaignId:campaign.id,token:w.token,action});
const heroes=['Ada','Borin'].map(name=>store.executeLive(command({kind:'create-character',profile:{name}})).character),scene=store.executeLive(command({kind:'initialize',expectedRosterRevision:2})).scene;
for(const c of heroes){const live=store.live(w.token);store.executeLive(command({kind:'membership',characterId:c.id,expectedRevision:c.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:scene.id,expectedFocusRevision:live.focusRevision}));}
const defs=[];for(const [name,unitCopper]of [['Seil','200'],['Heiltrank','500']]){const definition={id:randomUUID(),revision:0,name,category:'equipment',magic:false,rarity:'',attunement:'no',unitCopper,weightText:'',properties:[],description:'  Handarbeit\r\n- Markt',source:{kind:'authored',label:'GM',license:null,url:null},trashed:false};defs.push(store.executeItemShop(command({kind:'definition',definition,expectedRevision:null})).definition);}
const npcId=randomUUID();store.executeNpc({commandId:randomUUID(),campaignId:campaign.id,token:w.token,expectedNoteRevision:null,expectedRecordRevision:0,expectedActorRevision:null,expectedPositionRevision:null,npc:{id:npcId,name:'Mira',creatureId:null,readAloud:'',gmNotes:'',record:{id:npcId,revision:0,factionId:null,modifier:0,lifecycle:'active',appearance:'',behavior:'',history:''},locationId:null,health:null}});const shop=store.executeItemShop(command({kind:'shop',expectedRevision:null,shop:{id:randomUUID(),revision:0,name:'Hafenladen',owner:{kind:'npc',id:npcId},notes:'  Liste\r\n- Waren',trashed:false,stock:[]}})).shop.shop;
const[a,b]=defs,initialA=store.db.prepare('SELECT * FROM item_definition WHERE id=?').get(a.id);assert(initialA);store.tutorial('skipped');store.close();
const busPath=profile+'/qa-bus',proxy=spawn('xdg-dbus-proxy',[process.env.DBUS_SESSION_BUS_ADDRESS,busPath,'--filter','--talk=org.freedesktop.portal.Desktop','--talk=org.freedesktop.Notifications'],{stdio:'ignore'});for(let i=0;i<100;i++){if(await stat(busPath).then(()=>true).catch(()=>false))break;await new Promise(r=>setTimeout(r,20));}
let app,pid,closed=false;const errors=[],launches=[],results={};
async function launch(){closed=false;app=await _electron.launch({executablePath:source+'/node_modules/electron/dist/electron',args:[source+'/.build/desktop/main.cjs','--ozone-platform=x11','--force-device-scale-factor='+scale,'--data-dir',profile],env:{...process.env,DBUS_SESSION_BUS_ADDRESS:'unix:path='+busPath},timeout:20000});pid=app.process().pid;assert((await readFile(`/proc/${pid}/cmdline`,'utf8')).includes(profile));assert.equal((await readFile(`/proc/${pid}/cgroup`,'utf8')).trim().split('::')[1],group);launches.push({pid,cgroup:group,scale});const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.stack));assert.equal(await page.evaluate(()=>window.devicePixelRatio),scale);await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true',null,{timeout:20000});if(await page.locator('#tutorial-dialog').isVisible())await page.locator('#tutorial-skip').click();await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));w.show();w.focus();});await page.locator('.campaign-card[data-campaign-id="'+campaign.id+'"]').getByRole('button',{name:/Öffnen|Fortsetzen/}).click();await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);if(!await page.locator('#items-tab').isVisible()){if(await page.locator('#atlas-navigation').isVisible())await page.locator('#atlas-navigation').click();else await page.locator('#workspace-nav-summary').click();}await page.locator('#items-tab').click();await page.waitForFunction(()=>document.querySelectorAll('#items-results button').length>0);return page;}
async function close(){assert.deepEqual(errors,[]);const exit=new Promise(r=>app.process().once('exit',(code,signal)=>r({code,signal})));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle()==='SaltMarcher').close());let timer;const ended=await Promise.race([exit,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Normal close timed out')),10000))]).finally(()=>clearTimeout(timer));assert.deepEqual(ended,{code:0,signal:null});await assert.rejects(stat('/proc/'+pid),{code:'ENOENT'});launches.at(-1).exit=ended;launches.at(-1).pidAbsent=true;closed=true;}
async function capture(page,name){
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));w.show();w.focus();});
 await page.evaluate(()=>new Promise((resolve,reject)=>{let frame;const timer=setTimeout(()=>{cancelAnimationFrame(frame);reject(Error('No fresh capture frames'));},2500);frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{clearTimeout(timer);resolve();});});}));
 const bytes=Buffer.from(await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).webContents.capturePage()).toPNG()));
 const png=require('pngjs').PNG.sync.read(bytes),colors=new Set();for(let i=0;i<png.data.length;i+=4*31)colors.add(png.data.readUInt32BE(i));assert(colors.size>8);await writeFile(path.join(output,name+'.png'),bytes);
}
try{
 let page=await launch();const choose=async(name)=>{if(!await page.locator('#item-search').isVisible())await page.locator('#items-show-catalog').click();await page.locator('#item-search').fill(name);await page.locator('#items-search-form button[type=submit]').click();await page.locator('#items-results').getByRole('button',{name:new RegExp('^'+name+' ·')}).click();await page.waitForFunction(name=>document.querySelector('#item-name').value===name&&!document.querySelector('#item-name').disabled,name);};await choose(a.name);if(!await page.locator('#item-recipient').isVisible())await page.locator('#item-usage > summary').click();await page.locator('#item-recipient').selectOption(heroes[0].id);
 if(!await page.locator('#item-award').isVisible())await page.locator('#item-usage > summary').click();await page.locator('#item-award').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Persönliche Beute vergeben.');results.withoutShop={message:await page.locator('#status').innerText()};
await page.locator('#item-treasure').click();
await page.waitForFunction(()=>document.querySelector('#status').textContent==='Unverteilte Beute angelegt.');
results.withoutShop.treasureCreated=true;
 await page.locator('#items-show-shops').click();await page.locator('#shops-list').getByRole('button',{name:/^Hafenladen ·/}).click();await page.waitForFunction(()=>document.querySelector('#shop-name').value==='Hafenladen');await page.locator('#items-show-catalog').click();
 await page.evaluate(()=>{globalThis.qaOldAward=document.querySelector('#item-award').onclick;});
 await app.evaluate(({ipcMain},id)=>{const original=ipcMain._invokeHandlers.get('items:definition');let hold=true;ipcMain.removeHandler('items:definition');ipcMain.handle('items:definition',async(e,...args)=>{const result=await original(e,...args);if(hold&&args[0]===id){hold=false;globalThis.qaHeld=true;return new Promise(resolve=>globalThis.qaRelease=()=>resolve(result));}return result;});},b.id);
 await page.locator('#item-search').fill(b.name);await page.locator('#items-search-form button[type=submit]').click();await page.locator('#items-results').getByRole('button',{name:new RegExp('^'+b.name+' ·')}).click();for(let i=0;i<100;i++){if(await app.evaluate(()=>globalThis.qaHeld))break;await new Promise(r=>setTimeout(r,20));}assert(await app.evaluate(()=>globalThis.qaHeld));results.duringSwitch={name:await page.locator('#item-name').inputValue(),awardEnabled:await page.locator('#item-award').isEnabled()};
 assert.equal(results.duringSwitch.awardEnabled,false);
await page.evaluate(()=>{globalThis.qaOldAward();document.querySelector('#item-copy').onclick();document.querySelector('#item-form').onsubmit({preventDefault(){}});});
 await app.evaluate(()=>globalThis.qaRelease());await page.waitForFunction(name=>document.querySelector('#item-name').value===name,b.name);
 if(!await page.locator('#item-award').isVisible())await page.locator('#item-usage > summary').click();await page.locator('#item-award').click();
await page.waitForFunction(()=>document.querySelector('#status').textContent==='Persönliche Beute vergeben.');
 await page.evaluate(()=>{const digest=crypto.subtle.digest.bind(crypto.subtle);globalThis.qaDraftHashes=0;globalThis.qaHoldDraft=false;crypto.subtle.digest=async(...args)=>{globalThis.qaDraftHashes++;if(globalThis.qaHoldDraft){globalThis.qaDraftHeld=true;await new Promise(resolve=>globalThis.qaReleaseDraft=resolve);}return digest(...args);};});
 await app.evaluate(({ipcMain})=>{globalThis.qaDefinitionWrites=0;const send=ipcMain._invokeHandlers.get('items:execute');if(!send)throw Error('Definition writer handler missing');ipcMain.removeHandler('items:execute');ipcMain.handle('items:execute',async(e,...args)=>{if(args[0].action.kind==='definition')globalThis.qaDefinitionWrites++;return send(e,...args);});});
 if(!await page.locator('#item-name').isVisible())await page.locator('#item-editing > summary').click();
 await page.locator('#item-name').fill('');await page.locator('#item-search').fill(a.name);await page.locator('#items-search-form button[type=submit]').click();await page.locator('#items-results').getByRole('button',{name:new RegExp('^'+a.name+' ·')}).click();
 await page.waitForFunction(()=>document.querySelector('#item-name').value===''&&!document.querySelector('#item-name').disabled&&document.querySelector('#status').textContent.includes('Eingaben bleiben offen'));
 assert.equal(await page.locator('#item-description').inputValue(),b.description.replace(/\r\n/g,'\n'));assert.equal(await page.evaluate(()=>globalThis.qaDraftHashes),0);assert.equal(await app.evaluate(()=>globalThis.qaDefinitionWrites),0);
 await page.locator('#status').scrollIntoViewIfNeeded();await capture(page,'incomplete-definition');
 await page.locator('#item-name').fill('Zaubertrank');await page.evaluate(()=>{globalThis.qaHoldDraft=true;});await page.locator('#items-results').getByRole('button',{name:new RegExp('^'+a.name+' ·')}).click();
 await page.waitForFunction(()=>globalThis.qaDraftHeld===true);assert.equal(await page.locator('#item-name').isDisabled(),true);assert.equal(await app.evaluate(()=>globalThis.qaDefinitionWrites),0);
 await capture(page,'valid-definition-pending');await page.evaluate(()=>{globalThis.qaHoldDraft=false;globalThis.qaReleaseDraft();});
 await page.waitForFunction(name=>document.querySelector('#item-name').value===name&&!document.querySelector('#item-name').disabled,a.name);
 assert.equal(await page.evaluate(()=>globalThis.qaDraftHashes),1);assert.equal(await app.evaluate(()=>globalThis.qaDefinitionWrites),1);results.invalidDraftBookings=0;results.correctedDraftBookings=1;await choose('Zaubertrank');

 if(!await page.locator('#shop-add-item').isVisible())await page.locator('#item-usage > summary').click();await page.locator('#shop-add-item').click();
await page.waitForFunction(()=>document.querySelector('#shop-stock h4')?.textContent.startsWith('Zaubertrank ·'));
await app.evaluate(({ipcMain},id)=>{const original=ipcMain._invokeHandlers.get('items:definition');let fail=true;ipcMain.removeHandler('items:definition');ipcMain.handle('items:definition',async(e,...args)=>{if(fail&&args[0]===id){fail=false;return{ok:false,error:'QA: Gegenstand nicht lesbar'};}return original(e,...args);});},a.id);
await page.locator('#item-search').fill(a.name);
await page.locator('#items-search-form button[type=submit]').click();
await page.locator('#items-results').getByRole('button',{name:new RegExp('^'+a.name+' ·')}).click();
await page.locator('#item-load-status[role=alert]').waitFor();
assert.equal(await page.locator('#item-award').isEnabled(),false);
await page.locator('#item-load-status').scrollIntoViewIfNeeded();
await capture(page,'item-selection-retry');
await page.locator('#item-load-retry').click();
await page.waitForFunction(()=>document.querySelector('#item-name').value==='Seil'&&!document.querySelector('#item-name').disabled);
results.failedReadRetry=true;
await choose('Zaubertrank');
 await page.locator('#item-editor').scrollIntoViewIfNeeded();await capture(page,'item-selection-'+phase);await close();const fresh=new CampaignStore(file);try{const active=fresh.activate(campaign.id),ledger=fresh.ledger(active.token,{characterId:heroes[0].id,after:null,search:'',status:''});results.awards=ledger.items.map(i=>({name:i.name,quantity:i.quantity,definitionId:i.reference.definitionId}));results.prosePreserved=fresh.itemDefinition(b.id).description===b.description;results.withoutShop.awardCount=ledger.items.filter(i=>i.reference.definitionId===a.id).reduce((n,i)=>n+i.quantity,0);assert.deepEqual(fresh.db.prepare('SELECT * FROM item_definition WHERE id=?').get(a.id),initialA);
assert.equal(ledger.items.filter(i=>i.reference.definitionId===a.id).length,1);
assert.equal(ledger.items.filter(i=>i.reference.definitionId===b.id).length,1);
assert.equal(ledger.items.length,2);
assert.equal(fresh.ledger(active.token,{characterId:heroes[1].id,after:null,search:'',status:''}).items.length,0);
assert.equal(fresh.treasures(active.token,null).items.length,1);
const stocked=fresh.shop(active.token,shop.id).shop.stock;
assert.equal(stocked.length,1);
assert.equal(stocked[0].reference.definitionId,b.id);
assert.equal(stocked[0].quantity,1);
assert.equal(ledger.items.find(i=>i.reference.definitionId===a.id).unitCopper,'200');
assert.equal(ledger.items.find(i=>i.reference.definitionId===b.id).unitCopper,'500');
results.definitionAddedToShop=true;
results.otherDefinitionAndCharacterUnchanged=true;}finally{fresh.close();}
 {page=await launch();
await choose('Zaubertrank');assert.equal(await page.locator('#item-reference-description').textContent(),b.description);await capture(page,'reopened-corrected-definition');results.correctedDraftRestart=true;
await page.locator('#item-copy').click();
await page.waitForFunction(()=>document.querySelector('#item-name').value==='Zaubertrank – Kopie');
await page.locator('#item-save').click();
await page.waitForFunction(()=>document.querySelector('#status').textContent==='Gegenstand gespeichert.');
await close();
results.nativeRestartAndCopy=true;
const fresh=new CampaignStore(file);
try{const copies=fresh.itemDefinitions({search:'Zaubertrank',category:'',magic:'',rarity:'',attunement:'',sort:'name',direction:'asc',after:0,includeTrashed:false}).items;assert.equal(copies.length,2);assert(copies.every(d=>d.description===b.description));results.copyKeepsSourceProse=true;}finally{fresh.close();}
 }
 await writeFile(path.join(output,'item-selection-'+phase+'.json'),JSON.stringify({checkout,dirty,hashes,scale,profile,results,launches,normalClose:true},null,2));console.log(JSON.stringify({results,normalClose:true}));assert.equal(results.withoutShop.awardCount,1,'Catalog awards must work without selecting a shop');assert.equal(results.duringSwitch.awardEnabled,false,'Previous definition cannot be used while switching');assert.equal(results.prosePreserved,true,'Untouched definition prose must keep its bytes');
}catch(e){await writeFile(path.join(output,'failure.json'),JSON.stringify({checkout,dirty,hashes,scale,profile,error:e.stack,results,launches,pid},null,2));if(app&&!closed)try{await capture(await app.firstWindow({timeout:1000}),'failure');}catch{}throw e;
}finally{if(app&&!closed){await Promise.race([app.close().catch(()=>{}),new Promise(r=>setTimeout(r,3000))]);if((await readFile(`/proc/${pid}/cmdline`,'utf8').catch(()=>'' )).includes(profile))process.kill(pid,'SIGKILL');}proxy.kill();}

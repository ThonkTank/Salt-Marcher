import {currentProcessGroup} from './process-group.mjs';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
if(process.argv.length>2)throw Error('Diese Probe prüft den aktuellen Vertrag ohne historische Baseline-Schalter.');
const source=process.cwd(),phase='after',output=process.env.QA_EVIDENCE_DIR??path.join(source,'.build/shop-switch-evidence');
const scale=Number(process.env.QA_DEVICE_SCALE??1);
const checkout=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty=!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),hashes={};for(const f of ['main.cjs','preload.cjs','ui/renderer.js','ui/index.html','ui/app.css'])hashes[f]=createHash('sha256').update(await readFile(source+'/.build/desktop/'+f)).digest('hex');
const group=await currentProcessGroup();await mkdir(output,{recursive:true});
const require=createRequire(source+'/package.json'),{_electron}=require('playwright-core');require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/desktop/shop-switch-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});const {CampaignStore}=require(source+'/.build/desktop/shop-switch-store.cjs');
const profile=await mkdtemp('/tmp/gm-shop-switch-'),file=profile+'/workbench.sqlite',store=new CampaignStore(file),campaign=store.create('Markttag mit zwei Händlern'),w=store.activate(campaign.id),command=action=>({commandId:randomUUID(),campaignId:campaign.id,token:w.token,action});
const heroes=['Ada','Borin'].map(name=>store.executeLive(command({kind:'create-character',profile:{name}})).character),scene=store.executeLive(command({kind:'initialize',expectedRosterRevision:2})).scene;
for(const c of heroes){const live=store.live(w.token);store.executeLive(command({kind:'membership',characterId:c.id,expectedRevision:c.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:scene.id,expectedFocusRevision:live.focusRevision}));}
const defs=[];for(const [name,unitCopper]of [['Seil','200'],['Heiltrank','500']]){const definition={id:randomUUID(),revision:0,name,category:'equipment',magic:false,rarity:'',attunement:'no',unitCopper,weightText:'',properties:[],description:'  Handarbeit\r\n- Markt',source:{kind:'authored',label:'GM',license:null,url:null},trashed:false};defs.push(store.executeItemShop(command({kind:'definition',definition,expectedRevision:null})).definition);}
const items=[];for(let i=0;i<2;i++){const ack=store.executeProgress(command({kind:'manual-item',characterId:heroes[i].id,expectedMembershipRevision:store.live(w.token).roster.find(c=>c.id===heroes[i].id).membershipRevision,origin:'manual',item:{name:defs[i].name,quantity:i===0?4:2,valueGold:i===0?'2':'5',category:'equipment',reference:{kind:'authored',definitionId:defs[i].id,revision:defs[i].revision}},note:'  Fund\r\n- Reise'}));items.push(store.ledgerItem(w.token,ack.ledgerIds[0]));}
const[a,b]=items,initialA=store.db.prepare('SELECT payload,checksum FROM character_ledger WHERE id=?').get(a.id),shops=[];
for(const [name,quantity,buyCopper]of [['Hafenladen',5,'200'],['Bergladen',7,'500']]){const id=randomUUID(),npc=store.executeNpc({commandId:randomUUID(),campaignId:campaign.id,token:w.token,expectedNoteRevision:null,expectedRecordRevision:0,expectedActorRevision:null,expectedPositionRevision:null,npc:{id,name:'Besitzer '+name,creatureId:null,readAloud:'',gmNotes:'',record:{id,revision:0,factionId:null,modifier:0,lifecycle:'active',appearance:'',behavior:'',history:''},locationId:null,health:null}});const shop={id:randomUUID(),revision:0,name,owner:{kind:'npc',id:npc.id},notes:'  Preisliste\r\n- Markttag',trashed:false,stock:[{id:randomUUID(),reference:{kind:'authored',definitionId:defs[0].id,revision:defs[0].revision},quantity,unique:false,instanceId:null,buyCopper,sellCopper:'100',notes:'',restock:null}]};shops.push(store.executeItemShop(command({kind:'shop',shop,expectedRevision:null})).shop.shop);}const[sa,sb]=shops;store.tutorial('skipped');store.close();
const busPath=profile+'/qa-bus',proxy=spawn('xdg-dbus-proxy',[process.env.DBUS_SESSION_BUS_ADDRESS,busPath,'--filter','--talk=org.freedesktop.portal.Desktop','--talk=org.freedesktop.Notifications'],{stdio:'ignore'});for(let i=0;i<100;i++){if(await stat(busPath).then(()=>true).catch(()=>false))break;await new Promise(r=>setTimeout(r,20));}
let app,pid,closed=false;const errors=[],launches=[],results={};
async function launch(){closed=false;app=await _electron.launch({executablePath:source+'/node_modules/electron/dist/electron',args:[source+'/.build/desktop/main.cjs','--ozone-platform=x11','--force-device-scale-factor='+scale,'--data-dir',profile],env:{...process.env,DBUS_SESSION_BUS_ADDRESS:'unix:path='+busPath},timeout:20000});pid=app.process().pid;assert((await readFile(`/proc/${pid}/cmdline`,'utf8')).includes(profile));assert.equal((await readFile(`/proc/${pid}/cgroup`,'utf8')).trim().split('::')[1],group);launches.push({pid,cgroup:group});const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.stack));assert.equal(await page.evaluate(()=>window.devicePixelRatio),scale);await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true',null,{timeout:20000});if(await page.locator('#tutorial-dialog').isVisible())await page.locator('#tutorial-skip').click();await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));w.show();w.focus();});await page.locator('.campaign-card[data-campaign-id="'+campaign.id+'"]').getByRole('button',{name:/Öffnen|Fortsetzen/}).click();await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);if(!await page.locator('#items-tab').isVisible()){if(await page.locator('#atlas-navigation').isVisible())await page.locator('#atlas-navigation').click();else await page.locator('#workspace-nav-summary').click();}await page.locator('#items-tab').click();await page.locator('#items-show-shops').click();await page.waitForFunction(()=>document.querySelectorAll('#shops-list button').length===2);return page;}
async function close(){assert.deepEqual(errors,[]);const exit=new Promise(r=>app.process().once('exit',(code,signal)=>r({code,signal})));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).close());let timer;const ended=await Promise.race([exit,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Normal close timed out')),10000))]).finally(()=>clearTimeout(timer));assert.deepEqual(ended,{code:0,signal:null});await assert.rejects(stat('/proc/'+pid),{code:'ENOENT'});launches.at(-1).exit=ended;launches.at(-1).pidAbsent=true;closed=true;}
async function capture(page,name){
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));w.show();w.focus();});
 await page.evaluate(()=>new Promise((resolve,reject)=>{let frame;const timer=setTimeout(()=>{cancelAnimationFrame(frame);reject(Error('No fresh capture frames'));},2500);frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{clearTimeout(timer);resolve();});});}));
 const bytes=Buffer.from(await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).webContents.capturePage()).toPNG()));
 const png=require('pngjs').PNG.sync.read(bytes),colors=new Set();for(let i=0;i<png.data.length;i+=4*31)colors.add(png.data.readUInt32BE(i));assert(colors.size>8);await writeFile(path.join(output,name+'.png'),bytes);
}
async function held(){for(let i=0;i<100;i++){if(await app.evaluate(()=>globalThis.qaHeld))return;await new Promise(r=>setTimeout(r,20));}assert.fail('IPC not held');}
try{
 let page=await launch();const choose=async name=>{await page.locator('#shops-list').getByRole('button',{name:new RegExp('^'+name+' ·')}).click();await page.waitForFunction(name=>document.querySelector('#shop-name').value===name,name);};await choose(sa.name);await page.locator('#shop-seller').selectOption(heroes[0].id);await page.locator('#shop-sale-item').selectOption(a.id);
 await page.evaluate(()=>{globalThis.qaOldBuy=[...document.querySelectorAll('#shop-stock button')].find(b=>b.hasAttribute('data-purchase-available')).onclick;});
 await app.evaluate(({ipcMain},id)=>{const original=ipcMain._invokeHandlers.get('items:shop');let hold=true;ipcMain.removeHandler('items:shop');ipcMain.handle('items:shop',async(e,...args)=>{const result=await original(e,...args);if(hold&&args[1]===id){hold=false;globalThis.qaHeld=true;return new Promise(resolve=>globalThis.qaRelease=()=>resolve(result));}return result;});},sb.id);
 await page.locator('#shops-list').getByRole('button',{name:new RegExp('^'+sb.name+' ·')}).click();await held();results.shopSwitch={name:await page.locator('#shop-name').inputValue(),oldBuyEnabled:await page.locator('#shop-stock').getByRole('button',{name:/^Für .* kaufen$/}).isEnabled()};
 assert.equal(results.shopSwitch.oldBuyEnabled,false);
await page.evaluate(()=>globalThis.qaOldBuy());
 await app.evaluate(()=>{globalThis.qaRelease();globalThis.qaHeld=false;});await page.waitForFunction(name=>document.querySelector('#shop-name').value===name,sb.name);
 await page.locator('#shop-stock').getByRole('button',{name:/^Für .* kaufen$/}).click();
await page.waitForFunction(()=>document.querySelector('#shop-stock h4').textContent.includes('6 verfügbar'));
 await page.locator('#shop-seller').selectOption(heroes[0].id);await page.locator('#shop-sale-item').selectOption(a.id);
 await app.evaluate(({ipcMain},id)=>{const original=ipcMain._invokeHandlers.get('campaign:ledger-inventory');let hold=true;ipcMain.removeHandler('campaign:ledger-inventory');ipcMain.handle('campaign:ledger-inventory',async(e,...args)=>{const result=await original(e,...args);if(hold&&args[1].characterId===id){hold=false;globalThis.qaHeld=true;return new Promise(resolve=>globalThis.qaRelease=()=>resolve(result));}return result;});},heroes[1].id);
 await page.locator('#shop-seller').selectOption(heroes[1].id);await held();results.sellerSwitch={oldItem:await page.locator('#shop-sale-item').inputValue(),saleEnabled:await page.locator('#shop-sale-form button[type=submit]').isEnabled()};
 assert.equal(results.sellerSwitch.saleEnabled,false);
await page.evaluate(()=>document.querySelector('#shop-sale-form').onsubmit({preventDefault(){}}));
 await app.evaluate(()=>globalThis.qaRelease());await page.waitForFunction(id=>[...document.querySelector('#shop-sale-item').options].some(o=>o.value===id),b.id);await page.locator('#shop-sale-item').selectOption(b.id);
 await page.locator('#shop-sale-quantity').fill('1');
await page.locator('#shop-sale-price').fill('3');
await page.locator('#shop-sale-form button[type=submit]').click();
await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Verkauf gebucht'));
await page.waitForFunction(()=>[...document.querySelector('#shop-sale-item').options].some(o=>o.textContent==='1 × Heiltrank'));
 await app.evaluate(({ipcMain},id)=>{const original=ipcMain._invokeHandlers.get('items:shop');let fail=true;ipcMain.removeHandler('items:shop');ipcMain.handle('items:shop',async(e,...args)=>{if(fail&&args[1]===id){fail=false;return{ok:false,error:'QA: Shop nicht lesbar'};}return original(e,...args);});},sa.id);
await page.locator('#shops-list').getByRole('button',{name:new RegExp('^'+sa.name+' ·')}).click();
await page.locator('#shop-load-status[role=alert]').waitFor();
assert.equal(await page.locator('#shop-name').isDisabled(),true);
await page.locator('#shop-load-status').scrollIntoViewIfNeeded();
await capture(page,'shop-read-error');
await page.locator('#shop-load-retry').click();
await page.waitForFunction(name=>document.querySelector('#shop-name').value===name&&!document.querySelector('#shop-fields').disabled,sa.name);
results.shopRetry=true;
await app.evaluate(({ipcMain},id)=>{const original=ipcMain._invokeHandlers.get('campaign:ledger-inventory');let fail=true;ipcMain.removeHandler('campaign:ledger-inventory');ipcMain.handle('campaign:ledger-inventory',async(e,...args)=>{if(fail&&args[1].characterId===id){fail=false;return{ok:false,error:'QA: Inventar nicht lesbar'};}return original(e,...args);});},heroes[0].id);
await page.locator('#shop-seller').selectOption(heroes[0].id);
await page.locator('#shop-seller-status[role=alert]').waitFor();
assert.equal(await page.locator('#shop-sale-item option').count(),0);
await page.locator('#shop-seller-status').scrollIntoViewIfNeeded();
await capture(page,'seller-read-error');
await page.locator('#shop-seller-retry').click();
await page.locator('#shop-sale-item').selectOption(a.id);
results.sellerRetry=true;
await page.evaluate(()=>{
  const digest=crypto.subtle.digest.bind(crypto.subtle);globalThis.qaDraftHashes=0;globalThis.qaHoldDraft=false;
  crypto.subtle.digest=async(...args)=>{globalThis.qaDraftHashes++;if(globalThis.qaHoldDraft){globalThis.qaDraftHeld=true;await new Promise(resolve=>globalThis.qaReleaseDraft=resolve);}return digest(...args);};
 });
 await app.evaluate(({ipcMain})=>{globalThis.qaDraftWrites=0;const send=ipcMain._invokeHandlers.get('items:execute');if(!send)throw Error('Shop writer handler missing');ipcMain.removeHandler('items:execute');ipcMain.handle('items:execute',async(e,...args)=>{globalThis.qaDraftWrites++;return send(e,...args);});});
 if(!await page.locator('#shop-name').isVisible())await page.locator('#shop-settings > summary').click();
 await page.locator('#shop-name').fill('');await page.locator('#shops-list').getByRole('button',{name:new RegExp('^'+sb.name+' ·')}).click();
 await page.waitForFunction(()=>document.querySelector('#shop-name').value===''&&!document.querySelector('#shop-fields').disabled&&document.querySelector('#status').textContent.includes('Eingaben bleiben offen'));
 assert.equal(await page.evaluate(()=>globalThis.qaDraftHashes),0);assert.equal(await app.evaluate(()=>globalThis.qaDraftWrites),0);
 await page.locator('#status').scrollIntoViewIfNeeded();await capture(page,'incomplete-draft');
 await page.locator('#shop-name').fill('Hafenladen korrigiert');await page.evaluate(()=>{globalThis.qaHoldDraft=true;});
 await page.locator('#shops-list').getByRole('button',{name:new RegExp('^'+sb.name+' ·')}).click();
 await page.waitForFunction(()=>globalThis.qaDraftHeld===true);assert.equal(await page.locator('#shop-fields').evaluate(n=>n.disabled),true);assert.equal(await page.locator('#shop-form button[type=submit]').isDisabled(),true);assert.equal(await app.evaluate(()=>globalThis.qaDraftWrites),0);
 await capture(page,'valid-draft-pending');await page.evaluate(()=>{globalThis.qaHoldDraft=false;globalThis.qaReleaseDraft();});
 await page.waitForFunction(name=>document.querySelector('#shop-name').value===name&&!document.querySelector('#shop-fields').disabled,sb.name);
 assert.equal(await page.evaluate(()=>globalThis.qaDraftHashes),1);assert.equal(await app.evaluate(()=>globalThis.qaDraftWrites),1);
 results.incompleteShopDraftRepairable=true;results.invalidDraftBookings=0;results.correctedDraftBookings=1;
 await page.locator('#shop-sale-form').scrollIntoViewIfNeeded();await capture(page,'shop-switch-'+phase);await close();const fresh=new CampaignStore(file);try{const active=fresh.activate(campaign.id);results.final={a:fresh.ledgerItem(active.token,a.id).quantity,b:fresh.ledgerItem(active.token,b.id).quantity,shopA:fresh.shop(active.token,sa.id).shop.stock[0].quantity,shopB:fresh.shop(active.token,sb.id).shop.stock[0].quantity};assert.deepEqual(results.final,{a:4,b:1,shopA:5,shopB:6});
assert.deepEqual(fresh.db.prepare('SELECT payload,checksum FROM character_ledger WHERE id=?').get(a.id),initialA);
const purchased=fresh.ledgerInventory(active.token,{characterId:heroes[0].id,after:null}).items.filter(i=>i.origin==='purchase');
assert.equal(purchased.length,1);
assert.equal(purchased[0].quantity,1);
assert.equal(purchased[0].paidCopper,'500');
assert.equal(fresh.shop(active.token,sb.id).shop.stock.find(e=>e.reference.definitionId===defs[1].id).quantity,1);
const sold=fresh.ledger(active.token,{characterId:heroes[1].id,after:null,search:'',status:'sold'}).items;
assert.equal(sold.length,1);
assert.equal(sold[0].actualSaleCopper,'300');
results.correctBuyerAndSaleProceeds=true;
results.unchangedSourceBytes=true;
results.shopNotesPreserved=fresh.shop(active.token,sa.id).shop.notes===sa.notes;}finally{fresh.close();}
 page=await launch();
await choose(sb.name);
assert.match(await page.locator('#shop-stock').innerText(),/6 verfügbar/);
await page.locator('#shop-seller').selectOption(heroes[1].id);
await page.locator('#shop-sale-item').getByRole('option',{name:'1 × Heiltrank',exact:true}).waitFor({state:'attached'});
results.nativeRestart=true;await choose('Hafenladen korrigiert');if(!await page.locator('#shop-notes').isVisible())await page.locator('#shop-settings > summary').click();assert.equal(await page.locator('#shop-notes').inputValue(),sa.notes.replace(/\r\n/g,'\n'));await capture(page,'reopened-corrected-draft');await choose(sb.name);results.correctedDraftRestart=true;
await page.locator('#shop-seller').selectOption(heroes[0].id);
const stock=page.locator('#shop-stock article').filter({has:page.getByRole('heading',{name:/Seil ·/})});
await stock.getByLabel('Kaufmenge',{exact:true}).fill('3');
await stock.getByLabel('Tatsächlich gezahlt (GM gesamt)',{exact:true}).fill('1.01');
await stock.getByRole('button',{name:/^Für .* kaufen$/,exact:true}).click();
await page.waitForFunction(()=>document.querySelector('#status').textContent==='Kauf gebucht.');
await page.locator('#shop-sale-item').selectOption({label:'3 × Seil'});
await page.locator('#shop-sale-quantity').fill('1');
await page.locator('#shop-sale-price').fill('0.07');
await page.locator('#shop-sale-form button[type=submit]').click();
await page.waitForFunction(()=>document.querySelector('#status').textContent==='Verkauf gebucht.');
const showHistory=async()=>{await page.getByText('Handels- und Auffüllverlauf',{exact:true}).click();await page.locator('#shop-history').scrollIntoViewIfNeeded();return page.locator('#shop-history').innerText();};
const history=await showHistory();
assert(history.includes('Gezahlt: 1,01 GM'));
assert(history.includes('Erlös: 0,07 GM'));
await capture(page,'trade-price-history');
await close();
page=await launch();
await choose(sb.name);
const reopened=await showHistory();
assert.equal(reopened,history);
assert.match(await page.locator('#shop-stock').innerText(),/Seil · 4 verfügbar/);
await page.locator('#shop-seller').selectOption(heroes[0].id);
await page.locator('#shop-sale-item').getByRole('option',{name:'2 × Seil',exact:true}).waitFor({state:'attached'});
await close();
const check=new CampaignStore(file);
try{const active=check.activate(campaign.id),received=check.ledgerInventory(active.token,{characterId:heroes[0].id,after:null}).items.find(l=>l.origin==='purchase'&&l.quantity===2),sold=check.ledger(active.token,{characterId:heroes[0].id,after:null,search:'',status:'sold'}).items.find(l=>l.parentId===received.id);assert.equal(received.paidCopper,'68');assert.equal(sold.paidCopper,'33');assert.equal(sold.actualSaleCopper,'7');assert.equal(check.shop(active.token,sb.id).shop.stock[0].quantity,4);assert.equal(check.shop(active.token,sa.id).shop.notes,sa.notes);results.partialTrade={paidCopper:'101',remainingPaidCopper:received.paidCopper,soldPaidCopper:sold.paidCopper,actualSaleCopper:sold.actualSaleCopper,history,reopenedIdentical:true};}finally{check.close();}
 await writeFile(path.join(output,'shop-switch-'+phase+'.json'),JSON.stringify({checkout,dirty,hashes,scale,results,launches,normalClose:true},null,2));console.log(JSON.stringify({results,normalClose:true}));assert.equal(results.shopSwitch.oldBuyEnabled,false,'Old shop cannot remain tradable while switching');assert.equal(results.sellerSwitch.saleEnabled,false,'Old seller inventory cannot be sold while switching');assert.equal(results.shopNotesPreserved,true,'Editing shop name must preserve untouched CRLF notes');
}catch(e){await writeFile(path.join(output,'failure.json'),JSON.stringify({checkout,dirty,hashes,scale,profile,error:e.stack,results,launches,pid},null,2));if(app&&!closed)try{await capture(await app.firstWindow({timeout:1000}),'failure');}catch{}throw e;
}finally{if(app&&!closed){await Promise.race([app.close().catch(()=>{}),new Promise(r=>setTimeout(r,3000))]);if((await readFile(`/proc/${pid}/cmdline`,'utf8').catch(()=>'' )).includes(profile))process.kill(pid,'SIGKILL');}proxy.kill();}

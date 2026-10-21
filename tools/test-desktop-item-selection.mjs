import {createNativeSession} from './native-session.mjs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
if(process.argv.length>2)throw Error('Diese Probe prüft den aktuellen Vertrag ohne historische Baseline-Schalter.');
const zoom=Number(process.env.GM_QA_ZOOM??1);
const source=process.cwd(),output=process.env.QA_EVIDENCE_DIR??path.join(source,'.build/item-selection-evidence');
const native=await createNativeSession({root:source,output,name:'gm-item-selection',resultName:'item-selection-after.json'});
const require=createRequire(source+'/package.json');require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/desktop/item-selection-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});const {CampaignStore}=require(source+'/.build/desktop/item-selection-store.cjs');
const file=native.profile+'/workbench.sqlite',store=new CampaignStore(file,require(source+'/package.json').version),campaign=store.create('Gegenstände vor dem Spiel verteilen'),w=store.activate(campaign.id),command=action=>({commandId:randomUUID(),campaignId:campaign.id,token:w.token,action});
const heroes=['Ada','Borin'].map(name=>store.executeLive(command({kind:'create-character',profile:{name}})).character),scene=store.executeLive(command({kind:'initialize',expectedRosterRevision:2})).scene;
for(const c of heroes){const live=store.live(w.token);store.executeLive(command({kind:'membership',characterId:c.id,expectedRevision:c.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:scene.id,expectedFocusRevision:live.focusRevision}));}
const defs=[];for(const [name,unitCopper]of [['Seil','200'],['Heiltrank','500']]){const definition={id:randomUUID(),revision:0,name,category:'equipment',magic:false,rarity:'',attunement:'no',unitCopper,weightText:'',properties:[],description:'  Handarbeit\r\n- Markt',source:{kind:'authored',label:'GM',license:null,url:null},trashed:false};defs.push(store.executeItemShop(command({kind:'definition',definition,expectedRevision:null})).definition);}
const npcId=randomUUID();store.executeNpc({commandId:randomUUID(),campaignId:campaign.id,token:w.token,expectedNoteRevision:null,expectedRecordRevision:0,expectedActorRevision:null,expectedPositionRevision:null,npc:{id:npcId,name:'Mira',creatureId:null,readAloud:'',gmNotes:'',record:{id:npcId,revision:0,factionId:null,modifier:0,lifecycle:'active',appearance:'',behavior:'',history:''},locationId:null,health:null}});const shop=store.executeItemShop(command({kind:'shop',expectedRevision:null,shop:{id:randomUUID(),revision:0,name:'Hafenladen',owner:{kind:'npc',id:npcId},notes:'  Liste\r\n- Waren',trashed:false,stock:[]}})).shop.shop;
const[a,b]=defs,initialA=store.db.prepare('SELECT * FROM item_definition WHERE id=?').get(a.id);assert(initialA);store.tutorial('skipped');store.close();
const results={};
async function launch(){
 const page=await native.launch(zoom);if(await page.locator('#tutorial-dialog').isVisible())await page.locator('#tutorial-skip').click();
 await page.locator('.campaign-card[data-campaign-id="'+campaign.id+'"]').getByRole('button',{name:/Öffnen|Fortsetzen/}).click();await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
 if(!await page.locator('#items-tab').isVisible()&&await page.locator('#atlas-navigation').isVisible())await page.locator('#atlas-navigation').click();if(!await page.locator('#items-tab').isVisible())await page.locator('#workspace-nav-summary').click();
 await page.locator('#items-tab').click();await page.waitForFunction(()=>document.querySelectorAll('#items-results button').length>0);return page;
}
try{
 let page=await launch();const choose=async(name)=>{if(!await page.locator('#item-search').isVisible())await page.locator('#items-show-catalog').click();await page.locator('#item-search').fill(name);await page.locator('#items-search-form button[type=submit]').click();await page.locator('#items-results').getByRole('button',{name:new RegExp('^'+name+' ·')}).click();await page.waitForFunction(name=>document.querySelector('#item-name').value===name&&!document.querySelector('#item-name').disabled,name);};await choose(a.name);if(!await page.locator('#item-recipient').isVisible())await page.locator('#item-usage > summary').click();await page.locator('#item-recipient').selectOption(heroes[0].id);
 if(!await page.locator('#item-award').isVisible())await page.locator('#item-usage > summary').click();await page.locator('#item-award').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Persönliche Beute vergeben.');results.withoutShop={message:await page.locator('#status').innerText()};
await page.locator('#item-treasure').click();
await page.waitForFunction(()=>document.querySelector('#status').textContent==='Unverteilte Beute angelegt.');
results.withoutShop.treasureCreated=true;
 await page.locator('#items-show-shops').click();await page.locator('#shops-list').getByRole('button',{name:/^Hafenladen ·/}).click();await page.waitForFunction(()=>document.querySelector('#shop-name').value==='Hafenladen');await page.locator('#items-show-catalog').click();
 await page.evaluate(()=>{globalThis.qaOldAward=document.querySelector('#item-award').onclick;});
 await native.app.evaluate(({ipcMain},id)=>{const original=ipcMain._invokeHandlers.get('items:definition');let hold=true;ipcMain.removeHandler('items:definition');ipcMain.handle('items:definition',async(e,...args)=>{const result=await original(e,...args);if(hold&&args[0]===id){hold=false;globalThis.qaHeld=true;return new Promise(resolve=>globalThis.qaRelease=()=>resolve(result));}return result;});},b.id);
 await page.locator('#item-search').fill(b.name);await page.locator('#items-search-form button[type=submit]').click();await page.locator('#items-results').getByRole('button',{name:new RegExp('^'+b.name+' ·')}).click();for(let i=0;i<100;i++){if(await native.app.evaluate(()=>globalThis.qaHeld))break;await new Promise(r=>setTimeout(r,20));}assert(await native.app.evaluate(()=>globalThis.qaHeld));results.duringSwitch={name:await page.locator('#item-name').inputValue(),awardEnabled:await page.locator('#item-award').isEnabled()};
 assert.equal(results.duringSwitch.awardEnabled,false);
await page.evaluate(()=>{globalThis.qaOldAward();document.querySelector('#item-copy').onclick();document.querySelector('#item-form').onsubmit({preventDefault(){}});});
 await native.app.evaluate(()=>globalThis.qaRelease());await page.waitForFunction(name=>document.querySelector('#item-name').value===name,b.name);
 if(!await page.locator('#item-award').isVisible())await page.locator('#item-usage > summary').click();await page.locator('#item-award').click();
await page.waitForFunction(()=>document.querySelector('#status').textContent==='Persönliche Beute vergeben.');
 await page.evaluate(()=>{const digest=crypto.subtle.digest.bind(crypto.subtle);globalThis.qaDraftHashes=0;globalThis.qaHoldDraft=false;crypto.subtle.digest=async(...args)=>{globalThis.qaDraftHashes++;if(globalThis.qaHoldDraft){globalThis.qaDraftHeld=true;await new Promise(resolve=>globalThis.qaReleaseDraft=resolve);}return digest(...args);};});
 await native.app.evaluate(({ipcMain})=>{globalThis.qaDefinitionWrites=0;const send=ipcMain._invokeHandlers.get('items:execute');if(!send)throw Error('Definition writer handler missing');ipcMain.removeHandler('items:execute');ipcMain.handle('items:execute',async(e,...args)=>{if(args[0].action.kind==='definition')globalThis.qaDefinitionWrites++;return send(e,...args);});});
 if(!await page.locator('#item-name').isVisible())await page.locator('#item-editing > summary').click();
 await page.locator('#item-name').fill('');await page.locator('#item-search').fill(a.name);await page.locator('#items-search-form button[type=submit]').click();await page.locator('#items-results').getByRole('button',{name:new RegExp('^'+a.name+' ·')}).click();
 await page.waitForFunction(()=>document.querySelector('#item-name').value===''&&!document.querySelector('#item-name').disabled&&document.querySelector('#status').textContent.includes('Eingaben bleiben offen'));
 assert.equal(await page.locator('#item-description').inputValue(),b.description.replace(/\r\n/g,'\n'));assert.equal(await page.evaluate(()=>globalThis.qaDraftHashes),0);assert.equal(await native.app.evaluate(()=>globalThis.qaDefinitionWrites),0);
 await page.locator('#status').scrollIntoViewIfNeeded();await native.capture(page,'incomplete-definition','#item-name');
 await page.locator('#item-name').fill('Zaubertrank');await page.evaluate(()=>{globalThis.qaHoldDraft=true;});await page.locator('#items-results').getByRole('button',{name:new RegExp('^'+a.name+' ·')}).click();
 await page.waitForFunction(()=>globalThis.qaDraftHeld===true);assert.equal(await page.locator('#item-name').isDisabled(),true);assert.equal(await native.app.evaluate(()=>globalThis.qaDefinitionWrites),0);
 await native.capture(page,'valid-definition-pending','#item-name');await page.evaluate(()=>{globalThis.qaHoldDraft=false;globalThis.qaReleaseDraft();});
 await page.waitForFunction(name=>document.querySelector('#item-name').value===name&&!document.querySelector('#item-name').disabled,a.name);
 assert.equal(await page.evaluate(()=>globalThis.qaDraftHashes),1);assert.equal(await native.app.evaluate(()=>globalThis.qaDefinitionWrites),1);results.invalidDraftBookings=0;results.correctedDraftBookings=1;await choose('Zaubertrank');

 if(!await page.locator('#shop-add-item').isVisible())await page.locator('#item-usage > summary').click();await page.locator('#shop-add-item').click();
await page.waitForFunction(()=>document.querySelector('#shop-stock h4')?.textContent.startsWith('Zaubertrank ·'));
await native.app.evaluate(({ipcMain},id)=>{const original=ipcMain._invokeHandlers.get('items:definition');let fail=true;ipcMain.removeHandler('items:definition');ipcMain.handle('items:definition',async(e,...args)=>{if(fail&&args[0]===id){fail=false;return{ok:false,error:'QA: Gegenstand nicht lesbar'};}return original(e,...args);});},a.id);
await page.locator('#item-search').fill(a.name);
await page.locator('#items-search-form button[type=submit]').click();
await page.locator('#items-results').getByRole('button',{name:new RegExp('^'+a.name+' ·')}).click();
await page.locator('#item-load-status[role=alert]').waitFor();
assert.equal(await page.locator('#item-award').isEnabled(),false);
await page.locator('#item-load-status').scrollIntoViewIfNeeded();
await native.capture(page,'item-selection-retry','#item-load-status');
await page.locator('#item-load-retry').click();
await page.waitForFunction(()=>document.querySelector('#item-name').value==='Seil'&&!document.querySelector('#item-name').disabled);
results.failedReadRetry=true;
await choose('Zaubertrank');
 await page.locator('#item-editor').scrollIntoViewIfNeeded();assert.equal(await page.locator('#item-reference-title').textContent(),'Zaubertrank');await native.capture(page,'item-selection-after','#item-reference-title');await native.close();const fresh=new CampaignStore(file);try{const active=fresh.activate(campaign.id),ledger=fresh.ledger(active.token,{characterId:heroes[0].id,after:null,search:'',status:''});results.awards=ledger.items.map(i=>({name:i.name,quantity:i.quantity,definitionId:i.reference.definitionId}));results.prosePreserved=fresh.itemDefinition(b.id).description===b.description;results.withoutShop.awardCount=ledger.items.filter(i=>i.reference.definitionId===a.id).reduce((n,i)=>n+i.quantity,0);assert.deepEqual(fresh.db.prepare('SELECT * FROM item_definition WHERE id=?').get(a.id),initialA);
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
await choose('Zaubertrank');assert.equal(await page.locator('#item-reference-description').textContent(),b.description);assert.equal(await page.locator('#item-reference-title').textContent(),'Zaubertrank');await native.capture(page,'reopened-corrected-definition','#item-reference-title');results.correctedDraftRestart=true;
await page.locator('#item-copy').click();
await page.waitForFunction(()=>document.querySelector('#item-name').value==='Zaubertrank – Kopie');
await page.locator('#item-save').click();
await page.waitForFunction(()=>document.querySelector('#status').textContent==='Gegenstand gespeichert.');
await native.close();
results.nativeRestartAndCopy=true;
const fresh=new CampaignStore(file);
try{const copies=fresh.itemDefinitions({search:'Zaubertrank',category:'',magic:'',rarity:'',attunement:'',sort:'name',direction:'asc',after:0,includeTrashed:false}).items;assert.equal(copies.length,2);assert(copies.every(d=>d.description===b.description));results.copyKeepsSourceProse=true;}finally{fresh.close();}
 }
 assert.equal(results.withoutShop.awardCount,1,'Catalog awards must work without selecting a shop');assert.equal(results.duringSwitch.awardEnabled,false,'Previous definition cannot be used while switching');assert.equal(results.prosePreserved,true,'Untouched definition prose must keep its bytes');
 await native.finish({complete:true,zoom,results});console.log(JSON.stringify({complete:true,source:native.source,zoom,results,launches:native.launches}));
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}

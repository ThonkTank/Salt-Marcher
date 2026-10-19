import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';import {createRequire} from 'node:module';import {buildSync} from 'esbuild';import {parseHTML} from 'linkedom';
const require=createRequire(import.meta.url);for(const[entry,name]of [['src/app/storage/store.ts','shop-switch-store'],['src/app/items-ui.ts','shop-switch-ui']])buildSync({entryPoints:[entry],outfile:'.build/'+name+'.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const tick=()=>new Promise(r=>setImmediate(r)),held=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};async function until(fn){for(let i=0;i<250;i++){if(fn())return;await tick();}assert(fn(),'Expected shop state');}
async function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),'shop-switch-')),{CampaignStore}=require('../.build/shop-switch-store.cjs'),store=new CampaignStore(root+'/store.sqlite'),cam=store.create('Markttag'),w=store.activate(cam.id),command=action=>({commandId:randomUUID(),campaignId:cam.id,token:w.token,action});
 const heroes=['Ada','Borin'].map(name=>store.executeLive(command({kind:'create-character',profile:{name}})).character),scene=store.executeLive(command({kind:'initialize',expectedRosterRevision:2})).scene;
 for(const c of heroes){const live=store.live(w.token);store.executeLive(command({kind:'membership',characterId:c.id,expectedRevision:c.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:scene.id,expectedFocusRevision:live.focusRevision}));}
 const definition=store.executeItemShop(command({kind:'definition',expectedRevision:null,definition:{id:randomUUID(),revision:0,name:'Seil',category:'equipment',magic:false,rarity:'',attunement:'no',unitCopper:'200',weightText:'',properties:[],description:'Original',source:{kind:'authored',label:'GM',license:null,url:null},trashed:false}})).definition,items=[];
 for(const c of heroes){const ack=store.executeProgress(command({kind:'manual-item',characterId:c.id,expectedMembershipRevision:store.live(w.token).roster.find(m=>m.id===c.id).membershipRevision,origin:'manual',item:{name:'Seil',quantity:4,valueGold:'2',category:'equipment',reference:{kind:'authored',definitionId:definition.id,revision:definition.revision}},note:'  Reise\r\n- Fund'}));items.push(store.ledgerItem(w.token,ack.ledgerIds[0]));}
 const shops=[];for(const[name,quantity]of [['Hafenladen',5],['Bergladen',7]]){const id=randomUUID();store.executeNpc({commandId:randomUUID(),campaignId:cam.id,token:w.token,expectedNoteRevision:null,expectedRecordRevision:0,expectedActorRevision:null,expectedPositionRevision:null,npc:{id,name:'Besitzer '+name,creatureId:null,readAloud:'',gmNotes:'',record:{id,revision:0,factionId:null,modifier:0,lifecycle:'active',appearance:'',behavior:'',history:''},locationId:null,health:null}});shops.push(store.executeItemShop(command({kind:'shop',expectedRevision:null,shop:{id:randomUUID(),revision:0,name,owner:{kind:'npc',id},notes:'  Markttag\r\n- Feste Preise',trashed:false,stock:[{id:randomUUID(),reference:{kind:'authored',definitionId:definition.id,revision:definition.revision},quantity,unique:false,instanceId:null,buyCopper:'200',sellCopper:'100',notes:'',restock:null}]}})).shop.shop);}
 const previous={window:globalThis.window,document:globalThis.document},{window,document}=parseHTML(readFileSync('src/app/index.html','utf8'));Object.assign(globalThis,{window,document});Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.__qaValue??this.options[0]?.value??'';},set(v){this.__qaValue=v;}});const local=new Map();window.localStorage={getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};
 const response=fn=>{try{return{ok:true,value:fn()};}catch(e){return{ok:false,error:e.message};}},writes=[],messages=[];window.campaign={};for(const key of ['preparation','progress','live','itemDefinitions','itemDefinition','shops','shop','ledgerInventory','commitStatus'])window.campaign[key]=async(...args)=>response(()=>store[key](...args));window.campaign.executeItemShop=async c=>{writes.push(c);return response(()=>store.executeItemShop(c));};
 delete require.cache[require.resolve('../.build/shop-switch-ui.cjs')];const ui=require('../.build/shop-switch-ui.cjs');ui.initItems(text=>messages.push(text),async()=>{});const el=id=>document.getElementById(id);for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{value:select.id==='item-sort'?'name':select.id==='item-direction'?'asc':'',writable:true});ui.activateItems(w);await ui.openItems();
 const choose=id=>[...el('shops-list').querySelectorAll('button')].find(b=>b.textContent.startsWith(shops.find(s=>s.id===id).name+' ·')).onclick();choose(shops[0].id);await until(()=>el('shop-name').value===shops[0].name&&!el('shop-fields').disabled);el('shop-buyer').value=heroes[0].id;el('shop-seller').value=heroes[0].id;el('shop-seller').onchange();await until(()=>el('shop-sale-item').options.length===1&&!el('shop-sale-fields').disabled);el('shop-sale-item').value=items[0].id;
 const buy=()=>[...el('shop-stock').querySelectorAll('button')].find(b=>b.textContent==='Für Figur kaufen').onclick(),sell=()=>{el('shop-sale-quantity').value='1';el('shop-sale-price').value='3';el('shop-sale-form').onsubmit({preventDefault(){}});},settle=async()=>{await tick();await ui.flushItems();await tick();};
 return{store,w,cam,heroes,items,shops,ui,el,choose,buy,sell,settle,writes,messages,async cleanup(){await settle();ui.activateItems(w);Object.assign(globalThis,previous);store.close();rmSync(root,{recursive:true,force:true});}};
}
test('shop context and trades use the live roster without an unrelated progress read',async()=>{
 const x=await fixture(),original=window.campaign.progress;let reads=0;
 try{
  window.campaign.progress=async()=>{reads++;return{ok:false,error:'Unrelated XP read unavailable'};};
  await x.ui.openItems(x.shops[0].id);assert.equal(x.el('item-context-status').hidden,true);assert.equal(x.el('shop-fields').disabled,false);
  x.buy();await x.settle();assert.equal(x.writes[0].action.kind,'purchase');assert.equal(x.writes[0].action.characterId,x.heroes[0].id);
  x.sell();await x.settle();assert.deepEqual(x.writes.map(c=>c.action.kind),['purchase','sell']);assert.equal(x.store.ledgerItem(x.w.token,x.items[0].id).quantity,3);
  assert.equal(x.store.shop(x.w.token,x.shops[0].id).shop.stock[0].quantity,5);assert.equal(reads,0);assert.deepEqual(x.messages,['Kauf gebucht.','Verkauf gebucht.']);
 }finally{window.campaign.progress=original;await x.cleanup();}
});
test('shop selection blocks detached old purchases and commits an explicit purchase only in the requested shop',async()=>{
 const x=await fixture();try{const original=window.campaign.shop,pause=held(),oldBuy=[...x.el('shop-stock').querySelectorAll('button')].find(b=>b.textContent==='Für Figur kaufen').onclick;window.campaign.shop=async(t,id)=>id===x.shops[1].id?pause.promise:original(t,id);x.choose(x.shops[1].id);await until(()=>!x.el('shop-load-status').hidden);assert.equal(x.el('shop-fields').disabled,true);oldBuy();x.el('shop-form').onsubmit({preventDefault(){}});await tick();assert.equal(x.writes.length,0);pause.resolve(await original(x.w.token,x.shops[1].id));await until(()=>!x.el('shop-fields').disabled);oldBuy();await tick();assert.equal(x.writes.length,0);x.buy();await x.settle();assert.equal(x.writes.length,1);assert.equal(x.writes[0].action.shopId,x.shops[1].id);assert.equal(x.store.shop(x.w.token,x.shops[0].id).shop.stock[0].quantity,5);assert.equal(x.store.shop(x.w.token,x.shops[1].id).shop.stock[0].quantity,6);}finally{await x.cleanup();}
});
test('seller selection clears old options and cannot sell the previous character inventory',async()=>{
 const x=await fixture();try{const original=window.campaign.ledgerInventory,pause=held(),initial=x.store.db.prepare('SELECT payload,checksum FROM character_ledger WHERE id=?').get(x.items[0].id);window.campaign.ledgerInventory=async(t,q)=>q.characterId===x.heroes[1].id?pause.promise:original(t,q);x.el('shop-seller').value=x.heroes[1].id;x.el('shop-seller').onchange();assert.equal(x.el('shop-sale-item').options.length,0);assert.equal(x.el('shop-sale-fields').disabled,true);x.sell();await tick();assert.equal(x.writes.length,0);pause.resolve(await original(x.w.token,{characterId:x.heroes[1].id,after:null}));await until(()=>!x.el('shop-sale-fields').disabled);x.el('shop-sale-item').value=x.items[1].id;x.sell();await x.settle();assert.equal(x.writes.length,1);assert.equal(x.writes[0].action.ledgerId,x.items[1].id);assert.equal(x.store.ledgerItem(x.w.token,x.items[1].id).quantity,3);assert.deepEqual(x.store.db.prepare('SELECT payload,checksum FROM character_ledger WHERE id=?').get(x.items[0].id),initial);}finally{await x.cleanup();}
});
test('failed shop selection remains locked and retries the same requested shop',async()=>{
 const x=await fixture();try{const original=window.campaign.shop;let fail=true;window.campaign.shop=async(t,id)=>id===x.shops[1].id&&fail?(fail=false,{ok:false,error:'Shop nicht lesbar'}):original(t,id);x.choose(x.shops[1].id);await until(()=>x.el('shop-load-status').getAttribute('role')==='alert');x.buy();await tick();assert.equal(x.writes.length,0);assert.equal(x.el('shop-fields').disabled,true);x.el('shop-load-retry').onclick();await until(()=>!x.el('shop-fields').disabled);assert.equal(x.el('shop-name').value,'Bergladen');assert.equal(x.el('shop-load-status').hidden,true);assert.deepEqual(x.messages,[]);}finally{await x.cleanup();}
});
test('a superseded shop error cannot disable the newer selection',async()=>{
 const x=await fixture();try{const original=window.campaign.shop,pause=held();window.campaign.shop=async(t,id)=>id===x.shops[1].id?pause.promise:original(t,id);x.choose(x.shops[1].id);await tick();x.choose(x.shops[0].id);await until(()=>!x.el('shop-fields').disabled);pause.resolve({ok:false,error:'Veraltet'});await tick();assert.equal(x.el('shop-name').value,'Hafenladen');assert.equal(x.el('shop-load-status').hidden,true);assert.deepEqual(x.messages,[]);}finally{await x.cleanup();}
});
test('wrong shop and inventory owners never become tradable',async()=>{
 const x=await fixture();try{const original=window.campaign.shop;window.campaign.shop=async()=>original(x.w.token,x.shops[0].id);x.choose(x.shops[1].id);await until(()=>x.el('shop-load-status').getAttribute('role')==='alert');assert.equal(x.el('shop-fields').disabled,true);window.campaign.shop=original;x.choose(x.shops[0].id);await until(()=>!x.el('shop-fields').disabled);window.campaign.ledgerInventory=async()=>({ok:true,value:{items:[x.items[0]],problems:[],next:null}});x.el('shop-seller').value=x.heroes[1].id;x.el('shop-seller').onchange();await until(()=>x.el('shop-seller-status').getAttribute('role')==='alert');x.sell();await tick();assert.equal(x.writes.length,0);assert.equal(x.el('shop-sale-item').options.length,0);}finally{await x.cleanup();}
});
test('seller read failure offers same-owner retry without retaining the previous inventory',async()=>{
 const x=await fixture();try{const original=window.campaign.ledgerInventory;let fail=true;window.campaign.ledgerInventory=async(t,q)=>q.characterId===x.heroes[1].id&&fail?(fail=false,{ok:false,error:'Inventar nicht lesbar'}):original(t,q);x.el('shop-seller').value=x.heroes[1].id;x.el('shop-seller').onchange();await until(()=>x.el('shop-seller-status').getAttribute('role')==='alert');assert.equal(x.el('shop-sale-item').options.length,0);x.el('shop-seller-retry').onclick();await until(()=>!x.el('shop-sale-fields').disabled);x.el('shop-sale-item').value=x.items[1].id;x.sell();await x.settle();assert.equal(x.writes[0].action.ledgerId,x.items[1].id);assert.equal(x.el('shop-seller-status').hidden,true);assert(!x.messages.includes('Inventar nicht lesbar'));}finally{await x.cleanup();}
});
test('an incomplete shop draft blocks the switch while keeping the previous editor repairable',async()=>{
 const x=await fixture();try{x.el('shop-name').value='';x.el('shop-form').oninput();x.choose(x.shops[1].id);await until(()=>x.messages.length>0&&!x.el('shop-fields').disabled);assert.equal(x.el('shop-name').value,'');assert.equal(x.store.shop(x.w.token,x.shops[0].id).shop.name,'Hafenladen');x.el('shop-name').value='Hafenladen korrigiert';x.el('shop-form').oninput();assert(await x.ui.flushItems());assert.equal(x.store.shop(x.w.token,x.shops[0].id).shop.name,'Hafenladen korrigiert');}finally{await x.cleanup();}
});
test('seller changes during a definition read invalidate the pending sale',async()=>{
 const x=await fixture();try{const original=window.campaign.itemDefinition,pause=held();window.campaign.itemDefinition=()=>pause.promise;x.sell();await tick();x.el('shop-seller').value=x.heroes[1].id;x.el('shop-seller').onchange();await until(()=>x.el('shop-sale-item').options.length===1);pause.resolve(await original(x.items[0].reference.definitionId));await x.settle();assert.equal(x.writes.length,0);assert.equal(x.store.ledgerItem(x.w.token,x.items[0].id).quantity,4);}finally{await x.cleanup();}
});
test('campaign activation invalidates pending shop and seller replies',async()=>{
 const x=await fixture();try{const originalShop=window.campaign.shop,originalLedger=window.campaign.ledgerInventory,shopPause=held(),sellerPause=held();window.campaign.shop=()=>shopPause.promise;window.campaign.ledgerInventory=()=>sellerPause.promise;x.choose(x.shops[1].id);await tick();x.el('shop-seller').value=x.heroes[1].id;x.el('shop-seller').onchange();x.ui.activateItems(x.w);shopPause.resolve(await originalShop(x.w.token,x.shops[1].id));sellerPause.resolve(await originalLedger(x.w.token,{characterId:x.heroes[1].id,after:null}));await tick();assert.equal(x.el('shop-editor').hidden,true);assert.equal(x.el('shop-sale-item').options.length,0);assert.equal(x.el('shop-load-status').hidden,true);assert.equal(x.writes.length,0);}finally{await x.cleanup();}
});

test('editing the shop name preserves untouched CRLF notes while explicit prose edits still save',async()=>{
 const x=await fixture();try{const original=x.shops[0].notes;x.el('shop-notes').value=original.replace(/\r\n/g,'\n');x.el('shop-name').value='Neuer Hafenladen';x.el('shop-form').oninput();assert(await x.ui.flushItems());assert.equal(x.store.shop(x.w.token,x.shops[0].id).shop.notes,original);x.el('shop-notes').value='Neue\nNotiz';x.el('shop-form').oninput();assert(await x.ui.flushItems());assert.equal(x.store.shop(x.w.token,x.shops[0].id).shop.notes,'Neue\nNotiz');}finally{await x.cleanup();}
});

test('failed shared usage context revokes a loaded shop until explicit recovery',async()=>{
 const x=await fixture(),preparation=window.campaign.preparation;
 try{
  const before=x.store.shop(x.w.token,x.shops[0].id);window.campaign.preparation=async()=>({ok:false,error:'Shop owner context unavailable'});await x.ui.openItems();
  assert.equal(x.el('shop-fields').disabled,true);assert.equal(x.el('shop-sale-fields').disabled,true);assert.equal(x.el('shop-new').disabled,true);
  x.buy();x.sell();await x.settle();assert.equal(x.writes.length,0);assert.deepEqual(x.store.shop(x.w.token,x.shops[0].id),before);
  window.campaign.preparation=preparation;x.el('item-context-retry').onclick();await until(()=>x.el('item-context-status').hidden&&!x.el('shop-fields').disabled);
  assert.equal(x.el('shop-name').value,x.shops[0].name);assert.deepEqual(x.messages,[]);assert.equal(x.writes.length,0);
 }finally{window.campaign.preparation=preparation;await x.cleanup();}
});

test('manual stock addition works without configuring an automatic restock rule',async()=>{
 const x=await fixture();try{
  const manual=[...x.el('shop-stock').querySelectorAll('label')].find(l=>l.firstChild.textContent==='Manuell hinzufügen')?.querySelector('input'),add=[...x.el('shop-stock').querySelectorAll('button')].find(b=>b.textContent==='Auffüllen');assert(manual);assert(add);
  manual.value='3';add.onclick();await until(()=>x.writes.some(c=>c.action.kind==='restock'));await x.settle();
  const action=x.writes.find(c=>c.action.kind==='restock').action;assert.equal(action.quantity,3);assert.equal(action.mode,'add');assert.equal(action.shopId,x.shops[0].id);assert.equal(action.entryId,x.shops[0].stock[0].id);
  const saved=x.store.shop(x.w.token,x.shops[0].id).shop;assert.equal(saved.stock[0].quantity,8);assert.equal(saved.stock[0].restock,null);assert.equal(x.store.shop(x.w.token,x.shops[1].id).shop.stock[0].quantity,7);assert.equal(x.writes.filter(c=>c.action.kind==='shop').length,0,'manual addition must not create or save an automatic rule');
 }finally{await x.cleanup();}
});

test('shop history shows the original negotiated purchase and partial sale after prices change',async()=>{
 const x=await fixture();try{
  const input=label=>[...x.el('shop-stock').querySelectorAll('label')].find(l=>l.firstChild.textContent===label).querySelector('input');
  input('Kaufmenge').value='3';input('Tatsächlich gezahlt (GM gesamt)').value='1.01';x.buy();await x.settle();
  const purchase=x.store.ledgerInventory(x.w.token,{characterId:x.heroes[0].id,after:null}).items.find(l=>l.origin==='purchase');
  x.el('shop-sale-item').value=purchase.id;x.el('shop-sale-quantity').value='1';x.el('shop-sale-price').value='0.07';x.el('shop-sale-form').onsubmit({preventDefault(){}});await x.settle();
  const history=x.el('shop-history').textContent;assert.match(history,/Kauf: 3 × Seil · Gezahlt: 1,01 GM/);assert.match(history,/Verkauf an Shop: 1 × Seil · Erlös: 0,07 GM/);
  assert.equal(x.store.ledgerItem(x.w.token,purchase.id).paidCopper,'68');
  const original=x.store.db.prepare('SELECT * FROM shop_event ORDER BY rowid').all(),command=action=>({commandId:randomUUID(),campaignId:x.cam.id,token:x.w.token,action});
  const definition=x.store.shop(x.w.token,x.shops[0].id).items[0];x.store.executeItemShop(command({kind:'definition',expectedRevision:definition.revision,definition:{...definition,unitCopper:'99999'}}));
  const shop=x.store.shop(x.w.token,x.shops[0].id).shop;shop.stock[0].buyCopper='77777';shop.stock[0].sellCopper='88888';x.store.executeItemShop(command({kind:'shop',expectedRevision:shop.revision,shop}));
  x.choose(shop.id);await tick();await until(()=>!x.el('shop-fields').disabled);assert.match(x.el('shop-history').textContent,/Gezahlt: 1,01 GM/);assert.match(x.el('shop-history').textContent,/Erlös: 0,07 GM/);
  for(const row of original)assert.deepEqual(x.store.db.prepare('SELECT * FROM shop_event WHERE id=?').get(row.id),row);
 }finally{await x.cleanup();}
});

test('old and unreadable historical amounts stay explicit instead of using current shop prices',async()=>{
 const x=await fixture();try{
  const original=window.campaign.shop;window.campaign.shop=async(...args)=>{const r=await original(...args);return{...r,value:{...r.value,history:[
   {id:'legacy',time:'Damals',description:'Historischer Einkauf'},
   ...[undefined,'0','99999999999999999','1.5'].map((paidCopper,i)=>({id:String(i),time:'Damals',description:'Kauf '+i,facts:{entry:{origin:'purchase',status:'received',paidCopper}}})),
   {id:'sale',time:'Damals',description:'Alter Verkauf',facts:{entry:{status:'sold',actualSaleCopper:null}}},
  ]}};};
  x.choose(x.shops[0].id);await tick();await until(()=>!x.el('shop-fields').disabled);const history=x.el('shop-history').textContent;
  assert.match(history,/Historischer Einkauf/);assert.match(history,/Kauf 0 · Gezahlt: nicht aufgezeichnet/);assert.match(history,/Kauf 1 · Gezahlt: 0,00 GM/);assert.match(history,/Kauf 2 · Gezahlt: 999999999999999,99 GM/);assert.match(history,/Kauf 3 · Gezahlt: nicht lesbar/);assert.match(history,/Alter Verkauf · Erlös: nicht aufgezeichnet/);
 }finally{await x.cleanup();}
});

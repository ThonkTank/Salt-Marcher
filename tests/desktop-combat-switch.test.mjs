import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from './helpers/build.mjs';
import {parseHTML} from './helpers/dom.mjs';
const require=createRequire(import.meta.url);
for(const [entry,out]of [['src/app/storage/store.ts','combat-switch-store'],['src/app/combat.ts','combat-switch-ui']])buildSync({entryPoints:[entry],outfile:'.build/'+out+'.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const tick=()=>new Promise(r=>setImmediate(r));
async function until(check){for(let i=0;i<100;i++){if(check())return;await tick();}assert(check(),'Expected encounter state');}
export async function fixture(options=true){
 const {withCombats=true,empty=false,finished=false}=typeof options==='boolean'?{withCombats:options}:options;
 const root=mkdtempSync(path.join(tmpdir(),'combat-switch-')),{CampaignStore}=require('../.build/combat-switch-store.cjs'),store=new CampaignStore(root+'/workbench.sqlite'),campaign=store.create('Zwei Begegnungen'),w=store.activate(campaign.id),command=action=>({commandId:randomUUID(),token:w.token,campaignId:campaign.id,action});
 const scene=store.executeLive(command({kind:'initialize',expectedRosterRevision:0})).scene,combats=[];
 for(const [index,[title,name,hp]]of (withCombats?[['Torwache','Wache',10],['Keller','Wolf',8]]:[]).entries()){let c=store.executeCombat({...command({kind:'create',sceneId:scene.id,title,includeParty:false,expectedMembershipRevision:scene.membershipRevision}),combatId:null,expectedRevision:null}).combat;if(!empty||index===0)c=store.executeCombat({...command({kind:'add',name,count:1,grouped:false,maxHp:hp,armorClass:10,initiativeBonus:0}),combatId:c.id,expectedRevision:c.revision}).combat;if(finished&&index===0)c=store.executeCombat({...command({kind:'finish',outcome:'Überstanden'}),combatId:c.id,expectedRevision:c.revision}).combat;combats.push(c);}
 const [a,b]=combats,previous={window:globalThis.window,document:globalThis.document},{window,document}=parseHTML(readFileSync('src/app/index.html','utf8'));Object.assign(globalThis,{window,document});
 const storage=new Map();window.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{value:'',writable:true});
 const response=fn=>{try{return{ok:true,value:fn()};}catch(e){return{ok:false,error:e.message};}},reads=[],writes=[],waiting=[],messages=[];let hold=false,fail=false;
 window.campaign={};for(const key of ['combatDraft','combatDrafts','keepCombatDraft','discardCombatDraft','commitStatus'])window.campaign[key]=async(...args)=>response(()=>store[key](...args));
 window.campaign.combat=async(...args)=>{reads.push(args[2]);const r=fail?{ok:false,error:'Begegnung nicht lesbar'}:response(()=>store.combat(...args));fail=false;if(hold){hold=false;return new Promise(resolve=>waiting.push(()=>resolve(r)));}return r;};
 window.campaign.executeCombat=async c=>{writes.push(c);return response(()=>store.executeCombat(c));};
 delete require.cache[require.resolve('../.build/combat-switch-ui.cjs')];const ui=require('../.build/combat-switch-ui.cjs');ui.initCombat(text=>messages.push(text));ui.combatContext(w,scene);const el=id=>document.getElementById(id);
 await until(()=>el('combat-title').textContent===(withCombats?'Keller':'Begegnung führen')&&!el('combat-notes').disabled);
 const choose=id=>{el('combat-history').value=id;el('combat-history').onchange();},input=(id,text)=>{el(id).value=text;el(id).dispatchEvent(new window.Event('input'));},fighter=async()=>{el('combat-rows').querySelector('button').onclick();await until(()=>!el('combat-participant').hidden&&!el('fighter-hp').disabled);};
 return{store,w,ui,a,b,el,choose,input,fighter,reads,writes,messages,waiting,hold:()=>{hold=true;},fail:()=>{fail=true;},release:()=>waiting.shift()(),cleanup(){ui.combatContext(null,null);Object.assign(globalThis,previous);store.close();rmSync(root,{recursive:true,force:true});}};
}
test('selecting another encounter blocks old writes and preserves its incomplete notes',async()=>{
 const x=await fixture();try{x.choose(x.a.id);await until(()=>x.el('combat-title').textContent==='Torwache'&&!x.el('combat-notes').disabled);await x.fighter();x.input('combat-edit-title','');x.input('combat-notes','Unfertig\r\n');assert(await x.ui.flushCombat());x.hold();x.choose(x.b.id);await until(()=>x.waiting.length===1);assert.equal(x.el('fighter-damage').disabled,true);x.el('fighter-amount').value='1';x.el('fighter-damage').onclick();await tick();assert.equal(x.writes.length,0);assert.equal(x.store.combat(x.w.token,x.a.sceneId,x.a.id).combat.participants[0].hp,10);
 x.release();await until(()=>x.el('combat-title').textContent==='Keller'&&!x.el('combat-notes').disabled);await x.fighter();x.el('fighter-amount').value='1';x.el('fighter-damage').onclick();await until(()=>x.writes.length===1&&!x.el('fighter-hp').disabled);assert.equal(x.writes[0].combatId,x.b.id);assert.equal(x.store.combat(x.w.token,x.b.sceneId,x.b.id).combat.participants[0].hp,7);
 const d=x.store.combatDraft(x.w.token,x.a.id,'notes',x.a.id);assert.equal(d.values.title,'');assert.equal(d.values.notes,'Unfertig\r\n');
 }finally{x.cleanup();}
});
test('visiting a finished encounter preserves the open encounter draft and blocks stale writes',async()=>{
 const x=await fixture({finished:true});try{await x.fighter();x.input('combat-edit-title','');x.input('combat-notes','Unfertig\r\n');assert(await x.ui.flushCombat());x.hold();x.choose(x.a.id);await until(()=>x.waiting.length===1);assert.equal(x.el('fighter-damage').disabled,true);x.el('fighter-amount').value='1';x.el('fighter-damage').onclick();await tick();assert.equal(x.writes.length,0);assert.equal(x.store.combat(x.w.token,x.b.sceneId,x.b.id).combat.participants[0].hp,8);
 x.release();await until(()=>x.el('combat-title').textContent==='Torwache');x.choose(x.b.id);await until(()=>x.el('combat-title').textContent==='Keller'&&!x.el('combat-notes').disabled);await x.fighter();x.el('fighter-amount').value='1';x.el('fighter-damage').onclick();await until(()=>x.writes.length===1&&!x.el('fighter-hp').disabled);assert.equal(x.writes[0].combatId,x.b.id);assert.equal(x.store.combat(x.w.token,x.b.sceneId,x.b.id).combat.participants[0].hp,7);
 const d=x.store.combatDraft(x.w.token,x.b.id,'notes',x.b.id);assert.equal(d.values.title,'');assert.equal(d.values.notes,'Unfertig\r\n');
 }finally{x.cleanup();}
});
for(const finished of [false,true]){
test(`a failed selection clears old actions and retries the requested encounter (${finished?'finished':'open'} target)`,async()=>{
 const x=await fixture({finished});try{await x.fighter();x.fail();x.choose(x.a.id);await until(()=>x.messages.some(m=>m.includes('nicht lesbar')));assert.equal(x.el('combat-workspace').hidden,true);assert.equal(x.el('combat-creation').hidden,true);assert.equal(x.el('combat-status').hidden,true);assert.equal(x.el('combat-history').value,x.a.id);assert.equal(x.el('fighter-damage').disabled,true);assert.equal(x.el('combat-refresh').disabled,false);assert.equal(x.el('combat-load-status').getAttribute('role'),'alert');x.el('combat-refresh').onclick();await until(()=>x.el('combat-title').textContent==='Torwache'&&!x.el('combat-notes').disabled);assert.equal(x.reads.at(-1),x.a.id);assert.equal(x.el('combat-load-status').hidden,true);
 }finally{x.cleanup();}
});
test(`a superseded failure cannot clear or announce an error over a newer selection (${finished?'finished':'open'} target)`,async()=>{
 const x=await fixture({finished});try{x.fail();x.hold();x.choose(x.a.id);await until(()=>x.waiting.length===1);x.choose(x.b.id);await tick();await tick();x.release();await tick();assert.equal(x.el('combat-title').textContent,'Keller');assert.deepEqual(x.messages,[]);assert.equal(x.el('combat-load-status').hidden,true);
 }finally{x.cleanup();}
});
test(`late reads cannot populate a different scene or restore its encounter picker (${finished?'finished':'open'} target)`,async()=>{
 const x=await fixture({finished});try{x.hold();x.choose(x.a.id);await until(()=>x.waiting.length===1);x.ui.combatContext(null,null);x.release();await tick();assert.equal(x.el('combat-panel').hidden,true);assert.equal(x.el('combat-history').children.length,0);assert.deepEqual(x.messages,[]);
 }finally{x.cleanup();}
});
test(`a reply for a different encounter never becomes the editable selected encounter (${finished?'finished':'open'} target)`,async()=>{
 const x=await fixture({finished});try{window.campaign.combat=async()=>({ok:true,value:x.store.combat(x.w.token,x.a.sceneId,x.a.id)});x.choose(x.b.id);await tick();await tick();assert.equal(x.el('combat-workspace').hidden,true);assert.equal(x.el('fighter-damage').disabled,true);assert.equal(x.el('combat-load-status').getAttribute('role'),'alert');assert.equal(x.writes.length,0);
 }finally{x.cleanup();}
});
}


test('history search remains available after a selected combat cannot be read',async()=>{const x=await fixture();try{x.fail();x.choose(x.a.id);await until(()=>x.el('combat-load-status').getAttribute('role')==='alert');let reads=0;Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.__qaValue??this.options[0]?.value??'';},set(v){this.__qaValue=v;}});window.HTMLElement.prototype.showModal=function(){this.open=true;};window.HTMLElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};window.campaign.maskHistory=async(_token,sceneId,query)=>{reads++;return{ok:true,value:{campaignId:x.w.campaign.id,sceneId,query,items:[],total:0,next:null}};};assert.equal(x.el('combat-history-open').disabled,false);x.el('combat-history-open').onclick();await tick();await tick();assert.equal(reads,1);}finally{x.cleanup();}});

test('a packet encounter invalidated before loading issues no read or command',async()=>{const x=await fixture();try{const count=x.reads.length;await x.ui.prepareWorldGroup({id:'group',title:'Angezeigte Gruppe',revision:1},undefined,()=>false);assert.equal(x.reads.length,count);assert.equal(x.writes.length,0);}finally{x.cleanup();}});
test('a packet encounter invalidated during loading never sends a create command',async()=>{const x=await fixture();try{let active=true;x.hold();const pending=x.ui.prepareWorldGroup({id:'group',title:'Angezeigte Gruppe',revision:1},undefined,()=>active);await until(()=>x.waiting.length===1);active=false;x.release();await pending;assert.equal(x.writes.length,0);}finally{x.cleanup();}});

test('refreshing Combat cannot enable an empty Scene-group selection through its generic control lock',async()=>{
 const x=await fixture();try{
  for(const key of ['sceneEncounterSelection'])window.campaign[key]=async(...args)=>({ok:true,value:x.store[key](...args)});
  x.el('combat-creation').open=true;x.el('combat-selection-refresh').click();await until(()=>x.el('combat-selection-status').textContent==='');
  assert.equal(x.el('combat-selection-prepare').disabled,true);x.el('combat-refresh').onclick();await until(()=>!x.el('combat-refresh').disabled);
  assert.equal(x.el('combat-selection-prepare').disabled,true);assert.equal(x.writes.length,0);
 }finally{x.cleanup();}
});

function adoptEncounterVisit(x){
 const command=action=>({commandId:randomUUID(),token:x.w.token,campaignId:x.w.campaign.id,action}),planId=randomUUID(),visitId=randomUUID();
 x.store.changePreparation({...command(null),change:{kind:'plan',expectedRevision:null,plan:{version:1,id:planId,revision:1,name:'Abend am Tor',scenes:[{id:visitId,title:'Hinterhalt',notes:'',locationId:null}]}}});
 const encounter=x.store.saveEncounterPlan({...command(null),expectedRevision:null,plan:{id:randomUUID(),revision:0,name:'Vorbereiteter Hinterhalt',notes:'',party:[],entries:[{id:randomUUID(),creatureId:'goblin',count:2,grouped:true}],sources:[],catalogHash:''}});
 const attached=x.store.executeSession(command({kind:'attach',planId,visitId,expectedVisitRevision:0,encounterId:encounter.id,expectedEncounterRevision:encounter.revision}));
 const live=x.store.live(x.w.token);
 return x.store.executeLive(command({kind:'apply-visit',sceneId:live.scene.id,expectedRevision:live.scene.revision,planId,visitId,expectedPlanRevision:1,expectedVisitRevision:attached.visits[0].revision})).scene;
}

test('adopting a visit in the same Scene automatically refreshes available encounter groups without replacing the active combat',async()=>{
 const x=await fixture();try{
  await until(()=>x.el('combat-panel').getAttribute('aria-busy')==='false');
  const live=x.store.live(x.w.token);x.ui.combatContext(x.w,live.scene,live.rosterRevision);await until(()=>x.el('combat-panel').getAttribute('aria-busy')==='false');
  for(const key of ['sceneEncounterSelection'])window.campaign[key]=async(...args)=>({ok:true,value:x.store[key](...args)});
  x.el('combat-creation').open=true;x.el('combat-selection-refresh').click();await until(()=>x.el('combat-selection-status').textContent==='');
  assert.equal(x.el('combat-selection-groups').querySelectorAll(':scope > article > label > input').length,0);
  const before=x.store.combat(x.w.token,x.b.sceneId,x.b.id).combat,adopted=adoptEncounterVisit(x);
  assert.equal(adopted.id,live.scene.id);assert.equal(adopted.membershipRevision,live.scene.membershipRevision);
  x.ui.combatContext(x.w,adopted,live.rosterRevision);
  await until(()=>x.el('combat-selection-groups').textContent.includes('Vorbereiteter Hinterhalt'));
  assert.equal(x.el('combat-selection-groups').querySelectorAll(':scope > article > label > input').length,1);
  assert.equal(x.el('combat-selection-prepare').disabled,true);
  assert.deepEqual(x.store.combat(x.w.token,x.b.sceneId,x.b.id).combat,before);assert.equal(x.el('combat-title').textContent,'Keller');assert.equal(x.writes.length,0);
 }finally{x.cleanup();}
});

test('an encounter handoff read begun before a new visit cannot create a combat in that visit',async()=>{
 const x=await fixture();try{
  await until(()=>x.el('combat-panel').getAttribute('aria-busy')==='false');
  const live=x.store.live(x.w.token);x.ui.combatContext(x.w,live.scene,live.rosterRevision);await until(()=>x.el('combat-panel').getAttribute('aria-busy')==='false');
  x.hold();const handoff=x.ui.prepareWorldGroup({id:'old-group',title:'Alte Besuchsgruppe',revision:1});await until(()=>x.waiting.length===1);
  const adopted=adoptEncounterVisit(x);x.ui.combatContext(x.w,adopted,live.rosterRevision);x.release();await handoff;
  assert.equal(x.writes.length,0);assert.equal(x.store.combat(x.w.token,x.b.sceneId,x.b.id).combat.title,'Keller');
 }finally{x.cleanup();}
});

test('an empty encounter offers the existing creature catalog without creating an empty combat',async()=>{
 const x=await fixture(false);try{let opened=0,current;x.ui.setCombatCatalogNavigation(async lease=>{opened++;current=lease;});
  const button=x.el('combat-catalog-open');assert.equal(button.hidden,false);assert.equal(button.disabled,false);button.click();await until(()=>opened===1);assert.equal(current(),true);assert.equal(x.writes.length,0);assert.equal(x.store.combat(x.w.token,x.store.live(x.w.token).scene.id).combat,null);
  x.ui.combatContext(null,null);assert.equal(current(),false);
 }finally{x.cleanup();}
});
test('a revoked scene cannot open the catalog after its draft flush',async()=>{
 const x=await fixture(false);try{let opened=0;x.ui.setCombatCatalogNavigation(async()=>{opened++;});x.el('combat-catalog-open').click();x.ui.combatContext(null,null);await tick();await tick();assert.equal(opened,0);assert.equal(x.writes.length,0);}finally{x.cleanup();}
});
test('the spontaneous entry cannot append to an already editable encounter',async()=>{
 const x=await fixture();try{let opened=0;x.ui.setCombatCatalogNavigation(async()=>{opened++;});assert.equal(x.el('combat-catalog-open').hidden,true);x.el('combat-catalog-open').click();await tick();assert.equal(opened,0);assert.equal(x.writes.length,0);}finally{x.cleanup();}
});

test('quick picker displays stable combat numbers for otherwise identical titles',async()=>{const x=await fixture({finished:true});try{const c=x.store.combat(x.w.token,x.a.sceneId,x.b.id).combat;x.store.executeCombat({commandId:randomUUID(),token:x.w.token,campaignId:x.w.campaign.id,combatId:c.id,expectedRevision:c.revision,action:{kind:'notes',title:'Torwache',notes:''}});x.el('combat-refresh').onclick();await until(()=>x.el('combat-title').textContent==='Torwache');const options=[...x.el('combat-history').children];assert.equal(options.length,2);assert(options.every(o=>/Torwache · Nr. [0-9]+/.test(o.textContent)));assert.equal(new Set(options.map(o=>o.textContent.match(/Nr. [0-9]+/)[0])).size,2);}finally{x.cleanup();}});


test('the next encounter stays ahead of completed resolution and empty preparation explains the missing roster',async()=>{
 const x=await fixture({empty:true,finished:true});try{
  assert.equal(x.el('combat-start').disabled,true);assert.match(x.el('combat-assessment').textContent,/Füge Teilnehmer/);assert.equal(x.el('combat-add-open').textContent,'Gegner vorbereiten…');assert.equal(x.el('combat-add-open').hidden,false);assert.equal(x.writes.length,0);
  x.choose(x.a.id);await until(()=>x.el('combat-title').textContent==='Torwache');const children=[...x.el('combat-panel').children];assert.ok(children.indexOf(x.el('combat-creation'))<children.indexOf(x.el('combat-resolution')),'next preparation must be reachable before a potentially long result/loot list');assert.equal(x.el('combat-creation').hidden,false);
 }finally{x.cleanup();}
});

test('a party-only preparation cannot start through either start command; rejection preserves initiative and HP',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'combat-readiness-')),{CampaignStore}=require('../.build/combat-switch-store.cjs'),store=new CampaignStore(root+'/workbench.sqlite');try{
  const cam=store.create('Ada am Zollhaus'),w=store.activate(cam.id),cmd=action=>({commandId:randomUUID(),token:w.token,campaignId:cam.id,action});let scene=store.executeLive(cmd({kind:'initialize',expectedRosterRevision:0})).scene;
  const c=store.executeLive(cmd({kind:'create-character',profile:{name:'Ada'}})).character,live=store.live(w.token);
  scene=store.executeLive(cmd({kind:'membership',characterId:c.id,expectedRevision:c.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:scene.id,expectedFocusRevision:live.focusRevision})).scene;
  let combat=store.executeCombat({...cmd({kind:'create',sceneId:scene.id,title:'Hinterhalt',includeParty:true,expectedMembershipRevision:scene.membershipRevision}),combatId:null,expectedRevision:null}).combat;
  assert.equal(combat.participants.length,1);const before=store.db.serialize(),act=action=>store.executeCombat({...cmd(action),combatId:combat.id,expectedRevision:combat.revision});
  assert.throws(()=>act({kind:'start'}),/keine kampffähigen Gegner/);
  assert.throws(()=>act({kind:'initiative',values:[{participantId:combat.participants[0].id,initiative:19}],start:true}),/keine kampffähigen Gegner/);assert.ok(store.db.serialize().equals(before));
  combat=act({kind:'add',name:'Späher',count:1,grouped:false,maxHp:7,armorClass:15,initiativeBonus:2}).combat;combat=act({kind:'start'}).combat;assert.equal(combat.phase,'running');assert.equal(combat.participants.length,2);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

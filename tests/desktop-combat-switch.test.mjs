import {setTimeout as delay} from 'node:timers/promises';
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
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/combat-switch-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
buildSync({stdin:{contents:"export * from './src/app/combat';export {initCommitControls,checkPendingCommit} from './src/app/commit-confirmation';",resolveDir:process.cwd()},outfile:'.build/combat-switch-ui.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const tick=()=>new Promise(r=>setImmediate(r));
// Real WebCrypto work completes on the worker pool, not after a fixed number
// of event-loop turns. Yield until the requested UI state, with a bounded deadline.
async function until(check){const deadline=performance.now()+5000;while(!check()&&performance.now()<deadline)await delay(1);assert(check(),'Expected encounter state');}
async function fixture(options=true){
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
 delete require.cache[require.resolve('../.build/combat-switch-ui.cjs')];const ui=require('../.build/combat-switch-ui.cjs');ui.initCommitControls(()=>w,text=>messages.push(text));ui.initCombat(text=>messages.push(text));ui.combatContext(w,scene);const el=id=>document.getElementById(id);
 await until(()=>el('combat-title').textContent===(withCombats?'Keller':'Begegnung führen')&&!el('combat-notes').disabled);
 const choose=id=>{el('combat-history').value=id;el('combat-history').onchange();},input=(id,text)=>{el(id).value=text;el(id).dispatchEvent(new window.Event('input'));},fighter=async()=>{el('combat-rows').querySelector('button').onclick();await until(()=>!el('combat-participant').hidden&&!el('fighter-hp').disabled);};
 return{store,w,ui,a,b,el,choose,input,fighter,reads,writes,messages,waiting,hold:()=>{hold=true;},fail:()=>{fail=true;},release:()=>waiting.shift()(),cleanup(){ui.combatContext(null,null);Object.assign(globalThis,previous);store.close();rmSync(root,{recursive:true,force:true});}};
}
test('selecting another encounter blocks old writes and preserves its incomplete notes',async t=>{
 // Keep a real worker-pool boundary even on a fast CI host.
 const digest=crypto.subtle.digest.bind(crypto.subtle);t.mock.method(crypto.subtle,'digest',async(...args)=>{await delay(20);return digest(...args);});
 const x=await fixture();try{x.choose(x.a.id);await until(()=>x.el('combat-title').textContent==='Torwache'&&!x.el('combat-notes').disabled);await x.fighter();x.input('combat-edit-title','');x.input('combat-notes','Unfertig\r\n');assert(await x.ui.flushCombat());x.hold();x.choose(x.b.id);await until(()=>x.waiting.length===1);assert.equal(x.el('fighter-damage').disabled,true);x.el('fighter-amount').value='1';x.el('fighter-damage').onclick();await tick();assert.equal(x.writes.length,0);assert.equal(x.store.combat(x.w.token,x.a.sceneId,x.a.id).combat.participants[0].hp,10);
 x.release();await until(()=>x.el('combat-title').textContent==='Keller'&&!x.el('combat-notes').disabled);await x.fighter();x.el('fighter-amount').value='1';x.el('fighter-damage').onclick();await until(()=>x.writes.length===1&&!x.el('fighter-hp').disabled);assert.equal(x.writes[0].combatId,x.b.id);assert.equal(x.store.combat(x.w.token,x.b.sceneId,x.b.id).combat.participants[0].hp,7);
 const d=x.store.combatDraft(x.w.token,x.a.id,'notes',x.a.id);assert.equal(d.values.title,'');assert.equal(d.values.notes,'Unfertig\r\n');
 }finally{x.cleanup();}
});

test('concentration uses a known Constitution save, including proficiency, while unknown values remain explicit',async()=>{
 const x=await fixture();try{
  const source={abilities:{con:12},savingThrows:'INT +9, WIS +6'};
  assert.equal(x.ui.creatureConstitutionSave(source),1);
  assert.equal(x.ui.creatureConstitutionSave({...source,savingThrows:'CON +9, INT +12'}),9);
  assert.equal(x.ui.creatureConstitutionSave({...source,abilities:{con:7},savingThrows:''}),-2);
  assert.equal(x.ui.creatureConstitutionSave({...source,savingThrows:'CON +0'}),0);
  assert.equal(x.ui.creatureConstitutionSave(undefined),null);
  assert.equal(x.ui.creatureConstitutionSave({...source,savingThrows:'CON unknown'}),null);
 }finally{x.cleanup();}
});

test('the concentration shortcut changes only concentration and preserves open value drafts',async()=>{
 const x=await fixture();try{
  await x.fighter();const before=x.store.combat(x.w.token,x.b.sceneId,x.b.id).combat,actor=before.participants[0];
  assert.equal(x.el('fighter-values').hasAttribute('open'),false);await until(()=>!x.el('fighter-concentration-toggle').disabled);x.el('fighter-concentration-toggle').onclick();
  await until(()=>x.el('fighter-concentration-toggle').textContent==='Konzentration beenden'&&!x.el('fighter-concentration-toggle').disabled);
  assert.deepEqual(x.writes.at(-1).action,{kind:'edit',participantId:actor.id,changes:{concentrating:true}});
  const after=x.store.combat(x.w.token,x.b.sceneId,x.b.id).combat;
  assert.deepEqual(after.participants[0],{...actor,concentrating:true});assert.equal(after.turnId,before.turnId);assert.equal(after.round,before.round);
  x.input('fighter-name','Ungespeicherter Name');const count=x.writes.length;
  assert.equal(x.el('fighter-concentration-toggle').disabled,true);x.el('fighter-concentration-toggle').onclick();await tick();assert.equal(x.writes.length,count);
  assert.equal(x.el('fighter-name').value,'Ungespeicherter Name');
  assert.equal(x.store.combat(x.w.token,x.b.sceneId,x.b.id).combat.participants[0].concentrating,true);
 }finally{x.cleanup();}
});

test('pending concentration keeps its known save and manual override through redraws, and cannot be bypassed by its shortcut',async()=>{
 const x=await fixture();try{
  x.el('combat-concentration-effect').scrollIntoView=()=>{};
  let c=x.store.combat(x.w.token,x.b.sceneId,x.b.id).combat;
  c=x.store.executeCombat({commandId:randomUUID(),campaignId:x.w.campaign.id,token:x.w.token,combatId:c.id,expectedRevision:c.revision,action:{kind:'add-creature',creatureId:'archmage',count:1,grouped:false}}).combat;
  const actor=c.participants.find(p=>p.sourceId==='archmage');x.el('combat-refresh').onclick();await until(()=>x.el('combat-rows').textContent.includes(actor.name)&&x.el('combat-panel').getAttribute('aria-busy')==='false');
  x.el('combat-rows').querySelector('[data-participant-id="'+actor.id+'"] button').onclick();await until(()=>x.el('combat-selected-name').textContent===actor.name&&!x.el('fighter-concentration-toggle').disabled);
  x.el('fighter-concentration-toggle').onclick();await until(()=>x.el('fighter-concentration-toggle').textContent==='Konzentration beenden'&&!x.el('fighter-damage').disabled);
  x.el('fighter-amount').value='32';x.el('fighter-damage').onclick();await until(()=>!x.el('combat-concentration-effect').hidden&&!x.el('combat-concentration-roll').disabled);
  assert.match(x.el('combat-concentration-result').textContent,/SG 16.*CON \+1 laut Statblock/);assert.equal(x.el('combat-concentration-modifier').value,'1');
  const count=x.writes.length;assert.equal(x.el('fighter-concentration-toggle').disabled,true);x.el('fighter-concentration-toggle').onclick();await tick();assert.equal(x.writes.length,count);
  x.el('combat-concentration-modifier').value='4';x.el('combat-refresh').onclick();await until(()=>x.el('combat-panel').getAttribute('aria-busy')==='false');assert.equal(x.el('combat-concentration-modifier').value,'4');
  x.el('combat-concentration-roll').onclick();await until(()=>x.writes.some(c=>c.action.kind==='concentration-roll'));
  assert.deepEqual(x.writes.at(-1).action,{kind:'concentration-roll',participantId:actor.id,modifier:4});
  await until(()=>!x.el('fighter-damage').disabled);
 }finally{x.cleanup();}
});
for(const [queued,recovery] of [[false,false],[true,false],[true,true]])test(`identical concentration hits start with their own modifier (${queued?'queued':'sequential'}${recovery?' recovered':''})`,async()=>{
 const x=await fixture();try{
  x.el('combat-concentration-effect').scrollIntoView=()=>{};
  let c=x.store.combat(x.w.token,x.b.sceneId,x.b.id).combat;
  const act=action=>c=x.store.executeCombat({commandId:randomUUID(),campaignId:x.w.campaign.id,token:x.w.token,combatId:c.id,expectedRevision:c.revision,action}).combat;
  act({kind:'add-creature',creatureId:'archmage',count:1,grouped:false});const actor=c.participants.find(p=>p.sourceId==='archmage');
  act({kind:'edit',participantId:actor.id,changes:{concentrating:true}});act({kind:'damage',participantId:actor.id,amount:7});if(queued)act({kind:'damage',participantId:actor.id,amount:7});
  x.el('combat-refresh').onclick();await until(()=>!x.el('combat-concentration-effect').hidden&&!x.el('combat-concentration-pass').disabled);
  assert.equal(x.el('combat-concentration-modifier').value,'1');x.el('combat-concentration-modifier').value='4';
  x.el('combat-refresh').onclick();await until(()=>x.el('combat-panel').getAttribute('aria-busy')==='false');assert.equal(x.el('combat-concentration-modifier').value,'4');
  if(!recovery){
   x.el('combat-concentration-modifier').value='1.5';x.el('combat-concentration-roll').onclick();
   await until(()=>x.messages.some(m=>m.includes('ganze Zahl'))&&!x.el('combat-concentration-roll').disabled);
   assert.equal(x.el('combat-concentration-modifier').value,'1.5','A rejected check must retain its unfinished correction');x.el('combat-concentration-modifier').value='4';
  }
  let statusAvailable=false;
  if(recovery){
   const send=window.campaign.executeCombat;
   window.campaign.executeCombat=async command=>{await send(command);return{ok:false,error:'Lost check reply'};};
   window.campaign.commitStatus=async(...args)=>statusAvailable?{ok:true,value:x.store.commitStatus(...args)}:{ok:true,value:{outcome:'pending'}};
  }
  x.el('combat-concentration-pass').onclick();
  if(recovery){await until(()=>x.messages.some(m=>m.includes('Buchungsantwort fehlt')));assert.equal(x.el('combat-concentration-modifier').value,'4');statusAvailable=true;await x.ui.checkPendingCommit();assert.equal(x.writes.filter(c=>c.action.kind==='concentration').length,1);}
  await until(()=>!x.el('combat-refresh').disabled);
  if(!queued){await until(()=>x.el('combat-concentration-effect').hidden);c=x.store.combat(x.w.token,x.b.sceneId,x.b.id).combat;act({kind:'damage',participantId:actor.id,amount:7});x.el('combat-refresh').onclick();}
  await until(()=>!x.el('combat-concentration-effect').hidden&&!x.el('combat-concentration-roll').disabled);
  assert.equal(x.el('combat-concentration-modifier').value,'1','A completed check must not lend its override to an identical next hit');
  assert.match(x.el('combat-concentration-result').textContent,/SG 10.*7 Schaden/);
  if(queued&&!recovery){
   x.el('combat-concentration-modifier').value='5';x.el('combat-undo').onclick();
   await until(()=>!x.el('combat-refresh').disabled&&x.store.combat(x.w.token,x.b.sceneId,x.b.id).combat.participants.find(p=>p.id===actor.id).concentrationChecks?.length===2);
   assert.equal(x.el('combat-concentration-modifier').value,'1','Undo restores a check, not the correction entered for its successor');
  }
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


test('history search remains available after a selected combat cannot be read',async()=>{
 const x=await fixture(),prototypes=[[window.HTMLSelectElement.prototype,'value'],[window.HTMLElement.prototype,'showModal'],[window.HTMLElement.prototype,'close']].map(([proto,key])=>({proto,key,descriptor:Object.getOwnPropertyDescriptor(proto,key)}));
 try{
  x.fail();x.choose(x.a.id);await until(()=>x.el('combat-load-status').getAttribute('role')==='alert');let reads=0;
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.__qaValue??this.options[0]?.value??'';},set(v){this.__qaValue=v;}});
  window.HTMLElement.prototype.showModal=function(){this.setAttribute('open','');};
  window.HTMLElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new window.Event('close'));};
  window.campaign.maskHistory=async(_token,sceneId,query)=>{reads++;return{ok:true,value:{campaignId:x.w.campaign.id,sceneId,query,items:[],total:0,next:null}};};
  assert.equal(x.el('combat-history-open').disabled,false);x.el('combat-history-open').onclick();await tick();await tick();assert.equal(reads,1);
 }finally{for(const {proto,key,descriptor} of prototypes){if(descriptor)Object.defineProperty(proto,key,descriptor);else delete proto[key];}x.cleanup();}
});

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

test('an empty encounter opens an in-place catalog picker without creating a mask and revokes it with the scene',async()=>{
 const x=await fixture(false);try{
  await until(()=>x.el('combat-panel').getAttribute('aria-busy')==='false');
  const button=x.el('combat-catalog-open'),dialog=x.el('combat-add-dialog');assert.equal(button.hidden,false);assert.equal(button.disabled,false);
  button.onclick();assert.equal(dialog.hasAttribute('open'),true);assert.equal(x.el('combat-creature-search-form').hidden,false);assert.equal(x.writes.length,0);
  assert.equal(x.store.combat(x.w.token,x.store.live(x.w.token).scene.id).combat,null);
  x.ui.combatContext(null,null);assert.equal(dialog.hasAttribute('open'),false);button.click();assert.equal(dialog.hasAttribute('open'),false);assert.equal(x.writes.length,0);
 }finally{x.cleanup();}
});
test('the new encounter entry does not open over an editable encounter',async()=>{
 const x=await fixture();try{assert.equal(x.el('combat-catalog-open').hidden,true);x.el('combat-catalog-open').click();assert.equal(x.el('combat-add-dialog').hasAttribute('open'),false);assert.equal(x.writes.length,0);}finally{x.cleanup();}
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


for(const recovery of [false,true,'missing-context'])test('area results expose current members using the retained target context (recovery='+recovery+')',async()=>{
 const x=await fixture();try{
  let c=x.store.combat(x.w.token,x.b.sceneId,x.b.id).combat;
  const act=action=>c=x.store.executeCombat({commandId:randomUUID(),token:x.w.token,campaignId:x.w.campaign.id,combatId:c.id,expectedRevision:c.revision,action}).combat;
  act({kind:'add-creature',creatureId:'ogre',count:4,grouped:true,initiative:12});
  act({kind:'add-creature',creatureId:'goblin',count:3,grouped:true,initiative:8});act({kind:'start'});
  x.el('combat-refresh').onclick();await until(()=>x.el('combat-rows').textContent.includes('Ogre'));
  assert.equal(x.el('combat-rows').querySelectorAll('tr[data-participant-id]').length,1);
  const type=x.el('combat-area-type'),selection=x.el('combat-area-selection');for(const control of [type,selection])Object.defineProperty(control,'value',{value:'',writable:true});
  x.el('combat-area-open').onclick();x.el('combat-area-amount').value='21';
  for(const select of x.el('combat-area-targets').querySelectorAll('select'))Object.defineProperty(select,'value',{value:select.dataset.role==='save'?'full':'auto',writable:true});
  type.value='fire';type.onchange();
  const ogres=c.participants.filter(p=>p.sourceId==='ogre'),targets=ogres.slice(0,3);
  selection.value='group:'+ogres[0].groupId;selection.onchange();assert.equal([...x.el('combat-area-targets').querySelectorAll('input')].filter(input=>input.checked).length,4);const excluded=x.el('combat-area-targets').querySelector('input[value="'+ogres[3].id+'"]');excluded.checked=false;excluded.onchange();
  for(const [i,p]of targets.entries()){
   const check=x.el('combat-area-targets').querySelector('input[value="'+p.id+'"]');check.checked=true;
   const save=check.closest('.combat-area-row').querySelector('[data-role=save]'),defense=check.closest('.combat-area-row').querySelector('[data-role=defense]');
   Object.defineProperty(save,'value',{value:i?'half':'full',writable:true});Object.defineProperty(defense,'value',{value:'auto',writable:true});check.onchange();
  }
  let statusAvailable=false;
  if(recovery){
   window.campaign.executeCombat=async command=>{x.writes.push(command);x.store.executeCombat(command);return{ok:false,error:'Lost reply'};};
   window.campaign.commitStatus=async(...args)=>statusAvailable?{ok:true,value:x.store.commitStatus(...args)}:{ok:true,value:{outcome:'pending'}};
  }
  x.el('combat-area-apply').onclick();
  if(recovery){
   await until(()=>x.messages.some(m=>m.includes('Buchungsantwort fehlt'))&&!x.el('combat-area-cancel').disabled);x.el('combat-area-cancel').onclick();
   c=x.store.combat(x.w.token,c.sceneId,c.id).combat;act({kind:'damage',participantId:targets[0].id,amount:1});
   statusAvailable=true;if(recovery==='missing-context'){x.ui.initCommitControls(()=>null,text=>x.messages.push(text));x.ui.initCommitControls(()=>x.w,text=>x.messages.push(text));}await x.ui.checkPendingCommit();
   assert.match(x.messages.at(-1),/Buchung anhand ihres Belegs bestätigt/);
  }else{await until(()=>x.writes.length===1&&!x.el('combat-undo').disabled);assert.match(x.messages.at(-1),/Flächenschaden gespeichert.*Ogre A 38\/59 HP.*Ogre B 49\/59 HP.*Ogre C 49\/59 HP/);}
  assert.equal(x.writes.length,1,'status recovery cannot repeat the damage');
  assert.equal(x.el('combat-rows').querySelectorAll('tr[data-participant-id]').length,recovery==='missing-context'?8:5);
  const toggles=[...x.el('combat-rows').querySelectorAll('.combat-mob-toggle')];
  assert.equal(toggles.find(b=>b.getAttribute('aria-label').startsWith('Ogre')).getAttribute('aria-expanded'),'true');
  assert.equal(toggles.find(b=>b.getAttribute('aria-label').startsWith('Goblin')).getAttribute('aria-expanded'),recovery==='missing-context'?'true':'false');
  const result=x.store.combat(x.w.token,c.sceneId,c.id).combat;assert.equal(result.turnId,c.turnId);assert.equal(result.round,c.round);
  assert.deepEqual(result.participants.filter(p=>p.sourceId==='ogre').map(p=>p.hp),[recovery?37:38,49,49,59]);assert.match(x.el('combat-rows').textContent,new RegExp((recovery?37:38)+' / 59'));assert(result.participants.filter(p=>p.sourceId==='goblin').every(p=>p.hp===7));
 }finally{x.cleanup();}
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {buildSync} from 'esbuild';
import {parseHTML} from 'linkedom';

mkdirSync('.build/reinforcement/catalog',{recursive:true});
copyFileSync('src/features/catalog/data/srd-5.1.generated.json','.build/reinforcement/catalog/srd-5.1.generated.json');
buildSync({stdin:{contents:"export {CampaignStore} from './src/app/storage/store';export {searchCreatures} from './src/app/storage/encounters';export {rolledMonsterInitiatives,initiativeNumber} from './src/app/combat-initiative';",resolveDir:process.cwd()},outfile:'.build/reinforcement/store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
buildSync({entryPoints:['src/app/combat.ts'],outfile:'.build/reinforcement/ui.cjs',bundle:true,platform:'node',format:'cjs'});
const require=createRequire(import.meta.url),{CampaignStore,searchCreatures,rolledMonsterInitiatives,initiativeNumber}=require('../.build/reinforcement/store.cjs');
const tick=()=>new Promise(r=>setImmediate(r));
async function until(check){const deadline=Date.now()+5000;while(!check()&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));assert.ok(check(),'Expected reinforcement state');}
function fixture(t){
 const root=mkdtempSync(tmpdir()+'/reinforcement-'),file=root+'/campaign.sqlite',x={root,file,store:new CampaignStore(file)};
 x.campaign=x.store.create('Goblin-Hinterhalt');x.w=x.store.activate(x.campaign.id);
 x.command=action=>({commandId:randomUUID(),campaignId:x.campaign.id,token:x.w.token,action});
 x.scene=x.store.executeLive(x.command({kind:'initialize',expectedRosterRevision:0})).scene;
 x.creature=searchCreatures({text:'Goblin',offset:0,limit:25,sort:'name',direction:'asc'}).rows.find(c=>c.name==='Goblin');
 x.combat=x.store.executeCombat({...x.command({kind:'create',sceneId:x.scene.id,title:'Hinterhalt',includeParty:false,expectedMembershipRevision:x.scene.membershipRevision}),combatId:null,expectedRevision:null}).combat;
 x.execute=action=>{x.combat=x.store.executeCombat({...x.command(action),combatId:action.kind==='create'?null:x.combat.id,expectedRevision:action.kind==='create'?null:x.combat.revision}).combat;return x.combat;};
 x.execute({kind:'add-creature',creatureId:x.creature.id,count:3,grouped:true,initiative:9});x.group=x.combat.participants[0].groupId;
 x.execute({kind:'start'});
 t.after(()=>{x.store.close();rmSync(root,{recursive:true,force:true});});return x;
}
test('catalog reinforcement preserves source, XP, grouped initiative and current turn through retry, undo and reopen',t=>{
 const x=fixture(t),before=structuredClone(x.combat),command={...x.command({kind:'add-creature',creatureId:x.creature.id,count:1,grouped:true,groupId:x.group}),combatId:x.combat.id,expectedRevision:x.combat.revision};
 const accepted=x.store.executeCombat(command);x.combat=accepted.combat;
 assert.equal(x.combat.participants.length,4);assert.equal(accepted.assessment.baseXp,200);assert.equal(accepted.assessment.missingXp,0);
 const actor=x.combat.participants.at(-1);assert.equal(actor.name,'Goblin D');assert.equal(actor.xp,50);assert.equal(actor.hp,7);assert.equal(actor.sourceId,x.creature.id);assert.equal(actor.initiative,9);assert.equal(actor.groupId,x.group);
 assert.equal(x.combat.turnId,before.turnId);assert.equal(x.combat.round,before.round);
 assert.deepEqual(x.store.executeCombat(command),accepted);assert.equal(x.store.combat(x.w.token,x.scene.id,x.combat.id).combat.participants.length,4);
 const id=x.combat.id;x.store.close();x.store=new CampaignStore(x.file);x.w=x.store.activate(x.campaign.id);x.combat=x.store.combat(x.w.token,x.scene.id,id).combat;
 assert.equal(x.combat.participants.at(-1).sourceId,x.creature.id);assert.equal(x.combat.participants.at(-1).initiative,9);
 x.execute({kind:'undo'});assert.deepEqual(x.combat.participants,before.participants);assert.equal(x.combat.turnId,before.turnId);
});
test('an independent reinforcement adopts explicit initiative atomically without changing its peers',t=>{
 const x=fixture(t),before=structuredClone(x.combat);x.execute({kind:'add-creature',creatureId:x.creature.id,count:2,grouped:true,initiative:15});
 const added=x.combat.participants.slice(3);assert.equal(added.length,2);assert.equal(added[0].initiative,15);assert.equal(added[1].initiative,15);assert.equal(added[0].groupId,added[1].groupId);assert.notEqual(added[0].groupId,x.group);
 assert.deepEqual(x.combat.participants.slice(0,3),before.participants);assert.equal(x.combat.turnId,before.turnId);assert.equal(x.combat.round,before.round);
});
test('invalid or conflicting initiative rejects the whole reinforcement and leaves receipts unchanged',t=>{
 const x=fixture(t),before=x.store.db.serialize();
 for(const fields of [{initiative:1.5},{initiative:NaN},{initiative:1000001},{groupId:x.group,initiative:10}]){
  assert.throws(()=>x.execute({kind:'add-creature',creatureId:x.creature.id,count:1,grouped:true,...fields}),/Initiative/);
  assert.ok(x.store.db.serialize().equals(before));
 }
});

async function uiFixture(t){
 const x=fixture(t),old={window:globalThis.window,document:globalThis.document},{window,document}=parseHTML(readFileSync('src/app/index.html','utf8'));
 Object.assign(globalThis,{window,document});window.HTMLInputElement.prototype.select=()=>{};for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{configurable:true,writable:true,value:''});
 const saved=new Map();window.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
 const reply=fn=>{try{return{ok:true,value:fn()};}catch(error){return{ok:false,error:error.message};}};
 const writes=[],queries=[],messages=[];window.campaign={};
 for(const key of ['combat','combatDraft','combatDrafts','keepCombatDraft','discardCombatDraft','commitStatus'])window.campaign[key]=async(...args)=>reply(()=>x.store[key](...args));
 window.campaign.executeCombat=async command=>{writes.push(command);return reply(()=>x.store.executeCombat(command));};
 window.campaign.creatures=q=>new Promise((resolve,reject)=>queries.push({q,resolve,reject}));
 delete require.cache[require.resolve('../.build/reinforcement/ui.cjs')];const ui=require('../.build/reinforcement/ui.cjs');ui.initCombat((...args)=>messages.push(args));ui.combatContext(x.w,x.scene);
 const el=id=>document.getElementById(id);await until(()=>el('combat-title').textContent==='Hinterhalt'&&!el('combat-next').disabled);
 t.after(async()=>{ui.combatContext(null,null);await tick();Object.assign(globalThis,old);});return{...x,ui,el,writes,queries,messages};
}
test('runner offers the existing group directly and commits a single source-backed reinforcement',async t=>{
 const x=await uiFixture(t);assert.match(x.el('combat-creature-select').textContent,/Goblin.*vorhandene Initiative 9/);
 x.el('combat-creature-select').value='group:'+x.group;x.el('combat-creature-select').onchange();assert.equal(x.el('combat-creature-initiative').disabled,true);
 x.el('combat-creature-count').value='1';x.el('combat-creature-form').onsubmit({preventDefault(){}});
 await until(()=>x.writes.length===1&&!x.el('combat-creature-add').disabled);
 assert.equal(x.writes[0].action.kind,'add-creature');assert.equal(x.writes[0].action.groupId,x.group);assert.equal(x.writes[0].action.initiative,undefined);
 assert.equal(x.store.combat(x.w.token,x.scene.id,x.combat.id).combat.participants.length,4);
});
test('late catalog results cannot populate another encounter or enable a fabricated choice',async t=>{
 const x=await uiFixture(t);x.el('combat-creature-search').value='Dragon';x.el('combat-creature-search-form').onsubmit({preventDefault(){}});await until(()=>x.queries.length===1);
 const other=x.execute({kind:'create',sceneId:x.scene.id,title:'Andere Begegnung',includeParty:false,expectedMembershipRevision:x.scene.membershipRevision});await x.ui.openExistingCombat(other.id);
 x.queries[0].resolve({ok:true,value:{rows:[{id:'stale',name:'Stale Dragon',challengeRating:'9'}],total:1}});await tick();await tick();
 assert.doesNotMatch(x.el('combat-creature-select').textContent,/Stale/);assert.equal(x.el('combat-creature-add').disabled,true);
 x.el('combat-creature-search-form').onsubmit({preventDefault(){}});await until(()=>x.queries.length===2);x.queries[1].reject(new Error('Offline'));await until(()=>x.el('combat-creature-status').textContent.includes('Offline'));
 assert.equal(x.el('combat-creature-add').disabled,true);assert.equal(x.writes.length,0);
});
test('a failed search leaves known statblocks usable and a new search can recover',async t=>{
 const x=await uiFixture(t);x.el('combat-creature-search').value='Dragon';x.el('combat-creature-search-form').onsubmit({preventDefault(){}});await until(()=>x.queries.length===1);
 x.queries[0].reject(new Error('Offline'));await until(()=>x.el('combat-creature-status').textContent.includes('Offline'));
 assert.match(x.el('combat-creature-select').textContent,/Goblin/);assert.equal(x.el('combat-creature-add').disabled,false);assert.equal(x.writes.length,0);
 x.el('combat-creature-search-form').onsubmit({preventDefault(){}});await until(()=>x.queries.length===2);
 x.queries[1].resolve({ok:true,value:{rows:[{id:'dragon',name:'Dragon',challengeRating:'9'}],total:1}});await until(()=>x.el('combat-creature-select').textContent.includes('Dragon'));
 assert.equal(x.el('combat-creature-add').disabled,false);assert.match(x.el('combat-creature-select').textContent,/Goblin/);
});

test('condition shortcuts wait for the selected working draft and stay blocked on a read failure',async t=>{
 const x=await uiFixture(t);let resolve;window.campaign.combatDraft=()=>new Promise(r=>{resolve=r;});
 x.el('combat-table').querySelector('tbody button').onclick();await until(()=>!!resolve);
 const buttons=()=>[...x.el('fighter-condition-shortcuts').querySelectorAll('button')];
 assert.ok(buttons().length);assert.ok(buttons().every(b=>b.disabled));
 x.el('combat-participant-form').onsubmit({preventDefault(){}});assert.equal(x.writes.length,0);
 resolve({ok:false,error:'Working draft unavailable'});await tick();await tick();
 assert.ok(buttons().every(b=>b.disabled));x.el('combat-participant-form').onsubmit({preventDefault(){}});assert.equal(x.writes.length,0);
});

test('condition shortcuts cannot adopt unrelated raw values and resume after explicit discard or adoption',async t=>{
 const x=await uiFixture(t),oldEvent=globalThis.Event;globalThis.Event=window.Event;t.after(()=>{globalThis.Event=oldEvent;});
 const actor=x.combat.participants[0],form=x.el('combat-participant-form');form.requestSubmit=()=>form.onsubmit({preventDefault(){}});
 x.el('combat-rows').querySelector('button').onclick();await until(()=>!x.el('fighter-hp').disabled);
 const buttons=()=>[...x.el('fighter-condition-shortcuts').querySelectorAll('button')];
 const input=(id,raw)=>{x.el(id).value=raw;x.el(id).dispatchEvent(new window.Event('input',{bubbles:true}));};
 input('fighter-hp','1');input('fighter-initiative','14');
 assert.ok(buttons().every(b=>b.disabled));assert.equal(x.el('fighter-condition-draft-hint').hidden,false);assert.equal(x.writes.length,0);
 assert.equal(x.store.combat(x.w.token,x.scene.id,x.combat.id).combat.participants[0].hp,7);
 const draft=x.store.combatDraft(x.w.token,x.combat.id,'fighter',actor.id);await until(()=>x.store.combatDraft(x.w.token,x.combat.id,'fighter',actor.id)?.values['fighter-initiative']==='14');
 assert.equal(draft.values['fighter-hp'],'1');
 x.el('fighter-reload').onclick();await until(()=>x.el('fighter-hp').value==='7'&&buttons().every(b=>!b.disabled));
 assert.equal(x.el('fighter-condition-draft-hint').hidden,true);
 buttons().find(b=>b.textContent==='Liegend').onclick();await until(()=>x.writes.length===1&&x.el('fighter-draft-status').textContent==='');
 let saved=x.store.combat(x.w.token,x.scene.id,x.combat.id).combat;assert.equal(saved.participants[0].conditions,'Liegend');assert.equal(saved.participants[0].hp,7);assert.equal(saved.participants[0].initiative,9);
 x.el('combat-undo').onclick();await until(()=>x.writes.length===2&&!x.el('combat-undo').disabled);assert.equal(x.el('fighter-conditions').value,'');
 input('fighter-initiative','-');assert.ok(buttons().every(b=>b.disabled));assert.equal(x.writes.length,2);
 input('fighter-initiative','14');form.requestSubmit();await until(()=>x.writes.length===3&&x.el('fighter-draft-status').textContent==='');
 assert.ok(buttons().every(b=>!b.disabled));assert.equal(x.store.combat(x.w.token,x.scene.id,x.combat.id).combat.participants[0].initiative,14);
});


test('HP cells reuse the target editor and Enter applies one damage command to that individual',async t=>{
 const x=await uiFixture(t),target=x.combat.participants[1],amount=x.el('fighter-amount');let focused=false;
 const scrolls=[];amount.scrollIntoView=options=>scrolls.push(options.block);amount.focus=()=>{focused=true;};amount.select=()=>{};amount.reportValidity=()=>Number(amount.value)>0;
 const cells=[...x.el('combat-rows').querySelectorAll('.combat-health')];
 assert.equal(cells.length,3);assert.match(cells[1].getAttribute('aria-label'),/Goblin B.*7 \/ 7/);
 cells[1].onclick();await until(()=>focused);assert.equal(x.writes.length,0);
 assert.equal(x.el('combat-selected-name').textContent,target.name);assert.deepEqual(scrolls,['center']);
 amount.value='3';
 const enter=(repeat=false)=>{const e=new window.Event('keydown',{cancelable:true});e.key='Enter';e.repeat=repeat;amount.dispatchEvent(e);};
 enter();enter();await until(()=>x.writes.length===1&&!x.el('fighter-damage').disabled);
 assert.deepEqual(x.writes[0].action,{kind:'damage',participantId:target.id,amount:3});
 enter(true);await tick();assert.equal(x.writes.length,1);
 let actual=x.store.combat(x.w.token,x.scene.id,x.combat.id).combat;assert.deepEqual(actual.participants.map(p=>p.hp),[7,4,7]);
 x.el('combat-undo').onclick();await until(()=>x.writes.length===2&&!x.el('fighter-damage').disabled);
 actual=x.store.combat(x.w.token,x.scene.id,x.combat.id).combat;assert.deepEqual(actual.participants.map(p=>p.hp),[7,7,7]);
 amount.value='0';enter();await tick();assert.equal(x.writes.length,2);
});

test('an HP lookup that completes after a target switch cannot steal the new editor focus',async t=>{
 const x=await uiFixture(t),amount=x.el('fighter-amount'),replies=[];let focused=0;
 let scrolled=0;amount.scrollIntoView=()=>scrolled++;amount.focus=()=>focused++;amount.select=()=>{};
 window.campaign.combatDraft=()=>new Promise(resolve=>replies.push(resolve));
 const cells=[...x.el('combat-rows').querySelectorAll('.combat-health')];cells[0].onclick();await until(()=>replies.length===1);cells[1].onclick();await until(()=>replies.length===2);
 replies[1]({ok:true,value:null});await until(()=>focused===1);replies[0]({ok:true,value:null});await tick();await tick();
 assert.equal(focused,1);assert.equal(scrolled,1);assert.equal(x.el('combat-selected-name').textContent,x.combat.participants[1].name);assert.equal(x.writes.length,0);
});

test('initiative cells open one field per group and never submit the fighter HP draft',async t=>{
 const x=await uiFixture(t),target=x.combat.participants[1];x.el('combat-rows').querySelector('button').onclick();await until(()=>!x.el('fighter-name').disabled);x.el('fighter-hp').value='2';x.el('fighter-hp').dispatchEvent(new window.Event('input'));await tick();await tick();
 const cells=[...x.el('combat-rows').querySelectorAll('.combat-initiative')];assert.equal(cells.length,3);cells[1].onclick();await until(()=>x.el('combat-initiative-dialog').querySelectorAll('input[data-participant-id]').length===1);
 const input=x.el('combat-initiative-dialog').querySelector('input[data-participant-id]');assert.equal(input.dataset.participantId,x.combat.participants[0].id);input.value='17';input.dispatchEvent(new window.Event('input'));x.el('initiative-form').onsubmit({preventDefault(){}});await until(()=>x.writes.length===1&&!x.el('combat-initiative-dialog').hasAttribute('open'));
 const saved=x.store.combat(x.w.token,x.scene.id,x.combat.id).combat;assert.equal(x.writes[0].action.kind,'initiative');assert.ok(saved.participants.every(p=>p.initiative===17));assert.deepEqual(saved.participants.map(p=>p.hp),[7,7,7]);assert.equal(saved.turnId,x.combat.turnId);
 const f=x.store.combatDraft(x.w.token,x.combat.id,'fighter',x.combat.participants[0].id);assert.equal(f.values['fighter-hp'],'2');assert.equal(x.store.combatDraft(x.w.token,x.combat.id,'initiative',x.combat.id),null);
});


test('two named template troops remain distinct through reinforcement, undo, reopen and campaign transfer',async t=>{
 const x=fixture(t),plan=x.store.saveEncounterPlan({...x.command(null),expectedRevision:null,plan:{id:randomUUID(),revision:0,name:'Zwei Trupps',notes:'',party:[],entries:[{id:'archers',creatureId:x.creature.id,count:3,grouped:true,groupName:'Schützen'},{id:'melee',creatureId:x.creature.id,count:3,grouped:true,groupName:'Nahkämpfer'}],sources:[],catalogHash:''}});
 x.execute({kind:'create',sceneId:x.scene.id,title:plan.name,includeParty:false,expectedMembershipRevision:x.scene.membershipRevision,planId:plan.id,expectedPlanRevision:plan.revision});
 const archer=x.combat.participants.find(p=>p.groupName==='Schützen'),melee=x.combat.participants.find(p=>p.groupName==='Nahkämpfer');assert.notEqual(archer.groupId,melee.groupId);
 x.execute({kind:'edit',participantId:archer.id,changes:{initiative:14}});x.execute({kind:'edit',participantId:melee.id,changes:{initiative:9}});x.execute({kind:'start'});
 const wounded=x.combat.participants[1];x.execute({kind:'damage',participantId:wounded.id,amount:5});const before=structuredClone(x.combat);
 x.execute({kind:'add-creature',creatureId:x.creature.id,count:2,grouped:true,groupId:archer.groupId});
 const archers=x.combat.participants.filter(p=>p.groupId===archer.groupId);assert.equal(archers.length,5);assert(archers.every(p=>p.groupName==='Schützen'&&p.initiative===14&&p.armorClass===15&&p.xp===50));assert.equal(archers.find(p=>p.id===wounded.id).hp,2);assert.equal(x.combat.turnId,before.turnId);assert(x.combat.sources[0].actions.length);
 assert.equal(x.combat.participants.filter(p=>p.groupId===melee.groupId&&p.groupName==='Nahkämpfer'&&p.initiative===9&&p.hp===7).length,3);
 const id=x.combat.id;x.store.close();x.store=new CampaignStore(x.file);x.w=x.store.activate(x.campaign.id);x.combat=x.store.combat(x.w.token,x.scene.id,id).combat;assert.equal(x.combat.participants.filter(p=>p.groupName==='Schützen').length,5);
 const snapshot=x.root+'/troops.sqlite';await x.store.campaignSnapshot(x.w.token,snapshot);const target=new CampaignStore(x.root+'/target.sqlite');try{const copy=target.acceptCampaignSnapshot(snapshot,'Truppkopie',{}),w=target.activate(copy.id),row=target.db.prepare("SELECT id,scene_id FROM combat WHERE campaign_id=? AND json_extract(payload,'$.title')=?").get(copy.id,plan.name),copied=target.combat(w.token,row.scene_id,row.id).combat;assert.equal(copied.participants.filter(p=>p.groupName==='Schützen').length,5);assert.equal(copied.participants.find(p=>p.hp===2).groupName,'Schützen');await target.backup(x.root+'/copy-safe.sqlite');}finally{target.close();}
 x.execute({kind:'undo'});assert.deepEqual(x.combat.participants,before.participants);assert.equal(x.combat.turnId,before.turnId);
});
test('troop rename changes all peers atomically, preserves individual aliases and rejects invalid labels',t=>{
 const x=fixture(t);x.execute({kind:'add-creature',creatureId:x.creature.id,count:2,grouped:true,initiative:4});const before=structuredClone(x.combat),actor=x.combat.participants[0];
 x.execute({kind:'edit',participantId:actor.id,changes:{groupName:'  Schützen  '}});assert(x.combat.participants.filter(p=>p.groupId===x.group).every(p=>p.groupName==='Schützen'));assert(x.combat.participants.filter(p=>p.groupId!==x.group).every(p=>p.groupName===undefined));assert.deepEqual(x.combat.participants.map(p=>p.name),before.participants.map(p=>p.name));
 const bytes=x.store.db.serialize();for(const name of [123,'x'.repeat(121),null]){assert.throws(()=>x.execute({kind:'edit',participantId:actor.id,changes:{groupName:name}}),/Truppname/);assert(x.store.db.serialize().equals(bytes));}
 x.execute({kind:'undo'});assert.deepEqual(x.combat.participants,before.participants);
});
test('runner saves one troop name for the selected group and offers it directly for reinforcement',async t=>{
 const x=await uiFixture(t);x.el('combat-rows').querySelector('button').onclick();await until(()=>!x.el('fighter-name').disabled);
 x.el('fighter-group-name').value='Schützen';x.el('fighter-group-name').dispatchEvent(new window.Event('input'));await tick();await tick();x.el('combat-participant-form').onsubmit({preventDefault(){}});await until(()=>x.writes.length===1&&!x.el('combat-undo').disabled);
 assert.equal(x.writes[0].action.changes.groupName,'Schützen');assert.match(x.el('combat-creature-select').textContent,/Schützen · Goblin · vorhandene Initiative 9/);assert.equal([...x.el('combat-rows').querySelectorAll('small')].filter(e=>e.textContent==='Schützen').length,3);
});


test('initiative raw input survives close, a failed save and reopening without a combat write',async t=>{
 const x=await uiFixture(t);x.el('combat-initiative-open').onclick();await until(()=>x.el('initiative-rows').querySelector('input')&&!x.el('initiative-save').disabled);
 const input=x.el('initiative-rows').querySelector('input');input.value=' +17 ';input.dispatchEvent(new window.Event('input'));
 x.el('initiative-close').onclick();await until(()=>!x.el('combat-initiative-dialog').hasAttribute('open'));
 assert.equal(x.store.combatDraft(x.w.token,x.combat.id,'initiative',x.combat.id).values[0].raw,' +17 ');
 x.el('combat-initiative-open').onclick();await until(()=>x.el('initiative-rows').querySelector('input')&&!x.el('initiative-save').disabled);assert.equal(x.el('initiative-rows').querySelector('input').value,' +17 ');
 window.campaign.executeCombat=async()=>({ok:false,error:'Controlled save rejection'});x.el('initiative-form').onsubmit({preventDefault(){}});await until(()=>x.el('initiative-status').textContent.includes('nicht übernommen'));
 assert.equal(x.el('initiative-save').disabled,false);assert.equal(x.el('initiative-rows').querySelector('input').value,' +17 ');assert.ok(x.store.combat(x.w.token,x.scene.id,x.combat.id).combat.participants.every(p=>p.initiative===9));
});
test('late initiative lookup cannot reopen a different encounter',async t=>{
 const x=await uiFixture(t);let resolve;const original=window.campaign.combatDraft;window.campaign.combatDraft=(...args)=>args[2]==='initiative'?new Promise(r=>{resolve=r;}):original(...args);x.el('combat-initiative-open').onclick();await until(()=>!!resolve);
 const other=x.execute({kind:'create',sceneId:x.scene.id,title:'Andere Begegnung',includeParty:false,expectedMembershipRevision:x.scene.membershipRevision});await x.ui.openExistingCombat(other.id);resolve({ok:true,value:null});await tick();await tick();assert.equal(x.el('combat-initiative-dialog').hasAttribute('open'),false);assert.equal(x.el('initiative-rows').querySelectorAll('input').length,0);assert.equal(x.writes.length,0);
});


test('initiative previews roll once per troop with its bonus and never roll player entries',t=>{
 const x=fixture(t),hero={...x.combat.participants[0],id:'hero',groupId:'hero-group',characterId:'hero-character',initiative:18,initiativeBonus:99},c={...x.combat,participants:[hero,...x.combat.participants]};
 for(const [mode,expected,calls] of [['normal',5,1],['advantage',19,2],['disadvantage',5,2]]){let i=0;const result=rolledMonsterInitiatives(c,mode,()=>[3,17][i++]);assert.equal(i,calls);assert.deepEqual(result,[{participantId:x.combat.participants[0].id,initiative:expected}]);assert.equal(hero.initiative,18);}
 for(const raw of ['', '1.5','1e2','1000001'])assert.throws(()=>initiativeNumber(raw));assert.equal(initiativeNumber(' +19 '),19);assert.equal(initiativeNumber('-2'),-2);
});

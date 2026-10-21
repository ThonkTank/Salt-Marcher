import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {buildSync} from 'esbuild';
import {parseHTML} from './helpers/dom.mjs';

mkdirSync('.build/reinforcement/catalog',{recursive:true});
copyFileSync('src/features/catalog/data/srd-5.1.generated.json','.build/reinforcement/catalog/srd-5.1.generated.json');
buildSync({stdin:{contents:"export {CampaignStore} from './src/app/storage/store';export {searchCreatures} from './src/app/storage/encounters';export {rolledMonsterInitiatives,initiativeNumber} from './src/app/combat-initiative';",resolveDir:process.cwd()},outfile:'.build/reinforcement/store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
buildSync({stdin:{contents:"export * from './src/app/combat';export {initCommitControls,checkPendingCommit} from './src/app/commit-confirmation';",resolveDir:process.cwd()},outfile:'.build/reinforcement/ui.cjs',bundle:true,platform:'node',format:'cjs'});
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
 const x=await uiFixture(t);x.el('combat-add-open').onclick();x.el('combat-creature-source').value='group';x.el('combat-creature-source').onchange();assert.match(x.el('combat-creature-select').textContent,/Goblin.*vorhandene Initiative 9/);
 x.el('combat-creature-select').value='group:'+x.group;x.el('combat-creature-select').onchange();assert.equal(x.el('combat-creature-initiative').disabled,true);
 x.el('combat-creature-count').value='1';x.el('combat-creature-form').onsubmit({preventDefault(){}});
 await until(()=>x.writes.length===1&&!x.el('combat-creature-add').disabled);
 assert.equal(x.writes[0].action.kind,'add-creature');assert.equal(x.writes[0].action.groupId,x.group);assert.equal(x.writes[0].action.initiative,undefined);
 assert.equal(x.store.combat(x.w.token,x.scene.id,x.combat.id).combat.participants.length,4);
});
for(const source of ['group','catalog','free'])test(source+' reinforcement exposes a lost reply in the dialog and releases only closing until receipt recovery',async t=>{
 const x=await uiFixture(t);x.ui.initCommitControls(()=>x.w,(...args)=>x.messages.push(args));
 x.el('combat-add-open').onclick();x.el('combat-creature-source').value=source==='group'?'group':'catalog';x.el('combat-creature-source').onchange();
 const form=source==='free'?x.el('combat-add-form'):x.el('combat-creature-form'),count=source==='free'?x.el('enemy-count'):x.el('combat-creature-count');
 count.value='1';if(source==='catalog')x.el('combat-creature-initiative').value='10';if(source==='free')for(const [id,value]of Object.entries({'enemy-name':'Eigener Wächter','enemy-hp':'7','enemy-ac':'15','enemy-bonus':'2'}))x.el(id).value=value;
 const before=structuredClone(x.store.combat(x.w.token,x.scene.id,x.combat.id).combat);
 let release;window.campaign.executeCombat=command=>{x.writes.push(command);return new Promise(resolve=>{release=()=>{x.store.executeCombat(command);resolve({ok:false,error:'Controlled lost reinforcement reply'});};});};
 window.campaign.commitStatus=async()=>({ok:false,error:'Controlled unavailable receipt read'});
 form.onsubmit({preventDefault(){}});await until(()=>!!release);
 assert.equal(x.el('combat-add-close').disabled,true);x.el('combat-add-close').onclick();assert.equal(x.el('combat-add-dialog').hasAttribute('open'),true);
 const cancel=new window.Event('cancel',{cancelable:true});x.el('combat-add-dialog').dispatchEvent(cancel);assert.equal(cancel.defaultPrevented,true);assert.equal(x.el('combat-add-dialog').hasAttribute('open'),true);
 release();await until(()=>x.messages.some(([message])=>message.includes('Buchungsantwort fehlt')));
 assert.match(x.el('combat-add-status').textContent,/Buchungsantwort fehlt/);assert.match(x.el('combat-add-status').textContent,/Schließen.*Buchungsstatus/);
 assert.equal(x.el('combat-creature-add').disabled,true);assert.equal(x.el('combat-add-close').disabled,false);
 assert.equal(count.value,'1');assert.equal(x.el('combat-creature-source').value,source==='group'?'group':'catalog');
 form.onsubmit({preventDefault(){}});await tick();assert.equal(x.writes.length,1);
 if(source==='group')x.el('combat-add-close').onclick();else{const escape=new window.Event('cancel',{cancelable:true});x.el('combat-add-dialog').dispatchEvent(escape);assert.equal(escape.defaultPrevented,true);}
 assert.equal(x.el('combat-add-dialog').hasAttribute('open'),false);assert.equal(x.el('combat-next').disabled,true);
 window.campaign.commitStatus=async(...args)=>({ok:true,value:x.store.commitStatus(...args)});await x.ui.checkPendingCommit();
 await until(()=>!x.el('combat-next').disabled);const actual=x.store.combat(x.w.token,x.scene.id,x.combat.id).combat;
 assert.equal(x.writes.length,1);assert.equal(actual.participants.length,before.participants.length+1);assert.deepEqual(actual.participants.slice(0,-1),before.participants);assert.equal(actual.turnId,before.turnId);assert.equal(actual.round,before.round);
 assert.equal(x.store.db.prepare('SELECT count(*) n FROM combat_receipt WHERE command_id=?').get(x.writes[0].commandId).n,1);
 x.el('combat-add-open').onclick();assert.equal(x.el('combat-add-status').textContent,'');
});
test('a rejected reinforcement keeps its fields and displays its reason inside the dialog without a pending receipt',async t=>{
 const x=await uiFixture(t);x.el('combat-add-open').onclick();x.el('combat-creature-source').value='group';x.el('combat-creature-source').onchange();x.el('combat-creature-count').value='1';
 const before=structuredClone(x.combat);window.campaign.executeCombat=async command=>{x.writes.push(command);return{ok:false,error:'Controlled group conflict'};};
 x.el('combat-creature-form').onsubmit({preventDefault(){}});await until(()=>x.messages.some(([message])=>message.includes('Controlled group conflict')));
 assert.match(x.el('combat-add-status').textContent,/Controlled group conflict/);assert.equal(x.el('combat-add-close').disabled,false);assert.equal(x.el('combat-creature-add').disabled,false);assert.equal(x.el('combat-add-dialog').hasAttribute('open'),true);assert.equal(x.el('combat-creature-count').value,'1');assert.deepEqual(x.store.combat(x.w.token,x.scene.id,x.combat.id).combat,before);
});
test('reinforcement keeps same-creature troops distinct and preserves the selected troop across a health update',async t=>{
 const x=await uiFixture(t);
 x.execute({kind:'add-creature',creatureId:x.creature.id,count:2,grouped:true,initiative:15});
 const c=x.execute({kind:'add-creature',creatureId:x.creature.id,count:1,grouped:false,initiative:6});
 await x.ui.openExistingCombat(c.id);x.el('combat-add-open').onclick();x.el('combat-creature-source').value='group';x.el('combat-creature-source').onchange();
 const select=x.el('combat-creature-select'),options=[...select.options];
 assert.equal(options.length,2);assert.match(options[0].textContent,/vorhandene Initiative 9 \(3\)/);assert.match(options[1].textContent,/vorhandene Initiative 15 \(2\)/);
 const secondGroup=c.participants[3].groupId;assert.equal(options[1].value,'group:'+secondGroup);select.value=options[1].value;
 x.execute({kind:'damage',participantId:c.participants[3].id,amount:3});await x.ui.openExistingCombat(c.id);
 assert.equal(select.value,'group:'+secondGroup);
 x.el('combat-creature-count').value='1';x.el('combat-creature-form').onsubmit({preventDefault(){}});await until(()=>x.writes.length===1&&!x.el('combat-creature-add').disabled);
 const saved=x.store.combat(x.w.token,x.scene.id,c.id).combat;
 assert.equal(saved.participants.at(-1).groupId,secondGroup);assert.equal(saved.participants.at(-1).initiative,15);assert.equal(saved.participants[3].hp,4);assert.equal(saved.participants[5].groupId,c.participants[5].groupId);assert.equal(saved.turnId,c.turnId);
});
test('same-creature troops with equal initiative and quantity expose their members before choosing reinforcement',async t=>{
 const x=await uiFixture(t);
 const reinforced=x.execute({kind:'add-creature',creatureId:x.creature.id,count:3,grouped:true,initiative:9});
 const second=reinforced.participants.slice(3),secondGroup=second[0].groupId;
 const before=structuredClone(x.execute({kind:'edit',participantId:second[0].id,changes:{hp:4,conditions:'Liegend'}}));await x.ui.openExistingCombat(before.id);x.el('combat-add-open').onclick();x.el('combat-creature-source').value='group';x.el('combat-creature-source').onchange();
 const select=x.el('combat-creature-select'),options=[...select.options];
 assert.equal(options.length,2);assert.notEqual(options[0].textContent,options[1].textContent);
 assert.match(options[0].textContent,/Goblin A, Goblin B ….*vorhandene Initiative 9 \(3\)/);
 assert.match(options[1].textContent,/Goblin D, Goblin E ….*vorhandene Initiative 9 \(3\)/);
 assert.doesNotMatch(options[1].textContent,/Goblin F/,'large troops use a bounded member preview');
 select.value=options.find(o=>o.textContent.includes('Goblin D')).value;
 x.el('combat-creature-count').value='1';x.el('combat-creature-form').onsubmit({preventDefault(){}});
 await until(()=>x.writes.length===1&&!x.el('combat-creature-add').disabled);
 const saved=x.store.combat(x.w.token,x.scene.id,before.id).combat;
 assert.equal(x.writes[0].action.groupId,secondGroup);assert.equal(saved.participants.at(-1).groupId,secondGroup);
 assert.equal(saved.participants.at(-1).initiative,9);assert.deepEqual(saved.participants.slice(0,6),before.participants);
 assert.equal(saved.turnId,before.turnId);assert.equal(saved.round,before.round);
});
test('late catalog results cannot populate another encounter or enable a fabricated choice',async t=>{
 const x=await uiFixture(t);x.el('combat-creature-search').value='Dragon';x.el('combat-creature-search-form').onsubmit({preventDefault(){}});await until(()=>x.queries.length===1);
 const other=x.execute({kind:'create',sceneId:x.scene.id,title:'Andere Begegnung',includeParty:false,expectedMembershipRevision:x.scene.membershipRevision});await x.ui.openExistingCombat(other.id);
 x.queries[0].resolve({ok:true,value:{rows:[{id:'stale',name:'Stale Dragon',challengeRating:'9'}],total:1}});await tick();await tick();
 assert.doesNotMatch(x.el('combat-creature-select').textContent,/Stale/);assert.equal(x.el('combat-creature-add').disabled,true);
 x.el('combat-creature-search-form').onsubmit({preventDefault(){}});await until(()=>x.queries.length===2);x.queries[1].reject(new Error('Offline'));await until(()=>x.el('combat-creature-status').textContent.includes('Offline'));
 assert.equal(x.el('combat-creature-add').disabled,true);assert.equal(x.writes.length,0);
});
test('a failed catalog search never offers an old troop as a result and can recover',async t=>{
 const x=await uiFixture(t);x.el('combat-creature-search').value='Dragon';x.el('combat-creature-search-form').onsubmit({preventDefault(){}});await until(()=>x.queries.length===1);
 x.queries[0].reject(new Error('Offline'));await until(()=>x.el('combat-creature-status').textContent.includes('Offline'));
 assert.doesNotMatch(x.el('combat-creature-select').textContent,/Goblin/);assert.equal(x.el('combat-creature-add').disabled,true);assert.equal(x.writes.length,0);
 x.el('combat-creature-search-form').onsubmit({preventDefault(){}});await until(()=>x.queries.length===2);
 x.queries[1].resolve({ok:true,value:{rows:[{id:'dragon',name:'Dragon',challengeRating:'9'}],total:1}});await until(()=>x.el('combat-creature-select').textContent.includes('Dragon'));
 assert.equal(x.el('combat-creature-add').disabled,false);assert.doesNotMatch(x.el('combat-creature-select').textContent,/Goblin/);assert.equal(x.el('combat-creature-select').value,'creature:dragon');
 x.el('combat-creature-source').value='group';x.el('combat-creature-source').onchange();assert.match(x.el('combat-creature-select').textContent,/Goblin/);assert.equal(x.el('combat-creature-initiative-field').hidden,true);assert.equal(x.el('combat-creature-grouped-field').hidden,true);assert.equal(x.el('combat-creature-search-form').hidden,true);
});
test('an empty catalog search remains empty after switching sources instead of falling back to combat creatures',async t=>{
 const x=await uiFixture(t);x.el('combat-creature-search').value='No such creature';x.el('combat-creature-search-form').onsubmit({preventDefault(){}});await until(()=>x.queries.length===1);
 x.queries[0].resolve({ok:true,value:{rows:[],total:0}});await until(()=>x.el('combat-creature-status').textContent.startsWith('Keine Treffer'));
 assert.equal(x.el('combat-creature-add').disabled,true);assert.doesNotMatch(x.el('combat-creature-select').textContent,/Goblin/);
 x.el('combat-creature-source').value='group';x.el('combat-creature-source').onchange();assert.match(x.el('combat-creature-select').textContent,/Goblin/);
 x.el('combat-creature-source').value='catalog';x.el('combat-creature-source').onchange();assert.equal(x.el('combat-creature-select').value,'');assert.equal(x.el('combat-creature-add').disabled,true);assert.doesNotMatch(x.el('combat-creature-select').textContent,/Goblin/);assert.equal(x.writes.length,0);
});

test('condition shortcuts wait for the selected working draft and stay blocked on a read failure',async t=>{
 const x=await uiFixture(t);let resolve;window.campaign.combatDraft=()=>new Promise(r=>{resolve=r;});
 x.el('combat-table').querySelector('[data-mob-front-id]').onclick();await until(()=>!!resolve);
 const buttons=()=>[...x.el('fighter-condition-shortcuts').querySelectorAll('button')];
 assert.ok(buttons().length);assert.ok(buttons().every(b=>b.disabled));
 x.el('combat-participant-form').onsubmit({preventDefault(){}});assert.equal(x.writes.length,0);
 resolve({ok:false,error:'Working draft unavailable'});await tick();await tick();
 assert.ok(buttons().every(b=>b.disabled));x.el('combat-participant-form').onsubmit({preventDefault(){}});assert.equal(x.writes.length,0);
});

test('condition shortcuts cannot adopt unrelated raw values and resume after explicit discard or adoption',async t=>{
 const x=await uiFixture(t),oldEvent=globalThis.Event;globalThis.Event=window.Event;t.after(()=>{globalThis.Event=oldEvent;});
 const actor=x.combat.participants[0],form=x.el('combat-participant-form');form.requestSubmit=()=>form.onsubmit({preventDefault(){}});
 x.el('combat-rows').querySelector('[data-mob-front-id]').onclick();await until(()=>!x.el('fighter-hp').disabled);
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
 x.el('combat-rows').querySelector('.combat-mob-toggle').onclick();
 x.el('fighter-condition-panel').open=true;const scrolls=[];amount.scrollIntoView=options=>scrolls.push(options.block);amount.focus=()=>{focused=true;};amount.select=()=>{};amount.reportValidity=()=>Number(amount.value)>0;
 const cells=[...x.el('combat-rows').querySelectorAll('.combat-health')];
 assert.equal(cells.length,3);assert.match(cells[1].getAttribute('aria-label'),/Goblin B.*7 \/ 7/);
 cells[1].onclick();await until(()=>focused);assert.equal(x.writes.length,0);
 assert.equal(x.el('combat-selected-name').textContent,target.name);assert.deepEqual(scrolls,['nearest']);assert.equal(x.el('fighter-condition-panel').open,false);
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

test('roster condition entry opens the individual shortcuts without a write and changes only that troop member',async t=>{
 const x=await uiFixture(t),target=x.combat.participants[1],root=x.el('fighter-condition-shortcuts'),scrolls=[];
 x.el('combat-rows').querySelector('.combat-mob-toggle').onclick();
 root.scrollIntoView=options=>scrolls.push(options.block);
 const entry=x.el('combat-rows').querySelectorAll('.combat-conditions')[1];assert.ok(entry,'condition entry available in each roster row');
 entry.onclick();await until(()=>scrolls.length===1);assert.equal(x.el('fighter-condition-panel').open,true);assert.equal(x.el('combat-selected-name').textContent,target.name);assert.equal(x.writes.length,0);assert.deepEqual(scrolls,['nearest']);
 const oldEvent=globalThis.Event;globalThis.Event=window.Event;t.after(()=>{globalThis.Event=oldEvent;});
 const form=x.el('combat-participant-form');form.requestSubmit=()=>form.onsubmit({preventDefault(){}});
 [...root.querySelectorAll('button')].find(b=>b.textContent==='Festgesetzt').onclick();await until(()=>x.writes.length===1&&!x.el('fighter-hp').disabled);
 const saved=x.store.combat(x.w.token,x.scene.id,x.combat.id).combat;
 assert.deepEqual(saved.participants.map(p=>p.conditions),['','Festgesetzt','']);assert.deepEqual(saved.participants.map(p=>p.hp),[7,7,7]);assert.equal(saved.turnId,x.combat.turnId);assert.ok(saved.participants.every(p=>p.groupId===x.group));
});

test('a delayed roster condition entry cannot scroll into another scene or issue a write',async t=>{
 const x=await uiFixture(t),root=x.el('fighter-condition-shortcuts'),scrolls=[];root.scrollIntoView=()=>scrolls.push(true);
 x.el('combat-rows').querySelector('.combat-mob-toggle').onclick();
 let resolve;window.campaign.combatDraft=()=>new Promise(r=>{resolve=r;});
 const entry=x.el('combat-rows').querySelector('.combat-conditions');assert.ok(entry);entry.onclick();await until(()=>!!resolve);
 x.ui.combatContext(null,null);resolve({ok:true,value:null});await tick();await tick();assert.deepEqual(scrolls,[]);assert.equal(x.writes.length,0);assert.equal(x.el('combat-panel').hidden,true);
});

test('an HP lookup that completes after a target switch cannot steal the new editor focus',async t=>{
 const x=await uiFixture(t),amount=x.el('fighter-amount'),replies=[];let focused=0;
 x.el('combat-rows').querySelector('.combat-mob-toggle').onclick();
 let scrolled=0;amount.scrollIntoView=()=>scrolled++;amount.focus=()=>focused++;amount.select=()=>{};
 window.campaign.combatDraft=()=>new Promise(resolve=>replies.push(resolve));
 const cells=[...x.el('combat-rows').querySelectorAll('.combat-health')];cells[0].onclick();await until(()=>replies.length===1);cells[1].onclick();await until(()=>replies.length===2);
 replies[1]({ok:true,value:null});await until(()=>focused===1);replies[0]({ok:true,value:null});await tick();await tick();
 assert.equal(focused,1);assert.equal(scrolled,1);assert.equal(x.el('combat-selected-name').textContent,x.combat.participants[1].name);assert.equal(x.writes.length,0);
});

test('initiative cells open one field per group and never submit the fighter HP draft',async t=>{
 const x=await uiFixture(t),target=x.combat.participants[1];x.el('combat-rows').querySelector('[data-mob-front-id]').onclick();await until(()=>!x.el('fighter-name').disabled);x.el('fighter-hp').value='2';x.el('fighter-hp').dispatchEvent(new window.Event('input'));await tick();await tick();
 x.el('combat-rows').querySelector('.combat-mob-toggle').onclick();
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
 const x=await uiFixture(t);x.el('combat-rows').querySelector('[data-mob-front-id]').onclick();await until(()=>!x.el('fighter-name').disabled);
 x.el('fighter-group-name').value='Schützen';x.el('fighter-group-name').dispatchEvent(new window.Event('input'));await tick();await tick();x.el('combat-participant-form').onsubmit({preventDefault(){}});await until(()=>x.writes.length===1&&!x.el('combat-undo').disabled);
 assert.equal(x.writes[0].action.changes.groupName,'Schützen');assert.match(x.el('combat-creature-select').textContent,/Schützen · Goblin A, Goblin B … · vorhandene Initiative 9/);assert.match(x.el('combat-rows').querySelector('.combat-mob-card strong').textContent,/^Schützen/);assert.ok(x.store.combat(x.w.token,x.scene.id,x.combat.id).combat.participants.every(p=>p.groupName==='Schützen'));
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


test('initiative rolls stay in the working draft until one explicit apply, with discard, combat undo and fresh storage',async t=>{
 const x=await uiFixture(t),before=structuredClone(x.combat);
 x.el('combat-initiative-open').onclick();await until(()=>x.el('initiative-rows').querySelector('input')&&!x.el('initiative-save').disabled);
 const input=x.el('initiative-rows').querySelector('input');
 Object.defineProperty(x.el('initiative-mode'),'value',{configurable:true,writable:true,value:'normal'});
 for(const mode of ['normal','advantage','disadvantage']){
  x.el('initiative-mode').value=mode;x.el('initiative-roll').onclick();
  assert(Number(input.value)>=3&&Number(input.value)<=22);assert.equal(x.writes.length,0);
  assert.deepEqual(x.store.combat(x.w.token,x.scene.id,before.id).combat,before);
  x.el('initiative-roll-undo').onclick();assert.equal(input.value,'9');
 }
 x.el('initiative-roll').onclick();const rolled=Number(input.value);
 x.el('initiative-form').onsubmit({preventDefault(){}});await until(()=>x.writes.length===1&&!x.el('combat-next').disabled);
 assert.equal(x.writes[0].action.kind,'initiative');let saved=x.store.combat(x.w.token,x.scene.id,before.id).combat;
 assert(saved.participants.every(p=>p.initiative===rolled));assert.equal(saved.turnId,before.turnId);assert.equal(saved.round,before.round);
 const fresh=new CampaignStore(x.file);try{const w=fresh.activate(x.campaign.id);assert.deepEqual(fresh.combat(w.token,x.scene.id,before.id).combat,saved);}finally{fresh.close();}
 x.el('combat-undo').onclick();await until(()=>x.writes.length===2&&!x.el('combat-next').disabled);
 saved=x.store.combat(x.w.token,x.scene.id,before.id).combat;assert.deepEqual(saved.participants,before.participants);assert.equal(saved.turnId,before.turnId);
});

test('initiative previews roll once per troop with its bonus and never roll player entries',t=>{
 const x=fixture(t),hero={...x.combat.participants[0],id:'hero',groupId:'hero-group',characterId:'hero-character',initiative:18,initiativeBonus:99},c={...x.combat,participants:[hero,...x.combat.participants]};
 for(const [mode,expected,calls] of [['normal',5,1],['advantage',19,2],['disadvantage',5,2]]){let i=0;const result=rolledMonsterInitiatives(c,mode,()=>[3,17][i++]);assert.equal(i,calls);assert.deepEqual(result,[{participantId:x.combat.participants[0].id,initiative:expected}]);assert.equal(hero.initiative,18);}
 for(const raw of ['', '1.5','1e2','1000001'])assert.throws(()=>initiativeNumber(raw));assert.equal(initiativeNumber(' +19 '),19);assert.equal(initiativeNumber('-2'),-2);
});

test('initiative read retry restores an unseen saved draft without discarding it; stale loaded input still requires explicit discard',async t=>{
 const x=await uiFixture(t),c=x.combat,d={version:1,kind:'initiative',writeId:randomUUID(),combatId:c.id,sceneId:c.sceneId,targetId:c.id,revision:c.revision,basis:{phase:c.phase,round:c.round,turnId:c.turnId,participants:c.participants.map(p=>({id:p.id,groupId:p.groupId,initiative:p.initiative}))},values:[{participantId:c.participants[0].id,raw:' +17 '}]};
 x.store.keepCombatDraft(x.w.token,d,null);const originalRead=window.campaign.combatDraft,originalDiscard=window.campaign.discardCombatDraft;let fail=true,discards=0;
 window.campaign.combatDraft=async(...args)=>{if(args[2]==='initiative'&&fail){fail=false;return{ok:false,error:'Controlled temporary draft read failure'};}return originalRead(...args);};window.campaign.discardCombatDraft=async(...args)=>{discards++;return originalDiscard(...args);};
 const bytes=x.store.db.serialize();x.el('combat-initiative-open').onclick();await until(()=>x.el('initiative-status').textContent.includes('Controlled temporary'));assert.equal(x.el('initiative-save').disabled,true);x.el('initiative-reload').onclick();
 await until(()=>x.el('initiative-rows').querySelector('input')&&!x.el('initiative-save').disabled);assert.equal(x.el('initiative-rows').querySelector('input').value,' +17 ');assert.equal(discards,0);assert.deepEqual(x.store.combatDraft(x.w.token,c.id,'initiative',c.id),d);assert(x.store.db.serialize().equals(bytes));assert.equal(x.writes.length,0);
 x.execute({kind:'edit',participantId:c.participants[0].id,changes:{initiative:11}});await x.ui.openExistingCombat(c.id);await until(()=>!x.el('initiative-reload').hidden&&x.el('initiative-save').disabled);assert.match(x.el('initiative-preserved').value,/ \+17 /);x.el('initiative-reload').onclick();await until(()=>x.el('initiative-rows').querySelector('input')?.value==='11'&&!x.el('initiative-save').disabled);assert.equal(discards,1);assert.equal(x.store.combatDraft(x.w.token,c.id,'initiative',c.id),null);assert.equal(x.writes.length,0);
});


test('expanded troop keeps individual controls without repeating the front member summary',async t=>{
 const x=await uiFixture(t),before=structuredClone(x.store.combat(x.w.token,x.scene.id,x.combat.id).combat);
 const card=()=>x.el('combat-rows').querySelector('.combat-mob-card');
 assert.ok(card().querySelector('.combat-mob-health'));
 assert.equal(x.el('combat-rows').querySelectorAll('tr[data-participant-id]').length,0);
 card().querySelector('.combat-mob-toggle').onclick();
 assert.equal(card().querySelector('.combat-mob-health'),null,'Expanded members already expose their own HP controls');
 assert.doesNotMatch(card().textContent,/Vorderes Mitglied/);
 assert.match(card().textContent,/0 \/ 3 Züge/);
 const members=[...x.el('combat-rows').querySelectorAll('tr[data-participant-id]')];
 assert.equal(members.length,3);assert.ok(members.every(row=>!row.hidden));
 for(const member of members){assert.ok(member.querySelector('.combat-health'));assert.ok(member.querySelector('.combat-conditions'));}
 assert.equal(x.writes.length,0);assert.deepEqual(x.store.combat(x.w.token,x.scene.id,x.combat.id).combat,before);
 card().querySelector('.combat-mob-toggle').onclick();assert.ok(card().querySelector('.combat-mob-health'));
 assert.equal(x.el('combat-rows').querySelectorAll('tr[data-participant-id]').length,0);
 card().querySelector('.combat-mob-toggle').onclick();assert.deepEqual([...x.el('combat-rows').querySelectorAll('tr[data-participant-id]')].map(row=>row.dataset.participantId),before.participants.map(p=>p.id));assert.equal(x.writes.length,0);
});


test('reinforcement dialog separates troop additions from catalog results and closes on context change',async t=>{
 const x=await uiFixture(t),dialog=x.el('combat-add-dialog');
 const roster=x.el('combat-rows').innerHTML;
 x.el('combat-creature-source').value='catalog'; // automatic empty-preparation fallback was not a GM choice
 x.el('combat-add-open').onclick();assert.equal(dialog.hasAttribute('open'),true);
 assert.match(x.el('combat-add-context').textContent,/Runde 1.*Zug bleibt erhalten/);
 assert.equal(x.el('combat-rows').innerHTML,roster);assert.equal(x.writes.length,0);
 assert.equal(x.el('combat-creature-source').value,'catalog');
 assert.equal(x.el('combat-creature-initiative-field').hidden,false);
 x.el('combat-creature-source').value='catalog';x.el('combat-creature-source').onchange();
 assert.equal(x.el('combat-creature-search-form').hidden,false);assert.equal(x.el('combat-creature-initiative-field').hidden,false);
 assert.doesNotMatch(x.el('combat-creature-select').textContent,/vorhandene Initiative/);
 assert.equal(x.el('combat-creature-grouped-field').hidden,true);
 x.el('combat-creature-count').value='2';x.el('combat-creature-count').oninput();assert.equal(x.el('combat-creature-grouped-field').hidden,false);x.el('combat-creature-grouped').checked=true;
 x.el('combat-creature-count').value='1';x.el('combat-creature-count').oninput();assert.equal(x.el('combat-creature-grouped-field').hidden,true);assert.equal(x.el('combat-creature-grouped').checked,false);
 x.el('combat-add-close').onclick();x.el('combat-add-open').onclick();assert.equal(x.el('combat-creature-source').value,'catalog');assert.equal(x.el('combat-creature-grouped-field').hidden,true);
 x.el('combat-creature-search').value='Hobgoblin';x.el('combat-creature-search-form').onsubmit({preventDefault(){}});await until(()=>x.queries.length===1);
 assert.equal(x.el('combat-creature-add').disabled,true);
 x.queries[0].resolve({ok:true,value:searchCreatures({text:'Hobgoblin',offset:0,limit:25,sort:'name',direction:'asc'})});
 await until(()=>x.el('combat-creature-select').textContent.includes('Hobgoblin'));
 assert.equal(x.el('combat-creature-select').options.length,1);assert.doesNotMatch(x.el('combat-creature-select').textContent,/vorhandene Initiative/);
 const hob=searchCreatures({text:'Hobgoblin',offset:0,limit:25,sort:'name',direction:'asc'}).rows[0];
 assert.equal(x.el('combat-creature-select').value,'creature:'+hob.id);
 x.el('combat-creature-initiative').value='12';x.el('combat-creature-form').onsubmit({preventDefault(){}});
 await until(()=>x.writes.length===1&&!dialog.hasAttribute('open'));
 assert.equal(x.writes[0].action.creatureId,hob.id);assert.equal(x.writes[0].action.initiative,12);
 const saved=x.store.combat(x.w.token,x.scene.id,x.combat.id).combat;
 assert.equal(saved.turnId,x.combat.turnId);assert.equal(saved.participants.at(-1).hp,11);
 x.el('combat-add-open').onclick();x.ui.combatContext(null,null);assert.equal(dialog.hasAttribute('open'),false);
});

test('catalog preparation commits its first enemies, party and receipt together and reopens without a second add',t=>{
 const x=fixture(t),character=x.store.executeLive(x.command({kind:'create-character',profile:{name:'Mira'}})).character,live=x.store.live(x.w.token);
 x.scene=x.store.executeLive(x.command({kind:'membership',characterId:character.id,expectedRevision:character.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:x.scene.id,expectedFocusRevision:live.focusRevision})).scene;
 const command={...x.command({kind:'create',sceneId:x.scene.id,title:'Hafentor',includeParty:true,expectedMembershipRevision:x.scene.membershipRevision,catalogCreature:{creatureId:x.creature.id,count:2,grouped:true}}),combatId:null,expectedRevision:null};
 const before=x.store.db.prepare('SELECT count(*) n FROM combat WHERE campaign_id=?').get(x.campaign.id).n,result=x.store.executeCombat(command),c=result.combat;
 assert.equal(c.revision,1);assert.equal(c.phase,'preparing');assert.equal(c.participants.length,3);assert.equal(c.participants[0].characterId,character.id);const enemies=c.participants.filter(p=>p.sourceId===x.creature.id);assert.equal(enemies.length,2);assert.equal(enemies[0].groupId,enemies[1].groupId);assert.notEqual(enemies[0].id,enemies[1].id);assert(enemies.every(p=>p.hp===7&&p.partitionKind==='mob'));assert.equal(result.assessment.baseXp,100);
 assert.deepEqual(x.store.executeCombat(command),result);assert.equal(x.store.db.prepare('SELECT count(*) n FROM combat WHERE campaign_id=?').get(x.campaign.id).n,before+1);assert.equal(x.store.db.prepare('SELECT count(*) n FROM combat_receipt WHERE command_id=?').get(command.commandId).n,1);
 x.store.close();x.store=new CampaignStore(x.file);x.w=x.store.activate(x.campaign.id);assert.deepEqual(x.store.combat(x.w.token,x.scene.id,c.id).combat,c);
});
test('invalid initial catalog data or a late receipt failure leaves no partial preparation',t=>{
 const x=fixture(t),action={kind:'create',sceneId:x.scene.id,title:'Hafentor',includeParty:true,expectedMembershipRevision:x.scene.membershipRevision,catalogCreature:{creatureId:x.creature.id,count:2,grouped:true}},command=a=>({...x.command(a),combatId:null,expectedRevision:null});
 const before=x.store.db.serialize();
 for(const change of [{catalogCreature:null},{catalogCreature:{...action.catalogCreature,creatureId:'missing'}},{catalogCreature:{...action.catalogCreature,count:0}},{catalogCreature:{...action.catalogCreature,count:1001}},{catalogCreature:{...action.catalogCreature,grouped:'yes'}},{planId:'missing'},{sceneSelection:{}},{preparedGroupId:'missing'},{generation:{}},{worldActorIds:[]},{expectedMembershipRevision:-1}]){
  assert.throws(()=>x.store.executeCombat(command({...action,...change})));assert.ok(x.store.db.serialize().equals(before));
 }
 x.store.db.exec("CREATE TRIGGER owned_initial_receipt_failure BEFORE INSERT ON combat_receipt BEGIN SELECT RAISE(ABORT,'receipt unavailable');END;");const withTrigger=x.store.db.serialize(),retry=command(action);assert.throws(()=>x.store.executeCombat(retry),/receipt unavailable/);assert.ok(x.store.db.serialize().equals(withTrigger));x.store.db.exec('DROP TRIGGER owned_initial_receipt_failure');assert.equal(x.store.executeCombat(retry).combat.participants.length,2);
});
for(const modal of [false,true])test('catalog handoff creates one complete preparation and resolves its single lost reply: '+(modal?'dialog':'catalog'),async t=>{
 const x=await uiFixture(t);x.execute({kind:'finish',outcome:'Vorheriger Kampf beendet'});await x.ui.openExistingCombat(x.combat.id);let followed=0;window.requestAnimationFrame=()=>{followed++;return 0;};if(modal)x.el('combat-add-open').onclick();
 window.campaign.executeCombat=async command=>{x.writes.push(command);x.store.executeCombat(command);throw new Error('reply lost');};
 await x.ui.addCatalogCreature(x.creature.id,2,true);assert.equal(followed,modal?0:1);assert.equal(x.el('combat-add-dialog').hasAttribute('open'),modal);
 if(modal){assert.match(x.el('combat-add-context').textContent,/Vorbereitet: 2 × Goblin/);assert.equal(x.el('combat-preparation-initiative').disabled,false);assert.equal(x.el('combat-creature-select').value,'');assert.equal(x.el('combat-creature-add').disabled,true);}assert.equal(x.writes.length,1);assert.equal(x.writes[0].action.kind,'create');assert.deepEqual(x.writes[0].action.catalogCreature,{creatureId:x.creature.id,count:2,grouped:true});
 const current=x.store.combat(x.w.token,x.scene.id).combat;assert.notEqual(current.id,x.combat.id);assert.equal(current.revision,1);assert.equal(current.participants.length,2);assert.equal(x.el('combat-start').disabled,false);assert(!x.messages.some(m=>String(m[0]).includes('Buchungsantwort fehlt')));
});
test('failed initial catalog handoff preserves the selected finished combat instead of storing an empty replacement',async t=>{
 const x=await uiFixture(t);x.execute({kind:'finish',outcome:'Vorheriger Kampf beendet'});await x.ui.openExistingCombat(x.combat.id);window.requestAnimationFrame=()=>0;const before=x.store.db.serialize();x.el('combat-add-open').onclick();
 await x.ui.addCatalogCreature('missing',2,true);assert.equal(x.el('combat-add-dialog').hasAttribute('open'),true);assert.match(x.el('combat-add-status').textContent,/Kreatur/);assert.equal(x.el('combat-add-close').disabled,false);assert.equal(x.writes.length,1);assert.equal(x.writes[0].action.kind,'create');assert.ok(x.store.db.serialize().equals(before));assert.equal(x.store.combat(x.w.token,x.scene.id).combat.id,x.combat.id);assert.match(x.el('combat-status').textContent,/Abgeschlossen/);
});


test('unknown PC armor stays unknown through catalog combat, edits, undo and reopening',t=>{
 const x=fixture(t),hero=x.store.executeLive(x.command({kind:'create-character',profile:{name:'Mira'}})).character;
 const live=x.store.live(x.w.token);
 x.store.executeLive(x.command({kind:'membership',characterId:hero.id,expectedRevision:hero.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:x.scene.id,expectedFocusRevision:live.focusRevision}));
 const scene=x.store.live(x.w.token).scenes.find(s=>s.id===x.scene.id);
 x.execute({kind:'create',sceneId:x.scene.id,title:'Offene RK',includeParty:true,expectedMembershipRevision:scene.membershipRevision,catalogCreature:{creatureId:x.creature.id,count:2,grouped:true}});
 const actor=()=>x.combat.participants.find(p=>p.characterId===hero.id);assert.equal(actor().armorClass,null);assert.equal(actor().healthKnown,false);
 x.execute({kind:'edit',participantId:actor().id,changes:{conditions:'Festgesetzt'}});assert.equal(actor().armorClass,null);
 for(const value of [-1,1.5,1000001,undefined]){const before=x.store.db.serialize();assert.throws(()=>x.execute({kind:'edit',participantId:actor().id,changes:{armorClass:value}}),/Rüstungsklasse/);assert(before.equals(x.store.db.serialize()));}
 x.execute({kind:'start'});assert.equal(actor().armorClass,null,'unknown armor must not block manual combat');
 const pc=actor().id;x.execute({kind:'edit',participantId:pc,changes:{armorClass:14}});assert.equal(actor().armorClass,14);
 x.execute({kind:'undo'});assert.equal(actor().armorClass,null);
 const id=x.combat.id;x.store.close();x.store=new CampaignStore(x.file);x.w=x.store.activate(x.campaign.id);x.combat=x.store.combat(x.w.token,x.scene.id,id).combat;assert.equal(actor().armorClass,null);assert(x.combat.participants.filter(p=>!p.characterId).every(p=>p.armorClass===15));
});

test('an unknown armor cell opens its blank editable value and unrelated edits preserve it',async t=>{
 const x=await uiFixture(t),target=x.combat.participants[0];x.execute({kind:'edit',participantId:target.id,changes:{armorClass:null}});await x.ui.openExistingCombat(x.combat.id);
 x.el('combat-rows').querySelector('.combat-mob-toggle').onclick();
 const armor=x.el('combat-rows').querySelector('.combat-armor');assert.equal(armor.textContent,'offen');const input=x.el('fighter-ac');let focused=false;input.scrollIntoView=()=>{};input.focus=()=>{focused=true;};input.select=()=>{};armor.onclick();await until(()=>focused);assert.equal(x.el('fighter-values').open,true);assert.equal(input.value,'');assert.equal(input.hasAttribute('required'),false);
 const form=x.el('combat-participant-form');form.onsubmit({preventDefault(){}});await until(()=>x.writes.length===1&&!input.disabled);assert.equal(x.writes[0].action.changes.armorClass,null);
 input.value='14';form.onsubmit({preventDefault(){}});await until(()=>x.writes.length===2&&!input.disabled);assert.equal(x.store.combat(x.w.token,x.scene.id,x.combat.id).combat.participants[0].armorClass,14);
});

test('an attack cannot roll against unknown armor and can select a known target instead',async t=>{
 const x=await uiFixture(t),target=x.combat.participants[2];x.execute({kind:'edit',participantId:target.id,changes:{armorClass:null}});await x.ui.openExistingCombat(x.combat.id);
 x.el('combat-attack-effect').scrollIntoView=()=>{};x.el('combat-rows').querySelector('[data-mob-front-id]').onclick();await until(()=>!x.el('fighter-hp').disabled);
 const attack=[...x.el('fighter-statblock-content').querySelectorAll('button')].find(button=>button.textContent.startsWith('Angriff '));assert(attack);attack.onclick();await until(()=>!x.el('combat-attack-effect').hidden);
 const select=x.el('combat-attack-target'),roll=x.el('combat-attack-roll');select.value=target.id;select.onchange();assert(roll.disabled);assert.match(select.textContent,/RK offen/);assert.match(roll.title,/zuerst eintragen/);assert.match(x.el('combat-attack-hint').textContent,/Ziel-RK noch offen.*RK-Spalte/);
 const before=x.store.db.serialize();roll.onclick();await tick();assert.equal(x.writes.length,0);assert(before.equals(x.store.db.serialize()));assert.match(x.messages.at(-1)[0],/Rüstungsklasse/);
 select.value=x.combat.participants[1].id;select.onchange();assert.equal(roll.disabled,false);assert.doesNotMatch(x.el('combat-attack-hint').textContent,/Ziel-RK noch offen/);
});


test('spontaneous survivors remain scene figures with shared HP after finish, restart and a second mask',t=>{
 const x=fixture(t),id=x.combat.id,first=x.combat.participants[0],actorId=first.worldActorId;
 assert.ok(actorId);const groups=x.store.scenePreparation(x.w.token,x.scene.id).groups;
 assert.equal(groups.length,1);assert.equal(groups[0].actors.length,3);assert.equal(groups[0].actors[0].name,'Goblin A');
 x.execute({kind:'damage',participantId:first.id,amount:3});
 assert.equal(x.store.scenePreparation(x.w.token,x.scene.id).groups[0].actors[0].hp,4);
 x.execute({kind:'undo'});assert.equal(x.store.scenePreparation(x.w.token,x.scene.id).groups[0].actors[0].hp,7);
 x.execute({kind:'damage',participantId:first.id,amount:3});x.execute({kind:'finish',outcome:'Goblins ergeben sich'});
 x.store.close();x.store=new CampaignStore(x.file);x.w=x.store.activate(x.campaign.id);
 const persisted=x.store.scenePreparation(x.w.token,x.scene.id).groups[0];
 assert.equal(persisted.actors[0].id,actorId);assert.equal(persisted.actors[0].hp,4);
 const next=x.execute({kind:'create',sceneId:x.scene.id,title:'Erneute Begegnung',includeParty:false,expectedMembershipRevision:x.scene.membershipRevision,preparedGroupId:persisted.id,expectedPreparedRevision:persisted.revision});
 assert.equal(next.participants.find(p=>p.worldActorId===actorId).hp,4);
 x.execute({kind:'damage',participantId:next.participants.find(p=>p.worldActorId===actorId).id,amount:1});
 assert.equal(x.store.scenePreparation(x.w.token,x.scene.id).groups[0].actors[0].hp,3);
 assert.equal(x.store.combat(x.w.token,x.scene.id,id).combat.participants[0].hp,4,'finished result retains its historic snapshot');
});

test('scene opponent identities and health survive a complete campaign copy with independent ids',async t=>{
 const x=fixture(t),first=x.combat.participants[0];x.execute({kind:'damage',participantId:first.id,amount:3});x.execute({kind:'finish',outcome:'Ergeben sich'});
 const snapshot=x.root+'/opponents.sqlite';await x.store.campaignSnapshot(x.w.token,snapshot);
 const target=new CampaignStore(x.root+'/copy.sqlite');try{
  const copy=target.acceptCampaignSnapshot(snapshot,'Kopie',{}),w=target.activate(copy.id),scene=target.live(w.token).scene,groups=target.scenePreparation(w.token,scene.id).groups;
  assert.notEqual(scene.id,x.scene.id);assert.equal(groups.length,1);assert.equal(groups[0].actors.length,3);assert.equal(groups[0].actors[0].hp,4);assert.notEqual(groups[0].actors[0].id,first.worldActorId);
  const combat=target.combat(w.token,scene.id).combat;assert.equal(combat.participants[0].worldActorId,groups[0].actors[0].id);assert.equal(combat.outcome,'Ergeben sich');await target.backup(x.root+'/safe.sqlite');
 }finally{target.close();}
});
test('schema 50 upgrades without changing records and missing schema 51 scene links fail closed',t=>{
 const root=mkdtempSync(tmpdir()+'/scene-opponent-upgrade-'),file=root+'/workbench.sqlite';let store=new CampaignStore(file);t.after(()=>{store.close();rmSync(root,{recursive:true,force:true});});
 const cam=store.create('Bestehende Kampagne'),w=store.activate(cam.id);store.executeLive({commandId:randomUUID(),campaignId:cam.id,token:w.token,action:{kind:'initialize',expectedRosterRevision:0}});
 store.db.exec('DROP TABLE scene_opponent_group;PRAGMA user_version=50');const before=store.db.prepare('SELECT * FROM live_scene').all();store.close();store=new CampaignStore(file);
 assert.deepEqual(store.db.prepare('SELECT * FROM live_scene').all(),before);assert.equal(store.db.pragma('user_version',{simple:true}),53);
 store.db.exec('DROP TABLE scene_opponent_group');store.close();assert.throws(()=>new CampaignStore(file),/Szenengegner-Zuordnung fehlt/);
});


test('spontaneous preparation collects confirmed species in one picker and opens their shared initiative',async t=>{
 const x=await uiFixture(t);x.execute({kind:'finish',outcome:'Vorheriger Kampf beendet'});await x.ui.openExistingCombat(x.combat.id);x.el('combat-add-open').onclick();
 await x.ui.addCatalogCreature(x.creature.id,3,true);
 const dialog=x.el('combat-add-dialog');assert.equal(dialog.hasAttribute('open'),true);assert.equal(x.el('combat-creature-count').value,'1');assert.equal(x.el('combat-creature-grouped').checked,false);assert.equal(x.el('combat-creature-select').value,'');assert.match(x.el('combat-add-status').textContent,/3 × Goblin übernommen/);
 x.el('combat-creature-search').value='Orc';x.el('combat-creature-search-form').onsubmit({preventDefault(){}});await until(()=>x.queries.length===1);
 const found=searchCreatures({text:'Orc',offset:0,limit:25,sort:'name',direction:'asc'});x.queries[0].resolve({ok:true,value:found});await until(()=>x.el('combat-creature-select').value==='creature:orc');
 x.el('combat-creature-initiative').value='8';x.el('combat-creature-form').onsubmit({preventDefault(){}});await until(()=>x.writes.length===2&&x.el('combat-add-status').textContent.includes('Orc übernommen'));
 assert.equal(dialog.hasAttribute('open'),true);assert.match(x.el('combat-add-context').textContent,/3 × Goblin/);assert.match(x.el('combat-add-context').textContent,/1 × Orc/);assert.equal(x.el('combat-creature-select').value,'');assert.equal(x.el('combat-creature-add').disabled,true);
 const current=x.store.combat(x.w.token,x.scene.id).combat;assert.equal(current.participants.length,4);assert.equal(new Set(current.participants.filter(p=>p.sourceId===x.creature.id).map(p=>p.groupId)).size,1);assert.equal(current.participants.at(-1).initiative,8);assert.equal(x.writes.filter(c=>c.action.kind==='create').length,1);
 x.el('combat-preparation-initiative').onclick();await until(()=>x.el('combat-initiative-dialog').hasAttribute('open')&&x.el('initiative-rows').querySelectorAll('input').length===2);assert.equal(dialog.hasAttribute('open'),false);assert.match(x.el('initiative-rows').textContent,/Goblin A.*3 Teilnehmer/);assert.match(x.el('initiative-rows').textContent,/Orc A/);assert.equal(x.writes.length,2,'opening initiative cannot add another enemy');
});

test('a pending second species cannot jump into initiative and a rejected write retains its inputs',async t=>{
 const x=await uiFixture(t);x.execute({kind:'finish',outcome:'Beendet'});await x.ui.openExistingCombat(x.combat.id);x.el('combat-add-open').onclick();await x.ui.addCatalogCreature(x.creature.id,3,true);
 x.el('combat-creature-search').value='Orc';x.el('combat-creature-search-form').onsubmit({preventDefault(){}});await until(()=>x.queries.length===1);x.queries[0].resolve({ok:true,value:searchCreatures({text:'Orc',offset:0,limit:25,sort:'name',direction:'asc'})});await until(()=>x.el('combat-creature-select').value==='creature:orc');
 let release;window.campaign.executeCombat=command=>{x.writes.push(command);return new Promise(resolve=>release=()=>resolve({ok:false,error:'Controlled second species conflict'}));};x.el('combat-creature-count').value='2';x.el('combat-creature-form').onsubmit({preventDefault(){}});await until(()=>typeof release==='function');
 assert.equal(x.el('combat-preparation-initiative').disabled,true);x.el('combat-preparation-initiative').onclick();assert.equal(x.el('combat-add-dialog').hasAttribute('open'),true);assert.equal(x.el('combat-initiative-dialog').hasAttribute('open'),false);
 release();await until(()=>x.el('combat-add-status').textContent.includes('Controlled second species conflict'));assert.equal(x.el('combat-creature-select').value,'creature:orc');assert.equal(x.el('combat-creature-count').value,'2');assert.equal(x.store.combat(x.w.token,x.scene.id).combat.participants.length,3);assert.equal(x.el('combat-add-dialog').hasAttribute('open'),true);
});


test('a late preparation confirmation cannot reopen the picker after leaving its campaign',async t=>{
 const x=await uiFixture(t);x.execute({kind:'finish',outcome:'Beendet'});await x.ui.openExistingCombat(x.combat.id);x.el('combat-add-open').onclick();await x.ui.addCatalogCreature(x.creature.id,3,true);
 x.el('combat-creature-search').value='Orc';x.el('combat-creature-search-form').onsubmit({preventDefault(){}});await until(()=>x.queries.length===1);x.queries[0].resolve({ok:true,value:searchCreatures({text:'Orc',offset:0,limit:25,sort:'name',direction:'asc'})});await until(()=>x.el('combat-creature-select').value==='creature:orc');
 let release;window.campaign.executeCombat=command=>{x.writes.push(command);return new Promise(resolve=>release=()=>resolve({ok:true,value:x.store.executeCombat(command)}));};x.el('combat-creature-form').onsubmit({preventDefault(){}});await until(()=>typeof release==='function');x.ui.combatContext(null,null);release();await tick();await tick();
 assert.equal(x.el('combat-add-dialog').hasAttribute('open'),false);assert.equal(x.el('combat-initiative-dialog').hasAttribute('open'),false);assert.equal(x.el('combat-preparation-initiative').disabled,true);assert.doesNotMatch(x.el('combat-add-status').textContent,/Orc übernommen/);
});


test('a troop card opens its own reinforcement target without writes and stale cards cannot reopen it',async t=>{
 const x=await uiFixture(t),prepared=x.execute({kind:'add-creature',creatureId:x.creature.id,count:3,grouped:true,initiative:9}),second=prepared.participants.at(-1).groupId;
 await x.ui.openExistingCombat(x.combat.id);await until(()=>x.el('combat-rows').querySelectorAll('.combat-mob-reinforce').length===2);
 const before=structuredClone(prepared),button=x.el('combat-rows').querySelector('[data-mob-id="'+second+'"] .combat-mob-reinforce');button.onclick();
 assert.equal(x.el('combat-creature-source').value,'group');assert.equal(x.el('combat-creature-select').value,'group:'+second);assert.equal(x.el('combat-creature-count').value,'1');assert.equal(x.writes.length,0);
 x.el('combat-creature-form').onsubmit({preventDefault(){}});await until(()=>x.writes.length===1&&!x.el('combat-add-dialog').hasAttribute('open'));
 assert.equal(x.writes[0].action.groupId,second);const saved=x.store.combat(x.w.token,x.scene.id,x.combat.id).combat;assert.equal(saved.participants.at(-1).groupId,second);assert.deepEqual(saved.participants.slice(0,-1),before.participants);assert.equal(saved.turnId,before.turnId);assert.equal(saved.round,before.round);
 button.onclick();assert.equal(x.el('combat-add-dialog').hasAttribute('open'),false);assert.equal(x.writes.length,1);
});

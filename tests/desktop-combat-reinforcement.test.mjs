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
buildSync({stdin:{contents:"export {CampaignStore} from './src/app/storage/store';export {searchCreatures} from './src/app/storage/encounters';",resolveDir:process.cwd()},outfile:'.build/reinforcement/store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
buildSync({entryPoints:['src/app/combat.ts'],outfile:'.build/reinforcement/ui.cjs',bundle:true,platform:'node',format:'cjs'});
const require=createRequire(import.meta.url),{CampaignStore,searchCreatures}=require('../.build/reinforcement/store.cjs');
const tick=()=>new Promise(r=>setImmediate(r));
async function until(check){for(let i=0;i<150&&!check();i++)await tick();assert.ok(check(),'Expected reinforcement state');}
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
 Object.assign(globalThis,{window,document});for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{configurable:true,writable:true,value:''});
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

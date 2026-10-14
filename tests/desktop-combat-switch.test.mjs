import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {parseHTML} from 'linkedom';
const require=createRequire(import.meta.url);
for(const [entry,out]of [['src/app/storage/store.ts','combat-switch-store'],['src/app/combat.ts','combat-switch-ui']])buildSync({entryPoints:[entry],outfile:'.build/'+out+'.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const tick=()=>new Promise(r=>setImmediate(r));
async function until(check){for(let i=0;i<100;i++){if(check())return;await tick();}assert(check(),'Expected encounter state');}
async function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),'combat-switch-')),{CampaignStore}=require('../.build/combat-switch-store.cjs'),store=new CampaignStore(root+'/workbench.sqlite'),campaign=store.create('Zwei Begegnungen'),w=store.activate(campaign.id),command=action=>({commandId:randomUUID(),token:w.token,campaignId:campaign.id,action});
 const scene=store.executeLive(command({kind:'initialize',expectedRosterRevision:0})).scene,combats=[];
 for(const [title,name,hp]of [['Torwache','Wache',10],['Keller','Wolf',8]]){let c=store.executeCombat({...command({kind:'create',sceneId:scene.id,title,includeParty:false,expectedMembershipRevision:scene.membershipRevision}),combatId:null,expectedRevision:null}).combat;c=store.executeCombat({...command({kind:'add',name,count:1,grouped:false,maxHp:hp,armorClass:10,initiativeBonus:0}),combatId:c.id,expectedRevision:c.revision}).combat;combats.push(c);}
 const [a,b]=combats,previous={window:globalThis.window,document:globalThis.document},{window,document}=parseHTML(readFileSync('src/app/index.html','utf8'));Object.assign(globalThis,{window,document});
 const storage=new Map();window.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{value:'',writable:true});
 const response=fn=>{try{return{ok:true,value:fn()};}catch(e){return{ok:false,error:e.message};}},reads=[],writes=[],waiting=[],messages=[];let hold=false,fail=false;
 window.campaign={};for(const key of ['combatDraft','combatDrafts','keepCombatDraft','discardCombatDraft','commitStatus'])window.campaign[key]=async(...args)=>response(()=>store[key](...args));
 window.campaign.combat=async(...args)=>{reads.push(args[2]);const r=fail?{ok:false,error:'Begegnung nicht lesbar'}:response(()=>store.combat(...args));fail=false;if(hold){hold=false;return new Promise(resolve=>waiting.push(()=>resolve(r)));}return r;};
 window.campaign.executeCombat=async c=>{writes.push(c);return response(()=>store.executeCombat(c));};
 delete require.cache[require.resolve('../.build/combat-switch-ui.cjs')];const ui=require('../.build/combat-switch-ui.cjs');ui.initCombat(text=>messages.push(text));ui.combatContext(w,scene);const el=id=>document.getElementById(id);
 await until(()=>el('combat-title').textContent==='Keller'&&!el('combat-notes').disabled);
 const choose=id=>{el('combat-history').value=id;el('combat-history').onchange();},input=(id,text)=>{el(id).value=text;el(id).dispatchEvent(new window.Event('input'));},fighter=async()=>{el('combat-rows').querySelector('button').onclick();await until(()=>!el('combat-participant').hidden&&!el('fighter-hp').disabled);};
 return{store,w,ui,a,b,el,choose,input,fighter,reads,writes,messages,waiting,hold:()=>{hold=true;},fail:()=>{fail=true;},release:()=>waiting.shift()(),cleanup(){ui.combatContext(null,null);Object.assign(globalThis,previous);store.close();rmSync(root,{recursive:true,force:true});}};
}
test('selecting another encounter blocks old writes and preserves its incomplete notes',async()=>{
 const x=await fixture();try{x.choose(x.a.id);await until(()=>x.el('combat-title').textContent==='Torwache'&&!x.el('combat-notes').disabled);await x.fighter();x.input('combat-edit-title','');x.input('combat-notes','Unfertig\r\n');assert(await x.ui.flushCombat());x.hold();x.choose(x.b.id);await until(()=>x.waiting.length===1);assert.equal(x.el('fighter-damage').disabled,true);x.el('fighter-amount').value='1';x.el('fighter-damage').onclick();await tick();assert.equal(x.writes.length,0);assert.equal(x.store.combat(x.w.token,x.a.sceneId,x.a.id).combat.participants[0].hp,10);
 x.release();await until(()=>x.el('combat-title').textContent==='Keller'&&!x.el('combat-notes').disabled);await x.fighter();x.el('fighter-amount').value='1';x.el('fighter-damage').onclick();await until(()=>x.writes.length===1&&!x.el('fighter-hp').disabled);assert.equal(x.writes[0].combatId,x.b.id);assert.equal(x.store.combat(x.w.token,x.b.sceneId,x.b.id).combat.participants[0].hp,7);
 const d=x.store.combatDraft(x.w.token,x.a.id,'notes',x.a.id);assert.equal(d.values.title,'');assert.equal(d.values.notes,'Unfertig\r\n');
 }finally{x.cleanup();}
});
test('a failed selection clears old actions and retries the requested encounter',async()=>{
 const x=await fixture();try{await x.fighter();x.fail();x.choose(x.a.id);await until(()=>x.messages.some(m=>m.includes('nicht lesbar')));assert.equal(x.el('combat-workspace').hidden,true);assert.equal(x.el('combat-creation').hidden,true);assert.equal(x.el('combat-status').hidden,true);assert.equal(x.el('combat-history').value,x.a.id);assert.equal(x.el('fighter-damage').disabled,true);assert.equal(x.el('combat-refresh').disabled,false);assert.equal(x.el('combat-load-status').getAttribute('role'),'alert');x.el('combat-refresh').onclick();await until(()=>x.el('combat-title').textContent==='Torwache'&&!x.el('combat-notes').disabled);assert.equal(x.reads.at(-1),x.a.id);assert.equal(x.el('combat-load-status').hidden,true);
 }finally{x.cleanup();}
});
test('a superseded failure cannot clear or announce an error over a newer selection',async()=>{
 const x=await fixture();try{x.fail();x.hold();x.choose(x.a.id);await until(()=>x.waiting.length===1);x.choose(x.b.id);await tick();await tick();x.release();await tick();assert.equal(x.el('combat-title').textContent,'Keller');assert.deepEqual(x.messages,[]);assert.equal(x.el('combat-load-status').hidden,true);
 }finally{x.cleanup();}
});
test('late reads cannot populate a different scene or restore its encounter picker',async()=>{
 const x=await fixture();try{x.hold();x.choose(x.a.id);await until(()=>x.waiting.length===1);x.ui.combatContext(null,null);x.release();await tick();assert.equal(x.el('combat-panel').hidden,true);assert.equal(x.el('combat-history').children.length,0);assert.deepEqual(x.messages,[]);
 }finally{x.cleanup();}
});
test('a reply for a different encounter never becomes the editable selected encounter',async()=>{
 const x=await fixture();try{window.campaign.combat=async()=>({ok:true,value:x.store.combat(x.w.token,x.a.sceneId,x.a.id)});x.choose(x.b.id);await tick();await tick();assert.equal(x.el('combat-workspace').hidden,true);assert.equal(x.el('fighter-damage').disabled,true);assert.equal(x.el('combat-load-status').getAttribute('role'),'alert');assert.equal(x.writes.length,0);
 }finally{x.cleanup();}
});

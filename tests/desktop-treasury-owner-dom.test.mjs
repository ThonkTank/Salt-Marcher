import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';import {createRequire} from 'node:module';import {buildSync} from 'esbuild';import {parseHTML} from 'linkedom';
buildSync({stdin:{contents:"export * from './src/app/treasury-ui';export {initCommitControls} from './src/app/commit-confirmation';",resolveDir:process.cwd(),sourcefile:'treasury-owner.ts'},outfile:'.build/treasury-owner.cjs',bundle:true,platform:'node',format:'cjs'});
const require=createRequire(import.meta.url),tick=()=>new Promise(r=>setImmediate(r));async function until(check){for(let i=0;i<80;i++){if(check())return;await tick();}assert.ok(check(),'expected treasury state');}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise};}
async function fixture(t){
 const saved={window:globalThis.window,document:globalThis.document,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout},{window,document}=parseHTML(readFileSync('src/app/index.html','utf8'));Object.assign(globalThis,{window,document});for(const s of document.querySelectorAll('select'))Object.defineProperty(s,'value',{value:'',writable:true});
 const timers=[],writes=[],messages=[],book=(id,title)=>({id,revision:1,title,locationId:null,sceneId:null,combatId:null,items:[]}),books=new Map([['a',book('a','Alpha')],['b',book('b','Beta')]]),drafts=new Map(),ok=value=>({ok:true,value});let waitKeep=null,waitDiscard=null;
 globalThis.setTimeout=fn=>{const id=timers.length+1;timers.push({fn,id});return id;};globalThis.clearTimeout=()=>{};
 const local=new Map();window.localStorage={getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};
 window.campaign={treasures:async()=>ok({items:[...books.values()].map(t=>({...t,available:0})),next:null}),progress:async()=>ok({characters:[],notices:[]}),ledgerParties:async()=>ok([]),treasure:async(_token,id)=>ok(structuredClone(books.get(id))),treasuryDraft:async(_token,id)=>ok(drafts.get(id)??null),treasureHistory:async()=>ok({items:[],next:null}),
  keepTreasuryDraft:async(token,d,expected)=>{writes.push({token,d:structuredClone(d),expected});const waiting=waitKeep;waitKeep=null;if(waiting)await waiting.promise;drafts.set(d.treasureId,structuredClone(d));return ok();},
  discardTreasuryDraft:async(_token,id)=>{const waiting=waitDiscard;waitDiscard=null;if(waiting)await waiting.promise;drafts.delete(id);return ok();}};
 const filename=require.resolve('../.build/treasury-owner.cjs');delete require.cache[filename];const ui=require(filename);let active={token:'A',campaign:{id:'campaign-A'}};ui.initCommitControls(()=>active,(text,error)=>messages.push({text,error}));ui.initTreasury((text,error)=>messages.push({text,error}),async()=>{},async()=>{});ui.activateTreasury(active);await ui.openTreasury('a');
 const el=id=>document.getElementById(id),edit=v=>{el('treasury-title').value=v;el('treasury-title').oninput();},switchTo=()=>{active={token:'B',campaign:{id:'campaign-B'}};ui.activateTreasury(active);return ui.openTreasury('b');};
 t.after(()=>{ui.activateTreasury(null);Object.assign(globalThis,saved);});return{ui,el,edit,switchTo,timers,writes,messages,holdKeep(){waitKeep=deferred();return waitKeep;},holdDiscard(){waitDiscard=deferred();return waitDiscard;}};
}
test('a pending Alpha draft does not block Beta or become its next write basis',async t=>{
 const x=await fixture(t);x.edit('Alpha raw');const gate=x.holdKeep(),a=x.ui.flushTreasury();await until(()=>x.writes.length===1);const b=x.switchTo();await tick();assert.equal(x.el('treasury-title').value,'Beta');x.edit('Beta raw');gate.resolve();await a;await b;assert.equal(await x.ui.flushTreasury(),true);assert.equal(x.writes.at(-1).token,'B');assert.equal(x.writes.at(-1).d.treasureId,'b');assert.equal(x.writes.at(-1).expected,null);
});
test('an expired Alpha timer cannot save Beta input',async t=>{
 const x=await fixture(t);x.edit('Alpha raw');const old=x.timers.at(-1).fn;await x.ui.flushTreasury();await x.switchTo();x.edit('Beta raw');const n=x.writes.length;old();await tick();assert.equal(x.writes.length,n);assert.equal(await x.ui.flushTreasury(),true);assert.equal(x.writes.at(-1).d.title,'Beta raw');
});
test('a late discard cannot clear or reopen a different campaign editor',async t=>{
 const x=await fixture(t);x.edit('Alpha raw');await x.ui.flushTreasury();const gate=x.holdDiscard();x.el('treasury-reload').click();await tick();await x.switchTo();x.edit('Beta later');gate.resolve();await tick();await tick();assert.equal(x.el('treasury-title').value,'Beta later');assert.equal(await x.ui.flushTreasury(),true);assert.equal(x.writes.at(-1).d.treasureId,'b');
});
test('input typed while discarding remains in the current editor and gets a fresh draft basis',async t=>{
 const x=await fixture(t);x.edit('Before discard');await x.ui.flushTreasury();const gate=x.holdDiscard();x.el('treasury-reload').click();await tick();x.edit('  Later prose\r\n');gate.resolve();await tick();await tick();assert.equal(x.el('treasury-title').value,'  Later prose\r\n');assert.equal(await x.ui.flushTreasury(),true);assert.equal(x.writes.at(-1).expected,null);assert.equal(x.writes.at(-1).d.title,'  Later prose\r\n');
});

test('a post-commit Alpha read cannot replace Beta or erase its newer text',async t=>{
 const x=await fixture(t),gate=deferred(),original=window.campaign.treasures;let requested=false;
 window.campaign.executeProgress=async()=>({ok:true,value:{characters:[],notices:[],treasureId:'a',ledgerIds:[]}});
 window.campaign.treasures=async(token,...args)=>{if(token==='A'){requested=true;return gate.promise;}return original(token,...args);};
 x.edit('Confirmed Alpha');x.el('treasury-apply').click();await until(()=>requested);await x.switchTo();x.edit('Beta after commit');gate.resolve({ok:true,value:{items:[{id:'a',title:'Old response',revision:2,available:0}],next:null}});await tick();await tick();assert.equal(x.el('treasury-title').value,'Beta after commit');assert.equal(await x.ui.flushTreasury(),true);assert.equal(x.writes.at(-1).d.treasureId,'b');assert.ok(!x.messages.some(m=>m.text.startsWith('Schatzänderung gespeichert')));
});

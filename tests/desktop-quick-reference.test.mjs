import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {parseHTML} from 'linkedom';
const base='.build/realist-quick-reference',require=createRequire(import.meta.url);
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:base+'/store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
buildSync({entryPoints:['src/app/quick-reference-ui.ts'],outfile:base+'/ui.cjs',bundle:true,platform:'node',format:'cjs'});
const {CampaignStore}=require('../'+base+'/store.cjs'),tick=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function fixture(t){
 const root=mkdtempSync(path.join(tmpdir(),'quick-reference-')),store=new CampaignStore(path.join(root,'store.sqlite')),cam=store.create('References'),w=store.activate(cam.id),note={version:1,id:randomUUID(),revision:1,kind:'quest',title:'Alpha',readAloud:'  Public prose\r\n',gmNotes:'Private prose',relations:[],creatureId:null,deleted:false};
 const command=change=>({commandId:randomUUID(),campaignId:cam.id,token:w.token,change});store.changePreparation(command({kind:'note',expectedRevision:null,note}));store.changePreparation(command({kind:'note',expectedRevision:null,note:{...note,id:randomUUID(),title:'Beta'}}));store.executeLive({commandId:randomUUID(),campaignId:cam.id,token:w.token,action:{kind:'initialize',expectedRosterRevision:0}});
 const {window,document}=parseHTML(readFileSync('src/app/index.html','utf8')),saved={window:globalThis.window,document:globalThis.document,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};Object.assign(globalThis,{window,document});
 const timers=new Map();let timerId=0;globalThis.setTimeout=fn=>{timers.set(++timerId,fn);return timerId;};globalThis.clearTimeout=id=>timers.delete(id);
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this._value??this.options[0]?.value??'';},set(v){this._value=String(v);}});
 const query=document.querySelector.bind(document);document.querySelector=selector=>selector==='dialog:modal:not(#quick-reference)'?[...document.querySelectorAll('dialog')].find(d=>d.open&&d.id!=='quick-reference')??null:query(selector);
 const host=document.createElement('button');host.id='narrative-journal-open';document.getElementById('party-shortcut').after(host);
 const file=require.resolve('../'+base+'/ui.cjs');delete require.cache[file];const ui=require(file),messages=[],handoffs=[],reads=[];
 const x={store,w,note,command,window,document,ui,messages,handoffs,reads,drain:async()=>true,el:id=>document.getElementById(id)};
 const ok=fn=>{try{return{ok:true,value:fn()};}catch(e){return{ok:false,error:e.message};}};window.campaign={};for(const method of ['searchDesk','live','sceneDesk','pinSceneDesk'])window.campaign[method]=async(...args)=>ok(()=>store[method](...args));window.campaign.deskContent=async(...args)=>{reads.push(args);return ok(()=>store.deskContent(...args));};
 ui.initQuickReference((...args)=>messages.push(args),()=>x.drain(),async action=>handoffs.push(action));const dialog=x.el('quick-reference');dialog.open=false;dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};x.dialog=dialog;
 ui.activateQuickReference(w);x.el('quick-kind').value='world';x.el('quick-reference-open').click();await tick();assert.equal(x.el('quick-results').querySelectorAll('button:not(.quick-more)').length,2);
 x.submit=()=>x.el('quick-search-form').onsubmit({preventDefault(){}});t.after(async()=>{ui.activateQuickReference(w);await tick();Object.assign(globalThis,saved);store.close();rmSync(root,{recursive:true,force:true});});return x;
}
test('a removed search row cannot reopen its reference after the query changes',async t=>{
 const x=await fixture(t),old=x.el('quick-results').querySelector('button');x.el('quick-search').value='Beta';x.el('quick-search').oninput();old.onclick();await tick();assert.equal(x.reads.length,0);assert.doesNotMatch(x.el('quick-document').textContent,/Private prose/);
});
test('handoff rechecks the reviewed source after draining unsaved editor changes',async t=>{
 const x=await fixture(t);x.el('quick-results').querySelector('button').click();await tick();assert.equal(x.el('quick-document').querySelector('h2').textContent,'Alpha');
 x.drain=async()=>{x.store.changePreparation(x.command({kind:'note',expectedRevision:1,note:{...x.note,revision:2,readAloud:'New authored text'}}));return true;};x.el('quick-use-read-aloud').click();await tick();
 assert.equal(x.handoffs.length,0);assert.equal(x.dialog.open,true);assert.ok(x.messages.some(([message])=>message.includes('Inhalt geändert')));assert.equal(x.store.preparation(x.w.token).notes.find(n=>n.note.id===x.note.id).note.readAloud,'New authored text');
});
test('a cancelled Enter query cannot override a newer explicit reference selection',async t=>{
 const x=await fixture(t),held=deferred(),original=x.window.campaign.searchDesk;let first=true;x.window.campaign.searchDesk=(...args)=>{if(first){first=false;return held.promise;}return original(...args);};
 x.el('quick-search').oninput();x.submit();x.submit();await tick();x.el('quick-results').querySelectorAll('button:not(.quick-more)')[1].click();await tick();assert.equal(x.el('quick-document').querySelector('h2').textContent,'Beta');
 held.resolve(await original(x.w.token,'world','',0));await tick();assert.equal(x.el('quick-document').querySelector('h2').textContent,'Beta');
});

test('unchanged reference handoff keeps the exact authored text and scene identity',async t=>{
 const x=await fixture(t),scene=x.store.live(x.w.token).scene;x.el('quick-results').querySelector('button').click();await tick();
 const raw='  [Wache](dungeon-ref:note/'+x.note.id+')\r\n[[Vault note]]';x.note.readAloud=raw;x.store.changePreparation(x.command({kind:'note',expectedRevision:1,note:x.note}));x.el('quick-refresh').click();await tick();const unchanged=x.store.db.serialize();x.el('quick-use-read-aloud').click();await tick();
 assert.equal(x.handoffs.length,1);assert.equal(x.handoffs[0].content.note.readAloud,x.note.readAloud);assert.equal(x.handoffs[0].sceneId,scene.id);assert.equal(x.dialog.open,false);assert.ok(x.store.db.serialize().equals(unchanged));
});
test('pinning a reference uses the existing scene owner without changing notes, time or progress',async t=>{
 const x=await fixture(t),scene=x.store.live(x.w.token).scene,progress=x.store.progress(x.w.token),notes=x.store.preparation(x.w.token).notes;x.el('quick-results').querySelector('button').click();await tick();x.el('quick-pin').click();await tick();
 assert.equal(x.store.sceneDesk(x.w.token,scene.id).pins[0].ref.id,x.note.id);assert.match(x.el('quick-pin').textContent,/Vom Szenentisch lösen/);assert.deepEqual(x.store.live(x.w.token).scene.clock,scene.clock);assert.deepEqual(x.store.progress(x.w.token),progress);assert.deepEqual(x.store.preparation(x.w.token).notes,notes);
});

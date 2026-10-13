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
for(const [entry,out] of [['src/app/storage/store.ts','desk-search-store'],['src/app/scene-desk-ui.ts','desk-search-ui']])buildSync({entryPoints:[entry],outfile:'.build/'+out+'.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(check){for(let i=0;i<60;i++){if(check())return;await tick();}assert.ok(check(),'Expected search state did not arrive');}
async function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),'desk-search-')),{CampaignStore}=require('../.build/desk-search-store.cjs'),store=new CampaignStore(root+'/workbench.sqlite');
 const campaign=store.create('Suche'),w=store.activate(campaign.id),command=action=>({commandId:randomUUID(),token:w.token,campaignId:campaign.id,action});
 const scene=store.executeLive(command({kind:'initialize',expectedRosterRevision:store.live(w.token).rosterRevision})).scene;
 for(const prefix of ['Hafen','Wald'])for(let i=0;i<65;i++)store.changePreparation({...command(null),change:{kind:'note',expectedRevision:null,note:{version:1,id:randomUUID(),revision:1,kind:'npc',title:prefix+' '+String(i).padStart(2,'0'),readAloud:'',gmNotes:'Original\r\n',relations:[],creatureId:null,deleted:false}}});
 const saved={window:globalThis.window,document:globalThis.document},{window,document}=parseHTML(readFileSync('src/app/index.html','utf8'));Object.assign(globalThis,{window,document});
 for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{value:'world',writable:true});
 const response=fn=>{try{return{ok:true,value:fn()};}catch(e){return{ok:false,error:e.message};}};
 const calls=[],waiting=[];let hold=false;
 window.campaign={sceneDesk:async(t,id)=>response(()=>store.sceneDesk(t,id)),searchDesk:async(t,kind,query,offset)=>{calls.push({kind,query,offset});const result=response(()=>store.searchDesk(t,kind,query,offset));if(hold){hold=false;return new Promise(resolve=>waiting.push(()=>resolve(result)));}return result;},deskContent:async(t,ref)=>response(()=>store.deskContent(t,ref)),preparationDraft:async(t,kind,id)=>response(()=>store.preparationDraft(t,kind,id))};
 delete require.cache[require.resolve('../.build/desk-search-ui.cjs')];const ui=require('../.build/desk-search-ui.cjs');ui.initSceneDesk(()=>{},async()=>{},async()=>{});ui.sceneDeskContext(w,scene);await tick();await tick();
 const el=id=>document.getElementById(id),query=text=>{el('desk-search').value=text;el('desk-search').dispatchEvent(new window.Event('input'));},area=kind=>{el('desk-search-kind').value=kind;el('desk-search-kind').dispatchEvent(new window.Event('change'));},submit=()=>el('desk-search-form').onsubmit({preventDefault(){}}),titles=()=>Array.from(document.querySelectorAll('#desk-results > div button:first-child'),b=>b.textContent);
 return{store,ui,w,scene,el,query,area,submit,titles,calls,hold:()=>{hold=true;},release:()=>waiting.shift()(),waiting,cleanup(){ui.sceneDeskContext(null,null);Object.assign(globalThis,saved);store.close();rmSync(root,{recursive:true,force:true});}};
}
test('query changes restart pagination from zero and retain the open editor',async()=>{
 const x=await fixture();try{x.query('Hafen');x.submit();await until(()=>x.titles().length===40);x.el('desk-results').querySelector('button').onclick();await until(()=>!x.el('desk-editor').hidden);const title=x.el('desk-fields').querySelector('input'),editor=x.el('desk-fields').firstChild;
 x.query('Wald');assert.equal(x.titles().length,0);assert.equal(x.el('desk-more').hidden,true);assert.equal(x.el('desk-fields').firstChild,editor);assert.equal(title.value,'Hafen 00');x.el('desk-more').onclick();assert.equal(x.calls.length,1);
 x.submit();await until(()=>x.titles().length===40);assert.equal(x.calls[1].offset,0);x.el('desk-more').onclick();await until(()=>x.titles().length===65);assert.equal(new Set(x.titles()).size,65);assert(x.titles().every(t=>t.startsWith('NPC · Wald')));assert.match(x.el('desk-search-status').textContent,/65 Treffer/);
 }finally{x.cleanup();}
});
test('a delayed search cannot restore results after text or search area changes',async()=>{
 const x=await fixture();try{x.query('Hafen');x.hold();x.submit();await until(()=>x.waiting.length===1);x.query('Wald');x.release();await tick();assert.equal(x.titles().length,0);assert.equal(x.el('desk-more').hidden,true);
 x.hold();x.submit();await until(()=>x.waiting.length===1);x.area('creature');x.release();await tick();assert.equal(x.titles().length,0);assert.equal(x.el('desk-more').hidden,true);assert.match(x.el('desk-search-status').textContent,/Suche geändert/);
 }finally{x.cleanup();}
});
test('rapid More clicks load a page once and an old group reply cannot populate a new desk',async()=>{
 const x=await fixture();try{x.query('Hafen');x.submit();await until(()=>x.titles().length===40);x.hold();x.el('desk-more').onclick();x.el('desk-more').onclick();await until(()=>x.waiting.length===1);assert.equal(x.calls.length,2);assert.equal(x.el('desk-more').disabled,true);x.release();await until(()=>x.titles().length===65);assert.equal(new Set(x.titles()).size,65);
 x.hold();x.submit();await until(()=>x.waiting.length===1);x.ui.sceneDeskContext(x.w,{...x.scene,id:'another-scene'});x.release();await tick();assert.equal(x.titles().length,0);assert.equal(x.el('desk-more').hidden,true);
 }finally{x.cleanup();}
});
test('failed replacement searches do not leave actionable results from the previous query',async()=>{
 const x=await fixture();try{x.query('Hafen');x.submit();await until(()=>x.titles().length===40);x.query('Wald');x.el('desk-search-kind').value='invalid';x.submit();await until(()=>x.el('desk-search-status').textContent.includes('fehlgeschlagen'));assert.equal(x.titles().length,0);assert.equal(x.el('desk-more').hidden,true);x.area('world');x.submit();await until(()=>x.titles().length===40);assert(x.titles().every(t=>t.startsWith('NPC · Wald')));
 }finally{x.cleanup();}
});
test('a failed continuation retains its page cursor for an explicit retry',async()=>{
 const x=await fixture();try{x.query('Wald');x.submit();await until(()=>x.titles().length===40);const original=window.campaign.searchDesk;window.campaign.searchDesk=async()=>({ok:false,error:'Lesen unterbrochen'});x.el('desk-more').onclick();await until(()=>x.el('desk-search-status').textContent.includes('fehlgeschlagen'));assert.equal(x.titles().length,40);assert.equal(x.el('desk-more').hidden,false);assert.equal(x.el('desk-more').disabled,false);window.campaign.searchDesk=original;x.el('desk-more').onclick();await until(()=>x.titles().length===65);assert.equal(x.calls.at(-1).offset,40);assert.equal(new Set(x.titles()).size,65);
 }finally{x.cleanup();}
});

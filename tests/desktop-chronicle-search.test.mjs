import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {parseHTML} from 'linkedom';
import {buildSync} from 'esbuild';
const require=createRequire(import.meta.url);
buildSync({entryPoints:[process.env.CHRONICLE_UI_SOURCE??'src/app/chronicle-ui.ts'],outfile:'.build/chronicle-dom.cjs',bundle:true,platform:'node',format:'cjs'});
const tick=()=>new Promise(r=>setImmediate(r));
const entry=title=>({id:title,recordedAt:new Date(1).toISOString(),category:'party',title,summary:'',people:[],scene:null,location:null});
function fixture(){
 const saved={window:globalThis.window,document:globalThis.document},{window,document}=parseHTML(readFileSync('src/app/index.html','utf8'));Object.assign(globalThis,{window,document});
 const el=id=>document.getElementById(id);Object.defineProperty(el('chronicle-category'),'value',{value:'all',writable:true});el('chronicle-search').value='';const pending=[],calls=[],exports=[];
 window.campaign={chronicle:async(token,category,search)=>{calls.push({token,category,search});return new Promise(resolve=>pending.push(resolve));},exportChronicle:async(...args)=>{exports.push(args);return{ok:true,value:{cancelled:false}};}};
 delete require.cache[require.resolve('../.build/chronicle-dom.cjs')];const ui=require('../.build/chronicle-dom.cjs');ui.initChronicle(()=>{});ui.activateChronicle({token:'one'});
 const answer=(title,which=0)=>{const done=pending.splice(which,1)[0];done({ok:true,value:{campaignName:'Test',entries:[entry(title)],truncated:false}});};
 return{ui,el,pending,calls,exports,answer,query(text){el('chronicle-search').value=text;el('chronicle-search').oninput();},cleanup(){ui.activateChronicle(null);Object.assign(globalThis,saved);}};
}
test('search and category reach Core; typing supersedes the old result before its reply arrives',async()=>{
 const x=fixture();try{const first=x.ui.openChronicle();assert.equal(x.el('chronicle-export').disabled,true);x.query('Bronze');x.answer('Alt');await first;assert.equal(x.el('chronicle-list').childElementCount,0);assert.equal(x.el('chronicle-export').disabled,true);
 const next=x.ui.openChronicle();assert.deepEqual(x.calls.at(-1),{token:'one',category:'all',search:'Bronze'});x.answer('Bronzeschlüssel');await next;assert.match(x.el('chronicle-list').textContent,/Bronzeschlüssel/);assert.equal(x.el('chronicle-export').disabled,false);
 x.el('chronicle-category').value='party';x.el('chronicle-category').onchange();assert.equal(x.calls.at(-1).category,'party');x.answer('Bronzeschlüssel');await tick();x.el('chronicle-export').onclick();await tick();assert.deepEqual(x.exports,[['one','party','Bronze']]);
 }finally{x.cleanup();}
});
test('a failed refresh replaces old events with an alert and blocks stale exports',async()=>{
 const x=fixture();try{let task=x.ui.openChronicle();x.answer('Alt');await task;task=x.ui.openChronicle();assert.equal(x.el('chronicle-list').childElementCount,0);x.pending.shift()({ok:false,error:'Lesen unterbrochen'});await task;assert.match(x.el('chronicle-list').querySelector('[role=alert]').textContent,/Lesen unterbrochen/);assert.equal(x.el('chronicle').getAttribute('aria-busy'),'false');assert.equal(x.el('chronicle-export').disabled,true);x.el('chronicle-export').onclick();await tick();assert.equal(x.exports.length,0);
 }finally{x.cleanup();}
});
test('late results or failures from another campaign cannot overwrite its successor',async()=>{
 const x=fixture();try{const old=x.ui.openChronicle();x.ui.activateChronicle({token:'two'});const next=x.ui.openChronicle();x.answer('Neue Kampagne',1);await next;x.pending.shift()({ok:false,error:'Alter Fehler'});await old;assert.match(x.el('chronicle-list').textContent,/Neue Kampagne/);assert.equal(x.el('chronicle-list').querySelector('[role=alert]'),null);assert.equal(x.el('chronicle').getAttribute('aria-busy'),'false');
 }finally{x.cleanup();}
});
test('rapid typing coalesces reads but immediately invalidates accepted results',async()=>{
 const x=fixture();try{const task=x.ui.openChronicle();x.answer('Alt');await task;for(const q of ['B','Br','Bronze'])x.query(q);assert.equal(x.calls.length,1);assert.equal(x.el('chronicle-list').childElementCount,0);await new Promise(r=>setTimeout(r,200));assert.equal(x.calls.length,2);assert.equal(x.calls.at(-1).search,'Bronze');x.answer('Bronzeschlüssel');await tick();assert.match(x.el('chronicle-list').textContent,/Bronzeschlüssel/);
 }finally{x.cleanup();}
});

test('an unavailable native bridge shows its usable cause without internal method names',async()=>{
 const x=fixture();try{const task=x.ui.openChronicle();x.pending.shift()({ok:false,error:"Error invoking remote method 'campaign:chronicle': Error: Quelle nicht lesbar"});await task;const text=x.el('chronicle-list').querySelector('[role=alert]').textContent;assert.match(text,/Quelle nicht lesbar/);assert.doesNotMatch(text,/campaign:|remote method/);assert.equal(x.el('chronicle-export').disabled,true);
 }finally{x.cleanup();}
});

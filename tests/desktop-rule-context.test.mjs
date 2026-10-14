import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {parseHTML} from 'linkedom';
const require=createRequire(import.meta.url);
buildSync({entryPoints:['src/app/rule-reference-ui.ts'],outfile:'.build/rule-context-ui.cjs',bundle:true,platform:'node',format:'cjs'});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(check){for(let i=0;i<70;i++){if(check())return;await tick();}assert(check(),'Expected rule reference state');}
async function fixture(){
 const previous={window:globalThis.window,document:globalThis.document},{window,document}=parseHTML('<html><body><section id="scene-preparation-panel"></section></body></html>');Object.assign(globalThis,{window,document});
 const notes=['Festhalten','Deckung','Sichtschutz'].map((title,i)=>({id:'rule-'+i,kind:'rule',title,revision:1,readAloud:'Regel '+title,gmNotes:'GM '+title}));
 const pin=note=>({noteId:note.id,sourceRevision:1,title:note.title,readAloud:note.readAloud,gmNotes:note.gmNotes,currentRevision:1,stale:false,unavailable:false});
 const scenes=new Map([['A',{sceneId:'A',revision:2,pins:notes.slice(0,2).map(pin)}],['B',{sceneId:'B',revision:0,pins:[]}]]),commands=[],messages=[],waiting=[];
 let holdRead=null,holdWrite=false,failRead=null,failSearch=false;
 const result=value=>({ok:true,value:structuredClone(value)});
 window.campaign={
  sceneChecks:async(token,sceneId)=>({ok:true,value:{sceneId,revision:0,checks:[],truncated:false}}),sceneRules:async(t,id)=>{const response=failRead===id?{ok:false,error:'Regelquelle nicht lesbar'}:result(scenes.get(id));if(holdRead===id){holdRead=null;return new Promise(resolve=>waiting.push(()=>resolve(response)));}return response;},
  preparation:async(t,q)=>failSearch?{ok:false,error:'Regelsuche nicht lesbar'}:result({notes:notes.filter(n=>n.title.includes(q)).map(note=>({trashed:false,note}))}),
  executeSceneRule:async c=>{commands.push(structuredClone(c));const state=scenes.get(c.sceneId);if(c.expectedRevision!==state.revision)return{ok:false,error:'Regelreferenzen dieser Scene wurden geändert.'};const next={...state,revision:state.revision+1,pins:[...state.pins,pin(notes.find(n=>n.id===c.action.noteId))]};scenes.set(c.sceneId,next);const response=result(next);if(holdWrite){holdWrite=false;return new Promise(resolve=>waiting.push(()=>resolve(response)));}return response;},
 };
 delete require.cache[require.resolve('../.build/rule-context-ui.cjs')];const ui=require('../.build/rule-context-ui.cjs');ui.initRuleReferences((text)=>messages.push(text));for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{value:'',writable:true});ui.activateRuleReferences({campaign:{id:'campaign'},token:'token'});await ui.refreshRuleReferences('A');
 const el=id=>document.getElementById(id),find=title=>Array.from(document.querySelectorAll('#live-rule-results article')).find(card=>card.textContent.includes(title))?.querySelector('button');
 return{ui,el,find,commands,messages,scenes,holdRead:id=>{holdRead=id;},holdWrite:()=>{holdWrite=true;},failRead:id=>{failRead=id;},failSearch:value=>{failSearch=value;},release:()=>waiting.shift()(),waiting,input:q=>{el('live-rule-search').value=q;el('live-rule-search').oninput();},cleanup(){ui.activateRuleReferences({campaign:{id:'closed'},token:'closed'});Object.assign(globalThis,previous);}};
}
test('a late scene read cannot replace the revision used for the visible group',async()=>{
 const x=await fixture();try{x.holdRead('A');const old=x.ui.refreshRuleReferences('A');await until(()=>x.waiting.length===1);await x.ui.refreshRuleReferences('B');x.release();await old;x.find('Sichtschutz').click();await until(()=>x.commands.length===1);assert.equal(x.commands[0].sceneId,'B');assert.equal(x.commands[0].expectedRevision,0);await tick();assert.match(x.el('live-rule-pins').textContent,/Sichtschutz/);
 }finally{x.cleanup();}
});
test('a late pin acknowledgement cannot poison another group or its next command',async()=>{
 const x=await fixture();try{x.holdWrite();x.find('Sichtschutz').click();await until(()=>x.waiting.length===1);await x.ui.refreshRuleReferences('B');x.release();await tick();await tick();x.find('Sichtschutz').click();await until(()=>x.commands.length===2);assert.equal(x.commands[1].sceneId,'B');assert.equal(x.commands[1].expectedRevision,0);await tick();assert.equal(x.scenes.get('A').pins.length,3);assert.equal(x.scenes.get('B').pins.length,1);
 }finally{x.cleanup();}
});
test('an unreadable scene clears the old rule cards and exposes an explicit retry',async()=>{
 const x=await fixture();try{x.failRead('B');await x.ui.refreshRuleReferences('B');assert.equal(x.el('live-rule-pins').querySelectorAll('article').length,0);assert.match(x.el('live-rule-pins').querySelector('[role=alert]')?.textContent??'',/nicht lesbar/);assert.equal(x.el('live-rule-results').querySelectorAll('button').length,0);x.failRead(null);await x.ui.refreshRuleReferences('B');assert.match(x.el('live-rule-pins').textContent,/Noch keine Regel/);assert(x.find('Sichtschutz'));
 }finally{x.cleanup();}
});
test('typing invalidates old actionable rule matches; a failed search remains locally visible',async()=>{
 const x=await fixture();try{x.failSearch(true);x.input('Unbekannt');assert.equal(x.el('live-rule-results').querySelectorAll('button').length,0);await new Promise(r=>setTimeout(r,220));assert.match(x.el('live-rule-results').querySelector('[role=alert]')?.textContent??'',/nicht lesbar/);assert.equal(x.el('live-rule-results').querySelectorAll('button').length,0);x.failSearch(false);x.input('Sichtschutz');await new Promise(r=>setTimeout(r,220));assert(x.find('Sichtschutz'));
 }finally{x.cleanup();}
});

test('a late dice acknowledgement cannot replace the current group check revision',async()=>{
 const x=await fixture();try{const writes=[];let release;window.campaign.executeSceneCheck=async c=>{writes.push(c);if(writes.length===1)return new Promise(resolve=>{release=()=>resolve({ok:true,value:{sceneId:'A',revision:1,checks:[],truncated:false}});});return{ok:true,value:{sceneId:'B',revision:1,checks:[],truncated:false}};};
 x.el('live-check-label').select=()=>{};const submit=()=>{x.el('live-check-label').value='Wahrnehmung';x.el('live-check-mode').value='normal';x.el('live-check-modifier').value='2';x.el('live-check-dc').value='10';x.el('live-check-form').onsubmit({preventDefault(){}});};
 submit();await until(()=>!!release);await x.ui.refreshRuleReferences('B');release();await tick();await tick();submit();await until(()=>writes.length===2);assert.equal(writes[1].sceneId,'B');assert.equal(writes[1].expectedRevision,0);await tick();assert.deepEqual(x.messages,['GM-Probe gewürfelt und bei der Gruppe gespeichert.']);
 }finally{x.cleanup();}
});

test('targeted save acknowledgements remain bound to the group and never call an old target callback',async()=>{
 const x=await fixture();try{const writes=[],callbacks=[];let release;window.campaign.executeSceneCheck=async c=>{writes.push(c);const reply={ok:true,value:{sceneId:c.sceneId,revision:1,checks:[{id:c.sceneId,label:'Feueratem',actor:'Ada',sceneInstantMs:'0',mode:'normal',rolls:[14],modifier:2,total:16,dc:15,outcome:'success'}],truncated:false}};if(writes.length===1)return new Promise(resolve=>{release=()=>resolve(reply);});return reply;};
 const action={label:'Feueratem',actor:'Ada',modifier:2,mode:'normal',dc:15},first=x.ui.rollSceneCheck(action,check=>callbacks.push(check.id));await until(()=>!!release);await x.ui.refreshRuleReferences('B');release();await first;assert.deepEqual(callbacks,[]);await x.ui.rollSceneCheck(action,check=>callbacks.push(check.id));assert.equal(writes[1].sceneId,'B');assert.equal(writes[1].expectedRevision,0);assert.deepEqual(callbacks,['B']);assert.deepEqual(x.messages,['Rettungswurf ausgeführt und bei der Gruppe gespeichert.']);
 }finally{x.cleanup();}
});
test('a targeted save reply for another group cannot poison the next revision or reach the target',async()=>{
 const x=await fixture();try{const writes=[],callbacks=[];window.campaign.executeSceneCheck=async c=>{writes.push(c);return{ok:true,value:{sceneId:writes.length===1?'foreign':'A',revision:writes.length===1?99:1,checks:[{id:'rolled',label:'Feueratem',actor:'Ada',sceneInstantMs:'0',mode:'normal',rolls:[14],modifier:2,total:16,dc:15,outcome:'success'}],truncated:false}};};const action={label:'Feueratem',actor:'Ada',modifier:2,mode:'normal',dc:15};await x.ui.rollSceneCheck(action,c=>callbacks.push(c.id));assert.deepEqual(callbacks,[]);assert.match(x.messages[0],/anderen Gruppe/);await x.ui.rollSceneCheck(action,c=>callbacks.push(c.id));assert.equal(writes[1].expectedRevision,0);assert.deepEqual(callbacks,['rolled']);
 }finally{x.cleanup();}
});

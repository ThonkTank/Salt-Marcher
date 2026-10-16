import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {parseHTML} from 'linkedom';
const base='.build/planner-session-review-handler',require=createRequire(import.meta.url);
mkdirSync(base,{recursive:true});
buildSync({entryPoints:['src/app/session-ui.ts'],outfile:base+'/ui.cjs',bundle:true,platform:'node',format:'cjs'});
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
const waitFor=async predicate=>{const deadline=Date.now()+2000;while(!predicate()&&Date.now()<deadline)await new Promise(r=>setTimeout(r,5));assert.equal(predicate(),true);};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const result=value=>({ok:true,value:structuredClone(value)});
const run=id=>({id,planId:'plan',profileRevision:0,seed:id,budget:500,usedXp:100,warnings:[],proposals:[{id:'proposal-'+id,index:0,revision:1,title:'Wache '+id,notes:'  GM\r\n',readAloud:'Hallo',noteIds:[],locationId:null,acceptedVisitId:null,encounter:{entries:[],sources:[],assessment:{difficulty:'easy',adjustedXp:100}},reward:{poolXp:25,items:[]}}]});
function setup(t){
 const {window,document}=parseHTML(readFileSync('src/app/index.html','utf8')),previous={window:globalThis.window,document:globalThis.document,HTMLInputElement:globalThis.HTMLInputElement};
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return this._value??'';},set(v){this._value=v;},configurable:true});
 const storage=new Map();window.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
 Object.assign(globalThis,{window,document,HTMLInputElement:window.HTMLInputElement});delete require.cache[require.resolve('../'+base+'/ui.cjs')];
 const x={window,document,commands:[],messages:[],plan:{id:'plan',revision:1,scenes:[]},workspace:{token:'token',campaign:{id:'campaign'}},flush:async()=>true,read:async id=>run(id)};
 let profile={planId:'plan',revision:0,party:[],adventureDayFraction:'0.5',seed:'seed'};
 const view=()=>({profile,visits:[],groups:[],encounters:[]});
 window.campaign={session:async()=>result(view()),progress:async()=>result({characters:[]}),encounterTables:async()=>result([]),sessionRuns:async()=>result([]),npcs:async()=>result({rows:[],total:0}),generationSources:async()=>result({factions:[]}),sessionRun:async(_,id)=>result(await x.read(id)),executeSession:async cmd=>{x.commands.push(cmd);if(cmd.action.kind==='profile')profile={...cmd.action.profile,revision:profile.revision+1};return result(view());}};
 x.ui=require('../'+base+'/ui.cjs');x.ui.initSession((text,error)=>x.messages.push({text,error}),()=>x.flush(),async()=>{},async()=>{});
 for(const dialog of document.querySelectorAll('dialog')){dialog.open=false;dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};}
 x.context=()=>x.ui.sessionContext(x.workspace,x.plan,null,{locations:[],notes:[]});
 x.history=id=>{const history=document.getElementById('session-history');history.value=id;history.onchange();};
 x.review=()=>{const box=document.querySelector('#session-preview input[type=checkbox]');assert.ok(box);box.checked=true;box.onchange();document.getElementById('session-review-selection').click();};
 x.confirm=()=>document.getElementById('session-selection-confirm').click();
 t.after(async()=>{await x.ui.sessionContext(null,null,null,null);await settle();Object.assign(globalThis,previous);});return x;
}
test('the real session handler sends the reviewed plan and proposal revisions',async t=>{const x=setup(t);await x.context();x.history('first');await settle();x.review();x.confirm();await waitFor(()=>x.commands.length===1);assert.deepEqual(x.commands.map(c=>c.action),[{kind:'accept-proposals',planId:'plan',expectedPlanRevision:1,runId:'first',proposals:[{index:0,expectedRevision:1}]}]);});
test('a profile flush that changes the plan revision cannot promote the new revision into batch approval',async t=>{const x=setup(t);await x.context();x.history('first');await settle();const seed=x.document.getElementById('session-seed');seed.value='new seed';seed.dispatchEvent(new x.window.Event('input',{bubbles:true}));x.flush=async()=>{x.plan.revision=2;return true;};x.review();x.confirm();await waitFor(()=>x.messages.some(m=>m.error&&m.text.includes('Auswahl erneut prüfen')));assert.equal(x.plan.revision,2);assert.deepEqual(x.commands.map(c=>c.action.kind),['profile']);await waitFor(()=>x.document.querySelector('#session-selection-dialog [role=alert]').textContent.includes('Auswahl erneut prüfen'));assert.equal(x.document.getElementById('session-selection-dialog').open,true);x.confirm();await settle();assert.deepEqual(x.commands.map(c=>c.action.kind),['profile']);assert.match(x.document.querySelector('#session-selection-dialog [role=alert]').textContent,/erneut prüfen/);});
test('a delayed post-acceptance run read cannot overwrite the newly selected run',async t=>{const x=setup(t),reply=deferred();await x.context();x.history('first');await settle();x.read=async id=>id==='first'?reply.promise:run(id);x.review();x.confirm();await waitFor(()=>x.commands.length===1);x.history('second');await settle();assert.match(x.document.getElementById('session-preview').textContent,/Wache second/);reply.resolve(run('first'));await settle();assert.match(x.document.getElementById('session-preview').textContent,/Wache second/);assert.doesNotMatch(x.document.getElementById('session-preview').textContent,/Wache first/);});

test('batch acceptance shows the actual storage error in its confirmation dialog',async t=>{const x=setup(t);await x.context();x.history('first');await settle();x.window.campaign.executeSession=async()=>({ok:false,error:'Katalog wurde geändert. Vorschau neu erzeugen.'});x.window.campaign.commitStatus=async()=>result({outcome:'not-applied'});x.review();x.confirm();await waitFor(()=>x.document.getElementById('session-selection-dialog').textContent.includes('Katalog wurde geändert'));assert.equal(x.document.getElementById('session-selection-dialog').open,true);assert.equal(x.document.getElementById('session-selection-confirm').disabled,false);});

test('session composition uses the effective preset unless the GM explicitly overrides a preference',async t=>{
 const x=setup(t),requests=[];await x.context();x.window.campaign.generatorRegistry=async()=>result({effectiveId:'custom',presets:[{id:'custom',config:{generationDefaults:{amount:'many',balance:'varied',diversity:'high'}}}]});
 x.window.campaign.generateSession=async(_,request)=>{requests.push(request);return result(run('generated'));};x.document.getElementById('session-preview').scrollIntoView=()=>{};
 x.document.getElementById('session-generate-form').dispatchEvent(new x.window.Event('submit',{cancelable:true}));await waitFor(()=>requests.length===1);assert.deepEqual(Object.fromEntries(['amount','balance','diversity'].map(k=>[k,requests[0].encounter[k]])),{amount:'many',balance:'varied',diversity:'high'});await settle();
 x.document.getElementById('session-amount').value='few';x.document.getElementById('session-generate-form').dispatchEvent(new x.window.Event('submit',{cancelable:true}));await waitFor(()=>requests.length===2);assert.equal(requests[1].encounter.amount,'few');assert.equal(requests[1].encounter.balance,'varied');
});

test('publishing a newer plan revision refreshes day metadata without replacing live profile inputs',async t=>{const x=setup(t);await x.context();x.document.getElementById('session-free-party').click();const input=x.document.querySelector('#session-party-levels input');input.value='3';input.oninput();x.plan={...x.plan,revision:2};await x.context();assert.equal(x.document.querySelector('#session-party-levels input'),input);assert.equal(input.isConnected,true);assert.equal(input.value,'3');assert.match(x.document.getElementById('session-day-plan').textContent,/Abenteuertag/);});

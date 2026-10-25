import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
import {parseHTML} from 'linkedom';
import {activateAutonomy,initAutonomy,openAutonomy} from '../../../src/app/runtime/autonomy-ui';
import {standardNeeds,type AutonomyAction,type AutonomyView} from '../../../src/app/runtime/autonomy-contracts';

const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
test('time conflict UI exposes facts and only reasoned resume or skip actions',async()=>{
 const parsed=parseHTML(readFileSync(join(process.cwd(),'src/app/workspace/index.html'),'utf8')),priorDocument=globalThis.document,priorWindow=globalThis.window,status:{text:string;error?:boolean}[]=[],actions:AutonomyAction[]=[];
 const actor={id:'npc',revision:1,enabled:true,paused:true,role:'',needs:standardNeeds(),jobPriorities:{},assignedJobId:null,allowConflict:false,defense:12,attackBonus:0,maxHpLossPercent:10,cursor:1,offsetSeconds:0,jobId:null,progressSeconds:0,pending:'NPC-Stand liegt vor der Zeit dieser Gruppe. Zeitkonflikt als GM klären.',name:'Wache',locationId:'place',locationName:'Hinterland',positionRevision:1,dungeonPosition:null,remaining:0},decision={id:'decision',text:actor.pending,actorId:actor.id,intervalId:'interval',kind:'decision',facts:{epochId:'epoch',actorInstantMs:'7200000',sceneInstantMs:'3600000'}};
 let view:AutonomyView={actors:[actor],available:[{id:'npc',name:'Wache',locationId:'place'}],groups:[],locations:[{id:'place',name:'Hinterland'}],routes:[],rooms:[],features:[],jobs:[],logs:[decision],confirmed:'7200000',pendingActors:0};
 try{
  Object.assign(globalThis,{document:parsed.document,window:parsed.window});(parsed.window as any).campaign={autonomy:async()=>({ok:true,value:view}),executeAutonomy:async(command:any)=>{actions.push(command.action);view={...view,actors:view.actors.map(value=>value.id==='npc'?{...value,revision:value.revision+1,paused:false,pending:null}:value),logs:[{id:'resolved',text:'GM klärt ausstehende Autonomie: resume – '+command.action.reason,actorId:'npc',intervalId:'manual',kind:'override',facts:{}},...view.logs]};return{ok:true,value:{view,progressed:0,pending:0}};}};
  initAutonomy((text,error)=>status.push({text,error}));activateAutonomy({token:'token',campaign:{id:'campaign'}} as any);await openAutonomy();const host=parsed.document.getElementById('autonomy-actors')!,buttons=()=>[...host.querySelectorAll('button')];
  assert.match(host.textContent,/60 Minuten nach der Zeit dieser Gruppe/);assert.match(host.textContent,/Aktueller Worldstand: Hinterland/);assert.equal(buttons().some(button=>button.textContent==='Fortsetzen'),false);assert.ok(buttons().some(button=>button.textContent==='Mit aktuellem Worldstand fortsetzen'));assert.ok(buttons().some(button=>button.textContent==='Zeitraum als GM auslassen'));
  buttons().find(button=>button.textContent==='Mit aktuellem Worldstand fortsetzen')!.click();await tick();assert.match(status.at(-1)?.text??'',/begründen/);assert.equal(actions.length,0);
  (parsed.document.getElementById('autonomy-decision-reason') as HTMLInputElement).value='Aktuellen Worldstand geprüft';buttons().find(button=>button.textContent==='Mit aktuellem Worldstand fortsetzen')!.click();await tick();assert.deepEqual(actions[0],{kind:'accept-pending',actorId:'npc',expectedRevision:1,resolution:'resume',reason:'Aktuellen Worldstand geprüft'});assert.equal(buttons().some(button=>button.textContent==='Mit aktuellem Worldstand fortsetzen'),false);
 }finally{Object.assign(globalThis,{document:priorDocument,window:priorWindow});}
});

test('catch-up exposes progress before the first command completes',async()=>{
 const parsed=parseHTML(readFileSync(join(process.cwd(),'src/app/workspace/index.html'),'utf8')),priorDocument=globalThis.document,priorWindow=globalThis.window,actor={id:'npc',revision:1,enabled:true,paused:false,role:'',needs:standardNeeds(),jobPriorities:{},assignedJobId:null,allowConflict:false,defense:12,attackBonus:0,maxHpLossPercent:10,cursor:0,offsetSeconds:0,jobId:null,progressSeconds:0,pending:null,name:'Wache',locationId:null,locationName:'Unplatziert',positionRevision:null,dungeonPosition:null,remaining:1};
 let release:(value:any)=>void=()=>{},view:AutonomyView={actors:[actor],available:[{id:'npc',name:'Wache',locationId:null}],groups:[],locations:[],routes:[],rooms:[],features:[],jobs:[],logs:[],confirmed:'900000',pendingActors:1};
 try{
  Object.assign(globalThis,{document:parsed.document,window:parsed.window});(parsed.window as any).campaign={autonomy:async()=>({ok:true,value:view}),executeAutonomy:()=>new Promise(resolve=>{release=resolve;})};initAutonomy(()=>{});activateAutonomy({token:'token',campaign:{id:'campaign'}} as any);await openAutonomy();
  (parsed.document.getElementById('autonomy-catchup') as HTMLButtonElement).click();await tick();assert.match(parsed.document.getElementById('autonomy-progress')!.textContent,/Nachholen gestartet/);assert.equal((parsed.document.getElementById('autonomy-catchup') as HTMLButtonElement).disabled,true);
  view={...view,actors:[{...actor,revision:2,cursor:1,remaining:0}],pendingActors:0};release({ok:true,value:{view,progressed:1,pending:0}});const button=parsed.document.getElementById('autonomy-catchup') as HTMLButtonElement,deadline=Date.now()+1000;while(button.disabled&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,0));assert.equal(button.disabled,false);assert.match(parsed.document.getElementById('autonomy-progress')!.textContent,/1 atomare NPC-Schritte/);
 }finally{Object.assign(globalThis,{document:priorDocument,window:priorWindow});}
});

test('large actor lists can be narrowed by text and operational state',async()=>{
 const parsed=parseHTML(readFileSync(join(process.cwd(),'src/app/workspace/index.html'),'utf8')),priorDocument=globalThis.document,priorWindow=globalThis.window,actors=Array.from({length:200},(_,index)=>({id:'npc-'+index,revision:1,enabled:index%17!==0,paused:index%19===0,role:index%3===0?'Wache':'',needs:standardNeeds(),jobPriorities:{},assignedJobId:null,allowConflict:false,defense:12,attackBonus:0,maxHpLossPercent:10,cursor:0,offsetSeconds:0,jobId:null,progressSeconds:0,pending:null,name:index===137?'Spezielle Hafenwache':'NPC '+String(index+1).padStart(3,'0'),locationId:null,locationName:'Unplatziert',positionRevision:null,dungeonPosition:null,remaining:index%23===0?1:0}));
 const view:AutonomyView={actors,available:actors.map(actor=>({id:actor.id,name:actor.name,locationId:null})),groups:[],locations:[],routes:[],rooms:[],features:[],jobs:[],logs:[],confirmed:'0',pendingActors:actors.filter(actor=>actor.remaining>0).length};
 try{
  Object.assign(globalThis,{document:parsed.document,window:parsed.window});(parsed.window as any).campaign={autonomy:async()=>({ok:true,value:view})};initAutonomy(()=>{});activateAutonomy({token:'token',campaign:{id:'campaign'}} as any);await openAutonomy();const cards=()=>parsed.document.querySelectorAll('#autonomy-actors .autonomy-card');
  assert.equal(cards().length,200);assert.equal(parsed.document.getElementById('autonomy-actor-result')!.textContent,'200 NPCs angezeigt.');
  const query=parsed.document.getElementById('autonomy-filter') as HTMLInputElement;query.value='hafenwache';query.dispatchEvent(new parsed.window.Event('input'));assert.equal(cards().length,1);assert.match(cards()[0]!.textContent,/Spezielle Hafenwache/);assert.equal(parsed.document.getElementById('autonomy-actor-result')!.textContent,'1 von 200 NPCs angezeigt.');
  query.value='';query.dispatchEvent(new parsed.window.Event('input'));const state=parsed.document.getElementById('autonomy-state-filter') as HTMLSelectElement;state.querySelector('[value=remaining]')!.setAttribute('selected','');state.dispatchEvent(new parsed.window.Event('change'));assert.equal(cards().length,9);assert.ok([...cards()].every(card=>/1 ausstehende Intervalle/.test(card.textContent)));
 }finally{Object.assign(globalThis,{document:priorDocument,window:priorWindow});}
});

test('job decision facts expose ranked candidates, rejections, and tie-break',async()=>{
 const parsed=parseHTML(readFileSync(join(process.cwd(),'src/app/workspace/index.html'),'utf8')),priorDocument=globalThis.document,priorWindow=globalThis.window,actor={id:'npc',revision:1,enabled:true,paused:false,role:'wache',needs:standardNeeds(),jobPriorities:{},assignedJobId:null,allowConflict:false,defense:12,attackBonus:0,maxHpLossPercent:10,cursor:1,offsetSeconds:0,jobId:'job-a',progressSeconds:900,pending:null,name:'Wache',locationId:'place',locationName:'Tor',positionRevision:1,dungeonPosition:null,remaining:0};
 const log={id:'job-log',text:'Wählt Vorräte ordnen: Grundpriorität 10 + Hunger 20 × 1 = 20',actorId:'npc',intervalId:'interval',kind:'job',facts:{jobId:'job-a',priority:30,considered:[{jobId:'job-a',name:'Vorräte ordnen',priority:30,reason:'Grundpriorität 10 + Hunger 20 × 1 = 20'},{jobId:'job-b',name:'Tor prüfen',priority:30,reason:'Grundpriorität 30'}],consideredRemaining:2,excluded:['Schmiede bedienen: Rolle wache ist nicht zugelassen'],excludedRemaining:1,tieBreak:'Priorität absteigend, bei Gleichstand Job-ID aufsteigend'}};
 const view:AutonomyView={actors:[actor],available:[{id:'npc',name:'Wache',locationId:'place'}],groups:[],locations:[{id:'place',name:'Tor'}],routes:[],rooms:[],features:[],jobs:[],logs:[log],confirmed:'3600000',pendingActors:0};
 try{
  Object.assign(globalThis,{document:parsed.document,window:parsed.window});(parsed.window as any).campaign={autonomy:async()=>({ok:true,value:view})};initAutonomy(()=>{});activateAutonomy({token:'token',campaign:{id:'campaign'}} as any);await openAutonomy();const facts=parsed.document.querySelector('#autonomy-log details')!;
  assert.equal(facts.querySelector('summary')!.textContent,'Entscheidungsfakten');assert.match(facts.textContent,/Vorräte ordnen · Priorität 30/);assert.match(facts.textContent,/Tor prüfen · Priorität 30/);assert.match(facts.textContent,/2 weitere zulässige Jobs/);assert.match(facts.textContent,/Schmiede bedienen: Rolle wache/);assert.match(facts.textContent,/1 weitere Ablehnungen/);assert.match(facts.textContent,/Gleichstand: Priorität absteigend/);
 }finally{Object.assign(globalThis,{document:priorDocument,window:priorWindow});}
});

test('group opt-in sends the reviewed group revision',async()=>{
 const parsed=parseHTML(readFileSync(join(process.cwd(),'src/app/workspace/index.html'),'utf8')),priorDocument=globalThis.document,priorWindow=globalThis.window,actions:AutonomyAction[]=[],view:AutonomyView={actors:[],available:[],groups:[{id:'group',revision:7,name:'Torwache',actorIds:[]}],locations:[],routes:[],rooms:[],features:[],jobs:[],logs:[],confirmed:'0',pendingActors:0};
 try{
  Object.assign(globalThis,{document:parsed.document,window:parsed.window});(parsed.window as any).campaign={autonomy:async()=>({ok:true,value:view}),executeAutonomy:async(command:any)=>{actions.push(command.action);return{ok:true,value:{view,progressed:0,pending:0}};}};initAutonomy(()=>{});activateAutonomy({token:'token',campaign:{id:'campaign'}} as any);await openAutonomy();
  [...parsed.document.querySelectorAll('#autonomy-groups button')].find(button=>button.textContent?.includes('aktivieren'))!.dispatchEvent(new parsed.window.Event('click'));await tick();assert.deepEqual(actions,[{kind:'group-enable',groupId:'group',expectedRevision:7,enabled:true}]);
 }finally{Object.assign(globalThis,{document:priorDocument,window:priorWindow});}
});

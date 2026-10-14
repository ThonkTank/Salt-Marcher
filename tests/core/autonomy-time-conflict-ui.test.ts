import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
import {parseHTML} from 'linkedom';
import {activateAutonomy,initAutonomy,openAutonomy} from '../../src/app/autonomy-ui';
import {standardNeeds,type AutonomyAction,type AutonomyView} from '../../src/app/autonomy-contracts';

const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
test('time conflict UI exposes facts and only reasoned resume or skip actions',async()=>{
 const parsed=parseHTML(readFileSync(join(process.cwd(),'src/app/index.html'),'utf8')),priorDocument=globalThis.document,priorWindow=globalThis.window,status:{text:string;error?:boolean}[]=[],actions:AutonomyAction[]=[];
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
 const parsed=parseHTML(readFileSync(join(process.cwd(),'src/app/index.html'),'utf8')),priorDocument=globalThis.document,priorWindow=globalThis.window,actor={id:'npc',revision:1,enabled:true,paused:false,role:'',needs:standardNeeds(),jobPriorities:{},assignedJobId:null,allowConflict:false,defense:12,attackBonus:0,maxHpLossPercent:10,cursor:0,offsetSeconds:0,jobId:null,progressSeconds:0,pending:null,name:'Wache',locationId:null,locationName:'Unplatziert',positionRevision:null,dungeonPosition:null,remaining:1};
 let release:(value:any)=>void=()=>{},view:AutonomyView={actors:[actor],available:[{id:'npc',name:'Wache',locationId:null}],groups:[],locations:[],routes:[],rooms:[],features:[],jobs:[],logs:[],confirmed:'900000',pendingActors:1};
 try{
  Object.assign(globalThis,{document:parsed.document,window:parsed.window});(parsed.window as any).campaign={autonomy:async()=>({ok:true,value:view}),executeAutonomy:()=>new Promise(resolve=>{release=resolve;})};initAutonomy(()=>{});activateAutonomy({token:'token',campaign:{id:'campaign'}} as any);await openAutonomy();
  (parsed.document.getElementById('autonomy-catchup') as HTMLButtonElement).click();await tick();assert.match(parsed.document.getElementById('autonomy-progress')!.textContent,/Nachholen gestartet/);assert.equal((parsed.document.getElementById('autonomy-catchup') as HTMLButtonElement).disabled,true);
  view={...view,actors:[{...actor,revision:2,cursor:1,remaining:0}],pendingActors:0};release({ok:true,value:{view,progressed:1,pending:0}});await new Promise(resolve=>setTimeout(resolve,20));const button=parsed.document.getElementById('autonomy-catchup') as HTMLButtonElement;assert.equal(button.disabled,false);assert.match(parsed.document.getElementById('autonomy-progress')!.textContent,/1 atomare NPC-Schritte/);
 }finally{Object.assign(globalThis,{document:priorDocument,window:priorWindow});}
});

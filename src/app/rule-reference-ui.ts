import type {WorkspaceGeometry,Result} from './contracts';
import type {Note} from './preparation-contracts';
import type {SceneRuleCommand,SceneRules} from './rule-reference-contracts';
import type {SceneCheck,SceneCheckCommand,SceneChecks} from './scene-check-contracts';
import {formatInstant} from './live-contracts';

type CheckAction=Extract<SceneCheckCommand['action'],{kind:'roll'}>;
type FormulaAction=Extract<SceneCheckCommand['action'],{kind:'formula'}>;
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const unwrap=<T>(result:Result<T>):T=>{if(!result.ok)throw new Error(result.error);return result.value;};
let workspace:WorkspaceGeometry|null=null,sceneId:string|null=null,view:SceneRules|null=null,checks:SceneChecks|null=null,generation=0,ruleReadRequest=0,checkReadRequest=0,searchRequest=0,busy=false,searchTimer:ReturnType<typeof setTimeout>|null=null,tell:(text:string,error?:boolean)=>void;

function ensure(){if(document.getElementById('live-rules-panel'))return;const section=document.createElement('section');section.id='live-rules-panel';section.innerHTML='<div class="toolbar"><h3>Regeln und Proben am Tisch</h3><button id="live-rules-refresh" type="button">Aktualisieren</button></div><label>Regelreferenzen durchsuchen<input id="live-rule-search" type="search" placeholder="Aktion, Zustand, Hausregel …"></label><div id="live-rule-results" class="selection-list"></div><div id="live-rule-pins"></div><form id="live-check-form"><h4>Schnelle d20-Probe</h4><label>Bezeichnung<input id="live-check-label" maxlength="1000" required placeholder="Wahrnehmung, Rettungswurf …"></label><div class="live-check-fields"><label>Regelbezug<select id="live-check-rule"><option value="">Freie Probe</option></select></label><label>Wurfart<select id="live-check-mode"><option value="normal">Normal</option><option value="advantage">Vorteil</option><option value="disadvantage">Nachteil</option></select></label><label>Modifikator<input id="live-check-modifier" type="number" min="-1000" max="1000" step="1" value="0" required></label><label>SG (optional)<input id="live-check-dc" type="number" min="-1000" max="1000" step="1"></label></div><button type="submit">Würfeln und protokollieren</button></form><p id="live-check-latest" role="status" aria-live="polite"></p><div id="live-check-history"></div>';el('scene-preparation-panel').before(section);el('live-rules-refresh').onclick=()=>void refreshRuleReferences(sceneId);el('live-rule-search').oninput=()=>{clearSearch('Suche geändert · passende Regeln werden gesucht…');searchTimer=setTimeout(()=>{searchTimer=null;void search();},180);};el<HTMLSelectElement>('live-check-rule').onchange=()=>{const pin=view?.pins.find(p=>p.noteId===el<HTMLSelectElement>('live-check-rule').value);if(pin&&!el<HTMLInputElement>('live-check-label').value.trim())el<HTMLInputElement>('live-check-label').value=pin.title;};el<HTMLFormElement>('live-check-form').onsubmit=event=>{event.preventDefault();void roll();};}
function clearSearch(text=''){if(searchTimer)clearTimeout(searchTimer);searchTimer=null;searchRequest++;const root=el('live-rule-results');root.replaceChildren();if(text)message(root,text);}
function message(root:HTMLElement,text:string,error=false){const p=document.createElement('p');p.className='caption';p.textContent=text;if(error)p.setAttribute('role','alert');root.replaceChildren(p);}
function button(text:string,click:()=>void){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=click;return b;}
type Owner={token:string;campaignId:string;sceneId:string;generation:number};
function owner():Owner|null{return workspace&&sceneId?{token:workspace.token,campaignId:workspace.campaign.id,sceneId,generation}:null;}
function current(o:Owner){return o.generation===generation&&o.token===workspace?.token&&o.campaignId===workspace?.campaign.id&&o.sceneId===sceneId;}
function lock(){const panel=el('live-rules-panel');panel.inert=busy;for(const button of panel.querySelectorAll<HTMLButtonElement>('button'))button.disabled=busy;if(busy)panel.setAttribute('aria-busy','true');else panel.removeAttribute('aria-busy');for(const button of el('live-rules-panel').querySelectorAll<HTMLButtonElement>('#live-rule-pins button,#live-rule-results button'))button.disabled=busy||!view;el<HTMLButtonElement>('live-check-form').querySelector<HTMLButtonElement>('button')!.disabled=busy||!checks;}
function accept(next:SceneRules,o:Owner){
 if(next.sceneId!==o.sceneId)throw new Error('Regelantwort gehört zu einer anderen Scene.');
 if(!Number.isSafeInteger(next.revision)||next.revision<0||!Array.isArray(next.pins)||next.pins.length>50)throw new Error('Regelantwort hat einen ungültigen Stand.');
 if(view?.sceneId===next.sceneId&&view.revision>next.revision)return;
 view=next;renderPins();renderCheckOptions();lock();
}
async function command(action:SceneRuleCommand['action']){
 const o=owner(),basis=view;if(!o||!basis||busy)return;busy=true;ruleReadRequest++;lock();
 try{
  const result=await window.campaign.executeSceneRule({commandId:crypto.randomUUID(),campaignId:o.campaignId,token:o.token,sceneId:o.sceneId,expectedRevision:basis.revision,action});
  if(!current(o))return;ruleReadRequest++;accept(unwrap(result),o);await search();if(current(o))tell('Regelreferenzen der Gruppe gespeichert.');
 }catch(error){if(current(o))tell((error as Error).message,true);}finally{if(current(o)){busy=false;lock();}}
}
function renderPins(){const root=el('live-rule-pins');root.replaceChildren();if(!view?.pins.length){const p=document.createElement('p');p.className='caption';p.textContent='Noch keine Regel für diese Gruppe angeheftet.';root.append(p);return;}for(const pin of view.pins){const card=document.createElement('article'),title=document.createElement('h4'),status=document.createElement('p'),publicText=document.createElement('pre'),details=document.createElement('details'),summary=document.createElement('summary'),gm=document.createElement('pre'),actions=document.createElement('div');title.textContent=pin.title;status.className='caption';status.textContent=pin.unavailable?'Quelle nicht mehr verfügbar – eingefrorener Stand bleibt lesbar.':pin.stale?'Quelle geändert – eingefrorener Stand bleibt aktiv.':'Quelle Revision '+pin.sourceRevision;publicText.textContent=pin.readAloud;summary.textContent='GM-Details';gm.textContent=pin.gmNotes;details.append(summary,gm);actions.className='toolbar';if(pin.stale&&!pin.unavailable)actions.append(button('Aus Quelle aktualisieren',()=>void command({kind:'refresh',noteId:pin.noteId})));actions.append(button('Von Gruppe lösen',()=>void command({kind:'unpin',noteId:pin.noteId})));card.append(title,status,publicText,details,actions);root.append(card);}}
async function search(){
 const w=workspace,id=sceneId,g=generation,r=++searchRequest,query=el<HTMLInputElement>('live-rule-search').value;if(!w||!id||!view)return;
 const current=()=>g===generation&&workspace?.token===w.token&&sceneId===id&&r===searchRequest&&el<HTMLInputElement>('live-rule-search').value===query;
 try{
  const prep=unwrap(await window.campaign.preparation(w.token,query));if(!current())return;
  const root=el('live-rule-results');root.replaceChildren();const pinned=new Set(view?.pins.map(p=>p.noteId));
  for(const row of prep.notes.filter(row=>!row.trashed&&row.note.kind==='rule'&&!pinned.has(row.note.id)).slice(0,20)){const card=document.createElement('article'),title=document.createElement('strong'),excerpt=document.createElement('span');title.textContent=row.note.title;excerpt.textContent=' · '+excerptFor(row.note);card.append(title,excerpt,button('Anheften',()=>void command({kind:'pin',noteId:row.note.id})));root.append(card);}
  if(!root.childNodes.length)message(root,'Keine weitere Regelreferenz gefunden.');lock();
 }catch(error){if(current()){message(el('live-rule-results'),(error as Error).message,true);tell((error as Error).message,true);}}
}


function excerptFor(note:Note){const text=(note.readAloud||note.gmNotes).replace(/\s+/g,' ').trim();return text.length>140?text.slice(0,137)+'…':text;}
export function initRuleReferences(status:typeof tell){tell=status;ensure();}
export function activateRuleReferences(next:WorkspaceGeometry){
 workspace=next;sceneId=null;view=null;checks=null;busy=false;generation++;ruleReadRequest++;checkReadRequest++;searchRequest++;
 if(searchTimer)clearTimeout(searchTimer);searchTimer=null;
 el('live-rules-panel').hidden=true;el('live-rule-results').replaceChildren();el('live-rule-pins').replaceChildren();renderChecks();lock();
}
export async function refreshRuleReferences(nextSceneId:string|null){
 ensure();if(sceneId!==nextSceneId){generation++;searchRequest++;busy=false;view=null;checks=null;el('live-rule-results').replaceChildren();el('live-rule-pins').replaceChildren();renderCheckOptions();renderChecks();lock();}
 if(sceneId!==nextSceneId)clearSearch();sceneId=nextSceneId;el('live-rules-panel').hidden=!nextSceneId;
 const o=owner(),rulesRequest=++ruleReadRequest,checksRequest=++checkReadRequest;if(!o)return;
 // Each reader owns only its own view: one missing or slow source cannot hide the other.
 const readRules=async()=>{
  try{
   const result=await window.campaign.sceneRules(o.token,o.sceneId);
   if(!current(o)||rulesRequest!==ruleReadRequest)return;accept(unwrap(result),o);await search();
  }catch(error){if(current(o)&&rulesRequest===ruleReadRequest){view=null;clearSearch();renderCheckOptions();message(el('live-rule-pins'),(error as Error).message,true);lock();tell((error as Error).message,true);}}
 };
 const readChecks=async()=>{
  try{
   const result=await window.campaign.sceneChecks(o.token,o.sceneId);
   if(!current(o)||checksRequest!==checkReadRequest)return;acceptChecks(unwrap(result),o);
  }catch(error){if(current(o)&&checksRequest===checkReadRequest){checks=null;renderChecks();message(el('live-check-history'),(error as Error).message,true);lock();tell((error as Error).message,true);}}
 };
 await Promise.all([readRules(),readChecks()]);
}

function acceptChecks(next:SceneChecks,o:Owner){
 if(next.sceneId!==o.sceneId||!Number.isSafeInteger(next.revision)||next.revision<0||!Array.isArray(next.checks)||next.checks.length>100)throw new Error('Probenantwort hat einen ungültigen Stand.');
 if(checks?.sceneId===next.sceneId&&checks.revision>next.revision)return;
 checks=next;renderChecks();lock();
}
function renderCheckOptions(){const select=el<HTMLSelectElement>('live-check-rule'),selected=select.value;select.replaceChildren(checkOption('Freie Probe',''));for(const pin of view?.pins??[])select.append(checkOption(pin.title+(pin.stale?' · eingefroren':''),pin.noteId));select.value=[...select.querySelectorAll('option')].some(option=>option.value===selected)?selected:'';}
export function describeSceneCheck(check:SceneChecks['checks'][number]){const modifier=check.modifier===0?'':check.modifier>0?' + '+check.modifier:' − '+Math.abs(check.modifier),decision=check.outcome===null?'':check.rollKind==='formula'&&check.formulaKind==='attack'?(check.outcome==='success'?' · Treffer gegen RK ':' · Verfehlt gegen RK ')+check.dc:check.outcome==='success'?' · Erfolg gegen SG '+check.dc:' · Fehlschlag gegen SG '+check.dc;if(check.rollKind==='formula')return(check.actor?check.actor+' · ':'')+check.label+': '+check.formula+' → '+check.rolls.join(' + ')+modifier+' = '+check.total+decision;const kept=check.mode==='advantage'?Math.max(...check.rolls):check.mode==='disadvantage'?Math.min(...check.rolls):check.rolls[0]!,rolls=check.mode==='normal'?String(kept):check.rolls.join(' / ')+' · '+(check.mode==='advantage'?'Vorteil':'Nachteil')+' wählt '+kept;return(check.actor?check.actor+' · ':'')+check.label+': '+rolls+modifier+' = '+check.total+decision;}
function renderChecks(){const root=el('live-check-history'),latest=el('live-check-latest');root.replaceChildren();latest.textContent='';if(!checks?.checks.length){const p=document.createElement('p');p.className='caption';p.textContent='Noch keine Probe für diese Gruppe protokolliert.';root.append(p);return;}const [newest,...history]=checks.checks;latest.className=newest!.outcome===null?'':newest!.outcome==='success'?'check-success':'check-failure';latest.textContent='Letztes Ergebnis · '+describeSceneCheck(newest!);const details=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('ol');summary.textContent='Probenverlauf ('+checks.checks.length+(checks.truncated?'+':'')+')';for(const check of [newest!,...history.slice(0,29)]){const item=document.createElement('li'),strong=document.createElement('strong'),context=document.createElement('span');strong.textContent=describeSceneCheck(check);context.textContent=' · '+formatInstant(check.sceneInstantMs)+(check.ruleTitle?' · '+check.ruleTitle+' · Regelrevision '+check.ruleSourceRevision:'');item.append(strong,context);list.append(item);}details.append(summary,list);root.append(details);}
function checkOption(text:string,value:string){const option=document.createElement('option');option.textContent=text;option.value=value;return option;}
async function sendCheck(action:SceneCheckCommand['action'],onResult?:(check:SceneCheck)=>void){
 const o=owner(),basis=checks;if(!o||!basis||busy)return false;
 const command:SceneCheckCommand={commandId:crypto.randomUUID(),campaignId:o.campaignId,token:o.token,sceneId:o.sceneId,expectedRevision:basis.revision,action};
 busy=true;checkReadRequest++;lock();
 try{
  const result=await window.campaign.executeSceneCheck(command);if(!current(o))return false;
  const next=unwrap(result);checkReadRequest++;acceptChecks(next,o);if(onResult&&next.checks[0])onResult(next.checks[0]);
  if(action.kind==='roll'&&!action.actor)el<HTMLInputElement>('live-check-label').select();
  tell(action.kind==='roll'?'GM-Probe gewürfelt und bei der Gruppe gespeichert.':'Statblock-Wurf ausgeführt und bei der Gruppe gespeichert.');return true;
 }catch(error){if(current(o))tell((error as Error).message,true);return false;}finally{if(current(o)){busy=false;lock();}}
}
async function roll(){
 const dcText=el<HTMLInputElement>('live-check-dc').value;
 await sendCheck({kind:'roll',label:el<HTMLInputElement>('live-check-label').value,ruleNoteId:el<HTMLSelectElement>('live-check-rule').value||null,mode:el<HTMLSelectElement>('live-check-mode').value as Extract<SceneCheckCommand['action'],{kind:'roll'}>['mode'],modifier:Number(el<HTMLInputElement>('live-check-modifier').value),dc:dcText===''?null:Number(dcText)});
}
export async function rollSceneFormula(action:Omit<FormulaAction,'kind'>,onResult?:(check:SceneCheck)=>void){return sendCheck({kind:'formula',...action},onResult);}

export async function rollSceneCheck(action:Omit<CheckAction,'kind'|'ruleNoteId'>,onResult?:(check:SceneCheck)=>void){return sendCheck({kind:'roll',ruleNoteId:null,...action},onResult);}

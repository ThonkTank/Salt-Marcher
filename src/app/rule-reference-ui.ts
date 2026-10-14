import type {Workspace,Result} from './contracts';
import type {Note} from './preparation-contracts';
import type {SceneRuleCommand,SceneRules} from './rule-reference-contracts';

const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const unwrap=<T>(result:Result<T>):T=>{if(!result.ok)throw new Error(result.error);return result.value;};
let workspace:Workspace|null=null,sceneId:string|null=null,view:SceneRules|null=null,generation=0,readRequest=0,searchRequest=0,busy=false,searchTimer:ReturnType<typeof setTimeout>|null=null,tell:(text:string,error?:boolean)=>void;

function ensure(){if(document.getElementById('live-rules-panel'))return;const section=document.createElement('section');section.id='live-rules-panel';section.innerHTML='<div class="toolbar"><h3>Regeln am Tisch</h3><button id="live-rules-refresh" type="button">Aktualisieren</button></div><label>Regelreferenzen durchsuchen<input id="live-rule-search" type="search" placeholder="Aktion, Zustand, Hausregel …"></label><div id="live-rule-results" class="selection-list"></div><div id="live-rule-pins"></div>';el('scene-preparation-panel').before(section);el('live-rules-refresh').onclick=()=>void refreshRuleReferences(sceneId);el('live-rule-search').oninput=()=>{if(searchTimer)clearTimeout(searchTimer);searchTimer=setTimeout(()=>void search(),180);};}
function button(text:string,click:()=>void){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=click;return b;}
type Owner={token:string;campaignId:string;sceneId:string;generation:number};
function owner():Owner|null{return workspace&&sceneId?{token:workspace.token,campaignId:workspace.campaign.id,sceneId,generation}:null;}
function current(o:Owner){return o.generation===generation&&o.token===workspace?.token&&o.campaignId===workspace?.campaign.id&&o.sceneId===sceneId;}
function lock(){const panel=el('live-rules-panel');panel.inert=busy;if(busy)panel.setAttribute('aria-busy','true');else panel.removeAttribute('aria-busy');for(const button of el('live-rules-panel').querySelectorAll<HTMLButtonElement>('#live-rule-pins button,#live-rule-results button'))button.disabled=busy||!view;}
function accept(next:SceneRules,o:Owner){
 if(next.sceneId!==o.sceneId)throw new Error('Regelantwort gehört zu einer anderen Scene.');
 if(!Number.isSafeInteger(next.revision)||next.revision<0||!Array.isArray(next.pins)||next.pins.length>50)throw new Error('Regelantwort hat einen ungültigen Stand.');
 if(view?.sceneId===next.sceneId&&view.revision>next.revision)return;
 view=next;renderPins();lock();
}
async function command(action:SceneRuleCommand['action']){
 const o=owner(),basis=view;if(!o||!basis||busy)return;busy=true;readRequest++;lock();
 try{
  const result=await window.campaign.executeSceneRule({commandId:crypto.randomUUID(),campaignId:o.campaignId,token:o.token,sceneId:o.sceneId,expectedRevision:basis.revision,action});
  if(!current(o))return;readRequest++;accept(unwrap(result),o);await search();if(current(o))tell('Regelreferenzen der Gruppe gespeichert.');
 }catch(error){if(current(o))tell((error as Error).message,true);}finally{if(current(o)){busy=false;lock();}}
}
function renderPins(){const root=el('live-rule-pins');root.replaceChildren();if(!view?.pins.length){const p=document.createElement('p');p.className='caption';p.textContent='Noch keine Regel für diese Gruppe angeheftet.';root.append(p);return;}for(const pin of view.pins){const card=document.createElement('article'),title=document.createElement('h4'),status=document.createElement('p'),publicText=document.createElement('pre'),details=document.createElement('details'),summary=document.createElement('summary'),gm=document.createElement('pre'),actions=document.createElement('div');title.textContent=pin.title;status.className='caption';status.textContent=pin.unavailable?'Quelle nicht mehr verfügbar – eingefrorener Stand bleibt lesbar.':pin.stale?'Quelle geändert – eingefrorener Stand bleibt aktiv.':'Quelle Revision '+pin.sourceRevision;publicText.textContent=pin.readAloud;summary.textContent='GM-Details';gm.textContent=pin.gmNotes;details.append(summary,gm);actions.className='toolbar';if(pin.stale&&!pin.unavailable)actions.append(button('Aus Quelle aktualisieren',()=>void command({kind:'refresh',noteId:pin.noteId})));actions.append(button('Von Gruppe lösen',()=>void command({kind:'unpin',noteId:pin.noteId})));card.append(title,status,publicText,details,actions);root.append(card);}}
async function search(){const w=workspace,id=sceneId,g=generation,request=++searchRequest,query=el<HTMLInputElement>('live-rule-search').value;if(!w||!id)return;try{const prep=unwrap(await window.campaign.preparation(w.token,query));if(g!==generation||request!==searchRequest||workspace?.token!==w.token||sceneId!==id||el<HTMLInputElement>('live-rule-search').value!==query)return;const root=el('live-rule-results');root.replaceChildren();const pinned=new Set(view?.pins.map(p=>p.noteId));for(const row of prep.notes.filter(row=>!row.trashed&&row.note.kind==='rule'&&!pinned.has(row.note.id)).slice(0,20)){const card=document.createElement('article'),title=document.createElement('strong'),excerpt=document.createElement('span');title.textContent=row.note.title;excerpt.textContent=' · '+excerptFor(row.note);card.append(title,excerpt,button('Anheften',()=>void command({kind:'pin',noteId:row.note.id})));root.append(card);}if(!root.childNodes.length){const p=document.createElement('p');p.className='caption';p.textContent='Keine weitere Regelreferenz gefunden.';root.append(p);}lock();}catch(error){if(g===generation&&request===searchRequest&&workspace?.token===w.token&&sceneId===id&&el<HTMLInputElement>('live-rule-search').value===query)tell((error as Error).message,true);}}
function excerptFor(note:Note){const text=(note.readAloud||note.gmNotes).replace(/\s+/g,' ').trim();return text.length>140?text.slice(0,137)+'…':text;}
export function initRuleReferences(status:typeof tell){tell=status;ensure();}
export function activateRuleReferences(next:Workspace){
 workspace=next;sceneId=null;view=null;busy=false;generation++;readRequest++;searchRequest++;
 if(searchTimer)clearTimeout(searchTimer);searchTimer=null;
 el('live-rules-panel').hidden=true;el('live-rule-results').replaceChildren();el('live-rule-pins').replaceChildren();lock();
}
export async function refreshRuleReferences(nextSceneId:string|null){
 ensure();if(sceneId!==nextSceneId){generation++;searchRequest++;busy=false;view=null;el('live-rule-results').replaceChildren();el('live-rule-pins').replaceChildren();lock();}
 sceneId=nextSceneId;el('live-rules-panel').hidden=!nextSceneId;const o=owner(),request=++readRequest;if(!o)return;
 try{
  const result=await window.campaign.sceneRules(o.token,o.sceneId);
  if(!current(o)||request!==readRequest)return;accept(unwrap(result),o);await search();
 }catch(error){if(current(o)&&request===readRequest)tell((error as Error).message,true);}
}

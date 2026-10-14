import type {Workspace,Result} from './contracts';
import type {Note} from './preparation-contracts';
import type {SceneRuleCommand,SceneRules} from './rule-reference-contracts';

const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const unwrap=<T>(result:Result<T>):T=>{if(!result.ok)throw new Error(result.error);return result.value;};
let workspace:Workspace|null=null,sceneId:string|null=null,view:SceneRules|null=null,generation=0,searchRequest=0,searchTimer:ReturnType<typeof setTimeout>|null=null,pending:Promise<void>|null=null,tell:(text:string,error?:boolean)=>void;

const knownViews=new Map<string,SceneRules>();
function acceptView(next:SceneRules){const known=knownViews.get(next.sceneId);view=known&&known.revision>next.revision?known:next;knownViews.set(next.sceneId,view);}
function ensure(){if(document.getElementById('live-rules-panel'))return;const section=document.createElement('section');section.id='live-rules-panel';section.innerHTML='<div class="toolbar"><h3>Regeln am Tisch</h3><button id="live-rules-refresh" type="button">Aktualisieren</button></div><label>Regelreferenzen durchsuchen<input id="live-rule-search" type="search" placeholder="Aktion, Zustand, Hausregel …"></label><div id="live-rule-results" class="selection-list"></div><div id="live-rule-pins"></div>';el('scene-preparation-panel').before(section);el('live-rules-refresh').onclick=()=>void refreshRuleReferences(sceneId);el('live-rule-search').oninput=()=>{clearSearch('Suche geändert · passende Regeln werden gesucht…');searchTimer=setTimeout(()=>{searchTimer=null;void search();},180);};}
function button(text:string,click:()=>void){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=click;return b;}
function busy(on:boolean){const panel=el('live-rules-panel');panel.inert=on;for(const b of panel.querySelectorAll<HTMLButtonElement>('button'))b.disabled=on;if(on)panel.setAttribute('aria-busy','true');else panel.removeAttribute('aria-busy');}
function command(action:SceneRuleCommand['action']){const w=workspace,id=sceneId,current=view;if(!w||!id||!current||pending)return;const g=generation,task=(async()=>{try{const next=unwrap(await window.campaign.executeSceneRule({commandId:crypto.randomUUID(),campaignId:w.campaign.id,token:w.token,sceneId:id,expectedRevision:current.revision,action}));if(g!==generation||workspace?.token!==w.token||sceneId!==id)return;if(next.sceneId!==id)throw new Error('Regelantwort gehört zu einer anderen Gruppe.');acceptView(next);renderPins();await search();if(g===generation&&workspace?.token===w.token&&sceneId===id)tell('Regelreferenzen der Gruppe gespeichert.');}catch(error){if(g===generation&&workspace?.token===w.token&&sceneId===id)tell((error as Error).message,true);}})();pending=task;busy(true);void task.finally(()=>{if(pending===task){pending=null;busy(false);}});}
function renderPins(){const root=el('live-rule-pins');root.replaceChildren();if(!view?.pins.length){const p=document.createElement('p');p.className='caption';p.textContent='Noch keine Regel für diese Gruppe angeheftet.';root.append(p);return;}for(const pin of view.pins){const card=document.createElement('article'),title=document.createElement('h4'),status=document.createElement('p'),publicText=document.createElement('pre'),details=document.createElement('details'),summary=document.createElement('summary'),gm=document.createElement('pre'),actions=document.createElement('div');title.textContent=pin.title;status.className='caption';status.textContent=pin.unavailable?'Quelle nicht mehr verfügbar – eingefrorener Stand bleibt lesbar.':pin.stale?'Quelle geändert – eingefrorener Stand bleibt aktiv.':'Quelle Revision '+pin.sourceRevision;publicText.textContent=pin.readAloud;summary.textContent='GM-Details';gm.textContent=pin.gmNotes;details.append(summary,gm);actions.className='toolbar';if(pin.stale&&!pin.unavailable)actions.append(button('Aus Quelle aktualisieren',()=>void command({kind:'refresh',noteId:pin.noteId})));actions.append(button('Von Gruppe lösen',()=>void command({kind:'unpin',noteId:pin.noteId})));card.append(title,status,publicText,details,actions);root.append(card);}}
function message(root:HTMLElement,text:string,error=false){const p=document.createElement('p');p.className='caption';p.textContent=text;if(error)p.setAttribute('role','alert');root.replaceChildren(p);}
function clearSearch(text=''){if(searchTimer)clearTimeout(searchTimer);searchTimer=null;searchRequest++;const root=el('live-rule-results');root.replaceChildren();if(text)message(root,text);}
async function search(){
 const w=workspace,id=sceneId,g=generation,r=++searchRequest,query=el<HTMLInputElement>('live-rule-search').value;if(!w||!id||!view)return;
 const current=()=>g===generation&&workspace?.token===w.token&&sceneId===id&&r===searchRequest&&el<HTMLInputElement>('live-rule-search').value===query;
 try{
  const prep=unwrap(await window.campaign.preparation(w.token,query));if(!current())return;
  const root=el('live-rule-results');root.replaceChildren();const pinned=new Set(view?.pins.map(p=>p.noteId));
  for(const row of prep.notes.filter(row=>!row.trashed&&row.note.kind==='rule'&&!pinned.has(row.note.id)).slice(0,20)){const card=document.createElement('article'),title=document.createElement('strong'),excerpt=document.createElement('span');title.textContent=row.note.title;excerpt.textContent=' · '+excerptFor(row.note);card.append(title,excerpt,button('Anheften',()=>void command({kind:'pin',noteId:row.note.id})));root.append(card);}
  if(!root.childNodes.length)message(root,'Keine weitere Regelreferenz gefunden.');
 }catch(error){if(current()){message(el('live-rule-results'),(error as Error).message,true);tell((error as Error).message,true);}}
}

function excerptFor(note:Note){const text=(note.readAloud||note.gmNotes).replace(/\s+/g,' ').trim();return text.length>140?text.slice(0,137)+'…':text;}
export function initRuleReferences(status:typeof tell){tell=status;ensure();}
export function activateRuleReferences(next:Workspace){workspace=next;sceneId=null;view=null;generation++;pending=null;knownViews.clear();clearSearch();busy(false);el('live-rule-pins').replaceChildren();el('live-rules-panel').hidden=true;}
export async function refreshRuleReferences(nextSceneId:string|null){
 ensure();const w=workspace,g=++generation;sceneId=nextSceneId;view=null;clearSearch();el('live-rule-pins').replaceChildren();el('live-rules-panel').hidden=!nextSceneId;if(!w||!nextSceneId)return;
 const current=()=>g===generation&&workspace?.token===w.token&&sceneId===nextSceneId;
 message(el('live-rule-pins'),'Regeln werden geladen…');busy(true);
 try{const next=unwrap(await window.campaign.sceneRules(w.token,nextSceneId));if(!current())return;if(next.sceneId!==nextSceneId)throw new Error('Regelantwort gehört zu einer anderen Gruppe.');acceptView(next);renderPins();await search();}
 catch(error){if(current()){message(el('live-rule-pins'),(error as Error).message,true);tell((error as Error).message,true);}}
 finally{if(current())busy(!!pending);}
}

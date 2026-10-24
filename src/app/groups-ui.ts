import {EditorSession} from './editor-session';
import type {WorkspaceGeometry,Result} from './contracts';
import type {GroupView,GroupDraft,GroupRow,GroupAction} from './groups-contracts';
import type {ProgressCommand,ProgressAck} from './progression';
import {writeConfirmed,hasPendingCommit,onCommitState,onCommitResolved} from './commit-confirmation';
export const editorSession = new EditorSession();
const keepingWork = editorSession.operation<Promise<boolean>>();
const pendingWork = editorSession.operation<Promise<boolean>>();

const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const unwrap=<T>(r:Result<T>):T=>{if(!r.ok)throw new Error(r.error);return r.value;};
let workspace:WorkspaceGeometry|null=null,book:GroupView|null=null,draft:GroupDraft|null=null;
let places:{id:string;name:string}[]=[],templates:{id:string;revision:number;name:string}[]=[],list:{items:{id:string;title:string;locationId:string|null;count:number}[];next:string|null}={items:[],next:null};
let tell:(s:string,error?:boolean)=>void,after:()=>Promise<void>,enter:(id?:string)=>Promise<void>,openActor:(id:string,current?:()=>boolean)=>Promise<void>=async()=>{};
let listRequest=0,listBusy=false,listQuery:string|null=null;
let editing=0, request=0, writeId:string|null=null, dirty=false;
let timer:ReturnType<typeof setTimeout>|null=null;
function editorOwner(){const g=editorSession.generation,e=editing;return()=>g===editorSession.generation&&e===editing;}
const run=(fn:()=>Promise<unknown>)=>{const current=editorOwner();void fn().catch(e=>{if(current())tell(e.message,true);});};
function option(select:HTMLSelectElement,id:string,name:string){const o=document.createElement('option');o.value=id;o.textContent=name;select.append(o);}
function lock(){const blocked=!workspace||!!pendingWork.value||hasPendingCommit(workspace.campaign.id);for(const c of el('groups').querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement|HTMLTextAreaElement>('input,select,button,textarea'))c.disabled=blocked;el<HTMLButtonElement>('groups-apply').disabled=blocked||!draft||!dirty;el<HTMLButtonElement>('groups-more').disabled=blocked||listBusy||listQuery===null||!list.next;}
function mark(){if(!draft)return;dirty=true;editorSession.input.version++;if(timer)clearTimeout(timer);const current=editorOwner();timer=setTimeout(()=>{if(current())void keep();},250);el('groups-draft-status').textContent='Offene Gruppenangaben werden gesichert…';lock();}
export function activateGroups(w:WorkspaceGeometry|null){workspace=w;editorSession.generation++;editing++;keepingWork.value=null;pendingWork.value=null;request++;listRequest++;listBusy=false;listQuery=null;el('groups-search-status').textContent='';book=null;draft=null;dirty=false;writeId=null;editorSession.input.version=editorSession.input.retained=0;if(timer)clearTimeout(timer);timer=null;list={items:[],next:null};el('groups-editor').hidden=true;el('groups-list').replaceChildren();el('groups-creature-results').replaceChildren();lock();}
function rowOf(c:{id:string;name:string;hp:number},suffix=''):GroupRow{return{id:null,creatureId:c.id,revision:0,profileRevision:0,name:c.name+suffix,hp:String(c.hp),maxHp:String(c.hp),tempHp:'0',conditions:'',concentrating:false,gmNotes:'',readAloud:''};}
function fromGroup(g:GroupView):GroupDraft{
 const actors:GroupRow[]=g.actors.map(a=>({id:a.id,creatureId:a.creatureId,revision:a.revision,profileRevision:a.profileRevision,name:a.name,hp:String(a.hp),maxHp:String(a.maxHp),tempHp:String(a.tempHp),conditions:a.conditions,concentrating:a.concentrating,gmNotes:a.gmNotes,readAloud:a.readAloud}));
 if(!actors.length&&g.plan.entries.reduce((n,e)=>n+e.count,0)>200)throw new Error('Diese Vorlage enthält mehr als 200 Figuren. Bitte zuerst eine kleinere Vorlage vorbereiten.');
 if(!actors.length&&g.plan.entries.length)for(const entry of g.plan.entries){const c=g.plan.sources.find(c=>c.id===entry.creatureId);if(!c)continue;for(let n=0;n<entry.count;n++)actors.push(rowOf(c,' '+(n+1)));}
 return{writeId:'',groupId:g.id,revision:g.revision,title:g.title,notes:g.notes,locationId:g.locationId,actors};
}
function invalidateSearch(){listRequest++;listBusy=false;listQuery=null;list={items:[],next:null};el('groups-search-status').textContent='Suche geändert · Suchen zeigt die passenden Gruppen.';drawList();}
function searchCount(){el('groups-search-status').textContent=list.items.length+' Gruppen geladen'+(list.next?' · weitere verfügbar.':'.');}
export async function openGroups(id?:string){
 if(!workspace)return;
 const token=workspace.token,g=editorSession.generation,r=++listRequest,query=el<HTMLInputElement>('groups-search').value;
 const current=()=>workspace?.token===token&&g===editorSession.generation&&r===listRequest;
 listBusy=true;listQuery=null;list={items:[],next:null};el('groups-search-status').textContent='Gruppen werden gesucht…';drawList();
 try{
  if(!await flushGroups()){if(current())el('groups-search-status').textContent='Suche angehalten · offene Eingabe zuerst sichern.';return;}
  if(!current())return;
  const refs=unwrap(await window.campaign.ledgerParties(token)),plans=unwrap(await window.campaign.encounterPlans(token,'')),page=unwrap(await window.campaign.preparedGroups(token,query,null));
  if(!current())return;
  places=refs.filter(p=>p.kind==='location');templates=plans;list=page;listQuery=query;if(draft)drawPlaces();
  const selector=el<HTMLSelectElement>('groups-template');selector.replaceChildren();option(selector,'','Leere Gruppe');for(const t of templates)option(selector,t.id,t.name);
  drawList();searchCount();
  // Searching leaves the independently saved editor and its caret untouched.
  const target=id??(!book?page.items[0]?.id:undefined);if(target)await select(target);
 }catch(e){if(current())el('groups-search-status').textContent='Suche fehlgeschlagen · erneut Suchen.';throw e;}
 finally{if(current()){listBusy=false;lock();}}
}
async function moreGroups(){
 if(!workspace||listBusy||listQuery===null||!list.next||el<HTMLInputElement>('groups-search').value!==listQuery)return;
 const token=workspace.token,g=editorSession.generation,r=++listRequest,query=listQuery,cursor=list.next;
 const current=()=>workspace?.token===token&&g===editorSession.generation&&r===listRequest&&listQuery===query;
 listBusy=true;el('groups-search-status').textContent='Weitere Gruppen werden geladen…';lock();
 try{
  const next=unwrap(await window.campaign.preparedGroups(token,query,cursor));if(!current())return;
  list={items:[...list.items,...next.items],next:next.next};drawList();searchCount();
 }catch(e){if(current())el('groups-search-status').textContent='Nachladen fehlgeschlagen · Weitere Gruppen versucht dieselbe Seite erneut.';throw e;}
 finally{if(current()){listBusy=false;lock();}}
}

async function select(id:string){
 if(!workspace)return;
 const current=editorOwner(),token=workspace.token,n=editorSession.input.version;
 if(!await flushGroups()||!current()||n!==editorSession.input.version)return;
 const r=++request;
 const [response,input]=await Promise.all([window.campaign.groupView(token,id),window.campaign.groupDraft(token,id)]);
 if(!current()||r!==request||n!==editorSession.input.version)return;
 const next=unwrap(response),d=unwrap(input);
 book=next;draft=d??fromGroup(next);editing++;writeId=d?.writeId??null;dirty=!!d;editorSession.input.version=d?1:0;editorSession.input.retained=editorSession.input.version;
 el('groups-creature-results').replaceChildren();draw();
}
function drawList(){const root=el('groups-list');root.replaceChildren();for(const item of list.items){const button=document.createElement('button');button.type='button';button.textContent=item.title+' · '+item.count+' Figuren'+(item.locationId?' · '+(places.find(p=>p.id===item.locationId)?.name??'Ort'):' · ohne Ort');button.setAttribute('aria-pressed',String(item.id===book?.id));button.onclick=()=>run(()=>select(item.id));root.append(button);}lock();}
function drawPlaces(){if(!draft)return;const select=el<HTMLSelectElement>('groups-place');select.replaceChildren();option(select,'','Ohne Ort');for(const p of places)option(select,p.id,p.name);if(draft.locationId&&!places.some(p=>p.id===draft!.locationId))option(select,draft.locationId,'Nicht verfügbarer Ort');select.value=draft.locationId??'';}
function draw(){if(!draft||!book)return;el('groups-editor').hidden=false;el<HTMLInputElement>('groups-title').value=draft.title;el<HTMLTextAreaElement>('groups-notes').value=draft.notes;drawPlaces();el('groups-origin').textContent=book.sourceEncounterId?'Aus Vorlage '+book.plan.name+' · ursprüngliche Revision '+book.sourceRevision:'Manuell angelegte Gruppe';el('groups-draft-status').textContent=dirty?'Eingabe wiederhergestellt · noch nicht übernommen.':'Gespeicherte Gruppe · Revision '+book.revision;drawActors();drawList();lock();}
function drawActors(){const root=el('groups-actors');root.replaceChildren();if(!draft)return;for(const [index,row]of draft.actors.entries()){
 const card=document.createElement('article');card.className='session-group-card';card.dataset.actorId=row.id??'';const name=document.createElement('h4');name.textContent=(index+1)+'. '+(row.name||'Unbenannte Figur');card.append(name);
 const field=(label:string,key:'name'|'hp'|'maxHp'|'tempHp'|'conditions'|'gmNotes'|'readAloud',multiline=false)=>{const wrap=document.createElement('label'),input=multiline?document.createElement('textarea'):document.createElement('input');wrap.textContent=label;input.value=row[key];input.setAttribute('aria-label',label);if(multiline)(input as HTMLTextAreaElement).rows=3;else if(['hp','maxHp','tempHp'].includes(key))(input as HTMLInputElement).inputMode='numeric';input.oninput=()=>{row[key]=input.value;mark();};wrap.append(input);card.append(wrap);return wrap;};
 field('Name','name');const source=document.createElement('p');source.className='caption';source.textContent=draft.actors[index]!.id?'Bestehende NPC-Figur · '+row.id!.slice(0,8):'Neue Figur aus dem Kreaturkatalog';card.append(source);if(row.id){const profile=document.createElement('button');profile.type='button';profile.textContent='Weltprofil öffnen…';const actorId=row.id,current=editorOwner();profile.onclick=()=>{if(current())run(()=>openActor(actorId,current));};card.append(profile);}const health=document.createElement('div');health.className='group-health';health.append(field('Aktuelle HP','hp'),field('Maximale HP','maxHp'),field('Temporäre HP','tempHp'));card.append(health);field('Zustände','conditions');const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.checked=row.concentrating;box.oninput=()=>{row.concentrating=box.checked;mark();};label.className='check-label';label.append(box,document.createTextNode('Konzentration'));card.append(label);
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Figurennotizen';details.append(summary);card.append(details);const count=card.childElementCount;field('Zum Vorlesen','readAloud',true);field('GM-Notizen','gmNotes',true);while(card.childElementCount>count)details.append(card.children[count]!);
 const remove=document.createElement('button');remove.type='button';remove.textContent='Aus Gruppe entfernen';remove.onclick=()=>{draft!.actors.splice(index,1);mark();drawActors();};card.append(remove);root.append(card);
 }lock();}
async function keep():Promise<boolean>{
 const current=editorOwner();
 if(keepingWork.value){if(!await keepingWork.value||!current())return false;return dirty&&editorSession.input.retained!==editorSession.input.version?keep():true;}
 if(!workspace||!draft||!dirty||editorSession.input.retained===editorSession.input.version)return true;
 const token=workspace.token,n=editorSession.input.version,snapshot={...structuredClone(draft),writeId:crypto.randomUUID()},expected=writeId;
 const task=Promise.resolve().then(async()=>{try{
  unwrap(await window.campaign.keepGroupDraft(token,snapshot,expected));
  if(!current())return false;
  writeId=snapshot.writeId;draft!.writeId=snapshot.writeId;editorSession.input.retained=n;
  el('groups-draft-status').textContent='Gruppeneingabe gesichert · noch nicht übernommen.';return true;
 }catch(e){if(current())tell((e as Error).message,true);return false;}});
 keepingWork.value=task;const ok=await task;if(keepingWork.value===task)keepingWork.value=null;
 if(!current())return false;
 return ok&&editorSession.input.retained!==editorSession.input.version?keep():ok;
}
export async function flushGroups(){
 const current=editorOwner();if(timer)clearTimeout(timer);timer=null;
 if(pendingWork.value&&!await pendingWork.value)return false;
 return current()&&await keep()&&current();
}
async function execute(action:GroupAction){
 if(!workspace||pendingWork.value||hasPendingCommit(workspace.campaign.id))return false;
 const token=workspace.token,g=editorSession.generation,current=editorOwner(),command:ProgressCommand={commandId:crypto.randomUUID(),token,campaignId:workspace.campaign.id,action:structuredClone(action)};
 const task=Promise.resolve().then(async()=>{try{
  const ack=await writeConfirmed('progress',command,()=>window.campaign.executeProgress(command),current,{ownerGroups:true,token,generation:g,editing});
  if(!current())return false;
  dirty=false;editorSession.input.version=editorSession.input.retained=0;draft=null;writeId=null;pendingWork.clear(task);
  await after();if(!current())return false;
  await enter(ack.groupId);
  if(workspace?.token!==token||editorSession.generation!==g)return false;
  tell('Gruppe gespeichert.');return true;
 }catch(e){if(current())tell((e as Error).message,true);return false;}finally{pendingWork.clear(task);if(current())lock();}});
 pendingWork.value=task;lock();return task;
}
async function reload(){
 if(!workspace||!book)return;
 const current=editorOwner(),token=workspace.token,id=book.id;
 if(!await flushGroups()||!current())return;
 const n=editorSession.input.version;
 if(writeId)unwrap(await window.campaign.discardGroupDraft(token,id,writeId));
 if(!current())return;
 writeId=null;editorSession.input.retained=-1;
 if(editorSession.input.version!==n){await keep();return;}
 dirty=false;await select(id);
}
async function applyDraft(){const current=editorOwner(),n=editorSession.input.version;if(!book||!draft||!await flushGroups()||!current()||editorSession.input.version!==n)return false;if(draft.revision!==book.revision)throw new Error('Entwurf gehört zu einer anderen Gruppenrevision. Gespeicherten Stand laden.');return execute({kind:'group-edit',groupId:book.id,expectedRevision:book.revision,draft:structuredClone(draft)});}
export async function prepareGroupLocation(id:string,locationId:string){
 const token=workspace?.token,g=editorSession.generation;await openGroups(id);if(!token||workspace?.token!==token||g!==editorSession.generation||book?.id!==id||draft?.groupId!==id)throw new Error('Gruppe für Ortsbindung nicht verfügbar.');
 if(!places.some(p=>p.id===locationId))throw new Error('Zielort nicht verfügbar.');draft.locationId=locationId;el<HTMLSelectElement>('groups-place').value=locationId;mark();if(!await keep())throw new Error('Gruppenort konnte nicht als Eingabe gesichert werden.');
 el('groups-draft-status').textContent='Zielort vorbelegt · Gruppenangaben übernehmen versetzt alle enthaltenen NSCs. Andere offene Angaben bleiben erhalten.';el('groups-place').focus();
}
export async function createGroupAtLocation(locationId:string,title:string){
 const token=workspace?.token,g=editorSession.generation,current=editorOwner();if(!token||!await flushGroups()||!current())throw new Error('Offene Gruppenangaben sichern.');
 if(!await execute({kind:'group-create',title,encounterId:null,expectedEncounterRevision:null})||workspace?.token!==token||g!==editorSession.generation)throw new Error('Neue Gruppe noch nicht bestätigt. Gruppenbereich prüfen.');
 const id=book?.id;if(!id)throw new Error('Neue Gruppe gespeichert. Gruppenbereich erneut öffnen.');await prepareGroupLocation(id,locationId);if(!await applyDraft())throw new Error('Neue Gruppe gespeichert; Ortsbindung im Gruppenbereich abschließen.');
 const search=el('groups-creature-search'),details=search.closest('details');if(details)details.open=true;search.focus();return id;
}
export function initGroups(status:typeof tell,changed:typeof after,navigate:typeof enter,navigateActor?:typeof openActor){tell=status;after=changed;enter=navigate;openActor=navigateActor??(async()=>{});
 el('groups-new').onclick=()=>run(async()=>{const current=editorOwner(),id=el<HTMLSelectElement>('groups-template').value,t=templates.find(t=>t.id===id);if(!await flushGroups()||!current())return;await execute({kind:'group-create',title:t?.name??'Neue Monstergruppe',encounterId:t?.id??null,expectedEncounterRevision:t?.revision??null});});
 el('groups-search').oninput=invalidateSearch;el('groups-search-form').onsubmit=e=>{e.preventDefault();run(()=>openGroups());};el('groups-more').onclick=()=>run(moreGroups);
 for(const [id,key]of [['groups-title','title'],['groups-notes','notes'],['groups-place','locationId']] as const)el(id).oninput=()=>{if(draft){const v=el<HTMLInputElement>(id).value;if(key==='locationId')draft.locationId=v||null;else draft[key]=v;mark();}};
 el('groups-apply').onclick=()=>run(applyDraft);
 el('groups-reload').onclick=()=>run(reload);
 el('groups-creature-form').onsubmit=e=>{e.preventDefault();run(async()=>{if(!workspace||!draft)return;const current=editorOwner(),g=editorSession.generation,r=++request,results=unwrap(await window.campaign.creatures({text:el<HTMLInputElement>('groups-creature-search').value,offset:0,limit:25}));if(!current()||g!==editorSession.generation||r!==request||!draft)return;const root=el('groups-creature-results');root.replaceChildren();for(const c of results.rows){const b=document.createElement('button');b.type='button';b.textContent=c.name+' · '+c.hp+' HP';b.onclick=()=>{if(!current())return;if(!draft||draft.actors.length>=200){tell('Höchstens 200 Figuren je Gruppe.',true);return;}draft.actors.push(rowOf(c));mark();drawActors();};root.append(b);}lock();});};
 onCommitState(lock);onCommitResolved(async e=>{
  const meta=e.meta as {ownerGroups?:boolean;token?:string;generation?:number;editing?:number}|undefined;
  if(!meta?.ownerGroups||workspace?.campaign.id!==e.ref.campaignId||meta.token!==workspace.token||meta.generation!==editorSession.generation||meta.editing!==editing)return;
  const current=editorOwner();dirty=false;editorSession.input.version=editorSession.input.retained=0;draft=null;writeId=null;
  await after();if(current())await openGroups((e.value as ProgressAck).groupId);
 });
}

editorSession.onDeactivate(()=>{if(timer)clearTimeout(timer);timer=null;});

editorSession.observeDraft(()=>({openInput:dirty,retainedDraft:!!draft&&!!writeId,unresolvedCommand:!!workspace&&hasPendingCommit(workspace.campaign.id)}));

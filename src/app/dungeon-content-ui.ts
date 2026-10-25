import {EditorSession} from './editor-session';
import {atlasDrawingWrite,graphPreviewTarget,graphPreviewMatches} from './campaign-atlas-author';
import type {WorkspaceGeometry,Room} from './contracts';
import type {GraphView} from './graph-contracts';
import type {DrawingElement} from './drawing-contracts';
import type {DungeonContent} from './dungeon-budget-contracts';
import {dungeonContentAnchor} from './dungeon-content-model';
export const editorSession = new EditorSession();
const pendingWork = editorSession.operation<Promise<boolean>>();

const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const field=(id:string)=>el<HTMLInputElement>(id),select=(id:string)=>el<HTMLSelectElement>(id);
const fields=['content-room','content-kind','content-reference','content-name','content-public','content-notes','content-tags','content-categories','content-x','content-y','content-z','content-xp','content-encounter-owner','content-search-method','content-search-dc','content-search-notes','content-revealed'] as const;
type Form={values:string[];secret:boolean};
let workspace:()=>WorkspaceGeometry|null,selected:()=>Room|null,before:()=>Promise<boolean>,publish:(w:WorkspaceGeometry)=>Promise<void>,notify:()=>Promise<void>,tell:(s:string,error?:boolean)=>void;
let data:GraphView|null=null, element:DrawingElement|null=null, scopeId='', readVersion=0, openVersion=0, frame=0;
let writing=false, failed=false, baseline:Form|null=null;
const cancelled=Symbol('obsolete content operation');
const snapshot=():Form=>({values:fields.map(id=>field(id).value),secret:field('content-secret').checked});
const same=(a:Form,b:Form)=>a.secret===b.secret&&a.values.every((v,i)=>v===b.values[i]);
const dirty=()=>baseline!==null&&!same(snapshot(),baseline);
function owner(){const w=workspace();return {generation:editorSession.generation,token:w?.token,campaignId:w?.campaign.id,target:graphPreviewTarget(w?.graphPreview)};}
function owns(o:ReturnType<typeof owner>){const w=workspace();return o.generation===editorSession.generation&&o.token===w?.token&&o.campaignId===w?.campaign.id&&graphPreviewMatches(o.target,w?.graphPreview);}
function run(fn:()=>Promise<void>){
 if(pendingWork.value)return;
 const o=owner();failed=false;
 const job=fn().then(()=>true).catch(e=>{if(e!==cancelled&&owns(o)){failed=true;tell(e instanceof Error?e.message:String(e),true);}return false;});
 pendingWork.value=job;
}
function canLeave(){if(writing||dirty()){tell('Laufende Änderung oder offene Inhaltseingaben zuerst übernehmen oder verwerfen.',true);return false;}return true;}
function close(){if(!canLeave())return;openVersion++;readVersion++;el<HTMLDialogElement>('content-dialog').close();}
function options(id:string,choices:{id:string;name:string}[],value:string,empty:string){
 const s=select(id);s.replaceChildren();
 for(const choice of [{id:'',name:empty},...choices,...(value&&!choices.some(c=>c.id===value)?[{id:value,name:'Erhaltene Zuordnung · '+value}]:[])]){
  const o=document.createElement('option');o.value=choice.id;o.textContent=choice.name;s.append(o);
 }
 s.value=value;
}
function choices(){
 const kind=select('content-kind').value,id=select('content-reference').value;
 const list=kind==='encounter'?(select('content-encounter-owner').value==='group'?data?.budget?.groups:data?.budget?.encounters):kind==='loot'?data?.budget?.treasures:[];
 options('content-reference',list??[],id,'Noch keine konkrete Inhaltszuordnung');select('content-reference').disabled=!['encounter','loot'].includes(kind);
}
function roomChoices(value:string){
 options('content-room',data?.geometry.rooms.filter(r=>r.scopeId===scopeId&&data?.geometry.drawing.volumes?.some(v=>v.roomId===r.id)).map(r=>({id:r.id,name:r.number+'. '+r.name}))??[],value,'Raum mit Volumen wählen');
}
function drawForm(){
 if(!data)return;el('content-reference-detail').textContent='';
 roomChoices(element?element.roomId??'':selected()?.id??'');
 field('content-name').value=element?.name??'Neuer Dungeon-Inhalt';select('content-kind').value=element?.feature??'curiosity';
 select('content-encounter-owner').value=element?.content?.reference?.kind==='group'?'group':'encounter';field('content-search-method').value=element?.content?.search?.method??'';field('content-search-dc').value=element?.content?.search?.dc===null||element?.content?.search?.dc===undefined?'':String(element.content.search.dc);field('content-search-notes').value=element?.content?.search?.notes??'';field('content-revealed').value=element?.content?.search?.revealedText??'';field('content-public').value=element?.content?.publicText??'';field('content-notes').value=element?.notes??'';
 field('content-tags').value=(element?.content?.tags??(element?.feature==='puzzle'?['Puzzle']:[])).join(', ');
 field('content-categories').value=(element?.content?.categories??[]).join(', ');
 for(const axis of ['x','y','z'] as const)field('content-'+axis).value=String(element?.content?.anchor[axis]??0);
 field('content-secret').checked=element?.secret??false;
 field('content-xp').value=element?.content?.trapXp===null||element?.content?.trapXp===undefined?'':String(element.content.trapXp);
 options('content-reference',[],element?.content?.reference?.id??'','Noch keine konkrete Inhaltszuordnung');choices();
 el('content-source-copy').textContent=element?.content?.sourceReference?'Kopie mit erhaltenem Quellenbezug. Für einen zweiten physischen Encounter oder Loot eine unabhängige Inhaltskopie zuordnen.':'';
 baseline=snapshot();
}
async function refresh(){
 const w=workspace(),o=owner(),version=++readVersion,targetScope=scopeId;if(!w)return false;
 const r=await window.campaign.graph(w.token,targetScope);
 if(!owns(o)||version!==readVersion||targetScope!==scopeId)return false;
 if(!r.ok)throw new Error(r.error);
 data=r.value;drawList();roomChoices(select('content-room').value);choices();return true;
}
async function detail(e:DrawingElement){
 const w=workspace(),o=owner(),intent=openVersion,ref=e.content?.reference;if(!w||!ref)return;
 if(ref.kind==='encounter'){
  const r=await window.campaign.encounterPlan(w.token,ref.id);if(!owns(o)||intent!==openVersion)throw cancelled;if(!r.ok)throw new Error(r.error);
  el('content-reference-detail').textContent=r.value.name+'\n'+r.value.entries.map(entry=>entry.count+' × '+(r.value.sources.find(c=>c.id===entry.creatureId)?.name??'Unbekannte Quelle')).join('\n')+'\n\n'+r.value.notes;
 }else if(ref.kind==='group'){const r=await window.campaign.preparedGroup(w.token,ref.id);if(!owns(o)||intent!==openVersion)throw cancelled;if(!r.ok)throw new Error(r.error);el('content-reference-detail').textContent=r.value.title+'\n'+r.value.actors.map(a=>a.name+' · '+a.hp+' / '+a.maxHp+' HP').join('\n')+'\n'+r.value.notes;
 }else{
  const r=await window.campaign.treasure(w.token,ref.id);if(!owns(o)||intent!==openVersion)throw cancelled;if(!r.ok)throw new Error(r.error);
  const money=(copper:string)=>{const n=BigInt(copper);return String(n/100n)+','+String(n%100n).padStart(2,'0')+' GP';};
  el('content-reference-detail').textContent=r.value.title+'\n'+r.value.items.map(item=>(item.quantity-item.allocated)+' × '+item.name+' · '+(item.unitCopper===null?'Wert unbekannt':money(item.unitCopper))).join('\n');
 }
}
function drawList(){
 const list=el('content-list');list.replaceChildren();
 for(const e of data?.geometry.drawing.elements.filter(e=>e.scopeId===scopeId&&e.kind==='feature'&&!e.archived)??[]){
  const article=document.createElement('article'),title=document.createElement('h3'),text=document.createElement('p'),edit=document.createElement('button'),fact=data?.budget?.facts.find(f=>f.id===e.id);
  title.textContent=e.name+' · '+e.feature;
  text.textContent=(['encounter','loot'].includes(e.feature)?fact?.referenceLabel||'Inhaltszuordnung offen':e.feature==='trap'?'XP-Ansatz '+(e.content?.trapXp??'offen'):[...(e.content?.categories??[]),...(e.content?.tags??[])].join(' · '))+(fact?.problem?' · '+fact.problem:'');
  if(e.content?.publicText){const publicText=document.createElement('p');publicText.textContent=e.content.publicText;article.append(publicText);}
  if(e.notes){const notes=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('pre');summary.textContent='GM-Kontext';body.textContent=e.notes;notes.append(summary,body);article.append(notes);}
  edit.textContent='Inhalt / Voxelanker bearbeiten';edit.onclick=()=>{if(!canLeave())return;element=structuredClone(e);frame++;drawForm();};article.append(title,text,edit);
  if(e.content?.reference){const button=document.createElement('button');button.textContent='Originalinhalt ansehen';button.onclick=()=>run(()=>detail(e));article.append(button);}
  const remove=document.createElement('button');remove.textContent='Geometrische Platzierung entfernen';remove.onclick=()=>{if(!canLeave())return;run(()=>write({...e,roomId:null},e.revision,element?.id===e.id));};article.append(remove);list.append(article);
 }
}
async function write(value:DrawingElement,expected:number|null,adopt=true){
 const w=workspace(),o=owner(),editor=frame,raw=snapshot();if(!w)throw cancelled;
 if(!graphPreviewMatches(graphPreviewTarget(data?.preview),w.graphPreview,true))throw new Error('Inhaltsquelle inzwischen geändert. Neu laden.');
 const request={commandId:crypto.randomUUID(),token:w.token,campaignId:w.campaign.id,target:graphPreviewTarget(w.graphPreview),action:{kind:'element' as const,element:structuredClone(value),expectedRevision:expected}};
 writing=true;readVersion++;
 try{
  const ready=await before();if(!owns(o)||!graphPreviewMatches(request.target,workspace()?.graphPreview,true))throw cancelled;if(!ready)throw new Error('Offene Eingaben zuerst übernehmen oder verwerfen.');
  const r=await atlasDrawingWrite(request);if(!owns(o)||!graphPreviewMatches(request.target,workspace()?.graphPreview,true))throw cancelled;if(!r.ok)throw new Error(r.error);
  if(!graphPreviewMatches(request.target,r.value.workspace.graphPreview))throw new Error('Zeichenantwort gehört zu einer anderen Vorschau.');
  readVersion++;
  if(data)data={...data,geometry:{...data.geometry,rooms:r.value.workspace.rooms,drawing:r.value.view}};
  if(adopt&&editor===frame){
   element=r.value.view.elements.find(e=>e.id===value.id)??null;
   const unchanged=same(snapshot(),raw);baseline=raw;if(unchanged)drawForm();
  }
  try{
   await publish(r.value.workspace);if(!owns(o))throw cancelled;
   await refresh();if(!owns(o))throw cancelled;
   await notify();if(!owns(o))throw cancelled;
  }catch(e){if(!owns(o)||e===cancelled)throw cancelled;tell('Dungeon-Inhalt gespeichert; Anzeige konnte nicht vollständig aktualisiert werden: '+(e instanceof Error?e.message:String(e)),true);return;}
  tell('Dungeon-Inhalt und Platzierung gespeichert.');
 }finally{if(o.generation===editorSession.generation&&o.token===workspace()?.token)writing=false;}
}
async function save(){
 if(!data)return;
 const room=data.geometry.rooms.find(r=>r.id===select('content-room').value),volume=data.geometry.drawing.volumes?.find(v=>v.roomId===room?.id);
 if(!room||!volume)throw new Error('Raum mit vorhandenem Volumen wählen.');
 const coordinates=['x','y','z'].map(axis=>field('content-'+axis).value);if(coordinates.some(v=>!v.trim()||!Number.isSafeInteger(Number(v))))throw new Error('X, Y und Höhe als ganze Rasterzellen angeben.');
 const referenceId=select('content-reference').value,kind=select('content-kind').value as DrawingElement['feature'];
 const content:DungeonContent={reference:['encounter','loot'].includes(kind)&&referenceId?{kind:kind==='loot'?'treasure':select('content-encounter-owner').value as 'encounter'|'group',id:referenceId}:null,sourceReference:element?.content?.sourceReference??null,search:{method:field('content-search-method').value,dc:field('content-search-dc').value===''?null:Number(field('content-search-dc').value),notes:field('content-search-notes').value,revealedText:field('content-revealed').value},publicText:field('content-public').value,categories:field('content-categories').value.split(',').map(s=>s.trim()).filter(Boolean),tags:field('content-tags').value.split(',').map(s=>s.trim()).filter(Boolean),trapXp:field('content-xp').value===''?null:Number(field('content-xp').value),anchor:{volumeId:volume.id,x:Number(coordinates[0]),y:Number(coordinates[1]),z:Number(coordinates[2])}};
 const e:DrawingElement={...(element??{id:crypto.randomUUID(),revision:0,scopeId,floorId:room.floorId,roomId:room.id,kind:'feature',points:[{x:0,y:0}],name:'',notes:'',secret:false,color:'#907249',width:.5,height:.5,angle:0,variant:'',blocksSight:false,blocksSound:false,passable:true,state:'open',targetRoomId:null,targetFloorId:null,anchor:null,feature:kind,maxCharges:1,resetSeconds:0,resetMode:'empty',triggerRadius:1.524,triggerHeight:3.048,assetId:null,zOffsetMeters:0,verticalMeters:1,archived:false}),scopeId,floorId:room.floorId,roomId:room.id,name:field('content-name').value,notes:field('content-notes').value,secret:field('content-secret').checked,feature:kind,content};
 const anchor=dungeonContentAnchor(data.geometry,e);if(!anchor)throw new Error('Die gewählte ganze Rasterzelle liegt nicht im Volumen.');
 e.points=[anchor.point];e.zOffsetMeters=anchor.zOffsetMeters;await write(e,element?.revision??null);
}
async function open(){
 if(!canLeave())return;
 const o=owner(),intent=++openVersion,targetScope=selected()?.scopeId;
 const ready=await before();if(!owns(o)||intent!==openVersion)throw cancelled;if(!ready)throw new Error('Offene Eingaben zuerst übernehmen oder verwerfen.');
 if(!targetScope)throw new Error('Raum auswählen.');scopeId=targetScope;
 if(!await refresh()||!owns(o)||intent!==openVersion)return;
 element=null;frame++;drawForm();el<HTMLDialogElement>('content-dialog').showModal();
}
export function initDungeonContent(status:typeof tell,w:typeof workspace,r:typeof selected,drain:typeof before,changed:typeof publish,onChange:typeof notify){
 tell=status;workspace=w;selected=r;before=drain;publish=changed;notify=onChange;
 el('dungeon-content-open').onclick=()=>run(open);el('content-close').onclick=close;
 el('content-dialog').addEventListener('cancel',event=>{event.preventDefault();close();});
 el('content-new').onclick=()=>{if(!canLeave())return;element=null;frame++;drawForm();};
 el('content-save').onclick=()=>run(save);
 el('content-encounter-owner').onchange=()=>{select('content-reference').value='';choices();};el('content-kind').onchange=()=>{select('content-reference').value='';choices();};
 el('content-discard').onclick=()=>{
  if(writing){tell('Inhalt wird noch bestätigt.',true);return;}
  run(async()=>{
   const o=owner(),editor=frame,intent=openVersion,raw=snapshot();
   if(!await refresh()||!owns(o)||editor!==frame||intent!==openVersion)return;
   if(!same(snapshot(),raw)){tell('Neuere Inhaltseingaben bleiben erhalten.');return;}
   if(element)element=data?.geometry.drawing.elements.find(e=>e.id===element?.id)??null;
   frame++;drawForm();
  });
 };
}
export function activateDungeonContent(){editorSession.generation++;readVersion++;openVersion++;frame++;pendingWork.value=null;writing=false;failed=false;baseline=null;data=null;element=null;scopeId='';el('content-reference-detail').textContent='';el<HTMLDialogElement>('content-dialog').close();}
export async function flushDungeonContent(){const o=owner(),job=pendingWork.value;const ok=job?await job:true;return owns(o)&&ok&&!failed&&!dirty();}

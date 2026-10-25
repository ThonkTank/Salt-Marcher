import {EditorSession} from './editor-session';
import {scrollTextareaToOffset} from './textarea-position';
import {editTextareaText,type KeyPassageTarget} from './key-reading-model';
import {KeyNoteCapture} from './key-note-capture';
import {RoomKeySearchIndex,type KeySearchHit} from './key-search';
import {KeyNoteContext} from './key-note-context';
import {KeyPlanContext,type KeyPlanReturn} from './key-plan-context';
import {atlasDefaultRoomWrite} from "./campaign-atlas-author";
import {atlasDrawingWrite,graphPreviewTarget,graphPreviewMatches} from './campaign-atlas-author';
import {initKeyCopy,invalidateKeyCopy,syncKeyCopyControl} from './key-copy-ui';
import {drawSurfaceKey} from './surface-key-ui';
import type {WorkspaceGeometry,Workspace,Room} from './contracts';
import type {DrawingView,DrawingAction} from './drawing-contracts';
import type {KeyContent,KeyBlock,KeyBatch,KeyTextEdit} from './key-contracts';
import {emptyKey} from './key-contracts';
import {renderDungeonKey,expandedKeyBlocks,keyAttributes} from './key-model';
import type {DungeonGeometry} from './dungeon-contracts';
export const editorSession = new EditorSession();
const pendingWork = editorSession.operation<Promise<void>>();

const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T,field=(id:string)=>el<HTMLInputElement>(id),select=(id:string)=>el<HTMLSelectElement>(id),uuid=()=>crypto.randomUUID();let workspace:()=>WorkspaceGeometry|null, selected:()=>Room|null, before:()=>Promise<boolean>, publish:(w:WorkspaceGeometry)=>Promise<void>, navigate:(id:string)=>Promise<void>, tell:(s:string,error?:boolean)=>void, data:DrawingView|null=null, geometry:DungeonGeometry|null=null, draft:KeyContent|null=null, roomId:string|null=null, scopeId='';let references:{kind:string;id:string;label:string}[]=[];const picked=new Set<string>();let matchedRooms:Room[]=[],listPage=0;const listPageSize=100,roomNumberOrder=new Intl.Collator(undefined,{numeric:true});
let readVersion=0,editVersion=0,composing=false;
let searchIndex:RoomKeySearchIndex|null=null,searchData:DrawingView|null=null,searchReferences:typeof references|null=null;
let noteContext:KeyNoteContext|null=null;
let planContext:KeyPlanContext|null=null;
interface KeyNavigation {
 open:(id:string,current:()=>boolean)=>Promise<boolean>;
 flush:()=>Promise<boolean>;
 map?:(id:string)=>Promise<void>;
 plan?:(id:string,current:()=>boolean)=>Promise<boolean>;
 showKeyWorkspace?:()=>void;
}
let legacyDraft=new Map<string,string>();
let noteCapture:KeyNoteCapture|null=null,captureButton:HTMLButtonElement|null=null;
let keyReturn:(()=>void)|null=null,keyLeave:(()=>void)|null=null;
let timer:ReturnType<typeof setTimeout>|null=null,blocked=false,editorLocked=false,transition=0,baseSignature='',baseRoomRevision:number|null=null,baseKeyRevision:number|null=null,acknowledged:Workspace|null=null;
type PreparedBatch={owner:ReturnType<typeof owner>;rooms:{id:string;expectedRevision:number;keyRevision:number|null}[];patch:KeyBatch};
let preparedBatch:PreparedBatch|null=null;
function showKeyDialog(){const dialog=el<HTMLDialogElement>('key-dialog');if(document.body.classList.contains('atlas-workspace')){document.dispatchEvent(new Event('atlas-key-panel'));if(!dialog.open)dialog.show();}else if(!dialog.open)dialog.showModal();}
function saveState(state:string,text:string){const status=el('key-save-status');status.dataset.state=state;status.textContent=text;}
function signature(content:KeyContent,number:string|null,legacy:[string,string][]=[]){return JSON.stringify({content:{...content,revision:0},number,legacy});}
function currentSignature(){return draft?signature(collect(),draft.kind==='room'?field('key-number').value:null,draft.kind==='room'?[...legacyDraft]:[]):'';}
function dirty(){return !!draft&&currentSignature()!==baseSignature;}
function establishBase(force=false){if(timer)clearTimeout(timer);timer=null;baseKeyRevision=draft?records().find(k=>k.id===draft!.id)?.revision??null:null;baseRoomRevision=draft?.kind==='room'?keyRooms().find(r=>r.id===draft!.id)?.revision??null:null;baseSignature=force?'':currentSignature();blocked=false;saveState(force?'dirty':'saved',force?'Eingabe offen – wird automatisch gespeichert.':'Keine offenen Änderungen.');}
function lockEditor(){for(const c of el('key-dialog').querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement|HTMLTextAreaElement>('input,button,select,textarea'))c.disabled=editorLocked;if(!editorLocked){field('key-number').disabled=draft?.kind!=='room';field('key-zsteps').disabled=draft?.kind!=='level';select('key-level').disabled=!draft||!['room','group'].includes(draft.kind);select('key-group').disabled=draft?.kind!=='room';el<HTMLButtonElement>('key-map').disabled=!geometry?.rooms.some(r=>r.id===roomId);}updateSelectionCount();updateListControls();if(!editorLocked)syncKeyCopyControl();syncTemplateTargets();}
function reportFailure(error:unknown){blocked=true;saveState('error','Eingabe bleibt offen: '+(error as Error).message);tell((error as Error).message+' Eingabe bleibt erhalten.',true);}
function owner(){const w=workspace();return{generation:editorSession.generation,token:w?.token,campaignId:w?.campaign.id,target:graphPreviewTarget(w?.graphPreview)};}
function owns(o:ReturnType<typeof owner>){const w=workspace();return o.generation===editorSession.generation&&o.token===w?.token&&o.campaignId===w?.campaign.id&&graphPreviewMatches(o.target,w?.graphPreview);}
function schedule(){
 if(timer)clearTimeout(timer);timer=null;if(!draft)return;if(composing){saveState('dirty','Texteingabe läuft noch.');return;}
 try{if(!dirty()){saveState('saved','Keine offenen Änderungen.');return;}}catch{}
 saveState('dirty','Eingabe offen – wird automatisch gespeichert.');
 const o=owner(),handle=setTimeout(()=>{if(!owns(o)||timer!==handle)return;timer=null;if(!blocked&&!pendingWork.value)run(save);},350);timer=handle;
}
function run(fn:()=>Promise<void>,lock=false){
 if(pendingWork.value)return;
 const o=owner();editorLocked=lock;lockEditor();
 const task=Promise.resolve().then(()=>{if(owns(o))return fn();}).catch(e=>{if(owns(o))reportFailure(e);}).finally(()=>{
  pendingWork.clear(task);if(o.generation!==editorSession.generation||o.token!==workspace()?.token)return;
  editorLocked=false;lockEditor();if(!owns(o))return;if(!blocked)try{if(dirty())schedule();}catch(e){reportFailure(e);}
 });pendingWork.value=task;
}
async function moveEditor(action:()=>Promise<void>|void){const o=owner(),intent=++transition;if(!(await flushKeys())||!owns(o)||intent!==transition)return false;await action();return owns(o)&&intent===transition;}
const records=()=>data?.keyContent??[];const keyRooms=()=>{const w=workspace(),latest=new Map<string,Room>();for(const r of [...(geometry?.rooms??[]),...(acknowledged?.token===w?.token?acknowledged?.rooms??[]:[])])if((latest.get(r.id)?.revision??-1)<r.revision)latest.set(r.id,r);const visible=[...latest.values()],ids=new Set(visible.map(r=>r.id));return [...visible,...(data?.hiddenRooms??[]).filter(r=>!ids.has(r.id))];};function block(kind:KeyBlock['kind']='text',visibility:KeyBlock['visibility']='public'):KeyBlock{return{id:uuid(),kind,visibility,text:'',templateId:null,suppressed:[],searchMethod:'',dc:null,discoveryNotes:'',revealedText:''};}
function attrText(attrs:KeyContent['attributes']){return Object.entries(attrs).map(([key,value])=>value===null?'!'+key:key+' = '+value).join('\n');}function attrs(value:string){const out:KeyContent['attributes']={};for(const line of value.split('\n').filter(s=>s.trim())){if(line.startsWith('!'))out[line.slice(1).trim()]=null;else{const at=line.indexOf('=');if(at<1)throw new Error('Attribute: Name = Wert; !Name unterdrückt einen geerbten Wert.');out[line.slice(0,at).trim()]=line.slice(at+1).trim();}}return out;}
function optionList(id:string,rows:{id:string;name:string}[],value:string|null,label='Kein Eintrag'){const s=select(id);s.replaceChildren();for(const r of [{id:'',name:label},...rows]){const o=document.createElement('option');o.value=r.id;o.textContent=r.name;s.append(o);}s.value=value??'';}
async function command(action:DrawingAction){
 const w=workspace(),o=owner();if(!w)return null;
 if(!graphPreviewMatches(graphPreviewTarget(data?.graphPreview),w.graphPreview,true))throw new Error('Keyquelle inzwischen geändert. Neu laden.');
 const request={commandId:uuid(),token:w.token,campaignId:w.campaign.id,target:graphPreviewTarget(w.graphPreview),action:structuredClone(action)};
 const ready=await before();if(!owns(o)||!graphPreviewMatches(request.target,workspace()?.graphPreview,true))return null;if(!ready)throw new Error('Andere offene Eingaben zuerst prüfen.');
 readVersion++;
 const r=await atlasDrawingWrite(request);if(!owns(o)||!graphPreviewMatches(request.target,workspace()?.graphPreview,true))return null;if(!r.ok)throw new Error(r.error);
 if(!graphPreviewMatches(request.target,r.value.workspace.graphPreview))throw new Error('Zeichenantwort gehört zu einer anderen Vorschau.');
 readVersion++;data=r.value.view;acknowledged=r.value.workspace;advancePreparedBatch(request.action,r.value);
 try{await publish(r.value.workspace);}catch(e){if(owns(o))tell('Key gespeichert; Kartenanzeige konnte nicht aktualisiert werden: '+(e as Error).message,true);}
 if(!owns(o))return null;
 const version=++readVersion;
 try{const view=await window.campaign.dungeonAuthoring(w.token);if(!owns(o))return null;if(version===readVersion)geometry=view.ok?view.value:null;}catch(e){if(!owns(o))return null;if(version===readVersion)geometry=null;}
 drawList();drawOwners();return r.value;
}
async function refresh(){
 const w=workspace(),o=owner(),version=++readVersion;if(!w)return false;
 const view=await window.campaign.dungeonAuthoring(w.token);if(!owns(o)||version!==readVersion)return false;if(!view.ok)throw new Error(view.error);
 const prep=await window.campaign.preparation(w.token,'');if(!owns(o)||version!==readVersion)return false;if(!prep.ok)throw new Error(prep.error);
 data=view.value.drawing;geometry=view.value;
 references=[...prep.value.notes.filter(n=>!n.trashed).map(n=>({kind:n.note.kind,id:n.note.id,label:n.note.title})),...prep.value.locations.filter(l=>!l.trashed).map(l=>({kind:'location',id:l.document.id,label:l.document.name})),...prep.value.plans.map(p=>({kind:'plan',id:p.id,label:p.name}))];
 drawOwners();if(el<HTMLDialogElement>('key-dialog').open)drawList();return true;
}
function advancePreparedBatch(action:DrawingAction,confirmed:{workspace:WorkspaceGeometry;view:DrawingView}){
 if(!preparedBatch||!owns(preparedBatch.owner))return;
 if(action.kind==='key-content'){const link=preparedBatch.patch.linkTemplate;if(link?.id===action.content.id&&link.revision===action.expectedRevision){const saved=confirmed.view.keyContent?.find(k=>k.id===link.id&&k.kind==='template');if(saved)link.revision=saved.revision;}return;}
 if(action.kind!=='key-batch')return;
 const before=new Map(action.rooms.map(r=>[r.id,r])),rooms=new Map([...confirmed.workspace.rooms,...confirmed.view.hiddenRooms].map(r=>[r.id,r])),keys=new Map(confirmed.view.keyContent?.map(k=>[k.id,k])??[]);
 for(const target of preparedBatch.rooms){
  const previous=before.get(target.id),room=rooms.get(target.id),key=keys.get(target.id);
  if(previous&&room&&key&&previous.expectedRevision===target.expectedRevision&&previous.keyRevision===target.keyRevision){target.expectedRevision=room.revision;target.keyRevision=key.revision;}
 }
}
async function reload(){
 const o=owner(),intent=++transition,version=editVersion,id=draft?.id,kind=draft?.kind;
 if(timer)clearTimeout(timer);timer=null;
 try{
  await pendingWork.value;if(!owns(o)||intent!==transition)return;
  if(version!==editVersion){tell('Neuere Key-Eingaben bleiben erhalten.');return;}
  if(!await refresh()||!owns(o)||intent!==transition)return;
  if(version!==editVersion){tell('Neuere Key-Eingaben bleiben erhalten.');return;}
  blocked=false;
  if(kind==='room'&&id)openRoom(id);else{draft=structuredClone(records().find(k=>k.id===id)??draft);drawOwners();drawForm();establishBase();}
 }catch(e){if(owns(o)&&intent===transition)reportFailure(e);}
}
function batchPatch():KeyBatch{
 const name=select('key-batch-field').value,patch:KeyBatch={},edit:KeyTextEdit={mode:select('key-batch-mode').value as KeyTextEdit['mode'],text:field('key-batch-text').value,search:field('key-batch-search').value};
 if(['name','readAloud','gmNotes','legacyText'].includes(name))Object.assign(patch,{[name]:edit});
 else if(name==='number')patch.renumberStart=Number(edit.text);
 else if(name==='attributes')patch.attributes=attrs(edit.text);
 else if(name==='tags')patch.tags=edit.text.split(',').map(s=>s.trim()).filter(Boolean);
 else if(name==='status')patch.status=edit.text;
 else if(name==='secret')patch.secret=edit.text.trim().toLowerCase()==='ja';
 else if(name==='levelId')patch.levelId=select('key-level').value||null;
 else if(name==='groupId')patch.groupId=select('key-group').value||null;
 else if(name==='blocks')patch.blocks=collect().blocks.map(b=>({...b,id:uuid()}));
 else if(name==='references')patch.references=collect().references;
 return patch;
}
function applyBatch(){
 const o=owner();
 let batch:PreparedBatch;
 try{batch={owner:o,rooms:keyRooms().filter(r=>picked.has(r.id)).map(r=>({id:r.id,expectedRevision:r.revision,keyRevision:records().find(k=>k.id===r.id&&k.kind==='room')?.revision??null})),patch:structuredClone(batchPatch())};}catch(e){reportFailure(e);return;}
 preparedBatch=batch;
 void flushKeys().then(okay=>{
  if(!okay||!owns(o)||preparedBatch!==batch){if(preparedBatch===batch)preparedBatch=null;return;}
  run(async()=>{
   const committed=await command({kind:'key-batch',rooms:batch.rooms,patch:batch.patch});
   if(!committed||!owns(o))return;
   if(roomId)openRoom(roomId);tell(batch.rooms.length+' Räume in einer gemeinsamen Aktion bearbeitet.');
  },true);if(preparedBatch===batch)preparedBatch=null;
 });
}
function templateTargets(){return keyRooms().filter(r=>r.scopeId===scopeId&&(picked.size?picked.has(r.id):draft?.kind==='room'&&r.id===roomId));}
function drawTemplateControl(){
 const choice=el<HTMLSelectElement>('key-template-choice');if(!choice)return;
 const templates=records().filter(k=>k.kind==='template'&&k.scopeId===scopeId),old=choice.value;
 const current=draft?.kind==='template'?draft.id:draft?.blocks.find(b=>b.kind==='template')?.templateId;
 optionList('key-template-choice',templates,templates.some(t=>t.id===old)?old:current??(templates.length===1?templates[0]!.id:null),'Textvorlage wählen');
 syncTemplateTargets();
}
function syncTemplateTargets(){
 const choice=el<HTMLSelectElement>('key-template-choice');if(!choice)return;
 const targets=templateTargets(),template=records().find(t=>t.kind==='template'&&t.id===choice.value&&t.scopeId===scopeId);
 const linked=targets.filter(r=>{const key=records().find(k=>k.id===r.id&&k.kind==='room')??emptyKey(r);return key.blocks.some(b=>b.kind==='template'&&b.templateId===template?.id);}).length;
 el('key-template-targets').textContent=targets.length?'Ziel'+(targets.length===1?'':'e')+': '+targets.map(r=>r.number+'. '+r.name).join(' · ')+(linked?' · '+linked+' bereits verknüpft.':''):'Einen Raum öffnen oder links Zielräume markieren.';
 const apply=el<HTMLButtonElement>('key-template-link');apply.textContent=targets.length>1?'Mit '+targets.length+' markierten Räumen verknüpfen':'Mit Raum verknüpfen';apply.disabled=editorLocked||!template||!targets.length||linked===targets.length;
 el<HTMLButtonElement>('key-template-edit').disabled=editorLocked||!template;
}
function linkTemplate(){
 const o=owner(),id=select('key-template-choice').value,template=records().find(t=>t.id===id&&t.kind==='template'&&t.scopeId===scopeId),targets=templateTargets();if(!template||!targets.length)return;
 const batch:PreparedBatch={owner:o,rooms:targets.map(r=>({id:r.id,expectedRevision:r.revision,keyRevision:records().find(k=>k.id===r.id&&k.kind==='room')?.revision??null})),patch:{linkTemplate:{id,revision:template.revision}}};preparedBatch=batch;
 el('key-template-status').textContent='Vorlage wird mit '+targets.length+' Räumen verknüpft…';
 void flushKeys().then(ok=>{
  if(!ok||!owns(o)||preparedBatch!==batch){if(preparedBatch===batch)preparedBatch=null;return;}
  run(async()=>{try{const result=await command({kind:'key-batch',rooms:batch.rooms,patch:batch.patch});if(!result||!owns(o))return;if(roomId)openRoom(roomId);el('key-template-status').textContent='Textvorlage mit '+targets.length+' Räumen verknüpft. Individuelle Inhalte erhalten. Gemeinsames Rückgängig verfügbar.';}catch(error){el('key-template-status').textContent='Verknüpfung nicht bestätigt. Speicherstatus prüfen.';throw error;}finally{if(preparedBatch===batch)preparedBatch=null;}},true);
 }).catch(error=>{if(owns(o)){el('key-template-status').textContent='Verknüpfung nicht bestätigt. Speicherstatus prüfen.';reportFailure(error);}});
}
async function openKeyWorkspace(){
 const o=owner();if(!await flushKeys()||!owns(o)||!await before()||!owns(o)||!await refresh()||!owns(o))return;
 const rooms=keyRooms(),room=rooms.find(r=>r.id===selected()?.id)??rooms.sort((a,b)=>roomNumberOrder.compare(a.number,b.number))[0];
 if(!room){tell('Zuerst einen Raum im Atlas anlegen.',true);return;}await openRoomKey(room.id,()=>owns(o));
}
function drawOwners(){optionList('key-owner',[{id:'@room',name:'Ausgewählter Raum'},{id:'@dungeon',name:'Dungeonwerte'},...records().filter(r=>r.scopeId===scopeId&&['level','group','template','surface'].includes(r.kind)).map(r=>({id:r.id,name:({level:'Level',group:'Gruppe',template:'Vorlage',surface:'Oberfläche'} as Record<string,string>)[r.kind]+': '+r.name}))],draft?.kind==='room'?'@room':draft?.kind==='dungeon'?'@dungeon':draft?.id??'@room');drawTemplateControl();}
function openRoom(id:string){if(id!==roomId){invalidateKeyCopy();noteContext?.reset();}const room=keyRooms().find(r=>r.id===id);if(!room)throw new Error('Raum nicht mehr verfügbar.');roomId=id;scopeId=room.scopeId;draft=structuredClone(records().find(k=>k.kind==='room'&&k.id===id)??emptyKey(room));drawOwners();drawForm();establishBase();drawList(true);}
function updateSelectionCount(){const visible=new Set(matchedRooms.map(r=>r.id)),outside=[...picked].filter(id=>!visible.has(id)).length;const count=el('key-selection-count');count.hidden=picked.size===0;count.textContent=picked.size+' Räume für Sammeländerung ausgewählt'+(outside?' · '+outside+' außerhalb des Filters':'');el<HTMLButtonElement>('key-batch-apply').disabled=editorLocked||picked.size===0;syncTemplateTargets();}
function updateListControls(){const pages=Math.ceil(matchedRooms.length/listPageSize),start=listPage*listPageSize;el('key-list-range').textContent=matchedRooms.length+' Räume'+(pages>1?' · '+(start+1)+'–'+Math.min(start+listPageSize,matchedRooms.length)+' angezeigt':'');el('key-list-pages').hidden=pages<=1;el<HTMLButtonElement>('key-list-prev').disabled=editorLocked||listPage===0;el<HTMLButtonElement>('key-list-next').disabled=editorLocked||listPage+1>=pages;}
function drawList(followSelection=false){
 const list=el('key-room-list');list.replaceChildren();
 if(!searchIndex||searchData!==data||searchReferences!==references){searchIndex=new RoomKeySearchIndex(records(),references);searchData=data;searchReferences=references;}
 const q=field('key-search').value.trim(),level=select('key-filter-level').value,group=select('key-filter-group').value,filter=select('key-filter').value,rooms=keyRooms().filter(r=>r.scopeId===scopeId),byId=new Map(records().map(k=>[k.id,k])),visibleIds=new Set(geometry?.rooms.map(r=>r.id)??[]),features=new Set(data?.elements.filter(e=>!e.archived&&e.kind==='feature').map(e=>e.roomId)??[]),hits=new Map<string,KeySearchHit>();
 matchedRooms=rooms.sort((a,b)=>roomNumberOrder.compare(a.number,b.number)).filter(room=>{
  const content=byId.get(room.id),key=content?.kind==='room'?content:undefined;
  if(level&&(key?.levelId??'')!==level||group&&(key?.groupId??'')!==group||filter==='secret'&&!key?.secret||filter==='ready'&&key?.status!=='ready'||filter==='draft'&&key?.status==='ready'||filter==='feature'&&!features.has(room.id))return false;
  const hit=searchIndex!.find(room,q);if(!hit)return false;hits.set(room.id,hit);return true;
 });
 if(followSelection){const index=matchedRooms.findIndex(r=>r.id===roomId);if(index>=0)listPage=Math.floor(index/listPageSize);}
 listPage=Math.min(listPage,Math.max(0,Math.ceil(matchedRooms.length/listPageSize)-1));
 for(const room of matchedRooms.slice(listPage*listPageSize,(listPage+1)*listPageSize)){
  const content=byId.get(room.id),key=content?.kind==='room'?content:undefined;
  const row=document.createElement('div'),check=document.createElement('input'),button=document.createElement('button');
  check.type='checkbox';check.checked=picked.has(room.id);check.setAttribute('aria-label','Raum '+room.number+' für Sammeländerung auswählen');check.dataset.roomId=room.id;check.onchange=()=>{if(check.checked)picked.add(room.id);else picked.delete(room.id);updateSelectionCount();};
  button.setAttribute('aria-pressed',String(room.id===roomId));button.textContent=(!geometry?'Geometrie nicht geladen · ':!visibleIds.has(room.id)?'Archiviert · ':'')+(key?.levelId?byId.get(key.levelId)?.name+' · ':'')+room.number+'. '+room.name;
  const hit=hits.get(room.id);if(q&&hit){const snippet=document.createElement('small');snippet.className='key-search-hit';snippet.textContent=hit.label+': '+hit.excerpt;button.append(snippet);}
  button.onclick=()=>{void moveEditor(async()=>{openRoom(room.id);if(visibleIds.has(room.id))await navigate(room.id);}).catch(reportFailure);};row.append(check,button);list.append(row);
 }
 if(!matchedRooms.length){const empty=document.createElement('p');empty.className='caption';empty.textContent='Keine passenden Räume. Suche oder Filter ändern.';list.append(empty);}
 updateSelectionCount();updateListControls();
}
function textBlock(visibility:'public'|'gm'){return draft?.blocks.find(b=>b.kind==='text'&&b.visibility===visibility);}
function drawForm(){if(!draft)return;const templateStatus=el('key-template-status');if(templateStatus)templateStatus.textContent='';if(captureButton)captureButton.hidden=draft.kind!=='room';el<HTMLButtonElement>('key-map').disabled=!geometry?.rooms.some(r=>r.id===roomId);const room=keyRooms().find(r=>r.id===roomId);field('key-name').value=draft.kind==='room'?room?.name??draft.name:draft.name;field('key-number').value=draft.kind==='room'?room?.number??'':'';field('key-number').disabled=draft.kind!=='room';field('key-read-aloud').value=textBlock('public')?.text??'';field('key-gm-notes').value=textBlock('gm')?.text??'';field('key-attributes').value=attrText(draft.attributes);field('key-zsteps').value=draft.zSteps.join(', ');field('key-zsteps').disabled=draft.kind!=='level';field('key-tags').value=draft.tags.join(', ');field('key-status').value=draft.status;field('key-secret').checked=draft.secret;optionList('key-level',records().filter(r=>r.kind==='level'&&r.scopeId===scopeId),draft.levelId,'Ohne konzeptuelles Level');optionList('key-group',records().filter(r=>r.kind==='group'&&r.scopeId===scopeId),draft.groupId,'Ohne erbende Gruppe');select('key-level').disabled=!['room','group'].includes(draft.kind);select('key-group').disabled=draft.kind!=='room';drawLegacy(draft.kind==='room'?room:undefined);drawBlocks();drawReferences();drawSurfaceKey(draft,geometry,()=>{editVersion++;preview();schedule();});preview();}
function drawLegacy(room?:Room){
 legacyDraft=new Map();const root=el('key-original');root.replaceChildren();
 for(const [index,section]of (room?.sections??[]).entries()){if(section.kind!=='markdown')continue;const text=section.markdown??'';legacyDraft.set(section.id,text);const label=document.createElement('label'),area=document.createElement('textarea');label.textContent='Key-Abschnitt '+(index+1);area.rows=8;area.dataset.sectionId=section.id;area.value=text;label.append(area);root.append(label);area.oninput=()=>{if(draft?.kind!=='room'||draft.id!==room!.id||!area.isConnected)return;legacyDraft.set(section.id,editTextareaText(legacyDraft.get(section.id)??text,area.value));preview();};}
}
function collect(){if(!draft)throw new Error('Raum oder Inhalt wählen.');for(const visibility of ['public','gm'] as const){const raw=field(visibility==='public'?'key-read-aloud':'key-gm-notes').value;let b=draft.blocks.find(b=>b.kind==='text'&&b.visibility===visibility);if(!b&&raw){b=block('text',visibility);draft.blocks.unshift(b);}if(b&&raw!==b.text&&raw!==b.text.replace(/\r\n?/g,'\n'))b.text=editTextareaText(b.text,raw);}const c=structuredClone(draft);c.name=field('key-name').value;c.attributes=field('key-attributes').value===attrText(draft.attributes).replace(/\r\n?/g,'\n')?structuredClone(draft.attributes):attrs(field('key-attributes').value);c.tags=field('key-tags').value.split(',').map(s=>s.trim()).filter(Boolean);c.status=field('key-status').value;c.secret=field('key-secret').checked;c.levelId=select('key-level').value||null;c.groupId=select('key-group').value||null;if(c.groupId)c.levelId=records().find(r=>r.id===c.groupId)?.levelId??null;if(!['room','group'].includes(c.kind))c.levelId=null;if(c.kind!=='room')c.groupId=null;c.zSteps=c.kind==='level'?field('key-zsteps').value.split(/[\s,;]+/).filter(Boolean).map(Number):[];return c;}
function preview(){if(!draft||!geometry)return;try{const c=collect(),room=keyRooms().find(r=>r.id===(c.kind==='surface'?c.surface?.roomId:roomId)),all=[...records().filter(r=>r.id!==c.id),c],effective=keyAttributes(c,all);el('key-effective').textContent=effective.map(a=>a.key+': '+(a.value??'unterdrückt')+' ← '+a.origin).join('\n');if(!room||!['room','surface'].includes(c.kind)){el('key-rendered').textContent=c.blocks.filter(b=>b.kind==='text').map(b=>b.text).join('\n\n');return;}const heading=field('key-heading').value===''?null:Number(field('key-heading').value),rendered=renderDungeonKey(c.kind==='room'?{...room,sections:room.sections.map(s=>s.kind==='markdown'&&legacyDraft.has(s.id)?{...s,markdown:legacyDraft.get(s.id)!}:s)}:room,all,geometry,{surfaceOnly:c.kind==='surface'?c:undefined,audience:select('key-audience').value as 'gm'|'public',discovered:new Set(),allSecrets:field('key-discovered').checked,heading});el('key-rendered').textContent=rendered.text;}catch{}}
const referenceKindLabel=(kind:string)=>({note:'Notiz',npc:'NSC',faction:'Fraktion',quest:'Quest',rumor:'Gerücht',rule:'Regel',location:'Ort',plan:'Spielabend'} as Record<string,string>)[kind]??'Inhalt';
function drawReferences(){
 if(!draft)return;const list=el('key-references');list.replaceChildren();
 for(const ref of draft.references){
  const line=document.createElement('p'),remove=document.createElement('button'),label=references.find(r=>r.kind===ref.kind&&r.id===ref.id)?.label??ref.label;
  line.append(document.createTextNode(referenceKindLabel(ref.kind)+': '));
  if(noteContext&&['note','npc','faction','quest','rumor','rule'].includes(ref.kind)){
   const open=document.createElement('button');open.type='button';open.textContent=label;open.className='key-note-link';
   const o=owner(),id=draft.id;open.onclick=()=>{void(async()=>{
    if(!open.isConnected||!owns(o)||draft?.id!==id||!await flushKeys()||!owns(o)||draft?.id!==id)return;
    await noteContext!.open(ref.id,label,()=>owns(o)&&draft?.id===id);
   })().catch(reportFailure);};line.append(open);
  }else if(planContext&&ref.kind==='plan'){
   const open=document.createElement('button');open.type='button';open.textContent=label;open.className='key-plan-link';
   open.onclick=()=>{if(open.isConnected&&el<HTMLDialogElement>('key-dialog').open)void planContext!.open(ref.id);};line.append(open);
  }else line.append(document.createTextNode(label));
  line.append(document.createTextNode(' '));remove.type='button';remove.textContent='Entfernen';remove.onclick=()=>{draft!.references=draft!.references.filter(r=>r!==ref);drawReferences();};line.append(remove);list.append(line);
 }
 drawReferenceMatches();
}
function drawReferenceMatches(){
 const list=el('key-reference-matches');list.replaceChildren();
 const terms=field('key-reference-query').value.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 if(!draft||!terms.length){el('key-reference-search-status').textContent='Vorhandene Notiz, Ort oder Spielabend suchen. Enter verknüpft den ersten Treffer.';return;}
 const matches=references.filter(ref=>!draft!.references.some(r=>r.id===ref.id)&&terms.every(term=>(ref.label+' '+referenceKindLabel(ref.kind)).normalize('NFKC').toLocaleLowerCase().includes(term)));
 el('key-reference-search-status').textContent=matches.length>8?'8 Treffer angezeigt. Suchbegriff genauer eingeben.':matches.length?matches.length+' passende Inhalte. Auswahl verknüpft das Original mit diesem Raum.':'Keine weiteren passenden Inhalte. Bereits verknüpfte Originale stehen oben.';
 const o=owner(),id=draft.id;
 for(const ref of matches.slice(0,8)){
  const button=document.createElement('button');button.type='button';button.textContent=referenceKindLabel(ref.kind)+': '+ref.label;button.dataset.referenceId=ref.id;
  button.onclick=()=>{
   if(!el<HTMLDialogElement>('key-dialog').open||!button.isConnected||!owns(o)||draft?.id!==id||editorLocked||composing||draft.references.some(r=>r.id===ref.id))return;
   draft.references.push({...ref});drawReferences();editVersion++;blocked=false;schedule();
   // Continue searching or switch rooms without traversing the removed result.
   field('key-reference-query').focus({preventScroll:true});
  };list.append(button);
 }
}
function primaryFields(){field('key-read-aloud').value=textBlock('public')?.text??'';field('key-gm-notes').value=textBlock('gm')?.text??'';}
function drawBlocks(){if(!draft)return;const list=el('key-blocks');list.replaceChildren();for(const[bIndex,b]of draft.blocks.entries()){const card=document.createElement('fieldset'),legend=document.createElement('legend'),kind=document.createElement('select'),visibility=document.createElement('select'),text=document.createElement('textarea'),suppressed=document.createElement('input'),template=document.createElement('select');legend.textContent='Block '+(bIndex+1);for(const[id,label]of [['text','Eigene Prosa'],['geometry','Geometriefakten'],['attributes','Beschreibungseigenschaften'],['exits','Ausgänge'],['legacy','Vorhandener Raumkey'],['template','Verknüpfte Vorlage']]){const o=document.createElement('option');o.value=id!;o.textContent=label!;kind.append(o);}kind.value=b.kind;kind.onchange=()=>{b.kind=kind.value as KeyBlock['kind'];if(b.kind==='template'&&!b.templateId){const choices=records().filter(t=>t.kind==='template'&&t.scopeId===scopeId);if(choices.length===1)b.templateId=choices[0]!.id;}primaryFields();drawBlocks();preview();};for(const[id,label]of [['public','Vorlesbar'],['gm','Nur GM'],['secret','Bis zur Entdeckung verborgen']]){const o=document.createElement('option');o.value=id!;o.textContent=label!;visibility.append(o);}visibility.value=b.visibility;visibility.onchange=()=>{b.visibility=visibility.value as KeyBlock['visibility'];primaryFields();preview();};text.value=b.text;text.rows=4;text.dataset.blockId=b.id;text.setAttribute('aria-label','Prosa Block '+(bIndex+1));text.hidden=b.kind!=='text';text.oninput=()=>{b.text=editTextareaText(b.text,text.value);if(b===textBlock('public'))field('key-read-aloud').value=b.text;if(b===textBlock('gm'))field('key-gm-notes').value=b.text;preview();};suppressed.value=b.suppressed.join(', ');suppressed.placeholder='Unterdrückte Fakten: size, height oder Attributnamen';suppressed.hidden=!['geometry','attributes'].includes(b.kind);suppressed.oninput=()=>{b.suppressed=suppressed.value.split(',').map(s=>s.trim()).filter(Boolean);preview();};const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Textvorlage wählen';template.append(placeholder);for(const t of records().filter(t=>t.kind==='template'&&t.scopeId===scopeId)){const o=document.createElement('option');o.value=t.id;o.textContent=t.name;template.append(o);}template.value=b.templateId??'';template.hidden=b.kind!=='template';template.onchange=()=>{b.templateId=template.value||null;preview();};card.append(legend,kind,visibility,text,suppressed,template);for(const[direction,label]of [[-1,'Nach oben'],[1,'Nach unten']] as const){const move=document.createElement('button');move.textContent=label;move.disabled=bIndex+direction<0||bIndex+direction>=draft.blocks.length;move.onclick=()=>{const index=draft!.blocks.indexOf(b),swap=draft!.blocks[index+direction];if(!swap)return;draft!.blocks[index+direction]=b;draft!.blocks[index]=swap;drawBlocks();preview();};card.append(move);}const remove=document.createElement('button');remove.textContent='Block entfernen';remove.onclick=()=>{draft!.blocks=draft!.blocks.filter(candidate=>candidate!==b);primaryFields();drawBlocks();preview();};card.append(remove);if(b.kind==='template'){const detach=document.createElement('button');detach.textContent='Vorlage lösen – Inhalt behalten';detach.onclick=()=>{const children=expandedKeyBlocks({...draft!,blocks:[b]},records()).map(c=>structuredClone(c));draft!.blocks.splice(draft!.blocks.indexOf(b),1,...children);primaryFields();drawBlocks();preview();};card.append(detach);}if(b.visibility==='secret'){for(const[prop,label]of [['searchMethod','Suchmethode'],['dc','Such-DC'],['discoveryNotes','Private Entdeckungshinweise'],['revealedText','Vorlesetext nach Entdeckung']] as const){const l=document.createElement('label'),input=prop==='dc'?document.createElement('input'):document.createElement('textarea');l.textContent=label;if(prop==='dc'){(input as HTMLInputElement).type='number';}input.value=b[prop]===null?'':String(b[prop]);input.oninput=()=>{if(prop==='dc')b.dc=input.value===''?null:Number(input.value);else b[prop]=input.value;preview();};l.append(input);card.append(l);}}list.append(card);}}
async function save(){
 if(composing||!draft||!dirty())return;
 const o=owner(),id=draft.id,c=collect(),legacy=[...legacyDraft],number=c.kind==='room'?field('key-number').value:null;
 saveState('pending','Dungeon-Key wird gespeichert…');
 let committed:Awaited<ReturnType<typeof command>>;
 if(c.kind==='room'){
  const room=keyRooms().find(r=>r.id===id);if(!room)throw new Error('Raum nicht mehr verfügbar.');
  committed=await command({kind:'key-batch',rooms:[{id,expectedRevision:baseRoomRevision??room.revision,keyRevision:baseKeyRevision}],patch:{name:{mode:'replace',text:c.name},number:number!,levelId:c.levelId,groupId:c.groupId,attributes:c.attributes,attributeMode:'replace',blocks:c.blocks,tags:c.tags,secret:c.secret,status:c.status,references:c.references,sectionEdits:legacy.map(([id,markdown])=>({id,markdown}))}});
 }else committed=await command({kind:'key-content',content:c,expectedRevision:baseKeyRevision});
 if(!committed||!owns(o)||draft?.id!==id)return;
 const stored=committed.view.keyContent?.find(r=>r.id===id),room=committed.workspace.rooms.find(r=>r.id===id)??committed.view.hiddenRooms.find(r=>r.id===id);
 if(!stored||c.kind==='room'&&!room)throw new Error('Gespeicherter Key konnte nicht bestätigt werden.');
 draft.revision=stored.revision;baseKeyRevision=stored.revision;baseRoomRevision=c.kind==='room'?room!.revision:null;
 baseSignature=signature(c.kind==='room'?{...stored,name:room!.name}:stored,c.kind==='room'?room!.number:null,c.kind==='room'?legacy:[]);
 blocked=false;preview();
 try{saveState(dirty()?'dirty':'saved',dirty()?'Weitere Eingabe offen – wird automatisch gespeichert.':'Dungeon-Key gespeichert.');}catch(e){reportFailure(e);}
 if(!blocked)tell('Dungeon-Key gespeichert. Gemeinsame Autoren-History verfügbar.');
}
function blank(kind:KeyContent['kind'],id:string=uuid()):KeyContent{return{id,revision:0,scopeId,kind,name:kind==='dungeon'?'Dungeonwerte':'Neuer Inhalt',levelId:null,groupId:null,zSteps:[],attributes:{},blocks:[],tags:[],secret:false,status:'',references:[]};}
export async function openRoomKey(id:string,current=()=>true,returned?:()=>void,target?:KeyPassageTarget,returnLabel='Zurück zur Notiz',left?:()=>void):Promise<boolean>{
 const o=owner(),intent=++transition;
 if(!current()||!await flushKeys()||!owns(o)||intent!==transition||!current())return false;
 if(!await before()||!owns(o)||intent!==transition||!current())return false;
 if(!await refresh()||!owns(o)||intent!==transition||!current())return false;
 const room=keyRooms().find(r=>r.id===id);if(!room)throw new Error('Raum nicht mehr verfügbar.');
 noteContext?.reset();scopeId=room.scopeId;
 field('key-search').value='';select('key-filter').value='';picked.clear();listPage=0;
 optionList('key-filter-level',records().filter(r=>r.kind==='level'&&r.scopeId===scopeId),null,'Alle Level');
 optionList('key-filter-group',records().filter(r=>r.kind==='group'&&r.scopeId===scopeId),null,'Alle Gruppen');
 select('key-filter-level').value='';select('key-filter-group').value='';openRoom(id);
 if(target)focusPassage(target,false);
 keyLeave=left??null;keyReturn=returned?()=>{if(owns(o)&&current())returned();}:null;
 el('key-close').textContent=returned?returnLabel:'Schließen';
 showKeyDialog();
 if(target)focusPassage(target);else{field('key-gm-notes').focus({preventScroll:true});field('key-gm-notes').scrollIntoView({block:'center'});}return true;
}
/** A room opened from a borrowed note returns to that note beside its original room.
 * The preparation route remains the fallback for notes opened in that workspace. */
export async function openNoteRoomKey(id:string,current:()=>boolean,returned:()=>void,source?:{id:string;label:string}):Promise<boolean>{
 const origin=roomId,o=owner();
 if(!noteContext?.ownsEditor||!source||!origin)return openRoomKey(id,current,returned);
 const previousReturn=keyReturn,previousLeave=keyLeave,closeLabel=el('key-close').textContent??'Schließen',atlas=document.body.classList.contains('atlas-workspace');
 const valid=()=>owns(o)&&current()&&(!atlas||document.body.classList.contains('atlas-workspace'));
 return openRoomKey(id,valid,()=>{void(async()=>{
  if(!valid()||!await openRoomKey(origin,valid,previousReturn??undefined,undefined,closeLabel,previousLeave??undefined)||!valid())return;
  await noteContext!.open(source.id,source.label,()=>valid()&&roomId===origin);
 })().catch(error=>{if(valid())reportFailure(error);});});
}
function focusPassage(target:KeyPassageTarget,focus=true){
 let area:HTMLTextAreaElement|undefined;
 if(target.kind==='legacy'){
  if(legacyDraft.get(target.sectionId)!==target.expectedText)throw new Error('Fundstelle wurde inzwischen geändert. Binder aktualisieren.');
  area=[...el('key-original').querySelectorAll<HTMLTextAreaElement>('textarea')].find(e=>e.dataset.sectionId===target.sectionId);
 }else{
  const roomKey=records().find(k=>k.id===roomId&&k.kind==='room');
  const source=records().find(k=>k.id===target.ownerId&&(k.kind==='room'&&k.id===roomId||k.kind==='template'&&roomKey?.blocks.some(b=>b.kind==='template'&&b.templateId===k.id)));
  if(!source||source.blocks.find(b=>b.id===target.blockId&&b.kind==='text')?.text!==target.expectedText)throw new Error('Fundstelle wurde inzwischen geändert. Binder aktualisieren.');
  if(draft?.id!==source.id){draft=structuredClone(source);drawOwners();drawForm();establishBase();}
  area=[...el('key-blocks').querySelectorAll<HTMLTextAreaElement>('textarea')].find(e=>e.dataset.blockId===target.blockId);
 }
 if(!area)throw new Error('Bearbeitbare Fundstelle nicht verfügbar.');
 for(let parent=area.parentElement;parent&&parent.id!=='key-dialog';parent=parent.parentElement)if(parent.tagName==='DETAILS')(parent as HTMLDetailsElement).open=true;
 const start=target.expectedText.slice(0,target.start).replace(/\r\n?/g,'\n').length,end=target.expectedText.slice(0,target.end).replace(/\r\n?/g,'\n').length;
 if(!focus)return;area.setSelectionRange(start,end);area.focus({preventScroll:true});area.scrollIntoView({block:'center'});scrollTextareaToOffset(area,start);
}

async function preparePlanReturn():Promise<KeyPlanReturn|null>{
 const o=owner(),id=draft?.id,intent=++transition,current=()=>owns(o)&&transition===intent&&draft?.id===id;
 if(!id||draft?.kind!=='room'||!el<HTMLDialogElement>('key-dialog').open||!await flushKeys()||!current()||!await before()||!current())return null;
 const dialog=el<HTMLDialogElement>('key-dialog'),area=el<HTMLTextAreaElement>('key-gm-notes'),label=field('key-name').value;
 const saved={scopeId,query:field('key-search').value,level:select('key-filter-level').value,group:select('key-filter-group').value,filter:select('key-filter').value,picked:[...picked],page:listPage,scroll:dialog.scrollTop,start:area.selectionStart,end:area.selectionEnd,textScroll:area.scrollTop,closeLabel:el('key-close').textContent,returned:keyReturn,left:keyLeave};
 return{label,current,leave:()=>{keyReturn=null;keyLeave=null;dialog.close();},restore:async()=>{
  if(!current()||!await flushKeys()||!current()||!await before()||!current()||!await refresh()||!current())return false;
  if(!keyRooms().some(room=>room.id===id))throw new Error('Der ursprüngliche Raum ist nicht mehr verfügbar.');
  scopeId=saved.scopeId;openRoom(id);
  optionList('key-filter-level',records().filter(r=>r.kind==='level'&&r.scopeId===scopeId),saved.level,'Alle Level');
  optionList('key-filter-group',records().filter(r=>r.kind==='group'&&r.scopeId===scopeId),saved.group,'Alle Gruppen');
  field('key-search').value=saved.query;select('key-filter').value=saved.filter;picked.clear();for(const id of saved.picked)if(keyRooms().some(room=>room.id===id))picked.add(id);listPage=saved.page;drawList();
  keyReturn=saved.returned;keyLeave=saved.left;el('key-close').textContent=saved.closeLabel;
  if(!dialog.open)dialog.showModal();dialog.scrollTop=saved.scroll;area.focus({preventScroll:true});area.setSelectionRange(saved.start,saved.end);area.scrollIntoView({block:'center'});area.scrollTop=saved.textScroll;return true;
 }};
}

export function initKeys(status:typeof tell,w:typeof workspace,r:typeof selected,drain:typeof before,changed:typeof publish,go:typeof navigate,notes?:KeyNavigation){
 tell=status;workspace=w;selected=r;before=drain;publish=changed;navigate=go;
 el('key-workspace-open')?.addEventListener('click',()=>void openKeyWorkspace().catch(reportFailure));
 el('key-template-choice')?.addEventListener('change',()=>{el('key-template-status').textContent='';syncTemplateTargets();});
 el('key-template-link')?.addEventListener('click',linkTemplate);
 el('key-template-edit')?.addEventListener('click',()=>{const id=select('key-template-choice').value;void moveEditor(()=>{const c=records().find(k=>k.id===id&&k.kind==='template'&&k.scopeId===scopeId);if(!c)return;draft=structuredClone(c);drawOwners();drawForm();establishBase();field('key-read-aloud').focus();field('key-read-aloud').scrollIntoView({block:'center'});}).catch(reportFailure);});
 el('key-template-new')?.addEventListener('click',()=>{const input=field('key-new-name'),details=input.closest('details');if(details)details.open=true;select('key-new-kind').value='template';input.value='';input.focus();input.scrollIntoView({block:'center'});});

 if(notes?.plan){
  const button=document.createElement('button');button.id='key-plan-return';button.type='button';el('preparation').prepend(button);
  planContext=new KeyPlanContext(button,{prepare:preparePlanReturn,open:notes.plan,showKey:()=>notes.showKeyWorkspace?.(),tell:status});
 }
 el('key-dialog').addEventListener('compositionstart',()=>{composing=true;if(timer)clearTimeout(timer);timer=null;},true);
 el('key-dialog').addEventListener('compositionend',()=>{composing=false;if(draft&&dirty()&&!blocked)schedule();},true);
 if(notes){
  noteCapture=new KeyNoteCapture({roomUses:(token,id)=>window.campaign.noteRoomUses(token,id,0),api:{keyNoteChoices:(token,q)=>window.campaign.keyNoteChoices(token,q),captureKeyNote:c=>window.campaign.captureKeyNote(c),keyNoteCaptureStatus:(c,token)=>window.campaign.keyNoteCaptureStatus(c,token)},
   prepare:async()=>{const o=owner(),id=draft?.id,intent=++transition;if(!id||draft?.kind!=='room'||!await flushKeys()||!owns(o)||draft?.id!==id||intent!==transition||!await before()||!owns(o)||draft?.id!==id||intent!==transition)return null;const room=keyRooms().find(r=>r.id===id);if(!room||!o.token||!o.campaignId)return null;return{token:o.token,campaignId:o.campaignId,room:{id,expectedRevision:room.revision,keyRevision:baseKeyRevision},title:room.name,current:()=>owns(o)&&draft?.id===id&&el<HTMLDialogElement>('key-dialog').open};},
   opened:async(c,current)=>{if(!current()||!await refresh()||!current())throw new Error('Raumansicht nicht mehr aktuell.');const o=owner();openRoom(c.room.id);await noteContext!.open(c.note.id,c.note.title,()=>owns(o)&&draft?.id===c.room.id);},
   focusKey:()=>{field('key-gm-notes').focus({preventScroll:true});field('key-gm-notes').scrollIntoView({block:'center'});},tell:status});
  captureButton=document.createElement('button');captureButton.id='key-note-create';captureButton.type='button';captureButton.textContent='Notiz zum Raum…';captureButton.title='Markierten GM-Text als Ausgangspunkt übernehmen';
  field('key-gm-notes').after(captureButton);captureButton.onclick=()=>{const area=el<HTMLTextAreaElement>('key-gm-notes'),selection=area.value.slice(area.selectionStart,area.selectionEnd);void noteCapture!.open(selection).catch(reportFailure);};
 }

 el('key-dialog').addEventListener('close',()=>{const returned=keyReturn;keyReturn=null;keyLeave=null;el('key-close').textContent='Schließen';returned?.();});
 if(notes)noteContext=new KeyNoteContext(el<HTMLDialogElement>('key-dialog'),{open:notes.open,flush:notes.flush,beforeClose:flushKeys,closed:async()=>{const o=owner();if(await refresh()&&owns(o))drawReferences();},focusKey:()=>{const text=field('key-gm-notes');text.focus({preventScroll:true});text.scrollIntoView({block:'center'});},tell:status});
 initKeyCopy({context:()=>{const o=owner(),source=keyRooms().find(r=>r.id===roomId);return draft?.kind==='room'&&source&&geometry?{identity:JSON.stringify(o)+':'+source.id,source,rooms:keyRooms(),records:records(),geometry,targets:[...picked]}:null;},prepare:async()=>await flushKeys()&&await refresh(),commit:async action=>{let ok=false;run(async()=>{const result=await command(action);if(!result)return;if(roomId)openRoom(roomId);ok=true;tell(action.rooms.length+' Räume als unabhängige Inhaltskopien bearbeitet.');},true);await pendingWork.value;return ok;}});

 const editing=new Set(['key-name','key-number','key-read-aloud','key-gm-notes','key-attributes','key-zsteps','key-tags','key-status','key-secret','key-level','key-group']);
 for(const type of ['input','change','click'] as const)el('key-dialog').addEventListener(type,event=>{
  const target=event.target as HTMLElement;
  // Controls can redraw and detach themselves before this listener runs.
  const contentEdit=event.composedPath().some(node=>['key-blocks','key-references','key-original'].includes((node as HTMLElement).id));
  if(type!=='click'&&editing.has(target.id)||contentEdit||type==='click'&&['key-add-block'].includes(target.id)){
   editVersion++;blocked=false;schedule();
  }
 });
 el('key-dialog').addEventListener('cancel',event=>{event.preventDefault();void moveEditor(()=>el<HTMLDialogElement>('key-dialog').close()).catch(reportFailure);});
 el('key-open').onclick=()=>{const o=owner(),room=selected(),intent=++transition;run(async()=>{if(!(await before())||!owns(o)||intent!==transition)return;if(!room)throw new Error('Raum auswählen.');scopeId=room.scopeId;if(!await refresh()||!owns(o)||intent!==transition)return;openRoom(room.id);optionList('key-filter-level',records().filter(r=>r.kind==='level'&&r.scopeId===scopeId),null,'Alle Level');optionList('key-filter-group',records().filter(r=>r.kind==='group'&&r.scopeId===scopeId),null,'Alle Gruppen');showKeyDialog();});};
 el('key-add-room').onclick=()=>{const o=owner(),w=workspace();void moveEditor(async()=>{
  run(async()=>{if(!w||!owns(o)||!graphPreviewMatches(o.target,workspace()?.graphPreview,true))return;if(!await before())throw new Error('Andere offene Eingaben zuerst prüfen.');if(!owns(o)||!graphPreviewMatches(o.target,workspace()?.graphPreview,true))return;
   const result=await atlasDefaultRoomWrite(w.token,w.campaign.id,o.target);if(!owns(o)||!graphPreviewMatches(o.target,workspace()?.graphPreview,true))return;if(!result.ok)throw new Error(result.error);if(!graphPreviewMatches(o.target,result.value.graphPreview))throw new Error('Raumantwort gehört zu einer anderen Vorschau.');
   acknowledged=result.value;await publish(result.value);if(!owns(o)||!await refresh()||!owns(o))return;
   const room=result.value.rooms.find(r=>r.id===result.value.selectedId);if(!room)throw new Error('Neuer Raum konnte nicht geöffnet werden.');
   field('key-search').value='';select('key-filter-level').value='';select('key-filter-group').value='';select('key-filter').value='';listPage=0;openRoom(room.id);
   el('key-dialog').scrollTop=0;saveState('saved','Neuer Raum angelegt. Name, Vorlesetext und GM-Notizen direkt eingeben.');
  },true);await pendingWork.value;
 }).then(ok=>{if(ok&&!blocked&&el<HTMLDialogElement>('key-dialog').open){field('key-name').focus();field('key-name').select();}}).catch(reportFailure);};
 el('key-close').onclick=()=>{void moveEditor(()=>el<HTMLDialogElement>('key-dialog').close()).catch(reportFailure);};
 el('key-save').onclick=()=>{blocked=false;void flushKeys();};
 el('key-reload').onclick=()=>{void reload();};
 el('key-map').onclick=()=>{const id=roomId;if(!id)return;void moveEditor(async()=>{keyReturn=null;const leave=keyLeave;keyLeave=null;leave?.();el<HTMLDialogElement>('key-dialog').close();await (notes?.map??navigate)(id);}).catch(reportFailure);};
 el('key-add-block').onclick=()=>{if(draft){draft.blocks.push(block());drawBlocks();}};
 field('key-reference-query').oninput=()=>drawReferenceMatches();
 field('key-reference-query').onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing&&!composing){event.preventDefault();el('key-reference-matches').querySelector<HTMLButtonElement>('button')?.click();}};

 el('key-owner').onchange=()=>{const id=select('key-owner').value;void moveEditor(()=>{if(id==='@room'){if(roomId)openRoom(roomId);return;}draft=structuredClone(id==='@dungeon'?records().find(r=>r.kind==='dungeon'&&r.scopeId===scopeId)??blank('dungeon',scopeId):records().find(r=>r.id===id)??null);drawForm();establishBase();}).then(okay=>{if(okay)drawOwners();}).catch(reportFailure);};
 el('key-create-owner').onclick=()=>{const kind=select('key-new-kind').value as KeyContent['kind'],name=field('key-new-name').value||'Neuer Inhalt';void moveEditor(()=>{draft=blank(kind);draft.name=name;if(kind==='surface')draft.surface={roomId:roomId??'',fragments:[]};drawForm();establishBase(true);schedule();}).catch(reportFailure);};
 el('key-template-from-room').onclick=()=>{
 const o=owner(),id=draft?.id,name=field('key-new-name').value;
 void flushKeys().then(okay=>{
  if(!okay||!owns(o)||draft?.id!==id)return;
  run(async()=>{
   if(!draft||draft.kind!=='room')throw new Error('Raum wählen.');
   const c=collect(),template={...blank('template'),name:name||'Vorlage '+c.name,blocks:c.blocks.filter(b=>b.kind==='text').map(b=>({...b,id:uuid()}))};
   const committed=await command({kind:'key-content',content:template,expectedRevision:null});
   if(!committed||!owns(o)||draft?.id!==id)return;
   draft.blocks=draft.blocks.filter(b=>b.kind!=='text');draft.blocks.unshift({...block('template'),templateId:template.id});
   field('key-read-aloud').value='';field('key-gm-notes').value='';drawBlocks();
   saveState('dirty','Textvorlage angelegt; Raumverknüpfung wird automatisch gespeichert.');schedule();tell('Textvorlage angelegt. Raumverknüpfung noch offen.');
  },true);
 });
};
 for(const id of ['key-search','key-filter-level','key-filter-group','key-filter'])el(id).addEventListener('input',()=>{listPage=0;drawList(id==='key-search'&&field('key-search').value==='');});
 el('key-list-prev').onclick=()=>{listPage=Math.max(0,listPage-1);drawList();};
 el('key-list-next').onclick=()=>{listPage++;drawList();};
 el('key-search').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing&&!composing){const first=el('key-room-list').querySelector<HTMLButtonElement>('button');if(first){event.preventDefault();first.click();}}});
 for(const[visibility,id]of [['public','key-read-aloud'],['gm','key-gm-notes']] as const)el(id).addEventListener('input',()=>{if(!draft)return;let b=textBlock(visibility);if(!b){b=block('text',visibility);draft.blocks.unshift(b);}b.text=editTextareaText(b.text,field(id).value);});
 for(const id of ['key-name','key-read-aloud','key-gm-notes','key-attributes','key-heading','key-audience','key-discovered','key-level','key-group'])el(id).addEventListener('input',preview);
 el('key-select-visible').onclick=()=>{for(const room of matchedRooms)picked.add(room.id);for(const input of el('key-room-list').querySelectorAll<HTMLInputElement>('input')){input.checked=true;if(input.dataset.roomId)picked.add(input.dataset.roomId);}updateSelectionCount();};
 el('key-select-none').onclick=()=>{picked.clear();drawList();};
 el('key-batch-apply').onclick=applyBatch;}
export function activateKeys(){field('key-reference-query').value='';el<HTMLDetailsElement>('key-reference-picker').open=false;composing=false;noteCapture?.reset();planContext?.reset();searchIndex=null;searchData=null;searchReferences=null;noteContext?.reset();invalidateKeyCopy();editorSession.generation++;transition++;readVersion++;editVersion++;pendingWork.value=null;roomId=null;scopeId='';preparedBatch=null;if(timer)clearTimeout(timer);timer=null;blocked=false;editorLocked=false;draft=null;legacyDraft.clear();data=null;geometry=null;acknowledged=null;baseSignature='';baseRoomRevision=null;baseKeyRevision=null;matchedRooms=[];listPage=0;picked.clear();el<HTMLDialogElement>('key-dialog').close();}
export function setKeyReferenceStatus(text:string,error=false){noteContext?.setStatus(text,error);}
export async function flushKeys():Promise<boolean>{
 if(composing){tell('Texteingabe zuerst abschließen.',true);return false;}
 if(noteCapture?.active){tell('Neue Notiz zuerst anlegen oder abbrechen.',true);return false;}
 const o=owner();if(noteContext?.active&&!await noteContext.flush()||!owns(o))return false;
 if(timer){clearTimeout(timer);timer=null;}
 await pendingWork.value;if(!owns(o)||blocked)return false;
 try{
  while(dirty()){
   if(composing)return false;run(save);await pendingWork.value;if(!owns(o)||blocked)return false;
  }
  if(timer){clearTimeout(timer);timer=null;}return true;
 }catch(e){if(owns(o))reportFailure(e);return false;}
}

editorSession.onDeactivate(()=>{if(timer)clearTimeout(timer);timer=null;});

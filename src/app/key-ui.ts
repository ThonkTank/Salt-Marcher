import {atlasDrawingWrite} from './campaign-atlas-author';
import {initKeyCopy,invalidateKeyCopy,syncKeyCopyControl} from './key-copy-ui';
import {drawSurfaceKey} from './surface-key-ui';
import type {Workspace,Room} from './contracts';import type {DrawingView,DrawingAction} from './drawing-contracts';import type {KeyContent,KeyBlock,KeyBatch,KeyTextEdit} from './key-contracts';import {emptyKey} from './key-contracts';import {renderDungeonKey,expandedKeyBlocks,keyAttributes} from './key-model';import type {DungeonGeometry} from './dungeon-contracts';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T,field=(id:string)=>el<HTMLInputElement>(id),select=(id:string)=>el<HTMLSelectElement>(id),uuid=()=>crypto.randomUUID();let workspace:()=>Workspace|null,selected:()=>Room|null,before:()=>Promise<boolean>,publish:(w:Workspace)=>Promise<void>,navigate:(id:string)=>Promise<void>,tell:(s:string,error?:boolean)=>void,data:DrawingView|null=null,geometry:DungeonGeometry|null=null,draft:KeyContent|null=null,roomId:string|null=null,scopeId='',generation=0,pending:Promise<void>|null=null;let references:{kind:string;id:string;label:string}[]=[];const picked=new Set<string>();let matchedRooms:Room[]=[],listPage=0;const listPageSize=100,roomNumberOrder=new Intl.Collator(undefined,{numeric:true});
let readVersion=0,editVersion=0;
let timer:ReturnType<typeof setTimeout>|null=null,blocked=false,editorLocked=false,transition=0,baseSignature='',baseRoomRevision:number|null=null,baseKeyRevision:number|null=null,acknowledged:Workspace|null=null;
type PreparedBatch={owner:ReturnType<typeof owner>;rooms:{id:string;expectedRevision:number;keyRevision:number|null}[];patch:KeyBatch};
let preparedBatch:PreparedBatch|null=null;
function saveState(state:string,text:string){const status=el('key-save-status');status.dataset.state=state;status.textContent=text;}
function signature(content:KeyContent,number:string|null){return JSON.stringify({content:{...content,revision:0},number});}
function currentSignature(){return draft?signature(collect(),draft.kind==='room'?field('key-number').value:null):'';}
function dirty(){return !!draft&&currentSignature()!==baseSignature;}
function establishBase(force=false){if(timer)clearTimeout(timer);timer=null;baseKeyRevision=draft?records().find(k=>k.id===draft!.id)?.revision??null:null;baseRoomRevision=draft?.kind==='room'?keyRooms().find(r=>r.id===draft!.id)?.revision??null:null;baseSignature=force?'':currentSignature();blocked=false;saveState(force?'dirty':'saved',force?'Eingabe offen – wird automatisch gespeichert.':'Keine offenen Änderungen.');}
function lockEditor(){for(const c of el('key-dialog').querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement|HTMLTextAreaElement>('input,button,select,textarea'))c.disabled=editorLocked;if(!editorLocked){field('key-number').disabled=draft?.kind!=='room';field('key-zsteps').disabled=draft?.kind!=='level';select('key-level').disabled=!draft||!['room','group'].includes(draft.kind);select('key-group').disabled=draft?.kind!=='room';el<HTMLButtonElement>('key-map').disabled=!workspace()?.rooms.some(r=>r.id===roomId);}updateSelectionCount();updateListControls();if(!editorLocked)syncKeyCopyControl();}
function reportFailure(error:unknown){blocked=true;saveState('error','Eingabe bleibt offen: '+(error as Error).message);tell((error as Error).message+' Eingabe bleibt erhalten.',true);}
function owner(){const w=workspace();return{generation,token:w?.token,campaignId:w?.campaign.id};}
function owns(o:ReturnType<typeof owner>){const w=workspace();return o.generation===generation&&o.token===w?.token&&o.campaignId===w?.campaign.id;}
function schedule(){
 if(timer)clearTimeout(timer);timer=null;if(!draft)return;
 try{if(!dirty()){saveState('saved','Keine offenen Änderungen.');return;}}catch{}
 saveState('dirty','Eingabe offen – wird automatisch gespeichert.');
 const o=owner(),handle=setTimeout(()=>{if(!owns(o)||timer!==handle)return;timer=null;if(!blocked&&!pending)run(save);},350);timer=handle;
}
function run(fn:()=>Promise<void>,lock=false){
 if(pending)return;
 const o=owner();editorLocked=lock;lockEditor();
 const task=Promise.resolve().then(()=>{if(owns(o))return fn();}).catch(e=>{if(owns(o))reportFailure(e);}).finally(()=>{
  if(pending===task)pending=null;if(!owns(o))return;
  editorLocked=false;lockEditor();if(!blocked)try{if(dirty())schedule();}catch(e){reportFailure(e);}
 });pending=task;
}
async function moveEditor(action:()=>Promise<void>|void){const o=owner(),intent=++transition;if(!(await flushKeys())||!owns(o)||intent!==transition)return false;await action();return owns(o)&&intent===transition;}
const records=()=>data?.keyContent??[];const keyRooms=()=>{const w=workspace(),latest=new Map<string,Room>();for(const r of [...(geometry?.rooms??[]),...(acknowledged?.token===w?.token?acknowledged?.rooms??[]:[])])if((latest.get(r.id)?.revision??-1)<r.revision)latest.set(r.id,r);const rooms=(w?.rooms??[]).map(r=>(latest.get(r.id)?.revision??-1)>r.revision?latest.get(r.id)!:r);const visibleIds=new Set(rooms.map(r=>r.id));return [...rooms,...(data?.hiddenRooms??[]).filter(r=>!visibleIds.has(r.id))];};function block(kind:KeyBlock['kind']='text',visibility:KeyBlock['visibility']='public'):KeyBlock{return{id:uuid(),kind,visibility,text:'',templateId:null,suppressed:[],searchMethod:'',dc:null,discoveryNotes:'',revealedText:''};}
function attrText(attrs:KeyContent['attributes']){return Object.entries(attrs).map(([key,value])=>value===null?'!'+key:key+' = '+value).join('\n');}function attrs(value:string){const out:KeyContent['attributes']={};for(const line of value.split('\n').filter(s=>s.trim())){if(line.startsWith('!'))out[line.slice(1).trim()]=null;else{const at=line.indexOf('=');if(at<1)throw new Error('Attribute: Name = Wert; !Name unterdrückt einen geerbten Wert.');out[line.slice(0,at).trim()]=line.slice(at+1).trim();}}return out;}
function optionList(id:string,rows:{id:string;name:string}[],value:string|null,label='Kein Eintrag'){const s=select(id);s.replaceChildren();for(const r of [{id:'',name:label},...rows]){const o=document.createElement('option');o.value=r.id;o.textContent=r.name;s.append(o);}s.value=value??'';}
async function command(action:DrawingAction){
 const w=workspace(),o=owner();if(!w)return null;
 const request={commandId:uuid(),token:w.token,campaignId:w.campaign.id,action:structuredClone(action)};
 const ready=await before();if(!owns(o))return null;if(!ready)throw new Error('Andere offene Eingaben zuerst prüfen.');
 readVersion++;
 const r=await atlasDrawingWrite(request);if(!owns(o))return null;if(!r.ok)throw new Error(r.error);
 readVersion++;data=r.value.view;acknowledged=r.value.workspace;advancePreparedBatch(request.action,r.value);
 try{await publish(r.value.workspace);}catch(e){if(owns(o))tell('Key gespeichert; Kartenanzeige konnte nicht aktualisiert werden: '+(e as Error).message,true);}
 if(!owns(o))return null;
 const version=++readVersion;
 try{const view=await window.campaign.dungeon(w.token);if(!owns(o))return null;if(version===readVersion)geometry=view.ok?view.value:null;}catch(e){if(!owns(o))return null;if(version===readVersion)geometry=null;}
 drawList();drawOwners();return r.value;
}
async function refresh(){
 const w=workspace(),o=owner(),version=++readVersion;if(!w)return false;
 const view=await window.campaign.dungeon(w.token);if(!owns(o)||version!==readVersion)return false;if(!view.ok)throw new Error(view.error);
 const prep=await window.campaign.preparation(w.token,'');if(!owns(o)||version!==readVersion)return false;if(!prep.ok)throw new Error(prep.error);
 data=view.value.drawing;geometry=view.value;
 references=[...prep.value.notes.filter(n=>!n.trashed).map(n=>({kind:n.note.kind,id:n.note.id,label:n.note.title})),...prep.value.locations.filter(l=>!l.trashed).map(l=>({kind:'location',id:l.document.id,label:l.document.name})),...prep.value.plans.map(p=>({kind:'plan',id:p.id,label:p.name}))];
 drawOwners();if(el<HTMLDialogElement>('key-dialog').open)drawList();return true;
}
function advancePreparedBatch(action:DrawingAction,confirmed:{workspace:Workspace;view:DrawingView}){
 if(!preparedBatch||!owns(preparedBatch.owner)||action.kind!=='key-batch')return;
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
  await pending;if(!owns(o)||intent!==transition)return;
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
function drawOwners(){optionList('key-owner',[{id:'@room',name:'Ausgewählter Raum'},{id:'@dungeon',name:'Dungeonwerte'},...records().filter(r=>r.scopeId===scopeId&&['level','group','template','surface'].includes(r.kind)).map(r=>({id:r.id,name:({level:'Level',group:'Gruppe',template:'Vorlage',surface:'Oberfläche'} as Record<string,string>)[r.kind]+': '+r.name}))],draft?.kind==='room'?'@room':draft?.kind==='dungeon'?'@dungeon':draft?.id??'@room');}
function openRoom(id:string){if(id!==roomId)invalidateKeyCopy();const room=keyRooms().find(r=>r.id===id);if(!room)throw new Error('Raum nicht mehr verfügbar.');roomId=id;scopeId=room.scopeId;draft=structuredClone(records().find(k=>k.kind==='room'&&k.id===id)??emptyKey(room));drawOwners();drawForm();establishBase();drawList(true);}
function updateSelectionCount(){const visible=new Set(matchedRooms.map(r=>r.id)),outside=[...picked].filter(id=>!visible.has(id)).length;const count=el('key-selection-count');count.hidden=picked.size===0;count.textContent=picked.size+' Räume für Sammeländerung ausgewählt'+(outside?' · '+outside+' außerhalb des Filters':'');el<HTMLButtonElement>('key-batch-apply').disabled=editorLocked||picked.size===0;}
function updateListControls(){const pages=Math.ceil(matchedRooms.length/listPageSize),start=listPage*listPageSize;el('key-list-range').textContent=matchedRooms.length+' Räume'+(pages>1?' · '+(start+1)+'–'+Math.min(start+listPageSize,matchedRooms.length)+' angezeigt':'');el('key-list-pages').hidden=pages<=1;el<HTMLButtonElement>('key-list-prev').disabled=editorLocked||listPage===0;el<HTMLButtonElement>('key-list-next').disabled=editorLocked||listPage+1>=pages;}
function drawList(followSelection=false){const list=el('key-room-list');list.replaceChildren();const q=field('key-search').value.toLocaleLowerCase(),level=select('key-filter-level').value,group=select('key-filter-group').value,filter=select('key-filter').value,rooms=keyRooms().filter(r=>r.scopeId===scopeId),byId=new Map(records().map(k=>[k.id,k])),visibleIds=new Set(workspace()?.rooms.map(r=>r.id)??[]),features=new Set(data?.elements.filter(e=>!e.archived&&e.kind==='feature').map(e=>e.roomId)??[]);matchedRooms=rooms.sort((a,b)=>roomNumberOrder.compare(a.number,b.number)).filter(room=>{const content=byId.get(room.id),key=content?.kind==='room'?content:undefined,text=[room.number,room.name,...room.sections.filter(s=>s.kind==='markdown').map(s=>s.markdown),key?.status,key?.tags.join(' '),...(key?.blocks.map(b=>b.text)??[]),...Object.values(key?.attributes??{})].join(' ').toLocaleLowerCase();if(q&&!text.includes(q)||level&&(key?.levelId??'')!==level||group&&(key?.groupId??'')!==group||filter==='secret'&&!key?.secret||filter==='ready'&&key?.status!=='ready'||filter==='draft'&&key?.status==='ready'||filter==='feature'&&!features.has(room.id))return false;return true;});if(followSelection){const index=matchedRooms.findIndex(r=>r.id===roomId);if(index>=0)listPage=Math.floor(index/listPageSize);}listPage=Math.min(listPage,Math.max(0,Math.ceil(matchedRooms.length/listPageSize)-1));for(const room of matchedRooms.slice(listPage*listPageSize,(listPage+1)*listPageSize)){const content=byId.get(room.id),key=content?.kind==='room'?content:undefined;const row=document.createElement('div'),check=document.createElement('input'),button=document.createElement('button');check.type='checkbox';check.checked=picked.has(room.id);check.setAttribute('aria-label','Raum '+room.number+' für Sammeländerung auswählen');check.dataset.roomId=room.id;check.onchange=()=>{if(check.checked)picked.add(room.id);else picked.delete(room.id);updateSelectionCount();};button.setAttribute('aria-pressed',String(room.id===roomId));button.textContent=(!visibleIds.has(room.id)?'Ohne Geometrie · ':'')+(key?.levelId?byId.get(key.levelId)?.name+' · ':'')+room.number+'. '+room.name;button.onclick=()=>{void moveEditor(async()=>{openRoom(room.id);if(visibleIds.has(room.id))await navigate(room.id);}).catch(reportFailure);};row.append(check,button);list.append(row);}updateSelectionCount();updateListControls();}
function textBlock(visibility:'public'|'gm'){return draft?.blocks.find(b=>b.kind==='text'&&b.visibility===visibility);}
function drawForm(){if(!draft)return;el<HTMLButtonElement>('key-map').disabled=!workspace()?.rooms.some(r=>r.id===roomId);const room=keyRooms().find(r=>r.id===roomId);field('key-name').value=draft.kind==='room'?room?.name??draft.name:draft.name;field('key-number').value=draft.kind==='room'?room?.number??'':'';field('key-number').disabled=draft.kind!=='room';field('key-read-aloud').value=textBlock('public')?.text??'';field('key-gm-notes').value=textBlock('gm')?.text??'';field('key-attributes').value=attrText(draft.attributes);field('key-zsteps').value=draft.zSteps.join(', ');field('key-zsteps').disabled=draft.kind!=='level';field('key-tags').value=draft.tags.join(', ');field('key-status').value=draft.status;field('key-secret').checked=draft.secret;optionList('key-level',records().filter(r=>r.kind==='level'&&r.scopeId===scopeId),draft.levelId,'Ohne konzeptuelles Level');optionList('key-group',records().filter(r=>r.kind==='group'&&r.scopeId===scopeId),draft.groupId,'Ohne erbende Gruppe');select('key-level').disabled=!['room','group'].includes(draft.kind);select('key-group').disabled=draft.kind!=='room';el('key-original').textContent=draft.kind==='room'?room?.sections.filter(s=>s.kind==='markdown').map(s=>s.markdown).join('\n\n')??'':'';drawBlocks();drawReferences();drawSurfaceKey(draft,geometry,()=>{editVersion++;preview();schedule();});preview();}
function collect(){if(!draft)throw new Error('Raum oder Inhalt wählen.');for(const visibility of ['public','gm'] as const){const raw=field(visibility==='public'?'key-read-aloud':'key-gm-notes').value;let b=draft.blocks.find(b=>b.kind==='text'&&b.visibility===visibility);if(!b&&raw){b=block('text',visibility);draft.blocks.unshift(b);}if(b&&raw!==b.text&&raw!==b.text.replace(/\r\n?/g,'\n'))b.text=raw;}const c=structuredClone(draft);c.name=field('key-name').value;c.attributes=field('key-attributes').value===attrText(draft.attributes).replace(/\r\n?/g,'\n')?structuredClone(draft.attributes):attrs(field('key-attributes').value);c.tags=field('key-tags').value.split(',').map(s=>s.trim()).filter(Boolean);c.status=field('key-status').value;c.secret=field('key-secret').checked;c.levelId=select('key-level').value||null;c.groupId=select('key-group').value||null;if(c.groupId)c.levelId=records().find(r=>r.id===c.groupId)?.levelId??null;if(!['room','group'].includes(c.kind))c.levelId=null;if(c.kind!=='room')c.groupId=null;c.zSteps=c.kind==='level'?field('key-zsteps').value.split(/[\s,;]+/).filter(Boolean).map(Number):[];return c;}
function preview(){if(!draft||!geometry)return;try{const c=collect(),room=keyRooms().find(r=>r.id===(c.kind==='surface'?c.surface?.roomId:roomId)),all=[...records().filter(r=>r.id!==c.id),c],effective=keyAttributes(c,all);el('key-effective').textContent=effective.map(a=>a.key+': '+(a.value??'unterdrückt')+' ← '+a.origin).join('\n');if(!room||!['room','surface'].includes(c.kind)){el('key-rendered').textContent=c.blocks.filter(b=>b.kind==='text').map(b=>b.text).join('\n\n');return;}const heading=field('key-heading').value===''?null:Number(field('key-heading').value),rendered=renderDungeonKey(room,all,geometry,{surfaceOnly:c.kind==='surface'?c:undefined,audience:select('key-audience').value as 'gm'|'public',discovered:new Set(),allSecrets:field('key-discovered').checked,heading});el('key-rendered').textContent=rendered.text;}catch{}}
function drawReferences(){if(!draft)return;const list=el('key-references');list.replaceChildren();for(const ref of draft.references){const line=document.createElement('p'),remove=document.createElement('button');line.textContent=ref.kind+': '+(references.find(r=>r.id===ref.id)?.label??ref.label)+' ';remove.textContent='Entfernen';remove.onclick=()=>{draft!.references=draft!.references.filter(r=>r!==ref);drawReferences();};line.append(remove);list.append(line);}optionList('key-reference-target',references.map((r,i)=>({id:String(i),name:r.kind+': '+r.label})),null,'Kampagneninhalt auswählen');}
function primaryFields(){field('key-read-aloud').value=textBlock('public')?.text??'';field('key-gm-notes').value=textBlock('gm')?.text??'';}
function drawBlocks(){if(!draft)return;const list=el('key-blocks');list.replaceChildren();for(const[bIndex,b]of draft.blocks.entries()){const card=document.createElement('fieldset'),legend=document.createElement('legend'),kind=document.createElement('select'),visibility=document.createElement('select'),text=document.createElement('textarea'),suppressed=document.createElement('input'),template=document.createElement('select');legend.textContent='Block '+(bIndex+1);for(const[id,label]of [['text','Eigene Prosa'],['geometry','Geometriefakten'],['attributes','Beschreibungseigenschaften'],['exits','Ausgänge'],['legacy','Vorhandener Raumkey'],['template','Verknüpfte Vorlage']]){const o=document.createElement('option');o.value=id!;o.textContent=label!;kind.append(o);}kind.value=b.kind;kind.onchange=()=>{b.kind=kind.value as KeyBlock['kind'];primaryFields();drawBlocks();preview();};for(const[id,label]of [['public','Vorlesbar'],['gm','Nur GM'],['secret','Bis zur Entdeckung verborgen']]){const o=document.createElement('option');o.value=id!;o.textContent=label!;visibility.append(o);}visibility.value=b.visibility;visibility.onchange=()=>{b.visibility=visibility.value as KeyBlock['visibility'];primaryFields();preview();};text.value=b.text;text.rows=4;text.setAttribute('aria-label','Prosa Block '+(bIndex+1));text.hidden=b.kind!=='text';text.oninput=()=>{b.text=text.value;if(b===textBlock('public'))field('key-read-aloud').value=b.text;if(b===textBlock('gm'))field('key-gm-notes').value=b.text;preview();};suppressed.value=b.suppressed.join(', ');suppressed.placeholder='Unterdrückte Fakten: size, height oder Attributnamen';suppressed.hidden=!['geometry','attributes'].includes(b.kind);suppressed.oninput=()=>{b.suppressed=suppressed.value.split(',').map(s=>s.trim()).filter(Boolean);preview();};for(const t of records().filter(t=>t.kind==='template'&&t.scopeId===scopeId)){const o=document.createElement('option');o.value=t.id;o.textContent=t.name;template.append(o);}template.value=b.templateId??'';template.hidden=b.kind!=='template';template.onchange=()=>{b.templateId=template.value||null;preview();};card.append(legend,kind,visibility,text,suppressed,template);for(const[direction,label]of [[-1,'Nach oben'],[1,'Nach unten']] as const){const move=document.createElement('button');move.textContent=label;move.disabled=bIndex+direction<0||bIndex+direction>=draft.blocks.length;move.onclick=()=>{const index=draft!.blocks.indexOf(b),swap=draft!.blocks[index+direction];if(!swap)return;draft!.blocks[index+direction]=b;draft!.blocks[index]=swap;drawBlocks();preview();};card.append(move);}const remove=document.createElement('button');remove.textContent='Block entfernen';remove.onclick=()=>{draft!.blocks=draft!.blocks.filter(candidate=>candidate!==b);primaryFields();drawBlocks();preview();};card.append(remove);if(b.kind==='template'){const detach=document.createElement('button');detach.textContent='Vorlage lösen – Inhalt behalten';detach.onclick=()=>{const children=expandedKeyBlocks({...draft!,blocks:[b]},records()).map(c=>structuredClone(c));draft!.blocks.splice(draft!.blocks.indexOf(b),1,...children);primaryFields();drawBlocks();preview();};card.append(detach);}if(b.visibility==='secret'){for(const[prop,label]of [['searchMethod','Suchmethode'],['dc','Such-DC'],['discoveryNotes','Private Entdeckungshinweise'],['revealedText','Vorlesetext nach Entdeckung']] as const){const l=document.createElement('label'),input=prop==='dc'?document.createElement('input'):document.createElement('textarea');l.textContent=label;if(prop==='dc'){(input as HTMLInputElement).type='number';}input.value=b[prop]===null?'':String(b[prop]);input.oninput=()=>{if(prop==='dc')b.dc=input.value===''?null:Number(input.value);else b[prop]=input.value;preview();};l.append(input);card.append(l);}}list.append(card);}}
async function save(){
 if(!draft||!dirty())return;
 const o=owner(),id=draft.id,c=collect(),number=c.kind==='room'?field('key-number').value:null;
 saveState('pending','Dungeon-Key wird gespeichert…');
 let committed:Awaited<ReturnType<typeof command>>;
 if(c.kind==='room'){
  const room=keyRooms().find(r=>r.id===id);if(!room)throw new Error('Raum nicht mehr verfügbar.');
  committed=await command({kind:'key-batch',rooms:[{id,expectedRevision:baseRoomRevision??room.revision,keyRevision:baseKeyRevision}],patch:{name:{mode:'replace',text:c.name},number:number!,levelId:c.levelId,groupId:c.groupId,attributes:c.attributes,attributeMode:'replace',blocks:c.blocks,tags:c.tags,secret:c.secret,status:c.status,references:c.references}});
 }else committed=await command({kind:'key-content',content:c,expectedRevision:baseKeyRevision});
 if(!committed||!owns(o)||draft?.id!==id)return;
 const stored=committed.view.keyContent?.find(r=>r.id===id),room=committed.workspace.rooms.find(r=>r.id===id)??committed.view.hiddenRooms.find(r=>r.id===id);
 if(!stored||c.kind==='room'&&!room)throw new Error('Gespeicherter Key konnte nicht bestätigt werden.');
 draft.revision=stored.revision;baseKeyRevision=stored.revision;baseRoomRevision=c.kind==='room'?room!.revision:null;
 baseSignature=signature(c.kind==='room'?{...stored,name:room!.name}:stored,c.kind==='room'?room!.number:null);
 blocked=false;preview();
 try{saveState(dirty()?'dirty':'saved',dirty()?'Weitere Eingabe offen – wird automatisch gespeichert.':'Dungeon-Key gespeichert.');}catch(e){reportFailure(e);}
 if(!blocked)tell('Dungeon-Key gespeichert. Gemeinsame Autoren-History verfügbar.');
}
function blank(kind:KeyContent['kind'],id:string=uuid()):KeyContent{return{id,revision:0,scopeId,kind,name:kind==='dungeon'?'Dungeonwerte':'Neuer Inhalt',levelId:null,groupId:null,zSteps:[],attributes:{},blocks:[],tags:[],secret:false,status:'',references:[]};}
export function initKeys(status:typeof tell,w:typeof workspace,r:typeof selected,drain:typeof before,changed:typeof publish,go:typeof navigate){
 tell=status;workspace=w;selected=r;before=drain;publish=changed;navigate=go;
 initKeyCopy({context:()=>{const o=owner(),source=keyRooms().find(r=>r.id===roomId);return draft?.kind==='room'&&source&&geometry?{identity:JSON.stringify(o)+':'+source.id,source,rooms:keyRooms(),records:records(),geometry,targets:[...picked]}:null;},prepare:async()=>await flushKeys()&&await refresh(),commit:async action=>{let ok=false;run(async()=>{const result=await command(action);if(!result)return;if(roomId)openRoom(roomId);ok=true;tell(action.rooms.length+' Räume als unabhängige Inhaltskopien bearbeitet.');},true);await pending;return ok;}});

 const editing=new Set(['key-name','key-number','key-read-aloud','key-gm-notes','key-attributes','key-zsteps','key-tags','key-status','key-secret','key-level','key-group']);
 for(const type of ['input','change','click'] as const)el('key-dialog').addEventListener(type,event=>{
  const target=event.target as HTMLElement;
  // Controls can redraw and detach themselves before this listener runs.
  const contentEdit=event.composedPath().some(node=>['key-blocks','key-references'].includes((node as HTMLElement).id));
  if(type!=='click'&&editing.has(target.id)||contentEdit||type==='click'&&['key-add-block','key-reference-add'].includes(target.id)){
   editVersion++;blocked=false;schedule();
  }
 });
 el('key-dialog').addEventListener('cancel',event=>{event.preventDefault();void moveEditor(()=>el<HTMLDialogElement>('key-dialog').close()).catch(reportFailure);});
 el('key-open').onclick=()=>{const o=owner(),room=selected(),intent=++transition;run(async()=>{if(!(await before())||!owns(o)||intent!==transition)return;if(!room)throw new Error('Raum auswählen.');scopeId=room.scopeId;if(!await refresh()||!owns(o)||intent!==transition)return;openRoom(room.id);optionList('key-filter-level',records().filter(r=>r.kind==='level'&&r.scopeId===scopeId),null,'Alle Level');optionList('key-filter-group',records().filter(r=>r.kind==='group'&&r.scopeId===scopeId),null,'Alle Gruppen');el<HTMLDialogElement>('key-dialog').showModal();});};
 el('key-add-room').onclick=()=>{void moveEditor(async()=>{
  run(async()=>{const o=owner(),w=workspace();if(!w)return;if(!await before())throw new Error('Andere offene Eingaben zuerst prüfen.');if(!owns(o))return;
   const result=await window.campaign.addRoom(w.token);if(!owns(o))return;if(!result.ok)throw new Error(result.error);
   acknowledged=result.value;await publish(result.value);if(!owns(o)||!await refresh()||!owns(o))return;
   const room=result.value.rooms.find(r=>r.id===result.value.selectedId);if(!room)throw new Error('Neuer Raum konnte nicht geöffnet werden.');
   field('key-search').value='';select('key-filter-level').value='';select('key-filter-group').value='';select('key-filter').value='';listPage=0;openRoom(room.id);
   el('key-dialog').scrollTop=0;saveState('saved','Neuer Raum angelegt. Name, Vorlesetext und GM-Notizen direkt eingeben.');
  },true);await pending;
 }).then(ok=>{if(ok&&!blocked&&el<HTMLDialogElement>('key-dialog').open){field('key-name').focus();field('key-name').select();}}).catch(reportFailure);};
 el('key-close').onclick=()=>{void moveEditor(()=>el<HTMLDialogElement>('key-dialog').close()).catch(reportFailure);};
 el('key-save').onclick=()=>{blocked=false;void flushKeys();};
 el('key-reload').onclick=()=>{void reload();};
 el('key-map').onclick=()=>{const id=roomId;if(!id)return;void moveEditor(async()=>{el<HTMLDialogElement>('key-dialog').close();await navigate(id);}).catch(reportFailure);};
 el('key-add-block').onclick=()=>{if(draft){draft.blocks.push(block());drawBlocks();}};
 el('key-reference-add').onclick=()=>{if(select('key-reference-target').value==='')return;const ref=references[Number(select('key-reference-target').value)];if(draft&&ref&&!draft.references.some(r=>r.id===ref.id)){draft.references.push({...ref});drawReferences();}};
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
 el('key-search').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){const first=el('key-room-list').querySelector<HTMLButtonElement>('button');if(first){event.preventDefault();first.click();}}});
 for(const[visibility,id]of [['public','key-read-aloud'],['gm','key-gm-notes']] as const)el(id).addEventListener('input',()=>{if(!draft)return;let b=textBlock(visibility);if(!b){b=block('text',visibility);draft.blocks.unshift(b);}b.text=field(id).value;});
 for(const id of ['key-name','key-read-aloud','key-gm-notes','key-attributes','key-heading','key-audience','key-discovered','key-level','key-group'])el(id).addEventListener('input',preview);
 el('key-select-visible').onclick=()=>{for(const room of matchedRooms)picked.add(room.id);for(const input of el('key-room-list').querySelectorAll<HTMLInputElement>('input')){input.checked=true;if(input.dataset.roomId)picked.add(input.dataset.roomId);}updateSelectionCount();};
 el('key-select-none').onclick=()=>{picked.clear();drawList();};
 el('key-batch-apply').onclick=applyBatch;}
export function activateKeys(){invalidateKeyCopy();generation++;transition++;readVersion++;editVersion++;pending=null;roomId=null;scopeId='';preparedBatch=null;if(timer)clearTimeout(timer);timer=null;blocked=false;editorLocked=false;draft=null;data=null;geometry=null;acknowledged=null;baseSignature='';baseRoomRevision=null;baseKeyRevision=null;matchedRooms=[];listPage=0;picked.clear();el<HTMLDialogElement>('key-dialog').close();}
export async function flushKeys():Promise<boolean>{
 const o=owner();if(timer){clearTimeout(timer);timer=null;}
 await pending;if(!owns(o)||blocked)return false;
 try{
  while(dirty()){
   run(save);await pending;if(!owns(o)||blocked)return false;
  }
  if(timer){clearTimeout(timer);timer=null;}return true;
 }catch(e){if(owns(o))reportFailure(e);return false;}
}

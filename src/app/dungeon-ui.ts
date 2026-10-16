import {journeyPlayback,type PlaybackFrame,type JourneySpeed} from './journey-playback';
import {renderDungeonPace,dungeonPaceDirty,dungeonPaceDraft,acceptDungeonPace,clearDungeonPace} from './dungeon-pace-ui';
import {drawDungeonContents} from './dungeon-content-live-ui';
import type {DungeonMovement} from './volume-contracts';
import type {Workspace,Point} from './contracts';
import type {DungeonView,DungeonPose,DungeonPreview,DungeonAction,DungeonSenseAction,DungeonTraceRules} from './dungeon-contracts';
import {centerInRoom} from './dungeon-model';
import {roomPath,elementSvg,inside} from './drawing-model';
import {trackAt} from './track-model';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const select=(id:string)=>el<HTMLSelectElement>(id),number=(id:string)=>Number(el<HTMLInputElement>(id).value);
let traceStart:DungeonPose|null=null;
let workspace:Workspace|null=null,data:DungeonView|null=null,target:DungeonPose|null=null,preview:DungeonPreview|null=null;
let generation=0,readRequest=0,routeIntent=0,job:Promise<boolean>|null=null;
let status:(s:string,error?:boolean)=>void=()=>{};let navigateCombat:(id:string)=>void=()=>{};
type FieldValue=string|boolean;
const traceFields=['dungeon-trace-generate','dungeon-trace-movement','dungeon-trace-surface','dungeon-trace-environment','dungeon-trace-strength','dungeon-trace-sg','dungeon-trace-life','dungeon-trace-decay'];
const senseFields=['dungeon-sense-score','dungeon-hearing','dungeon-track-dc','dungeon-sense-reason'];
const fieldBase=new Map<string,FieldValue>();
let confirmedFields:Map<string,FieldValue>|null=null;
let shownTraceOwner='party',shownNpc='';
interface TrackFields{publicText:string;dc:string;hidden:boolean}
const trackDrafts=new Map<string,{values:TrackFields;base:TrackFields}>();
const sameTrack=(a:TrackFields,b:TrackFields)=>a.publicText===b.publicText&&a.dc===b.dc&&a.hidden===b.hidden;
function fieldValue(id:string):FieldValue{const input=el<HTMLInputElement>(id);return input.type==='checkbox'?input.checked:input.value;}
function paintField(id:string,next:FieldValue){
 const previous=fieldBase.get(id),current=fieldValue(id),own=confirmedFields?.has(id)??false;
 if(previous===undefined||current===previous||own&&current===confirmedFields!.get(id)){
  const input=el<HTMLInputElement>(id);if(typeof next==='boolean')input.checked=next;else input.value=next;
  fieldBase.set(id,next);
 }else if(own)fieldBase.set(id,next);
}
function dirtyFields(ids?:readonly string[]){return(!ids&&dungeonPaceDirty())||(ids??[...traceFields,...senseFields]).some(id=>fieldBase.has(id)&&fieldValue(id)!==fieldBase.get(id));}
function owner(){return{generation,token:workspace?.token,sceneId:data?.sceneId};}
type Owner=ReturnType<typeof owner>;
function current(o:Owner){return generation===o.generation&&workspace?.token===o.token&&data?.sceneId===o.sceneId;}
function run(fn:(o:Owner)=>Promise<boolean>){
 if(job)return Promise.resolve(false);const o=owner();
 const task=Promise.resolve().then(()=>current(o)?fn(o):false).catch(e=>{if(current(o))status(e.message,true);return false;}).finally(()=>{if(job===task)job=null;});
 job=task;return task;
}
function invalidatePreview(){routeIntent++;preview=null;el('dungeon-preview').textContent='';el<HTMLButtonElement>('dungeon-confirm').disabled=true;}
function perform(a:DungeonAction,after?:(o:Owner)=>void){
 const captured=structuredClone(a);
 const fields=a.kind==='trace-rules'?traceFields:a.kind==='senses'?senseFields:[];
 const submitted=new Map(fields.map(id=>[id,fieldValue(id)]));
 const submittedTrack=a.kind==='track-correct'?{...(trackDrafts.get(a.id)?.values??{publicText:a.publicText,dc:String(a.dc),hidden:a.hidden})}:null;
 return run(async o=>{
  const w=workspace;if(!w)return false;
  ++readRequest;invalidatePreview();
  const result=await window.campaign.executeDungeon({commandId:crypto.randomUUID(),token:w.token,campaignId:w.campaign.id,action:captured});
  if(!current(o))return false;
  if(!result.ok)throw new Error(result.error);
  if(result.value.sceneId!==o.sceneId){status('Aktion für die ursprüngliche Gruppe gespeichert. Der Fokus hat gewechselt; offene Eingaben behalten und anschließend aktualisieren.',true);return false;}
  if(captured.kind==='pace-settings'&&result.value.travelPace)acceptDungeonPace(captured.settings,result.value.travelPace);
  data=result.value;confirmedFields=submitted;
  if(captured.kind==='track-correct'&&submittedTrack){
   const draft=trackDrafts.get(captured.id),track=data.tracks.find(t=>t.id===captured.id);
   if(draft&&track){const base={publicText:track.publicText,dc:String(track.dc),hidden:track.hidden??false};if(sameTrack(draft.values,submittedTrack)||sameTrack(draft.values,base))trackDrafts.delete(captured.id);else draft.base=base;}
  }
  try{draw();}finally{confirmedFields=null;}
  if(current(o))after?.(o);
  return true;
 });
}
function playbackFrame():PlaybackFrame|null{const j=data?.journey;if(!workspace||!data?.travelPace||!j||j.status!=='active'||document.hidden||dungeonPaceDirty())return null;return{key:workspace.token+':'+data.sceneId+':'+j.id,revision:j.revision,nextIndex:j.revision,seconds:3600};}
const playback=journeyPlayback({read:playbackFrame,step:async basis=>{const frame=playbackFrame(),j=data?.journey;if(!frame||!j||frame.key!==basis.key||frame.revision!==basis.revision)return false;return await perform({kind:'round',sceneId:j.request.sceneId,id:j.id,expectedRevision:j.revision,expectedSettingsRevision:data!.travelPace!.settings.revision});},changed:renderPlayback});
function renderPlayback(){if(!document.getElementById('dungeon-play'))return;const j=data?.journey,round=data?.travelPace?.settings.explorationRoundSeconds??600,elapsed=j?.segmentElapsedSeconds??0;el('dungeon-round-status').textContent='Erkundungsrunde '+round+' s · '+(playback.running?'Wiedergabe '+playback.speed+'× läuft':j?.status==='active'?'Wiedergabe pausiert':'Wiedergabe angehalten')+(elapsed?' · Unterwegs zum nächsten Rasterpunkt: '+elapsed+' / '+j!.segmentSeconds[j!.nextIndex]+' s':'');el('dungeon-play').textContent=playback.running?'Wiedergabe anhalten':'Wiedergabe starten';el<HTMLButtonElement>('dungeon-play').disabled=!(j?.status==='active')||dungeonPaceDirty();el<HTMLButtonElement>('dungeon-round-step').disabled=!(j?.status==='active')||dungeonPaceDirty()||playback.busy;}
async function explicitTravel(action:(j:NonNullable<DungeonView['journey']>)=>DungeonAction){const o=owner();playback.stop();await playback.settled();if(!current(o)||!data?.journey)return;await perform(action(data.journey));}
function chosen(){if(!data)return;const room=data.rooms.find(r=>r.id===select('dungeon-room').value);if(!room)return;const at=centerInRoom(room),v=data.drawing.volumes?.find(v=>v.roomId===room.id),column=v?.columns.find(c=>c.x===Math.floor(at.x/1.524)&&c.y===Math.floor(at.y/1.524)),span=column?.spans.find(s=>s.floor)??column?.spans[0];if(span)el<HTMLInputElement>('dungeon-height-step').value=String(span.z);target={...at,scopeId:room.scopeId,floorId:room.floorId,roomId:room.id,z:data.floors.find(f=>f.id===room.floorId&&f.scopeId===room.scopeId)!.elevation+number('dungeon-height-step')*1.524,movement:select('dungeon-movement').value as DungeonMovement};preview=null;drawMap();}
function draw(){if(!data)return;playback.sync();renderPlayback();renderDungeonPace(data.travelPace,()=>{playback.stop();invalidatePreview();});if(target)target={...target,movement:select('dungeon-movement').value as DungeonMovement};el('dungeon-context').textContent=data.sceneId?data.sceneTitle+' · bestätigte Zeit '+Math.floor(Number(BigInt(data.instantMs)/1000n)/60)+' min · '+(data.position?'Gruppe im Dungeon · Höhe '+data.position.z.toFixed(2)+' m · '+(data.position.movement??'walk'):'Gruppe noch nicht im Dungeon'):'Unter Party und Leiten eine Gruppe fokussieren.';const roomSelect=select('dungeon-room'),old=target?.roomId??data.position?.roomId??roomSelect.value;roomSelect.replaceChildren();for(const r of data.rooms){const o=document.createElement('option');o.value=r.id;o.textContent=r.number+'. '+r.name+' · '+(data.floors.find(f=>f.id===r.floorId&&f.scopeId===r.scopeId)?.name??'Geschoss');roomSelect.append(o);}roomSelect.value=old&&data.rooms.some(r=>r.id===old)?old:data.rooms[0]?.id??'';if(!target||!data.rooms.some(r=>r.id===target!.roomId))chosen();const npc=select('dungeon-npc'),selected=npc.value;npc.replaceChildren();for(const n of data.npcs){const o=document.createElement('option');o.value=n.id;o.textContent=n.name+(n.pose?' · Raum '+(data.rooms.find(r=>r.id===n.pose!.roomId)?.number??'?'):'');npc.append(o);}npc.value=selected||data.npcs[0]?.id||'';const j=data.journey;el('dungeon-route-status').textContent=j?j.reason||'Route '+j.status+' · '+j.nextIndex+'/'+j.route.length+' Wegpunkte · '+j.distanceMeters.toFixed(1)+' m · '+j.durationSeconds+' s · bestätigt mit '+j.request.speedMetersPerMinute.toLocaleString('de-DE')+' m/min':'Ziel im Grundriss anklicken und Weg vorbereiten.';el<HTMLButtonElement>('dungeon-step').disabled=!j||j.status!=='active';el<HTMLButtonElement>('dungeon-pause').disabled=!j||!['active','paused'].includes(j.status);el('dungeon-pause').textContent=j?.status==='paused'?'Fortsetzen':'Pause';el<HTMLButtonElement>('dungeon-authorize').disabled=j?.status!=='decision';el<HTMLButtonElement>('dungeon-trigger').disabled=j?.status!=='decision'||!!data.triggerEvents?.find(e=>e.id===j.triggerEventId)?.activated;el<HTMLButtonElement>('dungeon-end').disabled=!j||['arrived','ended'].includes(j.status);const activity=el('dungeon-activity');activity.replaceChildren();for(const n of data.npcs.filter(n=>n.pose)){const p=document.createElement('p');p.textContent=n.name+' · Raum '+(data.rooms.find(r=>r.id===n.pose!.roomId)?.number??'?')+(n.destination?' → '+(data.rooms.find(r=>r.id===n.destination!.roomId)?.number??'?'):'')+(n.paused?' · Pause':'')+(n.pending?' · '+n.pending:'');activity.append(p);}el('dungeon-preview').textContent=preview?'Vorschau: '+preview.distanceMeters.toFixed(1)+' m · '+preview.durationSeconds+' s · '+preview.route.length+' Wegpunkte'+(preview.pace?' · '+preview.request.speedMetersPerMinute.toLocaleString('de-DE')+' m/min · '+preview.pace.reason:''):'';el<HTMLButtonElement>('dungeon-confirm').disabled=!preview;drawMap();drawSenses();}
function drawTriggerEvents(){const list=el('dungeon-trigger-events');list.replaceChildren();if(!data)return;for(const event of data.triggerEvents??[]){const trap=data.drawing.elements.find(e=>e.id===event.trapId),card=document.createElement('article'),heading=document.createElement('h3'),facts=document.createElement('p'),description=document.createElement('pre'),notes=document.createElement('details'),summary=document.createElement('summary'),privateText=document.createElement('pre');heading.textContent=(trap?.name??'Erhaltene Falle')+' · '+event.fieldNames.join(', ');facts.textContent=(event.mode==='interrupt'?'Reiseunterbrechung':'GM-Benachrichtigung')+' · '+event.status+' · Höhe '+event.pose.z.toFixed(2)+' m · '+(event.activated?'Aktivierung bestätigt':'keine Charge verbraucht');description.textContent=trap?.content?.publicText??'';summary.textContent='GM-Kontext / Bedienung / Lösung';privateText.textContent=trap?.notes??'';notes.append(summary,privateText);card.append(heading,facts,description,notes);for(const [operation,label]of [['activate','Tatsächliche Aktivierung bestätigen'],['dismiss','Kontext schließen / Reise fortsetzen'],['abort','Reise abbrechen'],['reopen','Kontext erneut öffnen']] as const){const button=document.createElement('button');button.textContent=label;button.disabled=operation==='activate'&&event.activated||operation==='reopen'&&event.status==='open'||operation==='dismiss'&&event.status==='dismissed';button.onclick=()=>perform({kind:'trigger-event',sceneId:event.sceneId,eventId:event.id,expectedRevision:event.revision,operation});card.append(button);}list.append(card);}}
function drawSenses(){
 if(!data)return;drawTraceRules();drawTriggerEvents();drawDungeonContents(data,perform,navigateCombat);const room=data.rooms.find(r=>r.id===data!.position?.roomId);el('dungeon-key-heading').textContent=room?'Gruppe in '+room.number+'. '+room.name:'Aktueller Raum';const description=el('dungeon-key-description');description.replaceChildren();if(!room){const empty=document.createElement('p');empty.textContent=data.sceneId?'Gruppe in einem Raum platzieren, um seinen Text zu lesen.':'Unter Party und Leiten eine Gruppe fokussieren.';description.append(empty);}for(const b of data.keyDescription?.blocks??[]){const card=document.createElement('article'),text=document.createElement('pre');card.className=b.visibility==='secret'?'key-secret-block':b.visibility==='gm'?'key-gm-block':'';text.textContent=(b.visibility==='gm'?'GM: ':b.visibility==='secret'?'Verborgen: ':'')+b.text;card.append(text);if(b.visibility==='secret'){const hint=document.createElement('p');hint.textContent=[b.searchMethod,b.dc===null?'':'DC '+b.dc,b.discoveryNotes].filter(Boolean).join(' · ');const reveal=document.createElement('button');reveal.textContent=b.discovered?'Für Gruppe wieder verbergen':'Für Gruppe sichtbar machen';reveal.onclick=()=>{if(data?.sceneId&&data.position)perform({kind:'key-discovery',sceneId:data.sceneId,roomId:data.position.roomId,subjectId:b.id,known:!b.discovered});};card.append(hint,reveal);}description.append(card);}
 const pursuit=data.journey?.pursuit;
 el('dungeon-pursuit-state').textContent=pursuit?'Verfolgung '+pursuit.state+' · '+pursuit.followedTraceIds.length+' Segmente · '+(pursuit.reason||data.journey!.reason):'';
 el<HTMLButtonElement>('dungeon-pursuit-check').disabled=!pursuit||data.journey?.status!=='decision';
 paintField('dungeon-sense-score',data.senses.settings.activeScore===null?'':String(data.senses.settings.activeScore));
 paintField('dungeon-hearing',String(data.senses.settings.hearingMeters));
 paintField('dungeon-track-dc',data.senses.settings.trackDcOverride===null?'':String(data.senses.settings.trackDcOverride));
 paintField('dungeon-sense-reason','');
 const observations=el('dungeon-observations');observations.replaceChildren();
 for(const o of data.senses.observations.filter(o=>o.known&&(o.visible||o.heard))){
  const p=document.createElement('p');
  p.textContent=(o.subjectKind==='actor'?data.npcs.find(n=>n.id===o.subjectId)?.name??'NPC':o.publicText??o.subjectKind)+(o.visible?' · sichtbar':'')+(o.heard?' · hörbar':'')+(o.override?' · GM-Override':'');observations.append(p);
 }
 const tracks=el('dungeon-tracks');tracks.replaceChildren();
 for(const t of data.tracks.filter(t=>target&&t.to.scopeId===target.scopeId&&t.to.floorId===target.floorId).slice(0,20)){
  const p=document.createElement('p'),label=document.createElement('input'),dc=document.createElement('input'),hidden=document.createElement('input'),save=document.createElement('button');
  const draft=trackDrafts.get(t.id),base=draft?.base??{publicText:t.publicText,dc:String(t.dc),hidden:t.hidden??false};
  label.value=draft?.values.publicText??t.publicText;label.setAttribute('aria-label','Spielertext der Spur');
  dc.type='number';dc.value=draft?.values.dc??String(t.dc);dc.setAttribute('aria-label','Spuren-SG');
  hidden.type='checkbox';hidden.checked=draft?.values.hidden??t.hidden??false;hidden.setAttribute('aria-label','Spur unterdrücken');
  const remember=()=>{
   const values={publicText:label.value,dc:dc.value,hidden:hidden.checked};
   if(sameTrack(values,base))trackDrafts.delete(t.id);else trackDrafts.set(t.id,{values,base});
  };
  label.oninput=remember;dc.oninput=remember;hidden.onchange=remember;
  const follow=document.createElement('button');follow.textContent='Spur verfolgen';follow.dataset.traceId=t.id;
  follow.onclick=()=>{if(data?.sceneId)perform({kind:'pursue',sceneId:data.sceneId,traceId:t.id,score:number('dungeon-pursuit-score'),direction:select('dungeon-pursuit-direction').value as 'forward'|'backward',skill:select('dungeon-pursuit-skill').value as 'perception'|'survival'});};
  const state=trackAt(t,data.epochId,data.instantMs);save.textContent='Spur korrigieren';
  save.onclick=()=>perform({kind:'track-correct',id:t.id,dc:Number(dc.value),hidden:hidden.checked,publicText:label.value});
  p.append('Spur '+t.from.x.toFixed(1)+','+t.from.y.toFixed(1)+' → '+t.to.x.toFixed(1)+','+t.to.y.toFixed(1)+' · Stärke '+Math.round(state.strength)+' · aktueller SG '+state.dc+' · ',label,dc,' Unterdrücken ',hidden,save,follow);
  if(data.journey?.pursuit?.candidates.includes(t.id)){
   const choose=document.createElement('button');choose.textContent='Diese Abzweigung wählen';
   choose.onclick=()=>{const j=data?.journey;if(j)perform({kind:'pursuit-check',sceneId:j.request.sceneId,id:j.id,expectedRevision:j.revision,traceId:t.id,score:number('dungeon-pursuit-score')});};p.append(choose);
  }
  tracks.append(p);
 }
 const links=el('dungeon-passage-links');links.replaceChildren();
 for(const p of data.drawing.passages?.filter(p=>p.roomId===data!.position?.roomId)??[]){
  for(const[key,title]of [['outbound','Weiter'],['inbound','Zurück']] as const){
   const side=p[key];if(side.target.kind==='geometry')continue;
   const b=document.createElement('button');b.textContent=title+' über Passage · '+(side.description||side.target.kind)+' · '+(data.drawing.passageStatuses?.find(s=>s.id===p.id)?.[key]??'');b.disabled=!p.assigned||!side.passable;
   b.onclick=()=>{if(data?.sceneId)perform({kind:'passage-traverse',sceneId:data.sceneId,passageId:p.id,expectedRevision:p.revision,side:key,movement:select('dungeon-movement').value as DungeonMovement});};links.append(b);
  }
 }
 const encounters=el('dungeon-encounters');encounters.replaceChildren();
 for(const group of data.senses.groups){
  const b=document.createElement('button');b.textContent='Begegnung vorbereiten: '+group.name;b.disabled=!group.available||!data.sceneId;
  b.onclick=()=>{
   if(data?.sceneId)perform({kind:'encounter',sceneId:data.sceneId,groupId:group.id,expectedGroupRevision:group.revision},o=>{
    setTimeout(()=>{if(current(o))el('live-tab').click();},0);status('Begegnung mit bestehenden NPCs vorbereitet. Initiative bleibt eine GM-Aktion.');
   });
  };
  encounters.append(b);
 }
 const logs=el('dungeon-sense-log');logs.replaceChildren();
 for(const entry of data.senses.logs.slice(0,10)){const p=document.createElement('p');p.textContent=entry.text;logs.append(p);}
}
function drawTraceRules(){
 if(!data)return;
 const r=select('dungeon-trace-owner').value==='npc'?data.npcs.find(n=>n.id===select('dungeon-npc').value)?.traceRules??data.traceRules:data.traceRules;
 paintField('dungeon-trace-generate',r.generate);paintField('dungeon-trace-movement',r.movement);paintField('dungeon-trace-surface',r.surface);paintField('dungeon-trace-environment',r.environment);paintField('dungeon-trace-strength',String(r.strength));
 for(const[id,key]of [['dungeon-trace-sg','dcOverride'],['dungeon-trace-life','lifetimeSeconds'],['dungeon-trace-decay','decayPerHour']] as const)paintField(id,r[key]===null?'':String(r[key]));
 shownTraceOwner=select('dungeon-trace-owner').value;shownNpc=select('dungeon-npc').value;
}
function drawMap(){if(!data||!target)return;const svg=el<SVGSVGElement&HTMLElement>('dungeon-map'),ns='http://www.w3.org/2000/svg';svg.replaceChildren();const rooms=data.rooms.filter(r=>r.scopeId===target!.scopeId&&r.floorId===target!.floorId);let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const room of rooms)for(const polygon of room.polygons)for(const point of polygon.outer){minX=Math.min(minX,point.x);minY=Math.min(minY,point.y);maxX=Math.max(maxX,point.x);maxY=Math.max(maxY,point.y);}if(!Number.isFinite(minX))return;minX-=2;minY-=2;maxX+=2;maxY+=2;svg.setAttribute('viewBox',`${minX} ${minY} ${maxX-minX} ${maxY-minY}`);const shape=(tag:string,attrs:Record<string,string>)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);svg.append(e);return e;};for(const r of rooms){shape('path',{d:roomPath(r.polygons),fill:r.id===target.roomId?'#ddcfac':'#c6c8b5',stroke:'#485659','stroke-width':'.12','fill-rule':'evenodd'});const at=centerInRoom(r),text=shape('text',{x:String(at.x),y:String(at.y),'text-anchor':'middle','font-size':'.65',fill:'#293b44'});text.textContent=r.number;}for(const e of data.drawing.elements.filter(e=>!e.archived&&e.scopeId===target!.scopeId&&e.floorId===target!.floorId)){const group=document.createElementNS(ns,'g');group.innerHTML=elementSvg(e,rooms,data.drawing.elements);svg.append(group);}const route=preview?.route??data.journey?.route.slice(data.journey.nextIndex)??[],visible=route.filter(p=>p.floorId===target!.floorId&&p.scopeId===target!.scopeId);if(visible.length)shape('polyline',{points:visible.map(p=>p.x+','+p.y).join(' '),fill:'none',stroke:'#cc7345','stroke-width':'.16','stroke-dasharray':'.25 .2'});for(const t of data.tracks.filter(t=>t.from.scopeId===target!.scopeId&&t.from.floorId===target!.floorId&&t.to.floorId===target!.floorId))shape('path',{d:'M'+t.from.x+','+t.from.y+'L'+t.to.x+','+t.to.y,stroke:'#a499ac','stroke-width':'.09','stroke-dasharray':'.15 .18',opacity:'.5'});for(const n of data.npcs){const points=n.path.filter(p=>p.scopeId===target!.scopeId&&p.floorId===target!.floorId);if(points.length)shape('polyline',{points:points.map(p=>p.x+','+p.y).join(' '),fill:'none',stroke:'#8f63a8','stroke-width':'.1','stroke-dasharray':'.2 .15'});}const dot=(p:Point,color:string,r='.3')=>shape('circle',{cx:String(p.x),cy:String(p.y),r,fill:color,stroke:'#fff','stroke-width':'.09'});dot(target,'#bd704b','.22');if(data.position&&data.position.floorId===target.floorId&&data.position.scopeId===target.scopeId)dot(data.position,'#367c94');for(const n of data.npcs.filter(n=>n.pose?.floorId===target!.floorId&&n.pose.scopeId===target!.scopeId))dot(n.pose!,'#8964a5','.2');el('dungeon-target').textContent='Ziel '+target.x.toFixed(2)+', '+target.y.toFixed(2)+' m · Höhe '+target.z.toFixed(2)+' m';}
export function initDungeon(notify:typeof status,combatNavigation:(id:string)=>void=()=>{}){navigateCombat=combatNavigation;
 status=notify;
 document.addEventListener('visibilitychange',()=>{if(document.hidden)playback.stop();});
 window.addEventListener('blur',()=>playback.stop());
 const bind=(id:string,create:()=>DungeonAction|null)=>{el(id).onclick=()=>{const a=create();if(a)perform(a);};};
 const withJourney=(fn:(j:NonNullable<DungeonView['journey']>)=>DungeonAction)=>data?.journey?fn(data.journey):null;
 select('dungeon-trace-owner').onchange=()=>{
  if(dirtyFields(traceFields)){select('dungeon-trace-owner').value=shownTraceOwner;status('Spurregeln zuerst speichern oder offene Einstellungen verwerfen.',true);return;}
  drawTraceRules();
 };
 select('dungeon-npc').onchange=()=>{
  if(select('dungeon-trace-owner').value==='npc'&&dirtyFields(traceFields)){select('dungeon-npc').value=shownNpc;status('Spurregeln zuerst speichern oder offene Einstellungen verwerfen.',true);return;}
  drawTraceRules();
 };
 el('dungeon-input-discard').onclick=()=>{
  if(job){status('Laufende Aktion abwarten.',true);return;}
  fieldBase.clear();trackDrafts.clear();renderDungeonPace(data?.travelPace,invalidatePreview,true);draw();
 };
 bind('dungeon-trace-rules-save',()=>{
  if(!data?.sceneId)return null;
  const optional=(id:string)=>el<HTMLInputElement>(id).value?number(id):null;
  const rules:DungeonTraceRules={generate:el<HTMLInputElement>('dungeon-trace-generate').checked,movement:select('dungeon-trace-movement').value as DungeonTraceRules['movement'],surface:select('dungeon-trace-surface').value as DungeonTraceRules['surface'],environment:select('dungeon-trace-environment').value as DungeonTraceRules['environment'],strength:number('dungeon-trace-strength'),dcOverride:optional('dungeon-trace-sg'),lifetimeSeconds:optional('dungeon-trace-life'),decayPerHour:optional('dungeon-trace-decay'),skill:select('dungeon-pursuit-skill').value as DungeonTraceRules['skill']};
  return{kind:'trace-rules',sceneId:data.sceneId,actorId:select('dungeon-trace-owner').value==='npc'?select('dungeon-npc').value:null,rules};
 });
 el('dungeon-trace-start').onclick=()=>{if(target){traceStart={...target};el('dungeon-trace-start-label').textContent='Anfang '+target.x.toFixed(2)+','+target.y.toFixed(2)+' m';}};
 bind('dungeon-trace-add',()=>{
  if(!data?.sceneId||!traceStart||!target){status('Spuranfang und Ziel wählen.',true);return null;}
  return{kind:'trace-add',sceneId:data.sceneId,from:traceStart,to:target,actorId:el<HTMLInputElement>('dungeon-trace-source-known').checked?select('dungeon-npc').value:null,sourceKnown:el<HTMLInputElement>('dungeon-trace-source-known').checked,publicText:el<HTMLInputElement>('dungeon-manual-trace-text').value,dc:number('dungeon-manual-trace-dc'),strength:number('dungeon-manual-trace-strength')};
 });
 bind('dungeon-pursuit-check',()=>withJourney(j=>({kind:'pursuit-check',sceneId:j.request.sceneId,id:j.id,expectedRevision:j.revision,traceId:null,score:number('dungeon-pursuit-score')})));
 const sense=(mode:DungeonSenseAction['mode'])=>{
  if(!data?.sceneId)return;
  perform({kind:'senses',sceneId:data.sceneId,action:{mode,subjectId:select('dungeon-npc').value||null,score:el<HTMLInputElement>('dungeon-sense-score').value?number('dungeon-sense-score'):null,hearingMeters:number('dungeon-hearing'),trackDcOverride:el<HTMLInputElement>('dungeon-track-dc').value?number('dungeon-track-dc'):null,reason:el<HTMLInputElement>('dungeon-sense-reason').value}});
 };
 for(const[id,mode]of Object.entries({'dungeon-perceive':'passive','dungeon-active-score':'active','dungeon-clear-score':'clear-active','dungeon-search-tracks':'search-tracks','dungeon-force-known':'force-known','dungeon-force-unknown':'force-unknown','dungeon-reevaluate':'reevaluate'}))el(id).onclick=()=>sense(mode as DungeonSenseAction['mode']);
 bind('dungeon-sound-emit',()=>data?.sceneId&&target?{kind:'sound',sceneId:data.sceneId,pose:target,publicText:el<HTMLInputElement>('dungeon-sound-text').value,rangeMeters:number('dungeon-sound-range'),dc:number('dungeon-sound-dc')}:null);
 select('dungeon-movement').onchange=()=>{playback.stop();if(target)target={...target,movement:select('dungeon-movement').value as DungeonMovement};invalidatePreview();draw();};
 el('dungeon-height-step').oninput=()=>{if(target&&data){target={...target,z:(data.floors.find(f=>f.id===target!.floorId&&f.scopeId===target!.scopeId)?.elevation??0)+number('dungeon-height-step')*1.524};invalidatePreview();draw();}};
 el('dungeon-group-speed').oninput=()=>{playback.stop();el('dungeon-pace-summary').textContent='Offene Tempovorgaben. Übernehmen, um neue Wege damit zu berechnen.';invalidatePreview();};
 bind('dungeon-pace-save',()=>{if(!data?.sceneId)return null;try{return{kind:'pace-settings',sceneId:data.sceneId,...dungeonPaceDraft()};}catch(e){status((e as Error).message,true);return null;}});
 select('dungeon-round-preset').onchange=()=>{if(select('dungeon-round-preset').value!=='custom')el<HTMLInputElement>('dungeon-round-seconds').value=select('dungeon-round-preset').value;playback.stop();invalidatePreview();renderPlayback();};
 el('dungeon-round-seconds').oninput=()=>{select('dungeon-round-preset').value='custom';playback.stop();invalidatePreview();renderPlayback();};
 for(const id of ['dungeon-speed','dungeon-factor','dungeon-duration'])el(id).oninput=()=>{playback.stop();invalidatePreview();};
 select('dungeon-room').onchange=()=>{playback.stop();invalidatePreview();chosen();draw();};
 el('dungeon-map').onclick=event=>{
  playback.stop();if(!data||!target)return;
  const matrix=el<SVGSVGElement&HTMLElement>('dungeon-map').getScreenCTM();if(!matrix)return;
  const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
  const r=data.rooms.find(r=>r.floorId===target!.floorId&&r.scopeId===target!.scopeId&&inside(point,r.polygons));if(!r)return;
  target={x:point.x,y:point.y,scopeId:r.scopeId,floorId:r.floorId,roomId:r.id,z:data.floors.find(f=>f.id===r.floorId&&f.scopeId===r.scopeId)!.elevation+number('dungeon-height-step')*1.524,movement:select('dungeon-movement').value as DungeonMovement};
  select('dungeon-room').value=r.id;invalidatePreview();draw();
 };
 el('dungeon-refresh').onclick=()=>run(async()=>{await openDungeon();return true;});
 bind('dungeon-place',()=>data?.sceneId&&target?{kind:'place',sceneId:data.sceneId,expectedPositionRevision:data.positionRevision,pose:target}:null);
 bind('dungeon-leave',()=>data?.sceneId?{kind:'place',sceneId:data.sceneId,expectedPositionRevision:data.positionRevision,pose:null}:null);
 el('dungeon-plan').onclick=()=>{
  if(!workspace||!data?.sceneId||!target)return;
  if(dungeonPaceDirty()){status('Tempovorgaben zuerst übernehmen oder offene Einstellungen verwerfen.',true);return;}
  const w=workspace,intent=routeIntent,request=structuredClone({sceneId:data.sceneId,...(data.travelPace?{useGroupPace:true}:{}),destination:target,movement:select('dungeon-movement').value as DungeonMovement,speedMetersPerMinute:number('dungeon-speed'),factor:number('dungeon-factor'),finalSeconds:el<HTMLInputElement>('dungeon-duration').value?number('dungeon-duration'):null});
  run(async o=>{
   const result=await window.campaign.previewDungeon(w.token,request);
   if(!current(o))return false;
   if(intent!==routeIntent){status('Ziel oder Reisedaten geändert. Vorschau neu berechnen.');return false;}
   if(!result.ok)throw new Error(result.error);
   preview=result.value;draw();return true;
  });
 };
 bind('dungeon-confirm',()=>preview?{kind:'journey',preview}:null);
 el('dungeon-step').onclick=()=>void explicitTravel(j=>({kind:'step',sceneId:j.request.sceneId,id:j.id,expectedRevision:j.revision,maxSteps:1}));
 el('dungeon-round-step').onclick=()=>void explicitTravel(j=>({kind:'round',sceneId:j.request.sceneId,id:j.id,expectedRevision:j.revision,expectedSettingsRevision:data!.travelPace!.settings.revision}));
 el('dungeon-play').onclick=()=>{if(playback.running)playback.stop();else playback.play();};
 select('dungeon-play-speed').onchange=()=>playback.setSpeed(Number(select('dungeon-play-speed').value) as JourneySpeed);
 el('dungeon-pause').onclick=()=>void explicitTravel(j=>({kind:'state',sceneId:j.request.sceneId,id:j.id,expectedRevision:j.revision,status:j.status==='paused'?'active':'paused'}));
 el('dungeon-end').onclick=()=>void explicitTravel(j=>({kind:'state',sceneId:j.request.sceneId,id:j.id,expectedRevision:j.revision,status:'ended'}));
 bind('dungeon-authorize',()=>{const j=data?.journey,event=data?.triggerEvents?.find(e=>e.id===j?.triggerEventId);return event?{kind:'trigger-event',sceneId:event.sceneId,eventId:event.id,expectedRevision:event.revision,operation:'dismiss'}:withJourney(j=>({kind:'state',sceneId:j.request.sceneId,id:j.id,expectedRevision:j.revision,status:'active',authorizeFeatureId:j.featureId??undefined}));});
 el('dungeon-trigger').onclick=()=>{
  const j=data?.journey,w=workspace;if(!j?.featureId||!w)return;const event=data?.triggerEvents?.find(e=>e.id===j.triggerEventId);if(event){perform({kind:'trigger-event',sceneId:event.sceneId,eventId:event.id,expectedRevision:event.revision,operation:'activate'});return;}
  const featureId=j.featureId,sceneId=j.request.sceneId,revision=data!.drawing.features.find(f=>f.id===featureId)?.revision??0;
  run(async o=>{
   ++readRequest;invalidatePreview();
   const result=await window.campaign.activateFeature(w.token,featureId,sceneId,revision,'activate',null,crypto.randomUUID());
   if(!current(o))return false;
   if(!result.ok)throw new Error(result.error);
   await openDungeon();if(!current(o))return false;
   status('Falle ausgelöst. Wirkung als GM klären; danach Passage freigeben.');return true;
  });
 };
 bind('dungeon-reveal',()=>data?.sceneId&&target?{kind:'reveal',sceneId:data.sceneId,roomId:target.roomId,known:true}:null);
 bind('dungeon-npc-place',()=>{const npc=data?.npcs.find(n=>n.id===select('dungeon-npc').value);return npc&&target?{kind:'npc-place',actorId:npc.id,expectedRevision:npc.revision,pose:target}:null;});
 el('dungeon-edit').onclick=()=>el('atlas-tab').click();
}
export function activateDungeon(w:Workspace){
 playback.stop();generation++;readRequest++;routeIntent++;job=null;workspace=w;data=null;target=null;preview=null;traceStart=null;fieldBase.clear();trackDrafts.clear();confirmedFields=null;clearDungeonPace();
 el('dungeon-trace-start-label').textContent='';
}
export async function openDungeon(){
 playback.stop();if(!workspace)return;const w=workspace,o=owner(),request=++readRequest;
 const result=await window.campaign.dungeon(w.token);
 if(!current(o)||request!==readRequest)return;
 if(!result.ok)throw new Error(result.error);
 if(data?.sceneId!==result.value.sceneId){
  if(dirtyFields()||trackDrafts.size){status('Offene Einstellungen zuerst anwenden oder verwerfen, bevor die neue Gruppe angezeigt wird.',true);return;}
  target=null;traceStart=null;fieldBase.clear();el('dungeon-trace-start-label').textContent='';
 }
 data=result.value;invalidatePreview();draw();
}
export async function flushDungeon(){
 playback.stop();await playback.settled();const o=owner(),pending=job;if(pending&&!await pending)return false;
 if(!current(o))return false;
 if(dirtyFields()||trackDrafts.size){status('Offene Dungeon-Einstellungen zuerst anwenden oder verwerfen.',true);return false;}
 return true;
}

export async function selectDungeonRoom(id:string){await openDungeon();if(!data?.rooms.some(r=>r.id===id))throw new Error('Raum ist kein aktuelles Reiseziel.');select('dungeon-room').value=id;invalidatePreview();chosen();}

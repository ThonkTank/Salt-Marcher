import {EditorSession} from './editor-session';
import {dungeonTravelReadState,renderDungeonTravelContext} from './dungeon-travel-console';
import {canonicalJson} from './generation/canonical-json';
import {journeyPlayback,type PlaybackFrame,type JourneySpeed} from './journey-playback';
import {renderDungeonPace,dungeonPaceDirty,dungeonPaceDraft,acceptDungeonPace,clearDungeonPace} from './dungeon-pace-ui';
import {drawDungeonContents} from './dungeon-content-live-ui';
import type {DungeonMovement} from './volume-contracts';
import type {WorkspaceGeometry} from './contracts';
import type {DungeonView,DungeonPose,DungeonPreview,DungeonAction,DungeonSenseAction,DungeonTraceRules,DungeonCommand} from './dungeon-contracts';
import {centerInRoom} from './dungeon-model';
import {trackAt} from './track-model';
export const editorSession = new EditorSession();
const jobWork = editorSession.operation<Promise<boolean>>();

const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const select=(id:string)=>el<HTMLSelectElement>(id),number=(id:string)=>Number(el<HTMLInputElement>(id).value);
let traceStart:DungeonPose|null=null;
let workspace:WorkspaceGeometry|null=null,data:DungeonView|null=null,target:DungeonPose|null=null,preview:DungeonPreview|null=null;
let contextReady=true,liveContext:string|null=null;
let readRequest=0, routeIntent=0;
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
function owner(){return{generation:editorSession.generation,token:workspace?.token,sceneId:data?.sceneId};}
type Owner=ReturnType<typeof owner>;
interface Attempt {command:DungeonCommand;fields:Map<string,FieldValue>;track:TrackFields|null;after?:((o:Owner)=>void);outcome?:'applied'|'not-applied'}
let uncertain:Attempt|null=null;
function recoveryNotice(text='Ausgang des Dungeonauftrags unbekannt. Speicherstand klären; weitere Änderungen sind gesperrt.'){
 el('dungeon-reconcile').hidden=!uncertain;dungeonTravelReadState(contextReady&&!uncertain,text);
}

function current(o:Owner){return editorSession.generation===o.generation&&workspace?.token===o.token&&data?.sceneId===o.sceneId;}
function run(fn:(o:Owner)=>Promise<boolean>,recovery=false){
 if(jobWork.value||!recovery&&(!contextReady||uncertain))return Promise.resolve(false);const o=owner();
 const task=Promise.resolve().then(()=>current(o)?fn(o):false).catch(e=>{if(current(o))status(e.message,true);return false;});
 jobWork.value=task;return task;
}
function invalidatePreview(){routeIntent++;preview=null;el('dungeon-preview').textContent='';el<HTMLButtonElement>('dungeon-confirm').disabled=true;}
function acceptReply(attempt:Attempt,value:DungeonView,o:Owner,recovered=false){
 const captured=attempt.command.action;
 if(value.sceneId!==o.sceneId){contextReady=false;playback.stop();dungeonTravelReadState(false,'Fokusgruppe geändert. Offene Eingaben behalten und anschließend aktualisieren.');status('Aktion für die ursprüngliche Gruppe gespeichert. Der Fokus hat gewechselt; offene Eingaben behalten und anschließend aktualisieren.',true);return false;}
 if(captured.kind==='pace-settings'&&value.travelPace&&(!recovered||value.travelPace.settings.revision===captured.settings.revision+1&&canonicalJson({...value.travelPace.settings,revision:captured.settings.revision})===canonicalJson(captured.settings)))acceptDungeonPace(captured.settings,value.travelPace);
 data=value;confirmedFields=attempt.fields;
 if(captured.kind==='track-correct'&&attempt.track){
  const draft=trackDrafts.get(captured.id),track=data.tracks.find(t=>t.id===captured.id);
  if(draft&&track){const base={publicText:track.publicText,dc:String(track.dc),hidden:track.hidden??false};if(sameTrack(draft.values,attempt.track)||sameTrack(draft.values,base))trackDrafts.delete(captured.id);else draft.base=base;}
 }
 try{draw();}finally{confirmedFields=null;}
 if(current(o))attempt.after?.(o);
 return true;
}
function perform(a:DungeonAction,after?:(o:Owner)=>void){
 const captured=structuredClone(a),fields=a.kind==='trace-rules'?traceFields:a.kind==='senses'?senseFields:[];
 const submitted=new Map(fields.map(id=>[id,fieldValue(id)])),track=a.kind==='track-correct'?{...(trackDrafts.get(a.id)?.values??{publicText:a.publicText,dc:String(a.dc),hidden:a.hidden})}:null;
 return run(async o=>{
  const w=workspace;if(!w)return false;
  ++readRequest;invalidatePreview();
  const attempt:Attempt={command:{commandId:crypto.randomUUID(),token:w.token,campaignId:w.campaign.id,action:captured},fields:submitted,track,after};
  let result;
  try{result=await window.campaign.executeDungeon(attempt.command);}
  catch(error){
   if(current(o)){uncertain=attempt;contextReady=false;playback.stop();recoveryNotice();status('Ausgang des Dungeonauftrags unbekannt. Speicherstand klären. '+(error as Error).message,true);}
   return false;
  }
  if(!current(o))return false;
  if(!result.ok)throw new Error(result.error);
  return acceptReply(attempt,result.value,o);
 });
}
async function reconcileDungeon(){
 const attempt=uncertain;if(!attempt)return;
 await run(async o=>{
  if(!attempt.outcome){
   const result=await window.campaign.dungeonCommandState(attempt.command);
   if(!current(o)||uncertain!==attempt)return false;
   if(!result.ok)throw new Error(result.error);
   if(!['applied','not-applied','conflict'].includes(result.value.outcome))throw new Error('Unbekannte Antwort auf den Dungeonauftrag. Ursprünglichen Auftrag erhalten.');
   if(result.value.outcome==='conflict')throw new Error('Dungeonauftragskennung gehört zu anderem Inhalt. Ursprünglichen Auftrag erhalten.');
   attempt.outcome=result.value.outcome;
  }
  const result=await window.campaign.dungeon(attempt.command.token);
  if(!current(o)||uncertain!==attempt)return false;
  if(!result.ok)throw new Error((attempt.outcome==='applied'?'Speicherung bestätigt. ':'Nicht gespeichert. ')+'Dungeonansicht erneut laden: '+result.error);
  if(result.value.sceneId!==o.sceneId){
   uncertain=null;el('dungeon-reconcile').hidden=true;
   await openDungeon(liveContext??undefined);
   status(attempt.outcome==='applied'?'Auftrag der ursprünglichen Gruppe gespeichert. Neuen Gruppenkontext prüfen; offene Eingaben bleiben erhalten.':'Ursprünglicher Auftrag nicht gespeichert. Neuen Gruppenkontext prüfen; offene Eingaben bleiben erhalten.');return true;
  }
  uncertain=null;contextReady=true;recoveryNotice('');
  if(attempt.outcome==='applied')acceptReply(attempt,result.value,o,true);else{data=result.value;draw();}
  status(attempt.outcome==='applied'?'Dungeonauftrag gespeichert. Bestätigter Stand geladen; Wiedergabe bleibt angehalten.':'Dungeonauftrag wurde nicht gespeichert. Eingaben bleiben erhalten; bei Bedarf erneut ausdrücklich ausführen.');return true;
 },true);
}

function playbackFrame():PlaybackFrame|null{const j=data?.journey;if(uncertain||!contextReady||!workspace||!data?.travelPace||!j||j.status!=='active'||document.hidden||dungeonPaceDirty())return null;return{key:workspace.token+':'+data.sceneId+':'+j.id,revision:j.revision,nextIndex:j.revision,seconds:3600};}
const playback=journeyPlayback({read:playbackFrame,step:async basis=>{const frame=playbackFrame(),j=data?.journey;if(!frame||!j||frame.key!==basis.key||frame.revision!==basis.revision)return false;return await perform({kind:'round',sceneId:j.request.sceneId,id:j.id,expectedRevision:j.revision,expectedSettingsRevision:data!.travelPace!.settings.revision});},changed:renderPlayback});
function renderPlayback(){if(!document.getElementById('dungeon-play'))return;const j=data?.journey,round=data?.travelPace?.settings.explorationRoundSeconds??600,elapsed=j?.segmentElapsedSeconds??0;el('dungeon-round-status').textContent='Erkundungsrunde '+round+' s · '+(playback.running?'Wiedergabe '+playback.speed+'× läuft':j?.status==='active'?'Wiedergabe pausiert':'Wiedergabe angehalten')+(elapsed?' · Unterwegs zum nächsten Rasterpunkt: '+elapsed+' / '+j!.segmentSeconds[j!.nextIndex]+' s':'');el('dungeon-play').textContent=playback.running?'Wiedergabe anhalten':'Wiedergabe starten';el<HTMLButtonElement>('dungeon-play').disabled=!(j?.status==='active')||dungeonPaceDirty();el<HTMLButtonElement>('dungeon-round-step').disabled=!(j?.status==='active')||dungeonPaceDirty()||playback.busy;}
async function explicitTravel(action:(j:NonNullable<DungeonView['journey']>)=>DungeonAction){const o=owner();playback.stop();await playback.settled();if(!current(o)||!data?.journey)return;await perform(action(data.journey));}
function chosen(){if(!data)return;const room=data.rooms.find(r=>r.id===select('dungeon-room').value);if(!room)return;const at=centerInRoom(room),v=data.drawing.volumes?.find(v=>v.roomId===room.id),column=v?.columns.find(c=>c.x===Math.floor(at.x/1.524)&&c.y===Math.floor(at.y/1.524)),span=column?.spans.find(s=>s.floor)??column?.spans[0];if(span)el<HTMLInputElement>('dungeon-height-step').value=String(span.z);target={...at,scopeId:room.scopeId,floorId:room.floorId,roomId:room.id,z:data.floors.find(f=>f.id===room.floorId&&f.scopeId===room.scopeId)!.elevation+number('dungeon-height-step')*1.524,movement:select('dungeon-movement').value as DungeonMovement};preview=null;drawTarget();}
function draw(){if(!data)return;renderDungeonTravelContext(data);document.dispatchEvent(new Event('atlas-runtime'));playback.sync();renderPlayback();renderDungeonPace(data.travelPace,()=>{playback.stop();invalidatePreview();});if(target)target={...target,movement:select('dungeon-movement').value as DungeonMovement};el('dungeon-context').textContent=data.sceneId?data.sceneTitle+' · bestätigte Zeit '+Math.floor(Number(BigInt(data.instantMs)/1000n)/60)+' min · '+(data.position?'Gruppe im Dungeon · Höhe '+data.position.z.toFixed(2)+' m · '+(data.position.movement??'walk'):'Gruppe noch nicht im Dungeon'):'Unter Party und Leiten eine Gruppe fokussieren.';const roomSelect=select('dungeon-room'),old=target?.roomId??data.position?.roomId??roomSelect.value;roomSelect.replaceChildren();for(const r of data.rooms){const o=document.createElement('option');o.value=r.id;o.textContent=r.number+'. '+r.name+' · '+(data.floors.find(f=>f.id===r.floorId&&f.scopeId===r.scopeId)?.name??'Geschoss');roomSelect.append(o);}roomSelect.value=old&&data.rooms.some(r=>r.id===old)?old:data.rooms[0]?.id??'';if(!target||!data.rooms.some(r=>r.id===target!.roomId))chosen();const npc=select('dungeon-npc'),selected=npc.value;npc.replaceChildren();for(const n of data.npcs){const o=document.createElement('option');o.value=n.id;o.textContent=n.name+(n.pose?' · Raum '+(data.rooms.find(r=>r.id===n.pose!.roomId)?.number??'?'):'');npc.append(o);}npc.value=selected||data.npcs[0]?.id||'';const j=data.journey;el('dungeon-route-status').textContent=j?({active:'Unterwegs',paused:'Pausiert',decision:'GM-Entscheidung erforderlich',arrived:'Angekommen',ended:'Beendet'}[j.status])+' · '+(j.reason?j.reason+' · ':'')+'Route '+j.status+' · '+j.nextIndex+'/'+j.route.length+' Wegpunkte · '+j.distanceMeters.toFixed(1)+' m · '+j.durationSeconds+' s · bestätigt mit '+j.request.speedMetersPerMinute.toLocaleString('de-DE')+' m/min':'Ziel im Grundriss anklicken und Weg vorbereiten.';el<HTMLButtonElement>('dungeon-step').disabled=!j||j.status!=='active';el<HTMLButtonElement>('dungeon-pause').disabled=!j||!['active','paused'].includes(j.status);el('dungeon-pause').textContent=j?.status==='paused'?'Fortsetzen':'Pause';el<HTMLButtonElement>('dungeon-authorize').disabled=j?.status!=='decision';el<HTMLButtonElement>('dungeon-trigger').disabled=j?.status!=='decision'||!!data.triggerEvents?.find(e=>e.id===j.triggerEventId)?.activated;el<HTMLButtonElement>('dungeon-end').disabled=!j||['arrived','ended'].includes(j.status);const activity=el('dungeon-activity');activity.replaceChildren();for(const n of data.npcs.filter(n=>n.pose)){const p=document.createElement('p');p.textContent=n.name+' · Raum '+(data.rooms.find(r=>r.id===n.pose!.roomId)?.number??'?')+(n.destination?' → '+(data.rooms.find(r=>r.id===n.destination!.roomId)?.number??'?'):'')+(n.paused?' · Pause':'')+(n.pending?' · '+n.pending:'');activity.append(p);}el('dungeon-preview').textContent=preview?'Vorschau: '+preview.distanceMeters.toFixed(1)+' m · '+preview.durationSeconds+' s · '+preview.route.length+' Wegpunkte'+(preview.pace?' · '+preview.request.speedMetersPerMinute.toLocaleString('de-DE')+' m/min · '+preview.pace.reason:''):'';el<HTMLButtonElement>('dungeon-confirm').disabled=!preview;drawTarget();drawSenses();}
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
   const state=data.drawing.passageStatuses?.find(s=>s.id===p.id)?.[key],b=document.createElement('button');
   b.textContent=title+' über Passage · '+(side.description||side.target.kind)+' · '+(state??'Ziel noch nicht geprüft');
   b.disabled=!p.assigned||!side.passable||!['verlinkt','Ortslink'].includes(state??'');
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
function drawTarget(){if(data&&target)el('dungeon-target').textContent='Ziel '+target.x.toFixed(2)+', '+target.y.toFixed(2)+' m · Höhe '+target.z.toFixed(2)+' m';}
export function initDungeon(notify:typeof status,combatNavigation:(id:string)=>void=()=>{}){navigateCombat=combatNavigation;
 status=notify;el('dungeon-reconcile').onclick=()=>void reconcileDungeon();
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
  if(jobWork.value||uncertain){status('Laufende Aktion abwarten oder Speicherstand klären.',true);return;}
  fieldBase.clear();trackDrafts.clear();clearDungeonPace();if(!contextReady){void openDungeon(liveContext??undefined).catch(e=>status(e.message,true));return;}renderDungeonPace(data?.travelPace,invalidatePreview,true);draw();
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
 el('dungeon-refresh').onclick=()=>{if(!jobWork.value)void openDungeon(liveContext??undefined).catch(e=>status(e.message,true));};
 bind('dungeon-place',()=>data?.sceneId&&target?{kind:'place',sceneId:data.sceneId,expectedPositionRevision:data.positionRevision,pose:target}:null);
 bind('dungeon-leave',()=>data?.sceneId?{kind:'place',sceneId:data.sceneId,expectedPositionRevision:data.positionRevision,pose:null}:null);
 el('dungeon-plan').onclick=()=>{
  if(!workspace||!data?.sceneId||!target)return;
  if(dungeonPaceDirty()){status('Tempovorgaben zuerst übernehmen oder offene Einstellungen verwerfen.',true);return;}
  invalidatePreview();document.dispatchEvent(new Event('atlas-runtime'));
  const w=workspace,intent=routeIntent,request=structuredClone({sceneId:data.sceneId,...(data.travelPace?{useGroupPace:true}:{}),destination:target,movement:select('dungeon-movement').value as DungeonMovement,speedMetersPerMinute:number('dungeon-speed'),factor:number('dungeon-factor'),finalSeconds:el<HTMLInputElement>('dungeon-duration').value?number('dungeon-duration'):null});
  run(async o=>{
   const result=await window.campaign.previewDungeon(w.token,request);
   if(!current(o))return false;
   if(intent!==routeIntent){status('Ziel oder Reisedaten geändert. Vorschau neu berechnen.');return false;}
   if(!result.ok)throw new Error(result.error);
   // Group speed is resolved by the provider; all other intent must match.
   const echoed=request.useGroupPace?{...result.value.request,speedMetersPerMinute:request.speedMetersPerMinute}:result.value.request;
   if(canonicalJson(echoed)!==canonicalJson(request))throw new Error('Auswertung gehört nicht zur angefragten Dungeonreise. Weg erneut vorbereiten.');
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
export function activateDungeon(w:WorkspaceGeometry){
 playback.stop();uncertain=null;el('dungeon-reconcile').hidden=true;contextReady=false;liveContext=null;dungeonTravelReadState(false,'Dungeonkontext noch nicht geladen.');editorSession.generation++;readRequest++;routeIntent++;jobWork.value=null;workspace=w;data=null;target=null;preview=null;traceStart=null;fieldBase.clear();trackDrafts.clear();confirmedFields=null;clearDungeonPace();
 el('dungeon-trace-start-label').textContent='';
}
export async function openDungeon(expectedSceneId?:string){
 if(uncertain){recoveryNotice();return;}
 playback.stop();if(!workspace)return;contextReady=false;dungeonTravelReadState(false,'Dungeonkontext wird geladen …');invalidatePreview();const w=workspace,o=owner(),request=++readRequest;
 const result=await window.campaign.dungeon(w.token);
 if(!current(o)||request!==readRequest)return;
 if(!result.ok){dungeonTravelReadState(false,'Dungeonkontext nicht verfügbar: '+result.error);throw new Error(result.error);}
 if(expectedSceneId&&result.value.sceneId!==expectedSceneId){const message='Dungeonantwort gehört nicht zur Fokusgruppe. Kontext erneut laden.';dungeonTravelReadState(false,message);throw new Error(message);}
 if(data?.sceneId!==result.value.sceneId){
  if(dirtyFields()||trackDrafts.size){const message='Fokusgruppe geändert. Offene Dungeon-Einstellungen verwerfen, dann den neuen Kontext laden.';dungeonTravelReadState(false,message);status(message,true);return;}
  target=null;traceStart=null;fieldBase.clear();el('dungeon-trace-start-label').textContent='';
 }
 data=result.value;contextReady=true;liveContext=data.sceneId;dungeonTravelReadState(true);invalidatePreview();draw();
}
export async function flushDungeon(){
 if(uncertain){status('Ausgang des Dungeonauftrags zuerst mit Speicherstand klären prüfen.',true);return false;}
 playback.stop();await playback.settled();const o=owner(),pending=jobWork.value;if(pending&&!await pending)return false;
 if(!current(o)||uncertain)return false;
 if(dirtyFields()||trackDrafts.size){status('Offene Dungeon-Einstellungen zuerst anwenden oder verwerfen.',true);return false;}
 return true;
}

export async function selectDungeonRoom(id:string){await openDungeon();if(!data?.rooms.some(r=>r.id===id))throw new Error('Raum ist kein aktuelles Reiseziel.');select('dungeon-room').value=id;invalidatePreview();chosen();}

export async function atlasDungeonTarget(roomId:string,point:{x:number;y:number}){await selectDungeonRoom(roomId);if(!target)return;target={...target,x:point.x,y:point.y};invalidatePreview();draw();}
export function atlasDungeonState(){return{data,target,preview};}

export function stopDungeonPlayback(){playback.stop();}
export function syncDungeonLiveContext(token:string,sceneId:string){
 const console=document.getElementById('dungeon-travel-console');
 if(workspace?.token!==token||!console||liveContext===sceneId)return;
 for(let node=console.parentElement;node;node=node.parentElement)if(node.hidden)return;
 liveContext=sceneId;playback.stop();contextReady=false;readRequest++;invalidatePreview();dungeonTravelReadState(false,'Fokusgruppe geändert. Dungeonkontext wird geladen …');
 void openDungeon(sceneId).catch(e=>{if(workspace?.token===token&&liveContext===sceneId){dungeonTravelReadState(false,'Dungeonkontext nicht verfügbar: '+e.message);status(e.message,true);}});
}

import type {Workspace,Result} from './contracts';
import type {Preparation} from './preparation-contracts';
import type {LiveView} from './live-contracts';
import type {WorldView,SceneWorld,AtlasMap,AtlasCell,Hex,WorldAction,WorldCommand,WorldAck,TravelPreview,CalendarEvent,WeatherPhenomenon,Weather,Climate,Terrain} from './world-contracts';
import {hexKey,hexPoint,pointHex,hexDistance,cellAt,terrainNames,terrainColors,climateNames,weatherEffects,calendarDate} from './world-model';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T,value=(id:string)=>el<HTMLInputElement>(id).value;
const unwrap=<T>(r:Result<T>):T=>{if(!r.ok)throw new Error(r.error);return r.value;};
const svg=(tag:string)=>document.createElementNS('http://www.w3.org/2000/svg',tag);
let workspace:Workspace|null=null,world:WorldView|null=null,sources:Preparation|null=null,live:LiveView|null=null,frame:SceneWorld|null=null,mapDraft:AtlasMap|null=null,selected:Hex={q:0,r:0},center:Hex={q:0,r:0},level=0;
let dirtyMap=false,dirtyCell=false,dirtyCalendar=false,dirtyEvent=false,dirtyPhenomenon=false,pending:Promise<boolean>|null=null,preview:TravelPreview|null=null,eventDraft:CalendarEvent|null=null,phenomenonDraft:WeatherPhenomenon|null=null;
let tell:(text:string,error?:boolean)=>void,before:()=>Promise<boolean>,after:()=>Promise<void>,enter:()=>Promise<void>;
let liveWorld:SceneWorld|null=null,liveRequest=0,travelRequest=0,sceneRequest=0;
type WeatherOwner={token:string;campaignId:string;sceneId:string;generation:number;clockRevision:number;overrideRevision:number|null};
let weatherContext:{token:string;sceneId:string}|null=null,weatherGeneration=0,weatherBasis:WeatherOwner|null=null,weatherEdits=0,weatherBusy=false,weatherDirty=false;
function weatherOwner():WeatherOwner|null{
 if(!workspace||!liveWorld)return null;const revision=liveWorld.weatherOverrideRevision;
 if(revision!==null&&(!Number.isSafeInteger(revision)||revision<1))throw new Error('Wetterstand fehlt. Gruppe erneut öffnen.');
 return{token:workspace.token,campaignId:workspace.campaign.id,sceneId:liveWorld.scene.id,generation:weatherGeneration,clockRevision:liveWorld.scene.clock.revision,overrideRevision:revision};
}
function weatherCurrent(o:WeatherOwner){return workspace?.token===o.token&&workspace.campaign.id===o.campaignId&&weatherGeneration===o.generation&&weatherContext?.token===o.token&&weatherContext.sceneId===o.sceneId;}
function canAdoptWeatherFrame(previous:SceneWorld|null,next:SceneWorld){return !previous||previous.scene.id!==next.scene.id||previous.scene.clock.revision<=next.scene.clock.revision&&previous.scene.revision<=next.scene.revision&&previous.position.revision<=next.position.revision&&(previous.weatherOverrideRevision??0)<=(next.weatherOverrideRevision??0);}
function populateWeatherInput(w:Weather|null){for(const [id,value]of Object.entries({'weather-override-kind':w?.kind??'clear','weather-override-intensity':String((w?.intensity??0)*100),'weather-override-temperature':String(w?.effects.temperatureC??15),'weather-override-factor':String(w?.effects.travelFactor??1),'weather-override-notes':w?.effects.combatNote??''}))el<HTMLInputElement>(id).value=value;}
function finishWeatherWork(){weatherBusy=false;if(!weatherDirty&&liveWorld)populateWeatherInput(liveWorld.weather);lockWeather();}
function lockWeather(){const form=document.getElementById('weather-override-form');if(!form)return;for(const b of form.querySelectorAll<HTMLButtonElement>('button'))b.disabled=weatherBusy;el<HTMLButtonElement>('weather-release').disabled=weatherBusy||liveWorld?.weather?.source!=='GM-Override';}
type WeatherIntent={owner:WeatherOwner;version:number;preserveDraft?:boolean};
function acceptOwnWeather(intent:WeatherIntent,next:SceneWorld|null|undefined){
 const {owner:o,version}=intent;if(!next||next.scene.id!==o.sceneId||next.weatherOverrideRevision!==(o.overrideRevision??0)+1)throw new Error('Bestätigter Wetterstand gehört nicht zur eigenen Änderung.');
 if(!weatherCurrent(o))return;
 if(canAdoptWeatherFrame(liveWorld,next)){liveWorld=next;paintLiveWeather(next,o.token,o.sceneId);}if(frame?.scene.id===o.sceneId&&canAdoptWeatherFrame(frame,next)){frame=next;renderMap();renderJourney();}
 weatherDirty=!!intent.preserveDraft||weatherEdits!==version;weatherBasis=weatherDirty?{...o,clockRevision:next.scene.clock.revision,overrideRevision:next.weatherOverrideRevision}:null;
 if(!weatherBusy&&!weatherDirty)populateWeatherInput(next.weather);
}
async function submitWeather(weather:Weather|null){
 if(weatherBusy)return;if(weatherDirty&&!weatherBasis)throw new Error('Wetterstand zur Eingabe fehlt. Eingabe vor neuem Stand ausdrücklich verwerfen.');const o=weatherBasis??weatherOwner();if(!o)return;
 if(!weatherCurrent(o)){tell('Gruppenauswahl geändert. Wettereingabe bleibt erhalten; vor neuer Eingabe ausdrücklich verwerfen.',true);return;}
 const version=weatherEdits,intent:WeatherIntent={owner:o,version,preserveDraft:weather===null&&weatherDirty};weatherBusy=true;lockWeather();
 try{
  if(!await flushWorld())return;if(!weatherCurrent(o))return;
  const ack=await raw({kind:'weather-override',sceneId:o.sceneId,expectedClockRevision:o.clockRevision,expectedOverrideRevision:o.overrideRevision,weather},()=>weatherCurrent(o),intent);
  if(!weatherCurrent(o))return;
  acceptOwnWeather(intent,ack.scene);
  await after();if(weatherCurrent(o))tell('Wetter für diese Gruppe gespeichert.');
 }catch(error){if(weatherCurrent(o))tell((error as Error).message,true);}finally{finishWeatherWork();}
}
async function discardWeatherInput(){
 if(weatherBusy)return;const o=weatherOwner();if(!o)return;const version=weatherEdits;weatherBusy=true;lockWeather();
 try{
  const next=unwrap(await window.campaign.sceneWorld(o.token,o.sceneId));if(!weatherCurrent(o)||weatherEdits!==version)return;
  if(next.scene.id!==o.sceneId)throw new Error('Wetterantwort gehört zu einer anderen Gruppe.');
  if(!canAdoptWeatherFrame(liveWorld,next))throw new Error('Wetter inzwischen geändert. Eingabe bleibt erhalten.');
  liveWorld=next;paintLiveWeather(next,o.token,o.sceneId);const w=next.weather;
  populateWeatherInput(w);
  weatherBasis=null;weatherDirty=false;weatherEdits++;tell('Wettereingabe verworfen. Aktueller Gruppenstand geladen.');
 }catch(error){if(weatherCurrent(o))tell((error as Error).message,true);}finally{finishWeatherWork();}
}

function option(s:HTMLSelectElement,id:string,name:string){const o=document.createElement('option');o.value=id;o.textContent=name;s.append(o);}
function button(label:string,action:()=>Promise<unknown>|void){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>run(action);return b;}
function run(fn:()=>Promise<unknown>|void){void Promise.resolve().then(fn).catch(error=>tell(error.message,true));}
function number(id:string){const v=Number(value(id));if(!Number.isFinite(v))throw new Error('Zahl prüfen: '+id);return v;}
function daysMs(days:number){if(!world||!Number.isFinite(days)||days<0||days>100000000)throw new Error('Zeit benötigt 0 bis 100.000.000 Tage.');return Math.round(days*world.calendar.daySeconds*1000).toString();}
const msDays=(ms:string)=>world?Number(BigInt(ms))/world.calendar.daySeconds/1000:0;
let uncertain: { command: WorldCommand; versions: typeof edits; weatherIntent?:WeatherIntent } | null = null;
let checkingWorldWrite: Promise<boolean> | null = null;
let worldWrites = new Set<Promise<void>>();
function showUncertainWorldWrite() { el('world-write-recovery').hidden = !uncertain; }
function adoptConfirmedWorldWrite(command: WorldCommand, ack: WorldAck, versions: typeof edits,weatherIntent?:WeatherIntent) {
  if(command.action.kind==='weather-override'){if(!weatherIntent)throw new Error('Wettereingabe zum Auftrag fehlt.');acceptOwnWeather(weatherIntent,ack.scene);return;}
  world = ack.world;
  if (ack.scene) frame = ack.scene;
  const a = command.action;
  if (a.kind === 'map' && mapDraft?.id === a.map.id) {
    mapDraft = structuredClone(ack.world.maps.find(m => m.id === a.map.id)!); dirtyMap = edits.map !== versions.map;
  } else if (a.kind === 'calendar') dirtyCalendar = edits.calendar !== versions.calendar;
  else if (a.kind === 'calendar-event' && eventDraft?.id === a.event.id) {
    eventDraft = structuredClone(ack.world.events.find(e => e.id === a.event.id)!); dirtyEvent = edits.event !== versions.event;
  } else if (a.kind === 'phenomenon' && phenomenonDraft?.id === a.phenomenon.id) {
    phenomenonDraft = structuredClone(ack.world.phenomena.find(p => p.id === a.phenomenon.id)!); dirtyPhenomenon = edits.phenomenon !== versions.phenomenon;
  }
}
export async function reconcileWorldWrite(): Promise<boolean> {
  if (checkingWorldWrite) return checkingWorldWrite;
  if (!uncertain || !workspace) return !uncertain;
  const captured = uncertain, token = workspace.token;
  const operation = Promise.resolve().then(async () => {
    try {
      const result = unwrap(await window.campaign.reconcileWorld(captured.command, token));
      if (workspace?.token !== token || uncertain !== captured) return false;
      if (result.outcome === 'applied') adoptConfirmedWorldWrite(captured.command, result.ack, captured.versions,captured.weatherIntent);
      uncertain = null; showUncertainWorldWrite();
      tell(result.outcome === 'applied' ? 'Weltänderung bestätigt. Spätere Eingaben bleiben offen.' : 'Weltänderung wurde nicht übernommen. Eingabe bleibt offen.');
      return true;
    } catch (error) {
      if (workspace?.token === token) tell((error as Error).message + ' Weltänderung bleibt unklar.', true);
      return false;
    } finally { if (checkingWorldWrite === operation) checkingWorldWrite = null; }
  });
  checkingWorldWrite = operation;
  return operation;
}
async function raw(action: WorldAction, stillCurrent:()=>boolean=()=>true,weatherIntent?:WeatherIntent) {
  if (!workspace) throw new Error('Öffne eine Kampagne.');
  if (uncertain) throw new Error('Unklare Weltänderung zuerst über Auftrag prüfen klären.');
  const owner = workspace, captured = structuredClone(action), versions = { ...edits };
  const command: WorldCommand = { commandId: crypto.randomUUID(), campaignId: owner.campaign.id, token: owner.token, action: captured };
  const queue = worldWrites;
  if (queue.size) throw new Error('Vorherige Weltänderung wird noch gespeichert.');
  let complete!: () => void;
  const completion = new Promise<void>(resolve => { complete = resolve; });
  queue.add(completion);
  try {
  tell('Welt wird gespeichert.');
  if (!(await before())) throw new Error('Offene Live-Eingabe zuerst abschließen.');
  if (workspace?.token !== owner.token) throw new Error('Kampagne wurde gewechselt.');
  if(!stillCurrent())throw new Error('Zielauswahl wurde gewechselt.');
  if (uncertain) throw new Error('Unklare Weltänderung zuerst über Auftrag prüfen klären.');
  let result: Result<WorldAck>;
  try { result = await window.campaign.executeWorld(command); }
  catch (error) {
    if (workspace?.token === owner.token) { uncertain = { command, versions,weatherIntent }; showUncertainWorldWrite(); }
    throw error;
  }
  const ack = unwrap(result);
  if (workspace?.token !== owner.token) throw new Error('Kampagne wurde gewechselt.');
  if(!stillCurrent())return ack;
  if(captured.kind!=='weather-override'){world = ack.world;if(ack.scene)frame=ack.scene;}
  if(captured.kind!=='weather-override')tell('Weltänderung bestätigt.');
  return ack;
  } finally { queue.delete(completion); complete(); }
}
async function action(a:WorldAction){if(!(await flushWorld()))return;await raw(a);await reloadScene();renderMap();renderJourney();await after();tell('Welt und Reise gespeichert.');}
function collectCell(){if(!mapDraft)return;const c:AtlasCell={...selected,level,terrain:value('hex-terrain') as Terrain,elevationM:number('hex-elevation'),climate:value('hex-climate') as Climate||null,road:el<HTMLInputElement>('hex-road').checked,river:el<HTMLInputElement>('hex-river').checked,label:value('hex-label'),faction:value('hex-faction'),interrupt:value('hex-interrupt')};mapDraft.cells=mapDraft.cells.filter(h=>!(h.level===level&&hexKey(h)===hexKey(selected)));mapDraft.cells.push(c);dirtyMap=true;dirtyCell=false;}
// Input counters distinguish a confirmed snapshot from later edits in the same controls.
let edits = { map: 0, calendar: 0, event: 0, phenomenon: 0 };
export async function flushWorld(): Promise<boolean> {
  if (pending) return pending;
  if (uncertain) { tell('Weltänderung ist unklar. Auftrag prüfen erhält die offenen Eingaben.', true); return false; }
  const token = workspace?.token;
  // Only preceding actions are awaited; this flush must not wait on its own raw writes.
  const preceding = [...worldWrites];
  const operation = Promise.resolve().then(async () => {
    try {
      await Promise.all(preceding);
      if (uncertain) { if (workspace?.token === token) tell('Weltänderung ist unklar. Auftrag prüfen erhält die offenen Eingaben.', true); return false; }
      do {
        if (workspace?.token !== token) return false;
        if (dirtyCell) collectCell();
        if (dirtyMap && mapDraft) {
          const version = edits.map, id = mapDraft.id;
          mapDraft.name = value('world-map-name');
          mapDraft.hexMeters = number('world-hex-size') * 1000;
          mapDraft.climate = value('world-climate') as Climate;
          mapDraft.seed = value('world-seed');
          const ack = await raw({ kind: 'map', map: mapDraft, expectedRevision: mapDraft.revision });
          mapDraft = structuredClone(ack.world.maps.find(m => m.id === id)!);
          dirtyMap = edits.map !== version;
        }
        if (dirtyCalendar && world) {
          const version = edits.calendar;
          const months = value('calendar-months').split('\n').filter(s => s.trim()).map(s => {
            const i = s.lastIndexOf(':'); return { name: s.slice(0, i).trim(), days: Number(s.slice(i + 1)) };
          });
          const calendar = { ...world.calendar, name: value('calendar-name'), startYear: number('calendar-year'), daySeconds: Math.round(number('calendar-hours') * 3600), months, weekdays: value('calendar-weekdays').split(',').map(s => s.trim()) };
          await raw({ kind: 'calendar', calendar, expectedRevision: world.calendar.revision });
          dirtyCalendar = edits.calendar !== version;
        }
        if (dirtyEvent && eventDraft) {
          const version = edits.event;
          const event = { ...eventDraft, name: value('event-name'), startMs: daysMs(number('event-start')), durationMs: daysMs(number('event-duration')), repeatMs: value('event-repeat') ? daysMs(number('event-repeat')) : null, locationId: value('event-location') || null, notes: value('event-notes'), trashed: el<HTMLInputElement>('event-trashed').checked };
          const ack = await raw({ kind: 'calendar-event', event, expectedRevision: eventDraft.revision || null });
          eventDraft = structuredClone(ack.world.events.find(e => e.id === event.id)!);
          dirtyEvent = edits.event !== version;
        }
        if (dirtyPhenomenon && phenomenonDraft) {
          const version = edits.phenomenon;
          const p: WeatherPhenomenon = { ...phenomenonDraft, name: value('phen-name'), kind: value('phen-kind') as Weather['kind'], intensity: number('phen-intensity') / 100, center: { q: number('phen-q'), r: number('phen-r') }, radiusHexes: number('phen-radius'), movement: { q: number('phen-move-q'), r: number('phen-move-r') }, startMs: daysMs(number('phen-start')), durationMs: daysMs(number('phen-duration')), state: value('phen-state') as WeatherPhenomenon['state'], temperatureC: value('phen-temperature') ? number('phen-temperature') : null, travelFactor: value('phen-travel') ? number('phen-travel') : null, notes: value('phen-notes') };
          const now = frame?.scene.clock.instantMs ?? '0';
          if (p.state === 'paused' && phenomenonDraft.state !== 'paused') p.pausedAtMs = now;
          if (p.state === 'active' && phenomenonDraft.state === 'paused') {
            p.startMs = (BigInt(p.startMs) + BigInt(now) - BigInt(phenomenonDraft.pausedAtMs ?? now)).toString(); p.pausedAtMs = null;
          }
          const ack = await raw({ kind: 'phenomenon', phenomenon: p, expectedRevision: phenomenonDraft.revision || null });
          phenomenonDraft = structuredClone(ack.world.phenomena.find(e => e.id === p.id)!);
          dirtyPhenomenon = edits.phenomenon !== version;
        }
        if (workspace?.token !== token) return false;
      } while (dirtyMap || dirtyCell || dirtyCalendar || dirtyEvent || dirtyPhenomenon);
      return true;
    } catch (error) {
      if (workspace?.token === token) tell((error as Error).message + ' Eingaben bleiben offen.', true);
      return false;
    } finally {
      if (pending === operation) pending = null;
    }
  });
  pending = operation;
  return operation;
}
type TravelOwner={token:string;sceneId:string;mapId:string};
function travelOwner():TravelOwner|null{return workspace?{token:workspace.token,sceneId:value('world-scene'),mapId:value('world-map-select')}:null;}
function ownsTravel(owner:TravelOwner){return workspace?.token===owner.token&&value('world-scene')===owner.sceneId&&value('world-map-select')===owner.mapId;}
function clearTravelPreview(){
 travelRequest++;preview=null;el('travel-preview-summary').textContent='';el('travel-preview-warnings').replaceChildren();el<HTMLButtonElement>('travel-preview-accept').disabled=true;
 const dialog=el<HTMLDialogElement>('travel-preview-dialog');if(dialog.open)dialog.close();
}
async function makeTravelPreview(){
 const owner=travelOwner();if(!owner)return;clearTravelPreview();const request=travelRequest;
 try{
  if(!await flushWorld()||!ownsTravel(owner)||request!==travelRequest||frame?.scene.id!==owner.sceneId||mapDraft?.id!==owner.mapId)return;
  const waypoints=value('travel-waypoints').split(';').filter(s=>s.trim()).map(s=>{const [q,r]=s.split(',').map(Number);return{q:q!,r:r!};});
  const result=unwrap(await window.campaign.previewTravel(owner.token,{sceneId:owner.sceneId,mapId:owner.mapId,destination:{q:number('travel-q'),r:number('travel-r')},destinationLocationId:value('world-destination')||null,waypoints,paceKmh:number('travel-pace'),factor:number('travel-factor'),finalSeconds:value('travel-final-hours')?Math.ceil(number('travel-final-hours')*3600):null}));
  if(!ownsTravel(owner)||request!==travelRequest)return;
  preview=result;el('travel-preview-summary').textContent=(result.distanceMeters/1000).toFixed(2)+' km · '+(result.durationSeconds/3600).toFixed(2)+' Stunden · '+(result.route.length-1)+' Abschnitte · Ankunft: '+result.arrival;
  const warnings=el('travel-preview-warnings');for(const warning of result.warnings){const p=document.createElement('p');p.textContent=warning;warnings.append(p);}
  renderMap();el<HTMLButtonElement>('travel-preview-accept').disabled=false;el<HTMLDialogElement>('travel-preview-dialog').showModal();
 }catch(error){if(ownsTravel(owner)&&request===travelRequest)tell((error as Error).message,true);}
}
async function acceptTravelPreview(){
 const owner=travelOwner(),source=preview;if(!owner||!source)return;
 const current=()=>ownsTravel(owner)&&preview===source;
 try{
  if(!await flushWorld()||!current())return;
  await raw({kind:'journey',preview:source},current);
  if(!ownsTravel(owner))return;clearTravelPreview();await reloadScene();renderMap();renderJourney();await after();
 }catch(error){if(ownsTravel(owner))tell((error as Error).message,true);}
}
async function changeJourney(action:Extract<WorldAction,{kind:'journey-step'|'journey-state'}>){
 const owner=travelOwner(),id=frame?.journey?.id;if(!owner||id!==action.id)return;
 const current=()=>ownsTravel(owner)&&frame?.scene.id===owner.sceneId&&frame?.journey?.id===id;
 try{if(!await flushWorld()||!current())return;await raw(action,current);if(!ownsTravel(owner))return;clearTravelPreview();await reloadScene();renderMap();renderJourney();await after();}
 catch(error){if(ownsTravel(owner))tell((error as Error).message,true);}
}
export function activateWorld(w:Workspace){weatherContext=null;weatherGeneration++;workspace=w;clearTravelPreview();sceneRequest++;pending=null;uncertain=null;checkingWorldWrite=null;worldWrites=new Set();showUncertainWorldWrite();edits={map:0,calendar:0,event:0,phenomenon:0};liveWorld=null;liveRequest++;world=null;sources=null;live=null;frame=null;mapDraft=null;eventDraft=null;phenomenonDraft=null;dirtyMap=dirtyCell=dirtyCalendar=dirtyEvent=dirtyPhenomenon=false;preview=null;level=0;selected={q:0,r:0};center={q:0,r:0};}
export async function openWorld(){if(!workspace)return;const token=workspace.token,[w,p,l]=await Promise.all([window.campaign.world(token),window.campaign.preparation(token,''),window.campaign.live(token)]);if(workspace.token!==token)return;world=unwrap(w);sources=unwrap(p);live=unwrap(l);const maps=el<HTMLSelectElement>('world-map-select'),old=mapDraft?.id??maps.value;maps.replaceChildren();for(const m of world.maps)option(maps,m.id,m.name);maps.value=world.maps.some(m=>m.id===old)?old:world.maps[0]?.id??'';mapDraft=world.maps.find(m=>m.id===maps.value)?structuredClone(world.maps.find(m=>m.id===maps.value)!):null;const scenes=el<HTMLSelectElement>('world-scene'),prior=scenes.value;scenes.replaceChildren();for(const s of live.scenes)option(scenes,s.id,s.title||'Gruppe '+s.id.slice(0,6));scenes.value=live.scenes.some(s=>s.id===prior)?prior:live.focusId??'';for(const id of ['world-anchor-location','event-location']){const s=el<HTMLSelectElement>(id),previous=s.value;s.replaceChildren();option(s,'',id==='event-location'?'Überall':'Ort auswählen');for(const l of sources.locations)if(!l.trashed)option(s,l.document.id,l.document.name);s.value=previous;}await reloadScene();renderMapFields();renderCalendar();renderEventOptions();renderPhenomenonOptions();renderMap();renderCell();renderJourney();}
async function reloadScene(){
 const token=workspace?.token,id=value('world-scene'),request=++sceneRequest;
 if(!token||!id){frame=null;return;}
 const loaded=unwrap(await window.campaign.sceneWorld(token,id));
 if(workspace?.token===token&&value('world-scene')===id&&request===sceneRequest)frame=loaded;
}
function renderMapFields(){const picker=el<HTMLSelectElement>('world-map-select');if(mapDraft){const opt=[...picker.options].find(o=>o.value===mapDraft!.id);if(opt)opt.textContent=mapDraft.name;}el('world-map-workspace').hidden=!mapDraft;if(!mapDraft)return;el<HTMLInputElement>('world-map-name').value=mapDraft.name;el<HTMLInputElement>('world-hex-size').value=String(mapDraft.hexMeters/1000);el<HTMLSelectElement>('world-climate').value=mapDraft.climate;el<HTMLInputElement>('world-seed').value=mapDraft.seed;}
function renderCell(){if(!mapDraft)return;const c=cellAt(mapDraft,selected,level);el('hex-selected').textContent='Hex '+hexKey(selected)+' · Maßstab '+(mapDraft.hexMeters*2**level/1000).toFixed(2)+' km';for(const [id,v]of Object.entries({'hex-terrain':c.terrain,'hex-elevation':String(c.elevationM),'hex-climate':c.climate??'','hex-label':c.label,'hex-faction':c.faction,'hex-interrupt':c.interrupt}))el<HTMLInputElement>(id).value=v;el<HTMLInputElement>('hex-road').checked=c.road;el<HTMLInputElement>('hex-river').checked=c.river;const base=hexPoint(selected,2**level),target=pointHex(base.x,base.y);el<HTMLInputElement>('travel-q').value=String(target.q);el<HTMLInputElement>('travel-r').value=String(target.r);const place=world?.places.find(p=>p.mapId===mapDraft!.id&&!p.trashed&&hexKey(p)===hexKey(target));el<HTMLSelectElement>('world-destination').value=place?.locationId??'';}
function renderMap(){const root=el<SVGSVGElement & HTMLElement>('world-map');root.replaceChildren();if(!mapDraft)return;const m=mapDraft,cp=hexPoint(center),radius=7,known=new Set(frame?.knowledge.filter(k=>k.mapId===m.id).map(hexKey)),passive=el<HTMLInputElement>('world-passive').checked;root.setAttribute('viewBox',`${(cp.x-7.8)*100} ${(cp.y-6.8)*100} 1560 1360`);
 for(let q=center.q-radius;q<=center.q+radius;q++)for(let r=center.r-radius;r<=center.r+radius;r++){const h={q,r};if(hexDistance(h,center)>radius)continue;const c=cellAt(m,h,level),p=hexPoint(h),poly=svg('polygon');const pts=Array.from({length:6},(_,i)=>{const a=(30+60*i)*Math.PI/180;return(p.x+Math.cos(a)/Math.sqrt(3))*100+','+(p.y+Math.sin(a)/Math.sqrt(3))*100;});poly.setAttribute('points',pts.join(' '));const fine=pointHex(p.x*2**level,p.y*2**level),visible=!passive||known.has(hexKey(fine));poly.setAttribute('fill',visible?terrainColors[c.terrain]:'#26384a');poly.setAttribute('stroke',hexKey(h)===hexKey(selected)?'#10283d':'#ffffff66');poly.setAttribute('stroke-width',hexKey(h)===hexKey(selected)?'4':'1');poly.dataset.q=String(q);poly.dataset.r=String(r);poly.classList.add('atlas-hex');const title=svg('title');title.textContent=visible?[terrainNames[c.terrain],c.label,climateNames[c.climate??m.climate],c.interrupt].filter(Boolean).join(' · '):'Unbekannt für diese Gruppe';poly.append(title);poly.addEventListener('click',()=>run(async()=>{if(!(await flushWorld()))return;selected=h;if(el<HTMLInputElement>('hex-paint').checked){const paint=el<HTMLSelectElement>('hex-brush').value as Terrain,brush=Math.max(0,Math.min(5,Math.floor(number('hex-brush-radius'))));for(let dq=-brush;dq<=brush;dq++)for(let dr=-brush;dr<=brush;dr++){const target={q:h.q+dq,r:h.r+dr};if(hexDistance(target,h)>brush)continue;const cell={...cellAt(mapDraft!,target,level),terrain:paint};mapDraft!.cells=mapDraft!.cells.filter(c=>!(c.level===level&&hexKey(c)===hexKey(target)));mapDraft!.cells.push(cell);}dirtyMap=true;edits.map++;}renderCell();renderMap();}));root.append(poly);if(visible&&(c.road||c.river)){const line=svg('line');line.setAttribute('x1',String((p.x-.43)*100));line.setAttribute('x2',String((p.x+.43)*100));line.setAttribute('y1',String(p.y*100));line.setAttribute('y2',String(p.y*100));line.setAttribute('stroke',c.river?'#457eaa':'#725342');line.setAttribute('stroke-width',c.river?'6':'3');line.setAttribute('pointer-events','none');root.append(line);}if(visible&&c.label){const t=svg('text');t.setAttribute('x',String(p.x*100));t.setAttribute('y',String(p.y*100+24));t.setAttribute('text-anchor','middle');t.setAttribute('font-size','13');t.setAttribute('pointer-events','none');t.textContent=c.label.slice(0,24);root.append(t);}}
 const route=preview?.request.mapId===m.id?preview.route:frame?.journey?.mapId===m.id?frame.journey.route:[];if(route.length){const path=svg('polyline');path.setAttribute('points',route.map(h=>{const p=hexPoint(h);return p.x/2**level*100+','+p.y/2**level*100;}).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke','#7c433f');path.setAttribute('stroke-width','5');path.setAttribute('stroke-dasharray','9 6');path.setAttribute('pointer-events','none');root.append(path);}
 for(const place of world?.places.filter(p=>p.mapId===m.id&&!p.trashed)??[]){if(passive&&!known.has(hexKey(place)))continue;const p=hexPoint(place),x=p.x/2**level*100,y=p.y/2**level*100,marker=svg('circle'),label=svg('text');marker.setAttribute('cx',String(x));marker.setAttribute('cy',String(y));marker.setAttribute('r','11');marker.setAttribute('fill','#f4ead4');marker.setAttribute('stroke','#26384a');marker.dataset.locationId=place.locationId;marker.addEventListener('click',()=>run(async()=>{if(!(await flushWorld()))return;selected=pointHex(p.x,p.y,2**level);renderCell();el<HTMLSelectElement>('world-destination').value=place.locationId;el<HTMLInputElement>('travel-q').value=String(place.q);el<HTMLInputElement>('travel-r').value=String(place.r);renderMap();}));label.setAttribute('x',String(x));label.setAttribute('y',String(y-18));label.setAttribute('text-anchor','middle');label.setAttribute('font-size','17');label.setAttribute('paint-order','stroke');label.setAttribute('stroke','#f7f9fc');label.setAttribute('stroke-width','4');label.setAttribute('pointer-events','none');label.textContent=place.name;root.append(marker,label);}
 if(frame?.position.mapId===m.id){const p=hexPoint(frame.position),marker=svg('circle');marker.setAttribute('cx',String(p.x/2**level*100));marker.setAttribute('cy',String(p.y/2**level*100));marker.setAttribute('r','15');marker.setAttribute('fill','#b7413d');marker.setAttribute('stroke','#fff');marker.setAttribute('stroke-width','4');marker.setAttribute('pointer-events','none');root.append(marker);}
 const dest=el<HTMLSelectElement>('world-destination'),old=dest.value;dest.replaceChildren();option(dest,'','Hex aus Karte oder Koordinaten');for(const p of world?.places.filter(p=>p.mapId===m.id&&!p.trashed)??[])option(dest,p.locationId,p.name);dest.value=old;el('world-scale').textContent=(m.hexMeters*2**level/1000).toFixed(2)+' km je Hex · Stufe '+level;}
function renderCalendar(){if(!world)return;const c=world.calendar;for(const [id,v]of Object.entries({'calendar-name':c.name,'calendar-year':String(c.startYear),'calendar-hours':String(c.daySeconds/3600),'calendar-months':c.months.map(m=>m.name+': '+m.days).join('\n'),'calendar-weekdays':c.weekdays.join(', ')}))el<HTMLInputElement>(id).value=v;}
function renderJourney(){el('world-current').textContent=frame?frame.date+' · '+(frame.weather?frame.weather.label+' · '+frame.weather.effects.temperatureC+' °C · '+frame.weather.source:'Ohne Kartenposition'):'Wähle eine aktive Gruppe; Karten und Kalender lassen sich unabhängig vorbereiten.';const j=frame?.journey;el('world-journey-status').textContent=j?({active:'Unterwegs',paused:'Pausiert',interrupted:'Zur GM-Entscheidung angehalten',arrived:'Angekommen',ended:'Beendet'}[j.status])+' · '+(j.nextIndex-1)+' / '+(j.route.length-1)+' Abschnitte'+(j.reason?' · '+j.reason:''):'Keine angenommene Reise.';for(const id of ['journey-step','journey-many','journey-pause','journey-resume','journey-end'])el<HTMLButtonElement>(id).disabled=!j||['arrived','ended'].includes(j.status)||(['journey-step','journey-many','journey-pause'].includes(id)&&j.status!=='active');const history=el('world-history');history.replaceChildren();for(const h of frame?.history??[]){const p=document.createElement('p');p.textContent=h.text;history.append(p);}const events=el('world-relevant-events');events.replaceChildren();for(const e of frame?.events??[]){const p=document.createElement('p');p.textContent=e.name+(e.notes?' · '+e.notes:'');events.append(p);}}
function renderEventOptions(){const s=el<HTMLSelectElement>('calendar-event-select'),old=eventDraft?.id;s.replaceChildren();option(s,'','Neues Ereignis');for(const e of world?.events??[])option(s,e.id,e.name+(e.trashed?' · Papierkorb':''));s.value=old??'';renderEvent();}
function renderEvent(){el('calendar-event-editor').hidden=!eventDraft;if(!eventDraft)return;const e=eventDraft;for(const [id,v]of Object.entries({'event-name':e.name,'event-start':String(msDays(e.startMs)),'event-duration':String(msDays(e.durationMs)),'event-repeat':e.repeatMs===null?'':String(msDays(e.repeatMs)),'event-location':e.locationId??'','event-notes':e.notes}))el<HTMLInputElement>(id).value=v;el<HTMLInputElement>('event-trashed').checked=e.trashed;el('event-date-preview').textContent=world?calendarDate(world.calendar,e.startMs):'';}
function renderPhenomenonOptions(){const s=el<HTMLSelectElement>('phen-select'),old=phenomenonDraft?.id;s.replaceChildren();option(s,'','Neues Wetterereignis');for(const p of world?.phenomena.filter(p=>p.mapId===mapDraft?.id)??[])option(s,p.id,p.name+' · '+p.state);s.value=old??'';renderPhenomenon();}
function renderPhenomenon(){el('phen-editor').hidden=!phenomenonDraft;if(!phenomenonDraft)return;const p=phenomenonDraft;for(const [id,v]of Object.entries({'phen-name':p.name,'phen-kind':p.kind,'phen-intensity':String(p.intensity*100),'phen-q':String(p.center.q),'phen-r':String(p.center.r),'phen-radius':String(p.radiusHexes),'phen-move-q':String(p.movement.q),'phen-move-r':String(p.movement.r),'phen-start':String(msDays(p.startMs)),'phen-duration':String(msDays(p.durationMs)),'phen-state':p.state,'phen-temperature':p.temperatureC===null?'':String(p.temperatureC),'phen-travel':p.travelFactor===null?'':String(p.travelFactor),'phen-notes':p.notes}))el<HTMLInputElement>(id).value=v;}
function paintLiveWeather(result:SceneWorld,token:string,sceneId:string){const weather=result.weather;if(!weatherDirty&&!weatherBusy)populateWeatherInput(weather);el('live-world-summary').textContent=result.date+(weather?' · '+weather.label+' · '+weather.effects.temperatureC+' °C · Wind '+weather.windKmh+' km/h':'');el('live-weather-effects').textContent=weather?'Sicht '+weather.effects.visibilityMeters+' m · Reisefaktor '+weather.effects.travelFactor.toFixed(2)+' · '+weather.effects.perception+(weather.effects.combatNote?' · '+weather.effects.combatNote:''):'';const notices=el('live-world-notices');notices.replaceChildren();for(const n of result.notices){const card=document.createElement('p');card.textContent=n.text;card.append(button('Meldung ausblenden',async()=>{await action({kind:'notice-dismiss',sceneId,id:n.id});await renderLiveWorld(token,sceneId);}));notices.append(card);}for(const event of result.events){const p=document.createElement('p');p.textContent='Kalender: '+event.name+(event.notes?' · '+event.notes:'');notices.append(p);}lockWeather();}
export async function renderLiveWorld(token:string,sceneId:string){
 const request=++liveRequest;
 if(weatherContext?.token!==token||weatherContext.sceneId!==sceneId){weatherContext={token,sceneId};weatherGeneration++;liveWorld=null;}
 if(!document.getElementById('live-world-summary'))return;
 try{
  const result=unwrap(await window.campaign.sceneWorld(token,sceneId));if(workspace?.token!==token||request!==liveRequest||!document.getElementById('live-world-summary'))return;
  if(result.scene.id!==sceneId)throw new Error('Wetterantwort gehört zu einer anderen Gruppe.');if(!canAdoptWeatherFrame(liveWorld,result))return;liveWorld=result;paintLiveWeather(result,token,sceneId);
 }catch(error){if(workspace?.token===token&&request===liveRequest&&document.getElementById('live-world-summary'))el('live-world-summary').textContent='Weltanzeige: '+(error as Error).message;}
}
export function initWorld(status:typeof tell,flushLive:typeof before,reloadLive:typeof after,open:typeof enter){tell=status;before=flushLive;after=reloadLive;enter=open;
 let recovery=document.getElementById('world-write-recovery');
 if(!recovery){recovery=document.createElement('div');recovery.id='world-write-recovery';recovery.hidden=true;recovery.innerHTML='<span>Die Weltänderung ist noch unklar. Eingaben bleiben offen.</span> <button id="world-write-check">Auftrag prüfen</button>';el('status').after(recovery);}
 el('world-write-check').onclick=()=>{void reconcileWorldWrite();};

 const terrainOptions=Object.entries(terrainNames).map(([id,name])=>`<option value="${id}">${name}</option>`).join(''),climateOptions=Object.entries(climateNames).map(([id,name])=>`<option value="${id}">${name}</option>`).join('');
 el('world').innerHTML=`<div class="catalog-heading"><h2>Atlas, Reise und Kalender</h2><p>Hexstruktur · Ortsmarker · unabhängige Gruppenzeit</p></div><div class="toolbar"><label>Karte<select id="world-map-select"></select></label><button id="world-map-new">Neue Hexkarte</button><button id="world-map-copy">Karte duplizieren</button><label>Gruppe<select id="world-scene"></select></label><button id="world-group-center">Zur Gruppe</button></div><p id="world-current"></p><div id="world-map-workspace" hidden><div class="world-columns"><section><div class="toolbar"><button id="world-zoom-in">+ Näher</button><button id="world-zoom-out">− Weiter</button><span id="world-scale"></span><label class="check-label"><input id="world-passive" type="checkbox"> Wissen der Gruppe anzeigen</label></div><svg id="world-map" role="img" aria-label="Bearbeitbare Hexkarte mit Orten und Partyposition"></svg><div class="toolbar"><button data-world-pan="-5,0">←</button><button data-world-pan="0,-5">↑</button><button data-world-pan="0,5">↓</button><button data-world-pan="5,0">→</button><label class="check-label"><input id="hex-paint" type="checkbox"> Gelände malen</label><select id="hex-brush">${terrainOptions}</select><label>Pinselradius<input id="hex-brush-radius" type="number" min="0" max="5" value="0"></label></div><details><summary>Karteneinstellungen und Austausch</summary><form id="world-map-form"><label>Name<input id="world-map-name" required></label><div class="time-fields"><label>Lokales Hex in km<input id="world-hex-size" type="number" min=".001" step="any"></label><label>Fallbackklima<select id="world-climate">${climateOptions}</select></label></div><label>Wettermuster<input id="world-seed"></label><button type="submit">Karte speichern</button></form><div class="toolbar"><button id="world-map-export">Kartendaten anzeigen</button><button id="world-map-import">Als neue Karte übernehmen</button></div><textarea id="world-map-json" rows="5" aria-label="Kartendaten zum Kopieren oder Importieren"></textarea></details></section><section><h3 id="hex-selected"></h3><form id="hex-form"><div class="time-fields"><label>Gelände<select id="hex-terrain">${terrainOptions}</select></label><label>Höhe (m)<input id="hex-elevation" type="number" value="0"></label></div><label>Regionales Klima<select id="hex-climate"><option value="">Kartenklima erben</option>${climateOptions}</select></label><div class="toolbar"><label class="check-label"><input id="hex-road" type="checkbox"> Straße</label><label class="check-label"><input id="hex-river" type="checkbox"> Fluss</label></div><label>Beschriftung<input id="hex-label"></label><label>Fraktion / Einfluss<input id="hex-faction"></label><label>Reiseunterbrechung<textarea id="hex-interrupt" rows="2" placeholder="Zum Beispiel: Weg blockiert – GM entscheidet."></textarea></label><button type="submit">Hex speichern</button></form><label>Vorhandenen Ort markieren<select id="world-anchor-location"></select></label><button id="world-anchor-save">Ort auf diesem Hex platzieren</button><div class="toolbar"><button id="world-place-group">Gruppe hier platzieren</button><button id="world-reveal">Für diese Gruppe aufdecken</button></div><p class="caption">Platzieren ändert keine Reisezeit. Zum Reisen die Vorschau annehmen und Abschnitte bestätigen.</p></section></div><section class="world-travel"><h3>Reise der ausgewählten Gruppe</h3><form id="world-travel-form"><label>Ziel<select id="world-destination"><option value="">Hex aus Karte oder Koordinaten</option></select></label><div class="combat-fields"><label>Ziel q<input id="travel-q" type="number" value="0"></label><label>Ziel r<input id="travel-r" type="number" value="0"></label><label>Tempo (km/h)<input id="travel-pace" type="number" value="4" min=".1" step="any"></label><label>Zeitfaktor<input id="travel-factor" type="number" value="1" min=".01" step="any"></label></div><div class="time-fields"><label>Wegpunkte q,r; q,r (optional)<input id="travel-waypoints" placeholder="1,0; 2,1"></label><label>Enddauer in Stunden (optional; hat Vorrang)<input id="travel-final-hours" type="number" min=".001" step="any"></label></div><button type="submit">Route und Reisezeit ansehen</button></form><p id="world-journey-status"></p><div class="toolbar"><button id="journey-step">Nächsten Abschnitt bestätigen</button><button id="journey-many">Bis zur nächsten Grenze weiter</button><button id="journey-pause">Pause</button><button id="journey-resume">Fortsetzen / Hinweis aufgelöst</button><button id="journey-end">Reise beenden</button></div><div id="world-relevant-events"></div><details><summary>Reise- und Weltverlauf</summary><div id="world-history"></div></details></section></div><div class="world-columns"><section><h3>Kampagnenkalender</h3><form id="calendar-form"><label>Name<input id="calendar-name" required></label><div class="time-fields"><label>Erstes Jahr<input id="calendar-year" type="number" value="1"></label><label>Stunden je Tag<input id="calendar-hours" type="number" min="1" max="168" value="24"></label></div><label>Monate: Name: Tage (eine Zeile je Monat)<textarea id="calendar-months" rows="8"></textarea></label><label>Wochentage, kommagetrennt<input id="calendar-weekdays"></label><button type="submit">Kalender speichern</button></form><p class="caption">Der Kalender deutet gespeicherte Zeitpunkte. Ein Kalenderwechsel verschiebt keine aufgezeichnete Reise.</p><h3>Feiertage und Ereignisse</h3><select id="calendar-event-select"></select><button id="event-new">Neues Ereignis</button><form id="calendar-event-editor" hidden><label>Name<input id="event-name"></label><div class="combat-fields"><label>Beginn: Tage seit Start<input id="event-start" type="number" min="0" step="any"></label><label>Dauer in Tagen<input id="event-duration" type="number" min=".001" step="any"></label><label>Alle … Tage (optional)<input id="event-repeat" type="number" min=".001" step="any"></label></div><p id="event-date-preview"></p><label>Ort<select id="event-location"></select></label><label>Notizen<textarea id="event-notes" rows="3"></textarea></label><label class="check-label"><input id="event-trashed" type="checkbox"> Papierkorb</label><button type="submit">Ereignis speichern</button></form></section><section><h3>Bewegte Wetterereignisse</h3><p>Klima und Jahreszeit bilden den Grundzustand. Eigene Wettergebiete ergänzen ihn; eine GM-Vorgabe für eine Gruppe bleibt bis zur Freigabe bestehen.</p><select id="phen-select"></select><button id="phen-new">Neues Wettergebiet</button><form id="phen-editor" hidden><label>Name<input id="phen-name"></label><div class="combat-fields"><label>Wetter<select id="phen-kind"><option value="storm">Sturm</option><option value="rain">Regen</option><option value="snow">Schnee</option><option value="fog">Nebel</option><option value="clouds">Bewölkt</option><option value="clear">Klar</option></select></label><label>Intensität (%)<input id="phen-intensity" type="number" min="0" max="100"></label><label>Gebietsradius in Hexes<input id="phen-radius" type="number" min=".1" step="any"></label><label>Status<select id="phen-state"><option value="active">Aktiv</option><option value="paused">Pausiert</option><option value="ended">Beendet</option></select></label></div><div class="combat-fields"><label>Zentrum q<input id="phen-q" type="number"></label><label>Zentrum r<input id="phen-r" type="number"></label><label>Bewegung q / 24 Stunden<input id="phen-move-q" type="number" step="any"></label><label>Bewegung r / 24 Stunden<input id="phen-move-r" type="number" step="any"></label></div><div class="combat-fields"><label>Beginn: Tage seit Start<input id="phen-start" type="number" min="0" step="any"></label><label>Dauer in Tagen<input id="phen-duration" type="number" min=".001" step="any"></label><label>Temperatur °C (optional)<input id="phen-temperature" type="number" step="any"></label><label>Reisefaktor (optional)<input id="phen-travel" type="number" min=".1" step="any"></label></div><label>Hinweise / Effekte<textarea id="phen-notes" rows="3"></textarea></label><button type="submit">Wettergebiet speichern</button></form></section></div><dialog id="travel-preview-dialog"><h2>Reisevorschau</h2><p id="travel-preview-summary"></p><div id="travel-preview-warnings"></div><div class="actions"><button id="travel-preview-cancel">Abbrechen</button><button id="travel-preview-accept">Reise annehmen</button></div></dialog>`;
 el('live-world-panel').innerHTML=`<h3>Weltzeit und Wetter</h3><p id="live-world-summary"></p><p id="live-weather-effects" class="caption"></p><div id="live-world-notices"></div><button id="live-open-world">Atlas und Reise öffnen</button><details><summary>Wetter für diese Gruppe vorgeben</summary><form id="weather-override-form"><div class="combat-fields"><label>Wetter<select id="weather-override-kind"><option value="clear">Klar</option><option value="clouds">Bewölkt</option><option value="rain">Regen</option><option value="snow">Schnee</option><option value="fog">Nebel</option><option value="storm">Sturm</option></select></label><label>Intensität (%)<input id="weather-override-intensity" type="number" min="0" max="100" value="70"></label><label>Temperatur °C<input id="weather-override-temperature" type="number" value="15"></label><label>Reisefaktor<input id="weather-override-factor" type="number" min=".1" step="any" value="1"></label></div><label>GM-Hinweis<input id="weather-override-notes"></label><div class="toolbar"><button type="submit">GM-Wetter übernehmen</button><button id="weather-discard-input" type="button">Eigene Eingabe verwerfen</button><button id="weather-release" type="button">Wetterautomatik freigeben</button></div></form></details>`;
 const mapInput=()=>{dirtyMap=true;edits.map++;},cellInput=()=>{dirtyCell=true;edits.map++;},calendarInput=()=>{dirtyCalendar=true;edits.calendar++;},eventInput=()=>{dirtyEvent=true;edits.event++;},phenomenonInput=()=>{dirtyPhenomenon=true;edits.phenomenon++;};
 for(const [id,input] of [['world-map-form',mapInput],['hex-form',cellInput],['calendar-form',calendarInput],['calendar-event-editor',eventInput],['phen-editor',phenomenonInput]] as const){el(id).oninput=input;}
 for(const id of ['world-map-form','hex-form','calendar-form','calendar-event-editor','phen-editor'])el(id).onsubmit=e=>{e.preventDefault();run(async()=>{if(await flushWorld()){await reloadScene();renderMapFields();renderMap();renderCell();renderCalendar();renderJourney();renderEventOptions();renderPhenomenonOptions();await after();tell('Welt und Reise gespeichert.');}});};
 el('world-map-new').onclick=()=>run(async()=>{if(!(await flushWorld()))return;const m:AtlasMap={id:crypto.randomUUID(),revision:0,name:'Neue Region',hexMeters:4828.032,climate:'temperate',seed:crypto.randomUUID(),cells:[]};await raw({kind:'map',map:m,expectedRevision:null});await openWorld();el<HTMLSelectElement>('world-map-select').value=m.id;mapDraft=structuredClone(world!.maps.find(p=>p.id===m.id)!);center={q:0,r:0};selected={q:0,r:0};renderMapFields();renderMap();renderCell();});
 el('world-map-copy').onclick=()=>run(async()=>{if(!(await flushWorld())||!mapDraft)return;const m={...structuredClone(mapDraft),id:crypto.randomUUID(),revision:0,name:mapDraft.name+' – Kopie'};await raw({kind:'map',map:m,expectedRevision:null});await openWorld();});
 el('world-map-select').onchange=()=>run(async()=>{const id=value('world-map-select');clearTravelPreview();if(!(await flushWorld()))return;mapDraft=structuredClone(world!.maps.find(m=>m.id===id)!);center={q:0,r:0};selected={q:0,r:0};preview=null;renderMapFields();renderMap();renderCell();renderPhenomenonOptions();});el('world-scene').onchange=()=>{clearTravelPreview();run(async()=>{if(await flushWorld()){await reloadScene();renderJourney();renderMap();}});};
 const zoom=async(delta:number)=>{if(!(await flushWorld()))return;const p=hexPoint(center,2**level);level=Math.max(0,Math.min(12,level+delta));center=pointHex(p.x,p.y,2**level);selected=center;renderMap();renderCell();};el('world-zoom-in').onclick=()=>run(()=>zoom(-1));el('world-zoom-out').onclick=()=>run(()=>zoom(1));el('world-map').addEventListener('wheel',e=>{e.preventDefault();run(()=>zoom(e.deltaY>0?1:-1));},{passive:false});for(const b of el('world').querySelectorAll<HTMLButtonElement>('[data-world-pan]'))b.onclick=()=>run(async()=>{if(!(await flushWorld()))return;const [q,r]=b.dataset.worldPan!.split(',').map(Number);center={q:center.q+q!,r:center.r+r!};renderMap();});el('world-passive').onchange=renderMap;
 el('world-group-center').onclick=()=>run(async()=>{if(!(await flushWorld()))return;await reloadScene();if(!frame?.position.mapId)return;mapDraft=structuredClone(world!.maps.find(m=>m.id===frame!.position.mapId)!);el<HTMLSelectElement>('world-map-select').value=mapDraft.id;const p=hexPoint(frame.position);center=pointHex(p.x,p.y,2**level);selected=center;renderMapFields();renderMap();renderCell();});
 const localHex=()=>{const p=hexPoint(selected,2**level);return pointHex(p.x,p.y);};el('world-anchor-save').onclick=()=>run(async()=>{if(!mapDraft||!value('world-anchor-location'))throw new Error('Karte und Ort auswählen.');const old=world?.places.find(p=>p.locationId===value('world-anchor-location'));await action({kind:'place',mapId:mapDraft.id,locationId:value('world-anchor-location'),expectedRevision:old?.revision??null,hex:localHex()});});
 el('world-place-group').onclick=()=>run(async()=>{if(!mapDraft||!frame)throw new Error('Karte und aktive Gruppe auswählen.');const h=localHex(),loc=world?.places.find(p=>p.mapId===mapDraft!.id&&!p.trashed&&hexKey(p)===hexKey(h));await action({kind:'place-scene',sceneId:frame.scene.id,expectedSceneRevision:frame.scene.revision,expectedPositionRevision:frame.position.revision,position:{...h,mapId:mapDraft.id,locationId:loc?.locationId??null}});});el('world-reveal').onclick=()=>run(async()=>{if(!mapDraft||!frame)return;await action({kind:'reveal',sceneId:frame.scene.id,mapId:mapDraft.id,hex:localHex(),expectedMembershipRevision:frame.scene.membershipRevision});});
 el('world-destination').onchange=()=>{clearTravelPreview();const place=world?.places.find(p=>p.locationId===value('world-destination')),base=hexPoint(selected,2**level),target=place??pointHex(base.x,base.y);el<HTMLInputElement>('travel-q').value=String(target.q);el<HTMLInputElement>('travel-r').value=String(target.r);};
 for(const id of ['travel-q','travel-r'])el(id).oninput=()=>{el<HTMLSelectElement>('world-destination').value='';clearTravelPreview();};
 el('world-travel-form').oninput=clearTravelPreview;
 el('world-travel-form').onsubmit=e=>{e.preventDefault();void makeTravelPreview();};
 el('travel-preview-cancel').onclick=()=>{clearTravelPreview();renderMap();};
 el('travel-preview-accept').onclick=()=>{void acceptTravelPreview();};
 for(const [id,maxSteps]of [['journey-step',1],['journey-many',12]] as const)el(id).onclick=()=>{if(frame?.journey)void changeJourney({kind:'journey-step',id:frame.journey.id,expectedRevision:frame.journey.revision,maxSteps});};
 for(const [id,state]of [['journey-pause','paused'],['journey-resume','active'],['journey-end','ended']] as const)el(id).onclick=()=>{if(frame?.journey)void changeJourney({kind:'journey-state',id:frame.journey.id,expectedRevision:frame.journey.revision,state});};
 el('world-map-export').onclick=()=>run(async()=>{if(await flushWorld())el<HTMLTextAreaElement>('world-map-json').value=JSON.stringify(mapDraft,null,2);});el('world-map-import').onclick=()=>run(async()=>{if(!(await flushWorld()))return;const m=JSON.parse(value('world-map-json')) as AtlasMap;await raw({kind:'map',map:{...m,id:crypto.randomUUID(),revision:0},expectedRevision:null});await openWorld();});
 el('event-new').onclick=()=>run(async()=>{if(!(await flushWorld()))return;eventDraft={id:crypto.randomUUID(),revision:0,name:'',startMs:frame?.scene.clock.instantMs??'0',durationMs:daysMs(1),repeatMs:null,locationId:null,notes:'',trashed:false};renderEvent();});el('calendar-event-select').onchange=()=>run(async()=>{const id=value('calendar-event-select');if(await flushWorld()){eventDraft=world?.events.find(e=>e.id===id)??null;renderEvent();}});
 el('phen-new').onclick=()=>run(async()=>{if(!(await flushWorld())||!mapDraft)return;phenomenonDraft={id:crypto.randomUUID(),revision:0,mapId:mapDraft.id,name:'',kind:'storm',intensity:.7,center:localHex(),radiusHexes:3,movement:{q:0,r:0},startMs:frame?.scene.clock.instantMs??'0',durationMs:daysMs(2),state:'active',pausedAtMs:null,temperatureC:null,travelFactor:null,notes:''};renderPhenomenon();});el('phen-select').onchange=()=>run(async()=>{const id=value('phen-select');if(await flushWorld()){phenomenonDraft=world?.phenomena.find(p=>p.id===id)??null;renderPhenomenon();}});
 el('live-open-world').onclick=()=>run(enter);
 el('weather-override-form').oninput=()=>{weatherDirty=true;weatherEdits++;try{weatherBasis??=weatherOwner();}catch(error){tell((error as Error).message,true);}};
 el('weather-override-form').onsubmit=e=>{e.preventDefault();try{const kind=value('weather-override-kind') as Weather['kind'],intensity=number('weather-override-intensity')/100,effects=weatherEffects(kind,intensity,number('weather-override-temperature'));effects.travelFactor=number('weather-override-factor');effects.combatNote=value('weather-override-notes');const weather:Weather={kind,label:el<HTMLSelectElement>('weather-override-kind').selectedOptions[0]!.textContent!,intensity,windKmh:0,effects,source:'GM-Override'};run(()=>submitWeather(weather));}catch(error){tell((error as Error).message,true);}};
 el('weather-release').onclick=()=>run(()=>submitWeather(null));el('weather-discard-input').onclick=()=>run(discardWeatherInput);
}

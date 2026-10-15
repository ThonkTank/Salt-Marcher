import {markerSymbols,defaultMarkerPresentation} from './atlas-marker';
import {PassiveMapCanvas,type CanvasBox} from './passive-map-canvas';
import {journeyPlayback,journeySpeeds} from './journey-playback';
import {installHexMapGestures} from './hex-map-gestures';
import {partyTravelPace} from './travel-pace';
import {renderTravelBriefing} from './travel-preview-ui';
import {agendaCountdown} from './agenda-model';
import type {Workspace,Result} from './contracts';
import type {Preparation} from './preparation-contracts';
import type {LiveView} from './live-contracts';
import type {WorldView,SceneWorld,AtlasMap,AtlasCell,Hex,WorldAction,WorldCommand,WorldAck,WorldReconciliation,TravelPreview,CalendarEvent,WeatherPhenomenon,Weather,Climate,Terrain,MarkerPresentation} from './world-contracts';
import {hexKey,hexPoint,pointHex,hexDistance,cellAt,authoredCellAt,terrainNames,terrainColors,terrainFactor,climateNames,weatherEffects} from './world-model';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T,value=(id:string)=>el<HTMLInputElement>(id).value;
const unwrap=<T>(r:Result<T>):T=>{if(!r.ok)throw new Error(r.error);return r.value;};
const svg=(tag:string)=>document.createElementNS('http://www.w3.org/2000/svg',tag);
let worldCanvas:PassiveMapCanvas|null=null,canvasBasis='';
function suspendMapPointer(){mapGestures?.suspend();worldCanvas?.cancel();}
let mapGestures:ReturnType<typeof installHexMapGestures>|null=null;
let workspace:Workspace|null=null,world:WorldView|null=null,sources:Preparation|null=null,live:LiveView|null=null,frame:SceneWorld|null=null,mapDraft:AtlasMap|null=null,selected:Hex={q:0,r:0},center:Hex={q:0,r:0},level=0,viewZoom=1;
let dirtyMap=false,dirtyCell=false,dirtyCalendar=false,dirtyPhenomenon=false,pending:Promise<boolean>|null=null,preview:TravelPreview|null=null,phenomenonDraft:WeatherPhenomenon|null=null;
let tell:(text:string,error?:boolean)=>void,before:()=>Promise<boolean>,after:()=>Promise<void>,enter:()=>Promise<void>,camp:(sceneId:string,kind:'wait'|'rest')=>Promise<void>;
let routeMode:'edit'|'target'|'route'='edit',routeCursor:Hex={q:0,r:0},routeStops:Hex[]=[];
let liveTravelOpen=false,liveSurface=false,liveFocusId:string|null=null,liveBoundSceneId:string|null=null;
let liveWorld:SceneWorld|null=null,liveRequest=0,travelRequest=0,sceneRequest=0;
let worldSurface='atlas',transportBusy=false,playbackJourneyId:string|null=null;
const playback=journeyPlayback({read:playbackFrame,step:async basis=>{const j=frame?.journey;if(!j||j.revision!==basis.revision||j.nextIndex!==basis.nextIndex)return false;return changeJourney({kind:'journey-step',id:j.id,expectedRevision:j.revision,maxSteps:1});},changed:renderPlayback});
function journeyBasisChanged(){const j=frame?.journey;return !!j&&!!frame&&(frame.scene.clock.revision!==j.clockRevision||frame.position.revision!==j.positionRevision||frame.scene.membershipRevision!==j.membershipRevision||world?.maps.find(m=>m.id===j.mapId)?.revision!==j.mapRevision);}
function playbackFrame(){
 const j=frame?.journey;
 if(!workspace||!j||j.status!=='active'||mapDraft?.id!==j.mapId||frame?.scene.id!==value('world-scene')||mapDraft.id!==value('world-map-select')||document.visibilityState==='hidden'||(worldSurface!=='world'&&!(liveSurface&&liveTravelOpen))||document.querySelector('dialog[open]')||journeyBasisChanged()||weatherDirty||weatherBusy||pending||uncertain||checkingWorldWrite||worldWrites.size||dirtyMap||dirtyCell||dirtyCalendar||dirtyPhenomenon)return null;
 return{key:workspace.token+':'+j.sceneId+':'+j.mapId+':'+j.id,revision:j.revision,nextIndex:j.nextIndex,seconds:j.segmentSeconds[j.nextIndex-1]!};
}
function renderPlayback(){
 const label=document.getElementById('journey-playback-status');if(!label)return;
 const j=frame?.journey,open=!!j&&['active','paused','interrupted'].includes(j.status),busy=transportBusy||playback.busy;
 label.textContent=playback.running?'Wiedergabe '+playback.speed+'× · jeder erreichte Hex bestätigt Position und Zeit.':open?'Wiedergabe pausiert · Fortsetzen startet am letzten bestätigten Hex.':'1× = eine Echtsekunde je Spielstunde. Geschwindigkeit ändert keine Reisezeit.';
 el('journey-speed').textContent=playback.speed+'×';el<HTMLButtonElement>('journey-slower').disabled=playback.speed===1;el<HTMLButtonElement>('journey-faster').disabled=playback.speed===10;
 el<HTMLButtonElement>('journey-play').disabled=!open||playback.running||busy||journeyBasisChanged();
 for(const id of ['journey-step','journey-many','journey-resume'])if(busy)el<HTMLButtonElement>(id).disabled=true;
 el<HTMLButtonElement>('journey-pause').disabled=!open||transportBusy||!playback.running&&j?.status!=='active';
 el<HTMLButtonElement>('journey-end').disabled=!open||transportBusy;
}
async function transport(kind:'play'|'pause'|'end'|'step'|'many'){
 const owner=travelOwner(),journeyId=frame?.journey?.id;if(!owner||!journeyId||transportBusy)return;
 transportBusy=true;playback.stop();renderPlayback();
 try{
  await playback.settled();if(!ownsTravel(owner)||frame?.journey?.id!==journeyId)return;
  const j=frame.journey;if(['arrived','ended'].includes(j.status))return;
  const ok=kind==='play'?(j.status==='active'||await changeJourney({kind:'journey-state',id:j.id,expectedRevision:j.revision,state:'active'})):await changeJourney(kind==='step'||kind==='many'?{kind:'journey-step',id:j.id,expectedRevision:j.revision,maxSteps:kind==='step'?1:12}:{kind:'journey-state',id:j.id,expectedRevision:j.revision,state:kind==='pause'?'paused':'ended'});
  if(ok&&kind==='play'&&ownsTravel(owner))playback.play();
 }finally{transportBusy=false;renderJourney();}
}

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
let checkingWorldWrite: Promise<WorldReconciliation|null> | null = null;
let worldWrites = new Set<Promise<void>>();
function showUncertainWorldWrite() { el('world-write-recovery').hidden = !uncertain; }
function adoptConfirmedWorldWrite(command: WorldCommand, ack: WorldAck, versions: typeof edits,weatherIntent?:WeatherIntent) {
  if(command.action.kind==='weather-override'){if(!weatherIntent)throw new Error('Wettereingabe zum Auftrag fehlt.');acceptOwnWeather(weatherIntent,ack.scene);return;}
  world = ack.world;
  if (ack.scene) frame = ack.scene;
  const a = command.action;
  if (a.kind === 'map' && mapDraft?.id === a.map.id) {
    mapDraft = structuredClone(ack.world.maps.find(m => m.id === a.map.id)!); dirtyMap = edits.map !== versions.map;
  } else if(a.kind==='place-presentation'&&markerDraft?.id===a.locationId){const place=ack.world.places.find(p=>p.locationId===a.locationId);if(place){markerDraft.revision=place.presentationRevision??0;markerDraft.dirty=edits.marker!==versions.marker;if(!markerDraft.dirty)loadMarkerEditor();}
  } else if (a.kind === 'calendar') dirtyCalendar = edits.calendar !== versions.calendar;
  else if (a.kind === 'phenomenon' && phenomenonDraft?.id === a.phenomenon.id) {
    phenomenonDraft = structuredClone(ack.world.phenomena.find(p => p.id === a.phenomenon.id)!); dirtyPhenomenon = edits.phenomenon !== versions.phenomenon;
  }
}
async function resolveWorldWrite(): Promise<WorldReconciliation|null> {
  if (checkingWorldWrite) return checkingWorldWrite;
  if (!uncertain || !workspace) return null;
  const captured = uncertain, token = workspace.token;
  const operation = Promise.resolve().then(async () => {
    try {
      const result = unwrap(await window.campaign.reconcileWorld(captured.command, token));
      if (workspace?.token !== token || uncertain !== captured) return null;
      if (result.outcome === 'applied') adoptConfirmedWorldWrite(captured.command, result.ack, captured.versions,captured.weatherIntent);
      uncertain = null; showUncertainWorldWrite();
      tell(result.outcome === 'applied' ? 'Weltänderung bestätigt. Spätere Eingaben bleiben offen.' : 'Weltänderung wurde nicht übernommen. Eingabe bleibt offen.');
      return result;
    } catch (error) {
      if (workspace?.token === token) tell((error as Error).message + ' Weltänderung bleibt unklar.', true);
      return null;
    } finally { if (checkingWorldWrite === operation) checkingWorldWrite = null; }
  });
  checkingWorldWrite = operation;
  return operation;
}
export async function reconcileWorldWrite():Promise<boolean>{return !uncertain&&!checkingWorldWrite||!!await resolveWorldWrite();}
export function agendaWritePending(eventId:string,token:string){return workspace?.token===token&&uncertain?.command.action.kind==='calendar-event'&&uncertain.command.action.event.id===eventId;}
export async function recoverAgendaEvent(eventId:string,token:string){
 if(!agendaWritePending(eventId,token))throw new Error('Kein ungeklärter Speicherauftrag für dieses Ereignis.');
 const result=await resolveWorldWrite();if(!result||workspace?.token!==token)throw new Error('Speicherauftrag bleibt ungeklärt.');
 return result.outcome==='applied'?result.ack.world.events.find(event=>event.id===eventId)??null:null;
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
let edits = { map: 0, calendar: 0, phenomenon: 0, marker:0 };
export async function flushWorld(): Promise<boolean> {
  mapGestures?.finish();
  if (pending) return pending;
  if (uncertain) { tell('Weltänderung ist unklar. Auftrag prüfen erhält die offenen Eingaben.', true); return false; }
  const token = workspace?.token;
  // Only preceding actions are awaited; this flush must not wait on its own raw writes.
  const preceding = [...worldWrites];
  const operation = Promise.resolve().then(async () => {
    try {
      await Promise.all(preceding);
      if(!await flushMarker())return false;
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
      } while (dirtyMap || dirtyCell || dirtyCalendar || dirtyPhenomenon);
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
 travelRequest++;preview=null;if(document.getElementById('travel-evaluation'))el('travel-evaluation').textContent='Keine aktuelle Routenauswertung.';el('travel-preview-summary').textContent='';el('travel-preview-warnings').replaceChildren();el<HTMLButtonElement>('travel-preview-accept').disabled=true;
 const dialog=el<HTMLDialogElement>('travel-preview-dialog');if(dialog.open)dialog.close();
}
function resetRouteDraft(){routeStops=[];routeCursor={q:0,r:0};clearTravelPreview();if(document.getElementById('travel-waypoints')){el<HTMLInputElement>('travel-waypoints').value='';el<HTMLSelectElement>('world-destination').value='';el<HTMLInputElement>('travel-q').value='0';el<HTMLInputElement>('travel-r').value='0';renderRouteDraft();}}
function writeRouteStops(stops:Hex[],locationId:string|null=null){if(stops.length>21)throw new Error('Höchstens 20 Wegpunkte plus Reiseziel.');routeStops=stops.map(h=>({...h}));clearTravelPreview();el<HTMLInputElement>('travel-waypoints').value=stops.slice(0,-1).map(hexKey).join('; ');const last=stops.at(-1);el<HTMLInputElement>('travel-q').value=String(last?.q??0);el<HTMLInputElement>('travel-r').value=String(last?.r??0);el<HTMLSelectElement>('world-destination').value=locationId??'';renderRouteDraft();renderMap();}
function readRouteInputs():Hex[]|null{
 try{
  const stops=value('travel-waypoints').split(';').filter(t=>t.trim()).map(t=>{
   const parts=t.split(',');if(parts.length!==2||parts.some(p=>!p.trim()))throw new Error('Wegpunkte vollständig als q,r eingeben.');
   return{q:Number(parts[0]),r:Number(parts[1])};
  });
  if(['travel-q','travel-r'].some(id=>!value(id).trim()))throw new Error('Zielkoordinaten q und r vollständig eingeben.');
  stops.push({q:number('travel-q'),r:number('travel-r')});
  if(stops.length>21||stops.some(h=>!Number.isSafeInteger(h.q)||!Number.isSafeInteger(h.r)))throw new Error('Ganze Hexkoordinaten und höchstens 21 Stationen eingeben.');
  routeStops=stops;renderRouteDraft();renderMap();return stops;
 }catch(error){routeStops=[];renderRouteDraft();renderMap();el('travel-draft-status').textContent=(error as Error).message;return null;}
}
function chooseRouteHex(h:Hex,locationId:string|null=null){routeCursor={...h};const p=hexPoint(h,2**level),fine=pointHex(p.x,p.y);if(routeMode==='route'){if(hexKey(routeStops.at(-1)??{q:Infinity,r:Infinity})!==hexKey(fine))writeRouteStops([...routeStops,fine],locationId);}else writeRouteStops([...routeStops.slice(0,-1),fine],locationId);renderRouteDraft();renderMap();}
function renderPartyPace(){
 const auto=el<HTMLInputElement>('travel-party-pace').checked,field=el<HTMLInputElement>('travel-pace'),members=live?.roster.filter(c=>c.active&&c.sceneId===value('world-scene'))??[],pace=partyTravelPace(members);field.disabled=!!auto;
 if(auto)field.value=String(pace.kmh);
 el('travel-pace-context').textContent='Reisegruppe: '+(members.map(c=>c.profile.name).join(', ')||'keine aktive Figur')+(auto?' · Langsamste Bewegung: '+pace.feet+' ft → '+pace.kmh.toFixed(2)+' km/h.'+(pace.missing.length?' Bewegung fehlt bei '+pace.missing.join(', ')+': 30 ft angenommen.':''):' · Manuelle GM-Vorgabe.');
}
function renderRouteDraft(){if(!document.getElementById('travel-stops'))return;el('world-travel-owner').classList.toggle('travel-planning',routeMode!=='edit');renderPartyPace();for(const mode of ['edit','target','route'])el('travel-mode-'+mode).setAttribute('aria-pressed',String(mode===routeMode));el<HTMLButtonElement>('travel-preview-open').disabled=!routeStops.length||!frame||!mapDraft||frame.position.mapId!==mapDraft.id||!frame.scene.members.length;el<HTMLButtonElement>('travel-place-cursor').disabled=!frame||!mapDraft||!frame.scene.members.length;const root=el('travel-stops');root.replaceChildren();for(const [i,h]of routeStops.entries()){const li=document.createElement('li'),name=world?.places.find(p=>p.mapId===mapDraft?.id&&!p.trashed&&hexKey(p)===hexKey(h))?.name;li.append(document.createTextNode((i===routeStops.length-1?'Ziel: ':'Wegpunkt '+(i+1)+': ')+(name?name+' · ':'')+hexKey(h)+' '));for(const [text,delta]of [['↑',-1],['↓',1]] as const){const b=button(text,()=>{const j=i+delta;if(j<0||j>=routeStops.length)return;const next=routeStops.slice();[next[i],next[j]]=[next[j]!,next[i]!];writeRouteStops(next);});b.disabled=i+delta<0||i+delta>=routeStops.length;b.setAttribute('aria-label','Station '+(i+1)+(delta<0?' nach oben':' nach unten'));li.append(b);}li.append(button('Entfernen',()=>writeRouteStops(routeStops.filter((_,j)=>j!==i))));root.append(li);}const p=hexPoint(routeCursor,2**level),base=pointHex(p.x,p.y),cell=mapDraft?cellAt(mapDraft,base):null;el('travel-draft-status').textContent=routeMode==='edit'?'Kartenbearbeitung: Hexauswahl und Malen.':'Kartenmodus '+(routeMode==='route'?'Wegpunkte':'Ziel')+' · Cursor '+hexKey(base)+(cell?' · '+terrainNames[cell.terrain]+' · Grundkosten ×'+terrainFactor(cell).toFixed(2):'')+' · Pfeiltasten bewegen, Enter wählen.';el('travel-place-cursor').setAttribute('aria-label','Gruppe auf Hex '+hexKey(base)+' platzieren');}
async function placeRouteCursor(){const owner=travelOwner();if(!owner||!mapDraft||!frame)throw new Error('Karte und aktive Gruppe auswählen.');const p=hexPoint(routeCursor,2**level),h=pointHex(p.x,p.y),scene=structuredClone(frame.scene),positionRevision=frame.position.revision,locationId=world?.places.find(p=>p.mapId===mapDraft!.id&&!p.trashed&&hexKey(p)===hexKey(h))?.locationId??null;if(!await flushWorld()||!ownsTravel(owner))return;await raw({kind:'place-scene',sceneId:scene.id,expectedSceneRevision:scene.revision,expectedPositionRevision:positionRevision,position:{...h,mapId:owner.mapId,locationId}},()=>ownsTravel(owner));if(ownsTravel(owner)){resetRouteDraft();await reloadScene();renderMap();renderJourney();await after();}}
async function makeTravelPreview(continueJourney=false){
 const owner=travelOwner();if(!owner)return;playback.stop();await playback.settled();if(!ownsTravel(owner))return;clearTravelPreview();const request=travelRequest;
 try{
  if((liveTravelOpen&&liveSurface&&!await before())||!await flushWorld()||!ownsTravel(owner)||request!==travelRequest||frame?.scene.id!==owner.sceneId||mapDraft?.id!==owner.mapId)return;
  const j=continueJourney?frame.journey:null;if(continueJourney&&(!j||!['active','paused','interrupted'].includes(j.status)))throw new Error('Kein offener Restweg.');
  const stops=j?null:readRouteInputs();if(!j&&!stops)return;
  const result=unwrap(await window.campaign.previewTravel(owner.token,{sceneId:owner.sceneId,mapId:owner.mapId,destination:j?j.route.at(-1)!:stops!.at(-1)!,destinationLocationId:j?j.destinationLocationId:value('world-destination')||null,waypoints:j?[]:stops!.slice(0,-1),paceKmh:number('travel-pace'),...(el<HTMLInputElement>('travel-party-pace').checked?{usePartyPace:true}:{}),factor:number('travel-factor'),finalSeconds:value('travel-final-hours')?Math.ceil(number('travel-final-hours')*3600):null,...(j?{continuation:{journeyId:j.id,expectedRevision:j.revision}}:{})}));
  if(!ownsTravel(owner)||request!==travelRequest)return;
  if(result.request.usePartyPace)el<HTMLInputElement>('travel-pace').value=String(result.request.paceKmh);
  preview=result;el('travel-evaluation').textContent=(result.durationSeconds/3600).toFixed(2)+' Stunden · '+(result.route.length-1)+' Hexabschnitte · '+(result.distanceMeters/1000).toFixed(2)+' km';el('travel-preview-summary').textContent=(result.distanceMeters/1000).toFixed(2)+' km · '+(result.durationSeconds/3600).toFixed(2)+' Stunden · '+(result.route.length-1)+' Abschnitte · Ankunft: '+result.arrival;
  const warnings=el('travel-preview-warnings');warnings.replaceChildren();for(const warning of result.warnings){const p=document.createElement('p');p.textContent=warning;warnings.append(p);}
  renderTravelBriefing(el('travel-preview-itinerary'),result);el<HTMLButtonElement>('travel-preview-accept').textContent=result.continuation?'Restreise ausdrücklich annehmen':'Reise annehmen';renderMap();el<HTMLButtonElement>('travel-preview-accept').disabled=false;el<HTMLDialogElement>('travel-preview-dialog').showModal();
 }catch(error){if(ownsTravel(owner)&&request===travelRequest)tell((error as Error).message,true);}
}
async function acceptTravelPreview(){
 const owner=travelOwner(),source=preview;if(!owner||!source)return;
 const current=()=>ownsTravel(owner)&&preview===source;
 try{
  if(!await flushWorld()||!current())return;
  await raw({kind:'journey',preview:source,presentationSpeed:playback.speed},current);
  if(!current())return;resetRouteDraft();routeMode='target';await reloadScene();renderMap();renderJourney();renderRouteDraft();await after();if(ownsTravel(owner))playback.play();
 }catch(error){if(ownsTravel(owner))tell((error as Error).message,true);}
}
async function changeJourney(action:Extract<WorldAction,{kind:'journey-step'|'journey-state'}>){
 const owner=travelOwner(),id=frame?.journey?.id;if(!owner||id!==action.id)return false;
 const current=()=>ownsTravel(owner)&&frame?.scene.id===owner.sceneId&&frame?.journey?.id===id;
 try{if(!await flushWorld()||!current())return false;await raw(action,current);if(!ownsTravel(owner))return false;clearTravelPreview();await reloadScene();renderMap();renderJourney();await after();return ownsTravel(owner);}
 catch(error){if(ownsTravel(owner))tell((error as Error).message,true);return false;}
}
async function replanRemainingJourney(){const j=frame?.journey;if(!j)return;el<HTMLInputElement>('travel-party-pace').checked=!!j.usePartyPace;renderPartyPace();el<HTMLInputElement>('travel-pace').value=String(j.paceKmh);el<HTMLInputElement>('travel-factor').value=String(j.factor);el<HTMLInputElement>('travel-final-hours').value='';await makeTravelPreview(true);}
async function openTravelCamp(kind:'wait'|'rest'){playback.stop();await playback.settled();const owner=travelOwner(),j=frame?.journey;if(!owner||!j||!liveSurface||liveFocusId!==owner.sceneId)return;if(j.status==='active'&&!await changeJourney({kind:'journey-state',id:j.id,expectedRevision:j.revision,state:'paused'}))return;if(ownsTravel(owner))await camp(owner.sceneId,kind);}
export function stopWorldPlayback(){playback.stop();return playback.settled();}
// The Atlas and Live desk share the very same controls and travel owner.
// Only their DOM placement changes; maps and journeys never get a second draft.
export function setWorldSurface(tab:string){
 worldSurface=tab;if(tab!=='world'&&!(tab==='live'&&liveTravelOpen))playback.stop();
 liveSurface=tab==='live';
 const owner=document.getElementById('world-travel-owner'),home=document.getElementById('world-travel-home'),host=document.getElementById('live-travel-host');
 if(!owner||!home||!host)return;
 const docked=liveSurface&&liveTravelOpen;
 if(docked){host.append(owner);if(routeMode==='edit')routeMode='target';if(liveFocusId&&frame?.scene.id!==liveFocusId){resetRouteDraft();clearTravelPreview();frame=null;el<HTMLSelectElement>('world-scene').value=liveFocusId;renderJourney();}}
 else home.after(owner);
 owner.classList.toggle('live-travel-owner',docked);
 host.hidden=!docked;
 el('live-travel-toggle').setAttribute('aria-expanded',String(liveTravelOpen));
 el('live-travel-toggle').textContent=liveTravelOpen?'Reisekarte einklappen':'Reisekarte am Spieltisch';
 el('world-map').setAttribute('aria-label',docked?'Hexkarte: Reiseziele und Wegpunkte für die Fokusgruppe':'Bearbeitbare Hexkarte mit Orten und Partyposition');
 renderRouteDraft();
}
function followLiveGroup(result:SceneWorld){
 const changed=frame?.scene.id!==result.scene.id||(liveBoundSceneId!==null&&liveBoundSceneId!==result.scene.id),first=liveBoundSceneId===null;liveBoundSceneId=result.scene.id;
 const basisChanged=changed||frame?.scene.clock.revision!==result.scene.clock.revision||frame?.position.revision!==result.position.revision||frame?.scene.membershipRevision!==result.scene.membershipRevision;
 const scenes=el<HTMLSelectElement>('world-scene');
 if(![...scenes.options].some(o=>o.value===result.scene.id))option(scenes,result.scene.id,result.scene.title||'Fokusgruppe');
 scenes.value=result.scene.id;
 if(changed){playback.stop();resetRouteDraft();el<HTMLInputElement>('travel-final-hours').value='';}
 else if(basisChanged)clearTravelPreview();
 frame=result;
 if((changed||first)&&result.position.mapId&&world?.maps.some(m=>m.id===result.position.mapId)){
  if(mapDraft?.id!==result.position.mapId)resetRouteDraft();
  mapDraft=structuredClone(world.maps.find(m=>m.id===result.position.mapId)!);
  el<HTMLSelectElement>('world-map-select').value=mapDraft.id;
 }
 if((changed||first)&&result.position.mapId===mapDraft?.id){const p=hexPoint(result.position);center=pointHex(p.x,p.y,2**level);routeCursor={...center};}
 el('live-travel-context').textContent=(result.scene.title||'Fokusgruppe')+' · '+result.scene.members.length+' Figuren · '+result.date;
 el('live-travel-empty').hidden=!!mapDraft;
 renderMapFields();renderMap();renderJourney();
}
async function toggleLiveTravel(){
 if(liveTravelOpen){playback.stop();if(!await flushWorld())return;liveTravelOpen=false;setWorldSurface(liveSurface?'live':'world');return;}
 const token=workspace?.token;
 if(!token||!liveFocusId||!await before()||!await flushWorld()||workspace?.token!==token)return;
 const toggle=el<HTMLButtonElement>('live-travel-toggle');toggle.disabled=true;
 try{
  liveTravelOpen=true;await openWorld();
  if(workspace?.token!==token)return;
  setWorldSurface(liveSurface?'live':'world');
  if(liveFocusId)await renderLiveWorld(token,liveFocusId);
 }catch(error){liveTravelOpen=false;setWorldSurface(liveSurface?'live':'world');throw error;}
 finally{toggle.disabled=false;}
}
export function activateWorld(w:Workspace){playback.stop();playbackJourneyId=null;playback.setSpeed(1);mapGestures?.reset();weatherContext=null;weatherGeneration++;workspace=w;liveTravelOpen=false;liveFocusId=null;liveBoundSceneId=null;setWorldSurface(liveSurface?'live':'world');routeMode='edit';resetRouteDraft();clearTravelPreview();sceneRequest++;pending=null;uncertain=null;checkingWorldWrite=null;worldWrites=new Set();showUncertainWorldWrite();edits={map:0,calendar:0,phenomenon:0,marker:0};markerDraft=null;markerSaving=null;markerSelection++;liveWorld=null;liveRequest++;world=null;sources=null;live=null;frame=null;mapDraft=null;phenomenonDraft=null;dirtyMap=dirtyCell=dirtyCalendar=dirtyPhenomenon=false;preview=null;level=0;viewZoom=1;selected={q:0,r:0};center={q:0,r:0};}
export async function openWorld(){if(!workspace)return;const token=workspace.token,[w,p,l]=await Promise.all([window.campaign.world(token),window.campaign.preparation(token,''),window.campaign.live(token)]);if(workspace.token!==token)return;world=unwrap(w);sources=unwrap(p);live=unwrap(l);const maps=el<HTMLSelectElement>('world-map-select'),old=mapDraft?.id??maps.value;maps.replaceChildren();for(const m of world.maps)option(maps,m.id,m.name);maps.value=world.maps.some(m=>m.id===old)?old:world.maps[0]?.id??'';if(maps.value!==old)resetRouteDraft();mapDraft=world.maps.find(m=>m.id===maps.value)?structuredClone(world.maps.find(m=>m.id===maps.value)!):null;const scenes=el<HTMLSelectElement>('world-scene'),prior=scenes.value;scenes.replaceChildren();for(const s of live.scenes)option(scenes,s.id,s.title||'Gruppe '+s.id.slice(0,6));scenes.value=liveTravelOpen&&liveSurface?live.focusId??'':live.scenes.some(s=>s.id===prior)?prior:live.focusId??'';if(scenes.value!==prior)resetRouteDraft();renderLocationOptions();loadMarkerEditor();await reloadScene();renderMapFields();renderCalendar();renderPhenomenonOptions();renderMap();renderCell();renderJourney();}
async function reloadScene(){
 const token=workspace?.token,id=value('world-scene'),request=++sceneRequest;
 if(!token||!id){frame=null;return;}
 const loaded=unwrap(await window.campaign.sceneWorld(token,id));
 if(workspace?.token===token&&value('world-scene')===id&&request===sceneRequest){if(frame&&(frame.scene.id!==loaded.scene.id||frame.scene.clock.revision!==loaded.scene.clock.revision||frame.position.revision!==loaded.position.revision||frame.scene.membershipRevision!==loaded.scene.membershipRevision))clearTravelPreview();const entering=frame?.scene.id!==loaded.scene.id;frame=loaded;if(entering&&loaded.journey&&['active','paused','interrupted'].includes(loaded.journey.status)){routeMode='target';renderRouteDraft();}}
}
function renderMapFields(){const picker=el<HTMLSelectElement>('world-map-select');if(mapDraft){const opt=[...picker.options].find(o=>o.value===mapDraft!.id);if(opt)opt.textContent=mapDraft.name;}el('world-map-workspace').hidden=!mapDraft;if(!mapDraft)return;el<HTMLInputElement>('world-map-name').value=mapDraft.name;el<HTMLInputElement>('world-hex-size').value=String(mapDraft.hexMeters/1000);el<HTMLSelectElement>('world-climate').value=mapDraft.climate;el<HTMLInputElement>('world-seed').value=mapDraft.seed;}
type MarkerDraft={id:string;revision:number;presentation:MarkerPresentation;dirty:boolean};
let markerDraft:MarkerDraft|null=null,markerSaving:Promise<boolean>|null=null,markerSelection=0;
function renderLocationOptions(){
 const picker=el<HTMLSelectElement>('world-anchor-location'),old=picker.value,query=value('world-anchor-search').trim().toLocaleLowerCase();
 picker.replaceChildren();option(picker,'','Ort auswählen');
 for(const row of sources?.locations??[]){if(row.trashed)continue;const d=row.document,place=world?.places.find(p=>p.locationId===d.id),where=place?' · '+(world?.maps.find(m=>m.id===place.mapId)?.name??'Karte')+' '+hexKey(place):' · ohne Marker';
 if(d.id===old||!query||[d.name,d.type==='city'?'Stadt Siedlung':'Ort Sehenswürdigkeit',where].join(' ').toLocaleLowerCase().includes(query))option(picker,d.id,d.name+where);}
 picker.value=old;
}
function loadMarkerEditor(){
 const id=value('world-anchor-location'),place=world?.places.find(p=>p.locationId===id&&!p.trashed);
 markerDraft=place?{id,revision:place.presentationRevision??0,presentation:structuredClone(place.presentation??defaultMarkerPresentation),dirty:false}:null;
 el<HTMLFieldSetElement>('world-marker-fields').disabled=!place;
 for(const [key,v]of Object.entries({'title':markerDraft?.presentation.title??'','symbol':markerDraft?.presentation.symbol??'pin','size':String(markerDraft?.presentation.size??1),'label-position':markerDraft?.presentation.labelPosition??'above','curve':String(markerDraft?.presentation.curve??0)}))el<HTMLInputElement>('world-marker-'+key).value=v;
 el('world-marker-status').textContent=place?'Marker auf '+(world?.maps.find(m=>m.id===place.mapId)?.name??'Karte')+' · Hex '+hexKey(place)+'. Kartendarstellung wird unabhängig vom Ortsinhalt gespeichert.':'Ort auswählen und auf einem Hex platzieren, um seinen Marker zu gestalten.';
 el<HTMLButtonElement>('world-anchor-focus').disabled=!place;
 el('world-anchor-save').textContent=place?'Marker auf ausgewähltes Hex versetzen':'Ort auf diesem Hex platzieren';
}
function collectMarker(){if(!markerDraft||el<HTMLFieldSetElement>('world-marker-fields').disabled||value('world-anchor-location')!==markerDraft.id)return;const next:MarkerPresentation={title:value('world-marker-title'),symbol:value('world-marker-symbol'),size:number('world-marker-size'),labelPosition:value('world-marker-label-position') as MarkerPresentation['labelPosition'],curve:number('world-marker-curve')};if(JSON.stringify(next)===JSON.stringify(markerDraft.presentation))return;markerDraft.presentation=next;markerDraft.dirty=true;edits.marker++;renderMap();}
async function flushMarker():Promise<boolean>{
 if(markerSaving)return markerSaving;
 if(!markerDraft?.dirty)return true;
 const token=workspace?.token,draft=markerDraft;
 const operation=Promise.resolve().then(async()=>{try{
  await Promise.all([...worldWrites]);
  while(draft===markerDraft&&workspace?.token===token&&draft.dirty){
   const version=edits.marker,ack=await raw({kind:'place-presentation',locationId:draft.id,expectedRevision:draft.revision||null,presentation:structuredClone(draft.presentation)},()=>workspace?.token===token&&markerDraft===draft);
   if(workspace?.token!==token||markerDraft!==draft)return false;
   draft.revision=ack.world.places.find(p=>p.locationId===draft.id)?.presentationRevision??0;draft.dirty=version!==edits.marker;
  }
  if(workspace?.token!==token||markerDraft!==draft)return false;
  el('world-marker-status').textContent='Ortsmarke gespeichert. Ortsinhalt und Gelände bleiben eigenständig.';renderMap();return true;
 }catch(error){
  if(workspace?.token===token&&markerDraft===draft){
   let restored=false;
   if(token&&!uncertain){try{const confirmed=unwrap(await window.campaign.world(token));if(workspace?.token===token&&markerDraft===draft){world=confirmed;loadMarkerEditor();renderMap();restored=true;}}catch{}}
   if(workspace?.token===token)tell((error as Error).message+(uncertain?' Auftrag prüfen, bevor der Marker weiter geändert wird.':restored?' Bestätigte Darstellung wiederhergestellt; Änderung erneut prüfen.':' Bestätigter Stand konnte nicht gelesen werden. Eingabe bleibt offen.'),true);
  }return false;
 }finally{if(markerSaving===operation)markerSaving=null;}});
 markerSaving=operation;return operation;
}
function renderCell(){if(!mapDraft)return;const c=cellAt(mapDraft,selected,level);el('hex-authored-status').textContent=authoredCellAt(mapDraft,selected,level)?'Gestaltetes Gelände':'Noch ungezeichnet · Reisen rechnen hier mit Ebene.';el('hex-selected').textContent='Hex '+hexKey(selected)+' · Maßstab '+(mapDraft.hexMeters*2**level/1000).toFixed(2)+' km';for(const [id,v]of Object.entries({'hex-terrain':c.terrain,'hex-elevation':String(c.elevationM),'hex-climate':c.climate??'','hex-label':c.label,'hex-faction':c.faction,'hex-interrupt':c.interrupt}))el<HTMLInputElement>(id).value=v;el<HTMLInputElement>('hex-road').checked=c.road;el<HTMLInputElement>('hex-river').checked=c.river;if(routeStops.length||routeMode!=='edit')return;const base=hexPoint(selected,2**level),target=pointHex(base.x,base.y);el<HTMLInputElement>('travel-q').value=String(target.q);el<HTMLInputElement>('travel-r').value=String(target.r);const place=world?.places.find(p=>p.mapId===mapDraft!.id&&!p.trashed&&hexKey(p)===hexKey(target));el<HTMLSelectElement>('world-destination').value=place?.locationId??'';}
function hexCameraBox():CanvasBox{const p=hexPoint(center);return{x:(p.x-7.8/viewZoom)*100,y:(p.y-6.8/viewZoom)*100,width:1560/viewZoom,height:1360/viewZoom};}
function cameraBasis(){return JSON.stringify([workspace?.token,mapDraft?.id,level,center.q,center.r,viewZoom]);}
function renderMap(){
 if(!worldCanvas){renderMapScene();return;}
 const basis=cameraBasis(),key=(workspace?.token??'')+':'+(mapDraft?.id??'')+':'+level;
 if(worldCanvas.context(key,hexCameraBox())||basis!==canvasBasis){worldCanvas.set(hexCameraBox());canvasBasis=basis;}
 worldCanvas.render(renderMapScene,mapDraft?'':'Keine Karte ausgewählt. Region anlegen oder eine vorhandene Karte öffnen.');
}
function renderMapScene(){mapGestures?.sync();const root=el<SVGSVGElement & HTMLElement>('world-map');root.replaceChildren();if(!mapDraft)return;const labels:SVGElement[]=[];const m=mapDraft,radius=Math.ceil(7/viewZoom),known=new Set(frame?.knowledge.filter(k=>k.mapId===m.id).map(hexKey)),passive=el<HTMLInputElement>('world-passive').checked;
 for(let q=center.q-radius;q<=center.q+radius;q++)for(let r=center.r-radius;r<=center.r+radius;r++){const h={q,r};if(hexDistance(h,center)>radius)continue;const authored=authoredCellAt(m,h,level),c=authored??cellAt(m,h,level),p=hexPoint(h),poly=svg('polygon');const pts=Array.from({length:6},(_,i)=>{const a=(30+60*i)*Math.PI/180;return(p.x+Math.cos(a)/Math.sqrt(3))*100+','+(p.y+Math.sin(a)/Math.sqrt(3))*100;});poly.setAttribute('points',pts.join(' '));const fine=pointHex(p.x*2**level,p.y*2**level),visible=!passive||known.has(hexKey(fine));poly.setAttribute('fill',visible?(authored?terrainColors[c.terrain]:'#edf1e8'):'#26384a');poly.setAttribute('stroke',hexKey(h)===hexKey(routeMode==='edit'?selected:routeCursor)?'#10283d':visible&&!authored?'#9caa94':'#ffffff66');poly.setAttribute('stroke-width',hexKey(h)===hexKey(routeMode==='edit'?selected:routeCursor)?'4':'1');poly.dataset.authored=String(!!authored);if(visible&&!authored)poly.setAttribute('stroke-dasharray','5 4');poly.dataset.q=String(q);poly.dataset.r=String(r);poly.classList.add('atlas-hex');const title=svg('title');title.textContent=visible?[authored?terrainNames[c.terrain]:'Ungezeichnet · Reiseannahme Ebene',c.label,climateNames[c.climate??m.climate],c.interrupt].filter(Boolean).join(' · '):'Unbekannt für diese Gruppe';poly.append(title);const choose=()=>run(async()=>{if(routeMode!=='edit'){chooseRouteHex(h);return;}if(!(await flushWorld()))return;selected=h;routeCursor=h;renderCell();renderMap();});poly.addEventListener('click',choose);root.append(poly);if(visible&&(c.road||c.river)){const line=svg('line');line.setAttribute('x1',String((p.x-.43)*100));line.setAttribute('x2',String((p.x+.43)*100));line.setAttribute('y1',String(p.y*100));line.setAttribute('y2',String(p.y*100));line.setAttribute('stroke',c.river?'#457eaa':'#725342');line.setAttribute('stroke-width',c.river?'6':'3');line.setAttribute('pointer-events','none');root.append(line);}if(visible&&c.label){const t=svg('text');t.setAttribute('x',String(p.x*100));t.setAttribute('y',String(p.y*100+24));t.setAttribute('text-anchor','middle');t.setAttribute('font-size',String(Math.max(30,14*1360/(root.clientHeight||520))/viewZoom));t.setAttribute('paint-order','stroke');t.setAttribute('stroke','#f7f9fc');t.setAttribute('stroke-width','4');t.style.cursor='pointer';t.setAttribute('pointer-events','bounding-box');t.addEventListener('click',choose);t.textContent=c.label.slice(0,24);labels.push(t);}}
 root.append(...labels);
 const route=preview?.request.mapId===m.id?preview.route:frame?.journey?.mapId===m.id&&['active','paused','interrupted'].includes(frame.journey.status)?frame.journey.route:[];if(route.length){const path=svg('polyline');path.setAttribute('points',route.map(h=>{const p=hexPoint(h);return p.x/2**level*100+','+p.y/2**level*100;}).join(' '));path.dataset.travelRoute='accepted';path.setAttribute('fill','none');path.setAttribute('stroke','#7c433f');path.setAttribute('stroke-width','5');path.setAttribute('stroke-dasharray','9 6');path.setAttribute('pointer-events','none');root.append(path);}
 if(routeStops.length){const points=svg('polyline');points.dataset.travelDraft='true';points.setAttribute('points',routeStops.map(h=>{const p=hexPoint(h);return p.x/2**level*100+','+p.y/2**level*100;}).join(' '));points.setAttribute('fill','none');points.setAttribute('stroke','#4d6854');points.setAttribute('stroke-width','3');points.setAttribute('stroke-dasharray','3 7');points.setAttribute('pointer-events','none');root.append(points);for(const [i,h]of routeStops.entries()){const p=hexPoint(h),label=svg('text');label.dataset.routeStop=String(i+1);label.setAttribute('x',String(p.x/2**level*100));label.setAttribute('y',String(p.y/2**level*100-24));label.setAttribute('text-anchor','middle');label.setAttribute('paint-order','stroke');label.setAttribute('stroke','#fff');label.setAttribute('stroke-width','4');label.setAttribute('font-size','20');label.setAttribute('pointer-events','none');label.textContent=String(i+1);root.append(label);}}
 for(const place of world?.places.filter(p=>p.mapId===m.id&&!p.trashed)??[]){if(passive&&!known.has(hexKey(place)))continue;const p=hexPoint(place),x=p.x/2**level*100,y=p.y/2**level*100,style=markerDraft?.id===place.locationId?markerDraft.presentation:place.presentation??defaultMarkerPresentation,unit=style.size/viewZoom,marker=svg('path'),label=svg('text');marker.setAttribute('d',markerSymbols.find(s=>s.id===style.symbol)!.path);marker.setAttribute('transform',`translate(${x} ${y}) scale(${unit})`);marker.setAttribute('fill-rule','evenodd');marker.setAttribute('stroke-width','2');marker.setAttribute('stroke-linejoin','round');marker.style.cursor='pointer';const hint=svg('title');hint.textContent=place.name;marker.append(hint);marker.setAttribute('fill','#f4ead4');marker.setAttribute('stroke','#26384a');marker.dataset.locationId=place.locationId;const choose=()=>run(async()=>{if(routeMode!=='edit'){chooseRouteHex(pointHex(p.x,p.y,2**level),place.locationId);return;}if(!(await flushWorld()))return;selected=pointHex(p.x,p.y,2**level);el<HTMLSelectElement>('world-anchor-location').value=place.locationId;renderLocationOptions();loadMarkerEditor();renderCell();el<HTMLSelectElement>('world-destination').value=place.locationId;el<HTMLInputElement>('travel-q').value=String(place.q);el<HTMLInputElement>('travel-r').value=String(place.r);renderMap();});marker.addEventListener('click',choose);label.style.cursor='pointer';label.setAttribute('pointer-events','bounding-box');label.addEventListener('click',choose);const right=style.labelPosition==='right',lx=x+(right?25*unit:0),ly=y+(style.labelPosition==='below'?43:style.labelPosition==='right'?9:-25)*unit;label.dataset.markerLabel=place.locationId;label.setAttribute('x',String(lx));label.setAttribute('y',String(ly));label.setAttribute('text-anchor',right?'start':'middle');label.setAttribute('font-size',String(30*unit));label.setAttribute('paint-order','stroke');label.setAttribute('stroke','#f7f9fc');label.setAttribute('stroke-width','4');label.setAttribute('stroke-linejoin','round');const title=style.title||place.name;if(style.curve&&style.labelPosition!=='hidden'){const path=svg('path'),width=Math.max(120,title.length*20)*unit,id='marker-label-'+place.locationId;path.id=id;path.setAttribute('d',`M${lx-(right?0:width/2)} ${ly} q${width/2} ${-style.curve*width/2} ${width} 0`);path.setAttribute('fill','none');path.setAttribute('pointer-events','none');const text=svg('textPath');text.setAttribute('href','#'+id);text.setAttribute('startOffset',right?'0%':'50%');text.textContent=title;label.append(text);root.append(path);}else label.textContent=title;root.append(marker);if(style.labelPosition!=='hidden')root.append(label);}
 if(frame?.position.mapId===m.id){const p=hexPoint(frame.position),marker=svg('circle');marker.setAttribute('cx',String(p.x/2**level*100));marker.setAttribute('cy',String(p.y/2**level*100));marker.setAttribute('r','15');marker.setAttribute('fill','#b7413d');marker.setAttribute('stroke','#fff');marker.setAttribute('stroke-width','4');marker.setAttribute('pointer-events','none');root.append(marker);}
 const dest=el<HTMLSelectElement>('world-destination'),old=dest.value;dest.replaceChildren();option(dest,'','Hex aus Karte oder Koordinaten');for(const p of world?.places.filter(p=>p.mapId===m.id&&!p.trashed)??[])option(dest,p.locationId,p.name);dest.value=old;el('world-scale').textContent=(m.hexMeters*2**level/1000).toFixed(2)+' km je Hex · Ansicht '+Math.round(viewZoom*100)+' %';el<HTMLSelectElement>('world-edit-level').value=String(level);el<HTMLButtonElement>('world-zoom-in').disabled=viewZoom>=3;el<HTMLButtonElement>('world-zoom-out').disabled=viewZoom<=.5;renderRouteDraft();}
function renderCalendar(){if(!world)return;const c=world.calendar;for(const [id,v]of Object.entries({'calendar-name':c.name,'calendar-year':String(c.startYear),'calendar-hours':String(c.daySeconds/3600),'calendar-months':c.months.map(m=>m.name+': '+m.days).join('\n'),'calendar-weekdays':c.weekdays.join(', ')}))el<HTMLInputElement>(id).value=v;}
function renderJourney(){renderPartyPace();const position=frame?.position,place=position?.locationId?world?.places.find(p=>p.locationId===position.locationId&&!p.trashed):null;const where=position?.mapId?(place?place.name+' · ':'')+'Hex '+hexKey(position)+(position.mapId!==mapDraft?.id?' auf '+(world?.maps.find(m=>m.id===position.mapId)?.name??'anderer Karte'):''):'Ohne Kartenposition';el('world-current').textContent=frame?frame.date+' · '+where+' · '+(frame.weather?frame.weather.label+' · '+frame.weather.effects.temperatureC+' °C · '+frame.weather.source:'Wetter noch nicht bestimmt'):'Wähle eine aktive Gruppe; Karten und Kalender lassen sich unabhängig vorbereiten.';const j=frame?.journey;if(j&&j.id!==playbackJourneyId){playback.stop();playbackJourneyId=j.id;playback.setSpeed(j.presentationSpeed??1);}el('world-journey-status').textContent=j?({active:'Unterwegs',paused:'Pausiert',interrupted:'Zur GM-Entscheidung angehalten',arrived:'Angekommen',ended:'Beendet'}[j.status])+' · '+(j.nextIndex-1)+' / '+(j.route.length-1)+' Abschnitte · geplante Restzeit '+(j.segmentSeconds.slice(j.nextIndex-1).reduce((a,b)=>a+b,0)/3600).toFixed(2)+' h'+(j.reason?' · '+j.reason:''):'Keine angenommene Reise.';for(const id of ['journey-step','journey-many','journey-pause','journey-resume','journey-end'])el<HTMLButtonElement>(id).disabled=!j||['arrived','ended'].includes(j.status)||(['journey-step','journey-many','journey-pause'].includes(id)&&j.status!=='active');const refresh=el('world-journey-refresh'),open=!!j&&['active','paused','interrupted'].includes(j.status),changed=!!j&&!!frame&&(frame.scene.clock.revision!==j.clockRevision||frame.position.revision!==j.positionRevision||frame.scene.membershipRevision!==j.membershipRevision||world?.maps.find(m=>m.id===j.mapId)?.revision!==j.mapRevision);el('journey-controls').hidden=!open;refresh.textContent=open?(changed?'Zeit, Gruppe, Position oder Karte geändert. Restweg neu bewerten und die neue Vorschau bestätigen.':(j?.status==='active'?'Für Warten oder Rast zuerst pausieren. Danach Restweg mit aktuellem Kalender und Wetter neu bewerten.':'Nach zusätzlichem Warten oder einer Rast den Restweg mit aktuellem Kalender und Wetter neu bewerten.'))+(j?.continuedFrom?' · Fortsetzung einer früheren Reise.':''):'';el<HTMLButtonElement>('journey-replan').disabled=!open||j!.nextIndex>=j!.route.length;el<HTMLButtonElement>('journey-resume').disabled=!open||changed;for(const id of ['journey-wait','journey-rest']){el<HTMLButtonElement>(id).hidden=!liveSurface;el<HTMLButtonElement>(id).disabled=!open||liveFocusId!==frame?.scene.id;}const history=el('world-history');history.replaceChildren();for(const h of frame?.history??[]){const p=document.createElement('p');p.textContent=h.text;history.append(p);}const events=el('world-relevant-events');events.replaceChildren();for(const e of frame?.events??[]){const p=document.createElement('p');p.textContent=e.name+(e.notes?' · '+e.notes:'');events.append(p);}playback.sync();renderPlayback();}
function renderPhenomenonOptions(){const s=el<HTMLSelectElement>('phen-select'),old=phenomenonDraft?.id;s.replaceChildren();option(s,'','Neues Wetterereignis');for(const p of world?.phenomena.filter(p=>p.mapId===mapDraft?.id)??[])option(s,p.id,p.name+' · '+p.state);s.value=old??'';renderPhenomenon();}
function renderPhenomenon(){el('phen-editor').hidden=!phenomenonDraft;if(!phenomenonDraft)return;const p=phenomenonDraft;for(const [id,v]of Object.entries({'phen-name':p.name,'phen-kind':p.kind,'phen-intensity':String(p.intensity*100),'phen-q':String(p.center.q),'phen-r':String(p.center.r),'phen-radius':String(p.radiusHexes),'phen-move-q':String(p.movement.q),'phen-move-r':String(p.movement.r),'phen-start':String(msDays(p.startMs)),'phen-duration':String(msDays(p.durationMs)),'phen-state':p.state,'phen-temperature':p.temperatureC===null?'':String(p.temperatureC),'phen-travel':p.travelFactor===null?'':String(p.travelFactor),'phen-notes':p.notes}))el<HTMLInputElement>(id).value=v;}
function paintLiveWeather(result:SceneWorld,token:string,sceneId:string){const weather=result.weather;if(!weatherDirty&&!weatherBusy)populateWeatherInput(weather);el('live-world-summary').textContent=result.date+(weather?' · '+weather.label+' · '+weather.effects.temperatureC+' °C · Wind '+weather.windKmh+' km/h':'');el('live-weather-effects').textContent=weather?'Sicht '+weather.effects.visibilityMeters+' m · Reisefaktor '+weather.effects.travelFactor.toFixed(2)+' · '+weather.effects.perception+(weather.effects.combatNote?' · '+weather.effects.combatNote:''):'';const notices=el('live-world-notices');notices.replaceChildren();for(const n of result.notices){const card=document.createElement('p');card.textContent=n.text;card.append(button('Meldung ausblenden',async()=>{await action({kind:'notice-dismiss',sceneId,id:n.id});await renderLiveWorld(token,sceneId);}));notices.append(card);}for(const event of result.events){const p=document.createElement('p');p.textContent='Kalender: '+event.name+(event.notes?' · '+event.notes:'');notices.append(p);}lockWeather();void renderLiveAgenda(token,sceneId,liveRequest);}
export async function renderLiveWorld(token:string,sceneId:string){
 const request=++liveRequest;liveFocusId=sceneId;if(liveTravelOpen&&liveSurface&&frame?.scene.id!==sceneId){clearTravelPreview();resetRouteDraft();el<HTMLSelectElement>('world-scene').value=sceneId;el<HTMLButtonElement>('travel-preview-open').disabled=true;el<HTMLButtonElement>('travel-place-cursor').disabled=true;}
 if(weatherContext?.token!==token||weatherContext.sceneId!==sceneId){weatherContext={token,sceneId};weatherGeneration++;liveWorld=null;}
 if(!document.getElementById('live-world-summary'))return;
 try{
  const result=unwrap(await window.campaign.sceneWorld(token,sceneId));if(workspace?.token!==token||request!==liveRequest||!document.getElementById('live-world-summary'))return;
  if(result.scene.id!==sceneId)throw new Error('Wetterantwort gehört zu einer anderen Gruppe.');if(!canAdoptWeatherFrame(liveWorld,result))return;liveWorld=result;if(liveTravelOpen&&liveSurface)followLiveGroup(result);paintLiveWeather(result,token,sceneId);void renderLiveAgenda(token,sceneId,request);
 }catch(error){if(workspace?.token===token&&request===liveRequest&&document.getElementById('live-world-summary'))el('live-world-summary').textContent='Weltanzeige: '+(error as Error).message;}
}
export function initWorld(status:typeof tell,flushLive:typeof before,reloadLive:typeof after,open:typeof enter,openCamp:typeof camp){tell=status;before=flushLive;after=reloadLive;enter=open;camp=openCamp;
 let recovery=document.getElementById('world-write-recovery');
 if(!recovery){recovery=document.createElement('div');recovery.id='world-write-recovery';recovery.hidden=true;recovery.innerHTML='<span>Die Weltänderung ist noch unklar. Eingaben bleiben offen.</span> <button id="world-write-check">Auftrag prüfen</button>';el('status').after(recovery);}
 el('world-write-check').onclick=()=>{void reconcileWorldWrite();};

 const terrainOptions=Object.entries(terrainNames).map(([id,name])=>`<option value="${id}">${name}</option>`).join(''),climateOptions=Object.entries(climateNames).map(([id,name])=>`<option value="${id}">${name}</option>`).join('');
 el('world').innerHTML=`<div class="catalog-heading"><h2>Atlas, Reise und Kalender</h2></div><div id="world-travel-home"></div><div id="world-travel-owner"><div class="toolbar world-map-selection"><label>Karte<select id="world-map-select"></select></label><button id="world-map-new">Neue Hexkarte</button><button id="world-map-copy">Karte duplizieren</button><label class="world-scene-selection">Gruppe<select id="world-scene"></select></label><button id="world-group-center">Zur Gruppe</button></div><p id="world-current"></p><div id="world-map-workspace" hidden><div class="world-columns world-map-columns"><section class="world-map-canvas"><div class="world-authoring world-map-title"><label>Kartenname<input id="world-map-name" form="world-map-form" required></label><button type="submit" form="world-map-form">Karte speichern</button></div><div class="toolbar"><button id="world-zoom-in">+ Näher</button><button id="world-zoom-out">− Weiter</button><button id="world-view-reset" type="button">Ansicht zurücksetzen</button></div><div id="hex-author-tools" class="toolbar world-authoring"><label class="check-label"><input id="hex-paint" type="checkbox"> Gelände malen</label><select id="hex-brush" aria-label="Pinselgelände">${terrainOptions}</select><label>Radius (Hexes)<input id="hex-brush-radius" type="number" min="0" max="5" value="0"></label></div><svg id="world-map" tabindex="0" role="group" aria-label="Bearbeitbare Hexkarte mit Orten und Partyposition"></svg><details class="world-map-navigation"><summary>Verschieben und Tastatur</summary><div class="toolbar world-map-pan"><button data-world-pan="-5,0">←</button><button data-world-pan="0,-5">↑</button><button data-world-pan="0,5">↓</button><button data-world-pan="5,0">→</button></div><span id="world-scale"></span><label class="check-label"><input id="world-passive" type="checkbox"> Wissen der Gruppe anzeigen</label><p id="world-map-gesture-hint" class="caption"></p></details><details class="world-authoring"><summary>Karteneinstellungen und Austausch</summary><label>Bearbeitungsraster<select id="world-edit-level">${Array.from({length:13},(_,i)=>`<option value="${i}">${i===0?'Lokale Hexes':'Stufe '+i+' · '+2**i+'× Hexgröße'}</option>`).join('')}</select></label><p class="caption">Gröbere Raster haben eigene Geländeeinträge. Zoomen oben ändert nur die Ansicht.</p><form id="world-map-form"><div class="time-fields"><label>Lokales Hex in km<input id="world-hex-size" type="number" min=".001" step="any"></label><label>Fallbackklima<select id="world-climate">${climateOptions}</select></label></div><label>Wettermuster<input id="world-seed"></label></form><div class="toolbar"><button id="world-map-export">Kartendaten anzeigen</button><button id="world-map-import">Als neue Karte übernehmen</button></div><textarea id="world-map-json" rows="5" aria-label="Kartendaten zum Kopieren oder Importieren"></textarea></details></section><section class="world-authoring"><h3 id="hex-selected"></h3><p id="hex-authored-status" class="caption"></p><form id="hex-form"><label>Beschriftung<input id="hex-label"></label><details><summary>Gelände und Reiseeigenschaften</summary><div class="time-fields"><label>Gelände<select id="hex-terrain">${terrainOptions}</select></label><label>Höhe (m)<input id="hex-elevation" type="number" value="0"></label></div><label>Regionales Klima<select id="hex-climate"><option value="">Kartenklima erben</option>${climateOptions}</select></label><div class="toolbar"><label class="check-label"><input id="hex-road" type="checkbox"> Straße</label><label class="check-label"><input id="hex-river" type="checkbox"> Fluss</label></div><label>Fraktion / Einfluss<input id="hex-faction"></label><label>Reiseunterbrechung<textarea id="hex-interrupt" rows="2" placeholder="Zum Beispiel: Weg blockiert – GM entscheidet."></textarea></label></details><button type="submit">Hex speichern</button></form><section class="world-marker-editor"><h3>Ortsmarker</h3><label>Orte suchen<input id="world-anchor-search" type="search" placeholder="Name, Stadttyp oder Kartenname"></label><label>Ort<select id="world-anchor-location"></select></label><div class="toolbar"><button id="world-anchor-focus" type="button">Marker zeigen</button><button id="world-anchor-save" type="button">Ort auf diesem Hex platzieren</button></div><p id="world-marker-status" class="caption" role="status"></p><form id="world-marker-form"><fieldset id="world-marker-fields"><legend>Kartendarstellung</legend><label>Beschriftung überschreiben<input id="world-marker-title" maxlength="200" placeholder="Ortsname verwenden"></label><label>Symbol<select id="world-marker-symbol">${markerSymbols.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select></label><label>Markergröße<input id="world-marker-size" type="range" min="0.5" max="3" step="0.05" value="1"></label><label>Beschriftungsposition<select id="world-marker-label-position"><option value="above">Über dem Symbol</option><option value="below">Unter dem Symbol</option><option value="right">Rechts neben dem Symbol</option><option value="hidden">Ausgeblendet</option></select></label><label>Beschriftung krümmen<input id="world-marker-curve" type="range" min="-1" max="1" step="0.05" value="0"></label><button type="submit">Darstellung speichern</button><button id="world-marker-reset" type="button">Standarddarstellung</button></fieldset></form></section><div class="toolbar"><button id="world-place-group">Gruppe hier platzieren</button><button id="world-reveal">Für diese Gruppe aufdecken</button></div><p class="caption">Platzieren ändert keine Reisezeit. Zum Reisen die Vorschau annehmen und Abschnitte bestätigen.</p></section></div><section class="world-travel"><h3>Reise der ausgewählten Gruppe</h3><div class="toolbar"><button id="travel-mode-edit" type="button" aria-pressed="true">Karte bearbeiten</button><button id="travel-mode-target" type="button" aria-pressed="false">Ziel wählen</button><button id="travel-mode-route" type="button" aria-pressed="false">Wegpunkte wählen</button><button id="travel-route-clear" type="button">Route leeren</button></div><p id="travel-draft-status"></p><button id="travel-place-cursor" type="button">Gruppe am Cursor platzieren</button><ol id="travel-stops"></ol><p id="travel-evaluation">Keine aktuelle Routenauswertung.</p><form id="world-travel-form"><label>Ziel<select id="world-destination"><option value="">Hex aus Karte oder Koordinaten</option></select></label><label class="check-label"><input id="travel-party-pace" type="checkbox" checked> Tempo aus der langsamsten Figur ableiten</label><p id="travel-pace-context" class="caption" role="status"></p><div class="combat-fields"><label>Ziel q<input id="travel-q" type="number" value="0"></label><label>Ziel r<input id="travel-r" type="number" value="0"></label><label>Tempo (km/h)<input id="travel-pace" type="number" value="4" min=".1" step="any"></label><label>Zeitfaktor<input id="travel-factor" type="number" value="1" min=".01" step="any"></label></div><div class="time-fields"><label>Wegpunkte q,r; q,r (optional)<input id="travel-waypoints" placeholder="1,0; 2,1"></label><label>Enddauer in Stunden (optional; hat Vorrang)<input id="travel-final-hours" type="number" min=".001" step="any"></label></div><button id="travel-preview-open" type="submit">Route und Reisezeit ansehen</button></form><p id="world-journey-status"></p><p id="world-journey-refresh" role="status"></p><div class="toolbar"><button id="journey-play" type="button" aria-label="Reise wiedergeben">▶ Wiedergeben</button><button id="journey-slower" type="button" aria-label="Reise langsamer wiedergeben">−</button><output id="journey-speed" aria-label="Wiedergabegeschwindigkeit">1×</output><button id="journey-faster" type="button" aria-label="Reise schneller wiedergeben">+</button></div><p id="journey-playback-status" role="status"></p><div class="toolbar"><button id="journey-step">Nächsten Abschnitt bestätigen</button><button id="journey-many">Bis zur nächsten Grenze weiter</button><button id="journey-pause">Pause</button><button id="journey-resume">Fortsetzen / Hinweis aufgelöst</button><button id="journey-end">Reise beenden</button><button id="journey-replan">Restweg neu bewerten…</button><button id="journey-wait">Pausieren / warten…</button><button id="journey-rest">Pausieren / rasten…</button></div><div id="world-relevant-events"></div><details><summary>Reise- und Weltverlauf</summary><div id="world-history"></div></details></section></div></div></div><div class="world-columns"><section><h3>Kampagnenkalender</h3><form id="calendar-form"><label>Name<input id="calendar-name" required></label><div class="time-fields"><label>Erstes Jahr<input id="calendar-year" type="number" value="1"></label><label>Stunden je Tag<input id="calendar-hours" type="number" min="1" max="168" value="24"></label></div><label>Monate: Name: Tage (eine Zeile je Monat)<textarea id="calendar-months" rows="8"></textarea></label><label>Wochentage, kommagetrennt<input id="calendar-weekdays"></label><button type="submit">Kalender speichern</button></form><p class="caption">Der Kalender deutet gespeicherte Zeitpunkte. Ein Kalenderwechsel verschiebt keine aufgezeichnete Reise.</p><h3>Feiertage und Ereignisse</h3><button id="world-agenda-open" type="button">Ereignisse und Papierkorb öffnen…</button></section><section><h3>Bewegte Wetterereignisse</h3><p>Klima und Jahreszeit bilden den Grundzustand. Eigene Wettergebiete ergänzen ihn; eine GM-Vorgabe für eine Gruppe bleibt bis zur Freigabe bestehen.</p><select id="phen-select"></select><button id="phen-new">Neues Wettergebiet</button><form id="phen-editor" hidden><label>Name<input id="phen-name"></label><div class="combat-fields"><label>Wetter<select id="phen-kind"><option value="storm">Sturm</option><option value="rain">Regen</option><option value="snow">Schnee</option><option value="fog">Nebel</option><option value="clouds">Bewölkt</option><option value="clear">Klar</option></select></label><label>Intensität (%)<input id="phen-intensity" type="number" min="0" max="100"></label><label>Gebietsradius in Hexes<input id="phen-radius" type="number" min=".1" step="any"></label><label>Status<select id="phen-state"><option value="active">Aktiv</option><option value="paused">Pausiert</option><option value="ended">Beendet</option></select></label></div><div class="combat-fields"><label>Zentrum q<input id="phen-q" type="number"></label><label>Zentrum r<input id="phen-r" type="number"></label><label>Bewegung q / 24 Stunden<input id="phen-move-q" type="number" step="any"></label><label>Bewegung r / 24 Stunden<input id="phen-move-r" type="number" step="any"></label></div><div class="combat-fields"><label>Beginn: Tage seit Start<input id="phen-start" type="number" min="0" step="any"></label><label>Dauer in Tagen<input id="phen-duration" type="number" min=".001" step="any"></label><label>Temperatur °C (optional)<input id="phen-temperature" type="number" step="any"></label><label>Reisefaktor (optional)<input id="phen-travel" type="number" min=".1" step="any"></label></div><label>Hinweise / Effekte<textarea id="phen-notes" rows="3"></textarea></label><button type="submit">Wettergebiet speichern</button></form></section></div><dialog id="travel-preview-dialog"><h2>Reisevorschau</h2><p id="travel-preview-summary"></p><div id="travel-preview-warnings"></div><div id="travel-preview-itinerary"></div><div class="actions"><button id="travel-preview-cancel">Abbrechen</button><button id="travel-preview-accept">Reise annehmen</button></div></dialog>`;
 el('live-world-panel').innerHTML=`<h3>Weltzeit und Wetter</h3><p id="live-world-summary"></p><button id="live-agenda-open" type="button">Agenda / Fristen…</button><div id="live-agenda-upcoming"></div><p id="live-weather-effects" class="caption"></p><div id="live-world-notices"></div><div class="toolbar"><button id="live-travel-toggle" type="button" aria-expanded="false" aria-controls="live-travel-host">Reisekarte am Spieltisch</button><button id="live-open-world">Atlas bearbeiten</button></div><div id="live-travel-host" hidden><p id="live-travel-context" class="caption"></p><p id="live-travel-empty" hidden>Noch keine Hexkarte. Lege im Atlas eine Karte an und platziere die Gruppe.</p></div><details><summary>Wetter für diese Gruppe vorgeben</summary><form id="weather-override-form"><div class="combat-fields"><label>Wetter<select id="weather-override-kind"><option value="clear">Klar</option><option value="clouds">Bewölkt</option><option value="rain">Regen</option><option value="snow">Schnee</option><option value="fog">Nebel</option><option value="storm">Sturm</option></select></label><label>Intensität (%)<input id="weather-override-intensity" type="number" min="0" max="100" value="70"></label><label>Temperatur °C<input id="weather-override-temperature" type="number" value="15"></label><label>Reisefaktor<input id="weather-override-factor" type="number" min=".1" step="any" value="1"></label></div><label>GM-Hinweis<input id="weather-override-notes"></label><div class="toolbar"><button type="submit">GM-Wetter übernehmen</button><button id="weather-discard-input" type="button">Eigene Eingabe verwerfen</button><button id="weather-release" type="button">Wetterautomatik freigeben</button></div></form></details>`;
 el('world-travel-owner').append(el('travel-preview-dialog'));
 // Keep one set of map/travel controls; arrange it by the GM's current task.
 const columns=el('world-map-workspace').querySelector('.world-map-columns')!;
 const travel=el('world-map-workspace').querySelector<HTMLElement>('.world-travel')!;
 const modes=el('travel-mode-edit').parentElement!;modes.id='world-map-modes';
 el('world-map-workspace').prepend(modes);columns.append(travel);
 const advanced=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Koordinaten, Tempo und Dauer';advanced.id='travel-advanced';advanced.append(summary);
 const form=el('world-travel-form');for(const fields of [...form.querySelectorAll<HTMLElement>(':scope > .combat-fields,:scope > .time-fields')])advanced.append(fields);form.insertBefore(advanced,el('travel-preview-open'));
 el('journey-step').parentElement!.id='journey-controls';
 el('live-travel-toggle').onclick=()=>run(toggleLiveTravel);
 const mapInput=()=>{dirtyMap=true;edits.map++;},cellInput=()=>{dirtyCell=true;edits.map++;},calendarInput=()=>{dirtyCalendar=true;edits.calendar++;},phenomenonInput=()=>{dirtyPhenomenon=true;edits.phenomenon++;};
 el('world-map-name').oninput=mapInput;
 for(const [id,input] of [['world-map-form',mapInput],['hex-form',cellInput],['calendar-form',calendarInput],['phen-editor',phenomenonInput]] as const){el(id).oninput=input;}
 for(const id of ['world-map-form','hex-form','calendar-form','phen-editor'])el(id).onsubmit=e=>{e.preventDefault();run(async()=>{if(await flushWorld()){await reloadScene();renderMapFields();renderMap();renderCell();renderCalendar();renderJourney();renderPhenomenonOptions();await after();tell('Welt und Reise gespeichert.');}});};
 el('world-map-new').onclick=()=>run(async()=>{if(!(await flushWorld()))return;const m:AtlasMap={id:crypto.randomUUID(),revision:0,name:'Neue Region',hexMeters:4828.032,climate:'temperate',seed:crypto.randomUUID(),cells:[]};await raw({kind:'map',map:m,expectedRevision:null});await openWorld();resetRouteDraft();el<HTMLSelectElement>('world-map-select').value=m.id;mapDraft=structuredClone(world!.maps.find(p=>p.id===m.id)!);center={q:0,r:0};selected={q:0,r:0};renderMapFields();renderMap();renderCell();});
 el('world-map-copy').onclick=()=>run(async()=>{if(!(await flushWorld())||!mapDraft)return;const m={...structuredClone(mapDraft),id:crypto.randomUUID(),revision:0,name:mapDraft.name+' – Kopie'};await raw({kind:'map',map:m,expectedRevision:null});await openWorld();resetRouteDraft();el<HTMLSelectElement>('world-map-select').value=m.id;mapDraft=structuredClone(world!.maps.find(p=>p.id===m.id)!);center={q:0,r:0};selected={q:0,r:0};renderMapFields();renderMap();renderCell();});
 el('world-map-select').onchange=()=>run(async()=>{playback.stop();const id=value('world-map-select');resetRouteDraft();if(!(await flushWorld()))return;mapDraft=structuredClone(world!.maps.find(m=>m.id===id)!);center={q:0,r:0};selected={q:0,r:0};preview=null;renderMapFields();renderMap();renderCell();renderPhenomenonOptions();});el('world-scene').onchange=()=>{playback.stop();resetRouteDraft();run(async()=>{if(await flushWorld()){await reloadScene();renderJourney();renderMap();}});};
 window.addEventListener('resize',()=>{suspendMapPointer();renderMap();});
 const zoom=(delta:number)=>{suspendMapPointer();worldCanvas?.zoom(1.25**delta);};el('world-zoom-in').onclick=()=>zoom(-1);el('world-zoom-out').onclick=()=>zoom(1);el('world-view-reset').onclick=()=>{suspendMapPointer();viewZoom=1;center={q:0,r:0};canvasBasis='';renderMap();};el('world-edit-level').onchange=()=>{const next=Number(value('world-edit-level'));run(async()=>{if(!(await flushWorld())){el<HTMLSelectElement>('world-edit-level').value=String(level);return;}mapGestures?.finish();const p=hexPoint(center,2**level),cursor=hexPoint(routeCursor,2**level),selection=hexPoint(selected,2**level);level=next;routeCursor=pointHex(cursor.x,cursor.y,2**level);center=pointHex(p.x,p.y,2**level);selected=pointHex(selection.x,selection.y,2**level);renderMap();renderCell();});};for(const b of el('world').querySelectorAll<HTMLButtonElement>('[data-world-pan]'))b.onclick=()=>{suspendMapPointer();const [q,r]=b.dataset.worldPan!.split(',').map(Number),shift=hexPoint({q:q!,r:r!});worldCanvas?.pan(shift.x*100,shift.y*100);};el('world-passive').onchange=renderMap;
 const canvas=el('world-map') as unknown as SVGSVGElement,tools=document.createElement('div');tools.innerHTML='<button id="hex-paint-undo" type="button" disabled aria-label="Geländestrich zurücknehmen" title="Geländestrich zurücknehmen (Strg+Z)">↶</button><button id="hex-paint-redo" type="button" disabled aria-label="Geländestrich wiederholen" title="Geländestrich wiederholen (Strg+Umschalt+Z)">↷</button><span id="hex-paint-status" role="status"></span>';el('hex-author-tools').append(...tools.children);const gestureHint=el('world-map-gesture-hint');gestureHint.textContent='Karte ziehen zum Verschieben, Mausrad zum Zoomen. Mit Gelände malen zeichnet Ziehen einen zusammenhängenden Strich; Alt oder mittlere Maustaste verschiebt auch bei aktivem Pinsel. Auf der fokussierten Karte: Pfeiltasten wählen Hexes, Alt+Pfeiltasten verschieben; Strg+Z und Strg+Umschalt+Z.';
 // Settle only the adopter's local draft before the shared surface changes CTM.
 canvas.addEventListener('wheel',e=>{if(e.deltaY)suspendMapPointer();},{capture:true,passive:true});
 canvas.addEventListener('pointerdown',e=>{if(e.button===1||e.button===0&&e.altKey)suspendMapPointer();},true);
 worldCanvas=new PassiveMapCanvas(canvas,{initial:hexCameraBox(),minWidth:520,maxWidth:3120,locked:()=>!!mapGestures?.active,pan:e=>e.button===1||e.button===0&&routeMode==='edit'&&(!el<HTMLInputElement>('hex-paint').checked||e.altKey),changed:box=>{viewZoom=1560/box.width;center=pointHex((box.x+box.width/2)/100,(box.y+box.height/2)/100);canvasBasis=cameraBasis();renderMap();}});
 mapGestures=installHexMapGestures(canvas,{state:()=>workspace&&mapDraft?{owner:workspace.token,map:mapDraft,level,center:{...center},mode:routeMode,paint:el<HTMLInputElement>('hex-paint').checked,terrain:value('hex-brush') as Terrain,radius:Math.max(0,Math.min(5,Math.floor(number('hex-brush-radius'))))}:null,prepare:()=>{if(pending||uncertain||worldWrites.size){tell('Kartenspeicherung zuerst abschließen.',true);return false;}if(dirtyCell)collectCell();return true;},pan:h=>{const delta=hexPoint({q:h.q-center.q,r:h.r-center.r});worldCanvas?.cancel();worldCanvas?.pan(delta.x*100,delta.y*100);},select:h=>{selected=h;routeCursor=h;},render:()=>{renderMap();renderCell();},changed:()=>{dirtyMap=true;edits.map++;},commit:()=>Promise.resolve().then(()=>flushWorld()),tell});

 el('world-group-center').onclick=()=>run(async()=>{if(!(await flushWorld()))return;await reloadScene();if(!frame?.position.mapId)return;if(mapDraft?.id!==frame.position.mapId)resetRouteDraft();mapDraft=structuredClone(world!.maps.find(m=>m.id===frame!.position.mapId)!);el<HTMLSelectElement>('world-map-select').value=mapDraft.id;const p=hexPoint(frame.position);center=pointHex(p.x,p.y,2**level);selected=center;routeCursor={...center};canvasBasis='';renderMapFields();renderMap();renderCell();});
 const localHex=()=>{const p=hexPoint(selected,2**level);return pointHex(p.x,p.y);};el('world-anchor-save').onclick=()=>run(async()=>{if(!mapDraft||!value('world-anchor-location'))throw new Error('Karte und Ort auswählen.');const old=world?.places.find(p=>p.locationId===value('world-anchor-location'));await action({kind:'place',mapId:mapDraft.id,locationId:value('world-anchor-location'),expectedRevision:old?.revision??null,hex:localHex()});renderLocationOptions();loadMarkerEditor();});
 el('world-anchor-search').oninput=renderLocationOptions;
 el('world-anchor-location').onchange=()=>{
  const id=value('world-anchor-location'),token=workspace?.token,request=++markerSelection;
  // Keep identity and fields together while the old marker's save is unresolved.
  el<HTMLSelectElement>('world-anchor-location').value=markerDraft?.id??'';
  el<HTMLFieldSetElement>('world-marker-fields').disabled=true;
  el('world-marker-status').textContent='Markerauswahl wird übernommen …';
  run(async()=>{
   const saved=await flushMarker();
   if(workspace?.token!==token||request!==markerSelection)return;
   if(!saved){el<HTMLSelectElement>('world-anchor-location').value=markerDraft?.id??'';el<HTMLFieldSetElement>('world-marker-fields').disabled=!markerDraft;el('world-marker-status').textContent='Markerwechsel nicht übernommen. Speicherstatus prüfen; bisheriger Ort bleibt ausgewählt.';return;}
   el<HTMLSelectElement>('world-anchor-location').value=id;loadMarkerEditor();renderMap();
  });
 };
 el('world-anchor-focus').onclick=()=>run(async()=>{if(!await flushWorld())return;const place=world?.places.find(p=>p.locationId===value('world-anchor-location'));if(!place)return;if(mapDraft?.id!==place.mapId)resetRouteDraft();mapDraft=structuredClone(world!.maps.find(m=>m.id===place.mapId)!);el<HTMLSelectElement>('world-map-select').value=mapDraft.id;const p=hexPoint(place);selected=pointHex(p.x,p.y,2**level);center={...selected};routeCursor={...selected};canvasBasis='';renderMapFields();renderMap();renderCell();renderPhenomenonOptions();});
 for(const id of ['title','symbol','size','label-position','curve']){const input=el<HTMLInputElement>('world-marker-'+id);input.oninput=collectMarker;input.onchange=()=>{collectMarker();run(flushMarker);};input.onblur=()=>run(flushMarker);if(input.type==='range')input.onpointerup=()=>run(flushMarker);}
 el('world-marker-form').onsubmit=event=>{event.preventDefault();run(flushMarker);};
 el('world-marker-reset').onclick=()=>{if(!markerDraft)return;for(const [key,v]of Object.entries({'title':'','symbol':'pin','size':'1','label-position':'above','curve':'0'}))el<HTMLInputElement>('world-marker-'+key).value=v;collectMarker();run(flushMarker);};
 el('world-place-group').onclick=()=>run(async()=>{if(!mapDraft||!frame)throw new Error('Karte und aktive Gruppe auswählen.');const h=localHex(),loc=world?.places.find(p=>p.mapId===mapDraft!.id&&!p.trashed&&hexKey(p)===hexKey(h));await action({kind:'place-scene',sceneId:frame.scene.id,expectedSceneRevision:frame.scene.revision,expectedPositionRevision:frame.position.revision,position:{...h,mapId:mapDraft.id,locationId:loc?.locationId??null}});});el('world-reveal').onclick=()=>run(async()=>{if(!mapDraft||!frame)return;await action({kind:'reveal',sceneId:frame.scene.id,mapId:mapDraft.id,hex:localHex(),expectedMembershipRevision:frame.scene.membershipRevision});});
 el('world-destination').onchange=()=>{clearTravelPreview();const place=world?.places.find(p=>p.locationId===value('world-destination')),base=hexPoint(selected,2**level),target=place??pointHex(base.x,base.y);el<HTMLInputElement>('travel-q').value=String(target.q);el<HTMLInputElement>('travel-r').value=String(target.r);readRouteInputs();};
 for(const id of ['travel-q','travel-r'])el(id).oninput=()=>{el<HTMLSelectElement>('world-destination').value='';clearTravelPreview();};
 el<HTMLInputElement>('travel-party-pace').checked=true;
 el('travel-party-pace').onchange=()=>{clearTravelPreview();renderPartyPace();};
 el('travel-pace').oninput=()=>{el<HTMLInputElement>('travel-party-pace').checked=false;el<HTMLInputElement>('travel-pace').disabled=false;};
 el('world-travel-form').oninput=()=>{clearTravelPreview();readRouteInputs();};
 el('world-travel-form').onsubmit=e=>{e.preventDefault();void makeTravelPreview();};
 el('travel-preview-cancel').onclick=()=>{clearTravelPreview();renderMap();};
 for(const mode of ['edit','target','route'] as const)el('travel-mode-'+mode).onclick=()=>{if(mode==='edit'&&liveTravelOpen&&liveSurface)return;routeMode=mode;const last=routeStops.at(-1);if(last){const p=hexPoint(last);routeCursor=pointHex(p.x,p.y,2**level);}else routeCursor={...selected};clearTravelPreview();renderRouteDraft();renderMap();};el('travel-route-clear').onclick=()=>{resetRouteDraft();renderMap();};el('travel-place-cursor').onclick=()=>run(placeRouteCursor);el('world-map').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(routeMode!=='edit')run(()=>chooseRouteHex(routeCursor));return;}const moves:Record<string,Hex>={ArrowLeft:{q:-1,r:0},ArrowRight:{q:1,r:0},ArrowUp:{q:0,r:-1},ArrowDown:{q:0,r:1}};const delta=moves[event.key];if(!delta)return;event.preventDefault();routeCursor={q:routeCursor.q+delta.q,r:routeCursor.r+delta.r};if(hexDistance(routeCursor,center)>Math.max(1,5/viewZoom))center={...routeCursor};if(routeMode==='edit'){run(async()=>{if(!await flushWorld())return;selected={...routeCursor};renderCell();renderMap();});}else{renderRouteDraft();renderMap();}});
 el('travel-preview-accept').onclick=()=>{void acceptTravelPreview();};el('journey-replan').onclick=()=>run(replanRemainingJourney);el('journey-wait').onclick=()=>run(()=>openTravelCamp('wait'));el('journey-rest').onclick=()=>run(()=>openTravelCamp('rest'));
 for(const [id,kind]of [['journey-play','play'],['journey-step','step'],['journey-many','many'],['journey-pause','pause'],['journey-resume','play'],['journey-end','end']] as const)el(id).onclick=()=>run(()=>transport(kind));
 for(const [id,delta]of [['journey-slower',-1],['journey-faster',1]] as const)el(id).onclick=()=>playback.setSpeed(journeySpeeds[Math.max(0,Math.min(3,journeySpeeds.indexOf(playback.speed)+delta))]!);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')playback.stop();});
 el('world-map-export').onclick=()=>run(async()=>{if(await flushWorld())el<HTMLTextAreaElement>('world-map-json').value=JSON.stringify(mapDraft,null,2);});el('world-map-import').onclick=()=>run(async()=>{if(!(await flushWorld()))return;const m=JSON.parse(value('world-map-json')) as AtlasMap;await raw({kind:'map',map:{...m,id:crypto.randomUUID(),revision:0},expectedRevision:null});await openWorld();});

 el('phen-new').onclick=()=>run(async()=>{if(!(await flushWorld())||!mapDraft)return;phenomenonDraft={id:crypto.randomUUID(),revision:0,mapId:mapDraft.id,name:'',kind:'storm',intensity:.7,center:localHex(),radiusHexes:3,movement:{q:0,r:0},startMs:frame?.scene.clock.instantMs??'0',durationMs:daysMs(2),state:'active',pausedAtMs:null,temperatureC:null,travelFactor:null,notes:''};renderPhenomenon();});el('phen-select').onchange=()=>run(async()=>{const id=value('phen-select');if(await flushWorld()){phenomenonDraft=world?.phenomena.find(p=>p.id===id)??null;renderPhenomenon();}});
 el('live-open-world').onclick=()=>run(enter);
 el('weather-override-form').oninput=()=>{weatherDirty=true;weatherEdits++;try{weatherBasis??=weatherOwner();}catch(error){tell((error as Error).message,true);}};
 el('weather-override-form').onsubmit=e=>{e.preventDefault();try{const kind=value('weather-override-kind') as Weather['kind'],intensity=number('weather-override-intensity')/100,effects=weatherEffects(kind,intensity,number('weather-override-temperature'));effects.travelFactor=number('weather-override-factor');effects.combatNote=value('weather-override-notes');const weather:Weather={kind,label:el<HTMLSelectElement>('weather-override-kind').selectedOptions[0]!.textContent!,intensity,windKmh:0,effects,source:'GM-Override'};run(()=>submitWeather(weather));}catch(error){tell((error as Error).message,true);}};
 el('weather-release').onclick=()=>run(()=>submitWeather(null));el('weather-discard-input').onclick=()=>run(discardWeatherInput);
}

export async function saveAgendaEvent(event:CalendarEvent,expectedRevision:number|null,basis:import('./agenda-contracts').AgendaBasis,token:string,stillCurrent:()=>boolean=()=>true){if(workspace?.token!==token||!stillCurrent()||!await flushWorld())throw new Error('Offene Welt-Eingaben zuerst abschließen.');const ack=await raw({kind:'calendar-event',event,expectedRevision,basis},()=>workspace?.token===token&&stillCurrent());const saved=ack.world.events.find(e=>e.id===event.id);if(!saved||saved.revision!==(expectedRevision??0)+1)throw new Error('Ereignisbestätigung fehlt.');try{await after();}catch(e){tell('Ereignis gespeichert; Live-Anzeige später aktualisieren: '+(e as Error).message,true);}return saved;}

async function renderLiveAgenda(token:string,sceneId:string,request:number){const root=document.getElementById('live-agenda-upcoming');if(!root)return;root.replaceChildren();try{const result=unwrap(await window.campaign.agenda(token,{sceneId,search:'',location:'current',horizonDays:1,includePast:false,after:null}));if(workspace?.token!==token||request!==liveRequest)return;for(const item of result.items.slice(0,3)){const p=document.createElement('p'),delta=String(BigInt(item.state==='active'?item.endMs:item.startMs)-BigInt(result.scene?.instantMs??'0'));p.textContent=item.event.name+' · '+(item.state==='active'?'jetzt aktiv, noch ':'in ')+agendaCountdown(result.calendar,delta);root.append(p);}if(!result.items.length){const p=document.createElement('p');p.className='caption';p.textContent='Keine Kalenderereignisse am Gruppenort im nächsten Tag.';root.append(p);}}catch(e){if(workspace?.token===token&&request===liveRequest)root.textContent='Agenda nicht verfügbar: '+(e as Error).message;}}

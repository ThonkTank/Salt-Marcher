import {initUpdateUI} from './update-ui';
import {atlasFieldValue,setAtlasFieldValue} from './atlas-units';
import {editTextareaText} from './key-reading-model';
import {initNumberInputScroll} from './number-input-scroll';
import {workspaceGeometryOnly as geometryOnly} from './atlas-render-view';
import {RoomDirectoryView} from './room-directory-ui';
import {atlasDefaultRoomWrite} from "./campaign-atlas-author";
import {setLiveAtlasSurface} from './live-hex-surface';
import {CampaignAtlasWorkbench} from './campaign-atlas-ui';
import {atlasRoomWrite,atlasHistoryWrite} from './campaign-atlas-author';
import {initCampaignScreen,openCampaignScreen,hideCampaignScreen} from './campaign-screen-ui';
import {PassiveMapCanvas} from './passive-map-canvas';
import {roomCameraBox} from './room-camera';
import {appendRoomNumber} from './room-number-label';
import {initWorkspaceNavigation,syncWorkspaceNavigation} from './workspace-navigation';
import {WorkspacePositions,workspaceTabs,readWorkspaceView,rememberWorkspaceView,type WorkspaceTab} from './workspace-view';
import {bindAtlasHistoryShortcut} from './workspace-shortcuts';
import {chooseNpcPlace} from './npc-places-ui';
import {openGenerationSource} from './generation-ui';
import {setLocationNotebookNavigation} from './preparation';
import {LocationNotebook} from './location-notebook-ui';
import {WorldLinksWorkbench} from './world-links-ui';
import {CampaignAgenda} from './agenda-ui';
import {initSoundboard,activateSoundboard} from './live-soundboard-ui';
import {initQuickReference,activateQuickReference,inspectQuickReference} from './quick-reference-ui';
import {initNarrativeJournal,activateNarrativeJournal} from './narrative-journal-ui';
import {closeSessionPacket,openPreparationSessionPacket,setSessionPacketSurface} from './session-packet-ui';
import {initPartyTopbar,activatePartyTopbar} from './party-topbar-ui';
import {initDayCalculator,activateDayCalculator} from './adventuring-day-ui';
import {initNpcs,activateNpcs,openNpcs,openNpcProfile,createNpcAtLocation,prepareNpcLocation,setNpcPlaceNavigation,flushNpcs} from './npc-ui';
import {initGroups,activateGroups,openGroups,prepareGroupLocation,createGroupAtLocation,flushGroups} from './groups-ui';
import {refreshProgress} from './progression-ui';
import {initTreasury,activateTreasury,openTreasury,flushTreasury} from './treasury-ui';
import {openExistingCombat,setCombatNpcNavigation} from './combat';
import {initTriggers,activateTriggers,flushTriggers} from './trigger-ui';
import {initExtensions} from './extensions-ui';
import {initDungeonContent,activateDungeonContent,flushDungeonContent} from './dungeon-content-ui';
import {initGraph,canLeaveGraphPreview,activateGraph,flushGraph,syncGraphBanner,refreshOpenGraph} from './graph-ui';
import {initKeys,activateKeys,flushKeys} from './key-ui';
import {setKeyReferenceStatus,openNoteRoomKey,openRoomKey} from './key-ui';
import {initPaths,activatePaths,flushPaths} from './path-ui';
import {initCommitControls} from './commit-confirmation';
import {initVolume,activateVolume,flushVolume} from './volume-ui';
import {DungeonBinder} from './dungeon-binder-ui';
import {initDungeon,activateDungeon,openDungeon,flushDungeon,selectDungeonRoom} from './dungeon-ui';
import {initDrawing,activateDrawing,reloadDrawing,drawingOverlay,syncDrawingControls,roomDrawingStyle,flushDrawing} from './drawing-ui';
import {initAutonomy,activateAutonomy,openAutonomy,flushAutonomy} from './autonomy-ui';
import {initPlayerUI,deactivatePlayer} from './player-ui';
import {initCity,activateCity,openCity,prepareCityPersonBinding,flushCity} from './city-ui';
import {initCampaignManager} from './campaign-manager-ui';
import {initMusic,activateMusic,openMusic,flushMusic,deactivateMusic} from './music-ui';
import {initWorld,activateWorld,openWorld,openWorldCalendar,flushWorld,setWorldSurface,stopWorldPlayback} from './world-ui';
import {initItems,activateItems,openItems,openItemReference,createShopAtLocation,prepareShopLocation,flushItems} from './items-ui';
import { validateRoom, type Room, type RoomGeometry, type WorkspaceGeometry, type Result, type DungeonImportPreview, type Edit, type CampaignRename } from './contracts';
import { activatePreparation, ensurePreparation, initPreparation, flushPreparation, leavePreparation, preparationHasDrafts, openPreparedLocation,openPreparedNote,createNarrativeAtLocation,prepareNoteLocation,openPreparedVisit,openPreparedPlan,prepareNextVisit,showDayPreparation } from './preparation';
import {setNoteRoomNavigation} from './preparation';
import { activateLive, initLive, flushLive,refreshScenePreparation,setGroupNavigation,setNpcNavigation,setTreasureNavigation, openLive,openLiveCharacterLoot,openPlannedVisitReview,prepareLiveEncounter, addLiveCreature,addLiveNpc,openLiveSoundboard,openTimeNavigator,openTravelRest,useLiveReferenceReadAloud } from './live';
import { initTutorial } from './tutorial';
import { initCatalog, activateCatalog, openCatalog, openCatalogReference, flushCatalog } from './catalog-ui';
import {suspendChronicle,initChronicle,activateChronicle,openChronicle} from './chronicle-ui';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const api = window.campaign;
initNumberInputScroll(document);
const setWorkspaceAvailable = (available: boolean) => document.body.classList.toggle('has-workspace', available);
let workspace: WorkspaceGeometry | null = null;
let activeTab: WorkspaceTab = 'atlas';
let campaignAtlas:CampaignAtlasWorkbench|null=null;
const workspacePositions = new WorkspacePositions();
let viewRequest = 0;
// New input owns the view, including while an area is still loading.
for (const type of ['pointerdown', 'wheel', 'keydown'])
  window.addEventListener(type, () => { viewRequest++; }, {capture: true, passive: true});
const viewStorage = {getItem: (key: string) => window.localStorage.getItem(key), setItem: (key: string, value: string) => window.localStorage.setItem(key, value)};
function rememberView() {
  if (!workspace) return;
  workspacePositions.capture(workspace.campaign.id, window.scrollY);
  // Open reference/profile sections can change the document height on restart.
  // Resume visible writing by its own position rather than a pixel in that old layout.
  const notes = activeTab === 'live' ? el('running-notes').getBoundingClientRect() : null;
  const liveNotesTop = notes && notes.height > 0 && notes.bottom > 0 && notes.top < window.innerHeight ? notes.top : undefined;
  const combat = activeTab === 'live' && !el('combat-panel').hidden ? el('combat-panel').getBoundingClientRect() : null;
  const liveCombat = combat && Math.min(combat.bottom,window.innerHeight)-Math.max(combat.top,0)>window.innerHeight/2 ? true : undefined;
  rememberWorkspaceView(viewStorage, workspace.campaign.id, {tab: activeTab, scrollY: window.scrollY, liveNotesTop, liveCombat});
}
let draft: Room | null = null;
let confirmedRoom:Room|null=null;let roomLoad=0;
let timer: ReturnType<typeof setTimeout> | null = null;
let pending: Promise<boolean> | null = null;
let composing = false;
let writeBlocked = false;
let failedEdit: Edit | null = null;
let hasRetainedDraft = false;
let roomDraftLoading = false, roomDraftReadFailed = false;
let activating = false, activationFailed = false;
let activationJob: Promise<void> | null = null, queuedActivation: {id:string;entryCommandId?:string} | null = null;
let activationIntent = 0, campaignListRequest = 0;
let pointer: { index: number; id: number; before: Room['polygons'] } | null = null;
let dungeonImportPreview: DungeonImportPreview | null = null;
let renameBasis: Omit<CampaignRename, 'commandId' | 'name'> | null = null;
const status = (text: string, error = false) => { el('status').textContent = text; el('status').dataset.error = String(error); };
initExtensions(status);
initChronicle(status,async(id,token)=>{if(!(await leaveWorkspace())||workspace?.token!==token)return;showTab('preparation');await openPreparedNote(id);});
initPreparation((text,error)=>{status(text,error);setKeyReferenceStatus(text,error);}, async scopeId => {
  if (!workspace || !(await leaveWorkspace())) return;
  const room = workspace.rooms.find(room => room.scopeId === scopeId);
  if (!room) { status('Diese Zeichnung enthält noch keinen verfügbaren Raum.', true); return; }
  await selectRoom(room.id);
  showTab('atlas');
}, async (planId, visitId, sourceCurrent=()=>true) => {
  const owner=workspace;if(!owner||!sourceCurrent()||!(await leaveWorkspace())||workspace!==owner||!sourceCurrent())return;
  closeSessionPacket();showTab('live');await openPlannedVisitReview(planId,visitId,()=>workspace===owner);
}, async(id,current)=>{const editor=el('note-editor'),mount=editor.parentElement,parent=editor.closest<HTMLDialogElement>('dialog');await inspectQuickReference({kind:'note',id},()=>current()&&editor.parentElement===mount,parent);});
setTreasureNavigation(async id=>{if(!await leaveWorkspace())return;showTab('treasury');await openTreasury(id);});
initDayCalculator(status,()=>el<HTMLButtonElement>('party-shortcut').click(),()=>el<HTMLButtonElement>('catalog-tab').click());
initPartyTopbar(()=>el<HTMLButtonElement>('live-tab').click());
initNarrativeJournal(status,leaveWorkspace,async()=>await flushPreparation(true,true),async id=>{if(!await leaveWorkspace())return;showTab('preparation');await openPreparedNote(id);});
const locationNotebook=new LocationNotebook(()=>workspace,leaveWorkspace,status,async action=>{const owner=workspace,token=owner?.token,campaignId=owner?.campaign.id,current=()=>workspace===owner&&workspace?.token===token&&workspace?.campaign.id===campaignId;if(!token||!await leaveWorkspace()||!current())return;if(action.origin)setLocationReturn(token,action.origin.id,action.origin.title);if(action.kind==='city-person'){showTab('city');await prepareCityPersonBinding(action.assignment);}else if(action.kind==='city-unit'){showTab('atlas');await campaignAtlas?.navigate('city',action.id,action.unitId);}else if(action.kind==='room'){await openNpcRoom(action.id);}else if(action.kind==='bind-material'){if(action.materialKind==='group'){showTab('groups');await prepareGroupLocation(action.id,action.locationId);}else if(action.materialKind==='npc'){showTab('groups');await openGroups();if(!current())return;await prepareNpcLocation(action.id,action.locationId);}else if(action.materialKind==='shop'){showTab('items');await prepareShopLocation(action.id,action.locationId);}else{showTab('preparation');await prepareNoteLocation(action.id,action.locationId);}}else if(action.kind==='new-material'){if(action.materialKind==='group'){showTab('groups');await openGroups();if(!current())return;await createGroupAtLocation(action.id,action.name);}else if(action.materialKind==='npc'){showTab('groups');await openGroups();if(!current())return;await createNpcAtLocation(action.id,action.name);}else if(action.materialKind==='shop'){showTab('items');await createShopAtLocation(action.id,action.name);}else{showTab('preparation');await createNarrativeAtLocation(action.id,action.name,action.materialKind);}if(current())setLocationReturn(token,action.id,action.title);}else if(action.kind==='edit'){showTab('preparation');await openPreparedLocation(action.id);}else if(action.kind==='graph')await worldLinks.open({kind:'location',id:action.id});else if(action.kind==='npc'){showTab('groups');await openGroups();if(current())await openNpcProfile(action.id,undefined,current);}else if(action.kind==='narrative'||action.kind==='faction'){showTab('preparation');await openPreparedNote(action.id);}else if(action.kind==='group'){showTab('groups');await openGroups(action.id);}else if(action.kind==='shop'){showTab('items');await openItems(action.id);}else if(action.kind==='sources'||action.kind==='faction-source'){showTab('catalog');await openGenerationSource(action.kind==='sources'?'location':'faction',action.id);}else if(action.kind==='event'||action.kind==='new-event'||action.kind==='agenda'){await campaignAgenda.openForLocation(action.kind==='event'?action.locationId:action.id,action.title,action.kind==='event'?action.id:undefined,action.kind==='new-event');}else if(action.kind==='map'){if(action.mapKind==='city'){showTab('atlas');await campaignAtlas?.navigate('city',action.id);}else{const room=workspace?.rooms.find(r=>r.scopeId===action.id);if(!room)throw new Error('Diese Zeichnung enthält noch keinen verfügbaren Raum.');showTab('atlas');await campaignAtlas?.navigate('room',room.id);}}else if(action.kind==='read-aloud'){const live=unwrap(await window.campaign.live(token));if(!current())return;if(live.focusId!==action.sceneId||live.focusRevision!==action.focusRevision)throw new Error('Fokusgruppe geändert. Ortsmappe erneut öffnen.');showTab('live');await openLive();if(!current())return;await useLiveReferenceReadAloud(action.text,action.title,action.sceneId);}});setLocationNotebookNavigation(id=>locationNotebook.open(id));const locationNotebookButton=document.createElement('button');locationNotebookButton.type='button';locationNotebookButton.id='location-notebook-open';locationNotebookButton.textContent='Ortsmappe';el('narrative-journal-open').after(locationNotebookButton);locationNotebookButton.onclick=()=>void locationNotebook.open().catch(e=>status(e.message,true));
const worldLinks=new WorldLinksWorkbench(()=>workspace,leaveWorkspace,status,async(ref,current)=>{if(!await leaveWorkspace()||!current())return;if(ref.kind==='creature'||ref.kind==='encounter'){showTab('catalog');await openCatalogReference({kind:ref.kind,id:ref.id},current);}else if(ref.kind==='item'){showTab('items');await openItemReference(ref.id,current);}else{showTab('preparation');if(ref.kind==='note')await openPreparedNote(ref.id,current);else await openPreparedLocation(ref.id,current);}});el('world-links-open').onclick=()=>void worldLinks.open().catch(e=>status(e.message,true));
async function openNpcRoom(id:string){const owner=workspace,current=()=>workspace===owner;if(!owner?.rooms.some(r=>r.id===id))throw new Error('Raum nicht mehr verfügbar.');await selectRoom(id);if(!current())return;if(workspace?.selectedId!==id)throw new Error('Raum konnte nicht geöffnet werden.');showTab('atlas');await campaignAtlas?.navigate('room',id);}
async function navigateNpcPlaces(id:string,sourceCurrent:()=>boolean=()=>true){const owner=workspace,token=owner?.token,current=()=>workspace===owner&&workspace?.token===token&&sourceCurrent();if(!token||!await leaveWorkspace()||!current())return;const site=await chooseNpcPlace(token,id);if(!site||!current())return;if(site.kind==='assign'){showTab('city');await prepareCityPersonBinding(site);}else if(site.kind==='dungeon')await openNpcRoom(site.roomId);else{showTab('atlas');await campaignAtlas?.navigate('city',site.cityId,site.unitId);}}
setNpcPlaceNavigation(navigateNpcPlaces);
const locationReturn=document.createElement('button');locationReturn.id='location-material-return';locationReturn.type='button';locationReturn.hidden=true;el('location-notebook-open').after(locationReturn);
function setLocationReturn(token:string,id:string,title:string){locationReturn.hidden=false;locationReturn.textContent='Zur Ortsmappe: '+title;locationReturn.onclick=()=>{if(workspace?.token!==token){locationReturn.hidden=true;return;}locationReturn.disabled=true;void locationNotebook.open(id).catch(e=>status(e.message,true)).finally(()=>{locationReturn.disabled=false;});};}

initQuickReference(status,leaveWorkspace,async action=>{
 const token=workspace?.token;if(!token)return;
 if(action.kind==='connections'){await worldLinks.open(action.content.ref);return;}
 if(action.kind==='source'){const ref=action.content.ref;if(ref.kind==='item'){showTab('items');await openItemReference(ref.id);}else if(ref.kind==='creature'||ref.kind==='encounter'){showTab('catalog');await openCatalogReference({kind:ref.kind,id:ref.id});}return;}
 if(action.kind==='edit'){showTab('preparation');if(action.content.note)await openPreparedNote(action.content.ref.id);else if(action.content.location)await openPreparedLocation(action.content.ref.id);return;}
 const live=unwrap(await window.campaign.live(token));if(workspace?.token!==token||live.focusId!==action.sceneId)throw new Error('Fokusgruppe geändert. Schnellsuche erneut öffnen.');
 showTab('live');await openLive();if(workspace?.token!==token)return;
 if(action.kind==='read-aloud'&&action.content.note)await useLiveReferenceReadAloud(action.content.note.readAloud,action.content.title,action.sceneId!);
 if(action.kind==='encounter'&&action.content.encounter)await prepareLiveEncounter(action.content.encounter);
 if(action.kind==='creature'&&action.content.creature)await addLiveCreature(action.content.creature.id,action.count!,action.grouped!);
});
async function fromCatalogToLive(action:()=>Promise<void>){
 const token=workspace?.token;
 if(!token||!await leaveWorkspace()||workspace?.token!==token)return;
 showTab('live');
 if(await openLive()&&workspace?.token===token)await action();
}
initCatalog(status, plan=>fromCatalogToLive(()=>prepareLiveEncounter(plan)), (id,count,grouped)=>fromCatalogToLive(()=>addLiveCreature(id,count,grouped)));
el('catalog-day-plan').onclick=()=>{void(async()=>{if(!await leaveWorkspace())return;await reopenView('preparation');showDayPreparation();})().catch(error=>status(error.message,true));};
initNpcs(status,refreshScenePreparation,async id=>{if(!await leaveWorkspace())return;showTab('live');await openLive();await addLiveNpc(id);});
setCombatNpcNavigation(async(id,current)=>{if(!current()||!await leaveWorkspace()||!current())return;showTab('groups');await openNpcProfile(id,undefined,current);});
setNpcNavigation(async(id,contact,current)=>{if(!await leaveWorkspace()||!current())return;showTab('groups');await openGroups();if(current())await openNpcProfile(id,contact,current);},async(id,current)=>{if(!await leaveWorkspace()||!current())return;showTab('autonomy');await openAutonomy(id);},navigateNpcPlaces);
initGroups(status,refreshScenePreparation,async id=>{if(!await leaveWorkspace())return;showTab('groups');await openGroups(id);await openNpcs(false);},async(id,sourceCurrent=()=>true)=>{const owner=workspace,current=()=>workspace===owner&&sourceCurrent();if(!current()||!await leaveWorkspace()||!current())return;showTab('groups');await openNpcProfile(id,undefined,current);});
setGroupNavigation(async(id,current=()=>true)=>{if(!await leaveWorkspace()||!current())return;showTab('groups');await openGroups(id);if(current())await openNpcs(false);});
initTreasury(status,async()=>{await refreshProgress();await refreshScenePreparation();},async id=>{if(!await leaveWorkspace())return;showTab('treasury');await openTreasury(id);},async(token,id)=>{if(workspace?.token!==token||!await leaveWorkspace()||workspace?.token!==token)return;showTab('live');await openLive();if(workspace?.token===token)await openLiveCharacterLoot(id);});
initItems(status,async id=>{if(!(await leaveWorkspace()))return;showTab('items');await openItems(id);});
const dungeonCanvas=new PassiveMapCanvas(el<SVGSVGElement & HTMLElement>('map'),{initial:{x:0,y:0,width:24,height:18},locked:()=>!!pointer,changed:()=>draw()});
initDrawing(status,()=>workspace,()=>draft,async()=>{if(activating||activationFailed||roomDraftLoading)return false;return await flushAutonomy()&&await flushCity()&&await flushMusic()&&await flushWorld()&&await flushItems()&&await flushCatalog()&&await flushLive()&&await leavePreparation()&&await flush();},async next=>{workspace=geometryOnly(next);await setDraft();renderList(true);updateHistory();},draw);
initVolume(status,()=>workspace,()=>draft,async()=>{if(activating||activationFailed||roomDraftLoading)return false;return await flushDrawing()&&await flushAutonomy()&&await flushCity()&&await flushMusic()&&await flushWorld()&&await flushItems()&&await flushCatalog()&&await flushLive()&&await leavePreparation()&&await flush();},async next=>{workspace=geometryOnly(next);await setDraft();renderList(true);updateHistory();await reloadDrawing();draw();});
initTriggers(status,()=>workspace,()=>draft,async()=>{if(activating||activationFailed||roomDraftLoading)return false;return await flushDungeonContent()&&await flushGraph()&&await flushKeys()&&await flushPaths()&&await flushVolume()&&await flushDrawing()&&await flushAutonomy()&&await flushCity()&&await flushMusic()&&await flushWorld()&&await flushItems()&&await flushCatalog()&&await flushLive()&&await leavePreparation()&&await flush();},async next=>{workspace=geometryOnly(next);await setDraft();renderList(true);updateHistory();await reloadDrawing();draw();});
initDungeonContent(status,()=>workspace,()=>draft,async()=>{if(activating||activationFailed||roomDraftLoading)return false;return await flushGraph()&&await flushKeys()&&await flushPaths()&&await flushVolume()&&await flushDrawing()&&await flushAutonomy()&&await flushCity()&&await flushMusic()&&await flushWorld()&&await flushItems()&&await flushCatalog()&&await flushLive()&&await leavePreparation()&&await flush();},async next=>{workspace=geometryOnly(next);await setDraft();renderList(true);updateHistory();await reloadDrawing();draw();},refreshOpenGraph);
initGraph(status,()=>workspace,()=>draft,async()=>{if(activating||activationFailed||roomDraftLoading)return false;return await flushKeys()&&await flushPaths()&&await flushVolume()&&await flushDrawing()&&await flushAutonomy()&&await flushCity()&&await flushMusic()&&await flushWorld()&&await flushItems()&&await flushCatalog()&&await flushLive()&&await leavePreparation()&&await flush();},async next=>{workspace=geometryOnly(next);await setDraft();renderList(true);updateHistory();await reloadDrawing();draw();},()=>showTab('atlas'),selectRoom);
initKeys(status,()=>workspace,()=>draft,async()=>{if(activating||activationFailed||roomDraftLoading)return false;return await flushPaths()&&await flushVolume()&&await flushDrawing()&&await flushAutonomy()&&await flushCity()&&await flushMusic()&&await flushWorld()&&await flushItems()&&await flushCatalog()&&await flushLive()&&await leavePreparation()&&await flush();},async next=>{workspace=geometryOnly(next);await setDraft();renderList(true);updateHistory();await reloadDrawing();draw();},selectRoom,{open:openPreparedNote,flush:flushPreparation,map:async id=>{showTab('atlas');await campaignAtlas?.navigate('room',id);},plan:async(id,current)=>{
 if(!current()||!await leaveWorkspace()||!current())return false;
 const owner=workspace;showTab('preparation');const request=viewRequest,valid=()=>workspace===owner&&viewRequest===request&&current();
 try{return await openPreparedPlan(id,valid);}catch(error){if(valid())throw error;return false;}
},showKeyWorkspace:()=>showTab('atlas')});
setNoteRoomNavigation((id,current,restore,source)=>openNoteRoomKey(id,current,()=>{if(current()){showTab('preparation');restore();}},source));
initPaths(status,()=>workspace,()=>draft,async()=>{if(activating||activationFailed||roomDraftLoading)return false;return await flushVolume()&&await flushDrawing()&&await flushAutonomy()&&await flushCity()&&await flushMusic()&&await flushWorld()&&await flushItems()&&await flushCatalog()&&await flushLive()&&await leavePreparation()&&await flush();},async next=>{workspace=geometryOnly(next);await setDraft();renderList(true);updateHistory();await reloadDrawing();draw();});
initDungeon(status,id=>{void(async()=>{if(!(await leaveWorkspace()))return;showTab('live');await openLive();await openExistingCombat(id);})().catch(error=>status(error.message,true));});
const dungeonBinder=new DungeonBinder(()=>workspace,leaveWorkspace,status,async(id,action)=>{const token=workspace?.token;if(!token||!await leaveWorkspace()||workspace?.token!==token)return;if(action==='target'){showTab('atlas');await campaignAtlas?.navigate('room',id);await selectDungeonRoom(id);}else{showTab('atlas');await campaignAtlas?.navigate('room',id);if(action==='edit'&&workspace?.token===token&&workspace.selectedId===id)el('key-open').click();}},(id,target,current,returned,left)=>openRoomKey(id,current,returned,target,'Zurück zum Binder',left));
initAutonomy(status);
initCity(status,id=>worldLinks.open({kind:'note',id}),async(id,current)=>{if(!current()||!await leaveWorkspace()||!current())return;showTab('groups');await openGroups();if(current())await openNpcProfile(id,undefined,current);},async(id,current)=>{if(!current()||!await leaveWorkspace()||!current())return;await locationNotebook.open(id);});
initWorld(status,flushLive,async()=>{await openLive();},async()=>{if(!(await leaveWorkspace()))return;showTab('world');await openWorld();},async(sceneId,kind)=>{if(kind==='wait')await openTimeNavigator(undefined,sceneId);else await openTravelRest(sceneId);});
const campaignAgenda=new CampaignAgenda(()=>workspace,leaveWorkspace,status,async kind=>{if(!await leaveWorkspace())return;if(kind==='calendar')await openWorldCalendar();else{showTab('live');await openLive();}},async target=>{if(!await leaveWorkspace())return;showTab('live');await openLive();await openTimeNavigator(target);},id=>locationNotebook.open(id));
initLive(status, async id => {
  if (!(await leaveWorkspace())) return;
  await openPreparedLocation(id); showTab('preparation');
},async(id,current=()=>true)=>{if(!(await leaveWorkspace())||!current())return;showTab('preparation');await openPreparedNote(id,current);},async(id,current=()=>true)=>{if(current())await locationNotebook.open(id,current);},async(planId,visitId,current=()=>true)=>{if(!current()||!(await leaveWorkspace())||!current())return;showTab('preparation');await openPreparedVisit(planId,visitId,current,'reward');},async(seed,current=()=>true)=>{if(!current()||!(await leaveWorkspace())||!current())return;await campaignAgenda.openMomentDraft({name:seed.title,notes:seed.summary},seed.location??undefined,current);},async(planId,seed,current=()=>true,openPacket=false)=>{if(!current()||!(await leaveWorkspace())||!current())return false;showTab('preparation');const prepared=await prepareNextVisit(planId,seed,current);if(!prepared)return false;if(openPacket&&current())return openPreparationSessionPacket(prepared.visitId);return current();});
initMusic(status,async()=>{if(!(await leaveWorkspace()))return;showTab('music');await openMusic();});
initSoundboard(status,async()=>{if(!await leaveWorkspace())return;showTab('music');await openMusic();},async()=>{if(!await leaveWorkspace())return;showTab('live');await openLive();await openLiveSoundboard();});
campaignAtlas=new CampaignAtlasWorkbench({exit:async()=>{if(await openCampaignScreen())showTab('preparation');},selectRoom,roomDraft:()=>draft,flush:leaveWorkspace,updated:async next=>{workspace=geometryOnly(next);await setDraft();renderList(true);updateHistory();await reloadDrawing();},status});
setLiveAtlasSurface(campaignAtlas.liveSurface());
for(const id of ['world','city','dungeon'])el(id+'-tab').hidden=true;
el('atlas-tab').textContent='Atlas';
function showTab(selected: WorkspaceTab, restored?: number) {
  const atlasSurface=['atlas','world','city','dungeon'].includes(selected);if(atlasSurface)selected='atlas';

  if(selected!=='chronicle')suspendChronicle();
  if (workspace) workspacePositions.capture(workspace.campaign.id, window.scrollY);
  const scrollY = workspace ? workspacePositions.select(workspace.campaign.id, selected, restored) : 0;
  viewRequest++; activeTab = selected;
  if (workspace) rememberWorkspaceView(viewStorage, workspace.campaign.id, {tab: selected, scrollY: 0});
  setWorldSurface(selected);setSessionPacketSurface(selected);
  if(campaignAtlas){if(atlasSurface)void campaignAtlas.open();else if(selected!=='live'||!campaignAtlas.liveDocked)campaignAtlas.hide();}
  for (const id of workspaceTabs) { el(id).hidden = atlasSurface?true:id !== selected; el(id + '-tab').setAttribute('aria-pressed', String(id === selected)); }
  syncWorkspaceNavigation();
  window.scrollTo(0, 0);
  return scrollY;
}
async function reopenView(tab: WorkspaceTab, restored?: number, liveNotesTop?: number, liveCombat?: boolean) {
  const owner = workspace, intent = activationIntent, scrollY = showTab(tab, restored), request = viewRequest;
  switch (tab) {
    case 'live': await openLive(); break;
    case 'atlas':
      // The Atlas owns its loading/error state and author-hit fence. Its first
      // region can take much longer than opening the workspace shell; do not
      // keep the campaign screen and all camera input inert until it arrives.
      void campaignAtlas?.open().catch(error=>{
        if(workspace===owner&&activationIntent===intent&&viewRequest===request)
          status((error as Error).message,true);
      });
      break;
    case 'groups': await openGroups(); await openNpcs(); break;
    case 'treasury': await openTreasury(); break;
    case 'chronicle': await openChronicle(); break;
    case 'catalog': await openCatalog(); break;
    case 'items': await openItems(); break;
    case 'world': await openWorld(); break;
    case 'music': await openMusic(); break;
    case 'city': await openCity(); break;
    case 'autonomy': await openAutonomy(); break;
    case 'dungeon': await openDungeon(); break;
    case 'preparation': if(owner)await ensurePreparation(owner);break;
  }
  window.requestAnimationFrame(() => {
    if (workspace !== owner || activationIntent !== intent || viewRequest !== request || activationFailed) return;
    const notes = tab === 'live' && liveNotesTop !== undefined ? el('running-notes').getBoundingClientRect() : null;
    if(tab==='live'&&liveCombat&&!el('combat-panel').hidden)el('combat-panel').scrollIntoView({block:'start'});
    else window.scrollTo(0, notes && notes.height > 0 ? window.scrollY + notes.top - liveNotesTop! : scrollY);
    rememberView();
  });
}
initPlayerUI(status,()=>workspace,leaveWorkspace);
async function refreshCampaignShell(){const list=await refreshCampaigns();if(!list)return null;if(workspace&&!list.campaigns.some(c=>c.id===workspace!.campaign.id)){workspace=null;draft=null;confirmedRoom=null;roomLoad++;setWorkspaceAvailable(false);deactivateMusic();deactivatePlayer();activateDayCalculator(null);activatePartyTopbar(null);campaignAtlas?.hide();document.querySelector('main')!.inert=true;}else if(workspace){const current=list.campaigns.find(c=>c.id===workspace!.campaign.id);if(current)workspace.campaign=current;}
 el('campaign-header-name').textContent=workspace?.campaign.name??'Kampagnen';return list;}
initCampaignManager(status,()=>workspace,leaveCampaign,async id=>{await refreshCampaignShell();if(id){await activate(id);if(!activationFailed)hideCampaignScreen();}});
void initTutorial();
async function flushAll() { return await flushNpcs() && await flushGroups() && await flushTreasury() && await flushTriggers() && await flushDungeonContent() && await flushGraph() && await flushKeys() && await flushPaths() && await flushVolume() && await flushDungeon() && await flushDrawing() && await flushAutonomy() && await flushCity() && await flushMusic() && await flushWorld() && await flushItems() && await flushCatalog() && await flushLive() && await flushPreparation() && await flush(); }
async function leaveCampaign() { return await leaveWorkspace() && canLeaveGraphPreview(); }
async function leaveWorkspace() {
  if(campaignAtlas&&!await campaignAtlas.flush())return false;
  await stopWorldPlayback();
  if(!await flushNpcs()||!await flushGroups())return false;
  if(!await flushTreasury())return false;
  if (!(await flushTriggers()) || !(await flushDungeonContent()) || !(await flushGraph()) || !(await flushKeys()) || !(await flushPaths())) return false;
  if (!(await flushVolume())) return false;
  if (!(await flushDungeon())) return false;
  if (!(await flushDrawing())) return false;
  if (!(await flushAutonomy())) return false;
  if (!(await flushCity())) return false;
  if (activating) { status('Kampagne wird noch geladen.'); return false; }
  if (activationFailed) return true; // Previous input was drained before this read-only failed transition.
  if (roomDraftLoading) { status('Arbeitsentwurf wird noch geprüft und geladen.'); return false; }
  if (!(await flushMusic())) return false;
  if (!(await flushWorld())) return false;
  if (!(await flushItems())) return false;
  if (!(await flushCatalog())) return false;
  if (!(await flushLive())) return false;
  if (!(await leavePreparation())) return false;
  if (await flush()) return true;
  if (!workspace || !draft || pointer || composing) return false;
  try {
    unwrap(await api.keepRoomDraft(workspace.token, draft.id, { room: draft, points: atlasFieldValue(el<HTMLTextAreaElement>('points')), pointsChanged: el('points').dataset.changed === 'true', failedEdit }));
    hasRetainedDraft = true;
    return true;
  } catch (error) { status('Entwurf konnte nicht gesichert werden: ' + (error as Error).message, true); return false; }
}
const unwrap = <T>(result: Result<T>): T => { if (!result.ok) throw new Error(result.error); return result.value; };
const selected = () => confirmedRoom?.id===workspace?.selectedId?confirmedRoom:undefined;
const roomContextCurrent = (token: string) => workspace?.token === token && !activationJob && !activating && !activationFailed;
const same = (a: Room, b: Room) => JSON.stringify([a.name, a.polygons, a.sections]) === JSON.stringify([b.name, b.polygons, b.sections]);
function cancelTimer() { if (timer) clearTimeout(timer); timer = null; }
function schedule() {
  if (writeBlocked) { status('Schreiben gesperrt. Entwurf bleibt offen; zuerst den Speicherstatus prüfen.', true); return; }
  status('Eingabe offen – noch nicht gespeichert.'); cancelTimer();
  if (!composing && !pointer) timer = setTimeout(() => { void flush(); }, 700);
}
async function flush(): Promise<boolean> {
  cancelTimer();
  if (activating || activationFailed) return false;
  if (roomDraftLoading) { status('Arbeitsentwurf wird noch geprüft und geladen.'); return false; }
  // A failed draft read is kept intact; its read-only room must not overwrite it.
  if (roomDraftReadFailed) return true;
  if (writeBlocked) return false;
  if (pending) { const okay = await pending; return okay ? flush() : false; }
  if (composing || pointer) { status('Bitte die laufende Eingabe abschließen.', true); return false; }
  const before = selected();
  if (!workspace || !draft || !before) return true;
  try { readPoints(); validateRoom(draft); }
  catch (error) { status(String((error as Error).message) + ' Entwurf bleibt offen.', true); return false; }
  if (same(before, draft)) {
    if (hasRetainedDraft) { unwrap(await api.keepRoomDraft(workspace.token, draft.id, null)); hasRetainedDraft = false; }
    status('Gespeichert.'); return true;
  }
  const after = structuredClone(draft), token = workspace.token;
  const request: Edit = { commandId: crypto.randomUUID(), token, campaignId: workspace.campaign.id, roomId: after.id,
    expectedRevision: after.revision, name: after.name, polygons: after.polygons, sections: after.sections };
  status('Wird gespeichert…');
  pending = (async () => {
    let acknowledged=false;
    try {
      const next = unwrap(await atlasRoomWrite(request));acknowledged=true;
      if (workspace?.token !== token) return false;
      confirmedRoom=next.room;
      workspace = geometryOnly({ ...workspace, rooms: workspace.rooms.map(room => room.id === next.room.id ? next.room : room), canUndo: next.canUndo, canRedo: next.canRedo, selectedId: after.id });
      if (draft?.id === after.id) draft.revision = next.room.revision;
      hasRetainedDraft = false;
      // A confirmed edit updates the scene without moving the user's camera.
      renderList(true); updateHistory(); draw();
      status(draft && !same(after, draft) ? 'Weitere Eingabe offen – noch nicht gespeichert.' : 'Gespeichert.');
      return true;
    } catch (error) { if(acknowledged){status('Änderung gespeichert. Ansicht konnte nicht aktualisiert werden: '+(error as Error).message,true);return true;}writeBlocked = true; failedEdit = request; el('error-actions').hidden = false; status((error as Error).message + ' Entwurf bleibt offen; Schreiben gesperrt bis zur Aufklärung.', true); return false; }
    finally { pending = null; }
  })();
  const okay = await pending;
  return okay ? flush() : false;
}
function readPoints() {
  if (!draft) return;
  const input = el<HTMLTextAreaElement>('points');
  if (input.dataset.changed !== 'true') return;
  const points = atlasFieldValue(input).split('\n').filter(line => line.trim()).map(line => {
    const values = line.trim().split(/[,;\s]+/);
    if (values.length !== 2 || values.some(v => !v || !Number.isFinite(Number(v)))) throw new Error('Koordinaten als x, y eingeben.');
    return { x: Number(values[0]), y: Number(values[1]) };
  });
  const candidate = { ...draft, polygons: [{ ...draft.polygons[0]!, outer: points }, ...draft.polygons.slice(1)] };
  validateRoom(candidate); draft = candidate;
}
function renderRoomInputs(room: Room, token: string | undefined) {
  el<HTMLInputElement>('room-name').value = room.name;
  el('keys').replaceChildren();
  room.sections.forEach((section, index) => {
    const label = document.createElement('label'); label.textContent = section.kind === 'markdown' ? `GM-Text ${index + 1}` : `Passage ${index + 1}`;
    if (section.kind !== 'markdown') { const text = document.createElement('p'); text.textContent = `Türbindung: ${section.doorId} (hier noch nicht bearbeitbar)`; el('keys').append(label, text); return; }
    const input = document.createElement('textarea'); input.id = `key-${index}`; label.htmlFor = input.id; input.rows = 8; input.value = section.markdown!;
    input.addEventListener('input', () => {
      if (roomDraftLoading || roomDraftReadFailed || activationJob || activating || activationFailed || workspace?.token !== token || draft?.id !== room.id) return;
      draft!.sections[index]!.markdown = editTextareaText(draft!.sections[index]!.markdown!,input.value);
      schedule();
    });
    input.addEventListener('blur', () => { if (!composing && workspace?.token === token && draft?.id === room.id) void flush(); });
    el('keys').append(label, input);
  });
}
function roomEditable(editable: boolean) {
  for (const id of ['room-name', 'points', 'apply']) el<HTMLInputElement>(id).disabled = !editable;
  for (const input of el('keys').querySelectorAll<HTMLTextAreaElement>('textarea')) input.disabled = !editable;
}
async function setDraft() {
  const token=workspace?.token,id=workspace?.selectedId,request=++roomLoad;
  const current=()=>workspace?.token===token&&workspace?.selectedId===id&&request===roomLoad;
  confirmedRoom=null;draft=null;roomDraftReadFailed=false;writeBlocked=false;failedEdit=null;hasRetainedDraft=false;el('error-actions').hidden=true;
  el('keys').replaceChildren();el<HTMLInputElement>('room-name').value='';el('empty').textContent='Lege einen Raum an oder übernimm eine Dungeondatei.';
  el('editor').hidden=true;el('empty').hidden=false;roomEditable(false);
  if(!token||!id){roomDraftLoading=false;draw();return;}
  roomDraftLoading=true;updateHistory();status('Raum wird geladen.');
  let room:Room;
  try{room=unwrap(await api.atlasRoom(token,id));if(!current())return;confirmedRoom=room;draft=structuredClone(room);const {sections:unused,...shape}=room;workspace!.rooms=workspace!.geometryCoverage==='selected'?[shape]:[...workspace!.rooms.filter(r=>r.id!==room.id),shape];}
  catch(error){if(current()){roomDraftLoading=false;roomDraftReadFailed=true;writeBlocked=true;status('Raum konnte nicht geladen werden. Originaldaten bleiben erhalten: '+(error as Error).message,true);el('empty').textContent='Raum nicht verfügbar. Anderen Raum wählen oder erneut öffnen.';updateHistory();}return;}
  writeBlocked = false; failedEdit = null; roomDraftReadFailed = false; el('error-actions').hidden = true;
  hasRetainedDraft = false;
  el('editor').hidden = !room; el('empty').hidden = !!room;
  el('keys').replaceChildren();
  if (!room) { roomEditable(false); draw(); return; }
  const floors = el<HTMLSelectElement>('floors'); floors.replaceChildren();
  for (const floor of workspace!.floors) { const option = document.createElement('option'); option.value = JSON.stringify([floor.scopeId, floor.id]); option.textContent = floor.name; floors.append(option); }
  floors.value = JSON.stringify([room.scopeId, room.floorId]);
  renderRoomInputs(room, token);
  updatePoints(); if(dungeonCanvas.context(workspace!.campaign.id+':'+floors.value,{x:0,y:0,width:24,height:18})&&!dungeonCanvas.contextRestored){fit(true);dungeonCanvas.defaultView(dungeonCanvas.view);}draw();
  if (room && token) {
    roomDraftLoading = true; roomEditable(false); updateHistory(); status('Arbeitsentwurf wird geprüft und geladen.');
    try {
      const retained = unwrap(await api.roomDraft(token, room.id));
      if (!retained || !current()) return;
      draft = structuredClone(retained.room); hasRetainedDraft = true;
      renderRoomInputs(draft, token);
      setAtlasFieldValue(el<HTMLTextAreaElement>('points'),retained.points); el('points').dataset.changed = String(retained.pointsChanged);
      failedEdit = retained.failedEdit; writeBlocked = !!failedEdit;
      el('error-actions').hidden = !writeBlocked;
      draw(); status('Arbeitsentwurf wiederaufgenommen. Die Änderung ist noch nicht als Autorenstand gespeichert.', true);
    } catch (error) {
      if (!current()) return;
      roomDraftReadFailed = true; writeBlocked = true;
      status('Arbeitsentwurf konnte nicht gelesen werden. Originalbytes bleiben erhalten; dieser Raum bleibt schreibgeschützt: ' + (error as Error).message, true);
    } finally {
      if (current()) {
        roomDraftLoading = false; roomEditable(!roomDraftReadFailed); updateHistory();
      }
    }
  }
}
function updatePoints() { if (draft) { const field = el<HTMLTextAreaElement>('points'); setAtlasFieldValue(field,draft.polygons[0]!.outer.map(p => `${p.x}, ${p.y}`).join('\n')); field.dataset.changed = 'false'; } }
function updateHistory() {
  el<HTMLButtonElement>('undo').disabled = roomDraftLoading || roomDraftReadFailed || !workspace?.canUndo;
  el<HTMLButtonElement>('redo').disabled = roomDraftLoading || roomDraftReadFailed || !workspace?.canRedo;
  el<HTMLButtonElement>('add-room').disabled = !workspace;
  el<HTMLButtonElement>('rename-campaign').disabled = !workspace;
}
const roomDirectory=new RoomDirectoryView(el('rooms'),id=>{void campaignAtlas?.navigate('room',id);});
function renderList(refresh=false) {
  roomDirectory.context(workspace?.token??null,el<HTMLInputElement>('search').value,workspace?.selectedId??null,workspace?.problems??[],refresh);
}
async function selectRoom(id: string) {
  if (!(await flushDrawing())) return;
  const token = workspace?.token;
  if (!token || !roomContextCurrent(token) || !(await leaveWorkspace()) || !roomContextCurrent(token)) return;
  try {
    const response = await api.select(token, id);
    if (!roomContextCurrent(token)) return;
    unwrap(response); workspace!.selectedId = id;
    await setDraft();
    if (!roomContextCurrent(token)) return;
    renderList(); if (!roomDraftReadFailed && (!draft || same(draft, selected()!) && el('points').dataset.changed !== 'true')) status('Gespeichert.');
  } catch (error) { if (roomContextCurrent(token)) status((error as Error).message, true); }
}
const svgNS = 'http://www.w3.org/2000/svg';
function svgElement(name: string, attributes: Record<string, string>) {
  const item = document.createElementNS(svgNS, name); Object.entries(attributes).forEach(([key, value]) => item.setAttribute(key, value)); return item;
}
function draw(){syncGraphBanner(workspace);syncDrawingControls();document.dispatchEvent(new Event('atlas-draft'));const visible=workspace?.rooms.some(r=>JSON.stringify([r.scopeId,r.floorId])===el<HTMLSelectElement>('floors').value);dungeonCanvas.render(drawScene,visible?'':'Noch keine Geometrie in dieser Ansicht. Raum anlegen oder eine andere Ebene wählen.');}
function drawScene(map:SVGGElement) {
  const visible:RoomGeometry[]=[];
  for (const saved of workspace?.rooms ?? []) {
    const room = draft?.id === saved.id ? draft : saved;
    if (JSON.stringify([room.scopeId, room.floorId]) !== el<HTMLSelectElement>('floors').value) continue;
    visible.push(room);
    const path = room.polygons.flatMap(p => [p.outer, ...p.holes]).map(ring => 'M' + ring.map(p => `${p.x},${p.y}`).join('L') + 'Z').join(' ');
    const style = roomDrawingStyle(room.id);
    const isSelected = room.id === draft?.id;
    const shape = svgElement('path', {
      d: path,
      fill: isSelected ? '#aecfdf' : style?.fill ?? '#d7e1e9',
      stroke: isSelected ? '#234d74' : style?.wall ?? '#576c80',
      'stroke-width': isSelected ? '.13' : '.08',
      'fill-rule': 'evenodd',
      cursor: 'pointer',
    });
    shape.setAttribute('data-room-id',room.id);
    const title = svgElement('title', {}); title.textContent = `${room.number}. ${room.name}`; shape.append(title);
    shape.addEventListener('click', () => { void selectRoom(room.id); }); map.append(shape);
  }
  drawingOverlay(map);
  const host=el<SVGSVGElement & HTMLElement>('map'),box=dungeonCanvas.view;
  const unitsPerPixel=Math.max(box.width/host.clientWidth,box.height/host.clientHeight);
  for(const room of visible)appendRoomNumber(map,room,unitsPerPixel);
  if (!draft||JSON.stringify([draft.scopeId,draft.floorId])!==el<HTMLSelectElement>('floors').value) return;
  draft.polygons[0]!.outer.forEach((p, index) => {
    const handle = svgElement('circle', { cx: String(p.x), cy: String(p.y), r: String(box.width / 85), class: 'handle' });
    handle.addEventListener('pointerdown', event => {
      if ((event as PointerEvent).button!==0 || pending || composing || pointer || roomDraftLoading || roomDraftReadFailed || activationJob || activating || activationFailed) return;
      pointer = { index, id: (event as PointerEvent).pointerId, before: structuredClone(draft!.polygons) }; host.setPointerCapture(pointer.id); event.preventDefault();
    }); map.append(handle);
  });
}
new ResizeObserver(()=>draw()).observe(el('map'));
function fit(all=false) {
  const visible=(workspace?.rooms??[]).map(saved=>draft?.id===saved.id?draft:saved).filter(room=>JSON.stringify([room.scopeId,room.floorId])===el<HTMLSelectElement>('floors').value);
  const box=roomCameraBox(all?visible:draft?[draft]:visible);if(box){const [x,y,width,height]=box.split(' ').map(Number);dungeonCanvas.set({x:x!,y:y!,width:width!,height:height!});}
}
el('map').addEventListener('pointermove', event => {
  if (!pointer || !draft || event.pointerId !== pointer.id) return;
  const svg = el('map') as unknown as SVGSVGElement, matrix = svg.getScreenCTM(); if (!matrix) return;
  const position = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  draft.polygons[0]!.outer[pointer.index] = { x: Math.round(position.x * 1000) / 1000, y: Math.round(position.y * 1000) / 1000 };
  updatePoints(); draw(); status('Konturvorschau – noch nicht gespeichert.');
});
el('map').addEventListener('pointerup', event => { if (pointer?.id !== event.pointerId) return; pointer = null; void flush(); });
el('map').addEventListener('pointercancel', () => { if (pointer && draft) draft.polygons = pointer.before; pointer = null; updatePoints(); draw(); schedule(); });
el('floors').addEventListener('change', () => { void (async () => {
  if (!workspace || !(await flush())) return;
  const key = el<HTMLSelectElement>('floors').value;
  if(workspace.rooms.some(r=>r.id===workspace!.selectedId&&JSON.stringify([r.scopeId,r.floorId])===key)){draw();return;}
  const room = workspace.rooms.find(r => JSON.stringify([r.scopeId, r.floorId]) === key);
  if (room) await selectRoom(room.id); else { draft = null; el('editor').hidden = true; el('empty').hidden = false; draw(); }
})(); });
el('fit').onclick = () => { fit(); draw(); };
el('fit-all').onclick = () => { fit(true); draw(); };
el('map-zoom-in').onclick=()=>dungeonCanvas.zoom(1/1.2);el('map-zoom-out').onclick=()=>dungeonCanvas.zoom(1.2);
el('search').addEventListener('input',()=>renderList());
el('room-name').addEventListener('input', () => { if (roomDraftLoading || roomDraftReadFailed || activationJob || activating || activationFailed) return; if (draft) draft.name = el<HTMLInputElement>('room-name').value; schedule(); });
el('room-name').addEventListener('blur', () => { void flush(); });
el('points').addEventListener('input', () => { if (roomDraftLoading || roomDraftReadFailed || activationJob || activating || activationFailed) return; el('points').dataset.changed = 'true'; schedule(); });
el('points').addEventListener('blur', () => { void flush(); });
el('apply').onclick = () => { void flush(); };
el('editor').addEventListener('submit', event => { event.preventDefault(); void flush(); });
el('reconcile').onclick = () => { void (async () => {
  const edit = failedEdit, token = workspace?.token;
  if (!edit || !token || !roomContextCurrent(token)) return;
  const owns = () => roomContextCurrent(token) && failedEdit === edit;
  try {
    const response = await api.reconcile(edit, token);
    if (!owns()) return;
    const result = unwrap(response);
    if (result.targetChanged || result.outcome === 'conflict') {
      status(result.outcome === 'applied' ? 'Speicherung bestätigt, aber der aktuelle Raumstand ist verändert oder nicht verlässlich lesbar. Entwurf bleibt offen. Übertrage den Text vor dem Verwerfen.' : 'Konflikt bestätigt. Entwurf bleibt offen. Übertrage den Text vor dem Verwerfen.', true); return;
    }
    workspace = geometryOnly({ ...result.workspace, selectedId: edit.roomId });
    if (draft) draft.revision = selected()!.revision;
    writeBlocked = false; failedEdit = null; el('error-actions').hidden = true; updateHistory(); renderList();
    status(result.outcome === 'applied' ? 'Speicherung bestätigt. Weitere Eingaben bleiben offen.' : 'Diese Änderung wurde nicht gespeichert. Eingabe abschließen, um sie erneut zu übernehmen.');
  } catch (error) { if (owns()) status((error as Error).message + ' Status bleibt ungeklärt.', true); }
})(); };
el('discard').onclick = () => { void (async () => {
  const edit = failedEdit, token = workspace?.token, roomId = draft?.id;
  if (!edit || !token || !roomContextCurrent(token)) return;
  const owns = () => roomContextCurrent(token) && failedEdit === edit;
  try {
    const response = await api.reconcile(edit, token);
    if (!owns()) return;
    const current = unwrap(response).workspace;
    if (roomId) {
      const cleared = await api.keepRoomDraft(token, roomId, null);
      if (!owns()) return;
      unwrap(cleared);
    }
    workspace = geometryOnly(current); writeBlocked = false; failedEdit = null; el('error-actions').hidden = true;
    await setDraft();
    if (!roomContextCurrent(token)) return;
    renderList(); updateHistory(); status('Aktueller gespeicherter Stand geöffnet. Entwurf verworfen.');
  } catch (error) { if (owns()) status((error as Error).message, true); }
})(); };
el('atlas').addEventListener('compositionstart', () => { composing = true; cancelTimer(); });
el('atlas').addEventListener('compositionend', () => { composing = false; schedule(); });
async function refreshCampaigns() {
  const request = ++campaignListRequest, list = unwrap(await api.list());
  if (request !== campaignListRequest) return null;
  const select = el<HTMLSelectElement>('campaigns'); select.replaceChildren();
  const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Kampagne öffnen'; select.append(empty);
  for (const campaign of list.campaigns) { const option = document.createElement('option'); option.value = campaign.id; option.textContent = campaign.name; select.append(option); }
  select.value = workspace?.campaign.id ?? ''; return list;
}
function activate(id: string,entryCommandId?:string): Promise<void> {
  activationIntent++; queuedActivation = {id,entryCommandId};
  if (activationJob) return activationJob;
  activationJob = drainActivation();
  return activationJob;
}
async function drainActivation(): Promise<void> {
  const main = document.querySelector('main')!, header = document.querySelector('header')!, nav = document.querySelector('nav')!;
  const wasInert = main.inert;
  main.inert = true; header.inert = true; nav.inert = true;
  try {
    // Reserve the transition before this asynchronous drain, so a second request joins it.
    if (!queuedActivation?.entryCommandId&&!(await leaveCampaign())) { el<HTMLSelectElement>('campaigns').value = workspace?.campaign.id ?? ''; return; }
    rememberView();
    activating = true; activationFailed = false; deactivateMusic();deactivatePlayer();
    status('Kampagne wird geladen.');
    while (queuedActivation !== null) {
      const {id,entryCommandId} = queuedActivation; queuedActivation = null;
      try {
        const shell = unwrap(entryCommandId?await api.campaignCatalogShell(entryCommandId):await api.activateShell(id));
        if(queuedActivation!==null)continue;
        const next=unwrap(await api.workspaceInitial(shell.token));
        if (queuedActivation !== null) continue; // A newer intent owns the forthcoming projection.
        workspace = geometryOnly(next); el('campaign-header-name').textContent=next.campaign.name;setWorkspaceAvailable(true); el<HTMLSelectElement>('campaigns').value = id;
        campaignAtlas?.activate(next);activateLive(next);activateDayCalculator(next);activatePartyTopbar(next);activateNarrativeJournal(next);activateQuickReference(next);worldLinks.contextChanged();locationNotebook.contextChanged();locationReturn.hidden=true;el<HTMLButtonElement>('narrative-journal-open').disabled=false; activateChronicle(next); activateCatalog(next); activateItems(next);activateTreasury(next);activateGroups(next);activateNpcs(next); activateWorld(next); activateCity(next); activateAutonomy(next); activateDungeon(next); dungeonBinder.reset(); campaignAgenda.reset(); activateVolume(); activatePaths();activateKeys();activateGraph();activateDungeonContent();activateTriggers(); void activateDrawing(next,false); activateSoundboard(next);activateMusic(next);
        await activatePreparation(next,false);
        if (queuedActivation !== null) continue;
        el('map-title').textContent = next.campaign.name; el<HTMLInputElement>('search').value = '';
        await setDraft();
        if (queuedActivation !== null) continue;
        renderList(); updateHistory();
        const view = readWorkspaceView(viewStorage, next.campaign.id);
        await reopenView(view.tab, view.scrollY, view.liveNotesTop, view.liveCombat);
        if (queuedActivation !== null) continue;
        if (preparationHasDrafts()) status('Vorbereitung enthält offene oder gesperrte Entwürfe.', true);
        else if (!roomDraftReadFailed && (!draft || !selected() || same(draft, selected()!) && el('points').dataset.changed !== 'true')) status('Gespeichert.');
      } catch (error) {
        if (queuedActivation !== null) continue;
        activationFailed = true;
        status((error as Error).message + ' Die Arbeitsfläche bleibt schreibgeschützt; öffne eine Kampagne erneut.', true);
      }
    }
  } catch (error) {
    // A failed source drain preserves the current editable context and its pending input.
    if (activating) activationFailed = true;
    status((error as Error).message + ' Kampagnenwechsel nicht abgeschlossen.', true);
  } finally {
    main.inert = activationFailed || (!activating && wasInert);
    activating = false; queuedActivation = null; activationJob = null;
    header.inert = false; nav.inert = false;
  }
}
el('campaigns').addEventListener('change', () => { const id = el<HTMLSelectElement>('campaigns').value; if (id) void activate(id); });
el('new-campaign').onclick = () => { el<HTMLDialogElement>('create-dialog').showModal(); };
el('workspace-new-campaign').onclick = () => el<HTMLButtonElement>('new-campaign').click();
el('cancel-create').onclick = () => el<HTMLDialogElement>('create-dialog').close();
el('rename-campaign').onclick = () => {
  if (!workspace) return;
  renameBasis = { token: workspace.token, campaignId: workspace.campaign.id, expectedRevision: workspace.campaign.revision };
  el<HTMLInputElement>('rename-name').value = workspace.campaign.name; el<HTMLDialogElement>('rename-dialog').showModal(); el('rename-name').focus();
};
el('rename-cancel').onclick = () => el<HTMLDialogElement>('rename-dialog').close();
el('rename-form').onsubmit = event => { event.preventDefault(); void (async () => {
  const basis = renameBasis;
  if (!basis || !roomContextCurrent(basis.token)) return;
  const name = el<HTMLInputElement>('rename-name').value;
  try {
    const response = await api.renameCampaign({ ...basis, commandId: crypto.randomUUID(), name });
    if (!roomContextCurrent(basis.token)) return;
    const campaign = unwrap(response); workspace!.campaign = campaign;
    if (renameBasis === basis && el<HTMLInputElement>('rename-name').value === name) el<HTMLDialogElement>('rename-dialog').close();
    await refreshCampaigns();
    if (!roomContextCurrent(basis.token)) return;
    el('map-title').textContent = campaign.name;
    if (renameBasis === basis && el<HTMLInputElement>('rename-name').value === name) status('Kampagnenname gespeichert.');
  } catch (error) { if (roomContextCurrent(basis.token) && renameBasis === basis) status((error as Error).message, true); }
})(); };
el('create-form').addEventListener('submit', event => {
  event.preventDefault();
  const intent = ++activationIntent, token = workspace?.token, name = el<HTMLInputElement>('campaign-name').value;
  const owns = () => intent === activationIntent && token === workspace?.token && !activationJob;
  void (async () => {
    if (!owns() || !(await flushAll()) || !owns()) return;
    try {
      const response = await api.create(name);
      if (!response.ok) { if (owns()) unwrap(response); return; }
      const campaign = response.value;
      if (owns()) el<HTMLDialogElement>('create-dialog').close();
      await refreshCampaigns();
      if (owns()) await activate(campaign.id);
    } catch (error) { if (owns()) status((error as Error).message, true); }
  })();
});
el('add-room').onclick = () => { void (async () => {
  const token = workspace?.token;
  if (!token || !roomContextCurrent(token) || !(await flush()) || !roomContextCurrent(token)) return;
  try {
    const response = await atlasDefaultRoomWrite(token,workspace!.campaign.id);
    if (!roomContextCurrent(token)) return;
    workspace = geometryOnly(unwrap(response)); await reloadDrawing(); await setDraft();
    if (!roomContextCurrent(token)) return;
    renderList(true); updateHistory(); status('Raum angelegt und gespeichert.');
  } catch (error) { if (roomContextCurrent(token)) status((error as Error).message, true); }
})(); };
async function history(direction: 'undo' | 'redo') {
  if (!(await flushDrawing())) return;
  const token = workspace?.token;
  if (!token || !roomContextCurrent(token) || !(await flush()) || !roomContextCurrent(token)) return;
  try {
    const response = await atlasHistoryWrite(token,workspace!.campaign.id,direction);
    if (!roomContextCurrent(token)) return;
    workspace = geometryOnly(unwrap(response)); await reloadDrawing(); await setDraft();
    if (!roomContextCurrent(token)) return;
    renderList(true); updateHistory(); status('Gespeichert.');
  } catch (error) { if (roomContextCurrent(token)) status((error as Error).message, true); }
}
el('undo').onclick = () => { void history('undo'); }; el('redo').onclick = () => { void history('redo'); };
bindAtlasHistoryShortcut(()=>!!campaignAtlas&&!campaignAtlas.root.hidden,()=>composing,direction=>{void history(direction);});
el('import').onclick = () => {
  const intent = ++activationIntent, token = workspace?.token;
  const owns = () => intent === activationIntent && token === workspace?.token && !activationJob;
  void (async () => {
    if (!owns() || !(await flushAll()) || !owns()) return;
    try {
      const response = await api.previewDungeonImport();
      if (!owns()) return;
      const preview = unwrap(response); dungeonImportPreview = preview; if (!preview) return;
      const detail = el('import-detail'); detail.replaceChildren();
      for (const line of [`${preview.name}: ${preview.roomCount} Räume${workspace?' werden in diese Kampagnenwelt eingefügt':' in einer neuen Kampagne'}.`, ...preview.warnings]) { const p = document.createElement('p'); p.textContent = line; detail.append(p); }
      el<HTMLDialogElement>('import-dialog').showModal();
    } catch (error) { if (owns()) status((error as Error).message, true); }
  })();
};
el('workspace-import').onclick = () => el<HTMLButtonElement>('import').click();
el('cancel-import').onclick = () => { dungeonImportPreview = null; activationIntent++; el<HTMLDialogElement>('import-dialog').close(); };
el('confirm-import').onclick = () => {
  const preview = dungeonImportPreview; if (!preview || activationJob) return;
  const intent = ++activationIntent, token = workspace?.token;
  const owns = () => intent === activationIntent && token === workspace?.token && !activationJob;
  void (async () => {
    try {
      if(workspace){const owner=workspace,response=await api.importAtlas({commandId:'atlas-import:'+preview.ticket,token:owner.token,campaignId:owner.campaign.id,ticket:preview.ticket,...(campaignAtlas?.insertionPoint??{x:0,y:0})});if(!owns())return;const result=unwrap(response);dungeonImportPreview=null;el<HTMLDialogElement>('import-dialog').close();await activate(owner.campaign.id);showTab('atlas');if(result.roomId)await campaignAtlas?.navigate('room',result.roomId);return;}
      const response = await api.createCampaignFromDungeon(preview.ticket);
      if (!response.ok) { if (owns()) unwrap(response); return; }
      const campaign = response.value;
      if (owns() && dungeonImportPreview === preview) { dungeonImportPreview = null; el<HTMLDialogElement>('import-dialog').close(); }
      await refreshCampaigns();
      if (owns()) await activate(campaign.id);
    } catch (error) { if (owns()) status((error as Error).message, true); }
  })();
};
initCommitControls(()=>workspace,status);
api.onClose(() => { void (async () => { await stopWorldPlayback();await activationJob; rememberView(); if (await leaveCampaign()) api.closeReady(); })().catch(error => status('Schließen wartet auf einen sicheren Arbeitsstand: ' + error.message, true)); });
for (const id of workspaceTabs) el(id + '-tab').onclick = () => { void (async () => {
  if (await leaveWorkspace()) await reopenView(id);
})().catch(error => status(error.message, true)); };
initWorkspaceNavigation();
initCampaignScreen({currentCampaign:()=>workspace?.campaign.id??null,before:async()=>!workspace||activationFailed||await leaveCampaign(),changed:async()=>{await refreshCampaignShell();},enter:async receipt=>{await activate(receipt.campaignId,receipt.commandId);return!activationFailed&&workspace?.campaign.id===receipt.campaignId;}});
initUpdateUI(async()=>{await activationJob;rememberView();return leaveCampaign();});
void openCampaignScreen(true).then(()=>api.updateRuntimeReady?.()).catch(error=>status('Start konnte nicht abgeschlossen werden: '+error.message,true));
setInterval(() => { void (async () => {
  try { const message = unwrap(await api.backupStatus()); el('backup-status').hidden = !message; el('backup-status').textContent = message; }
  catch { el('backup-status').hidden = false; el('backup-status').textContent = 'Status der Wiederherstellungskopie nicht verfügbar.'; }
})(); }, 5000);

document.addEventListener('atlas-location-request',e=>{const ref=(e as CustomEvent).detail;if(!workspace||!campaignAtlas)return;void (async()=>{if(!await leaveWorkspace())return;showTab('atlas');await campaignAtlas!.navigateLocation(ref.id,ref.sectionId);})().catch(e=>status(e.message,true));});

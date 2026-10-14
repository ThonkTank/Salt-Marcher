import {WorldLinksWorkbench} from './world-links-ui';
import {CampaignAgenda} from './agenda-ui';
import {initSoundboard,activateSoundboard} from './live-soundboard-ui';
import {initQuickReference,activateQuickReference} from './quick-reference-ui';
import {initNarrativeJournal,activateNarrativeJournal} from './narrative-journal-ui';
import {setSessionPacketSurface} from './session-packet-ui';
import {initPartyTopbar,activatePartyTopbar} from './party-topbar-ui';
import {initDayCalculator,activateDayCalculator} from './adventuring-day-ui';
import {initNpcs,activateNpcs,openNpcs,openNpcProfile,flushNpcs} from './npc-ui';
import {initGroups,activateGroups,openGroups,flushGroups} from './groups-ui';
import {refreshProgress} from './progression-ui';
import {initTreasury,activateTreasury,openTreasury,flushTreasury} from './treasury-ui';
import {openExistingCombat} from './combat';
import {initTriggers,activateTriggers,flushTriggers} from './trigger-ui';
import {initExtensions} from './extensions-ui';
import {initDungeonContent,activateDungeonContent,flushDungeonContent} from './dungeon-content-ui';
import {initGraph,activateGraph,flushGraph,syncGraphBanner,refreshOpenGraph} from './graph-ui';
import {initKeys,activateKeys,flushKeys} from './key-ui';
import {initPaths,activatePaths,flushPaths} from './path-ui';
import {initCommitControls} from './commit-confirmation';
import {initVolume,activateVolume,flushVolume} from './volume-ui';
import {DungeonBinder} from './dungeon-binder-ui';
import {initDungeon,activateDungeon,openDungeon,flushDungeon,selectDungeonRoom} from './dungeon-ui';
import {initDrawing,activateDrawing,reloadDrawing,drawingOverlay,roomDrawingStyle,flushDrawing} from './drawing-ui';
import {initAutonomy,activateAutonomy,openAutonomy,flushAutonomy} from './autonomy-ui';
import {initPlayerUI,deactivatePlayer} from './player-ui';
import {initCity,activateCity,openCity,flushCity} from './city-ui';
import {initCampaignManager} from './campaign-manager-ui';
import {initMusic,activateMusic,openMusic,flushMusic,deactivateMusic} from './music-ui';
import {initWorld,activateWorld,openWorld,flushWorld,setWorldSurface} from './world-ui';
import {initItems,activateItems,openItems,flushItems} from './items-ui';
import { validateRoom, type Room, type Workspace, type Result, type ImportPreview, type Edit, type CampaignRename } from './contracts';
import { activatePreparation, initPreparation, flushPreparation, leavePreparation, preparationHasDrafts, openPreparedLocation,openPreparedNote } from './preparation';
import { activateLive, initLive, flushLive,refreshScenePreparation,setGroupNavigation,setNpcNavigation,setTreasureNavigation, openLive, prepareLiveEncounter, addLiveCreature,addLiveNpc,openLiveSoundboard,openTimeNavigator,openTravelRest,useLiveReferenceReadAloud } from './live';
import { initTutorial } from './tutorial';
import { initCatalog, activateCatalog, openCatalog, flushCatalog } from './catalog-ui';
import {initChronicle,activateChronicle,openChronicle} from './chronicle-ui';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const api = window.campaign;
const setWorkspaceAvailable = (available: boolean) => document.body.classList.toggle('has-workspace', available);
let workspace: Workspace | null = null;
let draft: Room | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let pending: Promise<boolean> | null = null;
let composing = false;
let writeBlocked = false;
let failedEdit: Edit | null = null;
let hasRetainedDraft = false;
let roomDraftLoading = false, roomDraftReadFailed = false;
let activating = false, activationFailed = false;
let activationJob: Promise<void> | null = null, queuedActivation: string | null = null;
let activationIntent = 0, campaignListRequest = 0;
let pointer: { index: number; id: number; before: Room['polygons'] } | null = null;
let importPreview: ImportPreview | null = null;
let renameBasis: Omit<CampaignRename, 'commandId' | 'name'> | null = null;
const status = (text: string, error = false) => { el('status').textContent = text; el('status').dataset.error = String(error); };
initExtensions(status);
initChronicle(status,async id=>{if(!(await leaveWorkspace()))return;showTab('preparation');await openPreparedNote(id);});
initPreparation(status, async scopeId => {
  if (!workspace || !(await leaveWorkspace())) return;
  const room = workspace.rooms.find(room => room.scopeId === scopeId);
  if (!room) { status('Diese Zeichnung enthält noch keinen verfügbaren Raum.', true); return; }
  await selectRoom(room.id);
  showTab('atlas');
}, async (planId, visitId) => {
  if (!(await leaveWorkspace())) return;
  showTab('live'); await openLive(planId, visitId);
});
setTreasureNavigation(async id=>{if(!await leaveWorkspace())return;showTab('treasury');await openTreasury(id);});
initDayCalculator(status,()=>el<HTMLButtonElement>('live-tab').click());
initPartyTopbar(()=>el<HTMLButtonElement>('live-tab').click());
initNarrativeJournal(status,leaveWorkspace,async()=>await flushPreparation(true,true),async id=>{if(!await leaveWorkspace())return;showTab('preparation');await openPreparedNote(id);});
const worldLinks=new WorldLinksWorkbench(()=>workspace,leaveWorkspace,status,async ref=>{if(!await leaveWorkspace())return;showTab('preparation');if(ref.kind==='note')await openPreparedNote(ref.id);else await openPreparedLocation(ref.id);});const worldLinksButton=document.createElement('button');worldLinksButton.id='world-links-open';worldLinksButton.type='button';worldLinksButton.textContent='Zusammenhänge';el('narrative-journal-open').after(worldLinksButton);worldLinksButton.onclick=()=>void worldLinks.open().catch(e=>status(e.message,true));
initQuickReference(status,leaveWorkspace,async action=>{
 const token=workspace?.token;if(!token)return;
 if(action.kind==='edit'){showTab('preparation');if(action.content.note)await openPreparedNote(action.content.ref.id);else if(action.content.location)await openPreparedLocation(action.content.ref.id);return;}
 const live=unwrap(await window.campaign.live(token));if(workspace?.token!==token||live.focusId!==action.sceneId)throw new Error('Fokusgruppe geändert. Schnellsuche erneut öffnen.');
 showTab('live');await openLive();if(workspace?.token!==token)return;
 if(action.kind==='read-aloud'&&action.content.note)await useLiveReferenceReadAloud(action.content.note.readAloud,action.content.title,action.sceneId!);
 if(action.kind==='encounter'&&action.content.encounter)await prepareLiveEncounter(action.content.encounter);
 if(action.kind==='creature'&&action.content.creature)await addLiveCreature(action.content.creature.id,action.count!,action.grouped!);
});
initLive(status, async id => {
  if (!(await leaveWorkspace())) return;
  await openPreparedLocation(id); showTab('preparation');
},async id=>{if(!(await leaveWorkspace()))return;showTab('preparation');await openPreparedNote(id);});
initCatalog(status, async plan=>{if(!(await leaveWorkspace()))return;showTab('live');await openLive();await prepareLiveEncounter(plan);}, async(id,count,grouped)=>{if(!(await leaveWorkspace()))return;showTab('live');await openLive();await addLiveCreature(id,count,grouped);});
initNpcs(status,refreshScenePreparation,async id=>{if(!await leaveWorkspace())return;showTab('live');await openLive();await addLiveNpc(id);});
setNpcNavigation(async(id,contact)=>{if(!await leaveWorkspace())return;showTab('groups');await openGroups();await openNpcProfile(id,contact);},async id=>{if(!await leaveWorkspace())return;showTab('autonomy');await openAutonomy(id);});
initGroups(status,refreshScenePreparation,async id=>{if(!await leaveWorkspace())return;showTab('groups');await openGroups(id);await openNpcs(false);});
el('groups-tab').onclick=()=>{void(async()=>{if(!await leaveWorkspace())return;showTab('groups');await openGroups();await openNpcs();})().catch(e=>status(e.message,true));};
setGroupNavigation(async id=>{if(!await leaveWorkspace())return;showTab('groups');await openGroups(id);await openNpcs(false);});
initTreasury(status,async()=>{await refreshProgress();await refreshScenePreparation();},async id=>{if(!await leaveWorkspace())return;showTab('treasury');await openTreasury(id);});
el('treasury-tab').onclick=()=>{void(async()=>{if(!await leaveWorkspace())return;showTab('treasury');await openTreasury();})().catch(e=>status(e.message,true));};
initItems(status,async id=>{if(!(await leaveWorkspace()))return;showTab('items');await openItems(id);});
initDrawing(status,()=>workspace,()=>draft,async()=>{if(activating||activationFailed||roomDraftLoading)return false;return await flushAutonomy()&&await flushCity()&&await flushMusic()&&await flushWorld()&&await flushItems()&&await flushCatalog()&&await flushLive()&&await leavePreparation()&&await flush();},async next=>{workspace=next;await setDraft();renderList();updateHistory();},draw);
initVolume(status,()=>workspace,()=>draft,async()=>{if(activating||activationFailed||roomDraftLoading)return false;return await flushDrawing()&&await flushAutonomy()&&await flushCity()&&await flushMusic()&&await flushWorld()&&await flushItems()&&await flushCatalog()&&await flushLive()&&await leavePreparation()&&await flush();},async next=>{workspace=next;await setDraft();renderList();updateHistory();await reloadDrawing();draw();});
initTriggers(status,()=>workspace,()=>draft,async()=>{if(activating||activationFailed||roomDraftLoading)return false;return await flushDungeonContent()&&await flushGraph()&&await flushKeys()&&await flushPaths()&&await flushVolume()&&await flushDrawing()&&await flushAutonomy()&&await flushCity()&&await flushMusic()&&await flushWorld()&&await flushItems()&&await flushCatalog()&&await flushLive()&&await leavePreparation()&&await flush();},async next=>{workspace=next;await setDraft();renderList();updateHistory();await reloadDrawing();draw();});
initDungeonContent(status,()=>workspace,()=>draft,async()=>{if(activating||activationFailed||roomDraftLoading)return false;return await flushGraph()&&await flushKeys()&&await flushPaths()&&await flushVolume()&&await flushDrawing()&&await flushAutonomy()&&await flushCity()&&await flushMusic()&&await flushWorld()&&await flushItems()&&await flushCatalog()&&await flushLive()&&await leavePreparation()&&await flush();},async next=>{workspace=next;await setDraft();renderList();updateHistory();await reloadDrawing();draw();},refreshOpenGraph);
initGraph(status,()=>workspace,()=>draft,async()=>{if(activating||activationFailed||roomDraftLoading)return false;return await flushKeys()&&await flushPaths()&&await flushVolume()&&await flushDrawing()&&await flushAutonomy()&&await flushCity()&&await flushMusic()&&await flushWorld()&&await flushItems()&&await flushCatalog()&&await flushLive()&&await leavePreparation()&&await flush();},async next=>{workspace=next;await setDraft();renderList();updateHistory();await reloadDrawing();draw();},()=>showTab('atlas'),selectRoom);
initKeys(status,()=>workspace,()=>draft,async()=>{if(activating||activationFailed||roomDraftLoading)return false;return await flushPaths()&&await flushVolume()&&await flushDrawing()&&await flushAutonomy()&&await flushCity()&&await flushMusic()&&await flushWorld()&&await flushItems()&&await flushCatalog()&&await flushLive()&&await leavePreparation()&&await flush();},async next=>{workspace=next;await setDraft();renderList();updateHistory();await reloadDrawing();draw();},selectRoom);
initPaths(status,()=>workspace,()=>draft,async()=>{if(activating||activationFailed||roomDraftLoading)return false;return await flushVolume()&&await flushDrawing()&&await flushAutonomy()&&await flushCity()&&await flushMusic()&&await flushWorld()&&await flushItems()&&await flushCatalog()&&await flushLive()&&await leavePreparation()&&await flush();},async next=>{workspace=next;await setDraft();renderList();updateHistory();await reloadDrawing();draw();});
initDungeon(status,id=>{void(async()=>{if(!(await leaveWorkspace()))return;showTab('live');await openLive();await openExistingCombat(id);})().catch(error=>status(error.message,true));});
const dungeonBinder=new DungeonBinder(()=>workspace,leaveWorkspace,status,async(id,action)=>{const token=workspace?.token;if(!token||!await leaveWorkspace()||workspace?.token!==token)return;if(action==='target'){showTab('dungeon');await selectDungeonRoom(id);}else{showTab('atlas');await selectRoom(id);if(action==='edit'&&workspace?.token===token&&workspace.selectedId===id)el('key-open').click();}});
el('dungeon-tab').onclick=()=>{void(async()=>{if(!(await leaveWorkspace()))return;showTab('dungeon');await openDungeon();})().catch(error=>status(error.message,true));};
initAutonomy(status);
el('autonomy-tab').onclick=()=>{void(async()=>{if(!(await leaveWorkspace()))return;showTab('autonomy');await openAutonomy();})().catch(error=>status(error.message,true));};
initCity(status);
el('city-tab').onclick=()=>{void(async()=>{if(!(await leaveWorkspace()))return;showTab('city');await openCity();})().catch(error=>status(error.message,true));};
initWorld(status,flushLive,async()=>{await openLive();},async()=>{if(!(await leaveWorkspace()))return;showTab('world');await openWorld();},async(sceneId,kind)=>{if(kind==='wait')await openTimeNavigator(undefined,sceneId);else await openTravelRest(sceneId);});
const campaignAgenda=new CampaignAgenda(()=>workspace,leaveWorkspace,status,async kind=>{if(!await leaveWorkspace())return;showTab(kind);if(kind==='world')await openWorld();else await openLive();},async target=>{if(!await leaveWorkspace())return;showTab('live');await openLive();await openTimeNavigator(target);});
initMusic(status,async()=>{if(!(await leaveWorkspace()))return;showTab('music');await openMusic();});
initSoundboard(status,async()=>{if(!await leaveWorkspace())return;showTab('music');await openMusic();},async()=>{if(!await leaveWorkspace())return;showTab('live');await openLive();await openLiveSoundboard();});
el('music-tab').onclick=()=>{void(async()=>{if(!(await leaveWorkspace()))return;showTab('music');await openMusic();})().catch(error=>status(error.message,true));};
el('world-tab').onclick=()=>{void(async()=>{if(!(await leaveWorkspace()))return;showTab('world');await openWorld();})().catch(error=>status(error.message,true));};
el('items-tab').onclick=()=>{void(async()=>{if(!(await leaveWorkspace()))return;showTab('items');await openItems();})().catch(error=>status(error.message,true));};
el('catalog-tab').onclick=()=>{void(async()=>{if(!(await leaveWorkspace()))return;showTab('catalog');await openCatalog();})();};
el('chronicle-tab').onclick=()=>{void(async()=>{if(!(await leaveWorkspace()))return;showTab('chronicle');await openChronicle();})().catch(error=>status(error.message,true));};
function showTab(selected: 'groups' | 'treasury' | 'atlas' | 'preparation' | 'live' | 'chronicle' | 'catalog' | 'items' | 'world' | 'music' | 'city' | 'autonomy' | 'dungeon') {
  setWorldSurface(selected);setSessionPacketSurface(selected);
  for (const id of ['groups','treasury','atlas', 'preparation', 'live', 'chronicle', 'catalog', 'items', 'world', 'music', 'city', 'autonomy', 'dungeon']) { el(id).hidden = id !== selected; el(id + '-tab').setAttribute('aria-pressed', String(id === selected)); }
}
initPlayerUI(status,()=>workspace,leaveWorkspace);
initCampaignManager(status,()=>workspace,leaveWorkspace,async id=>{const list=await refreshCampaigns();if(!list)return;if(workspace&&!list.campaigns.some(c=>c.id===workspace!.campaign.id)){workspace=null;draft=null;setWorkspaceAvailable(false);deactivateMusic();deactivatePlayer();showTab('atlas');document.querySelector('main')!.inert=true;}const target=id??(!workspace?list.activeId??list.campaigns[0]?.id:null);if(target)await activate(target);else if(!workspace){setWorkspaceAvailable(false);el('map-title').textContent='Keine Kampagne geöffnet';el('rooms').replaceChildren();el<HTMLSelectElement>('campaigns').value='';}});
void initTutorial();
async function flushAll() { return await worldLinks.flush() && await flushNpcs() && await flushGroups() && await flushTreasury() && await flushTriggers() && await flushDungeonContent() && await flushGraph() && await flushKeys() && await flushPaths() && await flushVolume() && await flushDungeon() && await flushDrawing() && await flushAutonomy() && await flushCity() && await flushMusic() && await flushWorld() && await flushItems() && await flushCatalog() && await flushLive() && await flushPreparation() && await flush(); }
async function leaveWorkspace() {
  if(!await worldLinks.flush())return false;
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
    unwrap(await api.keepRoomDraft(workspace.token, draft.id, { room: draft, points: el<HTMLTextAreaElement>('points').value, pointsChanged: el('points').dataset.changed === 'true', failedEdit }));
    hasRetainedDraft = true;
    return true;
  } catch (error) { status('Entwurf konnte nicht gesichert werden: ' + (error as Error).message, true); return false; }
}
const unwrap = <T>(result: Result<T>): T => { if (!result.ok) throw new Error(result.error); return result.value; };
const selected = () => workspace?.rooms.find(room => room.id === workspace?.selectedId);
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
    try {
      const next = unwrap(await api.edit(request));
      if (workspace?.token !== token) return false;
      workspace = { ...workspace, rooms: workspace.rooms.map(room => room.id === next.room.id ? next.room : room), canUndo: next.canUndo, canRedo: next.canRedo, selectedId: after.id };
      if (draft?.id === after.id) draft.revision = next.room.revision;
      hasRetainedDraft = false;
      if (JSON.stringify(before.polygons) !== JSON.stringify(after.polygons)) fit();
      renderList(); updateHistory(); draw();
      status(draft && !same(after, draft) ? 'Weitere Eingabe offen – noch nicht gespeichert.' : 'Gespeichert.');
      return true;
    } catch (error) { writeBlocked = true; failedEdit = request; el('error-actions').hidden = false; status((error as Error).message + ' Entwurf bleibt offen; Schreiben gesperrt bis zur Aufklärung.', true); return false; }
    finally { pending = null; }
  })();
  const okay = await pending;
  return okay ? flush() : false;
}
function readPoints() {
  if (!draft) return;
  const input = el<HTMLTextAreaElement>('points');
  if (input.dataset.changed !== 'true') return;
  const points = input.value.split('\n').filter(line => line.trim()).map(line => {
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
    const label = document.createElement('label'); label.textContent = section.kind === 'markdown' ? `Key-Abschnitt ${index + 1}` : `Passage ${index + 1}`;
    if (section.kind !== 'markdown') { const text = document.createElement('p'); text.textContent = `Türbindung: ${section.doorId} (hier noch nicht bearbeitbar)`; el('keys').append(label, text); return; }
    const input = document.createElement('textarea'); input.id = `key-${index}`; label.htmlFor = input.id; input.rows = 8; input.value = section.markdown!;
    input.addEventListener('input', () => {
      if (roomDraftLoading || roomDraftReadFailed || activationJob || activating || activationFailed || workspace?.token !== token || draft?.id !== room.id) return;
      // HTML textareas normalize CRLF; an untouched value must preserve imported bytes.
      draft!.sections[index]!.markdown = input.value === section.markdown!.replace(/\r\n?/g, '\n') ? section.markdown : input.value;
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
  const room = selected(); draft = room ? structuredClone(room) : null;
  const token = workspace?.token;
  writeBlocked = false; failedEdit = null; roomDraftReadFailed = false; el('error-actions').hidden = true;
  hasRetainedDraft = false;
  el('editor').hidden = !room; el('empty').hidden = !!room;
  el('keys').replaceChildren();
  if (!room) { roomEditable(false); draw(); return; }
  const floors = el<HTMLSelectElement>('floors'); floors.replaceChildren();
  for (const floor of workspace!.floors) { const option = document.createElement('option'); option.value = JSON.stringify([floor.scopeId, floor.id]); option.textContent = floor.name; floors.append(option); }
  floors.value = JSON.stringify([room.scopeId, room.floorId]);
  renderRoomInputs(room, token);
  updatePoints(); fit(); draw();
  if (room && token) {
    roomDraftLoading = true; roomEditable(false); updateHistory(); status('Arbeitsentwurf wird geprüft und geladen.');
    try {
      const retained = unwrap(await api.roomDraft(token, room.id));
      if (!retained || workspace?.token !== token || workspace.selectedId !== room.id) return;
      draft = structuredClone(retained.room); hasRetainedDraft = true;
      renderRoomInputs(draft, token);
      el<HTMLTextAreaElement>('points').value = retained.points; el('points').dataset.changed = String(retained.pointsChanged);
      failedEdit = retained.failedEdit; writeBlocked = !!failedEdit;
      el('error-actions').hidden = !writeBlocked;
      fit(); draw(); status('Arbeitsentwurf wiederaufgenommen. Die Änderung ist noch nicht als Autorenstand gespeichert.', true);
    } catch (error) {
      if (workspace?.token !== token || workspace.selectedId !== room.id) return;
      roomDraftReadFailed = true; writeBlocked = true;
      status('Arbeitsentwurf konnte nicht gelesen werden. Originalbytes bleiben erhalten; dieser Raum bleibt schreibgeschützt: ' + (error as Error).message, true);
    } finally {
      if (workspace?.token === token && workspace.selectedId === room.id) {
        roomDraftLoading = false; roomEditable(!roomDraftReadFailed); updateHistory();
      }
    }
  }
}
function updatePoints() { if (draft) { const field = el<HTMLTextAreaElement>('points'); field.value = draft.polygons[0]!.outer.map(p => `${p.x}, ${p.y}`).join('\n'); field.dataset.changed = 'false'; } }
function updateHistory() {
  el<HTMLButtonElement>('undo').disabled = roomDraftLoading || roomDraftReadFailed || !workspace?.canUndo;
  el<HTMLButtonElement>('redo').disabled = roomDraftLoading || roomDraftReadFailed || !workspace?.canRedo;
  el<HTMLButtonElement>('add-room').disabled = !workspace;
  el<HTMLButtonElement>('rename-campaign').disabled = !workspace;
}
function renderList() {
  const needle = el<HTMLInputElement>('search').value.toLocaleLowerCase(); el('rooms').replaceChildren();
  const matches = workspace?.rooms.filter(r => `${r.number} ${r.name} ${r.sections.map(s => s.markdown ?? '').join('\n')}`.toLocaleLowerCase().includes(needle)) ?? [];
  for (const room of matches) {
    const button = document.createElement('button'); button.textContent = `${room.number}. ${room.name}`; button.setAttribute('aria-pressed', String(room.id === workspace?.selectedId));
    button.onclick = () => { void selectRoom(room.id); }; el('rooms').append(button);
  }
  if (workspace && !matches.length) { const hint = document.createElement('p'); hint.textContent = needle ? 'Keine Räume gefunden.' : 'Noch keine Räume. Raum anlegen oder Dungeon übernehmen.'; el('rooms').append(hint); }
  for (const problem of workspace?.problems ?? []) { const hint = document.createElement('p'); hint.setAttribute('role', 'alert'); hint.textContent = `Raum ${problem.number} gesperrt: ${problem.message}`; el('rooms').append(hint); }
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
function draw() {
  syncGraphBanner(workspace);
  const map = el<HTMLElement>('map'); map.replaceChildren();
  for (const saved of workspace?.rooms ?? []) {
    const room = draft?.id === saved.id ? draft : saved;
    if (JSON.stringify([room.scopeId, room.floorId]) !== el<HTMLSelectElement>('floors').value) continue;
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
    const title = svgElement('title', {}); title.textContent = `${room.number}. ${room.name}`; shape.append(title);
    shape.addEventListener('click', () => { void selectRoom(room.id); }); map.append(shape);
  }
  drawingOverlay(map as unknown as SVGSVGElement);
  if (!draft||JSON.stringify([draft.scopeId,draft.floorId])!==el<HTMLSelectElement>('floors').value) return;
  const box = (map as unknown as SVGSVGElement).viewBox.baseVal;
  draft.polygons[0]!.outer.forEach((p, index) => {
    const handle = svgElement('circle', { cx: String(p.x), cy: String(p.y), r: String(box.width / 85), class: 'handle' });
    handle.addEventListener('pointerdown', event => {
      if (pending || composing || pointer || roomDraftLoading || roomDraftReadFailed || activationJob || activating || activationFailed) return;
      pointer = { index, id: (event as PointerEvent).pointerId, before: structuredClone(draft!.polygons) }; (map as unknown as SVGSVGElement).setPointerCapture(pointer.id); event.preventDefault();
    }); map.append(handle);
  });
}
function fit() {
  const points = (draft ? [draft] : workspace?.rooms ?? []).flatMap(room => room.polygons.flatMap(p => p.outer));
  if (!points.length) return;
  const xs = points.map(p => p.x), ys = points.map(p => p.y), x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
  const pad = Math.max(w, h) * .18 + .5;
  el('map').setAttribute('viewBox', `${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}`);
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
  const key = el<HTMLSelectElement>('floors').value, room = workspace.rooms.find(r => JSON.stringify([r.scopeId, r.floorId]) === key);
  if (room) await selectRoom(room.id); else { draft = null; el('editor').hidden = true; el('empty').hidden = false; draw(); }
})(); });
el('fit').onclick = () => { fit(); draw(); };
el('search').addEventListener('input', renderList);
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
    workspace = { ...result.workspace, selectedId: edit.roomId };
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
    workspace = current; writeBlocked = false; failedEdit = null; el('error-actions').hidden = true;
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
function activate(id: string): Promise<void> {
  activationIntent++; queuedActivation = id;
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
    if (!(await leaveWorkspace())) { el<HTMLSelectElement>('campaigns').value = workspace?.campaign.id ?? ''; return; }
    activating = true; activationFailed = false; deactivateMusic();deactivatePlayer();
    status('Kampagne wird geladen.');
    while (queuedActivation !== null) {
      const id = queuedActivation; queuedActivation = null;
      try {
        const next = unwrap(await api.activate(id));
        if (queuedActivation !== null) continue; // A newer intent owns the forthcoming projection.
        workspace = next; setWorkspaceAvailable(true); el<HTMLSelectElement>('campaigns').value = id;
        activateLive(next);activateDayCalculator(next);activatePartyTopbar(next);activateNarrativeJournal(next);activateQuickReference(next);worldLinks.contextChanged();el<HTMLButtonElement>('narrative-journal-open').disabled=false; activateChronicle(next); activateCatalog(next); activateItems(next);activateTreasury(next);activateGroups(next);activateNpcs(next); activateWorld(next); activateCity(next); activateAutonomy(next); activateDungeon(next); dungeonBinder.reset(); campaignAgenda.reset(); activateVolume(); activatePaths();activateKeys();activateGraph();activateDungeonContent();activateTriggers(); void activateDrawing(next); activateSoundboard(next);activateMusic(next);
        await activatePreparation(next);
        if (queuedActivation !== null) continue;
        el('map-title').textContent = next.campaign.name; el<HTMLInputElement>('search').value = '';
        await setDraft();
        if (queuedActivation !== null) continue;
        renderList(); updateHistory();
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
    const response = await api.addRoom(token);
    if (!roomContextCurrent(token)) return;
    workspace = unwrap(response); await setDraft();
    if (!roomContextCurrent(token)) return;
    renderList(); updateHistory(); status('Raum angelegt und gespeichert.');
  } catch (error) { if (roomContextCurrent(token)) status((error as Error).message, true); }
})(); };
async function history(direction: 'undo' | 'redo') {
  if (!(await flushDrawing())) return;
  const token = workspace?.token;
  if (!token || !roomContextCurrent(token) || !(await flush()) || !roomContextCurrent(token)) return;
  try {
    const response = await api.history(token, direction);
    if (!roomContextCurrent(token)) return;
    workspace = unwrap(response); await reloadDrawing(); await setDraft();
    if (!roomContextCurrent(token)) return;
    renderList(); updateHistory(); status('Gespeichert.');
  } catch (error) { if (roomContextCurrent(token)) status((error as Error).message, true); }
}
el('undo').onclick = () => { void history('undo'); }; el('redo').onclick = () => { void history('redo'); };
document.addEventListener('keydown', event => {
  if (el('atlas').hidden) return;
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z' || composing || (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName))) return;
  event.preventDefault(); void history(event.shiftKey ? 'redo' : 'undo');
});
el('import').onclick = () => {
  const intent = ++activationIntent, token = workspace?.token;
  const owns = () => intent === activationIntent && token === workspace?.token && !activationJob;
  void (async () => {
    if (!owns() || !(await flushAll()) || !owns()) return;
    try {
      const response = await api.previewImport();
      if (!owns()) return;
      const preview = unwrap(response); importPreview = preview; if (!preview) return;
      const detail = el('import-detail'); detail.replaceChildren();
      for (const line of [`${preview.name}: ${preview.roomCount} Räume.`, ...preview.warnings]) { const p = document.createElement('p'); p.textContent = line; detail.append(p); }
      el<HTMLDialogElement>('import-dialog').showModal();
    } catch (error) { if (owns()) status((error as Error).message, true); }
  })();
};
el('workspace-import').onclick = () => el<HTMLButtonElement>('import').click();
el('cancel-import').onclick = () => { importPreview = null; activationIntent++; el<HTMLDialogElement>('import-dialog').close(); };
el('confirm-import').onclick = () => {
  const preview = importPreview; if (!preview || activationJob) return;
  const intent = ++activationIntent, token = workspace?.token;
  const owns = () => intent === activationIntent && token === workspace?.token && !activationJob;
  void (async () => {
    try {
      const response = await api.import(preview.ticket);
      if (!response.ok) { if (owns()) unwrap(response); return; }
      const campaign = response.value;
      if (owns() && importPreview === preview) { importPreview = null; el<HTMLDialogElement>('import-dialog').close(); }
      await refreshCampaigns();
      if (owns()) await activate(campaign.id);
    } catch (error) { if (owns()) status((error as Error).message, true); }
  })();
};
initCommitControls(()=>workspace,status);
api.onClose(() => { void (async () => { await activationJob; if (await leaveWorkspace()) api.closeReady(); })().catch(error => status('Schließen wartet auf einen sicheren Arbeitsstand: ' + error.message, true)); });
for (const id of ['atlas', 'preparation', 'live'] as const) el(id + '-tab').onclick = () => { void (async () => {
  if (!(await leaveWorkspace())) return;
  showTab(id);
  if (id === 'live') await openLive();
  if (id === 'atlas') await reloadDrawing();
})(); };
void (async () => { const intent = activationIntent; try { const list = await refreshCampaigns(); if (list && intent === activationIntent && list.activeId) await activate(list.activeId); else if (list && intent === activationIntent) setWorkspaceAvailable(false); } catch (error) { if (intent === activationIntent) status((error as Error).message, true); } })();
setInterval(() => { void (async () => {
  try { const message = unwrap(await api.backupStatus()); el('backup-status').hidden = !message; el('backup-status').textContent = message; }
  catch { el('backup-status').hidden = false; el('backup-status').textContent = 'Status der Wiederherstellungskopie nicht verfügbar.'; }
})(); }, 5000);

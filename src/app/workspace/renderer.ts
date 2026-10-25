import { createWorkspaceEditors } from './workspace-editors';
import { editorSession as atlasEditorSession } from '../atlas/campaign-atlas-author';
import { EditorSession } from '../shared/editor-session';
import { initUpdateUI } from './update-ui';
import { initNumberInputScroll } from '../shared/number-input-scroll';
import { workspaceGeometryOnly as geometryOnly } from '../atlas/atlas-render-view';
import { setLiveAtlasSurface } from '../runtime/live-hex-surface';
import { CampaignAtlasWorkbench } from '../atlas/campaign-atlas-ui';
import {
  hideCampaignScreen,
  initCampaignScreen,
  openCampaignScreen,
} from '../campaign/campaign-screen-ui';
import { initWorkspaceNavigation, syncWorkspaceNavigation } from './workspace-navigation';
import {
  readWorkspaceView,
  rememberWorkspaceView,
  WorkspacePositions,
  workspaceTabs,
  type WorkspaceTab,
} from './workspace-view';
import { bindAtlasHistoryShortcut } from './workspace-shortcuts';
import { chooseNpcPlace } from '../campaign/npc-places-ui';
import { openGenerationSource } from '../campaign/generation-ui';
import { createPreparation } from '../campaign/preparation';
import { LocationNotebook } from '../campaign/location-notebook-ui';
import { WorldLinksWorkbench } from '../campaign/world-links-ui';
import { CampaignAgenda } from '../runtime/agenda-ui';
import { activateSoundboard, initSoundboard } from '../runtime/live-soundboard-ui';
import {
  activateQuickReference,
  initQuickReference,
  inspectQuickReference,
} from '../catalog/quick-reference-ui';
import { activateNarrativeJournal, initNarrativeJournal } from '../runtime/narrative-journal-ui';
import {
  closeSessionPacket,
  openPreparationSessionPacket,
  setSessionPacketSurface,
} from '../campaign/session-packet-ui';
import { activatePartyTopbar, initPartyTopbar } from '../runtime/party-topbar-ui';
import { activateDayCalculator, initDayCalculator } from '../runtime/adventuring-day-ui';
import {
  createNpcAtLocation,
  initNpcs,
  openNpcProfile,
  openNpcs,
  prepareNpcLocation,
  setNpcPlaceNavigation,
} from '../campaign/npc-ui';
import {
  createGroupAtLocation,
  initGroups,
  openGroups,
  prepareGroupLocation,
} from '../campaign/groups-ui';
import { refreshProgress } from '../runtime/progression-ui';
import { initTreasury, openTreasury } from '../runtime/treasury-ui';
import { createCombat } from '../runtime/combat';
import { initTriggers } from '../runtime/trigger-ui';
import { initExtensions } from './extensions-ui';
import { initDungeonContent } from '../atlas/dungeon-content-ui';
import { initGraph, refreshOpenGraph } from '../atlas/graph-ui';
import { initKeys, openNoteRoomKey, openRoomKey, setKeyReferenceStatus } from '../campaign/key-ui';
import { initPaths } from '../atlas/path-ui';
import { initCommitControls } from '../shared/commit-confirmation';
import { initVolume } from '../atlas/volume-ui';
import { DungeonBinder } from '../atlas/dungeon-binder-ui';
import { initDungeon, openDungeon, selectDungeonRoom } from '../atlas/dungeon-ui';
import { initDrawing, reloadDrawing } from '../atlas/drawing-ui';
import { initAutonomy, openAutonomy } from '../runtime/autonomy-ui';
import { deactivatePlayer, initPlayerUI } from '../runtime/player-ui';
import { initCity, openCity, prepareCityPersonBinding } from '../atlas/city-ui';
import { initCampaignActions, initCampaignManager } from '../campaign/campaign-manager-ui';
import { initMusic, openMusic } from '../runtime/music-ui';
import {
  initWorld,
  openWorld,
  openWorldCalendar,
  setWorldSurface,
  stopWorldPlayback,
} from '../runtime/world-ui';
import {
  createShopAtLocation,
  initItems,
  openItemReference,
  openItems,
  prepareShopLocation,
} from '../catalog/items-ui';
import { type Result, type WorkspaceGeometry } from '../shared/contracts';
import { createLive } from '../runtime/live';
import { initTutorial } from './tutorial';
import { initCatalog, openCatalog, openCatalogReference } from '../catalog/catalog-ui';
import {
  activateChronicle,
  initChronicle,
  openChronicle,
  suspendChronicle,
} from '../runtime/chronicle-ui';
import { createRoomEditor } from '../atlas/room-editor-ui';
export const editorSession = new EditorSession();
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const api = window.campaign;
initNumberInputScroll(document);
const setWorkspaceAvailable = (available: boolean) =>
  document.body.classList.toggle('has-workspace', available);
let workspace: WorkspaceGeometry | null = null;
let activeTab: WorkspaceTab = 'atlas';
let campaignAtlas: CampaignAtlasWorkbench | null = null;
const workspacePositions = new WorkspacePositions();
let viewRequest = 0;
// New input owns the view, including while an area is still loading.
for (const type of ['pointerdown', 'wheel', 'keydown'])
  window.addEventListener(
    type,
    () => {
      viewRequest++;
    },
    { capture: true, passive: true },
  );
const viewStorage = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
};
function rememberView() {
  if (!workspace) return;
  workspacePositions.capture(workspace.campaign.id, window.scrollY);
  // Open reference/profile sections can change the document height on restart.
  // Resume visible writing by its own position rather than a pixel in that old layout.
  const notes = activeTab === 'live' ? el('running-notes').getBoundingClientRect() : null;
  const liveNotesTop =
    notes && notes.height > 0 && notes.bottom > 0 && notes.top < window.innerHeight
      ? notes.top
      : undefined;
  const combat =
    activeTab === 'live' && !el('combat-panel').hidden
      ? el('combat-panel').getBoundingClientRect()
      : null;
  const liveCombat =
    combat &&
    Math.min(combat.bottom, window.innerHeight) - Math.max(combat.top, 0) > window.innerHeight / 2
      ? true
      : undefined;
  rememberWorkspaceView(viewStorage, workspace.campaign.id, {
    tab: activeTab,
    scrollY: window.scrollY,
    liveNotesTop,
    liveCombat,
  });
}
let activating = false,
  activationFailed = false;
let activationJob: Promise<void> | null = null,
  queuedActivation: { id: string; entryCommandId?: string } | null = null;
let activationIntent = 0,
  campaignListRequest = 0;
const status = (text: string, error = false) => {
  el('status').textContent = text;
  el('status').dataset.error = String(error);
};
const roomEditor = createRoomEditor(
  {
    get workspace() {
      return workspace;
    },
    set workspace(value) {
      workspace = value;
    },
    get transitionPending() {
      return !!activationJob;
    },
    get activating() {
      return activating;
    },
    get activationFailed() {
      return activationFailed;
    },
    leaveWorkspace,
    navigateRoom: (id) => campaignAtlas?.navigate('room', id),
    status,
  },
  editorSession,
);
const preparationEditor = createPreparation({
  roots: ['preparation', 'world-dialog', 'location-dialog', 'note-excerpt-dialog'].map(el),
  dialogHost: el('preparation'),
  api: window.campaign,
  storage: window.localStorage,
  navigation: {
    locationNotebook: (id) => locationNotebook.open(id),
    roomKey: (id, current, restore, source) =>
      openNoteRoomKey(
        id,
        current,
        () => {
          if (current()) {
            showTab('preparation');
            restore();
          }
        },
        source,
      ),
  },
});
const {
  createNarrativeAtLocation,
  ensurePreparation,
  flushPreparation,
  initPreparation,
  openPreparedLocation,
  openPreparedNote,
  openPreparedPlan,
  openPreparedVisit,
  preparationHasDrafts,
  prepareNextVisit,
  prepareNoteLocation,
  showDayPreparation,
} = preparationEditor;
const combatEditor = createCombat({
  roots: ['combat-panel', 'combat-finish-dialog', 'combat-initiative-dialog'].map(el),
  api: window.campaign,
  matchMedia: (query) => window.matchMedia(query),
  requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
  navigation: {
    scene: () => el('running-editor').scrollIntoView({ block: 'start' }),
    available: (available) => {
      el('combat-resume').hidden = !available;
    },
    npc: async (id, current) => {
      if (!current() || !(await leaveWorkspace()) || !current()) return;
      showTab('groups');
      await openNpcProfile(id, undefined, current);
    },
  },
});
const { openExistingCombat } = combatEditor;
el('combat-resume').onclick = () => combatEditor.revealCombat();
const liveEditor = createLive({
  combat: combatEditor,
  roots: [
    'live',
    'character-dialog',
    'adoption-dialog',
    'move-dialog',
    'live-health-dialog',
    'archive-dialog',
  ].map(el),
  dialogHost: el('live'),
  api: window.campaign,
  confirm: (message) => window.confirm(message),
  height: () => window.innerHeight,
  navigation: {
    treasure: async (id) => {
      if (!(await leaveWorkspace())) return;
      showTab('treasury');
      await openTreasury(id);
    },
    group: async (id, current = () => true) => {
      if (!(await leaveWorkspace()) || !current()) return;
      showTab('groups');
      await openGroups(id);
      if (current()) await openNpcs(false);
    },
    npc: async (id, contact, current) => {
      if (!(await leaveWorkspace()) || !current()) return;
      showTab('groups');
      await openGroups();
      if (current()) await openNpcProfile(id, contact, current);
    },
    npcAutonomy: async (id, current) => {
      if (!(await leaveWorkspace()) || !current()) return;
      showTab('autonomy');
      await openAutonomy(id);
    },
    npcPlaces: (...args) => navigateNpcPlaces(...args),
    partyAward: () => {
      const popover = el('party-popover');
      if (!popover.matches(':popover-open')) popover.showPopover();
      el('party-award-open').click();
    },
  },
});
const {
  addLiveCreature,
  addLiveNpc,
  flushLive,
  initLive,
  openLive,
  openLiveCharacterLoot,
  openLiveSoundboard,
  openPlannedVisitReview,
  openTimeNavigator,
  openTravelRest,
  prepareLiveEncounter,
  refreshScenePreparation,
  useLiveReferenceReadAloud,
} = liveEditor;
const editors = createWorkspaceEditors({
  combat: combatEditor,
  live: liveEditor,
  preparation: preparationEditor,
  atlas: {
    session: atlasEditorSession,
    activate: (w) => campaignAtlas?.activate(w),
    flush: async () => !campaignAtlas || (await campaignAtlas.flush()),
  },
  room: { session: editorSession, flush: roomEditor.flush, leave: roomEditor.leaveRoom },
  beforeTool: () => !activating && !activationFailed && !roomEditor.loading,
  gate: () => {
    if (activating) {
      status('Kampagne wird noch geladen.');
      return false;
    }
    if (activationFailed) return 'complete'; // Source input was drained before the failed read.
    if (roomEditor.loading) {
      status('Arbeitsentwurf wird noch geprüft und geladen.');
      return false;
    }
    return true;
  },
  views: [
    {
      id: 'day-calculator',
      order: 2,
      activate: activateDayCalculator,
      deactivate: () => activateDayCalculator(null),
    },
    {
      id: 'party-topbar',
      order: 3,
      activate: activatePartyTopbar,
      deactivate: () => activatePartyTopbar(null),
    },
    { id: 'narrative-journal', order: 4, activate: activateNarrativeJournal },
    { id: 'quick-reference', order: 5, activate: activateQuickReference },
    {
      id: 'world-links',
      order: 6,
      activate: () => {
        worldLinks.contextChanged();
        locationNotebook.contextChanged();
        locationReturn.hidden = true;
        el<HTMLButtonElement>('narrative-journal-open').disabled = false;
      },
    },
    { id: 'chronicle', order: 7, activate: activateChronicle },
    { id: 'dungeon-binder', order: 17, activate: () => dungeonBinder.reset() },
    { id: 'campaign-agenda', order: 18, activate: () => campaignAgenda.reset() },
    { id: 'soundboard', order: 27, activate: activateSoundboard },
    {
      id: 'player-display',
      order: 30,
      activate: () => {},
      deactivate: deactivatePlayer,
      suspendBeforeActivation: true,
    },
  ],
});
for (const event of [
  'input',
  'change',
  'compositionstart',
  'compositionend',
  'pointerdown',
  'pointerup',
])
  window.addEventListener(event, () => editors.changed(), { capture: true });
initExtensions(status);
initChronicle(status, async (id, token) => {
  if (!(await leaveWorkspace()) || workspace?.token !== token) return;
  showTab('preparation');
  await openPreparedNote(id);
});
initPreparation(
  (text, error) => {
    status(text, error);
    setKeyReferenceStatus(text, error);
  },
  async (scopeId) => {
    if (!workspace || !(await leaveWorkspace())) return;
    const room = workspace.rooms.find((room) => room.scopeId === scopeId);
    if (!room) {
      status('Diese Zeichnung enthält noch keinen verfügbaren Raum.', true);
      return;
    }
    await roomEditor.selectRoom(room.id);
    showTab('atlas');
  },
  async (planId, visitId, sourceCurrent = () => true) => {
    const owner = workspace;
    if (
      !owner ||
      !sourceCurrent() ||
      !(await leaveWorkspace()) ||
      workspace !== owner ||
      !sourceCurrent()
    )
      return;
    closeSessionPacket();
    showTab('live');
    await openPlannedVisitReview(planId, visitId, () => workspace === owner);
  },
  async (id, current) => {
    const editor = el('note-editor'),
      mount = editor.parentElement,
      parent = editor.closest<HTMLDialogElement>('dialog');
    await inspectQuickReference(
      { kind: 'note', id },
      () => current() && editor.parentElement === mount,
      parent,
    );
  },
);

initDayCalculator(
  status,
  () => el<HTMLButtonElement>('party-shortcut').click(),
  () => el<HTMLButtonElement>('catalog-tab').click(),
);
initPartyTopbar(() => el<HTMLButtonElement>('live-tab').click(), liveEditor);
initNarrativeJournal(
  status,
  leaveWorkspace,
  async () => await flushPreparation(true, true),
  async (id) => {
    if (!(await leaveWorkspace())) return;
    showTab('preparation');
    await openPreparedNote(id);
  },
);
const locationNotebook = new LocationNotebook(
  () => workspace,
  leaveWorkspace,
  status,
  async (action) => {
    const owner = workspace,
      token = owner?.token,
      campaignId = owner?.campaign.id,
      current = () =>
        workspace === owner && workspace?.token === token && workspace?.campaign.id === campaignId;
    if (!token || !(await leaveWorkspace()) || !current()) return;
    if (action.origin) setLocationReturn(token, action.origin.id, action.origin.title);
    if (action.kind === 'city-person') {
      showTab('city');
      await prepareCityPersonBinding(action.assignment);
    } else if (action.kind === 'city-unit') {
      showTab('atlas');
      await campaignAtlas?.navigate('city', action.id, action.unitId);
    } else if (action.kind === 'room') {
      await openNpcRoom(action.id);
    } else if (action.kind === 'bind-material') {
      if (action.materialKind === 'group') {
        showTab('groups');
        await prepareGroupLocation(action.id, action.locationId);
      } else if (action.materialKind === 'npc') {
        showTab('groups');
        await openGroups();
        if (!current()) return;
        await prepareNpcLocation(action.id, action.locationId);
      } else if (action.materialKind === 'shop') {
        showTab('items');
        await prepareShopLocation(action.id, action.locationId);
      } else {
        showTab('preparation');
        await prepareNoteLocation(action.id, action.locationId);
      }
    } else if (action.kind === 'new-material') {
      if (action.materialKind === 'group') {
        showTab('groups');
        await openGroups();
        if (!current()) return;
        await createGroupAtLocation(action.id, action.name);
      } else if (action.materialKind === 'npc') {
        showTab('groups');
        await openGroups();
        if (!current()) return;
        await createNpcAtLocation(action.id, action.name);
      } else if (action.materialKind === 'shop') {
        showTab('items');
        await createShopAtLocation(action.id, action.name);
      } else {
        showTab('preparation');
        await createNarrativeAtLocation(action.id, action.name, action.materialKind);
      }
      if (current()) setLocationReturn(token, action.id, action.title);
    } else if (action.kind === 'edit') {
      showTab('preparation');
      await openPreparedLocation(action.id);
    } else if (action.kind === 'graph') await worldLinks.open({ kind: 'location', id: action.id });
    else if (action.kind === 'npc') {
      showTab('groups');
      await openGroups();
      if (current()) await openNpcProfile(action.id, undefined, current);
    } else if (action.kind === 'narrative' || action.kind === 'faction') {
      showTab('preparation');
      await openPreparedNote(action.id);
    } else if (action.kind === 'group') {
      showTab('groups');
      await openGroups(action.id);
    } else if (action.kind === 'shop') {
      showTab('items');
      await openItems(action.id);
    } else if (action.kind === 'sources' || action.kind === 'faction-source') {
      showTab('catalog');
      await openGenerationSource(action.kind === 'sources' ? 'location' : 'faction', action.id);
    } else if (action.kind === 'event' || action.kind === 'new-event' || action.kind === 'agenda') {
      await campaignAgenda.openForLocation(
        action.kind === 'event' ? action.locationId : action.id,
        action.title,
        action.kind === 'event' ? action.id : undefined,
        action.kind === 'new-event',
      );
    } else if (action.kind === 'map') {
      if (action.mapKind === 'city') {
        showTab('atlas');
        await campaignAtlas?.navigate('city', action.id);
      } else {
        const room = workspace?.rooms.find((r) => r.scopeId === action.id);
        if (!room) throw new Error('Diese Zeichnung enthält noch keinen verfügbaren Raum.');
        showTab('atlas');
        await campaignAtlas?.navigate('room', room.id);
      }
    } else if (action.kind === 'read-aloud') {
      const live = unwrap(await window.campaign.live(token));
      if (!current()) return;
      if (live.focusId !== action.sceneId || live.focusRevision !== action.focusRevision)
        throw new Error('Fokusgruppe geändert. Ortsmappe erneut öffnen.');
      showTab('live');
      await openLive();
      if (!current()) return;
      await useLiveReferenceReadAloud(action.text, action.title, action.sceneId);
    }
  },
);
const locationNotebookButton = document.createElement('button');
locationNotebookButton.type = 'button';
locationNotebookButton.id = 'location-notebook-open';
locationNotebookButton.textContent = 'Ortsmappe';
el('narrative-journal-open').after(locationNotebookButton);
locationNotebookButton.onclick = () =>
  void locationNotebook.open().catch((e) => status(e.message, true));
const worldLinks = new WorldLinksWorkbench(
  () => workspace,
  leaveWorkspace,
  status,
  async (ref, current) => {
    if (!(await leaveWorkspace()) || !current()) return;
    if (ref.kind === 'creature' || ref.kind === 'encounter') {
      showTab('catalog');
      await openCatalogReference({ kind: ref.kind, id: ref.id }, current);
    } else if (ref.kind === 'item') {
      showTab('items');
      await openItemReference(ref.id, current);
    } else {
      showTab('preparation');
      if (ref.kind === 'note') await openPreparedNote(ref.id, current);
      else await openPreparedLocation(ref.id, current);
    }
  },
);
el('world-links-open').onclick = () => void worldLinks.open().catch((e) => status(e.message, true));
async function openNpcRoom(id: string) {
  const owner = workspace,
    current = () => workspace === owner;
  if (!owner?.rooms.some((r) => r.id === id)) throw new Error('Raum nicht mehr verfügbar.');
  await roomEditor.selectRoom(id);
  if (!current()) return;
  if (workspace?.selectedId !== id) throw new Error('Raum konnte nicht geöffnet werden.');
  showTab('atlas');
  await campaignAtlas?.navigate('room', id);
}
async function navigateNpcPlaces(id: string, sourceCurrent: () => boolean = () => true) {
  const owner = workspace,
    token = owner?.token,
    current = () => workspace === owner && workspace?.token === token && sourceCurrent();
  if (!token || !(await leaveWorkspace()) || !current()) return;
  const site = await chooseNpcPlace(token, id);
  if (!site || !current()) return;
  if (site.kind === 'assign') {
    showTab('city');
    await prepareCityPersonBinding(site);
  } else if (site.kind === 'dungeon') await openNpcRoom(site.roomId);
  else {
    showTab('atlas');
    await campaignAtlas?.navigate('city', site.cityId, site.unitId);
  }
}
setNpcPlaceNavigation(navigateNpcPlaces);
const locationReturn = document.createElement('button');
locationReturn.id = 'location-material-return';
locationReturn.type = 'button';
locationReturn.hidden = true;
el('location-notebook-open').after(locationReturn);
function setLocationReturn(token: string, id: string, title: string) {
  locationReturn.hidden = false;
  locationReturn.textContent = 'Zur Ortsmappe: ' + title;
  locationReturn.onclick = () => {
    if (workspace?.token !== token) {
      locationReturn.hidden = true;
      return;
    }
    locationReturn.disabled = true;
    void locationNotebook
      .open(id)
      .catch((e) => status(e.message, true))
      .finally(() => {
        locationReturn.disabled = false;
      });
  };
}

initQuickReference(status, leaveWorkspace, async (action) => {
  const token = workspace?.token;
  if (!token) return;
  if (action.kind === 'connections') {
    await worldLinks.open(action.content.ref);
    return;
  }
  if (action.kind === 'source') {
    const ref = action.content.ref;
    if (ref.kind === 'item') {
      showTab('items');
      await openItemReference(ref.id);
    } else if (ref.kind === 'creature' || ref.kind === 'encounter') {
      showTab('catalog');
      await openCatalogReference({ kind: ref.kind, id: ref.id });
    }
    return;
  }
  if (action.kind === 'edit') {
    showTab('preparation');
    if (action.content.note) await openPreparedNote(action.content.ref.id);
    else if (action.content.location) await openPreparedLocation(action.content.ref.id);
    return;
  }
  const live = unwrap(await window.campaign.live(token));
  if (workspace?.token !== token || live.focusId !== action.sceneId)
    throw new Error('Fokusgruppe geändert. Schnellsuche erneut öffnen.');
  showTab('live');
  await openLive();
  if (workspace?.token !== token) return;
  if (action.kind === 'read-aloud' && action.content.note)
    await useLiveReferenceReadAloud(
      action.content.note.readAloud,
      action.content.title,
      action.sceneId!,
    );
  if (action.kind === 'encounter' && action.content.encounter)
    await prepareLiveEncounter(action.content.encounter);
  if (action.kind === 'creature' && action.content.creature)
    await addLiveCreature(action.content.creature.id, action.count!, action.grouped!);
});
async function fromCatalogToLive(action: () => Promise<void>) {
  const token = workspace?.token;
  if (!token || !(await leaveWorkspace()) || workspace?.token !== token) return;
  showTab('live');
  if ((await openLive()) && workspace?.token === token) await action();
}
initCatalog(
  status,
  (plan) => fromCatalogToLive(() => prepareLiveEncounter(plan)),
  (id, count, grouped) => fromCatalogToLive(() => addLiveCreature(id, count, grouped)),
);
el('catalog-day-plan').onclick = () => {
  void (async () => {
    if (!(await leaveWorkspace())) return;
    await reopenView('preparation');
    showDayPreparation();
  })().catch((error) => status(error.message, true));
};
initNpcs(status, refreshScenePreparation, async (id) => {
  if (!(await leaveWorkspace())) return;
  showTab('live');
  await openLive();
  await addLiveNpc(id);
});

initGroups(
  status,
  refreshScenePreparation,
  async (id) => {
    if (!(await leaveWorkspace())) return;
    showTab('groups');
    await openGroups(id);
    await openNpcs(false);
  },
  async (id, sourceCurrent = () => true) => {
    const owner = workspace,
      current = () => workspace === owner && sourceCurrent();
    if (!current() || !(await leaveWorkspace()) || !current()) return;
    showTab('groups');
    await openNpcProfile(id, undefined, current);
  },
);

initTreasury(
  status,
  async () => {
    await refreshProgress();
    await refreshScenePreparation();
  },
  async (id) => {
    if (!(await leaveWorkspace())) return;
    showTab('treasury');
    await openTreasury(id);
  },
  async (token, id) => {
    if (workspace?.token !== token || !(await leaveWorkspace()) || workspace?.token !== token)
      return;
    showTab('live');
    await openLive();
    if (workspace?.token === token) await openLiveCharacterLoot(id);
  },
);
initItems(status, async (id) => {
  if (!(await leaveWorkspace())) return;
  showTab('items');
  await openItems(id);
});
initDrawing(
  status,
  () => workspace,
  () => roomEditor.draft,
  () => editors.before('drawing'),
  async (next) => {
    workspace = geometryOnly(next);
    await roomEditor.setDraft();
    roomEditor.renderList(true);
    roomEditor.updateHistory();
  },
  roomEditor.draw,
);
initVolume(
  status,
  () => workspace,
  () => roomEditor.draft,
  () => editors.before('volume'),
  async (next) => {
    workspace = geometryOnly(next);
    await roomEditor.setDraft();
    roomEditor.renderList(true);
    roomEditor.updateHistory();
    await reloadDrawing();
    roomEditor.draw();
  },
);
initTriggers(
  status,
  () => workspace,
  () => roomEditor.draft,
  () => editors.before('triggers'),
  async (next) => {
    workspace = geometryOnly(next);
    await roomEditor.setDraft();
    roomEditor.renderList(true);
    roomEditor.updateHistory();
    await reloadDrawing();
    roomEditor.draw();
  },
);
initDungeonContent(
  status,
  () => workspace,
  () => roomEditor.draft,
  () => editors.before('content'),
  async (next) => {
    workspace = geometryOnly(next);
    await roomEditor.setDraft();
    roomEditor.renderList(true);
    roomEditor.updateHistory();
    await reloadDrawing();
    roomEditor.draw();
  },
  refreshOpenGraph,
);
initGraph(
  status,
  () => workspace,
  () => roomEditor.draft,
  () => editors.before('graph'),
  async (next) => {
    workspace = geometryOnly(next);
    await roomEditor.setDraft();
    roomEditor.renderList(true);
    roomEditor.updateHistory();
    await reloadDrawing();
    roomEditor.draw();
  },
  () => showTab('atlas'),
  roomEditor.selectRoom,
);
initKeys(
  status,
  () => workspace,
  () => roomEditor.draft,
  () => editors.before('keys'),
  async (next) => {
    workspace = geometryOnly(next);
    await roomEditor.setDraft();
    roomEditor.renderList(true);
    roomEditor.updateHistory();
    await reloadDrawing();
    roomEditor.draw();
  },
  roomEditor.selectRoom,
  {
    open: openPreparedNote,
    flush: flushPreparation,
    map: async (id) => {
      showTab('atlas');
      await campaignAtlas?.navigate('room', id);
    },
    plan: async (id, current) => {
      if (!current() || !(await leaveWorkspace()) || !current()) return false;
      const owner = workspace;
      showTab('preparation');
      const request = viewRequest,
        valid = () => workspace === owner && viewRequest === request && current();
      try {
        return await openPreparedPlan(id, valid);
      } catch (error) {
        if (valid()) throw error;
        return false;
      }
    },
    showKeyWorkspace: () => showTab('atlas'),
  },
);

initPaths(
  status,
  () => workspace,
  () => roomEditor.draft,
  () => editors.before('paths'),
  async (next) => {
    workspace = geometryOnly(next);
    await roomEditor.setDraft();
    roomEditor.renderList(true);
    roomEditor.updateHistory();
    await reloadDrawing();
    roomEditor.draw();
  },
);
initDungeon(status, (id) => {
  void (async () => {
    if (!(await leaveWorkspace())) return;
    showTab('live');
    await openLive();
    await openExistingCombat(id);
  })().catch((error) => status(error.message, true));
});
const dungeonBinder = new DungeonBinder(
  () => workspace,
  leaveWorkspace,
  status,
  async (id, action) => {
    const token = workspace?.token;
    if (!token || !(await leaveWorkspace()) || workspace?.token !== token) return;
    if (action === 'target') {
      showTab('atlas');
      await campaignAtlas?.navigate('room', id);
      await selectDungeonRoom(id);
    } else {
      showTab('atlas');
      await campaignAtlas?.navigate('room', id);
      if (action === 'edit' && workspace?.token === token && workspace.selectedId === id)
        el('key-open').click();
    }
  },
  (id, target, current, returned, left) =>
    openRoomKey(id, current, returned, target, 'Zurück zum Binder', left),
);
initAutonomy(status);
initCity(
  status,
  (id) => worldLinks.open({ kind: 'note', id }),
  async (id, current) => {
    if (!current() || !(await leaveWorkspace()) || !current()) return;
    showTab('groups');
    await openGroups();
    if (current()) await openNpcProfile(id, undefined, current);
  },
  async (id, current) => {
    if (!current() || !(await leaveWorkspace()) || !current()) return;
    await locationNotebook.open(id);
  },
);
initWorld(
  status,
  flushLive,
  async () => {
    await openLive();
  },
  async () => {
    if (!(await leaveWorkspace())) return;
    showTab('world');
    await openWorld();
  },
  async (sceneId, kind) => {
    if (kind === 'wait') await openTimeNavigator(undefined, sceneId);
    else await openTravelRest(sceneId);
  },
);
const campaignAgenda = new CampaignAgenda(
  () => workspace,
  leaveWorkspace,
  status,
  async (kind) => {
    if (!(await leaveWorkspace())) return;
    if (kind === 'calendar') await openWorldCalendar();
    else {
      showTab('live');
      await openLive();
    }
  },
  async (target) => {
    if (!(await leaveWorkspace())) return;
    showTab('live');
    await openLive();
    await openTimeNavigator(target);
  },
  (id) => locationNotebook.open(id),
);
initLive(
  status,
  async (id) => {
    if (!(await leaveWorkspace())) return;
    await openPreparedLocation(id);
    showTab('preparation');
  },
  async (id, current = () => true) => {
    if (!(await leaveWorkspace()) || !current()) return;
    showTab('preparation');
    await openPreparedNote(id, current);
  },
  async (id, current = () => true) => {
    if (current()) await locationNotebook.open(id, current);
  },
  async (planId, visitId, current = () => true) => {
    if (!current() || !(await leaveWorkspace()) || !current()) return;
    showTab('preparation');
    await openPreparedVisit(planId, visitId, current, 'reward');
  },
  async (seed, current = () => true) => {
    if (!current() || !(await leaveWorkspace()) || !current()) return;
    await campaignAgenda.openMomentDraft(
      { name: seed.title, notes: seed.summary },
      seed.location ?? undefined,
      current,
    );
  },
  async (planId, seed, current = () => true, openPacket = false) => {
    if (!current() || !(await leaveWorkspace()) || !current()) return false;
    showTab('preparation');
    const prepared = await prepareNextVisit(planId, seed, current);
    if (!prepared) return false;
    if (openPacket && current()) return openPreparationSessionPacket(prepared.visitId);
    return current();
  },
);
initMusic(status, async () => {
  if (!(await leaveWorkspace())) return;
  showTab('music');
  await openMusic();
});
initSoundboard(
  status,
  async () => {
    if (!(await leaveWorkspace())) return;
    showTab('music');
    await openMusic();
  },
  async () => {
    if (!(await leaveWorkspace())) return;
    showTab('live');
    await openLive();
    await openLiveSoundboard();
  },
);
campaignAtlas = new CampaignAtlasWorkbench({
  exit: async () => {
    if (await openCampaignScreen()) showTab('preparation');
  },
  selectRoom: roomEditor.selectRoom,
  roomDraft: () => roomEditor.draft,
  flush: leaveWorkspace,
  updated: async (next) => {
    workspace = geometryOnly(next);
    await roomEditor.setDraft();
    roomEditor.renderList(true);
    roomEditor.updateHistory();
    await reloadDrawing();
  },
  status,
});
setLiveAtlasSurface(campaignAtlas.liveSurface());
for (const id of ['world', 'city', 'dungeon']) el(id + '-tab').hidden = true;
el('atlas-tab').textContent = 'Atlas';
function showTab(selected: WorkspaceTab, restored?: number) {
  const atlasSurface = ['atlas', 'world', 'city', 'dungeon'].includes(selected);
  if (atlasSurface) selected = 'atlas';

  if (selected !== 'chronicle') suspendChronicle();
  if (workspace) workspacePositions.capture(workspace.campaign.id, window.scrollY);
  const scrollY = workspace
    ? workspacePositions.select(workspace.campaign.id, selected, restored)
    : 0;
  viewRequest++;
  activeTab = selected;
  if (workspace)
    rememberWorkspaceView(viewStorage, workspace.campaign.id, { tab: selected, scrollY: 0 });
  setWorldSurface(selected);
  setSessionPacketSurface(selected);
  if (campaignAtlas) {
    if (atlasSurface) void campaignAtlas.open();
    else if (selected !== 'live' || !campaignAtlas.liveDocked) campaignAtlas.hide();
  }
  for (const id of workspaceTabs) {
    el(id).hidden = atlasSurface ? true : id !== selected;
    el(id + '-tab').setAttribute('aria-pressed', String(id === selected));
  }
  syncWorkspaceNavigation();
  window.scrollTo(0, 0);
  return scrollY;
}
async function reopenView(
  tab: WorkspaceTab,
  restored?: number,
  liveNotesTop?: number,
  liveCombat?: boolean,
) {
  const owner = workspace,
    intent = activationIntent,
    scrollY = showTab(tab, restored),
    request = viewRequest;
  switch (tab) {
    case 'live':
      await openLive();
      break;
    case 'atlas':
      // The Atlas owns its loading/error state and author-hit fence. Its first
      // region can take much longer than opening the workspace shell; do not
      // keep the campaign screen and all camera input inert until it arrives.
      void campaignAtlas?.open().catch((error) => {
        if (workspace === owner && activationIntent === intent && viewRequest === request)
          status((error as Error).message, true);
      });
      break;
    case 'groups':
      await openGroups();
      await openNpcs();
      break;
    case 'treasury':
      await openTreasury();
      break;
    case 'chronicle':
      await openChronicle();
      break;
    case 'catalog':
      await openCatalog();
      break;
    case 'items':
      await openItems();
      break;
    case 'world':
      await openWorld();
      break;
    case 'music':
      await openMusic();
      break;
    case 'city':
      await openCity();
      break;
    case 'autonomy':
      await openAutonomy();
      break;
    case 'dungeon':
      await openDungeon();
      break;
    case 'preparation':
      if (owner) await ensurePreparation(owner);
      break;
  }
  window.requestAnimationFrame(() => {
    if (
      workspace !== owner ||
      activationIntent !== intent ||
      viewRequest !== request ||
      activationFailed
    )
      return;
    const notes =
      tab === 'live' && liveNotesTop !== undefined
        ? el('running-notes').getBoundingClientRect()
        : null;
    if (tab === 'live' && liveCombat && !el('combat-panel').hidden)
      el('combat-panel').scrollIntoView({ block: 'start' });
    else
      window.scrollTo(
        0,
        notes && notes.height > 0 ? window.scrollY + notes.top - liveNotesTop! : scrollY,
      );
    rememberView();
  });
}
initPlayerUI(status, () => workspace, leaveWorkspace);
async function refreshCampaignShell() {
  const list = await refreshCampaigns();
  if (!list) return null;
  if (workspace && !list.campaigns.some((c) => c.id === workspace!.campaign.id)) {
    workspace = null;
    roomEditor.clear();
    setWorkspaceAvailable(false);
    editors.deactivate();
    campaignAtlas?.hide();
    document.querySelector('main')!.inert = true;
  } else if (workspace) {
    const current = list.campaigns.find((c) => c.id === workspace!.campaign.id);
    if (current) workspace.campaign = current;
  }
  el('campaign-header-name').textContent = workspace?.campaign.name ?? 'Kampagnen';
  return list;
}
initCampaignManager(
  status,
  () => workspace,
  leaveCampaign,
  async (id) => {
    await refreshCampaignShell();
    if (id) {
      await activate(id);
      if (!activationFailed) hideCampaignScreen();
    }
  },
);
void initTutorial();
const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
async function flushAll() {
  return !workspace || editors.flush('checkpoint');
}
async function leaveCampaign() {
  return !workspace || editors.flush('campaign');
}
async function leaveWorkspace() {
  return !workspace || editors.flush('navigation');
}
async function refreshCampaigns() {
  const request = ++campaignListRequest,
    list = unwrap(await api.list());
  if (request !== campaignListRequest) return null;
  const select = el<HTMLSelectElement>('campaigns');
  select.replaceChildren();
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = 'Kampagne öffnen';
  select.append(empty);
  for (const campaign of list.campaigns) {
    const option = document.createElement('option');
    option.value = campaign.id;
    option.textContent = campaign.name;
    select.append(option);
  }
  select.value = workspace?.campaign.id ?? '';
  return list;
}
const workspaceContextCurrent = (token: string) =>
  workspace?.token === token && !activationJob && !activating && !activationFailed;
function activate(id: string, entryCommandId?: string): Promise<void> {
  activationIntent++;
  queuedActivation = { id, entryCommandId };
  if (activationJob) return activationJob;
  activationJob = drainActivation();
  return activationJob;
}
async function drainActivation(): Promise<void> {
  const main = document.querySelector('main')!,
    header = document.querySelector('header')!,
    nav = document.querySelector('nav')!;
  const wasInert = main.inert;
  main.inert = true;
  header.inert = true;
  nav.inert = true;
  try {
    // Reserve the transition before this asynchronous drain, so a second request joins it.
    if (!queuedActivation?.entryCommandId && !(await leaveCampaign())) {
      el<HTMLSelectElement>('campaigns').value = workspace?.campaign.id ?? '';
      return;
    }
    rememberView();
    activating = true;
    activationFailed = false;
    editors.suspend();
    status('Kampagne wird geladen.');
    while (queuedActivation !== null) {
      const { id, entryCommandId } = queuedActivation;
      queuedActivation = null;
      try {
        const shell = unwrap(
          entryCommandId
            ? await api.campaignCatalogShell(entryCommandId)
            : await api.activateShell(id),
        );
        if (queuedActivation !== null) continue;
        const next = unwrap(await api.workspaceInitial(shell.token));
        if (queuedActivation !== null) continue; // A newer intent owns the forthcoming projection.
        editors.deactivate();
        workspace = geometryOnly(next);
        el('campaign-header-name').textContent = next.campaign.name;
        setWorkspaceAvailable(true);
        el<HTMLSelectElement>('campaigns').value = id;
        await editors.activate(next);
        if (queuedActivation !== null) continue;
        el('map-title').textContent = next.campaign.name;
        el<HTMLInputElement>('search').value = '';
        await roomEditor.setDraft();
        if (queuedActivation !== null) continue;
        roomEditor.renderList();
        roomEditor.updateHistory();
        const view = readWorkspaceView(viewStorage, next.campaign.id);
        await reopenView(view.tab, view.scrollY, view.liveNotesTop, view.liveCombat);
        if (queuedActivation !== null) continue;
        if (preparationHasDrafts())
          status('Vorbereitung enthält offene oder gesperrte Entwürfe.', true);
        else if (roomEditor.saved) status('Gespeichert.');
      } catch (error) {
        if (queuedActivation !== null) continue;
        activationFailed = true;
        status(
          (error as Error).message +
            ' Die Arbeitsfläche bleibt schreibgeschützt; öffne eine Kampagne erneut.',
          true,
        );
      }
    }
  } catch (error) {
    // A failed source drain preserves the current editable context and its pending input.
    if (activating) activationFailed = true;
    status((error as Error).message + ' Kampagnenwechsel nicht abgeschlossen.', true);
  } finally {
    main.inert = activationFailed || (!activating && wasInert);
    activating = false;
    queuedActivation = null;
    activationJob = null;
    header.inert = false;
    nav.inert = false;
  }
}
el('campaigns').addEventListener('change', () => {
  const id = el<HTMLSelectElement>('campaigns').value;
  if (id) void activate(id);
});
bindAtlasHistoryShortcut(
  () => !!campaignAtlas && !campaignAtlas.root.hidden,
  () => roomEditor.composing,
  (direction) => {
    void roomEditor.history(direction);
  },
);
initCampaignActions({
  get workspace() {
    return workspace;
  },
  get transitionPending() {
    return !!activationJob;
  },
  workspaceContextCurrent,
  beginIntent() {
    const intent = ++activationIntent,
      token = workspace?.token;
    return () => intent === activationIntent && token === workspace?.token && !activationJob;
  },
  cancelIntent() {
    activationIntent++;
  },
  flushAll,
  refreshCampaigns,
  activate,
  status,
  insertionPoint: () => campaignAtlas?.insertionPoint ?? { x: 0, y: 0 },
  showAtlas: () => {
    showTab('atlas');
  },
  navigateRoom: (id) => campaignAtlas?.navigate('room', id),
});
initCommitControls(() => workspace, status);
api.onClose(() => {
  void (async () => {
    await stopWorldPlayback();
    await activationJob;
    rememberView();
    if (!workspace || (await editors.flush('close'))) {
      editors.deactivate();
      api.closeReady();
    }
  })().catch((error) =>
    status('Schließen wartet auf einen sicheren Arbeitsstand: ' + error.message, true),
  );
});
for (const id of workspaceTabs)
  el(id + '-tab').onclick = () => {
    void (async () => {
      if (await leaveWorkspace()) await reopenView(id);
    })().catch((error) => status(error.message, true));
  };
initWorkspaceNavigation();
initCampaignScreen({
  currentCampaign: () => workspace?.campaign.id ?? null,
  before: async () => !workspace || activationFailed || (await leaveCampaign()),
  changed: async () => {
    await refreshCampaignShell();
  },
  enter: async (receipt) => {
    await activate(receipt.campaignId, receipt.commandId);
    return !activationFailed && workspace?.campaign.id === receipt.campaignId;
  },
});
initUpdateUI(async () => {
  await activationJob;
  rememberView();
  return leaveCampaign();
});
void openCampaignScreen(true)
  .then(() => api.updateRuntimeReady?.())
  .catch((error) => status('Start konnte nicht abgeschlossen werden: ' + error.message, true));
setInterval(() => {
  void (async () => {
    try {
      const message = unwrap(await api.backupStatus());
      el('backup-status').hidden = !message;
      el('backup-status').textContent = message;
    } catch {
      el('backup-status').hidden = false;
      el('backup-status').textContent = 'Status der Wiederherstellungskopie nicht verfügbar.';
    }
  })();
}, 5000);

document.addEventListener('atlas-location-request', (e) => {
  const ref = (e as CustomEvent).detail;
  if (!workspace || !campaignAtlas) return;
  void (async () => {
    if (!(await leaveWorkspace())) return;
    showTab('atlas');
    await campaignAtlas!.navigateLocation(ref.id, ref.sectionId);
  })().catch((e) => status(e.message, true));
});

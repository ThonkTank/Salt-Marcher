import { LiveWriteCoordinator } from './live-write-coordinator';
import { LiveDraftOwner } from './live-draft-owner';
import { NpcCastBinder } from '../campaign/npc-cast-ui';
import type { Preparation } from '../campaign/preparation-contracts';
import {
  closeSessionPacket,
  openLiveSessionPacket,
  showLivePacketParty,
  syncLiveSessionPacket,
  type LivePacketSource,
} from '../campaign/session-packet-ui';
import type { EncounterPlan } from '../catalog/encounter-contracts';
import type { ItemsEditor } from '../catalog/items-ui';
import {
  activateRuleReferences,
  initRuleReferences,
  refreshRuleReferences,
} from '../catalog/rule-reference-ui';
import type { Result, WorkspaceGeometry } from '../shared/contracts';
import { EditorSession } from '../shared/editor-session';
import { createEditorSurface } from '../shared/editor-surface';
import { chaseContext, flushChase, initChase } from './chase-ui';
import type { ChronicleView } from './chronicle-contracts';
import type { CombatEditor } from './combat';
import { bindSceneGroupDrag } from './combat-group-ui';
import { initLiveArchives } from './live-archive-ui';
import { type LiveAck, type LiveAction, type LiveView } from './live-contracts';
import { type CharacterProfile } from './live-scene-contracts';
import { LiveEncounterGenerator } from './live-generation-ui';
import { createLiveKnowledgeUI } from './live-knowledge-ui';
import { createLiveMomentEditor } from './live-moment-editor';
import {
  partyHealthFacts,
  partyProgressFacts,
  passivePerceptionResult,
} from './live-party-reference';
import { renderLiveNpcChoices } from './live-player-cues';
import { createLiveRecapEditor } from './live-recap-editor';
import { createLiveSessionCloseUI } from './live-session-close-ui';
import { createLiveSessionReaders } from './live-session-readers';
import { liveSessionRecap } from './live-session-recap';
import { createLiveSessionResumeUI } from './live-session-resume-ui';
import { createLivePartyMoveEditor } from './live-party-move-editor';
import { LiveTimeControls } from './live-time-controls';
import type { MusicEditor } from './music-ui';
import { partySceneLabels } from './party-overview';
import { openPartyRest } from './party-topbar-ui';
import { cuePlayer, cuePlayerImage } from './player-ui';
import {
  executePartyProgress,
  flushProgress,
  hasHealthDraft,
  initProgress,
  onProgressChanged,
  progressCharacters,
  progressionContext,
} from './progression-ui';
import { flushSceneDesk, initSceneDesk, sceneDeskContext } from './scene-desk-ui';
import { SceneVisitBinder } from './scene-visit-ui';
import {
  initSessionNavigator,
  sessionNavigatorBusy,
  sessionNavigatorContext,
  sessionNavigatorPreparation,
} from './session-progress-ui';
import { TimeNavigator } from './time-plan-ui';
import { openTreasureDistribution } from './treasury-ui';
import type { WorldEditor } from './world-ui';
export type LiveHost = {
  world: Pick<WorldEditor, 'renderLiveWorld'>;
  items: Pick<ItemsEditor, 'renderSceneShops'>;
  music: Pick<MusicEditor, 'refreshMusic'>;
  combat: CombatEditor;
  roots: readonly HTMLElement[];
  dialogHost: HTMLElement;
  api: Window['campaign'];
  confirm: (message: string) => boolean;
  height: () => number;
  navigation: {
    treasure?: (id: string) => Promise<void>;
    group?: (id: string, current?: () => boolean) => Promise<void>;
    npc?: (
      id: string,
      contact: { date: string; sceneTitle: string } | undefined,
      current: () => boolean,
    ) => Promise<void>;
    npcAutonomy?: (id: string, current: () => boolean) => Promise<void>;
    npcPlaces?: (id: string, current: () => boolean) => Promise<void>;
    partyAward: () => void;
  };
};

export function createLive(host: LiveHost) {
  const { renderSceneShops } = host.items;
  const { refreshMusic } = host.music;
  const {
    reinforceWorldGroup,
    prepareGeneratedCombat,
    addWorldNpc,
    initCombat,
    combatContext,
    flushCombat,
    prepareCombatPlan,
    addCatalogCreature,
    prepareWorldGroup,
    openExistingCombat,
  } = host.combat;
  const { document, get } = createEditorSurface(host.roots);
  const window = {
    campaign: host.api,
    confirm: host.confirm,
    get innerHeight() {
      return host.height();
    },
  };
  const editorSession = new EditorSession();
  const value = (id: string) => get<HTMLInputElement>(id).value;
  const unwrap = <T>(result: Result<T>): T => {
    if (!result.ok) throw new Error(result.error);
    return result.value;
  };
  const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  let context: WorkspaceGeometry | null = null,
    sources: Preparation | null = null,
    liveReadRequest = 0,
    liveSourcesRequest = 0;
  let liveSourcesLoading = false,
    liveSourcesProblem = '';
  let sessionChronicle: ChronicleView | null = null,
    sessionChronicleError = '',
    sessionChronicleRequest = 0;
  let readAloudOwner: string | null = null;
  const drafts = new LiveDraftOwner();
  let resumed = false;
  const writer = new LiveWriteCoordinator({
    session: editorSession,
    api: host.api,
    context: () => context,
    drafts,
    flushDependents: async () =>
      (await momentEditor.flush()) &&
      (await recapEditor.flush()) &&
      (await flushSceneDesk()) &&
      (await flushProgress()) &&
      (await flushCombat()) &&
      (await flushChase()),
    invalidateRead: () => {
      liveReadRequest++;
    },
    accepted: (ack, action, profile) => mergeAck(ack, action, profile),
    busy: (on, structural, textSave) => busy(on, structural, textSave),
    renderGroups: () => renderGroups(),
    recovery: (visible) => {
      get('live-reconcile').hidden = !visible;
      get('live-refresh').hidden = !visible;
    },
    refreshSession: () => refreshLiveSession(),
    tell: (text, error) => tell(text, error),
  });
  const intentBlocked = () => writer.intentBlocked;
  const execute = writer.execute,
    flushLive = writer.flush,
    schedule = writer.schedule;
  let adoption: Extract<LiveAction, { kind: 'apply-visit' }> | null = null;
  let preparedNotesSceneId: string | null = null,
    preparedNoteIds = new Set<string>();
  let resetLiveArchives = () => {};
  let liveGenerator: LiveEncounterGenerator;
  const npcPlacesNavigation = host.navigation.npcPlaces ?? null;
  let npcCastBinder: NpcCastBinder;
  const npcNavigation = host.navigation.npc ?? null,
    npcAutonomyNavigation = host.navigation.npcAutonomy ?? null;
  let visitBinder: SceneVisitBinder;
  let timeNavigator: TimeNavigator;
  const timeControls = new LiveTimeControls({
    get,
    api: host.api,
    session: editorSession,
    context: () =>
      context && drafts.view?.scene ? { workspace: context, scene: drafts.view.scene } : null,
    blocked: intentBlocked,
    accepted: (from) => {
      chaseContext(
        context,
        resumed ? (drafts.view?.scene ?? null) : null,
        drafts.view?.roster ?? [],
        timeControls.format(from),
      );
      renderGroups();
    },
  });
  const formatSceneInstant = (ms: string) => timeControls.format(ms);
  const renderTimePreview = timeControls.render;

  let tell: (text: string, error?: boolean) => void,
    openLocation: (id: string) => Promise<void>,
    openKnowledgeNote: (id: string, stillCurrent?: () => boolean) => Promise<void>,
    openLocationNotebook: (id: string, current?: () => boolean) => Promise<void>,
    openPreparedReward: (planId: string, visitId: string, current?: () => boolean) => Promise<void>,
    openMomentDeadline: (
      seed: { title: string; summary: string; location: { id: string; title: string } | null },
      current?: () => boolean,
    ) => Promise<void>,
    openMomentVisit: (
      planId: string | null,
      seed: {
        title: string;
        notes: string;
        locationId: string | null;
        beforeVisitId?: string | null;
        readAloud?: string;
        noteIds?: string[];
        newPlan?: boolean;
      },
      current?: () => boolean,
      openPacket?: boolean,
    ) => Promise<boolean>;
  const partyMove = createLivePartyMoveEditor({
    document,
    get,
    session: editorSession,
    blocked: () => writer.blocked || intentBlocked(),
    writing: () => writer.writing,
    execute: (action) => execute(action),
    formatInstant: formatSceneInstant,
    feedback: (text, error) => tell(text, error),
  });
  const { originalCharacter, changed } = drafts;
  const playerFocus = () =>
    drafts.view
      ? {
          focusId: drafts.view.focusId,
          focusRevision: drafts.view.focusRevision,
          focusMembershipRevision: drafts.view.scene?.membershipRevision ?? null,
          focusLocationId:
            drafts.scene?.id === drafts.view.scene?.id
              ? (drafts.scene?.locationId ?? null)
              : (drafts.view.scene?.locationId ?? null),
        }
      : null;

  const recapEditor = createLiveRecapEditor({
    get context() {
      return context;
    },
    get get() {
      return get;
    },
    get value() {
      return value;
    },
    get window() {
      return window;
    },
    get unwrap() {
      return unwrap;
    },
    get equal() {
      return equal;
    },
    get editorSession() {
      return editorSession;
    },
    get renderLiveSession() {
      return renderLiveSession;
    },
    get blocked() {
      return writer.blocked;
    },
  });
  const { recapFields, recapReadError, queueRecapSave } = recapEditor;

  const momentEditor = createLiveMomentEditor({
    get context() {
      return context;
    },
    get data() {
      return drafts.view;
    },
    get sources() {
      return sources;
    },
    get get() {
      return get;
    },
    get document() {
      return document;
    },
    get value() {
      return value;
    },
    get window() {
      return window;
    },
    get unwrap() {
      return unwrap;
    },
    get equal() {
      return equal;
    },
    get editorSession() {
      return editorSession;
    },
    get tell() {
      return tell;
    },
    get flushLive() {
      return flushLive;
    },
    get execute() {
      return execute;
    },
    get reloadLiveSources() {
      return reloadLiveSources;
    },
    get openKnowledgeNote() {
      return openKnowledgeNote;
    },
    get openMomentDeadline() {
      return openMomentDeadline;
    },
    get openMomentVisit() {
      return openMomentVisit;
    },
  });
  const {
    renderLiveMomentDraft,
    writeLiveMomentDraft,
    captureMomentDraft,
    currentLiveMomentDraft,
  } = momentEditor;

  const knowledgeUI = createLiveKnowledgeUI({
    get context() {
      return context;
    },
    get data() {
      return drafts.view;
    },
    get sources() {
      return sources;
    },
    get get() {
      return get;
    },
    get document() {
      return document;
    },
    get value() {
      return value;
    },
    get window() {
      return window;
    },
    get liveSourcesProblem() {
      return liveSourcesProblem;
    },
    get preparedNoteIds() {
      return preparedNoteIds;
    },
    get useKnowledgeReadAloud() {
      return useKnowledgeReadAloud;
    },
    get showLiveNpc() {
      return showLiveNpc;
    },
    get openKnowledgeNote() {
      return openKnowledgeNote;
    },
  });
  const { renderLiveKnowledge } = knowledgeUI;

  const sessionReaders = createLiveSessionReaders({
    get context() {
      return context;
    },
    get sources() {
      return sources;
    },
    get liveSourcesProblem() {
      return liveSourcesProblem;
    },
    get value() {
      return value;
    },
    get window() {
      return window;
    },
    get unwrap() {
      return unwrap;
    },
  });
  const { readSessionCloseAudit, readSessionResumePrep } = sessionReaders;

  const sessionCloseUI = createLiveSessionCloseUI({
    get context() {
      return context;
    },
    get data() {
      return drafts.view;
    },
    get sources() {
      return sources;
    },
    get get() {
      return get;
    },
    get document() {
      return document;
    },
    get value() {
      return value;
    },
    get tell() {
      return tell;
    },
    get sessionChronicle() {
      return sessionChronicle;
    },
    get sessionChronicleError() {
      return sessionChronicleError;
    },
    get renderLiveSession() {
      return renderLiveSession;
    },
    get dialogHost() {
      return host.dialogHost;
    },
    get partyAward() {
      return host.navigation.partyAward;
    },
    get readSessionCloseAudit() {
      return readSessionCloseAudit;
    },
    get readSessionResumePrep() {
      return readSessionResumePrep;
    },
    get recapFields() {
      return recapFields;
    },
    get recapReadError() {
      return recapReadError;
    },
    get queueRecapSave() {
      return queueRecapSave;
    },
    get recapBindings() {
      return recapEditor.bind;
    },
    get markLiveSession() {
      return markLiveSession;
    },
    get openMomentVisit() {
      return openMomentVisit;
    },
    get openExistingCombat() {
      return openExistingCombat;
    },
    get changeFocus() {
      return changeFocus;
    },
  });
  const { loadSessionCloseReview } = sessionCloseUI;

  const sessionResumeUI = createLiveSessionResumeUI({
    openPartyRest,
    get openLive() {
      return openLive;
    },
    get readAloudText() {
      return drafts.scene?.readAloud ?? '';
    },
    get useKnowledgeReadAloud() {
      return useKnowledgeReadAloud;
    },
    get groupPeople() {
      return groupPeople;
    },
    get openHandoffVisit() {
      return sessionCloseUI.openHandoffVisit;
    },
    get context() {
      return context;
    },
    get data() {
      return drafts.view;
    },
    get sources() {
      return sources;
    },
    get get() {
      return get;
    },
    get document() {
      return document;
    },
    get window() {
      return window;
    },
    get unwrap() {
      return unwrap;
    },
    get tell() {
      return tell;
    },
    get flushLive() {
      return flushLive;
    },
    get sessionChronicle() {
      return sessionChronicle;
    },
    get sessionChronicleError() {
      return sessionChronicleError;
    },
    get dialogHost() {
      return host.dialogHost;
    },
    get partyAward() {
      return host.navigation.partyAward;
    },
    get readSessionCloseAudit() {
      return readSessionCloseAudit;
    },
    get readSessionResumePrep() {
      return readSessionResumePrep;
    },
    get openExistingCombat() {
      return openExistingCombat;
    },
    get changeFocus() {
      return changeFocus;
    },
    get startLiveSession() {
      return startLiveSession;
    },
    get openLocationNotebook() {
      return openLocationNotebook;
    },
    get openLivePacket() {
      return openLivePacket;
    },
    get formatSceneInstant() {
      return formatSceneInstant;
    },
  });

  function activateLive(workspace: WorkspaceGeometry) {
    recapEditor.activate(workspace);
    editorSession.generation++;
    liveReadRequest++;
    liveSourcesRequest++;
    liveSourcesLoading = false;
    liveSourcesProblem = '';
    sessionResumeUI.reset();
    sessionCloseUI.reset();
    visitBinder?.reset();
    timeNavigator?.reset();
    timeControls.reset();
    liveGenerator?.reset();
    closeSessionPacket();
    syncLiveSessionPacket(null);
    resetLiveArchives();
    sessionNavigatorContext(null, null, null, false);
    sceneDeskContext(null, null);
    combatContext(null, null);
    chaseContext(null, null, []);
    progressionContext(null, null, null);

    context = workspace;
    drafts.reset();
    sources = null;
    sessionChronicle = null;
    sessionChronicleError = '';
    sessionChronicleRequest++;
    resumed = false;
    activateRuleReferences(workspace);
    get<HTMLInputElement>('live-knowledge-search').value = '';
    get('live-sources-state').hidden = true;
    get('adoption-plan').replaceChildren();
    get('adoption-visit').replaceChildren();
    get('live-reconcile').hidden = true;
    get('live-refresh').hidden = true;
    get('live-workspace').hidden = true;
    get('live-empty').hidden = false;
    get('live-focus-bar').hidden = true;
    placePartyEditor(false);
    get('running-editor').hidden = true;
    get('live-start-hint').hidden = false;
    get('live-continue').hidden = false;
    newCharacterBasis = null;
    get('character-result').textContent = '';
    adoption = null;
    partyMove.reset();
    preparedNotesSceneId = null;
    preparedNoteIds.clear();
    knowledgeUI.reset();
    momentEditor.reset();
    get('live-moment-result').textContent = '';
    get('live-session-result').textContent = '';
    for (const id of ['adoption-dialog', 'move-dialog', 'archive-dialog', 'character-dialog'])
      if (get<HTMLDialogElement>(id).open) get<HTMLDialogElement>(id).close();
  }
  async function openLive(planId?: string, visitId?: string) {
    if (!context) {
      tell('Bitte zuerst eine Kampagne öffnen.', true);
      return false;
    }
    const owner = context,
      token = owner.token,
      n = ++liveReadRequest,
      active = editorSession.capture(),
      current = () => active() && context === owner && n === liveReadRequest;
    const sourceRun = ++liveSourcesRequest;
    try {
      // Main serializes bridge reads: dispatch the required scene first.
      const liveRead = window.campaign.live(token),
        preparation = readLiveSources(owner);
      sessionChronicle = null;
      sessionChronicleError = 'Chronik wird geladen.';
      void refreshLiveSession();
      const liveResult = await liveRead;
      if (!current() || !context) return false;
      const live = unwrap(liveResult);
      recapEditor.accept(live);
      drafts.accept(live);
      sources = null;
      liveSourcesLoading = true;
      liveSourcesProblem = 'Vorbereitung wird geladen…';
      knowledgeUI.reset();
      resumed = !!live.scene;
      render();
      writer.resumeAutosave();
      const material = acceptLiveSources(owner, sourceRun, preparation);
      if (planId && (!(await material) || !current())) return false;
      if (planId) {
        get<HTMLDetailsElement>('adoption-picker').open = true;
        get<HTMLSelectElement>('adoption-plan').value = planId;
        renderVisits();
        if (visitId) get<HTMLSelectElement>('adoption-visit').value = visitId;
      }
      return true;
    } catch (error) {
      if (!current()) return;
      drafts.readFailed();
      get('live-sources-state').hidden = true;
      get('live-workspace').hidden = true;
      get('live-focus-bar').hidden = true;
      get('live-empty').hidden = false;
      tell((error as Error).message, true);
      return false;
    }
  }
  // Material is campaign-wide and may arrive after a scene write/focus change.
  // Its own generation revokes only replaced reads and campaign activations.
  async function readLiveSources(owner: WorkspaceGeometry): Promise<Result<Preparation>> {
    try {
      return await window.campaign.preparation(owner.token, '');
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }
  async function acceptLiveSources(
    owner: WorkspaceGeometry,
    run: number,
    read: Promise<Result<Preparation>>,
  ) {
    const current = editorSession.capture();
    const result = await read;
    if (!current() || context !== owner || run !== liveSourcesRequest || !drafts.view) return false;
    sources = result.ok ? result.value : null;
    liveSourcesLoading = false;
    liveSourcesProblem = result.ok ? '' : 'Vorbereitung nicht verfügbar: ' + result.error;
    renderLiveSources();
    return result.ok;
  }
  async function reloadLiveSources() {
    if (!context || !drafts.view) return false;
    const owner = context,
      run = ++liveSourcesRequest;
    sources = null;
    liveSourcesLoading = true;
    liveSourcesProblem = 'Vorbereitung wird geladen…';
    renderLiveSources();
    return acceptLiveSources(owner, run, readLiveSources(owner));
  }
  function renderLiveSources() {
    get('live-sources-state').hidden = !liveSourcesProblem;
    get('live-sources-status').textContent = liveSourcesProblem;
    get('live-sources-retry').hidden = liveSourcesLoading;
    renderLocationChoices();
    renderSceneOrigin();
    renderScenePlace();
    renderNpcChoices();
    renderLiveKnowledge();
    renderAdoptionPlans();
    sessionNavigatorPreparation(sources, resumed);
    syncLivePacketContext();
  }
  async function openPlannedVisitReview(
    planId: string,
    visitId: string,
    stillCurrent: () => boolean = () => true,
  ) {
    const owner = context,
      token = owner?.token,
      current = () => stillCurrent() && context === owner && context?.token === token;
    if (!token || !current()) return false;
    if (!(await openLive(planId, visitId)) || !current()) return false;
    if (value('adoption-plan') !== planId || value('adoption-visit') !== visitId) {
      tell('Der vorbereitete Besuch ist am Spieltisch nicht mehr verfügbar.', true);
      return false;
    }
    if (!(await ensureLiveRuntime()) || !current()) return false;
    get<HTMLDetailsElement>('adoption-picker').open = true;
    const reviewed = await previewPlannedVisit(planId, visitId, current);
    if (!current()) return false;
    const opened = reviewed && get<HTMLDialogElement>('adoption-dialog').open;
    if (!opened) tell('Die Übernahmeprüfung konnte nicht geöffnet werden.', true);
    return opened;
  }
  async function ensureLiveRuntime() {
    if (!context) return false;
    const token = context.token,
      sceneId = drafts.view?.scene?.id ?? null;
    const current = () =>
      context?.token === token && (sceneId === null || drafts.view?.scene?.id === sceneId);
    if (!(await flushLive()) || !current()) return false;
    if (!drafts.view) {
      await openLive();
      if (!current()) return false;
    }
    if (!drafts.view) return false;
    if (!drafts.view.scene) {
      if (
        !(await execute({
          kind: 'initialize',
          expectedRosterRevision: drafts.view.rosterRevision,
        })) ||
        !current()
      )
        return false;
      // Initialization receipts contain the scene, but not the complete group/focus
      // projection. Read it before any follow-up intent uses that new runtime.
      await openLive();
      if (!current()) return false;
    }
    if (!resumed) {
      resumed = true;
      drafts.restoreScene();
      renderScene();
    }
    return !!drafts.view.scene;
  }
  async function openLiveSoundboard() {
    if (!drafts.view?.scene) {
      get('live-continue').scrollIntoView({ block: 'center' });
      get<HTMLButtonElement>('live-continue').focus();
      tell('Öffne zuerst eine Gruppe am Spieltisch.');
      return;
    }
    if (!(await ensureLiveRuntime())) return;
    get<HTMLDetailsElement>('live-soundboard').open = true;
    get('live-soundboard').scrollIntoView({ block: 'start' });
  }
  async function prepareLiveEncounter(plan: EncounterPlan) {
    const token = context?.token;
    if ((await ensureLiveRuntime()) && context?.token === token) await prepareCombatPlan(plan);
  }
  async function addLiveNpc(id: string, stillCurrent: () => boolean = () => true) {
    if (stillCurrent() && (await ensureLiveRuntime()) && stillCurrent())
      await addWorldNpc(id, stillCurrent);
  }
  async function addLiveCreature(id: string, count: number, grouped: boolean) {
    const token = context?.token;
    if ((await ensureLiveRuntime()) && context?.token === token)
      await addCatalogCreature(id, count, grouped);
  }
  function busy(on: boolean, structural = false, textSave = false) {
    sessionNavigatorBusy(on && !textSave);
    for (const id of [
      'character-new',
      'live-party-new',
      'character-create-active',
      'character-toggle',
      'live-continue',
      'adoption-preview',
      'character-create',
      'adoption-confirm',
      'adoption-confirm-packet',
      'character-cancel',
      'adoption-cancel',
      'group-move',
      'time-advance',
      'live-archives',
      'live-moment-save',
      'live-session-start',
      'live-session-end',
    ])
      get<HTMLButtonElement>(id).disabled =
        (on && !textSave) ||
        (!!sessionChronicleError && id.startsWith('live-session-')) ||
        (id === 'live-session-end' && !!recapReadError());
    get<HTMLSelectElement>('scene-focus').disabled = on && !textSave;
    for (const button of get('group-list').querySelectorAll<HTMLButtonElement>('button'))
      button.disabled = on && !textSave;
    get<HTMLInputElement>('new-character-name').disabled = on && !textSave;
    for (const id of [
      'live-moment-category',
      'live-moment-title',
      'live-moment-summary',
      'live-moment-follow-up',
    ])
      get<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(id).disabled =
        on && !textSave;
    if (structural)
      for (const id of [
        ...profileFields.map(([id]) => id),
        'running-title',
        'running-notes',
        'running-read-aloud',
        'running-location',
      ])
        get<HTMLInputElement>(id).disabled = on;
    get<HTMLSelectElement>('running-location').disabled = !sources || (on && structural);
    get<HTMLButtonElement>('adoption-preview').disabled =
      (on && !textSave) ||
      !sources?.plans.find((p) => p.id === value('adoption-plan'))?.scenes.length;
    partyMove.busy(on && !textSave);
    for (const button of get('roster-list').querySelectorAll('button'))
      (button as HTMLButtonElement).disabled = on;
  }
  function mergeAck(ack: LiveAck, action: LiveAction, submittedProfile?: CharacterProfile) {
    if (!drafts.view) return;
    liveReadRequest++;
    recapEditor.acceptAck(ack, action);
    drafts.acceptAck(ack, action, submittedProfile);
    partyMove.accepted(action);
    // Publish each confirmed LiveAck through the same composition as an opened scene.
    renderList();
    renderCharacter();
    renderScene();
    document.dispatchEvent(new Event('campaign-party-changed'));
  }
  type NewCharacterBasis = { token: string; sceneId: string | null; focusRevision: number | null };
  let newCharacterBasis: NewCharacterBasis | null = null,
    creatingCharacter = false;
  function openNewCharacter() {
    if (!context || !drafts.view || creatingCharacter) return;
    newCharacterBasis = {
      token: context.token,
      sceneId: drafts.view.scene?.id ?? null,
      focusRevision: drafts.view.focusRevision,
    };
    get('character-create-target').textContent = drafts.view.scene
      ? 'Heute dabei in: ' + (drafts.view.scene.title || 'Aktuelle Gruppe')
      : 'Noch keine Gruppe geöffnet. Die Figur wird zunächst im Roster vorgemerkt.';
    const join = get<HTMLButtonElement>('character-create-active');
    join.hidden = !drafts.view.scene;
    join.type = drafts.view.scene ? 'submit' : 'button';
    get('character-create-status').textContent = '';
    get<HTMLDialogElement>('character-dialog').showModal();
    get('new-character-name').focus();
  }
  async function createNewCharacter(active: boolean) {
    const basis = newCharacterBasis,
      dialog = get<HTMLDialogElement>('character-dialog');
    if (creatingCharacter || !basis || !dialog.open) return;
    const current = () =>
      context?.token === basis.token &&
      !!drafts.view &&
      (!active ||
        (drafts.view.scene?.id === basis.sceneId &&
          drafts.view.focusRevision === basis.focusRevision));
    if (!current() || (active && !basis.sceneId)) {
      get('character-create-status').textContent =
        'Die Zielgruppe hat sich geändert. Schließe diesen Dialog und wähle die aktuelle Gruppe erneut.';
      return;
    }
    creatingCharacter = true;
    get<HTMLFormElement>('character-form').inert = true;
    get('character-create-status').textContent = 'Wird angelegt…';
    const name = value('new-character-name');
    try {
      if (!(await flushLive()) || !current()) {
        if (context?.token === basis.token)
          get('character-create-status').textContent =
            'Nicht angelegt. Prüfe den Speicherstatus und die Zielgruppe.';
        return;
      }
      const ack = await execute({ kind: 'create-character', profile: { name } });
      if (!ack?.character) {
        if (context?.token === basis.token)
          get('character-create-status').textContent =
            'Anlegen nicht bestätigt. Die Eingabe bleibt offen. Prüfe zuerst den Speicherstatus.';
        return;
      }
      if (context?.token !== basis.token) return;
      drafts.select(ack.character.id);
      dialog.close();
      newCharacterBasis = null;
      get<HTMLInputElement>('new-character-name').value = '';
      renderList();
      renderCharacter();
      if (active && current()) {
        const joined = await execute({
          kind: 'membership',
          characterId: ack.character.id,
          expectedRevision: ack.character.membershipRevision,
          expectedRosterRevision: drafts.view!.rosterRevision,
          active: true,
          targetSceneId: basis.sceneId,
          expectedFocusRevision: basis.focusRevision,
        });
        if (context?.token !== basis.token) return;
        if (joined?.character?.active && current()) {
          get('character-result').textContent = name + ' ist heute dabei.';
          tell(name + ' ist heute dabei. HP und Zustände kannst du an der Figur ergänzen.');
          get('live-party-new').focus({ preventScroll: true });
          return;
        }
      }
      if (context?.token !== basis.token) return;
      get('character-result').textContent = active
        ? 'Figur im Roster angelegt; Aktivierung nicht bestätigt. Prüfe den Speicherstatus und aktiviere sie anschließend gezielt.'
        : 'Figur im Roster angelegt. Du kannst sie hier für heute aktivieren oder ihr Profil ergänzen.';
      showCharacterProfile();
      get('character-toggle').scrollIntoView({ block: 'center' });
      get('character-toggle').focus({ preventScroll: true });
    } finally {
      creatingCharacter = false;
      get<HTMLFormElement>('character-form').inert = false;
    }
  }
  function renderList() {
    const list = get('roster-list');
    list.replaceChildren();
    const token = context?.token;
    for (const character of drafts.view?.roster ?? []) {
      const group = drafts.view?.scenes.find((s) => s.id === character.sceneId);
      const button = document.createElement('button');
      button.textContent =
        character.profile.name +
        (character.active
          ? ' · dabei' +
            (drafts.view!.scenes.length > 1 && group
              ? ' · ' +
                (group.title ||
                  (group.primary ? 'Hauptgruppe' : 'Gruppe mit ' + groupPeople(group.id)))
              : '')
          : ' · inaktiv');
      button.setAttribute('aria-pressed', String(character.id === drafts.selection));
      button.disabled = intentBlocked();
      button.onclick = () => {
        void (async () => {
          if (!(await flushLive()) || context?.token !== token) return;
          drafts.select(character.id);
          renderCharacter();
          renderList();
        })();
      };
      list.append(button);
    }
    if (!drafts.view?.roster.length) {
      const text = document.createElement('p');
      text.textContent = 'Noch keine Figuren. Eine leere Party kann ebenfalls leiten.';
      list.append(text);
    }
  }
  const profileFields = [
    ['character-name', 'name'],
    ['character-player', 'playerName'],
    ['character-species', 'species'],
    ['character-class', 'characterClass'],
    ['character-ac', 'armorClass'],
    ['character-perception', 'passivePerception'],
    ['character-speed', 'speedFeet'],
  ] as const;
  function renderCharacter() {
    get('character-result').textContent = '';
    get('character-editor').hidden = !drafts.character;
    for (const [id, field] of profileFields)
      get<HTMLInputElement>(id).value = String(drafts.character?.profile[field] ?? '');
    renderMembership();
  }
  function renderMembership() {
    progressionContext(context, drafts.view, drafts.selection);
    const c = originalCharacter();
    get('character-membership').textContent = c?.active
      ? 'Teil der aktuellen Party'
      : 'Nicht in der aktuellen Party';
    get('character-toggle').textContent = c?.active
      ? 'Für heute deaktivieren'
      : 'Für heute aktivieren';
  }
  function renderVisits() {
    const plan = sources?.plans.find((p) => p.id === value('adoption-plan')),
      select = get<HTMLSelectElement>('adoption-visit');
    select.replaceChildren();
    for (const [index, visit] of (plan?.scenes ?? []).entries()) {
      const option = document.createElement('option');
      option.value = visit.id;
      option.textContent = index + 1 + '. ' + (visit.title || 'Unbenannter Besuch');
      select.append(option);
    }
    get<HTMLButtonElement>('adoption-preview').disabled = !plan?.scenes.length || intentBlocked();
  }
  function renderVisitRewardEntry() {
    const button = get<HTMLButtonElement>('live-visit-reward'),
      scene = drafts.view?.scene;
    button.hidden = !resumed || !scene?.adoption;
    button.title = scene?.adoption ? 'Vorbereitete XP und Beute: ' + scene.title : '';
  }
  async function openCurrentVisitReward() {
    const token = context?.token,
      scene = drafts.view?.scene,
      adoption = scene?.adoption;
    if (!token || !scene || !adoption || !resumed) return;
    const sceneId = scene.id,
      membership = scene.membershipRevision,
      adoptionId = adoption.id;
    const current = () =>
      context?.token === token &&
      resumed &&
      drafts.view?.scene?.id === sceneId &&
      drafts.view.scene.membershipRevision === membership &&
      drafts.view.scene.adoption?.id === adoptionId;
    if (!current() || !(await flushLive()) || !current()) return;
    await openPreparedReward(adoption.planId, adoption.visitId, current);
  }
  function renderSceneMeta() {
    renderVisitRewardEntry();
    visitBinder?.contextChanged();
    timeNavigator?.contextChanged();
    npcCastBinder?.contextChanged();
    liveGenerator?.contextChanged();
    sessionNavigatorContext(context, drafts.view, sources, resumed);
    syncLivePacketContext();
    void refreshMusic();
    if (context && drafts.view?.scene && resumed)
      void host.world.renderLiveWorld(context.token, drafts.view.scene.id);
    const scene = drafts.view?.scene;
    sceneDeskContext(context, resumed ? (scene ?? null) : null);
    combatContext(context, resumed ? (scene ?? null) : null, drafts.view?.rosterRevision);
    chaseContext(
      context,
      resumed ? (scene ?? null) : null,
      drafts.view?.roster ?? [],
      scene ? formatSceneInstant(scene.clock.instantMs) : '',
    );
    const active = drafts.view?.roster.filter((c) => c.active && c.sceneId === scene?.id) ?? [];
    get('live-party').textContent = active.length
      ? 'Dabei: ' + active.map((c) => c.profile.name).join(', ')
      : 'Leere Party – Scene bleibt verfügbar.';
    renderPartyReference();
    timeControls.contextChanged();
    get('live-clock').textContent = scene
      ? 'Seit Kampagnenbeginn: ' + formatSceneInstant(scene.clock.instantMs)
      : '';
    renderTimePreview();
    void refreshScenePreparation();
    void refreshRuleReferences(resumed ? (scene?.id ?? null) : null);
    renderSceneOrigin();
    renderScenePlace();
  }
  function renderSceneOrigin() {
    const scene = drafts.view?.scene,
      origin = get('running-origin');
    origin.replaceChildren();
    if (scene?.adoption) {
      const a = scene.adoption,
        title = document.createElement('p'),
        notes = document.createElement('p'),
        place = document.createElement('p');
      title.textContent = 'Übernommen: ' + (a.title || 'Unbenannter Besuch');
      notes.textContent = a.notes;
      place.textContent =
        'Ort bei Übernahme: ' +
        (sources?.locations.find((l) => l.document.id === a.locationId)?.document.name ??
          (a.locationId ? 'nicht verfügbar' : 'kein Ort'));
      origin.append(title, notes, place);
    } else origin.textContent = 'Noch kein vorbereiteter Besuch übernommen.';
  }
  function renderScenePlace() {
    get('running-context-summary').textContent =
      (sources?.locations.find((l) => l.document.id === drafts.scene?.locationId)?.document.name ??
        (drafts.scene?.locationId ? 'Ort nicht verfügbar' : 'Kein Ort')) +
      ' · Titel und Ort ändern';
    get<HTMLButtonElement>('running-open-location').disabled = !drafts.scene?.locationId;
    get<HTMLButtonElement>('running-player-location').disabled = !drafts.scene?.locationId;
  }
  function activeParty() {
    const scene = drafts.view?.scene;
    return (
      drafts.view?.roster.filter(
        (character) => character.active && character.sceneId === scene?.id,
      ) ?? []
    );
  }
  function renderPassivePerception() {
    const result = get('live-passive-result');
    try {
      result.textContent = passivePerceptionResult(
        activeParty().map((character) => ({
          name: character.profile.name,
          passivePerception: character.profile.passivePerception,
        })),
        Number(value('live-passive-dc')),
      );
    } catch (error) {
      result.textContent = (error as Error).message;
    }
  }
  let healthOwner: { token: string; sceneId: string; characterId: string } | null = null;
  let healthReturnFocus = true;
  function releaseHealthDialog() {
    const owner = healthOwner;
    healthOwner = null;
    get('character-health-home').append(get('character-health'));
    if (owner && owner.token === context?.token) renderPartyReference();
    if (healthReturnFocus && owner)
      for (const button of get('live-party-reference').querySelectorAll<HTMLButtonElement>(
        'button',
      ))
        if (button.dataset.characterId === owner.characterId) {
          button.focus({ preventScroll: true });
          break;
        }
    healthReturnFocus = true;
  }
  function closeHealthDialog(returnFocus = true) {
    healthReturnFocus = returnFocus;
    get<HTMLDialogElement>('live-health-dialog').close();
    releaseHealthDialog();
  }
  function showCharacterProfile() {
    get<HTMLDetailsElement>('live-party-details').open = true;
    get('live-party-panel').hidden = false;
    get('character-editor').scrollIntoView({ block: 'nearest' });
    get<HTMLInputElement>('character-name').focus({ preventScroll: true });
  }
  function initHealthDialog() {
    get('live-health-dialog').addEventListener('close', () => {
      if (!get<HTMLDialogElement>('live-health-dialog').open) releaseHealthDialog();
    });
    get('live-health-close').onclick = () => closeHealthDialog();
    get('live-health-profile').onclick = () => {
      closeHealthDialog(false);
      showCharacterProfile();
    };
  }
  async function openPartyHealth(
    id: string,
    token: string | undefined,
    sceneId: string | undefined,
  ) {
    const dialog = get<HTMLDialogElement>('live-health-dialog');
    if (
      dialog.open ||
      !(await flushLive()) ||
      context?.token !== token ||
      drafts.view?.scene?.id !== sceneId ||
      !activeParty().some((c) => c.id === id)
    )
      return;
    drafts.select(id);
    renderCharacter();
    renderList();
    healthOwner = { token: token!, sceneId: sceneId!, characterId: id };
    get('live-health-title').textContent = originalCharacter()!.profile.name + ' · HP und Zustände';
    get('live-health-group').textContent =
      'Gruppe: ' + (drafts.view?.scene?.title || 'Aktuelle Gruppe');
    get('live-health-status').textContent = '';
    get('live-health-slot').append(get('character-health'));
    get<HTMLDetailsElement>('health-controls').open =
      !progressCharacters().find((c) => c.characterId === id)?.health || hasHealthDraft(id);
    dialog.showModal();
    get<HTMLInputElement>(
      get<HTMLDetailsElement>('health-controls').open ? 'health-current' : 'health-amount',
    ).focus({ preventScroll: true });
  }
  let lootReturnOwner: { token: string; sceneId: string; characterId: string } | null = null;
  async function openPartyLoot(id: string, token: string | undefined, sceneId: string | undefined) {
    const current = () =>
      !!token &&
      context?.token === token &&
      drafts.view?.scene?.id === sceneId &&
      activeParty().some((c) => c.id === id);
    if (!current() || !(await flushLive()) || !current()) return;
    drafts.select(id);
    renderCharacter();
    renderList();
    lootReturnOwner = { token: token!, sceneId: sceneId!, characterId: id };
    get('live-loot-back').hidden = false;
    get('reward-panel').classList.add('is-personal-loot');
    get('ledger-character-heading').scrollIntoView({ block: 'start' });
    get('ledger-character-heading').tabIndex = -1;
    get('ledger-character-heading').focus({ preventScroll: true });
  }
  /** Open a confirmed recipient without changing group membership or focus. */
  async function openLiveCharacterLoot(id: string) {
    const token = context?.token;
    if (
      !(await ensureLiveRuntime()) ||
      context?.token !== token ||
      !(await flushLive()) ||
      context?.token !== token
    )
      return;
    const character = drafts.view?.roster.find((c) => c.id === id && !c.archived);
    if (!character) throw new Error('Beuteempfänger ist nicht mehr verfügbar.');
    drafts.select(id);
    renderCharacter();
    renderList();
    lootReturnOwner = activeParty().some((c) => c.id === id)
      ? { token: token!, sceneId: drafts.view!.scene!.id, characterId: id }
      : null;
    get('live-loot-back').hidden = !lootReturnOwner;
    get('reward-panel').classList.toggle('is-personal-loot', !!lootReturnOwner);
    get('ledger-character-heading').scrollIntoView({ block: 'start' });
    get('ledger-character-heading').tabIndex = -1;
    get('ledger-character-heading').focus({ preventScroll: true });
  }
  function returnFromPartyLoot() {
    const owner = lootReturnOwner;
    get('live-loot-back').hidden = true;
    lootReturnOwner = null;
    get('reward-panel').classList.remove('is-personal-loot');
    if (
      !owner ||
      context?.token !== owner.token ||
      drafts.view?.scene?.id !== owner.sceneId ||
      !activeParty().some((c) => c.id === owner.characterId)
    )
      return;
    get('live-party-quick').scrollIntoView({ block: 'start' });
    [...get('live-party-reference').querySelectorAll<HTMLButtonElement>('[data-character-id]')]
      .find((b) => b.dataset.characterId === owner.characterId)
      ?.focus({ preventScroll: true });
  }
  function renderPartyReference() {
    const active = activeParty(),
      progress = new Map(progressCharacters().map((row) => [row.characterId, row])),
      reference = get('live-party-reference');
    if (
      healthOwner &&
      (healthOwner.token !== context?.token ||
        healthOwner.sceneId !== drafts.view?.scene?.id ||
        healthOwner.characterId !== drafts.selection ||
        !active.some((c) => c.id === healthOwner!.characterId))
    )
      closeHealthDialog(false);
    reference.replaceChildren();
    if (
      lootReturnOwner &&
      (lootReturnOwner.token !== context?.token ||
        lootReturnOwner.sceneId !== drafts.view?.scene?.id ||
        lootReturnOwner.characterId !== drafts.selection ||
        !active.some((c) => c.id === lootReturnOwner!.characterId))
    ) {
      lootReturnOwner = null;
      get('live-loot-back').hidden = true;
    }
    get('reward-panel').classList.toggle('is-personal-loot', !!lootReturnOwner);
    for (const character of active) {
      const button = document.createElement('button'),
        name = document.createElement('strong'),
        facts = document.createElement('span'),
        action = document.createElement('small'),
        profile = character.profile,
        row = progress.get(character.id);
      name.textContent = profile.name + (profile.playerName ? ' · ' + profile.playerName : '');
      name.title = name.textContent;
      facts.textContent =
        partyHealthFacts(row) +
        ' · ' +
        partyProgressFacts(row) +
        ' · RK ' +
        (profile.armorClass ?? '—') +
        ' · Bewegung ' +
        (profile.speedFeet === undefined ? '—' : profile.speedFeet + ' ft') +
        (profile.characterClass ? ' · ' + profile.characterClass : '');
      action.textContent = hasHealthDraft(character.id)
        ? 'HP-Eingabe offen · weiter bearbeiten →'
        : 'HP und Zustände bearbeiten →';
      button.type = 'button';
      button.dataset.characterId = character.id;
      const passives = document.createElement('span'),
        languages = document.createElement('span');
      passives.className = 'live-party-passives';
      passives.setAttribute('aria-label', 'Passive Werte');
      for (const [label, value] of [
        ['Wahrnehmung', profile.passivePerception],
        ['Einsicht', profile.passiveInsight],
        ['Untersuchung', profile.passiveInvestigation],
      ] as const) {
        const cell = document.createElement('span'),
          number = document.createElement('b');
        cell.append(label + ' ');
        number.textContent = String(value ?? '—');
        cell.append(number);
        passives.append(cell);
      }
      languages.textContent =
        'Sprachen: ' + (profile.languages?.length ? profile.languages.join(', ') : '—');
      const passiveLabel = document.createElement('span');
      passiveLabel.textContent = 'Passive Werte';
      button.append(name, facts, passiveLabel, passives, languages, action);
      button.setAttribute('aria-label', profile.name + ' · HP und Zustände bearbeiten');
      const token = context?.token,
        sceneId = drafts.view?.scene?.id;
      button.onclick = () => {
        void openPartyHealth(character.id, token, sceneId).catch((error) =>
          tell((error as Error).message, true),
        );
      };
      const card = document.createElement('article'),
        loot = document.createElement('button');
      card.className = 'live-party-quick-card';
      loot.type = 'button';
      loot.className = 'live-party-loot';
      loot.textContent = 'Beute ansehen';
      loot.setAttribute('aria-label', profile.name + ' · Beute ansehen');
      loot.onclick = () => {
        void openPartyLoot(character.id, token, sceneId).catch((error) =>
          tell((error as Error).message, true),
        );
      };
      card.append(button, loot);
      reference.append(card);
    }
    get('live-party-reference-empty').hidden = !!active.length;
    get<HTMLButtonElement>('live-passive-check').disabled = !active.length;
    const passiveResult = get('live-passive-result');
    if (!active.length) passiveResult.textContent = '';
    else if (passiveResult.textContent) renderPassivePerception();
  }
  async function showLiveNpc(npcId: string, isCurrent = () => true): Promise<boolean> {
    const token = context?.token,
      focus = playerFocus();
    if (!focus || !npcId || !isCurrent()) return false;
    if ((await flushLive()) && context?.token === token && isCurrent())
      return cuePlayerImage('npc', npcId, focus);
    return false;
  }
  async function useLiveReferenceReadAloud(
    text: string,
    title: string,
    expectedSceneId: string,
    stillCurrent: () => boolean = () => true,
  ) {
    const token = context?.token,
      focus = drafts.view?.focusRevision;
    const current = () =>
      stillCurrent() &&
      context?.token === token &&
      drafts.view?.scene?.id === expectedSceneId &&
      drafts.view?.focusRevision === focus;
    if (
      !token ||
      !current() ||
      !(await ensureLiveRuntime()) ||
      !current() ||
      !(await flushLive()) ||
      !current()
    )
      throw new Error('Die laufende Gruppe hat sich geändert. Schnellsuche neu öffnen.');
    useKnowledgeReadAloud(text, title);
    if (!(await flushLive()))
      throw new Error('Vorlesetext konnte noch nicht gespeichert werden. Eingabe bleibt offen.');
  }
  function useKnowledgeReadAloud(text: string, title: string) {
    if (!drafts.scene) return;
    drafts.editScene({ readAloud: text });
    get<HTMLTextAreaElement>('running-read-aloud').value = text;
    get<HTMLDetailsElement>('running-read-aloud-details').open = true;
    schedule();
    get<HTMLTextAreaElement>('running-read-aloud').focus();
    tell('Vorlesetext aus „' + title + '“ übernommen – wird automatisch gespeichert.');
  }
  function placePartyEditor(atTable: boolean) {
    const panel = get('live-party-panel'),
      slot = get(atTable ? 'live-party-at-table' : 'live-party-start');
    if (panel.parentElement !== slot) slot.append(panel);
  }
  function renderScene() {
    if (drafts.view && !drafts.view.scene && !drafts.view.roster.length)
      get<HTMLDetailsElement>('live-party-details').open = true;
    placePartyEditor(resumed && !!drafts.scene);
    if (preparedNotesSceneId !== drafts.view?.scene?.id) {
      preparedNotesSceneId = drafts.view?.scene?.id ?? null;
      preparedNoteIds.clear();
    }
    get('live-focus-bar').hidden = !resumed || !drafts.scene;
    get('running-editor').hidden = !resumed || !drafts.scene;
    get('live-start-hint').hidden = resumed;
    get('live-continue').hidden = resumed;
    get('live-play-heading').hidden = resumed;
    const proseOwner = context && drafts.scene ? context.token + ':' + drafts.scene.id : null;
    const readAloud = get<HTMLTextAreaElement>('running-read-aloud'),
      nextReadAloud = drafts.scene?.readAloud ?? '';
    if (readAloudOwner !== proseOwner || (!readAloud.value.trim() && nextReadAloud.trim())) {
      get<HTMLDetailsElement>('running-read-aloud-details').open = !!nextReadAloud.trim();
      readAloudOwner = proseOwner;
    }
    get<HTMLInputElement>('running-title').value = drafts.scene?.title ?? '';
    get<HTMLTextAreaElement>('running-notes').value = drafts.scene?.notes ?? '';
    get<HTMLTextAreaElement>('running-read-aloud').value = drafts.scene?.readAloud ?? '';
    get<HTMLButtonElement>('running-player-location').disabled = !drafts.scene?.locationId;
    renderLiveMomentDraft();
    renderLocationChoices();
    renderNpcChoices();
    renderLiveSession();
    renderLiveKnowledge();
    renderSceneMeta();
    renderGroups();
  }
  function renderLocationChoices() {
    const select = get<HTMLSelectElement>('running-location');
    select.replaceChildren();
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'Kein Ort';
    select.append(none);
    const current = drafts.scene?.locationId;
    for (const row of sources?.locations.filter((l) => !l.trashed || l.document.id === current) ??
      []) {
      const option = document.createElement('option');
      option.value = row.document.id;
      option.textContent = row.document.name + (row.trashed ? ' (Papierkorb)' : '');
      option.disabled = row.trashed;
      select.append(option);
    }
    if (current && !sources?.locations.some((l) => l.document.id === current)) {
      const option = document.createElement('option');
      option.value = current;
      option.textContent = 'Ort nicht verfügbar';
      option.disabled = true;
      select.append(option);
    }
    select.value = current ?? '';
    select.disabled = !sources || intentBlocked();
  }
  function groupPeople(id: string) {
    return (
      drafts.view?.roster
        .filter((c) => c.active && c.sceneId === id)
        .map((c) => c.profile.name)
        .join(', ') || 'Leere Party'
    );
  }
  function groupLabel(
    group: Pick<LiveView['scenes'][number], 'id' | 'title' | 'primary' | 'clock'>,
  ) {
    return (
      (group.title || 'Unbenannte Gruppe') +
      (group.primary ? ' · Hauptgruppe' : '') +
      ' · ' +
      groupPeople(group.id) +
      ' · ' +
      formatSceneInstant(group.clock.instantMs)
    );
  }
  function renderLiveSession() {
    const recap = liveSessionRecap(
      sessionChronicle?.entries ?? [],
      sessionChronicle?.latestSessionMarker,
    );
    sessionResumeUI.renderButton(
      recap.open,
      !!recap.marker,
      !!sessionChronicleError || intentBlocked(),
    );
    const status = get('live-session-status'),
      list = get('live-session-events');
    list.replaceChildren();
    get<HTMLButtonElement>('live-session-start').hidden = recap.open || !!recap.marker;
    get<HTMLButtonElement>('live-session-end').hidden = !recap.open;
    get<HTMLButtonElement>('live-session-start').disabled =
      !!sessionChronicleError || intentBlocked();
    get<HTMLButtonElement>('live-session-end').disabled =
      !!sessionChronicleError || intentBlocked() || !!recapReadError();
    get('live-session-summary-label').hidden = !recap.open;
    get('live-session-handoff-label').hidden = !recap.open;
    if (sessionChronicleError)
      status.textContent = 'Rückblick nicht verfügbar: ' + sessionChronicleError;
    else if (!recap.marker) status.textContent = 'Noch kein Spielabend markiert.';
    else {
      const when = new Date(recap.marker.recordedAt),
        label = Number.isNaN(when.valueOf())
          ? ''
          : when.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
      status.textContent = recap.open
        ? 'Läuft seit ' + label + ' · ' + recap.entries.length + ' bestätigte Ereignisse'
        : 'Letzter Spielabend beendet ' +
          label +
          ' · ' +
          recap.entries.length +
          ' bestätigte Ereignisse' +
          (recap.marker.summary ? ' · ' + recap.marker.summary : '');
    }
    if (sessionChronicle?.truncated)
      status.textContent +=
        ' · Gekürzter Chronikausschnitt; weitere Ereignisse über die Chroniksuche.';
    for (const entry of recap.entries.slice(0, 12)) {
      const item = document.createElement('li'),
        strong = document.createElement('strong'),
        span = document.createElement('span');
      strong.textContent = entry.title;
      span.textContent = [
        entry.summary,
        entry.scene && 'Gruppe: ' + entry.scene,
        entry.location && 'Ort: ' + entry.location,
      ]
        .filter(Boolean)
        .join(' · ');
      item.append(strong);
      if (span.textContent) item.append(span);
      list.append(item);
    }
    const lastEnd =
      sessionChronicle?.latestSessionMarker?.sessionMarker === 'end'
        ? sessionChronicle.latestSessionMarker
        : sessionChronicle?.entries.find((entry) => entry.sessionMarker === 'end');
    const handoff = lastEnd?.handoff ?? '';
    get('live-session-handoff-preview').hidden = !handoff;
    get('live-session-handoff-text').textContent = handoff;
    get('live-session-more').hidden = recap.entries.length <= 12;
  }
  async function refreshChaseConsequences() {
    const owner = context,
      before = drafts.view?.scene;
    if (!owner || !before) return;
    const current = () => context === owner && drafts.view?.scene === before;
    try {
      const scene = unwrap(await window.campaign.liveScene(owner.token, before.id));
      if (
        !current() ||
        scene.id !== before.id ||
        scene.clock.epochId !== before.clock.epochId ||
        scene.clock.revision < before.clock.revision
      )
        return;
      drafts.acceptClock(scene);
      renderSceneMeta();
      await refreshLiveSession();
    } catch (error) {
      if (current())
        tell('Verfolgung gespeichert; Gruppenzeit neu laden: ' + (error as Error).message, true);
    }
  }
  async function refreshLiveSession() {
    const token = context?.token,
      n = ++sessionChronicleRequest;
    if (!token) return;
    const result = await readSessionChronicle(token);
    if (context?.token !== token || n !== sessionChronicleRequest) return;
    if (result.ok) {
      sessionChronicle = result.value;
      sessionChronicleError = '';
    } else sessionChronicleError = result.error;
    renderLiveSession();
  }
  async function startLiveSession(sceneId?: string, current: () => boolean = () => true) {
    const token = context?.token,
      id = drafts.view?.scene?.id,
      focus = drafts.view?.focusRevision;
    const sourceCurrent = () =>
      current() &&
      context?.token === token &&
      drafts.view?.scene?.id === id &&
      drafts.view?.focusRevision === focus;
    if (!token || !id || !sourceCurrent() || sessionChronicleError) return false;
    if (sceneId && drafts.view?.focusId !== sceneId) {
      if (
        !(await changeFocus(sceneId, sourceCurrent)) ||
        context?.token !== token ||
        drafts.view?.scene?.id !== sceneId ||
        !current()
      )
        return false;
    }
    if (
      liveSessionRecap(sessionChronicle?.entries ?? [], sessionChronicle?.latestSessionMarker).open
    ) {
      renderLiveSession();
      return false;
    }
    return markLiveSession('start', undefined, undefined, current);
  }
  function renderNpcChoices() {
    if (!sources) {
      const select = get<HTMLSelectElement>('running-player-npc');
      select.replaceChildren();
      select.disabled = true;
      get<HTMLButtonElement>('running-player-npc-show').disabled = true;
      get('running-player-npc-result').textContent = liveSourcesProblem;
      return;
    }
    get<HTMLSelectElement>('running-player-npc').disabled = false;
    renderLiveNpcChoices(
      get<HTMLSelectElement>('running-player-npc'),
      get<HTMLButtonElement>('running-player-npc-show'),
      get('running-player-npc-result'),
      (sources?.notes.filter((row) => !row.trashed && row.note.kind === 'npc') ?? []).map(
        (row) => ({
          id: row.note.id,
          title: row.note.title,
        }),
      ),
      value('running-player-npc-filter'),
    );
  }
  function renderGroups() {
    const select = get<HTMLSelectElement>('scene-focus');
    select.replaceChildren();
    const cards = get('group-list');
    cards.replaceChildren();
    cards.hidden = !resumed || (drafts.view?.scenes.length ?? 0) < 2;
    for (const group of drafts.view?.scenes ?? []) {
      const option = document.createElement('option');
      option.value = group.id;
      const people =
        drafts
          .view!.roster.filter((c) => c.active && c.sceneId === group.id)
          .map((c) => c.profile.name)
          .join(', ') || 'Leere Party';
      option.textContent = groupLabel(group);
      select.append(option);
      if (group.id === drafts.view?.focusId) continue;
      const button = document.createElement('button'),
        name = document.createElement('strong'),
        facts = document.createElement('small');
      name.textContent =
        (group.title || 'Unbenannte Gruppe') + (group.primary ? ' · Hauptgruppe' : '');
      facts.textContent = people + ' · ' + formatSceneInstant(group.clock.instantMs);
      button.append(name, facts);
      button.setAttribute('aria-pressed', String(drafts.view?.focusId === group.id));
      button.disabled = intentBlocked();
      button.onclick = () => {
        void (async () => {
          if (await changeFocus(group.id)) select.focus({ preventScroll: true });
        })();
      };
      cards.append(button);
    }
    select.value = drafts.view?.focusId ?? '';
    get<HTMLButtonElement>('group-move').disabled =
      !drafts.view?.scene?.members.length || intentBlocked();
    get('live-archives').hidden = !drafts.view?.archiveCount;
    get('live-archives').textContent =
      'Frühere Gruppen ansehen (' + (drafts.view?.archiveCount ?? 0) + ')';
  }
  async function changeFocus(id: string, current: () => boolean = () => true) {
    const token = context?.token,
      revision = drafts.view?.focusRevision,
      combat = get('combat-panel'),
      bounds = combat.getBoundingClientRect?.();
    const atCombat =
      !combat.hidden &&
      bounds &&
      Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0) >
        window.innerHeight / 2;
    if (
      !current() ||
      revision === null ||
      revision === undefined ||
      !(await flushLive()) ||
      context?.token !== token ||
      !current()
    ) {
      if (current()) get<HTMLSelectElement>('scene-focus').value = drafts.view?.focusId ?? '';
      return false;
    }
    if (await execute({ kind: 'focus', sceneId: id, expectedRevision: revision })) {
      (atCombat ? combat : get('live-workspace')).scrollIntoView?.({ block: 'start' });
      return true;
    }
    return false;
  }
  function render() {
    get('live-empty').hidden = !!drafts.view;
    get('live-workspace').hidden = !drafts.view;
    renderList();
    renderCharacter();
    renderScene();
    get('live-sources-state').hidden = !liveSourcesProblem;
    get('live-sources-status').textContent = liveSourcesProblem;
    get('live-sources-retry').hidden = liveSourcesLoading;
    renderAdoptionPlans();
  }
  function renderAdoptionPlans() {
    const select = get<HTMLSelectElement>('adoption-plan'),
      current = select.value,
      visit = value('adoption-visit');
    select.disabled = !sources;
    get<HTMLSelectElement>('adoption-visit').disabled = !sources;
    if (!sources) {
      get<HTMLButtonElement>('adoption-preview').disabled = true;
      return;
    }
    select.replaceChildren();
    for (const plan of sources?.plans ?? []) {
      const option = document.createElement('option');
      option.value = plan.id;
      option.textContent = plan.name || 'Unbenannter Plan';
      select.append(option);
    }
    if (sources?.plans.some((p) => p.id === current)) select.value = current;
    renderVisits();
    if (sources.plans.find((p) => p.id === select.value)?.scenes.some((v) => v.id === visit))
      get<HTMLSelectElement>('adoption-visit').value = visit;
  }
  function initLive(
    status: typeof tell,
    navigate: typeof openLocation,
    openNote: typeof openKnowledgeNote = async () => {},
    openNotebook: typeof openLocationNotebook = async () => {},
    openReward: typeof openPreparedReward = async () => {},
    openDeadline: typeof openMomentDeadline = async () => {},
    openVisit: typeof openMomentVisit = async () => true,
  ) {
    const sourceState = document.createElement('div');
    sourceState.id = 'live-sources-state';
    sourceState.hidden = true;
    sourceState.className = 'toolbar';
    sourceState.innerHTML =
      '<p id="live-sources-status" role="status"></p><button id="live-sources-retry" type="button">Vorbereitung erneut laden</button>';
    get('live-workspace').before(sourceState);
    get('live-sources-retry').onclick = () => void reloadLiveSources();
    const rewardButton = document.createElement('button');
    rewardButton.id = 'live-visit-reward';
    rewardButton.type = 'button';
    rewardButton.textContent = 'Besuchsbelohnung…';
    rewardButton.hidden = true;
    get('combat-resume').after(rewardButton);
    rewardButton.onclick = () =>
      void openCurrentVisitReward().catch((error) => tell(error.message, true));
    sessionResumeUI.init();
    tell = status;
    openLocation = navigate;
    openKnowledgeNote = openNote;
    openLocationNotebook = openNotebook;
    openPreparedReward = openReward;
    openMomentDeadline = openDeadline;
    openMomentVisit = openVisit;
    initSessionNavigator(
      status,
      async (planId, visitId) => {
        await previewPlannedVisit(planId, visitId);
      },
      async (sceneId, adoptionId, status, outcome) => {
        const token = context?.token;
        if (
          !token ||
          !(await flushLive()) ||
          context?.token !== token ||
          drafts.view?.scene?.id !== sceneId ||
          drafts.view.scene.adoption?.id !== adoptionId
        )
          return false;
        const ack = await execute({
          kind: 'visit-outcome',
          sceneId,
          adoptionId,
          expectedRevision: drafts.view.scene.revision,
          status,
          outcome,
        });
        return !!ack;
      },
    );
    const packetButton = document.createElement('button');
    packetButton.id = 'live-session-packet';
    packetButton.type = 'button';
    packetButton.textContent = 'Mappe am Spieltisch öffnen';
    get('live-session-progress-refresh').after(packetButton);
    packetButton.onclick = () => void openLivePacket().catch((e) => tell(e.message, true));
    get('live-session-plan').addEventListener('change', syncLivePacketContext);
    npcCastBinder = new NpcCastBinder(
      status,
      () =>
        context && drafts.view?.scene && resumed
          ? { workspace: context, scene: drafts.view.scene }
          : null,
      flushLive,
      useLiveReferenceReadAloud,
      addLiveNpc,
      async (id, contact, current) => {
        await npcNavigation?.(id, contact, current);
      },
      async (id, current) => {
        if (current()) await openKnowledgeNote(id, current);
      },
      async (id, current) => {
        if (current()) await openGroup?.(id, current);
      },
      async (id, current) => {
        await npcAutonomyNavigation?.(id, current);
      },
      async (id, current) => {
        await npcPlacesNavigation?.(id, current);
      },
      async (id, current) => {
        if (current()) await openLocationNotebook(id, current);
      },
    );
    const castButton = document.createElement('button');
    castButton.id = 'live-npc-cast';
    castButton.type = 'button';
    castButton.textContent = 'NSCs am Spieltisch…';
    get('live-party-reference').before(castButton);
    castButton.onclick = () => void npcCastBinder.open().catch((e) => tell(e.message, true));
    visitBinder = new SceneVisitBinder(
      status,
      () =>
        context && drafts.view?.scene && resumed
          ? { workspace: context, scene: drafts.view.scene }
          : null,
      flushLive,
      useLiveReferenceReadAloud,
      openKnowledgeNote,
    );
    liveGenerator = new LiveEncounterGenerator(
      status,
      () =>
        context && drafts.view?.scene && resumed ? { workspace: context, live: drafts.view } : null,
      flushLive,
      prepareGeneratedCombat,
    );
    const lootButton = document.createElement('button');
    lootButton.id = 'live-loot-distribute';
    lootButton.type = 'button';
    lootButton.textContent = 'Beute verteilen…';
    packetButton.after(lootButton);
    lootButton.onclick = () =>
      void (async () => {
        const token = context?.token,
          id = drafts.view?.scene?.id;
        if (
          !id ||
          !(await flushLive()) ||
          context?.token !== token ||
          drafts.view?.scene?.id !== id
        )
          return;
        await openTreasureDistribution(undefined, id);
      })().catch((e) => tell(e.message, true));
    sessionCloseUI.init();
    initSceneDesk(status, prepareLiveEncounter, addLiveCreature, {
      showNpc: showLiveNpc,
      blank: () => cuePlayer('blank', null),
    });
    initCombat(status, refreshScenePreparation);
    initChase(status, refreshChaseConsequences);
    initProgress(
      (text, error) => {
        status(text, error);
        if (get<HTMLDialogElement>('live-health-dialog').open) {
          get('live-health-status').textContent = text;
          get('live-health-status').className = error ? 'error' : 'caption';
        }
      },
      (scene) => {
        if (!drafts.acceptClock(scene)) return;
        renderSceneMeta();
        renderGroups();
      },
    );
    onProgressChanged(() => {
      renderPartyReference();
      void refreshLiveSession();
    });
    initHealthDialog();
    get('live-loot-back').onclick = returnFromPartyLoot;
    initRuleReferences(status);
    initGroups();
    get('scene-preparation-refresh').onclick = () => void refreshScenePreparation();
    get('live-next-visit').onclick = () => {
      void (async () => {
        if (!nextVisit || !(await flushLive())) return;
        const visit = nextVisit;
        if (!(await openLive(visit.planId, visit.visitId))) return;
        get<HTMLDetailsElement>('adoption-picker').open = true;
        get('adoption-preview').click();
      })();
    };
    for (const id of ['character-new', 'live-party-new']) get(id).onclick = openNewCharacter;
    get('character-cancel').onclick = () => get<HTMLDialogElement>('character-dialog').close();
    get('character-dialog').addEventListener('cancel', (event) => {
      if (creatingCharacter) event.preventDefault();
    });
    get('character-form').onsubmit = (event) => {
      event.preventDefault();
      void createNewCharacter(
        (event.submitter as HTMLElement | null)?.id === 'character-create-active',
      );
    };
    for (const [id, field] of profileFields) {
      get(id).oninput = () => {
        if (!drafts.character) return;
        const text = value(id),
          profile: CharacterProfile = { ...drafts.character.profile };
        if (field === 'name') profile.name = text;
        else if (!text) delete profile[field];
        else if (field === 'armorClass' || field === 'passivePerception' || field === 'speedFeet')
          profile[field] = Number(text);
        else profile[field] = text;
        drafts.editProfile(profile);
        schedule();
      };
      get(id).onblur = () => {
        if (!writer.composing) void flushLive();
      };
    }
    get('character-toggle').onclick = () => {
      void (async () => {
        const token = context?.token,
          id = drafts.selection;
        if (
          !(await flushLive()) ||
          context?.token !== token ||
          drafts.selection !== id ||
          !drafts.view
        )
          return;
        const c = originalCharacter();
        if (!c) return;
        await execute({
          kind: 'membership',
          characterId: c.id,
          expectedRevision: c.membershipRevision,
          expectedRosterRevision: drafts.view.rosterRevision,
          active: !c.active,
          targetSceneId: c.active ? null : drafts.view.focusId,
          expectedFocusRevision: drafts.view.focusRevision,
        });
      })();
    };
    get('live-continue').onclick = () => {
      void (async () => {
        const token = context?.token;
        if (!(await flushLive()) || context?.token !== token || !drafts.view) return;
        if (
          await execute({ kind: 'initialize', expectedRosterRevision: drafts.view.rosterRevision })
        ) {
          if (!(await flushLive())) return;
          resumed = true;
          await openLive();
          tell('Gespeichert.');
        }
      })();
    };
    for (const [id, field] of [
      ['running-title', 'title'],
      ['running-notes', 'notes'],
      ['running-read-aloud', 'readAloud'],
    ] as const) {
      get(id).oninput = () => {
        if (drafts.scene) {
          const text = value(id),
            before = drafts.view?.scene?.[field];
          drafts.editScene({
            [field]:
              before !== undefined && text === before.replace(/\r\n?/g, '\n') ? before : text,
          });
          schedule();
        }
      };
      get(id).onblur = () => {
        if (!writer.composing) void flushLive();
      };
    }
    get('running-location').onchange = () => {
      if (drafts.scene) {
        drafts.editScene({ locationId: value('running-location') || null });
        renderScenePlace();
        schedule();
      }
    };
    get('running-open-location').onclick = () => {
      void (async () => {
        const token = context?.token;
        if ((await flushLive()) && token === context?.token && drafts.scene?.locationId)
          await openLocation(drafts.scene.locationId);
      })();
    };
    get('running-player-follow').onclick = () => {
      void (async () => {
        const token = context?.token,
          focus = playerFocus();
        if ((await flushLive()) && context?.token === token) await cuePlayer('follow', focus);
      })();
    };
    get('running-player-location').onclick = () => {
      void (async () => {
        const token = context?.token,
          focus = playerFocus(),
          locationId = drafts.scene?.locationId;
        if (!focus || !locationId) return;
        if (
          (await flushLive()) &&
          context?.token === token &&
          drafts.scene?.locationId === locationId
        )
          await cuePlayerImage('location', locationId, focus);
      })();
    };
    get('running-player-npc-filter').oninput = renderNpcChoices;
    get('running-player-npc').onchange = () => {
      get<HTMLButtonElement>('running-player-npc-show').disabled = !value('running-player-npc');
    };
    get('running-player-npc-show').onclick = () => {
      const npcId = value('running-player-npc');
      void showLiveNpc(npcId, () => value('running-player-npc') === npcId);
    };
    get('running-player-handout').onclick = () => {
      void (async () => {
        const token = context?.token,
          focus = playerFocus();
        if (!focus) return;
        if ((await flushLive()) && context?.token === token)
          await cuePlayerImage('custom', null, focus);
      })();
    };
    get('running-player-blank').onclick = () => {
      void cuePlayer('blank', null);
    };
    knowledgeUI.init();
    get('live-passive-form').onsubmit = (event) => {
      event.preventDefault();
      renderPassivePerception();
    };
    momentEditor.init();
    get('live-session-start').onclick = () => void startLiveSession();
    get('live-session-end').onclick = () => void loadSessionCloseReview();
    get('adoption-plan').onchange = renderVisits;
    get('adoption-preview').onclick = () =>
      void previewPlannedVisit(value('adoption-plan'), value('adoption-visit')).catch((e) =>
        tell(e.message, true),
      );
    get('adoption-cancel').onclick = () => {
      adoption = null;
      get<HTMLDialogElement>('adoption-dialog').close();
    };
    const confirmAdoption = (openPacket: boolean) =>
      void (async () => {
        const action = adoption;
        if (!action) return;
        if (await execute(action)) {
          adoption = null;
          get<HTMLDialogElement>('adoption-dialog').close();
          get<HTMLDetailsElement>('adoption-picker').open = false;
          if (openPacket) await openLivePacket();
        }
      })().catch((error) => tell((error as Error).message, true));
    get('adoption-confirm').onclick = () => confirmAdoption(false);
    get('adoption-confirm-packet').onclick = () => confirmAdoption(true);
    get('live-apply').onclick = () => {
      void flushLive();
    };
    get('live-reconcile').onclick = () => {
      void (async () => {
        if (!writer.uncertainCommand) return;
        try {
          const result = await writer.resolve();
          if (!result) return;
          if (result.targetChanged) {
            tell(
              result.receipt
                ? 'Speicherung bestätigt, inzwischen liegt ein neuerer Zielstand vor. Entwurf bleibt offen; vor dem Aktualisieren eigenen Text sichern.'
                : 'Konflikt bestätigt. Entwurf bleibt offen; vor dem Aktualisieren eigenen Text sichern.',
              true,
            );
            return;
          }
          partyMove.busy(false);
          get('live-reconcile').hidden = true;
          get('live-refresh').hidden = true;
          tell(
            result.outcome === 'applied'
              ? 'Speicherung bestätigt. Weitere Eingaben bleiben offen.'
              : 'Änderung nicht gespeichert. Eingabe abschließen, um den Entwurf erneut zu übernehmen.',
          );
        } catch (error) {
          tell((error as Error).message + ' Status bleibt ungeklärt.', true);
        }
      })();
    };
    get('live-refresh').onclick = () => {
      void (async () => {
        partyMove.reset();
        writer.discardUncertain();
        drafts.discardInput();
        get('live-reconcile').hidden = true;
        get('live-refresh').hidden = true;
        await openLive();
        tell('Gespeicherter Sitzungsstand geöffnet. Entwurf verworfen.');
      })();
    };
    get('live').addEventListener('compositionstart', () => {
      writer.composition(true);
    });
    get('live').addEventListener('compositionend', () => {
      writer.composition(false);
    });
    for (const id of ['character-dialog', 'adoption-dialog'])
      get<HTMLDialogElement>(id).addEventListener('cancel', (event) => {
        if (writer.writing) event.preventDefault();
      });
  }
  let scenePreparationRequest = 0,
    nextVisit: { planId: string; planRevision: number; visitId: string; title: string } | null =
      null;
  const openTreasure = host.navigation.treasure ?? null;
  const openGroup = host.navigation.group ?? null;
  async function refreshScenePreparation() {
    if (!context || !drafts.view?.scene || !resumed) return;
    const token = context.token,
      id = drafts.view.scene.id,
      request = ++scenePreparationRequest;
    const current = () =>
      context?.token === token &&
      drafts.view?.scene?.id === id &&
      request === scenePreparationRequest;
    try {
      const result = unwrap(await window.campaign.scenePreparation(token, id));
      if (!current()) return;
      preparedNotesSceneId = id;
      preparedNoteIds = new Set(result.noteIds);
      renderLiveKnowledge();
      await renderSceneShops(token, id, get('scene-shops'));
      if (!current()) return;
      nextVisit = result.nextVisit;
      get('live-next-visit').hidden = !nextVisit;
      get('live-next-visit').textContent = nextVisit
        ? 'Nächsten Besuch ansehen: ' + (nextVisit.title || 'Unbenannter Besuch')
        : '';
      const root = get('scene-prepared-groups');
      root.replaceChildren();
      for (const group of result.groups) {
        const card = document.createElement('article');
        card.className = 'session-group-card';
        const title = document.createElement('h4'),
          facts = document.createElement('p'),
          button = document.createElement('button');
        title.textContent = group.title;
        facts.textContent = group.actors
          .map((a) => a.name + ' ' + a.hp + '/' + a.maxHp + ' HP')
          .join(', ');
        button.textContent = 'Begegnung mit diesen Figuren vorbereiten';
        const chosenActors = new Set(
            group.actors.filter((a) => a.hp > 0 && !a.unavailable && !a.defeated).map((a) => a.id),
          ),
          choice = document.createElement('fieldset'),
          legend = document.createElement('legend');
        legend.textContent = 'Figuren für diese Begegnung';
        choice.append(legend);
        for (const actor of group.actors) {
          const label = document.createElement('label'),
            box = document.createElement('input');
          box.type = 'checkbox';
          box.checked = chosenActors.has(actor.id);
          box.disabled = actor.hp <= 0 || actor.unavailable || !!actor.defeated;
          box.onchange = () => {
            if (box.checked) chosenActors.add(actor.id);
            else chosenActors.delete(actor.id);
            button.disabled = !chosenActors.size;
          };
          label.className = 'check-label';
          label.append(
            box,
            document.createTextNode(
              actor.name +
                ' · ' +
                actor.hp +
                '/' +
                actor.maxHp +
                ' HP' +
                (actor.defeated ? ' · besiegt' : ''),
            ),
          );
          choice.append(label);
        }
        button.disabled = !chosenActors.size;
        button.onclick = () => {
          void (async () => {
            if ((await flushLive()) && current())
              await prepareWorldGroup(group, [...chosenActors], current);
          })().catch((error) => tell(error.message, true));
        };
        const reinforce = document.createElement('button');
        reinforce.type = 'button';
        reinforce.textContent = 'In offene Begegnung übernehmen…';
        reinforce.onclick = () =>
          void (async () => {
            if ((await flushLive()) && current())
              await reinforceWorldGroup(group.id, group.revision, current);
          })().catch((error) => tell(error.message, true));
        bindSceneGroupDrag(card, id, group, current);
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = 'Gruppe und Figuren bearbeiten';
        edit.onclick = () => void openGroup?.(group.id);
        card.append(title, facts, choice, button, reinforce, edit);
        root.append(card);
      }
      const treasures = get('scene-prepared-treasures');
      treasures.replaceChildren();
      for (const treasure of result.treasures) {
        const p = document.createElement('p');
        p.textContent = 'Platzierte Beute: ' + treasure.title + ' · ';
        const open = document.createElement('button');
        open.type = 'button';
        open.textContent = 'Schatz öffnen und zuweisen';
        open.onclick = () => void openTreasure?.(treasure.id);
        p.append(open);
        treasures.append(p);
      }
    } catch (error) {
      if (
        context?.token === token &&
        drafts.view?.scene?.id === id &&
        request === scenePreparationRequest
      )
        tell((error as Error).message, true);
    }
  }
  function initGroups() {
    get('scene-focus').onchange = () => {
      void (async () => {
        await changeFocus(value('scene-focus'));
      })();
    };
    get('group-move').onclick = () => {
      void openPartyMove().catch((error) => tell(error.message, true));
    };
    partyMove.init();
    for (const id of ['time-amount', 'time-unit'])
      get(id).addEventListener('input', renderTimePreview);
    get('time-reason').addEventListener('input', renderTimePreview);
    get('time-form').onsubmit = (event) => {
      event.preventDefault();
      void (async () => {
        const p = timeControls.preview,
          token = context?.token;
        if (
          !p ||
          !token ||
          !drafts.view?.scene ||
          p.sceneId !== drafts.view.scene.id ||
          !(await flushLive()) ||
          context?.token !== token
        )
          return;
        timeControls.preview = null;
        if (!(await execute(p.action))) renderTimePreview();
      })();
    };
    timeNavigator = new TimeNavigator(
      tell,
      () =>
        context && drafts.view?.scene && resumed
          ? { workspace: context, scene: drafts.view.scene }
          : null,
      flushLive,
      async (action, stillCurrent) => {
        const token = context?.token;
        if (
          !token ||
          !(await flushLive()) ||
          !stillCurrent() ||
          context?.token !== token ||
          drafts.view?.scene?.id !== action.sceneId
        )
          return false;
        const ack = await execute(action);
        return !!ack;
      },
      recoverTimeWrite,
    );
    resetLiveArchives = initLiveArchives(
      () => context?.token ?? null,
      flushLive,
      () => context?.campaign.id ?? null,
    );
  }

  // Topbar commands share the existing writer, draft flushing and receipt recovery.
  async function runPartyLive(
    token: string,
    action: LiveAction,
    stillCurrent: () => boolean = () => true,
  ) {
    if (!stillCurrent() || context?.token !== token || !(await flushLive()))
      throw new Error(
        'Offene Eingaben zuerst speichern oder den Speicherstatus im Spieltisch klären.',
      );
    if (!drafts.view) await openLive();
    if (!stillCurrent() || context?.token !== token || !drafts.view)
      throw new Error('Party oder Auswahl nicht mehr verfügbar.');
    const ack = await execute(action);
    if (!ack)
      throw new Error(
        'Änderung nicht bestätigt. Speicherstatus im Spieltisch prüfen; Eingabe bleibt erhalten.',
      );
    return ack;
  }
  async function runPartyProgress(
    token: string,
    action: import('./progression').ProgressAction,
    stillCurrent: () => boolean = () => true,
  ) {
    if (!stillCurrent() || context?.token !== token || !(await flushLive()))
      throw new Error('Offene Eingaben zuerst speichern oder den Buchungsstatus klären.');
    if (!drafts.view) await openLive();
    if (!stillCurrent() || context?.token !== token || !drafts.view)
      throw new Error('Party nicht verfügbar oder Auswahl inzwischen geschlossen.');
    progressionContext(context, drafts.view, drafts.selection);
    let receipt: import('./progression').ProgressAck | undefined;
    if (
      !(await executePartyProgress(action, stillCurrent, (result) => {
        receipt = result;
      }))
    )
      throw new Error(
        'Buchung nicht bestätigt. Statusmeldung und Buchungsbeleg prüfen; Eingabe bleibt erhalten.',
      );
    return receipt;
  }

  async function previewPlannedVisit(
    planId: string,
    visitId: string,
    stillCurrent: () => boolean = () => true,
  ) {
    const token = context?.token,
      sceneId = drafts.view?.scene?.id,
      focusRevision = drafts.view?.focusRevision;
    const current = () =>
      stillCurrent() &&
      token === context?.token &&
      drafts.view?.scene?.id === sceneId &&
      drafts.view?.focusRevision === focusRevision;
    if (!(await flushLive()) || !current() || !drafts.view?.scene || !resumed) return false;
    const plan = sources?.plans.find((p) => p.id === planId),
      visit = plan?.scenes.find((v) => v.id === visitId);
    if (!plan || !visit) return false;
    const prepared = unwrap(await window.campaign.session(token!, planId)),
      detail = prepared.visits.find((v) => v.visitId === visitId);
    if (!current()) return false;
    adoption = {
      kind: 'apply-visit',
      planId,
      expectedPlanRevision: plan.revision,
      visitId,
      sceneId: drafts.view.scene.id,
      expectedRevision: drafts.view.scene.revision,
      expectedVisitRevision: detail?.revision ?? 0,
    };
    const root = get('adoption-content');
    root.replaceChildren();
    const title = document.createElement('h3'),
      facts = document.createElement('div'),
      impact = document.createElement('ul'),
      location =
        sources?.locations.find((l) => l.document.id === visit.locationId)?.document.name ??
        (visit.locationId ? 'nicht verfügbar' : 'kein Ort'),
      groups = (prepared.groups ?? []).filter((group) => detail?.groupIds.includes(group.id)),
      reward = detail?.reward;
    title.textContent = visit.title || 'Unbenannter Besuch';
    facts.className = 'adoption-review-facts';
    facts.textContent = 'Plan: ' + (plan.name || 'Unbenannter Spielabend') + ' · Ort: ' + location;
    impact.className = 'adoption-review-list';
    for (const text of [
      'Scene-Titel, GM-Notizen und Ort ersetzen',
      'Vorlesetext: ' + (detail?.readAloud ? 'vorbereitet' : 'leer'),
      (detail?.noteIds.length ?? 0) +
        ' Wissensquelle' +
        ((detail?.noteIds.length ?? 0) === 1 ? '' : 'n') +
        ' gebunden',
      groups.length + ' Begegnungsgruppe' + (groups.length === 1 ? '' : 'n') + ' vorbereitet',
      reward
        ? reward.poolXp +
          ' XP · ' +
          reward.items.length +
          ' Beuteeinträge · ' +
          (reward.awarded
            ? 'bereits vergeben'
            : reward.placedTreasureId
              ? 'als Schatz platziert'
              : 'noch nicht vergeben')
        : 'Keine Besuchsbelohnung vorbereitet',
    ]) {
      const item = document.createElement('li');
      item.textContent = text;
      impact.append(item);
    }
    root.append(title, facts, impact);
    const section = (
      heading: string,
      text: string,
      kind: 'pre' | 'blockquote' = 'pre',
      open = false,
    ) => {
      const details = document.createElement('details'),
        summary = document.createElement('summary'),
        body = document.createElement(kind);
      details.open = open;
      summary.textContent = heading;
      body.textContent = text || 'Kein Text vorbereitet.';
      details.append(summary, body);
      root.append(details);
    };
    section('Private GM-Notizen', visit.notes, 'pre', true);
    section('Zum Vorlesen', detail?.readAloud ?? '', 'blockquote');
    if (groups.length)
      section(
        'Vorbereitete Begegnungen',
        groups
          .map(
            (group) =>
              group.title +
              ' · ' +
              (group.actors.length
                ? group.actors.length + ' Figuren'
                : group.plan.entries.reduce((sum, entry) => sum + entry.count, 0) +
                  ' geplante Figuren'),
          )
          .join('\n'),
      );
    get<HTMLDialogElement>('adoption-dialog').showModal();
    return true;
  }

  function livePacketSource(): LivePacketSource | null {
    const w = context,
      s = drafts.view?.scene,
      p = get<HTMLSelectElement>('live-session-plan').value,
      focus = drafts.view?.focusRevision;
    if (!w || !s || !p || !resumed) return null;
    const token = w.token,
      campaignId = w.campaign.id,
      sceneId = s.id,
      membership = s.membershipRevision,
      adoptionId = s.adoption?.id;
    const current = () =>
      context === w &&
      context?.token === token &&
      context?.campaign.id === campaignId &&
      drafts.view?.scene?.id === sceneId &&
      drafts.view.focusRevision === focus &&
      drafts.view.scene.membershipRevision === membership &&
      drafts.view.scene.adoption?.id === adoptionId &&
      get<HTMLSelectElement>('live-session-plan').value === p;
    return {
      sceneId: s.id,
      token: w.token,
      planId: p,
      visitId: s.adoption?.planId === p ? s.adoption.visitId : null,
      key: JSON.stringify([
        w.token,
        s.id,
        p,
        focus,
        s.membershipRevision,
        s.revision,
        s.adoption?.id,
      ]),
      current,
      flush: flushLive,
      openVisit: async (id) => {
        if (current()) await previewPlannedVisit(p, id);
      },
      readAloud: async (text, title, active = () => true) => {
        const before = drafts.scene?.readAloud;
        if (!current() || !active() || !(await flushLive()) || !current() || !active()) return;
        if (drafts.scene?.readAloud !== before) {
          tell('Neuerer Szenentext bleibt erhalten. Vorlesetext erneut wählen.', true);
          return;
        }
        useKnowledgeReadAloud(text, title);
        await flushLive();
      },
      openReference: async (ref, active = () => true) => {
        const valid = () => current() && active();
        if (!valid() || !(await flushLive()) || !valid()) return;
        if (ref.kind === 'location') await openLocationNotebook(ref.id, valid);
        else await openKnowledgeNote(ref.id, valid);
      },
      prepareEncounter: async (groupId, visitId, groupRevision, active = () => true) => {
        const valid = () => current() && active();
        if (!valid() || !(await flushLive()) || !valid()) return;
        if (
          drafts.view?.scene?.adoption?.planId !== p ||
          drafts.view.scene.adoption.visitId !== visitId
        )
          throw new Error(
            'Übernimm diesen Besuch zuerst, damit Ort und vorbereitete Gruppe zum laufenden Szenenstand gehören.',
          );
        const preparation = unwrap(await window.campaign.scenePreparation(token, sceneId));
        if (!valid()) return;
        const group = preparation.groups.find(
          (row) => row.id === groupId && row.revision === groupRevision,
        );
        if (!group)
          throw new Error(
            'Vorbereitete Gruppe ist an diesem Szenenort nicht verfügbar. Besuch oder Ortsstand prüfen.',
          );
        await prepareWorldGroup(group, undefined, valid);
      },
      openReward: async (visitId, active = () => true) => {
        const valid = () => current() && active();
        if (valid()) await openPreparedReward(p, visitId, valid);
      },
      captureMoment: async (category, title, summary, active = () => true) => {
        if (!current() || !active()) return;
        const draft = currentLiveMomentDraft(),
          text = [draft.summary, summary].filter(Boolean).join('\n\n');
        if (text.length > 10000)
          throw new Error(
            'Mappenabschnitt passt nicht in die 10.000 Zeichen des Chronikmoments. Die bisherige Eingabe bleibt unverändert. Kürze sie oder übernimm einen Ausschnitt von Hand.',
          );
        const hasDraft = !!(
          draft.title ||
          draft.summary ||
          draft.category !== 'world' ||
          draft.followUp
        );
        writeLiveMomentDraft({
          ...draft,
          category: hasDraft ? draft.category : category,
          title: draft.title || title,
          summary: text,
        });
        captureMomentDraft();
        momentEditor.saveCurrent();
        get('live-party-panel').hidden = false;
        showLivePacketParty();
        get('live-moment-result').textContent =
          'Mappenabschnitt vorgemerkt. Ergänze den tatsächlichen Ausgang und speichere ihn dann als Chronikmoment.';
        get<HTMLDetailsElement>('live-moment-panel').open = true;
        get('live-moment-panel').scrollIntoView({ block: 'start' });
        get<HTMLInputElement>('live-moment-title').focus({ preventScroll: true });
      },
    };
  }
  function syncLivePacketContext() {
    syncLiveSessionPacket(livePacketSource());
  }
  async function openLivePacket() {
    const source = livePacketSource();
    if (!source) {
      tell('Wähle einen Spielabendplan für die laufende Gruppe.', true);
      return;
    }
    await openLiveSessionPacket(source);
  }

  async function openTimeNavigator(
    target?: {
      eventId: string;
      expectedRevision: number;
      phase: 'start' | 'end';
      sceneId: string;
      title?: string;
    },
    expectedSceneId?: string,
  ) {
    if (!(await ensureLiveRuntime())) return;
    if (expectedSceneId && drafts.view?.scene?.id !== expectedSceneId)
      throw new Error('Reisegruppe gewechselt. Reise neu öffnen.');
    await timeNavigator.open(target);
  }
  async function openTravelRest(sceneId: string) {
    if (!(await ensureLiveRuntime()) || !(await flushLive())) return;
    if (drafts.view?.scene?.id !== sceneId)
      throw new Error('Reisegruppe gewechselt. Reise neu öffnen.');
    await openPartyRest(sceneId);
  }

  async function recoverTimeWrite() {
    const command = writer.uncertainCommand,
      token = context?.token;
    if (!command) return !writer.blocked;
    if (
      !token ||
      command.action.kind !== 'advance-clock' ||
      command.action.calendarVersion !== 'campaign-calendar-v1'
    ) {
      tell('Anderen offenen Live-Auftrag zuerst im Leitbereich klären.', true);
      return false;
    }
    try {
      const result = await writer.resolve();
      if (!result || result.targetChanged) return false;
      timeControls.preview = null;
      get('live-reconcile').hidden = true;
      get('live-refresh').hidden = true;
      await openLive();
      tell(
        result.receipt
          ? 'Zeitauftrag als gespeichert bestätigt. Neue Vorschau prüfen.'
          : 'Zeitauftrag nicht gespeichert. Zeitwahl bleibt im Dialog; neue Vorschau prüfen.',
      );
      return true;
    } catch (e) {
      tell((e as Error).message + ' Zeitstatus bleibt ungeklärt.', true);
      return false;
    }
  }

  async function readSessionChronicle(token: string): Promise<Result<ChronicleView>> {
    try {
      return await window.campaign.chronicle(token);
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }

  async function markLiveSession(
    marker: 'start' | 'end',
    submittedSummary?: string,
    submittedHandoff?: string,
    stillCurrent: () => boolean = () => true,
  ): Promise<boolean> {
    const owner = context,
      token = owner?.token,
      sceneId = drafts.view?.scene?.id,
      focusRevision = drafts.view?.focusRevision,
      summary = marker === 'end' ? (submittedSummary ?? recapFields(false).summary) : '',
      handoff = marker === 'end' ? (submittedHandoff ?? recapFields(false).handoff) : '';
    const current = () =>
      stillCurrent() &&
      context?.token === token &&
      drafts.view?.scene?.id === sceneId &&
      drafts.view?.focusRevision === focusRevision;
    if (
      !owner ||
      !token ||
      !sceneId ||
      sessionChronicleError ||
      !sessionChronicle ||
      (marker === 'end' && recapReadError())
    )
      return false;
    try {
      if (!(await flushLive()) || !current()) return false;
      const publish = () =>
        execute({
          kind: 'session-marker',
          sceneId,
          expectedRevision: drafts.view!.scene!.revision,
          marker,
          summary,
          handoff,
        });
      const ack = marker === 'end' ? await recapEditor.publish(owner, publish) : await publish();
      if (!ack || !current()) return false;
      get('live-session-result').textContent =
        marker === 'start'
          ? 'Spielabend begonnen.'
          : 'Spielabend beendet. Rückblick und Übergabe gespeichert.';
      return true;
    } catch (error) {
      if (current()) {
        tell((error as Error).message, true);
        await refreshLiveSession();
      }
    }
    return false;
  }

  async function openPartyMove(
    ownerToken?: string,
    ownerSceneId?: string,
    stillCurrent: () => boolean = () => true,
  ) {
    const token = ownerToken ?? context?.token;
    if (ownerToken && context?.token !== ownerToken) throw new Error('Kampagne gewechselt.');
    const expectedScene = ownerSceneId ?? drafts.view?.scene?.id;
    const current = editorSession.capture(
      () => [context?.token, drafts.view?.scene?.id],
      stillCurrent,
    );
    if (!current() || !(await flushLive()) || !current() || context?.token !== token)
      throw new Error('Offene Eingaben oder Kampagnenwechsel. Spieltisch prüfen.');
    await openLive();
    if (
      !current() ||
      context?.token !== token ||
      !drafts.view?.scene ||
      drafts.view.focusRevision === null ||
      expectedScene !== drafts.view.scene.id
    )
      throw new Error('Szenenfokus geändert oder keine laufende Sitzung. Auswahl erneut öffnen.');
    const source = drafts.view.scene,
      labels = partySceneLabels(drafts.view),
      tokenAtOpen = context!.token,
      focusAtOpen = drafts.view.focusRevision,
      sourceRosterRevision = drafts.view.rosterRevision,
      sourceContentRevision = source.revision,
      sourceMembershipRevision = source.membershipRevision,
      sourceClockRevision = source.clock.revision;
    return partyMove.open(
      {
        token: tokenAtOpen,
        rosterRevision: drafts.view.rosterRevision,
        focusRevision: focusAtOpen,
        source: {
          id: source.id,
          label:
            labels.get(source.id) ??
            groupLabel({ ...source, primary: source.id === drafts.view.primaryId }),
          contentRevision: source.revision,
          membershipRevision: source.membershipRevision,
          clockRevision: source.clock.revision,
          instantMs: source.clock.instantMs,
          members: source.members.map((id) => ({
            id,
            name: drafts.view!.roster.find((c) => c.id === id)!.profile.name,
          })),
        },
        targets: drafts.view.scenes.map((scene) => ({
          id: scene.id,
          label: labels.get(scene.id) ?? groupLabel(scene),
          membershipRevision: scene.membershipRevision,
          clockRevision: scene.clock.revision,
          instantMs: scene.clock.instantMs,
        })),
      },
      editorSession.capture(() => [context?.token]),
      () =>
        context?.token === tokenAtOpen &&
        drafts.view?.scene?.id === source.id &&
        drafts.view.focusRevision === focusAtOpen &&
        drafts.view.scene.revision === sourceContentRevision &&
        drafts.view.scene.membershipRevision === sourceMembershipRevision &&
        drafts.view.scene.clock.revision === sourceClockRevision &&
        drafts.view.rosterRevision === sourceRosterRevision,
    );
  }

  editorSession.observeDraft(() => ({
    openInput: changed(),
    retainedDraft: momentEditor.hasSavedDraft() || recapEditor.hasSavedDraft(),
    unresolvedCommand: !!writer.uncertainCommand,
  }));

  return {
    editorSession,
    activateLive,
    openLive,
    openPlannedVisitReview,
    openLiveSoundboard,
    prepareLiveEncounter,
    addLiveNpc,
    addLiveCreature,
    flushLive,
    openLiveCharacterLoot,
    useLiveReferenceReadAloud,
    initLive,
    refreshScenePreparation,
    runPartyLive,
    runPartyProgress,
    openTimeNavigator,
    openTravelRest,
    openPartyMove,
    deactivate: () => editorSession.deactivate(),
  };
}
export type LiveEditor = ReturnType<typeof createLive>;

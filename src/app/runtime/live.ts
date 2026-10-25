import { EditorSession, type EditorOperation } from '../shared/editor-session';
import { acknowledgeFields } from '../shared/editor-transition';
import { preserveLiteralEdit } from '../shared/literal-text-edit';
import { partySceneLabels } from './party-overview';
import { bindSceneGroupDrag } from './combat-group-ui';
import { NpcCastBinder } from '../campaign/npc-cast-ui';
import { openPartyRest } from './party-topbar-ui';
import { TimeNavigator } from './time-plan-ui';
import type { TimePreview } from './time-plan-contracts';
import type { FantasyCalendar } from './world-contracts';
import { calendarDate } from './world-model';
import { SceneVisitBinder } from './scene-visit-ui';
import { openTreasureDistribution } from './treasury-ui';
import { LiveEncounterGenerator } from './live-generation-ui';
import {
  closeSessionPacket,
  openLiveSessionPacket,
  syncLiveSessionPacket,
  type LivePacketSource,
} from '../campaign/session-packet-ui';
import {
  initSessionNavigator,
  sessionNavigatorContext,
  sessionNavigatorPreparation,
  sessionNavigatorBusy,
} from './session-progress-ui';
import { initSceneDesk, sceneDeskContext, flushSceneDesk } from './scene-desk-ui';
import { refreshMusic } from './music-ui';
import { renderLiveWorld } from './world-ui';
import { renderSceneShops } from '../catalog/items-ui';
import type { WorkspaceGeometry, Result } from '../shared/contracts';
import {
  checkedCharacterProfile,
  formatInstant,
  type Character,
  type CharacterProfile,
  type LiveScene,
  type LiveView,
  type LiveAction,
  type LiveCommand,
  type LiveAck,
} from './live-contracts';
import type { Preparation } from '../campaign/preparation-contracts';
import {
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
} from './combat';
import { initChase, chaseContext, flushChase, openExistingChase } from './chase-ui';
import { initLiveArchives } from './live-archive-ui';
import type { EncounterPlan } from '../catalog/encounter-contracts';
import {
  initProgress,
  progressionContext,
  flushProgress,
  executePartyProgress,
  onProgressChanged,
  progressCharacters,
  hasHealthDraft,
} from './progression-ui';
import {
  initRuleReferences,
  activateRuleReferences,
  refreshRuleReferences,
} from '../catalog/rule-reference-ui';
import { cuePlayer, cuePlayerImage } from './player-ui';
import { renderLiveNpcChoices } from './live-player-cues';
import { findLiveKnowledge } from './live-knowledge';
import {
  partyHealthFacts,
  partyProgressFacts,
  passivePerceptionResult,
} from './live-party-reference';
import {
  liveMomentSavedMessage,
  canClearSavedLiveMoment,
  emptyLiveMomentDraft,
  liveMomentDraftValue,
  sameLiveMomentDraft,
  type LiveMomentCategory,
  type LiveMomentDraft,
} from './live-moment-drafts';
import type { NarrativeView } from './narrative-contracts';
import type { ChronicleView } from './chronicle-contracts';
import {
  handoffVisitSeed,
  liveActionUpdatesRecap,
  liveSessionRecap,
  latestCompletedSessionHandoff,
  sessionCloseHandoffSuggestion,
} from './live-session-recap';
import { openNarrativeJournal } from './narrative-journal-ui';
import type { NarrativeJournal } from './narrative-journal-contracts';
import type { ScenePreparation } from '../campaign/session-contracts';
import type { AgendaPage } from './agenda-contracts';
import { agendaCountdown } from './agenda-model';
import type { SceneWorld } from './world-contracts';
import type { SessionPacket, SessionPacketVisit } from '../campaign/session-packet-contracts';
import { restFrame } from './progression';
export const editorSession = new EditorSession();
const failedState = editorSession.command<{
  command: LiveCommand;
  submittedProfile?: CharacterProfile;
}>();
const requestWork = editorSession.operation<Promise<LiveAck | null>>();
const flushingWork = editorSession.operation<Promise<boolean>>();

const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const value = (id: string) => get<HTMLInputElement>(id).value;
const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
let context: WorkspaceGeometry | null = null,
  data: LiveView | null = null,
  sources: Preparation | null = null,
  liveReadRequest = 0,
  liveSourcesRequest = 0;
let liveSourcesLoading = false,
  liveSourcesProblem = '';
let sessionChronicle: ChronicleView | null = null,
  sessionChronicleError = '',
  sessionChronicleRequest = 0;
type RecapText = import('./live-contracts').SessionRecapDraft;
type RecapWork = {
  text: RecapText;
  basis: RecapText | null;
  dirty: boolean;
  error: string;
  readError?: string;
  publishing?: boolean;
  saving: EditorOperation<Promise<boolean>>;
};
const recapDrafts = new Map<string, RecapWork>();
function recapFields(
  review = (document.getElementById('live-session-close-dialog') as HTMLDialogElement | null)?.open,
): RecapText {
  const before = context && recapDrafts.get(context.campaign.id)?.text;
  return {
    summary: preserveLiteralEdit(
      before?.summary ?? '',
      value(review ? 'live-session-close-summary' : 'live-session-summary'),
    ),
    handoff: preserveLiteralEdit(
      before?.handoff ?? '',
      value(review ? 'live-session-close-handoff' : 'live-session-handoff'),
    ),
  };
}
function recapReadError() {
  return context && recapDrafts.get(context.campaign.id)?.readError;
}
function showRecapSave() {
  const state = context && recapDrafts.get(context.campaign.id),
    text =
      state?.readError ||
      state?.error ||
      (state?.dirty
        ? 'Rückblickentwurf wird gesichert…'
        : state && (state.text.summary || state.text.handoff)
          ? 'Rückblickentwurf gespeichert.'
          : '');
  for (const id of ['live-session-draft-status', 'live-session-close-draft-status']) {
    const label = document.getElementById(id);
    if (label) label.textContent = text;
  }
  for (const id of ['live-session-draft-retry', 'live-session-close-draft-retry']) {
    const button = document.getElementById(id);
    if (button) {
      button.hidden = !(state?.error || state?.readError);
      button.textContent = state?.readError
        ? 'Rückblick erneut laden'
        : 'Eigene Fassung erneut sichern…';
    }
  }
  for (const id of [
    'live-session-summary',
    'live-session-handoff',
    'live-session-close-summary',
    'live-session-close-handoff',
  ]) {
    const field = document.getElementById(id) as HTMLTextAreaElement | null;
    if (field) field.readOnly = !state || !!state.readError;
  }
  if (state?.readError)
    for (const id of [
      'live-session-close-confirm',
      'live-session-close-prepare',
      'live-session-close-use-suggestion',
    ]) {
      const button = document.getElementById(id) as HTMLButtonElement | null;
      if (button) button.disabled = true;
    }
}
async function retryRecapSave() {
  const w = context,
    state = w && recapDrafts.get(w.campaign.id);
  if (!w || !state) return;
  try {
    if (state.saving.value) await state.saving.value;
    if (context !== w) return;
    const text = { ...state.text },
      basis = state.basis,
      readError = state.readError;
    const view = unwrap(await window.campaign.live(w.token));
    if (
      context !== w ||
      state.saving.value ||
      !equal(text, state.text) ||
      !equal(basis, state.basis) ||
      readError !== state.readError
    )
      return;
    if (view.recapDraftError) throw new Error(view.recapDraftError);
    const saved = view.recapDraft ?? null;
    if (state.readError && !state.dirty) {
      state.text = saved ?? { summary: '', handoff: '' };
      state.basis = saved;
      state.readError = '';
      state.error = '';
      for (const id of [
        'live-session-summary',
        'live-session-handoff',
        'live-session-close-summary',
        'live-session-close-handoff',
      ]) {
        const field = document.getElementById(id) as HTMLTextAreaElement | null;
        if (field) field.value = id.endsWith('handoff') ? state.text.handoff : state.text.summary;
      }
      showRecapSave();
      renderLiveSession();
      return;
    }
    state.readError = '';
    showRecapSave();
    renderLiveSession();
    if (
      !equal(saved, state.basis) &&
      !equal(saved, state.text) &&
      !window.confirm(
        'Es liegt ein anderer gespeicherter Rückblick vor.\n\nRückblick:\n' +
          (saved?.summary ?? '') +
          '\n\nNächster Spielabend:\n' +
          (saved?.handoff ?? '') +
          '\n\nDurch deine weiterhin sichtbare Fassung ersetzen?',
      )
    )
      return;
    state.basis = saved;
    state.dirty = true;
    state.error = '';
    showRecapSave();
    await saveRecap(w, state);
  } catch (error) {
    if (context === w) {
      state.error = 'Rückblickentwurf nicht gesichert: ' + (error as Error).message;
      showRecapSave();
    }
  }
}
function queueRecapSave(text?: RecapText) {
  if (!context) return;
  const w = context,
    state = recapDrafts.get(w.campaign.id);
  if (!state || state.readError) return;
  state.text = text ?? recapFields();
  state.dirty = true;
  showRecapSave();
  void saveRecap(w, state);
}
async function saveRecap(w: WorkspaceGeometry, state: RecapWork): Promise<boolean> {
  // The ending owns the draft until its receipt supplies the next CAS basis.
  if (state.publishing) return false;
  if (state.saving.value) return state.saving.value;
  if (!state.dirty) return true;
  if (state.readError) return false;
  const current = editorSession.capture(() => [context?.token, recapDrafts.get(w.campaign.id)]);
  const task = (async () => {
    while (state.dirty) {
      const text = { ...state.text };
      try {
        unwrap(await window.campaign.keepSessionRecapDraft(w.token, text, state.basis));
      } catch (error) {
        try {
          const view = unwrap(await window.campaign.live(w.token)),
            saved = view.recapDraft;
          if (view.recapDraftError || !saved || !equal(saved, text)) throw error;
        } catch {
          state.error = 'Rückblickentwurf nicht gesichert: ' + (error as Error).message;
          if (current()) showRecapSave();
          return false;
        }
      }
      const accepted = acknowledgeFields(text, text, state.text, ['summary', 'handoff']);
      state.basis = accepted.basis;
      state.text = accepted.value;
      state.dirty = accepted.dirty;
      state.error = '';
      if (current()) showRecapSave();
    }
    return true;
  })();
  state.saving.value = task;
  try {
    return await task;
  } finally {
    if (state.saving.value === task) state.saving.clear(task);
  }
}
let readAloudOwner: string | null = null;
let selected: string | null = null,
  characterDraft: Character | null = null,
  sceneDraft: LiveScene | null = null;
let resumed = false,
  composing = false,
  blocked = false,
  timer: ReturnType<typeof setTimeout> | null = null;

let requestIsTextSave = false;
type MomentWork = {
  w: WorkspaceGeometry;
  sceneId: string;
  text: LiveMomentDraft;
  basis: LiveMomentDraft | null;
  dirty: boolean;
  error: string;
  readError: string;
  publishing?: boolean;
  saving: EditorOperation<Promise<boolean>>;
};
const momentWorks = new Map<string, MomentWork>();
let momentOwner: MomentWork | null = null;
let narrativeGeneration = 0,
  narrativeCache = new Map<string, NarrativeView>(),
  narrativeProblems = new Map<string, string>(),
  narrativeLoading = new Set<string>();
const intentBlocked = () => !!requestWork.value && !requestIsTextSave;
let adoption: Extract<LiveAction, { kind: 'apply-visit' }> | null = null;
let moveBasis: Omit<Extract<LiveAction, { kind: 'move' }>, 'memberIds' | 'target'> | null = null;
let moveTargets: LiveView['scenes'] = [],
  preparedNotesSceneId: string | null = null,
  preparedNoteIds = new Set<string>();
let resetLiveArchives = () => {};
let liveGenerator: LiveEncounterGenerator;
let npcPlacesNavigation: ((id: string, stillCurrent: () => boolean) => Promise<void>) | null = null;
let npcCastBinder: NpcCastBinder;
let npcNavigation:
    | ((
        id: string,
        contact: { date: string; sceneTitle: string } | undefined,
        stillCurrent: () => boolean,
      ) => Promise<void>)
    | null = null,
  npcAutonomyNavigation: ((id: string, stillCurrent: () => boolean) => Promise<void>) | null = null;
let visitBinder: SceneVisitBinder;
let timeNavigator: TimeNavigator;
let manualTimePreview: TimePreview | null = null,
  timePreviewRequest = 0;
let clockCalendar: FantasyCalendar | null = null;
function formatSceneInstant(ms: string) {
  return formatInstant(ms, clockCalendar?.daySeconds ?? 86400);
}

type SessionCloseMask = {
  kind: 'combat' | 'chase';
  id: string;
  sceneId: string;
  sceneTitle: string;
  title: string;
  state: string;
};
type SessionCloseAudit = {
  masks: SessionCloseMask[];
  treasures: { count: number; units: number; more: boolean };
  xpBooked: boolean;
  events: number;
};
type SessionResumeVisit = {
  sceneId: string;
  sceneTitle: string;
  nextVisit: NonNullable<ScenePreparation['nextVisit']>;
  packet: SessionPacketVisit | null;
  packetBasis: string | null;
  warnings: string[];
  fallback: boolean;
  planName: string;
};
type SessionResumePrep = {
  visits: SessionResumeVisit[];
  narratives: NarrativeJournal;
  worlds: { sceneId: string; sceneTitle: string; frame: SceneWorld; agenda: AgendaPage }[];
  problems: string[];
  narrativesAvailable: boolean;
  readiness: {
    sceneId: string;
    sceneTitle: string;
    characters: {
      characterId: string;
      name: string;
      health: string;
      progress: string;
      warning: boolean;
    }[];
  }[];
  readinessAvailable: boolean;
};
let sessionCloseRequest = 0,
  sessionResumeRequest = 0,
  sessionResumeButton: HTMLButtonElement;
type HandoffVisitDraft = {
  sceneTitle: string;
  recommendedPlanId: string | null;
  beforeVisitId: string | null;
  locationId: string | null;
  locationTitle: string;
  handoff: string;
  noteIds: string[];
  current: () => boolean;
  pending?: boolean;
  notes?: string;
};
let handoffVisitDraft: HandoffVisitDraft | null = null;
type SessionCloseOpeningBasis = Omit<HandoffVisitDraft, 'handoff' | 'pending'> & {
  generation: number;
};
let sessionCloseOpeningBasis: SessionCloseOpeningBasis | null = null;
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
const originalCharacter = () => data?.roster.find((c) => c.id === selected);
const content = (scene: LiveScene) => ({
  title: scene.title,
  notes: scene.notes,
  readAloud: scene.readAloud ?? '',
  locationId: scene.locationId,
});
const characterEdited = () =>
  !!characterDraft &&
  (!originalCharacter() || !equal(characterDraft.profile, originalCharacter()!.profile));
const sceneEdited = () =>
  !!sceneDraft && (!data?.scene || !equal(content(sceneDraft), content(data.scene)));
const changed = () => characterEdited() || sceneEdited();
const playerFocus = () =>
  data
    ? {
        focusId: data.focusId,
        focusRevision: data.focusRevision,
        focusMembershipRevision: data.scene?.membershipRevision ?? null,
        focusLocationId:
          sceneDraft?.id === data.scene?.id
            ? (sceneDraft?.locationId ?? null)
            : (data.scene?.locationId ?? null),
      }
    : null;
export function activateLive(workspace: WorkspaceGeometry) {
  editorSession.generation++;
  liveReadRequest++;
  liveSourcesRequest++;
  liveSourcesLoading = false;
  liveSourcesProblem = '';
  if (context) {
    const retained = recapDrafts.get(context.campaign.id),
      text = recapFields();
    if (retained && !equal(retained.text, text)) {
      retained.text = text;
      retained.dirty = true;
    }
  }
  const draft = workspace ? recapDrafts.get(workspace.campaign.id) : undefined;
  get<HTMLTextAreaElement>('live-session-summary').value = draft?.text.summary ?? '';
  get<HTMLTextAreaElement>('live-session-handoff').value = draft?.text.handoff ?? '';
  for (const id of ['live-session-summary', 'live-session-handoff'])
    get<HTMLTextAreaElement>(id).readOnly = !draft || !!draft.readError;
  sessionResumeRequest++;
  const resumeDialog = document.getElementById(
    'live-session-resume-dialog',
  ) as HTMLDialogElement | null;
  if (resumeDialog?.open) resumeDialog.close();
  sessionCloseRequest++;
  const closeDialog = document.getElementById(
    'live-session-close-dialog',
  ) as HTMLDialogElement | null;
  if (closeDialog?.open) closeDialog.close();
  sessionCloseOpeningBasis = null;
  handoffVisitDraft = null;
  const handoffDialog = document.getElementById('handoff-visit-dialog') as HTMLDialogElement | null;
  if (handoffDialog?.open) handoffDialog.close();
  visitBinder?.reset();
  timeNavigator?.reset();
  manualTimePreview = null;
  clockCalendar = null;
  timePreviewRequest++;
  liveGenerator?.reset();
  closeSessionPacket();
  syncLiveSessionPacket(null);
  resetLiveArchives();
  sessionNavigatorContext(null, null, null, false);
  sceneDeskContext(null, null);
  combatContext(null, null);
  chaseContext(null, null, []);
  progressionContext(null, null, null);
  timeDrafts.clear();
  timeDraftOwner = null;
  context = workspace;
  data = null;
  sources = null;
  sessionChronicle = null;
  sessionChronicleError = '';
  sessionChronicleRequest++;
  selected = null;
  characterDraft = null;
  sceneDraft = null;
  resumed = false;
  blocked = false;
  failedState.value = null;
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
  moveBasis = null;
  preparedNotesSceneId = null;
  preparedNoteIds.clear();
  narrativeGeneration++;
  narrativeCache.clear();
  narrativeProblems.clear();
  narrativeLoading.clear();
  momentWorks.clear();
  momentOwner = null;
  writeLiveMomentDraft(emptyLiveMomentDraft());
  get('live-moment-result').textContent = '';
  get('live-session-result').textContent = '';
  for (const id of ['adoption-dialog', 'move-dialog', 'archive-dialog', 'character-dialog'])
    if (get<HTMLDialogElement>(id).open) get<HTMLDialogElement>(id).close();
}
export async function openLive(planId?: string, visitId?: string) {
  if (!context) {
    tell('Bitte zuerst eine Kampagne öffnen.', true);
    return false;
  }
  const owner = context,
    token = owner.token,
    n = ++liveReadRequest,
    current = () => context === owner && n === liveReadRequest;
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
    let recap = recapDrafts.get(context.campaign.id);
    if (!recap) {
      recap = {
        saving: editorSession.operation<Promise<boolean>>(),
        text: live.recapDraft ?? { summary: '', handoff: '' },
        basis: live.recapDraft ?? null,
        dirty: false,
        error: '',
      };
      recapDrafts.set(context.campaign.id, recap);
      get<HTMLTextAreaElement>('live-session-summary').value = recap.text.summary;
      get<HTMLTextAreaElement>('live-session-handoff').value = recap.text.handoff;
    }
    if (recap.readError && !live.recapDraftError && !recap.dirty) {
      recap.text = live.recapDraft ?? { summary: '', handoff: '' };
      recap.basis = live.recapDraft ?? null;
      get<HTMLTextAreaElement>('live-session-summary').value = recap.text.summary;
      get<HTMLTextAreaElement>('live-session-handoff').value = recap.text.handoff;
    }
    recap.readError = live.recapDraftError;
    showRecapSave();
    const dirtyScene = sceneEdited(),
      dirtyCharacter = characterEdited();
    data = live;
    sources = null;
    liveSourcesLoading = true;
    liveSourcesProblem = 'Vorbereitung wird geladen…';
    narrativeGeneration++;
    narrativeCache.clear();
    narrativeProblems.clear();
    narrativeLoading.clear();
    selected = live.roster.some((c) => c.id === selected) ? selected : (live.roster[0]?.id ?? null);
    characterDraft =
      dirtyCharacter && characterDraft?.id === selected && characterEdited()
        ? {
            ...originalCharacter()!,
            profile: characterDraft!.profile,
            profileRevision: characterDraft!.profileRevision,
          }
        : originalCharacter()
          ? structuredClone(originalCharacter()!)
          : null;
    // Reopen an existing table without initializing a group or starting a new evening.
    resumed = !!live.scene;
    // A confirmed refresh must not replace an edited draft of the same owner.
    sceneDraft =
      dirtyScene && sceneDraft?.id === live.scene?.id && sceneEdited()
        ? { ...live.scene!, ...content(sceneDraft!), revision: sceneDraft!.revision }
        : live.scene
          ? structuredClone(live.scene)
          : null;
    render();
    if (changed() && !timer && !composing && !blocked)
      timer = setTimeout(() => {
        void flushLive();
      }, 700);
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
    const keepScene = sceneEdited(),
      keepCharacter = characterEdited();
    data = null;
    if (!keepScene) sceneDraft = null;
    if (!keepCharacter) characterDraft = null;
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
  const result = await read;
  if (context !== owner || run !== liveSourcesRequest || !data) return false;
  sources = result.ok ? result.value : null;
  liveSourcesLoading = false;
  liveSourcesProblem = result.ok ? '' : 'Vorbereitung nicht verfügbar: ' + result.error;
  renderLiveSources();
  return result.ok;
}
async function reloadLiveSources() {
  if (!context || !data) return false;
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
export async function openPlannedVisitReview(
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
    sceneId = data?.scene?.id ?? null;
  const current = () =>
    context?.token === token && (sceneId === null || data?.scene?.id === sceneId);
  if (!(await flushLive()) || !current()) return false;
  if (!data) {
    await openLive();
    if (!current()) return false;
  }
  if (!data) return false;
  if (!data.scene) {
    if (
      !(await execute({ kind: 'initialize', expectedRosterRevision: data.rosterRevision })) ||
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
    sceneDraft = data.scene ? structuredClone(data.scene) : null;
    renderScene();
  }
  return !!data.scene;
}
export async function openLiveSoundboard() {
  if (!data?.scene) {
    get('live-continue').scrollIntoView({ block: 'center' });
    get<HTMLButtonElement>('live-continue').focus();
    tell('Öffne zuerst eine Gruppe am Spieltisch.');
    return;
  }
  if (!(await ensureLiveRuntime())) return;
  get<HTMLDetailsElement>('live-soundboard').open = true;
  get('live-soundboard').scrollIntoView({ block: 'start' });
}
export async function prepareLiveEncounter(plan: EncounterPlan) {
  const token = context?.token;
  if ((await ensureLiveRuntime()) && context?.token === token) await prepareCombatPlan(plan);
}
export async function addLiveNpc(id: string, stillCurrent: () => boolean = () => true) {
  if (stillCurrent() && (await ensureLiveRuntime()) && stillCurrent())
    await addWorldNpc(id, stillCurrent);
}
export async function addLiveCreature(id: string, count: number, grouped: boolean) {
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
    'move-confirm',
    'move-cancel',
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
    get<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(id).disabled = on && !textSave;
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
  if (structural) {
    for (const id of ['move-title', 'move-target']) get<HTMLInputElement>(id).disabled = on;
    for (const box of get('move-members').querySelectorAll<HTMLInputElement>('input'))
      box.disabled = on;
  }
  for (const button of get('roster-list').querySelectorAll('button'))
    (button as HTMLButtonElement).disabled = on;
}
function mergeAck(ack: LiveAck, action: LiveAction, submittedProfile?: CharacterProfile) {
  if (!data) return;
  liveReadRequest++;
  if (
    action.kind === 'session-marker' &&
    action.marker === 'end' &&
    ack.recapDraft !== undefined &&
    context
  ) {
    const state = recapDrafts.get(context.campaign.id);
    if (state) {
      const accepted = acknowledgeFields(
        ack.recapDraft ?? { summary: '', handoff: '' },
        { summary: action.summary, handoff: action.handoff ?? '' },
        recapFields(),
        ['summary', 'handoff'],
      );
      state.basis = ack.recapDraft;
      state.text = accepted.value;
      state.dirty = accepted.dirty;
      state.error = '';
      for (const id of [
        'live-session-summary',
        'live-session-handoff',
        'live-session-close-summary',
        'live-session-close-handoff',
      ])
        get<HTMLTextAreaElement>(id).value = id.endsWith('handoff')
          ? state.text.handoff
          : state.text.summary;
      showRecapSave();
      if (!state.publishing && state.dirty) void saveRecap(context, state);
    }
  }
  const priorScene = data.scene,
    priorCharacter = originalCharacter();
  data.rosterRevision = ack.rosterRevision;
  if (ack.archivedRosterCount !== undefined) data.archivedRosterCount = ack.archivedRosterCount;
  if (ack.character) {
    const current = ack.character;
    data.roster = data.roster.some((c) => c.id === current.id)
      ? data.roster.map((c) => (c.id === current.id ? current : c))
      : [...data.roster, current];
    if (current.archived) {
      data.roster = data.roster.filter((c) => c.id !== current.id);
      if (selected === current.id) {
        selected = data.roster[0]?.id ?? null;
        characterDraft = originalCharacter() ? structuredClone(originalCharacter()!) : null;
      }
    }
    if (characterDraft?.id === current.id) {
      const dirty = priorCharacter && !equal(characterDraft.profile, priorCharacter.profile);
      const keepProfile =
        action.kind === 'profile'
          ? !submittedProfile || characterDraft.profile !== submittedProfile
          : dirty;
      characterDraft = keepProfile
        ? {
            ...current,
            profile: characterDraft.profile,
            profileRevision:
              action.kind === 'profile' ? current.profileRevision : characterDraft.profileRevision,
          }
        : structuredClone(current);
    }
  }
  if (ack.session) {
    const session = ack.session;
    data.primaryId = session.primaryId;
    data.focusId = session.focusId;
    data.focusRevision = session.focusRevision;
    data.archiveCount = session.archiveCount;
    data.roster = data.roster.map((c) => ({ ...c, ...session.members.find((m) => m.id === c.id) }));
    if (characterDraft) {
      const m = session.members.find((m) => m.id === characterDraft!.id);
      if (m) characterDraft = { ...characterDraft, ...m };
    }
    data.scenes = data.scenes
      .filter((s) => !session.retired.some((r) => r.id === s.id))
      .map((s) => ({
        ...s,
        ...session.groups.find((g) => g.id === s.id),
        primary: s.id === session.primaryId,
      }));
    if (session.createdScene && !data.scenes.some((s) => s.id === session.createdScene!.id))
      data.scenes.push(session.createdScene);
  }
  if (ack.scene) {
    data.scene = ack.scene;
    if (action.kind === 'scene-content' && sceneDraft?.id === ack.scene.id)
      sceneDraft = { ...ack.scene, ...content(sceneDraft) };
    else if (
      sceneDraft?.id === ack.scene.id &&
      priorScene &&
      !equal(content(sceneDraft), content(priorScene))
    )
      sceneDraft = {
        ...ack.scene,
        ...content(sceneDraft),
        revision: sceneDraft.revision,
      };
    else sceneDraft = structuredClone(ack.scene);
    data.scenes = data.scenes.map((s) =>
      s.id === ack.scene!.id
        ? {
            ...s,
            title: ack.scene!.title,
            members: ack.scene!.members.length,
            membershipRevision: ack.scene!.membershipRevision,
            clock: ack.scene!.clock,
          }
        : s,
    );
  }
  // Publish each confirmed LiveAck through the same composition as an opened scene.
  renderList();
  renderCharacter();
  renderScene();
  document.dispatchEvent(new Event('campaign-party-changed'));
}
async function execute(action: LiveAction): Promise<LiveAck | null> {
  if (!context || blocked || requestWork.value) return null;
  liveReadRequest++;
  const submittedProfile = characterDraft?.profile,
    focusRevision = data?.focusRevision,
    previousLocationId = data?.scene?.locationId,
    token = context.token,
    command: LiveCommand = {
      commandId: crypto.randomUUID(),
      campaignId: context.campaign.id,
      token,
      action,
    };
  const structural = ['focus', 'move', 'membership', 'scene-roster', 'archive-character'].includes(
    action.kind,
  );
  // Blur starts a text save before the user's button click arrives. Keep queued
  // intents available; their handlers await flushLive before writing.
  requestIsTextSave = action.kind === 'profile' || action.kind === 'scene-content';
  busy(true, structural, requestIsTextSave);
  tell('Wird gespeichert…');
  const current = editorSession.capture();
  const task = editorSession.run(async () => {
    try {
      const ack = unwrap(await window.campaign.executeLive(command));
      if (!current() || context?.token !== token) return null;
      if (
        (action.kind === 'live-moment' ||
          action.kind === 'scene-content' ||
          action.kind === 'session-marker') &&
        (data?.scene?.id !== action.sceneId || data?.focusRevision !== focusRevision)
      )
        return ack;
      mergeAck(ack, action, submittedProfile);
      if (
        liveActionUpdatesRecap(action) ||
        (action.kind === 'scene-content' && ack.scene?.locationId !== previousLocationId)
      )
        void refreshLiveSession();
      tell(changed() ? 'Weitere Eingabe offen – noch nicht gespeichert.' : 'Gespeichert.');
      return ack;
    } catch (error) {
      if (!current() || context?.token !== token) return null;
      failedState.value = { command, submittedProfile };
      blocked = true;
      get('live-reconcile').hidden = false;
      get('live-refresh').hidden = false;
      tell(
        (error as Error).message + ' Entwurf bleibt offen. Zuerst den Speicherstatus prüfen.',
        true,
      );
      return null;
    } finally {
      requestWork.clear(task);
      if (current()) {
        requestIsTextSave = false;
        busy(false, structural);
        renderGroups();
      }
    }
  });
  requestWork.value = task;
  return task;
}
export async function flushLive(): Promise<boolean> {
  captureMomentDraft();
  for (const work of momentWorks.values()) if (!(await saveMomentWork(work))) return false;
  const recap = context && recapDrafts.get(context.campaign.id);
  if (context && recap && !(await saveRecap(context, recap))) return false;
  if (!(await flushSceneDesk())) return false;
  if (!(await flushProgress()) || !(await flushCombat()) || !(await flushChase())) return false;
  if (timer) clearTimeout(timer);
  timer = null;
  if (flushingWork.value) {
    const okay = await flushingWork.value;
    return okay ? flushLive() : false;
  }
  if (requestWork.value) {
    if (!(await requestWork.value)) return false;
    return flushLive();
  }
  if (!context || !data) return true;
  if (blocked || composing) return false;
  if (!changed()) return true;
  flushingWork.value = (async () => {
    if (
      characterDraft &&
      originalCharacter() &&
      !equal(characterDraft.profile, originalCharacter()!.profile)
    ) {
      try {
        checkedCharacterProfile(characterDraft.profile);
      } catch (error) {
        tell((error as Error).message + ' Entwurf bleibt offen.', true);
        return false;
      }
      if (
        !(await execute({
          kind: 'profile',
          characterId: characterDraft.id,
          expectedRevision: characterDraft.profileRevision,
          profile: structuredClone(characterDraft.profile),
        }))
      )
        return false;
    }
    if (sceneDraft && data?.scene && !equal(content(sceneDraft), content(data.scene))) {
      if (
        !(await execute({
          kind: 'scene-content',
          sceneId: sceneDraft.id,
          expectedRevision: sceneDraft.revision,
          ...content(sceneDraft),
        }))
      )
        return false;
    }
    return true;
  })();
  const okay = await flushingWork.value;
  return okay ? flushLive() : false;
}
function schedule() {
  liveReadRequest++;
  if (timer) clearTimeout(timer);
  tell(
    blocked
      ? 'Schreiben gesperrt. Der Entwurf bleibt offen.'
      : 'Eingabe offen – noch nicht gespeichert.',
    blocked,
  );
  if (!composing && !blocked)
    timer = setTimeout(() => {
      void flushLive();
    }, 700);
}
type NewCharacterBasis = { token: string; sceneId: string | null; focusRevision: number | null };
let newCharacterBasis: NewCharacterBasis | null = null,
  creatingCharacter = false;
function openNewCharacter() {
  if (!context || !data || creatingCharacter) return;
  newCharacterBasis = {
    token: context.token,
    sceneId: data.scene?.id ?? null,
    focusRevision: data.focusRevision,
  };
  get('character-create-target').textContent = data.scene
    ? 'Heute dabei in: ' + (data.scene.title || 'Aktuelle Gruppe')
    : 'Noch keine Gruppe geöffnet. Die Figur wird zunächst im Roster vorgemerkt.';
  const join = get<HTMLButtonElement>('character-create-active');
  join.hidden = !data.scene;
  join.type = data.scene ? 'submit' : 'button';
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
    !!data &&
    (!active || (data.scene?.id === basis.sceneId && data.focusRevision === basis.focusRevision));
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
    selected = ack.character.id;
    characterDraft = structuredClone(ack.character);
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
        expectedRosterRevision: data!.rosterRevision,
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
  for (const character of data?.roster ?? []) {
    const group = data?.scenes.find((s) => s.id === character.sceneId);
    const button = document.createElement('button');
    button.textContent =
      character.profile.name +
      (character.active
        ? ' · dabei' +
          (data!.scenes.length > 1 && group
            ? ' · ' +
              (group.title ||
                (group.primary ? 'Hauptgruppe' : 'Gruppe mit ' + groupPeople(group.id)))
            : '')
        : ' · inaktiv');
    button.setAttribute('aria-pressed', String(character.id === selected));
    button.disabled = intentBlocked();
    button.onclick = () => {
      void (async () => {
        if (!(await flushLive()) || context?.token !== token) return;
        selected = character.id;
        characterDraft = structuredClone(originalCharacter()!);
        renderCharacter();
        renderList();
      })();
    };
    list.append(button);
  }
  if (!data?.roster.length) {
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
  get('character-editor').hidden = !characterDraft;
  for (const [id, field] of profileFields)
    get<HTMLInputElement>(id).value = String(characterDraft?.profile[field] ?? '');
  renderMembership();
}
function renderMembership() {
  progressionContext(context, data, selected);
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
const timeDrafts = new Map<string, { amount: string; unit: string; reason: string }>();
let timeDraftOwner: string | null = null;
function timeContext() {
  const owner = context && data?.scene ? context.token + '/' + data.scene.id : null;
  if (owner === timeDraftOwner) return;
  if (timeDraftOwner)
    timeDrafts.set(timeDraftOwner, {
      amount: value('time-amount'),
      unit: value('time-unit'),
      reason: value('time-reason'),
    });
  const draft = owner ? timeDrafts.get(owner) : null;
  get<HTMLInputElement>('time-amount').value = draft?.amount ?? '10';
  get<HTMLSelectElement>('time-unit').value = draft?.unit ?? 'minutes';
  get<HTMLInputElement>('time-reason').value = draft?.reason ?? '';
  timeDraftOwner = owner;
}
function renderVisitRewardEntry() {
  const button = get<HTMLButtonElement>('live-visit-reward'),
    scene = data?.scene;
  button.hidden = !resumed || !scene?.adoption;
  button.title = scene?.adoption ? 'Vorbereitete XP und Beute: ' + scene.title : '';
}
async function openCurrentVisitReward() {
  const token = context?.token,
    scene = data?.scene,
    adoption = scene?.adoption;
  if (!token || !scene || !adoption || !resumed) return;
  const sceneId = scene.id,
    membership = scene.membershipRevision,
    adoptionId = adoption.id;
  const current = () =>
    context?.token === token &&
    resumed &&
    data?.scene?.id === sceneId &&
    data.scene.membershipRevision === membership &&
    data.scene.adoption?.id === adoptionId;
  if (!current() || !(await flushLive()) || !current()) return;
  await openPreparedReward(adoption.planId, adoption.visitId, current);
}
function renderSceneMeta() {
  renderVisitRewardEntry();
  visitBinder?.contextChanged();
  timeNavigator?.contextChanged();
  npcCastBinder?.contextChanged();
  liveGenerator?.contextChanged();
  sessionNavigatorContext(context, data, sources, resumed);
  syncLivePacketContext();
  void refreshMusic();
  if (context && data?.scene && resumed) void renderLiveWorld(context.token, data.scene.id);
  const scene = data?.scene;
  sceneDeskContext(context, resumed ? (scene ?? null) : null);
  combatContext(context, resumed ? (scene ?? null) : null, data?.rosterRevision);
  chaseContext(
    context,
    resumed ? (scene ?? null) : null,
    data?.roster ?? [],
    scene ? formatSceneInstant(scene.clock.instantMs) : '',
  );
  const active = data?.roster.filter((c) => c.active && c.sceneId === scene?.id) ?? [];
  get('live-party').textContent = active.length
    ? 'Dabei: ' + active.map((c) => c.profile.name).join(', ')
    : 'Leere Party – Scene bleibt verfügbar.';
  renderPartyReference();
  timeContext();
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
  const scene = data?.scene,
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
    (sources?.locations.find((l) => l.document.id === sceneDraft?.locationId)?.document.name ??
      (sceneDraft?.locationId ? 'Ort nicht verfügbar' : 'Kein Ort')) + ' · Titel und Ort ändern';
  get<HTMLButtonElement>('running-open-location').disabled = !sceneDraft?.locationId;
  get<HTMLButtonElement>('running-player-location').disabled = !sceneDraft?.locationId;
}
function activeParty() {
  const scene = data?.scene;
  return (
    data?.roster.filter((character) => character.active && character.sceneId === scene?.id) ?? []
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
    for (const button of get('live-party-reference').querySelectorAll<HTMLButtonElement>('button'))
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
async function openPartyHealth(id: string, token: string | undefined, sceneId: string | undefined) {
  const dialog = get<HTMLDialogElement>('live-health-dialog');
  if (
    dialog.open ||
    !(await flushLive()) ||
    context?.token !== token ||
    data?.scene?.id !== sceneId ||
    !activeParty().some((c) => c.id === id)
  )
    return;
  selected = id;
  characterDraft = structuredClone(originalCharacter()!);
  renderCharacter();
  renderList();
  healthOwner = { token: token!, sceneId: sceneId!, characterId: id };
  get('live-health-title').textContent = originalCharacter()!.profile.name + ' · HP und Zustände';
  get('live-health-group').textContent = 'Gruppe: ' + (data?.scene?.title || 'Aktuelle Gruppe');
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
    data?.scene?.id === sceneId &&
    activeParty().some((c) => c.id === id);
  if (!current() || !(await flushLive()) || !current()) return;
  selected = id;
  characterDraft = structuredClone(originalCharacter()!);
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
export async function openLiveCharacterLoot(id: string) {
  const token = context?.token;
  if (
    !(await ensureLiveRuntime()) ||
    context?.token !== token ||
    !(await flushLive()) ||
    context?.token !== token
  )
    return;
  const character = data?.roster.find((c) => c.id === id && !c.archived);
  if (!character) throw new Error('Beuteempfänger ist nicht mehr verfügbar.');
  selected = id;
  characterDraft = structuredClone(character);
  renderCharacter();
  renderList();
  lootReturnOwner = activeParty().some((c) => c.id === id)
    ? { token: token!, sceneId: data!.scene!.id, characterId: id }
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
    data?.scene?.id !== owner.sceneId ||
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
      healthOwner.sceneId !== data?.scene?.id ||
      healthOwner.characterId !== selected ||
      !active.some((c) => c.id === healthOwner!.characterId))
  )
    closeHealthDialog(false);
  reference.replaceChildren();
  if (
    lootReturnOwner &&
    (lootReturnOwner.token !== context?.token ||
      lootReturnOwner.sceneId !== data?.scene?.id ||
      lootReturnOwner.characterId !== selected ||
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
      sceneId = data?.scene?.id;
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
export async function useLiveReferenceReadAloud(
  text: string,
  title: string,
  expectedSceneId: string,
  stillCurrent: () => boolean = () => true,
) {
  const token = context?.token,
    focus = data?.focusRevision;
  const current = () =>
    stillCurrent() &&
    context?.token === token &&
    data?.scene?.id === expectedSceneId &&
    data?.focusRevision === focus;
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
  if (!sceneDraft) return;
  sceneDraft = { ...sceneDraft, readAloud: text };
  get<HTMLTextAreaElement>('running-read-aloud').value = text;
  get<HTMLDetailsElement>('running-read-aloud-details').open = true;
  schedule();
  get<HTMLTextAreaElement>('running-read-aloud').focus();
  tell('Vorlesetext aus „' + title + '“ übernommen – wird automatisch gespeichert.');
}
function loadLiveNarrative(noteId: string) {
  if (
    !context ||
    narrativeCache.has(noteId) ||
    narrativeProblems.has(noteId) ||
    narrativeLoading.has(noteId)
  )
    return;
  const token = context.token,
    generation = narrativeGeneration;
  narrativeLoading.add(noteId);
  void window.campaign
    .narrative(token, noteId)
    .then((result) => {
      if (context?.token !== token || generation !== narrativeGeneration) return;
      if (result.ok) narrativeCache.set(noteId, result.value);
      else narrativeProblems.set(noteId, result.error);
    })
    .catch((error) => {
      if (context?.token === token && generation === narrativeGeneration)
        narrativeProblems.set(noteId, (error as Error).message);
    })
    .finally(() => {
      if (generation === narrativeGeneration) {
        narrativeLoading.delete(noteId);
        renderLiveKnowledge();
      }
    });
}
function narrativeFacts(view: NarrativeView) {
  const state = view.state,
    location = state.locationId
      ? (sources?.locations.find((row) => row.document.id === state.locationId)?.document.name ??
        'Ort nicht verfügbar')
      : 'Ohne Ortsbindung',
    contributors = state.contributors.map(
      (id) =>
        data?.roster.find((character) => character.id === id)?.profile.name ?? 'Unbekannte Figur',
    );
  return (
    (state.status === 'closed' ? 'Abgeschlossen' : 'Offen') +
    ' · ' +
    location +
    (contributors.length ? ' · Beteiligte: ' + contributors.join(', ') : '') +
    (state.poolXp ? ' · ' + state.poolXp + ' XP vorgemerkt' : '') +
    (view.award ? ' · Belohnung vergeben' : '')
  );
}
function renderLiveKnowledge() {
  const root = get('live-knowledge-results');
  root.replaceChildren();
  const query = value('live-knowledge-search').trim().toLocaleLowerCase('de');
  if (!sources) {
    get('live-knowledge-result').textContent = liveSourcesProblem;
    return;
  }
  const found = findLiveKnowledge(
      (sources?.notes ?? []).filter((row) => !row.trashed && row.note.kind !== 'rule'),
      query,
      30,
      (row) => preparedNoteIds.has(row.note.id),
    ),
    rows = found.rows;
  get('live-knowledge-result').textContent =
    rows.length === found.total
      ? found.total + ' Einträge angezeigt.'
      : rows.length + ' von ' + found.total + ' Einträgen angezeigt – Suche präzisieren.';
  for (const row of rows) {
    const note = row.note,
      card = document.createElement('article'),
      heading = document.createElement('div'),
      title = document.createElement('h4'),
      kind = document.createElement('small'),
      actions = document.createElement('div');
    heading.className = 'toolbar';
    title.textContent = note.title || 'Unbenannter Eintrag';
    kind.textContent =
      {
        note: 'Notiz',
        npc: 'NSC',
        faction: 'Fraktion',
        quest: 'Quest',
        rumor: 'Gerücht',
        rule: 'Regel',
      }[note.kind] + (preparedNoteIds.has(note.id) ? ' · Mit aktuellem Besuch verknüpft' : '');
    heading.append(title, kind);
    actions.className = 'toolbar';
    if (note.readAloud) {
      const publicText = document.createElement('pre'),
        use = document.createElement('button');
      publicText.textContent = note.readAloud;
      publicText.className = 'live-knowledge-public';
      use.type = 'button';
      use.textContent = 'Als Vorlesetext einsetzen';
      use.onclick = () => useKnowledgeReadAloud(note.readAloud, note.title);
      card.append(heading, publicText);
      actions.append(use);
    } else card.append(heading);
    if (note.kind === 'npc') {
      const portrait = document.createElement('button');
      portrait.type = 'button';
      portrait.textContent = 'Porträt zeigen';
      portrait.onclick = () => void showLiveNpc(note.id);
      actions.append(portrait);
    }
    if (note.kind === 'quest' || note.kind === 'rumor') {
      const status = document.createElement('p'),
        open = document.createElement('button'),
        view = narrativeCache.get(note.id),
        problem = narrativeProblems.get(note.id);
      status.className = 'caption';
      status.textContent = view
        ? narrativeFacts(view)
        : problem
          ? 'Status nicht verfügbar: ' + problem
          : 'Status wird geladen…';
      open.type = 'button';
      open.textContent = view?.award ? 'Abschluss ansehen' : 'Verwalten / abschließen';
      open.onclick = () => void openKnowledgeNote(note.id);
      card.append(status);
      actions.append(open);
      if (!view && !problem) loadLiveNarrative(note.id);
    }
    if (note.gmNotes) {
      const details = document.createElement('details'),
        summary = document.createElement('summary'),
        gm = document.createElement('pre');
      summary.textContent = 'GM-Notizen';
      gm.textContent = note.gmNotes;
      details.append(summary, gm);
      card.append(details);
    }
    card.append(actions);
    root.append(card);
  }
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'caption';
    empty.textContent = query
      ? 'Kein vorbereitetes Wissen gefunden.'
      : 'Noch keine NSCs, Fraktionen, Quests oder Gerüchte vorbereitet.';
    root.append(empty);
  }
}
function placePartyEditor(atTable: boolean) {
  const panel = get('live-party-panel'),
    slot = get(atTable ? 'live-party-at-table' : 'live-party-start');
  if (panel.parentElement !== slot) slot.append(panel);
}
function renderScene() {
  if (data && !data.scene && !data.roster.length)
    get<HTMLDetailsElement>('live-party-details').open = true;
  placePartyEditor(resumed && !!sceneDraft);
  if (preparedNotesSceneId !== data?.scene?.id) {
    preparedNotesSceneId = data?.scene?.id ?? null;
    preparedNoteIds.clear();
  }
  get('live-focus-bar').hidden = !resumed || !sceneDraft;
  get('running-editor').hidden = !resumed || !sceneDraft;
  get('live-start-hint').hidden = resumed;
  get('live-continue').hidden = resumed;
  get('live-play-heading').hidden = resumed;
  const proseOwner = context && sceneDraft ? context.token + ':' + sceneDraft.id : null;
  const readAloud = get<HTMLTextAreaElement>('running-read-aloud'),
    nextReadAloud = sceneDraft?.readAloud ?? '';
  if (readAloudOwner !== proseOwner || (!readAloud.value.trim() && nextReadAloud.trim())) {
    get<HTMLDetailsElement>('running-read-aloud-details').open = !!nextReadAloud.trim();
    readAloudOwner = proseOwner;
  }
  get<HTMLInputElement>('running-title').value = sceneDraft?.title ?? '';
  get<HTMLTextAreaElement>('running-notes').value = sceneDraft?.notes ?? '';
  get<HTMLTextAreaElement>('running-read-aloud').value = sceneDraft?.readAloud ?? '';
  get<HTMLButtonElement>('running-player-location').disabled = !sceneDraft?.locationId;
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
  const current = sceneDraft?.locationId;
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
    data?.roster
      .filter((c) => c.active && c.sceneId === id)
      .map((c) => c.profile.name)
      .join(', ') || 'Leere Party'
  );
}
function groupLabel(group: Pick<LiveView['scenes'][number], 'id' | 'title' | 'primary' | 'clock'>) {
  return (
    (group.title || 'Unbenannte Gruppe') +
    (group.primary ? ' · Hauptgruppe' : '') +
    ' · ' +
    groupPeople(group.id) +
    ' · ' +
    formatSceneInstant(group.clock.instantMs)
  );
}
function currentLiveMomentDraft(): LiveMomentDraft {
  return {
    category: value('live-moment-category') as LiveMomentCategory,
    title: value('live-moment-title'),
    summary: value('live-moment-summary'),
    followUp: value('live-moment-follow-up') as LiveMomentDraft['followUp'],
  };
}
function writeLiveMomentDraft(draft: LiveMomentDraft) {
  get<HTMLSelectElement>('live-moment-category').value = draft.category;
  get<HTMLInputElement>('live-moment-title').value = draft.title;
  get<HTMLTextAreaElement>('live-moment-summary').value = draft.summary;
  get<HTMLSelectElement>('live-moment-follow-up').value = draft.followUp;
}
function showMomentDraftState() {
  const work = momentOwner,
    active = work && liveMomentDraftValue(work.text),
    error = work?.error || work?.readError;
  get('live-moment-draft-status').textContent =
    error ||
    (!work
      ? ''
      : work.dirty
        ? 'Momententwurf wird gesichert…'
        : active
          ? 'Momententwurf gesichert · noch nicht in der Chronik.'
          : 'Eingaben werden als Entwurf gesichert. Erst „Moment festhalten“ bestätigt das Ereignis.');
  get('live-moment-retry').hidden = !error;
  get('live-moment-retry').textContent = work?.readError
    ? 'Momententwurf erneut laden'
    : 'Eigene Eingabe erneut sichern…';
  get('live-moment-open').textContent = active ? 'Momententwurf öffnen…' : 'Moment festhalten…';
  for (const field of get('live-moment-form').querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement
  >('input,select,textarea,button'))
    field.disabled = field.id !== 'live-moment-retry' && !!work?.readError;
}
function captureMomentDraft() {
  const work = momentOwner;
  if (!work || work.readError) return;
  const text = currentLiveMomentDraft();
  if (!equal(text, work.text)) {
    work.text = text;
    work.dirty = !sameLiveMomentDraft(liveMomentDraftValue(text), work.basis);
    if (!work.dirty) work.error = '';
    showMomentDraftState();
  }
}
async function saveMomentWork(work: MomentWork): Promise<boolean> {
  if (work.saving.value) return work.saving.value;
  if (!work.dirty) return true;
  if (work.readError) return false;
  const task = (async () => {
    while (work.dirty) {
      const text = liveMomentDraftValue(work.text);
      try {
        unwrap(
          await window.campaign.keepLiveMomentDraft(work.w.token, work.sceneId, text, work.basis),
        );
      } catch (error) {
        try {
          const saved = unwrap(await window.campaign.liveScene(work.w.token, work.sceneId));
          if (saved.momentDraftError || !sameLiveMomentDraft(saved.momentDraft ?? null, text))
            throw error;
        } catch {
          work.error = 'Momententwurf nicht gesichert: ' + (error as Error).message;
          if (momentOwner === work) showMomentDraftState();
          tell(work.error, true);
          return false;
        }
      }
      work.basis = text;
      work.error = '';
      work.dirty = !sameLiveMomentDraft(liveMomentDraftValue(work.text), text);
      if (momentOwner === work) showMomentDraftState();
    }
    return true;
  })();
  work.saving.value = task;
  try {
    return await task;
  } finally {
    if (work.saving.value === task) work.saving.clear(task);
  }
}
async function retryMomentDraft() {
  const work = momentOwner;
  if (!work) return;
  captureMomentDraft();
  const text = { ...work.text };
  try {
    if (work.saving.value) await work.saving.value;
    const scene = unwrap(await window.campaign.liveScene(work.w.token, work.sceneId));
    if (momentOwner !== work || !equal(text, work.text)) return;
    if (scene.momentDraftError) throw new Error(scene.momentDraftError);
    const saved = scene.momentDraft ?? null;
    if (work.readError) {
      work.text = saved ?? emptyLiveMomentDraft();
      work.basis = saved;
      work.readError = '';
      work.error = '';
      work.dirty = false;
      writeLiveMomentDraft(work.text);
      showMomentDraftState();
      return;
    }
    if (
      !sameLiveMomentDraft(saved, work.basis) &&
      !sameLiveMomentDraft(saved, liveMomentDraftValue(text)) &&
      !window.confirm(
        'Ein anderer Momententwurf ist gesichert:\n' +
          (saved?.title ?? '') +
          '\n' +
          (saved?.summary ?? '') +
          '\n\nDurch deine weiterhin sichtbare Eingabe ersetzen?',
      )
    )
      return;
    work.basis = saved;
    work.dirty = true;
    await saveMomentWork(work);
  } catch (error) {
    work.error = 'Momententwurf nicht gesichert: ' + (error as Error).message;
    if (momentOwner === work) showMomentDraftState();
  }
}
function renderLiveMomentDraft() {
  const scene = data?.scene;
  if (momentOwner?.sceneId === scene?.id && momentOwner?.w.token === context?.token) return;
  captureMomentDraft();
  if (momentOwner?.dirty) void saveMomentWork(momentOwner);
  momentOwner = null;
  if (scene && context) {
    let work = momentWorks.get(scene.id);
    if (!work) {
      work = {
        saving: editorSession.operation<Promise<boolean>>(),
        w: context,
        sceneId: scene.id,
        text: scene.momentDraft ?? emptyLiveMomentDraft(),
        basis: scene.momentDraft ?? null,
        dirty: false,
        error: '',
        readError: scene.momentDraftError ?? '',
      };
      momentWorks.set(scene.id, work);
    }
    momentOwner = work;
  }
  writeLiveMomentDraft(momentOwner?.text ?? emptyLiveMomentDraft());
  get('live-moment-result').textContent = '';
  showMomentDraftState();
  if (momentOwner && liveMomentDraftValue(momentOwner.text))
    get<HTMLDetailsElement>('live-moment-panel').open = true;
}
function renderLiveSession() {
  const recap = liveSessionRecap(
    sessionChronicle?.entries ?? [],
    sessionChronicle?.latestSessionMarker,
  );
  sessionResumeButton.hidden = recap.open || !recap.marker;
  sessionResumeButton.disabled = !!sessionChronicleError || intentBlocked();
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
    before = data?.scene;
  if (!owner || !before) return;
  const current = () => context === owner && data?.scene === before;
  try {
    const scene = unwrap(await window.campaign.liveScene(owner.token, before.id));
    if (
      !current() ||
      scene.id !== before.id ||
      scene.clock.epochId !== before.clock.epochId ||
      scene.clock.revision < before.clock.revision
    )
      return;
    before.clock = scene.clock;
    for (const row of data!.scenes) if (row.id === scene.id) row.clock = scene.clock;
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
async function readSessionCloseAudit(
  token: string,
  scenes: LiveView['scenes'],
  events: ReturnType<typeof liveSessionRecap>['entries'],
): Promise<SessionCloseAudit> {
  const [rows, treasureResult] = await Promise.all([
      Promise.all(
        scenes.map(async (scene) => {
          const [combatResult, chaseResult] = await Promise.all([
            window.campaign.combat(token, scene.id),
            window.campaign.chase(token, scene.id),
          ]);
          return { scene, combat: unwrap(combatResult), chase: unwrap(chaseResult) };
        }),
      ),
      window.campaign.treasures(token, null),
    ]),
    treasures = unwrap(treasureResult),
    masks: SessionCloseMask[] = [],
    seen = new Set<string>();
  for (const row of rows) {
    for (const combat of row.combat.recent)
      if (['preparing', 'running'].includes(combat.phase) && !seen.has('combat:' + combat.id)) {
        seen.add('combat:' + combat.id);
        masks.push({
          kind: 'combat',
          id: combat.id,
          sceneId: row.scene.id,
          sceneTitle: row.scene.title || 'Unbenannte Gruppe',
          title: combat.title,
          state: combat.phase === 'preparing' ? 'in Vorbereitung' : 'läuft',
        });
      }
    for (const chase of row.chase.recent)
      if (chase.status === 'running' && !seen.has('chase:' + chase.id)) {
        seen.add('chase:' + chase.id);
        masks.push({
          kind: 'chase',
          id: chase.id,
          sceneId: row.scene.id,
          sceneTitle: row.scene.title || 'Unbenannte Gruppe',
          title: chase.title,
          state: 'läuft',
        });
      }
  }
  const openTreasures = treasures.items.filter((item) => item.available > 0);
  return {
    masks,
    treasures: {
      count: openTreasures.length,
      units: openTreasures.reduce((sum, item) => sum + item.available, 0),
      more: !!treasures.next,
    },
    xpBooked: events.some((entry) => entry.title.startsWith('XP-Abrechnung:')),
    events: events.length,
  };
}
function currentSessionCloseReview() {
  const basis = sessionCloseOpeningBasis;
  return (
    !!basis &&
    basis.generation === sessionCloseRequest &&
    get<HTMLDialogElement>('live-session-close-dialog').open &&
    basis.current()
  );
}
function renderSessionCloseAudit(audit: SessionCloseAudit, current: () => boolean) {
  const active = data?.roster.filter((character) => character.active).length ?? 0,
    groups = data?.scenes.length ?? 0;
  get('live-session-close-facts').textContent =
    audit.events +
    ' bestätigte Ereignisse · ' +
    active +
    ' aktive Figuren · ' +
    groups +
    ' ' +
    (groups === 1 ? 'Gruppe' : 'Gruppen');
  get('live-session-close-xp-status').textContent = audit.xpBooked
    ? 'Spielabend-XP wurden in diesem Rückblick bereits abgerechnet.'
    : 'Für diesen Spielabend ist noch keine XP-Abrechnung im Rückblick erfasst.';
  get('live-session-close-loot-status').textContent = audit.treasures.count
    ? audit.treasures.count +
      ' unverteilte ' +
      (audit.treasures.count === 1 ? 'Schatzposition' : 'Schatzpositionen') +
      ' · ' +
      audit.treasures.units +
      ' verfügbare Einheiten' +
      (audit.treasures.more ? ' · weitere Schätze vorhanden' : '')
    : 'Keine unverteilte Beute auf der ersten Schatzseite.';
  const root = get('live-session-close-masks');
  root.replaceChildren();
  if (!audit.masks.length) {
    const empty = document.createElement('p');
    empty.className = 'caption';
    empty.textContent = 'Keine laufenden Kämpfe oder Verfolgungen.';
    root.append(empty);
    return;
  }
  for (const mask of audit.masks) {
    const card = document.createElement('article'),
      text = document.createElement('div'),
      title = document.createElement('strong'),
      facts = document.createElement('p'),
      button = document.createElement('button');
    title.textContent = mask.title;
    facts.textContent =
      (mask.kind === 'combat' ? 'Kampf' : 'Verfolgung') +
      ' · ' +
      mask.state +
      ' · ' +
      mask.sceneTitle;
    button.type = 'button';
    button.textContent = 'Öffnen';
    button.onclick = () =>
      void (async () => {
        if (!button.isConnected || !current()) return;
        const basis = sessionCloseOpeningBasis;
        leaveSessionCloseReview();
        const run = sessionCloseRequest;
        if (
          !(await changeFocus(
            mask.sceneId,
            () => run === sessionCloseRequest && !!basis?.current(),
          )) ||
          data?.scene?.id !== mask.sceneId
        )
          return;
        if (mask.kind === 'combat') {
          await openExistingCombat(mask.id);
          get('combat-panel').scrollIntoView({ block: 'start' });
        } else {
          await openExistingChase(mask.id);
          get('chase-panel').scrollIntoView({ block: 'start' });
        }
      })().catch((error) => tell(error.message, true));
    text.append(title, facts);
    card.append(text, button);
    root.append(card);
  }
}
async function loadSessionCloseReview(preserveSummary = false) {
  const token = context?.token,
    recap = liveSessionRecap(
      sessionChronicle?.entries ?? [],
      sessionChronicle?.latestSessionMarker,
    ),
    dialog = get<HTMLDialogElement>('live-session-close-dialog'),
    scene = data?.scene,
    scenes = data?.scenes;
  if (!token || !scene || !scenes || sessionChronicleError || recapReadError() || !recap.open) {
    renderLiveSession();
    return;
  }
  const run = ++sessionCloseRequest,
    selectedPlan =
      scene.adoption?.planId ||
      value('live-session-plan') ||
      sources?.selection.planId ||
      sources?.plans[0]?.id ||
      null,
    locationId = scene.locationId ?? null;
  const owner = context,
    signature = () =>
      JSON.stringify([
        data?.focusId,
        data?.focusRevision,
        data?.rosterRevision,
        data?.scene?.id,
        data?.scene?.locationId,
        data?.scene?.membershipRevision,
        data?.scene?.clock,
        data?.scenes.map((row) => [row.id, row.membershipRevision, row.clock]),
      ]),
    shown = signature();
  const current = () => context === owner && context?.token === token && signature() === shown,
    reviewCurrent = () =>
      current() && !recapReadError() && run === sessionCloseRequest && dialog.open;
  sessionCloseOpeningBasis = {
    generation: run,
    current,
    sceneTitle: scene.title || 'Unbenannte Gruppe',
    recommendedPlanId: selectedPlan,
    beforeVisitId: null,
    locationId,
    locationTitle:
      sources?.locations.find((row) => row.document.id === locationId)?.document.name ||
      'Aktueller Gruppenort',
    noteIds: [],
  };
  if (!preserveSummary) {
    get<HTMLTextAreaElement>('live-session-close-summary').value = value('live-session-summary');
    get<HTMLTextAreaElement>('live-session-close-handoff').value = value('live-session-handoff');
  }
  if (!dialog.open) dialog.showModal();
  dialog.setAttribute('aria-busy', 'true');
  get('live-session-close-status').textContent = 'Offene Spielstände werden geprüft…';
  get<HTMLButtonElement>('live-session-close-confirm').disabled = true;
  get<HTMLButtonElement>('live-session-close-prepare').disabled = true;
  get<HTMLButtonElement>('live-session-close-refresh').disabled = true;
  get('live-session-close-masks').replaceChildren();
  get('live-session-close-suggestion').textContent = '';
  get<HTMLButtonElement>('live-session-close-use-suggestion').disabled = true;
  try {
    const [audit, advice] = await Promise.all([
      readSessionCloseAudit(token, scenes, recap.entries),
      readSessionResumePrep(
        token,
        scenes.filter((row) => row.id === scene.id),
        reviewCurrent,
      )
        .then((value) => ({
          value: value.problems.length ? null : value,
          error: value.problems.length ? new Error(value.problems.join(' · ')) : null,
        }))
        .catch((error: Error) => ({ value: null, error })),
    ]);
    if (!reviewCurrent()) {
      if (context === owner && run === sessionCloseRequest && dialog.open)
        get('live-session-close-status').textContent = 'Gruppenstand geändert. Erneut prüfen.';
      return;
    }
    renderSessionCloseAudit(audit, reviewCurrent);
    if (advice.value) {
      const prep = advice.value;
      const visit = prep.visits.find((row) => row.sceneId === scene.id),
        world = prep.worlds.find((row) => row.sceneId === scene.id),
        openingLocationId =
          world?.agenda.scene?.locationId ?? world?.frame.scene.locationId ?? locationId,
        localNarratives = prep.narratives.entries.filter(
          (entry) => openingLocationId && entry.view.state.locationId === openingLocationId,
        ),
        journey = world?.frame.journey,
        journeyText =
          journey && !['arrived', 'ended'].includes(journey.status)
            ? ({ active: 'unterwegs', paused: 'pausiert', interrupted: 'angehalten' } as const)[
                journey.status as 'active' | 'paused' | 'interrupted'
              ] +
              ' · ' +
              Math.max(0, journey.nextIndex - 1) +
              ' / ' +
              Math.max(0, journey.route.length - 1) +
              ' Abschnitte' +
              (journey.reason ? ' · ' + journey.reason : '')
            : null,
        agenda =
          world?.agenda.items.slice(0, 3).map((item) => {
            const delta = String(
              BigInt(item.state === 'active' ? item.endMs : item.startMs) -
                BigInt(world.agenda.scene?.instantMs ?? '0'),
            );
            return (
              item.event.name +
              ' · ' +
              (item.state === 'active' ? 'jetzt aktiv, noch ' : 'in ') +
              agendaCountdown(world.agenda.calendar, delta)
            );
          }) ?? [],
        narratives = prep.narratives.entries
          .slice(0, 4)
          .map(
            (entry) =>
              (entry.note.title || 'Unbenannter Auftrag') +
              (entry.locationName ? ' · ' + entry.locationName : ''),
          ),
        suggestion = sessionCloseHandoffSuggestion({
          sceneTitle: scene.title,
          locationTitle: world?.agenda.scene?.locationTitle || null,
          masks: audit.masks,
          treasureCount: audit.treasures.count,
          xpBooked: audit.xpBooked,
          nextVisit: visit
            ? { title: visit.nextVisit.title, location: visit.packet?.location }
            : null,
          journey: journeyText,
          agenda,
          narratives,
          notices: world?.frame.notices.slice(0, 3).map((notice) => notice.text) ?? [],
        });
      sessionCloseOpeningBasis = {
        generation: run,
        current,
        sceneTitle: scene.title || 'Unbenannte Gruppe',
        recommendedPlanId: visit?.nextVisit.planId ?? selectedPlan,
        beforeVisitId: visit?.nextVisit.visitId ?? null,
        locationId: openingLocationId,
        locationTitle:
          world?.agenda.scene?.locationTitle ||
          sessionCloseOpeningBasis?.locationTitle ||
          'Aktueller Gruppenort',
        noteIds: localNarratives.slice(0, 20).map((entry) => entry.note.id),
      };
      get('live-session-close-suggestion').textContent = suggestion;
      get<HTMLButtonElement>('live-session-close-use-suggestion').disabled = false;
    } else
      get('live-session-close-suggestion').textContent =
        'Vorschlag nicht verfügbar: ' +
        advice.error?.message +
        '. Eigene Übergabe ist weiterhin möglich.';
    get('live-session-close-status').textContent =
      audit.masks.length || audit.treasures.count || !audit.xpBooked
        ? 'Prüfung abgeschlossen. Offene Punkte bleiben erhalten, wenn du den Spielabend jetzt beendest.'
        : 'Alles geprüft. Der Spielabend kann abgeschlossen werden.';
    get<HTMLButtonElement>('live-session-close-confirm').disabled = false;
    get<HTMLButtonElement>('live-session-close-prepare').disabled = false;
  } catch (error) {
    if (reviewCurrent())
      get('live-session-close-status').textContent =
        'Prüfung fehlgeschlagen: ' + (error as Error).message;
  } finally {
    if (run === sessionCloseRequest) {
      dialog.setAttribute('aria-busy', 'false');
      get<HTMLButtonElement>('live-session-close-refresh').disabled = false;
    }
  }
}

async function finishLiveSession(prepareOpening = false) {
  const token = context?.token,
    n = sessionCloseRequest,
    dialog = get<HTMLDialogElement>('live-session-close-dialog'),
    basis = sessionCloseOpeningBasis;
  if (!token || !dialog.open || get<HTMLButtonElement>('live-session-close-confirm').disabled)
    return;
  if (!currentSessionCloseReview()) {
    get('live-session-close-status').textContent = 'Gruppenstand geändert. Erneut prüfen.';
    return;
  }
  const current = () => basis === sessionCloseOpeningBasis && currentSessionCloseReview();
  const { summary, handoff } = recapFields();
  get<HTMLButtonElement>('live-session-close-confirm').disabled = true;
  get<HTMLButtonElement>('live-session-close-prepare').disabled = true;
  const confirmed = await markLiveSession('end', summary, handoff, current);
  if (context?.token !== token || n !== sessionCloseRequest || !dialog.open || !current()) return;
  if (confirmed) {
    sessionCloseRequest++;
    sessionCloseOpeningBasis = null;
    dialog.close();
    if (prepareOpening && basis) openHandoffVisit({ ...basis, handoff });
  } else {
    get<HTMLButtonElement>('live-session-close-confirm').disabled = false;
    get<HTMLButtonElement>('live-session-close-prepare').disabled = false;
  }
}
function openHandoffVisit(draft: HandoffVisitDraft) {
  if (!draft.current()) return;
  draft.notes = draft.handoff;
  handoffVisitDraft = draft;
  get<HTMLFormElement>('handoff-visit-form').inert = false;
  const seed = handoffVisitSeed(draft.handoff, draft.sceneTitle),
    plans = get<HTMLSelectElement>('handoff-visit-plan');
  plans.replaceChildren(new Option('Neuen Plan „Nächster Spielabend“ anlegen', ''));
  for (const plan of sources?.plans ?? [])
    plans.add(new Option(plan.name || 'Unbenannter Plan', plan.id));
  if (
    draft.recommendedPlanId &&
    ![...plans.options].some((option) => option.value === draft.recommendedPlanId)
  )
    plans.add(
      new Option(
        'Bisher gewählter Spielabend · Verfügbarkeit wird geprüft',
        draft.recommendedPlanId,
      ),
    );
  plans.value = draft.recommendedPlanId ?? '';
  get<HTMLInputElement>('handoff-visit-title').value = seed.title;
  get<HTMLTextAreaElement>('handoff-visit-read-aloud').value = '';
  get<HTMLTextAreaElement>('handoff-visit-notes').value = seed.notes;
  get('handoff-visit-location').textContent = draft.locationId
    ? 'Ort: ' + draft.locationTitle
    : 'Ohne Ortsbindung';
  get('handoff-visit-sources').textContent = draft.noteIds.length
    ? draft.noteIds.length +
      ' offene Ortsquelle' +
      (draft.noteIds.length === 1 ? '' : 'n') +
      ' werden an die Mappe gebunden.'
    : 'Keine offene Ortsquelle zum Binden.';
  get('handoff-visit-status').textContent = '';
  get<HTMLDialogElement>('handoff-visit-dialog').showModal();
  get<HTMLInputElement>('handoff-visit-title').focus();
}
function initHandoffVisitDialog() {
  const dialog = document.createElement('dialog');
  dialog.id = 'handoff-visit-dialog';
  dialog.innerHTML =
    '<form id="handoff-visit-form"><h2>Übergabe als Einstieg vorbereiten</h2><label>Spielabendplan<select id="handoff-visit-plan"></select></label><label>Titel<input id="handoff-visit-title" maxlength="1000" required></label><p id="handoff-visit-location" class="caption"></p><label>Zum Vorlesen<textarea id="handoff-visit-read-aloud" rows="4" placeholder="Was hören die Spieler zu Beginn?"></textarea></label><label>Private GM-Notizen<textarea id="handoff-visit-notes" rows="8"></textarea></label><p id="handoff-visit-sources" class="caption"></p><p class="caption">Im vorgeschlagenen Plan wird der Einstieg vor den nächsten Besuch gesetzt, in einem anderen Plan am Ende. Vorlesetext bleibt privat, bis du ihn am Spieltisch ausdrücklich freigibst.</p><p id="handoff-visit-status" role="status"></p><div class="toolbar"><button type="submit">Einstieg vorbereiten</button><button id="handoff-visit-open" type="submit">Vorbereiten + Mappe öffnen</button><button id="handoff-visit-cancel" type="button">Abbrechen</button></div></form>';
  document.body.append(dialog);
  const close = () => {
    handoffVisitDraft = null;
    dialog.close();
  };
  get('handoff-visit-notes').addEventListener('input', () => {
    const draft = handoffVisitDraft;
    if (draft && !draft.pending && draft.current())
      draft.notes = preserveLiteralEdit(draft.notes ?? draft.handoff, value('handoff-visit-notes'));
  });
  get('handoff-visit-cancel').onclick = close;
  dialog.addEventListener('cancel', () => {
    handoffVisitDraft = null;
  });
  get<HTMLFormElement>('handoff-visit-form').onsubmit = (event) => {
    event.preventDefault();
    const draft = handoffVisitDraft;
    if (!draft || !draft.current() || draft.pending) return;
    if (get<HTMLSelectElement>('handoff-visit-plan').selectedIndex < 0) {
      get('handoff-visit-status').textContent =
        'Zielplan auswählen oder ausdrücklich einen neuen Plan anlegen.';
      return;
    }
    const planId = value('handoff-visit-plan') || null,
      form = get<HTMLFormElement>('handoff-visit-form'),
      openPacket = (event.submitter as HTMLElement | null)?.id === 'handoff-visit-open';
    draft.pending = true;
    form.inert = true;
    get('handoff-visit-status').textContent = 'Einstieg und Mappe werden gespeichert…';
    void openMomentVisit(
      planId,
      {
        title: value('handoff-visit-title'),
        notes: preserveLiteralEdit(draft.notes ?? draft.handoff, value('handoff-visit-notes')),
        readAloud: value('handoff-visit-read-aloud'),
        noteIds: draft.noteIds,
        locationId: draft.locationId,
        newPlan: planId === null,
        beforeVisitId: planId === draft.recommendedPlanId ? draft.beforeVisitId : null,
      },
      () => handoffVisitDraft === draft && draft.current(),
      openPacket,
    )
      .then((opened) => {
        if (handoffVisitDraft === draft && draft.current()) {
          close();
          tell(
            openPacket
              ? opened
                ? 'Übergabe vorbereitet und GM-Mappe geöffnet.'
                : 'Übergabe vorbereitet; GM-Mappe konnte nicht geöffnet werden.'
              : 'Übergabe als vollständiger nächster Besuch vorbereitet.',
            openPacket && !opened,
          );
        }
      })
      .catch((error) => {
        if (handoffVisitDraft === draft && draft.current())
          get('handoff-visit-status').textContent = (error as Error).message;
      })
      .finally(() => {
        if (handoffVisitDraft === draft) {
          draft.pending = false;
          if (form.isConnected) form.inert = false;
        }
      });
  };
}
async function startLiveSession(sceneId?: string, current: () => boolean = () => true) {
  const token = context?.token,
    id = data?.scene?.id,
    focus = data?.focusRevision;
  const sourceCurrent = () =>
    current() &&
    context?.token === token &&
    data?.scene?.id === id &&
    data?.focusRevision === focus;
  if (!token || !id || !sourceCurrent() || sessionChronicleError) return false;
  if (sceneId && data?.focusId !== sceneId) {
    if (
      !(await changeFocus(sceneId, sourceCurrent)) ||
      context?.token !== token ||
      data?.scene?.id !== sceneId ||
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
interface ResumeLease {
  current: () => boolean;
  dismiss: () => void;
  focus: (id: string) => Promise<boolean>;
}
async function openMaskFromResume(mask: SessionCloseMask, lease: ResumeLease) {
  lease.dismiss();
  if (!(await lease.focus(mask.sceneId))) return;
  if (mask.kind === 'combat') {
    await openExistingCombat(mask.id);
    if (lease.current()) get('combat-panel').scrollIntoView({ block: 'start' });
  } else {
    await openExistingChase(mask.id);
    if (lease.current()) get('chase-panel').scrollIntoView({ block: 'start' });
  }
}

async function readSessionResumePrep(
  token: string,
  scenes: LiveView['scenes'],
  current: () => boolean = () => context?.token === token,
): Promise<SessionResumePrep> {
  const plans = (sources?.plans ?? [])
      .filter((plan) => plan.scenes.length)
      .map((plan) => ({ id: plan.id, name: plan.name, revision: plan.revision })),
    problems: string[] = sources
      ? []
      : [liveSourcesProblem || 'Vorbereitungspläne nicht verfügbar.'],
    packets = new Map<string, Promise<SessionPacket | null>>();
  const preferred = value('live-session-plan'),
    preferredIndex = plans.findIndex((plan) => plan.id === preferred);
  if (preferredIndex > 0) plans.unshift(plans.splice(preferredIndex, 1)[0]!);
  const check = () => {
    if (!current()) throw new Error('Wiederaufnahme inzwischen beendet.');
  };
  async function read<T>(label: string, load: () => Promise<Result<T>>): Promise<T | null> {
    check();
    try {
      const value = unwrap(await load());
      check();
      return value;
    } catch (error) {
      check();
      problems.push(label + ': ' + (error as Error).message);
      return null;
    }
  }
  const packetFor = (planId: string) => {
    let p = packets.get(planId);
    if (!p) {
      p = read('Mappe ' + planId, () => window.campaign.sessionPacket(token, planId));
      packets.set(planId, p);
    }
    return p;
  };
  const fallbackFor = async (sceneId: string) => {
    for (const plan of plans) {
      const progress = await read('Besuchsstand ' + plan.name, () =>
        window.campaign.sessionProgress(token, plan.id, sceneId),
      );
      if (!progress) continue;
      if (progress.planId !== plan.id || progress.planRevision !== plan.revision) {
        problems.push('Plan ' + plan.name + ' wurde geändert. Erneut laden.');
        continue;
      }
      const visit = progress.visits.find(
        (item) => !item.focused?.outcome || item.focused.outcome.status === 'open',
      );
      if (visit)
        return {
          nextVisit: {
            planId: plan.id,
            planRevision: plan.revision,
            visitId: visit.id,
            title: visit.title,
          },
          planName: plan.name || 'Unbenannter Plan',
        };
    }
    return null;
  };
  const visits: SessionResumeVisit[] = [],
    worlds: SessionResumePrep['worlds'] = [];
  // A scene is read at a time; fallback stops at its first usable plan.
  // Failures are retained as missing evidence instead of erasing healthy cards.
  for (const scene of scenes) {
    check();
    const [preparation, frame, agenda] = await Promise.all([
      read('Vorbereitung ' + scene.title, () => window.campaign.scenePreparation(token, scene.id)),
      read('Weltlage ' + scene.title, () => window.campaign.sceneWorld(token, scene.id)),
      read('Agenda ' + scene.title, () =>
        window.campaign.agenda(token, {
          sceneId: scene.id,
          search: '',
          location: 'current',
          horizonDays: 2,
          includePast: false,
          after: null,
        }),
      ),
    ]);
    check();
    if (frame && agenda)
      worlds.push({
        sceneId: scene.id,
        sceneTitle: scene.title || 'Unbenannte Gruppe',
        frame,
        agenda,
      });
    const sequential = preparation?.nextVisit,
      target = sequential
        ? {
            nextVisit: sequential,
            planName: plans.find((p) => p.id === sequential.planId)?.name || 'Unbenannter Plan',
          }
        : preparation
          ? await fallbackFor(scene.id)
          : null;
    if (!target) continue;
    let packet = await packetFor(target.nextVisit.planId);
    check();
    if (
      packet &&
      (packet.planId !== target.nextVisit.planId ||
        packet.planRevision !== target.nextVisit.planRevision)
    ) {
      problems.push('Vorbereitung und Mappe gehören zu verschiedenen Planständen. Erneut laden.');
      packet = null;
    }
    const visit = packet?.visits.find((v) => v.id === target.nextVisit.visitId) ?? null,
      warnings = [...(packet?.warnings ?? [])];
    if (!visit) warnings.push('Die angezeigte Besuchsmappe ist nicht verfügbar. Erneut laden.');
    visits.push({
      sceneId: scene.id,
      sceneTitle: scene.title || 'Unbenannte Gruppe',
      ...target,
      packet: visit,
      packetBasis: visit ? packet!.basis : null,
      warnings: [...warnings],
      fallback: !sequential,
    });
  }
  const progress = await read('Partywerte', () => window.campaign.progress(token));
  const readiness: SessionResumePrep['readiness'] = progress
    ? scenes.map((scene) => ({
        sceneId: scene.id,
        sceneTitle: scene.title || 'Unbenannte Gruppe',
        characters: progress.characters
          .filter((character) => character.active && character.sceneId === scene.id)
          .map((character) => {
            const frame = restFrame(character),
              status = character.health ?? character.lastCombatStatus;
            return {
              characterId: character.characterId,
              name: character.name,
              health: partyHealthFacts(character),
              progress: partyProgressFacts(character),
              warning:
                !character.health ||
                character.health.hp === 0 ||
                !!character.health.death?.dead ||
                !!character.health.death?.stable ||
                !!status?.conditions ||
                character.xp === null ||
                !frame ||
                frame.overdue,
            };
          }),
      }))
    : [];
  const narratives = await read('Auftragsjournal', () =>
    window.campaign.narrativeJournal(token, {
      search: '',
      kind: 'all',
      status: 'open',
      after: null,
    }),
  );
  check();
  return {
    visits,
    worlds,
    narratives: narratives ?? { entries: [], counts: { open: 0, closed: 0 }, next: null },
    problems,
    narrativesAvailable: !!narratives,
    readiness,
    readinessAvailable: !!progress,
  };
}
async function checkedResumeVisit(row: SessionResumeVisit, lease: ResumeLease) {
  if (!lease.current()) return false;
  if (!row.packet || !row.packetBasis)
    throw new Error('Besuchsmappe nicht verfügbar. Wiederaufnahme erneut laden.');
  const packet = unwrap(await window.campaign.sessionPacket(context!.token, row.nextVisit.planId));
  if (!lease.current()) return false;
  if (
    packet.planId !== row.nextVisit.planId ||
    packet.planRevision !== row.nextVisit.planRevision ||
    packet.basis !== row.packetBasis ||
    !packet.visits.some((v) => v.id === row.nextVisit.visitId)
  )
    throw new Error(
      'Die angezeigte Vorbereitung wurde geändert. Dialog schließen, erneut öffnen und Aktion neu wählen.',
    );
  return true;
}
async function openVisitFromResume(row: SessionResumeVisit, lease: ResumeLease) {
  if (!(await checkedResumeVisit(row, lease))) return;
  lease.dismiss();
  if (!(await lease.focus(row.sceneId))) return;
  if (!(await openLive(row.nextVisit.planId, row.nextVisit.visitId)) || !lease.current()) return;
  get<HTMLDetailsElement>('adoption-picker').open = true;
  get<HTMLButtonElement>('adoption-preview').click();
}
async function openPacketFromResume(row: SessionResumeVisit, lease: ResumeLease) {
  if (!(await checkedResumeVisit(row, lease))) return;
  lease.dismiss();
  if (!(await lease.focus(row.sceneId))) return;
  const plan = get<HTMLSelectElement>('live-session-plan');
  plan.value = row.nextVisit.planId;
  plan.dispatchEvent(new Event('change'));
  await openLivePacket();
  if (!lease.current()) return;
  const target = [
    ...get('session-packet-visits').querySelectorAll<HTMLButtonElement>('button'),
  ].find((button) => button.dataset.visitId === row.nextVisit.visitId);
  target?.click();
}
async function startOpeningFromResume(
  row: SessionResumeVisit,
  readAloud: string | null,
  lease: ResumeLease,
) {
  if (!(await checkedResumeVisit(row, lease))) return;
  lease.dismiss();
  if (!(await lease.focus(row.sceneId))) return;
  const originalText = sceneDraft?.readAloud ?? '';
  if (
    !(await startLiveSession(undefined, lease.current)) ||
    !lease.current() ||
    data?.scene?.id !== row.sceneId
  )
    return;
  if ((sceneDraft?.readAloud ?? '') !== originalText)
    throw new Error(
      'Spielabend läuft. Neuere eigene Prosa bleibt erhalten; den Eröffnungstext erneut ausdrücklich wählen.',
    );
  if (readAloud) {
    useKnowledgeReadAloud(readAloud, row.nextVisit.title || 'Eröffnung');
    if (!(await flushLive()))
      throw new Error('Spielabend läuft, aber der Eröffnungstext ist noch nicht gespeichert.');
    if (!lease.current()) return;
  }
  const plan = get<HTMLSelectElement>('live-session-plan');
  plan.value = row.nextVisit.planId;
  plan.dispatchEvent(new Event('change'));
  await openLivePacket();
  if (!lease.current()) return;
  const target = [
    ...get('session-packet-visits').querySelectorAll<HTMLButtonElement>('button'),
  ].find((button) => button.dataset.visitId === row.nextVisit.visitId);
  target?.click();
  get('live-session-result').textContent =
    'Spielabend begonnen. Die Eröffnung liegt am Szenentisch bereit; Spielerfreigabe und Besuchsübernahme bleiben getrennt.';
}
async function openWorldFromResume(
  sceneId: string,
  target: 'travel' | 'agenda',
  lease: ResumeLease,
) {
  lease.dismiss();
  if (!(await lease.focus(sceneId))) return;
  if (target === 'agenda') get<HTMLButtonElement>('live-agenda-open').click();
  else {
    const button = get<HTMLButtonElement>('live-travel-toggle');
    if (button.getAttribute('aria-expanded') !== 'true') button.click();
    get('live-world-panel').scrollIntoView({ block: 'start' });
  }
}

async function openReadinessFromResume(
  sceneId: string,
  target: 'party' | 'rest',
  lease: ResumeLease,
) {
  lease.dismiss();
  if (!(await lease.focus(sceneId))) return;
  if (target === 'rest') await openPartyRest(sceneId);
  else {
    const reference = get('live-party-reference');
    reference.scrollIntoView({ block: 'start' });
    reference.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }
}

function renderSessionResume(
  audit: SessionCloseAudit,
  prep: SessionResumePrep,
  auditProblem?: string,
) {
  const dialog = get<HTMLDialogElement>('live-session-resume-dialog'),
    owner = context,
    token = owner?.token,
    campaignId = owner?.campaign.id,
    run = sessionResumeRequest;
  const signature = () =>
    JSON.stringify([
      data?.focusId,
      data?.focusRevision,
      data?.scene?.id,
      data?.scene?.membershipRevision,
      data?.scene?.locationId,
      data?.scene?.clock,
    ]);
  const shown = signature();
  let busy = false;
  const bind = (
    button: HTMLButtonElement,
    action: (lease: ResumeLease) => Promise<unknown>,
    targetId = data?.scene?.id,
  ) => {
    const targetSignature = () => {
        const scene = data?.scenes.find((scene) => scene.id === targetId);
        return JSON.stringify(
          scene
            ? [
                scene.id,
                scene.title,
                scene.primary,
                scene.members,
                scene.membershipRevision,
                scene.clock.epochId,
                scene.clock.revision,
                scene.clock.instantMs,
              ]
            : null,
        );
      },
      targetShown = targetSignature();
    button.onclick = () => {
      if (
        button.disabled ||
        busy ||
        !button.isConnected ||
        !dialog.open ||
        context !== owner ||
        context?.token !== token ||
        context?.campaign.id !== campaignId ||
        run !== sessionResumeRequest ||
        signature() !== shown ||
        targetSignature() !== targetShown
      )
        return;
      busy = true;
      button.disabled = true;
      get('live-session-resume-status').textContent = 'Die angezeigte Auswahl wird geprüft…';
      let stamp = run,
        dismissed = false,
        expected = shown;
      const alive = () =>
        context === owner &&
        context?.token === token &&
        context?.campaign.id === campaignId &&
        sessionResumeRequest === stamp;
      const current = () =>
        alive() &&
        (dismissed || dialog.open) &&
        signature() === expected &&
        targetSignature() === targetShown;
      const lease: ResumeLease = {
        current,
        dismiss: () => {
          if (!current()) return;
          stamp = ++sessionResumeRequest;
          dismissed = true;
          dialog.close();
        },
        focus: async (id) => {
          if (!current()) return false;
          if (data?.focusId !== id) {
            if (!(await changeFocus(id, current)) || !alive() || data?.focusId !== id) return false;
            expected = signature();
          }
          return current() && data?.scene?.id === id;
        },
      };
      void Promise.resolve()
        .then(() => {
          if (current()) return action(lease);
        })
        .catch((error) => {
          if (current()) {
            if (dialog.open)
              get('live-session-resume-status').textContent = (error as Error).message;
            tell((error as Error).message, true);
          }
        })
        .finally(() => {
          if (alive()) {
            busy = false;
            button.disabled = false;
          }
        });
    };
  };
  const groups = get('live-session-resume-groups'),
    readiness = get('live-session-resume-readiness'),
    masks = get('live-session-resume-masks'),
    visits = get('live-session-resume-visits'),
    narratives = get('live-session-resume-narratives'),
    worlds = get('live-session-resume-worlds');
  groups.replaceChildren();
  readiness.replaceChildren();
  masks.replaceChildren();
  visits.replaceChildren();
  narratives.replaceChildren();
  worlds.replaceChildren();
  get('live-session-resume-handoff').textContent =
    latestCompletedSessionHandoff(
      sessionChronicle?.entries ?? [],
      sessionChronicle?.latestSessionMarker,
    ) || 'Keine Übergabe aus dem letzten Spielabend.';
  for (const group of data?.scenes ?? []) {
    const card = document.createElement('article'),
      body = document.createElement('div'),
      title = document.createElement('strong'),
      facts = document.createElement('p'),
      button = document.createElement('button'),
      open = audit.masks.filter((mask) => mask.sceneId === group.id);
    title.textContent =
      (group.title || 'Unbenannte Gruppe') + (group.primary ? ' · Hauptgruppe' : '');
    facts.textContent =
      groupPeople(group.id) +
      ' · ' +
      formatSceneInstant(group.clock.instantMs) +
      (open.length
        ? ' · ' + open.length + ' laufende ' + (open.length === 1 ? 'Szene' : 'Szenen')
        : '');
    button.type = 'button';
    button.textContent = 'Spielabend hier beginnen';
    bind(
      button,
      async (lease) => {
        lease.dismiss();
        if (await lease.focus(group.id)) await startLiveSession(undefined, lease.current);
      },
      group.id,
    );
    body.append(title, facts);
    card.append(body, button);
    const details = document.createElement('details'),
      summary = document.createElement('summary'),
      briefing = document.createElement('div'),
      actions = document.createElement('div'),
      party = prep.readiness.find((r) => r.sceneId === group.id),
      world = prep.worlds.find((r) => r.sceneId === group.id),
      visit = prep.visits.find((r) => r.sceneId === group.id),
      locationId = world?.agenda.scene?.locationId ?? world?.frame.scene.locationId ?? null;
    const issues =
        (party?.characters.filter((c) => c.warning).length ?? 0) +
        open.length +
        (world?.frame.notices.length ?? 0) +
        (visit?.warnings.length ?? 0) +
        (!prep.readinessAvailable || !party?.characters.length ? 1 : 0) +
        (!world ? 1 : 0) +
        (!prep.narrativesAvailable ? 1 : 0) +
        (auditProblem ? 1 : 0),
      state = document.createElement('strong');
    state.className = issues ? 'session-resume-briefing-alert' : 'session-resume-briefing-ready';
    state.textContent =
      auditProblem ||
      !prep.readinessAvailable ||
      !world ||
      !prep.narrativesAvailable ||
      prep.problems.length
        ? 'Stand unvollständig'
        : issues
          ? issues + ' Punkte prüfen'
          : 'Startklar';
    card.append(state);
    briefing.className = 'session-resume-briefing-grid';
    card.className = 'session-resume-briefing';
    summary.textContent = 'Startbriefing anzeigen';
    details.open = group.id === data?.focusId;
    const section = (heading: string, lines: string[]) => {
      const block = document.createElement('section'),
        h = document.createElement('strong'),
        list = document.createElement('ul');
      h.textContent = heading;
      for (const text of lines) {
        const item = document.createElement('li');
        item.textContent = text;
        list.append(item);
      }
      block.append(h, list);
      briefing.append(block);
    };
    const handoff = latestCompletedSessionHandoff(
      sessionChronicle?.entries ?? [],
      sessionChronicle?.latestSessionMarker,
    );
    section('Übergabe', [handoff || 'Keine Übergabe aus dem letzten Spielabend.']);
    section(
      'Party',
      !prep.readinessAvailable
        ? ['Gruppenbereitschaft noch nicht geprüft.']
        : party?.characters.length
          ? party.characters.map((c) => c.name + ' · ' + c.health + ' · ' + c.progress)
          : ['Leere Party'],
    );
    section(
      'Weltlage',
      world
        ? [
            world.frame.date + ' · ' + (world.agenda.scene?.locationTitle || 'Ohne Ortsbindung'),
            world.frame.weather ? world.frame.weather.label : 'Kein Wetter',
            world.frame.journey ? 'Reise · ' + world.frame.journey.status : 'Keine laufende Reise.',
            ...world.agenda.items.slice(0, 3).map((i) => i.event.name + ' · ' + i.state),
            ...world.frame.notices.slice(0, 3).map((n) => 'Offene Weltentscheidung · ' + n.text),
          ]
        : ['Weltlage noch nicht geprüft.'],
    );
    const readAloud = visit?.packet?.blocks.find((b) => b.kind === 'read-aloud');
    section(
      'Einstieg',
      visit
        ? [
            visit.nextVisit.title,
            readAloud?.text || 'Kein vorbereiteter Vorlesetext.',
            ...visit.warnings,
          ]
        : ['Kein weiterer vorbereiteter Besuch.'],
    );
    const narratives = prep.narratives.entries.filter(
      (e) => locationId && e.view.state.locationId === locationId,
    );
    section(
      'Offene Fäden',
      !prep.narrativesAvailable
        ? ['Auftragsjournal noch nicht geprüft.']
        : narratives.length
          ? narratives.slice(0, 5).map((e) => e.note.title)
          : ['Keine offenen Aufträge oder Gerüchte an diesem Ort.'],
    );
    section(
      'Laufende Szenen',
      auditProblem
        ? ['Laufende Szenen noch nicht geprüft.']
        : open.length
          ? open.map((m) => (m.kind === 'combat' ? 'Kampf' : 'Verfolgung') + ' · ' + m.title)
          : ['Keine laufenden Kämpfe oder Verfolgungen.'],
    );
    const add = (label: string, work: (lease: ResumeLease) => Promise<unknown>) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      bind(b, work, group.id);
      actions.append(b);
    };
    if (visit) {
      add(
        readAloud ? 'Spielabend beginnen + Text in Szene' : 'Spielabend beginnen + Mappe',
        (lease) => startOpeningFromResume(visit, readAloud?.text ?? null, lease),
      );
      add('Mappe öffnen', (lease) => openPacketFromResume(visit, lease));
    }
    if (handoff.trim()) {
      const planId =
        visit?.nextVisit.planId ??
        (data?.scene?.id === group.id ? data.scene.adoption?.planId : null) ??
        sources?.selection.planId ??
        sources?.plans[0]?.id ??
        null;
      add('Einstieg aus Übergabe vorbereiten…', async (lease) => {
        lease.dismiss();
        if (!(await lease.focus(group.id))) return;
        openHandoffVisit({
          sceneTitle: group.title || 'Unbenannte Gruppe',
          recommendedPlanId: planId,
          beforeVisitId: visit?.nextVisit.visitId ?? null,
          locationId,
          locationTitle: world?.agenda.scene?.locationTitle || 'Aktueller Gruppenort',
          handoff,
          noteIds: narratives.slice(0, 20).map((entry) => entry.note.id),
          current: lease.current,
        });
      });
    }
    if (locationId)
      add('Ortsmappe öffnen', async (lease) => {
        lease.dismiss();
        if (await lease.focus(group.id)) await openLocationNotebook(locationId, lease.current);
      });
    add('Partywerte öffnen', (lease) => openReadinessFromResume(group.id, 'party', lease));
    add('Agenda öffnen', (lease) => openWorldFromResume(group.id, 'agenda', lease));
    actions.className = 'toolbar';
    details.append(summary, briefing);
    card.append(details, actions);
    groups.append(card);
  }
  for (const group of prep.readiness ?? []) {
    const card = document.createElement('article'),
      title = document.createElement('strong'),
      list = document.createElement('ul'),
      actions = document.createElement('div');
    title.textContent = group.sceneTitle;
    for (const character of group.characters) {
      const item = document.createElement('li'),
        name = document.createElement('strong'),
        facts = document.createElement('span');
      name.textContent = character.name;
      facts.textContent = character.health + ' · ' + character.progress;
      if (character.warning) item.className = 'session-resume-character-warning';
      item.append(name, facts);
      list.append(item);
    }
    if (!group.characters.length) {
      const item = document.createElement('li');
      item.className = 'caption';
      item.textContent = 'Leere Party – die Szene bleibt als Startgruppe verfügbar.';
      list.append(item);
    }
    for (const [label, target] of [
      ['Partywerte öffnen', 'party'],
      ['Rast planen…', 'rest'],
    ] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      bind(button, (lease) => openReadinessFromResume(group.sceneId, target, lease), group.sceneId);
      actions.append(button);
    }
    actions.className = 'toolbar';
    card.append(title, list, actions);
    readiness.append(card);
  }
  if (prep.readinessAvailable === false) {
    const missing = document.createElement('p');
    missing.textContent = 'Partywerte konnten noch nicht geprüft werden.';
    readiness.append(missing);
  }
  for (const mask of audit.masks) {
    const card = document.createElement('article'),
      body = document.createElement('div'),
      title = document.createElement('strong'),
      facts = document.createElement('p'),
      button = document.createElement('button');
    title.textContent = mask.title;
    facts.textContent =
      (mask.kind === 'combat' ? 'Kampf' : 'Verfolgung') +
      ' · ' +
      mask.state +
      ' · ' +
      mask.sceneTitle;
    button.type = 'button';
    button.textContent = 'Öffnen';
    bind(button, (lease) => openMaskFromResume(mask, lease), mask.sceneId);
    body.append(title, facts);
    card.append(body, button);
    masks.append(card);
  }
  if (!audit.masks.length) {
    const empty = document.createElement('p');
    empty.className = 'caption';
    empty.textContent = auditProblem
      ? 'Laufende Kämpfe und Verfolgungen konnten nicht geprüft werden: ' + auditProblem
      : 'Keine laufenden Kämpfe oder Verfolgungen.';
    masks.append(empty);
  }
  for (const sourceRow of prep.visits) {
    const row = structuredClone(sourceRow);
    const card = document.createElement('article'),
      body = document.createElement('div'),
      title = document.createElement('strong'),
      facts = document.createElement('p'),
      actions = document.createElement('div');
    card.className = 'session-resume-visit';
    title.textContent = row.nextVisit.title || 'Unbenannter Besuch';
    facts.textContent =
      (row.fallback
        ? 'Vorgeschlagener Einstieg aus „' + row.planName + '“'
        : 'Nächster vorbereiteter Besuch') +
      ' · ' +
      row.sceneTitle +
      (row.packet?.location ? ' · ' + row.packet.location : '');
    body.append(title, facts);
    card.append(body);
    const readAloud = row.packet?.blocks.find((block) => block.kind === 'read-aloud');
    if (readAloud) {
      const details = document.createElement('details'),
        summary = document.createElement('summary'),
        quote = document.createElement('blockquote'),
        heading = document.createElement('strong'),
        text = document.createElement('p');
      summary.textContent = 'Eröffnungstext aufklappen';
      heading.textContent = readAloud.heading;
      text.textContent = readAloud.text;
      quote.append(heading, text);
      details.append(summary, quote);
      card.append(details);
    } else {
      const missing = document.createElement('p');
      missing.className = 'caption';
      missing.textContent = 'Noch kein vorbereiteter Eröffnungstext.';
      card.append(missing);
    }
    if (row.packet) {
      const counts = new Map<SessionPacketVisit['blocks'][number]['kind'], number>();
      for (const block of row.packet.blocks)
        counts.set(block.kind, (counts.get(block.kind) ?? 0) + 1);
      const inventory = document.createElement('p');
      inventory.className = 'caption';
      inventory.textContent =
        [
          counts.get('gm') && counts.get('gm') + ' GM-Hinweise',
          counts.get('reference') && counts.get('reference') + ' Referenzen',
          counts.get('encounter') && counts.get('encounter') + ' Begegnungsblöcke',
          counts.get('reward') && counts.get('reward') + ' Belohnungen',
        ]
          .filter(Boolean)
          .join(' · ') || 'Keine weiteren Mappenblöcke.';
      card.append(inventory);
    }
    if (row.warnings.length) {
      const warning = document.createElement('p');
      warning.className = 'session-resume-warning';
      warning.textContent =
        row.warnings.length +
        ' offene Mappenquelle' +
        (row.warnings.length === 1 ? '' : 'n') +
        ' · ' +
        row.warnings.slice(0, 2).join(' · ');
      card.append(warning);
    }
    for (const [label, action] of [
      ['Übernahme prüfen', (lease: ResumeLease) => openVisitFromResume(row, lease)],
      ['Mappe öffnen', (lease: ResumeLease) => openPacketFromResume(row, lease)],
      [
        readAloud ? 'Spielabend beginnen + Text in Szene' : 'Spielabend beginnen + Mappe',
        (lease: ResumeLease) => startOpeningFromResume(row, readAloud?.text ?? null, lease),
      ],
    ] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      bind(button, action, row.sceneId);
      if (!row.packet || !row.packetBasis) button.disabled = true;
      if (label.startsWith('Spielabend beginnen')) button.className = 'session-resume-start';
      actions.append(button);
    }
    actions.className = 'toolbar';
    card.append(actions);
    visits.append(card);
  }
  if (!prep.visits.length) {
    const empty = document.createElement('p');
    empty.className = 'caption';
    empty.textContent = prep.problems?.length
      ? 'Vorbereitete Besuche konnten nicht vollständig geprüft werden.'
      : sources?.plans.some((plan) => plan.scenes.length)
        ? 'Alle vorbereiteten Besuche wurden für diese Gruppen abgeschlossen oder übersprungen.'
        : 'Noch kein Spielabendplan mit Besuchen vorbereitet.';
    visits.append(empty);
  }
  for (const row of prep.worlds) {
    const card = document.createElement('article'),
      heading = document.createElement('div'),
      title = document.createElement('strong'),
      facts = document.createElement('p'),
      details = document.createElement('p'),
      events = document.createElement('ul'),
      actions = document.createElement('div');
    title.textContent = row.sceneTitle;
    facts.textContent = [
      row.frame.date,
      row.agenda.scene?.locationTitle || 'Ohne Ortsbindung',
      row.frame.weather
        ? row.frame.weather.label + ' · ' + row.frame.weather.effects.temperatureC + ' °C'
        : 'Kein Wetter',
    ].join(' · ');
    const journey = row.frame.journey;
    details.textContent =
      journey && !['arrived', 'ended'].includes(journey.status)
        ? 'Reise ' +
          ({ active: 'unterwegs', paused: 'pausiert', interrupted: 'angehalten' } as const)[
            journey.status as 'active' | 'paused' | 'interrupted'
          ] +
          ' · ' +
          Math.max(0, journey.nextIndex - 1) +
          ' / ' +
          Math.max(0, journey.route.length - 1) +
          ' Abschnitte' +
          (journey.reason ? ' · ' + journey.reason : '')
        : row.frame.weather?.effects.combatNote || 'Keine laufende Reise.';
    for (const item of row.agenda.items.slice(0, 3)) {
      const li = document.createElement('li'),
        delta = String(
          BigInt(item.state === 'active' ? item.endMs : item.startMs) -
            BigInt(row.agenda.scene?.instantMs ?? '0'),
        );
      li.textContent =
        item.event.name +
        ' · ' +
        (item.state === 'active' ? 'jetzt aktiv, noch ' : 'in ') +
        agendaCountdown(row.agenda.calendar, delta);
      events.append(li);
    }
    if (!events.childElementCount) {
      const li = document.createElement('li');
      li.textContent = 'Keine Ereignisse am Gruppenort in den nächsten zwei Tagen.';
      events.append(li);
    }
    if (row.frame.notices.length) {
      const notice = document.createElement('p');
      notice.className = 'session-resume-warning';
      notice.textContent =
        row.frame.notices.length +
        ' offene ' +
        (row.frame.notices.length === 1 ? 'Weltentscheidung' : 'Weltentscheidungen') +
        ' · ' +
        row.frame.notices
          .slice(0, 2)
          .map((n) => n.text)
          .join(' · ');
      card.append(notice);
    }
    for (const [label, target] of [
      ['Reisekarte öffnen', 'travel'],
      ['Agenda öffnen', 'agenda'],
    ] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      bind(button, (lease) => openWorldFromResume(row.sceneId, target, lease), row.sceneId);
      actions.append(button);
    }
    heading.append(title, facts);
    actions.className = 'toolbar';
    card.prepend(heading, details, events);
    card.append(actions);
    worlds.append(card);
  }
  for (const entry of prep.narratives.entries.slice(0, 6)) {
    const item = document.createElement('p'),
      strong = document.createElement('strong');
    strong.textContent = entry.note.title || 'Unbenannter Auftrag';
    item.append(
      strong,
      document.createTextNode(
        ' · ' +
          (entry.note.kind === 'quest' ? 'Quest' : 'Gerücht') +
          (entry.locationName ? ' · ' + entry.locationName : ''),
      ),
    );
    narratives.append(item);
  }
  if (!prep.narratives.entries.length) {
    const empty = document.createElement('p');
    empty.className = 'caption';
    empty.textContent =
      prep.narrativesAvailable === false
        ? 'Auftragsjournal nicht verfügbar; offene Inhalte sind nicht geprüft.'
        : 'Keine offenen Quests oder Gerüchte.';
    narratives.append(empty);
  }
  get('live-session-resume-narrative-count').textContent =
    prep.narrativesAvailable === false
      ? 'Auftragsjournal konnte nicht geprüft werden.'
      : prep.narratives.counts.open + ' offene Aufträge und Gerüchte';
  get('live-session-resume-loot-status').textContent = auditProblem
    ? 'Beute konnte nicht geprüft werden: ' + auditProblem
    : audit.treasures.count
      ? audit.treasures.count +
        ' unverteilte Schatzpositionen · ' +
        audit.treasures.units +
        ' Einheiten' +
        (audit.treasures.more ? ' · weitere vorhanden' : '')
      : 'Keine unverteilte Beute auf der ersten Schatzseite.';
}
async function openSessionResume() {
  const owner = context,
    token = owner?.token,
    focus = data?.focusId,
    revision = data?.focusRevision,
    dialog = get<HTMLDialogElement>('live-session-resume-dialog');
  if (
    !owner ||
    !token ||
    !data?.scene ||
    sessionChronicleError ||
    dialog.open ||
    liveSessionRecap(sessionChronicle?.entries ?? []).open
  )
    return;
  const run = ++sessionResumeRequest,
    current = () =>
      context === owner &&
      context?.token === token &&
      run === sessionResumeRequest &&
      data?.focusId === focus &&
      data?.focusRevision === revision;
  if (!(await flushLive()) || !current()) return;
  const scenes = data!.scenes.map((scene) => ({ ...scene, clock: { ...scene.clock } }));
  dialog.showModal();
  dialog.setAttribute('aria-busy', 'true');
  get('live-session-resume-status').textContent = 'Leitungsstand wird zusammengestellt…';
  for (const id of [
    'live-session-resume-groups',
    'live-session-resume-readiness',
    'live-session-resume-masks',
    'live-session-resume-visits',
    'live-session-resume-narratives',
    'live-session-resume-worlds',
  ])
    get(id).replaceChildren();
  try {
    let auditProblem: string | undefined;
    const loadingPrep: SessionResumePrep = {
      visits: [],
      worlds: [],
      narratives: { entries: [], next: null, counts: { open: 0, closed: 0 } },
      narrativesAvailable: false,
      readiness: [],
      readinessAvailable: false,
      problems: ['Vorbereitungsquellen werden noch geladen.'],
    };
    const auditPromise = readSessionCloseAudit(token, scenes, [])
      .catch((error) => {
        auditProblem = (error as Error).message;
        return {
          masks: [],
          treasures: { count: 0, units: 0, more: false },
          xpBooked: false,
          events: 0,
        } as SessionCloseAudit;
      })
      .then((audit) => {
        if (current() && dialog.open) {
          renderSessionResume(audit, loadingPrep, auditProblem);
          get('live-session-resume-status').textContent =
            'Startgruppen verfügbar. Weitere Vorbereitungsquellen werden geladen…';
        }
        return audit;
      });
    const [audit, prep] = await Promise.all([
      auditPromise,
      readSessionResumePrep(token, scenes, () => current() && dialog.open),
    ]);
    if (!current() || !dialog.open) return;
    if (auditProblem) prep.problems.unshift('Laufstand nicht geprüft: ' + auditProblem);
    renderSessionResume(audit, prep, auditProblem);
    get('live-session-resume-status').textContent = prep.problems.length
      ? 'Einzelne Quellen fehlen: ' +
        prep.problems.slice(0, 3).join(' · ') +
        (prep.problems.length > 3
          ? ' · ' + (prep.problems.length - 3) + ' weitere fehlende Quellen'
          : '') +
        '. Gesunde Einträge bleiben verfügbar.'
      : 'Wähle eine Startgruppe oder öffne zuerst einen vorbereiteten Stand.';
  } catch (error) {
    if (current() && dialog.open)
      get('live-session-resume-status').textContent =
        'Leitungsstand konnte nicht geladen werden: ' + (error as Error).message;
  } finally {
    if (current()) dialog.setAttribute('aria-busy', 'false');
  }
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
    (sources?.notes.filter((row) => !row.trashed && row.note.kind === 'npc') ?? []).map((row) => ({
      id: row.note.id,
      title: row.note.title,
    })),
    value('running-player-npc-filter'),
  );
}
function renderGroups() {
  const select = get<HTMLSelectElement>('scene-focus');
  select.replaceChildren();
  const cards = get('group-list');
  cards.replaceChildren();
  cards.hidden = !resumed || (data?.scenes.length ?? 0) < 2;
  for (const group of data?.scenes ?? []) {
    const option = document.createElement('option');
    option.value = group.id;
    const people =
      data!.roster
        .filter((c) => c.active && c.sceneId === group.id)
        .map((c) => c.profile.name)
        .join(', ') || 'Leere Party';
    option.textContent = groupLabel(group);
    select.append(option);
    if (group.id === data?.focusId) continue;
    const button = document.createElement('button'),
      name = document.createElement('strong'),
      facts = document.createElement('small');
    name.textContent =
      (group.title || 'Unbenannte Gruppe') + (group.primary ? ' · Hauptgruppe' : '');
    facts.textContent = people + ' · ' + formatSceneInstant(group.clock.instantMs);
    button.append(name, facts);
    button.setAttribute('aria-pressed', String(data?.focusId === group.id));
    button.disabled = intentBlocked();
    button.onclick = () => {
      void (async () => {
        if (await changeFocus(group.id)) select.focus({ preventScroll: true });
      })();
    };
    cards.append(button);
  }
  select.value = data?.focusId ?? '';
  get<HTMLButtonElement>('group-move').disabled = !data?.scene?.members.length || intentBlocked();
  get('live-archives').hidden = !data?.archiveCount;
  get('live-archives').textContent = 'Frühere Gruppen ansehen (' + (data?.archiveCount ?? 0) + ')';
}
async function changeFocus(id: string, current: () => boolean = () => true) {
  const token = context?.token,
    revision = data?.focusRevision,
    combat = get('combat-panel'),
    bounds = combat.getBoundingClientRect?.();
  const atCombat =
    !combat.hidden &&
    bounds &&
    Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0) > window.innerHeight / 2;
  if (
    !current() ||
    revision === null ||
    revision === undefined ||
    !(await flushLive()) ||
    context?.token !== token ||
    !current()
  ) {
    if (current()) get<HTMLSelectElement>('scene-focus').value = data?.focusId ?? '';
    return false;
  }
  if (await execute({ kind: 'focus', sceneId: id, expectedRevision: revision })) {
    (atCombat ? combat : get('live-workspace')).scrollIntoView?.({ block: 'start' });
    return true;
  }
  return false;
}
function renderTimePreview() {
  const scene = data?.scene,
    w = context,
    n = ++timePreviewRequest;
  manualTimePreview = null;
  get<HTMLButtonElement>('time-advance').disabled = true;
  if (!scene || !w) return;
  const amount = value('time-amount'),
    unit = value('time-unit'),
    units: Record<string, 'second' | 'minute' | 'hour' | 'day'> = {
      seconds: 'second',
      minutes: 'minute',
      hours: 'hour',
      days: 'day',
    };
  get('time-preview').textContent = 'Kalenderzeit wird berechnet…';
  void window.campaign
    .previewTime(w.token, {
      sceneId: scene.id,
      kind: 'duration',
      amount,
      unit: units[unit]!,
      reason: value('time-reason'),
    })
    .then((r) => {
      if (
        context?.token !== w.token ||
        data?.scene?.id !== scene.id ||
        n !== timePreviewRequest ||
        amount !== value('time-amount') ||
        unit !== value('time-unit')
      )
        return;
      if (!r.ok) throw new Error(r.error);
      manualTimePreview = r.value;
      clockCalendar = r.value.calendar;
      get('time-preview').textContent = 'Danach: ' + calendarDate(r.value.calendar, r.value.to);
      get('live-clock').textContent =
        'Seit Kampagnenbeginn: ' + formatInstant(r.value.from, r.value.calendar.daySeconds);
      get<HTMLButtonElement>('time-advance').disabled = intentBlocked();
      chaseContext(
        context,
        resumed ? (data?.scene ?? null) : null,
        data?.roster ?? [],
        formatSceneInstant(r.value.from),
      );
      renderGroups();
    })
    .catch((error) => {
      if (context?.token === w.token && n === timePreviewRequest)
        get('time-preview').textContent = error.message;
    });
}

function render() {
  get('live-empty').hidden = !!data;
  get('live-workspace').hidden = !data;
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
export function initLive(
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
  sessionResumeButton = document.createElement('button');
  sessionResumeButton.id = 'live-session-resume';
  sessionResumeButton.type = 'button';
  sessionResumeButton.textContent = 'Nächsten Abend vorbereiten…';
  get('live-session-start').after(sessionResumeButton);
  sessionResumeButton.onclick = () => void openSessionResume();
  const resumeDialog = document.createElement('dialog');
  resumeDialog.id = 'live-session-resume-dialog';
  resumeDialog.innerHTML =
    '<div class="toolbar"><h2>Nächsten Spielabend aufnehmen</h2><button id="live-session-resume-x" type="button">Schließen</button></div><p id="live-session-resume-status" role="status"></p><section class="session-resume-handoff"><h3>Letzte Übergabe</h3><p id="live-session-resume-handoff"></p></section><section><h3>Startbriefings</h3><p class="caption">Pro Gruppe: Übergabe, Party, Weltlage, offene Fäden und Eröffnung.</p><div id="live-session-resume-groups"></div></section><section><h3>Gruppenbereitschaft</h3><div id="live-session-resume-readiness"></div></section><section><h3>Weltlage der Gruppen</h3><div id="live-session-resume-worlds"></div></section><section><h3>Nächste vorbereitete Besuche</h3><div id="live-session-resume-visits"></div></section><section><h3>Laufende Szenen</h3><div id="live-session-resume-masks"></div></section><section class="session-resume-narrative"><div class="toolbar"><div><h3>Offene Aufträge und Gerüchte</h3><p id="live-session-resume-narrative-count"></p></div><button id="live-session-resume-narrative-open" type="button">Auftragsjournal öffnen…</button></div><div id="live-session-resume-narratives"></div></section><section class="session-close-check"><div><h3>Beute</h3><p id="live-session-resume-loot-status"></p></div><button id="live-session-resume-loot" type="button">Beute verteilen…</button></section><section class="session-close-check"><div><h3>Partyfortschritt</h3><p>XP, Tagesbelastung und Empfänger vor dem Start prüfen.</p></div><button id="live-session-resume-xp" type="button">XP abrechnen…</button></section><div class="toolbar"><span class="grow"></span><button id="live-session-resume-close" type="button">Schließen</button></div>';
  document.body.append(resumeDialog);
  initHandoffVisitDialog();
  for (const id of ['live-session-resume-x', 'live-session-resume-close'])
    get<HTMLButtonElement>(id).onclick = () => {
      sessionResumeRequest++;
      resumeDialog.close();
    };
  resumeDialog.addEventListener('cancel', () => sessionResumeRequest++);
  get('live-session-resume-loot').onclick = () => {
    sessionResumeRequest++;
    resumeDialog.close();
    void openTreasureDistribution(undefined, data?.scene?.id).catch((error) =>
      tell(error.message, true),
    );
  };
  get('live-session-resume-xp').onclick = () => {
    sessionResumeRequest++;
    resumeDialog.close();
    const popover = get<HTMLElement>('party-popover');
    if (!popover.matches(':popover-open')) popover.showPopover();
    get<HTMLButtonElement>('party-award-open').click();
  };
  get('live-session-resume-narrative-open').onclick = () => {
    sessionResumeRequest++;
    resumeDialog.close();
    void openNarrativeJournal().catch((error) => tell(error.message, true));
  };
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
        data?.scene?.id !== sceneId ||
        data.scene.adoption?.id !== adoptionId
      )
        return false;
      const ack = await execute({
        kind: 'visit-outcome',
        sceneId,
        adoptionId,
        expectedRevision: data.scene.revision,
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
    () => (context && data?.scene && resumed ? { workspace: context, scene: data.scene } : null),
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
    () => (context && data?.scene && resumed ? { workspace: context, scene: data.scene } : null),
    flushLive,
    useLiveReferenceReadAloud,
    openKnowledgeNote,
  );
  liveGenerator = new LiveEncounterGenerator(
    status,
    () => (context && data?.scene && resumed ? { workspace: context, live: data } : null),
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
        id = data?.scene?.id;
      if (!id || !(await flushLive()) || context?.token !== token || data?.scene?.id !== id) return;
      await openTreasureDistribution(undefined, id);
    })().catch((e) => tell(e.message, true));
  const closeDialog = document.createElement('dialog');
  closeDialog.id = 'live-session-close-dialog';
  closeDialog.innerHTML =
    '<div class="toolbar"><h2>Spielabend abschließen</h2><button id="live-session-close-x" type="button">Schließen</button></div><p id="live-session-close-status" role="status"></p><p id="live-session-close-facts" class="session-close-facts"></p><section><h3>Laufende Szenen</h3><div id="live-session-close-masks"></div></section><section class="session-close-check"><div><h3>Spielabend-XP</h3><p id="live-session-close-xp-status"></p></div><button id="live-session-close-xp" type="button">XP abrechnen…</button></section><section class="session-close-check"><div><h3>Beute</h3><p id="live-session-close-loot-status"></p></div><button id="live-session-close-loot" type="button">Beute verteilen…</button></section><section class="session-close-suggestion"><div class="toolbar"><h3>Vorschlag für den nächsten Einstieg</h3><button id="live-session-close-use-suggestion" type="button">Vorschlag übernehmen</button></div><pre id="live-session-close-suggestion"></pre></section><p id="live-session-close-draft-status" class="caption" role="status"></p><button id="live-session-close-draft-retry" type="button" hidden>Eigene Fassung erneut sichern…</button><label>Rückblick<textarea id="live-session-close-summary" maxlength="10000" placeholder="Was ist heute geschehen?"></textarea></label><label>Nächster Spielabend<textarea id="live-session-close-handoff" maxlength="10000" placeholder="Einstieg, offene Szenen und Vorbereitung"></textarea></label><p class="caption">Offene Kämpfe, Verfolgungen und Beute bleiben nach dem Abschluss erhalten.</p><div class="toolbar"><button id="live-session-close-refresh" type="button">Erneut prüfen</button><span class="grow"></span><button id="live-session-close-cancel" type="button">Abbrechen</button><button id="live-session-close-confirm" type="button">Spielabend jetzt beenden</button><button id="live-session-close-prepare" type="button">Beenden + Einstieg vorbereiten…</button></div>';
  document.body.append(closeDialog);
  for (const id of ['live-session-close-x', 'live-session-close-cancel'])
    get<HTMLButtonElement>(id).onclick = () => {
      leaveSessionCloseReview();
    };
  get('live-session-close-refresh').onclick = () => void loadSessionCloseReview(true);
  get('live-session-close-confirm').onclick = () => void finishLiveSession();
  get('live-session-close-prepare').onclick = () => void finishLiveSession(true);
  get('live-session-close-xp').onclick = () => {
    if (!currentSessionCloseReview()) return;
    leaveSessionCloseReview();
    const popover = get<HTMLElement>('party-popover');
    if (!popover.matches(':popover-open')) popover.showPopover();
    get<HTMLButtonElement>('party-award-open').click();
  };
  get('live-session-close-loot').onclick = () => {
    if (!currentSessionCloseReview()) return;
    leaveSessionCloseReview();
    void openTreasureDistribution(undefined, data?.scene?.id).catch((error) =>
      tell(error.message, true),
    );
  };
  get('live-session-close-use-suggestion').onclick = () => {
    if (
      !currentSessionCloseReview() ||
      closeDialog.getAttribute('aria-busy') === 'true' ||
      get<HTMLButtonElement>('live-session-close-use-suggestion').disabled
    )
      return;
    get<HTMLTextAreaElement>('live-session-close-handoff').value =
      get('live-session-close-suggestion').textContent ?? '';
    queueRecapSave();
  };
  closeDialog.addEventListener('cancel', leaveSessionCloseReview);
  for (const id of [
    'live-session-summary',
    'live-session-handoff',
    'live-session-close-summary',
    'live-session-close-handoff',
  ])
    get(id).addEventListener('input', () => queueRecapSave());
  for (const id of ['live-session-draft-retry', 'live-session-close-draft-retry'])
    get(id).onclick = () => void retryRecapSave();
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
      if (
        !data?.scene ||
        data.scene.id !== scene.id ||
        data.scene.clock.epochId !== scene.clock.epochId ||
        data.scene.clock.revision > scene.clock.revision
      )
        return;
      data.scene.clock = scene.clock;
      for (const row of data.scenes) if (row.id === scene.id) row.clock = scene.clock;
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
      if (!characterDraft) return;
      const text = value(id),
        profile: CharacterProfile = { ...characterDraft.profile };
      if (field === 'name') profile.name = text;
      else if (!text) delete profile[field];
      else if (field === 'armorClass' || field === 'passivePerception' || field === 'speedFeet')
        profile[field] = Number(text);
      else profile[field] = text;
      characterDraft = { ...characterDraft, profile };
      schedule();
    };
    get(id).onblur = () => {
      if (!composing) void flushLive();
    };
  }
  get('character-toggle').onclick = () => {
    void (async () => {
      const token = context?.token,
        id = selected;
      if (!(await flushLive()) || context?.token !== token || selected !== id || !data) return;
      const c = originalCharacter();
      if (!c) return;
      await execute({
        kind: 'membership',
        characterId: c.id,
        expectedRevision: c.membershipRevision,
        expectedRosterRevision: data.rosterRevision,
        active: !c.active,
        targetSceneId: c.active ? null : data.focusId,
        expectedFocusRevision: data.focusRevision,
      });
    })();
  };
  get('live-continue').onclick = () => {
    void (async () => {
      const token = context?.token;
      if (!(await flushLive()) || context?.token !== token || !data) return;
      if (await execute({ kind: 'initialize', expectedRosterRevision: data.rosterRevision })) {
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
      if (sceneDraft) {
        const text = value(id),
          before = data?.scene?.[field];
        sceneDraft = {
          ...sceneDraft,
          [field]: before !== undefined && text === before.replace(/\r\n?/g, '\n') ? before : text,
        };
        schedule();
      }
    };
    get(id).onblur = () => {
      if (!composing) void flushLive();
    };
  }
  get('running-location').onchange = () => {
    if (sceneDraft) {
      sceneDraft = { ...sceneDraft, locationId: value('running-location') || null };
      renderScenePlace();
      schedule();
    }
  };
  get('running-open-location').onclick = () => {
    void (async () => {
      const token = context?.token;
      if ((await flushLive()) && token === context?.token && sceneDraft?.locationId)
        await openLocation(sceneDraft.locationId);
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
        locationId = sceneDraft?.locationId;
      if (!focus || !locationId) return;
      if ((await flushLive()) && context?.token === token && sceneDraft?.locationId === locationId)
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
  get('live-knowledge-search').oninput = renderLiveKnowledge;
  get('live-passive-form').onsubmit = (event) => {
    event.preventDefault();
    renderPassivePerception();
  };
  get('live-moment-open').onclick = () => {
    const panel = get<HTMLDetailsElement>('live-moment-panel');
    panel.open = true;
    panel.scrollIntoView?.({ block: 'center' });
    get<HTMLInputElement>('live-moment-title').focus({ preventScroll: true });
  };
  get('live-moment-retry').onclick = () => void retryMomentDraft();
  get('live-moment-form').addEventListener('input', () => {
    captureMomentDraft();
    if (momentOwner && !momentOwner.publishing) void saveMomentWork(momentOwner);
  });
  get('live-moment-form').onsubmit = (event) => {
    event.preventDefault();
    const token = context?.token,
      sceneId = data?.scene?.id,
      focusRevision = data?.focusRevision,
      draft = currentLiveMomentDraft(),
      { category, title, summary, followUp } = draft,
      scene = data?.scene,
      plan = scene?.adoption?.planId || value('adoption-plan') || sources?.selection.planId || null,
      narrativeFollowUp = followUp === 'quest' || followUp === 'rumor' ? followUp : null;
    const current = () =>
      context?.token === token &&
      data?.scene?.id === sceneId &&
      data?.focusRevision === focusRevision;
    if (
      !token ||
      !sceneId ||
      momentOwner?.sceneId !== sceneId ||
      momentOwner.readError ||
      momentOwner.publishing
    )
      return;
    const publishingWork = momentOwner;
    publishingWork.publishing = true;
    void (async () => {
      try {
        if (!(await flushLive()) || !current()) return;
        const followUpRef = narrativeFollowUp
          ? { kind: narrativeFollowUp, id: crypto.randomUUID() }
          : null;
        const ack = await execute({
          kind: 'live-moment',
          sceneId,
          expectedRevision: data!.scene!.revision,
          category,
          title,
          summary,
          draft,
          followUp: followUpRef,
        });
        if (!ack) return;
        const work = momentWorks.get(sceneId);
        if (work && sameLiveMomentDraft(work.basis, draft) && !ack.scene?.momentDraft)
          work.basis = null;
        if (!current()) return;
        let refreshProblem = false;
        if (narrativeFollowUp) void reloadLiveSources();
        const unchanged = canClearSavedLiveMoment(
          sceneId,
          momentOwner?.sceneId ?? null,
          draft,
          currentLiveMomentDraft(),
        );
        if (unchanged) {
          writeLiveMomentDraft(emptyLiveMomentDraft());
          captureMomentDraft();
          showMomentDraftState();
          if (followUp !== 'deadline' && followUp !== 'visit')
            get<HTMLInputElement>('live-moment-title').focus();
        }
        if ((followUp === 'deadline' || followUp === 'visit') && scene && current())
          try {
            const location = scene.locationId
              ? {
                  id: scene.locationId,
                  title:
                    sources?.locations.find((row) => row.document.id === scene.locationId)?.document
                      .name ?? 'Aktueller Gruppenort',
                }
              : null;
            if (followUp === 'deadline')
              await openMomentDeadline({ title, summary, location }, current);
            else
              await openMomentVisit(
                plan,
                { title, notes: summary, locationId: scene.locationId },
                current,
              );
          } catch {
            refreshProblem = true;
          }
        if (current()) {
          const result = get('live-moment-result');
          result.textContent = liveMomentSavedMessage(followUp, unchanged, refreshProblem);
          if (followUpRef) {
            const open = document.createElement('button');
            open.type = 'button';
            open.id = 'live-moment-follow-up-open';
            open.textContent = followUpRef.kind === 'quest' ? 'Quest öffnen…' : 'Gerücht öffnen…';
            const valid = () => current() && open.isConnected && result.contains(open);
            open.onclick = () => {
              if (!valid() || open.disabled) return;
              open.disabled = true;
              void openKnowledgeNote(followUpRef.id, valid)
                .catch((error) => {
                  if (valid()) tell((error as Error).message, true);
                })
                .finally(() => {
                  if (valid()) open.disabled = false;
                });
            };
            result.append(document.createTextNode(' '), open);
          }
        }
      } catch (error) {
        if (current()) tell((error as Error).message, true);
      } finally {
        publishingWork.publishing = false;
        if (publishingWork.dirty && !publishingWork.error) void saveMomentWork(publishingWork);
      }
    })();
  };
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
      const pending = failedState.value,
        command = pending?.command,
        token = context?.token;
      if (!pending || !command || !token) return;
      try {
        const result = unwrap(await window.campaign.liveStatus(command, token));
        if (context?.token !== token || failedState.value !== pending) return;
        if (result.targetChanged) {
          tell(
            result.receipt
              ? 'Speicherung bestätigt, inzwischen liegt ein neuerer Zielstand vor. Entwurf bleibt offen; vor dem Aktualisieren eigenen Text sichern.'
              : 'Konflikt bestätigt. Entwurf bleibt offen; vor dem Aktualisieren eigenen Text sichern.',
            true,
          );
          return;
        }
        if (result.receipt)
          mergeAck(
            {
              ...result.receipt,
              ...(result.currentScene ? { scene: result.currentScene } : {}),
              ...(result.currentCharacter ? { character: result.currentCharacter } : {}),
            },
            command.action,
            pending.submittedProfile,
          );
        blocked = false;
        failedState.value = null;
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
      blocked = false;
      failedState.value = null;
      characterDraft = null;
      sceneDraft = null;
      get('live-reconcile').hidden = true;
      get('live-refresh').hidden = true;
      await openLive();
      tell('Gespeicherter Sitzungsstand geöffnet. Entwurf verworfen.');
    })();
  };
  get('live').addEventListener('compositionstart', () => {
    composing = true;
    if (timer) clearTimeout(timer);
  });
  get('live').addEventListener('compositionend', () => {
    composing = false;
    schedule();
  });
  for (const id of ['character-dialog', 'adoption-dialog', 'move-dialog'])
    get<HTMLDialogElement>(id).addEventListener('cancel', (event) => {
      if (requestWork.value) event.preventDefault();
    });
}
let scenePreparationRequest = 0,
  nextVisit: { planId: string; planRevision: number; visitId: string; title: string } | null = null;
let openTreasure: ((id: string) => Promise<void>) | null = null;
export function setTreasureNavigation(open: (id: string) => Promise<void>) {
  openTreasure = open;
}
let openGroup: ((id: string, stillCurrent?: () => boolean) => Promise<void>) | null = null;
export function setNpcNavigation(
  edit: NonNullable<typeof npcNavigation>,
  autonomy: NonNullable<typeof npcAutonomyNavigation>,
  places?: NonNullable<typeof npcPlacesNavigation>,
) {
  npcNavigation = edit;
  npcAutonomyNavigation = autonomy;
  npcPlacesNavigation = places ?? null;
}
export function setGroupNavigation(
  fn: (id: string, stillCurrent?: () => boolean) => Promise<void>,
) {
  openGroup = fn;
}
export async function refreshScenePreparation() {
  if (!context || !data?.scene || !resumed) return;
  const token = context.token,
    id = data.scene.id,
    request = ++scenePreparationRequest;
  const current = () =>
    context?.token === token && data?.scene?.id === id && request === scenePreparationRequest;
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
      const selected = new Set(
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
        box.checked = selected.has(actor.id);
        box.disabled = actor.hp <= 0 || actor.unavailable || !!actor.defeated;
        box.onchange = () => {
          if (box.checked) selected.add(actor.id);
          else selected.delete(actor.id);
          button.disabled = !selected.size;
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
      button.disabled = !selected.size;
      button.onclick = () => {
        void (async () => {
          if ((await flushLive()) && current())
            await prepareWorldGroup(group, [...selected], current);
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
    if (context?.token === token && data?.scene?.id === id && request === scenePreparationRequest)
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
  get('move-all').onclick = () => {
    for (const box of get('move-members').querySelectorAll<HTMLInputElement>('input'))
      box.checked = true;
  };
  get('move-target').onchange = renderPartyMoveTime;
  get('move-cancel').onclick = () => {
    moveBasis = null;
    get<HTMLDialogElement>('move-dialog').close();
  };
  get('move-form').onsubmit = (event) => {
    event.preventDefault();
    void (async () => {
      const basis = moveBasis;
      if (!basis) return;
      const memberIds = [
        ...get('move-members').querySelectorAll<HTMLInputElement>('input:checked'),
      ].map((box) => box.value);
      if (!memberIds.length) {
        tell('Wähle die Figuren aus, die ihre Gruppe wechseln.', true);
        return;
      }
      const targetId = value('move-target'),
        target = moveTargets.find((g) => g.id === targetId);
      const action: Extract<LiveAction, { kind: 'move' }> = {
        ...basis,
        memberIds,
        target:
          targetId && target
            ? {
                kind: 'existing',
                sceneId: target.id,
                expectedMembershipRevision: target.membershipRevision,
                expectedClockRevision: target.clock.revision,
              }
            : {
                kind: 'new',
                title: value('move-title'),
                expectedContentRevision: Number(get('move-title').dataset.contentRevision),
              },
      };
      if (await execute(action)) {
        moveBasis = null;
        get<HTMLDialogElement>('move-dialog').close();
      }
    })();
  };
  for (const id of ['time-amount', 'time-unit'])
    get(id).addEventListener('input', renderTimePreview);
  get('time-reason').addEventListener('input', renderTimePreview);
  get('time-form').onsubmit = (event) => {
    event.preventDefault();
    void (async () => {
      const p = manualTimePreview,
        token = context?.token;
      if (
        !p ||
        !token ||
        !data?.scene ||
        p.sceneId !== data.scene.id ||
        !(await flushLive()) ||
        context?.token !== token
      )
        return;
      manualTimePreview = null;
      if (!(await execute(p.action))) renderTimePreview();
    })();
  };
  timeNavigator = new TimeNavigator(
    tell,
    () => (context && data?.scene && resumed ? { workspace: context, scene: data.scene } : null),
    flushLive,
    async (action, stillCurrent) => {
      const token = context?.token;
      if (
        !token ||
        !(await flushLive()) ||
        !stillCurrent() ||
        context?.token !== token ||
        data?.scene?.id !== action.sceneId
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
export async function runPartyLive(
  token: string,
  action: LiveAction,
  stillCurrent: () => boolean = () => true,
) {
  if (!stillCurrent() || context?.token !== token || !(await flushLive()))
    throw new Error(
      'Offene Eingaben zuerst speichern oder den Speicherstatus im Spieltisch klären.',
    );
  if (!data) await openLive();
  if (!stillCurrent() || context?.token !== token || !data)
    throw new Error('Party oder Auswahl nicht mehr verfügbar.');
  const ack = await execute(action);
  if (!ack)
    throw new Error(
      'Änderung nicht bestätigt. Speicherstatus im Spieltisch prüfen; Eingabe bleibt erhalten.',
    );
  return ack;
}
export async function runPartyProgress(
  token: string,
  action: import('./progression').ProgressAction,
  stillCurrent: () => boolean = () => true,
) {
  if (!stillCurrent() || context?.token !== token || !(await flushLive()))
    throw new Error('Offene Eingaben zuerst speichern oder den Buchungsstatus klären.');
  if (!data) await openLive();
  if (!stillCurrent() || context?.token !== token || !data)
    throw new Error('Party nicht verfügbar oder Auswahl inzwischen geschlossen.');
  progressionContext(context, data, selected);
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
    sceneId = data?.scene?.id,
    focusRevision = data?.focusRevision;
  const current = () =>
    stillCurrent() &&
    token === context?.token &&
    data?.scene?.id === sceneId &&
    data?.focusRevision === focusRevision;
  if (!(await flushLive()) || !current() || !data?.scene || !resumed) return false;
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
    sceneId: data.scene.id,
    expectedRevision: data.scene.revision,
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
    s = data?.scene,
    p = get<HTMLSelectElement>('live-session-plan').value,
    focus = data?.focusRevision;
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
    data?.scene?.id === sceneId &&
    data.focusRevision === focus &&
    data.scene.membershipRevision === membership &&
    data.scene.adoption?.id === adoptionId &&
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
      const before = sceneDraft?.readAloud;
      if (!current() || !active() || !(await flushLive()) || !current() || !active()) return;
      if (sceneDraft?.readAloud !== before) {
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
      if (data?.scene?.adoption?.planId !== p || data.scene.adoption.visitId !== visitId)
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
      if (momentOwner) void saveMomentWork(momentOwner);
      get('live-party-panel').hidden = false;
      get<HTMLButtonElement>('session-packet-party-toggle').setAttribute('aria-pressed', 'true');
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

export async function openTimeNavigator(
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
  if (expectedSceneId && data?.scene?.id !== expectedSceneId)
    throw new Error('Reisegruppe gewechselt. Reise neu öffnen.');
  await timeNavigator.open(target);
}
export async function openTravelRest(sceneId: string) {
  if (!(await ensureLiveRuntime()) || !(await flushLive())) return;
  if (data?.scene?.id !== sceneId) throw new Error('Reisegruppe gewechselt. Reise neu öffnen.');
  await openPartyRest(sceneId);
}

async function recoverTimeWrite() {
  const pending = failedState.value,
    command = pending?.command,
    token = context?.token;
  if (!command) return !blocked;
  if (
    !token ||
    command.action.kind !== 'advance-clock' ||
    command.action.calendarVersion !== 'campaign-calendar-v1'
  ) {
    tell('Anderen offenen Live-Auftrag zuerst im Leitbereich klären.', true);
    return false;
  }
  try {
    const result = unwrap(await window.campaign.liveStatus(command, token));
    if (context?.token !== token || failedState.value !== pending) return false;
    if (result.receipt)
      mergeAck(
        { ...result.receipt, ...(result.currentScene ? { scene: result.currentScene } : {}) },
        command.action,
      );
    blocked = false;
    failedState.value = null;
    manualTimePreview = null;
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
    sceneId = data?.scene?.id,
    focusRevision = data?.focusRevision,
    summary = marker === 'end' ? (submittedSummary ?? recapFields(false).summary) : '',
    handoff = marker === 'end' ? (submittedHandoff ?? recapFields(false).handoff) : '';
  const current = () =>
    stillCurrent() &&
    context?.token === token &&
    data?.scene?.id === sceneId &&
    data?.focusRevision === focusRevision;
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
    const recap = marker === 'end' ? recapDrafts.get(owner.campaign.id) : undefined;
    if (recap) recap.publishing = true;
    let ack: LiveAck | null;
    try {
      ack = await execute({
        kind: 'session-marker',
        sceneId,
        expectedRevision: data!.scene!.revision,
        marker,
        summary,
        handoff,
      });
    } finally {
      if (recap) {
        recap.publishing = false;
        if (recap.dirty && !blocked) void saveRecap(owner, recap);
      }
    }
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

function leaveSessionCloseReview() {
  get<HTMLTextAreaElement>('live-session-summary').value = value('live-session-close-summary');
  get<HTMLTextAreaElement>('live-session-handoff').value = value('live-session-close-handoff');
  sessionCloseOpeningBasis = null;
  sessionCloseRequest++;
  get<HTMLDialogElement>('live-session-close-dialog').close();
}

export async function openPartyMove(
  ownerToken?: string,
  ownerSceneId?: string,
  stillCurrent: () => boolean = () => true,
) {
  const token = ownerToken ?? context?.token;
  if (ownerToken && context?.token !== ownerToken) throw new Error('Kampagne gewechselt.');
  const expectedScene = ownerSceneId ?? data?.scene?.id;
  if (!stillCurrent() || !(await flushLive()) || context?.token !== token)
    throw new Error('Offene Eingaben oder Kampagnenwechsel. Spieltisch prüfen.');
  await openLive();
  if (
    !stillCurrent() ||
    context?.token !== token ||
    !data?.scene ||
    data.focusRevision === null ||
    expectedScene !== data.scene.id
  )
    throw new Error('Szenenfokus geändert oder keine laufende Sitzung. Auswahl erneut öffnen.');
  const source = data.scene;
  moveBasis = {
    kind: 'move',
    sceneId: source.id,
    expectedRosterRevision: data.rosterRevision,
    expectedFocusRevision: data.focusRevision,
    expectedSceneMembershipRevision: source.membershipRevision,
    expectedClockRevision: source.clock.revision,
  };
  const labels = partySceneLabels(data);
  moveTargets = structuredClone(data.scenes);
  get('move-members').replaceChildren();
  get('move-source').textContent =
    (labels.get(source.id) ?? groupLabel({ ...source, primary: source.id === data.primaryId })) +
    ' · ' +
    formatSceneInstant(source.clock.instantMs);
  for (const id of source.members) {
    const c = data.roster.find((c) => c.id === id)!;
    const label = document.createElement('label'),
      box = document.createElement('input');
    box.type = 'checkbox';
    box.value = id;
    label.append(box, document.createTextNode(' ' + c.profile.name));
    get('move-members').append(label);
  }
  const select = get<HTMLSelectElement>('move-target');
  select.replaceChildren();
  const fresh = document.createElement('option');
  fresh.value = '';
  fresh.textContent = 'Neue unabhängige Gruppe';
  select.append(fresh);
  for (const g of moveTargets.filter((g) => g.id !== source.id)) {
    const option = document.createElement('option');
    option.value = g.id;
    option.textContent =
      (labels.get(g.id) ?? groupLabel(g)) + ' · ' + formatSceneInstant(g.clock.instantMs);
    select.append(option);
  }
  select.value = '';
  get('move-new-fields').hidden = false;
  get<HTMLInputElement>('move-title').value = '';
  renderPartyMoveTime();
  get<HTMLDialogElement>('move-dialog').showModal();
  get('move-title').dataset.clockRevision = String(source.clock.revision);
  get('move-title').dataset.contentRevision = String(source.revision);
  return true;
}

function renderPartyMoveTime() {
  const target = moveTargets.find((scene) => scene.id === value('move-target'));
  get('move-new-fields').hidden = !!target;
  get('move-time').hidden = !target;
  get('move-confirm').textContent = target ? 'Zur Zielzeit verschieben' : 'Figuren verschieben';
  const source = moveTargets.find((scene) => scene.id === moveBasis?.sceneId);
  if (!target || !source) return;
  get('move-time').textContent =
    'Ausgangsgruppe: ' +
    formatSceneInstant(source.clock.instantMs) +
    '. Zielgruppe: ' +
    formatSceneInstant(target.clock.instantMs) +
    '. Mit „Zur Zielzeit verschieben“ wechseln die gewählten Figuren zur Zeit der Zielgruppe. Beide Gruppenzeiten bleiben unverändert. Eine Rast wird dadurch nicht gebucht.';
}

editorSession.onDeactivate(() => {
  if (timer) clearTimeout(timer);
  timer = null;
});

editorSession.observeDraft(() => ({
  openInput: changed(),
  retainedDraft:
    [...momentWorks.values()].some((w) => !!w.basis) ||
    [...recapDrafts.values()].some((w) => !!w.basis),
  unresolvedCommand: !!failedState.value,
}));

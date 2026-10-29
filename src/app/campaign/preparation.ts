import { createPreparationExcerptEditor } from './preparation-excerpt-editor';
import { campaignLocalId } from '../../features/campaign/campaign-contracts';
import { newLocation } from '../../features/location/location-schema';
import type { ManualPlan } from '../../features/planner/manual-planner';
import {
  acceptNarrativeNoteReceipt,
  flushNarrative,
  prepareNarrativeLocation,
  showNarrative,
} from '../runtime/narrative-ui';
import { hasPendingCommit } from '../shared/commit-confirmation';
import type { Result, WorkspaceGeometry } from '../shared/contracts';
import { EditorSession } from '../shared/editor-session';
import { createEditorSurface } from '../shared/editor-surface';
import {
  PreparationDraftOwner,
  preparationDraftKey as draftKey,
  equalPreparationValue as equal,
  preservePreparationPlanInput as preservePlanInput,
} from './preparation-draft-owner';
import { PreparationWriteCoordinator } from './preparation-write-coordinator';
import { PreparationListView } from './preparation-list-view';
import { rawTextOffset } from '../shared/raw-text-offset';
import { NoteMergeUI } from './note-merge-ui';
import { NoteRoomUses } from './note-room-uses';
import { detachNoteSource, restoreNoteSource } from './note-thread-edit';
import { NoteThreadDialog } from './note-thread-ui';
import {
  preparationTarget,
  type Preparation,
  type PreparationChange,
  type PreparationEdit,
} from './preparation-contracts';
import { type Note } from './note-data';
import { PreparationNoteDirectory } from './preparation-note-directory';
import { packetNoteFeedback, registerPreparationPacketEditor } from './session-packet-ui';
import {
  clearSessionTimeline,
  flushSession,
  initSession,
  linkVisitNoteThread,
  sessionContext,
  sessionVisitReadAlouds,
} from './session-ui';
import { chooseTextReference } from './text-reference-picker';
const defaultPlanning = {
  initSession,
  sessionContext,
  sessionVisitReadAlouds,
  flushSession,
  clearSessionTimeline,
  linkVisitNoteThread,
};
export type PreparationHost = {
  roots: readonly HTMLElement[];
  dialogHost: HTMLElement;
  api: Window['campaign'];
  storage: Storage;
  planning?: typeof defaultPlanning;
  navigation: {
    locationNotebook: (id: string) => Promise<void>;
    roomKey: (
      id: string,
      current: () => boolean,
      restore: () => void,
      source?: {
        id: string;
        label: string;
      },
    ) => Promise<boolean>;
  };
};
export function createPreparation(host: PreparationHost) {
  const {
    initSession,
    sessionContext,
    sessionVisitReadAlouds,
    flushSession,
    clearSessionTimeline,
    linkVisitNoteThread,
  } = host.planning ?? defaultPlanning;
  const { document, get } = createEditorSurface(host.roots);
  const window = { campaign: host.api, localStorage: host.storage };
  const editorSession = new EditorSession();
  const listView = new PreparationListView({ document, get });
  const value = (id: string) => get<HTMLInputElement>(id).value;
  function showPreparationArea(plan: boolean) {
    if (plan) rememberPlanningTarget();
    get('preparation-knowledge-workspace').hidden = plan;
    get('preparation-planning-workspace').hidden = !plan;
    get('preparation-knowledge').setAttribute('aria-pressed', String(!plan));
    get('preparation-planning').setAttribute('aria-pressed', String(plan));
  }
  function showDayPreparation() {
    showPreparationArea(true);
    get<HTMLDetailsElement>('session-panel').open = true;
    get(drafts.plan ? 'session-fraction' : 'plan-create').focus();
  }
  const unwrap = <T>(result: Result<T>): T => {
    if (!result.ok) throw new Error(result.error);
    return result.value;
  };
  let context: WorkspaceGeometry | null = null;
  let preparationLoaded = false;
  const directory = new PreparationNoteDirectory();
  function usePreparation(next: Preparation, filtered = false) {
    preparationLoaded = true;
    get('preparation').inert = false;
    directory.acceptPreparation(next, filtered);
  }
  const noteRow = (id: string | null) => directory.row(id);
  // A fallback loaded behind the knowledge editor is not a chosen destination.
  let planningTarget: {
    planId: string;
    visitId: string | null;
  } | null = null;
  function rememberPlanningTarget() {
    planningTarget = selectedPlan ? { planId: selectedPlan, visitId: selectedScene } : null;
  }
  let selectedNote: string | null = null,
    selectedPlan: string | null = null,
    selectedScene: string | null = null;
  let selectedLocation: string | null = null;
  let openMap: (scopeId: string) => Promise<void>;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let composing = false;
  let sceneSearchPlan: string | null = null;
  let planningRenderedLoad = -1,
    planningOpening: {
      load: number;
      task: Promise<void>;
    } | null = null;
  let tell: (text: string, error?: boolean) => void;
  let inspectNote: ((id: string, current: () => boolean) => Promise<void>) | undefined;
  function syncSaveControl() {
    listView.save({
      open: drafts.openInput,
      blocked: writer.blocked,
      unresolved: !!writer.failedCommand,
    });
  }
  const locationNotebookOpen = host.navigation.locationNotebook;
  let roomUses: NoteRoomUses | null = null;
  let noteThread: NoteThreadDialog | null = null;
  let noteMerge: NoteMergeUI | null = null;
  const roomKeyOpen = host.navigation.roomKey;
  const originalNote = () => noteRow(selectedNote)?.note;
  const originalPlan = () => directory.preparation.plans.find((plan) => plan.id === selectedPlan);
  const originalLocation = () =>
    directory.preparation.locations.find((row) => row.document.id === selectedLocation);
  const drafts: PreparationDraftOwner = new PreparationDraftOwner({
    api: window.campaign,
    session: editorSession,
    context: () => (context ? { token: context.token, campaignId: context.campaign.id } : null),
    note: (id) => noteRow(id)?.note,
    plan: (id) => directory.preparation.plans.find((plan) => plan.id === id),
    location: (id) => directory.preparation.locations.find((row) => row.document.id === id),
    failedCommand: () => writer.failedCommand,
    restoreCommand: (command) => writer.restoreCommand(command),
    loading: (busy) => {
      get('preparation').inert = busy;
    },
    changed: () => {
      renderProblems();
      syncSaveControl();
    },
    feedback: (text, error) => tell(text, error),
  });
  const writer: PreparationWriteCoordinator = new PreparationWriteCoordinator({
    api: window.campaign,
    session: editorSession,
    drafts,
    context: () => (context ? { token: context.token, campaignId: context.campaign.id } : null),
    acceptPreparation: (next) => usePreparation(next),
    acceptPlan,
    confirmedNote: (id) => noteRow(id)?.note,
    refreshSearch: async () => {
      if (value('world-search').trim()) await reloadNoteSearch(false);
    },
    redraw: async (kind) => {
      if (kind === 'plan') await renderPlans();
      else await Promise.all([renderNotes(), renderPlans(), renderLocations()]);
    },
    afterSaved: async (change, beforeNote) => {
      if (change.kind === 'note') {
        renderNoteList();
        return acceptNarrativeNoteReceipt(context!, beforeNote!, noteRow(change.note.id)!.note);
      }
      if (change.kind === 'plan') {
        const confirmed = directory.preparation.plans.find((plan) => plan.id === change.plan.id)!;
        listView.planSaved(change.plan.id, confirmed.name);
        renderSceneList();
        renderSceneLocation();
        await sessionContext(context, drafts.plan, selectedScene, directory.preparation);
      } else {
        renderLocationList();
        renderSceneLocation();
        renderLocationMapActions();
      }
      return true;
    },
    changed: () => {
      renderProblems();
      syncSaveControl();
    },
    feedback: (text, error) => tell(text, error),
    afterResolved: async (change, current) => {
      const targetId = preparationTarget(change).id;
      const focusOnResolve = document.activeElement === get('preparation-reconcile');
      syncSaveControl();
      if (change.kind === 'plan') renderSceneList();
      if (change.kind === 'note' && change.excerpt) {
        if (selectedNote === targetId) await renderNotes();
        else {
          renderRelations();
          renderNoteList();
        }
        if (!current()) return;
      }
      if (
        change.kind === 'note-trash' &&
        selectedNote === targetId &&
        noteThread?.editorId === targetId
      ) {
        get<HTMLInputElement>('world-trash').checked = !!noteRow(targetId)?.trashed;
        await renderNotes();
        if (!current()) return;
        if (focusOnResolve)
          get('note-editor')
            .querySelector<HTMLElement>('#note-title:enabled, #note-restore:not([hidden])')
            ?.focus();
      }
    },
    mergePending: () => !!noteMerge?.hasPending(),
    composing: () => composing,
    flushNarrative,
    flushPlanning: flushSession,
    cancelAutosave: () => {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  });
  const preparationHasDrafts = () =>
    !!noteMerge?.hasPending() ||
    drafts.openInput ||
    writer.blocked ||
    !!editorSession.reading ||
    !!drafts.hasProblems;
  const loadedDraft = (kind: PreparationEdit['kind'], id: string) => drafts.load(kind, id);
  const retainOpenDrafts = () => drafts.retain();
  async function leavePreparation(): Promise<boolean> {
    // Supplementary visit/profile editors do not yet have this draft codec.
    // Their unresolved input must not be mistaken for one of the three saved owners.
    if (!(await flushSession())) return false;
    if (await flushPreparation(true)) return true;
    try {
      await retainOpenDrafts();
      tell('Offene Vorbereitung als Arbeitsentwurf gesichert.');
      return true;
    } catch (error) {
      tell('Vorbereitung kann noch nicht verlassen werden: ' + (error as Error).message, true);
      return false;
    }
  }
  /** Opening preserves this editor; explicit activation renews its generation. */
  async function ensurePreparation(workspace: WorkspaceGeometry) {
    if (context?.token === workspace.token && preparationLoaded) {
      await ensurePlanningView();
      return;
    }
    await activatePreparation(workspace);
  }
  /** A linked note can load the directory before the planning controls ever mount. */
  async function ensurePlanningView() {
    if (!context || !preparationLoaded || planningRenderedLoad === editorSession.generation) return;
    const load = editorSession.generation;
    if (planningOpening?.load === load) return planningOpening.task;
    if (!directory.preparation.plans.some((p) => p.id === selectedPlan))
      selectedPlan =
        directory.preparation.plans.find((p) => p.id === directory.preparation.selection.planId)
          ?.id ??
        directory.preparation.plans[0]?.id ??
        null;
    if (selectedScene === null) selectedScene = directory.preparation.selection.sceneId;
    const task = renderPlans();
    planningOpening = { load, task };
    try {
      await task;
    } finally {
      if (planningOpening?.task === task) planningOpening = null;
    }
  }
  async function activatePreparation(workspace: WorkspaceGeometry, load = true) {
    excerptEditor.reset();
    noteMerge?.activate(workspace.campaign.id);
    preparationLoaded = false;
    planningRenderedLoad = -1;
    planningOpening = null;
    planningTarget = null;
    noteThread?.reset();
    roomUses?.reset();
    const request = ++editorSession.generation;
    sceneSearchPlan = null;
    get<HTMLInputElement>('scene-search').value = '';
    directory.reset();
    context = workspace;
    writer.resetVisible();
    drafts.reset();
    composing = false;
    if (timer) clearTimeout(timer);
    timer = null;
    get('preparation-reconcile').hidden = true;
    get('preparation-refresh').hidden = true;
    syncSaveControl();
    selectedNote = null;
    selectedPlan = null;
    selectedScene = null;
    selectedLocation = null;
    if (!load) {
      get('preparation').inert = true;
      return;
    }
    try {
      const response = await window.campaign.preparation(workspace.token, '');
      if (request !== editorSession.generation || context?.token !== workspace.token) return;
      usePreparation(unwrap(response));
      preparationLoaded = true;
      selectedNote = directory.preparation.notes.some(
        (row) => row.note.id === directory.preparation.selection.noteId && !row.trashed,
      )
        ? directory.preparation.selection.noteId
        : (directory.preparation.notes.find((row) => !row.trashed)?.note.id ?? null);
      selectedPlan = directory.preparation.plans.some(
        (plan) => plan.id === directory.preparation.selection.planId,
      )
        ? directory.preparation.selection.planId
        : (directory.preparation.plans[0]?.id ?? null);
      selectedScene = directory.preparation.selection.sceneId;
      selectedLocation = directory.preparation.locations.some(
        (row) => row.document.id === directory.preparation.selection.locationId,
      )
        ? directory.preparation.selection.locationId!
        : (directory.preparation.locations.find((row) => !row.trashed)?.document.id ?? null);
      await Promise.all([renderNotes(), renderPlans(), renderLocations()]);
      if (request === editorSession.generation && context?.token === workspace.token)
        renderProblems();
    } catch (error) {
      if (request === editorSession.generation && context?.token === workspace.token) throw error;
    }
  }
  async function checkpoint() {
    if (!context) return;
    const token = context.token,
      request = editorSession.generation;
    const selection = {
      noteId: selectedNote,
      planId: selectedPlan,
      sceneId: selectedScene,
      locationId: selectedLocation,
    };
    try {
      const response = await window.campaign.selectPreparation(token, selection);
      if (context?.token === token && request === editorSession.generation) unwrap(response);
    } catch (error) {
      if (context?.token === token && request === editorSession.generation)
        tell('Auswahlcheckpoint fehlgeschlagen: ' + (error as Error).message, true);
    }
  }
  function renderProblems() {
    listView.problems([...directory.preparation.problems, ...drafts.problems]);
  }
  function acceptPlan(plan: ManualPlan | null, id: string) {
    directory.acceptPlan(plan, id);
  }
  const change = (change: PreparationChange, redraw = true, stillCurrent?: () => boolean) =>
    writer.change(change, redraw, stillCurrent);
  const excerptEditor = createPreparationExcerptEditor({
    document,
    get,
    session: editorSession,
    api: host.api,
    token: () => context?.token,
    selectedNote: () => selectedNote,
    selectionGeneration: () => noteEditorGeneration,
    noteDraft: () => drafts.note,
    originalNote,
    hasDraft: (id) => !!drafts.saved(draftKey('note', id)) || drafts.problem(draftKey('note', id)),
    blocked: () => writer.blocked,
    flush: () => flushPreparation(),
    change,
    confirmed: () => {
      drafts.setNote(structuredClone(originalNote()!));
      renderNoteList();
      renderRelations();
    },
    openNote: (id) => openPreparedNote(id),
  });

  const flushPreparation = (skipSession = false, skipNarrative = false) =>
    writer.flush(skipSession, skipNarrative);
  function schedule() {
    editorSession.input.version++;
    drafts.markOpen(true);
    syncSaveControl();
    if (timer) clearTimeout(timer);
    if (writer.blocked) {
      tell('Schreiben gesperrt. Der Entwurf bleibt offen.', true);
      return;
    }
    tell('Eingabe offen – noch nicht gespeichert.');
    if (!composing)
      timer = setTimeout(() => {
        void flushPreparation();
      }, 700);
  }
  async function reloadNoteSearch(selectFirst: boolean) {
    const token = context?.token,
      query = value('world-search');
    if (!token) return;
    const request = ++directory.request,
      preparation = editorSession.generation;
    const current = () =>
      context?.token === token &&
      value('world-search') === query &&
      directory.request === request &&
      editorSession.generation === preparation;
    try {
      const next = unwrap(await window.campaign.preparation(token, query));
      if (!current()) return;
      usePreparation(next, !!query.trim());
      directory.error = null;
      if (selectFirst) {
        selectedNote = next.notes.find((row) => !row.trashed)?.note.id ?? null;
        await renderNotes();
      } else renderNoteList();
    } catch (error) {
      if (!current()) return;
      directory.error = {
        query,
        message:
          'Notizensuche konnte nicht aktualisiert werden. Suchbegriff erneut eingeben. ' +
          (error as Error).message,
      };
      renderNoteList();
    }
  }
  function renderNoteList() {
    const current = editorSession.capture(() => [context?.token]);
    listView.notes(
      {
        rows: directory.preparation.notes,
        selected: selectedNote,
        trash: get<HTMLInputElement>('world-trash').checked,
        error: directory.error?.query === value('world-search') ? directory.error.message : null,
      },
      async (id) => {
        if (!current() || !(await leavePreparation()) || !current()) return;
        selectedNote = id;
        await renderNotes();
        if (current()) revealNote(id);
      },
    );
  }
  function revealNote(id: string) {
    const editor = get('note-editor');
    if (selectedNote !== id || editor.hidden) return;
    editor.focus({ preventScroll: true });
    editor.scrollIntoView({ block: 'start' });
  }
  async function renderNotes(initialLocationId?: string) {
    noteEditorGeneration++;
    if (!noteThread?.ownsNote(selectedNote)) noteThread?.reset();
    const row = noteRow(selectedNote);
    drafts.setNote(row && !row.trashed ? structuredClone(row.note) : null);
    const token = context?.token,
      target = selectedNote,
      request = editorSession.generation;
    roomUses?.prepare(token ?? null, target);
    const saved = row ? await loadedDraft('note', row.note.id) : null;
    if (context?.token !== token || request !== editorSession.generation || selectedNote !== target)
      return;
    if (saved?.change.kind === 'note' && !row?.trashed)
      drafts.setNote(structuredClone(saved.change.note));
    get('note-editor').hidden = !row;
    get('note-empty').hidden = !!row;
    renderNoteList();
    get<HTMLButtonElement>('note-text-reference').disabled =
      !row || row.trashed || writer.blocked || drafts.problem(draftKey('note', row.note.id));
    excerptEditor.selectionChanged(
      !row || row.trashed || writer.blocked || drafts.problem(draftKey('note', row.note.id)),
    );
    if (!row) return;
    void checkpoint();
    const shown = drafts.note ?? row.note;
    get<HTMLInputElement>('note-title').value = shown.title;
    get<HTMLTextAreaElement>('note-read-aloud').value = shown.readAloud;
    get<HTMLDetailsElement>('note-read-aloud-details').open = !!shown.readAloud;
    get<HTMLTextAreaElement>('note-gm').value = shown.gmNotes;
    get('note-kind').textContent = {
      note: 'Notiz',
      npc: 'NSC',
      faction: 'Fraktion',
      quest: 'Quest',
      rumor: 'Gerücht',
      rule: 'Regel',
    }[row.note.kind];
    for (const id of ['note-title', 'note-read-aloud', 'note-gm'])
      get<HTMLInputElement>(id).disabled =
        row.trashed || drafts.problem(draftKey('note', row.note.id));
    const mergeButton = get('note-merge-open');
    if (mergeButton) mergeButton.hidden = row.trashed || row.note.kind !== 'npc';
    const focusAction = ['note-remove', 'note-restore'].includes(document.activeElement?.id ?? '');
    get('note-remove').hidden = row.trashed;
    get('note-restore').hidden = !row.trashed;
    if (focusAction)
      get('note-editor')
        .querySelector<HTMLElement>('#note-title:enabled, #note-restore:not([hidden])')
        ?.focus();
    if (token && target)
      roomUses?.show(
        token,
        target,
        () =>
          context?.token === token &&
          selectedNote === target &&
          request === editorSession.generation,
      );
    renderRelations();
    await showNarrative(
      context,
      row.note,
      row.trashed,
      () => flushPreparation(true, true),
      tell,
      undefined,
      undefined,
      initialLocationId,
    );
  }
  function renderSceneList() {
    const plan = drafts.plan ?? originalPlan(),
      token = context?.token,
      query = value('scene-search');
    const current = editorSession.capture(() => [context?.token, selectedPlan]);
    listView.scenes(
      {
        plan,
        selected: selectedScene,
        query,
        locations: new Map(
          directory.preparation.locations.map((row) => [row.document.id, row.document.name]),
        ),
        readAlouds: query.trim() ? sessionVisitReadAlouds(token, plan?.id) : null,
      },
      async (id) => {
        if (!plan || !current() || !(await leavePreparation()) || !current()) return;
        selectedScene = id;
        rememberPlanningTarget();
        await renderPlans();
        if (current()) get<HTMLInputElement>('scene-title').focus();
      },
    );
  }
  function renderPlanOptions() {
    listView.plans(directory.preparation.plans, selectedPlan);
  }
  async function renderPlans() {
    renderPlanOptions();
    if (sceneSearchPlan !== selectedPlan) {
      sceneSearchPlan = selectedPlan;
      get<HTMLInputElement>('scene-search').value = '';
    }
    const confirmed = originalPlan();
    const token = context?.token,
      target = selectedPlan,
      request = editorSession.generation;
    const saved = confirmed ? await loadedDraft('plan', confirmed.id) : null;
    if (context?.token !== token || request !== editorSession.generation || selectedPlan !== target)
      return;
    if (!confirmed) drafts.setPlan(null);
    else if (saved?.change.kind === 'plan') drafts.setPlan(structuredClone(saved.change.plan));
    else if (drafts.plan?.id !== confirmed.id || drafts.plan.revision !== confirmed.revision)
      drafts.setPlan(structuredClone(confirmed));
    if (drafts.plan && !drafts.plan.scenes.some((scene) => scene.id === selectedScene))
      selectedScene = drafts.plan.scenes[0]?.id ?? null;
    get('plan-controls').hidden = !drafts.plan;
    get('plan-empty').hidden = !!drafts.plan;
    get('plan-clear').hidden = !drafts.plan?.scenes.length;
    get('plan-controls').inert = !!confirmed && drafts.problem(draftKey('plan', confirmed.id));
    get<HTMLInputElement>('plan-name').value = drafts.plan?.name ?? '';
    renderSceneList();
    const scene = drafts.plan?.scenes.find((scene) => scene.id === selectedScene);
    get('scene-editor').hidden = !scene;
    if (scene) {
      get<HTMLInputElement>('scene-title').value = scene.title;
      get<HTMLTextAreaElement>('scene-notes').value = scene.notes;
    }
    renderSceneLocation();
    await sessionContext(context, drafts.plan, selectedScene, directory.preparation);
    if (context?.token !== token || request !== editorSession.generation || selectedPlan !== target)
      return;
    planningRenderedLoad = request;
    renderSceneList();
    void checkpoint();
  }
  async function changeNoteRelations(relations: Note['relations']) {
    const token = context?.token,
      id = selectedNote,
      request = editorSession.generation;
    if (!token || !drafts.note || drafts.note.id !== id || writer.blocked || composing)
      return false;
    drafts.setNote({ ...drafts.note, relations });
    renderRelations();
    schedule();
    return (
      (await flushPreparation()) &&
      context?.token === token &&
      request === editorSession.generation &&
      selectedNote === id
    );
  }
  let noteEditorGeneration = 0,
    locationSectionsGeneration = 0;
  async function insertNoteTextReference() {
    const owner = context,
      token = owner?.token,
      campaignId = owner?.campaign.id,
      id = selectedNote,
      run = editorSession.generation,
      editor = noteEditorGeneration,
      button = get<HTMLButtonElement>('note-text-reference'),
      area = get<HTMLTextAreaElement>('note-gm');
    if (
      !token ||
      !id ||
      !drafts.note ||
      !button.isConnected ||
      button.disabled ||
      area.disabled ||
      writer.blocked
    )
      return;
    // Flush may confirm a revision, but cannot authorize a different text/selection.
    const before = drafts.note.gmNotes,
      input = area.value,
      start = area.selectionStart,
      end = area.selectionEnd,
      alias = input.slice(start, end);
    const current = () =>
      context === owner &&
      context?.token === token &&
      context?.campaign.id === campaignId &&
      editorSession.generation === run &&
      noteEditorGeneration === editor &&
      selectedNote === id &&
      !!drafts.note &&
      drafts.note.gmNotes === before &&
      area.isConnected &&
      !area.disabled &&
      !writer.blocked;
    button.disabled = true;
    try {
      if (!(await flushPreparation()) || !current()) return;
      const link = await chooseTextReference(token, alias, current);
      if (!link || !current()) return;
      const from = rawTextOffset(before, start),
        to = rawTextOffset(before, end);
      drafts.setNote({ ...drafts.note!, gmNotes: before.slice(0, from) + link + before.slice(to) });
      area.value = drafts.note.gmNotes;
      schedule();
      area.focus();
      const caret = start + link.replace(/\r\n/g, '\n').length;
      area.setSelectionRange(caret, caret);
    } catch (error) {
      if (current()) tell((error as Error).message, true);
    } finally {
      if (
        context === owner &&
        editorSession.generation === run &&
        noteEditorGeneration === editor &&
        selectedNote === id
      )
        button.disabled = area.disabled || writer.blocked;
    }
  }
  function initPreparation(
    status: (text: string, error?: boolean) => void,
    navigateMap: (scopeId: string) => Promise<void>,
    offerVisit?: (planId: string, visitId: string, current?: () => boolean) => Promise<void>,
    inspect?: (id: string, current: () => boolean) => Promise<void>,
  ) {
    inspectNote = inspect;
    const mergeButton = document.createElement('button');
    mergeButton.id = 'note-merge-open';
    mergeButton.type = 'button';
    mergeButton.textContent = 'NSC-Notizen zusammenführen…';
    get('note-remove').before(mergeButton);
    noteMerge = new NoteMergeUI(mergeButton, get('preparation'), {
      api: window.campaign,
      storage: window.localStorage,
      tell: status,
      prepare: async () => {
        const owner = context,
          run = editorSession.generation;
        if (!owner) return null;
        if (!noteMerge?.hasPending() && !(await flushPreparation())) return null;
        if (context !== owner || editorSession.generation !== run) return null;
        if (!preparationLoaded) {
          const next = unwrap(await window.campaign.preparation(owner.token, ''));
          if (context !== owner || editorSession.generation !== run) return null;
          usePreparation(next);
        }
        return {
          token: owner.token,
          campaignId: owner.campaign.id,
          sourceId: selectedNote,
          notes: [...directory.notes.values()],
          current: () => context === owner && editorSession.generation === run,
        };
      },
      done: async (id, next, owner) => {
        if (!owner.current()) return;
        usePreparation(next);
        drafts.setNote(null);
        selectedNote = id;
        get<HTMLInputElement>('world-trash').checked = false;
        get<HTMLInputElement>('world-search').value = '';
        showPreparationArea(false);
        showLocations(false);
        await renderNotes();
        if (!owner.current()) return;
        await renderPlans();
        if (owner.current()) revealNote(id);
      },
    });
    const uses = get('note-room-uses');
    if (uses)
      roomUses = new NoteRoomUses(
        uses,
        (token, id, offset) => window.campaign.noteRoomUses(token, id, offset),
        (id, current, restore) => {
          const source = originalNote();
          return roomKeyOpen(
            id,
            current,
            () => {
              showPreparationArea(false);
              showLocations(false);
              restore(true);
              if (selectedNote) revealNote(selectedNote);
            },
            source ? { id: source.id, label: drafts.note?.title ?? source.title } : undefined,
          );
        },
      );
    tell = (text, error) => {
      status(text, error);
      noteThread?.feedback(text, error);
      packetNoteFeedback(text, error);
    };
    for (const [id, plan] of [
      ['preparation-knowledge', false],
      ['preparation-planning', true],
    ] as const)
      get(id).onclick = () => {
        void (async () => {
          const owner = context;
          if (!(await leavePreparation()) || context !== owner) return;
          if (plan) await ensurePlanningView();
          if (context === owner) showPreparationArea(plan);
        })().catch((error) => tell(error.message, true));
      };
    if (!get<HTMLSelectElement>('world-kind').querySelector('option[value="rule"]')) {
      const option = document.createElement('option');
      option.value = 'rule';
      option.textContent = 'Regelreferenz';
      get<HTMLSelectElement>('world-kind').append(option);
    }
    initSession(
      status,
      () => flushPreparation(true),
      async (id, planId) => {
        if (!context) return;
        const token = context.token,
          request = editorSession.generation,
          query = value('world-search'),
          current = () => context?.token === token && request === editorSession.generation;
        const next = unwrap(await window.campaign.preparation(token, query));
        if (!current()) return;
        const base = originalPlan(),
          pending = drafts.plan,
          keepPlanInput = !!pending && !!base && pending.id === base.id && !equal(pending, base);
        const confirmed = pending ? next.plans.find((plan) => plan.id === pending.id) : undefined;
        if (keepPlanInput && drafts.planInputConflict(confirmed)) {
          writer.blockConflict();
          get('preparation-refresh').hidden = false;
          syncSaveControl();
          throw new Error(
            'Plan oder bearbeiteter Besuch inzwischen geändert. Eigene Eingabe bleibt erhalten; gespeicherten Stand ausdrücklich aktualisieren.',
          );
        }
        usePreparation(next, !!query.trim());
        if (keepPlanInput) {
          if (confirmed) drafts.setPlan(preservePlanInput(confirmed, base!, pending!));
        } else if (planId) {
          selectedPlan = planId;
          drafts.setPlan(null);
          selectedScene = null;
        }
        if (id && !keepPlanInput) selectedScene = id;
        await renderPlans();
        if (!current()) return;
        await renderNotes();
        if (current()) await renderLocations();
      },
      async (id) => {
        await openPreparedNote(id);
      },
      () => {
        editorSession.input.version++;
      },
      offerVisit
        ? async (planId, visitId, current) => offerVisit(planId, visitId, current)
        : undefined,
    );
    registerPreparationPacketEditor(() => {
      const origin = selectedNote,
        planning = get('preparation-planning').getAttribute('aria-pressed') === 'true';
      return {
        open: (id, current) => openPreparedNote(id, current),
        finish: async (current) => {
          if (!current() || !(await flushPreparation()) || !current()) return false;
          if (origin && selectedNote !== origin && !(await openPreparedNote(origin, current)))
            return false;
          if (!current()) return false;
          showPreparationArea(planning);
          return true;
        },
      };
    });
    openMap = navigateMap;
    noteThread = new NoteThreadDialog({
      api: {
        noteThread: (...a) => window.campaign.noteThread(...a),
        checkNoteThread: (...a) => window.campaign.checkNoteThread(...a),
        searchDesk: (...a) => window.campaign.searchDesk(...a),
        deskContent: (...a) => window.campaign.deskContent(...a),
        noteRoomUses: (...a) => window.campaign.noteRoomUses(...a),
      },
      tell: status,
      prepare: async () => {
        const owner = context,
          id = selectedNote,
          run = editorSession.generation,
          editor = noteEditorGeneration;
        if (
          !owner ||
          !id ||
          !(await flushPreparation()) ||
          context !== owner ||
          editorSession.generation !== run ||
          selectedNote !== id ||
          noteEditorGeneration !== editor ||
          !drafts.note
        )
          return null;
        const current = () =>
          context === owner &&
          editorSession.generation === run &&
          (selectedNote === id || !!noteThread?.ownsContext(id, selectedNote));
        return {
          token: owner.token,
          id,
          plans: [...directory.preparation.plans],
          destination: planningTarget ? { ...planningTarget } : undefined,
          current,
          edit: (target, live) => openPreparedNote(target, () => current() && live()),
          returnToRoot: (live) => openPreparedNote(id, () => current() && live()),
          blocked: () => writer.blocked || composing || hasPendingCommit(owner.campaign.id),
          room: (room, current, restore) => roomKeyOpen(room, current, restore),
          add: async (root, ids) => {
            if (
              !current() ||
              !(await flushPreparation()) ||
              !current() ||
              !drafts.note ||
              drafts.note.id !== root.id ||
              drafts.note.revision !== root.revision
            )
              throw Error('Übersichtsnotiz geändert. Schließen und die Notiz neu öffnen.');
            const existing = new Set(drafts.note.relations.map((r) => r.targetId));
            return changeNoteRelations([
              ...drafts.note.relations,
              ...ids
                .filter((id) => !existing.has(campaignLocalId(id)))
                .map((id) => ({ targetId: campaignLocalId(id), label: 'Quelle' })),
            ]);
          },
          detach: async (root, id, live) => {
            const valid = () => current() && live() && selectedNote === root.id;
            if (
              !valid() ||
              !(await flushPreparation()) ||
              !valid() ||
              !drafts.note ||
              drafts.note.id !== root.id ||
              drafts.note.revision !== root.revision
            )
              throw Error('Übersichtsnotiz geändert. Verknüpfungen erneut prüfen.');
            const removal = detachNoteSource(drafts.note, id);
            if (!removal.relationships.length && !removal.readAloud && !removal.gmNotes)
              throw Error('Diese Quelle ist nicht mehr mit der Übersicht verknüpft.');
            drafts.setNote(removal.note);
            get<HTMLTextAreaElement>('note-read-aloud').value = drafts.note.readAloud;
            get<HTMLTextAreaElement>('note-gm').value = drafts.note.gmNotes;
            renderRelations();
            schedule();
            return (await flushPreparation()) && valid();
          },
          restore: async (root, recovery, live) => {
            const valid = () => current() && live() && selectedNote === root.id;
            if (
              !valid() ||
              !(await flushPreparation()) ||
              !valid() ||
              !drafts.note ||
              drafts.note.id !== root.id ||
              drafts.note.revision !== root.revision
            )
              throw Error('Übersichtsnotiz geändert. Wiederherstellung erneut prüfen.');
            drafts.setNote(restoreNoteSource(drafts.note, recovery));
            get<HTMLTextAreaElement>('note-read-aloud').value = drafts.note.readAloud;
            get<HTMLTextAreaElement>('note-gm').value = drafts.note.gmNotes;
            renderRelations();
            schedule();
            return (await flushPreparation()) && valid();
          },
          use: async (target, selection, live) => {
            const valid = () => current() && live();
            if (!valid()) return false;
            if (target.planId && target.visitId) {
              await openPreparedVisit(target.planId, target.visitId, valid);
              if (!valid()) return false;
              return linkVisitNoteThread(
                owner.token,
                target.planId,
                target.visitId,
                selection,
                valid,
              );
            }
            const ids = [
              ...selection.entries.map((e) => e.id),
              ...(selection.includeRoot ? [selection.rootId] : []),
            ];
            const made = await prepareNextVisit(
              target.planId,
              {
                title: target.title,
                notes: '',
                locationId: null,
                noteIds: ids,
                newPlan: !target.planId,
                newPlanName: target.planName,
                noteThread: selection,
              },
              valid,
            );
            return !!made;
          },
        };
      },
    });
    const threadButton = document.createElement('button');
    threadButton.id = 'note-thread-open';
    threadButton.type = 'button';
    threadButton.textContent = 'Notizmappe öffnen…';
    get('note-text-tools').after(threadButton);
    threadButton.onclick = () =>
      void noteThread!.open().catch((error) => tell(error.message, true));
    const prepareThread = document.createElement('button');
    prepareThread.id = 'note-thread-prepare';
    prepareThread.type = 'button';
    prepareThread.textContent = 'Für Spielabend verwenden…';
    get('note-back').after(prepareThread);
    prepareThread.onclick = () =>
      void noteThread!.open(true).catch((error) => tell(error.message, true));
    get('note-text-reference').onclick = () => {
      void insertNoteTextReference();
    };
    get('note-back').onclick = () => {
      const search = get('world-search');
      search.focus({ preventScroll: true });
      search.scrollIntoView({ block: 'center' });
    };
    get('world-new').onclick = () => {
      get<HTMLDialogElement>('world-dialog').showModal();
      get('world-name').focus();
    };
    get('world-cancel').onclick = () => get<HTMLDialogElement>('world-dialog').close();
    excerptEditor.init();
    get('world-form').onsubmit = (event) => {
      event.preventDefault();
      void (async () => {
        const token = context?.token;
        if (!context || !(await flushPreparation()) || context?.token !== token) return;
        const note: Note = {
          version: 1,
          id: campaignLocalId(crypto.randomUUID()),
          revision: 1,
          kind: value('world-kind') as Note['kind'],
          title: value('world-name'),
          readAloud: '',
          gmNotes: '',
          relations: [],
          creatureId: null,
          deleted: false,
        };
        if (await change({ kind: 'note', expectedRevision: null, note }, false)) {
          selectedNote = note.id;
          get<HTMLDialogElement>('world-dialog').close();
          get<HTMLInputElement>('world-name').value = '';
          get<HTMLInputElement>('world-trash').checked = false;
          renderNotes();
          get('note-title').focus();
        }
      })();
    };
    for (const [id, field] of [
      ['note-title', 'title'],
      ['note-read-aloud', 'readAloud'],
      ['note-gm', 'gmNotes'],
    ] as const) {
      get(id).addEventListener('input', () => {
        if (drafts.editNoteField(field, value(id))) schedule();
      });
      get(id).addEventListener('blur', () => {
        if (!composing) void flushPreparation();
      });
    }
    for (const [id, trashed] of [
      ['note-remove', true],
      ['note-restore', false],
    ] as const)
      get(id).onclick = () => {
        void (async () => {
          const token = context?.token,
            target = selectedNote,
            request = editorSession.generation;
          if (
            !(await flushPreparation()) ||
            context?.token !== token ||
            request !== editorSession.generation ||
            selectedNote !== target
          )
            return;
          const before = originalNote();
          if (!before) return;
          const inMap = noteThread?.editorId === before.id;
          if (
            await change(
              { kind: 'note-trash', id: before.id, expectedRevision: before.revision, trashed },
              false,
            )
          ) {
            if (
              context?.token !== token ||
              request !== editorSession.generation ||
              selectedNote !== target
            )
              return;
            selectedNote = inMap ? before.id : null;
            if (inMap) get<HTMLInputElement>('world-trash').checked = trashed;
            await renderNotes();
          }
        })();
      };
    get('world-trash').addEventListener('change', () => {
      void (async () => {
        if (!(await flushPreparation())) return;
        selectedNote = null;
        renderNotes();
      })();
    });
    get('world-search').addEventListener('input', () => {
      void (async () => {
        if (!context || !(await flushPreparation())) return;
        await reloadNoteSearch(true);
      })();
    });
    get('scene-search').addEventListener('input', renderSceneList);
    get('scene-search-clear').onclick = () => {
      get<HTMLInputElement>('scene-search').value = '';
      renderSceneList();
      get('scene-search').focus();
    };
    get('plan-create').onclick = () => {
      void (async () => {
        const token = context?.token;
        if (!context || !(await flushPreparation()) || context?.token !== token) return;
        const plan: ManualPlan = {
          version: 1,
          id: campaignLocalId(crypto.randomUUID()),
          revision: 1,
          name: '',
          scenes: [],
        };
        if (await change({ kind: 'plan', expectedRevision: null, plan }, false)) {
          selectedPlan = plan.id;
          selectedScene = null;
          showPreparationArea(true);
          renderPlans();
          get('plan-name').focus();
        }
      })();
    };
    get('plans').addEventListener('change', () => {
      void (async () => {
        if (!(await leavePreparation())) {
          get<HTMLSelectElement>('plans').value = selectedPlan ?? '';
          return;
        }
        selectedPlan = value('plans');
        selectedScene = null;
        rememberPlanningTarget();
        await renderPlans();
      })();
    });
    get('plan-name').addEventListener('input', () => {
      if (drafts.editPlanName(value('plan-name'))) schedule();
    });
    get('plan-name').addEventListener('blur', () => {
      if (!composing) void flushPreparation();
    });
    get('plan-clear').onclick = () => {
      void clearSessionTimeline().catch((error) => tell(error.message, true));
    };
    get('scene-remove').onclick = () => {
      void (async () => {
        const token = context?.token,
          planId = selectedPlan,
          target = selectedScene;
        if (
          !(await flushPreparation()) ||
          context?.token !== token ||
          selectedPlan !== planId ||
          selectedScene !== target ||
          !drafts.plan ||
          !target
        )
          return;
        const next = { ...drafts.plan, scenes: drafts.plan.scenes.filter((s) => s.id !== target) };
        if (await change({ kind: 'plan', expectedRevision: next.revision, plan: next }, false)) {
          selectedScene = next.scenes[0]?.id ?? null;
          await renderPlans();
        }
      })();
    };
    get('scene-add').onclick = () => {
      void (async () => {
        const token = context?.token,
          planId = selectedPlan;
        if (writer.changing) await writer.waitForChanges();
        if (!(await writer.waitForFlush())) return;
        if (
          !drafts.plan ||
          writer.blocked ||
          composing ||
          context?.token !== token ||
          selectedPlan !== planId
        )
          return;
        const id = campaignLocalId(crypto.randomUUID());
        const next = {
          ...drafts.plan,
          scenes: [...drafts.plan.scenes, { id, title: 'Neue Szene', notes: '', locationId: null }],
        };
        if (await change({ kind: 'plan', expectedRevision: next.revision, plan: next }, false)) {
          selectedScene = id;
          get<HTMLInputElement>('scene-search').value = '';
          await renderPlans();
          if (context?.token === token && selectedPlan === planId && selectedScene === id) {
            rememberPlanningTarget();
            const title = get<HTMLInputElement>('scene-title');
            title.focus();
            title.select();
          }
        }
      })();
    };
    for (const [id, field] of [
      ['scene-title', 'title'],
      ['scene-notes', 'notes'],
    ] as const) {
      get(id).addEventListener('input', () => {
        if (drafts.editSceneField(selectedScene, field, value(id))) schedule();
      });
      get(id).addEventListener('blur', () => {
        if (!composing) void flushPreparation();
      });
    }
    for (const [id, delta] of [
      ['scene-up', -1],
      ['scene-down', 1],
    ] as const)
      get(id).onclick = () => {
        void (async () => {
          const token = context?.token,
            planId = selectedPlan,
            target = selectedScene;
          if (writer.changing) await writer.waitForChanges();
          if (!(await writer.waitForFlush())) return;
          if (
            !drafts.plan ||
            writer.blocked ||
            composing ||
            context?.token !== token ||
            selectedPlan !== planId
          )
            return;
          const scenes = [...drafts.plan.scenes],
            from = scenes.findIndex((s) => s.id === target),
            to = from + delta;
          if (from < 0 || to < 0 || to >= scenes.length) return;
          [scenes[from], scenes[to]] = [scenes[to]!, scenes[from]!];
          if (
            await change(
              {
                kind: 'plan',
                expectedRevision: drafts.plan.revision,
                plan: { ...drafts.plan, scenes },
              },
              false,
            )
          )
            renderPlans();
        })();
      };
    get('preparation-apply').onclick = () => {
      void flushPreparation();
    };
    get('preparation-reconcile').onclick = () => {
      void writer.reconcile();
    };
    get('preparation-refresh').onclick = () => {
      void (async () => {
        try {
          if (context && writer.failedCommand) {
            const token = context.token;
            const current = editorSession.capture(() => [context?.token]);
            if (!(await drafts.discardCommandDraft(writer.failedCommand, token, current))) return;
            await activatePreparation(context);
            tell(
              'Gespeicherter Stand geöffnet. Betroffener Entwurf verworfen; andere Entwürfe bleiben erhalten.',
            );
          }
        } catch (error) {
          tell((error as Error).message + ' Entwurf bleibt offen.', true);
        }
      })();
    };
    const preparationInput = (event: Event) => {
      const target = event.target as Node | null;
      if (
        event.currentTarget === get('preparation') &&
        target &&
        get('note-editor').contains(target)
      )
        return false;
      return (
        !!target && (get('preparation').contains(target) || get('note-editor').contains(target))
      );
    };
    const compositionStart = (event: Event) => {
      if (preparationInput(event)) {
        composing = true;
        if (timer) clearTimeout(timer);
      }
    };
    const compositionEnd = (event: Event) => {
      if (preparationInput(event)) {
        composing = false;
        schedule();
      }
    };
    for (const root of [get('preparation'), get('note-editor')]) {
      root.addEventListener('compositionstart', compositionStart);
      root.addEventListener('compositionend', compositionEnd);
    }
    initLocationActions();
    get('scene-adopt').onclick = () => {
      void (async () => {
        const token = context?.token,
          plan = selectedPlan,
          visit = selectedScene;
        if (plan && visit && (await flushPreparation()) && context?.token === token && offerVisit)
          await offerVisit(plan, visit);
      })();
    };
    get('relation-add').onclick = () => {
      void (async () => {
        if (!drafts.note || writer.blocked) return;
        const label = value('relation-label'),
          target = value('relation-target');
        if (!label.trim() || !target) {
          tell('Wähle ein Ziel und benenne die Beziehung.', true);
          return;
        }
        if (
          drafts.note.relations.some(
            (relation) => relation.targetId === target && relation.label === label,
          )
        ) {
          tell('Diese Beziehung besteht bereits.');
          return;
        }
        if (
          (await changeNoteRelations([
            ...drafts.note.relations,
            { targetId: campaignLocalId(target), label },
          ])) &&
          value('relation-label') === label
        )
          get<HTMLInputElement>('relation-label').value = '';
      })();
    };
    get('scene-location').onchange = () => {
      if (!drafts.plan) return;
      const locationId = value('scene-location') ? campaignLocalId(value('scene-location')) : null;
      drafts.setPlan({
        ...drafts.plan,
        scenes: drafts.plan.scenes.map((s) => (s.id === selectedScene ? { ...s, locationId } : s)),
      });
      get<HTMLButtonElement>('scene-open-location').disabled = !locationId;
      schedule();
    };
    get('scene-open-location').onclick = () => {
      void (async () => {
        if (!(await flushPreparation())) return;
        const scene = originalPlan()?.scenes.find((s) => s.id === selectedScene);
        if (!scene?.locationId) return;
        const row = directory.preparation.locations.find(
          (row) => row.document.id === scene.locationId,
        );
        if (!row) {
          tell('Szenenort ist nicht verfügbar. Die Ortskennung bleibt erhalten.', true);
          return;
        }
        showPreparationArea(false);
        selectedLocation = scene.locationId;
        get<HTMLInputElement>('location-trash').checked = row.trashed;
        showLocations(true);
        renderLocations();
      })();
    };
  }
  async function createNarrativeAtLocation(
    locationId: string,
    name: string,
    kind: 'quest' | 'rumor',
  ) {
    const w = context,
      request = editorSession.generation;
    if (
      !w ||
      !(await flushPreparation()) ||
      context?.token !== w.token ||
      editorSession.generation !== request
    )
      throw new Error('Vorbereitungskontext geändert.');
    const place = unwrap(
      await window.campaign.deskContent(w.token, { kind: 'location', id: locationId }),
    );
    if (place.unavailable || context?.token !== w.token || editorSession.generation !== request)
      throw new Error('Ort für neuen Auftrag nicht verfügbar.');
    const note: Note = {
      version: 1,
      id: campaignLocalId(crypto.randomUUID()),
      revision: 1,
      kind,
      title: name,
      readAloud: '',
      gmNotes: '',
      relations: [],
      creatureId: null,
      deleted: false,
    };
    if (!(await change({ kind: 'note', expectedRevision: null, note }, false)))
      throw new Error('Neue Notiz noch nicht bestätigt. Speicherstatus der Vorbereitung prüfen.');
    if (context?.token !== w.token) throw new Error('Notiz in früherer Kampagne gespeichert.');
    selectedNote = note.id;
    get<HTMLInputElement>('world-trash').checked = false;
    await renderNotes(locationId);
    if (context !== w || context?.token !== w.token)
      throw new Error('Notiz in früherer Kampagne gespeichert.');
    if (!(await flushNarrative()))
      throw new Error('Notiz angelegt; offene Ortsbindung im narrativen Bereich abschließen.');
    const saved = unwrap(await window.campaign.narrative(w.token, note.id));
    if (context?.token !== w.token || saved.state.locationId !== locationId)
      throw new Error('Notiz angelegt; Ortsbindung im narrativen Bereich prüfen.');
    get<HTMLDetailsElement>('note-read-aloud-details').open = true;
    get('note-title').scrollIntoView({ block: 'center' });
    get('note-read-aloud').focus();
    return note.id;
  }
  async function openPreparedNote(id: string, stillCurrent = () => true) {
    const token = context?.token,
      request = editorSession.generation,
      current = () =>
        context?.token === token && editorSession.generation === request && stillCurrent();
    if (!token || !(await flushPreparation()) || !current()) return false;
    // Flushing may drain later input. Only the subsequent read must retain the
    // exact selection and draft that it started from, including nested returns.
    const readCurrent = editorSession.capture(
      () => [selectedNote, noteEditorGeneration, editorSession.input.version],
      current,
    );
    const next = unwrap(await window.campaign.preparation(token, ''));
    if (!readCurrent()) return false;
    usePreparation(next);
    const row = noteRow(id);
    if (!row) {
      tell('Weltinhalt nicht verfügbar.', true);
      return false;
    }
    get<HTMLInputElement>('world-search').value = '';
    selectedNote = id;
    get<HTMLInputElement>('world-trash').checked = row.trashed;
    showPreparationArea(false);
    showLocations(false);
    await renderNotes();
    if (!current()) return false;
    revealNote(id);
    return true;
  }
  async function prepareNoteLocation(id: string, locationId: string) {
    const token = context?.token;
    await openPreparedNote(id);
    if (!token || context?.token !== token || selectedNote !== id)
      throw new Error('Auftrag für Ortsbindung nicht verfügbar.');
    await prepareNarrativeLocation(token, id, locationId);
    tell('Zielort in den narrativen Angaben vorbelegt. Speichern bestätigt die Ortsbindung.');
  }
  async function openPreparedLocation(id: string, stillCurrent = () => true) {
    if (context && !preparationLoaded) {
      const owner = context;
      await activatePreparation(owner);
      if (context?.token !== owner.token || !stillCurrent()) return;
    }
    const token = context?.token,
      request = editorSession.generation;
    if (
      !token ||
      !(await flushPreparation()) ||
      context?.token !== token ||
      editorSession.generation !== request ||
      !stillCurrent()
    )
      return;
    const row = directory.preparation.locations.find((row) => row.document.id === id);
    if (!row) {
      tell('Ort ist nicht verfügbar. Die Ortskennung bleibt erhalten.', true);
      return;
    }
    showPreparationArea(false);
    selectedLocation = id;
    get<HTMLInputElement>('location-trash').checked = row.trashed;
    showLocations(true);
    renderLocations();
  }
  async function openPreparedVisit(
    planId: string,
    visitId: string,
    current: () => boolean = () => true,
    focus: 'visit' | 'reward' = 'visit',
  ) {
    const owner = context,
      token = owner?.token,
      epoch = editorSession.generation,
      valid = () =>
        current() &&
        context === owner &&
        context?.token === token &&
        editorSession.generation === epoch;
    if (!token || !valid() || !(await flushPreparation()) || !valid()) return;
    const next = unwrap(await window.campaign.preparation(token, ''));
    if (!valid()) return;
    const plan = next.plans.find((row) => row.id === planId);
    if (!plan) {
      tell('Spielabendplan ist nicht verfügbar.', true);
      return;
    }
    if (!plan.scenes.some((scene) => scene.id === visitId)) {
      tell('Vorbereiteter Besuch ist nicht verfügbar.', true);
      return;
    }
    usePreparation(next);
    get<HTMLInputElement>('world-search').value = '';
    selectedPlan = planId;
    selectedScene = visitId;
    drafts.setPlan(null);
    showPreparationArea(true);
    showLocations(false);
    await renderPlans();
    if (valid()) {
      const target = get<HTMLInputElement>(focus === 'reward' ? 'visit-has-reward' : 'scene-title');
      get(focus === 'reward' ? 'visit-has-reward' : 'scene-editor').scrollIntoView({
        block: focus === 'reward' ? 'center' : 'start',
      });
      target.focus({ preventScroll: true });
    }
  }
  /** Follow a plan identity without guessing a visit from a room's title. */
  async function openPreparedPlan(
    planId: string,
    current: () => boolean = () => true,
  ): Promise<boolean> {
    const owner = context,
      token = owner?.token,
      epoch = editorSession.generation,
      valid = () =>
        current() &&
        context === owner &&
        context?.token === token &&
        editorSession.generation === epoch;
    if (!token || !valid() || !(await leavePreparation()) || !valid()) return false;
    const next = unwrap(await window.campaign.preparation(token, ''));
    if (!valid()) return false;
    const plan = next.plans.find((row) => row.id === planId);
    if (!plan)
      throw new Error('Spielabendplan ist nicht verfügbar. Die Verknüpfung bleibt erhalten.');
    const previous = selectedPlan;
    usePreparation(next);
    selectedPlan = planId;
    if (previous !== planId || !plan.scenes.some((scene) => scene.id === selectedScene))
      selectedScene = plan.scenes[0]?.id ?? null;
    drafts.setPlan(null);
    showPreparationArea(true);
    showLocations(false);
    await renderPlans();
    if (!valid()) return false;
    const target = get<HTMLInputElement>(selectedScene ? 'scene-title' : 'plan-name');
    target.scrollIntoView({ block: 'center' });
    target.focus({ preventScroll: true });
    return true;
  }
  async function prepareNextVisit(
    planId: string | null,
    seed: {
      title: string;
      notes: string;
      locationId: string | null;
      beforeVisitId?: string | null;
      readAloud?: string;
      noteIds?: string[];
      newPlan?: boolean;
      newPlanName?: string;
      noteThread?: import('./note-thread-contracts').NoteThreadSelection;
    },
    stillCurrent: () => boolean = () => true,
  ): Promise<
    | {
        planId: string;
        visitId: string;
      }
    | undefined
  > {
    const owner = context,
      token = owner?.token,
      epoch = editorSession.generation,
      input = structuredClone(seed);
    const current = () =>
      context === owner &&
      context?.token === token &&
      editorSession.generation === epoch &&
      stillCurrent();
    if (!token || !current() || !(await flushPreparation()) || !current())
      throw new Error('Spielabendvorbereitung ist gerade nicht verfügbar.');
    const selection = [selectedPlan, selectedScene, selectedNote, selectedLocation],
      edit = editorSession.input.version;
    const sameInput = () =>
      editorSession.input.version === edit &&
      selectedPlan === selection[0] &&
      selectedScene === selection[1] &&
      selectedNote === selection[2] &&
      selectedLocation === selection[3] &&
      !writer.blocked &&
      !composing;
    const requested = input.newPlan ? null : (planId ?? selectedPlan),
      shown = directory.preparation.plans.find((plan) => plan.id === requested);
    const next = unwrap(await window.campaign.preparation(token, ''));
    if (!current()) return;
    if (!sameInput())
      throw new Error(
        'Vorbereitung inzwischen geändert. Offene Eingaben bleiben erhalten; Besuch erneut ausdrücklich vorbereiten.',
      );
    const target = input.newPlan
      ? undefined
      : requested
        ? next.plans.find((plan) => plan.id === requested)
        : (next.plans.find((plan) => plan.id === next.selection.planId) ?? next.plans[0]);
    if (requested && !target)
      throw new Error('Ausgewählter Spielabendplan nicht verfügbar. Vorbereitung erneut öffnen.');
    if (shown && shown.revision !== target?.revision)
      throw new Error('Spielabendplan inzwischen geändert. Vorbereitung erneut öffnen.');
    if (input.beforeVisitId && !target?.scenes.some((scene) => scene.id === input.beforeVisitId))
      throw new Error(
        'Der gewählte Besuch als Einfügeposition ist nicht mehr verfügbar. Vorbereitung erneut öffnen.',
      );
    if (target) {
      const saved = await loadedDraft('plan', target.id);
      if (!current() || !sameInput() || saved || drafts.problem(draftKey('plan', target.id)))
        throw new Error(
          'Offener Planentwurf oder ursprünglicher Auftrag vorhanden. Im Zielplan zuerst prüfen; kein neuer Besuch wurde angelegt.',
        );
    }
    usePreparation(next);
    const id = campaignLocalId(crypto.randomUUID()),
      scene = {
        id,
        title: input.title,
        notes: input.notes,
        locationId: input.locationId ? campaignLocalId(input.locationId) : null,
      };
    const plan: ManualPlan = target
      ? { ...target, scenes: [...target.scenes] }
      : {
          version: 1,
          id: campaignLocalId(crypto.randomUUID()),
          revision: 1,
          name: input.newPlanName ?? 'Nächster Spielabend',
          scenes: [],
        };
    const at = input.beforeVisitId
      ? plan.scenes.findIndex((row) => row.id === input.beforeVisitId)
      : plan.scenes.length;
    const scenes = [...plan.scenes];
    scenes.splice(at, 0, scene);
    const opening =
      input.readAloud || input.noteIds?.length
        ? {
            visitId: id,
            readAloud: input.readAloud ?? '',
            noteIds: [...new Set(input.noteIds ?? [])],
            ...(input.noteThread ? { noteThread: input.noteThread } : {}),
          }
        : undefined;
    const saved = await change(
      {
        kind: 'plan',
        expectedRevision: target?.revision ?? null,
        plan: { ...plan, scenes },
        ...(opening ? { opening } : {}),
      },
      false,
      current,
    );
    if (!current()) return;
    if (!saved)
      throw new Error(
        'Nächster Besuch konnte nicht bestätigt werden. Speicherstatus der Vorbereitung prüfen.',
      );
    // The writer retains input made while its reply was pending. Do not discard
    // that draft or move its editor merely because this visit was published.
    if (!sameInput()) return;
    selectedPlan = plan.id;
    selectedScene = id;
    drafts.setPlan(null);
    get<HTMLInputElement>('world-search').value = '';
    showPreparationArea(true);
    showLocations(false);
    await renderPlans();
    if (current() && editorSession.input.version === edit) {
      get('scene-editor').scrollIntoView({ block: 'start' });
      get<HTMLInputElement>('scene-title').focus({ preventScroll: true });
      return { planId: plan.id, visitId: id };
    }
  }
  function showLocations(show: boolean) {
    get('knowledge-panel').hidden = show;
    get('locations-panel').hidden = !show;
    get('knowledge-tab').setAttribute('aria-pressed', String(!show));
    get('locations-tab').setAttribute('aria-pressed', String(show));
  }
  function renderSceneLocation() {
    const select = get<HTMLSelectElement>('scene-location');
    select.replaceChildren();
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'Kein Ort';
    select.append(none);
    const current = drafts.plan?.scenes.find((s) => s.id === selectedScene)?.locationId;
    for (const row of directory.preparation.locations.filter(
      (row) => !row.trashed || row.document.id === current,
    )) {
      const option = document.createElement('option');
      option.value = row.document.id;
      option.textContent = row.document.name + (row.trashed ? ' (Papierkorb)' : '');
      option.disabled = row.trashed;
      select.append(option);
    }
    if (current && !directory.preparation.locations.some((row) => row.document.id === current)) {
      const option = document.createElement('option');
      option.value = current;
      option.textContent = 'Ort nicht verfügbar';
      option.disabled = true;
      select.append(option);
    }
    select.value = current ?? '';
    get<HTMLButtonElement>('scene-open-location').disabled = !current;
  }
  function renderLocationList() {
    const current = editorSession.capture(() => [context?.token]);
    listView.locations(
      {
        rows: directory.preparation.locations,
        selected: selectedLocation,
        query: value('location-search'),
        trash: get<HTMLInputElement>('location-trash').checked,
      },
      async (id) => {
        if (!current() || !(await leavePreparation()) || !current()) return;
        selectedLocation = id;
        await renderLocations();
      },
    );
  }
  async function renderLocations() {
    const row = originalLocation();
    drafts.setLocation(row && !row.trashed ? structuredClone(row) : null);
    renderLocationList();
    const token = context?.token,
      id = row?.document.id;
    const saved = row ? await loadedDraft('location', row.document.id) : null;
    if (context?.token !== token || originalLocation()?.document.id !== id) return;
    if (saved?.change.kind === 'location' && row && !row.trashed)
      drafts.setLocation({
        ...row,
        document: structuredClone(saved.change.document),
        revision: saved.change.expectedRevision!,
      });
    get('location-editor').hidden = !row;
    get('location-empty').hidden = !!row;
    get('location-sections').replaceChildren();
    get('location-maps').replaceChildren();
    get('location-map-actions').replaceChildren();
    if (!row) return;
    const shown = drafts.location?.document ?? row.document,
      readonly = row.trashed || drafts.problem(draftKey('location', row.document.id));
    get<HTMLInputElement>('location-name').value = shown.name;
    get<HTMLInputElement>('location-name').disabled = readonly;
    renderLocationSections();
    for (const map of directory.preparation.maps) {
      const label = document.createElement('label'),
        box = document.createElement('input');
      box.type = 'checkbox';
      box.dataset.mapId = map.id;
      box.checked = shown.detailMaps.some((d) => d.documentId === map.id);
      box.disabled = readonly;
      label.append(box, document.createTextNode(' ' + map.name));
      get('location-maps').append(label);
      box.onchange = () => {
        if (!drafts.location || context?.token !== token || drafts.location.document.id !== id)
          return;
        const detailMaps = drafts.location.document.detailMaps.filter(
          (d) => d.documentId !== map.id,
        );
        if (box.checked) detailMaps.push({ kind: 'dungeon', documentId: map.id });
        drafts.setLocation({
          ...drafts.location,
          document: { ...drafts.location.document, detailMaps },
        });
        schedule();
      };
    }
    renderLocationMapActions();
    get('location-remove').hidden = row.trashed;
    get('location-restore').hidden = !row.trashed;
    void checkpoint();
  }
  function sectionTitleDialog(title: string, initial: string): Promise<string | null> {
    const dialog = document.createElement('dialog'),
      form = document.createElement('form'),
      heading = document.createElement('h3'),
      input = document.createElement('input'),
      save = document.createElement('button'),
      cancel = document.createElement('button');
    heading.textContent = title;
    input.value = initial;
    input.required = true;
    input.setAttribute('aria-label', 'Abschnittstitel');
    save.textContent = 'Übernehmen';
    save.type = 'submit';
    cancel.textContent = 'Abbrechen';
    cancel.type = 'button';
    form.append(heading, input, save, cancel);
    dialog.append(form);
    dialog.id = 'location-section-title-dialog';
    host.dialogHost.append(dialog);
    return new Promise((resolve) => {
      const finish = (value: string | null) => {
        dialog.close();
        dialog.remove();
        resolve(value);
      };
      form.onsubmit = (e) => {
        e.preventDefault();
        if (input.value.trim()) finish(input.value);
      };
      cancel.onclick = () => finish(null);
      dialog.oncancel = (e) => {
        e.preventDefault();
        finish(null);
      };
      dialog.showModal();
      input.select();
    });
  }
  function renderLocationSections() {
    const owner = context,
      campaignId = owner?.campaign.id,
      run = editorSession.generation,
      epoch = ++locationSectionsGeneration;
    const row = drafts.location ?? originalLocation(),
      root = get('location-sections'),
      token = context?.token,
      id = row?.document.id;
    root.replaceChildren();
    if (!row) return;
    const readonly =
      row.trashed || writer.blocked || drafts.problem(draftKey('location', row.document.id));
    const button = (text: string, action: () => Promise<void>) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.disabled = readonly;
      b.onclick = () => {
        if (!b.isConnected || b.disabled || !owned()) return;
        b.disabled = true;
        void action()
          .catch((e) => {
            if (owned()) tell(e.message, true);
          })
          .finally(() => {
            if (b.isConnected && owned()) b.disabled = readonly;
          });
      };
      return b;
    };
    const owned = () =>
      context === owner &&
      context?.token === token &&
      context?.campaign.id === campaignId &&
      editorSession.generation === run &&
      locationSectionsGeneration === epoch &&
      drafts.location?.document.id === id &&
      !writer.blocked;
    const update = (sections: typeof row.document.sections) => {
      if (!owned()) return;
      drafts.setLocation({
        ...drafts.location!,
        document: { ...drafts.location!.document, sections },
      });
      schedule();
      renderLocationSections();
    };
    row.document.sections.forEach((section, index) => {
      const block = document.createElement('section'),
        label = document.createElement('label'),
        field = document.createElement('textarea'),
        tools = document.createElement('div');
      block.dataset.locationSectionId = section.id;
      label.textContent = section.title;
      field.id = `location-section-${index}`;
      field.dataset.sectionId = section.id;
      label.htmlFor = field.id;
      field.rows = 5;
      field.value = section.markdown;
      field.disabled = readonly;
      tools.className = 'toolbar';
      field.oninput = () => {
        if (!owned()) return;
        if (drafts.editLocationSection(section.id, field.value)) schedule();
      };
      field.onblur = () => {
        if (!composing) void flushPreparation();
      };
      tools.append(
        button('Textverweis einfügen…', async () => {
          const start = field.selectionStart,
            end = field.selectionEnd,
            alias = field.value.slice(start, end),
            before = drafts.location?.document.sections.find((s) => s.id === section.id)?.markdown;
          const current = () =>
            owned() &&
            field.isConnected &&
            !field.disabled &&
            drafts.location?.document.sections.find((s) => s.id === section.id)?.markdown ===
              before;
          if (before === undefined || !(await flushPreparation()) || !current()) return;
          const link = await chooseTextReference(token!, alias, current);
          if (!link || !current()) return;
          drafts.setLocation({
            ...drafts.location!,
            document: {
              ...drafts.location!.document,
              sections: drafts.location!.document.sections.map((s) =>
                s.id === section.id
                  ? {
                      ...s,
                      markdown:
                        before.slice(0, rawTextOffset(before, start)) +
                        link +
                        before.slice(rawTextOffset(before, end)),
                    }
                  : s,
              ),
            },
          });
          field.value = drafts.location!.document.sections.find(
            (s) => s.id === section.id,
          )!.markdown;
          schedule();
          field.focus();
          const caret = start + link.replace(/\r\n/g, '\n').length;
          field.setSelectionRange(caret, caret);
        }),
      );
      tools.append(
        button('Titel ändern…', async () => {
          if (!(await flushPreparation()) || !owned()) return;
          const title = await sectionTitleDialog('Abschnitt umbenennen', section.title);
          if (title && owned())
            update(
              drafts.location!.document.sections.map((s) =>
                s.id === section.id ? { ...s, title } : s,
              ),
            );
        }),
      );
      const move = (delta: number) => async () => {
        if (!(await flushPreparation()) || !owned()) return;
        const sections = [...drafts.location!.document.sections],
          from = sections.findIndex((s) => s.id === section.id),
          to = from + delta;
        if (from < 0 || to < 0 || to >= sections.length) return;
        const [selected] = sections.splice(from, 1);
        sections.splice(to, 0, selected!);
        update(sections);
      };
      const up = button('Nach oben', move(-1)),
        down = button('Nach unten', move(1));
      up.disabled = readonly || index === 0;
      down.disabled = readonly || index === row.document.sections.length - 1;
      tools.append(up, down);
      block.append(label, field, tools);
      root.append(block);
    });
    root.append(
      button('Abschnitt hinzufügen…', async () => {
        if (!(await flushPreparation()) || !owned()) return;
        const title = await sectionTitleDialog('Neuen Ortsabschnitt anlegen', '');
        if (title && owned())
          update([
            ...drafts.location!.document.sections,
            { id: crypto.randomUUID(), title, markdown: '' },
          ]);
      }),
    );
    const read = document.createElement('button');
    read.type = 'button';
    read.id = 'location-notebook-read';
    read.textContent = 'Ortsmappe lesen / am Spieltisch verwenden…';
    read.onclick = () => {
      void (async () => {
        if (!(await flushPreparation()) || context?.token !== token) return;
        await locationNotebookOpen(id!);
      })().catch((e) => tell(e.message, true));
    };
    root.prepend(read);
  }
  function renderLocationMapActions() {
    const row = drafts.location ?? originalLocation();
    get('location-map-actions').replaceChildren();
    if (!row || row.trashed) return;
    const token = context?.token;
    for (const binding of row.document.detailMaps) {
      const map = directory.preparation.maps.find((map) => map.id === binding.documentId);
      if (!map) continue;
      const button = document.createElement('button');
      button.textContent = `Karte öffnen: ${map.name}`;
      button.onclick = () => {
        void (async () => {
          if (context?.token === token && (await flushPreparation()) && context?.token === token)
            await openMap(map.id);
        })();
      };
      get('location-map-actions').append(button);
    }
  }
  function renderRelations() {
    const row = noteRow(selectedNote);
    get('note-relations').replaceChildren();
    get('note-incoming').replaceChildren();
    const select = get<HTMLSelectElement>('relation-target'),
      previousTarget = select.value;
    select.replaceChildren();
    for (const target of directory.notes.values()) {
      if (target.trashed || target.note.id === selectedNote) continue;
      const option = document.createElement('option');
      option.value = target.note.id;
      option.textContent = target.note.title;
      select.append(option);
    }
    if ([...select.options].some((option) => option.value === previousTarget))
      select.value = previousTarget;
    get('relation-create').hidden = !row || row.trashed || !select.options.length;
    if (!row) return;
    const token = context?.token,
      request = editorSession.generation,
      current = () =>
        context?.token === token &&
        request === editorSession.generation &&
        selectedNote === row.note.id;
    const reading = (item: HTMLElement, id: string, label: string, available: boolean) => {
      // Embedded map editors already have their own contextual reader. The
      // ordinary editor can use the shared reference reader without navigating.
      if (!inspectNote || noteThread?.editorId === row.note.id) return;
      const read = document.createElement('button');
      read.type = 'button';
      read.textContent = 'Ansehen…';
      read.setAttribute('aria-label', 'Ansehen: ' + label);
      read.disabled = !available;
      read.onclick = () => {
        if (!read.isConnected || read.disabled || !current()) return;
        void inspectNote!(id, current).catch((e) => {
          if (current()) tell(e.message, true);
        });
      };
      item.append(read);
    };
    const navigate = (id: string) => {
      void (async () => {
        if (!current()) return;
        if (noteThread?.editorId === row.note.id) {
          await noteThread.followNote(id);
          return;
        }
        if (!(await flushPreparation()) || !current()) return;
        selectedNote = id;
        showLocations(false);
        await renderNotes();
        if (context?.token === token) revealNote(id);
      })();
    };
    for (const relation of (drafts.note?.id === row.note.id ? drafts.note : row.note).relations) {
      const target = noteRow(relation.targetId),
        item = document.createElement('div'),
        button = document.createElement('button');
      button.textContent = `${relation.label}: ${target?.note.title ?? 'Ziel nicht verfügbar'}${target?.trashed ? ' (Papierkorb)' : ''}`;
      button.disabled = !target;
      button.onclick = () => {
        if (button.isConnected) navigate(relation.targetId);
      };
      item.append(button);
      reading(item, relation.targetId, button.textContent, !!target);
      if (!row.trashed) {
        const remove = document.createElement('button');
        remove.textContent = 'Beziehung lösen';
        remove.onclick = () => {
          if (current() && remove.isConnected && drafts.note)
            void changeNoteRelations(
              drafts.note.relations.filter(
                (r) => r.targetId !== relation.targetId || r.label !== relation.label,
              ),
            );
        };
        item.append(remove);
      }
      get('note-relations').append(item);
    }
    for (const source of directory.notes.values()) {
      if (!source.note.relations.some((relation) => relation.targetId === selectedNote)) continue;
      const item = document.createElement('div'),
        button = document.createElement('button');
      button.textContent = `Verweis von ${source.note.title}${source.trashed ? ' (Papierkorb)' : ''}`;
      button.onclick = () => {
        if (button.isConnected) navigate(source.note.id);
      };
      item.append(button);
      reading(item, source.note.id, button.textContent, true);
      get('note-incoming').append(item);
    }
  }
  function initLocationActions() {
    for (const [id, show] of [
      ['knowledge-tab', false],
      ['locations-tab', true],
    ] as const)
      get(id).onclick = () => {
        void (async () => {
          const owner = context,
            request = editorSession.generation;
          if (
            !(await leavePreparation()) ||
            context !== owner ||
            editorSession.generation !== request
          )
            return;
          showLocations(show);
          // Locations may have been created, renamed or trashed while the note
          // editor was hidden. Reopen its narrative context with the current list.
          if (!show) await renderNotes();
        })().catch((error) => tell(error.message, true));
      };
    get('location-new').onclick = () => {
      get<HTMLDialogElement>('location-dialog').showModal();
      get('new-location-name').focus();
    };
    get('location-cancel').onclick = () => get<HTMLDialogElement>('location-dialog').close();
    get('location-form').onsubmit = (event) => {
      event.preventDefault();
      void (async () => {
        const token = context?.token;
        if (!(await flushPreparation()) || context?.token !== token) return;
        const document = newLocation(
          crypto.randomUUID(),
          value('new-location-name'),
          value('new-location-type') as 'city' | 'poi',
          [crypto.randomUUID(), crypto.randomUUID()],
        );
        if (await change({ kind: 'location', expectedRevision: null, document }, false)) {
          selectedLocation = document.id;
          get<HTMLDialogElement>('location-dialog').close();
          get<HTMLInputElement>('new-location-name').value = '';
          get<HTMLInputElement>('location-trash').checked = false;
          renderLocations();
          renderSceneLocation();
        }
      })();
    };
    get('location-name').oninput = () => {
      if (drafts.editLocationName(value('location-name'))) schedule();
    };
    get('location-name').onblur = () => {
      if (!composing) void flushPreparation();
    };
    get('location-search').oninput = renderLocationList;
    get('location-trash').onchange = () => {
      void (async () => {
        if (await flushPreparation()) {
          selectedLocation = null;
          renderLocations();
        }
      })();
    };
    for (const [id, trashed] of [
      ['location-remove', true],
      ['location-restore', false],
    ] as const)
      get(id).onclick = () => {
        void (async () => {
          const token = context?.token,
            target = selectedLocation,
            request = editorSession.generation;
          if (
            !(await flushPreparation()) ||
            context?.token !== token ||
            request !== editorSession.generation ||
            selectedLocation !== target
          )
            return;
          const before = originalLocation();
          if (!before) return;
          if (
            await change(
              {
                kind: 'location-trash',
                id: before.document.id,
                expectedRevision: before.revision,
                trashed,
              },
              false,
            )
          ) {
            selectedLocation = null;
            renderLocations();
            renderSceneLocation();
          }
        })();
      };
  }
  editorSession.onDeactivate(() => {
    if (timer) clearTimeout(timer);
    timer = null;
  });
  editorSession.observeDraft(() => ({
    openInput: drafts.openInput,
    retainedDraft: drafts.hasRetained,
    unresolvedCommand: !!writer.failedCommand,
  }));
  return {
    editorSession,
    showDayPreparation,
    preparationHasDrafts,
    leavePreparation,
    ensurePreparation,
    activatePreparation,
    flushPreparation,
    initPreparation,
    createNarrativeAtLocation,
    openPreparedNote,
    prepareNoteLocation,
    openPreparedLocation,
    openPreparedVisit,
    openPreparedPlan,
    prepareNextVisit,
    deactivate: () => editorSession.deactivate(),
  };
}
export type PreparationEditor = ReturnType<typeof createPreparation>;

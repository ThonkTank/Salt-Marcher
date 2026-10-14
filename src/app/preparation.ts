import {showNarrative,flushNarrative} from './narrative-ui';
import type { Workspace, Result } from './contracts';
import { preparationTarget, type PreparationDraft, type PreparationEdit, type Preparation, type PreparationChange, type PreparationCommand, type Note, type LocationRow } from './preparation-contracts';
import { newLocation } from '../features/location/location-schema';
import type { ManualPlan } from '../features/planner/manual-planner';
import {initSession,sessionContext,flushSession,clearSessionTimeline} from './session-ui';
import { campaignLocalId } from '../features/campaign/campaign-contracts';
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const value = (id: string) => get<HTMLInputElement>(id).value;
const unwrap = <T>(result: Result<T>): T => { if (!result.ok) throw new Error(result.error); return result.value; };
let context: Workspace | null = null;
let data: Preparation = { notes: [], plans: [], locations: [], maps: [], problems: [], selection: { noteId: null, planId: null, sceneId: null } };
// Keep the validated campaign directory while Core returns only search matches.
// Rows share their existing text objects; each keystroke does not reload all prose.
const campaignNotes = new Map<string, Preparation['notes'][number]>();
let noteSearchLoad = 0;
let noteSearchError: {query: string; message: string} | null = null;
function usePreparation(next: Preparation, filtered = false) {
  data = next;
  if (!filtered) { campaignNotes.clear(); noteSearchLoad++; noteSearchError = null; }
  for (const row of next.notes) campaignNotes.set(row.note.id, row);
}
const noteRow = (id: string | null) => id ? campaignNotes.get(id) : undefined;
let noteDraft: Note | null = null, planDraft: ManualPlan | null = null;
let selectedNote: string | null = null, selectedPlan: string | null = null, selectedScene: string | null = null;
let selectedLocation: string | null = null, locationDraft: LocationRow | null = null;
let openMap: (scopeId: string) => Promise<void>;
let timer: ReturnType<typeof setTimeout> | null = null;
let pending: Promise<boolean> | null = null;
const changesPending = new Set<Promise<void>>();
let composing = false, blocked = false;
let preparationLoad = 0;
let hasOpenInput = false;
let failedCommand: PreparationCommand | null = null;
let tell: (text: string, error?: boolean) => void;
function syncSaveControl() { get('preparation-apply').hidden = !hasOpenInput || blocked; }
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const originalNote = () => noteRow(selectedNote)?.note;
const originalPlan = () => data.plans.find(plan => plan.id === selectedPlan);
const originalLocation = () => data.locations.find(row => row.document.id === selectedLocation);
const retained = new Map<string, PreparationDraft | null>(), draftProblems = new Map<string, string>();
let draftLoads = 0;
const draftKey = (kind: PreparationEdit['kind'], id: string) => `${kind}:${id}`;
export const preparationHasDrafts = () => hasOpenInput || blocked || !!draftLoads || !!draftProblems.size;
async function loadedDraft(kind: PreparationEdit['kind'], id: string) {
  const key = draftKey(kind, id), token = context?.token, request = preparationLoad;
  if (retained.has(key) || !token) return retained.get(key) ?? null;
  draftLoads++; get('preparation').inert = true;
  try {
    const saved = unwrap(await window.campaign.preparationDraft(token, kind, id));
    if (context?.token !== token || request !== preparationLoad) return null;
    retained.set(key, saved);
    if (saved) {
      hasOpenInput = true;
      if (saved.failedCommand) { failedCommand = saved.failedCommand; blocked = true; get('preparation-reconcile').hidden = false; get('preparation-refresh').hidden = false; }
      syncSaveControl();
      tell('Offener Vorbereitungsentwurf wiederaufgenommen. Noch nicht als Autorenstand gespeichert.', true);
    }
    return saved;
  } catch (error) {
    if (context?.token !== token || request !== preparationLoad) return null;
    const message = 'Entwurf bleibt gesperrt; Originalbytes bleiben erhalten: ' + (error as Error).message;
    retained.set(key, null); draftProblems.set(key, message); data.problems.push(message); renderProblems(); tell(message, true);
    return null;
  } finally { draftLoads--; get('preparation').inert = draftLoads > 0; }
}
async function retainOpenDrafts() {
  if (!context || draftLoads) throw new Error('Die Entwürfe werden noch geladen.');
  if (failedCommand && (!['note', 'plan', 'location'].includes(failedCommand.change.kind) || failedCommand.change.expectedRevision === null)) throw new Error('Dieser offene Anlage-/Papierkorbauftrag muss vor dem Verlassen aufgeklärt werden.');
  const token = context.token, values: PreparationEdit[] = [];
  if (noteDraft && originalNote()) values.push({ kind: 'note', expectedRevision: noteDraft.revision, note: structuredClone(noteDraft) });
  if (planDraft && originalPlan()) values.push({ kind: 'plan', expectedRevision: planDraft.revision, plan: structuredClone(planDraft) });
  if (locationDraft && originalLocation()) values.push({ kind: 'location', expectedRevision: locationDraft.revision, document: structuredClone(locationDraft.document) });
  const drafts: PreparationDraft[] = [], clean: { kind: PreparationEdit['kind']; id: string; saved: PreparationDraft }[] = [];
  for (const change of values) {
    const target = preparationTarget(change), key = draftKey(target.kind, target.id);
    if (draftProblems.has(key)) continue;
    const failedTarget = failedCommand ? preparationTarget(failedCommand.change) : null;
    const failed = failedTarget?.kind === target.kind && failedTarget.id === target.id ? failedCommand : null;
    const original = change.kind === 'note' ? originalNote() : change.kind === 'plan' ? originalPlan() : originalLocation()?.document;
    const value = change.kind === 'note' ? change.note : change.kind === 'plan' ? change.plan : change.document;
    const changed = !equal(value, original) || change.kind === 'location' && change.expectedRevision !== originalLocation()?.revision;
    if (changed || failed) drafts.push({ version: 1, writeId: crypto.randomUUID(), change, failedCommand: failed });
    else { const saved = retained.get(key); if (saved) clean.push({ ...target, saved }); }
  }
  if (drafts.length) unwrap(await window.campaign.keepPreparationDrafts(token, drafts));
  for (const item of clean) unwrap(await window.campaign.discardPreparationDraft(token, item.kind, item.id, item.saved.writeId));
  if (context?.token !== token) return;
  for (const saved of drafts) { const t = preparationTarget(saved.change); retained.set(draftKey(t.kind, t.id), saved); }
  for (const item of clean) retained.set(draftKey(item.kind, item.id), null);
  hasOpenInput = drafts.length > 0;
}
export async function leavePreparation(): Promise<boolean> {
  // Supplementary visit/profile editors do not yet have this draft codec.
  // Their unresolved input must not be mistaken for one of the three saved owners.
  if (!(await flushSession())) return false;
  if (await flushPreparation(true)) return true;
  try { await retainOpenDrafts(); tell('Offene Vorbereitung als Arbeitsentwurf gesichert.'); return true; }
  catch (error) { tell('Vorbereitung kann noch nicht verlassen werden: ' + (error as Error).message, true); return false; }
}
export async function activatePreparation(workspace: Workspace) {
  const request = ++preparationLoad;
  campaignNotes.clear(); noteSearchLoad++; noteSearchError = null;
  context = workspace; blocked = false; failedCommand = null; hasOpenInput = false; noteDraft = null; planDraft = null; locationDraft = null;
  retained.clear(); draftProblems.clear();
  composing = false; if (timer) clearTimeout(timer); timer = null;
  get('preparation-reconcile').hidden = true; get('preparation-refresh').hidden = true; syncSaveControl();
  try {
    const response = await window.campaign.preparation(workspace.token, '');
    if (request !== preparationLoad || context?.token !== workspace.token) return;
    usePreparation(unwrap(response));
    selectedNote = data.notes.some(row => row.note.id === data.selection.noteId && !row.trashed) ? data.selection.noteId : data.notes.find(row => !row.trashed)?.note.id ?? null;
    selectedPlan = data.plans.some(plan => plan.id === data.selection.planId) ? data.selection.planId : data.plans[0]?.id ?? null;
    selectedScene = data.selection.sceneId;
    selectedLocation = data.locations.some(row => row.document.id === data.selection.locationId) ? data.selection.locationId! : data.locations.find(row => !row.trashed)?.document.id ?? null;
    await Promise.all([renderNotes(), renderPlans(), renderLocations()]);
    if (request === preparationLoad && context?.token === workspace.token) renderProblems();
  } catch (error) {
    if (request === preparationLoad && context?.token === workspace.token) throw error;
  }
}
async function checkpoint() {
  if (!context) return;
  const token = context.token, request = preparationLoad;
  const selection = { noteId: selectedNote, planId: selectedPlan, sceneId: selectedScene, locationId: selectedLocation };
  try {
    const response = await window.campaign.selectPreparation(token, selection);
    if (context?.token === token && request === preparationLoad) unwrap(response);
  } catch (error) {
    if (context?.token === token && request === preparationLoad) tell('Auswahlcheckpoint fehlgeschlagen: ' + (error as Error).message, true);
  }
}
function renderProblems() {
  const problems = [...new Set([...data.problems, ...draftProblems.values()])];
  get('preparation-problems').textContent = problems.join('\n');
  get('preparation-problems').hidden = !problems.length;
}
async function change(change: PreparationChange, redraw = true): Promise<boolean> {
  if (!context || blocked) return false;
  if (changesPending.size) { tell('Vorherige Vorbereitung wird noch gespeichert.'); return false; }
  const token = context.token;
  const target = preparationTarget(change), key = draftKey(target.kind, target.id);
  const command: PreparationCommand = { commandId: crypto.randomUUID(), token, campaignId: context.campaign.id, draftWriteId: retained.get(key)?.writeId, change };
  tell('Wird gespeichert…');
  let complete!: () => void;
  const completion = new Promise<void>(resolve => { complete = resolve; }); changesPending.add(completion);
  try {
    const result = unwrap(await window.campaign.changePreparation(command));
    if (context?.token !== token) return false;
    usePreparation(result);
    if (value('world-search').trim()) await reloadNoteSearch(false);
    if (context?.token !== token) return false;
    retained.delete(key);
    if (command.change.kind === 'plan' && planDraft?.id === command.change.plan.id) {
      const sent = command.change.plan;
      const confirmed = data.plans.find(p => p.id === sent.id);
      if (confirmed) planDraft = preservePlanInput(confirmed, sent, planDraft);
    }
    if (redraw) await Promise.all([renderNotes(), renderPlans(), renderLocations()]);
    renderProblems(); syncSaveControl(); tell('Gespeichert.'); return true;
  } catch (error) {
    if (context?.token !== token) return false;
    if (change.kind === 'plan' && planDraft?.id === change.plan.id && originalPlan()) planDraft = preservePlanInput(change.plan, originalPlan()!, planDraft);
    blocked = true; failedCommand = command; get('preparation-refresh').hidden = false; get('preparation-reconcile').hidden = false; syncSaveControl();
    try { await retainOpenDrafts(); tell((error as Error).message + ' Entwurf gesichert. Kein automatischer Neuversuch.', true); }
    catch (draftError) { tell((error as Error).message + ' Entwurf bleibt im Speicher: ' + (draftError as Error).message, true); }
    return false;
  }
  finally { changesPending.delete(completion); complete(); }
}
export async function flushPreparation(skipSession=false,skipNarrative=false): Promise<boolean> {
  if(!skipNarrative&&!await flushNarrative())return false;
  if(!skipSession&&!await flushSession())return false;
  if (timer) clearTimeout(timer); timer = null;
  if (pending) { const result = await pending; return result ? flushPreparation(skipSession,skipNarrative) : false; }
  if (changesPending.size) { await Promise.all(changesPending); return flushPreparation(skipSession,skipNarrative); }
  if (!context) return true;
  if (draftLoads) return false;
  if (blocked || composing) return false;
  const beforeNote = originalNote(), beforePlan = originalPlan();
  const beforeLocation = originalLocation();
  const changedNote = noteDraft && beforeNote && !equal(noteDraft, beforeNote), changedPlan = planDraft && beforePlan && !equal(planDraft, beforePlan);
  const changedLocation = locationDraft && beforeLocation && !equal(locationDraft, beforeLocation);
  if (!changedNote && !changedPlan && !changedLocation) { if (hasOpenInput) { await retainOpenDrafts(); hasOpenInput = false; syncSaveControl(); tell('Gespeichert.'); } return true; }
  pending = (async () => {
    if (changedNote) {
      const sent = structuredClone(noteDraft!);
      if (!(await change({ kind: 'note', expectedRevision: sent.revision, note: sent }, false))) return false;
      const current = originalNote()!;
      if (noteDraft) noteDraft = { ...noteDraft, revision: current.revision };
      renderNoteList();
    }
    if (changedPlan) {
      const sent = structuredClone(planDraft!);
      if (!(await change({ kind: 'plan', expectedRevision: sent.revision, plan: sent }, false))) return false;
      if (planDraft) planDraft = { ...planDraft, revision: originalPlan()!.revision };
      renderSceneList(); renderSceneLocation();
    }
    if (changedLocation) {
      const sent = structuredClone(locationDraft!);
      if (!(await change({ kind: 'location', expectedRevision: sent.revision, document: sent.document }, false))) return false;
      if (locationDraft) locationDraft = { ...locationDraft, revision: originalLocation()!.revision };
      renderLocationList(); renderSceneLocation(); renderLocationMapActions();
    }
    hasOpenInput = !!(noteDraft && originalNote() && !equal(noteDraft, originalNote()) || planDraft && originalPlan() && !equal(planDraft, originalPlan()) || locationDraft && originalLocation() && !equal(locationDraft, originalLocation()));
    syncSaveControl(); tell(hasOpenInput ? 'Weitere Vorbereitungseingabe offen – noch nicht gespeichert.' : 'Gespeichert.');
    return true;
  })().finally(() => { pending = null; });
  const okay = await pending;
  return okay ? flushPreparation(skipSession,skipNarrative) : false;
}
function schedule() {
  hasOpenInput = true;
  syncSaveControl();
  if (timer) clearTimeout(timer);
  if (blocked) { tell('Schreiben gesperrt. Der Entwurf bleibt offen.', true); return; }
  tell('Eingabe offen – noch nicht gespeichert.');
  if (!composing) timer = setTimeout(() => { void flushPreparation(); }, 700);
}
async function reloadNoteSearch(selectFirst: boolean) {
  const token = context?.token, query = value('world-search');
  if (!token) return;
  const request = ++noteSearchLoad, preparation = preparationLoad;
  const current = () => context?.token === token && value('world-search') === query && noteSearchLoad === request && preparationLoad === preparation;
  try {
    const next = unwrap(await window.campaign.preparation(token, query));
    if (!current()) return;
    usePreparation(next, !!query.trim());
    noteSearchError = null;
    if (selectFirst) { selectedNote = next.notes.find(row => !row.trashed)?.note.id ?? null; await renderNotes(); }
    else renderNoteList();
  } catch (error) {
    if (!current()) return;
    noteSearchError = {query, message: 'Notizensuche konnte nicht aktualisiert werden. Suchbegriff erneut eingeben. ' + (error as Error).message};
    renderNoteList();
  }
}
function renderNoteList() {
  const list = get('world-list'); list.replaceChildren();
  if (noteSearchError?.query === value('world-search')) { const message = document.createElement('p'); message.setAttribute('role', 'alert'); message.textContent = noteSearchError.message; list.append(message); return; }
  const trash = get<HTMLInputElement>('world-trash').checked;
  for (const row of data.notes.filter(row => row.trashed === trash)) {
    const button = document.createElement('button'); button.textContent = row.note.title;
    const preview = row.searchPreview;
    if (preview) {
      const excerpt = document.createElement('small');
      excerpt.className = 'note-result-excerpt'; excerpt.id = `note-result-${row.note.id}`;
      excerpt.append(`${preview.owner}: `);
      for (const part of preview.parts) {
        if (part.matched) {const mark=document.createElement('mark');mark.textContent=part.text;excerpt.append(mark);}
        else excerpt.append(part.text);
      }
      button.setAttribute('aria-label', row.note.title);
      button.setAttribute('aria-describedby', excerpt.id);
      button.append(excerpt);
    }
    button.setAttribute('aria-pressed', String(row.note.id === selectedNote));
    button.onclick = () => { void (async () => { const token = context?.token; if (!(await leavePreparation()) || context?.token !== token) return; selectedNote = row.note.id; await renderNotes(); if (context?.token === token) revealNote(row.note.id); })(); };
    list.append(button);
  }
  if (!list.childNodes.length) { const p = document.createElement('p'); p.textContent = 'Keine Einträge in dieser Auswahl.'; list.append(p); }
}
function revealNote(id: string) {
  const editor = get('note-editor');
  if (selectedNote !== id || editor.hidden) return;
  editor.focus({ preventScroll: true });
  editor.scrollIntoView({ block: 'start' });
}
async function renderNotes() {
  const row = noteRow(selectedNote); noteDraft = row && !row.trashed ? structuredClone(row.note) : null;
  const token = context?.token, target = selectedNote, request = preparationLoad;
  const saved = row ? await loadedDraft('note', row.note.id) : null;
  if (context?.token !== token || request !== preparationLoad || selectedNote !== target) return;
  if (saved?.change.kind === 'note' && !row?.trashed) noteDraft = structuredClone(saved.change.note);
  get('note-editor').hidden = !row; get('note-empty').hidden = !!row;
  renderNoteList();
  if (!row) return;
  void checkpoint();
  const shown = noteDraft ?? row.note;
  get<HTMLInputElement>('note-title').value = shown.title;
  get<HTMLTextAreaElement>('note-read-aloud').value = shown.readAloud;
  get<HTMLTextAreaElement>('note-gm').value = shown.gmNotes;
  get('note-kind').textContent = ({ npc: 'NSC', faction: 'Fraktion', quest: 'Quest', rumor: 'Gerücht', rule: 'Regel' })[row.note.kind];
  for (const id of ['note-title', 'note-read-aloud', 'note-gm']) get<HTMLInputElement>(id).disabled = row.trashed || draftProblems.has(draftKey('note', row.note.id));
  get('note-remove').hidden = row.trashed; get('note-restore').hidden = !row.trashed;
  renderRelations();void showNarrative(context,row.note,row.trashed,()=>flushPreparation(true,true),tell);
}
function renderSceneList() {
  const list = get('scene-list'); list.replaceChildren();
  const plan = planDraft ?? originalPlan();
  plan?.scenes.forEach((scene, index) => {
    const button = document.createElement('button'); button.textContent = `${index + 1}. ${scene.title || 'Unbenannte Szene'}`;
    button.setAttribute('aria-pressed', String(scene.id === selectedScene));
    button.onclick = () => { void (async () => { if (!(await leavePreparation())) return; selectedScene = scene.id; await renderPlans(); get<HTMLInputElement>('scene-title').focus(); })(); }; list.append(button);
  });
}
async function renderPlans() {
  const select = get<HTMLSelectElement>('plans'); select.replaceChildren();
  for (const plan of data.plans) { const option = document.createElement('option'); option.value = plan.id; option.textContent = plan.name || 'Unbenannter Plan'; select.append(option); }
  select.value = selectedPlan ?? '';
  const confirmed = originalPlan();
  const token = context?.token, target = selectedPlan, request = preparationLoad;
  const saved = confirmed ? await loadedDraft('plan', confirmed.id) : null;
  if (context?.token !== token || request !== preparationLoad || selectedPlan !== target) return;
  if (!confirmed) planDraft = null;
  else if (saved?.change.kind === 'plan') planDraft = structuredClone(saved.change.plan);
  else if (planDraft?.id !== confirmed.id || planDraft.revision !== confirmed.revision) planDraft = structuredClone(confirmed);
  if (planDraft && !planDraft.scenes.some(scene => scene.id === selectedScene)) selectedScene = planDraft.scenes[0]?.id ?? null;
  get('plan-controls').hidden = !planDraft; get('plan-empty').hidden = !!planDraft; get('plan-clear').hidden = !planDraft?.scenes.length;
  get('plan-controls').inert = !!confirmed && draftProblems.has(draftKey('plan', confirmed.id));
  get<HTMLInputElement>('plan-name').value = planDraft?.name ?? '';
  renderSceneList(); const scene = planDraft?.scenes.find(scene => scene.id === selectedScene);
  get('scene-editor').hidden = !scene;
  if (scene) { get<HTMLInputElement>('scene-title').value = scene.title; get<HTMLTextAreaElement>('scene-notes').value = scene.notes; }
  renderSceneLocation();
  await sessionContext(context,planDraft,selectedScene,data);
  void checkpoint();
}
/** Preserve only the known editable fields entered after this exact plan command was sent. */
function preservePlanInput(confirmed: ManualPlan, sent: ManualPlan, current: ManualPlan): ManualPlan {
  return { ...confirmed, name: current.name !== sent.name ? current.name : confirmed.name,
    scenes: confirmed.scenes.map(scene => {
      const before = sent.scenes.find(s => s.id === scene.id), draft = current.scenes.find(s => s.id === scene.id);
      if (!before || !draft) return scene;
      return { ...scene, title: draft.title !== before.title ? draft.title : scene.title,
        notes: draft.notes !== before.notes ? draft.notes : scene.notes,
        locationId: draft.locationId !== before.locationId ? draft.locationId : scene.locationId };
    }) };
}
export function initPreparation(status: (text: string, error?: boolean) => void, navigateMap: (scopeId: string) => Promise<void>, offerVisit?: (planId: string, visitId: string) => Promise<void>) {
  tell = status;
  if(!get<HTMLSelectElement>('world-kind').querySelector('option[value="rule"]')){const option=document.createElement('option');option.value='rule';option.textContent='Regelreferenz';get<HTMLSelectElement>('world-kind').append(option);}
  initSession(status,()=>flushPreparation(true),async id=>{if(!context)return;usePreparation(unwrap(await window.campaign.preparation(context.token,value('world-search'))), !!value('world-search').trim());if(id)selectedScene=id;await renderPlans();await renderNotes();await renderLocations();},openPreparedNote);
  openMap = navigateMap;
  get('note-back').onclick = () => { const search = get('world-search'); search.focus({ preventScroll: true }); search.scrollIntoView({ block: 'center' }); };
  get('world-new').onclick = () => { get<HTMLDialogElement>('world-dialog').showModal(); get('world-name').focus(); };
  get('world-cancel').onclick = () => get<HTMLDialogElement>('world-dialog').close();
  get('world-form').onsubmit = event => { event.preventDefault(); void (async () => {
    const token = context?.token;
    if (!context || !(await flushPreparation()) || context?.token !== token) return;
    const note: Note = { version: 1, id: campaignLocalId(crypto.randomUUID()), revision: 1, kind: value('world-kind') as Note['kind'], title: value('world-name'), readAloud: '', gmNotes: '', relations: [], creatureId: null, deleted: false };
    if (await change({ kind: 'note', expectedRevision: null, note }, false)) { selectedNote = note.id; get<HTMLDialogElement>('world-dialog').close(); get<HTMLInputElement>('world-name').value = ''; get<HTMLInputElement>('world-trash').checked = false; renderNotes(); get('note-title').focus(); }
  })(); };
  for (const [id, field] of [['note-title', 'title'], ['note-read-aloud', 'readAloud'], ['note-gm', 'gmNotes']] as const) {
    get(id).addEventListener('input', () => { if (noteDraft) { const text = value(id), before = originalNote()!; noteDraft = { ...noteDraft, [field]: text === before[field].replace(/\r\n?/g, '\n') ? before[field] : text }; schedule(); } });
    get(id).addEventListener('blur', () => { if (!composing) void flushPreparation(); });
  }
  for (const [id, trashed] of [['note-remove', true], ['note-restore', false]] as const) get(id).onclick = () => { void (async () => {
    const token = context?.token, target = selectedNote, request = preparationLoad;
    if (!(await flushPreparation()) || context?.token !== token || request !== preparationLoad || selectedNote !== target) return; const before = originalNote(); if (!before) return;
    if (await change({ kind: 'note-trash', id: before.id, expectedRevision: before.revision, trashed }, false)) { selectedNote = null; renderNotes(); }
  })(); };
  get('world-trash').addEventListener('change', () => { void (async () => { if (!(await flushPreparation())) return; selectedNote = null; renderNotes(); })(); });
  get('world-search').addEventListener('input', () => { void (async () => {
    if (!context || !(await flushPreparation())) return;
    await reloadNoteSearch(true);
  })(); });
  get('plan-create').onclick = () => { void (async () => {
    const token = context?.token;
    if (!context || !(await flushPreparation()) || context?.token !== token) return;
    const plan: ManualPlan = { version: 1, id: campaignLocalId(crypto.randomUUID()), revision: 1, name: '', scenes: [] };
    if (await change({ kind: 'plan', expectedRevision: null, plan }, false)) { selectedPlan = plan.id; selectedScene = null; renderPlans(); get('plan-name').focus(); }
  })(); };
  get('plans').addEventListener('change', () => { void (async () => { if (!(await leavePreparation())) { get<HTMLSelectElement>('plans').value = selectedPlan ?? ''; return; } selectedPlan = value('plans'); selectedScene = null; await renderPlans(); })(); });
  get('plan-name').addEventListener('input', () => { if (planDraft) { planDraft = { ...planDraft, name: value('plan-name') }; schedule(); } });
  get('plan-name').addEventListener('blur', () => { if (!composing) void flushPreparation(); });
  get('plan-clear').onclick=()=>{void clearSessionTimeline().catch(error=>tell(error.message,true));};
  get('scene-remove').onclick=()=>{void(async()=>{
    const token=context?.token,planId=selectedPlan,target=selectedScene;
    if(!await flushPreparation()||context?.token!==token||selectedPlan!==planId||selectedScene!==target||!planDraft||!target)return;
    const next={...planDraft,scenes:planDraft.scenes.filter(s=>s.id!==target)};
    if(await change({kind:'plan',expectedRevision:next.revision,plan:next},false)){selectedScene=next.scenes[0]?.id??null;await renderPlans();}
  })();};
  get('scene-add').onclick = () => { void (async () => {
    const token = context?.token, planId = selectedPlan;
    if (changesPending.size) await Promise.all(changesPending);
    if (pending && !(await pending)) return;
    if (!planDraft || blocked || composing || context?.token !== token || selectedPlan !== planId) return;
    const id = campaignLocalId(crypto.randomUUID());
    const next = { ...planDraft, scenes: [...planDraft.scenes, { id, title: 'Neue Szene', notes: '', locationId: null }] };
    if (await change({ kind: 'plan', expectedRevision: next.revision, plan: next }, false)) { selectedScene = id; renderPlans(); get('scene-title').focus(); }
  })(); };
  for (const [id, field] of [['scene-title', 'title'], ['scene-notes', 'notes']] as const) {
    get(id).addEventListener('input', () => { if (planDraft) { const before = originalPlan()?.scenes.find(s => s.id === selectedScene), text = value(id); planDraft = { ...planDraft, scenes: planDraft.scenes.map(s => s.id === selectedScene ? { ...s, [field]: before && text === before[field].replace(/\r\n?/g, '\n') ? before[field] : text } : s) }; schedule(); } });
    get(id).addEventListener('blur', () => { if (!composing) void flushPreparation(); });
  }
  for (const [id, delta] of [['scene-up', -1], ['scene-down', 1]] as const) get(id).onclick = () => { void (async () => {
    const token = context?.token, planId = selectedPlan, target = selectedScene;
    if (changesPending.size) await Promise.all(changesPending);
    if (pending && !(await pending)) return;
    if (!planDraft || blocked || composing || context?.token !== token || selectedPlan !== planId) return;
    const scenes = [...planDraft.scenes], from = scenes.findIndex(s => s.id === target), to = from + delta;
    if (from < 0 || to < 0 || to >= scenes.length) return;
    [scenes[from], scenes[to]] = [scenes[to]!, scenes[from]!];
    if (await change({ kind: 'plan', expectedRevision: planDraft.revision, plan: { ...planDraft, scenes } }, false)) renderPlans();
  })(); };
  get('preparation-apply').onclick = () => { void flushPreparation(); };
  get('preparation-reconcile').onclick = () => { void (async () => {
    if (!failedCommand) return;
    try {
      const result = unwrap(await window.campaign.reconcilePreparation(failedCommand, context?.token));
      if (result.targetChanged || result.outcome === 'conflict') {
        tell(result.outcome === 'applied' ? 'Speicherung bestätigt, aber der aktuelle Vorbereitungsstand ist verändert oder nicht verlässlich lesbar. Entwurf bleibt offen; sichere den Text vor dem Verwerfen.' : 'Vorbereitungskonflikt bestätigt. Entwurf bleibt offen; sichere den Text vor dem Verwerfen.', true); return;
      }
      usePreparation(result.data);
      const change = failedCommand.change;
      const targetId = change.kind === 'note' ? change.note.id : change.kind === 'plan' ? change.plan.id : change.kind === 'location' ? change.document.id : change.id;
      const target = preparationTarget(change), key = draftKey(target.kind, target.id), saved = retained.get(key);
      if (saved) {
        const revision = target.kind === 'note' ? data.notes.find(r => r.note.id === target.id)?.note.revision : target.kind === 'plan' ? data.plans.find(p => p.id === target.id)?.revision : data.locations.find(r => r.document.id === target.id)?.revision;
        if (revision === undefined) throw new Error('Der Entwurfsstand ist nicht lesbar.');
        const rebased: PreparationEdit = saved.change.kind === 'note' ? { ...saved.change, expectedRevision: revision, note: { ...saved.change.note, revision } } : saved.change.kind === 'plan' ? { ...saved.change, expectedRevision: revision, plan: { ...saved.change.plan, revision } } : { ...saved.change, expectedRevision: revision };
        const next: PreparationDraft = { version: 1, writeId: crypto.randomUUID(), change: rebased, failedCommand: null };
        unwrap(await window.campaign.keepPreparationDrafts(context!.token, [next])); retained.set(key, next);
      }
      if ((change.kind === 'note' || change.kind === 'note-trash') && noteDraft?.id === targetId && originalNote()) noteDraft = { ...noteDraft, revision: originalNote()!.revision };
      if (change.kind === 'plan' && planDraft?.id === targetId && originalPlan()) planDraft = { ...planDraft, revision: originalPlan()!.revision };
      if ((change.kind === 'location' || change.kind === 'location-trash') && locationDraft?.document.id === targetId && originalLocation()) locationDraft = { ...locationDraft, revision: originalLocation()!.revision };
      blocked = false; failedCommand = null; get('preparation-reconcile').hidden = true; get('preparation-refresh').hidden = true;
      await retainOpenDrafts();
      tell(result.outcome === 'applied' ? 'Speicherung der Vorbereitung bestätigt. Weitere Eingaben bleiben offen.' : 'Änderung nicht gespeichert. Eingabe abschließen, um den Entwurf erneut zu übernehmen.');
    } catch (error) { tell((error as Error).message + ' Status bleibt ungeklärt.', true); }
  })(); };
  get('preparation-refresh').onclick = () => { void (async () => {
    try {
      if (context && failedCommand) {
        const target = preparationTarget(failedCommand.change), key = draftKey(target.kind, target.id), saved = retained.get(key);
        if (saved) { unwrap(await window.campaign.discardPreparationDraft(context.token, target.kind, target.id, saved.writeId)); retained.set(key, null); }
        await activatePreparation(context); tell('Gespeicherter Stand geöffnet. Betroffener Entwurf verworfen; andere Entwürfe bleiben erhalten.');
      }
    } catch (error) { tell((error as Error).message + ' Entwurf bleibt offen.', true); }
  })(); };
  get('preparation').addEventListener('compositionstart', () => { composing = true; if (timer) clearTimeout(timer); });
  get('preparation').addEventListener('compositionend', () => { composing = false; schedule(); });
  initLocationActions();
  get('scene-adopt').onclick = () => { void (async () => {
    const token = context?.token, plan = selectedPlan, visit = selectedScene;
    if (plan && visit && await flushPreparation() && context?.token === token && offerVisit) await offerVisit(plan, visit);
  })(); };
  get('relation-add').onclick = () => { void (async () => {
    const token = context?.token;
    if (pending && !(await pending)) return;
    if (!noteDraft || context?.token !== token || blocked) return;
    const label = value('relation-label'); if (!label.trim() || !value('relation-target')) { tell('Wähle ein Ziel und benenne die Beziehung.', true); return; }
    const next = { ...noteDraft, relations: [...noteDraft.relations, { targetId: campaignLocalId(value('relation-target')), label }] };
    if (await change({ kind: 'note', expectedRevision: next.revision, note: next }, false)) { get<HTMLInputElement>('relation-label').value = ''; renderNotes(); }
  })(); };
  get('scene-location').onchange = () => { if (!planDraft) return; const locationId = value('scene-location') ? campaignLocalId(value('scene-location')) : null; planDraft = { ...planDraft, scenes: planDraft.scenes.map(s => s.id === selectedScene ? { ...s, locationId } : s) }; get<HTMLButtonElement>('scene-open-location').disabled = !locationId; schedule(); };
  get('scene-open-location').onclick = () => { void (async () => { if (!(await flushPreparation())) return; const scene = originalPlan()?.scenes.find(s => s.id === selectedScene); if (!scene?.locationId) return; const row = data.locations.find(row => row.document.id === scene.locationId); if (!row) { tell('Szenenort ist nicht verfügbar. Die Ortskennung bleibt erhalten.', true); return; } selectedLocation = scene.locationId; get<HTMLInputElement>('location-trash').checked = row.trashed; showLocations(true); renderLocations(); })(); };
}
export async function openPreparedNote(id:string) {
  const token = context?.token;
  if (!token || !await flushPreparation() || context?.token !== token) return;
  const next = unwrap(await window.campaign.preparation(token, ''));
  if (context?.token !== token) return;
  usePreparation(next);
  const row = noteRow(id);
  if (!row) { tell('Weltinhalt nicht verfügbar.', true); return; }
  get<HTMLInputElement>('world-search').value = '';
  selectedNote = id; get<HTMLInputElement>('world-trash').checked = row.trashed;
  showLocations(false); await renderNotes();
  if (context?.token === token) revealNote(id);
}
export async function openPreparedLocation(id: string) {
  if (!(await flushPreparation())) return;
  const row = data.locations.find(row => row.document.id === id);
  if (!row) { tell('Ort ist nicht verfügbar. Die Ortskennung bleibt erhalten.', true); return; }
  selectedLocation = id; get<HTMLInputElement>('location-trash').checked = row.trashed; showLocations(true); renderLocations();
}

function showLocations(show: boolean) {
  get('knowledge-panel').hidden = show; get('locations-panel').hidden = !show;
  get('knowledge-tab').setAttribute('aria-pressed', String(!show)); get('locations-tab').setAttribute('aria-pressed', String(show));
}
function renderSceneLocation() {
  const select = get<HTMLSelectElement>('scene-location'); select.replaceChildren();
  const none = document.createElement('option'); none.value = ''; none.textContent = 'Kein Ort'; select.append(none);
  const current = planDraft?.scenes.find(s => s.id === selectedScene)?.locationId;
  for (const row of data.locations.filter(row => !row.trashed || row.document.id === current)) {
    const option = document.createElement('option'); option.value = row.document.id; option.textContent = row.document.name + (row.trashed ? ' (Papierkorb)' : ''); option.disabled = row.trashed; select.append(option);
  }
  if (current && !data.locations.some(row => row.document.id === current)) { const option = document.createElement('option'); option.value = current; option.textContent = 'Ort nicht verfügbar'; option.disabled = true; select.append(option); }
  select.value = current ?? ''; get<HTMLButtonElement>('scene-open-location').disabled = !current;
}
function renderLocationList() {
  const list = get('location-list'); list.replaceChildren(); const needle = value('location-search').toLocaleLowerCase();
  const trash = get<HTMLInputElement>('location-trash').checked, token = context?.token;
  for (const row of data.locations.filter(row => row.trashed === trash && `${row.document.name} ${row.document.sections.map(s => s.markdown).join('\n')}`.toLocaleLowerCase().includes(needle))) {
    const button = document.createElement('button'); button.textContent = row.document.name; button.setAttribute('aria-pressed', String(row.document.id === selectedLocation));
    button.onclick = () => { void (async () => { if (context?.token !== token || !(await leavePreparation()) || context?.token !== token) return; selectedLocation = row.document.id; await renderLocations(); })(); }; list.append(button);
  }
}
async function renderLocations() {
  const row = originalLocation(); locationDraft = row && !row.trashed ? structuredClone(row) : null; renderLocationList();
  const token = context?.token, id = row?.document.id;
  const saved = row ? await loadedDraft('location', row.document.id) : null;
  if (context?.token !== token || originalLocation()?.document.id !== id) return;
  if (saved?.change.kind === 'location' && row && !row.trashed) locationDraft = { ...row, document: structuredClone(saved.change.document), revision: saved.change.expectedRevision! };
  get('location-editor').hidden = !row; get('location-empty').hidden = !!row; get('location-sections').replaceChildren(); get('location-maps').replaceChildren(); get('location-map-actions').replaceChildren();
  if (!row) return;
  const shown = locationDraft?.document ?? row.document, readonly = row.trashed || draftProblems.has(draftKey('location', row.document.id));
  get<HTMLInputElement>('location-name').value = shown.name; get<HTMLInputElement>('location-name').disabled = readonly;
  shown.sections.forEach((section, index) => {
    const label = document.createElement('label'); label.textContent = section.title;
    const field = document.createElement('textarea'); field.id = `location-section-${index}`; label.htmlFor = field.id; field.rows = 5; field.value = section.markdown; field.disabled = readonly;
    field.oninput = () => { if (!locationDraft || context?.token !== token || locationDraft.document.id !== id) return; locationDraft = { ...locationDraft, document: { ...locationDraft.document, sections: locationDraft.document.sections.map((s, i) => i === index ? { ...s, markdown: field.value === section.markdown.replace(/\r\n?/g, '\n') ? section.markdown : field.value } : s) } }; schedule(); };
    field.onblur = () => { if (!composing) void flushPreparation(); }; get('location-sections').append(label, field);
  });
  for (const map of data.maps) {
    const label = document.createElement('label'), box = document.createElement('input'); box.type = 'checkbox'; box.dataset.mapId = map.id; box.checked = shown.detailMaps.some(d => d.documentId === map.id); box.disabled = readonly;
    label.append(box, document.createTextNode(' ' + map.name)); get('location-maps').append(label);
    box.onchange = () => { if (!locationDraft || context?.token !== token || locationDraft.document.id !== id) return; const detailMaps = locationDraft.document.detailMaps.filter(d => d.documentId !== map.id); if (box.checked) detailMaps.push({ kind: 'dungeon', documentId: map.id }); locationDraft = { ...locationDraft, document: { ...locationDraft.document, detailMaps } }; schedule(); };
  }
  renderLocationMapActions();
  get('location-remove').hidden = row.trashed; get('location-restore').hidden = !row.trashed; void checkpoint();
}
function renderLocationMapActions() {
  const row = locationDraft ?? originalLocation(); get('location-map-actions').replaceChildren();
  if (!row || row.trashed) return; const token = context?.token;
  for (const binding of row.document.detailMaps) {
    const map = data.maps.find(map => map.id === binding.documentId); if (!map) continue;
    const button = document.createElement('button'); button.textContent = `Karte öffnen: ${map.name}`;
    button.onclick = () => { void (async () => { if (context?.token === token && await flushPreparation() && context?.token === token) await openMap(map.id); })(); }; get('location-map-actions').append(button);
  }
}
function renderRelations() {
  const row = noteRow(selectedNote); get('note-relations').replaceChildren(); get('note-incoming').replaceChildren();
  const select = get<HTMLSelectElement>('relation-target'); select.replaceChildren();
  for (const target of campaignNotes.values()) { if (target.trashed || target.note.id === selectedNote) continue; const option = document.createElement('option'); option.value = target.note.id; option.textContent = target.note.title; select.append(option); }
  get('relation-create').hidden = !row || row.trashed || !select.options.length;
  if (!row) return; const token = context?.token;
  const navigate = (id: string) => { void (async () => { if (context?.token !== token || !(await flushPreparation()) || context?.token !== token) return; selectedNote = id; showLocations(false); await renderNotes(); if (context?.token === token) revealNote(id); })(); };
  for (const relation of row.note.relations) {
    const target = noteRow(relation.targetId), item = document.createElement('div'), button = document.createElement('button');
    button.textContent = `${relation.label}: ${target?.note.title ?? 'Ziel nicht verfügbar'}${target?.trashed ? ' (Papierkorb)' : ''}`; button.disabled = !target; button.onclick = () => navigate(relation.targetId); item.append(button);
    if (!row.trashed) { const remove = document.createElement('button'); remove.textContent = 'Beziehung lösen'; remove.onclick = () => { void (async () => { if (!noteDraft || context?.token !== token) return; const next = { ...noteDraft, relations: noteDraft.relations.filter(r => r.targetId !== relation.targetId || r.label !== relation.label) }; if (await change({ kind: 'note', expectedRevision: next.revision, note: next }, false)) renderNotes(); })(); }; item.append(remove); }
    get('note-relations').append(item);
  }
  for (const source of campaignNotes.values()) { if (!source.note.relations.some(relation => relation.targetId === selectedNote)) continue; const button = document.createElement('button'); button.textContent = `Verweis von ${source.note.title}${source.trashed ? ' (Papierkorb)' : ''}`; button.onclick = () => navigate(source.note.id); get('note-incoming').append(button); }
}
function initLocationActions() {
  for (const [id, show] of [['knowledge-tab', false], ['locations-tab', true]] as const) get(id).onclick = () => { void (async () => { if (await leavePreparation()) showLocations(show); })(); };
  get('location-new').onclick = () => { get<HTMLDialogElement>('location-dialog').showModal(); get('new-location-name').focus(); };
  get('location-cancel').onclick = () => get<HTMLDialogElement>('location-dialog').close();
  get('location-form').onsubmit = event => { event.preventDefault(); void (async () => {
    const token = context?.token;
    if (!(await flushPreparation()) || context?.token !== token) return;
    const document = newLocation(crypto.randomUUID(), value('new-location-name'), value('new-location-type') as 'city' | 'poi', [crypto.randomUUID(), crypto.randomUUID()]);
    if (await change({ kind: 'location', expectedRevision: null, document }, false)) { selectedLocation = document.id; get<HTMLDialogElement>('location-dialog').close(); get<HTMLInputElement>('new-location-name').value = ''; get<HTMLInputElement>('location-trash').checked = false; renderLocations(); renderSceneLocation(); }
  })(); };
  get('location-name').oninput = () => { if (locationDraft) { locationDraft = { ...locationDraft, document: { ...locationDraft.document, name: value('location-name') } }; schedule(); } };
  get('location-name').onblur = () => { if (!composing) void flushPreparation(); };
  get('location-search').oninput = renderLocationList;
  get('location-trash').onchange = () => { void (async () => { if (await flushPreparation()) { selectedLocation = null; renderLocations(); } })(); };
  for (const [id, trashed] of [['location-remove', true], ['location-restore', false]] as const) get(id).onclick = () => { void (async () => {
    const token = context?.token, target = selectedLocation, request = preparationLoad;
    if (!(await flushPreparation()) || context?.token !== token || request !== preparationLoad || selectedLocation !== target) return; const before = originalLocation(); if (!before) return;
    if (await change({ kind: 'location-trash', id: before.document.id, expectedRevision: before.revision, trashed }, false)) { selectedLocation = null; renderLocations(); renderSceneLocation(); }
  })(); };
}

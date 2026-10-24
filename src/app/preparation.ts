import {EditorSession} from './editor-session';
import {focusNoteEditor} from './note-editor-mount';
import {acknowledgeFields} from './editor-transition';
import {NoteMergeUI} from './note-merge-ui';
import {registerPreparationPacketEditor,packetNoteFeedback} from './session-packet-ui';
import {NoteThreadDialog} from './note-thread-ui';
import {detachNoteSource,restoreNoteSource} from './note-thread-edit';
import {hasPendingCommit} from './commit-confirmation';
import {NoteRoomUses} from './note-room-uses';
import {chooseTextReference} from './text-reference-picker';
import {rawTextOffset} from './text-references';
import {appendNoteExcerpt} from './note-excerpt';
import {normalizedNoteTitle,type KeyNoteChoices} from './key-note-capture-contracts';
import {preserveLiteralEdit} from './literal-text-edit';
import {showNarrative,flushNarrative,prepareNarrativeLocation,acceptNarrativeNoteReceipt} from './narrative-ui';
import type { WorkspaceGeometry, Result } from './contracts';
import { preparationTarget, type PreparationDraft, type PreparationEdit, type Preparation, type PreparationChange, type PreparationCommand, type Note, type LocationRow } from './preparation-contracts';
import { newLocation } from '../features/location/location-schema';
import type { ManualPlan } from '../features/planner/manual-planner';
import {initSession,sessionContext,sessionVisitReadAlouds,flushSession,clearSessionTimeline,linkVisitNoteThread} from './session-ui';
import { campaignLocalId } from '../features/campaign/campaign-contracts';
export const editorSession = new EditorSession();
const failedCommandState = editorSession.command<PreparationCommand>();
const pendingWork = editorSession.operation<Promise<boolean>>();

const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const value = (id: string) => get<HTMLInputElement>(id).value;
function showPreparationArea(plan:boolean){
 if(plan)rememberPlanningTarget();
 get('preparation-knowledge-workspace').hidden=plan;get('preparation-planning-workspace').hidden=!plan;
 get('preparation-knowledge').setAttribute('aria-pressed',String(!plan));get('preparation-planning').setAttribute('aria-pressed',String(plan));
}
export function showDayPreparation(){
 showPreparationArea(true);get<HTMLDetailsElement>('session-panel').open=true;
 get(planDraft?'session-fraction':'plan-create').focus();
}
const unwrap = <T>(result: Result<T>): T => { if (!result.ok) throw new Error(result.error); return result.value; };
let context: WorkspaceGeometry | null = null;
let preparationLoaded=false;
let data: Preparation = { notes: [], plans: [], locations: [], maps: [], problems: [], selection: { noteId: null, planId: null, sceneId: null } };
// Keep the validated campaign directory while Core returns only search matches.
// Rows share their existing text objects; each keystroke does not reload all prose.
const campaignNotes = new Map<string, Preparation['notes'][number]>();
let noteSearchLoad = 0;
let noteSearchError: {query: string; message: string} | null = null;
function usePreparation(next: Preparation, filtered = false) {
  data = next;preparationLoaded=true;get('preparation').inert=false;
  if (!filtered) { campaignNotes.clear(); noteSearchLoad++; noteSearchError = null; }
  for (const row of next.notes) campaignNotes.set(row.note.id, row);
}
const noteRow = (id: string | null) => id ? campaignNotes.get(id) : undefined;
let noteDraft: Note | null = null, planDraft: ManualPlan | null = null;
let excerptField:'readAloud'|'gmNotes'|null=null;
let excerpt:{source:import('./preparation-contracts').NoteExcerptSource;original:Note;text:string;token:string;load:number}|null=null;
let excerptBusy=false,excerptComposing=false;
let excerptChosen:Note|null=null,excerptExplicitNew=false,excerptLookup=0,excerptReading=false;
let excerptChoices:KeyNoteChoices={entries:[],more:false};
function excerptCurrent(input:NonNullable<typeof excerpt>){return excerpt===input&&context?.token===input.token&&editorSession.generation===input.load&&selectedNote===input.source.id;}
function excerptControls(){
 const chosen=excerptChosen;
 get<HTMLInputElement>('note-excerpt-title').readOnly=!!chosen;
 get<HTMLSelectElement>('note-excerpt-kind').disabled=!!chosen;
 get('note-excerpt-new-kind').hidden=!!chosen;
 get<HTMLButtonElement>('note-excerpt-new').hidden=!chosen&&!excerptChoices.entries.length;
 get<HTMLButtonElement>('note-excerpt-save').disabled=excerptReading;
 for(const button of get('note-excerpt-choices').querySelectorAll('button'))button.disabled=excerptReading;
 get('note-excerpt-save').textContent=chosen?'An vorhandene Notiz anhängen':'Notiz mit Herkunft anlegen';
 get('note-excerpt-text-label').textContent=chosen?'Wird am bisherigen Text angehängt':'Markierter Originaltext';
 get('note-excerpt-existing').hidden=!chosen;
 get('note-excerpt-existing-text').textContent=chosen?(chosen[excerpt!.source.field]||'Noch kein Text in diesem Feld.') :'';
 if(excerpt)get<HTMLTextAreaElement>('note-excerpt-text').value=chosen?appendNoteExcerpt({...chosen,readAloud:'',gmNotes:''},excerpt.original,excerpt.source.field,excerpt.text)[excerpt.source.field]:excerpt.text;
}
async function lookupExcerpt(){
 const input=excerpt,query=value('note-excerpt-title'),seq=++excerptLookup;
 excerptChosen=null;excerptExplicitNew=false;excerptReading=false;excerptChoices={entries:[],more:false};get('note-excerpt-choices').replaceChildren();excerptControls();
 if(!input||!query.trim()){get('note-excerpt-choices-status').textContent='Name eingeben, um vorhandene Originalnotizen zu finden.';return true;}
 get('note-excerpt-choices-status').textContent='Vorhandene Originalnotizen werden gesucht…';
 const current=()=>excerptCurrent(input)&&seq===excerptLookup&&query===value('note-excerpt-title');
 try{
  const choices=unwrap(await window.campaign.keyNoteChoices(input.token,query));if(!current())return false;
  excerptChoices=choices;
  get('note-excerpt-choices-status').textContent=choices.notice??(excerptChoices.entries.length?'Vorhandenes Original wählen oder ausdrücklich eine eigenständige neue Notiz anlegen.':'Keine passende vorhandene Notiz.');
  if(choices.more)get('note-excerpt-choices-status').append(' Weitere Treffer: Namen genauer eingeben.');
  for(const candidate of excerptChoices.entries){
   if(candidate.id===input.source.id)continue;
   const button=document.createElement('button');button.type='button';button.dataset.noteId=candidate.id;
   button.textContent=candidate.title+' · '+({note:'Notiz',npc:'NSC',faction:'Fraktion',quest:'Quest',rumor:'Gerücht',rule:'Regelreferenz'})[candidate.kind]+(candidate.preview?' · '+candidate.preview:'');
   button.onclick=()=>{void(async()=>{
    if(excerptBusy||excerptReading||!current())return;excerptReading=true;excerptControls();
    try{
     const [content,pendingDraft]=await Promise.all([window.campaign.deskContent(input.token,{kind:'note',id:candidate.id}),window.campaign.preparationDraft(input.token,'note',candidate.id)]);
     const original=unwrap(content),note=original.note,draft=unwrap(pendingDraft);
     if(!current())return;
     if(original.unavailable||original.ref.kind!=='note'||original.ref.id!==candidate.id||!note||note.id!==candidate.id||original.revision!==candidate.revision||note.revision!==candidate.revision)throw Error('Original wurde geändert. Namen erneut eingeben und Auswahl prüfen.');
     if(draft||retained.get(draftKey('note',candidate.id))||draftProblems.has(draftKey('note',candidate.id)))throw Error('Dieses Original hat einen offenen Arbeitsentwurf. Erst im Originaleditor aufklären.');
     excerptChosen=structuredClone(note);get<HTMLInputElement>('note-excerpt-title').value=note.title;get<HTMLSelectElement>('note-excerpt-kind').value=note.kind;
     get('note-excerpt-choices').replaceChildren();get('note-excerpt-choices-status').textContent='Vorhandenes Original: '+note.title+' · frühere Texte und Verwendungen bleiben erhalten.';
    }catch(error){if(current())get('note-excerpt-choices-status').textContent=(error as Error).message;}
    finally{if(excerptCurrent(input)&&seq===excerptLookup){excerptReading=false;excerptControls();}}
   })();};get('note-excerpt-choices').append(button);
  }
  excerptControls();return true;
 }catch(error){if(current())get('note-excerpt-choices-status').textContent='Suche fehlgeschlagen: '+(error as Error).message;return false;}
}
// A fallback loaded behind the knowledge editor is not a chosen destination.
let planningTarget:{planId:string;visitId:string|null}|null=null;
function rememberPlanningTarget(){planningTarget=selectedPlan?{planId:selectedPlan,visitId:selectedScene}:null;}
let selectedNote: string | null = null, selectedPlan: string | null = null, selectedScene: string | null = null;
let selectedLocation: string | null = null, locationDraft: LocationRow | null = null;
let openMap: (scopeId: string) => Promise<void>;
let timer: ReturnType<typeof setTimeout> | null = null;

const changesPending = new Set<Promise<void>>();
let composing = false, blocked = false;
let sceneSearchPlan:string|null=null;
let planningRenderedLoad=-1,planningOpening:{load:number;task:Promise<void>}|null=null;
let hasOpenInput = false;

let tell: (text: string, error?: boolean) => void;
let inspectNote: ((id:string,current:()=>boolean)=>Promise<void>) | undefined;
function syncSaveControl() { get('preparation-apply').hidden = !hasOpenInput || blocked; }
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
let locationNotebookOpen:(id:string)=>Promise<void>=async()=>{};
let roomUses:NoteRoomUses|null=null;
let noteThread:NoteThreadDialog|null=null;
let noteMerge:NoteMergeUI|null=null;
let roomKeyOpen:(id:string,current:()=>boolean,restore:()=>void,source?:{id:string;label:string})=>Promise<boolean>=async()=>false;
export function setNoteRoomNavigation(open:typeof roomKeyOpen){roomKeyOpen=open;}
export function setLocationNotebookNavigation(open:(id:string)=>Promise<void>){locationNotebookOpen=open;}
const originalNote = () => noteRow(selectedNote)?.note;
const originalPlan = () => data.plans.find(plan => plan.id === selectedPlan);
const originalLocation = () => data.locations.find(row => row.document.id === selectedLocation);
const retained = new Map<string, PreparationDraft | null>(), draftProblems = new Map<string, string>();

const draftKey = (kind: PreparationEdit['kind'], id: string) => `${kind}:${id}`;
export const preparationHasDrafts = () => !!noteMerge?.hasPending() || hasOpenInput || blocked || !!editorSession.reading || !!draftProblems.size;
async function loadedDraft(kind: PreparationEdit['kind'], id: string) {
  const key = draftKey(kind, id), token = context?.token, request = editorSession.generation;
  if (retained.has(key) || !token) return retained.get(key) ?? null;
  const read=editorSession.read();get('preparation').inert = true;
  try {
    const saved = unwrap(await window.campaign.preparationDraft(token, kind, id));
    if (context?.token !== token || request !== editorSession.generation) return null;
    retained.set(key, saved);
    if (saved) {
      hasOpenInput = true;
      if (saved.failedCommand) { failedCommandState.value = saved.failedCommand; blocked = true; get('preparation-reconcile').hidden = false; get('preparation-refresh').hidden = false; }
      syncSaveControl();
      tell('Offener Vorbereitungsentwurf wiederaufgenommen. Noch nicht als Autorenstand gespeichert.', true);
    }
    return saved;
  } catch (error) {
    if (context?.token !== token || request !== editorSession.generation) return null;
    const message = 'Entwurf bleibt gesperrt; Originalbytes bleiben erhalten: ' + (error as Error).message;
    retained.set(key, null); draftProblems.set(key, message); data.problems.push(message); renderProblems(); tell(message, true);
    return null;
  } finally { read.finish();if(read.current())get('preparation').inert = editorSession.reading > 0; }
}
async function retainOpenDrafts() {
  if (!context || editorSession.reading) throw new Error('Die Entwürfe werden noch geladen.');
  if (failedCommandState.value && (!['note', 'plan', 'location'].includes(failedCommandState.value.change.kind) || failedCommandState.value.change.expectedRevision === null)) throw new Error('Dieser offene Anlage-/Papierkorbauftrag muss vor dem Verlassen aufgeklärt werden.');
  const token = context.token, request = editorSession.generation, inputVersion=editorSession.input.version, values: PreparationEdit[] = [];
  if (noteDraft && originalNote()) values.push({ kind: 'note', expectedRevision: noteDraft.revision, note: structuredClone(noteDraft) });
  if (planDraft && originalPlan()) values.push({ kind: 'plan', expectedRevision: planDraft.revision, plan: structuredClone(planDraft) });
  if (locationDraft && originalLocation()) values.push({ kind: 'location', expectedRevision: locationDraft.revision, document: structuredClone(locationDraft.document) });
  // A handed-off command can own a different plan than the visible editor.
  // Preserve that owner and any already retained later input as well.
  if(failedCommandState.value&&['note','plan','location'].includes(failedCommandState.value.change.kind)){
    const target=preparationTarget(failedCommandState.value.change),key=draftKey(target.kind,target.id);
    if(!values.some(value=>{const owner=preparationTarget(value);return owner.kind===target.kind&&owner.id===target.id;}))values.push(structuredClone(retained.get(key)?.change??failedCommandState.value.change) as PreparationEdit);
  }
  const drafts: PreparationDraft[] = [], clean: { kind: PreparationEdit['kind']; id: string; saved: PreparationDraft }[] = [];
  for (const change of values) {
    const target = preparationTarget(change), key = draftKey(target.kind, target.id);
    if (draftProblems.has(key)) continue;
    const failedTarget = failedCommandState.value ? preparationTarget(failedCommandState.value.change) : null;
    const failed = failedTarget?.kind === target.kind && failedTarget.id === target.id ? failedCommandState.value : null;
    const original = change.kind === 'note' ? noteRow(target.id)?.note : change.kind === 'plan' ? data.plans.find(plan=>plan.id===target.id) : data.locations.find(row=>row.document.id===target.id)?.document;
    const value = change.kind === 'note' ? change.note : change.kind === 'plan' ? change.plan : change.document;
    const changed = !equal(value, original) || change.kind === 'location' && change.expectedRevision !== originalLocation()?.revision;
    if (changed || failed) drafts.push({ version: 1, writeId: crypto.randomUUID(), change, failedCommand: failed });
    else { const saved = retained.get(key); if (saved) clean.push({ ...target, saved }); }
  }
  if (drafts.length) unwrap(await window.campaign.keepPreparationDrafts(token, drafts));
  for (const item of clean) unwrap(await window.campaign.discardPreparationDraft(token, item.kind, item.id, item.saved.writeId));
  if (context?.token !== token || request !== editorSession.generation) return;
  for (const saved of drafts) { const t = preparationTarget(saved.change); retained.set(draftKey(t.kind, t.id), saved); }
  for (const item of clean) retained.set(draftKey(item.kind, item.id), null);
  editorSession.input.retained=inputVersion;
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
/** Opening preserves this editor; explicit activation renews its generation. */
export async function ensurePreparation(workspace:WorkspaceGeometry) {
  if(context?.token===workspace.token&&preparationLoaded){await ensurePlanningView();return;}
  await activatePreparation(workspace);
}
/** A linked note can load the directory before the planning controls ever mount. */
async function ensurePlanningView(){
  if(!context||!preparationLoaded||planningRenderedLoad===editorSession.generation)return;
  const load=editorSession.generation;if(planningOpening?.load===load)return planningOpening.task;
  if(!data.plans.some(p=>p.id===selectedPlan))selectedPlan=data.plans.find(p=>p.id===data.selection.planId)?.id??data.plans[0]?.id??null;
  if(selectedScene===null)selectedScene=data.selection.sceneId;
  const task=renderPlans();planningOpening={load,task};
  try{await task;}finally{if(planningOpening?.task===task)planningOpening=null;}
}
export async function activatePreparation(workspace: WorkspaceGeometry,load=true) {
  excerpt=null;excerptField=null;get<HTMLDialogElement>('note-excerpt-dialog').close();
  noteMerge?.activate(workspace.campaign.id);
  preparationLoaded=false;
  planningRenderedLoad=-1;planningOpening=null;planningTarget=null;
  noteThread?.reset();
  roomUses?.reset();
  const request = ++editorSession.generation;sceneSearchPlan=null;get<HTMLInputElement>('scene-search').value='';
  campaignNotes.clear(); noteSearchLoad++; noteSearchError = null;
  context = workspace; blocked = false; failedCommandState.value = null; hasOpenInput = false; noteDraft = null; planDraft = null; locationDraft = null;
  retained.clear(); draftProblems.clear();
  composing = false; if (timer) clearTimeout(timer); timer = null;
  get('preparation-reconcile').hidden = true; get('preparation-refresh').hidden = true; syncSaveControl();
  data={notes:[],plans:[],locations:[],maps:[],problems:[],selection:{noteId:null,planId:null,sceneId:null}};selectedNote=null;selectedPlan=null;selectedScene=null;selectedLocation=null;
  if(!load){get('preparation').inert=true;return;}
  try {
    const response = await window.campaign.preparation(workspace.token, '');
    if (request !== editorSession.generation || context?.token !== workspace.token) return;
    usePreparation(unwrap(response));preparationLoaded=true;
    selectedNote = data.notes.some(row => row.note.id === data.selection.noteId && !row.trashed) ? data.selection.noteId : data.notes.find(row => !row.trashed)?.note.id ?? null;
    selectedPlan = data.plans.some(plan => plan.id === data.selection.planId) ? data.selection.planId : data.plans[0]?.id ?? null;
    selectedScene = data.selection.sceneId;
    selectedLocation = data.locations.some(row => row.document.id === data.selection.locationId) ? data.selection.locationId! : data.locations.find(row => !row.trashed)?.document.id ?? null;
    await Promise.all([renderNotes(), renderPlans(), renderLocations()]);
    if (request === editorSession.generation && context?.token === workspace.token) renderProblems();
  } catch (error) {
    if (request === editorSession.generation && context?.token === workspace.token) throw error;
  }
}
async function checkpoint() {
  if (!context) return;
  const token = context.token, request = editorSession.generation;
  const selection = { noteId: selectedNote, planId: selectedPlan, sceneId: selectedScene, locationId: selectedLocation };
  try {
    const response = await window.campaign.selectPreparation(token, selection);
    if (context?.token === token && request === editorSession.generation) unwrap(response);
  } catch (error) {
    if (context?.token === token && request === editorSession.generation) tell('Auswahlcheckpoint fehlgeschlagen: ' + (error as Error).message, true);
  }
}
function renderProblems() {
  const problems = [...new Set([...data.problems, ...draftProblems.values()])];
  get('preparation-problems').textContent = problems.join('\n');
  get('preparation-problems').hidden = !problems.length;
}
function acceptPlan(plan:ManualPlan|null,id:string){
 if(plan&&plan.id!==id)throw new Error('Planantwort gehört nicht zum ursprünglichen Auftrag.');
 const plans=data.plans.filter(row=>row.id!==id);if(plan)plans.push(plan);
 plans.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:a.id<b.id?-1:a.id>b.id?1:0);
 data={...data,plans};
}
async function change(change: PreparationChange, redraw = true, stillCurrent:()=>boolean=()=>true): Promise<boolean> {
  if (!context || blocked || !stillCurrent()) return false;
  if (changesPending.size) { tell('Vorherige Vorbereitung wird noch gespeichert.'); return false; }
  const token = context.token, current=editorSession.capture(()=>[context?.token,editorSession.generation],stillCurrent);
  const target = preparationTarget(change), key = draftKey(target.kind, target.id);
  const command: PreparationCommand = { commandId: crypto.randomUUID(), token, campaignId: context.campaign.id, draftWriteId: retained.get(key)?.writeId, change };
  tell('Wird gespeichert…');
  let complete!: () => void;
  const completion = new Promise<void>(resolve => { complete = resolve; }); changesPending.add(completion);
  try {
    // A normal timeline edit confirms only its owner, not the whole world directory.
    const result = command.change.kind==='plan'
      ? unwrap(await window.campaign.changePreparationPlan(command))
      : unwrap(await window.campaign.changePreparation(command));
    if (context?.token !== token || !current()) return false;
    if(command.change.kind==='plan')acceptPlan(result as ManualPlan,command.change.plan.id);
    else usePreparation(result as Preparation);
    if (command.change.kind!=='plan'&&value('world-search').trim()) await reloadNoteSearch(false);
    if (context?.token !== token || !current()) return false;
    retained.delete(key);
    if (command.change.kind === 'plan' && planDraft?.id === command.change.plan.id) {
      const sent = command.change.plan;
      const confirmed = data.plans.find(p => p.id === sent.id);
      if (confirmed) planDraft = preservePlanInput(confirmed, sent, planDraft);
    }
    if(redraw){if(command.change.kind==='plan')await renderPlans();else await Promise.all([renderNotes(),renderPlans(),renderLocations()]);}
    if(!current())return false;renderProblems(); syncSaveControl(); tell('Gespeichert.'); return true;
  } catch (error) {
    if (context?.token !== token || !current()) return false;
    if (change.kind === 'plan' && planDraft?.id === change.plan.id && originalPlan()) planDraft = preservePlanInput(change.plan, originalPlan()!, planDraft);
    blocked = true; failedCommandState.value = command; get('preparation-refresh').hidden = false; get('preparation-reconcile').hidden = false; syncSaveControl();
    try { await retainOpenDrafts(); if(!current())return false; tell((error as Error).message + ' Entwurf gesichert. Kein automatischer Neuversuch.', true); }
    catch (draftError) { if(!current())return false; tell((error as Error).message + ' Entwurf bleibt im Speicher: ' + (draftError as Error).message, true); }
    return false;
  }
  finally { changesPending.delete(completion); complete(); }
}
export async function flushPreparation(skipSession=false,skipNarrative=false): Promise<boolean> {
  if(noteMerge?.hasPending())return false;
  if(!skipNarrative&&!await flushNarrative())return false;
  if(!skipSession&&!await flushSession())return false;
  if (timer) clearTimeout(timer); timer = null;
  if (pendingWork.value) { const result = await pendingWork.value; return result ? flushPreparation(skipSession,skipNarrative) : false; }
  if (changesPending.size) { await Promise.all(changesPending); return flushPreparation(skipSession,skipNarrative); }
  if (!context) return true;
  if (editorSession.reading) return false;
  if (blocked || composing) return false;
  const beforeNote = originalNote(), beforePlan = originalPlan();
  const beforeLocation = originalLocation();
  const changedNote = noteDraft && beforeNote && !equal(noteDraft, beforeNote), changedPlan = planDraft && beforePlan && !equal(planDraft, beforePlan);
  const changedLocation = locationDraft && beforeLocation && !equal(locationDraft, beforeLocation);
  if (!changedNote && !changedPlan && !changedLocation) { if (hasOpenInput) { await retainOpenDrafts(); hasOpenInput = false; syncSaveControl(); tell('Gespeichert.'); } return true; }
  pendingWork.value = (async () => {
    if (changedNote) {
      const sent = structuredClone(noteDraft!);
      if (!(await change({ kind: 'note', expectedRevision: sent.revision, note: sent }, false))) return false;
      const current = originalNote()!;
      if (noteDraft) noteDraft = { ...noteDraft, revision: current.revision };
      renderNoteList();
      if(!await acceptNarrativeNoteReceipt(context!,beforeNote!,current))return false;
    }
    if (changedPlan) {
      const sent = structuredClone(planDraft!);
      if (!(await change({ kind: 'plan', expectedRevision: sent.revision, plan: sent }, false))) return false;
      if (planDraft) planDraft = { ...planDraft, revision: originalPlan()!.revision };
      const option=[...get<HTMLSelectElement>('plans').options].find(o=>o.value===sent.id);
      if(option)option.textContent=originalPlan()!.name||'Unbenannter Plan';
      renderSceneList(); renderSceneLocation();
      // Publish the acknowledged plan revision without replacing live session inputs.
      await sessionContext(context,planDraft,selectedScene,data);
    }
    if (changedLocation) {
      const sent = structuredClone(locationDraft!);
      if (!(await change({ kind: 'location', expectedRevision: sent.revision, document: sent.document }, false))) return false;
      if (locationDraft) locationDraft = { ...locationDraft, revision: originalLocation()!.revision };
      renderLocationList(); renderSceneLocation(); renderLocationMapActions();
    }
    hasOpenInput = !!(noteDraft && originalNote() && !equal(noteDraft, originalNote()) || planDraft && originalPlan() && !equal(planDraft, originalPlan()) || locationDraft && originalLocation() && !equal(locationDraft, originalLocation()));
    if(!hasOpenInput)editorSession.input.retained=editorSession.input.version;
    syncSaveControl(); tell(hasOpenInput ? 'Weitere Vorbereitungseingabe offen – noch nicht gespeichert.' : 'Gespeichert.');
    return true;
  })();
  const okay = await pendingWork.value;
  return okay ? flushPreparation(skipSession,skipNarrative) : false;
}
function schedule() {
  editorSession.input.version++;
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
  const request = ++noteSearchLoad, preparation = editorSession.generation;
  const current = () => context?.token === token && value('world-search') === query && noteSearchLoad === request && editorSession.generation === preparation;
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
async function renderNotes(initialLocationId?:string) {
  noteEditorGeneration++;
  if(!noteThread?.ownsNote(selectedNote))noteThread?.reset();

  const row = noteRow(selectedNote); noteDraft = row && !row.trashed ? structuredClone(row.note) : null;
  const token = context?.token, target = selectedNote, request = editorSession.generation;
  roomUses?.prepare(token??null,target);
  const saved = row ? await loadedDraft('note', row.note.id) : null;
  if (context?.token !== token || request !== editorSession.generation || selectedNote !== target) return;
  if (saved?.change.kind === 'note' && !row?.trashed) noteDraft = structuredClone(saved.change.note);
  get('note-editor').hidden = !row; get('note-empty').hidden = !!row;
  renderNoteList();
  get<HTMLButtonElement>('note-text-reference').disabled=!row||row.trashed||blocked||draftProblems.has(draftKey('note', row.note.id));
  get<HTMLButtonElement>('note-excerpt').disabled=!row||row.trashed||blocked||draftProblems.has(draftKey('note',row.note.id));
  excerptField=null;get('note-excerpt-status').replaceChildren();get('note-excerpt').hidden=true;get('note-gm').after(get('note-selection-actions'));
  if (!row) return;
  void checkpoint();
  const shown = noteDraft ?? row.note;
  get<HTMLInputElement>('note-title').value = shown.title;
  get<HTMLTextAreaElement>('note-read-aloud').value = shown.readAloud;
  get<HTMLDetailsElement>('note-read-aloud-details').open = !!shown.readAloud;
  get<HTMLTextAreaElement>('note-gm').value = shown.gmNotes;
  get('note-kind').textContent = ({ note: 'Notiz', npc: 'NSC', faction: 'Fraktion', quest: 'Quest', rumor: 'Gerücht', rule: 'Regel' })[row.note.kind];
  for (const id of ['note-title', 'note-read-aloud', 'note-gm']) get<HTMLInputElement>(id).disabled = row.trashed || draftProblems.has(draftKey('note', row.note.id));
  const mergeButton=get('note-merge-open');if(mergeButton)mergeButton.hidden=row.trashed||row.note.kind!=='npc';
  const focusAction = ['note-remove','note-restore'].includes(document.activeElement?.id ?? '');
  get('note-remove').hidden = row.trashed; get('note-restore').hidden = !row.trashed;
  if(focusAction)focusNoteEditor();
  if(token&&target)roomUses?.show(token,target,()=>context?.token===token&&selectedNote===target&&request===editorSession.generation);
  renderRelations();await showNarrative(context,row.note,row.trashed,()=>flushPreparation(true,true),tell,undefined,undefined,initialLocationId);
}
function renderSceneList() {
  const list = get('scene-list'); list.replaceChildren();
  const plan = planDraft ?? originalPlan(),token=context?.token;
  const query=value('scene-search'),terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const locations=new Map(data.locations.map(row=>[row.document.id,row.document.name]));
  const readAlouds=terms.length?sessionVisitReadAlouds(token,plan?.id):null;
  let matches=0,selectedVisible=false;
  plan?.scenes.forEach((scene, index) => {
    const text=[scene.title,scene.notes,readAlouds?.get(scene.id)??'',scene.locationId?locations.get(scene.locationId)??'':''].join('\n').toLocaleLowerCase();
    if(!terms.every(term=>text.includes(term)))return;
    matches++;if(scene.id===selectedScene)selectedVisible=true;
    const button = document.createElement('button'); button.textContent = `${index + 1}. ${scene.title || 'Unbenannte Szene'}`;
    button.setAttribute('aria-pressed', String(scene.id === selectedScene));
    button.onclick = () => { void (async () => {
      if(context?.token!==token||selectedPlan!==plan.id||!(await leavePreparation()))return;
      if(context?.token!==token||selectedPlan!==plan.id)return;
      selectedScene = scene.id;rememberPlanningTarget(); await renderPlans(); get<HTMLInputElement>('scene-title').focus();
    })(); }; list.append(button);
  });
  get('scene-search-clear').hidden=!query;
  get('scene-search-status').textContent=matches+' von '+(plan?.scenes.length??0)+' Besuchen'+(!matches?' · Keine passenden Besuche.':'')+(selectedScene&&!selectedVisible?' · Der ausgewählte Besuch bleibt im Editor geöffnet.':'');
}
function renderPlanOptions(){
  const select = get<HTMLSelectElement>('plans'); select.replaceChildren();
  for (const plan of data.plans) { const option = document.createElement('option'); option.value = plan.id; option.textContent = plan.name || 'Unbenannter Plan'; select.append(option); }
  select.value = selectedPlan ?? '';
}
async function renderPlans() {
  renderPlanOptions();
  if(sceneSearchPlan!==selectedPlan){sceneSearchPlan=selectedPlan;get<HTMLInputElement>('scene-search').value='';}
  const confirmed = originalPlan();
  const token = context?.token, target = selectedPlan, request = editorSession.generation;
  const saved = confirmed ? await loadedDraft('plan', confirmed.id) : null;
  if (context?.token !== token || request !== editorSession.generation || selectedPlan !== target) return;
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
  if(context?.token!==token||request!==editorSession.generation||selectedPlan!==target)return;
  planningRenderedLoad=request;
  renderSceneList();
  void checkpoint();
}
/** Preserve only the known editable fields entered after this exact plan command was sent. */
function preservePlanInput(confirmed: ManualPlan, sent: ManualPlan, current: ManualPlan): ManualPlan {
  const sentVisits=new Map(sent.scenes.map(scene=>[scene.id,scene])),currentVisits=new Map(current.scenes.map(scene=>[scene.id,scene]));
  return { ...acknowledgeFields(confirmed,sent,current,['name']).value,
    scenes: confirmed.scenes.map(scene => {
      const before = sentVisits.get(scene.id), draft = currentVisits.get(scene.id);
      if (!before || !draft) return scene;
      return acknowledgeFields(scene,before,draft,['title','notes','locationId']).value;
    }) };
}
async function changeNoteRelations(relations:Note['relations']){
  const token=context?.token,id=selectedNote,request=editorSession.generation;
  if(!token||!noteDraft||noteDraft.id!==id||blocked||composing)return false;
  noteDraft={...noteDraft,relations};renderRelations();schedule();
  return await flushPreparation()&&context?.token===token&&request===editorSession.generation&&selectedNote===id;
}
let noteEditorGeneration=0,locationSectionsGeneration=0;
async function insertNoteTextReference(){
 const owner=context,token=owner?.token,campaignId=owner?.campaign.id,id=selectedNote,run=editorSession.generation,editor=noteEditorGeneration,button=get<HTMLButtonElement>('note-text-reference'),area=get<HTMLTextAreaElement>('note-gm');
 if(!token||!id||!noteDraft||!button.isConnected||button.disabled||area.disabled||blocked)return;
 // Flush may confirm a revision, but cannot authorize a different text/selection.
 const before=noteDraft.gmNotes,input=area.value,start=area.selectionStart,end=area.selectionEnd,alias=input.slice(start,end);
 const current=()=>context===owner&&context?.token===token&&context?.campaign.id===campaignId&&editorSession.generation===run&&noteEditorGeneration===editor&&selectedNote===id&&!!noteDraft&&noteDraft.gmNotes===before&&area.isConnected&&!area.disabled&&!blocked;
 button.disabled=true;
 try{
  if(!await flushPreparation()||!current())return;
  const link=await chooseTextReference(token,alias,current);if(!link||!current())return;
  const from=rawTextOffset(before,start),to=rawTextOffset(before,end);
  noteDraft={...noteDraft!,gmNotes:before.slice(0,from)+link+before.slice(to)};area.value=noteDraft.gmNotes;schedule();area.focus();const caret=start+link.replace(/\r\n/g,'\n').length;area.setSelectionRange(caret,caret);
 }catch(error){if(current())tell((error as Error).message,true);}
 finally{if(context===owner&&editorSession.generation===run&&noteEditorGeneration===editor&&selectedNote===id)button.disabled=area.disabled||blocked;}
}
export function initPreparation(status: (text: string, error?: boolean) => void, navigateMap: (scopeId: string) => Promise<void>, offerVisit?: (planId: string, visitId: string, current?:()=>boolean) => Promise<void>, inspect?: (id:string,current:()=>boolean)=>Promise<void>) {
  inspectNote=inspect;
  const mergeButton=document.createElement('button');mergeButton.id='note-merge-open';mergeButton.type='button';mergeButton.textContent='NSC-Notizen zusammenführen…';get('note-remove').before(mergeButton);
  noteMerge=new NoteMergeUI(mergeButton,get('preparation'),{
    api:window.campaign,storage:window.localStorage,tell:status,
    prepare:async()=>{
      const owner=context,run=editorSession.generation;if(!owner)return null;
      if(!noteMerge?.hasPending()&&!await flushPreparation())return null;
      if(context!==owner||editorSession.generation!==run)return null;
      if(!preparationLoaded){const next=unwrap(await window.campaign.preparation(owner.token,''));if(context!==owner||editorSession.generation!==run)return null;usePreparation(next);}
      return {token:owner.token,campaignId:owner.campaign.id,sourceId:selectedNote,notes:[...campaignNotes.values()],current:()=>context===owner&&editorSession.generation===run};
    },
    done:async(id,next,owner)=>{
      if(!owner.current())return;
      usePreparation(next);noteDraft=null;selectedNote=id;get<HTMLInputElement>('world-trash').checked=false;get<HTMLInputElement>('world-search').value='';
      showPreparationArea(false);showLocations(false);await renderNotes();if(!owner.current())return;await renderPlans();
      if(owner.current())revealNote(id);
    }
  });
  const uses=get('note-room-uses');if(uses)roomUses=new NoteRoomUses(uses,(token,id,offset)=>window.campaign.noteRoomUses(token,id,offset),(id,current,restore)=>{const source=originalNote();return roomKeyOpen(id,current,()=>{showPreparationArea(false);showLocations(false);restore(true);if(selectedNote)revealNote(selectedNote);},source?{id:source.id,label:noteDraft?.title??source.title}:undefined);});
  tell = (text,error)=>{status(text,error);noteThread?.feedback(text,error);packetNoteFeedback(text,error);};
  for(const [id,plan] of [['preparation-knowledge',false],['preparation-planning',true]] as const)get(id).onclick=()=>{void(async()=>{const owner=context;if(!await leavePreparation()||context!==owner)return;if(plan)await ensurePlanningView();if(context===owner)showPreparationArea(plan);})().catch(error=>tell(error.message,true));};
  if(!get<HTMLSelectElement>('world-kind').querySelector('option[value="rule"]')){const option=document.createElement('option');option.value='rule';option.textContent='Regelreferenz';get<HTMLSelectElement>('world-kind').append(option);}
  initSession(status,()=>flushPreparation(true),async (id,planId)=>{
    if(!context)return;const token=context.token,request=editorSession.generation,query=value('world-search'),current=()=>context?.token===token&&request===editorSession.generation;
    const next=unwrap(await window.campaign.preparation(token,query));if(!current())return;
    usePreparation(next,!!query.trim());if(planId){selectedPlan=planId;planDraft=null;selectedScene=null;}if(id)selectedScene=id;
    await renderPlans();if(!current())return;await renderNotes();if(current())await renderLocations();
  },async id=>{await openPreparedNote(id);},()=>{editorSession.input.version++;},offerVisit?async(planId,visitId,current)=>offerVisit(planId,visitId,current):undefined);
  registerPreparationPacketEditor(()=>{const origin=selectedNote,planning=get('preparation-planning').getAttribute('aria-pressed')==='true';return{open:(id,current)=>openPreparedNote(id,current),finish:async current=>{if(!current()||!await flushPreparation()||!current())return false;if(origin&&selectedNote!==origin&&!await openPreparedNote(origin,current))return false;if(!current())return false;showPreparationArea(planning);return true;}};});
  openMap = navigateMap;
  noteThread=new NoteThreadDialog({api:{noteThread:(...a)=>window.campaign.noteThread(...a),checkNoteThread:(...a)=>window.campaign.checkNoteThread(...a),searchDesk:(...a)=>window.campaign.searchDesk(...a),deskContent:(...a)=>window.campaign.deskContent(...a),noteRoomUses:(...a)=>window.campaign.noteRoomUses(...a)},tell:status,
   prepare:async()=>{const owner=context,id=selectedNote,run=editorSession.generation,editor=noteEditorGeneration;if(!owner||!id||!await flushPreparation()||context!==owner||editorSession.generation!==run||selectedNote!==id||noteEditorGeneration!==editor||!noteDraft)return null;const current=()=>context===owner&&editorSession.generation===run&&(selectedNote===id||!!noteThread?.ownsContext(id,selectedNote));
    return{token:owner.token,id,plans:[...data.plans],destination:planningTarget?{...planningTarget}:undefined,current,edit:(target,live)=>openPreparedNote(target,()=>current()&&live()),returnToRoot:live=>openPreparedNote(id,()=>current()&&live()),blocked:()=>blocked||composing||hasPendingCommit(owner.campaign.id),room:(room,current,restore)=>roomKeyOpen(room,current,restore),
     add:async(root,ids)=>{if(!current()||!await flushPreparation()||!current()||!noteDraft||noteDraft.id!==root.id||noteDraft.revision!==root.revision)throw Error('Übersichtsnotiz geändert. Schließen und die Notiz neu öffnen.');const existing=new Set(noteDraft.relations.map(r=>r.targetId));return changeNoteRelations([...noteDraft.relations,...ids.filter(id=>!existing.has(campaignLocalId(id))).map(id=>({targetId:campaignLocalId(id),label:'Quelle'}))]);},
     detach:async(root,id,live)=>{
      const valid=()=>current()&&live()&&selectedNote===root.id;
      if(!valid()||!await flushPreparation()||!valid()||!noteDraft||noteDraft.id!==root.id||noteDraft.revision!==root.revision)throw Error('Übersichtsnotiz geändert. Verknüpfungen erneut prüfen.');
      const removal=detachNoteSource(noteDraft,id);
      if(!removal.relationships.length&&!removal.readAloud&&!removal.gmNotes)throw Error('Diese Quelle ist nicht mehr mit der Übersicht verknüpft.');
      noteDraft=removal.note;
      get<HTMLTextAreaElement>('note-read-aloud').value=noteDraft.readAloud;
      get<HTMLTextAreaElement>('note-gm').value=noteDraft.gmNotes;
      renderRelations();schedule();
      return await flushPreparation()&&valid();
     },
     restore:async(root,recovery,live)=>{
      const valid=()=>current()&&live()&&selectedNote===root.id;
      if(!valid()||!await flushPreparation()||!valid()||!noteDraft||noteDraft.id!==root.id||noteDraft.revision!==root.revision)throw Error('Übersichtsnotiz geändert. Wiederherstellung erneut prüfen.');
      noteDraft=restoreNoteSource(noteDraft,recovery);
      get<HTMLTextAreaElement>('note-read-aloud').value=noteDraft.readAloud;
      get<HTMLTextAreaElement>('note-gm').value=noteDraft.gmNotes;
      renderRelations();schedule();
      return await flushPreparation()&&valid();
     },
     use:async(target,selection,live)=>{const valid=()=>current()&&live();if(!valid())return false;if(target.planId&&target.visitId){await openPreparedVisit(target.planId,target.visitId,valid);if(!valid())return false;return linkVisitNoteThread(owner.token,target.planId,target.visitId,selection,valid);}const ids=[...selection.entries.map(e=>e.id),...(selection.includeRoot?[selection.rootId]:[])];const made=await prepareNextVisit(target.planId,{title:target.title,notes:'',locationId:null,noteIds:ids,newPlan:!target.planId,newPlanName:target.planName,noteThread:selection},valid);return !!made;}
    };}
  });
  const threadButton=document.createElement('button');threadButton.id='note-thread-open';threadButton.type='button';threadButton.textContent='Notizmappe öffnen…';get('note-text-tools').after(threadButton);threadButton.onclick=()=>void noteThread!.open().catch(error=>tell(error.message,true));
  const prepareThread=document.createElement('button');prepareThread.id='note-thread-prepare';prepareThread.type='button';prepareThread.textContent='Für Spielabend verwenden…';get('note-back').after(prepareThread);prepareThread.onclick=()=>void noteThread!.open(true).catch(error=>tell(error.message,true));
  get('note-text-reference').onclick=()=>{void insertNoteTextReference();};
  get('note-back').onclick = () => { const search = get('world-search'); search.focus({ preventScroll: true }); search.scrollIntoView({ block: 'center' }); };
  get('world-new').onclick = () => { get<HTMLDialogElement>('world-dialog').showModal(); get('world-name').focus(); };
  get('world-cancel').onclick = () => get<HTMLDialogElement>('world-dialog').close();
  for(const [id,field]of [['note-read-aloud','readAloud'],['note-gm','gmNotes']] as const){
   const area=get<HTMLTextAreaElement>(id);
   const selectionChanged=()=>{
    excerptField=field;
    // Keep the action next to the selected field, including inside read-aloud.
    area.after(get('note-selection-actions'));
    get('note-excerpt').hidden=!area.value.slice(area.selectionStart,area.selectionEnd).trim();
   };
   for(const event of ['focus','select','keyup','mouseup','input'])area.addEventListener(event,selectionChanged);
  }
  get('note-excerpt').onclick=()=>{void(async()=>{
    const field=excerptField??'gmNotes',area=get<HTMLTextAreaElement>(field==='gmNotes'?'note-gm':'note-read-aloud'),before=noteDraft;
    if(!before||blocked||excerptBusy)return;
    const start=rawTextOffset(before[field],area.selectionStart),end=rawTextOffset(before[field],area.selectionEnd),text=before[field].slice(start,end);
    if(!text.trim()){get('note-excerpt-status').textContent='Markiere zuerst den gewünschten Text unter „Zum Vorlesen“ oder „Notizen für die Spielleitung“.';area.focus();return;}
    const token=context?.token,load=editorSession.generation,edit=editorSession.input.version;
    if(!await flushPreparation()||context?.token!==token||editorSession.generation!==load||selectedNote!==before.id||editorSession.input.version!==edit)return;
    const source=originalNote();if(!source||source[field].slice(start,end)!==text)return;
    excerpt={source:{id:source.id,revision:source.revision,field,start,end},original:source,text,token:token!,load};
    get('note-excerpt-origin').textContent='Quelle: '+source.title+' · '+(field==='gmNotes'?'privater GM-Text':'Text zum Vorlesen');
    get<HTMLInputElement>('note-excerpt-title').value='';get<HTMLSelectElement>('note-excerpt-kind').value='note';get<HTMLTextAreaElement>('note-excerpt-text').value=text;
    excerptComposing=false;get<HTMLDetailsElement>('note-excerpt-existing').open=false;void lookupExcerpt();
    get<HTMLDialogElement>('note-excerpt-dialog').showModal();get('note-excerpt-title').focus();
  })();};
  get('note-excerpt-cancel').onclick=()=>{if(!excerptBusy){get<HTMLDialogElement>('note-excerpt-dialog').close();excerpt=null;}};
  get('note-excerpt-dialog').addEventListener('cancel',event=>{if(excerptBusy)event.preventDefault();else excerpt=null;});
  get('note-excerpt-title').oninput=()=>{if(!excerptBusy)void lookupExcerpt();};
  get('note-excerpt-form').addEventListener('compositionstart',()=>{excerptComposing=true;});
  get('note-excerpt-form').addEventListener('compositionend',()=>{excerptComposing=false;});
  get('note-excerpt-new').onclick=()=>{if(excerptBusy||excerptReading)return;excerptChosen=null;excerptExplicitNew=true;get('note-excerpt-choices-status').textContent='Eigenständige neue Notiz gewählt. Vorhandene Originale bleiben getrennt.';excerptControls();};
  get('note-excerpt-form').onsubmit=event=>{event.preventDefault();void(async()=>{
    const input=excerpt;if(!input||excerptBusy||excerptReading||excerptComposing||blocked||!value('note-excerpt-title').trim())return;
    const current=()=>excerptCurrent(input);
    if(!current())return;excerptBusy=true;get('note-excerpt-form').inert=true;
    try{
      if(!excerptChosen){
        const title=value('note-excerpt-title'),explicit=excerptExplicitNew;
        if(!await lookupExcerpt()||!current()||title!==value('note-excerpt-title'))return;
        excerptExplicitNew=explicit;
        if(!explicit&&excerptChoices.entries.some(n=>normalizedNoteTitle(n.title)===normalizedNoteTitle(title))){get('note-excerpt-choices-status').textContent='Diesen Namen gibt es bereits. Original wählen oder ausdrücklich eigenständig neu anlegen.';return;}
      }
      const chosen=excerptChosen;
      const note:Note=chosen?appendNoteExcerpt(chosen,input.original,input.source.field,input.text):{version:1,id:campaignLocalId(crypto.randomUUID()),revision:1,kind:value('note-excerpt-kind') as Note['kind'],title:value('note-excerpt-title'),readAloud:input.source.field==='readAloud'?input.text:'',gmNotes:input.source.field==='gmNotes'?input.text:'',relations:[{targetId:campaignLocalId(input.source.id),label:'Quelle'}],creatureId:null,deleted:false};
      const saved=await change({kind:'note',expectedRevision:chosen?.revision??null,note,excerpt:{...input.source,...(excerptExplicitNew?{allowSameTitle:true}:{})}},false,current);
      if(!current())return;
      // An unconfirmed request is resolved through the existing preparation
      // controls, outside the modal. Never resend it automatically.
      get<HTMLDialogElement>('note-excerpt-dialog').close();excerpt=null;
      if(!saved)return;
      noteDraft=structuredClone(originalNote()!);renderNoteList();renderRelations();
      const status=get('note-excerpt-status');status.replaceChildren(document.createTextNode('„'+note.title+'“ '+(chosen?'ergänzt':'angelegt')+' · Herkunft und Auszug verknüpft. '));
      const open=document.createElement('button');open.type='button';open.textContent=chosen?'Originalnotiz öffnen':'Neue Notiz öffnen';open.onclick=()=>{if(context?.token===input.token)void openPreparedNote(note.id);};status.append(open);
      const area=get<HTMLTextAreaElement>(input.source.field==='gmNotes'?'note-gm':'note-read-aloud');area.focus();const end=noteDraft[input.source.field].slice(0,input.source.end).replace(/\r\n?/g,'\n').length;area.setSelectionRange(end,end);
    }finally{excerptBusy=false;get('note-excerpt-form').inert=false;}
  })();};
  get('world-form').onsubmit = event => { event.preventDefault(); void (async () => {
    const token = context?.token;
    if (!context || !(await flushPreparation()) || context?.token !== token) return;
    const note: Note = { version: 1, id: campaignLocalId(crypto.randomUUID()), revision: 1, kind: value('world-kind') as Note['kind'], title: value('world-name'), readAloud: '', gmNotes: '', relations: [], creatureId: null, deleted: false };
    if (await change({ kind: 'note', expectedRevision: null, note }, false)) { selectedNote = note.id; get<HTMLDialogElement>('world-dialog').close(); get<HTMLInputElement>('world-name').value = ''; get<HTMLInputElement>('world-trash').checked = false; renderNotes(); get('note-title').focus(); }
  })(); };
  for (const [id, field] of [['note-title', 'title'], ['note-read-aloud', 'readAloud'], ['note-gm', 'gmNotes']] as const) {
    get(id).addEventListener('input', () => { if (noteDraft) { const text = value(id), before = originalNote()!; noteDraft = { ...noteDraft, [field]: text === before[field].replace(/\r\n?/g, '\n') ? before[field] : field === 'title' ? text : preserveLiteralEdit(noteDraft[field], text) }; schedule(); } });
    get(id).addEventListener('blur', () => { if (!composing) void flushPreparation(); });
  }
  for (const [id, trashed] of [['note-remove', true], ['note-restore', false]] as const) get(id).onclick = () => { void (async () => {
    const token = context?.token, target = selectedNote, request = editorSession.generation;
    if (!(await flushPreparation()) || context?.token !== token || request !== editorSession.generation || selectedNote !== target) return; const before = originalNote(); if (!before) return;
    const inMap = noteThread?.editorId === before.id;
    if (await change({ kind: 'note-trash', id: before.id, expectedRevision: before.revision, trashed }, false)) {
      if (context?.token !== token || request !== editorSession.generation || selectedNote !== target) return;
      selectedNote = inMap ? before.id : null;
      if (inMap) get<HTMLInputElement>('world-trash').checked = trashed;
      await renderNotes();
    }
  })(); };
  get('world-trash').addEventListener('change', () => { void (async () => { if (!(await flushPreparation())) return; selectedNote = null; renderNotes(); })(); });
  get('world-search').addEventListener('input', () => { void (async () => {
    if (!context || !(await flushPreparation())) return;
    await reloadNoteSearch(true);
  })(); });
  get('scene-search').addEventListener('input',renderSceneList);
  get('scene-search-clear').onclick=()=>{get<HTMLInputElement>('scene-search').value='';renderSceneList();get('scene-search').focus();};
  get('plan-create').onclick = () => { void (async () => {
    const token = context?.token;
    if (!context || !(await flushPreparation()) || context?.token !== token) return;
    const plan: ManualPlan = { version: 1, id: campaignLocalId(crypto.randomUUID()), revision: 1, name: '', scenes: [] };
    if (await change({ kind: 'plan', expectedRevision: null, plan }, false)) { selectedPlan = plan.id; selectedScene = null; showPreparationArea(true);renderPlans(); get('plan-name').focus(); }
  })(); };
  get('plans').addEventListener('change', () => { void (async () => { if (!(await leavePreparation())) { get<HTMLSelectElement>('plans').value = selectedPlan ?? ''; return; } selectedPlan = value('plans'); selectedScene = null;rememberPlanningTarget(); await renderPlans(); })(); });
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
    if (pendingWork.value && !(await pendingWork.value)) return;
    if (!planDraft || blocked || composing || context?.token !== token || selectedPlan !== planId) return;
    const id = campaignLocalId(crypto.randomUUID());
    const next = { ...planDraft, scenes: [...planDraft.scenes, { id, title: 'Neue Szene', notes: '', locationId: null }] };
    if (await change({ kind: 'plan', expectedRevision: next.revision, plan: next }, false)) { selectedScene = id; get<HTMLInputElement>('scene-search').value='';await renderPlans(); if(context?.token===token&&selectedPlan===planId&&selectedScene===id){rememberPlanningTarget();const title=get<HTMLInputElement>('scene-title');title.focus();title.select();} }
  })(); };
  for (const [id, field] of [['scene-title', 'title'], ['scene-notes', 'notes']] as const) {
    get(id).addEventListener('input', () => { if (planDraft) { const before = originalPlan()?.scenes.find(s => s.id === selectedScene), text = value(id); planDraft = { ...planDraft, scenes: planDraft.scenes.map(s => s.id === selectedScene ? { ...s, [field]: before && text === before[field].replace(/\r\n?/g, '\n') ? before[field] : field==='notes'?preserveLiteralEdit(s.notes,text):text } : s) }; schedule(); } });
    get(id).addEventListener('blur', () => { if (!composing) void flushPreparation(); });
  }
  for (const [id, delta] of [['scene-up', -1], ['scene-down', 1]] as const) get(id).onclick = () => { void (async () => {
    const token = context?.token, planId = selectedPlan, target = selectedScene;
    if (changesPending.size) await Promise.all(changesPending);
    if (pendingWork.value && !(await pendingWork.value)) return;
    if (!planDraft || blocked || composing || context?.token !== token || selectedPlan !== planId) return;
    const scenes = [...planDraft.scenes], from = scenes.findIndex(s => s.id === target), to = from + delta;
    if (from < 0 || to < 0 || to >= scenes.length) return;
    [scenes[from], scenes[to]] = [scenes[to]!, scenes[from]!];
    if (await change({ kind: 'plan', expectedRevision: planDraft.revision, plan: { ...planDraft, scenes } }, false)) renderPlans();
  })(); };
  get('preparation-apply').onclick = () => { void flushPreparation(); };
  get('preparation-reconcile').onclick = () => { void (async () => {
    const command=failedCommandState.value,token=context?.token,request=editorSession.generation;
    if(!command||!token)return;
    const owns=()=>context?.token===token&&editorSession.generation===request;
    const current=()=>owns()&&failedCommandState.value===command;
    try {
      const result = command.change.kind==='plan'?unwrap(await window.campaign.reconcilePreparationPlan(command,token)):unwrap(await window.campaign.reconcilePreparation(command,token));
      if(!current())return;
      if (result.targetChanged || result.outcome === 'conflict') {
        tell(result.outcome === 'applied' ? 'Speicherung bestätigt, aber der aktuelle Vorbereitungsstand ist verändert oder nicht verlässlich lesbar. Entwurf bleibt offen; sichere den Text vor dem Verwerfen.' : 'Vorbereitungskonflikt bestätigt. Entwurf bleibt offen; sichere den Text vor dem Verwerfen.', true); return;
      }
      const sourceBefore=command.change.kind==='note'&&command.change.excerpt?noteRow(command.change.excerpt.id)?.note:null;
      if('plan' in result&&command.change.kind==='plan')acceptPlan(result.plan,command.change.plan.id);
      else if('data' in result)usePreparation(result.data);
      const change = command.change;
      const targetId = change.kind === 'note' ? change.note.id : change.kind === 'plan' ? change.plan.id : change.kind === 'location' ? change.document.id : change.id;
      const target = preparationTarget(change), key = draftKey(target.kind, target.id), saved = retained.get(key);
      if(saved&&change.kind==='note'&&change.excerpt){
        // This is one guarded append with two provenance directions, never a
        // plain note draft to autosave after an unapplied command.
        if(saved.change.kind!=='note'||!equal(saved.change.note,change.note))throw Error('Weitere Eingaben liegen über dem Auszugsauftrag. Entwurf bleibt zur manuellen Klärung erhalten.');
        unwrap(await window.campaign.discardPreparationDraft(token,target.kind,target.id,saved.writeId));if(!current())return;retained.set(key,null);
        if(noteDraft?.id===targetId)noteDraft=structuredClone(noteRow(targetId)!.note);
      }else if (saved) {
        const revision = target.kind === 'note' ? data.notes.find(r => r.note.id === target.id)?.note.revision : target.kind === 'plan' ? data.plans.find(p => p.id === target.id)?.revision : data.locations.find(r => r.document.id === target.id)?.revision;
        if (revision === undefined) throw new Error('Der Entwurfsstand ist nicht lesbar.');
        const rebased: PreparationEdit = saved.change.kind === 'note' ? { ...saved.change, expectedRevision: revision, note: { ...saved.change.note, revision } } : saved.change.kind === 'plan' ? { ...saved.change, expectedRevision: revision, plan: { ...saved.change.plan, revision } } : { ...saved.change, expectedRevision: revision };
        const next: PreparationDraft = { version: 1, writeId: crypto.randomUUID(), change: rebased, failedCommand: null };
        unwrap(await window.campaign.keepPreparationDrafts(token, [next])); if(!current())return;retained.set(key, next);
      }
      if(sourceBefore&&noteDraft?.id===sourceBefore.id){
        const sourceNow=noteRow(sourceBefore.id)?.note;
        if(!sourceNow||!equal({...sourceBefore,revision:sourceNow.revision,relations:sourceNow.relations},sourceNow))throw Error('Die Quelle wurde zusätzlich geändert. Entwurf bleibt zur manuellen Klärung erhalten.');
        noteDraft={...noteDraft,revision:sourceNow.revision,relations:sourceNow.relations};
      }
      if ((change.kind === 'note' || change.kind === 'note-trash') && noteDraft?.id === targetId && originalNote()) noteDraft = { ...noteDraft, revision: originalNote()!.revision };
      if (change.kind === 'plan' && planDraft?.id === targetId && originalPlan()) planDraft = { ...planDraft, revision: originalPlan()!.revision };
      if ((change.kind === 'location' || change.kind === 'location-trash') && locationDraft?.document.id === targetId && originalLocation()) locationDraft = { ...locationDraft, revision: originalLocation()!.revision };
      const focusOnResolve = document.activeElement === get('preparation-reconcile');
      blocked = false; failedCommandState.value = null; get('preparation-reconcile').hidden = true; get('preparation-refresh').hidden = true;
      await retainOpenDrafts();
      if(!owns())return;
      if(change.kind==='plan')renderSceneList();
      if(change.kind==='note'&&change.excerpt){if(selectedNote===targetId)await renderNotes();else{renderRelations();renderNoteList();}if(!owns())return;}
      if (change.kind === 'note-trash' && selectedNote === targetId && noteThread?.editorId === targetId) {
        get<HTMLInputElement>('world-trash').checked = !!noteRow(targetId)?.trashed;
        await renderNotes();
        if (!owns()) return;
        if(focusOnResolve)focusNoteEditor();
      }
      tell(result.outcome === 'applied' ? 'Speicherung der Vorbereitung bestätigt. Weitere Eingaben bleiben offen.' : change.kind==='note'&&change.excerpt?'Auszug nicht übernommen. Der Originaltext bleibt in der Quelle; dort erneut markieren und ausdrücklich übernehmen.':'Änderung nicht gespeichert. Eingabe abschließen, um den Entwurf erneut zu übernehmen.');
    } catch (error) { if(owns())tell((error as Error).message + ' Status bleibt ungeklärt.', true); }
  })(); };
  get('preparation-refresh').onclick = () => { void (async () => {
    try {
      if (context && failedCommandState.value) {
        const target = preparationTarget(failedCommandState.value.change), key = draftKey(target.kind, target.id), saved = retained.get(key);
        if (saved) { unwrap(await window.campaign.discardPreparationDraft(context.token, target.kind, target.id, saved.writeId)); retained.set(key, null); }
        await activatePreparation(context); tell('Gespeicherter Stand geöffnet. Betroffener Entwurf verworfen; andere Entwürfe bleiben erhalten.');
      }
    } catch (error) { tell((error as Error).message + ' Entwurf bleibt offen.', true); }
  })(); };
  const preparationInput=(event:Event)=>{const target=event.target as Node|null;return !!target&&(get('preparation').contains(target)||get('note-editor').contains(target));};
  document.addEventListener('compositionstart', event => { if(preparationInput(event)){composing = true; if (timer) clearTimeout(timer);} });
  document.addEventListener('compositionend', event => { if(preparationInput(event)){composing = false; schedule();} });
  initLocationActions();
  get('scene-adopt').onclick = () => { void (async () => {
    const token = context?.token, plan = selectedPlan, visit = selectedScene;
    if (plan && visit && await flushPreparation() && context?.token === token && offerVisit) await offerVisit(plan, visit);
  })(); };
  get('relation-add').onclick = () => { void (async () => {
    if(!noteDraft||blocked)return;
    const label=value('relation-label'),target=value('relation-target');
    if(!label.trim()||!target){tell('Wähle ein Ziel und benenne die Beziehung.',true);return;}
    if(noteDraft.relations.some(relation=>relation.targetId===target&&relation.label===label)){tell('Diese Beziehung besteht bereits.');return;}
    if(await changeNoteRelations([...noteDraft.relations,{targetId:campaignLocalId(target),label}])&&value('relation-label')===label)get<HTMLInputElement>('relation-label').value='';
  })(); };
  get('scene-location').onchange = () => { if (!planDraft) return; const locationId = value('scene-location') ? campaignLocalId(value('scene-location')) : null; planDraft = { ...planDraft, scenes: planDraft.scenes.map(s => s.id === selectedScene ? { ...s, locationId } : s) }; get<HTMLButtonElement>('scene-open-location').disabled = !locationId; schedule(); };
  get('scene-open-location').onclick = () => { void (async () => { if (!(await flushPreparation())) return; const scene = originalPlan()?.scenes.find(s => s.id === selectedScene); if (!scene?.locationId) return; const row = data.locations.find(row => row.document.id === scene.locationId); if (!row) { tell('Szenenort ist nicht verfügbar. Die Ortskennung bleibt erhalten.', true); return; } showPreparationArea(false);selectedLocation = scene.locationId; get<HTMLInputElement>('location-trash').checked = row.trashed; showLocations(true); renderLocations(); })(); };
}
export async function createNarrativeAtLocation(locationId:string,name:string,kind:'quest'|'rumor'){
 const w=context,request=editorSession.generation;if(!w||!await flushPreparation()||context?.token!==w.token||editorSession.generation!==request)throw new Error('Vorbereitungskontext geändert.');
 const place=unwrap(await window.campaign.deskContent(w.token,{kind:'location',id:locationId}));if(place.unavailable||context?.token!==w.token||editorSession.generation!==request)throw new Error('Ort für neuen Auftrag nicht verfügbar.');
 const note:Note={version:1,id:campaignLocalId(crypto.randomUUID()),revision:1,kind,title:name,readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false};
 if(!await change({kind:'note',expectedRevision:null,note},false))throw new Error('Neue Notiz noch nicht bestätigt. Speicherstatus der Vorbereitung prüfen.');
 if(context?.token!==w.token)throw new Error('Notiz in früherer Kampagne gespeichert.');
 selectedNote=note.id;get<HTMLInputElement>('world-trash').checked=false;await renderNotes(locationId);
 if(context!==w||context?.token!==w.token)throw new Error('Notiz in früherer Kampagne gespeichert.');
 if(!await flushNarrative())throw new Error('Notiz angelegt; offene Ortsbindung im narrativen Bereich abschließen.');
 const saved=unwrap(await window.campaign.narrative(w.token,note.id));if(context?.token!==w.token||saved.state.locationId!==locationId)throw new Error('Notiz angelegt; Ortsbindung im narrativen Bereich prüfen.');
 get<HTMLDetailsElement>('note-read-aloud-details').open=true;get('note-title').scrollIntoView({block:'center'});get('note-read-aloud').focus();return note.id;
}
export async function openPreparedNote(id:string,stillCurrent=()=>true) {
  const token = context?.token,request=editorSession.generation,current=()=>context?.token===token&&editorSession.generation===request&&stillCurrent();
  if (!token || !await flushPreparation() || !current()) return false;
  const next = unwrap(await window.campaign.preparation(token, ''));
  if (!current()) return false;
  usePreparation(next);
  const row = noteRow(id);
  if (!row) { tell('Weltinhalt nicht verfügbar.', true); return false; }
  get<HTMLInputElement>('world-search').value = '';
  selectedNote = id; get<HTMLInputElement>('world-trash').checked = row.trashed;
  showPreparationArea(false);showLocations(false); await renderNotes();
  if (!current()) return false;
  revealNote(id);return true;
}
export async function prepareNoteLocation(id:string,locationId:string){const token=context?.token;await openPreparedNote(id);if(!token||context?.token!==token||selectedNote!==id)throw new Error('Auftrag für Ortsbindung nicht verfügbar.');await prepareNarrativeLocation(token,id,locationId);tell('Zielort in den narrativen Angaben vorbelegt. Speichern bestätigt die Ortsbindung.');}
export async function openPreparedLocation(id: string,stillCurrent=()=>true) {
  if(context&&!preparationLoaded){const owner=context;await activatePreparation(owner);if(context?.token!==owner.token||!stillCurrent())return;}
  const token=context?.token,request=editorSession.generation;
  if (!token||!(await flushPreparation())||context?.token!==token||editorSession.generation!==request||!stillCurrent()) return;
  const row = data.locations.find(row => row.document.id === id);
  if (!row) { tell('Ort ist nicht verfügbar. Die Ortskennung bleibt erhalten.', true); return; }
  showPreparationArea(false);selectedLocation = id; get<HTMLInputElement>('location-trash').checked = row.trashed; showLocations(true); renderLocations();
}
export async function openPreparedVisit(planId:string,visitId:string,current:()=>boolean=()=>true,focus:'visit'|'reward'='visit'){
  const owner=context,token=owner?.token,epoch=editorSession.generation,valid=()=>current()&&context===owner&&context?.token===token&&editorSession.generation===epoch;
  if(!token||!valid()||!await flushPreparation()||!valid())return;const next=unwrap(await window.campaign.preparation(token,''));if(!valid())return;
  const plan=next.plans.find(row=>row.id===planId);if(!plan){tell('Spielabendplan ist nicht verfügbar.',true);return;}if(!plan.scenes.some(scene=>scene.id===visitId)){tell('Vorbereiteter Besuch ist nicht verfügbar.',true);return;}
  usePreparation(next);get<HTMLInputElement>('world-search').value='';selectedPlan=planId;selectedScene=visitId;planDraft=null;showPreparationArea(true);showLocations(false);await renderPlans();if(valid()){const target=get<HTMLInputElement>(focus==='reward'?'visit-has-reward':'scene-title');get(focus==='reward'?'visit-has-reward':'scene-editor').scrollIntoView({block:focus==='reward'?'center':'start'});target.focus({preventScroll:true});}
}

/** Follow a plan identity without guessing a visit from a room's title. */
export async function openPreparedPlan(planId:string,current:()=>boolean=()=>true):Promise<boolean>{
  const owner=context,token=owner?.token,epoch=editorSession.generation,valid=()=>current()&&context===owner&&context?.token===token&&editorSession.generation===epoch;
  if(!token||!valid()||!await leavePreparation()||!valid())return false;
  const next=unwrap(await window.campaign.preparation(token,''));if(!valid())return false;
  const plan=next.plans.find(row=>row.id===planId);if(!plan)throw new Error('Spielabendplan ist nicht verfügbar. Die Verknüpfung bleibt erhalten.');
  const previous=selectedPlan;usePreparation(next);selectedPlan=planId;
  if(previous!==planId||!plan.scenes.some(scene=>scene.id===selectedScene))selectedScene=plan.scenes[0]?.id??null;
  planDraft=null;showPreparationArea(true);showLocations(false);await renderPlans();
  if(!valid())return false;
  const target=get<HTMLInputElement>(selectedScene?'scene-title':'plan-name');target.scrollIntoView({block:'center'});target.focus({preventScroll:true});return true;
}

export async function prepareNextVisit(planId:string|null,seed:{title:string;notes:string;locationId:string|null;beforeVisitId?:string|null;readAloud?:string;noteIds?:string[];newPlan?:boolean;newPlanName?:string;noteThread?:import('./note-thread-contracts').NoteThreadSelection},stillCurrent:()=>boolean=()=>true):Promise<{planId:string;visitId:string}|undefined>{
  const owner=context,token=owner?.token,epoch=editorSession.generation,input=structuredClone(seed);
  const current=()=>context===owner&&context?.token===token&&editorSession.generation===epoch&&stillCurrent();
  if(!token||!current()||!await flushPreparation()||!current())throw new Error('Spielabendvorbereitung ist gerade nicht verfügbar.');
  const selection=[selectedPlan,selectedScene,selectedNote,selectedLocation],edit=editorSession.input.version;
  const sameInput=()=>editorSession.input.version===edit&&selectedPlan===selection[0]&&selectedScene===selection[1]&&selectedNote===selection[2]&&selectedLocation===selection[3]&&!blocked&&!composing;
  const requested=input.newPlan?null:planId??selectedPlan,shown=data.plans.find(plan=>plan.id===requested);
  const next=unwrap(await window.campaign.preparation(token,''));
  if(!current())return;
  if(!sameInput())throw new Error('Vorbereitung inzwischen geändert. Offene Eingaben bleiben erhalten; Besuch erneut ausdrücklich vorbereiten.');
  const target=input.newPlan?undefined:requested?next.plans.find(plan=>plan.id===requested):next.plans.find(plan=>plan.id===next.selection.planId)??next.plans[0];
  if(requested&&!target)throw new Error('Ausgewählter Spielabendplan nicht verfügbar. Vorbereitung erneut öffnen.');
  if(shown&&shown.revision!==target?.revision)throw new Error('Spielabendplan inzwischen geändert. Vorbereitung erneut öffnen.');
  if(input.beforeVisitId&&!target?.scenes.some(scene=>scene.id===input.beforeVisitId))throw new Error('Der gewählte Besuch als Einfügeposition ist nicht mehr verfügbar. Vorbereitung erneut öffnen.');
  if(target){
    const saved=await loadedDraft('plan',target.id);
    if(!current()||!sameInput()||saved||draftProblems.has(draftKey('plan',target.id)))throw new Error('Offener Planentwurf oder ursprünglicher Auftrag vorhanden. Im Zielplan zuerst prüfen; kein neuer Besuch wurde angelegt.');
  }
  usePreparation(next);
  const id=campaignLocalId(crypto.randomUUID()),scene={id,title:input.title,notes:input.notes,locationId:input.locationId?campaignLocalId(input.locationId):null};
  const plan:ManualPlan=target?{...target,scenes:[...target.scenes]}:{version:1,id:campaignLocalId(crypto.randomUUID()),revision:1,name:input.newPlanName??'Nächster Spielabend',scenes:[]};
  const at=input.beforeVisitId?plan.scenes.findIndex(row=>row.id===input.beforeVisitId):plan.scenes.length;
  const scenes=[...plan.scenes];scenes.splice(at,0,scene);
  const opening=input.readAloud||input.noteIds?.length?{visitId:id,readAloud:input.readAloud??'',noteIds:[...new Set(input.noteIds??[])],...(input.noteThread?{noteThread:input.noteThread}:{})}:undefined;
  const saved=await change({kind:'plan',expectedRevision:target?.revision??null,plan:{...plan,scenes},...(opening?{opening}:{})},false,current);
  if(!current())return;
  if(!saved)throw new Error('Nächster Besuch konnte nicht bestätigt werden. Speicherstatus der Vorbereitung prüfen.');
  // The writer retains input made while its reply was pending. Do not discard
  // that draft or move its editor merely because this visit was published.
  if(!sameInput())return;
  selectedPlan=plan.id;selectedScene=id;planDraft=null;get<HTMLInputElement>('world-search').value='';showPreparationArea(true);showLocations(false);await renderPlans();
  if(current()&&editorSession.input.version===edit){get('scene-editor').scrollIntoView({block:'start'});get<HTMLInputElement>('scene-title').focus({preventScroll:true});return{planId:plan.id,visitId:id};}
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
  renderLocationSections();

  for (const map of data.maps) {
    const label = document.createElement('label'), box = document.createElement('input'); box.type = 'checkbox'; box.dataset.mapId = map.id; box.checked = shown.detailMaps.some(d => d.documentId === map.id); box.disabled = readonly;
    label.append(box, document.createTextNode(' ' + map.name)); get('location-maps').append(label);
    box.onchange = () => { if (!locationDraft || context?.token !== token || locationDraft.document.id !== id) return; const detailMaps = locationDraft.document.detailMaps.filter(d => d.documentId !== map.id); if (box.checked) detailMaps.push({ kind: 'dungeon', documentId: map.id }); locationDraft = { ...locationDraft, document: { ...locationDraft.document, detailMaps } }; schedule(); };
  }
  renderLocationMapActions();
  get('location-remove').hidden = row.trashed; get('location-restore').hidden = !row.trashed; void checkpoint();
}
function sectionTitleDialog(title:string,initial:string):Promise<string|null>{const dialog=document.createElement('dialog'),form=document.createElement('form'),heading=document.createElement('h3'),input=document.createElement('input'),save=document.createElement('button'),cancel=document.createElement('button');heading.textContent=title;input.value=initial;input.required=true;input.setAttribute('aria-label','Abschnittstitel');save.textContent='Übernehmen';save.type='submit';cancel.textContent='Abbrechen';cancel.type='button';form.append(heading,input,save,cancel);dialog.append(form);dialog.id='location-section-title-dialog';document.body.append(dialog);return new Promise(resolve=>{const finish=(value:string|null)=>{dialog.close();dialog.remove();resolve(value);};form.onsubmit=e=>{e.preventDefault();if(input.value.trim())finish(input.value);};cancel.onclick=()=>finish(null);dialog.oncancel=e=>{e.preventDefault();finish(null);};dialog.showModal();input.select();});}
function renderLocationSections(){
 const owner=context,campaignId=owner?.campaign.id,run=editorSession.generation,epoch=++locationSectionsGeneration;
 const row=locationDraft??originalLocation(),root=get('location-sections'),token=context?.token,id=row?.document.id;root.replaceChildren();if(!row)return;const readonly=row.trashed||blocked||draftProblems.has(draftKey('location',row.document.id));
 const button=(text:string,action:()=>Promise<void>)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.disabled=readonly;b.onclick=()=>{if(!b.isConnected||b.disabled||!owned())return;b.disabled=true;void action().catch(e=>{if(owned())tell(e.message,true);}).finally(()=>{if(b.isConnected&&owned())b.disabled=readonly;});};return b;};
 const owned=()=>context===owner&&context?.token===token&&context?.campaign.id===campaignId&&editorSession.generation===run&&locationSectionsGeneration===epoch&&locationDraft?.document.id===id&&!blocked;
 const update=(sections:typeof row.document.sections)=>{if(!owned())return;locationDraft={...locationDraft!,document:{...locationDraft!.document,sections}};schedule();renderLocationSections();};
 row.document.sections.forEach((section,index)=>{
  const block=document.createElement('section'),label=document.createElement('label'),field=document.createElement('textarea'),tools=document.createElement('div');block.dataset.locationSectionId=section.id;label.textContent=section.title;field.id=`location-section-${index}`;field.dataset.sectionId=section.id;label.htmlFor=field.id;field.rows=5;field.value=section.markdown;field.disabled=readonly;tools.className='toolbar';
  field.oninput=()=>{if(!owned())return;const current=locationDraft!.document.sections.find(s=>s.id===section.id);if(!current)return;locationDraft={...locationDraft!,document:{...locationDraft!.document,sections:locationDraft!.document.sections.map(s=>s.id===section.id?{...s,markdown:field.value===current.markdown.replace(/\r\n?/g,'\n')?current.markdown:field.value}:s)}};schedule();};field.onblur=()=>{if(!composing)void flushPreparation();};
  tools.append(button('Textverweis einfügen…',async()=>{
   const start=field.selectionStart,end=field.selectionEnd,alias=field.value.slice(start,end),before=locationDraft?.document.sections.find(s=>s.id===section.id)?.markdown;
   const current=()=>owned()&&field.isConnected&&!field.disabled&&locationDraft?.document.sections.find(s=>s.id===section.id)?.markdown===before;
   if(before===undefined||!await flushPreparation()||!current())return;
   const link=await chooseTextReference(token!,alias,current);if(!link||!current())return;
   locationDraft={...locationDraft!,document:{...locationDraft!.document,sections:locationDraft!.document.sections.map(s=>s.id===section.id?{...s,markdown:before.slice(0,rawTextOffset(before,start))+link+before.slice(rawTextOffset(before,end))}:s)}};
   field.value=locationDraft.document.sections.find(s=>s.id===section.id)!.markdown;schedule();field.focus();const caret=start+link.replace(/\r\n/g,'\n').length;field.setSelectionRange(caret,caret);
  }));
  tools.append(button('Titel ändern…',async()=>{if(!await flushPreparation()||!owned())return;const title=await sectionTitleDialog('Abschnitt umbenennen',section.title);if(title&&owned())update(locationDraft!.document.sections.map(s=>s.id===section.id?{...s,title}:s));}));
  const move=(delta:number)=>async()=>{if(!await flushPreparation()||!owned())return;const sections=[...locationDraft!.document.sections],from=sections.findIndex(s=>s.id===section.id),to=from+delta;if(from<0||to<0||to>=sections.length)return;const [selected]=sections.splice(from,1);sections.splice(to,0,selected!);update(sections);};const up=button('Nach oben',move(-1)),down=button('Nach unten',move(1));up.disabled=readonly||index===0;down.disabled=readonly||index===row.document.sections.length-1;tools.append(up,down);block.append(label,field,tools);root.append(block);
 });
 root.append(button('Abschnitt hinzufügen…',async()=>{if(!await flushPreparation()||!owned())return;const title=await sectionTitleDialog('Neuen Ortsabschnitt anlegen','');if(title&&owned())update([...locationDraft!.document.sections,{id:crypto.randomUUID(),title,markdown:''}]);}));
 const read=document.createElement('button');read.type='button';read.id='location-notebook-read';read.textContent='Ortsmappe lesen / am Spieltisch verwenden…';read.onclick=()=>{void(async()=>{if(!await flushPreparation()||context?.token!==token)return;await locationNotebookOpen(id!);})().catch(e=>tell(e.message,true));};root.prepend(read);
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
  const select = get<HTMLSelectElement>('relation-target'),previousTarget=select.value;select.replaceChildren();
  for (const target of campaignNotes.values()) { if (target.trashed || target.note.id === selectedNote) continue; const option = document.createElement('option'); option.value = target.note.id; option.textContent = target.note.title; select.append(option); }
  if([...select.options].some(option=>option.value===previousTarget))select.value=previousTarget;
  get('relation-create').hidden = !row || row.trashed || !select.options.length;
  if (!row) return; const token=context?.token,request=editorSession.generation,current=()=>context?.token===token&&request===editorSession.generation&&selectedNote===row.note.id;
  const reading = (item:HTMLElement,id:string,label:string,available:boolean) => {
    // Embedded map editors already have their own contextual reader. The
    // ordinary editor can use the shared reference reader without navigating.
    if(!inspectNote||noteThread?.editorId===row.note.id)return;
    const read=document.createElement('button');read.type='button';read.textContent='Ansehen…';read.setAttribute('aria-label','Ansehen: '+label);read.disabled=!available;
    read.onclick=()=>{if(!read.isConnected||read.disabled||!current())return;void inspectNote!(id,current).catch(e=>{if(current())tell(e.message,true);});};item.append(read);
  };
  const navigate = (id: string) => { void (async () => { if(!current())return;if(noteThread?.editorId===row.note.id){await noteThread.followNote(id);return;}if(!await flushPreparation()||!current())return; selectedNote = id; showLocations(false); await renderNotes(); if (context?.token === token) revealNote(id); })(); };
  for (const relation of (noteDraft?.id===row.note.id?noteDraft:row.note).relations) {
    const target = noteRow(relation.targetId), item = document.createElement('div'), button = document.createElement('button');
    button.textContent = `${relation.label}: ${target?.note.title ?? 'Ziel nicht verfügbar'}${target?.trashed ? ' (Papierkorb)' : ''}`; button.disabled = !target; button.onclick = () => {if(button.isConnected)navigate(relation.targetId);}; item.append(button);
    reading(item,relation.targetId,button.textContent,!!target);
    if (!row.trashed) { const remove = document.createElement('button'); remove.textContent = 'Beziehung lösen'; remove.onclick=()=>{if(current()&&remove.isConnected&&noteDraft)void changeNoteRelations(noteDraft.relations.filter(r=>r.targetId!==relation.targetId||r.label!==relation.label));}; item.append(remove); }
    get('note-relations').append(item);
  }
  for (const source of campaignNotes.values()) { if (!source.note.relations.some(relation => relation.targetId === selectedNote)) continue; const item=document.createElement('div'),button = document.createElement('button'); button.textContent = `Verweis von ${source.note.title}${source.trashed ? ' (Papierkorb)' : ''}`; button.onclick = () => {if(button.isConnected)navigate(source.note.id);};item.append(button);reading(item,source.note.id,button.textContent,true);get('note-incoming').append(item); }
}
function initLocationActions() {
  for (const [id, show] of [['knowledge-tab', false], ['locations-tab', true]] as const) get(id).onclick = () => {
    void (async () => {
      const owner = context, request = editorSession.generation;
      if (!await leavePreparation() || context !== owner || editorSession.generation !== request) return;
      showLocations(show);
      // Locations may have been created, renamed or trashed while the note
      // editor was hidden. Reopen its narrative context with the current list.
      if (!show) await renderNotes();
    })().catch(error => tell(error.message, true));
  };
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
    const token = context?.token, target = selectedLocation, request = editorSession.generation;
    if (!(await flushPreparation()) || context?.token !== token || request !== editorSession.generation || selectedLocation !== target) return; const before = originalLocation(); if (!before) return;
    if (await change({ kind: 'location-trash', id: before.document.id, expectedRevision: before.revision, trashed }, false)) { selectedLocation = null; renderLocations(); renderSceneLocation(); }
  })(); };
}

editorSession.onDeactivate(()=>{if(timer)clearTimeout(timer);timer=null;});

editorSession.observeDraft(()=>({openInput:hasOpenInput,retainedDraft:[...retained.values()].some(Boolean),unresolvedCommand:!!failedCommandState.value}));

import {openTreasureDistribution} from './treasury-ui';
import {LiveEncounterGenerator} from './live-generation-ui';
import {closeSessionPacket,openLiveSessionPacket,syncLiveSessionPacket,type LivePacketSource} from './session-packet-ui';
import {initSessionNavigator,sessionNavigatorContext,sessionNavigatorBusy} from './session-progress-ui';
import {initSceneDesk,sceneDeskContext,flushSceneDesk} from './scene-desk-ui';
import {refreshMusic} from './music-ui';
import {renderLiveWorld} from './world-ui';
import {renderSceneShops} from './items-ui';
import type { Workspace, Result } from './contracts';
import { checkedCharacterProfile, advanceInstant, formatInstant, type TimeUnit, type Character, type CharacterProfile, type LiveScene, type LiveView, type LiveAction, type LiveCommand, type LiveAck } from './live-contracts';
import type { Preparation } from './preparation-contracts';
import { prepareGeneratedCombat,addWorldNpc,initCombat, combatContext, flushCombat, prepareCombatPlan, addCatalogCreature, prepareWorldGroup,openExistingCombat } from './combat';
import {initChase,chaseContext,flushChase,openExistingChase} from './chase-ui';
import {initLiveArchives} from './live-archive-ui';
import type { EncounterPlan } from './encounter-contracts';
import {initProgress,progressionContext,flushProgress,executePartyProgress,onProgressChanged,progressCharacters} from './progression-ui';
import {initRuleReferences,activateRuleReferences,refreshRuleReferences} from './rule-reference-ui';
import {cuePlayer,cuePlayerImage} from './player-ui';
import {renderLiveNpcChoices} from './live-player-cues';
import {findLiveKnowledge} from './live-knowledge';
import {partyHealthFacts,partyProgressFacts,passivePerceptionResult} from './live-party-reference';
import {liveMomentSavedMessage,canClearSavedLiveMoment,emptyLiveMomentDraft,LiveMomentDraftBook,type LiveMomentCategory,type LiveMomentDraft} from './live-moment-drafts';
import type {NarrativeView} from './narrative-contracts';
import type {ChronicleView} from './chronicle-contracts';
import {liveActionUpdatesRecap,liveSessionRecap} from './live-session-recap';
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const value = (id: string) => get<HTMLInputElement>(id).value;
const unwrap = <T>(result: Result<T>): T => { if (!result.ok) throw new Error(result.error); return result.value; };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
let context: Workspace | null = null, data: LiveView | null = null, sources: Preparation | null = null;
let sessionChronicle:ChronicleView|null=null,sessionChronicleError='',sessionChronicleRequest=0;
const recapDrafts=new Map<string,string>();
let selected: string | null = null, characterDraft: Character | null = null, sceneDraft: LiveScene | null = null;
let resumed = false, composing = false, blocked = false, timer: ReturnType<typeof setTimeout> | null = null;
let request: Promise<LiveAck | null> | null = null, flushing: Promise<boolean> | null = null, failed: LiveCommand | null = null;
let requestIsTextSave = false;
const liveMomentDrafts=new LiveMomentDraftBook();
let narrativeGeneration=0,narrativeCache=new Map<string,NarrativeView>(),narrativeProblems=new Map<string,string>(),narrativeLoading=new Set<string>();
const intentBlocked = () => !!request && !requestIsTextSave;
let adoption: Extract<LiveAction, { kind: 'apply-visit' }> | null = null;
let moveBasis: Omit<Extract<LiveAction, { kind: 'move' }>, 'memberIds' | 'target'> | null = null;
let moveTargets: LiveView['scenes'] = [],preparedNotesSceneId:string|null=null,preparedNoteIds=new Set<string>();
let resetLiveArchives=()=>{};
let liveGenerator:LiveEncounterGenerator;
type SessionCloseMask={kind:'combat'|'chase';id:string;sceneId:string;sceneTitle:string;title:string;state:string};
type SessionCloseAudit={masks:SessionCloseMask[];treasures:{count:number;units:number;more:boolean};xpBooked:boolean;events:number};
let sessionCloseRequest=0;
let tell: (text: string, error?: boolean) => void, openLocation: (id: string) => Promise<void>,openKnowledgeNote:(id:string)=>Promise<void>;
const originalCharacter = () => data?.roster.find(c => c.id === selected);
const content = (scene: LiveScene) => ({ title: scene.title, notes: scene.notes, readAloud:scene.readAloud??'', locationId: scene.locationId });
const changed = () => !!(characterDraft && originalCharacter() && !equal(characterDraft.profile, originalCharacter()!.profile) || sceneDraft && data?.scene && !equal(content(sceneDraft), content(data.scene)));
const playerFocus=()=>data?{focusId:data.focusId,focusRevision:data.focusRevision,focusMembershipRevision:data.scene?.membershipRevision??null,focusLocationId:(sceneDraft??data.scene)?.locationId??null}:null;
export function activateLive(workspace: Workspace) {
  if(context){const d=document.getElementById('live-session-close-dialog') as HTMLDialogElement|null;recapDrafts.set(context.campaign.id,value(d?.open?'live-session-close-summary':'live-session-summary'));}
  get<HTMLTextAreaElement>('live-session-summary').value=workspace?recapDrafts.get(workspace.campaign.id)??'':'';
  sessionCloseRequest++;const closeDialog=document.getElementById('live-session-close-dialog') as HTMLDialogElement|null;if(closeDialog?.open)closeDialog.close();
  liveGenerator?.reset();closeSessionPacket();syncLiveSessionPacket(null);resetLiveArchives();sessionNavigatorContext(null,null,null,false);
  sceneDeskContext(null,null);combatContext(null,null);chaseContext(null,null,[]);progressionContext(null,null,null);
  context = workspace; data = null; sources = null;sessionChronicle=null;sessionChronicleError='';sessionChronicleRequest++; selected = null; characterDraft = null; sceneDraft = null; resumed = false; blocked = false; failed = null;
  activateRuleReferences(workspace);
  get<HTMLInputElement>('live-knowledge-search').value='';
  get('live-reconcile').hidden = true; get('live-refresh').hidden = true; get('live-workspace').hidden = true; get('live-empty').hidden = false;
  get('running-editor').hidden = true; get('live-start-hint').hidden = false; get('live-continue').hidden = false;
  adoption = null; moveBasis = null;preparedNotesSceneId=null;preparedNoteIds.clear();
  narrativeGeneration++;narrativeCache.clear();narrativeProblems.clear();narrativeLoading.clear();
  liveMomentDrafts.reset();writeLiveMomentDraft(emptyLiveMomentDraft());get('live-moment-result').textContent='';
  get('live-session-result').textContent='';
  for (const id of ['adoption-dialog', 'move-dialog', 'archive-dialog', 'character-dialog']) if (get<HTMLDialogElement>(id).open) get<HTMLDialogElement>(id).close();
}
export async function openLive(planId?: string, visitId?: string) {
  if (!context) { tell('Bitte zuerst eine Kampagne öffnen.', true); return; }
  const token = context.token,recapRequest=++sessionChronicleRequest;
  try {
    const [liveResult,prepResult,chronicleResult]=await Promise.all([window.campaign.live(token),window.campaign.preparation(token, ''),readSessionChronicle(token)]),live=unwrap(liveResult),prep=unwrap(prepResult);
    if (context?.token !== token) return;
    data = live; sources = prep;if(recapRequest===sessionChronicleRequest){sessionChronicle=chronicleResult.ok?chronicleResult.value:null;sessionChronicleError=chronicleResult.ok?'':chronicleResult.error;}narrativeGeneration++;narrativeCache.clear();narrativeProblems.clear();narrativeLoading.clear(); selected = live.roster.some(c => c.id === selected) ? selected : live.roster[0]?.id ?? null;
    characterDraft = originalCharacter() ? structuredClone(originalCharacter()!) : null;
    sceneDraft = resumed && live.scene ? structuredClone(live.scene) : null;
    render();
    if (planId) { get<HTMLDetailsElement>('adoption-picker').open = true; get<HTMLSelectElement>('adoption-plan').value = planId; renderVisits(); if (visitId) get<HTMLSelectElement>('adoption-visit').value = visitId; }
  } catch (error) { data = null; sceneDraft = null; characterDraft = null; get('live-workspace').hidden = true; get('live-empty').hidden = false; tell((error as Error).message, true); }
}
async function ensureLiveRuntime() {
  if(!context)return false;
  const token=context.token,sceneId=data?.scene?.id??null;
  const current=()=>context?.token===token&&(sceneId===null||data?.scene?.id===sceneId);
  if (!(await flushLive())||!current()) return false;
  if (!data) {await openLive();if(!current())return false;} if (!data) return false;
  if (!data.scene) {if(!await execute({kind:'initialize',expectedRosterRevision:data.rosterRevision})||!current())return false;}
  resumed=true;sceneDraft=data.scene?structuredClone(data.scene):null;renderScene();return !!data.scene;
}
export async function openLiveSoundboard(){
 if(!data?.scene){get('live-continue').scrollIntoView({block:'center'});get<HTMLButtonElement>('live-continue').focus();tell('Öffne zuerst eine Gruppe am Spieltisch.');return;}
 if(!await ensureLiveRuntime())return;get<HTMLDetailsElement>('live-soundboard').open=true;get('live-soundboard').scrollIntoView({block:'start'});
}
export async function prepareLiveEncounter(plan:EncounterPlan) { const token=context?.token;if(await ensureLiveRuntime()&&context?.token===token)await prepareCombatPlan(plan); }
export async function addLiveNpc(id:string){if(await ensureLiveRuntime())await addWorldNpc(id);}
export async function addLiveCreature(id:string,count:number,grouped:boolean) { const token=context?.token;if(await ensureLiveRuntime()&&context?.token===token)await addCatalogCreature(id,count,grouped); }
function busy(on: boolean, structural = false, textSave = false) {
  sessionNavigatorBusy(on&&!textSave);
  for (const id of ['character-new', 'character-toggle', 'live-continue', 'adoption-preview', 'character-create', 'adoption-confirm', 'character-cancel', 'adoption-cancel', 'group-move', 'time-advance', 'live-archives', 'move-confirm', 'move-cancel', 'live-moment-save','live-session-start','live-session-end']) get<HTMLButtonElement>(id).disabled = on && !textSave || !!sessionChronicleError && id.startsWith('live-session-');
  get<HTMLSelectElement>('scene-focus').disabled = on && !textSave;
  get<HTMLInputElement>('new-character-name').disabled = on && !textSave;
  for(const id of ['live-moment-category','live-moment-title','live-moment-summary','live-moment-follow-up'])get<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>(id).disabled=on&&!textSave;
  if (structural) for (const id of [...profileFields.map(([id]) => id), 'running-title', 'running-notes', 'running-read-aloud', 'running-location']) get<HTMLInputElement>(id).disabled = on;
  if (structural) {
    for (const id of ['move-title', 'move-target']) get<HTMLInputElement>(id).disabled = on;
    for (const box of get('move-members').querySelectorAll<HTMLInputElement>('input')) box.disabled = on;
  }
  for (const button of get('roster-list').querySelectorAll('button')) (button as HTMLButtonElement).disabled = on;
}
function mergeAck(ack: LiveAck, action: LiveAction) {
  if (!data) return;
  const priorScene = data.scene, priorCharacter = originalCharacter();
  data.rosterRevision = ack.rosterRevision;if(ack.archivedRosterCount!==undefined)data.archivedRosterCount=ack.archivedRosterCount;
  if (ack.character) {
    const current = ack.character;
    data.roster = data.roster.some(c => c.id === current.id) ? data.roster.map(c => c.id === current.id ? current : c) : [...data.roster, current];
    if(current.archived){data.roster=data.roster.filter(c=>c.id!==current.id);if(selected===current.id){selected=data.roster[0]?.id??null;characterDraft=originalCharacter()?structuredClone(originalCharacter()!):null;}}
    if (characterDraft?.id === current.id) {
      const dirty = priorCharacter && !equal(characterDraft.profile, priorCharacter.profile);
      characterDraft = action.kind === 'profile' ? { ...current, profile: characterDraft.profile } :
        dirty ? { ...current, profile: characterDraft.profile, profileRevision: characterDraft.profileRevision } : structuredClone(current);
    }
  }
  if (ack.session) {
    const session = ack.session;
    data.primaryId = session.primaryId; data.focusId = session.focusId; data.focusRevision = session.focusRevision; data.archiveCount = session.archiveCount;
    data.roster = data.roster.map(c => ({ ...c, ...session.members.find(m => m.id === c.id) }));
    if (characterDraft) { const m = session.members.find(m => m.id === characterDraft!.id); if (m) characterDraft = { ...characterDraft, ...m }; }
    data.scenes = data.scenes.filter(s => !session.retired.some(r => r.id === s.id)).map(s => ({ ...s, ...session.groups.find(g => g.id === s.id), primary: s.id === session.primaryId }));
    if (session.createdScene && !data.scenes.some(s => s.id === session.createdScene!.id)) data.scenes.push(session.createdScene);
  }
  if (ack.scene) {
    data.scene = ack.scene;
    if (action.kind === 'scene-content' && sceneDraft?.id === ack.scene.id) sceneDraft = { ...ack.scene, ...content(sceneDraft) };
    else if (sceneDraft?.id === ack.scene.id && priorScene && !equal(content(sceneDraft), content(priorScene))) sceneDraft = {
      ...ack.scene, ...content(sceneDraft), revision: sceneDraft.revision,
    };
    else sceneDraft = structuredClone(ack.scene);
    data.scenes = data.scenes.map(s => s.id === ack.scene!.id ? { ...s, title: ack.scene!.title, members: ack.scene!.members.length, membershipRevision: ack.scene!.membershipRevision, clock: ack.scene!.clock } : s);
  }
  renderList();renderCharacter(); renderMembership(); renderSceneMeta(); renderGroups();
  document.dispatchEvent(new Event('campaign-party-changed'));
}
async function execute(action: LiveAction): Promise<LiveAck | null> {
  if (!context || blocked || request) return null;
  const focusRevision = data?.focusRevision,previousLocationId=data?.scene?.locationId, token = context.token, command: LiveCommand = { commandId: crypto.randomUUID(), campaignId: context.campaign.id, token, action };
  const structural = ['focus', 'move', 'membership', 'archive-character'].includes(action.kind);
  // Blur starts a text save before the user's button click arrives. Keep queued
  // intents available; their handlers await flushLive before writing.
  requestIsTextSave = action.kind === 'profile' || action.kind === 'scene-content';
  busy(true, structural, requestIsTextSave); tell('Wird gespeichert…');
  request = (async () => {
    try {
      const ack = unwrap(await window.campaign.executeLive(command));
      if (context?.token !== token) return null;
      if((action.kind==='live-moment'||action.kind==='scene-content'||action.kind==='session-marker')&&(data?.scene?.id!==action.sceneId||data?.focusRevision!==focusRevision))return ack;
      mergeAck(ack, action);if(liveActionUpdatesRecap(action)||action.kind==='scene-content'&&ack.scene?.locationId!==previousLocationId)void refreshLiveSession();tell(changed() ? 'Weitere Eingabe offen – noch nicht gespeichert.' : 'Gespeichert.'); return ack;
    } catch (error) {
      if (context?.token !== token) return null;
      failed = command; blocked = true; get('live-reconcile').hidden = false; get('live-refresh').hidden = false;
      tell((error as Error).message + ' Entwurf bleibt offen. Zuerst den Speicherstatus prüfen.', true); return null;
    } finally { request = null; requestIsTextSave = false; busy(false, structural); renderGroups(); }
  })();
  return request;
}
export async function flushLive(): Promise<boolean> {
  if(!await flushSceneDesk())return false;
  if(!(await flushProgress())||!(await flushCombat())||!(await flushChase()))return false;
  if (timer) clearTimeout(timer); timer = null;
  if (flushing) { const okay = await flushing; return okay ? flushLive() : false; }
  if (request) { if (!(await request)) return false; return flushLive(); }
  if (!context || !data) return true;
  if (blocked || composing) return false;
  if (!changed()) return true;
  flushing = (async () => {
    if (characterDraft && originalCharacter() && !equal(characterDraft.profile, originalCharacter()!.profile)) {
      try { checkedCharacterProfile(characterDraft.profile); }
      catch (error) { tell((error as Error).message + ' Entwurf bleibt offen.', true); return false; }
      if (!(await execute({ kind: 'profile', characterId: characterDraft.id, expectedRevision: characterDraft.profileRevision, profile: structuredClone(characterDraft.profile) }))) return false;
    }
    if (sceneDraft && data?.scene && !equal(content(sceneDraft), content(data.scene))) {
      if (!(await execute({ kind: 'scene-content', sceneId: sceneDraft.id, expectedRevision: sceneDraft.revision, ...content(sceneDraft) }))) return false;
    }
    return true;
  })().finally(() => { flushing = null; });
  const okay = await flushing;
  return okay ? flushLive() : false;
}
function schedule() {
  if (timer) clearTimeout(timer);
  tell(blocked ? 'Schreiben gesperrt. Der Entwurf bleibt offen.' : 'Eingabe offen – noch nicht gespeichert.', blocked);
  if (!composing && !blocked) timer = setTimeout(() => { void flushLive(); }, 700);
}
function renderList() {
  const list = get('roster-list'); list.replaceChildren();
  const token = context?.token;
  for (const character of data?.roster ?? []) {
    const group = data?.scenes.find(s => s.id === character.sceneId);
    const button = document.createElement('button'); button.textContent = character.profile.name + (character.active ? ' · dabei' + (data!.scenes.length > 1 && group ? ' · ' + (group.title || (group.primary?'Hauptgruppe':'Gruppe mit '+groupPeople(group.id))) : '') : ' · inaktiv');
    button.setAttribute('aria-pressed', String(character.id === selected)); button.disabled = intentBlocked();
    button.onclick = () => { void (async () => {
      if (!(await flushLive()) || context?.token !== token) return;
      selected = character.id; characterDraft = structuredClone(originalCharacter()!); renderCharacter(); renderList();
    })(); }; list.append(button);
  }
  if (!data?.roster.length) { const text = document.createElement('p'); text.textContent = 'Noch keine Figuren. Eine leere Party kann ebenfalls leiten.'; list.append(text); }
}
const profileFields = [
  ['character-name', 'name'], ['character-player', 'playerName'], ['character-species', 'species'], ['character-class', 'characterClass'],
  ['character-ac', 'armorClass'], ['character-perception', 'passivePerception'], ['character-speed', 'speedFeet'],
] as const;
function renderCharacter() {
  get('character-editor').hidden = !characterDraft;
  for (const [id, field] of profileFields) get<HTMLInputElement>(id).value = String(characterDraft?.profile[field] ?? '');
  renderMembership();
}
function renderMembership() {
  progressionContext(context, data, selected);
  const c = originalCharacter();
  get('character-membership').textContent = c?.active ? 'Teil der aktuellen Party' : 'Nicht in der aktuellen Party';
  get('character-toggle').textContent = c?.active ? 'Für heute deaktivieren' : 'Für heute aktivieren';
  renderSceneMeta();
}
function renderVisits() {
  const plan = sources?.plans.find(p => p.id === value('adoption-plan')), select = get<HTMLSelectElement>('adoption-visit'); select.replaceChildren();
  for (const [index, visit] of (plan?.scenes ?? []).entries()) { const option = document.createElement('option'); option.value = visit.id; option.textContent = (index + 1) + '. ' + (visit.title || 'Unbenannter Besuch'); select.append(option); }
  get<HTMLButtonElement>('adoption-preview').disabled = !plan?.scenes.length || intentBlocked();
}
function renderSceneMeta() {
  liveGenerator?.contextChanged();sessionNavigatorContext(context,data,sources,resumed);syncLivePacketContext();
  void refreshMusic();
  if(context&&data?.scene&&resumed)void renderLiveWorld(context.token,data.scene.id);
  const scene = data?.scene;
  sceneDeskContext(context,resumed?scene??null:null);
  combatContext(context, resumed ? scene ?? null : null, data?.rosterRevision);
  chaseContext(context,resumed?scene??null:null,data?.roster??[]);
  const active = data?.roster.filter(c => c.active && c.sceneId === scene?.id) ?? [];
  get('live-party').textContent = active.length ? 'Dabei: ' + active.map(c => c.profile.name).join(', ') : 'Leere Party – Scene bleibt verfügbar.';
  renderPartyReference();
  get('live-clock').textContent = scene ? 'Seit Kampagnenbeginn: ' + formatInstant(scene.clock.instantMs) : '';
  renderTimePreview();
  void refreshScenePreparation();
  void refreshRuleReferences(resumed?scene?.id??null:null);
  const origin = get('running-origin'); origin.replaceChildren();
  if (scene?.adoption) {
    const a = scene.adoption, title = document.createElement('p'), notes = document.createElement('p'), place = document.createElement('p');
    title.textContent = 'Übernommen: ' + (a.title || 'Unbenannter Besuch'); notes.textContent = a.notes;
    place.textContent = 'Ort bei Übernahme: ' + (sources?.locations.find(l => l.document.id === a.locationId)?.document.name ?? (a.locationId ? 'nicht verfügbar' : 'kein Ort'));
    origin.append(title, notes, place);
  } else origin.textContent = 'Noch kein vorbereiteter Besuch übernommen.';
  get<HTMLButtonElement>('running-open-location').disabled = !sceneDraft?.locationId;
  get<HTMLButtonElement>('running-player-location').disabled = !sceneDraft?.locationId;
}
function activeParty(){const scene=data?.scene;return data?.roster.filter(character=>character.active&&character.sceneId===scene?.id)??[];}
function renderPassivePerception(){const result=get('live-passive-result');try{result.textContent=passivePerceptionResult(activeParty().map(character=>({name:character.profile.name,passivePerception:character.profile.passivePerception})),Number(value('live-passive-dc')));}catch(error){result.textContent=(error as Error).message;}}
function renderPartyReference(){const active=activeParty(),progress=new Map(progressCharacters().map(row=>[row.characterId,row])),reference=get('live-party-reference');reference.replaceChildren();for(const character of active){const button=document.createElement('button'),name=document.createElement('strong'),facts=document.createElement('span'),profile=character.profile,row=progress.get(character.id);name.textContent=profile.name;facts.textContent=partyHealthFacts(row)+' · '+partyProgressFacts(row)+' · RK '+(profile.armorClass??'—')+' · Passive Wahrnehmung '+(profile.passivePerception??'—')+' · Bewegung '+(profile.speedFeet===undefined?'—':profile.speedFeet+' ft')+(profile.characterClass?' · '+profile.characterClass:'');button.type='button';button.append(name,facts);button.setAttribute('aria-label',profile.name+' im Partyprofil öffnen');button.onclick=()=>{void(async()=>{const token=context?.token,id=character.id;if(!await flushLive()||context?.token!==token||!data?.roster.some(row=>row.id===id))return;selected=id;characterDraft=structuredClone(originalCharacter()!);renderCharacter();renderList();get('character-editor').scrollIntoView({block:'nearest'});get<HTMLInputElement>('character-name').focus({preventScroll:true});})();};reference.append(button);}get('live-party-reference-empty').hidden=!!active.length;get<HTMLButtonElement>('live-passive-check').disabled=!active.length;const passiveResult=get('live-passive-result');if(!active.length)passiveResult.textContent='';else if(passiveResult.textContent)renderPassivePerception();}
async function showLiveNpc(npcId:string,isCurrent=()=>true){const token=context?.token,focus=playerFocus();if(!focus||!npcId)return;if(await flushLive()&&context?.token===token&&isCurrent())await cuePlayerImage('npc',npcId,focus);}
export async function useLiveReferenceReadAloud(text:string,title:string,expectedSceneId:string){
 const token=context?.token,focus=data?.focusRevision;
 const current=()=>context?.token===token&&data?.scene?.id===expectedSceneId&&data?.focusRevision===focus;
 if(!token||!current()||!await ensureLiveRuntime()||!current()||!await flushLive()||!current())throw new Error('Die laufende Gruppe hat sich geändert. Schnellsuche neu öffnen.');
 useKnowledgeReadAloud(text,title);if(!await flushLive())throw new Error('Vorlesetext konnte noch nicht gespeichert werden. Eingabe bleibt offen.');
}
function useKnowledgeReadAloud(text:string,title:string){if(!sceneDraft)return;sceneDraft={...sceneDraft,readAloud:text};get<HTMLTextAreaElement>('running-read-aloud').value=text;schedule();get<HTMLTextAreaElement>('running-read-aloud').focus();tell('Vorlesetext aus „'+title+'“ übernommen – wird automatisch gespeichert.');}
function loadLiveNarrative(noteId:string){if(!context||narrativeCache.has(noteId)||narrativeProblems.has(noteId)||narrativeLoading.has(noteId))return;const token=context.token,generation=narrativeGeneration;narrativeLoading.add(noteId);void window.campaign.narrative(token,noteId).then(result=>{if(context?.token!==token||generation!==narrativeGeneration)return;if(result.ok)narrativeCache.set(noteId,result.value);else narrativeProblems.set(noteId,result.error);}).catch(error=>{if(context?.token===token&&generation===narrativeGeneration)narrativeProblems.set(noteId,(error as Error).message);}).finally(()=>{if(generation===narrativeGeneration){narrativeLoading.delete(noteId);renderLiveKnowledge();}});}
function narrativeFacts(view:NarrativeView){const state=view.state,location=state.locationId?sources?.locations.find(row=>row.document.id===state.locationId)?.document.name??'Ort nicht verfügbar':'Ohne Ortsbindung',contributors=state.contributors.map(id=>data?.roster.find(character=>character.id===id)?.profile.name??'Unbekannte Figur');return(state.status==='closed'?'Abgeschlossen':'Offen')+' · '+location+(contributors.length?' · Beteiligte: '+contributors.join(', '):'')+(state.poolXp?' · '+state.poolXp+' XP vorgemerkt':'')+(view.award?' · Belohnung vergeben':'');}
function renderLiveKnowledge(){
  const root=get('live-knowledge-results');root.replaceChildren();const query=value('live-knowledge-search').trim().toLocaleLowerCase('de');
  const found=findLiveKnowledge((sources?.notes??[]).filter(row=>!row.trashed&&row.note.kind!=='rule'),query,30,row=>preparedNoteIds.has(row.note.id)),rows=found.rows;get('live-knowledge-result').textContent=rows.length===found.total?found.total+' Einträge angezeigt.':rows.length+' von '+found.total+' Einträgen angezeigt – Suche präzisieren.';
  for(const row of rows){const note=row.note,card=document.createElement('article'),heading=document.createElement('div'),title=document.createElement('h4'),kind=document.createElement('small'),actions=document.createElement('div');heading.className='toolbar';title.textContent=note.title||'Unbenannter Eintrag';kind.textContent=({npc:'NSC',faction:'Fraktion',quest:'Quest',rumor:'Gerücht'})[note.kind as 'npc'|'faction'|'quest'|'rumor']+(preparedNoteIds.has(note.id)?' · Mit aktuellem Besuch verknüpft':'');heading.append(title,kind);actions.className='toolbar';const token=context?.token,sceneId=data?.scene?.id,focus=data?.focusRevision,current=()=>context?.token===token&&data?.scene?.id===sceneId&&data?.focusRevision===focus&&root.contains(card);
    if(note.readAloud){const publicText=document.createElement('pre'),use=document.createElement('button');publicText.textContent=note.readAloud;publicText.className='live-knowledge-public';use.type='button';use.textContent='Als Vorlesetext einsetzen';use.onclick=()=>{if(current())useKnowledgeReadAloud(note.readAloud,note.title);};card.append(heading,publicText);actions.append(use);}else card.append(heading);
    if(note.kind==='npc'){const portrait=document.createElement('button');portrait.type='button';portrait.textContent='Porträt zeigen';portrait.onclick=()=>{if(current())void showLiveNpc(note.id,current).catch(error=>{if(current())tell((error as Error).message,true);});};actions.append(portrait);}
    if(note.kind==='quest'||note.kind==='rumor'){const status=document.createElement('p'),open=document.createElement('button'),view=narrativeCache.get(note.id),problem=narrativeProblems.get(note.id);status.className='caption';status.textContent=view?narrativeFacts(view):problem?'Status nicht verfügbar: '+problem:'Status wird geladen…';open.type='button';open.textContent=view?.award?'Abschluss ansehen':'Verwalten / abschließen';open.onclick=()=>{if(current())void openKnowledgeNote(note.id).catch(error=>{if(current())tell((error as Error).message,true);});};card.append(status);actions.append(open);if(!view&&!problem)loadLiveNarrative(note.id);}
    if(note.gmNotes){const details=document.createElement('details'),summary=document.createElement('summary'),gm=document.createElement('pre');summary.textContent='GM-Notizen';gm.textContent=note.gmNotes;details.append(summary,gm);card.append(details);}card.append(actions);root.append(card);
  }
  if(!rows.length){const empty=document.createElement('p');empty.className='caption';empty.textContent=query?'Kein vorbereitetes Wissen gefunden.':'Noch keine NSCs, Fraktionen, Quests oder Gerüchte vorbereitet.';root.append(empty);}
}
function renderScene() {
  if(preparedNotesSceneId!==data?.scene?.id){preparedNotesSceneId=data?.scene?.id??null;preparedNoteIds.clear();}
  get('running-editor').hidden = !resumed || !sceneDraft; get('live-start-hint').hidden = resumed; get('live-continue').hidden = resumed;
  get<HTMLInputElement>('running-title').value = sceneDraft?.title ?? ''; get<HTMLTextAreaElement>('running-notes').value = sceneDraft?.notes ?? ''; get<HTMLTextAreaElement>('running-read-aloud').value=sceneDraft?.readAloud??'';
  get<HTMLButtonElement>('running-player-location').disabled=!sceneDraft?.locationId;
  renderLiveMomentDraft();
  const select = get<HTMLSelectElement>('running-location'); select.replaceChildren();
  const none = document.createElement('option'); none.value = ''; none.textContent = 'Kein Ort'; select.append(none);
  const current = sceneDraft?.locationId;
  for (const row of sources?.locations.filter(l => !l.trashed || l.document.id === current) ?? []) {
    const option = document.createElement('option'); option.value = row.document.id; option.textContent = row.document.name + (row.trashed ? ' (Papierkorb)' : ''); option.disabled = row.trashed; select.append(option);
  }
  if (current && !sources?.locations.some(l => l.document.id === current)) { const option = document.createElement('option'); option.value = current; option.textContent = 'Ort nicht verfügbar'; option.disabled = true; select.append(option); }
  select.value = current ?? '';
  renderNpcChoices();renderLiveSession();
  renderLiveKnowledge();renderSceneMeta(); renderGroups();
}
function groupPeople(id:string){return data?.roster.filter(c=>c.active&&c.sceneId===id).map(c=>c.profile.name).join(', ')||'Leere Party';}
function groupLabel(group:Pick<LiveView['scenes'][number],'id'|'title'|'primary'|'clock'>){
  return (group.title||'Unbenannte Gruppe')+(group.primary?' · Hauptgruppe':'')+' · '+groupPeople(group.id)+' · '+formatInstant(group.clock.instantMs);
}
function currentLiveMomentDraft():LiveMomentDraft{return{category:value('live-moment-category') as LiveMomentCategory,title:value('live-moment-title'),summary:value('live-moment-summary'),followUp:value('live-moment-follow-up') as LiveMomentDraft['followUp']};}
function writeLiveMomentDraft(draft:LiveMomentDraft){get<HTMLSelectElement>('live-moment-category').value=draft.category;get<HTMLInputElement>('live-moment-title').value=draft.title;get<HTMLTextAreaElement>('live-moment-summary').value=draft.summary;get<HTMLSelectElement>('live-moment-follow-up').value=draft.followUp;}
function renderLiveMomentDraft(){const next=liveMomentDrafts.switchTo(data?.scene?.id??null,currentLiveMomentDraft());if(next.changed){writeLiveMomentDraft(next.draft);get('live-moment-result').textContent='';}}
function renderLiveSession(){
  const recap=liveSessionRecap(sessionChronicle?.entries??[],sessionChronicle?.latestSessionMarker),status=get('live-session-status'),list=get('live-session-events');list.replaceChildren();
  get<HTMLButtonElement>('live-session-start').hidden=recap.open;get<HTMLButtonElement>('live-session-end').hidden=!recap.open;get<HTMLButtonElement>('live-session-start').disabled=!!sessionChronicleError||intentBlocked();get<HTMLButtonElement>('live-session-end').disabled=!!sessionChronicleError||intentBlocked();get<HTMLTextAreaElement>('live-session-summary').hidden=!recap.open;
  if(sessionChronicleError)status.textContent='Rückblick nicht verfügbar: '+sessionChronicleError;
  else if(!recap.marker)status.textContent='Noch kein Spielabend markiert.';
  else{const when=new Date(recap.marker.recordedAt),label=Number.isNaN(when.valueOf())?'':when.toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'});status.textContent=recap.open?'Läuft seit '+label+' · '+recap.entries.length+' bestätigte Ereignisse':'Letzter Spielabend beendet '+label+' · '+recap.entries.length+' bestätigte Ereignisse'+(recap.marker.summary?' · '+recap.marker.summary:'');}
  if(sessionChronicle?.truncated)status.textContent+=' · Gekürzter Chronikausschnitt; weitere Ereignisse über die Chroniksuche.';
  for(const entry of recap.entries.slice(0,12)){const item=document.createElement('li'),strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=entry.title;span.textContent=[entry.summary,entry.scene&&'Gruppe: '+entry.scene,entry.location&&'Ort: '+entry.location].filter(Boolean).join(' · ');item.append(strong);if(span.textContent)item.append(span);list.append(item);}
  get('live-session-more').hidden=recap.entries.length<=12;
}
async function readSessionChronicle(token:string):Promise<Result<ChronicleView>>{try{return await window.campaign.chronicle(token);}catch(error){return{ok:false,error:(error as Error).message};}}
async function refreshLiveSession(){const token=context?.token,n=++sessionChronicleRequest;if(!token)return;const result=await readSessionChronicle(token);if(context?.token!==token||n!==sessionChronicleRequest)return;if(result.ok){sessionChronicle=result.value;sessionChronicleError='';}else sessionChronicleError=result.error;renderLiveSession();}
async function markLiveSession(marker:'start'|'end',submittedSummary?:string):Promise<boolean>{
 const token=context?.token,sceneId=data?.scene?.id,focusRevision=data?.focusRevision,summary=marker==='end'?(submittedSummary??value('live-session-summary')):'';
 const current=()=>context?.token===token&&data?.scene?.id===sceneId&&data?.focusRevision===focusRevision;
 if(!token||!sceneId||sessionChronicleError||!sessionChronicle)return false;
 try{if(!await flushLive()||!current())return false;const ack=await execute({kind:'session-marker',sceneId,expectedRevision:data!.scene!.revision,marker,summary});if(!ack||!current())return false;
  const unchanged=value('live-session-summary')===summary;if(marker==='end'&&unchanged)get<HTMLTextAreaElement>('live-session-summary').value='';
  get('live-session-result').textContent=(marker==='start'?'Spielabend begonnen.':'Spielabend beendet. Rückblick gespeichert.')+(marker==='end'&&!unchanged?' Neuere Notiz bleibt erhalten.':'');return true;
 }catch(error){if(current()){tell((error as Error).message,true);await refreshLiveSession();}}return false;
}
async function readSessionCloseAudit(token:string,scenes:LiveView['scenes'],events:ReturnType<typeof liveSessionRecap>['entries']):Promise<SessionCloseAudit>{
  const [rows,treasureResult]=await Promise.all([Promise.all(scenes.map(async scene=>{const[combatResult,chaseResult]=await Promise.all([window.campaign.combat(token,scene.id),window.campaign.chase(token,scene.id)]);return{scene,combat:unwrap(combatResult),chase:unwrap(chaseResult)};})),window.campaign.treasures(token,null)]),treasures=unwrap(treasureResult),masks:SessionCloseMask[]=[],seen=new Set<string>();
  for(const row of rows){for(const combat of row.combat.recent)if(['preparing','running'].includes(combat.phase)&&!seen.has('combat:'+combat.id)){seen.add('combat:'+combat.id);masks.push({kind:'combat',id:combat.id,sceneId:row.scene.id,sceneTitle:row.scene.title||'Unbenannte Gruppe',title:combat.title,state:combat.phase==='preparing'?'in Vorbereitung':'läuft'});}for(const chase of row.chase.recent)if(chase.status==='running'&&!seen.has('chase:'+chase.id)){seen.add('chase:'+chase.id);masks.push({kind:'chase',id:chase.id,sceneId:row.scene.id,sceneTitle:row.scene.title||'Unbenannte Gruppe',title:chase.title,state:'läuft'});}}
  const openTreasures=treasures.items.filter(item=>item.available>0);return{masks,treasures:{count:openTreasures.length,units:openTreasures.reduce((sum,item)=>sum+item.available,0),more:!!treasures.next},xpBooked:events.some(entry=>entry.id.startsWith('progress:')&&entry.category==='party'&&entry.title.startsWith('XP-Abrechnung:')),events:events.length};
}
function renderSessionCloseAudit(audit:SessionCloseAudit){
  const active=data?.roster.filter(character=>character.active).length??0,groups=data?.scenes.length??0;get('live-session-close-facts').textContent=audit.events+' bestätigte Ereignisse · '+active+' aktive Figuren · '+groups+' '+(groups===1?'Gruppe':'Gruppen');
  get('live-session-close-xp-status').textContent=audit.xpBooked?'Spielabend-XP wurden in diesem Rückblick bereits abgerechnet.':'Im sichtbaren Rückblick ist noch keine XP-Abrechnung erfasst.';
  get('live-session-close-loot-status').textContent=audit.treasures.count?audit.treasures.count+' unverteilte '+(audit.treasures.count===1?'Schatzposition':'Schatzpositionen')+' · '+audit.treasures.units+' verfügbare Einheiten'+(audit.treasures.more?' · weitere Schätze vorhanden':''):'Keine unverteilte Beute auf der ersten Schatzseite.';
  const root=get('live-session-close-masks');root.replaceChildren();if(!audit.masks.length){const empty=document.createElement('p');empty.className='caption';empty.textContent='Keine laufenden Kämpfe oder Verfolgungen.';root.append(empty);return;}
  for(const mask of audit.masks){const card=document.createElement('article'),text=document.createElement('div'),title=document.createElement('strong'),facts=document.createElement('p'),button=document.createElement('button');title.textContent=mask.title;facts.textContent=(mask.kind==='combat'?'Kampf':'Verfolgung')+' · '+mask.state+' · '+mask.sceneTitle;button.type='button';button.textContent='Öffnen';button.onclick=()=>void(async()=>{get<HTMLDialogElement>('live-session-close-dialog').close();await changeFocus(mask.sceneId);if(data?.scene?.id!==mask.sceneId)return;if(mask.kind==='combat'){await openExistingCombat(mask.id);get('combat-panel').scrollIntoView({block:'start'});}else{await openExistingChase(mask.id);get('chase-panel').scrollIntoView({block:'start'});}})().catch(error=>tell(error.message,true));text.append(title,facts);card.append(text,button);root.append(card);}
}
async function loadSessionCloseReview(preserveSummary=false){
  const token=context?.token,recap=liveSessionRecap(sessionChronicle?.entries??[],sessionChronicle?.latestSessionMarker),dialog=get<HTMLDialogElement>('live-session-close-dialog');if(!token||!data?.scene||sessionChronicleError||!recap.open){renderLiveSession();return;}const run=++sessionCloseRequest;if(!preserveSummary)get<HTMLTextAreaElement>('live-session-close-summary').value=value('live-session-summary');if(!dialog.open)dialog.showModal();dialog.setAttribute('aria-busy','true');get('live-session-close-status').textContent='Offene Spielstände werden geprüft…';get<HTMLButtonElement>('live-session-close-confirm').disabled=true;get<HTMLButtonElement>('live-session-close-refresh').disabled=true;get('live-session-close-masks').replaceChildren();
  try{const audit=await readSessionCloseAudit(token,data.scenes,recap.entries);if(context?.token!==token||run!==sessionCloseRequest||!dialog.open)return;renderSessionCloseAudit(audit);get('live-session-close-status').textContent=audit.masks.length||audit.treasures.count||!audit.xpBooked?'Prüfung abgeschlossen. Offene Punkte bleiben erhalten, wenn du den Spielabend jetzt beendest.':'Alles geprüft. Der Spielabend kann abgeschlossen werden.';get<HTMLButtonElement>('live-session-close-confirm').disabled=false;}
  catch(error){if(context?.token===token&&run===sessionCloseRequest&&dialog.open)get('live-session-close-status').textContent='Prüfung fehlgeschlagen: '+(error as Error).message;}
  finally{if(run===sessionCloseRequest){dialog.setAttribute('aria-busy','false');get<HTMLButtonElement>('live-session-close-refresh').disabled=false;}}
}
async function finishLiveSession(){
 const token=context?.token,n=sessionCloseRequest,dialog=get<HTMLDialogElement>('live-session-close-dialog');if(!token||!dialog.open||get<HTMLButtonElement>('live-session-close-confirm').disabled)return;
 const summary=value('live-session-close-summary');get<HTMLTextAreaElement>('live-session-summary').value=summary;get<HTMLButtonElement>('live-session-close-confirm').disabled=true;
 const confirmed=await markLiveSession('end',summary);if(context?.token!==token||n!==sessionCloseRequest||!dialog.open)return;
 if(confirmed){const latest=value('live-session-close-summary');if(latest!==summary)get<HTMLTextAreaElement>('live-session-summary').value=latest;sessionCloseRequest++;dialog.close();}else get<HTMLButtonElement>('live-session-close-confirm').disabled=false;
}

function renderNpcChoices(){renderLiveNpcChoices(get<HTMLSelectElement>('running-player-npc'),get<HTMLButtonElement>('running-player-npc-show'),get('running-player-npc-result'),(sources?.notes.filter(row=>!row.trashed&&row.note.kind==='npc')??[]).map(row=>({id:row.note.id,title:row.note.title})),value('running-player-npc-filter'));}
function renderGroups() {
  const select = get<HTMLSelectElement>('scene-focus'); select.replaceChildren();
  const cards = get('group-list'); cards.replaceChildren(); cards.hidden = !resumed || (data?.scenes.length ?? 0) < 2;
  for (const group of data?.scenes ?? []) {
    const option = document.createElement('option'); option.value = group.id;
    const people = data!.roster.filter(c => c.active && c.sceneId === group.id).map(c => c.profile.name).join(', ') || 'Leere Party';
    option.textContent = groupLabel(group); select.append(option);
    const button = document.createElement('button'), name = document.createElement('strong'), facts = document.createElement('small');
    name.textContent = (group.title || 'Unbenannte Gruppe') + (group.primary ? ' · Hauptgruppe' : ''); facts.textContent = people + ' · ' + formatInstant(group.clock.instantMs);
    button.append(name, facts); button.setAttribute('aria-pressed', String(data?.focusId === group.id)); button.disabled = intentBlocked();
    button.onclick = () => { void changeFocus(group.id); }; cards.append(button);
  }
  select.value = data?.focusId ?? '';
  get<HTMLButtonElement>('group-move').disabled = !data?.scene?.members.length || intentBlocked();
  get('live-archives').hidden = !data?.archiveCount;
  get('live-archives').textContent = 'Frühere Gruppen ansehen (' + (data?.archiveCount ?? 0) + ')';
}
async function changeFocus(id: string) {
  const token = context?.token, revision = data?.focusRevision;
  if (revision === null || revision === undefined || !(await flushLive()) || context?.token !== token) { get<HTMLSelectElement>('scene-focus').value = data?.focusId ?? ''; return; }
  if (await execute({ kind: 'focus', sceneId: id, expectedRevision: revision })) renderScene();
}
function renderTimePreview() {
  if (!data?.scene) return;
  try { get('time-preview').textContent = 'Danach: ' + formatInstant(advanceInstant(data.scene.clock.instantMs, Number(value('time-amount')), value('time-unit') as TimeUnit)); }
  catch (error) { get('time-preview').textContent = (error as Error).message; }
}
function render() {
  get('live-empty').hidden = !!data; get('live-workspace').hidden = !data; renderList(); renderCharacter(); renderScene();
  const select = get<HTMLSelectElement>('adoption-plan'), current = select.value; select.replaceChildren();
  for (const plan of sources?.plans ?? []) { const option = document.createElement('option'); option.value = plan.id; option.textContent = plan.name || 'Unbenannter Plan'; select.append(option); }
  if (sources?.plans.some(p => p.id === current)) select.value = current;
  renderVisits();
}
export function initLive(status: typeof tell, navigate: typeof openLocation,openNote:(id:string)=>Promise<void>) {
  tell=status;openLocation=navigate;openKnowledgeNote=openNote;initSessionNavigator(status,previewPlannedVisit,async(sceneId,adoptionId,status,outcome)=>{const token=context?.token;if(!token||!await flushLive()||context?.token!==token||data?.scene?.id!==sceneId||data.scene.adoption?.id!==adoptionId)return false;const ack=await execute({kind:'visit-outcome',sceneId,adoptionId,expectedRevision:data.scene.revision,status,outcome});if(ack)renderScene();return !!ack;});const packetButton=document.createElement('button');packetButton.id='live-session-packet';packetButton.type='button';packetButton.textContent='Mappe am Spieltisch öffnen';get('live-session-progress-refresh').after(packetButton);packetButton.onclick=()=>void openLivePacket().catch(e=>tell(e.message,true));get('live-session-plan').addEventListener('change',syncLivePacketContext);liveGenerator=new LiveEncounterGenerator(status,()=>context&&data?.scene&&resumed?{workspace:context,live:data}:null,flushLive,prepareGeneratedCombat);const lootButton=document.createElement('button');lootButton.id='live-loot-distribute';lootButton.type='button';lootButton.textContent='Beute verteilen…';packetButton.after(lootButton);lootButton.onclick=()=>void(async()=>{const token=context?.token,id=data?.scene?.id;if(!id||!await flushLive()||context?.token!==token||data?.scene?.id!==id)return;await openTreasureDistribution(undefined,id);})().catch(e=>tell(e.message,true));const closeDialog=document.createElement('dialog');closeDialog.id='live-session-close-dialog';closeDialog.innerHTML='<div class="toolbar"><h2>Spielabend abschließen</h2><button id="live-session-close-x" type="button">Schließen</button></div><p id="live-session-close-status" role="status"></p><p id="live-session-close-facts" class="session-close-facts"></p><section><h3>Laufende Szenen</h3><div id="live-session-close-masks"></div></section><section class="session-close-check"><div><h3>Spielabend-XP</h3><p id="live-session-close-xp-status"></p></div><button id="live-session-close-xp" type="button">XP abrechnen…</button></section><section class="session-close-check"><div><h3>Beute</h3><p id="live-session-close-loot-status"></p></div><button id="live-session-close-loot" type="button">Beute verteilen…</button></section><label>Abschlussnotiz<textarea id="live-session-close-summary" maxlength="10000"></textarea></label><p class="caption">Offene Kämpfe, Verfolgungen und Beute bleiben nach dem Abschluss erhalten.</p><div class="toolbar"><button id="live-session-close-refresh" type="button">Erneut prüfen</button><span class="grow"></span><button id="live-session-close-cancel" type="button">Abbrechen</button><button id="live-session-close-confirm" type="button">Spielabend jetzt beenden</button></div>';document.body.append(closeDialog);for(const id of ['live-session-close-x','live-session-close-cancel'])get<HTMLButtonElement>(id).onclick=()=>{get<HTMLTextAreaElement>('live-session-summary').value=value('live-session-close-summary');sessionCloseRequest++;closeDialog.close();};get('live-session-close-refresh').onclick=()=>void loadSessionCloseReview(true);get('live-session-close-confirm').onclick=()=>void finishLiveSession();get('live-session-close-xp').onclick=()=>{get<HTMLTextAreaElement>('live-session-summary').value=value('live-session-close-summary');sessionCloseRequest++;closeDialog.close();const popover=get<HTMLElement>('party-popover');if(!popover.matches(':popover-open'))popover.showPopover();get<HTMLButtonElement>('party-award-open').click();};get('live-session-close-loot').onclick=()=>{get<HTMLTextAreaElement>('live-session-summary').value=value('live-session-close-summary');sessionCloseRequest++;closeDialog.close();void openTreasureDistribution(undefined,data?.scene?.id).catch(error=>tell(error.message,true));};closeDialog.addEventListener('cancel',()=>{get<HTMLTextAreaElement>('live-session-summary').value=value('live-session-close-summary');sessionCloseRequest++;});initSceneDesk(status,prepareLiveEncounter,addLiveCreature);initCombat(status,refreshScenePreparation);initChase(status,refreshLiveSession);initProgress(status,scene=>{if(!data?.scene||data.scene.id!==scene.id||data.scene.clock.epochId!==scene.clock.epochId||data.scene.clock.revision>scene.clock.revision)return;data.scene.clock=scene.clock;for(const row of data.scenes)if(row.id===scene.id)row.clock=scene.clock;renderSceneMeta();renderGroups();});onProgressChanged(()=>{renderPartyReference();void refreshLiveSession();});initRuleReferences(status);
  initGroups();
  get('scene-preparation-refresh').onclick=()=>void refreshScenePreparation();
  get('live-next-visit').onclick=()=>{void(async()=>{if(!nextVisit||!await flushLive())return;const visit=nextVisit;await openLive(visit.planId,visit.visitId);get<HTMLDetailsElement>('adoption-picker').open=true;get('adoption-preview').click();})();};
  get('character-new').onclick = () => { if (context && data) { get<HTMLDialogElement>('character-dialog').showModal(); get('new-character-name').focus(); } };
  get('character-cancel').onclick = () => get<HTMLDialogElement>('character-dialog').close();
  get('character-form').onsubmit = event => { event.preventDefault(); void (async () => {
    const token = context?.token;
    if (!(await flushLive()) || context?.token !== token) return;
    const profile = { name: value('new-character-name') };
    const ack = await execute({ kind: 'create-character', profile });
    if (ack?.character) {
      selected = ack.character.id; characterDraft = structuredClone(ack.character);
      get<HTMLDialogElement>('character-dialog').close(); get<HTMLInputElement>('new-character-name').value = ''; renderList(); renderCharacter();
    }
  })(); };
  for (const [id, field] of profileFields) {
    get(id).oninput = () => {
      if (!characterDraft) return;
      const text = value(id), profile: CharacterProfile = { ...characterDraft.profile };
      if (field === 'name') profile.name = text;
      else if (!text) delete profile[field];
      else if (field === 'armorClass' || field === 'passivePerception' || field === 'speedFeet') profile[field] = Number(text);
      else profile[field] = text;
      characterDraft = { ...characterDraft, profile }; schedule();
    };
    get(id).onblur = () => { if (!composing) void flushLive(); };
  }
  get('character-toggle').onclick = () => { void (async () => {
    const token = context?.token, id = selected;
    if (!(await flushLive()) || context?.token !== token || selected !== id || !data) return;
    const c = originalCharacter(); if (!c) return;
    if (await execute({ kind: 'membership', characterId: c.id, expectedRevision: c.membershipRevision, expectedRosterRevision: data.rosterRevision,
      active: !c.active, targetSceneId: c.active ? null : data.focusId, expectedFocusRevision: data.focusRevision })) renderMembership();
  })(); };
  get('live-continue').onclick = () => { void (async () => {
    const token = context?.token;
    if (!(await flushLive()) || context?.token !== token || !data) return;
    if (await execute({ kind: 'initialize', expectedRosterRevision: data.rosterRevision })) {
      if (!(await flushLive())) return;
      resumed = true; await openLive(); renderScene(); tell('Gespeichert.');
    }
  })(); };
  for (const [id, field] of [['running-title', 'title'], ['running-notes', 'notes'], ['running-read-aloud','readAloud']] as const) {
    get(id).oninput = () => { if (sceneDraft) {
      const text = value(id), before = data?.scene?.[field];
      sceneDraft = { ...sceneDraft, [field]: before !== undefined && text === before.replace(/\r\n?/g, '\n') ? before : text }; schedule();
    } };
    get(id).onblur = () => { if (!composing) void flushLive(); };
  }
  get('running-location').onchange = () => { if (sceneDraft) { sceneDraft = { ...sceneDraft, locationId: value('running-location') || null }; renderSceneMeta(); schedule(); } };
  get('running-open-location').onclick = () => { void (async () => { const token = context?.token; if (await flushLive() && token === context?.token && sceneDraft?.locationId) await openLocation(sceneDraft.locationId); })(); };
  get('running-player-follow').onclick=()=>{void(async()=>{const token=context?.token,focus=playerFocus();if(await flushLive()&&context?.token===token)await cuePlayer('follow',focus);})();};
  get('running-player-location').onclick=()=>{void(async()=>{const token=context?.token,focus=playerFocus(),locationId=sceneDraft?.locationId;if(!focus||!locationId)return;if(await flushLive()&&context?.token===token&&sceneDraft?.locationId===locationId)await cuePlayerImage('location',locationId,focus);})();};
  get('running-player-npc-filter').oninput=renderNpcChoices;
  get('running-player-npc').onchange=()=>{get<HTMLButtonElement>('running-player-npc-show').disabled=!value('running-player-npc');};
  get('running-player-npc-show').onclick=()=>{const npcId=value('running-player-npc');void showLiveNpc(npcId,()=>value('running-player-npc')===npcId);};
  get('running-player-handout').onclick=()=>{void(async()=>{const token=context?.token,focus=playerFocus();if(!focus)return;if(await flushLive()&&context?.token===token)await cuePlayerImage('custom',null,focus);})();};
  get('running-player-blank').onclick=()=>{void cuePlayer('blank',null);};
  get('live-knowledge-search').oninput=renderLiveKnowledge;
  get('live-passive-form').onsubmit=event=>{event.preventDefault();renderPassivePerception();};
  get('live-moment-form').onsubmit=event=>{
    event.preventDefault();const token=context?.token,sceneId=data?.scene?.id,focusRevision=data?.focusRevision,draft=currentLiveMomentDraft(),{category,title,summary,followUp}=draft;
    const current=()=>context?.token===token&&data?.scene?.id===sceneId&&data?.focusRevision===focusRevision;
    if(!token||!sceneId||liveMomentDrafts.currentSceneId!==sceneId)return;
    void(async()=>{try{
      if(!await flushLive()||!current())return;
      const ack=await execute({kind:'live-moment',sceneId,expectedRevision:data!.scene!.revision,category,title,summary,followUp:followUp?{kind:followUp,id:crypto.randomUUID()}:null});if(!ack)return;liveMomentDrafts.saved(sceneId,draft);if(!current())return;
      let refreshProblem=false;if(followUp){try{const refreshed=await window.campaign.preparation(token,'');if(!current())return;if(refreshed.ok){sources=refreshed.value;renderLiveKnowledge();}else refreshProblem=true;}catch{if(!current())return;refreshProblem=true;}}
      const unchanged=canClearSavedLiveMoment(sceneId,liveMomentDrafts.currentSceneId,draft,currentLiveMomentDraft());
      if(unchanged){writeLiveMomentDraft(emptyLiveMomentDraft());get<HTMLInputElement>('live-moment-title').focus();}
      get('live-moment-result').textContent=liveMomentSavedMessage(followUp,unchanged,refreshProblem);
    }catch(error){if(current())tell((error as Error).message,true);}})();
  };
  get('live-session-start').onclick=()=>void markLiveSession('start');
  get('live-session-end').onclick=()=>void loadSessionCloseReview();
  get('adoption-plan').onchange = renderVisits;
  get('adoption-preview').onclick=()=>void previewPlannedVisit(value('adoption-plan'),value('adoption-visit')).catch(e=>tell(e.message,true));
  get('adoption-cancel').onclick = () => { adoption = null; get<HTMLDialogElement>('adoption-dialog').close(); };
  get('adoption-confirm').onclick = () => { void (async () => {
    const action = adoption; if (!action) return;
    if (await execute(action)) { adoption = null; get<HTMLDialogElement>('adoption-dialog').close(); get<HTMLDetailsElement>('adoption-picker').open = false; renderScene(); }
  })(); };
  get('live-apply').onclick = () => { void flushLive(); };
  get('live-reconcile').onclick = () => { void (async () => {
    const command = failed, token = context?.token; if (!command || !token) return;
    try {
      const result = unwrap(await window.campaign.liveStatus(command, token));
      if (context?.token !== token) return;
      if (result.targetChanged) {
        tell(result.receipt ? 'Speicherung bestätigt, inzwischen liegt ein neuerer Zielstand vor. Entwurf bleibt offen; vor dem Aktualisieren eigenen Text sichern.' : 'Konflikt bestätigt. Entwurf bleibt offen; vor dem Aktualisieren eigenen Text sichern.', true);
        return;
      }
      if (result.receipt) mergeAck({ ...result.receipt, ...(result.currentScene ? { scene: result.currentScene } : {}), ...(result.currentCharacter ? { character: result.currentCharacter } : {}) }, command.action);
      blocked = false; failed = null; get('live-reconcile').hidden = true; get('live-refresh').hidden = true;
      tell(result.outcome === 'applied' ? 'Speicherung bestätigt. Weitere Eingaben bleiben offen.' : 'Änderung nicht gespeichert. Eingabe abschließen, um den Entwurf erneut zu übernehmen.');
    } catch (error) { tell((error as Error).message + ' Status bleibt ungeklärt.', true); }
  })(); };
  get('live-refresh').onclick = () => { void (async () => {
    blocked = false; failed = null; characterDraft = null; sceneDraft = null; get('live-reconcile').hidden = true; get('live-refresh').hidden = true;
    await openLive(); tell('Gespeicherter Sitzungsstand geöffnet. Entwurf verworfen.');
  })(); };
  get('live').addEventListener('compositionstart', () => { composing = true; if (timer) clearTimeout(timer); });
  get('live').addEventListener('compositionend', () => { composing = false; schedule(); });
  for (const id of ['character-dialog', 'adoption-dialog', 'move-dialog']) get<HTMLDialogElement>(id).addEventListener('cancel', event => { if (request) event.preventDefault(); });
}
let scenePreparationRequest=0, nextVisit:{planId:string;planRevision:number;visitId:string;title:string}|null=null;
let openTreasure:((id:string)=>Promise<void>)|null=null;export function setTreasureNavigation(open:(id:string)=>Promise<void>){openTreasure=open;}
let openGroup:((id:string)=>Promise<void>)|null=null;
export function setGroupNavigation(fn:(id:string)=>Promise<void>){openGroup=fn;}
export async function refreshScenePreparation(){if(!context||!data?.scene||!resumed)return;const token=context.token,id=data.scene.id,request=++scenePreparationRequest;const current=()=>context?.token===token&&data?.scene?.id===id&&request===scenePreparationRequest;try{const result=unwrap(await window.campaign.scenePreparation(token,id));if(!current())return;preparedNotesSceneId=id;preparedNoteIds=new Set(result.noteIds);renderLiveKnowledge();await renderSceneShops(token,id,get('scene-shops'));if(!current())return;nextVisit=result.nextVisit;get('live-next-visit').hidden=!nextVisit;get('live-next-visit').textContent=nextVisit?'Nächsten Besuch ansehen: '+(nextVisit.title||'Unbenannter Besuch'):'';const root=get('scene-prepared-groups');root.replaceChildren();for(const group of result.groups){const card=document.createElement('article');card.className='session-group-card';const title=document.createElement('h4'),facts=document.createElement('p'),button=document.createElement('button');title.textContent=group.title;facts.textContent=group.actors.map(a=>a.name+' '+a.hp+'/'+a.maxHp+' HP').join(', ');button.textContent='Begegnung mit diesen Figuren vorbereiten';const selected=new Set(group.actors.filter(a=>a.hp>0&&!a.unavailable&&!a.defeated).map(a=>a.id)),choice=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Figuren für diese Begegnung';choice.append(legend);for(const actor of group.actors){const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.checked=selected.has(actor.id);box.disabled=actor.hp<=0||actor.unavailable||!!actor.defeated;box.onchange=()=>{if(box.checked)selected.add(actor.id);else selected.delete(actor.id);button.disabled=!selected.size;};label.className='check-label';label.append(box,document.createTextNode(actor.name+' · '+actor.hp+'/'+actor.maxHp+' HP'+(actor.defeated?' · besiegt':'')));choice.append(label);}button.disabled=!selected.size;button.onclick=()=>{void(async()=>{if(await flushLive())await prepareWorldGroup(group,[...selected]);})().catch(error=>tell(error.message,true));};const edit=document.createElement('button');edit.type='button';edit.textContent='Gruppe und Figuren bearbeiten';edit.onclick=()=>void openGroup?.(group.id);card.append(title,facts,choice,button,edit);root.append(card);}const treasures=get('scene-prepared-treasures');treasures.replaceChildren();for(const treasure of result.treasures){const p=document.createElement('p');p.textContent='Platzierte Beute: '+treasure.title+' · ';const open=document.createElement('button');open.type='button';open.textContent='Schatz öffnen und zuweisen';open.onclick=()=>void openTreasure?.(treasure.id);p.append(open);treasures.append(p);}}catch(error){if(context?.token===token&&data?.scene?.id===id&&request===scenePreparationRequest)tell((error as Error).message,true);}}
function initGroups() {
  get('scene-focus').onchange = () => { void (async () => {
    await changeFocus(value('scene-focus'));
  })(); };
  get('group-move').onclick = () => { void (async () => {
    const token = context?.token;
    if (!(await flushLive()) || context?.token !== token || !data?.scene || data.focusRevision === null || !resumed) return;
    const source = data.scene;
    moveBasis = { kind: 'move', sceneId: source.id, expectedRosterRevision: data.rosterRevision, expectedFocusRevision: data.focusRevision, expectedSceneMembershipRevision: source.membershipRevision, expectedClockRevision: source.clock.revision };
    moveTargets = structuredClone(data.scenes); get('move-members').replaceChildren();
    get('move-source').textContent = groupLabel({...source,primary:source.id===data.primaryId});
    for (const id of source.members) {
      const c = data.roster.find(c => c.id === id)!;
      const label = document.createElement('label'), box = document.createElement('input'); box.type = 'checkbox'; box.value = id;
      label.append(box, document.createTextNode(' ' + c.profile.name)); get('move-members').append(label);
    }
    const select = get<HTMLSelectElement>('move-target'); select.replaceChildren();
    const fresh = document.createElement('option'); fresh.value = ''; fresh.textContent = 'Neue unabhängige Gruppe'; select.append(fresh);
    for (const g of moveTargets.filter(g => g.id !== source.id)) { const option = document.createElement('option'); option.value = g.id; option.textContent = groupLabel(g); select.append(option); }
    select.value = ''; get('move-new-fields').hidden = false; get<HTMLInputElement>('move-title').value = '';
    get<HTMLDialogElement>('move-dialog').showModal();
    get('move-title').dataset.clockRevision = String(source.clock.revision); get('move-title').dataset.contentRevision = String(source.revision);
  })(); };
  get('move-target').onchange = () => { get('move-new-fields').hidden = !!value('move-target'); };
  get('move-cancel').onclick = () => { moveBasis = null; get<HTMLDialogElement>('move-dialog').close(); };
  get('move-form').onsubmit = event => { event.preventDefault(); void (async () => {
    const basis = moveBasis; if (!basis) return;
    const memberIds = [...get('move-members').querySelectorAll<HTMLInputElement>('input:checked')].map(box => box.value);
    if (!memberIds.length) { tell('Wähle die Figuren aus, die ihre Gruppe wechseln.', true); return; }
    const targetId = value('move-target'), target = moveTargets.find(g => g.id === targetId);
    const action: Extract<LiveAction, { kind: 'move' }> = { ...basis, memberIds, target: targetId && target ?
      { kind: 'existing', sceneId: target.id, expectedMembershipRevision: target.membershipRevision, expectedClockRevision: target.clock.revision } :
      { kind: 'new', title: value('move-title'), expectedContentRevision: Number(get('move-title').dataset.contentRevision) } };
    if (await execute(action)) { moveBasis = null; get<HTMLDialogElement>('move-dialog').close(); renderScene(); }
  })(); };
  for (const id of ['time-amount', 'time-unit']) get(id).addEventListener('input', renderTimePreview);
  get('time-form').onsubmit = event => { event.preventDefault(); void (async () => {
    const token = context?.token, scene = data?.scene, amount = Number(value('time-amount')), unit = value('time-unit') as TimeUnit, reason = value('time-reason');
    if (!scene || !(await flushLive()) || context?.token !== token) return;
    try { advanceInstant(scene.clock.instantMs, amount, unit); } catch (error) { tell((error as Error).message, true); return; }
    if (await execute({ kind: 'advance-clock', sceneId: scene.id, expectedRevision: scene.clock.revision, calendarVersion: 'relative-v1', amount, unit, reason })) renderSceneMeta();
  })(); };
  resetLiveArchives=initLiveArchives(()=>context?.token??null,flushLive,()=>context?.campaign.id??null);
}

// Topbar commands share the existing writer, draft flushing and receipt recovery.
export async function runPartyLive(token:string,action:LiveAction){
 if(context?.token!==token||!await flushLive())throw new Error('Offene Eingaben zuerst speichern oder den Speicherstatus im Spieltisch klären.');
 if(!data)await openLive();
 if(context?.token!==token||!data)throw new Error('Party nicht verfügbar.');
 const ack=await execute(action);if(!ack)throw new Error('Änderung nicht bestätigt. Speicherstatus im Spieltisch prüfen; Eingabe bleibt erhalten.');
 if(ack.character&&characterDraft?.id===ack.character.id){characterDraft=structuredClone(ack.character);renderCharacter();}
 return ack;
}
export async function runPartyProgress(token:string,action:import('./progression').ProgressAction){
 if(context?.token!==token||!await flushLive())throw new Error('Offene Eingaben zuerst speichern oder den Buchungsstatus klären.');
 if(!data)await openLive();
 if(context?.token!==token||!data)throw new Error('Party nicht verfügbar.');
 progressionContext(context,data,selected);
 if(!await executePartyProgress(action))throw new Error('Buchung nicht bestätigt. Statusmeldung und Buchungsbeleg prüfen; Eingabe bleibt erhalten.');
}

async function previewPlannedVisit(planId:string,visitId:string){
    const token=context?.token,sceneId=data?.scene?.id,focusRevision=data?.focusRevision;
    if (!(await flushLive()) || token !== context?.token || !data?.scene || !resumed) return;
    const plan = sources?.plans.find(p => p.id === planId), visit = plan?.scenes.find(v => v.id === visitId); if (!plan || !visit) return;
    const prepared=unwrap(await window.campaign.session(token!,planId)),detail=prepared.visits.find(v=>v.visitId===visitId);if(token!==context?.token||data?.scene?.id!==sceneId||data.focusRevision!==focusRevision)return;
    adoption = { kind: 'apply-visit', planId, expectedPlanRevision: plan.revision, visitId, sceneId: data.scene.id, expectedRevision: data.scene.revision,expectedVisitRevision:detail?.revision??0 };
    get('adoption-content').textContent = (visit.title || 'Unbenannter Besuch') + '\n\n' + visit.notes + '\n\nOrt: ' + (sources?.locations.find(l => l.document.id === visit.locationId)?.document.name ?? (visit.locationId ? 'nicht verfügbar' : 'kein Ort'));
    get('adoption-content').textContent+='\n\nZum Vorlesen:\n'+(detail?.readAloud??'')+'\n\nVorbereitete Gruppen: '+(detail?.groupIds.length??0);
    get<HTMLDialogElement>('adoption-dialog').showModal();

}

function livePacketSource():LivePacketSource|null{
 const w=context,s=data?.scene,p=get<HTMLSelectElement>('live-session-plan').value,focus=data?.focusRevision;
 if(!w||!s||!p||!resumed)return null;
 const current=()=>context?.token===w.token&&data?.scene?.id===s.id&&data.focusRevision===focus&&data.scene.membershipRevision===s.membershipRevision&&data.scene.adoption?.id===s.adoption?.id&&get<HTMLSelectElement>('live-session-plan').value===p;
 return {sceneId:s.id,token:w.token,planId:p,visitId:s.adoption?.planId===p?s.adoption.visitId:null,key:JSON.stringify([w.token,s.id,p,focus,s.membershipRevision,s.revision,s.adoption?.id]),current,flush:flushLive,openVisit:async id=>{if(current())await previewPlannedVisit(p,id);},readAloud:async(text,title)=>{if(!current()||!await flushLive()||!current())return;useKnowledgeReadAloud(text,title);await flushLive();}};
}
function syncLivePacketContext(){syncLiveSessionPacket(livePacketSource());}
async function openLivePacket(){const source=livePacketSource();if(!source){tell('Wähle einen Spielabendplan für die laufende Gruppe.',true);return;}await openLiveSessionPacket(source);}

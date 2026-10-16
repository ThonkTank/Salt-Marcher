import {combatMobs,combatMobRow} from './combat-mob-ui';
import {CombatGroupPicker,sceneGroupDragType,sceneGroupTray} from './combat-group-ui';
import {CombatInitiativePanel} from './combat-initiative-ui';
import {CombatHitPanel} from './combat-hit-ui';
import {CombatAreaPanel} from './combat-area-ui';
import {renderCombatActions} from './combat-actions-ui';
import {CombatResolutionPanel} from './combat-resolution-ui';
import {openTreasureDistribution,closeStaleTreasureDistribution} from './treasury-ui';
import {openMaskHistory,closeMaskHistory} from './mask-history-ui';
import {finishDraftCommit,flushFinishDraft} from './finish-draft-ui';
import {CombatDraftCache,combatDraftKey} from './combat-draft-cache';
import {fighterDraftBasisMatches,fighterDraftFields,type FighterWorkingDraft,type NotesWorkingDraft,type CombatWorkingDraft} from './combat-draft-contracts';
import {writeConfirmed,hasPendingCommit,onCommitState,onCommitResolved,type CommitResolution} from './commit-confirmation';
import type { WorkspaceGeometry, Result } from './contracts';
import type { LiveScene } from './live-contracts';
import { combatConditions,combatOrder, type CombatAction, type CombatView, type CombatCommand, type Combatant } from './combat-contracts';
import { prepareFinish, finishRewards, refreshProgress, onProgressChanged } from './progression-ui';
import { renderCreatureDetail } from './creature-detail-ui';
import type { EncounterPlan } from './encounter-contracts';
import type {PreparedGroup} from './session-contracts';
import {rollSceneCheck,rollSceneFormula} from './rule-reference-ui';
import type {SceneCheck} from './scene-check-contracts';
import {deathSaveControls,type DeathSaveResult} from './progression';
import {isLegendaryAction,creatureActionForRolls,creatureActionRolls,creatureRollKey,legendaryActionCost,type CreatureRollPreset} from './dice-formula';
import type {Creature,CreatureAction} from '../features/catalog/creature-catalog';
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const value = (id: string) => get<HTMLInputElement>(id).value;
const unwrap = <T>(r: Result<T>): T => { if (!r.ok) throw new Error(r.error); return r.value; };
const editableCombat=(combat:CombatView['combat'])=>!!combat&&['preparing','running'].includes(combat.phase);
const deathResultText=(result:DeathSaveResult)=>({success:'Erfolg',failure:'Fehlschlag','natural-20':'Natürliche 20 · 1 HP','natural-1':'Natürliche 1 · zwei Fehlschläge',stabilize:'Stabilisiert',reset:'Zurückgesetzt',dead:'Als tot markiert'}[result]);
const conditionParts=(text:string)=>text.split(/\s*[,;\n]\s*/).map(part=>part.trim()).filter(Boolean);
export function hasCombatCondition(text:string,label:string,source:string){const aliases=new Set([label.toLocaleLowerCase('de'),source.toLocaleLowerCase('en')]);return conditionParts(text).some(part=>aliases.has(part.toLocaleLowerCase()));}
export function setCombatCondition(text:string,label:string,source:string,active:boolean){const aliases=new Set([label.toLocaleLowerCase('de'),source.toLocaleLowerCase('en')]),parts=conditionParts(text).filter(part=>!aliases.has(part.toLocaleLowerCase()));if(active)parts.push(label);return parts.join(', ');}
const groupPicker=new CombatGroupPicker();
let workspace: WorkspaceGeometry | null = null, scene: LiveScene | null = null, view: CombatView | null = null;
const expandedMobs=new Set<string>();
let resolution:CombatResolutionPanel|null=null;
let hitPanel:CombatHitPanel|null=null;
let areaPanel:CombatAreaPanel|null=null;
let initiativePanel:CombatInitiativePanel|null=null;
let reinforcementRequest=0,reinforcementBusy=false;
let reinforcementResults:{id:string;name:string;challengeRating:string}[]=[];
let selected: string | null = null, pending: Promise<boolean> | null = null, generation = 0;
type PendingLegendary={participantId:string;actionId:string;cost:number};
type PendingDamage={check:SceneCheck;combatId:string;attackerId:string;targetId?:string;appliedTargets?:string[]};
export function enqueuePendingDamage(queue:readonly PendingDamage[],next:PendingDamage,currentCombatId:string){return next.combatId!==currentCombatId||queue.some(damage=>damage.check.id===next.check.id)?[...queue]:[...queue,next];}
let pendingDamage:PendingDamage[]=[];
type PendingAttack={combatId:string;attackerId:string;creatureId:string;actionId:string;actor:string;preset:CreatureRollPreset;damages:CreatureRollPreset[];rolledDamage:string[];targetId:string|null;check:SceneCheck|null;legendary?:PendingLegendary;paidLegendary?:boolean};
export function retainPendingAttack<T>(current:T|null,next:T){return current??next;}
let pendingAttack:PendingAttack|null=null,attackPending=false;
type PendingSave={combatId:string;attackerId:string;creatureId:string;actionId:string;actor:string;preset:CreatureRollPreset;damages:CreatureRollPreset[];rolledDamage:string[];resolvedTargets:string[];targetId:string|null;check:SceneCheck|null;legendary?:PendingLegendary};
let pendingSave:PendingSave|null=null,savePending=false;
export function pendingRollStillValid(pending:{combatId:string;attackerId:string}|null,combat:CombatView['combat']){return !!pending&&!!combat&&editableCombat(combat)&&pending.combatId===combat.id&&combat.participants.some(participant=>participant.id===pending.attackerId);}
let tell: (text: string, error?: boolean) => void, afterSaved:(()=>Promise<void>)|undefined;
let loadPending=false,loadError:string|null=null,requestedCombatId:string|null=null,knownRecent:CombatView['recent']=[];
function acceptCombat(result:CombatView){if(view?.combat?.id!==result.combat?.id){expandedMobs.clear();groupPicker.reset();reinforcementRequest++;reinforcementBusy=false;reinforcementResults=[];get<HTMLInputElement>('combat-creature-count').value='1';get<HTMLInputElement>('combat-creature-grouped').checked=false;get<HTMLInputElement>('combat-creature-search').value='';get<HTMLInputElement>('combat-creature-initiative').value='';get('combat-creature-status').textContent='';}view=result;requestedCombatId=result.combat?.id??null;knownRecent=result.recent;if(pendingDamage.some(damage=>damage.combatId!==result.combat?.id))pendingDamage=[];if(pendingAttack&&!pendingRollStillValid(pendingAttack,result.combat))pendingAttack=null;if(pendingSave&&!pendingRollStillValid(pendingSave,result.combat))pendingSave=null;}
let loadNumber=0,candidateRequest=0,candidatePending=false,candidateLoading=false,partyContext='';
const fighterFields=fighterDraftFields;
type FighterDraft=FighterWorkingDraft;
const draftCache=new CombatDraftCache((cam,message)=>{if(workspace?.campaign.id===cam)tell(message,true);});
const fighterDrafts={get:(key:string)=>draftCache.values.get(key) as FighterDraft|undefined};
const fighterKey=()=>workspace&&view?.combat&&selected?combatDraftKey(workspace.campaign.id,view.combat.id,'fighter',selected):null;
const notesKey=()=>workspace&&view?.combat?combatDraftKey(workspace.campaign.id,view.combat.id,'notes',view.combat.id):null;
const notesDraft=()=>{const key=notesKey();return key?draftCache.values.get(key) as NotesWorkingDraft|undefined:undefined;};
let editorLoading=false,notesLoading=false,editorRequest=0,draftPageRequest=0,draftCursor:string|null=null;
function keepFighterDraft(){
 const p=view?.combat?.participants.find(p=>p.id===selected),key=fighterKey();if(!p||!key||!view?.combat||!workspace||editorLoading||draftCache.readFailures.has(key))return;
 const old=fighterDrafts.get(key),d:FighterDraft={version:1,kind:'fighter',writeId:crypto.randomUUID(),combatId:view.combat.id,sceneId:view.combat.sceneId,targetId:p.id,basis:structuredClone(old?.basis??p),revision:old?.revision??view.combat.revision,values:Object.fromEntries([...fighterFields,'fighter-group-name'].map(id=>[id,value(id)])) as FighterDraft['values'],concentrating:get<HTMLInputElement>('fighter-concentration').checked,counted:get<HTMLInputElement>('fighter-counted').checked};
 void draftCache.put(workspace.token,workspace.campaign.id,d);get('fighter-draft-status').textContent='Eingabe offen – mit „Werte übernehmen“ bestätigen.';lockConditionShortcuts();
}
function keepNotesDraft(){
 if(!workspace||!view?.combat||notesLoading)return;const key=notesKey()!;if(draftCache.readFailures.has(key))return;
 const old=notesDraft(),d:NotesWorkingDraft={version:1,kind:'notes',writeId:crypto.randomUUID(),combatId:view.combat.id,sceneId:view.combat.sceneId,targetId:view.combat.id,revision:old?.revision??view.combat.revision,basis:old?.basis??{title:view.combat.title,notes:view.combat.notes},values:{title:value('combat-edit-title'),notes:value('combat-notes')}};
 void draftCache.put(workspace.token,workspace.campaign.id,d);get('combat-notes-draft-status').textContent='Notizeingabe offen – noch nicht übernommen.';
}
async function chooseFighter(id:string){
 if(!workspace||!view?.combat)return;selected=id;const token=workspace.token,cam=workspace.campaign.id,combatId=view.combat.id,g=generation,r=++editorRequest;editorLoading=true;renderEditor();renderSelection();lock();
 try{await draftCache.load(token,cam,combatId,'fighter',id);}catch(error){if(g===generation&&r===editorRequest)tell((error as Error).message,true);}
 finally{if(g===generation&&r===editorRequest&&selected===id&&view?.combat?.id===combatId){editorLoading=false;renderEditor();lock();if(typeof window.matchMedia==='function'&&window.matchMedia('(max-width:1099px)').matches)get('combat-participant').scrollIntoView({block:'start'});}}
}
async function loadNotes(){
 if(!workspace||!view?.combat)return;const token=workspace.token,cam=workspace.campaign.id,id=view.combat.id,g=generation;notesLoading=true;lock();
 try{await draftCache.load(token,cam,id,'notes',id);}catch(error){if(g===generation)tell((error as Error).message,true);}
 finally{if(g===generation&&view?.combat?.id===id){notesLoading=false;renderNotes();lock();}}
}
function renderNotes(){
 const c=view?.combat,d=notesDraft();
 get<HTMLInputElement>('combat-edit-title').value=d?.values.title??c?.title??'';get<HTMLTextAreaElement>('combat-notes').value=d?.values.notes??c?.notes??'';
 get('combat-notes-draft-status').textContent=d?(JSON.stringify(d.basis)===JSON.stringify({title:c?.title,notes:c?.notes})?'Notizeingabe offen – noch nicht übernommen.':'Gespeicherte Notizen wurden geändert. Eingabe bleibt offen; zuerst abgleichen.') : '';
}
async function listDrafts(more=false){
 if(!workspace||!view?.combat)return;const token=workspace.token,id=view.combat.id,g=generation,r=++draftPageRequest;
 try{const page=unwrap(await window.campaign.combatDrafts(token,id,more?draftCursor:null));if(g!==generation||r!==draftPageRequest||view?.combat?.id!==id)return;
  const root=get('combat-draft-list');if(!more)root.replaceChildren();for(const entry of page.items){const row=document.createElement('p'),show=document.createElement('button'),discard=document.createElement('button');show.type=discard.type='button';show.textContent='Entwurf: '+(entry.label||'Ohne Titel');discard.textContent='Verwerfen';
   show.onclick=()=>{void(async()=>{const d=unwrap(await window.campaign.combatDraft(token,id,entry.kind,entry.targetId));if(g!==generation||view?.combat?.id!==id)return;if(!d||d.writeId!==entry.writeId)throw new Error('Entwurf inzwischen geändert. Liste aktualisieren.');get<HTMLTextAreaElement>('combat-draft-preview').value=d.kind==='initiative'?d.values.map(v=>(view?.combat?.participants.find(p=>p.id===v.participantId)?.name??v.participantId)+': '+v.raw).join('\n'):d.kind==='notes'?d.values.title+'\n\n'+d.values.notes:Object.entries(d.values).map(([key,text])=>({'fighter-name':'Name','fighter-group-name':'Truppname','fighter-initiative':'Initiative','fighter-bonus':'Initiativebonus','fighter-ac':'Rüstungsklasse','fighter-hp':'Aktuelle HP','fighter-max-hp':'Maximale HP','fighter-temp-hp':'Temporäre HP','fighter-conditions':'Zustände','fighter-xp':'Kreatur-XP'} as Record<string,string>)[key]+': '+text).join('\n')+'\nKonzentration: '+(d.concentrating?'ja':'nein')+'\nFür Schwierigkeit zählen: '+(d.counted?'ja':'nein');get('combat-draft-preview').hidden=false;})().catch(error=>tell(error.message,true));};
   discard.onclick=()=>{void(async()=>{if(!workspace||workspace.token!==token||!await draftCache.flush(workspace.campaign.id))return;unwrap(await window.campaign.discardCombatDraft(token,id,entry.kind,entry.targetId,entry.writeId));const key=combatDraftKey(workspace.campaign.id,id,entry.kind,entry.targetId),d=draftCache.values.get(key);if(d?.writeId===entry.writeId)draftCache.consumed(workspace.campaign.id,d);if(g===generation){renderEditor();renderNotes();await listDrafts();}})().catch(error=>tell(error.message,true));};row.append(show,discard);root.append(row);}
  for(const problem of page.problems){const p=document.createElement('p');p.textContent='Entwurf nicht lesbar: '+problem.message;root.append(p);}draftCursor=page.next;get('combat-draft-more').hidden=!draftCursor;
 }catch(error){if(g===generation)tell((error as Error).message,true);}
}
function renderPartyCandidates(){const select=get<HTMLSelectElement>('combat-party-select'),previous=select.value,items=view?.partyCandidates??[];select.replaceChildren();for(const p of items){const option=document.createElement('option');option.value=p.characterId;option.textContent=p.name+' · '+(p.health?p.health.hp+'/'+p.health.maxHp+' HP':'HP offen');select.append(option);}select.value=items.some(p=>p.characterId===previous)?previous:items[0]?.characterId??'';if(select.value!==previous)get<HTMLInputElement>('combat-party-initiative').value='';get('combat-party-form').hidden=!editableCombat(view?.combat??null)||!items.length;}
async function refreshPartyCandidates(){
 if(pending){candidatePending=true;return;}const combat=view?.combat;if(!workspace||!scene||!editableCombat(combat??null)||!combat)return;
 const gen=generation,request=++candidateRequest,id=combat.id,token=workspace.token;candidateLoading=true;lock();
 try{const result=unwrap(await window.campaign.combat(token,scene.id,id));if(gen!==generation||request!==candidateRequest||view?.combat?.id!==id||pending)return;if(result.combat?.revision!==combat.revision){await load(id);return;}view.partyCandidates=result.partyCandidates;renderPartyCandidates();lock();}
 catch(error){if(gen===generation&&request===candidateRequest)tell('Party-Auswahl konnte nicht aktualisiert werden: '+(error as Error).message,true);}
 finally{if(gen===generation&&request===candidateRequest){candidateLoading=false;lock();}}
}
export function combatContext(next: WorkspaceGeometry | null, current: LiveScene | null, rosterRevision?:number) {
  const changed = next?.token !== workspace?.token || current?.id !== scene?.id;
  const basis=JSON.stringify([next?.token,current?.id,current?.membershipRevision,rosterRevision]),partyChanged=basis!==partyContext;partyContext=basis;
  if(changed&&workspace)draftCache.release(workspace.campaign.id);
  workspace = next; scene = current;
  get('combat-panel').hidden = !current;
  if (changed) { expandedMobs.clear();groupPicker.reset();const tray=get<HTMLDetailsElement>('combat-scene-groups');if(tray){tray.open=false;get('combat-scene-group-cards').replaceChildren();}closeMaskHistory();if (get<HTMLDialogElement>('combat-finish-dialog').open) get<HTMLDialogElement>('combat-finish-dialog').close(); generation++;loadNumber++;loadPending=false;loadError=null;requestedCombatId=null;knownRecent=[];candidateRequest++;candidatePending=false;candidateLoading=false;editorLoading=false;notesLoading=false;editorRequest++;draftPageRequest++;draftCursor=null;get('combat-draft-list').replaceChildren();get('combat-draft-preview').hidden=true; selected = null;pendingDamage=[];pendingAttack=null;attackPending=false;pendingSave=null;savePending=false; view = null; render(); if (next && current) void load(); }
  else if(partyChanged){if(view?.combat)void load(view.combat.id);else void refreshPartyCandidates();}
  resolution?.context(workspace,scene,view?.combat??null);
}
async function load(id?: string):Promise<boolean> {
  if (!workspace || !scene) return false;
  candidateRequest++;candidateLoading=false;
  const gen=generation,request=++loadNumber,basis=partyContext,token=workspace.token,sceneId=scene.id,target=id??view?.combat?.id??requestedCombatId;
  requestedCombatId=target??null;loadPending=true;loadError=null;lock();
  const current=()=>generation===gen&&request===loadNumber&&workspace?.token===token&&scene?.id===sceneId;
  try {
    const result=unwrap(await window.campaign.combat(token,sceneId,target??undefined));if(!current())return false;
    if(result.combat&&(result.combat.sceneId!==sceneId||target&&result.combat.id!==target)||target&&!result.combat)throw new Error('Begegnungsantwort passt nicht zur gewählten Begegnung.');
    acceptCombat(result);render();await loadNotes();if(!current())return false;
    void listDrafts();if(basis!==partyContext)void refreshPartyCandidates();return true;
  }catch(error){if(current()){loadError=(error as Error).message;view=null;selected=null;render();tell(loadError,true);}}
  finally{if(current()){loadPending=false;lock();}}
  return false;
}

async function execute(action: CombatAction, expectedRevision?:number,stillCurrent:()=>boolean=()=>true): Promise<boolean> {
  if (!workspace || !scene || blocked()||!stillCurrent()) return false;
  loadNumber++;candidateRequest++;candidateLoading=false;const editKey=action.kind==='edit'?fighterKey():null,editDraft=editKey?fighterDrafts.get(editKey):undefined,editorDraft:CombatWorkingDraft|undefined=action.kind==='initiative'&&workspace&&view?.combat?draftCache.values.get(combatDraftKey(workspace.campaign.id,view.combat.id,'initiative',view.combat.id)):action.kind==='notes'?notesDraft():editDraft;
  const priorDamageDeath=action.kind==='damage'||action.kind==='hit'?structuredClone(view?.combat?.participants.find(p=>p.id===action.participantId)?.death):undefined;
  const priorEffects=action.kind==='next'||action.kind==='start'?view?.combat?.participants.flatMap(actor=>(actor.timedEffects??[]).map(effect=>({actorId:actor.id,actor:actor.name,...effect})))??[]:[];
  const gen = generation;
  const command: CombatCommand = { commandId: crypto.randomUUID(), campaignId: workspace.campaign.id, token: workspace.token,
    combatId: action.kind === 'create' ? null : view?.combat?.id ?? null,
    expectedRevision: action.kind === 'create' ? null : expectedRevision??view?.combat?.revision ?? null, action,...(editorDraft?{draftWriteId:editorDraft.writeId}:{}) };
  let applied = false,revealConcentration=false;
  pending = (async () => {
    try {
      if(!await draftCache.flush(command.campaignId)||generation!==gen)throw new Error('Offene Eingaben zuerst dauerhaft sichern.');
      if(!stillCurrent())return false;
      const result = await writeConfirmed<CombatView>('combat',command,()=>window.campaign.executeCombat(command),()=>generation===gen&&workspace?.token===command.token,{token:command.token,editKey,editDraft,editorDraft});
      if (generation !== gen) return false;
      acceptCombat(result);applied = true;if(action.kind==='add-party')get<HTMLInputElement>('combat-party-initiative').value='';if(editorDraft)draftCache.consumed(command.campaignId,editorDraft);void listDrafts();
      if(['create','edit','damage','hit','area-damage','heal','revive','death','death-roll','concentration','concentration-roll','undo','finish','remove','add-party','add-prepared-group'].includes(action.kind)){await refreshProgress();if(afterSaved)await afterSaved();}
      const actor='participantId'in action?result.combat?.participants.find(p=>p.id===action.participantId):undefined,death=action.kind==='death'||action.kind==='death-roll'?actor?.deathLast:(action.kind==='damage'||action.kind==='hit')&&JSON.stringify(priorDamageDeath)!==JSON.stringify(actor?.death)?actor?.deathLast:undefined;
      const concentration=action.kind==='concentration'||action.kind==='concentration-roll'?actor?.concentrationLast:undefined;
      const concentrationActor=action.kind==='area-damage'?result.combat?.participants.find(p=>p.concentrationChecks?.length):actor;
      const openConcentration=action.kind==='damage'||action.kind==='hit'||action.kind==='area-damage'?concentrationActor?.concentrationChecks?.[0]:undefined;
      const legendary=action.kind==='legendary-action'?actor?.legendaryActions:undefined;
      const effectTicks=priorEffects.flatMap(before=>{const after=result.combat?.participants.find(participant=>participant.id===before.actorId)?.timedEffects?.find(effect=>effect.id===before.id);return !after?[before.name+' bei '+before.actor+' endet']:after.remaining!==before.remaining?[before.name+' bei '+before.actor+': '+after.remaining+' Runde'+(after.remaining===1?'':'n')+' verbleibend']:[];});
      revealConcentration=!!openConcentration;
      tell(action.kind==='hit'?('Treffer gespeichert · '+(action.critical?'kritisch · ':'')+actor!.name+' '+actor!.hp+'/'+actor!.maxHp+' HP'+(actor!.death?.dead?' · tot':actor!.death?' · Todesrettung '+actor!.death.successes+' Erfolge / '+actor!.death.failures+' Fehlschläge':'')+(openConcentration?' · Konzentration SG '+openConcentration.dc+' offen.':'.')):death?(action.kind==='damage'?'Schadensfolge: ':death.roll===null?'':('Todesrettungswurf '+death.roll+': '))+deathResultText(death.result)+'.':concentration?('Konzentration: '+(concentration.roll===null?'manuell':concentration.roll+(concentration.modifier>=0?' + ':' − ')+Math.abs(concentration.modifier)+' = '+concentration.total)+' gegen SG '+concentration.dc+' · '+(concentration.success?'bestanden.':'verloren.')):openConcentration?('Schaden gespeichert. Konzentrationswurf für '+concentrationActor!.name+' gegen SG '+openConcentration.dc+' offen.'):legendary?('Legendäre Aktion eingesetzt · '+legendary.remaining+' von '+legendary.maximum+' Punkten verbleiben.'):effectTicks.length?'Rundeneffekte: '+effectTicks.join(' · ')+'.':'Kampf gespeichert.'); return true;
    } catch (error) { if (generation === gen) tell((error as Error).message + ' Aktualisiere den Kampfstand, bevor du weiterarbeitest.', true); return false; }
    finally { pending = null; if (generation === gen) { if (applied){render();if(revealConcentration)get('combat-concentration-effect').scrollIntoView({block:'nearest'});}else lock();if(candidatePending){candidatePending=false;void refreshPartyCandidates();} } }
  })();
  lock(); return pending;
}
function preparationOwner(){
  if(!workspace||!scene)return null;
  const token=workspace.token,id=scene.id,revision=scene.membershipRevision,gen=generation;
  return {sceneId:id,revision,current:()=>workspace?.token===token&&scene?.id===id&&scene.membershipRevision===revision&&generation===gen};
}
export async function prepareWorldGroup(group:PreparedGroup,worldActorIds?:string[],stillCurrent:()=>boolean=()=>true){
  const {id,title,revision}=group;
  const owner=preparationOwner();if(!owner||!stillCurrent()||!await load()||!owner.current()||!stillCurrent())return;
  if(await execute({kind:'create',sceneId:owner.sceneId,title,includeParty:true,expectedMembershipRevision:owner.revision,preparedGroupId:id,expectedPreparedRevision:revision,worldActorIds},undefined,stillCurrent)&&owner.current()&&stillCurrent())get('combat-panel').scrollIntoView({block:'start'});
}
export async function reinforceWorldGroup(groupId?:string,expectedGroupRevision?:number,stillCurrent:()=>boolean=()=>true){
 const owner=preparationOwner();if(!owner||!stillCurrent()||!await flushCombat()||!await load()||!owner.current()||!stillCurrent()||!workspace||!scene||!view)return;
 const token=workspace.token,combatId=view.combat?.id,current=()=>owner.current()&&stillCurrent()&&workspace?.token===token&&view?.combat?.id===combatId;
 const choice=await groupPicker.open(token,scene,view,current,groupId,expectedGroupRevision);if(!choice||!current())return;
 if(!await load(choice.combat.id)||!owner.current()||!stillCurrent())return;
 if(await execute(choice.action,choice.combat.revision,()=>owner.current()&&stillCurrent())&&owner.current()){
  get<HTMLDetailsElement>('combat-panel').open=true;get('combat-panel').scrollIntoView({block:'start'});tell('Monstergruppe übernommen. Bestehende Figuren, Initiative und laufender Zug bleiben erhalten.');
 }
}
export async function prepareCombatPlan(plan: EncounterPlan) {
  const {id,name,revision}=plan;
  const owner=preparationOwner();if(!owner||!await load()||!owner.current())return;
  if(await execute({kind:'create',sceneId:owner.sceneId,title:name,includeParty:true,expectedMembershipRevision:owner.revision,planId:id,expectedPlanRevision:revision})&&owner.current())get('combat-panel').scrollIntoView({block:'start'});
}
export async function prepareGeneratedCombat(action:Extract<CombatAction,{kind:'create'}>):Promise<boolean>{
 const owner=preparationOwner();if(!owner||owner.sceneId!==action.sceneId||owner.revision!==action.expectedMembershipRevision||!await load()||!owner.current())return false;
 const ok=await execute(action);if(ok&&owner.current()){get<HTMLDetailsElement>('combat-panel').open=true;get('combat-panel').scrollIntoView({block:'start'});}return ok;
}
export async function addWorldNpc(actorId:string,stillCurrent:()=>boolean=()=>true){
 const owner=preparationOwner(),w=workspace;if(!owner||!w||!stillCurrent()||!await load()||!owner.current()||!stillCurrent())return;
 const current=()=>owner.current()&&stillCurrent();
 const r=await window.campaign.npc(w.token,actorId);if(!current())return;if(!r.ok)throw new Error(r.error);const npc=r.value;if(npc.actorRevision===null||npc.record.lifecycle==='defeated'||!npc.health?.hp)throw new Error('NPC benötigt einen Kreaturverweis, aktive Freigabe und positive HP.');
 if(!editableCombat(view?.combat??null)){if(!await execute({kind:'create',sceneId:owner.sceneId,title:'Begegnung mit '+npc.name,includeParty:true,expectedMembershipRevision:owner.revision},undefined,current)||!current())return;}
 if(await execute({kind:'add-world-actor',actorId,expectedActorRevision:npc.actorRevision,expectedRecordRevision:npc.record.revision},undefined,current)&&current())get('combat-panel').scrollIntoView({block:'start'});
}
export async function addCatalogCreature(creatureId:string,count:number,grouped:boolean) {
  const owner=preparationOwner();if(!owner||!await load()||!owner.current())return;
  if (!editableCombat(view?.combat??null)) {
    if(!await execute({kind:'create',sceneId:owner.sceneId,title:'Neue Begegnung',includeParty:true,expectedMembershipRevision:owner.revision})||!owner.current())return;
  }
  if(await execute({kind:'add-creature',creatureId,count,grouped})&&owner.current())get('combat-panel').scrollIntoView({block:'start'});
}
export async function flushCombat(): Promise<boolean> { if(!await flushFinishDraft())return false; if(pending)return await pending;if(!workspace)return true;return await draftCache.flush(workspace.campaign.id)&&!hasPendingCommit(workspace.campaign.id); }
const blocked=()=>loadPending||!!loadError||!!pending||!!workspace&&hasPendingCommit(workspace.campaign.id);
function stageAttack(action:CreatureAction,preset:CreatureRollPreset,attackerId:string,actor:string,creatureId:string,combatId:string,legendary?:PendingLegendary){
  if(attackPending||view?.combat?.id!==combatId)return;const next:PendingAttack={combatId,attackerId,creatureId,actionId:action.id,actor,preset,damages:creatureActionRolls(action).filter(p=>p.kind==='damage'),rolledDamage:[],targetId:null,check:null,...(legendary?{legendary}:{})},retained=retainPendingAttack(pendingAttack,next);if(retained===pendingAttack){renderAttackEffect();get('combat-attack-effect').scrollIntoView({block:'nearest'});tell(pendingAttack.check?'Offenen Angriff zuerst abschließen.':'Offenen Angriff zuerst würfeln oder verwerfen.',true);return;}pendingAttack=retained;renderAttackEffect();get('combat-attack-effect').scrollIntoView({block:'nearest'});
}
function renderAttackEffect(){
  const box=get('combat-attack-effect'),combat=view?.combat,attack=pendingAttack;if(!attack||!combat||attack.combatId!==combat.id||!editableCombat(combat)){box.hidden=true;return;}box.hidden=false;
  const target=get<HTMLSelectElement>('combat-attack-target'),previous=target.value,candidates=combat.participants.filter(p=>p.id!==attack.attackerId);target.replaceChildren();for(const p of candidates){const option=document.createElement('option');option.value=p.id;option.textContent=p.name+' · RK '+p.armorClass;target.append(option);}
  const preferred=attack.targetId??(candidates.some(p=>p.id===previous)?previous:null)??candidates.find(p=>!!p.characterId)?.id??candidates[0]?.id??'';target.value=preferred;
  const chosen=candidates.find(p=>p.id===target.value),resolvedTarget=attack.targetId?candidates.find(p=>p.id===attack.targetId):undefined,die=attack.check?.rolls[0],critical=die===20,miss=attack.check?.outcome==='failure';
  get('combat-attack-result').textContent=attack.check?(attack.actor+' · '+attack.preset.label+': '+attack.check.total+' gegen RK '+attack.check.dc+' · '+(critical?'Kritischer Treffer':miss?'Verfehlt':'Treffer')+(resolvedTarget?'':' · Ziel nicht mehr in der Initiative')):(attack.actor+' · '+attack.preset.label+' gegen '+(chosen?.name??'Ziel')+' (RK '+(chosen?.armorClass??'—')+')');
  target.disabled=blocked()||attackPending||!!attack.check;const roll=get<HTMLButtonElement>('combat-attack-roll');roll.hidden=!!attack.check;roll.disabled=blocked()||attackPending||!chosen;
  const damageRoot=get('combat-attack-damage');damageRoot.replaceChildren();if(attack.check?.outcome==='success'&&resolvedTarget){const button=document.createElement('button');button.type='button';button.textContent='Treffer mit allen Schadensanteilen…';button.disabled=blocked()||attackPending;button.onclick=()=>{const source=combat.sources?.find(c=>c.id===attack.creatureId),original=source&&[...source.actions,...source.legendaryActions].find(a=>a.id===attack.actionId);if(source&&original)hitPanel?.open({attackerId:attack.attackerId,action:creatureActionForRolls(source,original),targetId:attack.targetId!,check:attack.check!,paidLegendary:attack.paidLegendary,applied:()=>{if(pendingAttack===attack){pendingAttack=null;renderAttackEffect();}}});};damageRoot.append(button);}
  const discard=get<HTMLButtonElement>('combat-attack-discard');discard.textContent=attack.check?'Angriff abschließen':'Verwerfen';discard.disabled=blocked()||attackPending;
}
async function rollAttack(){
  const attack=pendingAttack,combat=view?.combat,target=combat?.participants.find(p=>p.id===value('combat-attack-target'));if(!attack||!combat||!target||attack.combatId!==combat.id||attack.check)return;attack.targetId=target.id;attackPending=true;renderAttackEffect();
  if(attack.legendary){if(!await execute({kind:'legendary-action',...attack.legendary})){attackPending=false;renderAttackEffect();return;}attack.paidLegendary=true;delete attack.legendary;}
  await rollSceneFormula({label:attack.preset.label+' gegen '+target.name,actor:attack.actor,formula:attack.preset.formula,formulaKind:'attack',dc:target.armorClass,sourceCreatureId:attack.creatureId,sourceActionId:attack.actionId},check=>{if(pendingAttack===attack&&view?.combat?.id===attack.combatId)attack.check=check;});attackPending=false;renderAttackEffect();
}
function stageSave(action:CreatureAction,preset:CreatureRollPreset,attackerId:string,actor:string,creatureId:string,combatId:string,legendary?:PendingLegendary){
  if(savePending||view?.combat?.id!==combatId)return;const next:PendingSave={combatId,attackerId,creatureId,actionId:action.id,actor,preset,damages:creatureActionRolls(action).filter(p=>p.kind==='damage'),rolledDamage:[],resolvedTargets:[],targetId:null,check:null,...(legendary?{legendary}:{})},retained=retainPendingAttack(pendingSave,next);if(retained===pendingSave){renderSaveEffect();get('combat-save-effect').scrollIntoView({block:'nearest'});tell('Offenen Rettungswurf zuerst abschließen oder verwerfen.',true);return;}pendingSave=retained;get<HTMLInputElement>('combat-save-modifier').value='0';renderSaveEffect();get('combat-save-effect').scrollIntoView({block:'nearest'});
}
function renderSaveEffect(){
  const box=get('combat-save-effect'),combat=view?.combat,save=pendingSave;if(!save||!combat||save.combatId!==combat.id||!editableCombat(combat)){box.hidden=true;return;}box.hidden=false;
  const target=get<HTMLSelectElement>('combat-save-target'),previous=target.value,candidates=combat.participants.filter(p=>p.id!==save.attackerId&&!save.resolvedTargets.includes(p.id));target.replaceChildren();for(const p of candidates){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;target.append(option);}const preferred=save.targetId??(candidates.some(p=>p.id===previous)?previous:null)??candidates.find(p=>!!p.characterId)?.id??candidates[0]?.id??'';target.value=preferred;
  const chosen=combat.participants.find(p=>p.id===(save.targetId??target.value)),modifier=get<HTMLInputElement>('combat-save-modifier'),outcome=save.check?.outcome;get('combat-save-result').textContent=save.check?(save.actor+' · '+save.preset.label+' für '+(chosen?.name??'entferntes Ziel')+': '+save.check.total+' gegen SG '+save.check.dc+' · '+(outcome==='success'?'Bestanden':'Fehlgeschlagen')):(save.actor+' · '+save.preset.label+' · SG '+save.preset.dc);
  target.disabled=blocked()||savePending||!!save.check;modifier.disabled=blocked()||savePending||!!save.check;const roll=get<HTMLButtonElement>('combat-save-roll'),modifierValue=Number(modifier.value);roll.hidden=!!save.check;roll.disabled=blocked()||savePending||!target.value||!Number.isSafeInteger(modifierValue)||Math.abs(modifierValue)>1000;
  const damages=get('combat-save-damage');damages.replaceChildren();if(save.check&&chosen)for(const damage of save.damages){const button=document.createElement('button'),done=save.rolledDamage.includes(creatureRollKey(damage));button.type='button';button.textContent=damage.label+' ('+damage.formula+') würfeln'+(done?' ✓':'');button.disabled=blocked()||savePending||done;button.onclick=()=>void rollSaveDamage(damage);damages.append(button);}
  const repeat=get<HTMLButtonElement>('combat-save-repeat');repeat.hidden=!save.check;repeat.disabled=blocked()||savePending||!candidates.some(p=>p.id!==save.targetId);get<HTMLButtonElement>('combat-save-discard').disabled=blocked()||savePending;
}
async function rollSave(){
  const save=pendingSave,combat=view?.combat,target=combat?.participants.find(p=>p.id===value('combat-save-target')),modifier=Number(value('combat-save-modifier'));if(!save||!combat||!target||save.combatId!==combat.id||save.check||!Number.isSafeInteger(modifier)||Math.abs(modifier)>1000)return;save.targetId=target.id;savePending=true;renderSaveEffect();
  if(save.legendary){if(!await execute({kind:'legendary-action',...save.legendary})){savePending=false;renderSaveEffect();return;}delete save.legendary;}
  await rollSceneCheck({label:save.actor+' · '+save.preset.label,actor:target.name,mode:'normal',modifier,dc:save.preset.dc,sourceCreatureId:save.creatureId,sourceActionId:save.actionId},check=>{if(pendingSave===save&&view?.combat?.id===save.combatId)save.check=check;});savePending=false;renderSaveEffect();
}
async function rollSaveDamage(damage:CreatureRollPreset){
  const save=pendingSave,key=creatureRollKey(damage);if(!save?.check||!save.targetId||!view?.combat?.participants.some(p=>p.id===save.targetId)||save.rolledDamage.includes(key))return;savePending=true;renderSaveEffect();let rolled=false;await rollSceneFormula({label:damage.label,actor:save.actor,formula:damage.formula,formulaKind:'damage',dc:null,sourceCreatureId:save.creatureId,sourceActionId:save.actionId},result=>{if(pendingSave===save&&view?.combat?.id===save.combatId){rolled=true;stageDamage(result,save.attackerId,save.combatId,save.targetId!);}});savePending=false;if(rolled)save.rolledDamage.push(key);renderSaveEffect();
}
function repeatSave(){const save=pendingSave;if(!save?.check||!save.targetId)return;if(!save.resolvedTargets.includes(save.targetId))save.resolvedTargets.push(save.targetId);save.targetId=null;save.check=null;save.rolledDamage=[];get<HTMLInputElement>('combat-save-modifier').value='0';renderSaveEffect();}
function stageDamage(check:SceneCheck,attackerId:string,combatId:string,targetId?:string){
  const combat=view?.combat;
  if(!combat||!editableCombat(combat)||check.sceneId!==combat.sceneId||check.rollKind!=='formula'||check.formulaKind!=='damage'||!Number.isSafeInteger(check.total)||check.total<=0)return;
  const next=enqueuePendingDamage(pendingDamage,{check,combatId,attackerId,targetId},combat.id);if(next.length===pendingDamage.length)return;pendingDamage=next;renderDamageEffect();get('combat-roll-effect').scrollIntoView({block:'nearest'});
}
function renderDamageEffect(){
  const box=get('combat-roll-effect'),combat=view?.combat,damage=pendingDamage[0];
  if(!damage||!combat||damage.combatId!==combat.id||!editableCombat(combat)){box.hidden=true;return;}
  const applied=damage.appliedTargets??[];box.hidden=false;get('combat-roll-effect-result').textContent=(damage.check.actor?damage.check.actor+' · ':'')+damage.check.label+': '+damage.check.total+' Schaden gewürfelt'+(applied.length?' · auf '+applied.length+' Ziel'+(applied.length===1?'':'e')+' angewendet':'')+(pendingDamage.length>1?' · 1 von '+pendingDamage.length+' offenen Würfen':'');
  const target=get<HTMLSelectElement>('combat-roll-target'),previous=target.dataset.checkId===damage.check.id?target.value:'',candidates=combat.participants.filter(p=>p.healthKnown!==false&&!applied.includes(p.id));target.replaceChildren();target.dataset.checkId=damage.check.id;
  for(const p of candidates){const option=document.createElement('option');option.value=p.id;option.textContent=p.name+' · '+p.hp+' / '+p.maxHp+' HP'+(p.tempHp?' + '+p.tempHp+' temp.':'');target.append(option);}
  const fallback=candidates.find(p=>p.id===damage.targetId)??candidates.find(p=>p.id!==damage.attackerId&&!!p.characterId)??candidates.find(p=>p.id!==damage.attackerId)??candidates[0];target.value=candidates.some(p=>p.id===previous)?previous:fallback?.id??'';
  const keep=get<HTMLInputElement>('combat-roll-keep');if(keep.dataset.checkId!==damage.check.id){keep.dataset.checkId=damage.check.id;keep.checked=false;}const unavailable=blocked()||!target.value;get<HTMLButtonElement>('combat-roll-damage').disabled=unavailable;get<HTMLButtonElement>('combat-roll-half').disabled=unavailable||Math.floor(damage.check.total/2)<1;get<HTMLButtonElement>('combat-roll-double').disabled=unavailable||damage.check.total*2>1000000;keep.disabled=blocked();const discard=get<HTMLButtonElement>('combat-roll-discard');discard.textContent=applied.length?'Wurf abschließen':'Verwerfen';discard.disabled=blocked();
}
async function applyRolledDamage(scale:'full'|'half'|'double'){
  const damage=pendingDamage[0],target=value('combat-roll-target');if(!damage||!target||view?.combat?.id!==damage.combatId)return;
  const amount=scale==='half'?Math.floor(damage.check.total/2):scale==='double'?damage.check.total*2:damage.check.total;
  if(amount<1||amount>1000000)return;
  if(await execute({kind:'damage',participantId:target,amount,sourceCheckId:damage.check.id,sourceScale:scale})&&pendingDamage[0]?.check.id===damage.check.id){if(get<HTMLInputElement>('combat-roll-keep').checked){damage.appliedTargets=[...(damage.appliedTargets??[]),target];const available=view?.combat?.participants.some(p=>p.healthKnown!==false&&!damage.appliedTargets!.includes(p.id));if(!available)pendingDamage=pendingDamage.slice(1);}else pendingDamage=pendingDamage.slice(1);renderDamageEffect();}
}
function renderConcentrationEffect(){
  const box=get('combat-concentration-effect'),combat=view?.combat,actor=combat?.participants.find(p=>p.concentrationChecks?.length),check=actor?.concentrationChecks?.[0];if(!combat||!actor||!check||!editableCombat(combat)){box.hidden=true;return;}box.hidden=false;get('combat-concentration-result').textContent=actor.name+' · Konzentration SG '+check.dc+' nach '+check.damage+' Schaden'+(actor.concentrationChecks!.length>1?' · 1 von '+actor.concentrationChecks!.length+' offenen Prüfungen':'');
  const modifier=get<HTMLInputElement>('combat-concentration-modifier'),key=actor.id+':'+check.damage+':'+check.dc;if(modifier.dataset.checkKey!==key){modifier.dataset.checkKey=key;modifier.value='0';}for(const id of ['combat-concentration-roll','combat-concentration-pass','combat-concentration-fail'])get<HTMLButtonElement>(id).disabled=blocked();modifier.disabled=blocked();
}
function renderReinforcements(){
 const select=get<HTMLSelectElement>('combat-creature-select'),previous=select.value,combat=view?.combat;
 select.replaceChildren();
 const add=(id:string,text:string)=>{const option=document.createElement('option');option.value=id;option.textContent=text;select.append(option);};
 const groups=new Set<string>();
 for(const actor of combat?.participants??[])if(actor.sourceId&&!actor.worldActorId&&!groups.has(actor.groupId)){
  groups.add(actor.groupId);const count=combat!.participants.filter(p=>p.groupId===actor.groupId).length;
  if(count>1||actor.partitionKind==='mob')add('group:'+actor.groupId,(actor.groupName?actor.groupName+' · ':'')+(combat?.sources?.find(c=>c.id===actor.sourceId)?.name??actor.name)+' · vorhandene Initiative '+actor.initiative+' ('+count+')');
 }
 const creatures=new Map([...(combat?.sources??[]),...reinforcementResults].map(c=>[c.id,c]));
 for(const c of creatures.values())add('creature:'+c.id,c.name+' · HG '+c.challengeRating);
 if(!select.options.length)add('','Monster suchen oder zuerst einen Statblock in diesen Kampf übernehmen.');
 select.value=[...select.options].some(o=>o.value===previous)?previous:select.options[0]?.value??'';
}
async function searchReinforcements(){
 const w=workspace,combat=view?.combat;if(!w||!combat||blocked()||reinforcementBusy)return;
 const g=generation,id=combat.id,load=loadNumber,request=++reinforcementRequest;
 reinforcementBusy=true;reinforcementResults=[];get('combat-creature-status').textContent='Monster werden gesucht…';renderReinforcements();lock();
 try{
  const result=unwrap(await window.campaign.creatures({text:value('combat-creature-search'),offset:0,limit:25,sort:'name',direction:'asc'}));
  if(g!==generation||request!==reinforcementRequest||workspace?.token!==w.token||view?.combat?.id!==id||load!==loadNumber)return;
  reinforcementResults=result.rows;get('combat-creature-status').textContent=result.total?Math.min(25,result.total)+' von '+result.total+' Treffern. Bekannte Statblöcke und Gruppen bleiben verfügbar.':'Keine Treffer. Bekannte Statblöcke und Gruppen bleiben verfügbar.';
 }catch(error){if(g===generation&&request===reinforcementRequest&&view?.combat?.id===id&&load===loadNumber)get('combat-creature-status').textContent='Suche fehlgeschlagen: '+(error as Error).message;}
 finally{if(g===generation&&request===reinforcementRequest){reinforcementBusy=false;if(load!==loadNumber)get('combat-creature-status').textContent='Kampfstand geändert. Bei Bedarf erneut suchen.';renderReinforcements();lock();}}
}
function lockConditionShortcuts(){
 const key=fighterKey(),draftOpen=!!key&&!!fighterDrafts.get(key);
 get('fighter-condition-draft-hint').hidden=!draftOpen;
 for(const button of get('fighter-condition-shortcuts').querySelectorAll<HTMLButtonElement>('button'))button.disabled=blocked()||editorLoading||!!key&&draftCache.readFailures.has(key)||draftOpen||button.dataset.statblockDisabled==='true';
}
function lock() {
  for (const control of get('combat-panel').querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('button,input,select,textarea')) control.disabled = blocked()||control.dataset.statblockDisabled==='true'||control.dataset.combatReadonly==='true';
  get('combat-creation').hidden=loadPending||!!loadError;get('combat-status').hidden=loadPending||!!loadError;
  const contextBlocked=!workspace||!scene||!!pending||!!workspace&&hasPendingCommit(workspace.campaign.id);
  get<HTMLButtonElement>('combat-refresh').disabled=contextBlocked;get<HTMLButtonElement>('combat-history-open').disabled=contextBlocked||loadPending;get<HTMLSelectElement>('combat-history').disabled=contextBlocked;
  const status=get('combat-load-status'),title=knownRecent.find(c=>c.id===requestedCombatId)?.title;status.hidden=!loadPending&&!loadError;status.setAttribute('role',loadError?'alert':'status');status.textContent=loadError?'Begegnung konnte nicht geladen werden: '+loadError+' Erneut laden oder eine andere Begegnung wählen.':loadPending?(title?'„'+title+'“ wird geladen…':'Begegnung wird geladen…'):'';get('combat-panel').setAttribute('aria-busy',String(loadPending));
  if(candidateLoading)for(const c of get('combat-party-form').querySelectorAll<HTMLButtonElement|HTMLSelectElement|HTMLInputElement>('select,button,input'))c.disabled=true;
  get<HTMLButtonElement>('combat-undo').disabled = !view?.canUndo || blocked();
  if(editorLoading||!!fighterKey()&&draftCache.readFailures.has(fighterKey()!))for(const c of get('combat-participant').querySelectorAll<HTMLInputElement|HTMLButtonElement>('#combat-participant-form input,#combat-participant-form button'))c.disabled=true;
  lockConditionShortcuts();
  if(notesLoading||!!notesKey()&&draftCache.readFailures.has(notesKey()!))for(const c of get('combat-notes-form').querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLTextAreaElement>('input,button,textarea'))c.disabled=true;
  const unknown = view?.combat?.participants.find(p => p.id === selected)?.healthKnown === false;
  for (const id of ['fighter-damage','fighter-heal']) get<HTMLButtonElement>(id).disabled = blocked() || unknown;
  const fighter=view?.combat?.participants.find(p=>p.id===selected),deathControls=deathSaveControls(fighter?.death),deathUnavailable=blocked()||!fighter?.characterId||fighter.healthKnown===false||fighter.hp!==0;
  const concentrationPending=!!view?.combat?.participants.some(p=>p.concentrationChecks?.length);
  for(const id of ['combat-start','combat-next','combat-finish'])get<HTMLButtonElement>(id).disabled=blocked()||concentrationPending;
  get<HTMLButtonElement>('fighter-remove').disabled=blocked()||!fighter||!!fighter.concentrationChecks?.length;
  get<HTMLButtonElement>('fighter-visibility').disabled=blocked()||!fighter||!!fighter.characterId;
  get<HTMLInputElement>('fighter-concentration').disabled=blocked()||!!fighter?.concentrationChecks?.length;
  for(const result of ['roll','success','failure','natural-20','natural-1','stabilize','dead'] as const)get<HTMLButtonElement>('fighter-death-'+result).disabled=deathUnavailable||deathControls.terminal;
  get<HTMLButtonElement>('fighter-death-reset').disabled=deathUnavailable||!deathControls.reset;
  get<HTMLButtonElement>('fighter-heal').disabled=blocked()||unknown||!!fighter?.death?.dead;
  get<HTMLButtonElement>('fighter-revive').disabled=deathUnavailable||!fighter?.death?.dead;
  get<HTMLInputElement>('fighter-revive-hp').disabled=deathUnavailable||!fighter?.death?.dead;
  initiativePanel?.context(view?.combat??null,workspace?{campaignId:workspace.campaign.id,token:workspace.token}:null,blocked());
  hitPanel?.context(view?.combat??null,workspace?.token??null,blocked());
  areaPanel?.context(view?.combat??null,workspace?.token??null,blocked());
  renderAttackEffect();
  renderSaveEffect();
  renderDamageEffect();
  renderConcentrationEffect();
  if(reinforcementBusy)for(const control of get('combat-reinforcement').querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement>('input,button,select'))control.disabled=true;
  get<HTMLButtonElement>('combat-creature-add').disabled=blocked()||reinforcementBusy||!value('combat-creature-select');
  const linked=value('combat-creature-select').startsWith('group:');
  get<HTMLInputElement>('combat-creature-initiative').disabled=blocked()||reinforcementBusy||linked;
  get<HTMLInputElement>('combat-creature-grouped').disabled=blocked()||reinforcementBusy||linked;
}
function render() {
  const combat = view?.combat;
  get('combat-resume').hidden=!scene;
  const creation=get<HTMLDetailsElement>('combat-creation'),creationId=combat?.id??'';
  if(creation.dataset.combatId!==creationId){creation.dataset.combatId=creationId;creation.open=!combat;}
  renderReinforcements();
  get('combat-creation').hidden = false;
  get('combat-shared-notice').textContent=combat?.sharedNotice??'';
  get('combat-workspace').hidden = !combat;
  get('combat-title').textContent = combat?.title ?? 'Begegnung führen';
  get('combat-assessment').textContent = view?.assessment ? view.assessment.baseXp + ' Basis-XP · ' + view.assessment.adjustedXp + ' angepasste XP · ' + (view.assessment.difficulty ?? 'Schwierigkeit unbekannt: XP oder Party-Level fehlen') + (combat?.planOrigin ? ' · Vorlage: ' + combat.planOrigin.name : '') : '';
  get('combat-status').textContent = !combat ? 'Bereite hier die nächste Begegnung dieser Gruppe vor.' : combat.phase === 'preparing' ? 'Vorbereitung · HP und Initiative anpassen, dann ausdrücklich beginnen.' : combat.phase === 'finished' ? 'Abgeschlossen · ' + combat.outcome + (combat.rewards?.totalXp ? ' · ' + combat.rewards.totalXp + ' XP verteilt' : '') : combat.phase==='retired'?'Archiviert · Quellgruppe wurde beendet; kein Kampfergebnis abgeleitet.':'Runde ' + combat.round + ' · Am Zug: ' + (combat.participants.find(p => p.id === combat.turnId)?.name ?? '—');
  const history = get<HTMLSelectElement>('combat-history'); history.replaceChildren();
  const recent=[...(view?.recent??knownRecent)];if(combat&&!recent.some(item=>item.id===combat.id))recent.unshift({id:combat.id,title:combat.title,phase:combat.phase});
  for (const item of recent) { const option = document.createElement('option'); option.value = item.id; option.textContent = item.title + (item.sequence ? ' · Nr. '+item.sequence : '') + (item.phase === 'finished' ? ' · abgeschlossen' : item.phase === 'retired'?' · archiviert':item.phase === 'running' ? ' · läuft' : ' · vorbereitet'); history.append(option); }
  history.value = combat?.id ?? requestedCombatId ?? ''; history.hidden = recent.length < 2;
  const terminal=!!combat&&!editableCombat(combat);
  get('combat-controls').hidden = !combat || terminal;
  get('combat-start').hidden = combat?.phase !== 'preparing';
  get('combat-next').hidden = combat?.phase !== 'running';
  get('combat-finish').hidden = !combat || terminal;
  get('combat-finish').textContent = combat?.phase === 'preparing' ? 'Vorbereitung beenden…' : 'Kampf abschließen…';
  get('combat-add-details').hidden = !combat || terminal;
  get('combat-notes-details').hidden = !combat || terminal;
  renderNotes();
  resolution?.context(workspace,scene,combat??null);
  get('combat-final-notes').hidden = !terminal; get('combat-final-notes').textContent = combat?.notes ?? '';
  const body = get('combat-rows'); body.replaceChildren();
  const mobs=combat?combatMobs(combat):[],drawn=new Set<string>(),ownerToken=workspace?.token,ownerGeneration=generation;
  const mobByMember=new Map(mobs.flatMap(mob=>mob.members.map(actor=>[actor.id,mob] as const)));
  const current=()=>workspace?.token===ownerToken&&generation===ownerGeneration&&view?.combat?.id===combat?.id&&view?.combat?.revision===combat?.revision&&!blocked();
  const openHealth=(id:string)=>{void(async()=>{if(!current())return;await chooseFighter(id);if(!current()||selected!==id)return;const target=get<HTMLInputElement>('fighter-amount');if(!target.disabled){target.focus({preventScroll:true});target.select();target.scrollIntoView({block:'center'});}})();};
  const order=combat?combatOrder(combat):[],turnIndex=combat?.phase==='running'?order.findIndex(p=>p.id===combat.turnId):-1;
  for (const p of order) {
    const mob=mobByMember.get(p.id);
    if(mob&&!drawn.has(mob.id)){drawn.add(mob.id);body.append(combatMobRow(mob,combat!,{expanded:expandedMobs.has(mob.id),selected,current,choose:id=>{void chooseFighter(id);},health:openHealth,initiative:id=>{void initiativePanel?.open(id);},toggle:()=>{if(expandedMobs.has(mob.id))expandedMobs.delete(mob.id);else expandedMobs.add(mob.id);render();[...get('combat-rows').querySelectorAll<HTMLElement>('[data-mob-id]')].find(row=>row.dataset.mobId===mob.id)?.querySelector<HTMLButtonElement>('.combat-mob-toggle')?.focus({preventScroll:true});}}));}

    const tr = document.createElement('tr'); tr.dataset.participantId = p.id;tr.hidden=!!mob&&!expandedMobs.has(mob.id);if(mob)tr.dataset.mobMember=mob.id;if(turnIndex>=0&&order.indexOf(p)<turnIndex)tr.classList.add('completed-turn');
    if (p.id === combat!.turnId && combat!.phase === 'running') tr.classList.add('current-turn');
    const name = document.createElement('td'), choose = document.createElement('button');
    choose.textContent = p.name;choose.title=p.name; choose.setAttribute('aria-pressed', String(selected === p.id)); choose.onclick = () => { void chooseFighter(p.id); }; name.append(choose);
    const tag = document.createElement('small'); tag.textContent = p.characterId ? 'Party' : combat!.participants.filter(other => other.groupId === p.groupId).length > 1 ? 'Gemeinsame Initiative' : 'Einzelinitiative'; tag.title=tag.textContent??'';tag.textContent=p.characterId?'Party':combat!.participants.filter(other=>other.groupId===p.groupId).length>1?'gemeinsam':'einzeln';if(p.groupName)tag.textContent=p.groupName;tag.textContent+=(p.hiddenFromPlayers?' · Auf Anzeige verborgen':''); if(!p.characterId&&p.role)tag.textContent={friendly:'verbündet',neutral:'neutral',hostile:'feindlich'}[p.role]+' · '+tag.textContent;if(turnIndex>=0&&order.indexOf(p)<turnIndex)tag.textContent+=' · Zug beendet';name.append(tag); tr.append(name);
    const death=p.death?.dead?'Tot':p.death?.stable?'Stabilisiert':p.characterId&&p.healthKnown!==false&&p.hp===0?'Todesrettung '+(p.death?.successes??0)+'✓ / '+(p.death?.failures??0)+'✗':'';
    for (const [index,text] of [String(p.initiative), String(p.armorClass), p.healthKnown === false ? 'HP offen' : p.hp + ' / ' + p.maxHp + (p.tempHp ? ' + ' + p.tempHp + ' temp.' : ''), [death,p.healthKnown === false ? '' : p.hp === 0 ? '0 HP' : p.hp <= p.maxHp / 2 ? 'Angeschlagen' : '', p.conditions, p.concentrating ? 'Konzentration' : '',p.legendaryActions?'Legendär '+p.legendaryActions.remaining+'/'+p.legendaryActions.maximum:'',p.timedEffects?.map(effect=>effect.name+' '+effect.remaining+'R').join(', ')].filter(Boolean).join(' · ') || '—'].entries()) {
      const td = document.createElement('td');
      if(index===0||index===2){
        const initiative=index===0,health=document.createElement('button');health.type='button';health.className='combat-value '+(initiative?'combat-initiative':'combat-health');health.dataset.combatReadonly=String(!editableCombat(combat!));health.textContent=text;
        health.setAttribute('aria-label',p.name+' · '+(initiative?'Initiative '+text+' bearbeiten':text+' HP · '+(p.healthKnown===false?'Werte eintragen':'Schaden oder Heilung')));
        health.onclick=()=>{if(initiative){void initiativePanel?.open(p.id);return;}void(async()=>{
          const gen=generation,id=combat!.id;await chooseFighter(p.id);
          if(generation!==gen||view?.combat?.id!==id||selected!==p.id)return;
          const target=get<HTMLInputElement>(initiative?'fighter-initiative':p.healthKnown===false?'fighter-hp':'fighter-amount');
          if(initiative||p.healthKnown===false)get<HTMLDetailsElement>('fighter-values').open=true;
          if(!target.disabled){target.focus({preventScroll:true});target.select();target.scrollIntoView({block:'center'});}
        })();};td.append(health);
      }else td.textContent=text;
      tr.append(td);
    }
    body.append(tr);
  }
  if (selected && !combat?.participants.some(p => p.id === selected)) selected = null;
  renderPartyCandidates();renderEditor();renderAttackEffect();renderSaveEffect();renderDamageEffect();renderConcentrationEffect();lock();
  get<HTMLButtonElement>('combat-undo').disabled = !view?.canUndo || blocked();
}
function renderSelection() { for(const button of get('combat-rows').querySelectorAll<HTMLButtonElement>('.combat-mob-card button[aria-pressed]'))button.setAttribute('aria-pressed',String(button.dataset.mobFrontId===selected));for (const row of get('combat-rows').querySelectorAll<HTMLTableRowElement>('tr[data-participant-id]')) row.querySelector('button')?.setAttribute('aria-pressed', String(row.dataset.participantId === selected)); }
export const deferLegendaryCost=(kind:CreatureRollPreset['kind'])=>kind==='attack'||kind==='save'||kind==='check';
function legendaryControl(source:Creature,p:Combatant,action:CreatureAction){if(!isLegendaryAction(source,action))return null;const points=p.legendaryActions,cost=legendaryActionCost(action),combat=view?.combat,running=combat?.phase==='running',ownTurn=running&&combat.turnId===p.id,used=running&&points?.lastUsedRound===combat.round&&points.lastUsedTurnId===combat.turnId;return{disabled:blocked()||!running||ownTurn||used||!points||points.remaining<cost,note:!running?'Ab Kampfbeginn verfügbar':!points?'Ab dem nächsten eigenen Zug verfügbar':ownTurn?'Nicht im eigenen Zug':used?'In diesem Zug bereits eingesetzt':points.remaining+' / '+points.maximum+' Punkte · kostet '+cost};}
async function spendLegendary(source:Creature,p:Combatant,action:CreatureAction){return !isLegendaryAction(source,action)||await execute({kind:'legendary-action',participantId:p.id,actionId:action.id,cost:legendaryActionCost(action)});}
function openSourceDamage(source:Creature,p:Combatant,original:CreatureAction){const action=creatureActionForRolls(source,original),legendary=isLegendaryAction(source,action)?{participantId:p.id,actionId:action.id,cost:legendaryActionCost(action)}:undefined;if(creatureActionRolls(action).some(preset=>preset.kind==='attack'))hitPanel?.open({attackerId:p.id,action,legendary});else areaPanel?.open({participantId:p.id,action,legendary});}
function useUnparsedAction(source:Creature,p:Combatant,action:CreatureAction){if(creatureActionRolls(creatureActionForRolls(source,action)).some(preset=>preset.kind==='attack'))openSourceDamage(source,p,action);else void spendLegendary(source,p,action);}
async function useCreatureRoll(source:Creature,p:Combatant,combatId:string,action:CreatureAction,preset:CreatureRollPreset){
  if(preset.kind==='damage'&&creatureActionRolls(action).some(p=>p.kind==='attack')){openSourceDamage(source,p,action);return;}
  if(preset.kind==='attack'&&pendingAttack){stageAttack(action,preset,p.id,p.name,source.id,combatId);return;}if((preset.kind==='save'||preset.kind==='check')&&pendingSave){stageSave(action,preset,p.id,p.name,source.id,combatId);return;}const legendary=isLegendaryAction(source,action)?{participantId:p.id,actionId:action.id,cost:legendaryActionCost(action)}:undefined;if(legendary&&deferLegendaryCost(preset.kind)){if(preset.kind==='attack')stageAttack(action,preset,p.id,p.name,source.id,combatId,legendary);else stageSave(action,preset,p.id,p.name,source.id,combatId,legendary);return;}if(!await spendLegendary(source,p,action))return;
  if(preset.kind==='save'||preset.kind==='check')stageSave(action,preset,p.id,p.name,source.id,combatId);else if(preset.kind==='attack')stageAttack(action,preset,p.id,p.name,source.id,combatId);else void rollSceneFormula({label:preset.label,actor:p.name,formula:preset.formula,formulaKind:'damage',dc:null,sourceCreatureId:source.id,sourceActionId:action.id},check=>stageDamage(check,p.id,combatId));
}
function renderConditionShortcuts(p:Combatant|undefined,source:Creature|undefined){const root=get('fighter-condition-shortcuts'),hint=get('fighter-condition-immunity');root.replaceChildren();root.hidden=!p;hint.hidden=true;if(!p)return;const field=get<HTMLInputElement>('fighter-conditions'),immunities=new Set((source?.conditionImmunities??'').split(/\s*[,;]\s*/).map(value=>value.toLocaleLowerCase('en')).filter(Boolean));for(const [label,english]of combatConditions){const active=hasCombatCondition(field.value,label,english),immune=immunities.has(english.toLocaleLowerCase('en')),button=document.createElement('button');button.type='button';button.textContent=label+(immune?' · immun':'');button.setAttribute('aria-pressed',String(active));button.dataset.statblockDisabled=String(immune&&!active);button.disabled=blocked()||immune&&!active;button.title=immune&&!active?'Laut Statblock gegen '+label+' immun':'';button.onclick=()=>{field.value=setCombatCondition(field.value,label,english,!active);field.dispatchEvent(new Event('input',{bubbles:true}));get<HTMLFormElement>('combat-participant-form').requestSubmit();};root.append(button);}if(immunities.size){hint.hidden=false;hint.textContent='Zustandsimmunitäten laut Statblock: '+source!.conditionImmunities+'.';}}
function renderTimedEffects(p:Combatant|undefined){const section=get('fighter-effects'),root=get('fighter-effect-list');section.hidden=!p;root.replaceChildren();for(const effect of p?.timedEffects??[]){const row=document.createElement('p'),text=document.createElement('span'),remove=document.createElement('button');text.textContent=effect.name+' · '+effect.remaining+' Runde'+(effect.remaining===1?'':'n')+' · am '+(effect.tick==='start'?'Anfang':'Ende')+' des Zugs';remove.type='button';remove.textContent='Entfernen';remove.disabled=blocked();remove.onclick=()=>{if(p)void execute({kind:'effect-remove',participantId:p.id,effectId:effect.id});};row.append(text,remove);root.append(row);}if(p&&!p.timedEffects?.length){const empty=document.createElement('p');empty.className='caption';empty.textContent='Kein Rundeneffekt aktiv.';root.append(empty);}}
function renderEditor() {
  const p = view?.combat?.participants.find(p => p.id === selected),key=fighterKey(),draft=key?fighterDrafts.get(key):undefined;
  get('fighter-draft-status').textContent=draft?(p&&fighterDraftBasisMatches(draft.basis,p)?'Eingabe offen – mit „Werte übernehmen“ bestätigen.':'Gespeicherte Werte wurden geändert. Eingabe bleibt offen; zuerst den aktuellen Stand laden.') : '';
  get('combat-participant').hidden = !p || !editableCombat(view?.combat??null);
  get('combat-selected-name').textContent = p?.name ?? '';
  get('fighter-group-name-field').hidden=!p||!!p.characterId;get<HTMLInputElement>('fighter-group-name').value=draft?.values['fighter-group-name']??p?.groupName??'';
  get('combat-selection-hint').hidden=!!p||!editableCombat(view?.combat??null);
  get('fighter-quick-health').textContent=p?(p.healthKnown===false?'HP noch offen':p.hp+' / '+p.maxHp+' HP'+(p.tempHp?' + '+p.tempHp+' temporäre HP':''))+' · Initiative '+p.initiative+' · RK '+p.armorClass:'';
  get('fighter-health-hint').hidden = p?.healthKnown !== false;
  for (const id of ['fighter-damage','fighter-heal']) get<HTMLButtonElement>(id).disabled = blocked() || p?.healthKnown === false;
  get<HTMLButtonElement>('fighter-heal').disabled=blocked()||p?.healthKnown===false||!!p?.death?.dead;
  get('fighter-revival').hidden=!p?.death?.dead;
  get('fighter-healing-hint').textContent=p?.death?.dead?'Tot: Normale Heilung ist nicht möglich. Nach erfolgreicher Wiederbelebung unten ins Leben zurückholen.':'Schaden verbraucht zuerst temporäre HP. Heilung endet bei den maximalen HP.';
  get<HTMLInputElement>('fighter-revive-hp').max=String(p?.maxHp??1);
  for (const [id, field] of [['fighter-name', 'name'], ['fighter-initiative', 'initiative'], ['fighter-bonus', 'initiativeBonus'], ['fighter-ac', 'armorClass'], ['fighter-hp', 'hp'], ['fighter-max-hp', 'maxHp'], ['fighter-temp-hp', 'tempHp'], ['fighter-conditions', 'conditions']] as const) get<HTMLInputElement>(id).value = draft?draft.values[id]??'':p?.healthKnown === false && (field === 'hp' || field === 'maxHp') ? '' : String(p?.[field] ?? '');
  get<HTMLInputElement>('fighter-concentration').checked = draft?draft.concentrating:p?.concentrating ?? false;
  get('fighter-concentration-hint').hidden = !p?.concentrating;
  get<HTMLInputElement>('fighter-xp').value = draft?draft.values['fighter-xp']??'':p?.xp === undefined ? '' : String(p.xp);
  get<HTMLInputElement>('fighter-counted').checked = draft?draft.counted:p?.countForMultiplier !== false;
  const deathPanel=get('fighter-death-saves'),death=p?.death,deathControls=deathSaveControls(death);deathPanel.hidden=!p?.characterId||p.healthKnown===false||p.hp!==0;
  get('fighter-death-summary').textContent=death?.dead?'Tot':death?.stable?'Stabilisiert':(death?.successes??0)+' Erfolge · '+(death?.failures??0)+' Fehlschläge'+(p?.deathLast?.roll!==null&&p?.deathLast?.roll!==undefined?' · letzter Wurf '+p.deathLast.roll:'');
  get<HTMLDetailsElement>('fighter-death-other').open=deathControls.terminal;
  get<HTMLButtonElement>('fighter-death-reset').hidden=!deathControls.reset;
  const source = view?.combat?.sources?.find(c=>c.id===p?.sourceId),combatId=view?.combat?.id;renderConditionShortcuts(p,source);renderTimedEffects(p);const visibility=get<HTMLButtonElement>('fighter-visibility');visibility.hidden=!p||!!p.characterId;visibility.disabled=blocked();visibility.textContent=p?.hiddenFromPlayers?'Auf Spieleranzeige zeigen':'Auf Spieleranzeige verbergen';get('fighter-actions').hidden=!source; if(source&&p&&combatId)renderCombatActions(get('fighter-actions'),source,(action,preset)=>{void useCreatureRoll(source,p,combatId,action,preset);},action=>openSourceDamage(source,p,action),action=>legendaryControl(source,p,action),action=>useUnparsedAction(source,p,action));get('fighter-statblock').hidden=!source; if(source&&p&&combatId)renderCreatureDetail(get('fighter-statblock-content'),source,(action,preset)=>{void useCreatureRoll(source,p,combatId,action,preset);},action=>legendaryControl(source,p,action),action=>useUnparsedAction(source,p,action));
}
function draftRevision(d:CombatWorkingDraft|undefined){if(!d||!view?.combat)return undefined;const c=view.combat,basis=d.kind==='fighter'?c.participants.find(p=>p.id===d.targetId):{title:c.title,notes:c.notes},matches=d.kind==='fighter'&&basis?fighterDraftBasisMatches(d.basis,basis as Combatant):JSON.stringify(basis)===JSON.stringify(d.basis);return matches?c.revision:d.revision;}
async function recoveredCombat(event:CommitResolution){
  if(event.ref.family!=='combat'||workspace?.campaign.id!==event.ref.campaignId)return;
  const result=event.value as CombatView,meta=event.meta as {token?:string;editKey?:string;editDraft?:FighterDraft;editorDraft?:CombatWorkingDraft}|undefined;
  if(meta?.token===workspace.token&&meta.editorDraft){draftCache.consumed(workspace.campaign.id,meta.editorDraft);if(meta.editorDraft.kind==='initiative')initiativePanel?.accepted(meta.editorDraft);}
  if(result.combat&&scene&&result.combat.sceneId===scene.id&&(!view?.combat||view.combat.id===result.combat.id))await load(result.combat.id);
  await refreshProgress();if(afterSaved)await afterSaved();
}
export function initCombat(status: typeof tell,refresh?:()=>Promise<void>) {
  tell = status;afterSaved=refresh;
  const groupButton=document.createElement('button');groupButton.type='button';groupButton.id='combat-group-open';groupButton.textContent='Vorbereitete Monstergruppe hinzufügen…';groupButton.onclick=()=>void reinforceWorldGroup().catch(e=>tell(e.message,true));get('combat-reinforcement').prepend(groupButton,sceneGroupTray(()=>{const owner=preparationOwner();return owner&&workspace?{token:workspace.token,sceneId:owner.sceneId,current:owner.current}:null;},reinforceWorldGroup,status));
  const panel=get('combat-panel');panel.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes(sceneGroupDragType)&&editableCombat(view?.combat??null)&&!blocked()){e.preventDefault();e.dataTransfer.dropEffect='copy';}});panel.addEventListener('drop',e=>{const raw=e.dataTransfer?.getData(sceneGroupDragType);if(!raw||!workspace||!scene||blocked()||!editableCombat(view?.combat??null))return;e.preventDefault();try{const data=JSON.parse(raw);if(data.sceneId!==scene.id||typeof data.groupId!=='string'||!Number.isSafeInteger(data.revision))throw new Error('Gruppe gehört zu einer anderen Szene.');void reinforceWorldGroup(data.groupId,data.revision).catch(error=>tell(error.message,true));}catch(error){tell((error as Error).message,true);}});
initiativePanel=new CombatInitiativePanel(get('combat-initiative-dialog'),draftCache,(action,revision)=>execute(action,revision),status);get('combat-initiative-open').onclick=()=>void initiativePanel?.open();hitPanel=new CombatHitPanel(get('combat-hit-effect'),(action,revision)=>execute(action,revision),async(opening,preset,formula,critical)=>{let result:SceneCheck|null=null;const actor=view?.combat?.participants.find(p=>p.id===opening.attackerId),id=view?.combat?.id,gen=generation;if(!actor||!id)return null;await rollSceneFormula({label:preset.label+(critical?' · Kritisch':''),actor:actor.name,formula,formulaKind:'damage',dc:null,sourceCreatureId:actor.sourceId!,sourceActionId:opening.action.id},check=>{if(generation===gen&&view?.combat?.id===id)result=check;});return result;});areaPanel=new CombatAreaPanel(get('combat-area-effect'),(action,revision)=>execute(action,revision));get('combat-area-open').onclick=()=>areaPanel?.open();resolution=new CombatResolutionPanel(get('combat-resolution'),openTreasureDistribution,closeStaleTreasureDistribution);onProgressChanged(()=>{void resolution?.refresh();});onProgressChanged(refreshPartyCandidates);onCommitState(lock);onCommitResolved(recoveredCombat);
  for(const id of [...fighterFields,'fighter-group-name','fighter-concentration','fighter-counted'])get(id).addEventListener('input',keepFighterDraft);
  get('fighter-reload').onclick=()=>{void(async()=>{if(!workspace||!view?.combat||!selected)return;const token=workspace.token,cam=workspace.campaign.id,id=view.combat.id,target=selected,g=generation;await draftCache.discard(token,cam,id,'fighter',target);if(g===generation){await chooseFighter(target);await listDrafts();}})().catch(error=>tell(error.message,true));};
  for(const id of ['combat-edit-title','combat-notes'])get(id).addEventListener('input',keepNotesDraft);
  get('combat-notes-reload').onclick=()=>{void(async()=>{if(!workspace||!view?.combat)return;const id=view.combat.id,g=generation;await draftCache.discard(workspace.token,workspace.campaign.id,id,'notes',id);if(g===generation){await loadNotes();await listDrafts();}})().catch(error=>tell(error.message,true));};
  get('combat-draft-more').onclick=()=>{void listDrafts(true);};get('combat-draft-refresh').onclick=()=>{void listDrafts();};
  get('combat-draft-retry').onclick=()=>{void(async()=>{if(!workspace)return;const g=generation;if(await draftCache.retry(workspace.token,workspace.campaign.id)&&g===generation){tell('Entwürfe gesichert; noch nicht übernommen.');await listDrafts();}})();};
  get('combat-party-form').onsubmit=event=>{event.preventDefault();const p=view?.partyCandidates?.find(p=>p.characterId===value('combat-party-select'));if(p)void execute({kind:'add-party',characterId:p.characterId,expectedMembershipRevision:p.membershipRevision,expectedProgressRevision:p.progressRevision,...(value('combat-party-initiative').trim()?{initiative:Number(value('combat-party-initiative'))}:{})});};
  get('combat-party-select').onchange=()=>{get<HTMLInputElement>('combat-party-initiative').value='';};
  get('combat-create-form').onsubmit = event => { event.preventDefault(); if (scene) void execute({ kind: 'create', sceneId: scene.id, expectedMembershipRevision: scene.membershipRevision, title: value('combat-new-title'), includeParty: get<HTMLInputElement>('combat-include-party').checked }); };
  get('combat-resume').onclick=()=>get('combat-panel').scrollIntoView({block:'start'});
  get('combat-scene').onclick=()=>get('running-editor').scrollIntoView({block:'start'});
  get('combat-refresh').onclick = () => { if (!pending) void load(requestedCombatId??view?.combat?.id); };
  get('combat-history-open').onclick=()=>void(async()=>{if(!workspace||!scene||pending||loadPending||hasPendingCommit(workspace.campaign.id))return;const token=workspace.token,campaignId=workspace.campaign.id,sceneId=scene.id,gen=generation;if(!await flushCombat()||workspace?.token!==token||scene?.id!==sceneId||generation!==gen)return;openMaskHistory({token,campaignId,sceneId,kind:'combat',current:()=>workspace?.token===token&&scene?.id===sceneId&&generation===gen,select:async item=>{await load(item.id);}});})();
  get<HTMLSelectElement>('combat-history').onchange = () => void load(value('combat-history'));
  get('combat-creature-search-form').onsubmit=event=>{event.preventDefault();void searchReinforcements();};
  get('combat-creature-select').onchange=()=>{get<HTMLInputElement>('combat-creature-initiative').value='';lock();};
  get('combat-creature-form').onsubmit=event=>{
   event.preventDefault();if(blocked()||reinforcementBusy)return;
   const choice=value('combat-creature-select'),groupId=choice.startsWith('group:')?choice.slice(6):undefined;
   const creatureId=groupId?view?.combat?.participants.find(p=>p.groupId===groupId&&!p.worldActorId)?.sourceId:choice.startsWith('creature:')?choice.slice(9):null;
   if(!creatureId)return;
   const initiative=value('combat-creature-initiative').trim();
   void execute({kind:'add-creature',creatureId,count:Number(value('combat-creature-count')),grouped:!!groupId||get<HTMLInputElement>('combat-creature-grouped').checked,...(groupId?{groupId}:initiative?{initiative:Number(initiative)}:{})}).then(ok=>{if(ok)get<HTMLDetailsElement>('combat-add-details').open=false;});
  };
  get('combat-add-form').onsubmit = event => { event.preventDefault(); void execute({ kind: 'add', name: value('enemy-name'), count: Number(value('enemy-count')), grouped: get<HTMLInputElement>('enemy-grouped').checked, maxHp: Number(value('enemy-hp')), armorClass: Number(value('enemy-ac')), initiativeBonus: Number(value('enemy-bonus')) }); };
  get('combat-roll').onclick = () => void execute({ kind: 'roll', mode: value('combat-roll-mode') as 'normal' | 'advantage' | 'disadvantage' });
  get('combat-start').onclick = () => void execute({ kind: 'start' });
  get('combat-next').onclick = () => void execute({ kind: 'next' });
  get('combat-undo').onclick = () => void execute({ kind: 'undo' });
  get('combat-participant-form').onsubmit = event => { event.preventDefault(); const returnToRoster=document.activeElement===get('fighter-initiative'); if(editorLoading||!!fighterKey()&&draftCache.readFailures.has(fighterKey()!))return; const hp=value('fighter-hp').trim(), maximum=value('fighter-max-hp').trim(); if (!!hp !== !!maximum) { tell('Aktuelle und maximale HP gemeinsam eintragen oder beide offen lassen.',true); return; } const health=hp&&maximum?{hp:Number(hp),maxHp:Number(maximum)}:{}; if (selected) void execute({ kind: 'edit', participantId: selected, changes: { name: value('fighter-name'), ...(!view?.combat?.participants.find(p=>p.id===selected)?.characterId?{groupName:value('fighter-group-name')}:{}), initiative: Number(value('fighter-initiative')), initiativeBonus: Number(value('fighter-bonus')), armorClass: Number(value('fighter-ac')), ...health, tempHp: Number(value('fighter-temp-hp')), conditions: value('fighter-conditions'), concentrating: get<HTMLInputElement>('fighter-concentration').checked, ...(value('fighter-xp') ? {xp:Number(value('fighter-xp'))} : {}), countForMultiplier:get<HTMLInputElement>('fighter-counted').checked } },draftRevision(fighterKey()?fighterDrafts.get(fighterKey()!):undefined)).then(ok=>{if(ok&&returnToRoster)get('combat-panel').scrollIntoView({block:'start'});}); };
  get('fighter-effect-form').onsubmit=event=>{event.preventDefault();if(!selected)return;const participantId=selected;void(async()=>{if(await execute({kind:'effect-add',participantId,name:value('fighter-effect-name'),rounds:Number(value('fighter-effect-rounds')),tick:value('fighter-effect-tick') as 'start'|'end'})&&selected===participantId)get<HTMLInputElement>('fighter-effect-name').value='';})();};
  get('fighter-damage').onclick = () => { if (selected) void execute({ kind: 'damage', participantId: selected, amount: Number(value('fighter-amount')) }); };
  get('fighter-amount').addEventListener('keydown',event=>{
    if(event.key!=='Enter'||event.repeat||event.isComposing||event.ctrlKey||event.altKey||event.metaKey)return;
    event.preventDefault();
    const amount=get<HTMLInputElement>('fighter-amount');
    if(!get<HTMLButtonElement>('fighter-damage').disabled&&amount.reportValidity())get<HTMLButtonElement>('fighter-damage').click();
  });
  get('fighter-heal').onclick = () => { if (selected) void execute({ kind: 'heal', participantId: selected, amount: Number(value('fighter-amount')) }); };
  get('fighter-revive').onclick=()=>{if(selected)void execute({kind:'revive',participantId:selected,hp:Number(value('fighter-revive-hp'))});};
  get('fighter-death-roll').onclick=()=>{if(selected)void execute({kind:'death-roll',participantId:selected});};
  for(const result of ['success','failure','natural-20','natural-1','stabilize','dead','reset'] as const)get('fighter-death-'+result).onclick=()=>{if(selected)void execute({kind:'death',participantId:selected,result});};
  get('combat-roll-damage').onclick=()=>void applyRolledDamage('full');
  get('combat-roll-half').onclick=()=>void applyRolledDamage('half');
  get('combat-roll-double').onclick=()=>void applyRolledDamage('double');
  get('combat-roll-discard').onclick=()=>{pendingDamage=pendingDamage.slice(1);renderDamageEffect();};
  get('combat-roll-target').onchange=renderDamageEffect;
  get('combat-attack-target').onchange=renderAttackEffect;
  get('combat-attack-roll').onclick=()=>void rollAttack();
  get('combat-attack-discard').onclick=()=>{pendingAttack=null;renderAttackEffect();};
  get('combat-save-target').onchange=renderSaveEffect;
  get('combat-save-modifier').oninput=renderSaveEffect;
  get('combat-save-roll').onclick=()=>void rollSave();
  get('combat-save-repeat').onclick=repeatSave;
  get('combat-save-discard').onclick=()=>{pendingSave=null;renderSaveEffect();};
  get('combat-concentration-roll').onclick=()=>{const actor=view?.combat?.participants.find(p=>p.concentrationChecks?.length);if(actor)void execute({kind:'concentration-roll',participantId:actor.id,modifier:Number(value('combat-concentration-modifier'))});};
  get('combat-concentration-pass').onclick=()=>{const actor=view?.combat?.participants.find(p=>p.concentrationChecks?.length);if(actor)void execute({kind:'concentration',participantId:actor.id,success:true});};
  get('combat-concentration-fail').onclick=()=>{const actor=view?.combat?.participants.find(p=>p.concentrationChecks?.length);if(actor)void execute({kind:'concentration',participantId:actor.id,success:false});};
  get('fighter-remove').onclick = () => { if (selected) void execute({ kind: 'remove', participantId: selected }); };
  get('fighter-visibility').onclick=()=>{const p=view?.combat?.participants.find(actor=>actor.id===selected);if(p&&!p.characterId)void execute({kind:'visibility',participantId:p.id,hidden:!p.hiddenFromPlayers});};
  get('combat-notes-form').onsubmit = event => { event.preventDefault(); void execute({ kind: 'notes', title: value('combat-edit-title'), notes: value('combat-notes') },draftRevision(notesDraft())); };
  get('combat-finish').onclick = () => { void (async () => { try { const gen = generation; if(!workspace||!view?.combat)return;if(!await prepareFinish(view.combat.participants.map(p=>p.characterId).filter((id):id is string=>!!id),view.assessment,{workspace,owner:{kind:'combat',targetId:view.combat.id,revision:view.combat.revision}}))return; if (gen !== generation) return; get<HTMLDialogElement>('combat-finish-dialog').showModal(); get('combat-outcome').focus(); } catch (error) { tell((error as Error).message, true); } })(); };
  get('combat-finish-cancel').onclick = () => get<HTMLDialogElement>('combat-finish-dialog').close();
  get('combat-finish-form').onsubmit = event => { event.preventDefault(); void (async () => { try{const draft=await finishDraftCommit();if (await execute({ kind: 'finish', outcome: value('combat-outcome'), rewards: finishRewards(),finishDraftWriteId:draft.writeId },draft.revision)) {if(draft.consume())get<HTMLDialogElement>('combat-finish-dialog').close(); await refreshProgress(); }}catch(e){tell((e as Error).message,true);} })(); };
}

export async function openExistingCombat(id:string){if(await flushCombat())await load(id);}

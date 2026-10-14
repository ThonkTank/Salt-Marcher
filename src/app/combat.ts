import {finishDraftCommit,finishDraftConsumed,flushFinishDraft} from './finish-draft-ui';
import {CombatDraftCache,combatDraftKey} from './combat-draft-cache';
import {fighterDraftFields,type FighterWorkingDraft,type NotesWorkingDraft,type CombatWorkingDraft} from './combat-draft-contracts';
import {writeConfirmed,hasPendingCommit,onCommitState,onCommitResolved,type CommitResolution} from './commit-confirmation';
import type { Workspace, Result } from './contracts';
import type { LiveScene } from './live-contracts';
import { combatOrder, type CombatAction, type CombatView, type CombatCommand, type Combatant } from './combat-contracts';
import { prepareFinish, finishRewards, refreshProgress, onProgressChanged } from './progression-ui';
import { renderCreatureDetail } from './catalog-ui';
import type { EncounterPlan } from './encounter-contracts';
import type {PreparedGroup} from './session-contracts';
import {rollSceneCheck,rollSceneFormula} from './rule-reference-ui';
import type {SceneCheck} from './scene-check-contracts';
import {deathSaveControls,type DeathSaveResult} from './progression';
import {creatureActionRolls,creatureRollKey,criticalDamageFormula,legendaryActionCost,type CreatureRollPreset} from './dice-formula';
import type {Creature,CreatureAction} from '../features/catalog/creature-catalog';
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const value = (id: string) => get<HTMLInputElement>(id).value;
const unwrap = <T>(r: Result<T>): T => { if (!r.ok) throw new Error(r.error); return r.value; };
const editableCombat=(combat:CombatView['combat'])=>!!combat&&['preparing','running'].includes(combat.phase);
const deathResultText=(result:DeathSaveResult)=>({success:'Erfolg',failure:'Fehlschlag','natural-20':'Natürliche 20 · 1 HP','natural-1':'Natürliche 1 · zwei Fehlschläge',stabilize:'Stabilisiert',reset:'Zurückgesetzt',dead:'Als tot markiert'}[result]);
export const combatConditions=[['Blind','Blinded'],['Bezaubert','Charmed'],['Taub','Deafened'],['Verängstigt','Frightened'],['Gepackt','Grappled'],['Handlungsunfähig','Incapacitated'],['Unsichtbar','Invisible'],['Gelähmt','Paralyzed'],['Versteinert','Petrified'],['Vergiftet','Poisoned'],['Liegend','Prone'],['Festgesetzt','Restrained'],['Betäubt','Stunned'],['Bewusstlos','Unconscious']] as const;
const conditionParts=(text:string)=>text.split(/\s*[,;\n]\s*/).map(part=>part.trim()).filter(Boolean);
export function hasCombatCondition(text:string,label:string,source:string){const aliases=new Set([label.toLocaleLowerCase('de'),source.toLocaleLowerCase('en')]);return conditionParts(text).some(part=>aliases.has(part.toLocaleLowerCase()));}
export function setCombatCondition(text:string,label:string,source:string,active:boolean){const aliases=new Set([label.toLocaleLowerCase('de'),source.toLocaleLowerCase('en')]),parts=conditionParts(text).filter(part=>!aliases.has(part.toLocaleLowerCase()));if(active)parts.push(label);return parts.join(', ');}
let workspace: Workspace | null = null, scene: LiveScene | null = null, view: CombatView | null = null;
let selected: string | null = null, pending: Promise<boolean> | null = null, generation = 0;
type PendingLegendary={participantId:string;actionId:string;cost:number};
type PendingDamage={check:SceneCheck;combatId:string;attackerId:string;targetId?:string;appliedTargets?:string[]};
export function enqueuePendingDamage(queue:readonly PendingDamage[],next:PendingDamage,currentCombatId:string){return next.combatId!==currentCombatId||queue.some(damage=>damage.check.id===next.check.id)?[...queue]:[...queue,next];}
let pendingDamage:PendingDamage[]=[];
type PendingAttack={combatId:string;attackerId:string;creatureId:string;actionId:string;actor:string;preset:CreatureRollPreset;damages:CreatureRollPreset[];rolledDamage:string[];targetId:string|null;check:SceneCheck|null;legendary?:PendingLegendary};
export function retainPendingAttack<T>(current:T|null,next:T){return current??next;}
let pendingAttack:PendingAttack|null=null,attackPending=false;
type PendingSave={combatId:string;attackerId:string;creatureId:string;actionId:string;actor:string;preset:CreatureRollPreset;damages:CreatureRollPreset[];rolledDamage:string[];resolvedTargets:string[];targetId:string|null;check:SceneCheck|null;legendary?:PendingLegendary};
let pendingSave:PendingSave|null=null,savePending=false;
export function pendingRollStillValid(pending:{combatId:string;attackerId:string}|null,combat:CombatView['combat']){return !!pending&&!!combat&&editableCombat(combat)&&pending.combatId===combat.id&&combat.participants.some(participant=>participant.id===pending.attackerId);}
let tell: (text: string, error?: boolean) => void, afterSaved:(()=>Promise<void>)|undefined;
let loadPending=false,loadError:string|null=null,requestedCombatId:string|null=null,knownRecent:CombatView['recent']=[];
function acceptCombat(result:CombatView){view=result;requestedCombatId=result.combat?.id??null;knownRecent=result.recent;if(pendingDamage.some(damage=>damage.combatId!==result.combat?.id))pendingDamage=[];if(pendingAttack&&!pendingRollStillValid(pendingAttack,result.combat))pendingAttack=null;if(pendingSave&&!pendingRollStillValid(pendingSave,result.combat))pendingSave=null;}
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
 const old=fighterDrafts.get(key),d:FighterDraft={version:1,kind:'fighter',writeId:crypto.randomUUID(),combatId:view.combat.id,sceneId:view.combat.sceneId,targetId:p.id,basis:structuredClone(old?.basis??p),revision:old?.revision??view.combat.revision,values:Object.fromEntries(fighterFields.map(id=>[id,value(id)])) as FighterDraft['values'],concentrating:get<HTMLInputElement>('fighter-concentration').checked,counted:get<HTMLInputElement>('fighter-counted').checked};
 void draftCache.put(workspace.token,workspace.campaign.id,d);get('fighter-draft-status').textContent='Eingabe offen – mit „Werte übernehmen“ bestätigen.';
}
function keepNotesDraft(){
 if(!workspace||!view?.combat||notesLoading)return;const key=notesKey()!;if(draftCache.readFailures.has(key))return;
 const old=notesDraft(),d:NotesWorkingDraft={version:1,kind:'notes',writeId:crypto.randomUUID(),combatId:view.combat.id,sceneId:view.combat.sceneId,targetId:view.combat.id,revision:old?.revision??view.combat.revision,basis:old?.basis??{title:view.combat.title,notes:view.combat.notes},values:{title:value('combat-edit-title'),notes:value('combat-notes')}};
 void draftCache.put(workspace.token,workspace.campaign.id,d);get('combat-notes-draft-status').textContent='Notizeingabe offen – noch nicht übernommen.';
}
async function chooseFighter(id:string){
 if(!workspace||!view?.combat)return;selected=id;const token=workspace.token,cam=workspace.campaign.id,combatId=view.combat.id,g=generation,r=++editorRequest;editorLoading=true;renderEditor();renderSelection();lock();
 try{await draftCache.load(token,cam,combatId,'fighter',id);}catch(error){if(g===generation&&r===editorRequest)tell((error as Error).message,true);}
 finally{if(g===generation&&r===editorRequest&&selected===id&&view?.combat?.id===combatId){editorLoading=false;renderEditor();lock();}}
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
   show.onclick=()=>{void(async()=>{const d=unwrap(await window.campaign.combatDraft(token,id,entry.kind,entry.targetId));if(g!==generation||view?.combat?.id!==id)return;if(!d||d.writeId!==entry.writeId)throw new Error('Entwurf inzwischen geändert. Liste aktualisieren.');get<HTMLTextAreaElement>('combat-draft-preview').value=d.kind==='notes'?d.values.title+'\n\n'+d.values.notes:Object.entries(d.values).map(([key,text])=>({'fighter-name':'Name','fighter-initiative':'Initiative','fighter-bonus':'Initiativebonus','fighter-ac':'Rüstungsklasse','fighter-hp':'Aktuelle HP','fighter-max-hp':'Maximale HP','fighter-temp-hp':'Temporäre HP','fighter-conditions':'Zustände','fighter-xp':'Kreatur-XP'} as Record<string,string>)[key]+': '+text).join('\n')+'\nKonzentration: '+(d.concentrating?'ja':'nein')+'\nFür Schwierigkeit zählen: '+(d.counted?'ja':'nein');get('combat-draft-preview').hidden=false;})().catch(error=>tell(error.message,true));};
   discard.onclick=()=>{void(async()=>{if(!workspace||workspace.token!==token||!await draftCache.flush(workspace.campaign.id))return;unwrap(await window.campaign.discardCombatDraft(token,id,entry.kind,entry.targetId,entry.writeId));const key=combatDraftKey(workspace.campaign.id,id,entry.kind,entry.targetId),d=draftCache.values.get(key);if(d?.writeId===entry.writeId)draftCache.consumed(workspace.campaign.id,d);if(g===generation){renderEditor();renderNotes();await listDrafts();}})().catch(error=>tell(error.message,true));};row.append(show,discard);root.append(row);}
  for(const problem of page.problems){const p=document.createElement('p');p.textContent='Entwurf nicht lesbar: '+problem.message;root.append(p);}draftCursor=page.next;get('combat-draft-more').hidden=!draftCursor;
 }catch(error){if(g===generation)tell((error as Error).message,true);}
}
function renderPartyCandidates(){const select=get<HTMLSelectElement>('combat-party-select'),previous=select.value,items=view?.partyCandidates??[];select.replaceChildren();for(const p of items){const option=document.createElement('option');option.value=p.characterId;option.textContent=p.name+' · '+(p.health?p.health.hp+'/'+p.health.maxHp+' HP':'HP offen');select.append(option);}select.value=items.some(p=>p.characterId===previous)?previous:items[0]?.characterId??'';if(select.value!==previous)get<HTMLInputElement>('combat-party-initiative').value='';get('combat-party-form').hidden=!editableCombat(view?.combat??null)||!items.length;}
async function refreshPartyCandidates(){
 if(pending){candidatePending=true;return;}const combat=view?.combat;if(!workspace||!scene||!editableCombat(combat??null)||!combat)return;
 const gen=generation,request=++candidateRequest,id=combat.id,token=workspace.token;candidateLoading=true;lock();
 try{const result=unwrap(await window.campaign.combat(token,scene.id,id));if(gen!==generation||request!==candidateRequest||view?.combat?.id!==id||pending||result.combat?.revision!==combat.revision)return;view.partyCandidates=result.partyCandidates;renderPartyCandidates();lock();}
 catch(error){if(gen===generation&&request===candidateRequest)tell('Party-Auswahl konnte nicht aktualisiert werden: '+(error as Error).message,true);}
 finally{if(gen===generation&&request===candidateRequest){candidateLoading=false;lock();}}
}
export function combatContext(next: Workspace | null, current: LiveScene | null, rosterRevision?:number) {
  const changed = next?.token !== workspace?.token || current?.id !== scene?.id;
  const basis=JSON.stringify([next?.token,current?.id,current?.membershipRevision,rosterRevision]),partyChanged=basis!==partyContext;partyContext=basis;
  if(changed&&workspace)draftCache.release(workspace.campaign.id);
  workspace = next; scene = current;
  get('combat-panel').hidden = !current;
  if (changed) { if (get<HTMLDialogElement>('combat-finish-dialog').open) get<HTMLDialogElement>('combat-finish-dialog').close(); generation++;loadNumber++;loadPending=false;loadError=null;requestedCombatId=null;knownRecent=[];candidateRequest++;candidatePending=false;candidateLoading=false;editorLoading=false;notesLoading=false;editorRequest++;draftPageRequest++;draftCursor=null;get('combat-draft-list').replaceChildren();get('combat-draft-preview').hidden=true; selected = null;pendingDamage=[];pendingAttack=null;attackPending=false;pendingSave=null;savePending=false; view = null; render(); if (next && current) void load(); }
  else if(partyChanged){if(view?.combat)void load(view.combat.id);else void refreshPartyCandidates();}
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

async function execute(action: CombatAction, expectedRevision?:number): Promise<boolean> {
  if (!workspace || !scene || blocked()) return false;
  loadNumber++;candidateRequest++;candidateLoading=false;const editKey=action.kind==='edit'?fighterKey():null,editDraft=editKey?fighterDrafts.get(editKey):undefined,editorDraft:CombatWorkingDraft|undefined=action.kind==='notes'?notesDraft():editDraft;
  const priorDamageDeath=action.kind==='damage'?structuredClone(view?.combat?.participants.find(p=>p.id===action.participantId)?.death):undefined;
  const gen = generation;
  const command: CombatCommand = { commandId: crypto.randomUUID(), campaignId: workspace.campaign.id, token: workspace.token,
    combatId: action.kind === 'create' ? null : view?.combat?.id ?? null,
    expectedRevision: action.kind === 'create' ? null : expectedRevision??view?.combat?.revision ?? null, action,...(editorDraft?{draftWriteId:editorDraft.writeId}:{}) };
  let applied = false,revealConcentration=false;
  pending = (async () => {
    try {
      if(!await draftCache.flush(command.campaignId)||generation!==gen)throw new Error('Offene Eingaben zuerst dauerhaft sichern.');
      const result = await writeConfirmed<CombatView>('combat',command,()=>window.campaign.executeCombat(command),()=>generation===gen&&workspace?.token===command.token,{token:command.token,editKey,editDraft,editorDraft});
      if (generation !== gen) return false;
      acceptCombat(result); applied = true;if(action.kind==='add-party')get<HTMLInputElement>('combat-party-initiative').value='';if(editorDraft)draftCache.consumed(command.campaignId,editorDraft);void listDrafts();
      if(['create','edit','damage','heal','death','death-roll','concentration','concentration-roll','undo','finish','remove','add-party'].includes(action.kind)){await refreshProgress();if(afterSaved)await afterSaved();}
      const actor='participantId'in action?result.combat?.participants.find(p=>p.id===action.participantId):undefined,death=action.kind==='death'||action.kind==='death-roll'?actor?.deathLast:action.kind==='damage'&&JSON.stringify(priorDamageDeath)!==JSON.stringify(actor?.death)?actor?.deathLast:undefined;
      const concentration=action.kind==='concentration'||action.kind==='concentration-roll'?actor?.concentrationLast:undefined;
      const openConcentration=action.kind==='damage'?actor?.concentrationChecks?.[0]:undefined;
      const legendary=action.kind==='legendary-action'?actor?.legendaryActions:undefined;
      revealConcentration=!!openConcentration;
      tell(death?(action.kind==='damage'?'Schadensfolge: ':death.roll===null?'':('Todesrettungswurf '+death.roll+': '))+deathResultText(death.result)+'.':concentration?('Konzentration: '+(concentration.roll===null?'manuell':concentration.roll+(concentration.modifier>=0?' + ':' − ')+Math.abs(concentration.modifier)+' = '+concentration.total)+' gegen SG '+concentration.dc+' · '+(concentration.success?'bestanden.':'verloren.')):openConcentration?('Schaden gespeichert. Konzentrationswurf für '+actor!.name+' gegen SG '+openConcentration.dc+' offen.'):legendary?('Legendäre Aktion eingesetzt · '+legendary.remaining+' von '+legendary.maximum+' Punkten verbleiben.'):'Kampf gespeichert.'); return true;
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
export async function prepareWorldGroup(group:PreparedGroup,worldActorIds?:string[]){
  const {id,title,revision}=group;
  const owner=preparationOwner();if(!owner||!await load()||!owner.current())return;
  if(await execute({kind:'create',sceneId:owner.sceneId,title,includeParty:true,expectedMembershipRevision:owner.revision,preparedGroupId:id,expectedPreparedRevision:revision,worldActorIds})&&owner.current())get('combat-panel').scrollIntoView({block:'start'});
}
export async function prepareCombatPlan(plan: EncounterPlan) {
  const {id,name,revision}=plan;
  const owner=preparationOwner();if(!owner||!await load()||!owner.current())return;
  if(await execute({kind:'create',sceneId:owner.sceneId,title:name,includeParty:true,expectedMembershipRevision:owner.revision,planId:id,expectedPlanRevision:revision})&&owner.current())get('combat-panel').scrollIntoView({block:'start'});
}
export async function addWorldNpc(actorId:string){
 const owner=preparationOwner(),w=workspace;if(!owner||!w||!await load()||!owner.current())return;
 const r=await window.campaign.npc(w.token,actorId);if(!r.ok)throw new Error(r.error);if(!owner.current())return;const npc=r.value;if(npc.actorRevision===null||npc.record.lifecycle==='defeated'||!npc.health?.hp)throw new Error('NPC benötigt einen Kreaturverweis, aktive Freigabe und positive HP.');
 if(!editableCombat(view?.combat??null)){if(!await execute({kind:'create',sceneId:owner.sceneId,title:'Begegnung mit '+npc.name,includeParty:true,expectedMembershipRevision:owner.revision})||!owner.current())return;}
 if(await execute({kind:'add-world-actor',actorId,expectedActorRevision:npc.actorRevision,expectedRecordRevision:npc.record.revision})&&owner.current())get('combat-panel').scrollIntoView({block:'start'});
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
  const damageRoot=get('combat-attack-damage');damageRoot.replaceChildren();if(attack.check?.outcome==='success'&&resolvedTarget)for(const damage of attack.damages){const button=document.createElement('button'),formula=critical?criticalDamageFormula(damage.formula):damage.formula,done=attack.rolledDamage.includes(creatureRollKey(damage));button.type='button';button.textContent=(critical?'Kritisch · ':'')+damage.label+' ('+formula+') würfeln'+(done?' ✓':'');button.disabled=blocked()||attackPending||done;button.onclick=()=>void rollAttackDamage(damage);damageRoot.append(button);}
  const discard=get<HTMLButtonElement>('combat-attack-discard');discard.textContent=attack.check?'Angriff abschließen':'Verwerfen';discard.disabled=blocked()||attackPending;
}
async function rollAttack(){
  const attack=pendingAttack,combat=view?.combat,target=combat?.participants.find(p=>p.id===value('combat-attack-target'));if(!attack||!combat||!target||attack.combatId!==combat.id||attack.check)return;attack.targetId=target.id;attackPending=true;renderAttackEffect();
  if(attack.legendary){if(!await execute({kind:'legendary-action',...attack.legendary})){attackPending=false;renderAttackEffect();return;}delete attack.legendary;}
  await rollSceneFormula({label:attack.preset.label+' gegen '+target.name,actor:attack.actor,formula:attack.preset.formula,formulaKind:'attack',dc:target.armorClass,sourceCreatureId:attack.creatureId,sourceActionId:attack.actionId},check=>{if(pendingAttack===attack&&view?.combat?.id===attack.combatId)attack.check=check;});attackPending=false;renderAttackEffect();
}
async function rollAttackDamage(damage:CreatureRollPreset){
  const attack=pendingAttack,check=attack?.check,key=creatureRollKey(damage);if(!attack||!check||check.outcome!=='success'||!attack.targetId||!view?.combat?.participants.some(p=>p.id===attack.targetId)||attack.rolledDamage.includes(key))return;const critical=check.rolls[0]===20;attackPending=true;renderAttackEffect();let rolled=false;
  await rollSceneFormula({label:damage.label+(critical?' · Kritisch':''),actor:attack.actor,formula:critical?criticalDamageFormula(damage.formula):damage.formula,formulaKind:'damage',dc:null,sourceCreatureId:attack.creatureId,sourceActionId:attack.actionId},result=>{if(pendingAttack===attack&&view?.combat?.id===attack.combatId){rolled=true;stageDamage(result,attack.attackerId,attack.combatId,attack.targetId!);}});attackPending=false;if(rolled)attack.rolledDamage.push(key);if(attack.rolledDamage.length===attack.damages.length)pendingAttack=null;renderAttackEffect();
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
function lock() {
  for (const control of get('combat-panel').querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('button,input,select,textarea')) control.disabled = blocked()||control.dataset.statblockDisabled==='true';
  get('combat-creation').hidden=loadPending||!!loadError;get('combat-status').hidden=loadPending||!!loadError;
  const contextBlocked=!workspace||!scene||!!pending||!!workspace&&hasPendingCommit(workspace.campaign.id);
  get<HTMLButtonElement>('combat-refresh').disabled=contextBlocked;get<HTMLSelectElement>('combat-history').disabled=contextBlocked;
  const status=get('combat-load-status'),title=knownRecent.find(c=>c.id===requestedCombatId)?.title;status.hidden=!loadPending&&!loadError;status.setAttribute('role',loadError?'alert':'status');status.textContent=loadError?'Begegnung konnte nicht geladen werden: '+loadError+' Erneut laden oder eine andere Begegnung wählen.':loadPending?(title?'„'+title+'“ wird geladen…':'Begegnung wird geladen…'):'';get('combat-panel').setAttribute('aria-busy',String(loadPending));
  if(candidateLoading)for(const c of get('combat-party-form').querySelectorAll<HTMLButtonElement|HTMLSelectElement|HTMLInputElement>('select,button,input'))c.disabled=true;
  get<HTMLButtonElement>('combat-undo').disabled = !view?.canUndo || blocked();
  if(editorLoading||!!fighterKey()&&draftCache.readFailures.has(fighterKey()!))for(const c of get('combat-participant-form').querySelectorAll<HTMLInputElement|HTMLButtonElement>('input,button'))c.disabled=true;
  if(notesLoading||!!notesKey()&&draftCache.readFailures.has(notesKey()!))for(const c of get('combat-notes-form').querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLTextAreaElement>('input,button,textarea'))c.disabled=true;
  const unknown = view?.combat?.participants.find(p => p.id === selected)?.healthKnown === false;
  for (const id of ['fighter-damage','fighter-heal']) get<HTMLButtonElement>(id).disabled = blocked() || unknown;
  const fighter=view?.combat?.participants.find(p=>p.id===selected),deathControls=deathSaveControls(fighter?.death),deathUnavailable=blocked()||!fighter?.characterId||fighter.healthKnown===false||fighter.hp!==0;
  const concentrationPending=!!view?.combat?.participants.some(p=>p.concentrationChecks?.length);
  for(const id of ['combat-start','combat-next','combat-finish'])get<HTMLButtonElement>(id).disabled=blocked()||concentrationPending;
  get<HTMLButtonElement>('fighter-remove').disabled=blocked()||!fighter||!!fighter.concentrationChecks?.length;
  get<HTMLInputElement>('fighter-concentration').disabled=blocked()||!!fighter?.concentrationChecks?.length;
  for(const result of ['roll','success','failure','natural-20','natural-1','stabilize','dead'] as const)get<HTMLButtonElement>('fighter-death-'+result).disabled=deathUnavailable||deathControls.terminal;
  get<HTMLButtonElement>('fighter-death-reset').disabled=deathUnavailable||!deathControls.reset;
  renderAttackEffect();
  renderSaveEffect();
  renderDamageEffect();
  renderConcentrationEffect();
}
function render() {
  const combat = view?.combat;
  get('combat-creation').hidden = false;
  get('combat-shared-notice').textContent=combat?.sharedNotice??'';

  get('combat-workspace').hidden = !combat;
  get('combat-title').textContent = combat?.title ?? 'Begegnung führen';
  get('combat-assessment').textContent = view?.assessment ? view.assessment.baseXp + ' Basis-XP · ' + view.assessment.adjustedXp + ' angepasste XP · ' + (view.assessment.difficulty ?? 'Schwierigkeit unbekannt: XP oder Party-Level fehlen') + (combat?.planOrigin ? ' · Vorlage: ' + combat.planOrigin.name : '') : '';
  get('combat-status').textContent = !combat ? 'Bereite hier die nächste Begegnung dieser Gruppe vor.' : combat.phase === 'preparing' ? 'Vorbereitung · HP und Initiative anpassen, dann ausdrücklich beginnen.' : combat.phase === 'finished' ? 'Abgeschlossen · ' + combat.outcome + (combat.rewards?.totalXp ? ' · ' + combat.rewards.totalXp + ' XP verteilt' : '') : combat.phase==='retired'?'Archiviert · Quellgruppe wurde beendet; kein Kampfergebnis abgeleitet.':'Runde ' + combat.round + ' · Am Zug: ' + (combat.participants.find(p => p.id === combat.turnId)?.name ?? '—');
  const history = get<HTMLSelectElement>('combat-history'); history.replaceChildren();
  for (const item of view?.recent ?? knownRecent) { const option = document.createElement('option'); option.value = item.id; option.textContent = item.title + (item.phase === 'finished' ? ' · abgeschlossen' : item.phase === 'retired'?' · archiviert':item.phase === 'running' ? ' · läuft' : ' · vorbereitet'); history.append(option); }
  history.value = combat?.id ?? requestedCombatId ?? ''; history.hidden = (view?.recent.length ?? knownRecent.length) < 2;
  const terminal=!!combat&&!editableCombat(combat);
  get('combat-controls').hidden = !combat || terminal;
  get('combat-start').hidden = combat?.phase !== 'preparing';
  get('combat-next').hidden = combat?.phase !== 'running';
  get('combat-finish').hidden = !combat || terminal;
  get('combat-finish').textContent = combat?.phase === 'preparing' ? 'Vorbereitung beenden…' : 'Kampf abschließen…';
  get('combat-add-details').hidden = !combat || terminal;
  get('combat-notes-details').hidden = !combat || terminal;
  renderNotes();
  get('combat-final-notes').hidden = !terminal; get('combat-final-notes').textContent = combat?.notes ?? '';
  const body = get('combat-rows'); body.replaceChildren();
  for (const p of combat ? combatOrder(combat) : []) {
    const tr = document.createElement('tr'); tr.dataset.participantId = p.id;
    if (p.id === combat!.turnId && combat!.phase === 'running') tr.classList.add('current-turn');
    const name = document.createElement('td'), choose = document.createElement('button');
    choose.textContent = p.name+(p.role?' · '+{friendly:'verbündet',neutral:'neutral',hostile:'feindlich'}[p.role]:''); choose.setAttribute('aria-pressed', String(selected === p.id)); choose.onclick = () => { void chooseFighter(p.id); }; name.append(choose);
    const tag = document.createElement('small'); tag.textContent = p.characterId ? 'Party' : combat!.participants.filter(other => other.groupId === p.groupId).length > 1 ? 'Gemeinsame Initiative' : 'Einzelinitiative'; name.append(tag); tr.append(name);
    const death=p.death?.dead?'Tot':p.death?.stable?'Stabilisiert':p.characterId&&p.healthKnown!==false&&p.hp===0?'Todesrettung '+(p.death?.successes??0)+'✓ / '+(p.death?.failures??0)+'✗':'';
    for (const text of [String(p.initiative), String(p.armorClass), p.healthKnown === false ? 'HP offen' : p.hp + ' / ' + p.maxHp + (p.tempHp ? ' + ' + p.tempHp + ' temp.' : ''), [death,p.healthKnown === false ? '' : p.hp === 0 ? '0 HP' : p.hp <= p.maxHp / 2 ? 'Angeschlagen' : '', p.conditions, p.concentrating ? 'Konzentration' : '',p.legendaryActions?'Legendär '+p.legendaryActions.remaining+'/'+p.legendaryActions.maximum:''].filter(Boolean).join(' · ') || '—']) { const td = document.createElement('td'); td.textContent = text; tr.append(td); }
    body.append(tr);
  }
  if (selected && !combat?.participants.some(p => p.id === selected)) selected = null;
  renderPartyCandidates();renderEditor();renderAttackEffect();renderSaveEffect();renderDamageEffect();renderConcentrationEffect();lock();
  get<HTMLButtonElement>('combat-undo').disabled = !view?.canUndo || blocked();
}
function renderSelection() { for (const row of get('combat-rows').querySelectorAll<HTMLTableRowElement>('tr')) row.querySelector('button')?.setAttribute('aria-pressed', String(row.dataset.participantId === selected)); }
const isLegendaryAction=(source:Creature,action:CreatureAction)=>source.legendaryActions.includes(action);
export const deferLegendaryCost=(kind:CreatureRollPreset['kind'])=>kind==='attack'||kind==='save'||kind==='check';
function legendaryControl(source:Creature,p:Combatant,action:CreatureAction){if(!isLegendaryAction(source,action))return null;const points=p.legendaryActions,cost=legendaryActionCost(action),combat=view?.combat,running=combat?.phase==='running',ownTurn=running&&combat.turnId===p.id,used=running&&points?.lastUsedRound===combat.round&&points.lastUsedTurnId===combat.turnId;return{disabled:blocked()||!running||ownTurn||used||!points||points.remaining<cost,note:!running?'Ab Kampfbeginn verfügbar':!points?'Ab dem nächsten eigenen Zug verfügbar':ownTurn?'Nicht im eigenen Zug':used?'In diesem Zug bereits eingesetzt':points.remaining+' / '+points.maximum+' Punkte · kostet '+cost};}
async function spendLegendary(source:Creature,p:Combatant,action:CreatureAction){return !isLegendaryAction(source,action)||await execute({kind:'legendary-action',participantId:p.id,actionId:action.id,cost:legendaryActionCost(action)});}
async function useCreatureRoll(source:Creature,p:Combatant,combatId:string,action:CreatureAction,preset:CreatureRollPreset){
  if(preset.kind==='attack'&&pendingAttack){stageAttack(action,preset,p.id,p.name,source.id,combatId);return;}if((preset.kind==='save'||preset.kind==='check')&&pendingSave){stageSave(action,preset,p.id,p.name,source.id,combatId);return;}const legendary=isLegendaryAction(source,action)?{participantId:p.id,actionId:action.id,cost:legendaryActionCost(action)}:undefined;if(legendary&&deferLegendaryCost(preset.kind)){if(preset.kind==='attack')stageAttack(action,preset,p.id,p.name,source.id,combatId,legendary);else stageSave(action,preset,p.id,p.name,source.id,combatId,legendary);return;}if(!await spendLegendary(source,p,action))return;
  if(preset.kind==='save'||preset.kind==='check')stageSave(action,preset,p.id,p.name,source.id,combatId);else if(preset.kind==='attack')stageAttack(action,preset,p.id,p.name,source.id,combatId);else void rollSceneFormula({label:preset.label,actor:p.name,formula:preset.formula,formulaKind:'damage',dc:null,sourceCreatureId:source.id,sourceActionId:action.id},check=>stageDamage(check,p.id,combatId));
}
function renderConditionShortcuts(p:Combatant|undefined,source:Creature|undefined){const root=get('fighter-condition-shortcuts'),hint=get('fighter-condition-immunity');root.replaceChildren();root.hidden=!p;hint.hidden=true;if(!p)return;const field=get<HTMLInputElement>('fighter-conditions'),immunities=new Set((source?.conditionImmunities??'').split(/\s*[,;]\s*/).map(value=>value.toLocaleLowerCase('en')).filter(Boolean));for(const [label,english]of combatConditions){const active=hasCombatCondition(field.value,label,english),immune=immunities.has(english.toLocaleLowerCase('en')),button=document.createElement('button');button.type='button';button.textContent=label+(immune?' · immun':'');button.setAttribute('aria-pressed',String(active));button.dataset.statblockDisabled=String(immune&&!active);button.disabled=blocked()||immune&&!active;button.title=immune&&!active?'Laut Statblock gegen '+label+' immun':'';button.onclick=()=>{field.value=setCombatCondition(field.value,label,english,!active);field.dispatchEvent(new Event('input',{bubbles:true}));get<HTMLFormElement>('combat-participant-form').requestSubmit();};root.append(button);}if(immunities.size){hint.hidden=false;hint.textContent='Zustandsimmunitäten laut Statblock: '+source!.conditionImmunities+'.';}}
function renderEditor() {
  const p = view?.combat?.participants.find(p => p.id === selected),key=fighterKey(),draft=key?fighterDrafts.get(key):undefined;
  get('fighter-draft-status').textContent=draft?(JSON.stringify(draft.basis)===JSON.stringify(p)?'Eingabe offen – mit „Werte übernehmen“ bestätigen.':'Gespeicherte Werte wurden geändert. Eingabe bleibt offen; zuerst den aktuellen Stand laden.') : '';
  get('combat-participant').hidden = !p || !editableCombat(view?.combat??null);
  get('combat-selected-name').textContent = p?.name ?? '';
  get('fighter-health-hint').hidden = p?.healthKnown !== false;
  for (const id of ['fighter-damage','fighter-heal']) get<HTMLButtonElement>(id).disabled = blocked() || p?.healthKnown === false;
  for (const [id, field] of [['fighter-name', 'name'], ['fighter-initiative', 'initiative'], ['fighter-bonus', 'initiativeBonus'], ['fighter-ac', 'armorClass'], ['fighter-hp', 'hp'], ['fighter-max-hp', 'maxHp'], ['fighter-temp-hp', 'tempHp'], ['fighter-conditions', 'conditions']] as const) get<HTMLInputElement>(id).value = draft?draft.values[id]??'':p?.healthKnown === false && (field === 'hp' || field === 'maxHp') ? '' : String(p?.[field] ?? '');
  get<HTMLInputElement>('fighter-concentration').checked = draft?draft.concentrating:p?.concentrating ?? false;
  get('fighter-concentration-hint').hidden = !p?.concentrating;
  get<HTMLInputElement>('fighter-xp').value = draft?draft.values['fighter-xp']??'':p?.xp === undefined ? '' : String(p.xp);
  get<HTMLInputElement>('fighter-counted').checked = draft?draft.counted:p?.countForMultiplier !== false;
  const deathPanel=get('fighter-death-saves'),death=p?.death,deathControls=deathSaveControls(death);deathPanel.hidden=!p?.characterId||p.healthKnown===false||p.hp!==0;
  get('fighter-death-summary').textContent=death?.dead?'Tot':death?.stable?'Stabilisiert':(death?.successes??0)+' Erfolge · '+(death?.failures??0)+' Fehlschläge'+(p?.deathLast?.roll!==null&&p?.deathLast?.roll!==undefined?' · letzter Wurf '+p.deathLast.roll:'');
  get<HTMLDetailsElement>('fighter-death-other').open=deathControls.terminal;
  get<HTMLButtonElement>('fighter-death-reset').hidden=!deathControls.reset;
  const source = view?.combat?.sources?.find(c=>c.id===p?.sourceId),combatId=view?.combat?.id;renderConditionShortcuts(p,source);get('fighter-statblock').hidden=!source; if(source&&p&&combatId)renderCreatureDetail(get('fighter-statblock-content'),source,(action,preset)=>{void useCreatureRoll(source,p,combatId,action,preset);},action=>legendaryControl(source,p,action),action=>{void spendLegendary(source,p,action);});
}
function draftRevision(d:CombatWorkingDraft|undefined){if(!d||!view?.combat)return undefined;const c=view.combat,basis=d.kind==='fighter'?c.participants.find(p=>p.id===d.targetId):{title:c.title,notes:c.notes};return JSON.stringify(basis)===JSON.stringify(d.basis)?c.revision:d.revision;}
async function recoveredCombat(event:CommitResolution){
  if(event.ref.family!=='combat'||workspace?.campaign.id!==event.ref.campaignId)return;
  const result=event.value as CombatView,meta=event.meta as {token?:string;editKey?:string;editDraft?:FighterDraft;editorDraft?:CombatWorkingDraft}|undefined;
  if(meta?.token===workspace.token&&meta.editorDraft)draftCache.consumed(workspace.campaign.id,meta.editorDraft);
  if(result.combat&&scene&&result.combat.sceneId===scene.id&&(!view?.combat||view.combat.id===result.combat.id))await load(result.combat.id);
  await refreshProgress();if(afterSaved)await afterSaved();
}
export function initCombat(status: typeof tell,refresh?:()=>Promise<void>) {
  tell = status;afterSaved=refresh;onProgressChanged(refreshPartyCandidates);onCommitState(lock);onCommitResolved(recoveredCombat);
  for(const id of [...fighterFields,'fighter-concentration','fighter-counted'])get(id).addEventListener('input',keepFighterDraft);
  get('fighter-reload').onclick=()=>{void(async()=>{if(!workspace||!view?.combat||!selected)return;const token=workspace.token,cam=workspace.campaign.id,id=view.combat.id,target=selected,g=generation;await draftCache.discard(token,cam,id,'fighter',target);if(g===generation){await chooseFighter(target);await listDrafts();}})().catch(error=>tell(error.message,true));};
  for(const id of ['combat-edit-title','combat-notes'])get(id).addEventListener('input',keepNotesDraft);
  get('combat-notes-reload').onclick=()=>{void(async()=>{if(!workspace||!view?.combat)return;const id=view.combat.id,g=generation;await draftCache.discard(workspace.token,workspace.campaign.id,id,'notes',id);if(g===generation){await loadNotes();await listDrafts();}})().catch(error=>tell(error.message,true));};
  get('combat-draft-more').onclick=()=>{void listDrafts(true);};get('combat-draft-refresh').onclick=()=>{void listDrafts();};
  get('combat-draft-retry').onclick=()=>{void(async()=>{if(!workspace)return;const g=generation;if(await draftCache.retry(workspace.token,workspace.campaign.id)&&g===generation){tell('Entwürfe gesichert; noch nicht übernommen.');await listDrafts();}})();};
  get('combat-party-form').onsubmit=event=>{event.preventDefault();const p=view?.partyCandidates?.find(p=>p.characterId===value('combat-party-select'));if(p)void execute({kind:'add-party',characterId:p.characterId,expectedMembershipRevision:p.membershipRevision,expectedProgressRevision:p.progressRevision,...(value('combat-party-initiative').trim()?{initiative:Number(value('combat-party-initiative'))}:{})});};
  get('combat-party-select').onchange=()=>{get<HTMLInputElement>('combat-party-initiative').value='';};
  get('combat-create-form').onsubmit = event => { event.preventDefault(); if (scene) void execute({ kind: 'create', sceneId: scene.id, expectedMembershipRevision: scene.membershipRevision, title: value('combat-new-title'), includeParty: get<HTMLInputElement>('combat-include-party').checked }); };
  get('combat-refresh').onclick = () => { if (!pending) void load(requestedCombatId??view?.combat?.id); };
  get<HTMLSelectElement>('combat-history').onchange = () => void load(value('combat-history'));
  get('combat-add-form').onsubmit = event => { event.preventDefault(); void execute({ kind: 'add', name: value('enemy-name'), count: Number(value('enemy-count')), grouped: get<HTMLInputElement>('enemy-grouped').checked, maxHp: Number(value('enemy-hp')), armorClass: Number(value('enemy-ac')), initiativeBonus: Number(value('enemy-bonus')) }); };
  get('combat-roll').onclick = () => void execute({ kind: 'roll', mode: value('combat-roll-mode') as 'normal' | 'advantage' | 'disadvantage' });
  get('combat-start').onclick = () => void execute({ kind: 'start' });
  get('combat-next').onclick = () => void execute({ kind: 'next' });
  get('combat-undo').onclick = () => void execute({ kind: 'undo' });
  get('combat-participant-form').onsubmit = event => { event.preventDefault(); const hp=value('fighter-hp').trim(), maximum=value('fighter-max-hp').trim(); if (!!hp !== !!maximum) { tell('Aktuelle und maximale HP gemeinsam eintragen oder beide offen lassen.',true); return; } const health=hp&&maximum?{hp:Number(hp),maxHp:Number(maximum)}:{}; if (selected) void execute({ kind: 'edit', participantId: selected, changes: { name: value('fighter-name'), initiative: Number(value('fighter-initiative')), initiativeBonus: Number(value('fighter-bonus')), armorClass: Number(value('fighter-ac')), ...health, tempHp: Number(value('fighter-temp-hp')), conditions: value('fighter-conditions'), concentrating: get<HTMLInputElement>('fighter-concentration').checked, ...(value('fighter-xp') ? {xp:Number(value('fighter-xp'))} : {}), countForMultiplier:get<HTMLInputElement>('fighter-counted').checked } },draftRevision(fighterKey()?fighterDrafts.get(fighterKey()!):undefined)); };
  get('fighter-damage').onclick = () => { if (selected) void execute({ kind: 'damage', participantId: selected, amount: Number(value('fighter-amount')) }); };
  get('fighter-heal').onclick = () => { if (selected) void execute({ kind: 'heal', participantId: selected, amount: Number(value('fighter-amount')) }); };
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
  get('combat-notes-form').onsubmit = event => { event.preventDefault(); void execute({ kind: 'notes', title: value('combat-edit-title'), notes: value('combat-notes') },draftRevision(notesDraft())); };
  get('combat-finish').onclick = () => { void (async () => { try { const gen = generation; if(!workspace||!view?.combat)return;await prepareFinish(view.combat.participants.map(p=>p.characterId).filter((id):id is string=>!!id),view.assessment,{workspace,owner:{kind:'combat',targetId:view.combat.id,revision:view.combat.revision}}); if (gen !== generation) return; get<HTMLDialogElement>('combat-finish-dialog').showModal(); get('combat-outcome').focus(); } catch (error) { tell((error as Error).message, true); } })(); };
  get('combat-finish-cancel').onclick = () => get<HTMLDialogElement>('combat-finish-dialog').close();
  get('combat-finish-form').onsubmit = event => { event.preventDefault(); void (async () => { try{const draft=await finishDraftCommit();if (await execute({ kind: 'finish', outcome: value('combat-outcome'), rewards: finishRewards(),finishDraftWriteId:draft.writeId },draft.revision)) {finishDraftConsumed(); get<HTMLDialogElement>('combat-finish-dialog').close(); await refreshProgress(); }}catch(e){tell((e as Error).message,true);} })(); };
}

export async function openExistingCombat(id:string){if(await flushCombat())await load(id);}

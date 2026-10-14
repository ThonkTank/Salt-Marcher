import {initSessionPacket,closePreparationPacket} from './session-packet-ui';
import {magicPoolPicker} from './session-magic-pool-ui';
import {requiredNpcPicker} from './required-npc-picker';
import {budgetRarities} from './dungeon-budget-contracts';
import {encounterEntryLabel} from './encounter-contracts';
import {initProposalEditor,openProposalEditor,proposalEditorOpen,closeProposalEditor} from './session-proposal-editor';
import type {Workspace,Result} from './contracts';
import type {Preparation} from './preparation-contracts';
import type {ManualPlan} from '../features/planner/manual-planner';
import {dailyXp,xpLevel,xpShare,type ItemInput} from './progression';
import {exactWeight,type GenerationRequest} from './generation-contracts';
import type {SessionProfile,VisitDetail,PreparedGroup,SessionView,SessionAction,SessionRun} from './session-contracts';
const get=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T,value=(id:string)=>get<HTMLInputElement>(id).value,unwrap=<T>(r:Result<T>):T=>{if(!r.ok)throw new Error(r.error);return r.value;};
let magicPick:ReturnType<typeof magicPoolPicker>;
let requiredPick:ReturnType<typeof requiredNpcPicker>;
let workspace:Workspace|null=null,plan:ManualPlan|null=null,visitId:string|null=null,sources:Preparation|null=null,view:SessionView|null=null,profileDraft:SessionProfile|null=null,visitDraft:VisitDetail|null=null,run:SessionRun|null=null;
type GroupDraft=Pick<PreparedGroup,'id'|'revision'|'title'|'notes'>;
const groupDrafts=new Map<string,GroupDraft>();
let generation=0,loadRequest=0,previewRequest=0,basis='',profileDirty=false,visitDirty=false,timer:ReturnType<typeof setTimeout>|null=null,pending:Promise<boolean>|null=null;
let tell:(text:string,error?:boolean)=>void,flushBase:()=>Promise<boolean>,refreshBase:(visitId?:string)=>Promise<void>,openNote:(id:string)=>Promise<void>;
let roster:{characterId:string;name:string;xp:number|null;revision:number;active:boolean}[]=[];
type PreviewOwner={token:string;planId:string};
type StoryAward={owner:PreviewOwner;visitId:string;revision:number;rewardId:string;poolXp:number;characters:typeof roster};
let storyRequest=0,storyAward:StoryAward|null=null;
function previewOwner():PreviewOwner|null{return workspace&&plan?{token:workspace.token,planId:plan.id}:null;}
function ownsPreview(owner:PreviewOwner){return workspace?.token===owner.token&&plan?.id===owner.planId;}
export function sessionContext(next:Workspace|null,current:ManualPlan|null,selected:string|null,data:Preparation|null){
 const parentChanged=next?.token!==workspace?.token||current?.id!==plan?.id;
 const key=JSON.stringify([next?.token,current?.id,selected]);
 workspace=next;plan=current;visitId=selected;sources=data;
 if(parentChanged){closePreparationPacket();requiredPick.context(next&&current?next.token:null,true);magicPick.context(next&&current?next.token:null);}
 get('session-panel').hidden=!current;get('visit-preparation').hidden=!selected;
 if(key===basis)return;
 basis=key;generation++;loadRequest++;closeStoryAward();
 if(timer)clearTimeout(timer);timer=null;
 profileDirty=false;visitDirty=false;view=null;profileDraft=null;visitDraft=null;
 if(parentChanged){closeProposalEditor();get('session-faction-picks').replaceChildren();groupDrafts.clear();previewRequest++;run=null;renderRun();for(const id of ['session-history','session-table-picks','session-locations','session-notes'])get(id).replaceChildren();}
 get('visit-groups').replaceChildren();
 lock(true);get<HTMLButtonElement>('session-refresh').disabled=false;
 if(next&&current)return load();
}
async function load(){
 if(!workspace||!plan)return;
 const token=workspace.token,id=plan.id,gen=generation,request=++loadRequest;
 const current=()=>gen===generation&&request===loadRequest;
 try{
  const [session,progress]=await Promise.all([window.campaign.session(token,id),window.campaign.progress(token)]);
  if(!current())return;
  const result=unwrap(session),characters=unwrap(progress).characters;
  view=result;roster=characters;
  if(!profileDirty)profileDraft=structuredClone(result.profile);
  if(!visitDirty)visitDraft=structuredClone(result.visits.find(v=>v.visitId===visitId)??null);
  render();
  const [tableResult,historyResult,worldResult]=await Promise.all([window.campaign.encounterTables(token,false),window.campaign.sessionRuns(token,id),window.campaign.generationSources(token)]);
  if(!current())return;
  const tableList=unwrap(tableResult),history=unwrap(historyResult),world=unwrap(worldResult);const factions=get('session-faction-picks'),chosenFactions=new Set([...factions.querySelectorAll<HTMLInputElement>('input:checked')].map(c=>c.value));factions.replaceChildren();for(const f of world.factions)checkbox(factions,f.id,f.name,chosenFactions.has(f.id));
  const picks=get('session-table-picks'),selectedTables=new Set([...picks.querySelectorAll<HTMLInputElement>('input:checked')].map(box=>box.value));
  picks.replaceChildren();for(const table of tableList)checkbox(picks,table.id,table.name,selectedTables.has(table.id));
  const select=get<HTMLSelectElement>('session-history');select.replaceChildren();option(select,'','Vorschau auswählen');
  for(const item of history)option(select,item.id,item.seed+' · '+item.count+' Szenen');
  select.value=run?.id??'';
 }catch(error){if(current()){tell((error as Error).message,true);get<HTMLButtonElement>('session-refresh').disabled=false;}}
}
function option(select:HTMLSelectElement,id:string,text:string){const o=document.createElement('option');o.value=id;o.textContent=text;select.append(o);}
function visitInput(detail:VisitDetail){return JSON.stringify([detail.readAloud,detail.noteIds,detail.reward]);}
async function execute(action:SessionAction){
 if(!workspace||pending)return false;
 const owner=workspace,token=owner.token,gen=generation,ownerPlan=action.kind==='profile'?action.profile.planId:action.planId;
 let committed=false;
 pending=(async()=>{
  try{
   if(!await flushBase()||gen!==generation||workspace?.token!==token||plan?.id!==ownerPlan)return false;
   const result=unwrap(await window.campaign.executeSession({commandId:crypto.randomUUID(),campaignId:owner.campaign.id,token,action}));
   committed=true;
   if(gen!==generation)return false;
   view=result;
   if(action.kind==='replace-plan'){
    profileDirty=visitDirty=false;groupDrafts.clear();profileDraft=structuredClone(result.profile);visitDraft=null;run=null;previewRequest++;renderRun();get('session-history').replaceChildren();
    replacement=null;get<HTMLDialogElement>('plan-replacement-dialog').close();
    await refreshBase();if(workspace?.token===token&&plan?.id===ownerPlan)await load();tell('Plan ersetzt. Angenommene Weltinhalte bleiben erhalten.');return true;
   }
   if(action.kind==='profile'){
    const latest=profileDraft;
    profileDirty=!!latest&&JSON.stringify({...latest,revision:action.profile.revision})!==JSON.stringify(action.profile);
    profileDraft=profileDirty?{...latest!,revision:result.profile.revision}:structuredClone(result.profile);
   }else if(!profileDirty)profileDraft=structuredClone(result.profile);
   const confirmed=result.visits.find(v=>v.visitId===visitId)??null;
   if(action.kind==='visit'){
    const latest=visitDraft;
    visitDirty=!!latest&&visitInput(latest)!==visitInput(action.detail);
    visitDraft=visitDirty&&confirmed?{...structuredClone(confirmed),readAloud:latest!.readAloud,noteIds:latest!.noteIds,reward:latest!.reward}:structuredClone(confirmed);
   }else if(!visitDirty)visitDraft=structuredClone(confirmed);
   if(action.kind==='group-content'){
    const latest=groupDrafts.get(action.groupId),confirmed=result.groups.find(g=>g.id===action.groupId);
    if(latest&&confirmed){
     if(latest.title===action.title&&latest.notes===action.notes)groupDrafts.delete(action.groupId);
     else groupDrafts.set(action.groupId,{...latest,revision:confirmed.revision});
    }
   }
   await refreshBase();
   if(gen===generation)render();
   if(workspace?.token===token&&plan?.id===ownerPlan)tell('Spielabend-Inhalte gespeichert.');
   return true;
  }catch(error){
   if(gen===generation){if(committed)render();tell((committed?'Gespeichert; Ansicht konnte nicht aktualisiert werden: ':'')+(error as Error).message,true);}
   return committed;
  }finally{pending=null;lock(!view);}
 })();
 lock(true);return pending;
}
const lockedControls=new WeakMap<HTMLInputElement|HTMLSelectElement|HTMLButtonElement,boolean>();
function lock(on:boolean){
 get<HTMLButtonElement>('plan-replace').disabled=on||!workspace||!plan;
 for(const id of ['session-panel','visit-preparation','plan-replacement-dialog'])for(const c of get(id).querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('input,select,textarea,button')){
  if(on){if(!lockedControls.has(c))lockedControls.set(c,c.disabled);c.disabled=true;}
  else if(lockedControls.has(c)){c.disabled=lockedControls.get(c)!;lockedControls.delete(c);}
 }
 if(!on){
  const reward=visitDraft?.reward,sealed=!!reward?.placedTreasureId||!!reward?.awarded;
  for(const id of ['visit-has-reward','visit-reward-xp','visit-item-add'])get<HTMLInputElement>(id).disabled=sealed;
  for(const control of get('visit-reward-items').querySelectorAll<HTMLInputElement|HTMLButtonElement>('input,button'))control.disabled=sealed;
  get<HTMLButtonElement>('visit-reward-award').disabled=!!reward?.awarded;
  get<HTMLButtonElement>('visit-reward-place').disabled=!!reward?.placedTreasureId;
 }
}
export async function flushSession():Promise<boolean>{
 if(proposalEditorOpen()){tell('Speichere oder schließe den geöffneten Vorschlag zuerst.',true);return false;}
 if(timer)clearTimeout(timer);timer=null;
 if(pending){if(!await pending)return false;return flushSession();}
 if(profileDirty&&profileDraft){if(!await execute({kind:'profile',profile:structuredClone(profileDraft),expectedRevision:profileDraft.revision}))return false;return flushSession();}
 if(visitDirty&&visitDraft&&plan){if(!await execute({kind:'visit',planId:plan.id,detail:structuredClone(visitDraft),expectedRevision:visitDraft.revision}))return false;return flushSession();}
 const group=groupDrafts.values().next().value;
 if(group&&plan){if(!await execute({kind:'group-content',planId:plan.id,groupId:group.id,expectedRevision:group.revision,title:group.title,notes:group.notes}))return false;return flushSession();}
 return true;
}
function scheduleSession(message:string){if(timer)clearTimeout(timer);timer=setTimeout(()=>{void flushSession();},700);tell(message);}
function scheduleVisit(){visitDirty=true;scheduleSession('Besuchseingabe offen.');}
function render(){if(!view||!profileDraft)return;get<HTMLInputElement>('session-fraction').value=profileDraft.adventureDayFraction;get<HTMLInputElement>('session-seed').value=profileDraft.seed;const members=get('session-party');members.replaceChildren();for(const c of roster){const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.value=c.characterId;box.checked=profileDraft.party.some(p=>p.id===c.characterId);box.onchange=()=>{if(!profileDraft)return;profileDraft.party=box.checked?[...profileDraft.party,{id:c.characterId,name:c.name,level:c.xp===null?null:xpLevel(c.xp).level,count:1}]:profileDraft.party.filter(p=>p.id!==c.characterId);profileDirty=true;scheduleSession('Planungseingabe offen.');renderParty();};label.className='check-label';label.append(box,document.createTextNode(c.name+(c.active?' · heute aktiv':' · inaktiv')));members.append(label);}renderParty();
 const locations=get('session-locations'),notes=get('session-notes');const chosenLocations=new Set([...locations.querySelectorAll<HTMLInputElement>('input:checked')].map(c=>c.value)),chosenNotes=new Set([...notes.querySelectorAll<HTMLInputElement>('input:checked')].map(c=>c.value));locations.replaceChildren();notes.replaceChildren();for(const row of sources?.locations.filter(l=>!l.trashed)??[])checkbox(locations,row.document.id,row.document.name,chosenLocations.has(row.document.id));for(const row of sources?.notes.filter(n=>!n.trashed)??[])checkbox(notes,row.note.id,row.note.title,chosenNotes.has(row.note.id));
 if(visitDraft){get<HTMLTextAreaElement>('visit-read-aloud').value=visitDraft.readAloud;const select=get<HTMLSelectElement>('visit-encounter'),old=select.value;select.replaceChildren();option(select,'','Encounter-Vorlage auswählen');for(const e of view.encounters)option(select,e.id,e.name);select.value=old;get<HTMLInputElement>('visit-has-reward').checked=!!visitDraft.reward;get('visit-reward-fields').hidden=!visitDraft.reward;get<HTMLInputElement>('visit-reward-xp').value=String(visitDraft.reward?.poolXp??0);renderRewardItems();const refs=get('visit-note-refs');refs.replaceChildren();for(const row of sources?.notes.filter(n=>!n.trashed)??[]){const box=checkbox(refs,row.note.id,row.note.title,visitDraft.noteIds.includes(row.note.id));box.onchange=()=>{if(!visitDraft)return;visitDraft.noteIds=box.checked?[...visitDraft.noteIds,box.value]:visitDraft.noteIds.filter(id=>id!==box.value);scheduleVisit();};}renderGroups();}
 renderRun();lock(!!pending);
}
function checkbox(root:HTMLElement,id:string,text:string,checked:boolean){const label=document.createElement('label'),box=document.createElement('input');label.className='check-label';box.type='checkbox';box.value=id;box.checked=checked;label.append(box,document.createTextNode(text));root.append(label);return box;}
function renderParty(){const root=get('session-party-levels');root.replaceChildren();for(const p of profileDraft?.party??[]){const row=document.createElement('div');row.className='session-party-row';const name=document.createElement('span'),level=document.createElement('input'),count=document.createElement('input');name.textContent=p.name;level.type='number';level.min='1';level.max='20';level.value=p.level===null?'':String(p.level);level.placeholder='Level';level.setAttribute('aria-label','Planungslevel '+p.name);count.type='number';count.min='1';count.value=String(p.count);count.setAttribute('aria-label','Planungsanzahl '+p.name);level.oninput=()=>{p.level=level.value?Number(level.value):null;profileDirty=true;scheduleSession('Planungseingabe offen.');budget();};count.oninput=()=>{p.count=Number(count.value);profileDirty=true;scheduleSession('Planungseingabe offen.');budget();};row.append(name,level,count);root.append(row);}budget();}
function budget(){try{const party=profileDraft?.party??[],known=party.length&&party.every(p=>Number.isInteger(p.level)&&p.level!>=1&&p.level!<=20&&Number.isSafeInteger(p.count)&&p.count>0);if(!known){get('session-budget').textContent='Manuelle Vorbereitung bleibt möglich. Für die Generierung fehlen bekannte Party-Level.';return;}const daily=party.reduce((n,p)=>n+dailyXp[p.level!-1]!*p.count,0),fraction=Number(exactWeight(value('session-fraction')));get('session-budget').textContent='Tagesbudget '+daily+' angepasste XP · Adventure-Day-Anteil '+value('session-fraction')+' · Planungsbudget '+Math.floor(daily*fraction)+' XP. Aktuelle Party bleibt unverändert.';}catch(error){get('session-budget').textContent=(error as Error).message;}}
function renderRewardItems(){const root=get('visit-reward-items');root.replaceChildren();for(const [index,item]of (visitDraft?.reward?.items??[]).entries()){const row=document.createElement('div');row.className='session-item-row';const name=document.createElement('input'),quantity=document.createElement('input'),cost=document.createElement('input'),remove=document.createElement('button');name.value=item.name;name.placeholder='Gegenstand';quantity.type='number';quantity.min='1';quantity.value=String(item.quantity);cost.value=item.valueGold;cost.placeholder='Gold pro Stück';name.oninput=()=>{item.name=name.value;scheduleVisit();};quantity.oninput=()=>{item.quantity=Number(quantity.value);scheduleVisit();};cost.oninput=()=>{item.valueGold=cost.value;scheduleVisit();};remove.textContent='Entfernen';remove.type='button';remove.onclick=()=>{visitDraft!.reward!.items.splice(index,1);renderRewardItems();scheduleVisit();};row.append(name,quantity,cost,remove);root.append(row);}}
function groupInput(group:PreparedGroup,title:string,notes:string){
 const old=groupDrafts.get(group.id),draft={id:group.id,revision:old?.revision??group.revision,title,notes};
 if(draft.revision===group.revision&&title===group.title&&notes===group.notes)groupDrafts.delete(group.id);
 else groupDrafts.set(group.id,draft);
}
async function placeGroup(owner:PreviewOwner,id:string,selectedVisit:string){
 if(!ownsPreview(owner)||!await flushSession()||!ownsPreview(owner)||visitDraft?.visitId!==selectedVisit)return;
 const group=view?.groups.find(g=>g.id===id),visit=plan?.scenes.find(s=>s.id===selectedVisit);
 const location=sources?.locations.find(l=>l.document.id===visit?.locationId&&!l.trashed);
 if(group&&location)await execute({kind:'place',planId:owner.planId,groupId:id,expectedRevision:group.revision,locationId:location.document.id,expectedLocationRevision:location.revision});
}
async function detachGroup(owner:PreviewOwner,id:string,selectedVisit:string){
 if(!ownsPreview(owner)||!await flushSession()||!ownsPreview(owner)||visitDraft?.visitId!==selectedVisit)return;
 await execute({kind:'detach',planId:owner.planId,visitId:selectedVisit,expectedVisitRevision:visitDraft.revision,groupId:id});
}
function renderGroups(){
 const root=get('visit-groups');root.replaceChildren();
 const owner=previewOwner();if(!owner||!view||!visitDraft)return;
 const selectedVisit=visitDraft.visitId,visit=plan?.scenes.find(s=>s.id===selectedVisit),location=sources?.locations.find(l=>l.document.id===visit?.locationId);
 for(const id of visitDraft.groupIds){
  const g=view.groups.find(g=>g.id===id);if(!g)continue;
  const draft=groupDrafts.get(id)??g,card=document.createElement('article');card.className='session-group-card';
  const title=document.createElement('input'),notes=document.createElement('textarea'),facts=document.createElement('p'),save=document.createElement('button'),place=document.createElement('button'),detach=document.createElement('button');
  title.value=draft.title;title.setAttribute('aria-label','Gruppentitel');notes.value=draft.notes;notes.rows=3;
  const edit=()=>{if(!ownsPreview(owner))return;groupInput(g,title.value,notes.value);scheduleSession('Gruppeneingabe offen.');};
  title.oninput=edit;notes.oninput=edit;
  facts.textContent=g.plan.entries.map(e=>encounterEntryLabel(e,g.plan.sources)).join(', ')+(g.locationId?' · Platziert bei '+(sources?.locations.find(l=>l.document.id===g.locationId)?.document.name??g.locationId):' · Noch nicht platziert');
  save.textContent='Gruppennotizen speichern';save.onclick=()=>{if(!ownsPreview(owner))return;groupInput(g,title.value,notes.value);void flushSession();};
  place.textContent=g.locationId?'An den Besuchsort verschieben':'Am Besuchsort platzieren';place.disabled=!location||location.trashed;
  place.onclick=()=>{void placeGroup(owner,g.id,selectedVisit);};
  detach.textContent='Aus diesem Besuch lösen';detach.onclick=()=>{void detachGroup(owner,g.id,selectedVisit);};
  const buttons=document.createElement('div');buttons.className='toolbar';buttons.append(save,place,detach);card.append(title,notes,facts,buttons);
  for(const actor of g.actors){const button=document.createElement('button');button.textContent=actor.name+' · '+actor.hp+'/'+actor.maxHp+' HP'+(actor.unavailable?' · nicht verfügbar':'');button.onclick=()=>{if(ownsPreview(owner))void openNote(actor.id);};card.append(button);}
  root.append(card);
 }
}
async function acceptProposal(source:SessionRun,index:number){
 const owner=previewOwner(),request=previewRequest;
 if(!owner||run!==source)return;
 try{
  if(!await flushSession()||!ownsPreview(owner)||request!==previewRequest||run!==source)return;
  if(!await execute({kind:'accept-proposal',planId:owner.planId,expectedPlanRevision:plan!.revision,runId:source.id,index}))return;
  if(!ownsPreview(owner)||request!==previewRequest||run!==source)return;
  const accepted=unwrap(await window.campaign.sessionRun(owner.token,source.id));
  if(!ownsPreview(owner)||request!==previewRequest||run!==source)return;
  run=accepted;renderRun();
 }catch(error){if(ownsPreview(owner)&&request===previewRequest)tell((error as Error).message,true);}
}
async function regenerateProposal(source:SessionRun,index:number){
 const owner=previewOwner();if(!owner||run!==source)return;
 const request=++previewRequest,seed=value('session-seed')+'|'+crypto.randomUUID();
 try{
  const replacement=unwrap(await window.campaign.regenerateSessionProposal(owner.token,source.id,index,seed));
  if(!ownsPreview(owner)||request!==previewRequest||run!==source)return;
  run=replacement;renderRun();
 }catch(error){if(ownsPreview(owner)&&request===previewRequest)tell((error as Error).message,true);}
}
async function regenerateReward(source:SessionRun,index:number){const owner=previewOwner();if(!owner||run!==source)return;const request=++previewRequest;try{const next=unwrap(await window.campaign.regenerateSessionReward(owner.token,source.id,index,value('session-seed')+'|reward|'+crypto.randomUUID()));if(!ownsPreview(owner)||request!==previewRequest||run!==source)return;run=next;renderRun();}catch(e){if(ownsPreview(owner))tell((e as Error).message,true);}}
async function rejectProposal(source:SessionRun,index:number){const owner=previewOwner(),p=source.proposals[index];if(!owner||run!==source||!p)return;if(await execute({kind:'reject-proposal',planId:owner.planId,runId:source.id,index,expectedRevision:p.revision??1,rejected:!p.rejected})&&ownsPreview(owner)){run=unwrap(await window.campaign.sessionRun(owner.token,source.id));renderRun();}}
async function selectRun(){
 const owner=previewOwner(),id=value('session-history'),request=++previewRequest;
 run=null;renderRun();if(!owner||!id)return;
 try{
  const selected=unwrap(await window.campaign.sessionRun(owner.token,id));
  if(!ownsPreview(owner)||request!==previewRequest)return;
  run=selected;renderRun();
 }catch(error){if(ownsPreview(owner)&&request===previewRequest)tell((error as Error).message,true);}
}
async function generatePreview(){
 const owner=previewOwner();if(!owner)return;
 const request=++previewRequest;
 try{
  if(!await flushSession()||!ownsPreview(owner)||request!==previewRequest||!view)return;
  const encounter:Omit<GenerationRequest,'party'|'seed'|'count'|'title'>={requiredNpcIds:requiredPick.ids(),includeNpcs:get<HTMLInputElement>('session-npc-mixed').checked,npcOnly:get<HTMLInputElement>('session-npc-only').checked,factionIds:[...get('session-faction-picks').querySelectorAll<HTMLInputElement>('input:checked')].map(c=>c.value),tableIds:[...get('session-table-picks').querySelectorAll<HTMLInputElement>('input:checked')].map(box=>box.value),filters:{text:value('session-monster-filter')},habitat:'',time:'any',difficulty:'weighted',amount:'standard',balance:'neutral',diversity:'neutral'};
  const generated=unwrap(await window.campaign.generateSession(owner.token,{magicPool:magicPick.selection(),compensateMagic:get<HTMLInputElement>('session-magic-compensate').checked,compensateLoot:get<HTMLInputElement>('session-loot-compensate').checked,worldSourcesByLocation:get<HTMLInputElement>('session-world-sources').checked,planId:owner.planId,expectedProfileRevision:view.profile.revision,count:Number(value('session-scene-count')),locationIds:[...get('session-locations').querySelectorAll<HTMLInputElement>('input:checked')].map(c=>c.value),noteIds:[...get('session-notes').querySelectorAll<HTMLInputElement>('input:checked')].map(c=>c.value),encounter}));
  if(!ownsPreview(owner)||request!==previewRequest)return;
  run=generated;renderRun();tell('Spielabend-Vorschau erzeugt. Noch keine Szenen übernommen.');
 }catch(error){if(ownsPreview(owner)&&request===previewRequest)tell((error as Error).message,true);}
}
function gold(copper:string){const n=BigInt(copper),sign=n<0n?'-':'',v=n<0n?-n:n;return sign+(v/100n)+','+(v%100n).toString().padStart(2,'0');}
function renderRun(){
 const root=get('session-preview');root.replaceChildren();if(!run)return;
 const source=run,history=get<HTMLSelectElement>('session-history');if(![...history.options].some(o=>o.value===source.id))option(history,source.id,source.seed+' · '+source.proposals.length+' Szenen');history.value=source.id;const caption=document.createElement('p');caption.textContent='Seed '+source.seed+' · '+source.usedXp+' von '+source.budget+' XP · '+source.proposals.length+' Szenen';root.append(caption);
 if(source.lootGuidance){const g=source.lootGuidance,details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Beuteausgleich · Ziel '+gold(g.targetCopper)+' Gold · Presetrevision '+g.preset.revision;details.append(summary);const facts=document.createElement('p');facts.textContent='Bisher erwartet '+gold(g.expectedBeforeCopper)+' Gold · erhalten '+gold(g.receivedCopper)+' Gold · Basis für neue XP '+gold(g.baselineCopper)+' Gold · kumulierte Differenz '+gold(g.differenceCopper)+' Gold.';details.append(facts);for(const c of g.characters){const p=document.createElement('p');p.textContent=c.name+' · '+c.xp+' bestätigte XP · erhalten '+gold(c.receivedCopper)+' Gold · erwartet nach dem Abend '+gold(c.expectedAfterCopper)+' Gold';details.append(p);}const note=document.createElement('p');note.className='caption';note.textContent='Gespeicherte Empfehlung für '+g.rewardXp+' geplante Belohnungs-XP. Eigene Änderungen bleiben möglich; Begegnungsregeneration ändert Beute nicht automatisch. '+(g.magic?'Magische Gegenstände werden nach Seltenheit gezählt und nicht als Münzwert abgezogen.':'Magische Seltenheiten sind hier kein automatisches Kontingent.');details.append(note);if(g.magic?.pool!==undefined){const p=document.createElement('p');p.textContent='Verbindlicher Gegenstandspool ('+g.magic.pool.length+'): '+(g.magic.pool.map(d=>d.name+' · r'+d.revision).join(', ')||'leer – Magiekontingente bleiben offen');details.append(p);}if(g.magic){const m=g.magic,table=document.createElement('table'),head=document.createElement('tr');for(const label of ['Seltenheit','Erwartet nach dem Abend','Bisher erhalten','Neuer Vorschlag','Bei Erstellung offen']){const th=document.createElement('th');th.textContent=label;head.append(th);}table.append(head);for(const r of budgetRarities){const tr=document.createElement('tr');for(const value of [r,m.expectedAfter[r].toFixed(2),m.received[r],m.target[r],m.missing[r]]){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}table.append(tr);}details.append(table);const rounding=document.createElement('p');rounding.className='caption';rounding.textContent='Kontingente werden einmal für den ganzen Abend kaufmännisch gerundet. Erwartungswerte bleiben als Bruchteile sichtbar. Offene Mengen beziehen sich auf die ursprüngliche Erstellung; spätere Vorschläge zeigen eigene Quellenhinweise.';details.append(rounding);for(const warning of m.warnings){const text=document.createElement('p');text.textContent=warning;details.append(text);}}root.append(details);}
 for(const warning of source.warnings){const p=document.createElement('p');p.textContent=warning;root.append(p);}
 for(const p of source.proposals){
  const card=document.createElement('article');card.className='session-proposal';
  const title=document.createElement('h3'),text=document.createElement('p'),encounter=document.createElement('p'),accept=document.createElement('button'),regenerate=document.createElement('button');
  title.textContent=p.title+(p.rejected?' · verworfen':'');text.textContent=p.notes;
  encounter.textContent=p.encounter.entries.map(e=>encounterEntryLabel(e,p.encounter.sources)).join(', ');
  accept.textContent=p.acceptedVisitId?'Bereits in der Timeline':'Diese Szene in Timeline übernehmen';accept.disabled=!!p.acceptedVisitId||!!p.rejected||!!p.needsEncounterRefresh;
  accept.onclick=()=>{void acceptProposal(source,p.index);};
  regenerate.textContent='Nur diese Begegnung neu erzeugen';regenerate.disabled=!!p.acceptedVisitId;
  regenerate.onclick=()=>{void regenerateProposal(source,p.index);};
  const reward=document.createElement('p');reward.textContent=p.reward?'Belohnung: '+p.reward.poolXp+' Story-XP · '+p.reward.items.map(i=>i.quantity+' × '+i.name).join(', '):'Keine eigene Belohnung vorbereitet.';
  const edit=document.createElement('button');edit.textContent='Inhalte und Belohnung bearbeiten…';edit.disabled=!!p.acceptedVisitId;edit.onclick=()=>{const owner=previewOwner();if(!owner||run!==source||!sources)return;openProposalEditor(p,sources,async value=>{if(!ownsPreview(owner)||run!==source)throw new Error('Vorschlagskontext geändert.');if(!await execute({kind:'edit-proposal',planId:owner.planId,runId:source.id,index:p.index,expectedRevision:p.revision??1,...value}))return false;run=unwrap(await window.campaign.sessionRun(owner.token,source.id));renderRun();return true;},()=>ownsPreview(owner)&&run===source);};
  const loot=document.createElement('button');loot.textContent='Nur Beute neu erzeugen';loot.disabled=!!p.acceptedVisitId||(!p.rewardOrigin&&!source.lootGuidance);loot.onclick=()=>{void regenerateReward(source,p.index);};
  const reject=document.createElement('button');reject.textContent=p.rejected?'Vorschlag wiederherstellen':'Vorschlag verwerfen';reject.disabled=!!p.acceptedVisitId;reject.onclick=()=>{void rejectProposal(source,p.index);};
  card.append(title,text,encounter,reward,edit,accept,regenerate,loot,reject);if(!p.rewardEdited)for(const warning of p.rewardWarnings??[]){const message=document.createElement('p');message.textContent=warning;card.append(message);}if(p.needsEncounterRefresh){const warning=document.createElement('p');warning.textContent='Ort geändert: Begegnung neu erzeugen, damit die Ortsquellen gelten.';card.append(warning);}root.append(card);
 }
}
function closeStoryAward(){
 storyRequest++;storyAward=null;
 const dialog=get<HTMLDialogElement>('story-award-dialog');if(dialog.open)dialog.close();
}
function sameVisit(owner:PreviewOwner,id:string){return ownsPreview(owner)&&visitDraft?.visitId===id;}
async function attachEncounter(){
 const owner=previewOwner(),id=visitDraft?.visitId,encounter=view?.encounters.find(e=>e.id===value('visit-encounter'));
 if(!owner||!id||!encounter)return;
 if(!await flushSession()||!sameVisit(owner,id))return;
 await execute({kind:'attach',planId:owner.planId,visitId:id,expectedVisitRevision:visitDraft!.revision,encounterId:encounter.id,expectedEncounterRevision:encounter.revision});
}
async function placeReward(){
 const owner=previewOwner(),id=visitDraft?.visitId;if(!owner||!id)return;
 if(!await flushSession()||!sameVisit(owner,id))return;
 const visit=plan?.scenes.find(s=>s.id===id),location=sources?.locations.find(l=>l.document.id===visit?.locationId&&!l.trashed);
 if(!location){tell('Der Besuch benötigt einen verfügbaren Ort.',true);return;}
 await execute({kind:'place-reward',planId:owner.planId,visitId:id,expectedVisitRevision:visitDraft!.revision,locationId:location.document.id,expectedLocationRevision:location.revision});
}
async function openStoryAward(){
 const owner=previewOwner(),id=visitDraft?.visitId,request=++storyRequest;if(!owner||!id)return;
 try{
  if(!await flushSession()||!sameVisit(owner,id)||request!==storyRequest||!visitDraft?.reward||visitDraft.reward.awarded)return;
  const draft=visitDraft,reward=draft.reward!;
  const basis:StoryAward={owner,visitId:id,revision:draft.revision,rewardId:reward.id,poolXp:reward.poolXp,characters:[]};
  const progress=unwrap(await window.campaign.progress(owner.token));
  if(!sameVisit(owner,id)||request!==storyRequest)return;
  if(visitDirty||visitDraft!.revision!==basis.revision||visitDraft!.reward?.id!==basis.rewardId){tell('Besuchsbelohnung geändert. Erneut ansehen.',true);return;}
  basis.characters=progress.characters;storyAward=basis;
  get('story-award-source').textContent=(plan?.name||'Unbenannter Plan')+' · '+(plan?.scenes.find(s=>s.id===id)?.title||'Unbenannter Besuch');
  get<HTMLInputElement>('story-no-xp').checked=false;
  const root=get('story-recipients');root.replaceChildren();
  for(const c of basis.characters)checkbox(root,c.characterId,c.name+(c.active?'':' · inaktiv'),c.active);
  get('story-no-xp').oninput=storyPreview;for(const box of root.querySelectorAll<HTMLInputElement>('input'))box.oninput=storyPreview;
  storyPreview();get<HTMLDialogElement>('story-award-dialog').showModal();tell('Belohnungsvorschau geöffnet. Empfänger wählen und bestätigen.');
 }catch(error){if(sameVisit(owner,id)&&request===storyRequest)tell((error as Error).message,true);}
}
async function confirmStoryAward(){
 const basis=storyAward;if(!basis)return;
 if(!sameVisit(basis.owner,basis.visitId)){closeStoryAward();return;}
 try{
  if(visitDirty){tell('Besuchsbelohnung geändert. Erneut ansehen.',true);return;}
  const noXp=get<HTMLInputElement>('story-no-xp').checked;
  const recipients=noXp?[]:[...get('story-recipients').querySelectorAll<HTMLInputElement>('input:checked')].map(box=>{
   const c=basis.characters.find(c=>c.characterId===box.value);if(!c)throw new Error('XP-Empfänger nicht in dieser Vorschau.');
   return{characterId:c.characterId,revision:c.revision};
  });
  if(await execute({kind:'award-reward',planId:basis.owner.planId,visitId:basis.visitId,expectedVisitRevision:basis.revision,recipients,noXp})){
   if(storyAward===basis){closeStoryAward();if(sameVisit(basis.owner,basis.visitId))await load();}
  }
 }catch(error){if(storyAward===basis&&sameVisit(basis.owner,basis.visitId))tell((error as Error).message,true);}
}
let replacement:{owner:PreviewOwner;target:SessionView;source:SessionView|null}|null=null, replacementRequest=0;
async function replacementSource(){
 const preview=replacement;if(!preview)return;const n=++replacementRequest,id=value('plan-replacement-source');get<HTMLButtonElement>('plan-replacement-confirm').disabled=true;
 const source=id?unwrap(await window.campaign.session(preview.owner.token,id)):null;
 if(replacement!==preview||n!==replacementRequest||!ownsPreview(preview.owner))return;
 preview.source=source;get<HTMLInputElement>('plan-replacement-name').value=sources?.plans.find(p=>p.id===id)?.name??'';
 get<HTMLInputElement>('plan-replacement-party').disabled=!source;if(!source)get<HTMLInputElement>('plan-replacement-party').checked=false;
 get('plan-replacement-summary').textContent='Bisher: '+preview.target.visits.length+' Besuche. Danach: '+(source?.visits.length??0)+' Besuche und '+(source?.groups.length??0)+' vorbereitete Gruppen.';
 get<HTMLButtonElement>('plan-replacement-confirm').disabled=false;
}
async function openReplacement(){
 const owner=previewOwner();if(!owner||!await flushSession()||!await flushBase()||!ownsPreview(owner))return;
 const target=unwrap(await window.campaign.session(owner.token,owner.planId));if(!ownsPreview(owner))return;replacement={owner,target,source:null};
 const select=get<HTMLSelectElement>('plan-replacement-source');select.replaceChildren();option(select,'','Leere Timeline');for(const p of sources?.plans??[])option(select,p.id,(p.name||'Unbenannter Plan')+(p.id===owner.planId?' · aktuellen Plan wiederverwenden':''));
 get<HTMLInputElement>('plan-replacement-party').checked=false;await replacementSource();get<HTMLDialogElement>('plan-replacement-dialog').showModal();
}
export async function clearSessionTimeline(){
 const owner=previewOwner();if(!owner||!await flushSession()||!await flushBase()||!ownsPreview(owner)||!plan)return false;
 const target=unwrap(await window.campaign.session(owner.token,owner.planId));if(!ownsPreview(owner)||!target.replacementBasis)return false;
 return execute({kind:'replace-plan',planId:owner.planId,expectedBasis:target.replacementBasis,name:plan.name,sourcePlanId:null,expectedSourceBasis:null,copyParty:false});
}
export function initSession(status:typeof tell,baseFlush:typeof flushBase,baseRefresh:typeof refreshBase,navigateNote:typeof openNote){
 for(const [a,b]of [['session-npc-only','session-npc-mixed'],['session-npc-mixed','session-npc-only']])get(a!).addEventListener('change',()=>{if(get<HTMLInputElement>(a!).checked)get<HTMLInputElement>(b!).checked=false;});
 get('session-magic-compensate').addEventListener('change',()=>{if(get<HTMLInputElement>('session-magic-compensate').checked)get<HTMLInputElement>('session-loot-compensate').checked=true;else magicPick.disable();});get('session-loot-compensate').addEventListener('change',()=>{if(!get<HTMLInputElement>('session-loot-compensate').checked){get<HTMLInputElement>('session-magic-compensate').checked=false;magicPick.disable();}});
initSessionPacket(status,()=>workspace&&plan?{token:workspace.token,planId:plan.id}:null,async()=>await flushBase()&&await flushSession());
initProposalEditor();tell=status;requiredPick=requiredNpcPicker('session-required-npcs',tell);magicPick=magicPoolPicker(tell,()=>{get<HTMLInputElement>('session-magic-compensate').checked=true;get<HTMLInputElement>('session-loot-compensate').checked=true;});flushBase=baseFlush;refreshBase=baseRefresh;openNote=navigateNote;
 const report=(fn:()=>Promise<unknown>)=>void fn().catch(e=>tell(e.message,true));
 get('plan-replace').onclick=()=>report(openReplacement);get('plan-replacement-source').onchange=()=>report(replacementSource);
 get('plan-replacement-cancel').onclick=()=>{replacement=null;replacementRequest++;get<HTMLDialogElement>('plan-replacement-dialog').close();};
 get<HTMLDialogElement>('plan-replacement-dialog').addEventListener('cancel',()=>{replacement=null;replacementRequest++;});
 get('plan-replacement-form').onsubmit=e=>{e.preventDefault();report(async()=>{const preview=replacement;if(!preview||!ownsPreview(preview.owner)||!preview.target.replacementBasis)return;const id=value('plan-replacement-source');if(id&&!preview.source?.replacementBasis)return;await execute({kind:'replace-plan',planId:preview.owner.planId,expectedBasis:preview.target.replacementBasis,name:value('plan-replacement-name'),sourcePlanId:id||null,expectedSourceBasis:preview.source?.replacementBasis??null,copyParty:get<HTMLInputElement>('plan-replacement-party').checked});});};

 for(const id of ['session-fraction','session-seed'])get(id).oninput=()=>{if(profileDraft){profileDraft.adventureDayFraction=value('session-fraction');profileDraft.seed=value('session-seed');profileDirty=true;scheduleSession('Planungseingabe offen.');budget();}};get('session-profile-form').onsubmit=event=>{event.preventDefault();void flushSession();};get('session-free-party').onclick=()=>{if(profileDraft){profileDraft.party.push({id:crypto.randomUUID(),name:'Geplante Figuren',level:null,count:1});profileDirty=true;scheduleSession('Planungseingabe offen.');renderParty();}};
 get('visit-read-aloud').oninput=()=>{if(visitDraft){visitDraft.readAloud=value('visit-read-aloud');scheduleVisit();}};
 get('visit-attach').onclick=()=>{void attachEncounter();};
 get('visit-has-reward').oninput=()=>{if(!visitDraft)return;if(get<HTMLInputElement>('visit-has-reward').checked)visitDraft.reward??={id:crypto.randomUUID(),poolXp:0,items:[],placedTreasureId:null,awarded:false};else visitDraft.reward=null;get('visit-reward-fields').hidden=!visitDraft.reward;scheduleVisit();};
 get('visit-reward-xp').oninput=()=>{if(visitDraft?.reward){visitDraft.reward.poolXp=Number(value('visit-reward-xp'));scheduleVisit();}};
 get('visit-item-add').onclick=()=>{if(visitDraft?.reward){visitDraft.reward.items.push({name:'',quantity:1,valueGold:'0',category:'other'} as ItemInput);renderRewardItems();scheduleVisit();}};
 get('visit-reward-save').onclick=()=>{void flushSession();};
 get('visit-reward-place').onclick=()=>{void placeReward();};
 get('visit-reward-award').onclick=()=>{void openStoryAward();};
 get('story-award-cancel').onclick=closeStoryAward;
 get('story-award-form').onsubmit=event=>{event.preventDefault();void confirmStoryAward();};
 get('session-generate-form').onsubmit=event=>{event.preventDefault();void generatePreview();};
 get('session-refresh').onclick=()=>{void(async()=>{if(!await flushSession())return;await load();})();};
 get('session-history').onchange=()=>{void selectRun();};
}
function storyPreview(){
 const noXp=get<HTMLInputElement>('story-no-xp').checked,count=get('story-recipients').querySelectorAll('input:checked').length;
 try{const result=xpShare(noXp?0:storyAward?.poolXp??0,noXp?0:count);get('story-xp-preview').textContent=noXp?'Keine XP vergeben.':result.share+' XP pro Figur · '+result.total+' XP insgesamt. Beute bleibt zur ausdrücklichen Zuweisung verfügbar.';}
 catch(error){get('story-xp-preview').textContent=(error as Error).message;}
}

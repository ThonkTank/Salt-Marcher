import {encounterEntryLabel} from './encounter-contracts';
import type { Workspace, Result } from './contracts';
import type { Creature, CreatureAction, CreatureCatalogQuery } from '../features/catalog/creature-catalog';
import {creatureActionRolls,type CreatureRollPreset} from './dice-formula';
import { assessEncounter, validateEncounterPlanInput, type EncounterPlan, type CatalogInfo, type CreaturePage } from './encounter-contracts';
import { xpLevel } from './progression';
import { initGeneration, activateGeneration, flushGeneration, generationPlanningChanged, generationCatalogFiltersChanged, generationCreature, refreshGeneration } from './generation-ui';
const get=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const value=(id:string)=>get<HTMLInputElement>(id).value;
const unwrap=<T>(r:Result<T>):T=>{if(!r.ok)throw new Error(r.error);return r.value;};
let workspace:Workspace|null=null,info:CatalogInfo|null=null,page:CreaturePage|null=null,creature:Creature|null=null,plan:EncounterPlan|null=null;
let generation=0,searchRequest=0,listRequest=0,planRequest=0,creatureRequest=0,partyRequest=0,editVersion=0,offset=0,sort:CreatureCatalogQuery['sort']='name',blocked=false,dirty=false;
const owned=(token:string|undefined,g:number)=>generation===g&&workspace?.token===token;
let saving:Promise<boolean>|null=null,timer:ReturnType<typeof setTimeout>|null=null,searchTimer:ReturnType<typeof setTimeout>|null=null;
let tell:(text:string,error?:boolean)=>void,prepare:(plan:EncounterPlan)=>Promise<void>;
let tableLookupQuery:CreatureCatalogQuery|null=null;
function clearSaveTimer(){if(timer)clearTimeout(timer);timer=null;}
function clearSearchTimer(){if(searchTimer)clearTimeout(searchTimer);searchTimer=null;}
function clearResults(text:string,loading=false,error=false){
 page=null;get('catalog-rows').replaceChildren();get('catalog-page').textContent=text;get('catalog-page').setAttribute('role',error?'alert':'status');get('catalog-table').setAttribute('aria-busy',String(loading));get<HTMLButtonElement>('catalog-prev').disabled=true;get<HTMLButtonElement>('catalog-next').disabled=true;
}
function renderCatalogControls(){
 const chips=get('catalog-filter-chips');chips.replaceChildren();
 for(const input of get('catalog-filters').querySelectorAll<HTMLInputElement|HTMLSelectElement>('input,select')){
  if(input.id==='catalog-direction'||!input.value)continue;
  const label=document.querySelector<HTMLLabelElement>('label[for="'+input.id+'"]')?.textContent??input.id;
  const chip=document.createElement('button');chip.type='button';chip.textContent=label+': '+input.value+' ×';chip.setAttribute('aria-label',label+' entfernen');
  chip.onclick=()=>{input.value='';input.oninput?.call(input,new Event('input'));input.focus();};chips.append(chip);
 }
 chips.hidden=!chips.childElementCount;
 for(const button of get('catalog-table').querySelectorAll<HTMLButtonElement>('thead button')){
  const column=button.dataset.sort!,active=column===sort;button.textContent=({name:'Name',cr:'HG',ac:'RK',hp:'HP',xp:'XP'} as Record<string,string>)[column]+(active?(value('catalog-direction')==='desc'?' ↓':' ↑'):'');
  button.parentElement?.setAttribute('aria-sort',active?(value('catalog-direction')==='desc'?'descending':'ascending'):'none');
 }
}
function adoptPlan(next:EncounterPlan,invalidateRequests=true){clearSaveTimer();saving=null;if(invalidateRequests)planRequest++;partyRequest++;editVersion++;plan=next;dirty=next.revision===0;blocked=false;get<HTMLDetailsElement>('encounter-library').open=false;get<HTMLDetailsElement>('encounter-party-details').open=next.party.length===0;renderPlan();}
export function activateCatalog(next:Workspace){
 clearSaveTimer();clearSearchTimer();saving=null;
 workspace=next;generation++;searchRequest++;clearResults('Katalog noch nicht geladen.');listRequest++;planRequest++;creatureRequest++;partyRequest++;
 plan=null;dirty=false;blocked=false;get('catalog-add-result').hidden=true;get<HTMLDetailsElement>('encounter-library').open=true;editVersion++;get('encounter-editor').hidden=true;get<HTMLButtonElement>('catalog-add').disabled=true;
 activateGeneration(next);void refreshPlans();
}
export async function openCatalog(){
 const token=workspace?.token,g=generation,request=searchRequest;
 try{if(!info){const response=await window.campaign.creatureInfo();if(!owned(token,g))return;if(!info){info=unwrap(response);get('catalog-credit').textContent=info.notice;for(const [id,list]of [['catalog-type',info.types],['catalog-size',info.sizes],['catalog-habitat',info.habitats],['catalog-alignment',info.alignments],['catalog-subtype',info.subtypes]] as const)for(const v of list)option(get<HTMLSelectElement>(id),v,v);}}
  await search();if(!owned(token,g))return;if(workspace){await refreshPlans();if(owned(token,g))await refreshGeneration();}
 }catch(error){if(owned(token,g)&&request===searchRequest){clearResults('Katalog konnte nicht geladen werden: '+(error as Error).message,false,true);tell((error as Error).message,true);}}
}
export async function openCatalogReference(ref:{kind:'creature'|'encounter';id:string},stillCurrent=()=>true){const token=workspace?.token,g=generation;if(!stillCurrent())return;await openCatalog();if(!owned(token,g)||!stillCurrent())return;if(ref.kind==='creature')await selectCreature(ref.id);else await loadPlan(ref.id);}
function option(select:HTMLSelectElement,id:string,text:string){const o=document.createElement('option');o.value=id;o.textContent=text;select.append(o);}
function query():CreatureCatalogQuery{
 const q:CreatureCatalogQuery={text:value('catalog-search'),offset,limit:25,sort,direction:value('catalog-direction') as 'asc'|'desc'};
 const fields=q as Record<string,unknown>;for(const [id,key]of [['catalog-cr-min','crMin'],['catalog-cr-max','crMax'],['catalog-ac-min','acMin'],['catalog-ac-max','acMax'],['catalog-hp-min','hpMin'],['catalog-hp-max','hpMax']])if(value(id!))fields[key!]=Number(value(id!));
 for(const [id,key]of [['catalog-type','types'],['catalog-subtype','subtypes'],['catalog-size','sizes'],['catalog-habitat','habitats'],['catalog-alignment','alignments']])if(value(id!))fields[key!]=[value(id!)];
 for(const [id,key]of [['catalog-movement','movement'],['catalog-senses','senses'],['catalog-vulnerabilities','vulnerabilities'],['catalog-resistances','resistances'],['catalog-immunities','immunities'],['catalog-condition-immunities','conditionImmunities']])if(value(id!))fields[key!]=value(id!);return q;
}
// Reuse the catalog controls in the manager, but keep its lookups local to that task.
function beginTableLookup(){
 const token=workspace?.token,g=generation,previousCreature=creature,previousOffset=offset,previousSort=sort;
 const fields=[...get('catalog-form').querySelectorAll<HTMLInputElement|HTMLSelectElement>('input,select')].map(node=>({node,value:node.value}));
 tableLookupQuery=structuredClone(query());creatureRequest++;
 return()=>{
  tableLookupQuery=null;if(!owned(token,g))return;
  clearSearchTimer();searchRequest++;creatureRequest++;offset=previousOffset;sort=previousSort;
  for(const field of fields)field.node.value=field.value;
  creature=previousCreature;const detail=get('catalog-detail');
  if(creature)renderCreatureDetail(detail,creature);else detail.textContent='Wähle eine Kreatur, um ihren vollständigen Statblock anzusehen.';
  get<HTMLButtonElement>('catalog-add').disabled=!creature||!plan||blocked;get<HTMLButtonElement>('catalog-live-add').disabled=!creature||!workspace;
  void search();
 };
}
async function search(){
 renderCatalogControls();clearSearchTimer();const request=++searchRequest,token=workspace?.token,g=generation;clearResults('Kreaturen werden gesucht…',true);
 try{const response=await window.campaign.creatures(query());if(!owned(token,g)||request!==searchRequest)return;page=unwrap(response);renderRows();}
 catch(error){if(owned(token,g)&&request===searchRequest){clearResults('Katalog konnte nicht geladen werden: '+(error as Error).message,false,true);tell((error as Error).message,true);}}
}

function renderRows(){get('catalog-table').setAttribute('aria-busy','false');get('catalog-page').setAttribute('role','status');const body=get('catalog-rows');body.replaceChildren();for(const c of page?.rows??[]){const tr=document.createElement('tr'),td=document.createElement('td'),button=document.createElement('button');button.textContent=c.name;button.setAttribute('aria-pressed',String(creature?.id===c.id));button.onclick=()=>{void selectCreature(c.id);};td.append(button);tr.append(td);for(const text of [c.challengeRating,c.type,c.size,String(c.ac),String(c.hp),String(c.xp)]){const cell=document.createElement('td');cell.textContent=text;tr.append(cell);}body.append(tr);}get('catalog-page').textContent=page?.total?`${page.offset+1}–${Math.min(page.total,page.offset+page.limit)} von ${page.total} Kreaturen`:'Keine Kreaturen für diese Filter.';get<HTMLButtonElement>('catalog-prev').disabled=!page?.offset;get<HTMLButtonElement>('catalog-next').disabled=!page||page.offset+page.limit>=page.total;}
async function selectCreature(id:string){
 const token=workspace?.token,g=generation,request=++creatureRequest;
 try{const response=await window.campaign.creature(id);if(!owned(token,g)||request!==creatureRequest)return;const c=unwrap(response);creature=c;get('catalog-add-result').hidden=true;generationCreature(c);renderCreatureDetail(get('catalog-detail'),c);if(page)renderRows();get<HTMLButtonElement>('catalog-add').disabled=!plan||blocked;get<HTMLButtonElement>('catalog-live-add').disabled=!workspace;}
 catch(error){if(owned(token,g)&&request===creatureRequest)tell((error as Error).message,true);}
}
export function renderCreatureDetail(root:HTMLElement,c:Creature,onRoll?:(action:CreatureAction,preset:CreatureRollPreset)=>void,actionControl?:(action:CreatureAction)=>{disabled:boolean;note:string}|null,onUse?:(action:CreatureAction)=>void){root.replaceChildren();const heading=document.createElement('h3');heading.textContent=c.name;root.append(heading);const line=(name:string,text:string)=>{if(!text)return null;const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=name+': ';p.append(strong,document.createTextNode(text));root.append(p);return p;};line('Art',c.size+' '+c.type+(c.subtype?' ('+c.subtype+')':'')+' · '+c.alignment);line('HG / XP',c.challengeRating+' / '+c.xp);line('Rüstungsklasse / HP',c.ac+' / '+c.hp+' ('+c.hitDice+')');line('Bewegung',c.speed);line('Attribute',Object.entries(c.abilities).map(([k,v])=>k.toUpperCase()+' '+v).join(' · '));line('Rettungswürfe',c.savingThrows);line('Fertigkeiten',c.skills);line('Sinne',c.senses);line('Sprachen',c.languages);line('Verwundbar',c.damageVulnerabilities);line('Resistenzen',c.damageResistances);line('Immunitäten',c.damageImmunities);line('Zustandsimmunitäten',c.conditionImmunities);for(const [title,actions]of [['Eigenschaften',c.traits],['Aktionen',c.actions],['Legendäre Aktionen',c.legendaryActions]] as const){if(!actions.length)continue;const h=document.createElement('h4');h.textContent=title;root.append(h);for(const a of actions){const p=line(a.name,a.description),presets=onRoll?creatureActionRolls(a):[],control=actionControl?.(a)??null;if(p&&(presets.length||control)){const tools=document.createElement('span');tools.className='toolbar statblock-rolls';for(const preset of presets){const button=document.createElement('button');button.type='button';button.textContent=preset.kind==='attack'?'Angriff '+preset.formula:preset.kind==='damage'?'Schaden '+preset.formula:(preset.kind==='save'?'Rettungswurf':'Probe')+' SG '+preset.dc;button.disabled=control?.disabled??false;if(control)button.dataset.statblockDisabled=String(control.disabled);button.onclick=()=>onRoll!(a,preset);tools.append(button);}if(control&&!presets.length&&onUse){const button=document.createElement('button');button.type='button';button.textContent='Einsetzen';button.disabled=control.disabled;button.dataset.statblockDisabled=String(control.disabled);button.onclick=()=>onUse(a);tools.append(button);}if(control){const status=document.createElement('small');status.textContent=control.note;tools.append(status);}p.append(tools);}}}line('Weitere Angaben',c.details);line('Quelle',c.sourceLabel+' · '+c.sourceVersion+' · CC BY 4.0');}
async function refreshPlans(){
 const w=workspace,g=generation,request=++listRequest;if(!w)return;
 try{const response=await window.campaign.encounterPlans(w.token,value('encounter-search'));if(!owned(w.token,g)||request!==listRequest)return;const list=unwrap(response),select=get<HTMLSelectElement>('encounter-list'),old=select.value;select.replaceChildren();option(select,'','Vorlage auswählen');for(const p of list)option(select,p.id,p.name||'Unbenannte Begegnung');select.value=plan?.id??old;}
 catch(error){if(owned(w.token,g)&&request===listRequest)tell((error as Error).message,true);}
}
function save():Promise<boolean>{
 clearSaveTimer();if(saving)return saving;if(!workspace||!plan)return Promise.resolve(true);if(blocked)return Promise.resolve(false);if(!dirty&&plan.revision)return Promise.resolve(true);
 const w=workspace,draft=plan,g=generation;
 const task=Promise.resolve().then(async()=>{
  try{
   while(owned(w.token,g)&&plan===draft&&(dirty||!draft.revision)){
    clearSaveTimer();const version=editVersion,snapshot=structuredClone(draft);
    try{validateEncounterPlanInput(snapshot);assessEncounter(snapshot.party,snapshot.entries.map(e=>({xp:snapshot.sources.find(c=>c.id===e.creatureId)?.xp,count:e.count})));}
    catch(error){tell((error as Error).message,true);return false;}
    const response=await window.campaign.saveEncounterPlan({commandId:crypto.randomUUID(),campaignId:w.campaign.id,token:w.token,plan:snapshot,expectedRevision:snapshot.revision||null});
    if(!owned(w.token,g)||plan!==draft)return false;const saved=unwrap(response);
    draft.revision=saved.revision;draft.catalogHash=saved.catalogHash;
    const sources=new Map([...saved.sources,...draft.sources].map(c=>[c.id,c]));draft.sources=[...sources.values()];
    dirty=editVersion!==version;
   }
   if(!owned(w.token,g)||plan!==draft)return false;tell('Encounter-Vorlage gespeichert.');void refreshPlans();return true;
  }catch(error){if(owned(w.token,g)&&plan===draft){blocked=true;tell((error as Error).message+' Entwurf bleibt offen. Lade den gespeicherten Stand oder erstelle eine Kopie.',true);}return false;}
  finally{if(saving===task)saving=null;}
 });saving=task;return task;
}
async function flushPlan(){const gen=generation;return await save()&&gen===generation;}
export async function flushCatalog(){const gen=generation;if(!await flushGeneration()||gen!==generation)return false;return flushPlan();}
function schedule(){dirty=true;editVersion++;clearSaveTimer();if(!blocked)timer=setTimeout(()=>{timer=null;void save();},700);tell(blocked?'Encounter-Entwurf gesperrt. Gespeicherten Stand laden oder eine Kopie erstellen.':'Encounter-Eingabe offen.');renderAssessment();}
function report(fn:()=>Promise<unknown>){const token=workspace?.token,g=generation;void fn().catch(error=>{if(owned(token,g))tell((error as Error).message,true);});}
async function loadPlan(id:string,reload=false){
 const w=workspace,g=generation,request=++planRequest;if(!w||!id)return;
 try{
  if(!reload&&!await flushCatalog())return;if(!owned(w.token,g)||request!==planRequest)return;
  const source=plan,version=editVersion,response=await window.campaign.encounterPlan(w.token,id);
  if(!owned(w.token,g)||request!==planRequest||plan!==source)return;
  if(version!==editVersion){tell('Neue Eingabe bleibt offen. Vorlage bei Bedarf erneut laden.',true);void refreshPlans();return;}
  adoptPlan(unwrap(response));
 }catch(error){if(owned(w.token,g)&&request===planRequest)tell((error as Error).message,true);}
}
async function newPlan(copy=false){
 const w=workspace,source=plan,g=generation,request=++planRequest;if(!w){tell('Öffne eine Kampagne, um Encounter-Vorlagen zu speichern.',true);return;}if(copy&&!source)return;
 if(copy&&blocked){if(!await flushGeneration())return;}else if(!await flushCatalog())return;
 if(!owned(w.token,g)||request!==planRequest)return;
 const next:EncounterPlan=copy?{...structuredClone(source!),id:crypto.randomUUID(),revision:0,name:source!.name+' (Kopie)',party:source!.party.map(p=>({...p,id:crypto.randomUUID()})),entries:source!.entries.map(e=>({...e,id:crypto.randomUUID()}))}:{id:crypto.randomUUID(),revision:0,name:'Neue Begegnung',notes:'',party:[],entries:[],sources:[],catalogHash:info?.hash??''};
 adoptPlan(next);get('encounter-name').focus();await save();
}
async function currentParty(){
 const w=workspace,source=plan,g=generation,request=++partyRequest;if(!w||!source)return;const party=JSON.stringify(source.party);
 try{const response=await window.campaign.progress(w.token);if(!owned(w.token,g)||plan!==source||request!==partyRequest)return;if(JSON.stringify(source.party)!==party){tell('Neue Partyeingabe bleibt offen. Aktuelle Party bei Bedarf erneut übernehmen.',true);return;}
  const data=unwrap(response);source.party=data.characters.filter(c=>c.active).map(c=>({id:crypto.randomUUID(),name:c.name,level:c.xp===null?null:xpLevel(c.xp).level,count:1}));renderPlan();schedule();if(source.party.length)get<HTMLDetailsElement>('encounter-party-details').open=false;
 }catch(error){if(owned(w.token,g)&&plan===source&&request===partyRequest)tell((error as Error).message,true);}
}

function renderAssessment(){generationPlanningChanged(plan?.party??null);get('encounter-party-summary').textContent='Planungsparty · '+(plan?.party.reduce((n,p)=>n+p.count,0)??0)+' Figuren';try{const assessment=plan?assessEncounter(plan.party,plan.entries.map(e=>({xp:plan!.sources.find(c=>c.id===e.creatureId)?.xp,count:e.count}))):null;get('encounter-assessment').textContent=assessment?assessment.baseXp+' Basis-XP · ×'+assessment.multiplier+' · '+assessment.adjustedXp+' angepasste XP · '+(assessment.difficulty??'Schwierigkeit unbekannt: Party-Level fehlen')+(assessment.partySize?' · '+assessment.partySize+' geplante Figuren':' · Ohne Planungsparty'):'';get('encounter-thresholds').textContent=assessment&&assessment.partySize&&!assessment.unknownLevels?'Schwellen: Leicht '+assessment.thresholds[0]+' · Mittel '+assessment.thresholds[1]+' · Schwer '+assessment.thresholds[2]+' · Tödlich '+assessment.thresholds[3]:'';}catch(error){get('encounter-assessment').textContent=(error as Error).message;get('encounter-thresholds').textContent='';}}
function renderPlan(){get('encounter-editor').hidden=!plan;if(!plan)return;get<HTMLInputElement>('encounter-name').value=plan.name;get<HTMLTextAreaElement>('encounter-notes').value=plan.notes;const party=get('encounter-party');party.replaceChildren();for(const p of plan.party){const row=document.createElement('div');row.className='encounter-party-row';const name=document.createElement('input'),level=document.createElement('input'),count=document.createElement('input'),remove=document.createElement('button');name.value=p.name;name.maxLength=1000;name.setAttribute('aria-label','Geplanter Name');level.type='number';level.min='1';level.max='20';level.value=p.level===null?'':String(p.level);level.placeholder='Level unbekannt';level.setAttribute('aria-label','Geplantes Level');count.type='number';count.min='1';count.max='10000';count.value=String(p.count);count.setAttribute('aria-label','Anzahl geplanter Figuren');remove.textContent='Entfernen';remove.onclick=()=>{plan!.party=plan!.party.filter(c=>c.id!==p.id);renderPlan();schedule();};name.oninput=()=>{p.name=name.value;schedule();};level.oninput=()=>{p.level=level.value?Number(level.value):null;schedule();};count.oninput=()=>{p.count=Number(count.value);schedule();};row.append(name,level,count,remove);party.append(row);}
 const rows=get('encounter-entries');rows.replaceChildren();for(const e of plan.entries){const c=plan.sources.find(c=>c.id===e.creatureId),row=document.createElement('div');row.className='encounter-entry-row';const name=document.createElement('button'),count=document.createElement('input'),label=document.createElement('label'),group=document.createElement('input'),remove=document.createElement('button');name.textContent=(e.worldActorIds?encounterEntryLabel(e,plan.sources):c?.name??e.creatureId)+' · HG '+(c?.challengeRating??'?');name.onclick=()=>{void selectCreature(e.creatureId);};count.type='number';count.min='1';count.max='1000';count.value=String(e.count);count.min=String(Math.max(1,e.worldActorIds?.length??0));count.disabled=!!e.worldActorIds?.length&&e.worldActorIds.length===e.count&&!e.allowAnonymous;count.setAttribute('aria-label','Anzahl '+(c?.name??e.creatureId));count.oninput=()=>{e.count=Number(count.value);schedule();};group.type='checkbox';group.checked=e.grouped;group.onchange=()=>{e.grouped=group.checked;schedule();};label.className='check-label';label.append(group,document.createTextNode('Gemeinsame Initiative'));remove.textContent='Entfernen';remove.onclick=()=>{plan!.entries=plan!.entries.filter(p=>p.id!==e.id);renderPlan();schedule();};row.append(name,count,label,remove);rows.append(row);}renderAssessment();get<HTMLButtonElement>('catalog-add').disabled=!creature||blocked;}
export function initCatalog(status:typeof tell,onPrepare:typeof prepare,onLiveAdd:(creatureId:string,count:number,grouped:boolean)=>Promise<void>){tell=status;prepare=onPrepare;
 initGeneration(status,{plan:async()=>{if(!await flushPlan())return null;return plan?structuredClone(plan):null;},creature:()=>creature,filters:()=>tableLookupQuery??query(),beginTableLookup,info:()=>info,accept:async accepted=>{const gen=generation;if(!await flushPlan()||gen!==generation)return;adoptPlan(accepted,false);await refreshPlans();if(gen===generation)get('encounter-builder').scrollIntoView({block:'start'});}});
 get('catalog-form').onsubmit=event=>{event.preventDefault();offset=0;void search();};
 for(const c of get('catalog-filters').querySelectorAll<HTMLInputElement|HTMLSelectElement>('input,select'))c.oninput=()=>{renderCatalogControls();if(!tableLookupQuery)generationCatalogFiltersChanged();clearSearchTimer();searchRequest++;offset=0;clearResults('Kreaturen werden gesucht…',true);searchTimer=setTimeout(()=>{searchTimer=null;void search();},200);};
 get('catalog-reset').onclick=()=>{const direction=value('catalog-direction');get<HTMLFormElement>('catalog-form').reset();get<HTMLInputElement>('catalog-direction').value=direction;offset=0;if(!tableLookupQuery)generationCatalogFiltersChanged();void search();};get('catalog-prev').onclick=()=>{offset=Math.max(0,offset-25);void search();};get('catalog-next').onclick=()=>{offset+=25;void search();};for(const button of get('catalog-table').querySelectorAll<HTMLButtonElement>('thead button'))button.onclick=()=>{const next=button.dataset.sort as CreatureCatalogQuery['sort'];get<HTMLInputElement>('catalog-direction').value=sort===next&&value('catalog-direction')==='asc'?'desc':'asc';sort=next;offset=0;void search();};
 get('catalog-plan-open').onclick=()=>{get('encounter-builder').scrollIntoView({block:'start'});get<HTMLElement>(plan?'encounter-name':'encounter-new').focus({preventScroll:true});};
 get('catalog-search-open').onclick=()=>{get('catalog-browser').scrollIntoView({block:'start'});get<HTMLInputElement>('catalog-search').focus({preventScroll:true});};
 get('encounter-search').oninput=()=>void refreshPlans();
 get('encounter-list').onchange=()=>{void loadPlan(value('encounter-list'));};
 get('encounter-new').onclick=()=>report(()=>newPlan());
 get('encounter-save').onclick=()=>void save();
 get('encounter-copy').onclick=()=>report(()=>newPlan(true));
 get('encounter-load').onclick=()=>{if(plan?.revision)void loadPlan(plan.id,true);};
 get('encounter-name').oninput=()=>{if(plan){plan.name=value('encounter-name');schedule();}};get('encounter-notes').oninput=()=>{if(plan){plan.notes=value('encounter-notes');schedule();}};
 get('encounter-party-add').onclick=()=>{if(plan){plan.party.push({id:crypto.randomUUID(),name:'Geplante Figur',level:null,count:1});renderPlan();schedule();}};
 get('encounter-party-current').onclick=()=>{void currentParty();};
 get('catalog-add').onclick=()=>{if(!plan||!creature||blocked)return;const count=Number(value('catalog-quantity'));if(!Number.isSafeInteger(count)||count<1||count>1000){tell('Positive ganze Kreaturmenge eingeben.',true);return;}plan.entries.push({id:crypto.randomUUID(),creatureId:creature.id,count,grouped:get<HTMLInputElement>('catalog-grouped').checked});if(!plan.sources.some(c=>c.id===creature!.id))plan.sources.push(creature);renderPlan();schedule();get('catalog-add-result').hidden=false;get('catalog-add-result').textContent=count+' × '+creature.name+' zur Vorlage „'+plan.name+'“ hinzugefügt.';};
 get('catalog-live-add').onclick=()=>{const selected=creature;if(selected)report(()=>onLiveAdd(selected.id,Number(value('catalog-quantity')),get<HTMLInputElement>('catalog-grouped').checked));};
 get('encounter-prepare').onclick=()=>report(async()=>{const w=workspace,source=plan,g=generation,request=planRequest;if(!w||!source)return;if(!await flushCatalog()||!owned(w.token,g)||plan!==source||request!==planRequest)return;await prepare(structuredClone(source));});
}

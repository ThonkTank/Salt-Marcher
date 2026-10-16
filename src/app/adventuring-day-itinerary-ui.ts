import type {Workspace} from './contracts';
import type {DayPlanEntry,DayItinerary} from './adventuring-day-contracts';
import type {DayItineraryDraft} from './adventuring-day-draft';

const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const format=(n:number)=>n.toLocaleString('de-DE');
type Choice={id:string;revision:number;name:string;count:string;restBefore?:'short'|'long'};
let workspace:Workspace|null=null,selected:Choice[]=[],generation=0,timer:ReturnType<typeof setTimeout>|null=null,changed:()=>void;
let manual={load:'0',reward:'0',separate:false};
const enabled=()=>el<HTMLInputElement>('day-use-encounters').checked;
const node=(tag:string,text?:string)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
const button=(label:string,run:()=>void)=>{const b=node('button',label) as HTMLButtonElement;b.type='button';b.onclick=run;return b;};
function notify(){el('day-plan-result').replaceChildren();if(enabled()){el<HTMLInputElement>('day-total-xp').value='';el<HTMLInputElement>('day-reward-xp').value='';}changed();}
function inputs(){
 const on=enabled();el<HTMLInputElement>('day-total-xp').readOnly=on;el<HTMLInputElement>('day-reward-xp').readOnly=on;el<HTMLInputElement>('day-separate-reward').disabled=on;
 el('day-plan-controls').hidden=!on;
}
function renderSelected(){
 const root=el('day-plan-selected');root.replaceChildren();
 selected.forEach((entry,i)=>{
  const row=node('div'),name=node('strong',entry.name),label=node('label','Anzahl'),count=document.createElement('input');row.className='day-plan-row';row.dataset.planId=entry.id;
  count.type='number';count.min='1';count.max='99';count.step='1';count.value=entry.count;count.setAttribute('aria-label','Wiederholungen '+entry.name);
  count.oninput=()=>{entry.count=count.value;notify();};label.append(count);
  const up=button('↑',()=>{[selected[i-1],selected[i]]=[selected[i]!,selected[i-1]!];renderSelected();notify();}),down=button('↓',()=>{[selected[i+1],selected[i]]=[selected[i]!,selected[i+1]!];renderSelected();notify();});
  up.disabled=i===0;down.disabled=i===selected.length-1;up.setAttribute('aria-label',entry.name+' nach oben');down.setAttribute('aria-label',entry.name+' nach unten');
  const restLabel=node('label','Davor'),rest=document.createElement('select');rest.setAttribute('aria-label','Rast vor '+entry.name);
  for(const [value,text]of [['none','Ohne Rast'],['short','Kurze Rast'],['long','Lange Rast']]){const option=document.createElement('option');option.value=value!;option.textContent=text!;rest.append(option);}
  rest.value=entry.restBefore??'none';rest.onchange=()=>{entry.restBefore=rest.value==='none'?undefined:rest.value as 'short'|'long';notify();};restLabel.append(rest);
  const actions=node('div');actions.className='toolbar';actions.append(up,down,button('Entfernen',()=>{selected.splice(i,1);renderSelected();notify();}));row.append(name,label,restLabel,actions);root.append(row);
 });
 if(!selected.length)root.textContent='Noch keine Begegnungen gewählt. Suche gespeicherte Vorlagen und füge sie dem Tagesplan hinzu.';
}
async function search(){
 const owner=workspace,request=++generation;if(!owner)return;
 el('day-plan-search-status').textContent='Vorlagen werden geladen…';
 try{
  const result=await window.campaign.encounterPlans(owner.token,el<HTMLInputElement>('day-plan-search').value);
  if(workspace?.token!==owner.token||request!==generation)return;if(!result.ok)throw new Error(result.error);
  const root=el('day-plan-matches');root.replaceChildren();
  for(const plan of result.value.slice(0,40))root.append(button(plan.name+' · hinzufügen',()=>{
   if(selected.length>=20){el('day-plan-search-status').textContent='Höchstens 20 Planzeilen. Für Wiederholungen die Anzahl ändern.';return;}
   selected.push({...plan,count:'1'});renderSelected();notify();
  }));
  el('day-plan-search-status').textContent=result.value.length>40?'Erste 40 Treffer. Suche genauer, um weitere Vorlagen zu finden.':result.value.length?'Nur gespeicherte Vorlagen. Änderungen im Encounter-Editor zuerst speichern.':'Keine passenden gespeicherten Vorlagen.';
 }catch(error){if(workspace?.token===owner.token&&request===generation){el('day-plan-matches').replaceChildren();el('day-plan-search-status').textContent=(error as Error).message;}}
}
async function reload(){
 const owner=workspace,request=++generation;if(!owner)return;el('day-plan-search-status').textContent='Gewählte Vorlagen werden aktualisiert…';
 try{
  const result=await window.campaign.encounterPlans(owner.token,'');if(workspace?.token!==owner.token||request!==generation)return;if(!result.ok)throw new Error(result.error);
  const versions=new Map(result.value.map(p=>[p.id,p]));
  for(const entry of selected){const latest=versions.get(entry.id);if(!latest)throw new Error('Gewählte Vorlage fehlt: '+entry.name+'. Entfernen oder im Encounter-Editor wiederherstellen.');}
  selected=selected.map(entry=>({...entry,...versions.get(entry.id)!}));renderSelected();notify();void search();
 }catch(error){if(workspace?.token===owner.token&&request===generation)el('day-plan-search-status').textContent=(error as Error).message;}
}
export function dayItineraryRequest():DayPlanEntry[]|undefined{
 return enabled()?selected.map(p=>({id:p.id,revision:p.revision,count:p.count.trim()?Number(p.count):NaN,...(p.restBefore?{restBefore:p.restBefore}:{})})):undefined;
}
export function renderDayItinerary(value:DayItinerary|undefined){
 const root=el('day-plan-result');root.replaceChildren();if(!enabled())return;
 if(!value){el<HTMLInputElement>('day-total-xp').value='';el<HTMLInputElement>('day-reward-xp').value='';return;}
 el<HTMLInputElement>('day-total-xp').value=String(value.totalLoadXp);el<HTMLInputElement>('day-reward-xp').value=String(value.totalRewardXp);
 root.append(node('p',format(value.rawLoadXp)+' angepasste XP / '+format(value.rawRewardXp)+' Basis-XP · '+value.partySize+' Figuren. Jede Begegnung wird einzeln aufgerundet, dann werden die Belastungs- und Verdienstanteile summiert.'));
 root.append(node('p',value.plannedRests.short+' kurze / '+value.plannedRests.long+' lange Rasten geplant · '+(value.pacing?'Start beim bestätigten Raststand der aktiven Party.':'Eigene Levelgruppen starten nach einer langen Rast.')+' Eine Rast gilt für alle Figuren, vor der gesamten Wiederholungszeile. Für Pausen zwischen Wiederholungen mehrere Zeilen verwenden.'));
 const list=node('ol');
 for(const stage of value.stages){const li=node('li');if(stage.restBefore)li.append(node('p',stage.restBefore==='short'?'Davor: kurze Rast':'Davor: lange Rast'));li.append(node('strong',stage.count+' × '+stage.name+' · '+(stage.difficulty??'Schwierigkeit offen')),node('p','Je Begegnung: '+format(stage.adjustedXp)+' Belastungs-XP (×'+stage.multiplier+') / '+format(stage.baseXp)+' Verdienst-XP · '+format(stage.loadShare)+' / '+format(stage.rewardShare)+' je Figur.'));
  li.append(node('p','Bis hier: '+format(stage.cumulativeLoadXp)+' Belastung / '+format(stage.cumulativeRewardXp)+' Verdienst insgesamt.'+(stage.shortDue===null?' Raststand offen.':' Danach: '+stage.shortDue+' Figuren brauchen eine kurze, '+stage.longDue+' eine lange Rast · '+stage.knownRestStates+' / '+value.partySize+' bekannte Raststände.')));list.append(li);
 }root.append(list);
}
export function dayItineraryDraft():DayItineraryDraft {
 return {enabled:enabled(),selected:selected.map(p=>({...p})),manual:enabled()?{...manual}:{load:el<HTMLInputElement>('day-total-xp').value,reward:el<HTMLInputElement>('day-reward-xp').value,separate:el<HTMLInputElement>('day-separate-reward').checked}};
}
export function activateDayItinerary(next:Workspace|null,draft?:DayItineraryDraft){
 workspace=next;generation++;if(timer)clearTimeout(timer);timer=null;selected=[];manual={load:'0',reward:'0',separate:false};el<HTMLInputElement>('day-use-encounters').checked=false;el<HTMLInputElement>('day-plan-search').value='';
 el('day-plan-matches').replaceChildren();el('day-plan-result').replaceChildren();el('day-plan-search-status').textContent='';renderSelected();inputs();
 if(draft){
  selected=draft.selected.map(p=>({...p}));manual={...draft.manual};el<HTMLInputElement>('day-use-encounters').checked=draft.enabled;
  el<HTMLInputElement>('day-total-xp').value=draft.enabled?'':manual.load;el<HTMLInputElement>('day-reward-xp').value=draft.enabled?'':manual.reward;
  el<HTMLInputElement>('day-separate-reward').checked=draft.enabled||manual.separate;
  el<HTMLDetailsElement>('day-plan-panel').open=draft.enabled;renderSelected();inputs();
 }
}
export function refreshDayItineraryChoices(){if(enabled())void search();}
export function initDayItinerary(refresh:()=>void){
 changed=refresh;
 el('day-use-encounters').onchange=()=>{
  if(enabled()){manual={load:el<HTMLInputElement>('day-total-xp').value,reward:el<HTMLInputElement>('day-reward-xp').value,separate:el<HTMLInputElement>('day-separate-reward').checked};el<HTMLInputElement>('day-separate-reward').checked=true;void search();}
  else{el<HTMLInputElement>('day-total-xp').value=manual.load;el<HTMLInputElement>('day-reward-xp').value=manual.reward;el<HTMLInputElement>('day-separate-reward').checked=manual.separate;}
  inputs();notify();
 };
 el('day-plan-search').oninput=()=>{generation++;if(timer)clearTimeout(timer);timer=setTimeout(()=>{timer=null;void search();},150);};
 el('day-plan-reload').onclick=()=>void reload();el('day-plan-clear').onclick=()=>{selected=[];renderSelected();notify();};
}

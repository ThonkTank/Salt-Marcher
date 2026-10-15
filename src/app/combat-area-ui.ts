import type {CombatAction,CombatState} from './combat-contracts';
import type {CreatureAction} from '../features/catalog/creature-catalog';
import {creatureAverageDamage,creatureActionRolls} from './dice-formula';
type AreaAction=Extract<CombatAction,{kind:'area-damage'}>;
const node=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
/** One table decision, one command, one undo. Player rolls remain player rolls. */
export class CombatAreaPanel{
 private combat:CombatState|null=null;private token:string|null=null;private blocked=true;private busy=false;
 private draft:{combatId:string;revision:number;source?:AreaAction['source'];legendary?:AreaAction['legendary'];dc:number|null}|null=null;
 private title=node('h3');private amount=node('input');private rows=node('div');private status=node('p');private apply=node('button','Schaden gemeinsam anwenden');private cancel=node('button','Abbrechen');private party=node('button','Party auswählen');
 constructor(private root:HTMLElement,private execute:(action:CombatAction,revision:number)=>Promise<boolean>){
  root.className='combat-area';root.hidden=true;this.amount.type='number';this.amount.min='1';this.amount.max='1000000';this.amount.step='1';this.amount.id='combat-area-amount';
  const label=node('label','Gemeinsamer Schaden');label.htmlFor=this.amount.id;const tools=node('div');tools.className='toolbar';tools.append(label,this.amount,this.party);this.status.setAttribute('role','status');this.apply.id='combat-area-apply';this.cancel.id='combat-area-cancel';this.rows.id='combat-area-targets';this.apply.type=this.cancel.type=this.party.type='button';
  root.append(this.title,tools,node('p','Spieler würfeln am Tisch? Trage Bestanden oder Fehlgeschlagen direkt beim Ziel ein. Ein gemeinsamer Schadensbetrag wird nur einmal verteilt.'),this.rows,this.status,this.apply,this.cancel);
  this.cancel.onclick=()=>{if(!this.busy){this.draft=null;root.hidden=true;}};this.amount.oninput=()=>this.update();this.party.onclick=()=>{for(const row of this.rows.children){const input=row.querySelector('input')!;input.checked=!!this.combat?.participants.find(p=>p.id===input.value)?.characterId;}this.update();};this.apply.onclick=()=>void this.commit();
 }
 context(combat:CombatState|null,token:string|null,blocked:boolean){
  if(this.token!==token||this.combat?.id!==combat?.id){this.draft=null;this.busy=false;this.root.hidden=true;}
  this.combat=combat;this.token=token;this.blocked=blocked;this.update();
 }
 open(action?:{participantId:string;action:CreatureAction;legendary?:AreaAction['legendary']}){
  const combat=this.combat;if(!combat||this.blocked||!['running','preparing'].includes(combat.phase))return;
  if(this.draft){this.root.scrollIntoView({block:'nearest'});return;}
  const dc=action?creatureActionRolls(action.action).find(p=>p.kind==='save')?.dc??null:null;
  this.draft={combatId:combat.id,revision:combat.revision,dc,...(action?{source:{participantId:action.participantId,actionId:action.action.id},legendary:action.legendary}:{})};
  this.title.textContent=action?combat.participants.find(p=>p.id===action.participantId)?.name+' · '+action.action.name+(dc?' · SG '+dc:' · bestätigter Treffer'):'Flächenschaden';
  this.amount.value=String(action?creatureAverageDamage(action.action)??'':'');this.rows.replaceChildren();
  for(const p of combat.participants){const row=node('div'),label=node('label'),check=node('input'),scale=node('select'),preview=node('span');row.className='combat-area-row';check.type='checkbox';check.value=p.id;check.disabled=p.healthKnown===false;check.setAttribute('aria-label','Ziel '+p.name);label.className='check-label';label.append(check,node('span',p.name+(p.healthKnown===false?' · HP offen':' · '+p.hp+'/'+p.maxHp+' HP')));scale.setAttribute('aria-label','Schaden für '+p.name);
   for(const [value,text]of [['full',dc?'Fehlgeschlagen · voll':'Voll'],['half',dc?'Bestanden · halb':'Halb'],['none','Kein Schaden']]){const option=node('option',text);option.value=value!;scale.append(option);}check.onchange=scale.onchange=()=>this.update();row.append(label,scale,preview);this.rows.append(row);
  }
  this.root.hidden=false;this.update();this.root.scrollIntoView({block:'nearest'});
 }
 private update(){
  if(!this.draft)return;const stale=this.combat?.revision!==this.draft.revision||!this.combat||!['preparing','running'].includes(this.combat.phase),disabled=this.blocked||this.busy||stale,amount=Number(this.amount.value);let count=0;
  for(const row of this.rows.children){const check=row.querySelector('input')!,select=row.querySelector('select')!,preview=row.lastElementChild!;const actor=this.combat?.participants.find(p=>p.id===check.value);check.disabled=disabled||!actor||actor.healthKnown===false;select.disabled=disabled||!check.checked;if(check.checked)count++;const applied=select.value==='half'?Math.floor(amount/2):select.value==='none'?0:amount;preview.textContent=check.checked&&Number.isSafeInteger(applied)&&applied>=0?applied+' Schaden':'';}
  this.amount.disabled=this.party.disabled=disabled;this.cancel.disabled=this.busy||this.blocked;this.apply.disabled=disabled||!count||!this.amount.value||!Number.isSafeInteger(amount)||amount<1||amount>1000000;this.status.textContent=stale?'Kampfstand geändert. Abbrechen und die Aktion mit dem aktuellen Stand neu öffnen.':count+' Ziele · temporäre HP und Konzentration werden berücksichtigt.';
 }
 private async commit(){
  const draft=this.draft;if(!draft||this.apply.disabled)return;
  const targets=[...this.rows.children].filter(row=>row.querySelector('input')!.checked).map(row=>({participantId:row.querySelector('input')!.value,scale:row.querySelector('select')!.value as 'full'|'half'|'none'}));this.busy=true;this.update();
  try{const ok=await this.execute({kind:'area-damage',amount:Number(this.amount.value),targets,...(draft.source?{source:draft.source}:{}),...(draft.legendary?{legendary:draft.legendary}:{})},draft.revision);if(this.draft===draft&&ok){this.draft=null;this.busy=false;this.root.hidden=true;}}
  finally{if(this.draft===draft){this.busy=false;this.update();}}
 }
}

import type {SessionRun,SessionProposal} from './session-contracts';
import type {Preparation} from './preparation-contracts';

const ready=(p:SessionProposal)=>!p.acceptedVisitId&&!p.rejected&&!p.needsEncounterRefresh;
const element=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
const button=(text:string,action:()=>void)=>{const node=element('button',text);node.type='button';node.onclick=action;return node;};
export class SessionReview {
 private selected=new Set<string>();
 private query='';
 private filter='open';
 private rows:{proposal:SessionProposal;card:HTMLElement;box:HTMLInputElement;text:string}[]=[];
 private run:SessionRun|null=null;
 private status=element('p');
 private take=button('Auswahl prüfen…',()=>this.review());
 private dialog=element('dialog');
 private submit=button('Auswahl in Timeline übernehmen',()=>{});
 private busy=false;
 constructor(private accept:(source:SessionRun,picks:SessionProposal[])=>Promise<boolean>){
  this.status.id='session-selection-summary';this.status.setAttribute('aria-live','polite');
  this.take.id='session-review-selection';this.dialog.id='session-selection-dialog';this.dialog.className='session-selection-dialog';
  this.submit.id='session-selection-confirm';
  document.body.append(this.dialog);
 }
 reset(){this.selected.clear();this.query='';this.filter='open';this.run=null;this.rows=[];if(this.dialog.open)this.dialog.close();}
 mount(root:HTMLElement,source:SessionRun){
  if(this.run?.planId!==source.planId)this.reset();
  if(this.run!==source&&this.dialog.open)this.dialog.close();
  this.run=source;this.rows=[];
  const available=new Set(source.proposals.filter(ready).map(p=>p.id));this.selected=new Set([...this.selected].filter(id=>available.has(id)));
  const toolbar=element('div');toolbar.className='session-review-toolbar';
  const search=element('input');search.type='search';search.id='session-proposal-search';search.placeholder='Vorschläge durchsuchen';search.setAttribute('aria-label','Vorschläge durchsuchen');search.value=this.query;
  search.oninput=()=>{this.query=search.value;this.update();};
  const filter=element('select');filter.id='session-proposal-filter';filter.setAttribute('aria-label','Vorschlagsstatus');
  for(const [value,label] of [['open','Offene Vorschläge'],['all','Alle Vorschläge'],['accepted','Übernommen'],['rejected','Verworfen']]){const o=element('option',label);o.value=value!;filter.append(o);}filter.value=this.filter;
  filter.onchange=()=>{this.filter=filter.value;this.update();};
  const select=button('Sichtbare auswählen',()=>{for(const row of this.rows)if(!row.card.hidden&&ready(row.proposal))this.selected.add(row.proposal.id);this.update();});select.id='session-select-visible';
  const clear=button('Auswahl leeren',()=>{this.selected.clear();this.update();});
  toolbar.append(search,filter,select,clear,this.take);root.append(toolbar,this.status);this.update();
 }
 decorate(card:HTMLElement,p:SessionProposal,sources:Preparation|null){
  card.dataset.proposalIndex=String(p.index);
  const label=element('label');label.className='check-label session-proposal-choice';
  const box=element('input');box.type='checkbox';box.disabled=!ready(p);box.dataset.proposalId=p.id;box.setAttribute('aria-label',p.title+' für Timeline auswählen');
  box.onchange=()=>{if(box.checked)this.selected.add(p.id);else this.selected.delete(p.id);this.update();};
  const state=p.acceptedVisitId?'Übernommen':p.rejected?'Verworfen':p.needsEncounterRefresh?'Begegnung erneuern':'Für Timeline auswählen';
  label.append(box,document.createTextNode(state));card.prepend(label);
  const location=sources?.locations.find(l=>l.document.id===p.locationId)?.document.name??(p.locationId?'Ort nicht verfügbar':'Ohne Ortsbindung');
  const refs=p.noteIds.map(id=>sources?.notes.find(n=>n.note.id===id)?.note.title??'Weltverweis nicht verfügbar');
  const facts=element('p',(p.index+1)+'. Besuch · '+location+' · '+p.encounter.assessment.difficulty+' · '+p.encounter.assessment.adjustedXp+' angepasste XP');facts.className='caption';
  const contents=element('details'),summary=element('summary','Vorlesetext und Weltverweise ansehen');contents.append(summary);
  const readAloud=element('p',p.readAloud||'Noch kein Vorlesetext.');readAloud.className='session-proposal-read-aloud';contents.append(readAloud,element('p','Weltverweise: '+(refs.join(', ')||'keine')));
  card.insertBefore(facts,label.nextSibling);card.insertBefore(contents,facts.nextSibling);
  this.rows.push({proposal:p,card,box,text:[p.title,p.notes,p.readAloud,location,...refs,...p.encounter.sources.map(s=>s.name)].join('\n').toLocaleLowerCase()});this.update();
 }
 private update(){
  const q=this.query.trim().toLocaleLowerCase();let visible=0;
  for(const row of this.rows){const p=row.proposal,matches=this.filter==='all'||this.filter==='open'&&!p.acceptedVisitId&&!p.rejected||this.filter==='accepted'&&!!p.acceptedVisitId||this.filter==='rejected'&&!!p.rejected;row.card.hidden=!matches||!!q&&!row.text.includes(q);if(!row.card.hidden)visible++;row.box.checked=this.selected.has(p.id);row.card.classList.toggle('selected',row.box.checked);}
  const picks=this.run?.proposals.filter(p=>this.selected.has(p.id)&&ready(p))??[],xp=picks.reduce((sum,p)=>sum+p.encounter.assessment.adjustedXp,0),rewards=picks.reduce((sum,p)=>sum+(p.reward?.poolXp??0),0),hidden=picks.filter(p=>this.rows.find(r=>r.proposal.id===p.id)?.card.hidden).length;
  this.status.textContent=visible+' angezeigt · '+picks.length+' ausgewählt'+(hidden?' ('+hidden+' außerhalb des Filters)':'')+' · '+xp+' angepasste Begegnungs-XP · '+rewards+' Story-XP vorbereitet.';
  this.take.disabled=this.busy||!picks.length;this.take.textContent=picks.length+' Szenen prüfen…';
 }
 private review(){
  const source=this.run,picks=source?.proposals.filter(p=>this.selected.has(p.id)&&ready(p));if(!source||!picks?.length||this.busy)return;
  this.dialog.replaceChildren(element('h2','Ausgewählten Spielabend übernehmen'),element('p',picks.length+' Besuche werden in dieser Reihenfolge hinten an die Timeline angefügt.'));
  const list=element('ol');for(const p of picks){const row=element('li');row.append(element('strong',p.title),element('p',p.notes||'Keine GM-Notizen.'),element('p',p.encounter.assessment.difficulty+' · '+p.encounter.assessment.adjustedXp+' angepasste XP · '+(p.reward?.poolXp??0)+' Story-XP'));list.append(row);}this.dialog.append(list,element('p','Vorlesetexte, Weltverweise, Begegnungen und vorbereitete Belohnungen werden mit übernommen. Die laufende Gruppe, Weltplatzierungen und Belohnungsvergabe bleiben eigenständige Schritte.'));
  const cancel=button('Zurück zur Auswahl',()=>this.dialog.close()),actions=element('div');actions.className='toolbar';actions.append(cancel,this.submit);this.dialog.append(actions);
  this.submit.disabled=false;
  this.submit.onclick=()=>{if(this.busy||this.run!==source)return;this.busy=true;this.submit.disabled=true;cancel.disabled=true;this.update();void this.accept(source,picks).then(ok=>{if(ok&&this.run?.planId===source.planId){for(const p of picks)this.selected.delete(p.id);this.dialog.close();}}).finally(()=>{this.busy=false;this.submit.disabled=false;cancel.disabled=false;this.update();});};
  this.dialog.showModal();cancel.focus();
 }
}

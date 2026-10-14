import {refreshSceneDeskPins} from './scene-desk-ui';
import type {Workspace,Result} from './contracts';
import type {DeskRef,DeskEntry,DeskContent} from './scene-desk-contracts';
import {renderCreatureDetail} from './catalog-ui';
import {encounterEntryLabel} from './encounter-contracts';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const node=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const unwrap=<T>(r:Result<T>)=>{if(!r.ok)throw new Error(r.error);return r.value;};
type Kind='world'|'creature'|'item'|'encounter';
const kinds:Kind[]=['world','creature','item','encounter'],labels:Record<Kind,string>={world:'Welt und Regeln',creature:'Kreaturen',item:'Gegenstände',encounter:'Begegnungen'};
export interface QuickReferenceAction {kind:'edit'|'read-aloud'|'creature'|'encounter';content:DeskContent;sceneId:string|null;count?:number;grouped?:boolean}
let searching=false;
let workspace:Workspace|null=null,searchRequest=0,contentRequest=0,timer:ReturnType<typeof setTimeout>|null=null,history:DeskRef[]=[],position=-1;
let tell:(s:string,error?:boolean)=>void,drain:()=>Promise<boolean>,handoff:(action:QuickReferenceAction)=>Promise<void>;
const owned=(token:string,n:number)=>workspace?.token===token&&contentRequest===n&&el<HTMLDialogElement>('quick-reference').open;
function button(text:string,action:()=>Promise<unknown>){const b=node('button',text);b.type='button';b.onclick=()=>{b.disabled=true;void action().catch(e=>tell(e.message,true)).finally(()=>{if(b.isConnected)b.disabled=false;});};return b;}
function selectedKinds():Kind[]{const k=el<HTMLSelectElement>('quick-kind').value;return k==='all'?kinds:[k as Kind];}
function invalidate(){searchRequest++;if(timer)clearTimeout(timer);el('quick-results').replaceChildren(node('p','Suche…'));timer=setTimeout(()=>{timer=null;void search();},180);}
async function search(){
 const w=workspace;if(!w)return;const n=++searchRequest,query=el<HTMLInputElement>('quick-search').value,selected=selectedKinds(),root=el('quick-results');root.replaceChildren();searching=true;el('quick-search-status').textContent='Quellen werden gelesen…';
 const current=()=>workspace?.token===w.token&&n===searchRequest&&el<HTMLDialogElement>('quick-reference').open;
 let total=0;const sections=new Map<Kind,HTMLElement>();for(const kind of selected){const section=node('section');section.append(node('h3',labels[kind]));sections.set(kind,section);root.append(section);}
 // At most two requests at once; each source returns one bounded page.
 for(let start=0;start<selected.length;start+=2){await Promise.all(selected.slice(start,start+2).map(async kind=>{
  const section=sections.get(kind)!;try{const r=unwrap(await window.campaign.searchDesk(w.token,kind,query,0));if(!current())return;total+=r.entries.length;appendResults(section,r.entries);if(!r.entries.length)section.append(node('p','Keine Treffer.'));if(r.notice)section.append(node('p',r.notice));if(r.next!==null)more(section,kind,query,r.next,w.token,n);
  }catch(e){if(current())section.append(node('p',(e as Error).message));}
 }));if(!current())return;}
 if(current()){searching=false;el('quick-search-status').textContent=total+' Treffer geladen · weitere je Quelle nachladen';}
}
function appendResults(section:HTMLElement,entries:DeskEntry[]){for(const entry of entries){const b=button(entry.title,()=>openContent(entry.ref));b.dataset.refKind=entry.ref.kind;b.dataset.refId=entry.ref.id;b.append(node('span',entry.label));section.append(b);}}
function more(section:HTMLElement,kind:Kind,query:string,offset:number,token:string,n:number){const b=button('Weitere '+labels[kind],async()=>{const r=unwrap(await window.campaign.searchDesk(token,kind,query,offset));if(workspace?.token!==token||searchRequest!==n||!el<HTMLDialogElement>('quick-reference').open)return;b.remove();appendResults(section,r.entries);if(r.next!==null)more(section,kind,query,r.next,token,n);});b.className='quick-more';section.append(b);}
function historyButtons(){el<HTMLButtonElement>('quick-back').disabled=position<=0;el<HTMLButtonElement>('quick-forward').disabled=position<0||position>=history.length-1;}
async function openContent(ref:DeskRef,remember=true){
 const w=workspace;if(!w)return;const n=++contentRequest,root=el('quick-document');root.replaceChildren(node('p','Inhalt wird gelesen…'));historyButtons();
 try{const c=unwrap(await window.campaign.deskContent(w.token,ref));if(!owned(w.token,n))return;
  if(remember){history=history.slice(0,position+1);if(history.at(-1)?.kind!==ref.kind||history.at(-1)?.id!==ref.id)history.push(ref);position=history.length-1;}historyButtons();
  root.replaceChildren(node('h2',c.title),node('p',c.label+' · Revision '+c.revision+(c.unavailable?' · Nicht verfügbar':'')));const actions=node('div');actions.className='toolbar';root.append(actions);
  const text=(title:string,value:string,publicText=false)=>{if(!value)return;const section=node('section');section.append(node('h3',title));const p=node('p',value);p.className=publicText?'quick-read-aloud':'quick-text';section.append(p);root.append(section);};
  if(c.note){text('Zum Vorlesen',c.note.readAloud,true);text('Notizen für die Spielleitung',c.note.gmNotes);if(c.links?.length){const links=node('section');links.append(node('h3','Verknüpfte Weltinhalte'));for(const link of c.links){const b=button(link.label+' → '+link.entry.title,()=>openContent(link.entry.ref));b.disabled=!!link.entry.unavailable;links.append(b);}root.append(links);}}
  if(c.location)for(const s of c.location.sections)text(s.title,s.markdown);
  if(c.creature){const detail=node('section');root.append(detail);renderCreatureDetail(detail,c.creature);}
  if(c.item){const i=c.item;const value=i.unitCopper===null?'Wert offen':(BigInt(i.unitCopper)/100n)+','+(BigInt(i.unitCopper)%100n).toString().padStart(2,'0')+' GM';text('Gegenstand',i.category+' · '+value+(i.weightText?' · '+i.weightText:'')+(i.magic?' · magisch · '+i.rarity+' · Einstimmung '+i.attunement:''));text('Eigenschaften',i.properties.join(', '));text('Beschreibung',i.description);text('Quelle',i.source.label+(i.source.license?'\n'+i.source.license:''));}
  if(c.encounter){text('Begegnung',c.encounter.notes);text('Teilnehmer',c.encounter.entries.map(e=>encounterEntryLabel(e,c.encounter!.sources)).join('\n'));}
  const fresh=async()=>{if(!owned(w.token,n))throw new Error('Lesekontext geändert.');const now=unwrap(await window.campaign.deskContent(w.token,ref));if(!owned(w.token,n)||now.revision!==c.revision||now.unavailable)throw new Error('Inhalt geändert oder nicht verfügbar. Erneut ansehen.');return now;};
  const use=async(kind:QuickReferenceAction['kind'],sceneId:string|null,count?:number,grouped?:boolean)=>{const current=await fresh();if(!await drain()||!owned(w.token,n))return;el<HTMLDialogElement>('quick-reference').close();contentRequest++;searchRequest++;await handoff({kind,content:current,sceneId,count,grouped});};
  if(!c.unavailable&&(c.note||c.location))actions.append(button('Texte und Verweise bearbeiten…',()=>use('edit',null)));
  const live=unwrap(await window.campaign.live(w.token));if(!owned(w.token,n))return;const scene=live.scene;if(!scene||c.unavailable)return;
  const desk=unwrap(await window.campaign.sceneDesk(w.token,scene.id));if(!owned(w.token,n))return;let pinned=desk.pins.some(p=>p.ref.kind===ref.kind&&p.ref.id===ref.id),deskRevision=desk.revision;
  const pin=button('',async()=>{await fresh();const current=unwrap(await window.campaign.live(w.token));if(!owned(w.token,n)||current.focusId!==scene.id||current.focusRevision!==live.focusRevision)throw new Error('Fokusgruppe geändert. Inhalt erneut ansehen.');const result=unwrap(await window.campaign.pinSceneDesk(w.token,scene.id,deskRevision,ref,!pinned));if(!owned(w.token,n))return;pinned=result.pins.some(p=>p.ref.kind===ref.kind&&p.ref.id===ref.id);deskRevision=result.revision;pin.textContent=pinLabel();await refreshSceneDeskPins(scene.id);tell(pinned?'Inhalt am Szenentisch angeheftet.':'Inhalt vom Szenentisch gelöst.');});
  const pinLabel=()=> (pinned?'Vom Szenentisch lösen: ':'Am Szenentisch anheften: ')+(scene.title||'Gruppe');pin.textContent=pinLabel();pin.id='quick-pin';actions.append(pin);
  if(c.note?.readAloud.trim()){const b=button('Vorlesetext in „'+(scene.title||'Gruppe')+'“ übernehmen',()=>use('read-aloud',scene.id));b.id='quick-use-read-aloud';actions.append(b);}
  if(c.encounter)actions.append(button('Begegnung am Spieltisch vorbereiten…',()=>use('encounter',scene.id)));
  if(c.creature){const count=node('input');count.type='number';count.required=true;count.min='1';count.step='1';count.value='1';count.setAttribute('aria-label','Anzahl Kreaturen');const label=node('label','Anzahl ');label.append(count);const group=node('input');group.type='checkbox';const groupLabel=node('label',' Gemeinsame Initiative');groupLabel.prepend(group);groupLabel.className='check-label';const b=button('Kreaturen am Spieltisch vorbereiten…',async()=>{if(!count.reportValidity()||!Number.isSafeInteger(Number(count.value)))return;await use('creature',scene.id,Number(count.value),group.checked);});actions.append(label,groupLabel,b);}
 }catch(e){if(owned(w.token,n)){root.append(node('p',(e as Error).message));tell((e as Error).message,true);}}
}
function close(){searchRequest++;contentRequest++;if(timer)clearTimeout(timer);el<HTMLDialogElement>('quick-reference').close();}
export function activateQuickReference(w:Workspace){close();workspace=w;history=[];position=-1;el('quick-document').replaceChildren(node('p','Wähle einen Treffer.'));el('quick-results').replaceChildren();el<HTMLInputElement>('quick-search').value='';el<HTMLSelectElement>('quick-kind').value='all';el<HTMLButtonElement>('quick-reference-open').disabled=false;historyButtons();}
export function initQuickReference(status:typeof tell,flush:typeof drain,use:typeof handoff){
 tell=status;drain=flush;handoff=use;const shortcut=node('button','Schnellsuche');shortcut.id='quick-reference-open';shortcut.type='button';shortcut.disabled=true;shortcut.title='Schnellsuche · Strg+K';el('narrative-journal-open').after(shortcut);
 const dialog=node('dialog');dialog.id='quick-reference';dialog.innerHTML='<div class="toolbar"><h2>GM-Schnellsuche</h2><button id="quick-back" type="button" disabled>Zurück</button><button id="quick-forward" type="button" disabled>Vorwärts</button><button id="quick-refresh" type="button">Inhalt aktualisieren</button><button id="quick-close" type="button">Schließen</button></div><p>Private GM-Referenz. Lesen und Anheften verändern keine Zeit oder Belohnungen. Übergaben an den Spieltisch bestätigst du ausdrücklich.</p><div class="quick-columns"><section class="quick-index"><form id="quick-search-form"><label for="quick-search">Inhalte suchen</label><input id="quick-search" type="search" maxlength="1000" placeholder="Name, Ort, Regel oder Beschreibung"><label for="quick-kind">Quellen</label><select id="quick-kind"><option value="all">Alle Quellen</option><option value="world">Welt und Regeln</option><option value="creature">Kreaturen</option><option value="item">Gegenstände</option><option value="encounter">Begegnungen</option></select></form><p id="quick-search-status" role="status"></p><div id="quick-results"></div></section><article id="quick-document"><p>Wähle einen Treffer.</p></article></div>';document.body.append(dialog);
 async function open(){if(!workspace)return;if(document.querySelector('dialog:modal:not(#quick-reference)'))return;if(dialog.open){el<HTMLInputElement>('quick-search').select();return;}const token=workspace.token;if(!await drain()||workspace?.token!==token)return;dialog.showModal();el<HTMLInputElement>('quick-search').focus();void search();if(position>=0)void openContent(history[position]!,false);}
 shortcut.onclick=()=>void open().catch(e=>tell(e.message,true));el('quick-close').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 el('quick-search').oninput=invalidate;el('quick-kind').onchange=invalidate;
 el<HTMLFormElement>('quick-search-form').onsubmit=e=>{e.preventDefault();const first=()=>document.querySelector<HTMLButtonElement>('#quick-results button:not(.quick-more)')?.click();if(timer||searching){if(timer)clearTimeout(timer);timer=null;const token=workspace?.token,q=el<HTMLInputElement>('quick-search').value,k=el<HTMLSelectElement>('quick-kind').value;void search().then(()=>{if(workspace?.token===token&&dialog.open&&el<HTMLInputElement>('quick-search').value===q&&el<HTMLSelectElement>('quick-kind').value===k)first();});}else first();};
 el('quick-back').onclick=()=>{if(position>0)void openContent(history[--position]!,false);};el('quick-forward').onclick=()=>{if(position<history.length-1)void openContent(history[++position]!,false);};
 el('quick-refresh').onclick=()=>{if(position>=0)void openContent(history[position]!,false);};
 document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='k'&&!e.isComposing&&workspace){e.preventDefault();void open().catch(error=>tell(error.message,true));}});
}

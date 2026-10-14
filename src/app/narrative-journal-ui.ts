import type {Workspace} from './contracts';
import type {NarrativeJournalEntry,NarrativeJournalQuery} from './narrative-journal-contracts';
import {showNarrative,flushNarrative,captureNarrativeOwner} from './narrative-ui';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const node=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
let workspace:Workspace|null=null,entries:NarrativeJournalEntry[]=[],selected:string|null=null,next:string|null=null,request=0,detailRequest=0,queryTimer:ReturnType<typeof setTimeout>|null=null;
let resumeOwner:(()=>Promise<void>)|null=null;
let tell:(s:string,error?:boolean)=>void,drain:()=>Promise<boolean>,ownerDrain:()=>Promise<boolean>,editNote:(id:string)=>Promise<void>;
function query(after:string|null):NarrativeJournalQuery{return{search:el<HTMLInputElement>('journal-search').value,kind:el<HTMLSelectElement>('journal-kind').value as NarrativeJournalQuery['kind'],status:el<HTMLSelectElement>('journal-status').value as NarrativeJournalQuery['status'],after};}
async function loadPage(after:string|null=null){
 const w=workspace;if(!w||!el<HTMLDialogElement>('narrative-journal').open)return;const n=++request,q=query(after),criteria=JSON.stringify({...q,after:null});
 const current=()=>workspace?.token===w.token&&n===request&&el<HTMLDialogElement>('narrative-journal').open&&criteria===JSON.stringify(query(null));
 if(after===null)clearList();
 el<HTMLButtonElement>('journal-more').disabled=true;el('journal-list-status').textContent='Aufträge werden gelesen…';
 try{const r=await window.campaign.narrativeJournal(w.token,q);if(!current())return;if(!r.ok)throw new Error(r.error);
  entries=after?[...entries,...r.value.entries.filter(e=>!entries.some(p=>p.note.id===e.note.id))]:r.value.entries;next=r.value.next;
  el('journal-counts').textContent=r.value.counts.open+' offen · '+r.value.counts.closed+' geschlossen';renderList();
 }catch(e){if(current())el('journal-list-status').textContent=(e as Error).message;}
 finally{if(current())el<HTMLButtonElement>('journal-more').disabled=false;}
}
function clearList(){entries=[];next=null;el('journal-counts').replaceChildren();renderList();}
function cancelQuery(){if(queryTimer)clearTimeout(queryTimer);queryTimer=null;}
function renderList(){const root=el('journal-list'),token=workspace?.token,criteria=JSON.stringify(query(null));root.replaceChildren();
 for(const entry of entries){const b=node('button');b.type='button';b.dataset.noteId=entry.note.id;b.setAttribute('aria-pressed',String(entry.note.id===selected));b.append(node('strong',entry.note.title),node('span',(entry.note.kind==='quest'?'Quest':'Gerücht')+' · '+(entry.view.state.status==='closed'?'Geschlossen':'Offen')+(entry.view.award?' · Belohnung vergeben':'')+(entry.view.draft?' · Eingabe gesichert':'')));b.onclick=()=>{if(workspace?.token!==token||criteria!==JSON.stringify(query(null))||!el<HTMLDialogElement>('narrative-journal').open||!root.contains(b))return;void selectEntry(entry).catch(e=>{if(workspace?.token===token)tell(e.message,true);});};root.append(b);}
 el('journal-list-status').textContent=entries.length+' angezeigt'+(selected&&!entries.some(e=>e.note.id===selected)?' · Der geöffnete Auftrag bleibt rechts sichtbar.':'');el('journal-more').hidden=!next;
}
async function selectEntry(entry:NarrativeJournalEntry){
 const w=workspace,n=++detailRequest;if(!w||!await flushNarrative()||n!==detailRequest||workspace?.token!==w.token||!el<HTMLDialogElement>('narrative-journal').open)return;selected=entry.note.id;renderList();
 const root=el('journal-document');root.replaceChildren(node('h2',entry.note.title));
 const facts=node('p',(entry.note.kind==='quest'?'Quest':'Gerücht')+(entry.locationName?' · '+entry.locationName:'')+(entry.contributorNames.length?' · Mitwirkende: '+entry.contributorNames.join(', '):''));root.append(facts);
 if(entry.note.readAloud.trim()){const publicText=node('p',entry.note.readAloud);publicText.className='journal-read-aloud';root.append(node('h3','Zum Vorlesen'),publicText);}
 const notes=node('p',entry.note.gmNotes||'Keine GM-Notizen.');notes.className='journal-gm-notes';root.append(node('h3','Notizen für die Spielleitung'),notes);
 if(entry.note.relations.length){const details=node('details');details.append(node('summary','Weltverweise'));for(const relation of entry.note.relations){const b=node('button',relation.label+' → Weltinhalt öffnen');b.type='button';b.onclick=()=>{if(workspace?.token===w.token&&root.contains(b)&&el<HTMLDialogElement>('narrative-journal').open)void navigate(relation.targetId);};details.append(b);}root.append(details);}
 const edit=node('button','Texte und Weltverweise bearbeiten…');edit.type='button';edit.onclick=()=>{if(workspace?.token===w.token&&root.contains(edit)&&el<HTMLDialogElement>('narrative-journal').open)void navigate(entry.note.id);};root.append(edit);
 await showNarrative(w,entry.note,false,ownerDrain,tell,el('journal-narrative-editor'),()=>{void loadPage();});
}
async function navigate(id:string){const token=workspace?.token;if(!await closeJournal()||workspace?.token!==token)return;await editNote(id);}
function clearDetail(){selected=null;el('journal-document').replaceChildren(node('p','Wähle links einen Auftrag.'));el('journal-narrative-editor').hidden=true;}
async function closeJournal(){
 const token=workspace?.token;if(!token||!await flushNarrative()||workspace?.token!==token)return false;
 cancelQuery();request++;detailRequest++;el<HTMLDialogElement>('narrative-journal').close();
 const resume=resumeOwner;resumeOwner=null;
 await showNarrative(null,null,true,ownerDrain,tell,el('journal-narrative-editor'));
 if(workspace?.token!==token||el<HTMLDialogElement>('narrative-journal').open)return true;
 clearDetail();if(resume)await resume();return true;
}
export function activateNarrativeJournal(w:Workspace){cancelQuery();workspace=w;resumeOwner=null;request++;detailRequest++;entries=[];selected=null;next=null;clearDetail();const dialog=el<HTMLDialogElement>('narrative-journal');if(dialog.open){dialog.close();void showNarrative(null,null,true,ownerDrain,tell,el('journal-narrative-editor'));}}
export function initNarrativeJournal(status:typeof tell,flush:typeof drain,flushOwner:typeof ownerDrain,openNote:typeof editNote){
 tell=status;drain=flush;ownerDrain=flushOwner;editNote=openNote;
 const button=node('button','Aufträge und Gerüchte');button.id='narrative-journal-open';button.type='button';button.disabled=true;el('party-shortcut').after(button);
 const dialog=node('dialog');dialog.id='narrative-journal';dialog.innerHTML='<div class="toolbar"><h2>Aufträge und Gerüchte</h2><button id="journal-refresh" type="button">Aktualisieren</button><button id="journal-close" type="button">Schließen</button></div><p>Private GM-Notizen und bestätigte Ergebnisse. Belohnungen ausdrücklich über den bestehenden Abschluss vergeben.</p><div class="journal-columns"><section class="journal-index"><label for="journal-search">Im Journal suchen</label><input id="journal-search" type="search" maxlength="1000" placeholder="Titel, Notizen, Vorlesetext oder Ergebnis"><div class="toolbar"><select id="journal-kind" aria-label="Auftragsart"><option value="all">Quests und Gerüchte</option><option value="quest">Quests</option><option value="rumor">Gerüchte</option></select><select id="journal-status" aria-label="Auftragsstatus"><option value="open">Offen</option><option value="all">Alle</option><option value="closed">Geschlossen</option></select></div><p id="journal-counts"></p><p id="journal-list-status" role="status"></p><div id="journal-list"></div><button id="journal-more" type="button" hidden>Weitere Aufträge</button></section><section class="journal-reading"><article id="journal-document"><p>Wähle links einen Auftrag.</p></article><section id="journal-narrative-editor" hidden></section></section></div>';document.body.append(dialog);
 button.onclick=()=>{void(async()=>{const w=workspace;if(!w||!await drain()||workspace?.token!==w.token)return;resumeOwner=captureNarrativeOwner();dialog.showModal();await loadPage();})().catch(e=>tell(e.message,true));};
 el('journal-close').onclick=()=>void closeJournal();dialog.addEventListener('cancel',e=>{e.preventDefault();void closeJournal();});
 el('journal-refresh').onclick=()=>{void(async()=>{if(await flushNarrative())await loadPage();})().catch(e=>tell(e.message,true));};
 el('journal-more').onclick=()=>void loadPage(next);
 el('journal-search').oninput=()=>{cancelQuery();request++;clearList();el('journal-list-status').textContent='Aufträge werden gelesen…';queryTimer=setTimeout(()=>{queryTimer=null;void loadPage();},200);};
 for(const id of ['journal-kind','journal-status'])el(id).onchange=()=>void loadPage();
}

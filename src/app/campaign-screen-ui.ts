import {bindAnchoredPopup} from './anchored-popup';
import type {CampaignCatalogCommand,CampaignCatalogReceipt,CampaignOverview} from './campaign-contracts';
import type {Result} from './contracts';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const unwrap=<T>(r:Result<T>)=>{if(!r.ok)throw new Error(r.error);return r.value;};
let applicationPopup:ReturnType<typeof bindAnchoredPopup>|null=null;
const closeApplicationMenu=()=>{if(el('application-trigger').getAttribute('aria-expanded')==='true')applicationPopup?.close();};
const pendingKey='campaign-catalog-pending';
let storageNotice='';
let before:()=>Promise<boolean>,enter:(receipt:CampaignCatalogReceipt)=>Promise<boolean>,changed:()=>Promise<void>;
let campaigns:CampaignOverview[]=[],activeId:string|null=null,busy=false,pending:CampaignCatalogCommand|null=null,editing:CampaignOverview|null=null,erasing:CampaignOverview|null=null,entry:CampaignCatalogReceipt|null=null,request=0;
const dialog=(id:string)=>el<HTMLDialogElement>(id);
function message(text:string){if(storageNotice)text+=' '+storageNotice;el('campaign-screen-status').textContent=text;el('campaign-identity-status').textContent=text;el('campaign-trash-status').textContent=text;el('campaign-delete-status').textContent=text;}
const readyMessage=()=>message(pending?'Ein Kampagnenauftrag wartet auf Statusprüfung.':'Kampagne wählen, um den Spieltisch zu öffnen.');
function lock(){for(const root of ['campaign-screen','campaign-identity-dialog','campaign-trash-dialog','campaign-delete-dialog'])for(const b of el(root).querySelectorAll<HTMLButtonElement|HTMLInputElement>('button,input'))b.disabled=busy||!!pending;for(const b of document.querySelectorAll<HTMLButtonElement>('[data-catalog-check]')){b.hidden=!pending;b.disabled=busy;}el<HTMLButtonElement>('campaign-load-retry').hidden=!entry;el<HTMLButtonElement>('campaign-load-retry').disabled=busy||!!pending;}
const button=(text:string,run:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=run;return b;};
const date=(s:string|null)=>s?new Date(s).toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'}):'nicht bekannt';
async function refresh(){
 const n=++request,lists=['campaign-screen-list','campaign-trash-list'];
 // A previous catalog may belong to a different active identity. Do not leave
 // its opening, editing or deletion actions available during a new read.
 for(const id of lists){el(id).replaceChildren();el(id).textContent='Kampagnen werden geladen…';el(id).setAttribute('aria-busy','true');}
 el('campaign-trash-open').textContent='Papierkorb (…)';
 try{
  const [rows,list]=await Promise.all([window.campaign.campaignOverview(),window.campaign.list()]);
  if(n!==request)return false;campaigns=unwrap(rows);activeId=unwrap(list).activeId;draw();return true;
 }catch(error){
  if(n!==request)return false;
  for(const id of lists)el(id).textContent='Liste konnte nicht geladen werden. Bitte aktualisieren.';
  throw error;
 }finally{if(n===request)for(const id of lists)el(id).setAttribute('aria-busy','false');}
}
function draw(){
 const root=el('campaign-screen-list'),trash=el('campaign-trash-list');root.replaceChildren();trash.replaceChildren();
 for(const c of campaigns){const card=document.createElement('article'),h=document.createElement('h3'),facts=document.createElement('p'),time=document.createElement('p'),actions=document.createElement('div');card.className='campaign-card';card.dataset.campaignId=c.id;h.textContent=c.name+(c.id===activeId?' · aktiv':'');facts.textContent=c.rooms+(c.rooms===1?' Raum':' Räume')+' · '+c.locations+(c.locations===1?' Ort':' Orte')+' · '+c.characters+(c.characters===1?' Charakter':' Charaktere');if(c.notes){facts.append(' · '+c.notes+(c.notes===1?' Wissenseintrag':' Wissenseinträge'));facts.title='Wissenseinträge umfassen NSCs, Fraktionen, Quests und weitere Notizen einschließlich Papierkorbeinträgen.';}if(c.maps)facts.append(' · '+c.maps+(c.maps===1?' Karte':' Karten'));time.className='caption';time.textContent='Zuletzt geöffnet: '+date(c.lastOpenedAt)+' · Angelegt: '+date(c.createdAt);actions.className='toolbar';
  if(c.trashed)actions.append(button('Wiederherstellen',()=>void execute({commandId:crypto.randomUUID(),kind:'trash',id:c.id,expectedRevision:c.trashRevision,trashed:false})),button('Dauerhaft löschen…',()=>{if(busy||pending)return;erasing=c;el('campaign-delete-label').textContent=c.name;el<HTMLInputElement>('campaign-delete-name').value='';dialog('campaign-delete-dialog').showModal();el('campaign-delete-name').focus();}));
  else actions.append(button(c.id===activeId?'Fortsetzen':'Öffnen',()=>void execute({commandId:crypto.randomUUID(),kind:'open',id:c.id})),button('Bearbeiten…',()=>edit(c)));
  card.append(h,facts,time,actions);(c.trashed?trash:root).append(card);
 }
 if(!root.children.length)root.textContent='Noch keine verfügbare Kampagne. Lege eine neue an oder importiere ein Paket.';
 if(!trash.children.length)trash.textContent='Der Papierkorb ist leer.';
 el('campaign-trash-open').textContent='Papierkorb ('+campaigns.filter(c=>c.trashed).length+')';lock();
}
function edit(c:CampaignOverview|null){if(busy||pending)return;editing=c;el('campaign-identity-heading').textContent=c?'Kampagne bearbeiten':'Neue Kampagne';el<HTMLInputElement>('campaign-identity-name').value=c?.name??'';el('campaign-identity-trash').hidden=!c;el('campaign-identity-status').textContent='';dialog('campaign-identity-dialog').showModal();el('campaign-identity-name').focus();}
function closeIdentity(){dialog('campaign-identity-dialog').close();el<HTMLInputElement>('campaign-identity-name').value='';editing=null;}
function clearPending(){pending=null;try{window.localStorage.removeItem(pendingKey);storageNotice='';}catch{storageNotice='Der geklärte Auftragsvermerk konnte lokal nicht entfernt werden. Sein Buchungsstatus bleibt erneut prüfbar.';}}
async function apply(receipt:CampaignCatalogReceipt){
 closeIdentity();
 if(receipt.kind==='create'||receipt.kind==='open'){entry=receipt;message('Öffnung bestätigt. Arbeitsfläche wird geladen…');await changed();await load();}
 else{dialog('campaign-delete-dialog').close();erasing=null;await changed();await refresh();message(receipt.kind==='rename'?'Name gespeichert.':receipt.kind==='erase'?'Kampagne dauerhaft gelöscht.':'Kampagnenstatus gespeichert. Wiederherstellen aktiviert keine Kampagne.');}
}
async function load(){if(!entry)return;const accepted=entry;try{if(await enter(accepted)){entry=null;hideCampaignScreen();}else message('Öffnung bestätigt. Arbeitsfläche konnte nicht vollständig geladen werden. Erneut laden versucht nur die Arbeitsfläche.');}catch(e){message((e as Error).message+' · Öffnung ist bereits bestätigt.');}}
async function execute(c:CampaignCatalogCommand){if(busy||pending)return;
 // Persist the intent before dispatch; a failed local write must not lock the UI.
 try{window.localStorage.setItem(pendingKey,JSON.stringify(c));storageNotice='';}catch(error){const reason=(error as Error).name==='QuotaExceededError'?'Lokaler Speicher für die Wiederaufnahme ist voll.':'Lokaler Speicher für die Wiederaufnahme ist nicht verfügbar.';message('Auftrag nicht gestartet: '+reason+' Eingaben bleiben erhalten. Erneut versuchen.');return;}
 busy=true;pending=c;lock();let accepted:CampaignCatalogReceipt|null=null;
 try{try{accepted=unwrap(await window.campaign.campaignCatalog(c));}catch(error){try{accepted=unwrap(await window.campaign.campaignCatalogOutcome(c));}catch{message('Ergebnis noch offen. Buchungsstatus prüfen, bevor du fortfährst.');return;}if(!accepted){clearPending();throw error;}}
  clearPending();await apply(accepted!);
 }catch(error){message((error as Error).message);}finally{busy=false;lock();}
}
async function check(){if(!pending||busy)return;busy=true;lock();try{const r=unwrap(await window.campaign.campaignCatalogOutcome(pending));clearPending();if(r)await apply(r);else message('Keine Änderung gebucht. Eingaben bleiben für einen neuen Versuch erhalten.');}catch(e){message((e as Error).message);}finally{busy=false;lock();}}
export function hideCampaignScreen(){document.body.classList.remove('campaign-screen-open');el('campaign-screen').hidden=true;}
export async function openCampaignScreen(initial=false){if(busy)return false;if(!initial&&!await before())return false;if(busy)return false;document.body.classList.add('campaign-screen-open');el('campaign-screen').hidden=false;closeApplicationMenu();message('Kampagnen werden geladen…');try{const ready=await refresh();if(ready)readyMessage();return ready;}catch(e){message((e as Error).message);return false;}}
export function initCampaignScreen(options:{before:typeof before;enter:typeof enter;changed:typeof changed}){
 applicationPopup=bindAnchoredPopup(el<HTMLButtonElement>('application-trigger'),el('application-popup'),176);el('application-trigger').onclick=()=>applicationPopup!.toggle();
 before=options.before;enter=options.enter;changed=options.changed;
 try{pending=JSON.parse(window.localStorage.getItem(pendingKey)??'null');}catch{message('Gespeicherter Kampagnenauftrag ist nicht lesbar.');}
 el('campaign-screen-open').onclick=()=>void openCampaignScreen();el('campaign-header-name').onclick=()=>void openCampaignScreen();el('campaign-screen-create').onclick=()=>edit(null);el('campaign-screen-refresh').onclick=()=>{message('Kampagnen werden geladen…');void refresh().then(ok=>{if(ok)readyMessage();}).catch(e=>message(e.message));};el('campaign-trash-open').onclick=()=>dialog('campaign-trash-dialog').showModal();el('campaign-trash-close').onclick=()=>{if(!busy&&!pending)dialog('campaign-trash-dialog').close();};el('campaign-identity-close').onclick=()=>{if(!busy&&!pending)closeIdentity();};el('campaign-delete-close').onclick=()=>{if(!busy&&!pending){erasing=null;dialog('campaign-delete-dialog').close();}};
 for(const id of ['campaign-identity-dialog','campaign-trash-dialog','campaign-delete-dialog'])dialog(id).oncancel=e=>{e.preventDefault();if(!busy&&!pending){if(id==='campaign-identity-dialog')closeIdentity();else dialog(id).close();}};
 el('campaign-identity-form').onsubmit=e=>{e.preventDefault();const name=el<HTMLInputElement>('campaign-identity-name').value.trim();void execute(editing?{commandId:crypto.randomUUID(),kind:'rename',id:editing.id,expectedRevision:editing.revision,name}:{commandId:crypto.randomUUID(),kind:'create',name});};
 el('campaign-identity-trash').onclick=()=>{if(editing)void execute({commandId:crypto.randomUUID(),kind:'trash',id:editing.id,expectedRevision:editing.trashRevision,trashed:true});};
 el('campaign-delete-form').onsubmit=e=>{e.preventDefault();if(erasing)void execute({commandId:crypto.randomUUID(),kind:'erase',id:erasing.id,expectedRevision:erasing.trashRevision,confirmName:el<HTMLInputElement>('campaign-delete-name').value});};
 for(const b of document.querySelectorAll<HTMLButtonElement>('[data-catalog-check]'))b.onclick=()=>void check();
 el('campaign-load-retry').onclick=()=>{if(busy||pending)return;busy=true;lock();void load().finally(()=>{busy=false;lock();});};
 el('campaign-screen-packages').onclick=()=>el('campaign-manager').click();
 el('application-settings').onclick=()=>{closeApplicationMenu();void import('./preset-settings-ui').then(ui=>ui.openPresetSettings(null)).catch(e=>message(e.message));};
 el('new-campaign').onclick=()=>void openCampaignScreen().then(ok=>{if(ok)edit(null);});el('rename-campaign').onclick=()=>void openCampaignScreen().then(ok=>{if(ok)edit(campaigns.find(c=>c.id===activeId)??null);});
 lock();
}

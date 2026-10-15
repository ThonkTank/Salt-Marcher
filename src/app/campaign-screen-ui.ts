import type {CampaignCatalogCommand,CampaignCatalogReceipt,CampaignOverview} from './campaign-contracts';
import type {Result} from './contracts';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const unwrap=<T>(r:Result<T>)=>{if(!r.ok)throw new Error(r.error);return r.value;};
const pendingKey='campaign-catalog-pending';
let before:()=>Promise<boolean>,enter:(receipt:CampaignCatalogReceipt)=>Promise<boolean>,changed:()=>Promise<void>;
let campaigns:CampaignOverview[]=[],activeId:string|null=null,busy=false,pending:CampaignCatalogCommand|null=null,editing:CampaignOverview|null=null,erasing:CampaignOverview|null=null,entry:CampaignCatalogReceipt|null=null,request=0;
const dialog=(id:string)=>el<HTMLDialogElement>(id);
function message(text:string){el('campaign-screen-status').textContent=text;el('campaign-identity-status').textContent=text;el('campaign-trash-status').textContent=text;el('campaign-delete-status').textContent=text;}
function lock(){for(const root of ['campaign-screen','campaign-identity-dialog','campaign-trash-dialog','campaign-delete-dialog'])for(const b of el(root).querySelectorAll<HTMLButtonElement|HTMLInputElement>('button,input'))b.disabled=busy||!!pending;for(const b of document.querySelectorAll<HTMLButtonElement>('[data-catalog-check]')){b.hidden=!pending;b.disabled=busy;}el<HTMLButtonElement>('campaign-load-retry').hidden=!entry;el<HTMLButtonElement>('campaign-load-retry').disabled=busy||!!pending;}
const button=(text:string,run:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=run;return b;};
const date=(s:string|null)=>s?new Date(s).toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'}):'nicht bekannt';
async function refresh(){const n=++request,[rows,list]=await Promise.all([window.campaign.campaignOverview(),window.campaign.list()]);if(n!==request)return;campaigns=unwrap(rows);activeId=unwrap(list).activeId;draw();}
function draw(){
 const root=el('campaign-screen-list'),trash=el('campaign-trash-list');root.replaceChildren();trash.replaceChildren();
 for(const c of campaigns){const card=document.createElement('article'),h=document.createElement('h3'),facts=document.createElement('p'),time=document.createElement('p'),actions=document.createElement('div');card.className='campaign-card';card.dataset.campaignId=c.id;h.textContent=c.name+(c.id===activeId?' · aktiv':'');facts.textContent=c.rooms+(c.rooms===1?' Raum':' Räume')+' · '+c.locations+(c.locations===1?' Ort':' Orte')+' · '+c.characters+(c.characters===1?' Charakter':' Charaktere');time.className='caption';time.textContent='Zuletzt geöffnet: '+date(c.lastOpenedAt)+' · Angelegt: '+date(c.createdAt);actions.className='toolbar';
  if(c.trashed)actions.append(button('Wiederherstellen',()=>void execute({commandId:crypto.randomUUID(),kind:'trash',id:c.id,expectedRevision:c.trashRevision,trashed:false})),button('Dauerhaft löschen…',()=>{if(busy||pending)return;erasing=c;el('campaign-delete-label').textContent=c.name;el<HTMLInputElement>('campaign-delete-name').value='';dialog('campaign-delete-dialog').showModal();el('campaign-delete-name').focus();}));
  else actions.append(button(c.id===activeId?'Fortsetzen':'Öffnen',()=>void execute({commandId:crypto.randomUUID(),kind:'open',id:c.id})),button('Bearbeiten…',()=>edit(c)));
  card.append(h,facts,time,actions);(c.trashed?trash:root).append(card);
 }
 if(!root.children.length)root.textContent='Noch keine verfügbare Kampagne. Lege eine neue an oder importiere ein Paket.';
 if(!trash.children.length)trash.textContent='Der Papierkorb ist leer.';
 el('campaign-trash-open').textContent='Papierkorb ('+campaigns.filter(c=>c.trashed).length+')';lock();
}
function edit(c:CampaignOverview|null){if(busy||pending)return;editing=c;el('campaign-identity-heading').textContent=c?'Kampagne bearbeiten':'Neue Kampagne';el<HTMLInputElement>('campaign-identity-name').value=c?.name??'';el('campaign-identity-trash').hidden=!c;el('campaign-identity-status').textContent='';dialog('campaign-identity-dialog').showModal();el('campaign-identity-name').focus();}
function closeIdentity(){if(busy||pending)return;dialog('campaign-identity-dialog').close();el<HTMLInputElement>('campaign-identity-name').value='';editing=null;}
function clearPending(){pending=null;window.localStorage.removeItem(pendingKey);}
async function apply(receipt:CampaignCatalogReceipt){
 if(receipt.kind==='create'||receipt.kind==='open'){entry=receipt;closeIdentity();await changed();await load();}
 else{closeIdentity();dialog('campaign-delete-dialog').close();erasing=null;await changed();await refresh();message(receipt.kind==='rename'?'Name gespeichert.':receipt.kind==='erase'?'Kampagne dauerhaft gelöscht.':'Kampagnenstatus gespeichert. Wiederherstellen aktiviert keine Kampagne.');}
}
async function load(){if(!entry)return;const accepted=entry;try{if(await enter(accepted)){entry=null;hideCampaignScreen();}else message('Öffnung bestätigt. Arbeitsfläche konnte nicht vollständig geladen werden. Erneut laden versucht nur die Arbeitsfläche.');}catch(e){message((e as Error).message+' · Öffnung ist bereits bestätigt.');}}
async function execute(c:CampaignCatalogCommand){if(busy||pending)return;busy=true;pending=c;window.localStorage.setItem(pendingKey,JSON.stringify(c));lock();let accepted:CampaignCatalogReceipt|null=null;
 try{try{accepted=unwrap(await window.campaign.campaignCatalog(c));}catch(error){try{accepted=unwrap(await window.campaign.campaignCatalogOutcome(c));}catch{message('Ergebnis noch offen. Buchungsstatus prüfen, bevor du fortfährst.');return;}if(!accepted){clearPending();throw error;}}
  clearPending();busy=false;await apply(accepted!);
 }catch(error){message((error as Error).message);}finally{busy=false;lock();}
}
async function check(){if(!pending||busy)return;busy=true;lock();try{const r=unwrap(await window.campaign.campaignCatalogOutcome(pending));clearPending();busy=false;if(r)await apply(r);else message('Keine Änderung gebucht. Eingaben bleiben für einen neuen Versuch erhalten.');}catch(e){message((e as Error).message);}finally{busy=false;lock();}}
export function hideCampaignScreen(){document.body.classList.remove('campaign-screen-open');el('campaign-screen').hidden=true;}
export async function openCampaignScreen(initial=false){if(busy)return false;if(!initial&&!await before())return false;document.body.classList.add('campaign-screen-open');el('campaign-screen').hidden=false;el<HTMLDetailsElement>('application-menu').open=false;message('Kampagnen werden geladen…');try{await refresh();message(pending?'Ein Kampagnenauftrag wartet auf Statusprüfung.':'Kampagne wählen, um den Spieltisch zu öffnen.');}catch(e){message((e as Error).message);}return true;}
export function initCampaignScreen(options:{before:typeof before;enter:typeof enter;changed:typeof changed;settingsEditorAvailable:()=>boolean}){
 before=options.before;enter=options.enter;changed=options.changed;
 try{pending=JSON.parse(window.localStorage.getItem(pendingKey)??'null');}catch{message('Gespeicherter Kampagnenauftrag ist nicht lesbar.');}
 el('campaign-screen-open').onclick=()=>void openCampaignScreen();el('campaign-header-name').onclick=()=>void openCampaignScreen();el('campaign-screen-create').onclick=()=>edit(null);el('campaign-screen-refresh').onclick=()=>void refresh().catch(e=>message(e.message));el('campaign-trash-open').onclick=()=>dialog('campaign-trash-dialog').showModal();el('campaign-trash-close').onclick=()=>{if(!busy&&!pending)dialog('campaign-trash-dialog').close();};el('campaign-identity-close').onclick=closeIdentity;el('campaign-delete-close').onclick=()=>{if(!busy&&!pending){erasing=null;dialog('campaign-delete-dialog').close();}};
 for(const id of ['campaign-identity-dialog','campaign-trash-dialog','campaign-delete-dialog'])dialog(id).oncancel=e=>{e.preventDefault();if(!busy&&!pending){if(id==='campaign-identity-dialog')closeIdentity();else dialog(id).close();}};
 el('campaign-identity-form').onsubmit=e=>{e.preventDefault();const name=el<HTMLInputElement>('campaign-identity-name').value.trim();void execute(editing?{commandId:crypto.randomUUID(),kind:'rename',id:editing.id,expectedRevision:editing.revision,name}:{commandId:crypto.randomUUID(),kind:'create',name});};
 el('campaign-identity-trash').onclick=()=>{if(editing)void execute({commandId:crypto.randomUUID(),kind:'trash',id:editing.id,expectedRevision:editing.trashRevision,trashed:true});};
 el('campaign-delete-form').onsubmit=e=>{e.preventDefault();if(erasing)void execute({commandId:crypto.randomUUID(),kind:'erase',id:erasing.id,expectedRevision:erasing.trashRevision,confirmName:el<HTMLInputElement>('campaign-delete-name').value});};
 for(const b of document.querySelectorAll<HTMLButtonElement>('[data-catalog-check]'))b.onclick=()=>void check();
 el('campaign-load-retry').onclick=()=>{if(busy||pending)return;busy=true;lock();void load().finally(()=>{busy=false;lock();});};
 el('campaign-screen-packages').onclick=()=>el('campaign-manager').click();
 let settingsRequest=0;
 const closeSettings=()=>{settingsRequest++;dialog('campaign-settings-dialog').close();};
 el('campaign-settings-close').onclick=closeSettings;dialog('campaign-settings-dialog').oncancel=e=>{e.preventDefault();closeSettings();};
 el('campaign-settings-edit').onclick=()=>{closeSettings();el('generator-settings').click();};
 el('application-settings').onclick=()=>{el<HTMLDetailsElement>('application-menu').open=false;const n=++settingsRequest;el('campaign-settings-presets').textContent='Generatorregeln werden geladen…';el<HTMLButtonElement>('campaign-settings-edit').disabled=!options.settingsEditorAvailable();dialog('campaign-settings-dialog').showModal();void window.campaign.campaignInstallationSettings().then(result=>{if(n!==settingsRequest)return;const {registry}=unwrap(result),root=el('campaign-settings-presets');root.replaceChildren();const heading=document.createElement('p');heading.textContent='Installationsrevision '+registry.revision+' · wirksames Preset: '+(registry.presets.find(p=>p.id===registry.effectiveId)?.name??registry.effectiveId);root.append(heading);for(const p of registry.presets){const line=document.createElement('p');line.textContent=p.name+' · Revision '+p.revision+(p.system?' · geschütztes Systempreset':'');root.append(line);}}).catch(e=>{if(n===settingsRequest)el('campaign-settings-presets').textContent=e.message;});};
 el('new-campaign').onclick=()=>void openCampaignScreen().then(ok=>{if(ok)edit(null);});el('rename-campaign').onclick=()=>void openCampaignScreen().then(ok=>{if(ok)edit(campaigns.find(c=>c.id===activeId)??null);});
 lock();
}

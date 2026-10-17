import type {WorkspaceGeometry,Result} from './contracts';
import type {CampaignTransferPreview,ConflictChoice} from './campaign-contracts';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const unwrap=<T>(r:Result<T>):T=>{if(!r.ok)throw new Error(r.error);return r.value;};
let context:()=>WorkspaceGeometry|null,before:()=>Promise<boolean>,changed:(id?:string)=>Promise<void>,tell:(text:string,error?:boolean)=>void;
let preview:CampaignTransferPreview|null=null,busy=false,accepting=false,generation=0,transferRequest=0;
const pendingKey='campaign-pending-transfer';
let pendingTicket:string|null=null;
const labels:Record<string,string>={drawing_element:'Dungeonobjekte und Features',drawing_profile:'Raumdarstellung und Deckenhöhen',player_asset:'Freigegebene Spielerbilder',city_document:'Stadtpläne',city_unit:'Stadtelemente',room:'Räume',scope:'Dungeonzeichnungen',world_note:'Welttexte',location:'Orte',plan:'Spielabendpläne',planned_visit:'Vorbereitete Besuche',roster_member:'Charaktere',live_scene:'Gruppen / Szenen',combat:'Kämpfe',treasure:'Schätze',character_ledger:'Persönliche Beute',world_journey:'Reisen',world_record:'Karten, Kalender und Wetter',audio_asset:'Audiodateibeschreibungen',item_definition:'Gegenstandsdefinitionen',generator_preset:'Generatorregeln',campaign_capability:'Erhaltene Zusatzinhalte'};
function run(fn:()=>Promise<unknown>|void){const gen=generation,token=context()?.token;void Promise.resolve().then(()=>{if(gen!==generation||token!==context()?.token)return;return fn();}).catch(error=>{if(gen===generation&&token===context()?.token)tell(error.message,true);});}
function displayPreview(p:CampaignTransferPreview){preview=p;el<HTMLInputElement>('campaign-transfer-name').value=p.name+(p.copy?' – Kopie':' – Import');el('campaign-transfer-summary').textContent=(p.copy?'Unabhängige Kopie':'Unabhängiger Import')+' · '+p.audioFiles+' Mediendateien · '+(p.bytes/1048576).toFixed(1)+' MB · Produktstand '+p.applicationVersion;const contents=el('campaign-transfer-contents');contents.replaceChildren();for(const c of p.counts){if(!labels[c.table])continue;const row=document.createElement('p');row.textContent=labels[c.table]+': '+c.records;contents.append(row);}const issues=el('campaign-transfer-problems');issues.textContent=p.problems.join('\n');const conflicts=el('campaign-transfer-conflicts');conflicts.replaceChildren();for(const c of p.conflicts){const card=document.createElement('article'),title=document.createElement('h3'),text=document.createElement('p'),select=document.createElement('select');card.className='campaign-card';title.textContent=c.name+' · '+({item:'Gegenstand',audio:'Audio',preset:'Generatorregel',table:'Encounter-Tabelle',mood:'Stimmungsachse'}[c.kind]);text.textContent='Die Paketvariante unterscheidet sich vom vorhandenen Stand. Das Ersetzen des aktuellen gemeinsamen Stands kann '+c.affectedCampaigns+' vorhandene Kampagnen betreffen.';select.dataset.conflict=c.key;for(const [id,label]of [['','Entscheidung wählen'],['keep-both','Beide Varianten mit getrennten Kennungen behalten'],['keep-current','Vorhandenen aktuellen Stand verwenden'],['keep-imported','Paketvariante als aktuellen Stand übernehmen']]){const o=document.createElement('option');o.value=id!;o.textContent=label!;select.append(o);}select.onchange=lock;const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Beide Definitionen vergleichen';details.append(summary);for(const [label,data]of [['Vorhanden',c.existing],['Im Paket',c.incoming]]){const heading=document.createElement('h4'),pre=document.createElement('pre');heading.textContent=label!;pre.textContent=JSON.stringify(JSON.parse(data!),null,2);details.append(heading,pre);}if(c.kind==='item'){const note=document.createElement('p');note.className='caption';note.textContent='Aufgezeichnete Vergabewerte bleiben erhalten. Abweichende historische Definitionen werden separat bewahrt.';card.append(note);}card.append(title,text,details,select);conflicts.append(card);}lock();el<HTMLDialogElement>('campaign-transfer-dialog').showModal();}
function canAccept(){
 if(!preview||preview.problems.length)return false;
 const decisions=new Map([...el('campaign-transfer-conflicts').querySelectorAll<HTMLSelectElement>('select')].map(s=>[s.dataset.conflict,s.value]));
 return preview.conflicts.every(c=>['keep-current','keep-imported','keep-both'].includes(decisions.get(c.key)??''));
}
function lock(){
 el<HTMLButtonElement>('campaign-transfer-accept').disabled=busy||accepting||!!pendingTicket||!canAccept();
 for(const id of ['campaign-export','campaign-copy','campaign-import-package'])el<HTMLButtonElement>(id).disabled=busy||accepting||!!pendingTicket;
 el<HTMLInputElement>('campaign-transfer-name').disabled=accepting||!!pendingTicket;
 for(const select of el('campaign-transfer-conflicts').querySelectorAll<HTMLSelectElement>('select'))select.disabled=accepting||!!pendingTicket;
 for(const id of ['campaign-transfer-check','campaign-transfer-check-preview']){
  const b=el<HTMLButtonElement>(id);b.hidden=!pendingTicket;b.disabled=accepting;
 }
 el('campaign-transfer-cancel-job').hidden=!busy;
}
async function cancelPreview(){
 const p=preview,request=++transferRequest;preview=null;el<HTMLDialogElement>('campaign-transfer-dialog').close();lock();
 if(p){const result=await window.campaign.cancelCampaignTransfer(p.ticket);if(request===transferRequest)unwrap(result);}
}
async function closeManager(){generation++;el<HTMLDialogElement>('campaign-manager-dialog').close();await cancelPreview();}
async function preparePreview(copy:boolean){
 if(busy||accepting||pendingTicket)return;
 const owner=context(),gen=generation,request=++transferRequest,old=preview;
 const owns=()=>gen===generation&&request===transferRequest&&owner?.token===context()?.token;
 preview=null;el<HTMLDialogElement>('campaign-transfer-dialog').close();lock();
 if(old)await window.campaign.cancelCampaignTransfer(old.ticket);
 if(!await before()||!owns())return;
 if(copy&&!owner)throw new Error('Öffne zuerst eine Kampagne.');
 const response=copy?await window.campaign.prepareCampaignCopy(owner!.token):await window.campaign.prepareCampaignImport();
 if(!owns()){if(response.ok&&response.value)await window.campaign.cancelCampaignTransfer(response.value.ticket);return;}
 const p=unwrap(response);if(p)displayPreview(p);
}
async function acceptPreview(){
 if(busy||accepting||pendingTicket||!canAccept()||!preview)return;
 const p=preview,request=transferRequest,gen=generation,token=context()?.token,name=el<HTMLInputElement>('campaign-transfer-name').value;
 const choices=Object.fromEntries([...el('campaign-transfer-conflicts').querySelectorAll<HTMLSelectElement>('select')].map(s=>[s.dataset.conflict!,s.value as ConflictChoice]));
 accepting=true;lock();
 try{
  if(!await before()||preview!==p||request!==transferRequest||token!==context()?.token)return;
  // Retain only the opaque ticket before sending. Recovery never repeats the write.
  window.localStorage.setItem(pendingKey,p.ticket);pendingTicket=p.ticket;
  let result;
  try{result=unwrap(await window.campaign.acceptCampaignTransfer(p.ticket,name,choices));}
  catch(error){const state=await reconcileAcceptance();if(state==='not-applied')throw error;return;}
  clearPending();
  const owns=preview===p&&request===transferRequest&&gen===generation&&token===context()?.token;
  if(preview===p){preview=null;transferRequest++;el<HTMLDialogElement>('campaign-transfer-dialog').close();}
  if(owns)el<HTMLDialogElement>('campaign-manager-dialog').close();
  await changed(owns?result.id:undefined);
  if(owns)tell('Unabhängige Kampagne übernommen.');
 }finally{accepting=false;lock();}
}

function clearPending(){window.localStorage.removeItem(pendingKey);pendingTicket=null;}
async function reconcileAcceptance(){
 const ticket=pendingTicket;if(!ticket)return;
 const status=unwrap(await window.campaign.campaignTransferStatus(ticket));
 if(ticket!==pendingTicket)return;
 if(status.state==='pending'){tell('Die Übernahme läuft noch. Status erneut prüfen.');return status.state;}
 clearPending();
 if(status.state==='applied'){
  if(preview?.ticket===ticket){preview=null;transferRequest++;el<HTMLDialogElement>('campaign-transfer-dialog').close();}
  // Recovered outcomes update the list without selecting an old campaign context.
  await changed();tell('Übernahme bestätigt: '+status.campaign.name);
 }else tell('Keine übernommene Kampagne vorhanden. Du kannst die Übernahme erneut starten.');
 return status.state;
}
async function checkAcceptance(){if(accepting||!pendingTicket)return;accepting=true;lock();try{await reconcileAcceptance();}finally{accepting=false;lock();}}

export function initCampaignManager(status:typeof tell,getContext:typeof context,flush:typeof before,onChanged:typeof changed){tell=status;context=getContext;before=flush;changed=onChanged;el('campaign-manager').onclick=()=>{generation++;run(()=>{pendingTicket=window.localStorage.getItem(pendingKey);lock();el<HTMLDialogElement>('campaign-manager-dialog').showModal();});};
 lock();
 for(const id of ['campaign-transfer-check','campaign-transfer-check-preview'])el(id).onclick=()=>run(checkAcceptance);
 el('campaign-manager-close').onclick=()=>run(closeManager);
 el<HTMLDialogElement>('campaign-manager-dialog').oncancel=e=>{e.preventDefault();run(closeManager);};
 el('campaign-export').onclick=()=>run(async()=>{if(busy||accepting||pendingTicket)return;const w=context(),gen=generation;if(!await before()||gen!==generation||w?.token!==context()?.token)return;if(!w)throw new Error('Öffne zuerst eine Kampagne.');const response=await window.campaign.exportCampaign(w.token);if(gen!==generation||w.token!==context()?.token)return;if(!unwrap(response).cancelled)tell('Kampagnenpaket mit Daten und Medien exportiert.');});
 el('campaign-copy').onclick=()=>run(()=>preparePreview(true));
 el('campaign-import-package').onclick=()=>run(()=>preparePreview(false));
 el('campaign-transfer-cancel').onclick=()=>run(cancelPreview);
 el<HTMLDialogElement>('campaign-transfer-dialog').oncancel=e=>{e.preventDefault();run(cancelPreview);};
 el('campaign-transfer-cancel-job').onclick=()=>run(async()=>{unwrap(await window.campaign.cancelCampaignTransfer());});
 el('campaign-transfer-form').onsubmit=e=>{e.preventDefault();run(acceptPreview);};
 window.campaign.onCampaignTransfer(p=>{busy=p.busy;el('campaign-transfer-progress').textContent=p.phase+(p.busy?' · '+(p.bytes/1048576).toFixed(1)+' MB':'');lock();});
}

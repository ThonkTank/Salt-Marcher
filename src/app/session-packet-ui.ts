import type {SessionPacket} from './session-packet-contracts';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
export interface LivePacketSource {sceneId:string;token:string;planId:string;visitId:string|null;key:string;current:()=>boolean;flush:()=>Promise<boolean>;openVisit:(id:string)=>Promise<void>;readAloud:(text:string,title:string)=>Promise<void>}
type PacketSource={sceneId?:string;token:string;planId:string;key:string;current:()=>boolean;flush:()=>Promise<boolean>;visitId?:string|null;openVisit?:(id:string)=>Promise<void>;readAloud?:(text:string,title:string)=>Promise<void>};
let packet:SessionPacket|null=null,source:PacketSource|null=null,liveSource:LivePacketSource|null=null,request=0,selected:string|null=null,docked=false,surface='atlas',partyWasHidden=false;
let loadPacket:(next?:PacketSource)=>Promise<void>;
export function closeSessionPacket(){request++;packet=null;source=null;const d=document.getElementById('session-packet-dialog') as HTMLDialogElement|null;if(d?.open)d.close();if(docked){docked=false;const host=el('live-packet-host');host.hidden=true;el('live-workspace').classList.remove('packet-at-desk');el('live').classList.remove('packet-at-desk');el('live-party-panel').hidden=partyWasHidden;if(d){document.body.append(d);d.classList.remove('packet-docked');d.removeAttribute('role');}el('session-packet-party-toggle').hidden=true;}}
export function closePreparationPacket(){if(!docked)closeSessionPacket();}
export function setSessionPacketSurface(tab:string){surface=tab;if(docked&&tab==='live'&&liveSource)void loadPacket(liveSource);}
export function syncLiveSessionPacket(next:LivePacketSource|null){
 const changed=next?.key!==liveSource?.key;liveSource=next;
 if(!docked)return;if(!next){closeSessionPacket();return;}
 if(changed){if(source?.sceneId!==next.sceneId||source?.planId!==next.planId||source?.token!==next.token||source?.visitId!==next.visitId){selected=next.visitId;packet=null;el('session-packet-content').replaceChildren();el('session-packet-visits').replaceChildren();el<HTMLInputElement>('session-packet-search').value='';}if(surface==='live')void loadPacket(next);else{request++;source=next;}}
}
export async function openLiveSessionPacket(next:LivePacketSource){
 liveSource=next;const dialog=el<HTMLDialogElement>('session-packet-dialog');if(dialog.open)dialog.close();
 if(!docked){partyWasHidden=el('live-party-panel').hidden;el('live-party-panel').hidden=true;}
 docked=true;source=next;selected=next.visitId;el<HTMLInputElement>('session-packet-search').value='';
 el('live-packet-host').hidden=false;el('live-packet-host').append(dialog);el('live-workspace').classList.add('packet-at-desk');el('live').classList.add('packet-at-desk');dialog.classList.add('packet-docked');dialog.setAttribute('role','region');dialog.open=true;el('session-packet-party-toggle').hidden=false;el('session-packet-party-toggle').setAttribute('aria-pressed','false');
 await loadPacket(next);
}
export function initSessionPacket(tell:(s:string,e?:boolean)=>void,owner:()=>{token:string;planId:string}|null,flush:()=>Promise<boolean>){
 const bar=document.createElement('div');bar.className='toolbar';bar.innerHTML='<button id="session-packet-open" type="button">Spielabendmappe öffnen…</button>';el('plan-name').after(bar);
 const workspace=el('live-workspace');workspace.firstElementChild!.id='live-party-panel';const host=document.createElement('section');host.id='live-packet-host';host.hidden=true;workspace.append(host);
 const dialog=document.createElement('dialog');dialog.id='session-packet-dialog';dialog.innerHTML='<div class="toolbar packet-heading"><h2>GM-Spielabendmappe</h2><button id="session-packet-party-toggle" type="button" hidden aria-pressed="false">Party-Bearbeitung anzeigen</button><button id="session-packet-refresh" type="button">Aktualisieren</button><button id="session-packet-export" type="button" disabled>Als Markdown speichern…</button><button id="session-packet-close" type="button">Schließen</button></div><p id="session-packet-summary"></p><div id="session-packet-warnings"></div><div class="session-packet-columns"><section class="packet-index"><label for="session-packet-search">In der Mappe suchen</label><input id="session-packet-search" type="search" placeholder="Ort, Figur, Aktion oder Notiz"><div class="toolbar"><button id="session-packet-prev" type="button">Voriger Besuch</button><button id="session-packet-next" type="button">Nächster Besuch</button><span id="session-packet-count"></span></div><div id="session-packet-visits"></div></section><article id="session-packet-content"></article></div>';document.body.append(dialog);
 const same=(o:PacketSource)=>source===o&&o.current();
 const preparationSource=():PacketSource|null=>{const o=owner();return o?{...o,key:o.token+':'+o.planId,current:()=>{const n=owner();return n?.token===o.token&&n.planId===o.planId;},flush}:null;};
 const act=(fn:()=>Promise<void>)=>void fn().catch(e=>tell(e.message,true));
 const matches=()=>{const term=el<HTMLInputElement>('session-packet-search').value.toLocaleLowerCase();return packet?.visits.filter(v=>[v.title,v.location??'',...v.blocks.flatMap(b=>[b.heading,b.text])].some(t=>t.toLocaleLowerCase().includes(term)))??[];};
 function visit(id:string){
  selected=id;const v=packet?.visits.find(v=>v.id===id),root=el('session-packet-content');root.replaceChildren();if(!v)return;
  for(const b of el('session-packet-visits').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.visitId===id));
  const header=document.createElement('div');header.className='toolbar';const h=document.createElement('h3');h.textContent=v.title;header.append(h);const captured=source;
  if(captured?.openVisit){const b=document.createElement('button');b.type='button';b.textContent=captured.visitId===id?'Besuch erneut übernehmen…':'Besuch übernehmen…';b.onclick=()=>act(async()=>{if(captured.current())await captured.openVisit!(id);});header.append(b);}
  root.append(header);const location=document.createElement('p');location.className='caption';location.textContent=v.location??'Ohne Ortsbindung';root.append(location);
  if(!v.blocks.length){const p=document.createElement('p');p.textContent='Dieser Besuch hat noch keine vorbereiteten Texte, Begegnungen oder Belohnungen.';root.append(p);}
  for(const block of v.blocks){const section=document.createElement('section');section.className='packet-block packet-'+block.kind;const h=document.createElement('h4'),p=document.createElement('div');h.textContent=block.heading;p.className='packet-text';p.textContent=block.text||'Keine Notizen.';section.append(h,p);
   if(block.kind==='read-aloud'&&captured?.readAloud){const b=document.createElement('button');b.type='button';b.className='packet-use-read-aloud';b.textContent='Vorlesetext in Szene übernehmen';b.onclick=()=>act(async()=>{if(captured.current())await captured.readAloud!(block.text,block.heading);});section.append(b);}
   root.append(section);
  }
  const rows=matches(),index=rows.findIndex(v=>v.id===id);el<HTMLButtonElement>('session-packet-prev').disabled=index<=0;el<HTMLButtonElement>('session-packet-next').disabled=index<0||index>=rows.length-1;root.scrollTop=0;
 }
 function draw(){
  const root=el('session-packet-visits');root.replaceChildren();if(!packet)return;const rows=matches();el('session-packet-count').textContent=rows.length+' von '+packet.visits.length+' Besuchen';
  for(const v of rows){const b=document.createElement('button');b.type='button';b.dataset.visitId=v.id;b.textContent=(packet.visits.indexOf(v)+1)+'. '+v.title+(source?.visitId===v.id?' · aktuelle Übernahme':'');b.onclick=()=>visit(v.id);root.append(b);}
  visit(rows.some(v=>v.id===selected)?selected!:rows[0]?.id??'');
 }
 loadPacket=async(next?:PacketSource)=>{
  if(next)source=next;const o=source,n=++request;if(!o)return;const oldSelected=selected,oldScroll=el('session-packet-content').scrollTop;packet=null;for(const id of ['content','visits','warnings','count'])el('session-packet-'+id).replaceChildren();el('session-packet-summary').textContent='Spielabendmappe wird zusammengestellt…';
  el<HTMLButtonElement>('session-packet-export').disabled=true;dialog.setAttribute('aria-busy','true');
  try{
   if(!await o.flush()){if(n===request&&same(o))el('session-packet-summary').textContent='Eingaben zuerst speichern; danach die Mappe erneut öffnen oder aktualisieren.';return;}if(n!==request||!same(o))return;
   if(!docked&&!dialog.open)dialog.showModal();el('session-packet-summary').textContent='Spielabendmappe wird zusammengestellt…';
   const r=await window.campaign.sessionPacket(o.token,o.planId);if(n!==request||!same(o))return;if(!r.ok)throw new Error(r.error);packet=r.value;
   el('session-packet-summary').textContent=(packet.planName||'Unbenannter Spielabend')+' · '+packet.campaignName+' · '+packet.visits.length+' Besuche · Planungsparty: '+(packet.party.join(' · ')||'keine Vorgabe');
   const warnings=el('session-packet-warnings');warnings.replaceChildren();for(const text of packet.warnings){const p=document.createElement('p');p.textContent=text;warnings.append(p);}draw();if(selected===oldSelected)el('session-packet-content').scrollTop=oldScroll;el<HTMLButtonElement>('session-packet-export').disabled=false;
  }catch(error){if(n===request&&same(o)){packet=null;el('session-packet-content').replaceChildren();el('session-packet-visits').replaceChildren();el('session-packet-summary').textContent=(error as Error).message;tell((error as Error).message,true);}}
  finally{if(n===request)dialog.setAttribute('aria-busy','false');}
 };
 el('session-packet-open').onclick=()=>act(async()=>{closeSessionPacket();selected=null;el<HTMLInputElement>('session-packet-search').value='';const o=preparationSource();if(o)await loadPacket(o);});el('session-packet-refresh').onclick=()=>act(()=>loadPacket());el('session-packet-close').onclick=closeSessionPacket;dialog.addEventListener('cancel',closeSessionPacket);el('session-packet-search').oninput=draw;
 for(const [id,delta]of [['session-packet-prev',-1],['session-packet-next',1]] as const)el(id).onclick=()=>{const rows=matches(),index=rows.findIndex(v=>v.id===selected),next=rows[index+delta];if(next)visit(next.id);};
 el('session-packet-party-toggle').onclick=()=>{const panel=el('live-party-panel');panel.hidden=!panel.hidden;el('session-packet-party-toggle').setAttribute('aria-pressed',String(!panel.hidden));};
 el('session-packet-export').onclick=()=>{
  const o=source,p=packet,n=request;if(!o||!p||p.planId!==o.planId||!same(o))return;
  const b=el<HTMLButtonElement>('session-packet-export');if(b.disabled)return;
  const current=()=>n===request&&same(o)&&packet===p;b.disabled=true;
  void window.campaign.exportSessionPacket(o.token,o.planId,p.basis)
   .then(r=>{if(!current())return;if(!r.ok)throw new Error(r.error);tell(r.value.cancelled?'Mappenausgabe abgebrochen.':'GM-Spielabendmappe als Markdown gespeichert.');})
   .catch(e=>{if(current())tell(e.message,true);})
   .finally(()=>{if(current())b.disabled=false;});
 };
}

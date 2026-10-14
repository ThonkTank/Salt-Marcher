import type {SessionPacket} from './session-packet-contracts';
let packet:SessionPacket|null=null,request=0;
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
export function closeSessionPacket(){request++;packet=null;const d=document.getElementById('session-packet-dialog') as HTMLDialogElement|null;if(d?.open)d.close();}
export function initSessionPacket(tell:(s:string,e?:boolean)=>void,owner:()=>{token:string;planId:string}|null,flush:()=>Promise<boolean>){
 const bar=document.createElement('div');bar.className='toolbar';bar.innerHTML='<button id="session-packet-open" type="button">Spielabendmappe öffnen…</button>';el('plan-name').after(bar);
 const dialog=document.createElement('dialog');dialog.id='session-packet-dialog';dialog.innerHTML='<div class="toolbar"><h2>GM-Spielabendmappe</h2><button id="session-packet-refresh" type="button">Aktualisieren</button><button id="session-packet-export" type="button" disabled>Als Markdown speichern…</button><button id="session-packet-close" type="button">Schließen</button></div><p id="session-packet-summary"></p><div id="session-packet-warnings"></div><div class="session-packet-columns"><section><label for="session-packet-search">In der Mappe suchen</label><input id="session-packet-search" type="search" placeholder="Ort, Figur, Aktion oder Notiz"><p id="session-packet-count"></p><div id="session-packet-visits"></div></section><article id="session-packet-content"></article></div>';document.body.append(dialog);
 let selected:string|null=null;
 const same=(o:{token:string;planId:string})=>{const now=owner();return now?.token===o.token&&now.planId===o.planId;};
 function visit(id:string){
  selected=id;const v=packet?.visits.find(v=>v.id===id),root=el('session-packet-content');root.replaceChildren();if(!v)return;
  for(const b of el('session-packet-visits').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.visitId===id));
  const h=document.createElement('h3');h.textContent=v.title;root.append(h);const location=document.createElement('p');location.className='caption';location.textContent=v.location??'Ohne Ortsbindung';root.append(location);
  if(!v.blocks.length){const p=document.createElement('p');p.textContent='Dieser Besuch hat noch keine vorbereiteten Texte, Begegnungen oder Belohnungen.';root.append(p);}
  for(const block of v.blocks){const section=document.createElement('section');section.className='packet-block packet-'+block.kind;const h=document.createElement('h4'),p=document.createElement('div');h.textContent=block.heading;p.className='packet-text';p.textContent=block.text||'Keine Notizen.';section.append(h,p);root.append(section);}
  root.scrollTop=0;
 }
 function draw(){
  const root=el('session-packet-visits');root.replaceChildren();if(!packet)return;const term=el<HTMLInputElement>('session-packet-search').value.toLocaleLowerCase(),matches=packet.visits.filter(v=>[v.title,v.location??'',...v.blocks.flatMap(b=>[b.heading,b.text])].some(t=>t.toLocaleLowerCase().includes(term)));
  el('session-packet-count').textContent=matches.length+' von '+packet.visits.length+' Besuchen';
  for(const v of matches){const b=document.createElement('button');b.type='button';b.dataset.visitId=v.id;b.textContent=(packet.visits.indexOf(v)+1)+'. '+v.title+(v.location?' · '+v.location:'');b.onclick=()=>visit(v.id);root.append(b);}
  visit(matches.some(v=>v.id===selected)?selected!:matches[0]?.id??'');
 }
 async function load(){
  const o=owner(),n=++request;if(!o||!await flush()||n!==request||!same(o))return;
  dialog.showModal();dialog.setAttribute('aria-busy','true');el('session-packet-summary').textContent='Spielabendmappe wird zusammengestellt…';el<HTMLButtonElement>('session-packet-export').disabled=true;
  try{const r=await window.campaign.sessionPacket(o.token,o.planId);if(n!==request||!same(o))return;if(!r.ok)throw new Error(r.error);packet=r.value;el('session-packet-summary').textContent=(packet.planName||'Unbenannter Spielabend')+' · '+packet.campaignName+' · '+packet.visits.length+' Besuche · Planungsparty: '+(packet.party.join(' · ')||'keine Vorgabe');const warnings=el('session-packet-warnings');warnings.replaceChildren();for(const text of packet.warnings){const p=document.createElement('p');p.textContent=text;warnings.append(p);}draw();el<HTMLButtonElement>('session-packet-export').disabled=false;}
  catch(error){if(n===request&&same(o)){packet=null;el('session-packet-content').replaceChildren();el('session-packet-visits').replaceChildren();el('session-packet-summary').textContent=(error as Error).message;tell((error as Error).message,true);}}
  finally{if(n===request)dialog.setAttribute('aria-busy','false');}
 }
 el('session-packet-open').onclick=()=>void load().catch(e=>tell(e.message,true));el('session-packet-refresh').onclick=()=>void load().catch(e=>tell(e.message,true));el('session-packet-close').onclick=()=>{closeSessionPacket();};dialog.addEventListener('cancel',()=>{closeSessionPacket();});el('session-packet-search').oninput=draw;
 el('session-packet-export').onclick=()=>{const o=owner(),p=packet;if(!o||!p||p.planId!==o.planId)return;const b=el<HTMLButtonElement>('session-packet-export');b.disabled=true;void window.campaign.exportSessionPacket(o.token,o.planId,p.basis).then(r=>{if(!same(o))return;if(!r.ok)throw new Error(r.error);tell(r.value.cancelled?'Mappenausgabe abgebrochen.':'GM-Spielabendmappe als Markdown gespeichert.');}).catch(e=>tell(e.message,true)).finally(()=>{if(same(o)&&packet===p)b.disabled=false;});};
}

import type {UpdateStatus} from './update-contracts';
import type {Result} from './contracts';
const unwrap=<T>(r:Result<T>)=>{if(!r.ok)throw new Error(r.error);return r.value;};
export function initUpdateUI(beforeInstall:()=>Promise<boolean>){
  const api=window.campaign;if(!api.updateStatus)return;
  const dialog=document.createElement('dialog');dialog.id='updates-dialog';dialog.setAttribute('aria-labelledby','updates-heading');
  dialog.innerHTML='<h2 id="updates-heading">Updates</h2><p id="updates-version"></p><label style="display:flex;align-items:center;gap:.5rem"><input id="updates-automatic" type="checkbox" style="width:auto"> Automatisch nach Updates suchen</label><p id="updates-last"></p><p id="updates-message" role="status" aria-live="polite"></p><progress id="updates-progress" hidden></progress><pre id="updates-notes" style="white-space:pre-wrap;max-height:40vh;overflow:auto"></pre><div class="actions"><button id="updates-check">Nach Updates suchen</button><button id="updates-download" hidden>Herunterladen</button><button id="updates-cancel" hidden>Download abbrechen</button><button id="updates-install" hidden>Installieren und neu starten</button><button id="updates-close">Schließen</button></div>';
  document.body.append(dialog);
  const get=<T extends HTMLElement>(id:string)=>dialog.querySelector<T>('#updates-'+id)!;
  const banner=document.createElement('button');banner.id='update-notice';banner.hidden=true;banner.type='button';document.querySelector('header')?.append(banner);
  let latest:UpdateStatus|null=null,busy=false,focus:HTMLElement|null=null;
  function render(s:UpdateStatus){latest=s;get('version').textContent='Installiert: '+s.currentVersion+(s.available?' · Verfügbar: '+s.available.version:'');get<HTMLInputElement>('automatic').checked=s.automatic;get('last').textContent=s.lastChecked?'Zuletzt geprüft: '+new Date(s.lastChecked).toLocaleString('de-DE'):'Noch nicht geprüft.';get('message').textContent=s.message;get('notes').textContent=s.available?.notes??'';
    const running=['checking','downloading','installing'].includes(s.phase);get<HTMLButtonElement>('check').disabled=busy||running||s.phase==='unsupported';get('download').hidden=!s.available||s.phase==='ready'||running;get('install').hidden=s.phase!=='ready';get('cancel').hidden=s.phase!=='downloading';get<HTMLButtonElement>('install').disabled=busy;get<HTMLButtonElement>('download').disabled=busy;get<HTMLButtonElement>('close').disabled=s.phase==='installing';get<HTMLInputElement>('automatic').disabled=s.phase==='unsupported';
    const progress=get<HTMLProgressElement>('progress');progress.hidden=s.phase!=='downloading';progress.max=s.total||1;progress.value=s.received;
    banner.hidden=!s.available;banner.textContent=s.phase==='ready'?'Update bereit':'Update verfügbar';
  }
  const run=async(action:()=>Promise<Result<UpdateStatus>>)=>{try{render(unwrap(await action()));}catch(e){get('message').textContent=(e as Error).message;}};
  function open(){focus=document.activeElement as HTMLElement;if(!dialog.open)dialog.showModal();void run(()=>api.updateStatus());}
  banner.onclick=open;document.addEventListener('saltmarcher-open-updates',open);
  get('check').onclick=()=>void run(()=>api.updateCheck());get('download').onclick=()=>void run(()=>api.updateDownload());get('cancel').onclick=()=>void run(()=>api.updateCancel());
  get<HTMLInputElement>('automatic').onchange=()=>void run(()=>api.updateAutomatic(get<HTMLInputElement>('automatic').checked));
  get('close').onclick=()=>{dialog.close();focus?.focus();};dialog.oncancel=e=>{if(latest?.phase==='installing')e.preventDefault();};
  get('install').onclick=()=>{if(busy)return;busy=true;if(latest)render(latest);void(async()=>{
    try{if(!await beforeInstall()){get('message').textContent='Update wartet auf den Abschluss deiner Bearbeitung.';return;}unwrap(await api.updateInstall());}
    catch(e){get('message').textContent=(e as Error).message;}finally{busy=false;if(latest){const message=get('message').textContent;render(latest);get('message').textContent=message;}}
  })();};
  const unsubscribe=api.onUpdate(render);window.addEventListener('unload',unsubscribe,{once:true});void run(()=>api.updateStatus());
}
export function openUpdates(){document.dispatchEvent(new Event('saltmarcher-open-updates'));}

import type {Workspace,Result} from './contracts';
import type {PlayerView,PlayerAction,PlayerObserver,PlayerSettings,PlayerCommand} from './player-contracts';
import {renderPlayer} from './player-render';
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T,input=(id:string)=>el<HTMLInputElement>(id),value=(id:string)=>input(id).value;
const unwrap=<T>(r:Result<T>):T=>{if(!r.ok)throw new Error(r.error);return r.value;};
type Owner={id:string;token:string;generation:number};
type FieldValue=string|boolean;
let context:()=>Workspace|null,before:()=>Promise<boolean>,tell:(s:string,error?:boolean)=>void,view:PlayerView|null=null,viewOwner:Owner|null=null,generation=0,presentation=0,actions=0;
let baseline=new Map<string,FieldValue>();
function owner():Owner|null{const w=context();return w?{id:w.campaign.id,token:w.token,generation}:null;}
function owns(o:Owner){const w=context();return o.generation===generation&&w?.token===o.token&&w.campaign.id===o.id;}
function hasView(o:Owner){return !!view&&viewOwner?.token===o.token&&viewOwner.id===o.id;}
function run(o:Owner|null,task:(o:Owner)=>Promise<unknown>|void){if(!o)return;void Promise.resolve().then(()=>{if(owns(o))return task(o);}).catch(error=>{if(owns(o)){if(el<HTMLDialogElement>('player-dialog').open){el('player-feedback').textContent=error.message;el('player-feedback').hidden=false;}tell(error.message,true);}});}
function options(id:string,rows:{id:string;name:string}[],selected:string|null,empty=false){const s=el<HTMLSelectElement>(id);s.replaceChildren();for(const row of [...(empty?[{id:'',name:'Keine Auswahl'}]:[]),...rows]){const o=document.createElement('option');o.value=row.id;o.textContent=row.name;s.append(o);}s.value=selected&&rows.some(r=>r.id===selected)?selected:empty?'':rows[0]?.id??'';}
function controls(){return [...el('player-dialog').querySelectorAll<HTMLInputElement|HTMLSelectElement>('input,select')];}
function key(control:HTMLInputElement|HTMLSelectElement){return control.id||control.dataset.playerKey||'';}
function snapshot(){return new Map(controls().filter(c=>key(c)).map(c=>[key(c),c.type==='checkbox'?(c as HTMLInputElement).checked:c.value]));}
function dirty(){return new Map([...snapshot()].filter(([k,v])=>baseline.has(k)&&baseline.get(k)!==v));}
function subjectOptions(){if(!view)return;const kind=value('player-art-kind');options('player-art-subject',kind==='location'?view.locations:kind==='npc'?view.npcs:[],value('player-art-subject')||null,true);el('player-art-subject-label').hidden=kind==='custom';}
function paint(){
 if(!view)return;
 el('player-feedback').hidden=true;el('player-target').textContent=view.focusId?'Freigabe für: '+(view.focusTitle||'Unbenannte Gruppe')+' · '+(view.observers.map(o=>o.name).join(', ')||'Leere Party'):'Keine fokussierte Gruppe.';
 const edits=dirty(),focused=document.activeElement as HTMLInputElement|null,focusKey=focused&&el('player-dialog').contains(focused)?key(focused):'',selection=focused?.selectionStart,selectionEnd=focused?.selectionEnd;
 const s=view.settings;input('player-title').value=s.title;input('player-labels').checked=s.labels;input('player-fullscreen').checked=s.fullscreen;input('player-light').value=s.light;input('player-screen').value=s.displayId===null?'':String(s.displayId);
 options('player-image',view.assets.map(a=>({id:a.id,name:a.title||a.kind})),s.imageId,true);options('player-map',view.maps,value('player-map')||null);options('player-place',view.locations,value('player-place')||null,true);subjectOptions();
 const root=el('player-observers');root.replaceChildren();
 for(const o of view.observers){
  const row=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=o.name;row.append(legend);
  const selected=document.createElement('input');selected.type='checkbox';selected.checked=true;selected.value=o.characterId;selected.dataset.playerCharacter='true';selected.dataset.playerKey='observer:'+o.characterId+':selected';
  const selectionLabel=document.createElement('label');selectionLabel.append(selected,' Für Kenntnisänderung auswählen');row.append(selectionLabel);
  const fields:Record<string,HTMLInputElement>={};
  for(const [name,label]of [['enabled','Aktuelle Sicht verwenden'],['rangeMeters','Sichtweite in m'],['darkvisionMeters','Dunkelsicht in m'],['eyeHeightMeters','Augenhöhe über Gelände in m']] as const){const l=document.createElement('label'),i=document.createElement('input');i.type=name==='enabled'?'checkbox':'number';i.step='0.1';i.dataset.playerKey='observer:'+o.characterId+':'+name;if(name==='enabled')i.checked=o.enabled;else i.value=String(o[name]);fields[name]=i;l.append(label,i);row.append(l);}
  const save=document.createElement('button');save.textContent='Sichtwerte speichern';save.type='button';save.onclick=()=>submit({kind:'observer',observer:{characterId:o.characterId,enabled:fields.enabled!.checked,rangeMeters:Number(fields.rangeMeters!.value),darkvisionMeters:Number(fields.darkvisionMeters!.value),eyeHeightMeters:Number(fields.eyeHeightMeters!.value)} as PlayerObserver});row.append(save);root.append(row);
 }
 baseline=snapshot();
 for(const control of controls()){const v=edits.get(key(control));if(v===undefined)continue;if(control.type==='checkbox')(control as HTMLInputElement).checked=v as boolean;else control.value=v as string;}
 if(focusKey){const next=controls().find(c=>key(c)===focusKey);next?.focus();if(typeof selection==='number'&&next instanceof HTMLInputElement&&next.type!=='number')next.setSelectionRange(selection,selectionEnd??selection);}
 renderPlayer(el('player-preview'),view.frame,'campaign://app/player');el('player-state').textContent=view.frame.mode==='blank'?(view.frame.reason??'Anzeige leer.'):view.frame.mode==='map'?'Reisekarte der fokussierten Gruppe.':'Freigegebene Ansicht. Bildoverride und Ausblenden verändern keine Charakterkenntnis.';
}
function publish(o:Owner,result:PlayerView,request:number){if(!owns(o)||request!==presentation||hasView(o)&&result.settings.revision<view!.settings.revision)return false;view=result;viewOwner=o;paint();return true;}
async function reload(o:Owner){const request=++presentation,result=await window.campaign.playerView(o.token);if(!owns(o)||request!==presentation)return false;return publish(o,unwrap(result),request);}
function closeControls(){generation++;presentation++;actions++;el<HTMLDialogElement>('player-dialog').close();}
export function deactivatePlayer(){closeControls();view=null;viewOwner=null;baseline.clear();for(const id of ['player-art-title','player-public-label'])input(id).value='';for(const id of ['player-q','player-r'])input(id).value='0';}
function settings(mode:'follow'|'image',blank:boolean):PlayerAction{return{kind:'settings',settings:{blank,mode,imageId:value('player-image')||null,title:value('player-title'),labels:input('player-labels').checked,light:value('player-light') as PlayerSettings['light'],displayId:value('player-screen')?Number(value('player-screen')):null,fullscreen:input('player-fullscreen').checked}};}
function submit(action:PlayerAction,openWindow=false){
 const o=owner();if(!o||!hasView(o))return;
 const command:PlayerCommand={commandId:crypto.randomUUID(),token:o.token,campaignId:o.id,expectedRevision:view!.settings.revision,expectedFocusId:view!.focusId,expectedFocusRevision:view!.focusRevision,expectedFocusMembershipRevision:view!.focusMembershipRevision,expectedFocusLocationId:view!.focusLocationId,action},intent=++actions,request=++presentation;
 run(o,async o=>{
  const result=await window.campaign.executePlayer(command);if(!owns(o))return;
  const confirmed=unwrap(result);publish(o,confirmed,request);
  if(openWindow&&intent===actions){unwrap(await window.campaign.playerWindow(o.token,true));if(!owns(o)||intent!==actions)return;await reload(o);}
  if(owns(o)&&intent===actions)tell('Spieleranzeige aktualisiert.');
 });
}
export async function cuePlayer(mode:'follow'|'blank',focus:Pick<PlayerView,'focusId'|'focusRevision'|'focusMembershipRevision'|'focusLocationId'>|null):Promise<boolean>{
 const o=owner();if(!o)return false;const intent=++actions,request=++presentation;
 try{
  // Blanking only reduces disclosure and must not wait for unrelated preview reads.
  const latest=mode==='blank'?null:unwrap(await window.campaign.playerView(o.token));if(!owns(o)||intent!==actions)return false;
  if(mode!=='blank'&&(!latest||!focus||focus.focusId!==latest.focusId||focus.focusRevision!==latest.focusRevision||focus.focusMembershipRevision!==latest.focusMembershipRevision||focus.focusLocationId!==latest.focusLocationId))throw new Error('Fokussierte Gruppe geändert. Prüfe die Freigabe für die aktuelle Gruppe erneut.');
  const action:PlayerAction=mode==='blank'?{kind:'blank'}:{kind:'settings',settings:{blank:false,mode,imageId:latest!.settings.imageId,title:'',labels:latest!.settings.labels,light:latest!.settings.light,displayId:latest!.settings.displayId,fullscreen:latest!.settings.fullscreen}};
  const command:PlayerCommand={commandId:crypto.randomUUID(),token:o.token,campaignId:o.id,expectedRevision:latest?.settings.revision??0,expectedFocusId:focus?.focusId??latest?.focusId??null,expectedFocusRevision:focus?.focusRevision??latest?.focusRevision??null,expectedFocusMembershipRevision:focus?.focusMembershipRevision??latest?.focusMembershipRevision??null,expectedFocusLocationId:focus?.focusLocationId??latest?.focusLocationId??null,action};
  const confirmed=unwrap(await window.campaign.executePlayer(command));if(!owns(o)||intent!==actions)return false;
  publish(o,confirmed,request);
  if(mode!=='blank'){unwrap(await window.campaign.playerWindow(o.token,true));if(!owns(o)||intent!==actions)return false;await reload(o);}
  if(owns(o)&&intent===actions)tell(mode==='blank'?'Spieleranzeige geleert.':'Spieleranzeige aktualisiert.');
  return owns(o)&&intent===actions;
 }catch(error){if(owns(o)&&intent===actions)tell((error as Error).message,true);return false;}
}
export async function cuePlayerImage(kind:'location'|'custom',subjectId:string|null,focus:Pick<PlayerView,'focusId'|'focusRevision'|'focusMembershipRevision'|'focusLocationId'>):Promise<boolean>{
 const o=owner();if(!o)return false;const intent=++actions,request=++presentation;
 try{
  let latest=unwrap(await window.campaign.playerView(o.token));if(!owns(o)||intent!==actions)return false;
  const sameFocus=(candidate:PlayerView)=>focus.focusId===candidate.focusId&&focus.focusRevision===candidate.focusRevision&&focus.focusMembershipRevision===candidate.focusMembershipRevision&&focus.focusLocationId===candidate.focusLocationId;
  if(!sameFocus(latest))throw new Error('Fokussierte Gruppe geändert. Prüfe die Bildfreigabe für die aktuelle Gruppe erneut.');
  let asset=kind==='location'?latest.assets.filter(a=>a.kind==='location'&&a.subjectId===subjectId).at(-1):undefined;
  if(!asset){
   const known=new Set(latest.assets.map(a=>a.id)),picked=unwrap(await window.campaign.pickPlayerArt(o.token,kind,subjectId,''));if(!picked)return false;
   if(!owns(o)||intent!==actions)return false;if(!sameFocus(picked))throw new Error('Fokussierte Gruppe geändert. Das gewählte Bild wurde gespeichert, aber noch nicht freigegeben.');
   asset=picked.assets.find(a=>!known.has(a.id));latest=picked;
  }
  if(!asset)throw new Error('Bild konnte nicht für die Spieleranzeige vorbereitet werden.');
  const action:PlayerAction={kind:'settings',settings:{blank:false,mode:'image',imageId:asset.id,title:'',labels:latest.settings.labels,light:latest.settings.light,displayId:latest.settings.displayId,fullscreen:latest.settings.fullscreen}};
  const command:PlayerCommand={commandId:crypto.randomUUID(),token:o.token,campaignId:o.id,expectedRevision:latest.settings.revision,expectedFocusId:focus.focusId,expectedFocusRevision:focus.focusRevision,expectedFocusMembershipRevision:focus.focusMembershipRevision,expectedFocusLocationId:focus.focusLocationId,action};
  const confirmed=unwrap(await window.campaign.executePlayer(command));if(!owns(o)||intent!==actions)return false;publish(o,confirmed,request);
  unwrap(await window.campaign.playerWindow(o.token,true));if(!owns(o)||intent!==actions)return false;await reload(o);
  if(owns(o)&&intent===actions)tell(kind==='location'?'Ortsbild auf der Spieleranzeige geöffnet.':'Handout auf der Spieleranzeige geöffnet.');
  return owns(o)&&intent===actions;
 }catch(error){if(owns(o)&&intent===actions)tell((error as Error).message,true);return false;}
}
export function initPlayerUI(status:typeof tell,getContext:typeof context,flush:typeof before){
 tell=status;context=getContext;before=flush;
 el('player-open-controls').onclick=()=>{generation++;presentation++;const o=owner();run(o,async(o)=>{
  if(!await before()||!owns(o))return;
  const screens=await window.campaign.playerScreens();if(!owns(o))return;
  if(!hasView(o)){baseline.clear();view=null;viewOwner=null;}
  options('player-screen',unwrap(screens).map(s=>({id:String(s.id),name:s.name})),value('player-screen')||null,true);
  if(await reload(o)&&owns(o))el<HTMLDialogElement>('player-dialog').showModal();
 });};
 el('player-close-controls').onclick=closeControls;el<HTMLDialogElement>('player-dialog').oncancel=event=>{event.preventDefault();closeControls();};el('player-refresh').onclick=()=>run(owner(),reload);
 el('player-show-follow').onclick=()=>submit(settings('follow',false),true);el('player-show-image').onclick=()=>submit(settings('image',false),true);el('player-blank').onclick=()=>submit({kind:'blank'});
 el('player-close-window').onclick=()=>{const o=owner();if(!o||!hasView(o))return;const intent=++actions;run(o,async o=>{unwrap(await window.campaign.playerWindow(o.token,false));if(owns(o)&&intent===actions)await reload(o);});};
 el('player-art-kind').onchange=subjectOptions;
 el('player-pick-art').onclick=()=>{
  const o=owner();if(!o||!hasView(o))return;
  const kind=value('player-art-kind') as 'location'|'npc'|'custom',subject=value('player-art-subject')||null,title=value('player-art-title'),request=++presentation;
  run(o,async o=>{const response=await window.campaign.pickPlayerArt(o.token,kind,subject,title);if(!owns(o)||request!==presentation)return;const result=unwrap(response);if(result&&publish(o,result,request))tell('Bild lokal hinterlegt.');});
 };
 for(const kind of ['discover','forget'] as const)el('player-'+kind).onclick=()=>submit({kind,characterIds:[...el('player-observers').querySelectorAll<HTMLInputElement>('[data-player-character]:checked')].map(e=>e.value),mapId:value('player-map'),q:Number(value('player-q')),r:Number(value('player-r')),locationId:value('player-place')||null,publicLabel:value('player-public-label')});
 el('player-mask-save').onclick=()=>submit({kind:'mask',mapId:value('player-map'),q:Number(value('player-q')),r:Number(value('player-r')),hidden:input('player-cell-hidden').checked,blocksSight:input('player-cell-blocks').checked,publicLabel:value('player-public-label')});
}

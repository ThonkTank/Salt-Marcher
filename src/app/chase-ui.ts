import type {Workspace} from './contracts';
import type {Character,LiveScene} from './live-contracts';
import {chaseActionControls,checkedChaseView,type ChaseCommand,type ChaseView} from './chase-contracts';
import {hasPendingCommit,onCommitResolved,onCommitState,writeConfirmed,type CommitResolution} from './commit-confirmation';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const val=(id:string)=>el<HTMLInputElement>(id).value;
let w:Workspace|null=null,scene:LiveScene|null=null,roster:Character[]=[],rosterBasis='',view:ChaseView|null=null,tell:(s:string,e?:boolean)=>void,busy=false;
let nonce=0,requestedId:string|undefined,loading=false,loadError='',rendered='';
type Draft={fields:Record<string,string>;rows:Record<string,{distance?:string;exhaustion?:string}>};
// Unconfirmed rounds remain explicit proposals, separate from the durable round counter.
// Keep them per mask while navigating this workspace; a confirmed round consumes them.
const drafts=new Map<string,Draft>();
const fieldIds=['chase-name','chase-side','chase-speed','chase-complication','chase-outcome'];
const draftKey=()=>view?.chase?scene!.id+':'+view.chase.id:null;
function draft(){const key=draftKey();if(!key)return null;let d=drafts.get(key);if(!d){d={fields:{},rows:{}};drafts.set(key,d);}return d;}
function pending(){return busy||!!w&&hasPendingCommit(w.campaign.id);}
function ready(){return !!w&&!!scene&&!loading&&!loadError&&(!requestedId||view?.chase?.id===requestedId);}
function clearWorkInput(){for(const id of fieldIds)el<HTMLInputElement>(id).value=id==='chase-speed'?'9':id==='chase-side'?'pursuer':'';}
function restoreWorkInput(){clearWorkInput();for(const [id,value]of Object.entries(draft()?.fields??{}))el<HTMLInputElement>(id).value=value;}
export function initChase(status:typeof tell){
 tell=status;const root=document.createElement('section');root.id='chase-panel';root.hidden=true;
 root.innerHTML='<div class="toolbar"><h2>Verfolgung führen</h2><button id="chase-new">Neue Verfolgung</button><button id="chase-refresh">Aktualisieren</button></div><p id="chase-load-status" role="status" hidden></p><label id="chase-recent-row" hidden>Verfolgung auswählen<select id="chase-recent"></select></label><div id="chase-create"><label>Titel<input id="chase-title" value="Verfolgungsjagd" maxlength="1000"></label><label>Ziel / Abbruchbedingung<input id="chase-goal" placeholder="Tor erreichen oder 60 m Abstand" maxlength="4000"></label><button id="chase-start">Verfolgung beginnen</button></div><div id="chase-work" hidden><p id="chase-status"></p><div id="chase-people"></div><details><summary>Teilnehmer hinzufügen</summary><label>Name<input id="chase-name" maxlength="1000"></label><label>Rolle<select id="chase-side"><option value="pursuer">Verfolger</option><option value="quarry">Flüchtend</option></select></label><button id="chase-party" type="button">Scene-Gruppe als diese Rolle übernehmen</button><label>Tempo pro Runde (m)<input id="chase-speed" type="number" value="9" min="0" max="1000000"></label><button id="chase-add">Hinzufügen</button></details><label>Komplikation dieser Runde<input id="chase-complication" placeholder="Marktstand versperrt den Weg" maxlength="4000"></label><button id="chase-round">Runde bestätigen</button><label>Ergebnis<textarea id="chase-outcome" maxlength="10000"></textarea></label><button id="chase-finish">Verfolgung abschließen</button></div>';
 document.querySelector('#combat-panel')!.after(root);onCommitState(draw);onCommitResolved(recovered);
 root.addEventListener('input',event=>{const input=event.target as HTMLInputElement;if(!ready()||pending())return;const d=draft();if(!d)return;if(fieldIds.includes(input.id))d.fields[input.id]=input.value;const row=input.closest<HTMLElement>('[data-id]');if(row&&(input.hasAttribute('data-distance')||input.hasAttribute('data-exhaustion'))){const r=d.rows[row.dataset.id!]??={};r[input.hasAttribute('data-distance')?'distance':'exhaustion']=input.value;}syncActions();});
 el('chase-side').onchange=()=>{if(ready()&&!pending()){const d=draft();if(d)d.fields['chase-side']=val('chase-side');}};
 el('chase-new').onclick=()=>{if(!w||!scene||pending()||loading)return;nonce++;requestedId=undefined;loadError='';if(view)view={...view,chase:null};rendered='';clearWorkInput();draw();};
 el('chase-refresh').onclick=()=>{if(!pending())void load(requestedId??view?.chase?.id);};
 el<HTMLSelectElement>('chase-recent').onchange=()=>{if(!pending())void load(val('chase-recent')||undefined);};
 el('chase-title').oninput=syncActions;
 el('chase-start').onclick=()=>void command({kind:'create',title:val('chase-title'),goal:val('chase-goal')});
 el('chase-party').onclick=()=>void addSceneParty();
 el('chase-add').onclick=()=>void command({kind:'participant',participant:{id:crypto.randomUUID(),characterId:null,name:val('chase-name'),side:val('chase-side') as 'pursuer'|'quarry',distance:0,speed:Number(val('chase-speed')),exhaustion:0,notes:''}});
 el('chase-round').onclick=()=>void command({kind:'round',changes:[...el('chase-people').querySelectorAll<HTMLElement>('[data-id]')].map(row=>({participantId:row.dataset.id!,distance:Number((row.querySelector('[data-distance]') as HTMLInputElement).value),exhaustion:Number((row.querySelector('[data-exhaustion]') as HTMLInputElement).value)})),complication:val('chase-complication')});
 el('chase-finish').onclick=()=>void command({kind:'finish',outcome:val('chase-outcome')});
}
export function chaseContext(next:Workspace|null,current:LiveScene|null,characters:Character[]=[]){
 const workspaceChanged=next?.token!==w?.token,changed=workspaceChanged||current?.id!==scene?.id,nextBasis=JSON.stringify(characters.filter(c=>c.active&&c.sceneId===current?.id).map(c=>[c.id,c.membershipRevision])),partyChanged=nextBasis!==rosterBasis;
 if(workspaceChanged)drafts.clear();w=next;scene=current;roster=characters;rosterBasis=nextBasis;el('chase-panel').hidden=!current;
 if(changed){nonce++;requestedId=undefined;loading=false;loadError='';rendered='';clearWorkInput();el<HTMLInputElement>('chase-title').value='Verfolgungsjagd';el<HTMLInputElement>('chase-goal').value='';view=null;draw();if(current)void load();}
 else{draw();if(partyChanged&&current&&view?.chase?.status==='running'&&!pending())void load(view.chase.id);}
}
function sceneCharacters(){const linked=new Set(view?.chase?.participants.map(p=>p.characterId).filter(Boolean));return roster.filter(c=>c.active&&c.sceneId===scene?.id&&!linked.has(c.id));}
async function addSceneParty(){if(!ready()||pending())return;const side=val('chase-side') as 'pursuer'|'quarry',participants=sceneCharacters().map(c=>({id:crypto.randomUUID(),characterId:c.id,name:c.profile.name,side,distance:0,speed:Math.round((c.profile.speedFeet??30)*0.3),exhaustion:0,notes:''}));if(!participants.length){tell('Alle Figuren dieser Scene sind bereits in der Verfolgung.',true);return;}await command({kind:'participants',participants});}
async function load(id?:string){
 if(!w||!scene)return;const token=w.token,sceneId=scene.id,request=++nonce;requestedId=id;loading=true;loadError='';draw();
 const current=()=>nonce===request&&w?.token===token&&scene?.id===sceneId;
 try{const r=await window.campaign.chase(token,sceneId,id);if(!current())return;if(!r.ok)throw new Error(r.error);const next=checkedChaseView(r.value);if(next.chase&&(next.chase.sceneId!==sceneId||id&&next.chase.id!==id)||id&&!next.chase)throw new Error('Antwort gehört zu einer anderen Verfolgung. Erneut laden.');const previous=view?.chase?.id;view=next;requestedId=next.chase?.id;if(previous!==next.chase?.id)restoreWorkInput();}
 catch(e){if(!current())return;loadError=(e as Error).message;tell(loadError,true);}
 finally{if(current()){loading=false;draw();}}
}
async function command(action:ChaseCommand['action'],ownerId=view?.chase?.id){
 if(!ready()||pending())return;const c=view?.chase,creating=action.kind==='create';if(!creating&&(!c||c.id!==ownerId||c.status!=='running'))return;
 const token=w!.token,campaignId=w!.campaign.id,sceneId=scene!.id,requestNonce=nonce,key=draftKey(),request:ChaseCommand={commandId:crypto.randomUUID(),campaignId,token,sceneId,chaseId:creating?null:c!.id,expectedRevision:creating?null:c!.revision,action};
 const current=()=>w?.token===token&&scene?.id===sceneId&&nonce===requestNonce;
 busy=true;draw();
 try{const result=checkedChaseView(await writeConfirmed('chase',request,()=>window.campaign.executeChase(request),current,{owner:'chase',token,sceneId,chaseId:request.chaseId,actionKind:action.kind}));if(!current())return;if(!result.chase||result.chase.sceneId!==sceneId||!creating&&result.chase.id!==c!.id){loadError='Buchungsantwort gehört zu einer anderen Verfolgung. Neu laden.';throw new Error(loadError);}
  if(creating){el<HTMLInputElement>('chase-title').value='Verfolgungsjagd';el<HTMLInputElement>('chase-goal').value='';clearWorkInput();}
  const d=key?drafts.get(key):undefined;if(action.kind==='participant'){el<HTMLInputElement>('chase-name').value='';if(d)delete d.fields['chase-name'];}
  if(action.kind==='round'){el<HTMLInputElement>('chase-complication').value='';if(d){d.rows={};delete d.fields['chase-complication'];}}
  if(action.kind==='finish'){if(key)drafts.delete(key);clearWorkInput();}
  view=result;requestedId=result.chase.id;tell('Verfolgung gespeichert.');
 }catch(e){if(current())tell((e as Error).message,true);}finally{busy=false;draw();}
}
async function recovered(event:CommitResolution){
 if(event.ref.family!=='chase'||w?.campaign.id!==event.ref.campaignId||!scene)return;
 const result=checkedChaseView(event.value as ChaseView),c=result.chase,meta=event.meta as {token?:string;sceneId?:string;chaseId?:string;actionKind?:string}|undefined;
 if(!c||c.sceneId!==scene.id)return;
 const own=meta?.token===w.token&&meta.sceneId===scene.id&&(meta.chaseId===c.id||meta.actionKind==='create');
 if(own){const key=scene.id+':'+c.id,d=drafts.get(key);if(meta.actionKind==='round'&&d){d.rows={};delete d.fields['chase-complication'];}if(meta.actionKind==='finish')drafts.delete(key);if(requestedId===c.id){if(meta.actionKind==='round')el<HTMLInputElement>('chase-complication').value='';if(meta.actionKind==='finish')clearWorkInput();}}
 if(requestedId===c.id||own&&meta.actionKind==='create'&&!requestedId)await load(c.id);
}
function syncActions(){const c=view?.chase,blocked=pending()||!ready(),closed=blocked||!c||c.status!=='running',controls=chaseActionControls({title:val('chase-title'),participantName:val('chase-name'),participantCount:c?.participants.length??0,outcome:val('chase-outcome')});el<HTMLButtonElement>('chase-start').disabled=blocked||!!c&&c.status==='running'||!controls.start;el<HTMLButtonElement>('chase-party').disabled=closed||!sceneCharacters().length;el<HTMLButtonElement>('chase-add').disabled=closed||!controls.addParticipant;el<HTMLButtonElement>('chase-round').disabled=closed||!controls.advanceRound;el<HTMLButtonElement>('chase-finish').disabled=closed||!controls.finish;}
function draw(){
 const c=view?.chase,blocked=pending(),available=ready(),select=el<HTMLSelectElement>('chase-recent');el('chase-panel').setAttribute('aria-busy',String(loading));
 const message=el('chase-load-status');message.hidden=!loading&&!loadError;message.setAttribute('role',loadError?'alert':'status');message.textContent=loading?'Verfolgung wird geladen …':loadError?loadError+' Mit „Aktualisieren“ erneut laden.':'';
 select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Verfolgung auswählen';select.append(empty);
 const recent=[...(view?.recent??[])];if(c&&!recent.some(r=>r.id===c.id))recent.unshift(c);if(requestedId&&!recent.some(r=>r.id===requestedId))recent.push({id:requestedId,title:'Ausgewählte Verfolgung',status:'running'});
 for(const r of recent){const option=document.createElement('option');option.value=r.id;option.textContent=r.title+' · '+(r.status==='running'?'laufend':r.status==='retired'?'archiviert':'abgeschlossen');select.append(option);}select.value=requestedId??c?.id??'';
 el('chase-recent-row').hidden=!recent.length;el('chase-create').hidden=!available||!!c&&c.status==='running';el('chase-work').hidden=!c||!available;
 for(const x of el('chase-panel').querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLTextAreaElement|HTMLSelectElement>('input,button,textarea,select'))x.disabled=blocked||!available;
 select.disabled=blocked||!scene;el<HTMLButtonElement>('chase-refresh').disabled=blocked||!scene||loading;el<HTMLButtonElement>('chase-new').disabled=blocked||!scene||loading;
 if(!c){el('chase-people').replaceChildren();rendered='';syncActions();return;}
 el('chase-status').textContent=c.title+' · Runde '+c.round+' · Ziel: '+(c.goal||'offen')+(c.complication?' · Letzte Komplikation: '+c.complication:'')+(c.status==='finished'?' · '+c.outcome:c.status==='retired'?' · archiviert; kein Ergebnis abgeleitet':'');
 const identity=scene!.id+':'+c.id+':'+c.revision;if(rendered!==identity){rendered=identity;const root=el('chase-people'),d=draft();root.replaceChildren();if(d)for(const id of Object.keys(d.rows))if(!c.participants.some(p=>p.id===id))delete d.rows[id];
 for(const p of c.participants){const row=document.createElement('div');row.className='chase-row';row.dataset.id=p.id;row.innerHTML='<strong></strong><label>Abstand m<input data-distance type="number" min="-1000000" max="1000000"></label><label>Erschöpfung<input data-exhaustion type="number" min="0" max="6"></label><button data-visibility type="button"></button><button data-remove type="button">Entfernen</button>';row.querySelector('strong')!.textContent=p.name+' · '+(p.side==='pursuer'?'Verfolger':'Flüchtend')+' · Tempo '+p.speed+' m'+(p.hiddenFromPlayers?' · auf Anzeige verborgen':'');(row.querySelector('[data-distance]') as HTMLInputElement).value=d?.rows[p.id]?.distance??String(p.distance);(row.querySelector('[data-exhaustion]') as HTMLInputElement).value=d?.rows[p.id]?.exhaustion??String(p.exhaustion);const visibility=row.querySelector<HTMLButtonElement>('[data-visibility]')!;visibility.hidden=!!p.characterId;visibility.textContent=p.hiddenFromPlayers?'Auf Spieleranzeige zeigen':'Auf Spieleranzeige verbergen';visibility.onclick=()=>void command({kind:'visibility',participantId:p.id,hidden:!p.hiddenFromPlayers},c.id);row.querySelector<HTMLButtonElement>('[data-remove]')!.onclick=()=>void command({kind:'remove',participantId:p.id},c.id);root.append(row);}}
 for(const x of el('chase-work').querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLTextAreaElement|HTMLSelectElement>('input,button,textarea,select'))x.disabled=blocked||!available||c.status!=='running';syncActions();
}
export async function flushChase(){return !busy&&(!w||!hasPendingCommit(w.campaign.id));}

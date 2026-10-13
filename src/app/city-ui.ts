import type {Workspace,Result} from './contracts';
import type {CityView,CityUnit,CityPoint,CityCommand,CityOverview,CityPreview,CityRecipe} from './city-contracts';
import {citySvg,generateCity,posed,roadPoints} from './city-model';
const el=<T extends Element = HTMLElement>(id:string)=>document.getElementById(id) as unknown as T,field=(id:string)=>el<HTMLInputElement>(id),value=(id:string)=>field(id).value;
const unwrap=<T>(r:Result<T>):T=>{if(!r.ok)throw new Error(r.error);return r.value;};
let workspace:Workspace|null=null,view:CityView|null=null,overview:CityOverview|null=null,selected:string|null=null,path:CityPoint[]=[],preview:CityPreview|null=null,pending:Promise<boolean>|null=null,dirty=false,timer:ReturnType<typeof setTimeout>|null=null,tell:(s:string,error?:boolean)=>void;
let epoch=0,readRequest=0,selectionRequest=0,creating=false;
let generationJob:{token:string;epoch:number;cityId:string;cancelled:boolean}|null=null;
const owned=(token:string|undefined,g:number)=>epoch===g&&workspace?.token===token;
const run=(f:()=>Promise<unknown>|void)=>{const token=workspace?.token,g=epoch;void Promise.resolve().then(()=>{if(owned(token,g))return f();}).catch(e=>{if(owned(token,g))tell(e.message,true);});};
function clearTimer(){if(timer)clearTimeout(timer);timer=null;}
function cancelGeneration(){if(generationJob)generationJob.cancelled=true;generationJob=null;el<HTMLButtonElement>('city-generate').disabled=false;}

function opts(id:string,rows:{id:string;name:string}[],selectedId:string|null){const s=el<HTMLSelectElement>(id);s.replaceChildren();for(const row of rows){const o=document.createElement('option');o.value=row.id;o.textContent=row.name;s.append(o);}if(selectedId&&rows.some(r=>r.id===selectedId))s.value=selectedId;}
export function activateCity(w:Workspace){cancelGeneration();clearTimer();workspace=w;epoch++;creating=false;readRequest++;selectionRequest++;pending=null;view=null;overview=null;selected=null;dirty=false;path=[];preview=null;el<HTMLDialogElement>('city-new-dialog').close();render();}
async function readSelectedCity(id:string,token:string,g:number,request:number){
 try{const response=await window.campaign.city(token,id);if(!owned(token,g)||request!==readRequest)return;
  if(dirty){el<HTMLSelectElement>('city-select').value=view?.header.id??'';tell('Neue Eingabe bleibt offen. Stadt bei Bedarf erneut wählen.',true);return;}
  view=unwrap(response);selected=null;dirty=false;preview=null;path=[];render();
 }catch(error){if(owned(token,g)&&request===readRequest)tell((error as Error).message,true);}
}
export async function openCity(){
 const w=workspace,g=epoch,request=++readRequest;if(!w)return;
 try{if(!await flushCity()||!owned(w.token,g)||request!==readRequest)return;
  const response=await window.campaign.cities(w.token);if(!owned(w.token,g)||request!==readRequest)return;
  overview=unwrap(response);opts('city-select',overview.cities,view?.header.id??null);opts('city-location',overview.locations,view?.header.locationId??null);el('city-new-open').toggleAttribute('disabled',!overview.locations.length);el('city-empty').textContent=overview.locations.length?'Lege eine Stadt an oder öffne einen vorhandenen Stadtplan.':'Lege zuerst einen Ort unter „Welt und Spielabend“ an. Die Stadt verwendet dieselbe Ortsidentität.';
  if(overview.cities.length)await readSelectedCity(value('city-select'),w.token,g,request);else{view=null;render();}
 }catch(error){if(owned(w.token,g)&&request===readRequest)tell((error as Error).message,true);}
}
async function change(action:CityCommand['action']){
 const w=workspace,g=epoch,source=view;if(!w)throw new Error('Kampagne öffnen.');const id=action.kind==='create'?action.header.id:source?.header.id;if(!id)throw new Error('Stadt öffnen.');
 const command={commandId:crypto.randomUUID(),token:w.token,campaignId:w.campaign.id,cityId:id,expectedRevision:action.kind==='create'?0:source!.header.revision,action};readRequest++;
 const response=await window.campaign.executeCity(command);if(!owned(w.token,g)||view?.header.id!==source?.header.id)throw new Error('Stadtkontext gewechselt.');
 const result=unwrap(response);readRequest++;view=result;preview=null;render();tell('Stadt gespeichert.');return result;
}
function unit(){return view?.units.find(u=>u.id===selected);}
function inspector(){const u=unit();el('city-inspector').hidden=!u;el('city-building-fields').hidden=u?.kind!=='building';if(!u||dirty)return;field('city-unit-name').value=u.name;field('city-unit-protected').checked=u.protected;field('city-unit-width').value=String(u.width??10);el('city-width-field').hidden=!['road','wall'].includes(u.kind);el('city-outline-field').hidden=['building','node'].includes(u.kind);el<HTMLTextAreaElement>('city-unit-points').value=(['road','wall'].includes(u.kind)?roadPoints(u,view!.units):u.outline??[]).map(p=>p.x+', '+p.y).join('\n');if(u.kind==='building'){field('city-x').value=String(u.position!.x);field('city-y').value=String(u.position!.y);field('city-angle').value=String((u.angle??0)*180/Math.PI);const p=u.outline!;field('city-house-width').value=String(Math.max(...p.map(p=>p.x))-Math.min(...p.map(p=>p.x)));field('city-house-depth').value=String(Math.max(...p.map(p=>p.y))-Math.min(...p.map(p=>p.y)));field('city-unit-use').value=u.use??'';el<HTMLTextAreaElement>('city-unit-notes').value=u.notes??'';el('city-interior-status').textContent=u.interior?'Leere Innenraumhülle angelegt · '+(u.rooms?.length??0)+' ausdrücklich angelegte Räume':'Innenräume noch nicht angelegt.';}el('city-unit-type').textContent={node:'Straßenknoten',road:'Straße',wall:'Befestigung',district:'Viertel',water:'Wasserfläche',plaza:'Platz',building:'Haus'}[u.kind];}
function render(){const has=!!view;el('city-workbench').hidden=!has;el('city-empty').hidden=has;if(!view)return;el('city-title').textContent=view.header.name;el<HTMLButtonElement>('city-undo').disabled=!view.canUndo;el<HTMLButtonElement>('city-redo').disabled=!view.canRedo;el('city-count').textContent=view.units.filter(u=>u.kind==='building').length+' Häuser · '+view.units.filter(u=>u.kind==='building'&&u.protected).length+' geschützt · Metergeometrie';opts('city-district',view.units.filter(u=>u.kind==='district'),el<HTMLSelectElement>('city-district').value||null);field('city-paper').value=view.header.paper;field('city-roof').value=view.header.roof;
 const all=preview?{...view,units:[...view.units.filter(u=>!preview!.replaceIds.includes(u.id)),...preview.buildings]}:view;const markup=citySvg(all),doc=new DOMParser().parseFromString(markup,'image/svg+xml'),canvas=el<SVGSVGElement>('city-map');canvas.setAttribute('viewBox',doc.documentElement.getAttribute('viewBox')!);canvas.replaceChildren(...Array.from(doc.documentElement.children).map(n=>document.importNode(n,true)));canvas.setAttribute('aria-label',view.header.name+' in Metern');const z=Number(value('city-zoom')),focus=z>1?(unit()?.position??{x:view.header.width/2,y:view.header.height/2}):{x:view.header.width/2,y:view.header.height/2},vw=view.header.width/z,vh=view.header.height/z;canvas.setAttribute('viewBox',`${focus.x-vw/2} ${focus.y-vh/2} ${vw} ${vh}`);
 // Geometry stays native and individually selectable after acceptance.
 const ns='http://www.w3.org/2000/svg';for(const u of view.units.filter(u=>u.kind!=='node').sort((a,b)=>Number(['road','wall'].includes(a.kind))-Number(['road','wall'].includes(b.kind)))){let p:CityPoint[]=[],tag='polygon';if(['road','wall'].includes(u.kind)){p=roadPoints(u,view.units);tag='polyline';}else p=u.kind==='building'?posed(u):u.outline??[];const hit=document.createElementNS(ns,tag);hit.setAttribute('points',p.map(p=>p.x+','+p.y).join(' '));hit.setAttribute('fill',tag==='polyline'?'none':'transparent');hit.setAttribute('stroke',u.id===selected?'#176c74':'transparent');hit.setAttribute('stroke-width',String(tag==='polyline'?Math.max(8,u.width??6):1.8));hit.dataset.cityUnit=u.id;hit.addEventListener('click',e=>{if(value('city-tool')!=='select')return;e.stopPropagation();run(async()=>{if(!(await flushCity()))return;selected=u.id;render();});});canvas.append(hit);}
 if(path.length){const line=document.createElementNS(ns,'polyline');line.setAttribute('points',path.map(p=>p.x+','+p.y).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#176c74');line.setAttribute('stroke-width','2');canvas.append(line);for(const p of path){const c=document.createElementNS(ns,'circle');c.setAttribute('cx',String(p.x));c.setAttribute('cy',String(p.y));c.setAttribute('r','2');c.setAttribute('fill','#176c74');canvas.append(c);}}
 el('city-preview-actions').hidden=!preview;el('city-preview-summary').textContent=preview?'Seed '+preview.recipe.seed+' · '+preview.buildings.length+' vorgeschlagene Häuser · '+preview.replaceIds.length+' ungeschützte Häuser werden ersetzt · geschützte Häuser bleiben erhalten.':'';el('city-path-hint').textContent=path.length?path.length+' Punkte · Enter/Abschließen übernimmt · Escape verwirft':'Wähle ein Werkzeug und klicke seine Punkte in die Karte.';inspector();}
function inspectorFields(){return JSON.stringify([...el('city-unit-form').querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('input,textarea')].map(i=>[i.id,i.type==='checkbox'?(i as HTMLInputElement).checked:i.value]));}
function collectUnit(u:CityUnit){const next={...u,name:value('city-unit-name'),protected:field('city-unit-protected').checked},extra:CityUnit[]=[];if(!['building','node'].includes(u.kind)){const points=value('city-unit-points').split(/\r?\n/).filter(s=>s.trim()).map(s=>{const [x,y]=s.split(',').map(Number);if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error('Ein Punkt pro Zeile: x, y.');return{x:x!,y:y!};});if(['road','wall'].includes(u.kind)){if(points.length<2)throw new Error('Straße benötigt zwei Enden.');for(const [i,p]of [[0,points[0]],[1,points.at(-1)]] as const){const n=view!.units.find(n=>n.id===u.nodeIds![i]);if(!n||!p)throw new Error('Straßenknoten fehlt.');extra.push({...n,point:p});}next.via=points.slice(1,-1);}else next.outline=points;next.protected=true;}if(['road','wall'].includes(u.kind))next.width=Number(value('city-unit-width'));if(u.kind==='building'){const oldWidth=Math.max(...u.outline!.map(p=>p.x))-Math.min(...u.outline!.map(p=>p.x)),oldDepth=Math.max(...u.outline!.map(p=>p.y))-Math.min(...u.outline!.map(p=>p.y)),sx=Number(value('city-house-width'))/oldWidth,sy=Number(value('city-house-depth'))/oldDepth;if(!Number.isFinite(sx+sy)||sx<=0||sy<=0)throw new Error('Positive Hausmaße eingeben.');next.position={x:Number(value('city-x')),y:Number(value('city-y'))};next.angle=Number(value('city-angle'))*Math.PI/180;next.outline=u.outline!.map(p=>({x:p.x*sx,y:p.y*sy}));next.rooms=(u.rooms??[]).map(r=>({...r,outline:r.outline.map(p=>({x:p.x*sx,y:p.y*sy}))}));next.use=value('city-unit-use');next.notes=value('city-unit-notes');next.protected=true;}return [...extra,next];}
function saveInspector():Promise<boolean>{
 if(pending)return pending;const w=workspace,g=epoch,id=view?.header.id,unitId=selected;if(!w||!id||!unitId||!dirty)return Promise.resolve(true);
 const task=Promise.resolve().then(async()=>{try{
  while(owned(w.token,g)&&view?.header.id===id&&selected===unitId&&dirty){
   clearTimer();const u=unit();if(!u)throw new Error('Stadtelement fehlt.');const fields=inspectorFields(),upsert=collectUnit(u);
   await change({kind:'change',upsert,remove:[],label:'Element bearbeiten'});
   if(!owned(w.token,g)||view?.header.id!==id||selected!==unitId)return false;
   dirty=fields!==inspectorFields();inspector();
  }
  return owned(w.token,g)&&view?.header.id===id&&selected===unitId;
 }catch(error){if(owned(w.token,g)&&view?.header.id===id)tell((error as Error).message,true);return false;}finally{if(pending===task)pending=null;}});pending=task;return task;
}
export async function flushCity(){
 const token=workspace?.token,g=epoch,id=view?.header.id;clearTimer();
 if(path.length){tell('Schließe den begonnenen Stadtzug ab oder verwirf ihn.',true);return false;}
 if(generationJob){tell('Bebauung läuft. Vorschau abschließen oder abbrechen.',true);return false;}
 return await saveInspector()&&owned(token,g)&&view?.header.id===id;
}
async function reloadInspector(){
 const w=workspace,g=epoch,id=view?.header.id,unitId=selected;if(!w||!id||!unitId)return;
 if(generationJob){tell('Bebauung zuerst abschließen oder abbrechen.',true);return;}clearTimer();
 if(pending)await pending;if(!owned(w.token,g)||view?.header.id!==id||selected!==unitId)return;
 const fields=inspectorFields(),request=++readRequest;
 const response=await window.campaign.city(w.token,id);if(!owned(w.token,g)||request!==readRequest||selected!==unitId)return;
 if(fields!==inspectorFields()){tell('Neue Eingabe bleibt offen. Bei Bedarf erneut laden.',true);return;}
 const saved=unwrap(response);view=saved;dirty=false;clearTimer();preview=null;if(!unit())selected=null;render();tell('Gespeichertes Element geladen.');
}
async function finish(){if(!view)return;const kind=value('city-tool');if(['road','wall'].includes(kind)){if(path.length<2)throw new Error('Mindestens zwei Straßenpunkte anklicken.');const nodes:CityUnit[]=[];const end=(p:CityPoint)=>{const n=view!.units.find(u=>u.kind==='node'&&Math.hypot(u.point!.x-p.x,u.point!.y-p.y)<4);if(n)return n.id;const id=crypto.randomUUID();nodes.push({id,kind:'node',name:'',protected:true,point:{...p}});return id;};const u:CityUnit={id:crypto.randomUUID(),kind:kind as 'road'|'wall',name:kind==='road'?'Neue Straße':'Stadtmauer',protected:true,nodeIds:[end(path[0]!),end(path.at(-1)!)],via:path.slice(1,-1),width:Number(value('city-draw-width'))};await change({kind:'change',upsert:[...nodes,u],remove:[],label:'Straßenzug anlegen'});selected=u.id;}else{if(path.length<3)throw new Error('Mindestens drei Flächenecken anklicken.');const u:CityUnit={id:crypto.randomUUID(),kind:kind as 'district'|'plaza'|'water',name:kind==='district'?'Neues Viertel':kind==='plaza'?'Neuer Platz':'Wasser',protected:true,outline:[...path]};await change({kind:'change',upsert:[u],remove:[],label:'Fläche anlegen'});selected=u.id;}path=[];field('city-tool').value='select';render();}
async function createCity(){
 const w=workspace,g=epoch,sourceId=view?.header.id;if(!w||creating)return;
 const header={id:crypto.randomUUID(),revision:1,name:value('city-new-name'),locationId:value('city-location'),width:Number(value('city-new-width')),height:Number(value('city-new-height')),paper:'#e9dfc8',roof:'#9c604c'};
 creating=true;try{if(!await flushCity()||!owned(w.token,g)||view?.header.id!==sourceId)return;
  await change({kind:'create',header});if(!owned(w.token,g))return;el<HTMLDialogElement>('city-new-dialog').close();await openCity();
 }finally{if(owned(w.token,g))creating=false;}
}
export function initCity(status:typeof tell){tell=status;
 el('city-new-open').onclick=()=>el<HTMLDialogElement>('city-new-dialog').showModal();el('city-new-cancel').onclick=()=>el<HTMLDialogElement>('city-new-dialog').close();
 el<HTMLFormElement>('city-new-form').onsubmit=e=>{e.preventDefault();run(createCity);};
 el<HTMLSelectElement>('city-select').onchange=()=>run(async()=>{const w=workspace,g=epoch,target=value('city-select'),intent=++selectionRequest;if(!w||!await flushCity()||!owned(w.token,g)||intent!==selectionRequest)return;await readSelectedCity(target,w.token,g,++readRequest);});
 el('city-refresh').onclick=()=>run(async()=>{if(await flushCity())await openCity();});
 el('city-finish').onclick=()=>run(finish);el('city-cancel-path').onclick=()=>{path=[];render();};el('city-tool').onchange=()=>{path=[];preview=null;render();};
 el('city-map').addEventListener('click',e=>run(async()=>{if(!view||value('city-tool')==='select')return;if(dirty&&!(await saveInspector()))return;const canvas=el<SVGSVGElement>('city-map'),event=e as MouseEvent,point=canvas.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const p=point.matrixTransform(canvas.getScreenCTM()!.inverse()),at={x:Math.round(p.x*10)/10,y:Math.round(p.y*10)/10};if(value('city-tool')==='building'){const size=Number(value('city-size')),u:CityUnit={id:crypto.randomUUID(),kind:'building',name:'',protected:true,position:at,angle:0,outline:[{x:-size/2,y:-size/2},{x:size/2,y:-size/2},{x:size/2,y:size/2},{x:-size/2,y:size/2}],use:value('city-use'),notes:'',districtId:value('city-district')||null,ownerId:null,rooms:[],interior:false};await change({kind:'change',upsert:[u],remove:[],label:'Haus anlegen'});selected=u.id;render();}else{path.push(at);render();}}));
 el('city-zoom').oninput=()=>run(async()=>{if(await flushCity())render();});
 el('city-map').addEventListener('keydown',e=>{const k=e as KeyboardEvent;if(k.key==='Enter'){k.preventDefault();run(finish);}if(k.key==='Escape'){path=[];render();}});
 el('city-generate').onclick=()=>run(async()=>{
  const w=workspace,g=epoch,source=view;if(!w||!source)return;
  const recipe:CityRecipe={seed:value('city-seed'),density:Number(value('city-density')),size:Number(value('city-size')),reach:Number(value('city-reach')),districtId:value('city-district'),use:value('city-use')};
  if(!await flushCity()||!owned(w.token,g)||view?.header.id!==source.header.id)return;
  const basis=view,job={token:w.token,epoch:g,cityId:basis.header.id,cancelled:false};preview=null;generationJob=job;el<HTMLButtonElement>('city-generate').disabled=true;
  const active=()=>generationJob===job&&!job.cancelled&&owned(job.token,job.epoch)&&view?.header.id===job.cityId;
  try{const result=await generateCity(basis,recipe,()=>!active(),n=>{if(active())el('city-preview-summary').textContent=n+' Häuser in Vorbereitung…';});
   if(!active())return;if(view!.header.revision!==result.baseRevision)throw new Error('Stadt verändert. Neue Vorschau erzeugen.');preview=result;render();if(!preview.buildings.length)tell('Keine Häuser passen zu diesen Vorgaben. Fläche, Straßenabstand oder Hausgröße anpassen.',true);
  }catch(error){if(active())tell((error as Error).message,true);}finally{if(generationJob===job){generationJob=null;el<HTMLButtonElement>('city-generate').disabled=false;}}
 });
 for(const id of ['city-seed','city-density','city-size','city-reach','city-use','city-district'])el(id).onchange=()=>{cancelGeneration();if(preview){preview=null;render();}};
 el('city-cancel-preview').onclick=()=>{cancelGeneration();preview=null;render();};el('city-preview-accept').onclick=()=>run(async()=>{if(!preview||!view)return;if(preview.baseRevision!==view.header.revision)throw new Error('Stadt verändert. Neue Vorschau erzeugen.');await change({kind:'change',upsert:preview.buildings,remove:preview.replaceIds,label:'Bebauung übernehmen'});});
 for(const id of ['city-undo','city-redo'])el(id).onclick=()=>run(async()=>{if(await flushCity())await change({kind:id==='city-undo'?'undo':'redo'});});
 el<HTMLFormElement>('city-unit-form').onsubmit=e=>{e.preventDefault();run(saveInspector);};el('city-unit-form').addEventListener('input',()=>{dirty=true;if(timer)clearTimeout(timer);timer=setTimeout(()=>run(async()=>{await flushCity();}),700);});
 el('city-unit-reload').onclick=()=>run(reloadInspector);
 el('city-delete').onclick=()=>run(async()=>{if(!(await flushCity())||!view||!selected)return;const u=unit();if(u?.kind==='district'&&view.units.some(b=>b.districtId===u.id))throw new Error('Viertel enthält gebundene Häuser. Diese zuerst verschieben oder entfernen.');await change({kind:'change',upsert:[],remove:[selected],label:'Element entfernen'});selected=null;render();});
 el('city-interior').onclick=()=>run(async()=>{if(!(await flushCity()))return;const u=unit();if(!u||u.kind!=='building')return;await change({kind:'change',upsert:[{...u,interior:true,protected:true}],remove:[],label:'Leere Innenraumhülle anlegen'});});
 el('city-paper').onchange=el('city-roof').onchange=()=>run(async()=>{if(!view||!(await flushCity()))return;await change({kind:'change',upsert:[],remove:[],header:{...view.header,paper:value('city-paper'),roof:value('city-roof')},label:'Kartendarstellung'});});
 for(const format of ['svg','json'] as const)el('city-export-'+format).onclick=()=>run(async()=>{if(!workspace||!view||!(await flushCity()))return;unwrap(await window.campaign.exportCity(workspace.token,view.header.id,format));tell('Stadtplan exportiert.');});
}

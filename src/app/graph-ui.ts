import {EditorSession} from './editor-session';
import {atlasGraphWrite} from './campaign-atlas-author';
import {initDungeonBudget,drawDungeonBudget,resetDungeonBudget,hasDungeonBudgetDrafts,confirmDungeonBudget} from './dungeon-budget-ui';
import type {WorkspaceGeometry,Room,Point} from './contracts';
import type {GraphView,GraphAction,GraphDisplay,GraphContentCounts} from './graph-contracts';
import {graphDisplay} from './graph-model';
export const editorSession = new EditorSession();
const pendingWork = editorSession.operation<Promise<boolean>>();

const nodeOrder=new Intl.Collator('de',{numeric:true});

const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const field=(id:string)=>el<HTMLInputElement>(id),select=(id:string)=>el<HTMLSelectElement>(id),uuid=()=>crypto.randomUUID();
let workspace:()=>WorkspaceGeometry|null,selected:()=>Room|null,before:()=>Promise<boolean>,publish:(w:WorkspaceGeometry)=>Promise<void>,raster:()=>void,navigate:(id:string)=>Promise<void>,tell:(s:string,error?:boolean)=>void;
let data:GraphView|null=null, scopeId='', readVersion=0, openVersion=0, writing=false, failed=false;
let display:GraphDisplay={nodes:[],edges:[],decisions:0,loops:0},picked=new Set<string>(),edgeId:string|null=null,viewBox:{x:number;y:number;width:number;height:number}|null=null,drag:{point:Point;node:string}|null=null;
const cancelled=Symbol('obsolete graph operation');
function owner(){const w=workspace();return {generation:editorSession.generation,token:w?.token,campaignId:w?.campaign.id};}
function owns(o:ReturnType<typeof owner>){const w=workspace();return o.generation===editorSession.generation&&o.token===w?.token&&o.campaignId===w?.campaign.id;}
function run(fn:()=>Promise<unknown>){
 if(pendingWork.value)return;
 const o=owner();failed=false;
 const job=fn().then(()=>true).catch(e=>{if(e!==cancelled&&owns(o)){failed=true;tell(e instanceof Error?e.message:String(e),true);}return false;});
 pendingWork.value=job;
}
function canLeave(){if(writing||hasDungeonBudgetDrafts()){tell('Laufende Änderung oder offene Budgeteingaben zuerst abschließen.',true);return false;}return true;}
function closeGraph(){if(!canLeave())return;openVersion++;readVersion++;drag=null;el<HTMLDialogElement>('graph-dialog').close();}
function roomIds(){const ids=new Set<string>();for(const n of display.nodes.filter(n=>picked.has(n.id)))for(const id of n.roomIds)ids.add(id);const edge=display.edges.find(e=>e.id===edgeId);if(edge){for(const id of edge.roomIds)ids.add(id);for(const n of display.nodes.filter(n=>n.id===edge.from||n.id===edge.to))for(const id of n.roomIds)ids.add(id);}return [...ids];}
async function command(action:GraphAction){
 const w=workspace(),o=owner(),targetScope=scopeId,budgetBase=data?.layout??null;
 if(!w)throw cancelled;
 const request={commandId:uuid(),token:w.token,campaignId:w.campaign.id,scopeId:targetScope,action:structuredClone(action)};
 writing=true;readVersion++;
 try{
  const ready=await before();
  if(!owns(o))throw cancelled;
  if(!ready)throw new Error('Offene Eingaben zuerst übernehmen oder verwerfen.');
  const r=await atlasGraphWrite(request);
  if(!owns(o))throw cancelled;
  if(!r.ok)throw new Error(r.error);
  readVersion++;confirmDungeonBudget(r.value.view,budgetBase);data=r.value.view;
  await publish(r.value.workspace);
  if(!owns(o))throw cancelled;
  syncGraphBanner(r.value.workspace);draw();return r.value.view;
 }finally{if(owns(o))writing=false;}
}
async function refresh(){
 const w=workspace(),o=owner(),targetScope=scopeId,version=++readVersion;
 if(!w)return false;
 const r=await window.campaign.graph(w.token,targetScope);
 if(!owns(o)||version!==readVersion||targetScope!==scopeId)return false;
 if(!r.ok)throw new Error(r.error);
 data=r.value;draw();return true;
}
async function openGraph(){
 el('graph-connection-result').hidden=true;el('graph-connection-result').textContent='';
 const o=owner(),intent=++openVersion,targetScope=workspace()?.graphPreview?.scopeId??selected()?.scopeId??'';
 const ready=await before();
 if(!owns(o)||intent!==openVersion)throw cancelled;
 if(!ready)throw new Error('Offene Eingaben zuerst übernehmen oder verwerfen.');
 scopeId=targetScope;
 if(!scopeId)throw new Error('Dungeonraum auswählen.');
 viewBox=null;
 if(await refresh()&&owns(o)&&intent===openVersion)el<HTMLDialogElement>('graph-dialog').showModal();
}
const kinds=['danger','encounters','treasure','rewards','curiosities','puzzles','secrets'] as const;
function layers(){return kinds.filter(k=>field('graph-layer-'+k).checked);}
function amount(counts:GraphContentCounts,seconds:number){const selected=layers();const n=selected.reduce((sum,k)=>sum+counts[k],0);return select('graph-amount').value==='density'?n/Math.max(1,seconds/60):n;}
function symbols(counts:GraphContentCounts){return layers().map(k=>({danger:'⚠',encounters:'E',treasure:'T',rewards:'B',curiosities:'C',puzzles:'P',secrets:'S'}[k])+':'+counts[k]).join(' ');}
function options(id:string,value:string){const s=select(id);s.replaceChildren();for(const n of display.nodes.filter(n=>n.kind!=='external').sort((a,b)=>nodeOrder.compare(a.name,b.name))){const o=document.createElement('option');o.value=n.id;o.textContent=n.name;s.append(o);}s.value=value||display.nodes[0]?.id||'';}
function draw(){if(!data)return;display=graphDisplay(data,scopeId,select('graph-detail').value as 'rooms'|'routes'|'groups'|'melan',Number(field('graph-pace').value)||30);el('graph-status').textContent=display.nodes.length+' Knoten · '+display.edges.length+' Verbindungen · '+display.decisions+' Verzweigungen · '+display.loops+' Schleifen'+(data.preview?' · geschützte '+(data.preview.phase==='raster'?'Raster':'Graph')+'vorschau':' · bestätigter Dungeon');const currentFrom=select('graph-from').value,currentTo=select('graph-to').value;options('graph-from',currentFrom);options('graph-to',currentTo);const floors=select('graph-floor'),chosen=floors.value;floors.replaceChildren();for(const f of data.geometry.floors.filter(f=>f.scopeId===scopeId)){const o=document.createElement('option');o.value=f.id;o.textContent=f.name+' · '+f.elevation.toFixed(2)+' m';floors.append(o);}floors.value=chosen||data.geometry.floors.find(f=>f.scopeId===scopeId)?.id||'';drawMap();drawSelection();drawIntents();drawDungeonBudget(data);}
function drawSelection(){const ids=roomIds(),edge=display.edges.find(e=>e.id===edgeId);el('graph-selection').textContent=ids.length?'Auswahl: '+ids.map(id=>data?.geometry.rooms.find(r=>r.id===id)?.name??'Erhaltener Raum').join(' · ')+(edge?' | '+edge.kind+' · '+edge.seconds+' s · '+edge.distanceMeters.toFixed(1)+' m':''):'Knoten anklicken; Shift erweitert die Auswahl. Ziehen verschiebt die Anordnung in 5-Fuß-Schritten.';for(const id of ['graph-duplicate','graph-hide','graph-move','graph-key'])el<HTMLButtonElement>(id).disabled=!ids.length;}
function drawIntents(){const list=el('graph-intents');list.replaceChildren();for(const intent of data?.layout.intents??[]){const card=document.createElement('fieldset'),title=document.createElement('legend'),message=document.createElement('p'),from=document.createElement('select'),to=document.createElement('select'),resolve=document.createElement('button');title.textContent=intent.name;message.textContent=intent.problem||'Verbindung geplant; noch keine konkrete Öffnung übernommen.';for(const room of data!.geometry.rooms.filter(r=>r.scopeId===scopeId)){for(const s of [from,to]){const o=document.createElement('option');o.value=room.id;o.textContent=room.number+'. '+room.name;s.append(o);}}from.value=intent.fromRoomId??'';to.value=intent.toRoomId??'';resolve.textContent='Mit diesen Endräumen übersetzen';resolve.onclick=()=>run(()=>command({kind:'resolve',intentId:intent.id,fromRoomId:from.value,toRoomId:to.value}));card.append(title,message,'Von ',from,' nach ',to,resolve);list.append(card);}}
function coordinates(event:PointerEvent|MouseEvent){const svg=el<SVGSVGElement&HTMLElement>('graph-map'),p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const matrix=svg.getScreenCTM();return matrix?p.matrixTransform(matrix.inverse()):{x:0,y:0};}
function drawMap(){const svg=el<SVGSVGElement&HTMLElement>('graph-map'),ns='http://www.w3.org/2000/svg';svg.replaceChildren();if(!viewBox){const xs=display.nodes.map(n=>n.point.x),ys=display.nodes.map(n=>n.point.y),minX=Math.min(0,...xs)-8,minY=Math.min(0,...ys)-8;viewBox={x:minX,y:minY,width:Math.max(20,Math.max(0,...xs)-minX+8),height:Math.max(18,Math.max(0,...ys)-minY+8)};}svg.setAttribute('viewBox',[viewBox.x,viewBox.y,viewBox.width,viewBox.height].join(' '));const make=(tag:string,attrs:Record<string,string>,parent:Element=svg)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;},selectedLayers=layers(),maximum=Math.max(1,...display.nodes.map(n=>amount(n.counts,display.edges.filter(e=>e.from===n.id||e.to===n.id).reduce((sum,e)=>sum+e.seconds,n.internalSeconds??0))),...display.edges.map(e=>amount(e.counts,e.seconds))),color=(counts:GraphContentCounts,seconds:number)=>selectedLayers.length===1?'hsl(30 65% '+(94-55*Math.min(1,amount(counts,seconds)/maximum))+'%)':'#e6dcc5';el('graph-legend').textContent=selectedLayers.length===1?'Intensität '+selectedLayers[0]+': 0 bis '+maximum.toFixed(1)+(select('graph-amount').value==='density'?' pro Minute angrenzender Wege':' explizite Inhalte'):'Getrennte Kategorien: ⚠ Gefahr · E Encounter · T Treasure · B Beute · C Curiosity · P Rätsel · S Geheimnis. Keine Wertung von Prosa.';for(const edge of display.edges){const a=display.nodes.find(n=>n.id===edge.from),b=display.nodes.find(n=>n.id===edge.to);if(!a||!b)continue;const line=make('line',{x1:String(a.point.x),y1:String(a.point.y),x2:String(b.point.x),y2:String(b.point.y),stroke:edgeId===edge.id?'#336998':edge.provisional?'#b58035':!edge.forward&&!edge.backward?'#a75049':edge.secret?'#765887':'#74644c','stroke-width':edgeId===edge.id?'.22':'.13','stroke-dasharray':edge.provisional?'.3 .2':!edge.forward||!edge.backward?'.1 .16':'none'}),text=make('text',{x:String((a.point.x+b.point.x)/2),y:String((a.point.y+b.point.y)/2-.25),'font-size':'.65','text-anchor':'middle',fill:'#4e463d'});text.textContent=(edge.forward?(edge.backward?'↔':'→'):'×')+' '+edge.kind+' · '+edge.seconds+' s'+(selectedLayers.length?' · '+symbols(edge.counts):'');const title=make('title',{},line);title.textContent=edge.distanceMeters.toFixed(1)+' m · '+edge.seconds+' s · '+symbols(edge.counts);for(const target of [line,text])target.addEventListener('click',event=>{event.stopPropagation();edgeId=edge.id;picked.clear();drawMap();drawSelection();});}for(const node of display.nodes){const group=make('g',{'data-node':node.id}),seconds=display.edges.filter(e=>e.from===node.id||e.to===node.id).reduce((n,e)=>n+e.seconds,node.internalSeconds??0);make(node.kind==='group'?'rect':'circle',node.kind==='group'?{x:String(node.point.x-1.1),y:String(node.point.y-.7),width:'2.2',height:'1.4',rx:'.2',fill:color(node.counts,seconds),stroke:picked.has(node.id)?'#336998':'#72664d','stroke-width':'.15'}:{cx:String(node.point.x),cy:String(node.point.y),r:node.kind==='external'?'.5':'.65',fill:color(node.counts,seconds),stroke:picked.has(node.id)?'#336998':'#72664d','stroke-width':'.15'},group);const text=make('text',{x:String(node.point.x),y:String(node.point.y+1.2),'font-size':'.75','text-anchor':'middle',fill:'#29251f'},group);text.textContent=node.name;const counts=make('text',{x:String(node.point.x),y:String(node.point.y+2),'font-size':'.58','text-anchor':'middle',fill:'#6d5940'},group);counts.textContent=symbols(node.counts)+(node.internalConnections?.length?' · innen '+node.internalConnections.length+' Wege / '+(node.internalSeconds??0)+' s · Verzweigungen '+(node.internalDecisions??0)+' · Schleifen '+(node.internalLoops??0):'');const tip=make('title',{},group);tip.textContent=(node.internalConnections??[]).map(e=>e.kind+' · '+e.seconds+' s · '+(e.forward&&e.backward?'beide Richtungen':e.forward||e.backward?'Einbahn':'blockiert')+(e.secret?' · geheim':'')).join('\n');group.addEventListener('pointerdown',event=>{event.stopPropagation();const e=event as PointerEvent;if(!e.shiftKey&&!picked.has(node.id))picked.clear();picked.add(node.id);edgeId=null;drag={point:coordinates(e),node:node.id};svg.setPointerCapture(e.pointerId);drawSelection();});}svg.onpointercancel=()=>{drag=null;};svg.onpointerup=event=>{if(!drag)return;const point=coordinates(event),dxSteps=Math.round((point.x-drag.point.x)/1.524),dySteps=Math.round((point.y-drag.point.y)/1.524);const dragged=drag.node;drag=null;if(dxSteps||dySteps)run(()=>command({kind:'graph-move',roomIds:roomIds(),dxSteps,dySteps}));else{drawMap();drawSelection();const node=display.nodes.find(n=>n.id===dragged);if(node?.kind==='room'&&node.roomIds.length===1)run(()=>command({kind:'select',roomId:node.roomIds[0]!}));}};svg.onclick=event=>{if((event.target as Element)===svg){const p=coordinates(event);field('graph-x').value=String(Math.round(p.x/1.524));field('graph-y').value=String(Math.round(p.y/1.524));picked.clear();edgeId=null;drawMap();drawSelection();}};}
export function syncGraphBanner(w:WorkspaceGeometry|null){const banner=el('graph-preview-banner');if(!banner)return;banner.hidden=!w?.graphPreview;el<HTMLButtonElement>('graph-accept').disabled=w?.graphPreview?.phase!=='raster';el('graph-preview-label').textContent=w?.graphPreview?'Geschützte Graphvorschau. Der bestätigte Dungeon-Autorenstand bleibt bis zur Übernahme unverändert. '+(w.graphPreview.phase==='raster'?'Mit normalen Rasterwerkzeugen korrigieren, dann übernehmen.':'Zuerst zur Rastervorschau wechseln.') :'';}
export function initGraph(status:typeof tell,w:typeof workspace,r:typeof selected,drain:typeof before,changed:typeof publish,showRaster:typeof raster,go:typeof navigate){
 initDungeonBudget(command,run);
 tell=status;workspace=w;selected=r;before=drain;publish=changed;raster=showRaster;navigate=go;
 el('graph-budget-discard').addEventListener('click',()=>{if(!writing)failed=false;});
 el('graph-open').onclick=()=>run(openGraph);
 el('graph-content').onclick=()=>{
  if(!canLeave())return;
  run(async()=>{
   if(!data)return;
   if(!data.preview)await command({kind:'graph-layout',layout:data.layout,expectedRevision:data.layout.stored?data.layout.revision:null});
   if(!data.preview)return;
   await command({kind:'raster'});
   el<HTMLDialogElement>('graph-dialog').close();raster();
  });
  const job=pendingWork.value,o=owner();
  void job?.then(ok=>{if(ok&&owns(o)&&workspace()?.graphPreview?.phase==='raster')el('dungeon-content-open').click();});
 };
 el('graph-close').onclick=closeGraph;
 el('graph-dialog').addEventListener('cancel',event=>{event.preventDefault();closeGraph();});
 el('graph-raster').onclick=()=>{
  if(!canLeave())return;
  run(async()=>{if(data?.preview)await command({kind:'raster'});el<HTMLDialogElement>('graph-dialog').close();raster();});
 };
 el('graph-restore').onclick=()=>{
  if(!canLeave())return;
  run(async()=>{
   scopeId=workspace()?.graphPreview?.scopeId??scopeId;
   await command({kind:'restore'});
   el<HTMLDialogElement>('graph-dialog').close();raster();
   tell('Ursprung wiederhergestellt. Alle Graphänderungen verworfen.');
  });
 };
 el('graph-accept').onclick=()=>{
  if(!canLeave())return;
  run(async()=>{
   scopeId=workspace()?.graphPreview?.scopeId??scopeId;await command({kind:'accept'});
   tell('Gemeinsame Graph-/Rasteränderung übernommen. Ein Autoren-Undo stellt den vorherigen Dungeon wieder her.');
  });
 };
 el('graph-create').onclick=()=>run(()=>command({
  kind:'graph-create',scopeId,floorId:select('graph-floor').value,name:field('graph-room-name').value,
  point:{x:Number(field('graph-x').value)*1.524,y:Number(field('graph-y').value)*1.524},
  widthSteps:Number(field('graph-width').value),depthSteps:Number(field('graph-depth').value),heightSteps:Number(field('graph-height').value)
 }));
 el('graph-move').onclick=()=>run(()=>command({kind:'graph-move',roomIds:roomIds(),dxSteps:Number(field('graph-dx').value),dySteps:Number(field('graph-dy').value)}));
 el('graph-duplicate').onclick=()=>run(()=>command({kind:'graph-duplicate',roomIds:roomIds(),dxSteps:Number(field('graph-dx').value),dySteps:Number(field('graph-dy').value)}));
 el('graph-hide').onclick=()=>run(()=>command({kind:'graph-hide',roomIds:roomIds()}));
 const connectionResult=el('graph-connection-result');
 const clearConnectionResult=()=>{connectionResult.textContent='';connectionResult.hidden=true;};
 for(const id of ['graph-from','graph-to','graph-form','graph-connection-name'])el(id).addEventListener('input',clearConnectionResult);
 el('graph-connect').onclick=()=>run(async()=>{
  clearConnectionResult();
  const a=display.nodes.find(n=>n.id===select('graph-from').value),b=display.nodes.find(n=>n.id===select('graph-to').value);
  if(!a||!b||a.id===b.id){connectionResult.textContent='Zwei unterschiedliche Räume oder Gruppen wählen.';connectionResult.hidden=false;return;}
  const id=uuid(),view=await command({kind:'connect',intent:{
   id,fromRoomId:a.kind==='room'?a.roomIds[0]??null:null,toRoomId:b.kind==='room'?b.roomIds[0]??null:null,
   fromGroupId:a.kind==='group'?a.id.slice(6):null,toGroupId:b.kind==='group'?b.id.slice(6):null,
   form:select('graph-form').value as import('./path-contracts').ConnectionForm,name:field('graph-connection-name').value||'Graphverbindung',problem:''
  }});
  const unresolved=view.layout.intents.find(i=>i.id===id);
  connectionResult.textContent=unresolved
   ? 'Noch nicht verbunden: '+unresolved.problem
   : a.name+' ↔ '+b.name+': in der geschützten Vorschau verbunden. Zur Rastervorschau wechseln, prüfen und übernehmen.';
  connectionResult.hidden=false;
 });
 el('graph-reroute').onclick=()=>run(()=>command({kind:'reroute'}));
 el('graph-key').onclick=()=>{if(!canLeave())return;const id=roomIds()[0];if(!id)return;el<HTMLDialogElement>('graph-dialog').close();void navigate(id);};
 el('graph-fit').onclick=()=>{viewBox=null;drawMap();};
 for(const id of ['graph-detail','graph-pace','graph-amount',...kinds.map(k=>'graph-layer-'+k)])el(id).addEventListener('input',draw);
 el('graph-map').addEventListener('wheel',event=>{
  const e=event as WheelEvent;e.preventDefault();if(!viewBox)return;
  const scale=e.deltaY>0?1.1:.9,center={x:viewBox.x+viewBox.width/2,y:viewBox.y+viewBox.height/2};
  viewBox={x:center.x-viewBox.width*scale/2,y:center.y-viewBox.height*scale/2,width:viewBox.width*scale,height:viewBox.height*scale};drawMap();
 },{passive:false});
}
export function activateGraph(){resetDungeonBudget();editorSession.generation++;readVersion++;openVersion++;pendingWork.value=null;writing=false;failed=false;scopeId='';data=null;picked.clear();edgeId=null;drag=null;viewBox=null;el<HTMLDialogElement>('graph-dialog').close();syncGraphBanner(workspace());}
export async function flushGraph(){const o=owner(),job=pendingWork.value;const ok=job?await job:true;return owns(o)&&ok&&!failed&&!hasDungeonBudgetDrafts();}

export async function refreshOpenGraph(){if(el<HTMLDialogElement>('graph-dialog').open)await refresh();}

/** The shadow is intentionally temporary; only explicit accept/restore may discard it. */
export function canLeaveGraphPreview(){
 if(!workspace()?.graphPreview)return true;
 tell('Geschützte Graph-/Rastervorschau zuerst übernehmen oder mit „Ursprung vollständig wiederherstellen“ verwerfen. Danach Kampagne wechseln oder schließen.',true);
 return false;
}

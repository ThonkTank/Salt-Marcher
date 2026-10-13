import type {Workspace,Room} from './contracts';
import type {DrawingView} from './drawing-contracts';
import type {DungeonVolume,VolumeCell,VolumeAction} from './volume-contracts';
import {VOXEL_METERS as U} from './volume-contracts';
import {volumeFromRoom,volumeProjection,isometricVolume} from './volume-model';
import {roomPath} from './drawing-model';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const field=(id:string)=>el<HTMLInputElement>(id),value=(id:string)=>field(id).value;
let workspace:()=>Workspace|null,selected:()=>Room|null,before:()=>Promise<boolean>,changed:(w:Workspace)=>Promise<void>,tell:(s:string,error?:boolean)=>void;
let data:DrawingView|null=null,generation=0,readRequest=0,roomId:string|null=null,gesture:number|null=null;
let pending:Promise<boolean>|null=null,writing=false,strokeRoomRevision:number|null=null;
const cells=new Map<string,VolumeCell>();
let derived:{room:Room;height:number;volume:DungeonVolume}|null=null;
let renderedVolume:DungeonVolume|null=null,renderedSlice=NaN,isometricSource:DungeonVolume|null=null;
function room(){return roomId===null?null:workspace()?.rooms.find(r=>r.id===roomId)??null;}
function currentVolume(){
 const r=room();if(!r)return null;
 const stored=data?.volumes?.find(v=>v.roomId===r.id);if(stored)return stored;
 const height=Number(value('volume-height'));
 if(!Number.isSafeInteger(height)||height<1||height>40)throw new Error('Höhe benötigt 1–40 Fünf-Fuß-Schritte.');
 if(!derived||derived.room!==r||derived.height!==height)derived={room:r,height,volume:volumeFromRoom(r,height)};
 return derived.volume;
}
function owner(){return{generation,token:workspace()?.token,roomId};}
type Owner=ReturnType<typeof owner>;
function current(o:Owner){return generation===o.generation&&workspace()?.token===o.token&&roomId===o.roomId;}
function run(fn:(o:Owner)=>Promise<boolean>){
 if(pending)return;const o=owner();
 const task=Promise.resolve().then(()=>current(o)?fn(o):false).catch(e=>{if(current(o))tell(e.message,true);return false;}).finally(()=>{if(pending===task){pending=null;writing=false;}});
 pending=task;
}
async function command(a:VolumeAction,o:Owner){
 const w=workspace();if(!w||!current(o))return false;
 writing=true;++readRequest;
 const result=await window.campaign.executeDrawing({commandId:crypto.randomUUID(),token:w.token,campaignId:w.campaign.id,action:a});
 if(!current(o))return false;
 if(!result.ok)throw new Error(result.error);
 data=result.value.view;
 await changed(result.value.workspace);
 if(!current(o))return false;
 if(cells.size)strokeRoomRevision=room()?.revision??null;
 render();tell('3D-Volumen und Raumzuordnung gespeichert.');return true;
}
function renderCells(){
 const svg=el<SVGSVGElement&HTMLElement>('volume-slice-map'),ns='http://www.w3.org/2000/svg';
 svg.querySelector('[data-volume-pending]')?.remove();
 const group=document.createElementNS(ns,'g');group.setAttribute('data-volume-pending','');
 const slice=Number(value('volume-slice'));
 for(const c of cells.values())if(c.z===slice){const rect=document.createElementNS(ns,'rect');for(const[k,v]of Object.entries({x:String(c.x*U),y:String(c.y*U),width:String(U),height:String(U),fill:'#c27a51',opacity:'.45'}))rect.setAttribute(k,v);group.append(rect);}
 svg.append(group);
}
function render(){
 const r=room();if(!r||!data)return;
 const v=currentVolume()!,slice=Number(value('volume-slice'));
 if(v===renderedVolume&&slice===renderedSlice){renderCells();return;}
 const svg=el<SVGSVGElement&HTMLElement>('volume-slice-map'),ns='http://www.w3.org/2000/svg';
 svg.replaceChildren();
 const points=v.columns.length?v.columns:volumeFromRoom(r,2).columns;
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const c of points){minX=Math.min(minX,c.x);maxX=Math.max(maxX,c.x);minY=Math.min(minY,c.y);maxY=Math.max(maxY,c.y);}
 svg.setAttribute('viewBox',`${(minX-2)*U} ${(minY-2)*U} ${(maxX-minX+5)*U} ${(maxY-minY+5)*U}`);
 const draw=(tag:string,attrs:Record<string,string>)=>{
  const e=document.createElementNS(ns,tag);for(const[k,value]of Object.entries(attrs))e.setAttribute(k,value);svg.append(e);
 };
 for(const [z,color,opacity]of [[slice-1,'#758d9b','.2'],[slice+2,'#bd886c','.2'],[slice+1,'#b9ccbf','.5'],[slice,'#d2dfcc','1']] as const){
  const polygons=volumeProjection(v,z);
  if(polygons.length)draw('path',{d:roomPath(polygons),fill:color,opacity,stroke:'#55716d','stroke-width':'.06','fill-rule':'evenodd'});
 }
 for(const c of v.columns){
  const span=c.spans.find(s=>slice>=s.z&&slice<s.z+s.height);if(!span)continue;
  draw('rect',{x:String(c.x*U),y:String(c.y*U),width:String(U),height:String(U),fill:span.medium==='water'?'#77b6d7':'none',stroke:'#739089','stroke-width':'.04'});
  if(span.floor&&span.z===slice)draw('path',{d:`M${c.x*U+.15},${c.y*U+.2}L${(c.x+1)*U-.15},${c.y*U+.2}`,stroke:'#6c875c','stroke-width':'.12'});
  if(span.ceiling&&span.z+span.height-1===slice+1)draw('path',{d:`M${c.x*U+.15},${(c.y+1)*U-.2}L${(c.x+1)*U-.15},${(c.y+1)*U-.2}`,stroke:'#a28663','stroke-width':'.12'});
 }
 if(v!==isometricSource){
  const iso=el<SVGSVGElement&HTMLElement>('volume-isometric');iso.replaceChildren();
  const polygons=isometricVolume(v);let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
  for(const polygon of polygons)for(const pair of polygon.points.split(' ')){
   const [px,py]=pair.split(',').map(Number);x=Math.min(x,px!);right=Math.max(right,px!);y=Math.min(y,py!);bottom=Math.max(bottom,py!);
  }
  if(polygons.length){
   iso.setAttribute('viewBox',`${x-1} ${y-1} ${right-x+2} ${bottom-y+2}`);
   for(const p of polygons){const e=document.createElementNS(ns,'polygon');e.setAttribute('points',p.points);e.setAttribute('fill',p.fill);e.setAttribute('stroke','#3d545b');e.setAttribute('stroke-width','.025');iso.append(e);}
  }
  isometricSource=v;
 }
 renderedVolume=v;renderedSlice=slice;renderCells();
 el('volume-status').textContent=r.number+'. '+r.name+' · '+v.columns.length+' Säulen · '+v.columns.reduce((n,c)=>n+c.spans.reduce((n,s)=>n+s.height,0),0)+' Raumzellen · Schnitt '+slice*5+' bis '+(slice+2)*5+' Fuß relativ zum Zeichnungsanker'+(data.volumes?.some(v=>v.roomId===r.id)?' · gespeichert':' · Konturvorschau');
}
function paint(event:PointerEvent){
 if(!data||!room())return;
 const svg=el<SVGSVGElement&HTMLElement>('volume-slice-map'),matrix=svg.getScreenCTM();if(!matrix)return;
 const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
 const cell={x:Math.floor(p.x/U),y:Math.floor(p.y/U),z:Number(value('volume-slice'))},key=cell.x+','+cell.y+','+cell.z;
 if(cells.size>=2000&&!cells.has(key)){tell('Diesen Zug übernehmen, bevor weitere Zellen hinzukommen.',true);return;}
 if(!cells.size)strokeRoomRevision=room()!.revision;
 cells.set(key,cell);renderCells();
}
function close(){
 if(writing||gesture!==null||cells.size){tell('Volumenzug zuerst übernehmen oder verwerfen; laufende Speicherung abwarten.',true);return false;}
 generation++;readRequest++;pending=null;data=null;roomId=null;derived=null;
 el<HTMLDialogElement>('volume-dialog').close();return true;
}
function safeRender(){try{render();}catch(e){tell((e as Error).message,true);}}
export function initVolume(status:typeof tell,getWorkspace:typeof workspace,getRoom:typeof selected,drain:typeof before,publish:typeof changed){
 tell=status;workspace=getWorkspace;selected=getRoom;before=drain;changed=publish;
 el('volume-open').onclick=()=>{
  if(pending)return;const r=selected();if(!r){tell('Zuerst einen Raum wählen.',true);return;}
  roomId=r.id;el('volume-status').textContent='Volumen wird geladen …';el<HTMLDialogElement>('volume-dialog').showModal();
  run(async o=>{if(!await before()||!current(o))return false;await openVolume();return current(o);});
 };
 el('volume-close').onclick=()=>{close();};
 el('volume-dialog').addEventListener('cancel',e=>{e.preventDefault();close();});
 el('volume-slice').oninput=safeRender;el('volume-height').oninput=safeRender;
 const shift=(n:number)=>{field('volume-slice').value=String(Number(value('volume-slice'))+n);safeRender();};
 el('volume-lower').onclick=()=>shift(-1);el('volume-higher').onclick=()=>shift(1);
 el('volume-initialize').onclick=()=>{
  const r=room();if(!r||!data)return;
  if(cells.size||gesture!==null){tell('Volumenzug zuerst übernehmen oder verwerfen.',true);return;}
  const action:VolumeAction={kind:'volume-initialize',roomId:r.id,expectedRoomRevision:r.revision,expectedVolumeRevision:data.volumes?.find(v=>v.roomId===r.id)?.revision??null,heightSteps:Number(value('volume-height')),medium:value('volume-medium') as 'air'|'water'};
  run(async o=>await before()&&current(o)?command(action,o):false);
 };
 el('volume-discard').onclick=()=>{if(writing){tell('Laufende Speicherung abwarten.',true);return;}gesture=null;cells.clear();strokeRoomRevision=null;renderCells();};
 el('volume-apply').onclick=()=>{
  const r=room();if(!r||!data||!cells.size)return;
  const submitted=new Map(cells);
  const action:VolumeAction={kind:'volume-edit',roomId:r.id,expectedRoomRevision:strokeRoomRevision??r.revision,expectedVolumeRevision:data.volumes?.find(v=>v.roomId===r.id)?.revision??null,operation:value('volume-operation') as Extract<VolumeAction,{kind:'volume-edit'}>['operation'],cells:[...submitted.values()],enabled:field('volume-enabled').checked,medium:value('volume-medium') as 'air'|'water',side:value('volume-side') as 'north'|'east'|'south'|'west'};
  run(async o=>{
   if(!await before()||!current(o)||!await command(action,o)||!current(o))return false;
   for(const[key,cell]of submitted)if(cells.get(key)===cell)cells.delete(key);
   strokeRoomRevision=cells.size?room()?.revision??null:null;
   renderCells();return true;
  });
 };
 const svg=el<SVGSVGElement&HTMLElement>('volume-slice-map');
 svg.onpointerdown=e=>{if(e.button!==0||!data)return;gesture=e.pointerId;svg.setPointerCapture(e.pointerId);paint(e);};
 svg.onpointermove=e=>{if(gesture===e.pointerId)paint(e);};
 const finish=(e:PointerEvent)=>{if(gesture===e.pointerId){gesture=null;svg.releasePointerCapture(e.pointerId);}};
 svg.onpointerup=finish;svg.onpointercancel=finish;
 el('volume-dialog').addEventListener('keydown',event=>{if(event.key==='PageUp'||event.key==='PageDown'){event.preventDefault();shift(event.key==='PageUp'?1:-1);}});
}
export async function openVolume(){
 const w=workspace(),o=owner(),request=++readRequest;if(!w||!room())return;
 const result=await window.campaign.drawing(w.token);
 if(!current(o)||request!==readRequest)return;
 if(!result.ok)throw new Error(result.error);
 // A read must not silently advance the revision underneath an unsubmitted stroke.
 if(cells.size||gesture!==null)return;
 data=result.value;render();
}
export function activateVolume(){
 generation++;readRequest++;data=null;roomId=null;gesture=null;cells.clear();strokeRoomRevision=null;pending=null;writing=false;derived=null;renderedVolume=null;isometricSource=null;renderedSlice=NaN;
 el<HTMLDialogElement>('volume-dialog').close();
}
export async function flushVolume(){
 const o=owner(),task=pending;
 if(task&&!await task)return false;
 if(!current(o))return false;
 if(gesture!==null||cells.size){tell('Volumenzug übernehmen oder verwerfen.',true);return false;}
 return true;
}

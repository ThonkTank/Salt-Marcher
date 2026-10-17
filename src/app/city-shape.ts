import {AtlasPaint,paintFactory,type PaintTarget} from './atlas-canvas-scene';
import type {CityPoint,CityUnit,CityCommand} from './city-contracts';
import {roadPoints} from './city-model';

interface Owner {token:string;cityId:string;revision:number;unit:CityUnit;units:CityUnit[]}
const identity=(o:Owner)=>JSON.stringify([o.token,o.cityId,o.unit.id]);
export function editableCityShape(u:CityUnit){return ['road','wall','district','plaza','water'].includes(u.kind);}
/** A revision-bound geometry draft; shared road nodes are edited in the same command. */
export class CityShape {
 state:null|{owner:Owner;points:CityPoint[];chosen:number;busy:boolean;message:string;attempt:null|{id:string;action:CityCommand['action']}}=null;
 opening=false;
 private generation=0;
 constructor(private port:{current:()=>Owner|null;drain:()=>Promise<boolean>;send:(action:CityCommand['action'],id:string,revision:number)=>Promise<unknown>;rejected:(e:unknown)=>boolean;changed:()=>void}){}
 get active(){return !!this.state;}
 get locked(){return !!this.state&&(this.state.busy||!!this.state.attempt);}
 private owns(s:NonNullable<CityShape['state']>){const o=this.port.current();return this.state===s&&!!o&&identity(o)===identity(s.owner);}
 contextChanged(){this.generation++;this.state=null;this.opening=false;}
 async begin(){
  if(this.opening||this.active)return;
  const owner=this.port.current(),g=++this.generation;if(!owner||!editableCityShape(owner.unit))return;
  this.opening=true;this.port.changed();
  try{if(!await this.port.drain()||g!==this.generation)return;const current=this.port.current();if(!current||identity(current)!==identity(owner))return;
   const original=structuredClone(current),line=['road','wall'].includes(original.unit.kind);
   this.state={owner:original,points:structuredClone(line?roadPoints(original.unit,original.units):original.unit.outline!),chosen:0,busy:false,attempt:null,message:'Griff ziehen oder wählen und Zielpunkt anklicken. Kleine Griffe fügen einen Punkt ein. Gemeinsame Straßenenden bleiben verbunden.'};
  }finally{if(g===this.generation){this.opening=false;this.port.changed();}}
 }
 choose(index:number){const s=this.state;if(!s||!this.owns(s)||this.locked||!s.points[index])return;s.chosen=index;this.port.changed();}
 point(p:CityPoint){const s=this.state;if(!s||!this.owns(s)||this.locked||!Number.isFinite(p.x+p.y)||Math.max(Math.abs(p.x),Math.abs(p.y))>100000)return;s.points[s.chosen]={x:Math.round(p.x*10)/10,y:Math.round(p.y*10)/10};const ends=s.owner.unit.nodeIds;if(ends?.[0]===ends?.[1]&&ends&&(s.chosen===0||s.chosen===s.points.length-1)){s.points[0]={...s.points[s.chosen]!};s.points[s.points.length-1]={...s.points[s.chosen]!};}this.port.changed();}
 insert(index:number){const s=this.state;if(!s||!this.owns(s)||this.locked)return;const a=s.points[index],b=s.points[(index+1)%s.points.length];if(!a||!b)return;s.points.splice(index+1,0,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});s.chosen=index+1;this.port.changed();}
 remove(){const s=this.state;if(!s||!this.owns(s)||this.locked)return;const line=['road','wall'].includes(s.owner.unit.kind);if(s.points.length<=(line?2:3)||line&&(s.chosen===0||s.chosen===s.points.length-1)){s.message='Straßenenden bleiben verbunden; eine Fläche benötigt mindestens drei Ecken.';this.port.changed();return;}s.points.splice(s.chosen,1);s.chosen=Math.min(s.chosen,s.points.length-1);this.port.changed();}
 units(units:CityUnit[]){
  const s=this.state;if(!s)return units;const u=s.owner.unit;
  if(!['road','wall'].includes(u.kind))return units.map(row=>row.id===u.id?{...row,outline:s.points,protected:true}:row);
  return units.map(row=>row.id===u.id?{...row,via:s.points.slice(1,-1),protected:true}:row.id===u.nodeIds![0]?{...row,point:s.points[0]}:row.id===u.nodeIds![1]?{...row,point:s.points.at(-1)}:row);
 }
 cancel(){if(this.locked)return false;this.contextChanged();this.port.changed();return true;}
 async accept(){
  const s=this.state;if(!s||s.busy||!this.owns(s))return;
  if(!s.attempt&&this.port.current()!.revision!==s.owner.revision){s.message='Stadtstand geändert. Vorschau verwerfen und den aktuellen Stadtplan laden.';this.port.changed();return;}
  const ids=new Set([s.owner.unit.id,...s.owner.unit.nodeIds??[]]);
  const upsert=this.units(s.owner.units).filter(u=>ids.has(u.id)),original=s.owner.units.filter(u=>ids.has(u.id));
  if(!s.attempt&&JSON.stringify(upsert)===JSON.stringify(original)){this.cancel();return;}
  s.attempt??={id:crypto.randomUUID(),action:{kind:'change',upsert:structuredClone(upsert),remove:[],label:'Stadtform bearbeiten'}};
  s.busy=true;s.message='Stadtform wird gespeichert…';this.port.changed();
  try{await this.port.send(s.attempt.action,s.attempt.id,s.owner.revision);if(this.state===s)this.state=null;}
  catch(e){if(this.owns(s)){if(this.port.rejected(e)){s.attempt=null;s.message=(e as Error).message;}else s.message='Speicherung nicht bestätigt. „Ergebnis prüfen“ verwendet denselben Auftrag. '+(e as Error).message;}}
  finally{if(this.owns(s))s.busy=false;this.port.changed();}
 }
}

/** Handles work with pointer dragging, click then target, and keyboard selection. */
export function cityShapeHandles(root:PaintTarget,editor:CityShape,mpp:number){
 const s=editor.state;if(!s)return;const line=['road','wall'].includes(s.owner.unit.kind);
 for(let i=0;i<s.points.length;i++){
  const p=s.points[i]!;
  const handle=(point:CityPoint,label:string,midpoint:boolean)=>{
   const c=paintFactory(root)('circle');
   c.setAttribute('cx',String(point.x));c.setAttribute('cy',String(point.y));c.setAttribute('r',String(mpp*(midpoint?4:7)));c.setAttribute('fill',midpoint?'#fff':s.chosen===i?'#c65d28':'#176c74');c.setAttribute('stroke','#fff');c.setAttribute('stroke-width',String(mpp*1.5));c.setAttribute('role','button');c.setAttribute('aria-label',label);c.setAttribute('tabindex',editor.locked?'-1':'0');if(!(root instanceof AtlasPaint))c.style.cursor=midpoint?'copy':'move';c.dataset.cityShapeHandle=String(i);if(midpoint)c.dataset.cityShapeInsert='true';
   const choose=()=>midpoint?editor.insert(i):editor.choose(i);
   if(root instanceof AtlasPaint){root.append(c);return;}
   c.addEventListener('click',(e:MouseEvent)=>{e.stopPropagation();choose();});
   c.addEventListener('keydown',(e:KeyboardEvent)=>{const k=e as KeyboardEvent;if(k.key==='Enter'||k.key===' '){k.preventDefault();k.stopPropagation();choose();}});
   c.addEventListener('pointerdown',(e:PointerEvent)=>{
    if(e.button!==0||editor.locked)return;e.stopPropagation();e.preventDefault();
    const svg=root.ownerSVGElement,matrix=(root as SVGGElement).getScreenCTM()?.inverse();if(!svg||!matrix)return;
    choose();svg.setPointerCapture(e.pointerId);
    const move=(event:PointerEvent)=>{if(event.pointerId!==e.pointerId)return;if(editor.state!==s){end(event);return;}event.stopPropagation();const pt=svg.createSVGPoint();pt.x=event.clientX;pt.y=event.clientY;const at=pt.matrixTransform(matrix);editor.point(at);};
    const end=(event:PointerEvent)=>{if(event.pointerId!==e.pointerId)return;svg.removeEventListener('pointermove',move);svg.removeEventListener('pointerup',end);svg.removeEventListener('pointercancel',end);if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);};
    svg.addEventListener('pointermove',move);svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
   });root.append(c);
  };
  handle(p,'Eckpunkt '+(i+1)+' wählen',false);
  if(!line||i<s.points.length-1){const q=s.points[(i+1)%s.points.length]!;handle({x:(p.x+q.x)/2,y:(p.y+q.y)/2},'Punkt nach Ecke '+(i+1)+' einfügen',true);}
 }
}

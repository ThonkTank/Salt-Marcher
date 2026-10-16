import {passageCenter} from './path-opening';
import type {RoomGeometry,Point} from './contracts';
import type {DrawingMapView} from './drawing-contracts';
import {VOXEL_METERS as U} from './volume-contracts';

/** Render openings from assigned physical passages, including the generated corridor's end wall. */
export function roomWallPath(room:RoomGeometry,visibleRooms:RoomGeometry[],view:DrawingMapView){
 const visible=new Set(visibleRooms.map(r=>r.id)),openings:{point:Point;width:number;vertical:boolean}[]=[];
 for(const p of view.passages??[]){
  if(p.roomId!==room.id&&p.otherRoomId!==room.id)continue;
  const a=p.anchor.local,volume=view.volumes?.find(v=>v.id===p.anchor.volumeId);
  if(!p.assigned||!a||!volume?.columns.length||!visible.has(p.roomId)||p.otherRoomId&&!visible.has(p.otherRoomId)||['up','down'].includes(a.face))continue;
  const path=p.pathId?view.paths?.find(path=>path.id===p.pathId):null;
  if(path&&(!path.roomId||!visible.has(path.roomId)))continue;
  if(volume.scopeId!==room.scopeId||volume.floorId!==room.floorId)continue;
  const side=p.roomId===room.id?p.outbound:p.inbound;
  if(side.target.kind==='geometry'&&side.target.id&&!visible.has(side.target.id))continue;
  let x=Infinity,y=Infinity;for(const c of volume.columns){x=Math.min(x,c.x);y=Math.min(y,c.y);}
  const vertical=a.face==='east'||a.face==='west';
  openings.push({point:passageCenter({x:(x+a.x+.5+(a.face==='east'?.5:a.face==='west'?-.5:0))*U,y:(y+a.y+.5+(a.face==='south'?.5:a.face==='north'?-.5:0))*U,z:0},a.face,p.widthSteps),width:p.widthSteps*U,vertical});
 }
 const lines:string[]=[];
 for(const ring of room.polygons.flatMap(p=>[p.outer,...p.holes]))for(let i=0;i<ring.length;i++){
  const a=ring[i]!,b=ring[(i+1)%ring.length]!,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<1e-8)continue;
  const gaps:{from:number;to:number}[]=[];
  for(const opening of openings){
   if(opening.vertical?Math.abs(dx)>1e-6:Math.abs(dy)>1e-6)continue;
   const p=opening.point,t=((p.x-a.x)*dx+(p.y-a.y)*dy)/(length*length),distance=Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
   if(distance>1e-6)continue;
   const from=Math.max(0,t-opening.width/2/length),to=Math.min(1,t+opening.width/2/length);if(from<to)gaps.push({from,to});
  }
  gaps.sort((a,b)=>a.from-b.from);let start=0;
  const append=(from:number,to:number)=>{if(to-from>1e-8)lines.push(`M${a.x+dx*from},${a.y+dy*from}L${a.x+dx*to},${a.y+dy*to}`);};
  for(const gap of gaps){append(start,gap.from);start=Math.max(start,gap.to);}append(start,1);
 }
 return lines.join(' ');
}

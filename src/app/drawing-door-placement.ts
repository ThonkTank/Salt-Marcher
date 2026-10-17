import type {Point,RoomGeometry} from './contracts';
import {inside,nearestAnchor} from './drawing-model';

/** Pick the wall before applying any grid snap, then keep the door inside that wall. */
export function doorPlacement(point:Point,rooms:RoomGeometry[],width:number,preferredId:string|null){
 const ordered=[...rooms].sort((a,b)=>Number(b.id===preferredId)-Number(a.id===preferredId));
 let chosen:ReturnType<typeof nearestAnchor>=null;
 for(const room of ordered){const candidate=nearestAnchor(point,room);if(candidate&&(!chosen||candidate.distance<chosen.distance-1e-8))chosen=candidate;}
 if(!chosen)return null;
 const room=rooms.find(r=>r.id===chosen!.roomId)!,ring=room.polygons[chosen.polygon]!.outer,a=ring[chosen.edge]!,b=ring[(chosen.edge+1)%ring.length]!,length=Math.hypot(b.x-a.x,b.y-a.y);
 const margin=Math.min(.5,width/2/(length||1)),t=Math.max(margin,Math.min(1-margin,chosen.t));
 const position={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},normal={x:-(b.y-a.y)/(length||1)*.05,y:(b.x-a.x)/(length||1)*.05};
 const plus={x:position.x+normal.x,y:position.y+normal.y},minus={x:position.x-normal.x,y:position.y-normal.y};
 const sourcePlus=inside(plus,room.polygons),sourceMinus=inside(minus,room.polygons);
 // Only an unambiguous room across this wall is a portal destination. A small
 // tolerance matches drawing wall gaps; overlapping rooms and corners stay manual.
 const across=sourcePlus!==sourceMinus?rooms.filter(other=>other.id!==room.id&&
  (nearestAnchor(position,other)?.distance??Infinity)<=.05&&
  inside(sourcePlus?minus:plus,other.polygons)&&!inside(sourcePlus?plus:minus,other.polygons)):[];
 return{roomId:room.id,targetRoomId:across.length===1?across[0]!.id:null,anchor:{roomId:room.id,polygon:chosen.polygon,edge:chosen.edge,t},point:{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}};
}

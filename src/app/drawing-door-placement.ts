import type {Point,Room} from './contracts';
import {nearestAnchor} from './drawing-model';

/** Pick the wall before applying any grid snap, then keep the door inside that wall. */
export function doorPlacement(point:Point,rooms:Room[],width:number,preferredId:string|null){
 const ordered=[...rooms].sort((a,b)=>Number(b.id===preferredId)-Number(a.id===preferredId));
 let chosen:ReturnType<typeof nearestAnchor>=null;
 for(const room of ordered){const candidate=nearestAnchor(point,room);if(candidate&&(!chosen||candidate.distance<chosen.distance-1e-8))chosen=candidate;}
 if(!chosen)return null;
 const room=rooms.find(r=>r.id===chosen!.roomId)!,ring=room.polygons[chosen.polygon]!.outer,a=ring[chosen.edge]!,b=ring[(chosen.edge+1)%ring.length]!,length=Math.hypot(b.x-a.x,b.y-a.y);
 const margin=Math.min(.5,width/2/(length||1)),t=Math.max(margin,Math.min(1-margin,chosen.t));
 return{roomId:room.id,anchor:{roomId:room.id,polygon:chosen.polygon,edge:chosen.edge,t},point:{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}};
}

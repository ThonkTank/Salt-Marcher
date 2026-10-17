import {paintFactory,type PaintTarget} from './atlas-canvas-scene';
import type {Point,RoomGeometry} from './contracts';
import {appendRoomNumber} from './room-number-label';
import {centerInRoom} from './dungeon-model';

/** Labels live outside the rotated geometry in both the Atlas and its image export. */
export function appendAtlasRoomLabels(root:PaintTarget,room:RoomGeometry,mpp:number,project:(point:Point)=>Point){
 appendRoomNumber(root,room,mpp,project);
 if(!Number.isFinite(mpp)||mpp<=0)return;
 const vertices=room.polygons[0]?.outer;if(!vertices?.length)return;
 const points=vertices.map(project);
 if((Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)))/mpp<=60)return;
 let at;try{at=project(centerInRoom(room));}catch{return;}
 const label=paintFactory(root)('text');
 const attrs={x:at.x,y:at.y-8*mpp,'font-size':12*mpp,'text-anchor':'middle','paint-order':'stroke',stroke:'#f2eee3','stroke-width':3*mpp,fill:'#283d3b','pointer-events':'none','data-room-name':room.id};
 for(const [key,value] of Object.entries(attrs))label.setAttribute(key,String(value));
 label.textContent=room.name.slice(0,40);root.append(label);
}

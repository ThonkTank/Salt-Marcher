import {atlasPaint} from './atlas-paint';
import {appendPaint,type PaintTarget} from './atlas-paint-svg';
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
 appendPaint(root,atlasPaint('text',{x:at.x,y:at.y-8*mpp,pointer:false,data:{roomName:room.id},style:{fontSize:12*mpp,textAlign:'center',stroke:'#f2eee3',lineWidth:3*mpp,lineJoin:'round',fill:'#283d3b'}},room.name.slice(0,40)));
}

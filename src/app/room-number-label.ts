import type {RoomGeometry} from './contracts';
import {centerInRoom} from './dungeon-model';

/** A passive key to the room list, readable at every camera scale. */
export function appendRoomNumber(scene:SVGElement,room:RoomGeometry,unitsPerPixel:number){
  if(!Number.isFinite(unitsPerPixel)||unitsPerPixel<=0)return;
  let at;
  try{at=centerInRoom(room);}catch{return;} // A missing label must never hide the map.
  const label=scene.ownerDocument.createElementNS('http://www.w3.org/2000/svg','text');
  const attributes={x:String(at.x),y:String(at.y),'text-anchor':'middle','dominant-baseline':'central',
    'font-size':String(13*unitsPerPixel),'font-weight':'600',fill:'#203648',stroke:'#fff',
    'stroke-width':String(3*unitsPerPixel),'stroke-linejoin':'round','paint-order':'stroke',
    'pointer-events':'none','aria-hidden':'true','data-room-number':room.id};
  for(const [key,value] of Object.entries(attributes))label.setAttribute(key,value);
  label.textContent=room.number;scene.append(label);
}

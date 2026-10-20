import type {LandscapeBox} from './atlas-landscape';
import type {Point} from './contracts';
/** A bounded display refinement, never author data or a replacement visibility grid. */
export interface TerrainDetail {box:LandscapeBox;width:number;height:number;pixels:Uint8Array}
export function terrainDetailBox(point:Point,radius:number,view:LandscapeBox):LandscapeBox|undefined{
  if(!Number.isFinite(radius)||radius<=0)return;
  const step=2**Math.ceil(Math.log2(radius))*2,x=Math.round(point.x/step)*step,y=Math.round(point.y/step)*step;
  const left=Math.max(view.x,x-step*2),top=Math.max(view.y,y-step*2),right=Math.min(view.x+view.width,x+step*2),bottom=Math.min(view.y+view.height,y+step*2);
  if(right<=left||bottom<=top)return;
  return {x:left,y:top,width:right-left,height:bottom-top};
}
export function validateTerrainDetail(box:LandscapeBox|undefined,view:LandscapeBox){
  if(box&&(![box.x,box.y,box.width,box.height].every(Number.isFinite)||box.width<=0||box.height<=0||box.x<view.x||box.y<view.y||box.x+box.width>view.x+view.width||box.y+box.height>view.y+view.height||Object.keys(box).some(k=>!['x','y','width','height'].includes(k))))throw Error('Geländedetail prüfen.');
}

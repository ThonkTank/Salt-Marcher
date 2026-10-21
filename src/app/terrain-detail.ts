import type {LandscapeBox} from './atlas-landscape';
import type {Point} from './contracts';
/** A bounded display refinement, never author data or a replacement visibility grid. */
export interface TerrainDetail {
 /** Renderer-only availability mask; full projections omit it. */
 coverage?:{columns:number;rows:number;values:Uint8Array};
 box:LandscapeBox;width:number;height:number;pixels:Uint8Array}
/** Legacy brush patches stay square; viewport refinements preserve their aspect. */
export function terrainDetailDimensions(box:LandscapeBox,resolution?:number){
  if(resolution===undefined)return {width:256,height:256};
  const size=Math.max(box.width,box.height);
  return {width:Math.max(16,Math.round(resolution*box.width/size)),height:Math.max(16,Math.round(resolution*box.height/size))};
}
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

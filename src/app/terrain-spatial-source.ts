import type {LandscapeBox} from './atlas-landscape';

export interface TerrainSourceWindow {frame:LandscapeBox;pixelWidth:number;pixelHeight:number;coverage?:number}

/** A single retained surface, not a camera-frame cache. Keep its original sampling
 * lattice during small gestures; ask for new detail before magnification exceeds
 * 25% or the viewport consumes the retained pan margin. Wider coverage tiers only
 * grow within a retained window; rotation never changes its sampling lattice.
 * Retain the request as well as the completed surface so motion cannot starve it. */
export function terrainSourceWindow(previous:TerrainSourceWindow|null,frame:LandscapeBox,pixelWidth:number,pixelHeight:number,coverage=3):TerrainSourceWindow{
  pixelWidth=Math.max(1,pixelWidth);pixelHeight=Math.max(1,pixelHeight);
  if(previous){
    const b=previous.frame,rx=frame.width/b.width,ry=frame.height/b.height;
    const mx=rx*previous.pixelWidth/pixelWidth,my=ry*previous.pixelHeight/pixelHeight;
    const dx=Math.abs(frame.x+frame.width/2-b.x-b.width/2),dy=Math.abs(frame.y+frame.height/2-b.y-b.height/2);
    if((previous.coverage??3)>=coverage&&Math.min(rx,ry,mx,my)>=.8&&Math.max(rx,ry,mx,my)<=1.25&&dx+frame.width<=1.5*b.width&&dy+frame.height<=1.5*b.height)return previous;
  }
  return {frame:{...frame},pixelWidth,pixelHeight,coverage};
}

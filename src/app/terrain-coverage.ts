import {ATLAS_CAMERA_FOV,atlasCameraEye} from './atlas-camera';
import type {TerrainView} from './terrain-spatial-model';
import type {LandscapeBox} from './atlas-landscape';

/** Rotation-independent, coarse coverage tiers. Retain a tier during gestures;
 * only crossing a tier requests a wider source, never every slider movement.
 * Above 71.6 degrees some screen rays meet the sky, not a finite ground point. */
export function terrainCoverageLevel(tilt:number){
  return tilt<=0?3:tilt<=45?6:tilt<=60?10:tilt<=68?24:64;
}
export function terrainCoverageBox(frame:LandscapeBox,level:number):LandscapeBox{
  const size=Math.max(frame.width,frame.height)*level;
  return{x:frame.x+frame.width/2-size/2,y:frame.y+frame.height/2-size/2,width:size,height:size};
}
/** Atmospheric distance ends before any visible boundary of the loaded square.
 * Cone depth bounds use the full viewport, so tiled output has the same horizon.
 * Near detail stays clear; unsupported sky has no author hit. */
export function terrainHorizon(view:TerrainView){
  if(view.tilt<=60)return {near:1e29,far:1e30};
  const eye=atlasCameraEye(view),x=view.frame.x+view.frame.width/2+eye.x,y=view.frame.y+view.frame.height/2+eye.y,b=view.box;
  const radius=Math.max(0,Math.min(x-b.x,b.x+b.width-x,y-b.y,b.y+b.height-y));
  const aspect=view.frame.width/view.frame.height,tan=Math.tan(ATLAS_CAMERA_FOV*Math.PI/360);
  const coneCos=1/Math.sqrt(1+tan*tan*(1+aspect*aspect));
  const t=Math.min(1,(view.tilt-60)/8),strength=t*t*(3-2*t);
  const far=Math.max(Math.hypot(eye.x,eye.y,eye.z)*1.1,radius*coneCos*.95)/strength;
  return{near:far*.65,far};
}
export const TERRAIN_SKY_COLOR='#7fa8bd';

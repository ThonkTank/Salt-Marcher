import type {TerrainProjectionRequest} from './terrain-projection';
import type {TerrainSourceWindow} from './terrain-spatial-source';
import type {TerrainObjectSource} from './terrain-objects';

/** Publish usable geometry first. Both stages have identical heights, objects
 * and picking coordinates; only the derived colour resolution changes. */
export function terrainNavigationPlan(window:TerrainSourceWindow,revision:number,pose:{tilt:number;rotation:number;exaggeration:number},objects:TerrainObjectSource[]):[TerrainProjectionRequest,TerrainProjectionRequest]{
  const frame={...window.frame},box={x:frame.x-frame.width,y:frame.y-frame.height,width:frame.width*3,height:frame.height*3};
  const refinement={x:frame.x-frame.width/4,y:frame.y-frame.height/4,width:frame.width*1.5,height:frame.height*1.5};
  const view={projection:'perspective' as const,box,frame,refinement,columns:257,rows:257,focusM:0,...pose};
  const base={view,revision,objects,contours:0,displayMpp:frame.width/window.pixelWidth};
  const height=(width:number)=>Math.max(16,Math.min(width,Math.round(width*box.height/box.width)));
  return [{...base,width:128,height:height(128)},{...base,width:512,height:height(512),detail:refinement,detailResolution:1024}];
}

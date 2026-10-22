import type {LandscapeBox} from './atlas-landscape';
import type {TerrainRect,TerrainInvalidation} from './terrain-frame';
import type {TerrainDetail} from './terrain-detail';
import {terrainBoxesOverlap} from './terrain-cache';
import {landscapeRasterBounds} from './landscape-raster';

export type TerrainTileColor=Pick<TerrainDetail,'pixels'|'forest'>;
export interface TerrainColorFrameReference {id:object;box:LandscapeBox;width:number;height:number}
/** Renderer-only accepted tiles, not an assembled CPU image or worker reply.
 * The predecessor is just an identity and lattice: no recursive frame retention. */
export interface TerrainColorFrame extends TerrainColorFrameReference {
 coverage:{columns:number;rows:number;values:Uint8Array};
 tiles:Map<number,{rect:TerrainRect;color:TerrainTileColor}>;
 previous?:TerrainColorFrameReference;
 clear?:TerrainRect[];
}
export const colorFrameReference=(frame:TerrainColorFrame):TerrainColorFrameReference=>({id:frame.id,box:frame.box,width:frame.width,height:frame.height});
export const colorFrameTile=(frame:TerrainColorFrame,rect:TerrainRect)=>rect.y/(frame.height/frame.coverage.rows)*frame.coverage.columns+rect.x/(frame.width/frame.coverage.columns);

/** Infer full retained coverage from small availability grids. GPU composition
 * keeps individual edge pixels; pending neighbours still feather as before. */
export function retainedColorTile(frame:TerrainColorFrame,rect:TerrainRect,previous:TerrainColorFrame){
 const first=(axis:'x'|'y',size:'width'|'height')=>Math.floor((frame.box[axis]+(rect[axis]+.5)*frame.box[size]/frame[size]-previous.box[axis])/previous.box[size]*previous[size]);
 const last=(axis:'x'|'y',size:'width'|'height')=>Math.floor((frame.box[axis]+(rect[axis]+rect[size]-.5)*frame.box[size]/frame[size]-previous.box[axis])/previous.box[size]*previous[size]);
 const x=first('x','width'),y=first('y','height'),right=last('x','width'),bottom=last('y','height');
 if(x<0||y<0||right>=previous.width||bottom>=previous.height)return false;
 const c=previous.coverage,w=previous.width/c.columns,h=previous.height/c.rows;
 for(let row=Math.floor(y/h);row<=Math.floor(bottom/h);row++)for(let col=Math.floor(x/w);col<=Math.floor(right/w);col++)if(c.values[row*c.columns+col]!==255)return false;
 return true;
}
/** Only metadata is copied. The GPU clears stale colour and forest together;
 * accepted distant tile buffers stay shared and immutable. */
export function invalidateColorFrame(frame:TerrainColorFrame,changes:TerrainInvalidation):TerrainColorFrame|undefined{
 if(changes.reset)return;
 const {columns,rows}=frame.coverage,w=frame.width/columns,h=frame.height/rows;
 let next:TerrainColorFrame|undefined;
 for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
  const box={x:frame.box.x+col*frame.box.width/columns,y:frame.box.y+row*frame.box.height/rows,width:frame.box.width/columns,height:frame.box.height/rows};
  const bounds=landscapeRasterBounds(box,w,h);
  if(!changes.bounds.some(b=>terrainBoxesOverlap(bounds,b)))continue;
  next??={...colorFrameReference(frame),id:{},previous:colorFrameReference(frame),tiles:new Map(frame.tiles),coverage:{columns,rows,values:frame.coverage.values.slice()},clear:[]};
  const key=row*columns+col;next.coverage.values[key]=0;next.tiles.delete(key);next.clear!.push({x:col*w,y:row*h,width:w,height:h});
 }
 return next??frame;
}

import type {TerrainDetail} from './terrain-detail';
import type {TerrainInvalidation} from './terrain-frame';
import {terrainBoxesOverlap} from './terrain-cache';
import {landscapeRasterBounds} from './landscape-raster';

/** Drop only affected tiles, including the shared raster's lighting/coast halo.
 * Pixels and availability belong to a published frame: never mutate them. */
export function invalidateTerrainDetail(detail:TerrainDetail,changes:TerrainInvalidation):TerrainDetail|undefined{
 if(changes.reset)return;
 const columns=detail.coverage?.columns??1,rows=detail.coverage?.rows??1,
  width=detail.width/columns,height=detail.height/rows;
 let next:TerrainDetail|undefined;
 for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
  const box={x:detail.box.x+column*detail.box.width/columns,y:detail.box.y+row*detail.box.height/rows,width:detail.box.width/columns,height:detail.box.height/rows};
  if(!changes.bounds.some(b=>terrainBoxesOverlap(landscapeRasterBounds(box,width,height),b)))continue;
  next??={...detail,pixels:detail.pixels.slice(),...(detail.forest?{forest:detail.forest.slice()}:{}),coverage:{columns,rows,values:detail.coverage?.values.slice()??new Uint8Array(columns*rows).fill(255)}};
  next.coverage!.values[row*columns+column]=0;
  for(let y=row*height;y<(row+1)*height;y++){next.pixels.fill(0,(y*detail.width+column*width)*4,(y*detail.width+(column+1)*width)*4);next.forest?.fill(0,y*detail.width+column*width,y*detail.width+(column+1)*width);}
 }
 return next??detail;
}

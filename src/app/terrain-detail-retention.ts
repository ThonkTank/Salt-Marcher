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
  next??={...detail,pixels:detail.pixels.slice(),coverage:{columns,rows,values:detail.coverage?.values.slice()??new Uint8Array(columns*rows).fill(255)}};
  next.coverage!.values[row*columns+column]=0;
  for(let y=row*height;y<(row+1)*height;y++)next.pixels.fill(0,(y*detail.width+column*width)*4,(y*detail.width+(column+1)*width)*4);
 }
 return next??detail;
}

/** Fill invalidated pixels with the freshly confirmed brush projection while
 * keeping finer, unaffected world pixels. This does not populate the tile cache. */
export function fillTerrainDetail(detail:TerrainDetail,fresh:TerrainDetail):TerrainDetail{
 if(!terrainBoxesOverlap(detail.box,fresh.box))return detail;
 const columns=detail.coverage?.columns??1,rows=detail.coverage?.rows??1,
  tileWidth=detail.width/columns,tileHeight=detail.height/rows,touched=new Set<number>();
 const left=Math.max(0,Math.ceil((fresh.box.x-detail.box.x)/detail.box.width*detail.width-.5)),
  right=Math.min(detail.width,Math.ceil((fresh.box.x+fresh.box.width-detail.box.x)/detail.box.width*detail.width-.5)),
  top=Math.max(0,Math.ceil((fresh.box.y-detail.box.y)/detail.box.height*detail.height-.5)),
  bottom=Math.min(detail.height,Math.ceil((fresh.box.y+fresh.box.height-detail.box.y)/detail.box.height*detail.height-.5));
 let next:TerrainDetail|undefined;
 for(let y=top;y<bottom;y++){
  const sy=Math.floor((detail.box.y+(y+.5)*detail.box.height/detail.height-fresh.box.y)/fresh.box.height*fresh.height);
  if(sy<0||sy>=fresh.height)continue;
  for(let x=left;x<right;x++){
   const at=(y*detail.width+x)*4;if(detail.pixels[at+3]!==0)continue;
   const sx=Math.floor((detail.box.x+(x+.5)*detail.box.width/detail.width-fresh.box.x)/fresh.box.width*fresh.width);
   if(sx<0||sx>=fresh.width)continue;
   const from=(sy*fresh.width+sx)*4;if(!fresh.pixels[from+3])continue;
   next??={...detail,pixels:detail.pixels.slice(),coverage:{columns,rows,values:detail.coverage?.values.slice()??new Uint8Array(columns*rows).fill(255)}};
   for(let c=0;c<4;c++)next.pixels[at+c]=fresh.pixels[from+c]!;
   touched.add(Math.floor(y/tileHeight)*columns+Math.floor(x/tileWidth));
  }
 }
 if(!next)return detail;
 for(const index of touched){
  const left=index%columns*tileWidth,top=Math.floor(index/columns)*tileHeight;let complete=true;
  for(let y=top;y<top+tileHeight&&complete;y++)for(let x=left;x<left+tileWidth;x++)if(next.pixels[(y*detail.width+x)*4+3]!==255){complete=false;break;}
  next.coverage!.values[index]=complete?255:0;
 }
 return next;
}

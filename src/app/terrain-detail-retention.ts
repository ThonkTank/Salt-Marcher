import type {TerrainDetail} from './terrain-detail';
import type {TerrainInvalidation} from './terrain-frame';
import {terrainBoxesOverlap} from './terrain-cache';
import {landscapeRasterBounds} from './landscape-raster';

const linearSample=(p:Uint8Array,a:number,b:number,c:number,d:number,fx:number,fy:number,channel:number)=>
 Math.round((p[a+channel]!*(1-fx)+p[b+channel]!*fx)*(1-fy)+(p[c+channel]!*(1-fx)+p[d+channel]!*fx)*fy);

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
  // Match the source texture's linear filter instead of magnifying each brush
  // texel into a hard square. RGBA is interpolated together at transparent edges.
  const sy=(detail.box.y+(y+.5)*detail.box.height/detail.height-fresh.box.y)/fresh.box.height*fresh.height-.5,
   iy=Math.floor(sy),fy=sy-iy,y0=Math.max(0,iy),y1=Math.min(fresh.height-1,iy+1);
  for(let x=left;x<right;x++){
   const at=(y*detail.width+x)*4;if(detail.pixels[at+3]!==0)continue;
   const sx=(detail.box.x+(x+.5)*detail.box.width/detail.width-fresh.box.x)/fresh.box.width*fresh.width-.5,
    ix=Math.floor(sx),fx=sx-ix,x0=Math.max(0,ix),x1=Math.min(fresh.width-1,ix+1),
    a=(y0*fresh.width+x0)*4,b=(y0*fresh.width+x1)*4,c=(y1*fresh.width+x0)*4,d=(y1*fresh.width+x1)*4;
   const alpha=linearSample(fresh.pixels,a,b,c,d,fx,fy,3);if(!alpha)continue;
   next??={...detail,pixels:detail.pixels.slice(),coverage:{columns,rows,values:detail.coverage?.values.slice()??new Uint8Array(columns*rows).fill(255)}};
   for(let channel=0;channel<3;channel++)next.pixels[at+channel]=linearSample(fresh.pixels,a,b,c,d,fx,fy,channel);
   next.pixels[at+3]=alpha;
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

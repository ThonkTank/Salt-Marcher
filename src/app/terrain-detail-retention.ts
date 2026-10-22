import type {TerrainDetail} from './terrain-detail';
import type {TerrainInvalidation} from './terrain-frame';
import {terrainBoxesOverlap} from './terrain-cache';
import {landscapeRasterBounds} from './landscape-raster';

/** Resample retained colour at the same world-addressed pixel centres.
 * Pans and source revisions usually keep the lattice: copy overlapping rows
 * directly instead of revisiting millions of individual colour components. */
export function retainTerrainDetail(target:TerrainDetail,previous:TerrainDetail){
 // A direct world-to-room jump can exceed 32-bit pixel coordinates.
 const xs=Float64Array.from({length:target.width},(_,x)=>Math.floor(((target.box.x+(x+.5)*target.box.width/target.width)-previous.box.x)/previous.box.width*previous.width));
 let left=0,right=target.width;
 while(left<right&&xs[left]!<0)left++;
 while(right>left&&xs[right-1]!>=previous.width)right--;
 if(left===right)return;
 // Compare the actual sample indices, so large origins and fractional boxes
 // use exactly the same rounding as the general resampling path.
 const start=xs[left]!,contiguous=xs.subarray(left,right).every((x,i)=>x===start+i);
 // Copy RGBA as an opaque four-byte value. No colour conversion or endian
 // interpretation; unaligned external views retain the component fallback.
 const packed=!contiguous&&target.pixels.byteOffset%4===0&&previous.pixels.byteOffset%4===0;
 const to=packed?new Uint32Array(target.pixels.buffer,target.pixels.byteOffset,target.pixels.length/4):undefined,
  from=packed?new Uint32Array(previous.pixels.buffer,previous.pixels.byteOffset,previous.pixels.length/4):undefined;
 let lastSourceRow=-1,lastTargetRow=-1;
 for(let y=0;y<target.height;y++){
  const sy=Math.floor(((target.box.y+(y+.5)*target.box.height/target.height)-previous.box.y)/previous.box.height*previous.height);if(sy<0||sy>=previous.height)continue;
  const dest=y*target.width;
  if(contiguous){
   const begin=sy*previous.width+start,end=begin+right-left;
   target.pixels.set(previous.pixels.subarray(begin*4,end*4),(dest+left)*4);
   if(target.forest){if(previous.forest)target.forest.set(previous.forest.subarray(begin,end),dest+left);else target.forest.fill(0,dest+left,dest+right);}
  }else if(sy===lastSourceRow){
   target.pixels.copyWithin((dest+left)*4,(lastTargetRow+left)*4,(lastTargetRow+right)*4);
   target.forest?.copyWithin(dest+left,lastTargetRow+left,lastTargetRow+right);
  }else for(let x=left;x<right;x++){
   const a=sy*previous.width+xs[x]!,b=dest+x;
   if(to)to[b]=from![a]!;else for(let c=0;c<4;c++)target.pixels[b*4+c]=previous.pixels[a*4+c]!;
   if(target.forest)target.forest[b]=previous.forest?.[a]??0;
  }
  lastSourceRow=sy;lastTargetRow=dest;
 }
}

/** Drop only affected tiles, including the shared raster's lighting/coast halo.
 * Pixels and availability belong to a published frame: never mutate them. */
export function invalidateTerrainDetail(detail:TerrainDetail,changes:TerrainInvalidation):TerrainDetail|undefined{
 if(changes.reset)return;
 const columns=detail.coverage?.columns??1,rows=detail.coverage?.rows??1,
  width=detail.width/columns,height=detail.height/rows;
 let next:TerrainDetail|undefined;
 for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
  const box={x:detail.box.x+column*detail.box.width/columns,y:detail.box.y+row*detail.box.height/rows,width:detail.box.width/columns,height:detail.box.height/rows};
  const bounds=landscapeRasterBounds(box,width,height);
  if(!changes.bounds.some(b=>terrainBoxesOverlap(bounds,b)))continue;
  next??={...detail,pixels:detail.pixels.slice(),...(detail.forest?{forest:detail.forest.slice()}:{}),coverage:{columns,rows,values:detail.coverage?.values.slice()??new Uint8Array(columns*rows).fill(255)}};
  next.coverage!.values[row*columns+column]=0;
  for(let y=row*height;y<(row+1)*height;y++){next.pixels.fill(0,(y*detail.width+column*width)*4,(y*detail.width+(column+1)*width)*4);next.forest?.fill(0,y*detail.width+column*width,y*detail.width+(column+1)*width);}
 }
 return next??detail;
}

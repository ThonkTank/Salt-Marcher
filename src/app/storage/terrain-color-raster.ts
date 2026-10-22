import {createHash} from 'node:crypto';
import {settingsRecord} from '../terrain-height';
import {terrainTraceMeasure,terrainTraceStart} from '../terrain-timing';
import type {LandscapeBox,LandscapeRecord} from '../atlas-landscape';
import {LandscapeRasterizer,landscapeRasterBounds} from '../landscape-raster';
import {streamTerrainFieldSteps,type TerrainSamples,type TerrainStream} from '../terrain-field-stream';
import type {TerrainProjectionCache} from '../terrain-projection-cache';
import {terrainDirtyRects} from '../terrain-dirty-rects';
export type ProjectionStream=((kind:'height'|'route'|'lake'|'base'|'cover'|'color'|'line',box:LandscapeBox,samples?:TerrainSamples)=>Iterable<LandscapeRecord>) & Pick<TerrainStream,'heightSources'>;
export interface TerrainColorOptions {
 /** Optional caller-owned output; cached and invalidated together with RGBA. */
 forest?:Uint8Array;settings:LandscapeRecord;stream:ProjectionStream;cache?:TerrainProjectionCache;batchEdge:number;retainField?:boolean;
 contours:number;revision:number;denseRoutes:boolean;retainedRoutes:ReadonlySet<string>;checkpoint:()=>Generator<void>;
}
/** Shared raster kernel for complete projections and independently requested colour tiles. */
export function* renderTerrainColor(area:LandscapeBox,pixelWidth:number,pixelHeight:number,displayMpp:number,options:TerrainColorOptions):Generator<void,Uint8Array>{
 const {settings,stream,cache,batchEdge,contours,revision,denseRoutes,retainedRoutes,checkpoint}=options,sea=settings.terrainSettings!.seaLevelM;
 // Display reads amortize the supersampled halo across bounded batches.
 // Cache entries and local invalidation remain 32-pixel pieces below.
 const pixels=new Uint8Array(pixelWidth*pixelHeight*4),forest=options.forest,edge=batchEdge;
 if(forest&&forest.length!==pixelWidth*pixelHeight)throw Error('Waldabdeckung passt nicht zum Raster.');
 // The route list/style is shared by every 32-pixel cache piece. A full copy in
 // each key can exceed the pixels themselves and evict an otherwise warm view.
 // Keep the complete context in a fixed-size digest, computed once per request.
 const context=cache?createHash('sha256').update(JSON.stringify([contours,displayMpp,settings.terrainSettings,denseRoutes?[...retainedRoutes]:null])).digest('hex'):'';
 const pixelBox=(x:number,y:number,width:number,height:number)=>({x:area.x+x*area.width/pixelWidth,y:area.y+y*area.height/pixelHeight,width:width*area.width/pixelWidth,height:height*area.height/pixelHeight});
 function* draw(box:LandscapeBox,width:number,height:number):Generator<void,{pixels:Uint8Array;forest?:Uint8Array}>{
   const image=new LandscapeRasterizer(box,width,height,contours,displayMpp,!!forest),samples=image.sampleLattice();image.paint(settings);
   const fieldEnd=terrainTraceStart('projection.field',revision);
   try{image.setTerrainField(yield* (cache&&options.retainField?cache.colorFieldSteps(samples,sea,stream,checkpoint):streamTerrainFieldSteps(samples,sea,stream,false,checkpoint)));}finally{fieldEnd();}
   // Base polygons/masks affect only sample centres, including the lighting halo.
   // Filter their bounds before decoding payloads. Feathered cover/pigment has
   // wider support and must keep its own conservative selection below.
   terrainTraceMeasure('projection.base',()=>{for(const r of stream('base',image.sampleBox,samples))image.paint(r);},revision);
   for(const r of stream('cover',image.sampleBox))yield* image.paintCoverSteps(r,checkpoint);
   // The colour stream releases its SQL statements before each owned record.
   for(const r of stream('color',image.sampleBox))yield* image.paintColorSteps(r,checkpoint);
   yield* image.prepareSurfaceSteps(checkpoint);
   if(denseRoutes)for(const r of stream('line',image.sampleBox))if(!retainedRoutes.has(r.id)){
    if(r.route?.nodes.length){const nodes=r.route.nodes;for(let i=1;i<nodes.length;i++)if(nodes[i-1]!.structure!=='tunnel'&&nodes[i]!.structure!=='tunnel')image.paintRecordLine({...r,route:undefined,points:[nodes[i-1]!,nodes[i]!]},displayMpp);}
    else image.paintRecordLine(r,displayMpp);
   }
   yield* checkpoint();
   const pixels=terrainTraceMeasure('projection.finish',()=>image.finish(),revision);return {pixels,forest:image.forest};
  };
 for(let y=0;y<pixelHeight;y+=edge)for(let x=0;x<pixelWidth;x+=edge){
  const width=Math.min(edge,pixelWidth-x),height=Math.min(edge,pixelHeight-y),box=pixelBox(x,y,width,height);
  if(!cache){const tile=yield* draw(box,width,height);for(let row=0;row<height;row++)pixels.set(tile.pixels.subarray(row*width*4,(row+1)*width*4),((y+row)*pixelWidth+x)*4);if(forest)for(let row=0;row<height;row++)forest.set(tile.forest!.subarray(row*width,(row+1)*width),(y+row)*pixelWidth+x);yield* checkpoint();continue;}
  const parts:{x:number;y:number;width:number;height:number;box:LandscapeBox;key:string;pixels?:Uint8Array;forest?:Uint8Array}[]=[];
  for(let py=0;py<height;py+=32)for(let px=0;px<width;px+=32){
   const w=Math.min(32,width-px),h=Math.min(32,height-py),b=pixelBox(x+px,y+py,w,h);
   const key=JSON.stringify([b,w,h,context]);
   const hit=cache.cachedColor(key);
   parts.push({x:px,y:py,width:w,height:h,box:b,key,...(hit&&(!forest||hit.forest)?{pixels:hit.pixels,forest:hit.forest}:{})});
  }
  // Cold tiles are sampled together; a local edit resamples only its small
  // missing pieces, including each piece's lighting/contour halo.
  const missing=Uint8Array.from(parts,p=>p.pixels?0:1);
  const batches=parts.filter(p=>!p.pixels).length>parts.length/2?[{x:0,y:0,width,height}]:terrainDirtyRects(missing,width,height,32,1024*1024);
  for(const batch of batches){
   const image=yield* draw(pixelBox(x+batch.x,y+batch.y,batch.width,batch.height),batch.width,batch.height);
   for(const part of parts){
    if(part.pixels||part.x<batch.x||part.y<batch.y||part.x+part.width>batch.x+batch.width||part.y+part.height>batch.y+batch.height)continue;
    part.pixels=new Uint8Array(part.width*part.height*4);
    for(let row=0;row<part.height;row++){const at=((part.y-batch.y+row)*batch.width+part.x-batch.x)*4;part.pixels.set(image.pixels.subarray(at,at+part.width*4),row*part.width*4);}
    if(forest){part.forest=new Uint8Array(part.width*part.height);for(let row=0;row<part.height;row++){const at=(part.y-batch.y+row)*batch.width+part.x-batch.x;part.forest.set(image.forest!.subarray(at,at+part.width),row*part.width);}}
    cache.rememberPixels(part.key,landscapeRasterBounds(part.box,part.width,part.height),part.pixels,part.forest);
   }
  }
  for(const part of parts){
   if(forest)for(let row=0;row<part.height;row++)forest.set(part.forest!.subarray(row*part.width,(row+1)*part.width),(y+part.y+row)*pixelWidth+x+part.x);
   for(let row=0;row<part.height;row++)pixels.set(part.pixels!.subarray(row*part.width*4,(row+1)*part.width*4),((y+part.y+row)*pixelWidth+x+part.x)*4);
  }
  yield* checkpoint();
 }
 return pixels;
}

export function readTerrainSettings(db:any,campaignId:string):LandscapeRecord{
 const row=db.prepare("SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.terrainSettings') IS NOT NULL").get(campaignId);
 return row?JSON.parse(row.payload):settingsRecord(0);
}
export function terrainColorRoutes(stream:ProjectionStream,box:LandscapeBox,focus?:LandscapeBox){
 const routes:LandscapeRecord[]=[],seen=new Set<string>();let bytes=0,denseRoutes=false;
 // Nearby vectors keep priority when broad horizon coverage contains many routes.
 for(const area of focus?[focus,box]:[box]){
 for(const r of stream('line',area)){
  if(seen.has(r.id))continue;seen.add(r.id);
  bytes+=JSON.stringify(r).length*2;
  if(routes.length<500&&bytes<=512*1024)routes.push(r);else {denseRoutes=true;break;}
 }
 if(denseRoutes)break;
 }
 return {routes,denseRoutes,retainedRoutes:new Set(routes.map(r=>r.id))};
}

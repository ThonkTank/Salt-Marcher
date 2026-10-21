import {settingsRecord} from '../terrain-height';
import {terrainTraceMeasure,terrainTraceStart} from '../terrain-timing';
import type {LandscapeBox,LandscapeRecord} from '../atlas-landscape';
import {LandscapeRasterizer,landscapeRasterBounds} from '../landscape-raster';
import {streamTerrainFieldSteps} from '../terrain-field-stream';
import type {TerrainProjectionCache} from '../terrain-projection-cache';
export type ProjectionStream=(kind:'height'|'route'|'lake'|'base'|'cover'|'color'|'line',box:LandscapeBox)=>Iterable<LandscapeRecord>;
export interface TerrainColorOptions {
 settings:LandscapeRecord;stream:ProjectionStream;cache?:TerrainProjectionCache;batchEdge:number;
 contours:number;revision:number;denseRoutes:boolean;retainedRoutes:ReadonlySet<string>;checkpoint:()=>Generator<void>;
}
/** Shared raster kernel for complete projections and independently requested colour tiles. */
export function* renderTerrainColor(area:LandscapeBox,pixelWidth:number,pixelHeight:number,displayMpp:number,options:TerrainColorOptions):Generator<void,Uint8Array>{
 const {settings,stream,cache,batchEdge,contours,revision,denseRoutes,retainedRoutes,checkpoint}=options,sea=settings.terrainSettings!.seaLevelM;
 // Display reads amortize the supersampled halo across bounded batches.
 // Cache entries and local invalidation remain 32-pixel pieces below.
 const pixels=new Uint8Array(pixelWidth*pixelHeight*4),edge=batchEdge;
 const pixelBox=(x:number,y:number,width:number,height:number)=>({x:area.x+x*area.width/pixelWidth,y:area.y+y*area.height/pixelHeight,width:width*area.width/pixelWidth,height:height*area.height/pixelHeight});
 function* draw(box:LandscapeBox,width:number,height:number):Generator<void,Uint8Array>{
   const image=new LandscapeRasterizer(box,width,height,contours,displayMpp);image.paint(settings);
   const fieldEnd=terrainTraceStart('projection.field',revision);
   try{image.setTerrainField(yield* streamTerrainFieldSteps(image.sampleLattice(),sea,stream,false,checkpoint));}finally{fieldEnd();}
   for(const r of stream('base',image.sampleBox))image.paint(r);
   for(const r of stream('cover',image.sampleBox))image.paintCover(r);
   for(const r of stream('color',image.sampleBox))image.paintColor(r);
   yield* image.prepareSurfaceSteps(checkpoint);
   if(denseRoutes)for(const r of stream('line',image.sampleBox))if(!retainedRoutes.has(r.id)){
    if(r.route?.nodes.length){const nodes=r.route.nodes;for(let i=1;i<nodes.length;i++)if(nodes[i-1]!.structure!=='tunnel'&&nodes[i]!.structure!=='tunnel')image.paintRecordLine({...r,route:undefined,points:[nodes[i-1]!,nodes[i]!]},displayMpp);}
    else image.paintRecordLine(r,displayMpp);
   }
   yield* checkpoint();
   return terrainTraceMeasure('projection.finish',()=>image.finish(),revision);
  };
 for(let y=0;y<pixelHeight;y+=edge)for(let x=0;x<pixelWidth;x+=edge){
  const width=Math.min(edge,pixelWidth-x),height=Math.min(edge,pixelHeight-y),box=pixelBox(x,y,width,height);
  if(!cache){const tile=yield* draw(box,width,height);for(let row=0;row<height;row++)pixels.set(tile.subarray(row*width*4,(row+1)*width*4),((y+row)*pixelWidth+x)*4);yield* checkpoint();continue;}
  const parts:{x:number;y:number;width:number;height:number;box:LandscapeBox;key:string;pixels?:Uint8Array}[]=[];
  for(let py=0;py<height;py+=32)for(let px=0;px<width;px+=32){
   const w=Math.min(32,width-px),h=Math.min(32,height-py),b=pixelBox(x+px,y+py,w,h);
   const key=JSON.stringify([b,w,h,contours,displayMpp,settings.terrainSettings,denseRoutes?[...retainedRoutes]:null]);
   parts.push({x:px,y:py,width:w,height:h,box:b,key,pixels:cache.cachedPixels(key)});
  }
  // Cold tiles are sampled together; a local edit resamples only its small
  // missing pieces, including each piece's lighting/contour halo.
  const batch=parts.filter(p=>!p.pixels).length>parts.length/2?(yield* draw(box,width,height)):undefined;
  for(const part of parts){
   if(!part.pixels){
    if(batch){part.pixels=new Uint8Array(part.width*part.height*4);for(let row=0;row<part.height;row++)part.pixels.set(batch.subarray(((part.y+row)*width+part.x)*4,((part.y+row)*width+part.x+part.width)*4),row*part.width*4);}
    else part.pixels=yield* draw(part.box,part.width,part.height);
    cache.rememberPixels(part.key,landscapeRasterBounds(part.box,part.width,part.height),part.pixels);
   }
   for(let row=0;row<part.height;row++)pixels.set(part.pixels.subarray(row*part.width*4,(row+1)*part.width*4),((y+part.y+row)*pixelWidth+x+part.x)*4);
  }
  yield* checkpoint();
 }
 return pixels;
}

export function readTerrainSettings(db:any,campaignId:string):LandscapeRecord{
 const row=db.prepare("SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.terrainSettings') IS NOT NULL").get(campaignId);
 return row?JSON.parse(row.payload):settingsRecord(0);
}
export function terrainColorRoutes(stream:ProjectionStream,box:LandscapeBox){
 const routes:LandscapeRecord[]=[];let bytes=0,denseRoutes=false;
 for(const r of stream('line',box)){
  bytes+=JSON.stringify(r).length*2;
  if(routes.length<500&&bytes<=512*1024)routes.push(r);else {denseRoutes=true;break;}
 }
 return {routes,denseRoutes,retainedRoutes:new Set(routes.map(r=>r.id))};
}

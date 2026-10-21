import {terrainTraceMeasure} from '../terrain-timing';
import {bounds,type LandscapeBox,type LandscapeRecord} from '../atlas-landscape';
import {streamTerrainField} from '../terrain-field-stream';
import {gridHeight} from '../terrain-spatial-model';
import {LandscapeRasterizer,landscapeRasterBounds} from '../landscape-raster';
import type {TerrainProjectionCache} from '../terrain-projection-cache';
import {brushPreviewRecords} from '../atlas-brush-worker';
import {heightBrushBounds} from '../terrain-brush';
import {TerrainSampler,settingsRecord} from '../terrain-height';
import {resolveTerrainObjects,terrainObjectPoints} from '../terrain-objects';
import {validateTerrainProjection,type TerrainProjectionRequest,type TerrainProjection} from '../terrain-projection';
import type {AtlasRegionSource} from '../atlas-region-contracts';
import {readTerrainGrid} from './terrain-grid';
import {readRouteTerrain} from './terrain-route';
import {terrainDetailDimensions} from '../terrain-detail';

export type ProjectionStream=(kind:'height'|'route'|'lake'|'base'|'cover'|'color'|'line',box:LandscapeBox)=>Iterable<LandscapeRecord>;
const overlap=(r:LandscapeRecord,b:LandscapeBox)=>{const a=bounds(r);return a.x<=b.x+b.width&&a.x+a.width>=b.x&&a.y<=b.y+b.height&&a.y+a.height>=b.y;};
/** Bounded display projection on the readonly worker. Draft edits read only local author records. */
export function readTerrainProjection(db:any,source:AtlasRegionSource,q:TerrainProjectionRequest,records:ProjectionStream,cache?:TerrainProjectionCache):TerrainProjection{
 const edge=!cache||q.heightStroke||q.color?Math.max(q.width,q.height,q.detailResolution??256):512;
 const steps=readTerrainProjectionSteps(db,source,q,records,cache,edge);
 for(;;){const step=steps.next();if(step.done)return step.value;}
}
/** Each yield occurs after complete SQL reads and cache writes. The worker may
 * release its WAL snapshot here and must revalidate the source before resuming. */
export function* readTerrainProjectionSteps(db:any,source:AtlasRegionSource,q:TerrainProjectionRequest,records:ProjectionStream,cache?:TerrainProjectionCache,batchEdge=128):Generator<void,TerrainProjection>{
 let sliceStart=performance.now();
 function* checkpoint(){if(performance.now()-sliceStart>=8){yield;sliceStart=performance.now();}}
 validateTerrainProjection(q);if(q.revision!==source.revision||q.fence!==undefined&&q.fence!==source.fence)throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');
 const setting=db.prepare("SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.terrainSettings') IS NOT NULL").get(source.campaignId);
 const settings:LandscapeRecord=setting?JSON.parse(setting.payload):settingsRecord(0),sea=settings.terrainSettings!.seaLevelM;
 let stream=records,protectedLimit:number|undefined,heightM:number|undefined;
 const draft=!!(q.heightStroke||q.color);if(draft)cache=undefined;
 let local:LandscapeRecord[]|undefined;
 if(draft){
  const area=q.heightStroke?heightBrushBounds({...q.heightStroke,visibility:undefined}):bounds(q.color!);
  const original=readRouteTerrain(db,source.campaignId,area,true),visibility=q.heightStroke?.visibility??q.color?.paint?.visibility;
  const grid=visibility?readTerrainGrid(db,source.campaignId,visibility,records):undefined;
  local=brushPreviewRecords({generation:0,box:area,width:q.width,height:q.height,records:original,heightStroke:q.heightStroke,color:q.color},f=>{protectedLimit=f;},grid);
  const before=new Map(original.map(r=>[r.id,JSON.stringify(r)])),changed=local.filter(r=>before.get(r.id)!==JSON.stringify(r)),ids=new Set(changed.map(r=>r.id));
  const kind=(r:LandscapeRecord)=>r.height?'height':r.route?'route':r.paint?'color':r.vegetation?'cover':r.surface==='freshwater'?'lake':'base';
  stream=function*(k,b){
   const updates=changed.filter(r=>!r.terrainSettings&&(k==='line'?r.kind==='road'||r.kind==='river':kind(r)===k)&&overlap(r,b)).sort((a,b)=>b.resolution-a.resolution||(a.order??0)-(b.order??0));let index=0;
   for(const r of records(k,b)){
    if(ids.has(r.id))continue;
    // Height levels must stay coarse-to-fine. Pigment updates are appended above the saved layers.
    if(k!=='color')while(index<updates.length&&updates[index]!.resolution>=r.resolution)yield updates[index++]!;
    yield r;
   }
   while(index<updates.length)yield updates[index++]!;
  };
  const p=q.heightStroke?.samples.at(-1);if(p)heightM=new TerrainSampler(local).sample(p).heightM;
 }
 const view=draft?{...q.view,columns:97,rows:97}:q.view,grid=terrainTraceMeasure("projection.grid",()=>readTerrainGrid(db,source.campaignId,view,stream,cache),source.revision);
 if(!draft)grid.view={...view,focusM:gridHeight(grid,{x:view.frame.x+view.frame.width/2,y:view.frame.y+view.frame.height/2})};
 yield* checkpoint();
 const routes:LandscapeRecord[]=[];let routeBytes=0,denseRoutes=false;
 for(const r of stream('line',view.box)){
  routeBytes+=JSON.stringify(r).length*2;
  if(routes.length<500&&routeBytes<=512*1024)routes.push(r);
  else {denseRoutes=true;break;}
 }
 const retainedRoutes=new Set(routes.map(r=>r.id));
 const render=function*(area:LandscapeBox,pixelWidth:number,pixelHeight:number,displayMpp:number):Generator<void,Uint8Array>{
 // Display reads amortize the supersampled halo across bounded batches.
 // Cache entries and local invalidation remain 32-pixel pieces below.
 const pixels=new Uint8Array(pixelWidth*pixelHeight*4),edge=batchEdge;
 const pixelBox=(x:number,y:number,width:number,height:number)=>({x:area.x+x*area.width/pixelWidth,y:area.y+y*area.height/pixelHeight,width:width*area.width/pixelWidth,height:height*area.height/pixelHeight});
 const draw=(box:LandscapeBox,width:number,height:number)=>{
   const image=new LandscapeRasterizer(box,width,height,q.contours,displayMpp);image.paint(settings);
   image.setTerrainField(terrainTraceMeasure('projection.field',()=>streamTerrainField(image.sampleLattice(),sea,stream,false),source.revision));
   for(const r of stream('base',image.sampleBox))image.paint(r);
   for(const r of stream('cover',image.sampleBox))image.paintCover(r);
   for(const r of stream('color',image.sampleBox))image.paintColor(r);
   if(denseRoutes)for(const r of stream('line',image.sampleBox))if(!retainedRoutes.has(r.id)){
    if(r.route?.nodes.length){const nodes=r.route.nodes;for(let i=1;i<nodes.length;i++)if(nodes[i-1]!.structure!=='tunnel'&&nodes[i]!.structure!=='tunnel')image.paintRecordLine({...r,route:undefined,points:[nodes[i-1]!,nodes[i]!]},displayMpp);}
    else image.paintRecordLine(r,displayMpp);
   }
   return terrainTraceMeasure('projection.finish',()=>image.finish(),source.revision);
  };
 for(let y=0;y<pixelHeight;y+=edge)for(let x=0;x<pixelWidth;x+=edge){
  const width=Math.min(edge,pixelWidth-x),height=Math.min(edge,pixelHeight-y),box=pixelBox(x,y,width,height);
  if(!cache){const tile=draw(box,width,height);for(let row=0;row<height;row++)pixels.set(tile.subarray(row*width*4,(row+1)*width*4),((y+row)*pixelWidth+x)*4);yield* checkpoint();continue;}
  const parts:{x:number;y:number;width:number;height:number;box:LandscapeBox;key:string;pixels?:Uint8Array}[]=[];
  for(let py=0;py<height;py+=32)for(let px=0;px<width;px+=32){
   const w=Math.min(32,width-px),h=Math.min(32,height-py),b=pixelBox(x+px,y+py,w,h);
   const key=JSON.stringify([b,w,h,q.contours,displayMpp,settings.terrainSettings,denseRoutes?[...retainedRoutes]:null]);
   parts.push({x:px,y:py,width:w,height:h,box:b,key,pixels:cache.cachedPixels(key)});
  }
  // Cold tiles are sampled together; a local edit resamples only its small
  // missing pieces, including each piece's lighting/contour halo.
  const batch=parts.filter(p=>!p.pixels).length>parts.length/2?draw(box,width,height):undefined;
  for(const part of parts){
   if(!part.pixels){
    if(batch){part.pixels=new Uint8Array(part.width*part.height*4);for(let row=0;row<part.height;row++)part.pixels.set(batch.subarray(((part.y+row)*width+part.x)*4,((part.y+row)*width+part.x+part.width)*4),row*part.width*4);}
    else part.pixels=draw(part.box,part.width,part.height);
    cache.rememberPixels(part.key,landscapeRasterBounds(part.box,part.width,part.height),part.pixels);
   }
   for(let row=0;row<part.height;row++)pixels.set(part.pixels.subarray(row*part.width*4,(row+1)*part.width*4),((y+part.y+row)*pixelWidth+x+part.x)*4);
  }
  yield* checkpoint();
 }
 return pixels;
 };
 const pixels=yield* render(view.box,q.width,q.height,q.displayMpp);
 const size=q.detail&&terrainDetailDimensions(q.detail,q.detailResolution);
 const detail=q.detail&&size?{box:q.detail,...size,pixels:yield* render(q.detail,size.width,size.height,Math.min(q.displayMpp,Math.max(q.detail.width/size.width,q.detail.height/size.height)))}:undefined;
 const objects:TerrainProjection['objects']=[];
 for(const o of q.objects??[]){
  objects.push(...terrainTraceMeasure('projection.objects',()=>{
  const p=terrainObjectPoints(o),x=Math.min(...p.map(p=>p.x)),y=Math.min(...p.map(p=>p.y)),right=Math.max(...p.map(p=>p.x)),bottom=Math.max(...p.map(p=>p.y));
  const terrain=readRouteTerrain(db,source.campaignId,{x:x-1,y:y-1,width:right-x+2,height:bottom-y+2});
  if(local){const ids=new Set(local.map(r=>r.id));return resolveTerrainObjects([o],[...terrain.filter(r=>!ids.has(r.id)),...local]);}
  return resolveTerrainObjects([o],terrain);
  },source.revision));
  yield* checkpoint();
 }
 return{revision:source.revision,fence:source.fence,generation:0,source:source.fence,grid,pixels,detail,width:q.width,height:q.height,draft,objects,routes,protectedLimit,heightM,contourInk:settings.terrainSettings!.style?.ink};
}

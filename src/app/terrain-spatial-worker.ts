import {resolveTerrainObjects,type TerrainObjectSource} from './terrain-objects';
import type {LandscapeRecord} from './atlas-landscape';
import {TerrainSampler} from './terrain-height';
import {brushPreviewRecords,type BrushPreviewJob} from './atlas-brush-worker';
import {terrainGrid,type TerrainView,type TerrainGrid} from './terrain-spatial-model';
import {LandscapeRasterizer} from './landscape-raster';
import {orderedColors} from './landscape-brush';
import {terrainColors} from './world-model';
import {DEFAULT_TERRAIN_STYLE} from './terrain-relief';
export interface SpatialJob extends BrushPreviewJob {view:TerrainView;source:string;objectSources?:TerrainObjectSource[];routeRecords?:LandscapeRecord[]}
export interface SpatialReply {rasterRouteKey?:string;detail?:import("./terrain-detail").TerrainDetail;identity?:import("./terrain-frame").TerrainFrameIdentity;update?:{base:import("./terrain-frame").TerrainFrameIdentity;heights:import("./terrain-frame").TerrainRect[];pixels:import("./terrain-frame").TerrainRect[];forest?:import("./terrain-frame").TerrainRect[];detailForest?:import("./terrain-frame").TerrainRect[];detail?:import("./terrain-frame").TerrainRect[]};objects?:import("./terrain-objects").TerrainObject[];generation:number;source:string;grid:TerrainGrid;pixels:Uint8Array;forest?:Uint8Array;width:number;height:number;draft:boolean;routes?:LandscapeRecord[];vegetation?:LandscapeRecord[];protectedLimit?:number;heightM?:number;contourInk?:string;landColor?:string;
 /** Renderer composition only: confirmed local colour under retained fine tiles. */
 brushDetail?:import('./terrain-detail').TerrainDetail;
}
export function renderTerrainSpatial(job:SpatialJob):SpatialReply{
  let protectedLimit:number|undefined;
  const preview=brushPreviewRecords(job,factor=>{protectedLimit=factor;}),records=job.routeRecords?[...new Map([...preview,...job.routeRecords].map(r=>[r.id,r])).values()]:preview,grid=terrainGrid(records,job.view),image=new LandscapeRasterizer(job.box,job.width,job.height,0,job.displayMpp,true);
  for(const r of records)image.paint(r);for(const r of orderedColors(records))image.paintColor(r);
  const routes=records.filter(r=>r.kind==='road'||r.kind==='river');
  const point=job.heightStroke?.samples.at(-1);
  const contourInk=records.find(r=>r.terrainSettings)?.terrainSettings?.style?.ink??DEFAULT_TERRAIN_STYLE.ink;
  // This texture is the opaque world base. Empty raster pixels are ocean, not black holes.
  const pixels=image.finish(),water=[1,3,5].map(i=>parseInt(terrainColors.water.slice(i,i+2),16));
  for(let i=0;i<pixels.length;i+=4){const alpha=pixels[i+3]!/255;if(alpha<1){for(let c=0;c<3;c++)pixels[i+c]=Math.round(pixels[i+c]!*alpha+water[c]!*(1-alpha));pixels[i+3]=255;}}
  return {objects:resolveTerrainObjects(job.objectSources??[],records),routes,vegetation:records.filter(r=>r.vegetationView),protectedLimit,contourInk,heightM:point?new TerrainSampler(records).sample(point).heightM:undefined,generation:job.generation,source:job.source,grid,pixels,forest:image.forest,width:job.width,height:job.height,draft:!!(job.heightStroke||job.color||job.routeRecords)};
}
if(typeof self!=='undefined'&&typeof document==='undefined')self.onmessage=(event:MessageEvent<SpatialJob>)=>{
  try{const result=renderTerrainSpatial(event.data);self.postMessage(result,{transfer:[result.pixels.buffer,result.grid.heights.buffer,...(result.forest?[result.forest.buffer]:[])]});}
  catch(error){self.postMessage({generation:event.data.generation,source:event.data.source,error:(error as Error).message});}
};

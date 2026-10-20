import type {LandscapeRecord} from './atlas-landscape';
import {TerrainSampler} from './terrain-height';
import {brushPreviewRecords,type BrushPreviewJob} from './atlas-brush-worker';
import {terrainGrid,type TerrainView,type TerrainGrid} from './terrain-spatial-model';
import {LandscapeRasterizer} from './landscape-raster';
import {orderedColors} from './landscape-brush';
export interface SpatialJob extends BrushPreviewJob {view:TerrainView;source:string}
export interface SpatialReply {generation:number;source:string;grid:TerrainGrid;pixels:Uint8Array;width:number;height:number;draft:boolean;routes?:LandscapeRecord[];protectedLimit?:number;heightM?:number}
export function renderTerrainSpatial(job:SpatialJob):SpatialReply{
  let protectedLimit:number|undefined;
  const records=brushPreviewRecords(job,factor=>{protectedLimit=factor;}),grid=terrainGrid(records,job.view),image=new LandscapeRasterizer(job.box,job.width,job.height,job.contours,job.displayMpp);
  for(const r of records)image.paint(r);for(const r of orderedColors(records))image.paintColor(r);
  const routes=records.filter(r=>r.kind==='road'||r.kind==='river');
  const point=job.heightStroke?.samples.at(-1);
  return {routes,protectedLimit,heightM:point?new TerrainSampler(records).sample(point).heightM:undefined,generation:job.generation,source:job.source,grid,pixels:image.finish(),width:job.width,height:job.height,draft:!!(job.heightStroke||job.color)};
}
if(typeof self!=='undefined'&&typeof document==='undefined')self.onmessage=(event:MessageEvent<SpatialJob>)=>{
  try{const result=renderTerrainSpatial(event.data);self.postMessage(result,{transfer:[result.pixels.buffer,result.grid.heights.buffer]});}
  catch(error){self.postMessage({generation:event.data.generation,source:event.data.source,error:(error as Error).message});}
};

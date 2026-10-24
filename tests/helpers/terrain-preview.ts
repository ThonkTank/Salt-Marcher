import {brushPreviewRecords,type BrushPreviewJob} from '../../src/app/atlas-brush-worker';
import {terrainGrid,type TerrainView} from '../../src/app/terrain-spatial-model';
import {LandscapeRasterizer} from '../../src/app/landscape-raster';
import {orderedColors} from '../../src/app/landscape-brush';
/** Independent local author result used to compare streamed storage and committed bytes. */
export function terrainPreview(job:BrushPreviewJob & {view:TerrainView}){
 const records=brushPreviewRecords(job),image=new LandscapeRasterizer(job.box,job.width,job.height,0,job.displayMpp,true);
 for(const r of records)image.paint(r);for(const r of orderedColors(records))image.paintColor(r);
 return {grid:terrainGrid(records,job.view),pixels:image.finish()};
}

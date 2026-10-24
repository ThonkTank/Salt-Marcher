import {streamTerrainFieldSteps,type TerrainStream} from '../terrain-field-stream';
import {validateTerrainView,type TerrainView,type TerrainGrid} from '../terrain-spatial-model';
import type {LandscapeRecord} from '../atlas-landscape';
import {terrainGridLayout} from '../terrain-grid-layout';
import {landscapeSampleFilter} from './landscape-record-stream';

/** Authoritative visibility lattice. Never accepts heights supplied by the renderer. */
export function readTerrainGrid(db:any,cam:string,view:TerrainView,stream?:TerrainStream,cache?:import('../terrain-projection-cache').TerrainProjectionCache,canonicalSettings?:{seaLevelM:number}):TerrainGrid{
 const steps=readTerrainGridSteps(db,cam,view,function*(){},stream,cache,65536,canonicalSettings);
 for(;;){const step=steps.next();if(step.done)return step.value;}
}
/** The same authoritative lattice, with scheduling boundaries between complete
 * source reads. Only a finished grid is returned to the display or author. */
export function* readTerrainGridSteps(db:any,cam:string,view:TerrainView,checkpoint:()=>Generator<void>,stream?:TerrainStream,cache?:import('../terrain-projection-cache').TerrainProjectionCache,maxSamples=4096,canonicalSettings?:{seaLevelM:number}):Generator<void,TerrainGrid>{
 validateTerrainView(view);
 if(!stream&&db.prepare("SELECT 1 FROM atlas_landscape WHERE campaign_id=? AND NOT json_valid(payload) LIMIT 1").get(cam))throw Error('Geländequelle beschädigt.');
 const settings=canonicalSettings===undefined?db.prepare("SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.terrainSettings') IS NOT NULL").get(cam):undefined;
 const seaLevelM=canonicalSettings===undefined?(settings?JSON.parse(settings.payload).terrainSettings.seaLevelM:0):canonicalSettings.seaLevelM;
 const records:TerrainStream=stream??function*(kind,box,samples){
  const filter=kind==='height'?"json_extract(payload,'$.height') IS NOT NULL":kind==='route'?"json_extract(payload,'$.route') IS NOT NULL":"json_extract(payload,'$.surface')='freshwater'";
  // Sort only keys; do not retain or sort complete author payloads in JS/SQLite.
  const sampled=landscapeSampleFilter(box,samples?{width:samples.columns/2,height:samples.rows/2}:0,kind==='height');
  const rows=db.prepare(`SELECT rowid FROM atlas_landscape WHERE campaign_id=? AND max_x>=? AND min_x<=? AND max_y>=? AND min_y<=? AND json_valid(payload) AND ${filter} ${sampled.sql} ORDER BY CAST(json_extract(payload,'$.resolution') AS REAL) DESC,coalesce(json_extract(payload,'$.order'),0),rowid`).iterate(cam,box.x,box.x+box.width,box.y,box.y+box.height,...sampled.args);
  const get=db.prepare('SELECT payload FROM atlas_landscape WHERE rowid=?');
  for(const row of rows)yield JSON.parse(get.get(row.rowid).payload) as LandscapeRecord;
 };
 const heights=new Float32Array(view.columns*view.rows),ground=new Float32Array(heights.length),water=new Float32Array(heights.length);
 for(const {x,y,lattice}of terrainGridLayout(view).blocks){
  let field:{surface:Float32Array;ground?:Float32Array;levels?:Float32Array};
  if(cache)field=yield* cache.gridDataSteps(lattice,seaLevelM,records,checkpoint,true,maxSamples);
  else {const sampled=yield* streamTerrainFieldSteps(lattice,seaLevelM,records,true,checkpoint,maxSamples);field={surface:sampled.surface!,ground:sampled.heights,levels:sampled.levels};}
  for(let row=0;row<lattice.rows;row++){const start=row*lattice.columns,end=(row+1)*lattice.columns,offset=(y+row)*view.columns+x;
   heights.set(field.surface.subarray(start,end),offset);ground.set(field.ground!.subarray(start,end),offset);water.set(field.levels!.subarray(start,end),offset);
  }
  yield* checkpoint();
 }
 return{view,heights,seaLevelM,editing:{ground,water}};
}

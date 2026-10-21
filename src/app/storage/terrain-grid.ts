import {streamTerrainField,type TerrainStream} from '../terrain-field-stream';
import {validateTerrainView,type TerrainView,type TerrainGrid} from '../terrain-spatial-model';
import type {LandscapeRecord} from '../atlas-landscape';
import {terrainGridLayout} from '../terrain-grid-layout';

/** Authoritative visibility lattice. Never accepts heights supplied by the renderer. */
export function readTerrainGrid(db:any,cam:string,view:TerrainView,stream?:TerrainStream,cache?:import('../terrain-projection-cache').TerrainProjectionCache):TerrainGrid{
 validateTerrainView(view);
 if(!stream&&db.prepare("SELECT 1 FROM atlas_landscape WHERE campaign_id=? AND NOT json_valid(payload) LIMIT 1").get(cam))throw Error('Geländequelle beschädigt.');
 const settings=db.prepare("SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.terrainSettings') IS NOT NULL").get(cam);
 const seaLevelM=settings?JSON.parse(settings.payload).terrainSettings.seaLevelM:0;
 const records:TerrainStream=stream??function*(kind,box){
  const filter=kind==='height'?"json_extract(payload,'$.height') IS NOT NULL":kind==='route'?"json_extract(payload,'$.route') IS NOT NULL":"json_extract(payload,'$.surface')='freshwater'";
  // Sort only keys; do not retain or sort complete author payloads in JS/SQLite.
  const rows=db.prepare(`SELECT rowid FROM atlas_landscape WHERE campaign_id=? AND max_x>=? AND min_x<=? AND max_y>=? AND min_y<=? AND json_valid(payload) AND ${filter} ORDER BY CAST(json_extract(payload,'$.resolution') AS REAL) DESC,coalesce(json_extract(payload,'$.order'),0),rowid`).iterate(cam,box.x,box.x+box.width,box.y,box.y+box.height);
  const get=db.prepare('SELECT payload FROM atlas_landscape WHERE rowid=?');
  for(const row of rows)yield JSON.parse(get.get(row.rowid).payload) as LandscapeRecord;
 };
 const heights=new Float32Array(view.columns*view.rows);
 for(const {x,y,lattice}of terrainGridLayout(view).blocks){
  const part=cache?cache.grid(lattice,seaLevelM,records):streamTerrainField(lattice,seaLevelM,records).surface!;
  for(let row=0;row<lattice.rows;row++)heights.set(part.subarray(row*lattice.columns,(row+1)*lattice.columns),(y+row)*view.columns+x);
 }
 return{view,heights,seaLevelM};
}

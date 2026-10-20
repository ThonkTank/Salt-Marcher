import {TerrainProjectionCache} from '../terrain-projection-cache';
import type {TerrainGrid,TerrainView} from '../terrain-spatial-model';
import type {TerrainInvalidation} from '../terrain-frame';
import {readTerrainGrid} from './terrain-grid';
import {terrainGridLayout} from '../terrain-grid-layout';
/** Main-owned derived surface blocks. The fence must describe committed canonical rows.
 * Seeding comes only from the trusted readonly worker, never from a renderer grid.
 * Advance only after a successful transaction; a rollback never installs its bounds/source.
 */
export class TerrainAuthorCache {
 readonly cache=new TerrainProjectionCache(8*1024*1024);
 private fence='';
 private campaign='';
 private observe(cam:string,fence:string){if(this.campaign!==cam||this.fence!==fence){this.cache.invalidate([],true);this.campaign=cam;this.fence=fence;}}
 read(db:any,cam:string,view:TerrainView,fence:string){this.observe(cam,fence);return readTerrainGrid(db,cam,view,undefined,this.cache);}
 seed(cam:string,grid:TerrainGrid,fence:string){
  this.observe(cam,fence);const v=grid.view;
  for(const {x,y,lattice}of terrainGridLayout(v).blocks){
   const heights=new Float32Array(lattice.columns*lattice.rows);
   for(let row=0;row<lattice.rows;row++)heights.set(grid.heights.subarray((y+row)*v.columns+x,(y+row)*v.columns+x+lattice.columns),row*lattice.columns);
   this.cache.seedGrid(lattice,grid.seaLevelM,heights);
  }
 }
 advance(before:string,after:string,change:TerrainInvalidation){
  if(this.fence!==before){this.cache.invalidate([],true);}else this.cache.invalidate(change.bounds,change.reset);
  this.fence=after;
 }
}

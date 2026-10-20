import {TerrainProjectionCache} from '../terrain-projection-cache';
import type {TerrainGrid,TerrainView} from '../terrain-spatial-model';
import type {TerrainInvalidation} from '../terrain-frame';
import {readTerrainGrid} from './terrain-grid';
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
  this.observe(cam,fence);const v=grid.view,b=v.box;
  this.cache.seedGrid({x:b.x,y:b.y,dx:b.width/(v.columns-1),dy:b.height/(v.rows-1),columns:v.columns,rows:v.rows},grid.seaLevelM,grid.heights);
 }
 advance(before:string,after:string,change:TerrainInvalidation){
  if(this.fence!==before){this.cache.invalidate([],true);}else this.cache.invalidate(change.bounds,change.reset);
  this.fence=after;
 }
}

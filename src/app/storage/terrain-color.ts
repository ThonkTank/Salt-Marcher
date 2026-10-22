import {validateTerrainColor,type TerrainColorRequest,type TerrainColorTile} from '../terrain-color';
import type {AtlasRegionSource} from '../atlas-region-contracts';
import type {TerrainProjectionCache} from '../terrain-projection-cache';
import {readTerrainSettings,terrainColorRoutes,renderTerrainColor,type ProjectionStream} from './terrain-color-raster';
/** Same shader input as a full projection, without rebuilding or returning its geometry. */
export function* readTerrainColorSteps(db:any,source:AtlasRegionSource,q:TerrainColorRequest,stream:ProjectionStream,cache:TerrainProjectionCache):Generator<void,TerrainColorTile>{
 validateTerrainColor(q);
 if(q.revision!==source.revision||q.fence!==undefined&&q.fence!==source.fence)throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');
 let start=performance.now();function* checkpoint(){if(performance.now()-start>=8){yield;start=performance.now();}}
 const settings=readTerrainSettings(db,source.campaignId),routes=terrainColorRoutes(stream,q.routeContext,q.routeFocus);
 // Four bounded batches per colour tile amortize the supersampled halo;
 // checkpoints still release the worker between completed read snapshots.
 const forest=new Uint8Array(q.width*q.height);
 const pixels=yield* renderTerrainColor(q.box,q.width,q.height,q.displayMpp,{settings,stream,cache,forest,batchEdge:128,contours:q.contours,revision:source.revision,...routes,checkpoint});
 return {box:q.box,width:q.width,height:q.height,pixels,forest,revision:source.revision,fence:source.fence};
}

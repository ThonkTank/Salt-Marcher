import {atlasTilePlan,atlasPrefetchTiles} from './atlas-tile-plan';
import type {LandscapeBox} from './atlas-landscape';
/** Camera pixels are not data dependencies. Keep an in-flight request while
 * its stable world addresses still cover the new view at the requested LOD. */
export function atlasSurfaceRequestKey(token:string,revision:number,fence:string,box:LandscapeBox,metersPerPixel:number,maxTiles=16,focus?:LandscapeBox,preload?:LandscapeBox){
 const plan=atlasTilePlan(box,metersPerPixel,{maxTiles,focus});
 const keys=(tiles:typeof plan.detail)=>tiles.map(t=>`${t.lod}/${t.x}/${t.y}`).sort();
 return JSON.stringify([token,revision,fence,keys(plan.overview),keys(plan.detail),preload?keys(atlasPrefetchTiles(plan,preload)):[]]);
}

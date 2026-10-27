import type {TerrainAuthorGround} from './terrain-author-checkpoint';
import type {TerrainGrid,TerrainView} from './terrain-spatial-model';
import {validateTerrainView} from './terrain-spatial-model';
import {terrainGridLayout} from './terrain-grid-layout';
/** Existing bounded triangular ground approximation. Smooth/Level retain their
 * former clamp fallback; visibility explicitly requires covered samples. */
export function terrainAuthorGroundSample(ground:readonly TerrainAuthorGround[],p:{x:number;y:number},covered=false):number{
 const g=ground.filter(g=>p.x>=g.lattice.x&&p.x<=g.lattice.x+64*g.lattice.dx&&p.y>=g.lattice.y&&p.y<=g.lattice.y+64*g.lattice.dy).sort((a,b)=>a.lattice.dx*a.lattice.dy-b.lattice.dx*b.lattice.dy)[0]??(covered?undefined:ground[0]);
 if(!g)throw Error('Autoren-Visibilityground deckt den eingefrorenen Ausschnitt nicht.');const l=g.lattice,x=Math.max(0,Math.min(64,(p.x-l.x)/l.dx)),y=Math.max(0,Math.min(64,(p.y-l.y)/l.dy)),ix=Math.min(63,Math.floor(x)),iy=Math.min(63,Math.floor(y)),fx=x-ix,fy=y-iy,a=g.values[iy*65+ix]!,b=g.values[iy*65+ix+1]!,c=g.values[(iy+1)*65+ix]!,d=g.values[(iy+1)*65+ix+1]!;
 return fx+fy<=1?a*(1-fx-fy)+b*fx+c*fy:d*(fx+fy-1)+b*(1-fy)+c*(1-fx);
}
/** Immutable per-gesture raster. No missing outside terrain is fabricated.
 * Ground is raw; an explicitly bound water sampler is required for water. */
export function* terrainAuthorVisibilitySteps(ground:readonly TerrainAuthorGround[],view:TerrainView,water?:{seaLevelM:number;sample(p:{x:number;y:number}):number}):Generator<void,TerrainGrid>{
 validateTerrainView(view);const heights=new Float32Array(view.columns*view.rows),layout=terrainGridLayout(view);
 for(let y=0;y<view.rows;y++)for(let x=0;x<view.columns;x++){if((x&15)===0)yield;const p={x:layout.x.values[x]!,y:layout.y.values[y]!},h=terrainAuthorGroundSample(ground,p,true);heights[y*view.columns+x]=water?Math.max(h,water.sample(p)):h;if(!Number.isFinite(heights[y*view.columns+x]))throw Error('Autoren-Visibilitywert nicht darstellbar.');}
 return{view,heights,seaLevelM:water?.seaLevelM??0};
}
export function terrainAuthorVisibility(ground:readonly TerrainAuthorGround[],view:TerrainView,water?:{seaLevelM:number;sample(p:{x:number;y:number}):number}){const work=terrainAuthorVisibilitySteps(ground,view,water);let step=work.next();while(!step.done)step=work.next();return step.value;}

import type {TerrainAuthorSource} from './terrain-author-checkpoint';
import {atlasTerrainTileQuery} from './atlas-terrain-tile';
import {gridHeight} from './terrain-spatial-model';
export interface TerrainAuthorWaterSource {readonly id:number;readonly lod:number;readonly x:number;readonly y:number;readonly seaLevelM:number;readonly water:Float32Array}
/** A local immutable handle. E obtains it from the exact confirmed basis; only
 * its typed scalar/ref DTO crosses the worker boundary. Height-only receipts
 * may keep this source; unrelated water/source changes retire the editseries. */
export interface TerrainAuthorVisibilityContext {readonly owner:string;readonly series:number;readonly source:TerrainAuthorSource;readonly sources:readonly TerrainAuthorWaterSource[]}
export function validateTerrainAuthorVisibility(context:TerrainAuthorVisibilityContext,owner:string,series:number,allowed:(source:TerrainAuthorSource)=>boolean){
 if(context.owner!==owner||context.series!==series||!allowed(context.source)||context.sources.length<1||context.sources.length>32)throw Error('Autoren-Visibilityquelle inzwischen geändert.');const ids=new Set<number>();
 for(const s of context.sources){if(!Number.isSafeInteger(s.id)||s.id<1||ids.has(s.id)||!Number.isFinite(s.seaLevelM)||!(s.water instanceof Float32Array)||s.water.length!==4225||!s.water.every(Number.isFinite))throw Error('Autoren-Waterquelle prüfen.');ids.add(s.id);atlasTerrainTileQuery({tile:{lod:s.lod,x:s.x,y:s.y},revision:context.source.revision,product:'height'});}
}
export function terrainAuthorWater(context:TerrainAuthorVisibilityContext){
 const grids=context.sources.map(s=>({id:s.id,grid:{view:atlasTerrainTileQuery({tile:{lod:s.lod,x:s.x,y:s.y},revision:context.source.revision,product:'height'}).view,heights:s.water,seaLevelM:s.seaLevelM}}));
 return{seaLevelM:grids[0]!.grid.seaLevelM,sample(p:{x:number;y:number}){let selected:typeof grids[number]|undefined;for(const g of grids){const b=g.grid.view.box;if(p.x>=b.x&&p.x<=b.x+b.width&&p.y>=b.y&&p.y<=b.y+b.height&&(!selected||b.width<selected.grid.view.box.width||b.width===selected.grid.view.box.width&&g.id<selected.id))selected=g;}if(!selected)throw Error('Autoren-Waterquelle deckt den eingefrorenen Ausschnitt nicht.');return Math.max(selected.grid.seaLevelM,gridHeight(selected.grid,p));}};
}

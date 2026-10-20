import {validateTerrainDetail} from './terrain-detail';
import {REGION_VECTOR_OBJECTS} from './atlas-region-contracts';
import {validateTerrainView,type TerrainView} from './terrain-spatial-model';
import {validateHeightStroke,type HeightStroke} from './terrain-brush';
import {validateColor} from './landscape-brush';
import type {LandscapeRecord} from './atlas-landscape';
import {validateTerrainAnchor,type TerrainObjectSource} from './terrain-objects';
import type {SpatialReply} from './terrain-spatial-worker';

export interface TerrainProjectionRequest {
 detail?:import('./atlas-landscape').LandscapeBox;view:TerrainView;width:number;height:number;contours:number;displayMpp:number;
 revision:number;fence?:string;objects?:TerrainObjectSource[];heightStroke?:HeightStroke;color?:LandscapeRecord;
}
export interface TerrainProjection extends SpatialReply {revision:number;fence:string}
/** Display-only request: source heights never cross this boundary from the caller. */
export function validateTerrainProjection(q:TerrainProjectionRequest){
 if(!q)throw Error('Geländeansicht prüfen.');validateTerrainView(q.view);validateTerrainDetail(q.detail,q.view.box);
 if(!Number.isSafeInteger(q.revision)||q.revision<0||q.fence!==undefined&&typeof q.fence!=='string'||
  ![q.width,q.height].every(n=>Number.isInteger(n)&&n>=16&&n<=1024)||
  !Number.isFinite(q.contours)||q.contours<0||q.contours>100000||!Number.isFinite(q.displayMpp)||q.displayMpp<=0||
  q.heightStroke&&q.color||Object.keys(q).some(k=>!['detail','view','width','height','contours','displayMpp','revision','fence','objects','heightStroke','color'].includes(k)))throw Error('Geländeansicht prüfen.');
 if(q.heightStroke)validateHeightStroke(q.heightStroke);if(q.color)validateColor(q.color);
 if(q.objects!==undefined){
  if(!Array.isArray(q.objects)||q.objects.length>REGION_VECTOR_OBJECTS)throw Error('Zu viele Baukörper für diese Ansicht.');let points=0;
  for(const o of q.objects){
   validateTerrainAnchor(o.binding);
   if(!['building','entrance'].includes(o.kind)||typeof o.id!=='string'||typeof o.name!=='string'||!Array.isArray(o.outline)||!Array.isArray(o.floorElevations)||
    ![o.wallM,o.roofM,...o.floorElevations].every(z=>Number.isFinite(z)&&Math.abs(z)<=100000)||o.wallM<0||o.roofM<0||typeof o.color!=='string'||
    ![o.anchor,...o.outline].every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.max(Math.abs(p.x),Math.abs(p.y))<=1e12))throw Error('Baukörper prüfen.');
   points+=o.outline.length+o.floorElevations.length;if(points>100000)throw Error('Zu viele Baukörperpunkte.');
  }
 }
 if(JSON.stringify(q).length>2*1024*1024)throw Error('Geländeauftrag zu groß.');
}

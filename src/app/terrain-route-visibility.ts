import * as THREE from 'three';
import {routeDisplayVisible} from './terrain-route-display';

/** The view replaces this list when route geometry/policy changes. Its route
 * matrices are fixed; only a different camera or viewport needs another pass. */
export class TerrainRouteVisibility {
 private routes:readonly THREE.Mesh[]|null=null;
 private matrix=new Float64Array(16);
 private scale=NaN;
 update(routes:readonly THREE.Mesh[],camera:THREE.Camera,height:number){
  const matrix=camera.matrixWorldInverse.elements,scale=camera.projectionMatrix.elements[5]!*height;
  if(this.routes===routes&&this.scale===scale&&matrix.every((v,i)=>v===this.matrix[i]))return false;
  this.routes=routes;this.scale=scale;this.matrix.set(matrix);
  for(const route of routes)route.visible=routeDisplayVisible(route,camera,height);
  return true;
 }
 clear(){this.routes=null;}
}

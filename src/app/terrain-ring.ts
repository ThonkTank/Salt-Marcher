import * as THREE from 'three';
import type {Point} from './contracts';
import {gridHeight,type TerrainGrid} from './terrain-spatial-model';

/** One retained GPU ring. Pointer moves update vertices; hiding keeps its shader. */
export class TerrainRing {
 readonly line:THREE.Line<THREE.BufferGeometry,THREE.LineBasicMaterial>;
 private point:Point|null=null;
 private radius=0;
 constructor(color:string){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(65*3),3).setUsage(THREE.DynamicDrawUsage));
  this.line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,depthTest:true}));
  // The small surface offset can share a depth-buffer value with the ground.
  // Draw after opaque terrain explicitly; material creation order is no longer
  // a reliable ordering rule when this material survives surface replacement.
  this.line.renderOrder=1;
  this.line.visible=false;this.line.updateMatrixWorld(true);
  this.line.matrixAutoUpdate=false;this.line.matrixWorldAutoUpdate=false;
 }
 set(point:Point|null,radius:number,grid:TerrainGrid|null,origin:Point){
  this.point=point?{...point}:null;this.radius=radius;return this.refresh(grid,origin);
 }
 refresh(grid:TerrainGrid|null,origin:Point){
  const visible=!!this.point&&!!grid&&this.radius>0,visibilityChanged=this.line.visible!==visible;
  this.line.visible=visible;if(!visible)return visibilityChanged;
  const g=grid!,p=this.point!,position=this.line.geometry.getAttribute('position') as THREE.BufferAttribute;
  let changed=false;
  for(let i=0;i<=64;i++){
   const angle=i*Math.PI/32,q={x:p.x+Math.cos(angle)*this.radius,y:p.y+Math.sin(angle)*this.radius};
   const x=Math.fround(q.x-origin.x),y=Math.fround(origin.y-q.y),z=Math.fround((gridHeight(g,q)-g.view.focusM)*g.view.exaggeration+g.view.frame.width*.00015);
   if(position.getX(i)!==x||position.getY(i)!==y||position.getZ(i)!==z){position.setXYZ(i,x,y,z);changed=true;}
  }
  if(changed){position.needsUpdate=true;this.line.geometry.computeBoundingSphere();}
  return visibilityChanged||changed;
 }
 dispose(){this.line.removeFromParent();this.line.geometry.dispose();this.line.material.dispose();}
}

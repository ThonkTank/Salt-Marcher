import * as THREE from 'three';
import type {TerrainRect} from './terrain-frame';

/** Upload changed pixels without rebuilding geometry. Three's update ranges
 * issue one GL command per row; its CPU texture copy accepts a whole rectangle. */
export function uploadTerrainTexture(texture:THREE.DataTexture,rects:TerrainRect[]|undefined,renderer?:THREE.WebGLRenderer){
  texture.clearUpdateRanges();
  if(!rects){texture.needsUpdate=true;return;}
  if(!rects.length)return;
  if(!renderer){
    for(const r of rects)for(let y=r.y;y<r.y+r.height;y++)texture.addUpdateRange((y*texture.image.width+r.x)*4,r.width*4);
    texture.needsUpdate=true;return;
  }
  // Never bind this source for rendering: otherwise Three copies old GPU data.
  // It shares the CPU buffer and allocates no additional GPU texture.
  const source=new THREE.DataTexture();source.image=texture.image;
  try{
    for(const r of rects)renderer.copyTextureToTexture(source,texture,new THREE.Box2(new THREE.Vector2(r.x,r.y),new THREE.Vector2(r.x+r.width,r.y+r.height)),new THREE.Vector2(r.x,r.y));
  }finally{source.dispose();}
}

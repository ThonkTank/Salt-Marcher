import * as THREE from 'three';
import type {Point} from './contracts';
import type {TerrainGrid} from './terrain-spatial-model';
import type {SpatialReply} from './terrain-spatial-worker';
import type {TerrainRect} from './terrain-frame';
import {terrainContourMaterial,terrainContourUniforms} from './terrain-contours';
import {terrainGridLayout} from './terrain-grid-layout';
import {uploadTerrainTexture} from './terrain-texture-upload';

type Mesh=THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
function terrainTexture(data:SpatialReply){
  const map=new THREE.DataTexture(data.pixels,data.width,data.height,THREE.RGBAFormat);map.colorSpace=THREE.SRGBColorSpace;
  map.minFilter=map.magFilter=THREE.LinearFilter;map.needsUpdate=true;return map;
}

/** Own buffer/texture replacement while retaining the mesh and its shader.
 * Topology depends on sample counts, not world bounds or image resolution.
 * Changed domains still overwrite every vertex/UV; only confirmed deltas may
 * leave old samples in place. */
export function updateTerrainMesh(mesh:Mesh|null,data:SpatialReply,previous:TerrainGrid|null,oldOrigin:Point,origin:Point,
  partial:SpatialReply['update'],contours:ReturnType<typeof terrainContourUniforms>,renderer?:THREE.WebGLRenderer){
  const g=data.grid,v=g.view,b=v.box,l=terrainGridLayout(v),texture=mesh?.material.map as THREE.DataTexture|undefined;
  const topology=!!mesh&&!!previous&&previous.view.columns===v.columns&&previous.view.rows===v.rows;
  const domain=!!previous&&JSON.stringify([previous.view.box,previous.view.refinement])===JSON.stringify([b,v.refinement]);
  const moved=!previous||JSON.stringify([oldOrigin,previous.view.focusM,previous.view.exaggeration])!==JSON.stringify([origin,v.focusM,v.exaggeration]);
  const rects:TerrainRect[]=topology&&domain&&!moved&&partial?partial.heights:[{x:0,y:0,width:v.columns,height:v.rows}];
  const geometry=topology?mesh!.geometry:new THREE.BufferGeometry();
  const positions=topology?geometry.getAttribute('position').array as Float32Array:new Float32Array(v.columns*v.rows*3);
  for(const r of rects)for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++){
    const i=y*v.columns+x,at=i*3;
    positions[at]=l.x.values[x]!-origin.x;positions[at+1]=origin.y-l.y.values[y]!;positions[at+2]=(g.heights[i]!-v.focusM)*v.exaggeration;
  }
  if(!topology){
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(v.columns*v.rows*2),2));
    geometry.setAttribute('terrainElevation',new THREE.BufferAttribute(g.heights.slice(),1));
    const indices=v.columns*v.rows>65535?new Uint32Array((v.columns-1)*(v.rows-1)*6):new Uint16Array((v.columns-1)*(v.rows-1)*6);
    let at=0;for(let y=0;y<v.rows-1;y++)for(let x=0;x<v.columns-1;x++){
      const i=y*v.columns+x;indices[at++]=i;indices[at++]=i+v.columns;indices[at++]=i+1;indices[at++]=i+1;indices[at++]=i+v.columns;indices[at++]=i+v.columns+1;
    }
    geometry.setIndex(new THREE.BufferAttribute(indices,1));
  }else{
    const position=geometry.getAttribute('position') as THREE.BufferAttribute,elevation=geometry.getAttribute('terrainElevation') as THREE.BufferAttribute;
    position.clearUpdateRanges();elevation.clearUpdateRanges();
    for(const r of rects)for(let y=r.y;y<r.y+r.height;y++){
      position.addUpdateRange((y*v.columns+r.x)*3,r.width*3);
      (elevation.array as Float32Array).set(g.heights.subarray(y*v.columns+r.x,y*v.columns+r.x+r.width),y*v.columns+r.x);
      elevation.addUpdateRange(y*v.columns+r.x,r.width);
    }
    if(rects.length){position.needsUpdate=true;elevation.needsUpdate=true;}
  }
  if(!topology||!domain){
    const uv=geometry.getAttribute('uv') as THREE.BufferAttribute,values=uv.array as Float32Array;
    for(let y=0;y<v.rows;y++)for(let x=0;x<v.columns;x++){
      const at=(y*v.columns+x)*2;values[at]=(l.x.values[x]!-b.x)/b.width;values[at+1]=(l.y.values[y]!-b.y)/b.height;
    }
    uv.clearUpdateRanges();uv.needsUpdate=true;
  }
  if(rects.length)geometry.computeBoundingSphere();
  if(!mesh){
    const material=new THREE.MeshBasicMaterial({map:terrainTexture(data),side:THREE.FrontSide});terrainContourMaterial(material,contours);
    mesh=new THREE.Mesh(geometry,material);
  }else{
    if(!topology){mesh.geometry.dispose();mesh.geometry=geometry;}
    if(texture?.image.width===data.width&&texture?.image.height===data.height){
      texture.image.data=data.pixels;uploadTerrainTexture(texture,topology&&domain?partial?.pixels:undefined,renderer);
    }else{
      // Both maps share format and colour space: dimensions do not alter the
      // shader. Detail/brush fallbacks rebind to this map in the same batch.
      texture?.dispose();mesh.material.map=terrainTexture(data);
    }
  }
  contours.terrainContourSea.value=g.seaLevelM;contours.terrainContourInk.value.set(data.contourInk??'#685639');
  return {mesh,rects};
}

import * as THREE from 'three';
import type {Point} from './contracts';
import type {TerrainGrid} from './terrain-spatial-model';
import type {SpatialReply} from './terrain-spatial-worker';
import type {TerrainRect} from './terrain-frame';
import {terrainContourMaterial,terrainContourUniforms} from './terrain-contours';
import {terrainGridLayout} from './terrain-grid-layout';
import {uploadTerrainTexture} from './terrain-texture-upload';

type Mesh=THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
/** Retain compatible GPU buffers; apply only source-confirmed changed rectangles. */
export function updateTerrainMesh(mesh:Mesh|null,data:SpatialReply,previous:TerrainGrid|null,oldOrigin:Point,origin:Point,
  partial:SpatialReply['update'],contours:ReturnType<typeof terrainContourUniforms>,renderer?:THREE.WebGLRenderer){
  const g=data.grid,v=g.view,b=v.box,l=terrainGridLayout(v),texture=mesh?.material.map as THREE.DataTexture|undefined;
  const compatible=!!mesh&&!!previous&&previous.view.columns===v.columns&&previous.view.rows===v.rows&&
    JSON.stringify([previous.view.box,previous.view.refinement])===JSON.stringify([b,v.refinement])&&texture?.image.width===data.width&&texture?.image.height===data.height;
  const moved=!previous||JSON.stringify([oldOrigin,previous.view.focusM,previous.view.exaggeration])!==JSON.stringify([origin,v.focusM,v.exaggeration]);
  const rects:TerrainRect[]=compatible&&!moved&&partial?partial.heights:[{x:0,y:0,width:v.columns,height:v.rows}];
  const positions=compatible?mesh!.geometry.getAttribute('position').array as Float32Array:new Float32Array(v.columns*v.rows*3);
  for(const r of rects)for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++){
    const i=y*v.columns+x;positions.set([l.x.values[x]!-origin.x,origin.y-l.y.values[y]!, (g.heights[i]!-v.focusM)*v.exaggeration],i*3);
  }
  if(compatible){
    const geometry=mesh!.geometry,position=geometry.getAttribute('position') as THREE.BufferAttribute;
    const elevation=geometry.getAttribute('terrainElevation') as THREE.BufferAttribute;
    position.clearUpdateRanges();elevation.clearUpdateRanges();
    for(const r of rects)for(let y=r.y;y<r.y+r.height;y++){
      position.addUpdateRange((y*v.columns+r.x)*3,r.width*3);
      (elevation.array as Float32Array).set(g.heights.subarray(y*v.columns+r.x,y*v.columns+r.x+r.width),y*v.columns+r.x);
      elevation.addUpdateRange(y*v.columns+r.x,r.width);
    }
    if(rects.length){position.needsUpdate=true;elevation.needsUpdate=true;geometry.computeBoundingSphere();}
    texture!.image.data=data.pixels;uploadTerrainTexture(texture!,partial?.pixels,renderer);
  }else{
    const uv=new Float32Array(v.columns*v.rows*2),indices:number[]=[];
    for(let y=0;y<v.rows;y++)for(let x=0;x<v.columns;x++){
      const i=y*v.columns+x;uv.set([(l.x.values[x]!-b.x)/b.width,(l.y.values[y]!-b.y)/b.height],i*2);
      if(x<v.columns-1&&y<v.rows-1)indices.push(i,i+v.columns,i+1,i+1,i+v.columns,i+v.columns+1);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setAttribute('terrainElevation',new THREE.BufferAttribute(g.heights.slice(),1));
    geometry.setIndex(indices);geometry.computeBoundingSphere();
    const map=new THREE.DataTexture(data.pixels,data.width,data.height,THREE.RGBAFormat);map.colorSpace=THREE.SRGBColorSpace;
    map.minFilter=THREE.LinearFilter;map.magFilter=THREE.LinearFilter;map.needsUpdate=true;
    const material=new THREE.MeshBasicMaterial({map,side:THREE.FrontSide});terrainContourMaterial(material,contours);
    mesh=new THREE.Mesh(geometry,material);
  }
  contours.terrainContourSea.value=g.seaLevelM;contours.terrainContourInk.value.set(data.contourInk??'#685639');
  return {mesh:mesh!,rects};
}

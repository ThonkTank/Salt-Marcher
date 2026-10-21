import * as THREE from 'three';
import type {TerrainGrid} from './terrain-spatial-model';
import {DEFAULT_TERRAIN_STYLE} from './terrain-relief';
import {terrainColors} from './world-model';

/** Correct provisional coasts on the existing material, before contour ink.
 * Vertex heights come from the bounded display grid; fine pigments remain in
 * place on existing land. Committed raster shading replaces this approximation. */
export class TerrainDraftMaterial {
  private uniforms={terrainDraftEnabled:{value:false},terrainDraftLand:{value:new THREE.Color(DEFAULT_TERRAIN_STYLE.land)},terrainDraftWater:{value:new THREE.Color(terrainColors.water)}};
  attach(mesh:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>,grid:TerrainGrid,land?:string){
    this.uniforms.terrainDraftEnabled.value=false;this.uniforms.terrainDraftLand.value.set(land??DEFAULT_TERRAIN_STYLE.land);
    const values=new Float32Array(grid.heights.length*3);
    if(grid.editing)for(let i=0;i<grid.heights.length;i++)values.set([grid.editing.ground[i]!,grid.editing.ground[i]!,grid.editing.water[i]!],i*3);
    mesh.geometry.setAttribute('terrainDraftHeights',new THREE.BufferAttribute(values,3));
    const material=mesh.material;if(material.userData.terrainDraft)return;
    material.userData.terrainDraft=true;
    const prior=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material),uniforms=this.uniforms;
    material.onBeforeCompile=(shader,renderer)=>{
      prior.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms);
      shader.vertexShader='attribute vec3 terrainDraftHeights; varying vec3 draftHeights;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ndraftHeights=terrainDraftHeights;');
      shader.fragmentShader='uniform bool terrainDraftEnabled; uniform vec3 terrainDraftLand; uniform vec3 terrainDraftWater; varying vec3 draftHeights;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        if(terrainDraftEnabled){
          float before=draftHeights.x-draftHeights.z,after=draftHeights.y-draftHeights.z;
          float edge=max(fwidth(after),0.0001);
          float land=smoothstep(-edge,edge,after);
          float oldLand=smoothstep(-edge,edge,before);
          float changed=smoothstep(0.0,0.01,abs(after-before));
          vec3 ground=mix(terrainDraftLand,diffuseColor.rgb,oldLand);
          // Keep the already authored pigment; show relief changes immediately.
          float relief=clamp((dFdx(after)-dFdx(before)-dFdy(after)+dFdy(before))*0.003,-0.2,0.2);
          ground*=1.0+relief;
          vec3 color=mix(terrainDraftWater,ground,land);
          diffuseColor.rgb=mix(diffuseColor.rgb,color,changed);
        }
      `);
    };
    material.customProgramCacheKey=()=>key()+'+terrain-draft-v1';material.needsUpdate=true;
  }
  update(mesh:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>,grid:TerrainGrid,ground:Float32Array,rect:{x:number;y:number;width:number;height:number}){
    const position=mesh.geometry.getAttribute('position') as THREE.BufferAttribute,elevation=mesh.geometry.getAttribute('terrainElevation') as THREE.BufferAttribute,draft=mesh.geometry.getAttribute('terrainDraftHeights') as THREE.BufferAttribute;
    const p=position.array as Float32Array,e=elevation.array as Float32Array,d=draft.array as Float32Array,v=grid.view;
    for(let y=rect.y;y<rect.y+rect.height;y++)for(let x=rect.x;x<rect.x+rect.width;x++){const i=y*v.columns+x;p[i*3+2]=(grid.heights[i]!-v.focusM)*v.exaggeration;e[i]=grid.heights[i]!;d[i*3+1]=ground[i]!;}
    for(const a of [position,elevation,draft]){a.clearUpdateRanges();for(let y=rect.y;y<rect.y+rect.height;y++)a.addUpdateRange((y*v.columns+rect.x)*a.itemSize,rect.width*a.itemSize);a.needsUpdate=true;}
    // XY never changes during a gesture. Retain a conservative bound instead
    // of scanning all mesh vertices twice in Three's computeBoundingSphere.
    const sphere=mesh.geometry.boundingSphere!;
    for(let y=rect.y;y<rect.y+rect.height;y++)for(let x=rect.x;x<rect.x+rect.width;x++){
      const i=(y*v.columns+x)*3,dx=p[i]!-sphere.center.x,dy=p[i+1]!-sphere.center.y,dz=p[i+2]!-sphere.center.z;
      sphere.radius=Math.max(sphere.radius,Math.sqrt(dx*dx+dy*dy+dz*dz));
    }
    this.uniforms.terrainDraftEnabled.value=true;
  }
}

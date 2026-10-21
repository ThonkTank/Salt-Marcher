import * as THREE from 'three';
import {vegetationCrownScale,vegetationOpacity} from './vegetation-lod';

export interface VegetationDisplay {size:number;overviewWidth:number;limit:number}
/** Camera-only changes touch a viewport uniform, never instance matrices. The
 * same anchor depth drives crown width, fading and exact original-ID picking. */
export function vegetationDisplay(mesh:THREE.InstancedMesh,policies:VegetationDisplay[]){
  const viewport={value:new THREE.Vector2(1,1)},material=mesh.material as THREE.MeshLambertMaterial;
  mesh.geometry.setAttribute('plantPolicy',new THREE.InstancedBufferAttribute(Float32Array.from(policies.flatMap(p=>[p.size,p.overviewWidth,p.limit])),3));
  // Keep opaque crowns correctly depth ordered across instances. Fade fragments
  // still write depth; fully hidden instances are discarded before depth write.
  material.transparent=true;material.depthWrite=true;
  material.onBeforeCompile=shader=>{
    shader.uniforms.plantViewport=viewport;
    shader.vertexShader='uniform vec2 plantViewport; attribute vec3 plantPolicy; varying float plantOpacity;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`
      vec4 plantAnchor=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
      float plantMpp=max(.000001,-plantAnchor.z)/(projectionMatrix[1][1]*plantViewport.y*.5);
      float plantScale=max(1.,plantMpp*plantPolicy.y/plantPolicy.x);
      plantOpacity=plantPolicy.z>0. ? 1.-smoothstep(plantPolicy.z*.75,plantPolicy.z,plantMpp) : 1.;
      #include <beginnormal_vertex>
      objectNormal.xy/=plantScale;
    `);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.xy*=plantScale;');
    shader.fragmentShader='varying float plantOpacity;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>',`
      gl_FragColor.a*=plantOpacity;
      if(gl_FragColor.a<.001)discard;
      #include <tonemapping_fragment>
    `);
  };
  material.customProgramCacheKey=()=> 'vegetation-scale-v1';
  mesh.onBeforeRender=renderer=>{renderer.getSize(viewport.value);};
  // Shader-expanded crowns can extend beyond the canonical bounding sphere.
  // These batches already belong to the bounded visible-region read.
  mesh.frustumCulled=false;
  const proxy=new THREE.Mesh(mesh.geometry,material),matrix=new THREE.Matrix4(),anchor=new THREE.Vector3(),scale=new THREE.Vector3();
  mesh.raycast=(ray,hits)=>{
    const camera=ray.camera;if(!camera)return;
    const candidates:THREE.Intersection[]=[];
    for(let index=0;index<policies.length;index++){
      const p=policies[index]!;mesh.getMatrixAt(index,matrix);
      matrix.premultiply(mesh.matrixWorld);
      anchor.setFromMatrixPosition(matrix).applyMatrix4(camera.matrixWorldInverse);
      const mpp=Math.max(.000001,-anchor.z)/(camera.projectionMatrix.elements[5]!*viewport.value.y*.5);
      if(vegetationOpacity(mpp,p.limit)<=.05)continue;
      const width=vegetationCrownScale(p.size,mpp,p.overviewWidth);
      proxy.matrixWorld.copy(matrix).scale(scale.set(width,width,1));
      candidates.length=0;proxy.raycast(ray,candidates);
      for(const hit of candidates){hit.instanceId=index;hit.object=mesh;hits.push(hit);}
    }
  };
}

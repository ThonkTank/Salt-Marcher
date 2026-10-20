import * as THREE from 'three';
import {DEFAULT_TERRAIN_STYLE} from './terrain-relief';

/** Display-only ink on the same triangular surface used for visible brush hits.
 * Derivatives express metres per actual screen pixel, keeping lines sharp as the
 * camera moves. Dense intervals fade before they alias; their heights never move. */
export function terrainContourUniforms(){
  return {terrainContourInterval:{value:0},terrainContourSea:{value:0},terrainContourInk:{value:new THREE.Color(DEFAULT_TERRAIN_STYLE.ink)}};
}
export function terrainContourMaterial(material:THREE.MeshBasicMaterial,uniforms:ReturnType<typeof terrainContourUniforms>){
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='attribute float terrainElevation; varying float terrainContourHeight;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nterrainContourHeight=terrainElevation;');
    shader.fragmentShader=`
      uniform float terrainContourInterval;
      uniform float terrainContourSea;
      uniform vec3 terrainContourInk;
      varying float terrainContourHeight;
      float terrainContour(float interval, float gradient, float halfWidth){
        float level=floor(terrainContourHeight/interval+.5)*interval;
        // Water is a clamped horizontal part of the mesh, not a zero-height
        // contour. Derivative quads straddling its edge must not ink the sea.
        if(level<=terrainContourSea)return 0.0;
        float distanceM=abs(mod(terrainContourHeight+interval*.5,interval)-interval*.5);
        float distancePx=distanceM/max(gradient,0.00001);
        float spacingFade=1.0-smoothstep(interval*.15,interval*.4,gradient);
        return (1.0-smoothstep(max(0.0,halfWidth-.5),halfWidth+.5,distancePx))*spacingFade;
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float terrainGradient=length(vec2(dFdx(terrainContourHeight),dFdy(terrainContourHeight)));
      if(terrainContourInterval>0.0&&terrainGradient>0.00001){
        float minorInk=terrainContour(terrainContourInterval,terrainGradient,.45)*.38;
        float majorInk=terrainContour(terrainContourInterval*5.0,terrainGradient,.75)*.52;
        diffuseColor.rgb=mix(diffuseColor.rgb,terrainContourInk,max(minorInk,majorInk));
      }
    `);
  };
  material.customProgramCacheKey=()=> 'terrain-contours-v1';
}

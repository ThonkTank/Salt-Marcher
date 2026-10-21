import * as THREE from 'three';
import {DEFAULT_TERRAIN_STYLE} from './terrain-relief';
import {CONTOUR_BASE_METRES,CONTOUR_SPACING_PIXELS,CONTOUR_INK} from './terrain-contour-style';

/** Display-only ink on the same triangular surface used for visible brush hits.
 * Derivatives express metres per actual screen pixel, keeping lines sharp as the
 * camera moves. Dense intervals fade before they alias; their heights never move. */
export function terrainContourUniforms(){
  return {terrainContourInterval:{value:0},terrainContourSea:{value:0},terrainContourPixelRatio:{value:1},terrainContourInk:{value:new THREE.Color(DEFAULT_TERRAIN_STYLE.ink)}};
}
export function terrainContourMaterial(material:THREE.MeshBasicMaterial,uniforms:ReturnType<typeof terrainContourUniforms>){
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='attribute float terrainElevation; varying float terrainContourHeight;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nterrainContourHeight=terrainElevation;');
    shader.fragmentShader=`
      uniform float terrainContourInterval;
      uniform float terrainContourSea;
      uniform float terrainContourPixelRatio;
      uniform vec3 terrainContourInk;
      varying float terrainContourHeight;
      float terrainContour(float interval, float gradient, float halfWidth){
        float level=floor(terrainContourHeight/interval+.5)*interval;
        // Water is a clamped horizontal part of the mesh, not a zero-height
        // contour. Derivative quads straddling its edge must not ink the sea.
        if(level<=terrainContourSea)return 0.0;
        float distanceM=abs(mod(terrainContourHeight+interval*.5,interval)-interval*.5);
        float distancePx=distanceM/max(gradient,0.00001);
        float spacingFade=1.0-smoothstep(interval*.15,interval*.4,gradient*terrainContourPixelRatio);
        float width=halfWidth*terrainContourPixelRatio;
        return (1.0-smoothstep(max(0.0,width-.5),width+.5,distancePx))*spacingFade;
      }
      float terrainContourBand(float interval,float gradient){
        return max(terrainContour(interval,gradient,${CONTOUR_INK.minorWidth.toFixed(2)})*${CONTOUR_INK.minorAlpha.toFixed(2)},terrainContour(interval*5.0,gradient,${CONTOUR_INK.majorWidth.toFixed(2)})*${CONTOUR_INK.majorAlpha.toFixed(2)});
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float terrainGradient=length(vec2(dFdx(terrainContourHeight),dFdy(terrainContourHeight)));
      if(terrainContourInterval!=0.0&&terrainGradient>0.00001){
        float interval=terrainContourInterval;
        float blend=0.0;
        if(interval<0.0){
          float level=max(0.0,log2(terrainGradient*terrainContourPixelRatio*${CONTOUR_SPACING_PIXELS.toFixed(1)}/${CONTOUR_BASE_METRES.toFixed(1)}));
          interval=${CONTOUR_BASE_METRES.toFixed(1)}*exp2(floor(level));
          blend=smoothstep(0.0,1.0,fract(level));
        }
        float ink=terrainContourBand(interval,terrainGradient);
        if(terrainContourInterval<0.0)ink=mix(ink,terrainContourBand(interval*2.0,terrainGradient),blend);
        diffuseColor.rgb=mix(diffuseColor.rgb,terrainContourInk,ink);
      }
    `);
  };
  material.customProgramCacheKey=()=> 'terrain-contours-v3';
}

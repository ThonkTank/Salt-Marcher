import * as THREE from 'three';
import type {AtlasCanvasScene} from './atlas-canvas-scene';
import type {Point} from './contracts';
import type {AtlasPaint} from './atlas-paint';

/** Display-only travelling hex grid. Canvas keeps its existing vector paths;
 * the main camera and perspective export share one procedural surface overlay. */
export class TerrainHexGrid {
  private base:{size:number;alpha:number}[]=[];
  private overlay:{size:number;alpha:number}[]=[];
  private uniforms={terrainHexA:{value:new THREE.Vector4()},terrainHexB:{value:new THREE.Vector4()},terrainHexRatio:{value:1},terrainHexColor:{value:new THREE.Color('#365644')}};
  set(scene:AtlasCanvasScene,overlay=false){
    const levels=new Map<number,number>();
    const visit=(node:AtlasPaint,alpha:number)=>{
      if(node.geometry.hidden)return;alpha*=node.geometry.opacity??1;
      if(node.mapGrid)levels.set(node.mapGrid.size,alpha);
      for(const child of node.children)visit(child,alpha);
    };
    visit(scene.root,1);
    const next=[...levels].map(([size,alpha])=>({size,alpha}));
    if(overlay)this.overlay=next;else this.base=next;
  }
  update(origin:Point,ratio:number){
    const levels=[...this.base,...this.overlay];
    for(const [i,u]of [this.uniforms.terrainHexA,this.uniforms.terrainHexB].entries()){
      const level=levels[i];if(!level){u.value.set(0,0,1,0);continue;}
      // Reduce in double precision before the GPU: distant village coordinates
      // must keep the same world-anchored grid as world-scale coordinates.
      const x=origin.x/level.size,y=origin.y/level.size;
      u.value.set(((x%1)+1)%1,((y%Math.sqrt(3))+Math.sqrt(3))%Math.sqrt(3),level.size,level.alpha);
    }
    this.uniforms.terrainHexRatio.value=ratio;
  }
  attach(material:THREE.MeshBasicMaterial){
    if(material.userData.terrainHexGrid===this)return;
    material.userData.terrainHexGrid=this;
    const prior=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material),uniforms=this.uniforms;
    material.onBeforeCompile=(shader,renderer)=>{
      prior.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms);
      shader.vertexShader='varying vec2 terrainHexPosition;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nterrainHexPosition=vec2(position.x,-position.y);');
      shader.fragmentShader=`
        varying vec2 terrainHexPosition;
        uniform vec4 terrainHexA; uniform vec4 terrainHexB;
        uniform float terrainHexRatio; uniform vec3 terrainHexColor;
        float terrainHexInk(vec4 grid){
          if(grid.w<=0.0)return 0.0;
          vec2 p=terrainHexPosition/grid.z+grid.xy;
          vec2 period=vec2(1.0,1.7320508075688772);
          vec2 a=mod(p+period*.5,period)-period*.5;
          vec2 b=mod(p,period)-period*.5;
          vec2 q=abs(dot(a,a)<dot(b,b)?a:b);
          float edge=.5-max(q.x,dot(q,vec2(.5,.8660254037844386)));
          float pixel=length(vec2(dFdx(p.x),dFdy(p.x)));
          float pixelY=length(vec2(dFdx(p.y),dFdy(p.y)));
          float distancePx=edge/max(max(pixel,pixelY),1e-12);
          float ink=(1.0-smoothstep(max(0.0,.35*terrainHexRatio-.5),.35*terrainHexRatio+.5,distancePx))*grid.w*(68.0/255.0);
          return 1.0-(1.0-ink)*(1.0-ink);
        }
      `+shader.fragmentShader;
      // Apply after ground colour/contours and before final output conversion.
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`outgoingLight=mix(outgoingLight,terrainHexColor,1.0-(1.0-terrainHexInk(terrainHexA))*(1.0-terrainHexInk(terrainHexB)));\n#include <opaque_fragment>`);
    };
    material.customProgramCacheKey=()=>key()+'+terrain-hex-v1';material.needsUpdate=true;
  }
}

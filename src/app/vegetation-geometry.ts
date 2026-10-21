import * as THREE from 'three';
import type {PlantAsset} from './vegetation';
import {crownRadius} from './vegetation-shape';

// Metres are supplied by each instance's existing size. These profiles provide
// one bounded mesh per species, shared by every tree in the visible batch.
const oak:[number,number][]=[[.28,0],[.42,.31],[.7,.36],[.9,.24],[1,0]];
const pine:[number,number][]=[[.18,0],[.22,.32],[.47,.17],[.45,.24],[.72,.08],[.7,.14],[1,0]];

function crown(asset:'oak'|'pine'){
  const rings=asset==='oak'?oak:pine,segments=asset==='oak'?16:12,positions:number[]=[],colors:number[]=[],indices:number[]=[];
  for(let ring=0;ring<rings.length;ring++){
    const [z,radius]=rings[ring]!;
    for(let j=0;j<segments;j++){
      const angle=j/segments*Math.PI*2,r=radius*crownRadius(asset,angle);
      // Lobes continue over the dome, instead of ending at a circular rim.
      const height=z+(asset==='oak'&&radius>0?.025*Math.sin(angle*5+.4)*radius/.36:0);
      positions.push(Math.cos(angle)*r,Math.sin(angle)*r,height);
      const tint=.78+.22*z+.035*Math.sin(angle*3+ring*.6);
      colors.push(tint,tint,tint);
      if(ring){const a=(ring-1)*segments+j,b=(ring-1)*segments+(j+1)%segments,c=ring*segments+j,d=ring*segments+(j+1)%segments;indices.push(a,b,c,b,d,c);}
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export function vegetationGeometry(asset:PlantAsset,part:'crown'|'trunk'){
  let g:THREE.BufferGeometry;
  if(part==='trunk'){g=new THREE.CylinderGeometry(.035,.055,.5,5);g.rotateX(Math.PI/2);g.translate(0,0,.25);}
  else if(asset==='oak'||asset==='pine')return crown(asset);
  else if(asset==='rock'){g=new THREE.DodecahedronGeometry(.55,0);g.scale(1,.8,.65);g.translate(0,0,.14);}
  else{g=new THREE.IcosahedronGeometry(.5,0);g.scale(1,1,asset==='grass'?.25:.7);g.translate(0,0,.25);}
  return g;
}

/** Ink follows the actual silhouette in every camera pose. No second outline
 * mesh, camera rebuild or additional draw call is needed. Install after LOD. */
export function crownInk(material:THREE.MeshLambertMaterial){
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
    compile.call(material,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>',`
      float facing=abs(dot(normal,normalize(vViewPosition)));
      float crownEdge=1.-smoothstep(.12,.12+max(fwidth(facing),.05),facing);
      gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.025,.05,.035),crownEdge*.7);
      #include <tonemapping_fragment>
    `);
  };
  material.customProgramCacheKey=()=>key+'-crown-ink-v1';
}

import * as THREE from 'three';
import type {SpatialReply} from './terrain-spatial-worker';

/** Viewport or local brush detail composes with the main material and GPU contours. */
export class TerrainDetailMaterial {
  private coverageTexture:THREE.DataTexture|null=null;
  private detailTexture:THREE.DataTexture|null=null;
  update(material:THREE.MeshBasicMaterial,data:Pick<SpatialReply,'grid'|'detail'>,rects:import('./terrain-frame').TerrainRect[]|undefined){
    let uniforms=material.userData.terrainDetail as {detailMap:{value:THREE.Texture};detailBox:{value:THREE.Vector4};detailEnabled:{value:boolean};coverageMap:{value:THREE.Texture};coverageEnabled:{value:boolean}}|undefined;
    if(!uniforms){
      uniforms={detailMap:{value:material.map!},detailBox:{value:new THREE.Vector4()},detailEnabled:{value:false},coverageMap:{value:material.map!},coverageEnabled:{value:false}};
      material.userData.terrainDetail=uniforms;
      const prior=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
      material.onBeforeCompile=(shader,renderer)=>{
        prior.call(material,shader,renderer);
        Object.assign(shader.uniforms,uniforms);
        shader.fragmentShader='uniform sampler2D detailMap; uniform vec4 detailBox; uniform bool detailEnabled; uniform sampler2D coverageMap; uniform bool coverageEnabled;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
          #ifdef USE_MAP
            vec4 terrainColor=texture2D(map,vMapUv);
            if(detailEnabled){
              vec2 fineUV=(vMapUv-detailBox.xy)/detailBox.zw;
              if(all(greaterThanEqual(fineUV,vec2(0.0)))&&all(lessThanEqual(fineUV,vec2(1.0)))){
                float edge=min(min(fineUV.x,fineUV.y),min(1.0-fineUV.x,1.0-fineUV.y));
                vec4 fine=texture2D(detailMap,fineUV);
                // Pending tiles are transparent. Normalise the filtered edge to
                // avoid a dark fringe against an as-yet-unloaded neighbour.
                vec3 color=fine.rgb/max(fine.a,0.00001);
                float coverage=coverageEnabled?smoothstep(0.5,1.0,texture2D(coverageMap,fineUV).r):1.0;
                terrainColor.rgb=mix(terrainColor.rgb,color,smoothstep(0.0,0.08,edge)*fine.a*coverage);
              }
            }
            diffuseColor*=terrainColor;
          #endif`);
      };
      material.customProgramCacheKey=()=>key()+'+terrain-detail-v3';material.needsUpdate=true;
    }
    const detail=data.detail,coverage=detail?.coverage;
    if(coverage){
      if(!this.coverageTexture||this.coverageTexture.image.width!==coverage.columns||this.coverageTexture.image.height!==coverage.rows){
        this.coverageTexture?.dispose();this.coverageTexture=new THREE.DataTexture(coverage.values,coverage.columns,coverage.rows,THREE.RedFormat);
        this.coverageTexture.minFilter=THREE.LinearFilter;this.coverageTexture.magFilter=THREE.LinearFilter;
      }
      this.coverageTexture.image.data=coverage.values;this.coverageTexture.needsUpdate=true;
      uniforms.coverageMap.value=this.coverageTexture;uniforms.coverageEnabled.value=coverage.values.some(value=>value!==255);
    }else{this.coverageTexture?.dispose();this.coverageTexture=null;uniforms.coverageEnabled.value=false;uniforms.coverageMap.value=material.map!;}

    if(!detail){this.detailTexture?.dispose();this.detailTexture=null;uniforms.detailEnabled.value=false;uniforms.detailMap.value=material.map!;return;}
    const compatible=this.detailTexture?.image.width===detail.width&&this.detailTexture?.image.height===detail.height;
    if(!compatible){
      this.detailTexture?.dispose();this.detailTexture=new THREE.DataTexture(detail.pixels,detail.width,detail.height,THREE.RGBAFormat);
      this.detailTexture.colorSpace=THREE.SRGBColorSpace;this.detailTexture.minFilter=THREE.LinearFilter;this.detailTexture.magFilter=THREE.LinearFilter;
    }
    const texture=this.detailTexture!;texture.image.data=detail.pixels;texture.clearUpdateRanges();
    const changed=compatible&&rects?rects:[{x:0,y:0,width:detail.width,height:detail.height}];
    for(const r of changed)for(let y=r.y;y<r.y+r.height;y++)texture.addUpdateRange((y*detail.width+r.x)*4,r.width*4);
    if(changed.length)texture.needsUpdate=true;
    const b=data.grid.view.box,d=detail.box;uniforms.detailMap.value=texture;uniforms.detailBox.value.set((d.x-b.x)/b.width,(d.y-b.y)/b.height,d.width/b.width,d.height/b.height);uniforms.detailEnabled.value=true;
  }
  dispose(){this.detailTexture?.dispose();this.detailTexture=null;this.coverageTexture?.dispose();this.coverageTexture=null;}
}

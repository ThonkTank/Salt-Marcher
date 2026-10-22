import {TerrainColorSurface} from './terrain-color-surface';
import type {TerrainColorFrame} from './terrain-color-frame';
import * as THREE from 'three';
import type {SpatialReply} from './terrain-spatial-worker';
import {TerrainForestPattern} from './terrain-forest-pattern';
import {uploadTerrainTexture} from './terrain-texture-upload';

/** Viewport or local brush detail composes with the main material and GPU contours. */
export class TerrainDetailMaterial {
  private forestPattern=new TerrainForestPattern();
  private emptyForest=new THREE.DataTexture(new Uint8Array(1),1,1,THREE.RedFormat);
  private forestTextures=new Map<'base'|'detail'|'brush',THREE.DataTexture>();
  private forestUniforms:Record<'forestMap'|'detailForestMap'|'brushForestMap',{value:THREE.Texture}>={forestMap:{value:this.emptyForest},detailForestMap:{value:this.emptyForest},brushForestMap:{value:this.emptyForest}};
  private forestTexture(kind:'base'|'detail'|'brush',data:{width:number;height:number;forest?:Uint8Array}|undefined,rects?:import('./terrain-frame').TerrainRect[]){
    const old=this.forestTextures.get(kind);
    if(!data?.forest){old?.dispose();this.forestTextures.delete(kind);return this.emptyForest;}
    if(data.forest.length!==data.width*data.height)throw Error('Waldabdeckung passt nicht zur Geländeansicht.');
    const compatible=old?.image.width===data.width&&old?.image.height===data.height;
    const texture=compatible?old!:new THREE.DataTexture(data.forest,data.width,data.height,THREE.RedFormat);
    if(!compatible){old?.dispose();texture.minFilter=texture.magFilter=THREE.LinearFilter;this.forestTextures.set(kind,texture);}
    texture.image.data=data.forest;uploadTerrainTexture(texture,compatible?rects:undefined,this.renderer,1);return texture;
  }
  updateView(origin:{x:number;y:number},mpp:number){this.forestPattern.update(origin,mpp);}
  private coverageTexture:THREE.DataTexture|null=null;
  private detailTexture:THREE.DataTexture|null=null;
  private brushTexture:THREE.DataTexture|null=null;
  private colorSurface:TerrainColorSurface|undefined;
  prepareColorFrames(){
    if(!this.renderer)throw Error('Geländekacheln benötigen den GPU-Renderer.');
    this.colorSurface??=new TerrainColorSurface(this.renderer);return this.colorSurface.ready;
  }
  constructor(private readonly renderer?:THREE.WebGLRenderer){this.emptyForest.needsUpdate=true;}
  update(material:THREE.MeshBasicMaterial,data:Pick<SpatialReply,'grid'|'detail'|'brushDetail'>&Partial<Pick<SpatialReply,'width'|'height'|'forest'>>,rects:import('./terrain-frame').TerrainRect[]|undefined,forestRects?:{base?:import('./terrain-frame').TerrainRect[];detail?:import('./terrain-frame').TerrainRect[]},frame?:TerrainColorFrame){
    let uniforms=material.userData.terrainDetail as {detailMap:{value:THREE.Texture};detailBox:{value:THREE.Vector4};detailEnabled:{value:boolean};coverageMap:{value:THREE.Texture};coverageEnabled:{value:boolean};brushMap:{value:THREE.Texture};brushBox:{value:THREE.Vector4};brushEnabled:{value:boolean}}|undefined;
    if(!uniforms){
      uniforms={detailMap:{value:material.map!},detailBox:{value:new THREE.Vector4()},detailEnabled:{value:false},coverageMap:{value:material.map!},coverageEnabled:{value:false},brushMap:{value:material.map!},brushBox:{value:new THREE.Vector4()},brushEnabled:{value:false}};
      material.userData.terrainDetail=uniforms;
      const prior=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
      material.onBeforeCompile=(shader,renderer)=>{
        prior.call(material,shader,renderer);
        Object.assign(shader.uniforms,uniforms,this.forestUniforms);this.forestPattern.compile(shader);
        shader.fragmentShader='uniform sampler2D forestMap; uniform sampler2D detailForestMap; uniform sampler2D brushForestMap; uniform sampler2D detailMap; uniform vec4 detailBox; uniform bool detailEnabled; uniform sampler2D coverageMap; uniform bool coverageEnabled; uniform sampler2D brushMap; uniform vec4 brushBox; uniform bool brushEnabled;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
          #ifdef USE_MAP
            vec4 terrainColor=texture2D(map,vMapUv);
            float forestCoverage=forestOpacity>0.0?texture2D(forestMap,vMapUv).r:0.0;
            if(brushEnabled){
              vec2 brushUV=(vMapUv-brushBox.xy)/brushBox.zw;
              if(all(greaterThanEqual(brushUV,vec2(0.0)))&&all(lessThanEqual(brushUV,vec2(1.0)))){
                float edge=min(min(brushUV.x,brushUV.y),min(1.0-brushUV.x,1.0-brushUV.y));
                vec4 brush=texture2D(brushMap,brushUV);
                float blend=smoothstep(0.0,0.04,edge)*brush.a;
                terrainColor.rgb=mix(terrainColor.rgb,brush.rgb/max(brush.a,0.00001),blend);
                if(forestOpacity>0.0)forestCoverage=mix(forestCoverage,texture2D(brushForestMap,brushUV).r/max(brush.a,0.00001),blend);
              }
            }
            if(detailEnabled){
              vec2 fineUV=(vMapUv-detailBox.xy)/detailBox.zw;
              if(all(greaterThanEqual(fineUV,vec2(0.0)))&&all(lessThanEqual(fineUV,vec2(1.0)))){
                float edge=min(min(fineUV.x,fineUV.y),min(1.0-fineUV.x,1.0-fineUV.y));
                vec4 fine=texture2D(detailMap,fineUV);
                // Pending tiles are transparent. Normalise the filtered edge to
                // avoid a dark fringe against an as-yet-unloaded neighbour.
                vec3 color=fine.rgb/max(fine.a,0.00001);
                float coverage=coverageEnabled?smoothstep(0.5,1.0,texture2D(coverageMap,fineUV).r):1.0;
                float blend=smoothstep(0.0,0.08,edge)*fine.a*coverage;
                terrainColor.rgb=mix(terrainColor.rgb,color,blend);
                if(forestOpacity>0.0)forestCoverage=mix(forestCoverage,texture2D(detailForestMap,fineUV).r/max(fine.a,0.00001),blend);
              }
            }
            // Before the draft water correction and contour ink.
            terrainColor.rgb*=terrainForestTone(clamp(forestCoverage,0.0,1.0));
            diffuseColor*=terrainColor;
          #endif`);
      };
      material.customProgramCacheKey=()=>key()+'+terrain-detail-v5-forest';material.needsUpdate=true;
    }
    // Detail-only uploads retain the current base mask and source identity.
    if(data.width!==undefined&&data.height!==undefined)this.forestUniforms.forestMap.value=this.forestTexture('base',{width:data.width,height:data.height,forest:data.forest},forestRects?.base);
    this.forestUniforms.detailForestMap.value=this.forestTexture('detail',frame?undefined:data.detail,forestRects?forestRects.detail:rects);
    this.forestUniforms.brushForestMap.value=this.forestTexture('brush',data.brushDetail);
    // Let the GPU magnify the small confirmed patch. Upsampling it into a
    // multi-megapixel retained image on the UI thread stalls camera input.
    const brush=data.brushDetail;
    if(brush){
      if(!this.brushTexture||this.brushTexture.image.width!==brush.width||this.brushTexture.image.height!==brush.height){
        this.brushTexture?.dispose();this.brushTexture=new THREE.DataTexture(brush.pixels,brush.width,brush.height,THREE.RGBAFormat);
        this.brushTexture.colorSpace=THREE.SRGBColorSpace;this.brushTexture.minFilter=THREE.LinearFilter;this.brushTexture.magFilter=THREE.LinearFilter;
      }
      this.brushTexture.image.data=brush.pixels;this.brushTexture.needsUpdate=true;
      const b=data.grid.view.box,d=brush.box;uniforms.brushMap.value=this.brushTexture;uniforms.brushBox.value.set((d.x-b.x)/b.width,(d.y-b.y)/b.height,d.width/b.width,d.height/b.height);
    }else{this.brushTexture?.dispose();this.brushTexture=null;uniforms.brushMap.value=material.map!;}
    uniforms.brushEnabled.value=!!brush;
    const detail=data.detail,coverage=frame?.coverage??detail?.coverage;
    if(coverage){
      if(!this.coverageTexture||this.coverageTexture.image.width!==coverage.columns||this.coverageTexture.image.height!==coverage.rows){
        this.coverageTexture?.dispose();this.coverageTexture=new THREE.DataTexture(coverage.values,coverage.columns,coverage.rows,THREE.RedFormat);
        this.coverageTexture.minFilter=THREE.LinearFilter;this.coverageTexture.magFilter=THREE.LinearFilter;
      }
      this.coverageTexture.image.data=coverage.values;this.coverageTexture.needsUpdate=true;
      uniforms.coverageMap.value=this.coverageTexture;uniforms.coverageEnabled.value=coverage.values.some(value=>value!==255);
    }else{this.coverageTexture?.dispose();this.coverageTexture=null;uniforms.coverageEnabled.value=false;uniforms.coverageMap.value=material.map!;}

    if(frame){
      if(!this.colorSurface)throw Error('Geländekacheln wurden nicht vorbereitet.');
      const textures=this.colorSurface.update(frame),b=data.grid.view.box,d=frame.box;
      this.detailTexture?.dispose();this.detailTexture=null;
      uniforms.detailMap.value=textures.color;this.forestUniforms.detailForestMap.value=textures.forest;
      uniforms.detailBox.value.set((d.x-b.x)/b.width,(d.y-b.y)/b.height,d.width/b.width,d.height/b.height);uniforms.detailEnabled.value=true;return;
    }
    if(!detail){this.detailTexture?.dispose();this.detailTexture=null;uniforms.detailEnabled.value=false;uniforms.detailMap.value=material.map!;return;}
    const compatible=this.detailTexture?.image.width===detail.width&&this.detailTexture?.image.height===detail.height;
    if(!compatible){
      this.detailTexture?.dispose();this.detailTexture=new THREE.DataTexture(detail.pixels,detail.width,detail.height,THREE.RGBAFormat);
      this.detailTexture.colorSpace=THREE.SRGBColorSpace;this.detailTexture.minFilter=THREE.LinearFilter;this.detailTexture.magFilter=THREE.LinearFilter;
    }
    const texture=this.detailTexture!;texture.image.data=detail.pixels;
    uploadTerrainTexture(texture,compatible?rects:undefined,this.renderer);
    const b=data.grid.view.box,d=detail.box;uniforms.detailMap.value=texture;uniforms.detailBox.value.set((d.x-b.x)/b.width,(d.y-b.y)/b.height,d.width/b.width,d.height/b.height);uniforms.detailEnabled.value=true;
  }
  dispose(){this.colorSurface?.dispose();this.colorSurface=undefined;this.forestPattern.dispose();this.emptyForest.dispose();for(const texture of this.forestTextures.values())texture.dispose();this.forestTextures.clear();this.detailTexture?.dispose();this.detailTexture=null;this.coverageTexture?.dispose();this.coverageTexture=null;this.brushTexture?.dispose();this.brushTexture=null;}
}

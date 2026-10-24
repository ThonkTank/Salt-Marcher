import {SimpleMeshLayer,type SimpleMeshLayerProps} from '@deck.gl/mesh-layers';
import {FOREST_DETAIL_MPP,FOREST_SURFACE_MPP} from './atlas-cartographic-style';

const block=`layout(std140) uniform atlasVegetationUniforms {
 float metresPerClip;
 float exaggeration;
 float crowns;
} atlasVegetation;`;
const module={name:'atlasVegetation',vs:block,fs:block,uniformTypes:{metresPerClip:'f32',exaggeration:'f32',crowns:'f32'}} as const;
type Props<T>={getDisplayLimit:(value:T)=>number;getPhysicalSize:(value:T)=>number;metresPerClip:number;exaggeration:number;crowns:boolean};

/** Stable instance buffers; camera scale and height exaggeration are uniforms.
 * Clip distance supplies the local pixel scale, including cropped exports. */
export class AtlasVegetationLayer<T> extends SimpleMeshLayer<T,Props<T>> {
 static layerName='AtlasVegetationLayer';
 static defaultProps={...SimpleMeshLayer.defaultProps,getDisplayLimit:{type:'accessor',value:0},getPhysicalSize:{type:'accessor',value:1},metresPerClip:1,exaggeration:1,crowns:false};
 initializeState(){
  super.initializeState();
  this.getAttributeManager()!.addInstanced({instanceDisplayLimit:{size:1,accessor:'getDisplayLimit'},instancePhysicalSize:{size:1,accessor:'getPhysicalSize'}});
 }
 getShaders(){
  const shaders=super.getShaders();
  return {...shaders,modules:[...shaders.modules,module],inject:{...shaders.inject,
   'vs:#decl':'in float instanceDisplayLimit; in float instancePhysicalSize; out float atlasPlantAlpha;',
   'vs:DECKGL_FILTER_SIZE':`
    vec4 anchor=project.viewProjectionMatrix*vec4(geometry.worldPosition,1.0);
    float mpp=max(0.0,anchor.w*atlasVegetation.metresPerClip);
    float limit=instanceDisplayLimit;
    atlasPlantAlpha=limit<=0.0?1.0:(1.0-smoothstep(limit*0.75,limit,mpp))*(1.0-smoothstep(${FOREST_DETAIL_MPP.toFixed(1)},${FOREST_SURFACE_MPP.toFixed(1)},mpp));
    float plantSize=instancePhysicalSize;
    float crown=atlasVegetation.crowns>0.5&&limit>0.0?mix(1.0,clamp(mpp*4.0/max(plantSize,0.01),1.0,2.0),smoothstep(${FOREST_DETAIL_MPP.toFixed(1)},${FOREST_SURFACE_MPP.toFixed(1)},mpp)):1.0;
    size.xy*=crown;
    size.z*=atlasVegetation.exaggeration;
   `,
   'fs:#decl':'in float atlasPlantAlpha;',
   'fs:DECKGL_FILTER_COLOR':'if(atlasPlantAlpha<0.001)discard; color.a*=atlasPlantAlpha;'
  }};
 }
 draw(options:Parameters<SimpleMeshLayer['draw']>[0]){
  this.state.model?.shaderInputs.setProps({atlasVegetation:{metresPerClip:this.props.metresPerClip,exaggeration:this.props.exaggeration,crowns:this.props.crowns?1:0}});
  super.draw(options);
 }
}
export type AtlasVegetationLayerProps<T>=SimpleMeshLayerProps<T>&Props<T>;

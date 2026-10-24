import {SimpleMeshLayer,type SimpleMeshLayerProps} from '@deck.gl/mesh-layers';
import type {UpdateParameters,LayerContext} from '@deck.gl/core';
import type {Texture} from '@luma.gl/core';
import {reliefRgb,type TerrainStyle} from './terrain-relief';
import {CONTOUR_INK} from './terrain-contour-style';

type MaterialProps={
  terrainStyle:Readonly<TerrainStyle>;
  heightOrigin:number;
  contours:number;automaticStep:number;seaLevelM:number;pixelRatio:number;
  masks:{data:Uint8Array;width:number;height:number};
  baseColor:{data:Uint8Array;width:number;height:number};
};
const block=`layout(std140) uniform atlasMaterialUniforms {
  float heightOrigin;
  float snowline;
  float mountains;
  float strength;
  float lightRadians;
  float contours;
  float automaticStep;
  float seaLevel;
  float pixelRatio;
  float heightMode;
  vec3 ink;
} atlasMaterial;`;
const materialModule={name:'atlasMaterial',vs:block,fs:block,
  uniformTypes:{heightOrigin:'f32',snowline:'f32',mountains:'f32',strength:'f32',lightRadians:'f32',contours:'f32',automaticStep:'f32',seaLevel:'f32',pixelRatio:'f32',heightMode:'f32',ink:'vec3<f32>'}} as const;

/** Material effects are display work. Updating the light or snowline changes
 * uniforms, not persisted colours or geometry. Normals remain physical metres. */
export class AtlasTerrainMaterialLayer extends SimpleMeshLayer<unknown,MaterialProps> {
  static layerName='AtlasTerrainMaterialLayer';
  static defaultProps={...SimpleMeshLayer.defaultProps,terrainStyle:{type:'object',value:null},heightOrigin:0,contours:0,automaticStep:1,seaLevelM:0,pixelRatio:1,masks:{type:'object',value:null},baseColor:{type:'object',value:null}};
  private get maskTexture():Texture|undefined{return (this.state as typeof this.state & {atlasMaskTexture?:Texture}).atlasMaskTexture;}
  private get baseTexture():Texture|undefined{return (this.state as typeof this.state & {atlasBaseTexture?:Texture}).atlasBaseTexture;}
  getShaders(){
    const shaders=super.getShaders();
    return {...shaders,modules:[...shaders.modules,materialModule],inject:{
      ...shaders.inject,
      'vs:#decl':'out float atlasHeight; out vec3 atlasPhysicalNormal;',
      'vs:#main-end':'atlasHeight=positions.z+atlasMaterial.heightOrigin; atlasPhysicalNormal=normals;',
      'fs:#decl':`in float atlasHeight; in vec3 atlasPhysicalNormal; uniform sampler2D atlasMasks;
        float atlasContour(float step,float gradient,float halfWidth){
          if(floor(atlasHeight/step+.5)*step<=atlasMaterial.seaLevel)return 0.0;
          float distancePx=abs(mod(atlasHeight+step*.5,step)-step*.5)/max(gradient,.00001);
          float width=halfWidth*atlasMaterial.pixelRatio;
          return (1.0-smoothstep(max(0.0,width-.5),width+.5,distancePx))
            *(1.0-smoothstep(step*.15,step*.4,gradient*atlasMaterial.pixelRatio));
        }
        float atlasContourBand(float step,float gradient){
          return max(atlasContour(step,gradient,${CONTOUR_INK.minorWidth})*${CONTOUR_INK.minorAlpha},
            atlasContour(step*5.0,gradient,${CONTOUR_INK.majorWidth.toFixed(1)})*${CONTOUR_INK.majorAlpha});
        }`,
      'fs:DECKGL_FILTER_COLOR':`
        vec2 masks=texture(atlasMasks,geometry.uv).rg;
        vec3 physicalNormal=normalize(atlasPhysicalNormal);
        float slope=length(physicalNormal.xy)/max(abs(physicalNormal.z),0.00001);
        float land=1.0-masks.r;
        float rock=0.85*smoothstep(0.35,1.2,slope)*atlasMaterial.mountains*land;
        float snow=smoothstep(atlasMaterial.snowline,atlasMaterial.snowline+300.0,atlasHeight)
          *(1.0-0.8*smoothstep(1.0,2.5,slope))*atlasMaterial.mountains*land;
        color.rgb=mix(color.rgb,vec3(144.0,139.0,129.0)/255.0,rock);
        color.rgb=mix(color.rgb,vec3(246.0,248.0,244.0)/255.0,snow);
        vec2 gradient=-physicalNormal.xy/max(abs(physicalNormal.z),0.00001);
        float light=1.0+atlasMaterial.strength*0.55*((-gradient.x*sin(atlasMaterial.lightRadians)
          +gradient.y*cos(atlasMaterial.lightRadians)+1.0)/sqrt(1.0+dot(gradient,gradient))-1.0);
        color.rgb*=mix(1.0,light,land);
        if(atlasMaterial.heightMode>0.5){
          float t=clamp((atlasHeight-atlasMaterial.seaLevel)/3000.0,0.0,1.0);
          vec3 low=vec3(189.0,209.0,148.0)/255.0,mid=vec3(206.0,177.0,111.0)/255.0,high=vec3(145.0,105.0,92.0)/255.0;
          color.rgb=mix(color.rgb,t<.4?mix(low,mid,t/.4):mix(mid,high,(t-.4)/.6),land);
        }
        float screenGradient=length(vec2(dFdx(atlasHeight),dFdy(atlasHeight)));
        if(atlasMaterial.contours!=0.0&&screenGradient>.00001){
          float interval=atlasMaterial.contours,blend=0.0;
          if(interval<0.0){float level=max(0.0,log2(atlasMaterial.automaticStep));interval=exp2(floor(level));blend=smoothstep(0.0,1.0,fract(level));}
          float ink=atlasContourBand(interval,screenGradient);
          if(atlasMaterial.contours<0.0)ink=mix(ink,atlasContourBand(interval*2.0,screenGradient),blend);
          color.rgb=mix(color.rgb,atlasMaterial.ink,ink*land);
        }
      `
    }};
  }
  updateState(params:UpdateParameters<this>){
    super.updateState(params);
    if(params.props.baseColor!==params.oldProps.baseColor){
      this.baseTexture?.destroy();
      const {data,width,height}=this.props.baseColor;
      // The pinned Deck image transform derives mip levels from image.data.width,
      // which raw typed arrays do not expose. Own this bounded texture explicitly.
      this.setState({atlasBaseTexture:this.context.device.createTexture({data,width,height,format:'rgba8unorm',mipLevels:1,
        sampler:{minFilter:'linear',magFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'}})});
    }
    if(params.props.masks!==params.oldProps.masks){
      this.maskTexture?.destroy();
      const {data,width,height}=this.props.masks;
      this.setState({atlasMaskTexture:this.context.device.createTexture({data,width,height,format:'rgba8unorm',mipLevels:1,sampler:{minFilter:'linear',magFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'}})});
    }
  }
  draw(options:Parameters<SimpleMeshLayer['draw']>[0]){
    const style=this.props.terrainStyle;
    this.state.model?.shaderInputs.setProps({atlasMaterial:{heightOrigin:this.props.heightOrigin,
      snowline:style.snowlineM??2500,mountains:style.mountains&&style.mode!=='height'?1:0,
      strength:style.strength,lightRadians:style.lightDegrees*Math.PI/180,
      contours:this.props.contours,automaticStep:this.props.automaticStep,seaLevel:this.props.seaLevelM,pixelRatio:this.props.pixelRatio,
      heightMode:style.mode==='height'?1:0,ink:reliefRgb(style.ink).map(v=>v/255)}});
    if(this.baseTexture)this.state.model?.shaderInputs.setProps({simpleMesh:{sampler:this.baseTexture,hasTexture:true}});
    if(this.maskTexture)this.state.model?.setBindings({atlasMasks:this.maskTexture});
    super.draw(options);
  }
  finalizeState(context:LayerContext){this.maskTexture?.destroy();this.baseTexture?.destroy();super.finalizeState(context);}
}
export type AtlasTerrainMaterialLayerProps=SimpleMeshLayerProps<unknown>&MaterialProps;

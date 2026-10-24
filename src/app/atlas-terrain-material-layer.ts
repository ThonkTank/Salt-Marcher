import {SimpleMeshLayer,type SimpleMeshLayerProps} from '@deck.gl/mesh-layers';
import type {UpdateParameters,LayerContext} from '@deck.gl/core';
import {Buffer,type Texture} from '@luma.gl/core';
import {GPUGeometry,Model} from '@luma.gl/engine';
import type {Mesh} from '@loaders.gl/schema';
import {atlasTexturePatch,type AtlasTextureData} from './atlas-texture-patch';
import {reliefRgb,type TerrainStyle} from './terrain-relief';
import {CONTOUR_INK} from './terrain-contour-style';
import {CARTOGRAPHIC_GLSL} from './atlas-cartographic-style';

type MaterialProps={
  terrainStyle:Readonly<TerrainStyle>;
  heightOrigin:number;
  contours:number;automaticStep:number;seaLevelM:number;pixelRatio:number;
  materialOrigin:readonly number[];
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
  vec2 materialOrigin;
} atlasMaterial;`;
const materialModule={name:'atlasMaterial',vs:block,fs:block,
  uniformTypes:{heightOrigin:'f32',snowline:'f32',mountains:'f32',strength:'f32',lightRadians:'f32',contours:'f32',automaticStep:'f32',seaLevel:'f32',pixelRatio:'f32',heightMode:'f32',ink:'vec3<f32>',materialOrigin:'vec2<f32>'}} as const;

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
      'vs:#decl':'out float atlasHeight; out vec3 atlasPhysicalNormal; out vec2 atlasWorld;',
      'vs:#main-end':'atlasHeight=positions.z+atlasMaterial.heightOrigin; atlasPhysicalNormal=normals; atlasWorld=positions.xy+atlasMaterial.materialOrigin;',
      'fs:#decl':`in float atlasHeight; in vec3 atlasPhysicalNormal; in vec2 atlasWorld; uniform sampler2D atlasMasks;
        ${CARTOGRAPHIC_GLSL}
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
        float mpp=max(length(dFdx(atlasWorld)),length(dFdy(atlasWorld)))*atlasMaterial.pixelRatio;
        float forest=masks.g*land;
        float rock=0.85*smoothstep(0.35,1.2,slope)*atlasMaterial.mountains*land;
        float snow=smoothstep(atlasMaterial.snowline,atlasMaterial.snowline+300.0,atlasHeight)
          *(1.0-0.8*smoothstep(1.0,2.5,slope))*atlasMaterial.mountains*land;
        color.rgb=mix(color.rgb,vec3(144.0,139.0,129.0)/255.0,rock);
        color.rgb=mix(color.rgb,vec3(246.0,248.0,244.0)/255.0,snow);
        if(atlasMaterial.heightMode<0.5){
          float surface=atlasForestSurface(mpp);
          float canopy=forest>0.001&&surface>0.0?atlasForestInk(atlasWorld,mpp):0.0;
          color.rgb*=1.0+forest*(canopy*surface-0.055*surface)*(1.0-snow);
          float stroke=(atlasWorld.x+atlasWorld.y*0.5)/16.0;
          float grain=sin(stroke*6.2831853)*(1.0-smoothstep(0.15,0.45,fwidth(stroke)));
          color.rgb*=1.0+0.035*grain*rock*(1.0-snow);
          float edge=1.0-smoothstep(0.0,max(fwidth(masks.r)*atlasMaterial.pixelRatio,0.05),abs(masks.r-0.5));
          color.rgb=mix(color.rgb,color.rgb*0.8,edge*0.35);
        }
        vec2 gradient=-physicalNormal.xy/max(abs(physicalNormal.z),0.00001);
        // Exaggerate broad relief lighting, never physical slopes or materials.
        gradient*=clamp(sqrt(max(mpp,1.0)/4.0),1.0,8.0);
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
  protected getModel(mesh:Mesh){
    const input=(mesh as {attributes:Record<string,{size:number;value:Float32Array}>;indices:{value:Uint32Array}}),a=input.attributes;
    const values={positions:a.POSITION!.value,normals:a.NORMAL!.value,texCoords:a.TEXCOORD_0!.value,colors:new Float32Array(a.POSITION!.value.length).fill(1)};
    const geometry=new GPUGeometry({topology:'triangle-list',vertexCount:input.indices.value.length,
      attributes:Object.fromEntries(Object.entries(values).map(([name,data])=>[name,this.context.device.createBuffer({data,usage:Buffer.VERTEX|Buffer.COPY_DST})])),
      indices:this.context.device.createBuffer({data:input.indices.value,usage:Buffer.INDEX}),
      bufferLayout:Object.keys(values).map(name=>({name,format:name==='texCoords'?'float32x2':'float32x3'}))});
    this.setState({atlasGeometry:geometry});
    const model=new Model(this.context.device,{...this.getShaders(),id:this.props.id,bufferLayout:this.getAttributeManager()!.getBufferLayouts(),geometry,isInstanced:true});
    model.shaderInputs.setProps({simpleMesh:{sampler:this.state.emptyTexture,hasTexture:false}});
    return model;
  }
  updateState(params:UpdateParameters<this>){
    const mesh=params.props.mesh as {attributes:Record<string,{value:Float32Array}>;indices:{value:Uint32Array}}|null;
    const old=params.oldProps.mesh as typeof mesh;
    const retain=!!(this.state.model&&mesh&&old&&!params.changeFlags.extensionsChanged&&mesh.indices.value.length===old.indices.value.length&&mesh.attributes.POSITION!.value.length===old.attributes.POSITION!.value.length);
    // Same regular grid topology: retain GPU model, UVs and indices. Update
    // only changed contiguous vertex ranges in the two physical attributes.
    super.updateState(retain?{...params,oldProps:{...params.oldProps,mesh:params.props.mesh}}:params);
    if(retain&&mesh!==old){
      for(const [attribute,name]of [['POSITION','positions'],['NORMAL','normals']]){
        const next=mesh!.attributes[attribute!]!.value,previous=old!.attributes[attribute!]!.value;
        let start=0,end=next.length;
        while(start<end&&next[start]===previous[start])start++;
        while(end>start&&next[end-1]===previous[end-1])end--;
        if(end>start)(this.state as typeof this.state & {atlasGeometry:GPUGeometry}).atlasGeometry.attributes[name!]!.write(next.subarray(start,end),start*4);
      }
    }
    this.updateTexture('atlasBaseTexture',this.props.baseColor,params.oldProps.baseColor,this.baseTexture);
    this.updateTexture('atlasMaskTexture',this.props.masks,params.oldProps.masks,this.maskTexture);
  }
  private updateTexture(name:string,next:AtlasTextureData,previous:AtlasTextureData|undefined,texture:Texture|undefined){
    if(!texture||!previous||next.width!==previous.width||next.height!==previous.height){
      texture?.destroy();this.setState({[name]:this.context.device.createTexture({...next,format:'rgba8unorm',mipLevels:1,
        sampler:{minFilter:'linear',magFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'}})});return;
    }
    const rect=atlasTexturePatch(previous,next);
    if(rect)texture.copyImageData({...rect,data:next.data.subarray((rect.y*next.width+rect.x)*4),bytesPerRow:next.width*4});
  }
  draw(options:Parameters<SimpleMeshLayer['draw']>[0]){
    const style=this.props.terrainStyle;
    this.state.model?.shaderInputs.setProps({atlasMaterial:{heightOrigin:this.props.heightOrigin,
      snowline:style.snowlineM??2500,mountains:style.mountains&&style.mode!=='height'?1:0,
      strength:style.strength,lightRadians:style.lightDegrees*Math.PI/180,
      contours:this.props.contours,automaticStep:this.props.automaticStep,seaLevel:this.props.seaLevelM,pixelRatio:this.props.pixelRatio,
      heightMode:style.mode==='height'?1:0,ink:reliefRgb(style.ink).map(v=>v/255),materialOrigin:this.props.materialOrigin}});
    if(this.baseTexture)this.state.model?.shaderInputs.setProps({simpleMesh:{sampler:this.baseTexture,hasTexture:true}});
    if(this.maskTexture)this.state.model?.setBindings({atlasMasks:this.maskTexture});
    super.draw(options);
  }
  finalizeState(context:LayerContext){this.maskTexture?.destroy();this.baseTexture?.destroy();super.finalizeState(context);}
}
export type AtlasTerrainMaterialLayerProps=SimpleMeshLayerProps<unknown>&MaterialProps;

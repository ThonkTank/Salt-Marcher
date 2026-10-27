import {acquireCartographicTextures} from './atlas-cartographic-texture';
import {SimpleMeshLayer,type SimpleMeshLayerProps} from '@deck.gl/mesh-layers';
import type {UpdateParameters,LayerContext} from '@deck.gl/core';
import {Buffer,type Texture} from '@luma.gl/core';
import {GPUGeometry,Model} from '@luma.gl/engine';
import type {Mesh} from '@loaders.gl/schema';
import {atlasTexturePatch,type AtlasTextureData} from './atlas-texture-patch';
import {reliefRgb,type TerrainStyle} from './terrain-relief';
import {CONTOUR_INK} from './terrain-contour-style';
import {CARTOGRAPHIC_GLSL} from './atlas-cartographic-style';
import type {AtlasTerrainTransition} from './atlas-terrain-tile-model';

export const terrainMaterialTiming={updates:0,updateMs:0,compareMs:0,uploadSubmitMs:0,uploadedBytes:0};
function upload(bytes:number,run:()=>void){const start=performance.now();run();terrainMaterialTiming.uploadSubmitMs+=performance.now()-start;terrainMaterialTiming.uploadedBytes+=bytes;}

type MaterialProps={
  transition?:AtlasTerrainTransition;
  transitionComplete?:boolean;
  transitionAlpha?:number;
  terrainStyle:Readonly<TerrainStyle>;
  heightOrigin:number;
  contours:number;automaticStep:number;seaLevelM:number;pixelRatio:number;
  materialOrigin:readonly number[];
  masks:{data:Uint8Array;width:number;height:number};
  cover:{data:Uint8Array;width:number;height:number};
  relief:{data:Uint8Array;width:number;height:number};
  baseColor:{data:Uint8Array;width:number;height:number};
};
const block=`layout(std140) uniform atlasMaterialUniforms {
  float transition;
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
  float drawn;
  vec3 ink;
  vec2 materialOrigin;
  vec4 previousUv;
} atlasMaterial;`;
const materialModule={name:'atlasMaterial',vs:block,fs:block,
  uniformTypes:{transition:'f32',heightOrigin:'f32',snowline:'f32',mountains:'f32',strength:'f32',lightRadians:'f32',contours:'f32',automaticStep:'f32',seaLevel:'f32',pixelRatio:'f32',heightMode:'f32',drawn:'f32',ink:'vec3<f32>',materialOrigin:'vec2<f32>',previousUv:'vec4<f32>'}} as const;

/** Material effects are display work. Updating the light or snowline changes
 * uniforms, not persisted colours or geometry. Normals remain physical metres. */
export class AtlasTerrainMaterialLayer extends SimpleMeshLayer<unknown,MaterialProps> {
  static layerName='AtlasTerrainMaterialLayer';
  static defaultProps={...SimpleMeshLayer.defaultProps,transition:{type:'object',value:null},terrainStyle:{type:'object',value:null},heightOrigin:0,contours:0,automaticStep:1,seaLevelM:0,pixelRatio:1,masks:{type:'object',value:null},baseColor:{type:'object',value:null},cover:{type:'object',value:null},relief:{type:'object',value:null}};
  private get maskTexture():Texture|undefined{return (this.state as typeof this.state & {atlasMaskTexture?:Texture}).atlasMaskTexture;}
  private get baseTexture():Texture|undefined{return (this.state as typeof this.state & {atlasBaseTexture?:Texture}).atlasBaseTexture;}
  private get extras(){return this.state as typeof this.state & {atlasCoverTexture?:Texture;atlasReliefTexture?:Texture;atlasPreviousBaseTexture?:Texture;atlasPreviousMaskTexture?:Texture;atlasPreviousCoverTexture?:Texture;atlasPreviousReliefTexture?:Texture;ink?:ReturnType<typeof acquireCartographicTextures>};}
  getShaders(){
    const shaders=super.getShaders();
    const vs=shaders.vs.replace('void main(void) {','void main(void) {\nvec3 atlasTerrainPosition=vec3(positions.xy,mix(atlasPreviousHeight,positions.z,atlasMaterial.transition));\nvec3 atlasTerrainNormal=normalize(mix(atlasPreviousNormal,normals,atlasMaterial.transition));').replace('instanceModelMatrix * positions','instanceModelMatrix * atlasTerrainPosition').replaceAll('instanceModelMatrix * normals','instanceModelMatrix * atlasTerrainNormal');
    return {...shaders,vs,modules:[...shaders.modules,materialModule],inject:{
      ...shaders.inject,
      'vs:#decl':'in float atlasPreviousHeight; in vec3 atlasPreviousNormal; out float atlasHeight; out vec3 atlasPhysicalNormal; out vec2 atlasWorld;',
      'vs:#main-end':'atlasHeight=atlasTerrainPosition.z+atlasMaterial.heightOrigin; atlasPhysicalNormal=atlasTerrainNormal; atlasWorld=positions.xy+atlasMaterial.materialOrigin;',
      'fs:#decl':`in float atlasHeight; in vec3 atlasPhysicalNormal; in vec2 atlasWorld; uniform sampler2D atlasMasks; uniform sampler2D atlasCover; uniform sampler2D atlasRelief; uniform sampler2D atlasPreviousBase; uniform sampler2D atlasPreviousMasks; uniform sampler2D atlasPreviousCover; uniform sampler2D atlasPreviousRelief;
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
        vec2 previousUv=geometry.uv*atlasMaterial.previousUv.zw+atlasMaterial.previousUv.xy;
        color.rgb=mix(texture(atlasPreviousBase,previousUv).rgb,color.rgb,atlasMaterial.transition);
        vec3 masks=mix(texture(atlasPreviousMasks,previousUv).rgb,texture(atlasMasks,geometry.uv).rgb,atlasMaterial.transition);
        vec4 cover=mix(texture(atlasPreviousCover,previousUv),texture(atlasCover,geometry.uv),atlasMaterial.transition);
        vec4 relief=mix(texture(atlasPreviousRelief,previousUv),texture(atlasRelief,geometry.uv),atlasMaterial.transition);
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
        if(atlasMaterial.drawn>0.5){
          float ink=atlasCoverInk(atlasWorld,mpp,cover,forest,masks.b);
          color.rgb=mix(color.rgb,atlasMaterial.ink,ink*0.3*land*(1.0-snow));
          float edge=1.0-smoothstep(0.0,max(fwidth(masks.r)*atlasMaterial.pixelRatio,0.05),abs(masks.r-0.5));
          color.rgb=mix(color.rgb,atlasMaterial.ink,edge*0.16);
          vec3 macro=normalize(relief.rgb*2.0-1.0);
          vec2 direction=-macro.xy/max(abs(macro.z),0.01);
          float hatching=atlasSlopeInk(atlasWorld,mpp,direction);
          float ridges=relief.a*(1.0-smoothstep(512.0,2048.0,mpp));
          color.rgb=mix(color.rgb,atlasMaterial.ink,land*atlasMaterial.mountains*(hatching*0.28+ridges*0.24)*(1.0-snow*0.8));
        }
        vec2 gradient=-physicalNormal.xy/max(abs(physicalNormal.z),0.00001);
        if(atlasMaterial.drawn>0.5){
          vec3 macro=normalize(relief.rgb*2.0-1.0);
          gradient=mix(gradient,-macro.xy/max(abs(macro.z),0.01),smoothstep(2.0,16.0,mpp)*0.65);
        }
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
    const uploadStart=performance.now();
    const input=(mesh as {attributes:Record<string,{size:number;value:Float32Array}>;indices:{value:Uint32Array}}),a=input.attributes;
    const values={positions:a.POSITION!.value,normals:a.NORMAL!.value,texCoords:a.TEXCOORD_0!.value,colors:new Float32Array(a.POSITION!.value.length).fill(1),atlasPreviousHeight:this.props.transition?.heights??Float32Array.from({length:a.POSITION!.value.length/3},(_,i)=>a.POSITION!.value[i*3+2]!),atlasPreviousNormal:this.props.transition?.vertexNormals??a.NORMAL!.value};
    const geometry=new GPUGeometry({topology:'triangle-list',vertexCount:input.indices.value.length,
      attributes:Object.fromEntries(Object.entries(values).map(([name,data])=>[name,this.context.device.createBuffer({data,usage:Buffer.VERTEX|Buffer.COPY_DST})])),
      indices:this.context.device.createBuffer({data:input.indices.value,usage:Buffer.INDEX}),
      bufferLayout:Object.keys(values).map(name=>({name,format:name==='atlasPreviousHeight'?'float32':name==='texCoords'?'float32x2':'float32x3'}))});
    this.setState({atlasGeometry:geometry});
    const model=new Model(this.context.device,{...this.getShaders(),id:this.props.id,bufferLayout:this.getAttributeManager()!.getBufferLayouts(),geometry,isInstanced:true});
    model.shaderInputs.setProps({simpleMesh:{sampler:this.state.emptyTexture,hasTexture:false}});
    terrainMaterialTiming.uploadSubmitMs+=performance.now()-uploadStart;terrainMaterialTiming.uploadedBytes+=Object.values(values).reduce((sum,v)=>sum+v.byteLength,0)+input.indices.value.byteLength;
    return model;
  }
  updateState(params:UpdateParameters<this>){
    const updateStart=performance.now();terrainMaterialTiming.updates++;
    const mesh=params.props.mesh as {attributes:Record<string,{value:Float32Array}>;indices:{value:Uint32Array}}|null;
    const old=params.oldProps.mesh as typeof mesh;
    const retain=!!(this.state.model&&mesh&&old&&!params.changeFlags.extensionsChanged&&mesh.indices.value.length===old.indices.value.length&&mesh.attributes.POSITION!.value.length===old.attributes.POSITION!.value.length);
    // Retain equal-sized GPU buffers, including clipped parent meshes whose
    // vertex order and triangle indices can change with their covered region.
    super.updateState(retain?{...params,oldProps:{...params.oldProps,mesh:params.props.mesh}}:params);
    if(retain&&(mesh!==old||this.props.transition!==params.oldProps.transition)){
      const pairs=[['positions',mesh!.attributes.POSITION!.value,old!.attributes.POSITION!.value],['normals',mesh!.attributes.NORMAL!.value,old!.attributes.NORMAL!.value],['texCoords',mesh!.attributes.TEXCOORD_0!.value,old!.attributes.TEXCOORD_0!.value],['atlasPreviousHeight',this.props.transition?.heights??Float32Array.from({length:mesh!.attributes.POSITION!.value.length/3},(_,i)=>mesh!.attributes.POSITION!.value[i*3+2]!),params.oldProps.transition?.heights??Float32Array.from({length:old!.attributes.POSITION!.value.length/3},(_,i)=>old!.attributes.POSITION!.value[i*3+2]!)],['atlasPreviousNormal',this.props.transition?.vertexNormals??mesh!.attributes.NORMAL!.value,params.oldProps.transition?.vertexNormals??old!.attributes.NORMAL!.value]] as const;
      for(const [name,next,previous]of pairs){
        if(next===previous)continue;const compareStart=performance.now();
        let start=0,end=next.length;
        while(start<end&&next[start]===previous[start])start++;
        while(end>start&&next[end-1]===previous[end-1])end--;
        terrainMaterialTiming.compareMs+=performance.now()-compareStart;
        if(end>start)upload((end-start)*4,()=>{(this.state as typeof this.state & {atlasGeometry:GPUGeometry}).atlasGeometry.attributes[name]!.write(next.subarray(start,end),start*4);});
      }
      const next=mesh!.indices.value,previous=old!.indices.value,compareStart=performance.now();let start=0,end=next===previous?0:next.length;
      while(start<end&&next[start]===previous[start])start++;
      while(end>start&&next[end-1]===previous[end-1])end--;
      terrainMaterialTiming.compareMs+=performance.now()-compareStart;
      if(end>start)upload((end-start)*4,()=>{(this.state as typeof this.state & {atlasGeometry:GPUGeometry}).atlasGeometry.indices!.write(next.subarray(start,end),start*4);});
    }
    if(!this.extras.ink)this.setState({ink:acquireCartographicTextures(this.context.device)});
    this.updateTexture('atlasCoverTexture',this.props.cover,params.oldProps.cover,this.extras.atlasCoverTexture);
    this.updateTexture('atlasReliefTexture',this.props.relief,params.oldProps.relief,this.extras.atlasReliefTexture);
    this.updateTexture('atlasBaseTexture',this.props.baseColor,params.oldProps.baseColor,this.baseTexture);
    this.updateTexture('atlasMaskTexture',this.props.masks,params.oldProps.masks,this.maskTexture);
    for(const [key,name]of [['texture','atlasPreviousBaseTexture'],['masks','atlasPreviousMaskTexture'],['cover','atlasPreviousCoverTexture'],['relief','atlasPreviousReliefTexture']] as const){
      const next=this.props.transitionComplete?undefined:this.props.transition?.[key],texture=this.extras[name];
      if(next)this.updateTexture(name,next,params.oldProps.transition?.[key],texture);else if(texture){texture.destroy();this.setState({[name]:undefined});}
    }
    terrainMaterialTiming.updateMs+=performance.now()-updateStart;
  }
  private updateTexture(name:string,next:AtlasTextureData,previous:AtlasTextureData|undefined,texture:Texture|undefined){
    if(!texture||!previous||next.width!==previous.width||next.height!==previous.height){
      texture?.destroy();const uploadStart=performance.now();
      // Texture.props retains constructor data in this runtime. Allocate first,
      // then upload so old source arrays cannot outlive their display snapshot.
      const created=this.context.device.createTexture({width:next.width,height:next.height,format:'rgba8unorm',mipLevels:1,
        sampler:{minFilter:'linear',magFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'}});
      try{created.copyImageData({data:next.data,width:next.width,height:next.height,bytesPerRow:next.width*4});}catch(error){created.destroy();throw error;}
      this.setState({[name]:created});terrainMaterialTiming.uploadSubmitMs+=performance.now()-uploadStart;terrainMaterialTiming.uploadedBytes+=next.data.byteLength;return;
    }
    const compareStart=performance.now(),rect=atlasTexturePatch(previous,next);terrainMaterialTiming.compareMs+=performance.now()-compareStart;
    if(rect)upload(rect.width*rect.height*4,()=>{texture.copyImageData({...rect,data:next.data.subarray((rect.y*next.width+rect.x)*4),bytesPerRow:next.width*4});});
  }
  draw(options:Parameters<SimpleMeshLayer['draw']>[0]){
    const style=this.props.terrainStyle;
    const transition=this.props.transition,progress=this.props.transitionAlpha??1;
    this.state.model?.shaderInputs.setProps({atlasMaterial:{transition:progress,heightOrigin:this.props.heightOrigin,
      snowline:style.snowlineM??2500,mountains:style.mountains&&style.mode!=='height'?1:0,
      strength:style.strength,lightRadians:style.lightDegrees*Math.PI/180,
      contours:this.props.contours,automaticStep:this.props.automaticStep,seaLevel:this.props.seaLevelM,pixelRatio:this.props.pixelRatio,
      heightMode:style.mode==='height'?1:0,drawn:style.mode==='drawn'?1:0,ink:reliefRgb(style.ink).map(v=>v/255),materialOrigin:this.props.materialOrigin,previousUv:transition&&!this.props.transitionComplete?transition.materialUv:[0,0,1,1]}});
    if(this.baseTexture)this.state.model?.shaderInputs.setProps({simpleMesh:{sampler:this.baseTexture,hasTexture:true}});
    if(this.maskTexture)this.state.model?.setBindings({atlasMasks:this.maskTexture});
    const extra=this.extras;
    if(this.baseTexture&&this.maskTexture&&extra.atlasCoverTexture&&extra.atlasReliefTexture)this.state.model?.setBindings({atlasPreviousBase:extra.atlasPreviousBaseTexture??this.baseTexture,atlasPreviousMasks:extra.atlasPreviousMaskTexture??this.maskTexture,atlasPreviousCover:extra.atlasPreviousCoverTexture??extra.atlasCoverTexture,atlasPreviousRelief:extra.atlasPreviousReliefTexture??extra.atlasReliefTexture});
    if(extra.atlasCoverTexture&&extra.atlasReliefTexture&&extra.ink)this.state.model?.setBindings({atlasCover:extra.atlasCoverTexture,atlasRelief:extra.atlasReliefTexture,atlasPlantInk:extra.ink.plants,atlasMarkInk:extra.ink.marks});
    super.draw(options);
  }
  finalizeState(context:LayerContext){this.extras.ink?.release();this.extras.atlasCoverTexture?.destroy();this.extras.atlasReliefTexture?.destroy();this.extras.atlasPreviousBaseTexture?.destroy();this.extras.atlasPreviousMaskTexture?.destroy();this.extras.atlasPreviousCoverTexture?.destroy();this.extras.atlasPreviousReliefTexture?.destroy();this.maskTexture?.destroy();this.baseTexture?.destroy();super.finalizeState(context);}
}
export type AtlasTerrainMaterialLayerProps=SimpleMeshLayerProps<unknown>&MaterialProps;

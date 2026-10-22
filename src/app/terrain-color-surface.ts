import * as THREE from 'three';
import {colorFrameReference,type TerrainColorFrame,type TerrainColorFrameReference,type TerrainTileColor} from './terrain-color-frame';
import type {TerrainRect} from './terrain-frame';

const vertexShader='in vec3 position;void main(){gl_Position=vec4(position,1.0);}';
const fragmentShader=`precision highp float;precision highp int;
uniform sampler2D color;uniform sampler2D forest;uniform vec2 offset;uniform vec2 step;
layout(location=0)out vec4 rgba;layout(location=1)out vec4 cover;
void main(){
 vec2 sampleAt=floor(offset+gl_FragCoord.xy*step);vec2 size=vec2(textureSize(color,0));
 if(any(lessThan(sampleAt,vec2(0)))||any(greaterThanEqual(sampleAt,size))){rgba=vec4(0);cover=vec4(0);}
 else{ivec2 p=ivec2(sampleAt);rgba=texelFetch(color,p,0);cover=texelFetch(forest,p,0);}
}`;
const target=(width:number,height:number)=>{
 const value=new THREE.WebGLRenderTarget(width,height,{count:2,depthBuffer:false,stencilBuffer:false,colorSpace:THREE.SRGBColorSpace});
 value.textures[1]!.colorSpace=THREE.NoColorSpace;value.textures[1]!.format=THREE.RedFormat;
 return value;
};
const sameLattice=(a:TerrainColorFrameReference,b:TerrainColorFrameReference)=>a.width===b.width&&a.height===b.height&&a.box.x===b.box.x&&a.box.y===b.box.y&&a.box.width===b.box.width&&a.box.height===b.box.height;

/** One resident detail image. A changed lattice briefly owns two bounded images
 * (at most 2 × 2304² × 5 bytes); no readback or full CPU image is required.
 * Only accepted tile buffers can reconstruct a missing predecessor. */
export class TerrainColorSurface {
 private scene=new THREE.Scene();
 private camera=new THREE.Camera();
 private geometry=new THREE.PlaneGeometry(2,2);
 private empty=new THREE.DataTexture(new Uint8Array(4),1,1);
 private uniforms={color:{value:this.empty as THREE.Texture},forest:{value:this.empty as THREE.Texture},offset:{value:new THREE.Vector2()},step:{value:new THREE.Vector2(1,1)}};
 private material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,vertexShader,fragmentShader,uniforms:this.uniforms,depthTest:false,depthWrite:false});
 private resident:{frame:TerrainColorFrameReference;target:THREE.WebGLRenderTarget;uploaded:Map<number,number>}|undefined;
 private colors=new WeakMap<TerrainTileColor,number>();
 private nextColor=0;
 private closed=false;
 readonly ready:Promise<void>;
 constructor(private renderer:THREE.WebGLRenderer){
  this.empty.needsUpdate=true;this.scene.add(new THREE.Mesh(this.geometry,this.material));
  const warm=target(1,1);
  // Start before detail loads or gestures. Shader readiness is awaited by the
  // loader, while the ordinary camera continues drawing its usable overview.
  const preparing=this.withTarget(warm,()=>renderer.compileAsync(this.scene,this.camera));
  this.ready=preparing.then(()=>{if(!this.closed)this.withTarget(warm,()=>renderer.render(this.scene,this.camera));}).finally(()=>warm.dispose());
 }
 private withTarget<T>(next:THREE.WebGLRenderTarget,action:()=>T):T{
  const renderer=this.renderer,previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),level=renderer.getActiveMipmapLevel(),auto=renderer.autoClear;
  try{renderer.autoClear=false;renderer.setRenderTarget(next);return action();}
  finally{renderer.setRenderTarget(previous,face,level);renderer.autoClear=auto;}
 }
 private clear(image:THREE.WebGLRenderTarget,rects?:TerrainRect[]){
  const color=this.renderer.getClearColor(new THREE.Color()),alpha=this.renderer.getClearAlpha();
  try{
   this.renderer.setClearColor(0,0);
   for(const r of rects??[{x:0,y:0,width:image.width,height:image.height}]){
    image.scissor.set(r.x,r.y,r.width,r.height);image.scissorTest=true;
    this.withTarget(image,()=>this.renderer.clear(true,false,false));
   }
  }finally{image.scissorTest=false;this.renderer.setClearColor(color,alpha);}
 }
 update(frame:TerrainColorFrame){
  if(this.closed)throw Error('Geländefläche ist geschlossen.');
  if(frame.width>2304||frame.height>2304||frame.width<1||frame.height<1)throw Error('Geländedetail überschreitet das Bildbudget.');
  let current=this.resident;let copied:Set<number>|undefined;
  if(current?.frame.id!==frame.id){
   const inherits=current&&frame.previous?.id===current.frame.id;
   if(inherits&&sameLattice(current!.frame,frame)){
    current!.frame=colorFrameReference(frame);
    if(frame.clear?.length)this.clear(current!.target,frame.clear);
    for(const key of current!.uploaded.keys())if(!frame.tiles.has(key))current!.uploaded.delete(key);
   }else{
    const next=target(frame.width,frame.height);
    try{
     if(inherits){
      const previous=current!.frame,b=frame.box,old=previous.box;
      if(b.width/frame.width===old.width/previous.width&&b.height/frame.height===old.height/previous.height)copied=new Set(current!.uploaded.values());
      this.uniforms.color.value=current!.target.textures[0]!;this.uniforms.forest.value=current!.target.textures[1]!;
      // Reduce world origins in JS double precision; GPU coordinates stay local.
      this.uniforms.offset.value.set((b.x-old.x)/old.width*previous.width,(b.y-old.y)/old.height*previous.height);
      this.uniforms.step.value.set(b.width/frame.width/old.width*previous.width,b.height/frame.height/old.height*previous.height);
      this.withTarget(next,()=>this.renderer.render(this.scene,this.camera));
     }else this.clear(next);
     if(frame.clear?.length)this.clear(next,frame.clear);
    }catch(error){next.dispose();throw error;}
    current?.target.dispose();current={frame:colorFrameReference(frame),target:next,uploaded:new Map()};
   }
   this.resident=current;
  }
  const image=current!.target;
  for(const [key,{rect,color}]of frame.tiles){
   let identity=this.colors.get(color);if(identity===undefined){identity=++this.nextColor;this.colors.set(color,identity);}
   if(current!.uploaded.get(key)===identity)continue;
   // A pan on the same world lattice has already copied these exact accepted
   // tiles. Do not send their unchanged CPU buffers across the GPU bridge again.
   if(!copied?.has(identity))this.upload(image,rect,color);current!.uploaded.set(key,identity);
  }
  // The resampler never needs to hold an additional old texture reference.
  this.uniforms.color.value=this.empty;this.uniforms.forest.value=this.empty;
  return {color:image.textures[0]!,forest:image.textures[1]!};
 }
 private upload(image:THREE.WebGLRenderTarget,rect:TerrainRect,color:TerrainTileColor){
  const source=new THREE.DataTexture(color.pixels,rect.width,rect.height);source.colorSpace=THREE.SRGBColorSpace;
  const mask=new THREE.DataTexture(color.forest??new Uint8Array(rect.width*rect.height),rect.width,rect.height,THREE.RedFormat);
  try{
   const at=new THREE.Vector2(rect.x,rect.y);
   // CPU sources are never initialized for sampling: only the destination has
   // GPU storage. One upload per channel, not one command for every pixel row.
   this.renderer.copyTextureToTexture(source,image.textures[0]!,null,at);
   this.renderer.copyTextureToTexture(mask,image.textures[1]!,null,at);
  }finally{source.dispose();mask.dispose();}
 }
 dispose(){this.closed=true;this.resident?.target.dispose();this.resident=undefined;this.empty.dispose();this.material.dispose();this.geometry.dispose();}
}

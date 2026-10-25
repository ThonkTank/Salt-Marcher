import type {Device,Texture} from '@luma.gl/core';

export const CARTOGRAPHIC_TEXTURE_SIZE=256;
/** Reproducible pencil strokes, rasterized once. RGBA packs four independent
 * ink plates (oak, pine, grass, scrub); a second plate holds stone and hatching.
 * Toroidal rasterization gives every mip level a seamless repeating edge. */
export function cartographicInkPixels(){
 const size=CARTOGRAPHIC_TEXTURE_SIZE,plants=new Uint8Array(size*size*4),marks=new Uint8Array(plants.length);
 let seed=214731;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const stroke=(data:Uint8Array,channel:number,a:number[],b:number[],width=1,opacity=.8)=>{
  const dx=b[0]!-a[0]!,dy=b[1]!-a[1]!,length=dx*dx+dy*dy;
  for(let y=Math.floor(Math.min(a[1]!,b[1]!)-2);y<=Math.ceil(Math.max(a[1]!,b[1]!)+2);y++)for(let x=Math.floor(Math.min(a[0]!,b[0]!)-2);x<=Math.ceil(Math.max(a[0]!,b[0]!)+2);x++){
   const t=length?Math.max(0,Math.min(1,((x+.5-a[0]!)*dx+(y+.5-a[1]!)*dy)/length)):0;
   const alpha=Math.max(0,Math.min(1,width+.5-Math.hypot(x+.5-a[0]!-t*dx,y+.5-a[1]!-t*dy)))*opacity;
   const i=(((y%size+size)%size)*size+(x%size+size)%size)*4+channel;
   data[i]=Math.max(data[i]!,Math.round(alpha*255));
  }
 };
 const path=(data:Uint8Array,c:number,points:number[][],width=1,opacity=.8)=>{for(let i=1;i<points.length;i++)stroke(data,c,points[i-1]!,points[i]!,width,opacity);};
 for(let i=0;i<64;i++){
  const cx=random()*size,cy=random()*size,r=7+random()*5;
  const crown=Array.from({length:19},(_,i)=>{const a=i/18*Math.PI*2,rad=r*(.84+.12*Math.sin(a*5)+random()*.12);return[cx+Math.cos(a)*rad,cy+Math.sin(a)*rad*.75];});
  path(plants,0,crown,.65,.65);path(plants,0,[[cx-r*.5,cy+2],[cx-1,cy+4],[cx+r*.5,cy+1]],.7,.35);
  path(plants,1,[[cx,cy-r],[cx-r*.7,cy+2],[cx-r*.3,cy],[cx-r*.9,cy+r*.6],[cx+r*.8,cy+r*.6],[cx+r*.3,cy],[cx+r*.65,cy+2],[cx,cy-r]].map(([x,y])=>[x!+(random()-.5)*1.4,y!+(random()-.5)*1.4]),.75,.72);
  stroke(plants,1,[cx,cy+r*.7],[cx,cy+r],.7,.5);
  path(plants,2,[[cx-3,cy],[cx,cy+4],[cx+1,cy-2]],.65,.5);stroke(plants,2,[cx+3,cy+3],[cx+6,cy],.6,.4);
  path(plants,3,[[cx-r*.6,cy+2],[cx-r*.5,cy-2],[cx-2,cy-4],[cx+1,cy-1],[cx+3,cy-4],[cx+7,cy-1],[cx+8,cy+3]],.7,.65);
  path(marks,0,[[cx-5,cy+3],[cx-2,cy-4],[cx+4,cy-2],[cx+7,cy+4],[cx-5,cy+3]],.75,.65);
  path(marks,0,[[cx-2,cy-4],[cx,cy+2],[cx+7,cy+4]],.6,.35);
  for(let j=0;j<3;j++)path(marks,1,[[cx-7+j*4,cy-9],[cx-6+j*4,cy-2],[cx-8+j*4,cy+5+random()*5]],.6,.55);
 }
 return {plants,marks,width:size,height:size};
}
let pixels:ReturnType<typeof cartographicInkPixels>|undefined;
type Shared={plants:Texture;marks:Texture;users:number};
const resources=new WeakMap<Device,Shared>();
export function acquireCartographicTextures(device:Device){
 let entry=resources.get(device);
 if(!entry){
  pixels??=cartographicInkPixels();
  const make=(data:Uint8Array)=>{const texture=device.createTexture({data,width:pixels!.width,height:pixels!.height,format:'rgba8unorm',mipLevels:9,
   sampler:{minFilter:'linear',magFilter:'linear',mipmapFilter:'linear',addressModeU:'repeat',addressModeV:'repeat'}});try{texture.generateMipmapsWebGL();return texture;}catch(error){texture.destroy();throw error;}};
  const plants=make(pixels.plants);let marks:Texture;
  try{marks=make(pixels.marks);}catch(error){plants.destroy();throw error;}
  entry={plants,marks,users:0};resources.set(device,entry);
 }
 entry.users++;let released=false;const owned=entry;
 return {plants:entry.plants,marks:entry.marks,release:()=>{if(released)return;released=true;if(--owned.users===0){owned.plants.destroy();owned.marks.destroy();resources.delete(device);}}};
}

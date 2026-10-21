const COAST_INK=[104,86,57] as const;
const COAST_ALPHA=.85;
/** One supersample on each side of the water boundary makes a one-raster-pixel
 * shoreline after 2x downsampling. No distance field or broad baked halo is
 * needed. The caller supplies the shared water decisions and an output inset;
 * neighbouring samples in its halo keep independently rendered tiles seamless. */
export function* paintTerrainCoast(samples:Uint8Array,water:Uint8Array,width:number,height:number,inset:number,checkpoint:()=>Generator<void>):Generator<void>{
 if(!water.includes(water[0]===0?1:0))return;
 const pad=Math.max(1,inset);
 for(let y=pad;y<height-pad;y++){
  for(let x=pad;x<width-pad;x++){
   const i=y*width+x,v=water[i];
   if(v===water[i-1]&&v===water[i+1]&&v===water[i-width]&&v===water[i+width])continue;
   const at=i*4,old=samples[at+3]!/255,total=COAST_ALPHA+old*(1-COAST_ALPHA);
   for(let c=0;c<3;c++)samples[at+c]=Math.round((COAST_INK[c]!*COAST_ALPHA+samples[at+c]!*old*(1-COAST_ALPHA))/total);
   samples[at+3]=Math.round(total*255);
  }
  if((y-pad+1)%16===0)yield* checkpoint();
 }
}

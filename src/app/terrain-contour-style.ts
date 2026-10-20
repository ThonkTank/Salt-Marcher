/** -1 selects automatic detail, 0 hides contours, positive values fix metres. */
export const AUTO_CONTOURS=-1;
export const CONTOUR_BASE_METRES=1;
export const CONTOUR_SPACING_PIXELS=12;
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function line(height:number,gradient:number,step:number,sea:number,width:number){
  if(Math.floor(height/step+.5)*step<=sea)return 0;
  const distance=Math.abs(((height+step*.5)%step+step)%step-step*.5)/gradient;
  return (1-smooth(Math.max(0,width-.5),width+.5,distance))*(1-smooth(step*.15,step*.4,gradient));
}
const band=(height:number,gradient:number,step:number,sea:number)=>Math.max(line(height,gradient,step,sea,.45)*.38,line(height,gradient,step*5,sea,.75)*.52);

/** Screen derivative in metres per pixel. Crossfade nested, world-anchored
 * intervals; never interpolate a contour's elevation while the camera moves. */
export function terrainContourInk(height:number,gradient:number,interval:number,sea:number){
  if(interval===0||gradient<=.00001)return 0;
  if(interval>0)return band(height,gradient,interval,sea);
  const level=Math.max(0,Math.log2(gradient*CONTOUR_SPACING_PIXELS/CONTOUR_BASE_METRES));
  const step=CONTOUR_BASE_METRES*2**Math.floor(level),blend=smooth(0,1,level%1);
  return band(height,gradient,step,sea)*(1-blend)+band(height,gradient,step*2,sea)*blend;
}

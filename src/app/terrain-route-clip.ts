import type {Point} from './contracts';
import type {LandscapeBox} from './atlas-landscape';
/** Segment parameters preserve original dash, taper and curve distances. */
export function routeSegmentRange(a:Point,b:Point,box?:LandscapeBox):[number,number]|undefined{
 if(!box)return [0,1];
 let first=0,last=1;
 for(const [start,delta,low,high]of [[a.x,b.x-a.x,box.x,box.x+box.width],[a.y,b.y-a.y,box.y,box.y+box.height]] as const){
  if(delta===0){if(start<low||start>high)return;continue;}
  const x=(low-start)/delta,y=(high-start)/delta;
  first=Math.max(first,Math.min(x,y));last=Math.min(last,Math.max(x,y));if(first>=last)return;
 }
 return [first,last];
}

/** Split at changes in terrain sampling density, preserving original segment
 * parameters. Directional spacing avoids oversampling a long horizontal route
 * merely because its y coordinate passes through the fine centre band. */
export function routeSampleSections(a:Point,b:Point,box:LandscapeBox|undefined,step:number,layout?:import('./terrain-grid-layout').TerrainRouteLayout){
 const range=routeSegmentRange(a,b,box);if(!range)return[];
 if(!layout)return[{range,step}];
 const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),cuts=[...range];
 for(const [axis,start,delta]of [[layout.x,a.x,dx],[layout.y,a.y,dy]] as const)if(delta)for(const band of axis.bands){const t=(band.origin-start)/delta;if(t>range[0]&&t<range[1])cuts.push(t);}
 cuts.sort((a,b)=>a-b);const result:{range:[number,number];step:number}[]=[];
 for(let i=1;i<cuts.length;i++){
  const lo=cuts[i-1]!,hi=cuts[i]!;if(hi-lo<1e-14)continue;const t=(lo+hi)/2;
  const spacing=(axis:typeof layout.x,value:number,delta:number)=>{
   if(!delta)return Infinity;
   const band=axis.bands.find(b=>value<b.origin+b.cells*b.step)??axis.bands.at(-1)!;
   return band.step*length/Math.abs(delta)/2;
  };
  result.push({range:[lo,hi],step:Math.max(step,Math.min(spacing(layout.x,a.x+dx*t,dx),spacing(layout.y,a.y+dy*t,dy)))});
 }
 return result;
}

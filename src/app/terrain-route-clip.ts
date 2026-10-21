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

import {lineType,typeFor,lineScale,type LineTypeId} from './line-types';
import type { Point, Polygon } from './contracts';
import type { LandscapeRecord } from './atlas-landscape';

export const roadStyles = [
  ['blended', 'Weicher Weg'], ['solid', 'Durchgezogen'], ['dashed', 'Gestrichelt'],
  ['dotted', 'Gepunktet'], ['double', 'Doppellinie mit Randstrichen'], ['dash-dot-dot', 'Strich-Doppelpunkt'],
  ['arrows', 'Pfeile'], ['rail', 'Schraffur'], ['dash-dot', 'Strichpunkt'], ['worn', 'Breiter Pinselstrich'],
] as const;
export type RoadStyle = typeof roadStyles[number][0];
export interface LandscapeLine {
  version: 1 | 2;
  type?: LineTypeId;
  catalogVersion?: 1;
  curve: 'smooth' | 'linear';
  color?: string;
  roughness: number;
  meander: number;
  fadeIn: boolean;
  seed: number;
  style?: RoadStyle;
  overSymbols: boolean;
  /** Continuity retained when a line is split; all distances remain world meters. */
  continuity?: { before?:Point; after?:Point; segmentOffset:number; distanceOffset:number };
}
export function newLine(kind: 'road' | 'river', seed = 1, type:LineTypeId=kind==='road'?'street':'river'): LandscapeLine {
  const t=lineType(type);if(t?.kind!==kind)throw Error('Verlaufstyp prüfen.');
  return {version:2,type,catalogVersion:1,curve:type==='canal'?'linear':'smooth',
    roughness:type==='canal'?0:kind==='river'?2:.33,meander:kind==='river'&&type!=='canal'?.6:0,
    fadeIn:kind==='river'&&type!=='canal',seed,overSymbols:false};
}
export function legacyLine(kind:'road'|'river',style?:string):LandscapeLine {
  return {version:1,curve:'linear',color:kind==='river'?'#629ebc':'#a37e51',roughness:0,meander:0,fadeIn:false,seed:1,overSymbols:false,style:style==='path'?'dashed':'solid'};
}
export function validateLine(r: LandscapeRecord) {
  if(r.routeId!==undefined&&(typeof r.routeId!=='string'||!r.routeId)||r.routeLength!==undefined&&(!Number.isFinite(r.routeLength)||r.routeLength<0))throw Error('Verlaufslänge prüfen.');
  for(const [entries,field] of [[r.junctions,'id'],[r.cityAnchors,'cityId']] as const){if(entries===undefined)continue;if(!Array.isArray(entries)||!['road','river'].includes(r.kind)||new Set(entries.map(e=>e.index)).size!==entries.length||entries.some(e=>!Number.isSafeInteger(e.index)||e.index<0||e.index>=r.points.length||typeof (e as any)[field]!=='string'||!(e as any)[field]))throw Error('Verlaufsanschlüsse prüfen.');}

  const s=r.line;
  if (!s) return;
  if (!['road','river'].includes(r.kind)||![1,2].includes(s.version)||!['smooth','linear'].includes(s.curve)||
    (s.version===1?(!/^#[\da-f]{6}$/i.test(s.color??'')||!roadStyles.some(([id])=>id===s.style)):(s.catalogVersion!==1||lineType(s.type)?.kind!==r.kind||s.color!==undefined||s.style!==undefined))||
    !Number.isFinite(s.roughness)||s.roughness<0||s.roughness>(r.kind==='river'?3:1)||
    !Number.isFinite(s.meander)||s.meander<0||s.meander>1||
    !Number.isSafeInteger(s.seed)||s.seed<0||s.seed>0xffffffff||typeof s.fadeIn!=='boolean'||typeof s.overSymbols!=='boolean')
    throw new Error('Kurve, Farbe und Verlaufsoptionen prüfen.');
  const c=s.continuity;
  if(c&&(!Number.isSafeInteger(c.segmentOffset)||c.segmentOffset<0||!Number.isFinite(c.distanceOffset)||c.distanceOffset<0||[c.before,c.after].some(p=>p&&(!Number.isFinite(p.x)||!Number.isFinite(p.y)))))throw Error('Kurvenanschluss prüfen.');
  if(r.points.length>2000)throw new Error('Verlauf hat zu viele Kontrollpunkte.');
}
function noise(seed:number, n:number) {
  let v=(seed^Math.imul(n+1,0x45d9f3b))>>>0;
  v=Math.imul(v^(v>>>16),0x45d9f3b);v=Math.imul(v^(v>>>16),0x45d9f3b);
  return ((v^(v>>>16))>>>0)/0xffffffff*2-1;
}
/** Stable world geometry. Neither the camera nor the output resolution participates. */
export function linePoints(r: LandscapeRecord): Point[] {
  const s=r.line,p=r.points;
  if(!s||p.length<2)return p;
  const result:Point[]=[];
  for(let i=0;i<p.length-1;i++){
    const a=p[i]!,b=p[i+1]!,before=p[i-1]??s.continuity?.before??a,after=p[i+2]??s.continuity?.after??b;
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
    if(!len){if(!result.length)result.push({...a});continue;}
    const steps=32,amp=r.kind==='river'?s.meander*Math.min(len*.12,r.width*12):r.width*s.roughness*.45;
    for(let j=0;j<steps;j++){
      const t=j/steps,t2=t*t,t3=t2*t;
      // Typed curves must commute with city-frame rotation. Legacy curves retain
      // their historical component clamp until an explicit type assignment.
      const tangent=(v:Point,d:Point,k:'x'|'y')=>s.version===2?(v[k]-d[k])/2*Math.min(1,len/(Math.hypot(v.x-d.x,v.y-d.y)/2||1)):Math.max(-len,Math.min(len,(v[k]-d[k])/2));
      const component=(k:'x'|'y')=>s.curve==='linear'?a[k]+(b[k]-a[k])*t:
        (2*t3-3*t2+1)*a[k]+(t3-2*t2+t)*tangent(b,before,k)+(-2*t3+3*t2)*b[k]+(t3-t2)*tangent(after,a,k);
      const offset=Math.sin(Math.PI*t)*(amp*Math.sin(t*Math.PI*2*(r.kind==='river'?1+(1-s.meander)*3:1)+noise(s.seed,i+(s.continuity?.segmentOffset??0))*Math.PI)+r.width*s.roughness*.12*Math.sin(t*Math.PI*8+noise(s.seed,i+111+(s.continuity?.segmentOffset??0))));
      result.push({x:component('x')-dy/len*offset,y:component('y')+dx/len*offset});
    }
  }
  result.push({...p.at(-1)!});
  return result;
}
export interface LinePart { points:Point[]; width:number; color:string; opacity:number; polygons?:Polygon[]; dash?:number[]; dashOffset?:number }
/** Common numeric paint parts for screen, dense overview and export. */
function legacyParts(r:LandscapeRecord,points:Point[],w:number):LinePart[]{
  const s=r.line,color=s?.color??(r.kind==='river'?'#629ebc':'#a37e51');
  const part=(width=w,opacity=1,c=color):LinePart=>({points,width,color:c,opacity});
  if(!s)return [part()];
  if(r.kind==='river'){
    if(!s.fadeIn)return [part()];
    let travel=s.continuity?.distanceOffset??0;const left:Point[]=[],right:Point[]=[];
    for(let i=0;i<points.length;i++){
      const p=points[i]!,a=points[Math.max(0,i-1)]!,b=points[Math.min(points.length-1,i+1)]!;
      if(i)travel+=Math.hypot(p.x-a.x,p.y-a.y);
      const length=Math.hypot(b.x-a.x,b.y-a.y)||1,radius=w/2*Math.min(1,travel/(r.width*8));
      const x=-(b.y-a.y)/length*radius,y=(b.x-a.x)/length*radius;
      left.push({x:p.x+x,y:p.y+y});right.push({x:p.x-x,y:p.y-y});
    }
    return [{...part(),polygons:[{outer:[...left,...right.reverse()],holes:[]}]}];
  }
  const dashed=(pattern:number[],width=w):LinePart[]=>[{...part(width),dash:pattern.map(n=>n*w),dashOffset:s.continuity?.distanceOffset??0}];
  switch(s.style??'solid'){
    case 'blended':return [part(w*1.6,.12),part(w*1.3,.22),part(w,.7)];
    case 'solid':return [part()];
    case 'dashed':return dashed([3,2]);
    case 'dotted':return dashed([.05,1.8]);
    case 'dash-dot':return dashed([3,1.5,.05,1.5]);
    case 'dash-dot-dot':return dashed([3,1.5,.05,1.5,.05,1.5]);
    case 'double':{
      const offset=(side:number)=>points.map((p,i)=>{const a=points[Math.max(0,i-1)]!,b=points[Math.min(points.length-1,i+1)]!,l=Math.hypot(b.x-a.x,b.y-a.y)||1;return{x:p.x-(b.y-a.y)/l*w*.35*side,y:p.y+(b.x-a.x)/l*w*.35*side};});
      return [-1,1].map(side=>({...part(w*.22),points:offset(side),...(side===1?{dash:[w*2,w],dashOffset:s.continuity?.distanceOffset??0}:{})}));
    }
    case 'arrows':case 'rail':{
      const total=points.slice(1).reduce((v,p,i)=>v+Math.hypot(p.x-points[i]!.x,p.y-points[i]!.y),0);
      const step=Math.max(w*(s.style==='arrows'?2:1.1),total/2000),out:LinePart[]=[];
      let travel=s.continuity?.distanceOffset??0,next=Math.ceil(travel/step)*step;
      for(let i=1;i<points.length;i++){
        const a=points[i-1]!,b=points[i]!,len=Math.hypot(b.x-a.x,b.y-a.y);if(!len)continue;
        const tx=(b.x-a.x)/len,ty=(b.y-a.y)/len;
        for(;next<travel+len;next+=step){const t=(next-travel)/len,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
          const q=(along:number,side:number)=>({x:x+tx*w*along-ty*w*side,y:y+ty*w*along+tx*w*side});
          out.push({...part(w*.22),points:s.style==='arrows'?[q(-.6,-.45),q(.3,0),q(-.6,.45)]:[q(-.15,-.45),q(.15,.45)]});
        }travel+=len;
      }return out;
    }
    case 'worn':{
      let travel=s.continuity?.distanceOffset??0;const left:Point[]=[],right:Point[]=[];
      for(let i=0;i<points.length;i++){const p=points[i]!,a=points[Math.max(0,i-1)]!,b=points[Math.min(points.length-1,i+1)]!;if(i)travel+=Math.hypot(p.x-a.x,p.y-a.y);const len=Math.hypot(b.x-a.x,b.y-a.y)||1,radius=w*(.42+.12*Math.sin(travel/(w*2)+s.seed));const x=-(b.y-a.y)/len*radius,y=(b.x-a.x)/len*radius;left.push({x:p.x+x,y:p.y+y});right.push({x:p.x-x,y:p.y-y});}
      return [{...part(),polygons:[{outer:[...left,...right.reverse()],holes:[]}]}];
    }
  }
}
export function lineLength(r:LandscapeRecord){const p=linePoints(r);return p.slice(1).reduce((n,b,i)=>n+Math.hypot(b.x-p[i]!.x,b.y-p[i]!.y),0);}
export function lineDisplay(r:LandscapeRecord,mpp:number,selected=false){
  if(r.line?.version!==2)return {width:r.line?r.width:Math.max(r.width,mpp*2),opacity:1,detail:true};
  return lineScale(lineType(r.line?.type)??typeFor(r.kind==='river'?'river':'road',r.style),r.width,r.routeLength??lineLength(r),mpp,selected);
}
export function lineParts(r:LandscapeRecord,mpp=0,selected=false):LinePart[]{
  const d=lineDisplay(r,mpp,selected);if(d.opacity<=0)return [];
  const points=linePoints(r),t=lineType(r.line?.type),w=d.width;
  if(!r.line)return [{points,width:w,color:r.kind==='river'?'#629ebc':'#a37e51',opacity:1,...(r.kind==='road'&&r.style==='path'&&mpp?{dash:[mpp*5,mpp*3]}:{})}];
  if(!t||r.line?.version!==2)return legacyParts(r,points,w).map(p=>({...p,opacity:p.opacity*d.opacity}));
  const part=(width=w,color:string=t.color,pts=points):LinePart=>({points:pts,width,color,opacity:d.opacity});
  if(!d.detail)return [part()];
  const offset=(side:number)=>points.map((p,i)=>{const a=points[Math.max(0,i-1)]!,b=points[Math.min(points.length-1,i+1)]!,l=Math.hypot(b.x-a.x,b.y-a.y)||1;return{x:p.x-(b.y-a.y)/l*w*side,y:p.y+(b.x-a.x)/l*w*side};});
  const dashOffset=r.line.continuity?.distanceOffset??0;
  if(t.kind==='river'){
    const water=legacyParts({...r,line:{...r.line,version:1,color:t.color,style:'solid'}},points,w).map(p=>({...p,opacity:d.opacity}));
    // Do not draw caps across mouths: only the two banks have an outline.
    if(t.pattern!=='bank')return water;
    const sides=water[0]?.polygons?.[0]?.outer;
    if(sides){const n=sides.length/2;return [...water,part(w*.035,'#527e96',sides.slice(0,n)),part(w*.035,'#527e96',sides.slice(n))];}
    return [...water,part(w*.035,'#527e96',offset(-.48)),part(w*.035,'#527e96',offset(.48))];
  }
  switch(t.pattern){
    case 'dots':return [{...part(),dash:[w*.05,w*1.8],dashOffset}];
    case 'dashes':return [{...part(),dash:[w*2.5,w*1.8],dashOffset}];
    case 'tracks':return [-1,1].map(side=>part(w*.25,t.color,offset(side*.32)));
    case 'plain':return [part()];
    case 'edge':return [part(w,'#806747'),part(w*(t.id==='side-street'?.88:.78))];
    case 'double-edge':return [part(w,'#725735'),part(w*.85),part(w*.68,'#947752'),part(w*.57)];
    case 'avenue':return [part(w*.65,'#806747'),part(w*.52),...[-1,1].map(side=>({...part(w*.14,'#608451',offset(side*.42)),dash:[w*.01,w*1.4],dashOffset}))];
    default:return [part()];
  }
}
export function lineHit(r:LandscapeRecord,p:Point,mpp:number,tolerance=mpp*3){const d=lineDisplay(r,mpp);return d.opacity>0&&lineContains(r,p,Math.max(tolerance,d.width/2));}
export function lineContains(r:LandscapeRecord,p:Point,tolerance=0):boolean{
  const points=linePoints(r);let travel=r.line?.continuity?.distanceOffset??0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1]!,b=points[i]!,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(len*len||1)));
    const fade=r.kind==='river'&&r.line?.fadeIn?Math.min(1,(travel+len*t)/(r.width*8)):1;
    if(Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)<=Math.max(tolerance,r.width*fade/2))return true;
    travel+=len;
  }
  return false;
}

export function translateLine(r:LandscapeRecord,dx:number,dy:number){
  r.points=r.points.map(p=>({x:p.x+dx,y:p.y+dy}));
  const c=r.line?.continuity;if(c)for(const key of ['before','after'] as const){const p=c[key];if(p)c[key]={x:p.x+dx,y:p.y+dy};}
}
export function splitLine(r:LandscapeRecord,index:number,id:string):[LandscapeRecord,LandscapeRecord]{
  if(index<=0||index>=r.points.length-1)throw Error('Einen inneren Verlaufpunkt auswählen.');
  const first={...structuredClone(r),points:r.points.slice(0,index+1)},second={...structuredClone(r),id,revision:0,points:r.points.slice(index)};
  if(r.line){
    const c=r.line.continuity??{segmentOffset:0,distanceOffset:0};
    first.line!.continuity={...c,after:r.points[index+1]};
    const pts=linePoints(first),length=pts.slice(1).reduce((v,p,i)=>v+Math.hypot(p.x-pts[i]!.x,p.y-pts[i]!.y),0);
    second.line!.continuity={...c,before:r.points[index-1],segmentOffset:c.segmentOffset+index,distanceOffset:c.distanceOffset+length};
  }
  first.routeId=second.routeId=r.routeId??r.id;first.routeLength=second.routeLength=r.routeLength??lineLength(r);
  const junction=r.junctions?.find(n=>n.index===index)?.id??id+':join';
  first.junctions=[...(r.junctions??[]).filter(n=>n.index<index),{index,id:junction}];
  second.junctions=[{index:0,id:junction},...(r.junctions??[]).filter(n=>n.index>index).map(n=>({...n,index:n.index-index}))];
  first.cityAnchors=r.cityAnchors?.filter(n=>n.index<=index);second.cityAnchors=r.cityAnchors?.filter(n=>n.index>=index).map(n=>({...n,index:n.index-index}));
  return [first,second];
}

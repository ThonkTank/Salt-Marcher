// Prototype enclosure of RouteSurface's indexed, nearest-segment composition.
// Canonical point behavior remains in src/app/terrain-route.ts.
import type {LandscapeBox, LandscapeRecord} from '../../src/app/atlas-landscape';
import type {Point} from '../../src/app/contracts';
import type {RouteNode} from '../../src/app/terrain-route';

type I = [number, number];
interface Segment {record:LandscapeRecord; a:RouteNode; b:RouteNode; dx:number; dy:number; length:number; offset:number}
interface Hit {segment:Segment; distance:I; t:I; z:I; station:I}
interface Result {heightM:I; water:I}
const whole=():I=>[-Infinity,Infinity],point=(x:number):I=>[x,x];
const bits=new DataView(new ArrayBuffer(8));
function up(x:number):number {
  if(x===Infinity||Number.isNaN(x))return x;
  if(x===0)return Number.MIN_VALUE;
  bits.setFloat64(0,x);const n=bits.getBigUint64(0);bits.setBigUint64(0,x>0?n+1n:n-1n);return bits.getFloat64(0);
}
const down=(x:number)=>-up(-x);
const singleton=(a:I)=>a[0]===a[1];
function add(a:I,b:I):I {return singleton(a)&&singleton(b)?point(a[0]+b[0]):[down(a[0]+b[0]),up(a[1]+b[1])];}
function sub(a:I,b:I):I {return singleton(a)&&singleton(b)?point(a[0]-b[0]):[down(a[0]-b[1]),up(a[1]-b[0])];}
function mul(a:I,b:I):I {
  if(singleton(a)&&singleton(b))return point(a[0]*b[0]);
  const values=[a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]];
  return values.some(Number.isNaN)?whole():[down(Math.min(...values)),up(Math.max(...values))];
}
function div(a:I,b:I):I {
  if(b[0]<=0&&b[1]>=0)return whole();
  if(singleton(a)&&singleton(b))return point(a[0]/b[0]);
  const values=[a[0]/b[0],a[0]/b[1],a[1]/b[0],a[1]/b[1]];
  return values.some(Number.isNaN)?whole():[down(Math.min(...values)),up(Math.max(...values))];
}
const min=(a:I,b:I):I=>[Math.min(a[0],b[0]),Math.min(a[1],b[1])];
const max=(a:I,b:I):I=>[Math.max(a[0],b[0]),Math.max(a[1],b[1])];
const hull=(a:I,b:I):I=>[Math.min(a[0],b[0]),Math.max(a[1],b[1])];
const clamp=(a:I):I=>max(point(0),min(point(1),a));
const abs=(a:I):I=>[a[0]<=0&&a[1]>=0?0:Math.min(Math.abs(a[0]),Math.abs(a[1])),Math.max(Math.abs(a[0]),Math.abs(a[1]))];
function hypot(x:I,y:I):I {
  if(singleton(x)&&singleton(y))return point(Math.hypot(x[0],y[0]));
  const a=abs(x),b=abs(y),lo=Math.hypot(a[0],b[0]),hi=Math.hypot(a[1],b[1]);
  // Include library hypot rounding as well as the arithmetic input enclosure.
  const padding=16*Number.EPSILON*hi+16*Number.MIN_VALUE;
  return [Math.max(0,down(lo-padding)),up(hi+padding)];
}
function hitRange(segment:Segment,box:LandscapeBox):Hit {
  const {a,b,dx,dy,length,offset}=segment,x:I=[box.x,box.x+box.width],y:I=[box.y,box.y+box.height];
  const projection=div(add(mul(sub(x,point(a.x)),point(dx)),mul(sub(y,point(a.y)),point(dy))),point(dx*dx+dy*dy||1)),t=clamp(projection);
  const px=add(point(a.x),mul(point(dx),t)),py=add(point(a.y),mul(point(dy),t));
  let distance=hypot(sub(x,px),sub(y,py));
  const coordinate=Math.max(1,...[a.x,a.y,b.x,b.y,...x,...y].map(Math.abs));
  if(projection[0]>=0&&projection[1]<=1&&length>=2**-450&&length<=2**450&&coordinate<=2**450){
    // Within a segment, perpendicular distance avoids treating p and its own
    // projection as independent variables. Pad for canonical projection and
    // hypot rounding; retain the natural enclosure if it is tighter.
    const normal=abs(div(sub(mul(sub(x,point(a.x)),point(dy)),mul(sub(y,point(a.y)),point(dx))),point(length)));
    const padding=64*Number.EPSILON*coordinate+64*Number.MIN_VALUE;
    const lo=Math.max(distance[0],0,down(normal[0]-padding)),hi=Math.min(distance[1],up(normal[1]+padding));
    if(lo<=hi)distance=[lo,hi];
  }
  return {segment,t,distance,z:add(point(a.z),mul(point(b.z-a.z),t)),station:add(point(offset),mul(point(length),t))};
}
function contribution(hit:Hit,base:I):{weighted:I;weight:I;water:I;bounded:I} {
  const {segment:{record:r,a,b},distance,t,z,station}=hit,s=r.route!;
  const fade=r.kind==='river'&&r.line?.fadeIn?min(point(1),div(station,point(r.width*8))):point(1);
  const radius=mul(point(r.width/2),fade),edge=add(radius,point(s.limits.shoulder));
  if(distance[0]>edge[1])return {weighted:point(0),weight:point(0),water:point(0),bounded:base};
  const water:I=r.kind==='river'?[Number(distance[1]<=radius[0]),Number(distance[0]<=radius[1])]:point(0);
  const modes=new Set([...(t[0]<.5?[a.structure]:[]),...(t[1]>=.5?[b.structure]:[])]);
  const inactive=[...modes].filter(m=>m==='bridge'||m==='tunnel').length;
  if(inactive===modes.size)return {weighted:point(0),weight:point(0),water,bounded:base};
  const taper=clamp(div(sub(edge,distance),point(s.limits.shoulder)));
  let weight=mul(mul(taper,taper),sub(point(3),mul(point(2),taper)));
  // Real canonical weights are nonnegative; natural interval products may
  // include a negative subnormal solely from outward rounding around zero.
  weight=max(point(0),weight);
  const target=r.kind==='river'?sub(z,mul(point(s.limits.depth),fade)):z;
  const bounded=max(sub(base,point(s.limits.cut)),min(add(base,point(s.limits.fill)),target));
  let weighted=weight[1]===0?point(0):mul(bounded,weight);
  if(inactive||distance[1]>edge[0]){weight=hull(point(0),weight);weighted=hull(point(0),weighted);}
  return {weighted,weight,water,bounded};
}

export function createRouteFieldIntervals(records:readonly LandscapeRecord[]) {
  const routes=records.filter(r=>r.route?.nodes.length&&!r.route.conflict);
  const step=Math.max(64,...routes.map(r=>r.width+2*r.route!.limits.shoulder));
  const cells=new Map<string,Segment[]>();let references=0,segments=0;
  for(const record of routes){let offset=0;const nodes=record.route!.nodes;
    for(let i=1;i<nodes.length;i++){
      const a=nodes[i-1]!,b=nodes[i]!,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),pad=record.width/2+record.route!.limits.shoulder;
      const segment={record,a,b,dx,dy,length,offset};segments++;
      const x0=Math.floor((Math.min(a.x,b.x)-pad)/step),x1=Math.floor((Math.max(a.x,b.x)+pad)/step);
      const y0=Math.floor((Math.min(a.y,b.y)-pad)/step),y1=Math.floor((Math.max(a.y,b.y)+pad)/step);
      if(![x0,x1,y0,y1].every(Number.isSafeInteger))throw Error('Trassenindex nicht sicher darstellbar.');
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
        if(++references>300000)throw Error('Zu viele Verlaufdetails im Ausschnitt.');
        const key=x+':'+y,list=cells.get(key)??[];list.push(segment);cells.set(key,list);
      }
      offset+=length;
    }
  }
  function cellRange(list:Segment[],box:LandscapeBox,base:I):Result {
    const grouped=new Map<string,Hit[]>();
    for(const segment of list){const id=segment.record.id,hits=grouped.get(id)??[];hits.push(hitRange(segment,box));grouped.set(id,hits);}
    let weighted=point(0),total=point(0),strength=point(0),water=point(0),movement=base,singleTarget:I|undefined;
    for(const hits of grouped.values()){
      const nearestUpper=Math.min(...hits.map(hit=>hit.distance[1]));
      const possible=hits.filter(hit=>hit.distance[0]<=nearestUpper).map(hit=>contribution(hit,base));
      for(const value of possible)movement=hull(movement,value.bounded);
      if(grouped.size===1)singleTarget=possible.map(value=>value.bounded).reduce(hull);
      let w=possible[0]!.weight,v=possible[0]!.weighted,wet=possible[0]!.water;
      for(const value of possible.slice(1)){w=hull(w,value.weight);v=hull(v,value.weighted);wet=hull(wet,value.water);}
      weighted=add(weighted,v);total=add(total,w);strength=max(strength,w);water=max(water,wet);
    }
    if(total[1]===0)return {heightM:base,water};
    // The positive-weight average followed by strength<=1 is a convex blend
    // of base and bounded targets in real arithmetic. The absolute roundoff
    // allowance also covers subnormal products: their sum error / total is
    // multiplied by strength<=total, so no tiny denominator amplification
    // remains in the final height. See the route-area report's derivation.
    const magnitude=Math.max(1,...movement.map(Math.abs)),count=grouped.size;
    if(!Number.isFinite(magnitude)||magnitude>2**450)return {heightM:whole(),water};
    const error=64*(count+1)*(Number.EPSILON*magnitude+Number.MIN_VALUE);
    let envelope:I=[down(movement[0]-error),up(movement[1]+error)];
    if(singleTarget){
      // With one route, W/S is its bounded target whenever S>0. Keep that
      // dependency instead of independently dividing two intervals containing
      // the same weight. At S=0 the expression also yields base. E includes
      // the canonical multiply/divide roundoff; this is not exact cancellation.
      const correlated=add(base,mul(sub(singleTarget,base),strength));
      const lo=Math.max(envelope[0],down(correlated[0]-error)),hi=Math.min(envelope[1],up(correlated[1]+error));
      if(lo<=hi)envelope=[lo,hi];
    }
    if(total[0]<=0)return {heightM:envelope,water};
    const heightM=add(base,mul(sub(div(weighted,total),base),strength));
    const lo=Math.max(envelope[0],heightM[0]),hi=Math.min(envelope[1],heightM[1]);
    return {heightM:lo<=hi?[lo,hi]:envelope,water};
  }
  function range(box:LandscapeBox,base:I):Result {
    if(![box.x,box.y,box.width,box.height,box.x+box.width,box.y+box.height].every(Number.isFinite)||box.width<0||box.height<0||base[0]>base[1]||base.some(Number.isNaN))throw Error('Trassenintervall prüfen.');
    if(!cells.size)return {heightM:[...base],water:point(0)};
    const x0=Math.floor(box.x/step),x1=Math.floor((box.x+box.width)/step),y0=Math.floor(box.y/step),y1=Math.floor((box.y+box.height)/step);
    if(![x0,x1,y0,y1].every(Number.isSafeInteger)||(x1-x0+1)*(y1-y0+1)>64)return {heightM:whole(),water:[0,1]};
    let result:Result|undefined;
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const left=Math.max(box.x,x*step),top=Math.max(box.y,y*step),right=Math.min(box.x+box.width,(x+1)*step),bottom=Math.min(box.y+box.height,(y+1)*step);
      const value=cellRange(cells.get(x+':'+y)??[],{x:left,y:top,width:right-left,height:bottom-top},base);
      result=result?{heightM:hull(result.heightM,value.heightM),water:hull(result.water,value.water)}:value;
    }
    return result!;
  }
  function integrationCut(triangle:readonly Point[]) {
    for(const axis of ['x','y'] as const){
      const lo=Math.min(...triangle.map(p=>p[axis])),hi=Math.max(...triangle.map(p=>p[axis]));
      const first=Math.floor(lo/step)+1,last=Math.ceil(hi/step)-1;
      if(Number.isSafeInteger(first)&&Number.isSafeInteger(last)&&first<=last){
        const value=(first+Math.floor((last-first)/2))*step;
        if(value>lo&&value<hi)return {axis,value};
      }
    }
    return undefined;
  }
  return {range,integrationCut,diagnostics:{step,segments,references,cells:cells.size}};
}

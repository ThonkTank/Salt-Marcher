// Conservative normalized channel ranges for the authored material adapter.
// Ranges are local to one arrangement face: polygon masks are already exact.
const singleton = x => [x,x];
const pad = (lo,hi) => [Math.max(0,lo-16*Number.EPSILON),Math.min(1,hi+16*Number.EPSILON)];
function map(range,fn){
  const a=fn(range[0]),b=fn(range[1]);
  return range[0]===range[1]?singleton(a):pad(Math.min(a,b),Math.max(a,b));
}
function blend(a,b,t){
  const values=[];
  for(const x of a)for(const y of b)for(const z of t)values.push(x*(1-z)+y*z);
  const lo=Math.min(...values),hi=Math.max(...values);
  return a[0]===a[1]&&b[0]===b[1]&&t[0]===t[1]?singleton(lo):pad(lo,hi);
}
const finishBase=v=>{for(let c=0;c<4;c++)v[9+c]=v[c];};
export const baseRange=(color,forest)=>v=>{
  for(let c=0;c<3;c++)v[c]=singleton(color[c]);v[3]=[1,1];v[4]=singleton(forest);finishBase(v);
};
export const scratchRange=value=>v=>{v[13]=singleton(value);};
export const editRange=mode=>v=>{v[13]=map(v[13],x=>mode==='clear'?0:mode==='thin'?x*.3:Math.min(1,x+.5));};
export const legacyPartRange=opacity=>v=>{v[13]=map(v[13],x=>Math.round((opacity+x*(1-opacity))*255)/255);};
export function coverRange(color,region,radius){
  return (v,triangle)=>{
    let t;
    if(!region.varying)t=[1,1];
    else{
      const center={x:triangle[0].x+(triangle[1].x-triangle[0].x)/3+(triangle[2].x-triangle[0].x)/3,
        y:triangle[0].y+(triangle[1].y-triangle[0].y)/3+(triangle[2].y-triangle[0].y)/3};
      const reach=Math.max(...triangle.map(q=>Math.hypot(q.x-center.x,q.y-center.y)));
      const f=region.fade(center),guard=64*Number.EPSILON*Math.max(1,...triangle.flatMap(q=>[Math.abs(q.x),Math.abs(q.y)]))/radius;
      t=[Math.max(0,f-reach/radius-guard),Math.min(1,f+reach/radius+guard)];
    }
    const a=map(t,x=>.78*x*x*(3-2*x));
    for(let c=0;c<3;c++)v[c]=blend(v[c],singleton(color[c]),a);
    v[4]=blend(v[4],map(v[13],x=>Math.min(1,x/.8)),t);finishBase(v);
  };
}
export function pigmentRange(color,operation,getAlpha){
  return (v,triangle)=>{
    const a=getAlpha(v,triangle);
    if(a[1]===0)return;
    for(let c=0;c<3;c++){
      v[5+c]=blend(v[5+c],singleton(operation==='erase'?0:color[c]),a);
      v[9+c]=blend(v[9+c],operation==='erase'?v[c]:singleton(color[c]),a);
    }
    v[8]=blend(v[8],singleton(operation==='erase'?0:1),a);
    v[12]=[1,1];
  };
}
export function materialIntervalError(active,triangle,context){
  if(!context)throw Error('Material interval bound requires centroid context');
  const ranges=context.background.map(singleton);
  for(const layer of active){
    if(!layer.materialRange)throw Error('Unknown material interval operation');
    layer.materialRange(ranges,triangle);
  }
  const center=context.evaluateCenter();
  let error=0;
  for(let c=0;c<center.length;c++){
    const [lo,hi]=ranges[c];
    if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo>hi)throw Error('Invalid composed material interval');
    error=Math.max(error,Math.abs(center[c]-lo),Math.abs(center[c]-hi));
  }
  return error+64*Number.EPSILON*active.length;
}

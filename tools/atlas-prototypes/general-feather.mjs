// General authored-world feather regions. Union first, then measure distance to
// that union's real outer and hole boundaries. Triangle/decomposition edges
// never enter the distance query.
import polygonClipping from 'polygon-clipping';
import {convexFeatherRegions} from './convex-feather.mjs';

// The clipping arrangement can grow faster than its input. Keep this prototype
// deliberately bounded and fail closed if either side exceeds these limits.
export const GENERAL_FEATHER_LIMITS=Object.freeze({inputVertices:4096,unionVertices:16384,unionPolygons:1024});

const distanceToBox=(p,b)=>Math.hypot(Math.max(b.minX-p.x,0,p.x-b.maxX),Math.max(b.minY-p.y,0,p.y-b.maxY));
function distanceToSegment(p,e){
 const x=p.x-e.x,y=p.y-e.y,t=Math.max(0,Math.min(e.length,x*e.ux+y*e.uy));
 return Math.hypot(x-t*e.ux,y-t*e.uy);
}
function edgeTree(edges){
 const bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
 for(const e of edges){bounds.minX=Math.min(bounds.minX,e.minX);bounds.minY=Math.min(bounds.minY,e.minY);bounds.maxX=Math.max(bounds.maxX,e.maxX);bounds.maxY=Math.max(bounds.maxY,e.maxY);}
 if(edges.length<=8)return {...bounds,edges};
 const splitX=bounds.maxX-bounds.minX>=bounds.maxY-bounds.minY;
 edges.sort((a,b)=>splitX?a.minX+a.maxX-b.minX-b.maxX:a.minY+a.maxY-b.minY-b.maxY);
 const middle=edges.length>>1;
 return {...bounds,left:edgeTree(edges.slice(0,middle)),right:edgeTree(edges.slice(middle))};
}
function distanceSampler(edges,radius,curve,origin,scale){
 const tree=edgeTree(edges),stack=[],point={x:0,y:0};
 const normalize=worldPoint=>{
  if(!worldPoint||!Number.isFinite(worldPoint.x)||!Number.isFinite(worldPoint.y))throw Error('Feather sample point must be finite');
  const p={x:(worldPoint.x-origin[0])/scale,y:(worldPoint.y-origin[1])/scale};
  if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('Feather sample exceeds numeric extent');
  return p;
 };
 const nearest=(p,cutoff,two=false)=>{
  point.x=p.x;point.y=p.y;
  let best=cutoff,second=cutoff,nearestEdge;stack.length=0;stack.push(tree);
  while(stack.length){
   const node=stack.pop(),limit=two?second:best;if(distanceToBox(point,node)>=limit)continue;
   if(node.edges){for(const edge of node.edges){
    const d=distanceToSegment(point,edge);
    if(d<best){second=best;best=d;nearestEdge=edge;}else if(d<second)second=d;
   }}
   else{
    const a=node.left,b=node.right,da=distanceToBox(point,a),db=distanceToBox(point,b);
    if(da<db){if(db<limit)stack.push(b);if(da<limit)stack.push(a);}else{if(da<limit)stack.push(a);if(db<limit)stack.push(b);}
   }
  }
  return {best,second,edge:nearestEdge};
 };
 const fade=worldPoint=>{
  const {best}=nearest(normalize(worldPoint),radius);
  const t=radius===0?1:Math.min(1,best/radius);
  return curve==='linear'?t:t*t*(3-2*t);
 };
 // The triangle is already clipped to this region. A certificate uses all
 // true boundary segments, never the edges introduced by triangulation.
 const polynomialDegreeOnTriangle=worldTriangle=>{
  const points=worldTriangle.map(normalize);
  const center={x:points.reduce((s,p)=>s+p.x,0)/3,y:points.reduce((s,p)=>s+p.y,0)/3};
  const reach=Math.max(...points.map(p=>Math.hypot(p.x-center.x,p.y-center.y)));
  const guard=64*Number.EPSILON*Math.max(1,...points.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]),Math.abs(origin[0])/scale,Math.abs(origin[1])/scale);
  const {best,second,edge}=nearest(center,Infinity,true);
  if(best-reach>radius+guard)return 0;
  if(!edge||second-best<=2*reach+guard)return undefined;
  const signed=[];
  for(const p of points){
   const x=p.x-edge.x,y=p.y-edge.y,projection=x*edge.ux+y*edge.uy;
   if(projection<=guard||projection>=edge.length-guard)return undefined;
   signed.push(x*edge.uy-y*edge.ux);
  }
  if(!(Math.min(...signed)>guard||Math.max(...signed)<-guard))return undefined;
  // A nearest affine distance can still cross the clamped full-strength edge.
  if(Math.max(...signed.map(Math.abs))>=radius-guard)return undefined;
  return curve==='linear'?1:3;
 };
 return {fade,polynomialDegreeOnTriangle};
}
function coordinates(input){
 if(!Array.isArray(input))throw Error('Feather polygons must be an array');
 let count=0;
 const geometry=input.map(p=>{
  if(!p||!Array.isArray(p.outer)||!Array.isArray(p.holes))throw Error('Invalid feather polygon');
  return [p.outer,...p.holes].map(ring=>{
   if(!Array.isArray(ring)||ring.length<3)throw Error('Feather ring needs at least three vertices');
   let points=ring.map(point=>{
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))throw Error('Feather coordinates must be finite');
    if(++count>GENERAL_FEATHER_LIMITS.inputVertices)throw Error('General feather input vertex limit exceeded');
    return [point.x,point.y];
   });
   if(points[0][0]!==points.at(-1)[0]||points[0][1]!==points.at(-1)[1])points.push([...points[0]]);
   return points;
  });
 });
 return geometry;
}
function countUnion(union){
 let vertices=0;
 for(const polygon of union)for(const ring of polygon)vertices+=ring.length-1;
 if(union.length>GENERAL_FEATHER_LIMITS.unionPolygons||vertices>GENERAL_FEATHER_LIMITS.unionVertices)throw Error('General feather union complexity limit exceeded');
 return vertices;
}
function isConvex(outer){
 const ring=outer.slice(0,-1);if(ring.length<3||ring.length>64)return false;
 let sign=0;
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],c=ring[(i+2)%ring.length];
  const cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
  if(cross!==0){const next=Math.sign(cross);if(sign&&next!==sign)return false;sign=next;}
 }
 return sign!==0;
}
function pointPolygon(polygon){
 return {outer:polygon[0].slice(0,-1).map(([x,y])=>({x,y})),holes:polygon.slice(1).map(r=>r.slice(0,-1).map(([x,y])=>({x,y})))};
}

/**
 * Build feather regions from authored polygons. Overlapping and touching parts
 * are unioned before distance construction, so shared seams cannot fade. A
 * convex union component with at most 64 outer vertices and no holes uses the
 * exact polynomial fast path. Other components use true-boundary segment
 * distance and are intended for adaptive area integration with a conservative
 * final-channel Lipschitz bound (smoothstep t is 1.5/r-Lipschitz).
 *
 * Input is capped at 4096 authored vertices; the normalized union is capped at
 * 16384 vertices and 1024 components. Exceeding a limit throws; this API never
 * substitutes a sampled coverage mask or an approximate geometry.
 */
export function authoredFeatherRegions(polygons,radius,curve='linear'){
 if(!Number.isFinite(radius)||radius<0||!['linear','smoothstep'].includes(curve))throw Error('Invalid feather parameters');
 const source=coordinates(polygons);if(!source.length)return [];
 const union=polygonClipping.union(...source);countUnion(union);
 if(!union.length)return [];
 if(radius===0)return union.map(polygon=>({geometry:[polygon],fade:()=>1,varying:false,polynomialDegree:0}));
 const origin=union[0][0][0];let scale=0;
 for(const polygon of union)for(const ring of polygon)for(const p of ring)scale=Math.max(scale,Math.abs(p[0]-origin[0]),Math.abs(p[1]-origin[1]));
 const localRadius=radius/scale;
 if(!Number.isFinite(scale)||!scale||!Number.isFinite(localRadius)||!localRadius)throw Error('Feather geometry/radius exceeds numeric extent');
 const edges=[];
 for(const polygon of union)for(const ring of polygon)for(let i=0;i<ring.length-1;i++){
  const a=ring[i].map((v,c)=>(v-origin[c])/scale),b=ring[i+1].map((v,c)=>(v-origin[c])/scale),dx=b[0]-a[0],dy=b[1]-a[1];
  if(dx===0&&dy===0)continue;
  const length=Math.hypot(dx,dy);
  edges.push({x:a[0],y:a[1],ux:dx/length,uy:dy/length,length,minX:Math.min(a[0],b[0]),minY:Math.min(a[1],b[1]),maxX:Math.max(a[0],b[0]),maxY:Math.max(a[1],b[1])});
 }
 if(!edges.length)throw Error('Feather union has no valid boundary');
 const {fade,polynomialDegreeOnTriangle}=distanceSampler(edges,localRadius,curve,origin,scale),regions=[];
 for(const polygon of union){
  if(polygon.length===1&&isConvex(polygon[0])){
   regions.push(...convexFeatherRegions(pointPolygon(polygon),radius,curve));
  }else{
   regions.push({geometry:[polygon],fade,polynomialDegreeOnTriangle,varying:radius>0});
  }
 }
 return regions;
}

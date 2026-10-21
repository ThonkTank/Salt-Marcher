import type {Point,Polygon} from './contracts';
import type {LandscapeBox} from './atlas-landscape';

interface Bounds {minX:number;minY:number;maxX:number;maxY:number}
interface Edge extends Bounds {x:number;y:number;dx:number;dy:number;length2:number}
interface Node extends Bounds {edges?:Edge[];left?:Node;right?:Node}
function polygonBounds(p:Polygon):Bounds {
 const b={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
 for(const ring of [p.outer,...p.holes])for(const v of ring){b.minX=Math.min(b.minX,v.x);b.minY=Math.min(b.minY,v.y);b.maxX=Math.max(b.maxX,v.x);b.maxY=Math.max(b.maxY,v.y);}
 return b;
}
/** Only parts in the raster's distance halo can affect its pixels. A bounded
 * sweep proves common disjoint island sets need no polygon union. */
export function coverViewParts(polygons:Polygon[],box:LandscapeBox,radius:number){
 const parts=polygons.map(p=>({polygon:p,...polygonBounds(p)})).filter(p=>p.maxX>=box.x-radius&&p.minX<=box.x+box.width+radius&&p.maxY>=box.y-radius&&p.minY<=box.y+box.height+radius);
 const ordered=[...parts].sort((a,b)=>a.minX-b.minX),active:typeof parts=[];let disjoint=true,comparisons=0;
 outer:for(const p of ordered){
  for(let i=active.length-1;i>=0;i--){const other=active[i]!;if(other.maxX<p.minX){active.splice(i,1);continue;}
   if(++comparisons>200000||other.maxY>=p.minY&&other.minY<=p.maxY){disjoint=false;break outer;}
  }
  active.push(p);
 }
 return {polygons:parts.map(p=>p.polygon),disjoint};
}
const distanceToBox=(p:Point,b:Bounds)=>Math.max(b.minX-p.x,0,p.x-b.maxX)**2+Math.max(b.minY-p.y,0,p.y-b.maxY)**2;
const distanceToEdge=(p:Point,e:Edge)=>{const x=p.x-e.x,y=p.y-e.y,t=e.length2?Math.max(0,Math.min(1,(x*e.dx+y*e.dy)/e.length2)):0;return (x-t*e.dx)**2+(y-t*e.dy)**2;};
function edgeTree(edges:Edge[]):Node {
 const box={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
 for(const e of edges){box.minX=Math.min(box.minX,e.minX);box.minY=Math.min(box.minY,e.minY);box.maxX=Math.max(box.maxX,e.maxX);box.maxY=Math.max(box.maxY,e.maxY);}
 if(edges.length<=8)return {...box,edges};
 const x=box.maxX-box.minX>=box.maxY-box.minY;
 edges.sort((a,b)=>x?a.minX+a.maxX-b.minX-b.maxX:a.minY+a.maxY-b.minY-b.maxY);
 const mid=edges.length>>1;return {...box,left:edgeTree(edges.slice(0,mid)),right:edgeTree(edges.slice(mid))};
}

/** Exact nearest-boundary queries visit a spatial hierarchy, so broad feather
 * radii or many small islands do not scan every edge over the same pixels. */
function edgeRectangles(edges:Edge[],width:number,height:number,dx:number,dy:number,radius:number){
 return edges.map(edge=>({edge,left:Math.max(0,Math.ceil((edge.minX-radius)/dx-.5)),right:Math.min(width-1,Math.floor((edge.maxX+radius)/dx-.5)),top:Math.max(0,Math.ceil((edge.minY-radius)/dy-.5)),bottom:Math.min(height-1,Math.floor((edge.maxY+radius)/dy-.5))}));
}
function distanceRow(values:Float32Array,width:number,y:number,from:number,to:number,dx:number,py:number,e:Edge){
 for(let x=from;x<=to;x++){
  const px=(x+.5)*dx-e.x,t=e.length2?Math.max(0,Math.min(1,(px*e.dx+py*e.dy)/e.length2)):0,d=(px-e.dx*t)**2+(py-e.dy*t)**2,at=y*width+x;
  if(d<values[at]!)values[at]=d;
 }
}
function normalize(values:Float32Array,start:number,end:number,radius:number){
 const full=Math.fround(radius*radius);
 for(let i=start;i<end;i++){const t=values[i]===full?1:Math.min(1,Math.sqrt(values[i]!)/radius);values[i]=t*t*(3-2*t);}
}
/** Direct spans are cheaper for sparse edges. Only use this path when their
 * conservative total work is bounded by a few full raster passes. */
function* sparseDistances(rectangles:ReturnType<typeof edgeRectangles>,width:number,height:number,dx:number,dy:number,radius:number,checkpoint:()=>Generator<void>){
 const values=new Float32Array(width*height).fill(radius*radius);let work=0;
 for(const r of rectangles)if(r.right>=r.left)for(let y=r.top;y<=r.bottom;y++){
  distanceRow(values,width,y,r.left,r.right,dx,(y+.5)*dy-r.edge.y,r.edge);work+=r.right-r.left+1;
  if(work>=16384){yield* checkpoint();work=0;}
 }
 for(let start=0;start<values.length;start+=16384){yield* checkpoint();normalize(values,start,Math.min(values.length,start+16384),radius);}
 return values;
}
function distanceSampler(tree:Node,dx:number,dy:number,radius:number){
 const limit=radius*radius,full=Math.fround(limit),stack:Node[]=[],point={x:0,y:0};let nearest:Edge|undefined;
 return (x:number,y:number)=>{
  point.x=(x+.5)*dx;point.y=(y+.5)*dy;
  let best=nearest?Math.min(limit,distanceToEdge(point,nearest)):limit;
  stack.length=0;stack.push(tree);
  while(stack.length){
   const node=stack.pop()!;if(distanceToBox(point,node)>=best)continue;
   if(node.edges){for(const edge of node.edges){const d=distanceToEdge(point,edge);if(d<best){best=d;nearest=edge;}}}
   else{const a=node.left!,b=node.right!,da=distanceToBox(point,a),db=distanceToBox(point,b);
    if(da<db){if(db<best)stack.push(b);if(da<best)stack.push(a);}else{if(da<best)stack.push(a);if(db<best)stack.push(b);}
   }
  }
  const squared=Math.fround(best),t=squared===full?1:Math.min(1,Math.sqrt(squared)/radius);
  return Math.fround(t*t*(3-2*t));
 };
}

/** Distance to real polygon boundaries, never to the edge of a render tile. */
export function* coverFeatherSamplerSteps(polygons:Polygon[],box:LandscapeBox,width:number,height:number,radius:number,checkpoint:()=>Generator<void>):Generator<void,((x:number,y:number)=>number)|undefined>{
 const edges:Edge[]=[];let work=0;
 for(const polygon of polygons)for(const ring of [polygon.outer,...polygon.holes])for(let j=0;j<ring.length;j++){
  if(++work%4096===0)yield* checkpoint();
  const a=ring[j]!,b=ring[(j+1)%ring.length]!,ax=a.x-box.x,ay=a.y-box.y,vx=b.x-a.x,vy=b.y-a.y;let lo=0,hi=1;
  for(const [origin,delta,min,max] of [[ax,vx,-radius,box.width+radius],[ay,vy,-radius,box.height+radius]]){
   if(delta===0){if(origin!<min!||origin!>max!){hi=-1;break;}}
   else{const u=(min!-origin!)/delta!,v=(max!-origin!)/delta!;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));}
  }
  if(hi<lo)continue;
  const x=ax+vx*lo,y=ay+vy*lo,dx=vx*(hi-lo),dy=vy*(hi-lo);
  edges.push({x,y,dx,dy,length2:dx*dx+dy*dy,minX:Math.min(x,x+dx),minY:Math.min(y,y+dy),maxX:Math.max(x,x+dx),maxY:Math.max(y,y+dy)});
 }
 if(!edges.length)return;
 yield* checkpoint();const dx=box.width/width,dy=box.height/height,rectangles=edgeRectangles(edges,width,height,dx,dy,radius);
 const estimatedSamples=rectangles.reduce((n,r)=>n+Math.max(0,r.right-r.left+1)*Math.max(0,r.bottom-r.top+1),0);
 if(estimatedSamples<=width*height*4){const values=yield* sparseDistances(rectangles,width,height,dx,dy,radius,checkpoint);return(x:number,y:number)=>values[y*width+x]!;}
 return distanceSampler(edgeTree(edges),dx,dy,radius);
}

/** Soft pigment edges drop sub-sample vertices; their opacity is already zero
 * at the boundary. Selection and authored geometry retain original rings. Tolerance
 * depends on sample spacing, not tile bounds, so adjacent tiles agree. */
export function coverDisplayPolygons(polygons:Polygon[],tolerance:number):Polygon[]{
 return polygons.map(p=>({outer:displayBoundary(p.outer,tolerance),holes:p.holes.map(r=>displayBoundary(r,tolerance))}));
}
function displayBoundary(ring:Point[],tolerance:number):Point[]{
 if(ring.length<16)return ring;
 const points=[...ring,ring[0]!],keep=new Uint8Array(points.length),stack=Array.from({length:Math.ceil(ring.length/64)},(_,i)=>[i*64,Math.min(ring.length,(i+1)*64)]),limit=tolerance*tolerance;
 for(const [a,b]of stack){keep[a!]=1;keep[b!]=1;}
 while(stack.length){const [first,last]=stack.pop()!,a=points[first!]!,b=points[last!]!,vx=b.x-a.x,vy=b.y-a.y,length=vx*vx+vy*vy;let distance=limit,index=-1;
  for(let i=first!+1;i<last!;i++){const px=points[i]!.x-a.x,py=points[i]!.y-a.y,t=length?Math.max(0,Math.min(1,(px*vx+py*vy)/length)):0,d=(px-vx*t)**2+(py-vy*t)**2;if(d>distance){distance=d;index=i;}}
  if(index>=0){keep[index]=1;stack.push([first!,index],[index,last!]);}
 }
 const result=points.filter((_,i)=>i<ring.length&&keep[i]);return result.length>=3?result:ring;
}

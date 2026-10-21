import type {Point,Polygon} from './contracts';
import type {LandscapeBox} from './atlas-landscape';
/** Distance to real polygon boundaries, never to the edge of a render tile. */
export function* coverFeatherSteps(polygons:Polygon[],box:LandscapeBox,width:number,height:number,radius:number,checkpoint:()=>Generator<void>):Generator<void,Float32Array|undefined>{
 // Clip distant segments first; each scanline visits only the capsule around
 // the edge, rather than a diagonal edge's full bounding rectangle.
 let distance:Float32Array|undefined;const dx=box.width/width,dy=box.height/height;let work=0;
 for(const polygon of polygons)for(const ring of [polygon.outer,...polygon.holes]){
 for(let j=0;j<ring.length;j++){
  const a=ring[j]!,b=ring[(j+1)%ring.length]!,ax=a.x-box.x,ay=a.y-box.y,vx=b.x-a.x,vy=b.y-a.y;let lo=0,hi=1;
  for(const [origin,delta,min,max] of [[ax,vx,-radius,box.width+radius],[ay,vy,-radius,box.height+radius]]){
   if(delta===0){if(origin!<min!||origin!>max!){hi=-1;break;}}
   else{const u=(min!-origin!)/delta!,v=(max!-origin!)/delta!;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));}
  }
  if(hi<lo)continue;
  distance??=new Float32Array(width*height).fill(radius*radius);
  const x0=ax+vx*lo,y0=ay+vy*lo,ex=vx*(hi-lo),ey=vy*(hi-lo),length2=ex*ex+ey*ey,limit=radius*Math.sqrt(length2);
  const top=Math.max(0,Math.ceil((Math.min(y0,y0+ey)-radius)/dy-.5)),bottom=Math.min(height-1,Math.floor((Math.max(y0,y0+ey)+radius)/dy-.5));
  for(let y=top;y<=bottom;y++){
   const py=(y+.5)*dy-y0;let left=length2?-Infinity:Infinity,right=length2?Infinity:-Infinity;
   // The finite strip around the segment, intersected with this scanline.
   for(const [factor,min,max] of length2?[[ex,-py*ey,length2-py*ey],[ey,py*ex-limit,py*ex+limit]]:[]){
    if(factor===0){if(min!>0||max!<0){left=Infinity;right=-Infinity;break;}}
    else{const a=min!/factor!,b=max!/factor!;left=Math.max(left,Math.min(a,b));right=Math.min(right,Math.max(a,b));}
   }
   if(left>right){left=Infinity;right=-Infinity;}
   // Round caps complete the distance-to-segment capsule.
   for(const [cx,cy] of [[0,0],[ex,ey]]){const vertical=py-cy!;if(Math.abs(vertical)<=radius){const reach=Math.sqrt(Math.max(0,radius*radius-vertical*vertical));left=Math.min(left,cx!-reach);right=Math.max(right,cx!+reach);}}
   const from=Math.max(0,Math.ceil((x0+left)/dx-.5)),to=Math.min(width-1,Math.floor((x0+right)/dx-.5));
   distanceRow(distance,width,y,from,to,dx,x0,py,ex,ey,length2);
   work+=Math.max(0,to-from+1);if(work>=16384){yield* checkpoint();work=0;}

  }
 }
 }
 if(!distance)return;
 for(let start=0;start<distance.length;start+=16384){yield* checkpoint();normalizeDistances(distance,start,Math.min(distance.length,start+16384),radius);}

 return distance;
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

function distanceRow(distance:Float32Array,width:number,y:number,from:number,to:number,dx:number,x0:number,py:number,ex:number,ey:number,length2:number){
 for(let x=from;x<=to;x++){
  const px=(x+.5)*dx-x0,t=length2?Math.max(0,Math.min(1,(px*ex+py*ey)/length2)):0,ux=px-ex*t,uy=py-ey*t,d2=ux*ux+uy*uy,i=y*width+x;
  if(d2<distance[i]!)distance[i]=d2;
 }
}
function normalizeDistances(distance:Float32Array,from:number,to:number,radius:number){
 const full=Math.fround(radius*radius);
 for(let i=from;i<to;i++){if(distance[i]===full){distance[i]=1;continue;}const t=Math.min(1,Math.sqrt(distance[i]!)/radius);distance[i]=t*t*(3-2*t);}
}
